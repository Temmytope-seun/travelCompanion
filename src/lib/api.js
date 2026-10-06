// Live data: Open-Meteo (weather + geocoding), open.er-api.com (FX, covers ALL),
// REST Countries (flag/currency for unknown destinations), optional Google Places.

export const PLACES_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

const cache = new Map();
async function getJson(url, init) {
  const key = init ? null : url;
  if (key && cache.has(key)) return cache.get(key);
  const p = fetch(url, init).then((r) => {
    if (!r.ok) throw new Error(`Request failed (${r.status})`);
    return r.json();
  });
  if (key) {
    cache.set(key, p);
    p.catch(() => cache.delete(key));
  }
  return p;
}

export async function geocode(name) {
  const d = await getJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`);
  if (!d.results?.length) throw new Error(`Couldn't find “${name}”`);
  const r = d.results[0];
  return { lat: r.latitude, lng: r.longitude, name: r.name, country: r.country };
}

export async function forecast({ lat, lng }) {
  const d = await getJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=16&timezone=auto`,
  );
  const days = d.daily.time.map((date, i) => ({
    date,
    code: d.daily.weather_code[i],
    max: Math.round(d.daily.temperature_2m_max[i]),
    min: Math.round(d.daily.temperature_2m_min[i]),
    rain: d.daily.precipitation_probability_max?.[i] ?? null,
  }));
  return { current: { temp: Math.round(d.current.temperature_2m), code: d.current.weather_code }, days };
}

export async function rates(base = "GBP") {
  try {
    const d = await getJson(`https://open.er-api.com/v6/latest/${base}`);
    if (d.result !== "success") throw new Error("FX unavailable");
    return { rates: d.rates, updated: d.time_last_update_utc, source: "open.er-api.com" };
  } catch {
    const d = await getJson(`https://api.frankfurter.app/latest?from=${base}`);
    return { rates: d.rates, updated: d.date, source: "Frankfurter (ECB)" };
  }
}

export async function countryInfo(name) {
  const d = await getJson(`https://restcountries.com/v3.1/name/${encodeURIComponent(name)}?fields=name,flag,currencies,capital,latlng`);
  const c = d[0];
  const [code, cur] = Object.entries(c.currencies || {})[0] || ["EUR", { name: "Euro" }];
  return { name: c.name.common, flag: c.flag, capital: c.capital?.[0], currency: { code, name: cur.name } };
}

export async function searchPlaces(query) {
  if (!PLACES_KEY) return [];
  const d = await getJson("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": PLACES_KEY,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.websiteUri,places.googleMapsUri,places.photos,places.priceLevel,places.location",
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 9 }),
  });
  return d.places || [];
}

export function placePhotoUrl(photo) {
  return photo && PLACES_KEY ? `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=640&key=${PLACES_KEY}` : null;
}

// WMO weather codes → label + emoji.
export function weatherLabel(code) {
  if (code === 0) return ["Clear", "☀️"];
  if (code <= 2) return ["Partly cloudy", "🌤️"];
  if (code === 3) return ["Cloudy", "☁️"];
  if (code <= 48) return ["Fog", "🌫️"];
  if (code <= 57) return ["Drizzle", "🌦️"];
  if (code <= 67) return ["Rain", "🌧️"];
  if (code <= 77) return ["Snow", "🌨️"];
  if (code <= 82) return ["Showers", "🌦️"];
  return ["Thunderstorms", "⛈️"];
}

export const isRainy = (day) => day && (day.code >= 61 || (day.rain ?? 0) >= 60);
