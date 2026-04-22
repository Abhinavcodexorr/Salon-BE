const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const User = require("../models/User");
const WalletAdjustment = require("../models/WalletAdjustment");
const { AppError } = require("../middleware/errorHandler");
const { success } = require("../utils/response");

function toWallet(n) {
  if (n == null || n === "") return 0;
  return Number(n);
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
 * POST — credit or debit. Debit amount must be less than or equal to current wallet.
 * Body: { "type": "credit" | "debit", "amount": number, "note": optional string }
 */
async function adjustWalletByAppointmentId(req, res, next) {
  const session = await mongoose.startSession();
  session.startTransaction();
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

    const appointment = await Appointment.findById(appointmentId).session(session);
    if (!appointment) throw new AppError("Appointment not found", 404);
    if (!appointment.userId) {
      throw new AppError("This appointment has no linked customer (guest).", 400);
    }

    const user = await User.findById(appointment.userId).session(session);
    if (!user) throw new AppError("User not found", 404);

    const balanceBefore = toWallet(user.wallet);

    if (type === "debit" && amt > balanceBefore) {
      throw new AppError(
        `Debit amount cannot exceed current wallet balance ($${balanceBefore.toFixed(2)}).`,
        400
      );
    }

    const balanceAfter =
      type === "credit" ? balanceBefore + amt : balanceBefore - amt;

    user.wallet = balanceAfter;
    await user.save({ session });

    const [log] = await WalletAdjustment.create(
      [
        {
          userId: user._id,
          appointmentId: appointment._id,
          type,
          amount: amt,
          balanceBefore,
          balanceAfter,
          note: note != null && String(note).trim() ? String(note).trim() : null,
          adminId: req.adminId || null,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    success(
      res,
      {
        user: {
          _id: user._id,
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
  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
}

module.exports = { getWalletByAppointmentId, adjustWalletByAppointmentId };
