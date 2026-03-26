const mongoose = require("mongoose");

/**
 * Single salon-wide booking window (one document; singleton: true).
 * Times are HH:mm only; createdAt / updatedAt from timestamps.
 */
const salonAvailabilitySchema = new mongoose.Schema(
  {
    singleton: { type: Boolean, default: true },
    availableFrom: { type: String, required: true },
    availableTo: { type: String, required: true },
  },
  { timestamps: true }
);

salonAvailabilitySchema.index({ singleton: 1 }, { unique: true });

module.exports = mongoose.model("SalonAvailability", salonAvailabilitySchema);
