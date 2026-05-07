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
    const label = rawLabel.replace(headingPrefixRegex, "").trim() || "Standard";
    if (!groups.has(serviceName)) groups.set(serviceName, []);
    groups.get(serviceName).push(label);
  }

  const htmlParts = [];
  const textParts = [];
  for (const [serviceName, labels] of groups.entries()) {
    const uniqueLabels = [...new Set(labels)];
    htmlParts.push(`
      <div style="margin:0 0 10px 0;">
        <div style="font-size:14px;font-weight:700;color:#111;">${escapeHtml(serviceName)}</div>
        <div style="font-size:13px;color:#444;margin-top:3px;">${escapeHtml(uniqueLabels.join(", "))}</div>
      </div>
    `);
    textParts.push(`${serviceName}: ${uniqueLabels.join(", ")}`);
  }

  return { html: htmlParts.join(""), text: textParts };
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
  } = payload;
  const amountText = Number.isFinite(Number(totalAmount))
    ? `$${Number(totalAmount).toFixed(2)}`
    : "-";
  const safeNotes = String(notes || "").trim();
  const groupedServices = formatGroupedServices(serviceSelections, serviceTitle);

  return `
  <div style="margin:0;padding:0;background:#f7f7f7;font-family:Arial,Helvetica,sans-serif;color:#222;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="620" cellpadding="0" cellspacing="0" style="max-width:620px;background:#fffdf6;border-radius:16px;overflow:hidden;border:1px solid #c8a75a;">
            <tr>
              <td style="background:linear-gradient(135deg,#7a5a1c,#d4af37 45%,#f2d58a);padding:28px 30px;border-bottom:1px solid #b48a2c;">
                <div style="font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:#fff6d8;font-weight:700;">Luxury Hair & Beauty Studio</div>
                <div style="font-size:36px;line-height:1;color:#1f1404;font-weight:800;letter-spacing:4px;margin-top:10px;">BLOSM</div>
                <div style="font-size:18px;line-height:1.3;color:#2d1b05;font-weight:700;margin-top:10px;">Appointment Confirmation</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 30px 12px 30px;">
                <p style="margin:0 0 12px 0;font-size:16px;line-height:1.5;color:#222;">Hi ${escapeHtml(customerName)},</p>
                <p style="margin:0 0 18px 0;font-size:15px;line-height:1.6;color:#444;">
                  Your booking is confirmed. We are excited to welcome you at BLOSM.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #d2b475;border-radius:12px;overflow:hidden;background:#fffbef;">
                  <tr><td style="padding:12px 14px;background:#f5e4b6;font-size:13px;color:#6c4b11;font-weight:700;letter-spacing:0.2px;">Booking Details</td></tr>
                  <tr><td style="padding:14px 16px;font-size:14px;line-height:1.75;color:#222;">
                    <strong>Services:</strong>
                    <div style="margin-top:8px;">${groupedServices.html}</div>
                    <strong>Date:</strong> ${escapeHtml(date)}<br/>
                    <strong>Time:</strong> ${escapeHtml(timeRange || "To be confirmed")}<br/>
                    <strong>Mobile:</strong> ${escapeHtml(mobile)}<br/>
                    <strong>Estimated Total:</strong> ${escapeHtml(amountText)}
                  </td></tr>
                </table>
                ${
                  safeNotes
                    ? `<p style="margin:16px 0 0 0;font-size:14px;line-height:1.6;color:#222;"><strong>Notes:</strong> ${escapeHtml(safeNotes)}</p>`
                    : ""
                }
              </td>
            </tr>
            <tr>
              <td style="padding:20px 30px 30px 30px;">
                <p style="margin:0;font-size:14px;line-height:1.6;color:#444;">
                  Need to reschedule? Reply to this email and our team will assist you.
                </p>
                <p style="margin:14px 0 0 0;font-size:13px;color:#666;">Thank you for choosing BLOSM.</p>
                <p style="margin:16px 0 0 0;padding-top:12px;border-top:1px solid #e8dcbf;font-size:12px;line-height:1.6;color:#7a7a7a;">
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
    `Time: ${payload.timeRange || "To be confirmed"}`,
    `Mobile: ${payload.mobile}`,
    `Estimated Total: ${payload.totalAmount ?? "-"}`,
    payload.notes ? `Notes: ${payload.notes}` : "",
    "",
    "Thank you for choosing Blosm.",
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
  hasGmailEnvConfigured,
  getGmailAuthorizationUrl,
  exchangeGmailCodeForTokens,
};
