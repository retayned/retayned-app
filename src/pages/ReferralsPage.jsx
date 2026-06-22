// AUTO-EXTRACTED from App.jsx (page === "referrals" block) — body is
// verbatim; only the surrounding component shell + imports are generated.
import { Icon } from "../components/Icon";
import { ReferralNetworkD3 } from "../components/ReferralNetworkD3";
import { EmptyState } from "../components/Skeletons";
import { C } from "../theme";
import { retGradient } from "../utils";

export default function ReferralsPage({ app }) {
  const {
    addRef,
    askActed,
    askActiveId,
    askDraft,
    askTone,
    clients,
    dataLoaded,
    isMobile,
    networkAsOf,
    refForm,
    refFrom,
    refName,
    refs,
    rolodex,
    setAskActed,
    setAskActiveId,
    setAskDraft,
    setAskTone,
    setNetworkAsOf,
    setPage,
    setRefEditData,
    setRefEditing,
    setRefForm,
    setRefFrom,
    setRefName,
    setRefRevenue,
    setShowAddClient,
    setShowAddRolodex,
    user,
  } = app;

          try {
          // ─── Helpers ───────────────────────────────────────────────────
          const AVATAR_COLORS = ["#1F7A5C"];
          const getInitials = (name) => (name || "?").split(/\s+/).map(w => w[0]).filter(Boolean).join("").slice(0, 2).toUpperCase();
          const getAvatarColor = (id) => { const s = String(id || ""); let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return AVATAR_COLORS[h % AVATAR_COLORS.length]; };
          // Avatar — score-driven retention gradient (matches Today task page).
          // Looks up the client by name to pull their actual retention score.
          // For non-client referrals (referred-to people who didn't convert),
          // falls back to a neutral mid-tone gradient.
          const Avatar = ({ id, name, size = 32 }) => {
            const c = clients.find(x => x.name === name);
            const ret = c ? (c.ret || 60) : 60;
            return (
              <div style={{ width: size, height: size, borderRadius: size / 2, flexShrink: 0, background: retGradient(ret), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.32, fontWeight: 700, letterSpacing: 0.2, boxShadow: "var(--rt-sh-xs)" }}>{getInitials(name)}</div>
            );
          };

          // ─── Aggregates ─────────────────────────────────────────────────
          const totalRefs = refs.length;
          const activeRefs = refs.filter(r => r.status === "converted" || (r.converted && r.status !== "closed"));
          const becameClients = activeRefs.length;
          const mrrAdded = activeRefs.reduce((a, r) => a + (r.revenue || 0), 0);
          const avgTenureMo = clients.length ? clients.reduce((a, c) => a + (c.months || 0), 0) / clients.length : 24;
          const projLCV = Math.round(mrrAdded * Math.max(12, avgTenureMo));

          // ─── Ask-next scoring algorithm ─────────────────────────────────
          // 6-factor weighted, bell curves for Comm Freq + Stress Response.
          // Profile scores are 1-10 per dimension. Missing = treat as 5 (neutral).
          //   Loyalty 30% · Depth 30% · Decision Making 10% · Comm Tone 10% ·
          //   Comm Frequency 10% (bell) · Stress Response 10% (bell)
          const bellScore = (v) => {
            // Peak at 5 → 100. Distance from 5 penalizes linearly.
            // 5=100, 4|6=80, 3|7=60, 2|8=40, 1|9=20, 0|10=0
            if (v == null) return 50;
            const d = Math.abs(5 - v);
            return Math.max(0, 100 - d * 20);
          };
          const linearScore = (v) => {
            // Higher = better. 1→10, 10→100
            if (v == null) return 50;
            return Math.max(0, Math.min(100, v * 10));
          };
          const calcAskScore = (client) => {
            const p = client.profile_scores || client.profile || {};
            const loyalty = linearScore(p.loyalty);
            const depth = linearScore(p.relationship_depth ?? p.depth);
            const decision = linearScore(p.decision_making ?? p.decisionMaking);
            const tone = linearScore(p.communication_tone ?? p.commTone);
            const freq = bellScore(p.communication_frequency ?? p.commFrequency);
            const stress = bellScore(p.stress_response ?? p.stressResponse);
            const score = loyalty * 0.30 + depth * 0.30 + decision * 0.10 + tone * 0.10 + freq * 0.10 + stress * 0.10;
            return Math.round(score);
          };

          // Build ask queue: clients who haven't been referral sources AND haven't been acted on.
          // Rank by score. Keep top 3 (per design).
          const referredFrom = new Set(refs.map(r => r.from));
          const askQueue = [...clients]
            .filter(c => !referredFrom.has(c.name) && !askActed.has(c.name))
            .map(c => ({ ...c, askScore: calcAskScore(c) }))
            .filter(c => c.askScore >= 55) // signal threshold
            .sort((a, b) => b.askScore - a.askScore)
            .slice(0, 3);

          // Strength label from score
          const strengthFor = (score) => score >= 80 ? { label: "STRONG", color: C.retGood, bg: "#E8F3EC" } : { label: "MEDIUM", color: C.retOk, bg: "#F6F4E5" };

          // Primer text — Rai-generated in production; for now use rules-based primers keyed off strongest signal.
          // In a future pass, these get pulled from rai_ask_primers table populated by the monthly sweep.
          const getPrimer = (client) => {
            const p = client.profile_scores || client.profile || {};
            const loyalty = p.loyalty || 5;
            const depth = p.relationship_depth ?? p.depth ?? 5;
            if (loyalty >= 8 && depth >= 8) return "They're vocal fans and know you deeply — this is as ripe as an ask gets.";
            if (loyalty >= 8) return "Strong loyalty. They'll want to help even if the relationship is still building.";
            if (depth >= 8) return "Deep relationship. They understand your value enough to describe it to someone else.";
            if ((client.ret || 0) >= 85) return "Their health has held elite for months. Predictable thrivers make reliable asks.";
            return "Signals look right. Timing matters more than the script here.";
          };

          // Active ask — selected from queue OR any client (for network-graph
          // click-throughs). When a user clicks a referrer/child in the network
          // map, that client may not be in askQueue (e.g., they've already
          // referred someone). Fall through to the full clients list so the
          // composer can still populate with their info.
          const activeAsk = (() => {
            if (askActiveId) {
              const fromQueue = askQueue.find(c => c.name === askActiveId);
              if (fromQueue) return fromQueue;
              const fromClients = clients.find(c => c.name === askActiveId);
              if (fromClients) return { ...fromClients, askScore: calcAskScore(fromClients) };
            }
            return askQueue[0];
          })();

          // Tone-shifted draft template
          const buildDraft = (client, tone) => {
            if (!client) return "";
            const firstName = (client.contact || client.name).split(/\s+/)[0];
            // Sign-off uses the user's actual first name from their profile.
            const userFullName = user?.user_metadata?.full_name || "";
            const userFirst = userFullName.trim().split(/\s+/)[0] || "";
            const signoff = userFirst || "[Your Name]";
            if (tone === "softer") {
              return `Hi ${firstName},\n\nHope you're doing well. I've been thinking about who in your network might benefit from what we do together — no pressure at all. If anyone comes to mind, I'd love an intro. If not, no worries.\n\nAppreciate you either way.\n\n${signoff}`;
            } else if (tone === "firmer") {
              return `Hi ${firstName},\n\nQuick ask: who are 2-3 people in your network who'd benefit from what we've built together? I'm looking to take on one or two more clients like you this quarter, and the best ones always come from intros.\n\nHappy to write the first email so you just forward it.\n\n${signoff}`;
            }
            return `Hi ${firstName},\n\nI'm reaching out because clients like you are my best source of new work. If anyone in your network could use what we do, I'd love an introduction — even a quick "here's someone worth a call" email works.\n\nNo rush. Just know the door's open.\n\n${signoff}`;
          };

          // Draft shown in textarea: user's edits take priority; otherwise compute from active + tone.
          // This avoids setState-in-render while still showing a populated draft by default.
          const draftIsUserEdited = askDraft && askActiveId === activeAsk?.name;
          const displayedDraft = draftIsUserEdited ? askDraft : (activeAsk ? buildDraft(activeAsk, askTone) : "");

          const markAsked = (client) => {
            const next = new Set(askActed);
            next.add(client.name);
            setAskActed(next);
            try { localStorage.setItem("rt-ask-acted", JSON.stringify(Array.from(next))); } catch {}
            setAskActiveId(null);
            setAskDraft("");
          };

          // ─── Network Map data ────────────────────────────────────────────
          // Referrers = clients who have sent at least one referral.
          // Build: { id, name, revenue, children: [{ id, name, mrr, status }] }
          //
          // Bug fix May 2026: the hydrated ref object has `to` (mapped from DB
          // column `referred_to`), not `name`. Reading r.name fell through to
          // "Untitled" for every saved referral. Order is r.to → r.name → fallback.
          const referrerMap = {};
          refs.forEach(r => {
            const fromName = r.from || "Unknown";
            if (!referrerMap[fromName]) referrerMap[fromName] = { id: fromName, name: fromName, revenue: 0, children: [] };
            const childName = r.to || r.name || null;
            referrerMap[fromName].children.push({
              id: r.id || "ref-" + Math.random().toString(36).slice(2, 8),
              name: childName,
              hasName: !!childName,
              mrr: r.revenue || 0,
              totalRevenue: r.totalRevenue || r.total_revenue || 0,
              status: r.status || "pending",
              on: r.on || r.date,
            });
            referrerMap[fromName].revenue += (r.revenue || 0);
          });
          const referrers = Object.values(referrerMap);

          // ─── Render ─────────────────────────────────────────────────────
          return (
            <div style={{ width: "100%" }}>
              {dataLoaded && totalRefs === 0 && (
                <>
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "4px 4px 20px", marginBottom: 20, borderBottom: "1px solid " + C.borderLight, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                      <div style={{ fontSize: 11.5, color: C.textMuted, letterSpacing: 0.3, marginBottom: 4 }}>Word of mouth · this quarter</div>
                      <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: -0.4, color: C.text }}>Referrals</h1>
                    </div>
                  </div>
                  <EmptyState
                    icon="referrals"
                    headline="No referrals tracked yet."
                    body="Log who sent you to whom and Retayned starts surfacing your quiet sources — the clients quietly compounding your book without ever being asked."
                    cta={{ label: "Log Referral", onClick: () => setRefForm(true) }}
                  />
                </>
              )}
              {dataLoaded && totalRefs > 0 && (<>
              {/* STATUS BAND */}
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "4px 4px 20px", marginBottom: 20, borderBottom: "1px solid " + C.borderLight, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                  <div style={{ fontSize: 11.5, color: C.textMuted, letterSpacing: 0.3, marginBottom: 4 }}>Word of mouth · this quarter</div>
                  <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: -0.4, color: C.text }}>Referrals</h1>
                  {/* Subhead carries volume + outcome only. The $
                      stats (MRR added, projected LCV) moved into the
                      "Revenue from referrals" rail card below — they
                      fought the subhead's editorial tone and pulled
                      the eye away from the title. */}
                  <div style={{ fontSize: 13.5, color: C.textMuted, marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span><b style={{ color: C.text, fontWeight: 700 }}>{totalRefs}</b> referrals</span>
                    <span className="rt-sep" />
                    <span><b style={{ color: C.text, fontWeight: 700 }}>{becameClients}</b> became clients</span>
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <button className="r-btn" data-tone="green" onClick={() => setRefForm(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                    Log Referral
                  </button>
                </div>
              </div>

              {/* Mobile-only Revenue from referrals card — desktop renders
                  this same card in the .rc-rail (hidden on mobile).
                  Same content, same styles; the wrapper class toggles
                  visibility by breakpoint. Renders only when at least
                  one referral has converted, matching the desktop gate. */}
              {becameClients > 0 && (
                <div className="rt-refs-money-mobile">
                  <div style={{
                    background: C.card,
                    borderRadius: 12,
                    boxShadow: "var(--rt-sh-card)",
                    padding: 16,
                    border: "1px solid " + C.border,
                  }}>
                    <div style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 12 }}>
                      Revenue from referrals
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4, lineHeight: 1 }}>
                      <span style={{ fontSize: 28, fontWeight: 800, color: C.retGood, letterSpacing: -0.6, fontVariantNumeric: "tabular-nums" }}>
                        ${mrrAdded.toLocaleString()}
                      </span>
                      <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 600 }}>/mo</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 4 }}>
                      Added MRR · this quarter
                    </div>
                    {(projLCV > 0 || becameClients > 0) && (
                      <>
                        <div style={{ height: 1, background: C.borderLight, margin: "14px 0 12px" }} />
                        {projLCV > 0 && (
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, fontSize: 12.5, color: C.textSec }}>
                            <span>Projected LCV</span>
                            <b style={{ color: C.text, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>${projLCV.toLocaleString()}</b>
                          </div>
                        )}
                        {becameClients > 0 && (
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 12.5, color: C.textSec }}>
                            <span>Avg deal size</span>
                            <b style={{ color: C.text, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>${Math.round(mrrAdded / becameClients).toLocaleString()}/mo</b>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* MAIN GRID: rail + main + rai (rai shows on >=1440px) */}
              <div className="rc-grid" style={{ display: "grid", gap: 20, alignItems: "start" }}>

                {/* LEFT RAIL: Money earned + Who to ask next + Compounding */}
                <div className="rc-rail" style={{ display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 0, alignSelf: "start" }}>
                  {/* Revenue from referrals — relocated from band subhead.
                      Leads with MRR in brand green, projected LCV +
                      avg deal size as secondary rows below. Subtle
                      ghost-green gradient surface so the card reads
                      as "money outcome" without competing with the
                      neighboring rail cards. Hidden if no referrals
                      converted yet (becameClients === 0) — the empty
                      state lives elsewhere on the page. */}
                  {becameClients > 0 && (
                    <div style={{
                      background: C.card,
                      borderRadius: 12,
                      boxShadow: "var(--rt-sh-card)",
                      padding: 16,
                      border: "1px solid " + C.border,
                    }}>
                      <div style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 12 }}>
                        Revenue from referrals
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 4, lineHeight: 1 }}>
                        <span style={{ fontSize: 28, fontWeight: 800, color: C.retGood, letterSpacing: -0.6, fontVariantNumeric: "tabular-nums" }}>
                          ${mrrAdded.toLocaleString()}
                        </span>
                        <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 600 }}>/mo</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 4 }}>
                        Added MRR · this quarter
                      </div>
                      {(projLCV > 0 || becameClients > 0) && (
                        <>
                          <div style={{ height: 1, background: C.borderLight, margin: "14px 0 12px" }} />
                          {projLCV > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, fontSize: 12.5, color: C.textSec }}>
                              <span>Projected LCV</span>
                              <b style={{ color: C.text, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>${projLCV.toLocaleString()}</b>
                            </div>
                          )}
                          {becameClients > 0 && (
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 12.5, color: C.textSec }}>
                              <span>Avg deal size</span>
                              <b style={{ color: C.text, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>${Math.round(mrrAdded / becameClients).toLocaleString()}/mo</b>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Compounding ribbon — who's sent the most revenue */}
                  {referrers.length > 0 && (() => {
                    const sorted = [...referrers].sort((a, b) => b.revenue - a.revenue);
                    const max = Math.max(1, ...sorted.map(r => r.revenue));
                    return (
                      <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: "var(--rt-sh-card)", padding: "14px" }}>
                        <div style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>Who's compounding</div>
                        <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 3, marginBottom: 12 }}>Revenue through each client's referrals</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {sorted.map(r => {
                            const pct = (r.revenue / max) * 100;
                            // Match by name to pull real retention score for the avatar
                            // gradient — same look as Today task page chips.
                            const matchedClient = clients.find(c => c.name === r.name);
                            const avRet = matchedClient ? (matchedClient.ret || 60) : 60;
                            const initials = r.name.split(/\s+/).slice(0, 2).map(s => s[0] || "").join("").toUpperCase();
                            return (
                              <div key={r.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                                    <div style={{ width: 18, height: 18, borderRadius: 9, background: retGradient(avRet), color: "#fff", fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "var(--rt-sh-xs)" }}>{initials}</div>
                                    <span style={{ fontSize: 11.5, color: C.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                                  </div>
                                  <span style={{ fontSize: 11, color: C.text, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>${r.revenue.toLocaleString()}/mo</span>
                                </div>
                                <div style={{ height: 4, background: C.borderLight, borderRadius: 2, overflow: "hidden" }}>
                                  <div style={{ width: pct + "%", height: "100%", background: C.text, borderRadius: 2 }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Who to ask next */}
                  <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: "var(--rt-sh-card)", overflow: "hidden" }}>
                    <div className="rt-divider-inset" style={{ padding: "12px 14px 10px" }}>
                      <div style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>Who to ask next</div>
                      <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 3 }}>Strongest signals first</div>
                    </div>
                    {askQueue.length === 0 ? (
                      <div style={{ padding: "20px 14px", textAlign: "center" }}>
                        <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.5 }}>No strong referral asks right now.</div>
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>Build deeper profiles on your clients to unlock new asks.</div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        {askQueue.map((q, i) => {
                          const isActive = activeAsk?.name === q.name;
                          const st = strengthFor(q.askScore);
                          return (
                            <button key={q.name} onClick={() => { setAskActiveId(q.name); setAskDraft(""); }} className={"rt-soft-row" + (isActive ? " is-active" : "") + (i === askQueue.length - 1 ? "" : " rt-divider-inset")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", border: "none", borderLeft: isActive ? "3px solid " + C.primary : "3px solid transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left", ...(isActive ? { background: C.primarySoft } : {}) }}>
                              <div style={{ width: 30, height: 30, borderRadius: 15, background: retGradient(q.ret || 0), color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "var(--rt-sh-xs)" }}>{q.name.split(/\s+/).slice(0, 2).map(s => s[0] || "").join("").toUpperCase()}</div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12.5, color: C.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.name}</div>
                                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Score {q.askScore} · {q.months || 0}mo tenure</div>
                              </div>
                              <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 3, letterSpacing: 0.3, whiteSpace: "nowrap", flexShrink: 0, color: q.askScore >= 80 ? "#fff" : C.textSec, background: q.askScore >= 80 ? C.retGood : C.borderLight }}>{st.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* MAIN COLUMN */}
                <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>

                  {/* NETWORK MAP — d3-force live simulation */}
                  <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 14, boxShadow: "var(--rt-sh-card)", padding: "18px 20px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12, gap: 16, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>Referral Network</div>
                        <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 3 }}>Live — click any node to drill in</div>
                      </div>
                      <div style={{ display: "flex", gap: 14, fontSize: 10.5, color: C.textMuted, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 4, background: C.retGood }} />Converted
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 4, background: "#D17A1B" }} />Pending
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 4, background: C.textMuted }} />Lost
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 5, background: "var(--rt-grad-btn)", boxShadow: "0 0 0 2px rgba(124,92,243,0.16)" }} />Likely
                        </span>
                      </div>
                    </div>

                    {referrers.length === 0 ? (
                      <div style={{ padding: "60px 20px", textAlign: "center", color: C.textMuted }}>
                        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>No referrals yet.</div>
                        <div style={{ fontSize: 12 }}>Log your first one to start building the network.</div>
                      </div>
                    ) : (() => {
                      // Compute predicted referrers — clients who haven't referred
                      // anyone but score high on the same dimensions calcAskScore
                      // uses for the "ask for a referral" rubric. Filter out
                      // anyone already in the referrer set.
                      const existingReferrerNames = new Set(referrers.map(r => r.name));
                      const predicted = clients
                        // Must have a real name — empty/whitespace names render as
                        // "? add name" placeholders in the graph and clutter the
                        // network with anonymous ASK ghosts.
                        .filter(c => c.name && c.name.trim().length > 0)
                        .filter(c => !existingReferrerNames.has(c.name))
                        .map(c => ({ ...c, askScore: calcAskScore(c) }))
                        .filter(c => c.askScore >= 60)
                        .sort((a, b) => b.askScore - a.askScore)
                        .slice(0, 4)
                        .map(c => ({
                          id: c.id,
                          name: c.name,
                          reason: (() => {
                            const p = c.profile_scores || c.profile || {};
                            const tags = [];
                            if ((p.loyalty || 0) >= 8) tags.push("high loyalty");
                            if ((p.relationship_depth || 0) >= 8) tags.push("deep relationship");
                            return tags.join(", ") || "strong overall signals";
                          })(),
                        }));

                      const handleNodeClick = (payload) => {
                        // Network click target — find the matching client
                        // by name and set as the composer's active ask.
                        // Works for: existing client referrers, child nodes
                        // that map to a client in our list, and ASK ghosts
                        // (predicted referrers, always a client). The
                        // composer's activeAsk lookup falls through to
                        // clients[] so anyone here lands cleanly.
                        const targetName = payload.data?.name;
                        if (!targetName) return;
                        const matchedClient = clients.find(c => c.name === targetName);
                        if (matchedClient) {
                          setAskActiveId(targetName);
                          setAskDraft("");
                          // Scroll the composer card into view so it's obvious
                          // the click took effect.
                          setTimeout(() => {
                            const composerEl = document.getElementById("ask-composer");
                            if (composerEl) composerEl.scrollIntoView({ behavior: "smooth", block: "start" });
                          }, 0);
                          return;
                        }
                        // No matching client (e.g. a referred-to person who
                        // never became a client). Fall back to the old
                        // behavior: open the referral row for editing if it
                        // exists, else scroll to log.
                        if (payload.kind === "child" && payload.data.status !== "ask") {
                          const refId = payload.data.id;
                          const r = refs.find(x => x.id === refId);
                          if (r) {
                            setRefEditData({ to: r.to, from: r.from, status: r.status, converted: r.converted, revenue: r.revenue, totalRevenue: r.totalRevenue });
                            setRefEditing(refId);
                            return;
                          }
                        }
                        const logEl = document.getElementById("ref-log");
                        if (logEl) logEl.scrollIntoView({ behavior: "smooth", block: "start" });
                      };

                      return (
                        <>
                          <ReferralNetworkD3
                            referrers={referrers}
                            predictedReferrers={predicted}
                            asOfDate={networkAsOf}
                            onNodeClick={handleNodeClick}
                            C={C}
                            getAvatarColor={getAvatarColor}
                            getInitials={getInitials}
                            isMobile={isMobile}
                          />

                          {/* Time-as-of slider — drag to see the network grow.
                              Range = earliest referral to today. Default = today (latest).
                              Off when there are fewer than 3 referrals (no meaningful range). */}
                          {(() => {
                            const allDates = refs.map(r => r.date || r.on).filter(Boolean).map(d => new Date(d).getTime()).filter(t => Number.isFinite(t));
                            if (allDates.length < 3) return null;
                            const maxMs = Date.now();
                            // Junk-date guard: a single malformed referral date
                            // (e.g. parsed as 2001) made the range start decades
                            // back, cramming all real data into the last sliver
                            // of the slider. Floor the range at 2015; if nothing
                            // sane remains, fall back to one year back. Also
                            // guarantee a non-zero range.
                            const saneFloor = new Date("2015-01-01").getTime();
                            const saneDates = allDates.filter(t => t >= saneFloor);
                            let minMs = saneDates.length ? Math.min(...saneDates) : maxMs - 365 * 86400000;
                            if (minMs >= maxMs) minMs = maxMs - 30 * 86400000;
                            const curMs = networkAsOf ? new Date(networkAsOf).getTime() : maxMs;
                            const pct = ((curMs - minMs) / (maxMs - minMs)) * 100;
                            const fmt = (ms) => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
                            return (
                              <div style={{ marginTop: 14, padding: "10px 12px", background: C.bg, borderRadius: 10 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, fontSize: 11, color: C.textMuted }}>
                                  <span style={{ fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase" }}>Time travel</span>
                                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{networkAsOf ? `Showing as of ${fmt(curMs)}` : `Today (${fmt(maxMs)})`}</span>
                                </div>
                                <input
                                  type="range"
                                  min={minMs}
                                  max={maxMs}
                                  value={curMs}
                                  onChange={(e) => {
                                    const v = parseInt(e.target.value, 10);
                                    setNetworkAsOf(v >= maxMs - 86400000 ? null : new Date(v).toISOString());
                                  }}
                                  style={{ width: "100%", accentColor: C.primary }}
                                />
                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2, fontSize: 10, color: C.textMuted, fontVariantNumeric: "tabular-nums" }}>
                                  <span>{fmt(minMs)}</span>
                                  <span>now</span>
                                </div>
                              </div>
                            );
                          })()}
                        </>
                      );
                    })()}
                  </div>

                  {/* ASK DRAFT CARD */}
                  {activeAsk && (
                    <div id="ask-composer" style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 14, boxShadow: "var(--rt-sh-card)", padding: "16px 18px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 10, flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, letterSpacing: -0.2 }}>Ask {activeAsk.name}</div>
                          <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 4, display: "inline-flex", alignItems: "center", gap: 5 }}>
                            <span style={{ color: C.btn, fontSize: 12, lineHeight: 1, display: "inline-flex", alignItems: "center" }}>✦</span>
                            Score {activeAsk.askScore} · {(() => { const p = activeAsk.profile_scores || {}; const pieces = []; if ((p.loyalty || 0) >= 8) pieces.push("high loyalty"); if ((p.relationship_depth || 0) >= 8) pieces.push("deep relationship"); return pieces.join(" · ") || "strong composite signals"; })()}
                          </div>
                        </div>
                        {/* Tone toggle — matches rc-view-toggle pattern from
                            Clients page (Table/Columns/Heatmap). Active state:
                            embossed white card + card-lift shadow + slight lift.
                            Idle state: transparent, hover darkens text. */}
                        <div className="rc-view-toggle" style={{ display: "inline-flex", gap: 2, padding: 2, background: C.surface, borderRadius: 8 }}>
                          {["softer", "neutral", "firmer"].map(t => {
                            const isActive = askTone === t;
                            return (
                              <button key={t} onClick={() => { setAskTone(t); setAskDraft(""); }} style={{
                                padding: "5px 12px", fontSize: 12, borderRadius: 6, textTransform: "capitalize",
                                border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: isActive ? 600 : 500,
                                transition: "background 160ms var(--rt-ease-out), box-shadow 160ms var(--rt-ease-out)",
                                ...(isActive
                                  ? { background: C.card, color: C.text, boxShadow: "var(--rt-sh-xs)" }
                                  : { background: "transparent", color: C.textMuted }),
                              }}>{t}</button>
                            );
                          })}
                        </div>
                      </div>
                      {/* Editable draft. minHeight fits softer/neutral
                          drafts without much trailing whitespace; firmer
                          (longest) gets a scrollbar only when needed.
                          overflow: auto so content is never clipped. */}
                      <textarea
                        value={displayedDraft}
                        onChange={e => { setAskDraft(e.target.value); if (activeAsk) setAskActiveId(activeAsk.name); }}
                        style={{ width: "100%", minHeight: 210, padding: "12px 14px", borderRadius: 10, fontSize: 13, fontFamily: "inherit", background: C.bg, outline: "none", resize: "vertical", lineHeight: 1.55, color: C.text, boxSizing: "border-box", marginBottom: 12, whiteSpace: "pre-wrap", overflow: "auto", border: "none" }}
                      />
                      {/* Action row */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <a className="rt-composer-pill" href={`mailto:${activeAsk.email || ""}?subject=${encodeURIComponent("Quick ask")}&body=${encodeURIComponent(displayedDraft)}`} onClick={() => markAsked(activeAsk)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 11px", background: C.card, border: "none", borderRadius: 7, fontSize: 11.5, color: C.textSec, fontWeight: 500, cursor: "pointer", textDecoration: "none", boxShadow: "var(--rt-sh-xs)" }}>
                            <Icon name="mail" size={13} color={C.textSec} />
                            <span>Email</span>
                          </a>
                          <a className="rt-composer-pill" href={`sms:${activeAsk.phone || ""}?body=${encodeURIComponent(displayedDraft)}`} onClick={() => markAsked(activeAsk)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 11px", background: C.card, border: "none", borderRadius: 7, fontSize: 11.5, color: C.textSec, fontWeight: 500, cursor: "pointer", textDecoration: "none", boxShadow: "var(--rt-sh-xs)" }}>
                            <Icon name="phone" size={13} color={C.textSec} />
                            <span>Text</span>
                          </a>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="r-btn" data-tone="green" onClick={() => markAsked(activeAsk)} style={{ padding: "8px 18px", fontSize: 12.5, color: "#fff", borderRadius: 8, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit" }}>Mark Asked</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* REFERRAL LOG (compact) */}
                  <div id="ref-log">
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "0 4px 10px" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: C.textMuted }}>Log</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, padding: "1px 8px", background: C.borderLight, borderRadius: 999 }}>{totalRefs}</span>
                      </div>
                    </div>
                    {refs.length === 0 ? (
                      <div style={{ padding: "30px 20px", background: C.card, border: "1px dashed " + C.border, borderRadius: 12, textAlign: "center", color: C.textMuted, fontSize: 13 }}>
                        No referrals logged yet.
                      </div>
                    ) : (
                      <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: "var(--rt-sh-card)", overflow: "hidden" }}>
                        {refs.map((r, i) => {
                          const isActive = r.status === "converted" || r.status === "active";
                          return (
                            <div key={r.id} className={i === refs.length - 1 ? undefined : "rt-divider-inset"} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", "--rt-inset": "16px" }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13.5, color: C.text, fontWeight: 600 }}>{r.name}</div>
                                <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 2 }}>Referred by {r.from} · {r.on || "recent"}</div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                                {r.revenue > 0 && <span style={{ fontSize: 12, color: C.text, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>${r.revenue.toLocaleString()}/mo</span>}
                                <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 3, letterSpacing: 0.3, color: isActive ? "#fff" : C.textSec, background: isActive ? C.retGood : C.borderLight, textTransform: "uppercase" }}>
                                  {isActive ? "Active" : r.status || "Pending"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Referral form modal — preserved from v1 */}
              {refForm && (
                <div onClick={() => setRefForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(20,30,22,0.40)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div onClick={e => e.stopPropagation()} style={{ background: C.card, borderRadius: 14, border: "2px solid " + C.primary, padding: 24, width: "100%", maxWidth: 480, boxShadow: "var(--rt-sh-card)" }}>
                    <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 14, color: C.text }}>Log Referral</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Referred client</label>
                        <div style={{ display: "flex", gap: 6 }}>
                          <select value={refName} onChange={e => setRefName(e.target.value)} style={{ flex: 1, padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.surfaceWarm, boxSizing: "border-box", minWidth: 0 }}>
                            <option value="">Choose a client…</option>
                            {clients.filter(c => c.name !== refFrom).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                          </select>
                          <button
                            type="button"
                            onClick={() => { setRefForm(false); setPage("clients"); setShowAddClient(true); }}
                            title="Add new client"
                            style={{ flexShrink: 0, padding: "0 12px", background: C.surface, color: C.textSec, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
                          >+ New</button>
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Referred by</label>
                        <div style={{ display: "flex", gap: 6 }}>
                          <select value={refFrom} onChange={e => setRefFrom(e.target.value)} style={{ flex: 1, padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.surfaceWarm, boxSizing: "border-box", minWidth: 0 }}>
                            <option value="">Choose a referrer…</option>
                            <optgroup label="Clients">
                              {clients.filter(c => c.name !== refName).map(c => <option key={"c-" + c.id} value={c.name}>{c.name}</option>)}
                            </optgroup>
                            {rolodex && rolodex.length > 0 && (
                              <optgroup label="Rolodex">
                                {rolodex.filter(r => r.client && r.client !== refName).map(r => <option key={"r-" + r.id} value={r.client}>{r.client}</option>)}
                              </optgroup>
                            )}
                          </select>
                          <button
                            type="button"
                            onClick={() => { setRefForm(false); setPage("retros"); setShowAddRolodex(true); }}
                            title="Add new rolodex contact"
                            style={{ flexShrink: 0, padding: "0 12px", background: C.surface, color: C.textSec, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
                          >+ New</button>
                        </div>
                      </div>
                      {refName && (() => {
                        const refClient = clients.find(c => c.name === refName);
                        const rev = refClient?.revenue || 0;
                        return (
                          <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Monthly revenue</label>
                            <div style={{ padding: "12px 16px", borderRadius: 8, fontSize: 14, color: rev > 0 ? C.text : C.textMuted, background: C.bg, fontWeight: rev > 0 ? 600 : 500 }}>
                              {rev > 0 ? "$" + rev.toLocaleString() + "/mo" : "Not set on client profile"}
                            </div>
                            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6, lineHeight: 1.4 }}>
                              Pulled from {refName}'s client profile.
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="r-btn" data-tone="purple" onClick={addRef} disabled={!refName.trim() || !refFrom} style={{ flex: 1, padding: "10px", background: (refName.trim() && refFrom) ? C.btn : C.surface, color: (refName.trim() && refFrom) ? "#fff" : C.textMuted, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: (refName.trim() && refFrom) ? "pointer" : "default", fontFamily: "inherit" }}>Log Referral</button>
                      <button onClick={() => { setRefForm(false); setRefName(""); setRefFrom(""); setRefRevenue(""); }} style={{ padding: "10px 14px", background: C.surface, color: C.textMuted, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}
              </>)}
            </div>
          );
          } catch (err) {
            return (
              <div style={{ padding: 40, background: "#FFF5F5", border: "2px solid #C04323", borderRadius: 14, margin: 20 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#C04323", marginBottom: 12 }}>Referrals page crashed</div>
                <div style={{ fontSize: 13, color: C.text, marginBottom: 8 }}>Error: <code style={{ background: C.bg, padding: "2px 6px", borderRadius: 4 }}>{String(err?.message || err)}</code></div>
                <pre style={{ fontSize: 11, color: C.textSec, background: C.bg, padding: 12, borderRadius: 6, overflow: "auto", maxHeight: 300 }}>{String(err?.stack || "No stack trace")}</pre>
              </div>
            );
          }
        
}
