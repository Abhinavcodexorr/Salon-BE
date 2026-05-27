const authService = require("../services/auth.service");
const { AppError } = require("../middleware/errorHandler");
const { success } = require("../utils/response");

async function signup(req, res, next) {
  try {
    const { username, email, mobile, countryCode, password } = req.body;
    if (!username || !email || !mobile || !countryCode || !password) {
      throw new AppError(
        "Username, email, mobile, country code and password are required",
        400
      );
    }
    const result = await authService.signup({
      username,
      email,
      mobile,
      countryCode,
      password,
    });
    success(res, result, "Signup successful", 201);
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new AppError("Email and password are required", 400);
    }
    const result = await authService.login({ email, password });
    success(res, result, "Login successful");
  } catch (err) {
    next(err);
  }
}

async function sendOtp(req, res, next) {
  try {
    const { mobile, countryCode, email, purpose } = req.body;
    if (!mobile || !countryCode) {
      throw new AppError("Mobile and country code are required", 400);
    }
    const result = await authService.sendOtp({ mobile, countryCode, email, purpose });
    success(res, result, "OTP sent successfully");
  } catch (err) {
    next(err);
  }
}

async function verifyOtp(req, res, next) {
  try {
    const { mobile, countryCode, email, otp, purpose } = req.body;
    if (!mobile || !countryCode || !otp) {
      throw new AppError("Mobile, country code and OTP are required", 400);
    }
    const result = await authService.verifyOtp({ mobile, countryCode, email, otp, purpose });
    const message = purpose === "login" ? "Login successful" : "Signup successful";
    success(res, result, message, purpose === "login" ? 200 : 201);
  } catch (err) {
    next(err);
  }
}

module.exports = { signup, login, sendOtp, verifyOtp };
