import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

// Design tokens reconciled to the main app's real palette (App.jsx).
// Literal hexes here rather than the app's CSS vars (var(--rt-*)), since
// this standalone pre-auth page doesn't load the root themed stylesheet.
const C = {
  primary: "#33543E", primaryDeep: "#1C3224", primarySoft: "#E6EFE9", primaryGhost: "#F3F8F5",
  bg: "#FAFBFA", card: "#FFFFFF", surfaceWarm: "#F4F6F4",
  text: "#1E261F", textSec: "#4A4F4A", textMuted: "#8A8F8A",
  border: "#D8DFD8", borderLight: "#E8ECE6",
  // Brand purple — MUST match the site and app theme (#7c5cf3 / hover
  // #6a4ce8). This page is the site→app handoff; a different purple
  // here reads as leaving the brand at the exact moment of commitment.
  // (Was #5B21B6/#4C1D95 — a stale local palette from an earlier era.)
  btn: "#7c5cf3", btnHover: "#6a4ce8",
  danger: "#C4432B",
};

export default function AuthPage() {
  // Mode honors the arriving intent (Jul 2026). The site's Start Free
  // Trial forwards with ?src=site_signup (Sign In forwards with
  // ?src=site_login); ?plan= from pricing CTAs also means signup. New
  // users from an ad must land on Create Account, not "Welcome back."
  const [mode, setMode] = useState(() => {
    try {
      return /[?&](src=site_signup|mode=signup|plan=)/.test(window.location.search) ? 'signup' : 'signin';
    } catch { return 'signin'; }
  });
  // Trial segmentation: a pricing CTA carrying ?plan=agency|solo names
  // the trial the person chose. Stash it; App applies it to the billing
  // row after the account exists (RLS blocks a direct client write).
  useEffect(() => {
    try {
      const m = window.location.search.match(/[?&]plan=(agency|solo)/);
      if (m) localStorage.setItem('rt:intendedPlan', m[1]);
    } catch { /* fine */ }
  }, []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Terms acknowledgment — pre-checked by product decision (Jul 2026);
  // unchecking disables Create Account.
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  // Show/hide password — works in both modes.
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } }
      });
      if (signUpError) {
        setError(signUpError.message);
      } else if (data.user) {
        // Meta StartTrial (Jul 2026): the trial is no-card, so the trial
        // STARTS here — at account creation — not at Stripe checkout
        // (that moment is Purchase, fired server-side by the webhook).
        // eventID = user id: refires from double-submits or an OAuth
        // duplicate path dedupe on Meta's side; guard flag stops local
        // repeats. Pixel absence must never break signup.
        try {
          const trialKey = "__ret_trial_fired_" + data.user.id;
          if (window.fbq && !localStorage.getItem(trialKey)) {
            window.fbq("track", "StartTrial", {}, { eventID: "trial-" + data.user.id });
            localStorage.setItem(trialKey, "1");
          }
        } catch (_) { /* no-op */ }
        // Ad attribution (Jul 2026): the site stashed utm_*/fbclid from the
        // ad click in a .retayned.com cookie; stamp it onto the profile at
        // the trial-start moment. Powers the per-ad trial→paid report.
        try {
          const raw = document.cookie.split("; ").find(r => r.startsWith("ret_attr="));
          if (raw) {
            const attr = JSON.parse(decodeURIComponent(raw.split("=").slice(1).join("=")));
            if (attr && typeof attr === "object") {
              await supabase.from('profiles').update({ attribution: attr }).eq('id', data.user.id);
            }
          }
        } catch (_) { /* attribution must never break signup */ }
        // Update profile with company
        if (company) {
          await supabase.from('profiles').update({ company, full_name: fullName }).eq('id', data.user.id);
        }
      }
    }
    setLoading(false);
  };

  // Google sign-in — Supabase redirects to Google, Google bounces back to
  // the Supabase callback, Supabase lands the session on Site URL. The
  // ?plan= trial stash above survives this round-trip via localStorage.
  const handleGoogle = async () => {
    setError('');
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    // On success the browser navigates away; this only runs on failure.
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "12px 14px",
    border: "1px solid " + C.border,
    borderRadius: 10,
    fontSize: 14,
    fontFamily: "inherit",
    color: C.text,
    outline: "none",
    background: C.card,
    transition: "border-color 120ms ease, box-shadow 120ms ease",
  };
  const onInputFocus = (e) => {
    e.target.style.borderColor = C.primary;
    e.target.style.boxShadow = "0 0 0 3px " + C.primarySoft;
  };
  const onInputBlur = (e) => {
    e.target.style.borderColor = C.border;
    e.target.style.boxShadow = "none";
  };

  return (
    <div style={{ minHeight: "100vh", fontFamily: "'Manrope', system-ui, sans-serif", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input::placeholder { color: ${C.textMuted}; }
      `}</style>
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Logo — matches the app sidebar wordmark exactly: solid primary
            green, system-ui, weight 900, tight tracking. No gradient. */}
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <div style={{
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontWeight: 900,
            fontSize: 38,
            color: C.primary,
            letterSpacing: "-0.04em",
            lineHeight: 1.1,
          }}>Retayned.</div>
          <p style={{ fontSize: 14, color: C.textSec, marginTop: 10 }}>
            {mode === 'signin' ? 'Welcome back.' : '14 days free. No card required.'}
          </p>
        </div>

        {/* Form card — app card surface + the app's layered card shadow,
            no hard border (the app uses shadow surfaces, not borders). */}
        <div style={{
          background: C.card,
          borderRadius: 16,
          padding: "28px 26px",
          boxShadow: "0 1px 3px rgba(20,30,22,0.06), 0 8px 24px rgba(20,30,22,0.08), inset 0 1px 0 rgba(255,255,255,0.9)",
        }}>
          {/* Google sign-in — above email per SaaS convention. Same button
              serves both modes; Supabase creates the account on first use
              and the on_auth_user_created_billing trigger starts the trial. */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            style={{
              width: "100%",
              padding: "11px 0",
              borderRadius: 10,
              border: `1px solid ${C.border || "rgba(20,30,22,0.14)"}`,
              background: "#FFFFFF",
              color: C.text || "#1C2620",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: googleLoading ? "default" : "pointer",
              opacity: googleLoading ? 0.6 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              marginBottom: 18,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            {googleLoading ? "Redirecting…" : "Continue with Google"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <div style={{ flex: 1, height: 1, background: "rgba(20,30,22,0.10)" }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, letterSpacing: "0.04em" }}>OR</span>
            <div style={{ flex: 1, height: 1, background: "rgba(20,30,22,0.10)" }} />
          </div>
          {mode === 'signup' && (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, display: "block", marginBottom: 6 }}>Full name</label>
                <input value={fullName} onChange={e => setFullName(e.target.value)} onFocus={onInputFocus} onBlur={onInputBlur} placeholder="Your name" style={inputStyle} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, display: "block", marginBottom: 6 }}>Company</label>
                <input value={company} onChange={e => setCompany(e.target.value)} onFocus={onInputFocus} onBlur={onInputBlur} placeholder="Your company or studio (optional)" style={inputStyle} />
              </div>
            </>
          )}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, display: "block", marginBottom: 6 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} onFocus={onInputFocus} onBlur={onInputBlur} placeholder="you@company.com" onKeyDown={e => e.key === 'Enter' && handleSubmit()} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, display: "block", marginBottom: 6 }}>Password</label>
            <div style={{ position: "relative" }}>
              <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} onFocus={onInputFocus} onBlur={onInputBlur} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleSubmit()} style={{ ...inputStyle, paddingRight: 44 }} />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", padding: 4, cursor: "pointer", color: C.textMuted, display: "flex", alignItems: "center" }}
              >
                {showPassword ? (
                  /* eye-off */
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" /></svg>
                ) : (
                  /* eye */
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                )}
              </button>
            </div>
          </div>

          {error && <p style={{ fontSize: 13, color: C.danger, marginBottom: 14 }}>{error}</p>}

          {mode === 'signup' && (
            <label style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 12, color: C.textSec, lineHeight: 1.55, cursor: "pointer", textAlign: "left", marginBottom: 14 }}>
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={e => setAgreedToTerms(e.target.checked)}
                style={{ marginTop: 2, accentColor: C.primary, width: 15, height: 15, flexShrink: 0, cursor: "pointer" }}
              />
              <span>
                I've reviewed the <a href="https://retayned.com/terms" target="_blank" rel="noopener noreferrer" style={{ color: C.primary, fontWeight: 600 }}>Terms of Service</a> and <a href="https://retayned.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: C.primary, fontWeight: 600 }}>Privacy Policy</a>, and I confirm I have the right to process my clients' information for client management purposes.
              </span>
            </label>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || (mode === 'signup' && !agreedToTerms)}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = C.btnHover; }}
            onMouseLeave={e => { e.currentTarget.style.background = C.btn; }}
            style={{ width: "100%", padding: "13px", background: C.btn, color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: (loading || (mode === 'signup' && !agreedToTerms)) ? "default" : "pointer", fontFamily: "inherit", opacity: (loading || (mode === 'signup' && !agreedToTerms)) ? 0.7 : 1, transition: "background 120ms ease, opacity 120ms ease" }}
          >
            {loading ? '...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>

          <p style={{ textAlign: "center", fontSize: 13, color: C.textMuted, marginTop: 16 }}>
            {mode === 'signin' ? "Don't have an account? " : "Already have an account? "}
            <span onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }} style={{ color: C.primary, fontWeight: 700, cursor: "pointer" }}>
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
