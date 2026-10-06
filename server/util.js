// Small shared helpers for route handlers.

/** Wraps an async handler so thrown errors become JSON 500s instead of crashing. */
export const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    console.error(`[${req.method} ${req.path}]`, err);
    if (!res.headersSent) res.status(err.status || 500).json({ error: err.expose ? err.message : "Something went wrong" });
  }
};

export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  err.expose = true;
  return err;
}

/** Fixed-window in-memory rate limiter, keyed by user id or IP. */
export function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const key = req.user?.id || req.ip;
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || now - entry.start > windowMs) {
      hits.set(key, { start: now, count: 1 });
      return next();
    }
    if (++entry.count > max) return res.status(429).json({ error: "Too many requests — try again in a minute." });
    next();
  };
}
