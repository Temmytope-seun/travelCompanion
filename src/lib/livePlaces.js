// Builds a destination catalog from Google Places (New) so non-curated destinations get
// real, rated places instead of generic templates. Results are stored on the trip.
import { searchPlaces } from "./api.js";

// Google place types → app category, with sensible planning defaults.
const TYPE_MAP = [
  [["dentist", "dental_clinic"], { category: "dental", duration: 90, slot: "afternoon" }],
  [["night_club", "bar", "pub", "wine_bar", "cocktail_bar"], { category: "nightlife", duration: 120, slot: "evening" }],
  [["cafe", "coffee_shop", "bakery", "breakfast_restaurant", "brunch_restaurant"], { category: "cafe", meal: "breakfast", duration: 45, slot: "morning" }],
  [["restaurant"], { category: "food", meal: "dinner", duration: 90 }],
  [["beach"], { category: "beach", duration: 150, slot: "morning", outdoor: true }],
  [["marina", "boat_tour_agency", "ferry_terminal"], { category: "water", duration: 120, slot: "afternoon", outdoor: true }],
  [["museum", "art_gallery", "historical_landmark", "historical_place", "monument", "castle"], { category: "history", duration: 90 }],
  [["spa", "gym", "wellness_center", "massage"], { category: "wellness", duration: 90, slot: "afternoon" }],
  [["shopping_mall", "market", "store", "clothing_store"], { category: "shopping", duration: 90, slot: "afternoon" }],
  [["park", "hiking_area", "national_park", "zoo", "amusement_park"], { category: "adventure", duration: 120, slot: "afternoon", outdoor: true }],
  [["tourist_attraction", "church", "mosque", "place_of_worship", "plaza"], { category: "culture", duration: 75, outdoor: true }],
];
const NAME_HINTS = [[/dent|teeth|orthodon/i, "dental_clinic"], [/beach|plage|playa|praia|spiaggia/i, "beach"], [/bar\b|club|pub|lounge/i, "bar"], [/restaurant|taverna|trattoria|grill|pizzeria/i, "restaurant"], [/caf[eé]|coffee|bakery/i, "cafe"], [/museum|museo|musée|muzeu/i, "museum"], [/cruise|boat|sail/i, "boat_tour_agency"]];
const PRICE = { PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 8, PRICE_LEVEL_MODERATE: 15, PRICE_LEVEL_EXPENSIVE: 30, PRICE_LEVEL_VERY_EXPENSIVE: 50 };
const LODGING = ["lodging", "hotel", "resort_hotel", "hostel", "guest_house", "bed_and_breakfast", "motel", "inn"];

export const isLodging = (p) => [p.primaryType, ...(p.types || [])].some((t) => LODGING.includes(t));

const matchMeta = (list) => TYPE_MAP.find(([keys]) => keys.some((k) => list.some((t) => t === k || t?.endsWith(`_${k}`))))?.[1];

/** Turns a Google Places result into a catalog place the itinerary engine understands. */
export function fromGoogle(p, dest, hint) {
  const name = p.displayName?.text || "Place";
  const types = [p.primaryType, ...(p.types || [])].filter(Boolean);
  const byName = NAME_HINTS.filter(([re]) => re.test(name)).map(([, t]) => t);
  const breakfasty = /breakfast|brunch|pastelaria|bakery/i.test(name) ? matchMeta(["cafe"]) : null;
  const meta = breakfasty || matchMeta(types.slice(0, 1)) || matchMeta(byName) || matchMeta(types) || hint?.meta || { category: "culture", duration: 90 };
  const lat = p.location?.latitude ?? dest.center.lat;
  const lng = p.location?.longitude ?? dest.center.lng;
  const area = Object.entries(dest.areas)
    .map(([a, c]) => [a, (c.lat - lat) ** 2 + (c.lng - lng) ** 2])
    .sort((x, y) => x[1] - y[1])[0][0];
  const reviews = p.userRatingCount || 0;
  return {
    id: `gp-${p.id}`, name, area, lat, lng, slot: "any", outdoor: false, ...meta,
    cost: PRICE[p.priceLevel] ?? (meta.meal ? 15 : 0),
    priceLevel: p.priceLevel,
    tags: [...new Set([meta.category, ...(hint?.tags || [])])],
    popularity: p.rating >= 4.6 && reviews >= 1000 ? 5 : p.rating >= 4.4 ? 4 : 3,
    rating: p.rating,
    reviews,
    website: p.websiteUri,
    mapsUri: p.googleMapsUri,
    address: p.formattedAddress,
    why: p.rating ? `Rated ${p.rating}★ by ${reviews.toLocaleString("en-GB")} Google reviewers.` : "Found on Google.",
    search: `${name} ${p.formattedAddress || dest.city}`,
    source: "google",
  };
}

