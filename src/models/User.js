const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    mobile: { type: String, required: true },
    countryCode: { type: String, required: true },
    name: { type: String, default: null },
    email: { type: String, default: null },
    wallet: { type: Number, default: 0 },
    isFirstLoginPending: { type: Boolean, default: false },
    canRedeemInviteCode: { type: Boolean, default: false },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    referredInviteCode: { type: String, default: null },
    referralRedeemedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index({ mobile: 1, countryCode: 1 }, { unique: true });

module.exports = mongoose.model("User", userSchema);
