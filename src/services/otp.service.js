const Otp = require("../models/Otp");

const OTP_EXPIRY_MINUTES = 10;
const STATIC_OTP = "123456";

function useStaticOtp() {
  return process.env.USE_STATIC_OTP === "true" || process.env.NODE_ENV === "development";
}

async function createOtp(mobile, countryCode) {
  if (useStaticOtp()) {
    console.log(`[OTP] Static mode - use ${STATIC_OTP} for ${countryCode}${mobile}`);
    return STATIC_OTP;
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await Otp.create({
    mobile: mobile.replace(/\D/g, ""),
    countryCode,
    otp,
    expiresAt,
  });

  console.log(`[OTP] ${countryCode}${mobile}: ${otp}`);
  return otp;
}

async function verifyOtp(mobile, countryCode, otp) {
  if (useStaticOtp() && otp === STATIC_OTP) {
    return true;
  }

  const normalizedMobile = mobile.replace(/\D/g, "");
  const record = await Otp.findOne({
    mobile: normalizedMobile,
    countryCode,
    otp,
  }).sort({ createdAt: -1 });

  if (!record) return false;
  if (new Date() > record.expiresAt) return false;

  await Otp.deleteMany({
    mobile: normalizedMobile,
    countryCode,
  });

  return true;
}

module.exports = { createOtp, verifyOtp };
