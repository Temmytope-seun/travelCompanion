import { useState } from "react";
import { Check, Plus, Trash2, Link2 } from "lucide-react";
import { useStore } from "../store.jsx";
import { PageHead, Card, Ring, Progress, StatusIcon } from "../components/ui.jsx";
import { isChecked } from "../lib/readiness.js";
import { uid } from "../lib/itinerary.js";

const LINK_PATCH = {
  flight: (t, v) => ({ flight: { ...t.flight, booked: v } }),
  stay: (t, v) => ({ stay: { ...t.stay, booked: v } }),
  transfer: (t, v) => ({ transfer: { ...t.transfer, booked: v } }),
  checkin: (t, v) => ({ flight: { ...t.flight, checkedIn: v } }),
};

export default function Checklist({ ready, go }) {
  const { trip, updateTrip } = useStore();
  const [draft, setDraft] = useState("");
  const [group, setGroup] = useState("Packing");
  const groups = [...new Set(trip.checklist.map((c) => c.group))];

  const toggle = (item) => {
    const v = !isChecked(trip, item);
    if (item.link) {
      if (item.link === "flight" && v) { go("bookings"); return; }
      updateTrip((t) => LINK_PATCH[item.link](t, v));
    } else {
      updateTrip((t) => ({ checklist: t.checklist.map((c) => (c.id === item.id ? { ...c, done: v } : c)) }));
    }
  };

  const add = () => {
    if (!draft.trim()) return;
    updateTrip((t) => ({ checklist: [...t.checklist, { id: uid(), label: draft.trim(), group, custom: true, done: false }] }));
    setDraft("");
  };

  return (
    <>
      <PageHead eyebrow="Checklist" title="Get to 100% ready" sub="Generated for this trip. Items linked to bookings tick themselves off when you add the booking." />

      <div className="grid" style={{ gridTemplateColumns: "minmax(0, 300px) minmax(0, 1fr)", alignItems: "start" }} data-cl>
        <div className="stack" style={{ position: "sticky", top: 20 }}>
          <Card>
            <div style={{ display: "grid", placeItems: "center", gap: 10, padding: "6px 0 4px" }}>
              <Ring value={ready.score} size={150} stroke={12} />
              <div className="muted" style={{ fontSize: 13 }}>{ready.listDone} of {ready.listTotal} items done</div>
            </div>
            <hr className="divider" />
            <div className="stack" style={{ gap: 8 }}>
              {ready.essentials.map((e) => (
                <div key={e.id} className="row" style={{ fontSize: 13.5 }}><StatusIcon status={e.status} /><span style={{ flex: 1 }}>{e.label}</span></div>
              ))}
            </div>
          </Card>
          <Card title="Add an item">
            <div className="stack" style={{ gap: 8 }}>
              <input className="input" value={draft} placeholder="What do you need to remember?" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
              <div className="row">
                <select className="input" value={group} onChange={(e) => setGroup(e.target.value)}>{groups.map((g) => <option key={g}>{g}</option>)}</select>
                <button className="btn btn-primary" onClick={add} disabled={!draft.trim()}><Plus />Add</button>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid g2" style={{ alignItems: "start" }}>
          {groups.map((g) => {
            const items = trip.checklist.filter((c) => c.group === g);
            const done = items.filter((c) => isChecked(trip, c)).length;
            return (
              <Card key={g} className="check-group">
                <h3><span>{g}</span><span>{done}/{items.length}</span></h3>
                <Progress value={(done / items.length) * 100} />
                <div style={{ marginTop: 8 }}>
                  {items.map((c) => {
                    const on = isChecked(trip, c);
                    return (
                      <div key={c.id} className="row" style={{ gap: 0 }}>
                        <button className={`check${on ? " done" : ""}`} onClick={() => toggle(c)} aria-pressed={on}>
                          <span className="box"><Check /></span>
                          <span>{c.label}</span>
                          {c.link && <Link2 size={13} className="muted" aria-label="Linked to bookings" />}
                          {c.essential && !on && <span className="badge accent">Essential</span>}
                        </button>
                        {c.custom && (
                          <button className="icon-btn" style={{ border: 0, background: "none" }} aria-label={`Delete ${c.label}`}
                            onClick={() => updateTrip((t) => ({ checklist: t.checklist.filter((x) => x.id !== c.id) }))}><Trash2 /></button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
      <style>{`@media (max-width: 1100px) { [data-cl] { grid-template-columns: 1fr !important; } [data-cl] > .stack { position: static !important; } }`}</style>
    </>
  );
}
