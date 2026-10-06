# JourneyAI — AI travel companion

A responsive web app (React + Vite) for the MVP in `PRD.md`, built on the stack of the original
`journeyai-mvp.zip` prototype. Plan, prepare and travel: from booking your flight to finding your way home.

## Run

```bash
npm install
npm run dev          # http://localhost:5173
```

Open `http://localhost:5173/?demo` to jump straight into the sample Albania trip, or start fresh to go
through the 7-step onboarding. Data is stored in your browser (localStorage).

Optional: copy `.env.example` to `.env` and set `VITE_GOOGLE_MAPS_API_KEY` (Places API (New)) to enable
live Google Places search in Discover.

## What's included (PRD §68 MVP)

| Area | Where |
|---|---|
| Trip creation — 7-step onboarding (§89) | `src/views/Onboarding.jsx` |
| Dashboard: readiness score, next action, AI briefing, prep timeline, weather, currency, emergency info | `src/views/Overview.jsx` |
| Itinerary generator (interests, pace, flights, area grouping, meals, transfers) | `src/lib/itinerary.js` |
| Day timeline: drag/reorder, edit times, move between days, add/remove, conflict detection + fixes, rain plan | `src/views/Itinerary.jsx` |
| Map (Leaflet + OpenStreetMap, no key needed) | `src/views/MapView.jsx` |
| Discover: ranked picks with match % and "why", stays, dental (with disclaimer), live Google search | `src/views/Discover.jsx` |
| Bookings: flights (Google Flights deep link), check-in, accommodation, airport transfer + late-arrival warning | `src/views/Bookings.jsx` |
| Checklist linked to bookings | `src/views/Checklist.jsx` |
| Budget estimate, currency converter, expenses & who-owes-whom | `src/views/Budget.jsx` |
| Contextual reminders + browser notifications | `src/lib/reminders.js`, `src/views/Alerts.jsx` |
| Trip assistant (modify itinerary, currency, weather, questions) with undo | `src/lib/assistant.js`, `src/components/Assistant.jsx` |

Live data: Open-Meteo (weather/geocoding), open.er-api.com (FX, includes ALL; Frankfurter fallback),
REST Countries (flags/currency for destinations outside the built-in list).

## Notes

- The assistant is rule-based and calls the same itinerary "tools" an LLM orchestrator would (PRD §80);
  swap `interpret()` in `src/lib/assistant.js` for an LLM call behind a backend to upgrade it.
- Albania has hand-curated places; other destinations use clearly labelled generic templates plus live search.
- All prices are estimates and labelled as such (PRD §72). Bookings open the provider's own site.
