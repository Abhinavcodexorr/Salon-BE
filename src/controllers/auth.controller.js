const authService = require("../services/auth.service");
const { AppError } = require("../middleware/errorHandler");
const { success } = require("../utils/response");

async function sendOtp(req, res, next) {
  try {
    const { mobile, countryCode } = req.body;
    if (!mobile || !countryCode) {
      throw new AppError("Mobile and country code required", 400);
    }
    await authService.sendOtp(mobile, countryCode);
    success(res, null, "OTP sent successfully");
  } catch (err) {
    next(err);
  }
}

async function verifyOtp(req, res, next) {
  try {
    const { mobile, countryCode, otp } = req.body;
    if (!mobile || !countryCode || !otp) {
      throw new AppError("Mobile, country code and OTP required", 400);
    }
    const result = await authService.verifyOtpAndLogin(mobile, countryCode, otp);
    success(res, result, "Login successful");
  } catch (err) {
    next(err);
  }
}

module.exports = { sendOtp, verifyOtp };
