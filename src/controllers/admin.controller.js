const User = require("../models/User");
const Appointment = require("../models/Appointment");
const Service = require("../models/Service");
const { AppError } = require("../middleware/errorHandler");
const { success } = require("../utils/response");

async function listServices(req, res, next) {
  try {
    const { status } = req.query; // all | active | deactivated
    const filter = {};
    if (status === "active") filter.isActive = true;
    else if (status === "deactivated") filter.isActive = false;
    // status=all or no param: return all (active + deactivated)

    const services = await Service.find(filter).sort({ createdAt: -1 }).lean();
    success(res, services, "Services retrieved successfully");
  } catch (err) {
    next(err);
  }
}

async function getServiceById(req, res, next) {
  try {
    const { id } = req.params;
    const service = await Service.findById(id).lean();
    if (!service) throw new AppError("Service not found", 404);
    success(res, service, "Service retrieved successfully");
  } catch (err) {
    next(err);
  }
}

async function createService(req, res, next) {
  try {
    const { title, description, items, image, alt, duration, price } = req.body;
   
    const service = await Service.create({
      title,
      description,
      items: items || [],
      image: image || "",
      alt: alt || "",
      duration: duration != null ? Number(duration) : 30,
      price: price != null && price !== "" ? Math.max(0, Number(price)) : 0,
      isActive: true,
    });
    success(res, service, "Service created", 201);
  } catch (err) {
    next(err);
  }
}

async function updateService(req, res, next) {
  try {
    const { id } = req.params;
    const { title, description, items, image, alt, isActive, duration, price } = req.body;

    const update = {};
    if (title !== undefined) update.title = title;
    if (description !== undefined) update.description = description;
    if (items !== undefined) update.items = items;
    if (image !== undefined) update.image = image;
    if (alt !== undefined) update.alt = alt;
    if (typeof isActive === "boolean") update.isActive = isActive;
    if (duration != null) update.duration = Number(duration);
    if (price !== undefined) update.price = Math.max(0, Number(price) || 0);

    const service = await Service.findByIdAndUpdate(id, update, { new: true });
    if (!service) throw new AppError("Service not found", 404);
    success(res, service, "Service updated");
  } catch (err) {
    next(err);
  }
}

async function deleteService(req, res, next) {
  try {
    const { id } = req.params;
    const service = await Service.findByIdAndDelete(id);
    if (!service) throw new AppError("Service not found", 404);
    success(res, { id }, "Service deleted");
  } catch (err) {
    next(err);
  }
}

async function seedServices(req, res, next) {
  try {
    const { services: servicePayload = [] } = req.body || {};
    for (const svc of servicePayload) {
      const { title, description, items, image, alt, duration, price } = svc;
      const priceNum = price != null && price !== "" ? Math.max(0, Number(price)) : 0;
      await Service.findOneAndUpdate(
        { title: title || svc.title },
        {
          $setOnInsert: {
            ...svc,
            items: svc.items || [],
            isActive: true,
            price: priceNum,
          },
        },
        { upsert: true, new: true }
      );
    }
    success(res, { count: servicePayload.length }, "Seed completed", 201);
  } catch (err) {
    next(err);
  }
}

async function listUsers(req, res, next) {
  try {
    const { page = 1, limit = 20, search, minWallet } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {};
    if (search) {
      filter.$or = [
        { mobile: new RegExp(search, "i") },
        { name: new RegExp(search, "i") },
        { email: new RegExp(search, "i") },
      ];
    }
    if (minWallet != null && minWallet !== "") {
      const n = Math.max(0, Number(minWallet));
      if (!Number.isNaN(n)) filter.wallet = { $gte: n };
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean()
        .then(async (users) => {
          const withCount = await Promise.all(
            users.map(async (u) => {
              const count = await Appointment.countDocuments({ userId: u._id });
              return {
                ...u,
                wallet: u.wallet != null && u.wallet !== "" ? Number(u.wallet) : 0,
                _count: { appointments: count },
              };
            })
          );
          return withCount;
        }),
      User.countDocuments(filter),
    ]);

    success(res, {
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    }, "Users retrieved successfully");
  } catch (err) {
    next(err);
  }
}

async function listAppointments(req, res, next) {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: new RegExp(search, "i") },
        { email: new RegExp(search, "i") },
        { mobile: new RegExp(search, "i") },
        { service: new RegExp(search, "i") },
      ];
    }

    const [appointments, total] = await Promise.all([
      Appointment.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("userId", "mobile countryCode name")
        .lean(),
      Appointment.countDocuments(filter),
    ]);

    success(res, {
      appointments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    }, "Appointments retrieved successfully");
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
  seedServices,
  listUsers,
  listAppointments,
};
