import { addDays, todayAnchored } from "./utils";


function nextWeekdayDate(name) {
  const lookup = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  const target = lookup[name.toLowerCase()];
  if (target === undefined) return null;
  const today = todayAnchored();
  const cur = today.getDay();
  let delta = target - cur;
  if (delta <= 0) delta += 7;
  return addDays(today, delta);
}

// Map short weekday tokens ("mon", "tues", "thur", etc.) to canonical full
// names ("monday", "tuesday", "thursday"). Used by the parser's date and
// recurrence rules so users can type either short or long forms.
function expandWeekday(short) {
  const map = {
    mon: "monday",
    tue: "tuesday", tues: "tuesday",
    wed: "wednesday",
    thu: "thursday", thur: "thursday", thurs: "thursday",
    fri: "friday",
    sat: "saturday",
    sun: "sunday",
  };
  return map[short.toLowerCase()] || short;
}

// Day-of-week index for a name. 0=Sunday, 6=Saturday. Accepts full or short
// form (short forms expanded via expandWeekday).
function weekdayIndex(name) {
  const full = expandWeekday(name);
  const lookup = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  return lookup[full.toLowerCase()] ?? 0;
}

function dateToYmd(d) {
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ────────────────────────────────────────────────────────────────────
// RECURRENCE PATTERN HELPERS
//
// A recurring task has a pattern that says when it should appear in the
// today bucket and reset to incomplete. Patterns are stored as JSON in the
// `recurrence_pattern` column. See state declaration above for the shape.
//
// `recurrenceMatchesDate(pattern, date)` answers: should this task appear
// today? `formatRecurrenceLabel(pattern)` returns a short human-readable
// label like "Mon/Wed/Fri" or "1st of month" for display on the task tile.
// ────────────────────────────────────────────────────────────────────

function recurrenceMatchesDate(pattern, date) {
  if (!pattern || !pattern.kind) return true; // legacy daily — always shows
  const dow = date.getDay(); // 0=Sun, 6=Sat
  const dom = date.getDate();
  // Days in the current month — used to clamp monthly patterns so a task
  // targeting a day that doesn't exist this month (the 31st in April, the
  // 5th Monday when there are only 4) still surfaces on the last valid day
  // instead of silently never appearing.
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  switch (pattern.kind) {
    case "daily":
      return true;
    case "weekdays":
      return dow >= 1 && dow <= 5;
    case "weekly":
      return Array.isArray(pattern.days) && pattern.days.includes(dow);
    case "monthly_date": {
      // "Nth of the month." If N exceeds this month's length (e.g. the
      // 31st in a 30-day month), clamp to the last day so the task still
      // fires once a month rather than being skipped entirely.
      const targetDom = Math.min(pattern.day || 1, daysInMonth);
      return dom === targetDom;
    }
    case "monthly_weekday": {
      // "Nth weekday of month" — week is 1..5, day is 0..6.
      if (dow !== pattern.day) return false;
      const occurrence = Math.ceil(dom / 7);
      // Clamp the requested week to the LAST occurrence that actually
      // exists this month. "5th Monday" in a month with only 4 Mondays
      // fires on the 4th instead of being silently skipped.
      const firstDow = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
      const firstOfWeekday = ((pattern.day - firstDow + 7) % 7) + 1; // dom of 1st occurrence
      const occurrencesThisMonth = Math.floor((daysInMonth - firstOfWeekday) / 7) + 1;
      const targetOccurrence = Math.min(pattern.week, occurrencesThisMonth);
      return occurrence === targetOccurrence;
    }
    default:
      return true;
  }
}

function formatRecurrenceLabel(pattern) {
  if (!pattern || !pattern.kind) return "Recurring";
  const dayShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const ordinal = (n) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  const weekOrd = ["", "1st", "2nd", "3rd", "4th", "5th"];
  switch (pattern.kind) {
    case "daily": return "Daily";
    case "weekdays": return "Mon–Fri";
    case "weekly": {
      const days = pattern.days || [];
      if (days.length === 0) return "Weekly";
      if (days.length === 7) return "Daily";
      if (days.length === 5 && [1,2,3,4,5].every(d => days.includes(d))) return "Mon–Fri";
      // Copy before sorting — Array.sort mutates in place, and pattern.days
      // is the live stored pattern object. Also use a numeric comparator:
      // the default sort is lexicographic, which happens to work for single
      // digits 0-6 but is wrong practice and would break if the shape ever
      // changed. Sort a copy, numerically.
      return [...days].sort((a, b) => a - b).map(d => dayShort[d]).join("/");
    }
    case "monthly_date": return `${ordinal(pattern.day || 1)} of month`;
    case "monthly_weekday": return `${weekOrd[pattern.week]} ${dayShort[pattern.day]} of month`;
    default: return "Recurring";
  }
}

// Find the next date (today or later) on which a recurring task occurs.
// A recurring task is "standing work" with a next-due date, exactly like
// a one-off task has a due_date — bucketOf treats them identically once
// it knows this date.
//
// `fromDate` is the day boundary anchor (the app's stored-TZ "today").
// `includeToday`:
//   - true  → if the pattern matches `fromDate` itself, return fromDate.
//             Used for OPEN recurring tasks: a task due today buckets today.
//   - false → start scanning from tomorrow. Used for tasks already
//             COMPLETED today — we don't want a just-finished daily task
//             to immediately re-surface; it stays in today's completed
//             section and the midnight rollover brings it back. (bucketOf never
//             actually needs includeToday=false because completed-today
//             tasks bucket "today" by the t.done path — but the helper
//             supports it for correctness / future use.)
//
// Scans at most 366 days forward, which covers every pattern kind
// (daily, weekdays, weekly, monthly_date, monthly_weekday). Returns a
// Date at noon local (clean for date math) or null if pattern is empty.
function nextOccurrenceDate(pattern, fromDate, includeToday = true) {
  if (!pattern || !pattern.kind) {
    // Legacy/no-pattern recurring task — treat as daily (always today).
    const d = new Date(fromDate);
    d.setHours(12, 0, 0, 0);
    return d;
  }
  const start = new Date(fromDate);
  start.setHours(12, 0, 0, 0);
  const offsetStart = includeToday ? 0 : 1;
  for (let i = offsetStart; i <= 366; i++) {
    const candidate = new Date(start);
    candidate.setDate(candidate.getDate() + i);
    if (recurrenceMatchesDate(pattern, candidate)) {
      return candidate;
    }
  }
  // No match within a year — shouldn't happen for valid patterns. Fall
  // back to fromDate so the task at least stays visible.
  return start;
}

export { nextWeekdayDate, expandWeekday, weekdayIndex, dateToYmd, recurrenceMatchesDate, formatRecurrenceLabel, nextOccurrenceDate };
