// ============================================================
// RETAYNED — IntakeSurface (v1.0, day zero interview frontend)
//
// Spec v1.5 §2: THIS component is the only writer. The edge
// (rai-intake) converses and extracts; every OPS capture lands
// here and is mapped through the existing db.js paths with the
// existing scoring function (passed in as a prop from App).
//
// Owner rulings encoded:
//  - clients.notes is DEAD: everything notes-destined (scope,
//    second contact, rate trajectory, declined items, referrals,
//    pauses detail) persists to rai_intake_sessions.extraction.
//  - Routines: is_recurring true + recurrence_pattern mapped to
//    the REAL pattern shape from src/recurrence.jsx (L56-95:
//    daily | weekdays | weekly{days:[dow]} | monthly_date{day}).
//    Verify item 11 was skipped in v1.0 and the specialist
//    caught it: without the pattern every routine was a
//    repeating task that never came due. Weekly patterns take
//    the weekday named in the user's own text when one is
//    present, else anchor to the intake day; monthly anchors to
//    the intake date (the engine clamps short months).
//  - Pause rows + referral rows: captured to extraction only in
//    v1 (their db.js write signatures are unverified; late_pay
//    rule). Months arrive already pause-adjusted per the
//    prompt's parsing law, so scoring and LTV stay honest.
//  - LTV: computed HERE (single client-side source for the
//    close), conservative: two-segment when a lower start rate
//    was mined, rounded DOWN to the nearest $10k.
// ============================================================

import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { clients as clientsDb, tasks as tasksDb } from "../lib/db";

const P = "#7C5CF3";      // Rai purple
const CLAY = "#C15F3C";   // Claude clay
const INK = "#1F2937";

// Cadence -> recurrence_pattern, mapped to src/recurrence.jsx's real
// shape (specialist-ratified paste, L56-95). Never reconstructed: kinds
// and field names are the module's own. Weekly: prefer weekday names in
// the user's routine text ("weekly report every friday" -> [5]); else
// anchor to today. Monthly: anchor to today's date; the engine clamps.
const WEEKDAY_IDX = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
export function cadenceToPattern(cadence, text) {
  const c = String(cadence || "").toLowerCase();
  if (c === "daily") return { kind: "daily" };
  if (c === "weekdays") return { kind: "weekdays" };
  if (c === "weekly") {
    const days = [];
    const lower = String(text || "").toLowerCase();
    // Word-boundary match (specialist advisory): full day names with an
    // optional plural, or the STANDALONE 3-letter abbreviation. Substring
    // matching anchored "Monitor ads weekly" to Monday and "friendly
    // check-in" to Friday; boundaries kill both while keeping "mondays"
    // and a bare "mon".
    for (const [name, idx] of Object.entries(WEEKDAY_IDX)) {
      const re = new RegExp("\\b(?:" + name + "s?|" + name.slice(0, 3) + ")\\b");
      if (re.test(lower)) days.push(idx);
    }
    return { kind: "weekly", days: days.length ? [...new Set(days)] : [new Date().getDay()] };
  }
  if (c === "monthly") return { kind: "monthly_date", day: new Date().getDate() };
  return { kind: "daily" }; // unknown cadence: legacy-daily, the module's own fallback
}

// Conservative LTV for the close. Never shown raw: rounded DOWN to the
// nearest $10k and rendered as "north of $Nk". Two-segment estimate when a
// mined trajectory carries a parseable lower starting rate.
export function computeIntakeLtv(revenue, months, trajectoryText) {
  const rev = Number(revenue) || 0;
  const mo = Math.max(0, Number(months) || 0);
  if (!rev || !mo) return null;
  let total = rev * mo;
  if (trajectoryText) {
    const nums = String(trajectoryText).match(/\$?\s?(\d[\d,]*(?:\.\d+)?)\s*k?/gi) || [];
    const parsed = nums
      .map((n) => {
        const k = /k\s*$/i.test(n.trim());
        const v = Number(String(n).replace(/[^0-9.]/g, ""));
        return k ? v * 1000 : v;
      })
      .filter((v) => v >= 100);
    const start = parsed.length ? Math.min(...parsed) : null;
    if (start && start < rev) total = (start * mo) / 2 + (rev * mo) / 2;
  }
  const floored = Math.floor(total / 10000) * 10000;
  return floored >= 10000 ? floored : null;
}

