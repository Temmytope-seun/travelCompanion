import { useEffect, useState } from "react";
import { destinationFor } from "../data/destinations.js";
import { forecast, geocode, rates } from "./api.js";

/** Weather + exchange rates for the active trip. Fails soft: the UI shows estimates. */
export function useLive(trip) {
  const [weather, setWeather] = useState(null);
  const [fx, setFx] = useState(null);
  const [error, setError] = useState(null);
  const city = trip?.city;
  const coords = trip?.coords;
  const destination = trip?.destination;

  useEffect(() => {
    if (!trip) return;
    let cancelled = false;
    setWeather(null);
    (async () => {
      try {
        const dest = destinationFor(trip);
        const where = coords || (await geocode(city).catch(() => dest.center));
        const w = await forecast(where);
        if (!cancelled) setWeather(w);
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, destination, coords?.lat]);

  useEffect(() => {
    let cancelled = false;
    rates("GBP").then((r) => !cancelled && setFx(r)).catch(() => !cancelled && setFx(null));
    return () => { cancelled = true; };
  }, []);

  return { weather, fx, error };
}
