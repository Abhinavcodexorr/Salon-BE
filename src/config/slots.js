/**
 * Time slot configuration - 30 min intervals.
 * Booking window is salon-wide (not per service). Override with env if needed.
 */

const SLOT_INTERVAL = 30; // minutes
const DEFAULT_START = "09:00";
const DEFAULT_END = "18:00";

/** HH:mm — same window for all services; services only differ by duration. */
function getSalonBookingWindow() {
  return {
    from: process.env.SALON_AVAILABLE_FROM || DEFAULT_START,
    to: process.env.SALON_AVAILABLE_TO || DEFAULT_END,
  };
}

function parseTimeToMinutes(str) {
  const [h, m] = str.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTimeStr(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Generate all time slots between start and end
 * @param {string} start - e.g. "09:00"
 * @param {string} end - e.g. "18:00"
 * @returns {string[]} - ["09:00", "09:30", "10:00", ...]
 */
function generateSlots(start = DEFAULT_START, end = DEFAULT_END) {
  const startMins = parseTimeToMinutes(start);
  const endMins = parseTimeToMinutes(end);
  const slots = [];

  for (let m = startMins; m < endMins; m += SLOT_INTERVAL) {
    slots.push(minutesToTimeStr(m));
  }

  return slots;
}

/**
 * Get end time in minutes for a slot start + duration
 */
function getSlotEndMinutes(slotStartStr, durationMins) {
  const startMins = parseTimeToMinutes(slotStartStr);
  return startMins + durationMins;
}

/**
 * Check if two time ranges overlap
 * (start1, end1) and (start2, end2) in minutes
 */
function overlaps(start1, end1, start2, end2) {
  return start1 < end2 && end1 > start2;
}

module.exports = {
  SLOT_INTERVAL,
  DEFAULT_START,
  DEFAULT_END,
  getSalonBookingWindow,
  generateSlots,
  parseTimeToMinutes,
  minutesToTimeStr,
  getSlotEndMinutes,
  overlaps,
};
