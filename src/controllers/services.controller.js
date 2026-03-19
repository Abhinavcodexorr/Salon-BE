const Service = require("../models/Service");
const { success } = require("../utils/response");

/**
 * Website listing - ONLY active services, not deleted.
 * Used for public/customer-facing service list.
 */
async function getServices(req, res, next) {
  try {
    const services = await Service.find({ isActive: true }).sort({ createdAt: 1 }).lean();
    success(res, services, "Services retrieved successfully");
  } catch (err) {
    next(err);
  }
}

module.exports = { getServices };
