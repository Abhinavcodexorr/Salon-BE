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

function mapAdjustment(a) {
  return {
    _id: a._id,
    appointmentId: a.appointmentId,
    type: a.type,
    amount: a.amount,
    balanceBefore: a.balanceBefore,
    balanceAfter: a.balanceAfter,
    note: a.note,
    createdAt: a.createdAt,
    adminEmail: a.adminId && typeof a.adminId === "object" ? a.adminId.email : null,
  };
}

/**
 * GET — wallet popup data for an appointment: user info, current wallet balance,
 * and ONLY the latest single adjustment made on this appointment (as a 1-item
 * array so existing frontend shape stays the same).
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

    const latest = await WalletAdjustment.findOne({
      userId: user._id,
      appointmentId: appointment._id,
    })
      .sort({ createdAt: -1 })
      .populate("adminId", "email")
      .lean();

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
          wallet: toWallet(user.wallet),
        },
        adjustments: latest ? [mapAdjustment(latest)] : [],
      },
      "Wallet context loaded successfully"
    );
  } catch (err) {
    next(err);
  }
}

/**
 * GET — full wallet adjustment history scoped to a SINGLE appointment.
 * Returns every credit/debit ever made against this specific appointment,
 * sorted newest first.
 */
async function getAppointmentWalletHistory(req, res, next) {
  try {
    const { appointmentId } = req.params;
    const appointment = await Appointment.findById(appointmentId).lean();
    if (!appointment) throw new AppError("Appointment not found", 404);
    if (!appointment.userId) {
      throw new AppError("This appointment has no linked customer (guest). Wallet is only for logged-in users.", 400);
    }

    const user = await User.findById(appointment.userId).lean();
    if (!user) throw new AppError("User not found", 404);

    const adjustments = await WalletAdjustment.find({
      userId: user._id,
      appointmentId: appointment._id,
    })
      .sort({ createdAt: -1 })
      .populate("adminId", "email")
      .lean();

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
          wallet: toWallet(user.wallet),
        },
        adjustments: adjustments.map(mapAdjustment),
      },
      "Wallet history loaded successfully"
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

      // Return SAME shape as GET /wallet so frontend can just replace state.
      success(
        res,
        {
          appointment: {
            _id: appointment._id,
            date: appointment.date,
            service: appointment.service,
          },
          user: {
            _id: updated._id,
            name: updated.name,
            email: updated.email,
            mobile: updated.mobile,
            countryCode: updated.countryCode,
            wallet: balanceAfter,
          },
          adjustments: [
            mapAdjustment({
              _id: log._id,
              appointmentId: log.appointmentId,
              type: log.type,
              amount: log.amount,
              balanceBefore: log.balanceBefore,
              balanceAfter: log.balanceAfter,
              note: log.note,
              createdAt: log.createdAt,
              adminId: null,
            }),
          ],
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

module.exports = {
  getWalletByAppointmentId,
  getAppointmentWalletHistory,
  adjustWalletByAppointmentId,
};
