const { DateTime } = require("luxon");
const Appointment = require("../models/Appointment");
const config = require("../config");
const { sendAppointmentReminderEmail } = require("./gmail.service");
const { parseAppointmentStart, ymdRangeAround } = require("../utils/appointmentDateTime");

function buildReminderPayload(appointment) {
  const timeStart = appointment.time ? String(appointment.time).trim() : null;
  const timeEnd = appointment.timeEnd ? String(appointment.timeEnd).trim() : null;
  const timeRange = timeStart
    ? `${timeStart}${timeEnd ? ` - ${timeEnd}` : ""}`
    : "To be confirmed";

  return {
    to: String(appointment.email).trim().toLowerCase(),
    customerName: String(appointment.name || "Customer").trim(),
    serviceTitle: appointment.service,
    serviceSelections: appointment.serviceSelections || [],
    date: appointment.date,
    timeRange,
    totalAmount: appointment.totalAmount,
    notes: appointment.notes || "",
    mobile: `${appointment.countryCode || "+61"} ${String(appointment.mobile || "").replace(/\D/g, "")}`,
    hoursBefore: config.reminderHoursBefore,
  };
}

async function processAppointmentReminders() {
  if (!config.reminderCronEnabled) {
    return { processed: 0, sent: 0, skipped: 0 };
  }

  const tz = config.bookingTimezone;
  const hoursBefore = config.reminderHoursBefore;
  const now = DateTime.now().setZone(tz);
  const dateKeys = ymdRangeAround(now, 1, 3);

  const candidates = await Appointment.find({
    status: "completed",
    reminderEmailSentAt: null,
    date: { $in: dateKeys },
    time: { $exists: true, $nin: [null, ""] },
    email: { $exists: true, $ne: "" },
  })
    .select(
      "name email mobile countryCode service serviceSelections date time timeEnd totalAmount notes status reminderEmailSentAt"
    )
    .lean();

  let sent = 0;
  let skipped = 0;

  for (const apt of candidates) {
    const start = parseAppointmentStart(apt.date, apt.time, tz);
    if (!start) {
      skipped += 1;
      continue;
    }

    const sendAfter = start.minus({ hours: hoursBefore });
    if (now < sendAfter) {
      skipped += 1;
      continue;
    }
    if (now >= start) {
      skipped += 1;
      continue;
    }

    const claimed = await Appointment.findOneAndUpdate(
      {
        _id: apt._id,
        reminderEmailSentAt: null,
        status: "completed",
      },
      { $set: { reminderEmailSentAt: new Date() } },
      { new: true }
    )
      .select(
        "name email mobile countryCode service serviceSelections date time timeEnd totalAmount notes"
      )
      .lean();

    if (!claimed) {
      skipped += 1;
      continue;
    }

    try {
      const result = await sendAppointmentReminderEmail(buildReminderPayload(claimed));
      if (result.skipped) {
        await Appointment.updateOne(
          { _id: claimed._id },
          { $set: { reminderEmailSentAt: null } }
        );
        skipped += 1;
        console.warn(
          `[reminder] Skipped appointment ${claimed._id}: ${result.reason || "unknown"}`
        );
        continue;
      }
      sent += 1;
      console.log(`[reminder] Sent to ${claimed.email} for appointment ${claimed._id}`);
    } catch (err) {
      await Appointment.updateOne(
        { _id: claimed._id },
        { $set: { reminderEmailSentAt: null } }
      );
      skipped += 1;
      console.error(
        `[reminder] Failed for appointment ${claimed._id}:`,
        err.message
      );
    }
  }

  return { processed: candidates.length, sent, skipped };
}

module.exports = { processAppointmentReminders };
