// ─── RolodexModal (June 2026 refactor) ─────────────────────────────────
// Extracted VERBATIM from App.jsx — only this shell + imports are new.
// Receives the same ctx-object pattern the pages use; the contract is
// enforced by the extraction scanner + ctx checker.
import { rolodex as rolodexDb } from "../lib/db";
import { C } from "../theme";
import { localYmd } from "../utils";
import { Icon } from "./Icon";

export default function RolodexModal({ app }) {
  const {
    user,
    answers,
    d,
    n,
    p,
    sel,
    t,
    total,
    updated,
    rolodexRemoveConfirm,
    active,
    clients,
    day,
    gap,
    history,
    id,
    kept,
    left,
    months,
    on,
    q,
    r,
    reminderDate,
    reminderRecur,
    reminderRepeatOn,
    retroAnswers,
    right,
    rolodex,
    rolodexEditData,
    rolodexEditing,
    rolodexMenuOpen,
    rolodexMoveConfirm,
    selectedRolodex,
    setReminderDate,
    setReminderRecur,
    setReminderRepeatOn,
    setRetroAnswers,
    setRolodex,
    setRolodexEditData,
    setRolodexEditing,
    setRolodexMenuOpen,
    setRolodexMoveConfirm,
    setRolodexRemoveConfirm,
    setSelectedRolodex,
    setShowReminderPicker,
    showReminderPicker,
    size,
    title,
    value,
    x,
  } = app;
  return (<>
{selectedRolodex && (() => {
        const sr = selectedRolodex;
        const answers = retroAnswers[sr.id] || {};
        const ed = rolodexEditData;
        const priorityOpts = [
          { id: "high", label: "High priority", color: C.success },
          { id: "medium", label: "Medium priority", color: C.warning },
          { id: "low", label: "Low priority", color: C.textMuted },
        ];
        return (
          <>
            {/* Backdrop — matches the client modal: dim + 2px blur. */}
            <div onClick={() => setSelectedRolodex(null)} style={{ position: "fixed", inset: 0, background: "rgba(20,30,22,0.38)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)", zIndex: 90 }} />
            <div className="r-client-modal" style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "100%", maxWidth: 520, maxHeight: "90vh", background: C.card, boxShadow: "0 1px 3px rgba(20,30,22,0.10), 0 8px 20px rgba(20,30,22,0.14), 0 25px 50px rgba(20,30,22,0.22), inset 0 1px 0 rgba(255,255,255,0.9)", zIndex: 100, overflowY: "auto", borderRadius: 16 }}>
              {/* Top bar — neighbor nav (↑↓) + breadcrumb + ⋯ actions + ×,
                  matching the client modal chrome exactly. */}
              {(() => {
                const navList = (rolodex || []).filter(r => r && r.id);
                const currentIdx = navList.findIndex(r => r.id === sr.id);
                const total = navList.length;
                const hasNav = total > 1 && currentIdx >= 0;
                const goPrev = () => { if (!hasNav) return; const n = navList[currentIdx === 0 ? total - 1 : currentIdx - 1]; if (n) setSelectedRolodex(n); };
                const goNext = () => { if (!hasNav) return; const n = navList[currentIdx === total - 1 ? 0 : currentIdx + 1]; if (n) setSelectedRolodex(n); };
                const prevC = hasNav ? navList[currentIdx === 0 ? total - 1 : currentIdx - 1] : null;
                const nextC = hasNav ? navList[currentIdx === total - 1 ? 0 : currentIdx + 1] : null;
                return (
                  <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, position: "sticky", top: 0, background: C.card, zIndex: 2, borderBottom: "1px solid " + C.borderLight }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                      <button onClick={goPrev} disabled={!hasNav} title={prevC ? `Previous · ${prevC.client}` : "Previous"} aria-label="Previous" className="rt-so-nav" style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", color: hasNav ? C.textSec : C.textMuted, cursor: hasNav ? "pointer" : "default", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16, lineHeight: 1, padding: 0 }}>↑</button>
                      <button onClick={goNext} disabled={!hasNav} title={nextC ? `Next · ${nextC.client}` : "Next"} aria-label="Next" className="rt-so-nav" style={{ width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent", color: hasNav ? C.textSec : C.textMuted, cursor: hasNav ? "pointer" : "default", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16, lineHeight: 1, padding: 0 }}>↓</button>
                    </div>
                    {hasNav && (
                      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: C.textMuted, fontVariantNumeric: "tabular-nums", display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span>Rolodex</span>
                        <span style={{ opacity: 0.5 }}>·</span>
                        <span>{currentIdx + 1} of {total}</span>
                      </div>
                    )}
                    <div style={{ marginLeft: "auto", position: "relative", display: "flex", alignItems: "center", gap: 6 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setRolodexMenuOpen(v => !v); }}
                        aria-label="Contact actions"
                        style={{ background: rolodexMenuOpen ? C.surfaceWarm : "none", border: "none", fontSize: 20, cursor: "pointer", color: rolodexMenuOpen ? C.text : C.textSec, lineHeight: 1, padding: 0, width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, transition: "background 120ms ease" }}
                      >⋯</button>
                      {rolodexMenuOpen && (
                        <>
                          <div onClick={() => setRolodexMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 4 }} />
                          <div style={{ position: "absolute", top: 36, right: 0, background: C.card, border: "1px solid " + C.borderLight, borderRadius: 10, boxShadow: "0 8px 24px rgba(20,30,22,0.12), 0 2px 6px rgba(20,30,22,0.06)", minWidth: 180, padding: 6, zIndex: 5 }}>
                            <div
                              onClick={() => { setRolodexMenuOpen(false); setRolodexEditing(true); setRolodexEditData({ contact: sr.contact, months: sr.months, priority: sr.priority || "", notes: sr.notes || "", what: answers.what || "", work: answers.work || "", terms: answers.terms || "", comeback: answers.comeback || "", refer: answers.refer || "" }); }}
                              style={{ padding: "10px 12px", fontSize: 13, color: C.text, cursor: "pointer", borderRadius: 6, fontWeight: 500 }}
                              onMouseEnter={e => e.currentTarget.style.background = C.surfaceWarm}
                              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                            >Edit details</div>
                            <div
                              onClick={() => { setRolodexMenuOpen(false); setRolodexMoveConfirm(true); setRolodexRemoveConfirm(false); }}
                              style={{ padding: "10px 12px", fontSize: 13, color: C.text, cursor: "pointer", borderRadius: 6, fontWeight: 500 }}
                              onMouseEnter={e => e.currentTarget.style.background = C.surfaceWarm}
                              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                            >Move to Clients</div>
                            <div style={{ borderTop: "1px solid " + C.borderLight, margin: "4px 0" }} />
                            <div
                              onClick={() => { setRolodexMenuOpen(false); setRolodexRemoveConfirm(true); setRolodexMoveConfirm(false); }}
                              style={{ padding: "10px 12px", fontSize: 13, color: C.danger, cursor: "pointer", borderRadius: 6, fontWeight: 500 }}
                              onMouseEnter={e => e.currentTarget.style.background = C.surfaceWarm}
                              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                            >Delete</div>
                          </div>
                        </>
                      )}
                      <button onClick={() => setSelectedRolodex(null)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.textMuted, lineHeight: 1, padding: 0, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                    </div>
                  </div>
                );
              })()}

              {/* Hero — gradient band: type · name, matching client modal hero. */}
              <div style={{ padding: "20px 20px 14px", background: "linear-gradient(180deg, " + C.surfaceWarm + " 0%, " + C.card + " 100%)" }}>
                <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, marginBottom: 6 }}>
                  {sr.type === "oneoff" ? "New lead" : "Former Client"}{sr.months > 0 ? " · " + (sr.months >= 12 ? (sr.months / 12).toFixed(1) + " years" : sr.months + " months") : ""}
                </div>
                <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, color: C.text, margin: 0, lineHeight: 1.15 }}>{sr.client}</h2>
              </div>

              {/* Move-to-Clients confirm */}
              {rolodexMoveConfirm && (
                <div style={{ margin: "0 20px 12px", padding: 14, background: C.primaryGhost, borderRadius: 10, border: "1px solid " + C.borderLight }}>
                  <p style={{ fontSize: 14, color: C.text, lineHeight: 1.5, marginBottom: 12 }}>Move {sr.client} into your active clients? They'll start fresh at a neutral score and this rolodex entry will be archived.</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => moveRolodexToClients(sr)} className="r-btn" data-tone="purple" style={{ flex: 1, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Move to Clients</button>
                    <button onClick={() => setRolodexMoveConfirm(false)} style={{ padding: "10px 14px", background: C.surface, color: C.text, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                  </div>
                </div>
              )}
              {/* Delete confirm */}
              {rolodexRemoveConfirm && (
                <div style={{ margin: "0 20px 12px", padding: 14, background: "#FBEAE3", borderRadius: 10, border: "1px solid " + C.borderLight }}>
                  <p style={{ fontSize: 14, color: C.text, lineHeight: 1.5, marginBottom: 12 }}>Delete {sr.client} from your rolodex? They'll be archived — kept on file but no longer shown. Referral history stays intact.</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { setRolodex(prev => prev.filter(x => x.id !== sr.id)); rolodexDb.delete(sr.id); setSelectedRolodex(null); setRolodexRemoveConfirm(false); }} style={{ flex: 1, padding: "10px", background: C.danger, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
                    <button onClick={() => setRolodexRemoveConfirm(false)} style={{ padding: "10px 14px", background: C.surface, color: C.text, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                  </div>
                </div>
              )}
              <div style={{ padding: "4px 20px 16px" }}>
                {!rolodexEditing ? (
                  <>
                    {[
                      { l: "Contact", v: sr.contact },
                      { l: "Together", v: sr.months > 0 ? sr.months + " months" : "One-time" },
                      { l: "Added", v: sr.date },
                      { l: "Priority", v: sr.priority ? (sr.priority === "high" ? "High" : sr.priority === "medium" ? "Medium" : "Low") : "Not set" },
                      { l: "Reminder", v: sr.reminder ? (new Date(sr.reminder).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + (sr.reminderRecurrence && sr.reminderRecurrence !== "none" ? " · repeats " + ({ "2w": "2wk", "1m": "monthly", "3m": "3mo", "6m": "6mo" }[sr.reminderRecurrence] || "") : "")) : "None set" },
                    ].map((d, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid " + C.borderLight }}>
                        <span style={{ fontSize: 14, color: C.textMuted }}>{d.l}</span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: d.l === "Reminder" && sr.reminder ? C.primary : C.text }}>{d.v}</span>
                      </div>
                    ))}
                    {sr.notes && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>Notes</div>
                        <div style={{ fontSize: 14, color: C.text, lineHeight: 1.5, background: C.bg, borderRadius: 8, padding: "10px 12px" }}>{sr.notes}</div>
                      </div>
                    )}
                    {(answers.what || answers.work) && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>History</div>
                        {[
                          { l: "What happened", v: answers.what },
                          { l: "What you did", v: answers.work },
                          { l: "How it ended", v: answers.terms },
                          { l: "Would come back", v: answers.comeback },
                          { l: "Would refer", v: answers.refer },
                        ].filter(d => d.v).map((d, i) => (
                          <div key={i} style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 14, color: C.textMuted, marginBottom: 2 }}>{d.l}</div>
                            <div style={{ fontSize: 14, color: C.text, lineHeight: 1.4 }}>{d.v}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {sr.tags.length > 0 && (
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 14 }}>
                        {sr.tags.map((t, j) => <span key={j} style={{ fontSize: 12, padding: "3px 8px", borderRadius: 4, background: t.includes("Would refer") || t.includes("Good terms") || t.includes("Would come back") ? C.primarySoft : C.surface, color: t.includes("Would refer") || t.includes("Good terms") || t.includes("Would come back") ? C.primary : C.textSec, fontWeight: 600 }}>{t}</span>)}
                      </div>
                    )}
                    {!showReminderPicker ? (
                      <button onClick={() => { setShowReminderPicker(true); setReminderDate(sr.reminder || ""); const rc = sr.reminderRecurrence || "none"; setReminderRepeatOn(rc !== "none"); setReminderRecur(rc !== "none" ? rc : "1m"); }} style={{ width: "100%", padding: "12px 14px", background: sr.reminder ? C.primaryGhost : C.surfaceWarm, color: sr.reminder ? C.primary : C.text, border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 16, textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        {sr.reminder ? (
                          <>
                            <span>Check-in reminder{sr.reminderRecurrence && sr.reminderRecurrence !== "none" ? " · repeats" : ""}</span>
                            <span style={{ fontWeight: 600, color: C.primary }}>{new Date(sr.reminder + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                          </>
                        ) : (
                          <>
                            <span style={{ color: C.textSec }}>Set a check-in reminder</span>
                            <Icon name="chevron-right" size={15} color={C.textMuted} />
                          </>
                        )}
                      </button>
                    ) : null}
                    {!showReminderPicker && sr.reminder && String(sr.reminder).slice(0, 10) <= localYmd() && (() => {
                      const recurring = sr.reminderRecurrence && sr.reminderRecurrence !== "none";
                      return (
                        <button onClick={async () => {
                          // Acting on a due check-in. Recurring → advance to the next
                          // occurrence (now + interval, snapped to Monday). One-off → clear.
                          let nextDate = null, nextRecur = "none";
                          if (recurring) {
                            const days = { "2w": 14, "1m": 30, "3m": 90, "6m": 180 }[sr.reminderRecurrence] || 30;
                            const t = new Date(Date.now() + days * 86400000);
                            const dow = t.getDay();
                            const diff = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
                            nextDate = localYmd(new Date(t.getTime() + diff * 86400000));
                            nextRecur = sr.reminderRecurrence;
                          }
                          const prev = rolodex;
                          setRolodex(p => p.map(x => x.id === sr.id ? { ...x, reminder: nextDate, reminderRecurrence: nextRecur } : x));
                          setSelectedRolodex({ ...sr, reminder: nextDate, reminderRecurrence: nextRecur });
                          try {
                            const { error } = await rolodexDb.update(sr.id, { reminder_date: nextDate, reminder_recurrence: nextRecur });
                            if (error) throw error;
                          } catch (e) {
                            console.error("Check-in advance failed:", e);
                            setRolodex(prev); setSelectedRolodex(sr);
                            alert("Could not update reminder. Please try again.");
                          }
                        }} style={{ width: "100%", padding: "10px 14px", marginTop: 8, background: C.primary, color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                          Mark checked in{recurring ? " · schedule next" : ""}
                        </button>
                      );
                    })()}
                    {showReminderPicker && (
                      <div style={{ marginTop: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>When should Rai remind you?</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                          {[
                            { label: "2 weeks", days: 14, recur: "2w" },
                            { label: "1 month", days: 30, recur: "1m" },
                            { label: "3 months", days: 90, recur: "3m" },
                            { label: "6 months", days: 180, recur: "6m" },
                          ].map(q => {
                            const target = new Date(Date.now() + q.days * 24 * 60 * 60 * 1000);
                            const dow = target.getDay();
                            const diff = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
                            const monday = new Date(target.getTime() + diff * 24 * 60 * 60 * 1000);
                            const d = localYmd(monday);
                            const sel = reminderDate === d;
                            return (
                              <button key={q.label} onClick={() => { setReminderDate(d); setReminderRecur(q.recur); }} style={{ flex: 1, padding: "10px 8px", borderRadius: 8, border: "1.5px solid " + (sel ? C.primary : C.border), background: sel ? C.primarySoft : C.bg, color: sel ? C.primary : C.text, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{q.label}</button>
                            );
                          })}
                        </div>
                        {reminderDate && <div style={{ fontSize: 14, color: C.primary, fontWeight: 600, marginBottom: 12 }}>Monday, {new Date(reminderDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>}
                        {reminderDate && (() => {
                          const label = { "2w": "every 2 weeks", "1m": "monthly", "3m": "every 3 months", "6m": "every 6 months" }[reminderRecur] || "on a repeat";
                          return (
                            <button onClick={() => setReminderRepeatOn(v => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "10px 12px", marginBottom: 12, background: reminderRepeatOn ? C.primaryGhost : C.bg, border: "1.5px solid " + (reminderRepeatOn ? C.primary : C.border), borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>
                              <span style={{ fontSize: 13.5, fontWeight: 600, color: reminderRepeatOn ? C.primary : C.textSec }}>Repeat {reminderRepeatOn ? label : ""}</span>
                              <span style={{ width: 36, height: 20, borderRadius: 999, background: reminderRepeatOn ? C.primary : C.border, position: "relative", flexShrink: 0, transition: "background 150ms" }}>
                                <span style={{ position: "absolute", top: 2, left: reminderRepeatOn ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 150ms" }} />
                              </span>
                            </button>
                          );
                        })()}
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={async () => {
                            // Persist the reminder date to DB. Before this fix
                            // the reminder was only kept in local state and
                            // would disappear on refresh — silent data loss.
                            if (reminderDate) {
                              const recurVal = reminderRepeatOn ? reminderRecur : "none";
                              const prev = rolodex;
                              setRolodex(p => p.map(x => x.id === sr.id ? { ...x, reminder: reminderDate, reminderRecurrence: recurVal } : x));
                              setSelectedRolodex({ ...sr, reminder: reminderDate, reminderRecurrence: recurVal });
                              try {
                                const { error } = await rolodexDb.update(sr.id, { reminder_date: reminderDate, reminder_recurrence: recurVal });
                                if (error) throw error;
                              } catch (e) {
                                console.error("Reminder save failed:", e);
                                setRolodex(prev);
                                setSelectedRolodex(sr);
                                alert("Could not save reminder. Please try again.");
                                return;
                              }
                            }
                            setShowReminderPicker(false);
                          }} style={{ flex: 1, padding: "11px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
                          {sr.reminder && <button onClick={async () => {
                            // Persist the reminder removal to DB. Same data-
                            // loss pattern as the save path — was previously
                            // local-only.
                            const prev = rolodex;
                            setRolodex(p => p.map(x => x.id === sr.id ? { ...x, reminder: null, reminderRecurrence: "none" } : x));
                            setSelectedRolodex({ ...sr, reminder: null, reminderRecurrence: "none" });
                            setReminderDate("");
                            setReminderRepeatOn(false);
                            setShowReminderPicker(false);
                            try {
                              const { error } = await rolodexDb.update(sr.id, { reminder_date: null, reminder_recurrence: "none" });
                              if (error) throw error;
                            } catch (e) {
                              console.error("Reminder remove failed:", e);
                              setRolodex(prev);
                              setSelectedRolodex(sr);
                              alert("Could not remove reminder. Please try again.");
                            }
                          }} style={{ padding: "10px 14px", background: "transparent", color: C.danger, border: "1px solid " + C.danger + "44", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Remove</button>}
                          <button onClick={() => setShowReminderPicker(false)} style={{ padding: "10px 14px", background: C.surface, color: C.text, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Edit Details</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Contact name</label>
                        <input value={ed.contact} onChange={e => setRolodexEditData({...ed, contact: e.target.value})} style={{ width: "100%", padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Months together</label>
                        <input type="number" value={ed.months} onChange={e => setRolodexEditData({...ed, months: parseInt(e.target.value) || 0})} style={{ width: "100%", padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Priority</label>
                        <div style={{ display: "flex", gap: 6 }}>
                          {priorityOpts.map(opt => (
                            <button key={opt.id} onClick={() => setRolodexEditData({...ed, priority: opt.id})} style={{ flex: 1, padding: "8px", borderRadius: 6, border: "1.5px solid " + (ed.priority === opt.id ? opt.color : C.borderLight), background: ed.priority === opt.id ? opt.color + "18" : C.bg, color: ed.priority === opt.id ? opt.color : C.textSec, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{opt.label.replace(" priority", "")}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Notes</label>
                        <textarea value={ed.notes} onChange={e => setRolodexEditData({...ed, notes: e.target.value})} placeholder="Log a check-in, add context, anything worth remembering..." style={{ width: "100%", padding: "10px 12px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg, minHeight: 80, resize: "vertical" }} />
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginTop: 16, marginBottom: 12 }}>History</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {sr.type === "former" ? (
                        <>
                          <div><label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>What happened?</label><textarea value={ed.what} onChange={e => setRolodexEditData({...ed, what: e.target.value})} placeholder="Contract ended, budget cut, went in-house..." style={{ width: "100%", padding: "10px 12px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg, minHeight: 60, resize: "vertical" }} /></div>
                          <div><label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>How did it end?</label><textarea value={ed.terms} onChange={e => setRolodexEditData({...ed, terms: e.target.value})} placeholder="Good terms, neutral, rough..." style={{ width: "100%", padding: "10px 12px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg, minHeight: 60, resize: "vertical" }} /></div>
                          <div><label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Would they come back?</label><textarea value={ed.comeback} onChange={e => setRolodexEditData({...ed, comeback: e.target.value})} placeholder="Yes, maybe, no..." style={{ width: "100%", padding: "10px 12px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg, minHeight: 60, resize: "vertical" }} /></div>
                        </>
                      ) : (
                        <div><label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>What did you do for them?</label><textarea value={ed.work} onChange={e => setRolodexEditData({...ed, work: e.target.value})} placeholder="Site audit, consulting session..." style={{ width: "100%", padding: "10px 12px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg, minHeight: 60, resize: "vertical" }} /></div>
                      )}
                      <div><label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Would they refer you?</label><textarea value={ed.refer} onChange={e => setRolodexEditData({...ed, refer: e.target.value})} placeholder="Even if they left, would they recommend you?" style={{ width: "100%", padding: "10px 12px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg, minHeight: 60, resize: "vertical" }} /></div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                      <button onClick={() => setRolodexEditing(false)} style={{ padding: "10px 16px", background: C.surface, color: C.textSec, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                      <button onClick={async () => {
                        const tags = [];
                        if ((ed.terms || "").toLowerCase().includes("good")) tags.push("Good terms");
                        if ((ed.refer || "").toLowerCase().includes("yes")) tags.push("Would refer");
                        if ((ed.comeback || "").toLowerCase().includes("yes")) tags.push("Would come back");
                        if (sr.type === "oneoff") tags.push("New lead");
                        const newRetroAnswers = { ...(retroAnswers[sr.id] || {}), what: ed.what, work: ed.work, terms: ed.terms, comeback: ed.comeback, refer: ed.refer };
                        const updated = { ...sr, contact: ed.contact, months: ed.months, priority: ed.priority, notes: ed.notes, tags };
                        // Persist to DB. Before this fix, edits were local-only —
                        // refreshing the page lost every change. The DB column
                        // map: contact→contact_name, months→months, priority→
                        // priority, notes→notes, tags→tags, plus retro_answers.
                        const prevRolodex = rolodex;
                        const prevAnswers = retroAnswers;
                        setRolodex(prev => prev.map(x => x.id === sr.id ? updated : x));
                        setRetroAnswers(prev => ({ ...prev, [sr.id]: newRetroAnswers }));
                        setSelectedRolodex(updated);
                        setRolodexEditing(false);
                        try {
                          const { error } = await rolodexDb.update(sr.id, {
                            contact_name: ed.contact,
                            months: parseInt(ed.months) || 0,
                            priority: ed.priority || null,
                            notes: ed.notes || "",
                            tags,
                            retro_answers: newRetroAnswers,
                          });
                          if (error) throw error;
                        } catch (e) {
                          console.error("Rolodex edit save failed:", e);
                          setRolodex(prevRolodex);
                          setRetroAnswers(prevAnswers);
                          setSelectedRolodex(sr);
                          alert("Could not save changes. Please try again — your edits were not persisted.");
                        }
                      }} style={{ flex: 1, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        );
      })()}
  </>);
}
