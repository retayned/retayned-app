# Retayned — Schema Snapshot & Standing Rulings

**Provenance:** Rebuilt 2026-07-21 from specialist-ratified code excerpts (db.js L253–307, L346–474, touchpoints.create — see §7 anchor note), the deployed `mcp-server` v3.6, and live production queries run by the owner during the Jul 18–21 sessions. The Jul 18 generated snapshot was never committed; this file replaces it. **Jul 22 additions** sourced from: the deployed rai-daily-sweep v3.21 bundle (read line-by-line), the Jul 22 handoff record, and direct verification against the committed `retayned-app` / `retayned-site` repos.

**Coverage honesty:** Tables on this week's surfaces are documented from verified evidence. Tables outside them (§9) are listed as present-but-undocumented — do not assert their columns without reading them first.

**The law this file serves:** *Read this before any SQL claim.* If a claim isn't supported here or by a fresh read of the code, it doesn't get asserted.

---

## 1. Doctrine (ratified, owner + sweep specialist)

- **Contact = the `client_last_contact` view. Only.** Three-surface union: past linked calendar events, communicative touchpoints, completed communicative tasks. Never re-derived per surface. View owned by the sweep specialist.
- **Touchpoint channels:** `call / email / text / meeting / note` (DB constraint enforces). `note` = logged-but-NOT-contact (owner ruling): stored, visible as work, excluded from the contact union everywhere, including display lists (Jul 2026 audit — a note must never be narrated as contact).
- **`completed_at` is sacred.** Midnight attribution is intended (owner ruling). Server writes stamp now; no synthesis.
- **`task_occurrences` is the LOAD-BEARING completion record** (occurrence flag default flipped Jul 2026). `task_completions` is the doomed dual-write leg, slated for Phase-4 deletion. Any new completion writer MUST write occurrences (specialist blocker, Jul 21 — zero triggers exist on `public.tasks`; JS is the only occurrence writer).
- **Specialist-owned write lanes (off-limits without ratification):** `rai-daily-sweep` (both files), all write paths to `rai_picks`, `rai_suggestions`, and `is_ai` tasks. The MCP `complete_task` refuses `is_ai` tasks for this reason.
- **Communicative-task regex** is ratified verbatim and deliberately lives in two homes (view SQL + `mcp-server` display list); watched via the parity manifest, not deduplicated.
- **Recitation law (extended to MCP, owner ruling Jul 20):** computed scores and drift verdicts are Rai's internal instruments — never chat material, on any surface. The MCP brief carries neither.
- **Money laws + Ruling C (owner rulings, in v3.21):** the brief talks about the work, not the money — money appears only when money itself is the story; money never frames a task; **rate-review is dead as a task source, permanently.** A completed communicative task IS the event it names (contact credit AND event-truth — the record believes the checkbox; TMF case law Jul 22).
- **Intake stamp (Jul 22):** `rai_user_state.intake_completed_at` is written by rai-intake finalize ONLY when 3+ clients carry evidence-backed dimensions — its presence means grounding exists. Read by the sweep's calibration gate v2 (account < 7d AND stamp NULL → suggestions ledger-only) and shipped to the ranker as `intake_age_days`.

## 2. Domain & infrastructure ruling (Jul 20 — the two-day bug)

- **Bare `retayned.com` is the primary production domain. `www` 308-redirects to bare.** The MCP identity is bare everywhere: connector URL, PRM `resource`, AS `issuer`, `MCP_PUBLIC_BASE`.
- **Why it is law:** a bare→www redirect strips the `Authorization` header on the cross-host hop (standard fetch behavior). Flipping the redirect back silently kills the web connector with `bearer=absent` symptoms. This exact configuration cost Jul 18–20.
- Site metadata (canonical, og:url, robots sitemap line, sitemap `<loc>`s) unified on bare, Jul 20. Re-verified in repo Jul 22.
- `/mcp` routes through the Node proxy `retayned-site/api/mcp.js` (v2.0: forwards Authorization + MCP headers, breadcrumb-logs `auth=true/false` per request). Vercel EXTERNAL rewrites strip Authorization; `/mcp-oauth/*` stays an external rewrite because the token endpoint needs no auth header.
- **Deploy ritual for every edge function:** after Deploy, confirm **Verify JWT is OFF** (it silently re-enables), and confirm the deployed version via `initialize` (stale-stamp drift is how one audit item was born). **One exception: `rai-intake` runs with Verify JWT ON** — it auths real user JWTs. Do not "fix" it to OFF.

## 3. Core tables — verified columns & writers

