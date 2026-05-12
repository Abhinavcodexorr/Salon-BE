const User = require("../models/User");
const Appointment = require("../models/Appointment");
const Notification = require("../models/Notification");
const Service = require("../models/Service");
const WalletAdjustment = require("../models/WalletAdjustment");
const { AppError } = require("../middleware/errorHandler");
const { success } = require("../utils/response");
const {
  SIGNUP_BONUS,
  REFERRAL_BONUS,
  REFERRAL_BONUS_NOTE_PREFIX,
} = require("../services/referral.service");

/** Escapes regex specials so a string can be used safely inside `new RegExp(...)`. */
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
const {
  generateSlots,
  parseTimeToMinutes,
  minutesToTimeStr,
  overlaps,
  SLOT_INTERVAL,
} = require("../config/slots");
const { resolveSalonBookingWindow } = require("../services/salonAvailability.service");

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
          const referralNoteRegex = new RegExp(
            `^${escapeRegex(REFERRAL_BONUS_NOTE_PREFIX)}`,
            "i"
          );
          const [latestByUser, withCount, referralAgg] = await Promise.all([
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
            WalletAdjustment.aggregate([
              {
                $match: {
                  userId: { $in: userIds },
                  type: "credit",
                  note: { $regex: referralNoteRegex },
                },
              },
              {
                $group: {
                  _id: "$userId",
                  referralBonus: { $sum: "$amount" },
                  referralCount: { $sum: 1 },
                  lastReferralAt: { $max: "$createdAt" },
                },
              },
            ]),
          ]);
          const aptInfo = new Map(
            latestByUser.map((row) => [String(row._id), { name: row.name, email: row.email }])
          );
          const referralInfo = new Map(
            referralAgg.map((row) => [
              String(row._id),
              {
                referralBonus: Number(row.referralBonus || 0),
                referralCount: Number(row.referralCount || 0),
                lastReferralAt: row.lastReferralAt || null,
              },
            ])
          );
          return users.map((u, i) => {
            const fromApt = aptInfo.get(String(u._id));
            const profileName = u.name && String(u.name).trim();
            const profileEmail = u.email && String(u.email).trim();
            const ref = referralInfo.get(String(u._id));
            const referralBonus = ref ? ref.referralBonus : 0;
            const referralCount = ref ? ref.referralCount : 0;
            const lastReferralAt = ref ? ref.lastReferralAt : null;
            return {
              ...u,
              name: profileName || (fromApt?.name && String(fromApt.name).trim()) || null,
              email: profileEmail || (fromApt?.email && String(fromApt.email).trim().toLowerCase()) || null,
              wallet: u.wallet != null && u.wallet !== "" ? Number(u.wallet) : 0,
              _count: { appointments: withCount[i] },
              bonuses: {
                signupBonus: SIGNUP_BONUS,
                referralBonusPerInvite: REFERRAL_BONUS,
                referralBonus,
                referralCount,
                hasReferralBonus: referralBonus > 0,
                lastReferralAt,
                referred: Boolean(u.referredBy),
                referredInviteCode: u.referredInviteCode || null,
                referralRedeemedAt: u.referralRedeemedAt || null,
              },
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
    const [appointmentsCount, notificationCount, unreadAppointmentNotifications, readAppointmentNotifications] = await Promise.all([
      Appointment.countDocuments({}),
      Notification.countDocuments({ read: false }),
      Notification.countDocuments({ type: "appointment", read: false }),
      Notification.countDocuments({ type: "appointment", read: true }),
    ]);
    success(
      res,
      {
        appointmentsCount,
        appointmentCount: appointmentsCount,
        notificationCount,
        appointmentNotifications: {
          unread: unreadAppointmentNotifications,
          read: readAppointmentNotifications,
          total: unreadAppointmentNotifications + readAppointmentNotifications,
        },
      },
      "Counts retrieved successfully"
    );
  } catch (err) {
    next(err);
  }
}

/**
 * Marks notifications as read for admin panel counters.
 * Body:
 * - { type?: "appointment" | "system" } to mark all unread of a type (default: appointment)
 * - { notificationIds: string[] } to mark selected notifications
 */
async function markNotificationsRead(req, res, next) {
  try {
    const { notificationIds, type } = req.body || {};
    let filter;

    if (Array.isArray(notificationIds) && notificationIds.length > 0) {
      const validIds = notificationIds
        .map((id) => String(id).trim())
        .filter((id) => mongoose.Types.ObjectId.isValid(id));
      if (validIds.length === 0) {
        throw new AppError("notificationIds must contain valid ObjectIds", 400);
      }
      filter = { _id: { $in: validIds }, read: false };
    } else {
      const markType = type === "system" ? "system" : "appointment";
      filter = { type: markType, read: false };
    }

    const updateResult = await Notification.updateMany(filter, { $set: { read: true } });
    const modified = Number(updateResult.modifiedCount || 0);

    const [unread, read] = await Promise.all([
      Notification.countDocuments({ type: "appointment", read: false }),
      Notification.countDocuments({ type: "appointment", read: true }),
    ]);

    success(
      res,
      {
        updated: modified,
        appointmentNotifications: {
          unread,
          read,
          total: unread + read,
        },
      },
      "Notifications marked as read"
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

function buildGroupedServicesFromAppointment(appointment) {
  const rows = Array.isArray(appointment?.serviceSelections) ? appointment.serviceSelections : [];
  const grouped = new Map();

  for (const row of rows) {
    const serviceIdRaw = row?.serviceId;
    const serviceId = serviceIdRaw ? String(serviceIdRaw) : null;
    if (!serviceId) continue;
    const serviceName = String(row?.serviceName ?? "").trim() || null;
    const subName = String(row?.serviceItemName ?? "").trim();
    if (!grouped.has(serviceId)) {
      grouped.set(serviceId, {
        serviceId,
        serviceName,
        subServices: [],
      });
    }
    if (subName) {
      grouped.get(serviceId).subServices.push({
        name: subName,
        price: Math.max(0, Number(row?.price) || 0),
      });
    }
  }

  if (grouped.size > 0) return Array.from(grouped.values());

  // Legacy fallback when old rows don't have serviceSelections.
  if (appointment?.serviceId) {
    const serviceId = String(appointment.serviceId);
    const item = String(appointment?.serviceItemName ?? "").trim();
    return [
      {
        serviceId,
        serviceName: String(appointment?.serviceName ?? "").trim() || null,
        subServices: item
          ? [{ name: item, price: Math.max(0, Number(appointment?.totalAmount) || 0) }]
          : [],
      },
    ];
  }

  return [];
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
        .populate(
          "userId",
          "mobile countryCode name email wallet referredBy referredInviteCode referralRedeemedAt"
        )
        .lean(),
      Appointment.countDocuments(filter),
    ]);

    const userIds = [];
    const seen = new Set();
    for (const a of raw) {
      if (a.userId && typeof a.userId === "object" && a.userId._id) {
        const key = String(a.userId._id);
        if (!seen.has(key)) {
          seen.add(key);
          userIds.push(a.userId._id);
        }
      }
    }

    let referralInfo = new Map();
    if (userIds.length > 0) {
      const referralNoteRegex = new RegExp(
        `^${escapeRegex(REFERRAL_BONUS_NOTE_PREFIX)}`,
        "i"
      );
      const referralAgg = await WalletAdjustment.aggregate([
        {
          $match: {
            userId: { $in: userIds },
            type: "credit",
            note: { $regex: referralNoteRegex },
          },
        },
        {
          $group: {
            _id: "$userId",
            referralBonus: { $sum: "$amount" },
            referralCount: { $sum: 1 },
            lastReferralAt: { $max: "$createdAt" },
          },
        },
      ]);
      referralInfo = new Map(
        referralAgg.map((row) => [
          String(row._id),
          {
            referralBonus: Number(row.referralBonus || 0),
            referralCount: Number(row.referralCount || 0),
            lastReferralAt: row.lastReferralAt || null,
          },
        ])
      );
    }

    const appointments = raw.map((a) => {
      const groupedServices = buildGroupedServicesFromAppointment(a);
      const { serviceSelections, service, serviceId, ...rest } = a;
      if (!a.userId || typeof a.userId !== "object") {
        return {
          ...rest,
          services: groupedServices,
        };
      }
      const w = a.userId.wallet;
      const ref = referralInfo.get(String(a.userId._id));
      const referralBonus = ref ? ref.referralBonus : 0;
      const referralCount = ref ? ref.referralCount : 0;
      const lastReferralAt = ref ? ref.lastReferralAt : null;
      return {
        ...rest,
        userId: {
          ...a.userId,
          wallet: w != null && w !== "" ? Number(w) : 0,
          bonuses: {
            signupBonus: SIGNUP_BONUS,
            referralBonusPerInvite: REFERRAL_BONUS,
            referralBonus,
            referralCount,
            hasReferralBonus: referralBonus > 0,
            lastReferralAt,
            referred: Boolean(a.userId.referredBy),
            referredInviteCode: a.userId.referredInviteCode || null,
            referralRedeemedAt: a.userId.referralRedeemedAt || null,
          },
        },
        services: groupedServices,
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

function isValidYmd(str) {
  if (typeof str !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(`${str}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === str;
}

function addDaysYmd(ymd, days) {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function getAppointmentsOverview(req, res, next) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const fromDate = String(req.query.fromDate || today).trim();
    const toDate = String(req.query.toDate || addDaysYmd(fromDate, 14)).trim();

    if (!isValidYmd(fromDate) || !isValidYmd(toDate)) {
      throw new AppError("fromDate and toDate must be YYYY-MM-DD", 400);
    }
    if (fromDate > toDate) {
      throw new AppError("fromDate must be less than or equal to toDate", 400);
    }

    const [{ from: openFrom, to: openTo }, appointments] = await Promise.all([
      resolveSalonBookingWindow(),
      Appointment.find({
        date: { $gte: fromDate, $lte: toDate },
        status: { $nin: ["cancelled"] },
      })
        .sort({ date: 1, time: 1, createdAt: 1 })
        .lean(),
    ]);

    const allSlots = generateSlots(openFrom, openTo);
    const closeMins = parseTimeToMinutes(openTo);
    const byDate = new Map();
    const dates = [];
    for (let d = fromDate; d <= toDate; d = addDaysYmd(d, 1)) {
      byDate.set(d, []);
      dates.push(d);
    }
    for (const apt of appointments) {
      if (!byDate.has(apt.date)) continue;
      byDate.get(apt.date).push(apt);
    }

    const overview = dates.map((date) => {
      const dayApts = byDate.get(date) || [];
      const booked = dayApts
        .filter((a) => a.time)
        .map((a) => {
          const startMins = parseTimeToMinutes(a.time);
          const dur = Math.max(1, Number(a.duration) || 30);
          const endMins = startMins + dur;
          return {
            appointmentId: String(a._id),
            start: a.time,
            end: minutesToTimeStr(endMins),
            duration: dur,
            customerName: a.name,
            service: a.service || "",
          };
        });

      const availableSlots = allSlots.filter((slot) => {
        const slotStart = parseTimeToMinutes(slot);
        const slotEnd = slotStart + SLOT_INTERVAL;
        if (slotEnd > closeMins) return false;
        return !booked.some((b) =>
          overlaps(slotStart, slotEnd, parseTimeToMinutes(b.start), parseTimeToMinutes(b.end))
        );
      });

      return {
        date,
        booked,
        availableSlots,
      };
    });

    success(
      res,
      {
        fromDate,
        toDate,
        salonHours: { from: openFrom, to: openTo, slotIntervalMinutes: SLOT_INTERVAL },
        dates: overview,
      },
      "Appointments overview retrieved successfully"
    );
  } catch (err) {
    next(err);
  }
}

async function getBookedSlots(req, res, next) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const fromDate = String(req.query.fromDate || today).trim();
    const toDate = String(req.query.toDate || addDaysYmd(fromDate, 14)).trim();

    if (!isValidYmd(fromDate) || !isValidYmd(toDate)) {
      throw new AppError("fromDate and toDate must be YYYY-MM-DD", 400);
    }
    if (fromDate > toDate) {
      throw new AppError("fromDate must be less than or equal to toDate", 400);
    }

    const appointments = await Appointment.find({
      date: { $gte: fromDate, $lte: toDate },
      status: { $nin: ["cancelled"] },
      time: { $exists: true, $ne: null },
    })
      .sort({ date: 1, time: 1, createdAt: 1 })
      .lean();

    const bookedSlots = appointments.map((a) => {
      const start = String(a.time).trim();
      const duration = Math.max(1, Number(a.duration) || 30);
      const end = minutesToTimeStr(parseTimeToMinutes(start) + duration);
      return {
        date: a.date,
        start,
        end,
      };
    });

    success(res, { bookedSlots }, "Booked slots retrieved successfully");
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
  getAppointmentsOverview,
  getBookedSlots,
  getAdminCounts,
  markNotificationsRead,
  getDashboard,
};
