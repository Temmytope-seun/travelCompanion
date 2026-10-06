// Web Push reminders (PRD §40–43). A scheduler checks each subscriber's synced trips
// every minute and sends reminders that have just become due, once each.
import { Router } from "express";
import webpush from "web-push";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { db, DATA_DIR } from "./db.js";
import { handle, httpError } from "./util.js";
import { requireUser } from "./auth.js";
import { userTrips } from "./trips.js";
import { buildReminders } from "../src/lib/reminders.js";

function loadVapid() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }
  // Generate once and keep alongside the database so existing subscriptions stay valid.
  const file = path.join(DATA_DIR, "vapid.json");
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  const keys = webpush.generateVAPIDKeys();
  writeFileSync(file, JSON.stringify(keys), { mode: 0o600 });
  return keys;
}

const vapid = loadVapid();
webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:hello@journeyai.app", vapid.publicKey, vapid.privateKey);

async function send(row, payload) {
  try {
    await webpush.sendNotification(JSON.parse(row.sub), JSON.stringify(payload), { TTL: 3600 });
    return true;
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      db.prepare("DELETE FROM push_subs WHERE endpoint = ?").run(row.endpoint);
    } else {
      console.error("Push failed", err.statusCode, err.body || err.message);
    }
    return false;
  }
}

export const pushRouter = Router();

pushRouter.get("/key", (_req, res) => res.json({ publicKey: vapid.publicKey }));

pushRouter.post("/subscribe", requireUser, handle(async (req, res) => {
  const sub = req.body?.subscription;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) throw httpError(400, "Invalid subscription");
  db.prepare(`
    INSERT INTO push_subs (endpoint, user_id, sub, created) VALUES (?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, sub = excluded.sub
  `).run(sub.endpoint, req.user.id, JSON.stringify(sub), Date.now());
  res.json({ ok: true });
}));

pushRouter.post("/unsubscribe", requireUser, handle(async (req, res) => {
  db.prepare("DELETE FROM push_subs WHERE endpoint = ? AND user_id = ?").run(String(req.body?.endpoint || ""), req.user.id);
  res.json({ ok: true });
}));

pushRouter.post("/test", requireUser, handle(async (req, res) => {
  const rows = db.prepare("SELECT * FROM push_subs WHERE user_id = ?").all(req.user.id);
  if (!rows.length) throw httpError(404, "No devices subscribed yet.");
  let sent = 0;
  for (const row of rows) if (await send(row, { title: "JourneyAI reminders are on ✈️", body: "You'll get check-in, transfer and activity reminders here.", url: "/#alerts", tag: "test" })) sent++;
  res.json({ sent });
}));

const WINDOW_MS = 15 * 60_000; // only send reminders that became due recently

export async function tick(now = new Date()) {
  const subs = db.prepare("SELECT * FROM push_subs").all();
  const byUser = new Map();
  for (const row of subs) {
    if (!byUser.has(row.user_id)) byUser.set(row.user_id, userTrips(row.user_id));
    for (const trip of byUser.get(row.user_id)) {
      if (!trip?.itinerary) continue;
      for (const r of buildReminders(trip)) {
        const age = now - r.at;
        if (age < 0 || age > WINDOW_MS || r.done || trip.dismissed?.includes(r.id)) continue;
        const key = `${trip.id}:${r.id}`;
        if (db.prepare("SELECT 1 FROM push_sent WHERE endpoint = ? AND reminder_key = ?").get(row.endpoint, key)) continue;
        // Record only successful deliveries, so transient failures retry on the next tick.
        if (await send(row, { title: `${r.emoji} ${r.title}`, body: r.body, url: `/#${r.view || "alerts"}`, tag: key })) {
          db.prepare("INSERT OR IGNORE INTO push_sent (endpoint, reminder_key, sent) VALUES (?, ?, ?)").run(row.endpoint, key, Date.now());
        }
      }
    }
  }
}

export function startScheduler() {
  const timer = setInterval(() => tick().catch((e) => console.error("Push scheduler", e)), 60_000);
  timer.unref();
}
