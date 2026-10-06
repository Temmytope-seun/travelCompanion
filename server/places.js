// Google Places (New) proxy. The API key stays on the server.
import { Router } from "express";
import { handle, httpError, rateLimit } from "./util.js";

export const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || "";

const FIELD_MASK = [
  "id", "displayName", "formattedAddress", "rating", "userRatingCount", "websiteUri", "googleMapsUri",
  "photos", "priceLevel", "location", "primaryType", "types", "businessStatus",
].map((f) => `places.${f}`).join(",");

export async function googleTextSearch(query, max = 9) {
  if (!GOOGLE_KEY) throw httpError(503, "Google Places isn't configured on the server.");
  const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": GOOGLE_KEY, "X-Goog-FieldMask": FIELD_MASK },
    body: JSON.stringify({ textQuery: query, maxResultCount: Math.min(Math.max(max, 1), 20) }),
  });
  if (!r.ok) {
    console.error("Places error", r.status, await r.text().catch(() => ""));
    throw httpError(502, "Google Places request failed.");
  }
  return (await r.json()).places || [];
}

export const placesRouter = Router();
const limit = rateLimit({ windowMs: 60_000, max: 60 });

placesRouter.post("/search", limit, handle(async (req, res) => {
  const query = String(req.body?.query || "").trim().slice(0, 200);
  if (!query) throw httpError(400, "Missing query");
  res.json({ places: await googleTextSearch(query, Number(req.body?.max) || 9) });
}));

// Streams a place photo so the key never reaches the browser.
placesRouter.get("/photo", limit, handle(async (req, res) => {
  const name = String(req.query.name || "");
  if (!/^places\/[\w-]+\/photos\/[\w-]+$/.test(name)) throw httpError(400, "Bad photo name");
  if (!GOOGLE_KEY) throw httpError(503, "Google Places isn't configured on the server.");
  const r = await fetch(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=640&key=${GOOGLE_KEY}`);
  if (!r.ok) throw httpError(404, "Photo unavailable");
  res.set("Content-Type", r.headers.get("content-type") || "image/jpeg");
  res.set("Cache-Control", "public, max-age=86400");
  res.send(Buffer.from(await r.arrayBuffer()));
}));
