const Appointment = require("../models/Appointment");
const Service = require("../models/Service");
const { AppError } = require("../middleware/errorHandler");
const { success } = require("../utils/response");
const {
  generateSlots,
  parseTimeToMinutes,
  getSlotEndMinutes,
  overlaps,
  getSalonBookingWindow,
} = require("../config/slots");

async function getAvailableSlots(req, res, next) {
  try {
    const { date, serviceId } = req.query;
    if (!date || !serviceId) {
      throw new AppError("date and serviceId are required", 400);
    }

    const service = await Service.findById(serviceId);
    if (!service) throw new AppError("Service not found", 404);

    const duration = service.duration || 30;
    const { from: start, to: end } = getSalonBookingWindow();
    const allSlots = generateSlots(start, end);

    const existingAppointments = await Appointment.find({
      date,
      status: { $nin: ["cancelled"] },
    }).lean();

    const availableSlots = allSlots.filter((slotStr) => {
      const slotStart = parseTimeToMinutes(slotStr);
      const slotEnd = slotStart + duration;

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
      const slotStart = parseTimeToMinutes(time);
      const slotEnd = slotStart + duration;
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
    success(res, appointment, "Appointment created", 201);
  } catch (err) {
    next(err);
  }
}

async function getMyAppointments(req, res, next) {
  try {
    const appointments = await Appointment.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .lean();
    success(res, appointments, "Appointments retrieved successfully");
  } catch (err) {
    next(err);
  }
}

module.exports = { create, getMyAppointments, getAvailableSlots };
