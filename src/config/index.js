const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

module.exports = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_SECRET || "blosm-dev-secret-change-in-prod",
  jwtExpiry: process.env.JWT_EXPIRY || "7d",
  bookingTimezone: process.env.BOOKING_TIMEZONE || "Australia/Adelaide",
  reminderHoursBefore: Math.max(1, Number(process.env.BOOKING_REMINDER_HOURS_BEFORE) || 2),
  reminderCronEnabled: process.env.BOOKING_REMINDER_CRON_ENABLED !== "false",
  reminderCronSchedule: process.env.BOOKING_REMINDER_CRON_SCHEDULE || "*/5 * * * *",
  useStaticOtp: process.env.USE_STATIC_OTP !== "false",
  staticOtp: process.env.STATIC_OTP || "123456",
  otpExpiryMinutes: Math.max(1, Number(process.env.OTP_EXPIRY_MINUTES) || 10),
  notifyreApiToken: process.env.NOTIFYRE_API_TOKEN || "",
  notifyreFromNumber: process.env.NOTIFYRE_FROM_NUMBER || "",
  notifyreCampaignName: process.env.NOTIFYRE_CAMPAIGN_NAME || "Blosm",
  notifyreCallbackUrl: process.env.NOTIFYRE_CALLBACK_URL || "",
  notifyreAddUnsubscribeLink: process.env.NOTIFYRE_ADD_UNSUBSCRIBE_LINK === "true",
};
