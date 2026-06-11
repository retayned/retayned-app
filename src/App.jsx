import TodayPage from "./pages/TodayPage";
import SweepsPage from "./pages/SweepsPage";
import ClientsPage from "./pages/ClientsPage";
import HealthPage from "./pages/HealthPage";
import ReferralIntelPage from "./pages/ReferralIntelPage";
import WorkersPage from "./pages/WorkersPage";
import ReferralsPage from "./pages/ReferralsPage";
import RetrosPage from "./pages/RetrosPage";
import CoachPage from "./pages/CoachPage";
import SettingsPage from "./pages/SettingsPage";
import WorkerDashboard from "./WorkerDashboard";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabase";
import { clientAddons as clientAddonsDb, clientBillingDb, clientBillingMonthStatusDb, clientBillingTermsDb, clientEngagementPausesDb, clients as clientsDb, raiConversations as convoDb, healthChecks as hcDb, observations as observationsDb, personalCalendar as personalCalendarDb, profile as profileDb, raiPicks as raiPicksDb, raiUserState as raiUserStateDb, realtime as realtimeDb, referrals as referralsDb, revenueHistoryDb, rolodex as rolodexDb, tasks as tasksDb, touchpoints as touchpointsDb, workers as workersDb } from "./lib/db";
import { createPortal } from "react-dom";
import { Icon } from "./components/Icon";
import { MobileCalendarStrip } from "./components/MobileCalendarStrip";
import { RaiMarkdown } from "./components/RaiMarkdown";
import { ReferralNetworkD3 } from "./components/ReferralNetworkD3";
import { EmptyState, SkeletonPage } from "./components/Skeletons";
import { BucketCalToggle, BucketCalendarLater, BucketCalendarTomorrow, QuickLogToast } from "./components/TaskBuckets";
import { TimeDial } from "./components/TimeDial";
import { enterpriseClients, referralReadiness, sweepData, sweepHistory, sweepTasks } from "./demoData";
import { mobileNavEnterpriseMore, mobileNavEnterprisePrimary, mobileNavMore, mobileNavPrimary, moreItemsCore, moreItemsEnterprise, navItemsCore, navItemsEnterprise } from "./nav";
import { lookupObservationIllustration } from "./observations";
import { parseCalendarEntry, parseComposer } from "./parser";
import { dateToYmd, formatRecurrenceLabel, nextOccurrenceDate } from "./recurrence";
import { C, THEME_CSS } from "./theme";
import { detectThinkingVerb, getUserInitial, getWorkerInitials, localYmd, retColor, retGradient, splitLongTask, tzMidnightInstant, ymdInTz } from "./utils";



