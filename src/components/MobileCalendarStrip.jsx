import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { parseCalendarEntry } from "../parser";


// ─── MobileCalendarStrip ────────────────────────────────────────────────
// PALETTE NOTE: base/fade colors below are hardcoded (gradients can't use
// C tokens). If the palette changes again, update #FAFBFA / rgba(250,251,250)
// here — this file was missed in the June 2026 cream→sage migration.
// Mobile-only ambient calendar. Collapsed: a slim horizontal day-strip
// (6am→midnight) with meetings as dots + a NOW tick + the next meeting named
// underneath. Expanded (open=true): the strip stays pinned on top and the
// day's events list below it, next as a green-ringed white card, with the
// frosted inline composer at the foot. Uses the EXACT desktop V1 gradient,
// horizontal for the strip and vertical for the expanded body, so it reads as
// the same ambient day, just rotated. Reuses parseCalendarEntry for create.
const V1_GRAD_H = "linear-gradient(90deg, rgba(124,92,243,0.10) 0%, rgba(150,170,235,0.08) 12%, rgba(190,205,200,0.06) 30%, rgba(122,170,140,0.07) 46%, rgba(150,185,150,0.06) 58%, rgba(216,180,120,0.09) 72%, rgba(200,140,90,0.10) 84%, rgba(90,80,110,0.12) 94%, rgba(40,45,70,0.14) 100%), #FAFBFA";
const V1_GRAD_V = "linear-gradient(180deg, rgba(124,92,243,0.10) 0%, rgba(150,170,235,0.08) 12%, rgba(190,205,200,0.06) 30%, rgba(122,170,140,0.07) 46%, rgba(150,185,150,0.06) 58%, rgba(216,180,120,0.09) 72%, rgba(200,140,90,0.10) 84%, rgba(90,80,110,0.12) 94%, rgba(40,45,70,0.14) 100%), #FAFBFA";

