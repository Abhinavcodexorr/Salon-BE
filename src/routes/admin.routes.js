const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin.controller");
const { adminAuth } = require("../middleware/auth");

router.get("/services", adminController.listServices);
router.get("/services/:id", adminController.getServiceById);
router.post("/services", adminController.createService);
router.patch("/services/:id/status", adminController.toggleServiceStatus);
router.patch("/services/:id", adminController.updateService);
router.delete("/services/:id", adminController.deleteService);
router.get("/users", adminAuth, adminController.listUsers);
router.get("/appointments", adminAuth, adminController.listAppointments);
router.patch("/appointments/:id/status", adminAuth, adminController.updateAppointmentStatus);

module.exports = router;
