// Destination knowledge base. Albania is fully curated; other destinations get
// destination metadata plus generic, clearly-labelled recommendation templates.
// Prices are per-person estimates in GBP and are always shown as "Est.".

export const DESTINATIONS = {
  albania: {
    name: "Albania",
    flag: "🇦🇱",
    city: "Tirana",
    airport: { code: "TIA", name: "Tirana International Airport", lat: 41.4147, lng: 19.7206 },
    center: { lat: 41.3275, lng: 19.8187 },
    currency: { code: "ALL", name: "Albanian Lek", fallbackRate: 108 },
    cardTip:
      "Cards are accepted in most hotels and larger restaurants in Tirana, but taxis, cafés and beach kiosks often prefer cash. Euros are widely accepted on the coast, though change is usually given in lek.",
    cashPerDay: 35,
    emergency: { general: "112", police: "129", ambulance: "127", fire: "128" },
    foAdvice: "albania",
    language: "Albanian",
    plug: "Type C / F (230V) — UK travellers need an adapter",
    knownFor: ["🏖️ Beaches", "🚤 Boat cruises", "🪂 Parasailing", "🏔️ Mountains", "🦷 Dental tourism", "🍴 Food", "🌃 Nightlife", "🏛️ History"],
    areas: {
      Tirana: { lat: 41.3275, lng: 19.8187 },
      "Durrës": { lat: 41.3080, lng: 19.4700, fromBase: 50, coastal: true },
    },
  },
  portugal: meta("Portugal", "🇵🇹", "Lisbon", "LIS", 38.7223, -9.1393, "EUR", "Euro", 1.17, { general: "112" }, "portugal"),
  spain: meta("Spain", "🇪🇸", "Barcelona", "BCN", 41.3874, 2.1686, "EUR", "Euro", 1.17, { general: "112" }, "spain"),
  italy: meta("Italy", "🇮🇹", "Rome", "FCO", 41.9028, 12.4964, "EUR", "Euro", 1.17, { general: "112" }, "italy"),
  greece: meta("Greece", "🇬🇷", "Athens", "ATH", 37.9838, 23.7275, "EUR", "Euro", 1.17, { general: "112" }, "greece"),
  croatia: meta("Croatia", "🇭🇷", "Dubrovnik", "DBV", 42.6507, 18.0944, "EUR", "Euro", 1.17, { general: "112" }, "croatia"),
  france: meta("France", "🇫🇷", "Paris", "CDG", 48.8566, 2.3522, "EUR", "Euro", 1.17, { general: "112" }, "france"),
  turkey: meta("Turkey", "🇹🇷", "Istanbul", "IST", 41.0082, 28.9784, "TRY", "Turkish Lira", 48, { general: "112" }, "turkey"),
  morocco: meta("Morocco", "🇲🇦", "Marrakech", "RAK", 31.6295, -7.9811, "MAD", "Moroccan Dirham", 12.5, { general: "112", police: "19", ambulance: "15" }, "morocco"),
  "united arab emirates": meta("United Arab Emirates", "🇦🇪", "Dubai", "DXB", 25.2048, 55.2708, "AED", "UAE Dirham", 4.9, { general: "999", ambulance: "998", fire: "997" }, "united-arab-emirates"),
  japan: meta("Japan", "🇯🇵", "Tokyo", "HND", 35.6762, 139.6503, "JPY", "Japanese Yen", 195, { general: "110", police: "110", ambulance: "119", fire: "119" }, "japan"),
  thailand: meta("Thailand", "🇹🇭", "Bangkok", "BKK", 13.7563, 100.5018, "THB", "Thai Baht", 43, { general: "191", police: "191", ambulance: "1669", fire: "199" }, "thailand"),
  mexico: meta("Mexico", "🇲🇽", "Cancún", "CUN", 21.1619, -86.8515, "MXN", "Mexican Peso", 24, { general: "911" }, "mexico"),
  "united states": meta("United States", "🇺🇸", "New York", "JFK", 40.7128, -74.006, "USD", "US Dollar", 1.33, { general: "911" }, "usa"),
};

