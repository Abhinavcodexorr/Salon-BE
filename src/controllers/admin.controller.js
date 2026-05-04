const User = require("../models/User");
const Appointment = require("../models/Appointment");
const Notification = require("../models/Notification");
const Service = require("../models/Service");
const { AppError } = require("../middleware/errorHandler");
const { success } = require("../utils/response");

/**
 * Normalizes admin payload: each block has `subheading`, optional block `duration` or `time` (minutes),
 * and `items: [{ name, price, time }]` — `time` is minutes; legacy `duration` on a line is accepted too.
 */
function normalizeSubheadings(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((block) => {
      const subheading = String(block.subheading ?? block.title ?? "").trim();
      const blockRawMin =
        block.duration != null && block.duration !== ""
          ? block.duration
          : block.time != null && block.time !== ""
            ? block.time
            : null;
      const blockN = blockRawMin != null ? Number(blockRawMin) : NaN;
      const blockDuration =
        Number.isFinite(blockN) && blockN >= 1 ? Math.floor(blockN) : undefined;

      const itemsRaw = block.items;
      const items = Array.isArray(itemsRaw)
        ? itemsRaw
            .map((line) => {
              const name = String(line.name ?? "").trim();
              const price = Math.max(0, Number(line.price) || 0);
              const rawMin =
                line.time != null && line.time !== ""
                  ? line.time
                  : line.duration != null && line.duration !== ""
                    ? line.duration
                    : null;
              const n = rawMin != null ? Number(rawMin) : NaN;
              const time = Number.isFinite(n) && n >= 1 ? Math.floor(n) : undefined;
              const out = { name, price };
              if (time !== undefined) out.time = time;
              return out;
            })
            .filter((line) => line.name.length > 0)
        : [];
      if (!subheading) return null;
      const out = { subheading, items };
      if (blockDuration !== undefined) out.duration = blockDuration;
      return out;
    })
    .filter(Boolean);
}

