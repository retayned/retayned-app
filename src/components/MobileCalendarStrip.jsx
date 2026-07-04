import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";


// ─── MobileCalendarStrip ────────────────────────────────────────────────
// PALETTE NOTE: base/fade colors below are hardcoded (gradients can't use
// C tokens). If the palette changes again, update #FAFBFA / rgba(250,251,250).
// (V1_GRAD_H/V removed June 2026 refactor — an App-level CSS kill-rule had
// been flattening them in production anyway; the flat bg is the real look.)
// Mobile-only ambient calendar — the hanging-disc dial, single mode
// (Jul 2026: the tap-to-expand day-list view was REMOVED by product
// decision — the dial is not a thing you click into. The header slot
// beside the greeting carries the day instead: it shows whichever event
// the user taps on the rim, or simply whatever is up next. open/onToggle/
// onCreate/onDelete props are accepted for API compatibility but unused).

function MobileCalendarStrip({ events = [], onCreate, onDelete, C, clients = [], open = false, onToggle = null, selectedDay = "today", greeting = "", firstName = "", displayDate = "", googleConnected = false, onConnectGoogle = null, onRequestLink = null }) {
  // "+ client" chip for any event with no client/rolodex linkage —
  // mirrors the dial's restored affordance (mission-critical, June 2026).
  const linkChip = (e, size = 10) => {
    if (e.client_id || e.rolodex_id || e.client_name || !onRequestLink) return null;
    return (
      <button
        onClick={(ev) => {
          ev.stopPropagation();
          const r = ev.currentTarget.getBoundingClientRect();
          onRequestLink({ eventId: e.id, anchorRect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom } });
        }}
        style={{ background: "transparent", border: "1px dashed rgba(28,50,36,0.35)", borderRadius: 999, padding: "1px 8px", fontSize: size, fontWeight: 700, color: "#33543E", cursor: "pointer", fontFamily: "inherit", letterSpacing: 0.3, flexShrink: 0 }}
      >+ client</button>
    );
  };
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // ── Time Band scrub (Phase 3) ─────────────────────────────────────
  // The dial's signature interaction, translated: drag horizontally
  // across the sky and a cursor rides the curve — a bubble shows the
  // scrubbed time, or the nearest event's card when one is close.
  // touch-action: pan-y keeps vertical page scroll native; only
  // deliberate horizontal drags (>8px, more X than Y) become scrubs.
  // A scrub suppresses the tap-to-expand click on release.
  const bandRef = useRef(null);
  const scrubGesture = useRef({ id: null, active: false, startX: 0, startY: 0, fStart: 0 });
  const suppressClickRef = useRef(false);
  const [scrubFrac, setScrubFrac] = useState(null);
  // Rim-dot selection: tapping an event dot pins that event into the
  // header slot. Tapping empty dial glass clears it back to next-up.
  const [pickedId, setPickedId] = useState(null);
  // ── Scrub-turn (Jul 2026): the desktop dial's real semantics, ported.
  // Dragging doesn't move a cursor — it TURNS the 6h window under the
  // fixed apex. scrubMs = how far the window has been turned off "now".
  // On release the dial holds for a beat, then eases home.
  const DOME_WIN_MS = 6 * 3600000;
  const [scrubMs, _setScrubMs] = useState(0);
  const scrubMsRef = useRef(0);
  const setScrubMs = (v) => { scrubMsRef.current = v; _setScrubMs(v); };
  const easeTimerRef = useRef(null);
  const easeRafRef = useRef(null);
  const cancelEase = () => {
    if (easeTimerRef.current) { clearTimeout(easeTimerRef.current); easeTimerRef.current = null; }
    if (easeRafRef.current) { cancelAnimationFrame(easeRafRef.current); easeRafRef.current = null; }
  };
  const scheduleEaseBack = () => {
    cancelEase();
    easeTimerRef.current = setTimeout(() => {
      const from = scrubMsRef.current, t0 = performance.now(), DUR = 420;
      const step = (t) => {
        const p = Math.min(1, (t - t0) / DUR);
        const e = 1 - Math.pow(1 - p, 3);
        setScrubMs(from * (1 - e));
        if (p < 1) easeRafRef.current = requestAnimationFrame(step);
      };
      easeRafRef.current = requestAnimationFrame(step);
    }, 1400);
  };
  useEffect(() => cancelEase, []);
  const fracFromClientX = (clientX) => {
    const el = bandRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!r.width) return null;
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width));
  };
  const onBandPointerDown = (e) => {
    cancelEase(); // grabbing the dial interrupts its glide home
    scrubGesture.current = { id: e.pointerId, active: false, startX: e.clientX, startY: e.clientY, fStart: 0, baseMs: scrubMsRef.current };
  };
  const onBandPointerMove = (e) => {
    const s = scrubGesture.current;
    if (s.id == null || e.pointerId !== s.id) return;
    if (!s.active) {
      const dx = e.clientX - s.startX, dy = e.clientY - s.startY;
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        s.active = true;
        s.fStart = fracFromClientX(s.startX) ?? 0.5;
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* unsupported */ }
      } else return;
    }
    const f = fracFromClientX(e.clientX);
    if (f != null) {
      setScrubFrac(f);
      // Turn the window: drag left = time advances toward you, drag
      // right = rewind. base + (fStart − f) · window.
      setScrubMs(clampScrub((s.fStart - f) * DOME_WIN_MS + (scrubGesture.current.baseMs || 0)));
    }
  };
  const endScrub = () => {
    const s = scrubGesture.current;
    if (s.active) {
      suppressClickRef.current = true;
      setTimeout(() => { suppressClickRef.current = false; }, 250);
      setScrubFrac(null);
      scheduleEaseBack();
    }
    scrubGesture.current = { id: null, active: false, startX: 0, startY: 0 };
    setScrubFrac(null);
  };

  // Day window: 6am → midnight (matches desktop field). Position is the
  // fraction across that window.
  const DAY_START = 6;   // 6am
  const DAY_END = 24;    // midnight
  const SPAN = DAY_END - DAY_START;

  const now = new Date(nowTick);
  const dayBase = new Date(now);
  if (selectedDay === "tomorrow") dayBase.setDate(dayBase.getDate() + 1);

  // ── Scrub clamp (Jul 2026): the dial turns only within the selected
  // day — desktop behavior. Unclamped, scrubMs accumulated across drags
  // (baseMs) and the 6h window walked into future days without limit.
  // Bounds: the window's EDGES stay inside the day's 24h, so the extremes
  // show exactly midnight→6am and 6pm→midnight, then the dial stops.
  const dayStartMs = (() => { const d = new Date(dayBase); d.setHours(0, 0, 0, 0); return d.getTime(); })();
  const baseCenterMs = selectedDay === "today"
    ? now.getTime()
    : (() => { const d = new Date(dayBase); d.setHours(13, 0, 0, 0); return d.getTime(); })();
  const clampScrub = (v) => {
    const lo = (dayStartMs + DOME_WIN_MS / 2) - baseCenterMs;
    const hi = (dayStartMs + 86400000 - DOME_WIN_MS / 2) - baseCenterMs;
    return Math.max(lo, Math.min(hi, v));
  };

  const fracFor = (d) => {
    const h = d.getHours() + d.getMinutes() / 60;
    return Math.max(0, Math.min(1, (h - DAY_START) / SPAN));
  };

  // Events for the selected day, sorted, with parsed start times.
  const dayEvents = (events || [])
    .map(e => ({ ...e, _start: new Date(e.starts_at), _end: e.ends_at ? new Date(e.ends_at) : null }))
    .filter(e => {
      const d = e._start;
      return d.getFullYear() === dayBase.getFullYear() && d.getMonth() === dayBase.getMonth() && d.getDate() === dayBase.getDate();
    })
    .sort((a, b) => a._start - b._start);

  const nowMs = now.getTime();
  // Next upcoming event (today only)
  const nextEvent = selectedDay === "today"
    ? dayEvents.find(e => e._start.getTime() > nowMs)
    : dayEvents[0];

  // The pinned event, if the user tapped a dot and it still exists today.
  const pickedEvent = pickedId ? (dayEvents.find(e => e.id === pickedId) || null) : null;

  const nowFrac = fracFor(now);
  const showNow = selectedDay === "today" && nowFrac > 0 && nowFrac < 1;

  const fmtTime = (d) => {
    let h = d.getHours(); const m = d.getMinutes();
    const ap = h >= 12 ? "PM" : "AM"; h = h % 12; if (h === 0) h = 12;
    return m === 0 ? `${h}:00 ${ap}` : `${h}:${String(m).padStart(2, "0")} ${ap}`;
  };
  const fmtTimeShort = (d) => {
    let h = d.getHours(); const m = d.getMinutes();
    const ap = h >= 12 ? "p" : "a"; h = h % 12; if (h === 0) h = 12;
    return m === 0 ? `${h}${ap}` : `${h}:${String(m).padStart(2, "0")}${ap}`;
  };
  const clientNameFor = (e) => {
    if (e.client_name) return e.client_name;
    if (e.client_id) { const c = (clients || []).find(x => x.id === e.client_id); return c ? c.name : null; }
    return null;
  };
  const minutesUntil = (d) => Math.round((d.getTime() - nowMs) / 60000);


  // ── COLLAPSED: THE CREST (Jul 2026, v2) ────────────────────────────
  // The desktop TimeDial for portrait — now as a SUN-PATH ARC. v1 hung
  // the cap downward (a bowl); a day doesn't read as a valley, it rises
  // to a zenith, so the arc now crests UP with NOW riding the top.
  // Chronology stays left→right (matches the expanded list, the bucket
  // calendars, every axis in the app). Materials remain the desktop's,
  // verbatim: mint wash radial anchored to the FIXED unscrubbed-NOW
  // point (the crest), feTurbulence density overlay (0.15/0.025/0.4),
  // 0.6px hairline rim, #9A9A93 tick labels, r4.5 dots (past #C4C4BD /
  // future #558B68 / focus #33543E + ring), r9+r3.5 NOW seeker with
  // drop-shadow and breathing pulse. Same R (420) as the desktop dial.
  //
  // THE SCRUB IS THE DESKTOP'S: dragging turns the 6h window under the
  // fixed crest — NOW slides off-center exactly like the desktop dial —
  // and whichever event rides nearest the crest becomes the selection,
  // shown in the header row. Release → holds a beat → glides home.
  {
    const allPast = dayEvents.length > 0 && !nextEvent && selectedDay === "today";

    // ── Geometry: the HANGING DISC (reverted Jul 2026 — the upward
    // "sun crest" flip was wrong; the instrument is the desktop dial's
    // protruding disc, entering from the screen edge, so from the top
    // edge it hangs DOWN with NOW at its lowest point). Circle center
    // sits above the screen; a shallow ~48px cap shows. Chronology is
    // left→right: the desktop dial reads window-start at its top and
    // window-end at its bottom, and the only rotation that brings its
    // flat edge to the phone's top edge (90° counter-clockwise) maps
    // top→LEFT and bottom→RIGHT — earlier left, later right. It also
    // makes the disc a clockwise wheel: as time passes, dots ride left
    // through NOW, the direction every clock mechanism turns.
    const DOME_R = 420, DOME_W = 390, APEX_Y = 58, DOME_H = 86;
    const DCX = DOME_W / 2, DCY = APEX_Y - DOME_R;
    const rimY = DCY + Math.sqrt(DOME_R * DOME_R - DCX * DCX); // ≈10
    const aL = Math.atan2(rimY - DCY, 0 - DCX);
    const aR = Math.atan2(rimY - DCY, DOME_W - DCX);
    const dPtAt = (f, r) => {
      const a = aL + (aR - aL) * f;
      return [DCX + r * Math.cos(a), DCY + r * Math.sin(a)];
    };
    // 6h window, turned by the scrub.
    const winCenter = baseCenterMs + clampScrub(scrubMs);
    const winStart = winCenter - DOME_WIN_MS / 2, winEnd = winCenter + DOME_WIN_MS / 2;
    const domeFrac = (ms) => (ms - winStart) / DOME_WIN_MS;
    const scrubActive = scrubFrac != null || Math.abs(scrubMs) > 30000;

    // The selection: whichever event rides nearest the crest while the
    // dial is turned (within 45 min of it).
    let focusEvent = null;
    if (scrubActive) {
      let best = 45 * 60000;
      for (const ev of dayEvents) {
        const d = Math.abs(ev._start.getTime() - winCenter);
        if (d < best) { best = d; focusEvent = ev; }
      }
    }

    let countdown = null, imminent = false;
    if (nextEvent) {
      const mins = minutesUntil(nextEvent._start);
      if (mins <= 0) { countdown = "now"; imminent = true; }
      else if (mins < 60) { countdown = `in ${mins} min`; imminent = mins <= 30; }
      else { countdown = `in ${Math.round(mins / 60)} hr`; }
    }

    // Hour LABELS etched into the glass just inside the rim — labels
    // only, no tick lines (the desktop dial doesn't draw them either).
    // The apex zone is skipped for the seeker/readout.
    const tickEls = [];
    const t0 = new Date(winStart); t0.setMinutes(0, 0, 0);
    if (t0.getTime() < winStart) t0.setHours(t0.getHours() + 1);
    for (let t = t0.getTime(); t <= winEnd; t += 3600000) {
      const f = domeFrac(t);
      if (f < 0.03 || f > 0.97) continue;
      if (Math.abs(f - 0.5) < 0.075) continue; // apex zone
      const [lx, ly] = dPtAt(f, DOME_R - 18);
      tickEls.push(
        <text key={"tk" + t} x={lx.toFixed(1)} y={(ly + 3).toFixed(1)} textAnchor="middle" style={{ fontFamily: "'Manrope', sans-serif", fontSize: 9.5, fontWeight: 600, fill: "#9A9A93" }}>{fmtTimeShort(new Date(t))}</text>
      );
    }

    // Event dots on the rim — desktop colors; the ring rides the focus
    // while scrubbing, the next event otherwise.
    const ringTarget = focusEvent || pickedEvent || nextEvent;
    const dotEls = dayEvents.map((e, i) => {
      const f = domeFrac(e._start.getTime());
      if (f < 0.02 || f > 0.98) return null;
      const isRing = ringTarget && e.id === ringTarget.id;
      const isPast = selectedDay === "today" && (e._end ? e._end.getTime() : e._start.getTime() + 30 * 60000) <= nowMs;
      const [x, y] = dPtAt(f, DOME_R);
      return (
        <g key={e.id || i}>
          {isRing && <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r="9" fill="none" stroke="#33543E" strokeOpacity="0.32" strokeWidth="1.4" />}
          <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r="4.5" fill={isPast ? "#C4C4BD" : (isRing ? "#33543E" : "#558B68")} />
          {/* Invisible tap target (a 4.5px dot is untappable). click, not
              pointerdown, so a scrub that STARTS on a dot still scrubs;
              stopPropagation so the glass-tap clear doesn't fire. */}
          <circle
            cx={x.toFixed(1)} cy={y.toFixed(1)} r="16"
            fill="transparent" style={{ cursor: "pointer" }}
            onClick={(ev) => { ev.stopPropagation(); if (suppressClickRef.current) return; setPickedId(e.id); }}
          />
        </g>
      );
    });

    // NOW seeker — at real now's position in the (possibly turned)
    // window, sliding off the crest as you scrub. Desktop-true.
    const nowF = domeFrac(nowMs);
    const nowInWindow = selectedDay === "today" && nowF > 0.02 && nowF < 0.98;
    const [nx, ny] = dPtAt(Math.max(0.02, Math.min(0.98, nowF)), DOME_R);
    // Wash stays anchored to the crest — the FIXED unscrubbed-NOW spot.
    const [wx, wy] = dPtAt(0.5, DOME_R);

    const capPath = `M 0 0 L 0 ${rimY.toFixed(1)} A ${DOME_R} ${DOME_R} 0 0 0 ${DOME_W} ${rimY.toFixed(1)} L ${DOME_W} 0 Z`;
    const rimPath = `M 0 ${rimY.toFixed(1)} A ${DOME_R} ${DOME_R} 0 0 0 ${DOME_W} ${rimY.toFixed(1)}`;

    return (
      <div style={{ margin: "-20px -16px 0" }}>
        <div
          ref={bandRef}
          onClick={() => { if (suppressClickRef.current) return; setPickedId(null); }}
          onPointerDown={onBandPointerDown}
          onPointerMove={onBandPointerMove}
          onPointerUp={endScrub}
          onPointerCancel={endScrub}
          style={{ position: "relative", touchAction: "pan-y" }}
        >
          <svg viewBox={`0 0 ${DOME_W} ${DOME_H}`} width="100%" height="auto" style={{ display: "block" }} aria-hidden>
            <defs>
              <radialGradient id="rt-dome-wash" cx={wx.toFixed(1)} cy={wy.toFixed(1)} r={DOME_R * 0.62} gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="rgba(170, 220, 185, 0.20)" />
                <stop offset="55%" stopColor="rgba(170, 220, 185, 0.08)" />
                <stop offset="100%" stopColor="rgba(170, 220, 185, 0.02)" />
              </radialGradient>
              <filter id="rt-dome-frosted" x="0%" y="0%" width="100%" height="100%">
                <feTurbulence type="fractalNoise" baseFrequency="0.15" numOctaves="2" seed="3" stitchTiles="stitch" />
                <feColorMatrix values="0 0 0 0 0.11
                                      0 0 0 0 0.20
                                      0 0 0 0 0.14
                                      0 0 0 0.025 0" />
                <feComposite in2="SourceGraphic" operator="in" />
              </filter>
              <filter id="rt-dome-now-raised" x="-50%" y="-50%" width="200%" height="200%">
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
            {/* Layer 1: static mint wash */}
            <path d={capPath} fill="url(#rt-dome-wash)" />
            {/* Layer 2: atmospheric density variation overlay */}
            <path d={capPath} fill="rgba(170, 220, 185, 0.40)" filter="url(#rt-dome-frosted)" opacity="0.4" />
            {/* Layer 3: single soft hairline edge */}
            <path d={rimPath} fill="none" stroke="rgba(28, 50, 36, 0.16)" strokeWidth="0.6" />
            {tickEls}
            {dotEls}
            {/* Scrubbed-time readout at the crest while the dial is turned */}
            {scrubActive && (
              <text x={DCX} y={APEX_Y + 22} textAnchor="middle" style={{ fontFamily: "'Manrope', sans-serif", fontSize: 9.5, fontWeight: 800, fill: "#1C3224", fontVariantNumeric: "tabular-nums" }}>{fmtTime(new Date(winCenter))}</text>
            )}
            {nowInWindow && (
              <g filter="url(#rt-dome-now-raised)">
                <circle cx={nx.toFixed(1)} cy={ny.toFixed(1)} r="9" fill="#33543E" />
                <circle cx={nx.toFixed(1)} cy={ny.toFixed(1)} r="3.5" fill="#FFFFFF" />
              </g>
            )}
            {nowInWindow && !scrubActive && (
              <circle cx={nx.toFixed(1)} cy={ny.toFixed(1)} r="18" fill="none" stroke="#33543E" strokeOpacity="0.26" strokeWidth="1.5">
                <animate attributeName="r" values="18;24;18" dur="3.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1; 0.4 0 0.2 1" />
                <animate attributeName="stroke-opacity" values="0.30;0.05;0.30" dur="3.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1; 0.4 0 0.2 1" />
              </circle>
            )}
          </svg>
        </div>
        {/* Header row: date + greeting left; the selection (while turning)
            or the next event (at rest) on the right — no separate tile. */}
        <div style={{ position: "relative", zIndex: 2, display: "flex", justifyContent: "space-between", alignItems: "flex-end", padding: "6px 16px 0" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11.5, color: C.textMuted, letterSpacing: 0.3 }}>{displayDate}</div>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: "2px 0 0", letterSpacing: -0.4, color: C.text, lineHeight: 1.04 }}>
              {greeting}{firstName ? ", " + firstName : ""}.
            </h1>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0, paddingBottom: 3, paddingLeft: 10 }}>
            {focusEvent ? (
              <>
                <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: C.primary }}>
                  On the dial
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginTop: 1, maxWidth: 130, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  <span style={{ color: C.primaryDeep, fontWeight: 700 }}>{fmtTime(focusEvent._start)}</span> {focusEvent.title}
                </div>
              </>
            ) : pickedEvent ? (
              <>
                <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: C.primary }}>
                  Selected{(() => { const m = minutesUntil(pickedEvent._start); return m > 0 && m < 60 ? ` · in ${m} min` : m > 0 ? ` · in ${Math.round(m / 60)} hr` : ""; })()}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginTop: 1, maxWidth: 130, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  <span style={{ color: C.primaryDeep, fontWeight: 700 }}>{fmtTime(pickedEvent._start)}</span> {pickedEvent.title}
                </div>
                {clientNameFor(pickedEvent)
                  ? <div style={{ fontSize: 9.5, color: C.textMuted, marginTop: 1, maxWidth: 130, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{clientNameFor(pickedEvent)}</div>
                  : <div style={{ marginTop: 2, display: "flex", justifyContent: "flex-end" }}>{linkChip(pickedEvent, 9)}</div>}
              </>
            ) : nextEvent ? (
              <>
                <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: imminent ? C.primary : C.primaryLight }}>
                  Next{countdown ? ` · ${countdown}` : ""}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginTop: 1, maxWidth: 130, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  <span style={{ color: C.primaryDeep, fontWeight: 700 }}>{fmtTime(nextEvent._start)}</span> {nextEvent.title}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 11, color: C.textMuted, fontStyle: "italic", fontFamily: "'Fraunces', Georgia, serif" }}>
                {allPast ? "All done." : "No calls today"}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

}

export { MobileCalendarStrip };
