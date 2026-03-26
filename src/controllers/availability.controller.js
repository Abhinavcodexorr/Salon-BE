const { AppError } = require("../middleware/errorHandler");
const { success } = require("../utils/response");
const {
  resolveSalonBookingWindow,
  upsertAvailability,
  getAvailabilityDocument,
} = require("../services/salonAvailability.service");

/** Public: current salon hours (DB or env fallback). */
async function getAvailability(req, res, next) {
  try {
    const doc = await getAvailabilityDocument();
    const { from, to } = await resolveSalonBookingWindow();
    success(
      res,
      {
        availableFrom: from,
        availableTo: to,
        ...(doc && {
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        }),
      },
      "Availability retrieved successfully"
    );
  } catch (err) {
    next(err);
  }
}

/**
 * Admin: single upsert — creates one row or updates it; timestamps update automatically.
 * Body: { "availableFrom": "09:00", "availableTo": "18:00" }
 */
async function putAvailability(req, res, next) {
  try {
    const { availableFrom, availableTo } = req.body || {};
    if (availableFrom == null || availableTo == null) {
      throw new AppError("availableFrom and availableTo are required", 400);
    }
    const doc = await upsertAvailability({
      availableFrom: String(availableFrom).trim(),
      availableTo: String(availableTo).trim(),
    });
    success(
      res,
      {
        availableFrom: doc.availableFrom,
        availableTo: doc.availableTo,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      },
      "Availability saved successfully"
    );
  } catch (err) {
    next(err);
  }
}

module.exports = { getAvailability, putAvailability };
