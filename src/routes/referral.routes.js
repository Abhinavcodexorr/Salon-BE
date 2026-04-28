const express = require("express");
const router = express.Router();
const { auth } = require("../middleware/auth");
const referralController = require("../controllers/referral.controller");

router.post("/redeem", auth, referralController.redeemInviteCode);

module.exports = router;
