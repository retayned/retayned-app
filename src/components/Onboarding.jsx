import { useEffect, useRef, useState } from "react";
import { C } from "../theme";

// ─── Onboarding (June 2026) ─────────────────────────────────────────────
// The entire first-run experience lives in this module: the welcome
// moment, quick-add client, "add your book" roster builder, the
// getting-started pill, Rai's gated-state cards, and the self-typing
// example pills. App.jsx owns the step state (onbStep); pages render
// these pieces. Everything is DERIVED + localStorage — no schema changes.
//
// Brand rules honored here:
//   - Wordmark: SF/system stack, weight 900, -0.04em, ONE color.
//   - Fraunces italic for editorial lines only; Manrope everywhere else.
//   - Purple #7c5cf3 is Rai's color and appears ONLY on Rai elements.
//   - Rai is a RETENTION SPECIALIST (never "analyst" / "assistant").
//   - Example copy uses fictitious placeholders until the user has a
//     real client of their own — never seeded names.

const WORDMARK = {
  fontFamily: "system-ui, -apple-system, 'SF Pro Display', 'Segoe UI', sans-serif",
  fontWeight: 900,
  letterSpacing: "-0.04em",
};
const FRAUNCES = {
  fontFamily: "'Fraunces', Georgia, serif",
  fontStyle: "italic",
  fontWeight: 500,
  fontVariationSettings: "'opsz' 96, 'SOFT' 50, 'WONK' 0",
};

// Types text into the REAL Today composer through React's native value
// setter, so onChange — and therefore the parser + chip auto-fill — fires
// for every keystroke, exactly as if the user typed it. This is the
// onboarding magic moment: tap an example, watch the chips catch it.
let _typeTimer = null; // one animation at a time — a second tap restarts cleanly
export function typeIntoComposer(text, { intervalMs = 26 } = {}) {
  if (typeof document === "undefined") return;
  const input = document.querySelector('input[placeholder^="Add a task"]');
  if (!input) return;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  if (!setter) return;
  if (_typeTimer) { clearInterval(_typeTimer); _typeTimer = null; }
  input.focus();
  // Clear whatever's there first (fires onChange once with "").
  setter.call(input, "");
  input.dispatchEvent(new Event("input", { bubbles: true }));
  let i = 0;
  _typeTimer = setInterval(() => {
    i += 1;
    setter.call(input, text.slice(0, i));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    if (i >= text.length) { clearInterval(_typeTimer); _typeTimer = null; }
  }, intervalMs);
}

// Task-weighted examples — ALL tasks (the sticky object), recurring first.
// Personalized with the user's own first client once one exists.
export function bookExamples(clientName) {
  const n = clientName || "your client";
  return [
    `Send ${n} the weekly report every Friday`,
    `Follow up with ${n} about the renewal tomorrow`,
    `Prep agenda for the ${n} call Thursday`,
  ];
}

// Shared overlay scaffold — full-screen, brand canvas, centered card.
function Overlay({ children }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: C.bg,
      display: "flex",
      padding: "24px 16px", overflowY: "auto",
      fontFamily: "'Manrope', system-ui, sans-serif",
    }}>
      {/* margin:auto (not align/justify center) — centered flex children
          taller than the container clip unscrollably at the top; auto
          margins center when short AND scroll when tall (iOS keyboard). */}
      <div style={{ width: "100%", maxWidth: 420, margin: "auto" }}>{children}</div>
    </div>
  );
}

