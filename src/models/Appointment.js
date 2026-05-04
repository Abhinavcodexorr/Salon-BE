const mongoose = require("mongoose");

/** One booked line (from menu); many allowed per appointment. */
const appointmentServiceSelectionSchema = new mongoose.Schema(
  {
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },
    serviceName: { type: String, default: null },
    subheading: { type: String, default: null },
    serviceItemName: { type: String, default: null },
    duration: { type: Number, required: true, min: 1 },
    price: { type: Number, default: 0, min: 0 },
    /** "Heading › Sub › Item" for this line. */
    displayLine: { type: String, default: "" },
  },
  { _id: false }
);

const appointmentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    name: { type: String, required: true },
    email: { type: String, required: true },
    mobile: { type: String, required: true },
    countryCode: { type: String, default: "+61" },
    /** Display line for lists/search; multiple joined with " | ". */
    service: { type: String, required: true },
    /** First selection’s service (legacy / filters); use `serviceSelections` when multiple. */
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "Service", default: null },
    /** Main menu heading when a single selection mirrors root (optional if only array). */
    serviceName: { type: String, default: null },
    subheading: { type: String, default: null },
    serviceItemName: { type: String, default: null },
    /** Sum of all selection durations (one continuous block from `time`). */
    duration: { type: Number, default: 30 },
    /** Sum of `serviceSelections[].price` at booking (menu prices). */
    totalAmount: { type: Number, default: 0, min: 0 },
    date: { type: String, required: true },
    time: { type: String, default: null },
    timeEnd: { type: String, default: null },
    status: { type: String, default: "completed", enum: ["completed", "cancelled"] },
    notes: { type: String, default: null },
    /** Multiple services / lines; total minutes = sum of `duration` here = root `duration`. */
    serviceSelections: { type: [appointmentServiceSelectionSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Appointment", appointmentSchema);
