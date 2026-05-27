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
    const { email, mobile, countryCode, purpose } = req.body;
    const hasEmail = Boolean(String(email || "").trim());
    const hasMobile = Boolean(String(mobile || "").trim());

    if (!hasEmail && !hasMobile) {
      throw new AppError("Email or mobile is required", 400);
    }
    if (hasMobile && !countryCode) {
      throw new AppError("Country code is required with mobile", 400);
    }

    const result = await authService.sendOtp({ email, mobile, countryCode, purpose });
    success(res, result, "OTP sent successfully");
  } catch (err) {
    next(err);
  }
}

async function verifyOtp(req, res, next) {
  try {
    const { email, mobile, countryCode, otp, purpose } = req.body;
    const hasEmail = Boolean(String(email || "").trim());
    const hasMobile = Boolean(String(mobile || "").trim());
    const isSignup = purpose === "signup";

    if (!otp) throw new AppError("OTP is required", 400);

    if (isSignup) {
      if (!email || !mobile || !countryCode) {
        throw new AppError("Email, mobile and country code are required for signup", 400);
      }
    } else if (!hasEmail && !hasMobile) {
      throw new AppError("Email or mobile is required", 400);
    } else if (hasMobile && !countryCode) {
      throw new AppError("Country code is required with mobile", 400);
    }

    const result = await authService.verifyOtp({ email, mobile, countryCode, otp, purpose });
    const message = isSignup ? "Signup successful" : "Login successful";
    success(res, result, message, isSignup ? 201 : 200);
  } catch (err) {
    next(err);
  }
}

module.exports = { signup, login, sendOtp, verifyOtp };
