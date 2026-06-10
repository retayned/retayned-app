import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { parseCalendarEntry } from "../parser";
import { formatHourLabel, formatTimeRangeLabel } from "../timeFormat";



//   compact     — bool. Currently unused. The previous behavior (cap to
//                 6 visible hours on mobile) was removed when the timeline
//                 unified to a fixed 17-hour range and 8-hour viewport on
//                 every surface. Prop retained for forward compatibility
//                 in case future surface variants need a denser treatment.
//   showHeader  — bool. The mobile band dropdown and trigger dropdown
//                 supply their own header; right-rail widget renders its own.
//
// Note: this component reads `C` from a closure-free import-only style —
// since `C` is declared inside the App function, we pass it via props.
function TodayTimeline({ events = [], onCreate, onDelete, onUpdate, compact = false, showHeader = true, C, googleConnected = false, onConnectClick = null, promptDismissed = false, onDismissConnectPrompt = null, clients = [] }) {
  const [composerText, setComposerText] = useState("");
  const [composerError, setComposerError] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const inputRef = useRef(null);
  // Which day the timeline is viewing. Toggle in the header switches
  // between today and tomorrow. Calendar is forward-looking only — no
  // yesterday view (nobody plans their yesterday) and no week view
  // (that's not what Retayned is for; mental model is today is sacred,
  // tomorrow is preparation, everything else is later).
  const [selectedDay, setSelectedDay] = useState("today");

  // ─── Drag-to-move / resize state ───────────────────────────────────────
  // Google-Calendar-style direct manipulation. While the user drags an
  // event body, the event shifts as a whole (start + end both move). While
  // they drag the bottom resize handle, only end moves. On release, we
  // commit via onUpdate; until then everything is optimistic / visual.
  //
  // Google-sourced events are read-only here — their source of truth is
  // Google itself, so dragging would just lie. We block initiation when
  // source !== "manual".
  //
  // Snap interval: 15 minutes (matches Google).
  const [dragState, setDragState] = useState(null);
  // dragState shape when active:
  //   { eventId, mode: "move"|"resize",
  //     pointerStartY, originalStartMs, originalEndMs,
  //     currentStartMs, currentEndMs }

  // Tick every 60s so the NOW marker stays in sync. Doesn't re-render on
  // composer keystrokes — only the tick.
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const SLOT_HEIGHT = 64; // pixels per hour row (was 44 — bumped to make
                          // 30-min drag targets comfortable: 32px tall)
  const SNAP_MINUTES = 15;
  const PX_PER_MINUTE = SLOT_HEIGHT / 60;

  // Responsive visible-hour count. Calendar shrinks vertically on smaller
  // surfaces so it doesn't dominate the page. Mobile (≤768px) shows 4h,
  // laptop (≤1440px) shows 6h, wide desktop shows 8h. The user scrolls
  // through the rest of the 17-hour day inside the viewport.
  const [visibleHours, setVisibleHours] = useState(() => {
    if (typeof window === "undefined") return 8;
    const w = window.innerWidth;
    if (w <= 768) return 4;
    if (w <= 1440) return 6;
    return 8;
  });
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onResize = () => {
      const w = window.innerWidth;
      if (w <= 768) setVisibleHours(4);
      else if (w <= 1440) setVisibleHours(6);
      else setVisibleHours(8);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ─── Global pointer listeners during drag ──────────────────────────────
  // We attach to window (not the event block) so the drag continues even
  // when the cursor leaves the timeline element. Released on pointerup;
  // commits via onUpdate then clears state.
  useEffect(() => {
    if (!dragState) return;

    const handleMove = (e) => {
      const deltaY = e.clientY - dragState.pointerStartY;
      const deltaMinutes = deltaY / PX_PER_MINUTE;
      // Snap to nearest 15-min increment.
      const snappedDelta = Math.round(deltaMinutes / SNAP_MINUTES) * SNAP_MINUTES;
      const snappedDeltaMs = snappedDelta * 60 * 1000;

      let newStartMs = dragState.originalStartMs;
      let newEndMs = dragState.originalEndMs;
      if (dragState.mode === "move") {
        // Both start and end shift by the same delta — event length preserved.
        newStartMs = dragState.originalStartMs + snappedDeltaMs;
        newEndMs = dragState.originalEndMs + snappedDeltaMs;
      } else {
        // Resize: only end moves. Floor at start + 15 min so the event
        // can't collapse to zero length or invert.
        newEndMs = Math.max(
          dragState.originalStartMs + SNAP_MINUTES * 60 * 1000,
          dragState.originalEndMs + snappedDeltaMs,
        );
      }
      setDragState(prev => prev ? { ...prev, currentStartMs: newStartMs, currentEndMs: newEndMs } : null);
    };

    const handleUp = () => {
      const ds = dragState;
      // No actual movement? Just clear state, treat as a click.
      const moved = ds.currentStartMs !== ds.originalStartMs || ds.currentEndMs !== ds.originalEndMs;
      setDragState(null);
      if (moved && onUpdate) {
        onUpdate(ds.eventId, {
          starts_at: new Date(ds.currentStartMs).toISOString(),
          ends_at: new Date(ds.currentEndMs).toISOString(),
        });
      }
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [dragState, onUpdate, PX_PER_MINUTE]);

  // Start a drag. Caller specifies mode ("move" or "resize"). Initiation
  // is blocked for google-sourced events (they're read-only here).
  const startDrag = (evt, mode, pointerY) => {
    if (evt.source !== "manual") return;
    if (!onUpdate) return;
    const startMs = new Date(evt.starts_at).getTime();
    // If no end, treat as 30-min event for math purposes (matches existing
    // fallback used by the state coloring code).
    const endMs = evt.ends_at ? new Date(evt.ends_at).getTime() : (startMs + 30 * 60 * 1000);
    setDragState({
      eventId: evt.id,
      mode,
      pointerStartY: pointerY,
      originalStartMs: startMs,
      originalEndMs: endMs,
      currentStartMs: startMs,
      currentEndMs: endMs,
    });
  };

  const now = new Date(nowTick);
  const nowFractional = now.getHours() + now.getMinutes() / 60;

  // Filter events to the selected day (today or tomorrow). anchorDate
  // is a date object pointing at the user's chosen day at midnight local;
  // we compare the local YMD between each event's start and the anchor.
  // Same `now` used elsewhere for the NOW marker — that always reflects
  // ACTUAL now, regardless of which day the user is viewing.
  const anchorDate = new Date(now);
  if (selectedDay === "tomorrow") {
    anchorDate.setDate(anchorDate.getDate() + 1);
  }
  anchorDate.setHours(0, 0, 0, 0);
  const anchorYmd = `${anchorDate.getFullYear()}-${String(anchorDate.getMonth() + 1).padStart(2, "0")}-${String(anchorDate.getDate()).padStart(2, "0")}`;

  const todayEvents = events
    .map(e => ({
      ...e,
      _start: new Date(e.starts_at),
      _end: e.ends_at ? new Date(e.ends_at) : null,
    }))
    .filter(e => {
      const d = e._start;
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return ymd === anchorYmd;
    })
    .sort((a, b) => a._start - b._start);

  // Fixed full-day window: 6am to 11pm. Same range on every surface
  // (mobile band, desktop trigger dropdown, desktop right-rail). The
  // timeline always renders all 17 hours; the viewport is fixed at
  // 8 hours and the user scrolls to see the rest. Events outside this
  // window (rare — pre-dawn or late-night) get clamped to the edges.
  const earliestHour = 6;
  const latestHour = 24; // ambient field runs the full day to midnight (11:59pm)
  const totalHours = latestHour - earliestHour;

  // Position helpers
  const yForHour = (h) => (h - earliestHour) * SLOT_HEIGHT;
  const yForDate = (d) => {
    const h = d.getHours() + d.getMinutes() / 60;
    return yForHour(h);
  };

  // Compose
  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    // Parser anchor: when viewing Tomorrow, "2pm" should mean tomorrow at
    // 2pm, not today. The parser already understands "tomorrow", but bare
    // times default to today unless we swap the anchor. parseAnchor uses
    // tomorrow's date when the view is Tomorrow, with hh:mm matching now.
    const parseAnchor = new Date(now);
    if (selectedDay === "tomorrow") parseAnchor.setDate(parseAnchor.getDate() + 1);
    const parsed = parseCalendarEntry(composerText, parseAnchor, clients);
    if (!parsed) {
      setComposerError("Add a time (e.g. 2pm, 9:30am, noon)");
      return;
    }
    setComposerError(null);
    setComposerText("");
    onCreate && onCreate(parsed);
  };

  const handleKey = (e) => {
    if (e.key === "Enter") handleSubmit(e);
    if (composerError) setComposerError(null);
  };

  // Hour labels — render at integer hours in the window. Capped at 23 so we
  // never print a "24:00" label even though the field spans to midnight.
  const hourLabels = [];
  for (let h = earliestHour; h <= latestHour - 1; h++) {
    hourLabels.push(h);
  }

  const timelineHeight = totalHours * SLOT_HEIGHT;
  // Responsive viewport — see `visibleHours` declared above. Calendar
  // shows 4 hours on mobile, 6 on laptop, 8 on wide desktop. User scrolls
  // inside that viewport to reach the rest of the 17-hour day.
  const visibleHeight = visibleHours * SLOT_HEIGHT;

  // Auto-scroll the visible window to center NOW on mount / when hour
  // range or now-tick changes. Runs on every surface — desktop and
  // mobile alike scroll inside the same fixed 8-hour viewport.
  const scrollRef = useRef(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nowY = yForDate(now);
    const targetScroll = Math.max(0, nowY - visibleHeight / 2);
    el.scrollTop = targetScroll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [earliestHour, latestHour, visibleHeight]);

  // Empty state — no events at all
  const isEmpty = todayEvents.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Optional header */}
      {showHeader && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 0 8px" }}>
          <Icon name="due" size={20} color={C.primaryMuted} accent={C.primaryMutedDeep} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 0.3, textTransform: "uppercase", fontWeight: 700 }}>
              {selectedDay === "today" ? "Today" : "Tomorrow"}
            </div>
            <div style={{ fontSize: 12, color: C.textSec, marginTop: 1, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span>{isEmpty ? "Nothing scheduled" : `${todayEvents.length} ${todayEvents.length === 1 ? "thing" : "things"} scheduled`}</span>
              {googleConnected && <span style={{ color: C.primary }}>· Google connected</span>}
            </div>
          </div>
          {/* Segmented Today / Tomorrow toggle. Two-state only — no week
              view (out of scope for Retayned's mental model), no
              yesterday view (calendar is forward-looking).
              SHAPE STANDARD: this toggle lives inside a contained widget
              surface, so it uses the square/rectangular table-style shape
              (matching the Table/Columns/Heatmap toggle on the Clients
              page) — NOT the circular pill used for freely-exposed
              toggles. Rule: inside tables/contained surfaces = square;
              freely exposed = circular. */}
          <div style={{ display: "inline-flex", gap: 2, padding: 3, background: C.surface, borderRadius: 999, flexShrink: 0, boxShadow: "var(--rt-sh-xs)" }}>
            <button
              type="button"
              className={"rt-day-opt" + (selectedDay === "today" ? " is-active" : "")}
              onClick={() => setSelectedDay("today")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "5px 12px",
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 12,
                fontWeight: 600,
                ...(selectedDay === "today"
                  ? { background: C.card, color: C.text, boxShadow: "var(--rt-sh-xs)" }
                  : {}),
              }}
            >Today</button>
            <button
              type="button"
              className={"rt-day-opt" + (selectedDay === "tomorrow" ? " is-active" : "")}
              onClick={() => setSelectedDay("tomorrow")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "5px 12px",
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 12,
                fontWeight: 600,
                ...(selectedDay === "tomorrow"
                  ? { background: C.card, color: C.text, boxShadow: "var(--rt-sh-xs)" }
                  : {}),
              }}
            >Tomorrow</button>
          </div>
        </div>
      )}

      {/* Timeline body — fixed 8-hour viewport, scrollable across the full
          17-hour day on every surface. */}
      <div
        ref={scrollRef}
        className="rt-timeline-scroll"
        style={{
          position: "relative",
          height: visibleHeight,
          overflowY: "auto",
          paddingRight: 2,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
        }}
      >
        {/* V1 ambient day field — a warm cream gradient spanning the FULL
            day (6am at top → midnight at bottom), scrolling with the
            timeline so the day reads as warmth shifting: cool ghost-green
            dawn → neutral cream midday → deep-cream dusk. Stays entirely in
            the Retayned palette (no foreign daylight hues). Positioned over
            the entire timelineHeight, behind the events. */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: timelineHeight,
            pointerEvents: "none",
            zIndex: 0,
            borderRadius: 16,
            background: "linear-gradient(180deg, rgba(124,92,243,0.10) 0%, rgba(150,170,235,0.08) 12%, rgba(190,205,200,0.06) 30%, rgba(122,170,140,0.07) 46%, rgba(150,185,150,0.06) 58%, rgba(216,180,120,0.09) 72%, rgba(200,140,90,0.10) 84%, rgba(90,80,110,0.12) 94%, rgba(40,45,70,0.14) 100%), #FAFAF7",
          }}
        />
        <div style={{ position: "relative", height: timelineHeight, minHeight: timelineHeight, zIndex: 1 }}>
          {/* Faint hour ticks — labels only, no grid lines (the ambient
              field carries time-of-day; lines would reintroduce the boxy
              grid we're removing). */}
          {hourLabels.map(h => (
            <div
              key={h}
              style={{
                position: "absolute",
                top: yForHour(h) - 6,
                left: 0,
                fontSize: 9.5,
                color: "rgba(30,38,31,0.28)",
                fontVariantNumeric: "tabular-nums",
                fontWeight: 600,
                letterSpacing: 0.2,
              }}
            >
              {formatHourLabel(h)}
            </div>
          ))}

          {/* Events.
              Visual state is determined by time relationship to now, not by
              source (manual vs google). One stripe in the column at a time:
              the live event, in btn purple, matching the NOW marker line.

              past:     transparent fill, no stripe, muted text, thin bottom rule
              now:      deepCream fill, 3px btn-purple left stripe, full-strength
                        text, inset shadow (variant 4d "active" pattern)
              upcoming: bg fill, 1px borderLight outline, no stripe, textSec
                        title / textMuted time

              Recurring or no-end events use a 30-min default block for state math. */}
          {todayEvents.map(evt => {
            // During an active drag, show the projected position instead of
            // the stored one. Smooth visual feedback; commit happens on release.
            const isDraggingThis = dragState && dragState.eventId === evt.id;
            const effectiveStart = isDraggingThis ? new Date(dragState.currentStartMs) : evt._start;
            const effectiveEnd = isDraggingThis
              ? new Date(dragState.currentEndMs)
              : (evt._end || new Date(evt._start.getTime() + 30 * 60 * 1000));
            const top = yForDate(effectiveStart);
            const endY = yForDate(effectiveEnd);
            const height = Math.max(20, endY - top - 2);
            const isManual = evt.source === "manual";
            const isHovered = hoveredId === evt.id;
            const draggable = isManual && !!onUpdate;

            // Time-based state. Uses ORIGINAL times for the past/now/upcoming
            // classification (we don't want a dragged event to flicker "past"
            // while the user moves it earlier in the day mid-drag).
            const startMs = evt._start.getTime();
            const endMs = evt._end ? evt._end.getTime() : (startMs + 30 * 60 * 1000);
            const nowMs = nowTick;
            let state;
            if (endMs <= nowMs) state = "past";
            else if (startMs <= nowMs && nowMs < endMs) state = "now";
            else state = "upcoming";

            // Style by state — V1 ambient: white cards with the alpha-ink
            // hairline (matches every other card in the app), floating on the
            // warm field. "now" gets a green ring + lift (it's happening);
            // "upcoming" is a clean white card; "past" fades back.
            let containerStyle;
            let titleColor = C.text;
            let timeColor = C.textMuted;
            let titleWeight = 500;
            if (state === "past") {
              containerStyle = {
                background: "rgba(255,255,255,0.55)",
                borderRadius: 10,
                paddingLeft: 11,
                boxShadow: "0 0 0 1px rgba(20,30,22,0.06)",
              };
              titleColor = C.textMuted;
              timeColor = C.textMuted;
              titleWeight = 400;
            } else if (state === "now") {
              // The currently-happening event — white card ringed in green
              // with a soft green lift so it reads as live/active.
              containerStyle = {
                background: C.card,
                borderRadius: 10,
                paddingLeft: 11,
                boxShadow: "0 0 0 1px rgba(85,139,104,0.40), 0 3px 10px rgba(85,139,104,0.14), 0 8px 22px rgba(20,30,22,0.05)",
              };
              titleColor = C.text;
              timeColor = C.textSec;
              titleWeight = 600;
            } else { // upcoming
              // Clean white card with the standard alpha-ink hairline + soft
              // depth — a quiet card floating on the ambient field.
              containerStyle = {
                background: C.card,
                borderRadius: 10,
                paddingLeft: 11,
                boxShadow: "0 0 0 1px rgba(20,30,22,0.10), 0 2px 0 -1px rgba(20,30,22,0.04), 0 4px 12px rgba(20,30,22,0.05)",
              };
              titleColor = C.text;
              timeColor = C.textMuted;
              titleWeight = 600;
            }

            // While dragging this event, add a soft shadow + slightly elevated
            // styling so it visually pops above other blocks.
            if (isDraggingThis) {
              containerStyle = {
                ...containerStyle,
                boxShadow: "0 6px 18px rgba(124,92,243,0.22), 0 2px 6px rgba(0,0,0,0.10)",
                zIndex: 5,
              };
            }

            return (
              <div
                key={evt.id}
                onMouseEnter={() => setHoveredId(evt.id)}
                onMouseLeave={() => setHoveredId(null)}
                onPointerDown={(e) => {
                  if (!draggable) return;
                  // Skip if user grabbed the delete button or the resize handle.
                  // The bottom-edge handle has its own onPointerDown that calls
                  // stopPropagation, so this code path only runs for body drags.
                  if (e.target.closest("[data-drag-skip]")) return;
                  e.preventDefault();
                  startDrag(evt, "move", e.clientY);
                }}
                style={{
                  position: "absolute",
                  top,
                  left: 42,
                  right: 4,
                  height,
                  padding: "4px 8px",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  overflow: "hidden",
                  fontSize: 12,
                  color: titleColor,
                  cursor: !isManual ? "not-allowed" : (draggable ? (isDraggingThis ? "grabbing" : "grab") : "default"),
                  userSelect: "none",
                  touchAction: draggable ? "none" : "auto",
                  ...containerStyle,
                }}
                title={!isManual ? "Google event — managed in Google Calendar" : evt.title}
              >
                <span style={{
                  flex: 1, minWidth: 0,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  fontWeight: titleWeight,
                }}>
                  {evt.title}<span style={{ color: timeColor, fontWeight: 400 }}>, {formatTimeRangeLabel(effectiveStart, effectiveEnd)}</span>
                </span>
                {isManual && isHovered && onDelete && !isDraggingThis && (
                  <button
                    data-drag-skip
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => onDelete(evt.id)}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: C.textMuted,
                      fontSize: 12,
                      padding: 0,
                      width: 16,
                      height: 16,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      lineHeight: 1,
                    }}
                    title="Delete"
                  >
                    ×
                  </button>
                )}
                {/* Resize handle — bottom edge. Only visible/active for manual
                    events with onUpdate wired. Captures the pointer event
                    before the body's onPointerDown sees it. */}
                {draggable && (
                  <div
                    data-drag-skip
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      startDrag(evt, "resize", e.clientY);
                    }}
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: 6,
                      cursor: "ns-resize",
                      // Subtle visual hint on hover.,
                      background: (isHovered || isDraggingThis) ? `linear-gradient(180deg, transparent 0%, ${C.borderLight} 100%)` : "transparent",
                      borderBottomLeftRadius: containerStyle.borderRadius || 0,
                      borderBottomRightRadius: containerStyle.borderRadius || 0,
                    }}
                    title="Drag to resize"
                  />
                )}
              </div>
            );
          })}

          {/* NOW marker — only renders on TODAY view. When the user is
              looking at Tomorrow, the current time doesn't belong on that
              timeline (it's not "now" relative to tomorrow's hours). */}
          {selectedDay === "today" && nowFractional >= earliestHour && nowFractional <= latestHour && (
            <div style={{
              position: "absolute",
              top: yForDate(now),
              left: 0,
              right: 0,
              height: 0,
              zIndex: 3,
              pointerEvents: "none",
            }}>
              <div style={{
                position: "absolute",
                left: 0,
                top: -6,
                fontSize: 8.5,
                fontWeight: 700,
                color: C.btn,
                letterSpacing: 0.1,
                background: "rgba(250,250,247,0.85)",
                padding: "0 4px",
                borderRadius: 3,
                zIndex: 2,
              }}>NOW</div>
              {/* Pulsing dot anchored to the start of the line */}
              <div className="rt-now-pulse" style={{
                position: "absolute",
                left: 26,
                top: -4,
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: C.btn,
                boxShadow: "0 0 0 4px rgba(124,92,243,0.16)",
                zIndex: 3,
              }} />
              {/* Line itself — gradient that fades to transparent on the right */}
              <div style={{
                position: "absolute",
                left: 36,
                right: 0,
                top: 0,
                height: 1.5,
                background: "linear-gradient(90deg, #7c5cf3 0%, rgba(124,92,243,0.50) 35%, rgba(124,92,243,0) 100%)",
              }} />
            </div>
          )}

          {/* Empty state message */}
          {isEmpty && (
            <div style={{
              position: "absolute",
              top: visibleHeight / 2 - 18,
              left: 0,
              right: 0,
              textAlign: "center",
              fontFamily: "'Fraunces', Georgia, serif",
              fontStyle: "italic",
              fontWeight: 500,
              fontVariationSettings: "'opsz' 96, 'SOFT' 50, 'WONK' 0",
              fontSize: 13,
              color: C.textMuted,
              pointerEvents: "none",
            }}>
              No events yet — add one below.
            </div>
          )}
        </div>
      </div>

      {/* Connect Google Calendar — quiet utility row below the timeline.
          No panel surface, no background, no rounded card — it's an
          offer, not a feature. Small icon + bold purple link + dot
          separator + Not now. Disappears when connected OR dismissed.
          Settings → Integrations always keeps an explicit Google row,
          so dismissing here is non-permanent. Only renders when an
          onConnectClick handler is wired. */}
      {!googleConnected && !promptDismissed && onConnectClick && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 4px 4px",
          fontSize: 11.5,
        }}>
          <Icon name="calendar" size={11} color={C.textMuted} />
          <button
            type="button"
            className="rt-purple-link"
            onClick={onConnectClick}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              paddingBottom: 1,
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 11.5,
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            Connect Google Calendar
          </button>
          {onDismissConnectPrompt && (
            <>
              <span className="rt-sep" />
              <button
                type="button"
                className="rt-quiet-link"
                onClick={onDismissConnectPrompt}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 11.5,
                  fontWeight: 500,
                  color: C.textMuted,
                  whiteSpace: "nowrap",
                }}
              >
                Not now
              </button>
            </>
          )}
        </div>
      )}

      {/* Composer — frosted flush bar at the foot of the ambient field.
          HIDDEN: calendar entry now happens only via the task composer / +
          button, not a separate input on the calendar. Gated behind false
          (no deletion) so it can be restored by flipping the flag. */}
      {false && (
      <div
        className="rt-cal-composer"
        onClick={() => inputRef.current && inputRef.current.focus()}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "12px 14px",
          marginTop: 0,
          background: "rgba(255,255,255,0.55)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderTop: "1px solid rgba(20,30,22,0.05)",
          borderBottomLeftRadius: 16,
          borderBottomRightRadius: 16,
          cursor: "text",
          pointerEvents: "auto",
          position: "relative",
          zIndex: 5,
        }}
      >
        <span style={{ width: 22, height: 22, borderRadius: 11, background: "#EDE7FB", color: C.btn, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 600, lineHeight: 1, flexShrink: 0, pointerEvents: "none" }}>+</span>
        <input
          ref={inputRef}
          type="text"
          value={composerText}
          onChange={e => setComposerText(e.target.value)}
          onKeyDown={handleKey}
          onClick={e => e.stopPropagation()}
          autoComplete="off"
          spellCheck={false}
          placeholder={selectedDay === "tomorrow" ? "2pm Sarah · noon lunch · adds to tomorrow" : "2pm Sarah · noon lunch · 9-10am sync"}
          style={{
            flex: 1,
            border: "none",
            background: "transparent",
            fontFamily: "inherit",
            fontSize: 12.5,
            color: C.text,
            outline: "none",
            padding: "2px 0",
            minWidth: 0,
            pointerEvents: "auto",
          }}
        />
      </div>
      )}
      {false && composerError && (
        <div style={{ fontSize: 10.5, color: C.danger, marginTop: 4, paddingLeft: 14 }}>{composerError}</div>
      )}
    </div>
  );
}

export { TodayTimeline };
