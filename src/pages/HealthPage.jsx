// AUTO-EXTRACTED from App.jsx (page === "health" block) — body is
// verbatim; only the surrounding component shell + imports are generated.
import { healthChecks as hcDb, observations as observationsDb } from "../lib/db";
import { Icon } from "../components/Icon";
import { EmptyState } from "../components/Skeletons";
import { lookupObservationIllustration } from "../observations";
import { C } from "../theme";
import { retColor, retGradient, computeCadence } from "../utils";

import { ScoreFirstCard } from "../components/Onboarding";
import { useEffect, useRef } from "react";

export default function HealthPage({ app }) {
  const {
    allCompletions,
    allTouchpoints,
    clientDrift,
    clients,
    dataLoaded,
    goTo,
    hcDone,
    hcOpen,
    hcQueue,
    healthStripOpen,
    isMobile,
    obsDismissing,
    obsMobileExpanded,
    observation,
    personalEvents,
    reviewQueueMoreOpen,
    setAiMessages,
    setHcDone,
    setHcOpen,
    setHealthStripOpen,
    setObsDismissing,
    setObsMobileExpanded,
    setObservation,
    setObservationContext,
    setPage,
    setReviewQueueMoreOpen,
    setSelectedClient,
    user,
  } = app;

  // Default-open the top of the queue when the Health page loads. hcOpen is
  // reset to null on navigation away (App.jsx), so this fires once per visit
  // and won't fight the user: the ref guards against re-firing if they close
  // the card. Computed from hcQueue directly (activeQueue is built later in
  // the render body, out of scope here) using the same runnable+sort rule.
  const _autoOpenedRef = useRef(false);
  useEffect(() => {
    if (_autoOpenedRef.current) return;
    if (hcOpen) { _autoOpenedRef.current = true; return; }
    const top = (hcQueue || [])
      .filter(h => h.runnable && !hcDone[h.client])
      .sort((a, b) => {
        if (a.overdue !== b.overdue) return b.overdue - a.overdue;
        if (a.due === "Today" && b.due !== "Today") return -1;
        if (b.due === "Today" && a.due !== "Today") return 1;
        return a.daysUntil - b.daysUntil;
      })[0];
    if (top) { setHcOpen(top.client); _autoOpenedRef.current = true; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hcQueue, hcDone]);

          // ─── Observer card renderer ───
          // Rendered TWICE in the JSX below: once above the mobile calendar
          // widget (rt-mob-strip), once inside the desktop rc-grid main column.
          // The two callsites are mutually exclusive via the isMobile flag, so
          // only one instance ever renders at a time. Returns null when there's
          // no current observation or one is being dismissed.
          const obsCaption = (
            <div style={{ fontSize: 10.5, color: C.textMuted, letterSpacing: 0.3, margin: "6px 2px 12px" }}>
              Re-reads your week every Friday night.
            </div>
          );
          // Friday-regeneration framing (Jul 2026): the observer card is
          // the weekly ritual - say so. Young accounts with no card yet get
          // a ghost promise line, same forward-promise mechanic as Rai's
          // night card. The caption itself renders inside the card below.
          const renderObserver = () => {
            if (!observation || obsDismissing) {
              const young = !!(user?.created_at && (Date.now() - new Date(user.created_at).getTime()) < 14 * 86400000);
              if (!young || obsDismissing) return null;
              return (
                <div style={{ padding: "18px 16px", border: "1px dashed " + C.borderLight, borderRadius: 12, marginBottom: 12, textAlign: "center" }}>
                  <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontStyle: "italic", fontWeight: 500, fontVariationSettings: "'opsz' 96, 'SOFT' 50, 'WONK' 0", fontSize: 13.5, color: C.textMuted, lineHeight: 1.5 }}>
                    First weekly read lands Friday night.
                  </div>
                </div>
              );
            }
                    const obs = observation;
                    const rawName = obs.card_name || "Observation";
                    const archetype = /^the\s/i.test(rawName) ? rawName : `The ${rawName}`;

                    // Top-bar metadata: № (observation number) / WK (ISO week) / DATE
                    const firedAt = new Date(obs.fired_at);
                    const obsNum = String(obs.observation_number || "").padStart(2, "0");
                    const weekNum = (() => {
                      // ISO week number
                      const d = new Date(Date.UTC(firedAt.getFullYear(), firedAt.getMonth(), firedAt.getDate()));
                      const dayNum = d.getUTCDay() || 7;
                      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
                      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
                      return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
                    })();
                    const firedDate = firedAt.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }).replace(/\//g, '.');

                    // Illustration asset for this observation. Lookup by
                    // card_name through a normalizer so casing/punctuation
                    // variants resolve correctly. null if unmapped → card
                    // renders without illo and content flows full-width.
                    const illoSrc = lookupObservationIllustration(obs.card_name);

                    // ─── Action handlers ───
                    const handleDrop = async () => {
                      setObsDismissing(true);
                      setTimeout(() => setObservation(null), 280);
                      try { await observationsDb.updateStatus(obs.id, "dropped"); } catch (e) { /* non-blocking */ }
                    };
                    const handleUnpack = async () => {
                      try { await observationsDb.updateStatus(obs.id, "unpacked"); } catch (e) { /* non-blocking */ }
                      setObservation(prev => prev ? { ...prev, status: "unpacked" } : prev);
                      const seededMessage = `You pulled ${archetype}. ${obs.front_headline}\n\nWhere do you want to start?`;
                      // Stash the observation context so follow-up turns ("how should
                      // I proceed?") are answered against the actual finding, not blind.
                      let payloadStr = "";
                      try { payloadStr = obs.data_payload ? JSON.stringify(obs.data_payload) : ""; } catch (e) { payloadStr = ""; }
                      const ctx = `The user just opened this observation from their dashboard and wants to discuss it. Observation: "${archetype}". Headline: ${obs.front_headline || ""}. ${obs.front_body ? "Detail: " + obs.front_body + "." : ""} ${payloadStr ? "Supporting data: " + payloadStr : ""} Treat the user's next messages (e.g. "how should I proceed?") as referring to THIS observation. Use the specific clients and numbers above; do not ask them to re-explain what it is.`;
                      setObservationContext(ctx);
                      setAiMessages([{ role: "ai", text: seededMessage }]);
                      setPage("coach");
                    };

                    // ─── Metric strip: per-detector label mapping ───
                    // Each detector outputs different metric keys. We translate them
                    // into short, readable labels for display.
                    const METRIC_LABELS = {
                      // Counts & generic
                      count: "Clients",
                      book_size: "Book size",
                      // Frequency / depth
                      avg_touch_30d: "Avg / 30d",
                      avg_touch_60d: "Avg / 60d",
                      median_touch_30d: "Book median",
                      expected_touch: "Expected",
                      // Anniversaries
                      nearest_days: "Days out",
                      farthest_days: "Latest",
                      avg_years: "Avg years",
                      days_window: "Window",
                      count_anniv: "Anniversaries",
                      count_stale_rate: "Stale rates",
                      // Tenure
                      avg_tenure_yrs: "Avg tenure",
                      long_tenure_pct: "Long tenure",
                      year_two_count: "Year two",
                      // Score
                      avg_score: "Avg score",
                      avg_drop: "Avg drop",
                      max_drop: "Max drop",
                      avg_score_drop: "Score drop",
                      // Health checks
                      never_had: "No HC ever",
                      avg_days_since_hc: "Days since HC",
                      // Expectations
                      avg_expectations: "Avg score",
                      // Effort
                      effort_multiple: "Effort",
                      revenue_gap_pct: "Revenue gap",
                      task_pct: "Task share",
                      revenue_pct: "Revenue share",
                      top_pct: "Top share",
                      // Rates
                      avg_rate_age_days: "Rate age",
                      gap_pct: "Rate gap",
                      median: "Book median",
                      max: "Top rate",
                      drop_pct: "Drop",
                      // Referrals
                      avg_referrals_made: "Avg referrals",
                      days_since_last: "Days since",
                      // Cadence / drift census
                      touched: "Touched",
                      silent: "Silent",
                      Stable: "Stable",
                      Improving: "Improving",
                      "Something shifted": "Shifted",
                      Declining: "Declining",
                      "At risk": "At risk",
                      // Self-cluster
                      patterns_count: "Patterns",
                      affected_pct: "Affected",
                    };

                    const formatMetricValue = (key, val) => {
                      if (val == null) return "—";
                      // Percentages
                      if (key.endsWith("_pct") || key === "long_tenure_pct" || key === "affected_pct") {
                        return `${val}%`;
                      }
                      // Day counts
                      if (key.endsWith("_days") || key === "days_window") {
                        return `${val}d`;
                      }
                      // Year counts
                      if (key.endsWith("_yrs") || key === "avg_years") {
                        return `${val}yr`;
                      }
                      // Effort multiples
                      if (key === "effort_multiple") {
                        return `${val}x`;
                      }
                      // Score drops — show as negative
                      if (key.includes("drop") && typeof val === "number" && val > 0) {
                        return `−${val}`;
                      }
                      return String(val);
                    };

                    const metrics = (obs.data_payload && obs.data_payload.metrics) || {};
                    const metricEntries = Object.entries(metrics)
                      .filter(([k, v]) => v != null && v !== 0 || (k === "count" && v != null))  // hide zero-value noise except count
                      .slice(0, 4);  // cap at 4 metrics in the strip

                    return (
                      <div
                        style={{
                          marginBottom: 24,
                          opacity: obsDismissing ? 0 : 1,
                          transform: obsDismissing ? "scale(0.97)" : "scale(1)",
                          transition: "opacity 280ms ease, transform 280ms ease",
                          borderRadius: 14,
                        }}
                      >
                        {/* ═══════════════════════════════════════════
                            OBSERVER CARD — desktop and mobile layouts
                            ═══════════════════════════════════════════
                            Two separate JSX trees, picked by `isMobile`.
                            Each owns its own layout end-to-end. No
                            !important wars. No responsive class fights.
                            Shared closure scope: archetype, illoSrc,
                            obsNum, weekNum, firedDate, handleUnpack,
                            handleDrop, metricEntries, METRIC_LABELS,
                            formatMetricValue, obsMobileExpanded,
                            setObsMobileExpanded. */}
                        {isMobile ? (
                          /* ─── MOBILE LAYOUT — V1 spec ───
                             Compact card. Topbar pairs the archetype name
                             with a small (60×50) illo. Corner ✕ replaces
                             the inline Dismiss button. Headline only, by
                             default. Body + metadata + metric strip live
                             behind a "More" tap. Action row uses text
                             links (no harsh button background). */
                          <div style={{
                            background: C.primarySoft,
                            color: C.text,
                            borderRadius: 14,
                            padding: "16px 18px",
                            position: "relative",
                            overflow: "hidden",
                            border: "1px solid rgba(51,84,62,0.22)",
                            boxShadow: "0 2px 0 -1px rgba(51,84,62,0.06), 0 4px 12px rgba(20,30,22,0.05)",
                          }}>
                            {/* Corner ✕ dismiss — top-right notification pattern */}
                            <button
                              type="button"
                              onClick={handleDrop}
                              aria-label="Dismiss observation"
                              style={{
                                position: "absolute",
                                top: 10, right: 10,
                                width: 28, height: 28,
                                borderRadius: 14,
                                background: "transparent",
                                border: "none",
                                color: C.textMuted,
                                fontSize: 16,
                                lineHeight: 1,
                                cursor: "pointer",
                                fontFamily: "inherit",
                                padding: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                zIndex: 2,
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = "rgba(28,50,36,0.06)"; e.currentTarget.style.color = C.text; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textMuted; }}
                            >
                              ✕
                            </button>

                            {/* TOPBAR — dot + name + illo (right side, with margin to clear ✕) */}
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                              <div style={{ width: 6, height: 6, borderRadius: 999, background: C.btn, flexShrink: 0 }} />
                              <div style={{
                                fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                                fontSize: 10,
                                fontWeight: 700,
                                letterSpacing: "0.16em",
                                textTransform: "uppercase",
                                color: C.text,
                                flex: 1,
                              }}>
                                {archetype}
                              </div>
                              {illoSrc && (
                                <img
                                  src={illoSrc}
                                  alt=""
                                  aria-hidden="true"
                                  style={{
                                    width: 60, height: 50,
                                    flexShrink: 0,
                                    pointerEvents: "none",
                                    opacity: 0.9,
                                    objectFit: "contain",
                                    marginRight: 32,
                                  }}
                                />
                              )}
                            </div>

                            {/* HEADLINE — always visible. padding-right clears the corner ✕ */}
                            <h3 style={{
                              fontFamily: "'Fraunces', Georgia, serif",
                              fontVariationSettings: '"opsz" 96, "SOFT" 50, "WONK" 0',
                              fontWeight: 500,
                              fontStyle: "italic",
                              fontSize: 19,
                              lineHeight: 1.25,
                              letterSpacing: "-0.005em",
                              color: C.text,
                              margin: "0 0 14px",
                              paddingRight: 28,
                            }}>
                              {obs.front_headline}
                            </h3>

                            {/* EXPANDABLE — meta + body + metric strip, shown after "More" tap */}
                            {obsMobileExpanded && (
                              <>
                                <div style={{
                                  fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                                  fontSize: 10.5,
                                  letterSpacing: "0.14em",
                                  color: C.textMuted,
                                  marginBottom: 12,
                                }}>
                                  № {obsNum}&nbsp;&nbsp;/&nbsp;&nbsp;WK {weekNum}&nbsp;&nbsp;/&nbsp;&nbsp;{firedDate}
                                </div>
                                <p style={{
                                  fontSize: 13.5,
                                  lineHeight: 1.55,
                                  color: C.textSec,
                                  margin: "0 0 16px",
                                }}>
                                  {obs.front_body}
                                </p>
                                {metricEntries.length > 0 && (
                                  <div style={{ display: "flex", gap: 22, marginBottom: 16, flexWrap: "wrap" }}>
                                    {metricEntries.map(([key, val]) => (
                                      <div key={key}>
                                        <div style={{
                                          fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                                          fontSize: 16,
                                          fontWeight: 600,
                                          color: C.text,
                                          lineHeight: 1,
                                        }}>
                                          {formatMetricValue(key, val)}
                                        </div>
                                        <div style={{
                                          fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                                          fontSize: 9,
                                          fontWeight: 700,
                                          letterSpacing: "0.16em",
                                          textTransform: "uppercase",
                                          color: C.textMuted,
                                          marginTop: 4,
                                        }}>
                                          {METRIC_LABELS[key] || key.replace(/_/g, " ")}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}

                            {/* ACTIONS — text links, no button background */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <button
                                type="button"
                                onClick={() => setObsMobileExpanded(v => !v)}
                                style={{
                                  background: "transparent",
                                  color: C.textMuted,
                                  border: "none",
                                  padding: "8px 0",
                                  fontSize: 12.5,
                                  fontWeight: 500,
                                  cursor: "pointer",
                                  fontFamily: "inherit",
                                }}
                              >
                                {obsMobileExpanded ? "Less" : "More"}
                              </button>
                              <button
                                type="button"
                                onClick={handleUnpack}
                                style={{
                                  background: "transparent",
                                  color: C.btn,
                                  border: "none",
                                  padding: "8px 0",
                                  fontSize: 13,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  fontFamily: "inherit",
                                }}
                              >
                                Unpack with Rai
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* ─── DESKTOP LAYOUT ───
                             Full editorial card. Topbar with archetype name,
                             rule, and full № WK DATE metadata. 200×165 illo
                             absolutely positioned to top-right corner.
                             Body always visible. Metric strip + actions row
                             at the bottom. "Unpack with Rai" as purple text
                             link (no button background) + "Dismiss" muted. */
                          <div style={{
                            background: C.primarySoft,
                            color: C.text,
                            borderRadius: 14,
                            padding: "24px 28px 22px",
                            position: "relative",
                            overflow: "hidden",
                            border: "1px solid rgba(51,84,62,0.22)",
                            boxShadow: "0 2px 0 -1px rgba(51,84,62,0.06), 0 4px 12px rgba(20,30,22,0.05)",
                          }}>
                            {/* Illustration — absolute corner placement */}
                            {illoSrc && (
                              <img
                                src={illoSrc}
                                alt=""
                                aria-hidden="true"
                                style={{
                                  position: "absolute",
                                  top: 28, right: 36,
                                  width: 200, height: 165,
                                  pointerEvents: "none",
                                  opacity: 0.9,
                                  objectFit: "contain",
                                }}
                              />
                            )}

                            {/* Content column — padding-right reserves space for the corner illo */}
                            <div style={{ paddingRight: illoSrc ? 220 : 0 }}>
                              {/* TOPBAR — dot + name + rule + metadata */}
                              <div style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                                paddingBottom: 14,
                                borderBottom: "1px dashed " + C.borderLight,
                                marginBottom: 18,
                              }}>
                                <div style={{ width: 8, height: 8, borderRadius: 999, background: C.btn, flexShrink: 0 }} />
                                <div style={{
                                  fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  letterSpacing: "0.18em",
                                  textTransform: "uppercase",
                                  color: C.text,
                                }}>
                                  {archetype}
                                </div>
                                <div style={{ flex: 1, height: 1, background: C.borderLight }} />
                                <div style={{
                                  fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                                  fontSize: 11,
                                  letterSpacing: "0.14em",
                                  color: C.textMuted,
                                  whiteSpace: "nowrap",
                                }}>
                                  № {obsNum}&nbsp;&nbsp;/&nbsp;&nbsp;WK {weekNum}&nbsp;&nbsp;/&nbsp;&nbsp;{firedDate}
                                </div>
                              </div>

                              {/* HEADLINE */}
                              <h3 style={{
                                fontFamily: "'Fraunces', Georgia, serif",
                                fontVariationSettings: '"opsz" 96, "SOFT" 50, "WONK" 0',
                                fontWeight: 500,
                                fontStyle: "italic",
                                fontSize: 25,
                                lineHeight: 1.22,
                                letterSpacing: "-0.005em",
                                color: C.text,
                                margin: "0 0 12px",
                              }}>
                                {obs.front_headline}
                              </h3>

                              {/* BODY */}
                              <p style={{
                                fontSize: 13.5,
                                lineHeight: 1.55,
                                color: C.textSec,
                                margin: "0 0 22px",
                              }}>
                                {obs.front_body}
                              </p>
                            </div>

                            {/* ACTIONS ROW — metrics on left, links on right */}
                            <div style={{
                              paddingTop: 16,
                              borderTop: "1px solid " + C.borderLight,
                              display: "flex",
                              alignItems: "center",
                              gap: 24,
                            }}>
                              {/* Metric strip */}
                              <div style={{ display: "flex", gap: 28 }}>
                                {metricEntries.map(([key, val]) => (
                                  <div key={key}>
                                    <div style={{
                                      fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                                      fontSize: 18,
                                      fontWeight: 600,
                                      color: C.text,
                                      lineHeight: 1,
                                    }}>
                                      {formatMetricValue(key, val)}
                                    </div>
                                    <div style={{
                                      fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                                      fontSize: 9.5,
                                      fontWeight: 700,
                                      letterSpacing: "0.18em",
                                      textTransform: "uppercase",
                                      color: C.textMuted,
                                      marginTop: 5,
                                    }}>
                                      {METRIC_LABELS[key] || key.replace(/_/g, " ")}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <div style={{ flex: 1 }} />

                              {/* Unpack as purple text link (no button background) */}
                              <button
                                type="button"
                                onClick={handleUnpack}
                                style={{
                                  background: "transparent",
                                  color: C.btn,
                                  border: "none",
                                  padding: "8px 4px",
                                  fontSize: 13,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  fontFamily: "inherit",
                                }}
                              >
                                Unpack with Rai
                              </button>
                              {/* Dismiss as muted text link */}
                              <button
                                type="button"
                                onClick={handleDrop}
                                style={{
                                  background: "transparent",
                                  color: C.textMuted,
                                  border: "none",
                                  padding: "8px 4px",
                                  fontSize: 13,
                                  fontWeight: 500,
                                  cursor: "pointer",
                                  fontFamily: "inherit",
                                }}
                                onMouseEnter={e => e.currentTarget.style.color = C.text}
                                onMouseLeave={e => e.currentTarget.style.color = C.textMuted}
                              >
                                Dismiss
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
          };

          // Drift wall uses a 4-tier label set (Thriving / Stable / Shifted / Declining).
          // calcDrift() returns 5 states; merge "At risk" into "Declining" and "Improving"
          // into "Thriving" for plot + pill purposes.
          const toDriftTier = (d) => {
            if (!d) return "Stable";
            if (d === "Improving") return "Thriving";
            if (d === "Stable") return "Stable";
            if (d === "Something shifted") return "Shifted";
            if (d === "Declining" || d === "At risk") return "Declining";
            return "Stable";
          };
          const driftTierColor = (t) => t === "Thriving" ? C.retElite : t === "Stable" ? C.retGood : t === "Shifted" ? C.retWarn : C.retCrit;
          // Stubbed one-liner per drift tier (wired to real note field post-launch)
          const driftStub = (t) => t === "Thriving" ? "Relationship trending up." : t === "Stable" ? "Steady. Nothing to flag." : t === "Shifted" ? "Something worth watching." : "Signals are declining.";

          // Active = runnable NOW: overdue, due today, OR a first HC (Start Early-eligible)
          const activeQueue = hcQueue.filter(h => h.runnable && !hcDone[h.client]).sort((a, b) => {
            // Overdue first, then due today, then first-HCs (Start Early) sorted by soonest due
            if (a.overdue !== b.overdue) return b.overdue - a.overdue;
            if (a.due === "Today" && b.due !== "Today") return -1;
            if (b.due === "Today" && a.due !== "Today") return 1;
            return a.daysUntil - b.daysUntil;
          });
          const justCompleted = hcQueue.filter(h => h.runnable && hcDone[h.client]);

          const totalClients = clients.length;
          const checkedThisMonth = hcQueue.filter(h => hcDone[h.client]).length;
          const pctChecked = totalClients > 0 ? Math.round((checkedThisMonth / totalClients) * 100) : 0;
          const now = new Date();
          const monthLabel = now.toLocaleString("en-US", { month: "long", year: "numeric" });

          // ─── Drift Wall — real cadence ───────────────────────────────────
          // Single shared cadence model (utils.computeCadence). Identical to
          // the Clients table — one source of truth so the wall and the table
          // always agree. (Previously an inline copy that drifted out of sync.)
          const healthCadence = (c) => computeCadence(c, { allTouchpoints, allCompletions, personalEvents });

          // Group every client by cadence state for the wall. Order = most-
          // urgent first (Slipping), then On rhythm, Ahead, Calibrating last.
          const cadenceBuckets = [
            { key: "cooling",     label: "Slipping",    sub: "getting less attention than their normal", color: C.retWarn },
            { key: "steady",      label: "On rhythm",   sub: "holding their usual pace",                  color: C.primaryMuted },
            { key: "warming",     label: "Ahead",       sub: "getting more attention than their normal",  color: C.retGood },
            { key: "calibrating", label: "Calibrating", sub: "still building a baseline",                 color: C.textMuted },
          ].map(b => ({
            ...b,
            clients: clients
              .map(c => ({ c, cad: healthCadence(c) }))
              .filter(x => x.cad.state === b.key)
              .sort((a, z) => (a.c.name || "").localeCompare(z.c.name || "")),
          }));
          const totalPlotted = cadenceBuckets.reduce((s, b) => s + b.clients.length, 0);

          return (
            <div style={{ width: "100%" }}>
              {dataLoaded && totalClients === 0 && (
                <div style={{ width: "100%", padding: "20px 4px" }}>
                  <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 20px", letterSpacing: -0.4, color: C.text, padding: "0 4px" }}>Health</h1>
                  <EmptyState
                    icon="health"
                    headline="No reviews scheduled yet."
                    body="Add a client and Rai schedules a quarterly check-in — a nudge to refresh their profile so your scores stay sharp. Dismiss anytime, no penalty."
                    cta={{ label: "Add a client", onClick: () => goTo("clients") }}
                  />
                </div>
              )}
              {dataLoaded && totalClients > 0 && (<>
              {/* STATUS BAND */}
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "4px 4px 20px", marginBottom: 20, borderBottom: "1px solid " + C.borderLight, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                  <div style={{ fontSize: 11.5, color: C.textMuted, letterSpacing: 0.3, marginBottom: 4 }}>Monthly cadence · {monthLabel}</div>
                  <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: -0.4, color: C.text }}>Health</h1>
                  <div style={{ fontSize: 13.5, color: C.textMuted, marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ color: activeQueue.filter(h => h.overdue > 0).length > 0 ? C.retWarn : C.textMuted, fontWeight: 600 }}>
                      <b>{activeQueue.filter(h => h.overdue > 0).length}</b> overdue
                    </span>
                    <span className="rt-sep" />
                    <span><b style={{ color: C.text, fontWeight: 700 }}>{activeQueue.filter(h => h.due === "Today").length}</b> due today</span>
                    {justCompleted.length > 0 && <>
                      <span className="rt-sep" />
                      <span style={{ color: C.retGood, fontWeight: 600 }}>
                        <b>{justCompleted.length}</b> done today
                      </span>
                    </>}
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  {/* Primary action — pattern matches Add Client (Clients
                      page), + Referral (Referrals page), Add Rolodex
                      (Rolodex page). Restores the site's "left = state,
                      right = action" rhythm on every page header.
                      Replaces the previous "of book checked" progress
                      bar, which was always 0% on new accounts and not
                      actionable. Opens the next available health
                      check in place (the first runnable item in the
                      active queue, same ordering the queue renders in).
                      When nothing is runnable the button is inert and
                      reads disabled. */}
                  <button
                    className="r-btn"
                    data-tone="green"
                    disabled={activeQueue.length === 0}
                    onClick={() => { if (activeQueue.length > 0) setHcOpen(activeQueue[0].client); }}
                    style={{
                      opacity: activeQueue.length === 0 ? 0.45 : 1,
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "10px 16px",
                      color: "#fff",
                      border: "none",
                      borderRadius: 10,
                      fontSize: 13.5,
                      fontWeight: 600,
                      cursor: activeQueue.length === 0 ? "default" : "pointer",
                      fontFamily: "inherit",
                      boxShadow: activeQueue.length === 0 ? "none" : "var(--rt-sh-purple)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span>Start Check</span>
                  </button>
                </div>
              </div>



              {/* Mobile observation — placed ABOVE the calendar widget. Desktop renders the same observation inside the rc-grid main column below. Mutually exclusive via isMobile. */}
              {isMobile && dataLoaded && clients.length > 0 && clients.every(c => !c.profileScores || Object.keys(c.profileScores || {}).length === 0) && (
                <ScoreFirstCard clientName={clients[0].name} onScore={() => setSelectedClient(clients[0])} />
              )}
              {isMobile && (<>{renderObserver()}{observation && !obsDismissing && obsCaption}</>)}

              {/* MOBILE UPCOMING STRIP — between band and main grid (mobile only) */}
              <div className="rt-mob-strip" style={{ marginBottom: 16 }}>
                {(() => {
                  const today = new Date();
                  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
                  const daysLeft = daysInMonth - today.getDate();
                  const planned = hcQueue.filter(h => !h.runnable).length;
                  const summary = `${checkedThisMonth} logged · ${planned} planned · ${daysLeft}d left`;
                  const monthName = today.toLocaleString("en-US", { month: "long" });
                  const year = today.getFullYear();
                  const monthIdx = today.getMonth();
                  const todayDay = today.getDate();
                  const firstDay = new Date(year, monthIdx, 1);
                  const startCol = firstDay.getDay();
                  const byDay = {};
                  hcQueue.forEach(h => {
                    if (h.due_date) {
                      const d = new Date(h.due_date);
                      if (d.getFullYear() === year && d.getMonth() === monthIdx && d.getDate() >= todayDay) {
                        byDay[d.getDate()] = "planned";
                      }
                    }
                  });
                  Object.keys(hcDone).forEach(cn => { if (hcDone[cn]) byDay[todayDay] = "logged"; });
                  const cells = [];
                  for (let i = 0; i < startCol; i++) cells.push(null);
                  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
                  while (cells.length % 7 !== 0) cells.push(null);
                  const daysHdr = ["S", "M", "T", "W", "T", "F", "S"];
                  return (
                    <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 10, boxShadow: "var(--rt-sh-card)", overflow: "hidden" }}>
                      <div onClick={() => setHealthStripOpen(!healthStripOpen)} style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, cursor: "pointer" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: C.primaryGhost, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Icon name="health" size={14} simple color={C.primary} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 0.3, textTransform: "uppercase", fontWeight: 700, marginBottom: 2 }}>{monthName} rhythm</div>
                            <div style={{ fontSize: 13.5, color: C.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{summary}</div>
                          </div>
                        </div>
                        <Icon name={healthStripOpen ? "chevron-up" : "chevron-down"} size={14} color={C.textMuted} />
                      </div>
                      {healthStripOpen && (
                        <div style={{ padding: 14, borderTop: "1px solid " + C.borderLight }}>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 6 }}>
                            {daysHdr.map((d, i) => <div key={"h-" + i} style={{ fontSize: 9.5, color: C.textMuted, textAlign: "center", fontWeight: 500 }}>{d}</div>)}
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
                            {cells.map((d, i) => {
                              if (d === null) return <div key={"c-" + i} />;
                              const state = d === todayDay ? "today" : byDay[d] || null;
                              const isToday = state === "today";
                              const isLogged = state === "logged";
                              const isPlanned = state === "planned";
                              return (
                                <div key={"c-" + i} style={{
                                  aspectRatio: "1",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 11,
                                  fontWeight: isToday || isLogged ? 700 : 500,
                                  fontVariantNumeric: "tabular-nums",
                                  borderRadius: 4,
                                  color: isToday || isLogged ? "#fff" : isPlanned ? C.textSec : C.textMuted,
                                  background: isToday ? C.primary : isLogged ? C.retGood : "transparent",
                                  border: isPlanned ? "1px dashed " + C.border : "1px solid transparent",
                                }}>{d}</div>
                              );
                            })}
                          </div>
                          <div style={{ display: "flex", gap: 10, marginTop: 10, fontSize: 10, color: C.textMuted, flexWrap: "wrap" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: C.retGood }} />logged</span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "transparent", border: "1px dashed " + C.border }} />planned</span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: C.primary }} />today</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* MAIN GRID: rail + main + rai (rai shows on >=1440px) */}
              <div className="rc-grid" style={{ display: "grid", gap: 20, alignItems: "start" }}>

                {/* LEFT RAIL — calendar + queue */}
                <div className="rc-rail" style={{ position: "sticky", top: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* ─── Calendar — current month rhythm ─── */}
                  {(() => {
                    const today = new Date();
                    const year = today.getFullYear();
                    const monthIdx = today.getMonth();
                    const todayDay = today.getDate();
                    const firstDay = new Date(year, monthIdx, 1);
                    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
                    const startCol = firstDay.getDay(); // 0=Sun
                    // Build day states from hcQueue: due_date in current month (not yet done) → planned.
                    // Logged days require a completed-HC fetch which we don't do yet; they'll
                    // light up when that fetch gets wired in. "Today" always wins over planned.
                    const byDay = {};
                    hcQueue.forEach(h => {
                      if (h.due_date) {
                        const d = new Date(h.due_date);
                        if (d.getFullYear() === year && d.getMonth() === monthIdx && d.getDate() >= todayDay) {
                          byDay[d.getDate()] = "planned";
                        }
                      }
                    });
                    // Mark just-completed sessions so the user gets immediate visual feedback
                    Object.keys(hcDone).forEach(clientName => {
                      if (hcDone[clientName]) byDay[todayDay] = "logged";
                    });
                    const loggedCount = Object.values(byDay).filter(s => s === "logged").length;
                    const monthName = today.toLocaleString("en-US", { month: "long" });
                    // Build the grid: 6 rows × 7 cols, fill with null where out-of-month
                    const cells = [];
                    for (let i = 0; i < startCol; i++) cells.push(null);
                    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
                    while (cells.length % 7 !== 0) cells.push(null);
                    const daysHdr = ["S", "M", "T", "W", "T", "F", "S"];
                    return (
                      <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: "var(--rt-sh-card)", padding: "14px" }}>
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
                          <span style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>{monthName} rhythm</span>
                          <span style={{ fontSize: 10.5, color: C.textMuted, fontVariantNumeric: "tabular-nums" }}><b style={{ color: C.text }}>{loggedCount}</b> checks · <b style={{ color: C.text }}>{todayDay}</b>/{daysInMonth}</span>
                        </div>
                        {/* Day-of-week header */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
                          {daysHdr.map((d, i) => (
                            <div key={"h-" + i} style={{ fontSize: 9.5, color: C.textMuted, textAlign: "center", fontWeight: 500 }}>{d}</div>
                          ))}
                        </div>
                        {/* Day grid */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                          {cells.map((d, i) => {
                            if (d === null) return <div key={"c-" + i} />;
                            const state = d === todayDay ? "today" : byDay[d] || null;
                            const isToday = state === "today";
                            const isLogged = state === "logged";
                            const isPlanned = state === "planned";
                            return (
                              <div key={"c-" + i} style={{
                                aspectRatio: "1",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 11,
                                fontWeight: isToday || isLogged ? 700 : 500,
                                fontVariantNumeric: "tabular-nums",
                                borderRadius: 6,
                                color: isToday ? "#fff" : isLogged ? "#fff" : isPlanned ? C.textSec : C.textMuted,
                                background: isToday ? C.primary : isLogged ? C.retGood : "transparent",
                                border: isPlanned ? "1px dashed " + C.border : "1px solid transparent",
                              }}>{d}</div>
                            );
                          })}
                        </div>
                        {/* Legend */}
                        <div style={{ display: "flex", gap: 10, marginTop: 12, fontSize: 10, color: C.textMuted, flexWrap: "wrap" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: C.retGood }} />logged</span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "transparent", border: "1px dashed " + C.border }} />planned</span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: C.primary }} />today</span>
                        </div>
                      </div>
                    );
                  })()}
                  <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: "var(--rt-sh-card)", overflow: "hidden" }}>
                    <div style={{ padding: "12px 14px 10px", borderBottom: "1px solid " + C.borderLight, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>Queue</div>
                        <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 3 }}>Overdue first, then upcoming</div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, padding: "1px 8px", background: C.borderLight, borderRadius: 999, flexShrink: 0 }}>{activeQueue.length}</span>
                    </div>
                    {activeQueue.length === 0 ? (
                      <div style={{ padding: "20px 14px", textAlign: "center" }}>
                        <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.5 }}>All caught up.</div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        {activeQueue.slice(0, 3).map((h, i) => {
                          const isOpen = hcOpen === h.client;
                          const overdueDays = h.overdue;
                          const isStartEarly = h.isFirstHC && overdueDays === 0 && h.due !== "Today";
                          const subLabel = overdueDays > 0 ? `${overdueDays}d overdue` : h.due === "Today" ? "Due today" : `Upcoming · in ${h.daysUntil}d`;
                          const subColor = overdueDays > 0 ? C.retWarn : isStartEarly ? C.textSec : C.retOk;
                          return (
                            <button
                              key={i}
                              onClick={() => setHcOpen(isOpen ? null : h.client)}
                              className={"rt-soft-row" + (isOpen ? " is-active" : "")}
                              style={{
                                position: "relative",
                                display: "flex", alignItems: "center", gap: 10,
                                padding: "12px 14px",
                                border: "none",
                                borderBottom: i === activeQueue.length - 1 ? "none" : "1px solid " + C.borderLight,
                                borderLeft: isOpen ? "3px solid " + C.primary : "3px solid transparent",
                                cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                                ...(isOpen ? { background: C.primarySoft } : {}),
                              }}
                            >
                              {/* Overdue red dot — top right corner */}
                              {overdueDays > 0 && (
                                <span style={{ position: "absolute", top: 8, right: 10, width: 7, height: 7, borderRadius: 4, background: C.retCrit }} />
                              )}
                              <div style={{ width: 30, height: 30, borderRadius: 15, background: retGradient(h.ret), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0, boxShadow: "var(--rt-sh-xs)" }}>
                                {(h.client || "?").split(/\s|&/).filter(Boolean).slice(0,2).map(s=>s[0]).join("").toUpperCase()}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12.5, color: C.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.client}</div>
                                <div style={{ fontSize: 11, color: subColor, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subLabel}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* MAIN COLUMN */}
                <div style={{ minWidth: 0 }}>
                  {/* ═══════════════════════════════════════════════════════════════
                      OBSERVER CARD — single dark green panel, no flip.
                      Top bar: card name + observation number/week/date.
                      Headline + body, then divider, then metric strip + actions.
                  ═══════════════════════════════════════════════════════════════ */}
                  {/* Observation — rendered TWICE (once for mobile above calendar, once for desktop in this main column). renderObserver returns null when conditions aren't met. */}
                  {!isMobile && dataLoaded && clients.length > 0 && clients.every(c => !c.profileScores || Object.keys(c.profileScores || {}).length === 0) && (
                    <ScoreFirstCard clientName={clients[0].name} onScore={() => setSelectedClient(clients[0])} />
                  )}
                  {!isMobile && (<>{renderObserver()}{observation && !obsDismissing && obsCaption}</>)}
                  {activeQueue.length === 0 && justCompleted.length === 0 && (
                    <div style={{ textAlign: "center", padding: "60px 20px", background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: "var(--rt-sh-card)" }}>
                      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: C.text }}>All caught up</div>
                      <div style={{ fontSize: 12.5, color: C.textMuted }}>No health checks due right now. Check back when the next one is ready.</div>
                    </div>
                  )}

                  {/* Active review tiles — top 3 shown; rest behind a dropdown
                      that matches the Today "completed today" log exactly. */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {(() => {
                    const renderReviewTile = (h, i) => {
                      const isOpen = hcOpen === h.client;
                      const client = clients.find(c => c.name === h.client);
                      // Dismiss / mark-reviewed: reschedules the next review ~a
                      // quarter out (no penalty) and clears it from the queue.
                      const finishReview = async () => {
                        setHcDone(prev => ({ ...prev, [h.client]: true }));
                        setHcOpen(null);
                        try {
                          if (h.id && hcDb.complete) await hcDb.complete(h.id, {}, null, null);
                          await hcDb.scheduleNext(user.id, h.client_id || client?.id);
                        } catch (e) { console.warn("Review reschedule failed:", e); }
                      };
                      return (
                        <div key={i} style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: "var(--rt-sh-card)" }}>
                          <div onClick={() => setHcOpen(isOpen ? null : h.client)} style={{ padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 18, background: retGradient(h.ret), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0, boxShadow: "var(--rt-sh-xs)" }}>
                              {(h.client || "?").split(/\s|&/).filter(Boolean).slice(0,2).map(s=>s[0]).join("").toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: -0.2 }}>{h.client}</span>
                                <span style={{ fontSize: 12, fontWeight: 700, color: retColor(h.ret), fontVariantNumeric: "tabular-nums" }}>{h.ret}</span>
                                {client?.tag && <span style={{ fontSize: 11, color: C.textMuted }}>· {client.tag}</span>}
                              </div>
                              <div style={{ fontSize: 12, color: h.overdue > 0 ? C.retWarn : (h.isFirstHC && h.due !== "Today") ? C.primary : C.retOk, marginTop: 2, fontWeight: 500 }}>
                                {h.overdue > 0 ? `Review due ${h.overdue}d ago` : h.due === "Today" ? "Review due today" : `Coming up · in ${h.daysUntil}d`}
                              </div>
                            </div>
                            {!isOpen && (
                              <button className="r-btn" data-tone="green" style={{ padding: "8px 16px", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Review</button>
                            )}
                          </div>

                          {/* Expanded — quarterly portfolio review actions */}
                          {isOpen && (
                            <div style={{ padding: "4px 18px 18px", borderTop: "1px solid " + C.borderLight }}>
                              <p style={{ fontSize: 13.5, lineHeight: 1.5, color: C.textSec, margin: "14px 0 16px" }}>
                                Time for a quarterly check on <b style={{ color: C.text }}>{h.client}</b>. Has anything changed — scope, contacts, pace, your read on the relationship? Update their profile so Rai's scoring stays sharp, talk it through with Rai, or dismiss if all's well.
                              </p>
                              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                <button
                                  onClick={() => { if (client) { setSelectedClient(client); } setHcOpen(null); }}
                                  style={{ padding: "9px 18px", background: C.primary, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                                >Update profile</button>
                                <button
                                  onClick={() => { if (client) { setAiMessages([]); setObservationContext(`The user opened a quarterly portfolio review for ${h.client} and wants to talk through whether anything has changed with this relationship — scope, contacts, communication pace, results, their gut read. Help them reflect and decide what (if anything) to update in the client's profile.`); } setHcOpen(null); setPage("coach"); }}
                                  style={{ padding: "9px 18px", background: "transparent", color: C.primary, border: "1px solid rgba(51,84,62,0.35)", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                                >Chat with Rai</button>
                                <div style={{ flex: 1 }} />
                                <button
                                  onClick={finishReview}
                                  style={{ padding: "9px 14px", background: "transparent", color: C.textMuted, border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                                  onMouseEnter={e => e.currentTarget.style.color = C.text}
                                  onMouseLeave={e => e.currentTarget.style.color = C.textMuted}
                                >All good — dismiss</button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    };
                    const topReviews = activeQueue.slice(0, 3);
                    const moreReviews = activeQueue.slice(3);
                    return (
                      <>
                        {topReviews.map((h, i) => renderReviewTile(h, i))}
                        {moreReviews.length > 0 && (
                          <div className="rt-review-more" style={{ marginTop: 4 }}>
                            <button
                              onClick={() => setReviewQueueMoreOpen(!reviewQueueMoreOpen)}
                              style={{
                                width: "100%",
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "12px 14px",
                                background: reviewQueueMoreOpen ? C.primarySoft : "transparent",
                                border: "1px dashed " + (reviewQueueMoreOpen ? C.primaryLight : C.border),
                                borderRadius: 10,
                                color: reviewQueueMoreOpen ? C.primary : C.textSec,
                                fontSize: 13,
                                fontWeight: 500,
                                cursor: "pointer",
                                fontFamily: "inherit",
                                transition: "background 160ms var(--rt-ease-out), border-color 160ms var(--rt-ease-out), color 160ms var(--rt-ease-out)",
                              }}
                              onMouseEnter={e => {
                                if (reviewQueueMoreOpen) return;
                                e.currentTarget.style.background = C.primarySoft;
                                e.currentTarget.style.borderColor = C.primaryLight;
                                e.currentTarget.style.color = C.primary;
                              }}
                              onMouseLeave={e => {
                                if (reviewQueueMoreOpen) return;
                                e.currentTarget.style.background = "transparent";
                                e.currentTarget.style.borderColor = C.border;
                                e.currentTarget.style.color = C.textSec;
                              }}
                            >
                              <span>
                                <span style={{ color: C.textMuted, marginRight: 4 }}>{moreReviews.length}</span>
                                more upcoming
                              </span>
                              <svg
                                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                style={{ transform: reviewQueueMoreOpen ? "rotate(90deg)" : "rotate(0)", transition: "transform 220ms var(--rt-ease-out)" }}
                              >
                                <path d="M9 6l6 6-6 6" />
                              </svg>
                            </button>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateRows: reviewQueueMoreOpen ? "1fr" : "0fr",
                                marginTop: reviewQueueMoreOpen ? 10 : 0,
                                opacity: reviewQueueMoreOpen ? 1 : 0,
                                transition: "grid-template-rows 280ms var(--rt-ease-out), margin-top 240ms var(--rt-ease-out), opacity 220ms var(--rt-ease-out)",
                              }}
                            >
                              <div style={{ overflow: "hidden", minHeight: 0 }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                  {moreReviews.map((h, i) => renderReviewTile(h, i + 3))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    );
                    })()}
                  </div>
                  {totalPlotted > 0 && (
                    <div style={{ marginTop: 24, background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: "var(--rt-sh-card)", padding: "20px 22px 18px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, marginBottom: 18, flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.4 }}>Drift wall</div>
                          <div style={{ fontSize: 13, color: C.textSec, marginTop: 3 }}>Every client, read by their own rhythm — who's cooling, who's holding, who you're ahead on.</div>
                        </div>
                        <div style={{ display: "flex", gap: 14, fontSize: 11, color: C.textSec, flexWrap: "wrap" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: C.retWarn }} />Slipping</span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: C.primaryMuted }} />On rhythm</span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: C.retGood }} />Ahead</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                        {cadenceBuckets.filter(b => b.clients.length > 0).map(b => (
                          <div key={b.key}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
                              <span style={{ width: 9, height: 9, borderRadius: 5, background: b.color, flexShrink: 0 }} />
                              <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{b.label}</span>
                              <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>{b.clients.length}</span>
                              <span style={{ fontSize: 12, color: C.textMuted }}>· {b.sub}</span>
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              {b.clients.map(({ c }) => {
                                const initials = (c.name || "?").split(/\s|&/).filter(Boolean).slice(0, 2).map(s => s[0]).join("").toUpperCase();
                                return (
                                  <button
                                    key={c.id}
                                    onClick={() => setSelectedClient(c)}
                                    style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px 6px 6px", borderRadius: 999, border: "1px solid " + C.borderLight, background: C.bg, cursor: "pointer", fontFamily: "inherit" }}
                                  >
                                    <span style={{ width: 24, height: 24, borderRadius: 12, background: b.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 700, flexShrink: 0 }}>{initials}</span>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: "nowrap" }}>{c.name}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Done this month */}
                  {justCompleted.length > 0 && (
                    <div style={{ marginTop: 24, background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: "var(--rt-sh-card)", overflow: "hidden" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "16px 20px 12px", borderBottom: "1px solid " + C.borderLight }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.4 }}>Done this month</span>
                        <span style={{ fontSize: 11, color: C.textMuted }}>Most recent first</span>
                      </div>
                      {justCompleted.map((h, i) => {
                        const tier = toDriftTier(clientDrift[h.client]);
                        const tc = driftTierColor(tier);
                        const initials = (h.client || "?").split(/\s|&/).filter(Boolean).slice(0,2).map(s=>s[0]).join("").toUpperCase();
                        return (
                          <div key={"done-" + i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 20px 12px 16px", borderBottom: i < justCompleted.length - 1 ? "1px solid " + C.borderLight : "none" }}>
                            {/* Left priority bar */}
                            <div style={{ width: 3, alignSelf: "stretch", background: tc, borderRadius: 2, flexShrink: 0 }} />
                            {/* Avatar */}
                            <div style={{ width: 28, height: 28, borderRadius: 14, background: tc, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{initials}</div>
                            {/* Name */}
                            <span style={{ fontSize: 13.5, fontWeight: 600, color: C.text, flexShrink: 0 }}>{h.client}</span>
                            {/* Drift pill */}
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 999, border: "1px solid " + tc, color: tc, letterSpacing: 0.4, textTransform: "uppercase", flexShrink: 0 }}>{tier}</span>
                            {/* One-liner stub */}
                            <span style={{ fontSize: 12.5, color: C.textSec, fontStyle: "italic", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{driftStub(tier)}</span>
                            {/* Timestamp — stubbed as "Today" for just-completed checks */}
                            <span style={{ fontSize: 11.5, color: C.textMuted, flexShrink: 0 }}>Today</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
              </>)}
            </div>
          );
        
}
