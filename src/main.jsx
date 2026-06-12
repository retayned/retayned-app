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
function Root() {
  const { user, loading } = useAuth();
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
  return user ? <App user={user} /> : <AuthPage />;
}
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
