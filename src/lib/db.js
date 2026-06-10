// ============================================================
// RETAYNED — SUPABASE DATA LAYER
// lib/supabase.js
// ============================================================

import { supabase } from './supabase';

// ──────────────────────────────────────────────────────────────
// localYmd — convert a Date to a YYYY-MM-DD string using the
// browser's LOCAL timezone, not UTC. Critical for "today"-style
// queries: at 11pm MST, new Date().toISOString() returns
// tomorrow's UTC date, which makes any "completed_at >= today"
// or "due_date === today" filter pull the wrong day's data.
// Every place in this file that anchors to "today" or stores a
// user-picked date must go through this helper.
// ──────────────────────────────────────────────────────────────
function localYmd(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}




// ============================================================
// AUTH
// ============================================================

export const auth = {
  signUp: async (email, password, fullName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    });
    return { data, error };
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  getUser: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  onAuthStateChange: (callback) => {
    return supabase.auth.onAuthStateChange(callback);
  }
};


// ============================================================
// PROFILE
// ============================================================

export const profile = {
  // Sweep-eligibility heartbeat: stamps profiles.last_active_at.
  // Drives the 14-day activity gate in sweep_enqueue_due() — dormant
  // accounts stop consuming nightly Anthropic sweeps until they return.
  // Throttling is the caller's job (App throttles to once per 6h).
  touchLastActive: async (userId) => {
    const { error } = await supabase
      .from('profiles')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', userId);
    return { error };
  },

  get: async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return { data, error };
  },

  update: async (userId, updates) => {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    return { data, error };
  }
};


// ============================================================
// CLIENTS
// ============================================================

export const clients = {
  list: async (userId) => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('retention_score', { ascending: false, nullsFirst: false });
    return { data: data || [], error };
  },

  get: async (clientId) => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();
    return { data, error };
  },

  create: async (userId, client) => {
    const { data, error } = await supabase
      .from('clients')
      .insert({ user_id: userId, ...client })
      .select()
      .single();
    return { data, error };
  },

  update: async (clientId, updates) => {
    const { data, error } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', clientId)
      .select()
      .single();
    return { data, error };
  },

  // Move to rolodex (soft delete from clients)
  deactivate: async (clientId) => {
    const { data, error } = await supabase
      .from('clients')
      .update({ is_active: false, archived_at: new Date().toISOString() })
      .eq('id', clientId)
      .select()
      .single();
    return { data, error };
  },

  // Hard delete — permanently removes client and cascades to all related
  // tables (tasks, touchpoints, health_checks, rai_conversations) via
  // ON DELETE CASCADE. This is the GDPR/CCPA "right to erasure" path.
  // Not reversible.
  hardDelete: async (clientId) => {
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', clientId);
    return { error };
  },

  // Update retention score + profile scores after profile evaluation
  updateScores: async (clientId, retentionScore, profileScores) => {
    const { data, error } = await supabase
      .from('clients')
      .update({
        retention_score: retentionScore,
        profile_scores: profileScores
      })
      .eq('id', clientId)
      .select()
      .single();
    return { data, error };
  },

  // Update drift after health check
  updateDrift: async (clientId, driftStatus, lastHcDate) => {
    const { data, error } = await supabase
      .from('clients')
      .update({
        drift_status: driftStatus,
        last_hc_date: lastHcDate
      })
      .eq('id', clientId)
      .select()
      .single();
    return { data, error };
  }
};


// ============================================================
// TASKS
// ============================================================

