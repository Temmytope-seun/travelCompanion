import { useEffect } from "react";
import { CheckCircle2, Circle, CircleDot, AlertTriangle, X } from "lucide-react";
import { cat } from "../data/catalog.js";

export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden>
      <svg viewBox="0 0 64 64">
        <path d="M14 46c8-2 14-8 18-16s10-12 18-12" fill="none" stroke="#e4572e" strokeWidth="6" strokeLinecap="round" />
        <circle cx="14" cy="46" r="6" fill="#f6f3ee" />
        <circle cx="50" cy="18" r="6" fill="#e4572e" />
      </svg>
    </span>
  );
}

export function Brand({ onClick }) {
  return (
    <a className="brand" href="#" onClick={(e) => { e.preventDefault(); onClick?.(); }}>
      <BrandMark />
      <b>Journey<span>AI</span></b>
    </a>
  );
}

export function Ring({ value, size = 120, stroke = 10, dark, label = "ready" }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className={`ring${dark ? " on-dark" : ""}`} style={{ width: size, height: size }} role="img" aria-label={`${value}% ${label}`}>
      <svg width={size} height={size}>
        <circle className="track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle className="bar" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} />
      </svg>
      <div className="val">
        <b style={{ fontSize: size * 0.27 }}>{value}%</b>
        {size >= 90 && <div style={{ fontSize: 11, opacity: 0.7, marginTop: 3 }}>{label}</div>}
      </div>
    </div>
  );
}

export function Progress({ value, tone = "" }) {
  return <div className={`progress ${tone}`}><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

export function StatusIcon({ status }) {
  const Icon = status === "done" ? CheckCircle2 : status === "urgent" ? AlertTriangle : status === "partial" ? CircleDot : Circle;
  return <Icon className={`status-ic ${status}`} aria-label={status} />;
}

export function CatIcon({ category, size = 34 }) {
  const c = cat(category);
  const Icon = c.icon;
  return (
    <span className={`tl-ic hue-${c.hue}`} style={{ width: size, height: size }}>
      <Icon />
    </span>
  );
}

export function Card({ title, icon: Icon, action, sub, children, className = "", ...rest }) {
  return (
    <section className={`card ${className}`} {...rest}>
      {(title || action) && (
        <div className="card-head">
          <h2>{Icon && <Icon />}{title}</h2>
          {action}
        </div>
      )}
      {sub && <p className="card-sub">{sub}</p>}
      {children}
    </section>
  );
}

export function PageHead({ eyebrow, title, sub, actions }) {
  return (
    <header className="page-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Modal({ onClose, children, label }) {
  useEscape(onClose);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true" aria-label={label}>
        <button className="icon-btn drawer-close" style={{ position: "absolute" }} onClick={onClose} aria-label="Close"><X /></button>
        {children}
      </div>
    </>
  );
}

export function Drawer({ onClose, children, label }) {
  useEscape(onClose);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={label}>
        <button className="icon-btn drawer-close" onClick={onClose} aria-label="Close"><X /></button>
        {children}
      </aside>
    </>
  );
}

function useEscape(fn) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && fn();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [fn]);
}

/** Tiny markdown: **bold**, _italic_, bullet lines. Input is our own text, rendered as React nodes. */
export function Md({ text }) {
  const inline = (s, k) =>
    s.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).map((part, i) =>
      part.startsWith("**") ? <b key={`${k}-${i}`}>{part.slice(2, -2)}</b>
        : part.startsWith("_") && part.endsWith("_") && part.length > 2 ? <em key={`${k}-${i}`} className="muted">{part.slice(1, -1)}</em>
        : part,
    );
  return text.split("\n\n").map((para, i) => (
    <p key={i}>
      {para.split("\n").map((line, j) => (
        <span key={j}>{j > 0 && <br />}{inline(line, `${i}-${j}`)}</span>
      ))}
    </p>
  ));
}

/** Decorative flight path used on the hero and onboarding art. */
export function RouteArt({ className = "hero-route" }) {
  return (
    <svg className={className} viewBox="0 0 800 300" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.2" fill="rgba(255,255,255,.12)" />
        </pattern>
      </defs>
      <rect width="800" height="300" fill="url(#dots)" />
      <path d="M-20 260 C 180 240, 260 120, 420 140 S 680 60, 820 20" fill="none" stroke="rgba(246,165,139,.55)" strokeWidth="2" strokeDasharray="2 9" strokeLinecap="round" />
      <circle cx="420" cy="140" r="5" fill="#f6a58b" />
      <circle cx="420" cy="140" r="14" fill="none" stroke="rgba(246,165,139,.4)" />
    </svg>
  );
}

export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="empty">
      {Icon && <Icon />}
      <b>{title}</b>
      {children}
    </div>
  );
}

export const gbp = (n) => `£${Math.round(n).toLocaleString("en-GB")}`;
