import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, CalendarDays, Map as MapIcon, Compass, Ticket, ListChecks, Wallet, Bell,
  Settings, Plus, ChevronDown, Moon, Sun, Sparkles, Menu, Trash2, WifiOff,
} from "lucide-react";
import { useStore, demoTrip } from "./store.jsx";
import { Brand, Ring, Drawer } from "./components/ui.jsx";
import { readiness } from "./lib/readiness.js";
import { buildReminders, splitReminders } from "./lib/reminders.js";
import { fmtRange } from "./lib/dates.js";
import { destinationFor } from "./data/destinations.js";
import { useLive } from "./lib/useLive.js";
import Onboarding from "./views/Onboarding.jsx";
import Overview from "./views/Overview.jsx";
import Itinerary from "./views/Itinerary.jsx";
import MapView from "./views/MapView.jsx";
import Discover from "./views/Discover.jsx";
import Bookings from "./views/Bookings.jsx";
import Checklist from "./views/Checklist.jsx";
import Budget from "./views/Budget.jsx";
import Alerts, { useBrowserNotifications } from "./views/Alerts.jsx";
import TripSettings from "./views/TripSettings.jsx";
import Assistant from "./components/Assistant.jsx";
import { AccountChip } from "./components/Account.jsx";

const NAV = [
  { group: "Plan", items: [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "itinerary", label: "Itinerary", icon: CalendarDays },
    { id: "map", label: "Map", icon: MapIcon },
    { id: "discover", label: "Discover", icon: Compass },
  ] },
  { group: "Prepare", items: [
    { id: "bookings", label: "Bookings", icon: Ticket },
    { id: "checklist", label: "Checklist", icon: ListChecks },
    { id: "budget", label: "Budget & money", icon: Wallet },
    { id: "alerts", label: "Alerts", icon: Bell },
  ] },
];
const VIEWS = { overview: Overview, itinerary: Itinerary, map: MapView, discover: Discover, bookings: Bookings, checklist: Checklist, budget: Budget, alerts: Alerts, settings: TripSettings };

function useTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("journeyai.theme") || "system"; } catch { return "system"; }
  });
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const h = (e) => setSystemDark(e.matches);
    mq?.addEventListener("change", h);
    return () => mq?.removeEventListener("change", h);
  }, []);
  useEffect(() => {
    if (theme === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("journeyai.theme", theme); } catch { /* ignore */ }
  }, [theme]);
  const dark = theme === "dark" || (theme === "system" && systemDark);
  return { dark, toggle: () => setTheme(dark ? "light" : "dark") };
}

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}

function useHashView() {
  const read = () => (window.location.hash.slice(1) in VIEWS ? window.location.hash.slice(1) : "overview");
  const [view, setView] = useState(read);
  useEffect(() => {
    const h = () => setView(read());
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  const go = (v) => {
    if (window.location.hash.slice(1) !== v) window.location.hash = v;
    setView(v);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return [view, go];
}

export default function App() {
  const store = useStore();
  const { state, trip, toast, setToast } = store;
  const [view, go] = useHashView();
  const [creating, setCreating] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const theme = useTheme();
  const online = useOnline();
  const live = useLive(trip);
  useBrowserNotifications(trip);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.action ? 6000 : 3200);
    return () => clearTimeout(t);
  }, [toast, setToast]);

  const ready = useMemo(() => (trip ? readiness(trip) : null), [trip]);
  const dueCount = useMemo(() => {
    if (!trip) return 0;
    return splitReminders(buildReminders(trip), trip.dismissed).due.length;
  }, [trip]);

  if (!trip || creating) {
    return (
      <>
        <Onboarding
          canCancel={!!trip}
          onCancel={() => setCreating(false)}
          onDone={(t) => { store.addTrip(t); setCreating(false); go("overview"); }}
          onDemo={() => { store.addTrip(demoTrip()); setCreating(false); go("overview"); }}
        />
        {toast && <Toast toast={toast} clear={() => setToast(null)} />}
      </>
    );
  }

  const View = VIEWS[view] || Overview;
  const ctx = { go, live, openChat: () => setChatOpen(true), ready, dark: theme.dark };

  return (
    <div className="app">
      <Sidebar view={view} go={go} ready={ready} dueCount={dueCount} theme={theme} onNew={() => setCreating(true)} />

      <div className="mobile-top">
        <Brand onClick={() => go("overview")} />
        <span className="spacer" />
        <button className="icon-btn" onClick={theme.toggle} aria-label="Toggle theme">{theme.dark ? <Sun /> : <Moon />}</button>
        <button className="icon-btn" onClick={() => go("alerts")} aria-label="Alerts"><Bell />{dueCount > 0 && <span className="dot" />}</button>
      </div>

      <main className="main">
        <div className="main-inner" key={trip.id + view}>
          {!online && <div className="offline-pill" role="status"><WifiOff />You're offline — showing your saved trip. Changes will sync when you're back online.</div>}
          <View {...ctx} />
        </div>
      </main>

      <aside className="rail" aria-label="Trip assistant">
        <Assistant live={live} go={go} />
      </aside>

      <button className="fab" onClick={() => setChatOpen(true)} aria-label="Open trip assistant"><Sparkles /></button>
      {chatOpen && (
        <Drawer onClose={() => setChatOpen(false)} label="Trip assistant">
          <Assistant live={live} go={(v) => { setChatOpen(false); go(v); }} />
        </Drawer>
      )}

      <nav className="tabbar" aria-label="Primary">
        {[["overview", "Home", LayoutDashboard], ["itinerary", "Plan", CalendarDays], ["map", "Map", MapIcon], ["discover", "Discover", Compass]].map(([id, label, Icon]) => (
          <button key={id} className={view === id ? "on" : ""} onClick={() => go(id)}><Icon />{label}</button>
        ))}
        <button className={["bookings", "checklist", "budget", "alerts", "settings"].includes(view) ? "on" : ""} onClick={() => setMoreOpen(true)}>
          <Menu />More{dueCount > 0 && <span className="count">{dueCount}</span>}
        </button>
      </nav>
      {moreOpen && (
        <Drawer onClose={() => setMoreOpen(false)} label="More">
          <div style={{ padding: "20px 16px", overflow: "auto" }}>
            <Brand />
            <div style={{ height: 16 }} />
            <TripSwitcher onNew={() => { setMoreOpen(false); setCreating(true); }} />
            <div style={{ height: 10 }} />
            <AccountChip />
            <div style={{ height: 12 }} />
            <nav className="nav">
              {[...NAV[1].items, { id: "settings", label: "Trip settings", icon: Settings }].map((n) => (
                <button key={n.id} className={`nav-item${view === n.id ? " active" : ""}`} onClick={() => { setMoreOpen(false); go(n.id); }}>
                  <n.icon />{n.label}{n.id === "alerts" && dueCount > 0 && <span className="count">{dueCount}</span>}
                </button>
              ))}
            </nav>
          </div>
        </Drawer>
      )}
      {toast && <Toast toast={toast} clear={() => setToast(null)} />}
    </div>
  );
}

