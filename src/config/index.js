require("dotenv").config();

module.exports = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || "development",
  jwtSecret: process.env.JWT_SECRET || "blosm-dev-secret-change-in-prod",
  jwtExpiry: process.env.JWT_EXPIRY || "7d",
  bookingTimezone: process.env.BOOKING_TIMEZONE || "Australia/Adelaide",
  reminderHoursBefore: Math.max(1, Number(process.env.BOOKING_REMINDER_HOURS_BEFORE) || 2),
  reminderCronEnabled: process.env.BOOKING_REMINDER_CRON_ENABLED !== "false",
  reminderCronSchedule: process.env.BOOKING_REMINDER_CRON_SCHEDULE || "*/5 * * * *",
};
