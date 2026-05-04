const mongoose = require("mongoose");

/** One priced line under a subheading: name, price, time (minutes). */
const serviceLineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0, default: 0 },
    /** Minutes for this line (send as `time`; `duration` is still accepted on write and mapped here). */
    time: { type: Number, min: 1, default: undefined },
    /** @deprecated Use `time`. Kept so old documents still load. */
    duration: { type: Number, min: 1, default: undefined },
  },
  { _id: false }
);

/** Subheading block: title + optional block-level minutes + priced lines. */
const subheadingBlockSchema = new mongoose.Schema(
  {
    subheading: { type: String, required: true, trim: true },
    /** Minutes for this whole subheading (optional; can differ per block). */
    duration: { type: Number, min: 1, default: undefined },
    items: { type: [serviceLineSchema], default: [] },
  },
  { _id: true }
);

const serviceSchema = new mongoose.Schema(
  {
    /** Main section title shown on the site (e.g. "Hair"). */
    heading: { type: String, trim: true, default: "" },
    subheadings: { type: [subheadingBlockSchema], default: [] },

    /** @deprecated Use `heading` + `subheadings` for new menus. Kept for existing rows & appointments. */
    title: { type: String, required: false, trim: true },
    description: { type: String, required: false },
    items: [{ type: String }],
    image: { type: String, default: "" },
    alt: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    duration: { type: Number, default: 30, min: 1 },
    /** @deprecated Prefer line-level `price` inside `subheadings[].items`. */
    price: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

/** Label used when booking / slots (heading wins for new shape). */
serviceSchema.methods.getDisplayName = function getDisplayName() {
  const h = this.heading && String(this.heading).trim();
  if (h) return h;
  return this.title && String(this.title).trim() ? String(this.title).trim() : "Service";
};

serviceSchema.statics.getDisplayNameForDoc = function getDisplayNameForDoc(doc) {
  if (!doc) return "Service";
  const h = doc.heading && String(doc.heading).trim();
  if (h) return h;
  const t = doc.title && String(doc.title).trim();
  return t || "Service";
};

module.exports = mongoose.model("Service", serviceSchema);