function assertValidServiceMenu(heading, subheadings) {
  if (!heading) throw new AppError("heading is required", 400);
  if (subheadings.length === 0) {
    throw new AppError("At least one subheading block is required", 400);
  }
  for (let i = 0; i < subheadings.length; i += 1) {
    const block = subheadings[i];
    if (!block.items || block.items.length === 0) {
      throw new AppError(`Each subheading must have at least one priced item (block ${i + 1})`, 400);
    }
    for (let j = 0; j < block.items.length; j += 1) {
      const it = block.items[j];
      const mins = it.time ?? it.duration;
      if (mins == null || !Number.isFinite(Number(mins)) || Number(mins) < 1) {
        throw new AppError(
          `Each item must include "time" (minutes, number ≥ 1) — block ${i + 1}, item ${j + 1} (“${it.name || "unnamed"}”)`,
          400
        );
      }
    }
  }
}

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
    const {
      heading: headingRaw,
      subheadings: subRaw,
      title,
      description,
      items,
      image,
      alt,
      duration,
      price,
    } = req.body;

    const heading = String(headingRaw ?? title ?? "").trim();
    const subheadings = normalizeSubheadings(subRaw);
    assertValidServiceMenu(heading, subheadings);

    const service = await Service.create({
      heading,
      subheadings,
      title: heading,
      description: description != null ? description : "",
      items: Array.isArray(items) ? items : [],
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
    const {
      heading: headingRaw,
      subheadings: subRaw,
      title,
      description,
      items,
      image,
      alt,
      isActive,
      duration,
      price,
    } = req.body;

    const update = {};
    if (description !== undefined) update.description = description;
    if (items !== undefined) update.items = items;
    if (image !== undefined) update.image = image;
    if (alt !== undefined) update.alt = alt;
    if (typeof isActive === "boolean") update.isActive = isActive;
    if (duration != null) update.duration = Number(duration);
    if (price !== undefined) update.price = Math.max(0, Number(price) || 0);

    if (headingRaw !== undefined || title !== undefined || subRaw !== undefined) {
      const existing = await Service.findById(id).lean();
      if (!existing) throw new AppError("Service not found", 404);

      const nextHeading =
        headingRaw !== undefined || title !== undefined
          ? String(headingRaw ?? title ?? existing.heading ?? existing.title ?? "").trim()
          : String(existing.heading || existing.title || "").trim();

      const nextSub =
        subRaw !== undefined ? normalizeSubheadings(subRaw) : normalizeSubheadings(existing.subheadings);

      assertValidServiceMenu(nextHeading, nextSub);
      update.heading = nextHeading;
      update.subheadings = nextSub;
      update.title = nextHeading;
    }

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
      const subheadings = normalizeSubheadings(svc.subheadings);
      const heading = String(svc.heading ?? svc.title ?? "").trim();
      const legacyTitle = String(svc.title ?? "").trim();
      const matchKey = heading || legacyTitle;
      if (!matchKey) continue;

      const priceNum = svc.price != null && svc.price !== "" ? Math.max(0, Number(svc.price)) : 0;
      const durationNum = svc.duration != null ? Number(svc.duration) : 30;

      const setDoc = {
        description: svc.description,
        items: Array.isArray(svc.items) ? svc.items : [],
        image: svc.image || "",
        alt: svc.alt || "",
        isActive: true,
        price: priceNum,
        duration: durationNum,
      };

      if (heading && subheadings.length > 0) {
        setDoc.heading = heading;
        setDoc.subheadings = subheadings;
        setDoc.title = heading;
      } else {
        setDoc.title = legacyTitle || heading;
        if (heading) setDoc.heading = heading;
      }

      await Service.findOneAndUpdate(
        { $or: [{ heading: matchKey }, { title: matchKey }] },
        { $setOnInsert: setDoc },
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
          if (users.length === 0) return [];
          const userIds = users.map((u) => u._id);
          const [latestByUser, withCount] = await Promise.all([
            Appointment.aggregate([
              { $match: { userId: { $in: userIds } } },
              { $sort: { createdAt: -1 } },
              {
                $group: {
                  _id: "$userId",
                  name: { $first: "$name" },
                  email: { $first: "$email" },
                },
              },
            ]),
            Promise.all(
              users.map(async (u) => {
                const count = await Appointment.countDocuments({ userId: u._id });
                return count;
              })
            ),
          ]);
          const aptInfo = new Map(
            latestByUser.map((row) => [String(row._id), { name: row.name, email: row.email }])
          );
          return users.map((u, i) => {
            const fromApt = aptInfo.get(String(u._id));
            const profileName = u.name && String(u.name).trim();
            const profileEmail = u.email && String(u.email).trim();
            return {
              ...u,
              name: profileName || (fromApt?.name && String(fromApt.name).trim()) || null,
              email: profileEmail || (fromApt?.email && String(fromApt.email).trim().toLowerCase()) || null,
              wallet: u.wallet != null && u.wallet !== "" ? Number(u.wallet) : 0,
              _count: { appointments: withCount[i] },
            };
          });
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

/** Header notification bell + badge: total appointments + unread customer notifications (admin JWT). */
async function getAdminCounts(req, res, next) {
  try {
    const [appointmentsCount, notificationCount] = await Promise.all([
      Appointment.countDocuments({}),
      Notification.countDocuments({ read: false }),
    ]);
    success(
      res,
      {
        appointmentsCount,
        appointmentCount: appointmentsCount,
        notificationCount,
      },
      "Counts retrieved successfully"
    );
  } catch (err) {
    next(err);
  }
}

/**
 * Dashboard KPIs (admin JWT). Services = documents still in DB (delete removes rows; no soft-delete field).
 */
async function getDashboard(req, res, next) {
  try {
    const [servicesCount, appointmentsCount, customersCount] = await Promise.all([
      Service.countDocuments({}),
      Appointment.countDocuments({}),
      User.countDocuments({}),
    ]);
    success(
      res,
      {
        servicesCount,
        appointmentsCount,
        customersCount,
      },
      "Dashboard retrieved successfully"
    );
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

    const [raw, total] = await Promise.all([
      Appointment.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("userId", "mobile countryCode name email wallet")
        .lean(),
      Appointment.countDocuments(filter),
    ]);

    const appointments = raw.map((a) => {
      if (!a.userId || typeof a.userId !== "object") return a;
      const w = a.userId.wallet;
      return {
        ...a,
        userId: {
          ...a.userId,
          wallet: w != null && w !== "" ? Number(w) : 0,
        },
      };
    });

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
  getAdminCounts,
  getDashboard,
};
