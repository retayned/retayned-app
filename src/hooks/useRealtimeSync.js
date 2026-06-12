// ─── useRealtimeSync (June 2026 refactor, Piece E module 1) ────────────
// The realtime-subscriptions effect, moved VERBATIM from App.jsx. One
// effect, one concern: keep this device in sync when Workers complete
// tasks via magic links or the user edits from another device. Called
// from App at the exact position the effect occupied — hook order is
// unchanged.
import { useEffect } from "react";
import { raiPicks as raiPicksDb, realtime as realtimeDb, workers as workersDb } from "../lib/db";

export function useRealtimeSync(app) {
  const {
    inFlightToggles,
    profileScores,
    setClients,
    setRaiPicks,
    setRaiState,
    setTasks,
    setWorkerCompletions,
    userTimezone,
    user,
    raiBurstTrackerRef,
  } = app;
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
}
