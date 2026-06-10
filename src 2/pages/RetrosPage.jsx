// AUTO-EXTRACTED from App.jsx (page === "retros" block) — body is
// verbatim; only the surrounding component shell + imports are generated.
import { rolodex as rolodexDb } from "../lib/db";
import { Icon } from "../components/Icon";
import { EmptyState } from "../components/Skeletons";
import { createPortal } from "react-dom";
import { C } from "../theme";
import { retGradient } from "../utils";

export default function RetrosPage({ app }) {
  const {
    clients,
    dataLoaded,
    newRolodexEntry,
    retroDeleteConfirm,
    rolodex,
    rolodexFiledFilter,
    rolodexFlowOpen,
    rolodexSearch,
    rolodexStep,
    rolodexStepOwner,
    rolodexStepText,
    setNewRolodexEntry,
    setRetroDeleteConfirm,
    setRolodex,
    setRolodexFiledFilter,
    setRolodexFlowOpen,
    setRolodexSearch,
    setRolodexStep,
    setRolodexStepOwner,
    setRolodexStepText,
    setSelectedRolodex,
    setShowAddRolodex,
    showAddRolodex,
    user,
  } = app;

          try {
          // ─── Helpers ───────────────────────────────────────────────────
          // Avatars: deterministic palette by id, initials from name.
          const AVATAR_COLORS = ["#1F7A5C"];
          const getInitials = (name) => (name || "?").split(/\s+/).map(w => w[0]).filter(Boolean).join("").slice(0, 2).toUpperCase();
          const getAvatarColor = (id) => { const s = String(id || ""); let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return AVATAR_COLORS[h % AVATAR_COLORS.length]; };
          // Avatar — score-driven retention gradient (matches Today task page).
          // Lookup client by name; falls back to neutral mid-tone for
          // former clients / one-offs not in the active client list.
          const Avatar = ({ id, name, size = 32 }) => {
            const c = clients.find(x => x.name === name);
            const ret = c ? (c.ret || 60) : 60;
            return (
              <div style={{ width: size, height: size, borderRadius: size / 2, flexShrink: 0, background: retGradient(ret), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.32, fontWeight: 700, letterSpacing: 0.2, boxShadow: "var(--rt-sh-xs)" }}>{getInitials(name)}</div>
            );
          };

          // Heat score: 0-100.
          //   Recency (40%): ≤30d=100, 31-90=70, 91-180=40, >180=10
          //   Warmth (40%): good+comeback+refer=100, good+refer=75, good=50, mixed=30, rough=0
          //   Recent-signal bonus (20%): +20 if last touch ≤30d (same as recency hot bucket)
          const calcHeat = (r) => {
            const answers = r.retro_answers || {};
            // Recency — from last touch stored date, else fall back to priority set date
            const lastTouchDate = r.last_touch ? new Date(r.last_touch) : (r.priority_set_at ? new Date(r.priority_set_at) : (r.created_at ? new Date(r.created_at) : null));
            let recencyScore = 10;
            if (lastTouchDate) {
              const days = Math.max(0, Math.floor((Date.now() - lastTouchDate.getTime()) / (1000 * 60 * 60 * 24)));
              if (days <= 30) recencyScore = 100;
              else if (days <= 90) recencyScore = 70;
              else if (days <= 180) recencyScore = 40;
              else recencyScore = 10;
            }
            // Warmth — from retro answers
            const ended = (answers.ended || answers.terms || "").toString().toLowerCase();
            const comeback = (answers.comeback || "").toString().toLowerCase();
            const refer = (answers.refer || "").toString().toLowerCase();
            let warmth = 0;
            if (ended.includes("good")) {
              warmth = 50;
              if (refer.includes("yes")) warmth += 25;
              if (comeback.includes("yes")) warmth += 25;
            } else if (ended.includes("mixed")) warmth = 30;
            else if (ended.includes("rough")) warmth = 0;
            else warmth = 40; // unknown defaults to neutral
            // Recent signal bonus
            const bonus = recencyScore === 100 ? 20 : 0;
            return Math.min(100, Math.round(recencyScore * 0.4 + warmth * 0.4 + bonus));
          };

          // Derive canonical tags from retro answers — used on filed cards.
          const deriveTags = (r) => {
            const answers = r.retro_answers || {};
            const tags = [];
            const ended = (answers.ended || answers.terms || "").toString().toLowerCase();
            const comeback = (answers.comeback || "").toString().toLowerCase();
            const refer = (answers.refer || "").toString().toLowerCase();
            if (ended.includes("good")) tags.push("Good terms");
            if (refer.includes("yes")) tags.push("Would refer");
            if (comeback.includes("yes")) tags.push("Would come back");
            if (r.type === "oneoff") tags.push("New lead");
            return tags;
          };

          // Retro step definitions
          const RETRO_STEPS_FORMER = [
            { id: "happened", q: "What happened?",        kind: "text", placeholder: "Budget cut, pivot, quiet churn…" },
            { id: "ended",    q: "How did it end?",       kind: "pick", options: [
                { v: "good",  label: "Good terms", tone: C.retGood },
                { v: "mixed", label: "Mixed",      tone: C.retWarn },
                { v: "rough", label: "Rough",      tone: C.retCrit }] },
            { id: "comeback", q: "Would they come back?", kind: "pick", options: [
                { v: "yes",   label: "Yes",   tone: C.retGood },
                { v: "maybe", label: "Maybe", tone: C.retWarn },
                { v: "no",    label: "No",    tone: C.textMuted }] },
            { id: "refer",    q: "Would they refer you?", kind: "pick", options: [
                { v: "yes",   label: "Yes — has people in mind", tone: C.retGood },
                { v: "maybe", label: "Probably", tone: C.retWarn },
                { v: "no",    label: "Unlikely", tone: C.textMuted }] },
            { id: "priority", q: "Where in the deck?",    kind: "priority" },
          ];
          // New leads are forward-looking prospects — there's no
          // engagement to retro. So instead of history questions
          // ("what happened / how it ended"), a lead just captures
          // optional context and where it sits in the deck.
          const RETRO_STEPS_ONEOFF = [
            { id: "context",  q: "What's the opportunity?", kind: "text", placeholder: "Where they came from, what they need…" },
            { id: "priority", q: "Where in the deck?",      kind: "priority" },
          ];

          // ─── Data slices ────────────────────────────────────────────────
          const queued = rolodex.filter(r => !r.priority);
          // Check-in reminders that have come due (date is today or earlier).
          // Model 1: they persist until the user acts — no auto-expiry. Lives
          // entirely in Rolodex; never touches the client/task/Rai system.
          const _reminderToday = (() => {
            const n = new Date();
            return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
          })();
          const dueReminders = rolodex.filter(r => r.reminder && String(r.reminder).slice(0, 10) <= _reminderToday);
          const searchFilter = (r) => !rolodexSearch || (r.client_name || r.client || "").toLowerCase().includes(rolodexSearch.toLowerCase()) || (r.contact_name || r.contact || "").toLowerCase().includes(rolodexSearch.toLowerCase());
          const saved = rolodex.filter(r => r.priority && searchFilter(r));
          const byPrio = {
            high: saved.filter(r => r.priority === "high"),
            medium: saved.filter(r => r.priority === "medium"),
            low: saved.filter(r => r.priority === "low"),
          };
          const referReady = saved.filter(r => deriveTags(r).includes("Would refer")).length;

          // ─── Active retro state ─────────────────────────────────────────
          // rolodexFlowOpen acts as activeId. If null and queued exists, default to first.
          const activeId = rolodexFlowOpen || queued[0]?.id || null;
          const active = queued.find(r => r.id === activeId) || queued[0];
          const activeSteps = active?.type === "former" ? RETRO_STEPS_FORMER : RETRO_STEPS_ONEOFF;
          const currentAnswers = (active && active.retro_answers) || {};
          // Determine starting step from saved answers — skip filled, land on first empty
          const startStep = (() => {
            if (!active) return 0;
            for (let i = 0; i < activeSteps.length; i++) {
              const s = activeSteps[i];
              if (s.kind === "priority") return i;
              const v = currentAnswers[s.id];
              if (v === undefined || v === null || v === "") return i;
            }
            return activeSteps.length - 1;
          })();
          const [localStep, setLocalStep] = [rolodexStep, setRolodexStep];
          const effectiveStep = (localStep != null && activeId === rolodexStepOwner) ? localStep : startStep;
          const [localText, setLocalText] = [rolodexStepText, setRolodexStepText];
          const currentStepDef = activeSteps[effectiveStep];
          const textValue = (currentStepDef?.kind === "text")
            ? (localText != null && activeId === rolodexStepOwner ? localText : (currentAnswers[currentStepDef.id] || ""))
            : "";

          const saveAnswer = async (stepDef, value) => {
            if (!active) return;
            const nextAnswers = { ...currentAnswers, [stepDef.id]: value };
            setRolodex(prev => prev.map(r => r.id === active.id ? { ...r, retro_answers: nextAnswers } : r));
            try { await rolodexDb.update(active.id, { retro_answers: nextAnswers }); } catch (e) { console.warn("Retro save failed:", e); }
          };

          const advanceAfterRetro = () => {
            const remaining = rolodex.filter(r => !r.priority && r.id !== active?.id);
            setRolodexFlowOpen(remaining[0]?.id || null);
            setRolodexStep(null);
            setRolodexStepOwner(null);
            setRolodexStepText(null);
            setRetroDeleteConfirm(false);
          };

          const onNext = () => {
            if (!active || !currentStepDef) return;
            if (currentStepDef.kind === "text") {
              saveAnswer(currentStepDef, textValue);
            }
            if (effectiveStep >= activeSteps.length - 1) {
              advanceAfterRetro();
            } else {
              setRolodexStep(effectiveStep + 1);
              setRolodexStepOwner(active.id);
              setRolodexStepText(null);
            }
          };
          const onPrev = () => {
            setRolodexStep(Math.max(0, effectiveStep - 1));
            setRolodexStepOwner(active?.id || null);
            setRolodexStepText(null);
          };
          const onPick = (v) => {
            if (!currentStepDef) return;
            saveAnswer(currentStepDef, v);
            // Beat before advancing so the selected state (green fill + tint)
            // actually paints — without this the pick was saved and the step
            // changed in the same tick, so the option never visibly registered
            // and it felt like nothing happened.
            if (effectiveStep < activeSteps.length - 1) {
              const stepNow = effectiveStep;
              const ownerNow = active.id;
              setTimeout(() => {
                setRolodexStep(stepNow + 1);
                setRolodexStepOwner(ownerNow);
                setRolodexStepText(null);
              }, 200);
            }
          };
          const onPickPriority = async (priority) => {
            if (!active) return;
            // Derive and save tags + priority
            const finalAnswers = { ...currentAnswers, _priority: priority };
            const tags = deriveTags({ ...active, retro_answers: finalAnswers });
            // Single timestamp used for BOTH local state and the DB write,
            // so the retro-queue "last touched" sort stays consistent
            // across refreshes. Previously priority_set_at was set in local
            // state only — the DB update omitted it, so on refresh the
            // sort fell back to created_at.
            const setAt = new Date().toISOString();
            setRolodex(prev => prev.map(r => r.id === active.id ? { ...r, priority, retro_answers: finalAnswers, tags, priority_set_at: setAt } : r));
            try { await rolodexDb.update(active.id, { priority, retro_answers: finalAnswers, tags, priority_set_at: setAt }); } catch (e) { console.warn("Priority save failed:", e); }
            advanceAfterRetro();
          };

          // Filed list filter (click a stack)
          const [filedFilter, setFiledFilter] = [rolodexFiledFilter, setRolodexFiledFilter];
          const filteredFiled = filedFilter === "all" ? saved : byPrio[filedFilter] || [];

          // ─── Render ─────────────────────────────────────────────────────
          return (
            <div style={{ width: "100%" }}>
              {dataLoaded && rolodex.length === 0 && (
                <>
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "4px 4px 20px", marginBottom: 20, borderBottom: "1px solid " + C.borderLight }}>
                    <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                      <div style={{ fontSize: 11.5, color: C.textMuted, letterSpacing: 0.3, marginBottom: 4 }}>Past clients · one-offs · kept warm</div>
                      <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: -0.4, color: C.text }}>Rolodex</h1>
                    </div>
                  </div>
                  <EmptyState
                    icon="rolodex"
                    headline="Your Rolodex is empty."
                    body="The people behind the logos — the buyer, the operator, the assistant who actually forwards the email. Adding contacts lets Rai narrate at the human level, not just the account level."
                    cta={{ label: "Add Contact", onClick: () => setShowAddRolodex(true) }}
                  />
                </>
              )}
              {dataLoaded && rolodex.length > 0 && (<>
              {/* STATUS BAND */}
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "4px 4px 20px", marginBottom: 20, borderBottom: "1px solid " + C.borderLight }}>
                <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                  <div style={{ fontSize: 11.5, color: C.textMuted, letterSpacing: 0.3, marginBottom: 4 }}>Past clients · one-offs · kept warm</div>
                  <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: -0.4, color: C.text }}>Rolodex</h1>
                  <div style={{ fontSize: 13.5, color: C.textMuted, marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span><b style={{ color: C.text, fontWeight: 700 }}>{saved.length}</b> filed</span>
                    {queued.length > 0 && <><span className="rt-sep" /><span><b style={{ color: C.retGood, fontWeight: 700 }}>{queued.length}</b> awaiting retro</span></>}
                    {referReady > 0 && <><span className="rt-sep" /><span><b style={{ color: C.retGood, fontWeight: 700 }}>{referReady}</b> would refer</span></>}
                  </div>
                </div>
                <button className="r-btn" data-tone="green" onClick={() => setShowAddRolodex(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", color: "#fff", borderRadius: 10, fontSize: 13.5, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                  <span style={{ whiteSpace: "nowrap" }}>New Contact</span>
                </button>
              </div>

              {/* CHECK-IN REMINDER BANNER (Option B). Fires when a rolodex
                  reminder has come due. Single → name + company. Multiple →
                  count + names. "View" opens the contact. Entirely contained
                  in Rolodex — no task, no Rai, no client system, by design. */}
              {dueReminders.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, background: C.card, borderRadius: 12, padding: "13px 16px", boxShadow: "0 1px 3px rgba(20,30,22,0.06), 0 6px 16px rgba(20,30,22,0.07)", marginBottom: 20 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {dueReminders.length === 1 ? (
                      <>
                        <div style={{ fontSize: 14, color: C.text, fontWeight: 700 }}>Check in with {dueReminders[0].contact || dueReminders[0].client}</div>
                        <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 1 }}>{dueReminders[0].client ? dueReminders[0].client + " · " : ""}reminder due</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 14, color: C.text, fontWeight: 700 }}>{dueReminders.length} check-ins due</div>
                        <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 1 }}>
                          {dueReminders.slice(0, 2).map(r => r.contact || r.client).join(", ")}{dueReminders.length > 2 ? ", and " + (dueReminders.length - 2) + " more" : ""}
                        </div>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedRolodex(dueReminders[0])}
                    style={{ background: C.primaryGhost, color: C.primary, border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
                  >{dueReminders.length === 1 ? "View" : "Review"}</button>
                </div>
              )}

              {/* MAIN GRID: rail + main + rai (rai shows on >=1440px) */}
              <div className="rc-grid" style={{ display: "grid", gap: 20, alignItems: "start" }}>

                {/* LEFT RAIL: stacks + queue */}
                <div className="rc-rail" style={{ display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 0, alignSelf: "start" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", padding: "0 4px 2px" }}>Stacks</div>
                    {[
                      { key: "high", label: "High", tone: C.retGood, toneBg: "#E8F3EC" },
                      { key: "medium", label: "Medium", tone: C.retWarn, toneBg: "#FAF0DF" },
                      { key: "low", label: "Low", tone: C.textMuted, toneBg: C.borderLight },
                    ].map(s => {
                      const count = byPrio[s.key].length;
                      const selected = filedFilter === s.key;
                      const cards = Math.min(6, count);
                      return (
                        <button key={s.key} onClick={() => setFiledFilter(selected ? "all" : s.key)} style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", padding: "12px 14px", borderRadius: 12, boxShadow: "var(--rt-sh-card)", cursor: "pointer", textAlign: "left", background: selected ? s.toneBg : C.card, border: "1px solid " + (selected ? s.tone : C.border), fontFamily: "inherit", transition: "all 150ms" }}>
                          <div style={{ position: "relative", width: 36, height: 44, flexShrink: 0 }}>
                            {cards === 0 ? (
                              <div style={{ position: "absolute", inset: 0, border: "1px dashed " + C.border, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, color: C.textMuted }}>empty</div>
                            ) : (
                              Array.from({ length: cards }).map((_, i) => (
                                <div key={i} style={{ position: "absolute", bottom: i * 3, left: i * 2, right: -i * 2, top: i * 3, background: C.card, border: "1px solid " + s.tone, borderRadius: 5, opacity: 0.35 + (i / cards) * 0.6, boxShadow: i === cards - 1 ? "0 1px 2px rgba(0,0,0,0.05)" : "none" }} />
                              ))
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase" }}>{s.label}</div>
                            <div style={{ fontSize: 22, fontWeight: 700, color: s.tone, letterSpacing: -0.4, marginTop: 2, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{count}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Awaiting retro queue — matches Referrals "Who to ask next" pattern.
                      Card with header section (borderBottom divider), rows with 3px
                      primary left-bar on active + borderBottom between rows. Same
                      soft-row hover wash, same retention-gradient avatars, same
                      two-line content layout. */}
                  {queued.length > 0 && (
                    <div style={{ background: C.card, borderRadius: 12, boxShadow: "var(--rt-sh-card)", overflow: "hidden" }}>
                      <div style={{ padding: "12px 14px 10px", borderBottom: "1px solid " + C.borderLight, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>Awaiting retro</div>
                          <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 3 }}>Most recent first</div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, padding: "1px 8px", background: C.borderLight, borderRadius: 999, flexShrink: 0 }}>{queued.length}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        {queued.map((e, i) => {
                          const isActive = active?.id === e.id;
                          const name = e.client_name || e.client || "Untitled";
                          const contact = e.contact_name || e.contact || "";
                          const meta = (e.type === "former" ? "Former" : "New lead") + (contact ? " · " + contact.split(" ")[0] : "");
                          return (
                            <button
                              key={e.id}
                              onClick={() => { setRolodexFlowOpen(e.id); setRolodexStep(null); setRolodexStepOwner(null); setRolodexStepText(null); }}
                              className={"rt-soft-row" + (isActive ? " is-active" : "")}
                              style={{
                                display: "flex", alignItems: "center", gap: 10,
                                padding: "12px 14px",
                                border: "none",
                                borderBottom: i === queued.length - 1 ? "none" : "1px solid " + C.borderLight,
                                borderLeft: isActive ? "3px solid " + C.primary : "3px solid transparent",
                                cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                                ...(isActive ? { background: C.primarySoft } : {}),
                              }}
                            >
                              <Avatar id={e.id} name={name} size={30} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12.5, color: C.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{meta}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* MAIN COLUMN */}
                <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>

                  {/* ACTIVE RETRO (top card) or empty state */}
                  {active ? (
                    <div style={{ position: "relative", paddingBottom: 8 }}>
                      {/* Peek of next cards behind */}
                      {queued.length > 1 && <div style={{ position: "absolute", top: 8, left: 8, right: 8, bottom: 16, background: C.card, borderRadius: 14, opacity: 0.5, zIndex: 0 }} />}
                      {queued.length > 2 && <div style={{ position: "absolute", top: 4, left: 4, right: 4, bottom: 12, background: C.card, borderRadius: 14, opacity: 0.8, zIndex: 0 }} />}
                      <div style={{ position: "relative", zIndex: 1, background: C.card, borderRadius: 14, boxShadow: "0 4px 12px rgba(10,10,10,0.06)", overflow: "hidden" }}>
                        {/* Header */}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 20px 14px" }}>
                          <Avatar id={active.id} name={active.client_name || active.client} size={44} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: -0.2 }}>{active.client_name || active.client}</div>
                            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{active.contact_name || active.contact || "No contact"}{active.type === "former" ? " · Former client" : " · New lead"}</div>
                          </div>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: active.type === "former" ? C.retGood : C.btn, background: active.type === "former" ? "#E8F3EC" : C.primarySoft, padding: "3px 8px", borderRadius: 4, letterSpacing: 0.3, textTransform: "uppercase" }}>
                            {active.type === "former" ? "Former client" : "New lead"}
                          </span>
                        </div>
                        {/* Progress */}
                        <div style={{ padding: "0 20px 8px" }}>
                          <div style={{ display: "flex", gap: 3 }}>
                            {activeSteps.map((s, i) => (
                              <div key={s.id} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= effectiveStep ? C.primary : C.borderLight }} />
                            ))}
                          </div>
                          <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 6, fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase" }}>Step {effectiveStep + 1} of {activeSteps.length}</div>
                        </div>
                        {/* Question */}
                        <div style={{ padding: "12px 20px 18px" }}>
                          <div style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 16 }}>{currentStepDef.q}</div>
                          {currentStepDef.kind === "text" && (
                            <textarea
                              value={textValue}
                              onChange={e => { setRolodexStepText(e.target.value); setRolodexStepOwner(active.id); }}
                              onBlur={() => { if (localText != null) saveAnswer(currentStepDef, localText); }}
                              placeholder={currentStepDef.placeholder}
                              rows={3}
                              style={{ width: "100%", padding: "13px 15px", borderRadius: 10, fontSize: 14, fontFamily: "inherit", background: C.card, border: "none", boxShadow: "inset 0 0 0 1px " + C.borderLight, outline: "none", resize: "vertical", lineHeight: 1.55, color: C.text, boxSizing: "border-box" }}
                            />
                          )}
                          {currentStepDef.kind === "pick" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              {currentStepDef.options.map(o => {
                                const picked = currentAnswers[currentStepDef.id] === o.v;
                                return (
                                  <button key={o.v} onClick={() => onPick(o.v)}
                                    onMouseEnter={e => { if (!picked) { e.currentTarget.style.boxShadow = "inset 0 0 0 1px " + C.primaryLight; } }}
                                    onMouseLeave={e => { if (!picked) { e.currentTarget.style.boxShadow = "none"; } }}
                                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", background: picked ? C.primarySoft : C.card, border: "1px solid " + (picked ? o.tone : C.border), borderRadius: 10, cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "all 140ms ease" }}>
                                    <span style={{ width: 16, height: 16, borderRadius: 8, border: "2px solid " + (picked ? o.tone : C.border), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                      {picked && <span style={{ width: 8, height: 8, borderRadius: 4, background: o.tone }} />}
                                    </span>
                                    <span style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{o.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          {currentStepDef.kind === "priority" && (
                            <div>
                              <div style={{ fontSize: 13, color: C.textSec, lineHeight: 1.5, marginBottom: 14 }}>Where does this contact go in your deck? High = worth regular check-ins. Medium = warm but not urgent. Low = archive in case something changes.</div>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                                {[
                                  { id: "high", label: "High", color: C.retGood, bg: "#E8F3EC", desc: "Check in quarterly" },
                                  { id: "medium", label: "Medium", color: C.retWarn, bg: "#FAF0DF", desc: "Check in twice a year" },
                                  { id: "low", label: "Low", color: C.textMuted, bg: C.borderLight, desc: "Archive, monitor" },
                                ].map(p => (
                                  <button key={p.id} onClick={() => onPickPriority(p.id)} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "14px 12px", background: p.bg, border: "1px solid " + p.color, borderRadius: 10, cursor: "pointer", fontFamily: "inherit", textAlign: "center", transition: "all 120ms" }}>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: p.color }}>{p.label}</div>
                                    <div style={{ fontSize: 11, color: C.textSec }}>{p.desc}</div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        {/* Footer nav — hidden on priority step (buttons ARE the actions) */}
                        {currentStepDef.kind !== "priority" && (
                          retroDeleteConfirm ? (
                            <div style={{ padding: "16px 18px 18px", borderTop: "1px solid " + C.borderLight, background: C.card }}>
                              <div style={{ fontSize: 14, color: C.text, lineHeight: 1.55, marginBottom: 14 }}>Delete <b>{active.client_name || active.client}</b> from your rolodex? This is permanent — you won't be able to get this contact back.</div>
                              <div style={{ display: "flex", gap: 8 }}>
                                <button onClick={() => { setRolodex(prev => prev.filter(x => x.id !== active.id)); rolodexDb.delete(active.id); setRetroDeleteConfirm(false); advanceAfterRetro(); }} style={{ flex: 1, padding: "11px", background: C.danger, color: "#fff", border: "none", borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
                                <button onClick={() => setRetroDeleteConfirm(false)} style={{ padding: "11px 18px", background: C.surface, color: C.text, border: "none", borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 18px 15px", borderTop: "1px solid " + C.borderLight }}>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button onClick={advanceAfterRetro} style={{ fontSize: 12.5, color: C.textMuted, padding: "8px 12px", borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>Skip for now</button>
                              <button onClick={() => setRetroDeleteConfirm(true)} style={{ fontSize: 12.5, color: C.danger, padding: "8px 12px", borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>Delete</button>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button onClick={onPrev} disabled={effectiveStep === 0} style={{ padding: "9px 16px", background: C.card, color: C.textSec, borderRadius: 9, fontSize: 13, fontWeight: 600, border: "none", boxShadow: "inset 0 0 0 1px " + C.border, cursor: effectiveStep === 0 ? "default" : "pointer", opacity: effectiveStep === 0 ? 0.5 : 1, fontFamily: "inherit" }}>Back</button>
                              <button onClick={onNext} style={{ padding: "9px 20px", background: C.btn, color: "#fff", borderRadius: 9, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit" }}>Next</button>
                            </div>
                          </div>
                          )
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", padding: "40px 20px", background: C.card, borderRadius: 14, boxShadow: "var(--rt-sh-card)" }}>
                      <div style={{ width: 44, height: 44, borderRadius: 22, background: "#E8F3EC", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", border: "2px solid " + C.retGood }}>
                        <Icon name="check" size={20} color={C.retGood} />
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>Deck cleared.</div>
                      <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 4 }}>All contacts are filed. Tap "New Contact" to add more.</div>
                    </div>
                  )}

                  {/* FILED LIST */}
                  <div>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "0 4px 10px" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: C.textMuted }}>Filed</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, padding: "1px 8px", background: C.borderLight, borderRadius: 999 }}>{filteredFiled.length}</span>
                        {filedFilter !== "all" && (
                          <button onClick={() => setFiledFilter("all")} style={{ fontSize: 10.5, color: C.btn, fontWeight: 500, padding: "2px 8px", background: C.primarySoft, borderRadius: 4, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                            {filedFilter} · clear
                          </button>
                        )}
                      </div>
                      <input value={rolodexSearch} onChange={e => setRolodexSearch(e.target.value)} placeholder="Search filed…" style={{ width: 200, padding: "9px 13px", borderRadius: 9, fontSize: 13, fontFamily: "inherit", background: C.card, border: "none", boxShadow: "inset 0 0 0 1px " + C.borderLight, outline: "none", color: C.text }} />
                    </div>

                    {filteredFiled.length === 0 ? (
                      <div style={{ padding: "30px 20px", background: C.card, border: "1px dashed " + C.border, borderRadius: 12, textAlign: "center", color: C.textMuted, fontSize: 13 }}>
                        {filedFilter === "all" ? "No filed contacts yet." : `Nothing in ${filedFilter} priority.`}
                      </div>
                    ) : (
                      filteredFiled.map(e => {
                        const tags = deriveTags(e);
                        const heat = calcHeat(e);
                        const prioTone = e.priority === "high" ? C.retGood : e.priority === "medium" ? C.retWarn : C.textMuted;
                        const name = e.client_name || e.client || "Untitled";
                        const contact = e.contact_name || e.contact || "";
                        // Summary = History > What you did/happened (step 1 text answer)
                        const summary = (e.retro_answers && (e.retro_answers.happened || e.retro_answers.did || e.retro_answers.what)) || "";
                        return (
                          <div key={e.id} onClick={() => setSelectedRolodex(e)} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", background: C.card, borderRadius: 12, boxShadow: "var(--rt-sh-card)", marginBottom: 8, cursor: "pointer" }}>
                            <div style={{ width: 3, alignSelf: "stretch", background: prioTone, borderRadius: 2, flexShrink: 0 }} />
                            <Avatar id={e.id} name={name} size={40} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 14.5, fontWeight: 600, color: C.text, letterSpacing: -0.2 }}>{name}</span>
                                <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 999, letterSpacing: 0.2, color: e.type === "former" ? C.retGood : C.btn, background: e.type === "former" ? "#E8F3EC" : C.primarySoft }}>
                                  {e.type === "former" ? "Former" : "New lead"}
                                </span>
                                {e.priority === "high" && (
                                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, letterSpacing: 0.2, color: "#fff", background: "linear-gradient(90deg, #D17A1B, #C04323)" }}>Heat {heat}</span>
                                )}
                                {(() => {
                                  // Check-in reminder pill. Shows due/overdue/upcoming
                                  // state inline. Without this, the user has no signal
                                  // on the row that a reminder is set.
                                  // Note: local state maps DB's reminder_date → reminder.
                                  // Read both to be safe.
                                  const reminderRaw = e.reminder ?? e.reminder_date;
                                  if (!reminderRaw) return null;
                                  const todayYmd = (() => {
                                    const n = new Date();
                                    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
                                  })();
                                  const reminderYmd = String(reminderRaw).slice(0, 10);
                                  const todayMs = new Date(todayYmd).getTime();
                                  const reminderMs = new Date(reminderYmd).getTime();
                                  const diffDays = Math.round((reminderMs - todayMs) / 86400000);
                                  if (diffDays < 0) {
                                    const days = Math.abs(diffDays);
                                    return (
                                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, letterSpacing: 0.2, color: "#fff", background: "#C04323" }}>
                                        Overdue {days}d
                                      </span>
                                    );
                                  }
                                  if (diffDays === 0) {
                                    return (
                                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, letterSpacing: 0.2, color: "#fff", background: "#C04323" }}>
                                        Check in today
                                      </span>
                                    );
                                  }
                                  if (diffDays <= 30) {
                                    return (
                                      <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 999, letterSpacing: 0.2, color: C.primary, background: C.primarySoft, border: "1px solid " + C.primaryGhost }}>
                                        In {diffDays}d
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                              <div style={{ fontSize: 11.5, color: C.textMuted, marginBottom: 8 }}>
                                {contact && <span>{contact}</span>}
                              </div>
                              {summary && <div style={{ fontSize: 12.5, color: C.textSec, lineHeight: 1.55, marginBottom: 8 }}>{summary}</div>}
                              {tags.length > 0 && (
                                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                  {tags.map(t => (
                                    <span key={t} style={{ fontSize: 10.5, fontWeight: 600, padding: "3px 8px", borderRadius: 4, letterSpacing: 0.1, color: C.retGood, background: "#E8F3EC", border: "1px solid #C9E4D1" }}>{t}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>

              {/* Add contact modal */}
              {showAddRolodex && createPortal(
                <div onClick={() => setShowAddRolodex(false)} style={{ position: "fixed", inset: 0, background: "rgba(20,30,22,0.40)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Manrope', system-ui, sans-serif" }}>
                  <div onClick={e => e.stopPropagation()} style={{ background: C.card, borderRadius: 16, padding: 26, width: "100%", maxWidth: 480, boxShadow: "0 1px 3px rgba(20,30,22,0.08), 0 20px 60px rgba(20,30,22,0.18), inset 0 1px 0 rgba(255,255,255,0.9)" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 6 }}>New rolodex contact</div>
                    <div style={{ fontSize: 12.5, color: C.textMuted, marginBottom: 18 }}>{newRolodexEntry.type === "oneoff" ? "Add a lead to your deck and set where it sits." : "Add someone to your deck. You'll run a quick retro to file them."}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Company / client name</label>
                        <input value={newRolodexEntry.client} onChange={e => setNewRolodexEntry({ ...newRolodexEntry, client: e.target.value })} onFocus={e => { e.target.style.boxShadow = "inset 0 0 0 1px " + C.primary; }} onBlur={e => { e.target.style.boxShadow = "inset 0 0 0 1px " + C.borderLight; }} placeholder="Northbeam Studios" style={{ width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: 14, fontFamily: "inherit", background: C.card, border: "none", boxShadow: "inset 0 0 0 1px " + C.borderLight, color: C.text, outline: "none", boxSizing: "border-box", transition: "box-shadow 120ms ease" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Contact person</label>
                        <input value={newRolodexEntry.contact} onChange={e => setNewRolodexEntry({ ...newRolodexEntry, contact: e.target.value })} onFocus={e => { e.target.style.boxShadow = "inset 0 0 0 1px " + C.primary; }} onBlur={e => { e.target.style.boxShadow = "inset 0 0 0 1px " + C.borderLight; }} placeholder="Jordan Reeve" style={{ width: "100%", padding: "11px 14px", borderRadius: 10, fontSize: 14, fontFamily: "inherit", background: C.card, border: "none", boxShadow: "inset 0 0 0 1px " + C.borderLight, color: C.text, outline: "none", boxSizing: "border-box", transition: "box-shadow 120ms ease" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Type</label>
                        <div style={{ display: "flex", gap: 8 }}>
                          {[{ v: "former", label: "Former client" }, { v: "oneoff", label: "New lead" }].map(t => (
                            <button key={t.v} onClick={() => setNewRolodexEntry({ ...newRolodexEntry, type: t.v })} style={{ flex: 1, padding: "10px 12px", background: newRolodexEntry.type === t.v ? C.primarySoft : C.card, border: "none", boxShadow: "inset 0 0 0 1px " + (newRolodexEntry.type === t.v ? C.primary : C.borderLight), borderRadius: 10, fontSize: 13, fontWeight: 600, color: newRolodexEntry.type === t.v ? C.primary : C.textSec, cursor: "pointer", fontFamily: "inherit", transition: "all 120ms ease" }}>{t.label}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {(() => {
                        const ready = newRolodexEntry.client.trim() && newRolodexEntry.contact.trim();
                        return (
                          <button disabled={!ready} onClick={async () => {
                            const entryType = newRolodexEntry.type || "former";
                            const { data: created } = await rolodexDb.create(user.id, {
                              client_name: newRolodexEntry.client.trim(),
                              contact_name: newRolodexEntry.contact.trim(),
                              type: entryType,
                              retro_answers: {},
                            });
                            if (created) {
                              const newEntry = { ...created, client: created.client_name, contact: created.contact_name, type: entryType, retro_answers: {}, tags: [] };
                              setRolodex(prev => [newEntry, ...prev]);
                              setRolodexFlowOpen(created.id);
                              setRolodexStep(0);
                              setRolodexStepOwner(created.id);
                              setRolodexStepText(null);
                            }
                            setNewRolodexEntry({ client: "", contact: "", work: "", type: "former" });
                            setShowAddRolodex(false);
                          }} onMouseEnter={e => { if (ready) e.currentTarget.style.background = C.btnHover; }} onMouseLeave={e => { if (ready) e.currentTarget.style.background = C.btn; }} style={{ flex: 1, padding: "12px", background: ready ? C.btn : C.surfaceWarm, color: ready ? "#fff" : C.textMuted, border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: ready ? "pointer" : "default", fontFamily: "inherit", transition: "background 120ms ease" }}>{newRolodexEntry.type === "oneoff" ? "Add lead" : "Add & start retro"}</button>
                        );
                      })()}
                      <button onClick={() => { setShowAddRolodex(false); setNewRolodexEntry({ client: "", contact: "", work: "", type: "former" }); }} style={{ padding: "12px 18px", background: C.surface, color: C.text, border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                    </div>
                  </div>
                </div>,
                document.body
              )}
              </>)}
            </div>
          );
          } catch (err) {
            return (
              <div style={{ padding: 40, background: "#FFF5F5", border: "2px solid #C04323", borderRadius: 14, margin: 20 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#C04323", marginBottom: 12 }}>Rolodex page crashed</div>
                <div style={{ fontSize: 13, color: C.text, marginBottom: 8 }}>Error: <code style={{ background: C.bg, padding: "2px 6px", borderRadius: 4 }}>{String(err?.message || err)}</code></div>
                <pre style={{ fontSize: 11, color: C.textSec, background: C.bg, padding: 12, borderRadius: 6, overflow: "auto", maxHeight: 300 }}>{String(err?.stack || "No stack trace")}</pre>
              </div>
            );
          }
        
}
