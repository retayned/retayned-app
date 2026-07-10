// AUTO-EXTRACTED from App.jsx (page === "workers" block) — body is
// verbatim; only the surrounding component shell + imports are generated.
import { useState, useEffect } from "react";
import { workers as workersDb } from "../lib/db";
import { Icon } from "../components/Icon";
import { C } from "../theme";
import { supabase } from "../lib/supabase";
import { getWorkerInitials, ymdInTz } from "../utils";

export default function WorkersPage({ app }) {
  const {
    clients,
    occurrenceFlags,
    setAddWorkerOpen,
    setNewWorkerEmail,
    setNewWorkerName,
    setNewWorkerRole,
    setWorkersList,
    taskOccurrences,
    tasks,
    userTimezone,
    workerCompletions,
    workersList,
    org,
    orgRole,
    billing,
    orgLoading,
    refetchOrg,
    user,
    orgMembers,
    clientAssignments,
    assignClient,
  } = app;
  // Agency seats/coverage moved to Settings → Team (Jul 2026):
  // Workers is contractors only. See components/AgencyTeam.jsx.

          // Inline mini Stat component for the per-worker stat grid
          const Stat = ({ label, value, sub, tone = "default", isText = false }) => {
            const valueColor =
              tone === "danger" ? C.danger :
              tone === "warning" ? C.warning :
              tone === "success" ? C.success :
              C.text;
            return (
              <div>
                <div style={{ fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: C.textMuted, fontWeight: 600 }}>{label}</div>
                <div style={{
                  fontSize: isText ? 13 : 17,
                  fontWeight: isText ? 600 : 700,
                  color: valueColor,
                  marginTop: 3,
                  fontVariantNumeric: "tabular-nums",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>{value}</div>
                {sub && (
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{sub}</div>
                )}
              </div>
            );
          };

          // Distribution row in the Team rail card
          const DistRow = ({ color, count, label, muted = false }) => (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: color, opacity: muted ? 0.5 : 1, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: count > 0 ? C.text : C.textMuted, fontWeight: 600, fontVariantNumeric: "tabular-nums", width: 24 }}>{count}</span>
              <span style={{ fontSize: 12.5, color: C.textMuted }}>{label}</span>
            </div>
          );

          // ─── Stats engine ──────────────────────────────────────────────
          // For each worker, compute throughput, reliability, client mix,
          // and a Worker Impact Score that weights completions by client value.
          // Day boundary at midnight stored-TZ (matches task rollover and bucketing).
          const _now = new Date();
          const _todayStr = userTimezone
            ? ymdInTz(userTimezone, _now)
            : `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}-${String(_now.getDate()).padStart(2, "0")}`;
          const _30dAgo = new Date(_now); _30dAgo.setDate(_30dAgo.getDate() - 30);
          const _30dAgoIso = _30dAgo.toISOString();

          // All tasks ever assigned to a worker (for all-time stats).
          // We rely on the in-memory `tasks` array for now; for a deeper history we'd query.
          const allAssigned = tasks.filter(t => !!t.assigned_worker_id);

          // Compute total revenue across clients (for revenue concentration in Impact).
          const totalRevenue = clients.reduce((a, c) => a + (c.revenue || 0), 0) || 1;

          // Per-client value heuristic (used in Impact Score).
          // 0 → low value, ~1 → top-tier value.
          const clientValue = (clientName) => {
            const c = clients.find(x => x.name === clientName);
            if (!c) return 0.3; // unknown client → conservative floor
            const ret = (c.ret || 60) / 100;                 // 0..1
            const conc = (c.revenue || 0) / totalRevenue;     // 0..1
            const tenureBoost = 1 + Math.min((c.months || 0) / 24, 1); // 1..2
            return ret * conc * tenureBoost;
          };

          // Compute per-worker stats.
          //
          // Data sources:
          //   (1) `allAssigned` — open tasks currently assigned to a worker.
          //       From the in-memory `tasks` array (today's open set).
          //       Used for: pending, overdue, currently-open client mix.
          //   (2) `workerCompletions` — historical completion events from
          //       the task_completions table. Persists across day rollovers
          //       (the in-memory tasks array loses these on refresh).
          //       Used for: all-time completed counts, on-time rates,
          //       time-windowed counts, completion-based client mix.
          //
          // Without (2), refreshing wiped historical completion data because
          // the daily midnight rollover nulls tasks.completed_at on recurring
          // tasks to surface them as open the next day.
          // Phase 3 cutover via `worker_stats` flag.
          //   - flag ON  → derive worker stats from task_occurrences (new)
          //   - flag OFF → workerCompletions / task_completions (current)
          // We unify the shape so computeStats doesn't need to branch
          // internally — both sources produce rows with the same fields.
          const useOccurrencesForWorkers = occurrenceFlags.worker_stats === true;
          const workerCompletionRows = useOccurrencesForWorkers
            ? (taskOccurrences || [])
                .filter(o => o.is_done && o.completed_at)
                .map(o => ({
                  task_id: o.task_id,
                  user_id: o.user_id,
                  client_id: o.client_id,
                  client_name: o.client_name,
                  task_text: o.task_text,
                  completed_at: o.completed_at,
                  assigned_worker_id: o.assigned_worker_id,
                  was_on_time: o.was_on_time,
                }))
            : workerCompletions;

          const computeStats = (workerId) => {
            const wOpen = allAssigned.filter(t => t.assigned_worker_id === workerId);
            const wCompletions = workerCompletionRows.filter(c => c.assigned_worker_id === workerId);

            // Pending + overdue come from currently-open tasks only.
            const pending = wOpen.filter(t => !t.done).length;
            const overdue = wOpen.filter(t => !t.done && t.due_date && String(t.due_date).slice(0, 10) < _todayStr).length;

            // Completed counts come from task_completions (persistent history).
            // Each completion row is a discrete event — recurring tasks
            // completed N times produce N rows.
            const completedAll = wCompletions.length;
            const completed30 = wCompletions.filter(c => new Date(c.completed_at).getTime() >= _30dAgo.getTime()).length;

            // "Done" count combines historical completions + tasks that are
            // currently flagged done in the open set. Mostly redundant since
            // a completed task will also have a completion row, but kept for
            // safety in case of any in-flight state where the task row was
            // toggled done but the completion insert hasn't landed yet.
            const wDone = completedAll;
            const wDone30 = completed30;

            // Assigned counts: in-memory open + historical completions
            // (each completion implies that task was assigned at some point).
            // Sums across both axes; doesn't perfectly dedupe (recurring tasks
            // get counted once per completion), which matches throughput
            // semantics — "how many things has this worker done."
            const wTasksAll = wOpen.length + completedAll;
            const wAssigned30 = wOpen.filter(t => {
              const ts = t.created_at || 0;
              return new Date(ts).getTime() >= _30dAgo.getTime();
            }).length + completed30;

            // On-time rates come from completion rows directly. was_on_time
            // is frozen at insert time so it's historically stable.
            const onTimeAll = wCompletions.filter(c => c.was_on_time !== false).length;
            const onTimeRateAll = completedAll > 0 ? Math.round((onTimeAll / completedAll) * 100) : null;

            const wCompletions30 = wCompletions.filter(c => new Date(c.completed_at).getTime() >= _30dAgo.getTime());
            const onTime30 = wCompletions30.filter(c => c.was_on_time !== false).length;
            const onTimeRate30 = wCompletions30.length > 0 ? Math.round((onTime30 / wCompletions30.length) * 100) : null;

            // Client mix — combine open and completed for an honest picture.
            const clientMap = {};
            wOpen.forEach(t => {
              const k = t.client || "(no client)";
              clientMap[k] = (clientMap[k] || 0) + 1;
            });
            wCompletions.forEach(c => {
              const k = c.client_name || "(no client)";
              clientMap[k] = (clientMap[k] || 0) + 1;
            });
            const clientEntries = Object.entries(clientMap).sort((a, b) => b[1] - a[1]);
            const topClient = clientEntries[0]?.[0] || null;
            const clientDiversity = clientEntries.filter(([k]) => k !== "(no client)").length;

            // Top client (last 30d) — same blend, time-windowed.
            const clientMap30 = {};
            wOpen.forEach(t => {
              const ts = t.created_at || 0;
              if (new Date(ts).getTime() < _30dAgo.getTime()) return;
              const k = t.client || "(no client)";
              clientMap30[k] = (clientMap30[k] || 0) + 1;
            });
            wCompletions30.forEach(c => {
              const k = c.client_name || "(no client)";
              clientMap30[k] = (clientMap30[k] || 0) + 1;
            });
            const topClient30 = Object.entries(clientMap30).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

            // ─── Worker Impact Score ───────────────────────────────────
            // Per-completion average impact, scaled to a 0-99 range.
            //
            // For each historical completion:
            //   cv = clientValue(client_name) — 0 if no client mapped
            //   ageDecay = exp(-ageDays / 180) — smooth half-life ~125d
            //   weight = 1.5 if on-time non-recurring,
            //            1.0 if on-time recurring,
            //            0.7 if late (either type)
            //   contribution = weight × cv × ageDecay
            //
            // For each currently-OPEN overdue task:
            //   severity = min(1, daysOverdue / 14) — cap penalty at 14d
            //   penalty = 0.5 × clientValue × severity
            //
            // Impact = average contribution per completion, ×50 to land in
            // 0-99 range. Workers with <5 completions are flagged "building"
            // and the score is shown as a placeholder until they have a
            // real sample size.
            let rawImpact = 0;
            let scorableCompletions = 0; // completions with a real client (cv > 0)
            wCompletions.forEach(c => {
              const cv = clientValue(c.client_name);
              if (cv <= 0) return; // "(no client)" tasks don't contribute to impact
              const ageDays = (Date.now() - new Date(c.completed_at).getTime()) / 86400000;
              const ageDecay = Math.exp(-ageDays / 180);
              const isOnTime = c.was_on_time !== false;
              let weight;
              if (c.is_recurring) {
                weight = isOnTime ? 1.0 : 0.7;
              } else {
                weight = isOnTime ? 1.5 : 0.7;
              }
              rawImpact += weight * cv * ageDecay;
              scorableCompletions++;
            });

            // Severity-scaled overdue penalty.
            wOpen.filter(t => !t.done && t.due_date && String(t.due_date).slice(0, 10) < _todayStr).forEach(t => {
              const cv = clientValue(t.client);
              if (cv <= 0) return;
              const dueMs = new Date(t.due_date).getTime();
              const daysOverdue = Math.max(0, (Date.now() - dueMs) / 86400000);
              const severity = Math.min(1, daysOverdue / 14);
              rawImpact -= 0.5 * cv * severity;
            });

            // Per-completion average impact. Avoids the previous sqrt-divisor
            // bug where doubling completions made the score go DOWN.
            const avgImpact = scorableCompletions > 0 ? rawImpact / scorableCompletions : 0;
            let impact = Math.round(avgImpact * 50);
            impact = Math.max(0, Math.min(99, impact));

            // "Building track record" if < 5 scorable completions.
            const isBuilding = scorableCompletions < 5;

            return {
              wTasksAll, wDone, wAssigned30, wDone30,
              pending, overdue,
              onTimeRateAll, onTimeRate30,
              completedAll, completed30,
              topClient, topClient30, clientDiversity,
              impact, isBuilding,
            };
          };

          // Build stats map
          const statsByWorker = {};
          workersList.forEach(w => { statsByWorker[w.id] = computeStats(w.id); });

          // Subhead aggregates
          const teamPending = workersList.reduce((a, w) => a + (statsByWorker[w.id]?.pending || 0), 0);
          const teamOnTimeRate = (() => {
            // Aggregate completion + on-time across team
            let totalCompleted = 0, totalOnTime = 0;
            workersList.forEach(w => {
              const s = statsByWorker[w.id];
              if (s?.onTimeRateAll != null && s.completedAll > 0) {
                totalCompleted += s.completedAll;
                totalOnTime += Math.round(s.completedAll * (s.onTimeRateAll / 100));
              }
            });
            return totalCompleted > 0 ? Math.round((totalOnTime / totalCompleted) * 100) : null;
          })();

          // Comparative: leaderboards
          const sortedByImpact = [...workersList]
            .map(w => ({ w, s: statsByWorker[w.id] }))
            .filter(x => !x.s.isBuilding)
            .sort((a, b) => b.s.impact - a.s.impact);
          const sortedByVolume = [...workersList]
            .map(w => ({ w, s: statsByWorker[w.id] }))
            .sort((a, b) => b.s.completed30 - a.s.completed30);

          // ─── Left-rail aggregations ─────────────────────────────────
          // Avg Impact (only includes workers with track record)
          const scorableWorkers = workersList.filter(w => !statsByWorker[w.id].isBuilding);
          const avgImpact = scorableWorkers.length
            ? Math.round(scorableWorkers.reduce((a, w) => a + statsByWorker[w.id].impact, 0) / scorableWorkers.length)
            : null;

          // Distribution buckets (mirrors Clients page Thriving/Healthy/Watch/At-risk/Critical)
          const distHigh   = workersList.filter(w => !statsByWorker[w.id].isBuilding && statsByWorker[w.id].impact >= 70).length;
          const distSolid  = workersList.filter(w => !statsByWorker[w.id].isBuilding && statsByWorker[w.id].impact >= 40 && statsByWorker[w.id].impact < 70).length;
          const distLow    = workersList.filter(w => !statsByWorker[w.id].isBuilding && statsByWorker[w.id].impact < 40).length;
          const distBuild  = workersList.filter(w => statsByWorker[w.id].isBuilding).length;

          // Lifetime team task count + avg time-to-complete
          const allCompletedAcrossTeam = allAssigned.filter(t => t.done && (t.completed_at || t.worker_completed_at));
          const lifetimeTasksDone = allCompletedAcrossTeam.length;
          // Avg time-to-complete (days). created_at → completed_at/worker_completed_at.
          const avgDaysToComplete = (() => {
            if (allCompletedAcrossTeam.length === 0) return null;
            const total = allCompletedAcrossTeam.reduce((acc, t) => {
              const start = t.created_at ? new Date(t.created_at).getTime() : null;
              const end = (t.completed_at || t.worker_completed_at) ? new Date(t.completed_at || t.worker_completed_at).getTime() : null;
              if (!start || !end || end < start) return acc;
              return acc + (end - start) / 86400000;
            }, 0);
            return Math.round((total / allCompletedAcrossTeam.length) * 10) / 10; // 1 decimal
          })();

          // Most-tenured worker (longest with us by created_at)
          const mostTenured = (() => {
            if (workersList.length === 0) return null;
            const sorted = [...workersList].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
            const w = sorted[0];
            if (!w.created_at) return null;
            const months = Math.max(1, Math.round((Date.now() - new Date(w.created_at).getTime()) / (86400000 * 30)));
            return { name: w.name, months };
          })();

          // Recent movement: completions last 7d vs prior 7d
          const _7dAgo = new Date(_now); _7dAgo.setDate(_7dAgo.getDate() - 7);
          const _14dAgo = new Date(_now); _14dAgo.setDate(_14dAgo.getDate() - 14);
          const movementByWorker = workersList.map(w => {
            const wTasks = allAssigned.filter(t => t.assigned_worker_id === w.id);
            const completed = wTasks.filter(t => t.done && (t.completed_at || t.worker_completed_at));
            const last7 = completed.filter(t => {
              const c = new Date(t.completed_at || t.worker_completed_at);
              return c >= _7dAgo;
            }).length;
            const prior7 = completed.filter(t => {
              const c = new Date(t.completed_at || t.worker_completed_at);
              return c >= _14dAgo && c < _7dAgo;
            }).length;
            return { w, last7, prior7, delta: last7 - prior7 };
          });
          const climbing = [...movementByWorker]
            .filter(x => x.delta > 0)
            .sort((a, b) => b.delta - a.delta)
            .slice(0, 3);
          const slipping = [...movementByWorker]
            .filter(x => x.delta < 0)
            .sort((a, b) => a.delta - b.delta)
            .slice(0, 3);

          return (
            <div style={{ width: "100%" }}>
              {/* STATUS BAND — mirrors Clients page exactly (border, spacing, alignment) */}
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "4px 4px 20px", marginBottom: 20, borderBottom: "1px solid " + C.borderLight }}>
                <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                  <div style={{ fontSize: 11.5, color: C.textMuted, letterSpacing: 0.3, marginBottom: 4 }}>Your team</div>
                  <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: -0.4, color: C.text }}>Workers</h1>
                  <div style={{ fontSize: 13.5, color: C.textMuted, marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span><b style={{ color: C.text, fontWeight: 700 }}>{workersList.length}</b> {workersList.length === 1 ? "worker" : "workers"}</span>
                    <span className="rt-sep" />
                    <span><b style={{ color: C.text, fontWeight: 700 }}>{teamPending}</b> pending</span>
                    <span className="rt-sep" />
                    {teamOnTimeRate != null ? (
                      <span><b style={{ color: teamOnTimeRate >= 80 ? C.success : teamOnTimeRate >= 60 ? C.warning : C.danger, fontWeight: 700 }}>{teamOnTimeRate}%</b> on-time</span>
                    ) : (
                      <span style={{ color: C.textMuted, fontStyle: "italic" }}>building track record</span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button
                    className="r-btn" data-tone="green"
                    onClick={() => { setNewWorkerName(""); setNewWorkerEmail(""); setNewWorkerRole(""); setAddWorkerOpen(true); }}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "10px 16px",
                      color: "#fff",
                      border: "none", borderRadius: 10,
                      fontSize: 13.5, fontWeight: 600,
                      cursor: "pointer", fontFamily: "inherit",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Add Worker
                  </button>
                </div>
              </div>


              {workersList.length === 0 ? (
                <div style={{ padding: "60px 20px", textAlign: "center", border: "1px dashed " + C.borderLight, borderRadius: 14 }}>
                  <div style={{
                    fontFamily: "'Fraunces', Georgia, serif",
                    fontVariationSettings: "'opsz' 96, 'SOFT' 50, 'WONK' 0",
                    fontStyle: "italic",
                    fontSize: 16,
                    color: C.textMuted,
                    marginBottom: 4,
                  }}>No workers yet.</div>
                  <div style={{ fontSize: 13, color: C.textMuted }}>Add someone you delegate tasks to — internal employee, freelancer, VA. They'll get an email when you assign them work.</div>
                </div>
              ) : (
                <div className="rc-grid" style={{ display: "grid", gap: 20, alignItems: "start" }}>
                  {/* LEFT RAIL — Team / Team History / Recent Movement */}
                  <div className="rc-rail" style={{ position: "sticky", top: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                    {/* Card 1: TEAM (mirrors Portfolio) */}
                    <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: "var(--rt-sh-card)", padding: "14px" }}>
                      <div style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 10 }}>Team</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                        <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
                          <svg width={64} height={64} style={{ transform: "rotate(-90deg)" }}>
                            <circle cx={32} cy={32} r={28} fill="none" stroke={C.borderLight} strokeWidth="3" />
                            {avgImpact != null && (
                              <circle cx={32} cy={32} r={28} fill="none"
                                stroke={avgImpact >= 70 ? C.success : avgImpact >= 40 ? C.warning : C.danger}
                                strokeWidth="3" strokeLinecap="round"
                                strokeDasharray={2 * Math.PI * 28}
                                strokeDashoffset={2 * Math.PI * 28 * (1 - avgImpact / 100)} />
                            )}
                          </svg>
                          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <div style={{ fontSize: 19, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums", letterSpacing: -0.3, lineHeight: 1 }}>{avgImpact != null ? avgImpact : "—"}</div>
                          </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                            <span style={{ fontSize: 11.5, color: C.textMuted }}>Workers</span>
                            <span style={{ fontSize: 12, color: C.textSec, fontVariantNumeric: "tabular-nums" }}>{workersList.length}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                            <span style={{ fontSize: 11.5, color: C.textMuted }}>Pending</span>
                            <span style={{ fontSize: 12, color: C.textSec, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{teamPending}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                            <span style={{ fontSize: 11.5, color: C.textMuted }}>On-time</span>
                            <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums", fontWeight: 600, color: teamOnTimeRate == null ? C.textMuted : teamOnTimeRate >= 80 ? C.success : teamOnTimeRate >= 60 ? C.warning : C.danger }}>
                              {teamOnTimeRate != null ? `${teamOnTimeRate}%` : "—"}
                            </span>
                          </div>
                        </div>
                      </div>
                      {/* Distribution bar — mirrors Clients health distribution */}
                      <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", background: C.borderLight, marginBottom: 10 }}>
                        {distHigh > 0 && <div style={{ background: C.success, flex: distHigh }} />}
                        {distSolid > 0 && <div style={{ background: C.warning, flex: distSolid }} />}
                        {distLow > 0 && <div style={{ background: C.danger, flex: distLow }} />}
                        {distBuild > 0 && <div style={{ background: C.textMuted, opacity: 0.4, flex: distBuild }} />}
                      </div>
                      {/* Bucket counts */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <DistRow color={C.success} count={distHigh} label="High impact" />
                        <DistRow color={C.warning} count={distSolid} label="Solid" />
                        <DistRow color={C.danger} count={distLow} label="Underperforming" />
                        <DistRow color={C.textMuted} count={distBuild} label="Building" muted />
                      </div>
                    </div>

                    {/* Card 2: TEAM HISTORY */}
                    <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: "var(--rt-sh-card)", padding: "14px" }}>
                      <div style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 10 }}>Team history</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 22, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums", letterSpacing: -0.5, lineHeight: 1.05 }}>{lifetimeTasksDone}</div>
                          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>Tasks done</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 22, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums", letterSpacing: -0.5, lineHeight: 1.05 }}>
                            {avgDaysToComplete != null ? `${avgDaysToComplete}d` : "—"}
                          </div>
                          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>Avg time</div>
                        </div>
                      </div>
                      {mostTenured && (
                        <div style={{ paddingTop: 10, borderTop: "1px solid " + C.borderLight, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                          <span style={{ fontSize: 11.5, color: C.textMuted }}>Most tenured</span>
                          <div style={{ display: "flex", gap: 6, alignItems: "baseline", minWidth: 0 }}>
                            <span style={{ fontSize: 12, color: C.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mostTenured.name}</span>
                            <span style={{ fontSize: 11, color: C.textMuted, flexShrink: 0 }}>{mostTenured.months >= 12 ? `${(mostTenured.months / 12).toFixed(1)} yr` : `${mostTenured.months} mo`}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card 3: RECENT MOVEMENT */}
                    <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: "var(--rt-sh-card)", padding: "14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                        <div style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>Recent movement</div>
                        <div style={{ fontSize: 10.5, color: C.textMuted }}>7d</div>
                      </div>
                      {climbing.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: C.success, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 6 }}>More active</div>
                          {climbing.map(({ w, delta }) => (
                            <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
                              <div style={{ width: 22, height: 22, borderRadius: 11, background: C.primary, color: "#fff", fontSize: 9, fontWeight: 700, display: "grid", placeItems: "center", flexShrink: 0 }}>{getWorkerInitials(w.name)}</div>
                              <span style={{ flex: 1, fontSize: 13, color: C.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.name}</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: C.success, fontVariantNumeric: "tabular-nums" }}>+{delta}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {slipping.length > 0 && (
                        <div>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: C.warning, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 6 }}>Gone quiet</div>
                          {slipping.map(({ w, delta }) => (
                            <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
                              <div style={{ width: 22, height: 22, borderRadius: 11, background: C.primary, color: "#fff", fontSize: 9, fontWeight: 700, display: "grid", placeItems: "center", flexShrink: 0 }}>{getWorkerInitials(w.name)}</div>
                              <span style={{ flex: 1, fontSize: 13, color: C.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.name}</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: C.warning, fontVariantNumeric: "tabular-nums" }}>{delta}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {climbing.length === 0 && slipping.length === 0 && (
                        <div style={{ fontSize: 12, color: C.textMuted, fontStyle: "italic", padding: "4px 0" }}>No movement to report yet</div>
                      )}
                    </div>
                  </div>

                  {/* MAIN COLUMN — leaderboards + worker rows */}
                  <div style={{ minWidth: 0 }}>
                  {/* Comparative — Team Leaderboards */}
                  {workersList.length >= 2 && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginBottom: 20 }}>
                      {/* Impact leaderboard */}
                      <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: "var(--rt-sh-card)", padding: "14px 16px" }}>
                        <div style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, color: C.textMuted, marginBottom: 8 }}>Impact · last 90 days</div>
                        {sortedByImpact.length === 0 ? (
                          <div style={{ fontSize: 12, color: C.textMuted, fontStyle: "italic" }}>Not enough completed tasks yet</div>
                        ) : sortedByImpact.slice(0, 3).map(({ w, s }, i) => (
                          <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
                            <span style={{ fontSize: 11, color: C.textMuted, fontVariantNumeric: "tabular-nums", width: 14 }}>{i + 1}</span>
                            <span style={{ flex: 1, fontSize: 13, color: C.text, fontWeight: 500 }}>{w.name}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: s.impact >= 70 ? C.success : s.impact >= 40 ? C.text : C.warning, fontVariantNumeric: "tabular-nums" }}>{s.impact}</span>
                          </div>
                        ))}
                      </div>
                      {/* Volume leaderboard */}
                      <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: "var(--rt-sh-card)", padding: "14px 16px" }}>
                        <div style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, color: C.textMuted, marginBottom: 8 }}>Throughput · last 30 days</div>
                        {sortedByVolume.slice(0, 3).map(({ w, s }, i) => (
                          <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
                            <span style={{ fontSize: 11, color: C.textMuted, fontVariantNumeric: "tabular-nums", width: 14 }}>{i + 1}</span>
                            <span style={{ flex: 1, fontSize: 13, color: C.text, fontWeight: 500 }}>{w.name}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums" }}>{s.completed30}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Worker rows */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {workersList.map(w => {
                      const s = statsByWorker[w.id];
                      const initials = getWorkerInitials(w.name);
                      return (
                        <div key={w.id} style={{
                          padding: "16px 18px",
                          background: C.card,
                          border: "1px solid " + C.border,
                          borderRadius: 12,
                          boxShadow: "var(--rt-sh-card)",
                        }}>
                          {/* Top row: avatar + name + impact + remove */}
                          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 20, background: C.primary, color: "#fff", fontSize: 13, fontWeight: 700, display: "grid", placeItems: "center", flexShrink: 0 }}>{initials}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{w.name}</div>
                              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                                {w.email}{w.role ? " · " + w.role : ""}
                              </div>
                            </div>
                            {!s.isBuilding && (
                              <div style={{ textAlign: "right", flexShrink: 0 }}>
                                <div style={{ fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: C.textMuted, fontWeight: 600 }}>Impact</div>
                                <div style={{ fontSize: 22, fontWeight: 700, color: s.impact >= 70 ? C.success : s.impact >= 40 ? C.text : C.warning, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>{s.impact}</div>
                              </div>
                            )}
                            <button
                              onClick={async () => {
                                if (!confirm(`Remove ${w.name}? Their assigned tasks stay assigned for history.`)) return;
                                await workersDb.archive(w.id);
                                setWorkersList(prev => prev.filter(x => x.id !== w.id));
                              }}
                              style={{ width: 28, height: 28, background: "transparent", border: 0, borderRadius: 6, color: C.textMuted, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}
                              title="Remove worker"
                            >
                              <Icon name="x" size={14} />
                            </button>
                          </div>

                          {/* Stats grid */}
                          <div style={{
                            marginTop: 14,
                            paddingTop: 14,
                            borderTop: "1px solid " + C.borderLight,
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                            gap: 12,
                          }}>
                            <Stat
                              label="Pending"
                              value={s.pending}
                              sub={s.overdue > 0 ? `${s.overdue} overdue` : null}
                              tone={s.overdue > 0 ? "danger" : "default"}
                            />
                            <Stat
                              label="Done · 30d"
                              value={s.completed30}
                              sub={`${s.completedAll} all-time`}
                            />
                            <Stat
                              label="On-time · 30d"
                              value={s.onTimeRate30 != null ? `${s.onTimeRate30}%` : "—"}
                              sub={s.onTimeRateAll != null ? `${s.onTimeRateAll}% all-time` : "no data"}
                              tone={s.onTimeRate30 != null && s.onTimeRate30 < 60 ? "warning" : "default"}
                            />
                            <Stat
                              label="Top client"
                              value={s.topClient30 || "—"}
                              sub={s.clientDiversity ? `${s.clientDiversity} client${s.clientDiversity === 1 ? "" : "s"} total` : "no clients yet"}
                              isText
                            />
                          </div>

                          {s.isBuilding && (
                            <div style={{
                              marginTop: 12,
                              padding: "8px 12px",
                              background: C.surfaceWarm,
                              borderRadius: 8,
                              fontSize: 11.5,
                              color: C.textMuted,
                              fontStyle: "italic",
                            }}>
                              Building track record — Impact score appears once {w.name.split(' ')[0]} has completed 5+ tasks.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  </div>
                </div>
              )}
            </div>
          );
        
}
