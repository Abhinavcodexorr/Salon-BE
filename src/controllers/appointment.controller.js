const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const Notification = require("../models/Notification");
const Service = require("../models/Service");
const User = require("../models/User");
const { AppError } = require("../middleware/errorHandler");
const { success } = require("../utils/response");
const {
  generateSlots,
  parseTimeToMinutes,
  minutesToTimeStr,
  overlaps,
} = require("../config/slots");
const { resolveSalonBookingWindow } = require("../services/salonAvailability.service");

/**
 * Minutes for overlap / booking: line `time` → block `duration` → service `duration`.
 */
function resolveBookingDurationFromService(serviceDoc, opts = {}) {
  if (!serviceDoc) return 30;
  const fallback = Math.max(1, Number(serviceDoc.duration) || 30);
  const subRaw = String(opts.subheading ?? opts.subservice ?? "").trim();
  const itemRaw = String(opts.serviceItemName ?? opts.itemName ?? "").trim();
  const blocks = serviceDoc.subheadings || [];

  if (subRaw && itemRaw) {
    for (const block of blocks) {
      const blockTitle = String(block.subheading || "").trim();
      if (blockTitle !== subRaw) continue;
      for (const it of block.items || []) {
        if (String(it.name || "").trim() === itemRaw) {
          const lineMins = it.time ?? it.duration;
          if (lineMins != null && Number(lineMins) >= 1) return Math.floor(Number(lineMins));
        }
      }
      const blockMins = block.duration ?? block.time;
      if (blockMins != null && Number(blockMins) >= 1) return Math.floor(Number(blockMins));
    }
  }
  if (subRaw) {
    for (const block of blocks) {
      if (String(block.subheading || "").trim() !== subRaw) continue;
      const blockMins = block.duration ?? block.time;
      if (blockMins != null && Number(blockMins) >= 1) return Math.floor(Number(blockMins));
    }
  }
  return fallback;
}

function linePriceFromService(serviceDoc, subRaw, itemRaw) {
  if (!serviceDoc || !subRaw || !itemRaw) return 0;
  for (const block of serviceDoc.subheadings || []) {
    if (String(block.subheading || "").trim() !== subRaw) continue;
    for (const it of block.items || []) {
      if (String(it.name || "").trim() === itemRaw) return Math.max(0, Number(it.price) || 0);
    }
  }
  return 0;
}

function buildServiceDisplayLine(serviceName, subheading, itemName) {
  return [serviceName, subheading, itemName].filter((s) => s && String(s).trim()).join(" › ");
}

/**
 * Resolves each row to a stored selection + total minutes.
 * @param {Array<{ serviceId: string, subheading?: string, subservice?: string, serviceItemName?: string, itemName?: string, serviceName?: string }>} rows
 */
async function buildSelectionsFromRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new AppError("serviceSelections must be a non-empty array", 400);
  }
  const selections = [];
  let totalDuration = 0;

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] || {};
    const id = row.serviceId;
    if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
      throw new AppError(`serviceSelections[${i}].serviceId must be a valid ObjectId`, 400);
    }
    const doc = await Service.findById(id);
    if (!doc) throw new AppError(`Service not found for serviceSelections[${i}]`, 404);
    if (!doc.isActive) throw new AppError(`Service is not active (serviceSelections[${i}])`, 400);

    const sub = String(row.subheading ?? row.subservice ?? "").trim() || null;
    const item = String(row.serviceItemName ?? row.itemName ?? "").trim() || null;
    const sn = String(row.serviceName ?? "").trim() || Service.getDisplayNameForDoc(doc);
    const mins = resolveBookingDurationFromService(doc, {
      subheading: sub,
      serviceItemName: item,
      itemName: item,
    });
    const price = linePriceFromService(doc, sub, item);
    const displayLine = buildServiceDisplayLine(sn, sub, item) || sn;
    selections.push({
      serviceId: doc._id,
      serviceName: sn,
      subheading: sub,
      serviceItemName: item,
      duration: mins,
      price,
      displayLine,
    });
    totalDuration += mins;
  }

  const totalAmount = selections.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
  return { selections, totalDuration, totalAmount };
}

