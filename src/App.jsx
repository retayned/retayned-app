import TodayPage from "./pages/TodayPage";
import ClientsPage from "./pages/ClientsPage";
import HealthPage from "./pages/HealthPage";
import WorkersPage from "./pages/WorkersPage";
import ReferralsPage from "./pages/ReferralsPage";
import RetrosPage from "./pages/RetrosPage";
import CoachPage from "./pages/CoachPage";
import SettingsPage from "./pages/SettingsPage";
import WorkerDashboard from "./WorkerDashboard";
import { useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabase";
import { clients as clientsDb, raiConversations as convoDb, healthChecks as hcDb, observations as observationsDb, personalCalendar as personalCalendarDb, profile as profileDb, referrals as referralsDb, revenueHistoryDb, rolodex as rolodexDb, tasks as tasksDb, touchpoints as touchpointsDb, workers as workersDb } from "./lib/db";
import { createPortal } from "react-dom";
import { Icon } from "./components/Icon";
import BrainDump from "./components/BrainDump";
import ClientModal from "./components/ClientModal";
import RolodexModal from "./components/RolodexModal";
import ShellOverlays from "./components/ShellOverlays";
import { useRealtimeSync } from "./hooks/useRealtimeSync";
import { useDataLoad } from "./hooks/useDataLoad";
import { useShellViewport } from "./hooks/useShellViewport";
import { useGoogleCalendar } from "./hooks/useGoogleCalendar";
import { QuickAddClientCard, RosterBuilder, WelcomeOverlay } from "./components/Onboarding";
import { SkeletonPage } from "./components/Skeletons";
import { QuickLogToast } from "./components/TaskBuckets";
import { TimeDial } from "./components/TimeDial";
import { moreItemsCore, navItemsCore } from "./nav";
import { parseComposer } from "./parser";
import { nextOccurrenceDate } from "./recurrence";
import { C } from "./theme";
import { APP_CSS } from "./appStyles";
import { getUserInitial, localYmd, splitLongTask, tzMidnightInstant, ymdInTz } from "./utils";



export default function App({ user }) {
  // ─── ROUTING: Worker magic-link page lives at /w/{token} (no auth needed) ──
  // Detect this route before any auth-gated logic runs. Returns WorkerDashboard
  // standalone if matched.
  if (typeof window !== "undefined" && /^\/w\//.test(window.location.pathname)) {
    return <WorkerDashboard />;
  }

  // (Enterprise tier REMOVED June 2026 — Retayned is single-tier. The
  // tier flag, enterprise nav variants, SweepsPage, ReferralIntelPage,
  // and demoData were all excised; core paths are the only paths.)
  const [page, setPage] = useState("today");

  // Scroll to top on page change. .r-main is now a fixed-positioned scroll
  // container (not the document), so we reset its scrollTop plus the Rai
  // chat's internal scroller. The document itself no longer scrolls, so no
  // window.scrollTo needed.
  useEffect(() => {
    document.querySelectorAll(".r-main, .r-rai-scroll").forEach(el => { el.scrollTop = 0; });
  }, [page]);

  // iOS Safari viewport fix — when the address bar collapses/expands, 100vh doesn't update,
  // leaving fixed-positioned elements (like the bottom nav) anchored to the wrong bottom.
  // Shell viewport state (keyboard, isMobile, dock shrink) lives in
  // src/hooks/useShellViewport (extracted June 2026).
  const { dockShrunk, isMobile, keyboardOpen } = useShellViewport();
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientTab, setClientTab] = useState("overview");
  const [clientBilling, setClientBilling] = useState({});
  // Client addons (ad-hoc revenue) — keyed by client_id, array of
  // addon rows. Populated at hydration and refetched when the
  // Billing tab opens (so just-added rows show without a full
  // reload). One row per ad-hoc payment.
  const [clientAddons, setClientAddons] = useState({});
  // Local form state for the "Add addon" row at the bottom of the
  // Billing tab. Reset to defaults after each successful save.
  const [newAddon, setNewAddon] = useState({ amount: "", description: "", charged_at: "" });
  // Track which addon is being edited (null = no edit mode).
  const [editingAddonId, setEditingAddonId] = useState(null);
  const [editingAddon, setEditingAddon] = useState({ amount: "", description: "", charged_at: "" });
  // QuickLog — global FAB composer for fast personal-task capture.
  // Shell v1 (May 2026): plain task creation, no parsing. v2 will add
  // client matching + tense detection (past = touchpoint, future = task).
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  // Mobile bottom-nav "More" sheet (overflow destinations). Part of the
  // rebuilt fixed nav bar.
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  // Brain Dump lifted to App level (June 2026) so the capture sheet can
  // open it from ANY page, not just Today. TodayPage's brain button now
  // drives this same state via pageCtx.
  const [brainDumpOpen, setBrainDumpOpen] = useState(false);
  // ─── FIRST-RUN ONBOARDING (June 2026) ─────────────────────────────
  // Derived, zero-SQL flow: welcome overlay → quick-add client →
  // first task (TodayPage spotlight) → roster builder ("your book").
  // welcomed flag lives in localStorage (rt:welcomedAt = epoch ms);
  // everything else derives from clients/tasks length, so Lane B
  // (skipped) users get ambient empty states and can merge in anytime.
  const [onboardingStep, setOnboardingStep] = useState(null); // null | "client" | "task" | "book"
  const [welcomed, setWelcomed] = useState(() => {
    try { return !!window.localStorage.getItem("rt:welcomedAt"); } catch (_) { return true; }
  });
  const markWelcomed = () => {
    try { window.localStorage.setItem("rt:welcomedAt", String(Date.now())); } catch (_) { /* unavailable */ }
    setWelcomed(true);
  };
  // (Trigger + advance effects live AFTER the tasks declaration below —
  // they read dataLoaded/clients/tasks, which are declared later in this
  // component; placing them here was a temporal-dead-zone crash.)
  // Dock breathes with scroll: scrolling DOWN shrinks the pill out of the
  // way; scrolling up (or nearing the top) restores it. Listens in capture
  // phase so it catches the .r-main scroller as well as the window.
  // (dockShrunk state + scroll listener moved into useShellViewport.)
  const [quickLogText, setQuickLogText] = useState("");
  // Toast shape: { id, taskId, taskRef } where taskRef is the optimistic
  // task object so undo can restore it precisely.
  const [quickLogToast, setQuickLogToast] = useState(null);
  // Per-(client, month) invoiced/paid status, hydrated on load.
  // Shape: { [client_id]: { [month]: { id, invoiced, paid, invoiced_at, paid_at } } }
  const [billingMonthStatus, setBillingMonthStatus] = useState({});
  // Per-client billing-terms log entries, newest first within each client.
  // Shape: { [client_id]: [{ id, body, created_at, updated_at }, ...] }
  const [billingTerms, setBillingTerms] = useState({});
  // UI state for billing terms flap (in client modal Billing tab):
  //   - termsHistoryOpen: { [client_id]: boolean }  expand history below current
  //   - termsEditingId:   id of entry being edited (one at a time)
  //   - termsEditDraft:   text content of the edit/new draft
  //   - termsAddingNew:   { [client_id]: boolean }  show new-entry textarea
  const [termsHistoryOpen, setTermsHistoryOpen] = useState({});
  const [termsEditingId, setTermsEditingId] = useState(null);
  const [termsEditDraft, setTermsEditDraft] = useState("");
  const [termsAddingNew, setTermsAddingNew] = useState({});
  const [billingAddOpen, setBillingAddOpen] = useState(false);
  const [billingNewItem, setBillingNewItem] = useState({ description: "", amount: "", recurring: false });
  const [editingOverview, setEditingOverview] = useState(false);
  const [overviewEditData, setOverviewEditData] = useState({});
  const [editingProfile, setEditingProfile] = useState(false);
  const [editScores, setEditScores] = useState({});
  const [radarHoverDim, setRadarHoverDim] = useState(null); // key of dimension being hovered/tapped on the client profile radar
  // Toggle for the "edit historical baseline" disclosure inside the edit-client
  // modal. Hidden by default — most users will never need to touch this.
  // Resets when client modal opens (handled by the selectedClient reset effect).
  const [showBaselineEdit, setShowBaselineEdit] = useState(false);

  // Sidebar tasks-completed widget state. Counts hydrate on app load via
  // tasksDb.getCompletedCounts. Period toggles between week/month/year and
  // is local state — resets to 'week' on each session.
  const [taskCompletedCounts, setTaskCompletedCounts] = useState({
    today: 0, week: 0, month: 0, year: 0,
    weekHistory: Array(12).fill(0),
    monthHistory: Array(12).fill(0),
    dayStreak: 0,
  });
  const [taskCompletedPeriod, setTaskCompletedPeriod] = useState("week");

  // Reset modal edit state when the selected client changes (or closes).
  // Without this, opening client B after editing client A leaves B's modal
  // showing A's stale edit form data — the inputs don't refresh because
  // overviewEditData persists across modal open/close cycles. Same pattern
  // for the relationship-profile edit form. Triggered on selectedClient.id
  // change specifically so re-renders within the same client (eg. saving
  // edits) don't bounce the form.
  //
  // Confirm dialogs (rolodexConfirm, removeConfirm) are reset by the click
  // handlers themselves on each tile open — they're declared further down
  // and aren't safe to reference here.
  useEffect(() => {
    setEditingOverview(false);
    setOverviewEditData({});
    setEditingProfile(false);
    setEditScores({});
    setShowBaselineEdit(false);
  }, [selectedClient?.id]);
  // ═══ DATA LOADING ═══
  const [dataLoaded, setDataLoaded] = useState(false);
  const [hcQueue, setHcQueue] = useState([]);
  const [todayStripOpen, setTodayStripOpen] = useState(false);
  const [tomorrowCalOpen, setTomorrowCalOpen] = useState(false);
  const [laterCalOpen, setLaterCalOpen] = useState(false);
  // Sidebar collapse state — when true, sidebar is 64px wide with icon-only
  // nav, "R." brand mark, and hidden secondary sections (convo list, widget).
  // Persisted in localStorage so user preference survives reloads.
  const SIDEBAR_PIN_BP = 1700; // ≥ this width: sidebar pinned open (always 240). Below: 64px rail + hover-to-open.
  // Hover-to-open state (only meaningful below the pin breakpoint).
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const hoverTimerRef = useRef(null);
  // sidebarCollapsed = "is currently showing as rail (64px)". True below the
  // breakpoint when not hovering; false otherwise. All visual-layout references
  // throughout the sidebar JSX use this flag.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return window.innerWidth < SIDEBAR_PIN_BP; } catch { return false; }
  });
  // Width-driven pin state + content offset on every resize.
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const applyWidthState = () => {
      const pinned = window.innerWidth >= SIDEBAR_PIN_BP;
      if (pinned) setHoverExpanded(false); // hover irrelevant when pinned
      // --content-sidebar-w: what the CONTENT's left edge uses. Below the
      // breakpoint, content stays at the 64px rail edge so the hover-open
      // sidebar floats OVER content. At/above, content sits beside 240.
      document.documentElement.style.setProperty("--content-sidebar-w", pinned ? "240px" : "64px");
      // --sidebar-content-gap: breathing room between sidebar's right edge and
      // content's left edge. Smaller when collapsed (rail), more generous when
      // pinned open. Used in r-main's left calc INSTEAD of --page-gap so the
      // top/right/bottom page margins stay constant (no right-side shift).
      document.documentElement.style.setProperty("--sidebar-content-gap", pinned ? "48px" : "24px");
      // Attribute selector mirror — used by a high-specificity !important rule
      // on .r-main so the gap can't be silently overridden by other CSS.
      document.documentElement.setAttribute("data-sidebar-pin", pinned ? "pinned" : "rail");
    };
    applyWidthState();
    window.addEventListener("resize", applyWidthState);
    return () => window.removeEventListener("resize", applyWidthState);
  }, []);
  // Recompute the visual collapsed flag whenever viewport or hover changes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const recompute = () => {
      const pinned = window.innerWidth >= SIDEBAR_PIN_BP;
      setSidebarCollapsed(!pinned && !hoverExpanded);
    };
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [hoverExpanded]);
  useEffect(() => {
    if (typeof document === "undefined") return;
    // --sidebar-w: the sidebar's actual rendered width (64 rail / 240 expanded).
    document.documentElement.style.setProperty("--sidebar-w", sidebarCollapsed ? "64px" : "240px");
  }, [sidebarCollapsed]);
  // Whether the Rai pick text is expanded on mobile. Desktop ignores this
  // — the clamp only applies via mobile @media. On mobile: false = clamped
  // to 2 lines with fade-out + "More" tap. Resets daily implicitly because
  // the pick changes each morning.
  const [pickExpanded, setPickExpanded] = useState(false);
  // Rai user state — toggle + adaptive frequency state from rai_user_state table.
  // Loaded once on mount in loadData, kept in sync via realtime subscription.
  // Single user-controllable boolean:
  //   - ranking_enabled: "Ranked by Rai / Manual" toggle (eventually replaces localStorage rankMode)
  // Initialized null so we can distinguish "not yet loaded" from "loaded with defaults".
  const [raiState, setRaiState] = useState(null);
  // Active Rai picks — array of 1-3 rows pointing at clients, ordered by rank
  // (1=primary, 2=backup1, 3=backup2). Sweep writes them with 24-hr expiry.
  // Empty array when no active picks (sweep hasn't run, expired, or skipped).
  // The Pick of the Day. Either a row from rai_picks (today's pick) or null
  // (no pick today, or sweep hasn't run yet). Realtime sub keeps this in
  // sync if a fresh sweep lands while app is open.
  const [raiPicks, setRaiPicks] = useState(null);
  // Today timeline — personal calendar events (manual + future Google sync).
  // Currently only manual rows are written from the app. The TodayTimeline
  // widget reads from this state to render the timeline view of today.
  const [personalEvents, setPersonalEvents] = useState([]);
  // Whether the user has dismissed the "Connect Google Calendar" nudge
  // on the Today page. Persisted to profiles.google_cal_prompt_dismissed
  // so it stays dismissed across refreshes/devices. The Settings →
  // Integrations row is unaffected — it always offers the connection.
  const [googleCalPromptDismissed, setGoogleCalPromptDismissed] = useState(false);
  // User's IANA timezone, sourced from profiles.timezone. The single source
  // of truth for any local-day math in the frontend (midnight rollover,
  // recurring-task reset cutoff). Falls back to the device's detected TZ
  // ONLY until the profile loads — never overwrites a stored value from
  // the device (that's how the Eastern-vs-Denver drift bug happened pre-fix).
  // null means "not loaded yet"; effects that depend on it must guard.
  const [userTimezone, setUserTimezone] = useState(null);
  // Google Calendar integration lives in src/hooks/useGoogleCalendar
  // (extracted June 2026). Six regions gathered into one hook.
  const { connectGoogleCalendar, disconnectGoogleCalendar, googleConnectPromptDismissed, googleConnectStatus, googleConnected, googleEmail, googleLastSyncedAt, googleSyncing, setGoogleConnectPromptDismissed, setGoogleConnectStatus, setGoogleConnected, setGoogleEmail, setGoogleLastSyncedAt, syncGoogleCalendar } = useGoogleCalendar({ page, setPage, setPersonalEvents, user });
  // Link-picker state for the inline "needs client" affordance on the
  // Today dial. When a user clicks "needs client" on a dial event row,
  // TimeDial calls onRequestLink with the event id + anchor coordinates,
  // we open a floating picker at those coordinates. Closed by Escape,
  // outside-click, or successful pick/dismiss.
  // Shape: { eventId, anchor: { left, top, right, bottom } } | null
  const [linkPicker, setLinkPicker] = useState(null);
  const [linkPickerSearch, setLinkPickerSearch] = useState("");
  // Burst tracker — per-client timestamp of most recent task creation.
  // Used by the 60s burst rule (with 5-min hard cap) to keep the "Rai's pick"
  // badge from flickering while the user is rapidly creating tasks for a
  // picked client. Lives in a ref so updates don't trigger renders.
  // Shape: { [clientName]: { firstCreatedAt: ms, lastCreatedAt: ms } }
  const raiBurstTrackerRef = useRef({});
  // Mobile bottom nav strip — horizontally scrollable. We auto-scroll the
  // active item into view whenever `page` changes, so navigating to a
  // destination off-screen pulls it into the visible window.
  // Focus mode: laser-focus on top task, dim everything else. Only available in Rai mode.
  // Not persisted — resets to off on each session/page reload.
  const [focusMode, setFocusMode] = useState(false);
  // Dial scrub/day-view state — lifted to App so the Today/Tomorrow + Now pills
  // can live in the gap OUTSIDE the (scaled) dial layer.
  const [dialScrubMs, setDialScrubMs] = useState(0);
  const [dialDayView, setDialDayView] = useState("today"); // "today" | "tomorrow"
  // One-shot flash trigger when entering Focus mode. Cleared after animation completes.
  // (Removed focusFlash state — the lightning entry animation was retired
  // in favor of the calmer/subtler UI language. Focus mode now just toggles
  // its button + dims non-top tasks; no full-screen white burst.)
  // Debug overlay — shows priority score breakdown inline on each task row.
  // Toggle with Cmd+Shift+D (Mac) or Ctrl+Shift+D (Windows). Internal tool;
  // not user-facing.
  const [debugScores, setDebugScores] = useState(false);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        setDebugScores(v => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Cmd+K (or Ctrl+K) opens QuickLog from anywhere in the app. Same
  // muscle memory as command palettes in Linear/Notion/Slack. Esc inside
  // the popover is handled by the popover itself.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setQuickLogOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // Rank mode: 'rai' (default, sorted by Profile Score) or 'manual' (user drag-and-drop order).
  // Persisted in localStorage. Manual order also persisted, restored when user toggles back to manual.
  const [rankMode, _setRankMode] = useState(() => {
    if (typeof window === "undefined") return "rai";
    try { return window.localStorage.getItem("rt_rank_mode") || "rai"; } catch { return "rai"; }
  });
  const setRankMode = (m) => {
    _setRankMode(m);
    if (m !== "rai") setFocusMode(false);
    try { window.localStorage.setItem("rt_rank_mode", m); } catch {}
  };
  // Shared writer for ai_tasks_enabled — used by BOTH the Settings toggle and
  // the Today segmented control (the "(+Tasks)" segment), so the two surfaces
  // never disagree. Optimistic with rollback on error.
  const setAiTasks = (next) => {
    const prevVal = raiState?.ai_tasks_enabled !== false;
    setRaiState(prev => prev ? { ...prev, ai_tasks_enabled: next } : { ai_tasks_enabled: next });
    if (user?.id) {
      supabase.from("rai_user_state")
        .update({ ai_tasks_enabled: next })
        .eq("user_id", user.id)
        .then(({ error }) => {
          if (error) {
            console.error("Failed to save ai_tasks_enabled:", error);
            setRaiState(prev => prev ? { ...prev, ai_tasks_enabled: prevVal } : prev);
          }
        });
    }
  };
  // (moved into useGoogleCalendar — June 2026)
  // (moved into useGoogleCalendar — June 2026)
  // (moved into useGoogleCalendar — June 2026)
  // Dismisses the Today-page connect nudge for this session. Settings
  // row still has the connect button so they can come back to it.
  const dismissGoogleConnectPrompt = () => {
    try { sessionStorage.setItem("rt_gcal_prompt_dismissed", "1"); } catch {}
    setGoogleConnectPromptDismissed(true);
  };
  // Link an unmatched calendar event to a client or rolodex entry.
  // Calls link-calendar-event edge function which also learns aliases
  // from the title and retro-links any other matching unmatched events.
  // Updates local personalEvents state on success.
  const linkCalendarEvent = async ({ eventId, clientId = null, rolodexId = null }) => {
    if (!user?.id || !eventId) return null;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) return null;
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/link-calendar-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({ action: 'link', event_id: eventId, client_id: clientId, rolodex_id: rolodexId }),
      });
      if (!resp.ok) {
        console.error('linkCalendarEvent failed:', resp.status, await resp.text());
        return null;
      }
      const data = await resp.json();
      // Refetch events so we pick up retro-linked changes too.
      try {
        const { data: refreshed } = await supabase.from('personal_calendar_events').select('*').eq('user_id', user.id);
        if (Array.isArray(refreshed)) setPersonalEvents(refreshed);
      } catch (e) { console.warn('refetch after link failed:', e); }
      return data;
    } catch (err) {
      console.error('linkCalendarEvent threw:', err);
      return null;
    }
  };
  // Mark an event as "no client/prospect, don't ask again."
  const dismissCalendarEventLink = async (eventId) => {
    if (!user?.id || !eventId) return null;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) return null;
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/link-calendar-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({ action: 'dismiss', event_id: eventId }),
      });
      if (!resp.ok) return null;
      // Optimistic local update — flip needs_link off
      setPersonalEvents(prev => (prev || []).map(e => e.id === eventId ? { ...e, needs_link: false, link_dismissed: true } : e));
      return await resp.json();
    } catch (err) {
      console.error('dismissCalendarEventLink threw:', err);
      return null;
    }
  };
  // (moved into useGoogleCalendar — June 2026)
  const [manualTaskOrder, _setManualTaskOrder] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("rt_manual_task_order");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const setManualTaskOrder = (order) => {
    _setManualTaskOrder(order);
    try { window.localStorage.setItem("rt_manual_task_order", JSON.stringify(order)); } catch {}
  };
  const [draggingTaskId, setDraggingTaskId] = useState(null);
  // #3 — inline task-title editing. editingTaskId = the task currently being
  // edited in place; editingTaskText = the working draft. Entered via
  // double-click (desktop) or long-press (mobile); saved on Enter/blur,
  // cancelled on Escape. Persists via tasksDb.update.
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editingTaskText, setEditingTaskText] = useState("");
  const longPressTimerRef = useRef(null);
  const beginTaskEdit = (t) => {
    if (t.done) return; // don't edit completed tasks
    setEditingTaskId(t.id);
    setEditingTaskText(t.text || "");
  };
  const commitTaskEdit = () => {
    const id = editingTaskId;
    const next = (editingTaskText || "").trim();
    if (!id) return;
    const orig = tasks.find(t => t.id === id);
    setEditingTaskId(null);
    if (!orig || !next || next === orig.text) return; // no-op on empty/unchanged
    setTasks(prev => prev.map(t => t.id === id ? { ...t, text: next } : t));
    try { tasksDb.setText(id, next); } catch (e) { console.warn("Task title save failed:", e); }
  };
  const cancelTaskEdit = () => { setEditingTaskId(null); setEditingTaskText(""); };
  // Mobile swipe state — tracks touch translation per task ID.
  // swipeOffset[id] = current x offset (negative when swiping left).
  // swipeStartX[id] = the touchStart X coordinate.
  // Used to drag a task left to reveal a "push to next bucket" action.
  const [swipeOffset, setSwipeOffset] = useState({});
  const [swipeStartX, setSwipeStartX] = useState({});
  // Track touchstart Y coord and the gesture lock state per task.
  // Used to commit a gesture as either "scroll" or "swipe" once the
  // user's finger has moved enough to indicate intent (see touch
  // handlers in the task row render). Industry-standard pattern that
  // prevents accidental row drift while scrolling vertically.
  const [swipeStartY, setSwipeStartY] = useState({});
  const [swipeLock, setSwipeLock] = useState({});
  const [dragOverTaskId, setDragOverTaskId] = useState(null);
  const [healthStripOpen, setHealthStripOpen] = useState(false);
  const [retroAnswers, setRetroAnswers] = useState({});
  const [rolodex, setRolodex] = useState([]);
  const [rolodexFlowOpen, setRolodexFlowOpen] = useState(null);
  const [showAddRolodex, setShowAddRolodex] = useState(false);
  const [newRolodexEntry, setNewRolodexEntry] = useState({ client: "", contact: "", work: "", type: "former" });
  const [rolodexConfirm, setRolodexConfirm] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const [pauseConfirm, setPauseConfirm] = useState(false);
  const [resumeConfirm, setResumeConfirm] = useState(false);
  const [clientMenuOpen, setClientMenuOpen] = useState(false);
  const [selectedRolodex, setSelectedRolodex] = useState(null);
  const [rolodexRemoveConfirm, setRolodexRemoveConfirm] = useState(false);
  const [rolodexMenuOpen, setRolodexMenuOpen] = useState(false);
  const [rolodexMoveConfirm, setRolodexMoveConfirm] = useState(false);
  const [rolodexEditing, setRolodexEditing] = useState(false);
  const [rolodexEditData, setRolodexEditData] = useState({});
  const [rolodexSearch, setRolodexSearch] = useState("");
  // Rolodex v2 — step-based retro state. stepOwner ties step + text to a specific entry so switching contacts mid-retro resets cleanly.
  const [rolodexStep, setRolodexStep] = useState(null);
  const [rolodexStepOwner, setRolodexStepOwner] = useState(null);
  const [rolodexStepText, setRolodexStepText] = useState(null);
  const [retroDeleteConfirm, setRetroDeleteConfirm] = useState(false);
  const [rolodexFiledFilter, setRolodexFiledFilter] = useState("all");
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  // Rolodex dot is an ACTION badge (Jun 12, semantics reversed): it
  // persists, across days and page visits, until the due reminder is
  // acted on (the dot recomputes from data) or the check-in banner is
  // dismissed for the day. Merely viewing the Rolodex never clears it.
  // Shares the banner's dismissal key so dot and banner always agree.
  const _rolodexCheckinDismissKey = "rt:rolodexBannerDismissedDay";
  const _todayLocalYmd = () => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  };
  const [rolodexCheckinDismissed, setRolodexCheckinDismissed] = useState(() => {
    try { return window.localStorage.getItem(_rolodexCheckinDismissKey) === _todayLocalYmd(); } catch { return false; }
  });
  const dismissRolodexCheckin = () => {
    setRolodexCheckinDismissed(true);
    try { window.localStorage.setItem(_rolodexCheckinDismissKey, _todayLocalYmd()); } catch (_) { /* unavailable */ }
  };

  // (moved into useGoogleCalendar — June 2026)

  // Cleared→set true when the user opens the Health page, so the "new
  // observation" red dot disappears on visit (without changing the
  // observation's own status — it still shows on the page until unpacked/
  // dropped). Reset to false when a NEW observation arrives.
  const [healthObsSeen, setHealthObsSeen] = useState(false);
  const [reminderDate, setReminderDate] = useState("");
  const [reminderRecur, setReminderRecur] = useState("1m"); // last-picked interval code
  const [reminderRepeatOn, setReminderRepeatOn] = useState(false);
  // Reset per-contact modal state whenever the selected rolodex contact
  // changes (or closes). Without this, the edit form + reminder date from
  // the previously-opened contact carry into the next one — e.g. Magic
  // Scoop's contact name showing on Love Strategies.
  useEffect(() => {
    setRolodexEditing(false);
    setRolodexEditData({});
    setReminderDate("");
    setShowReminderPicker(false);
    setRolodexMenuOpen(false);
    setRolodexMoveConfirm(false);
    setRolodexRemoveConfirm(false);
  }, [selectedRolodex?.id]);
  const [clients, setClients] = useState([]);
  // Move a rolodex contact back into active clients. Creates a fresh
  // client row from the contact's data (name, contact, tenure) at a
  // neutral baseline score, archives the rolodex entry (soft delete),
  // and closes the slide-over. Referrals that referenced the contact by
  // name are left intact — the name still resolves.
  const moveRolodexToClients = async (sr) => {
    if (!sr || !user) return;
    const months = sr.months > 0 ? sr.months : 0;
    const engagementStartedAt = new Date(Date.now() - months * 30 * 24 * 3600 * 1000).toISOString();
    const { data: created, error } = await clientsDb.create(user.id, {
      name: sr.client,
      contact: sr.contact || "",
      role: "",
      tag: "",
      revenue: 0,
      months,
      engagement_started_at: engagementStartedAt,
      lifetime_revenue_at_entry: 0,
      retention_score: 50,
      profile_scores: {},
      qualifying_flags: {},
    });
    if (error) { console.error("Move to clients failed:", error); return; }
    const client = {
      id: created?.id || Date.now(),
      name: sr.client,
      contact: sr.contact || "",
      role: "", tag: "",
      revenue: 0, months,
      lifetime_revenue_at_entry: 0, ltv: 0,
      velocity: "normal", lastHC: null, lastContact: "today",
      referrals: 0, ret: 50, profileScores: {}, qualifyingFlags: {}, daysOld: 0,
    };
    setClients(prev => [...prev, client].sort((a, b) => (b.ret || 0) - (a.ret || 0)));
    // Archive the rolodex entry (soft delete) and drop it from the list.
    setRolodex(prev => prev.filter(x => x.id !== sr.id));
    rolodexDb.delete(sr.id);
    setSelectedRolodex(null);
    setRolodexMoveConfirm(false);
    setRolodexMenuOpen(false);
  };
  // Onboarding quick-create: name-only (contact/retainer optional) at the
  // neutral 50 baseline — same essential writes as submitNewClient minus
  // the profile quiz + review scheduling. The Health empty state drives
  // scoring later; Rai treats unscored clients at baseline until then.
  const quickCreateClient = async (name, contact = "", revenue = 0) => {
    if (!user || !name || !name.trim()) return null;
    const monthlyRate = parseInt(revenue) || 0;
    const todayYmd = localYmd(new Date());
    const { data: created, error } = await clientsDb.create(user.id, {
      name: name.trim(), contact: (contact || "").trim(), role: "", tag: "",
      revenue: monthlyRate, months: 0,
      engagement_started_at: todayYmd,
      lifetime_revenue_at_entry: 0,
      retention_score: 50, profile_scores: {}, qualifying_flags: {},
    });
    if (error) { console.error("Quick client create failed:", error); return null; }
    if (created?.id && monthlyRate > 0) {
      try {
        await supabase.from('client_revenue_history').insert({
          user_id: user.id, client_id: created.id, monthly_rate: monthlyRate,
          started_at: new Date().toISOString(), ended_at: null,
        });
      } catch (e) { console.warn("Quick-add revenue history seed failed:", e); }
    }
    const client = {
      id: created?.id || Date.now(), name: name.trim(), contact: (contact || "").trim(),
      role: "", tag: "", revenue: monthlyRate, months: 0,
      engagement_started_at: todayYmd, lifetime_revenue_at_entry: 0, ltv: 0,
      velocity: "normal", lastHC: null, lastContact: "—", referrals: 0,
      ret: 50, profileScores: {}, qualifyingFlags: {}, daysOld: 0,
    };
    setClients(prev => [...prev, client].sort((a, b) => (b.ret || 0) - (a.ret || 0)));
    return client;
  };
  const [showAddClient, setShowAddClient] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [clientsSort, setClientsSort] = useState("retention");
  // Phase 9 — Rai task dismissal feedback modal.
  // When a Rai-suggested task is dismissed, we open this modal to capture
  // a short reason. The reason replaces the default "user_deleted" string
  // on rai_suggestions.dismiss_reason. The hourly lesson extractor then
  // turns substantive reasons into lessons that propagate to all three
  // Rai surfaces (chat, sweep, observer).
  //
  // State shape: { task, source: 'swipe' | 'button' } or null
  const [dismissModalTask, setDismissModalTask] = useState(null);
  const [dismissReasonChips, setDismissReasonChips] = useState([]);
  const [dismissReasonText, setDismissReasonText] = useState("");
  // Clients page filter chips — see toolbar render. Both default to "all".
  // Drift: one of "all" | "Improving" | "Stable" | "Something shifted" | "Declining" | "At risk"
  // Score: one of "all" | "thriving" | "healthy" | "watch" | "atrisk"
  const [clientsDriftFilter, setClientsDriftFilter] = useState("all");
  const [clientsScoreFilter, setClientsScoreFilter] = useState("all");
  const [clientsView, setClientsView] = useState(() => {
    try { return localStorage.getItem("clients-view") || "table"; } catch (e) { return "table"; }
  });
  // Persist view choice
  useEffect(() => {
    try { localStorage.setItem("clients-view", clientsView); } catch (e) {}
  }, [clientsView]);
  const [newClient, setNewClient] = useState({ name: "", contact: "", role: "", tag: "", revenue: "", months: "", lifetime_revenue_at_entry: "", latePayments: false, prevTerminated: false, otherVendors: false, fromReferral: false });
  const [profileStep, setProfileStep] = useState(0);
  const [profileScores, setProfileScores] = useState({});

  const profileDimensions = [
    { key: "trust", name: "Trust", short: "Trust", desc: "Does this client trust you to do your job?", left: "Heavy oversight", right: "Full delegation", weight: 0.15, values: [0.00, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00] },
    { key: "loyalty", name: "Loyalty", short: "Loyalty", desc: "Is this client looking at other options?", left: "Actively shopping", right: "Locked in, not looking", weight: 0.15, values: [0.00, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00] },
    { key: "expectations", name: "Expectations", short: "Expect.", desc: "Are the client's expectations for your work realistic?", left: "Highly ambitious", right: "Reasonable, aligned", weight: 0.15, values: [0.00, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00] },
    { key: "grace", name: "Grace", short: "Grace", desc: "When something goes wrong, how does this client react?", left: "Zero tolerance", right: "Gives benefit of the doubt", weight: 0.15, values: [0.00, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00] },
    { key: "commFrequency", name: "Communication Frequency", short: "Comm Freq", desc: "How often does the client reach out to you?", left: "Radio silence, you always initiate", right: "Nonstop, multiple times a day", weight: 0.05, values: [0.20, 0.40, 0.60, 0.80, 0.90, 1.00, 0.90, 0.80, 0.60, 0.40, 0.20] },
    { key: "stressResponse", name: "Stress Response", short: "Stress", desc: "When results are bad or something goes wrong, how do you find out?", left: "You don't — they go quiet and deal with it internally", right: "Immediately — they call, escalate, make it known", weight: 0.05, values: [0.05, 0.20, 0.50, 0.85, 1.00, 1.00, 1.00, 0.85, 0.65, 0.40, 0.20] },
    { key: "budgetCommitment", name: "Budget Commitment", short: "Budget", desc: "How likely is budget to become a reason this client leaves?", left: "Very likely, always under budget pressure", right: "Never, budget is a non-issue", weight: 0.05, values: [0.00, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00] },
    { key: "relationshipDepth", name: "Relationship Depth", short: "Depth", desc: "Beyond business, is there a real relationship here?", left: "Strictly transactional", right: "Genuine connection", weight: 0.05, values: [0.20, 0.30, 0.40, 0.60, 0.80, 0.85, 0.90, 0.95, 1.00, 0.95, 0.90] },
    { key: "reportingNeed", name: "Reporting Need", short: "Reporting", desc: "How much reporting does this client need from you?", left: "Hands-off, minimal updates", right: "Wants every detail", weight: 0.05, values: [0.50, 0.80, 0.85, 0.90, 0.95, 1.00, 0.95, 0.90, 0.80, 0.50, 0.20] },
    { key: "replaceability", name: "Replaceability", short: "Replace.", desc: "How easy would it be for this client to replace you?", left: "Plug and play, anyone could do it", right: "Deeply embedded, hard to replace", weight: 0.05, values: [0.00, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00] },
    { key: "commTone", name: "Communication Tone", short: "Tone", desc: "How does this client communicate with you?", left: "Reserved, guarded", right: "Warm, direct", weight: 0.05, values: [0.00, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00] },
    { key: "decisionMaking", name: "Decision Making", short: "Decisions", desc: "How much authority does your primary contact have?", left: "No authority, just a relay", right: "Full authority, makes the call", weight: 0.05, values: [0.00, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00] },
  ];

  // ─── COMBO DEFINITIONS ───
  const COMBOS = [
    { name: "Bulletproof", type: "positive", max: 2, dims: [{ key: "loyalty", dir: "gte", threshold: 8 }, { key: "grace", dir: "gte", threshold: 8 }] },
    { name: "True partner", type: "positive", max: 2, dims: [{ key: "trust", dir: "gte", threshold: 8 }, { key: "relationshipDepth", dir: "gte", threshold: 7 }] },
    { name: "Locked vault", type: "positive", max: 2, dims: [{ key: "loyalty", dir: "gte", threshold: 8 }, { key: "replaceability", dir: "gte", threshold: 7 }] },
    { name: "Smooth operator", type: "positive", max: 1, dims: [{ key: "commTone", dir: "gte", threshold: 8 }, { key: "expectations", dir: "gte", threshold: 7 }] },
    { name: "Resilient under fire", type: "positive", max: 1, dims: [{ key: "stressResponse", dir: "between", threshold: 4, upper: 6 }, { key: "grace", dir: "gte", threshold: 7 }] },
    { name: "All-in investor", type: "positive", max: 1, dims: [{ key: "budgetCommitment", dir: "gte", threshold: 8 }, { key: "trust", dir: "gte", threshold: 7 }] },
    { name: "Decision express", type: "positive", max: 1, dims: [{ key: "decisionMaking", dir: "gte", threshold: 8 }, { key: "commFrequency", dir: "between", threshold: 3, upper: 7 }] },
    { name: "Open book", type: "positive", max: 1, dims: [{ key: "commTone", dir: "gte", threshold: 7 }, { key: "stressResponse", dir: "between", threshold: 4, upper: 6 }] },
    { name: "Sticky by design", type: "positive", max: 1, dims: [{ key: "replaceability", dir: "gte", threshold: 7 }, { key: "relationshipDepth", dir: "gte", threshold: 7 }] },
    { name: "Low maintenance loyalty", type: "positive", max: 1, dims: [{ key: "loyalty", dir: "gte", threshold: 7 }, { key: "reportingNeed", dir: "between", threshold: 2, upper: 5 }] },
    { name: "Ticking time bomb", type: "negative", max: 2, dims: [{ key: "expectations", dir: "lte", threshold: 3 }, { key: "grace", dir: "lte", threshold: 3 }] },
    { name: "On the clock", type: "negative", max: 2, dims: [{ key: "trust", dir: "lte", threshold: 3 }, { key: "loyalty", dir: "lte", threshold: 3 }] },
    { name: "No room to operate", type: "negative", max: 2, dims: [{ key: "trust", dir: "lte", threshold: 3 }, { key: "grace", dir: "lte", threshold: 3 }] },
    { name: "One foot out", type: "negative", max: 2, dims: [{ key: "loyalty", dir: "lte", threshold: 3 }, { key: "replaceability", dir: "lte", threshold: 3 }] },
    { name: "Silent exit", type: "negative", max: 1, dims: [{ key: "stressResponse", dir: "lte", threshold: 2 }, { key: "commFrequency", dir: "lte", threshold: 2 }] },
    { name: "Powder keg", type: "negative", max: 1, dims: [{ key: "stressResponse", dir: "gte", threshold: 8 }, { key: "expectations", dir: "lte", threshold: 3 }] },
    { name: "Ice wall", type: "negative", max: 1, dims: [{ key: "commTone", dir: "lte", threshold: 3 }, { key: "trust", dir: "lte", threshold: 3 }] },
    { name: "Nickel and dime", type: "negative", max: 1, dims: [{ key: "budgetCommitment", dir: "lte", threshold: 2 }, { key: "reportingNeed", dir: "gte", threshold: 8 }] },
    { name: "No anchor", type: "negative", max: 1, dims: [{ key: "relationshipDepth", dir: "lte", threshold: 2 }, { key: "replaceability", dir: "lte", threshold: 3 }] },
    { name: "Bottleneck doom", type: "negative", max: 1, dims: [{ key: "decisionMaking", dir: "lte", threshold: 3 }, { key: "expectations", dir: "lte", threshold: 4 }] },
  ];

  // ─── COMBO STRENGTH CALC ───
  const calcComboStrength = (dimDef, rawVal) => {
    if (rawVal == null) return null;
    if (dimDef.dir === "gte") { if (rawVal < dimDef.threshold) return null; const r = 10 - dimDef.threshold; return r === 0 ? 1 : 0.2 + ((rawVal - dimDef.threshold) / r) * 0.8; }
    if (dimDef.dir === "lte") { if (rawVal > dimDef.threshold) return null; const r = dimDef.threshold; return r === 0 ? 1 : 0.2 + ((dimDef.threshold - rawVal) / r) * 0.8; }
    if (dimDef.dir === "between") { if (rawVal < dimDef.threshold || rawVal > dimDef.upper) return null; const mid = (dimDef.threshold + dimDef.upper) / 2; const hr = (dimDef.upper - dimDef.threshold) / 2; return hr === 0 ? 1 : 0.2 + ((hr - Math.abs(rawVal - mid)) / hr) * 0.8; }
    return null;
  };

  const calcCombos = (scores) => {
    const dimWeights = {};
    profileDimensions.forEach(d => { dimWeights[d.key] = d.weight; });
    const triggered = [];
    for (const combo of COMBOS) {
      const strengths = combo.dims.map(d => calcComboStrength(d, scores[d.key]));
      if (strengths.some(s => s === null)) continue;
      let ws = 0, tw = 0;
      combo.dims.forEach((d, i) => { ws += strengths[i] * (dimWeights[d.key] || 0.05); tw += (dimWeights[d.key] || 0.05); });
      const norm = tw > 0 ? ws / tw : 0;
      const value = Math.round(norm * combo.max * 100) / 100;
      triggered.push({ name: combo.name, type: combo.type, max: combo.max, value: combo.type === "negative" ? -value : value, strength: Math.round(norm * 100) });
    }
    return triggered;
  };


  // ─── RETENTION SCORE (dimensions + combos + HC blend) ───
  const calcRetentionScore = (scores, hcAnswersArr, qualFlags = null, months = 0) => {
    let weightedSum = 0, totalWeight = 0, scored = 0;
    for (const dim of profileDimensions) {
      const raw = scores[dim.key];
      if (raw == null || raw === "") continue;
      const val = dim.values[Math.round(Math.max(0, Math.min(10, raw)))];
      const rw = dim.weight;
      weightedSum += val * rw;
      totalWeight += rw;
      scored++;
    }
    if (totalWeight === 0) return null;
    // Renormalize if not all dimensions scored
    const dimensionScore = Math.round((weightedSum / totalWeight) * 100);

    // Combos
    const triggered = calcCombos(scores);
    const positives = triggered.filter(c => c.type === "positive").sort((a, b) => b.value - a.value);
    const negatives = triggered.filter(c => c.type === "negative").sort((a, b) => a.value - b.value);
    const posH = [1.0, 0.75, 0.50, 0.25, 0.125, 0.0625, 0.03, 0.015, 0.01, 0.005];
    const negD = [1.0, 0.90, 0.80, 0.70, 0.60, 0.50, 0.40, 0.30, 0.20, 0.10];
    let pt = 0, nt = 0;
    positives.forEach((c, i) => { c.dm = posH[i] || 0.005; c.dv = Math.round(c.value * c.dm * 100) / 100; pt += c.dv; });
    negatives.forEach((c, i) => { c.dm = negD[i] || 0.10; c.dv = Math.round(c.value * c.dm * 100) / 100; nt += c.dv; });
    const comboTotal = Math.round((pt + nt) * 100) / 100;
    const baselineScore = dimensionScore + Math.round(comboTotal);

    // Score is 100% baseline (dimensions + combos). Health-check blend removed
    // May 2026 — the profile dimensions assess relationship health directly, so
    // we drive the user to keep profiles current rather than collect a weaker
    // separate health-check signal. Qual flags + tenure still adjust below.
    let finalScore = baselineScore;

    // Qualifying question adjustments
    if (qualFlags) {
      if (qualFlags.latePayments) finalScore -= 4;
      if (qualFlags.prevTerminated) finalScore -= 8;
      if (qualFlags.otherVendors) finalScore -= 3;
      if (qualFlags.fromReferral) finalScore += 2;
    }

    // Tenure bonus: +1 per year, cap +5
    const tenureYears = Math.floor((months || 0) / 12);
    finalScore += Math.min(5, tenureYears);

    // Block 0 and 100, clamp 1-99
    if (finalScore <= 0) finalScore = 1;
    if (finalScore >= 100) finalScore = 99;
    finalScore = Math.max(1, Math.min(99, finalScore));

    return finalScore;
  };

  // ─── PROFILE SCORE (invisible sort layer) ───
  const percentileRank = (arr, val) => { if (arr.length <= 1) return 0.5; const s = [...arr].sort((a, b) => a - b); return s.indexOf(val) / (s.length - 1); };

  // Referral-adjusted LTV: client's own honest LTV + 50% of revenue from
  // clients they referred. Honest LTV = lifetime_revenue_at_entry +
  // sum(monthly_rate × time_in_period) across the client_revenue_history table.
  // Computed at hydration time and stored as `client.ltv`. Rate changes go
  // through revenueHistoryDb.changeRate which triggers a fresh hydration.
  //
  // Referrals stay on the same model — they're an estimate of attribution
  // value, not historical revenue. We pull the referred client's honest LTV
  // from their `ltv` field too, falling back to a 12-month estimate for
  // referrals where the referred-to is not yet a Retayned client.
  // ─── Tenure math ─────────────────────────────────────────────
  // Single source of truth for "how long has this client been with
  // us." Uses engagement_started_at (immutable date set at signup)
  // and subtracts any pause intervals from client_engagement_pauses.
  //
  // Why a date column instead of a stored months integer:
  //   - A stored months value never grows, drifts wrong as time passes
  //   - A date is immutable, derivation always reflects current moment
  //   - Matches how every world-class CRM handles tenure (Stripe,
  //     Salesforce, HubSpot all store dates and derive durations)
  //
  // Pause handling: each pause subtracts (resumed_at - paused_at) from
  // total elapsed. If currently paused (resumed_at = null), use now as
  // the end of the open pause so tenure freezes during the pause.
  const monthsTogether = (client, pausesByClient) => {
    if (!client?.engagement_started_at) return 0;
    const MS_PER_MONTH = 30.44 * 24 * 60 * 60 * 1000;
    const startMs = new Date(client.engagement_started_at).getTime();
    const nowMs = Date.now();
    let elapsedMs = nowMs - startMs;
    const pauses = (pausesByClient && pausesByClient[client.id]) || [];
    for (const p of pauses) {
      const pStart = new Date(p.paused_at).getTime();
      const pEnd = p.resumed_at ? new Date(p.resumed_at).getTime() : nowMs;
      elapsedMs -= Math.max(0, pEnd - pStart);
    }
    return Math.max(0, Math.floor(elapsedMs / MS_PER_MONTH));
  };

  const isCurrentlyPaused = (clientId, pausesByClient) => {
    const pauses = (pausesByClient && pausesByClient[clientId]) || [];
    return pauses.some(p => !p.resumed_at);
  };

  const getAdjustedLTV = (client) => {
    const ownLTV = Number(client.ltv || 0);
    const referralRevenue = refs
      .filter(r => r.from === client.name && (r.status === "converted" || r.converted))
      .reduce((sum, r) => {
        const referredClient = clients.find(c => c.name === r.to);
        const refLTV = referredClient
          ? Number(referredClient.ltv || 0)
          : (r.revenue || 0) * 12;
        return sum + refLTV;
      }, 0);
    return ownLTV + (referralRevenue * 0.50);
  };

  const calcProfileScore = (rs, client, allClients) => {
    if (rs == null || allClients.length === 0) return rs || 0;
    const total = allClients.reduce((a, c) => a + (c.revenue || 0), 0);
    const avg = 1 / allClients.length;
    const revFactor = total > 0 ? ((client.revenue || 0) / total) / avg : 1;
    // Tightened ceiling: was 1.50, now 1.25. A client at 2-3× book-average revenue
    // no longer triggers a 50% multiplier — caps at 25%.
    const revNorm = Math.max(0.75, Math.min(1.25, 0.4 + revFactor * 0.6));
    const ltvF = 0.8 + percentileRank(allClients.map(c => getAdjustedLTV(c)), getAdjustedLTV(client)) * 0.4;
    const tenF = 0.8 + percentileRank(allClients.map(c => c.months || 0), client.months || 0) * 0.4;
    // Lowered floor: was 0.90, now 0.75. Lets struggling clients actually sink.
    const multiplier = Math.max(0.75, revNorm * 0.60 + ltvF * 0.20 + tenF * 0.20);
    const raw = rs * multiplier;
    // Soft compression: anything <= 85 untouched. Above 85, compress excess
    // to 50% so top-tier differences still register but don't dominate.
    // No hard ceiling — the score flows raw through to sort comparators.
    // Display layers round/cap for UI (the badge shows 99 max), but sort
    // needs the true magnitudes to break ties between top clients.
    const T = 85;
    const ratio = 0.50;
    const softClamped = raw <= T ? raw : T + (raw - T) * ratio;
    return Math.max(1, softClamped);
  };

  // Debug-only: returns the UNCAPPED raw value before the Math.min(99, ...) clamp.
  // Used by the debug overlay to surface true math so we can see how much
  // the 99-clamp is collapsing the top tier into ties.
  // Same logic as calcProfileScore but skips the upper clamp.
  const calcProfileScoreRaw = (rs, client, allClients) => {
    if (rs == null || allClients.length === 0) return rs || 0;
    const total = allClients.reduce((a, c) => a + (c.revenue || 0), 0);
    const avg = 1 / allClients.length;
    const revFactor = total > 0 ? ((client.revenue || 0) / total) / avg : 1;
    const revNorm = Math.max(0.75, Math.min(1.25, 0.4 + revFactor * 0.6));
    const ltvF = 0.8 + percentileRank(allClients.map(c => getAdjustedLTV(c)), getAdjustedLTV(client)) * 0.4;
    const tenF = 0.8 + percentileRank(allClients.map(c => c.months || 0), client.months || 0) * 0.4;
    const multiplier = Math.max(0.75, revNorm * 0.60 + ltvF * 0.20 + tenF * 0.20);
    // No upper clamp — return the raw multiplied value (rounded for readability).
    return Math.round(rs * multiplier * 10) / 10;  // one decimal for visibility
  };

  // ─── NEW CLIENT BOOST ───
  const calcNewClientBoost = (rs, revPct, daysSinceStart) => {
    if (rs < 40 || daysSinceStart >= 30) return 0;
    const bonusPts = Math.min(17.5, 17.5 * Math.pow(Math.min(revPct, 0.50) / 0.40, 0.50));
    const decay = Math.max(0, 1 - (daysSinceStart / 30));
    return Math.round(bonusPts * decay);
  };

  const submitNewClient = async () => {
    const qualFlags = { latePayments: newClient.latePayments, prevTerminated: newClient.prevTerminated, otherVendors: newClient.otherVendors, fromReferral: newClient.fromReferral };
    const baseline = calcRetentionScore(profileScores, null, qualFlags, parseInt(newClient.months) || 0);
    const monthlyRate = parseInt(newClient.revenue) || 0;
    const preEntryBaseline = parseFloat(newClient.lifetime_revenue_at_entry) || 0;
    const tenureMonths = parseInt(newClient.months) || 0;
    // Translate months input → engagement_started_at (immutable date).
    // User says "started 6 months ago", we store today - 6 months as the
    // start date. From there, tenure grows automatically over time.
    const engagementStart = new Date();
    engagementStart.setMonth(engagementStart.getMonth() - tenureMonths);
    const engagementStartedAt = localYmd(engagementStart);

    // Insert into Supabase first
    const { data: created, error } = await clientsDb.create(user.id, {
      name: newClient.name,
      contact: newClient.contact,
      role: newClient.role || "",
      tag: newClient.tag || "",
      revenue: monthlyRate,
      months: tenureMonths, // kept for migration window; engagement_started_at is the truth
      engagement_started_at: engagementStartedAt,
      lifetime_revenue_at_entry: preEntryBaseline,
      retention_score: baseline || 50,
      profile_scores: { ...profileScores },
      qualifying_flags: qualFlags,
    });

    if (error) { console.error("Failed to create client:", error); return; }

    // Open initial revenue history row. started_at is now() — going forward,
    // Retayned tracks the truth. Pre-Retayned earnings live in
    // lifetime_revenue_at_entry as the user's reported baseline.
    if (created?.id && monthlyRate > 0) {
      try {
        await supabase.from('client_revenue_history').insert({
          user_id: user.id,
          client_id: created.id,
          monthly_rate: monthlyRate,
          started_at: new Date().toISOString(),
          ended_at: null,
        });
      } catch (e) {
        console.warn("Failed to seed revenue history for new client:", e);
        // Non-fatal — client is created. Revenue history can be added later.
      }
    }

    const client = {
      id: created?.id || Date.now(),
      name: newClient.name,
      contact: newClient.contact,
      role: newClient.role,
      tag: newClient.tag,
      revenue: monthlyRate,
      months: tenureMonths,
      lifetime_revenue_at_entry: preEntryBaseline,
      // Initial LTV: just the pre-entry baseline. The history row was just
      // opened so months_in_period ≈ 0 → contributes ~$0 today, grows from
      // here. Re-hydration on next load picks up the real history-based math.
      ltv: preEntryBaseline,
      velocity: "normal",
      lastHC: null,
      lastContact: "today",
      referrals: 0,
      ret: baseline || 50,
      profileScores: { ...profileScores },
      qualifyingFlags: qualFlags,
      daysOld: 0,
    };
    setClients([...clients, client].sort((a, b) => (b.ret || 0) - (a.ret || 0)));

    // ─── Schedule the client's first quarterly portfolio review ──────────
    // Random 80-110 day offset (31-day spread) so first reviews don't pile up
    // when clients are bulk-added, and land ~a quarter after entry. Recurs
    // every 90 days from there (scheduleNext). Backed by the health_checks
    // table (legacy name) which now stores review due-dates.
    try {
      const offsetDays = 80 + Math.floor(Math.random() * 31); // 80..110 inclusive
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + offsetDays);
      const dueDateStr = localYmd(dueDate);

      const clientId = created?.id || client.id;
      let hcResult = null;
      if (hcDb.create) {
        hcResult = await hcDb.create(user.id, {
          client_id: clientId,
          due_date: dueDateStr,
        });
      } else if (hcDb.scheduleNext) {
        // Fallback — 30-day default if hcDb.create isn't exported yet.
        hcResult = await hcDb.scheduleNext(user.id, clientId);
      }

      // Append the new HC to local hcQueue so Health page reflects reality
      // without a full reload. By definition this is the client's first HC
      // (runnable via Start Early), so stamp isFirstHC: true.
      const newHcRow = hcResult?.data;
      if (newHcRow) {
        const today = new Date();
        today.setHours(0,0,0,0);
        const hcDueDate = newHcRow.due_date ? new Date(newHcRow.due_date) : dueDate;
        const daysUntil = Math.max(0, Math.ceil((hcDueDate - today) / (1000*60*60*24)));
        setHcQueue(prev => [...prev, {
          id: newHcRow.id,
          client_id: clientId,
          client: newClient.name,
          ret: client.ret || 0,
          due: hcDueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          due_date: hcDueDate.toISOString(),
          overdue: 0,
          isFirstHC: true,
          runnable: true,
          daysUntil: daysUntil,
        }]);
      }
    } catch (e) {
      console.warn("Health check auto-schedule failed (non-fatal):", e);
    }
    // ──────────────────────────────────────────────────────────────────────

    setShowAddClient(false);
    setNewClient({ name: "", contact: "", role: "", tag: "", revenue: "", months: "", lifetime_revenue_at_entry: "" });
    setProfileStep(0);
    setProfileScores({});
  };

  // Today — task manager
  const [tasks, setTasks] = useState([]);
  // ─── First-run onboarding effects (state lives near brainDumpOpen) ───
  // Welcome: once per device, only for zero-client zero-task accounts.
  const onbCheckedRef = useRef(false);
  useEffect(() => {
    if (onbCheckedRef.current || !dataLoaded) return;
    onbCheckedRef.current = true;
    if (!welcomed && clients.length === 0 && tasks.length === 0) {
      setOnboardingStep("welcome");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLoaded]);
  // Advance task → book on the FIRST task created via ANY path
  // (composer, capture sheet, Brain Dump) — watching tasks.length
  // covers them all without touching each submit handler.
  useEffect(() => {
    if (onboardingStep === "task" && tasks.length > 0) setOnboardingStep("book");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardingStep, tasks.length]);
  // Task IDs whose done-state is mid-write to the DB. loadData (which fires on
  // tab focus / visibilitychange) must NOT overwrite these with stale DB rows,
  // or an optimistic check gets silently reverted — the intermittent
  // "I checked it and it didn't take" bug.
  const inFlightToggles = useRef(new Set());

  // 30s priority hold tick: when a new task is added in Rai mode, it floats
  // to top for 30 seconds (see raiCompare). Once that window expires we need
  // a re-render so it sorts naturally. This effect schedules a tick at the
  // exact expiry moment of the most recent task.
  const [, forceRerender] = useState(0);
  useEffect(() => {
    const now = Date.now();
    const HOLD_MS = 30000;
    const heldTasks = tasks.filter(t => t.created_at && (now - t.created_at) < HOLD_MS);
    if (heldTasks.length === 0) return;
    // Find the soonest expiry
    const soonestExpiry = Math.min(...heldTasks.map(t => t.created_at + HOLD_MS));
    const delay = Math.max(50, soonestExpiry - now);
    const timer = setTimeout(() => forceRerender(n => n + 1), delay);
    return () => clearTimeout(timer);
  }, [tasks]);

  // Auto-exit focus mode when there are zero incomplete tasks ANYWHERE in the
  // list (today + tomorrow + later all complete or empty). Without this, focus
  // mode dims every row and the page looks broken. Only fires when tasks are
  // actually loaded (length > 0) to avoid running during initial fetch.
  useEffect(() => {
    if (!focusMode) return;
    if (tasks.length === 0) return; // still loading, don't trigger
    const hasIncomplete = tasks.some(t => !t.done);
    if (!hasIncomplete) {
      setFocusMode(false);
    }
  }, [focusMode, tasks]);

  // Tracks tasks just completed within the last ~700ms so the pulse animation only fires
  // on the actual click, not on every re-render where t.done is true.
  const [justCompletedIds, setJustCompletedIds] = useState({});
  // Tasks that have been completed and are now hidden from the active bucket
  // list (they live in the "Completed today" expandable group below all
  // buckets). 5 seconds after a task is checked off, it gets added to this set.
  // Keyed by task id → true.
  const [collapsedDoneIds, setCollapsedDoneIds] = useState({});
  // Brief intermediate state between "completed" and "collapsed" — the task is
  // playing its exit animation (max-height shrink + fade). Lives ~360ms.
  const [exitingDoneIds, setExitingDoneIds] = useState({});
  // True only for a brief window right after a task completes, so the
  // break-out top task plays its entry animation when the NEXT task promotes
  // into the slot — NOT on every page mount/navigation (which was causing a
  // spurious right-to-left swing whenever you returned to the Today tab).
  const [justPromoted, setJustPromoted] = useState(false);
  // Tracks the id of the current top/breakout task (Today bucket index 0).
  // Render keeps this updated; the completion handler reads it to fire the
  // promote animation ONLY when the top task itself leaves (a real promotion),
  // not when a lower task completes (which doesn't move the top slot).
  const topTaskIdRef = useRef(null);
  // Whether the "Completed today" log is expanded. Defaults to collapsed.
  const [completedLogOpen, setCompletedLogOpen] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [newTaskRecurring, setNewTaskRecurring] = useState(false);
  // Recurrence pattern shape (when newTaskRecurring is true):
  //   { kind: "daily" }
  //   { kind: "weekdays" }                        — Mon-Fri only
  //   { kind: "weekly", days: [1,3,5] }           — 0=Sun, 1=Mon, ..., 6=Sat (multi-select)
  //   { kind: "monthly_date", day: 15 }           — "On the 15th of each month"
  //   { kind: "monthly_weekday", week: 3, day: 2 } — "On the 3rd Tuesday of each month"
  // Defaults to daily for backward-compat with existing tasks created before this column.
  const [newTaskRecurrencePattern, setNewTaskRecurrencePattern] = useState({ kind: "daily" });
  // Composer Due chip — null means no due date (renders in Today bucket).
  // Stores YYYY-MM-DD string. Mutually exclusive with newTaskRecurring (selecting
  // recurring clears due date; selecting due date clears recurring).
  const [newTaskDueDate, setNewTaskDueDate] = useState(null);
  // Provenance tracking for parser-set recurrence/date. When the parser
  // detects "every thursday" it sets the recurrence chip AND records what
  // it set here. On a later keystroke, if the parser no longer finds a
  // recurrence/date phrase AND the current chip state still matches what
  // the parser last set, we know the user deleted the trigger phrase —
  // so we clear the chip. If the state DIFFERS from the parser's last
  // value, the user changed it manually via the chip menu — we leave it
  // alone. null = parser hasn't set anything (any current state is manual).
  const parserSetRecurrenceRef = useRef(null); // last pattern the parser set
  const parserSetDueDateRef = useRef(null);    // last YMD the parser set
  // ─── V5 ghost-autocomplete + readout state ─────────────────────────
  // Ghost: a string of text appended visually (in muted grey) after the
  // user's typed content, showing the suggested completion. Press Tab to
  // accept. Updated on every keystroke; cleared when the user types past
  // the suggestion or backs out of it.
  const [composerGhost, setComposerGhost] = useState("");
  // Readout: a one-line Fraunces italic summary below the input showing
  // what Rai will create from the current input. Appears only after the
  // user pauses typing for COMPOSER_PAUSE_MS — gives "smart silence"
  // (ghost during active typing, readout during pause; they never both
  // show at once).
  const [composerInPause, setComposerInPause] = useState(false);
  const composerPauseTimerRef = useRef(null);
  // Pulse-chip state: the most recent chip auto-filled by parseComposer.
  // Triggers a one-shot CSS pulse on the chip button so the user gets a
  // visible confirmation when the parser catches something they typed.
  // Auto-clears after the animation finishes so the next pulse fires fresh.
  const [pulseChip, setPulseChip] = useState(null); // "client" | "worker" | "due" | null
  const pulseTimerRef = useRef(null);
  const triggerChipPulse = (which) => {
    setPulseChip(which);
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = setTimeout(() => setPulseChip(null), 600);
  };
  // Date picker popover state — opens when Due chip is clicked
  const [duePickerOpen, setDuePickerOpen] = useState(false);
  // Type override — lets the user manually pick task/touchpoint/event when
  // the parser's heuristics would route them somewhere else. `null` means
  // "auto-detect via parser"; otherwise it's the chosen type. Reset on
  // submit. Companion picker-open state controls the popover.
  const [composerTypeOverride, setComposerTypeOverride] = useState(null);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  // Mode-selector dropdown in the Today section header. Controls the
  // ranking-mode menu (Task & Rank / Ranked / Manual). Replaces the
  // separate toolbar row that used to live between composer and tasks.
  const [todayModeMenuOpen, setTodayModeMenuOpen] = useState(false);
  // Which task row's inline due-picker popover is open (desktop). Null = none.
  const [rowDuePickerId, setRowDuePickerId] = useState(null);
  // Screen-space anchor for the row due-picker. The popover renders in a
  // portal at document.body level so it escapes the bucket's opacity:0.76
  // (which both dimmed the menu AND trapped it in a stacking context).
  // Stored as the pill's measured viewport rect.
  const [rowDuePickerRect, setRowDuePickerRect] = useState(null);
  const [rowDuePickerActions, setRowDuePickerActions] = useState(null);
  // Close the row due-picker on any click outside the popover/pill, or on
  // Escape. Document-level listener instead of a backdrop element — a fixed
  // backdrop nested inside the row gets trapped in the row's stacking
  // context (z-index 70 when open), which caused flicker and swallowed the
  // close click. Listening on document sidesteps stacking entirely.
  useEffect(() => {
    if (rowDuePickerId == null) return;
    const onDown = (e) => {
      if (e.target.closest && e.target.closest(".rt-row-due-pop")) return; // click inside menu
      if (e.target.closest && e.target.closest(".rt-row-due")) return;     // click on the pill itself (toggles)
      setRowDuePickerId(null); setRowDuePickerRect(null); setRowDuePickerActions(null);
    };
    const onKey = (e) => { if (e.key === "Escape") { setRowDuePickerId(null); setRowDuePickerRect(null); setRowDuePickerActions(null); } };
    const onScroll = () => { setRowDuePickerId(null); setRowDuePickerRect(null); setRowDuePickerActions(null); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [rowDuePickerId]);
  // Mobile: the month calendar inside the Due picker is collapsed by
  // default and revealed when the user taps "Later" — keeps the picker
  // compact (4 short rows) instead of a tall sheet. Desktop always
  // shows the calendar (plenty of room), so this only gates mobile.
  const [dueShowCalendar, setDueShowCalendar] = useState(false);
  const dueChipRef = useRef(null);
  const [duePickerPos, setDuePickerPos] = useState(null);
  // Mobile: pin the Due picker fixed, just below the composer, aligned
  // to the left content gutter (16px) and full content width. We derive
  // the vertical position from the Due chip's own rect (always visible
  // when the picker is open) — chip.bottom + a gap clears the composer
  // row. This attaches it visually to the composer without depending on
  // the chip's horizontal position (which, being rightmost, is what
  // broke every left/right anchor attempt).
  useEffect(() => {
    if (!duePickerOpen || !isMobile) { setDuePickerPos(null); return; }
    const measure = () => {
      const el = dueChipRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setDuePickerPos({ top: r.bottom + 10 });
    };
    measure();
    // Track the composer as the page scrolls/resizes so the fixed
    // picker stays glued beneath it instead of detaching on scroll.
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [duePickerOpen, isMobile, dueShowCalendar]);
  // Renewal date picker popover state — used by the client profile edit
  // form (replaces the native <input type="date"> which renders poorly
  // and inconsistently on mobile, and doesn't match the site's picker
  // pattern). Uses the same .rt-picker-panel + calendar grid as the
  // composer Due picker, minus the Today/Tomorrow/Later/Recurring quick
  // options — a renewal date is a specific future calendar date, not a
  // bucket like a task due date.
  const [renewalPickerOpen, setRenewalPickerOpen] = useState(false);
  // Standalone "set renewal" modal — a focused one-field editor so users don't
  // have to enter the full client edit form just to set a renewal date.
  // Holds { client, date, recurrence } while open; null = closed.
  const [renewalModal, setRenewalModal] = useState(null);
  const [renewalModalMonth, setRenewalModalMonth] = useState("");
  const [renewalCalendarMonth, setRenewalCalendarMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  // Calendar grid: which month is currently shown in the date picker.
  // Stored as YYYY-MM string. Defaults to current month; resets on picker open.
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // ─── Workers state ──
  const [workersList, setWorkersList] = useState([]);
  // All historical completions attributed to workers. Read from
  // task_completions table on hydration. The in-memory `tasks` array
  // is only today's open tasks — completion history older than today
  // would otherwise be lost when recurring tasks get rolled over each
  // midnight (tasks.completed_at is nulled by the rollover).
  // This array is the source of truth for cross-time worker stats.
  const [workerCompletions, setWorkerCompletions] = useState([]);
  // Occurrence-model state — populated alongside workerCompletions during
  // hydration. Each row is one (template, date) record. Used by Phase 3
  // readers behind the corresponding `occurrence_flags` feature flag.
  const [taskOccurrences, setTaskOccurrences] = useState([]);
  const [occurrenceFlags, setOccurrenceFlags] = useState({});
  const [newTaskWorkerId, setNewTaskWorkerId] = useState(null);   // composer: assigned worker for new task
  const [workerPickerOpen, setWorkerPickerOpen] = useState(false); // composer popover
  const [addWorkerOpen, setAddWorkerOpen] = useState(false);       // add-worker modal
  const [newWorkerName, setNewWorkerName] = useState("");
  const [newWorkerEmail, setNewWorkerEmail] = useState("");
  const [newWorkerRole, setNewWorkerRole] = useState("");
  // Touchpoint data layer is intact (allTouchpoints + tpLogged still load from DB
  // for rhythm calc and history) — only the manual Log UI was removed.
  const [tpLogged, setTpLogged] = useState([]);
  const [allTouchpoints, setAllTouchpoints] = useState([]);
  const [allCompletions, setAllCompletions] = useState([]);
  // Engagement pauses, keyed by client_id. Each value is an array of
  // { id, paused_at, resumed_at, reason, note }. Loaded once at
  // hydration, mutated optimistically when user clicks pause/resume.
  const [engagementPausesByClient, setEngagementPausesByClient] = useState({});
  const [confetti, setConfetti] = useState(false);
  // ─── Today v4 state ──
  const [todayFocusId, setTodayFocusId] = useState(null);
  const [todayDismissed, setTodayDismissed] = useState({});
  const [todayComposerDue, setTodayComposerDue] = useState("today");
  const [todayComposerClient, setTodayComposerClient] = useState("");
  const [todayComposerMenu, setTodayComposerMenu] = useState(false);
  const [todayComposerQuery, setTodayComposerQuery] = useState("");
  // Highlighted index in the client picker dropdown (for keyboard nav).
  // -1 = nothing highlighted yet (let Enter fall through to first match).
  const [composerHighlight, setComposerHighlight] = useState(0);
  const [todayCompletedOpen, setTodayCompletedOpen] = useState(false);

  // ─── Observer card state ──
  const [observation, setObservation] = useState(null);
  const [obsDismissing, setObsDismissing] = useState(false);
  // Mobile observer "More" tap state. Default collapsed: card shows only
  // topbar + headline + action row. Tap "More" → body, metadata, metric
  // strip reveal. Desktop ignores this state (CSS always shows expanded
  // content). Resets per observation (different obs.id → reset to false).
  const [obsMobileExpanded, setObsMobileExpanded] = useState(false);

  // ─── Daybook removed — replaced by RaiBriefPanel in the right rail. ──

  // ═══ FETCH ALL DATA ON MOUNT ═══
  // These three states are set by loadData; declared here (above the
  // useDataLoad call) so the ctx object can reference their setters.
  const [clientDrift, setClientDrift] = useState({});
  const [refs, setRefs] = useState([]);
  const [raiConvoList, setRaiConvoList] = useState([]);
  // Hydration layer lives in src/hooks/useDataLoad (extracted June 2026).
  const loadData = useDataLoad({ clients, getAdjustedLTV, googleConnected, googleEmail, inFlightToggles, isCurrentlyPaused, monthsTogether, observation, page, profileScores, raiPicks, rolodex, setAllCompletions, setAllTouchpoints, setBillingMonthStatus, setBillingTerms, setClientAddons, setClientBilling, setClientDrift, setClients, setCollapsedDoneIds, setDataLoaded, setEngagementPausesByClient, setGoogleConnected, setGoogleEmail, setGoogleLastSyncedAt, setHcQueue, setObsMobileExpanded, setObservation, setOccurrenceFlags, setPersonalEvents, setRaiConvoList, setRaiPicks, setRaiState, setRefs, setRetroAnswers, setRolodex, setTaskCompletedCounts, setTaskOccurrences, setTasks, setTpLogged, setWorkerCompletions, setWorkersList, taskOccurrences, tasks, user, userTimezone });


  useEffect(() => { loadData(); }, [loadData]);

  // ─── LTV addon adjustment ─────────────────────────────────────
  // The main clients hydration computes LTV from retainer history
  // only (lifetime_revenue_at_entry + monthly_rate × months). Addons
  // load separately (lazy fetch on the Billing tab path). When they
  // arrive, patch each client's LTV to include their addon sum so
  // every downstream consumer (network map, profile-score math,
  // referral-adjusted LTV) sees the complete number.
  //
  // The base LTV (retainer-only) is stashed on `ltv_retainer` so we
  // can recompute the total cleanly whenever addons change — avoids
  // double-adding if this effect fires multiple times.
  useEffect(() => {
    if (!clients || clients.length === 0) return;
    setClients(prev => prev.map(c => {
      const base = c.ltv_retainer != null ? c.ltv_retainer : Number(c.ltv || 0);
      const addonSum = (clientAddons[c.id] || []).reduce((s, a) => s + Number(a.amount || 0), 0);
      return {
        ...c,
        ltv_retainer: base,
        ltv: base + addonSum,
      };
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientAddons]);


  // [Removed Jun 2026] BADGE STATE MANAGER — the "Rai's pick" per-task badge
  // (purple dot on whichever task carried the daily pick) has been deprecated
  // in favor of client-level picks only. The rai_user_state table never had
  // the `todays_badged_task_id` column added to match the App.jsx writer, so
  // every write was a 400. Removing the effect, the readers, and the renderers.

  // Hydrate profile-derived state: timezone, Google Cal prompt dismissal.
  //
  // Timezone policy (post-May-2026 fix): profiles.timezone is the single
  // source of truth for all local-day math (Rai sweep gate, frontend
  // midnight rollover, recurring-task reset cutoff). We SEED it from the
  // device's detected TZ exactly once — when the column is null/empty —
  // and never overwrite a stored value from the device after that. The
  // prior behavior auto-wrote on every session, which let a stale browser
  // TZ (e.g. Chrome holding an Eastern resolvedOptions across a macOS
  // clock change) silently flip profiles.timezone hours-at-a-time and
  // corrupt both the overnight Rai pick AND the local midnight cutoff.
  // Users can change their stored TZ via Settings (separate UI path).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const profRes = await profileDb.get(user.id);
        if (cancelled) return;
        setGoogleCalPromptDismissed(!!profRes?.data?.google_cal_prompt_dismissed);
        // ─── DEVICE TZ ALWAYS WINS (May 2026) ─────────────────────
        // Whatever timezone the user's device reports IS the user's
        // timezone — full stop. The stored profile.timezone exists
        // only so the backend (Edge Functions, SQL) has a value to
        // anchor cron gates and date math; it gets resynced from
        // the device on every load. No banner, no prompt, no
        // manual picker. "Wherever I am is midnight."
        const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        const storedTz = profRes?.data?.timezone || null;
        setUserTimezone(detectedTz);
        if (storedTz !== detectedTz) {
          // Silently sync. Best-effort write — if it fails, the
          // in-memory value still drives the UI for this session.
          try { await profileDb.update(user.id, { timezone: detectedTz }); }
          catch (writeErr) { console.warn('TZ silent sync failed:', writeErr); }
        }
      } catch (e) {
        // Non-blocking — fall back to device TZ in-memory only. Do NOT
        // write the fallback to the database; that's how drift happens.
        console.warn('Timezone hydrate failed:', e);
        if (!cancelled) {
          setUserTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Schedule automatic daily rollover at midnight local. Reloads data so
  // tasks re-bucket (Today → Overdue, Tomorrow → Today, etc), Rai's pick
  // and the calendar all flip together at 00:00.
  // Fires even if the tab stays open across midnight — ensures no one sees stale state.
  //
  // Anchored to the user's STORED timezone (profiles.timezone), not the
  // browser's wall clock — see notes on tzMidnightInstant for why.
  // While userTimezone is still null (very brief, just on first mount),
  // fall back to device-local midnight so the effect still fires reasonably.
  useEffect(() => {
    if (!user) return;
    let timeoutId;

    // Day-rollover effects: reset recurring tasks + soft-clear completed
    // one-offs. Fires AT MOST once per calendar day in stored TZ, gated
    // by a localStorage idempotency token. Reusable so both the scheduled
    // midnight tick AND the effect-mount catch-up (for laptop-sleep / tab
    // reopen) share the same write path and same lock.
    const runRolloverIfNeeded = async () => {
      if (!userTimezone) return;
      try {
        const todayYmd = ymdInTz(userTimezone, new Date());
        const lastRolloverKey = `rt:lastRolloverYmd:${user.id}`;
        let lastRolloverYmd = null;
        try { lastRolloverYmd = localStorage.getItem(lastRolloverKey); } catch (_) { /* localStorage unavailable */ }
        if (lastRolloverYmd === todayYmd) return; // already done today
        const cutoffMs = tzMidnightInstant(userTimezone, new Date(), 0);
        const cutoff = new Date(cutoffMs);
        const allRes = await tasksDb.listToday(user.id);
        if (!allRes?.data) return;
        const recurringToReset = allRes.data.filter(t =>
          t.is_recurring && t.is_done &&
          t.completed_at && new Date(t.completed_at) < cutoff
        );
        // One-off soft-clear candidates come from a DEDICATED query, not
        // from listToday. listToday's display boundary keeps rows completed
        // AFTER local midnight — it excludes exactly the rows the rollover
        // needs (completed BEFORE local midnight). Sourcing from it meant
        // the soft-clear only ever saw the previous evening's sliver between
        // UTC midnight and local midnight. First run after this change
        // back-fills cleared_at on all historical done one-offs, which is
        // the intended state (and what Rai's done-vs-cleared context expects).
        const candRes = await tasksDb.listRolloverClearCandidates(user.id, cutoff.toISOString());
        const oneOffIdsToClear = (candRes?.data || []).map(t => t.id);
        await Promise.all([
          ...recurringToReset.map(t => tasksDb.toggle(t.id, false)),
          ...(oneOffIdsToClear.length ? [tasksDb.clearFromActiveBulk(oneOffIdsToClear)] : []),
        ]);
        try { localStorage.setItem(lastRolloverKey, todayYmd); } catch (_) { /* localStorage unavailable */ }
      } catch (e) {
        console.warn('Midnight rollover failed:', e);
      }
    };

    // Sweep-eligibility heartbeat: stamp profiles.last_active_at at most
    // once per 6h. Drives the 14-day activity gate in sweep_enqueue_due()
    // — dormant accounts stop consuming nightly Anthropic sweeps until
    // they return. Fired on effect mount AND on every tab focus (below),
    // so a tab left open for days keeps beating.
    const heartbeat = () => {
      try {
        const hbKey = `rt:lastActiveBeat:${user.id}`;
        const lastBeat = Number(localStorage.getItem(hbKey) || 0);
        if (Date.now() - lastBeat > 6 * 3600 * 1000) {
          profileDb.touchLastActive(user.id).catch(() => {});
          try { localStorage.setItem(hbKey, String(Date.now())); } catch (_) { /* localStorage unavailable */ }
        }
      } catch (_) { /* localStorage unavailable — beat skipped */ }
    };
    heartbeat();

    // Catch-up: on mount/effect-run, fire rollover if it hasn't run today.
    // Handles laptop-sleep across midnight (timer pauses, missed fire),
    // tab reopened next morning, or userTimezone resolved late after
    // already crossing local midnight. Followed by loadData to refresh UI.
    runRolloverIfNeeded().then(() => loadData());

    const scheduleNextMidnight = () => {
      const now = new Date();
      const nextMidnightMs = userTimezone
        ? tzMidnightInstant(userTimezone, now, 1)
        : (() => {
            const d = new Date(now);
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() + 1);
            return d.getTime();
          })();
      const msUntil = Math.max(0, nextMidnightMs - now.getTime());
      timeoutId = setTimeout(async () => {
        await runRolloverIfNeeded();
        loadData();
        scheduleNextMidnight();
      }, msUntil);
    };
    scheduleNextMidnight();

    // Also refresh when tab regains focus — catches laptop-sleep case where setTimeout
    // may have paused across system sleep and missed the midnight fire.
    // Importantly this only re-reads data (loadData). It does NOT run the
    // rollover. If the user returns the next day, the FIRST loadData of
    // that day will find the rollover hasn't fired (key in localStorage is
    // yesterday's YMD), and the scheduleNextMidnight chain will catch up
    // when the next timer fires — typically within ms since we always
    // schedule against the NEXT midnight from "now."
    //
    // Also re-checks device TZ. If the user traveled across timezones
    // while the tab was hidden (closed laptop in Denver, opened in NYC),
    // this picks up the new device TZ and silently syncs it to the
    // profile. "Wherever I am is midnight."
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      heartbeat();
      const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      if (deviceTz && deviceTz !== userTimezone) {
        setUserTimezone(deviceTz);
        if (user?.id) {
          profileDb.update(user.id, { timezone: deviceTz })
            .catch(err => console.warn('TZ silent sync on visibility failed:', err));
        }
      }
      loadData();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user, loadData, userTimezone]);

  // ═══ SUPABASE-BACKED MUTATIONS ═══
  // When a Rai-added task is deleted, close the learning loop: mark the
  // originating rai_suggestions row dismissed so the next sweep (which
  // reads recent_suggestions) won't re-add the same thing.
  //
  // Phase 9 update: the second argument is the dismiss_reason string.
  // Substantive reasons ("already done", "wrong client", free text)
  // become lessons via the hourly extractor. "user_deleted" (the
  // default for bare swipe/click dismissals) is treated as no-signal
  // and never extracts a lesson — only powers the 14-day anti-repeat.
  // Safe no-op for non-Rai tasks or tasks with no suggestion link.
  const dismissRaiTaskFeedback = (t, reason = "user_deleted") => {
    if (!t || !t.ai || !t.rai_suggestion_id) return;
    supabase.from("rai_suggestions")
      .update({ status: "dismissed", dismiss_reason: reason, acted_at: new Date().toISOString() })
      .eq("id", t.rai_suggestion_id)
      .then(({ error }) => { if (error) console.error("Rai task delete-feedback failed:", error); });
  };

  // Phase 9 — gating function called by swipe/button dismiss handlers.
  // If the task is Rai-suggested, opens the feedback modal (which will
  // run the actual delete on confirm). If not, just dismisses silently
  // by running the provided performDelete callback immediately.
  //
  // The performDelete callback contains the actual task removal — local
  // state update + tasksDb.delete. We need it as a callback because the
  // modal needs to defer the deletion until the user confirms.
  const openDismissFlow = (t, performDelete) => {
    if (!t) return;
    // Non-Rai task → no feedback to capture. Delete immediately.
    if (!t.ai || !t.rai_suggestion_id) {
      performDelete();
      return;
    }
    // Rai task → open modal. Store the performDelete callback so the
    // modal can call it on confirm.
    setDismissModalTask({ task: t, performDelete });
    setDismissReasonChips([]);
    setDismissReasonText("");
  };

  // Phase 9 — confirm handler for the dismiss modal. Builds the final
  // reason string from chip + free-text, writes feedback, runs delete,
  // closes the modal.
  const confirmDismissWithReason = () => {
    if (!dismissModalTask) return;
    const { task, performDelete } = dismissModalTask;

    // Build the reason string. Chips alone = preset semantic tags
    // (comma-joined if multiple). Free text alone = full user
    // explanation (richest signal). Both = chip-tags prefix + free
    // text. Neither = "user_deleted".
    const text = (dismissReasonText || "").trim();
    const chipStr = (dismissReasonChips || []).join(",");
    let reason = "user_deleted";
    if (chipStr && text) {
      reason = `${chipStr}: ${text}`;
    } else if (text) {
      reason = text;
    } else if (chipStr) {
      reason = chipStr;
    }

    dismissRaiTaskFeedback(task, reason);
    performDelete();
    setDismissModalTask(null);
    setDismissReasonChips([]);
    setDismissReasonText("");
  };

  // Phase 9 — skip giving a reason and just delete (the original behavior).
  const skipDismissReason = () => {
    if (!dismissModalTask) return;
    const { task, performDelete } = dismissModalTask;
    dismissRaiTaskFeedback(task, "user_deleted");
    performDelete();
    setDismissModalTask(null);
    setDismissReasonChips([]);
    setDismissReasonText("");
  };
  // When a task is deleted, also delete its completion/occurrence history so it
  // leaves ZERO footprint for Rai. The sweep reads task_completions and
  // task_occurrences for signals (velocity, drift, activity counts); orphaned
  // rows from a deleted task would otherwise still feed those signals — the
  // user already said "this doesn't matter," so it must not resurface.
  const purgeTaskHistory = (taskId) => {
    if (!taskId) return;
    supabase.from("task_completions").delete().eq("task_id", taskId)
      .then(({ error }) => { if (error) console.error("purge task_completions failed:", error); });
    supabase.from("task_occurrences").delete().eq("task_id", taskId)
      .then(({ error }) => { if (error) console.error("purge task_occurrences failed:", error); });
  };
  const toggleTask = async (id) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    // Was this the top/breakout task when completion started? Only a real
    // promotion (the top task leaving) should play the entry animation —
    // completing a lower task must NOT tug the top row.
    const wasTopTask = topTaskIdRef.current === id;
    const newDone = !task.done;
    const nowIso = new Date().toISOString();
    // Optimistic update
    const updated = tasks.map(t => t.id === id ? { ...t, done: newDone, completed_at: newDone ? nowIso : null } : t);
    setTasks(updated);
    // Bump sidebar tasks-completed counts optimistically. Going-done adds 1
    // across all three windows (it's by definition within "this week"). Going-
    // undone subtracts 1, but only if completed_at was within each window
    // (which it almost always is for a recent toggle — but we check anyway
    // since users can re-open old tasks). Server is source of truth on next
    // hydration.
    if (newDone) {
      setTaskCompletedCounts(c => {
        const wh = [...(c.weekHistory || Array(12).fill(0))];
        const mh = [...(c.monthHistory || Array(12).fill(0))];
        wh[11] = (wh[11] || 0) + 1;
        mh[11] = (mh[11] || 0) + 1;
        return { ...c, today: (c.today || 0) + 1, week: c.week + 1, month: c.month + 1, year: c.year + 1, weekHistory: wh, monthHistory: mh };
      });
    } else if (task.completed_at) {
      const completed = new Date(task.completed_at);
      const now = Date.now();
      const inToday = localYmd(completed) === localYmd(new Date(now));
      const inWeek  = now - completed.getTime() < 7  * 86400000;
      const inMonth = now - completed.getTime() < 30 * 86400000;
      const inYear  = now - completed.getTime() < 365 * 86400000;
      setTaskCompletedCounts(c => {
        const wh = [...(c.weekHistory || Array(12).fill(0))];
        const mh = [...(c.monthHistory || Array(12).fill(0))];
        if (inWeek)  wh[11] = Math.max(0, (wh[11] || 0) - 1);
        if (inMonth) mh[11] = Math.max(0, (mh[11] || 0) - 1);
        return {
          ...c,
          today: Math.max(0, (c.today || 0) - (inToday ? 1 : 0)),
          week:  Math.max(0, c.week  - (inWeek  ? 1 : 0)),
          month: Math.max(0, c.month - (inMonth ? 1 : 0)),
          year:  Math.max(0, c.year  - (inYear  ? 1 : 0)),
          weekHistory: wh,
          monthHistory: mh,
        };
      });
    }
    // ASMR completion pulse — only fire when transitioning to done, clear after 720ms
    if (newDone) {
      setJustCompletedIds(prev => ({ ...prev, [id]: true }));
      setTimeout(() => {
        setJustCompletedIds(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }, 720);
      // 3.5 seconds after completion, animate the task out of the active bucket
      // and into the "Completed today" log below. The smooth exit is two-phase:
      //   phase 1: add an "exiting" class that triggers max-height shrink + fade
      //   phase 2: 360ms later, mark the task as collapsed (which removes it from
      //            the bucket entirely and surfaces it in the completed log).
      // If the user un-checks the task before the timer fires, both phases cancel.
      setTimeout(() => {
        setTasks(prev => {
          const stillDone = prev.find(t => t.id === id)?.done;
          if (!stillDone) return prev;
          // Phase 1: trigger exit animation
          setExitingDoneIds(prevSet => ({ ...prevSet, [id]: true }));
          return prev;
        });
        // Phase 2: after the animation completes, remove from bucket
        setTimeout(() => {
          setTasks(prev => {
            const stillDone = prev.find(t => t.id === id)?.done;
            if (!stillDone) return prev;
            setCollapsedDoneIds(prevSet => ({ ...prevSet, [id]: true }));
            // The next task is about to promote into the break-out slot — flag
            // it so the entry animation plays now (and only now). Clear after
            // the animation so a later page navigation doesn't replay it.
            // ONLY when the TOP task left (a genuine promotion). Completing a
            // lower task leaves the top slot untouched, so we must not animate
            // it (that caused a janky pull on the first task).
            if (wasTopTask) {
              setJustPromoted(true);
              setTimeout(() => setJustPromoted(false), 260);
            }
            setExitingDoneIds(prevSet => {
              const next = { ...prevSet };
              delete next[id];
              return next;
            });
            return prev;
          });
        }, 240);
      }, 3500);
    } else {
      // Un-completing: if it was collapsed, bring it back out of the log
      setCollapsedDoneIds(prev => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    const countable = updated;
    // Fireworks REMOVED — no celebration animation on completing the last
    // today task (per product decision). The detection logic below is left in
    // place but no longer triggers any visual; setConfetti is never called.
    // (Block kept minimal in case a quieter affordance is wanted later.)
    // Persist. On failure, revert the optimistic state so the UI doesn't
    // show a phantom (un)check that a later hydration would silently undo —
    // the intermittent "I checked it and it stayed" bug. We snapshot the
    // pre-toggle task and restore it on error.
    inFlightToggles.current.add(id);
    const { error: toggleErr } = await tasksDb.toggle(id, newDone);
    inFlightToggles.current.delete(id);
    if (toggleErr) {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, done: task.done, completed_at: task.completed_at } : t));
      // Undo the optimistic count bump (mirror of the increment above).
      if (newDone) {
        setTaskCompletedCounts(c => {
          const wh = [...(c.weekHistory || Array(12).fill(0))];
          const mh = [...(c.monthHistory || Array(12).fill(0))];
          wh[11] = Math.max(0, (wh[11] || 0) - 1);
          mh[11] = Math.max(0, (mh[11] || 0) - 1);
          return { ...c, today: Math.max(0, (c.today || 0) - 1), week: Math.max(0, c.week - 1), month: Math.max(0, c.month - 1), year: Math.max(0, c.year - 1), weekHistory: wh, monthHistory: mh };
        });
      }
      setJustCompletedIds(prev => { const n = { ...prev }; delete n[id]; return n; });
      setQuickLogToast({ id: Date.now(), error: true });
    }
  };

  const recurringTasks = tasks.filter(t => t.recurring);
  const todayTasks = tasks.filter(t => !t.recurring);
  const countableTasks = tasks;

  // tasksDone / tasksTotal scope to TODAY bucket only — recurring tasks +
  // tasks with no due_date + tasks due today-or-earlier. Tomorrow/Later don't
  // count toward the sidebar red dot. Otherwise the dot persists whenever
  // ANY future task is incomplete, which is misleading: "today" is finished
  // but the dot says otherwise.
  const _todayDotNow = new Date();
  const _todayDotStr = localYmd(_todayDotNow);
  const todayBucketCountable = countableTasks.filter(t => {
    if (t.recurring) {
      if (t.done) return true;
      const next = nextOccurrenceDate(t.recurrence_pattern, _todayDotNow, true);
      const nextStr = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
      return nextStr <= _todayDotStr;
    }
    if (!t.due_date) return true;
    const d = String(t.due_date).slice(0, 10);
    return d <= _todayDotStr;
  });
  const tasksDone = todayBucketCountable.filter(t => t.done).length;
  const tasksTotal = todayBucketCountable.length;

  // Task sorting — by Profile Score (invisible), highest first
  // Rai priority boost — applied to one task per day during sweep
  const getRaiBoost = (score) => {
    if (score >= 90) return 5;
    if (score >= 80) return 10;
    if (score >= 70) return 15;
    if (score >= 60) return 20;
    return 25;
  };

  const getProfileSortScore = (clientName, hasRaiBoost = false, daysLate = 0) => {
    // All Clients sentinel: a task tagged "All Clients" should always sort
    // first regardless of any per-client math. Set high enough to clear the
    // theoretical max real score: ~104 base + 25 raiBoost + 10 nudge +
    // 60 lateBoost + 15 newClientBoost ≈ 214 max. 500 leaves generous
    // headroom for future score expansions.
    if (!clientName || clientName === "All Clients") return 500;
    const c = clients.find(x => x.name === clientName);
    if (!c) return 0;
    // Paused engagement: this client is in a temporary pause window.
    // Their tasks stay visible (in case user wants to mark stragglers
    // done) but rank at the bottom of the queue — Rai doesn't surface
    // them and the daily sweep skips them. Returning 0 is enough; no
    // boosts apply when score = 0.
    if (c.is_paused) return 0;
    const ps = calcProfileScore(c.ret || 50, c, clients);
    const totalRev = clients.reduce((a, x) => a + (x.revenue || 0), 0);
    const revPct = totalRev > 0 ? (c.revenue || 0) / totalRev : 0;
    const boost = calcNewClientBoost(c.ret || 50, revPct, c.daysOld != null ? c.daysOld : 999);
    const raiBoost = hasRaiBoost ? getRaiBoost(ps) : 0;
    // Layered Rai score:
    //   client nudge (-10..+10) — all tasks of this client get this.
    // The old "pick boost" (+10..+20 on the client-of-the-day's task) was
    // removed (May 2026) — Rai's daily brief no longer moves the sort. Only
    // the per-client nudge does, and a nudged client need not be the one the
    // brief centers on.
    const raiNudge = c.raiNudge || 0;
    // Late-task boost: overdue tasks surface aggressively, with fragile clients
    // (low retention score) getting much larger lifts per day late than healthy
    // clients. A 1d late task on a thriving client (ret=95) gets +1; same task
    // on a fragile client (ret=30) gets +17. Caps at +60 so a long-stale task
    // on a fragile client doesn't produce absurd ranks. Only applies when
    // daysLate >= 1 — same-day tasks not counted as "late."
    let lateBoost = 0;
    if (daysLate >= 1) {
      const ret = c.ret != null ? c.ret : 50;
      lateBoost = Math.min(60, daysLate * (100 - ret) / 4);
    }
    // No upper clamp — the sort comparator needs true magnitudes to break
    // ties between top-tier clients. Display layers round/cap for UI (the
    // score badge shows 99 max). Without removing this clamp, two clients
    // both scoring 105 raw would tie at 99 and lose their differentiator.
    return ps + boost + raiBoost + raiNudge + lateBoost;
  };


  // Quarterly portfolio reviews (legacy "health check" plumbing)
  const [hcOpen, setHcOpen] = useState(null);
  const [hcDone, setHcDone] = useState({});
  // Whether the "more reviews" overflow list (beyond the top 3) is expanded.
  const [reviewQueueMoreOpen, setReviewQueueMoreOpen] = useState(false);
  const [showUpcoming, setShowUpcoming] = useState(false);

  // Referrals
  const [refForm, setRefForm] = useState(false);
  const [refName, setRefName] = useState("");
  const [refFrom, setRefFrom] = useState("");
  const [refStatus, setRefStatus] = useState("converted");
  const [refRevenue, setRefRevenue] = useState("");
  const [refTotalRevenue, setRefTotalRevenue] = useState("");
  const [refEditing, setRefEditing] = useState(null);
  const [refEditData, setRefEditData] = useState({});
  // Time-travel slider in the Referrals network. null = show the latest
  // (default). An ISO date string filters the visualization to "show the
  // network as it looked on this date." Set via the slider under the graph.
  const [networkAsOf, setNetworkAsOf] = useState(null);
  // Referrals v2 — ask-next queue interaction state
  const [askActiveId, setAskActiveId] = useState(null);
  const [askTone, setAskTone] = useState("neutral"); // softer | neutral | firmer
  const [askDraft, setAskDraft] = useState("");
  // Persisted "already asked" set — once acted-on, a client never appears in ask queue again.
  // Loaded from localStorage so the state survives reloads.
  const [askActed, setAskActed] = useState(() => {
    try { const raw = localStorage.getItem("rt-ask-acted"); return raw ? new Set(JSON.parse(raw)) : new Set(); } catch { return new Set(); }
  });

  const addRef = async () => {
    if (!refName.trim() || !refFrom) return;
    const clientObj = clients.find(c => c.name === refFrom);
    // Snapshot revenue from the referred-to client's profile at submit
    // time. If the client's revenue changes later, the referral keeps
    // the original number — referrals are historical records.
    const referredToClient = clients.find(c => c.name === refName.trim());
    const snapshotRevenue = referredToClient?.revenue || 0;
    const { data: created } = await referralsDb.create(user.id, {
      referred_to: refName.trim(),
      referred_by: refFrom,
      referred_by_client_id: clientObj?.id || null,
      status: refStatus,
      revenue: snapshotRevenue,
      total_revenue: 0,
      date_added: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    });
    setRefs([{ id: created?.id || "ref" + Date.now(), from: refFrom, to: refName.trim(), date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }), converted: refStatus === "converted" || refStatus === "closed", revenue: snapshotRevenue, totalRevenue: 0, status: refStatus }, ...refs]);
    setRefName(""); setRefFrom(""); setRefStatus("converted"); setRefRevenue(""); setRefTotalRevenue(""); setRefForm(false);
  };

  const refsConverted = refs.filter(r => r.converted || r.status === "converted" || r.status === "closed");
  const refsRevenue = refsConverted.reduce((a, r) => a + r.revenue, 0);

  // Coach
  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessages] = useState([]);
  // When the user unpacks an observation into the chat, we stash the observation's
  // full context here so Rai's API calls include what "this" refers to (archetype,
  // clients, metrics). Cleared when a fresh conversation starts.
  const [observationContext, setObservationContext] = useState(null);
  // Focused task ID — when the user clicks "Discuss with Rai" on a task,
  // this captures the task ID and ships it to the edge function. The edge
  // function then fetches the task + 30d activity signature + workflow
  // profile + suggestion server-side. This replaces the old
  // buildTaskDiscussionContext + observationContext hack where 14 days of
  // truncated frontend-state data was stuffed into chat history as a forged
  // assistant message. Cleared when a fresh conversation starts.
  const [focusedTaskId, setFocusedTaskId] = useState(null);
  const [aiTyping, setAiTyping] = useState(false);
  const [aiStreaming, setAiStreaming] = useState(false);
  // Attachments staged for next send. Shape: { id, name, type (image|document), media_type, data (base64), size }
  const [aiAttachments, setAiAttachments] = useState([]);
  // Current conversation id — null until first message persists. Tracks which
  // rai_conversations row is being appended to; set when user picks a past chat.
  const [aiConvoId, setAiConvoId] = useState(null);
  // Sidebar list of past conversations (populated by loadData).
  const aiEndRef = useRef(null);
  // ─── CONFIDANT STATE (per-client Rai chat on client profile) ─────
  // Separate from global Rai chat state — the Confidant lives on the
  // client profile's "Rai" tab and threads conversations per (user_id,
  // client_id). Opening the same client later resumes the same thread.
  const [confidantMessages, setConfidantMessages] = useState([]);
  const [confidantInput, setConfidantInput] = useState("");
  const [confidantTyping, setConfidantTyping] = useState(false);
  const [confidantConvoId, setConfidantConvoId] = useState(null);
  const [confidantLoadingThread, setConfidantLoadingThread] = useState(false);
  // Timestamp of the last activity in the loaded thread — used to
  // render "Last spoke X days ago" in the Confidant eyebrow. Pulled
  // from the row's updated_at when the thread is loaded. Null when
  // there's no prior history (fresh thread).
  const [confidantLastActivity, setConfidantLastActivity] = useState(null);
  // ID of the client whose thread is currently loaded — used to guard
  // against stale loads when the user navigates between clients quickly.
  const confidantLoadedClientRef = useRef(null);
  const confidantEndRef = useRef(null);
  // When the task-discussion click handler pre-loads context and then wants
  // Rai to immediately produce the artifact (a draft, an analysis, etc.)
  // instead of asking what to do, it stashes the auto-fire text here. A
  // useEffect picks it up AFTER aiMessages + observationContext have flushed
  // through React state, so sendAi runs with a fresh closure that includes
  // the new context. Without this two-step, the auto-send would close over
  // the stale (pre-context) state and Rai would respond blind.
  const pendingAutoSendRef = useRef(null);
  // When a chat is auto-started from a task, the user message Rai receives is
  // a generic prompt ("Draft this for me."). That made every task-originated
  // chat title identical. This ref carries a meaningful title (the task +
  // client) set at click time, used for the conversation title instead of
  // the generic auto-send text. Consumed (cleared) on first use.
  const pendingAutoTitleRef = useRef(null);
  const aiUserRef = useRef(null);
  useEffect(() => {
    // Claude-style: when a new user message is sent, scroll that message to the top of the viewport
    // leaving room below for Rai's response. Falls back to bottom scroll when Rai is typing.
    if (aiMessages.length > 0 && aiMessages[aiMessages.length - 1].role === "user") {
      aiUserRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      aiEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [aiMessages, aiTyping]);
  // Reset Rai textarea heights when input clears (e.g. after sending a message)
  useEffect(() => {
    if (aiInput === "") {
      document.querySelectorAll('textarea[placeholder="Reply to Rai…"], textarea[placeholder="Ask about a client, draft a message, or talk shop…"]').forEach(t => {
        t.style.height = "auto";
      });
    }
  }, [aiInput]);
  // Read a File as base64 (strips the data:... prefix, keeps only raw base64).
  // Returns null on error so the caller can continue without attaching.
  const readFileAsBase64 = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") return resolve(null);
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });

  // Pick files and stage them for the next send. Accepts images (PNG/JPG/WEBP/GIF)
  // and PDF documents. Text files are rejected here — the user should paste their
  // content instead for better results.
  const handleFilePick = async (files) => {
    const accepted = [];
    for (const f of files) {
      if (f.size > 10 * 1024 * 1024) {
        // 10MB limit — matches Anthropic's practical cap for base64 content
        alert(`"${f.name}" is too large (over 10MB). Skipping.`);
        continue;
      }
      const isImage = /^image\/(png|jpe?g|webp|gif)$/i.test(f.type);
      const isPdf = f.type === "application/pdf";
      if (!isImage && !isPdf) {
        alert(`"${f.name}" isn't a supported file type. PDFs and images only.`);
        continue;
      }
      const data = await readFileAsBase64(f);
      if (!data) continue;
      accepted.push({
        id: Math.random().toString(36).slice(2),
        name: f.name,
        type: isImage ? "image" : "document",
        media_type: f.type,
        data,
        size: f.size,
      });
    }
    if (accepted.length) setAiAttachments(prev => [...prev, ...accepted]);
  };

  const sendAi = async (text) => {
    const q = text || aiInput;
    // Allow sending with attachments only (no text typed) — Anthropic accepts that.
    if (!q.trim() && aiAttachments.length === 0) return;
    // Snapshot attachments at call time so they render on the user bubble even if
    // the user starts picking more while the stream is in flight.
    const attachmentsForSend = aiAttachments;
    setAiAttachments([]);
    setAiMessages(prev => [...prev, { role: "user", text: q, attachments: attachmentsForSend }]);
    setAiInput("");
    setAiTyping(true);

    try {
      // Conversation history — last 40 messages in Anthropic format.
      // Cap evolution: 10 → 30 (Confidant launch) → 40 (Jun 6 2026, alongside
      // DAILY_LIMIT raise from 15 → 20). 40 messages = 20 user turns + 20
      // assistant turns, matching the daily cap so the latter half of a
      // user's day still has the earlier half in context.
      const history = aiMessages.slice(-40).map(m => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.text
      }));
      // If this conversation began from an unpacked observation, prepend its
      // context so "how should I proceed?" resolves against the real finding.
      if (observationContext) {
        history.unshift({ role: "assistant", content: observationContext });
      }

      // Get the caller's JWT for the Edge Function to verify identity
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/rai-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
          "Accept": "text/event-stream",
        },
        body: JSON.stringify({
          message: q,
          history,
          focused_client_id: null,
          // focused_task_id is set when the user opened this chat by clicking
          // a discussable task. The edge function uses it to fetch the task +
          // 30d activity signature + workflow profile + suggestion + recent
          // pick server-side, then injects them as a structured focused_task
          // block in the system context. Null for all other chat entry points.
          focused_task_id: focusedTaskId,
          stream: true,
          // Attachments travel separately from message text; the Edge Function
          // merges them into the current user message's content array.
          attachments: attachmentsForSend.map(a => ({
            type: a.type,
            media_type: a.media_type,
            data: a.data,
            name: a.name,
          })),
        }),
      });

      // Rate limit: server returns JSON with status 429 (no stream)
      if (response.status === 429) {
        const data = await response.json();
        setAiMessages(prev => [...prev, { role: "ai", text: data.message || "You've reached today\'s chat limit. Please wait until tomorrow." }]);
        return;
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        console.error("Rai API error:", response.status, errText);
        setAiMessages(prev => [...prev, { role: "ai", text: "I'm having trouble thinking right now. Try again in a moment." }]);
        return;
      }

      // Streaming path: read SSE events, progressively build up the assistant message
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("text/event-stream") && response.body) {
        // Insert an empty AI message that we'll fill in chunk by chunk
        setAiMessages(prev => [...prev, { role: "ai", text: "" }]);
        setAiTyping(false); // remove the bouncing dots once streaming starts
        setAiStreaming(true);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";

        // Smooth streaming: accumulate tokens as they arrive, but only
        // flush to React state on an animation frame. Anthropic emits many
        // text_delta events per second; calling setAiMessages on each one
        // re-renders + re-parses the whole transcript per token, which makes
        // the reply visibly jump and reflow. Coalescing writes to ~60fps
        // (one rAF-scheduled flush at a time) makes it flow like Claude.
        let rafPending = false;
        const flush = () => {
          rafPending = false;
          setAiMessages(prev => {
            const next = [...prev];
            next[next.length - 1] = { role: "ai", text: accumulated };
            return next;
          });
        };
        const scheduleFlush = () => {
          if (rafPending) return;
          rafPending = true;
          if (typeof requestAnimationFrame !== "undefined") requestAnimationFrame(flush);
          else setTimeout(flush, 16);
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // SSE events are separated by double newlines
          const events = buffer.split("\n\n");
          buffer = events.pop() || ""; // incomplete event stays in buffer

          for (const evt of events) {
            const lines = evt.split("\n");
            for (const line of lines) {
              if (!line.startsWith("data:")) continue;
              const data = line.slice(5).trim();
              if (!data || data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                // Anthropic streaming: content_block_delta events carry text
                if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
                  accumulated += parsed.delta.text;
                  scheduleFlush();
                }
              } catch {
                // ignore malformed JSON chunks
              }
            }
          }
        }

        // Final flush — guarantee the last tokens land even if the stream
        // ended between animation frames.
        flush();
        setAiStreaming(false);

        // If stream ended with nothing, show fallback
        if (!accumulated) {
          setAiMessages(prev => {
            const next = [...prev];
            next[next.length - 1] = { role: "ai", text: "I'm having trouble thinking right now. Try again in a moment." };
            return next;
          });
          return;
        }

        // ═══ Persist conversation ═══
        // After a successful exchange, save the full transcript to rai_conversations.
        // - If we have no convo id yet, create a new row and set it as active.
        // - Otherwise append by overwriting the full messages array (atomic, avoids
        //   merge races with other tabs).
        // - Auto-generate a title from the user's first message (truncated) when
        //   the title is still null, i.e. on the first exchange of a new chat.
        try {
          const fullMessages = [
            ...aiMessages,
            { role: "user", text: q, attachments: attachmentsForSend },
            { role: "ai", text: accumulated },
          ];
          // Lazy-load convoDb calls to avoid regressing in environments where
          // create/updateTitle aren't yet exported (older deploys).
          if (!aiConvoId && convoDb.create) {
            // Prefer an explicit title set when the chat was auto-started from
            // a task (task text + client). Falls back to the first user message
            // for normal chats. Consume the ref so it doesn't leak to the next.
            const explicitTitle = pendingAutoTitleRef.current;
            pendingAutoTitleRef.current = null;
            const titleSource = explicitTitle || fullMessages.find(m => m.role === "user")?.text || "New chat";
            const autoTitle = titleSource.slice(0, 60).trim() + (titleSource.length > 60 ? "…" : "");
            const { data: created } = await convoDb.create(user.id, { title: autoTitle });
            if (created) {
              setAiConvoId(created.id);
              // Overwrite messages on the new row (create started it with []).
              await supabase
                .from("rai_conversations")
                .update({ messages: fullMessages })
                .eq("id", created.id);
              // Refresh the sidebar list with this new chat at the top.
              setRaiConvoList(prev => [
                { id: created.id, title: autoTitle, is_starred: false, updated_at: new Date().toISOString(), client_id: null, client: null },
                ...prev,
              ]);
            }
          } else if (aiConvoId) {
            await supabase
              .from("rai_conversations")
              .update({ messages: fullMessages, updated_at: new Date().toISOString() })
              .eq("id", aiConvoId);
            // Bump this chat to top of the sidebar list (mutation in place).
            setRaiConvoList(prev => {
              const idx = prev.findIndex(c => c.id === aiConvoId);
              if (idx < 0) return prev;
              const updated = { ...prev[idx], updated_at: new Date().toISOString() };
              const next = [...prev];
              next.splice(idx, 1);
              // Starred chats stay at top; non-starred move to top of unstarred.
              if (updated.is_starred) {
                next.unshift(updated);
              } else {
                const firstUnstarred = next.findIndex(c => !c.is_starred);
                if (firstUnstarred < 0) next.push(updated);
                else next.splice(firstUnstarred, 0, updated);
              }
              return next;
            });
          }
        } catch (persistErr) {
          console.warn("Conversation persistence failed (non-fatal):", persistErr);
        }
        return;
      }

      // Fallback: non-streaming JSON response
      const data = await response.json();
      const reply = data.reply || "I'm having trouble thinking right now. Try again in a moment.";
      setAiMessages(prev => [...prev, { role: "ai", text: reply }]);
    } catch (err) {
      console.error("Rai API error:", err);
      setAiMessages(prev => [...prev, { role: "ai", text: "Something went wrong connecting to Rai. Check your connection and try again." }]);
    }
    setAiTyping(false);
    setAiStreaming(false);
  };

  // Watches for a pending auto-send queued by the task-discussion click
  // handler. Fires AFTER aiMessages + focusedTaskId have been updated by
  // React, so sendAi sees the fresh closure with the new task focus. The
  // ref is consumed on first fire (cleared to null) to prevent re-trigger
  // when aiMessages updates again during the streaming reply.
  //
  // [Jun 6 2026 fix] Previously gated on observationContext, but the
  // Jun 6 architectural fix stopped setting observationContext in favor
  // of server-side context fetch via focusedTaskId. The gate was never
  // updated to match, so the auto-send never fired — the user landed on
  // a silent Coach page. Now we wait on focusedTaskId (or observationContext
  // for legacy call sites that still set it like Health and Referrals).
  useEffect(() => {
    if (!pendingAutoSendRef.current) return;
    if (!focusedTaskId && !observationContext) return; // need one or the other
    const text = pendingAutoSendRef.current;
    pendingAutoSendRef.current = null;
    sendAi(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedTaskId, observationContext, aiMessages]);

  // ─── Rai conversation handlers (sidebar) ──────────────────────────────
  // Start a fresh chat — clears messages + convo id so the next send creates
  // a new row. Doesn't hit the DB (nothing to save yet).
  const startNewRaiChat = () => {
    setAiMessages([]);
    setAiInput("");
    setAiAttachments([]);
    setAiConvoId(null);
    setObservationContext(null);
    setFocusedTaskId(null);
    pendingAutoTitleRef.current = null;
  };

  // Load a past conversation into the chat pane. Fetches the full row (list
  // endpoint returns lightweight fields only, so we need get() for messages).
  const openRaiChat = async (convoId) => {
    if (!convoDb.get) return;
    const { data } = await convoDb.get(convoId);
    if (!data) return;
    // Messages persisted as {role, text, attachments, timestamp}. The chat UI
    // reads {role, text, attachments}, so normalize defensively.
    const messages = (data.messages || []).map(m => ({
      role: m.role === "assistant" ? "ai" : m.role,
      text: m.text || "",
      attachments: m.attachments || [],
    }));
    setAiMessages(messages);
    setAiConvoId(convoId);
    setAiInput("");
    setAiAttachments([]);
    setObservationContext(null);
    // Loading a different past conversation = no longer focused on a task
    setFocusedTaskId(null);
  };

  // ─── CONFIDANT: load thread for a specific client ────────────────
  // Called when the user opens the "Rai" tab on a client profile.
  // Uses convoDb.getOrCreate(userId, clientId) to find an existing
  // thread for this (user, client) pair, or creates a fresh one.
  // Populates confidantMessages from the row's messages JSONB array.
  const loadConfidantThread = async (clientId) => {
    if (!user || !clientId) return;
    // Guard against stale loads: if the user clicks across clients
    // quickly, we use a ref to track which client we're loading FOR,
    // and discard the result if the user has moved on.
    confidantLoadedClientRef.current = clientId;
    setConfidantLoadingThread(true);
    try {
      const { data } = await convoDb.getOrCreate(user.id, clientId);
      // If user navigated to a different client mid-load, abort.
      if (confidantLoadedClientRef.current !== clientId) return;
      if (!data) {
        setConfidantMessages([]);
        setConfidantConvoId(null);
        setConfidantLastActivity(null);
        return;
      }
      // Normalize message shape from {role, text, attachments, timestamp}
      // to the chat UI's {role: "user"|"ai", text} format.
      const messages = (data.messages || []).map(m => ({
        role: m.role === "assistant" ? "ai" : m.role,
        text: m.text || "",
      }));
      setConfidantMessages(messages);
      setConfidantConvoId(data.id);
      // Only set last-activity if there's prior history. A fresh row
      // from getOrCreate (just created, empty messages) gets null so
      // we don't render "Last spoke just now" for a brand-new thread.
      setConfidantLastActivity(messages.length > 0 ? data.updated_at : null);
    } catch (err) {
      console.warn("Confidant thread load failed:", err);
      setConfidantMessages([]);
      setConfidantConvoId(null);
      setConfidantLastActivity(null);
    } finally {
      setConfidantLoadingThread(false);
    }
  };

  // ─── CONFIDANT: send message to Rai (per-client thread) ──────────
  // Mirrors sendAi but: passes focused_client_id, uses confidant
  // state instead of global aiMessages state, persists to the
  // pre-loaded confidantConvoId thread. Same 40-message cap (matches
  // DAILY_LIMIT 20 user turns), same streaming Edge Function call.
  const sendConfidantMessage = async (text, clientId) => {
    const q = (text || "").trim();
    if (!q || !clientId || !user) return;
    setConfidantMessages(prev => [...prev, { role: "user", text: q }]);
    setConfidantInput("");
    setConfidantTyping(true);
    try {
      // Build the same Anthropic-format history as the global chat.
      // 40 messages = 20 turns, matching DAILY_LIMIT and the global chat cap.
      const history = confidantMessages.slice(-40).map(m => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.text,
      }));
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/rai-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
          "Accept": "text/event-stream",
        },
        body: JSON.stringify({
          message: q,
          history,
          focused_client_id: clientId,
          stream: true,
        }),
      });
      if (!response.ok) {
        // Match the global chat's error UX — show a single AI bubble
        // explaining the failure rather than throwing.
        if (response.status === 429) {
          const errData = await response.json().catch(() => ({}));
          setConfidantMessages(prev => [...prev, {
            role: "ai",
            text: errData.message || "You've reached today\'s chat limit. Please wait until tomorrow.",
          }]);
        } else {
          setConfidantMessages(prev => [...prev, {
            role: "ai",
            text: "I'm having trouble thinking right now. Try again in a moment.",
          }]);
        }
        return;
      }
      // Stream parsing — Anthropic SSE format. Accumulate text deltas
      // into a single AI bubble that grows as the stream progresses.
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      setConfidantMessages(prev => [...prev, { role: "ai", text: "" }]);
      let buffer = "";
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const evt = JSON.parse(payload);
            if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
              accumulated += evt.delta.text;
              setConfidantMessages(prev => {
                const next = [...prev];
                if (next.length > 0 && next[next.length - 1].role === "ai") {
                  next[next.length - 1] = { role: "ai", text: accumulated };
                }
                return next;
              });
            }
          } catch {
            // Swallow malformed SSE frames — Anthropic occasionally
            // sends keepalive comments that aren't valid JSON.
          }
        }
      }
      // Persist the full exchange to the conversation row. The thread
      // already exists (loadConfidantThread runs first); we just
      // overwrite its messages array with the new full transcript.
      // Lazy guard in case the load never completed.
      const fullMessages = [
        ...confidantMessages,
        { role: "user", text: q },
        { role: "ai", text: accumulated },
      ];
      if (confidantConvoId) {
        const nowIso = new Date().toISOString();
        await supabase
          .from("rai_conversations")
          .update({
            messages: fullMessages.map(m => ({
              role: m.role === "ai" ? "assistant" : m.role,
              text: m.text,
              timestamp: nowIso,
            })),
            updated_at: nowIso,
          })
          .eq("id", confidantConvoId);
        // Update the local "last activity" display so the eyebrow
        // re-reads "Last spoke just now" without waiting for a refetch.
        setConfidantLastActivity(nowIso);
      }
    } catch (err) {
      console.error("Confidant send failed:", err);
      setConfidantMessages(prev => [...prev, {
        role: "ai",
        text: "Something went wrong connecting to Rai. Check your connection and try again.",
      }]);
    } finally {
      setConfidantTyping(false);
    }
  };

  // Toggle star. Optimistic update — flip local state first, then persist.
  // If the DB write fails, revert. Keeps the sidebar snappy.
  // Dismiss the "Connect Google Calendar" nudge on the Today page.
  // ─── CONFIDANT: load thread when user opens "Rai" tab on a client ─
  // Fires when (a) the user switches to the Rai tab, AND (b) a client
  // is selected. Also fires when the user navigates between clients
  // while the Rai tab is already open. Loads / creates the (user,
  // client) thread and populates confidantMessages.
  useEffect(() => {
    if (clientTab !== "rai") return;
    if (!selectedClient?.id) return;
    if (confidantLoadedClientRef.current === selectedClient.id) return; // already loaded
    // Clear stale state from a previous client immediately so the
    // user doesn't briefly see the wrong conversation.
    setConfidantMessages([]);
    setConfidantConvoId(null);
    setConfidantInput("");
    setConfidantLastActivity(null);
    loadConfidantThread(selectedClient.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientTab, selectedClient?.id]);

  // ─── GLOBAL RAI CHAT: auto-resume most recent thread on page open ─
  // Without this, the user opens the Rai page and starts a blank chat
  // every time — even though their previous thread is one click away
  // in the sidebar. Confusing. This effect auto-loads the most recent
  // non-Confidant thread (client_id IS NULL) on page entry, IF the
  // user hasn't already manually picked a chat. The ref guard ensures
  // we only fire once per visit — re-renders while on the page won't
  // re-trigger after the user opens a different chat.
  const autoResumedRef = useRef(false);
  useEffect(() => {
    if (page !== "coach") {
      // Reset the guard so a future Rai-page visit auto-resumes again.
      autoResumedRef.current = false;
      return;
    }
    if (autoResumedRef.current) return;
    if (aiConvoId) return; // user has a chat loaded (manual or fresh)
    if (aiMessages.length > 0) return; // mid-conversation, don't clobber
    if (raiConvoList.length === 0) return; // no past chats to resume
    // Pick the most-recently-updated GLOBAL chat (client_id null).
    // Confidant threads live on client profiles and shouldn't surface
    // here — D=No call from the spec discussion.
    const globalChats = raiConvoList
      .filter(c => !c.client_id)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    if (globalChats.length === 0) return;
    autoResumedRef.current = true;
    openRaiChat(globalChats[0].id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, raiConvoList.length]);

  // Autoscroll to bottom of Confidant chat when messages update.
  useEffect(() => {
    if (clientTab !== "rai") return;
    if (confidantEndRef.current) {
      confidantEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [confidantMessages, confidantTyping, clientTab]);

  // Optimistic: hide immediately, persist to profile. On failure we
  // revert so the prompt reappears (better the user sees it again than
  // thinks they dismissed it and it silently comes back next session).
  const dismissGoogleCalPrompt = async () => {
    setGoogleCalPromptDismissed(true);
    try {
      const { error } = await profileDb.update(user.id, { google_cal_prompt_dismissed: true });
      if (error) throw error;
    } catch (e) {
      console.error("Failed to persist Google Calendar prompt dismissal:", e);
      setGoogleCalPromptDismissed(false);
    }
  };

  const toggleRaiChatStar = async (convoId, currentStarred) => {
    const nextStarred = !currentStarred;
    setRaiConvoList(prev => {
      const idx = prev.findIndex(c => c.id === convoId);
      if (idx < 0) return prev;
      const updated = { ...prev[idx], is_starred: nextStarred };
      const without = prev.filter(c => c.id !== convoId);
      // Re-insert: starred chats go to the top of starred group; unstarred
      // slide into the unstarred group by updated_at.
      if (nextStarred) {
        return [updated, ...without];
      } else {
        const firstUnstarred = without.findIndex(c => !c.is_starred);
        if (firstUnstarred < 0) return [...without, updated];
        return [...without.slice(0, firstUnstarred), updated, ...without.slice(firstUnstarred)];
      }
    });
    if (convoDb.toggleStar) {
      const { error } = await convoDb.toggleStar(convoId, nextStarred);
      if (error) {
        // Revert optimistic update
        setRaiConvoList(prev => prev.map(c => c.id === convoId ? { ...c, is_starred: currentStarred } : c));
      }
    }
  };

  // Delete chat. Confirms first — losing a conversation is unrecoverable.
  const deleteRaiChat = async (convoId) => {
    if (!confirm("Delete this chat? This can't be undone.")) return;
    // Optimistic remove from list
    setRaiConvoList(prev => prev.filter(c => c.id !== convoId));
    // If user is currently viewing the chat they deleted, reset to empty
    if (aiConvoId === convoId) {
      setAiMessages([]);
      setAiConvoId(null);
      setObservationContext(null);
      setFocusedTaskId(null);
    }
    if (convoDb.delete) {
      await convoDb.delete(convoId);
    }
  };
  // ──────────────────────────────────────────────────────────────────────

  // ═══ PANEL COMPONENTS ═══
  const PanelCard = ({ children, style }) => <div style={{ background: "#FAFAF8", borderRadius: 14, border: "1px solid #E8ECE6", padding: "14px", marginBottom: 24, ...style }}>{children}</div>;
  
  // ─── Daybook save handler removed with the Daybook panel. ─────────────


  // ─── DAYBOOK PANEL — replaces Talk to Rai on Today's right rail ─────
  const goTo = (id) => {
    if (page === "health" && id !== "health") { setHcDone({}); setHcOpen(null); }
    if (id === "health") {
      // Persist observation-viewed state to DB so the red dot doesn't
      // resurrect on page refresh. Updates viewed_at = NOW() on the
      // current observation row. Best-effort: if the write fails the
      // in-session healthObsSeen still hides the dot for this tab.
      setHealthObsSeen(true);
      if (observation && observation.id) {
        observationsDb.markViewed(observation.id)
          .then(({ data, error }) => {
            if (error) {
              console.warn("Failed to mark observation viewed:", error);
              return;
            }
            // Mirror the persisted timestamp into local state so the
            // healthDot computation below recognizes it as viewed
            // without needing a full data reload.
            if (data) setObservation(prev => prev ? { ...prev, viewed_at: data.viewed_at } : prev);
          })
          .catch(err => console.warn("markViewed threw:", err));
      }
    }
    setPage(id);
  };
  const allPages = [...navItemsCore, ...moreItemsCore];
  const pageTitle = allPages.find(n => n.id === page)?.label || "";
  const totalRev = clients.reduce((a, c) => a + c.revenue, 0);
  const overdueChecks = hcQueue.filter(h => (h.overdue > 0 || h.due === "Today") && !hcDone[h.client]).length;
  const totalRefRev = refs.filter(r => r.status === "converted" || r.converted).reduce((a, r) => a + (r.revenue || 0), 0);

  const todayDot = tasksDone < tasksTotal;
  // An observation is considered "new" only if (a) it exists in an
  // active status, AND (b) it has not been viewed yet — viewed_at IS
  // NULL in the DB. Once the user visits the Health page, viewed_at
  // is written and the dot stays off permanently for that observation,
  // surviving page refreshes (the previous in-memory-only fix did not).
  // healthObsSeen is kept as a same-session optimistic flag so the dot
  // hides immediately on Health visit without waiting for the DB round-
  // trip; the persisted viewed_at then makes it stick across refreshes.
  const hasNewObservation = !!observation
    && observation.status !== "unpacked"
    && observation.status !== "dropped"
    && !observation.viewed_at;
  const healthDot = overdueChecks > 0 || (hasNewObservation && !healthObsSeen && page !== "health");
  // Rolodex check-in dot: lit when any contact has a reminder due (today or
  // earlier) and the user hasn't opened Rolodex since. Clears on visiting the
  // page (see goTo). Contained entirely in Rolodex — no client/Rai coupling.
  const _rolodexReminderToday = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  })();
  const rolodexHasDueReminder = (rolodex || []).some(r => r.reminder && String(r.reminder).slice(0, 10) <= _rolodexReminderToday);
  const rolodexDot = rolodexHasDueReminder && !rolodexCheckinDismissed && page !== "retros";
  const hasDot = (id) => (id === "today" && todayDot) || (id === "health" && healthDot) || (id === "retros" && rolodexDot);

  // All state/handlers the extracted page components read. Rebuilt each
  // render — same freshness semantics as the original inline JSX.
  // Realtime subscriptions (worker completions, multi-device edits,
  // Rai pick/state changes). Hook lives in src/hooks/useRealtimeSync.
  // Called here — after every referenced declaration — to avoid TDZ.
  useRealtimeSync({ inFlightToggles, profileScores, setClients, setRaiPicks, setRaiState, setTasks, setWorkerCompletions, userTimezone, user, raiBurstTrackerRef });
  const pageCtx = {
    addRef,
    brainDumpOpen,
    setBrainDumpOpen,
    aiAttachments,
    aiEndRef,
    aiInput,
    aiMessages,
    aiStreaming,
    aiTyping,
    aiUserRef,
    allCompletions,
    allTouchpoints,
    askActed,
    askActiveId,
    askDraft,
    askTone,
    beginTaskEdit,
    calcNewClientBoost,
    calcProfileScore,
    calcProfileScoreRaw,
    calcRetentionScore,
    calendarMonth,
    cancelTaskEdit,
    clientDrift,
    clientSearch,
    clients,
    clientsDriftFilter,
    clientsScoreFilter,
    clientsSort,
    clientsView,
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
    disconnectGoogleCalendar,
    dismissCalendarEventLink,
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
    goTo,
    googleConnectPromptDismissed,
    googleConnected,
    googleEmail,
    googleLastSyncedAt,
    googleSyncing,
    handleFilePick,
    hcDone,
    hcOpen,
    hcQueue,
    healthStripOpen,
    isMobile,
    justCompletedIds,
    justPromoted,
    laterCalOpen,
    linkCalendarEvent,
    longPressTimerRef,
    manualTaskOrder,
    networkAsOf,
    newClient,
    newRolodexEntry,
    newTask,
    newTaskDueDate,
    newTaskRecurrencePattern,
    newTaskRecurring,
    newTaskWorkerId,
    obsDismissing,
    obsMobileExpanded,
    observation,
    occurrenceFlags,
    onboardingStep,
    openDismissFlow,
    parserSetDueDateRef,
    parserSetRecurrenceRef,
    pendingAutoSendRef,
    pendingAutoTitleRef,
    personalEvents,
    profileDimensions,
    profileScores,
    profileStep,
    pulseChip,
    purgeTaskHistory,
    raiPicks,
    raiState,
    rankMode,
    refForm,
    refFrom,
    refName,
    refs,
    retroDeleteConfirm,
    reviewQueueMoreOpen,
    rolodex,
    rolodexCheckinDismissed,
    dismissRolodexCheckin,
    rolodexFiledFilter,
    rolodexFlowOpen,
    rolodexSearch,
    rolodexStep,
    rolodexStepOwner,
    rolodexStepText,
    rowDuePickerId,
    sendAi,
    setAddWorkerOpen,
    setAiAttachments,
    setAiConvoId,
    setAiInput,
    setAiMessages,
    setAiTasks,
    setAskActed,
    setAskActiveId,
    setAskDraft,
    setAskTone,
    setCalendarMonth,
    setClientSearch,
    setClientTab,
    setClientsSort,
    setClientsView,
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
    setHcDone,
    setHcOpen,
    setHealthStripOpen,
    setLaterCalOpen,
    setLinkPicker,
    setLinkPickerSearch,
    setManualTaskOrder,
    setNetworkAsOf,
    setNewClient,
    setNewRolodexEntry,
    setNewTask,
    setNewTaskDueDate,
    setNewTaskRecurrencePattern,
    setNewTaskRecurring,
    setNewTaskWorkerId,
    setNewWorkerEmail,
    setNewWorkerName,
    setNewWorkerRole,
    setObsDismissing,
    setObsMobileExpanded,
    setObservation,
    setObservationContext,
    setOnboardingStep,
    setPage,
    setPauseConfirm,
    setPersonalEvents,
    setProfileScores,
    setProfileStep,
    setQuickLogOpen,
    setQuickLogText,
    setQuickLogToast,
    setRankMode,
    setRefEditData,
    setRefEditing,
    setRefForm,
    setRefFrom,
    setRefName,
    setRefRevenue,
    setRemoveConfirm,
    setResumeConfirm,
    setRetroDeleteConfirm,
    setReviewQueueMoreOpen,
    setRolodex,
    setRolodexConfirm,
    setRolodexFiledFilter,
    setRolodexFlowOpen,
    setRolodexSearch,
    setRolodexStep,
    setRolodexStepOwner,
    setRolodexStepText,
    setRowDuePickerActions,
    setRowDuePickerId,
    setRowDuePickerRect,
    setSelectedClient,
    setSelectedRolodex,
    setShowAddClient,
    setShowAddRolodex,
    setShowUpcoming,
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
    setWorkersList,
    showAddClient,
    showAddRolodex,
    showUpcoming,
    submitNewClient,
    swipeLock,
    swipeOffset,
    swipeStartX,
    swipeStartY,
    syncGoogleCalendar,
    taskOccurrences,
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
    workerCompletions,
    workerPickerOpen,
    workersList,
  };

  return (
    <div className="app-root" style={{ minHeight: "100vh", fontFamily: "'Manrope', system-ui, sans-serif", color: C.text, background: "transparent" }}>
      {/* Non-blocking font load via <link> (not @import, which is
          render-blocking). display=swap. Do NOT use display=optional — it
          permanently keeps the fallback font if the web font isn't ready in
          ~100ms, which broke site-wide typography. */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,300..700,30..100,0..1;1,9..144,300..700,30..100,0..1&family=Caveat:wght@500;600;700&display=swap"
      />
      {/* ─── First-run onboarding overlays (see components/Onboarding) ─── */}
      {onboardingStep === "welcome" && (
        <WelcomeOverlay
          onStart={() => setOnboardingStep("client")}
          onSkip={() => { markWelcomed(); setOnboardingStep(null); }}
        />
      )}
      {onboardingStep === "client" && (
        <QuickAddClientCard
          onSubmit={async (f) => {
            const c = await quickCreateClient(f.name, f.contact, f.revenue);
            markWelcomed();
            if (c) {
              setOnboardingStep("task");
              setPage("today");
            }
            // On failure: stay on the card (it resets its busy state and
            // the user retries) rather than silently closing the overlay.
            return !!c;
          }}
          onSkip={() => { markWelcomed(); setOnboardingStep(null); }}
        />
      )}
      {onboardingStep === "book" && (
        <RosterBuilder
          existingNames={clients.map(c => c.name)}
          onAdd={(name) => quickCreateClient(name)}
          onClose={() => {
            try { window.localStorage.setItem("rt:onboarded", "1"); } catch (_) { /* unavailable */ }
            setOnboardingStep(null);
          }}
        />
      )}
      <style>{APP_CSS}</style>

      {/* Lightning flash — fires when focus mode toggles on */}
      {/* (Lightning flash removed — too loud for the polish-layer aesthetic) */}

      {/* Fireworks */}
      {confetti && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, pointerEvents: "none", overflow: "hidden" }}>
          {/* Multiple burst origins */}
          {[
            { x: 30, y: 35, delay: 0, color: "#7c5cf3" },
            { x: 70, y: 30, delay: 0.2, color: "#2D8659" },
            { x: 50, y: 25, delay: 0.4, color: "#B88B15" },
            { x: 20, y: 40, delay: 0.55, color: "#33543E" },
            { x: 80, y: 35, delay: 0.45, color: "#C4432B" },
            { x: 45, y: 45, delay: 0.7, color: "#558B68" },
          ].map((burst, bi) => (
            <div key={bi} style={{ position: "absolute", left: `${burst.x}%`, top: `${burst.y}%` }}>
              {/* Glow */}
              <div style={{
                position: "absolute", width: 120, height: 120, borderRadius: "50%",
                background: `radial-gradient(circle, ${burst.color}66 0%, transparent 70%)`,
                left: -60, top: -60,
                animation: `fwGlow 1.2s ease-out ${burst.delay + 0.1}s forwards`,
                opacity: 0,
              }} />
              {/* Particles */}
              {Array.from({ length: 24 }).map((_, pi) => {
                const angle = (pi / 24) * Math.PI * 2;
                const dist = 60 + Math.random() * 80;
                const dx = Math.cos(angle) * dist;
                const dy = Math.sin(angle) * dist;
                const size = 3 + Math.random() * 4;
                const colors = [burst.color, "#fff", burst.color + "cc", "#FFD700", "#FF6B6B", "#7C3AED", "#10B981"];
                return (
                  <div key={pi} style={{
                    position: "absolute", width: size, height: size, borderRadius: "50%",
                    background: colors[pi % colors.length],
                    boxShadow: `0 0 ${size * 2}px ${colors[pi % colors.length]}`,
                    "--dx": `${dx}px`, "--dy": `${dy}px`,
                    animation: `fwBurst ${0.8 + Math.random() * 0.6}s ease-out ${burst.delay + 0.05}s forwards`,
                    opacity: 0,
                  }} />
                );
              })}
              {/* Trail sparks */}
              {Array.from({ length: 8 }).map((_, si) => {
                const angle = (si / 8) * Math.PI * 2;
                const dist = 30 + Math.random() * 40;
                return (
                  <div key={`s${si}`} style={{
                    position: "absolute", left: Math.cos(angle) * dist, top: Math.sin(angle) * dist,
                    fontSize: 6 + Math.random() * 6, color: "#FFD700",
                    animation: `fwSparkle ${0.4 + Math.random() * 0.4}s ease-in-out ${burst.delay + 0.3 + Math.random() * 0.5}s`,
                    opacity: 0,
                  }}>✦</div>
                );
              })}
            </div>
          ))}
          {/* Rising trails */}
          {[
            { x: 30, delay: 0 },
            { x: 70, delay: 0.15 },
            { x: 50, delay: 0.3 },
            { x: 20, delay: 0.5 },
            { x: 80, delay: 0.4 },
            { x: 45, delay: 0.6 },
          ].map((trail, ti) => (
            <div key={`t${ti}`} style={{
              position: "absolute", left: `${trail.x}%`, bottom: 0,
              width: 3, height: 3, borderRadius: "50%",
              background: "#FFD700", boxShadow: "0 0 8px #FFD700, 0 0 16px #FFD70066",
              animation: `fwLaunch 0.5s ease-out ${trail.delay}s forwards`,
              opacity: 0, animationFillMode: "forwards",
            }} />
          ))}
        </div>
      )}

      {/* SIDEBAR — dark green primary-deep frame. Provides architectural
          contrast against the cream content area. Active nav items pop
          forward as warm-cream chips; everything else recedes. */}
      <div
        className={"r-desk" + (sidebarCollapsed ? " is-collapsed" : "")}
        onMouseEnter={() => {
          // Hover-to-open only matters BELOW the pin breakpoint. At/above the
          // breakpoint the sidebar is pinned 240 already and hover is irrelevant.
          if (typeof window === "undefined" || window.innerWidth >= SIDEBAR_PIN_BP) return;
          if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; }
          hoverTimerRef.current = setTimeout(() => { setHoverExpanded(true); hoverTimerRef.current = null; }, 150);
        }}
        onMouseLeave={() => {
          if (typeof window === "undefined" || window.innerWidth >= SIDEBAR_PIN_BP) return;
          if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; }
          hoverTimerRef.current = setTimeout(() => { setHoverExpanded(false); hoverTimerRef.current = null; }, 250);
        }}
        style={{ width: sidebarCollapsed ? 64 : 240, background: "linear-gradient(170deg, #F6F2EC 0%, #ECE6DA 100%)", display: "flex", flexDirection: "column", position: "fixed", top: 14, left: 14, bottom: 14, zIndex: 50, borderRadius: 14, boxShadow: "0 0 0 1px " + C.deepCream + ", 0 1px 2px rgba(20,30,22,0.05), 6px 0 18px rgba(20,30,22,0.08)", overflowY: "auto", transition: "width 200ms var(--rt-ease-out)" }}>
        {/* Brand. Expanded: "Retayned." aligned left at 22px padding.
            Collapsed: "R." centered. The collapse/expand toggle lives
            OUTSIDE the sidebar (as a sibling, see below) so it can
            straddle the right edge as a floating disc without being
            clipped by the sidebar's overflow-y: auto. */}
        <div style={{ padding: sidebarCollapsed ? "22px 0 28px" : "22px 22px 28px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: sidebarCollapsed ? "center" : "flex-start" }}>
          <span style={{
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontWeight: 900,
            fontSize: 22,
            color: C.primary,
            letterSpacing: "-0.04em",
            lineHeight: 1.15,
            display: "inline-block",
            paddingBottom: 2,
          }}>{sidebarCollapsed ? "R." : "Retayned."}</span>
        </div>

        {/* Nav items — fixed, always visible */}
        <div style={{ padding: sidebarCollapsed ? "0 8px" : "0 10px", flexShrink: 0 }}>
          {navItemsCore.map(n => {
            const active = page === n.id;
            return (
              <div key={n.id} className={"nav-item" + (active ? " is-active" : "")} onClick={() => goTo(n.id)} title={sidebarCollapsed ? n.label : undefined} style={{
                display: "flex", alignItems: "center", gap: sidebarCollapsed ? 0 : 11,
                justifyContent: sidebarCollapsed ? "center" : "flex-start",
                padding: sidebarCollapsed ? "10px 0" : "9px 12px",
                borderRadius: 9,
                marginBottom: 2,
                color: active ? C.primaryDeep : C.textSec,
                fontWeight: active ? 600 : 500,
                // Embossed active surface — subtle white→warm-cream gradient +
                // stacked inset highlights + outer shadow so the active card
                // reads as a key set into the rail.
                background: active
                  ? "linear-gradient(180deg, #FFFFFF 0%, #F5F1E8 100%)"
                  : "transparent",
                boxShadow: active
                  ? "inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(28,50,36,0.05), 0 1px 2px rgba(20,30,22,0.04), 0 4px 10px rgba(20,30,22,0.05)"
                  : "none",
                transform: active ? "translateY(-0.5px)" : "none",
                cursor: "pointer",
                position: "relative",
                transition: "all 180ms var(--rt-ease-out)",
              }}>
                <span style={{ width: 20, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={n.icon} size={20} color={active ? C.primaryDeep : C.textSec} accent={active ? C.primary : C.ink500} /></span>
                {!sidebarCollapsed && <span style={{ fontSize: 14, flex: 1 }}>{n.label}</span>}
                {hasDot(n.id) && <div style={{ position: sidebarCollapsed ? "absolute" : "static", top: sidebarCollapsed ? 6 : "auto", right: sidebarCollapsed ? 6 : "auto", width: 7, height: 7, borderRadius: "50%", background: C.danger, boxShadow: "0 0 0 2.5px " + (active ? C.card : C.sidebar), flexShrink: 0 }} />}
              </div>
            );
          })}
        </div>

        {/* Coach-only: New Chat button + scrollable past-chats list. Takes all
            remaining vertical space so the list scrolls internally without
            affecting nav items or the Portfolio widget at the bottom. */}
        {page === "coach" && !sidebarCollapsed ? (
          <>
            {/* Rai-page: New Chat button — always visible directly below
                the Rai nav item. flexShrink: 0 + its own wrapper means it
                survives any viewport compression. Convo list (below) is
                what scrolls when the sidebar runs out of room. */}
            <div style={{ padding: "8px 10px 0", flexShrink: 0 }}>
              <button className="rt-rai-pop-btn" onClick={startNewRaiChat} style={{ width: "100%", padding: "8px 12px", borderRadius: 9, color: "#fff", fontSize: 13, fontWeight: 500, textAlign: "left", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 11, transition: "background 200ms var(--rt-ease-out)" }}>
                <Icon name="plus" size={17} color="currentColor" />
                <span>New Chat</span>
              </button>
            </div>
            {/* Convo list — flex: 1 + overflowY: auto scrolls internally
                when there isn't enough room. Holds Starred + Recent. */}
            {raiConvoList.length > 0 && (() => {
              const starred = raiConvoList.filter(c => c.is_starred);
              const recent = raiConvoList.filter(c => !c.is_starred);
              const section = (label, items) => (
                <>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: C.textSec, letterSpacing: "0.18em", textTransform: "uppercase", padding: "14px 10px 6px" }}>{label}</div>
                  {items.map(c => {
                    const isActive = c.id === aiConvoId;
                    const title = c.title || c.client?.name || "Untitled chat";
                    return (
                      <div
                        key={c.id}
                        className={"r-convo-row" + (isActive ? " is-active" : "")}
                        onClick={() => openRaiChat(c.id)}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "8px 10px 8px 12px",
                          borderRadius: 9, cursor: "pointer",
                          background: isActive ? "rgba(255,255,255,0.06)" : "transparent",
                          color: isActive ? "#FFFFFF" : C.textSec,
                          fontSize: 12.5,
                          fontWeight: isActive ? 600 : 500,
                          position: "relative",
                          transition: "background 160ms var(--rt-ease-out), color 160ms var(--rt-ease-out)",
                        }}
                      >
                        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
                        <button
                          className="r-convo-action r-convo-star"
                          onClick={e => { e.stopPropagation(); toggleRaiChatStar(c.id, c.is_starred); }}
                          style={{ background: "none", border: "none", padding: 3, cursor: "pointer", color: c.is_starred ? "#E6B800" : C.textMuted, display: "flex", opacity: c.is_starred ? 1 : 0, transition: "opacity 0.12s" }}
                          title={c.is_starred ? "Unstar" : "Star"}
                        >
                          <Icon name={c.is_starred ? "starFill" : "star"} size={12} />
                        </button>
                        <button
                          className="r-convo-action r-convo-del"
                          onClick={e => { e.stopPropagation(); deleteRaiChat(c.id); }}
                          style={{ background: "none", border: "none", padding: 3, cursor: "pointer", color: C.textMuted, display: "flex", opacity: 0, transition: "opacity 0.12s" }}
                          title="Delete"
                        >
                          <Icon name="trash" size={12} />
                        </button>
                      </div>
                    );
                  })}
                </>
              );
              return (
                <div className="r-rai-sidebar-list" style={{ padding: "4px 10px 10px", flex: 1, minHeight: 0, overflowY: "auto" }}>
                  {starred.length > 0 && section("Starred", starred)}
                  {recent.length > 0 && section("Recent", recent)}
                </div>
              );
            })()}
            {raiConvoList.length === 0 && <div style={{ flex: 1, minHeight: 0 }} />}
          </>
        ) : (
          /* Non-coach pages: empty spacer pushes Portfolio widget to bottom */
          <div style={{ flex: 1, minHeight: 0 }} />
        )}
        {/* Combined sidebar widget — tasks completed (top) + portfolio (bottom),
            single surface, hairline divider. Tasks section uses a Week/Month/Year
            toggle whose period state lives at app level so it persists across
            sidebar re-renders. Portfolio bar/counts unchanged.
            Gated on !dataLoaded → returns null while loading. Previously this
            was gated only on clients.length > 0, which produced a visible
            sidebar pop-in: empty during the load window (clients = []),
            then materializing once data arrived. Skeleton in the main area
            covered the page content but the sidebar kept reflowing. Now
            sidebar holds steady through the load. */}
        {(() => {
          if (sidebarCollapsed) return null;
          if (!dataLoaded) return null;
          // Hide widget on Rai page — that page uses the middle of the
          // sidebar for the New Chat button + convo history list, which
          // needs the full remaining vertical space to scroll cleanly.
          if (page === "coach") return null;
          const total = clients.length;
          if (total === 0) return null;
          const buckets = clients.reduce((acc, c) => {
            const r = c.ret || 0;
            if (r >= 80) acc.thriving++;
            else if (r >= 65) acc.healthy++;
            else if (r >= 45) acc.watch++;
            else if (r >= 25) acc.atRisk++;
            else acc.critical++;
            return acc;
          }, { thriving: 0, healthy: 0, watch: 0, atRisk: 0, critical: 0 });
          const segs = [
            { n: buckets.thriving, label: "Thriving", color: C.retElite },
            { n: buckets.healthy,  label: "Healthy",  color: C.retGood  },
            { n: buckets.watch,    label: "Watch",    color: C.retOk    },
            { n: buckets.atRisk,   label: "At risk",  color: C.retWarn  },
            { n: buckets.critical, label: "Critical", color: C.retCrit  },
          ].filter(s => s.n > 0);
          const periodCount = taskCompletedCounts[taskCompletedPeriod] || 0;

          // Compute the callout — positive only, period-aware, prioritized.
          //
          // Priority order (only first matching rule fires):
          //   1. Year milestones (round numbers like 100, 250, 500, 1000…)
          //   2. Records ("fastest in N weeks/months") — N must be ≥ 6
          //   3. Comparisons ("+N vs last") — week ≥ 3, month ≥ 10
          //   4. Streaks (≥ 3 days)
          //   5. Recovery (last week was 0, this week is non-zero)
          //
          // Each branch returns { line1, line2 } or null. If null, no callout
          // shows. The circle around the number is gated on the same condition.
          // Sidebar callout: "plus N / tasks today" — two-line handwritten
          // note pointing at the big completion number. Counts tasks the
          // user completed today (checked off in the task list). Always
          // renders — at 0 it shows "plus 0 / tasks today" so the slot
          // is a stable always-present line. The ↙ arrow on line two
          // points down-left toward the big number below.
          const computeCallout = () => {
            const today = taskCompletedCounts.today || 0;
            return { line1: "plus " + today, line2: "↙ tasks today" };
          };

          const callout = computeCallout();

          return (
            <div className="rt-sidebar-widget" style={{ padding: "14px 16px", margin: "0 10px 8px", background: "rgba(60,45,25,0.03)", borderRadius: 12, position: "relative", boxShadow: "inset 0 1px 3px rgba(60,45,25,0.10), inset 0 -1px 0 rgba(255,255,255,0.4)", flexShrink: 0 }}>
              {/* Handwritten callout — TEMPORARILY HIDDEN per request.
                  Restore by uncommenting the block below.
              <div
                style={{
                  position: "absolute",
                  top: -16,
                  right: -2,
                  fontFamily: "'Caveat', 'Bradley Hand', 'Marker Felt', cursive",
                  fontSize: 18,
                  color: C.primaryDeep,
                  transform: "rotate(-6deg)",
                  pointerEvents: "none",
                  lineHeight: 1.05,
                  fontWeight: 600,
                }}
              >
                {callout.line1}
                <span style={{ display: "block", fontSize: 13, opacity: 0.75, marginLeft: 8, fontWeight: 500 }}>
                  {callout.line2}
                </span>
              </div>
              */}

              {/* TASKS COMPLETED section */}
              <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "0.5px solid " + C.border }}>
                <div style={{ fontSize: 10, color: C.textSec, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 10 }}>Done</div>
                <div style={{ display: "flex", justifyContent: "flex-start", gap: 14, marginBottom: 12 }}>
                  {[{ id: "week", label: "Week" }, { id: "month", label: "Month" }, { id: "year", label: "Year" }].map(p => {
                    const active = taskCompletedPeriod === p.id;
                    return (
                      <div
                        key={p.id}
                        className={active ? undefined : "r-period-opt"}
                        onClick={() => setTaskCompletedPeriod(p.id)}
                        style={{
                          padding: "5px 0",
                          fontSize: 10.5,
                          fontWeight: 500,
                          cursor: "pointer",
                          ...(active
                            ? { color: C.primaryDeep, borderBottom: "1px solid " + C.primary }
                            : { color: C.textSec }),
                        }}
                      >
                        {p.label}
                      </div>
                    );
                  })}
                </div>
                <div style={{ position: "relative", display: "inline-block", padding: "4px 10px 8px" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: C.text, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{periodCount.toLocaleString()}</div>
                  <svg style={{ position: "absolute", inset: 0, pointerEvents: "none" }} viewBox="0 0 70 38" preserveAspectRatio="none">
                    <path d="M 52 4 C 38 2, 18 4, 8 12 C 2 19, 4 30, 18 33 C 32 36, 54 35, 62 28 C 68 21, 64 10, 50 6 C 44 4, 36 4, 30 5"
                          stroke={C.primaryDeep} strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.9" />
                  </svg>
                </div>
                <div style={{ color: C.textSec, fontSize: 9.5 }}>Tasks Completed</div>
              </div>
              {/* PORTFOLIO section — simplified to a quiet stat block matching
                  the DONE section above: same uppercase caption (with client
                  count), then MRR as the Fraunces hero number. The "MRR" unit
                  is dropped to caption size so the dollar figure leads. */}
              <div style={{ fontSize: 10, color: C.textSec, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 10 }}>Portfolio · {total}</div>
              <div style={{ color: C.text, lineHeight: 1.15, fontFamily: "'Fraunces', Georgia, serif", fontVariationSettings: '"opsz" 96, "SOFT" 50, "WONK" 0', fontVariantNumeric: "tabular-nums" }}>
                <span className="rt-widget-mrr" style={{ fontSize: 22, fontWeight: 500, fontStyle: "italic" }}>${(totalRev / 1000).toFixed(1)}k</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: C.textSec, marginLeft: 6, letterSpacing: 0.3 }}>MRR</span>
              </div>
            </div>
          );
        })()}
        <div style={{ padding: sidebarCollapsed ? "0 8px" : "0 10px", flexShrink: 0 }}>
          {(() => {
            const active = page === "settings";
            return (
              <div className={"nav-item" + (active ? " is-active" : "")} onClick={() => goTo("settings")} title={sidebarCollapsed ? "Settings" : undefined} style={{
                display: "flex", alignItems: "center", gap: sidebarCollapsed ? 0 : 11,
                justifyContent: sidebarCollapsed ? "center" : "flex-start",
                padding: sidebarCollapsed ? "10px 0" : "9px 12px",
                borderRadius: 9,
                marginBottom: 2,
                color: active ? C.primaryDeep : C.textSec,
                fontWeight: active ? 600 : 500,
                background: active
                  ? "linear-gradient(180deg, #FFFFFF 0%, #F5F1E8 100%)"
                  : "transparent",
                boxShadow: active
                  ? "inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(28,50,36,0.05), 0 1px 2px rgba(20,30,22,0.04), 0 4px 10px rgba(20,30,22,0.05)"
                  : "none",
                transform: active ? "translateY(-0.5px)" : "none",
                cursor: "pointer",
                position: "relative",
                transition: "all 180ms var(--rt-ease-out)",
              }}>
                <span style={{ width: 20, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="settings" size={20} color={active ? C.primaryDeep : C.textSec} accent={active ? C.primary : C.ink500} /></span>
                {!sidebarCollapsed && <span style={{ fontSize: 14, flex: 1 }}>Settings</span>}
              </div>
            );
          })()}
        </div>
        <div style={{ padding: sidebarCollapsed ? "10px 0 14px" : "10px 6px 14px", flexShrink: 0 }}>
          <div className="rt-user-chip" style={{ display: "flex", alignItems: "center", gap: sidebarCollapsed ? 0 : 10, justifyContent: sidebarCollapsed ? "center" : "flex-start", padding: sidebarCollapsed ? "8px 0" : "8px 10px", borderRadius: 8, cursor: "pointer", background: "transparent", transition: "background 160ms var(--rt-ease-out), box-shadow 200ms var(--rt-ease-out), transform 200ms var(--rt-ease-out)" }}>
            <div style={{ width: 28, height: 28, borderRadius: 14, background: C.primarySoft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: C.primary, flexShrink: 0 }}>{getUserInitial(user)}</div>
            {!sidebarCollapsed && (
              <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600, color: C.text, textTransform: "capitalize", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User"}</div><div style={{ fontSize: 11, color: C.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.user_metadata?.company || ""}</div></div>
            )}
          </div>
        </div>
      </div>

      {/* (Sidebar toggle arrow removed — sidebar state is purely width-driven:
          pinned open at ≥1700px, thin rail with hover-to-overlay below.) */}

      {/* MOBILE TOP */}
      {/* Mobile top bar deliberately removed (May 2026).
          Page identity is established by each page's own h1/eyebrow;
          account-level actions (profile, sign out, theme, integrations)
          live in Settings, reachable via the mobile bottom nav.
          Removing the bar reclaims ~52px of vertical real estate. */}

      <div className="r-main">

        {/* GLOBAL LOADING GATE — render a single calm SkeletonPage
            while data is still loading. This replaces the previous
            pattern where each page mounted its own status band and
            rails immediately with empty/zero data, then snapped to
            real values when load completed — producing a visible
            flash of "0 tasks", "0%", "$0k", empty greetings, etc.
            With one full-page skeleton at this level, nothing real
            paints until everything is ready to paint correctly.
            The .r-main container's padding/sizing wraps the skeleton
            the same way it wraps real content, so there's no layout
            shift when the swap happens. */}
        {!dataLoaded && <SkeletonPage />}

        {/* ─── Google Calendar OAuth result toast ─────────────────────
            Fixed-position, top-center, auto-clears via the effect that
            sets googleConnectStatus. Shown after the user returns from
            the OAuth round-trip and we've read the ?google_calendar
            query param. Five status values map to five short messages.
            Click X to dismiss early; otherwise it auto-closes via the
            timeout set in the param-handler effect. */}
        {googleConnectStatus && (
          <div style={{
            position: "fixed",
            top: 18,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            background: googleConnectStatus === "connected" ? "#1F3D2A" : "#2A1414",
            color: "#fff",
            padding: "10px 16px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 500,
            boxShadow: "0 4px 16px rgba(20,30,22,0.15), 0 2px 4px rgba(20,30,22,0.10)",
            display: "flex",
            alignItems: "center",
            gap: 12,
            maxWidth: "92vw",
            fontFamily: "inherit",
            animation: "rt-toast-in 220ms var(--rt-ease-out, cubic-bezier(.2,.6,.2,1))",
          }}>
            <span>
              {googleConnectStatus === "connected" && (googleEmail ? `Google Calendar connected — ${googleEmail}` : "Google Calendar connected.")}
              {googleConnectStatus === "disconnected" && "Google Calendar disconnected."}
              {googleConnectStatus === "denied" && "Google Calendar not connected — you cancelled the consent."}
              {googleConnectStatus === "error" && "Couldn't connect to Google Calendar. Try again."}
              {googleConnectStatus === "expired" && "Connection took too long and expired. Try again."}
              {googleConnectStatus === "no_refresh_token" && "Google didn't issue a refresh token. Disconnect at myaccount.google.com → Security, then try again."}
            </span>
            <button
              onClick={() => setGoogleConnectStatus(null)}
              style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", padding: 0, fontSize: 16, lineHeight: 1, fontFamily: "inherit" }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {/* ─── Calendar event link picker (inline from dial) ──────────
            Renders when the user clicks "needs client" on a dial event.
            Floating panel anchored to the click point. Lets them pick a
            client, a rolodex entry, or dismiss the prompt. Picked entity
            calls linkCalendarEvent; dismiss calls dismissCalendarEventLink.
            Closes on Escape, outside click, or after a pick.  */}
        {linkPicker && (() => {
          const anchor = linkPicker.anchor;
          // Anchor below the click point if there's room; otherwise above.
          // 320px panel width, ~360px max height.
          const PANEL_W = 320;
          const PANEL_MAX_H = 380;
          const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
          const vh = typeof window !== "undefined" ? window.innerHeight : 800;
          // Prefer right-aligned to the anchor (since the click point is
          // on the right side of the dial). Bound to viewport.
          let leftPx = (anchor?.right || vw / 2) - PANEL_W;
          if (leftPx < 12) leftPx = 12;
          if (leftPx + PANEL_W > vw - 12) leftPx = vw - 12 - PANEL_W;
          // Position vertically — prefer below the click. Fall back above.
          let topPx = (anchor?.bottom || vh / 2) + 6;
          if (topPx + PANEL_MAX_H > vh - 12) {
            topPx = Math.max(12, (anchor?.top || vh / 2) - PANEL_MAX_H - 6);
          }
          // Filtered lists by search term
          const q = linkPickerSearch.trim().toLowerCase();
          const filterFn = (n) => !q || (n || "").toLowerCase().includes(q);
          const visibleClients = (clients || []).filter(c => c.is_active !== false && filterFn(c.name)).slice().sort((a, b) => (a.name || "").localeCompare(b.name || ""));
          const visibleRolodex = (rolodex || []).filter(r => filterFn(r.client || r.name)).slice().sort((a, b) => ((a.client || a.name) || "").localeCompare((b.client || b.name) || ""));
          const doPick = async (kind, id) => {
            if (kind === "client") await linkCalendarEvent({ eventId: linkPicker.eventId, clientId: id });
            else if (kind === "rolodex") await linkCalendarEvent({ eventId: linkPicker.eventId, rolodexId: id });
            else if (kind === "dismiss") await dismissCalendarEventLink(linkPicker.eventId);
            setLinkPicker(null);
            setLinkPickerSearch("");
          };
          return (
            <>
              {/* Click-catcher backdrop. Transparent — full-viewport so
                  any click outside the panel closes the picker. */}
              <div
                onClick={() => { setLinkPicker(null); setLinkPickerSearch(""); }}
                style={{ position: "fixed", inset: 0, zIndex: 9998, background: "transparent" }}
              />
              <div
                role="dialog"
                aria-label="Link calendar event to client"
                onKeyDown={(e) => { if (e.key === "Escape") { setLinkPicker(null); setLinkPickerSearch(""); } }}
                style={{
                  position: "fixed",
                  left: leftPx,
                  top: topPx,
                  width: PANEL_W,
                  maxHeight: PANEL_MAX_H,
                  zIndex: 9999,
                  background: "#fff",
                  border: "1px solid " + C.borderLight,
                  borderRadius: 10,
                  boxShadow: "0 8px 24px rgba(20,30,22,0.12), 0 2px 6px rgba(20,30,22,0.08)",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  fontFamily: "inherit",
                  animation: "rt-toast-in 160ms var(--rt-ease-out, cubic-bezier(.2,.6,.2,1))",
                }}
              >
                <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid " + C.borderLight }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 6 }}>
                    Link to
                  </div>
                  <input
                    autoFocus
                    type="text"
                    value={linkPickerSearch}
                    onChange={(e) => setLinkPickerSearch(e.target.value)}
                    placeholder="Search clients or prospects…"
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      border: "1px solid " + C.borderLight,
                      borderRadius: 6,
                      fontSize: 13,
                      fontFamily: "inherit",
                      color: C.text,
                      background: C.surfaceWarm || "#FAF6EE",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div style={{ overflowY: "auto", flex: 1, padding: "4px 0" }}>
                  {visibleClients.length > 0 && (
                    <>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase", padding: "8px 12px 4px" }}>Clients</div>
                      {visibleClients.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => doPick("client", c.id)}
                          style={{
                            display: "block",
                            width: "100%",
                            textAlign: "left",
                            background: "transparent",
                            border: "none",
                            padding: "8px 12px",
                            fontSize: 13,
                            color: C.text,
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                          onMouseOver={(e) => { e.currentTarget.style.background = C.surfaceWarm || "#FAF6EE"; }}
                          onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}
                        >
                          {c.name}
                          {c.contact && <span style={{ marginLeft: 6, fontSize: 11, color: C.textMuted, fontStyle: "italic" }}>· {c.contact}</span>}
                        </button>
                      ))}
                    </>
                  )}
                  {visibleRolodex.length > 0 && (
                    <>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase", padding: "8px 12px 4px" }}>Rolodex (prospects)</div>
                      {visibleRolodex.map(r => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => doPick("rolodex", r.id)}
                          style={{
                            display: "block",
                            width: "100%",
                            textAlign: "left",
                            background: "transparent",
                            border: "none",
                            padding: "8px 12px",
                            fontSize: 13,
                            color: C.text,
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                          onMouseOver={(e) => { e.currentTarget.style.background = C.surfaceWarm || "#FAF6EE"; }}
                          onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}
                        >
                          {r.client || r.name}
                          {r.contact && <span style={{ marginLeft: 6, fontSize: 11, color: C.textMuted, fontStyle: "italic" }}>· {r.contact}</span>}
                        </button>
                      ))}
                    </>
                  )}
                  {visibleClients.length === 0 && visibleRolodex.length === 0 && (
                    <div style={{ padding: "12px", fontSize: 12, color: C.textMuted, fontStyle: "italic" }}>
                      No matches.
                    </div>
                  )}
                </div>
                <div style={{ borderTop: "1px solid " + C.borderLight, padding: "6px 8px" }}>
                  <button
                    type="button"
                    onClick={() => doPick("dismiss")}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      background: "transparent",
                      border: "none",
                      fontSize: 12,
                      color: C.textMuted,
                      fontStyle: "italic",
                      cursor: "pointer",
                      textAlign: "left",
                      borderRadius: 6,
                      fontFamily: "inherit",
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.background = C.surfaceWarm || "#FAF6EE"; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    Not a client — ignore this event
                  </button>
                </div>
              </div>
            </>
          );
        })()}

        {/* ═══ TODAY — TASK MANAGER ═══ */}
        {dataLoaded && page === "today" && <TodayPage app={pageCtx} />}

        {/* ═══ SWEEPS (ENTERPRISE) ═══ */}

        {/* ═══ CLIENTS v2 — compare-first ═══ */}
        {dataLoaded && page === "clients" && <ClientsPage app={pageCtx} />}

        {/* ═══ HEALTH CHECKS ═══ */}
        {dataLoaded && page === "health" && <HealthPage app={pageCtx} />}

        {/* ═══ REFERRAL INTELLIGENCE (ENTERPRISE) ═══ */}

        {/* ═══ WORKERS — delegate tasks to team / freelancers ═══ */}
        {dataLoaded && page === "workers" && <WorkersPage app={pageCtx} />}

        {/* Add-worker modal */}
        {addWorkerOpen && (
          <>
            <div onClick={() => setAddWorkerOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(20,30,22,0.40)", zIndex: 99 }} />
            <div style={{
              position: "fixed", top: "20vh", left: "50%", transform: "translateX(-50%)",
              width: 460, maxWidth: "calc(100vw - 32px)",
              background: C.card, borderRadius: 14, padding: "24px 26px",
              boxShadow: "0 20px 50px rgba(20,30,22,0.30)",
              zIndex: 100,
            }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 14px" }}>Add Worker</h3>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: C.textSec, marginBottom: 5, letterSpacing: "0.02em" }}>Name</label>
                <input
                  autoFocus
                  value={newWorkerName}
                  onChange={e => setNewWorkerName(e.target.value)}
                  placeholder="Sarah Kim"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, fontFamily: "inherit", fontSize: 13.5, color: C.text, background: C.bg, outline: "none" }}
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: C.textSec, marginBottom: 5, letterSpacing: "0.02em" }}>Email</label>
                <input
                  type="email"
                  value={newWorkerEmail}
                  onChange={e => setNewWorkerEmail(e.target.value)}
                  placeholder="sarah@yourdomain.com"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, fontFamily: "inherit", fontSize: 13.5, color: C.text, background: C.bg, outline: "none" }}
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: C.textSec, marginBottom: 5, letterSpacing: "0.02em" }}>Role <span style={{ color: C.textMuted, fontWeight: 400 }}>· optional</span></label>
                <input
                  value={newWorkerRole}
                  onChange={e => setNewWorkerRole(e.target.value)}
                  placeholder="Internal · Freelancer · VA"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, fontFamily: "inherit", fontSize: 13.5, color: C.text, background: C.bg, outline: "none" }}
                />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22, paddingTop: 18, borderTop: "1px solid " + C.borderLight }}>
                <button
                  onClick={() => setAddWorkerOpen(false)}
                  style={{ padding: "8px 14px", background: "transparent", color: C.textSec, borderRadius: 8, fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >Cancel</button>
                <button
                  onClick={async () => {
                    if (!newWorkerName.trim() || !newWorkerEmail.trim()) return;
                    const { data, error } = await workersDb.create(user.id, {
                      name: newWorkerName.trim(),
                      email: newWorkerEmail.trim(),
                      role: newWorkerRole.trim() || null,
                    });
                    if (data) {
                      setWorkersList(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
                      setAddWorkerOpen(false);
                    } else if (error) {
                      alert("Failed to add worker: " + error.message);
                    }
                  }}
                  disabled={!newWorkerName.trim() || !newWorkerEmail.trim()}
                  style={{
                    padding: "8px 14px",
                    background: (!newWorkerName.trim() || !newWorkerEmail.trim()) ? C.btnDisabled : C.btn,
                    color: "#fff", border: "none", borderRadius: 8,
                    fontFamily: "inherit", fontSize: 13, fontWeight: 600,
                    cursor: (!newWorkerName.trim() || !newWorkerEmail.trim()) ? "default" : "pointer",
                  }}
                >Add Worker</button>
              </div>
            </div>
          </>
        )}

        {/* ═══ REFERRALS v2 — "The Network Map" ═══ */}
        {dataLoaded && page === "referrals" && <ReferralsPage app={pageCtx} />}

        {/* ═══ ROLODEX v2 — "The Deck" ═══ */}
        {dataLoaded && page === "retros" && <RetrosPage app={pageCtx} />}
        {/* ═══ COACH / TALK TO RAI — Claude-style chat ═══ */}
        {dataLoaded && page === "coach" && <CoachPage app={pageCtx} />}

        {/* ═══ SETTINGS ═══ */}
        {dataLoaded && page === "settings" && <SettingsPage app={pageCtx} />}
      </div>

      {/* CLIENT SLIDE-OVER */}
      {selectedClient && <ClientModal app={{ ...pageCtx, active, angle, c, d, months, next, now, payload, total, updated, val, engagementPausesByClient, billingAddOpen, billingMonthStatus, billingNewItem, billingTerms, client, clientBilling, clientMenuOpen, clientTab, confidantEndRef, confidantInput, confidantLastActivity, confidantLoadingThread, confidantMessages, confidantTyping, data, day, editScores, editingOverview, editingProfile, history, id, overviewEditData, pauseConfirm, r, radarHoverDim, removeConfirm, resumeConfirm, ret, rolodexConfirm, selectedClient, sendConfidantMessage, setBillingAddOpen, setBillingMonthStatus, setBillingNewItem, setBillingTerms, setClientBilling, setClientMenuOpen, setClients, setConfidantInput, setEditScores, setEditingOverview, setEditingProfile, setEngagementPausesByClient, setOverviewEditData, setRadarHoverDim, setRenewalModal, setRenewalModalMonth, setShowBaselineEdit, setTermsAddingNew, setTermsEditDraft, setTermsEditingId, setTermsHistoryOpen, showBaselineEdit, size, t, termsAddingNew, termsEditDraft, termsEditingId, termsHistoryOpen, title, value, clientAddons, anchor, baseline, completed, editingAddon, events, fmtDate, idx, isActive, lines, newAddon, other, page, pauses, pinned, section, setClientAddons, setEditingAddon, setEditingAddonId, setNewAddon, task, text, today, triggered, updates, without }} />}


      {/* ROLODEX SLIDE-OVER */}
      {rowDuePickerId && rowDuePickerRect && rowDuePickerActions && createPortal(
        <div
          className="rt-row-due-pop"
          style={{
            position: "fixed",
            top: rowDuePickerRect.bottom + 6,
            left: rowDuePickerRect.right - 140,
            background: C.card,
            border: "1px solid " + C.borderLight,
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(20,30,22,0.12), 0 2px 6px rgba(20,30,22,0.06)",
            padding: 5,
            zIndex: 5000,
            width: 140,
            fontFamily: "'Manrope', system-ui, sans-serif",
          }}
        >
          {[
            { label: "Today", on: rowDuePickerActions.today },
            { label: "Tomorrow", on: rowDuePickerActions.tomorrow },
            { label: "Later", on: rowDuePickerActions.later },
          ].map(opt => (
            <button key={opt.label}
              className="rt-picker-item"
              onClick={(e) => { e.stopPropagation(); opt.on(); setRowDuePickerId(null); setRowDuePickerRect(null); setRowDuePickerActions(null); }}
            >{opt.label}</button>
          ))}
        </div>,
        document.body
      )}
      {renewalModal && createPortal(
        (() => {
          const rm = renewalModal;
          const [yr, mo] = (renewalModalMonth || "").split("-").map(Number);
          const monthDate = new Date(yr, mo - 1, 1);
          const monthName = monthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
          const firstDow = monthDate.getDay();
          const daysInMonth = new Date(yr, mo, 0).getDate();
          const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
          const shiftMonth = (delta) => {
            let nmo = mo + delta, nyr = yr;
            if (nmo < 1) { nmo = 12; nyr--; } else if (nmo > 12) { nmo = 1; nyr++; }
            setRenewalModalMonth(`${nyr}-${String(nmo).padStart(2, "0")}`);
          };
          const fmtDate = rm.date ? new Date(rm.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Not set";
          const saveRenewal = async () => {
            const updates = { renewal_date: rm.date || null, renewal_recurrence: rm.recurrence || "none" };
            setClients(prev => prev.map(c => c.id === rm.client.id ? { ...c, ...updates } : c));
            if (selectedClient && selectedClient.id === rm.client.id) setSelectedClient({ ...selectedClient, ...updates });
            // If opened from the edit form, keep its in-memory copy in sync too.
            if (rm.fromEdit) setOverviewEditData(prev => ({ ...prev, renewal_date: rm.date || null, renewal_recurrence: rm.recurrence || "none" }));
            setRenewalModal(null);
            try { await clientsDb.update(rm.client.id, updates); } catch (e) { console.warn("renewal save failed:", e); }
          };
          return (
            <div onClick={() => setRenewalModal(null)} style={{ position: "fixed", inset: 0, zIndex: 6000, background: "rgba(20,30,22,0.4)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "8vh 20px", fontFamily: "'Manrope', system-ui, sans-serif" }}>
              <div onClick={e => e.stopPropagation()} style={{ background: C.card, borderRadius: 18, padding: 24, width: "100%", maxWidth: 380, boxShadow: "0 1px 3px rgba(20,30,22,0.1), 0 30px 70px rgba(20,30,22,0.3)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>Renewal date</h2>
                  <button onClick={() => setRenewalModal(null)} style={{ width: 28, height: 28, borderRadius: 8, border: "none", background: C.surfaceWarm, color: C.textSec, fontSize: 15, cursor: "pointer" }}>✕</button>
                </div>
                <div style={{ fontSize: 12.5, color: C.textMuted, marginBottom: 18 }}>When does {rm.client.name} renew?</div>

                <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 6 }}>Date <span style={{ fontWeight: 500, color: C.textSec }}>· {fmtDate}</span></label>
                <div style={{ background: C.bg, borderRadius: 12, padding: 12, boxShadow: "inset 0 1px 2px rgba(20,30,22,0.06)", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <button onClick={() => shiftMonth(-1)} style={{ border: "none", background: "none", fontSize: 16, color: C.textMuted, cursor: "pointer", padding: "2px 8px" }}>‹</button>
                    <b style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{monthName}</b>
                    <button onClick={() => shiftMonth(1)} style={{ border: "none", background: "none", fontSize: 16, color: C.textMuted, cursor: "pointer", padding: "2px 8px" }}>›</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 4 }}>
                    {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i} style={{ fontSize: 9, color: C.textMuted, textAlign: "center", fontWeight: 600 }}>{d}</span>)}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
                    {Array.from({ length: firstDow }).map((_, i) => <span key={"e" + i} />)}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const ds = `${yr}-${String(mo).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                      const sel = rm.date === ds;
                      const isToday = todayStr === ds;
                      return (
                        <div key={day} onClick={() => setRenewalModal({ ...rm, date: ds })} style={{ aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, borderRadius: 7, cursor: "pointer", color: sel ? "#fff" : C.text, fontWeight: sel ? 700 : 500, background: sel ? C.primary : "transparent", boxShadow: isToday && !sel ? "inset 0 0 0 1.5px #B0903A" : "none" }}>{day}</div>
                      );
                    })}
                  </div>
                </div>

                {rm.date && (
                  <>
                    <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 6 }}>Repeats</label>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
                      {[{ v: "none", l: "One-time" }, { v: "monthly", l: "Monthly" }, { v: "quarterly", l: "Quarterly" }, { v: "annual", l: "Annual" }].map(opt => {
                        const active = (rm.recurrence || "none") === opt.v;
                        return <button key={opt.v} onClick={() => setRenewalModal({ ...rm, recurrence: opt.v })} style={{ padding: "8px 13px", border: "none", borderRadius: 9, fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", background: active ? C.primarySoft : C.card, boxShadow: "inset 0 0 0 1px " + (active ? C.primary : C.borderLight), color: active ? C.primary : C.textSec }}>{opt.l}</button>;
                      })}
                    </div>
                  </>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={saveRenewal} style={{ flex: 1, padding: 12, border: "none", borderRadius: 10, background: C.btn, color: "#fff", fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Save renewal</button>
                  {rm.date && <button onClick={() => setRenewalModal({ ...rm, date: "", recurrence: "none" })} style={{ padding: "12px 16px", border: "none", borderRadius: 10, background: C.surfaceWarm, color: C.textSec, fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Clear</button>}
                  <button onClick={() => setRenewalModal(null)} style={{ padding: "12px 16px", border: "none", borderRadius: 10, background: C.surface, color: C.text, fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Cancel</button>
                </div>
              </div>
            </div>
          );
        })(),
        document.body
      )}

      {/* Phase 9 — Rai task dismiss feedback modal.
          Opens when a Rai-suggested task is dismissed. Captures a short
          reason (optional) so the lesson extractor can learn from the
          dismissal. Skipping gives the default "user_deleted" which
          only powers the 14-day anti-repeat, not a lesson. */}
      {dismissModalTask && createPortal(
        (() => {
          const task = dismissModalTask.task;
          const PRESET_CHIPS = [
            { id: "wrong_client", label: "Wrong client" },
            { id: "already_done", label: "Already handled" },
            { id: "not_relevant", label: "Not relevant" },
            { id: "wrong_timing", label: "Wrong time" },
          ];
          return (
            <div onClick={() => skipDismissReason()} style={{ position: "fixed", inset: 0, zIndex: 6500, background: "rgba(20,30,22,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "10vh 20px", fontFamily: "'Manrope', system-ui, sans-serif" }}>
              <div onClick={e => e.stopPropagation()} style={{ background: C.card, borderRadius: 18, padding: 24, width: "100%", maxWidth: 460, boxShadow: "0 1px 3px rgba(20,30,22,0.1), 0 30px 70px rgba(20,30,22,0.3)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6, gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <h2 style={{ fontSize: 17, fontWeight: 700, color: C.text, margin: 0, marginBottom: 4 }}>Why dismiss?</h2>
                    <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.45 }}>
                      Optional — but helps Rai stop suggesting things like this.
                    </div>
                  </div>
                  <button onClick={skipDismissReason} style={{ width: 28, height: 28, borderRadius: 8, border: "none", background: C.surfaceWarm, color: C.textSec, fontSize: 15, cursor: "pointer", flexShrink: 0 }} aria-label="nevermind">✕</button>
                </div>

                <div style={{ marginTop: 14, fontSize: 13, color: C.text, padding: "10px 12px", background: C.surfaceWarm, borderRadius: 10, fontStyle: "italic", lineHeight: 1.45 }}>
                  "{task.text}"
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 16 }}>
                  {PRESET_CHIPS.map(c => {
                    const selected = (dismissReasonChips || []).includes(c.id);
                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          setDismissReasonChips(prev => {
                            const arr = prev || [];
                            return arr.includes(c.id) ? arr.filter(x => x !== c.id) : [...arr, c.id];
                          });
                        }}
                        style={{
                          padding: "9px 12px",
                          fontSize: 12.5,
                          fontWeight: 600,
                          borderRadius: 8,
                          border: "1px solid " + (selected ? C.retGood : C.borderLight),
                          background: selected ? "#E8F3EC" : "#fff",
                          color: selected ? C.retGood : C.textSec,
                          cursor: "pointer",
                          fontFamily: "inherit",
                          transition: "all 120ms ease",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          textAlign: "left",
                        }}
                      >
                        <span>{c.label}</span>
                        {selected && (
                          <span style={{ width: 14, height: 14, borderRadius: 4, background: C.retGood, color: "#fff", fontSize: 10, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <textarea
                  value={dismissReasonText}
                  onChange={e => setDismissReasonText(e.target.value)}
                  placeholder="Add detail (optional). The more specific, the better Rai gets."
                  rows={3}
                  style={{
                    width: "100%",
                    marginTop: 12,
                    padding: "10px 12px",
                    border: "none",
                    boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)",
                    borderRadius: 10,
                    fontSize: 13,
                    fontFamily: "inherit",
                    outline: "none",
                    background: C.surfaceWarm,
                    resize: "vertical",
                    boxSizing: "border-box",
                    color: C.text,
                  }}
                />

                <div style={{ display: "flex", alignItems: "center", marginTop: 18, justifyContent: "space-between" }}>
                  <button
                    onClick={skipDismissReason}
                    style={{ padding: "8px 4px", background: "transparent", color: C.textMuted, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", textUnderlineOffset: 3 }}
                  >
                    Nevermind
                  </button>
                  <button
                    onClick={confirmDismissWithReason}
                    style={{ padding: "10px 16px", background: C.primary, color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 1px 2px rgba(51,84,62,0.15), 0 2px 6px rgba(51,84,62,0.22)" }}
                  >
                    Delete Task
                  </button>
                </div>
              </div>
            </div>
          );
        })(),
        document.body
      )}

      {selectedRolodex && <RolodexModal app={{ ...pageCtx, answers, d, n, p, sel, t, total, updated, rolodexRemoveConfirm, setRolodexRemoveConfirm, active, day, gap, history, id, kept, left, months, on, q, r, reminderDate, reminderRecur, reminderRepeatOn, retroAnswers, right, rolodexEditData, rolodexEditing, rolodexMenuOpen, rolodexMoveConfirm, selectedRolodex, setReminderDate, setReminderRecur, setReminderRepeatOn, setRetroAnswers, setRolodexEditData, setRolodexEditing, setRolodexMenuOpen, setRolodexMoveConfirm, setShowReminderPicker, showReminderPicker, size, title, value, x }} />}


      {/* REFERRAL SLIDE-OVER */}
      {refEditing !== null && (() => {
        const r = refs.find((x, i) => (x.id || i) === refEditing);
        if (!r) return null;
        const isActive = r.status === "converted" || (r.converted && r.status !== "closed");
        return (
          <>
            <div onClick={() => setRefEditing(null)} style={{ position: "fixed", inset: 0, background: "rgba(20,30,22,0.32)", zIndex: 90 }} />
            <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "100%", maxWidth: 420, background: C.card, boxShadow: "-4px 0 24px rgba(0,0,0,0.08)", zIndex: 100, overflowY: "scroll" }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid " + C.borderLight, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: C.card, zIndex: 1 }}>
                <h2 style={{ fontSize: 20, fontWeight: 800 }}>{refEditData.to || r.to}</h2>
                <button onClick={() => setRefEditing(null)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.textMuted }}>×</button>
              </div>

              <div style={{ padding: "20px" }}>
                {/* Status badge */}
                <div style={{ marginBottom: 20 }}>
                  <span style={{ fontSize: 14, padding: "6px 16px", borderRadius: 6, fontWeight: 600, background: isActive ? "#E2F3EB" : "#FAE8E4", color: isActive ? C.success : C.danger }}>{isActive ? "Active" : "Closed"}</span>
                </div>

                {/* Details */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Referred client</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <select value={refEditData.to || ""} onChange={e => setRefEditData({...refEditData, to: e.target.value})} style={{ flex: 1, padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg, minWidth: 0 }}>
                        <option value="">Choose a client…</option>
                        {refEditData.to && !clients.find(c => c.name === refEditData.to) && (
                          <option value={refEditData.to}>{refEditData.to} (legacy — not in client list)</option>
                        )}
                        {clients.filter(c => c.name !== refEditData.from).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                      <button
                        type="button"
                        onClick={() => { setRefEditing(null); setPage("clients"); setShowAddClient(true); }}
                        title="Add new client"
                        style={{ flexShrink: 0, padding: "0 12px", background: C.surface, color: C.textSec, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
                      >+ New</button>
                    </div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6, lineHeight: 1.4 }}>
                      Add the client on the Clients page first if they're not in this list.
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Referred by</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <select value={refEditData.from || ""} onChange={e => setRefEditData({...refEditData, from: e.target.value})} style={{ flex: 1, padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg, minWidth: 0 }}>
                        <option value="">Choose a referrer…</option>
                        {refEditData.from && !clients.find(c => c.name === refEditData.from) && (!rolodex || !rolodex.find(r => r.client === refEditData.from)) && (
                          <option value={refEditData.from}>{refEditData.from} (legacy)</option>
                        )}
                        <optgroup label="Clients">
                          {[...clients].sort((a, b) => b.ret - a.ret).filter(c => c.name !== refEditData.to).map(c => <option key={"c-" + c.id} value={c.name}>{c.name}</option>)}
                        </optgroup>
                        {rolodex && rolodex.length > 0 && (
                          <optgroup label="Rolodex">
                            {rolodex.filter(r => r.client && r.client !== refEditData.to).map(r => <option key={"r-" + r.id} value={r.client}>{r.client}</option>)}
                          </optgroup>
                        )}
                      </select>
                      <button
                        type="button"
                        onClick={() => { setRefEditing(null); setPage("retros"); setShowAddRolodex(true); }}
                        title="Add new rolodex contact"
                        style={{ flexShrink: 0, padding: "0 12px", background: C.surface, color: C.textSec, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
                      >+ New</button>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Status</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      {[{ id: "converted", label: "Active" }, { id: "closed", label: "Closed" }].map(s => {
                        const sel = (refEditData.status || (refEditData.converted ? "converted" : "lost")) === s.id;
                        const isRed = s.id === "closed";
                        return (
                          <button key={s.id} onClick={() => setRefEditData({...refEditData, status: s.id, converted: s.id === "converted" || s.id === "closed"})} style={{ padding: "8px 18px", borderRadius: 8, border: "1.5px solid " + (sel ? (isRed ? C.danger : C.primary) : C.borderLight), background: sel ? (isRed ? "#FAE8E4" : C.primarySoft) : C.bg, color: sel ? (isRed ? C.danger : C.primary) : C.textMuted, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{s.label}</button>
                        );
                      })}
                    </div>
                  </div>
                  {refEditData.to && (() => {
                    const refClient = clients.find(c => c.name === refEditData.to);
                    const rev = refClient?.revenue || 0;
                    return (
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Monthly revenue</label>
                        <div style={{ padding: "12px 16px", borderRadius: 8, fontSize: 14, color: rev > 0 ? C.text : C.textMuted, background: C.bg, fontWeight: rev > 0 ? 600 : 500 }}>
                          {refClient ? (rev > 0 ? "$" + rev.toLocaleString() + "/mo" : "Not set on client profile") : "—"}
                        </div>
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6, lineHeight: 1.4 }}>
                          {refClient ? `Pulled from ${refEditData.to}'s client profile.` : "Legacy referral — no linked client record."}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                  <button onClick={() => setRefEditing(null)} style={{ padding: "10px 16px", background: C.surface, color: C.textSec, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                  <button className="r-btn" data-tone="purple" onClick={() => {
                    // Snapshot revenue from the referred-to client at save
                    // time. Legacy referrals where the referred-to name
                    // isn't in the client list keep whatever revenue was
                    // previously stored on the row (refEditData.revenue).
                    const refClient = clients.find(c => c.name === refEditData.to);
                    const snapshotRevenue = refClient
                      ? (refClient.revenue || 0)
                      : (parseInt(refEditData.revenue) || 0);
                    setRefs(prev => prev.map((x, idx) => (x.id || idx) === refEditing ? { ...x, to: refEditData.to, from: refEditData.from, status: refEditData.status, converted: refEditData.status === "converted" || refEditData.status === "closed", revenue: snapshotRevenue, totalRevenue: parseInt(refEditData.totalRevenue) || 0 } : x));
                    referralsDb.update(refEditing, {
                      referred_to: refEditData.to,
                      referred_by: refEditData.from,
                      status: refEditData.status,
                      revenue: snapshotRevenue,
                      total_revenue: parseInt(refEditData.totalRevenue) || 0,
                    });
                    setRefEditing(null);
                  }} style={{ flex: 1, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
                </div>

                <button onClick={() => { setRefs(prev => prev.filter((x, idx) => (x.id || idx) !== refEditing)); referralsDb.delete(refEditing); setRefEditing(null); }} style={{ width: "100%", padding: "10px", background: "transparent", color: C.danger, border: "1px solid " + C.danger + "44", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 12 }}>Delete Referral</button>
              </div>
            </div>
          </>
        );
      })()}


      {/* MOBILE BOTTOM NAV — horizontally scrollable strip with a center-pinned
          FAB. All destinations live inline in the strip (no More menu); users
          swipe left/right to reach overflow items. The purple `+` FAB sits
          absolutely-positioned at the geometric center of the dock and stays
          put while the strip scrolls behind it. Strip has left/right padding
          equal to half the FAB's footprint so the first/last items can scroll
          fully into view without permanently sitting under the FAB. */}
      {/* Shell overlays: dock + More sheet + quick-log FAB + capture sheet (extracted June 2026) */}
      <ShellOverlays app={{ ...pageCtx, dockShrunk, hasDot, keyboardOpen, mobileMoreOpen, page, quickLogOpen, quickLogText, setMobileMoreOpen }} />


      {/* Brain Dump — review-before-commit extraction modal. App-level so
          it works from every page (capture sheet, Today composer). */}
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

      {/* Toast — bottom-right confirmation with undo */}
      {quickLogToast && (
        <QuickLogToast
          toast={quickLogToast}
          onUndo={() => {
            const t = quickLogToast;
            if (t.kind === "task" && t.recordId) {
              setTasks(prev => prev.filter(x => x.id !== t.recordId));
              tasksDb.delete(t.recordId);
            } else if (t.kind === "touchpoint" && t.recordId) {
              setTpLogged(prev => prev.filter(x => x.id !== t.recordId));
              touchpointsDb.delete(t.recordId);
            } else if (t.kind === "event" && t.recordId) {
              setPersonalEvents(prev => (prev || []).filter(e => e.id !== t.recordId));
              personalCalendarDb.remove(t.recordId);
            }
            // After removing, offer to re-log as the opposite type — the most
            // likely reason for an undo is a wrong task/touchpoint guess. Only
            // for task↔touchpoint (events excluded), and only when we captured a
            // client (a touchpoint needs one). correctTo carries the target type.
            if (t.relog && (t.kind === "task" || t.kind === "touchpoint")) {
              const other = t.kind === "task" ? "touchpoint" : "task";
              setQuickLogToast({ id: Date.now(), kind: "removed", correctTo: other, relog: t.relog, label: t.relog.clientName });
            } else {
              setQuickLogToast(null);
            }
          }}
          onCorrect={async () => {
            const t = quickLogToast;
            const r = t.relog;
            if (!r) { setQuickLogToast(null); return; }
            if (t.correctTo === "touchpoint") {
              const optimisticId = "qltp" + Date.now();
              setTpLogged(prev => [{ id: optimisticId, client: r.clientName, channel: r.channel }, ...prev]);
              try {
                const { data: created } = await touchpointsDb.create(user.id, { client_id: r.clientId, client_name: r.clientName, channel: r.channel, notes: r.text });
                if (created?.id) setTpLogged(prev => prev.map(x => x.id === optimisticId ? { ...x, id: created.id } : x));
                setQuickLogToast({ id: Date.now(), kind: "touchpoint", recordId: created?.id || optimisticId, label: r.clientName, relog: r });
              } catch { setTpLogged(prev => prev.filter(x => x.id !== optimisticId)); setQuickLogToast({ id: Date.now(), error: true }); }
            } else {
              const dueDate = r.dueDate || (userTimezone ? ymdInTz(userTimezone, new Date()) : localYmd(new Date()));
              const optimisticId = "ql" + Date.now();
              setTasks(prev => [{ id: optimisticId, text: r.cleanedText, client: r.clientName, client_id: r.clientId, done: false, ai: false, recurring: false, recurrence_pattern: null, due_date: dueDate, raiPriority: false, alert: false, created_at: Date.now(), assigned_worker_id: null }, ...prev]);
              try {
                const _mlSplit = splitLongTask(r.cleanedText);
                const { data: created } = await tasksDb.create(user.id, { text: _mlSplit.text, notes: _mlSplit.notes, client_name: r.clientName, client_id: r.clientId, is_recurring: false, recurrence_pattern: null, due_date: dueDate, assigned_worker_id: null });
                if (created?.id) setTasks(prev => prev.map(x => x.id === optimisticId ? { ...x, id: created.id } : x));
                setQuickLogToast({ id: Date.now(), kind: "task", recordId: created?.id || optimisticId, label: r.clientName, relog: r });
              } catch { setTasks(prev => prev.filter(x => x.id !== optimisticId)); setQuickLogToast({ id: Date.now(), error: true }); }
            }
          }}
          onDismiss={() => setQuickLogToast(null)}
          C={C}
        />
      )}
    </div>
  );
}
