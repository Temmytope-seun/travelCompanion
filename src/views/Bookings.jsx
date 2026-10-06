import { useState } from "react";
import { Plane, BedDouble, Car, ExternalLink, Pencil, AlertTriangle, Check, Plus, Compass } from "lucide-react";
import { useStore } from "../store.jsx";
import { PageHead, Card, Modal } from "../components/ui.jsx";
import { destinationFor } from "../data/destinations.js";
import { TRANSFER_MODES } from "../data/catalog.js";
import { splitDateTime, fmtDay, daysBetween, today } from "../lib/dates.js";
import { googleFlightsUrl, checkinUrl, bookingUrl, airbnbUrl, transferUrl } from "../lib/links.js";
import { isLateArrival } from "../lib/readiness.js";
import { generateItinerary } from "../lib/itinerary.js";

export default function Bookings({ go }) {
  const { trip, updateTrip, setItinerary, notify, undo } = useStore();
  const dest = destinationFor(trip);
  const [editing, setEditing] = useState(null);

  const saveFlight = (key, data) => {
    const next = { ...trip, [key]: { ...trip[key], ...data, booked: true } };
    updateTrip({ [key]: next[key] });
    setEditing(null);
    setItinerary(generateItinerary(next), "flight update");
    notify("Flight saved — itinerary adjusted to your times", { label: "Undo plan change", run: undo });
  };

  const late = isLateArrival(trip);
  const flightSoon = trip.flight?.booked && trip.flight.depart && daysBetween(today(), splitDateTime(trip.flight.depart).date) <= 1;

  return (
    <>
      <PageHead eyebrow="Bookings" title="Flights, stay & transfers" sub="Everything you've booked, wherever you booked it. Bookings made on other sites still appear in your plan." />

      <div className="stack">
        <section>
          <div className="row between" style={{ marginBottom: 10 }}>
            <h2 className="display" style={{ fontSize: 22, margin: 0 }}>Outbound flight</h2>
            {trip.flight?.booked && <button className="btn btn-ghost btn-sm" onClick={() => setEditing("flight")}><Pencil />Edit</button>}
          </div>
          {trip.flight?.booked ? (
            <>
              <BoardingPass f={trip.flight} fromLabel={trip.origin} toLabel={dest.city} toCode={dest.airport.code} />
              <div className={`attention${flightSoon && !trip.flight.checkedIn ? " urgent" : ""}`} style={{ marginTop: 12, borderLeftColor: trip.flight.checkedIn ? "var(--sea)" : undefined }}>
                <span className="ic" style={trip.flight.checkedIn ? { background: "var(--sea-soft)", color: "var(--sea)" } : undefined}>{trip.flight.checkedIn ? <Check /> : <Plane />}</span>
                <div>
                  <b>{trip.flight.checkedIn ? "Check-in completed" : "Online check-in"}</b>
                  <p>{trip.flight.checkedIn ? "Boarding pass ready? Download it to your phone." : "Opens 24 hours before departure — we'll remind you."}</p>
                </div>
                <div className="row" style={{ marginLeft: "auto" }}>
                  {!trip.flight.checkedIn && <a className="btn btn-secondary btn-sm" href={checkinUrl(trip.flight.airline)} target="_blank" rel="noreferrer">Check in <ExternalLink /></a>}
                  <label className="switch"><input type="checkbox" checked={!!trip.flight.checkedIn} onChange={(e) => updateTrip({ flight: { ...trip.flight, checkedIn: e.target.checked } })} /><span className="sr-only">Check-in completed</span></label>
                </div>
              </div>
            </>
          ) : (
            <NotBooked icon={Plane} title="Have you already booked your flight?" body={`${trip.origin} → ${dest.city} · ${fmtDay(trip.startDate)} – ${fmtDay(trip.endDate)} · ${trip.travellers} ${trip.travellers === 1 ? "adult" : "adults"}`}>
              <a className="btn btn-primary" href={googleFlightsUrl(trip, dest.airport.code)} target="_blank" rel="noreferrer">Find flights on Google Flights <ExternalLink /></a>
              <button className="btn btn-secondary" onClick={() => setEditing("flight")}><Plus />Add my booking</button>
            </NotBooked>
          )}
        </section>

        <section>
          <div className="row between" style={{ marginBottom: 10 }}>
            <h2 className="display" style={{ fontSize: 22, margin: 0 }}>Return flight</h2>
            {trip.returnFlight?.booked && <button className="btn btn-ghost btn-sm" onClick={() => setEditing("returnFlight")}><Pencil />Edit</button>}
          </div>
          {trip.returnFlight?.booked ? (
            <BoardingPass f={trip.returnFlight} fromLabel={dest.city} toLabel={trip.origin} fromCode={dest.airport.code} toCode={trip.originAirport} />
          ) : (
            <NotBooked icon={Plane} title="Add your flight home" body="We'll plan your last day around it: checkout, transfer to the airport and check-in reminders.">
              <button className="btn btn-secondary" onClick={() => setEditing("returnFlight")}><Plus />Add return flight</button>
            </NotBooked>
          )}
        </section>

        <div className="grid g2">
          <Card title="Accommodation" icon={BedDouble} action={trip.stay?.booked && <button className="btn btn-ghost btn-sm" onClick={() => setEditing("stay")}><Pencil />Edit</button>}>
            {trip.stay?.booked ? (
              <div className="stack" style={{ gap: 10 }}>
                <div><div className="display" style={{ fontSize: 20 }}>{trip.stay.name}</div>{trip.stay.address && <div className="muted" style={{ fontSize: 13 }}>{trip.stay.address}</div>}</div>
                <div className="pass-fields">
                  <div><small>Check-in</small><b>{trip.stay.checkIn || "15:00"}</b></div>
                  <div><small>Checkout</small><b>{trip.stay.checkOut || "11:00"}</b></div>
                  <div><small>Ref</small><b>{trip.stay.ref || "—"}</b></div>
                  <div><small>Nights</small><b>{daysBetween(trip.startDate, trip.endDate)}</b></div>
                </div>
              </div>
            ) : (
              <>
                <p className="mt0 ink2">Where would you like to stay? We've picked options that suit {trip.travellers > 2 ? "a group" : "you"}.</p>
                <div className="row wrap">
                  <button className="btn btn-primary btn-sm" onClick={() => go("discover")}><Compass />See recommendations</button>
                  <a className="btn btn-secondary btn-sm" href={bookingUrl(trip)} target="_blank" rel="noreferrer">Booking.com <ExternalLink /></a>
                  <a className="btn btn-secondary btn-sm" href={airbnbUrl(trip)} target="_blank" rel="noreferrer">Airbnb <ExternalLink /></a>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing("stay")}><Plus />Add booking</button>
                </div>
              </>
            )}
          </Card>

          <Card title="Airport transfer" icon={Car}>
            {late && !trip.transfer?.booked && (
              <div className="conflict-banner" style={{ marginBottom: 12 }}>
                <AlertTriangle />
                <span><b>Late-night arrival.</b> Your flight lands at {splitDateTime(trip.flight.arrive).time}. Arrange transport before you leave.</span>
              </div>
            )}
            <p className="mt0 ink2" style={{ fontSize: 13.5 }}>How will you get from {dest.airport.name} to your accommodation?</p>
            <div className="chips" style={{ marginBottom: 10 }}>
              {TRANSFER_MODES.map((m) => (
                <button key={m.id} className={`chip${trip.transfer?.mode === m.id ? " on" : ""}`} onClick={() => updateTrip({ transfer: { ...trip.transfer, mode: m.id } })}>{m.label}</button>
              ))}
            </div>
            <p className="muted" style={{ fontSize: 12.5, margin: "0 0 12px" }}>{TRANSFER_MODES.find((m) => m.id === trip.transfer?.mode)?.note}</p>
            <div className="row wrap between">
              <a className="btn btn-secondary btn-sm" href={transferUrl(trip, dest.airport.name)} target="_blank" rel="noreferrer">Book airport transfer <ExternalLink /></a>
              <label className="switch"><input type="checkbox" checked={!!trip.transfer?.booked} onChange={(e) => updateTrip({ transfer: { ...trip.transfer, booked: e.target.checked } })} />Arranged</label>
            </div>
          </Card>
        </div>
      </div>

      {(editing === "flight" || editing === "returnFlight") && (
        <FlightForm initial={trip[editing]} title={editing === "flight" ? "Outbound flight" : "Return flight"} onClose={() => setEditing(null)} onSave={(d) => saveFlight(editing, d)} />
      )}
      {editing === "stay" && <StayForm initial={trip.stay} onClose={() => setEditing(null)} onSave={(d) => { updateTrip({ stay: { ...trip.stay, ...d, booked: true } }); setEditing(null); notify("Accommodation saved"); }} />}
    </>
  );
}

