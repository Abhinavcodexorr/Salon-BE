const User = require("../models/User");
const { AppError } = require("../middleware/errorHandler");
const { success } = require("../utils/response");
const { toPublicUser } = require("../utils/userResponse");

async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.userId).select("-__v").lean();
    if (!user) throw new AppError("User not found", 404);
    success(res, toPublicUser(user), "User profile retrieved successfully");
  } catch (err) {
    next(err);
  }
}

module.exports = { getMe };
