import { useMemo, useState } from "react";
import { Search, MapPin, Clock, Plus, ExternalLink, Star, Sparkles, Globe, Loader2, Check, BedDouble, Stethoscope, Info } from "lucide-react";
import { useStore } from "../store.jsx";
import { PageHead, Card, Empty } from "../components/ui.jsx";
import { catalogFor } from "../data/destinations.js";
import { cat } from "../data/catalog.js";
import { addPlace, bestDayFor, matchPercent, reasonFor, scorePlace } from "../lib/itinerary.js";
import { PLACES_KEY, searchPlaces, placePhotoUrl } from "../lib/api.js";
import { activityUrl, airbnbUrl, bookingUrl, mapsSearchUrl } from "../lib/links.js";

const TABS = [
  { id: "foryou", label: "For you", icon: Sparkles },
  { id: "activities", label: "Activities" },
  { id: "water", label: "Beaches & water" },
  { id: "culture", label: "Culture & history" },
  { id: "food", label: "Food" },
  { id: "nightlife", label: "Nightlife" },
  { id: "stays", label: "Stays", icon: BedDouble },
  { id: "dental", label: "Dental", icon: Stethoscope },
];
const IN_TAB = {
  activities: ["adventure", "wellness", "shopping", "hiking", "photography"],
  water: ["beach", "water"],
  culture: ["culture", "history"],
  nightlife: ["nightlife"],
  dental: ["dental"],
};

export default function Discover() {
  const { trip, setItinerary, notify, undo, updateTrip } = useStore();
  const { dest, places, food, stays } = catalogFor(trip);
  const [tab, setTab] = useState("foryou");
  const [q, setQ] = useState("");
  const [price, setPrice] = useState("any");
  const [setting, setSetting] = useState("any");
  const [live, setLive] = useState(null);
  const [loading, setLoading] = useState(false);
  const used = new Set(trip.itinerary.flatMap((d) => d.items.map((i) => i.placeId)));

  const items = useMemo(() => {
    let list = tab === "food" ? food.map((f) => ({ ...f, category: "food", tags: ["food"] })) : places;
    if (tab === "foryou") list = places.filter((p) => p.category !== "dental" || trip.interests.includes("dental")).sort((a, b) => scorePlace(b, trip) - scorePlace(a, trip)).slice(0, 7);
    else if (IN_TAB[tab]) list = list.filter((p) => IN_TAB[tab].includes(p.category));
    if (q) list = list.filter((p) => `${p.name} ${p.category} ${(p.tags || []).join(" ")} ${p.area}`.toLowerCase().includes(q.toLowerCase()));
    if (price !== "any") list = list.filter((p) => (price === "free" ? !p.cost : (p.cost || 0) <= Number(price)));
    if (setting !== "any") list = list.filter((p) => (setting === "outdoor" ? p.outdoor : !p.outdoor));
    return tab === "foryou" ? list : [...list].sort((a, b) => scorePlace(b, trip) - scorePlace(a, trip));
  }, [tab, q, price, setting, places, food, trip]);

  const add = (p) => {
    const r = addPlace(trip.itinerary, p);
    setItinerary(r.itinerary, `add ${p.name}`);
    notify(`Added ${p.name} to Day ${r.day + 1} at ${r.item.time}`, { label: "Undo", run: undo });
  };

  const searchLive = async () => {
    if (!q.trim()) return;
    if (!PLACES_KEY) { notify("Add VITE_GOOGLE_MAPS_API_KEY to search live Google Places."); return; }
    setLoading(true);
    try { setLive(await searchPlaces(`${q} in ${trip.city}, ${trip.destination}`)); }
    catch (e) { notify(e.message); }
    finally { setLoading(false); }
  };

  return (
    <>
      <PageHead
        eyebrow={`Discover · ${dest.city}`}
        title={tab === "foryou" ? `Based on your interests, I've selected these ${items.length} experiences.` : `Explore ${dest.city}`}
        sub={tab === "foryou" ? "Ranked by interest match, popularity, budget fit and how well they sit with your other plans." : undefined}
      />

      <div className="searchbar" style={{ marginBottom: 14 }}>
        <Search />
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchLive()} placeholder={`Try “boat cruise”, “cheap restaurants”, “things to do tonight”…`} />
        <button className="btn btn-dark btn-sm" onClick={searchLive} disabled={loading}>{loading ? <Loader2 className="spin" /> : <Globe />}Search live</button>
      </div>

      <div className="row wrap between" style={{ marginBottom: 18, gap: 12 }}>
        <div className="chips">
          {TABS.filter((t) => t.id !== "dental" || trip.interests.includes("dental") || places.some((p) => p.category === "dental")).map((t) => (
            <button key={t.id} className={`chip${tab === t.id ? " on" : ""}`} onClick={() => { setTab(t.id); setLive(null); }}>{t.icon && <t.icon />}{t.label}</button>
          ))}
        </div>
        {tab !== "stays" && (
          <div className="row wrap" style={{ gap: 8 }}>
            <select className="input" style={{ width: "auto", padding: "7px 10px", fontSize: 13 }} value={price} onChange={(e) => setPrice(e.target.value)} aria-label="Price">
              <option value="any">Any price</option><option value="free">Free</option><option value="20">Under £20</option><option value="50">Under £50</option>
            </select>
            <select className="input" style={{ width: "auto", padding: "7px 10px", fontSize: 13 }} value={setting} onChange={(e) => setSetting(e.target.value)} aria-label="Indoor or outdoor">
              <option value="any">Indoor & outdoor</option><option value="indoor">Indoor</option><option value="outdoor">Outdoor</option>
            </select>
          </div>
        )}
      </div>

      {live && <LiveResults results={live} onClear={() => setLive(null)} />}

      {tab === "stays" ? <Stays stays={stays} trip={trip} updateTrip={updateTrip} notify={notify} /> : (
        <>
          {tab === "dental" && <DentalIntro city={dest.city} />}
          <div className="place-grid">
            {items.map((p) => <PlaceCard key={p.id} p={p} trip={trip} added={used.has(p.id)} onAdd={() => add(p)} day={bestDayFor(trip.itinerary, p) + 1} />)}
          </div>
          {!items.length && <Empty icon={Search} title="No matches">Try another category, or search live places.</Empty>}
        </>
      )}

      <p className="disclaimer" style={{ marginTop: 24 }}>
        Prices are estimates per person unless verified with the provider. “AI pick” marks recommendations generated by JourneyAI; bookings open the provider's own site.
      </p>
    </>
  );
}

