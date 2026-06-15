const config = require("../config");
const { AppError } = require("../middleware/errorHandler");

const NOTIFYRE_API_URL = "https://api.notifyre.com/sms/send";

function isNotifyreConfigured() {
  return Boolean(config.notifyreApiToken);
}

function formatE164(countryCode, mobile) {
  const code = String(countryCode || "").trim();
  let digits = String(mobile || "").replace(/\D/g, "");
  if (!code || !digits) return null;
  const normalizedCode = code.startsWith("+") ? code : `+${code.replace(/\D/g, "")}`;
  const cc = normalizedCode.replace(/\D/g, "");
  if (digits.startsWith("0") && ["61", "44", "64", "91"].includes(cc)) {
    digits = digits.slice(1);
  }
  return `${normalizedCode}${digits}`;
}

function toRecipients(numbers) {
  const list = Array.isArray(numbers) ? numbers : [numbers];
  return list
    .map((number) => String(number || "").trim())
    .filter(Boolean)
    .map((value) => ({ type: "mobile_number", value }));
}

/**
 * Build payload for POST /sms/send per Notifyre API.
 * Shared sender (+61480099198): leave From empty — Notifyre assigns it.
 */
function buildSendSmsPayload(body, to, options = {}) {
  const payload = {
    Body: body,
    Recipients: toRecipients(to),
    From: config.notifyreFromNumber || "",
    AddUnsubscribeLink: options.addUnsubscribeLink ?? config.notifyreAddUnsubscribeLink,
    CampaignName: options.campaignName || config.notifyreCampaignName,
  };

  if (options.scheduledDate != null) {
    payload.ScheduledDate = options.scheduledDate;
  }
  if (options.callbackUrl || config.notifyreCallbackUrl) {
    payload.CallbackUrl = options.callbackUrl || config.notifyreCallbackUrl;
  }
  if (options.metadata && typeof options.metadata === "object") {
    payload.Metadata = options.metadata;
  }

  return payload;
}

async function sendSms(to, body, options = {}) {
  if (!isNotifyreConfigured()) {
    throw new AppError("Notifyre SMS is not configured", 503);
  }

  const payload = buildSendSmsPayload(body, to, options);

  const response = await fetch(NOTIFYRE_API_URL, {
    method: "POST",
    headers: {
      "x-api-token": config.notifyreApiToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.success === false) {
    const detail =
      data.message ||
      (Array.isArray(data.errors) && data.errors.length ? JSON.stringify(data.errors) : null) ||
      `HTTP ${response.status}`;
    throw new AppError(`Failed to send SMS: ${detail}`, 502);
  }

  return data;
}

async function sendLoginOtpSms({ mobile, countryCode, otp }) {
  const to = formatE164(countryCode, mobile);
  if (!to) throw new AppError("Valid mobile and country code are required for SMS", 400);

  const minutes = config.otpExpiryMinutes || 10;
  const body = [
    "Blosm Hair & Beauty",
    `Your sign-in code is ${otp}.`,
    `Valid for ${minutes} minutes.`,
    "Do not share this code with anyone.",
  ].join(" ");

  return sendSms(to, body, { metadata: { type: "login_otp" } });
}

async function sendAppointmentReceivedSms({ mobile, countryCode, name }) {
  const to = formatE164(countryCode, mobile);
  if (!to) return { skipped: true, reason: "invalid-mobile" };

  const customerName = String(name || "Customer").trim() || "Customer";
  const body = `Hi ${customerName}, your appointment request has been received by Blosm Hair & Beauty. We'll confirm shortly.`;

  return sendSms(to, body, { metadata: { type: "appointment_received" } });
}

module.exports = {
  isNotifyreConfigured,
  formatE164,
  buildSendSmsPayload,
  sendSms,
  sendLoginOtpSms,
  sendAppointmentReceivedSms,
};
