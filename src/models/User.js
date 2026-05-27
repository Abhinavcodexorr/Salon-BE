const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },
    email: { type: String, default: null, trim: true, lowercase: true },
    password: { type: String, required: true, select: false },
    mobile: { type: String, default: null },
    countryCode: { type: String, default: null },
    name: { type: String, default: null },
    wallet: { type: Number, default: 0 },
    isFirstLoginPending: { type: Boolean, default: false },
    canRedeemInviteCode: { type: Boolean, default: false },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    referredInviteCode: { type: String, default: null },
    referralRedeemedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ mobile: 1, countryCode: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("User", userSchema);
