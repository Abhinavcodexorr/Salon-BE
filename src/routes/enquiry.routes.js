const express = require("express");
const router = express.Router();
const enquiryController = require("../controllers/enquiry.controller");

router.post("/", enquiryController.createEnquiry);

module.exports = router;
