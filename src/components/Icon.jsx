import { C } from "../theme";
import { retColor } from "../utils";


const Icon = ({ name, size = 18, color = "currentColor", accent = "#1C3224", simple = false }) => {
  // Editorial nav icons — 32x32 viewBox, multi-color.
  // Body and accent come from CSS custom properties on the icon's
  // parent (.nav-item or .nav-item-mobile), so the icon's state
  // (rest / hover / active) is controlled by the row, not by a prop:
  //   rest (no class)     → --icon-body: text-muted gray,  --icon-accent: text-sec
  //   :hover              → --icon-body: primaryMuted sage, --icon-accent: primaryMutedDeep
  //   .is-active          → --icon-body: primaryLight green, --icon-accent: ink dark
  // Fallback values in the var() expressions keep non-nav callers
  // (composer chips at simple={true}, EmptyState illustrations) at
  // full brand saturation — they never set the CSS vars on their
  // parent, so the fallback path is taken.
  // Cream highlights (#FCFCFE) stay constant across all states —
  // they're paper highlights, not brand color.

  const editorialNames = new Set(["due"]);
  const isEditorial = editorialNames.has(name);
  // Simple paths come in two coordinate systems. These are authored at
  // 24×24; every other simplePaths entry is 32×32. Used to pick the right
  // viewBox so the glyph centers correctly in the chip.
  const SIMPLE_24 = new Set(["check", "infinity"]);

  // Simple variants of editorial icons — single-color silhouettes for
  // compact contexts (composer chips at 14px) where the duotone interior
  // detail collapses into noise. Same 32×32 viewBox so dispatch logic
  // doesn't branch. Body only — no accent, no cream highlights.
  const simplePaths = {
    clients: (<>
      <circle cx="11" cy="12" r="4" fill={color}/>
      <circle cx="21" cy="12" r="3.5" fill={color} opacity="0.7"/>
      <path d="M3 27c0-4 3.6-7 8-7s8 3 8 7z" fill={color}/>
      <path d="M16 26c0-3.2 2.8-6 6.5-6s6.5 2.8 6.5 6z" fill={color} opacity="0.7"/>
    </>),
    workers: (<>
      <rect x="4" y="10" width="24" height="18" rx="2" fill={color}/>
      <path d="M10 4 Q16 8 22 4" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <rect x="14.5" y="6" width="3" height="3" rx="0.6" fill={color}/>
    </>),
    due: (<>
      <rect x="4" y="7" width="24" height="21" rx="3" fill={color}/>
      <line x1="10" y1="3" x2="10" y2="10" stroke={color} strokeWidth="2.4" strokeLinecap="round"/>
      <line x1="22" y1="3" x2="22" y2="10" stroke={color} strokeWidth="2.4" strokeLinecap="round"/>
    </>),
    today: (<>
      <rect x="4" y="7" width="24" height="21" rx="3" fill={color}/>
      <line x1="10" y1="3" x2="10" y2="10" stroke={color} strokeWidth="2.4" strokeLinecap="round"/>
      <line x1="22" y1="3" x2="22" y2="10" stroke={color} strokeWidth="2.4" strokeLinecap="round"/>
    </>),
    health: (<>
      <rect x="3" y="6" width="26" height="20" rx="3" fill={color}/>
      <path d="M6 19l3.5-3.5L13 19l4-6 4.5 7 3-4" stroke="var(--rt-icon-fill)" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </>),
    rai: (<>
      <path d="M4 9 Q4 5 8 5 L24 5 Q28 5 28 9 L28 20 Q28 24 24 24 L14 24 L9 28 L10 24 Q4 24 4 20 Z" fill={color}/>
    </>),
    rolodex: (<>
      <rect x="3" y="9" width="26" height="19" rx="2" fill={color}/>
      <rect x="13" y="5" width="6" height="6" rx="1" fill={color}/>
    </>),
    referrals: (<>
      <line x1="11" y1="16" x2="24" y2="6" stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
      <line x1="11" y1="16" x2="26" y2="16" stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
      <line x1="11" y1="16" x2="24" y2="26" stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
      <circle cx="25" cy="6" r="2.6" fill={color}/>
      <circle cx="27" cy="16" r="2.6" fill={color}/>
      <circle cx="25" cy="26" r="2.6" fill={color}/>
      <circle cx="10" cy="16" r="4.6" fill={color}/>
    </>),
    settings: (<>
      <path d="M16 3 L18 6.5 L22 5.5 L22.5 9.5 L26 11 L24.5 14.5 L27 17.5 L24 20 L24.5 24 L20.5 24.5 L18.5 28 L15 26 L11.5 28 L9.5 24.5 L5.5 24 L6 20 L3 17.5 L5.5 14.5 L4 11 L7.5 9.5 L8 5.5 L12 6.5 Z" fill={color}/>
    </>),
  };

  const paths = {
    today: (<>
      <g fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="5.6" width="16" height="14.4" rx="2.7"/>
        <path d="M8.5 3.3v4M15.5 3.3v4M4 10.1H20"/>
        <circle cx="8.8" cy="14.4" r="1.4" fill={color} stroke="none"/>
      </g>
    </>),
    clients: (<>
      <g fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9.3" cy="9.3" r="3.1"/>
        <path d="M3.7 19.5a5.6 5.6 0 0 1 11.2 0"/>
        <circle cx="16.7" cy="8.5" r="2.4"/>
        <path d="M16 13.5a4.9 4.9 0 0 1 4.3 6"/>
      </g>
    </>),
    health: (<>
      <path d="M12 19.6C12 19.6 3.6 14.8 3.6 9 3.6 6.4 5.6 4.5 8.1 4.5c1.7 0 3.2.9 3.9 2.3.7-1.4 2.2-2.3 3.9-2.3 2.5 0 4.5 1.9 4.5 4.5 0 5.8-8.4 10.6-8.4 10.6Z" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5.4 11.3h2.4l1.1-2.4 1.9 4.7 1.3-2.3h3.1" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    </>),
    rai: (<>
      <g fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2.6Q12.9 11.1 21.4 12Q12.9 12.9 12 21.4Q11.1 12.9 2.6 12Q11.1 11.1 12 2.6Z"/>
      </g>
    </>),
    rolodex: (<>
      <g fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 6V4.4M15 6V4.4"/>
        <circle cx="9" cy="3.6" r="0.95" fill={color} stroke="none"/>
        <circle cx="15" cy="3.6" r="0.95" fill={color} stroke="none"/>
        <rect x="3.6" y="6" width="16.8" height="13.2" rx="2.7"/>
        <circle cx="8.8" cy="12.3" r="2.2"/>
        <path d="M13 11H17.4M13 14H16"/>
      </g>
    </>),
    referrals: (<>
      <g fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6.4" cy="12" r="2.6"/>
        <circle cx="17.1" cy="6.2" r="2.6"/>
        <circle cx="17.1" cy="17.8" r="2.6"/>
        <path d="M8.7 10.7 14.8 7.4M8.7 13.3 14.8 16.6"/>
      </g>
    </>),
    workers: (<>
      <g fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.6" y="7.9" width="16.8" height="11.3" rx="2.7"/>
        <path d="M8.7 7.9V6.5a2.2 2.2 0 0 1 2.2-2.2h2.2a2.2 2.2 0 0 1 2.2 2.2v1.4"/>
        <path d="M3.6 13.1H20.4"/>
        <rect x="10.7" y="11.8" width="2.6" height="2.6" rx="0.8"/>
      </g>
    </>),
    user: (<><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round"/><circle cx="12" cy="7" r="4" stroke={color} strokeWidth="1.8" fill="none"/></>),
    settings: (<>
      <g fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19.11 9.05 L19.61 10.80 L21.58 10.48 L21.58 13.52 L19.61 13.20 L19.11 14.95 L18.23 16.53 L19.85 17.70 L17.70 19.85 L16.53 18.23 L14.95 19.11 L13.20 19.61 L13.52 21.58 L10.48 21.58 L10.80 19.61 L9.05 19.11 L7.47 18.23 L6.30 19.85 L4.15 17.70 L5.77 16.53 L4.89 14.95 L4.39 13.20 L2.42 13.52 L2.42 10.48 L4.39 10.80 L4.89 9.05 L5.77 7.47 L4.15 6.30 L6.30 4.15 L7.47 5.77 L9.05 4.89 L10.80 4.39 L10.48 2.42 L13.52 2.42 L13.20 4.39 L14.95 4.89 L16.53 5.77 L17.70 4.15 L19.85 6.30 L18.23 7.47 L19.11 9.05 Z"/>
        <circle cx="12" cy="12" r="3.2"/>
      </g>
    </>),
    due: (<>
      {/* Calendar widget header icon — primary-light body with dark
          binding tabs, a cream divider rule, a 4×2 grid of cream day
          dots, and a cream "today" pill in the bottom-right. Same
          color contract as the rest of the duotone icons (color = body,
          accent = tabs). Used only by the calendar widget header at
          TodayTimeline; renewal date picker uses the 'simple' variant
          which renders from simplePaths, not this. */}
      <path d="M4.5 10.5 Q4.5 6.5 8.5 6.5 L23.5 6.5 Q27.5 6.5 27.5 10.5 L27.5 24.5 Q27.5 28.5 23.5 28.5 L8.5 28.5 Q4.5 28.5 4.5 24.5 Z" fill={color}/>
      <rect x="9" y="3.5" width="2.2" height="5.5" rx="1.1" fill={accent}/>
      <rect x="20.8" y="3.5" width="2.2" height="5.5" rx="1.1" fill={accent}/>
      <line x1="4.5" y1="12.5" x2="27.5" y2="12.5" stroke="#FCFCFE" strokeWidth="1.6" opacity="0.45"/>
      <g fill="#FCFCFE">
        <circle cx="9" cy="17" r="1.4"/><circle cx="13.5" cy="17" r="1.4"/>
        <circle cx="18" cy="17" r="1.4"/><circle cx="22.5" cy="17" r="1.4"/>
        <circle cx="9" cy="21.5" r="1.4"/><circle cx="13.5" cy="21.5" r="1.4"/>
        <circle cx="18" cy="21.5" r="1.4"/><circle cx="22.5" cy="21.5" r="1.4"/>
        <circle cx="9" cy="26" r="1.4"/><circle cx="13.5" cy="26" r="1.4"/>
      </g>
      <rect x="16.4" y="24.6" width="7" height="2.8" rx="1.4" fill="#FCFCFE"/>
    </>),
    sweeps: (<><path d="M18 20V10M12 20V4M6 20v-6" stroke={color} strokeWidth="2" strokeLinecap="round"/></>),
    target: (<><circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.8" fill="none"/><circle cx="12" cy="12" r="6" stroke={color} strokeWidth="1.8" fill="none"/><circle cx="12" cy="12" r="2" fill={color}/></>),
    spark: (<><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z" stroke={color} strokeWidth="1.6" fill="none" strokeLinejoin="round"/></>),
    send: (<><line x1="22" y1="2" x2="11" y2="13" stroke={color} strokeWidth="2" strokeLinecap="round"/><polygon points="22 2 15 22 11 13 2 9 22 2" stroke={color} strokeWidth="1.8" fill="none" strokeLinejoin="round"/></>),
    more: (<><circle cx="12" cy="5" r="1.5" fill={color}/><circle cx="12" cy="12" r="1.5" fill={color}/><circle cx="12" cy="19" r="1.5" fill={color}/></>),
    chevron: (<><polyline points="9 18 15 12 9 6" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>),
    bento: (<><rect x="3" y="3" width="7" height="7" rx="1.5" fill={color}/><rect x="14" y="3" width="7" height="7" rx="1.5" fill={color}/><rect x="3" y="14" width="7" height="7" rx="1.5" fill={color}/><rect x="14" y="14" width="7" height="7" rx="1.5" fill={color}/></>),
    // heatmapGrid — 3×3 grid of cells at varying opacity, reads as a
    // heatmap. Uses the `color` prop and simple shapes so it sits in the
    // same minimal family as `sweeps` (Table) and `bento` (Columns) in
    // the Clients-page view toggle. The Health page's `health` icon is a
    // rich multi-color illustration meant for nav at large size — wrong
    // for a 14px toggle glyph, which is why this exists separately.
    heatmapGrid: (<>
      <rect x="3"  y="3"  width="5.5" height="5.5" rx="1" fill={color} opacity="0.35"/>
      <rect x="9.5" y="3"  width="5.5" height="5.5" rx="1" fill={color} opacity="0.7"/>
      <rect x="16" y="3"  width="5.5" height="5.5" rx="1" fill={color} opacity="0.5"/>
      <rect x="3"  y="9.5" width="5.5" height="5.5" rx="1" fill={color} opacity="0.7"/>
      <rect x="9.5" y="9.5" width="5.5" height="5.5" rx="1" fill={color} opacity="1"/>
      <rect x="16" y="9.5" width="5.5" height="5.5" rx="1" fill={color} opacity="0.35"/>
      <rect x="3"  y="16" width="5.5" height="5.5" rx="1" fill={color} opacity="0.5"/>
      <rect x="9.5" y="16" width="5.5" height="5.5" rx="1" fill={color} opacity="0.35"/>
      <rect x="16" y="16" width="5.5" height="5.5" rx="1" fill={color} opacity="0.7"/>
    </>),
    plus: (<><line x1="12" y1="5" x2="12" y2="19" stroke={color} strokeWidth="2" strokeLinecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round"/></>),
    check: (<><polyline points="20 6 9 17 4 12" stroke={color} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>),
    x: (<><line x1="18" y1="6" x2="6" y2="18" stroke={color} strokeWidth="2" strokeLinecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke={color} strokeWidth="2" strokeLinecap="round"/></>),
    phone: (<><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>),
    mail: (<><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke={color} strokeWidth="1.8" fill="none"/><polyline points="22,6 12,13 2,6" stroke={color} strokeWidth="1.8" fill="none"/></>),
    bolt: (<><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" stroke={color} strokeWidth="1.8" fill="none" strokeLinejoin="round"/></>),
    trendUp: (<><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/><polyline points="17 6 23 6 23 12" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>),
    clock: (<><circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.8" fill="none"/><polyline points="12 6 12 12 16 14" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round"/></>),
    infinity: (<><path d="M12 12c-2-2.67-4-4-6-4a4 4 0 100 8c2 0 4-1.33 6-4zm0 0c2 2.67 4 4 6 4a4 4 0 100-8c-2 0-4 1.33-6 4z" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>),
    sparkles: (<><path d="M12 3v3m0 12v3m-9-9H0m24 0h-3M5.5 5.5l2 2m9 9l2 2m-13 0l2-2m9-9l2-2" stroke={color} strokeWidth="1.6" strokeLinecap="round"/><circle cx="12" cy="12" r="3" fill={color}/></>),
    dot: (<><circle cx="12" cy="12" r="3" fill={color}/></>),
    flame: (<><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" stroke={color} strokeWidth="1.6" fill="none" strokeLinejoin="round"/></>),
    chat: (<><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={color} strokeWidth="1.8" fill="none" strokeLinejoin="round"/></>),
    mic: (<><rect x="9" y="2" width="6" height="12" rx="3" stroke={color} strokeWidth="1.8" fill="none"/><path d="M19 10v2a7 7 0 01-14 0v-2" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round"/><line x1="12" y1="19" x2="12" y2="23" stroke={color} strokeWidth="1.8" strokeLinecap="round"/></>),
    video: (<><polygon points="23 7 16 12 23 17 23 7" stroke={color} strokeWidth="1.8" fill="none" strokeLinejoin="round"/><rect x="1" y="5" width="15" height="14" rx="2" stroke={color} strokeWidth="1.8" fill="none"/></>),
    search: (<><circle cx="11" cy="11" r="8" stroke={color} strokeWidth="1.8" fill="none"/><line x1="21" y1="21" x2="16.65" y2="16.65" stroke={color} strokeWidth="1.8" strokeLinecap="round"/></>),
    image: (<><rect x="3" y="3" width="18" height="18" rx="2" stroke={color} strokeWidth="1.8" fill="none"/><circle cx="8.5" cy="8.5" r="1.5" fill={color}/><polyline points="21 15 16 10 5 21" stroke={color} strokeWidth="1.8" fill="none" strokeLinejoin="round"/></>),
    file: (<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={color} strokeWidth="1.8" fill="none" strokeLinejoin="round"/><polyline points="14 2 14 8 20 8" stroke={color} strokeWidth="1.8" fill="none" strokeLinejoin="round"/></>),
    star: (<><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke={color} strokeWidth="1.8" fill="none" strokeLinejoin="round"/></>),
    starFill: (<><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill={color} stroke={color} strokeWidth="1.8" strokeLinejoin="round"/></>),
    trash: (<><polyline points="3 6 5 6 21 6" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>),
    calendar: (<><rect x="3" y="4" width="18" height="18" rx="2" stroke={color} strokeWidth="1.8" fill="none"/><line x1="16" y1="2" x2="16" y2="6" stroke={color} strokeWidth="1.8" strokeLinecap="round"/><line x1="8" y1="2" x2="8" y2="6" stroke={color} strokeWidth="1.8" strokeLinecap="round"/><line x1="3" y1="10" x2="21" y2="10" stroke={color} strokeWidth="1.8"/></>),
    "chevron-up": (<><polyline points="18 15 12 9 6 15" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>),
    "chevron-down": (<><polyline points="6 9 12 15 18 9" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>),
    "chevron-right": (<><polyline points="9 18 15 12 9 6" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>),
  };


  return (
    <svg
      width={size}
      height={size}
      viewBox={
        (simple && simplePaths[name])
          // simplePaths are authored in two coordinate systems: check +
          // infinity at 24×24, all others at 32×32. Match each so the
          // glyph sits centered (regressed earlier when the nav-icon swap
          // pulled clients/workers out of editorialNames → they fell to the
          // 24 viewBox while their paths were 32-coords).
          ? (SIMPLE_24.has(name) ? "0 0 24 24" : "0 0 32 32")
          : (isEditorial ? "0 0 32 32" : "0 0 24 24")
      }
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {simple && simplePaths[name] ? simplePaths[name] : paths[name]}
    </svg>
  );
};


const ScoreRing = ({ score, size = 44, strokeWidth = 3.5 }) => {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = retColor(score);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} stroke={C.borderLight} strokeWidth={strokeWidth} fill="none" />
      <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={strokeWidth} fill="none" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: "stroke-dashoffset 0.6s ease" }} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central" style={{ fontSize: size * 0.32, fontWeight: 800, fill: color, fontFamily: "'Manrope', sans-serif" }}>{score}</text>
    </svg>
  );
};

export { Icon, ScoreRing };
