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


// ═══════════════════════════════════════════════════════════════════════
// ONBOARDING v2 (Jul 2026) — the Book Drop entry + First Week activation
// One metric governs everything here: clients in the book, first session.
// Win vocabulary rule: celebratory copy names clients, dollars, promises,
// mornings, the book, drift — never app actions. No confetti, no badges.
// ═══════════════════════════════════════════════════════════════════════

// ─── useCountUp — tiny rAF count-up shared by the Book Drop counter and
// the score reveal. Animates 0 → target on mount, then prev → next on
// target changes. Cubic ease-out, cleans up on unmount. ─────────────────
export function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef(null);
  useEffect(() => {
    const from = fromRef.current;
    if (from === target) { setValue(target); return; }
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);
  return value;
}

// ─── splitRoster — the paste parser. Takes anything (typed names, a
// spreadsheet column, an invoice list, a messy note) and returns
// [{ name, revenue }]. Deterministic and client-side: covers the 90%
// case for free; truly messy blobs can route through Rai later. ────────
export function splitRoster(text) {
  const out = [];
  const seen = new Set();
  // Protect thousands separators BEFORE tokenizing — otherwise the comma
  // splitter shears "$2,500/mo" into "$2" + a junk "500/mo" entry.
  for (const raw of String(text || "").replace(/(\d),(?=\d)/g, "$1").split(/[\n,;]+/)) {
    let t = raw.trim();
    if (!t) continue;
    // Catch a $ amount riding along ("Harbor & Pine $2,500/mo", "$3k")
    let revenue = 0;
    const money = t.match(/\$\s*([\d][\d,]*(?:\.\d+)?)\s*(k\b)?(?:\s*\/\s*mo(?:nth)?\b)?/i);
    if (money) {
      revenue = Math.round(parseFloat(money[1].replace(/,/g, "")) * (money[2] ? 1000 : 1));
      t = (t.slice(0, money.index) + t.slice(money.index + money[0].length)).trim();
    }
    // BARE NUMBERS ARE REVENUE, NEVER NAMES (Jul 2026). The $-only regex
    // above meant "Northbeam, 1450" minted a client literally named
    // "1450". A token that is nothing but a number (optionally "k" or
    // "/mo") attaches as revenue to the entry before it — or drops if
    // that entry already has one. It never becomes a client.
    // Names that merely CONTAIN digits ("Studio 54") are untouched.
    const bareNum = t.match(/^([\d][\d,]*(?:\.\d+)?)\s*(k\b)?(?:\s*\/?\s*mo(?:nth)?(?:ly)?\b)?$/i);
    if (bareNum) {
      const val = Math.round(parseFloat(bareNum[1].replace(/,/g, "")) * (bareNum[2] ? 1000 : 1));
      if (val > 0 && out.length && !out[out.length - 1].revenue) out[out.length - 1].revenue = val;
      continue;
    }
    // Emails: "Maya <maya@x.com>" → "Maya"; bare "maya.linwood@x.com" → "Maya Linwood"
    t = t.replace(/<[^>]*>/g, " ").trim();
    const bareEmail = t.match(/^([A-Za-z0-9._%+-]+)@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/);
    if (bareEmail) {
      t = bareEmail[1].replace(/[._]+/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
    } else {
      t = t.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, " ").trim();
    }
    // List junk: leading bullets / "1." numbering (but "3M" survives —
    // the number must be followed by a separator), trailing dashes/colons.
    t = t.replace(/^\s*(?:[-–•*]|\d{1,3}[.)])\s+/, "").replace(/[\s\-–:|]+$/, "").replace(/\s{2,}/g, " ").trim();
    // Backstop: a client name must contain at least one letter. Whatever
    // path a token took to get here, digits-and-symbols-only never mints.
    if (!t || t.length > 60 || !/[A-Za-z]/.test(t)) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: t, revenue });
  }
  return out;
}

