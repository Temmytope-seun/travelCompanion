// Maps bookings extracted from confirmation emails onto a trip (PRD §59–60).
import { daysBetween, toMinutes, today } from "./dates.js";
import { generateItinerary, uid } from "./itinerary.js";

const EXPENSE_CAT = { flight: "Flights", accommodation: "Hotel", transfer: "Taxi", activity: "Activities", restaurant: "Food", dental: "Dental", other: "Other" };

/** Which part of the trip a booking will update, in plain words (shown before applying). */
export function describeTarget(trip, b) {
  if (b.kind === "flight") return isReturn(trip, b) ? "Return flight" : "Outbound flight";
  if (b.kind === "accommodation") return "Accommodation";
  if (b.kind === "transfer") return "Airport transfer";
  const d = dayIndex(trip, b.date);
  return d >= 0 ? `Day ${d + 1}${b.time ? ` at ${b.time}` : ""}` : "Outside your trip dates — will be skipped";
}

const isReturn = (trip, b) => !!b.date && daysBetween(trip.startDate, b.date) > Math.max(1, daysBetween(trip.startDate, trip.endDate) / 2);
const dayIndex = (trip, date) => (date ? trip.itinerary.findIndex((d) => d.date === date) : -1);
const dt = (date, time) => (date ? `${date}T${time || "00:00"}` : "");

function toGbp(amount, currency, rates) {
  if (amount == null) return null;
  const code = (currency || "GBP").toUpperCase();
  if (code === "GBP") return amount;
  const rate = rates?.[code];
  return rate ? amount / rate : null;
}

/**
 * Returns the trip with the selected bookings applied, plus a summary.
 * Flights change the plan's anchor times, so the itinerary is rebuilt before activities are added.
 */
export function applyBookings(trip, bookings, { addExpenses = true, rates } = {}) {
  let next = { ...trip };
  const summary = [];
  const skipped = [];
  let flightChanged = false;

  for (const b of bookings) {
    if (b.kind === "flight") {
      const key = isReturn(next, b) ? "returnFlight" : "flight";
      next[key] = {
        ...next[key],
        booked: true,
        airline: b.airline || b.provider || next[key]?.airline || "",
        number: b.flight_number || next[key]?.number || "",
        from: b.from_airport || "",
        to: b.to_airport || "",
        depart: dt(b.date, b.time),
        arrive: dt(b.end_date || b.date, b.end_time),
        terminal: b.terminal || next[key]?.terminal || "",
        ref: b.reference || next[key]?.ref || "",
      };
      flightChanged = true;
      summary.push(`${key === "flight" ? "Outbound" : "Return"} flight ${next[key].number || ""}`.trim());
    } else if (b.kind === "accommodation") {
      next.stay = {
        ...next.stay, booked: true,
        name: b.provider || b.title, address: b.location || next.stay?.address || "",
        checkIn: b.time || next.stay?.checkIn || "15:00", checkOut: b.end_time || next.stay?.checkOut || "11:00",
        ref: b.reference || "",
      };
      summary.push(`Accommodation: ${next.stay.name}`);
    } else if (b.kind === "transfer") {
      next.transfer = { ...next.transfer, booked: true, provider: b.provider || "", ref: b.reference || "" };
      summary.push("Airport transfer");
    }
  }

  if (flightChanged) next.itinerary = generateItinerary(next);

  for (const b of bookings) {
    if (["flight", "accommodation", "transfer"].includes(b.kind)) continue;
    const d = dayIndex(next, b.date);
    if (d < 0) {
      skipped.push(`${b.title} (${b.date || "no date"})`);
      continue;
    }
    const total = toGbp(b.cost, b.currency, rates);
    const end = b.end_time && b.time ? toMinutes(b.end_time) - toMinutes(b.time) : null;
    const item = {
      id: uid(),
      time: b.time || "12:00",
      duration: b.duration_minutes || (end > 0 ? end : 90),
      title: b.title,
      category: b.category && b.category !== "flight" ? b.category : "free",
      cost: total ? Math.round(total / Math.max(next.travellers, 1)) : 0,
      booked: true,
      why: [b.provider, b.reference && `Ref ${b.reference}`, b.notes].filter(Boolean).join(" · "),
      address: b.location || undefined,
    };
    next.itinerary = next.itinerary.map((day, i) => (i === d ? { ...day, items: [...day.items, item].sort((x, y) => toMinutes(x.time) - toMinutes(y.time)) } : day));
    summary.push(`${b.title} → Day ${d + 1}`);
  }

  if (addExpenses) {
    const payer = next.people?.[0] || "You";
    const added = bookings
      .map((b) => ({ b, gbp: toGbp(b.cost, b.currency, rates) }))
      .filter(({ b, gbp }) => gbp && (["flight", "accommodation", "transfer"].includes(b.kind) || dayIndex(next, b.date) >= 0))
      .map(({ b, gbp }) => ({ id: uid(), label: b.title, amount: Math.round(gbp * 100) / 100, category: EXPENSE_CAT[b.kind] || "Other", paidBy: payer, date: today() }));
    if (added.length) {
      next.expenses = [...(next.expenses || []), ...added];
      summary.push(`${added.length} cost${added.length === 1 ? "" : "s"} added to expenses`);
    }
  }

  return { trip: next, summary, skipped, flightChanged };
}

