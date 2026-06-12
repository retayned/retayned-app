// ─── RaiMessageActions (Jun 2026) ──────────────────────────────────────
// Compact action row under Rai replies: hand a draft straight to Mail
// or Messages, or copy it. mailto:/sms: with no recipient opens a fresh
// compose with the body prefilled; the user picks the recipient. That
// is exactly the flow for "Rai drafted this, now send it."
// Hidden for short replies (< 60 chars) so acknowledgments stay clean.
import { useState } from "react";
import { C } from "../theme";

export default function RaiMessageActions({ text }) {
  const [copied, setCopied] = useState(false);
  if (!text || text.trim().length < 60) return null;
  const body = encodeURIComponent(text.trim());
  const btn = {
    background: "none", border: "none", padding: "2px 4px",
    fontSize: 11.5, fontWeight: 600, color: C.textMuted,
    cursor: "pointer", letterSpacing: "0.02em", textDecoration: "none",
    fontFamily: "inherit",
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (_) { /* clipboard unavailable — ignore */ }
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
      <button style={btn} onClick={copy}>{copied ? "Copied \u2713" : "Copy"}</button>
      <a style={btn} href={"mailto:?body=" + body}>Open in Mail</a>
      <a style={btn} href={"sms:?&body=" + body}>Open in Messages</a>
    </div>
  );
}
