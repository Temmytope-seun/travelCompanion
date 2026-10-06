import { splitDateTime, toMinutes } from "./dates.js";
import { isActivity } from "./itinerary.js";

/** Whether a checklist item is ticked, reading linked items from trip state. */
export function isChecked(trip, item) {
  switch (item.link) {
    case "flight": return !!trip.flight?.booked;
    case "stay": return !!trip.stay?.booked;
    case "transfer": return !!trip.transfer?.booked;
    case "checkin": return !!trip.flight?.checkedIn;
    default: return !!item.done;
  }
}

export function isLateArrival(trip) {
  if (!trip.flight?.booked || !trip.flight.arrive) return false;
  const m = toMinutes(splitDateTime(trip.flight.arrive).time);
  return m < 6 * 60 || m >= 23 * 60;
}

const checked = (trip, id) => {
  const item = trip.checklist.find((c) => c.id === id);
  return item ? isChecked(trip, item) : false;
};

/** PRD §63 Travel Readiness Score — weighted essentials plus overall checklist progress. */
export function readiness(trip) {
  const activities = trip.itinerary.flatMap((d) => d.items).filter(isActivity);
  const bookedActs = activities.filter((a) => a.booked).length;
  const essentials = [
    { id: "flight", label: "Flight", weight: 18, status: trip.flight?.booked ? "done" : "todo", view: "bookings", action: "Book your flight" },
    { id: "stay", label: "Accommodation", weight: 18, status: trip.stay?.booked ? "done" : "todo", view: "bookings", action: "Choose a hotel or rental" },
    {
      id: "transfer", label: "Airport transfer", weight: 10,
      status: trip.transfer?.booked ? "done" : isLateArrival(trip) ? "urgent" : "todo",
      view: "bookings", action: isLateArrival(trip) ? "Book airport transfer — late arrival" : "Arrange airport transfer",
    },
    { id: "passport", label: "Passport", weight: 10, status: checked(trip, "passport") ? "done" : "todo", view: "checklist", action: "Check passport validity" },
    { id: "visa", label: "Entry requirements", weight: 8, status: checked(trip, "visa") ? "done" : "todo", view: "checklist", action: "Check visa / entry requirements" },
    { id: "insurance", label: "Travel insurance", weight: 10, status: checked(trip, "insurance") ? "done" : "todo", view: "checklist", action: "Arrange travel insurance" },
    { id: "currency", label: "Currency", weight: 8, status: checked(trip, "currency") ? "done" : "todo", view: "budget", action: "Sort out local currency" },
    {
      id: "activities", label: "Activities", weight: 8,
      status: checked(trip, "activities") || (activities.length && bookedActs >= Math.min(2, activities.length)) ? "done" : activities.length ? "partial" : "todo",
      view: "itinerary", action: "Book your key activities",
    },
    { id: "checkin", label: "Online check-in", weight: 10, status: trip.flight?.checkedIn ? "done" : "todo", view: "bookings", action: "Complete online check-in" },
  ];
  const earned = essentials.reduce((s, e) => s + (e.status === "done" ? e.weight : e.status === "partial" ? e.weight / 2 : 0), 0);
  const listDone = trip.checklist.filter((c) => isChecked(trip, c)).length;
  const listPct = trip.checklist.length ? listDone / trip.checklist.length : 0;
  const score = Math.round(earned * 0.8 + listPct * 100 * 0.2);
  const order = { urgent: 0, todo: 1, partial: 2, done: 3 };
  const open = essentials.filter((e) => e.status !== "done").sort((a, b) => order[a.status] - order[b.status]);
  return { score, essentials, open, next: open[0] || null, listDone, listTotal: trip.checklist.length };
}
