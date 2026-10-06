# JourneyAI — AI travel companion

A responsive web app plus a small API server, built from `PRD.md`. Plan, prepare and travel:
from booking your flight to finding your way home.

## Run

```bash
npm install
cp .env.example .env     # then fill in the keys you have
npm run dev              # API server on :8787 + web app on http://localhost:5173
```

Open `http://localhost:5173/?demo` to jump straight into the sample Albania trip.

Production: `npm run build && npm start` — one Node process serves the built app and the API on `PORT` (default 8787).
Requires Node 22.13+ (uses the built-in `node:sqlite`).

### Keys (`.env`, server-side only — never sent to the browser)

| Variable | Enables |
|---|---|
| `GOOGLE_MAPS_API_KEY` | Live Google Places search, real places for any destination, place photos (proxied) |
| `ANTHROPIC_API_KEY` | Claude trip assistant (`claude-opus-5-5`) and email booking import |
| `VAPID_*` (optional) | Web Push keys; generated into `data/vapid.json` on first run if unset |

Everything degrades gracefully: without the API server the app runs fully in the browser with the
rule-based assistant; without a Claude key the assistant falls back to the rule-based one.

## Architecture

```
Browser (React + Vite, service worker)          API server (Express, server/)
  local-first state in localStorage  ──/api──▶  auth (sessions, scrypt)      SQLite (data/)
  rule-based assistant fallback                 trip sync (last-write-wins)
  offline app shell + map tiles                 Places proxy ──▶ Google Places (New)
                                                Claude assistant ──▶ Claude API (tool use)
                                                email extraction ──▶ Claude API (strict tool)
                                                push scheduler ──▶ Web Push
```

The itinerary engine (`src/lib/itinerary.js`), reminders and destination data are plain ES modules
shared by the browser and the server — Claude's tools call the same functions the UI uses.

## Features (PRD mapping)

| Area | Where |
|---|---|
| Onboarding (§89), dashboard, readiness, briefing (§49–50, §63–64) | `src/views/Onboarding.jsx`, `src/views/Overview.jsx` |
| Itinerary generator, drag/reorder, conflicts, rain plan (§19–22, §34, §44, §62) | `src/lib/itinerary.js`, `src/views/Itinerary.jsx` |
| Real places per destination via Google (§23–24, §57) | `src/lib/livePlaces.js`, `server/places.js` |
| Claude assistant with itinerary tools (§35, §45, §53, §80) | `server/assistant.js`, `src/components/Assistant.jsx` |
| Accounts & sync across devices (§75) | `server/auth.js`, `server/trips.js`, `src/store.jsx`, `src/components/Account.jsx` |
| Push reminders, offline mode (§40–43, §48) | `server/push.js`, `public/sw.js`, `src/lib/push.js`, `src/views/Alerts.jsx` |
| Calendar export (.ics) | `src/lib/ics.js` (Itinerary → Calendar) |
| Email booking import (§60–61) | `server/extract.js`, `src/lib/importBookings.js` (Bookings → Import from email) |
| Map, Discover, Bookings, Checklist, Budget & expenses | `src/views/*` |

## Notes

- **Sync** is last-write-wins per trip. Signing out removes trips from that device (they stay in the account).
- **Push** needs an account (reminders are computed from synced trips). Reminder times use the server's clock and
  treat itinerary times as local — run the server in the traveller's time zone, or extend `reminders.js` with
  destination time zones before going multi-region. On iPhone, push works after "Add to Home Screen".
- **Claude** calls use adaptive thinking, `medium` effort, prompt caching, and server-side refusal fallback
  (`fallbacks: "default"`). Pasted emails are treated as untrusted data.
- Google's terms limit how long Places content may be stored; saved places show a refresh prompt after 30 days.
- Still open from the PRD: group invites/voting, document wallet, live flight status, social sign-in (Google/Apple),
  native apps, monetisation.
