import { catalogFor } from "../data/destinations.js";
import { dateRange, toMinutes, fromMinutes, splitDateTime } from "./dates.js";

export const uid = () => Math.random().toString(36).slice(2, 10);

const roundUp15 = (m) => Math.ceil(m / 15) * 15;
const isMeal = (item) => item.meal || item.category === "food" || item.category === "cafe";
const isActivity = (item) => !item.fixed && !isMeal(item) && !["transport", "stay", "flight", "packing"].includes(item.category);

/** Personalisation score (PRD §57): interest match + popularity + budget fit + group fit. */
export function scorePlace(place, trip) {
  const tags = place.tags || [];
  const match = tags.filter((t) => trip.interests.includes(t)).length + (trip.interests.includes(place.category) ? 1 : 0);
  const capPerActivity = trip.budget ? (trip.budget / Math.max(trip.travellers, 1)) * 0.12 : 60;
  const budgetFit = (place.cost || 0) <= capPerActivity ? 1 : -2;
  const groupFit = trip.party === "family" && tags.includes("family") ? 1 : 0;
  return match * 3 + (place.popularity || 0) + budgetFit + groupFit;
}

export function matchPercent(place, trip) {
  const s = scorePlace(place, trip);
  return Math.max(35, Math.min(98, Math.round(38 + s * 3.4)));
}

/** Why a place was recommended, in plain words (PRD §87). */
export function reasonFor(place, trip) {
  const matched = (place.tags || []).filter((t) => trip.interests.includes(t));
  if (!matched.length) return "Popular with travellers and close to your other plans.";
  const list = matched.slice(0, 2).join(" + ");
  return `Recommended because you selected ${list}.`;
}

function eligible(place, trip) {
  if (place.category === "dental") return trip.interests.includes("dental");
  if (place.category === "wellness" && place.cost > 0) return trip.interests.includes("wellness");
  if (place.category === "shopping") return trip.interests.includes("shopping");
  if (place.category === "beach" || place.category === "water") {
    return ["beach", "water", "adventure", "family", "wellness"].some((i) => trip.interests.includes(i)) || place.popularity >= 5;
  }
  const match = (place.tags || []).some((t) => trip.interests.includes(t));
  return match || place.popularity >= 4;
}

export function placeToItem(place, time) {
  return {
    id: uid(),
    time,
    duration: place.duration || 60,
    title: place.name,
    category: place.meal ? "food" : place.category,
    placeId: place.id,
    cost: place.cost || 0,
    lat: place.lat,
    lng: place.lng,
    outdoor: !!place.outdoor,
    meal: place.meal,
    why: place.why,
    search: place.search,
  };
}

const simpleItem = (time, title, category, duration, extra = {}) => ({ id: uid(), time, title, category, duration, cost: 0, ...extra });

