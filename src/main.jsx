// Bundle-executed flag — MUST be the first statement. The index.html
// white-screen watchdog reloads the page only if this never appears
// (bundle 404 after a deploy). See index.html for the full story.
window.__RT_JS_EXECUTED__ = true;

// ── Boot profiler (Jul 2026) ─────────────────────────────────────────
// Phase timestamps for the "app loads forever on mobile" hunt. Always
// recorded (zero cost); rendered as an on-screen overlay only when the
// URL carries ?boottime — usable on a phone where no console exists.
// Phases: html→js = download+parse; js→auth = getSession (incl. token
// refresh); auth→data-start = profile+org gates; data-start→data-done =
// the 22-query hydrate batch.
window.__RT_BOOT = { html: performance.timing?.navigationStart || 0, js: Math.round(performance.now()) };
// Was this boot preceded by a watchdog force-reload? The stamp is written
// by index.html immediately before location.reload(); if it's fresh, the
// boot the user just sat through was actually TWO boots. This is the
// yes/no that convicts or clears the 6s watchdog for the "logo for 6-7
// seconds" symptom.
try { window.__RT_BOOT.wd = (Date.now() - Number(sessionStorage.getItem("rt:wsReloadAt") || 0)) < 30000 ? "yes" : "no"; } catch (_) { window.__RT_BOOT.wd = "?"; }
export const bootMark = (name) => { if (!(name in window.__RT_BOOT)) window.__RT_BOOT[name] = Math.round(performance.now()); };
window.__RT_BOOT_MARK = bootMark;

import React from 'react';
import ReactDOM from 'react-dom/client';
import { useAuth } from './hooks/useAuth';
import AuthPage from './AuthPage';
import App from './App';

// White-screen self-heal (Jun 2026). After a deploy, a restored or
// cached tab can hold an index.html that references hashed chunks
// which no longer exist on the CDN; the dynamic import fails and the
// app never mounts. Vite emits 'vite:preloadError' for exactly this
// case — reload once to fetch fresh HTML. The sessionStorage stamp
// prevents a reload loop if the failure is something else.
window.addEventListener('vite:preloadError', (event) => {
  try {
    event.preventDefault();
    const k = 'rt:chunkReloadAt';
    const last = Number(sessionStorage.getItem(k) || 0);
    if (Date.now() - last > 30000) {
      sessionStorage.setItem(k, String(Date.now()));
      window.location.reload();
    }
  } catch (_) { /* never let the handler itself throw */ }
});
function BootTimeOverlay() {
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => { const id = setInterval(force, 500); return () => clearInterval(id); }, []);
  if (!/[?&]boottime/.test(window.location.search)) return null;
  const b = window.__RT_BOOT || {};
  const rows = ["js", "mount", "auth", "data-start", "data-done"].map(k => `${k}: ${b[k] != null ? b[k] + "ms" : "…"}`).concat(`wd-reload: ${b.wd ?? "?"}`);
  return (
    <div style={{ position: "fixed", left: 8, bottom: 8, zIndex: 9999, background: "rgba(20,30,22,0.88)", color: "#DFF3E4", font: "600 11px/1.6 ui-monospace, monospace", padding: "8px 10px", borderRadius: 8, pointerEvents: "none", whiteSpace: "pre" }}>
      {rows.join("\n")}
    </div>
  );
}

function Root() {
  const { user, loading } = useAuth();
  React.useEffect(() => { bootMark("mount"); }, []);
  if (!loading) bootMark("auth");
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, -apple-system, sans-serif", background: "#F7F7F4" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.04em", color: "#33543E" }}>Retayned.</div>
          <p style={{ fontSize: 14, color: "#92A596", marginTop: 8 }}>Loading...</p>
        </div>
      </div>
    );
  }
  return (
    <>
      {user ? <App user={user} /> : <AuthPage />}
      <BootTimeOverlay />
    </>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