// ─── BookDrop — THE first screen. One question, one input, nothing else.
// Type names (Enter between each) or paste a whole list from anywhere.
// The roster materializes live; the counter climbs; the reveal ladder
// shows what each threshold unlocks. Replaces WelcomeOverlay +
// QuickAddClientCard as steps 0–1. ──────────────────────────────────────
export function BookDrop({ onDone, onSkip }) {
  const [entries, setEntries] = useState([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef(null);
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [entries.length]);
  const totalRevenue = entries.reduce((a, e) => a + (e.revenue || 0), 0);
  const shownRevenue = useCountUp(totalRevenue, 700);
  const addFromText = (text) => {
    const parsed = splitRoster(text);
    if (!parsed.length) return;
    setEntries(prev => {
      const have = new Set(prev.map(e => e.name.toLowerCase()));
      return [...prev, ...parsed.filter(p => !have.has(p.name.toLowerCase()))];
    });
  };
  const commitDraft = () => { const d = draft.trim(); if (d) { addFromText(d); setDraft(""); } };
  const finish = async () => {
    if (busy || entries.length === 0) return;
    setBusy(true);
    const ok = await onDone(entries);
    if (!ok) setBusy(false);
  };
  const initials = (n) => n.split(/\s+/).map(w => w[0]).filter(Boolean).join("").slice(0, 2).toUpperCase();
  const avatarBg = [C.primary, C.primaryLight, "#A8A420", C.primaryDeep];
  const n = entries.length;
  // The reveal ladder — what the book is buying, visible WHILE they add.
  const ladder = [
    { lit: n >= 1, text: "Task capture unlocked — I catch names, dates, repeats as you type." },
    { lit: n >= 3, text: "Ranking unlocked — I'll tell you who needs you this week, not just who's loudest." },
    { lit: n >= 1, text: "Your first brief: tomorrow morning, while you sleep." },
  ];
  return (
    <Overlay>
      <div>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <span style={{ ...WORDMARK, fontSize: 22, color: C.primary }}>Retayned.</span>
        </div>
        <div style={{ background: C.bg, border: "1px solid " + C.border, borderRadius: 18, padding: "22px 20px", boxShadow: "var(--rt-sh-card)" }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 1, color: "#7c5cf3", marginBottom: 6 }}>✦ RAI · RETENTION SPECIALIST</div>
          <div style={{ ...FRAUNCES, fontSize: 24, lineHeight: 1.22, color: C.text, letterSpacing: "-0.01em" }}>Who pays you?</div>
          <div style={{ fontSize: 12.5, color: C.textSec, margin: "8px 0 14px", lineHeight: 1.55 }}>
            Type your clients — or paste your whole list from anywhere. Names are enough. I'll read everything tonight and have your first brief ready in the morning.
          </div>
          {/* Counter — climbs as the book assembles */}
          {n > 0 && (
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: C.primaryDeep, fontVariantNumeric: "tabular-nums" }}>
                {n} client{n === 1 ? "" : "s"}
              </span>
              {totalRevenue > 0 && (
                <span style={{ fontSize: 12.5, fontWeight: 700, color: C.primary, fontVariantNumeric: "tabular-nums" }}>
                  · ${shownRevenue.toLocaleString()}/mo under watch
                </span>
              )}
            </div>
          )}
          {/* Live roster */}
          <div ref={listRef} style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "32vh", overflowY: "auto", marginBottom: 8 }}>
            {entries.map((e, i) => (
              <div key={e.name} style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 10, padding: "8px 11px", display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ width: 22, height: 22, borderRadius: 999, background: avatarBg[i % avatarBg.length], color: "#fff", fontSize: 8.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{initials(e.name)}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{e.name}</span>
                {e.revenue > 0 && <span style={{ fontSize: 11, color: C.textMuted, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>${e.revenue.toLocaleString()}/mo</span>}
                <button onClick={() => setEntries(prev => prev.filter(x => x.name !== e.name))} aria-label={"Remove " + e.name} style={{ background: "transparent", border: "none", cursor: "pointer", color: C.textMuted, fontSize: 13, lineHeight: 1, padding: 0, fontFamily: "inherit", flexShrink: 0 }}>×</button>
              </div>
            ))}
            <textarea
              autoFocus
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitDraft(); } }}
              onPaste={(e) => {
                const text = e.clipboardData ? e.clipboardData.getData("text") : "";
                if (text && /[\n,;]/.test(text)) { e.preventDefault(); addFromText(draft + "\n" + text); setDraft(""); }
              }}
              onBlur={commitDraft}
              placeholder={n === 0 ? "First client — or paste your list…" : "Next client…"}
              style={{ width: "100%", boxSizing: "border-box", border: "2px solid rgba(20,30,22,0.30)", borderRadius: 10, padding: "10px 11px", background: C.card, fontFamily: "inherit", fontSize: 13.5, color: C.text, outline: "none", resize: "none", lineHeight: 1.4 }}
            />
          </div>
          <div style={{ fontSize: 10.5, color: C.textMuted, textAlign: "center", marginBottom: 12 }}>enter adds the next row · paste catches names and $ amounts</div>
          {/* Reveal ladder — the unlocks, in view while they add */}
          <div style={{ display: "flex", flexDirection: "column", gap: 7, padding: "12px 12px", background: C.surfaceWarm, borderRadius: 12, marginBottom: 14 }}>
            {ladder.map((row, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, opacity: row.lit ? 1 : 0.45, transition: "opacity 400ms var(--rt-ease-out)" }}>
                <span style={{ color: row.lit ? C.primary : C.textMuted, fontSize: 12, lineHeight: "17px", flexShrink: 0 }}>{row.lit ? "✓" : "·"}</span>
                <span style={{ fontSize: 11.5, color: row.lit ? C.text : C.textMuted, lineHeight: 1.45 }}>{row.text}</span>
              </div>
            ))}
          </div>
          <button onClick={finish} disabled={n === 0 || busy} style={{ ...primaryBtn, opacity: n > 0 && !busy ? 1 : 0.45, cursor: n > 0 && !busy ? "pointer" : "default" }}>
            {busy ? `Adding ${n} client${n === 1 ? "" : "s"}…` : n === 0 ? "Add your first client" : n === 1 ? "Done — 1 in the book" : `Done — ${n} in the book`}
          </button>
          <div style={{ textAlign: "center" }}>
            <button onClick={onSkip} style={{ ...quietLink, marginTop: 10 }}>I'll explore on my own first</button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