export function generateItinerary(trip) {
  const { dest, places, food } = catalogFor(trip);
  const dates = dateRange(trip.startDate, trip.endDate);
  const has = (id) => trip.interests.includes(id);
  const areaNames = Object.keys(dest.areas);
  const base = areaNames[0];
  const coastal = areaNames.find((a) => dest.areas[a].coastal);
  const wantsCoast = coastal && ["beach", "water", "adventure"].some(has);
  const coastalDays = new Set();
  if (wantsCoast && dates.length >= 2) {
    coastalDays.add(dates.length >= 3 ? 1 : dates.length - 1);
    if (dates.length >= 6) coastalDays.add(4);
  }

  const used = new Set();
  const out = trip.flight?.booked ? splitDateTime(trip.flight.arrive) : null;
  const ret = trip.returnFlight?.booked ? splitDateTime(trip.returnFlight.depart) : null;
  const hotel = trip.stay?.booked && trip.stay.name ? trip.stay.name : "your accommodation";
  const n = dates.length;
  const pace = trip.pace || "balanced";
  const late = !!trip.wakeLate;

  return dates.map((date, i) => {
    const area = coastalDays.has(i) ? coastal : base;
    const items = [];
    let dayStart = late ? 600 : 540;
    let dayEnd = 23 * 60 + 30;

    if (i === 0) {
      if (out?.date === date) {
        const arr = toMinutes(out.time);
        items.push(simpleItem(out.time, `Arrive at ${dest.airport.name}`, "flight", 30, { fixed: true, lat: dest.airport.lat, lng: dest.airport.lng }));
        items.push(simpleItem(fromMinutes(roundUp15(arr + 35)), "Airport transfer to accommodation", "transport", 45, { fixed: true, transfer: true }));
        items.push(simpleItem(fromMinutes(roundUp15(arr + 85)), `Check in — ${hotel}`, "stay", 30, { fixed: true, lat: dest.center.lat - 0.003, lng: dest.center.lng - 0.001 }));
        dayStart = arr < 6 * 60 ? 630 : roundUp15(arr + 130);
      } else {
        items.push(simpleItem("12:00", `Arrive & check in — ${hotel}`, "stay", 60, { fixed: true, lat: dest.center.lat - 0.003, lng: dest.center.lng - 0.001 }));
        dayStart = 13 * 60 + 15;
      }
    }

    if (i === n - 1 && n > 1) {
      items.push(simpleItem("11:00", "Check out & store luggage", "stay", 30, { fixed: true }));
      if (ret?.date === date) {
        const dep = toMinutes(ret.time);
        items.push(simpleItem(fromMinutes(dep - 240), "Transfer to the airport", "transport", 60, { fixed: true, transfer: true }));
        items.push(simpleItem(ret.time, `Flight home — ${trip.returnFlight.number || "departure"}`, "flight", 30, { fixed: true, lat: dest.airport.lat, lng: dest.airport.lng }));
        dayEnd = dep - 260;
      } else {
        items.push(simpleItem("18:00", "Head to the airport", "transport", 60, { fixed: true, transfer: true }));
        dayEnd = 17 * 60 + 30;
      }
    }

    // Slot template, thinned by pace (PRD §86 "lazy day" → lower density).
    const lateArrivalDay = i === 0 && out?.date === date && toMinutes(out.time) < 6 * 60;
    const dayPace = lateArrivalDay ? "relaxed" : pace;
    const keep = { packed: [600, 690, 720, 900, 1035], balanced: [600, 690, 900, 1035], relaxed: [600, 690, 900] }[dayPace];
    const slots = (late
      ? [[600, "breakfast"], [690, "act"], [810, "lunch"], [900, "act"], [1035, "act"], [1170, "dinner"], [1305, "evening"]]
      : [[540, "breakfast"], [600, "act"], [720, "act"], [810, "lunch"], [900, "act"], [1035, "act"], [1170, "dinner"], [1305, "evening"]]
    ).filter(([t, k]) => k !== "act" || keep.includes(t));

    const coastalDay = area !== base;
    const travel = coastalDay ? dest.areas[area].fromBase || 45 : 0;
    if (coastalDay) dayEnd = Math.min(dayEnd, 23 * 60 - travel);

    // Start time that avoids fixed blocks (check-in, checkout, transfers), or null if the day is full.
    const fit = (t, dur) => {
      const blocks = items.filter((it) => it.fixed).map((it) => [toMinutes(it.time), toMinutes(it.time) + it.duration]);
      let s = t;
      for (let moved = true; moved;) {
        moved = false;
        for (const [a, b] of blocks) if (s < b && s + dur > a) { s = roundUp15(b + 10); moved = true; }
      }
      return s + dur <= dayEnd ? s : null;
    };

    const foodFor = (meal, preferArea) => {
      const options = food.filter((f) => f.meal === meal && (f.area === preferArea || !f.area));
      const pool = options.length ? options : food.filter((f) => f.meal === meal);
      if (meal === "dinner") {
        const premiumOk = trip.budget && trip.budget / Math.max(trip.travellers, 1) / n > 120;
        const nonPremium = pool.filter((f) => !f.premium);
        if (premiumOk && i === n - 2) return pool.find((f) => f.premium) || pool[0];
        return nonPremium[i % Math.max(nonPremium.length, 1)] || pool[0];
      }
      return pool[0];
    };

    const pick = (minute, evening) => {
      const morning = minute < 720;
      const lateAfternoon = coastalDay && minute >= 1020;
      const pool = places.filter((p) => !used.has(p.id) && p.area === area && p.category !== "dental");
      const rank = (list) => list
        .map((p) => ({ p, s: scorePlace(p, trip) + (p.slot === (morning ? "morning" : "afternoon") ? 2 : 0) + (coastalDay && morning && p.category === "beach" ? 8 : 0) + (lateAfternoon && p.slot === "evening" ? 3 : 0) }))
        .sort((a, b) => b.s - a.s)
        .map((x) => x.p);
      if (evening) {
        const list = rank(pool.filter((p) => p.slot === "evening" && eligible(p, trip)));
        return has("nightlife") ? list[0] : list.find((p) => p.category !== "nightlife");
      }
      const slotOk = (p) => p.slot !== "evening" || (lateAfternoon && (has("nightlife") || has("beach")));
      return rank(pool.filter((p) => eligible(p, trip) && slotOk(p)))[0]
        || rank(pool.filter((p) => p.slot !== "evening" && !["shopping", "wellness"].includes(p.category)))[0];
    };

    // Dental appointments go on the first full base-area day, mid-afternoon.
    const dental = has("dental") && area === base && i <= 1 && !used.has("dental")
      ? places.find((p) => p.category === "dental") : null;

    let cursor = dayStart;
    let filler = false;
    for (const [minute, kind] of slots) {
      if (kind === "breakfast" && dayStart >= 11 * 60) continue;
      const t = Math.max(minute, cursor);
      if ((kind === "lunch" || kind === "dinner") && t - minute > 120) continue;
      let place = null;
      if (kind === "breakfast") place = foodFor("breakfast", base);
      else if (kind === "lunch") place = foodFor("lunch", area);
      else if (kind === "dinner") place = foodFor("dinner", area);
      else if (kind === "act") {
        place = dental && !used.has("dental") && minute >= 900 ? dental : pick(minute, false);
        if (place === dental && dental) used.add("dental");
      } else if (kind === "evening") {
        if (dayPace === "relaxed" && !has("nightlife")) continue;
        place = pick(minute, true);
      }
      if (!place && kind === "act" && !filler) {
        place = { id: `free-${i}`, name: `Free time to explore ${area}`, category: "free", duration: 120, cost: 0, lat: dest.areas[area].lat, lng: dest.areas[area].lng, why: "Wander, rest or revisit a favourite spot — ask the assistant for ideas." };
        filler = true;
      }
      if (!place) continue;
      const s = fit(t, place.duration || 60);
      if (s === null) continue;
      if (!place.meal) used.add(place.id);
      const item = placeToItem(place, fromMinutes(s));
      items.push(item);
      cursor = roundUp15(s + item.duration + 15);
      if (coastalDay && kind === "breakfast") {
        items.push(simpleItem(fromMinutes(cursor - 5 > s + item.duration ? cursor - 5 : cursor), `Travel to ${area}`, "transport", travel, { lat: dest.areas[area].lat, lng: dest.areas[area].lng }));
        cursor = roundUp15(cursor + travel + 10);
      }
    }

    if (coastalDay) {
      const last = Math.max(...items.map((it) => toMinutes(it.time) + it.duration));
      items.push(simpleItem(fromMinutes(roundUp15(last + 15)), `Return to ${base}`, "transport", travel));
    }

    const sorted = items.sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
    return { date, area, title: dayTitle(sorted, i, n, area, base, has), items: reflow(sorted) };
  });
}

