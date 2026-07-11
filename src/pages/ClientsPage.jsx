// AUTO-EXTRACTED from App.jsx (page === "clients" block) — body is
// verbatim; only the surrounding component shell + imports are generated.
import { Icon } from "../components/Icon";
import { EmptyState } from "../components/Skeletons";
import { C } from "../theme";
import { ScoreReveal } from "../components/Onboarding";
import { retColor, retGradient, computeCadence } from "../utils";

export default function ClientsPage({ app }) {
  const {
    allCompletions,
    allTouchpoints,
    calcRetentionScore,
    billing,
    soloAtCap,
    clientSearch,
    clients,
    clientsDriftFilter,
    clientsScoreFilter,
    clientsSort,
    clientsView,
    dataLoaded,
    debugScores,
    newClient,
    personalEvents,
    profileDimensions,
    profileScores,
    profileStep,
    setClientSearch,
    setClientsSort,
    setClientsView,
    setNewClient,
    setPauseConfirm,
    setProfileScores,
    setProfileStep,
    setRemoveConfirm,
    setResumeConfirm,
    setRolodexConfirm,
    setSelectedClient,
    setShowAddClient,
    showAddClient,
    submitNewClient,
    can,
    clientAssignments,
    org,
    orgMembers,
    orgRole,
  } = app;

  // ─── AM coverage chip (Agency only, Jul 2026) ─────────────────────
  // Owner-role viewers see WHO covers each client at a glance, in every
  // view (table / columns / heatmap). Solo accounts have no org, AMs see
  // only their own book — both render nothing. Stacked initials, +N
  // overflow, hover names. Data comes from the same clientAssignments /
  // orgMembers the ClientModal picker uses.
  const amChipFor = (c) => {
    if (!org || !can || !can("manage_org", orgRole)) return null;
    const ids = new Set((clientAssignments || []).filter(a => a.client_id === c.id).map(a => a.member_user_id));
    if (ids.size === 0) return null;
    const ams = (orgMembers || []).filter(m => ids.has(m.user_id));
    if (!ams.length) return null;
    const nameOf = (m) => ((m.invited_email || "") || m.user_id).split("@")[0];
    const initialsOf = (m) => nameOf(m).slice(0, 2).toUpperCase();
    return (
      <span title={"Covered by " + ams.map(nameOf).join(", ")} style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
        {ams.slice(0, 2).map((m, i) => (
          <span key={m.user_id} style={{ width: 16, height: 16, borderRadius: 999, background: C.primarySoft, color: C.primaryDeep, fontSize: 7.5, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid " + C.card, marginLeft: i === 0 ? 0 : -5, letterSpacing: 0 }}>{initialsOf(m)}</span>
        ))}
        {ams.length > 2 && <span style={{ fontSize: 9, fontWeight: 700, color: C.textMuted, marginLeft: 2 }}>+{ams.length - 2}</span>}
      </span>
    );
  };

          // ─── Stubs for v2-specific per-client fields ──────────────────────
          // Real data lives in clients[]: name, ret, contact, role, months, revenue, velocity, lastHC, lastContact, tag
          const stubStage = (score) => score >= 80 ? "thriving" : score >= 65 ? "healthy" : score >= 45 ? "watch" : score >= 30 ? "at-risk" : "critical";
          // Real renewal info from renewal_date (+ optional renewal_recurrence).
          // One-time ("none"): shows the date as-is, can go "Overdue".
          // Recurring (monthly/quarterly/annual): the stored date is an ANCHOR;
          // we roll it forward to the next future occurrence, so it never reads
          // as overdue — it just shows the next cycle. Returns { str, days, urgent, recurring }.
          const renewalInfo = (c) => {
            if (!c.renewal_date) return { str: "—", days: Infinity, urgent: false, recurring: false };
            const today0 = new Date(); today0.setHours(0, 0, 0, 0);
            let rd = new Date(String(c.renewal_date).split("T")[0] + "T00:00:00");
            const rec = c.renewal_recurrence || "none";
            const recurring = rec !== "none";
            if (recurring) {
              // Advance the anchor forward by its period until it's today or later.
              let guard = 0;
              while (rd.getTime() < today0.getTime() && guard < 600) {
                if (rec === "monthly") rd.setMonth(rd.getMonth() + 1);
                else if (rec === "quarterly") rd.setMonth(rd.getMonth() + 3);
                else if (rec === "annual") rd.setFullYear(rd.getFullYear() + 1);
                else break;
                guard++;
              }
            }
            const days = Math.round((rd.getTime() - today0.getTime()) / 86400000);
            if (days < 0) return { str: "Overdue", days, urgent: true, recurring };
            if (days === 0) return { str: "Today", days, urgent: true, recurring };
            const str = days < 30 ? `${days}d` : `${Math.round(days / 30)}mo`;
            return { str, days, urgent: days <= 14, recurring };
          };
          // ─── Unified cadence (real) ─────────────────────────────────────────
          // Rhythm of ANY activity with a client — touchpoints, tasks, and
          // calendar events, merged. We compare days-since-last-activity against
          // the client's OWN average interval (relative to their normal, not an
          // absolute clock — a daily client going quiet 5 days matters; a monthly
          // one doesn't). Needs 3+ events (2+ intervals) before a rhythm exists;
          // below that → "Calibrating". Verdict sharpens automatically as more
          // activity accumulates. Returns { state, label, color }.
          // Most-recent activity across all types — for the row subline.
          // "Last touch: today / yesterday / 3d ago / —" (— = no activity yet).
          const lastTouch = (c) => {
            let latest = 0;
            for (const t of (allTouchpoints || [])) {
              if ((t.client_id && t.client_id === c.id) || t.client_name === c.name) {
                if (t.occurred_at) latest = Math.max(latest, new Date(t.occurred_at).getTime());
              }
            }
            for (const cp of (allCompletions || [])) {
              if ((cp.client_id && cp.client_id === c.id) || cp.client_name === c.name) {
                if (cp.completed_at) latest = Math.max(latest, new Date(cp.completed_at).getTime());
              }
            }
            for (const e of (personalEvents || [])) {
              if (e.client_id && e.client_id === c.id && e.starts_at) {
                const ms = new Date(e.starts_at).getTime();
                if (ms <= Date.now()) latest = Math.max(latest, ms);
              }
            }
            if (!latest) return "—";
            const days = Math.floor((Date.now() - latest) / 86400000);
            if (days <= 0) return "today";
            if (days === 1) return "yesterday";
            if (days < 7) return `${days}d ago`;
            if (days < 30) return `${Math.floor(days / 7)}w ago`;
            if (days < 365) return `${Math.floor(days / 30)}mo ago`;
            return `${Math.floor(days / 365)}y ago`;
          };

          // Single shared cadence model (utils.computeCadence). Both this
          // table and the Health Drift Wall call it, so their verdicts can
          // never diverge again.
          const clientCadence = (c) => computeCadence(c, { allTouchpoints, allCompletions, personalEvents });

          // ─── v2 Primitives (local to Clients page) ─────────────────────────
          // Pearl score pill — the polished tint→white→tint gradient chip used
          // in the composer's client picker (ScoreChip). Brought to the Clients
          // list so health scores read as pearls here too. Same 5-tier ramp.
          const ScorePearl = ({ score, size = "sm" }) => {
            if (score == null) return null;
            const color = retColor(score);
            const tints = score >= 80 ? { tint: "#E6EFE9", border: "rgba(12,58,46,0.14)" }
                        : score >= 65 ? { tint: "#E8F3ED", border: "rgba(31,122,92,0.14)" }
                        : score >= 45 ? { tint: "#F3F0D8", border: "rgba(168,164,32,0.16)" }
                        : score >= 30 ? { tint: "#FDF4DC", border: "rgba(209,122,27,0.16)" }
                        :              { tint: "#FBE6DE", border: "rgba(180,52,31,0.16)" };
            const sizes = size === "sm" ? { fs: 12, pad: "3px 9px" } : { fs: 13, pad: "4px 11px" };
            return (
              <span style={{
                display: "inline-flex", alignItems: "center",
                background: `linear-gradient(135deg, ${tints.tint} 0%, #FFFFFF 45%, ${tints.tint} 100%)`,
                color,
                fontSize: sizes.fs, fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                padding: sizes.pad,
                borderRadius: 999,
                border: "1px solid " + tints.border,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 0 " + tints.border + ", 0 1px 2px rgba(20,30,22,0.05)",
              }}>{score}</span>
            );
          };
          const ScoreRing2 = ({ client, size = 38 }) => {
            const r = (size - 4) / 2;
            const circ = 2 * Math.PI * r;
            const score = client.ret || 60;
            const pct = Math.max(0, Math.min(1, score / 100));
            const color = retColor(score);
            const initials = (client.name || "?").split(/\s|&/).filter(Boolean).slice(0, 2).map(s => s[0]).join("").toUpperCase();
            return (
              <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
                <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
                  <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.borderLight} strokeWidth="2" />
                  <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"
                    strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} />
                </svg>
                <div style={{
                  position: "absolute", inset: 3, borderRadius: "50%",
                  background: retGradient(score), color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: size * 0.28, fontWeight: 700, letterSpacing: 0.2,
                }}>{initials}</div>
              </div>
            );
          };

          const V2Sparkline = ({ points, width = 72, height = 22, stroke, fill, showEnd = false, responsive = false }) => {
            if (!points || points.length === 0) return null;
            const min = Math.min(...points);
            const max = Math.max(...points);
            const range = max - min || 1;
            const pad = 1.5;
            const w = width - pad * 2;
            const h = height - pad * 2;
            const coords = points.map((p, i) => {
              const x = pad + (i / (points.length - 1)) * w;
              const y = pad + h - ((p - min) / range) * h;
              return [x, y];
            });
            const path = coords.map((c, i) => (i === 0 ? `M${c[0]},${c[1]}` : `L${c[0]},${c[1]}`)).join(" ");
            const area = `${path} L${coords[coords.length-1][0]},${pad+h} L${coords[0][0]},${pad+h} Z`;
            const last = coords[coords.length - 1];
            const first = points[0], lastV = points[points.length - 1];
            const dir = lastV > first ? "up" : lastV < first ? "dn" : "flat";
            const auto = dir === "up" ? C.retGood : dir === "dn" ? C.retWarn : C.textMuted;
            const sColor = stroke || auto;
            // Responsive mode: SVG fills its parent container width via CSS (100%).
            // viewBox is always set so internal coordinates remain stable. This is
            // used in the columns view where each card width depends on the
            // bucket column width and we don't want the sparkline overflowing.
            const svgWidth = responsive ? "100%" : width;
            const svgHeight = responsive ? "100%" : height;
            // Stable IDs per-instance via JSON of inputs — multiple
            // sparklines render on the same page so the gradient + filter
            // refs need unique IDs to avoid cross-contamination.
            const uid = `sp${Math.abs((sColor + points.join("")).split("").reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0))}`;
            // Lighter tone at line start, full sColor at line end — gives
            // the path a feeling of building from past to present.
            // Quick lighten: append "80" alpha hex for the start stop.
            const startStop = sColor + "80";
            return (
              <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>
                <defs>
                  <linearGradient id={uid + "-g"} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={startStop} />
                    <stop offset="100%" stopColor={sColor} />
                  </linearGradient>
                  <filter id={uid + "-glow"} x="-20%" y="-30%" width="140%" height="160%">
                    <feGaussianBlur stdDeviation="0.8" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                {fill && <path d={area} fill={`url(#${uid}-g)`} fillOpacity={0.10} />}
                <path d={path} fill="none" stroke={`url(#${uid}-g)`} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" filter={`url(#${uid}-glow)`} />
                {showEnd && <circle cx={last[0]} cy={last[1]} r={2} fill={sColor} />}
              </svg>
            );
          };

          // ─── Aggregates ────────────────────────────────────────────────────
          const activeClients = clients || [];
          const avgScore = activeClients.length ? Math.round(activeClients.reduce((a, c) => a + (c.ret || 0), 0) / activeClients.length) : 0;
          const totalMRR = activeClients.reduce((a, c) => a + (c.revenue || 0), 0);
          const byStage = {
            thriving: activeClients.filter(c => stubStage(c.ret || 0) === "thriving").length,
            healthy:  activeClients.filter(c => stubStage(c.ret || 0) === "healthy").length,
            watch:    activeClients.filter(c => stubStage(c.ret || 0) === "watch").length,
            atRisk:   activeClients.filter(c => stubStage(c.ret || 0) === "at-risk").length,
            critical: activeClients.filter(c => stubStage(c.ret || 0) === "critical").length,
          };
          // Drift counts for filter-chip badges. Missing drift_status defaults to "Stable".
          const byDrift = {
            Improving: activeClients.filter(c => (c.drift_status || "Stable") === "Improving").length,
            Stable:    activeClients.filter(c => (c.drift_status || "Stable") === "Stable").length,
            "Something shifted": activeClients.filter(c => (c.drift_status || "Stable") === "Something shifted").length,
            Declining: activeClients.filter(c => (c.drift_status || "Stable") === "Declining").length,
            "At risk": activeClients.filter(c => (c.drift_status || "Stable") === "At risk").length,
          };
          const longestClient = [...activeClients].sort((a, b) => (b.months || 0) - (a.months || 0))[0];

          // ─── Sort + filter ─────────────────────────────────────────────────
          const sortId = clientsSort || "retention";
          const filteredClients = (() => {
            let xs = activeClients;
            const q = (clientSearch || "").trim().toLowerCase();
            if (q) {
              xs = xs.filter(c =>
                (c.name || "").toLowerCase().includes(q) ||
                (c.contact || "").toLowerCase().includes(q) ||
                (c.tag || "").toLowerCase().includes(q)
              );
            }
            // Drift filter — exact match against c.drift_status. "all" passes everything.
            if (clientsDriftFilter !== "all") {
              xs = xs.filter(c => (c.drift_status || "Stable") === clientsDriftFilter);
            }
            // Score-bucket filter — bands match the Drift Wall thresholds.
            if (clientsScoreFilter !== "all") {
              xs = xs.filter(c => {
                const s = c.ret || 0;
                if (clientsScoreFilter === "thriving") return s >= 80;
                if (clientsScoreFilter === "healthy")  return s >= 65 && s < 80;
                if (clientsScoreFilter === "watch")    return s >= 45 && s < 65;
                if (clientsScoreFilter === "atrisk")   return s < 45;
                return true;
              });
            }
            const copy = [...xs];
            // Retention: highest score first (your healthiest clients at top).
            // Use "Attention" sort for inverse — who needs help most.
            if (sortId === "retention") copy.sort((a, b) => (b.ret || 0) - (a.ret || 0));
            else if (sortId === "attention") copy.sort((a, b) => (a.ret || 0) - (b.ret || 0));
            else if (sortId === "revenue") copy.sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
            else if (sortId === "cadence") {
              // Good → bad: Ahead first, then On rhythm, then Slipping.
              // Calibrating last (no rhythm yet to judge).
              const rank = { warming: 0, steady: 1, cooling: 2, calibrating: 3 };
              copy.sort((a, b) => (rank[clientCadence(a).state] ?? 3) - (rank[clientCadence(b).state] ?? 3));
            }
            else if (sortId === "renewal") copy.sort((a, b) => renewalInfo(a).days - renewalInfo(b).days);
            else if (sortId === "alpha") copy.sort((a, b) => a.name.localeCompare(b.name));
            return copy;
          })();

          const variant = clientsView || "table";
          const sortOptions = [
            { id: "retention",  label: "Retention" },
            { id: "revenue",    label: "Revenue" },
            { id: "cadence",    label: "Cadence" },
            { id: "renewal",    label: "Renewal" },
            { id: "alpha",      label: "A–Z" },
          ];
          const viewOptions = [
            { id: "table",   label: "Table",   icon: "sweeps" },
            { id: "columns", label: "Columns", icon: "bento" },
            { id: "heatmap", label: "Cards", icon: "heatmapGrid" },
          ];

          return (
            <div style={{ width: "100%" }}>
              {/* STATUS BAND */}
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "4px 4px 20px", marginBottom: 20, borderBottom: "1px solid " + C.borderLight }}>
                <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                  <div style={{ fontSize: 11.5, color: C.textMuted, letterSpacing: 0.3, marginBottom: 4 }}>Your portfolio</div>
                  <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: -0.4, color: C.text }}>Clients</h1>
                  <div style={{ fontSize: 13.5, color: C.textMuted, marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span><b style={{ color: C.text, fontWeight: 700 }}>{activeClients.length}</b> active</span>
                    {/* Cap gauge (Jul 2026): appears at 23 of 25 managed so the
                        wall is never a surprise. Team (agency) books never see it. */}
                    {(() => {
                      if (billing?.plan === "agency") return null;
                      const managed = clients.filter(cl => cl.is_active !== false && cl.rai_mode !== "advisory").length;
                      if (managed < 23) return null;
                      const full = managed >= 25;
                      return (
                        <>
                          <span className="rt-sep" />
                          <span style={{ fontSize: 12, fontWeight: 700, color: full ? "#B45309" : C.textMuted, background: full ? "#FDF3E3" : "transparent", border: full ? "1px solid #F0DCB8" : "none", borderRadius: 999, padding: full ? "2px 9px" : 0 }}>
                            {managed} of 25 managed
                          </span>
                        </>
                      );
                    })()}
                    <span className="rt-sep" />
                    <span><b style={{ color: C.text, fontWeight: 700 }}>${(totalMRR/1000).toFixed(1)}k</b> /mo</span>
                    <span className="rt-sep" />
                    <span><b style={{ color: retColor(avgScore), fontWeight: 700 }}>{avgScore}</b> avg</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button className="r-btn" data-tone="green" onClick={() => { setShowAddClient(true); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                    Add Client
                  </button>
                </div>
              </div>

              {/* MAIN GRID: rail + main (no third column — table data takes priority) */}
              <div className="rc-grid rc-grid-2col" style={{ display: "grid", gap: 20, alignItems: "start" }}>

                {/* LEFT RAIL — Portfolio, Book history, Recent movement (3 separate cards) */}
                <div className="rc-rail" style={{ position: "sticky", top: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* Card 1: Portfolio */}
                  <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: "var(--rt-sh-card)", padding: "14px" }}>
                    <div style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 10 }}>Portfolio</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                      <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
                        <svg width={64} height={64} style={{ transform: "rotate(-90deg)" }}>
                          <circle cx={32} cy={32} r={28} fill="none" stroke={C.borderLight} strokeWidth="3" />
                          <circle cx={32} cy={32} r={28} fill="none" stroke={retColor(avgScore)} strokeWidth="3" strokeLinecap="round"
                            strokeDasharray={2 * Math.PI * 28} strokeDashoffset={2 * Math.PI * 28 * (1 - avgScore / 100)} />
                        </svg>
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <div style={{ fontSize: 19, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums", letterSpacing: -0.3, lineHeight: 1 }}>{avgScore}</div>
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                          <span style={{ fontSize: 11.5, color: C.textMuted }}>Clients</span>
                          <span style={{ fontSize: 12, color: C.textSec, fontVariantNumeric: "tabular-nums" }}>{activeClients.length}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                          <span style={{ fontSize: 11.5, color: C.textMuted }}>MRR</span>
                          <span style={{ fontSize: 12, color: C.text, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>${(totalMRR/1000).toFixed(1)}k</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                          <span style={{ fontSize: 11.5, color: C.textMuted }}>Avg health</span>
                          <span style={{ fontSize: 12, color: retColor(avgScore), fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{avgScore}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", height: 4, borderRadius: 2, overflow: "hidden", gap: 1, marginBottom: 10 }} title={`Thriving ${byStage.thriving} · Healthy ${byStage.healthy} · Watch ${byStage.watch} · At risk ${byStage.atRisk} · Critical ${byStage.critical}`}>
                      {byStage.thriving > 0 && <div style={{ flex: byStage.thriving, background: C.retElite }} />}
                      {byStage.healthy > 0  && <div style={{ flex: byStage.healthy,  background: C.retGood }} />}
                      {byStage.watch > 0    && <div style={{ flex: byStage.watch,    background: C.retOk }} />}
                      {byStage.atRisk > 0   && <div style={{ flex: byStage.atRisk,   background: C.retWarn }} />}
                      {byStage.critical > 0 && <div style={{ flex: byStage.critical, background: C.retCrit }} />}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {[
                        { color: C.retElite, num: byStage.thriving, label: "Thriving" },
                        { color: C.retGood,  num: byStage.healthy,  label: "Healthy" },
                        { color: C.retOk,    num: byStage.watch,    label: "Watch" },
                        { color: C.retWarn,  num: byStage.atRisk,   label: "At risk" },
                        { color: C.retCrit,  num: byStage.critical, label: "Critical" },
                      ].map((s, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                          <span style={{ width: 6, height: 6, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums", minWidth: 16 }}>{s.num}</span>
                          <span style={{ fontSize: 11, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card 2: Book history */}
                  <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: "var(--rt-sh-card)", padding: "14px" }}>
                    <div style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 10 }}>Book history</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 19, fontWeight: 700, color: C.text, letterSpacing: -0.3, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                          ${(activeClients.reduce((a, c) => a + Number(c.ltv || 0), 0) / 1000000).toFixed(1)}M
                        </div>
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, letterSpacing: 0.1 }}>Lifetime rev</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 19, fontWeight: 700, color: C.text, letterSpacing: -0.3, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                          {activeClients.length ? (activeClients.reduce((a, c) => a + (c.months || 0), 0) / activeClients.length / 12).toFixed(1) : "0"} yr
                        </div>
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, letterSpacing: 0.1 }}>Avg tenure</div>
                      </div>
                    </div>
                    {longestClient && (
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6, paddingTop: 10, borderTop: "1px solid " + C.borderLight, fontSize: 11 }}>
                        <span style={{ color: C.textMuted }}>Longest</span>
                        <span style={{ color: C.text, fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{longestClient.name}</span>
                        <span style={{ color: C.textMuted, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{((longestClient.months || 0) / 12).toFixed(1)} yr</span>
                      </div>
                    )}
                  </div>

                  {/* Card 3: Recent movement — real cadence. Top = clients you're
                      most ahead of pace with; bottom = those slipping most vs
                      their own rhythm. Driven by clientCadence (real activity),
                      not the old name-hash stub. */}
                  {(() => {
                    // Rank clients with a real rhythm by how recently they've been
                    // touched relative to their own normal (cadence ratio). Lower
                    // ratio = more recently active. Always show top/bottom 3 — these
                    // are comparative ("most/least active lately"), not alarms, so
                    // we don't gate on the slipping threshold.
                    // Warmest/Coolest are just the extremes of the cadence
                    // momentum (this-week vs the client's own baseline). Higher
                    // momentum = getting more attention than usual = warmest.
                    const ranked = (activeClients || [])
                      .map(c => ({ c, cad: clientCadence(c) }))
                      .filter(x => x.cad.state !== "calibrating" && x.cad.state !== "na")
                      .sort((a, b) => b.cad.momentum - a.cad.momentum);
                    const mostActive = ranked.slice(0, 3);
                    const leastActive = ranked.slice(-3).reverse().filter(x => !mostActive.includes(x));
                    return (
                      <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: "var(--rt-sh-card)", padding: "14px" }}>
                        <div style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 10 }}>Recent movement</div>
                        {mostActive.length > 0 && (
                          <div style={{ marginBottom: leastActive.length > 0 ? 10 : 0 }}>
                            <div style={{ fontSize: 10.5, fontWeight: 700, color: C.retGood, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 6 }}>Warmest</div>
                            {mostActive.map(({ c }) => (
                              <div key={c.id} onClick={() => setSelectedClient(c)} style={{ display: "flex", alignItems: "center", gap: 9, padding: "3px 0", cursor: "pointer" }}>
                                <ScoreRing2 client={c} size={22} />
                                <span style={{ flex: 1, fontSize: 13, color: C.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {leastActive.length > 0 && (
                          <div>
                            <div style={{ fontSize: 10.5, fontWeight: 700, color: C.retWarn, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 6 }}>Coolest</div>
                            {leastActive.map(({ c }) => (
                              <div key={c.id} onClick={() => setSelectedClient(c)} style={{ display: "flex", alignItems: "center", gap: 9, padding: "3px 0", cursor: "pointer" }}>
                                <ScoreRing2 client={c} size={22} />
                                <span style={{ flex: 1, fontSize: 13, color: C.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {ranked.length === 0 && (
                          <div style={{ fontSize: 12, color: C.textMuted, fontStyle: "italic", padding: "4px 0" }}>Not enough activity yet.</div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* MAIN COLUMN */}
                <div style={{ minWidth: 0 }}>


            {showAddClient && (
              <div style={{ background: C.card, borderRadius: 14, border: "2px solid " + C.primary, padding: "20px", marginBottom: 16, boxShadow: "var(--rt-sh-card)" }}>
                {profileStep === 0 && (
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>New Client</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <input value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} placeholder="Company name" style={{ padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.surfaceWarm }} />
                      <input value={newClient.contact} onChange={e => setNewClient({...newClient, contact: e.target.value})} placeholder="Primary contact name" style={{ padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.surfaceWarm }} />
                      <input value={newClient.role} onChange={e => setNewClient({...newClient, role: e.target.value})} placeholder="Their role" style={{ padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.surfaceWarm }} />
                      <input value={newClient.tag} onChange={e => setNewClient({...newClient, tag: e.target.value})} placeholder="Industry (e.g. Fitness, Real Estate)" style={{ width: "100%", padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.surfaceWarm }} />
                      <div>
                        <input value={newClient.months} onChange={e => setNewClient({...newClient, months: e.target.value})} placeholder="Months working together" type="number" style={{ width: "100%", padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.surfaceWarm, boxSizing: "border-box" }} />
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, lineHeight: 1.4 }}>
                          Calibrates the engagement start. Tenure grows automatically from here — you won't need to update this.
                        </div>
                      </div>
                      <div>
                        <input value={newClient.revenue} onChange={e => setNewClient({...newClient, revenue: e.target.value})} placeholder="Current monthly rate ($)" type="number" style={{ width: "100%", padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.surfaceWarm, boxSizing: "border-box" }} />
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, lineHeight: 1.4 }}>
                          Your best estimate of monthly revenue. Changing this will not affect prior months.
                        </div>
                      </div>
                      <div>
                        <input value={newClient.lifetime_revenue_at_entry} onChange={e => setNewClient({...newClient, lifetime_revenue_at_entry: e.target.value})} placeholder="Lifetime revenue earned before today ($)" type="number" style={{ width: "100%", padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.surfaceWarm, boxSizing: "border-box" }} />
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, lineHeight: 1.4 }}>
                          Optional. Backfill what you earned from this client before Retayned tracked them. Skip this and Retayned will calculate LTV from today forward, using current rate × tenure.
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                      <button className="r-btn" data-tone="purple" onClick={() => { if (newClient.name && newClient.contact) setProfileStep(1); }} style={{ flex: 1, padding: "10px", background: newClient.name && newClient.contact ? C.btn : C.surface, color: newClient.name && newClient.contact ? "#fff" : C.textMuted, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: newClient.name && newClient.contact ? "pointer" : "default", fontFamily: "inherit" }}>Next: Relationship Profile</button>
                      <button onClick={() => { setShowAddClient(false); setProfileStep(0); setProfileScores({}); }} style={{ padding: "10px 14px", background: C.surface, color: C.textMuted, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                    </div>
                  </div>
                )}

                {profileStep >= 1 && profileStep <= 12 && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 800 }}>Relationship Profile</h3>
                      <span style={{ fontSize: 12, color: C.textMuted }}>{profileStep} of 12</span>
                    </div>
                    <div style={{ display: "flex", gap: 3, marginBottom: 14 }}>
                      {profileDimensions.map((_, i) => (
                        <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < profileStep ? C.primary : profileScores[profileDimensions[i].key] !== undefined ? C.primaryLight : C.borderLight }} />
                      ))}
                    </div>
                    {(() => {
                      const dim = profileDimensions[profileStep - 1];
                      const current = profileScores[dim.key];
                      return (
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{dim.name}</p>
                          <p style={{ fontSize: 12, color: C.textSec, marginBottom: 14 }}>{dim.desc}</p>
                          <div style={{ textAlign: "center", marginBottom: 8 }}>
                            <span style={{ fontSize: 32, fontWeight: 900, color: current !== undefined && current !== null ? C.primary : C.borderLight }}>{current !== undefined && current !== null ? current : "—"}</span>
                          </div>
                          <div style={{ padding: "0 4px", marginBottom: 6 }}>
                            <input type="range" min="0" max="10" value={current !== undefined && current !== null ? current : 5} onChange={e => setProfileScores({...profileScores, [dim.key]: parseInt(e.target.value)})} style={{ width: "100%", height: 6, appearance: "none", WebkitAppearance: "none", background: `linear-gradient(to right, ${C.border} 0%, ${C.primary} 100%)`, borderRadius: 3, outline: "none", cursor: "pointer" }} />
                            <style>{`input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 24px; height: 24px; border-radius: 50%; background: ${C.primary}; border: 3px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.2); cursor: pointer; } input[type="range"]::-moz-range-thumb { width: 24px; height: 24px; border-radius: 50%; background: ${C.primary}; border: 3px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.2); cursor: pointer; }`}</style>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.textMuted, marginBottom: 14 }}>
                            <span>{dim.left}</span><span>{dim.right}</span>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => setProfileStep(profileStep - 1)} style={{ padding: "8px 14px", background: C.surface, color: C.textSec, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Back</button>
                            <button className="r-btn" data-tone="purple" onClick={() => { if (current !== undefined && current !== null) { profileStep < 12 ? setProfileStep(profileStep + 1) : setProfileStep(13); } }} style={{ flex: 1, padding: "8px", background: current !== undefined && current !== null ? C.btn : C.surface, color: current !== undefined && current !== null ? "#fff" : C.textMuted, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: current !== undefined && current !== null ? "pointer" : "default", fontFamily: "inherit" }}>{profileStep < 12 ? "Next" : "Review"}</button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {profileStep === 13 && (
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Review</h3>
                    <div style={{ background: C.bg, borderRadius: 10, padding: "14px", marginBottom: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{newClient.name}</div>
                      <div style={{ fontSize: 12, color: C.textMuted }}>{newClient.contact} · {newClient.role}</div>
                      {newClient.tag && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{newClient.tag} · {newClient.months || 0}mo · ${parseInt(newClient.revenue || 0).toLocaleString()}/mo</div>}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Relationship Profile</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 14 }}>
                      {profileDimensions.map(d => (
                        <div key={d.key} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: C.bg, borderRadius: 6, fontSize: 12 }}>
                          <span style={{ color: C.textSec }}>{d.name}</span>
                          <span style={{ fontWeight: 700, color: C.primary }}>{profileScores[d.key]}</span>
                        </div>
                      ))}
                    </div>
                    {/* Score reveal (Jul 2026) — the number ARRIVES: 0 → score
                        with the ring drawing in sync, then Rai's one-line read
                        of the dimension shape. Replaces the static
                        "Starting Signal" line. */}
                    <div style={{ marginBottom: 14 }}>
                      <ScoreReveal
                        score={calcRetentionScore(profileScores, null) || 50}
                        dims={profileScores}
                        dimNames={Object.fromEntries(profileDimensions.map(d => [d.key, d.name]))}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setProfileStep(12)} style={{ padding: "10px 14px", background: C.surface, color: C.textSec, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Edit</button>
                      <button className="r-btn" data-tone="purple" onClick={submitNewClient} style={{ flex: 1, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Add Client</button>
                    </div>
                    <div style={{ fontSize: 10.5, color: C.textMuted, lineHeight: 1.45, marginTop: 10, textAlign: "center" }}>
                      By adding this client, you confirm you have the right to process their information for client management purposes.
                    </div>
                  </div>
                )}
              </div>
            )}


                  {/* Toolbar: search + sort + view toggle */}
                  <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: "var(--rt-sh-card)", padding: "10px 14px", marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Icon name="search" size={14} color={C.textMuted} />
                      <input value={clientSearch} onChange={e => setClientSearch(e.target.value)} placeholder="Search clients, owners, industries…" style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 14, padding: "2px 0", fontFamily: "inherit", color: C.text }} />
                      {clientSearch && <button className="rt-icon-close" onClick={() => setClientSearch("")} style={{ width: 22, height: 22, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted, background: "none", border: "none", cursor: "pointer" }}><Icon name="x" size={11} /></button>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, paddingTop: 10, borderTop: "1px solid " + C.borderLight, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", marginRight: 2 }}>Sort</span>
                        {sortOptions.map(s => (
                          <button key={s.id} onClick={() => setClientsSort(s.id)} className={"rt-composer-pill" + (sortId === s.id ? " is-filled" : "") + (s.id === "cadence" ? " rc-sort-cadence" : s.id === "renewal" ? " rc-sort-renewal" : "")} style={{
                            padding: "4px 10px", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit",
                            // Selected = unmistakable: soft-green fill + primary
                            // text, the same selected language the rest of the
                            // site uses. Hover state untouched.
                            ...(sortId === s.id
                              ? { background: C.primarySoft, color: C.text, fontWeight: 700 }
                              : { color: C.textSec, fontWeight: 500 }),
                          }}>{s.label}</button>
                        ))}
                      </div>
                      <div className="rc-view-toggle" style={{ display: "inline-flex", gap: 2, padding: 2, background: C.surface, borderRadius: 8 }}>
                        {viewOptions.map(v => (
                          <button key={v.id} onClick={() => setClientsView(v.id)} title={v.label} style={{
                            display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
                            border: "none", background: "transparent",
                            color: variant === v.id ? C.text : C.textSec,
                            transition: "background 160ms var(--rt-ease-out), box-shadow 160ms var(--rt-ease-out)",
                            ...(variant === v.id
                              ? { background: C.card, boxShadow: "var(--rt-sh-xs)" }
                              : {}),
                          }}>
                            <Icon name={v.icon} size={14} color={variant === v.id ? C.text : C.textMuted} />
                            <span style={{ fontSize: 12, fontWeight: variant === v.id ? 600 : 500 }}>{v.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Meta row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: C.textMuted, padding: "0 4px 10px", letterSpacing: 0.1 }}>
                    <span>{filteredClients.length} {filteredClients.length === 1 ? "client" : "clients"}</span>
                    <span style={{ flex: 1 }} />
                    <span>Sort: <b style={{ color: C.text, fontWeight: 500 }}>{sortOptions.find(s => s.id === sortId)?.label || "Retention"}</b></span>
                  </div>

                  {/* COMPARE SURFACE — 3 variants */}

                  {/* Mobile card list — always rendered, CSS reveals only <=768px */}
                  {dataLoaded && (
                  <div className="rc-mobile-list" style={{ display: "none", flexDirection: "column", background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: "var(--rt-sh-card)", overflow: "hidden" }}>
                    {filteredClients.map((c, i, arr) => {
                      const scoreColor = retColor(c.ret || 0);
                      const months = c.months || 0;
                      const tenureDisplay = months < 12 ? `${months}mo` : `${(months / 12).toFixed(1)}yr`;
                      return (
                        <div key={c.id} className="row-hover-neutral" onClick={() => { setSelectedClient(c); setRolodexConfirm(false); setRemoveConfirm(false); setPauseConfirm(false); setResumeConfirm(false); }} style={{ padding: "12px 14px", borderBottom: i < arr.length - 1 ? "1px solid " + C.borderLight : "none", cursor: "pointer" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <ScoreRing2 client={c} size={32} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: -0.1 }}>{c.name}</div>
                                {c.is_paused && (
                                  <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 6px", borderRadius: 4, color: C.textMuted, background: C.surfaceWarm, letterSpacing: 0.3, textTransform: "uppercase", flexShrink: 0 }}>Paused</span>
                                )}
                              </div>
                              <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                                {(() => { const cad = clientCadence(c); return <span style={{ width: 8, height: 8, borderRadius: "50%", background: cad.color, flexShrink: 0 }} title={cad.label} />; })()}
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(c.tag || "Client")} · ${((c.revenue || 0) / 1000).toFixed(1)}k/mo · {tenureDisplay}</span>
                              </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0, gap: 2 }}>
                              <div style={{ fontSize: 16, fontWeight: 700, color: scoreColor, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{c.ret || 0}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  )}

                  {dataLoaded && variant === "table" && (
                    <div className="rc-desktop-view" style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: "var(--rt-sh-card)", overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderBottom: "1px solid " + C.border, background: C.card }}>
                        <div style={{ width: 32, fontSize: 10.5, fontWeight: 700, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase" }} />
                        <div style={{ flex: 2, fontSize: 10.5, fontWeight: 700, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase" }}>Client</div>
                        <div style={{ width: 56, textAlign: "center", fontSize: 10.5, fontWeight: 700, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase" }}>Health</div>
                        <div style={{ width: 78, fontSize: 10.5, fontWeight: 700, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase" }}>Revenue</div>
                        <div style={{ width: 64, fontSize: 10.5, fontWeight: 700, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase" }}>Tenure</div>
                        <div className="rt-tcol-lcv" style={{ width: 74, fontSize: 10.5, fontWeight: 700, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase" }}>LCV</div>
                        <div className="rt-tcol-cadence" style={{ width: 80, fontSize: 10.5, fontWeight: 700, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase" }}>Cadence</div>
                        <div className="rt-tcol-renews" style={{ width: 64, textAlign: "right", fontSize: 10.5, fontWeight: 700, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase" }}>Renews</div>
                      </div>
                      <div>
                        {filteredClients.map((c, i, arr) => {
                          const renew = renewalInfo(c);
                          const renewStr = renew.str;
                          const renewUrgent = renew.urgent;
                          return (
                            <div key={c.id} className="row-hover-neutral" onClick={() => { setSelectedClient(c); setRolodexConfirm(false); setRemoveConfirm(false); setPauseConfirm(false); setResumeConfirm(false); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderBottom: i < arr.length - 1 ? "1px solid " + C.borderLight : "none", cursor: "pointer" }}>
                              <div style={{ width: 32, display: "flex", alignItems: "center", flexShrink: 0 }}>
                                <ScoreRing2 client={c} size={28} />
                              </div>
                              <div style={{ flex: 2, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <div style={{ fontSize: 13.5, fontWeight: 500, color: C.text, letterSpacing: -0.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                                  {amChipFor(c)}
                                  {c.is_paused && (
                                    <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 6px", borderRadius: 4, color: C.textMuted, background: C.surfaceWarm, letterSpacing: 0.3, textTransform: "uppercase", flexShrink: 0 }}>Paused</span>
                                  )}
                                </div>
                                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.tag || "Client"} · last touch {lastTouch(c)}</div>
                              </div>
                              <div style={{ width: 56, display: "flex", justifyContent: "center", alignItems: "center" }}>
                                <ScorePearl score={c.ret || 0} size="sm" />
                              </div>
                              <div style={{ width: 78 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontVariantNumeric: "tabular-nums" }}>${((c.revenue || 0) / 1000).toFixed(1)}k</div>
                                <div style={{ fontSize: 10.5, color: C.textMuted }}>/mo</div>
                              </div>
                              <div style={{ width: 64 }}>
                                {(() => {
                                  const months = c.months || 0;
                                  const display = months < 12 ? `${months} mo` : `${(months / 12).toFixed(1)} yr`;
                                  return <div style={{ fontSize: 13, fontWeight: 500, color: C.text, fontVariantNumeric: "tabular-nums" }}>{display}</div>;
                                })()}
                              </div>
                              <div className="rt-tcol-lcv" style={{ width: 74 }}>
                                {(() => {
                                  // Read honest LTV computed at hydration time from the
                                  // revenue history table + lifetime_revenue_at_entry.
                                  // OLD math (c.revenue × c.months) is wrong after rate
                                  // changes — it pretends the current rate has always been
                                  // the rate. The helper text under the rate field promises
                                  // "changing this will not affect prior months", and that
                                  // promise lives in c.ltv.
                                  const lcv = Number(c.ltv || 0);
                                  const display = lcv >= 1000000 ? `$${(lcv / 1000000).toFixed(1)}M` : lcv >= 1000 ? `$${Math.round(lcv / 1000)}k` : `$${Math.round(lcv)}`;
                                  return <div style={{ fontSize: 13, fontWeight: 500, color: C.text, fontVariantNumeric: "tabular-nums" }}>{display}</div>;
                                })()}
                              </div>
                              <div className="rt-tcol-cadence" style={{ width: 80 }}>
                                {(() => {
                                  const cad = clientCadence(c);
                                  return (
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: cad.color, flexShrink: 0 }} />
                                      <span style={{ fontSize: 11.5, fontWeight: 600, color: cad.color === C.textMuted ? C.textMuted : C.textSec, whiteSpace: "nowrap", fontStyle: cad.state === "calibrating" ? "italic" : "normal" }}>{cad.label}</span>
                                      {debugScores && <span style={{ fontSize: 9, color: C.btn, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>m{(cad.momentum ?? 1).toFixed(2)}</span>}
                                    </div>
                                  );
                                })()}
                              </div>
                              <div className="rt-tcol-renews" style={{ width: 64, textAlign: "right" }}>
                                <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums", color: renewUrgent ? C.retWarn : C.textSec, fontWeight: renewUrgent ? 700 : 500 }}>{renewStr}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {dataLoaded && variant === "columns" && (
                    /* Columns view — five retention-stage buckets side-by-side.
                       The buckets are the whole point of this view (Thriving →
                       Healthy → Watch → At risk → Critical), so we don't let
                       them collapse or wrap; instead the grid scrolls horizontally
                       once the viewport is too narrow to show all 5 at the
                       minmax min-width. Each column has overflow:hidden so card
                       contents (especially the sparkline) can't bleed into
                       neighbouring buckets. */
                    <div style={{ overflowX: "auto", overflowY: "hidden", paddingBottom: 4 }}>
                      <div className="rc-desktop-view" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(240px, 1fr))", gap: 10, alignItems: "flex-start" }}>
                        {[
                          { id: "thriving", label: "Thriving",  color: C.retElite, bg: "#E5EDE7" },
                          { id: "healthy",  label: "Healthy",   color: C.retGood,  bg: "#EFF5F1" },
                          { id: "watch",    label: "Watch",     color: C.retOk,    bg: "#F6F4E5" },
                          { id: "at-risk",  label: "At risk",   color: C.retWarn,  bg: "#F9EEE0" },
                          { id: "critical", label: "Critical",  color: C.retCrit,  bg: "#F5E4E0" },
                        ].map(s => {
                          const col = filteredClients.filter(c => stubStage(c.ret || 0) === s.id);
                          const mrr = col.reduce((a, c) => a + (c.revenue || 0), 0);
                          return (
                            <div key={s.id} style={{ background: s.bg, border: "1px solid " + s.color + "22", borderRadius: 12, padding: 10, display: "flex", flexDirection: "column", gap: 8, minHeight: 200, minWidth: 0, overflow: "hidden" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 6px 8px", borderBottom: "1px solid " + C.borderLight, gap: 8, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                                  <span style={{ width: 8, height: 8, borderRadius: 4, background: s.color, flexShrink: 0 }} />
                                  <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text, letterSpacing: -0.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</span>
                                  <span style={{ fontSize: 11, color: C.textMuted, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{col.length}</span>
                                </div>
                                <div style={{ fontSize: 11, color: C.textMuted, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>${(mrr/1000).toFixed(1)}k</div>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                                {col.map(c => {
                                  return (
                                    <div key={c.id} className="rt-row" onClick={() => setSelectedClient(c)} style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8, cursor: "pointer", minWidth: 0, overflow: "hidden" }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                                        <ScoreRing2 client={c} size={32} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                                            <div style={{ fontSize: 13, fontWeight: 500, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: -0.1, minWidth: 0 }}>{c.name}</div>
                                            {amChipFor(c)}
                                          </div>
                                          <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.tag || "Client"}{c.renewal_date ? ` · renews ${renewalInfo(c).str}` : ""}</div>
                                        </div>
                                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                                          <div style={{ fontSize: 12.5, fontWeight: 700, color: retColor(c.ret || 0), fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                                            {c.ret || 0}
                                          </div>
                                        </div>
                                      </div>
                                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                                        {(() => { const cad = clientCadence(c); return (
                                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: cad.color, flexShrink: 0 }} />
                                            <span style={{ fontSize: 10.5, fontWeight: 600, color: C.textSec, whiteSpace: "nowrap", fontStyle: cad.state === "calibrating" ? "italic" : "normal" }}>{cad.label}</span>
                                          </div>
                                        ); })()}
                                      </div>
                                      <div style={{ background: C.bg, borderRadius: 6, padding: "5px 8px", minWidth: 0 }}>
                                        <span style={{ fontSize: 11.5, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums" }}>${((c.revenue || 0)/1000).toFixed(1)}k</span>
                                        <span style={{ fontSize: 10.5, color: C.textMuted, marginLeft: 3 }}>/mo</span>
                                      </div>
                                    </div>
                                  );
                                })}
                                {col.length === 0 && (
                                  <div style={{ fontSize: 12, color: C.textMuted, textAlign: "center", padding: "20px 0", fontStyle: "italic" }}>No clients</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {dataLoaded && variant === "heatmap" && (
                    <div className="rc-desktop-view" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
                      {filteredClients.map(c => {
                        const scoreColor = retColor(c.ret || 0);
                        const renew = renewalInfo(c);
                        const renewUrgent = renew.urgent;
                        return (
                          <div key={c.id} className="rt-row" onClick={() => setSelectedClient(c)} style={{ position: "relative", background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: "var(--rt-sh-card)", padding: 12, paddingLeft: 14, overflow: "hidden", cursor: "pointer" }}>
                            <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 3, background: scoreColor }} />
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                              <ScoreRing2 client={c} size={34} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                                  <div style={{ fontSize: 13.5, fontWeight: 500, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: -0.1, minWidth: 0 }}>{c.name}</div>
                                  {amChipFor(c)}
                                </div>
                                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{c.tag || "Client"}</div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 15, fontWeight: 700, color: scoreColor, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{c.ret || 0}</div>
                              </div>
                            </div>
                            <div style={{ background: C.primaryGhost, borderRadius: 6, padding: "6px 8px", marginBottom: 10 }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums" }}>${((c.revenue || 0)/1000).toFixed(1)}k<span style={{ fontWeight: 400, fontSize: 10.5, color: C.textMuted }}>/mo</span></span>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, auto)", gap: 10, alignItems: "center" }}>
                              <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
                                {(() => { const cad = clientCadence(c); return (
                                  <>
                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: cad.color, flexShrink: 0 }} />
                                    <span style={{ fontSize: 10.5, fontWeight: 600, color: C.textSec, marginLeft: 5, whiteSpace: "nowrap", fontStyle: cad.state === "calibrating" ? "italic" : "normal" }}>{cad.label}</span>
                                  </>
                                ); })()}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", minWidth: 0, justifyContent: "flex-end" }}>
                                <Icon name="clock" size={10} color={renewUrgent ? C.retWarn : C.textMuted} />
                                <span style={{ fontSize: 11, color: renewUrgent ? C.retWarn : C.textMuted, fontWeight: renewUrgent ? 700 : 500, marginLeft: 4, fontVariantNumeric: "tabular-nums" }}>{renew.str}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {dataLoaded && filteredClients.length === 0 && activeClients.length === 0 && (
                    <EmptyState
                      icon="clients"
                      headline="Your client book starts here."
                      body="Add the people you work with and Retayned starts reading the room — drift, cadence, who needs a check-in. Most users add 10 to start."
                      cta={{ label: "Add Client", onClick: () => { setShowAddClient(true); } }}
                    />
                  )}

                  {dataLoaded && filteredClients.length === 0 && activeClients.length > 0 && (
                    <div style={{ textAlign: "center", padding: "40px 20px", background: C.card, border: "1px solid " + C.border, borderRadius: 12 }}>
                      <div style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 6 }}>
                        No clients match {clientSearch ? `"${clientSearch}"` : "your filters"}.
                      </div>
                      <div style={{ fontSize: 14, color: C.textSec }}>
                        Check the spelling, or{" "}
                        <span
                          onClick={() => setClientSearch("")}
                          className="rt-purple-link"
                          style={{ cursor: "pointer", paddingBottom: 1 }}
                        >clear the search</span>
                        {" "}to see your full list.
                      </div>
                    </div>
                  )}
                </div>

                {/* No right rail on Clients page — table data takes priority */}
              </div>
            </div>
          );
        
}
