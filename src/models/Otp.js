const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    mobile: { type: String, required: true },
    countryCode: { type: String, required: true },
    email: { type: String, default: null, lowercase: true, trim: true },
    otp: { type: String, required: true, select: false },
    purpose: { type: String, enum: ["signup", "login"], default: "signup" },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true }
);

otpSchema.index({ mobile: 1, countryCode: 1, purpose: 1 });

module.exports = mongoose.model("Otp", otpSchema);
