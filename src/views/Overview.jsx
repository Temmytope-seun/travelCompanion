import { useMemo } from "react";
import {
  CalendarDays, Users, MapPin, Plane, BedDouble, Car, ShieldCheck, Banknote, Ticket, Stamp, BookCheck,
  ArrowRight, Sparkles, CloudSun, Siren, ExternalLink, Check, Circle, AlertTriangle, Star, Compass, CloudRain, Utensils,
} from "lucide-react";
import { useStore } from "../store.jsx";
import { Card, Ring, StatusIcon, RouteArt, gbp } from "../components/ui.jsx";
import { destinationFor } from "../data/destinations.js";
import { INTERESTS, cat } from "../data/catalog.js";
import { daysBetween, today, fmtRange, fmtDay, splitDateTime } from "../lib/dates.js";
import { prepTimeline } from "../lib/reminders.js";
import { isActivity, rainProof } from "../lib/itinerary.js";
import { isLateArrival } from "../lib/readiness.js";
import { weatherLabel, isRainy } from "../lib/api.js";
import { travelAdviceUrl } from "../lib/links.js";

const ESSENTIAL_ICONS = { flight: Plane, stay: BedDouble, transfer: Car, passport: BookCheck, visa: Stamp, insurance: ShieldCheck, currency: Banknote, activities: Ticket, checkin: Plane };

