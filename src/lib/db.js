// ============================================================
// RETAYNED — SUPABASE DATA LAYER
// lib/supabase.js
// ============================================================

import { supabase } from './supabase';




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
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .is('cleared_at', null)  // exclude soft-cleared (post-2am rollover) tasks
      .or(`is_done.eq.false,completed_at.gte.${today},is_recurring.eq.true`)
      .order('sort_order', { ascending: true });
    return { data: data || [], error };
  },

  create: async (userId, task) => {
    const { data, error } = await supabase
      .from('tasks')
      .insert({ user_id: userId, ...task })
      .select()
      .single();
    return { data, error };
  },

  toggle: async (taskId, isDone) => {
    const { data, error } = await supabase
      .from('tasks')
      .update({
        is_done: isDone,
        completed_at: isDone ? new Date().toISOString() : null
      })
      .eq('id', taskId)
      .select()
      .single();
    return { data, error };
  },

  // Set / clear / change a task's due_date. Used by:
  //   - Composer Due chip (creates with date)
  //   - Push buttons on task tiles (Today→Tomorrow, Tomorrow→Later, Later→pull to Today)
  //   - Custom date picker
  // Pass null to clear (returns task to "no specific date" → renders in Today bucket).
  // Pass YYYY-MM-DD string or Date object.
  setDueDate: async (taskId, dueDate) => {
    const dateStr = dueDate == null
      ? null
      : (dueDate instanceof Date
        ? dueDate.toISOString().split('T')[0]
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

  // Reorder tasks (batch update sort_order)
  reorder: async (taskOrders) => {
    // taskOrders = [{ id, sort_order }, ...]
    const promises = taskOrders.map(({ id, sort_order }) =>
      supabase.from('tasks').update({ sort_order }).eq('id', id)
    );
    const results = await Promise.all(promises);
    return { errors: results.filter(r => r.error).map(r => r.error) };
  },

  // Reset recurring tasks (called at start of day)
  resetRecurring: async (userId) => {
    const { data, error } = await supabase
      .from('tasks')
      .update({ is_done: false, completed_at: null })
      .eq('user_id', userId)
      .eq('is_recurring', true)
      .eq('is_done', true)
      .select();
    return { data, error };
  },

  // Get count of completed tasks for week/month/year windows + history buckets.
  // Used for the sidebar tasks-completed widget. Single query returns just
  // completed_at timestamps; we bucket on the client. Cheaper than separate
  // count queries since most users have <1k completed tasks/year.
  //
  // Counts include both regular tasks and recurring tasks (each completion
  // is a separate row in completion history once the recurring task has been
  // reset and re-completed). Excludes still-incomplete tasks.
  //
  // Returns:
  //   week, month, year — current period counts (rolling 7/30/365 days from now)
  //   weekHistory[12]   — counts per rolling 7-day bucket, oldest → newest
  //                       (index 11 = current week, index 10 = last week, etc.)
  //   monthHistory[12]  — counts per rolling 30-day bucket, oldest → newest
  //                       (index 11 = current month, index 10 = last month, etc.)
  //   dayStreak         — consecutive days ending today with at least 1 completion
  getCompletedCounts: async (userId) => {
    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);
    const { data, error } = await supabase
      .from('tasks')
      .select('completed_at')
      .eq('user_id', userId)
      .not('completed_at', 'is', null)
      .gte('completed_at', oneYearAgo.toISOString());
    if (error) return {
      data: { week: 0, month: 0, year: 0, weekHistory: Array(12).fill(0), monthHistory: Array(12).fill(0), dayStreak: 0 },
      error,
    };

    const now = new Date();
    const nowMs = now.getTime();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const sevenDaysAgo  = new Date(nowMs - 7  * DAY_MS);
    const thirtyDaysAgo = new Date(nowMs - 30 * DAY_MS);

    // Roll-up counts for the active toggle
    let week = 0, month = 0, year = 0;

    // 12 rolling weekly buckets — index 0 = oldest (84 days ago → 77 days ago),
    // index 11 = current (7 days ago → now). Each bucket spans 7 days.
    const weekHistory = Array(12).fill(0);
    // 12 rolling monthly buckets — index 0 = oldest (~360 days ago), index 11 = current.
    // Each bucket spans 30 days. We use 30-day windows (not calendar months) so the
    // boundaries line up with the rolling "this month" count and the user's mental
    // model of "last 30 days."
    const monthHistory = Array(12).fill(0);

    // For the streak: collect set of YYYY-MM-DD strings where at least one task
    // was completed. Then walk backwards from today.
    const daysWithCompletions = new Set();

    for (const row of (data || [])) {
      const t = new Date(row.completed_at);
      const tMs = t.getTime();

      year++;
      if (t >= thirtyDaysAgo) month++;
      if (t >= sevenDaysAgo)  week++;

      // Weekly bucket: how many full 7-day windows ago?
      const daysAgo = (nowMs - tMs) / DAY_MS;
      const weekIdx = 11 - Math.floor(daysAgo / 7);
      if (weekIdx >= 0 && weekIdx < 12) weekHistory[weekIdx]++;

      // Monthly bucket: how many full 30-day windows ago?
      const monthIdx = 11 - Math.floor(daysAgo / 30);
      if (monthIdx >= 0 && monthIdx < 12) monthHistory[monthIdx]++;

      // Day key for streak
      daysWithCompletions.add(t.toISOString().slice(0, 10));
    }

    // Compute day streak — walk back from today as long as each day has ≥1 completion.
    // If today has no completions yet, start from yesterday (so the streak doesn't
    // break just because the user hasn't worked yet today).
    let dayStreak = 0;
    const todayKey = now.toISOString().slice(0, 10);
    let cursor = new Date(now);
    if (!daysWithCompletions.has(todayKey)) {
      cursor = new Date(nowMs - DAY_MS);
    }
    while (true) {
      const key = cursor.toISOString().slice(0, 10);
      if (daysWithCompletions.has(key)) {
        dayStreak++;
        cursor = new Date(cursor.getTime() - DAY_MS);
      } else {
        break;
      }
    }

    return { data: { week, month, year, weekHistory, monthHistory, dayStreak }, error: null };
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
  markCompleteByWorker: async (taskId) => {
    const { data, error } = await supabase
      .from('tasks')
      .update({
        is_done: true,
        completed_at: new Date().toISOString(),
        worker_completed_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .select()
      .single();
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
};


// ============================================================
// HEALTH CHECKS
// ============================================================

export const healthChecks = {
  // Get pending (upcoming + overdue) health checks
  listPending: async (userId) => {
    const { data, error } = await supabase
      .from('health_checks')
      .select('*, client:clients(name, retention_score)')
      .eq('user_id', userId)
      .is('completed_at', null)
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
      ? due_date.toISOString().split('T')[0]
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

  // Schedule next HC after completing one (default 30 days)
  scheduleNext: async (userId, clientId, daysOut = 30) => {
    const due = new Date();
    due.setDate(due.getDate() + daysOut);
    return healthChecks.schedule(userId, clientId, due.toISOString().split('T')[0]);
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

  delete: async (entryId) => {
    const { error } = await supabase
      .from('rolodex')
      .delete()
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
    // Get current messages
    const { data: convo } = await supabase
      .from('rai_conversations')
      .select('messages')
      .eq('id', convoId)
      .single();

    const messages = [...(convo?.messages || []), { role, text, timestamp: new Date().toISOString() }];

    const { data, error } = await supabase
      .from('rai_conversations')
      .update({ messages })
      .eq('id', convoId)
      .select()
      .single();

    return { data, error };
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
  // Sweep behaviour change (May 2026): the sweep no longer wipes the
  // previous day's rows before writing today's — yesterday's row stays
  // in place so the sweep can read it to enforce the "no back-to-back
  // same client" rule. To keep this method returning ONLY today's pick,
  // we filter to rows whose picked_at is within the last 23 hours.
  //
  // Why 23h and not "today in UTC"? Sweeps fire at the user's LOCAL 3am.
  // For a user in ET (UTC-5), that's 8am UTC. If we filtered by UTC date,
  // every evening between 7pm ET (midnight UTC) and 3am ET (sweep time)
  // the row would fall on the "previous" UTC date and disappear from view.
  // A relative-age filter is timezone-free and always returns the most
  // recent pick if one was written within the past day.
  getCurrent: async (userId) => {
    const cutoffIso = new Date(Date.now() - 23 * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from('rai_picks')
      .select('*')
      .eq('user_id', userId)
      .gte('picked_at', cutoffIso)
      .order('picked_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return { data, error };
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
  changeRate: async (userId, clientId, newRate) => {
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

    // Open new active row
    const { data: newRow, error: insertErr } = await supabase
      .from('client_revenue_history')
      .insert({
        user_id: userId,
        client_id: clientId,
        monthly_rate: numericRate,
        started_at: now,
        ended_at: null,
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

  create: async (userId, { client_id, client_name, channel }) => {
    const { data, error } = await supabase
      .from('touchpoints')
      .insert({
        user_id: userId,
        client_id,
        channel,
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
    { data: refList }
  ] = await Promise.all([
    clients.list(userId),
    tasks.listToday(userId),
    clientId
      ? healthChecks.listForClient(clientId)
      : supabase.from('health_checks').select('*').eq('user_id', userId).not('completed_at', 'is', null).order('completed_at', { ascending: false }).limit(20).then(r => r),
    referrals.list(userId)
  ]);

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
      profile_scores: c.profile_scores
    })),
    tasks_today: (taskList || []).map(t => ({
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
};


// ============================================================
// WORKER MAGIC TOKENS — auth for the magic-link dashboard
// ============================================================

// Generate a URL-safe random token (32 chars).
// Uses crypto.getRandomValues for cryptographic randomness.
function generateToken() {
  const bytes = new Uint8Array(24);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  // base64url
  let str = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return str;
}

export const workerTokens = {
  // Get or create an active token for a worker. If a non-expired
  // non-revoked token exists, reuse it — otherwise create a fresh one.
  // 7-day expiry from creation.
  getOrCreate: async (userId, workerId) => {
    // First check for an existing active token
    const { data: existing } = await supabase
      .from('worker_magic_tokens')
      .select('*')
      .eq('worker_id', workerId)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) return { data: existing, error: null };

    // Create new
    const expires = new Date();
    expires.setDate(expires.getDate() + 7);

    const { data, error } = await supabase
      .from('worker_magic_tokens')
      .insert({
        user_id: userId,
        worker_id: workerId,
        token: generateToken(),
        expires_at: expires.toISOString(),
      })
      .select()
      .single();
    return { data, error };
  },

  // Revoke a token (Worker clicks "this isn't me")
  revoke: async (token) => {
    const { data, error } = await supabase
      .from('worker_magic_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('token', token)
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
  // into { title, starts_at, ends_at? }. RLS enforces source='manual'.
  create: async (userId, { title, starts_at, ends_at = null }) => {
    const { data, error } = await supabase
      .from('personal_calendar_events')
      .insert({
        user_id: userId,
        title,
        starts_at,
        ends_at,
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