function NotBooked({ icon: Icon, title, body, children }) {
  return (
    <div className="card" style={{ borderStyle: "dashed", boxShadow: "none", background: "var(--surface-2)" }}>
      <div className="row" style={{ alignItems: "flex-start", gap: 14 }}>
        <span className="tl-ic hue-coral" style={{ width: 42, height: 42 }}><Icon /></span>
        <div style={{ flex: 1 }}>
          <b style={{ fontSize: 15.5 }}>{title}</b>
          <p className="muted" style={{ margin: "3px 0 14px", fontSize: 13.5 }}>{body}</p>
          <div className="row wrap">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function BoardingPass({ f, fromLabel, toLabel, fromCode, toCode }) {
  const dep = splitDateTime(f.depart);
  const arr = splitDateTime(f.arrive);
  return (
    <div className="pass">
      <div className="pass-main">
        <div className="row between">
          <span className="eyebrow">{f.airline || "Flight"} · {f.number || "—"}</span>
          <span className="badge ok"><Check />Booked</span>
        </div>
        <div className="pass-route">
          <div><div className="code">{f.from || fromCode || "—"}</div><small>{fromLabel}</small></div>
          <div className="pass-line"><Plane /></div>
          <div style={{ textAlign: "right" }}><div className="code">{f.to || toCode || "—"}</div><small>{toLabel}</small></div>
        </div>
        <div className="pass-fields">
          <div><small>Date</small><b>{dep.date ? fmtDay(dep.date) : "—"}</b></div>
          <div><small>Departs</small><b>{dep.time || "—"}</b></div>
          <div><small>Arrives</small><b>{arr.time || "—"}{arr.date && dep.date && arr.date !== dep.date ? " +1" : ""}</b></div>
          <div><small>Terminal</small><b>{f.terminal || "—"}</b></div>
        </div>
      </div>
      <div className="pass-stub">
        <div><small className="eyebrow">Booking ref</small><div className="ref">{f.ref || "——"}</div></div>
        <div className="barcode" style={{ flex: 1, minWidth: 80 }} />
      </div>
    </div>
  );
}

function FlightForm({ initial = {}, title, onClose, onSave }) {
  const [f, setF] = useState({ airline: "", number: "", from: "", to: "", depart: "", arrive: "", terminal: "", ref: "", ...initial });
  const set = (k) => (e) => setF({ ...f, [k]: ["number", "from", "to", "ref"].includes(k) ? e.target.value.toUpperCase() : e.target.value });
  return (
    <Modal onClose={onClose} label={title}>
      <h2>{title}</h2>
      <p className="muted" style={{ marginTop: 0 }}>We'll create the flight event, plan around your times and remind you to check in.</p>
      <div className="form-grid">
        <label className="field">Airline<input value={f.airline} onChange={set("airline")} /></label>
        <label className="field">Flight number<input value={f.number} onChange={set("number")} /></label>
        <label className="field">From (airport code)<input value={f.from} maxLength={3} onChange={set("from")} /></label>
        <label className="field">To (airport code)<input value={f.to} maxLength={3} onChange={set("to")} /></label>
        <label className="field">Departs<input type="datetime-local" value={f.depart} onChange={set("depart")} /></label>
        <label className="field">Arrives (local time)<input type="datetime-local" value={f.arrive} onChange={set("arrive")} /></label>
        <label className="field">Terminal<input value={f.terminal} onChange={set("terminal")} /></label>
        <label className="field">Booking reference<input value={f.ref} onChange={set("ref")} /></label>
      </div>
      <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} disabled={!f.depart} onClick={() => onSave(f)}>Save flight</button>
    </Modal>
  );
}

function StayForm({ initial = {}, onClose, onSave }) {
  const [f, setF] = useState({ name: "", address: "", checkIn: "15:00", checkOut: "11:00", ref: "", phone: "", ...initial });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal onClose={onClose} label="Accommodation">
      <h2>Accommodation</h2>
      <div className="form-grid" style={{ marginTop: 12 }}>
        <label className="field full">Name<input value={f.name} onChange={set("name")} /></label>
        <label className="field full">Address<input value={f.address} onChange={set("address")} /></label>
        <label className="field">Check-in time<input type="time" value={f.checkIn} onChange={set("checkIn")} /></label>
        <label className="field">Checkout time<input type="time" value={f.checkOut} onChange={set("checkOut")} /></label>
        <label className="field">Booking reference<input value={f.ref} onChange={set("ref")} /></label>
        <label className="field">Phone<input value={f.phone} onChange={set("phone")} /></label>
      </div>
      <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} disabled={!f.name.trim()} onClick={() => onSave(f)}>Save accommodation</button>
    </Modal>
  );
}
