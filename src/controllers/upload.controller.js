const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { s3Client } = require("../config/s3");
const { v4: uuidv4 } = require("uuid");
const { success } = require("../utils/response");
const { AppError } = require("../middleware/errorHandler");

async function uploadImage(req, res, next) {
  try {
    if (!req.file) {
      throw new AppError("No image file provided", 400);
    }

    const ext = req.file.mimetype.split("/")[1] || "jpg";
    const key = `uploads/${uuidv4()}.${ext}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
        ACL: "public-read",
      })
    );

    const url = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    success(res, { url }, "Image uploaded successfully", 201);
  } catch (err) {
    next(err);
  }
}

module.exports = { uploadImage };
