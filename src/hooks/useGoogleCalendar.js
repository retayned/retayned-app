// ─── useGoogleCalendar (June 2026 refactor, Piece E module 3) ──────────
// The entire Google Calendar integration, gathered VERBATIM from six
// non-contiguous App.jsx regions: connection state, connect/disconnect,
// the manual+silent sync function, the OAuth-callback effect (lands on
// Settings and refreshes connection state), and the 15-minute refocus
// sync beat. The interleaved rolodex page-effect stays in App.
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useGoogleCalendar(app) {
  const {
    page,
    setPage,
    setPersonalEvents,
    user,
  } = app;
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
  return { connectGoogleCalendar, disconnectGoogleCalendar, googleConnectPromptDismissed, googleConnectStatus, googleConnected, googleEmail, googleLastSyncedAt, googleSyncing, setGoogleConnectPromptDismissed, setGoogleConnectStatus, setGoogleConnected, setGoogleEmail, setGoogleLastSyncedAt, syncGoogleCalendar };
}
