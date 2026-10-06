// Trip assistant. It answers from structured trip context and calls the itinerary
// "tools" in itinerary.js rather than inventing facts (PRD §80). Rule-based for the MVP;
// an LLM orchestrator can replace `interpret` while keeping the same tool functions.
import { catalogFor } from "../data/destinations.js";
import { today, daysBetween, fmtDay, parseDate, toMinutes } from "./dates.js";
import { addPlace, lateStart, lighten, makeCheaper, moreBeach, moreNightlife, rainProof, removeMatching, scorePlace } from "./itinerary.js";
import { weatherLabel, isRainy } from "./api.js";
import { mapsSearchUrl } from "./links.js";

const SYNONYMS = {
  museum: ["museum", "bunk'art", "house of leaves"], boat: ["cruise", "boat"], cruise: ["cruise"],
  parasail: ["parasailing"], parasailing: ["parasailing"], jetski: ["jet ski"], "jet": ["jet ski"],
  cable: ["cable car"], dajti: ["dajti"], hike: ["hike", "dajti"], hiking: ["hike", "dajti"],
  spa: ["spa"], shopping: ["shopping"], shop: ["shopping"], beach: ["beach"], club: ["bars & clubs", "beach club"],
  clubs: ["bars & clubs"], bar: ["bars", "cocktails"], bars: ["bars", "cocktails"], dentist: ["dental"], dental: ["dental"],
  market: ["market", "bazaar"], bazaar: ["bazaar"], pyramid: ["pyramid"], amphitheatre: ["amphitheatre"], square: ["square"],
  bunkart: ["bunk'art"], "bunk'art": ["bunk'art"], nightlife: ["bars", "club", "cocktails"], tour: ["walking tour"],
};

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const STOP = new Set(["the", "a", "an", "to", "into", "in", "on", "my", "our", "some", "for", "day", "tomorrow", "today", "tonight", "please", "can", "we", "i", "add", "fit", "remove", "delete", "drop", "skip", "cancel", "book", "include", "schedule", "trip", "itinerary", "activity", "and", "of", "at", "it"]);

export function currentDayIndex(trip) {
  const d = daysBetween(trip.startDate, today());
  return d >= 0 && d < trip.itinerary.length ? d : null;
}

function dayFrom(text, trip) {
  const m = text.match(/day\s*(\d+)/);
  if (m) return Math.min(Math.max(Number(m[1]) - 1, 0), trip.itinerary.length - 1);
  const cur = currentDayIndex(trip);
  if (/tomorrow/.test(text)) return Math.min((cur ?? 0) + 1, trip.itinerary.length - 1);
  if (/today|tonight|this evening/.test(text)) return cur ?? 0;
  const wd = WEEKDAYS.findIndex((w) => text.includes(w));
  if (wd >= 0) {
    const idx = trip.itinerary.findIndex((d) => parseDate(d.date).getDay() === wd);
    if (idx >= 0) return idx;
  }
  return null;
}

function findPlaces(text, trip) {
  const { places } = catalogFor(trip);
  const tokens = text.toLowerCase().replace(/[?.!,]/g, "").split(/\s+/).filter((t) => t && !STOP.has(t));
  const needles = tokens.flatMap((t) => SYNONYMS[t] || [t]).filter((t) => t.length > 2);
  return places
    .map((p) => {
      const hay = `${p.name} ${p.category} ${(p.tags || []).join(" ")}`.toLowerCase();
      const hits = needles.filter((n) => hay.includes(n)).length;
      return { p, hits };
    })
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits || scorePlace(b.p, trip) - scorePlace(a.p, trip))
    .map((x) => x.p);
}

const money = (n, code) => `${Math.round(n).toLocaleString("en-GB")} ${code}`;
const describe = (it) => `${it.title.replace(/^(Lunch|Dinner|Breakfast) — /, (m) => m.split(" ")[0].toLowerCase() + " — ")} at ${it.time}`;

