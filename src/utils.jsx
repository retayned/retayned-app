import { C } from "./theme";

// ============================================================
// Avatar initials helpers
// ============================================================
// Two rules, applied consistently across the app:
//
// USER ("Just me", sidebar profile pill, etc) → ONE letter.
//   - First letter of full_name if available.
//   - Else first letter of the email's local part.
//   - Else "U".
//
// WORKERS → TWO letters.
//   - Multi-word names ("John Smith") → first letter of first +
//     first letter of last word: "JS".
//   - Single-word names ("Sarah") → first two letters of the
//     word: "SA". Always two letters when possible.
//
// Keeps avatar visual rhythm consistent — user is always a single
// glyph, workers are always two — so the eye can tell them apart
// at a glance in the worker-picker dropdown.

function getUserInitial(user) {
  const n = user?.user_metadata?.full_name;
  if (n && n.trim().length > 0) return n.trim()[0].toUpperCase();
  const email = user?.email;
  if (email && email.length > 0) return email[0].toUpperCase();
  return "U";
}

function getWorkerInitials(name) {
  if (!name || typeof name !== "string") return "??";
  const trimmed = name.trim();
  if (trimmed.length === 0) return "??";
  const parts = trimmed.split(/\s+/).filter(p => p.length > 0);
  if (parts.length >= 2) {
    // Multi-word — first letter of first word + first letter of LAST word.
    // "John Smith" → "JS"; "John Quincy Adams" → "JA".
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  // Single-word — first two letters of the only word.
  // "Sarah" → "SA"; "Mike" → "MI"; "A" → "A" (degenerate single char).
  return parts[0].slice(0, 2).toUpperCase();
}

function retColor(v) {
  if (v >= 80) return "#0C3A2E";      // Elite (retElite)
  if (v >= 65) return "#1F7A5C";      // Good (retGood)
  if (v >= 45) return "#A8A420";      // Ok / Watch (retOk)
  if (v >= 30) return "#D17A1B";      // Warn / At Risk (retWarn)
  return "#B4341F";                    // Critical (retCrit)
}

// Avatar background — retention-score base color with a top-light /
// bottom-shade sheen overlay so the chip reads as a physical disk
// instead of a flat fill. Single source of truth used by every avatar
// site-wide (Today task page, Clients page, Referrals, Rolodex, Health).
// The overlay never overpowers the base color; the retention signal
// (green/amber/red) always reads through.
function retGradient(v) {
  return `linear-gradient(135deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0) 55%, rgba(0,0,0,0.12) 100%), ${retColor(v)}`;
}

// Whitelist of verbs that signal a task where the user benefits from
// talking it through with Rai — either DELIBERATION (decide, plan,
// analyze) or COMPOSITION (write the thing, draft the note). Pure-
// execution verbs (call, log, file, complete, finish) are deliberately
// excluded — those tasks need doing, not discussing.
//
// Adding verbs is cheap; removing them is painful once users get used
// to the affordance. Start small, expand based on what users type.
//
// ORDER MATTERS: detectThinkingVerb returns the FIRST match. Composition
// verbs come first because they're more action-specific — "Send Ardath
// a note on what's planned" should match "send" (composition, produce
// the note) NOT "plan" (deliberation). The earlier ordering produced a
// bug where every task containing "plan" or "review" anywhere in the
// sentence (e.g. "review what's planned") got routed to think-through
// mode even when the actual verb of the task was composition.
//
// EXCLUDED on purpose: call, text, email (the verb — "email Ardath"),
// log, file, finish, complete, do, follow up. These are execution
// verbs — the user knows what to do, Rai can't help them do it faster.
const THINKING_VERBS = [
  // Composition — produce an artifact. Comes FIRST so verbs like "send"
  // / "write" / "draft" / "recap" beat downstream deliberation matches.
  "write", "draft", "compose",
  "send", // covers "send a note", "send the recap" — composition tasks
  "prepare", "propose", "outline",
  "recap", "summarize", "brief",
  "pitch", "frame",
  // Deliberation — think it through, no required artifact.
  "decide", "figure out", "plan", "prep", "think through",
  "strategize", "approach", "review", "read", "check",
  "analyze", "assess", "evaluate",
];

// Detect whether a task's text begins with (or prominently contains) a
// thinking verb. Word-boundary aware so "preparation" doesn't match "prep"
// in a way that fires for unrelated text. Lowercases input for matching.
// Returns the matched verb (string) or null.
function detectThinkingVerb(text) {
  if (!text) return null;
  const lc = String(text).toLowerCase();
  for (const v of THINKING_VERBS) {
    // Multi-word verbs: simple substring check is fine ("think through")
    if (v.includes(" ")) {
      if (lc.includes(v)) return v;
    } else {
      // Single-word verbs: word-boundary regex to avoid "review" matching "reviewed"
      // ... actually we want "reviewed" too (still a review action), so use
      // start-of-word boundary only.
      const re = new RegExp(`\\b${v}`, "i");
      if (re.test(lc)) return v;
    }
  }
  return null;
}

// Build the context payload that gets prepended (as a synthesized
// assistant message) when a user opens the Rai chat from a task. Goal:
// Rai already knows everything she'd need to help draft / decide /
// analyze, so the user doesn't have to re-explain who the client is.
//
// Pulls 14 days of activity per the user's request. Cost is trivial
// at this scale — a few hundred tokens of structured text per click.
//
// Sources (all pre-filtered to this client):
//   - client profile (revenue, tenure, retention, drift, profile scores)
//   - last 14 days of tasks (text + status + age)
//   - last 14 days of touchpoints (channel + age)
//   - if AI-suggested: the `why` from rai_suggestions
//   - most recent Rai pick if this client was the anchor in last 7 days
//
// Returns a multi-paragraph string sized for direct insertion as
// the first assistant turn in the chat history.
// Detect artifact-shaped work — tasks whose deliverable is a heavy
// creative artifact (ads, decks, reports, pages) better made in Claude
// than discussed with Rai. Distinct from THINKING_VERBS on purpose: a
// task can be BOTH discussable (purple underline → Rai) and artifact
// (Do in Claude × Rai chip) — two routes, user picks. Word-boundary
// matched; verb OR noun qualifies ("Create new statics", "Spring
// launch statics" both fire).
const ARTIFACT_VERBS = ["create", "build", "design", "make", "produce", "mock up", "mockup"];
const ARTIFACT_NOUNS = ["report", "deck", "presentation", "slides", "ads", "ad set", "statics", "creative", "creatives", "landing page", "one-pager", "one pager", "mockup", "banner", "banners", "carousel", "graphics", "video script", "case study", "whitepaper", "proposal doc"];
function detectArtifactWork(text) {
  if (!text || typeof text !== "string") return false;
  const s = text.toLowerCase();
  const hit = (w) => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(s);
  // Verb REQUIRED (an email mentioning "the report" isn't artifact work);
  // then either a known artifact noun or a newness signal ("create new
  // assets") qualifies. Conservative on purpose — a missing chip is a
  // shrug, a wrong chip is noise.
  return ARTIFACT_VERBS.some(hit) && (ARTIFACT_NOUNS.some(hit) || /\bnew\b|\bassets?\b/.test(s));
}

function buildTaskDiscussionContext({ task, client, tasks, touchpoints, recentPick, suggestion }) {
  if (!client) return null;
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const TWO_WEEKS = 14 * DAY;
  const ageDays = (iso) => {
    if (!iso) return null;
    const ms = new Date(iso).getTime();
    if (Number.isNaN(ms)) return null;
    return Math.max(0, Math.floor((now - ms) / DAY));
  };

  // ─── Client snapshot ──────────────────────────────────────────────
  const lines = [];
  lines.push(`The user is about to work on this task:`);
  lines.push(`  "${task.text}"`);
  lines.push("");
  lines.push(`Client: ${client.name}`);
  const facts = [];
  if (client.revenue != null) facts.push(`revenue $${Number(client.revenue).toLocaleString()}/mo`);
  if (client.months != null) facts.push(`${client.months} months in`);
  else if (client.start_date) {
    const m = Math.floor((now - new Date(client.start_date).getTime()) / (30.4375 * DAY));
    if (Number.isFinite(m) && m >= 0) facts.push(`${m} months in`);
  }
  if (client.retention_score != null) facts.push(`retention ${client.retention_score}`);
  if (client.drift_status) facts.push(`drift ${client.drift_status}`);
  if (facts.length) lines.push(`  ${facts.join(" · ")}`);
  // Profile scores expose the relationship texture (trust, grace, etc.)
  if (client.profile_scores && typeof client.profile_scores === "object") {
    const entries = Object.entries(client.profile_scores)
      .filter(([, v]) => typeof v === "number")
      .map(([k, v]) => `${k} ${v}`);
    if (entries.length) lines.push(`  Profile: ${entries.join(", ")}`);
  }

  // ─── Why Rai surfaced this task (if AI-suggested) ─────────────────
  if (suggestion && (suggestion.why || suggestion.signal)) {
    lines.push("");
    lines.push(`I (Rai) proposed this task because:`);
    if (suggestion.why) lines.push(`  ${suggestion.why}`);
    if (suggestion.signal && suggestion.signal !== "no_signal") {
      lines.push(`  Signal type: ${suggestion.signal}`);
    }
  }

  // ─── Recent pick context (if this client was anchored recently) ───
  if (recentPick && recentPick.reason_detail) {
    lines.push("");
    lines.push(`Recent daily brief that mentioned this client:`);
    lines.push(`  "${recentPick.reason_detail}"`);
  }

  // ─── 14d task history for this client ─────────────────────────────
  const clientTasks = (tasks || []).filter(t => {
    if (!t) return false;
    const matchesClient = t.client_id === client.id || t.client_name === client.name;
    if (!matchesClient) return false;
    const createdMs = t.created_at ? new Date(t.created_at).getTime() : null;
    const completedMs = t.completed_at ? new Date(t.completed_at).getTime() : null;
    const anchorMs = completedMs || createdMs;
    if (anchorMs == null) return false;
    return (now - anchorMs) <= TWO_WEEKS;
  })
    // Newest first; cap to 20 entries to keep the payload tight
    .sort((a, b) => {
      const am = new Date(a.completed_at || a.created_at).getTime();
      const bm = new Date(b.completed_at || b.created_at).getTime();
      return bm - am;
    })
    .slice(0, 20);
  if (clientTasks.length) {
    lines.push("");
    lines.push(`Last 14 days of tasks for ${client.name} (newest first):`);
    for (const t of clientTasks) {
      const status = t.done ? "done" : (t.cleared_at ? "cleared" : "open");
      const ageRef = t.completed_at || t.created_at;
      const age = ageDays(ageRef);
      const ageStr = age === 0 ? "today" : age === 1 ? "1d ago" : `${age}d ago`;
      lines.push(`  · [${status}, ${ageStr}] ${t.text}`);
    }
  } else {
    lines.push("");
    lines.push(`No tasks logged for ${client.name} in the last 14 days.`);
  }

  // ─── 14d touchpoint history for this client ───────────────────────
  const clientTouchpoints = (touchpoints || []).filter(tp => {
    if (!tp || tp.client_id !== client.id) return false;
    const ms = tp.occurred_at ? new Date(tp.occurred_at).getTime() : null;
    return ms != null && (now - ms) <= TWO_WEEKS;
  })
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    .slice(0, 15);
  if (clientTouchpoints.length) {
    lines.push("");
    lines.push(`Last 14 days of logged touchpoints for ${client.name}:`);
    for (const tp of clientTouchpoints) {
      const age = ageDays(tp.occurred_at);
      const ageStr = age === 0 ? "today" : age === 1 ? "1d ago" : `${age}d ago`;
      const channel = tp.channel || "contact";
      const note = tp.note ? ` — ${String(tp.note).slice(0, 120)}` : "";
      lines.push(`  · [${channel}, ${ageStr}]${note}`);
    }
  } else {
    lines.push("");
    lines.push(`No touchpoints logged for ${client.name} in the last 14 days.`);
  }

  lines.push("");
  lines.push(`The user has clicked into this task to actually DO IT with your help. The very first thing in your response must be the ARTIFACT ITSELF — the draft, the analysis, the recommendation. Not framing, not reasoning, not "okay here's what I'm reading," not "let me think this through." If the task is a draft/note/email, the email comes FIRST. If it's analysis, the analysis comes first with the conclusion stated up front. If it's a decision, your recommendation comes first.

After the artifact, you may add a short "Here's why I went this way" paragraph if there are real choices worth flagging (tone, length, what you left out). Keep it brief — 3-5 bullets max.

FORBIDDEN openings (these are signs you're stalling): "Okay, here's what I'm reading", "Let me think this through", "Here's what I'd hit in the note", "A few things worth noting about the approach". The user can already see your reasoning by reading the artifact you produced. Do not pre-explain the artifact before producing it.

FORBIDDEN closer: "Want me to draft something based on this?" — you should have ALREADY drafted it. The right closer if any is "Want me to adjust anything?" or just nothing — the artifact stands on its own.

Do not ask the user to re-explain who the client is; the context above already covers it.`);

  return lines.join("\n");
}

// ────────────────────────────────────────────────────────────────────
// SMART COMPOSER PARSER
//
// Reads a free-form task sentence and infers:
//   - which client it's about    (fuzzy match against client names)
//   - which worker is assigned   (fuzzy match against worker names; null = self)
//   - which date it falls on     (today / tomorrow / weekday names / "later" / "in N days")
//
// Key data assumption: clients are companies (multi-word, capitalized), workers
// are humans (single first name). The parser exploits this — workers must match
// a human first name from the workersList; clients match anywhere else.
//
// "later" → today + 6 days (intentionally — leaves a day before next meeting)
//
// The parser also returns the cleaned title (with matched words stripped) and
// span ranges so the input field can highlight matches inline as the user types.
// ────────────────────────────────────────────────────────────────────

function escapeRegexChars(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function addDays(d, n) {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

// Returns today's calendar date at noon local. Used by parseComposer so
// natural-language dates like "tomorrow" or "in 3 days" resolve against
// the same day boundary the UI uses (midnight local rollover).
function todayAnchored() {
  const d = new Date();
  // Reset time-of-day to start of day so addDays() math is clean
  d.setHours(12, 0, 0, 0);
  return d;
}

// Convert a Date to a YYYY-MM-DD string using LOCAL timezone.
// CRITICAL: `new Date().toISOString().slice(0,10)` returns UTC date, which
// flips a day early/late at edge hours (e.g. 11pm MST = 6am UTC tomorrow).
// Use this anywhere a "today" string anchors task or sweep queries.
function localYmd(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ─────────────────────────────────────────────────────────────
// TZ-AWARE MIDNIGHT (post-May-2026 fix)
//
// Background: previously, the frontend used `setHours(0,0,0,0)` for the
// midnight rollover cutoff and the recurring-task reset cutoff. That
// reads the BROWSER's wall clock, which can drift from the user's stored
// `profiles.timezone` — e.g. Chrome holding a stale resolvedOptions TZ
// after macOS changes its clock. Drift caused the recurring-task reset
// to fire at the wrong time (22:00 MDT instead of 00:00 MDT) and reset
// completed recurring tasks back to un-done.
//
// These helpers anchor to a passed-in IANA TZ (canonically the user's
// `profiles.timezone`), independent of whatever the browser thinks.
// ─────────────────────────────────────────────────────────────

// Minutes that local-tz is AHEAD of UTC at the given instant.
// e.g. America/Denver in MDT → -360 (six hours behind UTC).
// Handles DST automatically because we ask Intl for the offset AT a
// specific instant, not in the abstract.
function tzOffsetMinutes(tz, atDate) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(atDate);
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  // Some engines emit "24" for midnight under hour12:false. Coerce.
  const h = parseInt(p.hour, 10) % 24;
  const localAsUtc = Date.UTC(+p.year, +p.month - 1, +p.day, h, +p.minute, +p.second);
  return Math.round((localAsUtc - atDate.getTime()) / 60000);
}

// UTC instant for local midnight in `tz`, `daysAhead` from the local day
// containing `atDate`.
//   daysAhead = 0 → most recent local midnight (already passed, today's start)
//   daysAhead = 1 → upcoming local midnight (tomorrow's start)
// DST-safe: refines the offset using the offset AT the candidate instant
// so the 23-hour and 25-hour DST-transition days resolve correctly.
function tzMidnightInstant(tz, atDate = new Date(), daysAhead = 0) {
  const offsetMin = tzOffsetMinutes(tz, atDate);
  const localMs = atDate.getTime() + offsetMin * 60000;
  const localMidnightMs = Math.floor(localMs / 86400000) * 86400000 + daysAhead * 86400000;
  let candidateUtcMs = localMidnightMs - offsetMin * 60000;
  const candidateOffset = tzOffsetMinutes(tz, new Date(candidateUtcMs));
  if (candidateOffset !== offsetMin) {
    candidateUtcMs = localMidnightMs - candidateOffset * 60000;
  }
  return candidateUtcMs;
}

// Return a YYYY-MM-DD string representing the local calendar date in `tz`
// at the given instant. Uses Intl.DateTimeFormat — does NOT read the
// browser's wall clock for date parts. Necessary because every getDate()
// / getMonth() / getFullYear() call on a Date object reads the DEVICE's
// timezone, which can disagree with the user's stored timezone (traveling,
// VPN routes time to wrong region, system clock misconfigured, etc).
// When that disagreement crosses midnight in either direction, bucketing
// flips — recurring tasks materialize hours early or hours late.
function ymdInTz(tz, atDate = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(atDate);
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

// ============================================================
// Skeleton loaders — row-shaped placeholders for initial load
// ============================================================
// Used while `dataLoaded` is false. Each variant mirrors the geometry
// of the rows it stands in for, so when real data arrives the layout
// doesn't shift.
// ============================================================

export { getUserInitial, getWorkerInitials, retColor, retGradient, THINKING_VERBS, detectThinkingVerb, detectArtifactWork, buildTaskDiscussionContext, escapeRegexChars, addDays, todayAnchored, localYmd, tzOffsetMinutes, tzMidnightInstant, ymdInTz };

// Long-task compiler: composer text beyond the title cap becomes a short
// scannable title + the FULL original preserved as a note — the same
// title+note shape Brain Dump produces, no AI call needed. Previously
// long input was hard-chopped at the cap and the tail was lost.
export function splitLongTask(text, cap = 75) {
  const t = (text || "").trim();
  if (t.length <= cap) return { text: t, notes: null };
  const firstSentence = t.split(/[.!?]\s+/)[0];
  if (firstSentence && firstSentence.length >= 15 && firstSentence.length <= cap) {
    return { text: firstSentence.replace(/[.!?]+$/, ""), notes: t };
  }
  const cut = t.slice(0, cap - 1).replace(/\s+\S*$/, "");
  return { text: (cut || t.slice(0, cap - 1)) + "…", notes: t };
}

// ============================================================
// Cadence — the ONE cadence model, shared by the Clients table and the
// Health Canopy. Both surfaces MUST call this; keeping two copies is
// how they silently diverged before. Judges each client against their OWN
// history: this week's activity vs a typical prior week.
//
//   • Advisory clients → N/A (no managed rhythm).
//   • First 7 days after add → Calibrating (no baseline yet).
//   • Baseline = MEDIAN of all prior active 7-day windows (>=1 event),
//     back to 90 days. Median (not mean) resists the occasional spike
//     without discarding the light weeks that make up most relationships.
//   • momentum = thisWeek / baseline.
//   • Ahead: momentum >= 1.25 AND a real step-up (>=2 events this week and
//     >=2 above baseline) — guards against 1→2-event false spikes.
//   • Slipping: momentum < 0.75 AND baseline >= 2 — one quiet week off a
//     baseline of 1 isn't a signal.
//   • Steady otherwise — the neutral default, painted sage (primaryMuted),
//     NOT amber, so "fine" doesn't read as a warning.
//
// Returns { state, label, color, momentum } where state is one of
// warming | steady | cooling | calibrating | na.
export function computeCadence(c, { allTouchpoints, allCompletions, personalEvents } = {}) {
  if (c && c.rai_mode === "advisory") return { state: "na", label: "N/A", color: C.textMuted, momentum: 1 };
  const NOW = Date.now();
  const DAY = 86400000;
  const WINDOW = 90 * DAY;

  const addedMs = c.created_at ? new Date(c.created_at).getTime() : null;
  if (addedMs && (NOW - addedMs) < 7 * DAY) return { state: "calibrating", label: "Calibrating", color: C.textMuted, momentum: 1 };

  const stamps = [];
  for (const t of (allTouchpoints || [])) {
    if ((t.client_id && t.client_id === c.id) || t.client_name === c.name) {
      if (t.occurred_at) { const ms = new Date(t.occurred_at).getTime(); if (NOW - ms <= WINDOW) stamps.push(ms); }
    }
  }
  for (const cp of (allCompletions || [])) {
    if ((cp.client_id && cp.client_id === c.id) || cp.client_name === c.name) {
      if (cp.completed_at) { const ms = new Date(cp.completed_at).getTime(); if (NOW - ms <= WINDOW) stamps.push(ms); }
    }
  }
  for (const e of (personalEvents || [])) {
    if (e.client_id && e.client_id === c.id && e.starts_at) {
      const ms = new Date(e.starts_at).getTime();
      if (ms <= NOW && NOW - ms <= WINDOW) stamps.push(ms);
    }
  }

  const counts = {};
  for (const ms of stamps) {
    const w = Math.floor((NOW - ms) / (7 * DAY));
    if (w >= 0 && w < 13) counts[w] = (counts[w] || 0) + 1;
  }
  const thisWeek = counts[0] || 0;

  const priorActive = [];
  for (let w = 1; w < 13; w++) if ((counts[w] || 0) >= 1) priorActive.push(counts[w]);

  if (priorActive.length === 0) {
    if (thisWeek === 0) return { state: "cooling", label: "Slipping", color: C.retWarn, momentum: 0 };
    return { state: "calibrating", label: "Calibrating", color: C.textMuted, momentum: 1 };
  }

  const sortedPrior = priorActive.slice().sort((a, b) => a - b);
  const mid = Math.floor(sortedPrior.length / 2);
  const baseline = sortedPrior.length % 2
    ? sortedPrior[mid]
    : (sortedPrior[mid - 1] + sortedPrior[mid]) / 2;
  const momentum = baseline > 0 ? thisWeek / baseline : (thisWeek > 0 ? 1 : 0);

  if (typeof window !== "undefined" && window.__cadenceDebug) {
    console.log(`[cadence] ${c.name}: thisWeek=${thisWeek} priorActive=[${priorActive.join(",")}] baseline=${baseline.toFixed(1)} m=${momentum.toFixed(2)}`);
  }

  // Ahead is meant to be RARE — a client you've genuinely surged on, not one
  // busy week of ordinary variance. Two guards, both load-bearing:
  //   • momentum >= 1.5 — handles the ratio for larger baselines.
  //   • thisWeek >= baseline + 3 — an absolute gap above THIS client's normal,
  //     so a low-baseline client can't trip Ahead on a single extra touch
  //     (base 2 now needs 5+ this week, not 4). This +3 gap also covers the
  //     small-number floor case, so no separate absolute minimum is needed.
  if (momentum >= 1.5 && thisWeek >= baseline + 3) {
    return { state: "warming", label: "Ahead", color: C.retGood, momentum };
  }
  if (momentum < 0.75 && baseline >= 2) {
    return { state: "cooling", label: "Slipping", color: C.retWarn, momentum };
  }
  return { state: "steady", label: "Steady", color: C.primaryMuted, momentum };
}