function dayTitle(items, i, n, area, base, has) {
  if (i === 0) return `Arrival & ${base}`;
  if (i === n - 1) return `${base} & departure`;
  if (area !== base) return has("beach") ? "Beach & adventure" : `Day trip to ${area}`;
  const counts = {};
  items.filter(isActivity).forEach((it) => (counts[it.category] = (counts[it.category] || 0) + 1));
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  return {
    culture: "Culture & landmarks", history: "History & hidden stories", adventure: "Adventure & views",
    wellness: "Slow day & wellness", dental: "Appointments & city", shopping: "Shops & cafés",
  }[top] || `${base} at your pace`;
}

/** Push non-fixed items later so nothing overlaps (10-minute buffer). Items pushed past midnight are dropped. */
export function reflow(items) {
  const sorted = [...items].sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
  let prevEnd = 0;
  const out = [];
  for (const it of sorted) {
    let start = toMinutes(it.time);
    if (!it.fixed && prevEnd > 0 && start < prevEnd + 10) start = roundUp15(prevEnd + 10);
    if (!it.fixed && start + (it.duration || 0) > 24 * 60) continue;
    prevEnd = Math.max(prevEnd, start + (it.duration || 0));
    out.push(start === toMinutes(it.time) ? it : { ...it, time: fromMinutes(start) });
  }
  return out;
}

/** PRD §62: overlapping items in a day, with a suggested fix. */
export function findConflicts(itinerary) {
  const conflicts = [];
  itinerary.forEach((day, d) => {
    const items = [...day.items].sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
    for (let k = 1; k < items.length; k++) {
      const a = items[k - 1];
      const b = items[k];
      const endA = toMinutes(a.time) + (a.duration || 0);
      if (endA > toMinutes(b.time)) {
        const mover = b.fixed && !a.fixed ? a : b;
        const suggested = mover === b ? roundUp15(endA + 15) : null;
        conflicts.push({
          day: d, a, b, mover,
          suggestion: suggested ? `Move ${b.title} to ${fromMinutes(suggested)}` : `Move ${a.title} earlier`,
          to: suggested ? fromMinutes(suggested) : null,
        });
      }
    }
  });
  return conflicts;
}

