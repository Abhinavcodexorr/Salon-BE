const express = require("express");
const router = express.Router();
const servicesController = require("../controllers/services.controller");

// Website listing - only active, not deleted
router.get("/", servicesController.getServices);

module.exports = router;
