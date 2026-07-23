// ─── ClientModal (June 2026 refactor) ─────────────────────────────────
// Extracted VERBATIM from App.jsx — only this shell + imports are new.
// Receives the same ctx-object pattern the pages use; the contract is
// enforced by the extraction scanner + ctx checker.
import { clientBillingDb, clientBillingMonthStatusDb, clientBillingTermsDb, clientEngagementPausesDb, clients as clientsDb, revenueHistoryDb } from "../lib/db";
import { C } from "../theme";
import { localYmd } from "../utils";
import { useEffect, useState } from "react";
import RaiMessageActions from "./RaiMessageActions";
import { Icon } from "./Icon";
import PeopleSection from "./PeopleSection";

import { clientAddons as clientAddonsDb, clientDocuments as clientDocsDb, clientHours as clientHoursDb, raiConversations as convoDb, rolodex as rolodexDb, tasks as tasksDb } from "../lib/db";
import { retColor } from "../utils";
export default function ClientModal({ app }) {
  const {
    // ─── Agency ctx (Jun 2026) ───
    org,
    orgRole,
    can,
    orgMembers,
    clientAssignments,
    handoffBriefs,
    assignClient,
    unassignClient,
    user,
    allTouchpoints,
    editingAddon,
    newAddon,
    occurrenceFlags,
    page,
    refs,
    rolodex,
    setClientAddons,
    setEditingAddon,
    setEditingAddonId,
    setNewAddon,
    taskOccurrences,
    tasks,
    workerCompletions,
    clientAddons,
    getAdjustedLTV,
    engagementPausesByClient,
    billingAddOpen,
    billingMonthStatus,
    billingNewItem,
    billingTerms,
    calcRetentionScore,
    clientBilling,
    clientDrift,
    clientMenuOpen,
    clientTab,
    clients,
    confidantEndRef,
    confidantInput,
    confidantLastActivity,
    confidantLoadingThread,
    confidantMessages,
    confidantTyping,
    editScores,
    editingOverview,
    editingProfile,
    hcQueue,
    overviewEditData,
    pauseConfirm,
    profileDimensions,
    profileScores,
    radarHoverDim,
    removeConfirm,
    resumeConfirm,
    rolodexConfirm,
    selectedClient,
    sendConfidantMessage,
    setBillingAddOpen,
    setBillingMonthStatus,
    setBillingNewItem,
    setBillingTerms,
    setClientBilling,
    setClientMenuOpen,
    setClientTab,
    setClients,
    setConfidantInput,
    setEditScores,
    setEditingOverview,
    setEditingProfile,
    setEngagementPausesByClient,
    setHcOpen,
    setOverviewEditData,
    setPage,
    setPauseConfirm,
    setRadarHoverDim,
    setRemoveConfirm,
    setRenewalModal,
    setRenewalModalMonth,
    setResumeConfirm,
    setRolodex,
    setRolodexConfirm,
    setSelectedClient,
    setShowBaselineEdit,
    setTasks,
    setTermsAddingNew,
    setTermsEditDraft,
    setTermsEditingId,
    setTermsHistoryOpen,
    showBaselineEdit,
    termsAddingNew,
    termsEditDraft,
    termsEditingId,
    termsHistoryOpen,
  } = app;
  // ─── Agency UI state: assignee picker + handoff-card expansion. Reset
  // when the modal moves to a different client so stale open state never
  // carries across. (Hooks live HERE — the render body below is an IIFE.)
  const [assignPickerOpen, setAssignPickerOpen] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  // Re-score delta chip (Jul 2026): after a profile re-score, the delta vs
  // the previous score shows beside the big number until the modal moves on.
  const [scoreDelta, setScoreDelta] = useState(null);
  // ─── Docs + billable hours (Jul 2026) ─────────────────────────────
  const [docs, setDocs] = useState([]);
  const [docBusy, setDocBusy] = useState(false);
  const [docDeleteId, setDocDeleteId] = useState(null);
  const [docDragOver, setDocDragOver] = useState(false);
  const [docError, setDocError] = useState("");
  const [hoursEntries, setHoursEntries] = useState([]);
  const [hoursDraft, setHoursDraft] = useState(null); // { month, h, note }
  const [rateEditing, setRateEditing] = useState(false);
  const [rateDraft, setRateDraft] = useState("");
  const [copiedMonth, setCopiedMonth] = useState(null);
  useEffect(() => {
    setAssignPickerOpen(false); setHandoffOpen(false); setScoreDelta(null);
    setDocs([]); setDocBusy(false); setDocDeleteId(null); setDocDragOver(false); setDocError("");
    setHoursEntries([]); setHoursDraft(null); setRateEditing(false); setRateDraft(""); setCopiedMonth(null);
    const cid = selectedClient?.id;
    if (!cid) return;
    let cancelled = false;
    (async () => {
      try {
        const [{ data: d }, { data: h }] = await Promise.all([
          clientDocsDb.list(cid),
          clientHoursDb.listForClient(cid),
        ]);
        if (cancelled) return;
        setDocs(d || []);
        setHoursEntries(h || []);
      } catch (e) { console.warn("Docs/hours load failed:", e); }
    })();
    return () => { cancelled = true; };
  }, [selectedClient?.id]);
  return (<>
{selectedClient && (() => {
        const sc = selectedClient;
        const dims = sc.profileScores || {};
        const dimLabels = { trust: ["Trust", "Heavy oversight", "Full delegation"], loyalty: ["Loyalty", "Actively shopping", "Locked in, not looking"], expectations: ["Expectations", "Highly ambitious", "Reasonable, aligned"], grace: ["Grace", "Zero tolerance", "Gives benefit of the doubt"], commFrequency: ["Communication Frequency", "Radio silence", "Nonstop"], stressResponse: ["Stress Response", "Goes quiet internally", "Immediately escalates"], budgetCommitment: ["Budget Commitment", "Always under pressure", "Non-issue"], relationshipDepth: ["Relationship Depth", "Strictly transactional", "Genuine connection"], reportingNeed: ["Reporting Need", "Hands-off, minimal updates", "Wants every detail"], replaceability: ["Replaceability", "Plug and play", "Deeply embedded"], commTone: ["Communication Tone", "Reserved, guarded", "Warm, direct"], decisionMaking: ["Decision Making", "No authority, just a relay", "Full authority"] };

        // Hero+ helpers
        const _driftRaw = clientDrift[sc.name] || (sc.ret ? (sc.ret >= 80 ? "Thriving" : sc.ret >= 65 ? "Stable" : sc.ret >= 45 ? "Shifted" : "Declining") : "Stable");
        const _driftLabel = _driftRaw === "Something shifted" ? "Shifted" : _driftRaw;
        const _driftMeta = {
          Thriving:  { fg: C.retElite, bg: C.primaryGhost },
          Stable:    { fg: C.retGood,  bg: C.primaryGhost },
          Healthy:   { fg: C.retGood,  bg: C.primaryGhost },
          Watch:     { fg: C.retOk,    bg: "#FAF8EC" },
          Shifted:   { fg: C.retWarn,  bg: "#FBF1E2" },
          "At Risk": { fg: C.retWarn,  bg: "#FBF1E2" },
          Declining: { fg: C.retCrit,  bg: "#FBEAE3" },
          Critical:  { fg: C.retCrit,  bg: "#FBEAE3" },
        }[_driftLabel] || { fg: C.textSec, bg: C.bg };
        const _bucket = sc.ret ? (sc.ret >= 80 ? "Thriving" : sc.ret >= 65 ? "Healthy" : sc.ret >= 45 ? "Watch" : sc.ret >= 30 ? "At Risk" : "Critical") : "New";

        return (
          <>
            {/* Slide-over backdrop — dim + blur the list/page behind so
                the slide-over reads as floating clearly above its
                context. Previously just a flat 32% dark wash; now adds
                a 2px gaussian blur via backdrop-filter, which gives a
                real depth field on Safari/Chrome. Browsers without
                backdrop-filter (Firefox without flag) fall back to the
                flat dim — no breakage. */}
            <div onClick={() => setSelectedClient(null)} style={{ position: "fixed", inset: 0, background: "rgba(20,30,22,0.38)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)", zIndex: 90 }} />
            <div className="r-client-modal" style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "100%", maxWidth: 520, maxHeight: "90vh", background: C.card, boxShadow: "0 1px 3px rgba(20,30,22,0.10), 0 8px 20px rgba(20,30,22,0.14), 0 25px 50px rgba(20,30,22,0.22), inset 0 1px 0 rgba(255,255,255,0.9)", zIndex: 100, overflowY: "auto", borderRadius: 16 }}>
              {/* Top bar — neighbor nav (↑↓) on left, position breadcrumb
                  in the middle, X close on right. ↑↓ navigate through the
                  full clients array with wraparound; clicking either just
                  calls setSelectedClient(next), which swaps content in
                  place — no close/reopen. */}
              {(() => {
                const navList = (clients || []).filter(c => c && c.id && !c.archived_at);
                const currentIdx = navList.findIndex(c => c.id === sc.id);
                const total = navList.length;
                const hasNav = total > 1 && currentIdx >= 0;
                const goPrev = () => {
                  if (!hasNav) return;
                  const next = navList[currentIdx === 0 ? total - 1 : currentIdx - 1];
                  if (next) setSelectedClient(next);
                };
                const goNext = () => {
                  if (!hasNav) return;
                  const next = navList[currentIdx === total - 1 ? 0 : currentIdx + 1];
                  if (next) setSelectedClient(next);
                };
                const prevClient = hasNav ? navList[currentIdx === 0 ? total - 1 : currentIdx - 1] : null;
                const nextClient = hasNav ? navList[currentIdx === total - 1 ? 0 : currentIdx + 1] : null;
                return (
                  <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, position: "sticky", top: 0, background: C.card, zIndex: 1, borderBottom: "1px solid " + C.borderLight }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                      <button onClick={goPrev} disabled={!hasNav} title={prevClient ? `Previous · ${prevClient.name}` : "Previous client"} aria-label="Previous client" className="rt-so-nav" style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", color: hasNav ? C.textSec : C.textMuted, cursor: hasNav ? "pointer" : "default", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16, lineHeight: 1, padding: 0, position: "relative" }}>
                        ↑
                        {prevClient && (
                          <span className="rt-so-preview">
                            <span className="rt-so-preview-kicker">Prev</span>
                            <span>{prevClient.name}</span>
                          </span>
                        )}
                      </button>
                      <button onClick={goNext} disabled={!hasNav} title={nextClient ? `Next · ${nextClient.name}` : "Next client"} aria-label="Next client" className="rt-so-nav" style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", color: hasNav ? C.textSec : C.textMuted, cursor: hasNav ? "pointer" : "default", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16, lineHeight: 1, padding: 0, position: "relative" }}>
                        ↓
                        {nextClient && (
                          <span className="rt-so-preview">
                            <span className="rt-so-preview-kicker">Next</span>
                            <span>{nextClient.name}</span>
                          </span>
                        )}
                      </button>
                    </div>
                    {hasNav && (
                      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: C.textMuted, fontVariantNumeric: "tabular-nums", display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span>Client</span>
                        <span style={{ opacity: 0.5 }}>·</span>
                        <span>{currentIdx + 1} of {total}</span>
                      </div>
                    )}
                    {/* Overflow menu (Edit / Pause / Remove). Replaces the old
                        sticky bottom footer — actions live in a discoverable
                        ⋯ menu instead of taking permanent vertical real estate. */}
                    <div style={{ marginLeft: "auto", position: "relative", display: "flex", alignItems: "center", gap: 6 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setClientMenuOpen(v => !v); }}
                        aria-label="Client actions"
                        style={{
                          background: clientMenuOpen ? C.surfaceWarm : "none",
                          border: "none",
                          fontSize: 20,
                          cursor: "pointer",
                          color: clientMenuOpen ? C.text : C.textSec,
                          lineHeight: 1,
                          padding: 0,
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          transition: "background 120ms ease",
                        }}
                      >⋯</button>
                      {clientMenuOpen && (
                        <>
                          {/* Click-outside catcher — sits behind menu, captures
                              any click that isn't on the menu itself. */}
                          <div
                            onClick={() => setClientMenuOpen(false)}
                            style={{ position: "fixed", inset: 0, zIndex: 4 }}
                          />
                          <div style={{
                            position: "absolute",
                            top: 36,
                            right: 0,
                            background: C.card,
                            border: "1px solid " + C.borderLight,
                            borderRadius: 10,
                            boxShadow: "0 8px 24px rgba(20,30,22,0.12), 0 2px 6px rgba(20,30,22,0.06)",
                            minWidth: 180,
                            padding: 6,
                            zIndex: 5,
                          }}>
                            <div
                              onClick={() => {
                                setClientMenuOpen(false);
                                setClientTab("overview");
                                setEditingOverview(true);
                                setOverviewEditData({ contact: sc.contact, role: sc.role, tag: sc.tag, months: sc.months, revenue: sc.revenue, lifetime_revenue_at_entry: sc.lifetime_revenue_at_entry || 0, renewal_date: sc.renewal_date || "", renewal_recurrence: sc.renewal_recurrence || "none" });
                              }}
                              style={{ padding: "10px 12px", fontSize: 13, color: C.text, cursor: "pointer", borderRadius: 6, fontWeight: 500 }}
                              onMouseEnter={e => e.currentTarget.style.background = C.surfaceWarm}
                              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                            >Edit details</div>
                            <div
                              onClick={() => {
                                setClientMenuOpen(false);
                                setClientTab("overview");
                                if (sc.is_paused) { setResumeConfirm(true); }
                                else { setPauseConfirm(true); }
                                setRolodexConfirm(false); setRemoveConfirm(false);
                              }}
                              style={{ padding: "10px 12px", fontSize: 13, color: C.text, cursor: "pointer", borderRadius: 6, fontWeight: 500 }}
                              onMouseEnter={e => e.currentTarget.style.background = C.surfaceWarm}
                              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                            >{sc.is_paused ? "Resume client" : "Pause client"}</div>
                            <div style={{ borderTop: "1px solid " + C.borderLight, margin: "4px 0" }} />
                            <div
                              onClick={() => {
                                setClientMenuOpen(false);
                                setClientTab("overview");
                                setRolodexConfirm(true);
                                setPauseConfirm(false); setResumeConfirm(false); setRemoveConfirm(false);
                              }}
                              style={{ padding: "10px 12px", fontSize: 13, color: C.danger, cursor: "pointer", borderRadius: 6, fontWeight: 500 }}
                              onMouseEnter={e => e.currentTarget.style.background = C.surfaceWarm}
                              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                            >Remove client</div>
                          </div>
                        </>
                      )}
                      <button onClick={() => setSelectedClient(null)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.textMuted, lineHeight: 1, padding: 0, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                    </div>
                  </div>
                );
              })()}

              {/* Hero — gradient band: eyebrow meta · name · delta · score */}
              <div style={{ padding: "20px 20px 14px", background: "linear-gradient(180deg, " + C.surfaceWarm + " 0%, " + C.card + " 100%)" }}>
                {/* Eyebrow: industry · tenure */}
                <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, marginBottom: 6 }}>
                  {sc.tag || "Client"}{sc.months ? " · with you " + (sc.months >= 12 ? (sc.months / 12).toFixed(1) + " years" : sc.months + " months") : ""}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, color: C.text, margin: 0, lineHeight: 1.15 }}>{sc.name}</h2>
                    {(() => {
                      // Pause status line: "Currently paused since May 4 · 2 previous pauses"
                      // Renders only when relevant — if a client has never been paused,
                      // skip the line entirely to keep the header clean.
                      const pauses = engagementPausesByClient[sc.id] || [];
                      if (pauses.length === 0) return null;
                      const openPause = pauses.find(p => !p.resumed_at);
                      const previousCount = pauses.filter(p => p.resumed_at).length;
                      const fmtDate = (d) => {
                        try {
                          return new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString(undefined, { month: "short", day: "numeric" });
                        } catch { return d; }
                      };
                      const parts = [];
                      if (openPause) parts.push("Currently paused since " + fmtDate(openPause.paused_at));
                      if (previousCount > 0) parts.push(previousCount + " previous pause" + (previousCount === 1 ? "" : "s"));
                      if (parts.length === 0) return null;
                      return (
                        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4, fontWeight: 500 }}>
                          {parts.join(" · ")}
                        </div>
                      );
                    })()}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                      {sc.ret ? (
                        <span style={{ fontSize: 11.5, fontWeight: 700, padding: "4px 11px", borderRadius: 999, color: _driftMeta.fg, background: _driftMeta.bg, fontVariantNumeric: "tabular-nums" }}>
                          {_driftLabel}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11.5, fontWeight: 700, padding: "4px 11px", borderRadius: 999, color: C.textSec, background: C.bg }}>First check pending</span>
                      )}
                      {/* ─── AGENCY: coverage chips + assign (owners) ────────
                          Who covers this client. Every active member can SEE
                          coverage (transparency); only owners can change it.
                          Multiple AMs per client is supported. */}
                      {org && (() => {
                        const assignedIdSet = new Set((clientAssignments || []).filter(a => a.client_id === sc.id).map(a => a.member_user_id));
                        const assigned = (orgMembers || []).filter(m => assignedIdSet.has(m.user_id));
                        const canAssign = can("manage_org", orgRole);
                        const assignable = (orgMembers || []).filter(m => m.role === "am" && !assignedIdSet.has(m.user_id));
                        const shortName = (m) => ((m.invited_email || "") || m.user_id).split("@")[0];
                        return (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap", position: "relative" }}>
                            {assigned.map(m => (
                              <span key={m.user_id} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "4px 9px", borderRadius: 999, background: C.surfaceWarm, color: C.textSec, border: "1px solid " + C.borderLight }}>
                                {shortName(m)}
                                {canAssign && (
                                  <button onClick={() => unassignClient(sc.id, m.user_id)} aria-label={"Unassign " + shortName(m)} style={{ background: "transparent", border: "none", cursor: "pointer", color: C.textMuted, fontSize: 12, lineHeight: 1, padding: 0, fontFamily: "inherit" }}>×</button>
                                )}
                              </span>
                            ))}
                            {assigned.length === 0 && (
                              <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 9px", borderRadius: 999, background: "#FAF0DF", color: "#8A6A2F" }}>No coverage</span>
                            )}
                            {canAssign && assignable.length > 0 && (
                              <button onClick={() => setAssignPickerOpen(v => !v)} style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: "transparent", color: C.primary, border: "1px dashed " + C.border, cursor: "pointer", fontFamily: "inherit" }}>+ Assign</button>
                            )}
                            {assignPickerOpen && canAssign && (
                              <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 40, background: C.card, border: "1px solid " + C.border, borderRadius: 10, boxShadow: "var(--rt-sh-card)", padding: 6, minWidth: 200 }}>
                                {assignable.map(m => (
                                  <button key={m.user_id} onClick={async () => { setAssignPickerOpen(false); await assignClient(sc.id, m.user_id); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 7, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, color: C.text }}>
                                    {m.invited_email || m.user_id}
                                  </button>
                                ))}
                              </div>
                            )}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    {sc.ret ? (
                      <>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6, justifyContent: "flex-end" }}>
                          {scoreDelta != null && scoreDelta !== 0 && (
                            <span style={{ fontSize: 12, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: scoreDelta > 0 ? C.success : C.danger, background: scoreDelta > 0 ? "#E8F3EC" : "#FBEDE9", padding: "2px 7px", borderRadius: 999 }}>
                              {scoreDelta > 0 ? "+" : ""}{scoreDelta}
                            </span>
                          )}
                          <div style={{ fontSize: 44, fontWeight: 800, color: retColor(sc.ret), letterSpacing: -1.6, lineHeight: 0.9, fontVariantNumeric: "tabular-nums" }}>{sc.ret}</div>
                        </div>
                        <div style={{ fontSize: 9.5, fontWeight: 700, color: C.textMuted, letterSpacing: 1.2, marginTop: 6, textTransform: "uppercase" }}>{_bucket}</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 22, fontWeight: 700, color: C.textMuted, letterSpacing: -0.5 }}>New</div>
                    )}
                  </div>
                </div>

              </div>

              {/* Stat strip — MRR · LTV · Tenure */}
              {sc.ret && (
                <div style={{ display: "flex", padding: "14px 20px", background: C.surfaceWarm, borderTop: "1px solid " + C.borderLight, borderBottom: "1px solid " + C.borderLight }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase" }}>MRR</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>${(sc.revenue / 1000).toFixed(1)}k</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase" }}>LTV</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>${Math.round(getAdjustedLTV(sc) / 1000)}k</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase" }}>Tenure</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{sc.months >= 12 ? (sc.months / 12).toFixed(1) + " yr" : sc.months + " mo"}</div>
                  </div>
                </div>
              )}

              {/* ── ACCOUNT MANAGER (Agency, Jul 2026 — the UI the June
                  engine never got). Owners assign/unassign; seats see who
                  owns the client read-only. A new assignment auto-fires
                  the handoff-brief function (wired in App since June);
                  the latest brief renders below the moment it exists. */}
              {org && (() => {
                const assigned = clientAssignments.filter(a => a.client_id === sc.id);
                const isOwner = orgRole === "owner";
                const nameFor = (uid) => {
                  if (uid === user?.id) return "You";
                  if (uid === org.owner_user_id) return "Owner";
                  const m = orgMembers.find(mm => mm.user_id === uid);
                  return m?.invited_email ? m.invited_email.split("@")[0] : "Teammate";
                };
                const candidates = [
                  { user_id: org.owner_user_id, label: org.owner_user_id === user?.id ? "You (owner)" : "Owner" },
                  ...orgMembers.filter(m => m.user_id && m.status === "active" && m.user_id !== org.owner_user_id)
                    .map(m => ({ user_id: m.user_id, label: m.invited_email || "Teammate" })),
                ].filter(c => !assigned.some(a => a.member_user_id === c.user_id));
                const brief = handoffBriefs && handoffBriefs[sc.id];
                return (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 8 }}>Account manager</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {assigned.length === 0 && (
                        <span style={{ fontSize: 12.5, color: C.textMuted, fontStyle: "italic" }}>Unassigned{isOwner ? "" : " — the owner assigns clients"}</span>
                      )}
                      {assigned.map(a => (
                        <span key={a.member_user_id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: C.primaryDeep || C.primary, background: "#E6EFE9", borderRadius: 999, padding: "4px 10px" }}>
                          {nameFor(a.member_user_id)}
                          {isOwner && (
                            <button
                              onClick={() => unassignClient(sc.id, a.member_user_id)}
                              aria-label="Unassign"
                              style={{ border: "none", background: "none", color: C.primaryDeep || C.primary, fontSize: 12, fontWeight: 800, cursor: "pointer", padding: 0, lineHeight: 1 }}>
                              ×
                            </button>
                          )}
                        </span>
                      ))}
                      {isOwner && candidates.length > 0 && (
                        <select
                          value=""
                          onChange={e => { if (e.target.value) assignClient(sc.id, e.target.value); }}
                          style={{ fontSize: 12, fontFamily: "inherit", color: C.textSec, border: "1px dashed " + C.border, borderRadius: 999, padding: "4px 8px", background: "transparent", cursor: "pointer" }}>
                          <option value="">+ Assign…</option>
                          {candidates.map(c => <option key={c.user_id} value={c.user_id}>{c.label}</option>)}
                        </select>
                      )}
                    </div>
                    {brief && brief.brief_text && (
                      <details style={{ marginTop: 10, background: "#F6F8F5", border: "1px solid rgba(51,84,62,0.10)", borderRadius: 10, padding: "8px 12px" }}>
                        <summary style={{ fontSize: 11.5, fontWeight: 700, color: C.primaryDeep || C.primary, cursor: "pointer" }}>
                          Handoff brief · {new Date(brief.created_at).toLocaleDateString()}
                        </summary>
                        <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.55, marginTop: 8, whiteSpace: "pre-wrap" }}>{brief.brief_text}</div>
                      </details>
                    )}
                  </div>
                );
              })()}

              {/* Rai involvement — Managed (Rai helps: scores, suggests tasks,
                  flags, can pick) vs Advisory (Rai keeps score only — no tasks,
                  no flags, never picked). For clients the user handles on their
                  own / on an unusual cadence, so Rai stops false-positive nags. */}
              {(() => {
                const mode = sc.rai_mode || "managed";
                const setMode = (next) => {
                  if (next === mode) return;
                  // Promotion at the cap: stop honestly here rather than
                  // letting the DB backstop silently demote what the UI
                  // just showed as promoted (advisory_cap_01, Jul 2026).
                  if (next === "managed" && app.soloAtCap && app.soloAtCap()) {
                    app.setCapNotice && app.setCapNotice(sc.name || "This client");
                    return;
                  }
                  setSelectedClient(prev => prev ? { ...prev, rai_mode: next } : prev);
                  setClients(prev => prev.map(c => c.id === sc.id ? { ...c, rai_mode: next } : c));
                  clientsDb.update(sc.id, { rai_mode: next }).then(({ error }) => {
                    if (error) {
                      console.error("Failed to save rai_mode:", error);
                      setSelectedClient(prev => prev ? { ...prev, rai_mode: mode } : prev);
                      setClients(prev => prev.map(c => c.id === sc.id ? { ...c, rai_mode: mode } : c));
                    }
                  });
                };
                return (
                  <div style={{ padding: "14px 20px", borderTop: sc.ret ? "none" : "1px solid " + C.borderLight, borderBottom: "1px solid rgba(124,92,243,0.16)", background: "#F6F2FD" }}>
                    {/* Rai purple surface (Jul 2026): this is a RAI control —
                        it reads as one. Softer wash than the note cards
                        (#F6F2FD vs #EFE9FB) so it sits back as chrome, with
                        the ✦ marker and ink from the Rai palette. */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 10, color: "#7c5cf3", fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase" }}>✦ Rai's role</div>
                        <div style={{ fontSize: 12, color: "#3E2F72", marginTop: 3, lineHeight: 1.4, opacity: 0.85 }}>
                          {mode === "managed"
                            ? "Rai helps manage this client — suggests tasks and flags risks."
                            : "Rai keeps score only — no tasks or flags. You've got this one."}
                        </div>
                      </div>
                      <div style={{ display: "inline-flex", background: "rgba(124,92,243,0.10)", borderRadius: 999, padding: 3, flexShrink: 0 }}>
                        {[["managed", "Managed"], ["advisory", "Advisory"]].map(([val, label]) => (
                          <button
                            key={val}
                            onClick={() => setMode(val)}
                            style={{
                              padding: "6px 12px", borderRadius: 999, border: "none", cursor: "pointer",
                              fontFamily: "inherit", fontSize: 12, fontWeight: 600,
                              ...(mode === val
                                ? { background: "#7c5cf3", color: "#fff", boxShadow: "0 1px 4px rgba(124,92,243,0.35)" }
                                : { background: "transparent", color: "#3E2F72", opacity: 0.6 }),
                            }}
                          >{label}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div style={{ padding: "16px 20px 0" }}>
                <div style={{ display: "flex", gap: 0, background: C.surface, borderRadius: 10, padding: 3 }}>
                  {["Overview", "Profile", "Docs", "Billing", "Flags"].map(t => {
                    const isActive = clientTab === t.toLowerCase();
                    return (
                      <button key={t} onClick={() => setClientTab(t.toLowerCase())} style={{
                        flex: 1, padding: "10px", borderRadius: 8, border: "none",
                        background: isActive ? C.card : "transparent",
                        color: isActive ? C.text : C.textMuted,
                        fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                        boxShadow: isActive ? "var(--rt-sh-card-lift)" : "none",
                        transform: isActive ? "translateY(-0.5px)" : "none",
                        transition: "background 0.15s ease, color 0.15s ease, box-shadow 180ms var(--rt-ease-out), transform 180ms var(--rt-ease-out)",
                      }}>{t}</button>
                    );
                  })}
                </div>
              </div>

              <div style={{ padding: "16px 20px" }}>
                {/* Overview */}
                {clientTab === "overview" && (
                  <div>
                    {/* ─── AGENCY: handoff brief — Rai's written handoff for the
                        incoming AM. Persistent but out of the way: one quiet
                        collapsed row; tap to read. Visible to the recipient
                        and to owners (RLS enforces the same server-side). */}
                    {org && (() => {
                      const hb = (handoffBriefs || {})[sc.id];
                      if (!hb) return null;
                      const canSee = hb.to_member_user_id === user.id || can("manage_org", orgRole);
                      if (!canSee) return null;
                      const when = hb.created_at ? new Date(hb.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
                      return (
                        <div style={{ background: "#EFE9FB", border: "1px solid rgba(124,92,243,0.18)", borderRadius: 12, padding: "11px 14px", marginBottom: 14 }}>
                          <button onClick={() => setHandoffOpen(v => !v)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "transparent", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: "#7c5cf3" }}>✦ HANDOFF BRIEF</span>
                            <span style={{ fontSize: 10.5, color: "#3E2F72", opacity: 0.6 }}>{when}</span>
                            <span style={{ marginLeft: "auto", fontSize: 11, color: "#7c5cf3", fontWeight: 700 }}>{handoffOpen ? "hide" : "read"}</span>
                          </button>
                          {handoffOpen && (
                            <div style={{ marginTop: 8, fontSize: 13.5, lineHeight: 1.55, color: "#3E2F72", fontFamily: "'Fraunces', Georgia, serif", fontStyle: "italic", fontWeight: 500, fontVariationSettings: "'opsz' 96, 'SOFT' 50, 'WONK' 0", whiteSpace: "pre-wrap" }}>
                              {hb.brief_text}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {!editingOverview ? (
                      <>
                        {(() => {
                          const pendingHc = hcQueue.find(h => h.client === sc.name);
                          const hcValue = (() => {
                            if (!pendingHc) return sc.lastHC ? "Last: " + sc.lastHC : "Pending";
                            if (pendingHc.overdue > 0) return `Overdue by ${pendingHc.overdue}d`;
                            if (pendingHc.due === "Today") return "Due today";
                            return `In ${pendingHc.daysUntil}d`;
                          })();
                          const canStartEarly = pendingHc && pendingHc.isFirstHC && pendingHc.overdue === 0 && pendingHc.due !== "Today";
                          return (
                            <>
                              {[
                                { l: "Contact",      v: sc.contact || "—" },
                                { l: "Role",         v: sc.role || "—" },
                                // Referral lineage (Jul 2026): where this
                                // client CAME from is a fact of the account.
                                ...(() => {
                                  const lin = (refs || []).find(r => r.name === sc.name && r.from);
                                  return lin ? [{ l: "Referred by", v: lin.from + (lin.on ? " · " + lin.on : "") }] : [];
                                })(),
                                // Documents (Jul 2026): jump row to the Docs tab.
                                ...(docs.length > 0 ? [{ l: "Documents", v: docs.length + " on file", muted: true, onClick: () => setClientTab("docs") }] : []),
                              ].map((d, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid " + C.borderLight }}>
                                  <span style={{ fontSize: 14, color: C.textSec }}>{d.l}</span>
                                  <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{d.v}</span>
                                </div>
                              ))}
                              {/* People (Jul 2026): stakeholders beyond the primary.
                                  clients.contact stays the one profiled person; the
                                  section's make-primary rewrites that mirror so every
                                  downstream reader keeps working untouched. */}
                              <PeopleSection
                                user={user}
                                editing={false}
                                client={sc}
                                onPrimaryChange={(updates) => {
                                  setSelectedClient(p => (p ? { ...p, ...updates } : p));
                                  setClients(p => p.map(c => c.id === sc.id ? { ...c, ...updates } : c));
                                }}
                              />
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid " + C.borderLight, gap: 10 }}>
                                <span style={{ fontSize: 14, color: C.textSec }}>Health Check</span>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{hcValue}</span>
                                  {canStartEarly && (
                                    <button onClick={() => { setPage("health"); setHcOpen(sc.name); setSelectedClient(null); }} style={{ background: "none", border: "none", padding: 0, fontSize: 12, fontWeight: 600, color: C.btn, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
                                      Start early
                                    </button>
                                  )}
                                </div>
                              </div>
                              {[
                                { l: "Referrals",    v: sc.referrals || 0 },
                                { l: "Renewal",      v: sc.renewal_date ? (new Date(sc.renewal_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) + (sc.renewal_recurrence && sc.renewal_recurrence !== "none" ? " · " + ({ monthly: "Monthly", quarterly: "Quarterly", annual: "Annual" }[sc.renewal_recurrence] || "") : "")) : "Set renewal", muted: !sc.renewal_date, onClick: () => { setRenewalModalMonth(sc.renewal_date ? sc.renewal_date.slice(0, 7) : (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })()); setRenewalModal({ client: sc, date: sc.renewal_date ? sc.renewal_date.slice(0, 10) : "", recurrence: sc.renewal_recurrence || "none" }); } },
                              ].map((d, i) => (
                                <div key={i} onClick={d.onClick} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid " + C.borderLight, cursor: d.onClick ? "pointer" : "default" }}>
                                  <span style={{ fontSize: 14, color: C.textSec }}>{d.l}</span>
                                  <span style={{ fontSize: 14, fontWeight: 600, color: d.muted ? C.primary : C.text }}>{d.v}{d.onClick && <span style={{ marginLeft: 6, fontSize: 11, color: C.textMuted }}>›</span>}</span>
                                </div>
                              ))}
                            </>
                          );
                        })()}
                        {/* Recent activity — last 7 days. Pulls from completed
                            tasks and logged touchpoints for this client. Empty
                            state suppresses entirely so a brand-new client
                            doesn't render an empty container. */}
                        {(() => {
                          const NOW = Date.now();
                          const SEVEN_D = 7 * 24 * 60 * 60 * 1000;

                          // Recurring tasks have their tasks.completed_at nulled
                          // by the midnight rollover, so the in-memory tasks
                          // array only carries TODAY's recurring completions.
                          // Need an immutable history source for the 7d window.
                          //
                          // Phase 3 cutover via `client_recent_activity` flag:
                          //   - flag ON  → task_occurrences (new model)
                          //   - flag OFF → workerCompletions / task_completions (old)
                          const useOccurrences = occurrenceFlags.client_recent_activity === true;

                          const taskEventsToday = (tasks || [])
                            .filter(t => t.client === sc.name && t.done && t.completed_at)
                            .map(t => {
                              const ts = new Date(t.completed_at).getTime();
                              return { ts, kind: "task", text: t.text, _taskId: t.id, _ymd: new Date(t.completed_at).toISOString().slice(0, 10) };
                            })
                            .filter(e => (NOW - e.ts) <= SEVEN_D);

                          const todayDedupeKeys = new Set(taskEventsToday.map(e => `${e._taskId}|${e._ymd}`));

                          const historySource = useOccurrences
                            ? (taskOccurrences || [])
                                .filter(o =>
                                  (o.client_name === sc.name || o.client_id === sc.id) &&
                                  o.is_done &&
                                  o.completed_at
                                )
                                .map(o => ({
                                  ts: new Date(o.completed_at).getTime(),
                                  kind: "task",
                                  text: o.task_text,
                                  _taskId: o.task_id,
                                  _ymd: o.occurrence_date,
                                }))
                            : (workerCompletions || [])
                                .filter(c => (c.client_name === sc.name || c.client_id === sc.id) && c.completed_at)
                                .map(c => ({
                                  ts: new Date(c.completed_at).getTime(),
                                  kind: "task",
                                  text: c.task_text,
                                  _taskId: c.task_id,
                                  _ymd: new Date(c.completed_at).toISOString().slice(0, 10),
                                }));

                          const taskEventsHistory = historySource
                            .filter(e => (NOW - e.ts) <= SEVEN_D)
                            .filter(e => !todayDedupeKeys.has(`${e._taskId}|${e._ymd}`));

                          const taskEvents = [...taskEventsToday, ...taskEventsHistory];

                          const tpEvents = (allTouchpoints || [])
                            .filter(tp => (tp.client_name === sc.name || tp.client_id === sc.id) && tp.occurred_at)
                            .map(tp => {
                              const ts = new Date(tp.occurred_at).getTime();
                              return { ts, kind: "touchpoint", text: tp.channel || "Touchpoint" };
                            })
                            .filter(e => (NOW - e.ts) <= SEVEN_D);

                          const events = [...taskEvents, ...tpEvents].sort((a, b) => b.ts - a.ts).slice(0, 6);
                          if (events.length === 0) return null;

                          const relTime = (ts) => {
                            const diff = NOW - ts;
                            const hours = Math.floor(diff / (60 * 60 * 1000));
                            if (hours < 1) return "just now";
                            if (hours < 24) return hours + "h ago";
                            const days = Math.floor(hours / 24);
                            if (days === 1) return "yesterday";
                            return days + "d ago";
                          };

                          return (
                            <div style={{ marginTop: 18 }}>
                              <div style={{ fontSize: 10.5, fontWeight: 700, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 8 }}>Recent activity · 7d</div>
                              <div style={{ background: C.bg, borderRadius: 10, padding: 4 }}>
                                {events.map((e, i) => (
                                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderTop: i > 0 ? "1px solid " + C.borderLight : "none" }}>
                                    <div style={{
                                      width: 22, height: 22, borderRadius: "50%",
                                      background: e.kind === "task" ? C.primarySoft : C.surface,
                                      color: e.kind === "task" ? C.primary : C.textMuted,
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                      fontSize: 11, fontWeight: 700, flexShrink: 0,
                                    }}>
                                      {e.kind === "task" ? "✓" : "·"}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      <span style={{ color: C.text, fontWeight: 600 }}>
                                        {e.kind === "task" ? "Task done" : (e.text || "Touchpoint")}
                                      </span>
                                      {e.kind === "task" && e.text ? <span>: {e.text}</span> : null}
                                    </div>
                                    <div style={{ fontSize: 11, color: C.textMuted, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{relTime(e.ts)}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Edit Client Details</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <div>
                            <label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Company name</label>
                            <input value={overviewEditData.name ?? sc.name} onChange={e => setOverviewEditData({ ...overviewEditData, name: e.target.value })} style={{ width: "100%", padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg }} />
                          </div>
                          {[{ key: "contact", label: "Contact name" }, { key: "role", label: "Role" }, { key: "tag", label: "Industry" }].map(f => (
                            <div key={f.key}>
                              <label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>{f.label}</label>
                              <input value={overviewEditData[f.key] || ""} onChange={e => setOverviewEditData({ ...overviewEditData, [f.key]: e.target.value })} style={{ width: "100%", padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg }} />
                            </div>
                          ))}
                          <div>
                            <label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Months together</label>
                            <input type="number" value={overviewEditData.months || 0} onChange={e => setOverviewEditData({ ...overviewEditData, months: parseInt(e.target.value) || 0 })} style={{ width: "100%", padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Current monthly rate ($)</label>
                            <input type="number" value={overviewEditData.revenue || 0} onChange={e => setOverviewEditData({ ...overviewEditData, revenue: parseInt(e.target.value) || 0 })} style={{ width: "100%", padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg }} />
                            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, lineHeight: 1.4 }}>
                              Your best estimate of monthly revenue. Changing this will not affect prior months.
                            </div>
                          </div>
                          {/* Revenue change reason — only revealed when the rate actually
                              differs from the current saved value. Optional. Lets Rai see
                              the narrative behind movement (expansion, contraction, etc)
                              rather than just the numbers. */}
                          {Number(overviewEditData.revenue || 0) !== Number(sc.revenue || 0) && (
                            <div style={{ background: C.surfaceWarm, borderRadius: 8, padding: "12px" }}>
                              <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>Why is the rate changing? (optional)</label>
                              <select value={overviewEditData.change_reason || ""} onChange={e => setOverviewEditData({ ...overviewEditData, change_reason: e.target.value })} style={{ width: "100%", padding: "10px 12px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", background: C.surfaceWarm, marginBottom: 6 }}>
                                <option value="">Skip — no reason given</option>
                                <option value="expansion">Expansion (scope grew)</option>
                                <option value="contraction">Contraction (scope shrank)</option>
                                <option value="annual_increase">Annual rate increase</option>
                                <option value="discount_expired">Discount expired</option>
                                <option value="discount_applied">Discount applied</option>
                                <option value="renegotiation">Renegotiation</option>
                                <option value="correction">Correction (typo / wrong rate)</option>
                                <option value="other">Other</option>
                              </select>
                              <input type="text" value={overviewEditData.change_note || ""} onChange={e => setOverviewEditData({ ...overviewEditData, change_note: e.target.value })} placeholder="Note (optional)" style={{ width: "100%", padding: "10px 12px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", background: C.surfaceWarm, boxSizing: "border-box" }} />
                            </div>
                          )}
                          {!showBaselineEdit ? (
                            <button
                              type="button"
                              onClick={() => setShowBaselineEdit(true)}
                              style={{
                                fontSize: 12,
                                color: C.textMuted,
                                background: "transparent",
                                border: "none",
                                padding: "4px 0",
                                cursor: "pointer",
                                fontFamily: "inherit",
                                textAlign: "left",
                                textDecoration: "underline",
                                textDecorationColor: C.borderLight,
                                textUnderlineOffset: 3,
                                alignSelf: "flex-start",
                              }}
                            >
                              Adjust historical revenue baseline
                            </button>
                          ) : (
                            <div>
                              <label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Lifetime revenue earned before today ($)</label>
                              <input type="number" value={overviewEditData.lifetime_revenue_at_entry || 0} onChange={e => setOverviewEditData({ ...overviewEditData, lifetime_revenue_at_entry: parseFloat(e.target.value) || 0 })} style={{ width: "100%", padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg }} />
                              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, lineHeight: 1.4 }}>
                                What you earned from this client BEFORE Retayned tracked them. Only edit this if you skipped it during onboarding or got the number wrong.
                              </div>
                            </div>
                          )}
                          <div>
                            <label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Renewal date <span style={{ color: C.textMuted, fontWeight: 400 }}>· optional</span></label>
                            <div style={{ position: "relative" }}>
                              {/* Custom button styled like the form's input fields
                                  so it sits in the same visual rhythm. Opens a
                                  .rt-picker-panel calendar below. Replaces the
                                  native <input type="date"> which on mobile (iOS
                                  in particular) rendered as a separate button-
                                  styled control that broke the form's visual
                                  rhythm and could overflow the page. */}
                              <button
                                type="button"
                                onClick={() => {
                                  const cur = overviewEditData.renewal_date ? String(overviewEditData.renewal_date).slice(0, 10) : "";
                                  setRenewalModalMonth(cur ? cur.slice(0, 7) : (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })());
                                  setRenewalModal({ client: sc, date: cur, recurrence: overviewEditData.renewal_recurrence || "none", fromEdit: true });
                                }}
                                style={{
                                  width: "100%",
                                  padding: "12px 16px",
                                  border: "none",
                                  borderRadius: 8,
                                  fontSize: 14,
                                  fontFamily: "inherit",
                                  textAlign: "left",
                                  background: C.bg,
                                  boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)",
                                  cursor: "pointer",
                                  color: overviewEditData.renewal_date ? C.text : C.textMuted,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: 8,
                                  boxSizing: "border-box",
                                }}
                              >
                                <span>
                                  {overviewEditData.renewal_date
                                    ? new Date(String(overviewEditData.renewal_date).split("T")[0] + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                                    : "Select a date"}
                                </span>
                                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  {overviewEditData.renewal_date && (
                                    <span
                                      role="button"
                                      onClick={(e) => { e.stopPropagation(); setOverviewEditData({ ...overviewEditData, renewal_date: null }); }}
                                      style={{ width: 18, height: 18, borderRadius: 9, background: C.surface, color: C.textMuted, display: "grid", placeItems: "center", fontSize: 10, cursor: "pointer" }}
                                      aria-label="Clear renewal date"
                                    >×</span>
                                  )}
                                  <Icon name="due" size={14} simple color={C.textMuted} />
                                </span>
                              </button>
                            </div>
                            {/* Recurrence — only meaningful once a date is set.
                                The date acts as the anchor; recurrence rolls it
                                forward each cycle so it never reads "overdue". */}
                            {overviewEditData.renewal_date && (
                              <div style={{ marginTop: 10 }}>
                                <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 6 }}>Repeats</label>
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                  {[{ v: "none", l: "One-time" }, { v: "monthly", l: "Monthly" }, { v: "quarterly", l: "Quarterly" }, { v: "annual", l: "Annual" }].map(opt => {
                                    const active = (overviewEditData.renewal_recurrence || "none") === opt.v;
                                    return (
                                      <button key={opt.v} type="button" onClick={() => setOverviewEditData({ ...overviewEditData, renewal_recurrence: opt.v })} style={{ padding: "7px 12px", background: active ? C.primarySoft : C.card, border: "none", boxShadow: "inset 0 0 0 1px " + (active ? C.primary : C.borderLight), borderRadius: 8, fontSize: 12.5, fontWeight: 600, color: active ? C.primary : C.textSec, cursor: "pointer", fontFamily: "inherit", transition: "all 120ms ease" }}>{opt.l}</button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <PeopleSection
                          user={user}
                          editing
                          client={sc}
                          onPrimaryChange={(updates) => {
                            setSelectedClient(p => (p ? { ...p, ...updates } : p));
                            setClients(p => p.map(c => c.id === sc.id ? { ...c, ...updates } : c));
                          }}
                        />
                        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                          <button onClick={() => setEditingOverview(false)} style={{ padding: "10px 16px", background: C.surface, color: C.textSec, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                          <button onClick={async () => {
                            const newRate = Number(overviewEditData.revenue) || 0;
                            const newBaseline = Number(overviewEditData.lifetime_revenue_at_entry) || 0;
                            const rateChanged = newRate !== Number(sc.revenue || 0);

                            const oldName = sc.name;
                            const newName = (overviewEditData.name ?? sc.name).trim() || sc.name;
                            const nameChanged = newName !== oldName;

                            // Always save the non-revenue fields via clientsDb.update.
                            // Revenue specifically goes through revenueHistoryDb.changeRate
                            // when it changed — that closes the active history row, opens
                            // a new one, AND updates clients.revenue. Calling clientsDb.update
                            // first with the new revenue would race with that.
                            const baseUpdates = {
                              contact: overviewEditData.contact,
                              role: overviewEditData.role,
                              tag: overviewEditData.tag,
                              months: overviewEditData.months,
                              renewal_date: overviewEditData.renewal_date || null,
                              renewal_recurrence: overviewEditData.renewal_recurrence || "none",
                              lifetime_revenue_at_entry: newBaseline,
                            };
                            if (nameChanged) baseUpdates.name = newName;
                            // If revenue did NOT change, include it in the update so we
                            // don't make an extra call.
                            if (!rateChanged) baseUpdates.revenue = newRate;

                            // Optimistic local update
                            const updated = {
                              ...sc,
                              ...baseUpdates,
                              name: newName,
                              revenue: newRate,
                              // ltv recompute: pre-entry baseline + history. Since rate
                              // change just happened (or didn't), the current row's
                              // contribution stays roughly the same. The new pre-entry
                              // baseline shifts the total directly.
                              ltv: newBaseline + (Number(sc.ltv || 0) - Number(sc.lifetime_revenue_at_entry || 0)),
                            };
                            setClients(prev => prev.map(c => c.id === sc.id ? updated : c));
                            // Patch denormalized client name on in-memory tasks so
                            // task.client lookups don't break after rename.
                            if (nameChanged) {
                              setTasks(prev => prev.map(t => t.client === oldName ? { ...t, client: newName } : t));
                            }
                            setSelectedClient(updated);
                            setEditingOverview(false);

                            // Persist
                            try {
                              await clientsDb.update(sc.id, baseUpdates);
                              if (rateChanged) {
                                await revenueHistoryDb.changeRate(user.id, sc.id, newRate, overviewEditData.change_reason || null, overviewEditData.change_note || null);
                              }
                            } catch (e) {
                              console.error("Failed to save client edits:", e);
                            }
                          }} style={{ flex: 1, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
                        </div>
                      </>
                    )}
                {/* Destructive action CONFIRM blocks — triggered by the
                    sticky footer at modal level. When no confirm is active
                    this renders nothing (the sticky footer is visible
                    instead). The four confirm dialogs preserve the existing
                    state-machine semantics. */}
                <div style={{ marginTop: 18 }}>
                  {!rolodexConfirm && !removeConfirm && !pauseConfirm && !resumeConfirm ? null : pauseConfirm ? (
                    <div style={{ background: C.surfaceWarm, borderRadius: 12, padding: "16px" }}>
                      <p style={{ fontSize: 14, color: C.text, lineHeight: 1.55, marginBottom: 14 }}>Pausing takes this client fully out of Rai's daily sweep — no brief mentions, no surfaced tasks, no scoring — until you resume. Their tasks stay visible in the app, the tenure clock freezes, and retention takes a one-time −4. Billing is unaffected; to stop billing, move them to your Rolodex instead.</p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={async () => {
                          // Optimistic: flip is_paused, drop ret -4
                          const newRet = Math.max(1, (sc.ret || 50) - 4);
                          setClients(clients.map(c => c.id === sc.id ? { ...c, is_paused: true, ret: newRet, retention_score: newRet } : c));
                          setSelectedClient({ ...sc, is_paused: true, ret: newRet, retention_score: newRet });
                          setPauseConfirm(false);
                          // Persist: open pause row + bump retention_score down -4
                          try {
                            await clientEngagementPausesDb.start(user.id, sc.id);
                            await clientsDb.update(sc.id, { retention_score: newRet });
                            // Refresh pauses map so subsequent reads see the new pause
                            setEngagementPausesByClient(prev => ({
                              ...prev,
                              [sc.id]: [...(prev[sc.id] || []), { paused_at: localYmd(), resumed_at: null }],
                            }));
                          } catch (e) {
                            console.error("Failed to pause:", e);
                          }
                        }} style={{ flex: 1, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Pause engagement</button>
                        <button onClick={() => setPauseConfirm(false)} style={{ padding: "10px 14px", background: C.surface, color: C.textMuted, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                      </div>
                    </div>
                  ) : resumeConfirm ? (
                    <div style={{ background: C.primarySoft, borderRadius: 12, padding: "16px", border: "1px solid " + C.primary + "33" }}>
                      <p style={{ fontSize: 14, color: C.text, lineHeight: 1.55, marginBottom: 14 }}>Resume the engagement with this client. Their tasks will start surfacing again and tenure resumes growing. The -4 retention dent from pausing stays — it doesn't auto-restore.</p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={async () => {
                          // Optimistic
                          setClients(clients.map(c => c.id === sc.id ? { ...c, is_paused: false } : c));
                          setSelectedClient({ ...sc, is_paused: false });
                          setResumeConfirm(false);
                          try {
                            await clientEngagementPausesDb.end(user.id, sc.id);
                            // Update pauses map: set resumed_at on the open one
                            setEngagementPausesByClient(prev => {
                              const list = prev[sc.id] || [];
                              const today = localYmd();
                              const updated = list.map(p => p.resumed_at ? p : { ...p, resumed_at: today });
                              return { ...prev, [sc.id]: updated };
                            });
                          } catch (e) {
                            console.error("Failed to resume:", e);
                          }
                        }} style={{ flex: 1, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Resume engagement</button>
                        <button onClick={() => setResumeConfirm(false)} style={{ padding: "10px 14px", background: C.surface, color: C.textMuted, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                      </div>
                    </div>
                  ) : rolodexConfirm ? (
                    <div style={{ background: C.primarySoft, borderRadius: 12, padding: "16px", border: "1px solid " + C.primary + "33" }}>
                      <p style={{ fontSize: 14, color: C.text, lineHeight: 1.55, marginBottom: 14 }}>This client will be moved to your Rolodex for future tracking. Relationships change — this keeps the door open. Rai's memory of them will be cleared.</p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="r-btn" data-tone="purple" onClick={async () => {
                          // Build the rolodex row from the client being moved.
                          // Preserve as much context as possible — relationship
                          // history is the entire point of the Rolodex. None of
                          // this is reversible without manual reconstruction.
                          const todayDisplay = new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" });
                          const payload = {
                            client_name: sc.name,
                            contact_name: sc.contact || "",
                            months: sc.months || 0,
                            type: "former",
                            date_added: todayDisplay,
                            tags: [],
                            priority: null,
                            // Carry notes if present — gives the user a starting
                            // point in the retro flow rather than blank slate.
                            notes: sc.notes || "",
                            // Empty retro_answers so the standard retro flow
                            // engages (lets the user fill in why they parted).
                            retro_answers: {},
                          };
                          // Optimistic UI: insert into local state first so the
                          // user sees the row immediately. If the DB insert
                          // fails, roll back.
                          const tempId = "tmp-" + Date.now();
                          const optimistic = {
                            id: tempId,
                            client: sc.name,
                            contact: sc.contact || "",
                            months: sc.months || 0,
                            type: "former",
                            date: todayDisplay,
                            tags: [],
                            priority: null,
                            work: sc.notes || "",
                          };
                          setRolodex(prev => [optimistic, ...prev]);
                          setClients(clients.filter(c => c.id !== sc.id));
                          // Persist. Sequencing matters: deactivate the client
                          // BEFORE creating the rolodex row so that if the
                          // rolodex insert succeeds but the deactivate fails,
                          // we don't end up with the client visible in both
                          // surfaces. Reverse order would risk the opposite.
                          let createdRow = null;
                          try {
                            const { data, error } = await rolodexDb.create(user.id, payload);
                            if (error) throw error;
                            createdRow = data;
                          } catch (e) {
                            console.error("Failed to persist rolodex move:", e);
                            // Roll back UI — re-add client, drop optimistic row.
                            setRolodex(prev => prev.filter(r => r.id !== tempId));
                            setClients(prev => [...prev, sc]);
                            setRolodexConfirm(false);
                            alert("Could not move " + sc.name + " to the Rolodex. Please try again — they have not been moved.");
                            return;
                          }
                          // Swap temp row for the real DB row (gets the real
                          // UUID so subsequent edits hit the right record).
                          if (createdRow) {
                            setRolodex(prev => prev.map(r => r.id === tempId ? {
                              id: createdRow.id,
                              client: createdRow.client_name,
                              contact: createdRow.contact_name,
                              months: createdRow.months || 0,
                              type: createdRow.type,
                              date: createdRow.date_added,
                              tags: createdRow.tags || [],
                              priority: createdRow.priority,
                              work: createdRow.notes,
                            } : r));
                          }
                          // Remove this client's RECURRING tasks — once moved to
                          // the rolodex, their recurring work shouldn't keep
                          // surfacing (and would otherwise orphan into "N/A").
                          // One-off tasks are left as-is.
                          try {
                            const recurringForClient = (tasks || []).filter(t => t.client_id === sc.id && t.recurring);
                            if (recurringForClient.length) {
                              setTasks(prev => (prev || []).filter(t => !(t.client_id === sc.id && t.recurring)));
                              for (const t of recurringForClient) { tasksDb.delete(t.id); }
                            }
                          } catch (e) { console.warn("Recurring task cleanup on rolodex move failed:", e); }
                          // Mark the client deactivated in DB. If this fails
                          // we don't roll the rolodex back — the row IS in the
                          // rolodex truthfully; the client will reappear on
                          // next refresh because deactivate didn't land, but
                          // the user can retry from there. Logged loudly.
                          try {
                            await clientsDb.deactivate(sc.id);
                          } catch (e) {
                            console.error("Failed to deactivate client after rolodex move:", e);
                          }
                          setSelectedClient(null);
                          setRolodexConfirm(false);
                          setPage("retros");
                        }} style={{ flex: 1, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Move to Rolodex</button>
                        <button onClick={() => setRolodexConfirm(false)} style={{ padding: "10px 14px", background: C.surface, color: C.textMuted, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: C.bg, borderRadius: 12, padding: "16px" }}>
                      <p style={{ fontSize: 14, color: C.text, lineHeight: 1.55, marginBottom: 14 }}>This will permanently delete this client from your account — all tasks, touchpoints, health checks, and Rai's memory of them will be erased. This cannot be undone.</p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => { setClients(clients.filter(c => c.id !== sc.id));
                          clientsDb.hardDelete(sc.id); setSelectedClient(null); setRemoveConfirm(false); }} style={{ flex: 1, padding: "10px", background: C.surface, color: C.textSec, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Terminate Permanently</button>
                        <button className="r-btn" data-tone="purple" onClick={() => setRemoveConfirm(false)} style={{ padding: "10px 14px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
                  </div>
                )}

                {/* Profile — 12 dimensions */}
                {clientTab === "profile" && (
                  <div>
                    {!editingProfile ? (
                      <div>
                        {Object.keys(dims).length > 0 ? (
                          <div
                            style={{ display: "flex", justifyContent: "center", padding: "4px 0 8px", position: "relative" }}
                            onMouseLeave={() => setRadarHoverDim(null)}
                            onClick={(e) => {
                              // Clicking the empty area (not a dot) dismisses tap-pinned tooltip on mobile.
                              if (e.target.tagName !== "circle") setRadarHoverDim(null);
                            }}
                          >
                            {/* Radar — 12-point polygon with labels in a 60px
                                outer ring (away from the polygon) so long
                                names like "Communication Frequency" and
                                "Replacement" render in full without clipping.
                                Leader lines connect the spoke endpoint to the
                                label ring. Each dot has an invisible larger
                                hit-area circle around it for easier hover/tap.
                                Hovered dot enlarges + tooltip card surfaces
                                the dimension name and current value (0-10).
                                viewBox = 440 x 360 so labels have room to
                                breathe even on the longest names. */}
                            <svg width="100%" viewBox="0 0 440 360" style={{ flexShrink: 0, maxWidth: 440, overflow: "visible" }}>
                              {/* Background quartile rings */}
                              <g fill="none" stroke={C.borderLight} strokeWidth="1">
                                <circle cx="220" cy="180" r="25" />
                                <circle cx="220" cy="180" r="50" />
                                <circle cx="220" cy="180" r="75" />
                                <circle cx="220" cy="180" r="100" />
                              </g>
                              {/* Faint spokes from center to polygon edge */}
                              <g fill="none" stroke={C.borderLight} strokeWidth="0.5">
                                {profileDimensions.map((d, i) => {
                                  const angle = (i / profileDimensions.length) * 2 * Math.PI - Math.PI / 2;
                                  const x = 220 + 100 * Math.cos(angle);
                                  const y = 180 + 100 * Math.sin(angle);
                                  return <line key={d.key} x1="220" y1="180" x2={x} y2={y} />;
                                })}
                              </g>
                              {/* Leader lines from polygon edge to label ring */}
                              <g fill="none" stroke={C.borderLight} strokeWidth="0.5">
                                {profileDimensions.map((d, i) => {
                                  const angle = (i / profileDimensions.length) * 2 * Math.PI - Math.PI / 2;
                                  const x1 = 220 + 100 * Math.cos(angle);
                                  const y1 = 180 + 100 * Math.sin(angle);
                                  const x2 = 220 + 122 * Math.cos(angle);
                                  const y2 = 180 + 122 * Math.sin(angle);
                                  return <line key={d.key} x1={x1} y1={y1} x2={x2} y2={y2} />;
                                })}
                              </g>
                              {/* Polygon + dots. Dots are interactive: hover
                                  triggers tooltip via radarHoverDim state. An
                                  invisible larger circle around each dot is
                                  the actual hit area (12px radius) so the
                                  user doesn't have to land exactly on the
                                  2.5px dot. */}
                              {(() => {
                                const dotsData = profileDimensions.map((d, i) => {
                                  const val = dims[d.key] !== undefined && dims[d.key] !== null ? Number(dims[d.key]) : 0;
                                  const clamped = Math.max(0, Math.min(10, val));
                                  const angle = (i / profileDimensions.length) * 2 * Math.PI - Math.PI / 2;
                                  const r = (clamped / 10) * 100;
                                  return { key: d.key, name: d.name, val: clamped, x: 220 + r * Math.cos(angle), y: 180 + r * Math.sin(angle) };
                                });
                                const polyStr = dotsData.map(p => p.x.toFixed(1) + "," + p.y.toFixed(1)).join(" ");
                                return (
                                  <>
                                    <polygon points={polyStr} fill={C.primary} fillOpacity="0.18" stroke={C.primary} strokeWidth="1.5" strokeLinejoin="round" />
                                    {dotsData.map((p) => {
                                      const isHovered = radarHoverDim === p.key;
                                      return (
                                        <g key={p.key}>
                                          {/* Visible dot */}
                                          <circle cx={p.x} cy={p.y} r={isHovered ? 5 : 2.5} fill={C.primary} stroke={isHovered ? "#fff" : "none"} strokeWidth={isHovered ? 2 : 0} style={{ transition: "r 140ms, stroke-width 140ms" }} />
                                          {/* Invisible hit area */}
                                          <circle
                                            cx={p.x}
                                            cy={p.y}
                                            r="12"
                                            fill="transparent"
                                            style={{ cursor: "pointer" }}
                                            onMouseEnter={() => setRadarHoverDim(p.key)}
                                            onMouseLeave={() => setRadarHoverDim(null)}
                                            onClick={(e) => { e.stopPropagation(); setRadarHoverDim(p.key); }}
                                          />
                                        </g>
                                      );
                                    })}
                                  </>
                                );
                              })()}
                              {/* Labels at radius 130 — outside the polygon
                                  with breathing room. Full text (d.name).
                                  textAnchor and dominantBaseline picked by
                                  angle to keep labels nicely positioned
                                  around the ring. Hovered dim's label bolds
                                  and darkens so it's clear which one the
                                  tooltip refers to. */}
                              <g fontFamily="Manrope, sans-serif" fontSize="11" fontWeight="500">
                                {profileDimensions.map((d, i) => {
                                  const angle = (i / profileDimensions.length) * 2 * Math.PI - Math.PI / 2;
                                  const cos = Math.cos(angle);
                                  const sin = Math.sin(angle);
                                  const x = 220 + 130 * cos;
                                  const y = 180 + 130 * sin;
                                  const textAnchor = cos > 0.35 ? "start" : cos < -0.35 ? "end" : "middle";
                                  const dominantBaseline = sin > 0.35 ? "hanging" : sin < -0.35 ? "auto" : "middle";
                                  const isHovered = radarHoverDim === d.key;
                                  return (
                                    <text
                                      key={d.key}
                                      x={x}
                                      y={y}
                                      textAnchor={textAnchor}
                                      dominantBaseline={dominantBaseline}
                                      fill={isHovered ? C.text : C.textSec}
                                      fontWeight={isHovered ? 700 : 500}
                                      style={{ cursor: "pointer", transition: "fill 140ms, font-weight 140ms" }}
                                      onMouseEnter={() => setRadarHoverDim(d.key)}
                                      onMouseLeave={() => setRadarHoverDim(null)}
                                      onClick={(e) => { e.stopPropagation(); setRadarHoverDim(d.key); }}
                                    >
                                      {d.name}
                                    </text>
                                  );
                                })}
                              </g>
                            </svg>
                            {/* Tooltip card — only when a dimension is
                                hovered/tapped. Positioned dead-center over
                                the radar, sized small, dark surface so it
                                pops against the cream. Mobile tap-pins via
                                same state; tap-elsewhere dismisses (handled
                                by the outer div's onClick). */}
                            {radarHoverDim && (() => {
                              const d = profileDimensions.find(x => x.key === radarHoverDim);
                              if (!d) return null;
                              const val = dims[d.key] !== undefined && dims[d.key] !== null ? Number(dims[d.key]) : 0;
                              const clamped = Math.max(0, Math.min(10, val));
                              return (
                                <div style={{
                                  position: "absolute",
                                  top: "50%",
                                  left: "50%",
                                  transform: "translate(-50%, -50%)",
                                  background: "#1E261F",
                                  color: "#fff",
                                  borderRadius: 10,
                                  padding: "10px 14px",
                                  boxShadow: "0 8px 20px rgba(10,10,10,0.25), 0 2px 4px rgba(10,10,10,0.10)",
                                  pointerEvents: "none",
                                  fontFamily: "Manrope, sans-serif",
                                  textAlign: "center",
                                  minWidth: 100,
                                }}>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)", marginBottom: 4 }}>{d.name}</div>
                                  <div style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{clamped.toFixed(clamped % 1 === 0 ? 0 : 1)}<span style={{ fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.5)", marginLeft: 4 }}>/10</span></div>
                                </div>
                              );
                            })()}
                          </div>
                        ) : (
                          <div style={{ textAlign: "center", padding: "20px 0", color: C.textMuted, fontSize: 14 }}>
                            No profile set yet. Build one to help Rai understand this client.
                          </div>
                        )}
                        {/* Quiet edit affordance — small underlined link aligned
                            right. Previously a full-width purple Edit Profile
                            button which fought for attention against the
                            sticky-footer Edit (overview editor). This now
                            reads as a secondary edit specific to the radar,
                            not a primary CTA — sticky footer keeps the
                            visual weight for overall client actions. */}
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                          <button
                            type="button"
                            className="rt-purple-link"
                            onClick={() => { setEditScores({ ...dims }); setEditingProfile(true); }}
                            style={{
                              background: "transparent",
                              border: "none",
                              padding: "4px 0",
                              cursor: "pointer",
                              fontFamily: "inherit",
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            {Object.keys(dims).length > 0 ? "Edit relationship profile" : "Build relationship profile"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Edit Relationship Profile</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {profileDimensions.map(d => {
                            const val = editScores[d.key] !== undefined ? editScores[d.key] : 5;
                            const labels = dimLabels[d.key] || [d.name, "Low", "High"];
                            return (
                              <div key={d.key}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                                  <span style={{ fontSize: 14, fontWeight: 600 }}>{d.name}</span>
                                  <span style={{ fontSize: 14, fontWeight: 700, color: C.primary }}>{val}</span>
                                </div>
                                <input type="range" min="0" max="10" value={val} onChange={e => setEditScores({ ...editScores, [d.key]: parseInt(e.target.value) })} style={{ width: "100%", height: 6, appearance: "none", WebkitAppearance: "none", background: `linear-gradient(to right, ${C.border} 0%, ${C.primary} 100%)`, borderRadius: 3, outline: "none", cursor: "pointer" }} />
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.textMuted }}>
                                  <span>{labels[1]}</span><span>{labels[2]}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                          <button onClick={() => setEditingProfile(false)} style={{ padding: "10px 16px", background: C.surface, color: C.textSec, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                          <button onClick={async () => {
                            const newRet = calcRetentionScore(editScores, null, sc.qualifyingFlags || {}, sc.months || 0);
                            // Delta chip: re-scores update quietly — the interesting
                            // number the second time is the movement, not the reveal.
                            if (newRet && sc.ret && newRet !== sc.ret) setScoreDelta(newRet - sc.ret);
                            const updated = clients.map(c => c.id === sc.id ? { ...c, profileScores: { ...editScores }, ret: newRet || c.ret } : c);
                            setClients(updated);
                            setSelectedClient({ ...sc, profileScores: { ...editScores }, ret: newRet || sc.ret });
                            setEditingProfile(false);
                            clientsDb.updateScores(sc.id, newRet || sc.ret, { ...editScores });
                          }} style={{ flex: 1, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Save Profile</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}




                {/* Billing */}
                {clientTab === "billing" && (() => {
                  const billing = clientBilling[sc.id] || { items: [] };
                  const now = new Date();
                  const currentMonth = now.toLocaleString("default", { month: "long", year: "numeric" });
                  const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                  const nextMonth = nextDate.toLocaleString("default", { month: "long", year: "numeric" });
                  // Previous month for read-only retrospective view.
                  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                  const prevMonth = prevDate.toLocaleString("default", { month: "long", year: "numeric" });
                  // Active months = the three we render at full fidelity.
                  // prev = read-only (status togglable but no item edits).
                  // current/next = fully editable.
                  const activeMonths = [prevMonth, currentMonth, nextMonth];

                  const getMonthItems = (month) => billing.items.filter(i => i.month === month);
                  const getMonthTotal = (month) => getMonthItems(month).reduce((a, i) => a + i.amount, 0);
                  // ─── Billable hours (Jul 2026) ──────────────────────────
                  // Entries group into billing months by logged_on and price
                  // at clients.hourly_rate. The Hours block renders only when
                  // a rate is set — retainer clients see this tab unchanged.
                  const hourlyRate = parseInt(sc.hourly_rate) || 0;
                  const monthLabelOf = (ymd) => new Date(String(ymd).slice(0, 10) + "T00:00:00").toLocaleString("default", { month: "long", year: "numeric" });
                  const hoursForMonth = (month) => hourlyRate > 0
                    ? hoursEntries.filter(h => monthLabelOf(h.logged_on) === month)
                    : [];
                  const hoursSum = (list) => Math.round(list.reduce((a, h) => a + Number(h.hours || 0), 0) * 100) / 100;
                  const parseHoursInput = (raw) => {
                    const s = String(raw || "").trim().toLowerCase();
                    let m = s.match(/^(\d+(?:\.\d+)?)\s*h?$/);
                    if (m) return Math.min(24, parseFloat(m[1]));
                    m = s.match(/^(\d+)\s*m(?:in)?$/);
                    if (m) return Math.min(24, Math.round((parseInt(m[1], 10) / 60) * 100) / 100);
                    return null;
                  };
                  const addHoursEntry = async (month) => {
                    const h = parseHoursInput(hoursDraft?.h);
                    if (!h || h <= 0) return;
                    const note = (hoursDraft?.note || "").trim();
                    // Entry lands on today when logging into the current month;
                    // logging into a PAST month lands on that month's last day.
                    const now = new Date();
                    let loggedOn = localYmd(now);
                    if (month !== now.toLocaleString("default", { month: "long", year: "numeric" })) {
                      // "June 2026" → "June 1, 2026" (reliably parseable) → last day.
                      const parts = String(month).split(" ");
                      const d = new Date(`${parts[0]} 1, ${parts[1]}`);
                      if (Number.isFinite(d.getTime())) {
                        const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
                        loggedOn = localYmd(last);
                      }
                    }
                    setHoursDraft(null);
                    const ownerId = sc.user_id || user.id;
                    const tempId = "temp-h-" + Date.now();
                    const optimistic = { id: tempId, client_id: sc.id, hours: h, note: note || null, logged_on: loggedOn };
                    setHoursEntries(prev => [optimistic, ...prev]);
                    const { data, error } = await clientHoursDb.create(ownerId, user.id, sc.id, h, note, loggedOn);
                    if (error) { console.warn("Hours create failed:", error); setHoursEntries(prev => prev.filter(x => x.id !== tempId)); return; }
                    if (data) setHoursEntries(prev => prev.map(x => x.id === tempId ? data : x));
                  };
                  const removeHoursEntry = async (entry) => {
                    setHoursEntries(prev => prev.filter(x => x.id !== entry.id));
                    const { error } = await clientHoursDb.remove(entry.id);
                    if (error) { console.warn("Hours delete failed:", error); setHoursEntries(prev => [entry, ...prev]); }
                  };
                  const copyInvoiceSummary = (month) => {
                    const hrs = hoursForMonth(month).slice().sort((a, b) => String(b.logged_on).localeCompare(String(a.logged_on)));
                    const items = getMonthItems(month);
                    const hTotal = hoursSum(hrs);
                    const hAmt = Math.round(hTotal * hourlyRate);
                    const total = getMonthTotal(month) + hAmt;
                    const lines = [`${sc.name} — ${month}`];
                    for (const h of hrs) {
                      const d = new Date(String(h.logged_on).slice(0, 10) + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
                      lines.push(`${d}  ${h.note || "Work"}  —  ${Number(h.hours)}h  $${Math.round(Number(h.hours) * hourlyRate).toLocaleString()}`);
                    }
                    if (hrs.length > 0) lines.push(`Hours subtotal (${hTotal}h × $${hourlyRate})  —  $${hAmt.toLocaleString()}`);
                    for (const it of items) lines.push(`${it.description}  —  $${it.amount.toLocaleString()}`);
                    lines.push(`Total due  —  $${total.toLocaleString()}`);
                    try {
                      navigator.clipboard.writeText(lines.join("\n"));
                      setCopiedMonth(month);
                      setTimeout(() => setCopiedMonth(null), 2500);
                    } catch (e) { console.warn("Clipboard failed:", e); }
                  };
                  // pastMonths now means "older than previous month" — the deeper history list.
                  const pastMonths = [...new Set(billing.items.map(i => i.month))].filter(m => !activeMonths.includes(m));

                  // Status lookup helper. Returns { invoiced, paid } for a given
                  // month (defaults false/false if no row exists yet).
                  const getStatus = (month) => {
                    const clientStatus = billingMonthStatus[sc.id] || {};
                    const row = clientStatus[month];
                    return { invoiced: !!row?.invoiced, paid: !!row?.paid };
                  };

                  // Toggle invoiced/paid for a month. Optimistic update + DB write.
                  const toggleInvoiced = async (month) => {
                    const cur = getStatus(month);
                    const next = !cur.invoiced;
                    // Optimistic local update
                    setBillingMonthStatus(prev => {
                      const c = { ...(prev[sc.id] || {}) };
                      c[month] = { ...(c[month] || {}), invoiced: next, invoiced_at: next ? new Date().toISOString() : null };
                      return { ...prev, [sc.id]: c };
                    });
                    try {
                      const { error } = await clientBillingMonthStatusDb.setInvoiced(user.id, sc.id, month, next);
                      if (error) throw error;
                    } catch (e) {
                      console.warn("setInvoiced failed:", e);
                      // Roll back
                      setBillingMonthStatus(prev => {
                        const c = { ...(prev[sc.id] || {}) };
                        c[month] = { ...(c[month] || {}), invoiced: cur.invoiced, invoiced_at: cur.invoiced ? new Date().toISOString() : null };
                        return { ...prev, [sc.id]: c };
                      });
                    }
                  };
                  const togglePaid = async (month) => {
                    const cur = getStatus(month);
                    const next = !cur.paid;
                    setBillingMonthStatus(prev => {
                      const c = { ...(prev[sc.id] || {}) };
                      c[month] = { ...(c[month] || {}), paid: next, paid_at: next ? new Date().toISOString() : null };
                      return { ...prev, [sc.id]: c };
                    });
                    try {
                      const { error } = await clientBillingMonthStatusDb.setPaid(user.id, sc.id, month, next);
                      if (error) throw error;
                    } catch (e) {
                      console.warn("setPaid failed:", e);
                      setBillingMonthStatus(prev => {
                        const c = { ...(prev[sc.id] || {}) };
                        c[month] = { ...(c[month] || {}), paid: cur.paid, paid_at: cur.paid ? new Date().toISOString() : null };
                        return { ...prev, [sc.id]: c };
                      });
                    }
                  };

                  // ─── Billing terms handlers ────────────────────────────────
                  // Terms are an editable, append-able log per client. Newest entry
                  // is "current" (sorted by created_at desc). All entries editable
                  // and deletable.
                  const termsForClient = billingTerms[sc.id] || [];
                  const currentTerm = termsForClient[0] || null;
                  const historyTerms = termsForClient.slice(1);

                  const addTerm = async () => {
                    const body = (termsEditDraft || "").trim();
                    if (!body) return;
                    const tempId = "temp-" + Date.now();
                    // Optimistic prepend
                    const optimistic = { id: tempId, body, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
                    setBillingTerms(prev => ({ ...prev, [sc.id]: [optimistic, ...(prev[sc.id] || [])] }));
                    setTermsAddingNew(prev => ({ ...prev, [sc.id]: false }));
                    setTermsEditDraft("");
                    try {
                      const { data, error } = await clientBillingTermsDb.create(user.id, sc.id, body);
                      if (error) throw error;
                      // Swap temp ID for real
                      if (data) {
                        setBillingTerms(prev => {
                          const list = (prev[sc.id] || []).map(t => t.id === tempId ? {
                            id: data.id, body: data.body, created_at: data.created_at, updated_at: data.updated_at,
                          } : t);
                          return { ...prev, [sc.id]: list };
                        });
                      }
                    } catch (e) {
                      console.warn("addTerm failed:", e);
                      // Roll back
                      setBillingTerms(prev => ({ ...prev, [sc.id]: (prev[sc.id] || []).filter(t => t.id !== tempId) }));
                    }
                  };

                  const saveTermEdit = async (entryId) => {
                    const body = (termsEditDraft || "").trim();
                    if (!body) return;
                    const prev = termsForClient.find(t => t.id === entryId);
                    if (!prev) return;
                    setBillingTerms(curr => {
                      const list = (curr[sc.id] || []).map(t => t.id === entryId ? { ...t, body, updated_at: new Date().toISOString() } : t);
                      return { ...curr, [sc.id]: list };
                    });
                    setTermsEditingId(null);
                    setTermsEditDraft("");
                    try {
                      const { error } = await clientBillingTermsDb.update(entryId, body);
                      if (error) throw error;
                    } catch (e) {
                      console.warn("saveTermEdit failed:", e);
                      setBillingTerms(curr => {
                        const list = (curr[sc.id] || []).map(t => t.id === entryId ? prev : t);
                        return { ...curr, [sc.id]: list };
                      });
                    }
                  };

                  const removeTerm = async (entryId) => {
                    if (!confirm("Delete this entry?")) return;
                    const removed = termsForClient.find(t => t.id === entryId);
                    setBillingTerms(curr => ({ ...curr, [sc.id]: (curr[sc.id] || []).filter(t => t.id !== entryId) }));
                    try {
                      const { error } = await clientBillingTermsDb.remove(entryId);
                      if (error) throw error;
                    } catch (e) {
                      console.warn("removeTerm failed:", e);
                      // Roll back
                      if (removed) {
                        setBillingTerms(curr => {
                          const list = [...(curr[sc.id] || []), removed].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                          return { ...curr, [sc.id]: list };
                        });
                      }
                    }
                  };

                  const formatTermDate = (iso) => {
                    if (!iso) return "";
                    const d = new Date(iso);
                    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                  };


                  // ─── DB-backed billing handlers ──────────────────────────
                  // All three handlers update local state optimistically (so the
                  // UI feels snappy), then persist to Supabase. On DB error we
                  // roll back to the previous state and warn — the user sees
                  // their change revert and can try again.

                  const addItem = async (month) => {
                    if (!billingNewItem.description.trim() || !billingNewItem.amount) return;
                    const prev = clientBilling[sc.id] || { items: [] };
                    const description = billingNewItem.description.trim();
                    const amount = parseFloat(billingNewItem.amount) || 0;
                    const recurring = !!billingNewItem.recurring;

                    // Build the rows we'll insert. Recurring items mirror into the
                    // other active month (unless a same-description row already
                    // exists there — avoids dupes if the user manually added it).
                    const rowsToInsert = [{ description, amount, recurring, month }];
                    if (recurring) {
                      const otherMonth = month === currentMonth ? nextMonth : currentMonth;
                      const alreadyExists = prev.items.some(i => i.description === description && i.month === otherMonth);
                      if (!alreadyExists) {
                        rowsToInsert.push({ description, amount, recurring: true, month: otherMonth });
                      }
                    }

                    // Optimistic update — temporary local IDs (negative numbers)
                    // are replaced with real DB IDs once the insert returns.
                    const tempBase = -Date.now();
                    const optimisticRows = rowsToInsert.map((r, idx) => ({ ...r, id: tempBase - idx }));
                    const newItems = [...prev.items, ...optimisticRows];
                    setClientBilling({ ...clientBilling, [sc.id]: { ...prev, items: newItems } });
                    setBillingNewItem({ description: "", amount: "", recurring: false });
                    setBillingAddOpen(false);

                    // Persist
                    try {
                      const { data: created, error } = await clientBillingDb.createBatch(user.id, sc.id, rowsToInsert);
                      if (error) throw error;
                      // Swap optimistic IDs for real IDs from the DB
                      const tempIds = new Set(optimisticRows.map(r => r.id));
                      const finalRows = (created || []).map(r => ({
                        id: r.id,
                        description: r.description,
                        amount: Number(r.amount),
                        recurring: r.recurring,
                        month: r.month,
                      }));
                      setClientBilling(curr => {
                        const c = curr[sc.id] || { items: [] };
                        const kept = c.items.filter(i => !tempIds.has(i.id));
                        return { ...curr, [sc.id]: { ...c, items: [...kept, ...finalRows] } };
                      });
                    } catch (e) {
                      console.warn("Billing item create failed:", e);
                      // Roll back to the pre-optimistic state
                      setClientBilling({ ...clientBilling, [sc.id]: prev });
                    }
                  };

                  const removeItem = async (itemId) => {
                    const prev = clientBilling[sc.id] || { items: [] };
                    // Optimistic remove
                    setClientBilling({
                      ...clientBilling,
                      [sc.id]: { ...prev, items: prev.items.filter(i => i.id !== itemId) },
                    });
                    // Persist (skip if it's still an optimistic temp ID — those
                    // never made it to the DB, so nothing to delete).
                    if (typeof itemId === "string" || itemId >= 0) {
                      try {
                        const { error } = await clientBillingDb.remove(itemId);
                        if (error) throw error;
                      } catch (e) {
                        console.warn("Billing item remove failed:", e);
                        setClientBilling({ ...clientBilling, [sc.id]: prev });
                      }
                    }
                  };

                  const toggleRecurring = async (itemId) => {
                    const prev = clientBilling[sc.id] || { items: [] };
                    const item = prev.items.find(i => i.id === itemId);
                    if (!item) return;
                    const turningOn = !item.recurring;

                    // Build the new local state first (same logic as before).
                    let newItems = prev.items.map(i => i.id === itemId ? { ...i, recurring: !i.recurring } : i);
                    let mirrorRow = null; // populated if we add a mirror line
                    if (turningOn) {
                      const otherMonth = item.month === currentMonth ? nextMonth : currentMonth;
                      const alreadyExists = prev.items.some(i => i.description === item.description && i.month === otherMonth);
                      if (!alreadyExists) {
                        const tempId = -Date.now();
                        mirrorRow = {
                          id: tempId,
                          description: item.description,
                          amount: item.amount,
                          recurring: true,
                          month: otherMonth,
                        };
                        newItems = [...newItems, mirrorRow];
                      }
                    }

                    // Optimistic update
                    setClientBilling({ ...clientBilling, [sc.id]: { ...prev, items: newItems } });

                    // Persist: update the toggled row, and insert the mirror if needed.
                    try {
                      const { error: updateErr } = await clientBillingDb.update(itemId, { recurring: !item.recurring });
                      if (updateErr) throw updateErr;
                      if (mirrorRow) {
                        const { data: created, error: insertErr } = await clientBillingDb.create(user.id, sc.id, {
                          description: mirrorRow.description,
                          amount: mirrorRow.amount,
                          recurring: true,
                          month: mirrorRow.month,
                        });
                        if (insertErr) throw insertErr;
                        if (created) {
                          // Swap the temp ID for the real one
                          setClientBilling(curr => {
                            const c = curr[sc.id] || { items: [] };
                            const swapped = c.items.map(i => i.id === mirrorRow.id ? {
                              id: created.id,
                              description: created.description,
                              amount: Number(created.amount),
                              recurring: created.recurring,
                              month: created.month,
                            } : i);
                            return { ...curr, [sc.id]: { ...c, items: swapped } };
                          });
                        }
                      }
                    } catch (e) {
                      console.warn("Billing item toggle failed:", e);
                      setClientBilling({ ...clientBilling, [sc.id]: prev });
                    }
                  };

                  // Pill toggle component for month-level invoiced/paid status.
                  // Lives inline with the month total. Three states:
                  //   off     — gray text, gray border, transparent fill
                  //   on (invoiced)  — gold text/border, soft gold fill
                  //   on (paid)      — green text/border, soft green fill
                  const StatusPill = ({ kind, on, onClick, disabled = false }) => {
                    const onColor = kind === "invoiced" ? C.warning : C.success;
                    const onBg = kind === "invoiced" ? "#FAF0DF" : "#E8F3EC";
                    return (
                      <button
                        type="button"
                        onClick={disabled ? undefined : onClick}
                        style={{
                          padding: "3px 10px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 600,
                          border: "1px solid " + (on ? onColor : C.border),
                          background: on ? onBg : "transparent",
                          color: on ? onColor : C.textMuted,
                          cursor: disabled ? "default" : "pointer",
                          fontFamily: "inherit",
                          opacity: disabled ? 0.85 : 1,
                          transition: "background 120ms, color 120ms, border-color 120ms",
                        }}
                      >
                        {kind === "invoiced" ? "Invoiced" : "Paid"}
                      </button>
                    );
                  };

                  // renderMonth — handles current, next, and previous (read-only).
                  // readOnly controls: hides × on rows, hides "+ Add line item",
                  // hides recurring toggle button. Month-level invoiced/paid pills
                  // remain togglable even on read-only months (you might mark a past
                  // month paid after the fact).
                  const renderMonth = (month, opts = {}) => {
                    const { isNext = false, readOnly = false } = opts;
                    const items = getMonthItems(month);
                    const monthHours = hoursForMonth(month);
                    const monthHoursTotal = hoursSum(monthHours);
                    const monthHoursAmt = Math.round(monthHoursTotal * hourlyRate);
                    const total = getMonthTotal(month) + monthHoursAmt;
                    const isAdding = billingAddOpen === month;
                    const status = getStatus(month);
                    const isDraftingHours = hoursDraft?.month === month;

                    return (
                      <div key={month} style={{ marginBottom: 20, opacity: readOnly ? 0.85 : 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 12 }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 700 }}>{month}</div>
                            {isNext && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Forward billing</div>}
                            {readOnly && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Past · read-only</div>}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                            <StatusPill kind="invoiced" on={status.invoiced} onClick={() => toggleInvoiced(month)} />
                            <StatusPill kind="paid" on={status.paid} onClick={() => togglePaid(month)} />
                            {total > 0 && !isNext && (
                              <button onClick={() => copyInvoiceSummary(month)} title="Copy an itemized summary to paste into your invoicing tool" style={{ fontSize: 10.5, fontWeight: 700, padding: "5px 10px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", background: copiedMonth === month ? C.primarySoft : C.primaryDeep, color: copiedMonth === month ? C.primaryDeep : "#fff", whiteSpace: "nowrap", transition: "background 150ms ease" }}>
                                {copiedMonth === month ? "Copied ✓" : "Copy summary"}
                              </button>
                            )}
                            {(items.length > 0 || monthHours.length > 0) && (
                              <span style={{ fontSize: 14, fontWeight: 700, color: C.primary, marginLeft: 4 }}>${total.toLocaleString()}</span>
                            )}
                          </div>
                        </div>

                        {/* ─── Hours block — only when a rate is on file ─── */}
                        {hourlyRate > 0 && (monthHours.length > 0 || !readOnly) && (
                          <div style={{ marginBottom: items.length > 0 ? 6 : 0 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: C.textMuted, padding: "4px 0 2px" }}>
                              Hours{monthHoursTotal > 0 ? ` · ${monthHoursTotal}h` : ""}
                            </div>
                            {monthHours.map(h => (
                              <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid " + C.borderLight, fontSize: 13 }}>
                                <span style={{ color: C.textMuted, width: 46, flexShrink: 0, fontSize: 11.5, fontVariantNumeric: "tabular-nums" }}>{new Date(String(h.logged_on).slice(0, 10) + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                                <span style={{ flex: 1, minWidth: 0, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.note || "Work"}</span>
                                <span style={{ fontWeight: 700, color: C.textSec, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{Number(h.hours)}h</span>
                                <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", flexShrink: 0, width: 58, textAlign: "right" }}>${Math.round(Number(h.hours) * hourlyRate).toLocaleString()}</span>
                                {!readOnly && <button onClick={() => removeHoursEntry(h)} style={{ background: "none", border: "none", fontSize: 13, color: C.borderLight, cursor: "pointer", padding: "0 2px", fontFamily: "inherit" }}>×</button>}
                              </div>
                            ))}
                            {!readOnly && (isDraftingHours ? (
                              <div style={{ display: "flex", gap: 6, padding: "9px 0", alignItems: "center" }}>
                                <input autoFocus value={hoursDraft.h} onChange={e => setHoursDraft({ ...hoursDraft, h: e.target.value })} onKeyDown={e => { if (e.key === "Enter") addHoursEntry(month); }} placeholder="2h" style={{ width: 58, textAlign: "center", padding: "8px 6px", border: "none", boxShadow: "inset 0 0 0 1px " + C.borderLight, borderRadius: 8, fontSize: 12.5, fontFamily: "inherit", outline: "none", background: C.card, color: C.text }} />
                                <input value={hoursDraft.note} onChange={e => setHoursDraft({ ...hoursDraft, note: e.target.value })} onKeyDown={e => { if (e.key === "Enter") addHoursEntry(month); }} placeholder="What was it? (optional)" style={{ flex: 1, minWidth: 0, padding: "8px 10px", border: "none", boxShadow: "inset 0 0 0 1px " + C.borderLight, borderRadius: 8, fontSize: 12.5, fontFamily: "inherit", outline: "none", background: C.card, color: C.text }} />
                                <button onClick={() => addHoursEntry(month)} disabled={!parseHoursInput(hoursDraft.h)} style={{ padding: "8px 12px", background: parseHoursInput(hoursDraft.h) ? C.primaryDeep : C.surfaceWarm, color: parseHoursInput(hoursDraft.h) ? "#fff" : C.textMuted, border: "none", borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: parseHoursInput(hoursDraft.h) ? "pointer" : "default", fontFamily: "inherit" }}>Log</button>
                                <button onClick={() => setHoursDraft(null)} style={{ background: "none", border: "none", fontSize: 12, color: C.textMuted, cursor: "pointer", fontFamily: "inherit", padding: "0 2px" }}>✕</button>
                              </div>
                            ) : (
                              <button onClick={() => setHoursDraft({ month, h: "", note: "" })} style={{ background: "transparent", border: "none", padding: "8px 0 4px", fontFamily: "inherit", fontSize: 12, fontWeight: 700, color: C.primary, cursor: "pointer" }}>+ hours</button>
                            ))}
                            {monthHours.length > 0 && (
                              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 12, color: C.textSec, borderBottom: items.length > 0 ? "1px solid " + C.borderLight : "none" }}>
                                <span>Hours subtotal · {monthHoursTotal}h × ${hourlyRate.toLocaleString()}</span>
                                <span style={{ fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums" }}>${monthHoursAmt.toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                        )}
                        {items.map(item => (
                          <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderBottom: "1px solid " + C.borderLight }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontSize: 14, fontWeight: 600 }}>{item.description}</span>
                                {item.recurring && <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 3, background: C.primarySoft, color: C.primary, fontWeight: 600 }}>↻ Recurring</span>}
                              </div>
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 700, marginRight: 4 }}>${item.amount.toLocaleString()}</span>
                            {!readOnly && (
                              <>
                                <button onClick={() => toggleRecurring(item.id)} style={{ background: "none", border: "none", fontSize: 12, color: item.recurring ? C.primary : C.borderLight, cursor: "pointer", padding: "2px" }}>↻</button>
                                <button onClick={() => removeItem(item.id)} style={{ background: "none", border: "none", fontSize: 14, color: C.borderLight, cursor: "pointer", padding: "0 2px" }}>×</button>
                              </>
                            )}
                          </div>
                        ))}

                        {items.length === 0 && monthHours.length === 0 && !isAdding && !isDraftingHours && (
                          <div style={{ padding: "12px 0", fontSize: 14, color: C.textMuted }}>
                            {readOnly ? "Nothing logged for this month." : hourlyRate > 0 ? "No items or hours yet." : "No items yet."}
                          </div>
                        )}

                        {!readOnly && (isAdding ? (
                          <div style={{ padding: "12px 0", display: "flex", flexDirection: "column", gap: 8 }}>
                            <input value={billingNewItem.description} onChange={e => setBillingNewItem({ ...billingNewItem, description: e.target.value })} placeholder="Description (e.g. Retainer, Creative refresh)" style={{ padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg }} />
                            <input type="number" value={billingNewItem.amount} onChange={e => setBillingNewItem({ ...billingNewItem, amount: e.target.value })} placeholder="Amount ($)" style={{ padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg }} />
                            <div onClick={() => setBillingNewItem({ ...billingNewItem, recurring: !billingNewItem.recurring })} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", cursor: "pointer" }}>
                              <div style={{ width: 18, height: 18, borderRadius: 4, border: billingNewItem.recurring ? "none" : "1.5px solid " + C.border, background: billingNewItem.recurring ? C.primary : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {billingNewItem.recurring && <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>✓</span>}
                              </div>
                              <span style={{ fontSize: 14, color: C.textSec }}>Make recurring (auto-adds each month)</span>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button className="r-btn" data-tone="purple" onClick={() => addItem(month)} style={{ flex: 1, padding: "10px", background: billingNewItem.description.trim() && billingNewItem.amount ? C.btn : C.surface, color: billingNewItem.description.trim() && billingNewItem.amount ? "#fff" : C.textMuted, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Add</button>
                              <button onClick={() => { setBillingAddOpen(false); setBillingNewItem({ description: "", amount: "", recurring: false }); }} style={{ padding: "10px 14px", background: C.surface, color: C.textMuted, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setBillingAddOpen(month)} style={{ width: "100%", padding: "10px", background: "transparent", color: C.primary, border: "1px dashed " + C.border, borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 6 }}>+ Add line item</button>
                        ))}
                      </div>
                    );
                  };

                  return (
                    <div>
                      {/* ─── Hourly rate (Jul 2026) — the price the Hours
                          blocks bill at. Unset = hours UI hidden entirely. ─── */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.surfaceWarm, borderRadius: 10, padding: "10px 13px", marginBottom: 14 }}>
                        {rateEditing ? (
                          <>
                            <span style={{ fontSize: 12.5, color: C.textSec }}>Hourly rate $</span>
                            <input autoFocus type="number" min="0" value={rateDraft} onChange={e => setRateDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { const v = parseInt(rateDraft) || 0; setRateEditing(false); setSelectedClient(prev => prev ? { ...prev, hourly_rate: v } : prev); setClients(prev => prev.map(c => c.id === sc.id ? { ...c, hourly_rate: v } : c)); clientsDb.update(sc.id, { hourly_rate: v || null }).then(({ error }) => { if (error) console.warn("Rate save failed:", error); }); } }} placeholder="150" style={{ width: 74, padding: "6px 9px", border: "none", boxShadow: "inset 0 0 0 1px " + C.borderLight, borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", background: C.card, color: C.text }} />
                            <span style={{ fontSize: 12.5, color: C.textMuted }}>/hr</span>
                            <button onClick={() => { const v = parseInt(rateDraft) || 0; setRateEditing(false); setSelectedClient(prev => prev ? { ...prev, hourly_rate: v } : prev); setClients(prev => prev.map(c => c.id === sc.id ? { ...c, hourly_rate: v } : c)); clientsDb.update(sc.id, { hourly_rate: v || null }).then(({ error }) => { if (error) console.warn("Rate save failed:", error); }); }} style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 700, color: "#fff", background: C.primaryDeep, border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontFamily: "inherit" }}>Save</button>
                            <button onClick={() => setRateEditing(false)} style={{ background: "none", border: "none", fontSize: 12, color: C.textMuted, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
                          </>
                        ) : (
                          <>
                            <span style={{ fontSize: 12.5, color: C.textSec }}>
                              {hourlyRate > 0
                                ? <>Billing: <b style={{ fontWeight: 800, color: C.text, fontVariantNumeric: "tabular-nums" }}>Hourly · ${hourlyRate.toLocaleString()}/hr</b></>
                                : <>No hourly rate on file — set one to log billable hours.</>}
                            </span>
                            <button onClick={() => { setRateDraft(hourlyRate ? String(hourlyRate) : ""); setRateEditing(true); }} style={{ marginLeft: "auto", background: "none", border: "none", fontSize: 11.5, fontWeight: 700, color: C.primary, cursor: "pointer", fontFamily: "inherit" }}>{hourlyRate > 0 ? "Edit rate" : "Set rate"}</button>
                          </>
                        )}
                      </div>
                      {/* ─── Billing terms section ─── */}
                      {/* Standard card pattern: white bg, hairline border,
                          10px radius. Matches every other card in the app
                          (Settings rows, client list cards, etc). No tinted
                          surface, no gold left rule — the cream-on-cream
                          collision with the tab bar above made the previous
                          paper-note treatment feel buried. */}
                      <div style={{
                        background: C.card,
                        borderRadius: 10,
                        padding: "14px 16px",
                        marginBottom: 18,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                            Billing terms
                          </span>
                          <span style={{ fontSize: 11, color: C.textMuted }}>
                            {currentTerm ? formatTermDate(currentTerm.created_at) : "No entries yet"}
                            {termsForClient.length > 0 && ` · ${termsForClient.length === 1 ? "1 entry" : `${termsForClient.length} entries`}`}
                          </span>
                        </div>

                        {/* Body — current entry, edit, add, or empty */}
                        {currentTerm && termsEditingId !== currentTerm.id && !termsAddingNew[sc.id] && (
                          <div>
                            <div style={{ fontSize: 13, lineHeight: 1.55, color: C.text, whiteSpace: "pre-wrap" }}>{currentTerm.body}</div>
                            <div style={{ display: "flex", gap: 14, marginTop: 8, paddingTop: 8, borderTop: "0.5px dashed " + C.borderLight, fontSize: 11, color: C.textMuted }}>
                              <button onClick={() => { setTermsEditingId(currentTerm.id); setTermsEditDraft(currentTerm.body); }} style={{ background: "none", border: "none", padding: 0, fontSize: 11, color: C.textMuted, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Edit</button>
                              <button onClick={() => removeTerm(currentTerm.id)} style={{ background: "none", border: "none", padding: 0, fontSize: 11, color: C.textMuted, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
                              {historyTerms.length > 0 && (
                                <button onClick={() => setTermsHistoryOpen(prev => ({ ...prev, [sc.id]: !prev[sc.id] }))} style={{ background: "none", border: "none", padding: 0, fontSize: 11, color: C.textMuted, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                                  {termsHistoryOpen[sc.id] ? "Hide" : "View"} history ({historyTerms.length})
                                </button>
                              )}
                              <span style={{ flex: 1 }} />
                              <button onClick={() => { setTermsAddingNew(prev => ({ ...prev, [sc.id]: true })); setTermsEditDraft(""); }} style={{ background: "none", border: "none", padding: 0, fontSize: 11, color: C.textMuted, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>+ New entry</button>
                            </div>
                          </div>
                        )}

                        {/* Editing the current entry */}
                        {currentTerm && termsEditingId === currentTerm.id && (
                          <div>
                            <textarea autoFocus value={termsEditDraft} onChange={e => setTermsEditDraft(e.target.value)} placeholder="Describe the billing arrangement…" style={{ width: "100%", padding: "10px 12px", borderRadius: 4, fontSize: 13, fontFamily: "inherit", outline: "none", background: C.card, minHeight: 100, resize: "vertical", lineHeight: 1.55, color: C.text, boxSizing: "border-box" }} />
                            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                              <button onClick={() => saveTermEdit(currentTerm.id)} disabled={!termsEditDraft.trim()} style={{ padding: "6px 12px", background: termsEditDraft.trim() ? C.text : "transparent", color: termsEditDraft.trim() ? "#fff" : C.textMuted, border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: termsEditDraft.trim() ? "pointer" : "default", fontFamily: "inherit" }}>Save</button>
                              <button onClick={() => { setTermsEditingId(null); setTermsEditDraft(""); }} style={{ padding: "6px 12px", background: "transparent", color: C.textMuted, borderRadius: 4, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                            </div>
                          </div>
                        )}

                        {/* Adding a new entry */}
                        {termsAddingNew[sc.id] && (
                          <div>
                            {currentTerm && <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8, fontStyle: "italic" }}>Adding a new entry will become the current terms. Previous entry stays in history.</div>}
                            <textarea autoFocus value={termsEditDraft} onChange={e => setTermsEditDraft(e.target.value)} placeholder="Describe the billing arrangement…" style={{ width: "100%", padding: "10px 12px", borderRadius: 4, fontSize: 13, fontFamily: "inherit", outline: "none", background: C.card, minHeight: 100, resize: "vertical", lineHeight: 1.55, color: C.text, boxSizing: "border-box" }} />
                            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                              <button onClick={addTerm} disabled={!termsEditDraft.trim()} style={{ padding: "6px 12px", background: termsEditDraft.trim() ? C.text : "transparent", color: termsEditDraft.trim() ? "#fff" : C.textMuted, border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: termsEditDraft.trim() ? "pointer" : "default", fontFamily: "inherit" }}>Add entry</button>
                              <button onClick={() => { setTermsAddingNew(prev => ({ ...prev, [sc.id]: false })); setTermsEditDraft(""); }} style={{ padding: "6px 12px", background: "transparent", color: C.textMuted, borderRadius: 4, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                            </div>
                          </div>
                        )}

                        {/* Empty state — no entries, not adding */}
                        {!currentTerm && !termsAddingNew[sc.id] && (
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 4 }}>
                            <span style={{ fontSize: 12, color: C.textMuted, fontStyle: "italic" }}>No billing terms recorded.</span>
                            <button onClick={() => { setTermsAddingNew(prev => ({ ...prev, [sc.id]: true })); setTermsEditDraft(""); }} style={{ background: "none", border: "none", padding: 0, fontSize: 11, color: C.textMuted, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>+ Add entry</button>
                          </div>
                        )}

                        {/* History (older entries) — expanded */}
                        {termsHistoryOpen[sc.id] && historyTerms.length > 0 && (
                          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "0.5px solid " + C.borderLight }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>History</div>
                            {historyTerms.map(t => (
                              <div key={t.id} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: "0.5px dashed " + C.borderLight }}>
                                {termsEditingId === t.id ? (
                                  <div>
                                    <textarea autoFocus value={termsEditDraft} onChange={e => setTermsEditDraft(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 4, fontSize: 13, fontFamily: "inherit", outline: "none", background: C.card, minHeight: 80, resize: "vertical", lineHeight: 1.55, color: C.text, boxSizing: "border-box" }} />
                                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                      <button onClick={() => saveTermEdit(t.id)} disabled={!termsEditDraft.trim()} style={{ padding: "6px 12px", background: termsEditDraft.trim() ? C.text : "transparent", color: termsEditDraft.trim() ? "#fff" : C.textMuted, border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: termsEditDraft.trim() ? "pointer" : "default", fontFamily: "inherit" }}>Save</button>
                                      <button onClick={() => { setTermsEditingId(null); setTermsEditDraft(""); }} style={{ padding: "6px 10px", background: "transparent", color: C.textMuted, borderRadius: 4, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, marginBottom: 4 }}>{formatTermDate(t.created_at)}</div>
                                    <div style={{ fontSize: 13, lineHeight: 1.55, color: C.textSec, whiteSpace: "pre-wrap" }}>{t.body}</div>
                                    <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                                      <button onClick={() => { setTermsEditingId(t.id); setTermsEditDraft(t.body); }} style={{ background: "none", border: "none", padding: 0, fontSize: 11, color: C.textMuted, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Edit</button>
                                      <button onClick={() => removeTerm(t.id)} style={{ background: "none", border: "none", padding: 0, fontSize: 11, color: C.textMuted, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Months — next, current, previous (all read-write for status, prev read-only for items) */}
                      {renderMonth(nextMonth, { isNext: true })}
                      <div style={{ height: 1, background: C.border, margin: "4px 0 20px" }} />
                      {renderMonth(currentMonth)}
                      <div style={{ height: 1, background: C.border, margin: "4px 0 20px" }} />
                      {renderMonth(prevMonth, { readOnly: true })}

                      {pastMonths.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8, paddingTop: 12, borderTop: "1px solid " + C.borderLight }}>Earlier months</div>
                          {pastMonths.map((month, mi) => {
                            const items = getMonthItems(month);
                            const total = getMonthTotal(month) + Math.round(hoursSum(hoursForMonth(month)) * hourlyRate);
                            const status = getStatus(month);
                            return (
                              <div key={mi} style={{ background: C.bg, borderRadius: 8, padding: "10px 12px", marginBottom: 6 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: items.length > 0 ? 4 : 0 }}>
                                  <span style={{ fontSize: 14, fontWeight: 600 }}>{month}</span>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    {status.invoiced && <span style={{ fontSize: 10, fontWeight: 700, color: C.warning, padding: "2px 7px", borderRadius: 999, background: "#FAF0DF" }}>Invoiced</span>}
                                    {status.paid && <span style={{ fontSize: 10, fontWeight: 700, color: C.success, padding: "2px 7px", borderRadius: 999, background: "#E8F3EC" }}>Paid</span>}
                                    <span style={{ fontSize: 14, fontWeight: 700, color: C.primary, marginLeft: 4 }}>${total.toLocaleString()}</span>
                                  </div>
                                </div>
                                {items.length > 0 && (
                                  <div style={{ fontSize: 12, color: C.textMuted }}>
                                    {items.map(i => i.description).join(", ")}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* ─── AD-HOC REVENUE (client_addons) ─────────── */}
                      {/* Section for one-time payments outside the monthly
                          rate — setup fees, project bonuses, annual
                          prepays, late fees, anything not on the retainer.
                          Each addon = one DB row, listed newest-first.
                          Saving updates client_addons, which feeds into
                          LTV calc + Rai's context payload. */}
                      <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid " + C.borderLight }}>
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: C.text }}>
                            Ad-hoc revenue
                          </div>
                          {(() => {
                            const addons = clientAddons[sc.id] || [];
                            if (addons.length === 0) return null;
                            const total = addons.reduce((s, a) => s + Number(a.amount || 0), 0);
                            return (
                              <div style={{ fontSize: 12, color: C.textMuted, fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace" }}>
                                {addons.length} {addons.length === 1 ? "entry" : "entries"} · ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                            );
                          })()}
                        </div>
                        <div style={{ fontSize: 12.5, color: C.textMuted, marginBottom: 16, lineHeight: 1.5 }}>
                          One-time payments outside the monthly rate — setup fees, project bonuses, lump sums. These count toward LTV.
                        </div>

                        {/* Existing addons list */}
                        {(clientAddons[sc.id] || []).length > 0 && (
                          <div style={{ marginBottom: 16 }}>
                            {(clientAddons[sc.id] || []).map(a => {
                              const isEditing = editingAddonId === a.id;
                              return (
                                <div key={a.id} style={{
                                  display: "flex", alignItems: "center", gap: 10,
                                  padding: "10px 12px",
                                  borderBottom: "1px solid " + C.borderLight,
                                  fontSize: 13,
                                }}>
                                  {isEditing ? (
                                    <>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={editingAddon.amount}
                                        onChange={e => setEditingAddon(p => ({ ...p, amount: e.target.value }))}
                                        placeholder="0.00"
                                        style={{
                                          width: 100, padding: "6px 8px",
                                          border: "1px solid " + C.borderLight, borderRadius: 6,
                                          fontFamily: "inherit", fontSize: 13,
                                        }}
                                      />
                                      <input
                                        type="date"
                                        value={editingAddon.charged_at}
                                        onChange={e => setEditingAddon(p => ({ ...p, charged_at: e.target.value }))}
                                        style={{
                                          padding: "6px 8px",
                                          border: "1px solid " + C.borderLight, borderRadius: 6,
                                          fontFamily: "inherit", fontSize: 13,
                                        }}
                                      />
                                      <input
                                        type="text"
                                        value={editingAddon.description}
                                        onChange={e => setEditingAddon(p => ({ ...p, description: e.target.value }))}
                                        placeholder="Description"
                                        style={{
                                          flex: 1, padding: "6px 8px",
                                          border: "1px solid " + C.borderLight, borderRadius: 6,
                                          fontFamily: "inherit", fontSize: 13,
                                        }}
                                      />
                                      <button
                                        onClick={async () => {
                                          const amt = parseFloat(editingAddon.amount);
                                          if (!isFinite(amt) || amt <= 0) return;
                                          // Optimistic update
                                          const patch = {
                                            amount: amt,
                                            charged_at: editingAddon.charged_at,
                                            description: editingAddon.description.trim() || null,
                                          };
                                          setClientAddons(prev => ({
                                            ...prev,
                                            [sc.id]: (prev[sc.id] || []).map(x => x.id === a.id ? { ...x, ...patch } : x),
                                          }));
                                          setEditingAddonId(null);
                                          try {
                                            await clientAddonsDb.update(a.id, patch);
                                          } catch (e) {
                                            console.warn("addon update failed:", e);
                                          }
                                        }}
                                        style={{
                                          padding: "6px 12px", border: "none", borderRadius: 6,
                                          background: C.btn, color: "#fff", fontSize: 12, fontWeight: 600,
                                          cursor: "pointer", fontFamily: "inherit",
                                        }}
                                      >Save</button>
                                      <button
                                        onClick={() => setEditingAddonId(null)}
                                        style={{
                                          padding: "6px 10px", border: "none", borderRadius: 6,
                                          background: "transparent", color: C.textMuted, fontSize: 12,
                                          cursor: "pointer", fontFamily: "inherit",
                                        }}
                                      >Cancel</button>
                                    </>
                                  ) : (
                                    <>
                                      <div style={{
                                        fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                                        fontWeight: 600, fontSize: 13,
                                        width: 100, textAlign: "right",
                                        color: C.text,
                                      }}>
                                        ${Number(a.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </div>
                                      <div style={{
                                        fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                                        fontSize: 11.5, color: C.textMuted,
                                        width: 90, flexShrink: 0,
                                      }}>
                                        {a.charged_at}
                                      </div>
                                      <div style={{ flex: 1, color: a.description ? C.text : C.textMuted, fontStyle: a.description ? "normal" : "italic" }}>
                                        {a.description || "(no description)"}
                                      </div>
                                      <button
                                        onClick={() => {
                                          setEditingAddonId(a.id);
                                          setEditingAddon({
                                            amount: String(a.amount),
                                            charged_at: a.charged_at,
                                            description: a.description || "",
                                          });
                                        }}
                                        style={{
                                          padding: "4px 10px", border: "none", borderRadius: 6,
                                          background: "transparent", color: C.textSec, fontSize: 12,
                                          cursor: "pointer", fontFamily: "inherit",
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = "rgba(20,30,22,0.04)"}
                                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                      >Edit</button>
                                      <button
                                        onClick={async () => {
                                          if (!confirm("Delete this addon?")) return;
                                          setClientAddons(prev => ({
                                            ...prev,
                                            [sc.id]: (prev[sc.id] || []).filter(x => x.id !== a.id),
                                          }));
                                          try {
                                            await clientAddonsDb.delete(a.id);
                                          } catch (e) {
                                            console.warn("addon delete failed:", e);
                                          }
                                        }}
                                        style={{
                                          padding: "4px 10px", border: "none", borderRadius: 6,
                                          background: "transparent", color: C.danger, fontSize: 12,
                                          cursor: "pointer", fontFamily: "inherit",
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = "rgba(196,67,43,0.06)"}
                                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                      >Delete</button>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Add new addon row */}
                        <div style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "12px 12px",
                          background: C.surface,
                          borderRadius: 10,
                        }}>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={newAddon.amount}
                            onChange={e => setNewAddon(p => ({ ...p, amount: e.target.value }))}
                            placeholder="0.00"
                            style={{
                              width: 100, padding: "8px 10px",
                              border: "1px solid " + C.borderLight, borderRadius: 6,
                              fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace", fontSize: 13,
                              background: C.card,
                            }}
                          />
                          <input
                            type="date"
                            value={newAddon.charged_at || new Date().toISOString().slice(0, 10)}
                            onChange={e => setNewAddon(p => ({ ...p, charged_at: e.target.value }))}
                            style={{
                              padding: "8px 10px",
                              border: "1px solid " + C.borderLight, borderRadius: 6,
                              fontFamily: "inherit", fontSize: 13,
                              background: C.card,
                            }}
                          />
                          <input
                            type="text"
                            value={newAddon.description}
                            onChange={e => setNewAddon(p => ({ ...p, description: e.target.value }))}
                            placeholder="What was this for? (setup fee, project bonus, annual prepay…)"
                            onKeyDown={async e => {
                              if (e.key !== "Enter") return;
                              const amt = parseFloat(newAddon.amount);
                              if (!isFinite(amt) || amt <= 0) return;
                              const charged = newAddon.charged_at || new Date().toISOString().slice(0, 10);
                              const desc = newAddon.description.trim() || null;
                              try {
                                const { data } = await clientAddonsDb.add(user.id, sc.id, { amount: amt, charged_at: charged, description: desc });
                                if (data) {
                                  setClientAddons(prev => ({
                                    ...prev,
                                    [sc.id]: [data, ...(prev[sc.id] || [])],
                                  }));
                                  setNewAddon({ amount: "", description: "", charged_at: "" });
                                }
                              } catch (err) {
                                console.warn("addon add failed:", err);
                              }
                            }}
                            style={{
                              flex: 1, padding: "8px 10px",
                              border: "1px solid " + C.borderLight, borderRadius: 6,
                              fontFamily: "inherit", fontSize: 13,
                              background: C.card,
                            }}
                          />
                          <button
                            onClick={async () => {
                              const amt = parseFloat(newAddon.amount);
                              if (!isFinite(amt) || amt <= 0) return;
                              const charged = newAddon.charged_at || new Date().toISOString().slice(0, 10);
                              const desc = newAddon.description.trim() || null;
                              try {
                                const { data } = await clientAddonsDb.add(user.id, sc.id, { amount: amt, charged_at: charged, description: desc });
                                if (data) {
                                  setClientAddons(prev => ({
                                    ...prev,
                                    [sc.id]: [data, ...(prev[sc.id] || [])],
                                  }));
                                  setNewAddon({ amount: "", description: "", charged_at: "" });
                                }
                              } catch (err) {
                                console.warn("addon add failed:", err);
                              }
                            }}
                            disabled={!newAddon.amount || parseFloat(newAddon.amount) <= 0}
                            style={{
                              padding: "8px 16px", border: "none", borderRadius: 8,
                              background: (!newAddon.amount || parseFloat(newAddon.amount) <= 0) ? C.surface : "var(--rt-grad-purple)",
                              color: (!newAddon.amount || parseFloat(newAddon.amount) <= 0) ? C.textMuted : "#fff",
                              fontSize: 13, fontWeight: 700,
                              cursor: (!newAddon.amount || parseFloat(newAddon.amount) <= 0) ? "default" : "pointer",
                              fontFamily: "inherit",
                              flexShrink: 0,
                            }}
                          >Add</button>
                        </div>
                      </div>

                    </div>
                  );
                })()}

                {/* Flags — pill toggles with descriptions. Score impact hidden — scoring is magic. */}
                {/* ─── DOCS TAB (Jul 2026) — contracts and proposals filed on
                    the client. Upload / list / download / delete. Kind chip
                    auto-guessed from the filename, tap to cycle. AM uploads
                    carry attribution; delete is owner-side (RLS-enforced). ─── */}
                {clientTab === "docs" && (() => {
                  const KINDS = ["contract", "proposal", "other"];
                  const KIND_META = {
                    contract: { label: "CONTRACT", color: C.primaryDeep, bg: C.primarySoft },
                    proposal: { label: "PROPOSAL", color: "#8A6A2F", bg: "#FAF0DF" },
                    other:    { label: "OTHER",    color: C.textSec,   bg: C.borderLight },
                  };
                  const guessKind = (name) => {
                    const n = String(name || "").toLowerCase();
                    if (/(msa|contract|sow|agreement|nda)/.test(n)) return "contract";
                    if (/(proposal|quote|estimate|pitch|scope)/.test(n)) return "proposal";
                    return "other";
                  };
                  const fmtSize = (b) => b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB";
                  const extOf = (name) => (String(name).split(".").pop() || "").slice(0, 4).toUpperCase() || "FILE";
                  const ALLOWED = /\.(pdf|docx?|xlsx?|png|jpe?g)$/i;
                  const handleFiles = async (fileList) => {
                    const file = fileList && fileList[0];
                    if (!file || docBusy) return;
                    setDocError("");
                    if (file.size > 25 * 1048576) { setDocError("25 MB max per file."); return; }
                    if (!ALLOWED.test(file.name)) { setDocError("PDF, DOC, XLSX, PNG or JPG only."); return; }
                    setDocBusy(true);
                    const ownerId = sc.user_id || user.id;
                    const { data, error } = await clientDocsDb.upload(ownerId, user.id, sc.id, file, guessKind(file.name));
                    setDocBusy(false);
                    if (error) { console.warn("Doc upload failed:", error); setDocError("Upload failed — " + (error.message || "try again.")); return; }
                    if (data) setDocs(prev => [data, ...prev]);
                  };
                  const cycleKind = (doc) => {
                    const next = KINDS[(KINDS.indexOf(doc.kind) + 1) % KINDS.length];
                    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, kind: next } : d));
                    clientDocsDb.setKind(doc.id, next).then(({ error }) => { if (error) console.warn("Kind update failed:", error); });
                  };
                  const openDoc = async (doc) => {
                    const { url, error } = await clientDocsDb.signedUrl(doc.storage_path);
                    if (url) window.open(url, "_blank", "noopener");
                    else console.warn("Signed URL failed:", error);
                  };
                  const deleteDoc = async (doc) => {
                    if (docDeleteId !== doc.id) { setDocDeleteId(doc.id); return; }
                    setDocDeleteId(null);
                    setDocs(prev => prev.filter(d => d.id !== doc.id));
                    const { error } = await clientDocsDb.remove(doc);
                    if (error) { console.warn("Doc delete failed:", error); setDocs(prev => [doc, ...prev]); }
                  };
                  return (
                    <div>
                      <label
                        onDragOver={e => { e.preventDefault(); setDocDragOver(true); }}
                        onDragLeave={() => setDocDragOver(false)}
                        onDrop={e => { e.preventDefault(); setDocDragOver(false); handleFiles(e.dataTransfer.files); }}
                        style={{ display: "block", border: "1.5px dashed " + (docDragOver ? C.primary : C.border), borderRadius: 12, padding: "20px 16px", textAlign: "center", background: docDragOver ? C.primaryGhost : C.bg, cursor: docBusy ? "wait" : "pointer", transition: "border-color 120ms ease, background 120ms ease" }}
                      >
                        <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" style={{ display: "none" }} onChange={e => { handleFiles(e.target.files); e.target.value = ""; }} disabled={docBusy} />
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.textSec }}>{docBusy ? "Uploading…" : "Drop a file here, or tap to browse"}</div>
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>Contracts, proposals, SOWs · PDF, DOC, XLSX, PNG · up to 25 MB</div>
                      </label>
                      {docError && (
                        <div style={{ fontSize: 12, color: C.danger, marginTop: 8, lineHeight: 1.4 }}>{docError}</div>
                      )}
                      {docs.length > 0 && (
                        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: C.textMuted, margin: "16px 0 2px" }}>On file · {docs.length}</div>
                      )}
                      {docs.length === 0 && !docBusy && (
                        <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontStyle: "italic", fontWeight: 500, fontVariationSettings: "'opsz' 96, 'SOFT' 50, 'WONK' 0", fontSize: 13, color: C.textMuted, textAlign: "center", padding: "22px 12px", lineHeight: 1.55 }}>
                          Nothing filed yet. The contract belongs where the relationship lives.
                        </div>
                      )}
                      {docs.map((doc, i) => {
                        const km = KIND_META[doc.kind] || KIND_META.other;
                        return (
                          <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 2px", borderBottom: i === docs.length - 1 ? "none" : "1px solid " + C.borderLight }}>
                            <div style={{ width: 34, height: 38, borderRadius: 7, background: C.surfaceWarm, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: 0.4, color: C.textSec }}>{extOf(doc.name)}</span>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <button onClick={() => openDoc(doc)} style={{ background: "transparent", border: "none", padding: 0, fontFamily: "inherit", fontSize: 13.5, fontWeight: 600, color: C.text, cursor: "pointer", textAlign: "left", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{doc.name}</button>
                              <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 4, flexWrap: "wrap" }}>
                                <button onClick={() => cycleKind(doc)} title="Tap to change type" style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 0.5, padding: "2.5px 7px", borderRadius: 4, border: "none", cursor: "pointer", fontFamily: "inherit", color: km.color, background: km.bg }}>{km.label}</button>
                                <span style={{ fontSize: 10.5, color: C.textMuted }}>
                                  {fmtSize(doc.size_bytes)} · {new Date(doc.uploaded_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                                  {doc.uploaded_by && <span> · uploaded by a seat</span>}
                                </span>
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                              <button onClick={() => openDoc(doc)} title="Download" style={{ width: 28, height: 28, borderRadius: 8, border: "none", background: "transparent", color: C.textMuted, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>⬇</button>
                              <button onClick={() => deleteDoc(doc)} title={docDeleteId === doc.id ? "Tap again to delete" : "Delete"} style={{ height: 28, minWidth: 28, padding: docDeleteId === doc.id ? "0 8px" : 0, borderRadius: 8, border: "none", background: docDeleteId === doc.id ? "#FBEDE9" : "transparent", color: docDeleteId === doc.id ? C.danger : C.textMuted, cursor: "pointer", fontSize: docDeleteId === doc.id ? 10.5 : 13, fontWeight: docDeleteId === doc.id ? 700 : 400, fontFamily: "inherit" }}>{docDeleteId === doc.id ? "Sure?" : "✕"}</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
                {clientTab === "flags" && (
                  <div>
                    <div style={{ fontSize: 12.5, color: C.textSec, lineHeight: 1.5, marginBottom: 14 }}>
                      These characteristics shape your health score behind the scenes. Keep them current as your client relationship changes.
                    </div>
                    {[
                      { flag: "latePayments",   label: "Late payments",       desc: "Has missed or delayed invoices", delta: -4 },
                      { flag: "prevTerminated", label: "Previously terminated", desc: "Has churned and returned",      delta: -8 },
                      { flag: "otherVendors",   label: "Works with competitors", desc: "Uses other vendors in parallel", delta: -3 },
                      // "From referral" removed Jul 2026 — provenance, not a
                      // relationship flag, and its predictive value is
                      // unproven. Lineage lives in the Overview facts row.
                    ].map(f => {
                      const on = !!sc.qualifyingFlags?.[f.flag];
                      return (
                        <div key={f.flag} onClick={async () => {
                          const newFlags = { ...(sc.qualifyingFlags || {}), [f.flag]: !on };
                          const newRet = Math.max(1, Math.min(99, (sc.ret || 50) + (on ? -f.delta : f.delta)));
                          setClients(prev => prev.map(c => c.id === sc.id ? { ...c, qualifyingFlags: newFlags, ret: newRet } : c));
                          setSelectedClient({ ...sc, qualifyingFlags: newFlags, ret: newRet });
                          clientsDb.update(sc.id, { qualifying_flags: newFlags, retention_score: newRet });
                        }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 0", borderBottom: "1px solid " + C.borderLight, cursor: "pointer" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{f.label}</div>
                            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{f.desc}</div>
                          </div>
                          <div style={{ width: 40, height: 22, borderRadius: 11, background: on ? C.primary : C.border, padding: 2, transition: "background 0.2s", display: "flex", alignItems: "center", flexShrink: 0 }}>
                            <div style={{ width: 18, height: 18, borderRadius: 9, background: "#fff", transform: on ? "translateX(18px)" : "translateX(0)", transition: "transform 0.2s" }} />
                          </div>
                        </div>
                      );
                    })}
                    {/* Paused — fifth entry. Unlike the four above, this is
                        NOT an independently-toggleable qualifying flag: it
                        mirrors the client's actual pause state (is_paused),
                        the single source of truth. Toggling it routes through
                        the same pause/resume confirmation modal as the
                        overflow menu, so the -4 is applied in exactly one
                        place (the pause handler) and never double-counts.
                        Shown here purely for transparency — so the user sees
                        the pause penalty alongside the other score factors. */}
                    {(() => {
                      const on = !!sc.is_paused;
                      return (
                        <div onClick={() => {
                          setClientTab("overview");
                          if (on) { setResumeConfirm(true); } else { setPauseConfirm(true); }
                          setRolodexConfirm(false); setRemoveConfirm(false);
                        }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 0", borderBottom: "1px solid " + C.borderLight, cursor: "pointer" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Paused</div>
                            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Relationship is on hold — tenure clock frozen</div>
                          </div>
                          <div style={{ width: 40, height: 22, borderRadius: 11, background: on ? C.warning : C.border, padding: 2, transition: "background 0.2s", display: "flex", alignItems: "center", flexShrink: 0 }}>
                            <div style={{ width: 18, height: 18, borderRadius: 9, background: "#fff", transform: on ? "translateX(18px)" : "translateX(0)", transition: "transform 0.2s" }} />
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* ─── CONFIDANT TAB — per-client Rai chat ─────────── */}
                {/* Threading model: one persistent conversation per
                    (user, client) pair, loaded via convoDb.getOrCreate
                    on tab open. Edge Function gets focused_client_id
                    set so Rai sees the full 30-day relationship history
                    (touchpoints, completions, calendar, observations).
                    Messages cap at 30 in active context, but full
                    history persists in DB. */}
                {clientTab === "rai" && (
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    height: "calc(100vh - 280px)",
                    minHeight: 480,
                    background: "linear-gradient(180deg, " + C.surfaceWarm + "00, " + C.primaryGhost + "60)",
                    borderRadius: 12,
                    border: "1px solid " + C.borderLight,
                    overflow: "hidden",
                  }}>
                    {/* Eyebrow — client avatar + "Talking with Rai about [client]" */}
                    <div style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid " + C.borderLight,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      background: C.card,
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%",
                        background: sc.color || C.primary,
                        color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700,
                        flexShrink: 0,
                      }}>
                        {(sc.name || "?").slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{sc.name}</div>
                        <div style={{ fontSize: 11, color: C.textMuted, fontFamily: "'Fraunces', Georgia, serif", fontStyle: "italic" }}>
                          {(() => {
                            // Subtitle has two modes: "fresh thread" shows
                            // the explainer ("She remembers everything"),
                            // "thread with history" shows when the last
                            // exchange happened. Reading "Last spoke 3d
                            // ago" is the moment the persistence becomes
                            // visible to the user — without it, the
                            // memory feature is invisible.
                            if (!confidantLastActivity || confidantMessages.length === 0) {
                              return "A private thread with Rai. She remembers everything.";
                            }
                            const diffMs = Date.now() - new Date(confidantLastActivity).getTime();
                            const hours = Math.floor(diffMs / (60 * 60 * 1000));
                            let when;
                            if (hours < 1) when = "just now";
                            else if (hours < 24) when = hours + "h ago";
                            else {
                              const days = Math.floor(hours / 24);
                              if (days === 1) when = "yesterday";
                              else if (days < 30) when = days + "d ago";
                              else {
                                const months = Math.floor(days / 30);
                                when = months + "mo ago";
                              }
                            }
                            const exchangeCount = Math.floor(confidantMessages.length / 2);
                            return `Last spoke ${when} · ${exchangeCount} exchange${exchangeCount === 1 ? "" : "s"} on file`;
                          })()}
                        </div>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M12 4l2.2 5.8 5.8 2.2-5.8 2.2L12 20l-2.2-5.8L4 12l5.8-2.2L12 4z" fill={C.btn} />
                      </svg>
                    </div>

                    {/* Message list */}
                    <div style={{
                      flex: 1,
                      overflowY: "auto",
                      padding: "16px 16px 4px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}>
                      {confidantLoadingThread ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: C.textMuted, fontSize: 13 }}>
                          Loading conversation…
                        </div>
                      ) : confidantMessages.length === 0 ? (
                        <div style={{
                          margin: "auto",
                          textAlign: "center",
                          maxWidth: 360,
                          padding: "32px 24px",
                        }}>
                          <div style={{
                            fontFamily: "'Fraunces', Georgia, serif",
                            fontStyle: "italic",
                            fontSize: 22,
                            color: C.text,
                            letterSpacing: "-0.015em",
                            marginBottom: 10,
                            lineHeight: 1.25,
                          }}>
                            Hi. What's on your mind about {sc.name}?
                          </div>
                          <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.55 }}>
                            I have their last 30 days in mind — touchpoints, completed work, what's coming up. Ask me anything.
                          </div>
                        </div>
                      ) : (
                        confidantMessages.map((m, i) => (
                          <div key={i} style={{
                            display: "flex",
                            justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                          }}>
                            <div style={{
                              maxWidth: "78%",
                              padding: "10px 14px",
                              borderRadius: 14,
                              background: m.role === "user" ? C.text : C.card,
                              color: m.role === "user" ? "#fff" : C.text,
                              fontSize: 16,
                              lineHeight: 1.5,
                              boxShadow: m.role === "ai" ? "var(--rt-sh-xs)" : "none",
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                            }}>
                              {m.text || (m.role === "ai" ? (
                                <span style={{ color: C.textMuted }}>…</span>
                              ) : null)}
                              {m.role === "ai" && !confidantTyping && <RaiMessageActions text={m.text} />}
                            </div>
                          </div>
                        ))
                      )}
                      {confidantTyping && confidantMessages.length > 0 && confidantMessages[confidantMessages.length - 1]?.role !== "ai" && (
                        <div style={{ display: "flex", justifyContent: "flex-start" }}>
                          <div style={{
                            padding: "10px 14px",
                            borderRadius: 14,
                            background: C.card,
                            color: C.textMuted,
                            fontSize: 16,
                            boxShadow: "var(--rt-sh-xs)",
                          }}>
                            …
                          </div>
                        </div>
                      )}
                      <div ref={confidantEndRef} />
                    </div>

                    {/* Input bar */}
                    <div style={{
                      padding: "12px 16px",
                      borderTop: "1px solid " + C.borderLight,
                      background: C.card,
                      display: "flex",
                      alignItems: "flex-end",
                      gap: 10,
                    }}>
                      <textarea
                        value={confidantInput}
                        onChange={e => setConfidantInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (confidantInput.trim() && !confidantTyping) {
                              sendConfidantMessage(confidantInput, sc.id);
                            }
                          }
                        }}
                        placeholder={`Ask Rai about ${sc.name}…`}
                        rows={1}
                        style={{
                          flex: 1,
                          border: "1px solid " + C.borderLight,
                          borderRadius: 10,
                          padding: "10px 12px",
                          fontSize: 16,
                          fontFamily: "inherit",
                          background: C.bg,
                          color: C.text,
                          resize: "none",
                          minHeight: 38,
                          maxHeight: 160,
                          outline: "none",
                          lineHeight: 1.4,
                        }}
                        disabled={confidantTyping || confidantLoadingThread}
                      />
                      <button
                        onClick={() => {
                          if (confidantInput.trim() && !confidantTyping) {
                            sendConfidantMessage(confidantInput, sc.id);
                          }
                        }}
                        disabled={!confidantInput.trim() || confidantTyping || confidantLoadingThread}
                        style={{
                          padding: "10px 16px",
                          borderRadius: 10,
                          border: "none",
                          background: confidantInput.trim() && !confidantTyping ? "var(--rt-grad-purple)" : C.surface,
                          color: confidantInput.trim() && !confidantTyping ? "#fff" : C.textMuted,
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: confidantInput.trim() && !confidantTyping ? "pointer" : "default",
                          fontFamily: "inherit",
                          flexShrink: 0,
                          height: 38,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {confidantTyping ? "Thinking…" : "Send"}
                      </button>
                    </div>
                  </div>
                )}

              </div>

            </div>
          </>
        );
      })()}
  </>);
}
