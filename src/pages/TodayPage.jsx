// AUTO-EXTRACTED from App.jsx (page === "today" block) — body is
// verbatim; only the surrounding component shell + imports are generated.
import { personalCalendar as personalCalendarDb, tasks as tasksDb, touchpoints as touchpointsDb } from "../lib/db";
import { Icon } from "../components/Icon";
import { MobileCalendarStrip } from "../components/MobileCalendarStrip";
import { BucketCalToggle, BucketCalendarLater, BucketCalendarTomorrow } from "../components/TaskBuckets";
import { TimeDial } from "../components/TimeDial";
import BrainDump from "../components/BrainDump";
import { supabase } from "../lib/supabase.js";
import { parseCalendarEntry, parseComposer } from "../parser";
import { Fragment, useState } from "react";
import { dateToYmd, formatRecurrenceLabel, nextOccurrenceDate } from "../recurrence";
import { C } from "../theme";
import { detectThinkingVerb, getUserInitial, getWorkerInitials, retColor, retGradient, ymdInTz } from "../utils";
 
export default function TodayPage({ app }) {
  const {
    allTouchpoints,
    beginTaskEdit,
    calcNewClientBoost,
    calcProfileScore,
    calcProfileScoreRaw,
    calendarMonth,
    cancelTaskEdit,
    clients,
    collapsedDoneIds,
    commitTaskEdit,
    completedLogOpen,
    composerGhost,
    composerHighlight,
    composerInPause,
    composerPauseTimerRef,
    composerTypeOverride,
    connectGoogleCalendar,
    dataLoaded,
    debugScores,
    dialDayView,
    dialScrubMs,
    dismissGoogleConnectPrompt,
    dragOverTaskId,
    draggingTaskId,
    dueChipRef,
    duePickerOpen,
    duePickerPos,
    dueShowCalendar,
    editingTaskId,
    editingTaskText,
    exitingDoneIds,
    focusMode,
    getAdjustedLTV,
    getProfileSortScore,
    getRaiBoost,
    googleConnectPromptDismissed,
    googleConnected,
    isMobile,
    justCompletedIds,
    justPromoted,
    laterCalOpen,
    longPressTimerRef,
    manualTaskOrder,
    newTask,
    newTaskDueDate,
    newTaskRecurrencePattern,
    newTaskRecurring,
    newTaskWorkerId,
    openDismissFlow,
    parserSetDueDateRef,
    parserSetRecurrenceRef,
    pendingAutoSendRef,
    pendingAutoTitleRef,
    personalEvents,
    pulseChip,
    purgeTaskHistory,
    raiPicks,
    raiState,
    rankMode,
    rowDuePickerId,
    setAiConvoId,
    setAiMessages,
    setAiTasks,
    setCalendarMonth,
    setClientTab,
    setCompletedLogOpen,
    setComposerGhost,
    setComposerHighlight,
    setComposerInPause,
    setComposerTypeOverride,
    setDialDayView,
    setDialScrubMs,
    setDragOverTaskId,
    setDraggingTaskId,
    setDuePickerOpen,
    setDueShowCalendar,
    setEditingTaskText,
    setFocusMode,
    setFocusedTaskId,
    setLaterCalOpen,
    setLinkPicker,
    setLinkPickerSearch,
    setManualTaskOrder,
    setNewTask,
    setNewTaskDueDate,
    setNewTaskRecurrencePattern,
    setNewTaskRecurring,
    setNewTaskWorkerId,
    setPage,
    setPersonalEvents,
    setQuickLogOpen,
    setQuickLogText,
    setQuickLogToast,
    setRankMode,
    setRowDuePickerActions,
    setRowDuePickerId,
    setRowDuePickerRect,
    setSelectedClient,
    setSwipeLock,
    setSwipeOffset,
    setSwipeStartX,
    setSwipeStartY,
    setTasks,
    setTodayCompletedOpen,
    setTodayComposerClient,
    setTodayComposerDue,
    setTodayComposerMenu,
    setTodayComposerQuery,
    setTodayDismissed,
    setTodayFocusId,
    setTodayModeMenuOpen,
    setTodayStripOpen,
    setTomorrowCalOpen,
    setTpLogged,
    setTypePickerOpen,
    setWorkerPickerOpen,
    swipeLock,
    swipeOffset,
    swipeStartX,
    swipeStartY,
    tasks,
    todayCompletedOpen,
    todayComposerClient,
    todayComposerDue,
    todayComposerMenu,
    todayComposerQuery,
    todayDismissed,
    todayFocusId,
    todayModeMenuOpen,
    todayStripOpen,
    toggleTask,
    tomorrowCalOpen,
    topTaskIdRef,
    triggerChipPulse,
    typePickerOpen,
    user,
    userTimezone,
    workerPickerOpen,
    workersList,
  } = app;

  // ── Brain Dump + task-notes local UI state (page-local, not app state) ──
  const [brainDumpOpen, setBrainDumpOpen] = useState(false);
  const [openNoteId, setOpenNoteId] = useState(null);
  const [editingNoteId, setEditingNoteId] = useState(null);

          // ─── LOCAL ALIASES ───────────────────────────────────────────────
          const focusId = todayFocusId, setFocusId = setTodayFocusId;
          const dismissedIds = todayDismissed, setDismissedIds = setTodayDismissed;
          const composerDue = todayComposerDue, setComposerDue = setTodayComposerDue;
          const composerClient = todayComposerClient, setComposerClient = setTodayComposerClient;
          const composerMenuOpen = todayComposerMenu, setComposerMenuOpen = setTodayComposerMenu;
          const composerQuery = todayComposerQuery, setComposerQuery = setTodayComposerQuery;
          const completedOpen = todayCompletedOpen, setCompletedOpen = setTodayCompletedOpen;

          // ─── DATA PREP ───────────────────────────────────────────────────
          // Visible tasks = non-dismissed (locally). Dismissed = user used the
          // dismiss affordance during this session.
          // Also hide tasks whose client is currently PAUSED — pausing a client
          // suspends all their tasks (recurring return on resume; one-off tasks
          // will typically expire). And hide tasks orphaned by a removed client.
          const pausedClientIds = new Set((clients || []).filter(c => c && c.is_paused).map(c => c.id));
          // "Live" = a client that still exists AND isn't archived (moved to
          // Rolodex). Archived clients keep a row in the array (filtered per-view
          // elsewhere) but their tasks should be treated as orphaned and hidden.
          const liveClientIds = new Set((clients || []).filter(c => c && c.id && !c.archived_at).map(c => c.id));
          // +Tasks opt-out: when the user has Rai's task suggestions turned OFF
          // (either "✦ Ranked" with ai_tasks off, or "Manual"), Rai-added tasks
          // (t.ai) are hidden COMPLETELY — not just no-new-ones. Opting out means
          // never seeing a Rai task or its purple dot, regardless of whether the
          // user previously engaged with it, moved it to tomorrow, etc.
          const aiTasksVisible = rankMode === "rai" && raiState?.ai_tasks_enabled !== false;
          const visibleTasks = tasks.filter(t =>
            !dismissedIds[t.id]
            // Hide ALL Rai-added tasks when the user has opted out of +Tasks.
            && !(t.ai && !aiTasksVisible)
            // Hide tasks of a paused client (recurring return on resume).
            && !(t.client_id && pausedClientIds.has(t.client_id))
            // Hide tasks orphaned by a removed/rolodex'd client (the lingering
            // "N/A" rows) — their client_id no longer matches a live client.
            && !(t.client_id && !liveClientIds.has(t.client_id))
          );

          // [Removed Jun 2026] The per-task "Rai's pick" badge resolution
          // (activeBadgeTaskId / activeBadgePick) lived here. Picks are now
          // client-level only — no individual task carries the badge. The
          // surface that previously rendered the badge has been removed.

          // Sort comparator for Rai mode. Layered final score:
          //   priority_score (deterministic, with soft clamp inside)
          //   + new_client_boost
          //   + client.raiNudge   (-10..+10) — applies to ALL tasks of that client
          //   → clamped to 99
          // (The old Client-of-the-Day pick_boost was removed May 2026 — Rai's
          //  daily brief no longer moves the sort; only the per-client nudge does.)
          //
          // Tiebreakers, in order:
          //   1. final score desc
          //   2. nudge magnitude desc — Rai breaks ties
          //   3. alert (true wins)
          //   4. recurring (true wins)
          //   5. created_at desc (newer wins)
          const nudgeForClient = (clientName) => {
            if (!clientName) return 0;
            const c = clients.find(x => x.name === clientName);
            return c ? (c.raiNudge || 0) : 0;
          };
          // Pick boost: applies to every task of the Client of the Day, by
          // client name. Returns 0 if there's no pick today, the picked
          // client isn't in the roster, or the user already dismissed the
          // pick (we still keep the boost active even after dismissal so
          // their tasks stay surfaced — dismissal only hides the card, not
          // the underlying signal).
          // ─── Cross-client tiebreaker precompute ──────────────────────
          // When two tasks score identically AND belong to DIFFERENT clients,
          // we break the tie using signals that aren't in the score itself.
          // These are computed once here (O(clients) + O(touchpoints)) and
          // referenced by raiCompare as O(1) map lookups, instead of being
          // recomputed for every pairwise comparison during sort.
          const lastTouchedByClient = new Map();
          for (const tp of (allTouchpoints || [])) {
            const key = tp.client_id || tp.client_name;
            if (!key || !tp.occurred_at) continue;
            const t = new Date(tp.occurred_at).getTime();
            const cur = lastTouchedByClient.get(key);
            if (!cur || t > cur) lastTouchedByClient.set(key, t);
          }
          const lookupLastTouched = (clientName) => {
            if (!clientName) return 0; // never touched → most stale
            const c = clients.find(cc => cc.name === clientName);
            if (!c) return 0;
            return lastTouchedByClient.get(c.id) || lastTouchedByClient.get(c.name) || 0;
          };

          const raiCompare = (a, b) => {
            // 30-second priority hold: tasks created in the last 30 seconds
            // float to the top regardless of priority score, so when the user
            // adds a task they can act on it immediately without scrolling. Once
            // the hold expires, the task settles into its real priority position
            // on the next render. The hold only applies in Rai mode (Manual mode
            // already pins new tasks to the top via manualTaskOrder).
            const now = Date.now();
            const HOLD_MS = 30000;
            const aHeld = a.created_at && (now - a.created_at) < HOLD_MS;
            const bHeld = b.created_at && (now - b.created_at) < HOLD_MS;
            if (aHeld !== bHeld) return aHeld ? -1 : 1;
            if (aHeld && bHeld) return (b.created_at || 0) - (a.created_at || 0);
            // #1 — client-less tasks sort BELOW client tasks. Rai's ranking is
            // about which CLIENT needs attention; a task with no client has no
            // client signal to rank on, so it sits beneath the client-anchored
            // work rather than above it. (Only when exactly one has a client;
            // if both or neither do, fall through to the normal comparison.)
            const aHasClient = !!a.client;
            const bHasClient = !!b.client;
            if (aHasClient !== bHasClient) return aHasClient ? -1 : 1;
            // Days late: integer count of days the task is overdue. Computed
            // from the difference between today's local date and the task's
            // due_date (date part only — time-of-day ignored to avoid timezone
            // edge cases). Recurring tasks have no due_date and are not late.
            // Day boundary at midnight stored-TZ (matches task rollover and bucketing).
            const _now = new Date();
            const _todayStr = userTimezone
              ? ymdInTz(userTimezone, _now)
              : `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}-${String(_now.getDate()).padStart(2, "0")}`;
            const computeDaysLate = (t) => {
              if (!t.due_date || t.recurring) return 0;
              const dueStr = String(t.due_date).slice(0, 10);
              if (dueStr >= _todayStr) return 0;
              const due = new Date(dueStr + "T00:00:00");
              const today = new Date(_todayStr + "T00:00:00");
              return Math.max(0, Math.floor((today - due) / 86400000));
            };
            const aDaysLate = computeDaysLate(a);
            const bDaysLate = computeDaysLate(b);
            const psA = getProfileSortScore(a.client, a.raiPriority, aDaysLate);
            const psB = getProfileSortScore(b.client, b.raiPriority, bDaysLate);
            if (psA !== psB) return psB - psA;
            // ─── CROSS-CLIENT TIEBREAKERS ───────────────────────────────
            // When two tasks belong to DIFFERENT clients but scored
            // identically, we break the tie using signals NOT in the
            // profile_sort_score. Cascade order: last_touched_at older,
            // then renewal sooner, then higher LTV, then longer tenure,
            // then higher revenue, then lower retention (the only direction
            // that "surfaces fragility" — and the rarest possible tie since
            // by step 6 the clients are nearly indistinguishable on every
            // other axis). All six are skipped when a.client === b.client
            // (their values would be identical for both tasks).
            if (a.client && b.client && a.client !== b.client) {
              const cA = clients.find(c => c.name === a.client);
              const cB = clients.find(c => c.name === b.client);
              if (cA && cB) {
                // 1. last_touched_at — older (smaller timestamp) wins.
                //    Longer-neglected client surfaces first.
                const ltA = lookupLastTouched(a.client);
                const ltB = lookupLastTouched(b.client);
                if (ltA !== ltB) return ltA - ltB;
                // 2. renewal_date — sooner (smaller timestamp) wins.
                //    Closer to contract end = more time-sensitive.
                const rdA = cA.renewal_date ? new Date(cA.renewal_date).getTime() : Infinity;
                const rdB = cB.renewal_date ? new Date(cB.renewal_date).getTime() : Infinity;
                if (rdA !== rdB) return rdA - rdB;
                // 3. LTV — higher wins.
                const ltvA = getAdjustedLTV(cA);
                const ltvB = getAdjustedLTV(cB);
                if (ltvA !== ltvB) return ltvB - ltvA;
                // 4. tenure (months) — longer wins.
                const tenA = cA.months || 0;
                const tenB = cB.months || 0;
                if (tenA !== tenB) return tenB - tenA;
                // 5. revenue — higher wins.
                const revA = cA.revenue || 0;
                const revB = cB.revenue || 0;
                if (revA !== revB) return revB - revA;
                // 6. retention_score — LOWER wins (surface the fragile one).
                //    Only fires when literally every other factor is identical.
                const retA = cA.ret != null ? cA.ret : 50;
                const retB = cB.ret != null ? cB.ret : 50;
                if (retA !== retB) return retA - retB;
              }
            }
            // ─── WITHIN-CLIENT TIEBREAKERS ──────────────────────────────
            // Note: the nudge-magnitude tiebreaker was removed (May 2026).
            // The nudge is already inside getProfileSortScore via raiNudge,
            // so using |nudge| again here double-counted Rai's signal and
            // treated -10 ("demote") the same as +10 ("surface").
            if (a.alert !== b.alert) return a.alert ? -1 : 1;
            // Non-recurring wins over recurring. Within a single client's
            // group, this surfaces "the deliverable I committed to today"
            // above "the daily check-in routine." Recurring tasks come
            // back tomorrow anyway; one-offs need to actually get done.
            if (a.recurring !== b.recurring) return a.recurring ? 1 : -1;
            return (b.created_at || 0) - (a.created_at || 0);
          };

          // Sort comparator for Manual mode: new tasks (not in saved order) go to TOP, newest first.
          // Tasks in manualTaskOrder follow, in saved order.
          const manualCompare = (a, b) => {
            const ia = manualTaskOrder.indexOf(a.id);
            const ib = manualTaskOrder.indexOf(b.id);
            if (ia !== -1 && ib !== -1) return ia - ib;     // both in saved order → respect order
            if (ia === -1 && ib === -1) return (b.created_at || 0) - (a.created_at || 0);  // both new → newest first
            return ia === -1 ? -1 : 1;                      // new task wins, goes above saved-order task
          };

          const activeCompare = rankMode === "manual" ? manualCompare : raiCompare;

          // Client clustering pass: fix immediate A,B,A interleaving by swapping
          // so it becomes A,A,B. Single forward pass. Only applies in Rai mode
          // (Manual mode = explicit user order, never reorder).
          //
          // Rule (per RANKER-SPEC-v3, Rule 4):
          //   if tasks[i].client === tasks[i+2].client AND
          //      tasks[i].client !== tasks[i+1].client:
          //     swap tasks[i+1] and tasks[i+2]
          //
          // Does NOT cluster across larger gaps. A low-priority task at rank 12
          // does NOT jump to rank 2 just because rank 1 shares its client.
          const clusterAdjacent = (arr) => {
            if (rankMode === "manual" || !arr || arr.length < 3) return arr;
            const out = [...arr];
            for (let i = 0; i < out.length - 2; i++) {
              const cA = out[i].client;
              const cB = out[i + 1].client;
              const cC = out[i + 2].client;
              if (cA && cA === cC && cA !== cB) {
                // swap i+1 and i+2 to make A,A,B
                const tmp = out[i + 1];
                out[i + 1] = out[i + 2];
                out[i + 2] = tmp;
              }
            }
            return out;
          };

          const openTasks = clusterAdjacent(visibleTasks.filter(t => !t.done).sort(activeCompare));
          const completedTasks = visibleTasks.filter(t => t.done);
          // Render order: same active comparator applied to ALL tasks (done included).
          // Tasks stay in place when toggled — done state is visual only, no reordering.
          const renderTasks = clusterAdjacent([...visibleTasks].sort(activeCompare));
          // ── DEBUG: log Matte Collection + Motley Fool sort breakdown ──
          if (typeof window !== "undefined" && !window.__rt_sort_logged) {
            window.__rt_sort_logged = true;
            const targets = ["Matte Collection", "The Motley Fool", "Motley Fool"];
            renderTasks
              .filter(t => targets.includes(t.client))
              .forEach((t, i) => {
                const c = clients.find(x => x.name === t.client);
                const psBase = c ? calcProfileScore(c.ret || 50, c, clients) : 0;
                const totalRev = clients.reduce((a, x) => a + (x.revenue || 0), 0);
                const revPct = c && totalRev > 0 ? (c.revenue || 0) / totalRev : 0;
                const newBoost = c ? calcNewClientBoost(c.ret || 50, revPct, c.daysOld != null ? c.daysOld : 999) : 0;
                const raiBoost = t.raiPriority ? getRaiBoost(psBase) : 0;
                const total = getProfileSortScore(t.client, t.raiPriority);
                console.log(
                  `🔍 SORT [${t.client}] ret=${c?.ret} ps=${psBase} newBoost=${newBoost} raiPri=${!!t.raiPriority} raiBoost=${raiBoost} FINAL=${total} alert=${!!t.alert} recurring=${!!t.recurring} created=${t.created_at}`
                );
              });
          }
          const focusTask = openTasks.find(t => t.id === focusId) || openTasks[0] || null;
          const focusClient = focusTask ? clients.find(c => c.name === focusTask.client) : null;

          // STUB DATA for things we don't track yet
          const stubDelta = (clientName) => {
            if (!clientName) return 0;
            const h = clientName.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
            return (h % 11) - 5; // -5 to +5
          };
          // Relative time formatter — "Today" / "Yesterday" / "Nd ago" / "Nw ago" / "Nmo ago"
          const relTime = (dateStr) => {
            if (!dateStr) return "—";
            const d = new Date(dateStr);
            const diff = Date.now() - d.getTime();
            const days = Math.floor(diff / 86400000);
            if (days === 0) return "Today";
            if (days === 1) return "Yesterday";
            if (days < 7) return `${days}d ago`;
            if (days < 30) return `${Math.floor(days / 7)}w ago`;
            if (days < 365) return `${Math.floor(days / 30)}mo ago`;
            return `${Math.floor(days / 365)}y ago`;
          };
          // Real cadence calculation from touchpoint history
          const calcCadence = (clientName) => {
            // Cadence = days between contact events. Compare days-since-last
            // against average interval from the last 10 touchpoints. Verdict:
            //   <2 pts  →  "Building rhythm"   (not enough history yet)
            //   ≤1.15× →  "On rhythm"
            //   ≤1.5×  →  "Slipping"
            //   >1.5×  →  "Overdue"
            const points = allTouchpoints
              .filter(t => t.client_name === clientName)
              .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at));
            if (points.length < 2) return "Building rhythm";
            const recent = points.slice(0, 10);
            const intervals = [];
            for (let i = 0; i < recent.length - 1; i++) {
              intervals.push((new Date(recent[i].occurred_at) - new Date(recent[i+1].occurred_at)) / 86400000);
            }
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const daysSinceLast = (Date.now() - new Date(points[0].occurred_at).getTime()) / 86400000;
            if (daysSinceLast > avgInterval * 1.5)  return "Overdue";
            if (daysSinceLast > avgInterval * 1.15) return "Slipping";
            return "On rhythm";
          };

          // ─── HANDLERS ────────────────────────────────────────────────────
          const greeting = (() => {
            const h = new Date().getHours();
            if (h >= 5 && h < 12) return "Morning";
            if (h >= 12 && h < 17) return "Afternoon";
            return "Evening";
          })();

          const firstName = user?.user_metadata?.full_name?.split(" ")[0]
            || (user?.email ? user.email.split("@")[0].replace(/^\w/, c => c.toUpperCase()) : "")
            || "";
          // Date string for the band. Reads stored timezone (userTimezone)
          // so it always agrees with rollover, bucketing, and Rai's pick.
          // toLocaleDateString accepts a timeZone option that overrides the
          // device's setting — same Intl machinery as ymdInTz.
          const displayDate = userTimezone
            ? new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: userTimezone })
            : new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

          // Score chip component
          const ScoreChip = ({ score, delta = null, size = "sm" }) => {
            if (score == null) return null;
            const color = retColor(score);
            // 5 soft background tints aligned with the 5-stop retention ramp.
            // Pearlescent treatment: each tier renders as a soft tint-to-white-
            // to-tint gradient with a faint inset top highlight and a 1px
            // tinted hairline border. Chip reads like a pearl or polished
            // stone rather than a flat fill. Same colors, same role,
            // sharper craft. Chip stays passive — no halo shadow that
            // would make it read as tappable (chips are indicators, not
            // buttons; CTAs keep their own purple halo language).
            const tints = score >= 80 ? { tint: "#E6EFE9", border: "rgba(12,58,46,0.14)" }   // Elite
                        : score >= 65 ? { tint: "#E8F3ED", border: "rgba(31,122,92,0.14)" }  // Good
                        : score >= 45 ? { tint: "#F3F0D8", border: "rgba(168,164,32,0.16)" } // Ok
                        : score >= 30 ? { tint: "#FDF4DC", border: "rgba(209,122,27,0.16)" } // Warn
                        :              { tint: "#FBE6DE", border: "rgba(180,52,31,0.16)" }; // Crit
            const sizes = size === "sm" ? { fs: 11, pad: "2px 8px" } : { fs: 13, pad: "4px 11px" };
            return (
              <span style={{
                position: "relative",
                display: "inline-flex", alignItems: "center", gap: 4,
                background: `linear-gradient(135deg, ${tints.tint} 0%, #FFFFFF 45%, ${tints.tint} 100%)`,
                color,
                fontSize: sizes.fs, fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                padding: sizes.pad,
                borderRadius: 999,
                border: "1px solid " + tints.border,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 0 " + tints.border + ", 0 1px 2px rgba(20,30,22,0.05)",
              }}>
                <span style={{ position: "relative", zIndex: 1 }}>{score}</span>
                {delta !== null && delta !== 0 && (
                  <span style={{ fontWeight: 600, fontSize: sizes.fs - 1, opacity: 0.85, position: "relative", zIndex: 1 }}>
                    {delta > 0 ? "+" : ""}{delta}
                  </span>
                )}
              </span>
            );
          };

          // Client avatar (letters, color)
          const ClientAvatar = ({ client, size = 32 }) => {
            if (!client) return null;
            const initials = client.name.split(/\s|&/).filter(Boolean).slice(0, 2).map(s => s[0]).join("").toUpperCase();
            // Score-driven retention base color + sheen overlay via retGradient.
            // Single source of truth so this matches every avatar site-wide.
            return (
              <div style={{
                width: size, height: size, borderRadius: "50%",
                background: retGradient(client.ret || 60),
                color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: size * 0.35, fontWeight: 700,
                flexShrink: 0, letterSpacing: 0.2,
                boxShadow: "var(--rt-sh-xs)",
              }}>
                {initials}
              </div>
            );
          };

          // ─── DATE BOUNDARIES (hoisted so status band can count today-only tasks) ──
          // Date strings computed in user's STORED timezone (profile.timezone).
          // Single source of truth across the app — task rollover cutoff,
          // bucket comparisons, and the band's date label all read from
          // this same userTimezone value via ymdInTz so they're always in
          // agreement. Device timezone is never used for date logic.
          // Fallback to device-local YMD only while userTimezone is briefly
          // null on first mount; loadData re-runs once it hydrates.
          const _now = new Date();
          const _todayStr = userTimezone ? ymdInTz(userTimezone, _now) : `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}-${String(_now.getDate()).padStart(2, "0")}`;
          const _tomorrow = new Date(_now.getTime() + 86400000);
          const _tomorrowStr = userTimezone ? ymdInTz(userTimezone, _tomorrow) : `${_tomorrow.getFullYear()}-${String(_tomorrow.getMonth() + 1).padStart(2, "0")}-${String(_tomorrow.getDate()).padStart(2, "0")}`;
          // End of the Later window: today + 6 days (matches the "later"
          // convention used elsewhere and the Later calendar strip, which
          // spans day-after-tomorrow through today+6). Non-daily recurring
          // tasks whose next occurrence falls in (_tomorrowStr, _laterEndStr]
          // surface in Later; anything past it stays hidden until it rolls in.
          const _laterEnd = new Date(_now.getTime() + 6 * 86400000);
          const _laterEndStr = userTimezone ? ymdInTz(userTimezone, _laterEnd) : `${_laterEnd.getFullYear()}-${String(_laterEnd.getMonth() + 1).padStart(2, "0")}-${String(_laterEnd.getDate()).padStart(2, "0")}`;

          const bucketOf = (t) => {
            // Recurring tasks are standing work with a "next occurrence"
            // date — bucketed exactly like a one-off task is bucketed by
            // its due_date. The recurrence_pattern is NOT a show/hide
            // switch; it just tells us when the task next comes due.
            //
            //   - recurring + done       → "today" (sits in today's
            //     completed section like any finished task; the midnight
            //     rollover brings it back fresh on its next matching day)
            //   - recurring + not done   → find the next occurrence date,
            //     bucket by today / tomorrow / later. So "every Thursday"
            //     created on a Wednesday lands in TOMORROW, not hidden.
            //     "every Monday" created Wednesday lands in LATER.
            //     "daily" always lands in TODAY.
            if (t.recurring) {
              if (t.done) return "today";
              const next = nextOccurrenceDate(t.recurrence_pattern, _now, true);
              const nextStr = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
              if (nextStr <= _todayStr) return "today";
              // Daily recurring tasks always re-appear tomorrow in Today —
              // surfacing them in Tomorrow is duplicative noise. Hide them
              // from the future view; they're implicit.
              const isDaily = !t.recurrence_pattern || !t.recurrence_pattern.kind || t.recurrence_pattern.kind === "daily";
              if (nextStr === _tomorrowStr) return isDaily ? "hidden" : "tomorrow";
              // Non-daily recurring more than 1 day out: show in Later ONLY if
              // the next occurrence falls within the Later window (day-after-
              // tomorrow through today+6, matching the Later calendar strip).
              // Each task contributes at most one Later row (its soonest
              // occurrence). Anything past the window stays hidden until it
              // rolls into range, so Later never clogs with far-future work.
              if (!isDaily && nextStr > _tomorrowStr && nextStr <= _laterEndStr) return "later";
              return "hidden";
            }
            if (!t.due_date) return "today";
            const dateStr = String(t.due_date).slice(0, 10);
            if (dateStr <= _todayStr) return "today";
            if (dateStr === _tomorrowStr) return "tomorrow";
            return "later";
          };

          // ─── STATUS BAND ─────────────────────────────────────────────────
          const totalVisible = visibleTasks.length;
          // Today bucket = visibleTasks (open + done) that bucket as "today".
          const todayBucketTasks = visibleTasks.filter(t => bucketOf(t) === "today");
          const todayCount = todayBucketTasks.length;                       // total today (open + done) — for "X tasks" subhead
          const todayDoneCount = todayBucketTasks.filter(t => t.done).length;
          // Today's calendar event count — pulled from the SAME personalEvents
          // source the timeline panel uses, filtered to events whose local
          // start date is today. Previously this header was hardcoded to "3",
          // which disagreed with the panel's actual count.
          const _evNow = new Date();
          const _evTodayYmd = `${_evNow.getFullYear()}-${String(_evNow.getMonth() + 1).padStart(2, "0")}-${String(_evNow.getDate()).padStart(2, "0")}`;
          const todayEventCount = (personalEvents || []).filter(e => {
            if (!e.starts_at) return false;
            const d = new Date(e.starts_at);
            const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            return ymd === _evTodayYmd;
          }).length;
          const doneCount = completedTasks.length;
          const remaining = totalVisible - doneCount;
          // Percent complete is today-only — Tomorrow/Later don't count toward today's %.
          const pct = todayCount ? todayDoneCount / todayCount : 0;

          // ─── DUE-DATE BUCKETING (helpers — _now/_todayStr/etc hoisted above) ──

          // bucketOf returns 'today' | 'tomorrow' | 'later'
          // Rules:
          //   - Recurring                         → today  (always)
          //   - No due_date                       → today  (active work, no specific date)
          //   - due_date <= today (incl. overdue) → today
          //   - due_date == tomorrow              → tomorrow
          //   - due_date >  tomorrow              → later
          // (bucketOf defined above near hoisted date boundaries)

          // Push button helpers — change due_date and update local state.
          // Also notify worker by email if the task is assigned to one.
          const setTaskDueDate = async (taskId, newDateStr) => {
            // Find current task to detect if it has a worker assignment
            const currentTask = tasks.find(t => t.id === taskId);
            const oldDateStr = currentTask?.due_date || null;
            const wasAssigned = !!currentTask?.assigned_worker_id;
            const dateChanged = String(oldDateStr || "").slice(0,10) !== String(newDateStr || "").slice(0,10);

            // If a deferred task carried the is_rai_priority flag, clear it so
            // it doesn't return tomorrow still labeled as a priority. (Previous
            // code also cleared a per-task "Rai badge" — deprecated Jun 2026
            // along with the rest of the badge machinery.)
            const newDateIsTodayOrEarlier = newDateStr ? String(newDateStr).slice(0, 10) <= _todayStr : true;
            const currentIsRaiPriority = !!(currentTask?.raiPriority);
            if (currentIsRaiPriority && !newDateIsTodayOrEarlier) {
              try {
                await supabase.from("tasks").update({ is_rai_priority: false }).eq("id", taskId);
              } catch (e) { console.warn("Failed to clear is_rai_priority:", e); }
              setTasks(prev => prev.map(t => t.id === taskId ? { ...t, raiPriority: false } : t));
            }

            // Update local first for snappy UI; DB write is async
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, due_date: newDateStr } : t));
            try { await tasksDb.setDueDate(taskId, newDateStr); } catch (e) { console.warn("setDueDate failed:", e); }

            // Re-notify worker if assigned + date actually changed.
            // Edge Function applies a 12-hour cooldown per task to prevent spam.
            if (wasAssigned && dateChanged) {
              try {
                const { data: { session } } = await supabase.auth.getSession();
                fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/worker-task-notify`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                  },
                  body: JSON.stringify({ task_id: taskId, kind: "date_change" }),
                }).catch(e => console.warn("Worker date-change notify failed:", e));
              } catch (e) { console.warn("Worker date-change notify error:", e); }
            }
          };
          const pushToTomorrow = (taskId) => setTaskDueDate(taskId, _tomorrowStr);
          const pushToLater = (taskId) => {
            // Default: 7 days from today
            const later = new Date(_now);
            later.setDate(later.getDate() + 7);
            const dateStr = `${later.getFullYear()}-${String(later.getMonth() + 1).padStart(2, "0")}-${String(later.getDate()).padStart(2, "0")}`;
            setTaskDueDate(taskId, dateStr);
          };
          const pullToToday = (taskId) => setTaskDueDate(taskId, _todayStr);

          // Format a YYYY-MM-DD due date for display in the chip / row.
          // "Today" / "Tomorrow" for the immediate window; otherwise short date.
          const formatDueLabel = (dateStr, todayStr, tomorrowStr) => {
            if (!dateStr) return "Date";
            const s = String(dateStr).slice(0, 10);
            if (s === todayStr) return "Today";
            if (s === tomorrowStr) return "Tomorrow";
            const d = new Date(s + "T00:00:00");
            return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          };

          // ─── COMPOSER helpers ────────────────────────────────────────────
          // ─── V5 ghost-autocomplete computation ──────────────────────────
          // Returns the suggested completion string for the user's current
          // input, or "" if no suggestion applies. Strategy (V3-conservative):
          // look at the last token in the input. If it could be the prefix
          // of EXACTLY ONE client name (case-insensitive, ≥2 chars), the
          // ghost is the remainder. Skipped if the input ends with whitespace
          // (user is moving on), or the last token is too short, or any
          // client is already matched by the parser (don't ghost over an
          // existing match), or the token matches a complete client.
          const computeComposerGhost = (input) => {
            if (!input || /\s$/.test(input)) return "";
            const tokens = input.split(/\s+/);
            const last = tokens[tokens.length - 1];
            if (!last || last.length < 2) return "";
            // Skip if a client has already been parsed from this input —
            // the user has already specified one; don't suggest a second.
            const parsed = parseComposer(input, clients, workersList);
            if (parsed.matchedClient) return "";
            const lastLower = last.toLowerCase();
            // Find clients whose name starts with the last token (case-
            // insensitive). If exactly one match AND the token isn't
            // already the full name, ghost the remainder.
            const matches = (clients || []).filter(c => {
              const n = c && c.name ? c.name.toLowerCase() : "";
              return n.startsWith(lastLower) && n.length > lastLower.length;
            });
            if (matches.length !== 1) return "";
            // Ghost = remainder of client name, preserving original case
            // from the client record (so "Sprin" → ghosts "tRay" to make
            // the joined word read as "SprintRay").
            return matches[0].name.slice(last.length);
          };
          // ─── V5 effective-type helper ─────────────────────────────────
          // Compute which type the composer will produce — task, touchpoint,
          // or event. Honors composerTypeOverride if the user has manually
          // set it via the Type chip; otherwise falls back to parser-driven
          // detection (the same routing logic submitComposer uses).
          // Returns one of "task" | "touchpoint" | "event", or null when
          // there's not enough signal to commit to a type yet.
          const computeEffectiveType = (input, opts = {}) => {
            const { ignoreOverride = false } = opts;
            if (!ignoreOverride && composerTypeOverride) return composerTypeOverride;
            if (!input || !input.trim()) return null;
            const lowerC = input.toLowerCase();
            const parsed = parseComposer(input, clients, workersList);
            const client = parsed.matchedClient || (composerClient ? clients.find(c => c.name === composerClient) : null);
            // Event: time present after stripping the matched client name.
            let calText = input;
            if (client && client.name) {
              calText = calText.replace(new RegExp(client.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " ").replace(/\s+/g, " ").trim();
            }
            const calEntry = parseCalendarEntry(calText, new Date(), clients);
            if (calEntry) return "event";
            // Touchpoint: past-tense / comm-noun + matched client.
            const isCommNoun = /\bcall with\b|\bmet with\b|\bmeeting with\b|\bspoke (?:to|with)\b|\bcaught up with\b|\bcall w\/|\blunch with\b|\bcoffee with\b/i.test(lowerC);
            const isPastTouch = /\b(called|emailed|texted|messaged|pinged|spoke|met|caught up|chatted|rang|reached out|followed up|checked in)\b/i.test(lowerC);
            if ((isCommNoun || isPastTouch) && client) return "touchpoint";
            return "task";
          };
          // Auto-detected type (ignoring override) — used for displaying
          // the chip label when no override is set. When user hasn't typed
          // anything, returns null.
          const autoDetectedType = computeEffectiveType(newTask, { ignoreOverride: true });
          // ─── V5 readout summary ────────────────────────────────────────
          // Returns a {label, action, detail} object describing what the
          // composer will produce from the current input, or null when
          // there's nothing useful to show (empty input, no entities
          // parsed). Mirrors the routing logic in submitComposer at a
          // preview level: time present → event, past-tense + client →
          // touchpoint, otherwise task. Honors the manual type override
          // via computeEffectiveType.
          const computeComposerReadout = (input) => {
            if (!input || !input.trim()) return null;
            const parsed = parseComposer(input, clients, workersList);
            const client = parsed.matchedClient || (composerClient ? clients.find(c => c.name === composerClient) : null);
            // Date resolution: prefer the parser's matchedDate (typed word
            // like "tomorrow"), but fall back to the Date chip state. Both
            // are legitimate ways for the user to set a date — the readout
            // was previously blind to the chip path, so picking a date
            // from the menu would render as "no date yet" even though the
            // chip clearly showed a date set. Recurrence chip takes
            // priority (handled below in render).
            let resolvedDate = parsed.matchedDate;
            if (!resolvedDate && newTaskDueDate && !newTaskRecurring) {
              // Build a date-shaped object matching the parser's output so
              // the render path doesn't care which source it came from.
              // newTaskDueDate is a YYYY-MM-DD string; construct a noon
              // local Date so formatDueLabel reads it as "today/tomorrow"
              // correctly without timezone slippage.
              const [yy, mm, dd] = newTaskDueDate.split("-").map(n => parseInt(n, 10));
              if (yy && mm && dd) {
                const d = new Date(yy, mm - 1, dd, 12, 0, 0, 0);
                resolvedDate = { date: d, kind: "manual" };
              }
            }
            // Recurrence resolution: parser's matchedRecurrence wins, fall
            // back to the chip's recurring state. Same rationale.
            const resolvedRecurrence = parsed.matchedRecurrence
              || (newTaskRecurring ? { pattern: newTaskRecurrencePattern } : null);
            // Need at least one parsed signal — OR a manual type override —
            // to be worth showing a readout.
            if (!client && !resolvedDate && !parsed.matchedWorker && !resolvedRecurrence && !composerTypeOverride) return null;
            const kind = computeEffectiveType(input);
            if (!kind) return null;
            return {
              kind,
              client,
              date: resolvedDate,
              recurrence: resolvedRecurrence,
              actionLabel: kind === "touchpoint" ? "Log" : "Add",
              isManuallyTyped: !!composerTypeOverride,
            };
          };
          const clientMatches = composerQuery.trim()
            ? clients.filter(c => c.name.toLowerCase().includes(composerQuery.trim().toLowerCase()))
            : clients;

          const submitComposer = async () => {
            if (!newTask.trim()) return;
            // Parse one final time to get the cleaned title (matched names stripped,
            // sentence-cased, ending punctuation auto-applied).
            const finalParse = parseComposer(newTask, clients, workersList);
            const text = finalParse.title || newTask.trim();
            const clientName = composerClient || "";
            const clientObj = clients.find(c => c.name === clientName);
            const rawComposer = newTask.trim();

            // Explicit task intent: if the user toggled recurrence, assigned a
            // worker, or hand-picked a due date, they clearly mean a TASK — skip
            // auto-detection and create the task directly (below).
            // IMPORTANT: a due date the PARSER auto-detected from a typed date
            // word (e.g. "tomorrow") does NOT count as explicit — otherwise
            // "Call w/Matte at 8pm tomorrow" would set the due-date pill and
            // suppress calendar detection, wrongly creating a task instead of an
            // 8pm event. Only a MANUAL date pick (newTaskDueDate present AND not
            // the value the parser set itself) counts as explicit task intent.
            const dueIsManual = !!newTaskDueDate && newTaskDueDate !== parserSetDueDateRef.current;
            // Manual Type override — when the user clicks the Type chip and
            // picks task/touchpoint/event, treat that as authoritative:
            //   - "task"       → force ROUTE 2 (skip auto-detect entirely)
            //   - "touchpoint" → skip ROUTE 0 (event), let ROUTE 1 run (still
            //                    requires a matched client; falls to task if not)
            //   - "event"      → only ROUTE 0 attempts; if no time parsed,
            //                    fall through to task with a console warn
            // The override is set via the Type chip in the composer row.
            const typeOverride = composerTypeOverride; // null | "task" | "touchpoint" | "event"
            const explicitTask = newTaskRecurring || !!newTaskWorkerId || dueIsManual || typeOverride === "task";

            if (!explicitTask) {
              // ─── ROUTE 0: CALENDAR EVENT (a time is present). ───────────
              // Strip the matched client's name from the text BEFORE looking for
              // a time, so a numeric client name (e.g. a client literally named
              // "1620") can't be reinterpreted as a time-of-day (16:20). A
              // called-out / matched client token is claimed — never a time.
              // Skipped when typeOverride is "touchpoint" — user has
              // explicitly chosen a different type.
              if (typeOverride !== "touchpoint") {
              const matchedClientForCal = finalParse.matchedClient || clientObj || null;
              let calText = rawComposer;
              if (matchedClientForCal?.name) {
                calText = calText.replace(new RegExp(matchedClientForCal.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " ").replace(/\s+/g, " ").trim();
              }
              const calEntry = parseCalendarEntry(calText, new Date(), clients);
              if (calEntry) {
                // The calText strip removed the client name to protect time
                // parsing (so a numeric name like "1620" isn't read as 16:20),
                // but that also stripped it from the title. Rebuild the title
                // from the ORIGINAL text (client name intact) and force the
                // client link from the already-matched client.
                const titleFromRaw = parseCalendarEntry(rawComposer, new Date(), clients);
                if (titleFromRaw?.title) calEntry.title = titleFromRaw.title;
                if (matchedClientForCal?.name) {
                  calEntry.client_id = matchedClientForCal.id;
                  calEntry.client_name = matchedClientForCal.name;
                }
                let evId = "ev" + Date.now();
                try {
                  const { data: createdEv } = await personalCalendarDb.create(user.id, calEntry);
                  evId = createdEv?.id || evId;
                  setPersonalEvents(prev => [{ ...calEntry, id: evId, source: "manual" }, ...(prev || [])]
                    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)));
                  setQuickLogToast({ id: Date.now(), kind: "event", recordId: evId, label: calEntry.client_name || calEntry.title });
                } catch (e) { console.warn("Composer event create failed:", e); setQuickLogToast({ id: Date.now(), error: true }); }
                // reset composer + bail
                setNewTask(""); setComposerClient(""); setNewTaskRecurring(false);
                setNewTaskRecurrencePattern({ kind: "daily" }); setNewTaskDueDate(null);
                setNewTaskWorkerId(null); setDuePickerOpen(false); setWorkerPickerOpen(false);
                setComposerMenuOpen(false); parserSetRecurrenceRef.current = null;
                setComposerGhost(""); setComposerInPause(false); setComposerTypeOverride(null); setTypePickerOpen(false);
                if (composerPauseTimerRef.current) { clearTimeout(composerPauseTimerRef.current); composerPauseTimerRef.current = null; }
                return;
              }
              } // end if (typeOverride !== "touchpoint")

              // ─── ROUTE 1: TOUCHPOINT (past-tense / "call with X" + client). ─
              // Same intent rules as the QuickLog FAB, but the inline composer
              // DEFAULTS TO TASK — only explicit touchpoint phrasing routes here.
              // When typeOverride is "touchpoint", we force this route to run
              // as long as a client is matched (skipping the past-tense /
              // comm-noun gate). Falls through to ROUTE 2 task if no client.
              const lowerC = rawComposer.toLowerCase();
              const isCommNoun = /\bcall with\b|\bmet with\b|\bmeeting with\b|\bspoke (?:to|with)\b|\bcaught up with\b|\bcall w\/|\blunch with\b|\bcoffee with\b/i.test(lowerC);
              const isPastTouch = /\b(called|emailed|texted|messaged|pinged|spoke|met|caught up|chatted|rang|reached out|followed up|checked in)\b/i.test(lowerC);
              const matchedClientC = finalParse.matchedClient || clientObj || null;
              const forceTouchpoint = typeOverride === "touchpoint" && matchedClientC;
              if ((forceTouchpoint || ((isCommNoun || isPastTouch) && matchedClientC))) {
                let ch = "note";
                if (/\bcall|\bspoke|got off|\brang|phone/i.test(lowerC)) ch = "call";
                else if (/\bemail/i.test(lowerC)) ch = "email";
                else if (/\btext|\bmessage|\bdm\b|pinged/i.test(lowerC)) ch = "text";
                else if (/\bmet\b|\bmeeting|\blunch|\bcoffee|caught up|\bsync\b|\bdemo\b/i.test(lowerC)) ch = "meeting";
                try {
                  const { data: createdTp } = await touchpointsDb.create(user.id, {
                    client_id: matchedClientC.id,
                    client_name: matchedClientC.name,
                    channel: ch,
                    notes: rawComposer,
                  });
                  const tpId = createdTp?.id || "tp" + Date.now();
                  if (createdTp) setTpLogged(prev => [createdTp, ...(prev || [])]);
                  setQuickLogToast({ id: Date.now(), kind: "touchpoint", recordId: tpId, label: matchedClientC.name });
                } catch (e) { console.warn("Composer touchpoint create failed:", e); setQuickLogToast({ id: Date.now(), error: true }); }
                setNewTask(""); setComposerClient(""); setNewTaskRecurring(false);
                setNewTaskRecurrencePattern({ kind: "daily" }); setNewTaskDueDate(null);
                setNewTaskWorkerId(null); setDuePickerOpen(false); setWorkerPickerOpen(false);
                setComposerMenuOpen(false); parserSetRecurrenceRef.current = null;
                setComposerGhost(""); setComposerInPause(false); setComposerTypeOverride(null); setTypePickerOpen(false);
                if (composerPauseTimerRef.current) { clearTimeout(composerPauseTimerRef.current); composerPauseTimerRef.current = null; }
                return;
              }
            }

            // ─── ROUTE 2: TASK (default / explicit). ────────────────────────
            // Recurring tasks cannot have a due_date — they reset daily at midnight local.
            // For non-recurring tasks: if no due date was picked, default to today
            // so the task is anchored (not free-floating) and renders in the Today bucket.
            const dueDateForCreate = newTaskRecurring
              ? null
              : (newTaskDueDate || _todayStr);
            const recurrencePatternForCreate = newTaskRecurring ? newTaskRecurrencePattern : null;
            // 75-char hard cap on task titles. Two-line mobile is ~68 chars;
            // 75 leaves ~7 chars past the cutoff before ellipsis — small
            // enough that the elided portion isn't meaningful content.
            // Applies to both user-typed and Rai-suggested tasks (the
            // ranker prompt has the same rule). Trailing whitespace from
            // the substring is trimmed; we DON'T append an ellipsis to
            // the stored text — display layers handle truncation visually.
            const TITLE_CAP = 75;
            const cappedText = text.length > TITLE_CAP ? text.slice(0, TITLE_CAP).trimEnd() : text;
            const { data: created } = await tasksDb.create(user.id, {
              text: cappedText,
              client_name: clientName,
              client_id: clientObj?.id || null,
              is_recurring: newTaskRecurring,
              recurrence_pattern: recurrencePatternForCreate,
              due_date: dueDateForCreate,
              assigned_worker_id: newTaskWorkerId || null,
            });
            const task = {
              id: created?.id || "u" + Date.now(),
              text: cappedText,
              client: clientName || null,
              done: false, ai: false,
              recurring: newTaskRecurring,
              recurrence_pattern: recurrencePatternForCreate,
              due_date: dueDateForCreate,
              raiPriority: false, alert: false,
              created_at: Date.now(),
              assigned_worker_id: newTaskWorkerId || null,
            };
            setTasks(prev => [task, ...prev]);
            setQuickLogToast({ id: Date.now(), kind: "task", recordId: task.id, label: clientName || text });

            // Fire email send if assigned to a worker (non-blocking).
            if (newTaskWorkerId && created?.id) {
              try {
                const { data: { session } } = await supabase.auth.getSession();
                fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/worker-task-notify`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                  },
                  body: JSON.stringify({ task_id: created.id }),
                }).catch(e => console.warn("Worker notify failed:", e));
              } catch (e) { console.warn("Worker notify error:", e); }
            }

            setNewTask("");
            setComposerClient("");
            setNewTaskRecurring(false);
            setNewTaskRecurrencePattern({ kind: "daily" });
            setNewTaskDueDate(null);
            setNewTaskWorkerId(null);
            setDuePickerOpen(false);
            setWorkerPickerOpen(false);
            setComposerMenuOpen(false);
            // Clear parser provenance — next task starts fresh.
            parserSetRecurrenceRef.current = null;
            parserSetDueDateRef.current = null;
            // V5: clear ghost + readout state. Cancel any pending pause
            // timer so the readout doesn't fade in over an empty composer.
            setComposerGhost("");
            setComposerInPause(false);
            // Clear manual type override + close picker.
            setComposerTypeOverride(null);
            setTypePickerOpen(false);
            if (composerPauseTimerRef.current) {
              clearTimeout(composerPauseTimerRef.current);
              composerPauseTimerRef.current = null;
            }
          };

          // ─── RENDER ──────────────────────────────────────────────────────
          return (
            <div
              className={"rt-today-v4" + (focusMode ? " rt-focus-on" : "")}
              onClick={focusMode ? (e) => {
                // Exit focus if click target is the wrapper itself (background area), not bubbled from inside a task or button.
                // We use a data attribute on focus-protected zones; if no protected ancestor, exit.
                const t = e.target;
                if (t && t.closest && t.closest("[data-focus-keep]")) return;
                setFocusMode(false);
              } : undefined}
              style={{ width: "100%", display: "grid", gap: 20, alignItems: "start", position: "relative" }}>
              {/* Focus-mode exit scrim — a full-viewport tap target behind the
                  focused task. The dimmed rows/areas have pointer-events:none,
                  so on mobile taps never reached the grid wrapper's onClick;
                  this scrim guarantees a tap anywhere outside the focused task
                  exits focus. The focused row paints above it (higher z-index in
                  the .rt-focus-on rules). */}
              {focusMode && (
                <div
                  onClick={() => setFocusMode(false)}
                  style={{ position: "fixed", inset: 0, zIndex: 5, background: "transparent" }}
                  aria-hidden="true"
                />
              )}
              {/* Mobile ambient calendar strip — pinned at the very top of the
                  mobile Today page, above the greeting/band. Collapsed by
                  default (B1 sequence-dots + next + countdown), expands in
                  place on tap. display:none on desktop via the class. */}
              <div className="rt-mob-cal-sheet-band" style={{ display: "none" }}>
                <MobileCalendarStrip
                  clients={clients}
                  events={personalEvents}
                  C={C}
                  open={todayStripOpen}
                  onToggle={() => setTodayStripOpen(!todayStripOpen)}
                  greeting={greeting}
                  firstName={firstName}
                  displayDate={displayDate}
                  onCreate={async (entry) => {
                    const optimistic = { id: `tmp-${Date.now()}`, source: "manual", ...entry };
                    setPersonalEvents(prev => [...prev, optimistic].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)));
                    const { data, error } = await personalCalendarDb.create(user.id, entry);
                    if (error) {
                      console.error("Calendar create failed:", error);
                      setPersonalEvents(prev => prev.filter(e => e.id !== optimistic.id));
                      return;
                    }
                    setPersonalEvents(prev => prev.map(e => e.id === optimistic.id ? data : e).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)));
                  }}
                  onDelete={async (id) => {
                    const prev = personalEvents;
                    setPersonalEvents(prev.filter(e => e.id !== id));
                    const { error } = await personalCalendarDb.remove(id);
                    if (error) {
                      console.error("Calendar delete failed:", error);
                      setPersonalEvents(prev);
                    }
                  }}
                />
              </div>
              {/* STATUS BAND */}
              <div className="rt-band" style={{ gridArea: "band", display: "flex", flexDirection: "column", alignItems: "stretch", gap: 4, padding: "4px 4px 20px", borderBottom: "1px solid " + C.borderLight, position: "relative", zIndex: 1 }}>
                <div className="rt-band-greet">
                  <div style={{ fontSize: 11.5, color: C.textMuted, letterSpacing: 0.3 }}>
                    {displayDate}
                  </div>
                  <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: -0.4, color: C.text }}>
                    {greeting}{firstName ? ", " + firstName : ""}.
                  </h1>
                </div>

                {/* Rai's Pick of the Day — its own block above the meta row.
                    maxWidth caps how wide it can get so long reasons WRAP
                    within the block (multi-line) instead of stretching the
                    band wider and pushing the events · tasks · % row to
                    misalign. Renders regardless of rankMode: the Pick is an
                    OBSERVATION ("here's the client to focus on today"), not
                    a SORT directive — Manual toggle does not silence it.
                    Hidden when: no pick, picked client not in roster, or
                    user dismissed it today. */}
                {(() => {
                  // First 7 days: Rai is calibrating, so no tasks land yet
                  // (mirrors the Edge Function's 7-day gate in writeSuggestedTasks).
                  // Explain the quiet slot instead of showing a thin pick. Fail
                  // open — if the signup date can't be read, fall through to the
                  // normal brief rather than mislabel an established account.
                  const signupMs = user?.created_at ? new Date(user.created_at).getTime() : null;
                  const inCalibration = signupMs != null && (Date.now() - signupMs) < 7 * 24 * 60 * 60 * 1000;
                  if (inCalibration) {
                    return (
                      <div
                        className="rt-band-pick is-expanded"
                        style={{
                          marginTop: 8,
                          fontSize: 14,
                          lineHeight: 1.5,
                          color: C.textMuted,
                          fontFamily: "'Fraunces', Georgia, serif",
                          fontStyle: "italic",
                          fontWeight: 500,
                          fontVariationSettings: "'opsz' 96, 'SOFT' 50, 'WONK' 0",
                          position: "relative",
                        }}
                      >
                        Suggested tasks and client actions will show up here. Rai&rsquo;s still calibrating to your workflow and your clients.
                      </div>
                    );
                  }
                  if (!raiPicks || !raiPicks.client_id) return null;
                  if (raiState?.todays_pick_dismissed_at) return null;
                  const pickClient = clients.find(c => c.id === raiPicks.client_id);
                  if (!pickClient) return null;
                  // Seed the composer (desktop) or quick-log (mobile) with a
                  // client's name. Used by every client link in the brief —
                  // the anchor AND any other client Rai mentions in the prose.
                  const handleAddTaskFor = (clientName) => {
                    const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches;
                    if (isMobile) {
                      setQuickLogText(clientName + " ");
                      setQuickLogOpen(true);
                      return;
                    }
                    setTodayComposerClient(clientName);
                    setTimeout(() => {
                      const el = document.getElementById("rt-composer-input");
                      if (el) { el.focus(); el.scrollIntoView({ behavior: "smooth", block: "center" }); }
                    }, 0);
                  };
                  // One blurb. Prefer the longer read (reason_detail, 1-2
                  // sentences); fall back to the short reason.
                  const briefText = (raiPicks.reason_detail && String(raiPicks.reason_detail).trim())
                    || (raiPicks.reason
                        ? raiPicks.reason.replace(/^["'\u201c\u201d]|["'\u201c\u201d]$/g, "").replace(/\.$/, "") + "."
                        : "A quiet day — nothing flagging across your book.");
                  // ── Multi-client linkifier ──────────────────────────────
                  // Rai mentions one or two clients in the brief. Every name
                  // that matches a client in the user's roster becomes a
                  // purple link with the same composer-seed affordance as
                  // the anchor. Match longest names first so "Rose Babe"
                  // wins over "Rose" if both exist. Possessive "'s" forms
                  // are detected and kept as plain text after the link.
                  // Case-insensitive matching; preserve the original casing
                  // from the brief in the rendered link text.
                  const briefSegments = (() => {
                    // Build an alias map: each client gets its full name + the
                    // first-word abbreviation (e.g. "Ardath Watches" → also
                    // match "Ardath"). Rai often uses short forms in prose.
                    // We map every alias back to the canonical client name so
                    // clicks always seed the right client. Longest first so
                    // "Ardath Watches" wins over "Ardath" when both appear.
                    const aliasToCanonical = new Map();
                    for (const c of (clients || [])) {
                      const n = c && c.name;
                      if (!n || typeof n !== "string") continue;
                      aliasToCanonical.set(n.toLowerCase(), n);
                      // First-word alias for multi-word names. Skip if the
                      // first word is too short to be unambiguous (e.g.
                      // "The Motley Fool" — "The" should NOT be a link).
                      // Skip leading articles, and require ≥3 chars.
                      const ARTICLES = new Set(["the", "a", "an"]);
                      const words = n.split(/\s+/);
                      let firstWord = words[0];
                      if (words.length > 1 && firstWord && ARTICLES.has(firstWord.toLowerCase())) {
                        firstWord = words[1];
                      }
                      if (
                        words.length > 1 &&
                        firstWord &&
                        firstWord.length >= 3 &&
                        !aliasToCanonical.has(firstWord.toLowerCase())
                      ) {
                        aliasToCanonical.set(firstWord.toLowerCase(), n);
                      }
                    }
                    const aliases = Array.from(aliasToCanonical.keys())
                      .sort((a, b) => b.length - a.length); // longest first
                    if (!aliases.length) return [{ type: "text", value: briefText }];
                    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                    const pattern = new RegExp(`\\b(${aliases.map(esc).join("|")})\\b`, "gi");
                    const segs = [];
                    let lastIdx = 0;
                    let m;
                    while ((m = pattern.exec(briefText)) !== null) {
                      if (m.index > lastIdx) {
                        segs.push({ type: "text", value: briefText.slice(lastIdx, m.index) });
                      }
                      const matched = m[1];
                      const canonical = aliasToCanonical.get(matched.toLowerCase()) || matched;
                      segs.push({ type: "client", value: matched, canonical });
                      lastIdx = m.index + matched.length;
                    }
                    if (lastIdx < briefText.length) {
                      segs.push({ type: "text", value: briefText.slice(lastIdx) });
                    }
                    return segs;
                  })();
                  // If Rai never named the anchor client in the brief prose
                  // (rare — happens when the brief leads with a pronoun or
                  // an indirect reference), prepend the anchor as a link so
                  // the user still has a clickable handle to it.
                  const anchorNamed = briefSegments.some(s =>
                    s.type === "client" && s.canonical.toLowerCase() === pickClient.name.toLowerCase()
                  );
                  return (
                    <div
                      className="rt-band-pick is-expanded"
                      style={{
                        marginTop: 8,
                        fontSize: 14,
                        lineHeight: 1.5,
                        color: C.textMuted,
                        fontFamily: "'Fraunces', Georgia, serif",
                        fontStyle: "italic",
                        fontWeight: 500,
                        fontVariationSettings: "'opsz' 96, 'SOFT' 50, 'WONK' 0",
                        position: "relative",
                      }}
                    >
                      {/* Rai's daily brief — one blurb, her read of the book.
                          Every client name Rai mentions is a purple link
                          that seeds the composer with that client. Same
                          affordance for the anchor and any secondary
                          clients in the prose. */}
                      {!anchorNamed && (
                        <>
                          <span
                            className="rt-purple-link"
                            onClick={(e) => { e.stopPropagation(); handleAddTaskFor(pickClient.name); }}
                            style={{ cursor: "pointer", paddingBottom: 1 }}
                          >
                            {pickClient.name}
                          </span>
                          {" "}&mdash;{" "}
                        </>
                      )}
                      {briefSegments.map((seg, i) => seg.type === "client" ? (
                        <span
                          key={i}
                          className="rt-purple-link"
                          onClick={(e) => { e.stopPropagation(); handleAddTaskFor(seg.canonical); }}
                          style={{ cursor: "pointer", paddingBottom: 1 }}
                        >
                          {seg.value}
                        </span>
                      ) : (
                        <Fragment key={i}>{seg.value}</Fragment>
                      ))}
                    </div>
                  );
                })()}

                {/* Meta row: events · tasks on the left, % + completion bar
                    on the right. One flex row, justify-between, with a
                    flex-wrap fallback so on truly narrow screens the right
                    block falls below cleanly. */}
                <div className="rt-band-meta" style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div className="rt-band-sub" style={{ fontSize: 13.5, color: C.textMuted, display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexShrink: 0 }}>
                    <span><b style={{ color: C.text, fontWeight: 700 }}>{todayEventCount}</b> {todayEventCount === 1 ? "event" : "events"}</span>
                    <span className="rt-band-sub-sep" style={{ color: C.border }}>·</span>
                    <span><b style={{ color: C.text, fontWeight: 700 }}>{todayCount}</b> tasks</span>
                  </div>

                  {/* Bar takes the remaining horizontal space between
                      events·tasks and the % number. flex: 1 stretches.
                      min-width keeps the bar visible even if siblings
                      grow. The wrapping fallback (band-meta has
                      flex-wrap) handles very narrow desktops. */}
                  <div className="rt-pct-bar" style={{ position: "relative", flex: 1, height: 5, minWidth: 60, background: C.borderLight, borderRadius: 999, overflow: "hidden", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.10)" }}>
                    <div className="rt-pct-fill" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.max(0, Math.min(100, Number(pct) * 100))}%`, background: `linear-gradient(90deg, ${C.primaryLight}, ${C.primary})`, borderRadius: 999, transition: "width 400ms cubic-bezier(.2,.7,.3,1)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.30), 0 0 6px rgba(51,84,62,0.25)" }} />
                  </div>

                  <span className="rt-pct-num" style={{ fontSize: 15, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums", letterSpacing: -0.2, flexShrink: 0 }}>
                    {Math.round(pct * 100)}<span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>%</span>
                  </span>
                  <span className="rt-pct-lbl" style={{ fontSize: 10.5, color: C.textMuted, letterSpacing: 0.3, textTransform: "uppercase", fontWeight: 600, flexShrink: 0 }}>of today done</span>
                </div>

              </div>

              {/* COMPOSER — A2 underline-input treatment. No card, no
                  background, no shadow. The 1.5px hairline at the bottom
                  defines the input region; on focus it thickens/darkens. */}
              <div className="rt-composer" style={{ gridArea: "composer", background: "transparent", borderRadius: 0, boxShadow: "none", borderBottom: "1.5px solid rgba(20,30,22,0.16)", position: "relative", containerType: "inline-size", zIndex: (composerMenuOpen || duePickerOpen || workerPickerOpen || typePickerOpen) ? 600 : 1 }}>
                {/* Row 1: purple puck plus + input */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px 8px" }}>
                  <div className="rt-composer-plus" style={{ width: 28, height: 28, borderRadius: 14, background: C.btnLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon name="plus" size={14} color={C.btn} />
                  </div>
                  <div style={{ flex: 1, minWidth: 140, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {/*
                      Smart composer input. As the user types, parseComposer() runs and:
                        - lights up Client / Worker / Date chips below
                      Manual chip clicks still override parser output.
                    */}
                    {/* V5 ghost-autocomplete: input + ghost overlay live in
                        a relative-positioned wrapper. The ghost is rendered
                        as an absolutely-positioned span containing a
                        visibility:hidden copy of the typed text (which
                        takes up its rendered width), followed by the ghost
                        characters in muted grey. This makes the ghost flow
                        naturally after the typed text without needing JS
                        measurement. The input itself is rendered after,
                        sized to flex:1, on top of the overlay (so its
                        caret + selection remain native). */}
                    <span style={{ position: "relative", flex: 1, minWidth: 100, display: "inline-flex", alignItems: "center" }}>
                      {composerGhost && !composerInPause && (
                        <span aria-hidden="true" style={{
                          position: "absolute",
                          left: 0, top: "50%",
                          transform: "translateY(-50%)",
                          whiteSpace: "pre",
                          pointerEvents: "none",
                          color: "#B7B7AE",
                          fontSize: 14.5,
                          fontFamily: "inherit",
                          fontStyle: "normal",
                          maxWidth: "100%",
                          overflow: "hidden",
                          zIndex: 0,
                        }}>
                          {/* Invisible spacer — takes the width of the
                              typed text so the ghost starts at the right
                              offset. */}
                          <span style={{ visibility: "hidden" }}>{newTask}</span>
                          {composerGhost}
                        </span>
                      )}
                    <input
                      id="rt-composer-input"
                      value={newTask}
                      onChange={e => {
                        const v = e.target.value;
                        setNewTask(v);
                        // ─── V5 ghost-autocomplete + pause-timer ──────────
                        // Active typing: hide readout, recompute ghost. The
                        // 400ms pause timer fires "smart silence" — readout
                        // appears, ghost dims. Cleared on every keystroke
                        // so it only fires after the user STOPS typing.
                        setComposerInPause(false);
                        setComposerGhost(computeComposerGhost(v));
                        if (composerPauseTimerRef.current) {
                          clearTimeout(composerPauseTimerRef.current);
                        }
                        composerPauseTimerRef.current = setTimeout(() => {
                          setComposerInPause(true);
                        }, 400);
                        const parsed = parseComposer(v, clients, workersList);
                        if (parsed.matchedClient && composerClient !== parsed.matchedClient.name) {
                          setComposerClient(parsed.matchedClient.name);
                          triggerChipPulse("client");
                        }
                        if (parsed.matchedWorker && newTaskWorkerId !== parsed.matchedWorker.id) {
                          setNewTaskWorkerId(parsed.matchedWorker.id);
                          triggerChipPulse("worker");
                        }
                        // Recurrence wins over due_date: they're mutually
                        // exclusive in the data model, and the parser already
                        // voided matchedDate when matchedRecurrence fired.
                        if (parsed.matchedRecurrence) {
                          if (!newTaskRecurring) {
                            setNewTaskRecurring(true);
                            triggerChipPulse("due");
                          }
                          if (JSON.stringify(newTaskRecurrencePattern) !== JSON.stringify(parsed.matchedRecurrence.pattern)) {
                            setNewTaskRecurrencePattern(parsed.matchedRecurrence.pattern);
                          }
                          if (newTaskDueDate) setNewTaskDueDate(null);
                          // Record what the parser set so we can detect later
                          // if the user deletes the trigger phrase.
                          parserSetRecurrenceRef.current = parsed.matchedRecurrence.pattern;
                          parserSetDueDateRef.current = null;
                        } else if (parsed.matchedDate && parsed.matchedDate.date) {
                          const ymd = dateToYmd(parsed.matchedDate.date);
                          if (ymd && newTaskDueDate !== ymd) {
                            setNewTaskDueDate(ymd);
                            setNewTaskRecurring(false);
                            triggerChipPulse("due");
                          }
                          parserSetDueDateRef.current = ymd;
                          parserSetRecurrenceRef.current = null;
                        } else {
                          // No recurrence/date phrase in the text right now.
                          // If the current chip state still matches what the
                          // PARSER last set, the user just deleted the trigger
                          // phrase — clear the chip. If it differs, the user
                          // set it manually via the chip menu — leave it.
                          if (
                            parserSetRecurrenceRef.current &&
                            newTaskRecurring &&
                            JSON.stringify(newTaskRecurrencePattern) === JSON.stringify(parserSetRecurrenceRef.current)
                          ) {
                            setNewTaskRecurring(false);
                            setNewTaskRecurrencePattern({ kind: "daily" });
                            parserSetRecurrenceRef.current = null;
                          }
                          if (
                            parserSetDueDateRef.current &&
                            newTaskDueDate === parserSetDueDateRef.current
                          ) {
                            setNewTaskDueDate(null);
                            parserSetDueDateRef.current = null;
                          }
                        }
                      }}
                      onKeyDown={e => {
                        // Tab accepts the ghost autocomplete (V5). Only
                        // intercepts when ghost is non-empty — otherwise
                        // Tab keeps its default behavior (focus advance).
                        if (e.key === "Tab" && composerGhost) {
                          e.preventDefault();
                          const accepted = newTask + composerGhost;
                          setNewTask(accepted);
                          setComposerGhost("");
                          // Re-run parser on the accepted text so chips
                          // light up immediately (mirrors onChange logic).
                          const parsed = parseComposer(accepted, clients, workersList);
                          if (parsed.matchedClient && composerClient !== parsed.matchedClient.name) {
                            setComposerClient(parsed.matchedClient.name);
                            triggerChipPulse("client");
                          }
                          // Restart the pause timer so the readout appears
                          // shortly after acceptance.
                          if (composerPauseTimerRef.current) clearTimeout(composerPauseTimerRef.current);
                          composerPauseTimerRef.current = setTimeout(() => setComposerInPause(true), 400);
                          return;
                        }
                        if (e.key === "Enter" && newTask.trim()) { e.preventDefault(); submitComposer(); }
                        else if (e.key === "Escape") { setComposerMenuOpen(false); }
                      }}
                      placeholder="Add a task, log activity, or schedule an event. Natural language = magic."
                      style={{
                        flex: 1, minWidth: 100,
                        border: "none", outline: "none", background: "transparent",
                        fontSize: 14.5, padding: "4px 0", fontFamily: "inherit",
                        color: C.text,
                        fontStyle: newTask ? "normal" : "italic",
                        // V5: input sits ABOVE the absolutely-positioned
                        // ghost overlay span. Caret and selection are
                        // native to the input; the ghost shows behind.
                        position: "relative",
                        zIndex: 1,
                      }}
                    />
                    </span>
                  </div>
                </div>

                {/* Divider between rows */}
                <div style={{ height: 1, background: C.borderLight, margin: "0 14px" }} />

                {/* Row 2: chips + Add Task button */}
                <div className="rt-composer-row2" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px 10px", flexWrap: "wrap", position: "relative" }}>
                  <div className="rt-composer-controls" style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "nowrap", flex: 1, minWidth: 0 }}>
                    {(() => {
                      const selectedClientObj = composerClient ? clients.find(c => c.name === composerClient) : null;
                      return (
                        <div style={{ position: "relative", flexShrink: 0 }}>
                          <button
                            onClick={() => setComposerMenuOpen(!composerMenuOpen)}
                            className={"rt-composer-pill" + (selectedClientObj ? " is-filled" : "") + (pulseChip === "client" ? " chip-pulse" : "")}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 5,
                              padding: selectedClientObj ? "0 4px 0 4px" : "0 10px",
                              height: 28,
                              border: "none",
                              borderRadius: 8,
                              fontSize: 12,
                              color: selectedClientObj ? C.text : C.textSec,
                              cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
                              fontWeight: selectedClientObj ? 600 : 500,
                            }}
                          >
                            {selectedClientObj ? (
                              <>
                                <ClientAvatar client={selectedClientObj} size={22} />
                                <span className="rt-composer-client-name" style={{ paddingRight: 4 }}>{selectedClientObj.name}</span>
                              </>
                            ) : (
                              <>
                                <Icon name="clients" size={14} simple />
                                <span style={{ fontWeight: 500 }}>Client</span>
                              </>
                            )}
                          </button>
                          {selectedClientObj && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setComposerClient(""); }}
                              style={{
                                position: "absolute",
                                top: -3, right: -3,
                                width: 16, height: 16,
                                borderRadius: 8,
                                background: C.card,
                                color: C.textMuted,
                                cursor: "pointer",
                                display: "grid", placeItems: "center",
                                padding: 0,
                              }}
                              aria-label="Clear client"
                              title="Clear client"
                            >
                              <Icon name="x" size={9} />
                            </button>
                          )}
                {composerMenuOpen && (
                  <>
                    {/* Click-outside backdrop — invisible but captures clicks anywhere on the page */}
                    <div
                      onClick={() => { setComposerMenuOpen(false); setComposerQuery(""); }}
                      style={{ position: "fixed", inset: 0, zIndex: 29, background: "transparent" }}
                    />
                    <div className="rt-client-picker rt-picker-panel" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, width: 300, zIndex: 30 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderBottom: "1px solid " + C.borderLight }}>
                      <Icon name="search" size={12} color={C.textMuted} />
                      <input autoFocus value={composerQuery}
                        onChange={e => { setComposerQuery(e.target.value); setComposerHighlight(0); }}
                        onKeyDown={e => {
                          if (e.key === "Escape") { setComposerMenuOpen(false); return; }
                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            setComposerHighlight(h => Math.min(h + 1, Math.max(0, clientMatches.length - 1)));
                            return;
                          }
                          if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setComposerHighlight(h => Math.max(h - 1, 0));
                            return;
                          }
                          if (e.key === "Enter") {
                            const pick = clientMatches[composerHighlight] || clientMatches[0];
                            if (pick) {
                              setComposerClient(pick.name);
                              setComposerMenuOpen(false);
                              setComposerQuery("");
                              setComposerHighlight(0);
                              // Refocus the task input so the user can type immediately
                              setTimeout(() => {
                                const el = document.getElementById("rt-composer-input");
                                if (el) el.focus();
                              }, 0);
                            }
                          }
                        }}
                        placeholder="Search clients…" style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 12.5, fontFamily: "inherit", color: C.text }} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", paddingTop: 4, maxHeight: 300, overflow: "auto" }}>
                      {clientMatches.map((c, idx) => (
                        <button key={c.id || c.name}
                          className={"rt-picker-item" + (idx === composerHighlight ? " is-highlight" : "")}
                          onClick={() => {
                            setComposerClient(c.name);
                            setComposerMenuOpen(false);
                            setComposerQuery("");
                            setComposerHighlight(0);
                            // Refocus the task input so the user can type immediately
                            setTimeout(() => {
                              const el = document.getElementById("rt-composer-input");
                              if (el) el.focus();
                            }, 0);
                          }}
                          onMouseEnter={() => setComposerHighlight(idx)}
                        >
                          <ClientAvatar client={c} size={22} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: idx === composerHighlight ? 600 : 500, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{c.industry || "Client"}</div>
                          </div>
                          <ScoreChip score={c.ret} size="sm" />
                        </button>
                      ))}
                      {clientMatches.length === 0 && <div style={{ padding: "12px 10px", fontSize: 13, color: C.textMuted }}>No matches</div>}
                    </div>
                  </div>
                  </>
                )}
                        </div>
                      );
                    })()}
                    {/* Worker chip — only renders if user has at least one worker added.
                        When clicked, opens picker. Mutual exclusion: just selecting/clearing,
                        no other state interaction. Default (null) = self-assigned. */}
                    {workersList.length > 0 && (() => {
                      const selectedWorker = workersList.find(w => w.id === newTaskWorkerId);
                      return (
                        <div style={{ position: "relative", flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => setWorkerPickerOpen(!workerPickerOpen)}
                            className={"rt-composer-pill" + (selectedWorker ? " is-filled" : "") + (pulseChip === "worker" ? " chip-pulse" : "")}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 5,
                              padding: "0 10px",
                              height: 28,
                              border: "none",
                              borderRadius: 8,
                              fontSize: 12,
                              color: selectedWorker ? C.text : C.textSec,
                              background: C.card,
                              cursor: "pointer", fontFamily: "inherit",
                              fontWeight: selectedWorker ? 600 : 500,
                            }}
                            title={selectedWorker ? `Assigned to ${selectedWorker.name}` : "Assign to a worker"}
                          >
                            <Icon name="workers" size={14} simple color={selectedWorker ? C.text : C.textMuted} />
                            <span>{selectedWorker ? selectedWorker.name.split(' ')[0] : "Worker"}</span>
                          </button>
                          {selectedWorker && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setNewTaskWorkerId(null); }}
                              style={{
                                position: "absolute",
                                top: -3, right: -3,
                                width: 16, height: 16,
                                borderRadius: 8,
                                background: C.card,
                                color: C.textMuted,
                                cursor: "pointer",
                                display: "grid", placeItems: "center",
                                padding: 0,
                              }}
                              aria-label="Clear worker"
                              title="Clear worker"
                            >
                              <Icon name="x" size={9} />
                            </button>
                          )}
                          {workerPickerOpen && (
                            <>
                              <div onClick={() => setWorkerPickerOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 49 }} />
                              <div className="rt-picker-panel" style={{
                                position: "absolute",
                                top: "calc(100% + 6px)",
                                left: 0,
                                width: 260,
                                zIndex: 50,
                              }}>
                                {/* Self-assigned (default) option */}
                                <button
                                  className={"rt-picker-item" + (!newTaskWorkerId ? " is-active" : "")}
                                  onClick={() => { setNewTaskWorkerId(null); setWorkerPickerOpen(false); }}
                                >
                                  <div style={{ width: 22, height: 22, borderRadius: 11, background: C.primary, color: "#fff", fontSize: 9, fontWeight: 700, display: "grid", placeItems: "center", flexShrink: 0 }}>
                                    {getUserInitial(user)}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: !newTaskWorkerId ? 600 : 500, color: C.text }}>Just me</div>
                                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>Default — keep on my list</div>
                                  </div>
                                </button>
                                <div className="rt-picker-divider" />
                                {workersList.map(w => (
                                  <button
                                    key={w.id}
                                    className={"rt-picker-item" + (newTaskWorkerId === w.id ? " is-active" : "")}
                                    onClick={() => { setNewTaskWorkerId(w.id); setWorkerPickerOpen(false); }}
                                  >
                                    <div style={{ width: 22, height: 22, borderRadius: 11, background: C.primary, color: "#fff", fontSize: 9, fontWeight: 700, display: "grid", placeItems: "center", flexShrink: 0 }}>
                                      {getWorkerInitials(w.name)}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontWeight: newTaskWorkerId === w.id ? 600 : 500, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.name}</div>
                                      <div style={{ fontSize: 11, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>{w.email}</div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}
                    {/* Due chip — opens date picker. Mutually exclusive with Recurring (which lives inside the menu). */}
                    <div ref={dueChipRef} style={{ position: "relative", flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => { setDuePickerOpen(!duePickerOpen); setDueShowCalendar(false); }}
                        className={"rt-composer-pill" + ((newTaskDueDate || newTaskRecurring) ? " is-filled" : "") + (pulseChip === "due" ? " chip-pulse" : "")}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "0 10px",
                          height: 28,
                          border: "none",
                          borderRadius: 8,
                          fontSize: 12,
                          color: (newTaskDueDate || newTaskRecurring) ? C.text : C.textSec,
                          background: C.card,
                          cursor: "pointer", fontFamily: "inherit",
                          fontWeight: (newTaskDueDate || newTaskRecurring) ? 600 : 500,
                        }}
                      >
                        <Icon name={newTaskRecurring ? "infinity" : "due"} size={newTaskRecurring ? 14 : 14} simple color={(newTaskDueDate || newTaskRecurring) ? C.text : C.textMuted} />
                        <span>{newTaskRecurring ? formatRecurrenceLabel(newTaskRecurrencePattern) : (newTaskDueDate ? formatDueLabel(newTaskDueDate, _todayStr, _tomorrowStr) : "Date")}</span>
                      </button>
                      {(newTaskDueDate || newTaskRecurring) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setNewTaskDueDate(null); setNewTaskRecurring(false); setNewTaskRecurrencePattern({ kind: "daily" }); }}
                          style={{
                            position: "absolute",
                            top: -3, right: -3,
                            width: 16, height: 16,
                            borderRadius: 8,
                            background: C.card,
                            color: C.textMuted,
                            cursor: "pointer",
                            display: "grid", placeItems: "center",
                            padding: 0,
                            zIndex: 1,
                          }}
                          aria-label="Clear due date"
                          title="Clear due date"
                        >
                          <Icon name="x" size={9} />
                        </button>
                      )}
                      {duePickerOpen && (
                        <>
                        <div
                          onClick={() => setDuePickerOpen(false)}
                          style={{ position: "fixed", inset: 0, zIndex: 49, background: "transparent" }}
                        />
                        <div className="rt-due-picker rt-picker-panel" style={{
                          // Position owned by CSS (.rt-due-picker): desktop
                          // anchors under the chip; mobile pins fixed above
                          // the bottom nav at full content width.
                          zIndex: 50,
                          minWidth: 240,
                          display: "flex",
                          flexDirection: "column",
                          gap: 2,
                          ...(duePickerPos ? { top: duePickerPos.top, bottom: "auto" } : {}),
                        }}>                          {(() => {
                            const _later6 = new Date(_now);
                            _later6.setDate(_later6.getDate() + 6);
                            const _later6Str = `${_later6.getFullYear()}-${String(_later6.getMonth() + 1).padStart(2, "0")}-${String(_later6.getDate()).padStart(2, "0")}`;
                            const opts = [
                              { label: "Today", value: _todayStr },
                              { label: "Tomorrow", value: _tomorrowStr },
                              { label: "Later", value: _later6Str },
                            ];
                            return (
                              <>
                                {opts.map(o => {
                                  const isSel = !newTaskRecurring && newTaskDueDate === o.value;
                                  const isLater = o.label === "Later";
                                  return (
                                    <button
                                      key={o.value}
                                      className={"rt-picker-item" + (isSel ? " is-active" : "")}
                                      onClick={() => {
                                        // On mobile, "Later" reveals the month calendar
                                        // inline instead of jumping 6 days out + closing.
                                        // Keeps the default picker compact.
                                        if (isLater && isMobile && !dueShowCalendar) {
                                          setDueShowCalendar(true);
                                          return;
                                        }
                                        setNewTaskDueDate(o.value); setNewTaskRecurring(false); setDuePickerOpen(false);
                                      }}
                                      style={{ fontWeight: isSel ? 600 : 500 }}
                                    >
                                      {o.label}
                                    </button>
                                  );
                                })}
                                {/* CALENDAR GRID — pick any date. Hidden in recurring mode.
                                    On mobile, also hidden until the user taps "Later"
                                    (dueShowCalendar) so the picker stays compact. Desktop
                                    always shows it. */}
                                {!newTaskRecurring && (!isMobile || dueShowCalendar) && (() => {
                                  const [yr, mo] = calendarMonth.split("-").map(Number);
                                  const firstOfMonth = new Date(yr, mo - 1, 1);
                                  const startDow = firstOfMonth.getDay();
                                  const daysInMonth = new Date(yr, mo, 0).getDate();
                                  const monthLabel = firstOfMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
                                  const cells = [];
                                  // pad with empty cells until first day-of-month aligns with weekday column
                                  for (let i = 0; i < startDow; i++) cells.push(null);
                                  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
                                  // pad to multiple of 7
                                  while (cells.length % 7 !== 0) cells.push(null);
                                  const goPrev = () => {
                                    let nyr = yr, nmo = mo - 1;
                                    if (nmo < 1) { nmo = 12; nyr--; }
                                    setCalendarMonth(`${nyr}-${String(nmo).padStart(2, "0")}`);
                                  };
                                  const goNext = () => {
                                    let nyr = yr, nmo = mo + 1;
                                    if (nmo > 12) { nmo = 1; nyr++; }
                                    setCalendarMonth(`${nyr}-${String(nmo).padStart(2, "0")}`);
                                  };
                                  return (
                                    <div style={{ padding: "6px 4px 2px" }}>
                                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, padding: "0 6px" }}>
                                        <button
                                          onClick={goPrev}
                                          style={{ width: 22, height: 22, border: "none", background: "transparent", color: C.textSec, cursor: "pointer", borderRadius: 4, fontSize: 14, lineHeight: 1, padding: 0 }}
                                          onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.04)"}
                                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                        >‹</button>
                                        <span style={{ fontSize: 11.5, color: C.text, fontWeight: 600, letterSpacing: 0.2 }}>{monthLabel}</span>
                                        <button
                                          onClick={goNext}
                                          style={{ width: 22, height: 22, border: "none", background: "transparent", color: C.textSec, cursor: "pointer", borderRadius: 4, fontSize: 14, lineHeight: 1, padding: 0 }}
                                          onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.04)"}
                                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                        >›</button>
                                      </div>
                                      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, padding: "0 4px 4px" }}>
                                        {["S","M","T","W","T","F","S"].map((d,i) => (
                                          <div key={i} style={{ fontSize: 9, color: C.textMuted, textAlign: "center", fontWeight: 600, padding: "2px 0" }}>{d}</div>
                                        ))}
                                        {cells.map((d, i) => {
                                          if (d === null) return <div key={i} />;
                                          const dateStr = `${yr}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                                          const isSel = newTaskDueDate === dateStr && !newTaskRecurring;
                                          const isToday = dateStr === _todayStr;
                                          return (
                                            <button
                                              key={i}
                                              onClick={() => { setNewTaskDueDate(dateStr); setNewTaskRecurring(false); setDuePickerOpen(false); }}
                                              style={{
                                                width: "100%", height: 24,
                                                border: "none",
                                                background: isSel ? "var(--rt-grad-btn)" : "transparent",
                                                color: isSel ? "#fff" : (isToday ? C.btn : C.text),
                                                borderRadius: 6,
                                                fontSize: 11,
                                                fontWeight: isToday || isSel ? 700 : 500,
                                                cursor: "pointer",
                                                fontFamily: "inherit",
                                                padding: 0,
                                                boxShadow: isSel ? "var(--rt-sh-purple)" : "none",
                                                transition: "all 160ms var(--rt-ease-out)",
                                              }}
                                              onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "rgba(0,0,0,0.06)"; }}
                                              onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
                                            >{d}</button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })()}
                                {/* Recurring option — bottom of menu, divider above. */}
                                <div className="rt-picker-divider" />
                                {!newTaskRecurring && (
                                  <button
                                    className="rt-picker-item"
                                    onClick={() => { setNewTaskRecurring(true); setNewTaskDueDate(null); }}
                                    style={{ gap: 7 }}
                                  >
                                    <Icon name="infinity" size={14} color={C.textMuted} />
                                    Recurring
                                  </button>
                                )}
                                {newTaskRecurring && (
                                  <div style={{ padding: "8px 10px 4px", display: "flex", flexDirection: "column", gap: 8 }}>
                                    <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
                                      <Icon name="infinity" size={12} color={C.btn} />
                                      Recurring
                                    </div>
                                    {/* Frequency chips — site-standard pill buttons.
                                        No borders, shadow-based active. Active: btnLight
                                        fill + purple shadow + btn text (same as Ranked
                                        by Rai active). Inactive: transparent + hover
                                        surface tint. */}
                                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                                      {[
                                        { key: "daily", label: "Daily" },
                                        { key: "weekdays", label: "Weekdays" },
                                        { key: "weekly", label: "Weekly" },
                                        { key: "monthly_date", label: "Monthly" },
                                      ].map(opt => {
                                        const isSel = newTaskRecurrencePattern.kind === opt.key
                                          || (opt.key === "monthly_date" && newTaskRecurrencePattern.kind === "monthly_weekday");
                                        return (
                                          <button
                                            key={opt.key}
                                            className={"rt-rec-chip" + (isSel ? " is-active" : "")}
                                            onClick={() => {
                                              if (opt.key === "daily") setNewTaskRecurrencePattern({ kind: "daily" });
                                              else if (opt.key === "weekdays") setNewTaskRecurrencePattern({ kind: "weekdays" });
                                              else if (opt.key === "weekly") setNewTaskRecurrencePattern({ kind: "weekly", days: [(_now.getDay())] });
                                              else if (opt.key === "monthly_date") setNewTaskRecurrencePattern({ kind: "monthly_date", day: 1 });
                                            }}
                                            style={{
                                              padding: "6px 14px",
                                              border: "none",
                                              borderRadius: 999,
                                              fontSize: 12,
                                              fontWeight: 600,
                                              cursor: "pointer",
                                              fontFamily: "inherit",
                                              ...(isSel
                                                ? { background: C.card, color: C.text, boxShadow: "var(--rt-sh-card-lift)", transform: "translateY(-0.5px)" }
                                                : { background: C.card, color: C.textSec, boxShadow: "var(--rt-sh-xs)" }),
                                            }}
                                          >
                                            {opt.label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    {/* Weekly: day-of-week multi-select — same chip
                                        language at smaller size. Circular by use of
                                        equal width/height + radius 999. */}
                                    {newTaskRecurrencePattern.kind === "weekly" && (
                                      <div style={{ display: "flex", gap: 4 }}>
                                        {["S", "M", "T", "W", "T", "F", "S"].map((label, dow) => {
                                          const days = newTaskRecurrencePattern.days || [];
                                          const isSel = days.includes(dow);
                                          return (
                                            <button
                                              key={dow}
                                              className={"rt-rec-chip" + (isSel ? " is-active" : "")}
                                              onClick={() => {
                                                const newDays = isSel
                                                  ? days.filter(d => d !== dow)
                                                  : [...days, dow];
                                                if (newDays.length === 0) return; // require at least one
                                                setNewTaskRecurrencePattern({ kind: "weekly", days: newDays });
                                              }}
                                              style={{
                                                width: 28, height: 28,
                                                border: "none",
                                                borderRadius: 999,
                                                fontSize: 11.5,
                                                fontWeight: 700,
                                                cursor: "pointer",
                                                fontFamily: "inherit",
                                                padding: 0,
                                                ...(isSel
                                                  ? { background: C.card, color: C.text, boxShadow: "var(--rt-sh-card-lift)", transform: "translateY(-0.5px)" }
                                                  : { background: C.card, color: C.textSec, boxShadow: "var(--rt-sh-xs)" }),
                                              }}
                                            >{label}</button>
                                          );
                                        })}
                                      </div>
                                    )}
                                    {/* Monthly: date OR weekday-of-month — same chip
                                        pattern. Two side-by-side pills. */}
                                    {(newTaskRecurrencePattern.kind === "monthly_date" || newTaskRecurrencePattern.kind === "monthly_weekday") && (
                                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                        <div style={{ display: "flex", gap: 5 }}>
                                          <button
                                            className={"rt-rec-chip" + (newTaskRecurrencePattern.kind === "monthly_date" ? " is-active" : "")}
                                            onClick={() => setNewTaskRecurrencePattern({ kind: "monthly_date", day: 1 })}
                                            style={{
                                              flex: 1, padding: "6px 12px",
                                              border: "none",
                                              borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                                              ...(newTaskRecurrencePattern.kind === "monthly_date"
                                                ? { background: C.card, color: C.text, boxShadow: "var(--rt-sh-card-lift)", transform: "translateY(-0.5px)" }
                                                : { background: C.card, color: C.textSec, boxShadow: "var(--rt-sh-xs)" }),
                                            }}
                                          >Date of month</button>
                                          <button
                                            className={"rt-rec-chip" + (newTaskRecurrencePattern.kind === "monthly_weekday" ? " is-active" : "")}
                                            onClick={() => {
                                              const week = Math.ceil(_now.getDate() / 7);
                                              setNewTaskRecurrencePattern({ kind: "monthly_weekday", week, day: _now.getDay() });
                                            }}
                                            style={{
                                              flex: 1, padding: "6px 12px",
                                              border: "none",
                                              borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                                              ...(newTaskRecurrencePattern.kind === "monthly_weekday"
                                                ? { background: C.card, color: C.text, boxShadow: "var(--rt-sh-card-lift)", transform: "translateY(-0.5px)" }
                                                : { background: C.card, color: C.textSec, boxShadow: "var(--rt-sh-xs)" }),
                                            }}
                                          >Day of week</button>
                                        </div>
                                        {newTaskRecurrencePattern.kind === "monthly_date" && (
                                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: C.textSec }}>
                                            On the
                                            <select
                                              value={newTaskRecurrencePattern.day}
                                              onChange={e => setNewTaskRecurrencePattern({ kind: "monthly_date", day: parseInt(e.target.value, 10) })}
                                              style={{ padding: "5px 10px", borderRadius: 7, fontSize: 12.5, fontFamily: "inherit", background: C.surfaceWarm, color: C.text, border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)" }}
                                            >
                                              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
                                            </select>
                                            of each month
                                          </div>
                                        )}
                                        {newTaskRecurrencePattern.kind === "monthly_weekday" && (
                                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: C.textSec, flexWrap: "wrap" }}>
                                            The
                                            <select
                                              value={newTaskRecurrencePattern.week}
                                              onChange={e => setNewTaskRecurrencePattern(p => ({ ...p, week: parseInt(e.target.value, 10) }))}
                                              style={{ padding: "5px 10px", borderRadius: 7, fontSize: 12.5, fontFamily: "inherit", background: C.surfaceWarm, color: C.text, border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)" }}
                                            >
                                              <option value={1}>1st</option>
                                              <option value={2}>2nd</option>
                                              <option value={3}>3rd</option>
                                              <option value={4}>4th</option>
                                              <option value={5}>5th</option>
                                            </select>
                                            <select
                                              value={newTaskRecurrencePattern.day}
                                              onChange={e => setNewTaskRecurrencePattern(p => ({ ...p, day: parseInt(e.target.value, 10) }))}
                                              style={{ padding: "5px 10px", borderRadius: 7, fontSize: 12.5, fontFamily: "inherit", background: C.surfaceWarm, color: C.text, border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)" }}
                                            >
                                              <option value={0}>Sunday</option>
                                              <option value={1}>Monday</option>
                                              <option value={2}>Tuesday</option>
                                              <option value={3}>Wednesday</option>
                                              <option value={4}>Thursday</option>
                                              <option value={5}>Friday</option>
                                              <option value={6}>Saturday</option>
                                            </select>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    {/* Cancel + Done — site-standard modal action pair.
                                        Cancel = C.surface secondary chip (matches every
                                        other modal Cancel in the app). Done = primary
                                        purple, anchored right via marginLeft auto. */}
                                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                                      <button
                                        onClick={() => { setNewTaskRecurring(false); setNewTaskRecurrencePattern({ kind: "daily" }); }}
                                        style={{ padding: "8px 14px", background: C.surface, color: C.textSec, border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                                      >Cancel</button>
                                      <button
                                        className="r-btn" data-tone="purple"
                                        onClick={() => setDuePickerOpen(false)}
                                        style={{ padding: "8px 16px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginLeft: "auto", boxShadow: "var(--rt-sh-chip-purple)" }}
                                      >Done</button>
                                    </div>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        </>
                      )}
                    </div>
                    {/* Type chip — manual override for task/touchpoint/event.
                        Lets the user override the parser's auto-detection
                        when it would miss-fire. Shows the auto-detected
                        type as the label when there's input but no
                        override; when overridden, shows the chosen type
                        with a ✓ to indicate "manually set." */}
                    <div ref={null} style={{ position: "relative", flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => setTypePickerOpen(!typePickerOpen)}
                        className={"rt-composer-pill" + ((composerTypeOverride || autoDetectedType) ? " is-filled" : "")}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "0 10px",
                          height: 28,
                          border: "none",
                          borderRadius: 8,
                          fontSize: 12,
                          color: (composerTypeOverride || autoDetectedType) ? C.text : C.textSec,
                          background: C.card,
                          cursor: "pointer", fontFamily: "inherit",
                          fontWeight: (composerTypeOverride || autoDetectedType) ? 600 : 500,
                        }}
                      >
                        {/* Always render an icon — matches the chrome of
                            the other chips (Client / Worker / Date) which
                            never hide their icon. Using `check` across all
                            states keeps the chip consistent with the
                            single-icon-per-chip pattern; the LABEL carries
                            the type distinction. */}
                        <Icon name="check" size={14} simple color={(composerTypeOverride || autoDetectedType) ? C.text : C.textMuted} />
                        <span>{
                          composerTypeOverride === "task" ? "Task" :
                          composerTypeOverride === "touchpoint" ? "Touchpoint" :
                          composerTypeOverride === "event" ? "Event" :
                          autoDetectedType === "task" ? "Task" :
                          autoDetectedType === "touchpoint" ? "Touchpoint" :
                          autoDetectedType === "event" ? "Event" :
                          "Type"
                        }</span>
                      </button>
                      {composerTypeOverride && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setComposerTypeOverride(null); }}
                          style={{
                            position: "absolute",
                            top: -3, right: -3,
                            width: 16, height: 16,
                            borderRadius: 8,
                            background: C.card,
                            color: C.textMuted,
                            cursor: "pointer",
                            display: "grid", placeItems: "center",
                            padding: 0,
                            zIndex: 1,
                          }}
                          aria-label="Clear type override"
                          title="Auto-detect type"
                        >
                          <Icon name="x" size={9} />
                        </button>
                      )}
                      {typePickerOpen && (
                        <>
                          <div
                            onClick={() => setTypePickerOpen(false)}
                            style={{ position: "fixed", inset: 0, zIndex: 49, background: "transparent" }}
                          />
                          <div className="rt-picker-panel" style={{
                            position: "absolute",
                            top: "calc(100% + 6px)",
                            right: 0,
                            minWidth: 180,
                            zIndex: 50,
                          }}>
                            {[
                              { value: "task",       label: "Task",       hint: "Something to do" },
                              { value: "touchpoint", label: "Touchpoint", hint: "Past contact, log it" },
                              { value: "event",      label: "Event",      hint: "Scheduled time" },
                            ].map(opt => {
                              const isActive = composerTypeOverride === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  onClick={() => { setComposerTypeOverride(opt.value); setTypePickerOpen(false); }}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    width: "100%",
                                    padding: "8px 10px",
                                    border: "none",
                                    background: isActive ? C.surfaceWarm : "transparent",
                                    borderRadius: 6,
                                    cursor: "pointer",
                                    fontFamily: "inherit",
                                    textAlign: "left",
                                    color: C.text,
                                  }}
                                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "rgba(20,30,22,0.04)"; }}
                                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                                >
                                  <div>
                                    <div style={{ fontSize: 13, fontWeight: 600 }}>{opt.label}</div>
                                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{opt.hint}</div>
                                  </div>
                                  {isActive && <Icon name="check" size={13} simple color={C.primary} />}
                                </button>
                              );
                            })}
                            {composerTypeOverride && (
                              <>
                                <div style={{ height: 1, background: C.borderLight, margin: "4px 0" }} />
                                <button
                                  onClick={() => { setComposerTypeOverride(null); setTypePickerOpen(false); }}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    width: "100%",
                                    padding: "7px 10px",
                                    border: "none",
                                    background: "transparent",
                                    borderRadius: 6,
                                    cursor: "pointer",
                                    fontFamily: "inherit",
                                    fontSize: 12,
                                    color: C.textMuted,
                                    textAlign: "left",
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = "rgba(20,30,22,0.04)"}
                                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                >
                                  Auto-detect type
                                </button>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                    {/* Brain Dump — dump a call's worth of notes; Rai fans
                        them into tasks/touchpoints/events for review. */}
                    <button
                      onClick={() => setBrainDumpOpen(true)}
                      className="rt-composer-pill"
                      title="Brain Dump — paste your call notes, Rai sorts them into tasks"
                      style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0 }}
                    >
                      <Icon name="sparkles" size={12} simple color={C.textSec} />
                      <span className="rt-row-text">Brain Dump</span>
                    </button>
                    {/* Spacer pushes the Add button to the right edge of
                        the chips row. Previously held the "Past tense →
                        touchpoint" hint — removed as training-wheels text;
                        the readout below the input now confirms intent. */}
                    <div style={{ marginLeft: "auto", flex: 1 }} />
                    <button
                      onClick={submitComposer}
                      disabled={!newTask.trim()}
                      className="rt-add-task-btn"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "0 14px",
                        height: 28,
                        borderRadius: 999,
                        border: "none",
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: "inherit",
                        flexShrink: 0,
                        cursor: newTask.trim() ? "pointer" : "default",
                        // Two-state treatment: at rest = warm-neutral box with
                        // no shadow. When armed = full purple gradient + the
                        // standard --rt-sh-purple shadow (matches Add Client,
                        // Discuss, and every other primary purple CTA in the
                        // app). Previously used --rt-sh-rai-pop which had a
                        // 32px halo bleed at rest — hover-tier intensity for
                        // a non-hover state. Now consistent: gradient marks
                        // the button as primary, hover adds the lift + halo.
                        background: newTask.trim() ? "#33543E" : C.surfaceWarm,
                        color: newTask.trim() ? "#fff" : C.textMuted,
                        boxShadow: newTask.trim() ? "0 1px 2px rgba(20,30,22,0.10), 0 2px 6px rgba(51,84,62,0.25)" : "none",
                        transition: "all 220ms var(--rt-ease-out)",
                      }}
                    >
                      {newTask.trim() && <span style={{ fontSize: 13, lineHeight: 1, opacity: 0.9 }}>⏎</span>}
                      Add
                    </button>
                  </div>
                </div>

                {/* V5 readout — appears AFTER user pauses typing for 400ms,
                    only when the parser has detected at least one entity.
                    Smart-silence pairing with the ghost: ghost during
                    typing, readout during pause; they never both show.
                    Echoes Rai's voice via Fraunces italic. */}
                {(() => {
                  if (!composerInPause) return null;
                  const readout = computeComposerReadout(newTask);
                  if (!readout) return null;
                  const kindNoun = readout.kind === "event" ? "an event"
                    : readout.kind === "touchpoint" ? "a touchpoint"
                    : "a task";
                  const clientPart = readout.client ? (
                    <> for <strong style={{ color: "#2E6B4F", fontWeight: 600 }}>{readout.client.name}</strong></>
                  ) : null;
                  let datePart = null;
                  if (readout.recurrence) {
                    datePart = <>, <strong style={{ color: "#8A5C2A", fontWeight: 600 }}>recurring</strong></>;
                  } else if (readout.date && readout.date.date) {
                    const dYmd = dateToYmd(readout.date.date);
                    const dLabel = formatDueLabel(dYmd, _todayStr, _tomorrowStr);
                    datePart = <>, <strong style={{ color: "#8A5C2A", fontWeight: 600 }}>{readout.kind === "touchpoint" ? dLabel.toLowerCase() : ("due " + dLabel.toLowerCase())}</strong></>;
                  } else if (readout.kind === "task" || readout.kind === "event") {
                    datePart = <>, <span style={{ color: "#A8A89A", fontStyle: "italic" }}>no date yet</span></>;
                  }
                  // Character counter — reflects the PARSED title length
                  // (what actually saves), not the raw input. So typing
                  // "@SprintRay tomorrow" doesn't burn 19 chars when the
                  // saved title is empty. Cap is 75; counter turns muted
                  // amber over 60 and red at the cap.
                  const TITLE_CAP = 75;
                  const parsedForCount = parseComposer(newTask, clients, workersList);
                  const savedTitle = (parsedForCount.title || newTask).trim();
                  const charsLeft = TITLE_CAP - savedTitle.length;
                  const counterColor = charsLeft < 0
                    ? "#A03422"
                    : charsLeft <= 15
                      ? "#8A5C2A"
                      : "#A8A89A";
                  // Only render the counter for TASK kind. Events and
                  // touchpoints aren't subject to the same length cap.
                  const showCounter = readout.kind === "task";
                  return (
                    <div style={{
                      padding: "6px 16px 12px 54px",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 12,
                      color: "#6B6B66",
                      animation: "rt-readout-fade-in 180ms var(--rt-ease-out)",
                    }}>
                      <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontStyle: "italic", color: "#8A8F8A" }}>Becomes</span>
                      <span>→ {kindNoun}{clientPart}{datePart}</span>
                      {showCounter && (
                        <span style={{ marginLeft: "auto", fontSize: 11, color: counterColor, fontVariantNumeric: "tabular-nums" }}>
                          {savedTitle.length}/{TITLE_CAP}
                        </span>
                      )}
                    </div>
                  );
                })()}

              </div>

              {/* TASKS COLUMN */}
              <div className="rt-tasks-col" data-focus-keep style={{ gridArea: "tasks", minWidth: 0, paddingTop: 12 }}>
                  {/* (Removed: rt-toolbar — the segmented control + Focus
                      button row. Mode selector and Focus link moved INTO
                      the "Today" bucket header per option #5 of the
                      segmented-control redesign.) */}

                  {/* (Removed: legacy rt-mob-cal-trigger button — display:none,
                      replaced by the band-level trigger above.) */}

                  {/* (Removed: dead TodayTimeline render — the old calendar
                      widget. Its wrapper .rt-mob-cal-sheet was display:none on
                      desktop AND forced display:none on mobile, so it never
                      rendered in any viewport. Replaced by MobileCalendarStrip
                      (the band) on mobile and the TimeDial on desktop.) */}

                  {dataLoaded && openTasks.length === 0 && completedTasks.length === 0 && (
                    <div style={{ padding: "40px 4px 28px", borderTop: "1px solid " + C.borderLight, textAlign: "center" }}>
                      <div style={{
                        fontFamily: "'Fraunces', Georgia, serif",
                        fontVariationSettings: "'opsz' 96, 'SOFT' 50, 'WONK' 0",
                        fontStyle: "italic",
                        fontWeight: 500,
                        fontSize: 22,
                        letterSpacing: "-0.015em",
                        color: C.text,
                        marginBottom: 8,
                      }}>
                        Nothing on the list yet.
                      </div>
                      <div style={{
                        fontFamily: "'Fraunces', Georgia, serif",
                        fontVariationSettings: "'opsz' 96, 'SOFT' 50, 'WONK' 0",
                        fontStyle: "italic",
                        fontWeight: 500,
                        fontSize: 14,
                        lineHeight: 1.55,
                        color: C.textSec,
                        maxWidth: 380,
                        margin: "0 auto",
                      }}>
                        Add the first one — a call, a check-in, a thing you've been meaning to do. I'll pick up from there.
                      </div>
                    </div>
                  )}

                  {/* TASK LIST — three buckets: Today / Tomorrow / Later
                      Within each bucket, assigned tasks (delegated to a worker)
                      sort to the BOTTOM. Operator's own tasks (no assignment)
                      keep their existing order (Rai ranking or manual). */}
                  {(() => {
                    // Stable partition: unassigned first (preserving order), then assigned (preserving order).
                    const partitionByAssignment = (arr) => {
                      const unassigned = arr.filter(t => !t.assigned_worker_id);
                      const assigned = arr.filter(t => !!t.assigned_worker_id);
                      return [...unassigned, ...assigned];
                    };
                    const _todayBucket = partitionByAssignment(renderTasks.filter(t => bucketOf(t) === "today" && !collapsedDoneIds[t.id]));
                    topTaskIdRef.current = _todayBucket[0]?.id ?? null;
                    const _tomorrowBucket = partitionByAssignment(
                      renderTasks.filter(t => bucketOf(t) === "tomorrow" && !collapsedDoneIds[t.id])
                        .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""))
                    );
                    const _laterBucket = partitionByAssignment(
                      renderTasks.filter(t => bucketOf(t) === "later" && !collapsedDoneIds[t.id])
                        .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""))
                    );
                    // Tasks that were completed and have collapsed out of the active list.
                    // They appear in the "Completed today" group below all buckets.
                    // Tasks that were completed and have collapsed out of the active list.
                    // Sorted newest-completed first — the log answers "what did I just do?"
                    // so the most recent action belongs at the top. Falls back to completed_at
                    // from the DB for tasks that were already done before this session loaded
                    // (the seeded ones from initial load); falls back to ID order for legacy
                    // tasks with no timestamp at all.
                    const _collapsedDoneTasks = renderTasks
                      .filter(t => collapsedDoneIds[t.id])
                      .sort((a, b) => {
                        const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0;
                        const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0;
                        if (aTime !== bTime) return bTime - aTime;
                        // Tie-breaker: stable by id so render order doesn't shuffle on every render
                        return String(b.id).localeCompare(String(a.id));
                      });

                    // Inline row renderer — captures bucketKey so the push button knows direction.
                    const renderRow = (t, bucketKey) => {
                        const client = clients.find(c => c.name === t.client);
                        const isDone = !!t.done;
                        const isJustDone = !!justCompletedIds[t.id];
                        const isManual = rankMode === "manual";
                        const isDragging = draggingTaskId === t.id;
                        const isDragOver = dragOverTaskId === t.id && draggingTaskId !== t.id;
                        // Focus target: first incomplete task in priority order, falling
                        // through buckets. Today first, then Tomorrow, then Later. This way
                        // focus mode always has something to lock onto if any incomplete
                        // task exists anywhere — even if today's bucket is empty (all done).
                        const focusTopId = (() => {
                          for (const bucket of ["today", "tomorrow", "later"]) {
                            const t = renderTasks.find(rt => !rt.done && bucketOf(rt) === bucket);
                            if (t) return t.id;
                          }
                          return null;
                        })();
                        const isFocusTop = focusMode && t.id === focusTopId;
                        // Rai's client-of-the-day: every task assigned to the boosted
                        // client gets the purple inset bar + ✦ medallion. Client-level
                        // designation, not task-level — see UX spec.
                        const raiBoostClient = (() => {
                          if (!raiPicks || !raiPicks.client_id) return null;
                          return clients.find(c => c.id === raiPicks.client_id) || null;
                        })();
                        const isRaiBoosted = !!t.ai;
                        const cls = "rt-row" + (isDone ? " is-done" : "") + (isJustDone ? " is-just-done" : "") + (isFocusTop ? " rt-focus-top" : "") + (isRaiBoosted ? " rt-rai-boost" : "");
  
                        // Reorder handler: when dropping onto target, move dragging task to target's position
                        const handleDrop = (e) => {
                          e.preventDefault();
                          if (!draggingTaskId || draggingTaskId === t.id) {
                            setDraggingTaskId(null);
                            setDragOverTaskId(null);
                            return;
                          }
                          // Build current order from renderTasks (current visual order)
                          const currentOrder = renderTasks.map(rt => rt.id);
                          const fromIdx = currentOrder.indexOf(draggingTaskId);
                          const toIdx = currentOrder.indexOf(t.id);
                          if (fromIdx === -1 || toIdx === -1) {
                            setDraggingTaskId(null);
                            setDragOverTaskId(null);
                            return;
                          }
                          const newOrder = [...currentOrder];
                          newOrder.splice(fromIdx, 1);
                          newOrder.splice(toIdx, 0, draggingTaskId);
                          setManualTaskOrder(newOrder);
                          setDraggingTaskId(null);
                          setDragOverTaskId(null);
                        };
  
                        const offset = swipeOffset[t.id] || 0;
                        const SWIPE_THRESHOLD = 90;
                        const SWIPE_MAX = 130;
                        // Industry-standard gesture defaults (iOS Mail / Things / Linear):
                        //   DEAD_ZONE — finger must travel this many px before any
                        //     row movement begins. Filters micro-jitter from finger
                        //     contact + small horizontal drift while scrolling.
                        //   ANGLE_RATIO — once the gesture passes the dead zone, we
                        //     measure horizontal vs vertical travel. If vertical is
                        //     greater (i.e. user is scrolling up/down), we lock the
                        //     gesture as "scroll" and never translate the row for
                        //     this touch. If horizontal wins, we lock as "swipe"
                        //     and process the remainder normally.
                        // The lock holds until touchEnd. This prevents the row from
                        // accidentally tracking sideways while the user is just
                        // scrolling the task list.
                        const DEAD_ZONE = 12;
                        const ANGLE_RATIO = 1.0; // dx must exceed dy to commit to swipe

                        const handleTouchStart = (e) => {
                          if (e.touches.length !== 1) return;
                          setSwipeStartX(prev => ({ ...prev, [t.id]: e.touches[0].clientX }));
                          // Stash startY in a ref-like field on the same map so we
                          // don't need a second state hook just for this.
                          setSwipeStartY(prev => ({ ...prev, [t.id]: e.touches[0].clientY }));
                          setSwipeLock(prev => ({ ...prev, [t.id]: null })); // null = undecided
                          setSwipeOffset(prev => ({ ...prev, [t.id]: 0 }));
                        };
                        const handleTouchMove = (e) => {
                          const startX = swipeStartX[t.id];
                          const startY = swipeStartY[t.id];
                          if (startX == null || startY == null) return;
                          const deltaX = e.touches[0].clientX - startX;
                          const deltaY = e.touches[0].clientY - startY;

                          // Look up our current lock state. If we already decided
                          // this gesture is a vertical scroll, do nothing (let the
                          // page handle it).
                          const lock = swipeLock[t.id];
                          if (lock === "scroll") return;

                          if (lock !== "swipe") {
                            // Still undecided — apply the dead zone + angle test.
                            const absX = Math.abs(deltaX);
                            const absY = Math.abs(deltaY);
                            if (Math.max(absX, absY) < DEAD_ZONE) return; // not enough travel yet
                            if (absY * ANGLE_RATIO >= absX) {
                              // Vertical wins → lock as scroll, never move the row.
                              setSwipeLock(prev => ({ ...prev, [t.id]: "scroll" }));
                              return;
                            }
                            // Horizontal wins → lock as swipe and proceed.
                            setSwipeLock(prev => ({ ...prev, [t.id]: "swipe" }));
                          }

                          // Recurring tasks can be deleted (left swipe) but not pushed
                          // to another bucket (right swipe blocked — they have no due_date
                          // and the bucket concept doesn't apply).
                          const minDelta = t.recurring ? -SWIPE_MAX : -SWIPE_MAX;
                          const maxDelta = t.recurring ? 0 : SWIPE_MAX;
                          // Subtract the dead zone from the displayed offset so the
                          // row starts at 0 visually when the swipe is just-committed,
                          // not at +/- DEAD_ZONE (which would be a visual jump).
                          const adjustedDelta = deltaX > 0
                            ? Math.max(0, deltaX - DEAD_ZONE)
                            : Math.min(0, deltaX + DEAD_ZONE);
                          const clamped = Math.max(minDelta, Math.min(maxDelta, adjustedDelta));
                          setSwipeOffset(prev => ({ ...prev, [t.id]: clamped }));
                        };
                        const handleTouchEnd = () => {
                          const off = swipeOffset[t.id] || 0;
                          // Always clear the lock + startY on end so the next touch
                          // starts fresh.
                          setSwipeStartY(prev => { const n = { ...prev }; delete n[t.id]; return n; });
                          setSwipeLock(prev => { const n = { ...prev }; delete n[t.id]; return n; });
                          if (off <= -SWIPE_THRESHOLD) {
                            // Left swipe past threshold → DELETE the task. Slide off-screen left, then remove.
                            setSwipeOffset(prev => ({ ...prev, [t.id]: -SWIPE_MAX }));
                            // Phase 9: if Rai task, open feedback modal; the
                            // actual delete is deferred to the modal's confirm.
                            // For non-Rai tasks, openDismissFlow runs the
                            // delete immediately (no modal).
                            const performDelete = () => {
                              purgeTaskHistory(t.id);
                              setTasks(prev => prev.filter(t2 => t2.id !== t.id));
                              tasksDb.delete(t.id);
                              setSwipeOffset(prev => { const n = { ...prev }; delete n[t.id]; return n; });
                              setSwipeStartX(prev => { const n = { ...prev }; delete n[t.id]; return n; });
                            };
                            // Wait for the slide-off animation before deleting
                            // when no modal will appear. If a modal opens, the
                            // delete waits on user confirm — and the swipe
                            // visual stays at -SWIPE_MAX until they decide.
                            if (t.ai && t.rai_suggestion_id) {
                              openDismissFlow(t, performDelete);
                            } else {
                              setTimeout(performDelete, 180);
                            }
                          } else if (off >= SWIPE_THRESHOLD && !t.recurring) {
                            // Right swipe past threshold → PUSH to next bucket. Recurring tasks
                            // skip this branch — they don't move between buckets.
                            setSwipeOffset(prev => ({ ...prev, [t.id]: SWIPE_MAX }));
                            setTimeout(() => {
                              if (bucketKey === "today") pushToTomorrow(t.id);
                              else if (bucketKey === "tomorrow") pushToLater(t.id);
                              else if (bucketKey === "later") pullToToday(t.id);
                              setSwipeOffset(prev => { const n = { ...prev }; delete n[t.id]; return n; });
                              setSwipeStartX(prev => { const n = { ...prev }; delete n[t.id]; return n; });
                            }, 180);
                          } else {
                            // Snap back
                            setSwipeOffset(prev => ({ ...prev, [t.id]: 0 }));
                            setSwipeStartX(prev => { const n = { ...prev }; delete n[t.id]; return n; });
                          }
                        };

                        // Action label per bucket — shown when swiping right (push)
                        const swipeActionLabel = bucketKey === "today" ? "Tomorrow"
                          : bucketKey === "tomorrow" ? "Later"
                          : "Today";

                        // Swipeable = any task that's not done. Recurring is allowed
                        // (left-swipe delete works); right-swipe push is gated separately
                        // in handleTouchEnd.
                        const swipeable = !isDone;

                        const isExiting = !!exitingDoneIds[t.id];

                        return (
                          <div key={t.id} className={"rt-row-wrap" + (isFocusTop && focusMode ? " rt-focus-top-wrap" : "") + (isExiting ? " is-exiting" : "")} style={{ position: "relative", borderRadius: 12, overflow: offset !== 0 ? "hidden" : "visible", zIndex: rowDuePickerId === t.id ? 500 : undefined }}>
                            {/* Swipe action background. Two directions:
                                - LEFT (offset < 0): red bg with delete signal. Row sliding left = delete.
                                - RIGHT (offset > 0): purple bg with destination bucket. Row sliding right = push.
                                Only renders when actively swiping. */}
                            {swipeable && offset < 0 && (
                              <div style={{
                                position: "absolute",
                                inset: 0,
                                background: C.danger,
                                borderRadius: 12,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "flex-end",
                                paddingRight: 22,
                                gap: 8,
                                color: "#fff",
                                fontSize: 13,
                                fontWeight: 600,
                                pointerEvents: "none",
                              }}>
                                <span>Delete</span>
                              </div>
                            )}
                            {swipeable && offset > 0 && (
                              <div style={{
                                position: "absolute",
                                inset: 0,
                                background: C.btn,
                                borderRadius: 12,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "flex-start",
                                paddingLeft: 22,
                                gap: 8,
                                color: "#fff",
                                fontSize: 13,
                                fontWeight: 600,
                                pointerEvents: "none",
                              }}>
                                <span>{swipeActionLabel}</span>
                              </div>
                            )}
                          <div
                            className={cls}
                            data-task-id={t.id}
                            draggable={isManual}
                            onDragStart={isManual ? (e) => {
                              setDraggingTaskId(t.id);
                              try { e.dataTransfer.effectAllowed = "move"; } catch {}
                            } : undefined}
                            onDragOver={isManual ? (e) => {
                              e.preventDefault();
                              if (draggingTaskId && draggingTaskId !== t.id) setDragOverTaskId(t.id);
                            } : undefined}
                            onDragLeave={isManual ? () => {
                              if (dragOverTaskId === t.id) setDragOverTaskId(null);
                            } : undefined}
                            onDrop={isManual ? handleDrop : undefined}
                            onDragEnd={isManual ? () => {
                              setDraggingTaskId(null);
                              setDragOverTaskId(null);
                            } : undefined}
                            onTouchStart={swipeable ? handleTouchStart : undefined}
                            onTouchMove={swipeable ? handleTouchMove : undefined}
                            onTouchEnd={swipeable ? handleTouchEnd : undefined}
                            onTouchCancel={swipeable ? handleTouchEnd : undefined}
                            style={{
                              display: "flex", alignItems: "center", gap: 12,
                              padding: "9px 14px",
                              background: C.card,
                              borderRadius: 12,
                              boxShadow: isDragOver ? "0 0 0 2px " + C.btnLight + ", var(--rt-sh-row-hover)" : "var(--rt-sh-row)",
                              opacity: isDragging ? 0.4 : 1,
                              cursor: isManual ? "grab" : "default",
                              transform: offset !== 0 ? `translateX(${offset}px)` : undefined,
                              transition: swipeStartX[t.id] != null
                                ? "box-shadow 200ms var(--rt-ease-out), opacity 120ms"
                                : "box-shadow 200ms var(--rt-ease-out), opacity 120ms, transform 200ms var(--rt-ease-out)",
                              touchAction: swipeable ? "pan-y" : "auto",
                              position: "relative",
                              zIndex: 2,
                            }}>
                            {isManual && (
                              <div
                                aria-hidden="true"
                                onTouchStart={(e) => {
                                  // Mobile drag-to-reorder: initiate from grip only.
                                  // Stops touch-start from propagating to row swipe handlers
                                  // (left/right swipe = complete/delete).
                                  e.stopPropagation();
                                  setDraggingTaskId(t.id);
                                }}
                                onTouchMove={(e) => {
                                  if (!draggingTaskId) return;
                                  e.preventDefault();
                                  e.stopPropagation();
                                  // Find which task row sits under the current touch point.
                                  // Walks up the DOM looking for a [data-task-id] ancestor.
                                  const touch = e.touches[0];
                                  if (!touch) return;
                                  let el = document.elementFromPoint(touch.clientX, touch.clientY);
                                  while (el && !el.dataset?.taskId) el = el.parentElement;
                                  const overId = el?.dataset?.taskId;
                                  if (overId && overId !== draggingTaskId && overId !== dragOverTaskId) {
                                    setDragOverTaskId(overId);
                                  }
                                }}
                                onTouchEnd={(e) => {
                                  if (!draggingTaskId) return;
                                  e.stopPropagation();
                                  // Commit reorder using the same logic as desktop drop.
                                  const targetId = dragOverTaskId;
                                  if (targetId && targetId !== draggingTaskId) {
                                    const currentOrder = renderTasks.map(rt => rt.id);
                                    const fromIdx = currentOrder.indexOf(draggingTaskId);
                                    const toIdx   = currentOrder.indexOf(targetId);
                                    if (fromIdx !== -1 && toIdx !== -1) {
                                      const newOrder = [...currentOrder];
                                      newOrder.splice(fromIdx, 1);
                                      newOrder.splice(toIdx, 0, draggingTaskId);
                                      setManualTaskOrder(newOrder);
                                    }
                                  }
                                  setDraggingTaskId(null);
                                  setDragOverTaskId(null);
                                }}
                                onTouchCancel={() => {
                                  setDraggingTaskId(null);
                                  setDragOverTaskId(null);
                                }}
                                style={{
                                  color: C.textMuted,
                                  fontSize: 14,
                                  lineHeight: 1,
                                  letterSpacing: "-1px",
                                  userSelect: "none",
                                  flexShrink: 0,
                                  cursor: "grab",
                                  padding: "0 2px",
                                  touchAction: "none",
                                }}>
                                ⋮⋮
                              </div>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleTask(t.id); }}
                              aria-label={isDone ? "mark incomplete" : "mark complete"}
                              className="rt-check"
                              style={{
                                width: 22, height: 22, borderRadius: 6, border: "2px solid " + C.border,
                                background: C.card, display: "flex", alignItems: "center", justifyContent: "center",
                                flexShrink: 0, cursor: "pointer", padding: 0,
                              }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </button>
  
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {/* [Removed Jun 2026] "Rai's pick" per-task badge —
                                  deprecated alongside the badge state manager. Picks
                                  are now client-level only. */}
                              <div style={{ fontSize: 14, fontWeight: 500, color: C.text, lineHeight: 1.25, paddingBottom: 2, overflow: "hidden", display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                                {/* Inline Rai star — sits immediately before
                                    the task title text on AI-suggested rows.
                                    Replaces the previous bobbing-medallion
                                    treatment (which read as "AI chrome"). The
                                    star is a typographic mark, not a UI
                                    decoration: same SVG as the Task & Rank
                                    label so the symbol carries consistent
                                    meaning across the app. Drops to muted
                                    grey when the task is done so completed
                                    rows don't visually demand attention. */}
                                {t.ai && (
                                  <svg
                                    width="13"
                                    height="13"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    aria-label="Suggested by Rai"
                                    style={{
                                      display: "block",
                                      flexShrink: 0,
                                    }}
                                  >
                                    <path
                                      d="M12 4l2.2 5.8 5.8 2.2-5.8 2.2L12 20l-2.2-5.8L4 12l5.8-2.2L12 4z"
                                      fill={isDone ? C.textMuted : "#7c5cf3"}
                                    />
                                  </svg>
                                )}
                                {(() => {
                                  // Title is interactive when the text contains a thinking
                                  // verb AND has a client tag AND task isn't done. Click
                                  // opens the Rai chat page with task + client preloaded.
                                  const isDiscussable = !isDone && client && detectThinkingVerb(t.text);
                                  // #3 — inline edit: when this task is being edited,
                                  // swap the title for a text input.
                                  if (editingTaskId === t.id) {
                                    return (
                                      <input
                                        autoFocus
                                        value={editingTaskText}
                                        onChange={(e) => setEditingTaskText(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") { e.preventDefault(); commitTaskEdit(); }
                                          else if (e.key === "Escape") { e.preventDefault(); cancelTaskEdit(); }
                                        }}
                                        onBlur={commitTaskEdit}
                                        className="rt-task-title-edit"
                                        style={{ width: "100%", font: "inherit", fontSize: 14, fontWeight: 500, color: C.text, background: C.card, border: "1px solid " + C.btnLight, borderRadius: 6, padding: "2px 6px", outline: "none", boxShadow: "0 0 0 3px rgba(124,92,243,0.12)" }}
                                      />
                                    );
                                  }
                                  // Long-press (mobile) → edit. Pointer-based so it
                                  // works on touch; cancelled on move/up before the
                                  // threshold. Double-click handles desktop.
                                  const lpStart = () => { longPressTimerRef.current = setTimeout(() => beginTaskEdit(t), 500); };
                                  const lpCancel = () => { if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; } };
                                  if (isDiscussable) {
                                    return (
                                      <span
                                        className="rt-task-title is-discussable"
                                        title={`${t.text}\n\nClick to talk this through with Rai · double-click to edit`}
                                        onDoubleClick={(e) => { e.stopPropagation(); beginTaskEdit(t); }}
                                        onPointerDown={lpStart}
                                        onPointerUp={lpCancel}
                                        onPointerMove={lpCancel}
                                        onPointerLeave={lpCancel}
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          // Open chat with full client context preloaded — 14
                                          // days of tasks + touchpoints + the why behind any
                                          // AI suggestion + the most recent daily brief that
                                          // mentioned this client. Cost is trivial (a few
                                          // hundred input tokens per chat opened).
                                          setAiConvoId(null);
                                          // Reset to a temporary "loading" greeting so the
                                          // chat opens immediately instead of blocking on
                                          // the fetch. The real greeting + context replace
                                          // this once the data lands.
                                          setAiMessages([{
                                            role: "ai",
                                            text: `Pulling up what I know about ${client.name}…`,
                                          }]);
                                          setPage("coach");
                                          // Fetch the per-client data we don't already have
                                          // in component state. Touchpoints aren't kept in
                                          // state (too volatile to memo); fetch per-client.
                                          // The suggestion lookup is conditional — only AI
                                          // tasks carry rai_suggestion_id.
                                          let touchpointList = [];
                                          let suggestion = null;
                                          try {
                                            const tpRes = await touchpointsDb.listForClient(client.id);
                                            touchpointList = tpRes?.data || [];
                                          } catch (err) {
                                            console.warn("touchpoints fetch failed for chat preload:", err);
                                          }
                                          if (t.ai && t.rai_suggestion_id) {
                                            try {
                                              const { data: sug } = await supabase
                                                .from("rai_suggestions")
                                                .select("title, why, signal")
                                                .eq("id", t.rai_suggestion_id)
                                                .maybeSingle();
                                              suggestion = sug || null;
                                            } catch (err) {
                                              console.warn("suggestion fetch failed for chat preload:", err);
                                            }
                                          }
                                          // recentPick: only include if THIS client is the
                                          // anchor of the most recent brief (avoid loading
                                          // unrelated brief text into the chat).
                                          const recentPick = (raiPicks && raiPicks.client_id === client.id)
                                            ? raiPicks
                                            : null;
                                          // Architectural fix (Jun 6 2026): we no longer
                                          // build a frontend-side observationContext string
                                          // and forge it into chat history. Instead, set
                                          // focusedTaskId — the edge function fetches the
                                          // task + 30d activity signature + workflow profile
                                          // + suggestion + recent pick server-side and
                                          // injects them as a structured context block.
                                          // The old buildTaskDiscussionContext was capped at
                                          // 14d + 20 tasks + 15 touchpoints from frontend
                                          // state (touchpoints-and-tasks only — no calendar,
                                          // observations, health checks). The server-side
                                          // fetch reads the full picture.
                                          void touchpointList;
                                          void suggestion;
                                          void recentPick;
                                          setFocusedTaskId(t.id);
                                          // Decide the auto-fire user message based on the verb
                                          // family. Composition verbs (write/draft/send/recap)
                                          // → ask Rai to produce the artifact. Analysis verbs
                                          // (analyze/review/assess) → ask her to walk through.
                                          // Deliberation verbs (decide/plan/strategize) → ask
                                          // her to help decide. The detected verb already came
                                          // from THINKING_VERBS up top; map it to an intent.
                                          const verb = (detectThinkingVerb(t.text) || "").toLowerCase();
                                          const COMPOSITION = new Set([
                                            "write","draft","compose","send","prepare","propose",
                                            "outline","recap","summarize","brief","pitch","frame","prep",
                                          ]);
                                          const ANALYSIS = new Set([
                                            "analyze","assess","evaluate","review","read","check",
                                          ]);
                                          let autoMsg;
                                          if (COMPOSITION.has(verb)) {
                                            autoMsg = "Draft this for me.";
                                          } else if (ANALYSIS.has(verb)) {
                                            autoMsg = "Walk me through this.";
                                          } else {
                                            // Deliberation default: decide / figure out / plan /
                                            // strategize / approach / think through
                                            autoMsg = "Help me think this through.";
                                          }
                                          // Clear the loading bubble — we want Rai's response to
                                          // arrive RIGHT AFTER the user's auto-fired message, not
                                          // after the placeholder. The useEffect picks up the ref
                                          // once observationContext + aiMessages have flushed.
                                          setAiMessages([]);
                                          pendingAutoSendRef.current = autoMsg;
                                          // Title this chat from the task (+ client) instead of
                                          // the generic autoMsg, so the RECENT list is scannable
                                          // ("Send Janet the Q3 report · Acme" not "Draft this
                                          // for me."). Trimmed to a sane length downstream.
                                          {
                                            const taskText = (t.text || "").trim();
                                            const cli = (t.client_name || client?.name || "").trim();
                                            pendingAutoTitleRef.current = taskText
                                              ? (cli ? `${taskText} · ${cli}` : taskText)
                                              : null;
                                          }
                                        }}
                                        style={{ display: "inline-block", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom" }}
                                      >
                                        {t.text}
                                      </span>
                                    );
                                  }
                                  return <span
                                    className="rt-task-title"
                                    title={isDone ? t.text : `${t.text}\n\nDouble-click to edit`}
                                    onDoubleClick={(e) => { e.stopPropagation(); beginTaskEdit(t); }}
                                    onPointerDown={lpStart}
                                    onPointerUp={lpCancel}
                                    onPointerMove={lpCancel}
                                    onPointerLeave={lpCancel}
                                    style={{ display: "inline-block", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom" }}
                                  >{t.text}</span>;
                                })()}
                              </div>
                              <div className="rt-row-meta" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: C.ink500, marginTop: 2, minWidth: 0 }}>
                                {client
                                  ? <div className="rt-task-avatar" style={{ display: "flex", flexShrink: 0 }}><ClientAvatar client={client} size={16} /></div>
                                  : <div className="rt-task-avatar" style={{ width: 16, height: 16, borderRadius: 8, background: C.borderSoft, flexShrink: 0 }} />}
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{client ? client.name : "N/A"}</span>
                                {t.notes && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setOpenNoteId(openNoteId === t.id ? null : t.id); }}
                                    title={openNoteId === t.id ? "Hide note" : "Show note"}
                                    style={{
                                      display: "inline-flex", alignItems: "center",
                                      border: "none", cursor: "pointer", flexShrink: 0,
                                      padding: "1px 7px", borderRadius: 999,
                                      fontSize: 10, fontWeight: 700, fontFamily: "inherit",
                                      letterSpacing: "0.03em",
                                      background: openNoteId === t.id ? "rgba(51,84,62,0.10)" : C.card,
                                      color: openNoteId === t.id ? "#33543E" : C.textMuted,
                                      boxShadow: "var(--rt-sh-xs)",
                                    }}
                                  >Note</button>
                                )}
                                {debugScores && client && (() => {
                                  const psFloat = calcProfileScore(client.ret || 50, client, clients);
                                  const psRaw = calcProfileScoreRaw(client.ret || 50, client, clients);
                                  const totalRev = clients.reduce((a, x) => a + (x.revenue || 0), 0);
                                  const revPct = totalRev > 0 ? (client.revenue || 0) / totalRev : 0;
                                  const newBoost = calcNewClientBoost(client.ret || 50, revPct, client.daysOld != null ? client.daysOld : 999);
                                  const raiBoost = t.raiPriority ? getRaiBoost(psFloat) : 0;
                                  const nudge = client.raiNudge || 0;
                                  const finalScore = Math.min(99, psFloat + newBoost + raiBoost + nudge);
                                  return (
                                    <span style={{
                                      fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                                      fontSize: 10,
                                      fontWeight: 600,
                                      padding: "2px 6px",
                                      borderRadius: 4,
                                      background: "#FEF3C7",
                                      color: "#7C2D12",
                                      border: "1px solid #FDE68A",
                                      flexShrink: 0,
                                      whiteSpace: "nowrap",
                                    }}>
                                      ret:{client.ret} raw:{psRaw} ps:{psFloat.toFixed(1)} nb:{newBoost} rai:{raiBoost} nudge:{nudge >= 0 ? "+" : ""}{nudge} → <b>{finalScore.toFixed(1)}</b>
                                    </span>
                                  );
                                })()}
                              </div>
                              {/* [Removed Jun 2026] "Rai's pick" reason text — deprecated
                                  alongside the per-task badge. Pick reasons still render
                                  at the client level via the daily brief surface. */}
                              {/* Task note — the long-form body behind the short title.
                                  Brain Dump populates it; double-click to edit (same
                                  muscle memory as title editing). */}
                              {t.notes && openNoteId === t.id && (
                                editingNoteId === t.id ? (
                                  <textarea
                                    autoFocus
                                    defaultValue={t.notes}
                                    onClick={(e) => e.stopPropagation()}
                                    onBlur={async (e) => {
                                      const v = e.target.value.trim();
                                      setEditingNoteId(null);
                                      if (v === (t.notes || "")) return;
                                      setTasks(prev => prev.map(x => x.id === t.id ? { ...x, notes: v || null } : x));
                                      try { await tasksDb.setNotes(t.id, v || null); } catch (err) { console.warn("setNotes failed:", err); }
                                    }}
                                    onKeyDown={(e) => { if (e.key === "Escape") setEditingNoteId(null); }}
                                    style={{ width: "100%", boxSizing: "border-box", marginTop: 6, minHeight: 52, border: "1px solid " + C.borderLight, borderRadius: 8, padding: "6px 9px", font: "inherit", fontSize: 12, lineHeight: 1.5, color: C.textSec, background: C.card, outline: "none", resize: "vertical" }}
                                  />
                                ) : (
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    onDoubleClick={(e) => { e.stopPropagation(); setEditingNoteId(t.id); }}
                                    title="Double-click to edit"
                                    style={{ marginTop: 6, padding: "5px 9px", borderLeft: "2px solid " + C.borderLight, fontSize: 12, lineHeight: 1.5, color: C.textSec, whiteSpace: "pre-wrap", cursor: "text" }}
                                  >{t.notes}</div>
                                )
                              )}
                            </div>

                            {/* Worker assignment badge — only renders if task is assigned. */}
                            {t.assigned_worker_id && (() => {
                              const w = workersList.find(x => x.id === t.assigned_worker_id);
                              if (!w) return null;
                              const initials = getWorkerInitials(w.name);
                              const isWorkerDone = !!t.worker_completed_at;
                              return (
                                <span className="rt-row-worker" style={{
                                  display: "inline-flex", alignItems: "center", gap: 5,
                                  padding: "3px 9px 3px 3px",
                                  borderRadius: 999,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  flexShrink: 0,
                                  // Pending = gold (warning) — distinct from purple (selected) and green (done).
                                  // Done = neutral grey, doesn't compete with the strikethrough on the title.,
                                  background: isWorkerDone ? C.surfaceWarm : "rgba(184,139,21,0.14)",
                                  color: isWorkerDone ? C.textMuted : C.warning,
                                }} title={isWorkerDone ? `${w.name} completed this` : `Assigned to ${w.name}`}>
                                  <span style={{
                                    width: 18, height: 18, borderRadius: 9,
                                    background: isWorkerDone ? C.textMuted : C.warning,
                                    color: "#fff", fontSize: 8, fontWeight: 700,
                                    display: "grid", placeItems: "center",
                                  }}>{initials}</span>
                                  <span className="rt-row-text">{w.name.split(' ')[0]}{isWorkerDone ? " · done" : ""}</span>
                                </span>
                              );
                            })()}

                            {/* RAI attribution pill removed — the purple edge
                                ring + inset bar + bobbing ✦ medallion (via
                                .rt-rai-boost on t.ai rows) now signals "Rai"
                                from the row edge, so the right gutter stays free
                                for the date and the title gets full width. */}

                            {/* Right-side indicator — recurring infinity OR date pill (mutually exclusive) */}
                            {t.recurring ? (
                              <span className="rt-row-recur" style={{
                                display: "inline-flex", alignItems: "center", gap: 4,
                                padding: "3px 9px",
                                borderRadius: 999,
                                fontSize: 11,
                                fontWeight: 600,
                                flexShrink: 0,
                                color: C.textSec,
                                border: "none",
                                background: C.card,
                                boxShadow: "var(--rt-sh-xs)",
                              }} title={formatRecurrenceLabel(t.recurrence_pattern)}>
                                <Icon name="infinity" size={12} color={C.textSec} />
                                <span className="rt-row-text">{formatRecurrenceLabel(t.recurrence_pattern)}</span>
                              </span>
                            ) : (!t.recurring) ? (() => {
                              // A today-bucket task with no explicit due_date
                              // still shows a "Today" pill (was blank before).
                              // Effective date falls back to today when null.
                              const effDue = t.due_date ? String(t.due_date).slice(0,10) : _todayStr;
                              const isToday = effDue === _todayStr;
                              const isTomorrow = effDue === _tomorrowStr;
                              const isOverdue = !isDone && effDue < _todayStr;
                              const label = isOverdue
                                ? (() => {
                                    const days = Math.round((new Date(_todayStr) - new Date(effDue)) / 86400000);
                                    return days === 1 ? "1d late" : days + "d late";
                                  })()
                                : isToday ? "Today"
                                : isTomorrow ? "Tomorrow"
                                : new Date(effDue + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
                              return (
                                <span style={{ position: "relative", flexShrink: 0, display: "inline-flex" }}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isDone) return;
                                    if (rowDuePickerId === t.id) { setRowDuePickerId(null); setRowDuePickerRect(null); return; }
                                    setRowDuePickerRect(e.currentTarget.getBoundingClientRect());
                                    setRowDuePickerActions({
                                      today: () => setTaskDueDate(t.id, _todayStr),
                                      tomorrow: () => setTaskDueDate(t.id, _tomorrowStr),
                                      later: () => pushToLater(t.id),
                                    });
                                    setRowDuePickerId(t.id);
                                  }}
                                  className={"rt-row-due rt-composer-pill " + (isToday ? "rt-due-today" : isOverdue ? "rt-due-overdue" : "rt-due-future")} style={{
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                  padding: "3px 8px 3px 9px",
                                  borderRadius: 999,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  flexShrink: 0,
                                  fontFamily: "inherit",
                                  cursor: isDone ? "default" : "pointer",
                                  // When the task is done, the Today/Overdue pill
                                  // collapses to the muted "future" treatment.
                                  background: isDone ? "transparent" : (isOverdue ? "rgba(196,67,43,0.08)" : C.card),
                                  color: isDone ? C.textMuted : (isOverdue ? C.danger : C.textSec),
                                  border: "none",
                                  boxShadow: isDone ? "none" : "var(--rt-sh-xs)",
                                }}>
                                  <Icon name="calendar" size={10} color={isDone ? C.textMuted : (isOverdue ? C.danger : C.textSec)} />
                                  <span className="rt-row-text">{label}</span>
                                  {!isDone && (
                                    <svg className="rt-due-chevron" width="9" height="9" viewBox="0 0 16 16" fill="none" style={{ marginLeft: 1, opacity: 0.6 }} aria-hidden="true">
                                      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  )}
                                </button>
                                </span>
                              );
                            })() : null}

                            <button onClick={(e) => {
                                e.stopPropagation();
                                // Phase 9: for Rai tasks, opens the feedback
                                // modal which runs the delete on confirm.
                                // For non-Rai tasks, deletes immediately.
                                openDismissFlow(t, () => {
                                  purgeTaskHistory(t.id);
                                  setTasks(tasks.filter(t2 => t2.id !== t.id));
                                  tasksDb.delete(t.id);
                                });
                              }}
                              className="rt-dismiss"
                              style={{ width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted, opacity: 0, background: "none", border: "none", cursor: "pointer", flexShrink: 0, transition: "opacity 120ms ease" }}
                              aria-label="dismiss">
                              <Icon name="x" size={12} />
                            </button>
                          </div>
                          </div>
                        );
                    };

                    // Bucket header component (inline).
                    const BucketHeader = ({ name, dimmed, count, topGap }) => {
                      // Variant B — editorial divider. The bucket label is
                      // rendered as lowercase Fraunces italic ("today",
                      // "tomorrow", "later"), with the hairline passing
                      // BEHIND both the label and the right-side controls.
                      // Both flanking blocks paint the page background so
                      // the line tucks under them cleanly — reads as one
                      // continuous section break, like a centered chapter
                      // divider in a book.
                      //
                      // No dot (was generic AI-design chrome). The italic
                      // typography carries the editorial voice; dimmed
                      // future buckets get a muted color but keep the same
                      // typography so the whole stack reads as one family.
                      const isToday = name === "Today";
                      const aiTasksOn = raiState?.ai_tasks_enabled !== false;
                      const isRaiPlus = rankMode === "rai" && aiTasksOn;
                      const isRaiOnly = rankMode === "rai" && !aiTasksOn;
                      const isManual = rankMode === "manual";
                      const modeLabel = isRaiPlus ? "Rai Task & Rank" : isRaiOnly ? "Rai Rank" : "Manual";
                      return (
                        <div className="rt-bucket-head" style={{ display: "flex", alignItems: "center", gap: 14, margin: (topGap != null ? topGap : 20) + "px 4px 10px" }}>
                          <span style={{
                            fontFamily: "'Fraunces', Georgia, serif",
                            fontStyle: "italic",
                            fontSize: 14,
                            fontWeight: 500,
                            letterSpacing: "-0.01em",
                            color: dimmed ? C.textMuted : C.text,
                            lineHeight: 1,
                            flexShrink: 0,
                          }}>{name.toLowerCase()}</span>
                          <span style={{ flex: 1, height: 1, background: C.borderLight }} />
                          {isToday && (
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0, borderRadius: 8, padding: "2px 4px" }}>
                              {/* Mode selector — quiet text label with caret,
                                  click to open dropdown with three options. */}
                              <div style={{ position: "relative" }}>
                                <button
                                  onClick={() => setTodayModeMenuOpen(!todayModeMenuOpen)}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 5,
                                    padding: "3px 8px",
                                    border: "none",
                                    background: "transparent",
                                    fontFamily: "inherit",
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: C.textSec,
                                    cursor: "pointer",
                                    borderRadius: 6,
                                    letterSpacing: "0.02em",
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = "rgba(20,30,22,0.04)"}
                                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                  title="Change ranking mode"
                                >
                                  {(isRaiPlus || isRaiOnly) && (() => {
                                    const Star = () => (
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, display: "block" }} aria-hidden="true">
                                        <path d="M12 4l2.2 5.8 5.8 2.2-5.8 2.2L12 20l-2.2-5.8L4 12l5.8-2.2L12 4z" fill={C.btn} />
                                      </svg>
                                    );
                                    // Task & Rank gets TWO stars (Rai picks
                                    // AND ranks). Rai Rank gets ONE (ranks
                                    // only). Manual gets zero.
                                    return isRaiPlus ? <span style={{ display: "inline-flex", gap: 1 }}><Star /><Star /></span> : <Star />;
                                  })()}
                                  <span>{modeLabel}</span>
                                </button>
                                {todayModeMenuOpen && (
                                  <>
                                    <div onClick={() => setTodayModeMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 49, background: "transparent" }} />
                                    <div className="rt-picker-panel" style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, minWidth: 220, zIndex: 50 }}>
                                      {[
                                        { value: "raiPlus", label: "Rai Task & Rank", hint: "Rai ranks + adds suggested tasks.", onClick: () => { setRankMode("rai"); setAiTasks(true); } },
                                        { value: "raiOnly", label: "Rai Rank",        hint: "Rai ranks your task list.",         onClick: () => { setRankMode("rai"); setAiTasks(false); } },
                                        { value: "manual",  label: "Manual",          hint: "Your tasks, your way. No Rai.",     onClick: () => { setRankMode("manual"); setAiTasks(false); } },
                                      ].map(opt => {
                                        const active = (opt.value === "raiPlus" && isRaiPlus) || (opt.value === "raiOnly" && isRaiOnly) || (opt.value === "manual" && isManual);
                                        return (
                                          <button
                                            key={opt.value}
                                            onClick={() => { opt.onClick(); setTodayModeMenuOpen(false); }}
                                            style={{
                                              display: "flex", alignItems: "center", justifyContent: "space-between",
                                              width: "100%", padding: "8px 10px",
                                              border: "none",
                                              background: active ? C.surface : "transparent",
                                              borderRadius: 6, cursor: "pointer", fontFamily: "inherit", textAlign: "left", color: C.text,
                                            }}
                                            onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(20,30,22,0.04)"; }}
                                            onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                                          >
                                            <div>
                                              <div style={{ fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 }}>
                                                {(opt.value === "raiPlus" || opt.value === "raiOnly") && (() => {
                                                  const MenuStar = () => (
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                                      <path d="M12 4l2.2 5.8 5.8 2.2-5.8 2.2L12 20l-2.2-5.8L4 12l5.8-2.2L12 4z" fill={C.btn} />
                                                    </svg>
                                                  );
                                                  return opt.value === "raiPlus" ? <span style={{ display: "inline-flex", gap: 1 }}><MenuStar /><MenuStar /></span> : <MenuStar />;
                                                })()}
                                                {opt.label}
                                              </div>
                                              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{opt.hint}</div>
                                            </div>
                                            {active && <Icon name="check" size={13} simple color={C.primary} />}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </>
                                )}
                              </div>
                              {/* Focus link — only shown in Rai mode. */}
                              {rankMode === "rai" && (
                                <button
                                  onClick={() => setFocusMode(!focusMode)}
                                  style={{
                                    display: "inline-flex", alignItems: "center", gap: 4,
                                    padding: "3px 8px",
                                    border: "none",
                                    background: focusMode ? C.primarySoft : "transparent",
                                    fontFamily: "inherit",
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: focusMode ? C.primaryDark : C.textSec,
                                    cursor: "pointer",
                                    borderRadius: 6,
                                    letterSpacing: "0.02em",
                                  }}
                                  onMouseEnter={e => { if (!focusMode) e.currentTarget.style.background = "rgba(20,30,22,0.04)"; }}
                                  onMouseLeave={e => { if (!focusMode) e.currentTarget.style.background = "transparent"; }}
                                >
                                  {/* Lightning bolt — replaces the previous
                                      "→" arrow. Reads as "energy / focus
                                      moment" rather than the throwaway
                                      arrow. Stays visible in both states
                                      (idle and Focusing), color follows
                                      the text color so it integrates with
                                      the button rather than fighting it. */}
                                  <svg width="11" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0, display: "block" }}>
                                    <path d="M13 2L3 14h7l-1 8 11-14h-7l1-6z" fill={focusMode ? C.primaryDark : C.textSec} stroke="none" strokeLinejoin="round" />
                                  </svg>
                                  {focusMode ? "Focusing" : "Focus"}
                                </button>
                              )}
                              {/* Debug pill preserved so ⌘⇧D still works. */}
                              {debugScores && (
                                <span style={{
                                  fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                                  fontSize: 9, fontWeight: 700,
                                  padding: "2px 7px", borderRadius: 999,
                                  background: "#FEF3C7", color: "#7C2D12",
                                  letterSpacing: "0.05em", textTransform: "uppercase",
                                }}>Debug · ⌘⇧D</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    };


                    return (
                      <>
                        {/* TODAY bucket — break-out top task (B) */}
                        <div className="rt-today-canvas">
                        <BucketHeader name="Today" dimmed={false} count={_todayBucket.length} topGap={6} />
                        {_todayBucket.length > 0 && (
                          <div className={"rt-today-breakout" + (justPromoted ? " rt-today-breakout-animate" : "")}>
                            {renderRow(_todayBucket[0], "today")}
                          </div>
                        )}
                        {_todayBucket.length > 1 && (
                          <div className="rt-today-rest" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {_todayBucket.slice(1).map(t => renderRow(t, "today"))}
                          </div>
                        )}

                        {/* Today empty states — rendered INSIDE the canvas so a
                            clear list fills the beige area rather than leaving an
                            empty husk with the message floating below it.

                            CASE A: nothing exists yet. todayCount === 0 means
                            no tasks created for today at all (neither open nor
                            done). Show a quiet prompt — no congratulation,
                            because there is nothing to congratulate.

                            CASE B: all complete. todayCount > 0 means tasks
                            existed; _todayBucket.length === 0 means none are
                            still open; todayDoneCount === todayCount confirms
                            every one is checked off. Modest acknowledgment —
                            user earned this — plus a Tomorrow preview if there
                            is one. The voice stays direct and unsentimental
                            (no "you crushed it" energy). */}
                        {_todayBucket.length === 0 && todayCount === 0 && (
                          <div style={{ textAlign: "center", padding: "32px 20px", background: "transparent", color: C.textMuted, fontSize: 13, fontStyle: "italic", fontFamily: "'Fraunces', Georgia, serif", fontVariationSettings: "'opsz' 96, 'SOFT' 50, 'WONK' 0", fontWeight: 500 }}>
                            Nothing on today&rsquo;s list yet. Add one above &uarr;
                          </div>
                        )}
                        {_todayBucket.length === 0 && todayCount > 0 && todayCount === todayDoneCount && (
                          <div style={{ textAlign: "center", padding: "28px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.primary, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 2 }}>
                              <Icon name="check" size={14} color="#fff" />
                            </div>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: C.primaryDeep }}>Today&rsquo;s list is clear.</div>
                            {_tomorrowBucket.length > 0 && (
                              <div style={{ fontSize: 12, color: C.textSec }}>
                                <b style={{ color: C.text, fontWeight: 700 }}>{_tomorrowBucket.length}</b> {_tomorrowBucket.length === 1 ? "task" : "tasks"} queued for tomorrow.
                              </div>
                            )}
                          </div>
                        )}
                        </div>


                        {/* TOMORROW bucket — ALWAYS rendered (it's where users
                            see tomorrow's schedule, with or without tasks). */}
                        {(() => {
                          const tz = userTimezone;
                          const tmrw = new Date(); tmrw.setDate(tmrw.getDate() + 1);
                          const tmrwYmd = ymdInTz(tz, tmrw);
                          const tmrwEvents = (personalEvents || []).filter(e => e && e.starts_at && ymdInTz(tz, new Date(e.starts_at)) === tmrwYmd);
                          const hasTasks = _tomorrowBucket.length > 0;
                          return (<>
                            <BucketHeader name="Tomorrow" dimmed={true} count={hasTasks ? _tomorrowBucket.length : 0} />
                            {hasTasks ? (
                              <div className="rt-row-condensed" style={{ display: "flex", flexDirection: "column", gap: 10, opacity: 0.76, position: "relative", zIndex: 3, padding: "0 6px" }}>
                                {_tomorrowBucket.map(t => renderRow(t, "tomorrow"))}
                              </div>
                            ) : (
                              <div style={{ padding: "2px 6px 0", fontFamily: "'Manrope', sans-serif", fontSize: 12.5, color: C.textMuted, fontStyle: "italic" }}>No tasks tomorrow.</div>
                            )}
                            {/* Calendar toggle + content — wrapped in
                                .rt-bucket-cal so focus-mode CSS can dim
                                the whole calendar surface as a unit
                                (toggle pill + expanded events). */}
                            <div className="rt-bucket-cal">
                              <BucketCalToggle label="Calendar" count={tmrwEvents.length} open={tomorrowCalOpen} onToggle={() => setTomorrowCalOpen(o => !o)} C={C} />
                              {tomorrowCalOpen && (
                                tmrwEvents.length > 0
                                  ? <BucketCalendarTomorrow events={tmrwEvents} C={C} />
                                  : <div style={{ background: C.primaryGhost, borderRadius: 12, padding: "16px", margin: "8px 6px 4px", fontFamily: "'Manrope', sans-serif", fontSize: 12, color: C.textMuted, fontStyle: "italic", textAlign: "center" }}>Nothing on the calendar tomorrow.</div>
                              )}
                            </div>
                          </>);
                        })()}

                        {/* LATER bucket — ALWAYS rendered. */}
                        {(() => {
                          const tz = userTimezone;
                          const days = [];
                          for (let i = 2; i <= 6; i++) {
                            const d = new Date(); d.setDate(d.getDate() + i);
                            const ymd = ymdInTz(tz, d);
                            days.push({
                              ymd,
                              label: d.toLocaleDateString("en-US", { weekday: "short" }),
                              dateLabel: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                              events: [],
                            });
                          }
                          const byYmd = {}; days.forEach(dd => { byYmd[dd.ymd] = dd; });
                          for (const e of (personalEvents || [])) {
                            if (!e || !e.starts_at) continue;
                            const ymd = ymdInTz(tz, new Date(e.starts_at));
                            if (byYmd[ymd]) byYmd[ymd].events.push(e);
                          }
                          days.forEach(dd => dd.events.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)));
                          const total = days.reduce((s, dd) => s + dd.events.length, 0);
                          const hasTasks = _laterBucket.length > 0;
                          return (<>
                            <BucketHeader name="Later" dimmed={true} count={hasTasks ? _laterBucket.length : 0} />
                            {hasTasks ? (
                              <div className="rt-row-condensed" style={{ display: "flex", flexDirection: "column", gap: 10, opacity: 0.76, position: "relative", zIndex: 2, padding: "0 6px" }}>
                                {_laterBucket.map(t => renderRow(t, "later"))}
                              </div>
                            ) : (
                              <div style={{ padding: "2px 6px 0", fontFamily: "'Manrope', sans-serif", fontSize: 12.5, color: C.textMuted, fontStyle: "italic" }}>No tasks scheduled.</div>
                            )}
                            {/* Calendar toggle + content — wrapped in
                                .rt-bucket-cal so focus-mode CSS can dim
                                the whole calendar surface as a unit. */}
                            <div className="rt-bucket-cal">
                              <BucketCalToggle label="Calendar" count={total} open={laterCalOpen} onToggle={() => setLaterCalOpen(o => !o)} C={C} />
                              {laterCalOpen && <BucketCalendarLater days={days} C={C} />}
                            </div>
                          </>);
                        })()}

                        {/* COMPLETED TODAY log — sits at the bottom, below all
                            active buckets. Active work gets prime real estate;
                            completed work is reference, not action. Collapsed
                            by default; the line doubles as the toggle button. */}
                        {_collapsedDoneTasks.length > 0 && (
                          <div className="rt-completed-log" style={{ marginTop: 24, padding: "0 6px" }}>
                            <button
                              onClick={() => setCompletedLogOpen(!completedLogOpen)}
                              style={{
                                width: "100%",
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "12px 14px",
                                background: completedLogOpen ? C.primarySoft : "transparent",
                                border: "1px dashed " + (completedLogOpen ? C.primaryLight : C.border),
                                borderRadius: 10,
                                color: completedLogOpen ? C.primary : C.textSec,
                                fontSize: 13,
                                fontWeight: 500,
                                cursor: "pointer",
                                fontFamily: "inherit",
                                transition: "background 160ms var(--rt-ease-out), border-color 160ms var(--rt-ease-out), color 160ms var(--rt-ease-out)",
                              }}
                              onMouseEnter={e => {
                                if (completedLogOpen) return; // already in green state
                                e.currentTarget.style.background = C.primarySoft;
                                e.currentTarget.style.borderColor = C.primaryLight;
                                e.currentTarget.style.color = C.primary;
                              }}
                              onMouseLeave={e => {
                                if (completedLogOpen) return; // keep green while open
                                e.currentTarget.style.background = "transparent";
                                e.currentTarget.style.borderColor = C.border;
                                e.currentTarget.style.color = C.textSec;
                              }}
                            >
                              <span>
                                <span style={{ color: C.textMuted, marginRight: 4 }}>{_collapsedDoneTasks.length}</span>
                                completed today
                              </span>
                              <svg
                                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                style={{ transform: completedLogOpen ? "rotate(90deg)" : "rotate(0)", transition: "transform 220ms var(--rt-ease-out)" }}
                              >
                                <path d="M9 6l6 6-6 6" />
                              </svg>
                            </button>
                            <div
                              style={{
                                // Smooth height-animation pattern: grid row
                                // toggles between 0fr (collapsed) and 1fr
                                // (expanded). The child uses overflow:hidden
                                // and min-height:0 so it collapses cleanly.
                                // Animates to the ACTUAL content height — no
                                // dead-space scrubbing (the old max-height:2000
                                // approach would run the full 320ms even when
                                // content was only ~300px tall, producing the
                                // truncated/janky feel). Opacity fade rides
                                // alongside for a polished entry.
                                display: "grid",
                                gridTemplateRows: completedLogOpen ? "1fr" : "0fr",
                                marginTop: completedLogOpen ? 8 : 0,
                                opacity: completedLogOpen ? 1 : 0,
                                transition: "grid-template-rows 280ms var(--rt-ease-out), margin-top 240ms var(--rt-ease-out), opacity 220ms var(--rt-ease-out)",
                              }}
                            >
                              <div style={{ overflow: "hidden", minHeight: 0 }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 10, opacity: 0.7, padding: "4px 2px" }}>
                                  {_collapsedDoneTasks.map(t => renderRow(t, "today"))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {/* Completed section removed — done tasks now render inline above with strikethrough state. */}
                </div>

              {/* CALENDAR — TimeDial as a full-height background layer anchored
                  to the right edge, bleeding past r-main's padding. A gentle
                  top fade (page-bg → transparent) dissolves the upper arc so it
                  tucks delicately under the composer + progress banner. Sits
                  BEHIND the content (z-index 0). Desktop only. The old
                  TodayTimeline + Rai brief stay gated (false) below. */}
              <div
                className="rt-dial-layer"
                style={{ position: "fixed", top: 14, bottom: 0, right: 0, width: 720, zIndex: 0, pointerEvents: "none", overflow: "visible", transform: "scale(var(--dial-scale, 1))", transformOrigin: "right center" }}
              >
                {/* Connect Google Calendar nudge — overlays the dial
                    area at top-left. Pointer-events scoped to just the
                    affordance so dial scrub/click pass through.
                    Visible only when not connected and not dismissed.
                    Dotted purple underline → solid on hover; reads as
                    an editorial link, not UI chrome. */}
                {!googleConnected && !googleConnectPromptDismissed && (
                  <div style={{
                    position: "absolute",
                    top: 28,
                    left: 36,
                    maxWidth: 360,
                    pointerEvents: "auto",
                    zIndex: 4,
                    fontFamily: "inherit",
                  }}>
                    <div style={{
                      fontFamily: "'Fraunces', Georgia, serif",
                      fontStyle: "italic",
                      fontSize: 14,
                      fontWeight: 500,
                      color: C.textMuted,
                      letterSpacing: "-0.005em",
                      lineHeight: 1.5,
                    }}>
                      <button
                        type="button"
                        onClick={connectGoogleCalendar}
                        className="rt-gcal-connect-link"
                        style={{
                          background: "transparent",
                          border: "none",
                          padding: 0,
                          fontFamily: "inherit",
                          fontStyle: "italic",
                          fontSize: 14,
                          fontWeight: 600,
                          color: "#33543E",
                          cursor: "pointer",
                          textDecoration: "underline dotted",
                          textDecorationColor: "rgba(51,84,62,0.55)",
                          textUnderlineOffset: 4,
                          textDecorationThickness: 1.5,
                          transition: "text-decoration-style 120ms ease",
                        }}
                      >
                        Connect Google Calendar
                      </button>
                      <span> to see your meetings on the dial.</span>
                    </div>
                    <button
                      type="button"
                      onClick={dismissGoogleConnectPrompt}
                      style={{
                        background: "transparent",
                        border: "none",
                        padding: "2px 0 0",
                        marginTop: 4,
                        color: C.textMuted,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        fontSize: 11,
                        fontStyle: "italic",
                      }}
                      aria-label="Dismiss"
                    >
                      not now
                    </button>
                  </div>
                )}
                <div style={{ position: "absolute", inset: 0, pointerEvents: "auto" }}>
                  <TimeDial
                    events={(() => {
                      // Enrich each event with _prepCount = open tasks for that
                      // event's client. Used to render the "N tasks before" chip
                      // under the event title on the dial rail.
                      //
                      // The dial is a SINGLE DAY, so prep should count only work
                      // actually due TODAY for the client — not every open task.
                      // A recurring task counts only if its next occurrence is
                      // today (a Thursday task does NOT count on Monday). A
                      // one-off counts if it has no due_date (active now) or is
                      // due today/overdue. This mirrors bucketOf's "today" rule.
                      const _prepTodayYmd = ymdInTz(userTimezone, new Date());
                      const _countsToday = (t) => {
                        if (t.recurring) {
                          const next = nextOccurrenceDate(t.recurrence_pattern, new Date(), true);
                          const nextYmd = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
                          return nextYmd <= _prepTodayYmd;
                        }
                        if (!t.due_date) return true;
                        return String(t.due_date).slice(0, 10) <= _prepTodayYmd;
                      };
                      const openByClient = {};
                      const tasksByClient = {}; // accumulate the actual open task list per client
                      // AI-task visibility gate: when the user is in Ranked or
                      // Manual view (not Task & Rank), Rai-suggested tasks are
                      // hidden from the main task list. They should ALSO be
                      // excluded from the dial's prep count and prep task list —
                      // otherwise the user sees a count of tasks they can't
                      // find anywhere else, and the selected-event hub shows
                      // checkable items that don't exist in their visible
                      // workspace. Mirrors the filter at the task-list level.
                      const _aiTasksVisible = rankMode === "rai" && raiState?.ai_tasks_enabled !== false;
                      for (const t of (tasks || [])) {
                        if (!t || t.done || !t.client_id) continue;
                        if (!_countsToday(t)) continue;
                        if (t.ai && !_aiTasksVisible) continue;
                        openByClient[t.client_id] = (openByClient[t.client_id] || 0) + 1;
                        if (!tasksByClient[t.client_id]) tasksByClient[t.client_id] = [];
                        tasksByClient[t.client_id].push({ id: t.id, text: t.text, done: t.done });
                      }
                      // The dial is a SINGLE DAY. Only today's events (in the
                      // user's timezone) belong on it — an event from yesterday
                      // must NOT count as "earlier," and with no events today the
                      // empty-state ("No calls today") should show. Filter to the
                      // local-today YMD before the dial ever sees them.
                      const todayYmd = ymdInTz(userTimezone, new Date());
                      return (personalEvents || [])
                        .filter(e => e && e.starts_at && ymdInTz(userTimezone, new Date(e.starts_at)) === todayYmd)
                        .map(e => ({
                          ...e,
                          _prepCount: e && e.client_id ? (openByClient[e.client_id] || 0) : 0,
                          _prepTasks: e && e.client_id ? (tasksByClient[e.client_id] || []) : [],
                        }));
                    })()}
                    C={C}
                    scrubMs={dialScrubMs}
                    setScrubMs={setDialScrubMs}
                    dayView={dialDayView}
                    setDayView={setDialDayView}
                    onDeleteEvent={(id) => {
                      setPersonalEvents(prev => (prev || []).filter(e => e.id !== id));
                      try { personalCalendarDb.remove(id); } catch (e) { console.warn("Event delete failed:", e); }
                    }}
                    onOpenClient={(clientId) => {
                      const c = (clients || []).find(x => x.id === clientId);
                      if (c) { setSelectedClient(c); setClientTab && setClientTab("overview"); setPage("clients"); }
                    }}
                    onRescheduleEvent={async (id, newStartsAt, newEndsAt) => {
                      // Optimistic update; revert on DB error.
                      setPersonalEvents(prev => (prev || []).map(e =>
                        e.id === id ? { ...e, starts_at: newStartsAt, ends_at: newEndsAt || e.ends_at } : e
                      ));
                      try {
                        await personalCalendarDb.update(id, { starts_at: newStartsAt, ends_at: newEndsAt || null });
                      } catch (err) {
                        console.warn("Event reschedule failed:", err);
                      }
                    }}
                    onTogglePrepTask={(taskId) => toggleTask(taskId)}
                    onRequestLink={({ eventId, anchorRect }) => {
                      setLinkPicker({ eventId, anchor: anchorRect });
                      setLinkPickerSearch("");
                    }}
                  />
                </div>
                {/* (Top-fade overlay removed — it painted a visible C.bg band
                    over the dial's tint that read as a shaded slab. The disc's
                    feathered rim already softens the upper arc.) */}
              </div>

              {/* (Removed: two dead {false && …} render blocks that previously
                  held a gated TodayTimeline focus-column and a gated
                  RaiBriefPanel. TodayTimeline is still live in the mobile
                  calendar sheet; RaiBriefPanel has been removed entirely.) */}

              {/* CONFETTI */}
              {/* Confetti layer removed (May 2026) — celebration is fireworks
                  only now. The `confetti` state still gates the fireworks. */}

              {/* Brain Dump — review-before-commit extraction modal. */}
              <BrainDump
                open={brainDumpOpen}
                onClose={() => setBrainDumpOpen(false)}
                clients={clients}
                user={user}
                onCommitted={({ tasks: newTasks, failed }) => {
                  if (newTasks && newTasks.length) setTasks(prev => [...newTasks, ...prev]);
                  if (failed) console.warn(`Brain Dump: ${failed} item(s) failed to create`);
                }}
              />
            </div>
          );
        
}
