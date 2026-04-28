const mongoose = require("mongoose");

const walletAdjustmentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    /** Appointment row where the admin opened wallet adjustment (context). */
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", default: null, index: true },
    type: { type: String, required: true, enum: ["credit", "debit"] },
    amount: { type: Number, required: true, min: 0 },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    note: { type: String, default: null },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", default: null },
  },
  { timestamps: true }
);

walletAdjustmentSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("WalletAdjustment", walletAdjustmentSchema);
