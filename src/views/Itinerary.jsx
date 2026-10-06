import { useMemo, useState } from "react";
import {
  RefreshCw, Plus, Trash2, GripVertical, ChevronUp, ChevronDown, MapPin, ExternalLink, AlertTriangle,
  Check, List, CalendarPlus, Map as MapIcon, Search, CloudRain, Coffee,
} from "lucide-react";
import { useStore } from "../store.jsx";
import { PageHead, CatIcon, Modal, gbp } from "../components/ui.jsx";
import { catalogFor } from "../data/destinations.js";
import { CATEGORIES, cat } from "../data/catalog.js";
import { fmtDay, toMinutes } from "../lib/dates.js";
import { findConflicts, generateItinerary, reorderDay, reflow, isActivity, addPlace, uid, scorePlace, rainProof } from "../lib/itinerary.js";
import { weatherLabel, isRainy } from "../lib/api.js";
import { activityUrl, mapsSearchUrl } from "../lib/links.js";
import { currentDayIndex } from "../lib/assistant.js";
import { downloadIcs } from "../lib/ics.js";

export default function Itinerary({ go, live }) {
  const { trip, setItinerary, notify, undo, updateTrip } = useStore();
  const [dayIdx, setDayIdx] = useState(() => currentDayIndex(trip) ?? 0);
  const [adding, setAdding] = useState(false);
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  const conflicts = useMemo(() => findConflicts(trip.itinerary), [trip.itinerary]);
  const d = Math.min(dayIdx, trip.itinerary.length - 1);
  const day = trip.itinerary[d];
  const dayConflicts = conflicts.filter((c) => c.day === d);
  const conflictIds = new Set(dayConflicts.flatMap((c) => [c.a.id, c.b.id]));
  const w = live.weather?.days.find((x) => x.date === day.date);
  const perPerson = day.items.reduce((s, i) => s + (i.cost || 0), 0);

  const setDay = (fn, label) => setItinerary((it) => it.map((x, i) => (i === d ? fn(x) : x)), label);
  const patchItem = (id, patch, label) => setDay((x) => ({ ...x, items: x.items.map((i) => (i.id === id ? { ...i, ...patch } : i)).sort((a, b) => toMinutes(a.time) - toMinutes(b.time)) }), label);

  const regenerate = () => {
    setItinerary(generateItinerary(trip), "regenerate");
    updateTrip({ reviewed: true });
    notify("Itinerary regenerated from your preferences", { label: "Undo", run: undo });
  };

  const remove = (it) => {
    setDay((x) => ({ ...x, items: x.items.filter((i) => i.id !== it.id) }), `remove ${it.title}`);
    notify(`Removed ${it.title}`, { label: "Undo", run: undo });
  };

  const move = (from, to) => {
    if (to < 0 || to >= day.items.length) return;
    setDay((x) => reorderDay(x, from, to), "reorder");
  };

  const moveToDay = (it, target) => {
    setItinerary((itin) => itin.map((x, i) => {
      if (i === d) return { ...x, items: x.items.filter((y) => y.id !== it.id) };
      if (i === target) return { ...x, items: reflow([...x.items, it]) };
      return x;
    }), "move day");
    notify(`Moved to Day ${target + 1}`, { label: "Undo", run: undo });
  };

  const fixConflict = (c) => {
    if (!c.to) return;
    setItinerary((itin) => itin.map((x, i) => (i === c.day ? { ...x, items: reflow(x.items.map((y) => (y.id === c.b.id ? { ...y, time: c.to } : y))) } : x)), "fix conflict");
  };

  return (
    <>
      <PageHead
        eyebrow={`Itinerary · ${trip.itinerary.length} days`}
        title="Day-by-day plan"
        sub="Drag to reorder, tap a time to change it, or ask the assistant to reshape a day."
        actions={<>
          <div className="seg">
            <button className="on"><List />List</button>
            <button onClick={() => go("map")}><MapIcon />Map</button>
          </div>
          <button className="btn btn-secondary" onClick={() => { downloadIcs(trip); notify("Calendar file downloaded — open it to add your trip to Google, Apple or Outlook Calendar"); }}><CalendarPlus />Calendar</button>
          <button className="btn btn-secondary" onClick={regenerate}><RefreshCw />Regenerate</button>
          <button className="btn btn-primary" onClick={() => setAdding(true)}><Plus />Add</button>
        </>}
      />

      <div className="day-tabs" role="tablist">
        {trip.itinerary.map((x, i) => {
          const wx = live.weather?.days.find((y) => y.date === x.date);
          return (
            <button key={x.date} role="tab" aria-selected={i === d} className={`day-tab${i === d ? " on" : ""}`} onClick={() => setDayIdx(i)}>
              <small>Day {i + 1}{conflicts.some((c) => c.day === i) && <span className="warn-dot" aria-label="has conflicts" />}</small>
              <b>{fmtDay(x.date)}</b>
              <span className="wx-mini">{wx ? `${weatherLabel(wx.code)[1]} ${wx.max}°` : x.area}</span>
            </button>
          );
        })}
      </div>

      <section className="card">
        <div className="day-head">
          <div>
            <div className="eyebrow">Day {d + 1} · {fmtDay(day.date, { weekday: "long", day: "numeric", month: "long" })}</div>
            <h2>{day.title}</h2>
            <p>
              <span><MapPin size={13} style={{ verticalAlign: -2 }} /> {day.area}</span>
              <span>{day.items.filter(isActivity).length} {day.items.filter(isActivity).length === 1 ? "activity" : "activities"}</span>
              <span>Est. {gbp(perPerson)} pp</span>
              {w && <span>{weatherLabel(w.code)[1]} {w.max}° / {w.min}°{w.rain != null && ` · ${w.rain}% rain`}</span>}
            </p>
          </div>
        </div>

        {dayConflicts.map((c) => (
          <div className="conflict-banner" key={c.a.id + c.b.id}>
            <AlertTriangle />
            <span><b>Schedule conflict:</b> {c.a.title} ({c.a.time}) overlaps {c.b.title} ({c.b.time}). Suggestion: {c.suggestion}.</span>
            {c.to && <button className="btn btn-secondary btn-sm" onClick={() => fixConflict(c)}>Apply</button>}
          </div>
        ))}

        {isRainy(w) && day.items.some((i) => i.outdoor && isActivity(i)) && (
          <div className="conflict-banner rain-banner">
            <CloudRain />
            <span><b>Rain expected.</b> Swap outdoor plans for indoor ones?</span>
            <button className="btn btn-secondary btn-sm" onClick={() => {
              const r = rainProof(trip.itinerary, d, trip, live.weather.days.filter(isRainy).map((x) => x.date));
              setItinerary(r.itinerary, "rain plan");
              notify(`${r.swaps.length} swaps applied`, { label: "Undo", run: undo });
            }}>Apply rain plan</button>
          </div>
        )}

        <div className="tl" onDragOver={(e) => e.preventDefault()}>
          {day.items.map((it, i) => {
            const next = day.items[i + 1];
            const gap = next ? toMinutes(next.time) - (toMinutes(it.time) + (it.duration || 0)) : 0;
            return (
              <div key={it.id}>
                <div
                  className={`tl-item${conflictIds.has(it.id) ? " conflict" : ""}${over === i && drag !== null && drag !== i ? " drop-before" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setOver(i); }}
                  onDrop={(e) => { e.preventDefault(); if (drag !== null) move(drag, i); setDrag(null); setOver(null); }}
                >
                  <TimeCell item={it} onChange={(time) => patchItem(it.id, { time }, "time")} />
                  <div className={`tl-rail hue-${cat(it.category).hue}`}><span className="tl-dot" /></div>
                  <ItemCard
                    item={it} index={i} count={day.items.length} days={trip.itinerary.length} dayIndex={d}
                    dragging={drag === i}
                    onDragStart={() => setDrag(i)} onDragEnd={() => { setDrag(null); setOver(null); }}
                    onUp={() => move(i, i - 1)} onDown={() => move(i, i + 1)}
                    onRemove={() => remove(it)} onMoveDay={(t) => moveToDay(it, t)}
                    onToggleBooked={() => patchItem(it.id, { booked: !it.booked })}
                    trip={trip}
                  />
                </div>
                {gap >= 75 && toMinutes(it.time) + (it.duration || 0) >= 6 * 60 && (
                  <div className="tl-item" aria-hidden>
                    <span /><div className="tl-rail" /><div className="tl-gap"><Coffee />Free time · {fmtGap(gap)}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {!day.items.length && <p className="muted">Nothing planned yet. Add an activity or ask the assistant.</p>}
      </section>

      {adding && <AddModal trip={trip} dayIndex={d} onClose={() => setAdding(false)} onAdd={(itin, msg) => { setItinerary(itin, "add"); setAdding(false); notify(msg, { label: "Undo", run: undo }); }} />}
    </>
  );
}

const fmtGap = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`);

function TimeCell({ item, onChange }) {
  const [editing, setEditing] = useState(false);
  if (editing && !item.fixed) {
    return (
      <div className="tl-time">
        <input className="time-input" type="time" autoFocus defaultValue={item.time}
          onBlur={(e) => { if (e.target.value) onChange(e.target.value); setEditing(false); }}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEditing(false); }} />
      </div>
    );
  }
  return (
    <button className="tl-time" style={{ border: 0, background: "none", cursor: item.fixed ? "default" : "pointer" }} onClick={() => !item.fixed && setEditing(true)} title={item.fixed ? "Fixed time" : "Change time"}>
      {item.time}
      <small>{item.duration >= 60 ? `${Math.round((item.duration / 60) * 10) / 10}h` : `${item.duration}m`}</small>
    </button>
  );
}

function ItemCard({ item, index, count, days, dayIndex, dragging, onDragStart, onDragEnd, onUp, onDown, onRemove, onMoveDay, onToggleBooked, trip }) {
  const c = cat(item.category);
  const bookable = isActivity(item) && item.cost > 0;
  return (
    <div className={`tl-card${item.fixed ? " fixed" : ""}${dragging ? " dragging" : ""}`}
      draggable={!item.fixed} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      {!item.fixed && <span className="grip" aria-hidden><GripVertical /></span>}
      <CatIcon category={item.category} />
      <div className="tl-body">
        <b>{item.title}</b>
        {item.why && <p>{item.why}</p>}
        <div className="tl-meta">
          <span className={`badge hue-${c.hue}`} style={{ background: "var(--hs)", color: "var(--h)" }}>{c.label}</span>
          {item.cost > 0 && <span className="badge outline">Est. £{item.cost} pp</span>}
          {item.outdoor && <span className="badge outline">Outdoor</span>}
          {item.booked && <span className="badge ok"><Check />Booked</span>}
          {item.category === "dental" && <span className="badge warn">Verify with provider</span>}
          {item.lat && !item.fixed && <a className="link" style={{ fontSize: 12 }} href={item.mapsUri || mapsSearchUrl(item.search || `${item.title} ${trip.city}`)} target="_blank" rel="noreferrer">Map <ExternalLink /></a>}
          {bookable && !item.booked && <a className="link" style={{ fontSize: 12 }} href={item.website || (item.category === "dental" ? mapsSearchUrl(item.search || `dental clinic ${trip.city}`) : activityUrl(`${item.title} ${trip.city}`))} target="_blank" rel="noreferrer">Book <ExternalLink /></a>}
        </div>
      </div>
      {!item.fixed && (
        <div className="tl-actions">
          {bookable && <button onClick={onToggleBooked} title={item.booked ? "Mark as not booked" : "Mark as booked"} aria-label="Toggle booked"><Check /></button>}
          <button onClick={onUp} disabled={index === 0} aria-label="Move earlier"><ChevronUp /></button>
          <button onClick={onDown} disabled={index === count - 1} aria-label="Move later"><ChevronDown /></button>
          {days > 1 && (
            <select aria-label="Move to day" value="" onChange={(e) => onMoveDay(Number(e.target.value))}
              style={{ border: 0, background: "none", color: "var(--muted)", width: 28, fontSize: 12, cursor: "pointer" }} title="Move to another day">
              <option value="" disabled>⇄</option>
              {Array.from({ length: days }, (_, i) => i).filter((i) => i !== dayIndex).map((i) => <option key={i} value={i}>Move to Day {i + 1}</option>)}
            </select>
          )}
          <button onClick={onRemove} aria-label="Remove"><Trash2 /></button>
        </div>
      )}
    </div>
  );
}

function AddModal({ trip, dayIndex, onClose, onAdd }) {
  const { places, food } = catalogFor(trip);
  const [q, setQ] = useState("");
  const [day, setDay] = useState(dayIndex);
  const [custom, setCustom] = useState({ title: "", time: "15:00", duration: 60, category: "free" });
  const used = new Set(trip.itinerary.flatMap((d) => d.items.map((i) => i.placeId)));
  const list = [...places, ...food]
    .filter((p) => !used.has(p.id) || p.meal)
    .filter((p) => !q || `${p.name} ${p.category} ${(p.tags || []).join(" ")}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => scorePlace(b, trip) - scorePlace(a, trip));

  return (
    <Modal onClose={onClose} label="Add to itinerary">
      <h2>Add to your plan</h2>
      <p className="muted" style={{ marginTop: 0 }}>Pick a recommendation or add your own booking.</p>
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="searchbar" style={{ flex: 1, padding: "2px 8px 2px 12px" }}><Search /><input placeholder="Search ideas…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="input" style={{ width: 120 }} value={day} onChange={(e) => setDay(Number(e.target.value))}>
          {trip.itinerary.map((_, i) => <option key={i} value={i}>Day {i + 1}</option>)}
        </select>
      </div>
      <div className="stack" style={{ gap: 6, maxHeight: 280, overflow: "auto", marginBottom: 16 }}>
        {list.map((p) => (
          <button key={p.id} className="check" onClick={() => {
            const r = addPlace(trip.itinerary, p, day);
            onAdd(r.itinerary, `Added ${p.name} to Day ${day + 1} at ${r.item.time}`);
          }}>
            <CatIcon category={p.meal ? "food" : p.category} size={30} />
            <span><b style={{ fontWeight: 600 }}>{p.name}</b><br /><small>{p.area} · {p.duration} min{p.cost ? ` · Est. £${p.cost} pp` : " · Free"}</small></span>
            <Plus size={16} className="muted" />
          </button>
        ))}
        {!list.length && <p className="muted">No matches. Add it as your own item below.</p>}
      </div>
      <hr className="divider" />
      <div className="eyebrow" style={{ marginBottom: 10 }}>Your own item</div>
      <div className="form-grid">
        <label className="field full">Title<input value={custom.title} onChange={(e) => setCustom({ ...custom, title: e.target.value })} placeholder="e.g. Dinner reservation at…" /></label>
        <label className="field">Time<input type="time" value={custom.time} onChange={(e) => setCustom({ ...custom, time: e.target.value })} /></label>
        <label className="field">Duration (min)<input type="number" min="15" step="15" value={custom.duration} onChange={(e) => setCustom({ ...custom, duration: Number(e.target.value) })} /></label>
        <label className="field full">Type
          <select value={custom.category} onChange={(e) => setCustom({ ...custom, category: e.target.value })}>
            {Object.entries(CATEGORIES).filter(([k]) => k !== "flight").map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
          </select>
        </label>
      </div>
      <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} disabled={!custom.title.trim()} onClick={() => {
        const item = { id: uid(), time: custom.time, duration: custom.duration, title: custom.title.trim(), category: custom.category, cost: 0, booked: true };
        const itin = trip.itinerary.map((x, i) => (i === day ? { ...x, items: [...x.items, item].sort((a, b) => toMinutes(a.time) - toMinutes(b.time)) } : x));
        onAdd(itin, `Added ${item.title} to Day ${day + 1}`);
      }}><Plus />Add to Day {day + 1}</button>
    </Modal>
  );
}