export const tasks = {
  list: async (userId) => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('is_done', false)
      .order('sort_order', { ascending: true });
    return { data: data || [], error };
  },

  // Get today's tasks (including completed ones for progress count)
  // Recurring tasks always included — they persist across days and auto-reset in app
  listToday: async (userId) => {
    // completed_at is timestamptz. A bare 'YYYY-MM-DD' in the filter
    // parses as UTC midnight, not local midnight — in a negative-UTC
    // offset (e.g. DC), tasks completed after ~8pm reappear as "done
    // today" the next morning; in positive offsets, morning completions
    // vanish from today. Build the LOCAL midnight as a full ISO
    // timestamp so the boundary lands where the user's day starts.
    const localMidnightIso = new Date(`${localYmd()}T00:00:00`).toISOString();
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .is('cleared_at', null)  // exclude soft-cleared (post-2am rollover) tasks
      .or(`is_done.eq.false,completed_at.gte.${localMidnightIso},is_recurring.eq.true`)
      .order('sort_order', { ascending: true });
    return { data: data || [], error };
  },

  create: async (userId, task) => {
    const { data, error } = await supabase
      .from('tasks')
      .insert({ user_id: userId, ...task })
      .select()
      .single();
    if (error || !data) return { data, error };

    // ─── DUAL-WRITE: materialize today's occurrence for new recurring
    // templates so the task shows in the UI immediately (otherwise it
    // wouldn't appear until tomorrow's cron creates today's row).
    if (data.is_recurring) {
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('timezone')
          .eq('id', userId)
          .single();
        const tz = prof?.timezone || 'UTC';
        const todayInTz = new Intl.DateTimeFormat('en-CA', {
          timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
        }).format(new Date());

        let clientName = null;
        if (data.client_id) {
          const { data: cli } = await supabase
            .from('clients')
            .select('name')
            .eq('id', data.client_id)
            .single();
          clientName = cli?.name ?? null;
        }

        const { error: occErr } = await supabase
          .from('task_occurrences')
          .upsert({
            task_id: data.id,
            user_id: userId,
            occurrence_date: todayInTz,
            is_done: false,
            completed_at: null,
            assigned_worker_id: data.assigned_worker_id || null,
            client_id: data.client_id,
            client_name: clientName,
            task_text: data.text,
          }, { onConflict: 'task_id,occurrence_date' });
        if (occErr) console.warn('task_occurrences materialize-on-create failed:', occErr);
      } catch (e) {
        console.warn('task_occurrences materialize-on-create threw:', e);
      }
    }

    return { data, error };
  },

  // Mark a task done or undone.
  //
  // Behavior:
  //   - Update tasks.is_done and tasks.completed_at (existing fields,
  //     unchanged behavior — UI continues to use these for "is this
  //     currently done").
  //   - When done=true, insert a row into task_completions to record
  //     the completion permanently. Deduped by (task_id, today) so
  //     toggling on/off multiple times in one day records exactly one.
  //   - When done=false, delete today's task_completions row for this
  //     task (the "I clicked it by mistake" undo case).
  //
  // task_completions exists because the daily midnight rollover nulls
  // tasks.completed_at on recurring tasks (to surface them as open the
  // next day). Without a separate record, recurring completions are
  // invisible to the sweep and the sidebar counter. This table holds
  // every completion as an immutable record; tasks.completed_at remains
  // the "current state" field.
  // Toggle a task done/undone, recording history in task_completions.
  //
  // Round trips: 4 (was up to 8). The task UPDATE returns the full row
  // plus an embedded client name (tasks_client_id_fkey), killing the
  // separate pre-read and both client-name lookups. Day-level dedupe
  // moved from a racy select-then-insert into the database itself:
  // UNIQUE(task_id, completed_on) + upsert with ignoreDuplicates — the
  // exact pattern task_occurrences already uses. Two tabs toggling the
  // same task in the same instant now produce exactly one diary row.
  //
  // completed_on is the BROWSER-local day (localYmd), preserving the
  // old dedupe-window semantics. Rows created before the migration have
  // completed_on NULL — exempt from the unique index (NULLS DISTINCT)
  // and handled explicitly in the undo path.
  //
  // REQUIRES the task_completions migration (completed_on column +
  // task_completions_task_day_uniq index). If it hasn't run, the upsert
  // fails with 42P10 and we degrade to the legacy select-then-insert
  // (old race window and all) so no completion is ever lost.
  toggle: async (taskId, isDone) => {
    const nowIso = new Date().toISOString();

    // 1) Update + RETURNING everything we need, client name embedded.
    const { data: updated, error } = await supabase
      .from('tasks')
      .update({
        is_done: isDone,
        completed_at: isDone ? nowIso : null,
      })
      .eq('id', taskId)
      .select('*, clients(name)')
      .single();
    if (error) return { data: null, error };

    const clientName = updated.clients?.name ?? null;
    const { clients: _embed, ...data } = updated; // strip embed from returned row

    const completedOn = localYmd();
    const wasOnTime = !data.due_date
      ? true
      : (nowIso.slice(0, 10) <= String(data.due_date).slice(0, 10));

    if (isDone) {
      // 2) Diary entry. DB-level dedupe; ignoreDuplicates = DO NOTHING.
      const { error: insErr } = await supabase
        .from('task_completions')
        .upsert({
          task_id: taskId,
          user_id: data.user_id,
          client_id: data.client_id,
          client_name: clientName,
          task_text: data.text,
          is_recurring: data.is_recurring || false,
          completed_at: nowIso,
          completed_on: completedOn,
          assigned_worker_id: data.assigned_worker_id || null,
          due_date: data.due_date || null,
          was_on_time: wasOnTime,
        }, { onConflict: 'task_id,completed_on', ignoreDuplicates: true });
      if (insErr) {
        console.warn('task_completions upsert failed:', insErr);
        // Migration not applied (42P10 = no matching constraint;
        // PGRST204 = unknown column). Degrade to the legacy
        // select-then-insert so the completion still records.
        if (String(insErr.code) === '42P10' || String(insErr.code) === 'PGRST204') {
          const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
          const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
          const { data: existingToday } = await supabase
            .from('task_completions')
            .select('id')
            .eq('task_id', taskId)
            .gte('completed_at', todayStart.toISOString())
            .lte('completed_at', todayEnd.toISOString())
            .limit(1);
          if (!existingToday || existingToday.length === 0) {
            const { error: legacyErr } = await supabase
              .from('task_completions')
              .insert({
                task_id: taskId,
                user_id: data.user_id,
                client_id: data.client_id,
                client_name: clientName,
                task_text: data.text,
                is_recurring: data.is_recurring || false,
                completed_at: nowIso,
                assigned_worker_id: data.assigned_worker_id || null,
                due_date: data.due_date || null,
                was_on_time: wasOnTime,
              });
            if (legacyErr) console.warn('task_completions legacy insert failed:', legacyErr);
          }
        }
      }
    } else {
      // 2) Undo: remove today's diary row. New rows match on
      // completed_on; pre-migration rows (completed_on null) match on
      // the legacy local-day window.
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
      const { error: delErr } = await supabase
        .from('task_completions')
        .delete()
        .eq('task_id', taskId)
        .or(`completed_on.eq.${completedOn},and(completed_on.is.null,completed_at.gte.${todayStart.toISOString()},completed_at.lte.${todayEnd.toISOString()})`);
      if (delErr) console.warn('task_completions delete (undo) failed:', delErr);
    }

    // ─── DUAL-WRITE: also update task_occurrences for today ────────────
    // Phase 2 of the occurrence-model migration, unchanged in purpose.
    // Best-effort — failures log but don't fail the toggle (old fields
    // stay authoritative until Phase 4). Client name and was_on_time are
    // reused from above instead of re-fetched.
    try {
      // "Today" in the user's STORED timezone — same date the SQL
      // materializer computes, so JS and SQL writes agree.
      const { data: prof } = await supabase
        .from('profiles')
        .select('timezone')
        .eq('id', data.user_id)
        .single();
      const tz = prof?.timezone || 'UTC';
      const todayInTz = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date());

      const { error: occErr } = await supabase
        .from('task_occurrences')
        .upsert({
          task_id: taskId,
          user_id: data.user_id,
          occurrence_date: todayInTz,
          is_done: isDone,
          completed_at: isDone ? nowIso : null,
          assigned_worker_id: data.assigned_worker_id || null,
          worker_completed_at: null, // worker flow not wired here yet
          was_on_time: isDone ? wasOnTime : null,
          client_id: data.client_id,
          client_name: clientName,
          task_text: data.text,
        }, { onConflict: 'task_id,occurrence_date' });
      if (occErr) console.warn('task_occurrences upsert failed:', occErr);
    } catch (occCatch) {
      console.warn('task_occurrences dual-write threw:', occCatch);
    }

    return { data, error: null };
  },

  // Set / clear / change a task's due_date. Used by:
  //   - Composer Due chip (creates with date)
  //   - Push buttons on task tiles (Today→Tomorrow, Tomorrow→Later, Later→pull to Today)
  //   - Custom date picker
  // Pass null to clear (returns task to "no specific date" → renders in Today bucket).
  // Pass YYYY-MM-DD string or Date object.
  // Update a task's title text (inline editing on the Today page). Trims and
  // ignores empty input at the caller; this just persists the new text.
  setText: async (taskId, text) => {
    const { data, error } = await supabase
      .from('tasks')
      .update({ text })
      .eq('id', taskId)
      .select()
      .single();
    return { data, error };
  },

  // Set / clear a task's notes (the long-form body behind a short title).
  // Same mechanics as setText; pass null/empty to clear.
  setNotes: async (taskId, notes) => {
    const { data, error } = await supabase
      .from('tasks')
      .update({ notes: notes && notes.trim().length > 0 ? notes : null })
      .eq('id', taskId)
      .select()
      .single();
    return { data, error };
  },

  setDueDate: async (taskId, dueDate) => {
    const dateStr = dueDate == null
      ? null
      : (dueDate instanceof Date
        ? localYmd(dueDate)
        : (typeof dueDate === 'string' && dueDate.includes('T'))
          ? dueDate.split('T')[0]
          : dueDate);
    const { data, error } = await supabase
      .from('tasks')
      .update({ due_date: dateStr })
      .eq('id', taskId)
      .select()
      .single();
    return { data, error };
  },

  delete: async (taskId) => {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);
    return { error };
  },

  // Soft-clear a task from the active Today view without deleting the row.
  // Used by the 2am rollover for non-recurring done tasks. Row stays in DB so
  // Rai/detectors can count historical task volume, client task distribution, etc.
  // To restore visibility (e.g., for a "history" view), query rows where
  // cleared_at is not null.
  clearFromActive: async (taskId) => {
    const { error } = await supabase
      .from('tasks')
      .update({ cleared_at: new Date().toISOString() })
      .eq('id', taskId);
    return { error };
  },

  // Rollover soft-clear candidates: done one-off tasks completed BEFORE
  // `cutoffIso` (local midnight) that haven't been cleared yet. The
  // midnight rollover must source candidates from THIS query, never from
  // listToday — listToday is a display query whose boundary keeps rows
  // completed AFTER local midnight, i.e. it excludes exactly the rows the
  // rollover needs. (Sourcing from listToday meant the soft-clear could
  // only ever see the sliver between UTC midnight and local midnight —
  // and nothing at all once the display boundary was fixed.)
  // is_recurring matched as null-or-false to mirror `!t.is_recurring`.
  listRolloverClearCandidates: async (userId, cutoffIso) => {
    const { data, error } = await supabase
      .from('tasks')
      .select('id, completed_at')
      .eq('user_id', userId)
      .eq('is_done', true)
      .is('cleared_at', null)
      .lt('completed_at', cutoffIso)
      .or('is_recurring.is.null,is_recurring.eq.false');
    return { data: data || [], error };
  },

  // Bulk soft-clear with a single shared timestamp, chunked to keep the
  // .in() list within URL limits. Used by the midnight rollover; the
  // per-row clearFromActive above stays for single-task use.
  clearFromActiveBulk: async (taskIds) => {
    const ts = new Date().toISOString();
    for (let i = 0; i < taskIds.length; i += 200) {
      const chunk = taskIds.slice(i, i + 200);
      const { error } = await supabase
        .from('tasks')
        .update({ cleared_at: ts })
        .in('id', chunk);
      if (error) return { error };
    }
    return { error: null };
  },

  // Reorder tasks (batch update sort_order)
  reorder: async (taskOrders) => {
    // taskOrders = [{ id, sort_order }, ...]
    const promises = taskOrders.map(({ id, sort_order }) =>
      supabase.from('tasks').update({ sort_order }).eq('id', id)
    );
    const results = await Promise.all(promises);
    return { errors: results.filter(r => r.error).map(r => r.error) };
  },

  // Get count of completed tasks for week/month/year windows + history buckets.
  // Used for the sidebar tasks-completed widget.
  //
  // Reads from task_completions (NOT tasks.completed_at). The completions
  // table records every completion as an immutable row, so recurring task
  // completions — which get nulled out of tasks.completed_at by the daily
  // reset — are still counted here. This is the fix for the sidebar
  // undercounting daily recurring task work.
  //
  // Returns:
  //   week, month, year — current period counts (rolling 7/30/365 days from now)
  //   weekHistory[12]   — counts per rolling 7-day bucket, oldest → newest
  //   monthHistory[12]  — counts per rolling 30-day bucket, oldest → newest
  //   dayStreak         — consecutive days ending today with at least 1 completion
  getCompletedCounts: async (userId) => {
    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);
    const { data, error } = await supabase
      .from('task_completions')
      .select('completed_at')
      .eq('user_id', userId)
      .gte('completed_at', oneYearAgo.toISOString());
    if (error) return {
      data: { today: 0, week: 0, month: 0, year: 0, weekHistory: Array(12).fill(0), monthHistory: Array(12).fill(0), dayStreak: 0 },
      error,
    };

    const now = new Date();
    const nowMs = now.getTime();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const sevenDaysAgo  = new Date(nowMs - 7  * DAY_MS);
    const thirtyDaysAgo = new Date(nowMs - 30 * DAY_MS);

    // ─── "Today" boundary ────────────────────────────────────────────
    // The app's day boundary is midnight LOCAL time. Tasks bucket
    // and "today" counts flip at 00:00 to match the calendar view.
    //
    // Why local-not-UTC: a user in a negative-offset timezone
    // (e.g. US Mountain) hits the next UTC date hours before their
    // local midnight. Using a UTC anchor here makes today-counts
    // roll forward 5-7 hours early.
    const todayCutoff = new Date(now);
    todayCutoff.setHours(0, 0, 0, 0);
    const todayCutoffMs = todayCutoff.getTime();

    // Local YYYY-MM-DD for a Date — used for streak day keys so they
    // match the user's calendar, not UTC.
    const localDayKey = (d) => {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };

    // Roll-up counts for the active toggle
    let today = 0, week = 0, month = 0, year = 0;

    // 12 rolling weekly buckets — index 0 = oldest (84 days ago → 77 days ago),
    // index 11 = current (7 days ago → now). Each bucket spans 7 days.
    const weekHistory = Array(12).fill(0);
    // 12 rolling monthly buckets — index 0 = oldest (~360 days ago), index 11 = current.
    // Each bucket spans 30 days. We use 30-day windows (not calendar months) so the
    // boundaries line up with the rolling "this month" count and the user's mental
    // model of "last 30 days."
    const monthHistory = Array(12).fill(0);

    // For the streak: collect set of local YYYY-MM-DD strings where at
    // least one task was completed. Then walk backwards from today.
    const daysWithCompletions = new Set();

    for (const row of (data || [])) {
      const t = new Date(row.completed_at);
      const tMs = t.getTime();

      year++;
      if (t >= thirtyDaysAgo) month++;
      if (t >= sevenDaysAgo)  week++;
      // Today = completed at or after the local 2am boundary.
      if (tMs >= todayCutoffMs) today++;

      // Weekly bucket: how many full 7-day windows ago?
      const daysAgo = (nowMs - tMs) / DAY_MS;
      const weekIdx = 11 - Math.floor(daysAgo / 7);
      if (weekIdx >= 0 && weekIdx < 12) weekHistory[weekIdx]++;

      // Monthly bucket: how many full 30-day windows ago?
      const monthIdx = 11 - Math.floor(daysAgo / 30);
      if (monthIdx >= 0 && monthIdx < 12) monthHistory[monthIdx]++;

      // Day key for streak — local calendar day.
      daysWithCompletions.add(localDayKey(t));
    }

    // Compute day streak — walk back from today as long as each day has ≥1 completion.
    // If today has no completions yet, start from yesterday (so the streak doesn't
    // break just because the user hasn't worked yet today).
    let dayStreak = 0;
    let cursor = new Date(now);
    const todayKey = localDayKey(now);
    if (!daysWithCompletions.has(todayKey)) {
      cursor = new Date(nowMs - DAY_MS);
    }
    while (true) {
      const key = localDayKey(cursor);
      if (daysWithCompletions.has(key)) {
        dayStreak++;
        cursor = new Date(cursor.getTime() - DAY_MS);
      } else {
        break;
      }
    }

    return { data: { today, week, month, year, weekHistory, monthHistory, dayStreak }, error: null };
  },

  // Per-client completion timestamps over a window (default 90d). Feeds the
  // Clients-page cadence + last-touch calcs, which need real historical task
  // activity — the `tasks` array client-side is today-only (listToday), so
  // hundreds of past completions live only here in task_completions.
  listCompletionsForCadence: async (userId, days = 90) => {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const { data, error } = await supabase
      .from('task_completions')
      .select('client_id, client_name, completed_at, is_recurring')
      .eq('user_id', userId)
      .gte('completed_at', since.toISOString());
    return { data: data || [], error };
  },

  // Assign a task to a worker (or unassign by passing null).
  // shareClientContext defaults true — controls whether the Worker
  // sees the task's client_name on their magic-link dashboard.
  assign: async (taskId, workerId, shareClientContext = true) => {
    const { data, error } = await supabase
      .from('tasks')
      .update({
        assigned_worker_id: workerId || null,
        share_client_context: shareClientContext,
      })
      .eq('id', taskId)
      .select()
      .single();
    return { data, error };
  },

  // Worker-side mark complete. Sets is_done + worker_completed_at.
  // Called from the magic-link Edge Function with service role.
  // Also writes a task_completions record so worker-completed tasks
  // show up in the sidebar counter and Rai sweep just like user-completed
  // ones. Bypasses RLS via service role.
  markCompleteByWorker: async (taskId) => {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('tasks')
      .update({
        is_done: true,
        completed_at: nowIso,
        worker_completed_at: nowIso,
      })
      .eq('id', taskId)
      .select()
      .single();
    if (error) return { data, error };

    // Write completion record. Service role bypasses RLS so we can
    // freely insert. Fail-soft: a missing completion row is annoying
    // but not blocking for the worker's flow.
    if (data) {
      let clientName = null;
      if (data.client_id) {
        const { data: cli } = await supabase
          .from('clients')
          .select('name')
          .eq('id', data.client_id)
          .single();
        clientName = cli?.name ?? null;
      }
      const wasOnTime = !data.due_date
        ? true
        : (nowIso.slice(0, 10) <= String(data.due_date).slice(0, 10));
      const { error: insErr } = await supabase
        .from('task_completions')
        .insert({
          task_id: taskId,
          user_id: data.user_id,
          client_id: data.client_id,
          client_name: clientName,
          task_text: data.text,
          is_recurring: data.is_recurring || false,
          completed_at: nowIso,
          assigned_worker_id: data.assigned_worker_id || null,
          due_date: data.due_date || null,
          was_on_time: wasOnTime,
        });
      if (insErr) console.warn('task_completions insert (worker) failed:', insErr);
    }

    return { data, error };
  },
};


