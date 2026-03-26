const SalonAvailability = require("../models/SalonAvailability");
const { AppError } = require("../middleware/errorHandler");
const { DEFAULT_START, DEFAULT_END, parseTimeToMinutes } = require("../config/slots");

function isValidHm(str) {
  if (typeof str !== "string" || !/^\d{2}:\d{2}$/.test(str)) return false;
  const [h, m] = str.split(":").map(Number);
  return h >= 0 && h < 24 && m >= 0 && m < 60;
}

/**
 * Resolve salon open/close for booking (DB row if set, else env, else defaults).
 */
async function resolveSalonBookingWindow() {
  const doc = await SalonAvailability.findOne({ singleton: true }).lean();
  if (doc && doc.availableFrom && doc.availableTo) {
    return { from: doc.availableFrom, to: doc.availableTo };
  }
  return {
    from: process.env.SALON_AVAILABLE_FROM || DEFAULT_START,
    to: process.env.SALON_AVAILABLE_TO || DEFAULT_END,
  };
}

/**
 * Create or update the single availability row (same API every time).
 */
async function upsertAvailability({ availableFrom, availableTo }) {
  if (!isValidHm(availableFrom) || !isValidHm(availableTo)) {
    throw new AppError("availableFrom and availableTo must be HH:mm (e.g. 09:00, 18:00)", 400);
  }
  if (parseTimeToMinutes(availableFrom) >= parseTimeToMinutes(availableTo)) {
    throw new AppError("availableFrom must be before availableTo", 400);
  }

  return SalonAvailability.findOneAndUpdate(
    { singleton: true },
    {
      $set: { availableFrom, availableTo },
      $setOnInsert: { singleton: true },
    },
    { upsert: true, new: true, runValidators: true }
  );
}

async function getAvailabilityDocument() {
  const doc = await SalonAvailability.findOne({ singleton: true }).lean();
  return doc;
}

module.exports = {
  resolveSalonBookingWindow,
  upsertAvailability,
  getAvailabilityDocument,
};
