const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const servicesRoutes = require("./routes/services.routes");
const appointmentRoutes = require("./routes/appointment.routes");
const adminRoutes = require("./routes/admin.routes");
const uploadRoutes = require("./routes/upload.routes");
const { success } = require("./utils/response");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();

const allowedOrigins = [
  "http://localhost:4200",
  "http://localhost:3000",
  "http://localhost:3002",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : true,
  credentials: true,
}));
app.use(express.json());

const API_BASE = "/api/v1";

app.get("/health", (req, res) => success(res, { status: "ok" }, "Server is healthy"));

app.use(`${API_BASE}/auth`, authRoutes);
app.use(`${API_BASE}/users`, userRoutes);
app.use(`${API_BASE}/services`, servicesRoutes);
app.use(`${API_BASE}/appointments`, appointmentRoutes);
app.use(`${API_BASE}/admin`, adminRoutes);
app.use(`${API_BASE}/upload`, uploadRoutes);

app.use(errorHandler);

module.exports = app;