function PlaceCard({ p, trip, added, onAdd, day }) {
  const c = cat(p.category);
  const pct = matchPercent(p, trip);
  return (
    <article className={`card place hue-${c.hue}`}>
      <div className="place-cover">
        <c.icon />
        <div className="badges">
          <span className="badge match">{pct}% match</span>
          <span className="badge"><Sparkles />AI pick</span>
        </div>
      </div>
      <div className="place-body">
        <h3>{p.name}</h3>
        <div className="meta">
          <span><MapPin />{p.area}</span>
          <span><Clock />{p.duration >= 60 ? `${Math.round(p.duration / 30) / 2} h` : `${p.duration} min`}</span>
          <span>{p.cost ? `Est. £${p.cost} pp` : "Free"}</span>
        </div>
        <div className="why"><b>Why you'll like it · </b>{reasonFor(p, trip)} {p.why}</div>
        <div className="place-actions">
          {p.meal ? null : added ? (
            <span className="badge ok" style={{ padding: "6px 10px" }}><Check />In your plan</span>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={onAdd}><Plus />Add to Day {day}</button>
          )}
          <a className="btn btn-secondary btn-sm" href={mapsSearchUrl(p.search || `${p.name} ${trip.city}`)} target="_blank" rel="noreferrer">Map</a>
          {p.cost > 0 && !p.meal && p.category !== "dental" && <a className="btn btn-ghost btn-sm" href={activityUrl(`${p.name} ${trip.city}`)} target="_blank" rel="noreferrer">Book <ExternalLink /></a>}
        </div>
      </div>
    </article>
  );
}

