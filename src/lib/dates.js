// Dates are stored as "YYYY-MM-DD" strings and times as "HH:MM" in destination-local time.

const DAY = 86400000;

export function parseDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(str, n) {
  const d = parseDate(str);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export function today() {
  return toDateStr(new Date());
}

export function daysBetween(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / DAY);
}

export function dateRange(start, end) {
  const n = Math.max(0, Math.min(daysBetween(start, end), 20));
  return Array.from({ length: n + 1 }, (_, i) => addDays(start, i));
}

export function toMinutes(time) {
  if (!time) return 0;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function fromMinutes(min) {
  const clamped = Math.max(0, Math.min(min, 23 * 60 + 59));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function at(dateStr, time = "00:00") {
  const d = parseDate(dateStr);
  const [h, m] = time.split(":").map(Number);
  d.setHours(h, m || 0, 0, 0);
  return d;
}

/** Splits a datetime-local value ("2026-10-13T20:30") into { date, time }. */
export function splitDateTime(value) {
  if (!value) return { date: "", time: "" };
  const [date, time = "00:00"] = value.split("T");
  return { date, time: time.slice(0, 5) };
}

export function fmtDay(str, opts = { weekday: "short", day: "numeric", month: "short" }) {
  if (!str) return "";
  return parseDate(str).toLocaleDateString("en-GB", opts);
}

export function fmtRange(start, end) {
  const a = parseDate(start);
  const b = parseDate(end);
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  const left = a.toLocaleDateString("en-GB", sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" });
  const right = b.toLocaleDateString("en-GB", { day: "numeric", month: sameMonth ? "long" : "short" });
  return `${left} – ${right}`;
}

export function fmtTime(time) {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function relative(date, now = new Date()) {
  const diff = date - now;
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const hours = Math.round(abs / 3600000);
  const days = Math.round(abs / DAY);
  let label;
  if (mins < 60) label = `${mins} min`;
  else if (hours < 36) label = `${hours} h`;
  else label = `${days} days`;
  return diff >= 0 ? `in ${label}` : `${label} ago`;
}
