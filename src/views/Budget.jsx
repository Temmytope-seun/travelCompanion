import { useMemo, useState } from "react";
import { Wallet, ArrowLeftRight, Receipt, Plus, Trash2, Users } from "lucide-react";
import { useStore } from "../store.jsx";
import { PageHead, Card, Progress, gbp } from "../components/ui.jsx";
import { destinationFor } from "../data/destinations.js";
import { daysBetween, today, fmtDay } from "../lib/dates.js";
import { isActivity } from "../lib/itinerary.js";
import { uid } from "../lib/itinerary.js";

const EXPENSE_CATS = ["Flights", "Hotel", "Food", "Taxi", "Activities", "Shopping", "Dental", "Other"];

export default function Budget({ live }) {
  const { trip, updateTrip } = useStore();
  const dest = destinationFor(trip);
  const nights = Math.max(daysBetween(trip.startDate, trip.endDate), 1);
  const n = trip.travellers;

  // PRD §36 estimate. Itinerary costs are per person; stays per room-night.
  const est = useMemo(() => {
    const items = trip.itinerary.flatMap((d) => d.items);
    const acts = items.filter((i) => isActivity(i) && i.category !== "dental").reduce((s, i) => s + (i.cost || 0), 0) * n;
    const food = items.filter((i) => i.meal || i.category === "food").reduce((s, i) => s + (i.cost || 0), 0) * n;
    const dental = items.filter((i) => i.category === "dental").reduce((s, i) => s + (i.cost || 0), 0);
    const flights = (trip.flight?.pricePerPerson || trip.estimates.flightPerPerson) * n;
    const rooms = Math.ceil(n / 3) || 1;
    const hotel = (trip.stay?.perNight || 90) * nights * (trip.stay?.type === "rental" ? 1 : rooms);
    const transport = 30 + 25 * trip.itinerary.filter((d) => d.items.some((i) => i.category === "transport" && !i.transfer)).length + (trip.transfer?.mode === "private" ? 35 : 20) * 2;
    return [
      ["Flights", flights, "ink"], ["Accommodation", hotel, "slate"], ["Transport", transport, "night"],
      ["Activities", acts, "coral"], ["Food", food, "sun"], ...(dental ? [["Dental (est. consult)", dental, "sea"]] : []),
    ];
  }, [trip, n, nights]);
  const total = est.reduce((s, [, v]) => s + v, 0);
  const max = Math.max(...est.map(([, v]) => v), 1);
  const over = trip.budget && total > trip.budget;

  return (
    <>
      <PageHead eyebrow="Budget & money" title="What this trip will cost" sub="Estimates update as you change your plan. Set a maximum and we'll flag when you go over." />
      <div className="stack">
        <div className="grid g2">
          <Card title="Estimated total" icon={Wallet}>
            <div className="row wrap between" style={{ alignItems: "flex-end", marginBottom: 14 }}>
              <div>
                <div className="big-num">{gbp(total)}</div>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>≈ {gbp(total / n)} per person · {nights} nights</div>
              </div>
              <label className="field" style={{ width: 150 }}>Max budget (£)
                <input type="number" min="0" step="50" value={trip.budget || ""} placeholder="None" onChange={(e) => updateTrip({ budget: Number(e.target.value) })} />
              </label>
            </div>
            {trip.budget > 0 && (
              <>
                <Progress value={(total / trip.budget) * 100} tone={over ? "bad" : total / trip.budget > 0.85 ? "warn" : ""} />
                <p style={{ fontSize: 13, margin: "8px 0 16px" }} className={over ? "" : "muted"}>
                  {over ? <><b style={{ color: "var(--danger)" }}>{gbp(total - trip.budget)} over budget.</b> Ask the assistant to “make day 2 cheaper”.</> : `${gbp(trip.budget - total)} left of ${gbp(trip.budget)}`}
                </p>
              </>
            )}
            <div className="bars">
              {est.map(([label, v, hue]) => (
                <div key={label} className={`bar-row hue-${hue}`}>
                  <span>{label}</span>
                  <div className="track"><span style={{ width: `${(v / max) * 100}%` }} /></div>
                  <b>{gbp(v)}</b>
                </div>
              ))}
            </div>
            <p className="disclaimer" style={{ marginTop: 16 }}>All figures are estimates, not provider prices.</p>
          </Card>
          <Converter live={live} dest={dest} />
        </div>
        <Expenses trip={trip} updateTrip={updateTrip} />
      </div>
    </>
  );
}