export default function Overview({ go, live, ready }) {
  const { trip, setItinerary, notify, undo } = useStore();
  const dest = destinationFor(trip);
  const toGo = daysBetween(today(), trip.startDate);
  const dayNum = daysBetween(trip.startDate, today()) + 1;
  const phase = toGo > 0 ? "before" : dayNum <= trip.itinerary.length ? "during" : "after";
  const nights = daysBetween(trip.startDate, trip.endDate);

  const rainy = useMemo(() => {
    if (!live.weather) return null;
    const idx = trip.itinerary.findIndex((d) => {
      const w = live.weather.days.find((x) => x.date === d.date);
      return isRainy(w) && d.items.some((i) => i.outdoor && isActivity(i));
    });
    return idx >= 0 ? idx : null;
  }, [live.weather, trip.itinerary]);

  return (
    <div className="stack">
      <section className="hero">
        <RouteArt />
        <div>
          <div className="eyebrow">{phase === "before" ? "Upcoming trip" : phase === "during" ? `On your trip · Day ${dayNum}` : "Trip complete"}</div>
          <h1><span className="flag">{dest.flag}</span>{trip.destination}</h1>
          <div className="hero-meta">
            <span className="hero-pill"><CalendarDays />{fmtRange(trip.startDate, trip.endDate)}</span>
            <span className="hero-pill"><Users />{trip.travellers} {trip.travellers === 1 ? "traveller" : "travellers"}</span>
            <span className="hero-pill"><MapPin />{trip.origin} → {dest.city}</span>
          </div>
          <div className="hero-count">
            {phase === "before" && <><b className="num">{toGo}</b>{toGo === 1 ? "day to go" : "days to go"} · {nights + 1} days, {nights} nights</>}
            {phase === "during" && <><b>Day {dayNum}</b>of {trip.itinerary.length} — {trip.itinerary[dayNum - 1]?.title}</>}
            {phase === "after" && <><b>Welcome home!</b>We hope it was a great trip.</>}
          </div>
        </div>
        <div className="hero-ready">
          <Ring value={ready.score} size={128} stroke={11} dark label="trip ready" />
          <small>{ready.open.length ? `${ready.open.length} ${ready.open.length === 1 ? "thing needs" : "things need"} your attention` : "100% ready — enjoy it!"}</small>
        </div>
      </section>

      {ready.next && phase !== "after" && (
        <div className={`attention${ready.next.status === "urgent" ? " urgent" : ""}`}>
          <span className="ic">{ready.next.status === "urgent" ? <AlertTriangle /> : <Sparkles />}</span>
          <div>
            <div className="eyebrow" style={{ marginBottom: 2 }}>Next action</div>
            <b>{ready.next.action}</b>
            {ready.next.id === "transfer" && isLateArrival(trip) && (
              <p>Your flight arrives at {splitDateTime(trip.flight.arrive).time}. We recommend arranging airport transport before you leave.</p>
            )}
          </div>
          <button className="btn btn-dark" onClick={() => go(ready.next.view)}>Complete <ArrowRight /></button>
        </div>
      )}

      {rainy !== null && (
        <div className="conflict-banner rain-banner">
          <CloudRain />
          <span><b>Rain is expected on Day {rainy + 1}.</b> I can move your outdoor plans indoors.</span>
          <button className="btn btn-secondary btn-sm" onClick={() => {
            const r = rainProof(trip.itinerary, rainy, trip, live.weather.days.filter(isRainy).map((w) => w.date));
            setItinerary(r.itinerary, "rain plan");
            notify(r.swaps.length ? `Rain plan applied: ${r.swaps.length} swaps on Day ${rainy + 1}` : "Nothing to swap", r.swaps.length ? { label: "Undo", run: undo } : undefined);
          }}>Apply rain plan</button>
        </div>
      )}

      {phase === "after" && <PostTrip />}

      <div className="grid g2">
        <Card title="Your travel briefing" icon={Sparkles} className="briefing">
          <Briefing trip={trip} dest={dest} toGo={toGo} phase={phase} ready={ready} />
          <div className="row wrap" style={{ marginTop: 6 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => go("itinerary")}>See the plan <ArrowRight /></button>
            <button className="btn btn-ghost btn-sm" onClick={() => go("alerts")}>View reminders</button>
          </div>
        </Card>

        <Card title="Trip status" icon={BookCheck} action={<span className="badge">{ready.essentials.filter((e) => e.status === "done").length}/{ready.essentials.length} done</span>}>
          <div className="tiles">
            {ready.essentials.map((e) => {
              const Icon = ESSENTIAL_ICONS[e.id];
              return (
                <button key={e.id} className="tile" onClick={() => go(e.view)}>
                  <div className="row"><span className="ti"><Icon /></span><StatusIcon status={e.status} /></div>
                  <b>{e.label}</b>
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      <Card title="Your itinerary" icon={CalendarDays} action={<button className="btn btn-secondary btn-sm" onClick={() => go("itinerary")}>Open <ArrowRight /></button>}>
        {trip.itinerary.map((day, i) => {
          const acts = day.items.filter((it) => isActivity(it) || it.category === "food");
          const w = live.weather?.days.find((x) => x.date === day.date);
          return (
            <div className="day-preview" key={day.date}>
              <div>
                <div className="eyebrow">Day {i + 1} · {fmtDay(day.date, { weekday: "short", day: "numeric" })}</div>
                <h4>{day.title}</h4>
                {w && <small className="muted">{weatherLabel(w.code)[1]} {w.max}°</small>}
              </div>
              <div className="chips" style={{ alignContent: "flex-start" }}>
                {acts.filter((a) => isActivity(a)).slice(0, 5).map((a) => {
                  const c = cat(a.category);
                  return <span key={a.id} className={`mini-chip hue-${c.hue}`}><c.icon />{a.title.replace(/^(Lunch|Dinner|Breakfast) — /, "")}</span>;
                })}
                {acts.filter((a) => !isActivity(a)).length > 0 && <span className="mini-chip hue-sun"><Utensils />{acts.filter((a) => !isActivity(a)).length} meals</span>}
              </div>
            </div>
          );
        })}
      </Card>

      <div className="grid g2">
        <WeatherCard live={live} trip={trip} dest={dest} />
        <MoneyCard live={live} trip={trip} dest={dest} go={go} />
      </div>

      {phase === "before" && (
        <Card title="Preparation timeline" icon={CalendarDays} sub="What to do, and when — we'll remind you at each step.">
          <PrepTimeline trip={trip} />
        </Card>
      )}

      <div className="grid g2">
        <Card title="Emergency & important info" icon={Siren}>
          <div className="emergency">
            {Object.entries(dest.emergency).map(([k, v]) => (
              <a key={k} href={`tel:${v}`}><small>{k === "general" ? "Emergency" : k[0].toUpperCase() + k.slice(1)}</small><b className="num">{v}</b></a>
            ))}
          </div>
          <hr className="divider" />
          <div className="stack" style={{ gap: 8, fontSize: 13.5 }}>
            {dest.plug && <div className="row"><span className="muted" style={{ width: 90 }}>Plugs</span>{dest.plug}</div>}
            {trip.stay?.booked && <div className="row"><span className="muted" style={{ width: 90 }}>Stay</span>{trip.stay.name}{trip.stay.phone && ` · ${trip.stay.phone}`}</div>}
            {trip.flight?.booked && <div className="row"><span className="muted" style={{ width: 90 }}>Airline</span>{trip.flight.airline} · ref {trip.flight.ref || "—"}</div>}
            <a className="link" href={travelAdviceUrl(dest.foAdvice)} target="_blank" rel="noreferrer">Official travel advice & embassy contacts <ExternalLink /></a>
            <a className="link" href={travelAdviceUrl(dest.foAdvice, "entry-requirements")} target="_blank" rel="noreferrer">Entry requirements <ExternalLink /></a>
          </div>
        </Card>

        <Card title={`Popular in ${trip.destination}`} icon={Compass}>
          {dest.knownFor.length ? (
            <div className="known-for">{dest.knownFor.map((k) => <span key={k}>{k}</span>)}</div>
          ) : (
            <p className="muted mt0">We're still learning about {trip.destination}. Discover shows ideas that match your interests.</p>
          )}
          <hr className="divider" />
          <div className="eyebrow" style={{ marginBottom: 8 }}>Your interests</div>
          <div className="chips">{trip.interests.map((i) => { const x = INTERESTS.find((y) => y.id === i); return x && <span className="chip" key={i} style={{ cursor: "default" }}>{x.emoji} {x.label}</span>; })}</div>
          <button className="btn btn-secondary btn-sm" style={{ marginTop: 14 }} onClick={() => go("discover")}>Discover experiences <ArrowRight /></button>
        </Card>
      </div>
    </div>
  );
}

function Briefing({ trip, dest, toGo, phase, ready }) {
  const has = (i) => trip.interests.includes(i);
  const coastal = trip.itinerary.findIndex((d) => d.area !== trip.itinerary[0]?.area);
  const dentalDay = trip.itinerary.findIndex((d) => d.items.some((i) => i.category === "dental"));
  const highlight = coastal >= 0 ? coastal : trip.itinerary.reduce((b, d, i) => (d.items.filter(isActivity).length > trip.itinerary[b].items.filter(isActivity).length ? i : b), 0);
  const highlightActs = trip.itinerary[highlight]?.items.filter(isActivity).slice(0, 3).map((i) => i.title.replace(/ at Durrës| along the Durrës coast/, "").replace(/^(Parasailing|Sunset|Boat|Jet|Shopping|Spa|Free|Coffee|Rooftop|Main|Local|Old|Nearest|Outdoor|Hike)\b/, (m) => m.toLowerCase()));
  const picked = INTERESTS.filter((i) => trip.interests.includes(i.id) && i.id !== "dental").slice(0, 2).map((i) => i.label.toLowerCase());
  const lede = phase === "before"
    ? toGo === 1 ? `You're travelling to ${trip.destination} tomorrow.` : `You're travelling to ${trip.destination} in ${toGo} days.`
    : phase === "during" ? `Welcome to ${dest.city}.` : `Welcome back from ${trip.destination}.`;

  return (
    <>
      <p className="lede">{lede}</p>
      <p>
        {trip.flight?.booked ? <>Your flight is <b>booked</b>{!trip.transfer?.booked ? <>, but your <b>airport transfer isn't</b>.</> : <> and your transfer is arranged.</>}</> : <>You <b>haven't added a flight</b> yet.</>}{" "}
        {trip.stay?.booked ? <>Your accommodation is <b>confirmed</b>.</> : <>You still need <b>somewhere to stay</b>.</>}
      </p>
      {highlightActs?.length > 0 && (
        <p>Based on your interest in {picked.join(" and ") || "exploring"}, I've planned {listJoin(highlightActs)} for <b>Day {highlight + 1}</b>.</p>
      )}
      {has("dental") && dentalDay >= 0 && <p>You also selected dental care, so I've added a consultation on <b>Day {dentalDay + 1}</b> and lined up highly rated providers near your accommodation.</p>}
      {phase === "before" && <p>You'll need some <b>{dest.currency.name}</b>{trip.flight?.booked ? <> and to complete your <b>airline check-in</b> 24 hours before departure</> : null}. I've added reminders for each task.</p>}
      <p><b>Trip readiness: {ready.score}%</b>{ready.open.length ? ` · ${ready.open.length} ${ready.open.length === 1 ? "thing needs" : "things need"} your attention.` : " · You're all set."}</p>
    </>
  );
}

const listJoin = (a) => (a.length <= 1 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);

function WeatherCard({ live, trip, dest }) {
  const w = live.weather;
  const tripDays = w?.days.filter((d) => d.date >= trip.startDate && d.date <= trip.endDate) || [];
  return (
    <Card title={`Weather in ${dest.city}`} icon={CloudSun}>
      {!w ? (
        <div className="stack" style={{ gap: 10 }}><div className="skeleton" style={{ height: 44, width: 160 }} /><div className="skeleton" style={{ height: 80 }} /></div>
      ) : (
        <>
          <div className="wx-now">
            <span style={{ fontSize: 38 }}>{weatherLabel(w.current.code)[1]}</span>
            <div><div className="t num">{w.current.temp}°</div><small className="muted">{weatherLabel(w.current.code)[0]} right now</small></div>
          </div>
          {tripDays.length ? (
            <div className="wx">
              {tripDays.map((d) => (
                <div key={d.date} className={`wx-day${isRainy(d) ? " rain" : ""}`}>
                  <small>{fmtDay(d.date, { weekday: "short" })}</small>
                  <span className="e">{weatherLabel(d.code)[1]}</span>
                  <b className="num">{d.max}°</b> <small style={{ display: "inline" }}>{d.min}°</small>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>Your trip forecast appears about 16 days before you travel. We'll suggest swaps if rain threatens outdoor plans.</p>
          )}
        </>
      )}
    </Card>
  );
}

function MoneyCard({ live, trip, dest, go }) {
  const code = dest.currency.code;
  const rate = live.fx?.rates?.[code] ?? dest.currency.fallbackRate;
  const cash = dest.cashPerDay * trip.travellers * (daysBetween(trip.startDate, trip.endDate) + 1);
  return (
    <Card title="Currency" icon={Banknote} action={<button className="btn btn-ghost btn-sm" onClick={() => go("budget")}>Converter <ArrowRight /></button>}>
      <p style={{ margin: "0 0 10px" }}>{dest.flag} {trip.destination} uses the <b>{dest.currency.name} ({code})</b>.</p>
      {rate ? (
        <div className="row wrap" style={{ gap: 18, marginBottom: 12 }}>
          <div><div className="eyebrow">£1 ≈</div><div className="big-num" style={{ fontSize: 30 }}>{rate >= 10 ? Math.round(rate) : rate.toFixed(2)} <small style={{ fontSize: 15 }}>{code}</small></div></div>
          <div><div className="eyebrow">£300 ≈</div><div className="big-num" style={{ fontSize: 30 }}>{Math.round(300 * rate).toLocaleString("en-GB")} <small style={{ fontSize: 15 }}>{code}</small></div></div>
        </div>
      ) : <div className="skeleton" style={{ height: 40, marginBottom: 12 }} />}
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>Suggested cash: about <b>{gbp(cash)}</b> for the group. {dest.cardTip}</p>
      <p className="muted" style={{ fontSize: 11.5, margin: "8px 0 0" }}>{live.fx ? `Live rate · ${live.fx.source}` : "Estimated rate"} · Rates fluctuate.</p>
    </Card>
  );
}

function PrepTimeline({ trip }) {
  const steps = prepTimeline(trip);
  const now = today();
  const current = steps.findIndex((s) => s.date >= now);
  return (
    <div className="prep">
      {steps.map((s, i) => (
        <div key={s.days} className={`prep-step${s.done ? " done" : i === current ? " now" : ""}`}>
          <span className="prep-dot">{s.done ? <Check /> : <span style={{ fontSize: 10, fontWeight: 700 }}>{s.days === 1 ? "24h" : s.days}</span>}</span>
          <h4>{s.label}</h4>
          <small>{fmtDay(s.date)}</small>
          <ul>
            {s.tasks.map(([t, ok]) => <li key={t} className={ok ? "ok" : ""}>{ok ? <Check /> : <Circle />}{t}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}

function PostTrip() {
  const { trip, updateTrip } = useStore();
  const spent = trip.expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const visited = trip.itinerary.flatMap((d) => d.items).filter(isActivity);
  return (
    <Card title="How was your trip?" icon={Star}>
      <div className="row" style={{ gap: 6, marginBottom: 12 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} className="icon-btn" style={{ border: 0, color: (trip.rating || 0) >= n ? "var(--sun)" : "var(--line-2)" }} onClick={() => updateTrip({ rating: n })} aria-label={`${n} stars`}>
            <Star fill="currentColor" />
          </button>
        ))}
      </div>
      <div className="row wrap" style={{ gap: 24 }}>
        <div><div className="eyebrow">Places visited</div><div className="big-num" style={{ fontSize: 28 }}>{visited.length}</div></div>
        <div><div className="eyebrow">Total spent</div><div className="big-num" style={{ fontSize: 28 }}>{gbp(spent)}</div></div>
        <div><div className="eyebrow">Days</div><div className="big-num" style={{ fontSize: 28 }}>{trip.itinerary.length}</div></div>
      </div>
    </Card>
  );
}
