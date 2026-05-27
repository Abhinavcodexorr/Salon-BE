const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");
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

function buildUniqueUsername(base) {
  const sanitized = String(base || "user")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 30) || "user";
  return `${sanitized}_${crypto.randomBytes(3).toString("hex")}`;
}

function parseContact({ email, mobile, countryCode }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedMobile = normalizeMobile(mobile);
  const normalizedCountryCode = normalizeCountryCode(countryCode);

  if (normalizedEmail) {
    return { type: "email", email: normalizedEmail };
  }

  if (normalizedMobile && normalizedCountryCode) {
    return {
      type: "mobile",
      mobile: normalizedMobile,
      countryCode: normalizedCountryCode,
    };
  }

  throw new AppError("Email or mobile with country code is required", 400);
}

async function findUserByContact(contact) {
  if (contact.type === "email") {
    return User.findOne({ email: contact.email }).select(
      "username email mobile countryCode name wallet isFirstLoginPending canRedeemInviteCode referredBy referredInviteCode referralRedeemedAt"
    );
  }

  return User.findOne({
    mobile: contact.mobile,
    countryCode: contact.countryCode,
  }).select(
    "username email mobile countryCode name wallet isFirstLoginPending canRedeemInviteCode referredBy referredInviteCode referralRedeemedAt"
  );
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

async function sendOtp({ email, mobile, countryCode, purpose = "login" }) {
  const contact = parseContact({ email, mobile, countryCode });
  const isLogin = purpose === "login";
  const user = await findUserByContact(contact);

  if (isLogin && !user) {
    throw new AppError("No account found", 404);
  }

  if (!isLogin && user) {
    throw new AppError("Account already exists", 409);
  }

  return {
    purpose: isLogin ? "login" : "signup",
    sentTo: contact.type === "email" ? contact.email : contact.mobile,
  };
}

async function verifyOtp({ email, mobile, countryCode, otp, purpose = "login" }) {
  const contact = parseContact({ email, mobile, countryCode });
  const code = String(otp || "").trim();
  const isLogin = purpose === "login";

  if (!code) throw new AppError("OTP is required", 400);
  if (code !== config.staticOtp) throw new AppError("Invalid OTP", 401);

  if (isLogin) {
    const user = await findUserByContact(contact);
    if (!user) throw new AppError("No account found", 404);

    const { isFirstLogin } = await applyPostAuthFlags(user);
    const token = generateToken(user._id.toString());
    return { token, user: toPublicUser(user), isFirstLogin };
  }

  const signupEmail = normalizeEmail(email);
  const signupMobile = normalizeMobile(mobile);
  const signupCountryCode = normalizeCountryCode(countryCode);

  if (!signupEmail || !signupMobile || !signupCountryCode) {
    throw new AppError("Email, mobile and country code are required for signup", 400);
  }

  const existing = await User.findOne({
    $or: [
      { email: signupEmail },
      { mobile: signupMobile, countryCode: signupCountryCode },
    ],
  }).select("_id email mobile countryCode");

  if (existing) {
    if (existing.email === signupEmail) {
      throw new AppError("Email is already registered", 409);
    }
    throw new AppError("Mobile number is already registered", 409);
  }

  const username = buildUniqueUsername(signupEmail.split("@")[0]);
  const hashedPassword = await bcrypt.hash(crypto.randomBytes(16).toString("hex"), BCRYPT_ROUNDS);

  const user = await User.create({
    username,
    email: signupEmail,
    password: hashedPassword,
    mobile: signupMobile,
    countryCode: signupCountryCode,
    name: username,
    wallet: SIGNUP_WALLET,
    isFirstLoginPending: true,
    canRedeemInviteCode: true,
  });

  const { isFirstLogin } = await applyPostAuthFlags(user);
  const token = generateToken(user._id.toString());

  return { token, user: toPublicUser(user), isFirstLogin };
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
