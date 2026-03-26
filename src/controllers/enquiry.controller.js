const Enquiry = require("../models/Enquiry");
const { AppError } = require("../middleware/errorHandler");
const { success } = require("../utils/response");

/** Public — contact form submission */
async function createEnquiry(req, res, next) {
  try {
    const { name, email, mobile, countryCode, message } = req.body || {};
    if (!name || !email || !mobile || !countryCode || !message) {
      throw new AppError("name, email, mobile, countryCode and message are required", 400);
    }

    const enquiry = await Enquiry.create({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      mobile: String(mobile).replace(/\D/g, ""),
      countryCode: String(countryCode).trim(),
      message: String(message).trim(),
    });

    success(res, { id: enquiry._id }, "Enquiry submitted successfully", 201);
  } catch (err) {
    next(err);
  }
}

/** Admin — list enquiries (newest first), optional pagination */
async function listEnquiries(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const search = req.query.search;
    const filter = {};
    if (search) {
      const q = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: q }, { email: q }, { mobile: q }, { message: q }];
    }

    const [enquiries, total] = await Promise.all([
      Enquiry.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Enquiry.countDocuments(filter),
    ]);

    success(res, {
      enquiries,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 0,
      },
    }, "Enquiries retrieved successfully");
  } catch (err) {
    next(err);
  }
}

module.exports = { createEnquiry, listEnquiries };