function meta(name, flag, city, code, lat, lng, cur, curName, rate, emergency, fo) {
  return {
    name, flag, city,
    airport: { code, name: `${city} airport`, lat: lat + 0.08, lng: lng + 0.08 },
    center: { lat, lng },
    currency: { code: cur, name: curName, fallbackRate: rate },
    cardTip: "Cards are widely accepted in cities; carry a little cash for small purchases, markets and tips.",
    cashPerDay: 30,
    emergency,
    foAdvice: fo,
    knownFor: [],
    areas: { [city]: { lat, lng } },
  };
}

export const POPULAR = ["Albania", "Portugal", "Greece", "Croatia", "Spain", "Italy", "Turkey", "Morocco", "Japan", "Thailand"];

export function findDestination(name = "") {
  return DESTINATIONS[name.trim().toLowerCase()] || null;
}

/** Builds destination info for a trip, falling back to data captured at trip creation. */
export function destinationFor(trip) {
  const known = findDestination(trip.destination);
  if (known) return { ...known, city: trip.city || known.city };
  const center = trip.coords || { lat: 48.8566, lng: 2.3522 };
  return {
    name: trip.destination,
    flag: trip.flag || "🌍",
    city: trip.city || trip.destination,
    airport: { code: "", name: `${trip.city || trip.destination} airport`, lat: center.lat + 0.08, lng: center.lng + 0.08 },
    center,
    currency: trip.currency || { code: "EUR", name: "Euro", fallbackRate: 1.17 },
    cardTip: "Cards are widely accepted in most cities; carry a little cash for small purchases, markets and tips.",
    cashPerDay: 30,
    emergency: { general: "112" },
    foAdvice: trip.destination.toLowerCase().replace(/\s+/g, "-"),
    knownFor: [],
    areas: { [trip.city || trip.destination]: center },
  };
}

// ---------------------------------------------------------------------------
// Curated places. slot: when it fits best. outdoor drives weather replanning.

