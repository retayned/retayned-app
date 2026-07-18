// McpConsent — the OAuth consent screen for the Retayned MCP connector.
// Reached at #/mcp-consent?req=<b64url payload> via the mcp-oauth
// /authorize redirect. The logged-in user reviews what's being granted
// and approves; /approve (verified against their Supabase session)
// mints the code and hands back the redirect. Unauthenticated visitors
// see AuthPage first (main.jsx gate) — the hash survives login, so the
// consent renders right after.
import React, { useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { C } from "../theme";

function decodeReq() {
  try {
    // The /authorize redirect builds the URL with URL.searchParams,
    // which places ?req= BEFORE the #fragment — so the payload lives in
    // location.search, not inside the hash. Check both pockets.
    let raw = null;
    const hash = window.location.hash || "";
    const qIdx = hash.indexOf("?");
    if (qIdx !== -1) raw = new URLSearchParams(hash.slice(qIdx + 1)).get("req");
    if (!raw) raw = new URLSearchParams(window.location.search || "").get("req");
    if (!raw) return null;
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(b64 + "===".slice((b64.length + 3) % 4));
    const req = JSON.parse(json);
    if (!req.client_id || !req.redirect_uri || !req.code_challenge) return null;
    return req;
  } catch (_) {
    return null;
  }
}

export default function McpConsent({ user }) {
  const req = useMemo(decodeReq, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const deny = () => {
    if (!req) { window.location.href = "/"; return; }
    try {
      const r = new URL(req.redirect_uri);
      r.searchParams.set("error", "access_denied");
      if (req.state) r.searchParams.set("state", req.state);
      window.location.href = r.toString();
    } catch (_) { window.location.href = "/"; }
  };

  const approve = async () => {
    if (!req || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError("Your session expired — refresh and sign in again.");
        setBusy(false);
        return;
      }
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcp-oauth/approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            client_id: req.client_id,
            redirect_uri: req.redirect_uri,
            state: req.state || "",
            code_challenge: req.code_challenge,
            scope: req.scope || "retayned",
          }),
        },
      );
      const body = await resp.json().catch(() => null);
      if (!resp.ok || !body?.redirect_to) {
        setError(body?.error_description || body?.error || "Authorization failed — try again.");
        setBusy(false);
        return;
      }
      window.location.href = body.redirect_to;
    } catch (_) {
      setError("Network error — try again.");
      setBusy(false);
    }
  };

  const card = {
    maxWidth: 420, width: "100%", background: "#FFFFFF", borderRadius: 16,
    border: "1px solid #E5E7E2", padding: "32px 28px",
    boxShadow: "0 8px 32px rgba(28,50,36,0.08)",
  };
  const grantRow = { display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, color: "#3D463E", lineHeight: 1.45 };
  const dot = { flexShrink: 0, width: 6, height: 6, borderRadius: 999, background: C.primary, marginTop: 6 };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg || "#FAFAF7", padding: 20, fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <div style={card}>
        <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.04em", color: C.primary || "#33543E", marginBottom: 20 }}>Retayned.</div>
        {!req ? (
          <>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1C2420", margin: "0 0 8px" }}>Invalid authorization link</h1>
            <p style={{ fontSize: 13.5, color: "#5A665C", margin: 0 }}>This connection request is malformed or expired. Start the connection again from the app you're linking.</p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "#1C2420", margin: "0 0 6px" }}>Connect Claude to Retayned</h1>
            <p style={{ fontSize: 13.5, color: "#5A665C", margin: "0 0 18px" }}>
              Signed in as <strong>{user?.email || "your account"}</strong>. Claude will be able to:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
              <div style={grantRow}><span style={dot} />Read your client context — relationship state, notes, recent touchpoints and work</div>
              <div style={grantRow}><span style={dot} />Log touchpoints and add tasks, each time with your confirmation in Claude</div>
              <div style={grantRow}><span style={dot} />Nothing else — no deleting, no editing clients, no billing access</div>
            </div>
            {error && (
              <div style={{ fontSize: 12.5, color: "#8C3A2E", background: "#FBEDE9", borderRadius: 8, padding: "8px 12px", marginBottom: 14 }}>{error}</div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={deny} disabled={busy} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "1px solid #D8DDD6", background: "#FFFFFF", color: "#3D463E", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={approve} disabled={busy} style={{ flex: 1.4, padding: "11px 0", borderRadius: 10, border: "none", background: C.primaryDeep || "#1C3224", color: "#FFFFFF", fontSize: 14, fontWeight: 700, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1, fontFamily: "inherit" }}>
                {busy ? "Connecting…" : "Allow"}
              </button>
            </div>
            <p style={{ fontSize: 11.5, color: "#8A948B", marginTop: 16, marginBottom: 0 }}>You can revoke this anytime by disconnecting Retayned in Claude's connector settings.</p>
          </>
        )}
      </div>
    </div>
  );
}
