const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    mobile: { type: String, required: true },
    countryCode: { type: String, required: true },
    name: { type: String, default: null },
    email: { type: String, default: null },
    wallet: { type: Number, default: 0 },
  },
  { timestamps: true }
);

userSchema.index({ mobile: 1, countryCode: 1 }, { unique: true });

module.exports = mongoose.model("User", userSchema);