const ALBANIA_PLACES = [
  { id: "al-skanderbeg", name: "Skanderbeg Square & Et'hem Bey Mosque", category: "culture", area: "Tirana", lat: 41.3275, lng: 19.8187, duration: 90, cost: 0, outdoor: true, slot: "morning", popularity: 5, tags: ["culture", "history", "photography"], why: "The heart of Tirana — mosaics, the History Museum façade and an 18th-century mosque within a few minutes' walk." },
  { id: "al-pyramid", name: "Pyramid of Tirana", category: "culture", area: "Tirana", lat: 41.3236, lng: 19.8217, duration: 60, cost: 0, outdoor: true, slot: "any", popularity: 4, tags: ["culture", "photography", "history"], why: "The restored Pyramid has rooftop city views and sits a short walk from the square." },
  { id: "al-bunkart2", name: "Bunk'Art 2", category: "history", area: "Tirana", lat: 41.3270, lng: 19.8213, duration: 90, cost: 6, outdoor: false, slot: "any", popularity: 5, tags: ["history", "culture"], why: "A Cold War bunker turned museum in the city centre — a strong pick if it rains." },
  { id: "al-houseofleaves", name: "House of Leaves Museum", category: "history", area: "Tirana", lat: 41.3297, lng: 19.8163, duration: 75, cost: 6, outdoor: false, slot: "any", popularity: 4, tags: ["history", "culture"], why: "The former surveillance HQ, now an award-winning museum. Indoor, central and compact." },
  { id: "al-dajti", name: "Dajti Ekspres cable car", category: "adventure", area: "Tirana", lat: 41.3448, lng: 19.8605, duration: 180, cost: 12, outdoor: true, slot: "afternoon", popularity: 5, tags: ["adventure", "hiking", "photography", "family"], why: "A long cable-car ride up Mount Dajti with panoramic views and short hiking trails at the top." },
  { id: "al-bazaar", name: "New Bazaar (Pazari i Ri) food market", category: "food", area: "Tirana", lat: 41.3290, lng: 19.8255, duration: 75, cost: 8, outdoor: true, slot: "morning", popularity: 4, tags: ["food", "shopping", "culture"], why: "A restored market hall with produce stalls, small taverns and local snacks." },
  { id: "al-grandpark", name: "Grand Park & Artificial Lake", category: "wellness", area: "Tirana", lat: 41.3135, lng: 19.8135, duration: 90, cost: 0, outdoor: true, slot: "afternoon", popularity: 3, tags: ["wellness", "hiking", "family", "photography"], why: "A calm lakeside loop that's good for a slower afternoon or a morning run." },
  { id: "al-shopping", name: "Shopping on Rruga Durrësit & Toptani", category: "shopping", area: "Tirana", lat: 41.3285, lng: 19.8225, duration: 120, cost: 0, outdoor: false, slot: "afternoon", popularity: 3, tags: ["shopping"], why: "Central shopping streets and a mall within walking distance of most hotels." },
  { id: "al-spa", name: "Spa & hammam afternoon", category: "wellness", area: "Tirana", lat: 41.3222, lng: 19.8200, duration: 120, cost: 35, outdoor: false, slot: "afternoon", popularity: 2, tags: ["wellness"], why: "Recover between busy days. Several central hotels offer day passes." },
  { id: "al-dental", name: "Dental consultation", category: "dental", area: "Tirana", lat: 41.3255, lng: 19.8160, duration: 90, cost: 40, outdoor: false, slot: "afternoon", popularity: 3, tags: ["dental"], why: "Tirana has many internationally-facing clinics. Book a consultation early in the trip in case treatment needs a follow-up visit.", search: "dental clinic Tirana" },
  { id: "al-blloku", name: "Blloku bars & clubs", category: "nightlife", area: "Tirana", lat: 41.3195, lng: 19.8160, duration: 150, cost: 25, outdoor: false, slot: "evening", popularity: 5, tags: ["nightlife", "food"], why: "Tirana's liveliest district: cocktail bars, rooftop terraces and late clubs." },
  { id: "al-rooftop", name: "Rooftop cocktails over Skanderbeg Square", category: "nightlife", area: "Tirana", lat: 41.3280, lng: 19.8200, duration: 90, cost: 15, outdoor: true, slot: "evening", popularity: 3, tags: ["nightlife", "photography"], why: "Sunset views over the square, a gentler evening than the clubs." },

  { id: "al-durres-beach", name: "Durrës Beach", category: "beach", area: "Durrës", lat: 41.3045, lng: 19.4850, duration: 150, cost: 8, outdoor: true, slot: "morning", popularity: 5, tags: ["beach", "family", "wellness"], why: "The closest long sandy beach to Tirana. Sunbeds and umbrellas are usually rented per day." },
  { id: "al-parasailing", name: "Parasailing at Durrës", category: "adventure", area: "Durrës", lat: 41.2990, lng: 19.4930, duration: 45, cost: 45, outdoor: true, slot: "morning", popularity: 4, tags: ["adventure", "water", "beach"], why: "Operators work right off Durrës beach — 15 minutes from your beach stop." },
  { id: "al-jetski", name: "Jet ski hire", category: "water", area: "Durrës", lat: 41.3005, lng: 19.4900, duration: 30, cost: 35, outdoor: true, slot: "afternoon", popularity: 3, tags: ["water", "adventure", "beach"], why: "A quick adrenaline hit between beach sessions." },
  { id: "al-cruise", name: "Boat cruise along the Durrës coast", category: "water", area: "Durrës", lat: 41.3125, lng: 19.4520, duration: 120, cost: 25, outdoor: true, slot: "afternoon", popularity: 4, tags: ["water", "beach", "photography", "family"], why: "A relaxed couple of hours on the water — late-afternoon departures catch the best light." },
  { id: "al-amphitheatre", name: "Durrës Amphitheatre", category: "history", area: "Durrës", lat: 41.3131, lng: 19.4465, duration: 60, cost: 3, outdoor: true, slot: "any", popularity: 4, tags: ["history", "culture", "photography"], why: "One of the largest Roman amphitheatres in the Balkans, in the old town." },
  { id: "al-beachclub", name: "Sunset at a Durrës beach club", category: "nightlife", area: "Durrës", lat: 41.3020, lng: 19.4880, duration: 150, cost: 20, outdoor: true, slot: "evening", popularity: 4, tags: ["nightlife", "beach"], why: "Music, cocktails and sunset over the Adriatic before heading back to Tirana." },
];

