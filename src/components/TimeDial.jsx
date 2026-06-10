import { useEffect, useRef, useState } from "react";
import { formatTimeLabel } from "../timeFormat";


// ─── TodayTimeline — visual timeline widget ─────────────────────────────
// Renders today as a top-to-bottom timeline. Each event is a colored block
// anchored at a vertical position proportional to its time. A purple "NOW"
// line marks the current moment.
//
// Window math:
//   - earliestHour = min(min(event_hours), now_hour - 1), clamped to 6
//   - latestHour   = max(max(event_hours), now_hour + 6), clamped to 23
//   - Mobile: cap visible hours at 6, scroll inside the widget
//   - Hour rows are SLOT_HEIGHT px tall, blocks position relative to that
//
// ─── TimeDial ───────────────────────────────────────────────────────────
// Desktop calendar reimagined as a half-circle "time dial" anchored to the
// right edge of the screen. The flat side is the screen edge; the curved bulge
// faces left into the page. A rolling 12-hour window is centered on NOW (6h
// before / 6h after), so NOW always sits at the arc's left-most midpoint. The
// disc carries a time-of-day gradient (dawn→day→dusk→night) mapped top→bottom.
// Events render as small cards INSIDE the disc body at their time-angle, with a
// rim dot + stem; cards stagger inward when clustered. The central hub (against
// the right edge) shows the NEXT event — same logic as the mobile header, new
// UI. Events outside the ±6h window are pocketed as "earlier/later" counts.
//   events — [{ id, title, starts_at, ends_at?, source }]
//   onSelectEvent — optional (event) => void
function TimeDial({ events = [], C, onDeleteEvent = null, onOpenClient = null, onRescheduleEvent = null, onTogglePrepTask = null, scrubMs = 0, setScrubMs = () => {}, dayView = "today", setDayView = () => {}, onRequestLink = null }) {
  const [, force] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  // Reschedule editor state — when the user clicks Reschedule inside the
  // selected-event card, we swap the prep section for two inline inputs
  // (date + time) and Save/Cancel actions. Stored locally so dismissing
  // the selection cleanly closes the editor.
  const [rescheduleEditing, setRescheduleEditing] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  // Scrub offset (ms) — how far the dial has been "turned" from live NOW.
  // Positive = into the future, negative = into the past. Drag the disc to
  // change it; the Now pill resets it to 0.
  const svgWrapRef = useRef(null);
  // Re-render each minute so NOW (and the window) advance.
  useEffect(() => {
    const t = setInterval(() => force(n => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  // Re-render when the tab becomes visible (laptop wakes, user tabs back in,
  // window refocuses). setInterval is throttled or paused while the tab is
  // hidden / the machine sleeps, so on resume the captured render values
  // (nowMs, day bounds) can be hours stale. A visibility-driven render
  // refresh repairs the dial immediately on wake instead of waiting for the
  // next setInterval tick (which may itself be late). Also catches the
  // wall-clock-jump case where the OS sleeps without firing visibilitychange
  // by detecting that Date.now() jumped more than expected since last tick.
  useEffect(() => {
    let lastTick = Date.now();
    const refresh = () => { lastTick = Date.now(); force(n => n + 1); };
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    const onFocus = () => refresh();
    // Poll for wall-clock jumps as a backstop. Every 5s, if more than 90s
    // has passed since the last tick, the machine was likely asleep — force
    // a refresh. (Normal cadence is 5s ± a few ms; 90s is the threshold for
    // "something paused us.")
    const jumpCheck = setInterval(() => {
      const drift = Date.now() - lastTick;
      if (drift > 90_000) refresh();
      else lastTick = Date.now();
    }, 5000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      clearInterval(jumpCheck);
    };
  }, []);

  const now = new Date();
  const nowMs = now.getTime();
  const HALF_WINDOW_MS = 6 * 60 * 60 * 1000; // ±6h → 12h total
  // Day bounds — the window can be scrubbed freely but is trapped inside TODAY:
  // it can never cross midnight at either end, so the user can't drift into
  // tomorrow or yesterday and lose track of which day they're in.
  const dayStartMs = new Date(now).setHours(0, 0, 0, 0);
  const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000 - 1; // 23:59:59.999
  // Center = live now + scrub, clamped so [center−6h, center+6h] stays within the day.
  const centerMin = dayStartMs + HALF_WINDOW_MS;
  const centerMax = dayEndMs - HALF_WINDOW_MS;
  const centerMs = Math.max(centerMin, Math.min(centerMax, nowMs + scrubMs));
  const windowStart = centerMs - HALF_WINDOW_MS;
  const windowEnd = centerMs + HALF_WINDOW_MS;
  const isScrubbed = Math.abs(centerMs - nowMs) > 60000;

  // Normalize + split events into in-window vs earlier/later.
  const all = events
    .map(e => ({ ...e, _start: new Date(e.starts_at), _end: e.ends_at ? new Date(e.ends_at) : null }))
    .sort((a, b) => a._start - b._start);
  const inWindow = [];
  let earlierCount = 0, laterCount = 0;
  for (const e of all) {
    const ms = e._start.getTime();
    if (ms < windowStart) earlierCount++;
    else if (ms > windowEnd) laterCount++;
    else inWindow.push(e);
  }
  // Next upcoming event (anywhere today), for the hub.
  const nextEvent = all.find(e => e._start.getTime() >= nowMs) || null;
  const selectedEvent = selectedId ? all.find(e => e.id === selectedId) : null;
  const hubEvent = selectedEvent || nextEvent;

  // ── Geometry. The dial renders at fixed viewBox pixels. The disc center sits
  // on the RIGHT edge (x = CX), radius R, with DIAL_PAD breathing room so
  // arc-edge dots aren't clipped. The left half-circle is drawn. Time fraction
  // f∈[0,1] (0 = window start / top, 0.5 = now / left-most, 1 = window end /
  // bottom) maps to angle 90°→270°. ──
  const R = 420;
  const DIAL_PAD = 24; // breathing room so arc-edge dots (NOW dot, edge events,
                       // top/bottom ticks) aren't clipped at the viewBox edges
  const VB_W = R + DIAL_PAD, VB_H = 2 * R + 2 * DIAL_PAD, CX = VB_W, CY = VB_H / 2;
  const HUB_R = 140;
  const fracOf = (ms) => (ms - windowStart) / (windowEnd - windowStart); // 0..1
  const angleOf = (f) => (90 + f * 180) * Math.PI / 180; // radians
  const ptAt = (f, r) => {
    const a = angleOf(f);
    return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
  };

  // ── Time-accurate sky color. Maps an hour-of-day (0–24, fractional) to a
  // sky tint matching the mobile header: indigo night → lilac/peach dawn →
  // cool daylight → amber dusk → indigo night. Returns an rgba string at low
  // opacity so it whispers against the cream. The dial's vertical axis IS
  // clock time (top = window start, bottom = window end), so sampling the hour
  // at each gradient position makes the disc genuinely reflect the real time:
  // dark in the evening/early-morning halves, light through midday. ──
  // Static warm-cream fill for the disc radials. The previous implementation
  // sampled a time-of-day "sky" gradient (indigo nights → lilac dawn → amber
  // dusk → indigo) and ALSO shifted the base fill warm→deep-green-ink with
  // an `eveningT` ramp, so the disc visibly darkened as the day progressed
  // and as the user scrubbed toward evening. Both were removed — they read
  // as a bug ("the dial gets dark when I scroll") more than a feature.
  // The dial now reads as a single warm cream surface at every hour.
  // Original sun RGB: (255, 240, 214). Cool migration: (220, 226, 220).
  // For Variant B (brand-threaded): dome stays cool grey via fillRGB,
  // but the now-core radial uses primary green for a brand pool that
  // rides the live moment. Other gradients (sage, duo) still consume
  // fillRGB normally.
  const fillRGB = "220, 226, 220";
  const nowCoreRGB = "51, 84, 62"; // primary #33543E for the NOW-pool

  // Hour ticks + labels across the window (every 2 hours, plus NOW).
  const ticks = [];
  const tickLabels = [];
  // Start at the first whole even hour ≥ windowStart.
  const startHour = new Date(windowStart);
  startHour.setMinutes(0, 0, 0);
  if (startHour.getHours() % 2 !== 0) startHour.setHours(startHour.getHours() + 1);
  for (let t = startHour.getTime(); t <= windowEnd; t += 2 * 60 * 60 * 1000) {
    const f = fracOf(t);
    if (f < 0 || f > 1) continue;
    const [x, y] = ptAt(f, R);
    const a = angleOf(f);
    const [ix, iy] = [x - 14 * Math.cos(a), y - 14 * Math.sin(a)];
    ticks.push(`M ${x.toFixed(1)} ${y.toFixed(1)} L ${ix.toFixed(1)} ${iy.toFixed(1)}`);
    const [lx, ly] = ptAt(f, R - 30);
    const d = new Date(t);
    const lbl = formatTimeLabel(d).replace(":00", "");
    tickLabels.push({ x: lx, y: ly, lbl });
  }

  // NOW marker — at the REAL now's position in the (possibly scrubbed) window.
  // When the dial is turned, NOW slides off-center; if it leaves the window it
  // isn't drawn.
  const nowFrac = (nowMs - windowStart) / (windowEnd - windowStart);
  const nowInWindow = nowFrac >= 0 && nowFrac <= 1;
  const [nowX, nowY] = ptAt(Math.min(1, Math.max(0, nowFrac)), R);

  // Fixed wash anchor — the position NOW would occupy in the unscrubbed
  // view. Always ptAt(0.5, R) because when unscrubbed, NOW sits exactly
  // at the window center (nowFrac = 0.5 → center-left of the dial arc).
  // The wash anchors to THIS fixed position, not to nowX/nowY, so the
  // green hub stays put when the user scrubs around exploring other times.
  const [washX, washY] = ptAt(0.5, R);

  // Event placements — a rim dot at each event's fraction f; the outside rail
  // lists details aligned to ry. (No inward staggering needed anymore.)
  const placements = [];
  for (const e of inWindow) {
    const f = fracOf(e._start.getTime());
    const [rx, ry] = ptAt(f, R);
    const isPast = e._start.getTime() < nowMs && (!e._end || e._end.getTime() < nowMs);
    const isNext = nextEvent && e.id === nextEvent.id;
    placements.push({ e, f, rx, ry, isPast, isNext });
  }

  let countdown = null, imminent = false;
  if (hubEvent) {
    const mins = Math.round((hubEvent._start.getTime() - nowMs) / 60000);
    if (mins <= 0) { countdown = "now"; imminent = true; }
    else if (mins < 60) { countdown = `in ${mins} min`; imminent = mins <= 30; }
    else { countdown = `in ${Math.round(mins / 60)} hr`; }
  }

  // ── Scroll to scrub. Wheel/trackpad over the dial pans the time window:
  // scroll down = later, up = earlier. Each wheel notch nudges the window; the
  // (?) tooltip explains it. Replaces the heavier drag interaction. ──
  const onDialWheel = (e) => {
    // ~30 min per notch of deltaY (100 ≈ one notch); trackpads send smaller deltas.
    const step = (e.deltaY) * (30 * 60 * 1000) / 100;
    // Clamp scrub so center = now + scrub stays inside the day (window never
    // crosses midnight). Bounds derived from the day edges + the half-window.
    //
    // IMPORTANT: read time at CALL time, not from closure. After laptop sleep,
    // the captured nowMs/dayStartMs/dayEndMs from the last render can be hours
    // stale — leading to clamp bounds that pin scrubMs to a dead value and
    // make the dial appear frozen. Recomputing fresh on every wheel tick is
    // cheap and guarantees the bounds match the actual clock.
    const nowMsLive = Date.now();
    const dayStartLive = new Date(nowMsLive).setHours(0, 0, 0, 0);
    const dayEndLive = dayStartLive + 24 * 60 * 60 * 1000 - 1;
    const loScrub = (dayStartLive + HALF_WINDOW_MS) - nowMsLive;
    const hiScrub = (dayEndLive - HALF_WINDOW_MS) - nowMsLive;
    setScrubMs(prev => Math.max(loScrub, Math.min(hiScrub, prev + step)));
  };
  // Attach the wheel handler as a NON-passive native listener so preventDefault
  // works (React's onWheel is passive). IMPORTANT: only capture the wheel when
  // the cursor is actually over the visible DISC — the SVG's bounding box is a
  // large rectangle (444×888) that extends well past the disc curve, and
  // capturing wheel anywhere in that box blocked page scroll in the empty space
  // around the disc. We test the pointer against the disc geometry (within R of
  // the right-edge-anchored center) and only then scrub + preventDefault.
  useEffect(() => {
    const el = svgWrapRef.current;
    if (!el) return;
    const handler = (e) => {
      const rect = el.getBoundingClientRect();
      // Disc center is at the SVG's right edge, vertical middle (CX=VB_W, CY=VB_H/2),
      // in viewBox units. Convert pointer to viewBox space using the rendered scale.
      const sx = rect.width / VB_W, sy = rect.height / VB_H;
      const px = (e.clientX - rect.left) / sx;
      const py = (e.clientY - rect.top) / sy;
      const dx = px - CX, dy = py - CY;
      const insideDisc = (dx * dx + dy * dy) <= (R * R);
      if (!insideDisc) return; // outside the disc → let the page scroll
      e.preventDefault();
      onDialWheel(e);
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 0, overflow: "visible" }}>
      {/* B2 scrub indicator — appears only when the dial is scrubbed off
          live time. Sits in the upper-right area near the 6pm side of the
          dial, with right-aligned text echoing the hub's visual rhythm.
          Tap returns the dial to NOW. Three lines: where the scrub
          started (SCRUBBED · <real-time>), what time is being shown, and
          the return action. */}
      {/* Time indicator — ALWAYS visible. Two states:
          1. NOT scrubbed (live): shows current time only, no return action
          2. Scrubbed: shows scrubbed time + SCRUBBED · live-time eyebrow +
             Return to now action
          Tapping it when scrubbed returns the dial to NOW. */}
      <button
        onClick={() => { if (isScrubbed) setScrubMs(0); }}
        aria-label={isScrubbed ? "Return to now" : "Current time"}
        disabled={!isScrubbed}
        style={{
          position: "absolute",
          // Position: upper-inner dial area, well clear of both the
          // arc curve AND the left-side rail of event labels. Previous
          // position (right: 290 / top: 60) landed ON the noon-area
          // rail events at smaller dial scales — labels and indicator
          // visually collided. Pushing further right + slightly down
          // keeps the indicator inside the arc curve but above all
          // event rows. Scale-compensated so on-screen offset stays
          // consistent across dial-scale breakpoints.
          right: "calc(180px / var(--dial-scale, 1))",
          top: "calc(40px / var(--dial-scale, 1))",
          zIndex: 8,
          background: "transparent",
          border: "none",
          padding: "10px 14px",
          borderRadius: 8,
          cursor: isScrubbed ? "pointer" : "default",
          fontFamily: "inherit",
          textAlign: "right",
          transition: "background 120ms var(--rt-ease-out)",
        }}
        onMouseEnter={e => { if (isScrubbed) e.currentTarget.style.background = "rgba(20,30,22,0.03)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
      >
        {/* Corner brackets — top-left and bottom-right L-marks at 22%
            opacity. Defines the indicator's region without enclosing
            it in a card. Reads as "snippet of content" not as a UI
            element. Quietest possible "this is a thing" treatment. */}
        <span style={{ position: "absolute", left: 0, top: 0, width: 8, height: 8, borderLeft: "1px solid rgba(20,30,22,0.22)", borderTop: "1px solid rgba(20,30,22,0.22)", pointerEvents: "none" }} aria-hidden="true" />
        <span style={{ position: "absolute", right: 0, bottom: 0, width: 8, height: 8, borderRight: "1px solid rgba(20,30,22,0.22)", borderBottom: "1px solid rgba(20,30,22,0.22)", pointerEvents: "none" }} aria-hidden="true" />
        {/* Eyebrow — "NOW" when live, "SCRUBBED · live-time" when scrubbed */}
        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: C.textMuted }}>
          {isScrubbed ? (() => {
            // Show the actual real-time clock value at the moment they
            // started scrubbing. Gives the user a fix point.
            const liveNow = new Date(nowMs);
            const h = liveNow.getHours();
            const m = liveNow.getMinutes();
            const ampm = h >= 12 ? "pm" : "am";
            const h12 = ((h + 11) % 12) + 1;
            const mm = String(m).padStart(2, "0");
            return `Scrubbed · ${h12}:${mm}${ampm}`;
          })() : "Now"}
        </div>
        {/* Main time display — scrubbed time when scrubbed, live time when not */}
        <div style={{ fontSize: 22, fontWeight: 700, color: C.primaryDeep, lineHeight: 1.1, marginTop: 2, letterSpacing: "-0.01em" }}>
          {(() => {
            // When scrubbed: the time the dial is currently centered on.
            // When live: the actual current time.
            const t = new Date(nowMs + (isScrubbed ? scrubMs : 0));
            const h = t.getHours();
            const m = t.getMinutes();
            const ampm = h >= 12 ? "pm" : "am";
            const h12 = ((h + 11) % 12) + 1;
            const mm = String(m).padStart(2, "0");
            return `${h12}:${mm}${ampm}`;
          })()}
        </div>
        {/* Return action — only rendered when scrubbed. When live,
            this slot stays blank so the card doesn't show an action
            the user can't take. */}
        {isScrubbed && (
          <div style={{ fontSize: 10.5, color: "#33543E", fontWeight: 700, marginTop: 3, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 11, lineHeight: 1 }}>↺</span> Return to now
          </div>
        )}
      </button>
      {/* Fixed-size dial box pinned to the right edge, vertically centered.
          Rendering at exact viewBox px (not a scaled %) keeps a consistent
          size AND makes the HTML card overlay's %-of-box positioning line up
          1:1 with the SVG. The disc height (2*R) is kept small enough to fit
          common viewport heights without overflowing. */}
      {/* Fixed-size dial box, exactly the viewBox dimensions, pinned right and
          vertically centered. Matching the box to the SVG 1:1 means no
          letterboxing/shift and the HTML card overlay (positioned by %) lines
          up with the SVG. */}
      <div style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", width: VB_W, height: VB_H }}>
      <svg ref={svgWrapRef} viewBox={`0 0 ${VB_W} ${VB_H}`} width={VB_W} height={VB_H} style={{ position: "absolute", right: 0, top: 0, display: "block", touchAction: "none" }}>
        <defs>
          {/* A-light, TWO layers, both EDGELESS. The single centered glow couldn't
              light the events: the rim sits at radius R = the gradient's zero
              point, so brightness only built up off-screen at the right edge,
              never where the dots are. Fix = a second bloom living INSIDE the
              visible field that dies before the arc (stays edgeless) and pools
              warmth where the events sit.
                base  = edge-anchored atmosphere (centered, 0 at the rim)
                bloom = presence at the events (offset left, 0 before the rim)
              Dials: base stop-0 = overall warmth; bloom stop-0 = event-area punch;
              bloom cx/cy = where the light pools. */}
          <radialGradient id="rt-dial-sage" cx={CX} cy={CY} r={R} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={`rgba(${fillRGB}, 0.42)`} />
            <stop offset="0.45" stopColor={`rgba(${fillRGB}, 0.17)`} />
            <stop offset="0.78" stopColor={`rgba(${fillRGB}, 0.05)`} />
            <stop offset="1" stopColor={`rgba(${fillRGB}, 0)`} />
          </radialGradient>
          <radialGradient id="rt-dial-duo" cx={CX - 120} cy={CY + 130} r="320" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="rgba(86, 139, 104, 0.10)" />
            <stop offset="0.6" stopColor="rgba(86, 139, 104, 0.04)" />
            <stop offset="1" stopColor="rgba(86, 139, 104, 0)" />
          </radialGradient>
          {/* NOW-glow — green pool bound to the live NOW height (nowY); rides the
              day so brand sits at the current moment. Pulled toward the events
              side, dies before the rim. Dials: cx (how far in), r (spread).
              Variant B: uses nowCoreRGB (primary green) instead of fillRGB so
              the moment you're living in lights up green. */}
          <radialGradient id="rt-dial-core" cx={CX - 150} cy={(nowInWindow ? nowY : CY).toFixed(1)} r="215" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={`rgba(${nowCoreRGB}, 0.32)`} />
            <stop offset="0.50" stopColor={`rgba(${nowCoreRGB}, 0.14)`} />
            <stop offset="0.82" stopColor={`rgba(${nowCoreRGB}, 0.04)`} />
            <stop offset="1" stopColor={`rgba(${nowCoreRGB}, 0)`} />
          </radialGradient>
          {/* COMET-TAIL gradient — green tail led by the NOW dot, fading to grey
              behind it. Anchored head=now → tail behind, clipped at window edges. */}
          {(() => {
            const headF = Math.min(1, Math.max(0, nowFrac));
            const tailF = headF + 1.0;
            const [hx, hy] = ptAt(headF, R);
            const [tx, ty] = ptAt(tailF, R);
            return (
              <linearGradient id="rt-arc-elapsed" gradientUnits="userSpaceOnUse" x1={hx.toFixed(1)} y1={hy.toFixed(1)} x2={tx.toFixed(1)} y2={ty.toFixed(1)}>
                <stop offset="0" stopColor="rgba(58, 140, 98, 0.62)" />
                <stop offset="0.45" stopColor="rgba(82, 130, 100, 0.32)" />
                <stop offset="0.78" stopColor="rgba(120, 130, 120, 0.14)" />
                <stop offset="1" stopColor="rgba(140, 143, 138, 0.05)" />
              </linearGradient>
            );
          })()}
          {(() => {
            // Gradient is computed in user-space along the line from NOW (top)
            // to windowEnd point (top of dial). As nowFrac changes, the gradient
            // anchors slide accordingly.
            const [nx, ny] = ptAt(Math.min(1, Math.max(0, nowFrac)), R);
            const [ex, ey] = ptAt(1, R);
            return (
              <linearGradient id="rt-arc-fwd" gradientUnits="userSpaceOnUse"
                x1={nx.toFixed(1)} y1={ny.toFixed(1)}
                x2={ex.toFixed(1)} y2={ey.toFixed(1)}>
                <stop offset="0" stopColor="#33543E" />
                <stop offset="0.5" stopColor="#3F6B4B" />
                <stop offset="1" stopColor="#558B68" />
              </linearGradient>
            );
          })()}
          {/* ── ATMOSPHERIC · Frosted + static wash at center-left ──────
              Tinted atmospheric region with frosted texture overlay.
              The wash is STATIC — does not follow NOW. Bright spot
              stays at (CX, CY) regardless of time.

              Physics coherent: frosted glass with a fixed light source
              behind it. The light source doesn't move, so the bright
              spot doesn't move. NOW dot is a marker that travels
              around the perimeter; the glass itself stays put. */}
          {/* Wash anchored to washX, washY — the FIXED position where
              NOW lives in the unscrubbed view. This is the same as
              nowX/nowY when not scrubbed, but unlike nowX/nowY, washX
              does NOT shift when the user scrubs. The green hub stays
              put while the user scrubs around. */}
          <radialGradient id="rt-dial-wash"
                          cx={washX} cy={washY} r={R * 1.15}
                          gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="rgba(170, 220, 185, 0.20)" />
            <stop offset="55%" stopColor="rgba(170, 220, 185, 0.08)" />
            <stop offset="100%" stopColor="rgba(170, 220, 185, 0.02)" />
          </radialGradient>
          {/* Atmospheric density variation — feTurbulence noise tuned
              to read as density modulation rather than surface texture.
              baseFrequency 0.15 (was 0.35) makes the noise cells
              LARGER — soft blotches of variation rather than fine
              grain. Eye reads larger soft blotches as "atmospheric
              density" rather than "surface noise."
              colorMatrix alpha 0.025 (was 0.05) — barely visible,
              present but not asserting itself as texture.
              Overlay opacity 0.4 (was 0.5) — kept slight presence. */}
          <filter id="rt-dial-frosted" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.15" numOctaves="2" seed="3" stitchTiles="stitch" />
            <feColorMatrix values="0 0 0 0 0.11
                                  0 0 0 0 0.20
                                  0 0 0 0 0.14
                                  0 0 0 0.025 0" />
            <feComposite in2="SourceGraphic" operator="in" />
          </filter>
          {/* NOW dot drop-shadow */}
          <filter id="rt-dial-now-raised" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" />
            <feOffset dx="0.6" dy="1.4" result="offsetblur" />
            <feFlood floodColor="#1C3224" floodOpacity="0.28" />
            <feComposite in2="offsetblur" operator="in" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* ── ATMOSPHERIC render ─────────────────────────────────────────── */}
        {/* Layer 1: static mint wash */}
        <path d={`M ${CX} ${CY - R} A ${R} ${R} 0 0 0 ${CX} ${CY + R} Z`} fill="url(#rt-dial-wash)" />
        {/* Layer 2: atmospheric density variation overlay */}
        <path d={`M ${CX} ${CY - R} A ${R} ${R} 0 0 0 ${CX} ${CY + R} Z`}
              fill="rgba(170, 220, 185, 0.40)"
              filter="url(#rt-dial-frosted)"
              opacity="0.4" />
        {/* Layer 3: single soft hairline edge */}
        <path d={`M ${CX} ${CY - R} A ${R} ${R} 0 0 0 ${CX} ${CY + R}`}
              fill="none"
              stroke="rgba(28, 50, 36, 0.16)"
              strokeWidth="0.6" />
        {/* Time labels — etched into the glass, drawn just inside the arc */}
        {tickLabels.map((tl, i) => (
          <text key={`tl-${i}`} x={tl.x.toFixed(1)} y={(tl.y + 4).toFixed(1)} textAnchor="middle"
            style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, fontWeight: 600, fill: "#9A9A93", pointerEvents: "none" }}>
            {tl.lbl}
          </text>
        ))}
        {/* Connector — faint dashed leader from each event's dial dot to the rail */}
        {placements.map((p, i) => (
          <line key={`lead-${i}`} x1={(p.rx - 8).toFixed(1)} y1={p.ry.toFixed(1)} x2="0" y2={p.ry.toFixed(1)}
            stroke="rgba(28,50,36,0.12)" strokeWidth="1" strokeDasharray="1 5" strokeLinecap="round" pointerEvents="none" />
        ))}
        {/* Event dots — sit on the glass surface. Past = dim grey,
            future = soft sage, next-up gets a primary-green ring. */}
        {placements.map((p, i) => (
          <g key={p.e.id || i}>
            {p.isNext && <circle cx={p.rx.toFixed(1)} cy={p.ry.toFixed(1)} r="9" fill="none" stroke="#33543E" strokeOpacity="0.32" strokeWidth="1.4" />}
            <circle cx={p.rx.toFixed(1)} cy={p.ry.toFixed(1)} r="4.5" fill={p.isPast ? "#C4C4BD" : (p.isNext ? "#33543E" : "#558B68")} />
          </g>
        ))}
        {/* NOW marker — small lift via tighter drop-shadow. The radial
            wash already provides ambient focus around NOW; the static
            orb halo (12) was removed because it doubled up on the
            attention signal. Pulsing ring still active. */}
        {nowInWindow && <g filter="url(#rt-dial-now-raised)">
          <circle cx={nowX.toFixed(1)} cy={nowY.toFixed(1)} r="9" fill="#33543E" />
          <circle cx={nowX.toFixed(1)} cy={nowY.toFixed(1)} r="3.5" fill="#FFFFFF" />
        </g>}
        {nowInWindow && <circle cx={nowX.toFixed(1)} cy={nowY.toFixed(1)} r="18" fill="none" stroke="#33543E" strokeOpacity="0.26" strokeWidth="1.5">
          <animate attributeName="r" values="18;24;18" dur="3.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1; 0.4 0 0.2 1" />
          <animate attributeName="stroke-opacity" values="0.30;0.05;0.30" dur="3.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1; 0.4 0 0.2 1" />
        </circle>}
      </svg>

      {/* Event RAIL — events live OUTSIDE the disc now, in a vertical list to
          its left (reclaiming the old gap). Each item is aligned vertically to
          its event's position on the arc (ry), so the rail reads as a legend
          for the dial. Clicking loads the event into the hub. */}
      <div style={{ position: "absolute", right: VB_W + 8, top: "50%", transform: "translateY(-50%)", height: VB_H, width: 210, zIndex: 5 }}>
        {placements.length === 0 && earlierCount === 0 && laterCount === 0 && (
          <div className="rt-dial-cs" style={{ transformOrigin: "right center", position: "absolute", top: "50%", right: 0, transform: "translateY(-50%)", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, maxWidth: 220, textAlign: "right" }}>
            <span style={{ fontFamily: "'Caveat', 'Fraunces', Georgia, serif", fontStyle: "italic", fontSize: 22, color: "#2E6B4F", lineHeight: 1.15 }}>
              No calls today.
            </span>
            <span style={{ fontSize: 12, color: "#6B6B66", lineHeight: 1.45 }}>
              A clear day. Keep moving.
            </span>
          </div>
        )}
        {placements.map((p, i) => {
          // Fade cards that ride up behind the composer/band (top of the disc)
          // so they dissolve BEHIND it instead of peeking past its edges.
          const ryFrac = p.ry / VB_H;             // 0 = top, 1 = bottom
          const FADE_START = 0.30, FADE_END = 0.10; // fully faded above 10%, full below 30%
          let topFade = 1;
          if (ryFrac < FADE_START) topFade = Math.max(0, (ryFrac - FADE_END) / (FADE_START - FADE_END));
          const baseOpacity = p.isPast ? 0.55 : 1;
          return (
          <div
            key={p.e.id || i}
            className="rt-dial-event-row"
            onClick={() => setSelectedId(p.e.id)}
            style={{
              position: "absolute",
              right: 0,
              top: `${(p.ry / VB_H * 100).toFixed(2)}%`,
              transform: "translateY(-50%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 0,
              opacity: baseOpacity * topFade,
              pointerEvents: topFade < 0.5 ? "none" : "auto",
              transition: "opacity 120ms var(--rt-ease-out)",
              width: 230,
              padding: "6px 4px 6px 14px",
              cursor: "pointer",
            }}
          >
            <div className="rt-dial-cs" style={{ transformOrigin: "top right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1, minWidth: 0 }}>
              {/* All events use the same two-line treatment (uppercase time /
                  title / client). Next-up is conveyed by the GREEN RING on
                  its dot (set below) plus slightly darker + bolder title
                  text — subtle, not a different layout. Earlier attempt to
                  collapse next-up to a single Fraunces italic line caused
                  the visual disturbance you flagged; reverted. */}
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: p.isNext ? "#2E6B4F" : "#B7B7AE" }}>{formatTimeLabel(p.e._start)}</span>
              <span style={{ fontSize: 14, fontWeight: p.isNext ? 700 : 600, color: p.isNext ? "#1C3224" : "#3A3A35", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 150, textAlign: "right" }}>{p.e.title}</span>
              {p.e.client_name ? (
                <span style={{ fontSize: 10, color: p.isNext ? "#4A4F4A" : "#6B6B66", marginTop: 1, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 150, textAlign: "right" }}>{p.e.client_name}</span>
              ) : null}
              {/* "Needs client" attribution affordance REMOVED (June 2026).
                  The matcher re-runs on every 15-min sync, so the durable
                  fix for an unmatched event is renaming it in Google
                  Calendar — that propagates to every future instance.
                  Per-instance in-app linking was a band-aid. */}
              {/* Prep pill REMOVED from the rail (June 2026). Prep count
                  surfaces only in the right-side hub now ("Prep · N open /
                  N open task for [client]"). The rail row was colliding
                  with the next event's text when events were close in
                  time, and the chip pulled visual weight away from the
                  cleaner time/title/client treatment. */}
            </div>
            <span style={{ width: 30, height: 1, background: p.isNext ? "rgba(51,84,62,0.45)" : "rgba(28,50,36,0.18)", margin: "0 8px", flex: "0 0 30px" }} />
            <div style={{ width: 8, height: 8, borderRadius: "50%", flex: "0 0 8px", background: p.isPast ? "#C4C4BD" : (p.isNext ? "#33543E" : "#558B68"), boxShadow: p.isNext ? "0 0 0 3px #E6EFE9" : "none" }} />
          </div>
          );
        })}
      </div>

      {/* Earlier / later pockets near the arc ends */}
      {earlierCount > 0 && (
        <div className="rt-dial-cs" style={{ position: "absolute", right: 300, top: 812, zIndex: 9, display: "flex", alignItems: "center", gap: 8, transformOrigin: "bottom right", pointerEvents: "auto" }}>
          <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 600, color: C.textMuted }}>↓ {earlierCount} earlier</span>
        </div>
      )}
      {/* Later pocket + help (?). The help icon explains the whole wheel and
          renders ALWAYS — pinned next to the "↑ N later" indicator at the top
          of the dial (previously sat at the bottom near "earlier", where it
          collided visually with the dial's lower arc geometry). */}
      <div className="rt-dial-cs" style={{ position: "absolute", right: "8%", bottom: 6, display: "flex", alignItems: "center", gap: 8, transformOrigin: "bottom right", pointerEvents: "auto" }}>
        {laterCount > 0 && (
          <span style={{ fontFamily: "'Manrope', sans-serif", fontSize: 14, fontWeight: 600, color: C.textMuted }}>↑ {laterCount} later</span>
        )}
        <span
          className="rt-dial-help"
          tabIndex={0}
          style={{ position: "relative", width: 20, height: 20, borderRadius: "50%", background: "rgba(255,255,255,0.85)", boxShadow: "0 0 0 1px rgba(20,30,22,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: C.textMuted, cursor: "help", fontFamily: "inherit", flex: "none" }}
        >?
          <span className="rt-dial-help-tip" style={{ position: "absolute", right: 0, bottom: 26, width: 190, background: C.primaryDeep, color: "#fff", borderRadius: 9, padding: "9px 11px", fontSize: 11, lineHeight: 1.45, boxShadow: "0 6px 18px rgba(20,30,22,0.22)", pointerEvents: "none", opacity: 0, transform: "translateY(4px)", transition: "opacity .14s, transform .14s", fontWeight: 500, fontFamily: "'Manrope', sans-serif", textAlign: "left" }}>
            This is your day at a glance, centered on now. Scroll over it to look earlier or later — tap <b>Now</b> to snap back.
          </span>
        </span>
      </div>

      {/* Hub content — the NEXT event by default (compact readout). When the
          user clicks an event on the rail it becomes SELECTED and the
          readout expands into a richer version with prep tasks and three
          actions (Open client / Reschedule / Delete). No card wrapper, no
          border, no shadow — content floats on the dial backdrop like the
          rest of the rail. Sections are separated by whitespace only.
          Dismissal is implicit (click elsewhere on the dial) or via the
          × in the upper corner of the SELECTED state. */}
      <div className="rt-dial-hub" style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", width: 240, textAlign: "right", zIndex: 6 }}>
       <div className="rt-dial-cs" style={{ transformOrigin: "right center" }}>
        {hubEvent ? (
          selectedEvent ? (
            // ═══ SELECTED EVENT — V2: no card, whitespace separators ═══
            <>
              {/* Nav row: prev ← / next → arrows on the right side, where
                  the dismiss × used to live. The × is gone — dismissal
                  happens implicitly when the user clicks elsewhere on
                  the dial. The arrows step through the day's events in
                  chronological order without having to close the card
                  and click another rim dot. */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 2, marginBottom: 8 }}>
                {(() => {
                  // Find current event's index in the all-events list
                  // (sorted ascending by start time). Compute prev/next
                  // neighbours; disable the arrow at either end.
                  const idx = all.findIndex(e => e.id === selectedEvent.id);
                  const prev = idx > 0 ? all[idx - 1] : null;
                  const next = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;
                  return (
                    <>
                      <button
                        onClick={() => { if (prev) setSelectedId(prev.id); }}
                        disabled={!prev}
                        aria-label="Previous event"
                        title={prev ? `${formatTimeLabel(prev._start)} · ${prev.title}` : "No earlier event"}
                        style={{ width: 22, height: 22, borderRadius: 6, border: "none", background: "transparent", color: prev ? C.text : C.textMuted, fontSize: 14, lineHeight: 1, cursor: prev ? "pointer" : "not-allowed", padding: 0, fontFamily: "inherit", opacity: prev ? 1 : 0.4 }}
                      >
                        ←
                      </button>
                      <button
                        onClick={() => { if (next) setSelectedId(next.id); }}
                        disabled={!next}
                        aria-label="Next event"
                        title={next ? `${formatTimeLabel(next._start)} · ${next.title}` : "No later event"}
                        style={{ width: 22, height: 22, borderRadius: 6, border: "none", background: "transparent", color: next ? C.text : C.textMuted, fontSize: 14, lineHeight: 1, cursor: next ? "pointer" : "not-allowed", padding: 0, fontFamily: "inherit", opacity: next ? 1 : 0.4 }}
                      >
                        →
                      </button>
                    </>
                  );
                })()}
              </div>
              {/* Time hero + title + client. Same hierarchy as before but
                  with the bigger 24px hero time from the V2 mock. */}
              <div style={{ fontSize: 24, fontWeight: 700, color: C.primaryDeep, lineHeight: 1.05, letterSpacing: "-0.01em" }}>{formatTimeLabel(hubEvent._start)}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginTop: 4, lineHeight: 1.3 }}>{hubEvent.title}</div>
              {hubEvent.client_name && <div style={{ fontSize: 12, color: C.textSec, marginTop: 1 }}>{hubEvent.client_name}</div>}

              {/* Body — either prep section OR reschedule editor. 22px
                  vertical breathing room above replaces the hairline +
                  card section that the V1 had. */}
              {rescheduleEditing ? (
                <div style={{ marginTop: 22, textAlign: "left" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.0, textTransform: "uppercase", color: C.textMuted, marginBottom: 8 }}>Reschedule</div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                    <input
                      type="date"
                      value={rescheduleDate}
                      onChange={e => setRescheduleDate(e.target.value)}
                      style={{ flex: 1, minWidth: 0, fontSize: 12, padding: "6px 8px", border: "1px solid " + C.borderLight, borderRadius: 6, fontFamily: "inherit", background: C.bg, color: C.text }}
                    />
                    <input
                      type="time"
                      value={rescheduleTime}
                      onChange={e => setRescheduleTime(e.target.value)}
                      style={{ width: 90, fontSize: 12, padding: "6px 8px", border: "1px solid " + C.borderLight, borderRadius: 6, fontFamily: "inherit", background: C.bg, color: C.text }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                    <button
                      onClick={() => { setRescheduleEditing(false); }}
                      style={{ background: "transparent", color: C.textMuted, border: "none", padding: 0, fontSize: 11.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (!rescheduleDate || !rescheduleTime) return;
                        const newStart = new Date(`${rescheduleDate}T${rescheduleTime}`);
                        if (isNaN(newStart.getTime())) return;
                        const newStartIso = newStart.toISOString();
                        let newEndIso = null;
                        if (hubEvent.ends_at) {
                          const originalStart = new Date(hubEvent.starts_at).getTime();
                          const originalEnd = new Date(hubEvent.ends_at).getTime();
                          const durMs = originalEnd - originalStart;
                          if (durMs > 0) newEndIso = new Date(newStart.getTime() + durMs).toISOString();
                        }
                        if (typeof onRescheduleEvent === "function") {
                          onRescheduleEvent(hubEvent.id, newStartIso, newEndIso);
                        }
                        setRescheduleEditing(false);
                        setSelectedId(null);
                      }}
                      style={{ background: "transparent", color: C.primary, border: "none", padding: 0, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 22, textAlign: "right" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.0, textTransform: "uppercase", color: C.textMuted, marginBottom: 4 }}>
                    Prep{(hubEvent._prepCount > 0) ? ` · ${hubEvent._prepCount} open` : ""}
                  </div>
                  {hubEvent._prepCount > 0 && Array.isArray(hubEvent._prepTasks) && hubEvent._prepTasks.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {/* Only the highest-ranked prep task shows here.
                          Earlier we showed up to 4, which blew the hub
                          up vertically and competed with the event's own
                          metadata. The "+ N more" hint below still
                          communicates additional load when present. */}
                      {hubEvent._prepTasks.slice(0, 1).map(pt => (
                        <div
                          key={pt.id}
                          style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "3px 0", cursor: "pointer", justifyContent: "flex-end", minWidth: 0 }}
                          onClick={() => { if (typeof onTogglePrepTask === "function") onTogglePrepTask(pt.id); }}
                        >
                          {/* Checkbox first (left of text) — matches standard
                              task-row convention used everywhere else in the
                              app. The whole row remains right-aligned within
                              the hub via justifyContent: flex-end, but the
                              checkbox now leads the row content. */}
                          <div style={{ width: 13, height: 13, borderRadius: 4, border: "1.5px solid " + C.border, flexShrink: 0, marginTop: 2 }} />
                          <span style={{ fontSize: 12.5, color: C.text, lineHeight: 1.4, textAlign: "left", minWidth: 0, flex: "0 1 auto" }} title={pt.text}>{pt.text.length > 26 ? pt.text.slice(0, 25).trimEnd() + "…" : pt.text}</span>
                        </div>
                      ))}
                      {hubEvent._prepTasks.length > 1 && (
                        <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 2 }}>+ {hubEvent._prepTasks.length - 1} more</div>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12.5, color: C.textMuted, fontStyle: "italic", fontFamily: "'Fraunces', Georgia, serif", lineHeight: 1.4 }}>
                      Nothing to prep — you're set.
                    </div>
                  )}
                </div>
              )}

              {/* Action row — link-style buttons. Hidden when reschedule
                  editor is open (it has its own Save/Cancel). */}
              {!rescheduleEditing && (
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 14, marginTop: 22 }}>
                  <button
                    onClick={() => {
                      const d = hubEvent._start;
                      const yyyy = d.getFullYear();
                      const mm = String(d.getMonth() + 1).padStart(2, "0");
                      const dd = String(d.getDate()).padStart(2, "0");
                      const hh = String(d.getHours()).padStart(2, "0");
                      const mi = String(d.getMinutes()).padStart(2, "0");
                      setRescheduleDate(`${yyyy}-${mm}-${dd}`);
                      setRescheduleTime(`${hh}:${mi}`);
                      setRescheduleEditing(true);
                    }}
                    style={{ background: "transparent", border: "none", padding: 0, fontSize: 11.5, fontWeight: 500, color: C.text, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    Reschedule
                  </button>
                  <button
                    onClick={() => { if (typeof onDeleteEvent === "function") onDeleteEvent(hubEvent.id); setSelectedId(null); }}
                    style={{ background: "transparent", border: "none", padding: 0, fontSize: 11.5, fontWeight: 500, color: "#A03422", cursor: "pointer", fontFamily: "inherit" }}
                  >
                    Delete
                  </button>
                </div>
              )}
            </>
          ) : (
            // ═══ NEXT-EVENT READOUT — DEFAULT STATE ═════════════════
            // Shown when no event is selected (e.g. page refresh, or
            // user has scrubbed back to "now"). Mirrors the selected-
            // event state's typography (24px hero time, 14px title,
            // 12px client) AND its prep section + action row — the
            // default state needs the same affordances as the selected
            // state so the user can act on the upcoming meeting without
            // first having to click the rim dot to "select" it.
            //
            // Nav arrows are intentionally omitted here — they belong
            // to the explicit-selection state where the user has chosen
            // an event to inspect.
            <>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.0, textTransform: "uppercase", color: imminent ? C.primary : C.textMuted, marginBottom: 4 }}>
                Next{countdown ? ` · ${countdown}` : ""}
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.primaryDeep, lineHeight: 1.05, letterSpacing: "-0.01em" }}>{formatTimeLabel(hubEvent._start)}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginTop: 4, lineHeight: 1.3 }}>{hubEvent.title}</div>
              {hubEvent.client_name && <div style={{ fontSize: 12, color: C.textSec, marginTop: 1 }}>{hubEvent.client_name}</div>}

              {/* Prep section — copied from the selected-event branch
                  so the default state offers the same context. Shows
                  only the top-ranked task; "+ N more" hints at deeper
                  prep load without expanding the hub. */}
              <div style={{ marginTop: 22, textAlign: "right" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.0, textTransform: "uppercase", color: C.textMuted, marginBottom: 4 }}>
                  Prep{(hubEvent._prepCount > 0) ? ` · ${hubEvent._prepCount} open` : ""}
                </div>
                {hubEvent._prepCount > 0 && Array.isArray(hubEvent._prepTasks) && hubEvent._prepTasks.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {hubEvent._prepTasks.slice(0, 1).map(pt => (
                      <div
                        key={pt.id}
                        style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "3px 0", cursor: "pointer", justifyContent: "flex-end", minWidth: 0 }}
                        onClick={() => { if (typeof onTogglePrepTask === "function") onTogglePrepTask(pt.id); }}
                      >
                        <div style={{ width: 13, height: 13, borderRadius: 4, border: "1.5px solid " + C.border, flexShrink: 0, marginTop: 2 }} />
                        <span style={{ fontSize: 12.5, color: C.text, lineHeight: 1.4, textAlign: "left", minWidth: 0, flex: "0 1 auto" }} title={pt.text}>{pt.text.length > 26 ? pt.text.slice(0, 25).trimEnd() + "…" : pt.text}</span>
                      </div>
                    ))}
                    {hubEvent._prepTasks.length > 1 && (
                      <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 2 }}>+ {hubEvent._prepTasks.length - 1} more</div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 12.5, color: C.textMuted, fontStyle: "italic", fontFamily: "'Fraunces', Georgia, serif", lineHeight: 1.4 }}>
                    Nothing to prep — you're set.
                  </div>
                )}
              </div>

              {/* Action row — same Reschedule + Delete as the selected
                  state. Reschedule clicking promotes the event to the
                  selected state and opens the reschedule editor there
                  (the editor lives in the selected branch). */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 14, marginTop: 22 }}>
                <button
                  onClick={() => {
                    // Promote this event to "selected" so the reschedule
                    // editor (which lives in the selected branch) can
                    // open, pre-populated with this event's date/time.
                    setSelectedId(hubEvent.id);
                    const d = hubEvent._start;
                    const yyyy = d.getFullYear();
                    const mm = String(d.getMonth() + 1).padStart(2, "0");
                    const dd = String(d.getDate()).padStart(2, "0");
                    const hh = String(d.getHours()).padStart(2, "0");
                    const mi = String(d.getMinutes()).padStart(2, "0");
                    setRescheduleDate(`${yyyy}-${mm}-${dd}`);
                    setRescheduleTime(`${hh}:${mi}`);
                    setRescheduleEditing(true);
                  }}
                  style={{ background: "transparent", border: "none", padding: 0, fontSize: 11.5, fontWeight: 500, color: C.text, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Reschedule
                </button>
                <button
                  onClick={() => { if (typeof onDeleteEvent === "function") onDeleteEvent(hubEvent.id); }}
                  style={{ background: "transparent", border: "none", padding: 0, fontSize: 11.5, fontWeight: 500, color: "#A03422", cursor: "pointer", fontFamily: "inherit" }}
                >
                  Delete
                </button>
              </div>
            </>
          )
        ) : (
          <div style={{ fontSize: 11, color: C.textMuted, fontStyle: "italic", fontFamily: "'Fraunces', Georgia, serif" }}>No upcoming events</div>
        )}
       </div>
      </div>
      </div>
    </div>
  );
}

export { TimeDial };
