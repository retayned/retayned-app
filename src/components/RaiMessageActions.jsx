// ─── RaiMessageActions v2 (Jun 2026) ───────────────────────────────────
// Action chips under Rai replies that contain an actual DRAFT — not
// under every message. Detection: a delimiter-fenced block (Rai fences
// drafts with --- lines) or a Subject: line. Only the draft body ships
// to Mail/Messages/clipboard; Rai's preamble ("Here's a draft:") and
// postamble commentary are excluded. A leading Subject: line becomes
// the mailto subject parameter instead of polluting the body.
import { useState } from "react";

function extractDraft(text) {
  if (!text) return null;
  const lines = text.split("\n");
  const isDelim = (l) => /^\s*[-\u2013\u2014_*]{2,}\s*$/.test(l);
  const delims = [];
  for (let i = 0; i < lines.length; i++) if (isDelim(lines[i])) delims.push(i);
  let body = null;
  if (delims.length >= 2) {
    body = lines.slice(delims[0] + 1, delims[1]).join("\n").trim();
  } else if (delims.length === 1) {
    body = lines.slice(delims[0] + 1).join("\n").trim();
  } else if (/^\s*\*{0,2}subject:/im.test(text)) {
    // No fences but an explicit Subject line — treat the whole reply
    // from the Subject line down as the draft.
    const idx = lines.findIndex(l => /^\s*\*{0,2}subject:/i.test(l));
    body = lines.slice(idx).join("\n").trim();
  }
  if (!body || body.length < 40) return null;
  let subject = null;
  const m = body.match(/^\s*\*{0,2}Subject:\*{0,2}\s*(.+)\n+/i);
  if (m) {
    subject = m[1].replace(/\*+/g, "").trim();
    body = body.slice(m[0].length).trim();
  }
  return { subject, body };
}

const ICONS = {
  copy: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  check: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  mail: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 7L2 7"/></svg>,
  message: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
};

export default function RaiMessageActions({ text }) {
  const [copied, setCopied] = useState(false);
  const draft = extractDraft(text);
  if (!draft) return null;
  const encBody = encodeURIComponent(draft.body);
  const mailHref = draft.subject
    ? "mailto:?subject=" + encodeURIComponent(draft.subject) + "&body=" + encBody
    : "mailto:?body=" + encBody;
  const copy = async () => {
    try {
      const full = draft.subject ? "Subject: " + draft.subject + "\n\n" + draft.body : draft.body;
      await navigator.clipboard.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (_) { /* clipboard unavailable */ }
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
      <button type="button" className={"rt-msg-act" + (copied ? " is-done" : "")} onClick={copy}>
        {copied ? ICONS.check : ICONS.copy}<span>{copied ? "Copied" : "Copy"}</span>
      </button>
      <a className="rt-msg-act" href={mailHref}>{ICONS.mail}<span>Open in Mail</span></a>
      <a className="rt-msg-act" href={"sms:?&body=" + encBody}>{ICONS.message}<span>Open in Messages</span></a>
    </div>
  );
}
