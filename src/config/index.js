require("dotenv").config();

module.exports = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_SECRET || "blosm-dev-secret-change-in-prod",
  jwtExpiry: process.env.JWT_EXPIRY || "7d",
};
