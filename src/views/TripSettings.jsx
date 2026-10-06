import { useState } from "react";
import { Sparkles, Trash2, Users, SlidersHorizontal, Plus, X } from "lucide-react";
import { useStore } from "../store.jsx";
import { PageHead, Card } from "../components/ui.jsx";
import { INTERESTS, PARTIES } from "../data/catalog.js";
import { daysBetween } from "../lib/dates.js";
import { generateItinerary } from "../lib/itinerary.js";

export default function TripSettings({ go }) {
  const { trip, updateTrip, setItinerary, notify, undo, deleteTrip, state } = useStore();
  const [f, setF] = useState(() => ({
    city: trip.city, origin: trip.origin, originAirport: trip.originAirport, startDate: trip.startDate, endDate: trip.endDate,
    party: trip.party, travellers: trip.travellers, interests: trip.interests, pace: trip.pace, wakeLate: trip.wakeLate,
  }));
  const [people, setPeople] = useState(trip.people || []);
  const [newPerson, setNewPerson] = useState("");
  const set = (patch) => setF((s) => ({ ...s, ...patch }));
  const datesOk = daysBetween(f.startDate, f.endDate) >= 0;

  const save = (regen) => {
    const next = { ...trip, ...f, people, travellers: Math.max(f.travellers, 1) };
    updateTrip({ ...f, people, travellers: next.travellers });
    if (regen) {
      setItinerary(generateItinerary(next), "regenerate");
      notify("Saved and regenerated your itinerary", { label: "Undo plan change", run: undo });
      go("itinerary");
    } else notify("Trip details saved");
  };

  return (
    <>
      <PageHead eyebrow="Trip settings" title={`${trip.destination} trip details`} sub="Change your preferences and regenerate the plan. Bookings and checklist progress are kept." />
      <div className="stack">
        <Card title="Basics" icon={SlidersHorizontal}>
          <div className="form-grid">
            <label className="field">Base city<input value={f.city} onChange={(e) => set({ city: e.target.value })} /></label>
            <label className="field">Travelling from<input value={f.origin} onChange={(e) => set({ origin: e.target.value })} /></label>
            <label className="field">Start date<input type="date" value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} /></label>
            <label className="field">End date<input type="date" value={f.endDate} min={f.startDate} onChange={(e) => set({ endDate: e.target.value })} /></label>
            <div className="field">Travelling party
              <div className="seg">{PARTIES.map((p) => <button key={p.id} className={f.party === p.id ? "on" : ""} onClick={() => set({ party: p.id })}>{p.emoji} {p.label}</button>)}</div>
            </div>
            <label className="field">Travellers<input type="number" min="1" max="20" value={f.travellers} onChange={(e) => set({ travellers: Number(e.target.value) })} /></label>
            <div className="field">Pace
              <div className="seg">{["relaxed", "balanced", "packed"].map((p) => <button key={p} className={f.pace === p ? "on" : ""} onClick={() => set({ pace: p })}>{p[0].toUpperCase() + p.slice(1)}</button>)}</div>
            </div>
            <div className="field" style={{ justifyContent: "flex-end" }}>
              <label className="switch" style={{ fontWeight: 500 }}><input type="checkbox" checked={!!f.wakeLate} onChange={(e) => set({ wakeLate: e.target.checked })} />No early starts (from 10:00)</label>
            </div>
          </div>
          <div className="eyebrow" style={{ margin: "20px 0 10px" }}>Interests</div>
          <div className="chips">
            {INTERESTS.map((i) => {
              const on = f.interests.includes(i.id);
              return <button key={i.id} className={`chip${on ? " on" : ""}`} onClick={() => set({ interests: on ? f.interests.filter((x) => x !== i.id) : [...f.interests, i.id] })}>{i.emoji} {i.label}</button>;
            })}
          </div>
          <div className="row wrap" style={{ marginTop: 20 }}>
            <button className="btn btn-primary" disabled={!datesOk || !f.interests.length} onClick={() => save(true)}><Sparkles />Save & regenerate itinerary</button>
            <button className="btn btn-secondary" disabled={!datesOk} onClick={() => save(false)}>Save only</button>
          </div>
        </Card>

        <Card title="Travellers" icon={Users} sub="Used for splitting expenses. Shared trips with voting are coming in a later release.">
          <div className="chips" style={{ marginBottom: 12 }}>
            {people.map((p, i) => (
              <span key={p + i} className="chip" style={{ cursor: "default" }}>
                <span className="avatar" style={{ width: 22, height: 22, fontSize: 11 }}>{p[0]}</span>{p}
                {people.length > 1 && <button style={{ border: 0, background: "none", padding: 0, display: "grid", color: "var(--muted)" }} onClick={() => setPeople(people.filter((_, j) => j !== i))} aria-label={`Remove ${p}`}><X size={14} /></button>}
              </span>
            ))}
          </div>
          <div className="row" style={{ maxWidth: 380 }}>
            <input className="input" value={newPerson} placeholder="Name" onChange={(e) => setNewPerson(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newPerson.trim()) { setPeople([...people, newPerson.trim()]); setNewPerson(""); } }} />
            <button className="btn btn-secondary" disabled={!newPerson.trim()} onClick={() => { setPeople([...people, newPerson.trim()]); setNewPerson(""); }}><Plus />Add</button>
          </div>
          <p className="muted" style={{ fontSize: 12.5 }}>Click “Save only” above to keep changes to travellers.</p>
        </Card>

        <Card title="Danger zone" icon={Trash2}>
          <p className="mt0 muted" style={{ fontSize: 13.5 }}>Deleting removes this trip, its itinerary, checklist and expenses from this device.</p>
          <button className="btn btn-secondary" style={{ color: "var(--danger)" }} onClick={() => {
            if (confirm(`Delete your ${trip.destination} trip? This can't be undone.`)) { deleteTrip(trip.id); go("overview"); }
          }}><Trash2 />Delete trip{state.trips.length === 1 ? " & start over" : ""}</button>
        </Card>
      </div>
    </>
  );
}
