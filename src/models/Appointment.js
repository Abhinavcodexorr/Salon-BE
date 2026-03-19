const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    name: { type: String, required: true },
    email: { type: String, required: true },
    mobile: { type: String, required: true },
    countryCode: { type: String, default: "+61" },
    service: { type: String, required: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "Service", default: null },
    duration: { type: Number, default: 30 }, // minutes - from service at booking time
    date: { type: String, required: true },
    time: { type: String, default: null }, // slot start e.g. "09:00", "09:30"
    status: { type: String, default: "completed", enum: ["completed", "cancelled"] },
    notes: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Appointment", appointmentSchema);
