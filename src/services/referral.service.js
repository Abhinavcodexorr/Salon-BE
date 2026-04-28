const User = require("../models/User");
const WalletAdjustment = require("../models/WalletAdjustment");
const { AppError } = require("../middleware/errorHandler");

const REFERRAL_BONUS = 100;

function normalizeInviteCode(inviteCode) {
  const normalized = String(inviteCode || "").replace(/\D/g, "");
  if (!normalized) {
    throw new AppError("inviteCode is required", 400);
  }
  return normalized;
}

async function redeemInviteCode({ userId, inviteCode }) {
  const normalizedInviteCode = normalizeInviteCode(inviteCode);

  const invitee = await User.findById(userId).select("_id mobile canRedeemInviteCode referredBy");
  if (!invitee) throw new AppError("User not found", 404);
  if (!invitee.canRedeemInviteCode) {
    throw new AppError("Invite code can only be redeemed on first login", 400);
  }
  if (invitee.referredBy) {
    throw new AppError("Invite code already redeemed", 409);
  }

  const referrerCandidates = await User.find({
    mobile: normalizedInviteCode,
    _id: { $ne: invitee._id },
  })
    .sort({ createdAt: 1 })
    .limit(2)
    .select("_id mobile wallet");

  if (!referrerCandidates.length) {
    throw new AppError("Invalid invite code", 404);
  }
  if (referrerCandidates.length > 1) {
    throw new AppError("Invite code matches multiple users. Contact support.", 409);
  }

  const referrer = referrerCandidates[0];
  const updatedInvitee = await User.findOneAndUpdate(
    { _id: invitee._id, canRedeemInviteCode: true, referredBy: null },
    {
      $set: {
        referredBy: referrer._id,
        referredInviteCode: normalizedInviteCode,
        referralRedeemedAt: new Date(),
        canRedeemInviteCode: false,
      },
    },
    { new: true }
  );

  if (!updatedInvitee) {
    throw new AppError("Invite code already redeemed or no longer eligible", 409);
  }

  const updatedReferrer = await User.findByIdAndUpdate(
    referrer._id,
    { $inc: { wallet: REFERRAL_BONUS } },
    { new: true, runValidators: true }
  ).select("_id mobile wallet");

  if (!updatedReferrer) {
    await User.updateOne(
      { _id: invitee._id },
      {
        $set: {
          referredBy: null,
          referredInviteCode: null,
          referralRedeemedAt: null,
          canRedeemInviteCode: true,
        },
      }
    );
    throw new AppError("Referrer not found", 404);
  }

  const balanceAfter = Number(updatedReferrer.wallet || 0);
  const balanceBefore = balanceAfter - REFERRAL_BONUS;

  try {
    await WalletAdjustment.create({
      userId: updatedReferrer._id,
      appointmentId: null,
      type: "credit",
      amount: REFERRAL_BONUS,
      balanceBefore,
      balanceAfter,
      note: `Referral bonus for invite code used by ${updatedInvitee.mobile}`,
      adminId: null,
    });
  } catch (logErr) {
    await User.findByIdAndUpdate(updatedReferrer._id, { $inc: { wallet: -REFERRAL_BONUS } });
    await User.updateOne(
      { _id: updatedInvitee._id },
      {
        $set: {
          referredBy: null,
          referredInviteCode: null,
          referralRedeemedAt: null,
          canRedeemInviteCode: true,
        },
      }
    );
    throw logErr;
  }

  return {
    inviteCode: normalizedInviteCode,
    rewardAmount: REFERRAL_BONUS,
    referrer: {
      _id: updatedReferrer._id,
      mobile: updatedReferrer.mobile,
      wallet: Number(updatedReferrer.wallet || 0),
    },
    invitee: {
      _id: updatedInvitee._id,
      mobile: updatedInvitee.mobile,
    },
  };
}

module.exports = { redeemInviteCode };
