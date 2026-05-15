const { DateTime } = require("luxon");

function extractStartTime(rawTime) {
  const value = String(rawTime || "").trim();
  if (!value) return null;
  const first = value.split("-")[0].trim();
  if (!/^\d{1,2}:\d{2}$/.test(first)) return null;
  const [h, m] = first.split(":").map(Number);
  if (!Number.isFinite(h) || h < 0 || h > 23 || !Number.isFinite(m) || m < 0 || m > 59) {
    return null;
  }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseAppointmentStart(dateYmd, timeRaw, timeZone) {
  const date = String(dateYmd || "").trim();
  const startTime = extractStartTime(timeRaw);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !startTime) return null;

  const dt = DateTime.fromFormat(`${date} ${startTime}`, "yyyy-MM-dd HH:mm", {
    zone: timeZone,
  });
  return dt.isValid ? dt : null;
}

function ymdRangeAround(nowDt, daysBefore = 1, daysAfter = 3) {
  const dates = [];
  for (let i = -daysBefore; i <= daysAfter; i += 1) {
    dates.push(nowDt.plus({ days: i }).toFormat("yyyy-MM-dd"));
  }
  return [...new Set(dates)];
}

module.exports = {
  extractStartTime,
  parseAppointmentStart,
  ymdRangeAround,
};