const fieldShell = { background: C.card, border: "1px solid " + C.border, borderRadius: 10, padding: "10px 12px", marginBottom: 8 };
const fieldLabel = { fontSize: 9, fontWeight: 700, color: C.textMuted, letterSpacing: 0.6, textTransform: "uppercase", display: "block" };
const fieldInput = { width: "100%", border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: 14, color: C.text, marginTop: 2, padding: 0 };
const primaryBtn = { width: "100%", background: C.primary, color: "#fff", border: "none", borderRadius: 10, padding: "12px 16px", fontSize: 13.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 2px 8px rgba(51,84,62,0.28)" };
const quietLink = { background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, color: C.textMuted, textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3, padding: 6 };

function ProgressDots({ step }) {
  return (
    <div style={{ display: "flex", gap: 5, marginBottom: 14 }}>
      <span style={{ width: 18, height: 4, borderRadius: 999, background: C.primary }} />
      <span style={{ width: 18, height: 4, borderRadius: 999, background: step >= 2 ? C.primary : C.border }} />
    </div>
  );
}

// ─── Step 0: the welcome moment (shown once) ───────────────────────────
export function WelcomeOverlay({ onStart, onSkip }) {
  return (
    <Overlay>
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <span style={{ ...WORDMARK, fontSize: 24, color: C.primary, marginBottom: 26 }}>Retayned.</span>
        <div style={{ ...FRAUNCES, fontSize: 27, lineHeight: 1.25, color: C.text, letterSpacing: "-0.015em", maxWidth: 360 }}>
          Let's protect the business you've earned.
        </div>
        <div style={{ fontSize: 13.5, color: C.textSec, marginTop: 12, maxWidth: 380, lineHeight: 1.55 }}>
          Two minutes: add a client, capture one task. Rai — your retention specialist — takes it from there, every night.
        </div>
        <button onClick={onStart} style={{ ...primaryBtn, width: "auto", padding: "12px 28px", marginTop: 26 }}>
          Add your first client
        </button>
        <button onClick={onSkip} style={{ ...quietLink, marginTop: 12 }}>
          I'll explore on my own first
        </button>
      </div>
    </Overlay>
  );
}

// ─── Step 1: quick-add client — three fields, NOT the 12-dim quiz ──────
export function QuickAddClientCard({ onSubmit, onSkip }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [revenue, setRevenue] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    const ok = await onSubmit({ name, contact, revenue });
    // On failure the overlay stays mounted — reset so they can retry.
    if (!ok) setBusy(false);
  };
  return (
    <Overlay>
      <div style={{ background: C.bg, border: "1px solid " + C.border, borderRadius: 18, padding: "22px 20px", boxShadow: "var(--rt-sh-card)" }}>
        <ProgressDots step={1} />
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: C.textMuted, marginBottom: 4 }}>STEP 1 OF 2</div>
        <div style={{ fontSize: 19, fontWeight: 700, color: C.text }}>Who pays you?</div>
        <div style={{ fontSize: 12, color: C.textSec, margin: "4px 0 16px", lineHeight: 1.5 }}>Start with the client you'd hate to lose.</div>
        <div style={fieldShell}>
          <label style={fieldLabel}>Client or company</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") submit(); }} placeholder="Harbor & Pine" style={fieldInput} />
        </div>
        <div style={fieldShell}>
          <label style={fieldLabel}>Your contact <span style={{ fontWeight: 500, letterSpacing: 0, textTransform: "none" }}>· optional</span></label>
          <input value={contact} onChange={e => setContact(e.target.value)} onKeyDown={e => { if (e.key === "Enter") submit(); }} placeholder="Maya Linwood" style={fieldInput} />
        </div>
        <div style={{ ...fieldShell, marginBottom: 0 }}>
          <label style={fieldLabel}>Monthly retainer <span style={{ fontWeight: 500, letterSpacing: 0, textTransform: "none" }}>· optional</span></label>
          <input value={revenue} onChange={e => setRevenue(e.target.value.replace(/[^0-9.]/g, ""))} onKeyDown={e => { if (e.key === "Enter") submit(); }} placeholder="2500" inputMode="decimal" style={fieldInput} />
        </div>
        <div style={{ ...FRAUNCES, fontSize: 11.5, color: C.textSec, margin: "12px 2px 14px", lineHeight: 1.5 }}>
          Skip the deep stuff — you'll score this relationship later, and Rai gets sharper when you do.
        </div>
        <button onClick={submit} disabled={!name.trim() || busy} style={{ ...primaryBtn, opacity: name.trim() && !busy ? 1 : 0.45, cursor: name.trim() && !busy ? "pointer" : "default" }}>
          {busy ? "Adding…" : `Add ${name.trim() || "your client"} →`}
        </button>
        <div style={{ textAlign: "center" }}>
          <button onClick={onSkip} style={{ ...quietLink, marginTop: 10 }}>Not now</button>
        </div>
      </div>
    </Overlay>
  );
}

// ─── Step 2 banner: the task spotlight (renders on Today, above the
// composer). Pills self-type into the REAL composer so the parser's
// chips light up live — that's the demo. ────────────────────────────────
export function TaskSpotlight({ clientName, onSkip, onPick }) {
  return (
    <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 14, padding: "14px 16px", marginBottom: 14, boxShadow: "var(--rt-sh-card)" }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: C.textMuted }}>STEP 2 OF 2</div>
      <div style={{ ...FRAUNCES, fontSize: 17, color: C.text, margin: "4px 0 2px" }}>Tasks are how Retayned thinks.</div>
      <div style={{ fontSize: 12, color: C.textSec, lineHeight: 1.5, marginBottom: 10 }}>
        Capture what you owe {clientName || "your client"} in plain English — watch the chips catch the client, the date, the repeat.
      </div>
      <ExamplePills clientName={clientName} label="Tap one — it types itself" onPick={onPick} />
      <div style={{ textAlign: "right", marginTop: 6 }}>
        <button onClick={onSkip} style={quietLink}>skip</button>
      </div>
    </div>
  );
}