function parseServiceSelectionsQuery(raw) {
  if (raw == null || raw === "") return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function buildMyAppointmentsFilter(userDoc) {
  const mobile = String(userDoc.mobile || "").replace(/\D/g, "");
  const countryCode = userDoc.countryCode;
  return {
    $or: [
      { userId: userDoc._id },
      { userId: null, mobile, countryCode },
    ],
  };
}

async function getAvailableSlots(req, res, next) {
  try {
    const { date, serviceId, subheading, subservice, serviceItemName, itemName, serviceSelections } = req.query;
    if (!date) {
      throw new AppError("date is required", 400);
    }

    const rows = parseServiceSelectionsQuery(serviceSelections);
    let duration;
    let serviceTitle = "";

    let totalAmount = 0;
    if (rows && rows.length > 0) {
      const built = await buildSelectionsFromRows(rows);
      duration = built.totalDuration;
      totalAmount = built.totalAmount;
      serviceTitle = built.selections.map((s) => s.displayLine).join(" | ");
    } else {
      if (!serviceId) {
        throw new AppError("serviceId or serviceSelections (JSON array) is required", 400);
      }
      if (!mongoose.Types.ObjectId.isValid(serviceId)) {
        throw new AppError("Invalid serviceId. Use the service document _id only.", 400);
      }
      const service = await Service.findById(serviceId);
      if (!service) throw new AppError("Service not found", 404);
      duration = resolveBookingDurationFromService(service, {
        subheading,
        subservice,
        serviceItemName,
        itemName,
      });
      serviceTitle = Service.getDisplayNameForDoc(service);
      const subQ = String(subheading ?? subservice ?? "").trim() || null;
      const itemQ = String(serviceItemName ?? itemName ?? "").trim() || null;
      totalAmount = linePriceFromService(service, subQ, itemQ);
    }

    const { from: start, to: end } = await resolveSalonBookingWindow();
    const allSlots = generateSlots(start, end);

    const existingAppointments = await Appointment.find({
      date,
      status: { $nin: ["cancelled"] },
    }).lean();

    const endMins = parseTimeToMinutes(end);
    const availableSlots = allSlots.filter((slotStr) => {
      const slotStart = parseTimeToMinutes(slotStr);
      const slotEnd = slotStart + duration;
      if (slotEnd > endMins) return false;

      const hasOverlap = existingAppointments.some((apt) => {
        if (!apt.time) return false;
        const aptStart = parseTimeToMinutes(apt.time);
        const aptEnd = aptStart + (apt.duration || 30);
        return overlaps(slotStart, slotEnd, aptStart, aptEnd);
      });

      return !hasOverlap;
    });

    success(
      res,
      {
        slots: availableSlots,
        duration,
        totalAmount,
        serviceTitle: serviceTitle || undefined,
      },
      "Available slots retrieved successfully"
    );
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const {
      name,
      email,
      mobile,
      countryCode,
      service,
      serviceId,
      serviceName: serviceNameBody,
      subheading,
      subservice,
      serviceItemName,
      itemName,
      serviceSelections: serviceSelectionsBody,
      date,
      time,
      notes,
    } = req.body;

    if (!name || !email || !mobile || !date) {
      throw new AppError("Name, email, mobile and date required", 400);
    }

    const hasMulti = Array.isArray(serviceSelectionsBody) && serviceSelectionsBody.length > 0;
    if (!hasMulti && !service && !serviceId) {
      throw new AppError("service or serviceId, or serviceSelections[], is required", 400);
    }

    let serviceDoc = null;
    let serviceTitle = service ? String(service).trim() : "";
    let duration = 30;
    let serviceSelections = [];
    const subheadingVal = String(subheading ?? subservice ?? "").trim() || null;
    const itemVal = String(serviceItemName ?? itemName ?? "").trim() || null;

    if (hasMulti) {
      const built = await buildSelectionsFromRows(serviceSelectionsBody);
      serviceSelections = built.selections;
      duration = built.totalDuration;
      serviceTitle = built.selections.map((s) => s.displayLine).join(" | ");
      const first = built.selections[0];
      serviceDoc = await Service.findById(first.serviceId);
    } else if (serviceId) {
      if (!mongoose.Types.ObjectId.isValid(serviceId)) {
        throw new AppError("Invalid serviceId. Use the service document _id only.", 400);
      }
      serviceDoc = await Service.findById(serviceId);
      if (!serviceDoc) throw new AppError("Service not found", 404);
      const headingDisplay = Service.getDisplayNameForDoc(serviceDoc);
      const nameFromBody = String(serviceNameBody ?? "").trim();
      const serviceNameStored = nameFromBody || headingDisplay;
      serviceTitle = buildServiceDisplayLine(serviceNameStored, subheadingVal, itemVal) || headingDisplay;
      duration = resolveBookingDurationFromService(serviceDoc, {
        subheading: subheadingVal,
        subservice: subheadingVal,
        serviceItemName: itemVal,
        itemName: itemVal,
      });
      const price = linePriceFromService(serviceDoc, subheadingVal, itemVal);
      serviceSelections = [
        {
          serviceId: serviceDoc._id,
          serviceName: serviceNameStored,
          subheading: subheadingVal,
          serviceItemName: itemVal,
          duration,
          price,
          displayLine: serviceTitle,
        },
      ];
    } else if (service) {
      const q = String(service).trim();
      serviceDoc = await Service.findOne({
        isActive: true,
        $or: [{ title: q }, { heading: q }],
      });
      duration = serviceDoc
        ? resolveBookingDurationFromService(serviceDoc, {
            subheading: subheadingVal,
            serviceItemName: itemVal,
            itemName: itemVal,
          })
        : 30;
      if (serviceDoc) {
        const headingDisplay = Service.getDisplayNameForDoc(serviceDoc);
        const nameFromBody = String(serviceNameBody ?? "").trim();
        const serviceNameStored = nameFromBody || headingDisplay;
        const rich = buildServiceDisplayLine(serviceNameStored, subheadingVal, itemVal) || headingDisplay;
        if (subheadingVal || itemVal) serviceTitle = rich;
        else if (!serviceTitle) serviceTitle = rich;
        const price = linePriceFromService(serviceDoc, subheadingVal, itemVal);
        serviceSelections = [
          {
            serviceId: serviceDoc._id,
            serviceName: serviceNameStored,
            subheading: subheadingVal,
            serviceItemName: itemVal,
            duration,
            price,
            displayLine: serviceTitle,
          },
        ];
      }
    }

    if (time) {
      const { from: salonFrom, to: salonTo } = await resolveSalonBookingWindow();
      const dayStartMins = parseTimeToMinutes(salonFrom);
      const dayEndMins = parseTimeToMinutes(salonTo);
      const slotStart = parseTimeToMinutes(time);
      const slotEnd = slotStart + duration;
      if (slotStart < dayStartMins || slotEnd > dayEndMins) {
        throw new AppError("Selected time is outside salon opening hours.", 400);
      }
      const existingList = await Appointment.find({
        date,
        status: { $nin: ["cancelled"] },
        time: { $exists: true, $ne: null },
      }).lean();

      const hasOverlap = existingList.some((apt) => {
        if (!apt.time) return false;
        const aptStart = parseTimeToMinutes(apt.time);
        const aptEnd = aptStart + (apt.duration || 30);
        return overlaps(slotStart, slotEnd, aptStart, aptEnd);
      });

      if (hasOverlap) {
        throw new AppError("This time slot is no longer available. Please choose another slot.", 400);
      }
    }

    const timeStart = time ? String(time).trim() : null;
    let timeEnd = null;
    if (timeStart && duration > 0) {
      try {
        timeEnd = minutesToTimeStr(parseTimeToMinutes(timeStart) + duration);
      } catch {
        timeEnd = null;
      }
    }

    const firstSel = serviceSelections[0];
    const rootServiceId = firstSel ? firstSel.serviceId : serviceDoc?._id || null;
    const rootServiceName = firstSel ? firstSel.serviceName : null;
    const rootSub = serviceSelections.length === 1 ? firstSel.subheading : null;
    const rootItem = serviceSelections.length === 1 ? firstSel.serviceItemName : null;
    const serviceNameForDb =
      serviceSelections.length === 1
        ? rootServiceName
        : serviceSelections.length > 1
          ? null
          : String(serviceNameBody ?? "").trim() || null;

    const totalAmount = serviceSelections.reduce(
      (sum, sel) => sum + (Number(sel.price) || 0),
      0
    );

    const appointment = await Appointment.create({
      userId: req.userId || null,
      name,
      email,
      mobile: mobile.replace(/\D/g, ""),
      countryCode: countryCode || "+61",
      service: serviceTitle,
      serviceId: rootServiceId,
      serviceName: serviceNameForDb,
      subheading: rootSub,
      serviceItemName: rootItem,
      date,
      time: timeStart,
      timeEnd,
      duration,
      totalAmount,
      notes: notes || null,
      serviceSelections,
    });

    if (req.userId) {
      await Notification.create({
        userId: req.userId,
        read: false,
        type: "appointment",
        title: "Appointment booked",
        body: `${serviceTitle} on ${date}${
          timeStart ? ` ${timeStart}${timeEnd ? `–${timeEnd}` : ""}` : ""
        }`,
        appointmentId: appointment._id,
      });
      const nm = String(name).trim();
      const em = String(email).trim().toLowerCase();
      await User.findByIdAndUpdate(req.userId, {
        $set: { name: nm, email: em },
      });
    }

    success(res, appointment, "Appointment created", 201);
  } catch (err) {
    next(err);
  }
}

async function getMyAppointments(req, res, next) {
  try {
    const user = await User.findById(req.userId).select("mobile countryCode").lean();
    if (!user) throw new AppError("Session invalid — please log in again", 401);

    const appointments = await Appointment.find(buildMyAppointmentsFilter(user))
      .sort({ createdAt: -1 })
      .lean();
    success(res, appointments, "Appointments retrieved successfully");
  } catch (err) {
    next(err);
  }
}

module.exports = { create, getMyAppointments, getAvailableSlots };
