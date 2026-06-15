const mongoose = require("mongoose");
require("../models/User");

async function migrateUsersCollection() {
  const users = mongoose.connection.collection("users");
  const result = await users.updateMany(
    { $or: [{ email: null }, { email: "" }] },
    { $unset: { email: "" } }
  );
  if (result.modifiedCount > 0) {
    console.log(`Migration: cleared empty email on ${result.modifiedCount} user(s)`);
  }

  try {
    await users.dropIndex("email_1");
    console.log("Migration: dropped legacy email_1 index");
  } catch (err) {
    if (err.codeName !== "IndexNotFound" && err.code !== 27) {
      console.warn("Migration: could not drop email_1 index:", err.message);
    }
  }

  await mongoose.model("User").syncIndexes();
  console.log("Migration: user indexes synced");
}

async function connectDB() {
  try {
    await mongoose.connect(process.env.DATABASE_URL || process.env.MONGODB_URI);
    console.log("MongoDB connected");
    await migrateUsersCollection();
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  }
}

module.exports = { connectDB };
