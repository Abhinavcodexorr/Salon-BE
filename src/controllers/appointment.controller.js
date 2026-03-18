const Appointment = require("../models/Appointment");
const { AppError } = require("../middleware/errorHandler");
const { success } = require("../utils/response");

async function create(req, res, next) {
  try {
    const { name, email, mobile, countryCode, service, date, time, notes } = req.body;
    if (!name || !email || !mobile || !service || !date) {
      throw new AppError("Name, email, mobile, service and date required", 400);
    }
    const appointment = await Appointment.create({
      userId: req.userId || null,
      name,
      email,
      mobile: mobile.replace(/\D/g, ""),
      countryCode: countryCode || "+61",
      service,
      date,
      time: time || null,
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

module.exports = { create, getMyAppointments };
