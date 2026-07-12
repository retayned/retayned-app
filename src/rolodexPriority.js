// rolodexPriority.js
// Shared scoring + derivation for the Rolodex rhythm model.
// Source of truth for ROLODEX_SPEC.md §3–§5 and §8. Pure functions, no dependencies.
// Style-matched to the shared computeCadence utility: import where needed, never fork the math.

const MS_PER_DAY = 86_400_000;
const clamp01 = (n) => Math.min(1, Math.max(0, n));

export const RHYTHM_OPTIONS = [30, 60, 90, 120];
export const COMING_UP_WINDOW_DAYS = 7;
export const AUTO_FILE_AFTER_DAYS = 14;
export const RAI_DISMISS_COOLDOWN_DAYS = 14;

/** Whole days between two dates (floored). */
export function daysBetween(from, to = new Date()) {
  return Math.floor((new Date(to) - new Date(from)) / MS_PER_DAY);
}

/**
 * Rank-based percentile of `value` within `population` (0..1).
 * Population = the same metric across this user's own Rolodex — never absolute thresholds.
 */
export function percentileRank(value, population) {
  if (!population || population.length === 0) return 0;
  const below = population.reduce((n, v) => n + (v < value ? 1 : 0), 0);
  return below / population.length;
}

/**
 * Value score V in [0,1]. Spec §3.
 * entry: { category, ltv, tenure_days, would_refer, would_come_back,
 *          referrals_sent, heat, referred_in }
 * ctx:   { ltvPopulation: number[], tenurePopulation: number[] }
 */
export function valueScore(entry, ctx = {}) {
  if (entry.category === 'lead') {
    return clamp01(
      0.60 * ((entry.heat ?? 0) / 100) +
      0.20 * (entry.referred_in ? 1 : 0) +
      0.20 * (entry.would_refer ? 1 : 0)
    );
  }
  const ltvPct = percentileRank(entry.ltv ?? 0, ctx.ltvPopulation ?? []);
  const tenurePct = percentileRank(entry.tenure_days ?? 0, ctx.tenurePopulation ?? []);
  return clamp01(
    0.45 * ltvPct +
    0.15 * tenurePct +
    0.20 * (entry.would_refer ? 1 : 0) +
    0.10 * (entry.would_come_back ? 1 : 0) +
    0.10 * Math.min((entry.referrals_sent ?? 0) / 2, 1)
  );
}

/** Overdue pressure P = min(O/R, 1.5). Spec §4. Zero when not overdue. */
export function overduePressure(daysOver, rhythmDays) {
  if (daysOver <= 0 || !rhythmDays) return 0;
  return Math.min(daysOver / rhythmDays, 1.5);
}

/** Priority score S = (0.25 + 0.75·V) × P. Spec §4. */
export function priorityScore(V, P) {
  return (0.25 + 0.75 * V) * P;
}

/** Rhythm suggestion at file-time from V. Spec §5. */
export function suggestRhythm(V) {
  if (V >= 0.75) return 30;
  if (V >= 0.50) return 60;
  if (V >= 0.25) return 90;
  return 120;
}

/**
 * Derive the page section for an entry. Spec §1 + §7.
 * Returns 'closed' | 'just_filed' | 'slipping' | 'coming_up' | 'on_rhythm'.
 * entry additionally: { retro_completed_at, last_touch_at, rhythm_days,
 *                       snoozed_until, closed_at }
 */
export function deriveSection(entry, now = new Date()) {
  if (entry.closed_at) return 'closed';
  if (!entry.retro_completed_at && !entry.filed_by_default) return 'just_filed';

  const D = daysBetween(entry.last_touch_at, now);
  const R = entry.rhythm_days;
  const snoozed = entry.snoozed_until && new Date(entry.snoozed_until) > now;

  if (D > R) return snoozed ? 'on_rhythm' : 'slipping'; // snooze suppresses Slipping only
  if (D >= R - COMING_UP_WINDOW_DAYS) return 'coming_up';
  return 'on_rhythm';
}

/**
 * Full computed view for one entry: { section, D, O, V, P, S, dueInDays }.
 */
export function computeEntry(entry, ctx = {}, now = new Date()) {
  const D = daysBetween(entry.last_touch_at, now);
  const R = entry.rhythm_days;
  const O = Math.max(0, D - R);
  const V = valueScore(entry, ctx);
  const P = overduePressure(O, R);
  return {
    section: deriveSection(entry, now),
    D, O, V, P,
    S: priorityScore(V, P),
    dueInDays: R - D, // negative = overdue
  };
}

/**
 * Sort Slipping entries: S desc, then V desc, then D desc. Spec §4.
 * Accepts raw entries; returns [{ entry, ...computed }] sorted.
 */
export function sortSlipping(entries, ctx = {}, now = new Date()) {
  return entries
    .map((entry) => ({ entry, ...computeEntry(entry, ctx, now) }))
    .filter((c) => c.section === 'slipping')
    .sort((a, b) => (b.S - a.S) || (b.V - a.V) || (b.D - a.D));
}

/** Coming up: days-to-due ascending. */
export function sortComingUp(entries, ctx = {}, now = new Date()) {
  return entries
    .map((entry) => ({ entry, ...computeEntry(entry, ctx, now) }))
    .filter((c) => c.section === 'coming_up')
    .sort((a, b) => a.dueInDays - b.dueInDays);
}

/** On rhythm: next-due ascending. Includes snoozed (render with snoozed sub-label). */
export function sortOnRhythm(entries, ctx = {}, now = new Date()) {
  return entries
    .map((entry) => ({ entry, ...computeEntry(entry, ctx, now) }))
    .filter((c) => c.section === 'on_rhythm')
    .sort((a, b) => a.dueInDays - b.dueInDays);
}

/**
 * Rhythm bar geometry. Spec §8.
 * Track = 100%. Rhythm span = 70% (due tick fixed at 70%).
 * Overflow zone = 30%, representing up to R/2 days over.
 * Returns percentages: { fillPct, overflowPct, dotPct, duePct }.
 */
export function rhythmBarGeometry(daysSince, rhythmDays) {
  const fillPct = Math.min(daysSince / rhythmDays, 1) * 70;
  const over = Math.max(0, daysSince - rhythmDays);
  const overflowPct = over > 0 ? Math.min(over / (rhythmDays / 2), 1) * 30 : 0;
  return {
    fillPct,
    overflowPct,
    dotPct: Math.min(fillPct + overflowPct, 99),
    duePct: 70,
  };
}

/**
 * Contacts eligible for Rai's read: top `limit` slipping by S,
 * excluding dismissals within the cooldown. Spec §6–§7.
 * dismissals: Map<entryId, dismissedAtDate> (or plain object).
 */
export function raiReadCandidates(entries, ctx = {}, dismissals = new Map(), now = new Date(), limit = 3) {
  const wasRecentlyDismissed = (id) => {
    const at = dismissals instanceof Map ? dismissals.get(id) : dismissals?.[id];
    return at && daysBetween(at, now) < RAI_DISMISS_COOLDOWN_DAYS;
  };
  return sortSlipping(entries, ctx, now)
    .filter((c) => !wasRecentlyDismissed(c.entry.id))
    .slice(0, limit);
}
