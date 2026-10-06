// iCalendar (.ics) export for the whole trip — imports into Google, Apple and Outlook calendars.
// Times are "floating" (no time zone) because itinerary times are destination-local.
import { addDays, splitDateTime, toMinutes, fromMinutes } from "./dates.js";
import { destinationFor } from "../data/destinations.js";

const esc = (s = "") => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const stamp = (date, time = "00:00") => `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;

/** Lines longer than 75 octets must be folded (RFC 5545 §3.1). */
function fold(line) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out = [];
  let chunk = "";
  for (const ch of line) {
    if (new TextEncoder().encode(chunk + ch).length > (out.length ? 74 : 75)) {
      out.push(chunk);
      chunk = "";
    }
    chunk += ch;
  }
  out.push(chunk);
  return out.join("\r\n ");
}

function event({ uid, date, time, endDate, endTime, title, location, description }) {
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  return [
    "BEGIN:VEVENT",
    `UID:${uid}@journeyai`,
    `DTSTAMP:${now}`,
    `DTSTART:${stamp(date, time)}`,
    `DTEND:${stamp(endDate || date, endTime)}`,
    `SUMMARY:${esc(title)}`,
    location && `LOCATION:${esc(location)}`,
    description && `DESCRIPTION:${esc(description)}`,
    "END:VEVENT",
  ].filter(Boolean);
}

export function tripToIcs(trip) {
  const dest = destinationFor(trip);
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//JourneyAI//Trip//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${esc(`${trip.destination} trip`)}`];

  for (const [key, f] of [["out", trip.flight], ["ret", trip.returnFlight]]) {
    if (!f?.booked || !f.depart) continue;
    const dep = splitDateTime(f.depart);
    const arr = f.arrive ? splitDateTime(f.arrive) : { date: dep.date, time: fromMinutes(toMinutes(dep.time) + 180) };
    lines.push(...event({
      uid: `${trip.id}-${key}`,
      date: dep.date, time: dep.time, endDate: arr.date, endTime: arr.time,
      title: `✈️ ${f.airline || "Flight"} ${f.number || ""} ${f.from || ""}→${f.to || ""}`.replace(/\s+/g, " ").trim(),
      location: f.terminal ? `Terminal ${f.terminal}` : "",
      description: [f.ref && `Booking ref: ${f.ref}`, "Times are local to each airport."].filter(Boolean).join("\n"),
    }));
  }

  trip.itinerary.forEach((day, d) => {
    for (const it of day.items) {
      if (it.category === "flight") continue; // flights exported above
      const end = toMinutes(it.time) + (it.duration || 60);
      lines.push(...event({
        uid: `${trip.id}-${it.id}`,
        date: day.date,
        time: it.time,
        endDate: end >= 24 * 60 ? addDays(day.date, 1) : day.date,
        endTime: fromMinutes(end % (24 * 60)),
        title: it.title,
        location: it.address || (it.lat ? `${it.title}, ${day.area}, ${dest.name}` : ""),
        description: [`Day ${d + 1} — ${day.title}`, it.why, it.cost ? `Est. £${it.cost} per person` : "", it.booked ? "Booked" : "", it.mapsUri || it.website || ""].filter(Boolean).join("\n"),
      }));
    }
  });

  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function downloadIcs(trip) {
  const blob = new Blob([tripToIcs(trip)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: `${trip.destination.toLowerCase().replace(/\s+/g, "-")}-trip.ics` });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