### `tasks`
`id` uuid · `user_id` · `text` · `notes` · `client_name` · `client_id` · `is_recurring` · `recurrence_pattern` · `due_date` (date) · `assigned_worker_id` · `is_done` · `completed_at` · `is_ai` (default applies when omitted → row indistinguishable from user-typed; only the sweep sets it) · `rai_suggestion_id` · `cleared_at` (dismiss-vs-delete model; prep's open-task filter depends on it) · `created_by` (seat-conditional, `_stamp`) · `created_at`.
Writers: app composer via `tasksDb.create` (L253–307; recurring templates dual-write today's occurrence at creation); MCP `add_task` (mirrors the non-recurring path; `is_recurring` hard-coded false; long text split to notes); completion via `tasksDb.toggle` (L346–474) and MCP `complete_task` (ratified three-write mirror).
Triggers: **none** (non-internal; census Jul 21).

### `task_occurrences`
`task_id` · `user_id` · `occurrence_date` (user-tz date) · `is_done` · `completed_at` · `assigned_worker_id` · `worker_completed_at` · `was_on_time` · `client_id` · `client_name` · `task_text`. Unique `(task_id, occurrence_date)`.
Writers: `tasksDb.create` (recurring materialize-on-create), `tasksDb.toggle` (dual-write on every toggle), MCP `complete_task` (field-for-field mirror), SQL materializer cron. One-off tasks get their occurrence row at completion, not creation.

### `task_completions` — DOOMED LEG (Phase-4 deletion)
`task_id` · `user_id` · `client_id` · `client_name` · `task_text` · `is_recurring` · `completed_at` · `completed_on` · `assigned_worker_id` · `due_date` · `was_on_time`. Unique `(task_id, completed_on)`.
Do not build anything new against this table.

### `touchpoints`
`id` uuid · `user_id` · `client_id` · `channel` (constraint: call/email/text/meeting/note) · `notes` · `created_by` (seat-conditional) · `occurred_at` (timestamptz).
Writers: app `touchpoints.create` (always-now stamp; `client_name` in its return is UI decoration, never stored); MCP `log_touchpoint` (ratified divergences: backdate-capable `occurred_at` via `occurred_date` — past-only, ≤30 days, noon-UTC stamp; rejects empty notes where the app coalesces to null — stricter, safe direction).
Soft dedupe key (MCP, v3.5): notes + channel + occurred date; 3-minute window for now-logs, full target day for backdated.

### `clients`
Verified in use: `id` · `user_id` · `name` · `contact` · `role` · `revenue` (monthly rate) · `is_active` (resolveClient filters on it) · `retention_score` · `drift_status` · `start_date` · `qualifying_flags` · `notes` · `rate_set_date` (date; verified Jul 22 — read by the sweep's timeline as `days_since_rate_set`) · `rai_mode` (managed/advisory; write surface: ClientModal toggle + App.jsx cap path; advisory = out of Rai's working set across all AI surfaces, history intact). Scores/drift are Rai-internal (see §1 recitation law).
Flags live in `qualifying_flags` jsonb (`latePayments` / `prevTerminated` / `otherVendors`). There is NO `late_pay` column — it never existed; selecting it errors the entire PostgREST query (this exact mistake made rai-prep 100% dead until Jul 15).
`notes` — column exists; no app UI writes it; confirmed all-null in production Jul 20. Three surfaces (sweep, MCP brief, prep) read it conditionally and render only when text exists. Pending owner decision: build the notes box vs strip the readers. Do not "discover" this field.

### `rai_user_state`
Verified via deployed sweep + intake writes (upserts would error on phantom columns): `user_id` (conflict key) · `ranking_enabled` (read; false = sweep skips) · `last_sweep_at` (r/w; the already-swept-today + race-guard key) · `next_sweep_eligible_at` (written, read by nothing — doomed, ledger §B) · `todays_pick_dismissed_at` (cleared at sweep end so the new brief shows) · `ai_tasks_enabled` (read by writeSuggestedTasks; default ON) · `intake_completed_at` (written by rai-intake finalize; see §1 intake-stamp doctrine) · `updated_at`.

### `profiles`
`id` · `timezone` (drives all user-local date computation server-side) · `occurrence_flags` jsonb (`edge_fn_recent_tasks`: absent/true = occurrence path; false = emergency opt-out to the doomed leg).

### `personal_calendar_events`
In use: `user_id` · `client_id` · `starts_at` · `title`. Past linked events ARE contact (doctrine).

### `rai_prep_memos`
`user_id` · `client_id` · `day` (user-local as of Jul 20 — was UTC; cache key rolls at the user's midnight) · `memo` · `created_at`. Unique `(user_id, client_id, day)`. Writer: rai-prep upsert (force=true regenerates the day's row).

## 4. MCP auth tables

### `mcp_tokens` (PAT)
Verified in use: `label` · `token_hash` (sha256; plaintext shown once at mint) · `revoked_at`. One-shot re-mint SQL rotates hash on the `label` row.

### `mcp_oauth_clients`
DCR-registered clients; each connector re-add mints a new `client_id` (7 registrations observed Jul 18).

### `mcp_oauth_codes`
`id` · `code_hash` · `client_id` · `user_id` · `redirect_uri` · `code_challenge` · `code_challenge_method` (S256) · `scope` · `expires_at` (mint+10min) · `used_at` (stamped on exchange; rows never deleted — the table is the complete auth-attempt history).

### `mcp_oauth_tokens`
`id` · `token_hash` · `kind` (access 7d / refresh 90d) · `user_id` · `client_id` · `expires_at` · `revoked_at` · `rotated_from` · `last_used_at` (stamped only on successful resource auth — the court-grade "was a token ever accepted" column).

## 5. Views

### `client_last_contact` — THE contact authority
Read surface: `user_id`, `client_id`, `last_contact_at`, `last_contact_kind`. Union of the three doctrine surfaces. Specialist-owned SQL. Every brief/sweep/chat surface reads this; none re-derives.
`last_contact_kind` values: `event` (calendar) / `call` / `email` / `text` / `meeting` (touchpoint channels) / `task` (completed communicative task).

### `rai_lessons_active`
Per-client active lessons; read by the MCP brief (≤5) and the sweep (user-level + by-client partition).

## 6. MCP server surface (deployed v3.6.0)

Four tools: `get_task_context` (read; brief with Task-id line, RECENT CONTACT restricted to the four communicative channels, WORK NOTES separate), `log_touchpoint` (channel required, no default — "the ad-work incident" ruling; `note` admitted; backdating per §3), `add_task` (non-recurring only), `complete_task` (ratified three-write mirror; refuses `is_ai` and `is_recurring`; idempotent on already-done).
Auth chain: URL-path PAT → Bearer PAT → OAuth Bearer. Offer-once upsell law lives in SERVER_INSTRUCTIONS only (one law, one home). Success scripts are terse-with-style-order (v3.4 pattern).
Mirror ratification: CLOSED Jul 21 (toggle + create ×2, verbatim-with-line-numbers, specialist ledger).

## 7. Known quirks ledger (mirrored on purpose — fix lands in db.js first if ever)

- `was_on_time` grades against the UTC date slice while `completed_on` beside it is user-local (db.js L364–367, re-verified Jul 22): an evening on-time completion can grade late. All writers byte-match the quirk; divergent grading between surfaces is worse.
- App-internal tz split: device clock for `completed_on` vs stored profile tz for `occurrence_date`. Server-side writers use profile tz for BOTH (deliberate divergence, specialist-ratified): a traveling user's diary date can differ from an in-app completion by a day.
- Unknown-column selects fail the whole query silently at the caller (PostgREST) — the `late_pay` incident class. Never write a column list from memory.
- ~~db.js L436 stale comment~~ **CORRECTED** (verified in repo Jul 22): the occurrence dual-write comment now states task_occurrences is the load-bearing record and the write is NOT optional. Closed.
- **Line-anchor drift note (Jul 22):** `touchpoints.create` now sits at ~L2110 (was L2093–2110 — the file grew above it); body byte-matches the §3 description. `tasksDb.create` L253 and the `was_on_time` block L364–367 remain exact. Treat all line refs in this file as approximate after any db.js commit; re-anchor before quoting.

## 8. Cron & background (memory-level; verify before asserting details)

`rai-daily-sweep` via `sweep_queue` + pg_cron fan-out (specialist-owned); occurrence materializer; `observer-weekly` (deploys as BOTH files: index.ts + observer-prompt.md — it reads the prompt from disk); `rolodex-sweep`; google-calendar sync functions; stripe webhook; **`rai-intake`** (Jul 22: JWT ON — the §2 exception; finalize stamps `intake_completed_at` and fires an immediate sweep via SWEEP_FUNCTION_URL/SWEEP_FUNCTION_AUTH — the finalize log shows `stamped=true swept=true`).

## 9. Present but undocumented here (census pending)

`orgs` / seats tables · `rai_picks` · `rai_suggestions` (partial: `title`, `why`, `signal` read by brief) · `rai_lessons` backing table · **`rai_intake_sessions`** (exists, RLS ON — shape NOT asserted; needs the intake source or a census paste) · rolodex tables · referrals · revenue history · stripe/billing tables · google calendar sync state · `sweep_queue` · health checks · observations.
To complete this census in one query: `select table_name, column_name, data_type from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position;` — paste the output into a session and this file gets finished properly.
