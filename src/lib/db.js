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
      .update({ is_active: false })
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
  }
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
  }
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
