const express = require("express");
const multer = require("multer");
const uploadController = require("../controllers/upload.controller");
const { AppError } = require("../middleware/errorHandler");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError("Invalid file type. Allowed: jpeg, jpg, png, webp, gif", 400), false);
    }
  },
});

router.post("/image", (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(new AppError("File too large. Max size: 5MB", 400));
      }
      return next(err);
    }
    next();
  });
}, uploadController.uploadImage);

module.exports = router;