// ============================================================
// RAI USER STATE — per-user Rai state (toggle + sweep tracking)
// One row per user, auto-created on signup via DB trigger.
//
// Drives:
//   - "Ranked by Rai / Manual" toggle  (.ranking_enabled)
//   - Daily sweep idempotency          (.last_sweep_at, .next_sweep_eligible_at)
//
// Users can only update their own ranking_enabled via RLS;
// sweep timestamps are written by the daily Edge Function using
// the service role.
// ============================================================

export const raiUserState = {
  // Get the current user's Rai state row.
  // Uses maybeSingle() so a missing row (e.g. user created before
  // the trigger existed) returns null instead of throwing.
  get: async (userId) => {
    const { data, error } = await supabase
      .from('rai_user_state')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    return { data, error };
  },

  // Update toggles. Only ranking_enabled is user-writable;
  // RLS rejects attempts to write any other field.
  updateToggles: async (userId, { ranking_enabled } = {}) => {
    const updates = {};
    if (typeof ranking_enabled === 'boolean') updates.ranking_enabled = ranking_enabled;
    if (Object.keys(updates).length === 0) {
      return { data: null, error: new Error('updateToggles: no valid fields to update') };
    }
    const { data, error } = await supabase
      .from('rai_user_state')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();
    return { data, error };
  },

  // Mark today's Pick of the Day as read/dismissed. Sets the timestamp
  // so the frontend hides the card for the rest of the day. The sweep
  // (3am local) clears this back to null when it writes a fresh pick.
  dismissTodaysPick: async (userId) => {
    const { data, error } = await supabase
      .from('rai_user_state')
      .update({ todays_pick_dismissed_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select()
      .single();
    return { data, error };
  },

  // Write the badge target for today. Called once per day by the
  // auto-badge settle effect in App.jsx after the >60s settle window
  // resolves on the top-priority task of the picked client.
  //
  // Sets BOTH fields atomically:
  //   - todays_badged_task_id → the task that gets the badge
  //   - todays_badge_set_at   → timestamp acts as "already badged today"
  //                             gate so the effect becomes a no-op for
  //                             the rest of the day
  //
  // The daily sweep (3am local) is responsible for clearing both fields
  // back to null when it writes the next pick. Without that reset, the
  // gate in App.jsx will refuse to write a new badge tomorrow.
  //
  // Returns { error } only — no row payload needed by callers.
  setBadgeTask: async (userId, taskId) => {
    const { error } = await supabase
      .from('rai_user_state')
      .update({
        todays_badged_task_id: taskId,
        todays_badge_set_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
    return { error };
  },
};


// ============================================================
// HEALTH CHECKS
// ============================================================

export const healthChecks = {
  // Get pending (upcoming + overdue) reviews.
  // IMPORTANT: only for clients that are still active. The !inner join +
  // is_active filter drops orphaned rows left behind when a client was fired/
  // offboarded but their pending review row was never cleaned up — otherwise
  // a gone client keeps surfacing in the queue.
  listPending: async (userId) => {
    const { data, error } = await supabase
      .from('health_checks')
      .select('*, client:clients!inner(name, retention_score, is_active)')
      .eq('user_id', userId)
      .is('completed_at', null)
      .eq('client.is_active', true)
      .order('due_date', { ascending: true });
    return { data: data || [], error };
  },

  // Return a map of { client_id: count_of_completed_hcs } for this user.
  // Used by the Health page to know if a pending HC is a client's first —
  // first HCs get a "Start Early" affordance; HC #2+ are locked until due.
  countCompletedByClient: async (userId) => {
    const { data, error } = await supabase
      .from('health_checks')
      .select('client_id')
      .eq('user_id', userId)
      .not('completed_at', 'is', null);
    if (error) return { data: {}, error };
    const counts = {};
    (data || []).forEach(row => {
      counts[row.client_id] = (counts[row.client_id] || 0) + 1;
    });
    return { data: counts, error: null };
  },

  // Get completed health checks for a client
  listForClient: async (clientId) => {
    const { data, error } = await supabase
      .from('health_checks')
      .select('*')
      .eq('client_id', clientId)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false });
    return { data: data || [], error };
  },

  // Create next health check (scheduled)
  schedule: async (userId, clientId, dueDate) => {
    const { data, error } = await supabase
      .from('health_checks')
      .insert({
        user_id: userId,
        client_id: clientId,
        due_date: dueDate
      })
      .select()
      .single();
    return { data, error };
  },

  // Create a health check with a specific due_date (ISO date string 'YYYY-MM-DD' or Date).
  // Used on new-client signup to schedule the first HC with a random 10-40 day offset.
  // For standard "next HC" scheduling after completion, use scheduleNext instead.
  create: async (userId, { client_id, due_date }) => {
    const dateStr = due_date instanceof Date
      ? localYmd(due_date)
      : (typeof due_date === 'string' && due_date.includes('T'))
        ? due_date.split('T')[0]
        : due_date;
    const { data, error } = await supabase
      .from('health_checks')
      .insert({
        user_id: userId,
        client_id,
        due_date: dateStr
      })
      .select()
      .single();
    return { data, error };
  },

  // Complete a health check
  complete: async (hcId, answers, driftScore, driftStatus) => {
    const { data, error } = await supabase
      .from('health_checks')
      .update({
        answers,
        drift_score: driftScore,
        drift_status: driftStatus,
        completed_at: new Date().toISOString()
      })
      .eq('id', hcId)
      .select()
      .single();
    return { data, error };
  },

  // Schedule next portfolio review after completing/dismissing one.
  // Default 90 days (quarterly cadence). (Table is named health_checks for
  // legacy reasons; it now backs the quarterly portfolio-update schedule.)
  scheduleNext: async (userId, clientId, daysOut = 90) => {
    const due = new Date();
    due.setDate(due.getDate() + daysOut);
    return healthChecks.schedule(userId, clientId, localYmd(due));
  }
};


// ============================================================
// ROLODEX
// ============================================================

export const rolodex = {
  list: async (userId) => {
    const { data, error } = await supabase
      .from('rolodex')
      .select('*')
      .eq('user_id', userId)
      .is('archived_at', null)
      .order('created_at', { ascending: false });
    return { data: data || [], error };
  },

  create: async (userId, entry) => {
    const { data, error } = await supabase
      .from('rolodex')
      .insert({ user_id: userId, ...entry })
      .select()
      .single();
    return { data, error };
  },

  update: async (entryId, updates) => {
    const { data, error } = await supabase
      .from('rolodex')
      .update(updates)
      .eq('id', entryId)
      .select()
      .single();
    return { data, error };
  },

  // Soft delete — archive instead of hard-deleting. The row is kept so
  // relationship history and referral name references survive; it just
  // drops out of the rolodex list (which filters archived_at IS NULL).
  delete: async (entryId) => {
    const { error } = await supabase
      .from('rolodex')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', entryId);
    return { error };
  }
};


// ============================================================
// REFERRALS
// ============================================================

export const referrals = {
  list: async (userId) => {
    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return { data: data || [], error };
  },

  create: async (userId, referral) => {
    const { data, error } = await supabase
      .from('referrals')
      .insert({ user_id: userId, ...referral })
      .select()
      .single();
    return { data, error };
  },

  update: async (refId, updates) => {
    const { data, error } = await supabase
      .from('referrals')
      .update(updates)
      .eq('id', refId)
      .select()
      .single();
    return { data, error };
  },

  delete: async (refId) => {
    const { error } = await supabase
      .from('referrals')
      .delete()
      .eq('id', refId);
    return { error };
  },

  // Stats
  getStats: async (userId) => {
    const { data } = await referrals.list(userId);
    if (!data) return { total: 0, active: 0, revenue: 0 };
    const active = data.filter(r => r.status === 'converted');
    const revenue = active.reduce((sum, r) => sum + (r.revenue || 0), 0);
    return { total: data.length, active: active.length, revenue };
  }
};


// ============================================================
// CLIENT ADDONS — ad-hoc revenue (setup fees, bonuses, lump sums)
// ============================================================
// One row per payment. Lives outside the monthly rate so LTV math
// can include both retainer history AND one-off charges without
// confusion. Sums roll up into the client's adjusted revenue
// totals at hydration time.

export const clientAddons = {
  // List addons for a single client, newest charged_at first.
  listForClient: async (clientId) => {
    const { data, error } = await supabase
      .from('client_addons')
      .select('*')
      .eq('client_id', clientId)
      .order('charged_at', { ascending: false });
    return { data: data || [], error };
  },

  // Bulk fetch for hydration — all addons across all clients for
  // this user, returned as a map keyed by client_id. Used at app
  // load to compute LTV totals without N+1 queries.
  listAllByClient: async (userId) => {
    const { data, error } = await supabase
      .from('client_addons')
      .select('*')
      .eq('user_id', userId)
      .order('charged_at', { ascending: false });
    if (error) return { data: {}, error };
    const byClient = {};
    for (const a of data || []) {
      if (!byClient[a.client_id]) byClient[a.client_id] = [];
      byClient[a.client_id].push(a);
    }
    return { data: byClient, error: null };
  },

  add: async (userId, clientId, { amount, charged_at, description }) => {
    const { data, error } = await supabase
      .from('client_addons')
      .insert({
        user_id: userId,
        client_id: clientId,
        amount,
        charged_at: charged_at || new Date().toISOString().slice(0, 10),
        description: description || null,
      })
      .select()
      .single();
    return { data, error };
  },

  update: async (addonId, { amount, charged_at, description }) => {
    const patch = {};
    if (amount !== undefined) patch.amount = amount;
    if (charged_at !== undefined) patch.charged_at = charged_at;
    if (description !== undefined) patch.description = description;
    const { data, error } = await supabase
      .from('client_addons')
      .update(patch)
      .eq('id', addonId)
      .select()
      .single();
    return { data, error };
  },

  delete: async (addonId) => {
    const { error } = await supabase
      .from('client_addons')
      .delete()
      .eq('id', addonId);
    return { error };
  },
};


// ============================================================
// RAI CONVERSATIONS
// ============================================================

export const raiConversations = {
  // Get or create conversation for a client context
  getOrCreate: async (userId, clientId = null) => {
    // Try to find existing conversation for this client
    let query = supabase
      .from('rai_conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (clientId) {
      query = query.eq('client_id', clientId);
    } else {
      query = query.is('client_id', null);
    }

    const { data } = await query;

    if (data && data.length > 0) {
      return { data: data[0], error: null };
    }

    // Create new conversation
    const { data: newConvo, error } = await supabase
      .from('rai_conversations')
      .insert({
        user_id: userId,
        client_id: clientId,
        messages: []
      })
      .select()
      .single();

    return { data: newConvo, error };
  },

  // Create a brand-new conversation explicitly (for "New Chat" button).
  // Returns the new row so the UI can start appending messages to it.
  create: async (userId, { clientId = null, title = null } = {}) => {
    const { data, error } = await supabase
      .from('rai_conversations')
      .insert({
        user_id: userId,
        client_id: clientId,
        messages: [],
        title,
        is_starred: false,
      })
      .select()
      .single();
    return { data, error };
  },

  // Fetch a single conversation by id (for resume-from-sidebar).
  get: async (convoId) => {
    const { data, error } = await supabase
      .from('rai_conversations')
      .select('*')
      .eq('id', convoId)
      .single();
    return { data, error };
  },

  // List conversations for the sidebar. Starred first, then newest.
  // Returns lightweight fields only (not the full messages JSON) for speed.
  list: async (userId, limit = 50) => {
    const { data, error } = await supabase
      .from('rai_conversations')
      .select('id, title, is_starred, updated_at, client_id, client:clients(name)')
      .eq('user_id', userId)
      .order('is_starred', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(limit);
    return { data: data || [], error };
  },

  // Rename a conversation (auto-generated title after first exchange, or manual rename).
  updateTitle: async (convoId, title) => {
    const { data, error } = await supabase
      .from('rai_conversations')
      .update({ title })
      .eq('id', convoId)
      .select()
      .single();
    return { data, error };
  },

  // Pin/unpin a conversation for the sidebar.
  toggleStar: async (convoId, isStarred) => {
    const { data, error } = await supabase
      .from('rai_conversations')
      .update({ is_starred: isStarred })
      .eq('id', convoId)
      .select()
      .single();
    return { data, error };
  },

  // Hard-delete a conversation.
  delete: async (convoId) => {
    const { error } = await supabase
      .from('rai_conversations')
      .delete()
      .eq('id', convoId);
    return { error };
  },

  // Append a message to conversation
  addMessage: async (convoId, role, text) => {
    const message = { role, text, timestamp: new Date().toISOString() };

    // Atomic append in SQL (rai_append_message RPC): one statement, one
    // round trip, sends ONE message instead of rewriting the whole
    // array, and concurrent appends from multiple tabs serialize at the
    // row level instead of overwriting each other.
    const { data, error } = await supabase
      .rpc('rai_append_message', { p_convo_id: convoId, p_message: message });
    if (!error) {
      return { data: Array.isArray(data) ? (data[0] ?? null) : data, error: null };
    }

    // RPC missing (migration not run) → legacy read-modify-write so no
    // message is ever lost. Old race window applies in this mode only.
    console.warn('rai_append_message RPC unavailable, using legacy append:', error.message || error);
    const { data: convo } = await supabase
      .from('rai_conversations')
      .select('messages')
      .eq('id', convoId)
      .single();

    const messages = [...(convo?.messages || []), message];

    const { data: legacyData, error: legacyErr } = await supabase
      .from('rai_conversations')
      .update({ messages })
      .eq('id', convoId)
      .select()
      .single();

    return { data: legacyData, error: legacyErr };
  },

  // Get recent conversations
  listRecent: async (userId, limit = 10) => {
    const { data, error } = await supabase
      .from('rai_conversations')
      .select('*, client:clients(name)')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(limit);
    return { data: data || [], error };
  }
};


// ============================================================
// RAI PICKS — daily ranked client picks (annotation surface)
//
// The daily sweep writes 1-3 rows per user per day:
//   rank 1 = primary
//   rank 2 = backup1 (used when primary's client has no active tasks)
//   rank 3 = backup2 (used when both primary AND backup1 are exhausted)
//
// Each pick references a CLIENT (not a task). Frontend selects which task
// of that client gets the badge using priority_score + the 60s burst rule.
//
// Reason text lives on the pick row itself (each pick has its own reason
// fitting its client). Service role writes; users only read their own.
// ============================================================

export const raiPicks = {
  // Get the user's current Pick of the Day (or null if none).
  //
  // Sweep behaviour: the sweep does NOT wipe the previous day's rows
  // before writing today's — yesterday's row stays in place so the
  // sweep can read it to enforce the "no back-to-back same client"
  // rule. To return ONLY today's pick, we filter on expires_at.
  //
  // Why expires_at and not a relative-age cutoff (e.g. "last 23h"):
  // writePick stamps every row with expires_at = picked_at + 24h
  // (PICK_EXPIRY_HOURS in the edge function). That field IS the
  // authoritative "is this pick current?" signal. A relative-age
  // cutoff introduces a dead zone every night between (cutoff)h
  // after the sweep and the next sweep firing — during that gap
  // the row is hidden even though no replacement exists yet.
  // Filtering on expires_at > NOW() has the row visible exactly
  // until its replacement gets written (or until 24h passes if the
  // next sweep fails to rotate), with no magic hour-number tuning.
  // Returns today's Client of the Day, or null if none has been
  // written yet today.
  //
  // Strict "today in user TZ" filter — the row's picked_at must be
  // on or after the user's local midnight. We intentionally do NOT
  // fall back to yesterday's pick even if its expires_at is still
  // in the future, because doing so caused yesterday's pick to
  // appear as today's pick on days when the sweep wrote no new row
  // (May 2026 bug). With the corresponding Edge Function change
  // that guarantees a pick every day, this filter should always
  // find a row in normal operation.
  //
  // userTimezone is optional — if not provided, falls back to the
  // browser's local timezone. The Edge Function writes picks
  // anchored to the user's stored profile.timezone, so passing
  // userTimezone here keeps the two sides agreeing.
  getCurrent: async (userId, userTimezone = null) => {
    const tz = userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    // YYYY-MM-DD of "now" in user TZ — matches the en-CA format the
    // Edge Function uses for its `today` parameter.
    const todayLocal = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    // Compute the ISO timestamp of today's local midnight. Search
    // forward from the en-CA date string converted via a Date
    // assumption: take the user's TZ offset at "now" and roll back
    // to local 00:00. Simpler approach: use the same trick that
    // already works elsewhere — anchor to today + noon UTC then
    // adjust via fmt. But for a SELECT cutoff we only need an
    // approximate lower bound; using `todayLocal + 'T00:00:00'`
    // interpreted as a date string and converted is OK for any TZ
    // because Postgres will compare timestamptz vs the supplied
    // ISO string after both are normalized to UTC.
    //
    // Pragmatic approach: subtract 30 hours from now and use the
    // resulting ISO timestamp as a coarse cutoff. Any pick older
    // than that is definitely not today. Then we filter the
    // result client-side using the same en-CA local-date logic to
    // catch the precise day boundary.
    const coarseCutoffIso = new Date(Date.now() - 30 * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from('rai_picks')
      .select('*')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .gte('picked_at', coarseCutoffIso)
      .order('picked_at', { ascending: false })
      .limit(5);
    if (error) return { data: null, error };
    // Client-side precise day check — only return picks whose
    // local-date in the user's TZ matches today.
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const todaysPick = (data || []).find(row => {
      try {
        return fmt.format(new Date(row.picked_at)) === todayLocal;
      } catch {
        return false;
      }
    });
    return { data: todaysPick || null, error: null };
  },

  // Mark a pick as annotated (= the frontend assigned its client to a
  // badged task). Companion call to raiUserState.setBadgeTask — when
  // the auto-badge effect resolves, it writes the badge to user state
  // AND flags the pick row itself so we can see (in DB) which picks
  // actually drove a badge vs. which expired unannotated.
  //
  // Filters by (user_id, client_id) rather than pick row id because
  // the App.jsx caller only has the client_id in scope at the time
  // of the badge decision. Within today's 23h window, there is at
  // most one pick row per client per user, so this update is
  // unambiguous in practice.
  //
  // Fail-soft: caller wraps in try/catch and the auto-badge effect
  // continues either way.
  markAnnotated: async (userId, clientId) => {
    const { error } = await supabase
      .from('rai_picks')
      .update({ was_annotated: true })
      .eq('user_id', userId)
      .eq('client_id', clientId);
    return { error };
  },
};


// ============================================================
// REVENUE HISTORY
// ============================================================
//
// Tracks every monthly_rate period for every client. Used to compute honest
// LTV when rates change mid-contract. Invariant: exactly one row per client
// with ended_at IS NULL — that's the active rate.
//
// LTV math (computed on the fly, not stored):
//   total_ltv = client.lifetime_revenue_at_entry + sum(monthly_rate * months_in_period)
//
// `months_in_period` uses 30.44 days/month — true calendar average. The math is a
// few cents off compared to integer-month calculations, in the user's favor for
// accuracy.
//
// Public API:
//   getHistory(userId, clientId)         → [{ monthly_rate, started_at, ended_at, ... }]
//   getCurrentRate(userId, clientId)     → { monthly_rate, started_at, ... } | null
//   changeRate(userId, clientId, newRate) → closes the active row, opens a new one
//   computeLTV(userId, clientId)         → number (total honest LTV including pre-entry baseline)
//
// changeRate is the only mutation that should be used from the frontend. It runs
// the close-old-row + open-new-row pair atomically (well, sequentially with error
// handling — Supabase doesn't expose multi-statement transactions to the client).

export const revenueHistoryDb = {
  // Get all history rows for a client, newest first.
  getHistory: async (userId, clientId) => {
    const { data, error } = await supabase
      .from('client_revenue_history')
      .select('*')
      .eq('user_id', userId)
      .eq('client_id', clientId)
      .order('started_at', { ascending: false });
    return { data: data || [], error };
  },

  // Get the active rate row (the one with ended_at IS NULL).
  getCurrentRate: async (userId, clientId) => {
    const { data, error } = await supabase
      .from('client_revenue_history')
      .select('*')
      .eq('user_id', userId)
      .eq('client_id', clientId)
      .is('ended_at', null)
      .maybeSingle();
    return { data, error };
  },

  // Change the rate. Closes the current active row (sets ended_at = now())
  // and opens a new row at the new rate (started_at = now(), ended_at = null).
  // Also updates clients.revenue to the new rate (denormalized for fast reads).
  //
  // If newRate equals the current active rate, this is a no-op and returns
  // the existing row untouched — avoids creating noise history rows when the
  // user opens an edit form, doesn't change the rate, and saves.
  changeRate: async (userId, clientId, newRate, changeReason = null, changeNote = null) => {
    const numericRate = Number(newRate) || 0;
    if (numericRate < 0) return { data: null, error: new Error('Rate must be non-negative') };

    // Find the active row
    const { data: active, error: fetchErr } = await supabase
      .from('client_revenue_history')
      .select('*')
      .eq('user_id', userId)
      .eq('client_id', clientId)
      .is('ended_at', null)
      .maybeSingle();
    if (fetchErr) return { data: null, error: fetchErr };

    // Idempotency: same rate? no-op.
    if (active && Number(active.monthly_rate) === numericRate) {
      return { data: active, error: null };
    }

    const now = new Date().toISOString();

    // Close the existing active row, if any
    if (active) {
      const { error: closeErr } = await supabase
        .from('client_revenue_history')
        .update({ ended_at: now })
        .eq('id', active.id);
      if (closeErr) return { data: null, error: closeErr };
    }

    // Open new active row. change_reason and change_note describe WHY this
    // rate changed (expansion / contraction / annual_increase / etc).
    // Lets Rai see the narrative behind revenue movement, not just the
    // numbers. Both fields are optional — older code that calls changeRate
    // without them still works (they default to null).
    const { data: newRow, error: insertErr } = await supabase
      .from('client_revenue_history')
      .insert({
        user_id: userId,
        client_id: clientId,
        monthly_rate: numericRate,
        started_at: now,
        ended_at: null,
        change_reason: changeReason,
        change_note: changeNote,
      })
      .select()
      .single();
    if (insertErr) return { data: null, error: insertErr };

    // Update clients.revenue (denormalized cache of the active rate)
    const { error: clientErr } = await supabase
      .from('clients')
      .update({ revenue: numericRate, updated_at: now })
      .eq('id', clientId);
    if (clientErr) return { data: newRow, error: clientErr };

    return { data: newRow, error: null };
  },

  // Compute total LTV for a client.
  // Returns: pre_entry_baseline + sum(monthly_rate * months_in_period across history)
  //
  // months_in_period uses 30.44 days/month (true calendar average).
  computeLTV: async (userId, clientId) => {
    // Need both the client's pre-entry baseline AND the history rows
    const [clientRes, historyRes] = await Promise.all([
      supabase
        .from('clients')
        .select('lifetime_revenue_at_entry')
        .eq('user_id', userId)
        .eq('id', clientId)
        .maybeSingle(),
      supabase
        .from('client_revenue_history')
        .select('monthly_rate, started_at, ended_at')
        .eq('user_id', userId)
        .eq('client_id', clientId),
    ]);
    if (clientRes.error) return { data: null, error: clientRes.error };
    if (historyRes.error) return { data: null, error: historyRes.error };

    const preEntry = Number(clientRes.data?.lifetime_revenue_at_entry || 0);
    const history = historyRes.data || [];

    const MS_PER_MONTH = 30.44 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const historyTotal = history.reduce((sum, row) => {
      const startMs = new Date(row.started_at).getTime();
      const endMs = row.ended_at ? new Date(row.ended_at).getTime() : now;
      const months = Math.max(0, (endMs - startMs) / MS_PER_MONTH);
      return sum + (Number(row.monthly_rate) * months);
    }, 0);

    return { data: preEntry + historyTotal, error: null };
  },

  // Update just the pre-entry baseline (lifetime_revenue_at_entry on clients).
  // Used by the client profile edit form for "money the user earned from this
  // client BEFORE Retayned existed."
  setPreEntryBaseline: async (userId, clientId, amount) => {
    const numeric = Number(amount) || 0;
    if (numeric < 0) return { data: null, error: new Error('Amount must be non-negative') };
    const { data, error } = await supabase
      .from('clients')
      .update({ lifetime_revenue_at_entry: numeric, updated_at: new Date().toISOString() })
      .eq('id', clientId)
      .eq('user_id', userId)
      .select()
      .single();
    return { data, error };
  },
};


// ============================================================
// CLIENT BILLING ITEMS — line items per client per month
// ============================================================
//
// One row per billing line item. Items can be one-time (recurring=false)
// or recurring (recurring=true, mirrored into both active months at create
// time and on toggle-on).
//
// Month format: "Month Year" string (e.g. "May 2026"). Matches the
// frontend's currentMonth/nextMonth derivation in App.jsx.
//
// Public API:
//   list(userId, clientId)              → items for one client, all months
//   listAll(userId)                     → all items grouped by client_id (hydration)
//   create(userId, clientId, item)      → add one item
//   createBatch(userId, clientId, items) → add multiple (recurring mirror)
//   update(itemId, fields)              → edit description/amount/recurring/month
//   remove(itemId)                      → hard-delete one item

export const clientEngagementPausesDb = {
  // List all pauses for one client (chronological).
  list: async (userId, clientId) => {
    const { data, error } = await supabase
      .from('client_engagement_pauses')
      .select('*')
      .eq('user_id', userId)
      .eq('client_id', clientId)
      .order('paused_at', { ascending: true });
    return { data: data || [], error };
  },

  // List all pauses across all clients (used at hydration).
  listAll: async (userId) => {
    const { data, error } = await supabase
      .from('client_engagement_pauses')
      .select('*')
      .eq('user_id', userId);
    return { data: data || [], error };
  },

  // Start a new pause. Idempotency: if an open pause already exists for
  // this client, return that row instead of creating a duplicate.
  start: async (userId, clientId, reason = null, note = null) => {
    const { data: existing } = await supabase
      .from('client_engagement_pauses')
      .select('*')
      .eq('user_id', userId)
      .eq('client_id', clientId)
      .is('resumed_at', null)
      .maybeSingle();
    if (existing) return { data: existing, error: null };

    const today = localYmd();
    const { data, error } = await supabase
      .from('client_engagement_pauses')
      .insert({
        user_id: userId,
        client_id: clientId,
        paused_at: today,
        reason,
        note,
      })
      .select()
      .single();
    return { data, error };
  },

  // End the current open pause for a client. Idempotency: if no open
  // pause exists, return null (no error).
  end: async (userId, clientId) => {
    const { data: open } = await supabase
      .from('client_engagement_pauses')
      .select('*')
      .eq('user_id', userId)
      .eq('client_id', clientId)
      .is('resumed_at', null)
      .maybeSingle();
    if (!open) return { data: null, error: null };

    const today = localYmd();
    const { data, error } = await supabase
      .from('client_engagement_pauses')
      .update({ resumed_at: today })
      .eq('id', open.id)
      .select()
      .single();
    return { data, error };
  },

  // Hard-delete a pause record. Use only to undo a just-created pause
  // (user mis-clicked). Doesn't touch resumed pauses — those are history.
  remove: async (userId, pauseId) => {
    const { error } = await supabase
      .from('client_engagement_pauses')
      .delete()
      .eq('id', pauseId)
      .eq('user_id', userId);
    return { error };
  },
};

export const clientBillingDb = {
  list: async (userId, clientId) => {
    const { data, error } = await supabase
      .from('client_billing_items')
      .select('*')
      .eq('user_id', userId)
      .eq('client_id', clientId)
      .order('created_at', { ascending: true });
    return { data: data || [], error };
  },

  // Hydrate ALL billing items for the user, grouped by client_id.
  // Returns { [client_id]: { items: [...] } } — matches the existing
  // clientBilling state shape in App.jsx exactly.
  listAll: async (userId) => {
    const { data, error } = await supabase
      .from('client_billing_items')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (error) return { data: {}, error };
    const grouped = {};
    (data || []).forEach(row => {
      if (!grouped[row.client_id]) grouped[row.client_id] = { items: [] };
      grouped[row.client_id].items.push({
        id: row.id,
        description: row.description,
        amount: Number(row.amount),
        recurring: row.recurring,
        month: row.month,
      });
    });
    return { data: grouped, error: null };
  },

  create: async (userId, clientId, item) => {
    const { data, error } = await supabase
      .from('client_billing_items')
      .insert({
        user_id: userId,
        client_id: clientId,
        description: item.description,
        amount: Number(item.amount) || 0,
        recurring: !!item.recurring,
        month: item.month,
      })
      .select()
      .single();
    return { data, error };
  },

  // Batch insert. Used when creating a recurring item: we mirror the
  // line into the other active month in the same round-trip. Returns
  // the inserted rows.
  createBatch: async (userId, clientId, items) => {
    const rows = items.map(item => ({
      user_id: userId,
      client_id: clientId,
      description: item.description,
      amount: Number(item.amount) || 0,
      recurring: !!item.recurring,
      month: item.month,
    }));
    const { data, error } = await supabase
      .from('client_billing_items')
      .insert(rows)
      .select();
    return { data: data || [], error };
  },

  update: async (itemId, fields) => {
    const updates = {};
    if (fields.description !== undefined) updates.description = fields.description;
    if (fields.amount !== undefined) updates.amount = Number(fields.amount) || 0;
    if (fields.recurring !== undefined) updates.recurring = !!fields.recurring;
    if (fields.month !== undefined) updates.month = fields.month;
    const { data, error } = await supabase
      .from('client_billing_items')
      .update(updates)
      .eq('id', itemId)
      .select()
      .single();
    return { data, error };
  },

  remove: async (itemId) => {
    const { error } = await supabase
      .from('client_billing_items')
      .delete()
      .eq('id', itemId);
    return { error };
  },
};


// ============================================================
// CLIENT BILLING MONTH STATUS — invoiced/paid status per month
// ============================================================
//
// One row per (user, client, month). Row exists only when status has been
// set; absent = both flags false. Upsert pattern — setInvoiced/setPaid
// create-or-update.

export const clientBillingMonthStatusDb = {
  // Hydrate ALL status rows for the user. Returns nested map:
  //   { [client_id]: { [month]: { invoiced, paid, invoiced_at, paid_at } } }
  listAll: async (userId) => {
    const { data, error } = await supabase
      .from('client_billing_month_status')
      .select('*')
      .eq('user_id', userId);
    if (error) return { data: {}, error };
    const grouped = {};
    (data || []).forEach(row => {
      if (!grouped[row.client_id]) grouped[row.client_id] = {};
      grouped[row.client_id][row.month] = {
        id: row.id,
        invoiced: row.invoiced,
        paid: row.paid,
        invoiced_at: row.invoiced_at,
        paid_at: row.paid_at,
      };
    });
    return { data: grouped, error: null };
  },

  // Set the invoiced flag for a month. Upserts so callers don't need to
  // know whether a row exists yet. Sets invoiced_at to now when turning on,
  // null when turning off.
  setInvoiced: async (userId, clientId, month, invoiced) => {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('client_billing_month_status')
      .upsert({
        user_id: userId,
        client_id: clientId,
        month,
        invoiced,
        invoiced_at: invoiced ? now : null,
      }, { onConflict: 'user_id,client_id,month' })
      .select()
      .single();
    return { data, error };
  },

  // Set the paid flag for a month. Same upsert pattern.
  setPaid: async (userId, clientId, month, paid) => {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('client_billing_month_status')
      .upsert({
        user_id: userId,
        client_id: clientId,
        month,
        paid,
        paid_at: paid ? now : null,
      }, { onConflict: 'user_id,client_id,month' })
      .select()
      .single();
    return { data, error };
  },
};


// ============================================================
// CLIENT BILLING TERMS — append-able log of billing arrangement notes
// ============================================================
//
// Per-client billing memory. Users add an entry whenever the deal evolves.
// Newest entry by created_at = "current" terms (derived in frontend, not stored).
// Entries are editable + deletable.

export const clientBillingTermsDb = {
  // Hydrate ALL terms entries for the user, grouped by client_id.
  // Returns { [client_id]: [{ id, body, created_at, updated_at }, ...] }
  // sorted newest-first within each client (so [0] is current).
  listAll: async (userId) => {
    const { data, error } = await supabase
      .from('client_billing_terms')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) return { data: {}, error };
    const grouped = {};
    (data || []).forEach(row => {
      if (!grouped[row.client_id]) grouped[row.client_id] = [];
      grouped[row.client_id].push({
        id: row.id,
        body: row.body,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    });
    return { data: grouped, error: null };
  },

  // Per-client list (rare, mostly for direct fetches).
  listForClient: async (userId, clientId) => {
    const { data, error } = await supabase
      .from('client_billing_terms')
      .select('*')
      .eq('user_id', userId)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    return { data: data || [], error };
  },

  // Append a new entry. Caller passes plain text body; the new entry
  // becomes "current" (most recent created_at).
  create: async (userId, clientId, body) => {
    const { data, error } = await supabase
      .from('client_billing_terms')
      .insert({
        user_id: userId,
        client_id: clientId,
        body,
      })
      .select()
      .single();
    return { data, error };
  },

  // Edit an existing entry (typos, corrections). created_at stays the
  // same so sort order is stable; updated_at gets bumped by the trigger.
  update: async (entryId, body) => {
    const { data, error } = await supabase
      .from('client_billing_terms')
      .update({ body })
      .eq('id', entryId)
      .select()
      .single();
    return { data, error };
  },

  // Hard delete. If you delete the current entry, the next-most-recent
  // becomes current automatically.
  remove: async (entryId) => {
    const { error } = await supabase
      .from('client_billing_terms')
      .delete()
      .eq('id', entryId);
    return { error };
  },
};


// ============================================================
// REALTIME SUBSCRIPTIONS
// ============================================================

export const realtime = {
  // Subscribe to task changes (for multi-device sync)
  onTaskChange: (userId, callback) => {
    return supabase
      .channel('tasks-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `user_id=eq.${userId}`
      }, callback)
      .subscribe();
  },

  // Subscribe to rai_user_state changes (for cross-tab toggle sync).
  // When user flips "Rai Tasks / Off" on phone, the desktop tab
  // updates without a refresh. Same channel pattern as onTaskChange.
  onRaiUserStateChange: (userId, callback) => {
    return supabase
      .channel('rai-user-state-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'rai_user_state',
        filter: `user_id=eq.${userId}`
      }, callback)
      .subscribe();
  },

  // Subscribe to rai_picks changes. When the overnight sweep writes a new
  // pick, this tab updates without refresh — the badge moves to the new task.
  onRaiPickChange: (userId, callback) => {
    return supabase
      .channel('rai-picks-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'rai_picks',
        filter: `user_id=eq.${userId}`
      }, callback)
      .subscribe();
  },

  // Subscribe to client changes — primarily so that Rai's nudge updates
  // (written by overnight sweep into clients.rai_nudge) propagate without
  // a page refresh. Also catches any client metadata edits made elsewhere.
  onClientChange: (userId, callback) => {
    return supabase
      .channel('clients-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'clients',
        filter: `user_id=eq.${userId}`
      }, callback)
      .subscribe();
  },
};


// ============================================================
// TOUCHPOINTS (client contact log: call, text, meeting, other)
// ============================================================

export const touchpoints = {
  // Today's touchpoints for the user (drives the "Logged Today" pills on Today page)
  listToday: async (userId) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data, error } = await supabase
      .from('touchpoints')
      .select('*')
      .eq('user_id', userId)
      .gte('occurred_at', today.toISOString())
      .order('occurred_at', { ascending: false });
    return { data: data || [], error };
  },

  // All touchpoints for a specific client (future: client detail timeline)
  listForClient: async (clientId) => {
    const { data, error } = await supabase
      .from('touchpoints')
      .select('*')
      .eq('client_id', clientId)
      .order('occurred_at', { ascending: false });
    return { data: data || [], error };
  },

  // All touchpoints for this user within the last N days (drives cadence calculation)
  list: async (userId, days = 90) => {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const { data, error } = await supabase
      .from('touchpoints')
      .select('*, client:clients(name)')
      .eq('user_id', userId)
      .gte('occurred_at', since.toISOString())
      .order('occurred_at', { ascending: false });
    const flat = (data || []).map(t => ({ ...t, client_name: t.client?.name }));
    return { data: flat, error };
  },

  create: async (userId, { client_id, client_name, channel, notes }) => {
    const { data, error } = await supabase
      .from('touchpoints')
      .insert({
        user_id: userId,
        client_id,
        channel,
        notes: notes || null,
        occurred_at: new Date().toISOString()
      })
      .select()
      .single();
    // Return with client_name attached for optimistic UI updates
    return { data: data ? { ...data, client_name } : null, error };
  },

  delete: async (touchpointId) => {
    const { error } = await supabase
      .from('touchpoints')
      .delete()
      .eq('id', touchpointId);
    return { error };
  }
};


