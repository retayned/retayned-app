// AUTO-EXTRACTED from App.jsx (page === "settings" block) — body is
// verbatim; only the surrounding component shell + imports are generated.
import { Icon } from "../components/Icon";
import { C } from "../theme";
import AgencyTeam from "../components/AgencyTeam";

export default function SettingsPage({ app }) {
  const {
    billing,
    startCheckout,
    switchTrialPlan,
    openBillingPortal,
    clients,
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
    rolodex,
    setAiTasks,
    syncGoogleCalendar,
    userTimezone,
  } = app;
  return (<div>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 16 }}>Settings</h1>

            {/* ── Billing (Jul 2026). Read-only view of the webhook-written
                billing_subscriptions row. Customer-facing name for the
                'agency' plan key is TEAM. Active subscribers get one
                button — Stripe's hosted portal owns card changes, plan
                switches, and cancellation. Founder row (agency/active
                with no Stripe customer) shows a quiet badge. ── */}
            <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 10, padding: "14px 16px", marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 10 }}>Plan &amp; Billing</div>
              {!billing ? (
                <div style={{ fontSize: 13, color: C.textMuted }}>Loading…</div>
              ) : (() => {
                const isFounder = billing.plan === "agency" && billing.status === "active" && !billing.stripe_customer_id;
                const isActive = billing.status === "active" && billing.stripe_subscription_id;
                const trialDaysLeft = Math.max(0, Math.ceil((new Date(billing.trial_ends_at).getTime() - Date.now()) / 86400000));
                const planLabel = billing.plan === "agency" ? "Agency" : billing.plan === "solo" ? "Solo" : "Trial";
                return (
                  <>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{planLabel}</div>
                      <div style={{ fontSize: 12.5, color: C.textMuted }}>
                        {isFounder ? "Full access"
                          : isActive ? (billing.cancel_at_period_end ? "Cancels at period end" : "Active")
                          : billing.status === "past_due" ? "Payment issue — update your card"
                          : billing.plan === "trial" ? (trialDaysLeft > 0 ? `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left in your trial` : "Trial ended")
                          : billing.status}
                      </div>
                    </div>
                    {!isFounder && (
                      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                        {isActive || billing.status === "past_due" ? (
                          <>
                            {/* Active Solo -> visible road to Team. Goes through
                                Stripe's subscription-UPDATE flow (proration,
                                one subscription always) — never a second
                                checkout for an active subscriber. */}
                            {billing.plan === "solo" && isActive && (
                              <button onClick={() => openBillingPortal({ flow: "upgrade" })} className="r-btn" style={{ border: "none", background: C.btn, color: "#fff", borderRadius: 999, padding: "8px 16px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                                Upgrade to Agency — $99/mo
                              </button>
                            )}
                            <button onClick={() => openBillingPortal()} className="r-btn" style={{ border: "1px solid " + C.border, background: "transparent", color: C.text, borderRadius: 999, padding: "8px 16px", fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                              Manage billing
                            </button>
                          </>
                        ) : (
                          <>
                            {billing.status === "trialing" && Number.isFinite(trialDaysLeft) && trialDaysLeft < 3650 && (
                              <div style={{ marginBottom: 10 }}>
                                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#33543E", background: "#E6EFE9", borderRadius: 999, padding: "3px 10px" }}>
                                  Trial · {trialDaysLeft} {trialDaysLeft === 1 ? "day" : "days"} left
                                </span>
                              </div>
                            )}
                            {(() => {
                              // Segmented trial (owner spec): the trial IS solo or
                              // agency. Continue = convert (checkout). The other
                              // button re-segments the trial — no prices here.
                              const intent = billing.intended_plan === "agency" ? "agency" : "solo";
                              const filled = { border: "none", background: C.btn, color: "#fff", borderRadius: 999, padding: "8px 16px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" };
                              const outline = { border: "1.5px solid " + C.btn, background: "transparent", color: C.btn, borderRadius: 999, padding: "8px 16px", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer" };
                              return intent === "solo" ? (
                                <>
                                  <button onClick={() => startCheckout("solo")} className="r-btn" style={filled}>Continue with Solo</button>
                                  <button onClick={() => switchTrialPlan("agency")} className="r-btn" style={outline}>Upgrade to Agency</button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => switchTrialPlan("solo")} className="r-btn" style={outline}>Downgrade to Solo</button>
                                  <button onClick={() => startCheckout("agency")} className="r-btn" style={filled}>Continue with Agency</button>
                                </>
                              );
                            })()}
                            {billing.stripe_customer_id && (
                              <button onClick={openBillingPortal} style={{ border: "none", background: "transparent", color: C.textMuted, fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>
                                Billing history
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Timezone — read-only. The app now auto-syncs to the
                user's device timezone silently on every load and on
                tab visibility change. There is no manual override:
                wherever the user's device says they are IS where
                their day rolls over. This block exists only so the
                user (or support) can verify what the system
                currently thinks the TZ is. */}
            <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 10, padding: "14px 16px", marginBottom: 8 }}>
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
                <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 10, padding: "14px 16px", marginBottom: 8 }}>
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
            <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 10, padding: "14px 16px", marginBottom: 8 }}>
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

            {/* Calendar attribution queue RETIRED (June 2026). The matcher
                re-runs on every 15-minute sync, so the durable fix for an
                unmatched event is renaming it in Google Calendar — that
                propagates to every future instance automatically. A manual
                per-instance linking queue was a band-aid; gated off rather
                than excised so the linking plumbing stays available if we
                ever want it back. */}
            {/* (dead {false &&} block removed — June 2026 refactor: settings attribution queue) */}

            {/* Team — the agency's people layer, moved here from Workers
                (Jul 2026): activation, seats, coverage. Renders nothing
                for solo/trial accounts. */}
            <AgencyTeam app={app} />

            {[{ title: "Account", desc: "Name, email, password" }, { title: "Notifications", desc: "Email alerts, daily digest" }, { title: "Billing", desc: "Plan, payment method, invoices" }].map((s, i) => (
              <div key={i} className="row-hover" style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 10, padding: "14px 16px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div><div style={{ fontSize: 14, fontWeight: 600 }}>{s.title}</div><div style={{ fontSize: 12, color: C.textMuted }}>{s.desc}</div></div>
                <Icon name="chevron" size={16} color={C.border} />
              </div>
            ))}
            {/* Build stamp — diagnostic ground truth. If this stamp is
                missing or stale on a device, that device is running an
                old build; no more guessing about what's live. Bump the
                date suffix on every deploy batch. */}
            <div style={{ textAlign: "center", fontSize: 10.5, color: C.textMuted, padding: "18px 0 6px", letterSpacing: 0.4 }}>
              Retayned · build 2026-06-11.1
            </div>

            {/* (Enterprise Automated Sweep block REMOVED June 2026 — single-tier.) */}
          </div>);
}
