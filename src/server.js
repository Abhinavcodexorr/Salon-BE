const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const { connectDB } = require("./config/database");
const { seedSuperadmin } = require("./scripts/seedSuperadmin");
const app = require("./app");
const config = require("./config");
const { startAppointmentReminderCron } = require("./jobs/appointmentReminder.cron");

connectDB()
  .then(() => seedSuperadmin())
  .then(() => {
    startAppointmentReminderCron();
    app.listen(config.port, () => {
      console.log(`Blosm API running on http://localhost:${config.port}`);
    });
  });
