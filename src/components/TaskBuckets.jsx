import { useEffect } from "react";
import { Icon } from "./Icon";


// Quick log confirmation toast — auto-dismisses after 4s. Pulled out
// as its own component so the setTimeout cleanup is tied to the toast's
// lifecycle, not the parent's render cycle.
// ─── Bucket calendars ────────────────────────────────────────────────────
// Collapsible calendar views under the Tomorrow / Later task buckets.
// Tomorrow = single-day horizontal strip (A). Later = next 5 days as columns
// (B). Toggle only renders when the bucket has events (no dead-end expands).
function BucketCalToggle({ label, count, open, onToggle, C }) {
  return (
    <div onClick={onToggle}
      style={{ display: "flex", alignItems: "center", gap: 8, margin: "2px 6px 0", padding: "9px 4px", cursor: "pointer", fontFamily: "'Manrope', sans-serif", fontSize: 12, fontWeight: 600, color: C.textMuted }}>
      {/* Calendar widget glyph — body in sage (site brand light green) so
          the icon picks up a soft brand accent, while the "Calendar" label
          itself stays in standard dark text. Earlier the whole row was
          primary-green which was too prominent; now just the icon carries
          the color. */}
      <Icon name="due" size={16} color={C.textMuted} accent={C.textSec} />
      <span>{label}</span>
      <span style={{ color: C.textMuted, fontWeight: 500 }}>· {count} event{count === 1 ? "" : "s"}</span>
      <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", color: C.textMuted, transform: open ? "rotate(90deg)" : "none", transition: "transform .18s" }}>
        {/* Stroke chevron — replaces a filled ▾ glyph. Points right when
            collapsed, rotates 90° to point down when open. Matches the
            visual family of the lightning bolt next to Focus + other
            stroke icons. */}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 6l6 6-6 6" stroke={C.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  );
}
function BucketCalendarTomorrow({ events, C }) {
  const DAY_START = 8, DAY_END = 20;
  const span = DAY_END - DAY_START;
  const frac = (d) => Math.max(0, Math.min(1, ((d.getHours() + d.getMinutes() / 60) - DAY_START) / span));
  const sorted = [...events].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  const axis = ["8a", "10a", "12p", "2p", "4p", "6p", "8p"];
  const fmtTime = (d) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: d.getMinutes() ? "2-digit" : undefined }).replace(":00", "");
  return (
    <div style={{ background: C.primaryGhost, borderRadius: 12, padding: "14px 16px", margin: "8px 6px 4px" }}>
      {/* Timeline strip — at-a-glance time-of-day positioning. */}
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Manrope', sans-serif", fontSize: 9.5, fontWeight: 600, color: C.textMuted, marginBottom: 8, padding: "0 2px" }}>
        {axis.map(a => <span key={a}>{a}</span>)}
      </div>
      <div style={{ position: "relative", height: 30, background: C.card, borderRadius: 7, boxShadow: "inset 0 0 0 1px " + C.borderLight }}>
        {sorted.map((e, i) => {
          const _start = new Date(e.starts_at);
          const _end = e.ends_at ? new Date(e.ends_at) : new Date(_start.getTime() + 30 * 60000);
          const left = frac(_start) * 100;
          const rawWidth = (frac(_end) - frac(_start)) * 100;
          const width = Math.max(3, Math.min(rawWidth, 100 - left));
          return (
            <div key={e.id || i} title={fmtTime(_start) + " · " + e.title + (e.client_name ? " · " + e.client_name : "")}
              style={{ position: "absolute", top: 4, height: 22, left: left + "%", width: width + "%", background: i % 2 === 0 ? C.primary : C.primaryLight, borderRadius: 6 }} />
          );
        })}
      </div>
      {/* Agenda list — the actual event names, fully readable. The timeline
          above can't show titles (30-min bars truncate to nothing), so the
          names live here: time · title · client, one row each. */}
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 7 }}>
        {sorted.map((e, i) => {
          const _start = new Date(e.starts_at);
          return (
            <div key={(e.id || i) + "-row"} style={{ display: "flex", alignItems: "baseline", gap: 10, fontFamily: "'Manrope', sans-serif" }}>
              <span style={{ flexShrink: 0, width: 52, textAlign: "right", fontSize: 11, fontWeight: 700, color: C.primary, fontVariantNumeric: "tabular-nums" }}>{fmtTime(_start)}</span>
              <span style={{ flexShrink: 0, width: 6, height: 6, borderRadius: "50%", marginTop: 5, background: i % 2 === 0 ? C.primary : C.primaryLight }} />
              <span style={{ minWidth: 0, flex: 1, fontSize: 12.5, fontWeight: 600, color: C.text, lineHeight: 1.3 }}>
                {e.title}
                {e.client_name && <span style={{ fontWeight: 500, color: C.textSec }}>{" · " + e.client_name}</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function BucketCalendarLater({ days, C }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 8, margin: "8px 6px 4px" }}>
      {days.map((d) => {
        const has = d.events.length > 0;
        return (
          <div key={d.ymd} style={{ background: C.card, borderRadius: 10, boxShadow: "var(--rt-sh-row)", padding: 10, minHeight: 96, minWidth: 0, overflow: "hidden" }}>
            <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: has ? C.text : C.textMuted }}>{d.label}</div>
            <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 9.5, fontWeight: 500, color: C.textMuted, marginTop: 3 }}>{d.dateLabel}</div>
            {has ? (
              <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
                {d.events.slice(0, 3).map((e, i) => {
                  const _t = e.starts_at ? new Date(e.starts_at) : null;
                  const _timeLabel = _t ? _t.toLocaleTimeString("en-US", { hour: "numeric", minute: _t.getMinutes() ? "2-digit" : undefined }).replace(":00", "") : "";
                  return (
                  <div key={e.id || i} title={(_timeLabel ? _timeLabel + " · " : "") + e.title + (e.client_name ? " · " + e.client_name : "")}
                    style={{ fontFamily: "'Manrope', sans-serif", fontSize: 9.5, fontWeight: 600, lineHeight: 1.2, color: C.primary, background: C.primaryGhost, borderRadius: 5, padding: "4px 6px", borderLeft: "2px solid " + C.primaryLight, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, maxWidth: "100%" }}>
                    {_timeLabel && <span style={{ fontWeight: 700, marginRight: 4 }}>{_timeLabel}</span>}{e.title}
                  </div>
                  );
                })}
                {d.events.length > 3 && <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 9, color: C.textMuted }}>+{d.events.length - 3} more</div>}
              </div>
            ) : (
              <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 9.5, fontStyle: "italic", color: C.textMuted, marginTop: 10 }}>clear</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function QuickLogToast({ toast, onUndo, onCorrect, onDismiss, C }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(), 4000);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss]);
  if (toast.error) {
    return (
      <div className="rt-quicklog-toast" style={{ position: "fixed", right: 24, background: C.danger, color: "#fff", padding: "11px 16px", borderRadius: 10, boxShadow: "0 8px 24px rgba(20,30,22,0.25)", fontSize: 13, display: "flex", alignItems: "center", gap: 10, zIndex: 250, fontFamily: "inherit" }}>
        <span>Couldn't save — try again</span>
      </div>
    );
  }
  // "removed" state — shown right after an undo, offering to re-log as the
  // opposite type (the likely reason for the undo was a wrong type guess).
  if (toast.kind === "removed") {
    const label = toast.correctTo === "touchpoint" ? "Log as touchpoint instead" : "Log as task instead";
    return (
      <div className="rt-quicklog-toast" style={{ position: "fixed", right: 24, background: "#1E261F", color: "#fff", padding: "11px 16px", borderRadius: 10, boxShadow: "0 8px 24px rgba(20,30,22,0.25)", fontSize: 13, display: "flex", alignItems: "center", gap: 10, zIndex: 250, fontFamily: "inherit" }}>
        <span style={{ color: "#A8B0A8" }}>Removed{toast.label ? " · " + toast.label : ""}</span>
        <button onClick={onCorrect} style={{ background: "none", border: "none", color: "#C4A5F0", fontSize: 12, fontWeight: 600, cursor: "pointer", textDecoration: "underline", padding: 0, fontFamily: "inherit", marginLeft: 4 }}>{label}</button>
      </div>
    );
  }
  return (
    <div className="rt-quicklog-toast" style={{ position: "fixed", right: 24, background: "#1E261F", color: "#fff", padding: "11px 16px", borderRadius: 10, boxShadow: "0 8px 24px rgba(20,30,22,0.25)", fontSize: 13, display: "flex", alignItems: "center", gap: 10, zIndex: 250, fontFamily: "inherit" }}>
      <span style={{ color: "#5DCAA5" }}>✓</span>
      <span>{toast.kind === "touchpoint" ? "Touchpoint logged" : toast.kind === "event" ? "Event added" : "Task added"}{toast.label ? " · " + toast.label : ""}</span>
      <button onClick={onUndo} style={{ background: "none", border: "none", color: "#A8B0A8", fontSize: 12, cursor: "pointer", textDecoration: "underline", padding: 0, fontFamily: "inherit", marginLeft: 4 }}>Undo</button>
    </div>
  );
}

export { BucketCalToggle, BucketCalendarTomorrow, BucketCalendarLater, QuickLogToast };
