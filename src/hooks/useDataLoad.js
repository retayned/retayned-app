// ─── useDataLoad (June 2026 refactor, Piece E module 4) ────────────────
// The entire hydration layer — the loadData useCallback — moved VERBATIM
// from App.jsx. One function, one concern: read every table for this
// user and light up the app's state. Returns the memoized loadData;
// App's effects call it exactly as before.
import { useCallback, useEffect, useRef } from "react";
import { readHydrateSnapshot, saveHydrateSnapshot } from "../lib/hydrateCache";
import { clientAddons as clientAddonsDb, clientBillingDb, clientBillingMonthStatusDb, clientBillingTermsDb, clients as clientsDb, healthChecks as hcDb, observations as observationsDb, personalCalendar as personalCalendarDb, profile as profileDb, raiConversations as convoDb, raiPicks as raiPicksDb, raiUserState as raiUserStateDb, referrals as referralsDb, rolodex as rolodexDb, tasks as tasksDb, touchpoints as touchpointsDb, workers as workersDb } from "../lib/db";
import { supabase } from "../lib/supabase";

export function useDataLoad(app) {
  const {
    bookOwnerId,
    orgRole,
    clients,
    getAdjustedLTV,
    googleConnected,
    googleEmail,
    inFlightDateMoves,
    inFlightToggles,
    localTaskWrites,
    isCurrentlyPaused,
    monthsTogether,
    observation,
    page,
    profileScores,
    raiPicks,
    rolodex,
    setAllCompletions,
    setAllTouchpoints,
    setBillingMonthStatus,
    setBillingTerms,
    setClientAddons,
    setClientBilling,
    setClientDrift,
    setClients,
    setCollapsedDoneIds,
    setDataLoaded,
    setEngagementPausesByClient,
    setGoogleConnected,
    setGoogleEmail,
    setGoogleLastSyncedAt,
    setHcQueue,
    setObsMobileExpanded,
    setObservation,
    setOccurrenceFlags,
    setPersonalEvents,
    setRaiConvoList,
    setRaiPicks,
    setRaiState,
    setRefs,
    setRetroAnswers,
    setRolodex,
    setTaskCompletedCounts,
    setTaskOccurrences,
    setTasks,
    setTpLogged,
    setWorkerCompletions,
    setWorkersList,
    taskOccurrences,
    tasks,
    user,
    userTimezone,
  } = app;
  const hydrateRetryRef = useRef(0);
  const bootedFromCacheRef = useRef(false);
  const loadData = useCallback(async (opts = {}) => {
    if (!user) return;
    // INSTANT-PAINT CACHE (Jul 2026). fromCache runs synchronously-fast
    // off the last successful hydrate's snapshot: no gates, no network,
    // no retries — paint what we knew, and let the normal network
    // hydrate (which App fires the moment the timezone lands) replace
    // it wholesale, exactly like every visibilitychange refetch does.
    const cachedEnv = opts.fromCache ? readHydrateSnapshot(user.id) : null;
    if (opts.fromCache && !cachedEnv) return;
    // Wait for the user's stored timezone to load before fetching tasks.
    // Without this gate, loadData fires twice on sign-in: first with
    // userTimezone=null (which falls back to device-local TZ and may
    // bucket tasks into the wrong day), then again when the profile
    // effect sets userTimezone. That double-load is what produces the
    // ~2s "everything jumbled then sorts" jank Adam was seeing. The
    // skeleton state covers the (very brief) gap.
    if (!userTimezone && !cachedEnv) return;
    const uid = user.id;                    // SELF: my intelligence, profile, calendar, tokens
    // BOOK: the client data I work in. Solo users and root owners work
    // in their own book (bookId === uid, byte-identical behavior). A
    // seat works in the org owner's book; RLS trims what they see to
    // their assignment. (Agency spine, scope §4.1 / A2-3.)
    const bookId = cachedEnv ? (cachedEnv.bookId || user.id) : (bookOwnerId || user.id);
    try { window.__RT_BOOT_MARK?.("data-start"); } catch (_) { /* profiler absent */ }
    
    // HYDRATE RESILIENCE (Jul 2026). Supabase query errors resolve as
    // { data, error } — they never throw. But a NETWORK-level failure
    // (a phone radio waking from background is the canonical case)
    // rejects the fetch itself, which used to reject this entire
    // Promise.all: all 22 results discarded, zero state updates, and
    // the stale view survives with no trace. Desktop on stable wifi
    // never saw it; mobile hit it constantly. Now a failed batch logs,
    // retries twice on a short delay, and gives up loudly — a slow
    // hydrate beats a silent one that never happened.
    // Snapshot birth time — the instant this batch's SELECTs are issued.
    // The local-writes merge rule compares against it: a snapshot born
    // before a local write committed can never overwrite the written
    // fields. Cached boots use the cache's stored `at` (that data is as
    // old as the hydrate that produced it).
    const selectStartedAt = cachedEnv ? (cachedEnv.at || 0) : Date.now();
    const _hydrateBatch = cachedEnv ? cachedEnv.batch : await Promise.all([
      clientsDb.list(bookId),
      tasksDb.listToday(bookId),
      referralsDb.list(bookId),
      rolodexDb.list(bookId),
      hcDb.listPending(bookId),
      touchpointsDb.listToday(bookId),
      (typeof hcDb.countCompletedByClient === "function")
        ? hcDb.countCompletedByClient(bookId)
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
        .eq('user_id', bookId)
        .then(r => r, () => ({ data: [], error: null })),
      // Engagement pauses — same batch pattern. Drives monthsTogether and
      // is_currently_paused on every client. Empty array on failure (table
      // may not exist yet during migration window).
      supabase
        .from('client_engagement_pauses')
        .select('id, client_id, paused_at, resumed_at, reason, note')
        .eq('user_id', bookId)
        .then(r => r, () => ({ data: [], error: null })),
      // Promoted from sequential awaits to parallel. Each wrapped in .catch
      // so a missing function or empty table doesn't reject the whole batch;
      // null data on failure is the same as the previous try/catch behavior.
      // Cadence — 90-day touchpoint history for client cards.
      (typeof touchpointsDb.list === "function")
        ? touchpointsDb.list(bookId, 90).catch(e => { console.warn("Cadence data failed to load:", e); return { data: null, error: e }; })
        : Promise.resolve({ data: null, error: null }),
      // Cadence — 90-day task-completion history (per-client) for the
      // Clients-page cadence + last-touch. tasks[] is today-only, so past
      // completions must come from task_completions.
      (typeof tasksDb.listCompletionsForCadence === "function")
        ? tasksDb.listCompletionsForCadence(bookId, 90).catch(e => { console.warn("Completion history failed to load:", e); return { data: null, error: e }; })
        : Promise.resolve({ data: null, error: null }),
      // Observer card — weekly observation, may not exist.
      (typeof observationsDb?.getCurrent === "function")
        ? observationsDb.getCurrent(uid).catch(e => { console.warn("Observer card failed to load:", e); return { data: null, error: e }; })
        : Promise.resolve({ data: null, error: null }),
      // Daybook removed — placeholder keeps Promise.all positions stable.
      Promise.resolve({ data: null, error: null }),
      // Workers list + per-worker completion counts. Optional table — empty
      // arrays on failure so the composer worker chip just shows zero options.
      workersDb.list(bookId).catch(e => { console.warn("Workers load failed:", e); return { data: null, error: e }; }),
      workersDb.getAllCompletions(bookId).catch(e => { console.warn("Worker completions load failed:", e); return { data: null, error: e }; }),
      // Personal calendar events (Today timeline) + sidebar completion counts.
      // Both render on the default landing page so they belong in critical
      // path. As fire-and-forget they hydrated late, causing visible pop-in
      // on the Today calendar widget and the sidebar Portfolio widget.
      personalCalendarDb.listUpcoming(uid).catch(e => { console.warn("personal calendar load failed:", e); return { data: null, error: e }; }),
      (typeof tasksDb.getCompletedCounts === "function")
        ? tasksDb.getCompletedCounts(bookId).catch(e => { console.warn("task completion counts failed:", e); return { data: null, error: e }; })
        : Promise.resolve({ data: null, error: null }),
      // Phase 3 occurrence-model — fetch last 90 days of task_occurrences
      // (covers any reader's window need; smallest window is 7d, biggest
      // is ~30d). Plus the user's occurrence_flags feature-flag map.
      // Both feed Phase 3 cutovers behind their respective flags. Safe to
      // run even before any reader is migrated — state just sits unused.
      supabase
        .from('task_occurrences')
        .select('*')
        .eq('user_id', bookId)
        .gte('occurrence_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
        .order('occurrence_date', { ascending: false })
        .then(r => r, () => ({ data: [], error: null })),
      supabase
        .from('profiles')
        .select('occurrence_flags')
        .eq('id', uid)
        .single()
        .then(r => r, () => ({ data: { occurrence_flags: {} }, error: null })),
    ]).catch((err) => {
      console.error("[hydrate] batch failed at network level:", err);
      return null;
    });
    if (!_hydrateBatch) {
      if (hydrateRetryRef.current < 2) {
        hydrateRetryRef.current += 1;
        setTimeout(() => { loadData(); }, 4000);
      }
      return;
    }
    hydrateRetryRef.current = 0;
    const [clientRes, taskRes, refRes, rolodexRes, hcRes, tpRes, hcCountsRes, convoListRes, raiStateRes, raiPicksRes, revHistoryRes, pausesRes, cadenceRes, completionHistRes, observerRes, _daybookRes, workersRes, workersComplRes, personalCalRes, taskCompletionsRes, occurrencesRes, profileFlagsRes] = _hydrateBatch;
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

    // ─── AGENCY (Jun 2026): AM slice scoping ─────────────────────────
    // A seat with role 'am' works the owner's book TRIMMED to their
    // assigned clients. Filtering happens here — one place, in-place on
    // the response objects — so every downstream setter stays untouched.
    // Owners (root or seat) and solo users skip this entirely.
    if (orgRole === "am") {
      let amSet = new Set();
      try {
        const { data: myAssigns } = await supabase
          .from("client_assignments")
          .select("client_id")
          .eq("member_user_id", uid);
        amSet = new Set((myAssigns || []).map(a => a.client_id));
      } catch (e) { console.warn("Assignment load failed (AM sees empty slice):", e); }
      const inSlice = (cid) => cid && amSet.has(cid);
      if (clientRes?.data) clientRes.data = clientRes.data.filter(c => inSlice(c.id));
      // Tasks: keep (a) book tasks on assigned clients, (b) the seat's own
      // personal-book rows (user_id === uid), (c) unfiled tasks the seat
      // created in the owner's book (created_by stamp from db.js).
      if (taskRes?.data) taskRes.data = taskRes.data.filter(t =>
        inSlice(t.client_id) || t.user_id === uid || (!t.client_id && t.created_by === uid));
      if (hcRes?.data) hcRes.data = hcRes.data.filter(h => inSlice(h.client_id));
      if (tpRes?.data) tpRes.data = tpRes.data.filter(tp => inSlice(tp.client_id));
      if (cadenceRes?.data) cadenceRes.data = cadenceRes.data.filter(tp => inSlice(tp.client_id));
      if (completionHistRes?.data) completionHistRes.data = completionHistRes.data.filter(r => inSlice(r.client_id));
      // Owner-level surfaces: Referrals + Rolodex pages are role-gated off,
      // and the weekly observation reads the WHOLE book — none of it is the
      // seat's to see. Blank them rather than leak sibling-client data.
      if (refRes) refRes.data = [];
      if (rolodexRes) rolodexRes.data = [];
      if (observerRes) observerRes.data = null;
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
        const _lwMap = localTaskWrites ? localTaskWrites.current : null;
        if (inFlightToggles.current.size === 0 && inFlightDateMoves.current.size === 0 && (!_lwMap || _lwMap.size === 0)) return loadedTasks;
        // Recent-toggles ledger: a hydration whose SELECT predates a
        // toggle must not stomp it. For recently toggled ids, local truth
        // wins. Clearing rules:
        //   - animating === true: a completion animation is mid-flight. We
        //     must NOT replace the row object (even if the server already
        //     agrees) because a fresh object reconciles the node and remounts
        //     it, killing the glow/strikethrough/shrink. Hold local truth and
        //     keep the guard until the animation's collapse step clears it,
        //     or `until` expires as a safety net.
        //   - otherwise: clear as soon as the server row agrees (confirmed),
        //     or after the entry's `until` window (legitimate later server
        //     flips, e.g. midnight rollover, then apply).
        const _now = Date.now();
        // Date-move ledger (Jul 2026): a hydration whose SELECT predates a
        // due_date move must not stomp it — same contract as toggles.
        // Confirmed (server row shows the moved date) or expired → clear.
        const applyDateGuard = (t) => {
          const dEntry = inFlightDateMoves.current.get(t.id);
          if (!dEntry) return t;
          const _dExpired = _now > (dEntry.ts + 15000);
          const serverYmd = String(t.due_date || "").slice(0, 10);
          const movedYmd = String(dEntry.due_date || "").slice(0, 10);
          if (_dExpired || serverYmd === movedYmd) {
            inFlightDateMoves.current.delete(t.id);
            return t;
          }
          return { ...t, due_date: dEntry.due_date };
        };
        // Local-writes layer (family-wide, Jul 2026) — runs AFTER the
        // per-type ledgers above, which stay in place as first-line guards.
        // Rule: hold the written fields unless this snapshot's SELECTs began
        // after the write committed (server provably reflects it) — then
        // clear and let server truth resume. No fixed protection window;
        // the 30s check is a disaster net for a write that never resolved
        // (the write path's own failure handler clears + reverts long
        // before that in any normal failure).
        const applyLocalWrites = (t) => {
          const w = _lwMap ? _lwMap.get(t.id) : null;
          if (!w) return t;
          if (_now - w.ts > 30000) { _lwMap.delete(t.id); return t; }
          if (w.committedAt && selectStartedAt > w.committedAt) { _lwMap.delete(t.id); return t; }
          return { ...t, ...w.patch };
        };
        return loadedTasks.map(raw => {
          const t = applyDateGuard(raw);
          const entry = inFlightToggles.current.get(t.id);
          if (!entry) return applyLocalWrites(t);
          const _expired = _now > (entry.until || (entry.ts + 15000));
          if (entry.animating) {
            if (_expired) { inFlightToggles.current.delete(t.id); return applyLocalWrites(t); }
            return applyLocalWrites({ ...t, done: entry.done, completed_at: entry.completed_at });
          }
          if (_expired || t.done === entry.done) {
            inFlightToggles.current.delete(t.id);
            return applyLocalWrites(t);
          }
          return applyLocalWrites({ ...t, done: entry.done, completed_at: entry.completed_at });
        });
      });
      // Tasks that were already completed before this page load skip the
      // 5-second satisfaction window and go straight into the collapsed log.
      // (User wasn't here to see the celebration — no point preserving it.)
      // This REBUILDS the collapsed set from server truth each hydration, so a
      // task un-completed elsewhere correctly un-collapses here.
      // EXCEPTION: a row whose completion animation is currently in flight
      // (animating guard present and unexpired) is preserved in whatever
      // collapse state it already holds — a mid-animation refetch must not
      // force-collapse it early (yanking it out of the today bucket before
      // its glow/hold/shrink can play — the "checks, then vanishes" symptom).
      // The animation's own collapse step will set it when it finishes.
      const _hydNow = Date.now();
      setCollapsedDoneIds(prevCollapsed => {
        const next = {};
        // Read-only view of the local-writes ledger (no deletes here — the
        // tasks merge above owns clearing). A held done-write means this
        // snapshot predates the completion: keep the row collapsed instead
        // of popping it back into the Today bucket.
        const _lwHeldDone = (id) => {
          const w = localTaskWrites ? localTaskWrites.current.get(id) : null;
          if (!w || !("done" in w.patch)) return null;
          if (_hydNow - w.ts > 30000) return null;
          if (w.committedAt && selectStartedAt > w.committedAt) return null;
          return w.patch.done;
        };
        for (const t of loadedTasks) {
          const g = inFlightToggles.current.get(t.id);
          const animatingGuard = g && g.animating && _hydNow <= (g.until || (g.ts + 15000));
          const heldDone = _lwHeldDone(t.id);
          const effDone = heldDone !== null ? heldDone : t.done;
          if (animatingGuard) {
            // keep the row's current collapse state untouched during animation
            if (prevCollapsed[t.id]) next[t.id] = true;
          } else if (effDone) {
            next[t.id] = true;
          }
        }
        return next;
      });
    }

    if (refRes.data) setRefs(refRes.data.map(r => ({
      id: r.id,
      to: r.referred_to,
      // The log + network render read r.name / r.on — alias them here so
      // the page never shows blank rows (referred_to IS the name).
      name: r.referred_to,
      from: r.referred_by,
      date: r.date_added || "",
      on: r.date_added || "",
      converted: r.status === "converted",
      status: r.status,
      revenue: r.revenue || 0,
      totalRevenue: r.total_revenue || 0,
      // Pipeline + thank-loop (Jul 2026)
      statusChangedAt: r.status_changed_at || null,
      thankedAt: r.thanked_at || null,
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
      // Raw passthrough (Jul 2026): RetrosPage's heat/warmth/tag math
      // reads the DB field names (retro_answers, last_touch, …) —
      // without these, every hydration silently reset heat to the
      // neutral default and warmth to "cold".
      client_name: r.client_name,
      contact_name: r.contact_name,
      retro_answers: r.retro_answers || {},
      notes: r.notes,
      last_touch: r.last_touch || null,
      priority_set_at: r.priority_set_at || null,
      created_at: r.created_at || null,
      archived_at: r.archived_at || null,
      reminder_date: r.reminder_date,
      date_added: r.date_added || null,
      // Lane B — new-lead pipeline fields
      lead_status: r.lead_status || null,
      lead_source: r.lead_source || null,
      lead_need: r.lead_need || null,
      lead_urgency: r.lead_urgency || null,
      lead_value: r.lead_value || 0,
      next_touch_at: r.next_touch_at || null,
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
    // Rolodex dot "seen" — DB is the source of truth (localStorage was
    // Schema-error resilience (Jun 2026): supabase-js returns schema
    // errors as RESOLVED { data: null, error }, so the rejection fallback
    // above never fires for them. If the select errored, refetch once so
    // a failure can't silently blank the flags. (rolodex_seen_day handling
    // removed Jun 12: the dot is an action badge now and no longer tracks
    // page views, so nothing reads that column.)
    let profileFlags = profileFlagsRes;
    if (profileFlags?.error) {
      profileFlags = await supabase
        .from('profiles')
        .select('occurrence_flags')
        .eq('id', user.id)
        .single()
        .then(r => (r?.error ? { data: { occurrence_flags: {} } } : r), () => ({ data: { occurrence_flags: {} } }));
    }
    if (profileFlags?.data?.occurrence_flags) {
      setOccurrenceFlags(profileFlags.data.occurrence_flags || {});
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
    try { window.__RT_BOOT_MARK?.("data-done"); } catch (_) { /* profiler absent */ }
    if (!cachedEnv) saveHydrateSnapshot(user.id, bookId, userTimezone, _hydrateBatch);

    // ─── Secondary hydration — fire-and-forget AFTER initial render ───
    // Only billing data remains here. It's billing-tab-only — invisible on
    // initial Today landing, so kicking off after the page renders avoids
    // competing with the critical paint for bandwidth.

    // Billing data — only visible on the Billing tab. Three fetches that
    // hydrate independently. Each can render empty on failure (user re-adds).
    if (typeof clientBillingDb?.listAll === "function") {
      clientBillingDb.listAll(bookId)
        .then(r => { if (r?.data) setClientBilling(r.data); })
        .catch(e => console.warn("billing items hydrate failed:", e));
    }
    if (typeof clientBillingMonthStatusDb?.listAll === "function") {
      clientBillingMonthStatusDb.listAll(bookId)
        .then(r => { if (r?.data) setBillingMonthStatus(r.data); })
        .catch(e => console.warn("billing month status hydrate failed:", e));
    }
    if (typeof clientBillingTermsDb?.listAll === "function") {
      clientBillingTermsDb.listAll(bookId)
        .then(r => { if (r?.data) setBillingTerms(r.data); })
        .catch(e => console.warn("billing terms hydrate failed:", e));
    }
    // Ad-hoc revenue (addons) — bulk fetch grouped by client_id.
    // Same lazy timing as billing data: only visible on the Billing
    // tab, so we don't block initial paint with it.
    if (typeof clientAddonsDb?.listAllByClient === "function") {
      clientAddonsDb.listAllByClient(bookId)
        .then(r => { if (r?.data) setClientAddons(r.data); })
        .catch(e => console.warn("addons hydrate failed:", e));
    }
    // bookOwnerId + orgRole in deps: when useOrg resolves (async, after
    // mount), the closure must be rebuilt or a seat loads their own empty
    // book with the stale null bookOwnerId and never recovers.
  }, [user, userTimezone, bookOwnerId, orgRole]);

  // Fire the cached paint once per session, as early as the user id
  // exists — before the profile round trip, before the timezone gate.
  // The network hydrate that follows (App fires it when the timezone
  // lands) replaces everything wholesale and refreshes the snapshot.
  useEffect(() => {
    if (!user?.id || bootedFromCacheRef.current) return;
    bootedFromCacheRef.current = true;
    loadData({ fromCache: true });
  }, [user?.id, loadData]);
  return loadData;
}
