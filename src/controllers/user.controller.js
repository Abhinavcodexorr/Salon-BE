const User = require("../models/User");
const WalletAdjustment = require("../models/WalletAdjustment");
const { AppError } = require("../middleware/errorHandler");
const { success } = require("../utils/response");
const { toPublicUser } = require("../utils/userResponse");
const {
  SIGNUP_BONUS,
  REFERRAL_BONUS,
  REFERRAL_BONUS_NOTE_PREFIX,
} = require("../services/referral.service");

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeMobile(mobile) {
  return String(mobile || "").replace(/\D/g, "");
}

function normalizeCountryCode(countryCode) {
  const code = String(countryCode || "").trim();
  if (!code) return "";
  return code.startsWith("+") ? code : `+${code.replace(/\D/g, "")}`;
}

/** Case-insensitive prefix match, escapes regex specials in the prefix. */
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getMe(req, res, next) {
  try {
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.walletHistoryLimit, 10) || 50)
    );

    const referralNoteRegex = new RegExp(
      `^${escapeRegex(REFERRAL_BONUS_NOTE_PREFIX)}`,
      "i"
    );

    const [user, adjustments, referralEntries] = await Promise.all([
      User.findById(req.userId).select("-__v").lean(),
      WalletAdjustment.find({ userId: req.userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select("type amount balanceBefore balanceAfter note appointmentId createdAt")
        .populate("appointmentId", "service date time")
        .lean(),
      WalletAdjustment.find({
        userId: req.userId,
        type: "credit",
        note: referralNoteRegex,
      })
        .sort({ createdAt: 1 })
        .select("amount note createdAt")
        .lean(),
    ]);

    if (!user) throw new AppError("User not found", 404);

    const walletHistory = adjustments.map((a) => {
      const apt = a.appointmentId;
      const hasApt = apt && typeof apt === "object";
      return {
        _id: a._id,
        type: a.type,
        amount: a.amount,
        balanceBefore: a.balanceBefore,
        balanceAfter: a.balanceAfter,
        note: a.note,
        appointmentId: hasApt ? apt._id : a.appointmentId,
        appointmentName: hasApt ? apt.service : null,
        appointmentDate: hasApt ? apt.date : null,
        appointmentTime: hasApt ? apt.time : null,
        createdAt: a.createdAt,
      };
    });

    const referralEarned = referralEntries.reduce(
      (sum, e) => sum + Number(e.amount || 0),
      0
    );
    const referralCount = referralEntries.length;
    const lastReferralAt =
      referralCount > 0
        ? referralEntries[referralEntries.length - 1].createdAt
        : null;
    const referred = Boolean(user.referredBy);

    const bonuses = {
      signupBonus: SIGNUP_BONUS,
      referralBonusPerInvite: REFERRAL_BONUS,
      referralBonus: referralEarned,
      referralCount,
      hasReferralBonus: referralEarned > 0,
      lastReferralAt,
      referred,
      referredInviteCode: user.referredInviteCode || null,
      referralRedeemedAt: user.referralRedeemedAt || null,
    };

    success(
      res,
      { ...toPublicUser(user), bonuses, walletHistory },
      "User profile retrieved successfully"
    );
  } catch (err) {
    next(err);
  }
}

async function updateMe(req, res, next) {
  try {
    const { name, email, mobile, countryCode } = req.body || {};
    const updates = {};

    if (name !== undefined) {
      const trimmedName = String(name).trim();
      if (!trimmedName) throw new AppError("Name cannot be empty", 400);
      updates.name = trimmedName;
    }

    if (email !== undefined) {
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) throw new AppError("Valid email is required", 400);

      const emailTaken = await User.findOne({
        _id: { $ne: req.userId },
        email: normalizedEmail,
      }).select("_id");

      if (emailTaken) throw new AppError("Email is already registered", 409);
      updates.email = normalizedEmail;
    }

    if (mobile !== undefined || countryCode !== undefined) {
      const normalizedMobile = normalizeMobile(mobile);
      const normalizedCountryCode = normalizeCountryCode(countryCode);

      if (!normalizedMobile || normalizedMobile.length < 9) {
        throw new AppError("Valid mobile number is required", 400);
      }
      if (!normalizedCountryCode) {
        throw new AppError("Country code is required with mobile", 400);
      }

      const mobileTaken = await User.findOne({
        _id: { $ne: req.userId },
        mobile: normalizedMobile,
        countryCode: normalizedCountryCode,
      }).select("_id");

      if (mobileTaken) throw new AppError("Mobile number is already registered", 409);

      updates.mobile = normalizedMobile;
      updates.countryCode = normalizedCountryCode;
    }

    if (!Object.keys(updates).length) {
      throw new AppError("At least one field is required: name, email, mobile, countryCode", 400);
    }

    const user = await User.findByIdAndUpdate(req.userId, { $set: updates }, { new: true })
      .select("-__v -password")
      .lean();

    if (!user) throw new AppError("User not found", 404);

    success(res, toPublicUser(user), "Profile updated successfully");
  } catch (err) {
    next(err);
  }
}

module.exports = { getMe, updateMe };
