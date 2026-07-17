// BUGFIX (Jun 9 2026): EmptyState referenced EMPTY_STATE_ICONS but no
// declaration existed anywhere — every EmptyState call site passes an
// icon prop ("clients"/"health"/"referrals"/"rolodex"), so any brand-new
// user with an empty page hit a ReferenceError and the page crashed.
// An empty map restores the intended graceful fallback (no icon drawn).
// Populate with real illustrations when designed.
const EMPTY_STATE_ICONS = {};


function SkeletonTaskList({ rows = 4 }) {
  const widths = ["78%", "65%", "45%", "70%", "55%", "82%"];
  return (
    <div style={{ background: "#fff", border: "1px solid #EFEFEA", borderRadius: 12, overflow: "hidden" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 16px",
          borderBottom: i < rows - 1 ? "1px solid #EFEFEA" : "none",
        }}>
          <span className="rt-sk" style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="rt-sk" style={{ height: 13, width: widths[i % widths.length] }} />
            <div style={{ display: "flex", gap: 6 }}>
              <span className="rt-sk" style={{ height: 10, width: 48, borderRadius: 3 }} />
              <span className="rt-sk" style={{ height: 10, width: 72, borderRadius: 3 }} />
            </div>
          </div>
          <span className="rt-sk" style={{ width: 28, height: 16, borderRadius: 4, flexShrink: 0 }} />
        </div>
      ))}
    </div>
  );
}

function SkeletonClientList({ rows = 5 }) {
  const widths = ["55%", "42%", "62%", "48%", "58%", "50%"];
  return (
    <div style={{ background: "#fff", border: "1px solid #EFEFEA", borderRadius: 12, overflow: "hidden" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 14px",
          borderBottom: i < rows - 1 ? "1px solid #EFEFEA" : "none",
        }}>
          <span className="rt-sk" style={{ width: 32, height: 32, borderRadius: 16, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="rt-sk" style={{ height: 13, width: widths[i % widths.length] }} />
            <span className="rt-sk" style={{ height: 10, width: "32%" }} />
          </div>
          <span className="rt-sk" style={{ height: 11, width: 70, flexShrink: 0 }} />
          <span className="rt-sk" style={{ width: 36, height: 20, borderRadius: 5, flexShrink: 0 }} />
        </div>
      ))}
    </div>
  );
}

function SkeletonHealthQueue({ rows = 3 }) {
  const widths = ["50%", "42%", "58%"];
  const subWidths = ["38%", "32%", "40%"];
  return (
    <div style={{ background: "#fff", border: "1px solid #EFEFEA", borderRadius: 12, overflow: "hidden" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "14px 16px",
          borderBottom: i < rows - 1 ? "1px solid #EFEFEA" : "none",
        }}>
          <span className="rt-sk" style={{ width: 40, height: 40, borderRadius: 20, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="rt-sk" style={{ height: 14, width: widths[i % widths.length] }} />
            <span className="rt-sk" style={{ height: 11, width: subWidths[i % subWidths.length] }} />
          </div>
          <span className="rt-sk" style={{ width: 80, height: 28, borderRadius: 7, flexShrink: 0 }} />
        </div>
      ))}
    </div>
  );
}

// SkeletonPage — universal first-paint placeholder.
// Mirrors the geometry every page shares: a status band (eyebrow + h1 +
// meta row) at top, optional right-side action button, then a content
// surface. Renders at the .r-main level *instead of* the actual page
// render while dataLoaded is false. Previously, each page mounted its
// status band immediately with empty data (Hello, undefined — 0 tasks
// — 0% — no Rai pick — empty meta), then snapped to real values when
// data landed ~200ms later. That snap is the "garbage blocks" flash.
// One full-page skeleton eliminates the flash because nothing real
// renders until everything's ready to render correctly.
function SkeletonPage() {
  return (
    <div style={{ width: "100%" }}>
      {/* Status band placeholder */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "4px 4px 20px", marginBottom: 20, borderBottom: "1px solid #EFEFEA" }}>
        <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="rt-sk" style={{ height: 11, width: 90, borderRadius: 3 }} />
          <span className="rt-sk" style={{ height: 26, width: 220, borderRadius: 6 }} />
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <span className="rt-sk" style={{ height: 14, width: 70, borderRadius: 3 }} />
            <span className="rt-sk" style={{ height: 14, width: 90, borderRadius: 3 }} />
            <span className="rt-sk" style={{ height: 14, width: 80, borderRadius: 3 }} />
          </div>
        </div>
        <span className="rt-sk" style={{ height: 38, width: 130, borderRadius: 10, flexShrink: 0 }} />
      </div>
      {/* Content surface placeholder — generic list rows so it works
          for every page (Today/Clients/Health/Workers/Referrals/Rolodex
          all share a list-of-rows shape under their bands). */}
      <SkeletonClientList rows={6} />
    </div>
  );
}

function EmptyState({ icon, headline, body, cta, secondaryCta }) {
  return (
    <div style={{
      background: "#FFFFFF",
      border: "1px solid #EFEFEA",
      borderRadius: 12,
      padding: "56px 24px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      minHeight: 220,
    }}>
      {icon && EMPTY_STATE_ICONS[icon] && (
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          background: "#E6EFE9",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 18,
        }}>
          {EMPTY_STATE_ICONS[icon]}
        </div>
      )}
      <h2 style={{
        fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em",
        margin: "0 0 8px", color: "#1E261F",
      }}>{headline}</h2>
      <p style={{
        fontSize: 14, lineHeight: 1.55,
        color: "#6B6B66", margin: 0, maxWidth: 380,
      }}>{body}</p>
      {(cta || secondaryCta) && (
        <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap", justifyContent: "center" }}>
          {cta && (
            <button
              className="r-btn" data-tone="green"
              onClick={cta.onClick}
              style={{
                padding: "9px 16px", color: "#fff",
                border: "none", borderRadius: 8,
                fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >{cta.label}</button>
          )}
          {secondaryCta && (
            <button
              onClick={secondaryCta.onClick}
              style={{
                padding: "9px 16px", background: "transparent", color: "#33543E",
                border: "1px solid rgba(51,84,62,0.27)", borderRadius: 8,
                fontSize: 13, fontWeight: 500,
                cursor: "pointer", fontFamily: "inherit",
                transition: "background 120ms ease, border-color 120ms ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(51,84,62,0.06)"; e.currentTarget.style.borderColor = "rgba(51,84,62,0.55)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(51,84,62,0.27)"; }}
            >{secondaryCta.label}</button>
          )}
        </div>
      )}
    </div>
  );
}

export { EMPTY_STATE_ICONS, SkeletonTaskList, SkeletonClientList, SkeletonHealthQueue, SkeletonPage, EmptyState };