function Toast({ toast, clear }) {
  return (
    <div className="toast" role="status">
      <span>{toast.message}</span>
      {toast.action && <button onClick={() => { toast.action.run(); clear(); }}>{toast.action.label}</button>}
    </div>
  );
}

function Sidebar({ view, go, ready, dueCount, theme, onNew }) {
  return (
    <aside className="sidebar">
      <Brand onClick={() => go("overview")} />
      <TripSwitcher onNew={onNew} />
      <nav className="nav" aria-label="Primary">
        {NAV.map((g) => (
          <div key={g.group}>
            <div className="eyebrow nav-label">{g.group}</div>
            {g.items.map((n) => (
              <button key={n.id} className={`nav-item${view === n.id ? " active" : ""}`} onClick={() => go(n.id)} aria-current={view === n.id ? "page" : undefined}>
                <n.icon />{n.label}
                {n.id === "alerts" && dueCount > 0 && <span className="count">{dueCount}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-foot">
        <AccountChip />
        <button className="mini-ready" onClick={() => go("checklist")} style={{ textAlign: "left" }}>
          <Ring value={ready.score} size={46} stroke={5} />
          <div>
            <b>{ready.score === 100 ? "100% ready" : "Trip readiness"}</b>
            <small>{ready.open.length ? `${ready.open.length} things need attention` : "You're all set"}</small>
          </div>
        </button>
        <div className="row">
          <button className={`nav-item${view === "settings" ? " active" : ""}`} onClick={() => go("settings")}><Settings />Trip settings</button>
          <button className="icon-btn" onClick={theme.toggle} aria-label="Toggle theme">{theme.dark ? <Sun /> : <Moon />}</button>
        </div>
      </div>
    </aside>
  );
}

function TripSwitcher({ onNew }) {
  const { state, trip, switchTrip, deleteTrip } = useStore();
  const [open, setOpen] = useState(false);
  const dest = destinationFor(trip);
  return (
    <div>
      <button className="trip-switch" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="flag">{dest.flag}</span>
        <span><b>{trip.destination}</b><small>{fmtRange(trip.startDate, trip.endDate)}</small></span>
        <ChevronDown />
      </button>
      {open && (
        <div className="trip-menu" style={{ marginTop: 6 }}>
          {state.trips.map((t) => (
            <div className="row" key={t.id} style={{ gap: 0 }}>
              <button className={t.id === trip.id ? "active" : ""} onClick={() => { switchTrip(t.id); setOpen(false); }}>
                <span>{destinationFor(t).flag}</span>{t.destination}<small className="muted" style={{ marginLeft: "auto" }}>{fmtRange(t.startDate, t.endDate)}</small>
              </button>
              {state.trips.length > 1 && (
                <button style={{ width: 34, justifyContent: "center" }} aria-label={`Delete ${t.destination} trip`}
                  onClick={() => { if (confirm(`Delete your ${t.destination} trip?`)) deleteTrip(t.id); }}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          <button onClick={() => { setOpen(false); onNew(); }}><Plus size={15} /> Plan a new trip</button>
        </div>
      )}
    </div>
  );
}
