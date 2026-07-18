import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      // Meta StartTrial for OAuth signups (Jul 2026). Email/password
      // signups fire in AuthPage at signUp success; Google arrivals land
      // here via SIGNED_IN with no signup callback, so detect brand-new
      // accounts by created_at (< 5 min old). Same localStorage guard and
      // eventID scheme as the email path — if both somehow fire for one
      // user, Meta dedups on the shared eventID. Pixel absence is a no-op.
      try {
        const u = session?.user;
        if (u && Date.now() - new Date(u.created_at).getTime() < 5 * 60 * 1000) {
          const trialKey = "__ret_trial_fired_" + u.id;
          if (window.fbq && !localStorage.getItem(trialKey)) {
            window.fbq("track", "StartTrial", {}, { eventID: "trial-" + u.id });
            localStorage.setItem(trialKey, "1");
          }
          // Ad attribution stamp for OAuth signups — same cookie, same
          // profile column as the email path; guarded so it writes once.
          const attrKey = "__ret_attr_written_" + u.id;
          if (!localStorage.getItem(attrKey)) {
            const raw = document.cookie.split("; ").find(r => r.startsWith("ret_attr="));
            if (raw) {
              try {
                const attr = JSON.parse(decodeURIComponent(raw.split("=").slice(1).join("=")));
                if (attr && typeof attr === "object") {
                  supabase.from('profiles').update({ attribution: attr }).eq('id', u.id)
                    .then(() => localStorage.setItem(attrKey, "1"), () => {});
                }
              } catch (_) { /* no-op */ }
            }
          }
        }
      } catch (_) { /* no-op */ }
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
}
