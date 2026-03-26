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
    price: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Service", serviceSchema);