export default function IntakeSurface({
  user,
  calcRetentionScore,
  connectGoogleCalendar,
  googleConnected,
  onComplete,
}) {
  const [messages, setMessages] = useState([]); // {role, content} — assistant content is the raw JSON turn
  const [turn, setTurn] = useState(null);       // parsed latest assistant turn
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [fatalErr, setFatalErr] = useState(null);
  const [showConnects, setShowConnects] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const sessionIdRef = useRef(null);
  const clientMapRef = useRef({});   // temp_id -> { id, name, revenue, months, dims, evidence, flags, rate_set_date }
  const extractionRef = useRef({ transcript: [], ops: [], notes: [], referrals: [], pauses: [], session_meta: {} });
  const dimCountRef = useRef(0);
  const scrollRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("rai_intake_sessions")
        .insert({ user_id: user.id, status: "active", extraction: {} })
        .select("id")
        .single();
      if (data?.id) sessionIdRef.current = data.id;
      await advance([]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  async function persistSession(patch) {
    if (!sessionIdRef.current) return;
    const { error } = await supabase
      .from("rai_intake_sessions")
      .update({ extraction: extractionRef.current, updated_at: new Date().toISOString(), ...(patch || {}) })
      .eq("id", sessionIdRef.current);
    if (error) console.warn("intake session persist failed:", error);
  }

  function focusLtvContext() {
    const focus = Object.values(clientMapRef.current).find((c) => c.isFocus);
    if (!focus || !focus.revenue || !focus.months) return undefined;
    const ltv = computeIntakeLtv(focus.revenue, focus.months, focus.trajectory);
    if (!ltv) return undefined;
    return { ltv_display: `north of $${Math.round(ltv / 1000)}k lifetime` };
  }

  async function advance(nextMessages) {
    setBusy(true);
    setFatalErr(null);
    const body = { messages: nextMessages };
    const ctx = focusLtvContext();
    if (ctx) body.context = ctx;
    const { data, error } = await supabase.functions.invoke("rai-intake", { body });
    setBusy(false);
    if (error || !data || data.error || typeof data.say !== "string") {
      console.error("intake turn failed:", error || data);
      setFatalErr("Rai lost the thread for a second. Tap retry.");
      return;
    }
    const asst = { role: "assistant", content: JSON.stringify(data) };
    setMessages([...nextMessages, asst]);
    setTurn(data);
    extractionRef.current.transcript.push({ role: "assistant", say: data.say, phase: data.phase });
    if (Array.isArray(data.captures) && data.captures.length) {
      extractionRef.current.ops.push(...data.captures);
      await applyCaptures(data.captures);
    }
    if (data.phase === "connects") setShowConnects(true);
    await persistSession();
    if (data.done === true) await finalize();
  }

  async function applyCaptures(captures) {
    for (const cap of captures) {
      try {
        await applyOne(cap);
      } catch (e) {
        console.error("capture apply threw:", cap?.op, e);
      }
    }
  }

  async function applyOne(cap) {
    const map = clientMapRef.current;
    switch (cap.op) {
      case "upsert_client": {
        const f = cap.fields || {};
        const entry = map[cap.temp_id] || { dims: {}, evidence: {}, flags: {} };
        // Whitelisted columns ONLY (late_pay rule). months converts to
        // start_date when no explicit start_date arrived. notes and
        // renewal_date route to extraction, never to the dead column.
        const row = {};
        if (f.name) row.name = f.name;
        if (f.contact) row.contact = f.contact;
        if (f.role) row.role = f.role;
        if (f.revenue != null) row.revenue = Number(f.revenue) || null;
        if (f.start_date) row.start_date = f.start_date;
        else if (f.months != null && !entry.id) {
          const d = new Date();
          d.setMonth(d.getMonth() - (Number(f.months) || 0));
          row.start_date = d.toISOString().slice(0, 10);
        }
        if (f.rate_set_date) row.rate_set_date = f.rate_set_date;
        if (f.notes) extractionRef.current.notes.push({ temp_id: cap.temp_id, text: f.notes });
        if (f.renewal_date) extractionRef.current.notes.push({ temp_id: cap.temp_id, renewal_date: f.renewal_date });
        if (entry.id) {
          if (Object.keys(row).length) {
            const { error } = await clientsDb.update(entry.id, row);
            if (error) console.error("client update failed:", error);
          }
        } else {
          const { data, error } = await clientsDb.create(user.id, {
            retention_score: 50,
            profile_scores: {},
            qualifying_flags: {},
            ...row,
          });
          if (error || !data) { console.error("client create failed:", error); return; }
          entry.id = data.id;
        }
        if (f.name) entry.name = f.name;
        if (f.revenue != null) entry.revenue = Number(f.revenue) || entry.revenue;
        if (f.months != null) entry.months = Number(f.months) || entry.months;
        map[cap.temp_id] = entry;
        break;
      }
      case "set_dimensions": {
        const entry = map[cap.temp_id];
        if (!entry) return;
        entry.isFocus = true;
        Object.assign(entry.dims, cap.scores || {});
        const ev = cap.evidence || {};
        for (const k of Object.keys(ev)) {
          if (!entry.evidence[k]) dimCountRef.current += 1;
          entry.evidence[k] = ev[k];
        }
        if (entry.id) {
          const score = safeScore(entry);
          const { error } = await clientsDb.update(entry.id, {
            profile_scores: entry.dims,
            ...(score != null ? { retention_score: score } : {}),
          });
          if (error) console.error("dimensions update failed:", error);
        }
        break;
      }
      case "add_pause": {
        // v1: extraction only (write signature unverified). Months arrive
        // pause-adjusted from the prompt's parsing law. prev_terminated
        // flag IS a verified jsonb key: set it.
        extractionRef.current.pauses.push(cap);
        const entry = map[cap.temp_id];
        if (entry) {
          entry.flags.prevTerminated = true;
          if (entry.id) {
            const { error } = await clientsDb.update(entry.id, { qualifying_flags: { ...entry.flags } });
            if (error) console.error("pause flag update failed:", error);
          }
        }
        break;
      }
      case "add_routine": {
        const entry = map[cap.temp_id];
        const { error } = await tasksDb.create(user.id, {
          text: cap.text,
          client_id: entry?.id ?? null,
          client_name: entry?.name ?? null,
          is_recurring: true,
          recurrence_pattern: cadenceToPattern(cap.cadence, cap.text),
        });
        if (error) console.error("routine create failed:", error);
        extractionRef.current.notes.push({ temp_id: cap.temp_id, routine_cadence: cap.cadence, text: cap.text });
        break;
      }
      case "add_task": {
        const entry = map[cap.temp_id];
        const { error } = await tasksDb.create(user.id, {
          text: cap.text,
          client_id: entry?.id ?? null,
          client_name: entry?.name ?? null,
        });
        if (error) console.error("task create failed:", error);
        break;
      }
      case "add_referral":
        extractionRef.current.referrals.push(cap);
        break;
      case "seed_confidant":
        extractionRef.current.notes.push({ seed_confidant: cap.temp_id });
        break;
      case "session_meta":
        Object.assign(extractionRef.current.session_meta, cap);
        break;
      default:
        extractionRef.current.notes.push({ unknown_op: cap });
    }
  }

  function safeScore(entry) {
    try {
      if (typeof calcRetentionScore !== "function") return null;
      const s = calcRetentionScore(entry.dims, [], entry.flags, entry.months || 0);
      return Number.isFinite(s) ? Math.round(s) : null;
    } catch (e) {
      console.warn("scoring threw; leaving baseline:", e);
      return null;
    }
  }

  async function finalize() {
    setFinishing(true);
    await persistSession({ status: "completed", completed_at: new Date().toISOString() });
    const { data, error } = await supabase.functions.invoke("rai-intake", {
      body: { action: "finalize", evidence_backed_dimensions: dimCountRef.current },
    });
    if (error || !data?.ok) console.warn("finalize:", error || data);
    setTimeout(() => (onComplete ? onComplete() : window.location.reload()), 1400);
  }

  function send(text) {
    if (!text || busy) return;
    const userMsg = { role: "user", content: text };
    extractionRef.current.transcript.push({ role: "user", text });
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    advance(next);
  }

  const say = turn?.say || "";
  const quicks = Array.isArray(turn?.quick_replies) ? turn.quick_replies : null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#FAF9F6", display: "flex", flexDirection: "column", fontFamily: "inherit" }}>
      <div style={{ padding: "18px 24px", borderBottom: "1px solid #E5E1D8", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 10, height: 10, borderRadius: 999, background: P }} />
        <span style={{ fontWeight: 600, color: INK }}>Rai</span>
        <span style={{ color: "#8A857A", fontSize: 14 }}>setting up your book, about ten minutes</span>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "28px 24px", maxWidth: 720, width: "100%", margin: "0 auto" }}>
        {messages.map((m, i) => {
          const isUser = m.role === "user";
          let text = m.content;
          if (!isUser) { try { text = JSON.parse(m.content).say; } catch (_) { /* raw */ } }
          return (
            <div key={i} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 14 }}>
              <div style={{ maxWidth: "82%", padding: "12px 16px", borderRadius: 14, whiteSpace: "pre-wrap", lineHeight: 1.5, background: isUser ? P : "#FFFFFF", color: isUser ? "#FFF" : INK, border: isUser ? "none" : "1px solid #E5E1D8" }}>
                {text}
              </div>
            </div>
          );
        })}
        {busy && <div style={{ color: "#8A857A", fontSize: 14, padding: "6px 2px" }}>Rai is thinking…</div>}
        {fatalErr && (
          <div style={{ padding: 12 }}>
            <span style={{ color: "#B4552F", marginRight: 10 }}>{fatalErr}</span>
            <button onClick={() => advance(messages)} style={{ border: `1px solid ${P}`, color: P, background: "#FFF", borderRadius: 8, padding: "6px 14px", cursor: "pointer" }}>Retry</button>
          </div>
        )}

        {showConnects && !finishing && (
          <div style={{ display: "flex", gap: 12, margin: "10px 0 18px", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 240, border: "1px solid #E5E1D8", borderRadius: 12, padding: 16, background: "#FFF" }}>
              <div style={{ fontWeight: 600, marginBottom: 6, color: INK }}>Calendar</div>
              <div style={{ fontSize: 14, color: "#57534E", marginBottom: 10 }}>Your real week lands on the board.</div>
              {googleConnected
                ? <div style={{ color: "#3F6B4F", fontWeight: 600 }}>Connected ✓</div>
                : <button onClick={() => connectGoogleCalendar && connectGoogleCalendar()} style={{ background: P, color: "#FFF", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer" }}>Connect Google Calendar</button>}
            </div>
            <div style={{ flex: 1, minWidth: 240, border: `1px solid ${CLAY}`, borderRadius: 12, padding: 16, background: "#FFF" }}>
              <div style={{ fontWeight: 600, marginBottom: 6, color: CLAY }}>Claude</div>
              <div style={{ fontSize: 14, color: "#57534E", marginBottom: 10 }}>Clay tasks hand off with full context. Two steps: copy the address, add it in Claude as a connector.</div>
              <button
                onClick={() => { try { navigator.clipboard.writeText("https://retayned.com/mcp"); } catch (_) { /* still open */ } window.open("https://claude.ai/settings/connectors", "_blank", "noopener"); }}
                style={{ background: CLAY, color: "#FFF", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer" }}
              >Copy address + open Claude</button>
            </div>
          </div>
        )}

        {finishing && <div style={{ color: P, fontWeight: 600, padding: "8px 2px" }}>Setting the board…</div>}
      </div>

      {!finishing && (
        <div style={{ borderTop: "1px solid #E5E1D8", padding: "14px 24px 20px", maxWidth: 720, width: "100%", margin: "0 auto" }}>
          {quicks && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {quicks.map((q, i) => (
                <button key={i} onClick={() => send(q)} disabled={busy} style={{ border: `1px solid ${P}`, color: P, background: "#FFF", borderRadius: 999, padding: "8px 16px", cursor: "pointer", fontSize: 14 }}>{q}</button>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(input.trim()); }}
              placeholder="Type it like you'd say it…"
              disabled={busy}
              style={{ flex: 1, border: "1px solid #D6D1C4", borderRadius: 10, padding: "12px 14px", fontSize: 15, outline: "none", background: "#FFF" }}
            />
            <button onClick={() => send(input.trim())} disabled={busy || !input.trim()} style={{ background: input.trim() ? P : "#C9C4B8", color: "#FFF", border: "none", borderRadius: 10, padding: "0 22px", cursor: input.trim() ? "pointer" : "default", fontWeight: 600 }}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
}
