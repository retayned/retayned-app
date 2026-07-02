import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";


// ─── MobileCalendarStrip ────────────────────────────────────────────────
// PALETTE NOTE: base/fade colors below are hardcoded (gradients can't use
// C tokens). If the palette changes again, update #FAFBFA / rgba(250,251,250).
// (V1_GRAD_H/V removed June 2026 refactor — an App-level CSS kill-rule had
// been flattening them in production anyway; the flat bg is the real look.)
// Mobile-only ambient calendar. Collapsed: a slim horizontal day-strip
// (6am→midnight) with meetings as dots + a NOW tick + the next meeting named
// underneath. Expanded (open=true): the strip stays pinned on top and the
// day's events list below it, next as a green-ringed white card, with the
// frosted inline composer at the foot. Uses the EXACT desktop V1 gradient,
// horizontal for the strip and vertical for the expanded body, so it reads as
// the same ambient day, just rotated. Reuses parseCalendarEntry for create.

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
  const scrubGesture = useRef({ id: null, active: false, startX: 0, startY: 0 });
  const suppressClickRef = useRef(false);
  const [scrubFrac, setScrubFrac] = useState(null);
  const fracFromClientX = (clientX) => {
    const el = bandRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!r.width) return null;
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width));
  };
  const onBandPointerDown = (e) => {
    scrubGesture.current = { id: e.pointerId, active: false, startX: e.clientX, startY: e.clientY };
  };
  const onBandPointerMove = (e) => {
    const s = scrubGesture.current;
    if (s.id == null || e.pointerId !== s.id) return;
    if (!s.active) {
      const dx = e.clientX - s.startX, dy = e.clientY - s.startY;
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        s.active = true;
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* unsupported */ }
      } else return;
    }
    const f = fracFromClientX(e.clientX);
    if (f != null) setScrubFrac(f);
  };
  const endScrub = () => {
    const s = scrubGesture.current;
    if (s.active) {
      suppressClickRef.current = true;
      setTimeout(() => { suppressClickRef.current = false; }, 250);
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


  // Dot for a single event on the strip
  const renderDot = (e, i) => {
    const left = fracFor(e._start) * 100;
    const isPast = selectedDay === "today" && (e._end ? e._end.getTime() : e._start.getTime() + 30 * 60000) <= nowMs;
    const isNext = nextEvent && e.id === nextEvent.id;
    return (
      <span
        key={e.id || i}
        style={{
          position: "absolute", top: 2, left: `${left}%`, transform: "translateX(-50%)",
          width: 8, height: 8, borderRadius: "50%",
          background: isPast ? C.ink300 : C.primaryLight,
          boxShadow: isNext ? "0 0 0 3px rgba(85,139,104,0.20)" : "none",
        }}
      />
    );
  };

  const strip = (
    <div style={{ position: "relative", height: 12 }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 5, height: 2, borderRadius: 2, background: "rgba(30,38,31,0.10)" }} />
      {dayEvents.map(renderDot)}
      {showNow && (
        <div style={{ position: "absolute", top: 0, left: `${nowFrac * 100}%`, transform: "translateX(-50%)", width: 2, height: 12, background: C.btn, borderRadius: 2, boxShadow: "0 0 0 2px rgba(124,92,243,0.14)" }} />
      )}
    </div>
  );

  const ends = (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8.5, color: C.ink300, marginTop: 5, fontVariantNumeric: "tabular-nums" }}>
      <span>6a</span><span>12p</span><span>6p</span><span>12a</span>
    </div>
  );

  // ── COLLAPSED: THE DOME (Jul 2026) ─────────────────────────────────
  // The desktop TimeDial, rotated for portrait. Desktop = half-disc on the
  // right edge, NOW pinned at the arc's left midpoint. Here = a shallow
  // dome hanging from the TOP edge, NOW pinned at the apex. Every material
  // is ported verbatim from TimeDial.jsx: the mint wash radial (anchored to
  // the FIXED unscrubbed-NOW point), the feTurbulence density overlay
  // (baseFreq 0.15 / alpha 0.025 / opacity 0.4), the 0.6px hairline
  // rgba(28,50,36,0.16), tick labels #9A9A93, event dots r4.5
  // (past #C4C4BD / future #558B68 / next #33543E + ring), and the NOW
  // seeker (r9 deep-green + r3.5 white core, drop-shadow, breathing pulse).
  // Window: 6h (3h back / 3h forward) — half the desktop's 12h, sized for
  // a phone header. Events outside the window aren't drawn; the header row
  // below names the next one. Tap → expand. Horizontal scrub → time bubble.
  if (!open) {
    let countdown = null, imminent = false;
    if (nextEvent) {
      const mins = minutesUntil(nextEvent._start);
      if (mins <= 0) { countdown = "now"; imminent = true; }
      else if (mins < 60) { countdown = `in ${mins} min`; imminent = mins <= 30; }
      else { countdown = `in ${Math.round(mins / 60)} hr`; }
    }
    const allPast = dayEvents.length > 0 && !nextEvent && selectedDay === "today";

    // ── Dome geometry. Same R as the desktop dial (420); the circle's
    // center sits above the screen so only a shallow ~48px cap shows.
    // ptAt(f, r) is the desktop idiom: f∈[0,1] across the 6h window,
    // f=0.5 = NOW = the apex (the deepest point of the cap).
    const DOME_R = 420, DOME_W = 390, DOME_DEPTH = 58, DOME_H = 86;
    const DCX = DOME_W / 2, DCY = DOME_DEPTH - DOME_R;
    const rimY = DCY + Math.sqrt(DOME_R * DOME_R - DCX * DCX); // y at x=0 / x=W
    const aL = Math.atan2(rimY - DCY, 0 - DCX);
    const aR = Math.atan2(rimY - DCY, DOME_W - DCX);
    const dAngleOf = (f) => aL + (aR - aL) * f;
    const dPtAt = (f, r) => {
      const a = dAngleOf(f);
      return [DCX + r * Math.cos(a), DCY + r * Math.sin(a)];
    };
    // 6h window centered on now (today) / on midday for other days.
    const WIN_MS = 6 * 3600000;
    const winCenter = selectedDay === "today" ? nowMs : (() => { const d = new Date(dayBase); d.setHours(13, 0, 0, 0); return d.getTime(); })();
    const winStart = winCenter - WIN_MS / 2, winEnd = winCenter + WIN_MS / 2;
    const domeFrac = (ms) => (ms - winStart) / WIN_MS;

    // Hour ticks: every whole hour inside the window, labels etched just
    // inside the rim (desktop treatment), skipping the apex zone where the
    // NOW seeker lives.
    const tickEls = [];
    const t0 = new Date(winStart); t0.setMinutes(0, 0, 0);
    if (t0.getTime() < winStart) t0.setHours(t0.getHours() + 1);
    for (let t = t0.getTime(); t <= winEnd; t += 3600000) {
      const f = domeFrac(t);
      if (f < 0.015 || f > 0.985) continue;
      if (selectedDay === "today" && Math.abs(f - 0.5) < 0.075) continue; // NOW zone
      const [ox, oy] = dPtAt(f, DOME_R);
      const [ix, iy] = dPtAt(f, DOME_R - 7);
      const [lx, ly] = dPtAt(f, DOME_R - 19);
      tickEls.push(
        <g key={"tk" + t}>
          <path d={`M ${ox.toFixed(1)} ${oy.toFixed(1)} L ${ix.toFixed(1)} ${iy.toFixed(1)}`} stroke="rgba(28,50,36,0.18)" strokeWidth="1" />
          <text x={lx.toFixed(1)} y={(ly + 3).toFixed(1)} textAnchor="middle" style={{ fontFamily: "'Manrope', sans-serif", fontSize: 9.5, fontWeight: 600, fill: "#9A9A93" }}>{fmtTimeShort(new Date(t))}</text>
        </g>
      );
    }

    // Event dots on the rim — desktop colors and next-ring, no labels
    // (desktop names events on its side rail; here the header row below
    // names the next one and the expanded list names them all).
    const dotEls = dayEvents.map((e, i) => {
      const f = domeFrac(e._start.getTime());
      if (f < 0.01 || f > 0.99) return null;
      const isNext = nextEvent && e.id === nextEvent.id;
      const isPast = selectedDay === "today" && (e._end ? e._end.getTime() : e._start.getTime() + 30 * 60000) <= nowMs;
      const [x, y] = dPtAt(f, DOME_R);
      return (
        <g key={e.id || i}>
          {isNext && <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r="9" fill="none" stroke="#33543E" strokeOpacity="0.32" strokeWidth="1.4" />}
          <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r="4.5" fill={isPast ? "#C4C4BD" : (isNext ? "#33543E" : "#558B68")} />
        </g>
      );
    });

    // NOW seeker — fixed at the apex, the desktop ptAt(0.5, R) invariant.
    const [nx, ny] = dPtAt(0.5, DOME_R);
    const showDomeNow = selectedDay === "today";

    // Dome path: rim arc closed against the top edge.
    const domePath = `M 0 0 L 0 ${rimY.toFixed(1)} A ${DOME_R} ${DOME_R} 0 0 0 ${DOME_W} ${rimY.toFixed(1)} L ${DOME_W} 0 Z`;
    const rimPath = `M 0 ${rimY.toFixed(1)} A ${DOME_R} ${DOME_R} 0 0 0 ${DOME_W} ${rimY.toFixed(1)}`;

    return (
      <div style={{ margin: "-20px -16px 0" }}>
        <div
          ref={bandRef}
          onClick={() => { if (suppressClickRef.current) return; onToggle && onToggle(); }}
          onPointerDown={onBandPointerDown}
          onPointerMove={onBandPointerMove}
          onPointerUp={endScrub}
          onPointerCancel={endScrub}
          style={{ position: "relative", cursor: "pointer", touchAction: "pan-y" }}
        >
          <svg viewBox={`0 0 ${DOME_W} ${DOME_H}`} width="100%" height="auto" style={{ display: "block" }} aria-hidden>
            <defs>
              {/* Mint wash — anchored to the FIXED unscrubbed-NOW point
                  (the apex), exactly like the desktop's washX/washY. */}
              <radialGradient id="rt-dome-wash" cx={nx} cy={ny} r={DOME_R * 0.62} gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="rgba(170, 220, 185, 0.20)" />
                <stop offset="55%" stopColor="rgba(170, 220, 185, 0.08)" />
                <stop offset="100%" stopColor="rgba(170, 220, 185, 0.02)" />
              </radialGradient>
              {/* Atmospheric density variation — desktop's exact filter. */}
              <filter id="rt-dome-frosted" x="0%" y="0%" width="100%" height="100%">
                <feTurbulence type="fractalNoise" baseFrequency="0.15" numOctaves="2" seed="3" stitchTiles="stitch" />
                <feColorMatrix values="0 0 0 0 0.11
                                      0 0 0 0 0.20
                                      0 0 0 0 0.14
                                      0 0 0 0.025 0" />
                <feComposite in2="SourceGraphic" operator="in" />
              </filter>
              {/* NOW dot drop-shadow — desktop's exact filter. */}
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
            <path d={domePath} fill="url(#rt-dome-wash)" />
            {/* Layer 2: atmospheric density variation overlay */}
            <path d={domePath} fill="rgba(170, 220, 185, 0.40)" filter="url(#rt-dome-frosted)" opacity="0.4" />
            {/* Layer 3: single soft hairline edge — the rim only */}
            <path d={rimPath} fill="none" stroke="rgba(28, 50, 36, 0.16)" strokeWidth="0.6" />
            {tickEls}
            {dotEls}
            {showDomeNow && (
              <g filter="url(#rt-dome-now-raised)">
                <circle cx={nx.toFixed(1)} cy={ny.toFixed(1)} r="9" fill="#33543E" />
                <circle cx={nx.toFixed(1)} cy={ny.toFixed(1)} r="3.5" fill="#FFFFFF" />
              </g>
            )}
            {showDomeNow && (
              <circle cx={nx.toFixed(1)} cy={ny.toFixed(1)} r="18" fill="none" stroke="#33543E" strokeOpacity="0.26" strokeWidth="1.5">
                <animate attributeName="r" values="18;24;18" dur="3.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1; 0.4 0 0.2 1" />
                <animate attributeName="stroke-opacity" values="0.30;0.05;0.30" dur="3.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1; 0.4 0 0.2 1" />
              </circle>
            )}
          </svg>
          {/* Scrub overlay — the bubble rides the rim; shows the scrubbed
              time, or the nearest event when within ~45 min of it. */}
          {scrubFrac != null && (() => {
            const sd = new Date(winStart + scrubFrac * WIN_MS);
            let nearest = null, best = 0.125; // 0.125 of 6h = 45 min
            for (const ev of dayEvents) {
              const d = Math.abs(domeFrac(ev._start.getTime()) - scrubFrac);
              if (d < best) { best = d; nearest = ev; }
            }
            const [sx, sy] = dPtAt(scrubFrac, DOME_R);
            const leftPct = (sx / DOME_W) * 100;
            const tx = scrubFrac < 0.18 ? "translateX(-10px)" : scrubFrac > 0.82 ? "translateX(calc(-100% + 10px))" : "translateX(-50%)";
            return (
              <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 4, pointerEvents: "none" }}>
                <div style={{ position: "absolute", left: `${leftPct}%`, top: sy, transform: "translate(-50%,-50%)", width: 10, height: 10, borderRadius: "50%", background: C.primaryDeep, boxShadow: "0 0 0 3px rgba(250,251,250,0.95), 0 0 0 4.5px rgba(51,84,62,0.30)" }} />
                <div style={{ position: "absolute", top: sy + 14, left: `${leftPct}%`, transform: tx, background: C.card, borderRadius: 8, padding: "4px 9px", boxShadow: "0 5px 16px rgba(20,30,22,0.16)", border: "1px solid " + C.border, whiteSpace: "nowrap", maxWidth: 210, overflow: "hidden" }}>
                  {nearest ? (
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis" }}>
                      <span style={{ color: C.primary, fontWeight: 700 }}>{fmtTime(nearest._start)}</span> {nearest.title}{clientNameFor(nearest) ? <span style={{ color: C.textMuted, fontWeight: 500 }}> · {clientNameFor(nearest)}</span> : null}
                    </div>
                  ) : (
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums" }}>{fmtTime(sd)}</div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
        {/* Header row below the dome: date + greeting left, NEXT EVENT right
            (this is where "N events · N done" style chrome used to sit — the
            next event itself renders here now, no separate tile). */}
        <div style={{ position: "relative", zIndex: 2, display: "flex", justifyContent: "space-between", alignItems: "flex-end", padding: "6px 16px 0" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11.5, color: C.textMuted, letterSpacing: 0.3 }}>{displayDate}</div>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: "2px 0 0", letterSpacing: -0.4, color: C.text, lineHeight: 1.04 }}>
              {greeting}{firstName ? ", " + firstName : ""}.
            </h1>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0, paddingBottom: 3, paddingLeft: 10 }}>
            {nextEvent ? (
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
                {allPast ? "All done." : "Tap to add"}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── EXPANDED ──
  return (
    <div style={{ background: "#FAFBFA", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(20,30,22,0.05)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px 4px" }}>
        <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: C.textMuted }}>{selectedDay === "today" ? "Today" : "Tomorrow"} · {dayEvents.length} {dayEvents.length === 1 ? "event" : "events"}</span>
        <button onClick={onToggle} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 10.5, fontWeight: 600, color: C.textMuted, fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 3 }}>
          collapse <Icon name="chevron-down" size={11} color={C.textMuted} />
        </button>
      </div>
      <div style={{ padding: "6px 14px 10px" }}>{strip}{ends}</div>
      <div style={{ padding: "0 14px 4px" }}>
        {dayEvents.length === 0 && (
          <div style={{ padding: "10px 0 6px" }}>
            <div style={{ border: "1px dashed " + C.ink300, borderRadius: 10, padding: "10px 12px", fontSize: 11.5, color: C.textMuted, fontStyle: "italic", fontFamily: "'Fraunces', Georgia, serif" }}>
              Your day lives here.{!googleConnected && onConnectGoogle ? (
                <>
                  {" "}
                  <button
                    onClick={(e) => { e.stopPropagation(); onConnectGoogle(); }}
                    style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontStyle: "italic", fontSize: 11.5, color: C.primary, fontWeight: 700, textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 2 }}
                  >
                    Connect Google Calendar
                  </button>
                  {" "}and it fills itself.
                </>
              ) : " Add one from the green + — \u201c2pm call with Maya.\u201d"}
            </div>
          </div>
        )}
        {dayEvents.map((e, i) => {
          const isPast = selectedDay === "today" && (e._end ? e._end.getTime() : e._start.getTime() + 30 * 60000) <= nowMs;
          const isNext = nextEvent && e.id === nextEvent.id;
          const cname = clientNameFor(e);
          if (isNext) {
            const mins = minutesUntil(e._start);
            return (
              <div key={e.id || i} style={{ padding: "6px 0" }}>
                <div style={{ marginLeft: 56, background: C.card, borderRadius: 10, padding: "8px 12px", boxShadow: "0 0 0 1px rgba(85,139,104,0.35), 0 3px 10px rgba(85,139,104,0.12), 0 8px 22px rgba(20,30,22,0.05)" }}>
                  <div style={{ fontSize: 10, color: C.primaryLight, fontWeight: 700 }}>{fmtTime(e._start)}{mins > 0 && mins <= 120 ? ` · in ${mins} min` : ""}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text, marginTop: 1 }}>{e.title}</div>
                  {cname && <div style={{ fontSize: 10, color: C.textMuted, marginTop: 1 }}>{cname}</div>}
                  {!cname && <div style={{ marginTop: 3 }}>{linkChip(e)}</div>}
                </div>
              </div>
            );
          }
          return (
            <div key={e.id || i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 0", borderTop: i === 0 ? "none" : "1px solid rgba(30,38,31,0.06)" }}>
              <span style={{ fontSize: 10, fontWeight: 700, width: 56, flexShrink: 0, color: isPast ? C.textMuted : C.primaryLight }}>{fmtTime(e._start)}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: isPast ? 500 : 600, color: isPast ? C.textMuted : C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.title}</span>
              {linkChip(e, 9.5)}
              {onDelete && e.source === "manual" && (
                <button onClick={() => onDelete(e.id)} style={{ background: "transparent", border: "none", cursor: "pointer", color: C.textMuted, fontSize: 13, padding: 0, lineHeight: 1, flexShrink: 0 }} title="Delete">×</button>
              )}
            </div>
          );
        })}
      </div>
      {/* Frosted foot composer — HIDDEN: calendar entry happens via the + FAB
          / task composer only. Gated behind false (no deletion). */}
      {/* (dead {false &&} block removed — June 2026 refactor: strip composer foot) */}
      {/* (dead {false &&} block removed — June 2026 refactor: strip composer error) */}
    </div>
  );
}

export { MobileCalendarStrip };
