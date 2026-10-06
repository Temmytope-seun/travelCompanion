import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CHECKLIST_TEMPLATE, PARTIES } from "./data/catalog.js";
import { findDestination } from "./data/destinations.js";
import { generateItinerary, uid } from "./lib/itinerary.js";
import { addDays, today } from "./lib/dates.js";

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

export function StoreProvider({ children }) {
  const [state, setState] = useState(initial);
  const [toast, setToast] = useState(null);
  const undoStack = useRef([]);
  const [undoLabel, setUndoLabel] = useState(null);
  const stateRef = useRef(state);
  stateRef.current = state;

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
      trips: s.trips.map((t) => (t.id === s.activeId ? { ...t, ...(typeof patch === "function" ? patch(t) : patch) } : t)),
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
    setState((st) => ({ ...st, trips: st.trips.map((t) => (t.id === current.id ? { ...t, itinerary } : t)) }));
  }, []);

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    setState((s) => ({ ...s, trips: s.trips.map((t) => (t.id === s.activeId ? { ...t, itinerary: prev } : t)) }));
    setUndoLabel(undoStack.current.length ? "previous change" : null);
    setToast({ message: "Change undone" });
  }, []);

  const addTrip = useCallback((t) => {
    undoStack.current = [];
    setUndoLabel(null);
    setState((s) => ({ ...s, trips: [...s.trips, t], activeId: t.id }));
  }, []);

  const switchTrip = useCallback((id) => {
    undoStack.current = [];
    setUndoLabel(null);
    setState((s) => ({ ...s, activeId: id }));
  }, []);

  const deleteTrip = useCallback((id) => {
    setState((s) => {
      const trips = s.trips.filter((t) => t.id !== id);
      return { ...s, trips, activeId: s.activeId === id ? trips[0]?.id || null : s.activeId };
    });
  }, []);

  const setProfile = useCallback((patch) => setState((s) => ({ ...s, profile: { ...s.profile, ...patch } })), []);

  const notify = useCallback((message, action) => setToast({ message, action, key: Date.now() }), []);

  const value = useMemo(
    () => ({ state, trip, updateTrip, setItinerary, undo, undoLabel, addTrip, switchTrip, deleteTrip, setProfile, toast, setToast, notify }),
    [state, trip, updateTrip, setItinerary, undo, undoLabel, addTrip, switchTrip, deleteTrip, setProfile, toast, notify],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
