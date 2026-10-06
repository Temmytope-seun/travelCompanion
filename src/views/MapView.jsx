import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { List, Map as MapIcon } from "lucide-react";
import { useStore } from "../store.jsx";
import { PageHead } from "../components/ui.jsx";
import { destinationFor } from "../data/destinations.js";
import { cat } from "../data/catalog.js";
import { fmtDay } from "../lib/dates.js";

const HUES = { ink: "#14213d", slate: "#5b6475", sun: "#c9821b", plum: "#7a4a8c", sea: "#0f7b8a", coral: "#e4572e", night: "#3b3f8f" };
const DAY_COLORS = ["#e4572e", "#0f7b8a", "#7a4a8c", "#c9821b", "#3b3f8f", "#14213d"];

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function pin(content, color, numbered) {
  return L.divIcon({
    className: "",
    html: `<div class="pin${numbered ? " num" : ""}" style="--pc:${color}"><span>${content}</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [4, 30],
    popupAnchor: [12, -28],
  });
}

export default function MapView({ go, dark }) {
  const { trip } = useStore();
  const dest = destinationFor(trip);
  const [day, setDay] = useState("all");
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const markers = useRef({});

  const stops = useMemo(() => {
    const days = day === "all" ? trip.itinerary.map((d, i) => [d, i]) : [[trip.itinerary[day], day]];
    return days.flatMap(([d, di]) =>
      d.items.filter((it) => it.lat && it.lng && it.category !== "flight").map((it) => ({ ...it, day: di })),
    );
  }, [trip.itinerary, day]);

  useEffect(() => {
    map.current = L.map(el.current, { zoomControl: true, scrollWheelZoom: true }).setView([dest.center.lat, dest.center.lng], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => map.current.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const g = layer.current;
    g.clearLayers();
    markers.current = {};
    const bounds = [];

    const airport = dest.airport;
    if (airport?.lat) {
      L.marker([airport.lat, airport.lng], { icon: pin("✈️", HUES.ink) }).bindPopup(`<b>${esc(airport.name)}</b>`).addTo(g);
      bounds.push([airport.lat, airport.lng]);
    }
    const hotel = [dest.center.lat - 0.003, dest.center.lng - 0.001];
    L.marker(hotel, { icon: pin("🏨", HUES.slate) }).bindPopup(`<b>${esc(trip.stay?.booked ? trip.stay.name : "Your accommodation (approx.)")}</b>`).addTo(g);
    bounds.push(hotel);

    const byDay = {};
    stops.forEach((s, i) => {
      const c = cat(s.category);
      const n = day === "all" ? c.emoji : String(i + 1);
      const m = L.marker([s.lat, s.lng], { icon: pin(n, HUES[c.hue] || HUES.coral, day !== "all") })
        .bindPopup(`<b>${esc(s.title)}</b><br/><span style="color:#858b98">Day ${s.day + 1} · ${s.time}${s.cost ? ` · Est. £${s.cost}pp` : ""}</span>`)
        .addTo(g);
      markers.current[s.id] = m;
      (byDay[s.day] ||= []).push([s.lat, s.lng]);
      bounds.push([s.lat, s.lng]);
    });
    Object.entries(byDay).forEach(([d, pts]) => {
      if (pts.length > 1) L.polyline(pts, { color: DAY_COLORS[d % DAY_COLORS.length], weight: 3, opacity: 0.75, dashArray: "6 8" }).addTo(g);
    });
    if (bounds.length) map.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [stops, day, dest, trip.stay]);

  const focus = (s) => {
    map.current.flyTo([s.lat, s.lng], 15, { duration: 0.6 });
    markers.current[s.id]?.openPopup();
  };

  return (
    <>
      <PageHead
        eyebrow="Map"
        title={`${dest.city} on the map`}
        sub="Every stop, grouped by day so you're not zig-zagging across town."
        actions={<div className="seg"><button onClick={() => go("itinerary")}><List />List</button><button className="on"><MapIcon />Map</button></div>}
      />
      <div className="chips" style={{ marginBottom: 14 }}>
        <button className={`chip${day === "all" ? " on" : ""}`} onClick={() => setDay("all")}>All days</button>
        {trip.itinerary.map((d, i) => (
          <button key={d.date} className={`chip${day === i ? " on" : ""}`} onClick={() => setDay(i)}>
            <i style={{ width: 8, height: 8, borderRadius: 9, background: DAY_COLORS[i % DAY_COLORS.length], display: "inline-block" }} />
            Day {i + 1} · {fmtDay(d.date, { weekday: "short" })}
          </button>
        ))}
      </div>
      <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1fr) 260px" }} data-map-grid>
        <div className="map-wrap">
          <div ref={el} className={`map${dark ? " dark-tiles" : ""}`} />
          <div className="map-legend">
            <span>✈️ Airport</span><span>🏨 Stay</span>
            <span><i style={{ background: HUES.sun }} />Food</span><span><i style={{ background: HUES.sea }} />Beach & water</span>
            <span><i style={{ background: HUES.plum }} />Culture</span><span><i style={{ background: HUES.coral }} />Adventure</span><span><i style={{ background: HUES.night }} />Nightlife</span>
          </div>
        </div>
        <div className="map-list">
          {stops.map((s, i) => (
            <button key={s.id} onClick={() => focus(s)}>
              <span className="n" style={{ background: DAY_COLORS[s.day % DAY_COLORS.length] }}>{day === "all" ? s.day + 1 : i + 1}</span>
              <span style={{ minWidth: 0 }}><b style={{ display: "block", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.title}</b><small className="muted">{s.time} · {cat(s.category).label}</small></span>
            </button>
          ))}
        </div>
      </div>
      <style>{`@media (max-width: 900px) { [data-map-grid] { grid-template-columns: 1fr !important; } }`}</style>
    </>
  );
}
