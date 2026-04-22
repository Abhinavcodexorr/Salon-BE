const Appointment = require("../models/Appointment");
const User = require("../models/User");
const WalletAdjustment = require("../models/WalletAdjustment");
const { AppError } = require("../middleware/errorHandler");
const { success } = require("../utils/response");

function toWallet(n) {
  if (n == null || n === "") return 0;
  return Number(n);
}

/** Raw ObjectId of the user on an appointment (works if userId is populated or not). */
function resolveUserId(appointment) {
  const ref = appointment.userId;
  if (ref == null) return null;
  return ref && typeof ref === "object" && ref._id != null ? ref._id : ref;
}

/**
 * GET — load customer wallet + full adjustment history for the user linked to this appointment.
 * Used when opening the appointment wallet popup.
 */
async function getWalletByAppointmentId(req, res, next) {
  try {
    const { appointmentId } = req.params;
    const appointment = await Appointment.findById(appointmentId).lean();
    if (!appointment) throw new AppError("Appointment not found", 404);
    if (!appointment.userId) {
      throw new AppError("This appointment has no linked customer (guest). Wallet is only for logged-in users.", 400);
    }

    const user = await User.findById(appointment.userId).lean();
    if (!user) throw new AppError("User not found", 404);

    const adjustments = await WalletAdjustment.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .populate("adminId", "email")
      .lean();

    const wallet = toWallet(user.wallet);

    success(
      res,
      {
        appointment: {
          _id: appointment._id,
          date: appointment.date,
          service: appointment.service,
        },
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          mobile: user.mobile,
          countryCode: user.countryCode,
          wallet,
        },
        adjustments: adjustments.map((a) => ({
          _id: a._id,
          appointmentId: a.appointmentId,
          type: a.type,
          amount: a.amount,
          balanceBefore: a.balanceBefore,
          balanceAfter: a.balanceAfter,
          note: a.note,
          createdAt: a.createdAt,
          adminEmail: a.adminId && typeof a.adminId === "object" ? a.adminId.email : null,
        })),
      },
      "Wallet context loaded successfully"
    );
  } catch (err) {
    next(err);
  }
}

/**
 * POST — credit or debit on the customer’s real account: `User` document, field `wallet`
 * (same balance as after OTP login / app wallet — not a separate “shadow” balance).
 * Debit uses atomic $inc so the DB enforces “cannot take more than on file”.
 * Body: { "type": "credit" | "debit", "amount": number, "note": optional string }
 */
async function adjustWalletByAppointmentId(req, res, next) {
  try {
    const { appointmentId } = req.params;
    const { type, amount, note } = req.body || {};

    if (type !== "credit" && type !== "debit") {
      throw new AppError('type must be "credit" or "debit"', 400);
    }
    const amt = Number(amount);
    if (Number.isNaN(amt) || amt <= 0) {
      throw new AppError("amount must be a positive number", 400);
    }

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) throw new AppError("Appointment not found", 404);

    const userId = resolveUserId(appointment);
    if (!userId) {
      throw new AppError("This appointment has no linked customer (guest).", 400);
    }

    let updated;
    if (type === "debit") {
      // Same `users` collection + `wallet` as everywhere else: deduct only if balance >= amount
      updated = await User.findOneAndUpdate(
        { _id: userId, wallet: { $gte: amt } },
        { $inc: { wallet: -amt } },
        { new: true, runValidators: true }
      );
      if (!updated) {
        const u = await User.findById(userId);
        if (!u) throw new AppError("User not found", 404);
        throw new AppError(
          `Debit amount cannot exceed current wallet balance ($${toWallet(u.wallet).toFixed(2)}).`,
          400
        );
      }
    } else {
      updated = await User.findByIdAndUpdate(
        userId,
        { $inc: { wallet: amt } },
        { new: true, runValidators: true }
      );
      if (!updated) throw new AppError("User not found", 404);
    }

    const balanceAfter = toWallet(updated.wallet);
    const balanceBefore = type === "debit" ? balanceAfter + amt : balanceAfter - amt;

    try {
      const log = await WalletAdjustment.create({
        userId: updated._id,
        appointmentId: appointment._id,
        type,
        amount: amt,
        balanceBefore,
        balanceAfter,
        note: note != null && String(note).trim() ? String(note).trim() : null,
        adminId: req.adminId || null,
      });

      success(
        res,
        {
          user: {
            _id: updated._id,
            wallet: balanceAfter,
          },
          adjustment: {
            _id: log._id,
            type: log.type,
            amount: log.amount,
            balanceBefore: log.balanceBefore,
            balanceAfter: log.balanceAfter,
            note: log.note,
            createdAt: log.createdAt,
          },
        },
        "Wallet adjusted successfully",
        200
      );
    } catch (logErr) {
      if (type === "debit") {
        await User.findByIdAndUpdate(userId, { $inc: { wallet: amt } });
      } else {
        await User.findByIdAndUpdate(userId, { $inc: { wallet: -amt } });
      }
      next(logErr);
    }
  } catch (err) {
    next(err);
  }
}

module.exports = { getWalletByAppointmentId, adjustWalletByAppointmentId };
