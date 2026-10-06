// Trip sync: last-write-wins by the client's `updatedAt`, with deletions as tombstones.
import { Router } from "express";
import { db } from "./db.js";
import { handle, httpError } from "./util.js";
import { requireUser } from "./auth.js";

export const tripsRouter = Router();
tripsRouter.use(requireUser);

const MAX_BYTES = 2_000_000;

export function userTrips(userId) {
  return db.prepare("SELECT data FROM trips WHERE user_id = ? AND deleted = 0").all(userId).map((r) => JSON.parse(r.data));
}

tripsRouter.get("/", handle(async (req, res) => {
  const rows = db.prepare("SELECT id, data, updated, deleted FROM trips WHERE user_id = ?").all(req.user.id);
  res.json({
    trips: rows.filter((r) => !r.deleted).map((r) => ({ id: r.id, updated: r.updated, data: JSON.parse(r.data) })),
    deleted: rows.filter((r) => r.deleted).map((r) => r.id),
  });
}));

tripsRouter.put("/:id", handle(async (req, res) => {
  const { id } = req.params;
  const data = req.body?.data;
  const updated = Number(req.body?.updated) || Date.now();
  if (!data || data.id !== id) throw httpError(400, "Trip id mismatch");
  const json = JSON.stringify(data);
  if (json.length > MAX_BYTES) throw httpError(413, "Trip is too large to sync");

  const existing = db.prepare("SELECT user_id, updated, deleted, data FROM trips WHERE id = ?").get(id);
  if (existing && existing.user_id !== req.user.id) throw httpError(403, "Not your trip");
  if (existing && !existing.deleted && existing.updated > updated) {
    // Server copy is newer — client should take it.
    return res.status(409).json({ trip: { id, updated: existing.updated, data: JSON.parse(existing.data) } });
  }
  db.prepare(`
    INSERT INTO trips (id, user_id, data, updated, deleted) VALUES (?, ?, ?, ?, 0)
    ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated = excluded.updated, deleted = 0
  `).run(id, req.user.id, json, updated);
  res.json({ ok: true, updated });
}));

tripsRouter.delete("/:id", handle(async (req, res) => {
  const existing = db.prepare("SELECT user_id FROM trips WHERE id = ?").get(req.params.id);
  if (existing && existing.user_id !== req.user.id) throw httpError(403, "Not your trip");
  if (existing) db.prepare("UPDATE trips SET deleted = 1, data = '{}', updated = ? WHERE id = ?").run(Date.now(), req.params.id);
  res.json({ ok: true });
}));
