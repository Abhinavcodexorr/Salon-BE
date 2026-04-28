const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin.controller");
const adminAuthController = require("../controllers/adminAuth.controller");
const availabilityController = require("../controllers/availability.controller");
const enquiryController = require("../controllers/enquiry.controller");
const walletAdjustmentController = require("../controllers/walletAdjustment.controller");
const { superadminAuth } = require("../middleware/auth");

router.post("/login", adminAuthController.login);
router.post("/logout", adminAuthController.logout);

/** Dashboard: appointment total + unread notifications — requires admin JWT from POST /admin/login */
router.get("/counts", superadminAuth, adminController.getDashboardCounts);

/** Single salon availability row — create or update each time (timestamps on document). */
router.put("/availability", superadminAuth, availabilityController.putAvailability);

router.get("/services", adminController.listServices);
router.post("/services/seed", adminController.seedServices);
router.get("/services/:id", adminController.getServiceById);
router.post("/services", adminController.createService);
router.patch("/services/:id", adminController.updateService);
router.delete("/services/:id", adminController.deleteService);
router.get("/users", superadminAuth, adminController.listUsers);
/** Same as GET /users — customer accounts (OTP users) with wallet; use for “Customers” screen. */
router.get("/customers", superadminAuth, adminController.listUsers);
router.get("/appointments", superadminAuth, adminController.listAppointments);
router.get(
  "/appointments/:appointmentId/wallet",
  superadminAuth,
  walletAdjustmentController.getWalletByAppointmentId
);
router.post(
  "/appointments/:appointmentId/wallet/adjust",
  superadminAuth,
  walletAdjustmentController.adjustWalletByAppointmentId
);
router.get("/enquiries", superadminAuth, enquiryController.listEnquiries);

module.exports = router;
