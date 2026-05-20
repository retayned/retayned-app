import React from 'react';
import ReactDOM from 'react-dom/client';
import { useAuth } from './hooks/useAuth';
import AuthPage from './AuthPage';
import App from './App';
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
