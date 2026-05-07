const express = require("express");
const router = express.Router();
const gmailController = require("../controllers/gmail.controller");
const { superadminAuth } = require("../middleware/auth");

router.get("/auth-url", superadminAuth, gmailController.getAuthUrl);
router.post("/exchange-code", superadminAuth, gmailController.exchangeCode);

module.exports = router;
