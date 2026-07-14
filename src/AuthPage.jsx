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
        // Update profile with company
        if (company) {
          await supabase.from('profiles').update({ company, full_name: fullName }).eq('id', data.user.id);
        }
      }
    }
    setLoading(false);
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
