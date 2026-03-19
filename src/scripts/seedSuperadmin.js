const Admin = require("../models/Admin");
const bcrypt = require("bcrypt");

const DEFAULT_EMAIL = "superadmin@admin.com";
const DEFAULT_PASSWORD = "qwerty";

async function seedSuperadmin() {
  const exists = await Admin.findOne({ email: DEFAULT_EMAIL });
  if (exists) return;

  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  await Admin.create({
    email: DEFAULT_EMAIL,
    password: hashedPassword,
  });
  console.log("Default superadmin created (email: superadmin@admin.com, password: qwerty)");
}

module.exports = { seedSuperadmin };