// ─── FirstWeekCard — the activation chain, replacing GettingStartedPill.
// Five milestones: BOOK → PROMISE → READ → KEPT → SCORED. Each flips to a
// client-focused win line the moment it lands and stays flipped
// (localStorage stamps). Dismiss collapses to a dot-progress pill.
// Retires permanently at 5/5 after one closing line. ────────────────────
const FW_KEYS = { book: "rt:fw:book", promise: "rt:fw:promise", read: "rt:fw:read", kept: "rt:fw:kept", scored: "rt:fw:scored" };
const fwGet = (k) => { try { return window.localStorage.getItem(k); } catch (_) { return null; } };
const fwSet = (k, v) => { try { window.localStorage.setItem(k, v); } catch (_) { /* unavailable */ } };

export function FirstWeekCard({ clients, tasks, raiPicks, onBook, onScore }) {
  const [stamps, setStamps] = useState(() => {
    const o = {};
    for (const k of Object.keys(FW_KEYS)) o[k] = fwGet(FW_KEYS[k]);
    return o;
  });
  const [collapsed, setCollapsed] = useState(() => fwGet("rt:fwDismissed") === "1");
  const [closed, setClosed] = useState(() => fwGet("rt:fw:closed") === "1");
  const scoredNow = clients.some(c => {
    const p = c.profileScores || c.profile_scores;
    return p && Object.keys(p).length > 0;
  });
  const bookRevenue = clients.reduce((a, c) => a + (c.revenue || 0), 0);
  // Stamp milestones as they land — once stamped, a line never un-flips.
  useEffect(() => {
    const now = String(Date.now());
    let changed = false;
    const next = { ...stamps };
    const hit = (k, cond) => { if (!next[k] && cond) { next[k] = now; fwSet(FW_KEYS[k], now); changed = true; } };
    hit("book", clients.length >= 3);
    hit("promise", tasks.length > 0);
    hit("read", !!raiPicks);
    hit("kept", tasks.some(t => t.done) || !!fwGet("rt:firstCompletionAt"));
    hit("scored", scoredNow);
    if (changed) setStamps(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, tasks, raiPicks, scoredNow]);
  const done = Object.keys(FW_KEYS).filter(k => stamps[k]).length;
  const allDone = done === 5;
  // 5/5 → show the closing line for ~8s, then retire forever.
  useEffect(() => {
    if (!allDone || closed) return;
    const t = setTimeout(() => { fwSet("rt:fw:closed", "1"); setClosed(true); }, 8000);
    return () => clearTimeout(t);
  }, [allDone, closed]);
  if (closed) return null;
  if (allDone) {
    return (
      <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: "12px 15px", marginBottom: 10, boxShadow: "var(--rt-sh-xs)" }}>
        <div style={{ ...FRAUNCES, fontSize: 14, color: C.text, lineHeight: 1.5 }}>The book is alive. From here, it's mornings.</div>
      </div>
    );
  }
  if (collapsed) {
    return (
      <button onClick={() => { setCollapsed(false); fwSet("rt:fwDismissed", "0"); }} aria-label="First week progress" style={{ display: "inline-flex", alignItems: "center", gap: 5, background: C.primarySoft, border: "none", borderRadius: 999, padding: "7px 12px", marginBottom: 10, cursor: "pointer", fontFamily: "inherit" }}>
        {Object.keys(FW_KEYS).map(k => (
          <span key={k} style={{ width: 6, height: 6, borderRadius: 999, background: stamps[k] ? C.primary : C.border }} />
        ))}
        <span style={{ fontSize: 10.5, fontWeight: 700, color: C.primaryDeep, marginLeft: 3 }}>{done}/5</span>
      </button>
    );
  }
  const rows = [
    { k: "book", win: bookRevenue > 0 ? `$${bookRevenue.toLocaleString()}/mo now under watch.` : "Your book, under watch.", todo: "add your book", act: onBook },
    { k: "promise", win: "First promise on the record.", todo: "capture a task", act: null },
    { k: "read", win: "You've seen your first brief. There's one every morning.", todo: "your first brief — tomorrow morning", act: null },
    { k: "kept", win: "One kept promise. Rai saw it too.", todo: "complete a task", act: null },
    { k: "scored", win: `${clients[0]?.name || "A client"}, scored. Rai starts watching for drift tonight.`, todo: "score a client", act: onScore },
  ];
  return (
    <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: "12px 15px 10px", marginBottom: 10, boxShadow: "var(--rt-sh-xs)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: C.textMuted }}>First week</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: C.primaryDeep, fontVariantNumeric: "tabular-nums" }}>{done}/5</span>
        <button onClick={() => { setCollapsed(true); fwSet("rt:fwDismissed", "1"); }} aria-label="Collapse" style={{ marginLeft: "auto", background: "transparent", border: "none", cursor: "pointer", color: C.textMuted, fontSize: 13, lineHeight: 1, padding: 0, fontFamily: "inherit" }}>×</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map(r => (
          <div key={r.k} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span style={{ color: stamps[r.k] ? C.primary : C.border, fontSize: 12, lineHeight: "17px", flexShrink: 0 }}>{stamps[r.k] ? "✓" : "○"}</span>
            {stamps[r.k] ? (
              <span style={{ fontSize: 12, color: C.text, lineHeight: 1.45 }}>{r.win}</span>
            ) : r.act ? (
              <button onClick={r.act} style={{ background: "transparent", border: "none", padding: 0, fontFamily: "inherit", fontSize: 12, color: C.primaryDeep, fontWeight: 600, cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 2, textAlign: "left", lineHeight: 1.45 }}>{r.todo}</button>
            ) : (
              <span style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.45 }}>{r.todo}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ScoreReveal — the count-up moment after the 12-dimension scoring.
// The number arrives (0 → score over ~900ms) with the ring drawing in
// sync, then a verdict line derived from the dimension shape — the
// strongest dimension leads unless something sits at ≤3. ────────────────
export function ScoreReveal({ score, dims, dimNames }) {
  const shown = useCountUp(score || 0, 900);
  const verdict = (() => {
    const entries = Object.entries(dims || {}).filter(([, v]) => v != null);
    if (!entries.length) return null;
    const nameOf = (k) => (dimNames && dimNames[k]) || k.replace(/_/g, " ");
    let best = entries[0], worst = entries[0];
    for (const e of entries) {
      if (e[1] > best[1]) best = e;
      if (e[1] < worst[1]) worst = e;
    }
    if (worst[1] <= 3) return `${nameOf(best[0])} carries it — ${nameOf(worst[0]).toLowerCase()} is the soft spot.`;
    if (score >= 75) return `Solid — ${nameOf(best[0]).toLowerCase()} carries it.`;
    if (score >= 55) return `Steady, with room — ${nameOf(best[0]).toLowerCase()} is the strength to build on.`;
    return `Fragile — ${nameOf(best[0]).toLowerCase()} is what's holding it together.`;
  })();
  const color = score >= 75 ? C.success : score >= 55 ? C.warning : C.danger;
  const R = 30;
  const circ = 2 * Math.PI * R;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "6px 0 2px" }}>
      <div style={{ position: "relative", width: 72, height: 72 }}>
        <svg width={72} height={72} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={36} cy={36} r={R} fill="none" stroke={C.borderLight} strokeWidth="4" />
          <circle cx={36} cy={36} r={R} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={circ * (1 - Math.min(100, shown) / 100)} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: C.text, fontVariantNumeric: "tabular-nums", letterSpacing: -0.5 }}>{shown}</span>
        </div>
      </div>
      {verdict && (
        <div style={{ ...FRAUNCES, fontSize: 13, color: C.textSec, textAlign: "center", lineHeight: 1.5, maxWidth: 320 }}>{verdict}</div>
      )}
    </div>
  );
}