/** Apply a drag-and-drop reorder: activities swap into each other's time slots. */
export function reorderDay(day, fromIdx, toIdx) {
  const items = [...day.items];
  if (items[fromIdx]?.fixed) return day;
  const [moved] = items.splice(fromIdx, 1);
  items.splice(toIdx, 0, moved);
  const times = items.filter((i) => !i.fixed).map((i) => i.time).sort((a, b) => toMinutes(a) - toMinutes(b));
  let k = 0;
  const retimed = items.map((it) => (it.fixed ? it : { ...it, time: times[k++] }));
  return { ...day, items: reflow(retimed) };
}

// ---------------------------------------------------------------------------
// Targeted edits used by the assistant (PRD §35: regenerate only the relevant part).

const updateDay = (itin, d, fn) => itin.map((day, i) => (i === d ? { ...day, items: reflow(fn(day.items)) } : day));
const usedIds = (itin) => new Set(itin.flatMap((d) => d.items.map((i) => i.placeId)).filter(Boolean));

export function lateStart(itin) {
  return itin.map((day) => {
    const first = day.items.find((it) => !it.fixed);
    if (!first || toMinutes(first.time) >= 600) return day;
    const offset = 600 - toMinutes(first.time);
    return { ...day, items: reflow(day.items.map((it) => (!it.fixed && toMinutes(it.time) < 900 ? { ...it, time: fromMinutes(toMinutes(it.time) + offset) } : it))) };
  });
}

export function bestDayFor(itin, place) {
  const n = itin.length;
  const sameArea = itin.map((d, i) => i).filter((i) => itin[i].area === place.area);
  const pool = (sameArea.length ? sameArea : itin.map((_, i) => i)).filter((i) => n <= 2 || (i !== 0 && i !== n - 1));
  const candidates = pool.length ? pool : sameArea.length ? sameArea : [0];
  return candidates.sort((a, b) => itin[a].items.filter(isActivity).length - itin[b].items.filter(isActivity).length)[0];
}

/** Best start time for `duration` minutes in a day, nearest to `preferred`, keeping 15-minute buffers. */
export function findSlot(items, duration, preferred, earliest = 540, latest = 23 * 60 + 30) {
  const blocks = items.map((i) => [toMinutes(i.time), toMinutes(i.time) + (i.duration || 0)]).sort((a, b) => a[0] - b[0]);
  const options = [];
  let free = earliest;
  let first = true;
  for (const [a, b] of [...blocks, [latest + 15, latest + 15]]) {
    const s = roundUp15(first ? free : free + 15);
    const e = a - 15 - duration;
    if (e >= s) {
      const t = Math.min(Math.max(preferred, s), e);
      options.push(Math.max(s, Math.floor(t / 15) * 15));
    }
    if (b > free) { free = b; first = false; }
  }
  return options.sort((x, y) => Math.abs(x - preferred) - Math.abs(y - preferred))[0] ?? null;
}

export function addPlace(itin, place, dayIndex, time) {
  const d = dayIndex ?? bestDayFor(itin, place);
  const preferred = place.slot === "evening" ? 21 * 60 + 30 : place.slot === "morning" ? 600 : place.meal === "lunch" ? 780 : place.meal === "dinner" ? 1170 : 900;
  const latest = place.slot === "evening" ? 24 * 60 : 23 * 60 + 30;
  const found = findSlot(itin[d].items, place.duration || 60, preferred, 540, latest);
  const slot = time ? toMinutes(time) : found !== null && (place.slot !== "evening" || found >= 19 * 60) ? found : preferred;
  const item = placeToItem(place, fromMinutes(slot));
  return { itinerary: updateDay(itin, d, (items) => [...items, item]), day: d, item };
}

export function removeMatching(itin, words) {
  let removed = [];
  const next = itin.map((day) => {
    const keep = day.items.filter((it) => {
      const hit = !it.fixed && words.some((w) => it.title.toLowerCase().includes(w) || it.category === w);
      if (hit) removed.push(it.title);
      return !hit;
    });
    return { ...day, items: keep };
  });
  return { itinerary: next, removed };
}

