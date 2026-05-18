/**
 * Sends one reminder-style email via Gmail API and writes a browser-openable HTML preview.
 * Usage: node scripts/send-reminder-test-email.js [recipient@email.com]
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const {
  sendAppointmentReminderEmail,
  buildAppointmentEmailTemplate,
  hasGmailEnvConfigured,
} = require("../src/services/gmail.service");

async function main() {
  const to = (process.argv[2] || "abhinav.codexorr@gmail.com").trim().toLowerCase();
  const hoursBefore = Math.max(1, Number(process.env.BOOKING_REMINDER_HOURS_BEFORE) || 2);
  const payload = {
    to,
    customerName: "Abhinav (test)",
    serviceTitle: "Haircut & Style",
    serviceSelections: [
      {
        serviceName: "Hair",
        subheading: "Cut",
        serviceItemName: "Premium cut",
        duration: 45,
        price: 85,
      },
    ],
    date: "2026-05-19",
    timeRange: "14:00 - 15:30",
    totalAmount: 85,
    notes: "Cron reminder pipeline test — you can ignore this booking.",
    mobile: "+61 400 000 000",
    hoursBefore,
  };

  const htmlFragment = buildAppointmentEmailTemplate({
    ...payload,
    emailKind: "reminder",
  });
  const fullDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BLOSM — appointment reminder (preview)</title>
</head>
<body style="margin:0;">
${htmlFragment}
</body>
</html>`;

  const outPath = path.join(__dirname, "reminder-email-preview.html");
  fs.writeFileSync(outPath, fullDoc, "utf8");
  console.log(`Wrote preview: ${outPath}`);

  if (!hasGmailEnvConfigured()) {
    console.error("Gmail env not complete — preview file only. Set GMAIL_* in .env.");
    process.exit(1);
  }

  const result = await sendAppointmentReminderEmail(payload);
  if (result.skipped) {
    console.error("Send skipped:", result.reason);
    process.exit(1);
  }
  console.log(`Reminder sent to ${to}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
