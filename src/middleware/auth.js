const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const config = require("../config");

function unauthorizedPayload(message, detail) {
  return {
    success: false,
    statusCode: 401,
    message,
    error: {
      code: "ERR_UNAUTHORIZED",
      message: detail || message,
    },
  };
}

const auth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized - No token" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const raw = decoded.userId;
    if (raw == null || raw === "") {
      return res.status(401).json(
        unauthorizedPayload(
          "Customer login token required",
          "This token is not a customer session (e.g. admin login uses a different token). Use OTP login for customer APIs."
        )
      );
    }
    const uid = String(raw).trim();
    if (!mongoose.Types.ObjectId.isValid(uid)) {
      return res.status(401).json(
        unauthorizedPayload("Invalid session", "Invalid user id in token")
      );
    }
    req.userId = uid;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.userId = decoded.userId;
  } catch (err) {
    // Ignore invalid token - request continues without user
  }
  next();
};

const adminAuth = (req, res, next) => {
  return auth(req, res, next);
};

/** Verifies JWT has role 'superadmin' - use for admin panel protected routes */
const superadminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Unauthorized - No token" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (decoded.role !== "superadmin") {
      return res.status(403).json({ success: false, error: "Forbidden - Admin access required" });
    }
    req.adminId = decoded.adminId;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: "Invalid or expired token" });
  }
};

module.exports = { auth, optionalAuth, adminAuth, superadminAuth };
