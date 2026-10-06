import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CHECKLIST_TEMPLATE, PARTIES } from "./data/catalog.js";
import { findDestination } from "./data/destinations.js";
import { generateItinerary, uid } from "./lib/itinerary.js";
import { addDays, today } from "./lib/dates.js";
import { api, loadConfig } from "./lib/api.js";

const KEY = "journeyai.v2";
const Ctx = createContext(null);

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* storage unavailable — start fresh */
  }
  return { trips: [], activeId: null, profile: { name: "", homeCurrency: "GBP" } };
}

export function buildTrip(input) {
  const known = findDestination(input.destination);
  const party = PARTIES.find((p) => p.id === input.party);
  const travellers = input.travellers || party?.count || 1;
  const trip = {
    id: uid(),
    createdAt: Date.now(),
    destination: known?.name || input.destination.trim(),
    city: input.city?.trim() || known?.city || input.destination.trim(),
    flag: input.flag || known?.flag,
    coords: input.coords,
    currency: input.currency,
    catalog: input.catalog,
    origin: input.origin || "Manchester",
    originAirport: input.originAirport || "",
    startDate: input.startDate,
    endDate: input.endDate,
    travellers,
    party: input.party || "friends",
    people: input.people || defaultPeople(input.name, travellers),
    interests: input.interests?.length ? input.interests : ["food", "culture"],
    pace: input.pace || "balanced",
    wakeLate: false,
    budget: input.budget || 0,
    flight: { booked: false, checkedIn: false, ...input.flight },
    returnFlight: { booked: false, ...input.returnFlight },
    stay: { booked: false, type: "hotel", checkIn: "15:00", checkOut: "11:00", ...input.stay },
    transfer: { booked: false, mode: "private", ...input.transfer },
    checklist: CHECKLIST_TEMPLATE.map((c) => ({ ...c, done: (input.done || []).includes(c.id) })),
    expenses: input.expenses || [],
    estimates: { flightPerPerson: 180, ...input.estimates },
    dismissed: [],
    reviewed: false,
  };
  trip.itinerary = generateItinerary(trip);
  return trip;
}

function defaultPeople(name, n) {
  const me = name?.trim() || "You";
  return [me, ...Array.from({ length: Math.max(0, n - 1) }, (_, i) => `Traveller ${i + 2}`)];
}

export function demoTrip() {
  const start = addDays(today(), 7);
  const end = addDays(start, 3);
  return buildTrip({
    destination: "Albania",
    city: "Tirana",
    origin: "Manchester",
    originAirport: "MAN",
    startDate: start,
    endDate: end,
    party: "friends",
    travellers: 3,
    people: ["Temi", "David", "John"],
    interests: ["beach", "adventure", "nightlife", "food", "dental", "history"],
    budget: 1500,
    flight: {
      booked: true, airline: "Wizz Air", number: "W6 4402", from: "MAN", to: "TIA",
      depart: `${addDays(start, -1)}T21:55`, arrive: `${start}T01:55`, terminal: "1", ref: "K7QX2D", pricePerPerson: 165,
    },
    returnFlight: { booked: true, airline: "Wizz Air", number: "W6 4403", from: "TIA", to: "MAN", depart: `${end}T19:30`, arrive: `${end}T21:45` },
    stay: { booked: true, type: "hotel", name: "Boutique hotel near Skanderbeg Square", address: "Central Tirana (demo booking)", checkIn: "14:00", checkOut: "11:00", ref: "TR-58213", perNight: 85 },
    done: ["passport", "visa", "insurance", "cards", "charger", "adapter", "meds"],
    expenses: [
      { id: uid(), label: "Flights (3 × return)", amount: 495, category: "Flights", paidBy: "Temi", date: today() },
    ],
  });
}

