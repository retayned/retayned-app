// ─── BrainDump — dump a call's worth of notes, Rai fans it into items ────
//
// Flow: pick client (optional) → type/paste the dump → Extract → review
// list (keep/discard, double-click-editable titles and notes, type
// reclassification dropdown, suggested-due chip) → Add N items.
//
// Tasks commit through tasksDb.create (notes ride along — the `notes`
// column), touchpoints through touchpointsDb.create, events through
// personalCalendarDb.create at 9:00 AM local on the suggested date.
// Nothing lands without explicit approval — Rai proposes, you decide.
//
// All db imports are ALIASED (tasksDb, not tasks) — bare db namespace
// names shadow App state names; see the shadowing-inversion incident.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import {
  personalCalendar as personalCalendarDb,
  tasks as tasksDb,
  touchpoints as touchpointsDb,
} from "../lib/db";
import { supabase } from "../lib/supabase.js";
import { C } from "../theme";

const TITLE_CAP = 75;

// All three types share the site's soft-green chip treatment — type is a
// classification, not a status; color coding added noise without meaning.
const TYPE_META = {
  task:       { label: "Task" },
  touchpoint: { label: "Touchpoint" },
  event:      { label: "Event" },
};

function localYmdToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// "2026-06-12" → "Fri, Jun 12" (local-safe: parse as local midnight)
const _ymdOffset = (off) => {
  const d = new Date();
  d.setDate(d.getDate() + off);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function dueLabel(ymd) {
  if (!ymd || ymd === _ymdOffset(0)) return "Today";
  if (ymd === _ymdOffset(1)) return "Tomorrow";
  if (ymd === _ymdOffset(7)) return "Later";
  // Rai-suggested specific dates ("by Friday", "Father's Day") keep
  // their real date label. Users can't hand-pick these — Rai sets them.
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// Exactly three user-selectable options. "Later" = a week out.
function dueOptions() {
  return [
    { ymd: _ymdOffset(0), label: "Today" },
    { ymd: _ymdOffset(1), label: "Tomorrow" },
    { ymd: _ymdOffset(7), label: "Later" },
  ];
}

export default function BrainDump({ open, onClose, clients, user, onCommitted }) {
  const [step, setStep] = useState("input");           // 'input' | 'review'
  const [clientId, setClientId] = useState(null);
  const [clientMenuOpen, setClientMenuOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [dump, setDump] = useState("");
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);              // [{key,title,notes,type,suggested_due,keep}]
  const [editingField, setEditingField] = useState(null); // {key, field:'title'|'notes'}
  const [typeMenuKey, setTypeMenuKey] = useState(null);
  const [dueMenuKey, setDueMenuKey] = useState(null);
  const textareaRef = useRef(null);
  const editRef = useRef(null);

  const activeClients = (clients || []).filter((c) => c.is_active !== false);
  const chosenClient = clientId ? activeClients.find((c) => c.id === clientId) || null : null;
  // Manual pick is sticky — autodetect never overrides an explicit choice.
  const [manualPick, setManualPick] = useState(false);

  // ── Draft persistence ───────────────────────────────────────────────
  // Adam's rule (June 2026): a dump survives an ACCIDENTAL exit only.
  // Click out and come back within 5 minutes — everything's there.
  // Beyond 5 minutes it wasn't an accident: fresh slate, every time.
  // Old dumps (and their stale client context) must never resurface.
  // The 5-minute clock anchors to the CLICK-OUT (we stamp savedAt on
  // every change while open AND once more on close).
  const DRAFT_TTL_MS = 5 * 60 * 1000;
  const draftKey = `rt:brainDumpDraft:${user?.id || "anon"}`;
  const draftRestored = useRef(false);
  useEffect(() => {
    if (!open) { draftRestored.current = false; return; } // re-arm for the next open
    if (draftRestored.current) return;
    draftRestored.current = true;
    let restored = false;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.savedAt && Date.now() - d.savedAt <= DRAFT_TTL_MS) {
          if (d.dump) setDump(d.dump);
          if (d.clientId) setClientId(d.clientId);
          if (Array.isArray(d.items) && d.items.length) { setItems(d.items); }
          if (d.step === "review" && Array.isArray(d.items) && d.items.length) setStep("review");
          restored = true;
        } else {
          window.localStorage.removeItem(draftKey);
        }
      }
    } catch { /* corrupt draft — treat as absent */ }
    if (!restored) {
      // Expired or absent — ALSO reset the in-memory state. The component
      // can stay mounted across open/close cycles, so React state would
      // otherwise resurrect the old dump even with localStorage cleared.
      setDump("");
      setItems([]);
      setStep("input");
      setClientId(null);
      setManualPick(false);
    }
  }, [open]);
  // Final stamp on close — the 5-minute window starts at the click-out,
  // not at the last keystroke.
  useEffect(() => {
    if (open) return;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw);
      d.savedAt = Date.now();
      window.localStorage.setItem(draftKey, JSON.stringify(d));
    } catch { /* unavailable */ }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    try {
      if (!dump && items.length === 0) {
        // User cleared everything while open — intentional. Delete the
        // stored draft too, or the close-stamp would refresh the OLD
        // draft's clock and the deleted text would resurrect on reopen.
        window.localStorage.removeItem(draftKey);
        return;
      }
      window.localStorage.setItem(draftKey, JSON.stringify({
        dump, clientId, items, step, savedAt: Date.now(),
      }));
    } catch { /* storage full/blocked — degrade silently */ }
  }, [open, dump, clientId, manualPick, items, step]);
  const clearDraft = () => { try { window.localStorage.removeItem(draftKey); } catch {} };

  // ── Client autodetect ───────────────────────────────────────────────
  // Composer-grade matching, not naive full-name inclusion: full client
  // name (100) > full contact name (95) > distinctive name token ≥4 chars
  // ("Fenix" → Fenix Sportier) (90) > unique contact first name (70).
  // Word-boundary tested so "art" never matches inside "start". The
  // picker stays as the manual override and is sticky once used.
  useEffect(() => {
    if (!open || manualPick) return;
    const lower = dump.toLowerCase();
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const wb = (s) => new RegExp(`(^|[^a-z0-9])${esc(s)}([^a-z0-9]|$)`);
    const COMMON = new Set(["team","meeting","call","sync","update","review","status","weekly","monthly","daily","quarterly","recap","check","catch","catchup","kickoff","demo","planning","intro","discussion","agenda","quick"]);
    const firstNameCounts = {};
    for (const c of activeClients) {
      const f = (c.contact || "").trim().split(/\s+/)[0]?.toLowerCase();
      if (f && f.length >= 2) firstNameCounts[f] = (firstNameCounts[f] || 0) + 1;
    }
    let best = null;
    const consider = (score, c, len) => {
      if (!best || score > best.score || (score === best.score && len > best.len)) best = { score, id: c.id, len };
    };
    for (const c of activeClients) {
      const name = (c.name || "").trim();
      if (!name) continue;
      if (wb(name.toLowerCase()).test(lower)) { consider(100, c, name.length); continue; }
      const contact = (c.contact || "").trim();
      if (contact.includes(" ") && wb(contact.toLowerCase()).test(lower)) { consider(95, c, contact.length); continue; }
      let tokenHit = false;
      for (const tok of name.split(/\s+/)) {
        const clean = tok.replace(/[^\w]/g, "").toLowerCase();
        if (clean.length >= 4 && !COMMON.has(clean) && wb(clean).test(lower)) {
          consider(90, c, clean.length);
          tokenHit = true;
          break;
        }
      }
      if (tokenHit) continue;
      const first = contact.split(/\s+/)[0]?.toLowerCase() || "";
      if (first && first.length >= 2 && firstNameCounts[first] === 1 && wb(first).test(lower)) consider(70, c, first.length);
    }
    if (best && best.id !== clientId) setClientId(best.id);
    if (!best && clientId && !manualPick) setClientId(null);
  }, [dump, open, manualPick, clients]);

  useEffect(() => {
    if (open && step === "input") {
      // Focus the dump zone on open — typing is the whole point.
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open, step]);

  useEffect(() => {
    if (editingField) setTimeout(() => editRef.current?.focus(), 30);
  }, [editingField]);

  if (!open) return null;

  const reset = () => {
    setStep("input"); setDump(""); setItems([]); setError(null);
    setEditingField(null); setTypeMenuKey(null); setClientMenuOpen(false);
    setManualPick(false); setDueMenuKey(null);
  };
  const close = () => { reset(); setClientId(null); onClose(); };

  // ── Extract: call the edge function ──────────────────────────────────
  const extract = async () => {
    if (dump.trim().length < 10 || loading) return;
    setLoading(true); setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rai-extract-tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
          "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ client_id: clientId, dump_text: dump.trim() }),
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(body.error || `Extraction failed (${resp.status})`);
      const got = (body.items || []).map((it, i) => ({
        key: `bd${Date.now()}_${i}`,
        title: it.title,
        notes: it.notes || null,
        type: it.type || "task",
        // No date is not a state — everything lands somewhere. Rai's
        // explicit date wins; otherwise Today. The due dropdown in
        // review changes it.
        suggested_due: it.suggested_due || localYmdToday(),
        keep: true,
      }));
      if (got.length === 0) {
        setError("Rai couldn't find any actionable items in that. Add more detail and try again.");
      } else {
        setItems(got);
        setStep("review");
      }
    } catch (e) {
      setError(e.message || "Extraction failed — try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Commit: create the kept items via existing db paths ──────────────
  const commit = async () => {
    const kept = items.filter((it) => it.keep && it.title.trim());
    if (kept.length === 0 || committing) return;
    setCommitting(true); setError(null);
    const createdTasks = [];
    let tp = 0, ev = 0, failed = 0;
    for (const it of kept) {
      const title = it.title.trim().slice(0, TITLE_CAP).trimEnd();
      try {
        if (it.type === "touchpoint") {
          const noteText = it.notes ? `${title} — ${it.notes}` : title;
          const { error: e } = await touchpointsDb.create(user.id, {
            client_id: chosenClient?.id || null,
            client_name: chosenClient?.name || null,
            channel: "call",
            notes: noteText,
          });
          if (e) failed++; else tp++;
        } else if (it.type === "event") {
          // Calendar events need a time; default 9:00 AM local on the
          // suggested date (or today). Easy to drag/adjust afterwards.
          const ymd = it.suggested_due || localYmdToday();
          const starts = new Date(`${ymd}T09:00:00`);
          const ends = new Date(starts.getTime() + 30 * 60 * 1000);
          const { error: e } = await personalCalendarDb.create(user.id, {
            title,
            starts_at: starts.toISOString(),
            ends_at: ends.toISOString(),
            client_id: chosenClient?.id || null,
            client_name: chosenClient?.name || null,
          });
          if (e) failed++; else ev++;
        } else {
          const { data: created, error: e } = await tasksDb.create(user.id, {
            text: title,
            client_name: chosenClient?.name || null,
            client_id: chosenClient?.id || null,
            is_recurring: false,
            recurrence_pattern: null,
            due_date: it.suggested_due || localYmdToday(),
            assigned_worker_id: null,
            notes: it.notes || null,
          });
          if (e) { failed++; continue; }
          createdTasks.push({
            id: created?.id || "bd" + Date.now() + Math.random().toString(36).slice(2, 6),
            text: title,
            client: chosenClient?.name || null,
            client_id: chosenClient?.id || null,
            notes: it.notes || null,
            done: false, ai: false,
            recurring: false, recurrence_pattern: null,
            due_date: it.suggested_due || localYmdToday(),
            raiPriority: false, alert: false,
            created_at: Date.now(),
            assigned_worker_id: null,
          });
        }
      } catch {
        failed++;
      }
    }
    setCommitting(false);
    clearDraft();
    onCommitted?.({ tasks: createdTasks, touchpoints: tp, events: ev, failed });
    close();
  };

  const keptCount = items.filter((it) => it.keep).length;
  const wordCount = dump.trim() ? dump.trim().split(/\s+/).length : 0;

  const patchItem = (key, patch) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  // ── styles ────────────────────────────────────────────────────────────
  // Same backdrop the client modal uses (App.jsx) — fixed to the BODY via
  // portal so it blurs EVERYTHING including the sidebar. Rendering inside
  // the page container put it inside a stacking context that couldn't
  // cover the sidebar.
  const overlay = {
    position: "fixed", inset: 0, zIndex: 90,
    background: "rgba(20,30,22,0.38)",
    backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)",
    display: "flex", alignItems: "flex-start", justifyContent: "center",
    padding: "8vh 16px 16px",
  };
  const card = {
    width: "100%", maxWidth: 640, maxHeight: "82vh",
    display: "flex", flexDirection: "column",
    background: C.bg, borderRadius: 16,
    boxShadow: "0 24px 64px rgba(20,30,22,0.28)",
    overflow: "hidden",
    fontFamily: "'Manrope', system-ui, sans-serif",
  };
  const chipBtn = {
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: "3px 9px", borderRadius: 999, border: `1px solid ${C.borderLight}`,
    background: "transparent", fontSize: 11, fontWeight: 600,
    color: C.textSec, cursor: "pointer", fontFamily: "inherit",
  };

  return createPortal(
    <div style={overlay} onClick={close}>
      <div style={card} onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 18px 12px" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }} aria-hidden="true">
            <path d="M12 4l2.2 5.8 5.8 2.2-5.8 2.2L12 20l-2.2-5.8L4 12l5.8-2.2L12 4z" fill={C.btn} />
          </svg>
          <span style={{
            fontFamily: "'Fraunces', Georgia, serif", fontStyle: "italic",
            fontSize: 19, fontWeight: 500, color: C.text, letterSpacing: "-0.01em",
          }}>
            brain dump
          </span>
          {step === "review" && (
            <span style={{ fontSize: 12, color: C.textSec, fontWeight: 500 }}>
              · Rai found {items.length} item{items.length === 1 ? "" : "s"}
            </span>
          )}
          <span style={{ flex: 1 }} />
          <button onClick={close} style={{
            border: "none", background: "transparent", cursor: "pointer",
            color: C.textMuted, padding: 4, display: "flex",
          }} aria-label="Close">
            <Icon name="x" size={16} simple color={C.textMuted} />
          </button>
        </div>

        {step === "input" ? (
          <>
            {/* ── Client selector ── */}
            <div style={{ padding: "0 18px 10px", position: "relative", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => setClientMenuOpen(!clientMenuOpen)} style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: C.card, border: `0.5px solid ${C.borderLight}`,
                borderRadius: 8, padding: "4px 10px 4px 5px",
                cursor: "pointer", fontFamily: "inherit",
              }}>
                <span style={{
                  width: 20, height: 20, borderRadius: 999, flexShrink: 0,
                  background: chosenClient ? "#33543E" : C.surface,
                  color: "#fff", fontSize: 9, fontWeight: 700,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}>
                  {chosenClient
                    ? (chosenClient.name || "").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()
                    : ""}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: chosenClient ? C.text : C.textSec }}>
                  {chosenClient ? chosenClient.name : "No client / personal"}
                </span>
                <span style={{ fontSize: 9, color: C.textMuted }}>▾</span>
              </button>
              {chosenClient && !manualPick && (
                <span style={{ fontSize: 10.5, color: C.textMuted, fontStyle: "italic" }}>
                  detected from your notes — tap to change
                </span>
              )}
              {clientMenuOpen && (
                <>
                  <div onClick={() => setClientMenuOpen(false)}
                       style={{ position: "fixed", inset: 0, zIndex: 49, background: "transparent" }} />
                  <div className="rt-picker-panel" style={{
                    position: "absolute", top: "calc(100% + 6px)", left: 18,
                    minWidth: 240, maxHeight: 260, overflowY: "auto", zIndex: 50,
                    background: C.card, borderRadius: 10,
                    boxShadow: "0 12px 32px rgba(20,30,22,0.18)", padding: 6,
                  }}>
                    <input
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      placeholder="Search clients…"
                      style={{
                        width: "100%", boxSizing: "border-box", border: "none", outline: "none",
                        background: "transparent", fontSize: 12.5, fontFamily: "inherit",
                        color: C.text, padding: "6px 8px", borderBottom: `1px solid ${C.borderLight}`,
                        marginBottom: 4,
                      }}
                    />
                    <button
                      onClick={() => { setClientId(null); setManualPick(true); setClientMenuOpen(false); setClientSearch(""); }}
                      style={{
                        display: "block", width: "100%", textAlign: "left", padding: "7px 8px",
                        border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
                        fontSize: 13, fontWeight: clientId === null ? 700 : 500,
                        background: clientId === null ? C.surface : "transparent", color: C.text,
                      }}
                    >
                      No client / personal
                    </button>
                    {activeClients
                      .filter((c) => !clientSearch || (c.name || "").toLowerCase().includes(clientSearch.toLowerCase()))
                      .map((c) => (
                        <button
                          key={c.id}
                          onClick={() => { setClientId(c.id); setManualPick(true); setClientMenuOpen(false); setClientSearch(""); }}
                          style={{
                            display: "block", width: "100%", textAlign: "left", padding: "7px 8px",
                            border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
                            fontSize: 13, fontWeight: clientId === c.id ? 700 : 500,
                            background: clientId === c.id ? C.surface : "transparent", color: C.text,
                          }}
                        >
                          {c.name}
                        </button>
                      ))}
                  </div>
                </>
              )}
            </div>

            {/* ── The dump zone ── */}
            <div style={{ padding: "0 18px", flex: 1, display: "flex", minHeight: 0 }}>
              <textarea
                ref={textareaRef}
                value={dump}
                onChange={(e) => setDump(e.target.value)}
                placeholder="Dump everything from the call. Rai will sort it into tasks, touchpoints, and events."
                style={{
                  width: "100%", minHeight: 200, maxHeight: "46vh", resize: "vertical",
                  border: "none", borderRadius: 12,
                  background: C.surface, color: C.text,
                  fontSize: 14, lineHeight: 1.6, fontFamily: "inherit",
                  padding: "13px 15px", outline: "none", boxSizing: "border-box",
                }}
              />
            </div>

            {error && (
              <div style={{ padding: "8px 18px 0", fontSize: 12, color: "#B91C1C", fontWeight: 600 }}>
                {error}
              </div>
            )}

            {/* ── Action bar ── */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px 16px" }}>
              <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 500 }}>
                {wordCount > 0 ? `${wordCount} word${wordCount === 1 ? "" : "s"} · held 5 min if you step out` : ""}
              </span>
              <span style={{ flex: 1 }} />
              <button
                onClick={extract}
                disabled={dump.trim().length < 10 || loading}
                className="r-btn"
                style={{
                  border: "none", borderRadius: 999, padding: "9px 18px",
                  fontFamily: "inherit", fontSize: 13, fontWeight: 600,
                  cursor: dump.trim().length < 10 || loading ? "default" : "pointer",
                  background: dump.trim().length < 10 || loading ? C.surface : "#1C3224",
                  color: dump.trim().length < 10 || loading ? C.textMuted : "#fff",
                }}
              >
                {loading ? "Rai is sorting…" : "Extract tasks"}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* ── Review list ── */}
            <div style={{ padding: "0 18px 4px", fontSize: 12, color: C.textSec }}>
              {chosenClient ? <>For <strong>{chosenClient.name}</strong>. </> : null}
              Uncheck anything wrong. Double-click a title or note to edit. Nothing is added until you approve.
            </div>
            {/* Bottom padding clears the due/type dropdowns on the last
                item — without it the menu clipped at the card edge. */}
            <div style={{ flex: 1, overflowY: "auto", padding: "10px 18px 130px", minHeight: 0 }}>
              {items.map((it) => {
                const meta = TYPE_META[it.type] || TYPE_META.task;
                const isEditTitle = editingField?.key === it.key && editingField.field === "title";
                const isEditNotes = editingField?.key === it.key && editingField.field === "notes";
                return (
                  <div key={it.key} style={{
                    display: "flex", gap: 10, alignItems: "flex-start",
                    padding: "10px 12px", marginBottom: 8,
                    background: C.card, borderRadius: 12,
                    opacity: it.keep ? 1 : 0.45,
                    boxShadow: "0 1px 3px rgba(20,30,22,0.07)",
                  }}>
                    {/* Same geometry as the app's task checkbox (rt-check:
                        22px, radius 6, 2px border) so it reads as the same
                        toggleable control the user already knows. */}
                    <button
                      onClick={() => patchItem(it.key, { keep: !it.keep })}
                      aria-label={it.keep ? "Discard item" : "Keep item"}
                      style={{
                        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                        marginTop: 1, padding: 0, cursor: "pointer",
                        border: "2px solid " + (it.keep ? "#33543E" : C.border),
                        background: it.keep ? "#33543E" : C.card,
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      {it.keep && (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      )}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Title — double-click to edit, same muscle memory as task rows */}
                      {isEditTitle ? (
                        <input
                          ref={editRef}
                          defaultValue={it.title}
                          maxLength={TITLE_CAP}
                          onBlur={(e) => { patchItem(it.key, { title: e.target.value.trim() || it.title }); setEditingField(null); }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                            if (e.key === "Escape") setEditingField(null);
                          }}
                          style={{
                            width: "100%", boxSizing: "border-box", border: `1px solid ${C.borderLight}`,
                            borderRadius: 6, padding: "3px 6px", fontFamily: "inherit",
                            fontSize: 13.5, fontWeight: 600, color: C.text, outline: "none",
                            background: C.bg,
                          }}
                        />
                      ) : (
                        <div
                          onDoubleClick={() => it.keep && setEditingField({ key: it.key, field: "title" })}
                          style={{
                            fontSize: 13.5, fontWeight: 600, color: C.text, lineHeight: 1.35,
                            textDecoration: it.keep ? "none" : "line-through",
                            cursor: it.keep ? "text" : "default",
                          }}
                          title="Double-click to edit"
                        >
                          {it.title}
                        </div>
                      )}

                      {/* Chips: type (reclassifiable) + due */}
                      <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center", position: "relative" }}>
                        <button
                          onClick={() => it.keep && setTypeMenuKey(typeMenuKey === it.key ? null : it.key)}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            border: "none", cursor: "pointer", fontFamily: "inherit",
                            padding: "2px 9px", borderRadius: 999,
                            fontSize: 10.5, fontWeight: 600,
                            background: C.primarySoft, color: C.primary,
                          }}
                        >
                          {meta.label} <span style={{ fontSize: 8, opacity: 0.7 }}>▾</span>
                        </button>
                        {typeMenuKey === it.key && (
                          <>
                            <div onClick={() => setTypeMenuKey(null)}
                                 style={{ position: "fixed", inset: 0, zIndex: 49, background: "transparent" }} />
                            <div style={{
                              position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 50,
                              background: C.card, borderRadius: 8, padding: 4,
                              boxShadow: "0 10px 28px rgba(20,30,22,0.18)",
                            }}>
                              {Object.entries(TYPE_META).map(([val, m]) => (
                                <button
                                  key={val}
                                  onClick={() => { patchItem(it.key, { type: val }); setTypeMenuKey(null); }}
                                  style={{
                                    display: "block", width: "100%", textAlign: "left",
                                    border: "none", borderRadius: 5, padding: "5px 10px",
                                    fontFamily: "inherit", fontSize: 12, cursor: "pointer",
                                    fontWeight: it.type === val ? 700 : 500,
                                    background: it.type === val ? C.surface : "transparent",
                                    color: C.text,
                                  }}
                                >
                                  {m.label}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                        <button
                          onClick={() => it.keep && setDueMenuKey(dueMenuKey === it.key ? null : it.key)}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            border: "none", cursor: "pointer", fontFamily: "inherit",
                            padding: "2px 9px", borderRadius: 999,
                            fontSize: 10.5, fontWeight: 600,
                            background: C.surface, color: C.textSec,
                          }}
                        >
                          {dueLabel(it.suggested_due)} <span style={{ fontSize: 8, opacity: 0.7 }}>▾</span>
                        </button>
                        {dueMenuKey === it.key && (
                          <>
                            <div onClick={() => setDueMenuKey(null)}
                                 style={{ position: "fixed", inset: 0, zIndex: 49, background: "transparent" }} />
                            <div style={{
                              position: "absolute", top: "calc(100% + 4px)", left: 70, zIndex: 50,
                              background: C.card, borderRadius: 8, padding: 4, minWidth: 130,
                              boxShadow: "0 10px 28px rgba(20,30,22,0.18)",
                            }}>
                              {dueOptions().map((opt) => (
                                <button
                                  key={opt.ymd}
                                  onClick={() => { patchItem(it.key, { suggested_due: opt.ymd }); setDueMenuKey(null); }}
                                  style={{
                                    display: "block", width: "100%", textAlign: "left",
                                    border: "none", borderRadius: 5, padding: "5px 10px",
                                    fontFamily: "inherit", fontSize: 12, cursor: "pointer",
                                    fontWeight: it.suggested_due === opt.ymd ? 700 : 500,
                                    background: it.suggested_due === opt.ymd ? C.surface : "transparent",
                                    color: C.text,
                                  }}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Note — the long-task solution in action */}
                      {(it.notes || isEditNotes) && (
                        isEditNotes ? (
                          <textarea
                            ref={editRef}
                            defaultValue={it.notes || ""}
                            onBlur={(e) => { patchItem(it.key, { notes: e.target.value.trim() || null }); setEditingField(null); }}
                            onKeyDown={(e) => { if (e.key === "Escape") setEditingField(null); }}
                            style={{
                              width: "100%", boxSizing: "border-box", marginTop: 7, minHeight: 54,
                              border: `1px solid ${C.borderLight}`, borderRadius: 8,
                              padding: "6px 8px", fontFamily: "inherit", fontSize: 12,
                              lineHeight: 1.5, color: C.textSec, outline: "none",
                              background: C.bg, resize: "vertical",
                            }}
                          />
                        ) : (
                          <div
                            onDoubleClick={() => it.keep && setEditingField({ key: it.key, field: "notes" })}
                            style={{
                              marginTop: 8, padding: "7px 10px",
                              background: C.surface, borderRadius: 8,
                              fontSize: 12, lineHeight: 1.5, color: C.textSec,
                              cursor: it.keep ? "text" : "default",
                              whiteSpace: "pre-wrap",
                            }}
                            title="Double-click to edit"
                          >
                            {it.notes}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {error && (
              <div style={{ padding: "0 18px 6px", fontSize: 12, color: "#B91C1C", fontWeight: 600 }}>
                {error}
              </div>
            )}

            {/* ── Footer ── */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px 16px" }}>
              <button
                onClick={() => { setStep("input"); setEditingField(null); setTypeMenuKey(null); }}
                style={{
                  border: "none", background: "transparent", fontFamily: "inherit",
                  fontSize: 12.5, fontWeight: 600, color: C.textSec, cursor: "pointer",
                  padding: "8px 6px",
                }}
              >
                ← Back to dump
              </button>
              <span style={{ flex: 1 }} />
              <button
                onClick={commit}
                disabled={keptCount === 0 || committing}
                className="r-btn"
                style={{
                  border: "none", borderRadius: 999, padding: "9px 18px",
                  fontFamily: "inherit", fontSize: 13, fontWeight: 600,
                  cursor: keptCount === 0 || committing ? "default" : "pointer",
                  background: keptCount === 0 || committing ? C.surface : "#1C3224",
                  color: keptCount === 0 || committing ? C.textMuted : "#fff",
                }}
              >
                {committing ? "Adding…" : `Add ${keptCount} item${keptCount === 1 ? "" : "s"}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
