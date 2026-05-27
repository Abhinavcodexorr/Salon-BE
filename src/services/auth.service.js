const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");
const Otp = require("../models/Otp");
const jwt = require("jsonwebtoken");
const config = require("../config");
const { AppError } = require("../middleware/errorHandler");
const { toPublicUser } = require("../utils/userResponse");

const BCRYPT_ROUNDS = 10;
const SIGNUP_WALLET = 100;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeUsername(username) {
  return String(username || "").trim();
}

function normalizeMobile(mobile) {
  return String(mobile || "").replace(/\D/g, "");
}

function normalizeCountryCode(countryCode) {
  const code = String(countryCode || "").trim();
  if (!code) return "";
  return code.startsWith("+") ? code : `+${code.replace(/\D/g, "")}`;
}

function generateToken(userId) {
  return jwt.sign({ userId }, config.jwtSecret, { expiresIn: config.jwtExpiry });
}

function generateOtpCode() {
  if (config.useStaticOtp) return config.staticOtp;
  return String(Math.floor(100000 + Math.random() * 900000));
}

function buildUniqueUsername(base) {
  const sanitized = String(base || "user")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 30) || "user";
  return `${sanitized}_${crypto.randomBytes(3).toString("hex")}`;
}

async function sendOtp({ mobile, countryCode, email, purpose = "signup" }) {
  const normalizedMobile = normalizeMobile(mobile);
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  const normalizedEmail = normalizeEmail(email);
  const normalizedPurpose = purpose === "login" ? "login" : "signup";

  if (!normalizedMobile || normalizedMobile.length < 9) {
    throw new AppError("Valid mobile number is required", 400);
  }
  if (!normalizedCountryCode) throw new AppError("Country code is required", 400);

  if (normalizedPurpose === "signup") {
    if (!normalizedEmail) throw new AppError("Email is required", 400);

    const existing = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { mobile: normalizedMobile, countryCode: normalizedCountryCode },
      ],
    }).select("_id email mobile countryCode");

    if (existing) {
      if (existing.email === normalizedEmail) {
        throw new AppError("Email is already registered", 409);
      }
      throw new AppError("Mobile number is already registered", 409);
    }
  } else {
    const existingUser = await User.findOne({
      mobile: normalizedMobile,
      countryCode: normalizedCountryCode,
    }).select("_id");

    if (!existingUser) {
      throw new AppError("No account found with this mobile number", 404);
    }
  }

  const otp = generateOtpCode();
  const expiresAt = new Date(Date.now() + config.otpExpiryMinutes * 60 * 1000);

  await Otp.deleteMany({
    mobile: normalizedMobile,
    countryCode: normalizedCountryCode,
    purpose: normalizedPurpose,
  });

  await Otp.create({
    mobile: normalizedMobile,
    countryCode: normalizedCountryCode,
    email: normalizedPurpose === "signup" ? normalizedEmail : null,
    otp,
    purpose: normalizedPurpose,
    expiresAt,
  });

  if (config.nodeEnv === "development" && config.useStaticOtp) {
    console.log(`[OTP] ${normalizedPurpose} for ${normalizedCountryCode} ${normalizedMobile}: ${otp}`);
  }

  return {
    mobile: normalizedMobile,
    countryCode: normalizedCountryCode,
    purpose: normalizedPurpose,
    expiresInMinutes: config.otpExpiryMinutes,
  };
}

