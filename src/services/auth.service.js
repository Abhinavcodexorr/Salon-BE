const User = require("../models/User");
const jwt = require("jsonwebtoken");
const config = require("../config");
const otpService = require("./otp.service");
const { toPublicUser } = require("../utils/userResponse");

async function findOrCreateUser(mobile, countryCode) {
  const normalizedMobile = mobile.replace(/\D/g, "");
  let user = await User.findOne({
    mobile: normalizedMobile,
    countryCode,
  });

  if (!user) {
    user = await User.create({
      mobile: normalizedMobile,
      countryCode,
      wallet: 100,
      isFirstLoginPending: true,
      canRedeemInviteCode: true,
    });
  }

  return user;
}

function generateToken(userId) {
  return jwt.sign({ userId }, config.jwtSecret, { expiresIn: config.jwtExpiry });
}

async function sendOtp(mobile, countryCode) {
  const normalizedMobile = mobile.replace(/\D/g, "");
  if (normalizedMobile.length < 9) {
    throw new Error("Invalid mobile number");
  }
  await otpService.createOtp(mobile, countryCode);
  return { success: true, message: "OTP sent" };
}

async function verifyOtpAndLogin(mobile, countryCode, otp) {
  const isValid = await otpService.verifyOtp(mobile, countryCode, otp);
  if (!isValid) {
    throw new Error("Invalid or expired OTP");
  }
  const user = await findOrCreateUser(mobile, countryCode);
  const isFirstLogin = Boolean(user.isFirstLoginPending);

  if (isFirstLogin) {
    await User.updateOne(
      { _id: user._id, isFirstLoginPending: true },
      { $set: { isFirstLoginPending: false } }
    );
  } else if (user.canRedeemInviteCode) {
    await User.updateOne(
      { _id: user._id, canRedeemInviteCode: true },
      { $set: { canRedeemInviteCode: false } }
    );
  }

  const token = generateToken(user._id.toString());
  return { token, user: toPublicUser(user), isFirstLogin };
}

module.exports = { sendOtp, verifyOtpAndLogin, findOrCreateUser };
