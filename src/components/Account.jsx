import { useState } from "react";
import { Cloud, CloudOff, Loader2, LogOut, RefreshCw, UserRound, Check } from "lucide-react";
import { useStore } from "../store.jsx";
import { Modal } from "./ui.jsx";

const ago = (t) => {
  if (!t) return "";
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

/** Sidebar / menu entry: sign-in prompt, or the signed-in user with sync status. */
export function AccountChip() {
  const { caps, user, sync, syncNow, signOut } = useStore();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  if (!caps.accounts) return null;

  if (!user) {
    return (
      <>
        <button className="nav-item" onClick={() => setOpen(true)}><Cloud />Sign in to sync</button>
        {open && <SignInModal onClose={() => setOpen(false)} />}
      </>
    );
  }

  const StatusIcon = sync.status === "syncing" ? Loader2 : sync.status === "error" || sync.status === "offline" ? CloudOff : Check;
  const label = { syncing: "Syncing…", error: "Sync failed — retrying", offline: "Offline — will sync later", synced: `Synced ${ago(sync.at)}`, idle: "Signed in" }[sync.status];
  return (
    <div style={{ position: "relative" }}>
      <button className="mini-ready" style={{ width: "100%", textAlign: "left", padding: "9px 12px" }} onClick={() => setMenu((m) => !m)} aria-expanded={menu}>
        <span className="avatar">{(user.name || user.email)[0].toUpperCase()}</span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <b style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.name || user.email}</b>
          <small style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <StatusIcon size={12} className={sync.status === "syncing" ? "spin" : ""} style={{ color: sync.status === "synced" ? "var(--sea)" : undefined }} />{label}
          </small>
        </span>
      </button>
      {menu && (
        <div className="trip-menu" style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 0, right: 0, marginTop: 0, zIndex: 5 }}>
          <div className="muted" style={{ fontSize: 12, padding: "6px 10px" }}>{user.email}</div>
          <button onClick={() => { syncNow(); setMenu(false); }}><RefreshCw size={15} />Sync now</button>
          <button onClick={() => { if (confirm("Sign out? Your trips stay in your account and will be removed from this device.")) signOut(); setMenu(false); }}><LogOut size={15} />Sign out</button>
        </div>
      )}
    </div>
  );
}

export function SignInModal({ onClose, reason }) {
  const { signIn, notify } = useStore();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const user = await signIn(mode, form);
      notify(mode === "signup" ? `Welcome, ${user.name}! Your trips will sync across devices.` : `Signed in as ${user.email}`);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} label="Sign in">
      <h2>{mode === "signup" ? "Create your account" : "Sign in"}</h2>
      <p className="muted" style={{ marginTop: 0 }}>{reason || "Keep your trips safe and in sync on your phone and computer. Trips you've already made on this device are added to your account."}</p>
      <div className="seg" style={{ marginBottom: 16 }}>
        <button className={mode === "login" ? "on" : ""} onClick={() => setMode("login")} type="button">Sign in</button>
        <button className={mode === "signup" ? "on" : ""} onClick={() => setMode("signup")} type="button">Create account</button>
      </div>
      <form className="stack" style={{ gap: 12 }} onSubmit={submit}>
        {mode === "signup" && <label className="field">First name<input value={form.name} onChange={set("name")} autoComplete="given-name" /></label>}
        <label className="field">Email<input type="email" required value={form.email} onChange={set("email")} autoComplete="email" autoFocus /></label>
        <label className="field">Password<input type="password" required minLength={8} value={form.password} onChange={set("password")} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
          {mode === "signup" && <span className="muted" style={{ fontWeight: 450 }}>At least 8 characters.</span>}
        </label>
        {error && <div className="conflict-banner" style={{ margin: 0 }}>{error}</div>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? <Loader2 className="spin" /> : <UserRound />}{mode === "signup" ? "Create account" : "Sign in"}</button>
      </form>
    </Modal>
  );
}