function Converter({ live, dest }) {
  const code = dest.currency.code;
  const [amount, setAmount] = useState(300);
  const [dir, setDir] = useState("out");
  const rate = live.fx?.rates?.[code] ?? dest.currency.fallbackRate;
  const result = rate ? (dir === "out" ? amount * rate : amount / rate) : null;
  const [from, to] = dir === "out" ? ["GBP", code] : [code, "GBP"];
  return (
    <Card title="Currency converter" icon={ArrowLeftRight}>
      <p className="mt0 ink2" style={{ fontSize: 13.5 }}>{dest.flag} {dest.name} uses the <b>{dest.currency.name} ({code})</b>.</p>
      <div className="converter">
        <label className="field">{from}<input type="number" min="0" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></label>
        <button className="icon-btn swap" onClick={() => setDir(dir === "out" ? "in" : "out")} aria-label="Swap currencies"><ArrowLeftRight /></button>
        <div className="field">{to}<div className="out-box">{result != null ? (result >= 100 ? Math.round(result).toLocaleString("en-GB") : result.toFixed(2)) : "—"}</div></div>
      </div>
      <div className="chips" style={{ margin: "12px 0" }}>
        {[50, 100, 300, 500].map((v) => <button key={v} className="chip" onClick={() => { setAmount(v); setDir("out"); }}>£{v}</button>)}
      </div>
      <p className="muted" style={{ fontSize: 13, margin: "0 0 8px" }}>{dest.cardTip}</p>
      <p className="muted" style={{ fontSize: 11.5, margin: 0 }}>{live.fx ? `Live mid-market rate via ${live.fx.source}` : "Estimated offline rate"} · Rates fluctuate and providers add fees.</p>
    </Card>
  );
}

function Expenses({ trip, updateTrip }) {
  const people = trip.people?.length ? trip.people : ["You"];
  const [f, setF] = useState({ label: "", amount: "", category: "Food", paidBy: people[0] });
  const total = trip.expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const share = total / people.length;
  const paid = Object.fromEntries(people.map((p) => [p, 0]));
  trip.expenses.forEach((e) => { paid[e.paidBy] = (paid[e.paidBy] || 0) + Number(e.amount || 0); });
  const settle = settleUp(people.map((p) => [p, (paid[p] || 0) - share]));

  const add = () => {
    if (!f.label.trim() || !Number(f.amount)) return;
    updateTrip((t) => ({ expenses: [...t.expenses, { ...f, id: uid(), amount: Number(f.amount), date: today() }] }));
    setF({ ...f, label: "", amount: "" });
  };

  return (
    <div className="grid g2">
      <Card title="Trip expenses" icon={Receipt} action={<span className="badge">{gbp(total)} spent</span>}>
        <div className="form-grid" style={{ gridTemplateColumns: "2fr 1fr", marginBottom: 10 }}>
          <input className="input" placeholder="What was it?" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />
          <input className="input" type="number" min="0" placeholder="£" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} onKeyDown={(e) => e.key === "Enter" && add()} />
          <select className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{EXPENSE_CATS.map((c) => <option key={c}>{c}</option>)}</select>
          <select className="input" value={f.paidBy} onChange={(e) => setF({ ...f, paidBy: e.target.value })} aria-label="Paid by">{people.map((p) => <option key={p}>{p}</option>)}</select>
        </div>
        <button className="btn btn-dark btn-sm" onClick={add}><Plus />Add expense</button>
        {trip.expenses.length > 0 && (
          <table className="table" style={{ marginTop: 14 }}>
            <thead><tr><th>Item</th><th>Paid by</th><th className="r">£</th><th /></tr></thead>
            <tbody>
              {trip.expenses.map((e) => (
                <tr key={e.id}>
                  <td>{e.label}<br /><small className="muted">{e.category} · {fmtDay(e.date)}</small></td>
                  <td>{e.paidBy}</td>
                  <td className="r">{Number(e.amount).toFixed(2)}</td>
                  <td className="r"><button className="icon-btn" style={{ border: 0, background: "none", width: 28, height: 28 }} aria-label="Delete expense" onClick={() => updateTrip((t) => ({ expenses: t.expenses.filter((x) => x.id !== e.id) }))}><Trash2 /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <Card title="Who owes whom" icon={Users} sub={`Split evenly between ${people.length} ${people.length === 1 ? "person" : "people"} · ${gbp(share)} each`}>
        {people.length < 2 ? <p className="muted mt0">Add travellers in Trip settings to split costs.</p> : !settle.length ? (
          <p className="muted mt0">{total ? "Everyone's square. 🎉" : "Add expenses to see balances."}</p>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            {settle.map(([a, b, amt]) => (
              <div className="owe" key={a + b}>
                <span className="avatar">{a[0]}</span><b>{a}</b><span className="muted">owes</span><span className="avatar" style={{ background: "var(--sea-soft)", color: "var(--sea)" }}>{b[0]}</span><b>{b}</b>
                <b className="num" style={{ marginLeft: "auto" }}>{gbp(amt)}</b>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/** Greedy settlement: debtors pay creditors until balances are ~zero. */
function settleUp(balances) {
  const debt = balances.filter(([, v]) => v < -0.5).map(([p, v]) => [p, -v]);
  const cred = balances.filter(([, v]) => v > 0.5).map(([p, v]) => [p, v]);
  const out = [];
  let i = 0;
  let j = 0;
  while (i < debt.length && j < cred.length) {
    const amt = Math.min(debt[i][1], cred[j][1]);
    out.push([debt[i][0], cred[j][0], amt]);
    debt[i][1] -= amt;
    cred[j][1] -= amt;
    if (debt[i][1] < 0.5) i++;
    if (cred[j][1] < 0.5) j++;
  }
  return out;
}
