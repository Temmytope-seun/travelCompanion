// JourneyAI API server. In development Vite proxies /api here; in production this
// process also serves the built web app from dist/.
import express from "express";
import path from "node:path";
import { existsSync } from "node:fs";
import { attachUser, authRouter } from "./auth.js";
import { tripsRouter } from "./trips.js";
import { placesRouter, GOOGLE_KEY } from "./places.js";
import { assistantRouter } from "./assistant.js";
import { extractRouter } from "./extract.js";
import { pushRouter, startScheduler } from "./push.js";
import { AI_ENABLED, MODEL } from "./claude.js";

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(express.json({ limit: "3mb" }));
app.use(attachUser);

// Lets the web app know which server features are switched on.
app.get("/api/config", (_req, res) => res.json({ places: !!GOOGLE_KEY, ai: AI_ENABLED, accounts: true, push: true }));
app.use("/api/auth", authRouter);
app.use("/api/trips", tripsRouter);
app.use("/api/places", placesRouter);
app.use("/api/assistant", assistantRouter);
app.use("/api/extract", extractRouter);
app.use("/api/push", pushRouter);
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

// Errors passed to next(err), e.g. from requireUser.
app.use((err, _req, res, _next) => {
  res.status(err.status || 500).json({ error: err.expose ? err.message : "Something went wrong" });
});

const dist = path.resolve("dist");
if (existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: "1h" }));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const port = Number(process.env.PORT) || 8787;
app.listen(port, () => {
  console.log(`JourneyAI API on http://localhost:${port}`);
  console.log(`  Google Places: ${GOOGLE_KEY ? "on" : "off (set GOOGLE_MAPS_API_KEY)"}`);
  console.log(`  Claude assistant: ${AI_ENABLED ? `on (${MODEL})` : "off (set ANTHROPIC_API_KEY)"}`);
});
startScheduler();
