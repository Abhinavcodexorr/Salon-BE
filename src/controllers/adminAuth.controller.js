const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const { AppError } = require("../middleware/errorHandler");
const { success } = require("../utils/response");
const config = require("../config");

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new AppError("Email and password are required", 400);
    }

    const admin = await Admin.findOne({ email: email.trim().toLowerCase() });
    if (!admin) {
      throw new AppError("Invalid email or password", 401);
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      throw new AppError("Invalid email or password", 401);
    }

    const token = jwt.sign(
      { adminId: admin._id.toString(), role: "superadmin" },
      config.jwtSecret,
      { expiresIn: config.jwtExpiry }
    );

    success(res, {
      token,
      admin: {
        id: admin._id,
        email: admin.email,
      },
    }, "Login successful");
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    success(res, null, "Logged out successfully");
  } catch (err) {
    next(err);
  }
}

module.exports = { login, logout };