/**
 * @returns {{ reply: string, itinerary?: any[], label?: string, tripPatch?: object, links?: {label:string, href?:string, view?:string}[] }}
 */
export function interpret(raw, { trip, fx, weather }) {
  const text = raw.toLowerCase().trim();
  const { dest, places, food } = catalogFor(trip);
  const itin = trip.itinerary;
  const local = dest.currency.code;

  // Currency — "How much is €100 in lek?"
  const amt = text.match(/(?:£|€|\$)?\s?(\d[\d,.]*)\s?(?:k\b)?\s*(£|€|\$|eur|euros?|gbp|pounds?|usd|dollars?|lek|leke|all|[a-z]{3})?/);
  if (amt && /(how much|convert|in lek|in all|in euro|in pounds|in gbp|in eur|worth|\bin [a-z]{3}\b)/.test(text)) {
    const n = parseFloat(amt[1].replace(/,/g, ""));
    const sym = (text.match(/[£€$]/) || [])[0];
    const unit = amt[2] || "";
    const from = sym === "€" || /eur/.test(unit) ? "EUR" : sym === "$" || /usd|dollar/.test(unit) ? "USD" : /lek|leke|^all$/.test(unit) ? "ALL" : /^[a-z]{3}$/.test(unit) && !/^(gbp)$/.test(unit) ? unit.toUpperCase() : "GBP";
    const toMatch = text.match(/\bin(?:to)? (lek|all|euros?|eur|pounds?|gbp|usd|dollars?|[a-z]{3})\b/);
    const toWord = toMatch?.[1] || "";
    const to = /lek|^all$/.test(toWord) ? "ALL" : /eur/.test(toWord) ? "EUR" : /pound|gbp/.test(toWord) ? "GBP" : /usd|dollar/.test(toWord) ? "USD" : toWord.length === 3 ? toWord.toUpperCase() : from === local ? "GBP" : local;
    const rate = (c) => (c === "GBP" ? 1 : fx?.rates?.[c] ?? (c === local ? dest.currency.fallbackRate : null));
    if (rate(from) && rate(to)) {
      const out = (n / rate(from)) * rate(to);
      return { reply: `**${money(n, from)} ≈ ${money(out, to)}**\n\nRates fluctuate${fx ? "" : " — this uses an offline estimate"}; your bank or exchange bureau will apply its own rate and fees.` };
    }
  }

  if (/wake up early|lie[- ]?in|sleep in|late(r)? start|start later|not.*morning person|no early/.test(text)) {
    return { reply: "Done — nothing starts before 10:00 now. I shifted each morning back and pushed later plans to keep them from overlapping.", itinerary: lateStart(itin), label: "later starts", tripPatch: { wakeLate: true } };
  }

  if (/cheap|budget|save money|less expensive|too expensive|lower cost/.test(text)) {
    const d = dayFrom(text, trip) ?? mostExpensiveDay(itin);
    const r = makeCheaper(itin, d, trip);
    if (!r.changes.length) return { reply: `Day ${d + 1} is already fairly lean — every paid item is under £15 per person.` };
    const saved = cost(itin[d]) - cost(r.itinerary[d]);
    return { reply: `I made **Day ${d + 1}** cheaper, saving about **£${Math.round(saved)} per person**:\n${r.changes.map((c) => `• ${c}`).join("\n")}`, itinerary: r.itinerary, label: `cheaper Day ${d + 1}` };
  }

  if (/lazy|relax|slow(er)? day|less busy|too busy|lighter|take it easy|chill/.test(text)) {
    const d = dayFrom(text, trip) ?? busiestDay(itin);
    const r = lighten(itin, d, trip);
    if (!r.removed.length) return { reply: `Day ${d + 1} is already relaxed — just two activities plus meals.` };
    return { reply: `I lightened **Day ${d + 1}**. Removed:\n${r.removed.map((x) => `• ${x}`).join("\n")}\n\nYou've got more breathing room between meals now.`, itinerary: r.itinerary, label: `lighter Day ${d + 1}` };
  }

  if (/more nightlife|go out more|party more|more (bars|clubs|evenings)|night ?out/.test(text)) {
    const r = moreNightlife(itin, trip);
    if (!r.added.length) return { reply: "Every evening already has a night out planned (except your departure day)." };
    return { reply: `Evenings sorted 🌃\n${r.added.map((x) => `• ${x}`).join("\n")}`, itinerary: r.itinerary, label: "more nightlife" };
  }

  if (/(more|longer|extra).*(beach)|(beach).*(more|longer)/.test(text)) {
    const r = moreBeach(itin, trip);
    return { reply: r.message, itinerary: r.itinerary, label: "more beach time" };
  }

  if (/rain/.test(text)) {
    const d = dayFrom(text, trip);
    const indoor = places.filter((p) => !p.outdoor && p.slot !== "evening" && p.category !== "dental").slice(0, 4);
    if (d !== null && /(swap|change|replan|move|make|adjust|fix|proof|plan)/.test(text)) {
      const r = rainProof(itin, d, trip, (weather?.days || []).filter(isRainy).map((w) => w.date));
      if (!r.swaps.length) return { reply: `Day ${d + 1} is already mostly indoors.` };
      return { reply: `Rain plan applied to **Day ${d + 1}**:\n${r.swaps.map((s) => `• ${s}`).join("\n")}`, itinerary: r.itinerary, label: `rain plan Day ${d + 1}` };
    }
    const rainyDay = weather?.days?.findIndex((w) => itin.some((d) => d.date === w.date) && isRainy(w));
    const hint = rainyDay >= 0 ? `\n\nHeads-up: rain is forecast on ${fmtDay(weather.days[rainyDay].date)}. Say “rain-proof day ${itin.findIndex((d) => d.date === weather.days[rainyDay].date) + 1}” and I'll swap outdoor plans.` : "\n\nSay “rain-proof day 2” and I'll swap that day's outdoor plans for indoor ones.";
    return { reply: `Good indoor options in ${dest.city}:\n${indoor.map((p) => `• **${p.name}** — ${p.why}`).join("\n")}${hint}` };
  }

  const removeM = text.match(/^(?:please\s+)?(remove|delete|drop|skip|cancel|get rid of)\s+(.+)/);
  if (removeM) {
    const words = removeM[2].replace(/[?.!]/g, "").split(/\s+/).filter((w) => !STOP.has(w)).flatMap((w) => SYNONYMS[w] || [w]);
    const r = removeMatching(itin, words);
    if (!r.removed.length) return { reply: `I couldn't find “${removeM[2]}” in your itinerary. Flights and transfers can be edited from Bookings.` };
    return { reply: `Removed ${r.removed.map((x) => `**${x}**`).join(", ")}. The rest of the day stays as planned.`, itinerary: r.itinerary, label: `remove ${removeM[2]}` };
  }

  const addM = text.match(/(add|fit|include|book|schedule|squeeze|plan)\s+(.+)/);
  if (addM && !/how|what|where/.test(text.slice(0, 4))) {
    const matches = findPlaces(addM[2], trip);
    if (matches.length) {
      const place = matches[0];
      let d = dayFrom(text, trip);
      const existing = itin.findIndex((day) => day.items.some((i) => i.placeId === place.id));
      const existingItem = existing >= 0 && itin[existing].items.find((i) => i.placeId === place.id);
      if (existing >= 0 && (d === null || d === existing)) {
        return { reply: `**${place.name}** is already in your plan on **Day ${existing + 1}** at **${existingItem.time}**.` };
      }
      let note = "";
      const sameArea = itin.findIndex((day) => day.area === place.area);
      if (d !== null && itin[d].area !== place.area && sameArea >= 0 && !/anyway/.test(text)) {
        note = `${place.name} is in ${place.area}, about ${dest.areas[place.area]?.fromBase || dest.areas[itin[d].area]?.fromBase || 45} minutes from ${itin[d].area}, so it fits better on **Day ${sameArea + 1}** when you're already there. (Say “add it to day ${d + 1} anyway” to override.)\n\n`;
        d = sameArea;
      }
      let base = itin;
      if (existing >= 0) base = removeMatching(itin, [existingItem.title.toLowerCase()]).itinerary;
      const r = addPlace(base, place, d ?? undefined);
      const day = r.itinerary[r.day];
      const idx = day.items.findIndex((i) => i.id === r.item.id);
      const before = day.items[idx - 1];
      const after = day.items[idx + 1];
      const ctx = [before && describe(before), after && describe(after)].filter(Boolean);
      return {
        reply: `${note}${ctx.length ? `On Day ${r.day + 1} you have ${ctx.join(" and ")}. ` : ""}I've ${existing >= 0 ? "moved" : "added"} **${place.name}** to **${day.items[idx].time}** on Day ${r.day + 1}, which leaves enough time to travel between stops.${place.cost ? `\n\nEst. £${place.cost} per person.` : ""}`,
        itinerary: r.itinerary,
        label: `add ${place.name}`,
      };
    }
    if (/add|fit|include|schedule/.test(addM[1])) return { reply: `I don't have “${addM[2]}” in my ${dest.city} picks yet. Try Discover to search live places, or ask me for things like parasailing, a boat cruise or a museum.`, links: [{ label: "Open Discover", view: "discover" }] };
  }

  if (/what time|when (is|does)|start/.test(text)) {
    const words = text.replace(/[?]/g, "").split(/\s+/).filter((w) => !STOP.has(w) && !["what", "time", "does", "start", "starts", "when", "is", "my"].includes(w)).flatMap((w) => SYNONYMS[w] || [w]);
    for (const [d, day] of itin.entries()) {
      const hit = day.items.find((it) => words.some((w) => w.length > 2 && (it.title.toLowerCase().includes(w) || it.category === w)));
      if (hit) return { reply: `**${hit.title}** is on **Day ${d + 1}** (${fmtDay(day.date)}) at **${hit.time}**.` };
    }
    const named = words.filter((w) => w.length > 2).join(" ");
    if (named) return { reply: `I couldn't find “${named}” in your itinerary. Want me to add it? Try “add ${named}”.` };
  }

  if (/tonight|this evening|do later|evening/.test(text)) {
    const d = currentDayIndex(trip) ?? 0;
    const area = itin[d]?.area;
    const evening = places.filter((p) => p.slot === "evening" || p.category === "nightlife").sort((a, b) => (b.area === area) - (a.area === area));
    const planned = itin[d]?.items.filter((i) => toMinutes(i.time) >= 18 * 60);
    return {
      reply: `${planned?.length ? `Tonight you have ${planned.map(describe).join(", ")}.\n\n` : ""}Other evening ideas near ${area || dest.city}:\n${evening.slice(0, 3).map((p) => `• **${p.name}** — ${p.why}`).join("\n")}\n\nSay “add ${evening[0]?.name.split(" ")[0].toLowerCase()} tonight” to slot one in.`,
    };
  }

  if (/dentist|dental|clinic/.test(text)) {
    return {
      reply: `For dental care in ${dest.city}, compare clinics by Google rating and review count, and confirm qualifications, prices and availability with the clinic directly.\n\n_JourneyAI provides provider-discovery information only and does not give medical advice._`,
      links: [{ label: `Dental clinics in ${dest.city}`, href: mapsSearchUrl(`dental clinic ${dest.city}`) }, { label: "Discover dental", view: "discover" }],
    };
  }

  if (/restaurant|eat|food|dinner|lunch|hungry/.test(text)) {
    const near = trip.stay?.booked && trip.stay.name ? `near ${trip.stay.name}` : `in ${dest.city}`;
    return {
      reply: `Food picks ${near}:\n${food.slice(0, 4).map((f) => `• **${f.name}** — ${f.why} _(Est. £${f.cost}pp)_`).join("\n")}`,
      links: [{ label: `Restaurants ${near}`, href: mapsSearchUrl(`best restaurants ${near.replace(/^in /, "")}`) }],
    };
  }

  if (/(get to|how do i get|travel to|go to) /.test(text)) {
    const target = Object.keys(dest.areas).find((a) => text.includes(a.toLowerCase().replace("ë", "e")) || text.includes(a.toLowerCase()));
    const info = target && dest.areas[target].fromBase
      ? `${target} is about ${dest.areas[target].fromBase} minutes from ${dest.city} by car. Taxis and private drivers are the simplest option for a group; regular buses also run between the two cities.`
      : `The quickest option is usually a taxi or ride-hailing app; check public transport for cheaper routes.`;
    return { reply: info, links: [{ label: "Directions in Google Maps", href: mapsSearchUrl(target || text.split(/to /).pop()) }] };
  }

  if (/nearest beach|best beach|beach/.test(text)) {
    const beach = places.find((p) => p.category === "beach");
    return { reply: beach ? `**${beach.name}** — ${beach.why}` : "I don't have a beach pick for this destination.", links: beach ? [{ label: "Open in Maps", href: mapsSearchUrl(beach.name) }] : [] };
  }

  if (/weather|forecast|temperature|hot|cold/.test(text)) {
    if (!weather) return { reply: "I'm still loading the forecast — try again in a moment." };
    const tripDays = weather.days.filter((w) => itin.some((d) => d.date === w.date));
    if (!tripDays.length) return { reply: `It's ${weather.current.temp}°C in ${dest.city} right now. A forecast for your dates will appear about 16 days before you travel.` };
    return { reply: `Forecast for your trip:\n${tripDays.map((w) => `• ${fmtDay(w.date)} — ${weatherLabel(w.code)[1]} ${w.max}° / ${w.min}°${w.rain != null ? ` · ${w.rain}% rain` : ""}`).join("\n")}` };
  }

  if (/next|what('s| is) on|plan for/.test(text)) {
    const d = dayFrom(text, trip) ?? currentDayIndex(trip) ?? 0;
    const day = itin[d];
    return { reply: `**Day ${d + 1} — ${day.title}**\n${day.items.map((i) => `• ${i.time} ${i.title}`).join("\n")}` };
  }

  if (/budget|cost|spend|expensive/.test(text)) {
    const per = itin.reduce((s, d) => s + cost(d), 0);
    return { reply: `Planned activities and meals come to about **£${Math.round(per)} per person** (≈ £${Math.round(per * trip.travellers)} for the group). Say “make day 2 cheaper” to trim it.`, links: [{ label: "Open budget", view: "budget" }] };
  }

  return {
    reply: `I can change your plans or answer questions about the trip. Try:\n• “I don't want to wake up early”\n• “Add parasailing tomorrow”\n• “Remove the museum”\n• “Make day 2 cheaper”\n• “How much is €100 in lek?”\n• “What can I do if it rains?”`,
  };
}

const cost = (day) => day.items.reduce((s, i) => s + (i.cost || 0), 0);
const mostExpensiveDay = (itin) => itin.reduce((best, d, i) => (cost(d) > cost(itin[best]) ? i : best), 0);
const busiestDay = (itin) => itin.reduce((best, d, i) => (d.items.length > itin[best].items.length ? i : best), 0);

export const SUGGESTIONS = [
  "I don't want to wake up early",
  "Add parasailing tomorrow",
  "Make day 2 cheaper",
  "How much is €100 in lek?",
  "What can I do if it rains?",
  "I want more nightlife",
];
