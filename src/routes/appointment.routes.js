const express = require("express");
const router = express.Router();
const appointmentController = require("../controllers/appointment.controller");
const { auth, optionalAuth } = require("../middleware/auth");

router.get("/available-slots", appointmentController.getAvailableSlots);
router.post("/", optionalAuth, appointmentController.create);
router.get("/my", auth, appointmentController.getMyAppointments);

module.exports = router;
