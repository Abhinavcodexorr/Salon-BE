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
  const token = generateToken(user._id.toString());
  return { token, user: toPublicUser(user) };
}

module.exports = { sendOtp, verifyOtpAndLogin, findOrCreateUser };
