const Appointment = require("../models/Appointment");
const Notification = require("../models/Notification");
const Service = require("../models/Service");
const User = require("../models/User");
const { AppError } = require("../middleware/errorHandler");
const { success } = require("../utils/response");
const {
  generateSlots,
  parseTimeToMinutes,
  getSlotEndMinutes,
  overlaps,
} = require("../config/slots");
const { resolveSalonBookingWindow } = require("../services/salonAvailability.service");

/**
 * Appointments tied to this account: saved with userId OR guest rows (userId null) with same mobile + countryCode.
 */
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
    const { date, serviceId } = req.query;
    if (!date || !serviceId) {
      throw new AppError("date and serviceId are required", 400);
    }

    const service = await Service.findById(serviceId);
    if (!service) throw new AppError("Service not found", 404);

    const duration = service.duration || 30;
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

    success(res, {
      slots: availableSlots,
      duration,
      serviceTitle: service.title,
    }, "Available slots retrieved successfully");
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { name, email, mobile, countryCode, service, serviceId, date, time, notes } = req.body;
    if (!name || !email || !mobile || !date) {
      throw new AppError("Name, email, mobile and date required", 400);
    }
    if (!service && !serviceId) {
      throw new AppError("service or serviceId is required", 400);
    }

    let serviceDoc = null;
    let serviceTitle = service;
    let duration = 30;

    if (serviceId) {
      serviceDoc = await Service.findById(serviceId);
      if (!serviceDoc) throw new AppError("Service not found", 404);
      serviceTitle = serviceDoc.title;
      duration = serviceDoc.duration || 30;
    } else if (service) {
      serviceDoc = await Service.findOne({ title: service, isActive: true });
      duration = serviceDoc ? (serviceDoc.duration || 30) : 30;
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

    const appointment = await Appointment.create({
      userId: req.userId || null,
      name,
      email,
      mobile: mobile.replace(/\D/g, ""),
      countryCode: countryCode || "+61",
      service: serviceTitle,
      serviceId: serviceDoc?._id || null,
      date,
      time: time || null,
      duration,
      notes: notes || null,
    });

    if (req.userId) {
      await Notification.create({
        userId: req.userId,
        read: false,
        type: "appointment",
        title: "Appointment booked",
        body: `${serviceTitle} on ${date}${time ? ` at ${time}` : ""}`,
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

/**
 * Badge-style counts: appointments + unread notifications for this mobile/countryCode (no auth token).
 */
async function getCounts(req, res, next) {
  try {
    const { mobile, countryCode } = req.query;
    if (!mobile || !countryCode) {
      throw new AppError("mobile and countryCode query params are required", 400);
    }

    const normalizedMobile = String(mobile).replace(/\D/g, "");
    const cc = String(countryCode).trim();

    const user = await User.findOne({
      mobile: normalizedMobile,
      countryCode: cc,
    })
      .select("_id mobile countryCode")
      .lean();

    const appointmentsFilter = user
      ? buildMyAppointmentsFilter(user)
      : { userId: null, mobile: normalizedMobile, countryCode: cc };

    const [appointmentsCount, notificationCount] = await Promise.all([
      Appointment.countDocuments(appointmentsFilter),
      user
        ? Notification.countDocuments({ userId: user._id, read: false })
        : Promise.resolve(0),
    ]);

    success(
      res,
      {
        appointmentsCount,
        appointmentCount: appointmentsCount,
        notificationCount,
      },
      "Counts retrieved successfully"
    );
  } catch (err) {
    next(err);
  }
}

module.exports = { create, getMyAppointments, getAvailableSlots, getCounts };
