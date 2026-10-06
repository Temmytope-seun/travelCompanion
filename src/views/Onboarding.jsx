import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, ExternalLink, Loader2, Plane, Sparkles, X } from "lucide-react";
import { Brand, RouteArt } from "../components/ui.jsx";
import { INTERESTS, PARTIES, STAY_TYPES } from "../data/catalog.js";
import { DESTINATIONS, POPULAR, findDestination, catalogFor, destinationFor } from "../data/destinations.js";
import { fetchCatalog } from "../lib/livePlaces.js";
import { useStore } from "../store.jsx";
import { SignInModal } from "../components/Account.jsx";
import { addDays, today, daysBetween, fmtRange } from "../lib/dates.js";
import { googleFlightsUrl } from "../lib/links.js";
import { countryInfo, geocode } from "../lib/api.js";
import { buildTrip } from "../store.jsx";

const STEPS = ["where", "when", "who", "interests", "flight", "stay", "ready"];
const JOURNEY = ["Before travel", "Flight", "Airport", "Arrival", "Accommodation", "Daily plans", "Food", "Transport", "Departure", "Return home"];

export default function Onboarding({ onDone, onDemo, canCancel, onCancel }) {
  const { caps, user } = useStore();
  const [signIn, setSignIn] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const start = addDays(today(), 21);
  const [f, setF] = useState({
    destination: "", city: "", origin: "Manchester", originAirport: "MAN",
    startDate: start, endDate: addDays(start, 3), party: "friends", travellers: 3, name: "",
    interests: [], pace: "balanced", budget: 1500,
    flightBooked: null, flight: { airline: "", number: "", depart: "", arrive: "", ref: "" },
    stayBooked: null, stay: { name: "", address: "", type: "hotel" },
  });
  const set = (patch) => setF((s) => ({ ...s, ...patch }));
  const key = STEPS[step];

  const valid = {
    where: f.destination.trim().length > 1,
    when: f.startDate && f.endDate && daysBetween(f.startDate, f.endDate) >= 0 && f.origin.trim(),
    who: f.travellers >= 1,
    interests: f.interests.length > 0,
    flight: f.flightBooked !== null,
    stay: f.stayBooked !== null,
    ready: true,
  }[key];

  async function next() {
    if (key === "where" && !findDestination(f.destination) && !f.meta) {
      setBusy(true);
      const [info, geo] = await Promise.all([
        countryInfo(f.destination).catch(() => null),
        geocode(f.city || f.destination).catch(() => null),
      ]);
      set({
        meta: true,
        flag: info?.flag,
        currency: info?.currency && { ...info.currency, fallbackRate: null },
        city: f.city || info?.capital || f.destination,
        coords: geo ? { lat: geo.lat, lng: geo.lng } : undefined,
      });
      setBusy(false);
    }
    if (key === "ready") return generate();
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function generate() {
    setGenerating(true);
    const minDelay = new Promise((r) => setTimeout(r, 1900));
    // Non-curated destinations: load real places from Google while the animation plays.
    let catalog;
    if (!catalogFor({ destination: f.destination, interests: f.interests }).curated && caps.places) {
      const dest = destinationFor({ destination: f.destination, city: f.city, coords: f.coords, flag: f.flag, currency: f.currency });
      catalog = await fetchCatalog({ interests: f.interests }, dest).catch(() => undefined);
    }
    await minDelay;
    const trip = buildTrip({
      ...f,
      catalog,
      flight: f.flightBooked ? { booked: true, ...f.flight, from: f.originAirport } : { booked: false },
      stay: f.stayBooked ? { booked: true, ...f.stay } : { booked: false, type: f.stay.type },
    });
    onDone(trip);
  }

  const pickDest = (name) => {
    const d = findDestination(name);
    set({ destination: name, city: d?.city || "", meta: false });
  };

  return (
    <div className="onb">
      <section className="onb-art">
        <RouteArt className="route" />
        <Brand />
        <div style={{ position: "relative" }}>
          <h2>From booking your flight to <em>finding your way home.</em></h2>
          <p>Tell us where you're going. JourneyAI builds your day-by-day plan, prep checklist and reminders, then stays with you for the whole trip.</p>
        </div>
        <div className="stops">{JOURNEY.map((j) => <span key={j}>{j}</span>)}</div>
      </section>

      <section className="onb-panel">
        <div className="row between" style={{ marginBottom: 18, maxWidth: 520 }}>
          <span className="eyebrow">Step {step + 1} of {STEPS.length}</span>
          {canCancel && <button className="btn btn-ghost btn-sm" onClick={onCancel}><X /> Cancel</button>}
        </div>
        <div className="onb-progress" style={{ maxWidth: 520 }}>{STEPS.map((s, i) => <span key={s} className={i <= step ? "on" : ""} />)}</div>

        {generating ? <Generating f={f} /> : (
          <div className="onb-step" key={key}>
            {key === "where" && <>
              <h1>Where are you going?</h1>
              <input className="input big-input" autoFocus placeholder="Country, e.g. Albania" value={f.destination}
                onChange={(e) => pickDest(e.target.value)} onKeyDown={(e) => e.key === "Enter" && valid && next()} />
              <div className="dest-grid">
                {POPULAR.map((name) => {
                  const d = DESTINATIONS[name.toLowerCase()];
                  return (
                    <button key={name} className={`dest-btn${f.destination.toLowerCase() === name.toLowerCase() ? " on" : ""}`} onClick={() => pickDest(name)}>
                      <span>{d.flag}</span>{name}
                    </button>
                  );
                })}
              </div>
              {f.destination && (
                <label className="field">Base city
                  <input value={f.city} placeholder="Main city you'll stay in" onChange={(e) => set({ city: e.target.value, meta: false })} />
                </label>
              )}
              <p className="muted" style={{ margin: 0 }}>
                Just looking? <button className="link" onClick={onDemo}>Explore the Albania demo trip <ArrowRight /></button>
                {caps.accounts && !user && <><br />Planned on another device? <button className="link" onClick={() => setSignIn(true)}>Sign in to get your trips <ArrowRight /></button></>}
              </p>
            </>}

            {key === "when" && <>
              <h1>When are you travelling?</h1>
              <div className="form-grid">
                <label className="field">Depart<input type="date" value={f.startDate} min={today()} onChange={(e) => set({ startDate: e.target.value, endDate: daysBetween(e.target.value, f.endDate) < 0 ? addDays(e.target.value, 3) : f.endDate })} /></label>
                <label className="field">Return<input type="date" value={f.endDate} min={f.startDate} onChange={(e) => set({ endDate: e.target.value })} /></label>
                <label className="field">Travelling from<input value={f.origin} onChange={(e) => set({ origin: e.target.value })} placeholder="City" /></label>
                <label className="field">Home airport (optional)<input value={f.originAirport} maxLength={3} onChange={(e) => set({ originAirport: e.target.value.toUpperCase() })} placeholder="e.g. MAN" /></label>
              </div>
              {valid && <p className="muted" style={{ margin: 0 }}>{fmtRange(f.startDate, f.endDate)} · {daysBetween(f.startDate, f.endDate) + 1} days in {f.city || f.destination}</p>}
            </>}

            {key === "who" && <>
              <h1>Who are you travelling with?</h1>
              <div className="choice-grid">
                {PARTIES.map((p) => (
                  <button key={p.id} className={`choice${f.party === p.id ? " on" : ""}`} onClick={() => set({ party: p.id, travellers: p.count })}>
                    <span className="e">{p.emoji}</span><b>{p.label}</b>
                  </button>
                ))}
              </div>
              <div className="row wrap" style={{ gap: 16 }}>
                <div className="field">How many people?
                  <div className="stepper">
                    <button onClick={() => set({ travellers: Math.max(1, f.travellers - 1) })} aria-label="Fewer">−</button>
                    <b className="num">{f.travellers}</b>
                    <button onClick={() => set({ travellers: Math.min(20, f.travellers + 1) })} aria-label="More">+</button>
                  </div>
                </div>
                <label className="field" style={{ flex: 1, minWidth: 180 }}>Your first name<input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="So we can personalise your plan" /></label>
              </div>
            </>}

            {key === "interests" && <>
              <h1>What are you interested in?</h1>
              <p className="sub">Pick as many as you like. We'll pick a few experiences that fit and explain why, rather than listing everything.</p>
              <div className="chips">
                {INTERESTS.map((i) => {
                  const on = f.interests.includes(i.id);
                  return (
                    <button key={i.id} className={`chip${on ? " on" : ""}`} onClick={() => set({ interests: on ? f.interests.filter((x) => x !== i.id) : [...f.interests, i.id] })}>
                      <span>{i.emoji}</span>{i.label}
                    </button>
                  );
                })}
              </div>
              <div className="form-grid">
                <div className="field">Travel pace
                  <div className="seg">
                    {["relaxed", "balanced", "packed"].map((p) => <button key={p} className={f.pace === p ? "on" : ""} onClick={() => set({ pace: p })}>{p[0].toUpperCase() + p.slice(1)}</button>)}
                  </div>
                </div>
                <label className="field">Max budget for the group (£)<input type="number" min="0" step="50" value={f.budget} onChange={(e) => set({ budget: Number(e.target.value) })} /></label>
              </div>
            </>}

            {key === "flight" && <>
              <h1>Have you booked your flight?</h1>
              <YesNo value={f.flightBooked} onChange={(v) => set({ flightBooked: v })} />
              {f.flightBooked === true && (
                <div className="form-grid">
                  <label className="field">Airline<input value={f.flight.airline} onChange={(e) => set({ flight: { ...f.flight, airline: e.target.value } })} placeholder="e.g. Wizz Air" /></label>
                  <label className="field">Flight number<input value={f.flight.number} onChange={(e) => set({ flight: { ...f.flight, number: e.target.value.toUpperCase() } })} placeholder="e.g. W6 4402" /></label>
                  <label className="field">Departs<input type="datetime-local" value={f.flight.depart} onChange={(e) => set({ flight: { ...f.flight, depart: e.target.value } })} /></label>
                  <label className="field">Arrives (local time)<input type="datetime-local" value={f.flight.arrive} onChange={(e) => set({ flight: { ...f.flight, arrive: e.target.value } })} /></label>
                  <label className="field full">Booking reference (optional)<input value={f.flight.ref} onChange={(e) => set({ flight: { ...f.flight, ref: e.target.value.toUpperCase() } })} /></label>
                </div>
              )}
              {f.flightBooked === false && (
                <div className="card" style={{ boxShadow: "none" }}>
                  <div className="row" style={{ alignItems: "flex-start" }}>
                    <span className="tl-ic hue-ink"><Plane /></span>
                    <div style={{ flex: 1 }}>
                      <b>Find your flight on Google Flights</b>
                      <p className="muted" style={{ margin: "4px 0 10px", fontSize: 13 }}>{f.origin} → {f.city || f.destination} · {fmtRange(f.startDate, f.endDate)} · {f.travellers} {f.travellers === 1 ? "adult" : "adults"}. Add the booking later and we'll set up check-in reminders.</p>
                      <a className="btn btn-secondary btn-sm" href={googleFlightsUrl({ ...f, travellers: f.travellers }, findDestination(f.destination)?.airport.code)} target="_blank" rel="noreferrer">Search flights <ExternalLink /></a>
                    </div>
                  </div>
                </div>
              )}
            </>}

            {key === "stay" && <>
              <h1>Have you booked accommodation?</h1>
              <YesNo value={f.stayBooked} onChange={(v) => set({ stayBooked: v })} />
              {f.stayBooked === true && (
                <div className="form-grid">
                  <label className="field full">Where are you staying?<input value={f.stay.name} onChange={(e) => set({ stay: { ...f.stay, name: e.target.value } })} placeholder="Hotel or rental name" /></label>
                  <label className="field full">Address (optional)<input value={f.stay.address} onChange={(e) => set({ stay: { ...f.stay, address: e.target.value } })} /></label>
                </div>
              )}
              {f.stayBooked === false && (
                <div className="field">Where would you like to stay?
                  <div className="seg">{STAY_TYPES.map((t) => <button key={t.id} className={f.stay.type === t.id ? "on" : ""} onClick={() => set({ stay: { ...f.stay, type: t.id } })}>{t.label}</button>)}</div>
                  <span className="muted" style={{ fontWeight: 450 }}>We'll suggest options that fit your group and budget.</span>
                </div>
              )}
            </>}

            {key === "ready" && <>
              <h1>Your trip is ready to be planned.</h1>
              <div className="summary-list">
                <div><span>Destination</span><b>{f.flag || findDestination(f.destination)?.flag || "🌍"} {f.city ? `${f.city}, ` : ""}{f.destination}</b></div>
                <div><span>Dates</span><b>{fmtRange(f.startDate, f.endDate)}</b></div>
                <div><span>From</span><b>{f.origin}</b></div>
                <div><span>Travellers</span><b>{f.travellers} · {PARTIES.find((p) => p.id === f.party)?.label}</b></div>
                <div><span>Interests</span><b>{f.interests.map((i) => INTERESTS.find((x) => x.id === i)?.emoji).join(" ")}</b></div>
                <div><span>Flight</span><b>{f.flightBooked ? "Booked ✓" : "Not yet"}</b></div>
                <div><span>Accommodation</span><b>{f.stayBooked ? "Booked ✓" : "Not yet"}</b></div>
              </div>
            </>}
          </div>
        )}

        {!generating && (
          <div className="onb-nav">
            {step > 0 ? <button className="btn btn-ghost" onClick={() => setStep(step - 1)}><ArrowLeft /> Back</button> : <span />}
            <button className="btn btn-primary btn-lg" disabled={!valid || busy} onClick={next}>
              {busy ? <Loader2 className="spin" /> : key === "ready" ? <Sparkles /> : null}
              {key === "ready" ? "Generate my itinerary" : "Continue"}
              {key !== "ready" && !busy && <ArrowRight />}
            </button>
          </div>
        )}
      </section>
      {signIn && <SignInModal onClose={() => setSignIn(false)} reason="Sign in and your saved trips will appear on this device." />}
    </div>
  );
}

function YesNo({ value, onChange }) {
  return (
    <div className="yesno">
      <button className={`choice${value === true ? " on" : ""}`} onClick={() => onChange(true)}><span className="e">✅</span><b>Yes, it's booked</b><small>Add the details</small></button>
      <button className={`choice${value === false ? " on" : ""}`} onClick={() => onChange(false)}><span className="e">🔎</span><b>Not yet</b><small>Help me find one</small></button>
    </div>
  );
}

function Generating({ f }) {
  const steps = [
    `Reading your interests`,
    `Searching real places in ${f.city || f.destination}`,
    "Grouping nearby activities",
    "Checking opening times & travel distances",
    "Inserting meals and transfers",
    "Building your checklist & reminders",
  ];
  return (
    <div className="onb-step">
      <h1>Planning your trip to {f.destination}…</h1>
      <div className="generating">
        {steps.map((s, i) => <div key={s} style={{ animationDelay: `${i * 0.28}s` }}><Check />{s}</div>)}
      </div>
    </div>
  );
}
