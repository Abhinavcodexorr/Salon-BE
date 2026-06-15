const { AppError } = require("../middleware/errorHandler");
const notifyre = require("./notifyre.service");
const twilio = require("./twilio.service");

function isSmsConfigured() {
  return notifyre.isNotifyreConfigured() || twilio.isTwilioConfigured();
}

function smsProvider() {
  if (notifyre.isNotifyreConfigured()) return "notifyre";
  if (twilio.isTwilioConfigured()) return "twilio";
  return null;
}

async function sendLoginOtpSms(params) {
  const provider = smsProvider();
  if (provider === "notifyre") return notifyre.sendLoginOtpSms(params);
  if (provider === "twilio") return twilio.sendLoginOtpSms(params);
  throw new AppError("SMS is not configured", 503);
}

async function sendAppointmentReceivedSms(params) {
  const provider = smsProvider();
  if (provider === "notifyre") return notifyre.sendAppointmentReceivedSms(params);
  if (provider === "twilio") return twilio.sendAppointmentReceivedSms(params);
  return { skipped: true, reason: "sms-not-configured" };
}

module.exports = {
  isSmsConfigured,
  smsProvider,
  sendLoginOtpSms,
  sendAppointmentReceivedSms,
};