function toStay(p, dest) {
  const types = [p.primaryType, ...(p.types || [])];
  const type = types.includes("hostel") ? "hostel" : types.includes("resort_hotel") ? "resort" : types.some((t) => ["guest_house", "bed_and_breakfast"].includes(t)) ? "rental" : "hotel";
  const level = { PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4 }[p.priceLevel] ?? 2;
  return {
    id: `gs-${p.id}`,
    name: p.displayName?.text || "Hotel",
    type,
    area: fromGoogle(p, dest).area,
    price: "£".repeat(Math.min(level, 3)),
    perNight: [40, 70, 110, 170, 260][level],
    why: [
      p.rating ? `Rated ${p.rating}★ by ${(p.userRatingCount || 0).toLocaleString("en-GB")} Google reviewers` : "Listed on Google",
      p.formattedAddress?.split(",").slice(0, 2).join(",") || dest.city,
      type === "hostel" ? "Budget friendly" : type === "resort" ? "Resort facilities" : "Central base for your plans",
    ],
    website: p.websiteUri,
    mapsUri: p.googleMapsUri,
    address: p.formattedAddress,
    source: "google",
  };
}

// Interest → search phrase + fallback category when Google's type is generic.
const INTEREST_QUERIES = {
  beach: ["best beaches near", { category: "beach", duration: 150, slot: "morning", outdoor: true }],
  water: ["boat tours and water sports in", { category: "water", duration: 120, slot: "afternoon", outdoor: true }],
  adventure: ["outdoor adventure activities near", { category: "adventure", duration: 150, slot: "afternoon", outdoor: true }],
  history: ["history museums in", { category: "history", duration: 90 }],
  culture: ["cultural landmarks in", { category: "culture", duration: 75, outdoor: true }],
  nightlife: ["best bars and nightlife in", { category: "nightlife", duration: 120, slot: "evening" }],
  shopping: ["best shopping streets and markets in", { category: "shopping", duration: 90, slot: "afternoon" }],
  wellness: ["best spa in", { category: "wellness", duration: 120, slot: "afternoon" }],
  dental: ["top rated dental clinic in", { category: "dental", duration: 90, slot: "afternoon" }],
  photography: ["best viewpoints in", { category: "culture", duration: 60, outdoor: true }],
  hiking: ["hiking trails near", { category: "adventure", duration: 180, slot: "afternoon", outdoor: true }],
  family: ["family activities in", { category: "adventure", duration: 120, outdoor: true }],
};

/**
 * Runs ~6–12 Text Search requests tailored to the trip and returns { places, food, stays }.
 * Individual failed searches are skipped; throws only if nothing came back.
 */
export async function fetchCatalog(trip, dest) {
  const where = `${dest.city}, ${dest.name}`;
  const queries = [
    { q: `top tourist attractions in ${where}`, tags: ["culture", "photography"], n: 10 },
    { q: `best local restaurants in ${where}`, tags: ["food"], n: 10, food: true },
    { q: `best breakfast cafes in ${where}`, tags: ["food"], n: 4, food: true },
    { q: `best hotels in ${where}`, n: 6, stays: true },
    ...trip.interests.filter((i) => INTEREST_QUERIES[i]).slice(0, 7).map((i) => ({
      q: `${INTEREST_QUERIES[i][0]} ${where}`, tags: [i], meta: INTEREST_QUERIES[i][1], n: 6,
    })),
  ];

  const results = await Promise.all(queries.map((x) => searchPlaces(x.q, x.n).then((r) => ({ ...x, r })).catch(() => ({ ...x, r: [] }))));
  if (!results.some((x) => x.r.length)) throw new Error(`Couldn't load places for ${dest.city}. Check your Places API key.`);

  const seen = new Set();
  const places = [];
  const food = [];
  const stays = [];
  for (const { r, tags, meta, stays: isStays } of results) {
    for (const p of r) {
      if (seen.has(p.id) || (p.businessStatus && p.businessStatus !== "OPERATIONAL")) continue;
      seen.add(p.id);
      if (isLodging(p)) { if (isStays) stays.push(toStay(p, dest)); continue; }
      const place = fromGoogle(p, dest, { tags, meta });
      // A dentist only appears when the traveller asked for dental care.
      if (place.category === "dental" && !trip.interests.includes("dental")) continue;
      (place.meal ? food : places).push(place);
    }
  }

  // Restaurants: cheaper half for lunch, the rest for dinner; top end marked premium.
  const restaurants = food.filter((f) => f.meal !== "breakfast").sort((a, b) => a.cost - b.cost);
  restaurants.forEach((f, i) => {
    f.meal = i < Math.ceil(restaurants.length / 2) ? "lunch" : "dinner";
    f.premium = f.priceLevel === "PRICE_LEVEL_VERY_EXPENSIVE";
    f.name = `${f.meal === "lunch" ? "Lunch" : "Dinner"} — ${f.name}`;
  });
  food.filter((f) => f.meal === "breakfast").forEach((f) => { f.name = `Breakfast — ${f.name}`; });

  return { places, food, stays, fetchedAt: Date.now(), city: dest.city };
}

export const isStale = (catalog) => !catalog || Date.now() - catalog.fetchedAt > 30 * 24 * 3600 * 1000;
