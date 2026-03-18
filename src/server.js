require("dotenv").config();
const { connectDB } = require("./config/database");
const app = require("./app");
const config = require("./config");

connectDB().then(() => {
  app.listen(config.port, () => {
    console.log(`Blosm API running on http://localhost:${config.port}`);
  });
});