// ============================================================
// OBSERVATIONS — Observer card persistence
// ============================================================

export const observations = {
  // Get this week's active observation, if any.
  //
  // Scoped to observations whose week_start matches "this Friday" computed in
  // the BROWSER's local timezone — which equals the user's local timezone
  // (the same one the observer cron uses for that user, since the frontend
  // wrote it to profiles.timezone on first load). This way "this week" means
  // the same thing on both sides: from local Friday 00:00 to next local
  // Thursday 23:59. Returns null if dismissed or no observation this week.
  getCurrent: async (userId) => {
    // Compute most recent Friday in local time (browser's TZ).
    // getDay(): Sun=0, Mon=1, ..., Fri=5, Sat=6.
    const now = new Date();
    const dow = now.getDay();
    const daysSinceFriday = (dow + 2) % 7; // Fri→0, Sat→1, Sun→2, Mon→3, ..., Thu→6
    const localFriday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceFriday);
    // Format as YYYY-MM-DD (matches week_start column format in observations table).
    const yyyy = localFriday.getFullYear();
    const mm = String(localFriday.getMonth() + 1).padStart(2, '0');
    const dd = String(localFriday.getDate()).padStart(2, '0');
    const weekStartStr = `${yyyy}-${mm}-${dd}`;
    const { data, error } = await supabase
      .from('observations')
      .select('*')
      .eq('user_id', userId)
      .eq('week_start', weekStartStr)
      .not('status', 'in', '(dropped,expired)')
      .order('fired_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return { data, error };
  },

  // Update the status as the operator interacts with the card
  // Valid statuses: 'unread' | 'flipped' | 'unpacked' | 'dropped' | 'expired'
  updateStatus: async (observationId, status) => {
    const { data, error } = await supabase
      .from('observations')
      .update({ status, status_changed_at: new Date().toISOString() })
      .eq('id', observationId)
      .select()
      .single();
    return { data, error };
  },

  // Mark an observation as viewed by the user. Writes viewed_at = NOW()
  // to the observation row. Drives the persistent Health-page red dot:
  // the dot turns off when viewed_at is set, and stays off across page
  // refreshes (the previous in-memory-only flag reset on every reload).
  // Idempotent — safe to call repeatedly; later calls just refresh the
  // timestamp.
  markViewed: async (observationId) => {
    if (!observationId) return { data: null, error: null };
    const { data, error } = await supabase
      .from('observations')
      .update({ viewed_at: new Date().toISOString() })
      .eq('id', observationId)
      .select()
      .single();
    return { data, error };
  },

  // Get prior observations for the Mirrors archive page
  listAll: async (userId, limit = 50) => {
    const { data, error } = await supabase
      .from('observations')
      .select('*')
      .eq('user_id', userId)
      .order('fired_at', { ascending: false })
      .limit(limit);
    return { data: data || [], error };
  },
};


