const config = require("../config");
const { AppError } = require("../middleware/errorHandler");

const NOTIFYRE_API_URL = "https://api.notifyre.com/sms/send";

function isNotifyreConfigured() {
  return Boolean(config.notifyreApiToken);
}

function formatE164(countryCode, mobile) {
  const code = String(countryCode || "").trim();
  const digits = String(mobile || "").replace(/\D/g, "");
  if (!code || !digits) return null;
  const normalizedCode = code.startsWith("+") ? code : `+${code.replace(/\D/g, "")}`;
  return `${normalizedCode}${digits}`;
}

async function sendSms(to, body) {
  if (!isNotifyreConfigured()) {
    throw new AppError("Notifyre SMS is not configured", 503);
  }

  const payload = {
    Body: body,
    Recipients: [{ type: "mobile_number", value: to }],
    From: config.notifyreFromNumber || "",
    AddUnsubscribeLink: false,
    CampaignName: config.notifyreCampaignName,
  };

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

  return sendSms(to, body);
}

async function sendAppointmentReceivedSms({ mobile, countryCode, name }) {
  const to = formatE164(countryCode, mobile);
  if (!to) return { skipped: true, reason: "invalid-mobile" };

  const customerName = String(name || "Customer").trim() || "Customer";
  const body = `Hi ${customerName}, your appointment request has been received by Blosm Hair & Beauty. We'll confirm shortly.`;

  return sendSms(to, body);
}

module.exports = {
  isNotifyreConfigured,
  formatE164,
  sendSms,
  sendLoginOtpSms,
  sendAppointmentReceivedSms,
};