function Stays({ stays, trip, updateTrip, notify }) {
  return (
    <>
      {trip.stay?.booked && (
        <div className="attention" style={{ borderLeftColor: "var(--sea)", marginBottom: 16 }}>
          <span className="ic" style={{ background: "var(--sea-soft)", color: "var(--sea)" }}><Check /></span>
          <div><b>You're staying at {trip.stay.name}</b><p>Recommendations below are for reference.</p></div>
        </div>
      )}
      <div className="place-grid">
        {stays.map((s) => (
          <article className="card place hue-slate" key={s.id}>
            <div className="place-cover"><BedDouble />
              <div className="badges"><span className="badge">{s.type === "rental" ? "Airbnb / rental" : s.type[0].toUpperCase() + s.type.slice(1)}</span><span className="badge">{s.price}</span></div>
            </div>
            <div className="place-body">
              <h3>{s.name}</h3>
              <div className="meta"><span><MapPin />{s.area}</span><span>Est. £{s.perNight}/night</span></div>
              <div className="why">
                <b>Why we recommend it</b>
                <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{s.why.map((w) => <li key={w}>{w}</li>)}</ul>
              </div>
              <div className="place-actions">
                <a className="btn btn-secondary btn-sm" href={s.type === "rental" ? airbnbUrl(trip) : bookingUrl(trip, `${s.area}`)} target="_blank" rel="noreferrer">View options <ExternalLink /></a>
                <button className="btn btn-primary btn-sm" onClick={() => {
                  updateTrip((t) => ({ stay: { ...t.stay, booked: true, name: s.name, type: s.type, perNight: s.perNight } }));
                  notify(`Accommodation saved: ${s.name}`);
                }}>I booked this</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function DentalIntro({ city }) {
  return (
    <Card title="Dental care while you travel" icon={Stethoscope} style={{ marginBottom: 16 }}>
      <div className="grid g2">
        <div>
          <p className="mt0" style={{ fontSize: 13.5 }}>Compare clinics by Google rating and number of reviews. Check languages spoken, before/after photos and whether treatment needs several visits — then plan your appointment early in the trip.</p>
          <div className="row wrap">
            <a className="btn btn-dark btn-sm" href={mapsSearchUrl(`dental clinic ${city}`)} target="_blank" rel="noreferrer">Clinics on Google Maps <ExternalLink /></a>
          </div>
        </div>
        <div className="why">
          <b>What to check in reviews</b>
          <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
            <li>Professional staff & English spoken</li><li>Modern facilities and clear pricing</li><li>Waiting times and follow-up visits</li>
          </ul>
        </div>
      </div>
      <p className="disclaimer" style={{ marginTop: 14 }}><Info size={12} style={{ verticalAlign: -2 }} /> JourneyAI provides travel and provider-discovery information and does not give medical advice. Verify treatment suitability, qualifications, pricing and appointment availability with the provider.</p>
    </Card>
  );
}

function LiveResults({ results, onClear }) {
  return (
    <Card title="Live results from Google" icon={Globe} action={<button className="btn btn-ghost btn-sm" onClick={onClear}>Clear</button>} style={{ marginBottom: 18 }}>
      {!results.length ? <p className="muted mt0">No live results.</p> : (
        <div className="place-grid">
          {results.map((p) => {
            const name = p.displayName?.text || "Place";
            const photo = placePhotoUrl(p.photos?.[0]);
            return (
              <article className="card place hue-sea" key={p.id} style={{ boxShadow: "none" }}>
                <div className="place-cover">{photo ? <img src={photo} alt={name} loading="lazy" /> : <MapPin />}
                  <div className="badges"><span className="badge">Live · Google</span></div>
                </div>
                <div className="place-body">
                  <h3>{name}</h3>
                  <div className="meta"><span><Star style={{ color: "var(--sun)" }} />{p.rating ?? "—"} ({p.userRatingCount ?? 0})</span></div>
                  <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>{p.formattedAddress}</p>
                  <div className="place-actions">
                    {p.websiteUri && <a className="btn btn-secondary btn-sm" href={p.websiteUri} target="_blank" rel="noreferrer">Website <ExternalLink /></a>}
                    <a className="btn btn-ghost btn-sm" href={p.googleMapsUri || mapsSearchUrl(name)} target="_blank" rel="noreferrer">Reviews & directions</a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Card>
  );
}
