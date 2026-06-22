// ─── ShellOverlays (June 2026 refactor, Piece D) ───────────────────────
// The dock portal (with the More sheet inside it), the quick-log FAB,
// and the capture sheet — extracted VERBATIM from App.jsx. Serves both
// platforms: the dock is mobile, the FAB + capture sheet also power
// desktop's ⌘K quick log. Contract scanned with the v3 pipeline
// (props, over-inclusion, template interpolations).
import { personalCalendar as personalCalendarDb } from "../lib/db";
import { mobileNavMore, mobileNavPrimary } from "../nav";
import { parseCalendarEntry, parseComposer, detectPastTense } from "../parser";
import { C } from "../theme";
import { Icon } from "./Icon";
import { createPortal } from "react-dom";

export default function ShellOverlays({ app }) {
  const {
    clients,
    dockShrunk,
    goTo,
    hasDot,
    keyboardOpen,
    mobileMoreOpen,
    page,
    quickLogOpen,
    quickLogText,
    setBrainDumpOpen,
    setMobileMoreOpen,
    setPersonalEvents,
    setQuickLogOpen,
    setQuickLogText,
    setQuickLogToast,
    setTpLogged,
    user,
    workersList,
  } = app;
  return (<>
      {(() => {
        const primary = mobileNavPrimary;
        const moreBase = mobileNavMore;
        // REBUILT (June 2026): fixed light bar — 2 tabs, deep-green capture
        // FAB, 1 tab, More. Nothing scrolls, nothing hides under the FAB.
        // Portaled to <body> so no ancestor transform/stacking context can
        // make position:fixed wobble with page scroll (the trap that bit
        // the Brain Dump overlay). The remaining destinations live in the
        // More bottom sheet. To change which page holds the 4th slot,
        // reorder mobileNavPrimary in nav.js — slot = primary[2].
        // SSR/harness guard: portals need a REAL DOM node. The smoke
        // harness shims `document` without element nodes, so check
        // nodeType rather than mere existence.
        if (typeof document === "undefined" || !document.body || document.body.nodeType !== 1) return null;
        const left = primary.slice(0, 2);
        const right = primary.slice(2, 3);
        const sheetItems = [...primary.slice(3), ...moreBase];
        const sheetHasDot = sheetItems.some(n => hasDot(n.id));
        // Floating pill dock (design B): dark sidebar chrome folded into a
        // thumb-sized object. Only the ACTIVE destination gets a labeled
        // pill; everything else is a quiet icon. Muted sage for inactive.
        const MUT = "#7d877f";
        // Icons only — no labels anywhere (Adam, June 2026). Active =
        // white icon + small sage dot beneath. 44px hit targets (HIG).
        const tabBtn = (n) => {
          const dot = hasDot(n.id);
          const active = page === n.id;
          return (
            <button
              key={n.id}
              className={"nav-item-mobile" + (active ? " is-active" : "")}
              onClick={() => { setMobileMoreOpen(false); goTo(n.id); }}
              aria-label={n.label}
              title={n.label}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                minWidth: 44, minHeight: 44,
                background: "transparent",
                border: "none", cursor: "pointer", fontFamily: "inherit",
                borderRadius: 999, padding: 0,
                position: "relative",
              }}
            >
              <Icon name={n.icon} size={19} color={active ? "#fff" : MUT} accent={active ? C.primaryLight : MUT} />
              {active && <div style={{ position: "absolute", bottom: 5, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: 999, background: "#9FE1CB" }} />}
              {dot && <div style={{ position: "absolute", top: 6, right: 8, width: 7, height: 7, borderRadius: "50%", background: C.danger, boxShadow: "0 0 0 2px rgba(30,38,31,0.9)" }} />}
            </button>
          );
        };
        return createPortal(
          <>
            {mobileMoreOpen && (
              <div className="r-mob-bot-dock" style={{ position: "fixed", inset: 0, zIndex: 89 }}>
                <div onClick={() => setMobileMoreOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(20,30,22,0.38)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }} />
                {/* Dark frosted sheet — same material as the dock it rises
                    from. Explicit Manrope (portal — body rule is the net,
                    this is the belt). */}
                <div style={{
                  position: "absolute", left: 0, right: 0, bottom: 0,
                  background: "rgba(30,38,31,0.92)",
                  backdropFilter: "blur(16px) saturate(1.15)",
                  WebkitBackdropFilter: "blur(16px) saturate(1.15)",
                  borderTop: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: "18px 18px 0 0",
                  padding: "12px 16px calc(96px + env(safe-area-inset-bottom, 0px))",
                  boxShadow: "0 -10px 36px rgba(20,30,22,0.30)",
                  fontFamily: "'Manrope', system-ui, sans-serif",
                }}>
                  <div style={{ width: 32, height: 4, borderRadius: 999, background: "rgba(255,255,255,0.22)", margin: "0 auto 12px" }} />
                  <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.45)", letterSpacing: 1, marginBottom: 9 }}>MORE</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                    {sheetItems.map(n => {
                      const dot = hasDot(n.id);
                      const active = page === n.id;
                      return (
                        <button key={n.id} onClick={() => { setMobileMoreOpen(false); goTo(n.id); }} style={{
                          display: "flex", alignItems: "center", gap: 8,
                          background: active ? "rgba(85,139,104,0.30)" : "rgba(255,255,255,0.06)",
                          border: "none", borderRadius: 10,
                          padding: "12px 13px", cursor: "pointer",
                          fontFamily: "'Manrope', system-ui, sans-serif", textAlign: "left",
                        }}>
                          <Icon name={n.icon} size={17} color={active ? "#fff" : "rgba(255,255,255,0.72)"} accent={active ? "#9FE1CB" : "rgba(255,255,255,0.55)"} />
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: active ? "#fff" : "rgba(255,255,255,0.85)" }}>{n.label}</span>
                          {dot && <span style={{ marginLeft: "auto", width: 7, height: 7, borderRadius: "50%", background: C.danger }} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            <div
              className="r-mob-bot-dock"
              style={{
                position: "fixed",
                left: 12, right: 12,
                bottom: "calc(10px + env(safe-area-inset-bottom, 0px))",
                background: "rgba(30,38,31,0.92)",
                backdropFilter: "blur(12px) saturate(1.15)",
                WebkitBackdropFilter: "blur(12px) saturate(1.15)",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 999,
                boxShadow: "0 12px 32px rgba(20,30,22,0.30)",
                padding: "5px 10px",
                zIndex: 90,
                display: keyboardOpen ? "none" : "flex",
                alignItems: "center",
                justifyContent: "space-around",
                gap: 2,
                transform: dockShrunk ? "scale(0.86)" : "none",
                opacity: dockShrunk ? 0.92 : 1,
                transformOrigin: "center bottom",
                transition: "transform 240ms var(--rt-ease-out), opacity 240ms var(--rt-ease-out)",
              }}
            >
              {left.map(tabBtn)}
              {/* The green + is THE action of the bar — same hero status as
                  the desktop FAB. Slightly raised, glow ring, never muted. */}
              <button
                onClick={() => { setMobileMoreOpen(false); setQuickLogOpen(v => !v); }}
                aria-label="Quick capture"
                className="rt-mob-fab"
                style={{
                  width: 50, height: 50, borderRadius: "50%", border: "none",
                  background: C.primaryLight,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", padding: 0, flexShrink: 0,
                  marginTop: -16,
                  boxShadow: "0 6px 18px rgba(85,139,104,0.50), 0 0 0 4px rgba(85,139,104,0.16)",
                  transform: quickLogOpen ? "rotate(45deg)" : "none",
                  transition: "transform 180ms ease-out",
                }}
              >
                <svg width="22" height="22" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path d="M9 3.5V14.5M3.5 9H14.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </button>
              {right.map(tabBtn)}
              {(() => {
                const moreActive = mobileMoreOpen || sheetItems.some(n => n.id === page);
                const moreColor = moreActive ? "#fff" : "#7d877f";
                return (
                  <button
                    onClick={() => setMobileMoreOpen(v => !v)}
                    className={"nav-item-mobile" + (moreActive ? " is-active" : "")}
                    aria-label="More pages"
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      minWidth: 44, minHeight: 44,
                      background: "transparent",
                      border: "none", cursor: "pointer", fontFamily: "inherit",
                      borderRadius: 999, padding: 0,
                      position: "relative",
                    }}
                  >
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="5" cy="12" r="1.9" fill={moreColor} />
                      <circle cx="12" cy="12" r="1.9" fill={moreColor} />
                      <circle cx="19" cy="12" r="1.9" fill={moreColor} />
                    </svg>
                    {moreActive && <div style={{ position: "absolute", bottom: 5, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: 999, background: "#9FE1CB" }} />}
                    {sheetHasDot && !mobileMoreOpen && <div style={{ position: "absolute", top: 6, right: 8, width: 7, height: 7, borderRadius: "50%", background: C.danger, boxShadow: "0 0 0 2px rgba(30,38,31,0.9)" }} />}
                  </button>
                );
              })()}
            </div>
          </>,
          document.body
        );
      })()}

      {/* ─── QUICKLOG — desktop power-user FAB (all pages) ──────────────
          Floating purple "+" quick-capture, bottom-right, on every page.
          DESKTOP ONLY — hidden on mobile via .rt-quicklog-fab CSS. A
          notes-style scratchpad: free-form text → personal task, due today. */}
      <button
        onClick={() => setQuickLogOpen(v => !v)}
        aria-label="Quick log"
        title="Quick log (⌘K)"
        className="rt-quicklog-fab"
        style={{
          position: "fixed",
          right: 24,
          border: "none",
          background: "var(--rt-grad-btn)",
          color: "#fff",
          fontWeight: 300,
          lineHeight: 1,
          cursor: "pointer",
          boxShadow: "var(--rt-sh-purple)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: quickLogOpen ? "rotate(45deg)" : "rotate(0)",
          transition: "transform 180ms var(--rt-ease-out), box-shadow 220ms var(--rt-ease-out)",
          zIndex: 200,
          fontFamily: "inherit",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "var(--rt-sh-purple-hover)"; e.currentTarget.style.background = "var(--rt-grad-btn-hover)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "var(--rt-sh-purple)"; e.currentTarget.style.background = "var(--rt-grad-btn)"; }}
      >+</button>

      {quickLogOpen && (
        <>
          {/* Click-outside catcher */}
          <div
            className="rt-quicklog-backdrop"
            onClick={() => { setQuickLogOpen(false); setQuickLogText(""); }}
            style={{ position: "fixed", inset: 0, background: "rgba(20,30,22,0.18)", zIndex: 199 }}
          />
          <div className="rt-quicklog-popover" style={{
            position: "fixed",
            right: 24,
            width: 340,
            maxWidth: "calc(100vw - 40px)",
            background: C.card,
            borderRadius: 14,
            boxShadow: "0 12px 36px rgba(20,30,22,0.20), 0 4px 10px rgba(20,30,22,0.08)",
            border: "0.5px solid " + C.borderLight,
            padding: 14,
            zIndex: 200,
          }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 10, color: C.textMuted, letterSpacing: 0.5, fontWeight: 600 }}>CAPTURE</span>
              <span style={{ flex: 1 }} />
              {/* Brain Dump — long-form capture lives one tap away. */}
              <button
                onClick={() => { setQuickLogOpen(false); setQuickLogText(""); setBrainDumpOpen(true); }}
                title="Brain Dump — paste your call notes, Rai sorts them into tasks"
                aria-label="Brain Dump"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 13, background: "rgba(124,92,243,0.10)", border: "none", cursor: "pointer", padding: 0 }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 4.3c1-1.1 2.7-1.4 4-.7 1.2.6 2 1.8 2.1 3.1 1 .5 1.9 1.6 1.9 2.9 0 .8-.3 1.5-.8 2.1.4.6.6 1.3.5 2-.2 1.5-1.3 2.7-2.8 3-.6 1.2-1.9 2-3.3 2-.6 0-1.1-.1-1.6-.4-.5.3-1 .4-1.6.4-1.4 0-2.7-.8-3.3-2-1.5-.3-2.6-1.5-2.8-3-.1-.7.1-1.4.5-2-.5-.6-.8-1.3-.8-2.1 0-1.3.9-2.4 1.9-2.9.1-1.3.9-2.5 2.1-3.1 1.3-.7 3-.4 4 .7Z" fill="#7c5cf3" />
                  <path d="M12 4.6v13.8" stroke="#fff" strokeWidth="1.5" />
                  <path d="M9.3 8c-1.1.2-1.9 1-2 2.1M9.6 12.4c-1.3.1-2.2.9-2.4 2M14.7 8c1.1.2 1.9 1 2 2.1M14.4 12.4c1.3.1 2.2.9 2.4 2" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" fill="none" />
                </svg>
              </button>
            </div>
            <textarea
              autoFocus
              value={quickLogText}
              onChange={e => setQuickLogText(e.target.value)}
              onKeyDown={async e => {
                if (e.key === "Escape") {
                  setQuickLogOpen(false); setQuickLogText("");
                  return;
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  const rawText = quickLogText.trim();
                  if (!rawText) return;
                  // Close popover immediately for snappy UX.
                  setQuickLogOpen(false);
                  setQuickLogText("");

                  // ─── Parse the input via the same parser the task composer
                  // uses. Reuses client matching (exact / token / abbrev /
                  // prefix-typo) and date hints — single source of truth for
                  // "how do we interpret typed input."
                  const parsed = parseComposer(rawText, clients, workersList);
                  const matchedClient = parsed.matchedClient || null;
                  const cleanedText = parsed.title || rawText;

                  // ─── ROUTE 0: CALENDAR EVENT. If the entry contains a time
                  // ("3pm", "9-10am", "noon"), it's a scheduled event, not a
                  // task or touchpoint. parseCalendarEntry returns null when no
                  // time is present, so a non-null result IS the event signal.
                  // Strip the matched client name first so a numeric client
                  // name (e.g. client "1620") can't be misread as a time.
                  let calTextQL = rawText;
                  if (matchedClient?.name) {
                    calTextQL = calTextQL.replace(new RegExp(matchedClient.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " ").replace(/\s+/g, " ").trim();
                  }
                  const calEntry = parseCalendarEntry(calTextQL, new Date(), clients);
                  if (calEntry) {
                    const optimisticId = "qlev" + Date.now();
                    try {
                      const { data: created } = await personalCalendarDb.create(user.id, calEntry);
                      const evId = created?.id || optimisticId;
                      setPersonalEvents(prev => [{ ...calEntry, id: evId, source: "manual" }, ...(prev || [])]);
                      setQuickLogToast({ id: Date.now(), kind: "event", recordId: evId, label: calEntry.client_name || calEntry.title });
                    } catch (err) {
                      setQuickLogToast({ id: Date.now(), error: true });
                    }
                    return;
                  }

                  // ─── Intent detection — same routing as the main composer.
                  // RULE (Option 3): past tense → TOUCHPOINT (it already
                  // happened), UNLESS a future date is present (then it's a
                  // scheduled TASK). Past tense is detected GENERALLY via
                  // detectPastTense (sent, told, wrote, finished, -ed verbs,
                  // "reached out"…), not a finite verb allowlist — that
                  // allowlist is what let "sent terrika a report" fall through
                  // to TASK. Comm-noun phrasing ("call with X") still counts.
                  // A touchpoint requires a matched client; without one it
                  // falls through to TASK regardless of tense.
                  const lower = rawText.toLowerCase();
                  const isCommNoun = /\bcall with\b|\bmet with\b|\bmeeting with\b|\bspoke (?:to|with)\b|\bcaught up with\b|\bcall w\/|\blunch with\b|\bcoffee with\b/i.test(lower);
                  // Run tense detection on the client-stripped title so a client
                  // or worker name ending in -ed can't trip the regular-verb rule.
                  const isPastTouch = detectPastTense(cleanedText) || detectPastTense(rawText && cleanedText !== rawText ? cleanedText : rawText);
                  // Future-date guard (Option 3): a future due date signals a
                  // SCHEDULED action, not a completed one — overrides past tense.
                  const _md = parsed.matchedDate && parsed.matchedDate.date;
                  const _todayY = userTimezone ? ymdInTz(userTimezone, new Date()) : localYmd(new Date());
                  const hasFutureDate = _md instanceof Date && !isNaN(_md) &&
                    (userTimezone ? ymdInTz(userTimezone, _md) : localYmd(_md)) > _todayY;
                  const isTouch = (isCommNoun || isPastTouch) && !hasFutureDate;
                  const isTask = !isTouch;

                  // Channel detection (for nice touchpoint display) — derived
                  // from the words present regardless of routing.
                  let detectedChannel = "note";
                  if (/\bcall|\bspoke|got off|\bchat|\brang|phone/i.test(lower)) detectedChannel = "call";
                  else if (/\bemail/i.test(lower)) detectedChannel = "email";
                  else if (/\btext|\bmessage|\bdm\b|pinged/i.test(lower)) detectedChannel = "text";
                  else if (/\bmet\b|\bmeeting|\blunch|\bcoffee|caught up|\bsync\b|\bdemo\b/i.test(lower)) detectedChannel = "meeting";

                  // ─── ROUTE A: TOUCHPOINT (the default — anything not flagged
                  // as a task). Requires a matched client; a touchpoint can't
                  // exist without one, so a no-client entry falls through to a
                  // task even under the touchpoint-default model.
                  if (!isTask && matchedClient) {
                    const optimisticId = "qltp" + Date.now();
                    setTpLogged(prev => [
                      { id: optimisticId, client: matchedClient.name, channel: detectedChannel },
                      ...prev,
                    ]);
                    try {
                      const { data: created } = await touchpointsDb.create(user.id, {
                        client_id: matchedClient.id,
                        client_name: matchedClient.name,
                        channel: detectedChannel,
                        // Use the raw text for the note — a touchpoint should
                        // read naturally and keep the client's name in it
                        // ("Call with David for melio payments"). cleanedText
                        // is the task-title strip, which removes the client
                        // span and leaves mangled fragments like "Call .".
                        notes: rawText,
                      });
                      if (created?.id) {
                        setTpLogged(prev => prev.map(t => t.id === optimisticId ? { ...t, id: created.id } : t));
                        setQuickLogToast({ id: Date.now(), kind: "touchpoint", recordId: created.id, label: matchedClient.name, relog: { text: rawText, cleanedText, clientId: matchedClient.id, clientName: matchedClient.name, channel: detectedChannel } });
                      } else {
                        setQuickLogToast({ id: Date.now(), kind: "touchpoint", recordId: optimisticId, label: matchedClient.name, relog: { text: rawText, cleanedText, clientId: matchedClient.id, clientName: matchedClient.name, channel: detectedChannel } });
                      }
                    } catch (err) {
                      setTpLogged(prev => prev.filter(t => t.id !== optimisticId));
                      setQuickLogToast({ id: Date.now(), error: true });
                    }
                    return;
                  }

                  // ─── ROUTE B: TASK (explicit future/imperative, OR no client
                  // matched so a touchpoint isn't possible).
                  // Use the user's stored timezone for the due_date string so
                  // it matches what the rest of the app's bucketing logic uses
                  // (otherwise the task could land in a different bucket near
                  // midnight if browser TZ differs from profile TZ).
                  const ymdLocal = (d) => userTimezone ? ymdInTz(userTimezone, d) : localYmd(d);
                  const dueDateForCreate = parsed.matchedDate
                    ? ymdLocal(parsed.matchedDate.date)
                    : ymdLocal(new Date());
                  const optimisticId = "ql" + Date.now();
                  const longSplit = splitLongTask(cleanedText);
                  const optimisticTask = {
                    id: optimisticId,
                    text: longSplit.text,
                    notes: longSplit.notes,
                    client: matchedClient?.name || null,
                    client_id: matchedClient?.id || null,
                    done: false,
                    ai: false,
                    recurring: false,
                    recurrence_pattern: null,
                    due_date: dueDateForCreate,
                    raiPriority: false,
                    alert: false,
                    created_at: Date.now(),
                    assigned_worker_id: null,
                  };
                  setTasks(prev => [optimisticTask, ...prev]);
                  try {
                    const { data: created } = await tasksDb.create(user.id, {
                      text: longSplit.text,
                      notes: longSplit.notes,
                      client_name: matchedClient?.name || null,
                      client_id: matchedClient?.id || null,
                      is_recurring: false,
                      recurrence_pattern: null,
                      due_date: dueDateForCreate,
                      assigned_worker_id: null,
                    });
                    // Build a short due-date hint for the toast so the user
                    // sees where the task landed (today / tomorrow / specific
                    // date). Without this, a "tomorrow" task vanishes from
                    // the Today bucket and feels lost. Uses same tz-aware
                    // helper as the due_date itself.
                    const _now = new Date();
                    const todayStr = ymdLocal(_now);
                    const tomorrowStr = ymdLocal(new Date(_now.getTime() + 86400000));
                    let dueHint = "";
                    if (dueDateForCreate === todayStr) dueHint = "today";
                    else if (dueDateForCreate === tomorrowStr) dueHint = "tomorrow";
                    else if (dueDateForCreate) {
                      const d = new Date(dueDateForCreate + "T00:00:00");
                      dueHint = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    }
                    const toastLabel = (matchedClient?.name || "personal task") + (dueHint ? " · " + dueHint : "");
                    const relog = matchedClient ? { text: rawText, cleanedText, clientId: matchedClient.id, clientName: matchedClient.name, channel: detectedChannel, dueDate: dueDateForCreate } : null;
                    if (created?.id) {
                      setTasks(prev => prev.map(t => t.id === optimisticId ? { ...t, id: created.id } : t));
                      setQuickLogToast({ id: Date.now(), kind: "task", recordId: created.id, label: toastLabel, relog });
                    } else {
                      setQuickLogToast({ id: Date.now(), kind: "task", recordId: optimisticId, label: toastLabel, relog });
                    }
                  } catch (err) {
                    setTasks(prev => prev.filter(t => t.id !== optimisticId));
                    setQuickLogToast({ id: Date.now(), error: true });
                  }
                }
              }}
              placeholder="Add a task, log activity, or schedule an event. Natural language = magic."
              rows={3}
              style={{ width: "100%", padding: "8px 0", border: "none", fontSize: 14, fontFamily: "inherit", background: "transparent", outline: "none", resize: "none", lineHeight: 1.5, color: C.text, minHeight: 60, boxSizing: "border-box" }}
            />
            {/* Live ghost-parse readout — composer parity. Same parser the
                submit handler uses, run per keystroke for the preview. */}
            {(() => {
              const raw = quickLogText.trim();
              if (raw.length < 3) return null;
              let p = null;
              try { p = parseComposer(raw, clients, workersList); } catch (_) { return null; }
              const lower = raw.toLowerCase();
              const isCommNoun = /\bcall with\b|\bmet with\b|\bmeeting with\b|\bspoke (?:to|with)\b|\bcaught up with\b|\bcall w\/|\blunch with\b|\bcoffee with\b/i.test(lower);
              const _cleaned = (p && p.title) || raw;
              const isPastTouch = detectPastTense(_cleaned);
              let cal = null;
              try { cal = parseCalendarEntry(raw, new Date(), clients); } catch (_) { /* no time token */ }
              // Future-date guard (Option 3): a future due date keeps it a task.
              const _mdR = p && p.matchedDate && p.matchedDate.date;
              const _todayYR = userTimezone ? ymdInTz(userTimezone, new Date()) : localYmd(new Date());
              const _hasFutureDate = _mdR instanceof Date && !isNaN(_mdR) &&
                (userTimezone ? ymdInTz(userTimezone, _mdR) : localYmd(_mdR)) > _todayYR;
              const route = (cal && cal.starts_at)
                ? "event"
                : ((isCommNoun || isPastTouch) && !_hasFutureDate && p.matchedClient?.name)
                  ? "touchpoint"
                  : "task";
              let dueLabel = null;
              const md = p.matchedDate && p.matchedDate.date;
              if (md instanceof Date && !isNaN(md)) {
                try { dueLabel = md.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); } catch (_) { /* noop */ }
              }
              const chips = [];
              if (p.matchedClient?.name) chips.push({ k: "client", label: p.matchedClient.name, strong: true });
              if (p.matchedWorker?.name) chips.push({ k: "worker", label: p.matchedWorker.name });
              if (dueLabel) chips.push({ k: "date", label: dueLabel });
              if (p.matchedRecurrence) chips.push({ k: "rec", label: "∞ repeats" });
              chips.push({ k: "type", label: route === "event" ? "Event" : route === "touchpoint" ? "Touchpoint" : "Task" });
              return (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10.5, color: C.textMuted, marginBottom: 6, lineHeight: 1.5 }}>
                    <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontStyle: "italic" }}>Becomes</span>
                    {" → "}{route === "event" ? "a calendar event" : route === "touchpoint" ? "a logged touchpoint" : "a task"}
                    {p.matchedClient?.name ? <> for <b style={{ color: C.primary, fontWeight: 600 }}>{p.matchedClient.name}</b></> : null}
                    {dueLabel && route !== "touchpoint" ? <>, <b style={{ color: C.primary, fontWeight: 600 }}>{dueLabel}</b></> : null}
                  </div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {chips.map(c => (
                      <span key={c.k} style={{
                        display: "inline-flex", alignItems: "center",
                        fontSize: 10, fontWeight: 600, borderRadius: 7, padding: "3px 8px",
                        background: c.k === "type" ? C.primarySoft : C.surface,
                        color: c.k === "type" ? C.primary : (c.strong ? C.text : C.textSec),
                      }}>{c.label}</span>
                    ))}
                  </div>
                </div>
              );
            })()}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, paddingTop: 10, borderTop: "0.5px solid " + C.borderLight }}>
              <span style={{ fontSize: 11, color: C.textMuted }}>Past tense → touchpoint · future → task</span>
              <span style={{ fontSize: 11, color: C.textMuted }}>⏎ to log · Esc</span>
            </div>
          </div>
        </>
      )}


  </>);
}
