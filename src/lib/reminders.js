import { at, addDays, splitDateTime, toMinutes, fromMinutes } from "./dates.js";
import { isChecked, isLateArrival } from "./readiness.js";
import { destinationFor } from "../data/destinations.js";
import { checkinUrl } from "./links.js";

const HOUR = 3600000;

/** PRD §13 preparation timeline. `check` returns true when a task is complete. */
export function prepTimeline(trip) {
  const c = (id) => {
    const item = trip.checklist.find((x) => x.id === id);
    return item ? isChecked(trip, item) : false;
  };
  return [
    { days: 30, label: "30 days before", tasks: [["Check passport", c("passport")], ["Check visa requirements", c("visa")], ["Book flights", !!trip.flight?.booked], ["Book accommodation", !!trip.stay?.booked], ["Travel insurance", c("insurance")]] },
    { days: 14, label: "14 days before", tasks: [["Book activities", c("activities")], ["Book airport transfer", !!trip.transfer?.booked], ["Review itinerary", !!trip.reviewed]] },
    { days: 7, label: "7 days before", tasks: [["Currency", c("currency")], ["Clothing", c("clothes")], ["Medication", c("meds")], ["Adapter & chargers", c("adapter") && c("charger")]] },
    { days: 2, label: "2 days before", tasks: [["Confirm hotel", !!trip.stay?.booked], ["Confirm taxi / transfer", !!trip.transfer?.booked], ["Check airport terminal", !!trip.flight?.terminal]] },
    { days: 1, label: "24 hours before", tasks: [["Airline check-in", !!trip.flight?.checkedIn], ["Final packing", c("swimwear") || c("clothes")]] },
  ].map((m) => ({ ...m, date: addDays(trip.startDate, -m.days), done: m.tasks.every((t) => t[1]) }));
}

/** Contextual reminders (PRD §40–43, §65–66). Each has an absolute time. */
export function buildReminders(trip) {
  const dest = destinationFor(trip);
  const r = [];
  const add = (id, when, emoji, title, body, extra = {}) => r.push({ id, at: when, emoji, title, body, ...extra });
  const start = at(trip.startDate, "09:00");

  const flight = trip.flight?.booked && trip.flight.depart ? splitDateTime(trip.flight.depart) : null;
  const depart = flight ? at(flight.date, flight.time) : start;
  const route = `${trip.origin} → ${dest.city}`;

  add("week", new Date(depart - 7 * 24 * HOUR), "🗓️", `Your ${trip.destination} trip is one week away`, "Time to sort currency, packing and any open bookings.", { view: "checklist" });
  add("2days", new Date(depart - 48 * HOUR), "🧳", "Two days to go — review your checklist", "Confirm your hotel and transfer, and check your terminal.", { view: "checklist" });

  if (flight) {
    add("checkin", new Date(depart - 24 * HOUR), "✈️", "Online check-in is now available", `${trip.flight.airline || "Your airline"} ${trip.flight.number || ""} · ${route}`.trim(),
      { cta: { label: "Check in", href: checkinUrl(trip.flight.airline) }, done: !!trip.flight.checkedIn, action: "checkin" });
    add("6h", new Date(depart - 6 * HOUR), "⏱️", "Your flight departs in 6 hours", `Departs ${flight.time}${trip.flight.terminal ? ` · Terminal ${trip.flight.terminal}` : ""}.`);
    add("airport", new Date(depart - 3 * HOUR), "🛫", "Recommended airport arrival time", `Be at ${trip.originAirport || trip.origin} airport by ${fromMinutes(toMinutes(flight.time) - 180)} — 3 hours before departure.`);
  } else {
    add("book-flight", new Date(at(trip.startDate) - 30 * 24 * HOUR), "✈️", "You haven't added a flight yet", "Search flights or add the booking you already have.", { view: "bookings", done: false });
  }

  if (isLateArrival(trip) && !trip.transfer?.booked) {
    const arr = splitDateTime(trip.flight.arrive);
    add("late", new Date(depart - 5 * 24 * HOUR), "⚠️", "Late-night arrival", `Your flight arrives at ${arr.time}. We recommend arranging airport transportation before departure.`, { view: "bookings", urgent: true });
  }

  if (trip.stay?.booked) {
    add("hotel", at(addDays(trip.startDate, -1), "15:00"), "🏨", `Your ${trip.stay.type === "rental" ? "rental" : "hotel"} check-in is tomorrow`, `${trip.stay.name}${trip.stay.checkIn ? ` · Check-in ${trip.stay.checkIn}` : ""}${trip.stay.address ? ` · ${trip.stay.address}` : ""}`);
  }

  trip.itinerary.forEach((day, d) => {
    day.items.forEach((it) => {
      const when = at(day.date, it.time);
      if (it.category === "dental") {
        add(`${it.id}-24`, new Date(when - 24 * HOUR), "🦷", "Dental appointment tomorrow", `${it.title} at ${it.time}.`);
        add(`${it.id}-2`, new Date(when - 2 * HOUR), "🦷", "Your dental appointment starts in 2 hours", it.title);
        add(`${it.id}-30`, new Date(when - 0.5 * HOUR), "🚶", "Leave now to arrive on time", `${it.title} at ${it.time}.`);
      } else if (it.booked || ["adventure", "water"].includes(it.category)) {
        add(`${it.id}-2`, new Date(when - 2 * HOUR), cat(it), `${it.title} starts in 2 hours`, `Day ${d + 1} · ${it.time}`);
      }
    });
  });

  const ret = trip.returnFlight?.booked && trip.returnFlight.depart ? splitDateTime(trip.returnFlight.depart) : null;
  const retAt = ret ? at(ret.date, ret.time) : at(trip.endDate, "18:00");
  add("return", new Date(retAt - 24 * HOUR), "🏠", "Your flight home is tomorrow", "Check your flight status, complete check-in, confirm checkout time and arrange your airport transfer.");
  add("checkout", at(trip.endDate, "08:30"), "🏨", `Checkout is at ${trip.stay?.checkOut || "11:00"}`, ret ? `Leave for the airport by ${fromMinutes(toMinutes(ret.time) - 240)}.` : "Store luggage if your flight is later.");
  add("home", at(addDays(trip.endDate, 1), "10:00"), "🎉", "Welcome home!", "How was your trip? Rate your stay and activities.", { view: "overview" });

  return r.sort((a, b) => a.at - b.at);
}

const cat = (it) => ({ adventure: "🪂", water: "🚤", beach: "🏖️", nightlife: "🌃", food: "🍴" }[it.category] || "📍");

export function splitReminders(reminders, dismissed = [], now = new Date()) {
  const live = reminders.filter((x) => !dismissed.includes(x.id));
  return {
    due: live.filter((x) => x.at <= now && now - x.at < 3 * 24 * HOUR && !x.done),
    upcoming: live.filter((x) => x.at > now),
    past: live.filter((x) => x.at <= now && (now - x.at >= 3 * 24 * HOUR || x.done)),
  };
}
