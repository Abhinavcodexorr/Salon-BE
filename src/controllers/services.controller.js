const Service = require("../models/Service");
const { AppError } = require("../middleware/errorHandler");
const { success } = require("../utils/response");

async function getServices(req, res, next) {
  try {
    const services = await Service.find({ isActive: { $ne: false } }).sort({ createdAt: 1 }).lean();
    success(res, services, "Services retrieved successfully");
  } catch (err) {
    next(err);
  }
}

async function getServiceTitles(req, res, next) {
  try {
    const services = await Service.find({ isActive: { $ne: false } }).select("title").lean();
    const titles = services.map((s) => s.title);
    success(res, titles, "Service titles retrieved successfully");
  } catch (err) {
    next(err);
  }
}

async function createService(req, res, next) {
  try {
    const { title, description, items, image, alt } = req.body;
    if (!title || !description) {
      throw new AppError("Title and description are required", 400);
    }
    const service = await Service.create({
      title,
      description,
      items: items || [],
      image: image || "",
      alt: alt || "",
      isActive: true,
    });
    success(res, service, "Service created", 201);
  } catch (err) {
    next(err);
  }
}

async function seedData(req, res, next) {
  try {
    const { services: servicePayload = [] } = req.body || {};

    for (const svc of servicePayload) {
      await Service.findOneAndUpdate(
        { title: svc.title },
        { $setOnInsert: { ...svc, items: svc.items || [], isActive: true } },
        { upsert: true, new: true }
      );
    }

    success(res, { count: servicePayload.length }, "Seed completed", 201);
  } catch (err) {
    next(err);
  }
}

module.exports = { getServices, getServiceTitles, createService, seedData };
