# Retayned — Rai Sweep & AI Surfaces Debt Ledger

One page. Everything known-owed, where it lives, what unblocks it. Update in the same commit-batch as the change that obsoletes an item. "Someone documented it" ≠ "still ratified" — re-verify against live rows before acting on any claim here.

*Current as of Jul 22, 2026. Companion doc: `docs/schema-snapshot.md` (schema truth + standing rulings).*

---

## A. Closed Jul 22 — recorded so nobody re-discovers them

1. **rai-daily-sweep v3.21 deployed** (index + prompt, together): the money laws — brief talks about the work, not the money (money only when money IS the story); money never frames a task — plus **Ruling C: rate-review is dead as a task source, permanently.** Intake-window register (told-not-watched; only voiced content_commitments become tasks; zero legal). Global Guardrails renamed, insinuation clause added. `recent_tasks` = 7 unfinished / 7 finished, hard 7-day window both ways, no backfill. Dismissals suppress ONLY with a written `dismiss_reason` (retroactive; bare deletions are noise). sameWork matcher ratio-only at 0.8 (computed on the owner's own example). `ensurePeriod` on promoted titles (composer parity). Sweep fully blind to the observer (both fetches cut).
2. **Calibration gate v2** in writeSuggestedTasks: account < 7 days AND `intake_completed_at` NULL → ledger-only (rows written pending, nothing lands); the stamp unlocks days 1–6; fail-open if signup date unreadable.
3. **rai-intake shipped end-to-end**: edge fn deployed (JWT **ON** — the fleet's one exception; it auths real user JWTs), intake-prompt v1.4, secrets set (ANTHROPIC_API_KEY, SWEEP_FUNCTION_URL, SWEEP_FUNCTION_AUTH). Frontend IntakeSurface deployed with the cadence→recurrence_pattern fix, ratified against `src/recurrence.jsx` (`cadenceToPattern`, IntakeSurface L45/L268).
4. **The TMF rate saga — conviction OVERTURNED, data restored.** The brief's "rate conversation was opened recently" traced to Rai's own completed Jul-10 suggested task (pre-Ruling-C fossil) — under contact doctrine a completed communicative task IS the event. No bug; the fix is the money laws + Ruling C. `last_revenue_change` fully restored with a reversal comment in code. *Case law: full-drawer protocol before any fabrication verdict; when a conviction is overturned, reverse the cut.*
5. **db.js dual-write comment corrected** (was "old fields authoritative until Phase 4" — false since the flag flip). Verified in repo Jul 22: the comment at the occurrence dual-write now states task_occurrences is the load-bearing record and the write is NOT optional. Closes the old §C.2.

## A′. Closed Jul 17–21 (prior cycle)

1. **Contact has ONE definition:** the `client_last_contact` view (3-surface union). Sweep, chat, prep, and MCP all migrated onto it; per-surface re-derivation is banned. The Fenix incident class is structurally dead.
2. **Sweep payload:** stale touchpoint fields (`days_since_last_touchpoint`, `last_touchpoint_channel`) cut; worker emails cut; `task_bucket_guide` deleted (unique pieces moved into the prompt); confidant tails reviewed and accepted.
3. **Prompt v3.17:** census A1–A6 collapsed (one law, one home); money/score code guards removed per owner ruling, recitation governed by the prompt; **"Never tell the same story twice"** law (no exemptions) + `repeat_check` schema-ordered before `client_id`; full brief text in her 30-day memory; weekend-zero code backstop.
4. **buildSweepInput fetch errors now THROW** — silent-empty memory/roster is impossible; queue retries.
5. **Sweep output cap** 5000 → 32000 (cliff removed through the 250-client product ceiling); comm-task lookback cap **mooted entirely** by the view migration (SQL aggregation, no cap).
6. **Occurrence flag default flipped** — everyone on the occurrence path; `task_completions` is the doomed leg.
7. **Touchpoint channel constraint widened** to call/email/text/meeting/note; `note` = logged-not-contact everywhere. Historical email touchpoints bounced silently for the product's life — **gone, unrecoverable**; email-heavy relationships read cold until fresh logging heals them.
8. **Chat:** 90-day routine merge + all five UTC date-label fixes. **Observer:** routine merge + occurrence fixes in BOTH data layers + worker emails stripped + model → claude-opus-4-8.
9. **Prep:** contact via the view; billing/touchpoints/notes ship only when non-empty (absence is not data); flags → computed `ltv_estimate`; conditional closer + absence law; day-cache rolls at user-local midnight.
10. **MCP v3.6 live:** complete_task (ratified 3-write mirror incl. the load-bearing occurrence upsert), backdating, 3-part dedupe key, closed channel map, scores/drift cut from the brief, offer-once law single-homed. **Mirror ratification CLOSED** (toggle + create ×2, verbatim excerpts).
11. **Owner rulings on record:** midnight completion attribution is intentional (never re-litigate); `completed_at` sacred; quiet-day "say this when fine" outs are rejected on principle (LLMs exploit sanctioned filler).

## B. Code deletions pending (eyes-on-rows before each)

1. **`task_completions` dual-write (Phase-4).** Flag default now ON for all; the two flag-off profiles were test accounts (owner: disregard). Remaining: the occurrence_date-vs-completed_at window semantics note, then the calm-day deletion sequence with soak.
2. **`rai_user_state.next_sweep_eligible_at`** — written every sweep, read by nothing. Stop writing, then drop.
3. **`tasks.archived_at`** — dead column.
4. **`rai_suggestions.work_kind` / `topic_tag`** — unpopulated; drop post-launch.
5. **`hours_to_revenue_ratio`** — computed in ctx_enrichClient, shipped nowhere in the sweep; app-repo non-use confirmed Jul 22; confirm chat/observer non-use, then delete.

## C. Approved, not yet built

1. **Extractor fix** (stamp conversations extracted-at, whatever the outcome; kills ~26x reinforcement inflation + NO_LESSON hourly retries). Needs: one column migration + fresh extractor zip.
2. **Cosmetic, next index touch:** the restored `last_revenue_change` loop re-parses `revHistR.data` where `revHistList` already holds the same cast — harmless duplicate; unify when passing.
3. **Intake improvements, ledgered (Launch Ops builds, specialist grades):** prompt caching on the intake system block; structured outputs on the intake calls. Non-blocking: the weekday substring advisory ("Monitor"→Mon).

## D. Owed audits & checks

1. **Intake acceptance run** (Launch Ops executes, specialist grades): fresh test book → full interview → finalize → day-zero brief vs canon anatomy (all clauses, horizon named, no report-back, zero unauthored tasks — LTV clause is CUT ranker-side). Collect the finalize log (`stamped=true swept=true`) + the sweep line. The run also serves as ratification-by-test for the four [ASSEMBLY NOTE] judgment calls in the deployed intake prompt (phases collapsed to four, chips field removed, set_flags/health_check ops removed, referrals demoted to volunteered-only) — nobody has formally ratified them.
2. **Observer prompt (265 lines)** — never read end-to-end.
3. **Observer output contract** — still SDK + instruction-only JSON; the structured-outputs claim in the v2 handoff never matched source. `select max(fired_at) from observations;` (never run) tells whether it's ever mattered; then decide the raw-fetch + json_schema port.
4. **MCP v3.6 last acceptance leg** — first natural communicative completion through Claude → confirm contact credit in `client_last_contact` (standing instruction with Launch Ops).
5. **rolodex-sweep** — zip never received; audit owed.
6. **Parity manifest** — the data-domain × AI-surface grid replacing update-all-N-surfaces memory tests. Watches, among others, the deliberately two-homed comm-task regex (view SQL + MCP display).

## E. Decisions parked on the owner

1. **`clients.notes` ghost:** column exists, no UI writes it, all-null in prod; three surfaces read it conditionally. Build the notes box (recommended — instantly powers settled-fact lines across sweep/chat/MCP) vs strip the readers.
2. **Brief acknowledgment loop** — a "got it / settled" control suppressing a read until data materially changes. The front-end backstop for anything the spent-story law leaks.
3. **Connectors Directory submission** — package prepared by Launch Ops, ships only on owner word.
4. **Signal-enum merge** (`content_commitment` into `deferral_pattern`) — census-scale, touches prompt + VALID_SIGNALS + schema.
5. **`OWNERS_BRIEF_PROMPT` versioning** — joins the versioned regime before the first real org.
6. **Positive instrumentation / quiet-day theory** — parked; owner skeptical of sanctioned-filler designs; nothing moves without a demonstrated need.
7. **v1 onboarding** — hidden behind `localStorage rt:use-v1-onboarding="1"` (App.jsx L122/L1094); owner test-drives intake, then cut-or-restore.
8. **Intake $330k canon cross-surface alignment** — the LTV clause is cut ranker-side; the interview's own closing speech still carries it. Owner call.

## F. Accepted-for-now & standing quirks (mirrored on purpose)

1. `was_on_time` grades on the UTC date (db.js L364–367, re-verified Jul 22); all writers byte-match the quirk; fix lands in db.js first if ever.
2. Server-side writers use profile-tz for both `completed_on` and `occurrence_date` (deliberate divergence from the app's device/profile split).
3. `other` channel: legal in the DB, unwritten and uncounted — **no integration may ever write it.**
4. root_owner Owner's-Brief failure degrades silently to the ranker pick (console only). Ledgered; matters when a real org exists.
5. Sweep/chat still carry pre-Co-Pilot AM-fencing lanes vs MCP's collapsed seat model — **seat semantics unify at the Co-Pilot build.**
6. COMM_TASK_RE breadth (send/share count as contact) — owner: fine.
7. Cross-surface repetition (four mouths, no shared told-the-user memory) — architecture question, parked; the observer/prep/nudge chorus is the symptom.
8. Extractor/observer/chat prompts remain outside the one-law-one-home census (sweep prompt only, so far).

## G. Live watch

1. **Jul 23 morning** — first night of v3.21. Grade brief + tasks per the handoff's §6; expect zero money framing.
2. **Monday Jul 27** — spent-story verdict #2. Verdict #1 PASSED (first post-fix Monday, the Rose Babe brief). Her nightly `repeat_check` reasoning is in the sweep function logs; a rewritten Lemon Law brief = the fix failed, and the logs show why.
3. First post-deploy weeks of prep memos — absence-narration should be extinct.
4. **Docs debt:** intake spec v1.5 did not ride the docs commit — commit beside these when next touched.
