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

function generateInternalUsername() {
  return `u_${crypto.randomBytes(12).toString("hex")}`;
}

async function findUserByContact(contact) {
  if (contact.type === "email") {
    return User.findOne({ email: contact.email }).select(
      "username email mobile countryCode name wallet isFirstLoginPending canRedeemInviteCode referredBy referredInviteCode referralRedeemedAt"
    );
  }

  const byMobileAndCode = await User.findOne({
    mobile: contact.mobile,
    countryCode: contact.countryCode,
  }).select(
    "username email mobile countryCode name wallet isFirstLoginPending canRedeemInviteCode referredBy referredInviteCode referralRedeemedAt"
  );

  if (byMobileAndCode) return byMobileAndCode;

  return User.findOne({ mobile: contact.mobile }).select(
    "username email mobile countryCode name wallet isFirstLoginPending canRedeemInviteCode referredBy referredInviteCode referralRedeemedAt"
  );
}

async function createUserFromContact(contact) {
  const hashedPassword = await bcrypt.hash(crypto.randomBytes(16).toString("hex"), BCRYPT_ROUNDS);
  const username = generateInternalUsername();

  if (contact.type === "email") {
    return User.create({
      username,
      email: contact.email,
      password: hashedPassword,
      name: null,
      wallet: SIGNUP_WALLET,
      isFirstLoginPending: true,
      canRedeemInviteCode: true,
    });
  }

  return User.create({
    username,
    mobile: contact.mobile,
    countryCode: contact.countryCode,
    password: hashedPassword,
    name: null,
    wallet: SIGNUP_WALLET,
    isFirstLoginPending: true,
    canRedeemInviteCode: true,
  });
}

async function sendOtp({ email, mobile, countryCode }) {
  const contact = parseContact({ email, mobile, countryCode });

  return {
    sentTo: contact.type === "email" ? contact.email : contact.mobile,
  };
}

async function verifyOtp({ email, mobile, countryCode, otp }) {
  const contact = parseContact({ email, mobile, countryCode });
  const code = String(otp || "").trim();

  if (!code) throw new AppError("OTP is required", 400);
  if (code !== config.staticOtp) throw new AppError("Invalid OTP", 401);

  let user = await findUserByContact(contact);
  let isNewUser = false;

  if (!user) {
    user = await createUserFromContact(contact);
    isNewUser = true;
  }

  const { isFirstLogin } = await applyPostAuthFlags(user);
  const token = generateToken(user._id.toString());

  return {
    token,
    user: toPublicUser(user),
    isFirstLogin,
    isNewUser,
  };
}

async function applyPostAuthFlags(user) {
  const needsName = !user.name || !String(user.name).trim();
  const isFirstLogin = needsName || Boolean(user.isFirstLoginPending);

  if (!needsName && user.isFirstLoginPending) {
    await User.updateOne({ _id: user._id }, { $set: { isFirstLoginPending: false } });
  } else if (!needsName && user.canRedeemInviteCode) {
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