function MobileCalendarStrip({ events = [], onCreate, onDelete, C, clients = [], open = false, onToggle = null, selectedDay = "today", greeting = "", firstName = "", displayDate = "", googleConnected = false, onConnectGoogle = null }) {
  const [composerText, setComposerText] = useState("");
  const [composerError, setComposerError] = useState(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const inputRef = useRef(null);

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

  const submit = () => {
    if (!composerText.trim()) return;
    const parseAnchor = new Date(now);
    if (selectedDay === "tomorrow") parseAnchor.setDate(parseAnchor.getDate() + 1);
    const parsed = parseCalendarEntry(composerText, parseAnchor, clients);
    if (!parsed) { setComposerError("Add a time (e.g. 2pm, 9:30am, noon)"); return; }
    setComposerError(null);
    setComposerText("");
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    onCreate && onCreate(parsed);
  };

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

  // ── COLLAPSED ──
  if (!open) {
    // ── GRADIENT SKY + REFINED TIMELINE (concept 4) ──
    // Full-bleed time-of-day sky gradient with a restrained timeline across the
    // header: a near-FLAT hairline curve (not a bouncy arc) + small UNIFORM
    // dots plotted by time-of-day. Past events read as hollow rings, upcoming
    // as solid, the next event gets one quiet halo ring. The dots are round
    // HTML divs (positioned by %/px) so they never oval the way a stretched
    // SVG viewBox would. Tap → expand. Bands: dawn 6–10a, midday 10a–5p,
    // dusk 5–8p, night 8p+.
    let countdown = null, imminent = false;
    if (nextEvent) {
      const mins = minutesUntil(nextEvent._start);
      if (mins <= 0) { countdown = "now"; imminent = true; }
      else if (mins < 60) { countdown = `in ${mins} min`; imminent = mins <= 30; }
      else { countdown = `in ${Math.round(mins / 60)} hr`; }
    }
    const allPast = dayEvents.length > 0 && !nextEvent && selectedDay === "today";

    // Timeline band geometry (px). A gentle quadratic: baseline BASE_Y, the
    // midpoint lifts only LIFT px (flat, not a rainbow). y at horizontal
    // fraction f: quadratic with control at center.
    const BAND_H = 40, BASE_Y = 26, LIFT = 7;
    const curveY = (f) => {
      // Quadratic Bézier y with endpoints at BASE_Y and control at (BASE_Y-2*LIFT)
      // so the visible peak (at f=0.5) = 0.5*BASE_Y + 0.5*(BASE_Y-2*LIFT) = BASE_Y-LIFT.
      const cy = BASE_Y - 2 * LIFT, mt = 1 - f;
      return mt * mt * BASE_Y + 2 * mt * f * cy + f * f * BASE_Y;
    };
    // VISIBLE SCHEDULE (June 2026 redesign): dots carry their time beneath
    // them (skipped when a neighbor's label is too close), and the NEXT
    // event is rendered as a named mini-card riding the band instead of a
    // dot — the band reads as a schedule at a glance, not decoration.
    let lastLabeledF = -1;
    const dotEls = dayEvents.map((e, i) => {
      const f = fracFor(e._start);
      if (f < 0 || f > 1) return null;
      const isNext = nextEvent && e.id === nextEvent.id;
      if (isNext) return null; // rendered as the mini-card chip below
      const isPast = selectedDay === "today" && (e._end ? e._end.getTime() : e._start.getTime() + 30 * 60000) <= nowMs;
      const y = curveY(f);
      const sz = 7;
      const showLabel = f - lastLabeledF >= 0.085;
      if (showLabel) lastLabeledF = f;
      return (
        <div key={e.id || i} aria-hidden style={{ position: "absolute", left: `${(f * 100).toFixed(2)}%`, top: y, transform: "translate(-50%, -50%)", width: sz, height: sz, pointerEvents: "none" }}>
          <div style={{
            width: sz, height: sz, borderRadius: "50%",
            background: isPast ? C.bg : C.primaryLight,
            border: isPast ? "1.5px solid " + C.ink300 : "none",
            boxSizing: "border-box",
          }} />
          {showLabel && (
            <div style={{ position: "absolute", top: sz + 3, left: "50%", transform: "translateX(-50%)", fontSize: 8.5, fontWeight: 700, color: isPast ? C.ink300 : C.textSec, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
              {fmtTimeShort(e._start)}
            </div>
          )}
        </div>
      );
    });
    // Next event — named mini-card anchored to its time position on the
    // band. Edge-aware shift keeps it on-screen near 6am/midnight.
    const nextChip = nextEvent ? (() => {
      const f = fracFor(nextEvent._start);
      if (f < 0 || f > 1) return null;
      const y = curveY(f);
      const tx = f < 0.2 ? "translateX(-12px)" : f > 0.8 ? "translateX(calc(-100% + 12px))" : "translateX(-50%)";
      return (
        <div aria-hidden style={{ position: "absolute", left: `${(f * 100).toFixed(2)}%`, top: y, pointerEvents: "none", zIndex: 2 }}>
          <div style={{ position: "absolute", left: 0, top: 0, transform: "translate(-50%,-50%)", width: 7, height: 7, borderRadius: "50%", background: C.primary, boxShadow: "0 0 0 3px rgba(51,84,62,0.16)" }} />
          <div style={{ position: "absolute", top: -31, left: 0, transform: tx, background: C.card, borderRadius: 8, padding: "3px 8px", border: "1px solid rgba(85,139,104,0.45)", boxShadow: "0 3px 10px rgba(85,139,104,0.14)", whiteSpace: "nowrap", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis" }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: C.primary, fontVariantNumeric: "tabular-nums" }}>{fmtTimeShort(nextEvent._start)}</span>
            <span style={{ fontSize: 9.5, fontWeight: 600, color: C.text }}> {nextEvent.title}</span>
          </div>
        </div>
      );
    })() : null;

    return (
      <div
        ref={bandRef}
        onClick={() => { if (suppressClickRef.current) return; onToggle && onToggle(); }}
        onPointerDown={onBandPointerDown}
        onPointerMove={onBandPointerMove}
        onPointerUp={endScrub}
        onPointerCancel={endScrub}
        style={{ position: "relative", cursor: "pointer", margin: "-20px -16px 0", padding: "0 16px", touchAction: "pan-y" }}
      >
        {/* NOW-pulse keyframes — once per render tree, scoped by name. */}
        <style>{`@keyframes rtNowPulse { 0% { box-shadow: 0 0 0 0 rgba(51,84,62,0.32); } 70% { box-shadow: 0 0 0 9px rgba(51,84,62,0); } 100% { box-shadow: 0 0 0 0 rgba(51,84,62,0); } }`}</style>
        {/* Full-bleed time-of-day sky gradient: dawn lilac/peach (left) → cool
            midday blue → amber dusk → indigo night (right). Low opacity so it
            whispers against the cream; a vertical fade dissolves it into bg. */}
        <div aria-hidden style={{
          position: "absolute", top: -40, left: 0, right: 0, height: 200, zIndex: 0, pointerEvents: "none",
          background:
            "linear-gradient(180deg, rgba(0,0,0,0) 58%, rgba(250,251,250,1) 100%), " +
            "linear-gradient(90deg, rgba(160,150,190,0.20) 0%, rgba(220,185,160,0.17) 14%, rgba(190,215,225,0.15) 34%, rgba(185,212,218,0.14) 50%, rgba(218,170,145,0.16) 72%, rgba(130,122,165,0.19) 86%, rgba(60,70,110,0.22) 100%)",
        }} />
        {/* NOW — a soft daylight glow at the current-time x-position. */}
        {selectedDay === "today" && nowFrac > 0 && nowFrac < 1 && (
          <div aria-hidden style={{
            position: "absolute", top: -40, height: 200, width: 72, zIndex: 1, pointerEvents: "none",
            left: `calc(${(nowFrac * 100).toFixed(1)}% - 36px)`,
            background: "radial-gradient(ellipse 50% 55% at 50% 26%, rgba(255,255,255,0.28), transparent 70%)",
          }} />
        )}
        {/* Refined timeline: a near-flat hairline curve. Full-bleed; the stroke
            stays uniform via non-scaling-stroke even when stretched. */}
        <div style={{ position: "absolute", top: 21, left: 0, right: 0, height: BAND_H, zIndex: 1, pointerEvents: "none" }}>
          <svg viewBox={`0 0 288 ${BAND_H}`} width="100%" height={BAND_H} preserveAspectRatio="none" style={{ display: "block", position: "absolute", left: 0, right: 0, top: 0 }}>
            <path d={`M 0 ${BASE_Y} Q 144 ${BASE_Y - 2 * LIFT} 288 ${BASE_Y}`} fill="none" stroke="rgba(30,38,31,0.16)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          </svg>
          {/* NOW seeker — a small solid marker riding the curve at current time */}
          {selectedDay === "today" && nowFrac > 0 && nowFrac < 1 && (
            <div aria-hidden style={{ position: "absolute", left: `${(nowFrac * 100).toFixed(2)}%`, top: curveY(nowFrac), transform: "translate(-50%, -50%)", width: 12, height: 12, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 3px rgba(250,251,250,0.9)", background: "rgba(250,251,250,0.9)", zIndex: 3 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.primaryDeep, animation: "rtNowPulse 2.4s ease-out infinite" }} />
              <div style={{ position: "absolute", top: 13, left: "50%", transform: "translateX(-50%)", fontSize: 7.5, fontWeight: 800, letterSpacing: 1.1, color: C.primaryDeep }}>NOW</div>
            </div>
          )}
          {dotEls}
          {nextChip}
          {/* Scrub overlay — cursor rides the curve; bubble shows the
              scrubbed time, or the nearest event when within ~45 min. */}
          {scrubFrac != null && (() => {
            const hFloat = DAY_START + scrubFrac * SPAN;
            const sd = new Date(dayBase);
            sd.setHours(Math.floor(hFloat), Math.round((hFloat % 1) * 60), 0, 0);
            let nearest = null, best = 0.045;
            for (const ev of dayEvents) {
              const d = Math.abs(fracFor(ev._start) - scrubFrac);
              if (d < best) { best = d; nearest = ev; }
            }
            const y = curveY(scrubFrac);
            const leftPct = scrubFrac * 100;
            const tx = scrubFrac < 0.18 ? "translateX(-10px)" : scrubFrac > 0.82 ? "translateX(calc(-100% + 10px))" : "translateX(-50%)";
            return (
              <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 4, pointerEvents: "none" }}>
                <div style={{ position: "absolute", left: `${leftPct}%`, top: y, transform: "translate(-50%,-50%)", width: 10, height: 10, borderRadius: "50%", background: C.primaryDeep, boxShadow: "0 0 0 3px rgba(250,251,250,0.95), 0 0 0 4.5px rgba(51,84,62,0.30)" }} />
                <div style={{ position: "absolute", top: -32, left: `${leftPct}%`, transform: tx, background: C.card, borderRadius: 8, padding: "4px 9px", boxShadow: "0 5px 16px rgba(20,30,22,0.16)", border: "1px solid " + C.border, whiteSpace: "nowrap", maxWidth: 210, overflow: "hidden" }}>
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
        {/* Header row in the sky, sitting below the timeline band: date+greeting
            left, next-meeting right. */}
        <div style={{ position: "relative", zIndex: 2, display: "flex", justifyContent: "space-between", alignItems: "flex-end", paddingTop: 65 }}>
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
    <div style={{ background: V1_GRAD_V, borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(20,30,22,0.05)" }}>
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
                </div>
              </div>
            );
          }
          return (
            <div key={e.id || i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 0", borderTop: i === 0 ? "none" : "1px solid rgba(30,38,31,0.06)" }}>
              <span style={{ fontSize: 10, fontWeight: 700, width: 56, flexShrink: 0, color: isPast ? C.textMuted : C.primaryLight }}>{fmtTime(e._start)}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: isPast ? 500 : 600, color: isPast ? C.textMuted : C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.title}</span>
              {onDelete && e.source === "manual" && (
                <button onClick={() => onDelete(e.id)} style={{ background: "transparent", border: "none", cursor: "pointer", color: C.textMuted, fontSize: 13, padding: 0, lineHeight: 1, flexShrink: 0 }} title="Delete">×</button>
              )}
            </div>
          );
        })}
      </div>
      {/* Frosted foot composer — HIDDEN: calendar entry happens via the + FAB
          / task composer only. Gated behind false (no deletion). */}
      {false && (
      <div
        onClick={() => inputRef.current && inputRef.current.focus()}
        style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 14px", background: "rgba(255,255,255,0.55)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", borderTop: "1px solid rgba(20,30,22,0.05)", cursor: "text" }}
      >
        <span style={{ width: 22, height: 22, borderRadius: 11, background: "#EDE7FB", color: C.btn, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 600, flexShrink: 0, pointerEvents: "none" }}>+</span>
        <input
          ref={inputRef}
          type="text"
          value={composerText}
          onChange={e => { setComposerText(e.target.value); if (composerError) setComposerError(null); }}
          onKeyDown={e => { if (e.key === "Enter") submit(); }}
          onClick={e => e.stopPropagation()}
          autoComplete="off"
          spellCheck={false}
          placeholder={selectedDay === "tomorrow" ? "2pm Sarah · adds to tomorrow" : "Add an event — “call w/ Rose Babe 3pm”"}
          style={{ flex: 1, border: "none", background: "transparent", fontFamily: "inherit", fontSize: 11.5, color: C.text, outline: "none", padding: "2px 0", minWidth: 0 }}
        />
      </div>
      )}
      {false && composerError && (
        <div style={{ fontSize: 10.5, color: C.danger, padding: "0 14px 8px" }}>{composerError}</div>
      )}
    </div>
  );
}

export { V1_GRAD_H, V1_GRAD_V, MobileCalendarStrip };
