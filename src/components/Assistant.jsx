import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, Check, Undo2, ExternalLink, ArrowRight, RotateCcw } from "lucide-react";
import { useStore } from "../store.jsx";
import { Md } from "./ui.jsx";
import { interpret, SUGGESTIONS } from "../lib/assistant.js";
import { destinationFor } from "../data/destinations.js";
import { uid } from "../lib/itinerary.js";

export default function Assistant({ live, go }) {
  const { trip, updateTrip, setItinerary, undo } = useStore();
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const log = useRef(null);
  const dest = destinationFor(trip);
  const messages = trip.chat || [];
  const first = trip.people?.[0] && !/^(You|Traveller)/.test(trip.people[0]) ? `, ${trip.people[0]}` : "";

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, thinking]);

  const push = (msg) => updateTrip((t) => ({ chat: [...(t.chat || []), { id: uid(), ...msg }].slice(-40) }));

  const send = (raw) => {
    const q = (raw ?? text).trim();
    if (!q || thinking) return;
    setText("");
    push({ role: "user", text: q });
    if (/^undo\b/i.test(q)) {
      undo();
      push({ role: "bot", text: "Undone — your itinerary is back to how it was." });
      return;
    }
    setThinking(true);
    setTimeout(() => {
      const r = interpret(q, { trip, fx: live.fx, weather: live.weather });
      if (r.itinerary) setItinerary(r.itinerary, r.label || "assistant change");
      if (r.tripPatch) updateTrip(r.tripPatch);
      push({ role: "bot", text: r.reply, links: r.links, applied: !!r.itinerary });
      setThinking(false);
    }, 450);
  };

  return (
    <div className="chat">
      <div className="chat-head">
        <span className="chat-avatar"><Sparkles /></span>
        <div style={{ flex: 1 }}>
          <b>Trip assistant</b>
          <small><i />Knows your {dest.city} plans</small>
        </div>
        {messages.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => updateTrip({ chat: [] })} title="Clear conversation"><RotateCcw /></button>}
      </div>

      <div className="chat-log" ref={log} aria-live="polite">
        <div className="msg bot">
          <Md text={`Hi${first}! I'm planning alongside you for **${trip.destination}**. Ask me to change the itinerary, or anything about the trip. I'll only change the parts you mention.`} />
        </div>
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.role}`}>
            {m.role === "bot" ? <Md text={m.text} /> : m.text}
            {m.applied && (
              <div className="applied"><Check />Itinerary updated
                <button className="link" style={{ marginLeft: "auto", fontSize: 12 }} onClick={() => { undo(); push({ role: "bot", text: "Undone." }); }}><Undo2 />Undo</button>
                <button className="link" style={{ fontSize: 12 }} onClick={() => go("itinerary")}>View <ArrowRight /></button>
              </div>
            )}
            {m.links?.length > 0 && (
              <div className="links">
                {m.links.map((l) => l.href
                  ? <a key={l.label} className="btn btn-secondary btn-sm" href={l.href} target="_blank" rel="noreferrer">{l.label}<ExternalLink /></a>
                  : <button key={l.label} className="btn btn-secondary btn-sm" onClick={() => go(l.view)}>{l.label}<ArrowRight /></button>)}
              </div>
            )}
          </div>
        ))}
        {thinking && <div className="msg bot"><span className="typing"><i /><i /><i /></span></div>}
      </div>

      {messages.length < 2 && (
        <div className="chat-suggest">
          {SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s.replace("lek", dest.currency.code === "ALL" ? "lek" : dest.currency.code))}>{s.replace("lek", dest.currency.code === "ALL" ? "lek" : dest.currency.code)}</button>)}
        </div>
      )}

      <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask or tell me what to change…" aria-label="Message the trip assistant" />
        <button className="btn btn-primary" type="submit" disabled={!text.trim() || thinking} aria-label="Send"><Send /></button>
      </form>
    </div>
  );
}