// ============================================================
// DAYBOOK — right-rail notepad on Today page
// One entry per user per day. Upsert by (user_id, entry_date).
// ============================================================

const _isoDate = (d) => {
  const x = d ? new Date(d) : new Date();
  // Local YYYY-MM-DD (not UTC) — entry_date is a calendar day in the user's timezone
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const daybook = {
  // Get a specific day's entry (defaults to today). Returns null if no entry.
  get: async (userId, date) => {
    const isoDate = _isoDate(date);
    const { data, error } = await supabase
      .from('daybook_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('entry_date', isoDate)
      .maybeSingle();
    return { data, error };
  },

  // Get today + yesterday in one shot (for the right-rail widget which shows both).
  getTodayAndYesterday: async (userId) => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const todayISO = _isoDate(today);
    const yesterdayISO = _isoDate(yesterday);

    const { data, error } = await supabase
      .from('daybook_entries')
      .select('*')
      .eq('user_id', userId)
      .in('entry_date', [todayISO, yesterdayISO]);

    if (error) return { data: { today: null, yesterday: null }, error };

    const todayRow = (data || []).find(r => r.entry_date === todayISO) || null;
    const yesterdayRow = (data || []).find(r => r.entry_date === yesterdayISO) || null;
    return { data: { today: todayRow, yesterday: yesterdayRow }, error: null };
  },

  // Save the current day's entry (upsert). Caller debounces.
  save: async (userId, body, date) => {
    const isoDate = _isoDate(date);
    const { data, error } = await supabase
      .from('daybook_entries')
      .upsert(
        { user_id: userId, entry_date: isoDate, body: body },
        { onConflict: 'user_id,entry_date' }
      )
      .select()
      .single();
    return { data, error };
  },

  // List recent entries for the journal page
  listRecent: async (userId, limit = 30) => {
    const { data, error } = await supabase
      .from('daybook_entries')
      .select('*')
      .eq('user_id', userId)
      .order('entry_date', { ascending: false })
      .limit(limit);
    return { data: data || [], error };
  },

  // Count total entries (footer label)
  count: async (userId) => {
    const { count, error } = await supabase
      .from('daybook_entries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    return { count: count || 0, error };
  },
};


export const buildRaiContext = async (userId, clientId = null) => {
  // Gather all relevant data for Rai's context window
  const [
    { data: clientList },
    { data: taskList },
    { data: hcList },
    { data: refList },
    { data: pauseList },
    { data: revHistList }
  ] = await Promise.all([
    clients.list(userId),
    tasks.listToday(userId),
    clientId
      ? healthChecks.listForClient(clientId)
      : supabase.from('health_checks').select('*').eq('user_id', userId).not('completed_at', 'is', null).order('completed_at', { ascending: false }).limit(20).then(r => r),
    referrals.list(userId),
    // Engagement pauses — let Rai know which clients are paused (so she
    // doesn't surface tasks for them) and how long they've been paused
    // historically (signal of relationship pattern).
    supabase.from('client_engagement_pauses').select('client_id, paused_at, resumed_at, reason').eq('user_id', userId).then(r => r, () => ({ data: [] })),
    // Recent revenue changes with reasons — let Rai see WHY money moved.
    // "Their rate doubled last month due to expansion" reads very different
    // from "Their rate halved due to contraction." Cap at most recent 30.
    supabase.from('client_revenue_history').select('client_id, monthly_rate, started_at, change_reason, change_note').eq('user_id', userId).order('started_at', { ascending: false }).limit(30).then(r => r, () => ({ data: [] }))
  ]);

  // Build pause-by-client and most-recent-revenue-change-by-client maps
  const MS_PER_MONTH = 30.44 * 24 * 60 * 60 * 1000;
  const nowMs = Date.now();
  const pausesByClient = {};
  for (const p of (pauseList || [])) {
    if (!pausesByClient[p.client_id]) pausesByClient[p.client_id] = [];
    pausesByClient[p.client_id].push(p);
  }
  const totalPausedMonths = (id) => {
    const arr = pausesByClient[id] || [];
    let totalMs = 0;
    for (const p of arr) {
      const start = new Date(p.paused_at).getTime();
      const end = p.resumed_at ? new Date(p.resumed_at).getTime() : nowMs;
      totalMs += Math.max(0, end - start);
    }
    return Math.floor(totalMs / MS_PER_MONTH);
  };
  const isCurrentlyPaused = (id) => (pausesByClient[id] || []).some(p => !p.resumed_at);

  // Most recent revenue change per client (revHistList is desc by started_at)
  const lastRevChangeByClient = {};
  for (const r of (revHistList || [])) {
    if (!lastRevChangeByClient[r.client_id]) {
      lastRevChangeByClient[r.client_id] = {
        rate: r.monthly_rate,
        started_at: r.started_at,
        reason: r.change_reason,
        note: r.change_note
      };
    }
  }

  // On Saturday/Sunday, drop recurring tasks from Rai's task list.
  // Recurring tasks are still in the user's UI (they can complete them
  // voluntarily), but Rai shouldn't treat their un-done state as neglect
  // when scoring client fragility, picking the daily client, generating
  // observations, or writing criticisms. A "check email daily" recurring
  // task left open on Saturday isn't a signal — it's a weekend.
  const _now = new Date();
  const _dow = _now.getDay(); // 0=Sun, 6=Sat
  const _isWeekend = _dow === 0 || _dow === 6;
  const taskListForRai = _isWeekend
    ? (taskList || []).filter(t => !t.is_recurring)
    : (taskList || []);

  const context = {
    clients: (clientList || []).map(c => ({
      name: c.name,
      contact: c.contact,
      role: c.role,
      revenue: c.revenue,
      months: c.months,
      retention_score: c.retention_score,
      drift: c.drift_status,
      tag: c.tag,
      profile_score: c.profile_score,
      profile_scores: c.profile_scores,
      // Engagement pause status. is_paused: true means Rai should not
      // suggest tasks for this client. total_paused_months: cumulative
      // time spent paused across the relationship (signal of pattern).
      is_paused: isCurrentlyPaused(c.id),
      total_paused_months: totalPausedMonths(c.id),
      // Most recent revenue change with reason. Lets Rai narrate WHY
      // revenue moved, not just THAT it moved. null if no change history.
      last_revenue_change: lastRevChangeByClient[c.id] || null
    })),
    tasks_today: taskListForRai.map(t => ({
      text: t.text,
      client: t.client_name,
      done: t.is_done,
      recurring: t.is_recurring
    })),
    recent_health_checks: (hcList || []).slice(0, 10).map(h => ({
      client_id: h.client_id,
      drift: h.drift_status,
      completed: h.completed_at
    })),
    referrals: {
      total: (refList || []).length,
      active: (refList || []).filter(r => r.status === 'converted').length
    }
  };

  // If specific client, add their detail
  if (clientId) {
    const { data: client } = await clients.get(clientId);
    if (client) {
      context.focused_client = {
        name: client.name,
        contact: client.contact,
        role: client.role,
        revenue: client.revenue,
        months: client.months,
        retention_score: client.retention_score,
        drift: client.drift_status,
        profile_score: client.profile_score,
        profile_scores: client.profile_scores,
        notes: client.notes
      };
    }
  }

  return context;
};


// ============================================================
// WORKERS — people Operator delegates tasks to
// ============================================================

export const workers = {
  // List all active (non-archived) workers for this Operator
  list: async (userId) => {
    const { data, error } = await supabase
      .from('workers')
      .select('*')
      .eq('user_id', userId)
      .is('archived_at', null)
      .order('name', { ascending: true });
    return { data, error };
  },

  create: async (userId, { name, email, role }) => {
    const { data, error } = await supabase
      .from('workers')
      .insert({
        user_id: userId,
        name,
        email: email.toLowerCase().trim(),
        role: role || null,
      })
      .select()
      .single();
    return { data, error };
  },

  update: async (workerId, fields) => {
    const { data, error } = await supabase
      .from('workers')
      .update(fields)
      .eq('id', workerId)
      .select()
      .single();
    return { data, error };
  },

  // Soft-archive (Worker stops appearing in pickers). Their assigned
  // tasks keep the assigned_worker_id reference for history.
  archive: async (workerId) => {
    const { data, error } = await supabase
      .from('workers')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', workerId)
      .select()
      .single();
    return { data, error };
  },

  // Stats for the Workers page list — pending/done counts per worker.
  // Returns an object keyed by worker_id: { pending, done }.
  getCounts: async (userId) => {
    const { data, error } = await supabase
      .from('tasks')
      .select('assigned_worker_id, is_done')
      .eq('user_id', userId)
      .not('assigned_worker_id', 'is', null);
    if (error) return { data: null, error };
    const counts = {};
    (data || []).forEach(t => {
      const wid = t.assigned_worker_id;
      if (!counts[wid]) counts[wid] = { pending: 0, done: 0 };
      if (t.is_done) counts[wid].done++;
      else counts[wid].pending++;
    });
    return { data: counts, error: null };
  },

  // ALL historical completions attributed to workers. Used by the Workers
  // page to compute long-running stats that the in-memory `tasks` array
  // can't preserve — once the midnight rollover nulls completed_at on
  // recurring tasks, the only way to know "worker X completed task Y" is
  // to read task_completions.
  //
  // Returns the raw rows (sorted newest-first). Workers page composes
  // them with the in-memory open tasks to compute pending/overdue/etc.
  //
  // Capacity: ~13k rows/year per heavy user. Even at 5 years (~65k rows),
  // this query returns in <100ms on Supabase Pro and payload is ~10MB
  // uncompressed. Fetched once on Workers page mount, held in state.
  getAllCompletions: async (userId) => {
    const { data, error } = await supabase
      .from('task_completions')
      .select('id, task_id, assigned_worker_id, client_id, client_name, task_text, is_recurring, completed_at, due_date, was_on_time')
      .eq('user_id', userId)
      .not('assigned_worker_id', 'is', null)
      .order('completed_at', { ascending: false });
    return { data: data || [], error };
  },
};


// ============================================================
// WORKER MAGIC TOKENS — auth for the magic-link dashboard
// ============================================================

// Generate a URL-safe random token (32 chars).
// Uses crypto.getRandomValues for cryptographic randomness.
function generateToken() {
  // This token IS the worker's credential — never degrade to
  // Math.random(). Every supported browser has crypto.getRandomValues;
  // if it's somehow absent, fail loudly rather than mint a guessable
  // magic link.
  if (typeof crypto === "undefined" || !crypto.getRandomValues) {
    throw new Error("Secure random unavailable — cannot generate worker token");
  }
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  // base64url
  let str = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return str;
}

export const workerTokens = {
  // NOTE: currently UNCALLED from the app — the live token mint is the
  // worker-task-notify edge function. Kept correct so it isn't a trap:
  // semantics are now mint-fresh + hash-only storage (a DB leak cannot
  // expose live links). Returns the plaintext token ONCE on `data.token`
  // for immediate display; it is never persisted and cannot be re-read.
  getOrCreate: async (userId, workerId) => {
    const token = generateToken();
    const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    const tokenHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
    const expires = new Date();
    expires.setDate(expires.getDate() + 7);

    const { data, error } = await supabase
      .from('worker_magic_tokens')
      .insert({
        user_id: userId,
        worker_id: workerId,
        token_hash: tokenHash,
        expires_at: expires.toISOString(),
      })
      .select()
      .single();
    return { data: data ? { ...data, token } : null, error };
  },

  // Revoke a token (Worker clicks "this isn't me") — matched by hash.
  revoke: async (token) => {
    const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    const tokenHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
    const { data, error } = await supabase
      .from('worker_magic_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('token_hash', tokenHash)
      .select()
      .single();
    return { data, error };
  },
};


// ============================================================
// PERSONAL CALENDAR EVENTS — today timeline (manual + future Google sync)
// ============================================================
//
// Backs the "today timeline" widget. For now only `source='manual'` rows
// are written from the client. Once Google Calendar sync ships, rows
// with `source='google'` will be added by the sync layer; the timeline
// reads them through this same module.
//
// Conventions:
//   listToday(userId)         → all rows whose starts_at falls in today's
//                                 [00:00, 24:00) UTC range, sorted by starts_at
//   create(userId, evt)       → insert a manual event. evt = { title, starts_at, ends_at? }
//   update(eventId, patch)    → patch a manual event. RLS blocks google rows.
//   remove(eventId)           → delete a manual event. RLS blocks google rows.
// ============================================================

export const personalCalendar = {
  // Get events from ~now through 7 days ahead — covers the Today dial, the
  // Tomorrow strip, and the Later (days 2–6) columns in ONE fetch. Far-future
  // events (e.g. Sep 1 created today) are not returned here but remain safely
  // stored; once the rolling 7-day window reaches their date they surface
  // automatically. Nothing expires or deletes them. Wide UTC span (−2h..+8d)
  // for tz-safety; the UI filters to exact local days.
  listUpcoming: async (userId) => {
    const now = Date.now();
    // Lower bound covers ALL of today, not just the last 2 hours. The old
    // `now - 2h` floor dropped events earlier in the day, so by evening every
    // already-passed event for today vanished and the dial read "No calls
    // today" on a day that had calls. -26h guarantees local start-of-today is
    // covered in any timezone; the UI filters each section to its exact local
    // day (ymdInTz === todayYmd / tmrwYmd / later), so a wider DB span is a
    // safe superset. Upper bound stays +8d so the Tomorrow strip and Later
    // (days 2-6) columns, which read the SAME personalEvents array, still get
    // their data.
    const startIso = new Date(now - 26 * 3600 * 1000).toISOString();
    const endIso = new Date(now + 8 * 24 * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from('personal_calendar_events')
      .select('*')
      .eq('user_id', userId)
      .gte('starts_at', startIso)
      .lte('starts_at', endIso)
      .order('starts_at', { ascending: true });
    return { data: data || [], error };
  },

  // Get every event for today. "Today" is a 24-hour window aligned to the
  // user's local day, but we use a +/- 23h relative window centered on
  // "now" to be timezone-safe (same pattern as raiPicks.getCurrent). The
  // timeline UI further filters to events overlapping the displayed
  // window — this method just gives it everything plausibly relevant.
  listToday: async (userId) => {
    const now = Date.now();
    const startIso = new Date(now - 23 * 3600 * 1000).toISOString();
    const endIso = new Date(now + 23 * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from('personal_calendar_events')
      .select('*')
      .eq('user_id', userId)
      .gte('starts_at', startIso)
      .lte('starts_at', endIso)
      .order('starts_at', { ascending: true });
    return { data: data || [], error };
  },

  // Insert a manual event. Caller is responsible for parsing user input
  // into { title, starts_at, ends_at?, client_id?, client_name? }.
  // RLS enforces source='manual'. client_id/client_name link the event
  // to a client so it becomes a signal Rai can read.
  create: async (userId, { title, starts_at, ends_at = null, client_id = null, client_name = null }) => {
    const { data, error } = await supabase
      .from('personal_calendar_events')
      .insert({
        user_id: userId,
        title,
        starts_at,
        ends_at,
        client_id,
        client_name,
        source: 'manual',
      })
      .select()
      .single();
    return { data, error };
  },

  // Patch a manual event. Common patches: title rename, time adjust.
  update: async (eventId, patch) => {
    // Only allow patchable fields through; never let caller change
    // user_id, source, external_id from the client.
    const allowed = {};
    if (typeof patch.title === 'string') allowed.title = patch.title;
    if (patch.starts_at) allowed.starts_at = patch.starts_at;
    if (patch.ends_at !== undefined) allowed.ends_at = patch.ends_at;
    if (patch.client_id !== undefined) allowed.client_id = patch.client_id;
    if (patch.client_name !== undefined) allowed.client_name = patch.client_name;
    const { data, error } = await supabase
      .from('personal_calendar_events')
      .update(allowed)
      .eq('id', eventId)
      .select()
      .single();
    return { data, error };
  },

  // Delete a manual event. RLS blocks deletion of google rows.
  remove: async (eventId) => {
    const { data, error } = await supabase
      .from('personal_calendar_events')
      .delete()
      .eq('id', eventId)
      .select()
      .single();
    return { data, error };
  },
};