// Tappable example pills. Used in the spotlight AND the persistent
// empty state. All tasks; recurring leads.
export function ExamplePills({ clientName, label = null, onPick = null }) {
  return (
    <div>
      {label && <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: C.textMuted, marginBottom: 7, textTransform: "uppercase" }}>{label}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {bookExamples(clientName).map((ex, i) => (
          <button key={i} onClick={() => (onPick ? onPick(ex) : typeIntoComposer(ex))} style={{
            background: C.card, border: "1px solid " + C.border, borderRadius: 10,
            padding: "10px 12px", fontSize: 12.5, color: C.text, textAlign: "left",
            cursor: "pointer", fontFamily: "inherit", boxShadow: "var(--rt-sh-xs)",
          }}>
            {i === 0 && <span style={{ color: C.primaryLight, fontWeight: 700, marginRight: 5 }}>↻</span>}{ex}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Step 3: "Add your book" — rapid name-only roster builder ──────────
// One client is a list. A book is intelligence. Reused by Lane B's one
// ask and behind Rai's specialist gate, so the door is consistent.
export function RosterBuilder({ existingNames = [], onAdd, onClose }) {
  const [draft, setDraft] = useState("");
  const [added, setAdded] = useState([]);
  // Keep the entry row in view as the book grows past the list's max height.
  const listRef = useRef(null);
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [added.length]);
  const names = [...existingNames, ...added];
  const submitName = () => {
    const n = draft.trim();
    if (!n) return;
    if (names.some(x => x.toLowerCase() === n.toLowerCase())) { setDraft(""); return; }
    setAdded(prev => [...prev, n]);
    setDraft("");
    onAdd(n);
  };
  const initials = (n) => n.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const avatarBg = [C.primary, C.primaryLight, "#A8A420", C.primaryDeep];
  return (
    <Overlay>
      <div style={{ background: C.bg, border: "1px solid " + C.border, borderRadius: 18, padding: "22px 20px", boxShadow: "var(--rt-sh-card)" }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: C.textMuted, marginBottom: 4 }}>ONE MORE THING</div>
        <div style={{ ...FRAUNCES, fontSize: 20, color: C.text, lineHeight: 1.3 }}>Add your book.<br />Watch the magic.</div>
        <div style={{ fontSize: 12, color: C.textSec, margin: "8px 0 14px", lineHeight: 1.55 }}>
          Just names — fast. Rai ranks across your whole roster: who's thriving, who's drifting, who needs you <i>this</i> week. One client is a list. A book is intelligence.
        </div>
        <div ref={listRef} style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "38vh", overflowY: "auto" }}>
          {names.map((n, i) => (
            <div key={n + i} style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 10, padding: "9px 11px", display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ width: 22, height: 22, borderRadius: 999, background: avatarBg[i % avatarBg.length], color: "#fff", fontSize: 8.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{initials(n)}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n}</span>
              <span style={{ marginLeft: "auto", color: C.primaryLight, fontSize: 12, flexShrink: 0 }}>✓</span>
            </div>
          ))}
          <div style={{ background: C.card, border: "2px solid rgba(20,30,22,0.30)", borderRadius: 10, padding: "9px 11px" }}>
            <input
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") submitName(); }}
              placeholder={names.length === 0 ? "First client…" : "Next client…"}
              style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: 13.5, color: C.text }}
            />
          </div>
        </div>
        <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 7, textAlign: "center" }}>enter adds the next row — details later</div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={onClose} style={{ ...primaryBtn, flex: 1 }}>
            {names.length > 1 ? `Done — ${names.length} in the book` : "Done"}
          </button>
          <button onClick={onClose} style={{ background: "transparent", border: "1px solid " + C.border, borderRadius: 10, padding: "12px 16px", fontSize: 12.5, fontWeight: 600, color: C.textSec, fontFamily: "inherit", cursor: "pointer" }}>
            Later
          </button>
        </div>
      </div>
    </Overlay>
  );
}