const ALBANIA_FOOD = [
  { id: "al-breakfast", name: "Breakfast — byrek & coffee", meal: "breakfast", area: "Tirana", lat: 41.3245, lng: 19.8180, duration: 45, cost: 4, why: "Flaky byrek and strong espresso, the classic Albanian start to the day." },
  { id: "al-lunch-grill", name: "Lunch — Albanian grill (qofte & salads)", meal: "lunch", area: "Tirana", lat: 41.3265, lng: 19.8240, duration: 60, cost: 10, why: "Quick, local and good value, close to the central sights." },
  { id: "al-dinner-trad", name: "Dinner — traditional Albanian restaurant", meal: "dinner", area: "Tirana", lat: 41.3210, lng: 19.8150, duration: 90, cost: 15, why: "Tavë kosi, fërgesë and local wines. Booking is recommended for groups." },
  { id: "al-dinner-fine", name: "Dinner — Tirana tasting menu", meal: "dinner", area: "Tirana", lat: 41.3190, lng: 19.8175, duration: 120, cost: 45, premium: true, why: "Modern Albanian cooking for a special night out." },
  { id: "al-lunch-seafood", name: "Seafood lunch on the Durrës promenade", meal: "lunch", area: "Durrës", lat: 41.3150, lng: 19.4560, duration: 90, cost: 18, why: "Fresh catch on the waterfront, a short walk from the beach." },
  { id: "al-dinner-durres", name: "Dinner by the sea in Durrës", meal: "dinner", area: "Durrës", lat: 41.3100, lng: 19.4700, duration: 90, cost: 18, why: "Eat on the coast before the drive back." },
];

const ALBANIA_STAYS = [
  { id: "st-central", name: "Boutique hotel near Skanderbeg Square", type: "hotel", area: "Tirana", price: "££", perNight: 85, why: ["Walk to most sights", "Good for groups of 2–4", "Easy taxi pick-up for late arrivals"] },
  { id: "st-blloku", name: "Design hotel in Blloku", type: "hotel", area: "Tirana", price: "£££", perNight: 120, why: ["In the nightlife district", "Rooftop bars nearby", "Quiet rooms on upper floors"] },
  { id: "st-apartment", name: "Entire apartment in central Tirana", type: "rental", area: "Tirana", price: "£", perNight: 60, why: ["Best value for groups", "Kitchen and living space", "Self check-in suits late arrivals"] },
  { id: "st-durres", name: "Beachfront resort in Durrës", type: "resort", area: "Durrës", price: "£££", perNight: 140, why: ["On the beach", "Pool and spa", "45–60 min from Tirana"] },
  { id: "st-hostel", name: "Social hostel in Tirana", type: "hostel", area: "Tirana", price: "£", perNight: 22, why: ["Budget friendly", "Good for solo travellers", "Organised walking tours"] },
];

