const { google } = require("googleapis");
const { AppError } = require("../middleware/errorHandler");

const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.send"];

function getOAuth2Client(overrideRedirectUri) {
  const redirectUri =
    overrideRedirectUri ||
    process.env.GMAIL_REDIRECT_URI ||
    "https://developers.google.com/oauthplayground";

  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new AppError("Gmail client credentials are not configured", 400);
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function hasGmailEnvConfigured() {
  return Boolean(
    process.env.GMAIL_CLIENT_ID &&
      process.env.GMAIL_CLIENT_SECRET &&
      process.env.GMAIL_REFRESH_TOKEN &&
      process.env.GMAIL_SENDER_EMAIL
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatGroupedServices(serviceSelections, fallbackTitle) {
  if (!Array.isArray(serviceSelections) || serviceSelections.length === 0) {
    return {
      html: `<div style="font-size:14px;color:#222;">${escapeHtml(fallbackTitle || "-")}</div>`,
      text: [fallbackTitle || "-"],
    };
  }

  const groups = new Map();
  for (const row of serviceSelections) {
    const serviceName = String(row?.serviceName || "Service").trim() || "Service";
    const subheading = String(row?.subheading || "").trim();
    const item = String(row?.serviceItemName || "").trim();
    const rawLabel = [subheading, item].filter(Boolean).join(" - ") || "Standard";
    // Avoid repeating heading in line items, e.g. "Body Spa - Full Body Scrub".
    const escapedServiceName = serviceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const headingPrefixRegex = new RegExp(`^${escapedServiceName}\\s*[-:>]*\\s*`, "i");
    const labelBase = rawLabel.replace(headingPrefixRegex, "").trim() || "Standard";
    const durationMins = Math.max(0, Number(row?.duration) || 0);
    const priceNum = Math.max(0, Number(row?.price) || 0);
    const metaParts = [];
    if (durationMins > 0) metaParts.push(`${durationMins} min`);
    metaParts.push(`$${priceNum.toFixed(2)}`);
    const label = `${labelBase} (${metaParts.join(" | ")})`;
    if (!groups.has(serviceName)) groups.set(serviceName, []);
    groups.get(serviceName).push(label);
  }

  const htmlParts = [];
  const textParts = [];
  for (const [serviceName, labels] of groups.entries()) {
    const uniqueLabels = [...new Set(labels)];
    const labelHtml = uniqueLabels
      .map(
        (label) =>
          `<div style="font-size:13px;color:#4b5563;line-height:1.6;margin-top:4px;">• ${escapeHtml(label)}</div>`
      )
      .join("");
    htmlParts.push(`
      <div style="margin:0 0 10px 0;">
        <div style="font-size:14px;font-weight:700;color:#111827;">${escapeHtml(serviceName)}</div>
        <div style="margin-top:3px;">${labelHtml}</div>
      </div>
    `);
    textParts.push(serviceName);
    uniqueLabels.forEach((label) => textParts.push(`  - ${label}`));
  }

  return { html: htmlParts.join(""), text: textParts };
}

function formatTimeTo12Hour(rawTime) {
  const value = String(rawTime || "").trim();
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return value || "To be confirmed";
  const hh = Number(match[1]);
  const mm = match[2];
  if (!Number.isFinite(hh) || hh < 0 || hh > 23) return value;
  const suffix = hh >= 12 ? "PM" : "AM";
  const hour12 = hh % 12 || 12;
  return `${hour12}:${mm} ${suffix}`;
}

function formatTimeRangeTo12Hour(timeRange) {
  const value = String(timeRange || "").trim();
  if (!value) return "To be confirmed";
  const parts = value.split("-").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return `${formatTimeTo12Hour(parts[0])} - ${formatTimeTo12Hour(parts[1])}`;
  return formatTimeTo12Hour(value);
}

function buildAppointmentEmailTemplate(payload) {
  const {
    customerName,
    serviceTitle,
    date,
    timeRange,
    totalAmount,
    notes,
    mobile,
    serviceSelections,
    emailKind = "confirmation",
    hoursBefore = 2,
  } = payload;
  const isReminder = emailKind === "reminder";
  const badgeLabel = isReminder ? "Reminder" : "Confirmed";
  const headline = isReminder
    ? `Your Appointment Is in ${escapeHtml(hoursBefore)} Hours`
    : "Your Appointment Is Booked";
  const introText = isReminder
    ? "This is a friendly reminder about your upcoming appointment at BLOSM. We look forward to seeing you soon."
    : "Thank you for booking with BLOSM. Your appointment is confirmed and we are excited to host you.";
  const footerHelp = isReminder
    ? "Need to reschedule? Please contact BLOSM support as soon as possible."
    : "Need to reschedule? Please contact BLOSM support for assistance.";
  const footerThanks = isReminder ? "See you soon at BLOSM." : "Thank you for choosing BLOSM.";
  const amountText = Number.isFinite(Number(totalAmount))
    ? `$${Number(totalAmount).toFixed(2)}`
    : "-";
  const safeNotes = String(notes || "").trim();
  const groupedServices = formatGroupedServices(serviceSelections, serviceTitle);
  const timeDisplay = formatTimeRangeTo12Hour(timeRange);

  return `
  <div style="margin:0;padding:0;background:#f2f4f8;font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f4f8;padding:30px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="padding:30px 32px 18px 32px;background:#b79a58;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <div style="font-size:36px;line-height:1;color:#ffffff;font-weight:800;letter-spacing:4px;">BLOSM</div>
                      <div style="font-size:12px;color:#f8f2e5;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;margin-top:7px;">Luxury Hair & Beauty Studio</div>
                    </td>
                    <td align="right" valign="top">
                      <span style="display:inline-block;padding:8px 13px;border-radius:999px;background:#ffffff;color:#6b5630;font-size:12px;font-weight:700;">${badgeLabel}</span>
                    </td>
                  </tr>
                </table>
                <div style="font-size:22px;line-height:1.3;color:#ffffff;font-weight:700;margin-top:20px;">${headline}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 32px 14px 32px;">
                <p style="margin:0 0 10px 0;font-size:16px;line-height:1.5;color:#111827;">Hi ${escapeHtml(customerName)},</p>
                <p style="margin:0 0 22px 0;font-size:15px;line-height:1.65;color:#4b5563;">
                  ${introText}
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;overflow:hidden;background:#ffffff;">
                  <tr>
                    <td style="padding:14px 18px;background:#f8fafc;font-size:13px;color:#1f2937;font-weight:700;letter-spacing:0.3px;">
                      Appointment Details
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:18px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.65;color:#1f2937;">
                        <tr>
                          <td style="width:50%;padding:0 8px 12px 0;vertical-align:top;">
                            <div style="font-size:12px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Date</div>
                            <div style="font-size:15px;color:#111827;font-weight:600;margin-top:2px;">${escapeHtml(date)}</div>
                          </td>
                          <td style="width:50%;padding:0 0 12px 8px;vertical-align:top;">
                            <div style="font-size:12px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Time</div>
                            <div style="font-size:15px;color:#111827;font-weight:600;margin-top:2px;">${escapeHtml(timeDisplay)}</div>
                          </td>
                        </tr>
                        <tr>
                          <td style="width:50%;padding:0 8px 12px 0;vertical-align:top;">
                            <div style="font-size:12px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Contact</div>
                            <div style="font-size:15px;color:#111827;font-weight:600;margin-top:2px;">${escapeHtml(mobile)}</div>
                          </td>
                          <td style="width:50%;padding:0 0 12px 8px;vertical-align:top;">
                            <div style="font-size:12px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Estimated Total</div>
                            <div style="font-size:15px;color:#111827;font-weight:600;margin-top:2px;">${escapeHtml(amountText)}</div>
                          </td>
                        </tr>
                      </table>
                      <div style="margin-top:4px;padding-top:12px;border-top:1px dashed #d1d5db;">
                        <div style="font-size:12px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Selected Services</div>
                        ${groupedServices.html}
                      </div>
                    </td>
                  </tr>
                </table>
                ${
                  safeNotes
                    ? `<div style="margin-top:14px;padding:13px 15px;background:#f9fafb;border:1px solid #e5e7eb;font-size:14px;line-height:1.6;color:#374151;"><strong style="color:#111827;">Notes:</strong> ${escapeHtml(safeNotes)}</div>`
                    : ""
                }
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px 22px 32px;background:#b79a58;">
                <p style="margin:0;font-size:14px;line-height:1.6;color:#fffaf0;">
                  ${footerHelp}
                </p>
                <p style="margin:14px 0 0 0;font-size:13px;color:#ffffff;">${footerThanks}</p>
                <p style="margin:16px 0 0 0;padding-top:12px;border-top:1px solid #ccb783;font-size:12px;line-height:1.6;color:#f5eddc;">
                  This is a no-reply email. Please do not reply to this message.<br/>
                  © ${new Date().getFullYear()} BLOSM. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`;
}

function toBase64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function sendAppointmentReminderEmail(payload) {
  if (!hasGmailEnvConfigured()) return { skipped: true, reason: "gmail-env-not-configured" };

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  const hoursBefore = payload.hoursBefore ?? 2;
  const subject = `Blosm Appointment Reminder - ${payload.date}`;
  const html = buildAppointmentEmailTemplate({
    ...payload,
    emailKind: "reminder",
  });
  const plainText = [
    `Hi ${payload.customerName},`,
    "",
    `Reminder: your BLOSM appointment is in about ${hoursBefore} hours.`,
    "Services:",
    ...formatGroupedServices(payload.serviceSelections, payload.serviceTitle).text.map(
      (line) => `- ${line}`
    ),
    `Date: ${payload.date}`,
    `Time: ${formatTimeRangeTo12Hour(payload.timeRange)}`,
    `Mobile: ${payload.mobile}`,
    `Estimated Total: ${payload.totalAmount ?? "-"}`,
    payload.notes ? `Notes: ${payload.notes}` : "",
    "",
    "Need to reschedule? Please contact BLOSM support as soon as possible.",
    "See you soon at BLOSM.",
    "This is a no-reply email. Please do not reply to this message.",
    `© ${new Date().getFullYear()} BLOSM. All rights reserved.`,
  ]
    .filter(Boolean)
    .join("\n");

  const message = [
    `From: Blosm Hair & Beauty <${process.env.GMAIL_SENDER_EMAIL}>`,
    `To: ${payload.to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: multipart/alternative; boundary="blosm_reminder_boundary"',
    "",
    "--blosm_reminder_boundary",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    plainText,
    "",
    "--blosm_reminder_boundary",
    "Content-Type: text/html; charset=UTF-8",
    "",
    html,
    "",
    "--blosm_reminder_boundary--",
  ].join("\n");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: toBase64Url(message) },
  });

  return { skipped: false };
}

async function sendAppointmentConfirmationEmail(payload) {
  if (!hasGmailEnvConfigured()) return { skipped: true, reason: "gmail-env-not-configured" };

  const oauth2Client = getOAuth2Client();

  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  const subject = `Blosm Appointment Confirmation - ${payload.date}`;
  const html = buildAppointmentEmailTemplate(payload);
  const plainText = [
    `Hi ${payload.customerName},`,
    "",
    "Your appointment is confirmed.",
    "Services:",
    ...formatGroupedServices(payload.serviceSelections, payload.serviceTitle).text.map((line) => `- ${line}`),
    `Date: ${payload.date}`,
    `Time: ${formatTimeRangeTo12Hour(payload.timeRange)}`,
    `Mobile: ${payload.mobile}`,
    `Estimated Total: ${payload.totalAmount ?? "-"}`,
    payload.notes ? `Notes: ${payload.notes}` : "",
    "",
    "Need to reschedule? Please contact BLOSM support for assistance.",
    "Thank you for choosing BLOSM.",
    "This is a no-reply email. Please do not reply to this message.",
    `© ${new Date().getFullYear()} BLOSM. All rights reserved.`,
  ]
    .filter(Boolean)
    .join("\n");

  const message = [
    `From: Blosm Hair & Beauty <${process.env.GMAIL_SENDER_EMAIL}>`,
    `To: ${payload.to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: multipart/alternative; boundary="blosm_boundary"',
    "",
    "--blosm_boundary",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    plainText,
    "",
    "--blosm_boundary",
    "Content-Type: text/html; charset=UTF-8",
    "",
    html,
    "",
    "--blosm_boundary--",
  ].join("\n");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: toBase64Url(message) },
  });

  return { skipped: false };
}

function getGmailAuthorizationUrl(overrideRedirectUri) {
  const oauth2Client = getOAuth2Client(overrideRedirectUri);
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: GMAIL_SCOPES,
    prompt: "consent",
  });
}

async function exchangeGmailCodeForTokens(code, overrideRedirectUri) {
  if (!code || !String(code).trim()) {
    throw new AppError("Authorization code is required", 400);
  }
  const oauth2Client = getOAuth2Client(overrideRedirectUri);
  const { tokens } = await oauth2Client.getToken(String(code).trim());
  return tokens;
}

module.exports = {
  sendAppointmentConfirmationEmail,
  sendAppointmentReminderEmail,
  hasGmailEnvConfigured,
  getGmailAuthorizationUrl,
  exchangeGmailCodeForTokens,
};
