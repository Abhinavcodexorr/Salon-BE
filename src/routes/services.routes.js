const express = require("express");
const router = express.Router();
const servicesController = require("../controllers/services.controller");

router.get("/titles", servicesController.getServiceTitles);
router.get("/", servicesController.getServices);
router.post("/", servicesController.createService);

module.exports = router;