async function verifyOtp({ mobile, countryCode, email, otp, purpose = "signup" }) {
  const normalizedMobile = normalizeMobile(mobile);
  const normalizedCountryCode = normalizeCountryCode(countryCode);
  const normalizedEmail = normalizeEmail(email);
  const normalizedOtp = String(otp || "").trim();
  const normalizedPurpose = purpose === "login" ? "login" : "signup";

  if (!normalizedMobile || !normalizedCountryCode || !normalizedOtp) {
    throw new AppError("Mobile, country code and OTP are required", 400);
  }
  if (normalizedPurpose === "signup" && !normalizedEmail) {
    throw new AppError("Email is required", 400);
  }

  const record = await Otp.findOne({
    mobile: normalizedMobile,
    countryCode: normalizedCountryCode,
    purpose: normalizedPurpose,
  }).select("+otp email expiresAt");

  if (!record) {
    throw new AppError("OTP expired or not found. Please request a new one", 400);
  }
  if (record.expiresAt <= new Date()) {
    await Otp.deleteOne({ _id: record._id });
    throw new AppError("OTP expired. Please request a new one", 400);
  }
  if (record.otp !== normalizedOtp) {
    throw new AppError("Invalid OTP", 401);
  }
  if (normalizedPurpose === "signup" && record.email !== normalizedEmail) {
    throw new AppError("Email does not match the OTP request", 400);
  }

  await Otp.deleteOne({ _id: record._id });

  if (normalizedPurpose === "login") {
    const user = await User.findOne({
      mobile: normalizedMobile,
      countryCode: normalizedCountryCode,
    }).select(
      "username email mobile countryCode name wallet isFirstLoginPending canRedeemInviteCode referredBy referredInviteCode referralRedeemedAt"
    );

    if (!user) {
      throw new AppError("No account found with this mobile number", 404);
    }

    const { isFirstLogin } = await applyPostAuthFlags(user);
    const token = generateToken(user._id.toString());
    return { token, user: toPublicUser(user), isFirstLogin };
  }

  const existing = await User.findOne({
    $or: [
      { email: normalizedEmail },
      { mobile: normalizedMobile, countryCode: normalizedCountryCode },
    ],
  }).select("_id email mobile countryCode");

  if (existing) {
    if (existing.email === normalizedEmail) {
      throw new AppError("Email is already registered", 409);
    }
    throw new AppError("Mobile number is already registered", 409);
  }

  const username = buildUniqueUsername(normalizedEmail.split("@")[0]);
  const randomPassword = crypto.randomBytes(16).toString("hex");
  const hashedPassword = await bcrypt.hash(randomPassword, BCRYPT_ROUNDS);

  const user = await User.create({
    username,
    email: normalizedEmail,
    password: hashedPassword,
    mobile: normalizedMobile,
    countryCode: normalizedCountryCode,
    name: username,
    wallet: SIGNUP_WALLET,
    isFirstLoginPending: true,
    canRedeemInviteCode: true,
  });

  const { isFirstLogin } = await applyPostAuthFlags(user);
  const token = generateToken(user._id.toString());

  return { token, user: toPublicUser(user), isFirstLogin };
}

async function applyPostAuthFlags(user) {
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

  return { isFirstLogin };
}

async function signup({ username, email, mobile, countryCode, password }) {
  const normalizedUsername = normalizeUsername(username);
  const normalizedEmail = normalizeEmail(email);
  const normalizedMobile = normalizeMobile(mobile);
  const normalizedCountryCode = normalizeCountryCode(countryCode);

  if (!normalizedUsername) throw new AppError("Username is required", 400);
  if (!normalizedEmail) throw new AppError("Email is required", 400);
  if (!normalizedMobile || normalizedMobile.length < 9) {
    throw new AppError("Valid mobile number is required", 400);
  }
  if (!normalizedCountryCode) throw new AppError("Country code is required", 400);
  if (!password || String(password).length < 6) {
    throw new AppError("Password must be at least 6 characters", 400);
  }

  const existing = await User.findOne({
    $or: [
      { email: normalizedEmail },
      { username: normalizedUsername },
      { mobile: normalizedMobile, countryCode: normalizedCountryCode },
    ],
  }).select("_id email username mobile countryCode");

  if (existing) {
    if (existing.email === normalizedEmail) {
      throw new AppError("Email is already registered", 409);
    }
    if (existing.username === normalizedUsername) {
      throw new AppError("Username is already taken", 409);
    }
    throw new AppError("Mobile number is already registered", 409);
  }

  const hashedPassword = await bcrypt.hash(String(password), BCRYPT_ROUNDS);

  const user = await User.create({
    username: normalizedUsername,
    email: normalizedEmail,
    password: hashedPassword,
    mobile: normalizedMobile,
    countryCode: normalizedCountryCode,
    name: normalizedUsername,
    wallet: SIGNUP_WALLET,
    isFirstLoginPending: true,
    canRedeemInviteCode: true,
  });

  const { isFirstLogin } = await applyPostAuthFlags(user);
  const token = generateToken(user._id.toString());

  return { token, user: toPublicUser(user), isFirstLogin };
}

async function login({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !password) {
    throw new AppError("Email and password are required", 400);
  }

  const user = await User.findOne({ email: normalizedEmail }).select(
    "+password username email mobile countryCode name wallet isFirstLoginPending canRedeemInviteCode referredBy referredInviteCode referralRedeemedAt"
  );

  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  const isMatch = await bcrypt.compare(String(password), user.password);
  if (!isMatch) {
    throw new AppError("Invalid email or password", 401);
  }

  const { isFirstLogin } = await applyPostAuthFlags(user);
  const token = generateToken(user._id.toString());

  return { token, user: toPublicUser(user), isFirstLogin };
}

module.exports = { signup, login, sendOtp, verifyOtp };
