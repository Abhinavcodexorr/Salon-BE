const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    password: { type: String, required: true, select: false },
    mobile: { type: String, trim: true },
    countryCode: { type: String, trim: true },
    name: { type: String, trim: true },
    wallet: { type: Number, default: 0 },
    isFirstLoginPending: { type: Boolean, default: false },
    canRedeemInviteCode: { type: Boolean, default: false },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    referredInviteCode: { type: String, trim: true },
    referralRedeemedAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } } }
);
userSchema.index({ username: 1 }, { unique: true });
userSchema.index(
  { mobile: 1, countryCode: 1 },
  {
    unique: true,
    partialFilterExpression: {
      mobile: { $type: "string" },
      countryCode: { $type: "string" },
    },
  }
);

module.exports = mongoose.model("User", userSchema);
