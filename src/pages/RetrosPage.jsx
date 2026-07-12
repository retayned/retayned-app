// AUTO-EXTRACTED from App.jsx (page === "retros" block) — body is
// verbatim; only the surrounding component shell + imports are generated.
import { referrals as referralsDb, rolodex as rolodexDb } from "../lib/db";
import { supabase } from "../lib/supabase";
import { EmptyState } from "../components/Skeletons";
import { createPortal } from "react-dom";
import { C } from "../theme";
import { useEffect, useState } from "react";
import { retGradient, localYmd } from "../utils";

// Fraunces observer idiom — same voice surface Rai uses elsewhere.
const FR = { fontFamily: "'Fraunces', Georgia, serif", fontStyle: "italic", fontWeight: 500, fontVariationSettings: "'opsz' 96, 'SOFT' 50, 'WONK' 0" };

export default function RetrosPage({ app }) {
  // Check-in banner dismissal — per LOCAL DAY, persisted, so "Dismiss"
  // means "not today" rather than "until next render". The reminder
  // itself is untouched; acting on it still goes through the contact.
  const _checkinTodayYmd = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  })();
  // (Dismissal state lifted to App, Jun 12: the sidebar red dot and this
  // banner share one per-day dismissal. _checkinTodayYmd stays local for
  // the date math below.)
  // Retro flow is collapsed into a compact prompt by default; the full
  // five-step card only takes over the page when the user opts in.
  const [retroOpen, setRetroOpen] = useState(false);
  // ─── Reach-back engine state (Jul 2026) ──────────────────────────
  // The Workbench: Rai-prepared outreach (comebacks + lead touches),
  // loaded straight from rolodex_reachbacks. Dossier = on-demand
  // pre-call brief.
  const [reachbacks, setReachbacks] = useState([]);
  const [dossier, setDossier] = useState(null); // { name, loading, text }
  const [rbEditing, setRbEditing] = useState(null); // { id, text }
  const [leadIntake, setLeadIntake] = useState({ source: "inbound", refFrom: "", need: "", urgency: "quarter", value: "" });
  const _userId = app.user?.id;
  useEffect(() => {
    let cancelled = false;
    if (!_userId) return;
    (async () => {
      try {
        const { data: rbs } = await supabase.from("rolodex_reachbacks").select("*")
          .eq("user_id", _userId).order("prepared_at", { ascending: false }).limit(200);
        if (cancelled) return;
        setReachbacks(rbs || []);
      } catch (e) { console.warn("Reach-back load failed:", e); }
    })();
    return () => { cancelled = true; };
  }, [_userId]);
  // Event path (B1): the moment a lead is filed, its first touch gets
  // prepared — supabase.functions.invoke carries the user's JWT.
  const prepReachback = async (rolodexId) => {
    try {
      const { data, error } = await supabase.functions.invoke("rolodex-sweep", { body: { rolodex_id: rolodexId, mode: "contact" } });
      if (error) console.warn("Reach-back prep returned error:", error);
      if (data?.reachback) setReachbacks(prev => [data.reachback, ...prev]);
    } catch (e) { console.warn("Reach-back prep failed:", e); }
  };
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
    selectedRolodex,
    setAiInput,
    setAiConvoId,
    setAiMessages,
    setObservationContext,
    setRaiLaunching,
    pendingAutoSendRef,
    setPage,
    setShowAddRolodex,
    showAddRolodex,
    user,
    rolodexCheckinDismissed,
    dismissRolodexCheckin,
    quickCreateClient,
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

          // ─── Warmth ────────────────────────────────────────────────────
          // The page's organizing signal: time since last touch. Same
          // last-touch derivation calcHeat uses, banded into warm (≤30d),
          // cooling (31–90d), cold (>90d).
          const lastTouchMs = (r) => {
            const d = r.last_touch ? new Date(r.last_touch) : (r.priority_set_at ? new Date(r.priority_set_at) : (r.created_at ? new Date(r.created_at) : null));
            const t = d ? d.getTime() : NaN;
            return Number.isFinite(t) ? t : null;
          };
          const warmthBand = (r) => {
            const ms = lastTouchMs(r);
            if (ms == null) return "cold";
            const days = (Date.now() - ms) / 86400000;
            return days <= 30 ? "warm" : days <= 90 ? "cooling" : "cold";
          };
          const WARMTH_META = {
            warm:    { label: "Warm",    tone: C.retGood,   bg: "#E8F3EC" },
            cooling: { label: "Cooling", tone: C.retWarn,   bg: "#FAF0DF" },
            cold:    { label: "Cold",    tone: C.textMuted, bg: C.borderLight },
          };
          const agoLabel = (r) => {
            const ms = lastTouchMs(r);
            if (ms == null) return "no touch yet";
            const days = Math.max(0, Math.floor((Date.now() - ms) / 86400000));
            if (days < 1) return "today";
            if (days < 7) return `${days}d ago`;
            if (days < 30) return `${Math.floor(days / 7)}w ago`;
            if (days < 365) return `${Math.floor(days / 30)}mo ago`;
            return `${Math.floor(days / 365)}y ago`;
          };

          // ─── Reach-back actions (Jul 2026) ─────────────────────────
          const entryById = (id) => rolodex.find(r => r.id === id) || null;
          const entryName = (e) => e ? (e.contact_name || e.contact || e.client_name || e.client || "Contact") : "Contact";
          // Lead cadence mirror of the edge function: gap AFTER a step.
          const stepGapDays = (step, urgency) => {
            const base = step <= 1 ? 4 : step === 2 ? 7 : 14;
            if (urgency === "now") return Math.max(2, Math.ceil(base * 0.75));
            if (urgency === "someday") return base * 2;
            return base;
          };
          const rbUpdate = async (id, patch) => {
            setReachbacks(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));
            try { await supabase.from("rolodex_reachbacks").update(patch).eq("id", id); }
            catch (e) { console.warn("Reach-back update failed:", e); }
          };
          const rolodexPatch = async (id, patch) => {
            // Optimistic update, then persist. IMPORTANT: rolodexDb.update
            // RETURNS { data, error } — it does not throw — so a try/catch here
            // silently swallowed nothing and DB failures (e.g. Log touch) were
            // invisible: the UI looked updated but the write never landed and
            // reverted on reload. Now we inspect the returned error, surface it,
            // and roll the optimistic change back so the UI tells the truth.
            const prevRow = rolodex.find(r => r.id === id) || null;
            setRolodex(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
            try {
              const { error } = await rolodexDb.update(id, patch);
              if (error) {
                console.error("Rolodex update failed:", error.message || error, "| patch:", patch);
                if (prevRow) setRolodex(prev => prev.map(r => r.id === id ? prevRow : r));
              }
            } catch (e) {
              console.error("Rolodex update threw:", e, "| patch:", patch);
              if (prevRow) setRolodex(prev => prev.map(r => r.id === id ? prevRow : r));
            }
          };
          // Send: opens mail prefilled, stamps the touch, arms the next
          // sequence step's clock for leads.
          const sendReachback = (rb) => {
            const e = entryById(rb.rolodex_id);
            const now = new Date().toISOString();
            rbUpdate(rb.id, { status: "sent", acted_at: now });
            const patch = { last_touch: now };
            if (rb.lane === "lead" && e) {
              const gap = stepGapDays(rb.sequence_step || 1, e.lead_urgency);
              patch.next_touch_at = new Date(Date.now() + gap * 86400000).toISOString();
            }
            if (e) rolodexPatch(e.id, patch);
          };
          const notNowReachback = (rb) => {
            rbUpdate(rb.id, { status: "dismissed", acted_at: new Date().toISOString() });
            // Leads: "not now" means later, not never — arm the clock so
            // the engine re-prepares this touch in two weeks. Without this
            // a dismissed first touch stalls the sequence permanently
            // (the due-check reads next_touch_at once history exists).
            const e = entryById(rb.rolodex_id);
            if (e && rb.lane === "lead" && e.lead_status === "active") {
              rolodexPatch(e.id, { next_touch_at: new Date(Date.now() + 14 * 86400000).toISOString() });
            }
          };
          const repliedReachback = (rb) => {
            rbUpdate(rb.id, { status: "replied", acted_at: new Date().toISOString() });
            const e = entryById(rb.rolodex_id);
            if (e && rb.lane === "lead") rolodexPatch(e.id, { next_touch_at: null }); // sequence pauses on reply
          };
          const deadReachback = (rb) => {
            rbUpdate(rb.id, { status: "dismissed", acted_at: new Date().toISOString() });
            const e = entryById(rb.rolodex_id);
            if (e && rb.lane === "lead") {
              // Parked ≠ dead — the Lead Radar resurfaces it later.
              rolodexPatch(e.id, { lead_status: "parked", next_touch_at: new Date(Date.now() + 75 * 86400000).toISOString() });
            }
          };
          // Rebooked (former) / Signed (lead): one tap → a client exists.
          const winReachback = async (rb) => {
            const e = entryById(rb.rolodex_id);
            if (!e) return;
            const name = e.client_name || e.client || entryName(e);
            const value = rb.lane === "lead" ? (e.lead_value || 0) : 0;
            rbUpdate(rb.id, { status: "won", acted_at: new Date().toISOString() });
            const created = quickCreateClient ? await quickCreateClient(name, e.contact_name || e.contact || "", value) : null;
            const patch = { last_touch: new Date().toISOString() };
            if (rb.lane === "lead") { patch.lead_status = "won"; patch.next_touch_at = null; }
            rolodexPatch(e.id, patch);
            // Referral lineage + thank loop: a referred lead that signs
            // writes the referrals row, which lights the thank button on
            // the Referrals page.
            if (rb.lane === "lead" && (e.lead_source || "").startsWith("referral:") && created) {
              const referrer = e.lead_source.slice("referral:".length).trim();
              if (referrer) {
                try {
                  await referralsDb.create(user.id, {
                    referred_to: name, referred_by: referrer, status: "converted",
                    status_changed_at: new Date().toISOString(),
                    revenue: value, date_added: new Date().toISOString().slice(0, 10),
                  });
                } catch (err) { console.warn("Referral lineage write failed:", err); }
              }
            }
          };
          const openDossier = async (rolodexId) => {
            const e = entryById(rolodexId);
            setDossier({ name: entryName(e), loading: true, text: "" });
            try {
              const { data, error } = await supabase.functions.invoke("rolodex-sweep", { body: { rolodex_id: rolodexId, mode: "dossier" } });
              if (error) console.warn("Dossier returned error:", error);
              setDossier({ name: entryName(e), loading: false, text: data?.dossier || "Couldn't build the dossier right now." });
            } catch (err) {
              console.warn("Dossier failed:", err);
              setDossier({ name: entryName(e), loading: false, text: "Couldn't build the dossier right now." });
            }
          };
          const logTouch = (e) => rolodexPatch(e.id, { last_touch: new Date().toISOString() });
          // Mark Check-In (banner action): records the touch AND satisfies the
          // due reminder — recurring reminders advance to the next occurrence
          // (snapped to Monday), one-offs clear. Mirrors the modal's
          // "Mark checked in" so the banner and modal behave identically.
          const markCheckIn = (e) => {
            const recurring = e.reminderRecurrence && e.reminderRecurrence !== "none";
            let nextDate = null, nextRecur = "none";
            if (recurring) {
              const days = { "2w": 14, "1m": 30, "3m": 90, "6m": 180 }[e.reminderRecurrence] || 30;
              const t = new Date(Date.now() + days * 86400000);
              const dow = t.getDay();
              const diff = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
              nextDate = localYmd(new Date(t.getTime() + diff * 86400000));
              nextRecur = e.reminderRecurrence;
            }
            rolodexPatch(e.id, { last_touch: new Date().toISOString(), reminder_date: nextDate, reminder_recurrence: nextRecur });
          };
          // Workbench slices
          const preparedRbs = reachbacks.filter(b => b.status === "prepared").slice(0, 5);
          const sentRbs = reachbacks.filter(b => b.status === "sent" || b.status === "bumped" || b.status === "replied").slice(0, 4);
          // Sequence position per contact (max step across lead reachbacks)
          const seqStepFor = (rolodexId) => reachbacks.reduce((m, b) =>
            b.rolodex_id === rolodexId && b.lane === "lead" ? Math.max(m, b.sequence_step || 0) : m, 0);
          // Header metrics
          const wonRbs = reachbacks.filter(b => b.status === "won");
          const wonValue = rolodex.filter(r => r.lead_status === "won").reduce((a, r) => a + (r.lead_value || 0), 0);
          const parkedValue = rolodex.filter(r => r.lead_status === "parked").reduce((a, r) => a + (r.lead_value || 0), 0);

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

          // Filed filter — warmth bands (rail), type, refer-ready (pills),
          // with legacy high/medium/low still honored.
          const [filedFilter, setFiledFilter] = [rolodexFiledFilter, setRolodexFiledFilter];
          const filteredFiled = saved.filter(r => {
            if (!filedFilter || filedFilter === "all") return true;
            if (filedFilter === "warm") return warmthBand(r) === "warm";
            if (filedFilter === "cold") return warmthBand(r) === "cold" || warmthBand(r) === "cooling";
            if (filedFilter === "former") return r.type === "former";
            if (filedFilter === "oneoff") return r.type !== "former";
            if (byPrio[filedFilter]) return r.priority === filedFilter;
            return true;
          }).sort((a, b) => {
            // Per-tab sort:
            //   Warm → warmest first (fewest days since touch).
            //   Cold → coldest first (most days since touch).
            //   All / Former / Leads → alphabetical A→Z by name.
            const nameOf = (r) => (r.client_name || r.client || r.contact_name || r.contact || "").toLowerCase();
            const touchMs = (r) => lastTouchMs(r) ?? 0; // no touch = oldest = coldest
            if (filedFilter === "warm") return touchMs(b) - touchMs(a); // recent (larger ms) first
            if (filedFilter === "cold") return touchMs(a) - touchMs(b); // oldest (smaller ms) first
            return nameOf(a).localeCompare(nameOf(b));
          });
          const allFiled = rolodex.filter(r => r.priority);
          const warmthCounts = { warm: 0, cooling: 0, cold: 0 };
          for (const r of allFiled) warmthCounts[warmthBand(r)]++;

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
                    {(wonRbs.length > 0 || wonValue > 0) && <><span className="rt-sep" /><span><b style={{ color: C.retGood, fontWeight: 700 }}>{wonValue > 0 ? `$${wonValue.toLocaleString()}/mo` : wonRbs.length}</b> won off the deck</span></>}
                    {parkedValue > 0 && <><span className="rt-sep" /><span><b style={{ color: C.text, fontWeight: 700 }}>${parkedValue.toLocaleString()}/mo</b> parked</span></>}
                    {queued.length > 0 && <><span className="rt-sep" /><span><b style={{ color: C.retGood, fontWeight: 700 }}>{queued.length}</b> awaiting retro</span></>}
                    {referReady > 0 && <><span className="rt-sep" /><span><b style={{ color: C.retGood, fontWeight: 700 }}>{referReady}</b> would refer</span></>}
                  </div>
                </div>
                <button className="r-btn" data-tone="green" onClick={() => setShowAddRolodex(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", color: "#fff", borderRadius: 10, fontSize: 13.5, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                  <span style={{ whiteSpace: "nowrap" }}>New Contact</span>
                </button>
              </div>

              {/* MAIN GRID: rail + main + rai (rai shows on >=1440px) */}
              <div className="rc-grid" style={{ display: "grid", gap: 20, alignItems: "start" }}>

                {/* LEFT RAIL: warmth + check-in queue */}
                <div className="rc-rail" style={{ display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 0, alignSelf: "start" }}>
                  {/* WARMTH — who needs you, not how you filed them. Click a
                      band to filter the grid; click again to clear. */}
                  <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: "var(--rt-sh-card)", padding: "12px 14px" }}>
                    <div style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 10 }}>Pulse</div>
                    {["warm", "cooling", "cold"].map(band => {
                      const m = WARMTH_META[band];
                      const selected = filedFilter === band;
                      return (
                        <button key={band} onClick={() => setFiledFilter(selected ? "all" : band)} style={{
                          display: "flex", alignItems: "center", gap: 8, width: "100%",
                          padding: "8px 10px", marginBottom: 4, borderRadius: 8,
                          border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                          background: selected ? m.bg : "transparent",
                          transition: "background 120ms ease",
                        }}>
                          <span style={{ width: 8, height: 8, borderRadius: 999, background: m.tone, flexShrink: 0 }} />
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: C.text }}>{m.label}</span>
                          <span style={{ flex: 1 }} />
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: selected ? m.tone : C.textSec, fontVariantNumeric: "tabular-nums" }}>{warmthCounts[band]}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* CHECK-IN QUEUE — due/upcoming reminders, soonest first.
                      Mirrors the Health queue pattern; rows open the contact. */}
                  <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: "var(--rt-sh-card)", overflow: "hidden" }}>
                    <div className="rt-divider-inset" style={{ padding: "12px 14px 10px" }}>
                      <div style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>Check-in queue</div>
                    </div>
                    {(() => {
                      const withReminder = rolodex
                        .filter(r => r.reminder || r.reminder_date)
                        .map(r => {
                          const ymd = String(r.reminder ?? r.reminder_date).slice(0, 10);
                          const diff = Math.round((new Date(ymd).getTime() - new Date(_checkinTodayYmd).getTime()) / 86400000);
                          return { r, diff };
                        })
                        .sort((a, b) => a.diff - b.diff)
                        .slice(0, 5);
                      if (withReminder.length === 0) {
                        return <div style={{ padding: "14px", fontSize: 12, color: C.textMuted }}>No check-ins scheduled.</div>;
                      }
                      return withReminder.map(({ r, diff }, i) => {
                        const name = r.contact_name || r.contact || r.client_name || r.client || "Untitled";
                        const sub = diff < 0 ? `${Math.abs(diff)}d overdue` : diff === 0 ? "due today" : `in ${diff}d`;
                        const subColor = diff < 0 ? C.retCrit : diff === 0 ? C.retWarn : C.textMuted;
                        const isActive = selectedRolodex?.id === r.id;
                        return (
                          <button key={r.id} onClick={() => setSelectedRolodex(r)} className={"rt-soft-row" + (isActive ? " is-active" : "") + (i === withReminder.length - 1 ? "" : " rt-divider-inset")} style={{
                            display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1, width: "100%",
                            padding: "10px 14px", border: "none", borderLeft: isActive ? "3px solid " + C.primary : "3px solid transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                            ...(isActive ? { background: C.primarySoft } : {}),
                          }}>
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{name}</span>
                            <span style={{ fontSize: 10.5, fontWeight: 600, color: subColor }}>{sub}</span>
                          </button>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* MAIN COLUMN */}
                <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>

                  {/* ─── WORKBENCH (Jul 2026) — the page's opening beat.
                      Rai-prepared reach-backs: who, why now, the written
                      message, one tap to send. Comebacks come from the
                      weekly sweep; lead touches are event-driven. Never
                      more than 5; never auto-sends. ─── */}
                  {preparedRbs.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "0 4px" }}>
                        <span style={{ ...FR, fontSize: 15, color: C.text }}>workbench</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, padding: "1px 8px", background: C.borderLight, borderRadius: 999 }}>{preparedRbs.length}</span>
                        <span style={{ fontSize: 10.5, color: C.textMuted }}>written and waiting — nothing sends without you</span>
                      </div>
                      {preparedRbs.map(rb => {
                        const e = entryById(rb.rolodex_id);
                        const name = entryName(e);
                        const company = e && (e.client_name || e.client) !== name ? (e.client_name || e.client) : null;
                        const worth = rb.lane === "lead" ? (e?.lead_value || 0) : 0;
                        const isEditing = rbEditing?.id === rb.id;
                        const mailBody = encodeURIComponent(isEditing ? rbEditing.text : rb.draft_text);
                        return (
                          <div key={rb.id} style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: "var(--rt-sh-card)", padding: "13px 15px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 3, letterSpacing: 0.4, color: rb.lane === "lead" ? "#3E2F72" : C.primaryDeep, background: rb.lane === "lead" ? "#EFE9FB" : C.primarySoft }}>
                                {rb.lane === "lead" ? (rb.sequence_step ? `LEAD · TOUCH ${rb.sequence_step}/4` : "LEAD") : "FORMER"}
                              </span>
                              <span style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{name}</span>
                              {company && <span style={{ fontSize: 11.5, color: C.textMuted }}>{company}</span>}
                              {worth > 0 && <span style={{ fontSize: 11.5, fontWeight: 700, color: C.primary, fontVariantNumeric: "tabular-nums" }}>~${worth.toLocaleString()}/mo</span>}
                              <span style={{ flex: 1 }} />
                              <button onClick={() => openDossier(rb.rolodex_id)} style={{ background: "transparent", border: "none", fontSize: 10.5, color: C.textMuted, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Dossier</button>
                            </div>
                            {rb.trigger_reason && (
                              <div style={{ ...FR, fontSize: 12.5, color: C.textSec, lineHeight: 1.5, margin: "7px 0 8px" }}>{rb.trigger_reason}</div>
                            )}
                            {isEditing ? (
                              <textarea
                                value={rbEditing.text}
                                onChange={ev => setRbEditing({ id: rb.id, text: ev.target.value })}
                                rows={5}
                                style={{ width: "100%", boxSizing: "border-box", border: "none", boxShadow: "inset 0 0 0 1px " + C.primary, borderRadius: 9, padding: "9px 11px", background: C.bg, fontFamily: "inherit", fontSize: 12.5, color: C.text, outline: "none", resize: "vertical", lineHeight: 1.5 }}
                              />
                            ) : (
                              <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.55, whiteSpace: "pre-wrap", background: C.bg, borderRadius: 9, padding: "9px 11px" }}>{rb.draft_text}</div>
                            )}
                            <div style={{ display: "flex", gap: 6, marginTop: 9, flexWrap: "wrap" }}>
                              {isEditing ? (
                                <>
                                  <button onClick={() => { rbUpdate(rb.id, { draft_text: rbEditing.text }); setRbEditing(null); }} style={{ padding: "7px 13px", background: C.btn, color: "#fff", border: "none", borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Save draft</button>
                                  <button onClick={() => setRbEditing(null)} style={{ padding: "7px 12px", background: "transparent", color: C.textMuted, border: "none", borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                                </>
                              ) : (
                                <>
                                  <a href={"mailto:?subject=" + encodeURIComponent(rb.lane === "lead" ? "Following our conversation" : "Catching up") + "&body=" + mailBody}
                                    onClick={() => sendReachback(rb)}
                                    style={{ display: "inline-flex", alignItems: "center", padding: "7px 14px", background: C.btn, color: "#fff", border: "none", borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: "pointer", textDecoration: "none" }}>Send</a>
                                  <button onClick={() => setRbEditing({ id: rb.id, text: rb.draft_text })} style={{ padding: "7px 12px", background: C.card, color: C.textSec, border: "none", borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", boxShadow: "var(--rt-sh-xs)" }}>Edit</button>
                                  <button onClick={() => notNowReachback(rb)} style={{ padding: "7px 12px", background: "transparent", color: C.textMuted, border: "none", borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Not now</button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Follow-through — sent reach-backs awaiting an outcome.
                      Compact rows: the engine bumps quiet ones on its own
                      clock; these buttons record what actually happened. */}
                  {sentRbs.length > 0 && (
                    <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: "var(--rt-sh-card)", overflow: "hidden" }}>
                      <div className="rt-divider-inset" style={{ padding: "11px 14px 9px" }}>
                        <div style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>Out the door</div>
                      </div>
                      {sentRbs.map((rb, i) => {
                        const e = entryById(rb.rolodex_id);
                        const days = rb.acted_at ? Math.max(0, Math.floor((Date.now() - new Date(rb.acted_at).getTime()) / 86400000)) : 0;
                        return (
                          <div key={rb.id} className={i === sentRbs.length - 1 ? undefined : "rt-divider-inset"} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", flexWrap: "wrap" }}>
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: C.text }}>{entryName(e)}</span>
                            <span style={{ fontSize: 10.5, color: C.textMuted }}>{rb.status === "replied" ? "replied" : "sent"} {days === 0 ? "today" : `${days}d ago`}{rb.lane === "lead" && rb.sequence_step ? ` · touch ${rb.sequence_step}/4` : ""}</span>
                            <span style={{ flex: 1 }} />
                            {rb.status !== "replied" && (
                              <button onClick={() => repliedReachback(rb)} style={{ padding: "5px 10px", background: C.primarySoft, color: C.primaryDeep, border: "none", borderRadius: 999, fontSize: 10.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>They replied</button>
                            )}
                            <button onClick={() => winReachback(rb)} style={{ padding: "5px 10px", background: "#E8F3EC", color: C.retGood, border: "none", borderRadius: 999, fontSize: 10.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{rb.lane === "lead" ? "Signed" : "Rebooked"}</button>
                            <button onClick={() => deadReachback(rb)} style={{ padding: "5px 10px", background: "transparent", color: C.textMuted, border: "none", borderRadius: 999, fontSize: 10.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{rb.lane === "lead" ? "Park it" : "No response"}</button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* CHECK-IN REMINDER BANNER — lives in the main column so
                      it shares the content margin and never overlaps the
                      left rail. Observation-green surface (primarySoft),
                      matching the Health observation cards. */}
                  {/* Check-in due strip (Jul 2026 redesign). The old
                      version was a solid primarySoft slab — the loudest
                      element on a page of quiet white cards, for routine
                      information the left rail already lists. Now it
                      speaks the page's own card language: white, ochre
                      accent bar for urgency, contact avatar, and the
                      capability that was missing entirely — DRAFT WITH
                      RAI, which prefills the Rai composer with the
                      contact's facts (name, company, status, staleness)
                      so Rai writes the re-engagement note. Rai's chat
                      context has no rolodex section, so the prompt must
                      carry the facts itself. */}
                  {dueReminders.length > 0 && !rolodexCheckinDismissed && (() => {
                    const r0 = dueReminders[0];
                    const r0Name = r0.contact_name || r0.contact || r0.client_name || r0.client || "this contact";
                    const r0Co = (r0.client_name || r0.client) && (r0.contact_name || r0.contact) ? (r0.client_name || r0.client) : null;
                    const overdueDays = (() => {
                      const rem = String(r0.reminder || "").slice(0, 10);
                      if (!rem) return 0;
                      return Math.max(0, Math.round((new Date(_reminderToday + "T12:00:00Z").getTime() - new Date(rem + "T12:00:00Z").getTime()) / 86400000));
                    })();
                    const draftWithRai = () => {
                      const staleness = r0.last_touch_at ? `last touch ${Math.round((Date.now() - new Date(r0.last_touch_at).getTime()) / 86400000)} days ago` : (overdueDays > 0 ? `check-in ${overdueDays}d overdue` : "check-in due");
                      const status = r0.status || (deriveTags(r0)[0] || "").toLowerCase() || "kept-warm contact";
                      const notesLine = r0.notes ? ` What the user has noted about them: ${String(r0.notes).slice(0, 400)}.` : "";
                      // Rai's chat context has no rolodex section, so the facts
                      // must ride in as a preloaded context turn. Fresh thread,
                      // context injected, then the drafting ask auto-fires so
                      // she lands on the note itself, not a blank composer.
                      // Route target is "coach" — the Rai page id. ("rai" has no
                      // render branch and blanks the screen.)
                      const context = `The user is on their rolodex and wants to reopen a relationship. Contact: ${r0Name}${r0Co ? ` at ${r0Co}` : ""}. Standing: ${status}. Timing: ${staleness}.${notesLine} You are helping them write a short re-engagement note in their own voice.`;
                      const ask = `Draft a short, warm re-engagement note to ${r0Name}${r0Co ? ` (${r0Co})` : ""}. Reopen the thread naturally, reference our history if you know it, no ask, sounds like me. Give me the note itself first, then a one-line why.`;
                      setRaiLaunching(true);
                      setAiConvoId(null);
                      setAiMessages([]);
                      setAiInput("");
                      setObservationContext(context);
                      pendingAutoSendRef.current = ask;
                      setPage("coach");
                    };
                    const isOverdue = overdueDays > 0;
                    const single = dueReminders.length === 1;
                    return (
                      <div onClick={single ? () => setSelectedRolodex(r0) : undefined} style={{ display: "flex", alignItems: "center", flexWrap: "wrap", rowGap: 10, gap: 11, background: C.dangerSoft, border: "1px solid #F3CFC3", borderRadius: 12, padding: "13px 15px", cursor: single ? "pointer" : "default" }}>
                        <Avatar id={r0.id} name={r0Name} size={36} />
                        <div style={{ flex: 1, minWidth: 180 }}>
                          {single ? (
                            <>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 14, color: C.text, fontWeight: 700 }}>{r0Name}</span>
                                <span style={{ fontSize: 9.5, fontWeight: 700, color: "#fff", background: C.danger, borderRadius: 999, padding: "2px 8px" }}>{isOverdue ? `${overdueDays}d overdue` : "due today"}</span>
                              </div>
                              <div style={{ fontSize: 11.5, color: C.textSec, marginTop: 2 }}>{r0Co ? r0Co + " · " : ""}time for a check-in</div>
                            </>
                          ) : (
                            <>
                              <div style={{ fontSize: 14, color: C.text, fontWeight: 700 }}>{dueReminders.length} check-ins due</div>
                              <div style={{ fontSize: 11.5, color: C.textSec, marginTop: 2 }}>
                                {dueReminders.slice(0, 2).map(r => r.contact_name || r.contact || r.client_name || r.client).join(", ")}{dueReminders.length > 2 ? ", and " + (dueReminders.length - 2) + " more" : ""}
                              </div>
                            </>
                          )}
                        </div>
                        <button
                          onClick={ev => { ev.stopPropagation(); draftWithRai(); }}
                          style={{ background: "#fff", color: C.text, border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0, boxShadow: "0 1px 2px rgba(20,30,22,0.08)" }}
                        >{single ? "Draft Note" : "Review"}</button>
                        {single && (
                          <button
                            onClick={ev => { ev.stopPropagation(); markCheckIn(r0); }}
                            title="Records the touch and clears this check-in"
                            style={{ background: "transparent", color: C.text, border: "1px solid #E7C0B6", borderRadius: 8, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
                          >Mark Check-In</button>
                        )}
                        <button
                          type="button"
                          onClick={ev => { ev.stopPropagation(); dismissRolodexCheckin(); }}
                          aria-label="Dismiss check-in reminder"
                          style={{ background: "transparent", border: "none", color: "#B58575", fontSize: 18, lineHeight: 1, cursor: "pointer", fontFamily: "inherit", padding: "4px 2px", flexShrink: 0 }}
                        >×</button>
                      </div>
                    );
                  })()}

                  {/* ACTIVE RETRO (top card) or empty state */}
                  {/* RETRO — compact prompt by default; the five-step card
                      expands on demand instead of dominating the page. */}
                  {active && !retroOpen && (
                    <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: "var(--rt-sh-card)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                      <Avatar id={active.id} name={active.client_name || active.client || "Untitled"} size={32} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>
                          {queued.length === 1
                            ? `${active.client_name || active.client || "Untitled"} retro waiting`
                            : `${queued.length} retros waiting`}
                        </div>
                        <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 1 }}>Capture the lesson while it's fresh · {activeSteps.length} steps</div>
                      </div>
                      <button className="r-btn" data-tone="green" onClick={() => setRetroOpen(true)} style={{ color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>Start Retro</button>
                    </div>
                  )}
                  {active && retroOpen && (
                    <div style={{ position: "relative", paddingBottom: 8 }}>
                      {/* Peek of next cards behind */}
                      {queued.length > 1 && <div style={{ position: "absolute", top: 8, left: 8, right: 8, bottom: 16, background: C.card, border: "1px solid " + C.border, borderRadius: 12, opacity: 0.5, zIndex: 0 }} />}
                      {queued.length > 2 && <div style={{ position: "absolute", top: 4, left: 4, right: 4, bottom: 12, background: C.card, border: "1px solid " + C.border, borderRadius: 12, opacity: 0.8, zIndex: 0 }} />}
                      <div style={{ position: "relative", zIndex: 1, background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: "var(--rt-sh-card)", overflow: "hidden" }}>
                        {/* Header */}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 20px 14px" }}>
                          <Avatar id={active.id} name={active.client_name || active.client} size={44} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: -0.2 }}>{active.client_name || active.client}</div>
                            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{active.contact_name || active.contact || "No contact"}{active.type === "former" ? " · Former client" : " · New lead"}</div>
                          </div>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: active.type === "former" ? C.retGood : C.primary, background: active.type === "former" ? "#E8F3EC" : C.primarySoft, padding: "3px 8px", borderRadius: 4, letterSpacing: 0.3, textTransform: "uppercase" }}>
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
                            <div className="rt-divider-inset-top" style={{ padding: "16px 18px 18px", background: C.card, "--rt-inset": "18px" }}>
                              <div style={{ fontSize: 14, color: C.text, lineHeight: 1.55, marginBottom: 14 }}>Delete <b>{active.client_name || active.client}</b> from your rolodex? This is permanent — you won't be able to get this contact back.</div>
                              <div style={{ display: "flex", gap: 8 }}>
                                <button onClick={() => { setRolodex(prev => prev.filter(x => x.id !== active.id)); rolodexDb.delete(active.id); setRetroDeleteConfirm(false); advanceAfterRetro(); }} style={{ flex: 1, padding: "11px", background: C.danger, color: "#fff", border: "none", borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
                                <button onClick={() => setRetroDeleteConfirm(false)} style={{ padding: "11px 18px", background: C.surface, color: C.text, border: "none", borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                          <div className="rt-divider-inset-top" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 18px 15px", "--rt-inset": "18px" }}>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button onClick={() => setRetroOpen(false)} style={{ fontSize: 12.5, color: C.textMuted, padding: "8px 12px", borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>Minimize</button>
                              <button onClick={advanceAfterRetro} style={{ fontSize: 12.5, color: C.textMuted, padding: "8px 12px", borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>Skip for now</button>
                              <button onClick={() => setRetroDeleteConfirm(true)} style={{ fontSize: 12.5, color: C.danger, padding: "8px 12px", borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>Delete</button>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button onClick={onPrev} disabled={effectiveStep === 0} style={{ padding: "9px 16px", background: C.card, color: C.textSec, borderRadius: 9, fontSize: 13, fontWeight: 600, border: "none", boxShadow: "inset 0 0 0 1px " + C.border, cursor: effectiveStep === 0 ? "default" : "pointer", opacity: effectiveStep === 0 ? 0.5 : 1, fontFamily: "inherit" }}>Back</button>
                              <button onClick={onNext} style={{ padding: "9px 20px", background: C.primaryDeep, color: "#fff", borderRadius: 9, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit" }}>Next</button>
                            </div>
                          </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {/* FILED — dense card grid. Each card: who, type,
                      warmth + recency, reminder state, heat. Click opens
                      the contact detail. */}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 4px 10px", flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "Fraunces, Georgia, serif", fontStyle: "italic", fontSize: 15, color: C.text }}>filed</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, padding: "1px 8px", background: C.borderLight, borderRadius: 999 }}>{filteredFiled.length}</span>
                      <span style={{ flex: 1 }} />
                      {[
                        { v: "all",      label: "All" },
                        { v: "warm",     label: "Warm" },
                        { v: "cold",     label: "Cold" },
                        { v: "former",   label: "Former" },
                        { v: "oneoff",   label: "Leads" },
                      ].map(f => {
                        const isSel = filedFilter === f.v || (f.v === "all" && (!filedFilter || filedFilter === "all"));
                        return (
                          <button key={f.v} onClick={() => setFiledFilter(f.v)} style={{
                            border: "none", cursor: "pointer", fontFamily: "inherit",
                            padding: "3px 10px", borderRadius: 999, fontSize: 11,
                            ...(isSel
                              ? { background: C.primarySoft, color: C.primary, fontWeight: 700 }
                              : { background: "transparent", color: C.textSec, fontWeight: 500 }),
                          }}>{f.label}</button>
                        );
                      })}
                      <input value={rolodexSearch} onChange={e => setRolodexSearch(e.target.value)} placeholder="Search filed…" style={{ width: 170, padding: "8px 12px", borderRadius: 9, fontSize: 12.5, fontFamily: "inherit", background: C.card, border: "none", boxShadow: "inset 0 0 0 1px " + C.borderLight, outline: "none", color: C.text }} />
                    </div>

                    {filteredFiled.length === 0 ? (
                      <div style={{ padding: "30px 20px", background: C.card, border: "1px dashed " + C.border, borderRadius: 12, textAlign: "center", color: C.textMuted, fontSize: 13 }}>
                        {filedFilter === "all" ? "No filed contacts yet." : "Nothing matches this filter."}
                      </div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 8 }}>
                        {filteredFiled.map(e => {
                          const tags = deriveTags(e);
                          const heat = calcHeat(e);
                          const name = e.client_name || e.client || "Untitled";
                          const contact = e.contact_name || e.contact || "";
                          const band = warmthBand(e);
                          const wm = WARMTH_META[band];
                          const refer = tags.includes("Would refer");
                          const reminderRaw = e.reminder ?? e.reminder_date;
                          let reminderChip = null;
                          if (reminderRaw) {
                            const reminderYmd = String(reminderRaw).slice(0, 10);
                            const diffDays = Math.round((new Date(reminderYmd).getTime() - new Date(_checkinTodayYmd).getTime()) / 86400000);
                            if (diffDays < 0) reminderChip = { label: `Overdue ${Math.abs(diffDays)}d`, color: "#fff", bg: "#C04323" };
                            else if (diffDays === 0) reminderChip = { label: "Check in today", color: "#fff", bg: "#C04323" };
                            else if (diffDays <= 30) reminderChip = { label: `Next: in ${diffDays}d`, color: C.primary, bg: C.primarySoft };
                          }
                          return (
                            <div key={e.id} onClick={() => setSelectedRolodex(e)} style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: "var(--rt-sh-card)", padding: "11px 14px", cursor: "pointer", display: "flex", flexDirection: "column", gap: 9 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                                <Avatar id={e.id} name={name} size={30} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, letterSpacing: -0.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {name}{refer && <span style={{ color: C.retGood, marginLeft: 5, fontSize: 11 }}>★</span>}
                                  </div>
                                  <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {contact ? contact + " · " : ""}{e.type === "former" ? "Former" : "New lead"}
                                  </div>
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                                <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, color: wm.tone, background: wm.bg }}>{wm.label.toLowerCase()} · {agoLabel(e)}</span>
                                {reminderChip && <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, color: reminderChip.color, background: reminderChip.bg }}>{reminderChip.label}</span>}
                                {e.priority === "high" && <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, color: "#fff", background: "linear-gradient(90deg, #D17A1B, #C04323)" }}>Heat {heat}</span>}
                                {e.lead_status === "active" && seqStepFor(e.id) > 0 && (
                                  <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, color: "#3E2F72", background: "#EFE9FB" }}>touch {seqStepFor(e.id)}/4</span>
                                )}
                                {e.lead_status === "parked" && (
                                  <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, color: C.textMuted, background: C.borderLight }}>parked</span>
                                )}
                                {e.lead_value > 0 && (
                                  <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, color: C.primary, background: C.primarySoft, fontVariantNumeric: "tabular-nums" }}>~${Number(e.lead_value).toLocaleString()}/mo</span>
                                )}
                                <span style={{ flex: 1 }} />
                                <button
                                  onClick={ev => { ev.stopPropagation(); logTouch(e); }}
                                  title="Stamp today as the last touch"
                                  style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, color: C.textSec, background: "transparent", border: "1px solid " + C.borderLight, cursor: "pointer", fontFamily: "inherit" }}
                                >Log touch</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Dossier modal — Rai's pre-call brief, on demand */}
              {dossier && createPortal(
                <div onClick={() => setDossier(null)} style={{ position: "fixed", inset: 0, background: "rgba(20,30,22,0.40)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Manrope', system-ui, sans-serif", padding: 16 }}>
                  <div onClick={e => e.stopPropagation()} style={{ background: C.card, borderRadius: 16, padding: 24, width: "100%", maxWidth: 460, boxShadow: "0 1px 3px rgba(20,30,22,0.08), 0 20px 60px rgba(20,30,22,0.18)" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 1, color: "#7c5cf3" }}>✦ RAI · DOSSIER</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{dossier.name}</span>
                    </div>
                    {dossier.loading ? (
                      <div style={{ ...FR, fontSize: 13, color: C.textMuted, padding: "16px 0" }}>Reading the file…</div>
                    ) : (
                      <div style={{ ...FR, fontSize: 13.5, color: C.text, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{dossier.text}</div>
                    )}
                    <div style={{ textAlign: "right", marginTop: 14 }}>
                      <button onClick={() => setDossier(null)} style={{ padding: "9px 16px", background: C.surface, color: C.text, border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Close</button>
                    </div>
                  </div>
                </div>,
                document.body
              )}

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
                      {/* ─── Lead intake (Jul 2026): 30 seconds that ground
                          every draft Rai writes for this lead. Optional
                          except source. ─── */}
                      {newRolodexEntry.type === "oneoff" && (
                        <>
                          <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Where did they come from?</label>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {[{ v: "referral", label: "Referral" }, { v: "inbound", label: "Inbound" }, { v: "met", label: "Met them" }, { v: "cold", label: "Cold" }].map(s => (
                                <button key={s.v} onClick={() => setLeadIntake({ ...leadIntake, source: s.v })} style={{ flex: "1 1 auto", padding: "8px 10px", background: leadIntake.source === s.v ? C.primarySoft : C.card, border: "none", boxShadow: "inset 0 0 0 1px " + (leadIntake.source === s.v ? C.primary : C.borderLight), borderRadius: 9, fontSize: 12, fontWeight: 600, color: leadIntake.source === s.v ? C.primary : C.textSec, cursor: "pointer", fontFamily: "inherit" }}>{s.label}</button>
                              ))}
                            </div>
                            {leadIntake.source === "referral" && (
                              <input value={leadIntake.refFrom} onChange={e => setLeadIntake({ ...leadIntake, refFrom: e.target.value })} placeholder="Referred by whom?" style={{ width: "100%", marginTop: 6, padding: "10px 13px", borderRadius: 9, fontSize: 13, fontFamily: "inherit", background: C.card, border: "none", boxShadow: "inset 0 0 0 1px " + C.borderLight, color: C.text, outline: "none", boxSizing: "border-box" }} />
                            )}
                          </div>
                          <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>What do they need? <span style={{ fontWeight: 400 }}>(one line)</span></label>
                            <input value={leadIntake.need} onChange={e => setLeadIntake({ ...leadIntake, need: e.target.value })} placeholder="Paid social for their Q4 launch" style={{ width: "100%", padding: "10px 13px", borderRadius: 9, fontSize: 13, fontFamily: "inherit", background: C.card, border: "none", boxShadow: "inset 0 0 0 1px " + C.borderLight, color: C.text, outline: "none", boxSizing: "border-box" }} />
                          </div>
                          <div style={{ display: "flex", gap: 10 }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Urgency</label>
                              <div style={{ display: "flex", gap: 6 }}>
                                {[{ v: "now", label: "Now" }, { v: "quarter", label: "This quarter" }, { v: "someday", label: "Someday" }].map(u => (
                                  <button key={u.v} onClick={() => setLeadIntake({ ...leadIntake, urgency: u.v })} style={{ flex: 1, padding: "8px 6px", background: leadIntake.urgency === u.v ? C.primarySoft : C.card, border: "none", boxShadow: "inset 0 0 0 1px " + (leadIntake.urgency === u.v ? C.primary : C.borderLight), borderRadius: 9, fontSize: 11.5, fontWeight: 600, color: leadIntake.urgency === u.v ? C.primary : C.textSec, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{u.label}</button>
                                ))}
                              </div>
                            </div>
                            <div style={{ width: 120 }}>
                              <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>$/mo if known</label>
                              <input type="number" min="0" value={leadIntake.value} onChange={e => setLeadIntake({ ...leadIntake, value: e.target.value })} placeholder="2500" style={{ width: "100%", padding: "10px 13px", borderRadius: 9, fontSize: 13, fontFamily: "inherit", background: C.card, border: "none", boxShadow: "inset 0 0 0 1px " + C.borderLight, color: C.text, outline: "none", boxSizing: "border-box" }} />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {(() => {
                        const ready = newRolodexEntry.client.trim() && newRolodexEntry.contact.trim();
                        return (
                          <button disabled={!ready} onClick={async () => {
                            const entryType = newRolodexEntry.type || "former";
                            const isLead = entryType === "oneoff";
                            // Leads skip the retro (nothing to retro yet):
                            // the intake IS their filing. They land filed at
                            // high priority (they're active pipeline), and
                            // the first touch is prepared before this modal
                            // closes (speed-to-lead, B1).
                            const payload = {
                              client_name: newRolodexEntry.client.trim(),
                              contact_name: newRolodexEntry.contact.trim(),
                              type: entryType,
                              retro_answers: {},
                            };
                            if (isLead) {
                              payload.lead_status = "active";
                              payload.lead_source = leadIntake.source === "referral" && leadIntake.refFrom.trim()
                                ? `referral:${leadIntake.refFrom.trim()}` : leadIntake.source;
                              payload.lead_need = leadIntake.need.trim() || null;
                              payload.lead_urgency = leadIntake.urgency;
                              payload.lead_value = parseInt(leadIntake.value) || 0;
                              payload.priority = "high";
                              payload.priority_set_at = new Date().toISOString();
                            }
                            const { data: created, error: createErr } = await rolodexDb.create(user.id, payload);
                            if (createErr) console.warn("Rolodex create failed:", createErr);
                            if (created) {
                              const newEntry = { ...created, client: created.client_name, contact: created.contact_name, type: entryType, retro_answers: {}, tags: [] };
                              setRolodex(prev => [newEntry, ...prev]);
                              if (isLead) {
                                prepReachback(created.id); // fire-and-forget; card appears when ready
                              } else {
                                setRolodexFlowOpen(created.id);
                                setRetroOpen(true);
                                setRolodexStep(0);
                                setRolodexStepOwner(created.id);
                                setRolodexStepText(null);
                              }
                            }
                            setNewRolodexEntry({ client: "", contact: "", work: "", type: "former" });
                            setLeadIntake({ source: "inbound", refFrom: "", need: "", urgency: "quarter", value: "" });
                            setShowAddRolodex(false);
                          }} onMouseEnter={e => { if (ready) e.currentTarget.style.background = C.primary; }} onMouseLeave={e => { if (ready) e.currentTarget.style.background = C.primaryDeep; }} style={{ flex: 1, padding: "12px", background: ready ? C.primaryDeep : C.surfaceWarm, color: ready ? "#fff" : C.textMuted, border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: ready ? "pointer" : "default", fontFamily: "inherit", transition: "background 120ms ease" }}>{newRolodexEntry.type === "oneoff" ? "Add lead" : "Add & start retro"}</button>
                        );
                      })()}
                      <button onClick={() => { setShowAddRolodex(false); setNewRolodexEntry({ client: "", contact: "", work: "", type: "former" }); setLeadIntake({ source: "inbound", refFrom: "", need: "", urgency: "quarter", value: "" }); }} style={{ padding: "12px 18px", background: C.surface, color: C.text, border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
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
