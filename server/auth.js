// Email/password accounts with HttpOnly session cookies.
import { Router } from "express";
import { randomBytes, randomUUID, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { db } from "./db.js";
import { handle, httpError, rateLimit } from "./util.js";

const scrypt = promisify(_scrypt);
const COOKIE = "jai_session";
const SESSION_DAYS = 30;
const secure = process.env.NODE_ENV === "production";

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${hash.toString("hex")}`;
}

async function verifyPassword(password, stored) {
  const [salt, hex] = stored.split(":");
  const hash = await scrypt(password, salt, 64);
  const expected = Buffer.from(hex, "hex");
  return expected.length === hash.length && timingSafeEqual(expected, hash);
}

function readCookie(req, name) {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

function startSession(res, userId) {
  const token = randomBytes(32).toString("hex");
  const expires = Date.now() + SESSION_DAYS * 86400_000;
  db.prepare("INSERT INTO sessions (token, user_id, expires) VALUES (?, ?, ?)").run(token, userId, expires);
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: SESSION_DAYS * 86400_000 });
}

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name });

/** Attaches req.user when a valid session cookie is present. */
export function attachUser(req, _res, next) {
  const token = readCookie(req, COOKIE);
  if (token) {
    const row = db.prepare(
      "SELECT u.id, u.email, u.name, s.expires FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?",
    ).get(token);
    if (row && row.expires > Date.now()) req.user = publicUser(row);
    else if (row) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  }
  next();
}

export function requireUser(req, _res, next) {
  if (!req.user) return next(httpError(401, "Sign in required"));
  next();
}

export const authRouter = Router();
const limit = rateLimit({ windowMs: 15 * 60_000, max: 20 });

authRouter.post("/signup", limit, handle(async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const name = String(req.body?.name || "").trim().slice(0, 60);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, "Enter a valid email address.");
  if (password.length < 8) throw httpError(400, "Password must be at least 8 characters.");
  if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) throw httpError(409, "An account with that email already exists.");
  const user = { id: randomUUID(), email, name: name || email.split("@")[0] };
  db.prepare("INSERT INTO users (id, email, name, pass, created) VALUES (?, ?, ?, ?, ?)").run(user.id, email, user.name, await hashPassword(password), Date.now());
  startSession(res, user.id);
  res.status(201).json({ user });
}));

authRouter.post("/login", limit, handle(async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!row || !(await verifyPassword(String(req.body?.password || ""), row.pass))) throw httpError(401, "Incorrect email or password.");
  startSession(res, row.id);
  res.json({ user: publicUser(row) });
}));

authRouter.post("/logout", (req, res) => {
  const token = readCookie(req, COOKIE);
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  res.clearCookie(COOKIE, { path: "/" });
  res.json({ ok: true });
});

authRouter.get("/me", (req, res) => res.json({ user: req.user || null }));
