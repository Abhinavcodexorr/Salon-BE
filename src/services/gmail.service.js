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

function buildAppointmentEmailTemplate(payload) {
  const {
    customerName,
    serviceTitle,
    date,
    timeRange,
    totalAmount,
    notes,
    mobile,
  } = payload;
  const amountText = Number.isFinite(Number(totalAmount))
    ? `$${Number(totalAmount).toFixed(2)}`
    : "-";
  const safeNotes = String(notes || "").trim();

  return `
  <div style="margin:0;padding:0;background:#17120a;font-family:Arial,Helvetica,sans-serif;color:#2a1e0f;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#17120a;padding:24px 0;">
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
                <p style="margin:0 0 12px 0;font-size:16px;line-height:1.5;color:#36280f;">Hi ${escapeHtml(customerName)},</p>
                <p style="margin:0 0 18px 0;font-size:15px;line-height:1.6;color:#5a4521;">
                  Your booking is confirmed. We are excited to welcome you at BLOSM for a premium experience.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #d2b475;border-radius:12px;overflow:hidden;background:#fffbef;">
                  <tr><td style="padding:12px 14px;background:#f5e4b6;font-size:13px;color:#6c4b11;font-weight:700;letter-spacing:0.2px;">Booking Details</td></tr>
                  <tr><td style="padding:14px 16px;font-size:14px;line-height:1.75;color:#3b2a0f;">
                    <strong>Service:</strong> ${escapeHtml(serviceTitle)}<br/>
                    <strong>Date:</strong> ${escapeHtml(date)}<br/>
                    <strong>Time:</strong> ${escapeHtml(timeRange || "To be confirmed")}<br/>
                    <strong>Mobile:</strong> ${escapeHtml(mobile)}<br/>
                    <strong>Estimated Total:</strong> ${escapeHtml(amountText)}
                  </td></tr>
                </table>
                ${
                  safeNotes
                    ? `<p style="margin:16px 0 0 0;font-size:14px;line-height:1.6;color:#3b2a0f;"><strong>Notes:</strong> ${escapeHtml(safeNotes)}</p>`
                    : ""
                }
              </td>
            </tr>
            <tr>
              <td style="padding:20px 30px 30px 30px;">
                <p style="margin:0;font-size:14px;line-height:1.6;color:#5a4521;">
                  Need to reschedule? Reply to this email and our team will assist you.
                </p>
                <p style="margin:14px 0 0 0;font-size:13px;color:#8c6a2f;">Thank you for choosing BLOSM.</p>
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
    `Service: ${payload.serviceTitle}`,
    `Date: ${payload.date}`,
    `Time: ${payload.timeRange || "To be confirmed"}`,
    `Mobile: ${payload.mobile}`,
    `Estimated Total: ${payload.totalAmount ?? "-"}`,
    payload.notes ? `Notes: ${payload.notes}` : "",
    "",
    "Thank you for choosing Blosm.",
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
