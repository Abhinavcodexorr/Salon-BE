const User = require("../models/User");
const WalletAdjustment = require("../models/WalletAdjustment");
const { AppError } = require("../middleware/errorHandler");
const { success } = require("../utils/response");
const { toPublicUser } = require("../utils/userResponse");

async function getMe(req, res, next) {
  try {
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.walletHistoryLimit, 10) || 50)
    );

    const [user, adjustments] = await Promise.all([
      User.findById(req.userId).select("-__v").lean(),
      WalletAdjustment.find({ userId: req.userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select("type amount balanceBefore balanceAfter note appointmentId createdAt")
        .lean(),
    ]);

    if (!user) throw new AppError("User not found", 404);

    const walletHistory = adjustments.map((a) => ({
      _id: a._id,
      type: a.type,
      amount: a.amount,
      balanceBefore: a.balanceBefore,
      balanceAfter: a.balanceAfter,
      note: a.note,
      appointmentId: a.appointmentId,
      createdAt: a.createdAt,
    }));

    success(
      res,
      { ...toPublicUser(user), walletHistory },
      "User profile retrieved successfully"
    );
  } catch (err) {
    next(err);
  }
}

module.exports = { getMe };