// Generic templates for destinations without curated data. Offsets in degrees.
const GENERIC_PLACES = [
  { key: "oldtown", name: "Old town walking tour", category: "culture", dLat: 0.004, dLng: -0.003, duration: 120, cost: 0, outdoor: true, slot: "morning", popularity: 5, tags: ["culture", "history", "photography"], why: "The easiest way to get your bearings on day one." },
  { key: "museum", name: "Main history museum", category: "history", dLat: -0.003, dLng: 0.004, duration: 120, cost: 12, outdoor: false, slot: "any", popularity: 4, tags: ["history", "culture"], why: "An indoor anchor for the itinerary and a good rain plan." },
  { key: "market", name: "Local food market", category: "food", dLat: 0.006, dLng: 0.005, duration: 75, cost: 10, outdoor: true, slot: "morning", popularity: 4, tags: ["food", "shopping", "culture"], why: "Taste local specialities and pick up snacks for later." },
  { key: "viewpoint", name: "Sunset viewpoint", category: "culture", dLat: -0.007, dLng: -0.006, duration: 60, cost: 0, outdoor: true, slot: "evening", popularity: 4, tags: ["photography", "wellness"], why: "The best light of the day over the city." },
  { key: "beach", name: "Nearest beach / waterfront", category: "beach", dLat: -0.02, dLng: 0.02, duration: 150, cost: 5, outdoor: true, slot: "morning", popularity: 4, tags: ["beach", "wellness", "family"], why: "Slow down by the water between busier days." },
  { key: "boat", name: "Boat trip or river cruise", category: "water", dLat: -0.015, dLng: 0.012, duration: 120, cost: 25, outdoor: true, slot: "afternoon", popularity: 3, tags: ["water", "photography", "family"], why: "See the city from the water." },
  { key: "hike", name: "Hike or nature escape", category: "adventure", dLat: 0.03, dLng: -0.03, duration: 180, cost: 0, outdoor: true, slot: "afternoon", popularity: 3, tags: ["hiking", "adventure", "photography"], why: "Fresh air and views just outside the centre." },
  { key: "adventure", name: "Outdoor adventure activity", category: "adventure", dLat: 0.02, dLng: 0.025, duration: 120, cost: 45, outdoor: true, slot: "afternoon", popularity: 3, tags: ["adventure", "water"], why: "Something with an adrenaline kick for your group." },
  { key: "shopping", name: "Shopping district", category: "shopping", dLat: 0.002, dLng: 0.008, duration: 120, cost: 0, outdoor: false, slot: "afternoon", popularity: 3, tags: ["shopping"], why: "Local boutiques and souvenirs." },
  { key: "spa", name: "Spa or wellness session", category: "wellness", dLat: -0.004, dLng: -0.008, duration: 120, cost: 40, outdoor: false, slot: "afternoon", popularity: 2, tags: ["wellness"], why: "Recharge between busy days." },
  { key: "dental", name: "Dental consultation", category: "dental", dLat: 0.003, dLng: 0.001, duration: 90, cost: 40, outdoor: false, slot: "afternoon", popularity: 2, tags: ["dental"], why: "Book a consultation early in the trip in case treatment needs a follow-up visit." },
  { key: "nightlife", name: "Bars & nightlife district", category: "nightlife", dLat: -0.002, dLng: -0.004, duration: 150, cost: 25, outdoor: false, slot: "evening", popularity: 4, tags: ["nightlife"], why: "Where locals go out after dinner." },
];

const GENERIC_FOOD = [
  { key: "breakfast", name: "Breakfast near your stay", meal: "breakfast", dLat: 0, dLng: 0.001, duration: 45, cost: 6, why: "Fuel up close to your accommodation." },
  { key: "lunch", name: "Lunch — local favourite", meal: "lunch", dLat: 0.003, dLng: 0.002, duration: 60, cost: 12, why: "A well-reviewed spot near your morning activity." },
  { key: "dinner", name: "Dinner — traditional cuisine", meal: "dinner", dLat: -0.003, dLng: 0.001, duration: 90, cost: 22, why: "Try the region's signature dishes." },
  { key: "dinner-fine", name: "Dinner — special night out", meal: "dinner", dLat: -0.001, dLng: -0.003, duration: 120, cost: 50, premium: true, why: "A memorable meal for one evening." },
];

const GENERIC_STAYS = [
  { id: "st-central", name: "Central boutique hotel", type: "hotel", price: "££", perNight: 110, why: ["Walk to most sights", "Easy airport transfer pick-up", "Good for couples and small groups"] },
  { id: "st-apartment", name: "Entire apartment in the centre", type: "rental", price: "£", perNight: 80, why: ["Best value for groups", "Kitchen and living space", "Self check-in"] },
  { id: "st-resort", name: "Resort with pool", type: "resort", price: "£££", perNight: 170, why: ["Pool and spa", "Great for downtime", "Family friendly"] },
  { id: "st-hostel", name: "Social hostel", type: "hostel", price: "£", perNight: 28, why: ["Budget friendly", "Great for solo travellers", "Organised tours"] },
];

export function catalogFor(trip) {
  const dest = destinationFor(trip);
  if (findDestination(trip.destination)?.name === "Albania") {
    return { dest, places: ALBANIA_PLACES, food: ALBANIA_FOOD, stays: ALBANIA_STAYS };
  }
  const area = dest.city;
  const place = (p) => ({ ...p, id: `g-${p.key}`, area, lat: dest.center.lat + p.dLat, lng: dest.center.lng + p.dLng, search: `${p.name} ${dest.city}` });
  return {
    dest,
    places: GENERIC_PLACES.map(place),
    food: GENERIC_FOOD.map(place),
    stays: GENERIC_STAYS.map((s) => ({ ...s, area })),
  };
}
