const { AppError } = require("../middleware/errorHandler");
const { success } = require("../utils/response");
const referralService = require("../services/referral.service");

async function redeemInviteCode(req, res, next) {
  try {
    const inviteCode = req.body?.inviteCode;
    if (!inviteCode) {
      throw new AppError("inviteCode is required", 400);
    }

    const result = await referralService.redeemInviteCode({
      userId: req.userId,
      inviteCode,
    });

    success(res, result, "Invite code redeemed successfully", 200);
  } catch (err) {
    next(err);
  }
}

module.exports = { redeemInviteCode };
