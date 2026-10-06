import { useEffect, useMemo, useState } from "react";
import { Bell, BellRing, ExternalLink, X, Check, ArrowRight } from "lucide-react";
import { useStore } from "../store.jsx";
import { PageHead, Card, Empty } from "../components/ui.jsx";
import { buildReminders, splitReminders } from "../lib/reminders.js";
import { relative } from "../lib/dates.js";

const fmtWhen = (d) => d.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Shows due reminders as system notifications while the app is open (PRD §40). */
export function useBrowserNotifications(trip) {
  useEffect(() => {
    if (!trip || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const now = Date.now();
    const timers = buildReminders(trip)
      .filter((r) => !trip.dismissed.includes(r.id) && !r.done && r.at - now > 0 && r.at - now < 24 * 3600000)
      .map((r) => setTimeout(() => new Notification(r.title, { body: r.body, icon: "/icon.svg", tag: r.id }), r.at - now));
    return () => timers.forEach(clearTimeout);
  }, [trip]);
}

export default function Alerts({ go }) {
  const { trip, updateTrip } = useStore();
  const [perm, setPerm] = useState(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  const groups = useMemo(() => splitReminders(buildReminders(trip), trip.dismissed), [trip]);

  const dismiss = (id) => updateTrip((t) => ({ dismissed: [...t.dismissed, id] }));
  const enable = async () => setPerm(await Notification.requestPermission());

  const Row = ({ r, state }) => (
    <div className={`alert-row ${state}${r.urgent ? " urgent" : ""}`}>
      <span className="alert-emoji" aria-hidden>{r.emoji}</span>
      <div>
        <b>{r.title}</b>
        <p>{r.body}</p>
        {(r.cta || r.view || r.action) && state !== "past" && (
          <div className="acts">
            {r.cta && <a className="btn btn-primary btn-sm" href={r.cta.href} target="_blank" rel="noreferrer">{r.cta.label} <ExternalLink /></a>}
            {r.action === "checkin" && <button className="btn btn-secondary btn-sm" onClick={() => updateTrip((t) => ({ flight: { ...t.flight, checkedIn: true } }))}><Check />Check-in completed</button>}
            {r.view && <button className="btn btn-secondary btn-sm" onClick={() => go(r.view)}>Open <ArrowRight /></button>}
          </div>
        )}
      </div>
      <div style={{ textAlign: "right" }}>
        <time dateTime={r.at.toISOString()} title={fmtWhen(r.at)}>{state === "upcoming" ? fmtWhen(r.at) : relative(r.at)}</time>
        {state !== "past" && <div><button className="icon-btn" style={{ border: 0, background: "none", marginLeft: "auto", marginTop: 4 }} onClick={() => dismiss(r.id)} aria-label="Dismiss"><X /></button></div>}
      </div>
    </div>
  );

  return (
    <>
      <PageHead
        eyebrow="Alerts"
        title="Reminders that arrive at the right moment"
        sub="Generated from your dates, flights and plans: check-in 24 hours before you fly, transfer warnings for late arrivals, and nudges before each activity."
        actions={perm === "default" ? <button className="btn btn-dark" onClick={enable}><BellRing />Enable notifications</button>
          : perm === "granted" ? <span className="badge ok"><Check />Notifications on</span> : null}
      />
      <div className="stack">
        <Card title="Needs attention" icon={BellRing} action={<span className="badge accent">{groups.due.length}</span>}>
          {groups.due.length ? groups.due.map((r) => <Row key={r.id} r={r} state="due" />) : <Empty icon={Bell} title="You're all caught up">New reminders appear here as your trip approaches.</Empty>}
        </Card>
        <Card title="Coming up" icon={Bell} action={<span className="badge">{groups.upcoming.length}</span>}>
          {groups.upcoming.map((r) => <Row key={r.id} r={r} state="upcoming" />)}
          {!groups.upcoming.length && <p className="muted mt0">Nothing scheduled.</p>}
        </Card>
        {groups.past.length > 0 && (
          <Card title="Earlier" action={trip.dismissed.length ? <button className="btn btn-ghost btn-sm" onClick={() => updateTrip({ dismissed: [] })}>Restore dismissed</button> : null}>
            {groups.past.map((r) => <Row key={r.id} r={r} state="past" />)}
          </Card>
        )}
      </div>
    </>
  );
}
