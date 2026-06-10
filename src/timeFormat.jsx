
// ─── Format helpers for the timeline UI ──────────────────────────────
// "9am", "9:30am", "12pm" — used inline after the event title (Google Cal
// pattern). Lowercase meridiem for less visual weight.
function formatTimeLabel(date) {
  let h = date.getHours();
  const m = date.getMinutes();
  const meridiem = h >= 12 ? "pm" : "am";
  h = h % 12; if (h === 0) h = 12;
  return m === 0 ? `${h}${meridiem}` : `${h}:${String(m).padStart(2, "0")}${meridiem}`;
}
// Combined start[-end] label. If end is null → just start. If both share
// the same meridiem (e.g. 3pm-4pm) we don't repeat the meridiem on the
// start ("3-4pm" rather than "3pm-4pm").
function formatTimeRangeLabel(start, end) {
  if (!end) return formatTimeLabel(start);
  const sH = start.getHours(), eH = end.getHours();
  const sameMeridiem = (sH < 12) === (eH < 12);
  if (sameMeridiem) {
    // Strip meridiem off the start label
    const startNoMeridiem = formatTimeLabel(start).replace(/am|pm$/i, "");
    return `${startNoMeridiem}–${formatTimeLabel(end)}`;
  }
  return `${formatTimeLabel(start)}–${formatTimeLabel(end)}`;
}
function formatHourLabel(hour24) {
  const meridiem = hour24 >= 12 ? "pm" : "am";
  let h = hour24 % 12; if (h === 0) h = 12;
  return `${h}${meridiem}`;
}

export { formatTimeLabel, formatTimeRangeLabel, formatHourLabel };
