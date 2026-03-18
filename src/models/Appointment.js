const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    name: { type: String, required: true },
    email: { type: String, required: true },
    mobile: { type: String, required: true },
    countryCode: { type: String, default: "+61" },
    service: { type: String, required: true },
    date: { type: String, required: true },
    time: { type: String, default: null },
    status: { type: String, default: "pending", enum: ["pending", "confirmed", "completed", "cancelled"] },
    notes: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Appointment", appointmentSchema);
