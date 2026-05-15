const cron = require("node-cron");
const config = require("../config");
const { processAppointmentReminders } = require("../services/appointmentReminder.service");

let scheduledTask = null;
let isRunning = false;

async function runReminderJob(trigger = "cron") {
  if (isRunning) {
    console.log(`[reminder] Skipping ${trigger} run — previous job still in progress`);
    return;
  }
  isRunning = true;
  try {
    const summary = await processAppointmentReminders();
    if (summary.sent > 0) {
      console.log(
        `[reminder] ${trigger}: sent=${summary.sent}, skipped=${summary.skipped}, checked=${summary.processed}`
      );
    }
  } catch (err) {
    console.error(`[reminder] ${trigger} job error:`, err.message);
  } finally {
    isRunning = false;
  }
}

function startAppointmentReminderCron() {
  if (!config.reminderCronEnabled) {
    console.log("[reminder] Cron disabled (BOOKING_REMINDER_CRON_ENABLED=false)");
    return null;
  }

  if (!cron.validate(config.reminderCronSchedule)) {
    console.error(
      `[reminder] Invalid cron schedule: ${config.reminderCronSchedule}`
    );
    return null;
  }

  scheduledTask = cron.schedule(config.reminderCronSchedule, () => {
    runReminderJob("cron");
  });

  console.log(
    `[reminder] Cron started (${config.reminderCronSchedule}, ${config.reminderHoursBefore}h before, tz=${config.bookingTimezone})`
  );

  return scheduledTask;
}

function stopAppointmentReminderCron() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
}

module.exports = {
  startAppointmentReminderCron,
  stopAppointmentReminderCron,
  runReminderJob,
};