export default function App({ user }) {
  // ─── ROUTING: Worker magic-link page lives at /w/{token} (no auth needed) ──
  // Detect this route before any auth-gated logic runs. Returns WorkerDashboard
  // standalone if matched.
  if (typeof window !== "undefined" && /^\/w\//.test(window.location.pathname)) {
    return <WorkerDashboard />;
  }

  // Tier flag — currently fixed at "core" everywhere. Kept as a constant
  // (not state) since setTier was never called and the value never
  // changes at runtime. When enterprise toggling is wired up, restore
  // useState here and add a setter call site.
  const tier = "core";  // "core" | "enterprise"
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
  // visualViewport API tracks the actual visible viewport. We write its height to a CSS var
  // that components can use instead of 100vh. Falls back gracefully on non-supporting browsers.
  // Also: detect keyboard open on mobile so we can hide the bottom nav (iOS covers the input
  // with the keyboard + the fixed bottom nav, making the input unreachable).
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // Breakpoint tracking. We use this for components that need to render
  // structurally different JSX on mobile vs desktop (rather than the
  // CSS-media-query approach used elsewhere in the app, which works well
  // for visual variants but breaks down when the layouts diverge enough
  // that responsive classes start fighting inline styles). The Observer
  // card is the first such component — too many !important rules became
  // brittle. Single source of truth, no className/style conflicts.
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const update = () => {
      document.documentElement.style.setProperty("--app-h", `${vv.height}px`);
      // Track visual viewport offset within the layout viewport. When the user
      // pinch-zooms, the visible area scrolls inside the page; without this offset,
      // fixed elements (like the bottom nav) stay anchored to the layout viewport
      // and visually drift away from the actual bottom of the screen.
      document.documentElement.style.setProperty("--vv-offset-top", `${vv.offsetTop}px`);
      // Keyboard is considered open when the visual viewport is meaningfully shorter
      // than the layout viewport. 100px threshold catches most mobile keyboards while
      // avoiding false positives on URL-bar collapse (which is typically ~60-80px).
      const gap = window.innerHeight - vv.height;
      setKeyboardOpen(gap > 100);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
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
  // ─── Google Calendar integration state ──────────────────────────
  // Reflects google_oauth_tokens row for this user (active connection
  // only). Loaded once on auth-ready and refreshed after connect/
  // disconnect actions. `googleConnected` is the boolean the UI reads;
  // `googleEmail` is the address Google reported (so we can show
  // "Connected as adam@retayned.com" in Settings).
  // `googleConnectPromptDismissed` is local-only (sessionStorage) — once
  // the user dismisses the Today-page banner, it stays gone for the
  // session, but the Settings row is always available.
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState(null);
  const [googleConnectPromptDismissed, setGoogleConnectPromptDismissed] = useState(() => {
    try { return sessionStorage.getItem("rt_gcal_prompt_dismissed") === "1"; } catch { return false; }
  });
  // Connection-flow status — non-null while we're showing a toast about
  // the result of the most recent OAuth round-trip. Values match the
  // `?google_calendar=...` query param the callback function returns:
  // 'connected', 'denied', 'error', 'expired', 'no_refresh_token'.
  const [googleConnectStatus, setGoogleConnectStatus] = useState(null);
  // Sync state for the "Sync now" affordance in Settings → Integrations.
  // googleSyncing is true while a manual sync request is in flight (so
  // the button can spinner / disable). googleLastSyncedAt updates after
  // a successful sync so the UI can show "last synced 2 min ago".
  const [googleSyncing, setGoogleSyncing] = useState(false);
  const [googleLastSyncedAt, setGoogleLastSyncedAt] = useState(null);
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
  // ─── Google Calendar OAuth handlers ────────────────────────────
  // connect: calls google-oauth-start, gets Google's consent URL,
  // sends the browser to it. After consent, Google redirects to the
  // callback edge function, which stores the refresh token and bounces
  // the user back to /settings?google_calendar=connected. The query
  // param is read on next mount to show a toast + refresh state.
  const connectGoogleCalendar = async () => {
    if (!user?.id) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        console.error('No session token for OAuth start');
        return;
      }
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-oauth-start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({}),
      });
      if (!resp.ok) {
        console.error('OAuth start failed:', resp.status, await resp.text());
        setGoogleConnectStatus('error');
        return;
      }
      const { url } = await resp.json();
      if (!url) {
        console.error('OAuth start returned no URL');
        setGoogleConnectStatus('error');
        return;
      }
      // Top-level navigation to Google's consent page. NOT window.open —
      // popup blockers will eat it, and the redirect-back flow needs a
      // full page nav anyway.
      window.location.assign(url);
    } catch (err) {
      console.error('connectGoogleCalendar threw:', err);
      setGoogleConnectStatus('error');
    }
  };
  // disconnect: calls google-oauth-disconnect, which revokes the token
  // with Google + soft-deletes the row + purges cached events. Refreshes
  // local state on success.
  const disconnectGoogleCalendar = async () => {
    if (!user?.id || !googleConnected) return;
    if (!window.confirm('Disconnect Google Calendar? Your synced events will be removed from Retayned.')) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) return;
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-oauth-disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({}),
      });
      if (!resp.ok) {
        console.error('Disconnect failed:', resp.status, await resp.text());
        return;
      }
      setGoogleConnected(false);
      setGoogleEmail(null);
      setGoogleConnectStatus('disconnected');
      // Re-show the Today-page banner so the user can reconnect easily.
      try { sessionStorage.removeItem("rt_gcal_prompt_dismissed"); } catch {}
      setGoogleConnectPromptDismissed(false);
    } catch (err) {
      console.error('disconnectGoogleCalendar threw:', err);
    }
  };
  // Pulls events from Google Calendar into personal_calendar_events.
  // Called automatically right after a successful connect (so the user
  // immediately sees events on the dial), and from a "Sync now" button
  // in Settings → Integrations. Returns { ok, fetched, upserted, deleted }
  // for the UI to display. Failures (e.g., revoked token) propagate by
  // way of toast status.
  const syncGoogleCalendar = async ({ silent = false } = {}) => {
    if (!user?.id) return null;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) return null;
      if (!silent) setGoogleSyncing(true);
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({}),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        console.error('Calendar sync failed:', resp.status, data);
        // If the token was revoked server-side, the function flagged
        // the connection as disconnected. Reflect that locally so the
        // UI prompts to reconnect.
        if (data?.error === 'token_revoked') {
          setGoogleConnected(false);
          setGoogleEmail(null);
          if (!silent) setGoogleConnectStatus('expired');
        } else if (!silent) {
          setGoogleConnectStatus('error');
        }
        return null;
      }
      // Refetch personal calendar events so the dial updates.
      try {
        const { data: refreshed } = await supabase
          .from('personal_calendar_events')
          .select('*')
          .eq('user_id', user.id);
        if (Array.isArray(refreshed)) setPersonalEvents(refreshed);
      } catch (e) {
        console.warn('Failed to refetch personal_calendar_events after sync:', e);
      }
      setGoogleLastSyncedAt(new Date().toISOString());
      return data;
    } catch (err) {
      console.error('syncGoogleCalendar threw:', err);
      if (!silent) setGoogleConnectStatus('error');
      return null;
    } finally {
      if (!silent) setGoogleSyncing(false);
    }
  };
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
  // On mount, check the URL for ?google_calendar=... — set by our
  // OAuth callback when it bounces the user back to Retayned. Values:
  //   connected: success, refresh token stored
  //   denied: user clicked Cancel at Google's consent screen
  //   error: token exchange failed or state token invalid
  //   expired: state token expired (>10 min between start and callback)
  //   no_refresh_token: Google didn't return refresh_token (rare —
  //     happens if user revoked then reconnected without consent prompt)
  // We pop a toast for each, then strip the param from the URL so it
  // doesn't fire again on subsequent renders. (Uses replaceState so
  // history isn't polluted.)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get("google_calendar");
    if (!status) return;
    // If user is still loading, BAIL early without stripping the URL.
    // This effect re-runs when user.id resolves, and we want to still
    // see the param on that second pass. Stripping the URL prematurely
    // means the second pass returns at the !status check and the sync
    // never fires — the bug that left users with the connection in DB
    // but no events synced.
    if (status === "connected" && !user?.id) return;
    setGoogleConnectStatus(status);
    // ALWAYS navigate to the Settings page when returning from OAuth.
    // The user clicked Connect from EITHER the Today-page banner or the
    // Settings page itself — and either way, Settings → Integrations is
    // the canonical home for the connection. Putting them there lets
    // them immediately see the connected-state confirmation, the email
    // it bound to, and the Disconnect option. This also resolves a
    // routing confusion: the callback redirects to /?... (the app root
    // — no real /settings route exists in this SPA), and historically
    // we relied on page state defaulting to "today" which made the
    // OAuth round-trip feel like nothing happened.
    setPage("settings");
    // On successful connect, also refresh the connection row from DB —
    // by this point the callback has written it, but our state was
    // loaded BEFORE the OAuth round-trip, so it's stale.
    if (status === "connected" && user?.id) {
      supabase
        .from("google_oauth_tokens")
        .select("google_email, disconnected_at, last_synced_at")
        .eq("user_id", user.id)
        .eq("provider", "google_calendar")
        .is("disconnected_at", null)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setGoogleConnected(true);
            setGoogleEmail(data.google_email);
            setGoogleLastSyncedAt(data.last_synced_at || null);
            // Immediately pull events so the dial populates without
            // requiring a manual "Sync now" click. Silent: false so any
            // failure surfaces via the toast (with a sensible message).
            syncGoogleCalendar({ silent: false });
          }
        });
    }
    // Strip the param from the URL AFTER all sync work has been
    // initiated (the .then above closes over the param value, but
    // since we've already kicked off the request, the strip is safe).
    params.delete("google_calendar");
    const newSearch = params.toString();
    const newUrl = window.location.pathname + (newSearch ? "?" + newSearch : "") + window.location.hash;
    window.history.replaceState({}, "", newUrl);
    // Auto-clear the toast after 5 seconds (sooner for success since
    // it's celebratory and unobtrusive).
    const t = setTimeout(() => setGoogleConnectStatus(null), status === "connected" ? 4000 : 6000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
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
  // Rolodex check-in dot "seen" — persisted per LOCAL DAY so a refresh
  // doesn't resurrect the dot (the in-memory flag reset on every reload).
  // New due reminders tomorrow re-light it naturally.
  const _rolodexSeenDayKey = "rt:rolodexSeenDay";
  const _todayLocalYmd = () => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  };
  const [rolodexRemindersSeen, setRolodexRemindersSeen] = useState(() => {
    try { return window.localStorage.getItem(_rolodexSeenDayKey) === _todayLocalYmd(); } catch { return false; }
  });

  // ── Google Calendar auto-sync ───────────────────────────────────────
  // syncGoogleCalendar previously had exactly ONE caller: the post-OAuth
  // connect flow. Nothing ever re-synced, so moved/edited Google events
  // never updated in the app. Now: silent sync on app load and on tab
  // refocus, throttled to once per 15 minutes (localStorage stamp — same
  // pattern as the activity heartbeat).
  useEffect(() => {
    if (!user?.id || !googleConnected) return;
    const beat = () => {
      try {
        const k = `rt:gcalSyncBeat:${user.id}`;
        const last = Number(localStorage.getItem(k) || 0);
        if (Date.now() - last > 15 * 60 * 1000) {
          try { localStorage.setItem(k, String(Date.now())); } catch (_) { /* unavailable */ }
          syncGoogleCalendar({ silent: true });
        }
      } catch (_) { /* localStorage unavailable — skip */ }
    };
    beat();
    const onFocus = () => beat();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [user?.id, googleConnected]);

  // Belt-and-suspenders for the rolodex dot: stamp "seen" whenever the
  // Rolodex page IS active, not only via goTo — covers any entry path
  // (restored sessions, programmatic navigation) so the dot can never
  // resurface after the page has actually been viewed today.
  useEffect(() => {
    if (page !== "retros") return;
    setRolodexRemindersSeen(true);
    try { window.localStorage.setItem(_rolodexSeenDayKey, _todayLocalYmd()); } catch (_) { /* unavailable */ }
  }, [page]);
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
  const loadData = useCallback(async () => {
    if (!user) return;
    // Wait for the user's stored timezone to load before fetching tasks.
    // Without this gate, loadData fires twice on sign-in: first with
    // userTimezone=null (which falls back to device-local TZ and may
    // bucket tasks into the wrong day), then again when the profile
    // effect sets userTimezone. That double-load is what produces the
    // ~2s "everything jumbled then sorts" jank Adam was seeing. The
    // skeleton state covers the (very brief) gap.
    if (!userTimezone) return;
    const uid = user.id;
    
    const [clientRes, taskRes, refRes, rolodexRes, hcRes, tpRes, hcCountsRes, convoListRes, raiStateRes, raiPicksRes, revHistoryRes, pausesRes, cadenceRes, completionHistRes, observerRes, _daybookRes, workersRes, workersComplRes, personalCalRes, taskCompletionsRes, occurrencesRes, profileFlagsRes] = await Promise.all([
      clientsDb.list(uid),
      tasksDb.listToday(uid),
      referralsDb.list(uid),
      rolodexDb.list(uid),
      hcDb.listPending(uid),
      touchpointsDb.listToday(uid),
      (typeof hcDb.countCompletedByClient === "function")
        ? hcDb.countCompletedByClient(uid)
        : Promise.resolve({ data: {}, error: null }),
      (typeof convoDb.list === "function")
        ? convoDb.list(uid, 250)
        : Promise.resolve({ data: [], error: null }),
      // Rai badge state + picks fetched in parallel with the rest. Previously
      // these ran sequentially AFTER the main Promise.all, which made the
      // "Rai's pick" badge appear several seconds late (cascading layout shift).
      // Failures here are non-fatal — defaults are sensible and the realtime
      // sub will catch up if a sweep lands while the app is open.
      (typeof raiUserStateDb?.get === "function")
        ? raiUserStateDb.get(uid).catch(() => ({ data: null, error: null }))
        : Promise.resolve({ data: null, error: null }),
      (typeof raiPicksDb?.getCurrent === "function")
        ? raiPicksDb.getCurrent(uid).catch(() => ({ data: null, error: null }))
        : Promise.resolve({ data: null, error: null }),
      // Revenue history — one batch fetch for ALL the user's clients. Used to
      // compute honest LTV (lifetime_revenue_at_entry + sum of monthly_rate
      // × time across history rows). Synchronous getAdjustedLTV reads from a
      // map built below, so this hydrate is the round-trip.
      supabase
        .from('client_revenue_history')
        .select('client_id, monthly_rate, started_at, ended_at, change_reason, change_note')
        .eq('user_id', uid)
        .then(r => r, () => ({ data: [], error: null })),
      // Engagement pauses — same batch pattern. Drives monthsTogether and
      // is_currently_paused on every client. Empty array on failure (table
      // may not exist yet during migration window).
      supabase
        .from('client_engagement_pauses')
        .select('id, client_id, paused_at, resumed_at, reason, note')
        .eq('user_id', uid)
        .then(r => r, () => ({ data: [], error: null })),
      // Promoted from sequential awaits to parallel. Each wrapped in .catch
      // so a missing function or empty table doesn't reject the whole batch;
      // null data on failure is the same as the previous try/catch behavior.
      // Cadence — 90-day touchpoint history for client cards.
      (typeof touchpointsDb.list === "function")
        ? touchpointsDb.list(uid, 90).catch(e => { console.warn("Cadence data failed to load:", e); return { data: null, error: e }; })
        : Promise.resolve({ data: null, error: null }),
      // Cadence — 90-day task-completion history (per-client) for the
      // Clients-page cadence + last-touch. tasks[] is today-only, so past
      // completions must come from task_completions.
      (typeof tasksDb.listCompletionsForCadence === "function")
        ? tasksDb.listCompletionsForCadence(uid, 90).catch(e => { console.warn("Completion history failed to load:", e); return { data: null, error: e }; })
        : Promise.resolve({ data: null, error: null }),
      // Observer card — weekly observation, may not exist.
      (typeof observationsDb?.getCurrent === "function")
        ? observationsDb.getCurrent(uid).catch(e => { console.warn("Observer card failed to load:", e); return { data: null, error: e }; })
        : Promise.resolve({ data: null, error: null }),
      // Daybook removed — placeholder keeps Promise.all positions stable.
      Promise.resolve({ data: null, error: null }),
      // Workers list + per-worker completion counts. Optional table — empty
      // arrays on failure so the composer worker chip just shows zero options.
      workersDb.list(uid).catch(e => { console.warn("Workers load failed:", e); return { data: null, error: e }; }),
      workersDb.getAllCompletions(uid).catch(e => { console.warn("Worker completions load failed:", e); return { data: null, error: e }; }),
      // Personal calendar events (Today timeline) + sidebar completion counts.
      // Both render on the default landing page so they belong in critical
      // path. As fire-and-forget they hydrated late, causing visible pop-in
      // on the Today calendar widget and the sidebar Portfolio widget.
      personalCalendarDb.listUpcoming(uid).catch(e => { console.warn("personal calendar load failed:", e); return { data: null, error: e }; }),
      (typeof tasksDb.getCompletedCounts === "function")
        ? tasksDb.getCompletedCounts(uid).catch(e => { console.warn("task completion counts failed:", e); return { data: null, error: e }; })
        : Promise.resolve({ data: null, error: null }),
      // Phase 3 occurrence-model — fetch last 90 days of task_occurrences
      // (covers any reader's window need; smallest window is 7d, biggest
      // is ~30d). Plus the user's occurrence_flags feature-flag map.
      // Both feed Phase 3 cutovers behind their respective flags. Safe to
      // run even before any reader is migrated — state just sits unused.
      supabase
        .from('task_occurrences')
        .select('*')
        .eq('user_id', uid)
        .gte('occurrence_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
        .order('occurrence_date', { ascending: false })
        .then(r => r, () => ({ data: [], error: null })),
      supabase
        .from('profiles')
        .select('occurrence_flags')
        .eq('id', uid)
        .single()
        .then(r => r, () => ({ data: { occurrence_flags: {} }, error: null })),
    ]);
    if (raiStateRes?.data) setRaiState(raiStateRes.data);
    setRaiPicks(raiPicksRes?.data || null);

    // ── Google Calendar connection status ──────────────────────────
    // Cheap side-fetch — checks the user's row in google_oauth_tokens
    // and lights up googleConnected + googleEmail for the UI. Runs
    // outside the main Promise.all (above) because it's recent code
    // and that batch is fragile to add to (positional destructuring of
    // a 20+ item tuple). Failure is non-fatal — the UI just shows
    // "not connected" and the user can connect from Settings.
    try {
      const { data: gcalRow } = await supabase
        .from('google_oauth_tokens')
        .select('google_email, disconnected_at, last_synced_at')
        .eq('user_id', uid)
        .eq('provider', 'google_calendar')
        .is('disconnected_at', null)
        .maybeSingle();
      if (gcalRow) {
        setGoogleConnected(true);
        setGoogleEmail(gcalRow.google_email);
        setGoogleLastSyncedAt(gcalRow.last_synced_at || null);
      } else {
        setGoogleConnected(false);
        setGoogleEmail(null);
        setGoogleLastSyncedAt(null);
      }
    } catch (err) {
      console.warn('google_oauth_tokens fetch failed (non-fatal):', err);
    }

    // Build per-client revenue history map: client_id → [history rows]
    const revHistoryByClient = {};
    for (const row of (revHistoryRes?.data || [])) {
      if (!revHistoryByClient[row.client_id]) revHistoryByClient[row.client_id] = [];
      revHistoryByClient[row.client_id].push(row);
    }

    // Build per-client engagement-pauses map. Used by monthsTogether
    // (subtract paused intervals) and isCurrentlyPaused (any open pause).
    const pausesByClient = {};
    for (const row of (pausesRes?.data || [])) {
      if (!pausesByClient[row.client_id]) pausesByClient[row.client_id] = [];
      pausesByClient[row.client_id].push(row);
    }
    setEngagementPausesByClient(pausesByClient);

    // Cadence / Observer / Daybook results from the parallel batch above.
    // Previously each was a sequential await with its own try/catch — that
    // added ~600-800ms to the critical path. Now they ride along with the
    // main batch and are processed here synchronously.
    if (cadenceRes?.data) setAllTouchpoints(cadenceRes.data);
    if (completionHistRes?.data) setAllCompletions(completionHistRes.data);
    if (observerRes?.data) {
      // viewed_at on the observation row is now the authoritative
      // "seen" marker — set when the user navigates to Health, persists
      // across refreshes (DB-backed). loadData just trusts what comes
      // back; no in-session flag manipulation here. The healthDot
      // computation derives from observation.viewed_at directly.
      // Reset mobile-expanded only for genuinely new observations
      // (different ID from prior). Avoids collapsing a manually-opened
      // card just because realtime triggered a reload.
      setObservation(prev => {
        const incoming = observerRes.data;
        const isNewObservation = !prev || prev.id !== incoming.id;
        if (isNewObservation) setObsMobileExpanded(false);
        return incoming;
      });
    }
    // Daybook hydration removed — RaiBriefPanel reads raiPicks/clients directly.

    if (tpRes.data) setTpLogged(tpRes.data.map(t => ({
      id: t.id,
      client: t.client_name,
      channel: t.channel,
    })));

    if (clientRes.data) {
      // Compute honest LTV per client from history + pre-entry baseline.
      // months_in_period = (ended_at_or_now - started_at) / 30.44 days
      const MS_PER_MONTH = 30.44 * 24 * 60 * 60 * 1000;
      const nowMs = Date.now();
      const computeLTV = (clientId, preEntry) => {
        const history = revHistoryByClient[clientId] || [];
        const historyTotal = history.reduce((sum, row) => {
          const startMs = new Date(row.started_at).getTime();
          const endMs = row.ended_at ? new Date(row.ended_at).getTime() : nowMs;
          const months = Math.max(0, (endMs - startMs) / MS_PER_MONTH);
          return sum + (Number(row.monthly_rate) * months);
        }, 0);
        return Number(preEntry || 0) + historyTotal;
      };
      setClients(clientRes.data.map(c => ({
        ...c,
        ret: c.retention_score || 0,
        contact: c.contact || "",
        role: c.role || "",
        // months is now DERIVED from engagement_started_at and pauses.
        // The raw c.months column from the DB is ignored once
        // engagement_started_at is set (the source of truth). Falls
        // back to c.months only if engagement_started_at is missing
        // (shouldn't happen post-migration, but kept as a safety net).
        months: c.engagement_started_at
          ? monthsTogether({ id: c.id, engagement_started_at: c.engagement_started_at }, pausesByClient)
          : (c.months || 0),
        engagement_started_at: c.engagement_started_at || null,
        is_paused: isCurrentlyPaused(c.id, pausesByClient),
        revenue: c.revenue || 0,
        tag: c.tag || "",
        lastHC: c.last_hc_date || null,
        lastContact: c.last_task_date ? "recent" : "—",
        referrals: 0,
        profileScores: c.profile_scores || {},
        qualifyingFlags: c.qualifying_flags || {},
        // Honest LTV: lifetime_revenue_at_entry + sum across history rows.
        // Stored as a number on the client object so synchronous render code
        // (getAdjustedLTV, profile score math) can read it without async hops.
        // Recomputed on every clients hydration — no stale values.
        lifetime_revenue_at_entry: Number(c.lifetime_revenue_at_entry || 0),
        ltv: computeLTV(c.id, c.lifetime_revenue_at_entry),
        // Rai's daily reweighting + reasoning (per-client). Sweep writes raiNudge
        // overnight. Sort comparator reads raiNudge to influence task ordering.
        // raiSignal/raiRationale at client-level are debug fields; the pick badge
        // hover text comes from rai_picks.reason (per-pick), not the client.
        raiNudge: c.rai_nudge != null ? Number(c.rai_nudge) : 0,
        raiSignal: c.rai_signal || null,
        raiRationale: c.rai_rationale || null,
      })));
    }

    if (taskRes.data) {
      // Auto-cleanup at midnight local (the most recent 00:00):
      //   - Recurring tasks completed before cutoff → reset is_done (they reappear fresh)
      //   - Non-recurring tasks completed before cutoff → SOFT-CLEARED via cleared_at
      //     timestamp. Row stays in DB so Rai/detectors can still count historical
      //     task volume, identify client task patterns, etc. Hidden only from the
      //     active Today list.
      //   - Open tasks (not done) → preserved regardless of age (carry forward)
      //
      // Cutoff is today at midnight in the user's STORED timezone
      // (profiles.timezone), NOT the device's wall clock. Pre-fix this used
      // setHours(0,0,0,0), which read the browser's TZ; a stale browser TZ
      // could fire this filter at 22:00 MDT (Eastern's midnight) and reset
      // recurring tasks 2 hours early. We now anchor to the stored TZ and
      // Cutoff for daily rollover. Computed in the user's STORED timezone
      // (profile.timezone) — the single source of truth for all "today /
      // midnight" math across the app. Device timezone is never used here.
      // If two devices are both open, both compute the same cutoff (because
      // both read the same stored value) and Realtime sync coalesces the
      // writes — no rogue-device problem.
      // Day rollover (reset of recurring + soft-clear of completed one-offs)
      // does NOT happen inside loadData anymore. It fires exclusively from
      // the midnight scheduler timeout (see useEffect below). Reasoning:
      // loadData runs on mount, on visibility change, on user re-auth, on
      // realtime sync events, on Settings TZ changes — any of which can
      // happen at any time of day. Coupling the reset to loadData meant
      // the reset could fire multiple times per day with different
      // userTimezone snapshots, leading to the 10pm-MT-and-midnight-MT
      // double-fire we observed. The midnight scheduler is the ONLY place
      // that knows "the day just changed" — so it's the only place that
      // should mutate task state for the rollover.
      const toReset = [];
      const toClear = [];

      // Phase 3 cutover via `today_recurring_display` flag.
      // When on, override done/completed_at on recurring tasks from
      // today's matching task_occurrences row. The occurrence row is
      // the canonical "is this done today" record — tasks.is_done becomes
      // a legacy mirror. One-off tasks unchanged.
      const flagsForToday = profileFlagsRes?.data?.occurrence_flags || {};
      const useOccurrencesForToday = flagsForToday.today_recurring_display === true;
      let occByTaskIdToday = null;
      if (useOccurrencesForToday && occurrencesRes?.data) {
        const userTz = profileFlagsRes?.data?.timezone
          || (await profileDb.get(uid))?.data?.timezone
          || 'UTC';
        const todayInTz = new Intl.DateTimeFormat('en-CA', {
          timeZone: userTz, year: 'numeric', month: '2-digit', day: '2-digit',
        }).format(new Date());
        occByTaskIdToday = {};
        for (const o of occurrencesRes.data) {
          if (o.occurrence_date === todayInTz) {
            occByTaskIdToday[o.task_id] = o;
          }
        }
      }

      // Build local task list excluding cleared IDs and applying recurring resets
      const clearedIds = new Set(toClear.map(t => t.id));
      // Also exclude any task already cleared on a previous load
      const loadedTasks = taskRes.data.filter(t => !clearedIds.has(t.id) && !t.cleared_at).map(t => {
        const reset = toReset.find(r => r.id === t.id);
        // When occurrence flag on, recurring tasks get done/completed_at from
        // today's occurrence row (canonical source). Non-recurring unchanged.
        let doneVal = reset ? false : t.is_done;
        let completedVal = reset ? null : t.completed_at;
        if (occByTaskIdToday && t.is_recurring) {
          const occ = occByTaskIdToday[t.id];
          if (occ) {
            doneVal = occ.is_done;
            completedVal = occ.completed_at;
          } else {
            // No occurrence row for today → task hasn't been materialized
            // yet. Default to not done.
            doneVal = false;
            completedVal = null;
          }
        }
        return {
          id: t.id,
          text: t.text,
          client: t.client_name || "",
          client_id: t.client_id || null,
          notes: t.notes || null,
          done: doneVal,
          completed_at: completedVal,
          alert: t.is_alert,
          recurring: t.is_recurring,
          recurrence_pattern: t.recurrence_pattern || null,
          due_date: t.due_date || null,
          assigned_worker_id: t.assigned_worker_id || null,
          share_client_context: t.share_client_context !== false,
          worker_completed_at: t.worker_completed_at || null,
          sort_order: t.sort_order,
          raiPriority: t.is_rai_priority || false,
          ai: t.is_ai || false,
          rai_suggestion_id: t.rai_suggestion_id || null,
          // Note: Rai's nudge + reasoning lives on the CLIENT, not the task.
          // Sort comparator looks up the client by t.client and reads raiNudge
          // from there. This way new tasks added during the day inherit the
          // client's nudge automatically (sweep ran overnight on the client).
          created_at: t.created_at ? new Date(t.created_at).getTime() : 0,
        };
      });
      // Preserve the optimistic done-state of any task whose toggle is still
      // writing to the DB — otherwise this hydration clobbers it with a stale
      // row and the user's check silently disappears.
      setTasks(prev => {
        if (inFlightToggles.current.size === 0) return loadedTasks;
        const prevById = new Map(prev.map(t => [t.id, t]));
        return loadedTasks.map(t => {
          if (inFlightToggles.current.has(t.id)) {
            const p = prevById.get(t.id);
            if (p) return { ...t, done: p.done, completed_at: p.completed_at };
          }
          return t;
        });
      });
      // Tasks that were already completed before this page load skip the
      // 5-second satisfaction window and go straight into the collapsed log.
      // (User wasn't here to see the celebration — no point preserving it.)
      const preCollapsed = {};
      for (const t of loadedTasks) {
        if (t.done) preCollapsed[t.id] = true;
      }
      setCollapsedDoneIds(preCollapsed);
    }

    if (refRes.data) setRefs(refRes.data.map(r => ({
      id: r.id,
      to: r.referred_to,
      from: r.referred_by,
      date: r.date_added || "",
      converted: r.status === "converted",
      status: r.status,
      revenue: r.revenue || 0,
      totalRevenue: r.total_revenue || 0,
    })));

    if (rolodexRes.data) setRolodex(rolodexRes.data.map(r => ({
      id: r.id,
      client: r.client_name,
      contact: r.contact_name,
      months: r.months || 0,
      type: r.type,
      date: r.date_added || "",
      tags: r.tags || [],
      priority: r.priority,
      reminder: r.reminder_date,
      reminderRecurrence: r.reminder_recurrence || "none",
      work: r.notes,
    })));

    // Load retro answers from rolodex entries
    if (rolodexRes.data) {
      const answers = {};
      rolodexRes.data.forEach(r => {
        if (r.retro_answers && Object.keys(r.retro_answers).length > 0) {
          answers[r.id] = r.retro_answers;
        }
      });
      setRetroAnswers(answers);
    }

    // Load drift status
    if (clientRes.data) {
      const drifts = {};
      clientRes.data.forEach(c => {
        if (c.drift_status) drifts[c.name] = c.drift_status;
      });
      setClientDrift(drifts);
    }

    // Map health checks to queue format
    if (hcRes.data) {
      const completedCounts = hcCountsRes?.data || {};
      setHcQueue(hcRes.data.map(h => {
        const client = h.client;
        const dueDate = h.due_date ? new Date(h.due_date) : null;
        const today = new Date();
        today.setHours(0,0,0,0);
        const overdue = dueDate ? Math.max(0, Math.floor((today - dueDate) / (1000*60*60*24))) : 0;
        const isToday = dueDate && dueDate.toDateString() === today.toDateString();
        const completedForClient = completedCounts[h.client_id] || 0;
        const isFirstHC = completedForClient === 0;
        // Runnable when: overdue, due today, OR this is the client's first HC (Start Early affordance)
        const runnable = overdue > 0 || isToday || isFirstHC;
        const daysUntil = dueDate ? Math.max(0, Math.ceil((dueDate - today) / (1000*60*60*24))) : 0;
        return {
          id: h.id,
          client_id: h.client_id,
          client: client?.name || "Unknown",
          ret: client?.retention_score || 0,
          due: isToday ? "Today" : dueDate ? dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—",
          due_date: dueDate ? dueDate.toISOString() : null,
          overdue: overdue,
          isFirstHC: isFirstHC,
          runnable: runnable,
          daysUntil: daysUntil,
        };
      }));
    }

    if (convoListRes?.data) {
      setRaiConvoList(convoListRes.data);
    }

    // Workers + completion counts arrived in the main parallel batch above.
    // Apply them here synchronously — previously this was an awaited
    // Promise.all that ran AFTER everything else, making Workers the last
    // data to hydrate and the composer worker chip the last UI to populate.
    if (workersRes?.data) setWorkersList(workersRes.data);
    if (workersComplRes?.data) setWorkerCompletions(workersComplRes.data);

    // Phase 3 occurrence-model hydration. Both are no-ops if the flags
    // for any reader are false (default) — state is set but unread.
    if (occurrencesRes?.data) setTaskOccurrences(occurrencesRes.data);
    if (profileFlagsRes?.data?.occurrence_flags) {
      setOccurrenceFlags(profileFlagsRes.data.occurrence_flags || {});
    }

    // Visible-on-load surfaces — calendar widget + sidebar Portfolio.
    // Now in critical path so they hydrate alongside the rest, no pop-in.
    if (personalCalRes?.data) setPersonalEvents(personalCalRes.data);

    // Phase 3 cutover via `sidebar_completed_counts` flag.
    //   - flag ON  → compute counts from task_occurrences (new model)
    //   - flag OFF → tasksDb.getCompletedCounts response (current)
    // We compute the new-model counts inline so we don't need to change
    // db.js or add a second RPC. taskOccurrences is already loaded in
    // the same Promise.all batch above.
    const flagsForCounts = profileFlagsRes?.data?.occurrence_flags || {};
    const useOccurrencesForCounts = flagsForCounts.sidebar_completed_counts === true;
    if (useOccurrencesForCounts && occurrencesRes?.data) {
      const occs = occurrencesRes.data.filter(o => o.is_done && o.completed_at);
      const now = new Date();
      const nowMs = now.getTime();
      const DAY_MS = 24 * 60 * 60 * 1000;
      const todayCutoff = new Date(now); todayCutoff.setHours(0, 0, 0, 0);
      const todayMs = todayCutoff.getTime();
      const weekMs = nowMs - 7 * DAY_MS;
      const monthMs = nowMs - 30 * DAY_MS;
      const yearMs = nowMs - 365 * DAY_MS;
      let today = 0, week = 0, month = 0, year = 0;
      const weekHistory = Array(12).fill(0);
      const monthHistory = Array(12).fill(0);
      const daysWithCompletions = new Set();
      const localDayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      for (const o of occs) {
        const t = new Date(o.completed_at);
        const tMs = t.getTime();
        if (tMs >= yearMs) year++;
        if (tMs >= monthMs) month++;
        if (tMs >= weekMs) week++;
        if (tMs >= todayMs) today++;
        if (tMs >= yearMs) daysWithCompletions.add(localDayKey(t));
        // 12 rolling 7-day buckets
        for (let i = 0; i < 12; i++) {
          const bStart = nowMs - (12 - i) * 7 * DAY_MS;
          const bEnd = bStart + 7 * DAY_MS;
          if (tMs >= bStart && tMs < bEnd) weekHistory[i]++;
          const mbStart = nowMs - (12 - i) * 30 * DAY_MS;
          const mbEnd = mbStart + 30 * DAY_MS;
          if (tMs >= mbStart && tMs < mbEnd) monthHistory[i]++;
        }
      }
      // Streak: walk backwards from today, count consecutive days
      let dayStreak = 0;
      const walker = new Date(now); walker.setHours(0, 0, 0, 0);
      while (daysWithCompletions.has(localDayKey(walker))) {
        dayStreak++;
        walker.setDate(walker.getDate() - 1);
      }
      setTaskCompletedCounts({ today, week, month, year, weekHistory, monthHistory, dayStreak });
    } else if (taskCompletionsRes?.data) {
      setTaskCompletedCounts(taskCompletionsRes.data);
    }

    setDataLoaded(true);

    // ─── Secondary hydration — fire-and-forget AFTER initial render ───
    // Only billing data remains here. It's billing-tab-only — invisible on
    // initial Today landing, so kicking off after the page renders avoids
    // competing with the critical paint for bandwidth.

    // Billing data — only visible on the Billing tab. Three fetches that
    // hydrate independently. Each can render empty on failure (user re-adds).
    if (typeof clientBillingDb?.listAll === "function") {
      clientBillingDb.listAll(uid)
        .then(r => { if (r?.data) setClientBilling(r.data); })
        .catch(e => console.warn("billing items hydrate failed:", e));
    }
    if (typeof clientBillingMonthStatusDb?.listAll === "function") {
      clientBillingMonthStatusDb.listAll(uid)
        .then(r => { if (r?.data) setBillingMonthStatus(r.data); })
        .catch(e => console.warn("billing month status hydrate failed:", e));
    }
    if (typeof clientBillingTermsDb?.listAll === "function") {
      clientBillingTermsDb.listAll(uid)
        .then(r => { if (r?.data) setBillingTerms(r.data); })
        .catch(e => console.warn("billing terms hydrate failed:", e));
    }
    // Ad-hoc revenue (addons) — bulk fetch grouped by client_id.
    // Same lazy timing as billing data: only visible on the Billing
    // tab, so we don't block initial paint with it.
    if (typeof clientAddonsDb?.listAllByClient === "function") {
      clientAddonsDb.listAllByClient(uid)
        .then(r => { if (r?.data) setClientAddons(r.data); })
        .catch(e => console.warn("addons hydrate failed:", e));
    }
  }, [user, userTimezone]);


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

  // ─── Realtime task sync ─────────────────────────────────────
  // Subscribe to all tasks-table changes for this user. Primary use:
  // when a Worker marks a task complete via the magic-link page,
  // the change shows up on the Operator's UI without a refresh.
  // Also catches multi-device edits (open Retayned on phone + laptop).
  useEffect(() => {
    if (!user?.id) return;

    const subscription = realtimeDb.onTaskChange(user.id, (payload) => {
      // payload.eventType: "INSERT" | "UPDATE" | "DELETE"
      // payload.new: the new row (for INSERT/UPDATE)
      // payload.old: the old row (for UPDATE/DELETE)
      const ev = payload.eventType;
      const row = payload.new || payload.old;
      if (!row?.id) return;

      if (ev === "DELETE") {
        setTasks(prev => prev.filter(t => t.id !== row.id));
        return;
      }

      // Map DB row → UI shape (matches the loadData task mapping)
      const mapped = {
        id: row.id,
        text: row.text,
        client: row.client_name || null,
        client_id: row.client_id || null,
        done: !!row.is_done,
        recurring: !!row.is_recurring,
        due_date: row.due_date || null,
        raiPriority: !!row.is_rai_priority,
        alert: false,
        created_at: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
        completed_at: row.completed_at || null,
        cleared_at: row.cleared_at || null,
        assigned_worker_id: row.assigned_worker_id || null,
        share_client_context: row.share_client_context !== false,
        worker_completed_at: row.worker_completed_at || null,
      };

      if (ev === "INSERT") {
        // Track burst timing for the 60s rule (with 5-min cap). When a task
        // is created for any client, record the timestamp so the badge logic
        // knows whether the picked client is in an active "burst" of task
        // creation. Tracker is keyed by client name (matches t.client).
        if (mapped.client) {
          const now = Date.now();
          const tracker = raiBurstTrackerRef.current;
          const existing = tracker[mapped.client];
          tracker[mapped.client] = {
            firstCreatedAt: existing && (now - existing.firstCreatedAt < 5 * 60 * 1000)
              ? existing.firstCreatedAt
              : now,
            lastCreatedAt: now,
          };
        }
        setTasks(prev => {
          // Avoid duplicates if the local insert already added it
          if (prev.some(t => t.id === mapped.id)) return prev;
          return [mapped, ...prev];
        });
      } else if (ev === "UPDATE") {
        // Skip if we're currently mid-toggle for this row. The DB write
        // we just initiated can race with this realtime echo — if the
        // echo arrives with stale data (e.g. mid-replication) it would
        // overwrite our optimistic state, causing the "I checked the
        // task and it un-checked itself a second later" bug. Once the
        // toggle write completes (inFlightToggles.delete fires), any
        // subsequent realtime echo will reflect the post-write state
        // and is safe to apply.
        if (inFlightToggles.current.has(mapped.id)) return;
        setTasks(prev => prev.map(t => {
          if (t.id !== mapped.id) return t;
          // Preserve any local-only fields by spreading mapped over t
          return { ...t, ...mapped };
        }));
        // Refresh completion history if a worker assignment changed
        // and the task just flipped to done — a new task_completions
        // row appears that the Workers page reads. Without this refetch
        // those stats would be stale until full reload.
        if (row.assigned_worker_id && row.is_done) {
          workersDb.getAllCompletions(user.id).then(({ data }) => {
            if (data) setWorkerCompletions(data);
          }).catch(() => {});
        }
      }
    });

    // Subscribe to rai_user_state changes (cross-tab toggle sync).
    // When user flips "Rai Tasks / Off" on phone, this tab updates without refresh.
    const raiStateSubscription = realtimeDb.onRaiUserStateChange(user.id, (payload) => {
      const row = payload.new;
      if (!row) return;
      setRaiState(row);
    });

    // Subscribe to rai_picks changes — when overnight sweep writes a fresh
    // pick, refetch the current row (or null if cleared). Simpler than
    // tracking individual INSERT/UPDATE/DELETE events.
    const raiPickSubscription = realtimeDb.onRaiPickChange(user.id, async () => {
      try {
        const pickRes = await raiPicksDb.getCurrent(user.id, userTimezone || null);
        setRaiPicks(pickRes?.data || null);
      } catch (e) {
        console.warn("Failed to refetch rai pick after change:", e);
      }
    });

    // Subscribe to clients changes — overnight sweep writes nudges to
    // clients.rai_nudge, and we need the sort to update without a refresh.
    // Also handles general client edits (name change, score change, etc.)
    // made from another tab.
    const clientSubscription = realtimeDb.onClientChange(user.id, (payload) => {
      const ev = payload.eventType;
      if (ev === "DELETE") {
        const oldId = payload.old?.id;
        if (oldId) setClients(prev => prev.filter(c => c.id !== oldId));
        return;
      }
      const row = payload.new;
      if (!row?.id) return;
      // Map DB row → UI shape (matches the loadData client mapping)
      const mapped = {
        ...row,
        ret: row.retention_score || 0,
        contact: row.contact || "",
        role: row.role || "",
        months: row.months || 0,
        revenue: row.revenue || 0,
        tag: row.tag || "",
        lastHC: row.last_hc_date || null,
        lastContact: row.last_task_date ? "recent" : "—",
        referrals: 0,
        profileScores: row.profile_scores || {},
        qualifyingFlags: row.qualifying_flags || {},
        raiNudge: row.rai_nudge != null ? Number(row.rai_nudge) : 0,
        raiSignal: row.rai_signal || null,
        raiRationale: row.rai_rationale || null,
      };
      if (ev === "INSERT") {
        setClients(prev => prev.some(c => c.id === mapped.id) ? prev : [...prev, mapped]);
      } else if (ev === "UPDATE") {
        setClients(prev => prev.map(c => c.id === mapped.id ? { ...c, ...mapped } : c));
      }
    });

    return () => {
      // Cleanup on unmount or user change
      try { subscription?.unsubscribe?.(); } catch {}
      try { raiStateSubscription?.unsubscribe?.(); } catch {}
      try { raiPickSubscription?.unsubscribe?.(); } catch {}
      try { clientSubscription?.unsubscribe?.(); } catch {}
    };
  }, [user?.id]);

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
  const [clientDrift, setClientDrift] = useState({});
  const [showUpcoming, setShowUpcoming] = useState(false);

  // Referrals
  const [refs, setRefs] = useState([]);
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
  const [raiConvoList, setRaiConvoList] = useState([]);
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
    if (id === "retros") {
      setRolodexRemindersSeen(true);
      try { window.localStorage.setItem(_rolodexSeenDayKey, _todayLocalYmd()); } catch (_) { /* unavailable */ }
    }
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
  const allPages = [...(tier === "enterprise" ? navItemsEnterprise : navItemsCore), ...(tier === "enterprise" ? moreItemsEnterprise : moreItemsCore)];
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
  const rolodexDot = rolodexHasDueReminder && !rolodexRemindersSeen && page !== "retros";
  const hasDot = (id) => (id === "today" && todayDot) || (id === "health" && healthDot) || (id === "retros" && rolodexDot);

  // All state/handlers the extracted page components read. Rebuilt each
  // render — same freshness semantics as the original inline JSX.
  const pageCtx = {
    addRef,
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
    tier,
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
      <style>{`
        ${THEME_CSS}

        /* ═══════════════════════════════════════════════════════════════
           TODAY-PAGE REDESIGN (Jun 6 2026 — Adam direction)
           ───────────────────────────────────────────────────────────────
           MIGRATED Jun 7 2026: this block originally lived under
           body.rt-today-redesign so it only applied to the Today page.
           After Today landed, Adam migrated everything sitewide — the
           cool palette + sidebar + composer greening + FAB greening +
           dial greening are now the DEFAULT app state, not a scoped
           override. Most palette redirects moved to :root above. The
           rules below are the non-variable styling (sidebar geometry,
           component recoloring) that needed to land as global defaults.

           Changes baked in:
           1. Sidebar → primaryDeep green, flush-left, no card chrome
           2. Logo → white
           3. Nav items recolored for dark bg
           4. Page bg → #FAFBFA (via --rt-bg, set on :root)
           5. Cards/tiles stay white
           6. Link color (was purple) → primaryDeep with dotted underline
           7. + buttons (composer plus, FAB) → green
           8. Composer Add button → green when triggered
           9. Dial now-dot → forest green (was purple)
           ═══════════════════════════════════════════════════════════════ */

        body {
          background: #FAFBFA !important;
        }
        /* Content scroll container — force same bg as body so the
           area right of the sidebar reads as a single continuous surface. */
        .r-main {
          background: #FAFBFA !important;
        }
        /* Kill the legacy paper-grain dots on body. */
        body {
          background-image: none !important;
        }

        /* Kill the V1_GRAD warm rainbow gradients used on the calendar
           strip and other places — they bake the old cream into hardcoded
           strings, so the variable redirect can't reach them. Flat them
           to canvas instead. */
        [style*="V1_GRAD"],
        [style*="rgba(124,92,243,0.10) 0%"],
        [style*="#FAFAF7"] {
          background: #FAFBFA !important;
          background-image: none !important;
        }

        /* Today canvas backdrop — Variant A border-cool-strong wash.
           A soft cool-grey zone behind the task list. Top stop at 0.32. */
        .rt-today-canvas {
          background: linear-gradient(180deg, rgba(220,224,220,0.32), rgba(220,224,220,0.02)) !important;
          background-image: linear-gradient(180deg, rgba(220,224,220,0.32), rgba(220,224,220,0.02)) !important;
        }

        /* Sidebar — flush left, primaryDeep green, no float chrome.
           Uses primaryDeep (#1C3224), the darkest stop. html prefix outranks
           inline styles on the .r-desk element. */
        html .r-desk,
        html div.r-desk {
          background: #1C3224 !important;
          background-image: none !important;
          top: 0 !important;
          left: 0 !important;
          bottom: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          width: 240px !important;
        }
        html .r-desk.is-collapsed,
        html div.r-desk.is-collapsed {
          width: 64px !important;
        }

        /* Logo color is set further down (warm cream override) */

        /* Nav items — readable on dark green. Hover/active states lift the
           dark green toward primary (lighter same-family) instead of
           layering white. Pure white at any opacity reads as grey-cool on
           dark green and introduces a foreign hue. Lifting within the
           green family keeps the hover looking like "this row got more
           illuminated" rather than "a grey film was laid on top."

           html prefix on all rules — there are conflicting global
           .nav-item rules later in the stylesheet (set white card bg on
           hover, designed for old cream sidebar). Equal-specificity later
           rules would override. html prefix bumps these rules to a
           higher specificity (0,2,1 vs 0,2,0) so they win unconditionally. */
        html .r-desk .nav-item {
          color: rgba(255,255,255,0.78) !important;
          background: transparent !important;
          background-image: none !important;
        }
        html .r-desk .nav-item:hover,
        html .r-desk .nav-item:hover:not(.is-active) {
          background: rgba(80, 130, 95, 0.18) !important;
          background-image: none !important;
          color: #FFFFFF !important;
          box-shadow: none !important;
        }
        /* Active state: the inline JSX sets a white→cream embossed gradient
           with stacked inset shadows + translateY. That treatment was right
           for a cream sidebar but reads as a kid-UI white chip on the dark
           green. Kill the gradient + shadows; lift the row in-family. */
        html .r-desk .nav-item.is-active {
          background: rgba(255, 255, 255, 0.06) !important;
          background-image: none !important;
          color: #FFFFFF !important;
          box-shadow: none !important;
          transform: none !important;
        }
        /* Active text + icon — JSX inlined C.primaryDeep (same as sidebar
           bg) so they vanish on the green tint. Force white. */
        html .r-desk .nav-item.is-active span {
          color: #FFFFFF !important;
        }
        html .r-desk .nav-item.is-active svg,
        html .r-desk .nav-item.is-active svg * {
          stroke: #FFFFFF !important;
          color: #FFFFFF !important;
          stroke-width: 2.15 !important;
        }
        /* Hovered nav-item svg — brighter than rest (78%) but NOT full
           white, so hover stays visibly distinct from the active state
           (which is pure white). Without this, hover and active icons
           looked identical even though the row background differed. */
        html .r-desk .nav-item:hover:not(.is-active) svg,
        html .r-desk .nav-item:hover:not(.is-active) svg * {
          color: rgba(255,255,255,0.88) !important;
          stroke: rgba(255,255,255,0.88) !important;
        }
        .r-desk .nav-item svg {
          stroke: currentColor !important;
        }

        /* Stamp/Caveat text — slightly muted on dark */
        .r-desk .caveat,
        .r-desk [style*="Caveat"] {
          color: rgba(255,255,255,0.55) !important;
        }

        /* User chip + divider lines inside sidebar */
        .r-desk .rt-user-chip {
          color: rgba(255,255,255,0.88) !important;
        }
        .r-desk hr,
        .r-desk [style*="border-top"] {
          border-color: rgba(255,255,255,0.08) !important;
        }

        /* Toggle button between sidebar and content — restyle for dark */
        .rt-sidebar-toggle {
          background: #33543E !important;
          color: #FFFFFF !important;
          border: 1px solid rgba(255,255,255,0.12) !important;
          box-shadow: 0 1px 4px rgba(20,30,22,0.18) !important;
        }

        /* Main content shift — sidebar is now flush-left (no 14px inset)
           so the main content's left padding should account for new width */
        .r-mainwrap {
          padding-left: 0 !important;
        }

        /* Link color — was purple (#7c5cf3). Now primary forest green
           with dotted underline. Lighter than primaryDeep — reads warmer. */
        .rt-purple-link {
          color: #33543E !important;
          text-decoration-color: #33543E !important;
        }
        @media (hover: hover) {
          .rt-purple-link:hover {
            color: #2D4A37 !important;
            text-decoration-color: #2D4A37 !important;
            text-decoration-style: solid !important;
          }
        }

        /* Client-name link color in the daily brief (.rt-today-lede a). */
        .rt-today-lede a,
        .rt-today-lede a:visited {
          color: #33543E !important;
          text-decoration-color: rgba(51,84,62,0.5) !important;
        }

        /* Composer plus button → primarySoft locked as default. No
           separate hover treatment — the soft green stays regardless. */
        /* .rt-composer-plus green !important overrides REMOVED (June 2026).
           The puck is now the Brain Dump button and styles itself inline —
           purple silhouette with white fissure strokes. The old force-fill
           turned the brain into a solid green blob. */

        /* Composer Add button — green when armed (button only shows the
           gradient when newTask.trim() is truthy; we override that armed
           state to forest green). */
        .rt-add-task-btn:not(:disabled) {
          background: #33543E !important;
          background-image: none !important;
          color: #FFFFFF !important;
          box-shadow: 0 1px 2px rgba(20,30,22,0.10), 0 2px 6px rgba(51,84,62,0.25) !important;
        }
        .rt-add-task-btn:not(:disabled):hover {
          background: #2D4A37 !important;
        }
        /* Disabled / rest state — was cream (C.surfaceWarm).
           Now hoverSurface #F4F6F4 with textMuted text. */
        .rt-add-task-btn:disabled,
        .rt-add-task-btn[disabled] {
          background: #F4F6F4 !important;
          background-image: none !important;
          color: #9A9A93 !important;
          box-shadow: none !important;
        }

        /* Dial now-marker — was purple; switch to forest green */
        .rt-dial-now-dot,
        .rt-dial-now circle {
          fill: #33543E !important;
        }
        .rt-dial-now-ring {
          stroke: #33543E !important;
        }

        /* Floating quick-log FAB (bottom-right) — was purple gradient.
           Override to forest green globally. */
        .rt-quicklog-fab {
          background: #33543E !important;
          background-image: none !important;
          box-shadow: 0 1px 2px rgba(20,30,22,0.10), 0 6px 20px rgba(51,84,62,0.30) !important;
        }
        .rt-quicklog-fab:hover {
          background: #274230 !important;
        }

        /* ── BRAND LOGO COLOR ───────────────────────────────────────────
           Pure white #FFFFFF — what the major B2B SaaS brands do on dark
           sidebars (Notion, Linear, Vercel, Stripe Dashboard). Maximum
           legibility, brand-agnostic, no second-guessing. */
        .r-desk > div:first-child span {
          color: #FFFFFF !important;
        }

        /* ── NAV DOT BULLSEYE FIX ──────────────────────────────────────
           hasDot() rendered the red unread indicator with a solid white
           ring (boxShadow: 0 0 0 2.5px C.card) so it would stand out from
           the sidebar's cream background. Now that the sidebar is dark
           green, a solid white ring around a red dot reads as kid-UI
           bullseye. Subtler ring via inset rgba — adds a tiny crisp
           separation against the active row's background without screaming. */
        .r-desk .nav-item > div[style*="border-radius: 50%"][style*="background"] {
          box-shadow: 0 0 0 1.5px rgba(0,0,0,0.18) !important;
        }

        /* ── DONE / PORTFOLIO WIDGET — DARK MODE TEXT ──────────────────
           Widget uses C.text / C.textSec / C.primaryDeep / C.border which
           all read as dark ink on light. On the dark sidebar everything
           goes invisible. Class-scoped overrides for reliability. The
           bucket count colors (retElite green, retGood softer green,
           retWarn yellow) pop fine on dark — preserved. */
        .rt-sidebar-widget {
          background: transparent !important;
          box-shadow: none !important;
          border-top: 1px solid rgba(255,255,255,0.08) !important;
          border-radius: 0 !important;
        }
        /* All text inside the widget gets lifted to light by default. Then
           specific bucket count digits get re-colored by inline style which
           outranks this. */
        .rt-sidebar-widget,
        .rt-sidebar-widget * {
          color: rgba(255,255,255,0.55) !important;
        }
        /* Big "108" number + active period selector — brighter than rest */
        .rt-sidebar-widget > div:first-child > div:nth-child(3) > div:first-child {
          color: rgba(255,255,255,0.92) !important;
        }
        /* MRR dollar figure — same brightness as the tasks number (the
           positional selector above only catches the tasks number's DOM
           slot, so the MRR figure is whitened by class instead). */
        .rt-sidebar-widget .rt-widget-mrr {
          color: rgba(255,255,255,0.92) !important;
        }
        /* Borders / dividers — soft on dark */
        .rt-sidebar-widget > div:first-child {
          border-bottom-color: rgba(255,255,255,0.08) !important;
        }
        /* Active period selector underline */
        .rt-sidebar-widget div[style*="border-bottom: 1px"] {
          border-bottom-color: rgba(255,255,255,0.55) !important;
        }
        /* Squiggle SVG underline — was C.primaryDeep (same as sidebar bg) */
        .rt-sidebar-widget svg path {
          stroke: rgba(111,191,142,0.55) !important;
        }
        /* Bucket count NUMBERS — restored to the real retention palette,
           brightened so each hue reads on the dark green sidebar. Keeps the
           green → gold → red meaning consistent with the rest of the app
           instead of a foreign monochrome grey ramp. */
        .rt-sidebar-widget [style*="color: rgb(12, 58, 46)"],
        .rt-sidebar-widget [style*="color: #0C3A2E"] {
          color: #6FBF8E !important; /* Thriving */
        }
        .rt-sidebar-widget [style*="color: rgb(31, 122, 92)"],
        .rt-sidebar-widget [style*="color: #1F7A5C"] {
          color: #4FB389 !important; /* Healthy */
        }
        .rt-sidebar-widget [style*="color: rgb(168, 164, 32)"],
        .rt-sidebar-widget [style*="color: #A8A420"] {
          color: #D4C84A !important; /* Watch */
        }
        .rt-sidebar-widget [style*="color: rgb(209, 122, 27)"],
        .rt-sidebar-widget [style*="color: #D17A1B"] {
          color: #E89B47 !important; /* At-risk */
        }
        .rt-sidebar-widget [style*="color: rgb(180, 52, 31)"],
        .rt-sidebar-widget [style*="color: #B4341F"] {
          color: #E0654A !important; /* Critical */
        }
        .r-desk-bucket-dark-fix {}  /* anchor */
        /* Stacked bucket bar — same brightened retention ramp as the numbers. */
        .rt-sidebar-widget [style*="background: rgb(12, 58, 46)"],
        .rt-sidebar-widget [style*="background: #0C3A2E"],
        .rt-sidebar-widget [style*="background:#0C3A2E"] {
          background: #6FBF8E !important; /* Thriving */
        }
        .rt-sidebar-widget [style*="background: rgb(31, 122, 92)"],
        .rt-sidebar-widget [style*="background: #1F7A5C"],
        .rt-sidebar-widget [style*="background:#1F7A5C"] {
          background: #4FB389 !important; /* Healthy */
        }
        .rt-sidebar-widget [style*="background: rgb(168, 164, 32)"],
        .rt-sidebar-widget [style*="background: #A8A420"],
        .rt-sidebar-widget [style*="background:#A8A420"] {
          background: #D4C84A !important; /* Watch */
        }
        .rt-sidebar-widget [style*="background: rgb(209, 122, 27)"],
        .rt-sidebar-widget [style*="background: #D17A1B"],
        .rt-sidebar-widget [style*="background:#D17A1B"] {
          background: #E89B47 !important; /* At-risk */
        }
        .rt-sidebar-widget [style*="background: rgb(180, 52, 31)"],
        .rt-sidebar-widget [style*="background: #B4341F"],
        .rt-sidebar-widget [style*="background:#B4341F"] {
          background: #E0654A !important; /* Critical */
        }

        /* ── PERIOD SELECTOR (Week / Month / Year) — SIDEBAR DARK MODE ─
           Base CSS sets hover to var(--rt-text) (near-black ink) which
           is invisible on the dark sidebar. Override here with a sage
           tint — same brand family as the nav hover state, just text
           only (no background fill, the period selectors are inline
           text toggles not chip rows).

           Active state: brighter sage + sage underline. Affordance
           escalates from hover (soft sage at 40% underline) to active
           (sharper sage at full underline). Active has no className
           in JSX (only inactive items get .r-period-opt), so we target
           via the inline border-bottom signature with the primary-green
           color — uniquely identifies the active period row. */
        html .r-desk .rt-sidebar-widget .r-period-opt:hover {
          color: #A8C4B5 !important;
          border-bottom-color: rgba(168,196,181,0.40) !important;
        }
        html .r-desk .rt-sidebar-widget div[style*="border-bottom: 1px solid rgb(51, 84, 62)"],
        html .r-desk .rt-sidebar-widget div[style*="border-bottom:1px solid rgb(51, 84, 62)"],
        html .r-desk .rt-sidebar-widget div[style*="border-bottom: 1px solid #33543E"] {
          color: #C8DCD0 !important;
          border-bottom-color: #C8DCD0 !important;
        }

        /* ── PROFILE CHIP (A circle + name + company) ──────────────────
           Avatar: C.primarySoft (#E6EFE9) — pale on dark = wafer.
           Name: C.text (#1E261F) — invisible on dark.
           Company: C.textSec — invisible.
           Make avatar a subtle white-on-dark chip, text light. */
        .rt-user-chip > div:first-child {
          background: rgba(255,255,255,0.10) !important;
          color: #FFFFFF !important;
        }
        .rt-user-chip > div:nth-child(2) > div:first-child {
          color: rgba(255,255,255,0.88) !important;
        }
        .rt-user-chip > div:nth-child(2) > div:nth-child(2) {
          color: rgba(255,255,255,0.55) !important;
        }
        .rt-user-chip:hover {
          background: rgba(255,255,255,0.05) !important;
        }

        /* ═══════════════════════════════════════════════════════════════
           END SITEWIDE MIGRATION
           ═══════════════════════════════════════════════════════════════ */

        /* ── RAI CHAT — HIDE SCROLLBAR ─────────────────────────────────
           The internal scrollbar on .r-rai-scroll clashes visually with
           the rounded card chrome / page border. Keep scroll functional,
           hide the visible scrollbar across all browsers. */
        .r-rai-scroll {
          scrollbar-width: none !important;          /* Firefox */
          -ms-overflow-style: none !important;       /* IE / old Edge */
        }
        .r-rai-scroll::-webkit-scrollbar {
          display: none !important;                  /* Chrome / Safari / Edge */
          width: 0 !important;
          height: 0 !important;
        }

        /* ── RAI SIDEBAR CONVO LIST — HIDE SCROLLBAR ───────────────────
           Same treatment as the chat container — the past-chats list
           inside the sidebar gets a scrollbar that visually clashes
           with the dark green chrome. */
        .r-rai-sidebar-list {
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }
        .r-rai-sidebar-list::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }

        /* ── RAI SIDEBAR — NEW CHAT BUTTON ─────────────────────────────
           Inline JSX uses var(--rt-grad-btn) (purple gradient) + purple
           shadow. That gradient was right for the old cream sidebar but
           reads as loud / AI-generated against the dark green. Override
           to coherent sidebar treatment — primary-tinted ghost button
           with hover state matching nav rows. */
        html .r-desk .rt-rai-pop-btn {
          background: transparent !important;
          background-image: none !important;
          color: rgba(255,255,255,0.78) !important;
          box-shadow: none !important;
          border: none !important;
        }
        html .r-desk .rt-rai-pop-btn:hover {
          background: rgba(80, 130, 95, 0.18) !important;
          background-image: none !important;
          color: #FFFFFF !important;
          box-shadow: none !important;
          transform: none !important;
        }
        html .r-desk .rt-rai-pop-btn:active {
          background: rgba(80, 130, 95, 0.24) !important;
          transform: none !important;
        }
        html .r-desk .rt-rai-pop-btn svg,
        html .r-desk .rt-rai-pop-btn svg * {
          stroke: currentColor !important;
          color: currentColor !important;
        }

        /* ── RAI SIDEBAR — CONVO ROW STATES ───────────────────────────
           Mirrors the main nav rows exactly:
             rest   → transparent, 65% white text
             hover  → green-tint, white text
             active → white-tint pill (rgba 255 .06), white text, 600
           Active bg + color come from the inline JSX; these rules set
           the rest/hover text and kill any leftover shadow. */
        html .r-desk .r-convo-row {
          box-shadow: none !important;
        }
        html body .r-desk .r-convo-row:not(:hover):not(.is-active),
        html body .r-desk .r-convo-row:not(:hover):not(.is-active) span {
          color: rgba(255,255,255,0.65) !important;
        }
        html body .r-desk .r-convo-row.is-active,
        html body .r-desk .r-convo-row.is-active span {
          color: #FFFFFF !important;
        }
        html body .r-desk .r-convo-row:hover {
          background: rgba(80, 130, 95, 0.18) !important;
          box-shadow: none !important;
        }
        html body .r-desk .r-convo-row:hover,
        html body .r-desk .r-convo-row:hover span {
          color: #FFFFFF !important;
        }

        /* Section labels (Starred / Recent) above convo lists — JSX sets
           color: C.textSec which is dark ink, invisible on dark sidebar. */
        .r-rai-sidebar-list > div[style*="text-transform: uppercase"],
        .r-rai-sidebar-list > div[style*="textTransform: uppercase"] {
          color: rgba(255,255,255,0.45) !important;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        /* Paper grain — barely-perceptible noise texture on the cream
           substrate. Eight 1px radial dots tiled at 220px gives the
           background warmth and depth without being legible up close.
           Coated paper feel vs flat SaaS cream. Tile size deliberately
           prime-adjacent so the pattern doesn't visibly repeat. */
        html, body {
          background:
            radial-gradient(ellipse 1px 1px at 13% 27%, rgba(20,30,22,0.04) 50%, transparent 50%),
            radial-gradient(ellipse 1px 1px at 42% 71%, rgba(20,30,22,0.03) 50%, transparent 50%),
            radial-gradient(ellipse 1px 1px at 78% 13%, rgba(20,30,22,0.04) 50%, transparent 50%),
            radial-gradient(ellipse 1px 1px at 89% 89%, rgba(20,30,22,0.025) 50%, transparent 50%),
            radial-gradient(ellipse 1px 1px at 33% 91%, rgba(20,30,22,0.035) 50%, transparent 50%),
            radial-gradient(ellipse 1px 1px at 64% 33%, rgba(20,30,22,0.03) 50%, transparent 50%),
            radial-gradient(ellipse 1px 1px at 24% 53%, rgba(20,30,22,0.04) 50%, transparent 50%),
            radial-gradient(ellipse 1px 1px at 71% 64%, rgba(20,30,22,0.035) 50%, transparent 50%),
            var(--rt-bg);
          background-size: 220px 220px;
          overscroll-behavior: none;
        }
        input, textarea, select { font-size: 16px !important; }
        @media (min-width: 768px) { input, textarea, select { font-size: 14px !important; } }
        /* Rai chat inputs (both surfaces — the welcome-screen composer and
           the in-conversation "Reply to Rai" bar) opt out of the global
           14px desktop input override. The global rule exists to prevent
           iOS zoom-on-focus (which needs 16px+ on mobile) and to keep
           dense forms tight on desktop; but the Rai surface is a writing
           surface, not a form field — it should read at the same comfort
           as a chat message, not a filter input. Selector specificity
           (.r-rai-page descendant) beats the bare textarea selector
           even with the !important on it, so this rule wins on desktop. */
        @media (min-width: 768px) {
          .r-rai-page textarea { font-size: 16px !important; }
        }
        ::selection { background: #33543E; color: #fff; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: var(--rt-border); border-radius: 2px; }
        /* ── NAV ITEM ICON COLOR STATES ───────────────────────────────
           Three-state flow controlled via CSS custom properties on the
           parent .nav-item / .nav-item-mobile, picked up by the SVG
           paths inside via var(--icon-body) / var(--icon-accent).
             rest      → warm gray (textMuted), feels quiet
             hover     → sage (primaryMuted), brand color previewing
             active    → full green (primaryLight), brand color committed
           The :hover override only fires on devices that actually
           hover (hover: hover) so mobile gets a clean 2-state flow:
           gray at rest, full green when active. */
        .nav-item, .nav-item-mobile {
          --icon-body: #9A9A93;
          --icon-accent: #6B6B66;
        }
        /* Mobile nav: kill the OS tap-highlight flash. Without this, a tap
           fires TWO visual changes — the browser's grey tap overlay, then
           our is-active transition — which reads as a janky double color
           change. Suppressing the native highlight leaves only the single,
           smooth is-active background+shadow transition, matching desktop. */
        .nav-item-mobile {
          -webkit-tap-highlight-color: transparent;
          -webkit-touch-callout: none;
          user-select: none;
          -webkit-user-select: none;
        }
        .nav-item-mobile:active { background: transparent; }
        .nav-item-mobile.is-active:active { background: var(--rt-card, #fff); }
        @media (hover: hover) {
          .nav-item:hover:not(.is-active),
          .nav-item-mobile:hover:not(.is-active) {
            --icon-body: #8FA597;
            --icon-accent: #4D5C50;
          }
        }
        .nav-item.is-active,
        .nav-item-mobile.is-active {
          --icon-body: #558B68;
          --icon-accent: #2F2F31;
        }
        .nav-item { transition: all 180ms var(--rt-ease-out); cursor: pointer; }
        /* Hover on inactive items lifts to deepCream + darkens text/icon.
           Light-substrate sidebar (post-revert): the hover layer is a
           shade darker than the substrate (substrate F2EEE8, hover EAE4D6).
           The active state uses the same deepCream fill — distinguished
           by inset shadow + bold weight, matching the Linear/Notion
           sidebar convention. */
        /* Nav-item hover previews the active state at lower amplitude.
           Idle (transparent) → Hover (white card + xs shadow) →
           Active (white card + card-lift + 0.5px translate). Click
           is always a clear upgrade. Going to deepCream on hover
           inverted that — darker on hover, lighter on click — which
           read as confused. */
        .nav-item:hover:not(.is-active) {
          background: var(--rt-card) !important;
          box-shadow: var(--rt-sh-xs) !important;
          color: var(--rt-text) !important;
        }
        .nav-item:hover:not(.is-active) svg { color: var(--rt-text) !important; }
        .nav-item:active:not(.is-active) { transform: scale(0.98); }
        /* User chip rests transparent (matches sidebar bg). Hover adds a
           subtle surface wash + soft shadow + 1px lift — same logical
           progression as nav: never darken, only lift, but kept light
           because we're inside the sidebar's substrate. */
        .rt-user-chip:hover {
          background: rgba(255,255,255,0.05) !important;
          box-shadow: none !important;
          transform: none !important;
        }

        /* Slideover topbar nav buttons (↑↓) — subtle surface wash and
           darker color on hover. No transform — hover stays light. */
        .rt-so-nav:not(:disabled):hover {
          background: var(--rt-surface) !important;
          color: var(--rt-text) !important;
        }
        .rt-so-nav .rt-so-preview {
          position: absolute;
          top: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%);
          background: var(--rt-text);
          color: #fff;
          padding: 6px 9px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 500;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: opacity 140ms var(--rt-ease-out);
          display: inline-flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 4px 12px rgba(20,30,22,0.18);
          z-index: 10;
        }
        .rt-so-nav .rt-so-preview::before {
          content: "";
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 4px solid transparent;
          border-bottom-color: var(--rt-text);
        }
        .rt-so-nav:not(:disabled):hover .rt-so-preview {
          opacity: 1;
        }
        .rt-so-nav .rt-so-preview .rt-so-preview-kicker {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.6px;
          text-transform: uppercase;
          opacity: 0.7;
        }

        /* Sidebar collapse toggle — floating disc that straddles the
           sidebar's right edge, vertically aligned with the brand mark.
           Variant C from the wide options mock.

           Sizing: 22×22 — large enough to read as an intentional control,
           small enough not to compete with the brand mark or nav items.

           Weight (Retayned tokens):
             — background: var(--rt-card) (white, contrasts with cream sidebar)
             — shadow: stacked rt-sh-xs + 1px hairline outline at 6% black
               (gives lift without the "stranded chip" feel of heavy shadows)
             — color: text-muted at rest, text on hover (mirrors the
               rest→hover color shift the nav items use)

           Position: fixed against the viewport, left computed from
           --sidebar-w so the disc tracks the sidebar's right edge
           through the collapse/expand transition. top: 36px centers the
           disc on the brand mark (14px sidebar offset + 22px brand
           padding-top + 11px to the brand text vertical center, minus
           11px to center the 22px disc → 36px). */
        .rt-sidebar-toggle {
          display: none;
        }
        @media (min-width: 768px) {
          .rt-sidebar-toggle {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            position: fixed;
            left: calc(var(--sidebar-w, 240px) + 14px - 11px);
            top: 36px;
            width: 22px;
            height: 22px;
            border-radius: 50%;
            background: var(--rt-card);
            color: var(--rt-text-muted);
            border: none;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
            line-height: 1;
            padding: 0;
            font-family: inherit;
            /* Stacked: tiny drop + hairline outline. Together they give
               just enough definition for the disc to read as a touchable
               element without the "floating chip" effect. */
            box-shadow:
              0 1px 2px rgba(20, 30, 22, 0.05),
              0 2px 6px rgba(20, 30, 22, 0.04),
              0 0 0 1px rgba(20, 30, 22, 0.06);
            z-index: 51;
            transition: left 220ms var(--rt-ease-out),
                        color 160ms var(--rt-ease-out),
                        box-shadow 200ms var(--rt-ease-out),
                        transform 180ms var(--rt-ease-out);
          }
          .rt-sidebar-toggle:hover {
            color: var(--rt-text);
            box-shadow:
              0 1px 2px rgba(20, 30, 22, 0.06),
              0 3px 10px rgba(20, 30, 22, 0.08),
              0 0 0 1px rgba(20, 30, 22, 0.10);
            transform: scale(1.06);
          }
          .rt-sidebar-toggle:active {
            transform: scale(0.94);
            transition: transform 80ms var(--rt-ease-press);
          }
        }
        .rt-user-chip:active {
          transform: translateY(0) scale(0.99);
          transition: transform 80ms var(--rt-ease-press);
        }
        .r-period-opt {
          color: var(--rt-text-sec);
          border-bottom: 1px solid transparent;
          transition: color 180ms var(--rt-ease-out), border-color 180ms var(--rt-ease-out);
        }
        @media (hover: hover) {
          .r-period-opt:hover {
            color: var(--rt-text);
            border-bottom-color: rgba(28,50,36,0.20);
          }
        }
        /* ─── TODAY PAGE HOVERS ───
           All scoped to (hover: hover) so touch devices don't get stuck states.
           Inactive variants use :not(.is-active) for segmented toggles. */

        /* Inline links — Magic Scoop client name, Connect Google
           Calendar. Hover signal: color darkens + dotted underline goes
           to solid. Font-weight stays at 600 at rest AND hover so the
           box geometry never shifts — hovering can't push neighboring
           text or change the link's footprint.

           Uses primary green (#33543E) — was originally C.btn (purple).
           Migrated sitewide so all dotted-underlined links and client
           names match the brand palette. Hover deepens to primaryDark.

           Uses text-decoration (not border-bottom) so the underline
           survives when the consuming element has an inline border:none
           reset on it (which buttons do, to kill the native button
           outline). A border-bottom-based version got wiped out by
           those resets — Connect Google Calendar rendered with no
           underline at all. */
        .rt-purple-link {
          color: #33543E;
          font-weight: 600;
          text-decoration: underline;
          text-decoration-style: dotted;
          text-decoration-color: #33543E;
          text-decoration-thickness: 1px;
          text-underline-offset: 3px;
          transition: color 0.12s, text-decoration-style 0.12s, text-decoration-color 0.12s;
        }
        @media (hover: hover) {
          .rt-purple-link:hover {
            color: #2D4A37;
            text-decoration-style: solid;
            text-decoration-color: #2D4A37;
          }
        }

        /* Dot-bullet separator — replaces the · character which has
           inconsistent vertical alignment and weight across fonts. A
           real 4×4px circular div sits perfectly centered between
           adjacent text and renders identically across all browsers.
           Used in meta rows across pages (X referrals · Y conv · etc). */
        .rt-sep {
          display: inline-block;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--rt-border);
          margin: 0 2px;
          vertical-align: middle;
          flex-shrink: 0;
        }

        /* Quiet dismiss links — "Not now". Muted → textSec on hover.
           Deliberately understated so it doesn't compete with the primary
           action next to it. */
        .rt-quiet-link {
          color: var(--rt-text-muted);
          transition: color 0.12s;
        }
        @media (hover: hover) {
          .rt-quiet-link:hover { color: var(--rt-text-sec); }
        }

        /* ── UNIFIED PICKER SURFACE — Client / Worker / Due dropdowns.
           These three composer pickers were built at different times
           and had drifted: three different border-radii, three different
           paddings, three different shadow languages. This unifies them
           to one panel + one item treatment that matches Retayned's
           --rt-sh-card stacked-shadow language (just stronger, because
           a picker overlays content and needs more elevation than a
           card at rest). */
        .rt-picker-panel {
          background: var(--rt-card);
          border-radius: 12px;
          padding: 6px;
          box-shadow:
            0 0 0 1px rgba(20, 30, 22, 0.08),
            0 2px 6px rgba(20, 30, 22, 0.08),
            0 12px 32px rgba(20, 30, 22, 0.16);
        }
        /* Due picker — base (desktop) positioning. Anchored absolutely
           to the chip wrapper (position:relative parent), opening
           below the chip with a 6px gap, flush to the chip's left
           edge. CSS owns positioning so mobile media queries can
           override without losing to React inline-style specificity
           (inline always wins against !important CSS). */
        .rt-due-picker {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
        }
        .rt-picker-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border-radius: 6px;
          border: none;
          background: transparent;
          cursor: pointer;
          font-family: inherit;
          text-align: left;
          color: var(--rt-text);
          font-size: 13px;
          width: 100%;
          transition: background 120ms var(--rt-ease-out),
                      color 120ms var(--rt-ease-out);
        }
        .rt-picker-item:hover,
        .rt-picker-item.is-highlight {
          background: rgba(20, 30, 22, 0.04);
        }
        .rt-picker-item.is-active {
          background: rgba(20, 30, 22, 0.04);
        }
        .rt-picker-divider {
          height: 1px;
          background: var(--rt-border-light);
          margin: 4px 6px;
        }

        /* Today/Tomorrow timeline toggle — text-only hover (no fill), so
           hovering an inactive option doesn't create a "second oval" next
           to the active one. Press-state scale gives tactile feedback so
           toggles feel as responsive to clicks as the Focus button. */
        .rt-day-opt {
          background: transparent;
          color: var(--rt-text-muted);
          box-shadow: none;
          transition: color 180ms var(--rt-ease-out), transform 200ms var(--rt-ease-out);
        }
        @media (hover: hover) {
          .rt-day-opt:hover:not(.is-active) {
            color: var(--rt-text);
          }
        }
        .rt-day-opt:active:not(.is-active) {
          transform: scale(0.96);
          transition: transform 80ms var(--rt-ease-press);
        }

        /* Ranked by Rai / Manual toggle — same text-only hover + press
           scale. Active state styling is set inline (gradient for Rai mode,
           white card for Manual). */
        .rt-rank-opt {
          background: transparent;
          color: var(--rt-text-sec);
          box-shadow: none;
          transition: color 180ms var(--rt-ease-out), transform 200ms var(--rt-ease-out);
        }
        @media (hover: hover) {
          .rt-rank-opt:hover:not(.is-active) {
            color: var(--rt-text);
          }
        }
        .rt-rank-opt:active:not(.is-active) {
          transform: scale(0.96);
          transition: transform 80ms var(--rt-ease-press);
        }

        /* Focus button — soft shadow surface, no border. Active state
           gets a green-glow shadow (set inline) matching the polish
           language. Inactive previews the active green color on hover. */
        .rt-focus-btn {
          background: var(--rt-card);
          color: var(--rt-text-sec);
          border: none;
          box-shadow: var(--rt-sh-card);
          transition: box-shadow 200ms var(--rt-ease-out),
                      color 200ms var(--rt-ease-out),
                      transform 200ms var(--rt-ease-out);
        }
        @media (hover: hover) {
          .rt-focus-btn:hover:not(.is-active) {
            color: #1C3224;
            box-shadow: var(--rt-sh-card-hover);
            transform: translateY(-1px);
          }
        }
        .rt-focus-btn:active { transform: translateY(0) scale(0.97); transition: transform 80ms var(--rt-ease-press); }

        /* "3 events" stats button — mobile only (desktop sets pointer-events:
           none on this class). Subtle wash, matches composer chip hover. */
        @media (max-width: 768px) and (hover: hover) {
          .rt-band-sub-events:hover { background: rgba(0,0,0,0.04); border-radius: 4px; }
        }
        /* ── LEGACY .r-btn — base motion + lift ────────────
           Buttons that use .r-btn get hover lift + press scale. The
           background gradient is applied via the data-tone="purple"
           attribute on the element. To migrate an existing flat-purple
           button to the gradient: add data-tone="purple" and drop the
           inline background:C.btn. */
        .r-btn { transition: all 200ms var(--rt-ease-out); cursor: pointer; }
        @media (hover: hover) {
          .r-btn:hover:not(:disabled) {
            transform: translateY(-1px);
          }
        }
        .r-btn:active:not(:disabled) { transform: scale(0.97); transition: transform 80ms var(--rt-ease-press); }
        .r-btn[data-tone="purple"] {
          background: var(--rt-grad-btn) !important;
          color: #fff !important;
          box-shadow: var(--rt-sh-purple) !important;
        }
        .r-btn[data-tone="purple"]:hover:not(:disabled) {
          background: var(--rt-grad-btn-hover) !important;
          box-shadow: var(--rt-sh-purple-hover) !important;
        }
        .r-btn[data-tone="green"] {
          background: var(--rt-grad-green-deep) !important;
          color: #fff !important;
          box-shadow: var(--rt-sh-green-glow) !important;
        }
        .r-btn[data-tone="green"]:hover:not(:disabled) {
          box-shadow: 0 0 0 1px rgba(51,84,62,0.18), 0 6px 18px rgba(51,84,62,0.28) !important;
        }
        .row-hover { transition: background 0.1s, transform 180ms var(--rt-ease-out); cursor: pointer; }
        .row-hover:hover { background: ${C.primarySoft}; transform: translateX(2px); }
        /* Neutral row-hover variant — for table rows where green is too
           loud / fights with status pills inside the row. Same shift-right
           motion, lighter wash. Used in the Clients Table view (both mobile
           + desktop variants). */
        .row-hover-neutral { transition: background 0.1s, transform 180ms var(--rt-ease-out); cursor: pointer; }
        .row-hover-neutral:hover { background: rgba(0,0,0,0.03); transform: translateX(2px); }

        /* ── .rt-soft-row — queue row with sage hover preview ──
           Used by left-side widget queues (Who to ask next, Awaiting
           retro, Health queue). Idle = transparent. Hover = sage wash
           (#EAEDE9) which previews the active soft-green commit state
           without being as loud. Active state is set inline at the
           call site (typically primarySoft bg + primary border-left).
           The :not selector ensures hover doesn't override the active
           treatment when the row is also active. */
        .rt-soft-row { transition: background 140ms, border-left-color 140ms; cursor: pointer; background: transparent; }
        .rt-soft-row:not(.is-active):hover { background: #EAEDE9 !important; }

        /* ════════════════════════════════════════════════════
           DESIGN LANGUAGE — single source of truth.
           Every Btn / Card / Pill / Toggle / IconBtn renders
           through these rules. The primitives in App.jsx (Btn,
           Card, Pill, Toggle, IconBtn) attach the relevant class
           and pass through user style overrides.
           ════════════════════════════════════════════════════ */

        /* ── BUTTONS ─────────────────────────────────────── */
        /* Add Task composer submit — two-state (disabled = warm neutral,
           enabled = purple gradient). Hover/press transitions defined here
           so the inline two-state styling stays clean. */
        .rt-add-task-btn {
          transition: background 220ms var(--rt-ease-out),
                      box-shadow 220ms var(--rt-ease-out),
                      color 220ms var(--rt-ease-out),
                      transform 200ms var(--rt-ease-out);
        }
        .rt-add-task-btn:not(:disabled):hover {
          background: #274230 !important;
          box-shadow: 0 1px 2px rgba(20,30,22,0.10), 0 6px 20px rgba(51,84,62,0.30) !important;
          transform: translateY(-1px);
        }
        .rt-add-task-btn:not(:disabled):active {
          transform: translateY(0) scale(0.97);
          transition: transform 80ms var(--rt-ease-press);
        }
        /* Rai-territory gradient buttons (sidebar New Chat, future
           additions). Use the SITE STANDARD --rt-sh-purple at rest and
           --rt-sh-purple-hover on hover (same as every other primary
           purple CTA). Previously used the special --rt-sh-rai-pop
           token which had a 32px halo bleed — hover-tier intensity for
           a rest state. The class kept its name for compatibility but
           no longer applies the heavy halo. */
        /* New Chat button (.rt-rai-pop-btn) lives only in the dark Rai
           sidebar, where the html .r-desk ghost rules above own all of its
           states (transparent + hairline, faint white-tint hover). No
           purple gradient / lift here anymore. */
        .rt-rai-pop-btn:active {
          transform: none;
        }

        /* ──────────────────────────────────────────────────────
           CLIENT MODAL — STICKY FOOTER BUTTONS
           Discuss at rest is flat C.btn (matches Add Client, Add
           Worker — the standard primary button style). On hover
           it reveals the Rai-territory gradient + halo + 1px lift.
           Edit/Pause/Remove are card chips at rest and lift to
           sh-card on hover, same chip language as nav/composer.
           ────────────────────────────────────────────────────── */
        /* Discuss button uses the legacy .r-btn[data-tone="purple"]
           pattern (gradient + halo + 1px lift) — same as Add Client.
           Earlier iterations had a custom rt-cm-btn-primary that felt
           janky on hover; removed in favor of the standard. */
        .rt-cm-btn-secondary {
          background: ${C.card};
          color: ${C.textSec};
          box-shadow: var(--rt-sh-xs);
          transition: background 160ms var(--rt-ease-out),
                      color 160ms var(--rt-ease-out),
                      box-shadow 200ms var(--rt-ease-out),
                      transform 200ms var(--rt-ease-out);
        }
        .rt-cm-btn-secondary:hover {
          color: ${C.text};
          box-shadow: var(--rt-sh-card);
          transform: translateY(-1px);
        }
        .rt-cm-btn-secondary:active {
          transform: translateY(0) scale(0.98);
          transition: transform 80ms var(--rt-ease-press);
        }
        .rt-cm-btn-danger {
          background: ${C.card};
          color: ${C.danger};
          box-shadow: var(--rt-sh-xs);
          transition: box-shadow 200ms var(--rt-ease-out),
                      transform 200ms var(--rt-ease-out);
        }
        .rt-cm-btn-danger:hover {
          box-shadow: var(--rt-sh-card);
          transform: translateY(-1px);
        }
        .rt-cm-btn-danger:active {
          transform: translateY(0) scale(0.98);
          transition: transform 80ms var(--rt-ease-press);
        }
        /* ── PILL — generic small status/info chip ───────── */
        /* Most pills are presentational. If interactive, wrap in a button. */

        /* ── ROW (task row, client row, queue row) ──────── */
        /* Generic row that gets the same treatment as a card but
           with the geometry of a horizontal list item. */
        .rt-row {
          transition: box-shadow 200ms var(--rt-ease-out),
                      transform 200ms var(--rt-ease-out);
        }
        .rt-row:hover:not(.is-done) {
          box-shadow: var(--rt-sh-row-hover) !important;
          transform: translateY(-1px);
        }
        .rt-row:hover .rt-dismiss,
        .rt-row:hover .rt-push { opacity: 1 !important; }

        /* ── TODAY EMPHASIS (break-out, "B") ───────────────
           The first today task is pulled LEFT out of the grid,
           lifted and larger — physically closest to the reader.
           The rest sit indented on a quiet vertical thread.
           Misalignment is the attention magnet; no color trick.
           Condensed = future buckets tighten. */
        .rt-today-canvas {
          background: linear-gradient(180deg, rgba(234,228,214,0.32), rgba(234,228,214,0.02));
          position: relative;
          border-radius: 20px;
          padding: 6px 14px 16px;
          margin: 6px -8px 0;
        }
        /* Break-out top task — same full width as every other row, just
           shifted left via transform so it breaks the rhythm without
           changing length. Lifted + bigger checkbox carry the emphasis.
           When a new task becomes the break-out (e.g. task 1 completed,
           task 2 promotes), it eases in from the normal row position
           instead of popping into the offset+lift. */
        .rt-today-breakout {
          transform: translateX(-24px);
          margin-bottom: 14px;
        }
        /* Entry animation ONLY when a task just promoted into the slot — gated
           by the .rt-today-breakout-animate class (set briefly via justPromoted
           state). Without this gate the animation replayed on every page mount,
           causing a spurious swing when returning to the Today tab. */
        .rt-today-breakout-animate {
          animation: rt-breakout-in 200ms cubic-bezier(.22,.61,.36,1) both;
        }
        @keyframes rt-breakout-in {
          from { transform: translateX(-24px) translateY(-3px); opacity: 0.85; }
          to   { transform: translateX(-24px) translateY(0); opacity: 1; }
        }
        .rt-today-breakout .rt-row {
          padding: 16px 18px;
          box-shadow: 0 0 0 1px rgba(20,30,22,0.10), 0 3px 8px rgba(20,30,22,0.07), 0 12px 30px rgba(20,30,22,0.09) !important;
        }
        .rt-today-breakout-animate .rt-row {
          animation: rt-breakout-row-in 190ms cubic-bezier(.25,.8,.35,1) both;
        }
        @keyframes rt-breakout-row-in {
          from { box-shadow: 0 0 0 1px rgba(20,30,22,0.12), 0 1px 2px rgba(20,30,22,0.04), 0 1px 6px rgba(20,30,22,0.025); }
          to   { box-shadow: 0 0 0 1px rgba(20,30,22,0.10), 0 3px 8px rgba(20,30,22,0.07), 0 12px 30px rgba(20,30,22,0.09); }
        }
        .rt-today-breakout .rt-row .rt-task-title { font-size: 14.5px; font-weight: 500; }
        .rt-today-breakout .rt-row .rt-check { width: 24px; height: 24px; }
        /* When the break-out top task is ALSO a Rai task, layer the
           1px purple ring + soft purple halo OVER the breakout's
           lifted shadow. Per Adam's spec: in this position, the Rai
           hairline gets a little shading too — the breakout already
           carries elevation, so a faint purple glow ties the
           authorship signal into the lift. */
        .rt-today-breakout .rt-row.rt-rai-boost {
          box-shadow: 0 0 0 1px rgba(124,92,243,0.45), 0 3px 8px rgba(20,30,22,0.07), 0 12px 30px rgba(124,92,243,0.10) !important;
        }
        .rt-today-breakout .rt-row.rt-rai-boost:hover:not(.is-done) {
          box-shadow: 0 0 0 1px rgba(124,92,243,0.45), 0 4px 10px rgba(20,30,22,0.08), 0 14px 34px rgba(124,92,243,0.13) !important;
        }
        /* The rest — plain stack, no thread (break-out carries emphasis). */
        .rt-today-rest { position: relative; }
        /* Three type tiers: first today 14.5 / today secondary 14 (base) /
           tomorrow, later, completed 13.5 — a subtle step down for non-today. */
        .rt-row-condensed .rt-row .rt-task-title,
        .rt-completed-log .rt-row .rt-task-title { font-size: 13.5px; }
        /* Tomorrow/Later/completed are dimmed (opacity on their wrappers)
           but otherwise match the today secondary rows exactly — same
           row size, title, and checkbox. No size-shrink. */

        /* ── COMPOSER ────────────────────────────────────── */
        .rt-composer {
          transition: box-shadow 200ms var(--rt-ease-out);
        }
        .rt-rai-inputbox {
          transition: box-shadow 200ms var(--rt-ease-out);
        }
        /* Purple focus state — when the user clicks into the task composer or
           the initial Rai chat input (both use .rt-composer), a soft purple
           ring + gentle glow appears. Deliberately understated (low alpha,
           tight spread) so it reads as elegant focus, not the loud
           primary-button purple. The in-conversation Rai input
           (.rt-rai-inputbox) intentionally does NOT get this — once you're
           in a normal chat it stays neutral. */
        .rt-composer:focus-within {
          box-shadow: 0 0 0 1px rgba(124,92,243,0.30),
                      0 1px 2px rgba(20,30,22,0.04),
                      0 2px 10px rgba(124,92,243,0.10) !important;
        }
        /* Rai composer focus — green ring (not purple), since the Rai send
           button and chrome are green. Scoped under .r-rai-intro so the
           Today task composer keeps its own focus treatment. */
        .r-rai-intro .rt-composer:focus-within {
          box-shadow: 0 0 0 1px rgba(51,84,62,0.28),
                      0 1px 3px rgba(20,30,22,0.04),
                      0 8px 24px rgba(20,30,22,0.06) !important;
        }
        /* (1) The TASK composer (inside the Today page) is an underline-
           style input, not a card. On focus, the 1.5px hairline at the
           bottom thickens and darkens, like a serious text input. */
        .rt-today-v4 .rt-composer {
          transition: border-bottom-color 140ms var(--rt-ease-out);
        }
        .rt-today-v4 .rt-composer:focus-within {
          box-shadow: none !important;
          border-bottom-color: rgba(20,30,22,0.40) !important;
        }
        /* V5 readout fade-in: when the user pauses typing for 400ms, the
           readout line below the composer fades in. Subtle and quick. */
        @keyframes rt-readout-fade-in {
          from { opacity: 0; transform: translateY(-2px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ── CHECKBOX ────────────────────────────────────── */
        .rt-row .rt-check {
          transition: background 240ms ease, border-color 240ms ease,
                      box-shadow 200ms var(--rt-ease-out),
                      transform 280ms cubic-bezier(.34,1.56,.64,1);
        }
        @media (hover: hover) {
          .rt-row:not(.is-done) .rt-check:hover {
            border-color: #558B68 !important;
            box-shadow: 0 0 0 4px var(--rt-primary-soft, #E6EFE9);
          }
        }
        .rt-row .rt-check svg {
          opacity: 0;
          transform: scale(0.4);
          transition: opacity 220ms ease 60ms, transform 320ms cubic-bezier(.34,1.56,.64,1) 60ms;
        }
        .rt-row.is-done .rt-check {
          background: linear-gradient(135deg, #33543E 0%, #274230 100%) !important;
          border-color: #33543E !important;
          box-shadow: var(--rt-sh-green-glow);
          transform: scale(1);
        }
        .rt-row.is-done .rt-check svg { opacity: 1; transform: scale(1); }

        /* ── RAI TASK MARKER ──────────────────────────────────────
           Rai-suggested tasks get TWO signals, both minimal:
             1. A 1px purple hairline border around the row (replaces
                the previous purple ring + inset bar + glow + bobbing
                medallion combo).
             2. An inline purple star icon BEFORE the task title text
                inside the row content (rendered in JSX, not CSS).
           No outer shadow, no extra shading, no animation. Reads as
           typographic attribution, not as AI-marker chrome — the
           "purple-glow AI row" pattern has become a template
           fingerprint we're explicitly avoiding. The hairline says
           "this row belongs to Rai" quietly. The star says it once.
           Done. */
        .rt-rai-boost {
          box-shadow: var(--rt-sh-row), 0 0 0 1px rgba(124,92,243,0.35) !important;
        }
        .rt-rai-boost:hover:not(.is-done) {
          box-shadow: var(--rt-sh-row-hover), 0 0 0 1px rgba(124,92,243,0.35) !important;
        }
        /* When checked off, drop the hairline — completed tasks
           shouldn't read as still-needing-attention. The inline star
           remains in the title, but greyed via .is-done .text rules. */
        .rt-rai-boost.is-done {
          box-shadow: var(--rt-sh-row) !important;
        }

        /* Calendar composer (G) — idle is the flush hairline-divider
           treatment set inline at the call site. On focus-within, the
           row softens into a warm-cream recessed input. Lets us keep
           the lightweight idle state Adam wanted while restoring real
           input weight while typing. Transitions cover the morph so
           neither state feels jumpy. */
        .rt-cal-composer {
          transition: background 180ms var(--rt-ease-out),
                      box-shadow 180ms var(--rt-ease-out);
        }
        .rt-cal-composer:focus-within {
          background: rgba(255,255,255,0.78) !important;
          box-shadow: inset 0 1px 2px rgba(20,30,22,0.06);
        }

        /* Progress bar leading-edge highlight (D). A small radial bright
           spot at the right edge of the fill suggests an instrument in
           motion rather than a flat gradient. */
        .rt-pct-fill {
          position: absolute;
        }
        .rt-pct-fill::after {
          content: '';
          position: absolute;
          right: -1px;
          top: -2px;
          bottom: -2px;
          width: 8px;
          border-radius: 999px;
          background: radial-gradient(ellipse at left, rgba(255,255,255,0.55), transparent 70%);
          pointer-events: none;
        }

        /* Pick-sentence ✦ medallion removed — Rai pick is pure italic
           prose to keep the band quiet and tight. */

        /* ── ANIMATIONS ──────────────────────────────────── */
        @keyframes rtChkIn {
          from { transform: scale(0) rotate(-12deg); opacity: 0; }
          to { transform: scale(1) rotate(0); opacity: 1; }
        }
        @keyframes rtNowPulse {
          0%, 100% { box-shadow: 0 0 0 1px rgba(139,106,27,0.18), 0 2px 8px rgba(139,106,27,0.28); }
          50%      { box-shadow: 0 0 0 1px rgba(139,106,27,0.24), 0 2px 14px rgba(139,106,27,0.42); }
        }
        .rt-now-pulse { animation: rtNowPulse 2.4s ease-in-out infinite; }
        @keyframes rtSavePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
        .rt-save-pulse { animation: rtSavePulse 2s ease-in-out infinite; }

        /* Composer chip auto-fill pulse — fires when parseComposer
           catches a typed phrase and auto-fills the Client / Worker / Due
           chip. Brief brighten then settle. No scale (would push neighbors
           mid-line). The chip is already animating its color/bg change via
           the existing 120ms transition; this pulse layers ON TOP via a
           pseudo-element ring that fades in then out. ~500ms total. */
        /* Skeleton loading placeholders — row-shaped shimmers that
           mirror the real row geometry, so when data arrives nothing
           jumps. Used on Today (tasks), Clients (rows), Health (queue).
           Light grey base on a paler sweep at ~1.4s cycle. */
        @keyframes rtShimmer {
          0%   { background-position: -480px 0; }
          100% { background-position: 480px 0; }
        }
        .rt-sk {
          /* Slower, softer shimmer. Was 1.4s with a stronger highlight —
             too mechanical for the brand's calm voice. 2.4s with a more
             modest highlight reads as breathing rather than spinning. */
          background-color: #E8E9E5;
          background-image: linear-gradient(90deg, rgba(232,233,229,0.7) 0%, rgba(247,245,240,0.95) 50%, rgba(232,233,229,0.7) 100%);
          background-size: 480px 100%;
          background-repeat: no-repeat;
          animation: rtShimmer 2.4s ease-in-out infinite;
          border-radius: 4px;
          display: inline-block;
        }
        @keyframes chipPulse {
          0%   { box-shadow: 0 0 0 0 rgba(124,92,243,0.55); }
          40%  { box-shadow: 0 0 0 6px rgba(124,92,243,0.18); }
          100% { box-shadow: 0 0 0 10px rgba(124,92,243,0); }
        }
        .chip-pulse {
          animation: chipPulse 500ms ease-out;
        }
        /* Shared icon-close button — any × that dismisses a chip, clears
           a field, or closes a modal. Faint grey wash under the icon +
           icon darkens muted → text. Single source of truth so every
           close button feels the same. */
        .rt-icon-close { transition: background 120ms ease, color 120ms ease; cursor: pointer; }
        @media (hover: hover) {
          .rt-icon-close:hover { background: rgba(0,0,0,0.05); color: ${C.text} !important; }
        }
        /* Clients page sort + filter chips — inactive variant.
           Chip language: subtle card surface with sh-xs at rest, deeper
           shadow + slight lift on hover. Same recipe as nav user chip,
           composer chip pills, etc.
           Hover adds a tiny 180° gradient (white → faint warm) on top of
           the existing lift — gives the chip a physical "rising" feel
           rather than a flat color change. */
        .rt-sort-opt {
          background: ${C.card};
          color: ${C.textSec};
          border: none;
          box-shadow: var(--rt-sh-xs);
          transition: background 120ms ease, color 120ms ease, box-shadow 180ms var(--rt-ease-out), transform 180ms var(--rt-ease-out);
        }
        @media (hover: hover) {
          .rt-sort-opt:hover {
            color: ${C.text};
            background: linear-gradient(180deg, #FFFFFF 0%, #FCFCFA 100%);
            box-shadow: 0 1px 2px rgba(20,30,22,0.05), 0 6px 14px rgba(20,30,22,0.08);
            transform: translateY(-1px);
          }
        }
        /* Clients page view toggle — inactive variant. Translucent white
           wash on hover, text darkens muted → full. Same pattern as the
           Today/Tomorrow toggle. */
        .rt-view-opt {
          background: transparent;
          color: ${C.textMuted};
          box-shadow: none;
          transition: background 120ms ease, color 120ms ease;
        }
        @media (hover: hover) {
          .rt-view-opt:hover {
            background: rgba(255,255,255,0.55);
            color: ${C.text};
          }
        }
        /* Sidebar hidden on mobile. Must use !important because the
           sidebar root has inline display: flex (needed for flex layout
           on desktop), which would otherwise beat the no-important rule
           below 768px and show the desktop sidebar on phones. The
           min-width: 768px rule also uses !important and wins via
           cascade order. */
        .r-desk { display: none !important; }
        .r-mob-bot-dock { display: flex; }
        /* Hide WebKit scrollbars on the horizontal nav strips so the bar
           reads as a clean dock. Firefox uses scrollbarWidth: none inline. */
        .r-mob-nav-strip::-webkit-scrollbar { display: none; }
        /* Mobile-only Revenue-from-referrals card. The desktop version
           lives in the .rc-rail sticky column, which is display:none
           below 768px — so on phones the $ widget vanished entirely.
           This wrapper renders the same content above the network map
           on mobile and hides itself on desktop. */
        .rt-refs-money-mobile { display: none; }
        @media (max-width: 768px) {
          .rt-refs-money-mobile { display: block; margin-bottom: 14px; }
        }
        /* QuickLog FAB — DESKTOP ONLY (power-user quick-capture, all pages).
           Hidden on mobile. Desktop: 52px, bottom-right.
           !important is required: the button sets display:flex inline, which
           would otherwise beat this class rule and leak the FAB onto mobile. */
        .rt-quicklog-fab { display: none !important; }
        @media (min-width: 768px) {
          .rt-quicklog-fab {
            display: flex !important;
            top: auto; bottom: 24px;
            width: 52px; height: 52px;
            border-radius: 50%;
            font-size: 28px;
          }
        }
        /* QuickLog popover + toast — anchored above the bottom-right FAB (desktop). */
        .rt-quicklog-popover { top: auto; bottom: 90px; }
        .rt-quicklog-toast { top: auto; bottom: 90px; }
        /* Mobile pinned FAB lives in the docked nav; hide it on desktop. */
        .rt-mob-fab { display: flex; }
        @media (min-width: 768px) { .rt-mob-fab { display: none !important; } }
        /* Timeline scroll container hides its scrollbar — the partial-day
           visible window plus the NOW marker make scroll affordance clear
           enough without a visible track. Covers all three browser engines:
           webkit (chrome/safari/edge), firefox (scrollbar-width), legacy
           edge (-ms-overflow-style). */
        .rt-timeline-scroll::-webkit-scrollbar { display: none; }
        .rt-timeline-scroll { scrollbar-width: none; -ms-overflow-style: none; }
        /* Client profile modal scrolls internally up to 90vh. Hide the
           scrollbar — the modal's clear edges and the sticky close button
           provide enough affordance that the inner track adds visual noise. */
        .r-client-modal::-webkit-scrollbar { display: none; }
        .r-client-modal { scrollbar-width: none; -ms-overflow-style: none; }
        /* Sidebar scrollbar — sidebar root has overflow-y: auto so short
           screens can scroll to reveal the widget + user chip + recent
           chats. Native scrollbar would clutter the warm-cream substrate;
           hide it across all browser engines. */
        .r-desk::-webkit-scrollbar { display: none; }
        .r-desk { scrollbar-width: none; -ms-overflow-style: none; }
        /* Due picker and Client picker on mobile: keep anchored to the chip
           (like Worker does) instead of popping as a bottom sheet. Earlier
           iterations pinned these to the viewport to give them screen room,
           but it disconnected them from the source chip and looked sloppy.
           Falling back to the inline JSX position (absolute, dropping below
           the chip) makes the relationship clear and matches Worker. */
        .r-main { padding: 16px 16px 96px; scrollbar-gutter: stable; }
        /* Today page: hide the scrollbar (and its gutter) for a clean edge. */
        .r-main:has(.rt-today-v4) { scrollbar-gutter: auto; }
        .r-main:has(.rt-today-v4)::-webkit-scrollbar { display: none; }
        .r-main:has(.rt-today-v4) { scrollbar-width: none; -ms-overflow-style: none; }
        .r-main:has(.r-rai-page) { background: none; padding: 0 !important; }
        /* Rai page must fill the mobile viewport (minus the ~60px bottom nav) so
           the flex column lets the scroll area grow and the input bar pins to the
           true bottom. Without an explicit height, height:100% resolves against a
           content-sized parent and the input floats mid-screen. dvh handles the
           mobile URL bar. Scoped to mobile so desktop's sidebar layout is untouched. */
        @media (max-width: 767px) {
          .r-rai-page { height: calc(100dvh - 60px) !important; }
          /* Break-out task on mobile: the desktop -24px shift pops into the
             64px page padding, which mobile doesn't have — at -24px the row +
             its purple rai ring clipped off the left edge. Scale the shift to
             what the mobile canvas can absorb (canvas already bleeds -8px past
             the list, r-main has 16px padding) so it still BREAKS the rhythm
             and reads as the hero — just a mobile-native amount. Lift + larger
             type carry the rest of the emphasis, same as desktop. */
          .rt-today-breakout { transform: translateX(-10px) !important; }
          @keyframes rt-breakout-in-mobile {
            from { transform: translateX(-10px) translateY(-3px); opacity: 0.85; }
            to   { transform: translateX(-10px) translateY(0); opacity: 1; }
          }
          .rt-today-breakout-animate { animation: rt-breakout-in-mobile 200ms cubic-bezier(.22,.61,.36,1) both !important; }
          /* Band More/Less expand is the wrong UX on mobile — hide it. */
          .rt-band-more { display: none !important; }
        }
        .r-today-panel { display: none !important; }
        .r-client-modal { top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; transform: none !important; max-width: 100% !important; max-height: 100% !important; border-radius: 0 !important; }
        /* Mobile: chat user-message clearance from sticky top bar when scrolled */
        .r-rai-inner { padding-top: 56px !important; }
        .r-chat-msg-user { scroll-margin-top: 56px !important; }
        /* Mobile: tighten chat input bar bottom padding — clear mobile nav (60px) + breathing room */
        .r-rai-inputbar { padding: 10px 16px 88px !important; }
        /* Rai page surface — flat bg. The purple radial-gradient wash was
           removed: send button + chrome are green now, the purple page
           glow was the last thing making Rai read as purple. Flat bg also
           means the input bar's matching bg no longer shows a seam line. */
        .r-rai-intro {
          background: ${C.bg};
        }
        .r-rai-chat {
          background: ${C.bg};
        }
        /* Make the inputbar inherit the gradient background so it doesn't show a seam */
        .r-rai-intro .r-rai-inputbar,
        .r-rai-chat .r-rai-inputbar { background: transparent !important; }
        /* De-facto (intro) Rai surface: the hero input box ("Ask about a
           client…") is a .rt-composer inside .r-rai-intro. Give it the purple
           hairline + shadow at rest (same --rt-sh-purple as the Rai suggestion
           cards) so it reads as Rai's surface. Targets BOTH the hero composer
           and the reply inputbox for that state. */
        .r-rai-intro .rt-composer,
        .r-rai-intro .rt-rai-inputbox { box-shadow: 0 1px 3px rgba(20,30,22,0.04), 0 8px 24px rgba(20,30,22,0.06) !important; }
        /* Mobile: don't vertically center the intro — start content near the top */
        @media (max-width: 767px) {
          .r-rai-intro .r-rai-inner { justify-content: flex-start !important; padding-top: 48px !important; }
        }
        @media (min-width: 768px) {
          :root { --sidebar-w: 240px; --page-gap: 14px; --sidebar-left: 14px; }
          /* html/body bg owned by base rule (with paper-grain texture);
             previous !important override here was wiping the texture
             on desktop. App.app-root inherits transparently. */
          .app-root { background: transparent !important; }
          .r-desk { display: flex !important; }
          .r-mob-bot { display: none !important; }
          .r-mob-bot-dock { display: none !important; }
          .r-today-panel { display: block !important; }
          /* Desktop: right-side slideover panel. Sits flush with sidebar
             top/bottom (14px gap), takes 560px width on the right. List
             stays visible behind the 32% backdrop so clicking another row
             swaps content in place. */
          .r-client-modal {
            top: 14px !important;
            right: 14px !important;
            left: auto !important;
            bottom: 14px !important;
            transform: none !important;
            width: 560px !important;
            max-width: 560px !important;
            max-height: none !important;
            border-radius: 14px !important;
            box-shadow: -8px 0 24px rgba(20,30,22,0.06), -2px 0 8px rgba(20,30,22,0.04), 0 4px 12px rgba(20,30,22,0.04) !important;
            animation: rt-slideover-in 320ms var(--rt-ease-out) backwards;
          }
          .r-main {
            padding: 28px 64px;
            position: fixed;
            top: var(--page-gap);
            right: var(--page-gap);
            bottom: var(--page-gap);
            left: calc(var(--sidebar-left) + var(--content-sidebar-w, var(--sidebar-w)) + var(--sidebar-content-gap, 16px));
            background: ${C.bg};
            overflow-y: auto;
            overflow-x: hidden;
          }
          /* Force-apply the gap regardless of var resolution. Pinned (≥1700)
             gets a clearly larger gap than rail. */
          html[data-sidebar-pin="rail"] .r-main { left: calc(14px + 64px + 24px) !important; }
          html[data-sidebar-pin="pinned"] .r-main { left: calc(14px + 240px + 36px) !important; }
          /* Coach page keeps the card chrome (rounded corners, shadow) like every
             other page. overflow: hidden clips the purple gradient to the rounded
             corners. height (not min-height) locks the card exactly to the viewport
             so its top + bottom align with the sidebar — no gap above, no empty
             beige below. */
          .r-main:has(.r-rai-page) {
            padding: 0 !important;
            overflow: hidden;
            top: 0 !important;
            bottom: 0 !important;
            height: 100vh;
            min-height: 0 !important;
          }
          .r-rai-inner { padding-top: 32px !important; }
          .r-rai-inputbar { padding: 12px 24px 28px !important; }
          .r-chat-msg-user { scroll-margin-top: 24px !important; }
        }
        @keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:0.8} }
        @keyframes rtCaretBlink { 0%,45%{opacity:1} 55%,100%{opacity:0} }
        .rt-stream-caret { animation: rtCaretBlink 1s steps(1) infinite; }
        @keyframes confetti-fall {
          0%   { transform: translate(0,0) rotate(0); opacity: 1; }
          100% { transform: translate(var(--tx), 70vh) rotate(var(--rot)); opacity: 0; }
        }
        /* (rt-row, rt-composer, rt-check, rt-add-task-btn rules consolidated
           above in DESIGN LANGUAGE block — these CSS rules are not duplicated
           here. The .rt-add-task-btn class points to .rt-btn-primary semantics
           via JSX; see App.jsx composer JSX for the migration.) */
        /* ASMR completion — done state styling */
        .rt-row.is-done {
          background: ${C.bg} !important;
          border-color: ${C.borderLight} !important;
          transition: background 320ms ease, border-color 320ms ease;
        }
        /* (rt-check rules consolidated above in DESIGN LANGUAGE block) */
        .rt-row .rt-task-title {
          position: relative;
          /* Single-line truncation with ellipsis. Tasks are capped at 75
             chars at save time (both user-typed and Rai-generated), and
             75 chars at 14px Manrope fits one line on desktop and just
             under two lines on mobile. This style ensures legacy tasks
             written before the cap (or any future overrun) display
             cleanly without exploding row height. The full text is
             reachable via the title tooltip + the edit affordance. */
          display: inline-block;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          vertical-align: bottom;
          font-size: 14px;
          font-weight: 500;
          line-height: 1.3;
          transition: color 320ms ease;
        }
        .rt-row .rt-task-title::after {
          content: ""; position: absolute; left: 0; top: 50%;
          height: 1.5px; width: 0; background: currentColor;
          transition: width 360ms cubic-bezier(.6, 0, .4, 1);
        }
        .rt-row.is-done .rt-task-title { color: ${C.textMuted}; }
        .rt-row.is-done .rt-task-title::after { width: 100%; }
        .rt-row.is-done .rt-row-meta { opacity: 0.55; color: ${C.textMuted}; transition: opacity 320ms ease, color 320ms ease; }
        .rt-row.is-done .rt-task-avatar { opacity: 0.4; filter: grayscale(1); transition: opacity 320ms ease, filter 320ms ease; }

        /* Elegant exit: when a completed task transitions to the "completed today"
           log, it shrinks vertically (max-height collapse), fades to invisible,
           and the gap below it disappears as the bucket below slides up. The
           negative margin pulls the next sibling up by exactly the gap (8px) so
           there's no remaining empty slot mid-animation. */
        .rt-row-wrap {
          max-height: 200px;
          opacity: 1;
          transition:
            max-height 220ms cubic-bezier(.22,.61,.36,1),
            opacity 160ms cubic-bezier(.22,.61,.36,1),
            margin 220ms cubic-bezier(.22,.61,.36,1);
        }
        .rt-row-wrap.is-exiting {
          max-height: 0 !important;
          opacity: 0;
          margin-bottom: -10px;
          pointer-events: none;
          overflow: hidden !important;
        }
        /* On mobile, the push and dismiss buttons are hidden — swipe gestures
           replace them entirely. Right swipe pushes to next bucket, left swipe
           deletes. Backgrounds reveal during swipe so the action is intuitive. */
        @media (max-width: 767px) {
          .rt-row .rt-push,
          .rt-row .rt-dismiss {
            display: none !important;
          }
        }
        /* Dotted primary-green underline on task titles whose text contains
           a thinking verb. Indicates "click me to discuss with Rai." Title
           text stays black; only the underline goes from dotted-light to
           solid-green on hover. Done tasks lose the affordance entirely.
           Note: text-underline-offset is small (1px) because the parent div
           has overflow:hidden — large offsets clip the dotted line out of view. */
        .rt-task-title.is-discussable {
          text-decoration: underline;
          text-decoration-style: dotted;
          text-decoration-color: #33543E;
          text-decoration-thickness: 2px;
          text-underline-offset: 2px;
          cursor: pointer;
          transition: text-decoration-color 160ms ease, text-decoration-style 160ms ease;
        }
        .rt-task-title.is-discussable:hover {
          text-decoration-style: solid;
          text-decoration-color: #33543E;
        }
        .rt-row.is-done .rt-task-title.is-discussable {
          text-decoration: none;
          cursor: default;
        }
        .rt-row.is-done .rt-row-tag { opacity: 0.45; transition: opacity 320ms ease; }
        .rt-row.is-done .rt-dismiss { opacity: 0.4 !important; }
        @keyframes rt-glow-pulse {
          0% { box-shadow: 0 0 0 0 rgba(45,134,89,0); transform: scale(1); }
          30% { box-shadow: 0 0 0 6px rgba(45,134,89,0.18); transform: scale(0.985); }
          100% { box-shadow: 0 0 0 0 rgba(45,134,89,0); transform: scale(1); }
        }
        .rt-row.is-just-done {
          animation: rt-glow-pulse 700ms ease-out;
        }
        .rt-row.is-just-done .rt-check {
          background: ${C.success} !important;
          border-color: ${C.success} !important;
          transform: scale(1.18);
        }
        .rc-queue-item:hover:not([data-active="true"]) { background: #EAEDE9 !important; }
        /* Rai sidebar — reveal star/delete on row hover */
        .r-convo-row:hover:not([style*="rgba(124,92,243"]) { background: var(--rt-deep-cream) !important; color: var(--rt-text) !important; }
        .r-convo-row:hover .r-convo-action { opacity: 1 !important; }
        /* Direct-hover on the revealed icons. Star brightens to gold
           (previews the on-state). Trash goes danger red (the universal
           "this deletes" signal). !important needed — the buttons set
           color inline so the cascade alone won't reach them. Scoped to
           hover-capable devices so touch doesn't get stuck states. */
        @media (hover: hover) {
          .r-convo-star:hover { color: #E6B800 !important; }
          .r-convo-del:hover { color: ${C.danger} !important; }
        }
        /* ═══════════════════════════════════════════════════════════════
           FOCUS MODE
           Page stays cream. Everything dims to 0.06 opacity except:
             - .rt-toolbar (the toggle row with Ranked by Rai + Focus button)
             - .rt-row.rt-focus-top (the highlighted top task)
        ═══════════════════════════════════════════════════════════════ */

        /* Dim the sidebar as a single unit — fading the shell fades its
           content AND its deep-cream hairline box-shadow uniformly (no
           compounding). Plus the collapse toggle on the sidebar edge. */
        body:has(.rt-focus-on) .r-desk,
        body:has(.rt-focus-on) .rt-sidebar-toggle,
        body:has(.rt-focus-on) .r-mob-bot-dock > * {
          opacity: 0.06 !important;
          transition: opacity 280ms ease;
          pointer-events: none;
        }

        /* Dim every direct child of the today grid except the tasks column.
           Focus mode is single-task tunnel vision — everything else fades. */
        .rt-focus-on > *:not(.rt-tasks-col) {
          opacity: 0.06 !important;
          pointer-events: none !important;
          transition: opacity 280ms ease;
        }

        /* Inside tasks col: dim every row except the focus-top one */
        .rt-focus-on .rt-row:not(.rt-focus-top) {
          opacity: 0.06 !important;
          pointer-events: none !important;
          transition: opacity 280ms ease;
        }

        /* Toolbar stays bright (no rule = default opacity 1, default styling) */

        /* Focused task gets a purple ring + soft shadow + slight scale to pop */
        .rt-focus-on .rt-row.rt-focus-top {
          position: relative;
          z-index: 6;
          transform: scale(1.015);
          box-shadow:
            0 0 0 1px rgba(124,92,243,0.35),
            0 4px 14px rgba(124,92,243,0.16),
            0 8px 22px rgba(20,30,22,0.07) !important;
          transition: transform 320ms ease 100ms, box-shadow 320ms ease 100ms;
        }
        /* When focus row is wrapped in a swipe container, scale + shadow apply to wrapper */
        .rt-focus-on .rt-focus-top-wrap {
          position: relative;
          z-index: 6;
          transform: scale(1.015);
          box-shadow:
            0 0 0 1px rgba(124,92,243,0.35),
            0 4px 14px rgba(124,92,243,0.16),
            0 8px 22px rgba(20,30,22,0.07);
          transition: transform 320ms ease 100ms, box-shadow 320ms ease 100ms;
        }
        /* Dim siblings of focus wrapper too */
        .rt-focus-on .rt-row-wrap:not(.rt-focus-top-wrap) {
          opacity: 0.06 !important;
          pointer-events: none !important;
          transition: opacity 280ms ease;
        }
        /* Dim bucket headers (TOMORROW / LATER labels) in focus mode */
        .rt-focus-on .rt-bucket-head {
          opacity: 0.06 !important;
          pointer-events: none !important;
          transition: opacity 280ms ease;
        }
        /* Dim the "Completed today" log (toggle button + expandable list)
           in focus mode. Its inner rows dim via the .rt-row rule, but the
           toggle button isn't an .rt-row and the wrapper isn't a direct
           grid child, so without this it stays bright. */
        .rt-focus-on .rt-completed-log {
          opacity: 0.06 !important;
          pointer-events: none !important;
          transition: opacity 280ms ease;
        }
        /* Dim the Tomorrow / Later bucket calendar widgets in focus mode.
           Wraps the Calendar toggle pill + its expanded event grid as a
           single unit, so the whole calendar surface fades together
           instead of leaving the toggle icon visible while the events
           hide. */
        .rt-focus-on .rt-bucket-cal {
          opacity: 0.06 !important;
          pointer-events: none !important;
          transition: opacity 280ms ease;
        }

        /* (rt-flash lightning animation removed — retired in favor of the
           calmer UI language. Focus mode now toggles silently.) */

        /* Today v4 — Grid layout, 3 breakpoints */
        /* Default: narrow desktop (901-1439px) — 2 cols, status + composer span full width, tasks + focus below */
        .rt-today-v4 {
          grid-template-columns: minmax(0, 1fr);
          grid-template-areas:
            "band"
            "composer"
            "tasks";
        }
        /* Desktop: hold the left content (tasks, composer, band) to the left
           portion so the dial's body shows to their right. Tasks get more room
           than before (52% was too cramped); composer + band stop before the
           dial rather than running full width under it. */
        /* The dial is a FIXED-width layer (~560px) anchored to the right edge,
           shown >1099px. The left content must reserve room for it as the
           screen shrinks, or tasks collide with the dial. Cap by both an
           absolute ceiling AND calc(100% - reserve) so the gap to the dial is
           preserved at every width. Tasks reserve the most (they must never
           overlap); composer/band reserve less since they intentionally fade
           UNDER the dial's faded edge. */
        /* Tasks bundle (band + composer + tasks-col) capped proportional to the
           dial: right edge sits 180px clear of the dial's visible left edge.
           Formula = viewport − sidebar-left(14) − sidebar width − sidebar-content-gap
                   − dial scaled width (720*scale) − gap(120).
           Falls back to scale 1 + content-sidebar-w 240 + gap 16 if vars don't resolve. */
        .rt-tasks-col,
        .rt-today-v4 > .rt-band,
        .rt-today-v4 > .rt-composer {
          max-width: calc(100vw - 14px - var(--content-sidebar-w, 240px) - var(--sidebar-content-gap, 16px) - (720px * var(--dial-scale, 1)) - 120px);
        }
        .rt-dial-help:hover .rt-dial-help-tip,
        .rt-dial-help:focus .rt-dial-help-tip { opacity: 1 !important; transform: translateY(0) !important; }
        /* Hub delete link — hidden by default, fades in on hub hover or when
           the delete button itself is focused (keyboard a11y). Destructive
           action on the most prominent dial element shouldn't sit permanently
           visible; revealing on intent (hover/focus) is the right register. */
        .rt-dial-hub-delete { opacity: 0; transition: opacity 140ms var(--rt-ease-out); }
        .rt-dial-hub:hover .rt-dial-hub-delete,
        .rt-dial-hub-delete:focus-within { opacity: 1; }
        /* Dial event row — full strip is the click target. Subtle gray wash
           on hover. The "next" event already has a sage bg painted via inline
           styles so it stays visually distinct. */
        /* Rail event row — full strip is the click target. Subtle grey
           wash on hover, matching the scrubbed-state indicator's hover
           treatment for consistency. Padding + border-radius give the
           hover a defined shape rather than bleeding to the rail edges. */
        .rt-dial-event-row { transition: background 120ms var(--rt-ease-out); }
        /* No hover background — the wide container extends well past the
           visible text content (230px wide vs ~140px of actual text), so
           painting bg on the container shows a misaligned rectangle to
           the left of the event. The cursor change + slight title color
           shift on hover (set inline below) carry the click affordance. */
        /* Counter-scale utility: elements inside the dial layer (which is scaled
           by var(--dial-scale)) that should render at a CONSTANT on-screen size
           regardless of scale. Cancels out the parent transform by 1/scale.
           Per-element transform-origin is set inline so positioning anchors
           correctly. */
        .rt-dial-cs { transform: scale(calc(1 / var(--dial-scale, 1))); }
        /* Controls sit in the gap, just left of the scaled dial's visible edge. */
        /* (Today/Tomorrow + Now controls now render inside the dial component
           at the disc's bottom-center, so they scale with the dial.) */
        /* Dial scales down on smaller screens (it's a fixed 720×888 composition;
           scaling the whole layer keeps every internal piece aligned). */
        .rt-today-v4 { --dial-scale: 0.90; }
        @media (max-width: 1600px) { .rt-today-v4 { --dial-scale: 0.82; } }
        @media (max-width: 1440px) { .rt-today-v4 { --dial-scale: 0.74; } }
        @media (max-width: 1300px) { .rt-today-v4 { --dial-scale: 0.64; } }
        @media (max-width: 1200px) { .rt-today-v4 { --dial-scale: 0.56; } }
        @media (max-height: 860px) { .rt-today-v4 { --dial-scale: 0.72; } }
        @media (max-height: 760px) { .rt-today-v4 { --dial-scale: 0.62; } }
        @media (max-height: 680px) { .rt-today-v4 { --dial-scale: 0.52; } }
        /* Connect Google Calendar nudge — dotted underline on rest,
           solid on hover. Primary green to match the rest of the link
           treatment sitewide. */
        .rt-gcal-connect-link:hover {
          text-decoration-style: solid !important;
          text-decoration-color: #33543E !important;
        }
        @media (max-width: 1099px) {
          .rt-dial-layer { display: none !important; }
          .rt-dial-controls { display: none !important; }
          .rt-tasks-col { max-width: none !important; }
          .rt-today-v4 > .rt-band,
          .rt-today-v4 > .rt-composer { max-width: none !important; }
        }
        .rt-mob-strip { display: none; }
        @media (max-width: 1099px) {
          .rt-today-v4 {
            grid-template-columns: 1fr;
            grid-template-areas:
              "band"
              "composer"
              "tasks";
          }
          .rt-focus-col { display: none !important; }
          .rt-rai-col { display: none !important; }
        }
        @media (max-width: 900px) {
          /* Mobile band — condensed Option 1 layout. */
          .rt-band {
            display: flex !important;
            flex-direction: column !important;
            position: relative !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
          }
          /* Mobile-specific compressions on top of the now-universal
             flat meta row: hide the "OF TODAY DONE" label (number alone
             is enough at narrow widths), shrink the pct number, slightly
             tighter gap. */
          .rt-band-meta { flex-wrap: nowrap !important; gap: 10px !important; }
          .rt-band-sub { font-size: 12.5px !important; }
          .rt-pct-lbl { display: none !important; }
          .rt-pct-num { font-size: 13px !important; }
          .rt-pct-num > span { font-size: 11px !important; }
          /* Composer Row 2: let Add Task wrap to its own line on mobile
             so it can never be clipped off the right edge. The .rt-composer-controls
             takes the full row at flex-basis 100%, pushing the button
             below. Button anchors right (closer to the thumb) — left of
             the row stays empty, button stays compact. */
          .rt-composer-controls {
            flex: 0 0 100% !important;
            width: 100%;
          }
          .rt-add-task-btn {
            margin-left: auto !important;
            margin-right: 0 !important;
          }
          .rt-composer-pill { padding: 6px 8px !important; gap: 4px !important; }
          .rt-composer-pill span { font-size: 11.5px !important; }
          .rt-row-meta span:nth-child(n+4) { display: none !important; }
          /* DUE PICKER ON MOBILE — fixed, full content width (16px
             gutters = composer width/position). Vertical position is set
             inline from the Due chip's measured rect so it sits right
             under the composer, attached. Inline top + bottom:auto
             override the fallback bottom below (used only if JS hasn't
             measured yet). Cannot clip horizontally — gutters are fixed. */
          .rt-due-picker {
            position: fixed !important;
            left: 16px !important;
            right: 16px !important;
            bottom: 84px;
            margin: 0 !important;
            width: auto !important;
            min-width: 0 !important;
            max-width: none !important;
            max-height: 60vh !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            box-shadow:
              0 1px 3px rgba(20, 30, 22, 0.10),
              0 12px 32px rgba(20, 30, 22, 0.18) !important;
          }
          /* Compact calendar cells on mobile so the grid stays tight and
             the picker reads as a small popover, not a page. */
          .rt-due-picker [role="grid"] button,
          .rt-due-picker > div > div > div > button {
            height: 30px !important;
            font-size: 12px !important;
          }
        }
        /* Rai pick clamp + fade — universal (desktop AND mobile).
           The whole pick block is the tap target; cursor:pointer
           communicates affordance. The ::after gradient fades the
           bottom-right so the 2-line clamp reads as a soft fall-off,
           not a hard cut. Tapping toggles .is-clamped ↔ .is-expanded.
           The client-name link inside uses stopPropagation so tapping
           the client routes to the composer instead. */
        .rt-band-pick { /* plain text — only the client name span is clickable */ }
        .rt-band-pick.is-clamped {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .rt-band-pick.is-clamped::after {
          content: '';
          position: absolute;
          right: 0;
          bottom: 0;
          width: 120px;
          height: 1.5em;
          background: linear-gradient(90deg, rgba(250,250,247,0) 0%, var(--rt-bg) 65%, var(--rt-bg) 100%);
          pointer-events: none;
        }
        /* ── COMPOSER CHIPS — Client / Worker / Due ──
           Each chip is its own soft-shadow card with hover lift + press
           scale. Matches the Add Task button's shape and motion language.
           Filled state (inline background: C.btnLight from JSX) wins via
           inline precedence; on .is-filled it gets a purple-tinted shadow
           so the filled state reads as polished too. */
        .rt-composer-pill {
          /* Path C — outlined, flat. The chips don't elevate (no shadow,
             no card-bg), they're defined by their edge. Lives confidently
             on the flat page without needing a container to be lifted
             from. Fully rounded (pill shape, borderRadius 999) reinforces
             that they're discrete affordances, not embedded form fields.
             The !important overrides the inline borderRadius:8 / border:
             none that the four chip buttons set individually — cheaper
             than patching all four call sites. */
          background: transparent !important;
          box-shadow: none !important;
          border: 1px solid rgba(20,30,22,0.12) !important;
          border-radius: 999px !important;
          transition: background 160ms var(--rt-ease-out),
                      border-color 160ms var(--rt-ease-out),
                      color 160ms var(--rt-ease-out);
        }
        .rt-composer-pill:hover {
          background: rgba(20,30,22,0.03) !important;
          border-color: rgba(20,30,22,0.20) !important;
          box-shadow: none !important;
          transform: none !important;
          color: var(--rt-text);
        }
        .rt-composer-pill:active {
          transform: scale(0.98);
          transition: transform 80ms var(--rt-ease-press);
        }
        .rt-composer-pill.is-filled {
          /* Filled state — slightly stronger border to indicate selection
             without going back to a filled bg (which would clash with the
             flat treatment). The avatar / value text carries the personality. */
          border-color: rgba(20,30,22,0.25) !important;
        }
        /* Recurring frequency chips inside the Due picker — share the
           composer-pill motion language (idle xs-shadow, hover lift,
           press scale). Idle vs active surfaces are set inline at the
           call site so the class only carries motion, not state. */
        .rt-rec-chip {
          transition: box-shadow 200ms var(--rt-ease-out),
                      transform 200ms var(--rt-ease-out),
                      background 200ms var(--rt-ease-out),
                      color 200ms var(--rt-ease-out);
        }
        .rt-rec-chip:hover {
          transform: translateY(-1px);
        }
        .rt-rec-chip:not(.is-active):hover {
          box-shadow: 0 1px 2px rgba(20,30,22,0.05), 0 2px 6px rgba(20,30,22,0.06) !important;
        }
        .rt-rec-chip:active {
          transform: translateY(0) scale(0.97);
          transition: transform 80ms var(--rt-ease-press);
        }
        /* Wide desktop (>=1500px): 3 cols — notes (daybook) joins only
           when there's genuine room. Below this, tasks + calendar share
           the width and notes stays hidden so it never crowds out what
           matters. Raised to 1700 (at 1500 the timeline + notes together
           pinched the task column; notes is lowest-priority so it waits for
           genuinely comfortable width). */
        @media (min-width: 1700px) {
          .rt-today-v4 {
            grid-template-columns: minmax(0, 1fr);
            grid-template-rows: auto auto 1fr;
            grid-template-areas:
              "band"
              "composer"
              "tasks";
          }
          .rt-rai-col {
            display: flex !important;
            /* Critical: decouple Rai height from grid row math. min-height: 0 +
               max-height lets the sticky panel grow with its own scroller instead
               of inflating the composer row when content is long. */
            min-height: 0 !important;
            max-height: calc(100vh - 40px);
            overflow: hidden;
          }
          /* The right-column Rai brief now shows the full reason_detail, so the
             band's inline More/Less expand is redundant at this width — hide it. */
          .rt-band-more { display: none !important; }
        }
        /* Clients v2 grid — 2 cols narrow desktop, 3 cols wide (>=1440) */
        .rc-grid { grid-template-columns: 240px minmax(0, 1fr); }
        @media (max-width: 900px) {
          .rc-grid { grid-template-columns: 1fr !important; }
          .rc-rai-col { display: none !important; }
          .rc-rail { position: static !important; }
        }
        @media (max-width: 768px) {
          .rc-rail { display: none !important; }
          .rc-view-toggle { display: none !important; }
          .rc-desktop-view { display: none !important; }
          .rc-mobile-list { display: block !important; }
          .rt-mob-strip { display: block !important; }
          .rc-sort-renewal { display: none !important; }
          .rt-mob-cal-trigger { display: none !important; }
          .rt-mob-cal-sheet { display: none !important; }
          .rt-mob-cal-sheet-band { display: block !important; grid-area: calstrip !important; }
          /* The sky strip renders date+greeting itself on mobile, so hide the
             band's duplicate copy. */
          .rt-band-greet { display: none !important; }
          /* Tighten the row gap so "Today's client" sits 12px under the sky
             header instead of the 20px desktop grid gap (the greeting used to
             fill this space; now it's in the strip, so the gap read as too low). */
          .rt-today-v4 { row-gap: 8px !important; }
          .rt-today-v4 {
            grid-template-areas: "calstrip" "band" "tasks" !important;
          }
          /* Composer hidden on mobile — the center "+" FAB in the bottom nav
             covers quick-capture, so the inline composer is redundant and eats
             vertical space. Hidden only (no deletion); removed from the grid
             template above so its row collapses rather than leaving a gap. */
          .rt-composer { display: none !important; }
          .rt-composer-hint { display: none !important; }
          /* Composer selected-client chip: avatar only on mobile, name hidden */
          .rt-composer-client-name { display: none !important; }
        }
        /* Container query on the composer itself: when the composer is narrow
           (proportional to dial scale + sidebar state), hide the long hint so
           Client / Worker / Date / Add stay in one row without overflow. The
           Add button has margin-left: auto inline, so when the row wraps it
           naturally drops to its own line and stays anchored to the right. */
        @container (max-width: 620px) {
          .rt-composer-hint { display: none !important; }
        }
        @media (max-width: 640px) {
          /* Task right-side indicators on mobile — ALL pills render as one
             standardized circle: same width/height, icon centered, no text,
             no chevron. Applies to recurring (∞), Today, Tomorrow/Later, and
             overdue alike so the right edge is visually uniform. */
          .rt-row-text { display: none !important; }
          .rt-due-chevron { display: none !important; }
          .rt-row-recur,
          .rt-row-due.rt-due-today,
          .rt-row-due.rt-due-overdue,
          .rt-row-due.rt-due-future {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: 26px !important;
            height: 26px !important;
            padding: 0 !important;
            gap: 0 !important;
            border-radius: 999px !important;
            box-sizing: border-box !important;
          }
        }
        /* Clients table responsive — progressively hide optional columns
           as horizontal space shrinks. Order is by signal density: cadence
           pips + renews countdown first (visual but tangential), then trend
           sparkline (nice-to-have), then LCV (redundant with revenue at
           the squeezed end). Client name + score + revenue + tenure are
           always shown above 768px. */
        @media (max-width: 1200px) {
          .rt-tcol-cadence,
          .rt-tcol-renews { display: none !important; }
        }
        @media (max-width: 1024px) {
        }
        @media (max-width: 900px) {
          .rt-tcol-lcv { display: none !important; }
        }
        @media (min-width: 769px) {
          .rc-mobile-list { display: none !important; }
          /* Events dropdown is mobile-only — on desktop the button reads as plain text */
          .rt-band-sub-events-chev { display: none !important; }
          .rt-band-sub-events { cursor: default !important; pointer-events: none !important; }
        }
        @media (min-width: 1440px) {
          /* Rai brief / right rail removed — main content stretches to fill.
             Both grid variants are now 2-col (240px nav + flexible main); the
             .rc-rai-col panels are hidden everywhere. */
          .rc-grid { grid-template-columns: 240px minmax(0, 1fr); }
          .rc-grid.rc-grid-2col { grid-template-columns: 240px minmax(0, 1fr); }
          .rc-rai-col { display: none !important; }
        }
        @keyframes rt-slideover-in {
          from { transform: translateX(40px); opacity: 0.5; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fwLaunch {
          0% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(-40vh); opacity: 1; }
        }
        @keyframes fwBurst {
          0% { transform: translate(0,0) scale(0); opacity: 1; }
          20% { opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(0.3); opacity: 0; }
        }
        @keyframes fwGlow {
          0% { transform: scale(0); opacity: 0.8; }
          50% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes fwSparkle {
          0%,100% { opacity: 0; transform: scale(0.5); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

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
          {(tier === "enterprise" ? navItemsEnterprise : navItemsCore).map(n => {
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
        {page === "sweeps" && tier === "enterprise" && <SweepsPage app={pageCtx} />}

        {/* ═══ CLIENTS v2 — compare-first ═══ */}
        {dataLoaded && page === "clients" && <ClientsPage app={pageCtx} />}

        {/* ═══ HEALTH CHECKS ═══ */}
        {dataLoaded && page === "health" && <HealthPage app={pageCtx} />}

        {/* ═══ REFERRAL INTELLIGENCE (ENTERPRISE) ═══ */}
        {page === "referral_intel" && tier === "enterprise" && <ReferralIntelPage app={pageCtx} />}

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
      {selectedClient && (() => {
        const sc = selectedClient;
        const dims = sc.profileScores || {};
        const dimLabels = { trust: ["Trust", "Heavy oversight", "Full delegation"], loyalty: ["Loyalty", "Actively shopping", "Locked in, not looking"], expectations: ["Expectations", "Highly ambitious", "Reasonable, aligned"], grace: ["Grace", "Zero tolerance", "Gives benefit of the doubt"], commFrequency: ["Communication Frequency", "Radio silence", "Nonstop"], stressResponse: ["Stress Response", "Goes quiet internally", "Immediately escalates"], budgetCommitment: ["Budget Commitment", "Always under pressure", "Non-issue"], relationshipDepth: ["Relationship Depth", "Strictly transactional", "Genuine connection"], reportingNeed: ["Reporting Need", "Hands-off, minimal updates", "Wants every detail"], replaceability: ["Replaceability", "Plug and play", "Deeply embedded"], commTone: ["Communication Tone", "Reserved, guarded", "Warm, direct"], decisionMaking: ["Decision Making", "No authority, just a relay", "Full authority"] };

        // Hero+ helpers
        const _driftRaw = clientDrift[sc.name] || (sc.ret ? (sc.ret >= 80 ? "Thriving" : sc.ret >= 65 ? "Stable" : sc.ret >= 45 ? "Shifted" : "Declining") : "Stable");
        const _driftLabel = _driftRaw === "Something shifted" ? "Shifted" : _driftRaw;
        const _driftMeta = {
          Thriving:  { fg: C.retElite, bg: C.primaryGhost },
          Stable:    { fg: C.retGood,  bg: C.primaryGhost },
          Healthy:   { fg: C.retGood,  bg: C.primaryGhost },
          Watch:     { fg: C.retOk,    bg: "#FAF8EC" },
          Shifted:   { fg: C.retWarn,  bg: "#FBF1E2" },
          "At Risk": { fg: C.retWarn,  bg: "#FBF1E2" },
          Declining: { fg: C.retCrit,  bg: "#FBEAE3" },
          Critical:  { fg: C.retCrit,  bg: "#FBEAE3" },
        }[_driftLabel] || { fg: C.textSec, bg: C.bg };
        const _bucket = sc.ret ? (sc.ret >= 80 ? "Thriving" : sc.ret >= 65 ? "Healthy" : sc.ret >= 45 ? "Watch" : sc.ret >= 30 ? "At Risk" : "Critical") : "New";

        return (
          <>
            {/* Slide-over backdrop — dim + blur the list/page behind so
                the slide-over reads as floating clearly above its
                context. Previously just a flat 32% dark wash; now adds
                a 2px gaussian blur via backdrop-filter, which gives a
                real depth field on Safari/Chrome. Browsers without
                backdrop-filter (Firefox without flag) fall back to the
                flat dim — no breakage. */}
            <div onClick={() => setSelectedClient(null)} style={{ position: "fixed", inset: 0, background: "rgba(20,30,22,0.38)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)", zIndex: 90 }} />
            <div className="r-client-modal" style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "100%", maxWidth: 520, maxHeight: "90vh", background: C.card, boxShadow: "0 1px 3px rgba(20,30,22,0.10), 0 8px 20px rgba(20,30,22,0.14), 0 25px 50px rgba(20,30,22,0.22), inset 0 1px 0 rgba(255,255,255,0.9)", zIndex: 100, overflowY: "auto", borderRadius: 16 }}>
              {/* Top bar — neighbor nav (↑↓) on left, position breadcrumb
                  in the middle, X close on right. ↑↓ navigate through the
                  full clients array with wraparound; clicking either just
                  calls setSelectedClient(next), which swaps content in
                  place — no close/reopen. */}
              {(() => {
                const navList = (clients || []).filter(c => c && c.id && !c.archived_at);
                const currentIdx = navList.findIndex(c => c.id === sc.id);
                const total = navList.length;
                const hasNav = total > 1 && currentIdx >= 0;
                const goPrev = () => {
                  if (!hasNav) return;
                  const next = navList[currentIdx === 0 ? total - 1 : currentIdx - 1];
                  if (next) setSelectedClient(next);
                };
                const goNext = () => {
                  if (!hasNav) return;
                  const next = navList[currentIdx === total - 1 ? 0 : currentIdx + 1];
                  if (next) setSelectedClient(next);
                };
                const prevClient = hasNav ? navList[currentIdx === 0 ? total - 1 : currentIdx - 1] : null;
                const nextClient = hasNav ? navList[currentIdx === total - 1 ? 0 : currentIdx + 1] : null;
                return (
                  <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, position: "sticky", top: 0, background: C.card, zIndex: 1, borderBottom: "1px solid " + C.borderLight }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                      <button onClick={goPrev} disabled={!hasNav} title={prevClient ? `Previous · ${prevClient.name}` : "Previous client"} aria-label="Previous client" className="rt-so-nav" style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", color: hasNav ? C.textSec : C.textMuted, cursor: hasNav ? "pointer" : "default", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16, lineHeight: 1, padding: 0, position: "relative" }}>
                        ↑
                        {prevClient && (
                          <span className="rt-so-preview">
                            <span className="rt-so-preview-kicker">Prev</span>
                            <span>{prevClient.name}</span>
                          </span>
                        )}
                      </button>
                      <button onClick={goNext} disabled={!hasNav} title={nextClient ? `Next · ${nextClient.name}` : "Next client"} aria-label="Next client" className="rt-so-nav" style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", color: hasNav ? C.textSec : C.textMuted, cursor: hasNav ? "pointer" : "default", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16, lineHeight: 1, padding: 0, position: "relative" }}>
                        ↓
                        {nextClient && (
                          <span className="rt-so-preview">
                            <span className="rt-so-preview-kicker">Next</span>
                            <span>{nextClient.name}</span>
                          </span>
                        )}
                      </button>
                    </div>
                    {hasNav && (
                      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: C.textMuted, fontVariantNumeric: "tabular-nums", display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span>Client</span>
                        <span style={{ opacity: 0.5 }}>·</span>
                        <span>{currentIdx + 1} of {total}</span>
                      </div>
                    )}
                    {/* Overflow menu (Edit / Pause / Remove). Replaces the old
                        sticky bottom footer — actions live in a discoverable
                        ⋯ menu instead of taking permanent vertical real estate. */}
                    <div style={{ marginLeft: "auto", position: "relative", display: "flex", alignItems: "center", gap: 6 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setClientMenuOpen(v => !v); }}
                        aria-label="Client actions"
                        style={{
                          background: clientMenuOpen ? C.surfaceWarm : "none",
                          border: "none",
                          fontSize: 20,
                          cursor: "pointer",
                          color: clientMenuOpen ? C.text : C.textSec,
                          lineHeight: 1,
                          padding: 0,
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          transition: "background 120ms ease",
                        }}
                      >⋯</button>
                      {clientMenuOpen && (
                        <>
                          {/* Click-outside catcher — sits behind menu, captures
                              any click that isn't on the menu itself. */}
                          <div
                            onClick={() => setClientMenuOpen(false)}
                            style={{ position: "fixed", inset: 0, zIndex: 4 }}
                          />
                          <div style={{
                            position: "absolute",
                            top: 36,
                            right: 0,
                            background: C.card,
                            border: "1px solid " + C.borderLight,
                            borderRadius: 10,
                            boxShadow: "0 8px 24px rgba(20,30,22,0.12), 0 2px 6px rgba(20,30,22,0.06)",
                            minWidth: 180,
                            padding: 6,
                            zIndex: 5,
                          }}>
                            <div
                              onClick={() => {
                                setClientMenuOpen(false);
                                setClientTab("overview");
                                setEditingOverview(true);
                                setOverviewEditData({ contact: sc.contact, role: sc.role, tag: sc.tag, months: sc.months, revenue: sc.revenue, lifetime_revenue_at_entry: sc.lifetime_revenue_at_entry || 0, renewal_date: sc.renewal_date || "", renewal_recurrence: sc.renewal_recurrence || "none" });
                              }}
                              style={{ padding: "10px 12px", fontSize: 13, color: C.text, cursor: "pointer", borderRadius: 6, fontWeight: 500 }}
                              onMouseEnter={e => e.currentTarget.style.background = C.surfaceWarm}
                              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                            >Edit details</div>
                            <div
                              onClick={() => {
                                setClientMenuOpen(false);
                                setClientTab("overview");
                                if (sc.is_paused) { setResumeConfirm(true); }
                                else { setPauseConfirm(true); }
                                setRolodexConfirm(false); setRemoveConfirm(false);
                              }}
                              style={{ padding: "10px 12px", fontSize: 13, color: C.text, cursor: "pointer", borderRadius: 6, fontWeight: 500 }}
                              onMouseEnter={e => e.currentTarget.style.background = C.surfaceWarm}
                              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                            >{sc.is_paused ? "Resume client" : "Pause client"}</div>
                            <div style={{ borderTop: "1px solid " + C.borderLight, margin: "4px 0" }} />
                            <div
                              onClick={() => {
                                setClientMenuOpen(false);
                                setClientTab("overview");
                                setRolodexConfirm(true);
                                setPauseConfirm(false); setResumeConfirm(false); setRemoveConfirm(false);
                              }}
                              style={{ padding: "10px 12px", fontSize: 13, color: C.danger, cursor: "pointer", borderRadius: 6, fontWeight: 500 }}
                              onMouseEnter={e => e.currentTarget.style.background = C.surfaceWarm}
                              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                            >Remove client</div>
                          </div>
                        </>
                      )}
                      <button onClick={() => setSelectedClient(null)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.textMuted, lineHeight: 1, padding: 0, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                    </div>
                  </div>
                );
              })()}

              {/* Hero — gradient band: eyebrow meta · name · delta · score */}
              <div style={{ padding: "20px 20px 14px", background: "linear-gradient(180deg, " + C.surfaceWarm + " 0%, " + C.card + " 100%)" }}>
                {/* Eyebrow: industry · tenure */}
                <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, marginBottom: 6 }}>
                  {sc.tag || "Client"}{sc.months ? " · with you " + (sc.months >= 12 ? (sc.months / 12).toFixed(1) + " years" : sc.months + " months") : ""}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, color: C.text, margin: 0, lineHeight: 1.15 }}>{sc.name}</h2>
                    {(() => {
                      // Pause status line: "Currently paused since May 4 · 2 previous pauses"
                      // Renders only when relevant — if a client has never been paused,
                      // skip the line entirely to keep the header clean.
                      const pauses = engagementPausesByClient[sc.id] || [];
                      if (pauses.length === 0) return null;
                      const openPause = pauses.find(p => !p.resumed_at);
                      const previousCount = pauses.filter(p => p.resumed_at).length;
                      const fmtDate = (d) => {
                        try {
                          return new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString(undefined, { month: "short", day: "numeric" });
                        } catch { return d; }
                      };
                      const parts = [];
                      if (openPause) parts.push("Currently paused since " + fmtDate(openPause.paused_at));
                      if (previousCount > 0) parts.push(previousCount + " previous pause" + (previousCount === 1 ? "" : "s"));
                      if (parts.length === 0) return null;
                      return (
                        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4, fontWeight: 500 }}>
                          {parts.join(" · ")}
                        </div>
                      );
                    })()}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                      {sc.ret ? (
                        <span style={{ fontSize: 11.5, fontWeight: 700, padding: "4px 11px", borderRadius: 999, color: _driftMeta.fg, background: _driftMeta.bg, fontVariantNumeric: "tabular-nums" }}>
                          {_driftLabel}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11.5, fontWeight: 700, padding: "4px 11px", borderRadius: 999, color: C.textSec, background: C.bg }}>First check pending</span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    {sc.ret ? (
                      <>
                        <div style={{ fontSize: 44, fontWeight: 800, color: retColor(sc.ret), letterSpacing: -1.6, lineHeight: 0.9, fontVariantNumeric: "tabular-nums" }}>{sc.ret}</div>
                        <div style={{ fontSize: 9.5, fontWeight: 700, color: C.textMuted, letterSpacing: 1.2, marginTop: 6, textTransform: "uppercase" }}>{_bucket}</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 22, fontWeight: 700, color: C.textMuted, letterSpacing: -0.5 }}>New</div>
                    )}
                  </div>
                </div>

              </div>

              {/* Stat strip — MRR · LTV · Tenure */}
              {sc.ret && (
                <div style={{ display: "flex", padding: "14px 20px", background: C.surfaceWarm, borderTop: "1px solid " + C.borderLight, borderBottom: "1px solid " + C.borderLight }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase" }}>MRR</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>${(sc.revenue / 1000).toFixed(1)}k</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase" }}>LTV</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>${Math.round(getAdjustedLTV(sc) / 1000)}k</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase" }}>Tenure</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{sc.months >= 12 ? (sc.months / 12).toFixed(1) + " yr" : sc.months + " mo"}</div>
                  </div>
                </div>
              )}

              {/* Rai involvement — Managed (Rai helps: scores, suggests tasks,
                  flags, can pick) vs Advisory (Rai keeps score only — no tasks,
                  no flags, never picked). For clients the user handles on their
                  own / on an unusual cadence, so Rai stops false-positive nags. */}
              {(() => {
                const mode = sc.rai_mode || "managed";
                const setMode = (next) => {
                  if (next === mode) return;
                  setSelectedClient(prev => prev ? { ...prev, rai_mode: next } : prev);
                  setClients(prev => prev.map(c => c.id === sc.id ? { ...c, rai_mode: next } : c));
                  clientsDb.update(sc.id, { rai_mode: next }).then(({ error }) => {
                    if (error) {
                      console.error("Failed to save rai_mode:", error);
                      setSelectedClient(prev => prev ? { ...prev, rai_mode: mode } : prev);
                      setClients(prev => prev.map(c => c.id === sc.id ? { ...c, rai_mode: mode } : c));
                    }
                  });
                };
                return (
                  <div style={{ padding: "14px 20px", borderTop: sc.ret ? "none" : "1px solid " + C.borderLight, borderBottom: "1px solid " + C.borderLight, background: C.surfaceWarm }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase" }}>Rai's role</div>
                        <div style={{ fontSize: 12, color: C.textSec, marginTop: 3, lineHeight: 1.4 }}>
                          {mode === "managed"
                            ? "Rai helps manage this client — suggests tasks and flags risks."
                            : "Rai keeps score only — no tasks or flags. You've got this one."}
                        </div>
                      </div>
                      <div style={{ display: "inline-flex", background: C.surface, borderRadius: 999, padding: 3, flexShrink: 0 }}>
                        {[["managed", "Managed"], ["advisory", "Advisory"]].map(([val, label]) => (
                          <button
                            key={val}
                            onClick={() => setMode(val)}
                            style={{
                              padding: "6px 12px", borderRadius: 999, border: "none", cursor: "pointer",
                              fontFamily: "inherit", fontSize: 12, fontWeight: 600,
                              ...(mode === val
                                ? { background: C.card, color: C.text, boxShadow: "var(--rt-sh-xs)" }
                                : { background: "transparent", color: C.textMuted }),
                            }}
                          >{label}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div style={{ padding: "16px 20px 0" }}>
                <div style={{ display: "flex", gap: 0, background: C.surface, borderRadius: 10, padding: 3 }}>
                  {["Overview", "Profile", "Billing", "Flags", "Rai"].map(t => {
                    const isActive = clientTab === t.toLowerCase();
                    return (
                      <button key={t} onClick={() => setClientTab(t.toLowerCase())} style={{
                        flex: 1, padding: "10px", borderRadius: 8, border: "none",
                        background: isActive ? C.card : "transparent",
                        color: isActive ? C.text : C.textMuted,
                        fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                        boxShadow: isActive ? "var(--rt-sh-card-lift)" : "none",
                        transform: isActive ? "translateY(-0.5px)" : "none",
                        transition: "background 0.15s ease, color 0.15s ease, box-shadow 180ms var(--rt-ease-out), transform 180ms var(--rt-ease-out)",
                      }}>{t}</button>
                    );
                  })}
                </div>
              </div>

              <div style={{ padding: "16px 20px" }}>
                {/* Overview */}
                {clientTab === "overview" && (
                  <div>
                    {!editingOverview ? (
                      <>
                        {(() => {
                          const pendingHc = hcQueue.find(h => h.client === sc.name);
                          const hcValue = (() => {
                            if (!pendingHc) return sc.lastHC ? "Last: " + sc.lastHC : "Pending";
                            if (pendingHc.overdue > 0) return `Overdue by ${pendingHc.overdue}d`;
                            if (pendingHc.due === "Today") return "Due today";
                            return `In ${pendingHc.daysUntil}d`;
                          })();
                          const canStartEarly = pendingHc && pendingHc.isFirstHC && pendingHc.overdue === 0 && pendingHc.due !== "Today";
                          return (
                            <>
                              {[
                                { l: "Contact",      v: sc.contact || "—" },
                                { l: "Role",         v: sc.role || "—" },
                              ].map((d, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid " + C.borderLight }}>
                                  <span style={{ fontSize: 14, color: C.textSec }}>{d.l}</span>
                                  <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{d.v}</span>
                                </div>
                              ))}
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid " + C.borderLight, gap: 10 }}>
                                <span style={{ fontSize: 14, color: C.textSec }}>Health Check</span>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{hcValue}</span>
                                  {canStartEarly && (
                                    <button onClick={() => { setPage("health"); setHcOpen(sc.name); setSelectedClient(null); }} style={{ background: "none", border: "none", padding: 0, fontSize: 12, fontWeight: 600, color: C.btn, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
                                      Start early
                                    </button>
                                  )}
                                </div>
                              </div>
                              {[
                                { l: "Referrals",    v: sc.referrals || 0 },
                                { l: "Renewal",      v: sc.renewal_date ? (new Date(sc.renewal_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) + (sc.renewal_recurrence && sc.renewal_recurrence !== "none" ? " · " + ({ monthly: "Monthly", quarterly: "Quarterly", annual: "Annual" }[sc.renewal_recurrence] || "") : "")) : "Set renewal", muted: !sc.renewal_date, onClick: () => { setRenewalModalMonth(sc.renewal_date ? sc.renewal_date.slice(0, 7) : (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })()); setRenewalModal({ client: sc, date: sc.renewal_date ? sc.renewal_date.slice(0, 10) : "", recurrence: sc.renewal_recurrence || "none" }); } },
                              ].map((d, i) => (
                                <div key={i} onClick={d.onClick} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid " + C.borderLight, cursor: d.onClick ? "pointer" : "default" }}>
                                  <span style={{ fontSize: 14, color: C.textSec }}>{d.l}</span>
                                  <span style={{ fontSize: 14, fontWeight: 600, color: d.muted ? C.btn : C.text }}>{d.v}{d.onClick && <span style={{ marginLeft: 6, fontSize: 11, color: C.textMuted }}>›</span>}</span>
                                </div>
                              ))}
                            </>
                          );
                        })()}
                        {/* Recent activity — last 7 days. Pulls from completed
                            tasks and logged touchpoints for this client. Empty
                            state suppresses entirely so a brand-new client
                            doesn't render an empty container. */}
                        {(() => {
                          const NOW = Date.now();
                          const SEVEN_D = 7 * 24 * 60 * 60 * 1000;

                          // Recurring tasks have their tasks.completed_at nulled
                          // by the midnight rollover, so the in-memory tasks
                          // array only carries TODAY's recurring completions.
                          // Need an immutable history source for the 7d window.
                          //
                          // Phase 3 cutover via `client_recent_activity` flag:
                          //   - flag ON  → task_occurrences (new model)
                          //   - flag OFF → workerCompletions / task_completions (old)
                          const useOccurrences = occurrenceFlags.client_recent_activity === true;

                          const taskEventsToday = (tasks || [])
                            .filter(t => t.client === sc.name && t.done && t.completed_at)
                            .map(t => {
                              const ts = new Date(t.completed_at).getTime();
                              return { ts, kind: "task", text: t.text, _taskId: t.id, _ymd: new Date(t.completed_at).toISOString().slice(0, 10) };
                            })
                            .filter(e => (NOW - e.ts) <= SEVEN_D);

                          const todayDedupeKeys = new Set(taskEventsToday.map(e => `${e._taskId}|${e._ymd}`));

                          const historySource = useOccurrences
                            ? (taskOccurrences || [])
                                .filter(o =>
                                  (o.client_name === sc.name || o.client_id === sc.id) &&
                                  o.is_done &&
                                  o.completed_at
                                )
                                .map(o => ({
                                  ts: new Date(o.completed_at).getTime(),
                                  kind: "task",
                                  text: o.task_text,
                                  _taskId: o.task_id,
                                  _ymd: o.occurrence_date,
                                }))
                            : (workerCompletions || [])
                                .filter(c => (c.client_name === sc.name || c.client_id === sc.id) && c.completed_at)
                                .map(c => ({
                                  ts: new Date(c.completed_at).getTime(),
                                  kind: "task",
                                  text: c.task_text,
                                  _taskId: c.task_id,
                                  _ymd: new Date(c.completed_at).toISOString().slice(0, 10),
                                }));

                          const taskEventsHistory = historySource
                            .filter(e => (NOW - e.ts) <= SEVEN_D)
                            .filter(e => !todayDedupeKeys.has(`${e._taskId}|${e._ymd}`));

                          const taskEvents = [...taskEventsToday, ...taskEventsHistory];

                          const tpEvents = (allTouchpoints || [])
                            .filter(tp => (tp.client_name === sc.name || tp.client_id === sc.id) && tp.occurred_at)
                            .map(tp => {
                              const ts = new Date(tp.occurred_at).getTime();
                              return { ts, kind: "touchpoint", text: tp.channel || "Touchpoint" };
                            })
                            .filter(e => (NOW - e.ts) <= SEVEN_D);

                          const events = [...taskEvents, ...tpEvents].sort((a, b) => b.ts - a.ts).slice(0, 6);
                          if (events.length === 0) return null;

                          const relTime = (ts) => {
                            const diff = NOW - ts;
                            const hours = Math.floor(diff / (60 * 60 * 1000));
                            if (hours < 1) return "just now";
                            if (hours < 24) return hours + "h ago";
                            const days = Math.floor(hours / 24);
                            if (days === 1) return "yesterday";
                            return days + "d ago";
                          };

                          return (
                            <div style={{ marginTop: 18 }}>
                              <div style={{ fontSize: 10.5, fontWeight: 700, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 8 }}>Recent activity · 7d</div>
                              <div style={{ background: C.bg, borderRadius: 10, padding: 4 }}>
                                {events.map((e, i) => (
                                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderTop: i > 0 ? "1px solid " + C.borderLight : "none" }}>
                                    <div style={{
                                      width: 22, height: 22, borderRadius: "50%",
                                      background: e.kind === "task" ? C.primarySoft : C.surface,
                                      color: e.kind === "task" ? C.primary : C.textMuted,
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                      fontSize: 11, fontWeight: 700, flexShrink: 0,
                                    }}>
                                      {e.kind === "task" ? "✓" : "·"}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      <span style={{ color: C.text, fontWeight: 600 }}>
                                        {e.kind === "task" ? "Task done" : (e.text || "Touchpoint")}
                                      </span>
                                      {e.kind === "task" && e.text ? <span>: {e.text}</span> : null}
                                    </div>
                                    <div style={{ fontSize: 11, color: C.textMuted, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{relTime(e.ts)}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Edit Client Details</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <div>
                            <label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Company name</label>
                            <input value={overviewEditData.name ?? sc.name} onChange={e => setOverviewEditData({ ...overviewEditData, name: e.target.value })} style={{ width: "100%", padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg }} />
                          </div>
                          {[{ key: "contact", label: "Contact name" }, { key: "role", label: "Role" }, { key: "tag", label: "Industry" }].map(f => (
                            <div key={f.key}>
                              <label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>{f.label}</label>
                              <input value={overviewEditData[f.key] || ""} onChange={e => setOverviewEditData({ ...overviewEditData, [f.key]: e.target.value })} style={{ width: "100%", padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg }} />
                            </div>
                          ))}
                          <div>
                            <label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Months together</label>
                            <input type="number" value={overviewEditData.months || 0} onChange={e => setOverviewEditData({ ...overviewEditData, months: parseInt(e.target.value) || 0 })} style={{ width: "100%", padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Current monthly rate ($)</label>
                            <input type="number" value={overviewEditData.revenue || 0} onChange={e => setOverviewEditData({ ...overviewEditData, revenue: parseInt(e.target.value) || 0 })} style={{ width: "100%", padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg }} />
                            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, lineHeight: 1.4 }}>
                              Your best estimate of monthly revenue. Changing this will not affect prior months.
                            </div>
                          </div>
                          {/* Revenue change reason — only revealed when the rate actually
                              differs from the current saved value. Optional. Lets Rai see
                              the narrative behind movement (expansion, contraction, etc)
                              rather than just the numbers. */}
                          {Number(overviewEditData.revenue || 0) !== Number(sc.revenue || 0) && (
                            <div style={{ background: C.surfaceWarm, borderRadius: 8, padding: "12px" }}>
                              <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>Why is the rate changing? (optional)</label>
                              <select value={overviewEditData.change_reason || ""} onChange={e => setOverviewEditData({ ...overviewEditData, change_reason: e.target.value })} style={{ width: "100%", padding: "10px 12px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", background: C.surfaceWarm, marginBottom: 6 }}>
                                <option value="">Skip — no reason given</option>
                                <option value="expansion">Expansion (scope grew)</option>
                                <option value="contraction">Contraction (scope shrank)</option>
                                <option value="annual_increase">Annual rate increase</option>
                                <option value="discount_expired">Discount expired</option>
                                <option value="discount_applied">Discount applied</option>
                                <option value="renegotiation">Renegotiation</option>
                                <option value="correction">Correction (typo / wrong rate)</option>
                                <option value="other">Other</option>
                              </select>
                              <input type="text" value={overviewEditData.change_note || ""} onChange={e => setOverviewEditData({ ...overviewEditData, change_note: e.target.value })} placeholder="Note (optional)" style={{ width: "100%", padding: "10px 12px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", background: C.surfaceWarm, boxSizing: "border-box" }} />
                            </div>
                          )}
                          {!showBaselineEdit ? (
                            <button
                              type="button"
                              onClick={() => setShowBaselineEdit(true)}
                              style={{
                                fontSize: 12,
                                color: C.textMuted,
                                background: "transparent",
                                border: "none",
                                padding: "4px 0",
                                cursor: "pointer",
                                fontFamily: "inherit",
                                textAlign: "left",
                                textDecoration: "underline",
                                textDecorationColor: C.borderLight,
                                textUnderlineOffset: 3,
                                alignSelf: "flex-start",
                              }}
                            >
                              Adjust historical revenue baseline
                            </button>
                          ) : (
                            <div>
                              <label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Lifetime revenue earned before today ($)</label>
                              <input type="number" value={overviewEditData.lifetime_revenue_at_entry || 0} onChange={e => setOverviewEditData({ ...overviewEditData, lifetime_revenue_at_entry: parseFloat(e.target.value) || 0 })} style={{ width: "100%", padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg }} />
                              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, lineHeight: 1.4 }}>
                                What you earned from this client BEFORE Retayned tracked them. Only edit this if you skipped it during onboarding or got the number wrong.
                              </div>
                            </div>
                          )}
                          <div>
                            <label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Renewal date <span style={{ color: C.textMuted, fontWeight: 400 }}>· optional</span></label>
                            <div style={{ position: "relative" }}>
                              {/* Custom button styled like the form's input fields
                                  so it sits in the same visual rhythm. Opens a
                                  .rt-picker-panel calendar below. Replaces the
                                  native <input type="date"> which on mobile (iOS
                                  in particular) rendered as a separate button-
                                  styled control that broke the form's visual
                                  rhythm and could overflow the page. */}
                              <button
                                type="button"
                                onClick={() => {
                                  const cur = overviewEditData.renewal_date ? String(overviewEditData.renewal_date).slice(0, 10) : "";
                                  setRenewalModalMonth(cur ? cur.slice(0, 7) : (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })());
                                  setRenewalModal({ client: sc, date: cur, recurrence: overviewEditData.renewal_recurrence || "none", fromEdit: true });
                                }}
                                style={{
                                  width: "100%",
                                  padding: "12px 16px",
                                  border: "none",
                                  borderRadius: 8,
                                  fontSize: 14,
                                  fontFamily: "inherit",
                                  textAlign: "left",
                                  background: C.bg,
                                  boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)",
                                  cursor: "pointer",
                                  color: overviewEditData.renewal_date ? C.text : C.textMuted,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: 8,
                                  boxSizing: "border-box",
                                }}
                              >
                                <span>
                                  {overviewEditData.renewal_date
                                    ? new Date(String(overviewEditData.renewal_date).split("T")[0] + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                                    : "Select a date"}
                                </span>
                                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  {overviewEditData.renewal_date && (
                                    <span
                                      role="button"
                                      onClick={(e) => { e.stopPropagation(); setOverviewEditData({ ...overviewEditData, renewal_date: null }); }}
                                      style={{ width: 18, height: 18, borderRadius: 9, background: C.surface, color: C.textMuted, display: "grid", placeItems: "center", fontSize: 10, cursor: "pointer" }}
                                      aria-label="Clear renewal date"
                                    >×</span>
                                  )}
                                  <Icon name="due" size={14} simple color={C.textMuted} />
                                </span>
                              </button>
                            </div>
                            {/* Recurrence — only meaningful once a date is set.
                                The date acts as the anchor; recurrence rolls it
                                forward each cycle so it never reads "overdue". */}
                            {overviewEditData.renewal_date && (
                              <div style={{ marginTop: 10 }}>
                                <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 6 }}>Repeats</label>
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                  {[{ v: "none", l: "One-time" }, { v: "monthly", l: "Monthly" }, { v: "quarterly", l: "Quarterly" }, { v: "annual", l: "Annual" }].map(opt => {
                                    const active = (overviewEditData.renewal_recurrence || "none") === opt.v;
                                    return (
                                      <button key={opt.v} type="button" onClick={() => setOverviewEditData({ ...overviewEditData, renewal_recurrence: opt.v })} style={{ padding: "7px 12px", background: active ? C.primarySoft : C.card, border: "none", boxShadow: "inset 0 0 0 1px " + (active ? C.primary : C.borderLight), borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: active ? C.primary : C.textSec, cursor: "pointer", fontFamily: "inherit", transition: "all 120ms ease" }}>{opt.l}</button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                          <button onClick={() => setEditingOverview(false)} style={{ padding: "10px 16px", background: C.surface, color: C.textSec, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                          <button onClick={async () => {
                            const newRate = Number(overviewEditData.revenue) || 0;
                            const newBaseline = Number(overviewEditData.lifetime_revenue_at_entry) || 0;
                            const rateChanged = newRate !== Number(sc.revenue || 0);

                            const oldName = sc.name;
                            const newName = (overviewEditData.name ?? sc.name).trim() || sc.name;
                            const nameChanged = newName !== oldName;

                            // Always save the non-revenue fields via clientsDb.update.
                            // Revenue specifically goes through revenueHistoryDb.changeRate
                            // when it changed — that closes the active history row, opens
                            // a new one, AND updates clients.revenue. Calling clientsDb.update
                            // first with the new revenue would race with that.
                            const baseUpdates = {
                              contact: overviewEditData.contact,
                              role: overviewEditData.role,
                              tag: overviewEditData.tag,
                              months: overviewEditData.months,
                              renewal_date: overviewEditData.renewal_date || null,
                              renewal_recurrence: overviewEditData.renewal_recurrence || "none",
                              lifetime_revenue_at_entry: newBaseline,
                            };
                            if (nameChanged) baseUpdates.name = newName;
                            // If revenue did NOT change, include it in the update so we
                            // don't make an extra call.
                            if (!rateChanged) baseUpdates.revenue = newRate;

                            // Optimistic local update
                            const updated = {
                              ...sc,
                              ...baseUpdates,
                              name: newName,
                              revenue: newRate,
                              // ltv recompute: pre-entry baseline + history. Since rate
                              // change just happened (or didn't), the current row's
                              // contribution stays roughly the same. The new pre-entry
                              // baseline shifts the total directly.
                              ltv: newBaseline + (Number(sc.ltv || 0) - Number(sc.lifetime_revenue_at_entry || 0)),
                            };
                            setClients(prev => prev.map(c => c.id === sc.id ? updated : c));
                            // Patch denormalized client name on in-memory tasks so
                            // task.client lookups don't break after rename.
                            if (nameChanged) {
                              setTasks(prev => prev.map(t => t.client === oldName ? { ...t, client: newName } : t));
                            }
                            setSelectedClient(updated);
                            setEditingOverview(false);

                            // Persist
                            try {
                              await clientsDb.update(sc.id, baseUpdates);
                              if (rateChanged) {
                                await revenueHistoryDb.changeRate(user.id, sc.id, newRate, overviewEditData.change_reason || null, overviewEditData.change_note || null);
                              }
                            } catch (e) {
                              console.error("Failed to save client edits:", e);
                            }
                          }} style={{ flex: 1, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
                        </div>
                      </>
                    )}
                {/* Destructive action CONFIRM blocks — triggered by the
                    sticky footer at modal level. When no confirm is active
                    this renders nothing (the sticky footer is visible
                    instead). The four confirm dialogs preserve the existing
                    state-machine semantics. */}
                <div style={{ marginTop: 18 }}>
                  {!rolodexConfirm && !removeConfirm && !pauseConfirm && !resumeConfirm ? null : pauseConfirm ? (
                    <div style={{ background: C.surfaceWarm, borderRadius: 12, padding: "16px" }}>
                      <p style={{ fontSize: 14, color: C.text, lineHeight: 1.55, marginBottom: 14 }}>Pausing will not remove a client from billing — tasks stay visible but Rai stops surfacing them, and the tenure clock freezes until you resume. To stop billing, move them to your Rolodex instead.</p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={async () => {
                          // Optimistic: flip is_paused, drop ret -4
                          const newRet = Math.max(1, (sc.ret || 50) - 4);
                          setClients(clients.map(c => c.id === sc.id ? { ...c, is_paused: true, ret: newRet, retention_score: newRet } : c));
                          setSelectedClient({ ...sc, is_paused: true, ret: newRet, retention_score: newRet });
                          setPauseConfirm(false);
                          // Persist: open pause row + bump retention_score down -4
                          try {
                            await clientEngagementPausesDb.start(user.id, sc.id);
                            await clientsDb.update(sc.id, { retention_score: newRet });
                            // Refresh pauses map so subsequent reads see the new pause
                            setEngagementPausesByClient(prev => ({
                              ...prev,
                              [sc.id]: [...(prev[sc.id] || []), { paused_at: localYmd(), resumed_at: null }],
                            }));
                          } catch (e) {
                            console.error("Failed to pause:", e);
                          }
                        }} style={{ flex: 1, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Pause engagement</button>
                        <button onClick={() => setPauseConfirm(false)} style={{ padding: "10px 14px", background: C.surface, color: C.textMuted, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                      </div>
                    </div>
                  ) : resumeConfirm ? (
                    <div style={{ background: C.primarySoft, borderRadius: 12, padding: "16px", border: "1px solid " + C.primary + "33" }}>
                      <p style={{ fontSize: 14, color: C.text, lineHeight: 1.55, marginBottom: 14 }}>Resume the engagement with this client. Their tasks will start surfacing again and tenure resumes growing. The -4 retention dent from pausing stays — it doesn't auto-restore.</p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={async () => {
                          // Optimistic
                          setClients(clients.map(c => c.id === sc.id ? { ...c, is_paused: false } : c));
                          setSelectedClient({ ...sc, is_paused: false });
                          setResumeConfirm(false);
                          try {
                            await clientEngagementPausesDb.end(user.id, sc.id);
                            // Update pauses map: set resumed_at on the open one
                            setEngagementPausesByClient(prev => {
                              const list = prev[sc.id] || [];
                              const today = localYmd();
                              const updated = list.map(p => p.resumed_at ? p : { ...p, resumed_at: today });
                              return { ...prev, [sc.id]: updated };
                            });
                          } catch (e) {
                            console.error("Failed to resume:", e);
                          }
                        }} style={{ flex: 1, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Resume engagement</button>
                        <button onClick={() => setResumeConfirm(false)} style={{ padding: "10px 14px", background: C.surface, color: C.textMuted, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                      </div>
                    </div>
                  ) : rolodexConfirm ? (
                    <div style={{ background: C.primarySoft, borderRadius: 12, padding: "16px", border: "1px solid " + C.primary + "33" }}>
                      <p style={{ fontSize: 14, color: C.text, lineHeight: 1.55, marginBottom: 14 }}>This client will be moved to your Rolodex for future tracking. Relationships change — this keeps the door open. Rai's memory of them will be cleared.</p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="r-btn" data-tone="purple" onClick={async () => {
                          // Build the rolodex row from the client being moved.
                          // Preserve as much context as possible — relationship
                          // history is the entire point of the Rolodex. None of
                          // this is reversible without manual reconstruction.
                          const todayDisplay = new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" });
                          const payload = {
                            client_name: sc.name,
                            contact_name: sc.contact || "",
                            months: sc.months || 0,
                            type: "former",
                            date_added: todayDisplay,
                            tags: [],
                            priority: null,
                            // Carry notes if present — gives the user a starting
                            // point in the retro flow rather than blank slate.
                            notes: sc.notes || "",
                            // Empty retro_answers so the standard retro flow
                            // engages (lets the user fill in why they parted).
                            retro_answers: {},
                          };
                          // Optimistic UI: insert into local state first so the
                          // user sees the row immediately. If the DB insert
                          // fails, roll back.
                          const tempId = "tmp-" + Date.now();
                          const optimistic = {
                            id: tempId,
                            client: sc.name,
                            contact: sc.contact || "",
                            months: sc.months || 0,
                            type: "former",
                            date: todayDisplay,
                            tags: [],
                            priority: null,
                            work: sc.notes || "",
                          };
                          setRolodex(prev => [optimistic, ...prev]);
                          setClients(clients.filter(c => c.id !== sc.id));
                          // Persist. Sequencing matters: deactivate the client
                          // BEFORE creating the rolodex row so that if the
                          // rolodex insert succeeds but the deactivate fails,
                          // we don't end up with the client visible in both
                          // surfaces. Reverse order would risk the opposite.
                          let createdRow = null;
                          try {
                            const { data, error } = await rolodexDb.create(user.id, payload);
                            if (error) throw error;
                            createdRow = data;
                          } catch (e) {
                            console.error("Failed to persist rolodex move:", e);
                            // Roll back UI — re-add client, drop optimistic row.
                            setRolodex(prev => prev.filter(r => r.id !== tempId));
                            setClients(prev => [...prev, sc]);
                            setRolodexConfirm(false);
                            alert("Could not move " + sc.name + " to the Rolodex. Please try again — they have not been moved.");
                            return;
                          }
                          // Swap temp row for the real DB row (gets the real
                          // UUID so subsequent edits hit the right record).
                          if (createdRow) {
                            setRolodex(prev => prev.map(r => r.id === tempId ? {
                              id: createdRow.id,
                              client: createdRow.client_name,
                              contact: createdRow.contact_name,
                              months: createdRow.months || 0,
                              type: createdRow.type,
                              date: createdRow.date_added,
                              tags: createdRow.tags || [],
                              priority: createdRow.priority,
                              work: createdRow.notes,
                            } : r));
                          }
                          // Remove this client's RECURRING tasks — once moved to
                          // the rolodex, their recurring work shouldn't keep
                          // surfacing (and would otherwise orphan into "N/A").
                          // One-off tasks are left as-is.
                          try {
                            const recurringForClient = (tasks || []).filter(t => t.client_id === sc.id && t.recurring);
                            if (recurringForClient.length) {
                              setTasks(prev => (prev || []).filter(t => !(t.client_id === sc.id && t.recurring)));
                              for (const t of recurringForClient) { tasksDb.delete(t.id); }
                            }
                          } catch (e) { console.warn("Recurring task cleanup on rolodex move failed:", e); }
                          // Mark the client deactivated in DB. If this fails
                          // we don't roll the rolodex back — the row IS in the
                          // rolodex truthfully; the client will reappear on
                          // next refresh because deactivate didn't land, but
                          // the user can retry from there. Logged loudly.
                          try {
                            await clientsDb.deactivate(sc.id);
                          } catch (e) {
                            console.error("Failed to deactivate client after rolodex move:", e);
                          }
                          setSelectedClient(null);
                          setRolodexConfirm(false);
                          setPage("retros");
                        }} style={{ flex: 1, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Move to Rolodex</button>
                        <button onClick={() => setRolodexConfirm(false)} style={{ padding: "10px 14px", background: C.surface, color: C.textMuted, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: C.bg, borderRadius: 12, padding: "16px" }}>
                      <p style={{ fontSize: 14, color: C.text, lineHeight: 1.55, marginBottom: 14 }}>This will permanently delete this client from your account — all tasks, touchpoints, health checks, and Rai's memory of them will be erased. This cannot be undone.</p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => { setClients(clients.filter(c => c.id !== sc.id));
                          clientsDb.hardDelete(sc.id); setSelectedClient(null); setRemoveConfirm(false); }} style={{ flex: 1, padding: "10px", background: C.surface, color: C.textSec, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Terminate Permanently</button>
                        <button className="r-btn" data-tone="purple" onClick={() => setRemoveConfirm(false)} style={{ padding: "10px 14px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
                  </div>
                )}

                {/* Profile — 12 dimensions */}
                {clientTab === "profile" && (
                  <div>
                    {!editingProfile ? (
                      <div>
                        {Object.keys(dims).length > 0 ? (
                          <div
                            style={{ display: "flex", justifyContent: "center", padding: "4px 0 8px", position: "relative" }}
                            onMouseLeave={() => setRadarHoverDim(null)}
                            onClick={(e) => {
                              // Clicking the empty area (not a dot) dismisses tap-pinned tooltip on mobile.
                              if (e.target.tagName !== "circle") setRadarHoverDim(null);
                            }}
                          >
                            {/* Radar — 12-point polygon with labels in a 60px
                                outer ring (away from the polygon) so long
                                names like "Communication Frequency" and
                                "Replacement" render in full without clipping.
                                Leader lines connect the spoke endpoint to the
                                label ring. Each dot has an invisible larger
                                hit-area circle around it for easier hover/tap.
                                Hovered dot enlarges + tooltip card surfaces
                                the dimension name and current value (0-10).
                                viewBox = 440 x 360 so labels have room to
                                breathe even on the longest names. */}
                            <svg width="100%" viewBox="0 0 440 360" style={{ flexShrink: 0, maxWidth: 440, overflow: "visible" }}>
                              {/* Background quartile rings */}
                              <g fill="none" stroke={C.borderLight} strokeWidth="1">
                                <circle cx="220" cy="180" r="25" />
                                <circle cx="220" cy="180" r="50" />
                                <circle cx="220" cy="180" r="75" />
                                <circle cx="220" cy="180" r="100" />
                              </g>
                              {/* Faint spokes from center to polygon edge */}
                              <g fill="none" stroke={C.borderLight} strokeWidth="0.5">
                                {profileDimensions.map((d, i) => {
                                  const angle = (i / profileDimensions.length) * 2 * Math.PI - Math.PI / 2;
                                  const x = 220 + 100 * Math.cos(angle);
                                  const y = 180 + 100 * Math.sin(angle);
                                  return <line key={d.key} x1="220" y1="180" x2={x} y2={y} />;
                                })}
                              </g>
                              {/* Leader lines from polygon edge to label ring */}
                              <g fill="none" stroke={C.borderLight} strokeWidth="0.5">
                                {profileDimensions.map((d, i) => {
                                  const angle = (i / profileDimensions.length) * 2 * Math.PI - Math.PI / 2;
                                  const x1 = 220 + 100 * Math.cos(angle);
                                  const y1 = 180 + 100 * Math.sin(angle);
                                  const x2 = 220 + 122 * Math.cos(angle);
                                  const y2 = 180 + 122 * Math.sin(angle);
                                  return <line key={d.key} x1={x1} y1={y1} x2={x2} y2={y2} />;
                                })}
                              </g>
                              {/* Polygon + dots. Dots are interactive: hover
                                  triggers tooltip via radarHoverDim state. An
                                  invisible larger circle around each dot is
                                  the actual hit area (12px radius) so the
                                  user doesn't have to land exactly on the
                                  2.5px dot. */}
                              {(() => {
                                const dotsData = profileDimensions.map((d, i) => {
                                  const val = dims[d.key] !== undefined && dims[d.key] !== null ? Number(dims[d.key]) : 0;
                                  const clamped = Math.max(0, Math.min(10, val));
                                  const angle = (i / profileDimensions.length) * 2 * Math.PI - Math.PI / 2;
                                  const r = (clamped / 10) * 100;
                                  return { key: d.key, name: d.name, val: clamped, x: 220 + r * Math.cos(angle), y: 180 + r * Math.sin(angle) };
                                });
                                const polyStr = dotsData.map(p => p.x.toFixed(1) + "," + p.y.toFixed(1)).join(" ");
                                return (
                                  <>
                                    <polygon points={polyStr} fill={C.primary} fillOpacity="0.18" stroke={C.primary} strokeWidth="1.5" strokeLinejoin="round" />
                                    {dotsData.map((p) => {
                                      const isHovered = radarHoverDim === p.key;
                                      return (
                                        <g key={p.key}>
                                          {/* Visible dot */}
                                          <circle cx={p.x} cy={p.y} r={isHovered ? 5 : 2.5} fill={C.primary} stroke={isHovered ? "#fff" : "none"} strokeWidth={isHovered ? 2 : 0} style={{ transition: "r 140ms, stroke-width 140ms" }} />
                                          {/* Invisible hit area */}
                                          <circle
                                            cx={p.x}
                                            cy={p.y}
                                            r="12"
                                            fill="transparent"
                                            style={{ cursor: "pointer" }}
                                            onMouseEnter={() => setRadarHoverDim(p.key)}
                                            onMouseLeave={() => setRadarHoverDim(null)}
                                            onClick={(e) => { e.stopPropagation(); setRadarHoverDim(p.key); }}
                                          />
                                        </g>
                                      );
                                    })}
                                  </>
                                );
                              })()}
                              {/* Labels at radius 130 — outside the polygon
                                  with breathing room. Full text (d.name).
                                  textAnchor and dominantBaseline picked by
                                  angle to keep labels nicely positioned
                                  around the ring. Hovered dim's label bolds
                                  and darkens so it's clear which one the
                                  tooltip refers to. */}
                              <g fontFamily="Manrope, sans-serif" fontSize="11" fontWeight="500">
                                {profileDimensions.map((d, i) => {
                                  const angle = (i / profileDimensions.length) * 2 * Math.PI - Math.PI / 2;
                                  const cos = Math.cos(angle);
                                  const sin = Math.sin(angle);
                                  const x = 220 + 130 * cos;
                                  const y = 180 + 130 * sin;
                                  const textAnchor = cos > 0.35 ? "start" : cos < -0.35 ? "end" : "middle";
                                  const dominantBaseline = sin > 0.35 ? "hanging" : sin < -0.35 ? "auto" : "middle";
                                  const isHovered = radarHoverDim === d.key;
                                  return (
                                    <text
                                      key={d.key}
                                      x={x}
                                      y={y}
                                      textAnchor={textAnchor}
                                      dominantBaseline={dominantBaseline}
                                      fill={isHovered ? C.text : C.textSec}
                                      fontWeight={isHovered ? 700 : 500}
                                      style={{ cursor: "pointer", transition: "fill 140ms, font-weight 140ms" }}
                                      onMouseEnter={() => setRadarHoverDim(d.key)}
                                      onMouseLeave={() => setRadarHoverDim(null)}
                                      onClick={(e) => { e.stopPropagation(); setRadarHoverDim(d.key); }}
                                    >
                                      {d.name}
                                    </text>
                                  );
                                })}
                              </g>
                            </svg>
                            {/* Tooltip card — only when a dimension is
                                hovered/tapped. Positioned dead-center over
                                the radar, sized small, dark surface so it
                                pops against the cream. Mobile tap-pins via
                                same state; tap-elsewhere dismisses (handled
                                by the outer div's onClick). */}
                            {radarHoverDim && (() => {
                              const d = profileDimensions.find(x => x.key === radarHoverDim);
                              if (!d) return null;
                              const val = dims[d.key] !== undefined && dims[d.key] !== null ? Number(dims[d.key]) : 0;
                              const clamped = Math.max(0, Math.min(10, val));
                              return (
                                <div style={{
                                  position: "absolute",
                                  top: "50%",
                                  left: "50%",
                                  transform: "translate(-50%, -50%)",
                                  background: "#1E261F",
                                  color: "#fff",
                                  borderRadius: 10,
                                  padding: "10px 14px",
                                  boxShadow: "0 8px 20px rgba(10,10,10,0.25), 0 2px 4px rgba(10,10,10,0.10)",
                                  pointerEvents: "none",
                                  fontFamily: "Manrope, sans-serif",
                                  textAlign: "center",
                                  minWidth: 100,
                                }}>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: 4 }}>{d.name}</div>
                                  <div style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{clamped.toFixed(clamped % 1 === 0 ? 0 : 1)}<span style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.5)", marginLeft: 4 }}>/10</span></div>
                                </div>
                              );
                            })()}
                          </div>
                        ) : (
                          <div style={{ textAlign: "center", padding: "20px 0", color: C.textMuted, fontSize: 14 }}>
                            No profile set yet. Build one to help Rai understand this client.
                          </div>
                        )}
                        {/* Quiet edit affordance — small underlined link aligned
                            right. Previously a full-width purple Edit Profile
                            button which fought for attention against the
                            sticky-footer Edit (overview editor). This now
                            reads as a secondary edit specific to the radar,
                            not a primary CTA — sticky footer keeps the
                            visual weight for overall client actions. */}
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                          <button
                            type="button"
                            className="rt-purple-link"
                            onClick={() => { setEditScores({ ...dims }); setEditingProfile(true); }}
                            style={{
                              background: "transparent",
                              border: "none",
                              padding: "4px 0",
                              cursor: "pointer",
                              fontFamily: "inherit",
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            {Object.keys(dims).length > 0 ? "Edit relationship profile" : "Build relationship profile"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Edit Relationship Profile</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {profileDimensions.map(d => {
                            const val = editScores[d.key] !== undefined ? editScores[d.key] : 5;
                            const labels = dimLabels[d.key] || [d.name, "Low", "High"];
                            return (
                              <div key={d.key}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                                  <span style={{ fontSize: 14, fontWeight: 600 }}>{d.name}</span>
                                  <span style={{ fontSize: 14, fontWeight: 700, color: C.primary }}>{val}</span>
                                </div>
                                <input type="range" min="0" max="10" value={val} onChange={e => setEditScores({ ...editScores, [d.key]: parseInt(e.target.value) })} style={{ width: "100%", height: 6, appearance: "none", WebkitAppearance: "none", background: `linear-gradient(to right, ${C.border} 0%, ${C.primary} 100%)`, borderRadius: 3, outline: "none", cursor: "pointer" }} />
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.textMuted }}>
                                  <span>{labels[1]}</span><span>{labels[2]}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                          <button onClick={() => setEditingProfile(false)} style={{ padding: "10px 16px", background: C.surface, color: C.textSec, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                          <button onClick={async () => {
                            const newRet = calcRetentionScore(editScores, null, sc.qualifyingFlags || {}, sc.months || 0);
                            const updated = clients.map(c => c.id === sc.id ? { ...c, profileScores: { ...editScores }, ret: newRet || c.ret } : c);
                            setClients(updated);
                            setSelectedClient({ ...sc, profileScores: { ...editScores }, ret: newRet || sc.ret });
                            setEditingProfile(false);
                            clientsDb.updateScores(sc.id, newRet || sc.ret, { ...editScores });
                          }} style={{ flex: 1, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Save Profile</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}




                {/* Billing */}
                {clientTab === "billing" && (() => {
                  const billing = clientBilling[sc.id] || { items: [] };
                  const now = new Date();
                  const currentMonth = now.toLocaleString("default", { month: "long", year: "numeric" });
                  const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                  const nextMonth = nextDate.toLocaleString("default", { month: "long", year: "numeric" });
                  // Previous month for read-only retrospective view.
                  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                  const prevMonth = prevDate.toLocaleString("default", { month: "long", year: "numeric" });
                  // Active months = the three we render at full fidelity.
                  // prev = read-only (status togglable but no item edits).
                  // current/next = fully editable.
                  const activeMonths = [prevMonth, currentMonth, nextMonth];

                  const getMonthItems = (month) => billing.items.filter(i => i.month === month);
                  const getMonthTotal = (month) => getMonthItems(month).reduce((a, i) => a + i.amount, 0);
                  // pastMonths now means "older than previous month" — the deeper history list.
                  const pastMonths = [...new Set(billing.items.map(i => i.month))].filter(m => !activeMonths.includes(m));

                  // Status lookup helper. Returns { invoiced, paid } for a given
                  // month (defaults false/false if no row exists yet).
                  const getStatus = (month) => {
                    const clientStatus = billingMonthStatus[sc.id] || {};
                    const row = clientStatus[month];
                    return { invoiced: !!row?.invoiced, paid: !!row?.paid };
                  };

                  // Toggle invoiced/paid for a month. Optimistic update + DB write.
                  const toggleInvoiced = async (month) => {
                    const cur = getStatus(month);
                    const next = !cur.invoiced;
                    // Optimistic local update
                    setBillingMonthStatus(prev => {
                      const c = { ...(prev[sc.id] || {}) };
                      c[month] = { ...(c[month] || {}), invoiced: next, invoiced_at: next ? new Date().toISOString() : null };
                      return { ...prev, [sc.id]: c };
                    });
                    try {
                      const { error } = await clientBillingMonthStatusDb.setInvoiced(user.id, sc.id, month, next);
                      if (error) throw error;
                    } catch (e) {
                      console.warn("setInvoiced failed:", e);
                      // Roll back
                      setBillingMonthStatus(prev => {
                        const c = { ...(prev[sc.id] || {}) };
                        c[month] = { ...(c[month] || {}), invoiced: cur.invoiced, invoiced_at: cur.invoiced ? new Date().toISOString() : null };
                        return { ...prev, [sc.id]: c };
                      });
                    }
                  };
                  const togglePaid = async (month) => {
                    const cur = getStatus(month);
                    const next = !cur.paid;
                    setBillingMonthStatus(prev => {
                      const c = { ...(prev[sc.id] || {}) };
                      c[month] = { ...(c[month] || {}), paid: next, paid_at: next ? new Date().toISOString() : null };
                      return { ...prev, [sc.id]: c };
                    });
                    try {
                      const { error } = await clientBillingMonthStatusDb.setPaid(user.id, sc.id, month, next);
                      if (error) throw error;
                    } catch (e) {
                      console.warn("setPaid failed:", e);
                      setBillingMonthStatus(prev => {
                        const c = { ...(prev[sc.id] || {}) };
                        c[month] = { ...(c[month] || {}), paid: cur.paid, paid_at: cur.paid ? new Date().toISOString() : null };
                        return { ...prev, [sc.id]: c };
                      });
                    }
                  };

                  // ─── Billing terms handlers ────────────────────────────────
                  // Terms are an editable, append-able log per client. Newest entry
                  // is "current" (sorted by created_at desc). All entries editable
                  // and deletable.
                  const termsForClient = billingTerms[sc.id] || [];
                  const currentTerm = termsForClient[0] || null;
                  const historyTerms = termsForClient.slice(1);

                  const addTerm = async () => {
                    const body = (termsEditDraft || "").trim();
                    if (!body) return;
                    const tempId = "temp-" + Date.now();
                    // Optimistic prepend
                    const optimistic = { id: tempId, body, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
                    setBillingTerms(prev => ({ ...prev, [sc.id]: [optimistic, ...(prev[sc.id] || [])] }));
                    setTermsAddingNew(prev => ({ ...prev, [sc.id]: false }));
                    setTermsEditDraft("");
                    try {
                      const { data, error } = await clientBillingTermsDb.create(user.id, sc.id, body);
                      if (error) throw error;
                      // Swap temp ID for real
                      if (data) {
                        setBillingTerms(prev => {
                          const list = (prev[sc.id] || []).map(t => t.id === tempId ? {
                            id: data.id, body: data.body, created_at: data.created_at, updated_at: data.updated_at,
                          } : t);
                          return { ...prev, [sc.id]: list };
                        });
                      }
                    } catch (e) {
                      console.warn("addTerm failed:", e);
                      // Roll back
                      setBillingTerms(prev => ({ ...prev, [sc.id]: (prev[sc.id] || []).filter(t => t.id !== tempId) }));
                    }
                  };

                  const saveTermEdit = async (entryId) => {
                    const body = (termsEditDraft || "").trim();
                    if (!body) return;
                    const prev = termsForClient.find(t => t.id === entryId);
                    if (!prev) return;
                    setBillingTerms(curr => {
                      const list = (curr[sc.id] || []).map(t => t.id === entryId ? { ...t, body, updated_at: new Date().toISOString() } : t);
                      return { ...curr, [sc.id]: list };
                    });
                    setTermsEditingId(null);
                    setTermsEditDraft("");
                    try {
                      const { error } = await clientBillingTermsDb.update(entryId, body);
                      if (error) throw error;
                    } catch (e) {
                      console.warn("saveTermEdit failed:", e);
                      setBillingTerms(curr => {
                        const list = (curr[sc.id] || []).map(t => t.id === entryId ? prev : t);
                        return { ...curr, [sc.id]: list };
                      });
                    }
                  };

                  const removeTerm = async (entryId) => {
                    if (!confirm("Delete this entry?")) return;
                    const removed = termsForClient.find(t => t.id === entryId);
                    setBillingTerms(curr => ({ ...curr, [sc.id]: (curr[sc.id] || []).filter(t => t.id !== entryId) }));
                    try {
                      const { error } = await clientBillingTermsDb.remove(entryId);
                      if (error) throw error;
                    } catch (e) {
                      console.warn("removeTerm failed:", e);
                      // Roll back
                      if (removed) {
                        setBillingTerms(curr => {
                          const list = [...(curr[sc.id] || []), removed].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                          return { ...curr, [sc.id]: list };
                        });
                      }
                    }
                  };

                  const formatTermDate = (iso) => {
                    if (!iso) return "";
                    const d = new Date(iso);
                    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                  };


                  // ─── DB-backed billing handlers ──────────────────────────
                  // All three handlers update local state optimistically (so the
                  // UI feels snappy), then persist to Supabase. On DB error we
                  // roll back to the previous state and warn — the user sees
                  // their change revert and can try again.

                  const addItem = async (month) => {
                    if (!billingNewItem.description.trim() || !billingNewItem.amount) return;
                    const prev = clientBilling[sc.id] || { items: [] };
                    const description = billingNewItem.description.trim();
                    const amount = parseFloat(billingNewItem.amount) || 0;
                    const recurring = !!billingNewItem.recurring;

                    // Build the rows we'll insert. Recurring items mirror into the
                    // other active month (unless a same-description row already
                    // exists there — avoids dupes if the user manually added it).
                    const rowsToInsert = [{ description, amount, recurring, month }];
                    if (recurring) {
                      const otherMonth = month === currentMonth ? nextMonth : currentMonth;
                      const alreadyExists = prev.items.some(i => i.description === description && i.month === otherMonth);
                      if (!alreadyExists) {
                        rowsToInsert.push({ description, amount, recurring: true, month: otherMonth });
                      }
                    }

                    // Optimistic update — temporary local IDs (negative numbers)
                    // are replaced with real DB IDs once the insert returns.
                    const tempBase = -Date.now();
                    const optimisticRows = rowsToInsert.map((r, idx) => ({ ...r, id: tempBase - idx }));
                    const newItems = [...prev.items, ...optimisticRows];
                    setClientBilling({ ...clientBilling, [sc.id]: { ...prev, items: newItems } });
                    setBillingNewItem({ description: "", amount: "", recurring: false });
                    setBillingAddOpen(false);

                    // Persist
                    try {
                      const { data: created, error } = await clientBillingDb.createBatch(user.id, sc.id, rowsToInsert);
                      if (error) throw error;
                      // Swap optimistic IDs for real IDs from the DB
                      const tempIds = new Set(optimisticRows.map(r => r.id));
                      const finalRows = (created || []).map(r => ({
                        id: r.id,
                        description: r.description,
                        amount: Number(r.amount),
                        recurring: r.recurring,
                        month: r.month,
                      }));
                      setClientBilling(curr => {
                        const c = curr[sc.id] || { items: [] };
                        const kept = c.items.filter(i => !tempIds.has(i.id));
                        return { ...curr, [sc.id]: { ...c, items: [...kept, ...finalRows] } };
                      });
                    } catch (e) {
                      console.warn("Billing item create failed:", e);
                      // Roll back to the pre-optimistic state
                      setClientBilling({ ...clientBilling, [sc.id]: prev });
                    }
                  };

                  const removeItem = async (itemId) => {
                    const prev = clientBilling[sc.id] || { items: [] };
                    // Optimistic remove
                    setClientBilling({
                      ...clientBilling,
                      [sc.id]: { ...prev, items: prev.items.filter(i => i.id !== itemId) },
                    });
                    // Persist (skip if it's still an optimistic temp ID — those
                    // never made it to the DB, so nothing to delete).
                    if (typeof itemId === "string" || itemId >= 0) {
                      try {
                        const { error } = await clientBillingDb.remove(itemId);
                        if (error) throw error;
                      } catch (e) {
                        console.warn("Billing item remove failed:", e);
                        setClientBilling({ ...clientBilling, [sc.id]: prev });
                      }
                    }
                  };

                  const toggleRecurring = async (itemId) => {
                    const prev = clientBilling[sc.id] || { items: [] };
                    const item = prev.items.find(i => i.id === itemId);
                    if (!item) return;
                    const turningOn = !item.recurring;

                    // Build the new local state first (same logic as before).
                    let newItems = prev.items.map(i => i.id === itemId ? { ...i, recurring: !i.recurring } : i);
                    let mirrorRow = null; // populated if we add a mirror line
                    if (turningOn) {
                      const otherMonth = item.month === currentMonth ? nextMonth : currentMonth;
                      const alreadyExists = prev.items.some(i => i.description === item.description && i.month === otherMonth);
                      if (!alreadyExists) {
                        const tempId = -Date.now();
                        mirrorRow = {
                          id: tempId,
                          description: item.description,
                          amount: item.amount,
                          recurring: true,
                          month: otherMonth,
                        };
                        newItems = [...newItems, mirrorRow];
                      }
                    }

                    // Optimistic update
                    setClientBilling({ ...clientBilling, [sc.id]: { ...prev, items: newItems } });

                    // Persist: update the toggled row, and insert the mirror if needed.
                    try {
                      const { error: updateErr } = await clientBillingDb.update(itemId, { recurring: !item.recurring });
                      if (updateErr) throw updateErr;
                      if (mirrorRow) {
                        const { data: created, error: insertErr } = await clientBillingDb.create(user.id, sc.id, {
                          description: mirrorRow.description,
                          amount: mirrorRow.amount,
                          recurring: true,
                          month: mirrorRow.month,
                        });
                        if (insertErr) throw insertErr;
                        if (created) {
                          // Swap the temp ID for the real one
                          setClientBilling(curr => {
                            const c = curr[sc.id] || { items: [] };
                            const swapped = c.items.map(i => i.id === mirrorRow.id ? {
                              id: created.id,
                              description: created.description,
                              amount: Number(created.amount),
                              recurring: created.recurring,
                              month: created.month,
                            } : i);
                            return { ...curr, [sc.id]: { ...c, items: swapped } };
                          });
                        }
                      }
                    } catch (e) {
                      console.warn("Billing item toggle failed:", e);
                      setClientBilling({ ...clientBilling, [sc.id]: prev });
                    }
                  };

                  // Pill toggle component for month-level invoiced/paid status.
                  // Lives inline with the month total. Three states:
                  //   off     — gray text, gray border, transparent fill
                  //   on (invoiced)  — gold text/border, soft gold fill
                  //   on (paid)      — green text/border, soft green fill
                  const StatusPill = ({ kind, on, onClick, disabled = false }) => {
                    const onColor = kind === "invoiced" ? C.warning : C.success;
                    const onBg = kind === "invoiced" ? "#FAF0DF" : "#E8F3EC";
                    return (
                      <button
                        type="button"
                        onClick={disabled ? undefined : onClick}
                        style={{
                          padding: "3px 10px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 600,
                          border: "1px solid " + (on ? onColor : C.border),
                          background: on ? onBg : "transparent",
                          color: on ? onColor : C.textMuted,
                          cursor: disabled ? "default" : "pointer",
                          fontFamily: "inherit",
                          opacity: disabled ? 0.85 : 1,
                          transition: "background 120ms, color 120ms, border-color 120ms",
                        }}
                      >
                        {kind === "invoiced" ? "Invoiced" : "Paid"}
                      </button>
                    );
                  };

                  // renderMonth — handles current, next, and previous (read-only).
                  // readOnly controls: hides × on rows, hides "+ Add line item",
                  // hides recurring toggle button. Month-level invoiced/paid pills
                  // remain togglable even on read-only months (you might mark a past
                  // month paid after the fact).
                  const renderMonth = (month, opts = {}) => {
                    const { isNext = false, readOnly = false } = opts;
                    const items = getMonthItems(month);
                    const total = getMonthTotal(month);
                    const isAdding = billingAddOpen === month;
                    const status = getStatus(month);

                    return (
                      <div key={month} style={{ marginBottom: 20, opacity: readOnly ? 0.85 : 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 12 }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 700 }}>{month}</div>
                            {isNext && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Forward billing</div>}
                            {readOnly && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Past · read-only</div>}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                            <StatusPill kind="invoiced" on={status.invoiced} onClick={() => toggleInvoiced(month)} />
                            <StatusPill kind="paid" on={status.paid} onClick={() => togglePaid(month)} />
                            {items.length > 0 && (
                              <span style={{ fontSize: 14, fontWeight: 700, color: C.primary, marginLeft: 4 }}>${total.toLocaleString()}</span>
                            )}
                          </div>
                        </div>

                        {items.map(item => (
                          <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderBottom: "1px solid " + C.borderLight }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontSize: 14, fontWeight: 600 }}>{item.description}</span>
                                {item.recurring && <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 3, background: C.primarySoft, color: C.primary, fontWeight: 600 }}>↻ Recurring</span>}
                              </div>
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 700, marginRight: 4 }}>${item.amount.toLocaleString()}</span>
                            {!readOnly && (
                              <>
                                <button onClick={() => toggleRecurring(item.id)} style={{ background: "none", border: "none", fontSize: 12, color: item.recurring ? C.primary : C.borderLight, cursor: "pointer", padding: "2px" }}>↻</button>
                                <button onClick={() => removeItem(item.id)} style={{ background: "none", border: "none", fontSize: 14, color: C.borderLight, cursor: "pointer", padding: "0 2px" }}>×</button>
                              </>
                            )}
                          </div>
                        ))}

                        {items.length === 0 && !isAdding && (
                          <div style={{ padding: "12px 0", fontSize: 14, color: C.textMuted }}>
                            {readOnly ? "No items logged for this month." : "No items yet."}
                          </div>
                        )}

                        {!readOnly && (isAdding ? (
                          <div style={{ padding: "12px 0", display: "flex", flexDirection: "column", gap: 8 }}>
                            <input value={billingNewItem.description} onChange={e => setBillingNewItem({ ...billingNewItem, description: e.target.value })} placeholder="Description (e.g. Retainer, Creative refresh)" style={{ padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg }} />
                            <input type="number" value={billingNewItem.amount} onChange={e => setBillingNewItem({ ...billingNewItem, amount: e.target.value })} placeholder="Amount ($)" style={{ padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg }} />
                            <div onClick={() => setBillingNewItem({ ...billingNewItem, recurring: !billingNewItem.recurring })} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", cursor: "pointer" }}>
                              <div style={{ width: 18, height: 18, borderRadius: 4, border: billingNewItem.recurring ? "none" : "1.5px solid " + C.border, background: billingNewItem.recurring ? C.primary : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {billingNewItem.recurring && <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>✓</span>}
                              </div>
                              <span style={{ fontSize: 14, color: C.textSec }}>Make recurring (auto-adds each month)</span>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button className="r-btn" data-tone="purple" onClick={() => addItem(month)} style={{ flex: 1, padding: "10px", background: billingNewItem.description.trim() && billingNewItem.amount ? C.btn : C.surface, color: billingNewItem.description.trim() && billingNewItem.amount ? "#fff" : C.textMuted, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Add</button>
                              <button onClick={() => { setBillingAddOpen(false); setBillingNewItem({ description: "", amount: "", recurring: false }); }} style={{ padding: "10px 14px", background: C.surface, color: C.textMuted, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setBillingAddOpen(month)} style={{ width: "100%", padding: "10px", background: "transparent", color: C.primary, border: "1px dashed " + C.border, borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 6 }}>+ Add line item</button>
                        ))}
                      </div>
                    );
                  };

                  return (
                    <div>
                      {/* ─── Billing terms section ─── */}
                      {/* Standard card pattern: white bg, hairline border,
                          10px radius. Matches every other card in the app
                          (Settings rows, client list cards, etc). No tinted
                          surface, no gold left rule — the cream-on-cream
                          collision with the tab bar above made the previous
                          paper-note treatment feel buried. */}
                      <div style={{
                        background: C.card,
                        borderRadius: 10,
                        padding: "14px 16px",
                        marginBottom: 18,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                            Billing terms
                          </span>
                          <span style={{ fontSize: 11, color: C.textMuted }}>
                            {currentTerm ? formatTermDate(currentTerm.created_at) : "No entries yet"}
                            {termsForClient.length > 0 && ` · ${termsForClient.length === 1 ? "1 entry" : `${termsForClient.length} entries`}`}
                          </span>
                        </div>

                        {/* Body — current entry, edit, add, or empty */}
                        {currentTerm && termsEditingId !== currentTerm.id && !termsAddingNew[sc.id] && (
                          <div>
                            <div style={{ fontSize: 13, lineHeight: 1.55, color: C.text, whiteSpace: "pre-wrap" }}>{currentTerm.body}</div>
                            <div style={{ display: "flex", gap: 14, marginTop: 8, paddingTop: 8, borderTop: "0.5px dashed " + C.borderLight, fontSize: 11, color: C.textMuted }}>
                              <button onClick={() => { setTermsEditingId(currentTerm.id); setTermsEditDraft(currentTerm.body); }} style={{ background: "none", border: "none", padding: 0, fontSize: 11, color: C.textMuted, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Edit</button>
                              <button onClick={() => removeTerm(currentTerm.id)} style={{ background: "none", border: "none", padding: 0, fontSize: 11, color: C.textMuted, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
                              {historyTerms.length > 0 && (
                                <button onClick={() => setTermsHistoryOpen(prev => ({ ...prev, [sc.id]: !prev[sc.id] }))} style={{ background: "none", border: "none", padding: 0, fontSize: 11, color: C.textMuted, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                                  {termsHistoryOpen[sc.id] ? "Hide" : "View"} history ({historyTerms.length})
                                </button>
                              )}
                              <span style={{ flex: 1 }} />
                              <button onClick={() => { setTermsAddingNew(prev => ({ ...prev, [sc.id]: true })); setTermsEditDraft(""); }} style={{ background: "none", border: "none", padding: 0, fontSize: 11, color: C.textMuted, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>+ New entry</button>
                            </div>
                          </div>
                        )}

                        {/* Editing the current entry */}
                        {currentTerm && termsEditingId === currentTerm.id && (
                          <div>
                            <textarea autoFocus value={termsEditDraft} onChange={e => setTermsEditDraft(e.target.value)} placeholder="Describe the billing arrangement…" style={{ width: "100%", padding: "10px 12px", borderRadius: 4, fontSize: 13, fontFamily: "inherit", outline: "none", background: C.card, minHeight: 100, resize: "vertical", lineHeight: 1.55, color: C.text, boxSizing: "border-box" }} />
                            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                              <button onClick={() => saveTermEdit(currentTerm.id)} disabled={!termsEditDraft.trim()} style={{ padding: "6px 12px", background: termsEditDraft.trim() ? C.text : "transparent", color: termsEditDraft.trim() ? "#fff" : C.textMuted, border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: termsEditDraft.trim() ? "pointer" : "default", fontFamily: "inherit" }}>Save</button>
                              <button onClick={() => { setTermsEditingId(null); setTermsEditDraft(""); }} style={{ padding: "6px 12px", background: "transparent", color: C.textMuted, borderRadius: 4, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                            </div>
                          </div>
                        )}

                        {/* Adding a new entry */}
                        {termsAddingNew[sc.id] && (
                          <div>
                            {currentTerm && <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8, fontStyle: "italic" }}>Adding a new entry will become the current terms. Previous entry stays in history.</div>}
                            <textarea autoFocus value={termsEditDraft} onChange={e => setTermsEditDraft(e.target.value)} placeholder="Describe the billing arrangement…" style={{ width: "100%", padding: "10px 12px", borderRadius: 4, fontSize: 13, fontFamily: "inherit", outline: "none", background: C.card, minHeight: 100, resize: "vertical", lineHeight: 1.55, color: C.text, boxSizing: "border-box" }} />
                            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                              <button onClick={addTerm} disabled={!termsEditDraft.trim()} style={{ padding: "6px 12px", background: termsEditDraft.trim() ? C.text : "transparent", color: termsEditDraft.trim() ? "#fff" : C.textMuted, border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: termsEditDraft.trim() ? "pointer" : "default", fontFamily: "inherit" }}>Add entry</button>
                              <button onClick={() => { setTermsAddingNew(prev => ({ ...prev, [sc.id]: false })); setTermsEditDraft(""); }} style={{ padding: "6px 12px", background: "transparent", color: C.textMuted, borderRadius: 4, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                            </div>
                          </div>
                        )}

                        {/* Empty state — no entries, not adding */}
                        {!currentTerm && !termsAddingNew[sc.id] && (
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 4 }}>
                            <span style={{ fontSize: 12, color: C.textMuted, fontStyle: "italic" }}>No billing terms recorded.</span>
                            <button onClick={() => { setTermsAddingNew(prev => ({ ...prev, [sc.id]: true })); setTermsEditDraft(""); }} style={{ background: "none", border: "none", padding: 0, fontSize: 11, color: C.textMuted, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>+ Add entry</button>
                          </div>
                        )}

                        {/* History (older entries) — expanded */}
                        {termsHistoryOpen[sc.id] && historyTerms.length > 0 && (
                          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "0.5px solid " + C.borderLight }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>History</div>
                            {historyTerms.map(t => (
                              <div key={t.id} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: "0.5px dashed " + C.borderLight }}>
                                {termsEditingId === t.id ? (
                                  <div>
                                    <textarea autoFocus value={termsEditDraft} onChange={e => setTermsEditDraft(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 4, fontSize: 13, fontFamily: "inherit", outline: "none", background: C.card, minHeight: 80, resize: "vertical", lineHeight: 1.55, color: C.text, boxSizing: "border-box" }} />
                                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                      <button onClick={() => saveTermEdit(t.id)} disabled={!termsEditDraft.trim()} style={{ padding: "6px 12px", background: termsEditDraft.trim() ? C.text : "transparent", color: termsEditDraft.trim() ? "#fff" : C.textMuted, border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: termsEditDraft.trim() ? "pointer" : "default", fontFamily: "inherit" }}>Save</button>
                                      <button onClick={() => { setTermsEditingId(null); setTermsEditDraft(""); }} style={{ padding: "6px 10px", background: "transparent", color: C.textMuted, borderRadius: 4, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, marginBottom: 4 }}>{formatTermDate(t.created_at)}</div>
                                    <div style={{ fontSize: 13, lineHeight: 1.55, color: C.textSec, whiteSpace: "pre-wrap" }}>{t.body}</div>
                                    <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                                      <button onClick={() => { setTermsEditingId(t.id); setTermsEditDraft(t.body); }} style={{ background: "none", border: "none", padding: 0, fontSize: 11, color: C.textMuted, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Edit</button>
                                      <button onClick={() => removeTerm(t.id)} style={{ background: "none", border: "none", padding: 0, fontSize: 11, color: C.textMuted, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Months — next, current, previous (all read-write for status, prev read-only for items) */}
                      {renderMonth(nextMonth, { isNext: true })}
                      <div style={{ height: 1, background: C.border, margin: "4px 0 20px" }} />
                      {renderMonth(currentMonth)}
                      <div style={{ height: 1, background: C.border, margin: "4px 0 20px" }} />
                      {renderMonth(prevMonth, { readOnly: true })}

                      {pastMonths.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8, paddingTop: 12, borderTop: "1px solid " + C.borderLight }}>Earlier months</div>
                          {pastMonths.map((month, mi) => {
                            const items = getMonthItems(month);
                            const total = getMonthTotal(month);
                            const status = getStatus(month);
                            return (
                              <div key={mi} style={{ background: C.bg, borderRadius: 8, padding: "10px 12px", marginBottom: 6 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: items.length > 0 ? 4 : 0 }}>
                                  <span style={{ fontSize: 14, fontWeight: 600 }}>{month}</span>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    {status.invoiced && <span style={{ fontSize: 10, fontWeight: 700, color: C.warning, padding: "2px 7px", borderRadius: 999, background: "#FAF0DF" }}>Invoiced</span>}
                                    {status.paid && <span style={{ fontSize: 10, fontWeight: 700, color: C.success, padding: "2px 7px", borderRadius: 999, background: "#E8F3EC" }}>Paid</span>}
                                    <span style={{ fontSize: 14, fontWeight: 700, color: C.primary, marginLeft: 4 }}>${total.toLocaleString()}</span>
                                  </div>
                                </div>
                                {items.length > 0 && (
                                  <div style={{ fontSize: 12, color: C.textMuted }}>
                                    {items.map(i => i.description).join(", ")}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* ─── AD-HOC REVENUE (client_addons) ─────────── */}
                      {/* Section for one-time payments outside the monthly
                          rate — setup fees, project bonuses, annual
                          prepays, late fees, anything not on the retainer.
                          Each addon = one DB row, listed newest-first.
                          Saving updates client_addons, which feeds into
                          LTV calc + Rai's context payload. */}
                      <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid " + C.borderLight }}>
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: C.text }}>
                            Ad-hoc revenue
                          </div>
                          {(() => {
                            const addons = clientAddons[sc.id] || [];
                            if (addons.length === 0) return null;
                            const total = addons.reduce((s, a) => s + Number(a.amount || 0), 0);
                            return (
                              <div style={{ fontSize: 12, color: C.textMuted, fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace" }}>
                                {addons.length} {addons.length === 1 ? "entry" : "entries"} · ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                            );
                          })()}
                        </div>
                        <div style={{ fontSize: 12.5, color: C.textMuted, marginBottom: 16, lineHeight: 1.5 }}>
                          One-time payments outside the monthly rate — setup fees, project bonuses, lump sums. These count toward LTV.
                        </div>

                        {/* Existing addons list */}
                        {(clientAddons[sc.id] || []).length > 0 && (
                          <div style={{ marginBottom: 16 }}>
                            {(clientAddons[sc.id] || []).map(a => {
                              const isEditing = editingAddonId === a.id;
                              return (
                                <div key={a.id} style={{
                                  display: "flex", alignItems: "center", gap: 10,
                                  padding: "10px 12px",
                                  borderBottom: "1px solid " + C.borderLight,
                                  fontSize: 13,
                                }}>
                                  {isEditing ? (
                                    <>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={editingAddon.amount}
                                        onChange={e => setEditingAddon(p => ({ ...p, amount: e.target.value }))}
                                        placeholder="0.00"
                                        style={{
                                          width: 100, padding: "6px 8px",
                                          border: "1px solid " + C.borderLight, borderRadius: 6,
                                          fontFamily: "inherit", fontSize: 13,
                                        }}
                                      />
                                      <input
                                        type="date"
                                        value={editingAddon.charged_at}
                                        onChange={e => setEditingAddon(p => ({ ...p, charged_at: e.target.value }))}
                                        style={{
                                          padding: "6px 8px",
                                          border: "1px solid " + C.borderLight, borderRadius: 6,
                                          fontFamily: "inherit", fontSize: 13,
                                        }}
                                      />
                                      <input
                                        type="text"
                                        value={editingAddon.description}
                                        onChange={e => setEditingAddon(p => ({ ...p, description: e.target.value }))}
                                        placeholder="Description"
                                        style={{
                                          flex: 1, padding: "6px 8px",
                                          border: "1px solid " + C.borderLight, borderRadius: 6,
                                          fontFamily: "inherit", fontSize: 13,
                                        }}
                                      />
                                      <button
                                        onClick={async () => {
                                          const amt = parseFloat(editingAddon.amount);
                                          if (!isFinite(amt) || amt <= 0) return;
                                          // Optimistic update
                                          const patch = {
                                            amount: amt,
                                            charged_at: editingAddon.charged_at,
                                            description: editingAddon.description.trim() || null,
                                          };
                                          setClientAddons(prev => ({
                                            ...prev,
                                            [sc.id]: (prev[sc.id] || []).map(x => x.id === a.id ? { ...x, ...patch } : x),
                                          }));
                                          setEditingAddonId(null);
                                          try {
                                            await clientAddonsDb.update(a.id, patch);
                                          } catch (e) {
                                            console.warn("addon update failed:", e);
                                          }
                                        }}
                                        style={{
                                          padding: "6px 12px", border: "none", borderRadius: 6,
                                          background: C.btn, color: "#fff", fontSize: 12, fontWeight: 600,
                                          cursor: "pointer", fontFamily: "inherit",
                                        }}
                                      >Save</button>
                                      <button
                                        onClick={() => setEditingAddonId(null)}
                                        style={{
                                          padding: "6px 10px", border: "none", borderRadius: 6,
                                          background: "transparent", color: C.textMuted, fontSize: 12,
                                          cursor: "pointer", fontFamily: "inherit",
                                        }}
                                      >Cancel</button>
                                    </>
                                  ) : (
                                    <>
                                      <div style={{
                                        fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                                        fontWeight: 600, fontSize: 13,
                                        width: 100, textAlign: "right",
                                        color: C.text,
                                      }}>
                                        ${Number(a.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </div>
                                      <div style={{
                                        fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                                        fontSize: 11.5, color: C.textMuted,
                                        width: 90, flexShrink: 0,
                                      }}>
                                        {a.charged_at}
                                      </div>
                                      <div style={{ flex: 1, color: a.description ? C.text : C.textMuted, fontStyle: a.description ? "normal" : "italic" }}>
                                        {a.description || "(no description)"}
                                      </div>
                                      <button
                                        onClick={() => {
                                          setEditingAddonId(a.id);
                                          setEditingAddon({
                                            amount: String(a.amount),
                                            charged_at: a.charged_at,
                                            description: a.description || "",
                                          });
                                        }}
                                        style={{
                                          padding: "4px 10px", border: "none", borderRadius: 6,
                                          background: "transparent", color: C.textSec, fontSize: 12,
                                          cursor: "pointer", fontFamily: "inherit",
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = "rgba(20,30,22,0.04)"}
                                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                      >Edit</button>
                                      <button
                                        onClick={async () => {
                                          if (!confirm("Delete this addon?")) return;
                                          setClientAddons(prev => ({
                                            ...prev,
                                            [sc.id]: (prev[sc.id] || []).filter(x => x.id !== a.id),
                                          }));
                                          try {
                                            await clientAddonsDb.delete(a.id);
                                          } catch (e) {
                                            console.warn("addon delete failed:", e);
                                          }
                                        }}
                                        style={{
                                          padding: "4px 10px", border: "none", borderRadius: 6,
                                          background: "transparent", color: C.danger, fontSize: 12,
                                          cursor: "pointer", fontFamily: "inherit",
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = "rgba(196,67,43,0.06)"}
                                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                      >Delete</button>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Add new addon row */}
                        <div style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "12px 12px",
                          background: C.surface,
                          borderRadius: 10,
                        }}>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={newAddon.amount}
                            onChange={e => setNewAddon(p => ({ ...p, amount: e.target.value }))}
                            placeholder="0.00"
                            style={{
                              width: 100, padding: "8px 10px",
                              border: "1px solid " + C.borderLight, borderRadius: 6,
                              fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace", fontSize: 13,
                              background: C.card,
                            }}
                          />
                          <input
                            type="date"
                            value={newAddon.charged_at || new Date().toISOString().slice(0, 10)}
                            onChange={e => setNewAddon(p => ({ ...p, charged_at: e.target.value }))}
                            style={{
                              padding: "8px 10px",
                              border: "1px solid " + C.borderLight, borderRadius: 6,
                              fontFamily: "inherit", fontSize: 13,
                              background: C.card,
                            }}
                          />
                          <input
                            type="text"
                            value={newAddon.description}
                            onChange={e => setNewAddon(p => ({ ...p, description: e.target.value }))}
                            placeholder="What was this for? (setup fee, project bonus, annual prepay…)"
                            onKeyDown={async e => {
                              if (e.key !== "Enter") return;
                              const amt = parseFloat(newAddon.amount);
                              if (!isFinite(amt) || amt <= 0) return;
                              const charged = newAddon.charged_at || new Date().toISOString().slice(0, 10);
                              const desc = newAddon.description.trim() || null;
                              try {
                                const { data } = await clientAddonsDb.add(user.id, sc.id, { amount: amt, charged_at: charged, description: desc });
                                if (data) {
                                  setClientAddons(prev => ({
                                    ...prev,
                                    [sc.id]: [data, ...(prev[sc.id] || [])],
                                  }));
                                  setNewAddon({ amount: "", description: "", charged_at: "" });
                                }
                              } catch (err) {
                                console.warn("addon add failed:", err);
                              }
                            }}
                            style={{
                              flex: 1, padding: "8px 10px",
                              border: "1px solid " + C.borderLight, borderRadius: 6,
                              fontFamily: "inherit", fontSize: 13,
                              background: C.card,
                            }}
                          />
                          <button
                            onClick={async () => {
                              const amt = parseFloat(newAddon.amount);
                              if (!isFinite(amt) || amt <= 0) return;
                              const charged = newAddon.charged_at || new Date().toISOString().slice(0, 10);
                              const desc = newAddon.description.trim() || null;
                              try {
                                const { data } = await clientAddonsDb.add(user.id, sc.id, { amount: amt, charged_at: charged, description: desc });
                                if (data) {
                                  setClientAddons(prev => ({
                                    ...prev,
                                    [sc.id]: [data, ...(prev[sc.id] || [])],
                                  }));
                                  setNewAddon({ amount: "", description: "", charged_at: "" });
                                }
                              } catch (err) {
                                console.warn("addon add failed:", err);
                              }
                            }}
                            disabled={!newAddon.amount || parseFloat(newAddon.amount) <= 0}
                            style={{
                              padding: "8px 16px", border: "none", borderRadius: 8,
                              background: (!newAddon.amount || parseFloat(newAddon.amount) <= 0) ? C.surface : "var(--rt-grad-purple)",
                              color: (!newAddon.amount || parseFloat(newAddon.amount) <= 0) ? C.textMuted : "#fff",
                              fontSize: 13, fontWeight: 700,
                              cursor: (!newAddon.amount || parseFloat(newAddon.amount) <= 0) ? "default" : "pointer",
                              fontFamily: "inherit",
                              flexShrink: 0,
                            }}
                          >Add</button>
                        </div>
                      </div>

                    </div>
                  );
                })()}

                {/* Flags — pill toggles with descriptions. Score impact hidden — scoring is magic. */}
                {clientTab === "flags" && (
                  <div>
                    <div style={{ fontSize: 12.5, color: C.textSec, lineHeight: 1.5, marginBottom: 14 }}>
                      These characteristics shape your health score behind the scenes. Keep them current as your client relationship changes.
                    </div>
                    {[
                      { flag: "latePayments",   label: "Late payments",       desc: "Has missed or delayed invoices", delta: -4 },
                      { flag: "prevTerminated", label: "Previously terminated", desc: "Has churned and returned",      delta: -8 },
                      { flag: "otherVendors",   label: "Works with competitors", desc: "Uses other vendors in parallel", delta: -3 },
                      { flag: "fromReferral",   label: "From referral",       desc: "Introduced by an existing client", delta: 2  },
                    ].map(f => {
                      const on = !!sc.qualifyingFlags?.[f.flag];
                      return (
                        <div key={f.flag} onClick={async () => {
                          const newFlags = { ...(sc.qualifyingFlags || {}), [f.flag]: !on };
                          const newRet = Math.max(1, Math.min(99, (sc.ret || 50) + (on ? -f.delta : f.delta)));
                          setClients(prev => prev.map(c => c.id === sc.id ? { ...c, qualifyingFlags: newFlags, ret: newRet } : c));
                          setSelectedClient({ ...sc, qualifyingFlags: newFlags, ret: newRet });
                          clientsDb.update(sc.id, { qualifying_flags: newFlags, retention_score: newRet });
                        }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 0", borderBottom: "1px solid " + C.borderLight, cursor: "pointer" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{f.label}</div>
                            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{f.desc}</div>
                          </div>
                          <div style={{ width: 40, height: 22, borderRadius: 11, background: on ? C.primary : C.border, padding: 2, transition: "background 0.2s", display: "flex", alignItems: "center", flexShrink: 0 }}>
                            <div style={{ width: 18, height: 18, borderRadius: 9, background: "#fff", transform: on ? "translateX(18px)" : "translateX(0)", transition: "transform 0.2s" }} />
                          </div>
                        </div>
                      );
                    })}
                    {/* Paused — fifth entry. Unlike the four above, this is
                        NOT an independently-toggleable qualifying flag: it
                        mirrors the client's actual pause state (is_paused),
                        the single source of truth. Toggling it routes through
                        the same pause/resume confirmation modal as the
                        overflow menu, so the -4 is applied in exactly one
                        place (the pause handler) and never double-counts.
                        Shown here purely for transparency — so the user sees
                        the pause penalty alongside the other score factors. */}
                    {(() => {
                      const on = !!sc.is_paused;
                      return (
                        <div onClick={() => {
                          setClientTab("overview");
                          if (on) { setResumeConfirm(true); } else { setPauseConfirm(true); }
                          setRolodexConfirm(false); setRemoveConfirm(false);
                        }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 0", borderBottom: "1px solid " + C.borderLight, cursor: "pointer" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Paused</div>
                            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Relationship is on hold — tenure clock frozen</div>
                          </div>
                          <div style={{ width: 40, height: 22, borderRadius: 11, background: on ? C.warning : C.border, padding: 2, transition: "background 0.2s", display: "flex", alignItems: "center", flexShrink: 0 }}>
                            <div style={{ width: 18, height: 18, borderRadius: 9, background: "#fff", transform: on ? "translateX(18px)" : "translateX(0)", transition: "transform 0.2s" }} />
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* ─── CONFIDANT TAB — per-client Rai chat ─────────── */}
                {/* Threading model: one persistent conversation per
                    (user, client) pair, loaded via convoDb.getOrCreate
                    on tab open. Edge Function gets focused_client_id
                    set so Rai sees the full 30-day relationship history
                    (touchpoints, completions, calendar, observations).
                    Messages cap at 30 in active context, but full
                    history persists in DB. */}
                {clientTab === "rai" && (
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    height: "calc(100vh - 280px)",
                    minHeight: 480,
                    background: "linear-gradient(180deg, " + C.surfaceWarm + "00, " + C.primaryGhost + "60)",
                    borderRadius: 12,
                    border: "1px solid " + C.borderLight,
                    overflow: "hidden",
                  }}>
                    {/* Eyebrow — client avatar + "Talking with Rai about [client]" */}
                    <div style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid " + C.borderLight,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      background: C.card,
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%",
                        background: sc.color || C.primary,
                        color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700,
                        flexShrink: 0,
                      }}>
                        {(sc.name || "?").slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{sc.name}</div>
                        <div style={{ fontSize: 11, color: C.textMuted, fontFamily: "'Fraunces', Georgia, serif", fontStyle: "italic" }}>
                          {(() => {
                            // Subtitle has two modes: "fresh thread" shows
                            // the explainer ("She remembers everything"),
                            // "thread with history" shows when the last
                            // exchange happened. Reading "Last spoke 3d
                            // ago" is the moment the persistence becomes
                            // visible to the user — without it, the
                            // memory feature is invisible.
                            if (!confidantLastActivity || confidantMessages.length === 0) {
                              return "A private thread with Rai. She remembers everything.";
                            }
                            const diffMs = Date.now() - new Date(confidantLastActivity).getTime();
                            const hours = Math.floor(diffMs / (60 * 60 * 1000));
                            let when;
                            if (hours < 1) when = "just now";
                            else if (hours < 24) when = hours + "h ago";
                            else {
                              const days = Math.floor(hours / 24);
                              if (days === 1) when = "yesterday";
                              else if (days < 30) when = days + "d ago";
                              else {
                                const months = Math.floor(days / 30);
                                when = months + "mo ago";
                              }
                            }
                            const exchangeCount = Math.floor(confidantMessages.length / 2);
                            return `Last spoke ${when} · ${exchangeCount} exchange${exchangeCount === 1 ? "" : "s"} on file`;
                          })()}
                        </div>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M12 4l2.2 5.8 5.8 2.2-5.8 2.2L12 20l-2.2-5.8L4 12l5.8-2.2L12 4z" fill={C.btn} />
                      </svg>
                    </div>

                    {/* Message list */}
                    <div style={{
                      flex: 1,
                      overflowY: "auto",
                      padding: "16px 16px 4px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}>
                      {confidantLoadingThread ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: C.textMuted, fontSize: 13 }}>
                          Loading conversation…
                        </div>
                      ) : confidantMessages.length === 0 ? (
                        <div style={{
                          margin: "auto",
                          textAlign: "center",
                          maxWidth: 360,
                          padding: "32px 24px",
                        }}>
                          <div style={{
                            fontFamily: "'Fraunces', Georgia, serif",
                            fontStyle: "italic",
                            fontSize: 22,
                            color: C.text,
                            letterSpacing: "-0.015em",
                            marginBottom: 10,
                            lineHeight: 1.25,
                          }}>
                            Hi. What's on your mind about {sc.name}?
                          </div>
                          <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.55 }}>
                            I have their last 30 days in mind — touchpoints, completed work, what's coming up. Ask me anything.
                          </div>
                        </div>
                      ) : (
                        confidantMessages.map((m, i) => (
                          <div key={i} style={{
                            display: "flex",
                            justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                          }}>
                            <div style={{
                              maxWidth: "78%",
                              padding: "10px 14px",
                              borderRadius: 14,
                              background: m.role === "user" ? C.text : C.card,
                              color: m.role === "user" ? "#fff" : C.text,
                              fontSize: 16,
                              lineHeight: 1.5,
                              boxShadow: m.role === "ai" ? "var(--rt-sh-xs)" : "none",
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                            }}>
                              {m.text || (m.role === "ai" ? (
                                <span style={{ color: C.textMuted }}>…</span>
                              ) : null)}
                            </div>
                          </div>
                        ))
                      )}
                      {confidantTyping && confidantMessages.length > 0 && confidantMessages[confidantMessages.length - 1]?.role !== "ai" && (
                        <div style={{ display: "flex", justifyContent: "flex-start" }}>
                          <div style={{
                            padding: "10px 14px",
                            borderRadius: 14,
                            background: C.card,
                            color: C.textMuted,
                            fontSize: 16,
                            boxShadow: "var(--rt-sh-xs)",
                          }}>
                            …
                          </div>
                        </div>
                      )}
                      <div ref={confidantEndRef} />
                    </div>

                    {/* Input bar */}
                    <div style={{
                      padding: "12px 16px",
                      borderTop: "1px solid " + C.borderLight,
                      background: C.card,
                      display: "flex",
                      alignItems: "flex-end",
                      gap: 10,
                    }}>
                      <textarea
                        value={confidantInput}
                        onChange={e => setConfidantInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (confidantInput.trim() && !confidantTyping) {
                              sendConfidantMessage(confidantInput, sc.id);
                            }
                          }
                        }}
                        placeholder={`Ask Rai about ${sc.name}…`}
                        rows={1}
                        style={{
                          flex: 1,
                          border: "1px solid " + C.borderLight,
                          borderRadius: 10,
                          padding: "10px 12px",
                          fontSize: 16,
                          fontFamily: "inherit",
                          background: C.bg,
                          color: C.text,
                          resize: "none",
                          minHeight: 38,
                          maxHeight: 160,
                          outline: "none",
                          lineHeight: 1.4,
                        }}
                        disabled={confidantTyping || confidantLoadingThread}
                      />
                      <button
                        onClick={() => {
                          if (confidantInput.trim() && !confidantTyping) {
                            sendConfidantMessage(confidantInput, sc.id);
                          }
                        }}
                        disabled={!confidantInput.trim() || confidantTyping || confidantLoadingThread}
                        style={{
                          padding: "10px 16px",
                          borderRadius: 10,
                          border: "none",
                          background: confidantInput.trim() && !confidantTyping ? "var(--rt-grad-purple)" : C.surface,
                          color: confidantInput.trim() && !confidantTyping ? "#fff" : C.textMuted,
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: confidantInput.trim() && !confidantTyping ? "pointer" : "default",
                          fontFamily: "inherit",
                          flexShrink: 0,
                          height: 38,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {confidantTyping ? "Thinking…" : "Send"}
                      </button>
                    </div>
                  </div>
                )}

              </div>

            </div>
          </>
        );
      })()}


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

      {selectedRolodex && (() => {
        const sr = selectedRolodex;
        const answers = retroAnswers[sr.id] || {};
        const ed = rolodexEditData;
        const priorityOpts = [
          { id: "high", label: "High priority", color: C.success },
          { id: "medium", label: "Medium priority", color: C.warning },
          { id: "low", label: "Low priority", color: C.textMuted },
        ];
        return (
          <>
            {/* Backdrop — matches the client modal: dim + 2px blur. */}
            <div onClick={() => setSelectedRolodex(null)} style={{ position: "fixed", inset: 0, background: "rgba(20,30,22,0.38)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)", zIndex: 90 }} />
            <div className="r-client-modal" style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "100%", maxWidth: 520, maxHeight: "90vh", background: C.card, boxShadow: "0 1px 3px rgba(20,30,22,0.10), 0 8px 20px rgba(20,30,22,0.14), 0 25px 50px rgba(20,30,22,0.22), inset 0 1px 0 rgba(255,255,255,0.9)", zIndex: 100, overflowY: "auto", borderRadius: 16 }}>
              {/* Top bar — neighbor nav (↑↓) + breadcrumb + ⋯ actions + ×,
                  matching the client modal chrome exactly. */}
              {(() => {
                const navList = (rolodex || []).filter(r => r && r.id);
                const currentIdx = navList.findIndex(r => r.id === sr.id);
                const total = navList.length;
                const hasNav = total > 1 && currentIdx >= 0;
                const goPrev = () => { if (!hasNav) return; const n = navList[currentIdx === 0 ? total - 1 : currentIdx - 1]; if (n) setSelectedRolodex(n); };
                const goNext = () => { if (!hasNav) return; const n = navList[currentIdx === total - 1 ? 0 : currentIdx + 1]; if (n) setSelectedRolodex(n); };
                const prevC = hasNav ? navList[currentIdx === 0 ? total - 1 : currentIdx - 1] : null;
                const nextC = hasNav ? navList[currentIdx === total - 1 ? 0 : currentIdx + 1] : null;
                return (
                  <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, position: "sticky", top: 0, background: C.card, zIndex: 2, borderBottom: "1px solid " + C.borderLight }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                      <button onClick={goPrev} disabled={!hasNav} title={prevC ? `Previous · ${prevC.client}` : "Previous"} aria-label="Previous" className="rt-so-nav" style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", color: hasNav ? C.textSec : C.textMuted, cursor: hasNav ? "pointer" : "default", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16, lineHeight: 1, padding: 0 }}>↑</button>
                      <button onClick={goNext} disabled={!hasNav} title={nextC ? `Next · ${nextC.client}` : "Next"} aria-label="Next" className="rt-so-nav" style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", color: hasNav ? C.textSec : C.textMuted, cursor: hasNav ? "pointer" : "default", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16, lineHeight: 1, padding: 0 }}>↓</button>
                    </div>
                    {hasNav && (
                      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: C.textMuted, fontVariantNumeric: "tabular-nums", display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span>Rolodex</span>
                        <span style={{ opacity: 0.5 }}>·</span>
                        <span>{currentIdx + 1} of {total}</span>
                      </div>
                    )}
                    <div style={{ marginLeft: "auto", position: "relative", display: "flex", alignItems: "center", gap: 6 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setRolodexMenuOpen(v => !v); }}
                        aria-label="Contact actions"
                        style={{ background: rolodexMenuOpen ? C.surfaceWarm : "none", border: "none", fontSize: 20, cursor: "pointer", color: rolodexMenuOpen ? C.text : C.textSec, lineHeight: 1, padding: 0, width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, transition: "background 120ms ease" }}
                      >⋯</button>
                      {rolodexMenuOpen && (
                        <>
                          <div onClick={() => setRolodexMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 4 }} />
                          <div style={{ position: "absolute", top: 36, right: 0, background: C.card, border: "1px solid " + C.borderLight, borderRadius: 10, boxShadow: "0 8px 24px rgba(20,30,22,0.12), 0 2px 6px rgba(20,30,22,0.06)", minWidth: 180, padding: 6, zIndex: 5 }}>
                            <div
                              onClick={() => { setRolodexMenuOpen(false); setRolodexEditing(true); setRolodexEditData({ contact: sr.contact, months: sr.months, priority: sr.priority || "", notes: sr.notes || "", what: answers.what || "", work: answers.work || "", terms: answers.terms || "", comeback: answers.comeback || "", refer: answers.refer || "" }); }}
                              style={{ padding: "10px 12px", fontSize: 13, color: C.text, cursor: "pointer", borderRadius: 6, fontWeight: 500 }}
                              onMouseEnter={e => e.currentTarget.style.background = C.surfaceWarm}
                              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                            >Edit details</div>
                            <div
                              onClick={() => { setRolodexMenuOpen(false); setRolodexMoveConfirm(true); setRolodexRemoveConfirm(false); }}
                              style={{ padding: "10px 12px", fontSize: 13, color: C.text, cursor: "pointer", borderRadius: 6, fontWeight: 500 }}
                              onMouseEnter={e => e.currentTarget.style.background = C.surfaceWarm}
                              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                            >Move to Clients</div>
                            <div style={{ borderTop: "1px solid " + C.borderLight, margin: "4px 0" }} />
                            <div
                              onClick={() => { setRolodexMenuOpen(false); setRolodexRemoveConfirm(true); setRolodexMoveConfirm(false); }}
                              style={{ padding: "10px 12px", fontSize: 13, color: C.danger, cursor: "pointer", borderRadius: 6, fontWeight: 500 }}
                              onMouseEnter={e => e.currentTarget.style.background = C.surfaceWarm}
                              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                            >Delete</div>
                          </div>
                        </>
                      )}
                      <button onClick={() => setSelectedRolodex(null)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.textMuted, lineHeight: 1, padding: 0, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                    </div>
                  </div>
                );
              })()}

              {/* Hero — gradient band: type · name, matching client modal hero. */}
              <div style={{ padding: "20px 20px 14px", background: "linear-gradient(180deg, " + C.surfaceWarm + " 0%, " + C.card + " 100%)" }}>
                <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, marginBottom: 6 }}>
                  {sr.type === "oneoff" ? "New lead" : "Former Client"}{sr.months > 0 ? " · " + (sr.months >= 12 ? (sr.months / 12).toFixed(1) + " years" : sr.months + " months") : ""}
                </div>
                <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, color: C.text, margin: 0, lineHeight: 1.15 }}>{sr.client}</h2>
              </div>

              {/* Move-to-Clients confirm */}
              {rolodexMoveConfirm && (
                <div style={{ margin: "0 20px 12px", padding: 14, background: C.primaryGhost, borderRadius: 10, border: "1px solid " + C.borderLight }}>
                  <p style={{ fontSize: 14, color: C.text, lineHeight: 1.5, marginBottom: 12 }}>Move {sr.client} into your active clients? They'll start fresh at a neutral score and this rolodex entry will be archived.</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => moveRolodexToClients(sr)} className="r-btn" data-tone="purple" style={{ flex: 1, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Move to Clients</button>
                    <button onClick={() => setRolodexMoveConfirm(false)} style={{ padding: "10px 14px", background: C.surface, color: C.text, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                  </div>
                </div>
              )}
              {/* Delete confirm */}
              {rolodexRemoveConfirm && (
                <div style={{ margin: "0 20px 12px", padding: 14, background: "#FBEAE3", borderRadius: 10, border: "1px solid " + C.borderLight }}>
                  <p style={{ fontSize: 14, color: C.text, lineHeight: 1.5, marginBottom: 12 }}>Delete {sr.client} from your rolodex? They'll be archived — kept on file but no longer shown. Referral history stays intact.</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { setRolodex(prev => prev.filter(x => x.id !== sr.id)); rolodexDb.delete(sr.id); setSelectedRolodex(null); setRolodexRemoveConfirm(false); }} style={{ flex: 1, padding: "10px", background: C.danger, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
                    <button onClick={() => setRolodexRemoveConfirm(false)} style={{ padding: "10px 14px", background: C.surface, color: C.text, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                  </div>
                </div>
              )}
              <div style={{ padding: "4px 20px 16px" }}>
                {!rolodexEditing ? (
                  <>
                    {[
                      { l: "Contact", v: sr.contact },
                      { l: "Together", v: sr.months > 0 ? sr.months + " months" : "One-time" },
                      { l: "Added", v: sr.date },
                      { l: "Priority", v: sr.priority ? (sr.priority === "high" ? "High" : sr.priority === "medium" ? "Medium" : "Low") : "Not set" },
                      { l: "Reminder", v: sr.reminder ? (new Date(sr.reminder).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + (sr.reminderRecurrence && sr.reminderRecurrence !== "none" ? " · repeats " + ({ "2w": "2wk", "1m": "monthly", "3m": "3mo", "6m": "6mo" }[sr.reminderRecurrence] || "") : "")) : "None set" },
                    ].map((d, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid " + C.borderLight }}>
                        <span style={{ fontSize: 14, color: C.textMuted }}>{d.l}</span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: d.l === "Reminder" && sr.reminder ? C.primary : C.text }}>{d.v}</span>
                      </div>
                    ))}
                    {sr.notes && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>Notes</div>
                        <div style={{ fontSize: 14, color: C.text, lineHeight: 1.5, background: C.bg, borderRadius: 8, padding: "10px 12px" }}>{sr.notes}</div>
                      </div>
                    )}
                    {(answers.what || answers.work) && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>History</div>
                        {[
                          { l: "What happened", v: answers.what },
                          { l: "What you did", v: answers.work },
                          { l: "How it ended", v: answers.terms },
                          { l: "Would come back", v: answers.comeback },
                          { l: "Would refer", v: answers.refer },
                        ].filter(d => d.v).map((d, i) => (
                          <div key={i} style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 14, color: C.textMuted, marginBottom: 2 }}>{d.l}</div>
                            <div style={{ fontSize: 14, color: C.text, lineHeight: 1.4 }}>{d.v}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {sr.tags.length > 0 && (
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 14 }}>
                        {sr.tags.map((t, j) => <span key={j} style={{ fontSize: 12, padding: "3px 8px", borderRadius: 4, background: t.includes("Would refer") || t.includes("Good terms") || t.includes("Would come back") ? C.primarySoft : C.surface, color: t.includes("Would refer") || t.includes("Good terms") || t.includes("Would come back") ? C.primary : C.textSec, fontWeight: 600 }}>{t}</span>)}
                      </div>
                    )}
                    {!showReminderPicker ? (
                      <button onClick={() => { setShowReminderPicker(true); setReminderDate(sr.reminder || ""); const rc = sr.reminderRecurrence || "none"; setReminderRepeatOn(rc !== "none"); setReminderRecur(rc !== "none" ? rc : "1m"); }} style={{ width: "100%", padding: "12px 14px", background: sr.reminder ? C.primaryGhost : C.surfaceWarm, color: sr.reminder ? C.primary : C.text, border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 16, textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        {sr.reminder ? (
                          <>
                            <span>Check-in reminder{sr.reminderRecurrence && sr.reminderRecurrence !== "none" ? " · repeats" : ""}</span>
                            <span style={{ fontWeight: 600, color: C.primary }}>{new Date(sr.reminder + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                          </>
                        ) : (
                          <>
                            <span style={{ color: C.textSec }}>Set a check-in reminder</span>
                            <Icon name="chevron-right" size={15} color={C.textMuted} />
                          </>
                        )}
                      </button>
                    ) : null}
                    {!showReminderPicker && sr.reminder && String(sr.reminder).slice(0, 10) <= localYmd() && (() => {
                      const recurring = sr.reminderRecurrence && sr.reminderRecurrence !== "none";
                      return (
                        <button onClick={async () => {
                          // Acting on a due check-in. Recurring → advance to the next
                          // occurrence (now + interval, snapped to Monday). One-off → clear.
                          let nextDate = null, nextRecur = "none";
                          if (recurring) {
                            const days = { "2w": 14, "1m": 30, "3m": 90, "6m": 180 }[sr.reminderRecurrence] || 30;
                            const t = new Date(Date.now() + days * 86400000);
                            const dow = t.getDay();
                            const diff = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
                            nextDate = localYmd(new Date(t.getTime() + diff * 86400000));
                            nextRecur = sr.reminderRecurrence;
                          }
                          const prev = rolodex;
                          setRolodex(p => p.map(x => x.id === sr.id ? { ...x, reminder: nextDate, reminderRecurrence: nextRecur } : x));
                          setSelectedRolodex({ ...sr, reminder: nextDate, reminderRecurrence: nextRecur });
                          try {
                            const { error } = await rolodexDb.update(sr.id, { reminder_date: nextDate, reminder_recurrence: nextRecur });
                            if (error) throw error;
                          } catch (e) {
                            console.error("Check-in advance failed:", e);
                            setRolodex(prev); setSelectedRolodex(sr);
                            alert("Could not update reminder. Please try again.");
                          }
                        }} style={{ width: "100%", padding: "10px 14px", marginTop: 8, background: C.primary, color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                          Mark checked in{recurring ? " · schedule next" : ""}
                        </button>
                      );
                    })()}
                    {showReminderPicker && (
                      <div style={{ marginTop: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>When should Rai remind you?</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                          {[
                            { label: "2 weeks", days: 14, recur: "2w" },
                            { label: "1 month", days: 30, recur: "1m" },
                            { label: "3 months", days: 90, recur: "3m" },
                            { label: "6 months", days: 180, recur: "6m" },
                          ].map(q => {
                            const target = new Date(Date.now() + q.days * 24 * 60 * 60 * 1000);
                            const dow = target.getDay();
                            const diff = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
                            const monday = new Date(target.getTime() + diff * 24 * 60 * 60 * 1000);
                            const d = localYmd(monday);
                            const sel = reminderDate === d;
                            return (
                              <button key={q.label} onClick={() => { setReminderDate(d); setReminderRecur(q.recur); }} style={{ flex: 1, padding: "10px 8px", borderRadius: 8, border: "1.5px solid " + (sel ? C.primary : C.border), background: sel ? C.primarySoft : C.bg, color: sel ? C.primary : C.text, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{q.label}</button>
                            );
                          })}
                        </div>
                        {reminderDate && <div style={{ fontSize: 14, color: C.primary, fontWeight: 600, marginBottom: 12 }}>Monday, {new Date(reminderDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>}
                        {reminderDate && (() => {
                          const label = { "2w": "every 2 weeks", "1m": "monthly", "3m": "every 3 months", "6m": "every 6 months" }[reminderRecur] || "on a repeat";
                          return (
                            <button onClick={() => setReminderRepeatOn(v => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "10px 12px", marginBottom: 12, background: reminderRepeatOn ? C.primaryGhost : C.bg, border: "1.5px solid " + (reminderRepeatOn ? C.primary : C.border), borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>
                              <span style={{ fontSize: 13.5, fontWeight: 600, color: reminderRepeatOn ? C.primary : C.textSec }}>Repeat {reminderRepeatOn ? label : ""}</span>
                              <span style={{ width: 36, height: 20, borderRadius: 999, background: reminderRepeatOn ? C.primary : C.border, position: "relative", flexShrink: 0, transition: "background 150ms" }}>
                                <span style={{ position: "absolute", top: 2, left: reminderRepeatOn ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 150ms" }} />
                              </span>
                            </button>
                          );
                        })()}
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={async () => {
                            // Persist the reminder date to DB. Before this fix
                            // the reminder was only kept in local state and
                            // would disappear on refresh — silent data loss.
                            if (reminderDate) {
                              const recurVal = reminderRepeatOn ? reminderRecur : "none";
                              const prev = rolodex;
                              setRolodex(p => p.map(x => x.id === sr.id ? { ...x, reminder: reminderDate, reminderRecurrence: recurVal } : x));
                              setSelectedRolodex({ ...sr, reminder: reminderDate, reminderRecurrence: recurVal });
                              try {
                                const { error } = await rolodexDb.update(sr.id, { reminder_date: reminderDate, reminder_recurrence: recurVal });
                                if (error) throw error;
                              } catch (e) {
                                console.error("Reminder save failed:", e);
                                setRolodex(prev);
                                setSelectedRolodex(sr);
                                alert("Could not save reminder. Please try again.");
                                return;
                              }
                            }
                            setShowReminderPicker(false);
                          }} style={{ flex: 1, padding: "11px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
                          {sr.reminder && <button onClick={async () => {
                            // Persist the reminder removal to DB. Same data-
                            // loss pattern as the save path — was previously
                            // local-only.
                            const prev = rolodex;
                            setRolodex(p => p.map(x => x.id === sr.id ? { ...x, reminder: null, reminderRecurrence: "none" } : x));
                            setSelectedRolodex({ ...sr, reminder: null, reminderRecurrence: "none" });
                            setReminderDate("");
                            setReminderRepeatOn(false);
                            setShowReminderPicker(false);
                            try {
                              const { error } = await rolodexDb.update(sr.id, { reminder_date: null, reminder_recurrence: "none" });
                              if (error) throw error;
                            } catch (e) {
                              console.error("Reminder remove failed:", e);
                              setRolodex(prev);
                              setSelectedRolodex(sr);
                              alert("Could not remove reminder. Please try again.");
                            }
                          }} style={{ padding: "10px 14px", background: "transparent", color: C.danger, border: "1px solid " + C.danger + "44", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Remove</button>}
                          <button onClick={() => setShowReminderPicker(false)} style={{ padding: "10px 14px", background: C.surface, color: C.text, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Edit Details</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Contact name</label>
                        <input value={ed.contact} onChange={e => setRolodexEditData({...ed, contact: e.target.value})} style={{ width: "100%", padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Months together</label>
                        <input type="number" value={ed.months} onChange={e => setRolodexEditData({...ed, months: parseInt(e.target.value) || 0})} style={{ width: "100%", padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Priority</label>
                        <div style={{ display: "flex", gap: 6 }}>
                          {priorityOpts.map(opt => (
                            <button key={opt.id} onClick={() => setRolodexEditData({...ed, priority: opt.id})} style={{ flex: 1, padding: "8px", borderRadius: 6, border: "1.5px solid " + (ed.priority === opt.id ? opt.color : C.borderLight), background: ed.priority === opt.id ? opt.color + "18" : C.bg, color: ed.priority === opt.id ? opt.color : C.textSec, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{opt.label.replace(" priority", "")}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Notes</label>
                        <textarea value={ed.notes} onChange={e => setRolodexEditData({...ed, notes: e.target.value})} placeholder="Log a check-in, add context, anything worth remembering..." style={{ width: "100%", padding: "10px 12px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg, minHeight: 80, resize: "vertical" }} />
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginTop: 16, marginBottom: 12 }}>History</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {sr.type === "former" ? (
                        <>
                          <div><label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>What happened?</label><textarea value={ed.what} onChange={e => setRolodexEditData({...ed, what: e.target.value})} placeholder="Contract ended, budget cut, went in-house..." style={{ width: "100%", padding: "10px 12px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg, minHeight: 60, resize: "vertical" }} /></div>
                          <div><label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>How did it end?</label><textarea value={ed.terms} onChange={e => setRolodexEditData({...ed, terms: e.target.value})} placeholder="Good terms, neutral, rough..." style={{ width: "100%", padding: "10px 12px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg, minHeight: 60, resize: "vertical" }} /></div>
                          <div><label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Would they come back?</label><textarea value={ed.comeback} onChange={e => setRolodexEditData({...ed, comeback: e.target.value})} placeholder="Yes, maybe, no..." style={{ width: "100%", padding: "10px 12px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg, minHeight: 60, resize: "vertical" }} /></div>
                        </>
                      ) : (
                        <div><label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>What did you do for them?</label><textarea value={ed.work} onChange={e => setRolodexEditData({...ed, work: e.target.value})} placeholder="Site audit, consulting session..." style={{ width: "100%", padding: "10px 12px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg, minHeight: 60, resize: "vertical" }} /></div>
                      )}
                      <div><label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Would they refer you?</label><textarea value={ed.refer} onChange={e => setRolodexEditData({...ed, refer: e.target.value})} placeholder="Even if they left, would they recommend you?" style={{ width: "100%", padding: "10px 12px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg, minHeight: 60, resize: "vertical" }} /></div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                      <button onClick={() => setRolodexEditing(false)} style={{ padding: "10px 16px", background: C.surface, color: C.textSec, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                      <button onClick={async () => {
                        const tags = [];
                        if ((ed.terms || "").toLowerCase().includes("good")) tags.push("Good terms");
                        if ((ed.refer || "").toLowerCase().includes("yes")) tags.push("Would refer");
                        if ((ed.comeback || "").toLowerCase().includes("yes")) tags.push("Would come back");
                        if (sr.type === "oneoff") tags.push("New lead");
                        const newRetroAnswers = { ...(retroAnswers[sr.id] || {}), what: ed.what, work: ed.work, terms: ed.terms, comeback: ed.comeback, refer: ed.refer };
                        const updated = { ...sr, contact: ed.contact, months: ed.months, priority: ed.priority, notes: ed.notes, tags };
                        // Persist to DB. Before this fix, edits were local-only —
                        // refreshing the page lost every change. The DB column
                        // map: contact→contact_name, months→months, priority→
                        // priority, notes→notes, tags→tags, plus retro_answers.
                        const prevRolodex = rolodex;
                        const prevAnswers = retroAnswers;
                        setRolodex(prev => prev.map(x => x.id === sr.id ? updated : x));
                        setRetroAnswers(prev => ({ ...prev, [sr.id]: newRetroAnswers }));
                        setSelectedRolodex(updated);
                        setRolodexEditing(false);
                        try {
                          const { error } = await rolodexDb.update(sr.id, {
                            contact_name: ed.contact,
                            months: parseInt(ed.months) || 0,
                            priority: ed.priority || null,
                            notes: ed.notes || "",
                            tags,
                            retro_answers: newRetroAnswers,
                          });
                          if (error) throw error;
                        } catch (e) {
                          console.error("Rolodex edit save failed:", e);
                          setRolodex(prevRolodex);
                          setRetroAnswers(prevAnswers);
                          setSelectedRolodex(sr);
                          alert("Could not save changes. Please try again — your edits were not persisted.");
                        }
                      }} style={{ flex: 1, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        );
      })()}


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
      {(() => {
        const primary = tier === "enterprise" ? mobileNavEnterprisePrimary : mobileNavPrimary;
        const moreBase = tier === "enterprise" ? mobileNavEnterpriseMore : mobileNavMore;
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
        const tabBtn = (n) => {
          const dot = hasDot(n.id);
          const active = page === n.id;
          return (
            <button
              key={n.id}
              className={"nav-item-mobile" + (active ? " is-active" : "")}
              onClick={() => { setMobileMoreOpen(false); goTo(n.id); }}
              style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                background: "transparent", border: "none", cursor: "pointer",
                padding: "7px 2px 5px", position: "relative", fontFamily: "inherit",
              }}
            >
              <Icon name={n.icon} size={21} color={active ? C.primary : C.textMuted} accent={active ? C.primary : C.ink300} />
              <span style={{ fontSize: 9.5, fontWeight: active ? 700 : 500, color: active ? C.primary : C.textMuted }}>{n.label}</span>
              {dot && <div style={{ position: "absolute", top: 4, left: "calc(50% + 8px)", width: 7, height: 7, borderRadius: "50%", background: C.danger, boxShadow: "0 0 0 2px " + C.card }} />}
            </button>
          );
        };
        return createPortal(
          <>
            {mobileMoreOpen && (
              <div className="r-mob-bot-dock" style={{ position: "fixed", inset: 0, zIndex: 89 }}>
                <div onClick={() => setMobileMoreOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(20,30,22,0.38)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }} />
                <div style={{
                  position: "absolute", left: 0, right: 0, bottom: 0,
                  background: C.card, borderRadius: "18px 18px 0 0",
                  padding: "12px 16px calc(86px + env(safe-area-inset-bottom, 0px))",
                  boxShadow: "0 -10px 36px rgba(20,30,22,0.16)",
                }}>
                  <div style={{ width: 32, height: 4, borderRadius: 999, background: C.borderLight, margin: "0 auto 12px" }} />
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: 0.5, marginBottom: 9 }}>MORE</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                    {sheetItems.map(n => {
                      const dot = hasDot(n.id);
                      const active = page === n.id;
                      return (
                        <button key={n.id} onClick={() => { setMobileMoreOpen(false); goTo(n.id); }} style={{
                          display: "flex", alignItems: "center", gap: 8,
                          background: active ? C.primarySoft : C.surface, border: "none", borderRadius: 10,
                          padding: "12px 13px", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                        }}>
                          <Icon name={n.icon} size={17} color={active ? C.primary : C.textSec} accent={active ? C.primary : C.ink300} />
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: active ? C.primary : C.text }}>{n.label}</span>
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
                position: "fixed", bottom: 0, left: 0, right: 0,
                background: C.card,
                borderTop: "1px solid " + C.border,
                boxShadow: "0 -4px 16px rgba(20,30,22,0.05)",
                padding: "0 6px calc(6px + env(safe-area-inset-bottom, 0px))",
                zIndex: 90,
                display: keyboardOpen ? "none" : "flex",
                alignItems: "center",
              }}
            >
              {left.map(tabBtn)}
              <div style={{ flex: "0 0 66px", display: "flex", justifyContent: "center" }}>
                <button
                  onClick={() => { setMobileMoreOpen(false); setQuickLogOpen(v => !v); }}
                  aria-label="Quick capture"
                  className="rt-mob-fab"
                  style={{
                    width: 48, height: 48, borderRadius: "50%", border: "4px solid " + C.bg,
                    background: C.primaryDeep, marginTop: -22,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", padding: 0,
                    boxShadow: "0 4px 14px rgba(28,50,36,0.30)",
                    transform: quickLogOpen ? "rotate(45deg)" : "none",
                    transition: "transform 180ms ease-out",
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <path d="M9 3.5V14.5M3.5 9H14.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              {right.map(tabBtn)}
              <button
                onClick={() => setMobileMoreOpen(v => !v)}
                className={"nav-item-mobile" + (mobileMoreOpen ? " is-active" : "")}
                aria-label="More pages"
                style={{
                  flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                  background: "transparent", border: "none", cursor: "pointer",
                  padding: "7px 2px 5px", position: "relative", fontFamily: "inherit",
                }}
              >
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="5" cy="12" r="1.8" fill={mobileMoreOpen ? C.primary : C.textMuted} />
                  <circle cx="12" cy="12" r="1.8" fill={mobileMoreOpen ? C.primary : C.textMuted} />
                  <circle cx="19" cy="12" r="1.8" fill={mobileMoreOpen ? C.primary : C.textMuted} />
                </svg>
                <span style={{ fontSize: 9.5, fontWeight: mobileMoreOpen ? 700 : 500, color: mobileMoreOpen ? C.primary : C.textMuted }}>More</span>
                {sheetHasDot && !mobileMoreOpen && <div style={{ position: "absolute", top: 4, left: "calc(50% + 8px)", width: 7, height: 7, borderRadius: "50%", background: C.danger, boxShadow: "0 0 0 2px " + C.card }} />}
              </button>
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
            <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 0.5, fontWeight: 600, marginBottom: 8 }}>QUICK LOG</div>
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
                  // DEFAULT IS TASK. Route to touchpoint ONLY on explicit
                  // past-tense ("called", "met") or comm-noun ("call with X")
                  // phrasing AND a matched client. (Previously QuickLog inverted
                  // this and defaulted to touchpoint — that mis-logged tasks like
                  // "create ads." Now both surfaces classify identically.)
                  const lower = rawText.toLowerCase();
                  const isCommNoun = /\bcall with\b|\bmet with\b|\bmeeting with\b|\bspoke (?:to|with)\b|\bcaught up with\b|\bcall w\/|\blunch with\b|\bcoffee with\b/i.test(lower);
                  const isPastTouch = /\b(called|emailed|texted|messaged|pinged|spoke|met|caught up|chatted|rang|reached out|followed up|checked in)\b/i.test(lower);
                  const isTask = !(isCommNoun || isPastTouch);

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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, paddingTop: 10, borderTop: "0.5px solid " + C.borderLight }}>
              <span style={{ fontSize: 11, color: C.textMuted }}>Past tense → touchpoint · future → task</span>
              <span style={{ fontSize: 11, color: C.textMuted }}>⏎ to log · Esc</span>
            </div>
          </div>
        </>
      )}



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