// ─── Getting-started pill (Today) — auto-resolves, dismissible ─────────
export function GettingStartedPill({ clientsCount, tasksCount, onBook }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  const dismiss = () => {
    setHidden(true);
    try { window.localStorage.setItem("rt:gsPillDismissed", "1"); } catch (_) { /* unavailable */ }
  };
  const item = (done, labelDone, labelTodo, onClick) => done
    ? <span style={{ color: C.primaryDeep }}>{labelDone} ✓</span>
    : (onClick
      ? <button onClick={onClick} style={{ background: "transparent", border: "none", padding: 0, fontFamily: "inherit", fontSize: 11, fontWeight: 700, color: C.primaryDeep, cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 2 }}>{labelTodo}</button>
      : <span style={{ color: C.textSec }}>{labelTodo}</span>);
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: C.primarySoft, borderRadius: 999, padding: "7px 13px", marginBottom: 10, fontSize: 11, fontWeight: 600 }}>
      {item(clientsCount > 0, "client", "add a client", onBook)}
      <span style={{ color: C.textMuted }}>·</span>
      {item(tasksCount > 0, "task", "capture a task")}
      <span style={{ color: C.textMuted }}>·</span>
      {item(clientsCount >= 3, "your book", "add your book", onBook)}
      <button onClick={dismiss} aria-label="Dismiss" style={{ background: "transparent", border: "none", cursor: "pointer", color: C.textMuted, fontSize: 12, padding: "0 0 0 2px", lineHeight: 1, fontFamily: "inherit" }}>×</button>
    </div>
  );
}

// ─── Rai status cards (Today) — the overnight ritual ───────────────────
// 'night'   → has client+task, sweep hasn't run yet: set the promise.
// 'nothing' → account has gaps: say plainly why there was no brief.
export function RaiNightCard({ variant }) {
  return (
    <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: "13px 15px", marginBottom: 12, boxShadow: "var(--rt-sh-xs)" }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: "#7c5cf3" }}>✦ RAI · RETENTION SPECIALIST</div>
      {variant === "night" ? (
        <>
          <div style={{ ...FRAUNCES, fontSize: 13.5, color: C.text, lineHeight: 1.5, marginTop: 5 }}>
            I work nights. While you sleep, I'll read everything you've added and have your first brief ready in the morning.
          </div>
          <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 7 }}>Tonight at midnight · your time</div>
        </>
      ) : (
        <div style={{ ...FRAUNCES, fontSize: 13.5, color: C.text, lineHeight: 1.5, marginTop: 5 }}>
          Nothing to read last night. One client and one task — that's all I need for your first brief tomorrow morning.
        </div>
      )}
    </div>
  );
}

// ─── Rai's specialist gate (Rai page, empty roster) ────────────────────
export function SpecialistGate({ onAddBook, onBrainDump }) {
  return (
    <div style={{ height: "100%", minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", background: C.bg }}>
      <div style={{ maxWidth: 420, width: "100%", background: C.card, border: "1px solid " + C.border, borderRadius: 16, padding: "20px 22px", boxShadow: "var(--rt-sh-card)" }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 1, color: "#7c5cf3" }}>✦ RAI · RETENTION SPECIALIST</div>
        <div style={{ ...FRAUNCES, fontSize: 16.5, color: C.text, lineHeight: 1.5, marginTop: 7 }}>
          I can't watch over an empty roster. Bring me your book — even just the names — and one promise you've made someone. Then I'll get to work.
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={onAddBook} style={{ ...primaryBtn, width: "auto", flex: 1, padding: "11px 14px", fontSize: 12.5 }}>Add your book</button>
          <button onClick={onBrainDump} style={{ background: "transparent", border: "1px solid " + C.border, borderRadius: 10, padding: "11px 16px", fontSize: 12.5, fontWeight: 700, color: C.text, fontFamily: "inherit", cursor: "pointer" }}>Brain Dump</button>
        </div>
      </div>
    </div>
  );
}

// ─── Health: score-the-first-relationship guided card ──────────────────
export function ScoreFirstCard({ clientName, onScore }) {
  return (
    <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 14, padding: "15px 17px", marginBottom: 14, boxShadow: "var(--rt-sh-card)" }}>
      <div style={{ ...FRAUNCES, fontSize: 15.5, color: C.text, lineHeight: 1.4 }}>How solid is {clientName}, really?</div>
      <div style={{ fontSize: 12, color: C.textSec, margin: "6px 0 12px", lineHeight: 1.55 }}>
        Score the relationship across 12 dimensions — about 2 minutes. Rai starts watching for drift the same night.
      </div>
      <button onClick={onScore} style={{ ...primaryBtn, width: "auto", padding: "10px 18px", fontSize: 12.5 }}>Score {clientName}</button>
    </div>
  );
}