function initial() {
  const s = load();
  // `?demo` opens straight into the sample Albania trip (handy for sharing and screenshots).
  if (!s.trips.length && new URLSearchParams(window.location.search).has("demo")) {
    const t = demoTrip();
    return { ...s, trips: [t], activeId: t.id };
  }
  return s;
}

const stamp = (t) => ({ ...t, updatedAt: Date.now() });

function remembered(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function remember(key, value) {
  try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

export function StoreProvider({ children }) {
  const [state, setState] = useState(initial);
  const [toast, setToast] = useState(null);
  const [caps, setCaps] = useState(() => remembered("journeyai.caps") || { places: false, ai: false, accounts: false, push: false });
  const [user, setUserState] = useState(() => remembered("journeyai.user"));
  const setUser = useCallback((u) => { setUserState(u); remember("journeyai.user", u); }, []);
  const [sync, setSync] = useState({ status: "idle", at: null });
  const undoStack = useRef([]);
  const [undoLabel, setUndoLabel] = useState(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const userRef = useRef(user);
  userRef.current = user;
  const syncing = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* quota or private mode — keep working in memory */
    }
  }, [state]);

  const trip = state.trips.find((t) => t.id === state.activeId) || null;

  const updateTrip = useCallback((patch) => {
    setState((s) => ({
      ...s,
      trips: s.trips.map((t) => (t.id === s.activeId ? stamp({ ...t, ...(typeof patch === "function" ? patch(t) : patch) }) : t)),
    }));
  }, []);

  /** Change the itinerary; when `label` is given the change can be undone. */
  const setItinerary = useCallback((next, label) => {
    const s = stateRef.current;
    const current = s.trips.find((t) => t.id === s.activeId);
    if (!current) return;
    if (label) {
      undoStack.current.push(current.itinerary);
      setUndoLabel(label);
    }
    const itinerary = typeof next === "function" ? next(current.itinerary) : next;
    setState((st) => ({ ...st, trips: st.trips.map((t) => (t.id === current.id ? stamp({ ...t, itinerary }) : t)) }));
  }, []);

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    setState((s) => ({ ...s, trips: s.trips.map((t) => (t.id === s.activeId ? stamp({ ...t, itinerary: prev }) : t)) }));
    setUndoLabel(undoStack.current.length ? "previous change" : null);
    setToast({ message: "Change undone" });
  }, []);

  const addTrip = useCallback((t) => {
    undoStack.current = [];
    setUndoLabel(null);
    setState((s) => ({ ...s, trips: [...s.trips, stamp(t)], activeId: t.id }));
  }, []);

  const switchTrip = useCallback((id) => {
    undoStack.current = [];
    setUndoLabel(null);
    setState((s) => ({ ...s, activeId: id }));
  }, []);

  const deleteTrip = useCallback((id) => {
    setState((s) => {
      const trips = s.trips.filter((t) => t.id !== id);
      // Remember the deletion so it reaches the server on the next sync.
      const pendingDeletes = userRef.current ? [...(s.pendingDeletes || []), id] : s.pendingDeletes;
      return { ...s, trips, pendingDeletes, activeId: s.activeId === id ? trips[0]?.id || null : s.activeId };
    });
  }, []);

  const setProfile = useCallback((patch) => setState((s) => ({ ...s, profile: { ...s.profile, ...patch } })), []);

  const notify = useCallback((message, action) => setToast({ message, action, key: Date.now() }), []);

  // ---- Accounts & sync ---------------------------------------------------

  /** Two-way sync: push deletions, pull newer server copies, push local changes. */
  const syncNow = useCallback(async () => {
    if (!userRef.current || syncing.current) return;
    syncing.current = true;
    setSync((x) => ({ ...x, status: "syncing" }));
    try {
      for (const id of stateRef.current.pendingDeletes || []) await api(`/trips/${id}`, { method: "DELETE" });
      const remote = await api("/trips");
      const synced = { ...(stateRef.current.synced || {}) };

      setState((s) => {
        const removed = new Set(remote.deleted);
        let trips = s.trips.filter((t) => !removed.has(t.id));
        for (const r of remote.trips) {
          const local = trips.find((t) => t.id === r.id);
          if (!local) trips = [...trips, { ...r.data, updatedAt: r.updated }];
          else if (r.updated > (local.updatedAt || 0)) trips = trips.map((t) => (t.id === r.id ? { ...r.data, updatedAt: r.updated } : t));
          synced[r.id] = Math.max(synced[r.id] || 0, r.updated);
        }
        const activeId = trips.some((t) => t.id === s.activeId) ? s.activeId : trips[0]?.id || null;
        return { ...s, trips, activeId, pendingDeletes: [], synced };
      });
      await new Promise((r) => setTimeout(r, 0));

      for (const t of stateRef.current.trips) {
        if (t.id in synced && (t.updatedAt || 0) <= synced[t.id]) continue;
        try {
          await api(`/trips/${t.id}`, { method: "PUT", body: { data: t, updated: t.updatedAt || Date.now() } });
          synced[t.id] = t.updatedAt || Date.now();
        } catch (err) {
          if (err.status !== 409) throw err;
          const r = err.data.trip; // server copy is newer — take it
          setState((s) => ({ ...s, trips: s.trips.map((x) => (x.id === r.id ? { ...r.data, updatedAt: r.updated } : x)) }));
          synced[r.id] = r.updated;
        }
      }
      setState((s) => ({ ...s, synced: { ...s.synced, ...synced } }));
      setSync({ status: "synced", at: Date.now() });
    } catch (err) {
      if (err.status === 401) setUser(null);
      setSync((x) => ({ ...x, status: navigator.onLine ? "error" : "offline" }));
    } finally {
      syncing.current = false;
    }
  }, []);

  useEffect(() => {
    // Offline, keep the last-known features and account so the app still works.
    loadConfig().then((c) => {
      if (c.offline) return;
      setCaps(c);
      remember("journeyai.caps", c);
      if (c.accounts) api("/auth/me").then((r) => setUser(r.user)).catch(() => {});
    });
  }, [setUser]);

  // Sync on sign-in, shortly after local changes, when back online, and every 5 minutes.
  useEffect(() => { if (user) syncNow(); }, [user, syncNow]);
  const dirty = !!user && (
    (state.pendingDeletes || []).length > 0 ||
    state.trips.some((t) => !(t.id in (state.synced || {})) || (t.updatedAt || 0) > state.synced[t.id])
  );
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(syncNow, 1200);
    return () => clearTimeout(t);
  }, [dirty, state.trips, syncNow]);
  useEffect(() => {
    if (!user) return;
    const iv = setInterval(syncNow, 5 * 60_000);
    window.addEventListener("online", syncNow);
    return () => { clearInterval(iv); window.removeEventListener("online", syncNow); };
  }, [user, syncNow]);

  const signIn = useCallback(async (mode, form) => {
    const r = await api(`/auth/${mode === "signup" ? "signup" : "login"}`, { method: "POST", body: form });
    setUser(r.user);
    setState((s) => ({ ...s, synced: {}, profile: { ...s.profile, name: s.profile?.name || r.user.name } }));
    return r.user;
  }, []);

  const signOut = useCallback(async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    setSync({ status: "idle", at: null });
    // Trips live in the account; clear them from this device.
    setState((s) => ({ ...s, trips: [], activeId: null, synced: {}, pendingDeletes: [] }));
  }, []);

  const value = useMemo(
    () => ({ state, trip, updateTrip, setItinerary, undo, undoLabel, addTrip, switchTrip, deleteTrip, setProfile, toast, setToast, notify, caps, user, sync, syncNow, signIn, signOut }),
    [state, trip, updateTrip, setItinerary, undo, undoLabel, addTrip, switchTrip, deleteTrip, setProfile, toast, notify, caps, user, sync, syncNow, signIn, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
