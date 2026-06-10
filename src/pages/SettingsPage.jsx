// AUTO-EXTRACTED from App.jsx (page === "settings" block) — body is
// verbatim; only the surrounding component shell + imports are generated.
import { Icon } from "../components/Icon";
import { sweepData } from "../demoData";
import { clients, rolodex } from "../lib/db.js";
import { supabase } from "../lib/supabase.js";
import { C } from "../theme";

export default function SettingsPage({ app }) {
  const {
    connectGoogleCalendar,
    disconnectGoogleCalendar,
    dismissCalendarEventLink,
    googleConnected,
    googleEmail,
    googleLastSyncedAt,
    googleSyncing,
    linkCalendarEvent,
    personalEvents,
    raiState,
    setAiTasks,
    syncGoogleCalendar,
    tier,
    userTimezone,
  } = app;
  return (<div>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 16 }}>Settings</h1>

            {/* Timezone — read-only. The app now auto-syncs to the
                user's device timezone silently on every load and on
                tab visibility change. There is no manual override:
                wherever the user's device says they are IS where
                their day rolls over. This block exists only so the
                user (or support) can verify what the system
                currently thinks the TZ is. */}
            <div style={{ background: C.card, borderRadius: 10, padding: "14px 16px", marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 10 }}>Timezone</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{userTimezone || "(loading...)"}</div>
              <div style={{ fontSize: 12, color: C.textSec, marginTop: 4 }}>
                {userTimezone ? `Your day rolls over at midnight ${userTimezone.split("/").pop().replace(/_/g, " ")} time. Detected from this device — moves with you.` : ""}
              </div>
            </div>

            {/* Rai — auto-task behavior. When on (default), Rai's daily
                suggestions are added straight to the Today list (marked × Rai).
                Off = no auto-added tasks. Writes rai_user_state.ai_tasks_enabled. */}
            {(() => {
              const aiTasksOn = raiState?.ai_tasks_enabled !== false; // default ON
              const toggle = () => { setAiTasks(!aiTasksOn); };
              return (
                <div style={{ background: C.card, borderRadius: 10, padding: "14px 16px", marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 10 }}>Rai</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>Let Rai add tasks to my day</div>
                      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>When on, Rai adds a few suggested tasks to your Today list each morning, marked × Rai. Delete one and she won't suggest it again.</div>
                    </div>
                    <button
                      onClick={toggle}
                      role="switch"
                      aria-checked={aiTasksOn}
                      style={{ flexShrink: 0, width: 44, height: 26, borderRadius: 999, border: "none", cursor: "pointer", padding: 3, background: aiTasksOn ? C.btn : C.border, transition: "background 160ms ease", display: "flex", alignItems: "center", justifyContent: aiTasksOn ? "flex-end" : "flex-start" }}
                    >
                      <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(20,30,22,0.25)" }} />
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Integrations — real, all-tiers. Currently just Google
                Calendar. This is the permanent home for the connection:
                the Today-page nudge can be dismissed, but this row is
                always here. */}
            <div style={{ background: C.card, borderRadius: 10, padding: "14px 16px", marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 10 }}>Integrations</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <Icon name="calendar" size={16} color={C.textSec} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Google Calendar</div>
                    {googleConnected ? (
                      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>
                        Connected as <span style={{ color: C.text, fontWeight: 500 }}>{googleEmail || "your Google account"}</span>
                        {googleLastSyncedAt && (() => {
                          const ms = Date.now() - new Date(googleLastSyncedAt).getTime();
                          const mins = Math.floor(ms / 60000);
                          const hrs = Math.floor(mins / 60);
                          const label = mins < 1 ? "just now" : mins < 60 ? `${mins}m ago` : hrs < 24 ? `${hrs}h ago` : `${Math.floor(hrs / 24)}d ago`;
                          return <> · last synced {label}</>;
                        })()}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>
                        Show your events alongside tasks on the Today page
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                  {googleConnected && (
                    <button
                      onClick={() => syncGoogleCalendar({ silent: false })}
                      disabled={googleSyncing}
                      style={{
                        padding: "6px 12px",
                        background: "transparent",
                        color: C.textSec,
                        border: "1px solid " + C.borderLight,
                        borderRadius: 7,
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: googleSyncing ? "wait" : "pointer",
                        opacity: googleSyncing ? 0.6 : 1,
                        fontFamily: "inherit",
                      }}
                    >
                      {googleSyncing ? "Syncing…" : "Sync now"}
                    </button>
                  )}
                  <button
                    onClick={googleConnected ? disconnectGoogleCalendar : connectGoogleCalendar}
                    style={{
                      padding: "6px 14px",
                      background: googleConnected ? "transparent" : C.btn,
                      color: googleConnected ? C.textSec : "#fff",
                      border: googleConnected ? "1px solid " + C.borderLight : "none",
                      borderRadius: 7,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {googleConnected ? "Disconnect" : "Connect"}
                  </button>
                </div>
              </div>
            </div>

            {/* Calendar attribution queue. When Google sync runs, events
                whose titles don't match a known client/rolodex name get
                flagged as needs_link. Here we show them as a list with
                quick pickers so the user can attribute them in one pass.
                Linking learns aliases — future events with the same
                tokens auto-match. Only renders when there are queued
                events AND Google is connected; hidden otherwise. */}
            {googleConnected && (() => {
              const needLinking = (personalEvents || []).filter(e =>
                e && e.source === 'google' && e.needs_link && !e.link_dismissed
                && !e.client_id && !e.rolodex_id
              );
              if (needLinking.length === 0) return null;
              // Sort by start time ascending so the most imminent events
              // are at the top of the queue.
              needLinking.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
              return (
                <div style={{ background: C.card, borderRadius: 10, padding: "14px 16px", marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 4 }}>
                    Calendar · attribution queue
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>
                    {needLinking.length} {needLinking.length === 1 ? "event" : "events"} synced from Google but not yet linked to a client or prospect. Link each one below. <span style={{ fontStyle: "italic" }}>Tip: to make future events auto-match, add the person's name to that client's <strong>Contact</strong> field in the Clients tab.</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {needLinking.slice(0, 20).map(ev => {
                      const startMs = new Date(ev.starts_at).getTime();
                      const dayLabel = new Date(ev.starts_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                      const timeLabel = new Date(ev.starts_at).toLocaleTimeString("en-US", { hour: "numeric", minute: new Date(ev.starts_at).getMinutes() ? "2-digit" : undefined }).replace(":00", "");
                      return (
                        <div key={ev.id} style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 12px",
                          background: C.surfaceWarm || "#FAF6EE",
                          borderRadius: 8,
                          border: "1px solid " + C.borderLight,
                        }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.title}</div>
                            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{dayLabel} · {timeLabel}</div>
                          </div>
                          <select
                            defaultValue=""
                            onChange={async (e) => {
                              const val = e.target.value;
                              if (!val) return;
                              const [kind, id] = val.split(":");
                              if (kind === "client") {
                                await linkCalendarEvent({ eventId: ev.id, clientId: id });
                              } else if (kind === "rolodex") {
                                await linkCalendarEvent({ eventId: ev.id, rolodexId: id });
                              } else if (kind === "dismiss") {
                                await dismissCalendarEventLink(ev.id);
                              }
                              e.target.value = "";
                            }}
                            style={{
                              fontFamily: "inherit",
                              fontSize: 12,
                              padding: "6px 10px",
                              border: "1px solid " + C.borderLight,
                              borderRadius: 6,
                              background: "#fff",
                              color: C.text,
                              cursor: "pointer",
                              minWidth: 180,
                            }}
                          >
                            <option value="">Link to…</option>
                            <optgroup label="Clients">
                              {(clients || []).filter(c => c.is_active !== false).slice().sort((a, b) => (a.name || "").localeCompare(b.name || "")).map(c => (
                                <option key={c.id} value={`client:${c.id}`}>{c.name}</option>
                              ))}
                            </optgroup>
                            <optgroup label="Rolodex (prospects)">
                              {(rolodex || []).slice().sort((a, b) => ((a.client || a.name) || "").localeCompare((b.client || b.name) || "")).map(r => (
                                <option key={r.id} value={`rolodex:${r.id}`}>{r.client || r.name}</option>
                              ))}
                            </optgroup>
                            <optgroup label="Other">
                              <option value="dismiss">Not a client — ignore</option>
                            </optgroup>
                          </select>
                        </div>
                      );
                    })}
                    {needLinking.length > 20 && (
                      <div style={{ fontSize: 11, color: C.textMuted, fontStyle: "italic", padding: "4px 12px" }}>
                        + {needLinking.length - 20} more — link the visible ones first, the rest will surface as you work through them.
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {[{ title: "Account", desc: "Name, email, password" }, { title: "Notifications", desc: "Email alerts, daily digest" }, { title: "Team", desc: "Invite members, assign clients" }, { title: "Billing", desc: "Plan, payment method, invoices" }].map((s, i) => (
              <div key={i} className="row-hover" style={{ background: C.card, borderRadius: 10, padding: "14px 16px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div><div style={{ fontSize: 14, fontWeight: 600 }}>{s.title}</div><div style={{ fontSize: 12, color: C.textMuted }}>{s.desc}</div></div>
                <Icon name="chevron" size={16} color={C.border} />
              </div>
            ))}

            {/* Enterprise: Automated Sweep */}
            {tier === "enterprise" && (
              <div style={{ marginTop: 20 }}>
                {/* Sweep Schedule */}
                <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 12 }}>Automated Sweep</div>
                <div style={{ background: C.card, borderRadius: 12, padding: "16px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>Frequency</span>
                      <select style={{ padding: "6px 12px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 6, fontSize: 14, fontFamily: "inherit", background: C.surfaceWarm }}>
                        <option>Daily</option><option>Twice daily</option><option>Weekly (Monday AM)</option>
                      </select>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>Time</span>
                      <select style={{ padding: "6px 12px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 6, fontSize: 14, fontFamily: "inherit", background: C.surfaceWarm }}>
                        <option>6:00 AM</option><option>7:00 AM</option><option>8:00 AM</option><option>9:00 AM</option>
                      </select>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>Timezone</span>
                      <select style={{ padding: "6px 12px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 6, fontSize: 14, fontFamily: "inherit", background: C.surfaceWarm }}>
                        <option>Eastern</option><option>Central</option><option>Mountain</option><option>Pacific</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ marginTop: 12, fontSize: 12, color: C.textMuted }}>Last sweep: Today at 6:02 AM · {sweepData.clients_analyzed} clients</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>Next sweep: Tomorrow at 6:00 AM</div>
                  <button className="r-btn" data-tone="purple" style={{ width: "100%", marginTop: 12, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Run Sweep Now</button>
                </div>

                {/* Output Routing */}
                <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 12, marginTop: 20 }}>Output Routing</div>
                <div style={{ background: C.card, borderRadius: 12, padding: "16px" }}>
                  {[
                    { label: "Retayned Dashboard", checked: true, disabled: true, meta: "Always on" },
                    { label: "Slack Channel", checked: false, meta: "#retention-alerts" },
                    { label: "Webhook URL", checked: false, meta: "https://..." },
                    { label: "Email Digest", checked: false, meta: "team@company.com" },
                  ].map((r, ri) => (
                    <div key={ri} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: ri < 3 ? "1px solid " + C.borderLight : "none" }}>
                      <input type="checkbox" checked={r.checked} disabled={r.disabled} readOnly style={{ width: 16, height: 16 }} />
                      <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{r.label}</span>
                      <span style={{ fontSize: 12, color: C.textMuted }}>{r.meta}</span>
                    </div>
                  ))}
                </div>

                {/* API Access */}
                <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 12, marginTop: 20 }}>API Access</div>
                <div style={{ background: C.card, borderRadius: 12, padding: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>API Key</div>
                      <div style={{ fontSize: 12, color: C.textMuted }}>Use this key to authenticate API requests</div>
                    </div>
                    <button className="r-btn" data-tone="purple" style={{ padding: "6px 14px", background: C.btn, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Regenerate</button>
                  </div>
                  <div style={{ background: C.bg, borderRadius: 8, padding: "10px 14px", fontFamily: "monospace", fontSize: 12, color: C.textSec, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>sk_live_ret_••••••••••••••••••••a4f2</span>
                    <button style={{ background: "none", border: "none", fontSize: 12, color: C.primary, cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>Copy</button>
                  </div>

                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 16, marginBottom: 10 }}>Endpoints</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[
                      { method: "GET", path: "/api/sweeps/latest", desc: "Most recent sweep results" },
                      { method: "POST", path: "/api/sweeps/trigger", desc: "Run a sweep now" },
                      { method: "GET", path: "/api/clients/{id}/signals", desc: "Client automated analysis" },
                      { method: "GET", path: "/api/tasks", desc: "All open tasks" },
                      { method: "PATCH", path: "/api/tasks/{id}", desc: "Mark task complete" },
                      { method: "POST", path: "/api/clients/{id}/analyze", desc: "Trigger analysis on one client" },
                      { method: "GET", path: "/api/referrals/readiness", desc: "Referral readiness ranking" },
                    ].map((ep, ei) => (
                      <div key={ei} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: C.bg, borderRadius: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace", padding: "2px 6px", borderRadius: 3, background: ep.method === "GET" ? C.primarySoft : ep.method === "POST" ? "#EDE9FE" : "#FEF3C7", color: ep.method === "GET" ? C.primary : ep.method === "POST" ? C.btn : "#92400E" }}>{ep.method}</span>
                        <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 600, flex: 1 }}>{ep.path}</span>
                        <span style={{ fontSize: 12, color: C.textMuted }}>{ep.desc}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 16, marginBottom: 10 }}>Webhook Payload</div>
                  <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>On every sweep completion, the configured webhook receives the full output schema:</p>
                  <div style={{ background: "#1E261F", borderRadius: 8, padding: "14px", fontFamily: "monospace", fontSize: 11, color: "#A7C4B5", lineHeight: 1.6, overflow: "auto", maxHeight: 200 }}>
                    <div style={{ color: "#558B68" }}>{"// POST to your webhook URL"}</div>
                    <div>{"{"}</div>
                    <div style={{ paddingLeft: 16 }}>{'"sweep_id": "sweep_20260409",'}</div>
                    <div style={{ paddingLeft: 16 }}>{'"timestamp": "2026-04-09T06:02:00Z",'}</div>
                    <div style={{ paddingLeft: 16 }}>{'"portfolio_avg_score": 74,'}</div>
                    <div style={{ paddingLeft: 16 }}>{'"clients_analyzed": 47,'}</div>
                    <div style={{ paddingLeft: 16 }}>{'"alerts": [{ "client_id": "...", "level": "critical" }],'}</div>
                    <div style={{ paddingLeft: 16 }}>{'"tasks": [{ "client_id": "...", "action": "..." }],'}</div>
                    <div style={{ paddingLeft: 16 }}>{'"priority_ranking": [{ "client_id": "...", "score": 91, "drift": 2 }],'}</div>
                    <div style={{ paddingLeft: 16 }}>{'"data_gaps": [{ "client_id": "...", "missing": ["billing"] }]'}</div>
                    <div>{"}"}</div>
                  </div>
                </div>

                {/* MCP Server */}
                <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 12, marginTop: 20 }}>MCP Server</div>
                <div style={{ background: C.card, borderRadius: 12, padding: "16px" }}>
                  <p style={{ fontSize: 14, color: C.text, lineHeight: 1.5, marginBottom: 12 }}>Expose Retayned as a tool server for your AI agents. Any MCP-compatible agent can connect and call Retayned tools directly.</p>
                  
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "10px 14px", background: C.bg, borderRadius: 8 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted }}>Server URL</div>
                      <div style={{ fontSize: 12, fontFamily: "monospace", color: C.text, marginTop: 2 }}>https://mcp.retayned.com/v1/your-org-id</div>
                    </div>
                    <button style={{ background: "none", border: "none", fontSize: 12, color: C.primary, cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>Copy</button>
                  </div>

                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Available Tools</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {[
                      { tool: "get_priority_ranking", desc: "Full client portfolio ranked by retention score" },
                      { tool: "get_client_risk_assessment", desc: "Single client signals, archetype, and Rai summary" },
                      { tool: "get_open_tasks", desc: "All pending tasks with priority and context" },
                      { tool: "complete_task", desc: "Mark a task as done" },
                      { tool: "trigger_sweep", desc: "Run an immediate portfolio analysis" },
                      { tool: "get_referral_readiness", desc: "Clients ranked by referral readiness" },
                      { tool: "get_sweep_history", desc: "Historical sweep results and trends" },
                    ].map((t, ti) => (
                      <div key={ti} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: C.bg, borderRadius: 6 }}>
                        <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 700, color: C.btn }}>{t.tool}</span>
                        <span style={{ fontSize: 12, color: C.textMuted, flex: 1 }}>{t.desc}</span>
                      </div>
                    ))}
                  </div>

                  {/* Sign Out */}
            <button onClick={async () => { await supabase.auth.signOut(); }} style={{ width: "100%", padding: "14px", background: "transparent", border: "1.5px solid " + C.danger + "44", borderRadius: 10, fontSize: 14, fontWeight: 600, color: C.danger, cursor: "pointer", fontFamily: "inherit", marginBottom: 16 }}>Sign Out</button>

            <div style={{ background: C.raiGrad, borderRadius: 12, padding: "14px 16px", color: "#fff", marginTop: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", color: "rgba(255,255,255,.4)", marginBottom: 6 }}>Coming Soon</div>
                    <p style={{ fontSize: 14, lineHeight: 1.55, color: "rgba(255,255,255,.7)" }}>Your AI agents will be able to connect to Retayned the same way Rai connects to Slack and HubSpot. Retention intelligence as a tool, not just a dashboard.</p>
                  </div>
                </div>
              </div>
            )}
          </div>);
}
