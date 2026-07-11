// ─── ShellOverlays (June 2026 refactor, Piece D) ───────────────────────
// The dock portal (with the More sheet inside it), the quick-log FAB,
// and the capture sheet — extracted VERBATIM from App.jsx. Serves both
// platforms: the dock is mobile, the FAB + capture sheet also power
// desktop's ⌘K quick log. Contract scanned with the v3 pipeline
// (props, over-inclusion, template interpolations).
import { clientHours as clientHoursDb, personalCalendar as personalCalendarDb, tasks as tasksDb, touchpoints as touchpointsDb } from "../lib/db";
import { Fragment } from "react";
import { mobileNavStrip } from "../nav";
import { can } from "../hooks/useOrg";
import { parseCalendarEntry, parseComposer, detectPastTense } from "../parser";
import { ymdInTz, localYmd, splitLongTask } from "../utils";
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
    orgRole,
    page,
    quickLogOpen,
    quickLogText,
    selectedClient,
    selectedRolodex,
    setBrainDumpOpen,
    setPersonalEvents,
    setQuickLogOpen,
    setQuickLogText,
    setQuickLogToast,
    setTasks,
    setTpLogged,
    user,
    userTimezone,
    workersList,
  } = app;

  // AGENCY: destinations an AM can't open are hidden from the strip
  // (pages are can()-gated at render — a visible item would be a dead tap).
  const NAV_PERMS = { workers: "manage_workers", retros: "view_rolodex", referrals: "view_referrals" };
  const navStrip = mobileNavStrip.filter(item => !NAV_PERMS[item.id] || can(NAV_PERMS[item.id], orgRole));

  // The dock keeps the user's horizontal scroll position on page change —
  // tapping a visible tab navigates without repositioning the strip. (The
  // old auto-scroll that centered the active tab was removed: it yanked the
  // selection to mid-screen instead of leaving it where the user tapped.)
  return (<>
      {(() => {
        // ═══ SCROLLABLE STRIP DOCK (June 2026; Jul 2026: FAB moved out) ═══
        // All destinations live on ONE horizontally-scrollable track sized
        // 4.5 items per screen — the half-visible fifth IS the scroll
        // affordance. The capture "+" used to be pinned dead-center, eating
        // the middle of the bar (only ~2 items showed per side); it now
        // floats as a 52px circle bottom-right in the thumb arc, hiding with
        // the keyboard and on the Rai page (the composer owns that corner).
        // Edge fades dissolve overflow. Portaled to <body> so no ancestor
        // transform breaks position:fixed (the trap that bit Brain Dump).
        if (typeof document === "undefined" || !document.body || document.body.nodeType !== 1) return null;

        const dotFor = (id) => hasDot(id);

        return createPortal(
          <div
            className="rt-dock-wrap"
            style={{
              position: "fixed", left: 0, right: 0,
              bottom: keyboardOpen ? -120 : "calc(env(safe-area-inset-bottom, 0px) + 10px)",
              zIndex: 500, display: "flex", justifyContent: "center",
              padding: "0 12px", pointerEvents: "none",
              transition: "bottom 240ms var(--rt-ease-out), transform 220ms var(--rt-ease-out)",
              // Scroll-shrink: when scrolling DOWN the dock scales down (and eases
              // toward the bottom) but stays visible — the original design. Not a
              // hide. Scrolling up / near top restores full size.
              transform: dockShrunk ? "scale(0.86) translateY(6px)" : "scale(1) translateY(0)",
              transformOrigin: "center bottom",
            }}
          >
            <div style={{ position: "relative", width: "100%", maxWidth: 480, height: 64, pointerEvents: "auto" }}>
              {/* Frosted-glass bar. ALL destinations on ONE horizontally-
                  scrolling strip; the "+" FAB is pinned dead-center on its own
                  layer and items scroll BEHIND it (fades dissolve them at the
                  center + edges). No avatar, no menu. */}
              <div
                className="rt-dock-strip"
                style={{
                  position: "absolute", inset: 0,
                  background: "rgba(255,255,255,0.72)",
                  backdropFilter: "blur(16px) saturate(1.4)",
                  WebkitBackdropFilter: "blur(16px) saturate(1.4)",
                  border: "1px solid rgba(255,255,255,0.6)",
                  borderRadius: 22,
                  boxShadow: "0 8px 28px rgba(20,30,22,0.14), 0 1px 0 rgba(255,255,255,0.5) inset",
                  overflowX: "auto", overflowY: "hidden",
                  display: "flex", alignItems: "center",
                  WebkitOverflowScrolling: "touch", scrollbarWidth: "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 0, padding: "0 8px", height: "100%", minWidth: "max-content" }}>
                  {navStrip.map((item) => {
                    const active = page === item.id;
                    return (
                      <Fragment key={item.id}>
                        <button
                          onClick={() => goTo(item.id)}
                          className="rt-dock-item"
                          style={{
                            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                            gap: 3, width: "calc((min(100vw, 504px) - 40px) / 4.5)", minWidth: 0, flexShrink: 0, height: 46, padding: 0,
                            border: "none", cursor: "pointer", fontFamily: "inherit", borderRadius: 13,
                            background: active ? "rgba(51,84,62,0.10)" : "transparent",
                            color: active ? C.primary : "#8A9188",
                            position: "relative",
                          }}
                        >
                          <span style={{ position: "relative", display: "flex" }}>
                            <Icon name={item.icon} size={18} color="currentColor" />
                            {dotFor(item.id) && (
                              <span style={{ position: "absolute", top: -2, right: -3, width: 7, height: 7, borderRadius: "50%", background: "#C0654A", border: "1.5px solid #FFFFFF" }} />
                            )}
                          </span>
                          <span style={{ fontSize: 9.5, fontWeight: active ? 600 : 500, letterSpacing: "0.01em" }}>{item.label}</span>
                        </button>
                      </Fragment>
                    );
                  })}
                </div>
              </div>

              <div style={{ position: "absolute", top: 1, bottom: 1, left: 1, width: 20, borderRadius: "22px 0 0 22px", background: "linear-gradient(90deg, rgba(255,255,255,0.72) 30%, rgba(255,255,255,0))", pointerEvents: "none", zIndex: 1 }} />
              <div style={{ position: "absolute", top: 1, bottom: 1, right: 1, width: 20, borderRadius: "0 22px 22px 0", background: "linear-gradient(270deg, rgba(255,255,255,0.72) 30%, rgba(255,255,255,0))", pointerEvents: "none", zIndex: 1 }} />
            </div>
          </div>,
          document.body
        );
      })()}

      {(() => {
        // ═══ CAPTURE FAB — 52px circle in the right-thumb arc ═══
        // Its OWN viewport-fixed portal, a sibling of the dock wrap — NOT a
        // child. The dock strip scales down on scroll (transform on the wrap);
        // pinning the FAB outside that subtree keeps it a constant 52px while
        // the bar packs smaller. Anchored to the screen edge with the same
        // effective offset it had inside the wrap (wrap bottom = safe-area +
        // 10px, FAB sat 76px above that ≈ safe-area + 86px), so it lands in the
        // identical spot. Hides with the keyboard and on the Rai page, where
        // the chat composer owns the bottom-right.
        if (typeof document === "undefined" || !document.body || document.body.nodeType !== 1) return null;
        return createPortal(
          <button
            onClick={() => setQuickLogOpen(true)}
            aria-label="Quick capture"
            className="rt-dock-fab"
            style={{
              position: "fixed",
              right: "calc(env(safe-area-inset-right, 0px) + 16px)",
              bottom: "calc(env(safe-area-inset-bottom, 0px) + 86px)",
              width: 52, height: 52, borderRadius: "50%", border: "none",
              background: C.primary, color: "#fff", cursor: "pointer",
              display: (keyboardOpen || page === "rai") ? "none" : "flex",
              alignItems: "center", justifyContent: "center",
              boxShadow: "0 6px 18px rgba(51,84,62,0.35), 0 2px 6px rgba(28,50,36,0.18)",
              zIndex: 501,
              transition: "bottom 240ms var(--rt-ease-out), opacity 200ms var(--rt-ease-out)",
            }}
          >
            <Icon name="plus" size={24} color="currentColor" />
          </button>,
          document.body
        );
      })()}

      {/* ─── QUICKLOG — desktop power-user FAB (all pages) ──────────────
          Floating purple "+" quick-capture, bottom-right, on every page.
          DESKTOP ONLY — hidden on mobile via .rt-quicklog-fab CSS. A
          notes-style scratchpad: free-form text → personal task, due today. */}
      {/* Hidden while a client/rolodex modal is open (Jul 2026): the FAB
          sat on top of the modal's edit controls on desktop. Mobile is
          unaffected — this element is desktop-only via CSS, and the mobile
          dock FAB is a separate element below. */}
      {!(selectedClient || selectedRolodex) && (
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
      )}

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

                  // ─── ROUTE −1: BILLABLE HOURS (Jul 2026). A LEADING duration
                  // ("2h Lemon Law — demand letters", "45m Acme") + a matched
                  // client logs billable hours into the client's Billing tab.
                  // Client required: unpriced, unattached hours have no home,
                  // so no client match → falls through to the task route.
                  // Deliberately anchored (^) — "call Acme in 2h" stays a task.
                  const hrsMatch = rawText.match(/^\s*(\d+(?:\.\d+)?)\s*h(?:rs?|ours?)?\b/i);
                  const minMatch = hrsMatch ? null : rawText.match(/^\s*(\d+)\s*m(?:in(?:ute)?s?)?\b/i);
                  if ((hrsMatch || minMatch) && matchedClient) {
                    const h = hrsMatch
                      ? Math.min(24, parseFloat(hrsMatch[1]))
                      : Math.min(24, Math.round((parseInt(minMatch[1], 10) / 60) * 100) / 100);
                    if (h > 0) {
                      // Note = cleaned text minus the duration token and any
                      // leading separators left behind ("— demand letters").
                      const durToken = (hrsMatch || minMatch)[0];
                      const note = cleanedText.replace(durToken, "").replace(/^[\s\-–—·,:]+/, "").trim();
                      const ownerId = matchedClient.user_id || user.id;
                      try {
                        const { error } = await clientHoursDb.create(ownerId, user.id, matchedClient.id, h, note, localYmd(new Date()));
                        if (error) throw error;
                        setQuickLogToast({ id: Date.now(), kind: "hours", label: `${h}h · ${matchedClient.name}` });
                      } catch (err) {
                        console.warn("Quick-log hours failed:", err);
                        setQuickLogToast({ id: Date.now(), error: true, message: "Couldn't log hours — try again" });
                      }
                      return;
                    }
                  }

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
