const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    contactKey: { type: String, required: true, unique: true },
    otp: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Otp", otpSchema);
