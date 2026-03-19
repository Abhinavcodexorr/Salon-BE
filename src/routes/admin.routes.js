const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin.controller");
const adminAuthController = require("../controllers/adminAuth.controller");
const { superadminAuth } = require("../middleware/auth");

router.post("/login", adminAuthController.login);
router.post("/logout", adminAuthController.logout);

router.get("/services", adminController.listServices);
router.get("/services/:id", adminController.getServiceById);
router.post("/services", adminController.createService);
router.patch("/services/:id/status", adminController.toggleServiceStatus);
router.patch("/services/:id", adminController.updateService);
router.delete("/services/:id", adminController.deleteService);
router.get("/users", superadminAuth, adminController.listUsers);
router.get("/appointments", superadminAuth, adminController.listAppointments);
router.patch("/appointments/:id/status", superadminAuth, adminController.updateAppointmentStatus);

module.exports = router;
