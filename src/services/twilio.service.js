const config = require("../config");
const { AppError } = require("../middleware/errorHandler");

function isTwilioConfigured() {
  return Boolean(
    config.twilioAccountSid && config.twilioAuthToken && config.twilioFromNumber
  );
}

function formatE164(countryCode, mobile) {
  const code = String(countryCode || "").trim();
  const digits = String(mobile || "").replace(/\D/g, "");
  if (!code || !digits) return null;
  const normalizedCode = code.startsWith("+") ? code : `+${code.replace(/\D/g, "")}`;
  return `${normalizedCode}${digits}`;
}

async function sendSms(to, body) {
  if (!isTwilioConfigured()) {
    throw new AppError("Twilio SMS is not configured", 503);
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.twilioAccountSid}/Messages.json`;
  const auth = Buffer.from(`${config.twilioAccountSid}:${config.twilioAuthToken}`).toString("base64");
  const params = new URLSearchParams({
    To: to,
    From: config.twilioFromNumber,
    Body: body,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new AppError(`Failed to send SMS: ${detail}`, 502);
  }

  return response.json();
}

async function sendLoginOtpSms({ mobile, countryCode, otp }) {
  const to = formatE164(countryCode, mobile);
  if (!to) throw new AppError("Valid mobile and country code are required for SMS", 400);

  return sendSms(to, `Your OTP for Login into Blosm is ${otp}`);
}

async function sendAppointmentReceivedSms({ mobile, countryCode, name }) {
  const to = formatE164(countryCode, mobile);
  if (!to) return { skipped: true, reason: "invalid-mobile" };

  const customerName = String(name || "Customer").trim() || "Customer";
  const body = `Hi ${customerName}, your appointment request has been received by Blosm Hair & Beauty. We'll confirm shortly.`;

  return sendSms(to, body);
}

module.exports = {
  isTwilioConfigured,
  formatE164,
  sendSms,
  sendLoginOtpSms,
  sendAppointmentReceivedSms,
};
