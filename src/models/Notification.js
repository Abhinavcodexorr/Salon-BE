const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    read: { type: Boolean, default: false, index: true },
    type: {
      type: String,
      default: "appointment",
      enum: ["appointment", "system"],
    },
    title: { type: String, default: null },
    body: { type: String, default: null },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
