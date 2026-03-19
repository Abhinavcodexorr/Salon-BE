const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    items: [{ type: String }],
    image: { type: String, default: "" },
    alt: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    duration: { type: Number, default: 30 }, // minutes - how long the service takes
    availableFrom: { type: String, default: "09:00" }, // HH:mm - service availability start
    availableTo: { type: String, default: "18:00" }, // HH:mm - service availability end
  },
  { timestamps: true }
);

module.exports = mongoose.model("Service", serviceSchema);