export function makeCheaper(itin, d, trip) {
  const { places, food } = catalogFor(trip);
  const taken = usedIds(itin);
  const changes = [];
  const next = updateDay(itin, d, (items) =>
    items.map((it) => {
      if (it.fixed || (it.cost || 0) < 15) return it;
      if (it.meal) {
        const cheaper = food.filter((f) => f.meal === it.meal && f.cost < it.cost).sort((a, b) => a.cost - b.cost)[0];
        if (!cheaper) return it;
        changes.push(`${it.title} → ${cheaper.name}`);
        return { ...placeToItem(cheaper, it.time) };
      }
      const alt = places
        .filter((p) => !taken.has(p.id) && p.area === itin[d].area && (p.cost || 0) < it.cost / 2 && p.slot !== "evening" && p.category !== "dental")
        .sort((a, b) => scorePlace(b, trip) - scorePlace(a, trip))[0];
      if (!alt) return it;
      taken.add(alt.id);
      changes.push(`${it.title} → ${alt.name}`);
      return placeToItem(alt, it.time);
    }),
  );
  return { itinerary: next, changes };
}

export function moreNightlife(itin, trip) {
  const { places } = catalogFor(trip);
  const night = places.filter((p) => p.category === "nightlife");
  const added = [];
  const n = itin.length;
  const next = itin.map((day, i) => {
    if ((i === n - 1 && n > 1) || day.items.some((it) => it.category === "nightlife")) return day;
    const p = night.find((x) => x.area === day.area) || night[i % Math.max(night.length, 1)];
    if (!p) return day;
    const slot = findSlot(day.items, p.duration, 21 * 60 + 45, 540, 24 * 60);
    if (slot === null || slot < 20 * 60) return day;
    added.push(`Day ${i + 1}: ${p.name} at ${fromMinutes(slot)}`);
    return { ...day, items: reflow([...day.items, placeToItem(p, fromMinutes(slot))]) };
  });
  return { itinerary: next, added };
}

export function moreBeach(itin, trip) {
  const { places } = catalogFor(trip);
  const idx = itin.findIndex((d) => d.items.some((it) => it.category === "beach"));
  if (idx >= 0) {
    return {
      itinerary: updateDay(itin, idx, (items) => items.map((it) => (it.category === "beach" ? { ...it, duration: it.duration + 90 } : it))),
      message: `I've added 90 more minutes at the beach on Day ${idx + 1} and pushed the rest of the day back.`,
    };
  }
  const beach = places.find((p) => p.category === "beach");
  if (!beach) return { itinerary: itin, message: "I couldn't find a beach near this destination." };
  const r = addPlace(itin, beach);
  return { itinerary: r.itinerary, message: `I've added ${beach.name} to Day ${r.day + 1} at ${r.item.time}.` };
}

export function lighten(itin, d, trip) {
  const removed = [];
  const next = updateDay(itin, d, (items) => {
    const acts = items.filter(isActivity).sort((a, b) => (a.cost || 0) - (b.cost || 0));
    const drop = new Set(acts.slice(2).map((a) => a.id));
    return items.filter((it) => {
      if (drop.has(it.id)) removed.push(it.title);
      return !drop.has(it.id);
    });
  });
  return { itinerary: next, removed };
}

/** Exchange the plans of two days; fixed items (flights, check-in/out) stay on their dates. */
export function swapDays(itin, a, b) {
  const plan = (d) => d.items.filter((i) => !i.fixed);
  const fixed = (d) => d.items.filter((i) => i.fixed);
  return itin.map((day, i) => {
    if (i !== a && i !== b) return day;
    const other = itin[i === a ? b : a];
    return { ...day, area: other.area, title: other.title, items: reflow([...fixed(day), ...plan(other)]) };
  });
}

/** PRD §44: swap outdoor activities for indoor alternatives on a rainy day. */
export function rainProof(itin, d, trip, rainyDates = []) {
  const { places } = catalogFor(trip);
  const day = itin[d];
  const n = itin.length;
  const indoorHere = places.filter((p) => !p.outdoor && p.area === day.area && p.slot !== "evening" && p.category !== "dental");
  if (!indoorHere.length) {
    const k = itin.findIndex((x, i) => i !== d && i > 0 && i < n - 1 && x.area !== day.area && !rainyDates.includes(x.date));
    if (k >= 0) return { itinerary: swapDays(itin, d, k), swaps: [`Day ${d + 1} ⇄ Day ${k + 1} — your ${day.title.toLowerCase()} moves to a drier day`] };
  }
  const taken = usedIds(itin);
  const swaps = [];
  const next = updateDay(itin, d, (items) =>
    items.map((it) => {
      if (it.fixed || it.meal || !it.outdoor || !isActivity(it)) return it;
      const alt = indoorHere.find((p) => !taken.has(p.id) && eligible(p, trip)) || indoorHere.find((p) => !taken.has(p.id));
      if (!alt) return it;
      taken.add(alt.id);
      swaps.push(`${it.title} → ${alt.name}`);
      return placeToItem(alt, it.time);
    }),
  );
  return { itinerary: next, swaps };
}

export { isActivity, isMeal };
