require("dotenv").config();
const { connectDB } = require("./config/database");
const { seedSuperadmin } = require("./scripts/seedSuperadmin");
const app = require("./app");
const config = require("./config");

connectDB()
  .then(() => seedSuperadmin())
  .then(() => {
    app.listen(config.port, () => {
      console.log(`Blosm API running on http://localhost:${config.port}`);
    });
  });
