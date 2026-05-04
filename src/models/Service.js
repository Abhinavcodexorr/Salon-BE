const mongoose = require("mongoose");

/** One priced line under a subheading (e.g. "Men's cut" — 45). */
const serviceLineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false }
);

/** Subheading block: title + list of name/price lines. */
const subheadingBlockSchema = new mongoose.Schema(
  {
    subheading: { type: String, required: true, trim: true },
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
    duration: { type: Number, default: 0, min: 1 },
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
