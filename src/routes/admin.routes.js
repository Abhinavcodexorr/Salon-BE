const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin.controller");
const adminAuthController = require("../controllers/adminAuth.controller");
const availabilityController = require("../controllers/availability.controller");
const enquiryController = require("../controllers/enquiry.controller");
const { superadminAuth } = require("../middleware/auth");

router.post("/login", adminAuthController.login);
router.post("/logout", adminAuthController.logout);

/** Single salon availability row — create or update each time (timestamps on document). */
router.put("/availability", superadminAuth, availabilityController.putAvailability);

router.get("/services", adminController.listServices);
router.post("/services/seed", adminController.seedServices);
router.get("/services/:id", adminController.getServiceById);
router.post("/services", adminController.createService);
router.patch("/services/:id", adminController.updateService);
router.delete("/services/:id", adminController.deleteService);
router.get("/users", superadminAuth, adminController.listUsers);
router.get("/appointments", superadminAuth, adminController.listAppointments);
router.get("/enquiries", superadminAuth, enquiryController.listEnquiries);

module.exports = router;
