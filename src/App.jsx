import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { supabase } from "./lib/supabase";
import { clients as clientsDb, tasks as tasksDb, healthChecks as hcDb, rolodex as rolodexDb, referrals as referralsDb, raiConversations as convoDb, touchpoints as touchpointsDb, observations as observationsDb, daybook as daybookDb, profile as profileDb, workers as workersDb, raiUserState as raiUserStateDb, raiPicks as raiPicksDb, realtime as realtimeDb, revenueHistoryDb, clientBillingDb, clientBillingMonthStatusDb, clientBillingTermsDb, personalCalendar as personalCalendarDb, clientEngagementPausesDb } from "./lib/db";
import WorkerDashboard from "./WorkerDashboard";
// d3-force for the live, physics-driven referral network. We import only
// the force functions we use (not the full d3 bundle) — keeps the chunk
// small. simulation runs on mount, pauses when the page isn't focused,
// nodes drift naturally as users hover/drag.
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide,
  forceX as d3forceX,
  forceY as d3forceY,
} from "d3-force";

// ============================================================
// PALETTE
// ============================================================
// Surface tones (bg, card, text, borders) reference CSS variables,
// defined once at :root. Accent colors (purple, green, gold, danger)
// stay as hex.
//
// The CSS variable definitions live in a <style> block injected at App
// mount-time so they're available before any component reads them.
const C = {
  primary: "#33543E", primaryDeep: "#1C3224", primaryLight: "#558B68", primarySoft: "#E6EFE9", primaryGhost: "#F3F8F5",

  // Surfaces — themed
  bg: "var(--rt-bg)",
  card: "var(--rt-card)",
  surface: "var(--rt-surface)",
  surfaceWarm: "var(--rt-surface-warm)",
  deepCream: "var(--rt-deep-cream)",
  sidebar: "var(--rt-sidebar)",

  // Text — themed
  text: "var(--rt-text)",
  textSec: "var(--rt-text-sec)",
  textMuted: "var(--rt-text-muted)",
  ink500: "var(--rt-ink-500)", ink300: "var(--rt-ink-300)",

  // Borders — themed (mostly retired in favor of shadow surfaces, but
  // C.border/borderLight are still used for legitimate divider rules)
  border: "var(--rt-border)",
  borderLight: "var(--rt-border-light)",
  borderSoft: "var(--rt-border-soft)",

  // Rai chat hero gradient — only used on the empty-state chat surface
  raiGrad: "linear-gradient(145deg, #1E261F 0%, #33543E 55%, #558B68 100%)",

  // Accents — fixed
  danger: "#C4432B", warning: "#B88B15", success: "#2D8659",
  dangerSoft: "#FBE6DE",
  retCrit: "#B4341F", retWarn: "#D17A1B", retOk: "#A8A420", retGood: "#1F7A5C", retElite: "#0C3A2E",
  btn: "#5B21B6", btnHover: "#4C1D95", btnLight: "var(--rt-btn-light)",

};

// CSS variable definitions. Injected in the App component's
// style block so they're authoritative at the document root.
const THEME_CSS = `
  :root {
    --rt-bg: #FAFAF7;
    --rt-card: #FFFFFF;
    --rt-surface: #EEEFEB;
    --rt-surface-warm: #F2EEE8;
    --rt-deep-cream: #EAE4D6;
    --rt-sidebar: #F2EEE8;
    --rt-text: #1E261F;
    --rt-text-sec: #6B6B66;
    --rt-text-muted: #9A9A93;
    --rt-ink-500: #6B6B66;
    --rt-ink-300: #C4C4BD;
    --rt-border: #D8DFD8;
    --rt-border-light: #EFEFEA;
    --rt-border-soft: #EFEFEA;
    --rt-btn-light: #EDE4FA;
    /* ────────────── POLISH LAYER ──────────────
       Same palette, just enhanced with gradients, layered shadows for
       hover-lift, and a uniform motion curve. Applied across the Today
       page interactive surfaces. */
    --rt-grad-btn: linear-gradient(135deg, #6D2BD9 0%, #5B21B6 55%, #4C1D95 100%);
    --rt-grad-btn-hover: linear-gradient(135deg, #7B3AE0 0%, #6028C2 55%, #5421A8 100%);
    --rt-grad-green-deep: linear-gradient(135deg, #33543E 0%, #1C3224 100%);
    --rt-sh-xs: 0 1px 2px rgba(20,30,22,0.05);
    --rt-sh-row: 0 1px 2px rgba(20,30,22,0.04), 0 1px 6px rgba(20,30,22,0.025);
    --rt-sh-row-hover: 0 2px 4px rgba(20,30,22,0.05), 0 6px 16px rgba(20,30,22,0.06);
    --rt-sh-card: 0 1px 2px rgba(20,30,22,0.04), 0 1px 8px rgba(20,30,22,0.03);
    --rt-sh-card-hover: 0 2px 4px rgba(20,30,22,0.05), 0 8px 20px rgba(20,30,22,0.05);
    --rt-sh-purple: 0 0 0 1px rgba(91,33,182,0.10), 0 2px 8px rgba(91,33,182,0.20), 0 1px 2px rgba(91,33,182,0.10);
    --rt-sh-purple-hover: 0 0 0 1px rgba(91,33,182,0.22), 0 8px 22px rgba(91,33,182,0.34), 0 2px 4px rgba(91,33,182,0.16);
    --rt-sh-green-glow: 0 0 0 1px rgba(51,84,62,0.10), 0 2px 6px rgba(51,84,62,0.16);
    --rt-sh-chip-purple: 0 1px 2px rgba(91,33,182,0.12), 0 2px 6px rgba(91,33,182,0.08);
    /* Rai-territory gradient-halo shadow. Used on the armed Add Task
       button and the New Rai Chat button so they read as the inspiration's
       Ask AI pill: tight ambient + glowing purple bleed underneath. Halo
       reserved — applied sparingly so it stays meaningful. */
    --rt-sh-rai-pop: 0 1px 2px rgba(91,33,182,0.22), 0 6px 14px rgba(91,33,182,0.18), 0 14px 32px rgba(123,58,224,0.32);
    --rt-sh-rai-pop-hover: 0 2px 4px rgba(91,33,182,0.28), 0 8px 18px rgba(91,33,182,0.22), 0 18px 40px rgba(123,58,224,0.38);
    /* Card-lift shadow — the active sidebar nav rises above the substrate
       with a multi-stop drop, matching the inspiration's lifted-white-chip
       toolbar pattern. */
    --rt-sh-card-lift: 0 2px 4px rgba(20,30,22,0.06), 0 12px 28px rgba(20,30,22,0.08);
    --rt-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
    --rt-ease-press: cubic-bezier(0.4, 0, 0.6, 1);
    /* Cream highlight used inside duotone editorial icons (date dot,
       pulse line, screen face). Body + accent now flow from color /
       accent props at the call site. */
    --rt-icon-fill: #FCFCFE;
  }
  html, body {
    background: var(--rt-bg);
    /* Prevent mobile Safari/Chrome from auto-inflating text in narrow
       containers ("text autosizing"). Without this, task titles and other
       body text can render at headline-size on first paint until the page
       settles or refreshes. Setting to 100% locks the rendered size to
       what we declare in CSS, on every device. */
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
  }
`;

const Icon = ({ name, size = 18, color = "currentColor", accent = "#1C3224", simple = false }) => {
  // Editorial nav icons — 32x32 viewBox, multi-color (cream paper + ink stroke
  // + green accent). Color tokens come from CSS variables so they flip in dark
  // mode. The `color` prop is intentionally ignored for these icons — they
  // don't recolor on active state; the active state is signalled by the
  // surrounding row's background fill.
  const editorialNames = new Set(["today", "clients", "health", "rolodex", "referrals", "rai", "workers", "settings", "due"]);
  const isEditorial = editorialNames.has(name);

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
      {/* Duotone calendar — main body in `color`, top stripe in `accent`,
          cream date dot for interior highlight. 32×32 viewBox. */}
      <rect x="4" y="7" width="24" height="21" rx="3" fill={color}/>
      <rect x="4" y="7" width="24" height="6" rx="3" fill={accent}/>
      <rect x="4" y="10" width="24" height="3" fill={accent}/>
      <line x1="10" y1="4" x2="10" y2="10" stroke={accent} strokeWidth="2.4" strokeLinecap="round"/>
      <line x1="22" y1="4" x2="22" y2="10" stroke={accent} strokeWidth="2.4" strokeLinecap="round"/>
      <circle cx="16" cy="20" r="4" fill="var(--rt-icon-fill)" opacity="0.95"/>
    </>),
    clients: (<>
      {/* Duotone heads — three figures with the central one in accent.
          Center figure slightly elevated to read as the focused one. */}
      <circle cx="10" cy="13" r="4.5" fill={color}/>
      <circle cx="22" cy="13" r="3.8" fill={color} opacity="0.75"/>
      <path d="M2 28c0-4.4 3.6-8 8-8s8 3.6 8 8z" fill={color}/>
      <path d="M16 28c0-3.6 3.1-6.8 6.5-6.8s6.5 3.2 6.5 6.8z" fill={color} opacity="0.75"/>
      <circle cx="16" cy="11" r="5.5" fill={accent}/>
      <path d="M7 28c0-5 4-9 9-9s9 4 9 9z" fill={accent}/>
    </>),
    health: (<>
      {/* Duotone monitor — screen body in color, header bar in accent,
          pulse line in cream highlight. */}
      <rect x="3" y="6" width="26" height="20" rx="3" fill={color}/>
      <rect x="3" y="6" width="26" height="5" rx="3" fill={accent}/>
      <rect x="3" y="9" width="26" height="2" fill={accent}/>
      <path d="M6 19l3.5-3.5L13 19l4-6 4.5 7 3-4" stroke="var(--rt-icon-fill)" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="11" y="26" width="10" height="2" rx="1" fill={accent}/>
    </>),
    rai: (<>
      {/* Duotone speech bubble — body in color, spark/star in accent. */}
      <g transform="translate(0 1)">
        <path d="M4 9 Q4 5 8 5 L24 5 Q28 5 28 9 L28 20 Q28 24 24 24 L14 24 L9 28 L10 24 Q4 24 4 20 Z" fill={color}/>
        <path d="M16 9 L17.8 14.6 L23 16.4 L17.8 18.2 L16 24 L14.2 18.2 L9 16.4 L14.2 14.6 Z" fill={accent}/>
        <circle cx="23" cy="10" r="1.4" fill={accent} opacity="0.7"/>
      </g>
    </>),
    rolodex: (<>
      {/* Duotone Rolodex — base in accent, cards stack in color, top card
          highlighted with a cream tab. */}
      <rect x="2" y="23" width="28" height="5" rx="1.5" fill={accent}/>
      <rect x="4" y="9" width="24" height="15" rx="1.5" fill={color}/>
      <rect x="4" y="9" width="24" height="4" fill={accent}/>
      <rect x="13" y="5" width="6" height="6" rx="1" fill={accent}/>
      <path d="M10 15l3-3 3 3v8h-6z" fill="var(--rt-icon-fill)" opacity="0.95"/>
      <line x1="20" y1="16" x2="25" y2="16" stroke="var(--rt-icon-fill)" strokeWidth="1.6" strokeLinecap="round" opacity="0.85"/>
      <line x1="20" y1="19" x2="24" y2="19" stroke="var(--rt-icon-fill)" strokeWidth="1.6" strokeLinecap="round" opacity="0.6"/>
    </>),
    referrals: (<>
      {/* Duotone constellation — hub in accent, satellites in color,
          connecting threads at low opacity. */}
      <line x1="11" y1="16" x2="24" y2="6" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.55"/>
      <line x1="11" y1="16" x2="26" y2="16" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.55"/>
      <line x1="11" y1="16" x2="24" y2="26" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.55"/>
      <circle cx="25" cy="6" r="3" fill={color} opacity="0.75"/>
      <circle cx="27" cy="16" r="3" fill={color} opacity="0.75"/>
      <circle cx="25" cy="26" r="3" fill={color} opacity="0.75"/>
      <circle cx="10" cy="16" r="5.5" fill={accent}/>
      <circle cx="10" cy="16" r="2" fill="var(--rt-icon-fill)"/>
    </>),
    workers: (<>
      {/* Duotone team — desk + person seated.
          Desk surface = accent, person body = color, screen face = cream highlight. */}
      <path d="M9 4 Q16 8 23 4" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round"/>
      <rect x="14.5" y="5" width="3" height="3" rx="0.6" fill={accent}/>
      <rect x="5" y="9" width="22" height="20" rx="2.5" fill={color}/>
      <rect x="5" y="9" width="22" height="5" rx="2.5" fill={accent}/>
      <rect x="5" y="11" width="22" height="3" fill={accent}/>
      <rect x="8" y="16" width="9" height="10" rx="1" fill={accent}/>
      <circle cx="12.5" cy="20" r="1.8" fill="var(--rt-icon-fill)"/>
      <path d="M9.5 25.5 Q12.5 23.5 15.5 25.5" fill="var(--rt-icon-fill)" stroke="none"/>
      <line x1="19" y1="17" x2="25" y2="17" stroke="var(--rt-icon-fill)" strokeWidth="1.6" strokeLinecap="round" opacity="0.85"/>
      <line x1="19" y1="20" x2="24" y2="20" stroke="var(--rt-icon-fill)" strokeWidth="1.6" strokeLinecap="round" opacity="0.6"/>
      <line x1="19" y1="23" x2="24" y2="23" stroke="var(--rt-icon-fill)" strokeWidth="1.6" strokeLinecap="round" opacity="0.4"/>
    </>),
    user: (<><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round"/><circle cx="12" cy="7" r="4" stroke={color} strokeWidth="1.8" fill="none"/></>),
    settings: (<>
      {/* Duotone gear — outer cog in color, inner ring in accent, center cream. */}
      <path d="M16 3 L18 6.5 L22 5.5 L22.5 9.5 L26 11 L24.5 14.5 L27 17.5 L24 20 L24.5 24 L20.5 24.5 L18.5 28 L15 26 L11.5 28 L9.5 24.5 L5.5 24 L6 20 L3 17.5 L5.5 14.5 L4 11 L7.5 9.5 L8 5.5 L12 6.5 Z" fill={color}/>
      <circle cx="16" cy="16" r="6.5" fill={accent}/>
      <circle cx="16" cy="16" r="2.4" fill="var(--rt-icon-fill)"/>
    </>),
    due: (<>
      {/* Duotone overdue calendar — same as today but with a small clock badge. */}
      <rect x="3" y="6" width="24" height="22" rx="3" fill={color}/>
      <rect x="3" y="6" width="24" height="6" rx="3" fill={accent}/>
      <rect x="3" y="9" width="24" height="3" fill={accent}/>
      <line x1="9" y1="3" x2="9" y2="9" stroke={accent} strokeWidth="2.4" strokeLinecap="round"/>
      <line x1="21" y1="3" x2="21" y2="9" stroke={accent} strokeWidth="2.4" strokeLinecap="round"/>
      <g fill="var(--rt-icon-fill)" stroke="none" opacity="0.7">
        <circle cx="9" cy="17" r="1.2"/><circle cx="15" cy="17" r="1.2"/>
        <circle cx="9" cy="22" r="1.2"/>
      </g>
      <circle cx="22" cy="23" r="6" fill={accent}/>
      <line x1="22" y1="23" x2="22" y2="19.5" stroke="var(--rt-icon-fill)" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="22" y1="23" x2="25" y2="23" stroke="var(--rt-icon-fill)" strokeWidth="1.8" strokeLinecap="round"/>
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
      viewBox={isEditorial ? "0 0 32 32" : "0 0 24 24"}
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

const clientsBase = [
  { id: 1, name: "Northvane Studios", ret: 91, contact: "Sarah Chen", role: "Head of Marketing", months: 34, revenue: 6200, velocity: "fast", lastHC: "Mar 1", lastContact: "today", tag: "Creative", referrals: 2 },
  { id: 2, name: "Oakline Outdoors", ret: 82, contact: "James Park", role: "CMO", months: 18, revenue: 4200, velocity: "normal", lastHC: "Mar 5", lastContact: "2d ago", tag: "DTC", referrals: 0 },
  { id: 3, name: "Ridgeline Supply", ret: 73, contact: "Marcus Webb", role: "Founder & CEO", months: 11, revenue: 4900, velocity: "normal", lastHC: "Mar 15", lastContact: "3d ago", tag: "Ecommerce", referrals: 0 },
  { id: 4, name: "Broadleaf Media", ret: 67, contact: "Rachel Torres", role: "VP Marketing", months: 8, revenue: 7500, velocity: "normal", lastHC: "Mar 10", lastContact: "1d ago", tag: "Media", referrals: 0 },
  { id: 5, name: "Copper & Sage", ret: 55, contact: "Elena Moss", role: "Marketing Director", months: 6, revenue: 2800, velocity: "slowing", lastHC: "Mar 20", lastContact: "5d ago", tag: "Wellness", referrals: 0 },
  { id: 6, name: "Velvet & Co", ret: 44, contact: "Priya Sharma", role: "Brand Manager", months: 4, revenue: 3100, velocity: "slowing", lastHC: "Mar 22", lastContact: "8d ago", tag: "Fashion", referrals: 0 },
  { id: 7, name: "Foxglove Partners", ret: 38, contact: "Tom Aldrich", role: "Director of Ops", months: 3, revenue: 8200, velocity: "cold", lastHC: "Mar 18", lastContact: "14d ago", tag: "B2B", referrals: 0 },
  { id: 8, name: "Evergreen Games", ret: 18, contact: "Derek Holt", role: "VP of Growth", months: 5, revenue: 5800, velocity: "cold", lastHC: "Mar 15", lastContact: "11d ago", tag: "Gaming", referrals: 0 },
];

const healthQueue = [
  { client: "Copper & Sage", ret: 55, due: "Today", overdue: 0 },
  { client: "Velvet & Co", ret: 44, due: "Overdue", overdue: 5 },
  { client: "Foxglove Partners", ret: 38, due: "Overdue", overdue: 9 },
  { client: "Evergreen Games", ret: 18, due: "Overdue", overdue: 12 },
  { client: "Ridgeline Supply", ret: 73, due: "Apr 15", overdue: 0 },
  { client: "Broadleaf Media", ret: 67, due: "Apr 10", overdue: 0 },
  { client: "Oakline Outdoors", ret: 82, due: "Apr 5", overdue: 0 },
  { client: "Northvane Studios", ret: 91, due: "Apr 1", overdue: 0 },
];

const referralsData = [
  { from: "Northvane Studios", to: "Pinehill Collective", date: "Feb 15", converted: true, revenue: 3200 },
  { from: "Northvane Studios", to: "Driftwood Creative", date: "Nov 10", converted: true, revenue: 4100 },
  { from: "Oakline Outdoors", to: "Summit Gear Co", date: "Mar 20", converted: false, revenue: 0 },
];

// Enterprise Data
const enterpriseClients = clientsBase.map(c => ({
  ...c,
  enterprise: {
    automated_scores: {
      loyaltySignal: Math.round(c.ret * 0.08 + Math.random() * 2),
      trustLevel: Math.round(c.ret * 0.07 + Math.random() * 2),
      commFreq: c.velocity === "fast" ? 7 : c.velocity === "normal" ? 5 : c.velocity === "slowing" ? 3 : 2,
      stressResponse: 5 + Math.round((Math.random() - 0.5) * 4),
      expectLevel: 5 + Math.round((Math.random() - 0.5) * 4),
      reportNeed: Math.round(3 + Math.random() * 4),
      relationDepth: Math.round(c.months > 12 ? 7 + Math.random() * 2 : 4 + Math.random() * 3),
      commTone: Math.round(4 + Math.random() * 4),
      decisionSpeed: Math.round(4 + Math.random() * 4),
      feedbackStyle: Math.round(3 + Math.random() * 4),
      metricFocus: Math.round(5 + Math.random() * 4),
      changeAppetite: Math.round(3 + Math.random() * 4),
    },
    baseline_score: c.ret,
    prior_baseline: c.ret + Math.round((Math.random() - 0.4) * 6),
    drift: 0,
    confidence: c.months > 6 ? "high" : "medium",
    archetype: c.ret >= 80 ? null : c.ret >= 60 ? (c.velocity === "slowing" ? "slow_fade" : null) : c.velocity === "cold" ? "silent_exit" : c.ret < 40 ? "budget_squeeze" : "tone_shift",
    retention_outlook: c.ret >= 80 ? "long_term" : c.ret >= 65 ? "strong" : c.ret >= 50 ? "uncertain" : c.ret >= 30 ? "at_risk" : "critical",
    active_signals: [],
    rai_summary: "",
    score_history: Array.from({length: 7}, (_, i) => ({ date: `Apr ${9-i}`, score: c.ret + Math.round((Math.random()-0.5) * 4 * (i+1)/3) })),
    last_sweep: "2026-04-09T06:02:00Z",
  }
}));

// Add signals and summaries
enterpriseClients.forEach(c => {
  const e = c.enterprise;
  e.drift = e.baseline_score - e.prior_baseline;
  if (c.velocity === "cold") e.active_signals.push({ type: "warning", text: `No response in ${Math.round(5 + Math.random()*10)} days` });
  if (c.velocity === "slowing") e.active_signals.push({ type: "warning", text: "Response time increased 40% over 2 weeks" });
  if (c.ret < 50) e.active_signals.push({ type: "warning", text: "Communication frequency declining" });
  if (c.months >= 11 && c.months <= 13) e.active_signals.push({ type: "info", text: "Approaching 1-year anniversary" });
  if (c.ret >= 80) e.active_signals.push({ type: "positive", text: "Engagement strong across all channels" });
  
  const names = { "Northvane Studios": "Sarah", "Oakline Outdoors": "James", "Ridgeline Supply": "Marcus", "Broadleaf Media": "Rachel", "Copper & Sage": "Elena", "Velvet & Co": "Priya", "Foxglove Partners": "Tom", "Evergreen Games": "Derek" };
  const n = names[c.name] || c.contact.split(" ")[0];
  if (c.ret >= 80) e.rai_summary = `${n} is locked in. Strong trust signals, consistent communication. Keep doing what you're doing.`;
  else if (c.ret >= 60) e.rai_summary = `${n} is solid but watch the edges. ${c.velocity === "slowing" ? "Response patterns are shifting — could be seasonal or could be the start of something." : "No red flags yet, but don't coast."}`;
  else if (c.ret >= 40) e.rai_summary = `${n} is pulling back. ${c.velocity === "cold" ? "They've gone quiet — that's never just busy." : "The energy has shifted. This needs a direct conversation, not another email."}`;
  else e.rai_summary = `${n} is at real risk. Multiple signals converging. Call today — not email, not Slack. A real conversation.`;
});


// Referral Intelligence (Enterprise)
const referralReadiness = enterpriseClients.map(c => {
  const e = c.enterprise;
  const scores = e.automated_scores;
  const loyalty = (scores.loyaltySignal || 5) / 10;
  const trust = (scores.trustLevel || 5) / 10;
  const depth = (scores.relationDepth || 5) / 10;
  const readiness = (loyalty * 0.35) + (trust * 0.25) + (depth * 0.20) + (c.ret / 100 * 0.15) + (c.referrals > 0 ? 0.05 : 0);
  const reasons = [];
  if (loyalty >= 0.7) reasons.push("Strong loyalty signals");
  if (trust >= 0.7) reasons.push("High trust level");
  if (depth >= 0.7) reasons.push("Deep personal relationship");
  if (c.months >= 12) reasons.push("Long-standing partnership (" + c.months + " months)");
  if (c.referrals > 0) reasons.push("Has referred before (" + c.referrals + ")");
  if (c.ret >= 80) reasons.push("Excellent retention score");
  if (c.velocity === "fast") reasons.push("Highly engaged right now");
  
  const names = { "Northvane Studios": "Sarah", "Oakline Outdoors": "James", "Ridgeline Supply": "Marcus", "Broadleaf Media": "Rachel", "Copper & Sage": "Elena", "Velvet & Co": "Priya", "Foxglove Partners": "Tom", "Evergreen Games": "Derek" };
  const n = names[c.name] || c.contact.split(" ")[0];
  let approach = "";
  if (readiness >= 0.6) approach = `${n} trusts you and the relationship is deep enough to ask directly. Bring it up casually — "Know anyone who could use what we do?" works better than a formal ask.`;
  else if (readiness >= 0.4) approach = `${n} is getting there but the relationship needs more depth first. Focus on delivering a win this month, then revisit.`;
  else approach = `Not the right time. ${n} needs to feel more confident in the partnership before you ask for anything.`;
  
  return { ...c, readiness: Math.round(readiness * 100), reasons, approach, tier: readiness >= 0.6 ? "ready" : readiness >= 0.4 ? "building" : "not_yet" };
}).sort((a, b) => b.readiness - a.readiness);

const sweepData = {
  id: "sweep_20260409",
  timestamp: "2026-04-09T06:02:00Z",
  type: "daily",
  clients_analyzed: 8,
  alerts_count: 2,
  tasks_generated: 5,
  portfolio_avg_score: Math.round(clientsBase.reduce((a, c) => a + c.ret, 0) / clientsBase.length),
  prior_portfolio_avg: Math.round(clientsBase.reduce((a, c) => a + c.ret, 0) / clientsBase.length) - 2,
  score_distribution: {
    critical: clientsBase.filter(c => c.ret <= 30).length,
    at_risk: clientsBase.filter(c => c.ret > 30 && c.ret <= 50).length,
    watch: clientsBase.filter(c => c.ret > 50 && c.ret <= 65).length,
    stable: clientsBase.filter(c => c.ret > 65 && c.ret <= 80).length,
    strong: clientsBase.filter(c => c.ret > 80).length,
  },
};

const sweepHistory = [
  { date: "Apr 9", clients: 8, avg: 53, alerts: 2 },
  { date: "Apr 8", clients: 8, avg: 52, alerts: 1 },
  { date: "Apr 7", clients: 8, avg: 54, alerts: 0 },
  { date: "Apr 6", clients: 8, avg: 53, alerts: 1 },
  { date: "Apr 5", clients: 8, avg: 55, alerts: 3 },
  { date: "Apr 4", clients: 8, avg: 54, alerts: 0 },
  { date: "Apr 3", clients: 8, avg: 52, alerts: 1 },
];

const sweepTasks = [
  { id: "st1", client: "Foxglove Partners", signal: "Budget Squeeze + Stakeholder Shift", action: "Call Tom today. His boss was cc'd on the last two emails and he requested a performance summary — that's pre-churn behavior. Don't email. Call.", priority: "urgent", timeframe: "Today" },
  { id: "st2", client: "Evergreen Games", signal: "Silent Exit", action: "Derek hasn't responded in 11 days. Send a short, direct message: 'Hey — wanted to check in. Are we good?' Don't over-explain.", priority: "high", timeframe: "Today" },
  { id: "st3", client: "Copper & Sage", signal: "Slow Fade", action: "Elena's response times are creeping up. Schedule a strategy call — reframe the value before she starts shopping.", priority: "high", timeframe: "This week" },
  { id: "st4", client: "Ridgeline Supply", signal: "12-month approaching", action: "Marcus hits 12 months next month. Send a milestone note and open a conversation about next year's scope.", priority: "medium", timeframe: "This week" },
  { id: "st5", client: "Northvane Studios", signal: "Referral opportunity", action: "Sarah's engagement is at an all-time high. Ask about referrals — she's your strongest advocate.", priority: "medium", timeframe: "This month" },
];

// ============================================================
// OBSERVATION_ILLUSTRATIONS
// Maps observations.card_name → SVG asset URL.
// Files live in /public/observations/ (Vite serves /public at site
// root, so app.retayned.com/observations/22_the_rescue.svg). Bundled
// with each release — rollbacks roll illustrations back too.
//
// Lookup by card_name (immutable per archetype) rather than
// observation_number — the DB's number field is a sort order that has
// no relationship to the SVG filename's numeric prefix. The filename
// prefix is alphabetical-by-archetype-grouping from the design folder.
//
// Map keys are normalized: lowercase, single-spaced, no punctuation.
// The lookupObservationIllustration() helper normalizes the DB string
// the same way, so casing variants like "renewal with room" vs
// "Renewal With Room" both resolve correctly.
// ============================================================
const OBSERVATION_ILLUSTRATIONS = {
  "frequency mismatch":         "/observations/01_frequency_mismatch.svg",
  "depth mismatch":             "/observations/02_depth_mismatch.svg",
  "anniversary approaching":    "/observations/03_anniversary_approaching.svg",
  "slow decline":               "/observations/04_slow_decline.svg",
  "stale profile":              "/observations/05_stale_profile.svg",
  "expectations mismatch":      "/observations/06_expectations_mismatch.svg",
  "renewal ghost":              "/observations/07_renewal_ghost.svg",
  "long goodbye":               "/observations/08_long_goodbye.svg",
  "anniversary pileup":         "/observations/09_anniversary_pileup.svg",
  "renewal with room":          "/observations/10_renewal_with_room.svg",
  "forgotten addon":            "/observations/11_forgotten_addon.svg",
  "underbilled":                "/observations/12_underbilled.svg",
  "quiet compounder":           "/observations/13_quiet_compounder.svg",
  "advocate in waiting":        "/observations/14_advocate_in_waiting.svg",
  "referral source untapped":   "/observations/15_referral_source_untapped.svg",
  "discount habit":             "/observations/16_discount_habit.svg",
  "high tenure low touch":      "/observations/17_high_tenure_low_touch.svg",
  "thriving untouched":         "/observations/18_thriving_untouched.svg",
  "quiet loyal":                "/observations/19_quiet_loyal.svg",
  "long tenure plateau":        "/observations/20_long_tenure_plateau.svg",
  "the favorite":               "/observations/21_the_favorite.svg",
  "the rescue":                 "/observations/22_the_rescue.svg",
  "the autopilot":              "/observations/23_the_autopilot.svg",
  "self cluster":               "/observations/24_self_cluster.svg",
  "reverse pareto":             "/observations/25_reverse_pareto.svg",
  "client task disproportion":  "/observations/26_client_task_disproportion.svg",
  "concentration cliff":        "/observations/27_concentration_cliff.svg",
  "hours sink":                 "/observations/28_hours_sink.svg",
  "rate compression":           "/observations/29_rate_compression.svg",
  "pipeline drought":           "/observations/30_pipeline_drought.svg",
  "the composition":            "/observations/31_the_composition.svg",
  "cadence mirror":             "/observations/32_cadence_mirror.svg",
  "tenure map":                 "/observations/33_tenure_map.svg",
  "drift census":               "/observations/34_drift_census.svg",
};

// Normalize a card_name for lookup: lowercase, strip non-alphanumeric
// to spaces, collapse whitespace. Lets "The Rescue", "the rescue",
// "Renewal With Room" vs "Renewal with Room", "Forgotten Add-on" vs
// "Forgotten Addon" all resolve to the same key.
function lookupObservationIllustration(cardName) {
  if (!cardName) return null;
  const key = String(cardName).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return OBSERVATION_ILLUSTRATIONS[key] || null;
}

// ============================================================
// Avatar initials helpers
// ============================================================
// Two rules, applied consistently across the app:
//
// USER ("Just me", sidebar profile pill, etc) → ONE letter.
//   - First letter of full_name if available.
//   - Else first letter of the email's local part.
//   - Else "U".
//
// WORKERS → TWO letters.
//   - Multi-word names ("John Smith") → first letter of first +
//     first letter of last word: "JS".
//   - Single-word names ("Sarah") → first two letters of the
//     word: "SA". Always two letters when possible.
//
// Keeps avatar visual rhythm consistent — user is always a single
// glyph, workers are always two — so the eye can tell them apart
// at a glance in the worker-picker dropdown.

function getUserInitial(user) {
  const n = user?.user_metadata?.full_name;
  if (n && n.trim().length > 0) return n.trim()[0].toUpperCase();
  const email = user?.email;
  if (email && email.length > 0) return email[0].toUpperCase();
  return "U";
}

function getWorkerInitials(name) {
  if (!name || typeof name !== "string") return "??";
  const trimmed = name.trim();
  if (trimmed.length === 0) return "??";
  const parts = trimmed.split(/\s+/).filter(p => p.length > 0);
  if (parts.length >= 2) {
    // Multi-word — first letter of first word + first letter of LAST word.
    // "John Smith" → "JS"; "John Quincy Adams" → "JA".
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  // Single-word — first two letters of the only word.
  // "Sarah" → "SA"; "Mike" → "MI"; "A" → "A" (degenerate single char).
  return parts[0].slice(0, 2).toUpperCase();
}

function retColor(v) {
  if (v >= 80) return "#0C3A2E";      // Elite (retElite)
  if (v >= 65) return "#1F7A5C";      // Good (retGood)
  if (v >= 45) return "#A8A420";      // Ok / Watch (retOk)
  if (v >= 30) return "#D17A1B";      // Warn / At Risk (retWarn)
  return "#B4341F";                    // Critical (retCrit)
}

// Whitelist of verbs that signal a thinking/planning task — i.e. one
// where the user is pausing to deliberate, not executing. When a task
// matches one of these (and has a client tag), we surface a "Discuss
// with Rai" affordance to open Confidant preloaded with that client.
//
// Strict whitelist by design. Adding verbs is cheap; removing them is
// painful once users get used to the affordance. Start small, expand
// based on what users actually type.
//
// EXCLUDED on purpose: draft, write, send, email, call, text, follow up,
// finish, complete, do — these are execution verbs, not thinking verbs.
const THINKING_VERBS = [
  "decide", "figure out", "plan", "prep", "think through",
  "strategize", "approach", "review", "read", "check",
  "analyze", "assess", "evaluate",
];

// Detect whether a task's text begins with (or prominently contains) a
// thinking verb. Word-boundary aware so "preparation" doesn't match "prep"
// in a way that fires for unrelated text. Lowercases input for matching.
// Returns the matched verb (string) or null.
function detectThinkingVerb(text) {
  if (!text) return null;
  const lc = String(text).toLowerCase();
  for (const v of THINKING_VERBS) {
    // Multi-word verbs: simple substring check is fine ("think through")
    if (v.includes(" ")) {
      if (lc.includes(v)) return v;
    } else {
      // Single-word verbs: word-boundary regex to avoid "review" matching "reviewed"
      // ... actually we want "reviewed" too (still a review action), so use
      // start-of-word boundary only.
      const re = new RegExp(`\\b${v}`, "i");
      if (re.test(lc)) return v;
    }
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────
// SMART COMPOSER PARSER
//
// Reads a free-form task sentence and infers:
//   - which client it's about    (fuzzy match against client names)
//   - which worker is assigned   (fuzzy match against worker names; null = self)
//   - which date it falls on     (today / tomorrow / weekday names / "later" / "in N days")
//
// Key data assumption: clients are companies (multi-word, capitalized), workers
// are humans (single first name). The parser exploits this — workers must match
// a human first name from the workersList; clients match anywhere else.
//
// "later" → today + 6 days (intentionally — leaves a day before next meeting)
//
// The parser also returns the cleaned title (with matched words stripped) and
// span ranges so the input field can highlight matches inline as the user types.
// ────────────────────────────────────────────────────────────────────

function escapeRegexChars(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function addDays(d, n) {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

// Returns today's calendar date at noon local. Used by parseComposer so
// natural-language dates like "tomorrow" or "in 3 days" resolve against
// the same day boundary the UI uses (midnight local rollover).
function todayAnchored() {
  const d = new Date();
  // Reset time-of-day to start of day so addDays() math is clean
  d.setHours(12, 0, 0, 0);
  return d;
}

// Convert a Date to a YYYY-MM-DD string using LOCAL timezone.
// CRITICAL: `new Date().toISOString().slice(0,10)` returns UTC date, which
// flips a day early/late at edge hours (e.g. 11pm MST = 6am UTC tomorrow).
// Use this anywhere a "today" string anchors task or sweep queries.
function localYmd(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ─────────────────────────────────────────────────────────────
// TZ-AWARE MIDNIGHT (post-May-2026 fix)
//
// Background: previously, the frontend used `setHours(0,0,0,0)` for the
// midnight rollover cutoff and the recurring-task reset cutoff. That
// reads the BROWSER's wall clock, which can drift from the user's stored
// `profiles.timezone` — e.g. Chrome holding a stale resolvedOptions TZ
// after macOS changes its clock. Drift caused the recurring-task reset
// to fire at the wrong time (22:00 MDT instead of 00:00 MDT) and reset
// completed recurring tasks back to un-done.
//
// These helpers anchor to a passed-in IANA TZ (canonically the user's
// `profiles.timezone`), independent of whatever the browser thinks.
// ─────────────────────────────────────────────────────────────

// Minutes that local-tz is AHEAD of UTC at the given instant.
// e.g. America/Denver in MDT → -360 (six hours behind UTC).
// Handles DST automatically because we ask Intl for the offset AT a
// specific instant, not in the abstract.
function tzOffsetMinutes(tz, atDate) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(atDate);
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  // Some engines emit "24" for midnight under hour12:false. Coerce.
  const h = parseInt(p.hour, 10) % 24;
  const localAsUtc = Date.UTC(+p.year, +p.month - 1, +p.day, h, +p.minute, +p.second);
  return Math.round((localAsUtc - atDate.getTime()) / 60000);
}

// UTC instant for local midnight in `tz`, `daysAhead` from the local day
// containing `atDate`.
//   daysAhead = 0 → most recent local midnight (already passed, today's start)
//   daysAhead = 1 → upcoming local midnight (tomorrow's start)
// DST-safe: refines the offset using the offset AT the candidate instant
// so the 23-hour and 25-hour DST-transition days resolve correctly.
function tzMidnightInstant(tz, atDate = new Date(), daysAhead = 0) {
  const offsetMin = tzOffsetMinutes(tz, atDate);
  const localMs = atDate.getTime() + offsetMin * 60000;
  const localMidnightMs = Math.floor(localMs / 86400000) * 86400000 + daysAhead * 86400000;
  let candidateUtcMs = localMidnightMs - offsetMin * 60000;
  const candidateOffset = tzOffsetMinutes(tz, new Date(candidateUtcMs));
  if (candidateOffset !== offsetMin) {
    candidateUtcMs = localMidnightMs - candidateOffset * 60000;
  }
  return candidateUtcMs;
}

// ============================================================
// Skeleton loaders — row-shaped placeholders for initial load
// ============================================================
// Used while `dataLoaded` is false. Each variant mirrors the geometry
// of the rows it stands in for, so when real data arrives the layout
// doesn't shift.
// ============================================================

function SkeletonTaskList({ rows = 4 }) {
  const widths = ["78%", "65%", "45%", "70%", "55%", "82%"];
  return (
    <div style={{ background: "#fff", border: "1px solid #EFEFEA", borderRadius: 12, overflow: "hidden" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 16px",
          borderBottom: i < rows - 1 ? "1px solid #EFEFEA" : "none",
        }}>
          <span className="rt-sk" style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="rt-sk" style={{ height: 13, width: widths[i % widths.length] }} />
            <div style={{ display: "flex", gap: 6 }}>
              <span className="rt-sk" style={{ height: 10, width: 48, borderRadius: 3 }} />
              <span className="rt-sk" style={{ height: 10, width: 72, borderRadius: 3 }} />
            </div>
          </div>
          <span className="rt-sk" style={{ width: 28, height: 16, borderRadius: 4, flexShrink: 0 }} />
        </div>
      ))}
    </div>
  );
}

function SkeletonClientList({ rows = 5 }) {
  const widths = ["55%", "42%", "62%", "48%", "58%", "50%"];
  return (
    <div style={{ background: "#fff", border: "1px solid #EFEFEA", borderRadius: 12, overflow: "hidden" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 14px",
          borderBottom: i < rows - 1 ? "1px solid #EFEFEA" : "none",
        }}>
          <span className="rt-sk" style={{ width: 32, height: 32, borderRadius: 16, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="rt-sk" style={{ height: 13, width: widths[i % widths.length] }} />
            <span className="rt-sk" style={{ height: 10, width: "32%" }} />
          </div>
          <span className="rt-sk" style={{ height: 11, width: 70, flexShrink: 0 }} />
          <span className="rt-sk" style={{ width: 36, height: 20, borderRadius: 5, flexShrink: 0 }} />
        </div>
      ))}
    </div>
  );
}

function SkeletonHealthQueue({ rows = 3 }) {
  const widths = ["50%", "42%", "58%"];
  const subWidths = ["38%", "32%", "40%"];
  return (
    <div style={{ background: "#fff", border: "1px solid #EFEFEA", borderRadius: 12, overflow: "hidden" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "14px 16px",
          borderBottom: i < rows - 1 ? "1px solid #EFEFEA" : "none",
        }}>
          <span className="rt-sk" style={{ width: 40, height: 40, borderRadius: 20, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="rt-sk" style={{ height: 14, width: widths[i % widths.length] }} />
            <span className="rt-sk" style={{ height: 11, width: subWidths[i % subWidths.length] }} />
          </div>
          <span className="rt-sk" style={{ width: 80, height: 28, borderRadius: 7, flexShrink: 0 }} />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon, headline, body, cta, secondaryCta }) {
  return (
    <div style={{
      background: "#FFFFFF",
      border: "1px solid #EFEFEA",
      borderRadius: 12,
      padding: "56px 24px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      minHeight: 220,
    }}>
      {icon && EMPTY_STATE_ICONS[icon] && (
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          background: "#E6EFE9",
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 18,
        }}>
          {EMPTY_STATE_ICONS[icon]}
        </div>
      )}
      <h2 style={{
        fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em",
        margin: "0 0 8px", color: "#1E261F",
      }}>{headline}</h2>
      <p style={{
        fontSize: 14, lineHeight: 1.55,
        color: "#6B6B66", margin: 0, maxWidth: 380,
      }}>{body}</p>
      {(cta || secondaryCta) && (
        <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap", justifyContent: "center" }}>
          {cta && (
            <button
              className="r-btn" data-tone="purple"
              onClick={cta.onClick}
              style={{
                padding: "9px 16px", background: "#5B21B6", color: "#fff",
                border: "none", borderRadius: 8,
                fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >{cta.label}</button>
          )}
          {secondaryCta && (
            <button
              onClick={secondaryCta.onClick}
              style={{
                padding: "9px 16px", background: "transparent", color: "#33543E",
                border: "1px solid rgba(51,84,62,0.27)", borderRadius: 8,
                fontSize: 13, fontWeight: 500,
                cursor: "pointer", fontFamily: "inherit",
                transition: "background 120ms ease, border-color 120ms ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(51,84,62,0.06)"; e.currentTarget.style.borderColor = "rgba(51,84,62,0.55)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(51,84,62,0.27)"; }}
            >{secondaryCta.label}</button>
          )}
        </div>
      )}
    </div>
  );
}

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
// `fromDate` is the day boundary anchor (the app's 2am-adjusted "today").
// `includeToday`:
//   - true  → if the pattern matches `fromDate` itself, return fromDate.
//             Used for OPEN recurring tasks: a task due today buckets today.
//   - false → start scanning from tomorrow. Used for tasks already
//             COMPLETED today — we don't want a just-finished daily task
//             to immediately re-surface; it stays in today's completed
//             section and the 2am reset brings it back. (bucketOf never
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

// ─── Composer lexicon dictionaries ──────────────────────────────────────
// Used by parseComposer's normalization phase to fix common typos and
// auto-cap industry acronyms / proper nouns. Small lists by design — the
// goal is to handle the 90% of cases users actually hit, not be a
// comprehensive spellchecker.

// Common typo → canonical mapping. Run BEFORE matching; preserves the
// user's intent while cleaning the rendered title.
const COMPOSER_TYPO_DICT = {
  "teh": "the", "thte": "the", "hte": "the",
  "adn": "and", "nad": "and",
  "thier": "their", "recieve": "receive", "recieved": "received",
  "becuase": "because", "occured": "occurred",
  "seperate": "separate", "definately": "definitely",
  "wiht": "with", "wtih": "with", "fro": "for",
};

// Lowercase token → canonical-cased version. Applied BOTH inside matched
// client/worker spans (no — those use the matched name) AND in the cleaned
// title remainder. So "google ads roas review" → "Google Ads ROAS review".
// Pure-acronym entries (all caps) are uppercase; proper-noun entries are
// title-case. Extend this list freely as you notice cases worth boosting.
const COMPOSER_CASING_DICT = {
  // Marketing acronyms
  "roas": "ROAS", "cpa": "CPA", "ctr": "CTR", "cpm": "CPM",
  "cpc": "CPC", "kpi": "KPI", "kpis": "KPIs",
  "aov": "AOV", "ltv": "LTV", "cac": "CAC", "mrr": "MRR", "arr": "ARR",
  "qbr": "QBR", "sla": "SLA", "nps": "NPS",
  // Time / business shorthand
  "eod": "EOD", "eom": "EOM", "eoq": "EOQ", "eoy": "EOY",
  "q1": "Q1", "q2": "Q2", "q3": "Q3", "q4": "Q4",
  "p&l": "P&L", "b2b": "B2B", "b2c": "B2C",
  // Tech acronyms
  "ai": "AI", "llm": "LLM", "mcp": "MCP", "api": "API",
  "sdk": "SDK", "ui": "UI", "ux": "UX", "url": "URL",
  "seo": "SEO", "sem": "SEM", "cms": "CMS", "crm": "CRM",
  "saas": "SaaS", "ios": "iOS", "id": "ID",
  // Roles
  "ceo": "CEO", "cfo": "CFO", "cmo": "CMO", "coo": "COO",
  "cto": "CTO", "vp": "VP", "hr": "HR", "pr": "PR",
  // Major proper nouns (consumer-facing companies / platforms)
  "google": "Google", "meta": "Meta", "facebook": "Facebook",
  "instagram": "Instagram", "tiktok": "TikTok", "youtube": "YouTube",
  "linkedin": "LinkedIn", "twitter": "Twitter", "x": "X",
  "snapchat": "Snapchat", "pinterest": "Pinterest", "reddit": "Reddit",
  "slack": "Slack", "gmail": "Gmail", "outlook": "Outlook",
  "zoom": "Zoom", "teams": "Teams",
  "claude": "Claude", "openai": "OpenAI", "anthropic": "Anthropic",
  "chatgpt": "ChatGPT", "gpt": "GPT",
  "microsoft": "Microsoft", "apple": "Apple", "amazon": "Amazon",
  "shopify": "Shopify", "stripe": "Stripe", "paypal": "PayPal",
  "hubspot": "HubSpot", "salesforce": "Salesforce",
  "mailchimp": "Mailchimp", "klaviyo": "Klaviyo",
  "figma": "Figma", "notion": "Notion", "airtable": "Airtable",
  "monday": "Monday", "asana": "Asana", "trello": "Trello",
  "github": "GitHub", "gitlab": "GitLab",
};

// Multi-word trailing phrases to strip from the cleaned title when a
// match span ate the noun they were referring to. Single words handled
// in the per-word strip pass after this.
const TRAILING_PHRASE_REGEX =
  /\s+(?:on behalf of|in regards? to|with respect to|in light of|in terms of|due to|because of|prior to|relative to|as opposed to)\s*[.,;:]?\s*$/i;

// Single trailing prepositions to strip. Order matters less here — repeated
// strip pass below handles cascading. Includes both core ("for", "with") and
// the previously-missing ones ("at", "from", "about", "regarding", etc).
const TRAILING_PREP_REGEX =
  /\s+(?:for|with|by|to|at|from|about|regarding|re|vs|against|on|of|over|under|via|per|toward|towards)\s*[.,;:]?\s*$/i;

// Compute initials for a multi-word client name, skipping articles / stop
// words. "The Motley Fool" → "TMF" (or "MF" without the article). "Matte
// Collection" → "MC". Single-word names → null (don't have abbreviations).
const COMPOSER_STOP_WORDS = new Set(["the", "a", "an", "and", "of", "&", "for", "to"]);

// Common English words that ALSO appear as tokens in multi-word client names
// ("Backyard Discovery", "Initech", "Final Group"). Without this blocklist,
// the score-90 single-token rule turns every task containing "discovery"
// into a phantom match against Backyard Discovery — same for "initial",
// "final", "weekly", and dozens more.
//
// Effect: users referencing a multi-word client by ONLY its common-word
// token will no longer match. They must use the full name or an
// abbreviation. The standalone-name (score 100) path is unaffected — a
// client literally named "Range" still matches the word "range" because
// it's the full client name, not just a token within one.
//
// Heuristic for additions: words an agency operator would type in normal
// task text. Keep aggressive — the cost of a false negative (user sees
// no client matched, can fix in UI) is far smaller than a false positive
// (silent data corruption, task attached to wrong client).
const COMPOSER_COMMON_WORDS = new Set([
  // Adjectives often used as qualifiers
  "final", "initial", "monthly", "weekly", "daily", "quarterly", "annual",
  "first", "second", "third", "last", "latest", "next", "previous",
  "new", "old", "draft", "rough", "polished", "preliminary",
  // Common nouns in task text
  "discovery", "review", "audit", "report", "summary", "analysis",
  "research", "study", "test", "tests", "testing", "results",
  "update", "updates", "kickoff", "intake", "launch", "release",
  "renewal", "contract", "invoice", "proposal", "agenda", "notes",
  "meeting", "call", "calls", "email", "emails", "message",
  "feedback", "approval", "approvals", "estimate", "estimates",
  "creative", "campaign", "campaigns", "performance", "tracking",
  "client", "clients", "team", "teams", "project", "projects",
  // Verbs that double as nouns
  "approve", "send", "receive", "deliver", "deploy", "ship",
  "build", "design", "develop",
  // Time-y words
  "today", "tomorrow", "yesterday", "later", "now", "soon",
  "monday", "tuesday", "wednesday", "thursday", "friday",
  "saturday", "sunday", "morning", "afternoon", "evening", "night",
  // Range / distance / scope
  "range", "scope", "size", "level",
  // Marketing / agency vocabulary
  "brand", "branding", "post", "posts", "content", "social",
  "ads", "ad", "media", "image", "video", "copy", "page", "pages",
  "data", "analytics", "metric", "metrics", "channel", "channels",
]);

function computeAbbreviations(name) {
  const tokens = name.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return [];
  const abbrevs = [];
  // Full initials (TMF for "The Motley Fool", MC for "Matte Collection")
  const fullInitials = tokens.map(t => t.charAt(0).toUpperCase()).join("");
  if (fullInitials.length >= 2) abbrevs.push(fullInitials);
  // Initials excluding stop words (MF for "The Motley Fool")
  const meaningful = tokens.filter(t => !COMPOSER_STOP_WORDS.has(t.toLowerCase()));
  if (meaningful.length >= 2 && meaningful.length !== tokens.length) {
    const meaningfulInitials = meaningful.map(t => t.charAt(0).toUpperCase()).join("");
    if (meaningfulInitials.length >= 2 && !abbrevs.includes(meaningfulInitials)) {
      abbrevs.push(meaningfulInitials);
    }
  }
  // For 3+ initial abbreviations, also include the first 2-letter prefix.
  // ("The Motley Fool" → TMF → also TM. Users abbreviate organically; not
  // everyone hits all initials.) Only the first prefix; we don't want to
  // sprinkle every 2-letter combo.
  if (fullInitials.length >= 3) {
    const prefix = fullInitials.slice(0, 2);
    if (!abbrevs.includes(prefix)) abbrevs.push(prefix);
  }
  return abbrevs;
}

// Apply typo + casing dictionaries to a string. Preserves user's existing
// capitalization (only autocaps lowercase words found in the dict).
// Returns the normalized string AND a list of replacements made (for span
// adjustment if needed — currently unused but available).
function normalizeComposerText(input) {
  let out = input;
  // Typo pass: case-preserving replacement (capital input → capital output)
  out = out.replace(/\b([a-zA-Z]+)\b/g, (match) => {
    const lower = match.toLowerCase();
    const fix = COMPOSER_TYPO_DICT[lower];
    if (!fix) return match;
    // Preserve capitalization: if original was Title-cased, capitalize fix
    if (match[0] === match[0].toUpperCase() && match.slice(1) === match.slice(1).toLowerCase()) {
      return fix.charAt(0).toUpperCase() + fix.slice(1);
    }
    if (match === match.toUpperCase()) return fix.toUpperCase();
    return fix;
  });
  // Casing pass: only auto-cap when user typed in lowercase. If they typed
  // it capitalized already (proper noun start of sentence, etc), leave alone.
  out = out.replace(/\b([a-z][a-zA-Z0-9&]*)\b/g, (match) => {
    const canonical = COMPOSER_CASING_DICT[match.toLowerCase()];
    if (!canonical) return match;
    // Only replace when user's input is fully lowercase (clear intent to autocap)
    if (match === match.toLowerCase()) return canonical;
    return match;
  });
  return out;
}

function parseComposer(rawText, clients, workers) {
  // ─── Phase 1: Lexicon normalization ──────────────────────────────────
  // Apply typo and casing dictionaries to the raw input BEFORE matching.
  // This means "teh" becomes "the", "google" becomes "Google", and so on,
  // throughout the rendered title — no special-casing needed downstream.
  //
  // Collapse all whitespace runs (tabs, newlines, multi-space, nbsp) to
  // single spaces. The date and recurrence regexes use literal single
  // spaces between words ("every monday", "in 3 days") — pasted content
  // from email or Slack containing &nbsp; or tab characters would
  // otherwise silently fall through every pattern.
  const text = normalizeComposerText(rawText || "").replace(/\s+/g, " ");
  const lower = text.toLowerCase();
  const matches = []; // {start, end, kind: 'client'|'worker'|'date'}

  // ─── Phase 2: Client matching (layered priority) ─────────────────────
  // Priority order: full name > full token > abbreviation > prefix-typo.
  // Each candidate stops at first hit; first client wins on ties.
  let matchedClient = null;
  let clientMatchSpan = null;
  if (clients && clients.length > 0) {
    // Skip clients with empty or whitespace-only names. An empty name
    // would compile to an empty regex that matches every input at index
    // 0, hijacking matchedClient. Defensive guard for partially-saved
    // CSV imports or accidentally-blank client rows.
    const validClients = clients.filter(c => c && c.name && c.name.trim());
    const sortedClients = [...validClients].sort((a, b) => b.name.length - a.name.length);

    // Build the ranked candidate list per client. Higher score wins overall.
    // We collect ALL candidate matches across clients and pick the best.
    const allCandidates = []; // {client, score, start, end}

    for (const c of sortedClients) {
      // 100 — exact full-name (case-insensitive substring with word boundaries)
      const fullRe = new RegExp(
        `(?<=^|[^\\p{L}\\p{N}])${escapeRegexChars(c.name.toLowerCase())}(?:'s)?(?=[^\\p{L}\\p{N}]|$)`,
        "iu"
      );
      const fullM = lower.match(fullRe);
      if (fullM && fullM.index !== undefined) {
        allCandidates.push({ client: c, score: 100, start: fullM.index, end: fullM.index + fullM[0].length });
        continue; // best possible — skip lower-priority candidates for this client
      }

      // 90 — meaningful single-token match ("Motley", "Fool", "Matte")
      const tokens = c.name.split(/\s+/);
      let tokenHit = null;
      for (const tok of tokens) {
        const clean = tok.replace(/[^\w]/g, "").toLowerCase();
        // Skip tokens that are common English words. Otherwise "discovery"
        // in any task text matches "Backyard Discovery", "review" matches
        // any multi-word client containing the word "review", etc. The
        // standalone-name (score-100) path is unaffected — a client whose
        // FULL name is one of these common words still matches via that
        // route. Only the multi-word-via-single-token path is gated.
        if (clean.length >= 4
            && !COMPOSER_STOP_WORDS.has(clean)
            && !COMPOSER_COMMON_WORDS.has(clean)) {
          const re = new RegExp(
            `(?<=^|[^\\p{L}\\p{N}])${escapeRegexChars(clean)}(?:'s)?(?=[^\\p{L}\\p{N}]|$)`,
            "iu"
          );
          const m = lower.match(re);
          if (m && m.index !== undefined) {
            tokenHit = { client: c, score: 90, start: m.index, end: m.index + m[0].length };
            break;
          }
        }
      }
      if (tokenHit) {
        allCandidates.push(tokenHit);
        continue;
      }

      // 80 — abbreviation match. Two-letter abbreviations ("MC", "TM")
      // require uppercase to avoid colliding with English words that happen
      // to share initials (mc → emcee/mac, tm → trademark). Three-or-more
      // letter abbreviations ("TMF", "WMP", "BYD") match case-insensitively
      // because the collision risk is vanishingly low — no common English
      // words look like all-consonant 3-letter strings.
      const abbrevs = computeAbbreviations(c.name);
      let abbrevHit = null;
      for (const ab of abbrevs) {
        const flags = ab.length >= 3 ? "i" : "";
        const re = new RegExp(`\\b${escapeRegexChars(ab)}\\b`, flags);
        const m = text.match(re);
        if (m && m.index !== undefined) {
          abbrevHit = { client: c, score: 80, start: m.index, end: m.index + m[0].length };
          break;
        }
      }
      if (abbrevHit) {
        allCandidates.push(abbrevHit);
        continue;
      }

      // 70 — prefix-typo match. Catches "whitemou" → "White Mountain Puzzles"
      // and similar truncated/typo'd attempts at a multi-word client name.
      // Strategy: look at each meaningful token in the user's input that's
      // ≥ 4 chars long, and check whether it begins with the first 4+ chars
      // of any meaningful client token. Length must be ≥ 4 AND ≥ 60% of the
      // matched client token to avoid over-eager matches.
      // We tokenize the lowered text by word boundary.
      const userTokens = [];
      const tokenRe = /\b[a-z][a-z0-9]*\b/gi;
      let m;
      while ((m = tokenRe.exec(text)) !== null) {
        userTokens.push({ tok: m[0].toLowerCase(), start: m.index, end: m.index + m[0].length });
      }
      let prefixHit = null;
      for (const ut of userTokens) {
        // Raised from 4 → 6 chars. At 4 chars the prefix-namespace
        // saturates across large catalogs ("init" hits Initech, "disc"
        // hits Discovery). 6 chars is enough substance to make the
        // match meaningful without being so strict that obvious typos
        // miss ("whitemou" / "whitemount" still pass the reverse path).
        if (ut.tok.length < 6) continue;
        // Skip user tokens that are themselves common English words —
        // they'd produce phantom matches the same way the score-90
        // single-token rule did before COMPOSER_COMMON_WORDS landed.
        if (COMPOSER_COMMON_WORDS.has(ut.tok)) continue;
        for (const ctok of tokens) {
          const cclean = ctok.replace(/[^\w]/g, "").toLowerCase();
          if (cclean.length < 5) continue;
          if (COMPOSER_STOP_WORDS.has(cclean)) continue;
          if (COMPOSER_COMMON_WORDS.has(cclean)) continue;

          // Reverse direction (strong signal): user token CONTAINS the
          // full client token plus extra chars ("whitemou" contains
          // "white"). This is essentially a 100% prefix match with typo
          // — keep the 5-char threshold here, it's a legit-typo path.
          if (ut.tok.startsWith(cclean) && ut.tok.length >= cclean.length + 1) {
            prefixHit = { client: c, score: 75, start: ut.start, end: ut.end };
            break;
          }

          // Forward direction (weaker): client token must be 6+ chars
          // AND user token must start with its first 6 chars AND be
          // ≥ 70% of its length. This is the rule that produced false
          // positives at the old 4-char threshold; tightening here.
          if (cclean.length >= 6
              && ut.tok.startsWith(cclean.slice(0, 6))
              && ut.tok.length >= cclean.length * 0.7) {
            prefixHit = { client: c, score: 70, start: ut.start, end: ut.end };
            break;
          }
        }
        if (prefixHit) break;
      }
      if (prefixHit) {
        allCandidates.push(prefixHit);
        continue;
      }
    }

    // Pick highest-scoring candidate; tie-break by earliest start
    if (allCandidates.length > 0) {
      allCandidates.sort((a, b) => b.score - a.score || a.start - b.start);
      const winner = allCandidates[0];
      matchedClient = winner.client;
      clientMatchSpan = { start: winner.start, end: winner.end, kind: "client" };
      matches.push(clientMatchSpan);

      // Secondary sweep: now that we know which client wins, scan the input
      // for OTHER prefix/typo references to the same client and add them as
      // additional spans to strip. Handles cases like "Create new puzzle ads
      // whitemou" where both "puzzle(s)" and "whitemou" reference White
      // Mountain Puzzles — we matched on "puzzle" first but the user also
      // typed "whitemou", so we strip both.
      const winnerTokens = winner.client.name.split(/\s+/);
      const userTokensSweep = [];
      const sweepRe = /\b[a-z][a-z0-9]*\b/gi;
      let sm;
      while ((sm = sweepRe.exec(text)) !== null) {
        userTokensSweep.push({ tok: sm[0].toLowerCase(), start: sm.index, end: sm.index + sm[0].length });
      }
      for (const ut of userTokensSweep) {
        if (ut.tok.length < 6) continue;
        if (COMPOSER_COMMON_WORDS.has(ut.tok)) continue;
        // Skip if this span is already matched
        if (matches.some(m => m.start === ut.start && m.end === ut.end)) continue;
        // Skip if it overlaps the existing client span
        if (matches.some(m => m.kind === "client" && ut.start < m.end && ut.end > m.start)) continue;
        for (const ctok of winnerTokens) {
          const cclean = ctok.replace(/[^\w]/g, "").toLowerCase();
          if (cclean.length < 6) continue;
          if (COMPOSER_STOP_WORDS.has(cclean)) continue;
          if (COMPOSER_COMMON_WORDS.has(cclean)) continue;
          // Apply the same tightened prefix-typo rules as the primary match
          const startsWithPrefix6 = ut.tok.startsWith(cclean.slice(0, 6)) && ut.tok.length >= cclean.length * 0.7;
          const containsFullToken = ut.tok.startsWith(cclean) && ut.tok.length >= cclean.length + 1;
          // Also allow simple plural/singular variants (puzzle ↔ puzzles)
          const pluralVariant = ut.tok === cclean.replace(/s$/, "") || cclean === ut.tok.replace(/s$/, "");
          if (startsWithPrefix6 || containsFullToken || pluralVariant) {
            matches.push({ start: ut.start, end: ut.end, kind: "client" });
            break;
          }
        }
      }
    }
  }

  // ─── Phase 3: Worker matching ────────────────────────────────────────
  // Match on first name. Skip if the span overlaps the client span.
  //
  // Unicode-aware boundary: JavaScript's \b is ASCII-only — `\bjosé\b`
  // never matches `josé` in input text because é is not a \w character.
  // We replace \b with letter/digit-class lookarounds and add the `u`
  // flag so accented and non-Latin worker names match correctly.
  let matchedWorker = null;
  if (workers && workers.length > 0) {
    const clientSpans = matches.filter(m => m.kind === "client");
    for (const w of workers) {
      const firstName = (w.name || w.display_name || "").trim().split(/\s+/)[0];
      if (!firstName || firstName.length < 2) continue;
      const re = new RegExp(
        `(?<=^|[^\\p{L}\\p{N}])${escapeRegexChars(firstName.toLowerCase())}(?=[^\\p{L}\\p{N}]|$)`,
        "iu"
      );
      const m = lower.match(re);
      if (m && m.index !== undefined) {
        const start = m.index, end = m.index + m[0].length;
        const overlaps = clientSpans.some(c => start < c.end && end > c.start);
        if (overlaps) continue;
        matchedWorker = w;
        matches.push({ start, end, kind: "worker" });
        break;
      }
    }
  }

  // ─── Phase 4: Date matching ──────────────────────────────────────────
  //
  // Order matters: longer/more-specific patterns first so "in 2 weeks"
  // matches the weeks rule before "in 2" can match anything else, and
  // "next Tuesday" beats bare "Tuesday".
  //
  // "end of week" anchors to the upcoming Friday (5). "end of month" anchors
  // to the last day of the current month. Shorthand "+3d" / "+1w" / "+2m"
  // is a power-user nicety; the leading "+" disambiguates it from
  // ordinary numeric content that might appear in task text.
  let matchedDate = null;
  const lastDayOfMonth = (d) => {
    const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return x;
  };
  const datePatterns = [
    { re: /\btoday\b/i, value: () => addDays(todayAnchored(), 0), kind: "today" },
    { re: /\btomorrow\b/i, value: () => addDays(todayAnchored(), 1), kind: "tomorrow" },
    { re: /\b(?:eow|end of (?:the )?week)\b/i, value: () => {
      const t = todayAnchored();
      let d = 5 - t.getDay(); // 5 = Friday
      if (d < 0) d += 7;
      return addDays(t, d);
    }, kind: "later" },
    { re: /\b(?:eom|end of (?:the )?month)\b/i, value: () => lastDayOfMonth(todayAnchored()), kind: "later" },
    { re: /\bnext week\b/i, value: () => addDays(todayAnchored(), 7), kind: "later" },
    { re: /\blater\b/i, value: () => addDays(todayAnchored(), 6), kind: "later" },
    { re: /\bin (\d+) days?\b/i, value: (m) => addDays(todayAnchored(), parseInt(m[1], 10)), kind: "later" },
    { re: /\bin (\d+) weeks?\b/i, value: (m) => addDays(todayAnchored(), parseInt(m[1], 10) * 7), kind: "later" },
    { re: /\bin (\d+) months?\b/i, value: (m) => {
      const t = todayAnchored();
      const out = new Date(t);
      out.setMonth(t.getMonth() + parseInt(m[1], 10));
      return out;
    }, kind: "later" },
    // Shorthand: +3d / +2w / +1m. Leading "+" required to disambiguate from
    // task text like "send 3 reports" that contains a bare number.
    { re: /(?:^|\s)\+(\d+)d\b/i, value: (m) => addDays(todayAnchored(), parseInt(m[1], 10)), kind: "later" },
    { re: /(?:^|\s)\+(\d+)w\b/i, value: (m) => addDays(todayAnchored(), parseInt(m[1], 10) * 7), kind: "later" },
    { re: /(?:^|\s)\+(\d+)m\b/i, value: (m) => {
      const t = todayAnchored();
      const out = new Date(t);
      out.setMonth(t.getMonth() + parseInt(m[1], 10));
      return out;
    }, kind: "later" },
    // "next Tuesday" — explicitly skip a week vs current weekday. nextWeekdayDate
    // already returns the upcoming weekday; "next" adds another 7 days to force
    // it past the immediate next occurrence ("next Monday" said on a Wednesday
    // means a week from this coming Monday, not the one in 5 days).
    { re: /\bnext (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, value: (m) => addDays(nextWeekdayDate(m[1]), 7), kind: "weekday" },
    { re: /\bnext (mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b/i, value: (m) => addDays(nextWeekdayDate(expandWeekday(m[1])), 7), kind: "weekday" },
    { re: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, value: (m) => nextWeekdayDate(m[1]), kind: "weekday" },
    { re: /\b(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b/i, value: (m) => nextWeekdayDate(expandWeekday(m[1])), kind: "weekday" },
  ];
  for (const p of datePatterns) {
    const m = lower.match(p.re);
    if (m && m.index !== undefined) {
      matchedDate = { date: p.value(m), kind: p.kind };
      // For shorthand patterns with optional leading whitespace, the regex
      // capture may start at the space. We strip the actual matched text,
      // which is what m[0] tells us — adjust the strip start to skip leading
      // whitespace from m[0] since the leading space isn't part of the date.
      let stripStart = m.index;
      let stripEnd = m.index + m[0].length;
      const leadingSpace = m[0].match(/^\s+/);
      if (leadingSpace) stripStart += leadingSpace[0].length;
      matches.push({ start: stripStart, end: stripEnd, kind: "date" });
      break;
    }
  }

  // ─── Phase 4b: Recurrence matching ───────────────────────────────────
  //
  // Recurrence patterns describe a task that repeats. When detected, the
  // composer creates the task with is_recurring=true and stores the pattern
  // shape in recurrence_pattern (see RECURRENCE PATTERN HELPERS above for
  // the shape spec). Recurrence and explicit due_date are mutually
  // exclusive in the data model: the composer clears one when it sets the
  // other.
  //
  // Order matters: more specific patterns before more general ones.
  // "every other week" before "every week"; "every weekday" before
  // "every (monday|...)"; "every day" / "daily" last.
  let matchedRecurrence = null;
  const recurrencePatterns = [
    // every other week → weekly on today's day-of-week, interval 2 (not
    // currently supported by the data model — fall back to weekly on the
    // current day-of-week with no interval. Future: extend schema with
    // interval field.)
    { re: /\bevery other week\b/i, pattern: () => ({ kind: "weekly", days: [todayAnchored().getDay()] }) },
    { re: /\bevery other day\b/i, pattern: () => ({ kind: "daily" }) },
    // every weekday / every weekdays / weekdays
    { re: /\bevery (?:weekday|weekdays)\b/i, pattern: () => ({ kind: "weekdays" }) },
    { re: /\bweekdays?\b/i, pattern: () => ({ kind: "weekdays" }) },
    // Multi-weekday: "every monday and wednesday", "every mon, wed, fri",
    // "every tue & thu". Captures "every" + a run of weekday tokens joined
    // by commas / "and" / "&" / whitespace. Must come BEFORE the single-
    // weekday rules so it gets first crack at multi-day phrases. The
    // pattern function pulls every weekday token out of the matched span.
    {
      re: /\bevery ((?:mon|tues?|wed|thur?s?|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s*(?:,|&|and|\/|\s)\s*(?:mon|tues?|wed|thur?s?|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday))+)\b/i,
      pattern: (m) => {
        // Extract each weekday token from the captured run, map to index,
        // dedupe, sort numerically.
        const tokens = m[1].match(/mon|tues?|wed|thur?s?|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday/gi) || [];
        const days = [...new Set(tokens.map(t => weekdayIndex(expandWeekday(t))))].sort((a, b) => a - b);
        return { kind: "weekly", days };
      },
    },
    // every Mon/Tue/.../Sunday and full names (single day)
    { re: /\bevery (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, pattern: (m) => ({ kind: "weekly", days: [weekdayIndex(m[1])] }) },
    { re: /\bevery (mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b/i, pattern: (m) => ({ kind: "weekly", days: [weekdayIndex(expandWeekday(m[1]))] }) },
    // every week / weekly → weekly on today's day-of-week
    { re: /\b(?:every week|weekly)\b/i, pattern: () => ({ kind: "weekly", days: [todayAnchored().getDay()] }) },
    // every day / daily
    { re: /\b(?:every day|daily)\b/i, pattern: () => ({ kind: "daily" }) },
  ];
  for (const p of recurrencePatterns) {
    const m = lower.match(p.re);
    if (m && m.index !== undefined) {
      // If the bare word "weekly" or "daily" is preceded by an article
      // (the/a/an/this/that/possessives), it's being used as an adjective
      // ("send the weekly report", "review the daily standup notes") and
      // should NOT trigger recurrence. The unambiguous "every X" forms
      // are unaffected.
      const matched = m[0].toLowerCase();
      if (matched === "weekly" || matched === "daily") {
        const before = lower.slice(Math.max(0, m.index - 12), m.index);
        if (/\b(the|a|an|this|that|our|my|your|their|its)\s+$/.test(before)) {
          continue; // adjective use; skip this pattern, try the next
        }
      }
      matchedRecurrence = { pattern: p.pattern(m) };
      const recStart = m.index, recEnd = m.index + m[0].length;
      matches.push({ start: recStart, end: recEnd, kind: "recurrence" });
      // Recurrence and date are mutually exclusive — void the matched
      // date. Previously the date span was always removed from `matches`,
      // leaving date words ("tomorrow", "+3d", "eow") stranded in the
      // title. Now we keep the date span IF it doesn't overlap the
      // recurrence span (the strip pass would double-strip), otherwise
      // drop it.
      if (matchedDate) {
        matchedDate = null;
        const idx = matches.findIndex(x => x.kind === "date");
        if (idx >= 0) {
          const dateSpan = matches[idx];
          const overlaps = dateSpan.start < recEnd && dateSpan.end > recStart;
          if (overlaps) {
            matches.splice(idx, 1); // would cause double-strip — drop it
          }
          // else keep it so the title-strip pass removes the word
        }
      }
      break;
    }
  }

  // ─── Phase 5: Title cleanup ──────────────────────────────────────────
  // Strip matched spans, then aggressively scrub leftover prepositions.
  // Each strip also absorbs a directly-preceding preposition (e.g. "at",
  // "for", "to") because once the noun is gone the preposition is
  // orphaned ("Send Cristian at Ardath" → strip "Ardath" → "Send Cristian
  // at " → without the absorb pass, "at" gets stranded mid-sentence and
  // the trailing-prep regex can't see it because it's no longer at the
  // end of the string).
  const ORPHAN_PREPS = new Set([
    "at", "for", "with", "by", "to", "from", "about",
    "regarding", "re", "vs", "against", "on", "of", "over",
    "under", "via", "per", "toward", "towards",
  ]);
  let title = text;
  const sortedMatches = [...matches].sort((a, b) => b.start - a.start);
  for (const m of sortedMatches) {
    let endIdx = m.end;
    if (m.kind === "client" && lower.slice(endIdx, endIdx + 2) === "'s") {
      endIdx += 2;
    }
    // Look back from m.start: if a single token sits directly before
    // (with whitespace), and that token is a preposition, swallow it.
    // We only swallow ONE preposition — chained "for at" is rare and
    // catching just one usually leaves clean output.
    let startIdx = m.start;
    const before = title.slice(0, m.start);
    const prepMatch = before.match(/(\s+)([A-Za-z]+)\s+$/);
    if (prepMatch && ORPHAN_PREPS.has(prepMatch[2].toLowerCase())) {
      // Move startIdx to before the preposition (keep the leading space
      // so we don't fuse two words; subsequent double-space collapse
      // cleans it up).
      startIdx = m.start - prepMatch[0].length + prepMatch[1].length;
    }
    title = title.slice(0, startIdx) + title.slice(endIdx);
  }
  // Leading "have/for/with/by/tell" — common in voice-y inputs ("for Backyard, do X")
  title = title.replace(/^\s*(have|for|with|by|tell)\s+/i, "");
  // Collapse double-spaces left by mid-string strips
  title = title.replace(/\s{2,}/g, " ").trim();
  // Stray possessives left over: " 's" or "'s "
  title = title.replace(/\s+'s\b/g, "");
  title = title.replace(/^'s\s+/, "");
  // Strip trailing prepositional phrases (multi-word first), then single-word.
  // Repeat until stable to handle cascades like "for at" or "with on".
  let prev;
  do {
    prev = title;
    title = title.replace(TRAILING_PHRASE_REGEX, "").trim();
    title = title.replace(TRAILING_PREP_REGEX, "").trim();
  } while (title !== prev);
  // Strip orphaned trailing connectors like " — " or " - " or " :" left over
  title = title.replace(/\s*[—–\-:,;]\s*$/g, "").trim();
  // Strip whitespace immediately before terminal punctuation. Happens when
  // a match span is stripped and leaves " ." or " !" etc. Without this we'd
  // emit "Send Cristian weekly report ." with a hanging space.
  title = title.replace(/\s+([.!?])$/, "$1");
  // Capitalize first letter
  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }
  // Add terminal period if absent
  if (title.length > 0 && !/[.!?]$/.test(title)) {
    title += ".";
  }

  return {
    matchedClient,
    matchedWorker,
    matchedDate,
    matchedRecurrence,
    title,
    matches,
  };
}

// ─── Today-timeline calendar entry parser ────────────────────────────
// Parses inputs for the timeline composer. Returns { starts_at, ends_at,
// title } or null if no time could be extracted. Supported syntaxes:
//
//   "2pm coffee"              → 2pm, no end time
//   "2pm Sarah"               → 2pm, no end time
//   "2-3pm Sarah"             → 2pm start, 3pm end
//   "2pm-3:30pm planning"     → 2pm start, 3:30pm end
//   "9am for 30m standup"     → 9am start, 9:30am end
//   "9am for 1h standup"      → 9am start, 10am end
//   "noon lunch"              → 12pm, no end time
//   "9:30am call"             → 9:30am, no end time
//   "lunch with mom at noon"  → 12pm, title = "lunch with mom"
//
// The parser is forgiving: time tokens can appear anywhere in the input;
// the remaining text becomes the title.
function parseCalendarEntry(rawText, anchorDate = new Date()) {
  if (!rawText || !rawText.trim()) return null;
  const text = rawText.trim();

  // Helper: build a Date for "today at HH:MM" given an hour+minute
  const todayAt = (h, m = 0) => {
    const d = new Date(anchorDate);
    d.setHours(h, m, 0, 0);
    return d;
  };
  // Convert spoken-time tokens to {h, m}
  const namedTimes = {
    "noon": { h: 12, m: 0 },
    "midnight": { h: 0, m: 0 },
    "eod": { h: 17, m: 0 },
  };
  const parseHourMin = (str) => {
    // Match three forms:
    //   "9", "9am", "9pm", "9:30am", "9:30", "14:00", "14"
    //   "930am", "1230pm" — compact 3-4 digits with meridiem
    //   "1430" — compact 24-hr
    //
    // The compact form is common in voice/typed shorthand. We try the
    // colon-form first, then fall back to compact.
    let m = str.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/i);
    if (!m) {
      // Compact 3-4 digit form: parse last 2 digits as minutes, rest as hour
      const compact = str.match(/^(\d{3,4})(am|pm)?$/i);
      if (!compact) return null;
      const digits = compact[1];
      const meridiem = compact[2] || "";
      const splitAt = digits.length - 2;
      const hourStr = digits.slice(0, splitAt);
      const minStr = digits.slice(splitAt);
      m = [str, hourStr, minStr, meridiem];
    }
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const meridiem = (m[3] || "").toLowerCase();
    if (h > 23 || min > 59) return null;
    if (meridiem === "pm" && h < 12) h += 12;
    if (meridiem === "am" && h === 12) h = 0;
    // Heuristic for bare integers without am/pm: 1-7 → assume pm (1pm-7pm),
    // 8-23 → keep (8am-11pm). Better than always-am which would render past
    // events for typical workday hours.
    if (!meridiem) {
      if (h >= 1 && h <= 7) h += 12;
    }
    return { h, m: min };
  };

  // Try range syntax first: "2-3pm" or "2pm-3:30pm" or "2pm-3pm" or
  // compact forms like "430pm-530pm" or "4-430pm".
  let starts = null, ends = null;
  const timeTok = `(?:\\d{3,4}(?:am|pm)?|\\d{1,2}(?::\\d{2})?(?:am|pm)?)`;
  const rangeRe = new RegExp(`\\b(${timeTok})\\s*[-–—to]+\\s*(${timeTok})\\b`, "i");
  const rangeM = text.match(rangeRe);
  let stripped = text;
  if (rangeM) {
    const left = rangeM[1], right = rangeM[2];
    // If left has no meridiem and right has one, infer left's meridiem from right.
    const rightMeridiem = (right.match(/(am|pm)$/i) || [, ""])[1].toLowerCase();
    let leftAdj = left;
    if (rightMeridiem && !/(am|pm)$/i.test(left)) {
      leftAdj = left + rightMeridiem;
    }
    const lhs = parseHourMin(leftAdj);
    const rhs = parseHourMin(right);
    if (lhs && rhs) {
      starts = todayAt(lhs.h, lhs.m);
      ends = todayAt(rhs.h, rhs.m);
      stripped = text.replace(rangeM[0], "").trim();
    }
  }

  // "for X hours/minutes" — duration parser. Comprehensive: handles
  // digits, decimals, English number words, and the most common compound
  // phrases. Only runs if we DON'T have a range (and so don't yet have
  // a start time).
  //
  // Supported forms:
  //   "for 30m", "for 1h", "for 1.5 hours", "for 1hr", "for 90 min"
  //   "for an hour", "for a hour", "for one hour", "for two hours"
  //   "for half an hour", "for a half hour", "for half hour"
  //   "for an hour and a half", "for one and a half hours"
  //   "for 30 minutes", "for forty-five minutes" (last not yet supported)
  let durationMs = null;
  if (!starts) {
    // Map common spelled-out numbers to their numeric value. Covers 1-12
    // which is enough for any reasonable meeting duration. Beyond that,
    // people type digits.
    const WORD_NUMBERS = {
      "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
      "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
      "eleven": 11, "twelve": 12,
      "a": 1, "an": 1,
    };
    // Tokens that mean "0.5". Used after we've matched a quantity.
    // "half" → 0.5, "quarter" → 0.25 (rare but supported).
    const FRACTION_WORDS = { "half": 0.5, "quarter": 0.25 };
    const UNIT_GROUP = "(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)";

    // Normalize compound phrases BEFORE the regex match. Converts
    // "an hour and a half" → "1.5 hour", "one and a half hours" → "1.5 hours",
    // "2 and a half hours" → "2.5 hours".
    let normalized = text;
    normalized = normalized.replace(
      /\b(a|an|one)\s+(hour|hours)\s+and\s+(a\s+)?half\b/gi,
      "1.5 $2"
    );
    // Handle number-word + "and a half hours" — e.g. "one and a half hours".
    // Has to come BEFORE the digits version so "one" doesn't get eaten as a
    // bareword. We restrict to 1-12 same as elsewhere.
    normalized = normalized.replace(
      /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+and\s+(a\s+)?half\s+(hours?)\b/gi,
      (_m, word, _a, unit) => {
        const words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
        return `${(words[word.toLowerCase()] ?? 1) + 0.5} ${unit}`;
      }
    );
    normalized = normalized.replace(
      /\b(\d+)\s+and\s+(a\s+)?half\s+(hours?)\b/gi,
      (_m, n, _a, unit) => `${parseFloat(n) + 0.5} ${unit}`
    );
    // "half an hour" / "a half hour" / "half hour" → "0.5 hour"
    normalized = normalized.replace(
      /\b(?:a\s+)?half\s+(?:an?\s+)?(hour|hours)\b/gi,
      "0.5 $1"
    );
    // "quarter (of an) hour" → "0.25 hour" (rare but cheap to support)
    normalized = normalized.replace(
      /\b(?:a\s+)?quarter\s+(?:of\s+)?(?:an?\s+)?(hour|hours)\b/gi,
      "0.25 $1"
    );

    // Now match: "for <quantity> <unit>" where quantity is digits,
    // decimal, OR a word-number (one, two, an, a, etc.)
    const wordNumRe = Object.keys(WORD_NUMBERS).join("|");
    const qtyPattern = `(\\d+(?:\\.\\d+)?|${wordNumRe})`;
    const durRe = new RegExp(`\\bfor\\s+${qtyPattern}\\s*${UNIT_GROUP}\\b`, "i");
    const durM = normalized.match(durRe);
    if (durM) {
      const qty = durM[1].toLowerCase();
      const unit = durM[2].toLowerCase();
      const n = /^\d/.test(qty) ? parseFloat(qty) : (WORD_NUMBERS[qty] ?? null);
      if (n !== null && !isNaN(n)) {
        const isHour = unit.startsWith("h");
        durationMs = isHour ? n * 3600 * 1000 : n * 60 * 1000;
        // Strip the matched phrase from the ORIGINAL text by re-running the
        // match against `text` (not normalized) where possible. If the user
        // wrote "for an hour", the original text contained that phrase; we
        // strip it. If they wrote "for an hour and a half" (which was
        // normalized to "for 1.5 hour"), we strip the original compound from
        // text instead.
        const compoundRe = /\bfor\s+(?:a|an|one)\s+(?:hour|hours)\s+and\s+(?:a\s+)?half\b/i;
        const wordCompoundRe = /\bfor\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+and\s+(?:a\s+)?half\s+hours?\b/i;
        const halfAnHourRe = /\bfor\s+(?:a\s+)?half\s+(?:an?\s+)?(?:hour|hours)\b/i;
        const quarterHourRe = /\bfor\s+(?:a\s+)?quarter\s+(?:of\s+)?(?:an?\s+)?(?:hour|hours)\b/i;
        const compoundDigitRe = /\bfor\s+\d+\s+and\s+(?:a\s+)?half\s+hours?\b/i;
        if (compoundRe.test(text)) {
          stripped = text.replace(compoundRe, "").trim();
        } else if (wordCompoundRe.test(text)) {
          stripped = text.replace(wordCompoundRe, "").trim();
        } else if (compoundDigitRe.test(text)) {
          stripped = text.replace(compoundDigitRe, "").trim();
        } else if (halfAnHourRe.test(text)) {
          stripped = text.replace(halfAnHourRe, "").trim();
        } else if (quarterHourRe.test(text)) {
          stripped = text.replace(quarterHourRe, "").trim();
        } else {
          // Standard form — strip the matched phrase from original text
          const standardRe = new RegExp(`\\bfor\\s+${qtyPattern}\\s*${UNIT_GROUP}\\b`, "i");
          stripped = text.replace(standardRe, "").trim();
        }
      }
    }
  }

  // Single time token: "9am", "2pm", "9:30am", "noon", "midnight"
  if (!starts) {
    // Named time first
    for (const [name, hm] of Object.entries(namedTimes)) {
      const namedRe = new RegExp(`\\b${name}\\b`, "i");
      const nm = stripped.match(namedRe);
      if (nm) {
        starts = todayAt(hm.h, hm.m);
        stripped = stripped.replace(namedRe, "").trim();
        break;
      }
    }
    // Numeric time. Two formats supported here:
    //   "9", "9am", "9:30am" — standard
    //   "430pm", "1230am", "1430" — compact 3-4 digit, with or without meridiem
    //
    // Priority order (handles common collision with client names like "1620"):
    //   1. Token immediately after the word "at" — strongest signal
    //   2. Any token with explicit am/pm — strong signal
    //   3. Bare numeric fallback — only when no better candidate exists
    //
    // This is important because clients are often named with numbers
    // (e.g. "1620", "412 Studios"). Without these priority rules, the
    // parser would greedily grab "1620" as a time when "330pm" later in
    // the string is the actual time.
    if (!starts) {
      const tryToken = (tokStr) => {
        const hm = parseHourMin(tokStr);
        return hm ? { hm, tokStr } : null;
      };

      // Pass 1: token after "at" / "@"
      const atRe = /\b(?:at|@)\s+(\d{3,4}(?:am|pm)?|\d{1,2}(?::\d{2})?(?:am|pm)?)\b/i;
      let pick = null;
      const atM = stripped.match(atRe);
      if (atM) {
        const r = tryToken(atM[1]);
        if (r) pick = { hm: r.hm, fullMatch: atM[0], replaceFull: true };
      }

      // Pass 2: any token with explicit meridiem
      if (!pick) {
        const meridiemRe = /\b(\d{3,4}(?:am|pm)|\d{1,2}(?::\d{2})?(?:am|pm))\b/i;
        const mm = stripped.match(meridiemRe);
        if (mm) {
          const r = tryToken(mm[1]);
          if (r) pick = { hm: r.hm, fullMatch: mm[0], replaceFull: false };
        }
      }

      // Pass 3: bare numeric fallback (no meridiem). This is the looseiest
      // match and only fires when no better signal exists.
      if (!pick) {
        const bareRe = /\b(\d{3,4}|\d{1,2}(?::\d{2})?)\b/;
        const bm = stripped.match(bareRe);
        if (bm) {
          const r = tryToken(bm[1]);
          if (r) pick = { hm: r.hm, fullMatch: bm[0], replaceFull: false };
        }
      }

      if (pick) {
        starts = todayAt(pick.hm.h, pick.hm.m);
        stripped = stripped.replace(pick.fullMatch, " ").trim();
      }
    }
  }

  if (!starts) return null;

  // Apply duration if we captured one
  if (!ends && durationMs) {
    ends = new Date(starts.getTime() + durationMs);
  }

  // Title = whatever's left after stripping time/duration tokens, cleaned up.
  let title = stripped
    .replace(/^\s*(at|@)\s+/i, "")
    .replace(/\s+(at|@)\s*$/i, "")
    .replace(/^\s*[-–—,:]\s*/, "")
    .replace(/\s*[-–—,:]\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!title) title = "Untitled";
  // Capitalize first letter
  title = title.charAt(0).toUpperCase() + title.slice(1);

  return {
    starts_at: starts.toISOString(),
    ends_at: ends ? ends.toISOString() : null,
    title,
  };
}

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

// Minimal markdown renderer for Rai's chat responses.
// Handles: **bold**, numbered lists, bulleted lists, paragraphs separated by blank lines.
// Safe: uses React nodes, not dangerouslySetInnerHTML.
function RaiMarkdown({ text, size = 16, lineHeight = 1.65 }) {
  if (!text) return null;
  // Split into paragraph blocks on blank lines
  const blocks = text.split(/\n\s*\n/);
  const renderInline = (str, keyPrefix) => {
    // Handle **bold** and *italic* inside a string.
    // Split on bold first to protect its inner asterisks from being matched as italic markers.
    const boldParts = str.split(/(\*\*[^*]+\*\*)/g);
    const nodes = [];
    boldParts.forEach((part, bi) => {
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
        nodes.push(<strong key={`${keyPrefix}-b${bi}`} style={{ fontWeight: 700 }}>{part.slice(2, -2)}</strong>);
        return;
      }
      // Now process italics within the non-bold fragment
      const italicParts = part.split(/(\*[^*\n]+\*)/g);
      italicParts.forEach((ip, ii) => {
        if (ip.startsWith("*") && ip.endsWith("*") && ip.length > 2) {
          nodes.push(<em key={`${keyPrefix}-i${bi}-${ii}`} style={{ fontStyle: "italic" }}>{ip.slice(1, -1)}</em>);
        } else if (ip) {
          nodes.push(ip);
        }
      });
    });
    return nodes;
  };
  return (
    <>
      {blocks.map((block, bi) => {
        const lines = block.split("\n").filter(l => l.trim() !== "");
        // Detect numbered list: every line starts with "1. ", "2. ", etc.
        const numberedMatch = lines.length > 0 && lines.every(l => /^\s*\d+\.\s/.test(l));
        if (numberedMatch && lines.length > 1) {
          return (
            <ol key={bi} style={{ fontSize: size, color: C.text, lineHeight, marginTop: bi === 0 ? 0 : 8, marginBottom: 8, paddingLeft: 24 }}>
              {lines.map((l, li) => {
                const content = l.replace(/^\s*\d+\.\s/, "");
                return <li key={li} style={{ marginBottom: 4 }}>{renderInline(content, `${bi}-${li}`)}</li>;
              })}
            </ol>
          );
        }
        // Detect bulleted list: every line starts with "- " or "* "
        const bulletedMatch = lines.length > 0 && lines.every(l => /^\s*[-*]\s/.test(l));
        if (bulletedMatch && lines.length > 1) {
          return (
            <ul key={bi} style={{ fontSize: size, color: C.text, lineHeight, marginTop: bi === 0 ? 0 : 8, marginBottom: 8, paddingLeft: 24 }}>
              {lines.map((l, li) => {
                const content = l.replace(/^\s*[-*]\s/, "");
                return <li key={li} style={{ marginBottom: 4 }}>{renderInline(content, `${bi}-${li}`)}</li>;
              })}
            </ul>
          );
        }
        // Default: paragraph with line breaks
        return (
          <p key={bi} style={{ fontSize: size, color: C.text, lineHeight, margin: 0, marginTop: bi === 0 ? 0 : 10 }}>
            {lines.map((l, li) => (
              <span key={li}>
                {renderInline(l, `${bi}-${li}`)}
                {li < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </>
  );
}

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
// Props:
//   events      — array of { id, title, starts_at, ends_at?, source }
//   onCreate    — async ({ title, starts_at, ends_at }) → returns created event
//   onDelete    — async (eventId) → deletes
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
function TodayTimeline({ events = [], onCreate, onDelete, onUpdate, compact = false, showHeader = true, C, googleConnected = false, onConnectClick = null, promptDismissed = false, onDismissConnectPrompt = null }) {
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
  const latestHour = 23;
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
    const parsed = parseCalendarEntry(composerText, parseAnchor);
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

  // Hour labels — render at integer hours in the window
  const hourLabels = [];
  for (let h = earliestHour; h <= latestHour; h++) {
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
          <Icon name="due" size={26} color={C.primaryLight} accent={C.primary} />
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
                fontWeight: 500,
                ...(selectedDay === "today"
                  ? { background: C.card, color: C.text, boxShadow: "var(--rt-sh-card)" }
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
                fontWeight: 500,
                ...(selectedDay === "tomorrow"
                  ? { background: C.card, color: C.text, boxShadow: "var(--rt-sh-card)" }
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
        }}
      >
        <div style={{ position: "relative", height: timelineHeight, minHeight: timelineHeight }}>
          {/* Hour grid */}
          {hourLabels.map(h => (
            <div
              key={h}
              style={{
                position: "absolute",
                top: yForHour(h),
                left: 0,
                right: 0,
                height: SLOT_HEIGHT,
                borderTop: "1px solid " + C.borderLight,
              }}
            >
              <span style={{
                position: "absolute",
                top: -7,
                left: 0,
                fontSize: 10,
                color: C.textMuted,
                fontVariantNumeric: "tabular-nums",
                fontWeight: 500,
                background: C.card,
                paddingRight: 4,
              }}>
                {formatHourLabel(h)}
              </span>
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

            // Style by state
            let containerStyle;
            let titleColor = C.text;
            let timeColor = C.textMuted;
            let titleWeight = 500;
            if (state === "past") {
              containerStyle = {
                background: "transparent",
                borderBottom: `1px solid ${C.borderLight}`,
                borderRadius: 0,
                paddingLeft: 0,
              };
              titleColor = C.textMuted;
              timeColor = C.textMuted;
              titleWeight = 400;
            } else if (state === "now") {
              // The currently-happening event. Cream surface with purple
              // left-border anchor + purple-tinted shadow so it reads as
              // a "live, active" surface.
              containerStyle = {
                background: C.deepCream,
                borderLeft: `3px solid ${C.btn}`,
                borderRadius: "0 8px 8px 0",
                paddingLeft: 10,
                boxShadow: "0 1px 3px rgba(91,33,182,0.12), 0 4px 12px rgba(91,33,182,0.16)",
              };
              titleColor = C.text;
              timeColor = C.textSec;
              titleWeight = 600;
            } else { // upcoming
              // Deep cream gradient block with dark ink text + cream-toned
              // shadow + bright left-edge highlight (inset). Reads as a
              // warm sticky-note on the timeline — calm, friendly, doesn't
              // compete with the rest of the page. Cream sits between
              // purple (Rai) and green (retention) without claiming
              // hierarchy it shouldn't have.
              containerStyle = {
                background: "linear-gradient(135deg, #EAE4D6 0%, #D2C6A8 100%)",
                border: "none",
                borderRadius: 8,
                paddingLeft: 11,
                boxShadow: "0 1px 2px rgba(80,60,30,0.10), 0 4px 12px rgba(120,90,40,0.14), inset 3px 0 0 0 rgba(255,255,255,0.50)",
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
                boxShadow: "0 6px 18px rgba(91,33,182,0.22), 0 2px 6px rgba(0,0,0,0.10)",
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
                background: C.card,
                padding: "0 4px",
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
                zIndex: 3,
              }} />
              {/* Line itself — gradient that fades to transparent on the right */}
              <div style={{
                position: "absolute",
                left: 36,
                right: 0,
                top: 0,
                height: 1.5,
                background: "linear-gradient(90deg, #5B21B6 0%, rgba(91,33,182,0.55) 35%, rgba(91,33,182,0) 100%)",
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
              <span style={{ color: C.border }}>·</span>
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

      {/* Composer — flush input at the foot of the calendar widget.
          Idle: hairline divider on top, no background, no rounded panel.
          Focused (:focus-within from rt-cal-composer class): the row
          softens into a recessed warm-cream surface with inset shadow,
          so the act of typing feels like using a real input. Returns to
          the quiet idle when focus leaves. */}
      <div
        className="rt-cal-composer"
        onClick={() => inputRef.current && inputRef.current.focus()}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 2px 0",
          marginTop: 6,
          borderTop: "1px solid " + C.borderLight,
          cursor: "text",
          pointerEvents: "auto",
          position: "relative",
          zIndex: 5,
        }}
      >
        <span style={{ fontSize: 15, color: C.btn, fontWeight: 700, lineHeight: 1, pointerEvents: "none" }}>+</span>
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
      {composerError && (
        <div style={{ fontSize: 10.5, color: C.danger, marginTop: 4, paddingLeft: 14 }}>{composerError}</div>
      )}
    </div>
  );
}

const navItemsCore = [
  { id: "today", icon: "today", label: "Today" },
  { id: "clients", icon: "clients", label: "Clients" },
  { id: "health", icon: "health", label: "Health" },
  { id: "retros", icon: "rolodex", label: "Rolodex" },
  { id: "referrals", icon: "referrals", label: "Referrals" },
  { id: "workers", icon: "workers", label: "Workers" },
  { id: "coach", icon: "rai", label: "Rai" },
];
const navItemsEnterprise = [
  { id: "today", icon: "today", label: "Today" },
  { id: "sweeps", icon: "sweeps", label: "Sweeps" },
  { id: "clients", icon: "clients", label: "Clients" },
  { id: "health", icon: "health", label: "Health" },
  { id: "referral_intel", icon: "target", label: "Referral Intel" },
  { id: "coach", icon: "rai", label: "Rai" },
];
// Mobile bottom nav — single horizontally-scrollable strip instead of a "More"
// popup. All destinations sit inline; user swipes the strip left/right to
// reveal additional items. The strip auto-scrolls to keep the active item in
// view when navigation happens. Order matters — primary destinations first
// (Today, Clients, Rai, Health) so they're visible without scrolling on
// typical phone widths.
const mobileNavCore = [
  { id: "today", icon: "today", label: "Today" },
  { id: "clients", icon: "clients", label: "Clients" },
  { id: "health", icon: "health", label: "Health" },
  { id: "retros", icon: "rolodex", label: "Rolodex" },
  { id: "referrals", icon: "referrals", label: "Referrals" },
  { id: "workers", icon: "workers", label: "Workers" },
  { id: "coach", icon: "rai", label: "Rai" },
  { id: "settings", icon: "settings", label: "Settings" },
];
const mobileNavEnterprise = [
  { id: "today", icon: "today", label: "Today" },
  { id: "sweeps", icon: "sweeps", label: "Sweeps" },
  { id: "clients", icon: "clients", label: "Clients" },
  { id: "health", icon: "health", label: "Health" },
  { id: "referral_intel", icon: "target", label: "Referral Intel" },
  { id: "coach", icon: "rai", label: "Rai" },
  { id: "settings", icon: "settings", label: "Settings" },
];
// Legacy "More" item lists — kept (empty-ish) so any straggler reference doesn't
// crash. The mobile More popup has been removed in favor of the swipeable strip.
const moreItemsCore = [];
const moreItemsEnterprise = [];

const coachOpeners = {
  "Northvane Studios": "Let's talk about Northvane. Sarah's been with you almost 3 years. What's on your mind?",
  "Oakline Outdoors": "Oakline is solid. Anything specific, or just checking in?",
  "Ridgeline Supply": "Ridgeline is at an inflection point. 1-year mark coming. What are you thinking?",
  "Broadleaf Media": "Broadleaf is your highest revenue but stable, not growing. Want to change that?",
  "Copper & Sage": "Copper & Sage has been declining. Elena's pulling back. What happened last call?",
  "Velvet & Co": "Velvet is going vague. Priya used to give detail. What changed?",
  "Foxglove Partners": "Foxglove has been cold 2 weeks. $8.2k/mo. Ready to make a call?",
  "Evergreen Games": "Evergreen is done. Want to think through the Rolodex entry — could they come back or refer?",
};
const coachDemos = {
  "Which clients should I ask for referrals?": "Sarah at Northvane (91%) already referred 2. James at Oakline (82%) hasn't been asked. Everyone below 70%: deepen first.",
  "Who needs attention this week?": "This week: Ridgeline (1-year approaching), Copper & Sage (health check overdue), Foxglove (decision time).",
  "What patterns do my best clients share?": "Your top clients share three traits: they give honest feedback early, they trust your judgment on strategy, and they've been with you long enough to see results compound. Northvane and Oakline both check all three.",
};

const Dot = () => <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.danger, flexShrink: 0 }} />;

// ─── Daybook (right-rail notepad) ──────────────────────────────────────
// Defined at top level so component identity is stable across App re-renders.
// Without this, the textarea would remount on every keystroke and lose focus.
// All state is owned by App and passed in as props.
const DaybookPanel = ({ entry, yesterday, saveStatus, onChange }) => {
  const today = new Date();
  const dayName = today.toLocaleDateString("en-US", { weekday: "long" });
  const monthName = today.toLocaleDateString("en-US", { month: "long" });
  const dateLine = `${dayName} · ${monthName} ${today.getDate()}`;
  return (
    <div className="r-today-panel" style={{ width: "100%", flexShrink: 0 }}>
      <div style={{
        background: C.card,
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "var(--rt-sh-card)",
        display: "flex",
        flexDirection: "column",
      }}>
        {/* Masthead — beige (cream) gradient that auto-themes light/dark */}
        <div style={{
          padding: "16px 18px 14px",
          background: `linear-gradient(180deg, ${C.deepCream} 0%, ${C.card} 100%)`,
          borderBottom: "1px solid " + C.borderLight,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, lineHeight: 1.2 }}>
              Notes
            </div>
            {saveStatus === "saved" && (
              <div style={{
                fontSize: 10.5, color: C.success,
                display: "inline-flex", alignItems: "center", gap: 5,
                fontWeight: 500,
              }}>
                {/* Pulsing dot signals the autosave loop is alive */}
                <span className="rt-save-pulse" style={{
                  width: 5, height: 5, borderRadius: 999,
                  background: C.success,
                  boxShadow: "0 0 0 2px " + C.primarySoft,
                }} />
                Saved
              </div>
            )}
            {saveStatus === "saving" && (
              <div style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 500 }}>
                Saving…
              </div>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: C.textMuted, fontWeight: 500 }}>
            {dateLine}
          </div>
        </div>

        {/* Today's entry — editable textarea */}
        <div style={{ padding: "14px 18px 16px" }}>
          <textarea
            value={entry}
            onChange={(e) => onChange(e.target.value)}
            placeholder="What's on your mind today?"
            style={{
              width: "100%",
              minHeight: 140,
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: 13.5,
              lineHeight: 1.6,
              color: C.text,
              fontFamily: "inherit",
              resize: "vertical",
              padding: 0,
            }}
          />
        </div>

        {/* Yesterday peek — same white bg as the rest of the notepad,
            visually separated only by a dotted top border. */}
        {yesterday && yesterday.body && (
          <div style={{
            padding: "12px 18px 14px",
            borderTop: "1px dashed " + C.border,
            background: C.card,
          }}>
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              color: C.textMuted,
              letterSpacing: 0.5,
              textTransform: "uppercase",
              marginBottom: 6,
            }}>
              Yesterday
            </div>
            <div style={{
              fontSize: 12,
              color: C.textSec,
              lineHeight: 1.5,
              fontFamily: "'Fraunces', Georgia, serif",
              fontVariationSettings: '"opsz" 96, "SOFT" 50, "WONK" 0',
              fontWeight: 500,
              fontStyle: "italic",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}>
              "{yesterday.body}"
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// REFERRAL NETWORK · d3-force simulation
// ============================================================
//
// A live, physics-driven SVG component that renders the referral
// network as a graph. Replaces the static hub-and-spoke math
// (which broke past ~6 referrers) with a force-directed layout
// that scales to any number of nodes.
//
// Forces in play:
//   • forceLink     — edges pull connected nodes together
//   • forceManyBody — every node repels every other node
//   • forceCenter   — soft anchor toward viewport center
//   • forceCollide  — physical radii prevent overlap
//   • forceX/Y      — gentle pull keeping the hub at center
//
// Animation: the simulation runs continuously at low alpha so
// the graph subtly breathes. Hover-locking on a node bumps its
// charge to make it "settle" momentarily for clean inspection.
// New referrals (added in the last 60s) get a CSS pulse ring.
//
// Performance: the simulation runs ~30-60 ticks per second using
// requestAnimationFrame. Stops on unmount to prevent leaks. Pauses
// when document.hidden via the visibilitychange listener.
//
// Color scheme (status-driven):
//   converted/active → C.retGood (green, solid edge)
//   pending          → C.retWarn (amber, dashed edge)
//   lost/rejected    → C.textMuted (gray, dotted edge)
//
// Predicted referrers (props.predictedReferrers): clients who
// HAVEN'T referred but score high on likely-to-refer dimensions.
// Rendered as ghost nodes — dashed border, faded fill, "Ask?" CTA.
function ReferralNetworkD3({
  referrers,
  predictedReferrers = [],
  asOfDate = null,
  recentReferralWindowMs = 60_000,
  onNodeClick,
  onEdgeClick,
  C,
  getAvatarColor,
  getInitials,
}) {
  // SVG viewport — fixed pixel size, scales via CSS width:100%.
  const W = 820, H = 500;
  const cx = W / 2, cy = H / 2;

  // Filter to as-of date for time-travel slider. Each child carries an
  // `on` (date string). We compare loosely — if no asOfDate, show all.
  const visibleReferrers = useMemo(() => {
    if (!asOfDate) return referrers;
    const cutoff = new Date(asOfDate).getTime();
    return referrers
      .map(r => ({
        ...r,
        children: r.children.filter(ch => {
          if (!ch.on) return true;
          const d = new Date(ch.on).getTime();
          return Number.isFinite(d) ? d <= cutoff : true;
        }),
      }))
      .filter(r => r.children.length > 0);
  }, [referrers, asOfDate]);

  // Build node list + edges for the simulation.
  //   • hub node (id='__hub__', fixed at center)
  //   • referrer nodes (one per visible referrer)
  //   • predicted-referrer nodes (ghost; if no predicted ones, skipped)
  //   • child nodes (referred contacts/leads)
  // Edges: hub → referrer, referrer → child, hub → ghost referrer (dotted)
  const { nodes, links } = useMemo(() => {
    const ns = [];
    const ls = [];

    // Hub — anchored. fx/fy = fixed position d3-force respects.
    ns.push({ id: "__hub__", kind: "hub", fx: cx, fy: cy });

    visibleReferrers.forEach(r => {
      ns.push({
        id: "ref:" + r.id,
        kind: "referrer",
        data: r,
        radius: 22 + Math.min(8, Math.log(1 + r.revenue / 1000)),
      });
      ls.push({ source: "__hub__", target: "ref:" + r.id, kind: "hub-ref" });

      r.children.forEach((ch, i) => {
        ns.push({
          id: "child:" + r.id + ":" + (ch.id || i),
          kind: "child",
          data: ch,
          parentId: r.id,
          radius: 11,
        });
        ls.push({
          source: "ref:" + r.id,
          target: "child:" + r.id + ":" + (ch.id || i),
          kind: "ref-child",
          status: ch.status,
        });
      });
    });

    // Predicted referrers — rendered as ghosts. Limited to top 4 to avoid
    // cluttering the graph; assumes caller already pre-sorted.
    predictedReferrers.slice(0, 4).forEach(p => {
      ns.push({
        id: "ghost:" + p.id,
        kind: "ghost",
        data: p,
        radius: 18,
      });
      ls.push({ source: "__hub__", target: "ghost:" + p.id, kind: "hub-ghost" });
    });

    return { nodes: ns, links: ls };
  }, [visibleReferrers, predictedReferrers, cx, cy]);

  // Mutable refs to the simulation + nodes (d3 mutates node objects).
  const simRef = useRef(null);
  const nodesRef = useRef([]);
  const [tickVersion, setTickVersion] = useState(0);
  const [hoverId, setHoverId] = useState(null);
  const [tooltipPos, setTooltipPos] = useState(null);

  // Build / rebuild simulation when topology changes.
  useEffect(() => {
    // Stop any existing simulation.
    if (simRef.current) simRef.current.stop();

    // Clone node objects so d3 can mutate x/y/vx/vy without polluting
    // upstream memo'd data. Carry forward old positions where possible
    // (smooth transition when a node is added).
    const oldById = new Map(nodesRef.current.map(n => [n.id, n]));
    const simNodes = nodes.map(n => {
      const old = oldById.get(n.id);
      return {
        ...n,
        x: old?.x ?? cx + (Math.random() - 0.5) * 40,
        y: old?.y ?? cy + (Math.random() - 0.5) * 40,
        vx: old?.vx ?? 0,
        vy: old?.vy ?? 0,
        fx: n.fx ?? null,
        fy: n.fy ?? null,
      };
    });
    nodesRef.current = simNodes;

    const sim = forceSimulation(simNodes)
      .force("link", forceLink(links.map(l => ({ ...l })))
        .id(d => d.id)
        .distance(link => {
          if (link.kind === "hub-ref") return 130;
          if (link.kind === "hub-ghost") return 200; // ghosts orbit further out
          return 60; // ref-child
        })
        .strength(link => link.kind === "ref-child" ? 0.9 : 0.4))
      .force("charge", forceManyBody().strength(d => {
        if (d.kind === "hub") return -800;
        if (d.kind === "referrer") return -350;
        if (d.kind === "ghost") return -150;
        return -120; // child
      }))
      .force("center", forceCenter(cx, cy).strength(0.05))
      .force("collide", forceCollide().radius(d => d.radius + 8).strength(0.9))
      .force("x", d3forceX(cx).strength(0.04))
      .force("y", d3forceY(cy).strength(0.04))
      .alpha(1)
      .alphaDecay(0.02)      // slow decay so the graph stays "alive"
      .alphaMin(0.005)       // keeps it gently breathing even when "settled"
      .velocityDecay(0.4);

    sim.on("tick", () => {
      // Bump version so React re-renders. We don't put nodes in state
      // (would be huge re-renders) — instead store in ref and trigger
      // a lightweight version increment.
      setTickVersion(v => v + 1);
    });

    simRef.current = sim;

    return () => {
      sim.stop();
    };
  }, [nodes, links, cx, cy]);

  // Pause simulation when tab is hidden to save CPU.
  useEffect(() => {
    const onVis = () => {
      if (!simRef.current) return;
      if (document.hidden) simRef.current.stop();
      else simRef.current.alpha(0.1).restart();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Hover handler: bump alpha when hovering to "settle" the network.
  const handleEnter = (id, evt) => {
    setHoverId(id);
    if (simRef.current) simRef.current.alphaTarget(0.05).restart();
    if (evt && evt.currentTarget) {
      const svgRect = evt.currentTarget.ownerSVGElement.getBoundingClientRect();
      setTooltipPos({
        x: evt.clientX - svgRect.left,
        y: evt.clientY - svgRect.top,
      });
    }
  };
  const handleLeave = () => {
    setHoverId(null);
    setTooltipPos(null);
    if (simRef.current) simRef.current.alphaTarget(0);
  };

  // Helper to look up a node by id (positions live in nodesRef).
  const findNode = (id) => nodesRef.current.find(n => n.id === id);

  // Helpers for child colors / edge styles by status.
  const statusColor = (status) => {
    if (status === "converted" || status === "active" || status === "closed") return C.retGood;
    if (status === "pending") return "#D17A1B"; // amber
    return C.textMuted; // lost / rejected / other
  };
  const edgeStrokeDash = (status) => {
    if (status === "pending") return "4 4";
    if (status === "lost" || status === "rejected") return "1 5";
    return null;
  };

  // Recency check for pulse animation.
  const now = Date.now();
  const isRecent = (ch) => {
    if (!ch?.on) return false;
    const d = new Date(ch.on).getTime();
    return Number.isFinite(d) && (now - d) < recentReferralWindowMs;
  };

  // Force a position read each render via the tickVersion trigger.
  void tickVersion;

  // Render
  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", maxHeight: 520, display: "block" }} onMouseLeave={handleLeave}>
        <defs>
          <radialGradient id="hubGlowD3" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={C.primary} stopOpacity="0.25" />
            <stop offset="100%" stopColor={C.primary} stopOpacity="0" />
          </radialGradient>
          <filter id="softShadowD3" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#1E261F" floodOpacity="0.15" />
          </filter>
          <filter id="purpleHaloD3" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="1" stdDeviation="3" floodColor="#5B21B6" floodOpacity="0.30" />
          </filter>
          <linearGradient id="ghostGradD3" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6D2BD9" />
            <stop offset="55%" stopColor="#5B21B6" />
            <stop offset="100%" stopColor="#4C1D95" />
          </linearGradient>
        </defs>

        {/* Hub glow */}
        {(() => {
          const hub = findNode("__hub__");
          if (!hub) return null;
          return <circle cx={hub.x} cy={hub.y} r="90" fill="url(#hubGlowD3)" />;
        })()}

        {/* Edges */}
        {links.map((link, idx) => {
          const s = findNode(typeof link.source === "object" ? link.source.id : link.source);
          const t = findNode(typeof link.target === "object" ? link.target.id : link.target);
          if (!s || !t) return null;
          const dim = hoverId && hoverId !== s.id && hoverId !== t.id ? 0.15 : 1;
          if (link.kind === "hub-ghost") {
            return (
              <line
                key={"ln-" + idx}
                x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                stroke="#C4C4BD"
                strokeWidth="1.5"
                strokeDasharray="1 6"
                opacity={dim * 0.7}
                strokeLinecap="round"
              />
            );
          }
          if (link.kind === "hub-ref") {
            return (
              <line
                key={"ln-" + idx}
                x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                stroke={C.retGood}
                strokeWidth="2.5"
                opacity={dim * 0.55}
                strokeLinecap="round"
                onClick={() => onEdgeClick && onEdgeClick(link)}
                style={{ cursor: onEdgeClick ? "pointer" : "default" }}
              />
            );
          }
          // ref-child edge
          return (
            <line
              key={"ln-" + idx}
              x1={s.x} y1={s.y} x2={t.x} y2={t.y}
              stroke={statusColor(link.status)}
              strokeWidth="1.5"
              strokeDasharray={edgeStrokeDash(link.status)}
              opacity={dim * 0.55}
              strokeLinecap="round"
            />
          );
        })}

        {/* Ghost referrer nodes (predicted) */}
        {nodesRef.current.filter(n => n.kind === "ghost").map(n => {
          const dim = hoverId && hoverId !== n.id ? 0.3 : 1;
          const name = n.data?.name || "";
          return (
            <g
              key={n.id}
              opacity={dim}
              style={{ cursor: "pointer" }}
              onMouseEnter={(e) => handleEnter(n.id, e)}
              onClick={() => onNodeClick && onNodeClick({ kind: "ghost", data: n.data })}
            >
              <circle cx={n.x} cy={n.y} r={n.radius} fill="url(#ghostGradD3)" filter="url(#purpleHaloD3)" opacity="0.95" />
              <text x={n.x} y={n.y + 4} fontSize="11" fill="#fff" textAnchor="middle" fontWeight="700">{getInitials(name)}</text>
              <text x={n.x} y={n.y - n.radius - 14} fontSize="10.5" fill={C.btn} textAnchor="middle" fontWeight="600" opacity="0.85">{name.length > 16 ? name.slice(0, 15) + "…" : name}</text>
              <text x={n.x} y={n.y + n.radius + 16} fontSize="10" fill={C.btn} textAnchor="middle" fontWeight="700" letterSpacing="0.5">ASK?</text>
            </g>
          );
        })}

        {/* Referrer nodes */}
        {nodesRef.current.filter(n => n.kind === "referrer").map(n => {
          const dim = hoverId && hoverId !== n.id ? 0.4 : 1;
          const highlighted = hoverId === n.id;
          const name = n.data?.name || "Unknown";
          const displayName = name.length > 18 ? name.slice(0, 17) + "…" : name;
          return (
            <g
              key={n.id}
              opacity={dim}
              style={{ cursor: "pointer" }}
              onMouseEnter={(e) => handleEnter(n.id, e)}
              onClick={() => onNodeClick && onNodeClick({ kind: "referrer", data: n.data })}
            >
              <circle cx={n.x} cy={n.y} r={highlighted ? n.radius + 4 : n.radius} fill={getAvatarColor(n.id)} stroke="#fff" strokeWidth="3" filter="url(#softShadowD3)" style={{ transition: "r 180ms" }} />
              <text x={n.x} y={n.y + 4} fontSize="11" fill="#fff" textAnchor="middle" fontWeight="700">{getInitials(name)}</text>
              <text x={n.x} y={n.y - n.radius - 14} fontSize="12" fill={C.text} textAnchor="middle" fontWeight="600">{displayName}</text>
              {n.data?.revenue > 0 && (
                <text x={n.x} y={n.y - n.radius - 28} fontSize="10" fill={C.retGood} textAnchor="middle" fontWeight="700">${(n.data.revenue / 1000).toFixed(n.data.revenue >= 10000 ? 0 : 1)}k/mo</text>
              )}
            </g>
          );
        })}

        {/* Child nodes */}
        {nodesRef.current.filter(n => n.kind === "child").map(n => {
          const ch = n.data;
          const color = statusColor(ch.status);
          const parentHovered = hoverId === ("ref:" + n.parentId);
          const meHovered = hoverId === n.id;
          const dim = hoverId && !parentHovered && !meHovered ? 0.15 : 1;
          const recent = isRecent(ch);
          const hasName = ch.hasName;
          const rawName = ch.name || "Untitled";
          const displayName = rawName.length > 16 ? rawName.slice(0, 15) + "…" : rawName;
          return (
            <g
              key={n.id}
              opacity={dim}
              style={{ cursor: "pointer" }}
              onMouseEnter={(e) => handleEnter(n.id, e)}
              onClick={() => onNodeClick && onNodeClick({ kind: "child", data: ch })}
            >
              {recent && (
                <circle cx={n.x} cy={n.y} r="14">
                  <animate attributeName="r" values="7;18;7" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="fill" values={color + ";" + color + ";" + color} dur="2s" repeatCount="indefinite" />
                </circle>
              )}
              <circle cx={n.x} cy={n.y} r={meHovered ? n.radius + 2 : n.radius} fill={color} filter="url(#softShadowD3)" style={{ transition: "r 180ms" }} />
              <circle cx={n.x} cy={n.y} r="3" fill="#fff" opacity="0.9" />
              {hasName ? (
                <text x={n.x} y={n.y + n.radius + 14} fontSize="11" fill={C.text} textAnchor="middle" fontWeight="500">{displayName}</text>
              ) : (
                <text x={n.x} y={n.y + n.radius + 14} fontSize="10.5" fill={C.textMuted} textAnchor="middle" fontStyle="italic" fontWeight="500">? add name</text>
              )}
              {ch.mrr > 0 && (
                <text x={n.x} y={n.y + n.radius + 28} fontSize="9.5" fill={C.textMuted} textAnchor="middle" fontWeight="500">${(ch.mrr / 1000).toFixed(ch.mrr >= 10000 ? 0 : 1)}k/mo</text>
              )}
            </g>
          );
        })}

        {/* Hub (you) */}
        {(() => {
          const hub = findNode("__hub__");
          if (!hub) return null;
          return (
            <g>
              <circle cx={hub.x} cy={hub.y} r="42" fill={C.primary} stroke="#fff" strokeWidth="4" filter="url(#softShadowD3)" />
              <text x={hub.x} y={hub.y + 4} fontSize="12" fill="#fff" textAnchor="middle" fontWeight="700" letterSpacing="0.8">YOU</text>
            </g>
          );
        })()}
      </svg>

      {/* Tooltip — appears next to hovered node */}
      {hoverId && tooltipPos && (() => {
        const n = findNode(hoverId);
        if (!n) return null;
        if (n.kind === "referrer") {
          const r = n.data;
          const conv = r.children.filter(c => c.status === "converted" || c.status === "active" || c.status === "closed").length;
          const pending = r.children.filter(c => c.status === "pending").length;
          const lost = r.children.length - conv - pending;
          return (
            <div style={{
              position: "absolute",
              left: Math.min(tooltipPos.x + 14, W - 240),
              top: Math.max(8, tooltipPos.y - 10),
              background: C.card,
              borderRadius: 10,
              padding: "10px 12px",
              boxShadow: "0 8px 20px rgba(10,10,10,0.10), 0 2px 4px rgba(10,10,10,0.06)",
              minWidth: 220,
              maxWidth: 260,
              pointerEvents: "none",
              zIndex: 50,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>{r.name}</div>
              <div style={{ fontSize: 11.5, color: C.textMuted, lineHeight: 1.6 }}>
                <div>{r.children.length} {r.children.length === 1 ? "referral" : "referrals"} sent</div>
                {(conv > 0 || pending > 0 || lost > 0) && (
                  <div style={{ display: "flex", gap: 10, marginTop: 2 }}>
                    {conv > 0 && <span style={{ color: C.retGood }}>● {conv} converted</span>}
                    {pending > 0 && <span style={{ color: "#D17A1B" }}>● {pending} pending</span>}
                    {lost > 0 && <span style={{ color: C.textMuted }}>● {lost} lost</span>}
                  </div>
                )}
                {r.revenue > 0 && <div style={{ marginTop: 4, color: C.text, fontWeight: 600 }}>${r.revenue.toLocaleString()}/mo total</div>}
              </div>
            </div>
          );
        }
        if (n.kind === "child") {
          const ch = n.data;
          return (
            <div style={{
              position: "absolute",
              left: Math.min(tooltipPos.x + 14, W - 240),
              top: Math.max(8, tooltipPos.y - 10),
              background: C.card,
              borderRadius: 10,
              padding: "10px 12px",
              boxShadow: "0 8px 20px rgba(10,10,10,0.10), 0 2px 4px rgba(10,10,10,0.06)",
              minWidth: 200,
              maxWidth: 260,
              pointerEvents: "none",
              zIndex: 50,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: ch.hasName ? C.text : C.textMuted, fontStyle: ch.hasName ? "normal" : "italic", marginBottom: 4 }}>
                {ch.hasName ? ch.name : "Name not set — click to edit"}
              </div>
              <div style={{ fontSize: 11.5, color: C.textMuted, lineHeight: 1.6 }}>
                <div>Status: <span style={{ color: statusColor(ch.status), fontWeight: 600 }}>{ch.status}</span></div>
                {ch.mrr > 0 && <div>${ch.mrr.toLocaleString()}/mo</div>}
                {ch.totalRevenue > 0 && <div>${ch.totalRevenue.toLocaleString()} total</div>}
                {ch.on && <div style={{ marginTop: 2, fontSize: 10.5 }}>Referred {ch.on}</div>}
              </div>
            </div>
          );
        }
        if (n.kind === "ghost") {
          const p = n.data;
          return (
            <div style={{
              position: "absolute",
              left: Math.min(tooltipPos.x + 14, W - 240),
              top: Math.max(8, tooltipPos.y - 10),
              background: C.card,
              border: "none",
              borderRadius: 12,
              padding: "10px 12px",
              boxShadow: "var(--rt-sh-purple)",
              minWidth: 200,
              maxWidth: 260,
              pointerEvents: "none",
              zIndex: 50,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>{p.name}</div>
              <div style={{ fontSize: 11.5, color: C.textMuted, lineHeight: 1.6 }}>
                <div style={{ color: C.btn, fontWeight: 600 }}>Likely to refer</div>
                {p.reason && <div style={{ marginTop: 2 }}>{p.reason}</div>}
                <div style={{ marginTop: 4, color: C.btn, fontWeight: 600 }}>Click to draft an ask →</div>
              </div>
            </div>
          );
        }
        return null;
      })()}
    </div>
  );
}


export default function App({ user }) {
  // ─── ROUTING: Worker magic-link page lives at /w/{token} (no auth needed) ──
  // Detect this route before any auth-gated logic runs. Returns WorkerDashboard
  // standalone if matched.
  if (typeof window !== "undefined" && /^\/w\//.test(window.location.pathname)) {
    return <WorkerDashboard />;
  }

  // Tier flag — currently fixed at "core" everywhere. Kept as a constant
  // (not state) since setTier was never called and the value never
  // changes at runtime. When enterprise toggling is wired up, restore
  // useState here and add a setter call site.
  const tier = "core";  // "core" | "enterprise"
  const [page, setPage] = useState("today");

  // Scroll to top on page change. .r-main is now a fixed-positioned scroll
  // container (not the document), so we reset its scrollTop plus the Rai
  // chat's internal scroller. The document itself no longer scrolls, so no
  // window.scrollTo needed.
  useEffect(() => {
    document.querySelectorAll(".r-main, .r-rai-scroll").forEach(el => { el.scrollTop = 0; });
    // Mobile nav: scroll the active item into view inside the horizontal strip
    // so destinations that scroll off-screen are reachable. We use scrollIntoView
    // with inline:"center" so the active pill sits roughly mid-strip, leaving
    // peeks of neighbors on either side.
    const navEl = mobileNavRef.current;
    if (navEl) {
      const activeItem = navEl.querySelector(`[data-nav-id="${page}"]`);
      if (activeItem && typeof activeItem.scrollIntoView === "function") {
        try {
          activeItem.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
        } catch (e) { /* older browsers ignore options arg silently */ }
      }
    }
  }, [page]);
  // iOS Safari viewport fix — when the address bar collapses/expands, 100vh doesn't update,
  // leaving fixed-positioned elements (like the bottom nav) anchored to the wrong bottom.
  // visualViewport API tracks the actual visible viewport. We write its height to a CSS var
  // that components can use instead of 100vh. Falls back gracefully on non-supporting browsers.
  // Also: detect keyboard open on mobile so we can hide the bottom nav (iOS covers the input
  // with the keyboard + the fixed bottom nav, making the input unreachable).
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  // Breakpoint tracking. We use this for components that need to render
  // structurally different JSX on mobile vs desktop (rather than the
  // CSS-media-query approach used elsewhere in the app, which works well
  // for visual variants but breaks down when the layouts diverge enough
  // that responsive classes start fighting inline styles). The Observer
  // card is the first such component — too many !important rules became
  // brittle. Single source of truth, no className/style conflicts.
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const update = () => {
      document.documentElement.style.setProperty("--app-h", `${vv.height}px`);
      // Track visual viewport offset within the layout viewport. When the user
      // pinch-zooms, the visible area scrolls inside the page; without this offset,
      // fixed elements (like the bottom nav) stay anchored to the layout viewport
      // and visually drift away from the actual bottom of the screen.
      document.documentElement.style.setProperty("--vv-offset-top", `${vv.offsetTop}px`);
      // Keyboard is considered open when the visual viewport is meaningfully shorter
      // than the layout viewport. 100px threshold catches most mobile keyboards while
      // avoiding false positives on URL-bar collapse (which is typically ~60-80px).
      const gap = window.innerHeight - vv.height;
      setKeyboardOpen(gap > 100);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientTab, setClientTab] = useState("overview");
  const [clientBilling, setClientBilling] = useState({});
  // Per-(client, month) invoiced/paid status, hydrated on load.
  // Shape: { [client_id]: { [month]: { id, invoiced, paid, invoiced_at, paid_at } } }
  const [billingMonthStatus, setBillingMonthStatus] = useState({});
  // Per-client billing-terms log entries, newest first within each client.
  // Shape: { [client_id]: [{ id, body, created_at, updated_at }, ...] }
  const [billingTerms, setBillingTerms] = useState({});
  // UI state for billing terms flap (in client modal Billing tab):
  //   - termsHistoryOpen: { [client_id]: boolean }  expand history below current
  //   - termsEditingId:   id of entry being edited (one at a time)
  //   - termsEditDraft:   text content of the edit/new draft
  //   - termsAddingNew:   { [client_id]: boolean }  show new-entry textarea
  const [termsHistoryOpen, setTermsHistoryOpen] = useState({});
  const [termsEditingId, setTermsEditingId] = useState(null);
  const [termsEditDraft, setTermsEditDraft] = useState("");
  const [termsAddingNew, setTermsAddingNew] = useState({});
  const [billingAddOpen, setBillingAddOpen] = useState(false);
  const [billingNewItem, setBillingNewItem] = useState({ description: "", amount: "", recurring: false });
  const [editingOverview, setEditingOverview] = useState(false);
  const [overviewEditData, setOverviewEditData] = useState({});
  const [editingProfile, setEditingProfile] = useState(false);
  const [editScores, setEditScores] = useState({});
  // Toggle for the "edit historical baseline" disclosure inside the edit-client
  // modal. Hidden by default — most users will never need to touch this.
  // Resets when client modal opens (handled by the selectedClient reset effect).
  const [showBaselineEdit, setShowBaselineEdit] = useState(false);

  // Sidebar tasks-completed widget state. Counts hydrate on app load via
  // tasksDb.getCompletedCounts. Period toggles between week/month/year and
  // is local state — resets to 'week' on each session.
  const [taskCompletedCounts, setTaskCompletedCounts] = useState({
    today: 0, week: 0, month: 0, year: 0,
    weekHistory: Array(12).fill(0),
    monthHistory: Array(12).fill(0),
    dayStreak: 0,
  });
  const [taskCompletedPeriod, setTaskCompletedPeriod] = useState("week");

  // Reset modal edit state when the selected client changes (or closes).
  // Without this, opening client B after editing client A leaves B's modal
  // showing A's stale edit form data — the inputs don't refresh because
  // overviewEditData persists across modal open/close cycles. Same pattern
  // for the relationship-profile edit form. Triggered on selectedClient.id
  // change specifically so re-renders within the same client (eg. saving
  // edits) don't bounce the form.
  //
  // Confirm dialogs (rolodexConfirm, removeConfirm) are reset by the click
  // handlers themselves on each tile open — they're declared further down
  // and aren't safe to reference here.
  useEffect(() => {
    setEditingOverview(false);
    setOverviewEditData({});
    setEditingProfile(false);
    setEditScores({});
    setShowBaselineEdit(false);
  }, [selectedClient?.id]);
  // ═══ DATA LOADING ═══
  const [dataLoaded, setDataLoaded] = useState(false);
  const [hcQueue, setHcQueue] = useState([]);
  const [todayStripOpen, setTodayStripOpen] = useState(false);
  // Sidebar collapse state — when true, sidebar is 64px wide with icon-only
  // nav, "R." brand mark, and hidden secondary sections (convo list, widget).
  // Persisted in localStorage so user preference survives reloads.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return window.localStorage.getItem("retayned:sidebarCollapsed") === "1"; } catch { return false; }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem("retayned:sidebarCollapsed", sidebarCollapsed ? "1" : "0"); } catch {}
    // Sync the CSS var that .r-main reads to compute its left edge. The
    // root selector defines a default; this override updates it at runtime
    // so the main content area resizes to fill the freed horizontal space.
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--sidebar-w", sidebarCollapsed ? "64px" : "240px");
    }
  }, [sidebarCollapsed]);
  // Whether the Rai pick text is expanded on mobile. Desktop ignores this
  // — the clamp only applies via mobile @media. On mobile: false = clamped
  // to 2 lines with fade-out + "More" tap. Resets daily implicitly because
  // the pick changes each morning.
  const [pickExpanded, setPickExpanded] = useState(false);
  // Rai user state — toggle + adaptive frequency state from rai_user_state table.
  // Loaded once on mount in loadData, kept in sync via realtime subscription.
  // Single user-controllable boolean:
  //   - ranking_enabled: "Ranked by Rai / Manual" toggle (eventually replaces localStorage rankMode)
  // Initialized null so we can distinguish "not yet loaded" from "loaded with defaults".
  const [raiState, setRaiState] = useState(null);
  // Active Rai picks — array of 1-3 rows pointing at clients, ordered by rank
  // (1=primary, 2=backup1, 3=backup2). Sweep writes them with 24-hr expiry.
  // Empty array when no active picks (sweep hasn't run, expired, or skipped).
  // The Pick of the Day. Either a row from rai_picks (today's pick) or null
  // (no pick today, or sweep hasn't run yet). Realtime sub keeps this in
  // sync if a fresh sweep lands while app is open.
  const [raiPicks, setRaiPicks] = useState(null);
  // Today timeline — personal calendar events (manual + future Google sync).
  // Currently only manual rows are written from the app. The TodayTimeline
  // widget reads from this state to render the timeline view of today.
  const [personalEvents, setPersonalEvents] = useState([]);
  // Whether the user has dismissed the "Connect Google Calendar" nudge
  // on the Today page. Persisted to profiles.google_cal_prompt_dismissed
  // so it stays dismissed across refreshes/devices. The Settings →
  // Integrations row is unaffected — it always offers the connection.
  const [googleCalPromptDismissed, setGoogleCalPromptDismissed] = useState(false);
  // User's IANA timezone, sourced from profiles.timezone. The single source
  // of truth for any local-day math in the frontend (midnight rollover,
  // recurring-task reset cutoff). Falls back to the device's detected TZ
  // ONLY until the profile loads — never overwrites a stored value from
  // the device (that's how the Eastern-vs-Denver drift bug happened pre-fix).
  // null means "not loaded yet"; effects that depend on it must guard.
  const [userTimezone, setUserTimezone] = useState(null);
  // Burst tracker — per-client timestamp of most recent task creation.
  // Used by the 60s burst rule (with 5-min hard cap) to keep the "Rai's pick"
  // badge from flickering while the user is rapidly creating tasks for a
  // picked client. Lives in a ref so updates don't trigger renders.
  // Shape: { [clientName]: { firstCreatedAt: ms, lastCreatedAt: ms } }
  const raiBurstTrackerRef = useRef({});
  // Mobile bottom nav strip — horizontally scrollable. We auto-scroll the
  // active item into view whenever `page` changes, so navigating to a
  // destination off-screen pulls it into the visible window.
  const mobileNavRef = useRef(null);
  // Focus mode: laser-focus on top task, dim everything else. Only available in Rai mode.
  // Not persisted — resets to off on each session/page reload.
  const [focusMode, setFocusMode] = useState(false);
  // One-shot flash trigger when entering Focus mode. Cleared after animation completes.
  // (Removed focusFlash state — the lightning entry animation was retired
  // in favor of the calmer/subtler UI language. Focus mode now just toggles
  // its button + dims non-top tasks; no full-screen white burst.)
  // Debug overlay — shows priority score breakdown inline on each task row.
  // Toggle with Cmd+Shift+D (Mac) or Ctrl+Shift+D (Windows). Internal tool;
  // not user-facing.
  const [debugScores, setDebugScores] = useState(false);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        setDebugScores(v => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // Rank mode: 'rai' (default, sorted by Profile Score) or 'manual' (user drag-and-drop order).
  // Persisted in localStorage. Manual order also persisted, restored when user toggles back to manual.
  const [rankMode, _setRankMode] = useState(() => {
    if (typeof window === "undefined") return "rai";
    try { return window.localStorage.getItem("rt_rank_mode") || "rai"; } catch { return "rai"; }
  });
  const setRankMode = (m) => {
    _setRankMode(m);
    if (m !== "rai") setFocusMode(false);
    try { window.localStorage.setItem("rt_rank_mode", m); } catch {}
  };
  const [manualTaskOrder, _setManualTaskOrder] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem("rt_manual_task_order");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const setManualTaskOrder = (order) => {
    _setManualTaskOrder(order);
    try { window.localStorage.setItem("rt_manual_task_order", JSON.stringify(order)); } catch {}
  };
  const [draggingTaskId, setDraggingTaskId] = useState(null);
  // Mobile swipe state — tracks touch translation per task ID.
  // swipeOffset[id] = current x offset (negative when swiping left).
  // swipeStartX[id] = the touchStart X coordinate.
  // Used to drag a task left to reveal a "push to next bucket" action.
  const [swipeOffset, setSwipeOffset] = useState({});
  const [swipeStartX, setSwipeStartX] = useState({});
  // Track touchstart Y coord and the gesture lock state per task.
  // Used to commit a gesture as either "scroll" or "swipe" once the
  // user's finger has moved enough to indicate intent (see touch
  // handlers in the task row render). Industry-standard pattern that
  // prevents accidental row drift while scrolling vertically.
  const [swipeStartY, setSwipeStartY] = useState({});
  const [swipeLock, setSwipeLock] = useState({});
  const [dragOverTaskId, setDragOverTaskId] = useState(null);
  const [healthStripOpen, setHealthStripOpen] = useState(false);
  const [retroAnswers, setRetroAnswers] = useState({});
  const [rolodex, setRolodex] = useState([]);
  const [rolodexFlowOpen, setRolodexFlowOpen] = useState(null);
  const [showAddRolodex, setShowAddRolodex] = useState(false);
  const [newRolodexEntry, setNewRolodexEntry] = useState({ client: "", contact: "", work: "", type: "former" });
  const [rolodexConfirm, setRolodexConfirm] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const [pauseConfirm, setPauseConfirm] = useState(false);
  const [resumeConfirm, setResumeConfirm] = useState(false);
  const [selectedRolodex, setSelectedRolodex] = useState(null);
  const [rolodexRemoveConfirm, setRolodexRemoveConfirm] = useState(false);
  const [rolodexEditing, setRolodexEditing] = useState(false);
  const [rolodexEditData, setRolodexEditData] = useState({});
  const [rolodexSearch, setRolodexSearch] = useState("");
  // Rolodex v2 — step-based retro state. stepOwner ties step + text to a specific entry so switching contacts mid-retro resets cleanly.
  const [rolodexStep, setRolodexStep] = useState(null);
  const [rolodexStepOwner, setRolodexStepOwner] = useState(null);
  const [rolodexStepText, setRolodexStepText] = useState(null);
  const [rolodexFiledFilter, setRolodexFiledFilter] = useState("all");
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [reminderDate, setReminderDate] = useState("");
  const [clients, setClients] = useState([]);
  const [showAddClient, setShowAddClient] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [clientsSort, setClientsSort] = useState("retention");
  // Clients page filter chips — see toolbar render. Both default to "all".
  // Drift: one of "all" | "Improving" | "Stable" | "Something shifted" | "Declining" | "At risk"
  // Score: one of "all" | "thriving" | "healthy" | "watch" | "atrisk"
  const [clientsDriftFilter, setClientsDriftFilter] = useState("all");
  const [clientsScoreFilter, setClientsScoreFilter] = useState("all");
  const [clientsView, setClientsView] = useState(() => {
    try { return localStorage.getItem("clients-view") || "table"; } catch (e) { return "table"; }
  });
  // Persist view choice
  useEffect(() => {
    try { localStorage.setItem("clients-view", clientsView); } catch (e) {}
  }, [clientsView]);
  const [showImport, setShowImport] = useState(false);
  const [importTab, setImportTab] = useState("csv"); // "csv" | "paste"
  const [importPaste, setImportPaste] = useState("");
  const [importPreview, setImportPreview] = useState([]);
  const [importFile, setImportFile] = useState(null);
  const [newClient, setNewClient] = useState({ name: "", contact: "", role: "", tag: "", revenue: "", months: "", lifetime_revenue_at_entry: "", latePayments: false, prevTerminated: false, otherVendors: false, fromReferral: false });
  const [profileStep, setProfileStep] = useState(0);
  const [profileScores, setProfileScores] = useState({});

  const profileDimensions = [
    { key: "trust", name: "Trust", desc: "Does this client trust you to do your job?", left: "Heavy oversight", right: "Full delegation", weight: 0.15, values: [0.00, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00] },
    { key: "loyalty", name: "Loyalty", desc: "Is this client looking at other options?", left: "Actively shopping", right: "Locked in, not looking", weight: 0.15, values: [0.00, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00] },
    { key: "expectations", name: "Expectations", desc: "Are the client's expectations for your work realistic?", left: "Highly ambitious", right: "Reasonable, aligned", weight: 0.15, values: [0.00, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00] },
    { key: "grace", name: "Grace", desc: "When something goes wrong, how does this client react?", left: "Zero tolerance", right: "Gives benefit of the doubt", weight: 0.15, values: [0.00, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00] },
    { key: "commFrequency", name: "Communication Frequency", desc: "How often does the client reach out to you?", left: "Radio silence, you always initiate", right: "Nonstop, multiple times a day", weight: 0.05, values: [0.20, 0.40, 0.60, 0.80, 0.90, 1.00, 0.90, 0.80, 0.60, 0.40, 0.20] },
    { key: "stressResponse", name: "Stress Response", desc: "When results are bad or something goes wrong, how do you find out?", left: "You don't — they go quiet and deal with it internally", right: "Immediately — they call, escalate, make it known", weight: 0.05, values: [0.05, 0.20, 0.50, 0.85, 1.00, 1.00, 1.00, 0.85, 0.65, 0.40, 0.20] },
    { key: "budgetCommitment", name: "Budget Commitment", desc: "How likely is budget to become a reason this client leaves?", left: "Very likely, always under budget pressure", right: "Never, budget is a non-issue", weight: 0.05, values: [0.00, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00] },
    { key: "relationshipDepth", name: "Relationship Depth", desc: "Beyond business, is there a real relationship here?", left: "Strictly transactional", right: "Genuine connection", weight: 0.05, values: [0.20, 0.30, 0.40, 0.60, 0.80, 0.85, 0.90, 0.95, 1.00, 0.95, 0.90] },
    { key: "reportingNeed", name: "Reporting Need", desc: "How much reporting does this client need from you?", left: "Hands-off, minimal updates", right: "Wants every detail", weight: 0.05, values: [0.50, 0.80, 0.85, 0.90, 0.95, 1.00, 0.95, 0.90, 0.80, 0.50, 0.20] },
    { key: "replaceability", name: "Replaceability", desc: "How easy would it be for this client to replace you?", left: "Plug and play, anyone could do it", right: "Deeply embedded, hard to replace", weight: 0.05, values: [0.00, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00] },
    { key: "commTone", name: "Communication Tone", desc: "How does this client communicate with you?", left: "Reserved, guarded", right: "Warm, direct", weight: 0.05, values: [0.00, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00] },
    { key: "decisionMaking", name: "Decision Making", desc: "How much authority does your primary contact have?", left: "No authority, just a relay", right: "Full authority, makes the call", weight: 0.05, values: [0.00, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00] },
  ];

  // ─── COMBO DEFINITIONS ───
  const COMBOS = [
    { name: "Bulletproof", type: "positive", max: 2, dims: [{ key: "loyalty", dir: "gte", threshold: 8 }, { key: "grace", dir: "gte", threshold: 8 }] },
    { name: "True partner", type: "positive", max: 2, dims: [{ key: "trust", dir: "gte", threshold: 8 }, { key: "relationshipDepth", dir: "gte", threshold: 7 }] },
    { name: "Locked vault", type: "positive", max: 2, dims: [{ key: "loyalty", dir: "gte", threshold: 8 }, { key: "replaceability", dir: "gte", threshold: 7 }] },
    { name: "Smooth operator", type: "positive", max: 1, dims: [{ key: "commTone", dir: "gte", threshold: 8 }, { key: "expectations", dir: "gte", threshold: 7 }] },
    { name: "Resilient under fire", type: "positive", max: 1, dims: [{ key: "stressResponse", dir: "between", threshold: 4, upper: 6 }, { key: "grace", dir: "gte", threshold: 7 }] },
    { name: "All-in investor", type: "positive", max: 1, dims: [{ key: "budgetCommitment", dir: "gte", threshold: 8 }, { key: "trust", dir: "gte", threshold: 7 }] },
    { name: "Decision express", type: "positive", max: 1, dims: [{ key: "decisionMaking", dir: "gte", threshold: 8 }, { key: "commFrequency", dir: "between", threshold: 3, upper: 7 }] },
    { name: "Open book", type: "positive", max: 1, dims: [{ key: "commTone", dir: "gte", threshold: 7 }, { key: "stressResponse", dir: "between", threshold: 4, upper: 6 }] },
    { name: "Sticky by design", type: "positive", max: 1, dims: [{ key: "replaceability", dir: "gte", threshold: 7 }, { key: "relationshipDepth", dir: "gte", threshold: 7 }] },
    { name: "Low maintenance loyalty", type: "positive", max: 1, dims: [{ key: "loyalty", dir: "gte", threshold: 7 }, { key: "reportingNeed", dir: "between", threshold: 2, upper: 5 }] },
    { name: "Ticking time bomb", type: "negative", max: 2, dims: [{ key: "expectations", dir: "lte", threshold: 3 }, { key: "grace", dir: "lte", threshold: 3 }] },
    { name: "On the clock", type: "negative", max: 2, dims: [{ key: "trust", dir: "lte", threshold: 3 }, { key: "loyalty", dir: "lte", threshold: 3 }] },
    { name: "No room to operate", type: "negative", max: 2, dims: [{ key: "trust", dir: "lte", threshold: 3 }, { key: "grace", dir: "lte", threshold: 3 }] },
    { name: "One foot out", type: "negative", max: 2, dims: [{ key: "loyalty", dir: "lte", threshold: 3 }, { key: "replaceability", dir: "lte", threshold: 3 }] },
    { name: "Silent exit", type: "negative", max: 1, dims: [{ key: "stressResponse", dir: "lte", threshold: 2 }, { key: "commFrequency", dir: "lte", threshold: 2 }] },
    { name: "Powder keg", type: "negative", max: 1, dims: [{ key: "stressResponse", dir: "gte", threshold: 8 }, { key: "expectations", dir: "lte", threshold: 3 }] },
    { name: "Ice wall", type: "negative", max: 1, dims: [{ key: "commTone", dir: "lte", threshold: 3 }, { key: "trust", dir: "lte", threshold: 3 }] },
    { name: "Nickel and dime", type: "negative", max: 1, dims: [{ key: "budgetCommitment", dir: "lte", threshold: 2 }, { key: "reportingNeed", dir: "gte", threshold: 8 }] },
    { name: "No anchor", type: "negative", max: 1, dims: [{ key: "relationshipDepth", dir: "lte", threshold: 2 }, { key: "replaceability", dir: "lte", threshold: 3 }] },
    { name: "Bottleneck doom", type: "negative", max: 1, dims: [{ key: "decisionMaking", dir: "lte", threshold: 3 }, { key: "expectations", dir: "lte", threshold: 4 }] },
  ];

  // ─── COMBO STRENGTH CALC ───
  const calcComboStrength = (dimDef, rawVal) => {
    if (rawVal == null) return null;
    if (dimDef.dir === "gte") { if (rawVal < dimDef.threshold) return null; const r = 10 - dimDef.threshold; return r === 0 ? 1 : 0.2 + ((rawVal - dimDef.threshold) / r) * 0.8; }
    if (dimDef.dir === "lte") { if (rawVal > dimDef.threshold) return null; const r = dimDef.threshold; return r === 0 ? 1 : 0.2 + ((dimDef.threshold - rawVal) / r) * 0.8; }
    if (dimDef.dir === "between") { if (rawVal < dimDef.threshold || rawVal > dimDef.upper) return null; const mid = (dimDef.threshold + dimDef.upper) / 2; const hr = (dimDef.upper - dimDef.threshold) / 2; return hr === 0 ? 1 : 0.2 + ((hr - Math.abs(rawVal - mid)) / hr) * 0.8; }
    return null;
  };

  const calcCombos = (scores) => {
    const dimWeights = {};
    profileDimensions.forEach(d => { dimWeights[d.key] = d.weight; });
    const triggered = [];
    for (const combo of COMBOS) {
      const strengths = combo.dims.map(d => calcComboStrength(d, scores[d.key]));
      if (strengths.some(s => s === null)) continue;
      let ws = 0, tw = 0;
      combo.dims.forEach((d, i) => { ws += strengths[i] * (dimWeights[d.key] || 0.05); tw += (dimWeights[d.key] || 0.05); });
      const norm = tw > 0 ? ws / tw : 0;
      const value = Math.round(norm * combo.max * 100) / 100;
      triggered.push({ name: combo.name, type: combo.type, max: combo.max, value: combo.type === "negative" ? -value : value, strength: Math.round(norm * 100) });
    }
    return triggered;
  };

  // ─── HEALTH CHECK SCORING ───
  const HC_QUESTIONS_SCORED = [
    { key: "bigMovers", weight: 0.40 },
    { key: "holisticDrift", weight: 0.20 },
    { key: "commChange", weight: 0.20 },
    { key: "gutCheck", weight: 0.10 },
    { key: "performanceDrift", weight: 0.10 },
  ];

  const calcHealthCheckScore = (hcAnswersArr) => {
    if (!hcAnswersArr || hcAnswersArr.length < 5) return null;
    let ws = 0, tw = 0;
    HC_QUESTIONS_SCORED.forEach((q, i) => {
      const v = hcAnswersArr[i];
      if (v == null) return;
      ws += (v / 10) * q.weight;
      tw += q.weight;
    });
    if (tw === 0) return null;
    return Math.round((ws / tw) * 100);
  };

  // ─── RETENTION SCORE (dimensions + combos + HC blend) ───
  const calcRetentionScore = (scores, hcAnswersArr, qualFlags = null, months = 0) => {
    let weightedSum = 0, totalWeight = 0, scored = 0;
    for (const dim of profileDimensions) {
      const raw = scores[dim.key];
      if (raw == null || raw === "") continue;
      const val = dim.values[Math.round(Math.max(0, Math.min(10, raw)))];
      const rw = dim.weight;
      weightedSum += val * rw;
      totalWeight += rw;
      scored++;
    }
    if (totalWeight === 0) return null;
    // Renormalize if not all dimensions scored
    const dimensionScore = Math.round((weightedSum / totalWeight) * 100);

    // Combos
    const triggered = calcCombos(scores);
    const positives = triggered.filter(c => c.type === "positive").sort((a, b) => b.value - a.value);
    const negatives = triggered.filter(c => c.type === "negative").sort((a, b) => a.value - b.value);
    const posH = [1.0, 0.75, 0.50, 0.25, 0.125, 0.0625, 0.03, 0.015, 0.01, 0.005];
    const negD = [1.0, 0.90, 0.80, 0.70, 0.60, 0.50, 0.40, 0.30, 0.20, 0.10];
    let pt = 0, nt = 0;
    positives.forEach((c, i) => { c.dm = posH[i] || 0.005; c.dv = Math.round(c.value * c.dm * 100) / 100; pt += c.dv; });
    negatives.forEach((c, i) => { c.dm = negD[i] || 0.10; c.dv = Math.round(c.value * c.dm * 100) / 100; nt += c.dv; });
    const comboTotal = Math.round((pt + nt) * 100) / 100;
    const baselineScore = dimensionScore + Math.round(comboTotal);

    // HC blend: 80% baseline + 20% HC
    const hcScore = calcHealthCheckScore(hcAnswersArr);
    let finalScore = hcScore != null ? Math.round(baselineScore * 0.80 + hcScore * 0.20) : baselineScore;

    // Qualifying question adjustments
    if (qualFlags) {
      if (qualFlags.latePayments) finalScore -= 4;
      if (qualFlags.prevTerminated) finalScore -= 8;
      if (qualFlags.otherVendors) finalScore -= 3;
      if (qualFlags.fromReferral) finalScore += 2;
    }

    // Tenure bonus: +1 per year, cap +5
    const tenureYears = Math.floor((months || 0) / 12);
    finalScore += Math.min(5, tenureYears);

    // Block 0 and 100, clamp 1-99
    if (finalScore <= 0) finalScore = 1;
    if (finalScore >= 100) finalScore = 99;
    finalScore = Math.max(1, Math.min(99, finalScore));

    return finalScore;
  };

  // ─── PROFILE SCORE (invisible sort layer) ───
  const percentileRank = (arr, val) => { if (arr.length <= 1) return 0.5; const s = [...arr].sort((a, b) => a - b); return s.indexOf(val) / (s.length - 1); };

  // Referral-adjusted LTV: client's own honest LTV + 50% of revenue from
  // clients they referred. Honest LTV = lifetime_revenue_at_entry +
  // sum(monthly_rate × time_in_period) across the client_revenue_history table.
  // Computed at hydration time and stored as `client.ltv`. Rate changes go
  // through revenueHistoryDb.changeRate which triggers a fresh hydration.
  //
  // Referrals stay on the same model — they're an estimate of attribution
  // value, not historical revenue. We pull the referred client's honest LTV
  // from their `ltv` field too, falling back to a 12-month estimate for
  // referrals where the referred-to is not yet a Retayned client.
  // ─── Tenure math ─────────────────────────────────────────────
  // Single source of truth for "how long has this client been with
  // us." Uses engagement_started_at (immutable date set at signup)
  // and subtracts any pause intervals from client_engagement_pauses.
  //
  // Why a date column instead of a stored months integer:
  //   - A stored months value never grows, drifts wrong as time passes
  //   - A date is immutable, derivation always reflects current moment
  //   - Matches how every world-class CRM handles tenure (Stripe,
  //     Salesforce, HubSpot all store dates and derive durations)
  //
  // Pause handling: each pause subtracts (resumed_at - paused_at) from
  // total elapsed. If currently paused (resumed_at = null), use now as
  // the end of the open pause so tenure freezes during the pause.
  const monthsTogether = (client, pausesByClient) => {
    if (!client?.engagement_started_at) return 0;
    const MS_PER_MONTH = 30.44 * 24 * 60 * 60 * 1000;
    const startMs = new Date(client.engagement_started_at).getTime();
    const nowMs = Date.now();
    let elapsedMs = nowMs - startMs;
    const pauses = (pausesByClient && pausesByClient[client.id]) || [];
    for (const p of pauses) {
      const pStart = new Date(p.paused_at).getTime();
      const pEnd = p.resumed_at ? new Date(p.resumed_at).getTime() : nowMs;
      elapsedMs -= Math.max(0, pEnd - pStart);
    }
    return Math.max(0, Math.floor(elapsedMs / MS_PER_MONTH));
  };

  const isCurrentlyPaused = (clientId, pausesByClient) => {
    const pauses = (pausesByClient && pausesByClient[clientId]) || [];
    return pauses.some(p => !p.resumed_at);
  };

  const getAdjustedLTV = (client) => {
    const ownLTV = Number(client.ltv || 0);
    const referralRevenue = refs
      .filter(r => r.from === client.name && (r.status === "converted" || r.converted))
      .reduce((sum, r) => {
        const referredClient = clients.find(c => c.name === r.to);
        const refLTV = referredClient
          ? Number(referredClient.ltv || 0)
          : (r.revenue || 0) * 12;
        return sum + refLTV;
      }, 0);
    return ownLTV + (referralRevenue * 0.50);
  };

  const calcProfileScore = (rs, client, allClients) => {
    if (rs == null || allClients.length === 0) return rs || 0;
    const total = allClients.reduce((a, c) => a + (c.revenue || 0), 0);
    const avg = 1 / allClients.length;
    const revFactor = total > 0 ? ((client.revenue || 0) / total) / avg : 1;
    // Tightened ceiling: was 1.50, now 1.25. A client at 2-3× book-average revenue
    // no longer triggers a 50% multiplier — caps at 25%.
    const revNorm = Math.max(0.75, Math.min(1.25, 0.4 + revFactor * 0.6));
    const ltvF = 0.8 + percentileRank(allClients.map(c => getAdjustedLTV(c)), getAdjustedLTV(client)) * 0.4;
    const tenF = 0.8 + percentileRank(allClients.map(c => c.months || 0), client.months || 0) * 0.4;
    // Lowered floor: was 0.90, now 0.75. Lets struggling clients actually sink.
    const multiplier = Math.max(0.75, revNorm * 0.60 + ltvF * 0.20 + tenF * 0.20);
    const raw = rs * multiplier;
    // Soft compression: anything <= 85 untouched. Above 85, compress excess
    // to 50% so top-tier differences still register but don't dominate.
    // No hard ceiling — the score flows raw through to sort comparators.
    // Display layers round/cap for UI (the badge shows 99 max), but sort
    // needs the true magnitudes to break ties between top clients.
    const T = 85;
    const ratio = 0.50;
    const softClamped = raw <= T ? raw : T + (raw - T) * ratio;
    return Math.max(1, softClamped);
  };

  // Debug-only: returns the UNCAPPED raw value before the Math.min(99, ...) clamp.
  // Used by the debug overlay to surface true math so we can see how much
  // the 99-clamp is collapsing the top tier into ties.
  // Same logic as calcProfileScore but skips the upper clamp.
  const calcProfileScoreRaw = (rs, client, allClients) => {
    if (rs == null || allClients.length === 0) return rs || 0;
    const total = allClients.reduce((a, c) => a + (c.revenue || 0), 0);
    const avg = 1 / allClients.length;
    const revFactor = total > 0 ? ((client.revenue || 0) / total) / avg : 1;
    const revNorm = Math.max(0.75, Math.min(1.25, 0.4 + revFactor * 0.6));
    const ltvF = 0.8 + percentileRank(allClients.map(c => getAdjustedLTV(c)), getAdjustedLTV(client)) * 0.4;
    const tenF = 0.8 + percentileRank(allClients.map(c => c.months || 0), client.months || 0) * 0.4;
    const multiplier = Math.max(0.75, revNorm * 0.60 + ltvF * 0.20 + tenF * 0.20);
    // No upper clamp — return the raw multiplied value (rounded for readability).
    return Math.round(rs * multiplier * 10) / 10;  // one decimal for visibility
  };

  // ─── NEW CLIENT BOOST ───
  const calcNewClientBoost = (rs, revPct, daysSinceStart) => {
    if (rs < 40 || daysSinceStart >= 30) return 0;
    const bonusPts = Math.min(17.5, 17.5 * Math.pow(Math.min(revPct, 0.50) / 0.40, 0.50));
    const decay = Math.max(0, 1 - (daysSinceStart / 30));
    return Math.round(bonusPts * decay);
  };

  const submitNewClient = async () => {
    const qualFlags = { latePayments: newClient.latePayments, prevTerminated: newClient.prevTerminated, otherVendors: newClient.otherVendors, fromReferral: newClient.fromReferral };
    const baseline = calcRetentionScore(profileScores, null, qualFlags, parseInt(newClient.months) || 0);
    const monthlyRate = parseInt(newClient.revenue) || 0;
    const preEntryBaseline = parseFloat(newClient.lifetime_revenue_at_entry) || 0;
    const tenureMonths = parseInt(newClient.months) || 0;
    // Translate months input → engagement_started_at (immutable date).
    // User says "started 6 months ago", we store today - 6 months as the
    // start date. From there, tenure grows automatically over time.
    const engagementStart = new Date();
    engagementStart.setMonth(engagementStart.getMonth() - tenureMonths);
    const engagementStartedAt = localYmd(engagementStart);

    // Insert into Supabase first
    const { data: created, error } = await clientsDb.create(user.id, {
      name: newClient.name,
      contact: newClient.contact,
      role: newClient.role || "",
      tag: newClient.tag || "",
      revenue: monthlyRate,
      months: tenureMonths, // kept for migration window; engagement_started_at is the truth
      engagement_started_at: engagementStartedAt,
      lifetime_revenue_at_entry: preEntryBaseline,
      retention_score: baseline || 50,
      profile_scores: { ...profileScores },
      qualifying_flags: qualFlags,
    });

    if (error) { console.error("Failed to create client:", error); return; }

    // Open initial revenue history row. started_at is now() — going forward,
    // Retayned tracks the truth. Pre-Retayned earnings live in
    // lifetime_revenue_at_entry as the user's reported baseline.
    if (created?.id && monthlyRate > 0) {
      try {
        await supabase.from('client_revenue_history').insert({
          user_id: user.id,
          client_id: created.id,
          monthly_rate: monthlyRate,
          started_at: new Date().toISOString(),
          ended_at: null,
        });
      } catch (e) {
        console.warn("Failed to seed revenue history for new client:", e);
        // Non-fatal — client is created. Revenue history can be added later.
      }
    }

    const client = {
      id: created?.id || Date.now(),
      name: newClient.name,
      contact: newClient.contact,
      role: newClient.role,
      tag: newClient.tag,
      revenue: monthlyRate,
      months: tenureMonths,
      lifetime_revenue_at_entry: preEntryBaseline,
      // Initial LTV: just the pre-entry baseline. The history row was just
      // opened so months_in_period ≈ 0 → contributes ~$0 today, grows from
      // here. Re-hydration on next load picks up the real history-based math.
      ltv: preEntryBaseline,
      velocity: "normal",
      lastHC: null,
      lastContact: "today",
      referrals: 0,
      ret: baseline || 50,
      profileScores: { ...profileScores },
      qualifyingFlags: qualFlags,
      daysOld: 0,
    };
    setClients([...clients, client].sort((a, b) => (b.ret || 0) - (a.ret || 0)));

    // ─── Auto-create initial Health Check with random 10-40 day offset ────
    // Random uniform distribution across 31 days (10 through 40 inclusive).
    // Prevents pileups when users bulk-add clients and maximizes Start Early
    // value during the trial period.
    try {
      const offsetDays = 10 + Math.floor(Math.random() * 31); // 10..40 inclusive
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + offsetDays);
      const dueDateStr = localYmd(dueDate);

      const clientId = created?.id || client.id;
      let hcResult = null;
      if (hcDb.create) {
        hcResult = await hcDb.create(user.id, {
          client_id: clientId,
          due_date: dueDateStr,
        });
      } else if (hcDb.scheduleNext) {
        // Fallback — 30-day default if hcDb.create isn't exported yet.
        hcResult = await hcDb.scheduleNext(user.id, clientId);
      }

      // Append the new HC to local hcQueue so Health page reflects reality
      // without a full reload. By definition this is the client's first HC
      // (runnable via Start Early), so stamp isFirstHC: true.
      const newHcRow = hcResult?.data;
      if (newHcRow) {
        const today = new Date();
        today.setHours(0,0,0,0);
        const hcDueDate = newHcRow.due_date ? new Date(newHcRow.due_date) : dueDate;
        const daysUntil = Math.max(0, Math.ceil((hcDueDate - today) / (1000*60*60*24)));
        setHcQueue(prev => [...prev, {
          id: newHcRow.id,
          client_id: clientId,
          client: newClient.name,
          ret: client.ret || 0,
          due: hcDueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          due_date: hcDueDate.toISOString(),
          overdue: 0,
          isFirstHC: true,
          runnable: true,
          daysUntil: daysUntil,
        }]);
      }
    } catch (e) {
      console.warn("Health check auto-schedule failed (non-fatal):", e);
    }
    // ──────────────────────────────────────────────────────────────────────

    setShowAddClient(false);
    setNewClient({ name: "", contact: "", role: "", tag: "", revenue: "", months: "", lifetime_revenue_at_entry: "" });
    setProfileStep(0);
    setProfileScores({});
  };

  // Today — task manager
  const [tasks, setTasks] = useState([]);

  // 30s priority hold tick: when a new task is added in Rai mode, it floats
  // to top for 30 seconds (see raiCompare). Once that window expires we need
  // a re-render so it sorts naturally. This effect schedules a tick at the
  // exact expiry moment of the most recent task.
  const [, forceRerender] = useState(0);
  useEffect(() => {
    const now = Date.now();
    const HOLD_MS = 30000;
    const heldTasks = tasks.filter(t => t.created_at && (now - t.created_at) < HOLD_MS);
    if (heldTasks.length === 0) return;
    // Find the soonest expiry
    const soonestExpiry = Math.min(...heldTasks.map(t => t.created_at + HOLD_MS));
    const delay = Math.max(50, soonestExpiry - now);
    const timer = setTimeout(() => forceRerender(n => n + 1), delay);
    return () => clearTimeout(timer);
  }, [tasks]);

  // Auto-exit focus mode when there are zero incomplete tasks ANYWHERE in the
  // list (today + tomorrow + later all complete or empty). Without this, focus
  // mode dims every row and the page looks broken. Only fires when tasks are
  // actually loaded (length > 0) to avoid running during initial fetch.
  useEffect(() => {
    if (!focusMode) return;
    if (tasks.length === 0) return; // still loading, don't trigger
    const hasIncomplete = tasks.some(t => !t.done);
    if (!hasIncomplete) {
      setFocusMode(false);
    }
  }, [focusMode, tasks]);

  // Tracks tasks just completed within the last ~700ms so the pulse animation only fires
  // on the actual click, not on every re-render where t.done is true.
  const [justCompletedIds, setJustCompletedIds] = useState({});
  // Tasks that have been completed and are now hidden from the active bucket
  // list (they live in the "Completed today" expandable group below all
  // buckets). 5 seconds after a task is checked off, it gets added to this set.
  // Keyed by task id → true.
  const [collapsedDoneIds, setCollapsedDoneIds] = useState({});
  // Brief intermediate state between "completed" and "collapsed" — the task is
  // playing its exit animation (max-height shrink + fade). Lives ~360ms.
  const [exitingDoneIds, setExitingDoneIds] = useState({});
  // Whether the "Completed today" log is expanded. Defaults to collapsed.
  const [completedLogOpen, setCompletedLogOpen] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [newTaskRecurring, setNewTaskRecurring] = useState(false);
  // Recurrence pattern shape (when newTaskRecurring is true):
  //   { kind: "daily" }
  //   { kind: "weekdays" }                        — Mon-Fri only
  //   { kind: "weekly", days: [1,3,5] }           — 0=Sun, 1=Mon, ..., 6=Sat (multi-select)
  //   { kind: "monthly_date", day: 15 }           — "On the 15th of each month"
  //   { kind: "monthly_weekday", week: 3, day: 2 } — "On the 3rd Tuesday of each month"
  // Defaults to daily for backward-compat with existing tasks created before this column.
  const [newTaskRecurrencePattern, setNewTaskRecurrencePattern] = useState({ kind: "daily" });
  // Composer Due chip — null means no due date (renders in Today bucket).
  // Stores YYYY-MM-DD string. Mutually exclusive with newTaskRecurring (selecting
  // recurring clears due date; selecting due date clears recurring).
  const [newTaskDueDate, setNewTaskDueDate] = useState(null);
  // Provenance tracking for parser-set recurrence/date. When the parser
  // detects "every thursday" it sets the recurrence chip AND records what
  // it set here. On a later keystroke, if the parser no longer finds a
  // recurrence/date phrase AND the current chip state still matches what
  // the parser last set, we know the user deleted the trigger phrase —
  // so we clear the chip. If the state DIFFERS from the parser's last
  // value, the user changed it manually via the chip menu — we leave it
  // alone. null = parser hasn't set anything (any current state is manual).
  const parserSetRecurrenceRef = useRef(null); // last pattern the parser set
  const parserSetDueDateRef = useRef(null);    // last YMD the parser set
  // Pulse-chip state: the most recent chip auto-filled by parseComposer.
  // Triggers a one-shot CSS pulse on the chip button so the user gets a
  // visible confirmation when the parser catches something they typed.
  // Auto-clears after the animation finishes so the next pulse fires fresh.
  const [pulseChip, setPulseChip] = useState(null); // "client" | "worker" | "due" | null
  const pulseTimerRef = useRef(null);
  const triggerChipPulse = (which) => {
    setPulseChip(which);
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = setTimeout(() => setPulseChip(null), 600);
  };
  // Date picker popover state — opens when Due chip is clicked
  const [duePickerOpen, setDuePickerOpen] = useState(false);
  // Calendar grid: which month is currently shown in the date picker.
  // Stored as YYYY-MM string. Defaults to current month; resets on picker open.
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // ─── Workers state ──
  const [workersList, setWorkersList] = useState([]);
  // All historical completions attributed to workers. Read from
  // task_completions table on hydration. The in-memory `tasks` array
  // is only today's open tasks — completion history older than today
  // would otherwise be lost the moment tasksDb.resetRecurring fires.
  // This array is the source of truth for cross-time worker stats.
  const [workerCompletions, setWorkerCompletions] = useState([]);
  const [newTaskWorkerId, setNewTaskWorkerId] = useState(null);   // composer: assigned worker for new task
  const [workerPickerOpen, setWorkerPickerOpen] = useState(false); // composer popover
  const [addWorkerOpen, setAddWorkerOpen] = useState(false);       // add-worker modal
  const [newWorkerName, setNewWorkerName] = useState("");
  const [newWorkerEmail, setNewWorkerEmail] = useState("");
  const [newWorkerRole, setNewWorkerRole] = useState("");
  // Touchpoint data layer is intact (allTouchpoints + tpLogged still load from DB
  // for rhythm calc and history) — only the manual Log UI was removed.
  const [tpLogged, setTpLogged] = useState([]);
  const [allTouchpoints, setAllTouchpoints] = useState([]);
  // Engagement pauses, keyed by client_id. Each value is an array of
  // { id, paused_at, resumed_at, reason, note }. Loaded once at
  // hydration, mutated optimistically when user clicks pause/resume.
  const [engagementPausesByClient, setEngagementPausesByClient] = useState({});
  const [confetti, setConfetti] = useState(false);
  // ─── Today v4 state ──
  const [todayFocusId, setTodayFocusId] = useState(null);
  const [todayDismissed, setTodayDismissed] = useState({});
  const [todayComposerDue, setTodayComposerDue] = useState("today");
  const [todayComposerClient, setTodayComposerClient] = useState("");
  const [todayComposerMenu, setTodayComposerMenu] = useState(false);
  const [todayComposerQuery, setTodayComposerQuery] = useState("");
  // Highlighted index in the client picker dropdown (for keyboard nav).
  // -1 = nothing highlighted yet (let Enter fall through to first match).
  const [composerHighlight, setComposerHighlight] = useState(0);
  const [todayCompletedOpen, setTodayCompletedOpen] = useState(false);

  // ─── Observer card state ──
  const [observation, setObservation] = useState(null);
  const [obsDismissing, setObsDismissing] = useState(false);
  // Mobile observer "More" tap state. Default collapsed: card shows only
  // topbar + headline + action row. Tap "More" → body, metadata, metric
  // strip reveal. Desktop ignores this state (CSS always shows expanded
  // content). Resets per observation (different obs.id → reset to false).
  const [obsMobileExpanded, setObsMobileExpanded] = useState(false);

  // ─── Daybook state ── (right-rail notepad on Today page)
  const [daybookEntry, setDaybookEntry] = useState("");
  const [daybookYesterday, setDaybookYesterday] = useState(null);
  const [daybookSaveStatus, setDaybookSaveStatus] = useState("idle"); // 'idle' | 'saving' | 'saved'
  const daybookSaveTimerRef = useRef(null);
  const daybookHydratedRef = useRef(false);

  // ═══ FETCH ALL DATA ON MOUNT ═══
  const loadData = useCallback(async () => {
    if (!user) return;
    const uid = user.id;
    
    const [clientRes, taskRes, refRes, rolodexRes, hcRes, tpRes, hcCountsRes, convoListRes, raiStateRes, raiPicksRes, revHistoryRes, pausesRes, cadenceRes, observerRes, daybookRes, workersRes, workersComplRes, personalCalRes, taskCompletionsRes] = await Promise.all([
      clientsDb.list(uid),
      tasksDb.listToday(uid),
      referralsDb.list(uid),
      rolodexDb.list(uid),
      hcDb.listPending(uid),
      touchpointsDb.listToday(uid),
      (typeof hcDb.countCompletedByClient === "function")
        ? hcDb.countCompletedByClient(uid)
        : Promise.resolve({ data: {}, error: null }),
      (typeof convoDb.list === "function")
        ? convoDb.list(uid, 250)
        : Promise.resolve({ data: [], error: null }),
      // Rai badge state + picks fetched in parallel with the rest. Previously
      // these ran sequentially AFTER the main Promise.all, which made the
      // "Rai's pick" badge appear several seconds late (cascading layout shift).
      // Failures here are non-fatal — defaults are sensible and the realtime
      // sub will catch up if a sweep lands while the app is open.
      (typeof raiUserStateDb?.get === "function")
        ? raiUserStateDb.get(uid).catch(() => ({ data: null, error: null }))
        : Promise.resolve({ data: null, error: null }),
      (typeof raiPicksDb?.getCurrent === "function")
        ? raiPicksDb.getCurrent(uid).catch(() => ({ data: null, error: null }))
        : Promise.resolve({ data: null, error: null }),
      // Revenue history — one batch fetch for ALL the user's clients. Used to
      // compute honest LTV (lifetime_revenue_at_entry + sum of monthly_rate
      // × time across history rows). Synchronous getAdjustedLTV reads from a
      // map built below, so this hydrate is the round-trip.
      supabase
        .from('client_revenue_history')
        .select('client_id, monthly_rate, started_at, ended_at, change_reason, change_note')
        .eq('user_id', uid)
        .then(r => r, () => ({ data: [], error: null })),
      // Engagement pauses — same batch pattern. Drives monthsTogether and
      // is_currently_paused on every client. Empty array on failure (table
      // may not exist yet during migration window).
      supabase
        .from('client_engagement_pauses')
        .select('id, client_id, paused_at, resumed_at, reason, note')
        .eq('user_id', uid)
        .then(r => r, () => ({ data: [], error: null })),
      // Promoted from sequential awaits to parallel. Each wrapped in .catch
      // so a missing function or empty table doesn't reject the whole batch;
      // null data on failure is the same as the previous try/catch behavior.
      // Cadence — 90-day touchpoint history for client cards.
      (typeof touchpointsDb.list === "function")
        ? touchpointsDb.list(uid, 90).catch(e => { console.warn("Cadence data failed to load:", e); return { data: null, error: e }; })
        : Promise.resolve({ data: null, error: null }),
      // Observer card — weekly observation, may not exist.
      (typeof observationsDb?.getCurrent === "function")
        ? observationsDb.getCurrent(uid).catch(e => { console.warn("Observer card failed to load:", e); return { data: null, error: e }; })
        : Promise.resolve({ data: null, error: null }),
      // Daybook — today + yesterday in one shot.
      (typeof daybookDb?.getTodayAndYesterday === "function")
        ? daybookDb.getTodayAndYesterday(uid).catch(e => { console.warn("Daybook failed to load:", e); return { data: null, error: e }; })
        : Promise.resolve({ data: null, error: null }),
      // Workers list + per-worker completion counts. Optional table — empty
      // arrays on failure so the composer worker chip just shows zero options.
      workersDb.list(uid).catch(e => { console.warn("Workers load failed:", e); return { data: null, error: e }; }),
      workersDb.getAllCompletions(uid).catch(e => { console.warn("Worker completions load failed:", e); return { data: null, error: e }; }),
      // Personal calendar events (Today timeline) + sidebar completion counts.
      // Both render on the default landing page so they belong in critical
      // path. As fire-and-forget they hydrated late, causing visible pop-in
      // on the Today calendar widget and the sidebar Portfolio widget.
      personalCalendarDb.listToday(uid).catch(e => { console.warn("personal calendar load failed:", e); return { data: null, error: e }; }),
      (typeof tasksDb.getCompletedCounts === "function")
        ? tasksDb.getCompletedCounts(uid).catch(e => { console.warn("task completion counts failed:", e); return { data: null, error: e }; })
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (raiStateRes?.data) setRaiState(raiStateRes.data);
    setRaiPicks(raiPicksRes?.data || null);

    // Build per-client revenue history map: client_id → [history rows]
    const revHistoryByClient = {};
    for (const row of (revHistoryRes?.data || [])) {
      if (!revHistoryByClient[row.client_id]) revHistoryByClient[row.client_id] = [];
      revHistoryByClient[row.client_id].push(row);
    }

    // Build per-client engagement-pauses map. Used by monthsTogether
    // (subtract paused intervals) and isCurrentlyPaused (any open pause).
    const pausesByClient = {};
    for (const row of (pausesRes?.data || [])) {
      if (!pausesByClient[row.client_id]) pausesByClient[row.client_id] = [];
      pausesByClient[row.client_id].push(row);
    }
    setEngagementPausesByClient(pausesByClient);

    // Cadence / Observer / Daybook results from the parallel batch above.
    // Previously each was a sequential await with its own try/catch — that
    // added ~600-800ms to the critical path. Now they ride along with the
    // main batch and are processed here synchronously.
    if (cadenceRes?.data) setAllTouchpoints(cadenceRes.data);
    if (observerRes?.data) {
      setObservation(observerRes.data);
      setObsMobileExpanded(false);
    }
    if (daybookRes?.data) {
      setDaybookEntry(daybookRes.data.today?.body || "");
      setDaybookYesterday(daybookRes.data.yesterday || null);
      setDaybookSaveStatus(daybookRes.data.today ? "saved" : "idle");
      daybookHydratedRef.current = true;
    }

    if (tpRes.data) setTpLogged(tpRes.data.map(t => ({
      id: t.id,
      client: t.client_name,
      channel: t.channel,
    })));

    if (clientRes.data) {
      // Compute honest LTV per client from history + pre-entry baseline.
      // months_in_period = (ended_at_or_now - started_at) / 30.44 days
      const MS_PER_MONTH = 30.44 * 24 * 60 * 60 * 1000;
      const nowMs = Date.now();
      const computeLTV = (clientId, preEntry) => {
        const history = revHistoryByClient[clientId] || [];
        const historyTotal = history.reduce((sum, row) => {
          const startMs = new Date(row.started_at).getTime();
          const endMs = row.ended_at ? new Date(row.ended_at).getTime() : nowMs;
          const months = Math.max(0, (endMs - startMs) / MS_PER_MONTH);
          return sum + (Number(row.monthly_rate) * months);
        }, 0);
        return Number(preEntry || 0) + historyTotal;
      };
      setClients(clientRes.data.map(c => ({
        ...c,
        ret: c.retention_score || 0,
        contact: c.contact || "",
        role: c.role || "",
        // months is now DERIVED from engagement_started_at and pauses.
        // The raw c.months column from the DB is ignored once
        // engagement_started_at is set (the source of truth). Falls
        // back to c.months only if engagement_started_at is missing
        // (shouldn't happen post-migration, but kept as a safety net).
        months: c.engagement_started_at
          ? monthsTogether({ id: c.id, engagement_started_at: c.engagement_started_at }, pausesByClient)
          : (c.months || 0),
        engagement_started_at: c.engagement_started_at || null,
        is_paused: isCurrentlyPaused(c.id, pausesByClient),
        revenue: c.revenue || 0,
        tag: c.tag || "",
        lastHC: c.last_hc_date || null,
        lastContact: c.last_task_date ? "recent" : "—",
        referrals: 0,
        profileScores: c.profile_scores || {},
        qualifyingFlags: c.qualifying_flags || {},
        // Honest LTV: lifetime_revenue_at_entry + sum across history rows.
        // Stored as a number on the client object so synchronous render code
        // (getAdjustedLTV, profile score math) can read it without async hops.
        // Recomputed on every clients hydration — no stale values.
        lifetime_revenue_at_entry: Number(c.lifetime_revenue_at_entry || 0),
        ltv: computeLTV(c.id, c.lifetime_revenue_at_entry),
        // Rai's daily reweighting + reasoning (per-client). Sweep writes raiNudge
        // overnight. Sort comparator reads raiNudge to influence task ordering.
        // raiSignal/raiRationale at client-level are debug fields; the pick badge
        // hover text comes from rai_picks.reason (per-pick), not the client.
        raiNudge: c.rai_nudge != null ? Number(c.rai_nudge) : 0,
        raiSignal: c.rai_signal || null,
        raiRationale: c.rai_rationale || null,
      })));
    }

    if (taskRes.data) {
      // Auto-cleanup at midnight local (the most recent 00:00):
      //   - Recurring tasks completed before cutoff → reset is_done (they reappear fresh)
      //   - Non-recurring tasks completed before cutoff → SOFT-CLEARED via cleared_at
      //     timestamp. Row stays in DB so Rai/detectors can still count historical
      //     task volume, identify client task patterns, etc. Hidden only from the
      //     active Today list.
      //   - Open tasks (not done) → preserved regardless of age (carry forward)
      //
      // Cutoff is today at midnight in the user's STORED timezone
      // (profiles.timezone), NOT the device's wall clock. Pre-fix this used
      // setHours(0,0,0,0), which read the browser's TZ; a stale browser TZ
      // could fire this filter at 22:00 MDT (Eastern's midnight) and reset
      // recurring tasks 2 hours early. We now anchor to the stored TZ and
      // fall back to device-local only while the profile hasn't loaded —
      // and never persist that fallback.
      const cutoffMs = userTimezone
        ? tzMidnightInstant(userTimezone, new Date(), 0)
        : (() => { const c = new Date(); c.setHours(0, 0, 0, 0); return c.getTime(); })();
      const cutoff = new Date(cutoffMs);

      // Recurring + done + completed before cutoff → reset to incomplete
      const toReset = taskRes.data.filter(t =>
        t.is_recurring && t.is_done &&
        t.completed_at && new Date(t.completed_at) < cutoff
      );

      // Non-recurring + done + completed before cutoff → soft-clear from active view
      // (row stays in DB; only hidden from frontend's active Today list)
      const toClear = taskRes.data.filter(t =>
        !t.is_recurring && t.is_done && !t.cleared_at &&
        t.completed_at && new Date(t.completed_at) < cutoff
      );

      // Fire off DB mutations in background (don't block UI render)
      toReset.forEach(t => { tasksDb.toggle(t.id, false); });
      toClear.forEach(t => { tasksDb.clearFromActive(t.id); });

      // Build local task list excluding cleared IDs and applying recurring resets
      const clearedIds = new Set(toClear.map(t => t.id));
      // Also exclude any task already cleared on a previous load
      const loadedTasks = taskRes.data.filter(t => !clearedIds.has(t.id) && !t.cleared_at).map(t => {
        const reset = toReset.find(r => r.id === t.id);
        return {
          id: t.id,
          text: t.text,
          client: t.client_name || "",
          done: reset ? false : t.is_done,
          completed_at: reset ? null : t.completed_at,
          alert: t.is_alert,
          recurring: t.is_recurring,
          recurrence_pattern: t.recurrence_pattern || null,
          due_date: t.due_date || null,
          assigned_worker_id: t.assigned_worker_id || null,
          share_client_context: t.share_client_context !== false,
          worker_completed_at: t.worker_completed_at || null,
          sort_order: t.sort_order,
          raiPriority: t.is_rai_priority || false,
          // Note: Rai's nudge + reasoning lives on the CLIENT, not the task.
          // Sort comparator looks up the client by t.client and reads raiNudge
          // from there. This way new tasks added during the day inherit the
          // client's nudge automatically (sweep ran overnight on the client).
          created_at: t.created_at ? new Date(t.created_at).getTime() : 0,
        };
      });
      setTasks(loadedTasks);
      // Tasks that were already completed before this page load skip the
      // 5-second satisfaction window and go straight into the collapsed log.
      // (User wasn't here to see the celebration — no point preserving it.)
      const preCollapsed = {};
      for (const t of loadedTasks) {
        if (t.done) preCollapsed[t.id] = true;
      }
      setCollapsedDoneIds(preCollapsed);
    }

    if (refRes.data) setRefs(refRes.data.map(r => ({
      id: r.id,
      to: r.referred_to,
      from: r.referred_by,
      date: r.date_added || "",
      converted: r.status === "converted",
      status: r.status,
      revenue: r.revenue || 0,
      totalRevenue: r.total_revenue || 0,
    })));

    if (rolodexRes.data) setRolodex(rolodexRes.data.map(r => ({
      id: r.id,
      client: r.client_name,
      contact: r.contact_name,
      months: r.months || 0,
      type: r.type,
      date: r.date_added || "",
      tags: r.tags || [],
      priority: r.priority,
      reminder: r.reminder_date,
      work: r.notes,
    })));

    // Load retro answers from rolodex entries
    if (rolodexRes.data) {
      const answers = {};
      rolodexRes.data.forEach(r => {
        if (r.retro_answers && Object.keys(r.retro_answers).length > 0) {
          answers[r.id] = r.retro_answers;
        }
      });
      setRetroAnswers(answers);
    }

    // Load drift status
    if (clientRes.data) {
      const drifts = {};
      clientRes.data.forEach(c => {
        if (c.drift_status) drifts[c.name] = c.drift_status;
      });
      setClientDrift(drifts);
    }

    // Map health checks to queue format
    if (hcRes.data) {
      const completedCounts = hcCountsRes?.data || {};
      setHcQueue(hcRes.data.map(h => {
        const client = h.client;
        const dueDate = h.due_date ? new Date(h.due_date) : null;
        const today = new Date();
        today.setHours(0,0,0,0);
        const overdue = dueDate ? Math.max(0, Math.floor((today - dueDate) / (1000*60*60*24))) : 0;
        const isToday = dueDate && dueDate.toDateString() === today.toDateString();
        const completedForClient = completedCounts[h.client_id] || 0;
        const isFirstHC = completedForClient === 0;
        // Runnable when: overdue, due today, OR this is the client's first HC (Start Early affordance)
        const runnable = overdue > 0 || isToday || isFirstHC;
        const daysUntil = dueDate ? Math.max(0, Math.ceil((dueDate - today) / (1000*60*60*24))) : 0;
        return {
          id: h.id,
          client_id: h.client_id,
          client: client?.name || "Unknown",
          ret: client?.retention_score || 0,
          due: isToday ? "Today" : dueDate ? dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—",
          due_date: dueDate ? dueDate.toISOString() : null,
          overdue: overdue,
          isFirstHC: isFirstHC,
          runnable: runnable,
          daysUntil: daysUntil,
        };
      }));
    }

    if (convoListRes?.data) {
      setRaiConvoList(convoListRes.data);
    }

    // Workers + completion counts arrived in the main parallel batch above.
    // Apply them here synchronously — previously this was an awaited
    // Promise.all that ran AFTER everything else, making Workers the last
    // data to hydrate and the composer worker chip the last UI to populate.
    if (workersRes?.data) setWorkersList(workersRes.data);
    if (workersComplRes?.data) setWorkerCompletions(workersComplRes.data);

    // Visible-on-load surfaces — calendar widget + sidebar Portfolio.
    // Now in critical path so they hydrate alongside the rest, no pop-in.
    if (personalCalRes?.data) setPersonalEvents(personalCalRes.data);
    if (taskCompletionsRes?.data) setTaskCompletedCounts(taskCompletionsRes.data);

    setDataLoaded(true);

    // ─── Secondary hydration — fire-and-forget AFTER initial render ───
    // Only billing data remains here. It's billing-tab-only — invisible on
    // initial Today landing, so kicking off after the page renders avoids
    // competing with the critical paint for bandwidth.

    // Billing data — only visible on the Billing tab. Three fetches that
    // hydrate independently. Each can render empty on failure (user re-adds).
    if (typeof clientBillingDb?.listAll === "function") {
      clientBillingDb.listAll(uid)
        .then(r => { if (r?.data) setClientBilling(r.data); })
        .catch(e => console.warn("billing items hydrate failed:", e));
    }
    if (typeof clientBillingMonthStatusDb?.listAll === "function") {
      clientBillingMonthStatusDb.listAll(uid)
        .then(r => { if (r?.data) setBillingMonthStatus(r.data); })
        .catch(e => console.warn("billing month status hydrate failed:", e));
    }
    if (typeof clientBillingTermsDb?.listAll === "function") {
      clientBillingTermsDb.listAll(uid)
        .then(r => { if (r?.data) setBillingTerms(r.data); })
        .catch(e => console.warn("billing terms hydrate failed:", e));
    }
  }, [user, userTimezone]);


  useEffect(() => { loadData(); }, [loadData]);

  // ─── Realtime task sync ─────────────────────────────────────
  // Subscribe to all tasks-table changes for this user. Primary use:
  // when a Worker marks a task complete via the magic-link page,
  // the change shows up on the Operator's UI without a refresh.
  // Also catches multi-device edits (open Retayned on phone + laptop).
  useEffect(() => {
    if (!user?.id) return;

    const subscription = realtimeDb.onTaskChange(user.id, (payload) => {
      // payload.eventType: "INSERT" | "UPDATE" | "DELETE"
      // payload.new: the new row (for INSERT/UPDATE)
      // payload.old: the old row (for UPDATE/DELETE)
      const ev = payload.eventType;
      const row = payload.new || payload.old;
      if (!row?.id) return;

      if (ev === "DELETE") {
        setTasks(prev => prev.filter(t => t.id !== row.id));
        return;
      }

      // Map DB row → UI shape (matches the loadData task mapping)
      const mapped = {
        id: row.id,
        text: row.text,
        client: row.client_name || null,
        client_id: row.client_id || null,
        done: !!row.is_done,
        recurring: !!row.is_recurring,
        due_date: row.due_date || null,
        raiPriority: !!row.is_rai_priority,
        alert: false,
        created_at: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
        completed_at: row.completed_at || null,
        cleared_at: row.cleared_at || null,
        assigned_worker_id: row.assigned_worker_id || null,
        share_client_context: row.share_client_context !== false,
        worker_completed_at: row.worker_completed_at || null,
      };

      if (ev === "INSERT") {
        // Track burst timing for the 60s rule (with 5-min cap). When a task
        // is created for any client, record the timestamp so the badge logic
        // knows whether the picked client is in an active "burst" of task
        // creation. Tracker is keyed by client name (matches t.client).
        if (mapped.client) {
          const now = Date.now();
          const tracker = raiBurstTrackerRef.current;
          const existing = tracker[mapped.client];
          tracker[mapped.client] = {
            firstCreatedAt: existing && (now - existing.firstCreatedAt < 5 * 60 * 1000)
              ? existing.firstCreatedAt
              : now,
            lastCreatedAt: now,
          };
        }
        setTasks(prev => {
          // Avoid duplicates if the local insert already added it
          if (prev.some(t => t.id === mapped.id)) return prev;
          return [mapped, ...prev];
        });
      } else if (ev === "UPDATE") {
        setTasks(prev => prev.map(t => {
          if (t.id !== mapped.id) return t;
          // Preserve any local-only fields by spreading mapped over t
          return { ...t, ...mapped };
        }));
        // Refresh completion history if a worker assignment changed
        // and the task just flipped to done — a new task_completions
        // row appears that the Workers page reads. Without this refetch
        // those stats would be stale until full reload.
        if (row.assigned_worker_id && row.is_done) {
          workersDb.getAllCompletions(user.id).then(({ data }) => {
            if (data) setWorkerCompletions(data);
          }).catch(() => {});
        }
      }
    });

    // Subscribe to rai_user_state changes (cross-tab toggle sync).
    // When user flips "Rai Tasks / Off" on phone, this tab updates without refresh.
    const raiStateSubscription = realtimeDb.onRaiUserStateChange(user.id, (payload) => {
      const row = payload.new;
      if (!row) return;
      setRaiState(row);
    });

    // Subscribe to rai_picks changes — when overnight sweep writes a fresh
    // pick, refetch the current row (or null if cleared). Simpler than
    // tracking individual INSERT/UPDATE/DELETE events.
    const raiPickSubscription = realtimeDb.onRaiPickChange(user.id, async () => {
      try {
        const pickRes = await raiPicksDb.getCurrent(user.id);
        setRaiPicks(pickRes?.data || null);
      } catch (e) {
        console.warn("Failed to refetch rai pick after change:", e);
      }
    });

    // Subscribe to clients changes — overnight sweep writes nudges to
    // clients.rai_nudge, and we need the sort to update without a refresh.
    // Also handles general client edits (name change, score change, etc.)
    // made from another tab.
    const clientSubscription = realtimeDb.onClientChange(user.id, (payload) => {
      const ev = payload.eventType;
      if (ev === "DELETE") {
        const oldId = payload.old?.id;
        if (oldId) setClients(prev => prev.filter(c => c.id !== oldId));
        return;
      }
      const row = payload.new;
      if (!row?.id) return;
      // Map DB row → UI shape (matches the loadData client mapping)
      const mapped = {
        ...row,
        ret: row.retention_score || 0,
        contact: row.contact || "",
        role: row.role || "",
        months: row.months || 0,
        revenue: row.revenue || 0,
        tag: row.tag || "",
        lastHC: row.last_hc_date || null,
        lastContact: row.last_task_date ? "recent" : "—",
        referrals: 0,
        profileScores: row.profile_scores || {},
        qualifyingFlags: row.qualifying_flags || {},
        raiNudge: row.rai_nudge != null ? Number(row.rai_nudge) : 0,
        raiSignal: row.rai_signal || null,
        raiRationale: row.rai_rationale || null,
      };
      if (ev === "INSERT") {
        setClients(prev => prev.some(c => c.id === mapped.id) ? prev : [...prev, mapped]);
      } else if (ev === "UPDATE") {
        setClients(prev => prev.map(c => c.id === mapped.id ? { ...c, ...mapped } : c));
      }
    });

    return () => {
      // Cleanup on unmount or user change
      try { subscription?.unsubscribe?.(); } catch {}
      try { raiStateSubscription?.unsubscribe?.(); } catch {}
      try { raiPickSubscription?.unsubscribe?.(); } catch {}
      try { clientSubscription?.unsubscribe?.(); } catch {}
    };
  }, [user?.id]);

  // ─── BADGE STATE MANAGER ──────────────────────────────────────────
  // Manages rai_user_state.todays_badged_task_id (the source of truth for
  // which task currently carries the "Rai's pick" badge).
  //
  // Three things happen here:
  //
  // (A) Auto-clear: if the badge is set on a task that's now completed,
  //     dismissed, deleted, moved out of today, or no longer visible,
  //     clear the badge state. Once cleared, badge is done for the day.
  //
  // (B) 60s settle: if badge state is null (Rai chose to wait), watch for
  //     tasks that exist for any picked client AND have been in the list
  //     for at least 60 seconds. When that's true, set the badge and mark
  //     that pick was_annotated = true. First-come-first-served across
  //     ranks (no rank-priority override; once the badge lands, it stays).
  //
  // (C) The check is debounced with a 5-second timer so we don't spam
  //     supabase on every tasks/clients change.
  // ─── BADGE STATE MANAGER ──────────────────────────────────────────
  // Manages rai_user_state.todays_badged_task_id. Three rules, locked:
  //
  //   1. Once the badge lands, it stays on that task forever — through
  //      completion, even if the task gets dismissed or moved. The badge
  //      is permanent for the day.
  //   2. Tomorrow / Later tasks NEVER get the badge. Annotation is a
  //      today-only event.
  //   3. The badge is single-use per day. If `todays_badge_set_at` is
  //      already set, the day is over — we never write a new badge.
  //
  // The effect only writes a badge when ALL of these are true:
  //   - rankMode === "rai"
  //   - raiState exists and todays_badge_set_at is null (never been set today)
  //   - At least one picked client has a TODAY task that has settled >60s
  //
  // After the badge is written, the effect becomes a no-op for the rest
  // of the day. The DB FK (ON DELETE SET NULL) is the ONLY mechanism
  // that can clear todays_badged_task_id — and only when the user
  // outright deletes the task row, which removes the badge alongside it.
  useEffect(() => {
    if (!user) return;
    if (rankMode !== "rai") return;
    if (!raiState) return; // not loaded yet
    if (!raiPicks) return; // no pick today (raiPicks is a single object or null)

    // Day is over: badge has been set at some point today. Never re-badge.
    if (raiState.todays_badge_set_at) return;
    if (raiState.todays_badged_task_id) return;

    let timeoutId;

    const evaluate = async () => {
      const SETTLE_MS = 60 * 1000;
      const now = Date.now();
      const todayIso = localYmd();

      // raiPicks is a single pick row (or null, gated above). The original
      // code was written as if multiple picks could land at once; the
      // current sweep writes exactly one row per user per day and
      // raiPicksDb.getCurrent returns it via maybeSingle(). Treat as one.
      const pick = raiPicks;
      const c = clients.find(x => x.id === pick.client_id);
      if (!c) return;

      // Only TODAY tasks are eligible. Tomorrow / Later never get badged.
      const clientTodayTasks = tasks.filter(t => {
        if (t.done) return false;
        if (todayDismissed[t.id]) return false;
        if (t.client !== c.name) return false;
        // Only today's bucket: due_date is today (recurring tasks count
        // as today by convention since they have no due_date but render
        // in the today bucket).
        if (t.recurring) return true;
        if (!t.due_date) return false;
        return String(t.due_date).slice(0, 10) === todayIso;
      });
      if (clientTodayTasks.length === 0) return;

      // Eligible = at least one of these tasks has settled >60s
      const settled = clientTodayTasks.filter(t => (now - (t.created_at || 0)) >= SETTLE_MS);
      if (settled.length === 0) return;

      // Pick highest-priority among settled
      const sorted = [...settled].sort((a, b) => {
        const psA = getProfileSortScore(a.client, a.raiPriority, 0);
        const psB = getProfileSortScore(b.client, b.raiPriority, 0);
        if (psA !== psB) return psB - psA;
        if (a.alert !== b.alert) return a.alert ? -1 : 1;
        if (a.recurring !== b.recurring) return a.recurring ? -1 : 1;
        return (b.created_at || 0) - (a.created_at || 0);
      });
      const winnerId = sorted[0].id;
      try {
        await raiUserStateDb.setBadgeTask(user.id, winnerId);
        await raiPicksDb.markAnnotated(user.id, c.id);
      } catch (e) {
        console.warn("Failed to write badge state:", e);
      }
    };

    // Debounce: re-evaluate after 5 seconds of no changes
    timeoutId = setTimeout(evaluate, 5000);
    return () => { clearTimeout(timeoutId); };
  }, [user, rankMode, raiState, raiPicks, tasks, clients, todayDismissed]);


  // Hydrate profile-derived state: timezone, Google Cal prompt dismissal.
  //
  // Timezone policy (post-May-2026 fix): profiles.timezone is the single
  // source of truth for all local-day math (Rai sweep gate, frontend
  // midnight rollover, recurring-task reset cutoff). We SEED it from the
  // device's detected TZ exactly once — when the column is null/empty —
  // and never overwrite a stored value from the device after that. The
  // prior behavior auto-wrote on every session, which let a stale browser
  // TZ (e.g. Chrome holding an Eastern resolvedOptions across a macOS
  // clock change) silently flip profiles.timezone hours-at-a-time and
  // corrupt both the overnight Rai pick AND the local midnight cutoff.
  // Users can change their stored TZ via Settings (separate UI path).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const profRes = await profileDb.get(user.id);
        if (cancelled) return;
        setGoogleCalPromptDismissed(!!profRes?.data?.google_cal_prompt_dismissed);
        const storedTz = profRes?.data?.timezone || null;
        if (storedTz) {
          setUserTimezone(storedTz);
        } else {
          // First-time seed only. After this write the column is non-null
          // and this branch never runs again for this user.
          const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
          setUserTimezone(detectedTz);
          await profileDb.update(user.id, { timezone: detectedTz });
        }
      } catch (e) {
        // Non-blocking — fall back to device TZ in-memory only. Do NOT
        // write the fallback to the database; that's how drift happens.
        console.warn('Timezone hydrate failed:', e);
        if (!cancelled) {
          setUserTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Schedule automatic daily rollover at midnight local. Reloads data so
  // tasks re-bucket (Today → Overdue, Tomorrow → Today, etc), Rai's pick
  // and the calendar all flip together at 00:00.
  // Fires even if the tab stays open across midnight — ensures no one sees stale state.
  //
  // Anchored to the user's STORED timezone (profiles.timezone), not the
  // browser's wall clock — see notes on tzMidnightInstant for why.
  // While userTimezone is still null (very brief, just on first mount),
  // fall back to device-local midnight so the effect still fires reasonably.
  useEffect(() => {
    if (!user) return;
    let timeoutId;
    const scheduleNextMidnight = () => {
      const now = new Date();
      const nextMidnightMs = userTimezone
        ? tzMidnightInstant(userTimezone, now, 1)
        : (() => {
            const d = new Date(now);
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() + 1);
            return d.getTime();
          })();
      const msUntil = Math.max(0, nextMidnightMs - now.getTime());
      timeoutId = setTimeout(() => {
        loadData();
        scheduleNextMidnight();
      }, msUntil);
    };
    scheduleNextMidnight();

    // Also refresh when tab regains focus — catches laptop-sleep case where setTimeout
    // may have paused across system sleep and missed the midnight fire
    const onVisible = () => { if (document.visibilityState === "visible") loadData(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user, loadData, userTimezone]);

  // ═══ SUPABASE-BACKED MUTATIONS ═══
  const toggleTask = async (id) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const newDone = !task.done;
    const nowIso = new Date().toISOString();
    // Optimistic update
    const updated = tasks.map(t => t.id === id ? { ...t, done: newDone, completed_at: newDone ? nowIso : null } : t);
    setTasks(updated);
    // Bump sidebar tasks-completed counts optimistically. Going-done adds 1
    // across all three windows (it's by definition within "this week"). Going-
    // undone subtracts 1, but only if completed_at was within each window
    // (which it almost always is for a recent toggle — but we check anyway
    // since users can re-open old tasks). Server is source of truth on next
    // hydration.
    if (newDone) {
      setTaskCompletedCounts(c => {
        const wh = [...(c.weekHistory || Array(12).fill(0))];
        const mh = [...(c.monthHistory || Array(12).fill(0))];
        wh[11] = (wh[11] || 0) + 1;
        mh[11] = (mh[11] || 0) + 1;
        return { ...c, today: (c.today || 0) + 1, week: c.week + 1, month: c.month + 1, year: c.year + 1, weekHistory: wh, monthHistory: mh };
      });
    } else if (task.completed_at) {
      const completed = new Date(task.completed_at);
      const now = Date.now();
      const inToday = localYmd(completed) === localYmd(new Date(now));
      const inWeek  = now - completed.getTime() < 7  * 86400000;
      const inMonth = now - completed.getTime() < 30 * 86400000;
      const inYear  = now - completed.getTime() < 365 * 86400000;
      setTaskCompletedCounts(c => {
        const wh = [...(c.weekHistory || Array(12).fill(0))];
        const mh = [...(c.monthHistory || Array(12).fill(0))];
        if (inWeek)  wh[11] = Math.max(0, (wh[11] || 0) - 1);
        if (inMonth) mh[11] = Math.max(0, (mh[11] || 0) - 1);
        return {
          ...c,
          today: Math.max(0, (c.today || 0) - (inToday ? 1 : 0)),
          week:  Math.max(0, c.week  - (inWeek  ? 1 : 0)),
          month: Math.max(0, c.month - (inMonth ? 1 : 0)),
          year:  Math.max(0, c.year  - (inYear  ? 1 : 0)),
          weekHistory: wh,
          monthHistory: mh,
        };
      });
    }
    // ASMR completion pulse — only fire when transitioning to done, clear after 720ms
    if (newDone) {
      setJustCompletedIds(prev => ({ ...prev, [id]: true }));
      setTimeout(() => {
        setJustCompletedIds(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }, 720);
      // 3.5 seconds after completion, animate the task out of the active bucket
      // and into the "Completed today" log below. The smooth exit is two-phase:
      //   phase 1: add an "exiting" class that triggers max-height shrink + fade
      //   phase 2: 360ms later, mark the task as collapsed (which removes it from
      //            the bucket entirely and surfaces it in the completed log).
      // If the user un-checks the task before the timer fires, both phases cancel.
      setTimeout(() => {
        setTasks(prev => {
          const stillDone = prev.find(t => t.id === id)?.done;
          if (!stillDone) return prev;
          // Phase 1: trigger exit animation
          setExitingDoneIds(prevSet => ({ ...prevSet, [id]: true }));
          return prev;
        });
        // Phase 2: after the animation completes, remove from bucket
        setTimeout(() => {
          setTasks(prev => {
            const stillDone = prev.find(t => t.id === id)?.done;
            if (!stillDone) return prev;
            setCollapsedDoneIds(prevSet => ({ ...prevSet, [id]: true }));
            setExitingDoneIds(prevSet => {
              const next = { ...prevSet };
              delete next[id];
              return next;
            });
            return prev;
          });
        }, 360);
      }, 3500);
    } else {
      // Un-completing: if it was collapsed, bring it back out of the log
      setCollapsedDoneIds(prev => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    const countable = updated;
    // Fireworks fire EXACTLY ONCE — when the LAST today-bucket task is checked
    // off. Triple-gated to prevent the historical bugs:
    //   (1) Only fires when newDone is true (we're checking, not unchecking)
    //   (2) Only fires when the TOGGLED task itself is in the today bucket
    //       (so finishing a tomorrow/later task never triggers, even if all
    //        today tasks happen to already be complete)
    //   (3) Only fires on TRANSITION — i.e. the previous state had at least
    //       one today task still incomplete, and the new state has none.
    //       Prevents re-firing on subsequent toggles when today is already
    //       complete, prevents stale-state confetti if the optimistic update
    //       didn't apply for some reason (we explicitly verify the count
    //       went from < total to === total).
    // Day boundary at midnight local (matches task rollover at 00:00).
    const _now = new Date();
    const _todayStr = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}-${String(_now.getDate()).padStart(2, "0")}`;
    const isTodayBucket = (t) => {
      if (t.recurring) {
        // Recurring tasks only count toward "today" if their next occurrence
        // IS today. Weekly/monthly tasks not due today are hidden from the UI
        // (see bucketOf) and shouldn't inflate today's counts either.
        if (t.done) return true; // done recurring tasks live in today's done list
        const next = nextOccurrenceDate(t.recurrence_pattern, _now, true);
        const nextStr = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
        return nextStr <= _todayStr;
      }
      if (!t.due_date) return true;
      const d = String(t.due_date).slice(0, 10);
      return d <= _todayStr;
    };
    // Was the toggled task itself a today-bucket task?
    const toggledIsToday = isTodayBucket(task);
    // Today-bucket counts BEFORE this toggle (using the pre-update tasks state).
    const todayBucketBefore = tasks.filter(isTodayBucket);
    const todayDoneBefore = todayBucketBefore.filter(t => t.done).length;
    const todayTotalBefore = todayBucketBefore.length;
    // Today-bucket counts AFTER (from updated).
    const todayBucketAfter = countable.filter(isTodayBucket);
    const todayDoneAfter = todayBucketAfter.filter(t => t.done).length;
    const todayTotalAfter = todayBucketAfter.length;
    // Fire only when:
    //   - we're checking (not unchecking)
    //   - toggled task is a today task
    //   - we transitioned: before had some incomplete, after is fully complete
    if (
      newDone &&
      toggledIsToday &&
      todayTotalAfter > 0 &&
      todayDoneBefore < todayTotalBefore &&
      todayDoneAfter === todayTotalAfter
    ) {
      setConfetti(true);
      setTimeout(() => setConfetti(false), 3000);
    }
    // Persist
    await tasksDb.toggle(id, newDone);
  };

  const recurringTasks = tasks.filter(t => t.recurring);
  const todayTasks = tasks.filter(t => !t.recurring);
  const countableTasks = tasks;

  // tasksDone / tasksTotal scope to TODAY bucket only — recurring tasks +
  // tasks with no due_date + tasks due today-or-earlier. Tomorrow/Later don't
  // count toward the sidebar red dot. Otherwise the dot persists whenever
  // ANY future task is incomplete, which is misleading: "today" is finished
  // but the dot says otherwise.
  const _todayDotNow = new Date();
  const _todayDotStr = localYmd(_todayDotNow);
  const todayBucketCountable = countableTasks.filter(t => {
    if (t.recurring) {
      if (t.done) return true;
      const next = nextOccurrenceDate(t.recurrence_pattern, _todayDotNow, true);
      const nextStr = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
      return nextStr <= _todayDotStr;
    }
    if (!t.due_date) return true;
    const d = String(t.due_date).slice(0, 10);
    return d <= _todayDotStr;
  });
  const tasksDone = todayBucketCountable.filter(t => t.done).length;
  const tasksTotal = todayBucketCountable.length;

  // Task sorting — by Profile Score (invisible), highest first
  // Rai priority boost — applied to one task per day during sweep
  const getRaiBoost = (score) => {
    if (score >= 90) return 5;
    if (score >= 80) return 10;
    if (score >= 70) return 15;
    if (score >= 60) return 20;
    return 25;
  };

  const getProfileSortScore = (clientName, hasRaiBoost = false, pickBoost = 0, daysLate = 0) => {
    // All Clients sentinel: a task tagged "All Clients" should always sort
    // first regardless of any per-client math. Set high enough to clear the
    // theoretical max real score: ~104 base + 25 raiBoost + 10 nudge + 20
    // pickBoost + 60 lateBoost + 15 newClientBoost ≈ 234 max. 500 leaves
    // generous headroom for future score expansions.
    if (!clientName || clientName === "All Clients") return 500;
    const c = clients.find(x => x.name === clientName);
    if (!c) return 0;
    // Paused engagement: this client is in a temporary pause window.
    // Their tasks stay visible (in case user wants to mark stragglers
    // done) but rank at the bottom of the queue — Rai doesn't surface
    // them and the daily sweep skips them. Returning 0 is enough; no
    // boosts apply when score = 0.
    if (c.is_paused) return 0;
    const ps = calcProfileScore(c.ret || 50, c, clients);
    const totalRev = clients.reduce((a, x) => a + (x.revenue || 0), 0);
    const revPct = totalRev > 0 ? (c.revenue || 0) / totalRev : 0;
    const boost = calcNewClientBoost(c.ret || 50, revPct, c.daysOld != null ? c.daysOld : 999);
    const raiBoost = hasRaiBoost ? getRaiBoost(ps) : 0;
    // Layered Rai score:
    //   client nudge (-10..+10) — all tasks of this client get this
    //   pick boost (+10..+20)  — only the specific picked task gets this on top
    // Pick is captured in rai_picks.task_id (NOT stored on the client), so this
    // function takes pickBoost as a parameter and the caller passes it in only
    // when the task being scored matches the active pick.
    const raiNudge = c.raiNudge || 0;
    // Late-task boost: overdue tasks surface aggressively, with fragile clients
    // (low retention score) getting much larger lifts per day late than healthy
    // clients. A 1d late task on a thriving client (ret=95) gets +1; same task
    // on a fragile client (ret=30) gets +17. Caps at +60 so a long-stale task
    // on a fragile client doesn't produce absurd ranks. Only applies when
    // daysLate >= 1 — same-day tasks not counted as "late."
    let lateBoost = 0;
    if (daysLate >= 1) {
      const ret = c.ret != null ? c.ret : 50;
      lateBoost = Math.min(60, daysLate * (100 - ret) / 4);
    }
    // No upper clamp — the sort comparator needs true magnitudes to break
    // ties between top-tier clients. Display layers round/cap for UI (the
    // score badge shows 99 max). Without removing this clamp, two clients
    // both scoring 105 raw would tie at 99 and lose their differentiator.
    return ps + boost + raiBoost + raiNudge + (pickBoost || 0) + lateBoost;
  };


  // Health Checks
  const [hcOpen, setHcOpen] = useState(null);
  const [hcAnswers, setHcAnswers] = useState({});
  const [hcStep, setHcStep] = useState({});
  const [hcDone, setHcDone] = useState({});
  const [clientDrift, setClientDrift] = useState({});
  const [showUpcoming, setShowUpcoming] = useState(false);

  // Referrals
  const [refs, setRefs] = useState([]);
  const [refForm, setRefForm] = useState(false);
  const [refName, setRefName] = useState("");
  const [refFrom, setRefFrom] = useState("");
  const [refStatus, setRefStatus] = useState("converted");
  const [refRevenue, setRefRevenue] = useState("");
  const [refTotalRevenue, setRefTotalRevenue] = useState("");
  const [refEditing, setRefEditing] = useState(null);
  const [refEditData, setRefEditData] = useState({});
  // Time-travel slider in the Referrals network. null = show the latest
  // (default). An ISO date string filters the visualization to "show the
  // network as it looked on this date." Set via the slider under the graph.
  const [networkAsOf, setNetworkAsOf] = useState(null);
  // Referrals v2 — ask-next queue interaction state
  const [askActiveId, setAskActiveId] = useState(null);
  const [askTone, setAskTone] = useState("neutral"); // softer | neutral | firmer
  const [askDraft, setAskDraft] = useState("");
  // Persisted "already asked" set — once acted-on, a client never appears in ask queue again.
  // Loaded from localStorage so the state survives reloads.
  const [askActed, setAskActed] = useState(() => {
    try { const raw = localStorage.getItem("rt-ask-acted"); return raw ? new Set(JSON.parse(raw)) : new Set(); } catch { return new Set(); }
  });

  const addRef = async () => {
    if (!refName.trim() || !refFrom) return;
    const clientObj = clients.find(c => c.name === refFrom);
    const { data: created } = await referralsDb.create(user.id, {
      referred_to: refName.trim(),
      referred_by: refFrom,
      referred_by_client_id: clientObj?.id || null,
      status: refStatus,
      revenue: parseInt(refRevenue) || 0,
      total_revenue: parseInt(refTotalRevenue) || 0,
      date_added: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    });
    setRefs([{ id: created?.id || "ref" + Date.now(), from: refFrom, to: refName.trim(), date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }), converted: refStatus === "converted" || refStatus === "closed", revenue: parseInt(refRevenue) || 0, totalRevenue: parseInt(refTotalRevenue) || 0, status: refStatus }, ...refs]);
    setRefName(""); setRefFrom(""); setRefStatus("converted"); setRefRevenue(""); setRefTotalRevenue(""); setRefForm(false);
  };

  const refsConverted = refs.filter(r => r.converted || r.status === "converted" || r.status === "closed");
  const refsRevenue = refsConverted.reduce((a, r) => a + r.revenue, 0);

  // Coach
  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessages] = useState([]);
  const [aiTyping, setAiTyping] = useState(false);
  // Attachments staged for next send. Shape: { id, name, type (image|document), media_type, data (base64), size }
  const [aiAttachments, setAiAttachments] = useState([]);
  // Current conversation id — null until first message persists. Tracks which
  // rai_conversations row is being appended to; set when user picks a past chat.
  const [aiConvoId, setAiConvoId] = useState(null);
  // Sidebar list of past conversations (populated by loadData).
  const [raiConvoList, setRaiConvoList] = useState([]);
  const aiEndRef = useRef(null);
  const aiUserRef = useRef(null);
  useEffect(() => {
    // Claude-style: when a new user message is sent, scroll that message to the top of the viewport
    // leaving room below for Rai's response. Falls back to bottom scroll when Rai is typing.
    if (aiMessages.length > 0 && aiMessages[aiMessages.length - 1].role === "user") {
      aiUserRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      aiEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [aiMessages, aiTyping]);
  // Reset Rai textarea heights when input clears (e.g. after sending a message)
  useEffect(() => {
    if (aiInput === "") {
      document.querySelectorAll('textarea[placeholder="Reply to Rai…"], textarea[placeholder="Ask about a client, draft a message, get advice…"]').forEach(t => {
        t.style.height = "auto";
      });
    }
  }, [aiInput]);
  // Read a File as base64 (strips the data:... prefix, keeps only raw base64).
  // Returns null on error so the caller can continue without attaching.
  const readFileAsBase64 = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") return resolve(null);
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });

  // Pick files and stage them for the next send. Accepts images (PNG/JPG/WEBP/GIF)
  // and PDF documents. Text files are rejected here — the user should paste their
  // content instead for better results.
  const handleFilePick = async (files) => {
    const accepted = [];
    for (const f of files) {
      if (f.size > 10 * 1024 * 1024) {
        // 10MB limit — matches Anthropic's practical cap for base64 content
        alert(`"${f.name}" is too large (over 10MB). Skipping.`);
        continue;
      }
      const isImage = /^image\/(png|jpe?g|webp|gif)$/i.test(f.type);
      const isPdf = f.type === "application/pdf";
      if (!isImage && !isPdf) {
        alert(`"${f.name}" isn't a supported file type. PDFs and images only.`);
        continue;
      }
      const data = await readFileAsBase64(f);
      if (!data) continue;
      accepted.push({
        id: Math.random().toString(36).slice(2),
        name: f.name,
        type: isImage ? "image" : "document",
        media_type: f.type,
        data,
        size: f.size,
      });
    }
    if (accepted.length) setAiAttachments(prev => [...prev, ...accepted]);
  };

  const sendAi = async (text) => {
    const q = text || aiInput;
    // Allow sending with attachments only (no text typed) — Anthropic accepts that.
    if (!q.trim() && aiAttachments.length === 0) return;
    // Snapshot attachments at call time so they render on the user bubble even if
    // the user starts picking more while the stream is in flight.
    const attachmentsForSend = aiAttachments;
    setAiAttachments([]);
    setAiMessages(prev => [...prev, { role: "user", text: q, attachments: attachmentsForSend }]);
    setAiInput("");
    setAiTyping(true);

    try {
      // Conversation history — last 10 messages in Anthropic format
      const history = aiMessages.slice(-10).map(m => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.text
      }));

      // Get the caller's JWT for the Edge Function to verify identity
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/rai-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
          "Accept": "text/event-stream",
        },
        body: JSON.stringify({
          message: q,
          history,
          focused_client_id: null,
          stream: true,
          // Attachments travel separately from message text; the Edge Function
          // merges them into the current user message's content array.
          attachments: attachmentsForSend.map(a => ({
            type: a.type,
            media_type: a.media_type,
            data: a.data,
            name: a.name,
          })),
        }),
      });

      // Rate limit: server returns JSON with status 429 (no stream)
      if (response.status === 429) {
        const data = await response.json();
        setAiMessages(prev => [...prev, { role: "ai", text: data.message || "You've hit your daily message limit. Try again tomorrow." }]);
        return;
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        console.error("Rai API error:", response.status, errText);
        setAiMessages(prev => [...prev, { role: "ai", text: "I'm having trouble thinking right now. Try again in a moment." }]);
        return;
      }

      // Streaming path: read SSE events, progressively build up the assistant message
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("text/event-stream") && response.body) {
        // Insert an empty AI message that we'll fill in chunk by chunk
        setAiMessages(prev => [...prev, { role: "ai", text: "" }]);
        setAiTyping(false); // remove the bouncing dots once streaming starts

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // SSE events are separated by double newlines
          const events = buffer.split("\n\n");
          buffer = events.pop() || ""; // incomplete event stays in buffer

          for (const evt of events) {
            const lines = evt.split("\n");
            for (const line of lines) {
              if (!line.startsWith("data:")) continue;
              const data = line.slice(5).trim();
              if (!data || data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                // Anthropic streaming: content_block_delta events carry text
                if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
                  accumulated += parsed.delta.text;
                  // Update the last message (the one we just inserted)
                  setAiMessages(prev => {
                    const next = [...prev];
                    next[next.length - 1] = { role: "ai", text: accumulated };
                    return next;
                  });
                }
              } catch {
                // ignore malformed JSON chunks
              }
            }
          }
        }

        // If stream ended with nothing, show fallback
        if (!accumulated) {
          setAiMessages(prev => {
            const next = [...prev];
            next[next.length - 1] = { role: "ai", text: "I'm having trouble thinking right now. Try again in a moment." };
            return next;
          });
          return;
        }

        // ═══ Persist conversation ═══
        // After a successful exchange, save the full transcript to rai_conversations.
        // - If we have no convo id yet, create a new row and set it as active.
        // - Otherwise append by overwriting the full messages array (atomic, avoids
        //   merge races with other tabs).
        // - Auto-generate a title from the user's first message (truncated) when
        //   the title is still null, i.e. on the first exchange of a new chat.
        try {
          const fullMessages = [
            ...aiMessages,
            { role: "user", text: q, attachments: attachmentsForSend },
            { role: "ai", text: accumulated },
          ];
          // Lazy-load convoDb calls to avoid regressing in environments where
          // create/updateTitle aren't yet exported (older deploys).
          if (!aiConvoId && convoDb.create) {
            const firstUserMsg = fullMessages.find(m => m.role === "user")?.text || "New chat";
            const autoTitle = firstUserMsg.slice(0, 60).trim() + (firstUserMsg.length > 60 ? "…" : "");
            const { data: created } = await convoDb.create(user.id, { title: autoTitle });
            if (created) {
              setAiConvoId(created.id);
              // Overwrite messages on the new row (create started it with []).
              await supabase
                .from("rai_conversations")
                .update({ messages: fullMessages })
                .eq("id", created.id);
              // Refresh the sidebar list with this new chat at the top.
              setRaiConvoList(prev => [
                { id: created.id, title: autoTitle, is_starred: false, updated_at: new Date().toISOString(), client_id: null, client: null },
                ...prev,
              ]);
            }
          } else if (aiConvoId) {
            await supabase
              .from("rai_conversations")
              .update({ messages: fullMessages, updated_at: new Date().toISOString() })
              .eq("id", aiConvoId);
            // Bump this chat to top of the sidebar list (mutation in place).
            setRaiConvoList(prev => {
              const idx = prev.findIndex(c => c.id === aiConvoId);
              if (idx < 0) return prev;
              const updated = { ...prev[idx], updated_at: new Date().toISOString() };
              const next = [...prev];
              next.splice(idx, 1);
              // Starred chats stay at top; non-starred move to top of unstarred.
              if (updated.is_starred) {
                next.unshift(updated);
              } else {
                const firstUnstarred = next.findIndex(c => !c.is_starred);
                if (firstUnstarred < 0) next.push(updated);
                else next.splice(firstUnstarred, 0, updated);
              }
              return next;
            });
          }
        } catch (persistErr) {
          console.warn("Conversation persistence failed (non-fatal):", persistErr);
        }
        return;
      }

      // Fallback: non-streaming JSON response
      const data = await response.json();
      const reply = data.reply || "I'm having trouble thinking right now. Try again in a moment.";
      setAiMessages(prev => [...prev, { role: "ai", text: reply }]);
    } catch (err) {
      console.error("Rai API error:", err);
      setAiMessages(prev => [...prev, { role: "ai", text: "Something went wrong connecting to Rai. Check your connection and try again." }]);
    }
    setAiTyping(false);
  };

  // ─── Rai conversation handlers (sidebar) ──────────────────────────────
  // Start a fresh chat — clears messages + convo id so the next send creates
  // a new row. Doesn't hit the DB (nothing to save yet).
  const startNewRaiChat = () => {
    setAiMessages([]);
    setAiInput("");
    setAiAttachments([]);
    setAiConvoId(null);
  };

  // Load a past conversation into the chat pane. Fetches the full row (list
  // endpoint returns lightweight fields only, so we need get() for messages).
  const openRaiChat = async (convoId) => {
    if (!convoDb.get) return;
    const { data } = await convoDb.get(convoId);
    if (!data) return;
    // Messages persisted as {role, text, attachments, timestamp}. The chat UI
    // reads {role, text, attachments}, so normalize defensively.
    const messages = (data.messages || []).map(m => ({
      role: m.role === "assistant" ? "ai" : m.role,
      text: m.text || "",
      attachments: m.attachments || [],
    }));
    setAiMessages(messages);
    setAiConvoId(convoId);
    setAiInput("");
    setAiAttachments([]);
  };

  // Toggle star. Optimistic update — flip local state first, then persist.
  // If the DB write fails, revert. Keeps the sidebar snappy.
  // Dismiss the "Connect Google Calendar" nudge on the Today page.
  // Optimistic: hide immediately, persist to profile. On failure we
  // revert so the prompt reappears (better the user sees it again than
  // thinks they dismissed it and it silently comes back next session).
  const dismissGoogleCalPrompt = async () => {
    setGoogleCalPromptDismissed(true);
    try {
      const { error } = await profileDb.update(user.id, { google_cal_prompt_dismissed: true });
      if (error) throw error;
    } catch (e) {
      console.error("Failed to persist Google Calendar prompt dismissal:", e);
      setGoogleCalPromptDismissed(false);
    }
  };

  const toggleRaiChatStar = async (convoId, currentStarred) => {
    const nextStarred = !currentStarred;
    setRaiConvoList(prev => {
      const idx = prev.findIndex(c => c.id === convoId);
      if (idx < 0) return prev;
      const updated = { ...prev[idx], is_starred: nextStarred };
      const without = prev.filter(c => c.id !== convoId);
      // Re-insert: starred chats go to the top of starred group; unstarred
      // slide into the unstarred group by updated_at.
      if (nextStarred) {
        return [updated, ...without];
      } else {
        const firstUnstarred = without.findIndex(c => !c.is_starred);
        if (firstUnstarred < 0) return [...without, updated];
        return [...without.slice(0, firstUnstarred), updated, ...without.slice(firstUnstarred)];
      }
    });
    if (convoDb.toggleStar) {
      const { error } = await convoDb.toggleStar(convoId, nextStarred);
      if (error) {
        // Revert optimistic update
        setRaiConvoList(prev => prev.map(c => c.id === convoId ? { ...c, is_starred: currentStarred } : c));
      }
    }
  };

  // Delete chat. Confirms first — losing a conversation is unrecoverable.
  const deleteRaiChat = async (convoId) => {
    if (!confirm("Delete this chat? This can't be undone.")) return;
    // Optimistic remove from list
    setRaiConvoList(prev => prev.filter(c => c.id !== convoId));
    // If user is currently viewing the chat they deleted, reset to empty
    if (aiConvoId === convoId) {
      setAiMessages([]);
      setAiConvoId(null);
    }
    if (convoDb.delete) {
      await convoDb.delete(convoId);
    }
  };
  // ──────────────────────────────────────────────────────────────────────

  // ═══ PANEL COMPONENTS ═══
  const PanelCard = ({ children, style }) => <div style={{ background: "#FAFAF8", borderRadius: 14, border: "1px solid #E8ECE6", padding: "14px", marginBottom: 24, ...style }}>{children}</div>;
  
  // ─── Daybook save handler — debounced 800ms ───────────────────────────
  const handleDaybookChange = (newValue) => {
    setDaybookEntry(newValue);
    setDaybookSaveStatus("saving");
    if (daybookSaveTimerRef.current) clearTimeout(daybookSaveTimerRef.current);
    daybookSaveTimerRef.current = setTimeout(async () => {
      if (!user) return;
      try {
        const res = await daybookDb.save(user.id, newValue);
        if (!res.error) setDaybookSaveStatus("saved");
        else setDaybookSaveStatus("idle");
      } catch (e) {
        console.warn("Daybook save failed:", e);
        setDaybookSaveStatus("idle");
      }
    }, 800);
  };

  // ─── DAYBOOK PANEL — replaces Talk to Rai on Today's right rail ─────
  const goTo = (id) => { if (page === "health" && id !== "health") { setHcDone({}); setHcOpen(null); } setPage(id); };
  const allPages = [...(tier === "enterprise" ? navItemsEnterprise : navItemsCore), ...(tier === "enterprise" ? moreItemsEnterprise : moreItemsCore)];
  const pageTitle = allPages.find(n => n.id === page)?.label || "";
  const totalRev = clients.reduce((a, c) => a + c.revenue, 0);
  const overdueChecks = hcQueue.filter(h => (h.overdue > 0 || h.due === "Today") && !hcDone[h.client]).length;
  const totalRefRev = refs.filter(r => r.status === "converted" || r.converted).reduce((a, r) => a + (r.revenue || 0), 0);

  const todayDot = tasksDone < tasksTotal;
  const healthDot = overdueChecks > 0;
  const hasDot = (id) => (id === "today" && todayDot) || (id === "health" && healthDot);

  return (
    <div className="app-root" style={{ minHeight: "100vh", fontFamily: "'Manrope', system-ui, sans-serif", color: C.text, background: C.bg }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,300..700,30..100,0..1;1,9..144,300..700,30..100,0..1&family=Caveat:wght@500;600;700&display=swap');
        ${THEME_CSS}
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: var(--rt-bg); overscroll-behavior: none; }
        input, textarea, select { font-size: 16px !important; }
        @media (min-width: 768px) { input, textarea, select { font-size: 14px !important; } }
        ::selection { background: #33543E; color: #fff; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: var(--rt-border); border-radius: 2px; }
        .nav-item { transition: all 180ms var(--rt-ease-out); cursor: pointer; }
        /* Hover on inactive items lifts to deepCream + darkens text/icon.
           Light-substrate sidebar (post-revert): the hover layer is a
           shade darker than the substrate (substrate F2EEE8, hover EAE4D6).
           The active state uses the same deepCream fill — distinguished
           by inset shadow + bold weight, matching the Linear/Notion
           sidebar convention. */
        /* Nav-item hover previews the active state at lower amplitude.
           Idle (transparent) → Hover (white card + xs shadow) →
           Active (white card + card-lift + 0.5px translate). Click
           is always a clear upgrade. Going to deepCream on hover
           inverted that — darker on hover, lighter on click — which
           read as confused. */
        .nav-item:hover:not(.is-active) {
          background: var(--rt-card) !important;
          box-shadow: var(--rt-sh-xs) !important;
          color: var(--rt-text) !important;
        }
        .nav-item:hover:not(.is-active) svg { color: var(--rt-text) !important; }
        .nav-item:active:not(.is-active) { transform: scale(0.98); }
        /* User chip rests transparent (matches sidebar bg). Hover adds a
           subtle surface wash + soft shadow + 1px lift — same logical
           progression as nav: never darken, only lift, but kept light
           because we're inside the sidebar's substrate. */
        .rt-user-chip:hover {
          background: rgba(255,255,255,0.6);
          box-shadow: var(--rt-sh-xs);
          transform: translateY(-1px);
        }
        .rt-user-chip:active {
          transform: translateY(0) scale(0.99);
          transition: transform 80ms var(--rt-ease-press);
        }
        .r-period-opt {
          color: var(--rt-text-sec);
          border-bottom: 1px solid transparent;
          transition: color 180ms var(--rt-ease-out), border-color 180ms var(--rt-ease-out);
        }
        @media (hover: hover) {
          .r-period-opt:hover {
            color: var(--rt-text);
            border-bottom-color: rgba(28,50,36,0.20);
          }
        }
        /* ─── TODAY PAGE HOVERS ───
           All scoped to (hover: hover) so touch devices don't get stuck states.
           Inactive variants use :not(.is-active) for segmented toggles. */

        /* Purple inline links — Magic Scoop client name, Connect Google Calendar.
           Hover signal: color darkens + underline dotted → solid. Font-weight
           stays at 600 at rest AND hover so the box geometry never shifts —
           hovering can't push neighboring text or change the link's footprint. */
        .rt-purple-link {
          color: ${C.btn};
          font-weight: 600;
          border-bottom: 1px dotted ${C.btn};
          transition: color 0.12s, border-bottom-color 0.12s;
        }
        @media (hover: hover) {
          .rt-purple-link:hover {
            color: ${C.btnHover};
            border-bottom: 1px solid ${C.btnHover};
          }
        }

        /* Quiet dismiss links — "Not now". Muted → textSec on hover.
           Deliberately understated so it doesn't compete with the primary
           action next to it. */
        .rt-quiet-link {
          color: var(--rt-text-muted);
          transition: color 0.12s;
        }
        @media (hover: hover) {
          .rt-quiet-link:hover { color: var(--rt-text-sec); }
        }

        /* Today/Tomorrow timeline toggle — text-only hover (no fill), so
           hovering an inactive option doesn't create a "second oval" next
           to the active one. Press-state scale gives tactile feedback so
           toggles feel as responsive to clicks as the Focus button. */
        .rt-day-opt {
          background: transparent;
          color: var(--rt-text-muted);
          box-shadow: none;
          transition: color 180ms var(--rt-ease-out), transform 200ms var(--rt-ease-out);
        }
        @media (hover: hover) {
          .rt-day-opt:hover:not(.is-active) {
            color: var(--rt-text);
          }
        }
        .rt-day-opt:active:not(.is-active) {
          transform: scale(0.96);
          transition: transform 80ms var(--rt-ease-press);
        }

        /* Ranked by Rai / Manual toggle — same text-only hover + press
           scale. Active state styling is set inline (gradient for Rai mode,
           white card for Manual). */
        .rt-rank-opt {
          background: transparent;
          color: var(--rt-text-sec);
          box-shadow: none;
          transition: color 180ms var(--rt-ease-out), transform 200ms var(--rt-ease-out);
        }
        @media (hover: hover) {
          .rt-rank-opt:hover:not(.is-active) {
            color: var(--rt-text);
          }
        }
        .rt-rank-opt:active:not(.is-active) {
          transform: scale(0.96);
          transition: transform 80ms var(--rt-ease-press);
        }

        /* Focus button — soft shadow surface, no border. Active state
           gets a green-glow shadow (set inline) matching the polish
           language. Inactive previews the active green color on hover. */
        .rt-focus-btn {
          background: var(--rt-card);
          color: var(--rt-text-sec);
          border: none;
          box-shadow: var(--rt-sh-card);
          transition: box-shadow 200ms var(--rt-ease-out),
                      color 200ms var(--rt-ease-out),
                      transform 200ms var(--rt-ease-out);
        }
        @media (hover: hover) {
          .rt-focus-btn:hover:not(.is-active) {
            color: #1C3224;
            box-shadow: var(--rt-sh-card-hover);
            transform: translateY(-1px);
          }
        }
        .rt-focus-btn:active { transform: translateY(0) scale(0.97); transition: transform 80ms var(--rt-ease-press); }

        /* "3 events" stats button — mobile only (desktop sets pointer-events:
           none on this class). Subtle wash, matches composer chip hover. */
        @media (max-width: 768px) and (hover: hover) {
          .rt-band-sub-events:hover { background: rgba(0,0,0,0.04); border-radius: 4px; }
        }
        /* ── LEGACY .r-btn — base motion + lift ────────────
           Buttons that use .r-btn get hover lift + press scale. The
           background gradient is applied via the data-tone="purple"
           attribute on the element. To migrate an existing flat-purple
           button to the gradient: add data-tone="purple" and drop the
           inline background:C.btn. */
        .r-btn { transition: all 200ms var(--rt-ease-out); cursor: pointer; }
        @media (hover: hover) {
          .r-btn:hover:not(:disabled) {
            transform: translateY(-1px);
          }
        }
        .r-btn:active:not(:disabled) { transform: scale(0.97); transition: transform 80ms var(--rt-ease-press); }
        .r-btn[data-tone="purple"] {
          background: var(--rt-grad-btn) !important;
          color: #fff !important;
          box-shadow: var(--rt-sh-purple) !important;
        }
        .r-btn[data-tone="purple"]:hover:not(:disabled) {
          background: var(--rt-grad-btn-hover) !important;
          box-shadow: var(--rt-sh-purple-hover) !important;
        }
        .r-btn[data-tone="green"] {
          background: var(--rt-grad-green-deep) !important;
          color: #fff !important;
          box-shadow: var(--rt-sh-green-glow) !important;
        }
        .r-btn[data-tone="green"]:hover:not(:disabled) {
          box-shadow: 0 0 0 1px rgba(51,84,62,0.18), 0 6px 18px rgba(51,84,62,0.28) !important;
        }
        .row-hover { transition: background 0.1s, transform 180ms var(--rt-ease-out); cursor: pointer; }
        .row-hover:hover { background: ${C.primarySoft}; transform: translateX(2px); }
        /* Neutral row-hover variant — for table rows where green is too
           loud / fights with status pills inside the row. Same shift-right
           motion, lighter wash. Used in the Clients Table view (both mobile
           + desktop variants). */
        .row-hover-neutral { transition: background 0.1s, transform 180ms var(--rt-ease-out); cursor: pointer; }
        .row-hover-neutral:hover { background: rgba(0,0,0,0.03); transform: translateX(2px); }

        /* ════════════════════════════════════════════════════
           DESIGN LANGUAGE — single source of truth.
           Every Btn / Card / Pill / Toggle / IconBtn renders
           through these rules. The primitives in App.jsx (Btn,
           Card, Pill, Toggle, IconBtn) attach the relevant class
           and pass through user style overrides.
           ════════════════════════════════════════════════════ */

        /* ── BUTTONS ─────────────────────────────────────── */
        /* Add Task composer submit — two-state (disabled = warm neutral,
           enabled = purple gradient). Hover/press transitions defined here
           so the inline two-state styling stays clean. */
        .rt-add-task-btn {
          transition: background 220ms var(--rt-ease-out),
                      box-shadow 220ms var(--rt-ease-out),
                      color 220ms var(--rt-ease-out),
                      transform 200ms var(--rt-ease-out);
        }
        .rt-add-task-btn:not(:disabled):hover {
          background: var(--rt-grad-btn-hover) !important;
          box-shadow: var(--rt-sh-rai-pop-hover) !important;
          transform: translateY(-1px);
        }
        .rt-add-task-btn:not(:disabled):active {
          transform: translateY(0) scale(0.97);
          transition: transform 80ms var(--rt-ease-press);
        }
        /* Rai-territory gradient-halo buttons (sidebar New Chat, future
           additions). Mirror the Add Task armed-state motion: lift on
           hover, brighten the gradient, intensify the halo. */
        .rt-rai-pop-btn:hover {
          background: var(--rt-grad-btn-hover) !important;
          box-shadow: var(--rt-sh-rai-pop-hover) !important;
          transform: translateY(-1px);
        }
        .rt-rai-pop-btn:active {
          transform: translateY(0) scale(0.98);
          transition: transform 80ms var(--rt-ease-press);
        }

        /* ──────────────────────────────────────────────────────
           CLIENT MODAL — STICKY FOOTER BUTTONS
           Discuss at rest is flat C.btn (matches Add Client, Add
           Worker — the standard primary button style). On hover
           it reveals the Rai-territory gradient + halo + 1px lift.
           Edit/Pause/Remove are card chips at rest and lift to
           sh-card on hover, same chip language as nav/composer.
           ────────────────────────────────────────────────────── */
        .rt-cm-btn-primary {
          background: ${C.btn};
          color: #fff;
          box-shadow: var(--rt-sh-xs);
          transition: background 200ms var(--rt-ease-out),
                      box-shadow 200ms var(--rt-ease-out),
                      transform 200ms var(--rt-ease-out);
        }
        .rt-cm-btn-primary:hover {
          background: var(--rt-grad-btn);
          box-shadow: var(--rt-sh-rai-pop);
          transform: translateY(-1px);
        }
        .rt-cm-btn-primary:active {
          transform: translateY(0) scale(0.98);
          transition: transform 80ms var(--rt-ease-press);
        }
        .rt-cm-btn-secondary {
          background: ${C.card};
          color: ${C.textSec};
          box-shadow: var(--rt-sh-xs);
          transition: background 160ms var(--rt-ease-out),
                      color 160ms var(--rt-ease-out),
                      box-shadow 200ms var(--rt-ease-out),
                      transform 200ms var(--rt-ease-out);
        }
        .rt-cm-btn-secondary:hover {
          color: ${C.text};
          box-shadow: var(--rt-sh-card);
          transform: translateY(-1px);
        }
        .rt-cm-btn-secondary:active {
          transform: translateY(0) scale(0.98);
          transition: transform 80ms var(--rt-ease-press);
        }
        .rt-cm-btn-danger {
          background: ${C.card};
          color: ${C.danger};
          box-shadow: var(--rt-sh-xs);
          transition: box-shadow 200ms var(--rt-ease-out),
                      transform 200ms var(--rt-ease-out);
        }
        .rt-cm-btn-danger:hover {
          box-shadow: var(--rt-sh-card);
          transform: translateY(-1px);
        }
        .rt-cm-btn-danger:active {
          transform: translateY(0) scale(0.98);
          transition: transform 80ms var(--rt-ease-press);
        }
          transition: transform 80ms var(--rt-ease-press);
        }
        /* ── PILL — generic small status/info chip ───────── */
        /* Most pills are presentational. If interactive, wrap in a button. */

        /* ── ROW (task row, client row, queue row) ──────── */
        /* Generic row that gets the same treatment as a card but
           with the geometry of a horizontal list item. */
        .rt-row {
          transition: box-shadow 200ms var(--rt-ease-out),
                      transform 200ms var(--rt-ease-out);
        }
        .rt-row:hover:not(.is-done) {
          box-shadow: var(--rt-sh-row-hover) !important;
          transform: translateY(-1px);
        }
        .rt-row:hover .rt-dismiss { opacity: 1 !important; }

        /* ── COMPOSER ────────────────────────────────────── */
        .rt-composer {
          transition: box-shadow 200ms var(--rt-ease-out);
        }
        .rt-composer:focus-within {
          box-shadow: var(--rt-sh-card-hover), 0 0 0 3px rgba(91,33,182,0.10) !important;
        }

        /* ── CHECKBOX ────────────────────────────────────── */
        .rt-row .rt-check {
          transition: background 240ms ease, border-color 240ms ease,
                      box-shadow 200ms var(--rt-ease-out),
                      transform 280ms cubic-bezier(.34,1.56,.64,1);
        }
        .rt-row:not(.is-done) .rt-check:hover {
          border-color: #558B68 !important;
          box-shadow: 0 0 0 4px var(--rt-primary-soft, #E6EFE9);
        }
        .rt-row .rt-check svg {
          opacity: 0;
          transform: scale(0.4);
          transition: opacity 220ms ease 60ms, transform 320ms cubic-bezier(.34,1.56,.64,1) 60ms;
        }
        .rt-row.is-done .rt-check {
          background: var(--rt-grad-green-deep) !important;
          border-color: #33543E !important;
          box-shadow: var(--rt-sh-green-glow);
          transform: scale(1);
        }
        .rt-row.is-done .rt-check svg { opacity: 1; transform: scale(1); }

        /* ── RAI CLIENT-OF-THE-DAY RAIL ──────────────────── */
        /* Applied via class .rt-rai-boost to every task whose client is
           today's Rai pick. Purple inset bar on the left + ✦ medallion
           just outside the left edge. Quiet but unmistakable. */
        .rt-rai-boost {
          box-shadow: var(--rt-sh-row), inset 2px 0 0 0 #5B21B6 !important;
          position: relative;
        }
        .rt-rai-boost:hover:not(.is-done) {
          box-shadow: var(--rt-sh-row-hover), inset 2px 0 0 0 #5B21B6 !important;
        }
        .rt-rai-boost::before {
          content: '✦';
          position: absolute;
          /* Upper-left placement: tucked just outside the row's top-left
             corner instead of vertically centered. Reads as a small
             marker rather than a centered medallion. */
          left: -6px;
          top: 6px;
          /* Shrunk from 18×18 to 14×14 for a less heavy presence — Adam
             wants the star to be a quiet, restless marker, not the focal
             element of the row. */
          width: 14px;
          height: 14px;
          background: var(--rt-grad-btn);
          color: #fff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 7.5px;
          line-height: 1;
          font-weight: 700;
          box-shadow: var(--rt-sh-purple);
          z-index: 2;
          pointer-events: none;
          /* "Like it's being touched" — gentle bob + micro-rotation on a
             slow infinite loop. Visible enough to feel alive, quiet
             enough to read as a marker, not a notification. */
          animation: rtRaiBoostBreathe 2.6s ease-in-out infinite;
          transform-origin: center center;
          will-change: transform;
        }
        @keyframes rtRaiBoostBreathe {
          0%   { transform: translateY(0) rotate(-2deg) scale(1); }
          25%  { transform: translateY(-1.5px) rotate(2deg) scale(1.04); }
          50%  { transform: translateY(0) rotate(-1.5deg) scale(1); }
          75%  { transform: translateY(-1px) rotate(2deg) scale(1.03); }
          100% { transform: translateY(0) rotate(-2deg) scale(1); }
        }
        /* Respect the reduced-motion accessibility preference — users
           who've opted out of motion shouldn't see the bob. The mark
           stays put. */
        @media (prefers-reduced-motion: reduce) {
          .rt-rai-boost::before { animation: none; }
        }

        /* Calendar composer (G) — idle is the flush hairline-divider
           treatment set inline at the call site. On focus-within, the
           row softens into a warm-cream recessed input. Lets us keep
           the lightweight idle state Adam wanted while restoring real
           input weight while typing. Transitions cover the morph so
           neither state feels jumpy. */
        .rt-cal-composer {
          transition: background 180ms var(--rt-ease-out),
                      box-shadow 180ms var(--rt-ease-out),
                      border-top-color 180ms var(--rt-ease-out),
                      border-radius 180ms var(--rt-ease-out),
                      padding 180ms var(--rt-ease-out),
                      margin-top 180ms var(--rt-ease-out);
        }
        .rt-cal-composer:focus-within {
          background: var(--rt-surface-warm);
          box-shadow: inset 0 1px 2px rgba(20,30,22,0.08);
          border-top-color: transparent !important;
          border-radius: 8px;
          padding: 9px 12px !important;
          margin-top: 10px !important;
        }

        /* Progress bar leading-edge highlight (D). A small radial bright
           spot at the right edge of the fill suggests an instrument in
           motion rather than a flat gradient. */
        .rt-pct-fill {
          position: absolute;
        }
        .rt-pct-fill::after {
          content: '';
          position: absolute;
          right: -1px;
          top: -2px;
          bottom: -2px;
          width: 8px;
          border-radius: 999px;
          background: radial-gradient(ellipse at left, rgba(255,255,255,0.55), transparent 70%);
          pointer-events: none;
        }

        /* Pick-sentence ✦ medallion removed — Rai pick is pure italic
           prose to keep the band quiet and tight. */

        /* ── ANIMATIONS ──────────────────────────────────── */
        @keyframes rtChkIn {
          from { transform: scale(0) rotate(-12deg); opacity: 0; }
          to { transform: scale(1) rotate(0); opacity: 1; }
        }
        @keyframes rtNowPulse {
          0%, 100% { box-shadow: 0 0 0 1px rgba(91,33,182,0.18), 0 2px 8px rgba(91,33,182,0.28); }
          50%      { box-shadow: 0 0 0 1px rgba(91,33,182,0.24), 0 2px 14px rgba(91,33,182,0.42); }
        }
        .rt-now-pulse { animation: rtNowPulse 2.4s ease-in-out infinite; }
        @keyframes rtSavePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
        .rt-save-pulse { animation: rtSavePulse 2s ease-in-out infinite; }

        /* Composer chip auto-fill pulse — fires when parseComposer
           catches a typed phrase and auto-fills the Client / Worker / Due
           chip. Brief brighten then settle. No scale (would push neighbors
           mid-line). The chip is already animating its color/bg change via
           the existing 120ms transition; this pulse layers ON TOP via a
           pseudo-element ring that fades in then out. ~500ms total. */
        /* Skeleton loading placeholders — row-shaped shimmers that
           mirror the real row geometry, so when data arrives nothing
           jumps. Used on Today (tasks), Clients (rows), Health (queue).
           Light grey base on a paler sweep at ~1.4s cycle. */
        @keyframes rtShimmer {
          0%   { background-position: -480px 0; }
          100% { background-position: 480px 0; }
        }
        .rt-sk {
          background-color: #EFEFEA;
          background-image: linear-gradient(90deg, #EFEFEA 0%, #F7F5F0 50%, #EFEFEA 100%);
          background-size: 480px 100%;
          background-repeat: no-repeat;
          animation: rtShimmer 1.4s ease-in-out infinite;
          border-radius: 4px;
          display: inline-block;
        }
        @keyframes chipPulse {
          0%   { box-shadow: 0 0 0 0 rgba(91,33,182,0.55); }
          40%  { box-shadow: 0 0 0 6px rgba(91,33,182,0.18); }
          100% { box-shadow: 0 0 0 10px rgba(91,33,182,0); }
        }
        .chip-pulse {
          animation: chipPulse 500ms ease-out;
        }
        /* Shared icon-close button — any × that dismisses a chip, clears
           a field, or closes a modal. Faint grey wash under the icon +
           icon darkens muted → text. Single source of truth so every
           close button feels the same. */
        .rt-icon-close { transition: background 120ms ease, color 120ms ease; cursor: pointer; }
        @media (hover: hover) {
          .rt-icon-close:hover { background: rgba(0,0,0,0.05); color: ${C.text} !important; }
        }
        /* Clients page sort + filter chips — inactive variant.
           Chip language: subtle card surface with sh-xs at rest, deeper
           shadow + slight lift on hover. Same recipe as nav user chip,
           composer chip pills, etc. */
        .rt-sort-opt {
          background: ${C.card};
          color: ${C.textSec};
          border: none;
          box-shadow: var(--rt-sh-xs);
          transition: background 120ms ease, color 120ms ease, box-shadow 180ms var(--rt-ease-out), transform 180ms var(--rt-ease-out);
        }
        @media (hover: hover) {
          .rt-sort-opt:hover {
            color: ${C.text};
            box-shadow: var(--rt-sh-card);
            transform: translateY(-1px);
          }
        }
        /* Clients page view toggle — inactive variant. Translucent white
           wash on hover, text darkens muted → full. Same pattern as the
           Today/Tomorrow toggle. */
        .rt-view-opt {
          background: transparent;
          color: ${C.textMuted};
          box-shadow: none;
          transition: background 120ms ease, color 120ms ease;
        }
        @media (hover: hover) {
          .rt-view-opt:hover {
            background: rgba(255,255,255,0.55);
            color: ${C.text};
          }
        }
        .r-desk { display: none; }
        .r-mob-bot { display: flex; }
        /* Mobile bottom nav strip is horizontally scrollable. Hide the
           native scrollbar across all browsers — affordance is the icon
           overflow itself plus the inertia/snap behavior. */
        .rt-mob-nav-scroll::-webkit-scrollbar { display: none; }
        .rt-mob-nav-scroll { -ms-overflow-style: none; }
        /* Timeline scroll container hides its scrollbar — the partial-day
           visible window plus the NOW marker make scroll affordance clear
           enough without a visible track. Covers all three browser engines:
           webkit (chrome/safari/edge), firefox (scrollbar-width), legacy
           edge (-ms-overflow-style). */
        .rt-timeline-scroll::-webkit-scrollbar { display: none; }
        .rt-timeline-scroll { scrollbar-width: none; -ms-overflow-style: none; }
        /* Client profile modal scrolls internally up to 90vh. Hide the
           scrollbar — the modal's clear edges and the sticky close button
           provide enough affordance that the inner track adds visual noise. */
        .r-client-modal::-webkit-scrollbar { display: none; }
        .r-client-modal { scrollbar-width: none; -ms-overflow-style: none; }
        /* Sidebar scrollbar — sidebar root has overflow-y: auto so short
           screens can scroll to reveal the widget + user chip + recent
           chats. Native scrollbar would clutter the warm-cream substrate;
           hide it across all browser engines. */
        .r-desk::-webkit-scrollbar { display: none; }
        .r-desk { scrollbar-width: none; -ms-overflow-style: none; }
        /* Due picker and Client picker on mobile: keep anchored to the chip
           (like Worker does) instead of popping as a bottom sheet. Earlier
           iterations pinned these to the viewport to give them screen room,
           but it disconnected them from the source chip and looked sloppy.
           Falling back to the inline JSX position (absolute, dropping below
           the chip) makes the relationship clear and matches Worker. */
        .r-main { padding: 16px 16px 96px; }
        .r-main:has(.r-rai-page) { background: none; padding: 0 !important; }
        .r-today-panel { display: none !important; }
        .r-client-modal { top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; transform: none !important; max-width: 100% !important; max-height: 100% !important; border-radius: 0 !important; }
        /* Mobile: chat user-message clearance from sticky top bar when scrolled */
        .r-rai-inner { padding-top: 56px !important; }
        .r-chat-msg-user { scroll-margin-top: 56px !important; }
        /* Mobile: tighten chat input bar bottom padding — clear mobile nav (60px) + breathing room */
        .r-rai-inputbar { padding: 10px 16px 88px !important; }
        /* Rai purple gradient — stronger on intro empty-state, lighter once chat starts */
        .r-rai-intro {
          background:
            radial-gradient(ellipse 75% 45% at 50% 8%, rgba(91,33,182,0.22), transparent 70%),
            radial-gradient(ellipse 60% 35% at 50% 0%, rgba(91,33,182,0.35), transparent 60%),
            ${C.bg};
        }
        .r-rai-chat {
          background:
            radial-gradient(ellipse 70% 35% at 50% 0%, rgba(91,33,182,0.10), transparent 75%),
            ${C.bg};
        }
        /* Make the inputbar inherit the gradient background so it doesn't show a seam */
        .r-rai-intro .r-rai-inputbar,
        .r-rai-chat .r-rai-inputbar { background: transparent !important; }
        /* Mobile: don't vertically center the intro — start content near the top */
        @media (max-width: 767px) {
          .r-rai-intro .r-rai-inner { justify-content: flex-start !important; padding-top: 48px !important; }
        }
        @media (min-width: 768px) {
          :root { --sidebar-w: 240px; --page-gap: 14px; --sidebar-left: 14px; }
          html, body { background: ${C.bg} !important; }
          .app-root { background: ${C.bg} !important; }
          .r-desk { display: flex !important; }
          .r-mob-bot { display: none !important; }
          .r-today-panel { display: block !important; }
          .r-client-modal { top: 50% !important; left: 50% !important; right: auto !important; bottom: auto !important; transform: translate(-50%, -50%) !important; max-width: 520px !important; max-height: 90vh !important; border-radius: 16px !important; }
          .r-main {
            padding: 28px 48px;
            position: fixed;
            top: var(--page-gap);
            right: var(--page-gap);
            bottom: var(--page-gap);
            left: calc(var(--sidebar-left) + var(--sidebar-w) + var(--page-gap));
            background: ${C.bg};
            overflow-y: auto;
            overflow-x: hidden;
          }
          /* Coach page keeps the card chrome (rounded corners, shadow) like every
             other page. overflow: hidden clips the purple gradient to the rounded
             corners. height (not min-height) locks the card exactly to the viewport
             so its top + bottom align with the sidebar — no gap above, no empty
             beige below. */
          .r-main:has(.r-rai-page) {
            padding: 0 !important;
            overflow: hidden;
            top: 0 !important;
            bottom: 0 !important;
            height: 100vh;
            min-height: 0 !important;
          }
          .r-rai-inner { padding-top: 32px !important; }
          .r-rai-inputbar { padding: 12px 24px 28px !important; }
          .r-chat-msg-user { scroll-margin-top: 24px !important; }
        }
        @keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:0.8} }
        @keyframes confetti-fall {
          0%   { transform: translate(0,0) rotate(0); opacity: 1; }
          100% { transform: translate(var(--tx), 70vh) rotate(var(--rot)); opacity: 0; }
        }
        /* (rt-row, rt-composer, rt-check, rt-add-task-btn rules consolidated
           above in DESIGN LANGUAGE block — these CSS rules are not duplicated
           here. The .rt-add-task-btn class points to .rt-btn-primary semantics
           via JSX; see App.jsx composer JSX for the migration.) */
        /* ASMR completion — done state styling */
        .rt-row.is-done {
          background: ${C.bg} !important;
          border-color: ${C.borderLight} !important;
          transition: background 320ms ease, border-color 320ms ease;
        }
        /* (rt-check rules consolidated above in DESIGN LANGUAGE block) */
        .rt-row .rt-task-title {
          position: relative;
          display: inline-block;
          font-size: 14px;
          font-weight: 500;
          line-height: 1.3;
          transition: color 320ms ease;
        }
        .rt-row .rt-task-title::after {
          content: ""; position: absolute; left: 0; top: 50%;
          height: 1.5px; width: 0; background: currentColor;
          transition: width 360ms cubic-bezier(.6, 0, .4, 1);
        }
        .rt-row.is-done .rt-task-title { color: ${C.textMuted}; }
        .rt-row.is-done .rt-task-title::after { width: 100%; }
        /* Mobile: long task titles get 2 lines instead of single-line ellipsis.
           Single-line truncate hides too much content on phone widths where
           there's no hover-tooltip affordance. We override the inline styles
           via !important; row height becomes variable but readability wins.
           Strikethrough-on-done still works because we use box-decoration-break
           continuity on the span. */
        @media (max-width: 900px) {
          .rt-row .rt-task-title {
            display: -webkit-box !important;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
            white-space: normal !important;
            overflow: hidden !important;
            text-overflow: clip !important;
            word-break: break-word;
          }
          /* On mobile the strikethrough ::after pseudo (which is a single
             positioned line) doesn't span both wrapped lines — use the native
             text-decoration instead so each line gets struck through. */
          .rt-row.is-done .rt-task-title { text-decoration: line-through; }
          .rt-row .rt-task-title::after { display: none; }
        }
        .rt-row.is-done .rt-row-meta { opacity: 0.55; color: ${C.textMuted}; transition: opacity 320ms ease, color 320ms ease; }
        .rt-row.is-done .rt-task-avatar { opacity: 0.4; filter: grayscale(1); transition: opacity 320ms ease, filter 320ms ease; }

        /* Elegant exit: when a completed task transitions to the "completed today"
           log, it shrinks vertically (max-height collapse), fades to invisible,
           and the gap below it disappears as the bucket below slides up. The
           negative margin pulls the next sibling up by exactly the gap (8px) so
           there's no remaining empty slot mid-animation. */
        .rt-row-wrap {
          max-height: 200px;
          opacity: 1;
          transition:
            max-height 360ms cubic-bezier(.4, 0, .2, 1),
            opacity 280ms ease,
            margin 360ms cubic-bezier(.4, 0, .2, 1),
            transform 360ms cubic-bezier(.4, 0, .2, 1);
        }
        .rt-row-wrap.is-exiting {
          max-height: 0 !important;
          opacity: 0;
          margin-bottom: -8px;
          transform: translateY(-4px);
          pointer-events: none;
          overflow: hidden !important;
        }
        /* On mobile, the push and dismiss buttons are hidden — swipe gestures
           replace them entirely. Right swipe pushes to next bucket, left swipe
           deletes. Backgrounds reveal during swipe so the action is intuitive. */
        @media (max-width: 767px) {
          .rt-row .rt-push,
          .rt-row .rt-dismiss {
            display: none !important;
          }
        }
        /* Dotted purple underline on task titles whose text contains a thinking
           verb. Indicates "click me to discuss with Rai." Title text stays black;
           only the underline goes from dotted-light to solid-purple on hover.
           Done tasks lose the affordance entirely.
           Note: text-underline-offset is small (1px) because the parent div has
           overflow:hidden — large offsets clip the dotted line out of view. */
        .rt-task-title.is-discussable {
          text-decoration: underline;
          text-decoration-style: dotted;
          text-decoration-color: ${C.btn};
          text-decoration-thickness: 2px;
          text-underline-offset: 2px;
          cursor: pointer;
          transition: text-decoration-color 160ms ease, text-decoration-style 160ms ease;
        }
        .rt-task-title.is-discussable:hover {
          text-decoration-style: solid;
          text-decoration-color: ${C.btn};
        }
        .rt-row.is-done .rt-task-title.is-discussable {
          text-decoration: none;
          cursor: default;
        }
        .rt-row.is-done .rt-row-tag { opacity: 0.45; transition: opacity 320ms ease; }
        .rt-row.is-done .rt-dismiss { opacity: 0.4 !important; }
        @keyframes rt-glow-pulse {
          0% { box-shadow: 0 0 0 0 rgba(45,134,89,0); transform: scale(1); }
          30% { box-shadow: 0 0 0 6px rgba(45,134,89,0.18); transform: scale(0.985); }
          100% { box-shadow: 0 0 0 0 rgba(45,134,89,0); transform: scale(1); }
        }
        .rt-row.is-just-done {
          animation: rt-glow-pulse 700ms ease-out;
        }
        .rt-row.is-just-done .rt-check {
          background: ${C.success} !important;
          border-color: ${C.success} !important;
          transform: scale(1.18);
        }
        .rc-queue-item:hover { background: ${C.primaryGhost} !important; }
        /* Rai sidebar — reveal star/delete on row hover */
        .r-convo-row:hover:not([style*="rgba(91,33,182"]) { background: var(--rt-deep-cream) !important; color: var(--rt-text) !important; }
        .r-convo-row:hover .r-convo-action { opacity: 1 !important; }
        /* Direct-hover on the revealed icons. Star brightens to gold
           (previews the on-state). Trash goes danger red (the universal
           "this deletes" signal). !important needed — the buttons set
           color inline so the cascade alone won't reach them. Scoped to
           hover-capable devices so touch doesn't get stuck states. */
        @media (hover: hover) {
          .r-convo-star:hover { color: #E6B800 !important; }
          .r-convo-del:hover { color: ${C.danger} !important; }
        }
        /* ═══════════════════════════════════════════════════════════════
           FOCUS MODE
           Page stays cream. Everything dims to 0.06 opacity except:
             - .rt-toolbar (the toggle row with Ranked by Rai + Focus button)
             - .rt-row.rt-focus-top (the highlighted top task)
        ═══════════════════════════════════════════════════════════════ */

        /* Dim sidebar contents */
        body:has(.rt-focus-on) .r-desk > *,
        body:has(.rt-focus-on) .r-mob-bot > * {
          opacity: 0.06 !important;
          transition: opacity 280ms ease;
          pointer-events: none;
        }

        /* Dim every direct child of the today grid except the tasks column.
           Focus mode is single-task tunnel vision — everything else fades. */
        .rt-focus-on > *:not(.rt-tasks-col) {
          opacity: 0.06 !important;
          pointer-events: none !important;
          transition: opacity 280ms ease;
        }

        /* Inside tasks col: dim every row except the focus-top one */
        .rt-focus-on .rt-row:not(.rt-focus-top) {
          opacity: 0.06 !important;
          pointer-events: none !important;
          transition: opacity 280ms ease;
        }

        /* Toolbar stays bright (no rule = default opacity 1, default styling) */

        /* Focused task gets a purple ring + soft shadow + slight scale to pop */
        .rt-focus-on .rt-row.rt-focus-top {
          transform: scale(1.015);
          box-shadow:
            0 0 0 1px rgba(91,33,182,0.35),
            0 8px 28px rgba(91,33,182,0.18),
            0 24px 64px rgba(0,0,0,0.10) !important;
          transition: transform 320ms ease 100ms, box-shadow 320ms ease 100ms;
        }
        /* When focus row is wrapped in a swipe container, scale + shadow apply to wrapper */
        .rt-focus-on .rt-focus-top-wrap {
          transform: scale(1.015);
          box-shadow:
            0 0 0 1px rgba(91,33,182,0.35),
            0 8px 28px rgba(91,33,182,0.18),
            0 24px 64px rgba(0,0,0,0.10);
          transition: transform 320ms ease 100ms, box-shadow 320ms ease 100ms;
        }
        /* Dim siblings of focus wrapper too */
        .rt-focus-on .rt-row-wrap:not(.rt-focus-top-wrap) {
          opacity: 0.06 !important;
          pointer-events: none !important;
          transition: opacity 280ms ease;
        }
        /* Dim bucket headers (TOMORROW / LATER labels) in focus mode */
        .rt-focus-on .rt-bucket-head {
          opacity: 0.06 !important;
          pointer-events: none !important;
          transition: opacity 280ms ease;
        }
        /* Dim the "Completed today" log (toggle button + expandable list)
           in focus mode. Its inner rows dim via the .rt-row rule, but the
           toggle button isn't an .rt-row and the wrapper isn't a direct
           grid child, so without this it stays bright. */
        .rt-focus-on .rt-completed-log {
          opacity: 0.06 !important;
          pointer-events: none !important;
          transition: opacity 280ms ease;
        }

        /* (rt-flash lightning animation removed — retired in favor of the
           calmer UI language. Focus mode now toggles silently.) */

        /* Today v4 — Grid layout, 3 breakpoints */
        /* Default: narrow desktop (901-1439px) — 2 cols, status + composer span full width, tasks + focus below */
        .rt-today-v4 {
          grid-template-columns: minmax(0, 1fr) 360px;
          grid-template-areas:
            "band band"
            "composer composer"
            "tasks focus";
        }
        .rt-mob-strip { display: none; }
        /* Desktop defaults for mobile-only band condensation elements.
           Mobile media query below toggles them on, restructures the
           meta row to a single inline row, and clamps the pick to 2
           lines with a "More" tap. */
        .rt-band-date-short { display: none; }
        @media (max-width: 900px) {
          .rt-today-v4 {
            grid-template-columns: 1fr;
            grid-template-areas:
              "band"
              "composer"
              "tasks";
          }
          .rt-focus-col { display: none !important; }
          .rt-rai-col { display: none !important; }
          /* Mobile band — condensed Option 1 layout. Target: ~110px total.
             Strategy:
             - Date compressed via .rt-band-date-short
             - Greeting drops to 20px
             - Rai pick clamped to 2 lines with fade-out + "More" tap
             - Meta row becomes ONE inline row: events · tasks [bar] pct%
               via flex-row + order swap on the pct block's children
               (bar reordered to come before num+lbl, lbl hidden, num shrunk) */
          .rt-band {
            display: flex !important;
            flex-direction: column !important;
            position: relative !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
          }
          .rt-band-date-long { display: none; }
          .rt-band-date-short { display: inline; }
          .rt-band-greet { font-size: 20px !important; white-space: nowrap; }
          /* Mobile-specific compressions on top of the now-universal
             flat meta row: hide the "OF TODAY DONE" label (number alone
             is enough at narrow widths), shrink the pct number, slightly
             tighter gap. */
          .rt-band-meta { flex-wrap: nowrap !important; gap: 10px !important; }
          .rt-band-sub { font-size: 12.5px !important; }
          .rt-pct-lbl { display: none !important; }
          .rt-pct-num { font-size: 13px !important; }
          .rt-pct-num > span { font-size: 11px !important; }
          /* Composer Row 2: let Add Task wrap to its own line on mobile
             so it can never be clipped off the right edge. The .rt-composer-controls
             takes the full row at flex-basis 100%, pushing the button
             below. Button stays compact but is centered. */
          .rt-composer-controls {
            flex: 0 0 100% !important;
            width: 100%;
          }
          .rt-add-task-btn {
            margin-left: auto !important;
            margin-right: auto !important;
          }
          .rt-composer-pill { padding: 6px 8px !important; gap: 4px !important; }
          .rt-composer-pill span { font-size: 11.5px !important; }
          .rt-row-meta span:nth-child(n+4) { display: none !important; }
        }
        /* Rai pick clamp + fade — universal (desktop AND mobile).
           The whole pick block is the tap target; cursor:pointer
           communicates affordance. The ::after gradient fades the
           bottom-right so the 2-line clamp reads as a soft fall-off,
           not a hard cut. Tapping toggles .is-clamped ↔ .is-expanded.
           The client-name link inside uses stopPropagation so tapping
           the client routes to the composer instead. */
        .rt-band-pick { /* plain text — only the client name span is clickable */ }
        .rt-band-pick.is-clamped {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .rt-band-pick.is-clamped::after {
          content: '';
          position: absolute;
          right: 0;
          bottom: 0;
          width: 120px;
          height: 1.5em;
          background: linear-gradient(90deg, rgba(250,250,247,0) 0%, var(--rt-bg) 65%, var(--rt-bg) 100%);
          pointer-events: none;
        }
        /* ── COMPOSER CHIPS — Client / Worker / Due ──
           Each chip is its own soft-shadow card with hover lift + press
           scale. Matches the Add Task button's shape and motion language.
           Filled state (inline background: C.btnLight from JSX) wins via
           inline precedence; on .is-filled it gets a purple-tinted shadow
           so the filled state reads as polished too. */
        .rt-composer-pill {
          background: var(--rt-card);
          box-shadow: var(--rt-sh-xs);
          transition: box-shadow 200ms var(--rt-ease-out),
                      transform 200ms var(--rt-ease-out),
                      color 200ms var(--rt-ease-out);
        }
        .rt-composer-pill:hover {
          box-shadow: var(--rt-sh-card) !important;
          transform: translateY(-1px);
          color: var(--rt-text);
        }
        .rt-composer-pill:active {
          transform: translateY(0) scale(0.97);
          transition: transform 80ms var(--rt-ease-press);
        }
        .rt-composer-pill.is-filled {
          box-shadow: 0 1px 2px rgba(91,33,182,0.12), 0 2px 6px rgba(91,33,182,0.08) !important;
        }
        .rt-composer-pill.is-filled:hover {
          box-shadow: 0 0 0 1px rgba(91,33,182,0.18), 0 4px 12px rgba(91,33,182,0.20) !important;
        }
        /* Recurring frequency chips inside the Due picker — share the
           composer-pill motion language (idle xs-shadow, hover lift,
           press scale). Idle vs active surfaces are set inline at the
           call site so the class only carries motion, not state. */
        .rt-rec-chip {
          transition: box-shadow 200ms var(--rt-ease-out),
                      transform 200ms var(--rt-ease-out),
                      background 200ms var(--rt-ease-out),
                      color 200ms var(--rt-ease-out);
        }
        .rt-rec-chip:hover {
          transform: translateY(-1px);
        }
        .rt-rec-chip:not(.is-active):hover {
          box-shadow: var(--rt-sh-card) !important;
        }
        .rt-rec-chip:active {
          transform: translateY(0) scale(0.97);
          transition: transform 80ms var(--rt-ease-press);
        }
        /* Wide desktop (>=1440px): 3 cols, Rai spans composer+tasks rows */
        @media (min-width: 1440px) {
          .rt-today-v4 {
            grid-template-columns: minmax(0, 1fr) 360px 360px;
            grid-template-rows: auto auto 1fr;
            grid-template-areas:
              "band band band"
              "composer composer rai"
              "tasks focus rai";
          }
          .rt-rai-col {
            display: flex !important;
            /* Critical: decouple Rai height from grid row math. min-height: 0 +
               max-height lets the sticky panel grow with its own scroller instead
               of inflating the composer row when content is long. */
            min-height: 0 !important;
            max-height: calc(100vh - 40px);
            overflow: hidden;
          }
        }
        /* Clients v2 grid — 2 cols narrow desktop, 3 cols wide (>=1440) */
        .rc-grid { grid-template-columns: 240px minmax(0, 1fr); }
        @media (max-width: 900px) {
          .rc-grid { grid-template-columns: 1fr !important; }
          .rc-rai-col { display: none !important; }
          .rc-rail { position: static !important; }
        }
        @media (max-width: 768px) {
          .rc-rail { display: none !important; }
          .rc-view-toggle { display: none !important; }
          .rc-desktop-view { display: none !important; }
          .rc-mobile-list { display: block !important; }
          .rt-mob-strip { display: block !important; }
          .rc-sort-cadence { display: none !important; }
          .rc-sort-renewal { display: none !important; }
          .rt-mob-cal-trigger { display: none !important; }
          .rt-mob-cal-sheet { display: none !important; }
          .rt-mob-cal-sheet-band { display: block !important; }
          .rt-today-v4 {
            grid-template-areas: "band" "composer" "tasks" !important;
          }
          /* Composer selected-client chip: avatar only on mobile, name hidden */
          .rt-composer-client-name { display: none !important; }
          /* Task right-side indicators on mobile:
             - Recurring: keep ∞ icon only, hide "Recurring" label
             - Today / Overdue date pill: keep calendar icon only, hide date text
             - Tomorrow / Later (rt-due-future): hide the whole pill — irrelevant here */
          .rt-row-text { display: none !important; }
          .rt-row-recur { padding: 3px 5px !important; }
          .rt-row-due.rt-due-today,
          .rt-row-due.rt-due-overdue { padding: 3px 5px !important; }
          .rt-row-due.rt-due-future { display: none !important; }
        }
        /* Clients table responsive — progressively hide optional columns
           as horizontal space shrinks. Order is by signal density: cadence
           pips + renews countdown first (visual but tangential), then trend
           sparkline (nice-to-have), then LCV (redundant with revenue at
           the squeezed end). Client name + score + revenue + tenure are
           always shown above 768px. */
        @media (max-width: 1200px) {
          .rt-tcol-cadence,
          .rt-tcol-renews { display: none !important; }
        }
        @media (max-width: 1024px) {
          .rt-tcol-trend { display: none !important; }
        }
        @media (max-width: 900px) {
          .rt-tcol-lcv { display: none !important; }
        }
        @media (min-width: 769px) {
          .rc-mobile-list { display: none !important; }
          /* Events dropdown is mobile-only — on desktop the button reads as plain text */
          .rt-band-sub-events-chev { display: none !important; }
          .rt-band-sub-events { cursor: default !important; pointer-events: none !important; }
        }
        @media (min-width: 1440px) {
          .rc-grid { grid-template-columns: 240px minmax(0, 1fr) 360px; }
          .rc-rai-col { display: block !important; }
        }
        @keyframes fwLaunch {
          0% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(-40vh); opacity: 1; }
        }
        @keyframes fwBurst {
          0% { transform: translate(0,0) scale(0); opacity: 1; }
          20% { opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(0.3); opacity: 0; }
        }
        @keyframes fwGlow {
          0% { transform: scale(0); opacity: 0.8; }
          50% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes fwSparkle {
          0%,100% { opacity: 0; transform: scale(0.5); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Lightning flash — fires when focus mode toggles on */}
      {/* (Lightning flash removed — too loud for the polish-layer aesthetic) */}

      {/* Fireworks */}
      {confetti && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, pointerEvents: "none", overflow: "hidden" }}>
          {/* Multiple burst origins */}
          {[
            { x: 30, y: 35, delay: 0, color: "#5B21B6" },
            { x: 70, y: 30, delay: 0.4, color: "#2D8659" },
            { x: 50, y: 25, delay: 0.8, color: "#B88B15" },
            { x: 20, y: 40, delay: 1.2, color: "#33543E" },
            { x: 80, y: 35, delay: 1.0, color: "#C4432B" },
            { x: 45, y: 45, delay: 1.5, color: "#558B68" },
          ].map((burst, bi) => (
            <div key={bi} style={{ position: "absolute", left: `${burst.x}%`, top: `${burst.y}%` }}>
              {/* Glow */}
              <div style={{
                position: "absolute", width: 120, height: 120, borderRadius: "50%",
                background: `radial-gradient(circle, ${burst.color}66 0%, transparent 70%)`,
                left: -60, top: -60,
                animation: `fwGlow 1.2s ease-out ${burst.delay + 0.1}s forwards`,
                opacity: 0,
              }} />
              {/* Particles */}
              {Array.from({ length: 24 }).map((_, pi) => {
                const angle = (pi / 24) * Math.PI * 2;
                const dist = 60 + Math.random() * 80;
                const dx = Math.cos(angle) * dist;
                const dy = Math.sin(angle) * dist;
                const size = 3 + Math.random() * 4;
                const colors = [burst.color, "#fff", burst.color + "cc", "#FFD700", "#FF6B6B", "#7C3AED", "#10B981"];
                return (
                  <div key={pi} style={{
                    position: "absolute", width: size, height: size, borderRadius: "50%",
                    background: colors[pi % colors.length],
                    boxShadow: `0 0 ${size * 2}px ${colors[pi % colors.length]}`,
                    "--dx": `${dx}px`, "--dy": `${dy}px`,
                    animation: `fwBurst ${0.8 + Math.random() * 0.6}s ease-out ${burst.delay + 0.05}s forwards`,
                    opacity: 0,
                  }} />
                );
              })}
              {/* Trail sparks */}
              {Array.from({ length: 8 }).map((_, si) => {
                const angle = (si / 8) * Math.PI * 2;
                const dist = 30 + Math.random() * 40;
                return (
                  <div key={`s${si}`} style={{
                    position: "absolute", left: Math.cos(angle) * dist, top: Math.sin(angle) * dist,
                    fontSize: 6 + Math.random() * 6, color: "#FFD700",
                    animation: `fwSparkle ${0.4 + Math.random() * 0.4}s ease-in-out ${burst.delay + 0.3 + Math.random() * 0.5}s`,
                    opacity: 0,
                  }}>✦</div>
                );
              })}
            </div>
          ))}
          {/* Rising trails */}
          {[
            { x: 30, delay: 0 },
            { x: 70, delay: 0.3 },
            { x: 50, delay: 0.6 },
            { x: 20, delay: 1.0 },
            { x: 80, delay: 0.8 },
            { x: 45, delay: 1.3 },
          ].map((trail, ti) => (
            <div key={`t${ti}`} style={{
              position: "absolute", left: `${trail.x}%`, bottom: 0,
              width: 3, height: 3, borderRadius: "50%",
              background: "#FFD700", boxShadow: "0 0 8px #FFD700, 0 0 16px #FFD70066",
              animation: `fwLaunch 0.5s ease-out ${trail.delay}s forwards`,
              opacity: 0, animationFillMode: "forwards",
            }} />
          ))}
        </div>
      )}

      {/* SIDEBAR — dark green primary-deep frame. Provides architectural
          contrast against the cream content area. Active nav items pop
          forward as warm-cream chips; everything else recedes. */}
      <div className={"r-desk" + (sidebarCollapsed ? " is-collapsed" : "")} style={{ width: sidebarCollapsed ? 64 : 240, background: C.sidebar, display: "flex", flexDirection: "column", position: "fixed", top: 14, left: 14, bottom: 14, zIndex: 50, borderRadius: 14, boxShadow: "var(--rt-sh-card)", overflowY: "auto", transition: "width 220ms var(--rt-ease-out)" }}>
        {/* Logo — "Retayned." wordmark in Outfit 900 (collapsed: "R."). The
            brand mark. The toggle chevron sits at the right edge of the
            sidebar; clicking it switches between expanded (240px) and
            collapsed (64px) modes. Persists via localStorage. */}
        <div style={{ padding: sidebarCollapsed ? "22px 0 22px" : "22px 22px 22px", flexShrink: 0, display: "flex", alignItems: "baseline", justifyContent: sidebarCollapsed ? "center" : "flex-start", position: "relative" }}>
          <span style={{
            fontFamily: "'Outfit', system-ui, sans-serif",
            fontWeight: 900,
            fontSize: 22,
            color: C.primary,
            letterSpacing: "-0.04em",
            lineHeight: 1,
          }}>{sidebarCollapsed ? "R." : "Retayned."}</span>
          <button
            onClick={() => setSidebarCollapsed(v => !v)}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            style={{
              position: "absolute",
              top: 18,
              right: sidebarCollapsed ? "50%" : 10,
              transform: sidebarCollapsed ? "translate(50%, 30px)" : "none",
              width: 22, height: 22,
              borderRadius: 6,
              background: "rgba(255,255,255,0.55)",
              border: "none",
              color: C.textSec,
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11,
              boxShadow: "var(--rt-sh-xs)",
              transition: "all 180ms var(--rt-ease-out)",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = C.card; e.currentTarget.style.color = C.text; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.55)"; e.currentTarget.style.color = C.textSec; }}
          >{sidebarCollapsed ? "›" : "‹"}</button>
        </div>

        {/* Nav items — fixed, always visible */}
        <div style={{ padding: sidebarCollapsed ? "0 8px" : "0 10px", flexShrink: 0 }}>
          {(tier === "enterprise" ? navItemsEnterprise : navItemsCore).map(n => {
            const active = page === n.id;
            return (
              <div key={n.id} className={"nav-item" + (active ? " is-active" : "")} onClick={() => goTo(n.id)} title={sidebarCollapsed ? n.label : undefined} style={{
                display: "flex", alignItems: "center", gap: sidebarCollapsed ? 0 : 11,
                justifyContent: sidebarCollapsed ? "center" : "flex-start",
                padding: sidebarCollapsed ? "10px 0" : "9px 12px",
                borderRadius: 9,
                marginBottom: 2,
                color: active ? C.primaryDeep : C.textSec,
                fontWeight: active ? 600 : 500,
                background: active ? C.card : "transparent",
                boxShadow: active ? "var(--rt-sh-card-lift)" : "none",
                transform: active ? "translateY(-0.5px)" : "none",
                cursor: "pointer",
                position: "relative",
                transition: "all 180ms var(--rt-ease-out)",
              }}>
                <span style={{ width: 20, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={n.icon} size={20} color={active ? C.primaryDeep : C.textSec} accent={active ? C.primary : C.ink500} /></span>
                {!sidebarCollapsed && <span style={{ fontSize: 14, flex: 1 }}>{n.label}</span>}
                {hasDot(n.id) && <div style={{ position: sidebarCollapsed ? "absolute" : "static", top: sidebarCollapsed ? 6 : "auto", right: sidebarCollapsed ? 6 : "auto", width: 7, height: 7, borderRadius: "50%", background: C.danger, boxShadow: "0 0 0 2.5px " + (active ? C.card : C.sidebar), flexShrink: 0 }} />}
              </div>
            );
          })}
        </div>

        {/* Coach-only: New Chat button + scrollable past-chats list. Takes all
            remaining vertical space so the list scrolls internally without
            affecting nav items or the Portfolio widget at the bottom. */}
        {page === "coach" && !sidebarCollapsed ? (
          <div style={{ padding: "12px 10px 0", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <button className="r-btn rt-rai-pop-btn" data-tone="purple" onClick={startNewRaiChat} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--rt-grad-btn)", color: "#fff", fontSize: 13, fontWeight: 600, textAlign: "center", cursor: "pointer", border: "none", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--rt-sh-rai-pop)", flexShrink: 0, transition: "background 220ms var(--rt-ease-out), box-shadow 220ms var(--rt-ease-out), transform 200ms var(--rt-ease-out)" }}>
              New Chat
            </button>
            {raiConvoList.length > 0 && (() => {
              const starred = raiConvoList.filter(c => c.is_starred);
              const recent = raiConvoList.filter(c => !c.is_starred);
              const section = (label, items) => (
                <>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: C.textSec, letterSpacing: "0.18em", textTransform: "uppercase", padding: "14px 10px 6px" }}>{label}</div>
                  {items.map(c => {
                    const isActive = c.id === aiConvoId;
                    const title = c.title || c.client?.name || "Untitled chat";
                    return (
                      <div
                        key={c.id}
                        className="r-convo-row"
                        onClick={() => openRaiChat(c.id)}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "8px 10px 8px 12px",
                          borderRadius: 7, cursor: "pointer",
                          background: isActive ? "rgba(91,33,182,0.10)" : "transparent",
                          color: isActive ? C.btn : C.textSec,
                          fontSize: 12.5,
                          fontWeight: isActive ? 600 : 500,
                          position: "relative",
                          transition: "background 160ms var(--rt-ease-out), color 160ms var(--rt-ease-out)",
                          boxShadow: isActive ? "inset 2px 0 0 0 " + C.btn : "none",
                        }}
                      >
                        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
                        <button
                          className="r-convo-action r-convo-star"
                          onClick={e => { e.stopPropagation(); toggleRaiChatStar(c.id, c.is_starred); }}
                          style={{ background: "none", border: "none", padding: 3, cursor: "pointer", color: c.is_starred ? "#E6B800" : C.textMuted, display: "flex", opacity: c.is_starred ? 1 : 0, transition: "opacity 0.12s" }}
                          title={c.is_starred ? "Unstar" : "Star"}
                        >
                          <Icon name={c.is_starred ? "starFill" : "star"} size={12} />
                        </button>
                        <button
                          className="r-convo-action r-convo-del"
                          onClick={e => { e.stopPropagation(); deleteRaiChat(c.id); }}
                          style={{ background: "none", border: "none", padding: 3, cursor: "pointer", color: C.textMuted, display: "flex", opacity: 0, transition: "opacity 0.12s" }}
                          title="Delete"
                        >
                          <Icon name="trash" size={12} />
                        </button>
                      </div>
                    );
                  })}
                </>
              );
              return (
                <div style={{ marginTop: 4, paddingBottom: 10, flex: 1, minHeight: 0, overflowY: "auto" }}>
                  {starred.length > 0 && section("Starred", starred)}
                  {recent.length > 0 && section("Recent", recent)}
                </div>
              );
            })()}
          </div>
        ) : (
          /* Non-coach pages: empty spacer pushes Portfolio widget to bottom */
          <div style={{ flex: 1, minHeight: 0 }} />
        )}
        {/* Combined sidebar widget — tasks completed (top) + portfolio (bottom),
            single surface, hairline divider. Tasks section uses a Week/Month/Year
            toggle whose period state lives at app level so it persists across
            sidebar re-renders. Portfolio bar/counts unchanged. */}
        {(() => {
          if (sidebarCollapsed) return null;
          const total = clients.length;
          if (total === 0) return null;
          const buckets = clients.reduce((acc, c) => {
            const r = c.ret || 0;
            if (r >= 80) acc.thriving++;
            else if (r >= 65) acc.healthy++;
            else if (r >= 45) acc.watch++;
            else if (r >= 25) acc.atRisk++;
            else acc.critical++;
            return acc;
          }, { thriving: 0, healthy: 0, watch: 0, atRisk: 0, critical: 0 });
          const segs = [
            { n: buckets.thriving, label: "Thriving", color: C.retElite },
            { n: buckets.healthy,  label: "Healthy",  color: C.retGood  },
            { n: buckets.watch,    label: "Watch",    color: C.retOk    },
            { n: buckets.atRisk,   label: "At risk",  color: C.retWarn  },
            { n: buckets.critical, label: "Critical", color: C.retCrit  },
          ].filter(s => s.n > 0);
          const periodCount = taskCompletedCounts[taskCompletedPeriod] || 0;

          // Compute the callout — positive only, period-aware, prioritized.
          //
          // Priority order (only first matching rule fires):
          //   1. Year milestones (round numbers like 100, 250, 500, 1000…)
          //   2. Records ("fastest in N weeks/months") — N must be ≥ 6
          //   3. Comparisons ("+N vs last") — week ≥ 3, month ≥ 10
          //   4. Streaks (≥ 3 days)
          //   5. Recovery (last week was 0, this week is non-zero)
          //
          // Each branch returns { line1, line2 } or null. If null, no callout
          // shows. The circle around the number is gated on the same condition.
          // Sidebar callout: "plus N / tasks today" — two-line handwritten
          // note pointing at the big completion number. Counts tasks the
          // user completed today (checked off in the task list). Always
          // renders — at 0 it shows "plus 0 / tasks today" so the slot
          // is a stable always-present line. The ↙ arrow on line two
          // points down-left toward the big number below.
          const computeCallout = () => {
            const today = taskCompletedCounts.today || 0;
            return { line1: "plus " + today, line2: "↙ tasks today" };
          };

          const callout = computeCallout();

          return (
            <div style={{ padding: "14px 16px", margin: "0 10px 8px", background: C.deepCream, borderRadius: 10, position: "relative", boxShadow: "var(--rt-sh-xs)" }}>
              {/* Handwritten callout — always rendered. Hovers over the
                  big completion number in the top-right corner of the
                  Done section. ↙ on line two points down at the number. */}
              <div
                style={{
                  position: "absolute",
                  top: -16,
                  right: -2,
                  fontFamily: "'Caveat', 'Bradley Hand', 'Marker Felt', cursive",
                  fontSize: 18,
                  color: C.primaryDeep,
                  transform: "rotate(-6deg)",
                  pointerEvents: "none",
                  lineHeight: 1.05,
                  fontWeight: 600,
                }}
              >
                {callout.line1}
                <span style={{ display: "block", fontSize: 13, opacity: 0.75, marginLeft: 8, fontWeight: 500 }}>
                  {callout.line2}
                </span>
              </div>

              {/* TASKS COMPLETED section */}
              <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "0.5px solid " + C.border }}>
                <div style={{ fontSize: 10, color: C.textSec, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 10 }}>Done</div>
                <div style={{ display: "flex", justifyContent: "flex-start", gap: 14, marginBottom: 12 }}>
                  {[{ id: "week", label: "Week" }, { id: "month", label: "Month" }, { id: "year", label: "Year" }].map(p => {
                    const active = taskCompletedPeriod === p.id;
                    return (
                      <div
                        key={p.id}
                        className={active ? undefined : "r-period-opt"}
                        onClick={() => setTaskCompletedPeriod(p.id)}
                        style={{
                          padding: "5px 0",
                          fontSize: 10.5,
                          fontWeight: 500,
                          cursor: "pointer",
                          ...(active
                            ? { color: C.primaryDeep, borderBottom: "1px solid " + C.primary }
                            : { color: C.textSec }),
                        }}
                      >
                        {p.label}
                      </div>
                    );
                  })}
                </div>
                <div style={{ position: "relative", display: "inline-block", padding: "4px 10px 8px" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: C.text, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{periodCount.toLocaleString()}</div>
                  {/* Hand-drawn circle around the number — permanent, every period.
                      Reads as "your work, marked." Not tied to the callout — the
                      callout sits on top and is the conditional celebratory layer.
                      preserveAspectRatio=none stretches the SVG to fill the parent
                      box, which is sized by the number text itself — so a 1-digit
                      "7" gets a tight circle and a 4-digit "1,983" gets a wider
                      circle, both proportionally enclosing the number. */}
                  <svg style={{ position: "absolute", inset: 0, pointerEvents: "none" }} viewBox="0 0 70 38" preserveAspectRatio="none">
                    <path d="M 52 4 C 38 2, 18 4, 8 12 C 2 19, 4 30, 18 33 C 32 36, 54 35, 62 28 C 68 21, 64 10, 50 6 C 44 4, 36 4, 30 5"
                          stroke={C.danger} strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.9" />
                  </svg>
                </div>
                <div style={{ color: C.textSec, fontSize: 9.5 }}>Tasks Completed</div>
              </div>
              {/* PORTFOLIO section */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: C.textSec, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase" }}>Portfolio · {total}</div>
                <div style={{ fontSize: 9.5, color: C.textSec, fontStyle: "italic", fontFamily: "'Fraunces', Georgia, serif", fontVariationSettings: '"opsz" 96, "SOFT" 50, "WONK" 0', fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>${(totalRev / 1000).toFixed(1)}k MRR</div>
              </div>
              {/* Stacked bar — only non-zero buckets */}
              <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", gap: 2, marginBottom: 8 }}>
                {segs.map((s, i) => (
                  <div key={i} style={{ flex: s.n, background: s.color, borderRadius: i === 0 ? "4px 0 0 4px" : i === segs.length - 1 ? "0 4px 4px 0" : 0 }} />
                ))}
              </div>
              {/* Inline segment labels — count over label, stacked so 5 buckets fit without truncation. */}
              <div style={{ display: "flex", gap: 6 }}>
                {segs.map((s, i) => (
                  <div key={i} style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <div style={{ color: s.color, fontWeight: 700, fontSize: 13, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>{s.n}</div>
                    <div style={{ color: C.textSec, fontSize: 9.5, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
        <div style={{ padding: sidebarCollapsed ? "4px 8px 8px" : "4px 6px 8px" }}>
          {(() => {
            const active = page === "settings";
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div className={"nav-item" + (active ? " is-active" : "")} onClick={() => goTo("settings")} title={sidebarCollapsed ? "Settings" : undefined} style={{
                  flex: 1,
                  display: "flex", alignItems: "center",
                  gap: sidebarCollapsed ? 0 : 11,
                  justifyContent: sidebarCollapsed ? "center" : "flex-start",
                  padding: sidebarCollapsed ? "10px 0" : "9px 12px",
                  borderRadius: 9,
                  color: active ? C.primaryDeep : C.textSec,
                  background: active ? C.card : "transparent",
                  boxShadow: active ? "var(--rt-sh-card-lift)" : "none",
                  transform: active ? "translateY(-0.5px)" : "none",
                  fontWeight: active ? 600 : 500,
                  cursor: "pointer",
                  transition: "all 180ms var(--rt-ease-out)",
                }}>
                  <span style={{ width: 20, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="settings" size={18} color={active ? C.primaryDeep : C.textSec} accent={active ? C.primary : C.ink500} /></span>
                  {!sidebarCollapsed && <span style={{ fontSize: 14, flex: 1 }}>Settings</span>}
                </div>
              </div>
            );
          })()}
        </div>
        <div style={{ padding: sidebarCollapsed ? "10px 0 14px" : "10px 6px 14px" }}>
          <div className="rt-user-chip" style={{ display: "flex", alignItems: "center", gap: sidebarCollapsed ? 0 : 10, justifyContent: sidebarCollapsed ? "center" : "flex-start", padding: sidebarCollapsed ? "8px 0" : "8px 10px", borderRadius: 8, cursor: "pointer", background: "transparent", transition: "background 160ms var(--rt-ease-out), box-shadow 200ms var(--rt-ease-out), transform 200ms var(--rt-ease-out)" }}>
            <div style={{ width: 30, height: 30, borderRadius: 15, background: "linear-gradient(135deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0) 55%, rgba(0,0,0,0.18) 100%), " + C.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", boxShadow: "var(--rt-sh-xs)", flexShrink: 0 }}>{getUserInitial(user)}</div>
            {!sidebarCollapsed && (
              <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600, color: C.text, textTransform: "capitalize", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User"}</div><div style={{ fontSize: 11, color: C.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.user_metadata?.company || ""}</div></div>
            )}
          </div>
        </div>
      </div>

      {/* MOBILE TOP */}
      {/* Mobile top bar deliberately removed (May 2026).
          Page identity is established by each page's own h1/eyebrow;
          account-level actions (profile, sign out, theme, integrations)
          live in Settings, reachable via the mobile bottom nav.
          Removing the bar reclaims ~52px of vertical real estate. */}

      <div className="r-main">

        {/* ═══ TODAY — TASK MANAGER ═══ */}
        {page === "today" && (() => {
          // ─── LOCAL ALIASES ───────────────────────────────────────────────
          const focusId = todayFocusId, setFocusId = setTodayFocusId;
          const dismissedIds = todayDismissed, setDismissedIds = setTodayDismissed;
          const composerDue = todayComposerDue, setComposerDue = setTodayComposerDue;
          const composerClient = todayComposerClient, setComposerClient = setTodayComposerClient;
          const composerMenuOpen = todayComposerMenu, setComposerMenuOpen = setTodayComposerMenu;
          const composerQuery = todayComposerQuery, setComposerQuery = setTodayComposerQuery;
          const completedOpen = todayCompletedOpen, setCompletedOpen = setTodayCompletedOpen;

          // ─── DATA PREP ───────────────────────────────────────────────────
          // Visible tasks = non-dismissed (locally). Dismissed = user used the
          // dismiss affordance during this session.
          const visibleTasks = tasks.filter(t => !dismissedIds[t.id]);

          // ─── RAI'S ACTIVE PICKED TASK ────────────────────────────────────
          // Resolve which task carries the "Rai's pick" badge today.
          //
          // Source of truth: rai_user_state.todays_badged_task_id. Once set
          // for the day, this NEVER changes — through completion, dismissal,
          // or moves. The badge is permanent for the day on whatever task
          // it landed on. The only way it clears is if the user outright
          // deletes the task row (FK ON DELETE SET NULL handles that).
          //
          // Tomorrow / Later tasks are never badged. The settle effect that
          // writes the badge gates on due_date == today.
          const activeBadgeTaskId = (rankMode === "rai" && raiState?.todays_badged_task_id) || null;
          // raiPicks is a single pick row (or null). Match it against the
          // badged task's client; return the pick if they match, else null.
          // Original code used .find() as if raiPicks were an array; it
          // never has been since the sweep writes one row and getCurrent
          // returns it via maybeSingle.
          const activeBadgePick = (() => {
            if (!activeBadgeTaskId) return null;
            if (!raiPicks || !raiPicks.client_id) return null;
            const t = tasks.find(x => x.id === activeBadgeTaskId);
            if (!t) return null;
            const c = clients.find(x => x.name === t.client);
            if (!c) return null;
            return raiPicks.client_id === c.id ? raiPicks : null;
          })();

          // Sort comparator for Rai mode. Layered final score:
          //   priority_score (deterministic, with soft clamp inside)
          //   + new_client_boost
          //   + client.raiNudge   (-10..+10) — applies to ALL tasks of that client
          //   + pick_boost        (+10..+20) — applies to ALL tasks of the
          //     Client of the Day, layered on top of the nudge
          //   → clamped to 99
          //
          // Tiebreakers, in order:
          //   1. final score desc
          //   2. nudge magnitude desc — Rai breaks ties
          //   3. alert (true wins)
          //   4. recurring (true wins)
          //   5. created_at desc (newer wins)
          const nudgeForClient = (clientName) => {
            if (!clientName) return 0;
            const c = clients.find(x => x.name === clientName);
            return c ? (c.raiNudge || 0) : 0;
          };
          // Pick boost: applies to every task of the Client of the Day, by
          // client name. Returns 0 if there's no pick today, the picked
          // client isn't in the roster, or the user already dismissed the
          // pick (we still keep the boost active even after dismissal so
          // their tasks stay surfaced — dismissal only hides the card, not
          // the underlying signal).
          const pickBoostForClient = (clientName) => {
            if (!clientName) return 0;
            if (!raiPicks || !raiPicks.client_id) return 0;
            const pickClient = clients.find(c => c.id === raiPicks.client_id);
            if (!pickClient) return 0;
            if (clientName !== pickClient.name) return 0;
            return Number(raiPicks.pick_boost) || 0;
          };

          // ─── Cross-client tiebreaker precompute ──────────────────────
          // When two tasks score identically AND belong to DIFFERENT clients,
          // we break the tie using signals that aren't in the score itself.
          // These are computed once here (O(clients) + O(touchpoints)) and
          // referenced by raiCompare as O(1) map lookups, instead of being
          // recomputed for every pairwise comparison during sort.
          const lastTouchedByClient = new Map();
          for (const tp of (allTouchpoints || [])) {
            const key = tp.client_id || tp.client_name;
            if (!key || !tp.occurred_at) continue;
            const t = new Date(tp.occurred_at).getTime();
            const cur = lastTouchedByClient.get(key);
            if (!cur || t > cur) lastTouchedByClient.set(key, t);
          }
          const lookupLastTouched = (clientName) => {
            if (!clientName) return 0; // never touched → most stale
            const c = clients.find(cc => cc.name === clientName);
            if (!c) return 0;
            return lastTouchedByClient.get(c.id) || lastTouchedByClient.get(c.name) || 0;
          };

          const raiCompare = (a, b) => {
            // 30-second priority hold: tasks created in the last 30 seconds
            // float to the top regardless of priority score, so when the user
            // adds a task they can act on it immediately without scrolling. Once
            // the hold expires, the task settles into its real priority position
            // on the next render. The hold only applies in Rai mode (Manual mode
            // already pins new tasks to the top via manualTaskOrder).
            const now = Date.now();
            const HOLD_MS = 30000;
            const aHeld = a.created_at && (now - a.created_at) < HOLD_MS;
            const bHeld = b.created_at && (now - b.created_at) < HOLD_MS;
            if (aHeld !== bHeld) return aHeld ? -1 : 1;
            if (aHeld && bHeld) return (b.created_at || 0) - (a.created_at || 0);
            // Days late: integer count of days the task is overdue. Computed
            // from the difference between today's local date and the task's
            // due_date (date part only — time-of-day ignored to avoid timezone
            // edge cases). Recurring tasks have no due_date and are not late.
            // Day boundary at midnight local (matches task rollover at 00:00).
            const _now = new Date();
            const _todayStr = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}-${String(_now.getDate()).padStart(2, "0")}`;
            const computeDaysLate = (t) => {
              if (!t.due_date || t.recurring) return 0;
              const dueStr = String(t.due_date).slice(0, 10);
              if (dueStr >= _todayStr) return 0;
              const due = new Date(dueStr + "T00:00:00");
              const today = new Date(_todayStr + "T00:00:00");
              return Math.max(0, Math.floor((today - due) / 86400000));
            };
            const aDaysLate = computeDaysLate(a);
            const bDaysLate = computeDaysLate(b);
            const psA = getProfileSortScore(a.client, a.raiPriority, pickBoostForClient(a.client), aDaysLate);
            const psB = getProfileSortScore(b.client, b.raiPriority, pickBoostForClient(b.client), bDaysLate);
            if (psA !== psB) return psB - psA;
            // ─── CROSS-CLIENT TIEBREAKERS ───────────────────────────────
            // When two tasks belong to DIFFERENT clients but scored
            // identically, we break the tie using signals NOT in the
            // profile_sort_score. Cascade order: last_touched_at older,
            // then renewal sooner, then higher LTV, then longer tenure,
            // then higher revenue, then lower retention (the only direction
            // that "surfaces fragility" — and the rarest possible tie since
            // by step 6 the clients are nearly indistinguishable on every
            // other axis). All six are skipped when a.client === b.client
            // (their values would be identical for both tasks).
            if (a.client && b.client && a.client !== b.client) {
              const cA = clients.find(c => c.name === a.client);
              const cB = clients.find(c => c.name === b.client);
              if (cA && cB) {
                // 1. last_touched_at — older (smaller timestamp) wins.
                //    Longer-neglected client surfaces first.
                const ltA = lookupLastTouched(a.client);
                const ltB = lookupLastTouched(b.client);
                if (ltA !== ltB) return ltA - ltB;
                // 2. renewal_date — sooner (smaller timestamp) wins.
                //    Closer to contract end = more time-sensitive.
                const rdA = cA.renewal_date ? new Date(cA.renewal_date).getTime() : Infinity;
                const rdB = cB.renewal_date ? new Date(cB.renewal_date).getTime() : Infinity;
                if (rdA !== rdB) return rdA - rdB;
                // 3. LTV — higher wins.
                const ltvA = getAdjustedLTV(cA);
                const ltvB = getAdjustedLTV(cB);
                if (ltvA !== ltvB) return ltvB - ltvA;
                // 4. tenure (months) — longer wins.
                const tenA = cA.months || 0;
                const tenB = cB.months || 0;
                if (tenA !== tenB) return tenB - tenA;
                // 5. revenue — higher wins.
                const revA = cA.revenue || 0;
                const revB = cB.revenue || 0;
                if (revA !== revB) return revB - revA;
                // 6. retention_score — LOWER wins (surface the fragile one).
                //    Only fires when literally every other factor is identical.
                const retA = cA.ret != null ? cA.ret : 50;
                const retB = cB.ret != null ? cB.ret : 50;
                if (retA !== retB) return retA - retB;
              }
            }
            // ─── WITHIN-CLIENT TIEBREAKERS ──────────────────────────────
            // Note: the nudge-magnitude tiebreaker was removed (May 2026).
            // The nudge is already inside getProfileSortScore via raiNudge,
            // so using |nudge| again here double-counted Rai's signal and
            // treated -10 ("demote") the same as +10 ("surface").
            if (a.alert !== b.alert) return a.alert ? -1 : 1;
            // Non-recurring wins over recurring. Within a single client's
            // group, this surfaces "the deliverable I committed to today"
            // above "the daily check-in routine." Recurring tasks come
            // back tomorrow anyway; one-offs need to actually get done.
            if (a.recurring !== b.recurring) return a.recurring ? 1 : -1;
            return (b.created_at || 0) - (a.created_at || 0);
          };

          // Sort comparator for Manual mode: new tasks (not in saved order) go to TOP, newest first.
          // Tasks in manualTaskOrder follow, in saved order.
          const manualCompare = (a, b) => {
            const ia = manualTaskOrder.indexOf(a.id);
            const ib = manualTaskOrder.indexOf(b.id);
            if (ia !== -1 && ib !== -1) return ia - ib;     // both in saved order → respect order
            if (ia === -1 && ib === -1) return (b.created_at || 0) - (a.created_at || 0);  // both new → newest first
            return ia === -1 ? -1 : 1;                      // new task wins, goes above saved-order task
          };

          const activeCompare = rankMode === "manual" ? manualCompare : raiCompare;

          // Client clustering pass: fix immediate A,B,A interleaving by swapping
          // so it becomes A,A,B. Single forward pass. Only applies in Rai mode
          // (Manual mode = explicit user order, never reorder).
          //
          // Rule (per RANKER-SPEC-v3, Rule 4):
          //   if tasks[i].client === tasks[i+2].client AND
          //      tasks[i].client !== tasks[i+1].client:
          //     swap tasks[i+1] and tasks[i+2]
          //
          // Does NOT cluster across larger gaps. A low-priority task at rank 12
          // does NOT jump to rank 2 just because rank 1 shares its client.
          const clusterAdjacent = (arr) => {
            if (rankMode === "manual" || !arr || arr.length < 3) return arr;
            const out = [...arr];
            for (let i = 0; i < out.length - 2; i++) {
              const cA = out[i].client;
              const cB = out[i + 1].client;
              const cC = out[i + 2].client;
              if (cA && cA === cC && cA !== cB) {
                // swap i+1 and i+2 to make A,A,B
                const tmp = out[i + 1];
                out[i + 1] = out[i + 2];
                out[i + 2] = tmp;
              }
            }
            return out;
          };

          const openTasks = clusterAdjacent(visibleTasks.filter(t => !t.done).sort(activeCompare));
          const completedTasks = visibleTasks.filter(t => t.done);
          // Render order: same active comparator applied to ALL tasks (done included).
          // Tasks stay in place when toggled — done state is visual only, no reordering.
          const renderTasks = clusterAdjacent([...visibleTasks].sort(activeCompare));
          // ── DEBUG: log Matte Collection + Motley Fool sort breakdown ──
          if (typeof window !== "undefined" && !window.__rt_sort_logged) {
            window.__rt_sort_logged = true;
            const targets = ["Matte Collection", "The Motley Fool", "Motley Fool"];
            renderTasks
              .filter(t => targets.includes(t.client))
              .forEach((t, i) => {
                const c = clients.find(x => x.name === t.client);
                const psBase = c ? calcProfileScore(c.ret || 50, c, clients) : 0;
                const totalRev = clients.reduce((a, x) => a + (x.revenue || 0), 0);
                const revPct = c && totalRev > 0 ? (c.revenue || 0) / totalRev : 0;
                const newBoost = c ? calcNewClientBoost(c.ret || 50, revPct, c.daysOld != null ? c.daysOld : 999) : 0;
                const raiBoost = t.raiPriority ? getRaiBoost(psBase) : 0;
                const total = getProfileSortScore(t.client, t.raiPriority);
                console.log(
                  `🔍 SORT [${t.client}] ret=${c?.ret} ps=${psBase} newBoost=${newBoost} raiPri=${!!t.raiPriority} raiBoost=${raiBoost} FINAL=${total} alert=${!!t.alert} recurring=${!!t.recurring} created=${t.created_at}`
                );
              });
          }
          const focusTask = openTasks.find(t => t.id === focusId) || openTasks[0] || null;
          const focusClient = focusTask ? clients.find(c => c.name === focusTask.client) : null;

          // STUB DATA for things we don't track yet
          const stubDelta = (clientName) => {
            if (!clientName) return 0;
            const h = clientName.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
            return (h % 11) - 5; // -5 to +5
          };
          // Relative time formatter — "Today" / "Yesterday" / "Nd ago" / "Nw ago" / "Nmo ago"
          const relTime = (dateStr) => {
            if (!dateStr) return "—";
            const d = new Date(dateStr);
            const diff = Date.now() - d.getTime();
            const days = Math.floor(diff / 86400000);
            if (days === 0) return "Today";
            if (days === 1) return "Yesterday";
            if (days < 7) return `${days}d ago`;
            if (days < 30) return `${Math.floor(days / 7)}w ago`;
            if (days < 365) return `${Math.floor(days / 30)}mo ago`;
            return `${Math.floor(days / 365)}y ago`;
          };
          // Real cadence calculation from touchpoint history
          const calcCadence = (clientName) => {
            // Cadence = days between contact events. Compare days-since-last
            // against average interval from the last 10 touchpoints. Verdict:
            //   <2 pts  →  "Building rhythm"   (not enough history yet)
            //   ≤1.15× →  "On rhythm"
            //   ≤1.5×  →  "Slipping"
            //   >1.5×  →  "Overdue"
            const points = allTouchpoints
              .filter(t => t.client_name === clientName)
              .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at));
            if (points.length < 2) return "Building rhythm";
            const recent = points.slice(0, 10);
            const intervals = [];
            for (let i = 0; i < recent.length - 1; i++) {
              intervals.push((new Date(recent[i].occurred_at) - new Date(recent[i+1].occurred_at)) / 86400000);
            }
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const daysSinceLast = (Date.now() - new Date(points[0].occurred_at).getTime()) / 86400000;
            if (daysSinceLast > avgInterval * 1.5)  return "Overdue";
            if (daysSinceLast > avgInterval * 1.15) return "Slipping";
            return "On rhythm";
          };

          // ─── HANDLERS ────────────────────────────────────────────────────
          const greeting = (() => {
            const h = new Date().getHours();
            if (h >= 5 && h < 12) return "Morning";
            if (h >= 12 && h < 17) return "Afternoon";
            return "Evening";
          })();

          const firstName = user?.user_metadata?.full_name?.split(" ")[0]
            || (user?.email ? user.email.split("@")[0].replace(/^\w/, c => c.toUpperCase()) : "")
            || "";
          const displayDate = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
          const shortDisplayDate = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

          // Score chip component
          const ScoreChip = ({ score, delta = null, size = "sm" }) => {
            if (score == null) return null;
            const color = retColor(score);
            // 5 soft background tints aligned with the 5-stop retention ramp
            const bg = score >= 80 ? "#E6EFE9"    // Elite — deepest green tint
                     : score >= 65 ? "#E8F3ED"   // Good — medium green tint
                     : score >= 45 ? "#F3F0D8"   // Ok   — mustard tint
                     : score >= 30 ? "#FDF4DC"   // Warn — amber tint
                     :              "#FBE6DE";   // Crit — red tint
            const sizes = size === "sm" ? { fs: 11, pad: "2px 8px" } : { fs: 13, pad: "4px 11px" };
            return (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                background: bg, color,
                fontSize: sizes.fs, fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                padding: sizes.pad,
                borderRadius: 999,
                boxShadow: "var(--rt-sh-xs)",
              }}>
                <span>{score}</span>
                {delta !== null && delta !== 0 && (
                  <span style={{ fontWeight: 600, fontSize: sizes.fs - 1, opacity: 0.85 }}>
                    {delta > 0 ? "+" : ""}{delta}
                  </span>
                )}
              </span>
            );
          };

          // Client avatar (letters, color)
          const ClientAvatar = ({ client, size = 32 }) => {
            if (!client) return null;
            const initials = client.name.split(/\s|&/).filter(Boolean).slice(0, 2).map(s => s[0]).join("").toUpperCase();
            const color = retColor(client.ret || 60);
            // Polish: keep the score-driven base color (carries information —
            // red=at-risk, green=healthy) and overlay a soft top-light /
            // bottom-shade gradient sheen for depth. Plus a 1px shadow so the
            // avatar reads as a small physical chip rather than a flat circle.
            return (
              <div style={{
                width: size, height: size, borderRadius: "50%",
                background: `linear-gradient(135deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0) 55%, rgba(0,0,0,0.12) 100%), ${color}`,
                color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: size * 0.35, fontWeight: 700,
                flexShrink: 0, letterSpacing: 0.2,
                boxShadow: "var(--rt-sh-xs)",
              }}>
                {initials}
              </div>
            );
          };

          // ─── DATE BOUNDARIES (hoisted so status band can count today-only tasks) ──
          // Day boundary at midnight local. Tasks bucket and "today" labels
          // flip at 00:00 to match the calendar's real-time view.
          const _now = new Date();
          const _todayStr = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}-${String(_now.getDate()).padStart(2, "0")}`;
          const _tomorrow = new Date(_now);
          _tomorrow.setDate(_tomorrow.getDate() + 1);
          const _tomorrowStr = `${_tomorrow.getFullYear()}-${String(_tomorrow.getMonth() + 1).padStart(2, "0")}-${String(_tomorrow.getDate()).padStart(2, "0")}`;

          const bucketOf = (t) => {
            // Recurring tasks are standing work with a "next occurrence"
            // date — bucketed exactly like a one-off task is bucketed by
            // its due_date. The recurrence_pattern is NOT a show/hide
            // switch; it just tells us when the task next comes due.
            //
            //   - recurring + done       → "today" (sits in today's
            //     completed section like any finished task; the 2am reset
            //     brings it back fresh on its next matching day)
            //   - recurring + not done   → find the next occurrence date,
            //     bucket by today / tomorrow / later. So "every Thursday"
            //     created on a Wednesday lands in TOMORROW, not hidden.
            //     "every Monday" created Wednesday lands in LATER.
            //     "daily" always lands in TODAY.
            if (t.recurring) {
              if (t.done) return "today";
              const next = nextOccurrenceDate(t.recurrence_pattern, _now, true);
              const nextStr = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
              if (nextStr <= _todayStr) return "today";
              // Daily recurring tasks always re-appear tomorrow in Today —
              // surfacing them in Tomorrow is duplicative noise. Hide them
              // from the future view; they're implicit.
              const isDaily = !t.recurrence_pattern || !t.recurrence_pattern.kind || t.recurrence_pattern.kind === "daily";
              if (nextStr === _tomorrowStr) return isDaily ? "hidden" : "tomorrow";
              // Non-daily recurring more than 1 day out: hide entirely.
              // Otherwise weekly/monthly tasks would clog Later every day
              // of the week. They reappear in Tomorrow the day before
              // they're due, and in Today on the day itself.
              return "hidden";
            }
            if (!t.due_date) return "today";
            const dateStr = String(t.due_date).slice(0, 10);
            if (dateStr <= _todayStr) return "today";
            if (dateStr === _tomorrowStr) return "tomorrow";
            return "later";
          };

          // ─── STATUS BAND ─────────────────────────────────────────────────
          const totalVisible = visibleTasks.length;
          // Today bucket = visibleTasks (open + done) that bucket as "today".
          const todayBucketTasks = visibleTasks.filter(t => bucketOf(t) === "today");
          const todayCount = todayBucketTasks.length;                       // total today (open + done) — for "X tasks" subhead
          const todayDoneCount = todayBucketTasks.filter(t => t.done).length;
          const doneCount = completedTasks.length;
          const remaining = totalVisible - doneCount;
          // Percent complete is today-only — Tomorrow/Later don't count toward today's %.
          const pct = todayCount ? todayDoneCount / todayCount : 0;

          // ─── DUE-DATE BUCKETING (helpers — _now/_todayStr/etc hoisted above) ──

          // bucketOf returns 'today' | 'tomorrow' | 'later'
          // Rules:
          //   - Recurring                         → today  (always)
          //   - No due_date                       → today  (active work, no specific date)
          //   - due_date <= today (incl. overdue) → today
          //   - due_date == tomorrow              → tomorrow
          //   - due_date >  tomorrow              → later
          // (bucketOf defined above near hoisted date boundaries)

          // Push button helpers — change due_date and update local state.
          // Also notify worker by email if the task is assigned to one.
          const setTaskDueDate = async (taskId, newDateStr) => {
            // Find current task to detect if it has a worker assignment
            const currentTask = tasks.find(t => t.id === taskId);
            const oldDateStr = currentTask?.due_date || null;
            const wasAssigned = !!currentTask?.assigned_worker_id;
            const dateChanged = String(oldDateStr || "").slice(0,10) !== String(newDateStr || "").slice(0,10);

            // If this task is currently the active Rai badge AND it's being
            // pushed off today (tomorrow / later), clear the badge. The badge
            // is for ONE day — when the user defers a badged task, they're
            // deciding "not today," and the crown should not follow it forward.
            // Also clears the task's is_rai_priority flag so it doesn't return
            // tomorrow still labeled as a priority.
            const isBadged = raiState?.todays_badged_task_id === taskId;
            const newDateIsTodayOrEarlier = newDateStr ? String(newDateStr).slice(0, 10) <= _todayStr : true;
            if (isBadged && !newDateIsTodayOrEarlier) {
              try {
                await raiUserStateDb.setBadgeTask(user.id, null);
                setRaiState(prev => prev ? { ...prev, todays_badged_task_id: null, todays_badge_set_at: null } : prev);
              } catch (e) { console.warn("Failed to clear badge:", e); }
              try {
                await supabase.from("tasks").update({ is_rai_priority: false }).eq("id", taskId);
              } catch (e) { console.warn("Failed to clear is_rai_priority:", e); }
              setTasks(prev => prev.map(t => t.id === taskId ? { ...t, raiPriority: false } : t));
            }

            // Update local first for snappy UI; DB write is async
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, due_date: newDateStr } : t));
            try { await tasksDb.setDueDate(taskId, newDateStr); } catch (e) { console.warn("setDueDate failed:", e); }

            // Re-notify worker if assigned + date actually changed.
            // Edge Function applies a 12-hour cooldown per task to prevent spam.
            if (wasAssigned && dateChanged) {
              try {
                const { data: { session } } = await supabase.auth.getSession();
                fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/worker-task-notify`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                  },
                  body: JSON.stringify({ task_id: taskId, kind: "date_change" }),
                }).catch(e => console.warn("Worker date-change notify failed:", e));
              } catch (e) { console.warn("Worker date-change notify error:", e); }
            }
          };
          const pushToTomorrow = (taskId) => setTaskDueDate(taskId, _tomorrowStr);
          const pushToLater = (taskId) => {
            // Default: 7 days from today
            const later = new Date(_now);
            later.setDate(later.getDate() + 7);
            const dateStr = `${later.getFullYear()}-${String(later.getMonth() + 1).padStart(2, "0")}-${String(later.getDate()).padStart(2, "0")}`;
            setTaskDueDate(taskId, dateStr);
          };
          const pullToToday = (taskId) => setTaskDueDate(taskId, _todayStr);

          // Format a YYYY-MM-DD due date for display in the chip / row.
          // "Today" / "Tomorrow" for the immediate window; otherwise short date.
          const formatDueLabel = (dateStr, todayStr, tomorrowStr) => {
            if (!dateStr) return "Due";
            const s = String(dateStr).slice(0, 10);
            if (s === todayStr) return "Today";
            if (s === tomorrowStr) return "Tomorrow";
            const d = new Date(s + "T00:00:00");
            return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          };

          // ─── COMPOSER helpers ────────────────────────────────────────────
          const clientMatches = composerQuery.trim()
            ? clients.filter(c => c.name.toLowerCase().includes(composerQuery.trim().toLowerCase()))
            : clients;

          const submitComposer = async () => {
            if (!newTask.trim()) return;
            // Parse one final time to get the cleaned title (matched names stripped,
            // sentence-cased, ending punctuation auto-applied).
            const finalParse = parseComposer(newTask, clients, workersList);
            const text = finalParse.title || newTask.trim();
            const clientName = composerClient || "";
            const clientObj = clients.find(c => c.name === clientName);
            // Recurring tasks cannot have a due_date — they reset daily at midnight local.
            // For non-recurring tasks: if no due date was picked, default to today
            // so the task is anchored (not free-floating) and renders in the Today bucket.
            const dueDateForCreate = newTaskRecurring
              ? null
              : (newTaskDueDate || _todayStr);
            const recurrencePatternForCreate = newTaskRecurring ? newTaskRecurrencePattern : null;
            const { data: created } = await tasksDb.create(user.id, {
              text,
              client_name: clientName,
              client_id: clientObj?.id || null,
              is_recurring: newTaskRecurring,
              recurrence_pattern: recurrencePatternForCreate,
              due_date: dueDateForCreate,
              assigned_worker_id: newTaskWorkerId || null,
            });
            const task = {
              id: created?.id || "u" + Date.now(),
              text,
              client: clientName || null,
              done: false, ai: false,
              recurring: newTaskRecurring,
              recurrence_pattern: recurrencePatternForCreate,
              due_date: dueDateForCreate,
              raiPriority: false, alert: false,
              created_at: Date.now(),
              assigned_worker_id: newTaskWorkerId || null,
            };
            setTasks(prev => [task, ...prev]);

            // Fire email send if assigned to a worker (non-blocking).
            if (newTaskWorkerId && created?.id) {
              try {
                const { data: { session } } = await supabase.auth.getSession();
                fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/worker-task-notify`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                  },
                  body: JSON.stringify({ task_id: created.id }),
                }).catch(e => console.warn("Worker notify failed:", e));
              } catch (e) { console.warn("Worker notify error:", e); }
            }

            setNewTask("");
            setComposerClient("");
            setNewTaskRecurring(false);
            setNewTaskRecurrencePattern({ kind: "daily" });
            setNewTaskDueDate(null);
            setNewTaskWorkerId(null);
            setDuePickerOpen(false);
            setWorkerPickerOpen(false);
            setComposerMenuOpen(false);
            // Clear parser provenance — next task starts fresh.
            parserSetRecurrenceRef.current = null;
            parserSetDueDateRef.current = null;
          };

          // ─── RENDER ──────────────────────────────────────────────────────
          return (
            <div
              className={"rt-today-v4" + (focusMode ? " rt-focus-on" : "")}
              onClick={focusMode ? (e) => {
                // Exit focus if click target is the wrapper itself (background area), not bubbled from inside a task or button.
                // We use a data attribute on focus-protected zones; if no protected ancestor, exit.
                const t = e.target;
                if (t && t.closest && t.closest("[data-focus-keep]")) return;
                setFocusMode(false);
              } : undefined}
              style={{ width: "100%", display: "grid", gap: 20, alignItems: "start" }}>
              {/* STATUS BAND */}
              <div className="rt-band" style={{ gridArea: "band", display: "flex", flexDirection: "column", alignItems: "stretch", gap: 4, padding: "4px 4px 20px", borderBottom: "1px solid " + C.borderLight }}>
                <div style={{ fontSize: 11.5, color: C.textMuted, letterSpacing: 0.3 }}>
                  <span className="rt-band-date-long">{displayDate}</span>
                  <span className="rt-band-date-short">{shortDisplayDate}</span>
                </div>
                <h1 className="rt-band-greet" style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: -0.4, color: C.text }}>
                  {greeting}{firstName ? ", " + firstName : ""}.
                </h1>

                {/* Rai's Pick of the Day — its own block above the meta row.
                    maxWidth caps how wide it can get so long reasons WRAP
                    within the block (multi-line) instead of stretching the
                    band wider and pushing the events · tasks · % row to
                    misalign. Renders regardless of rankMode: the Pick is an
                    OBSERVATION ("here's the client to focus on today"), not
                    a SORT directive — Manual toggle does not silence it.
                    Hidden when: no pick, picked client not in roster, or
                    user dismissed it today. */}
                {(() => {
                  if (!raiPicks || !raiPicks.client_id) return null;
                  if (raiState?.todays_pick_dismissed_at) return null;
                  const pickClient = clients.find(c => c.id === raiPicks.client_id);
                  if (!pickClient) return null;
                  const handleAddTask = () => {
                    setTodayComposerClient(pickClient.name);
                    setTimeout(() => {
                      const el = document.getElementById("rt-composer-input");
                      if (el) { el.focus(); el.scrollIntoView({ behavior: "smooth", block: "center" }); }
                    }, 0);
                  };
                  const cleanedReason = raiPicks.reason
                    ? raiPicks.reason.replace(/^["'\u201c\u201d]|["'\u201c\u201d]$/g, "").replace(/\.$/, "")
                    : "Worth a check-in";
                  return (
                    <div
                      className="rt-band-pick is-expanded"
                      style={{
                        marginTop: 8,
                        fontSize: 13.5,
                        lineHeight: 1.5,
                        color: C.textMuted,
                        fontFamily: "'Fraunces', Georgia, serif",
                        fontStyle: "italic",
                        fontWeight: 500,
                        fontVariationSettings: "'opsz' 96, 'SOFT' 50, 'WONK' 0",
                        position: "relative",
                      }}
                    >
                      Today&rsquo;s client is{" "}
                      <span
                        className="rt-purple-link"
                        onClick={(e) => { e.stopPropagation(); handleAddTask(); }}
                        style={{ cursor: "pointer", paddingBottom: 1 }}
                      >
                        {pickClient.name}
                      </span>
                      {" "}&mdash;{" "}{cleanedReason}.{" "}-Rai
                    </div>
                  );
                })()}

                {/* Meta row: events · tasks on the left, % + completion bar
                    on the right. One flex row, justify-between, with a
                    flex-wrap fallback so on truly narrow screens the right
                    block falls below cleanly. */}
                <div className="rt-band-meta" style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div className="rt-band-sub" style={{ fontSize: 13.5, color: C.textMuted, display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexShrink: 0 }}>
                    <button
                      className="rt-band-sub-events"
                      onClick={() => setTodayStripOpen(!todayStripOpen)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        background: "transparent",
                        border: "none",
                        padding: 0,
                        margin: 0,
                        cursor: "pointer",
                        color: C.textMuted,
                        fontSize: "inherit",
                        fontFamily: "inherit",
                      }}
                    >
                      <b style={{ color: C.text, fontWeight: 700 }}>3</b> events
                      <span className="rt-band-sub-events-chev" style={{ display: "inline-flex" }}>
                        <Icon name={todayStripOpen ? "chevron-down" : "chevron-right"} size={11} color={C.textMuted} />
                      </span>
                    </button>
                    <span className="rt-band-sub-sep" style={{ color: C.border }}>·</span>
                    <span><b style={{ color: C.text, fontWeight: 700 }}>{todayCount}</b> tasks</span>
                  </div>

                  {/* Bar takes the remaining horizontal space between
                      events·tasks and the % number. flex: 1 stretches.
                      min-width keeps the bar visible even if siblings
                      grow. The wrapping fallback (band-meta has
                      flex-wrap) handles very narrow desktops. */}
                  <div className="rt-pct-bar" style={{ position: "relative", flex: 1, height: 5, minWidth: 60, background: C.borderLight, borderRadius: 999, overflow: "hidden", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.10)" }}>
                    <div className="rt-pct-fill" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.max(0, Math.min(100, Number(pct) * 100))}%`, background: `linear-gradient(90deg, ${C.primaryLight}, ${C.primary})`, borderRadius: 999, transition: "width 400ms cubic-bezier(.2,.7,.3,1)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.30), 0 0 6px rgba(51,84,62,0.25)" }} />
                  </div>

                  <span className="rt-pct-num" style={{ fontSize: 15, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums", letterSpacing: -0.2, flexShrink: 0 }}>
                    {Math.round(pct * 100)}<span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>%</span>
                  </span>
                  <span className="rt-pct-lbl" style={{ fontSize: 10.5, color: C.textMuted, letterSpacing: 0.3, textTransform: "uppercase", fontWeight: 600, flexShrink: 0 }}>of today done</span>
                </div>

                {/* Mobile calendar dropdown — drops down right under the band trigger.
                    Renders the today timeline in compact mode (caps at 6 visible
                    hours with internal scroll). */}
                {todayStripOpen && (
                  <div className="rt-mob-cal-sheet rt-mob-cal-sheet-band" style={{ display: "none", marginTop: 10, background: C.card, borderRadius: 10, padding: "14px" }}>
                    <TodayTimeline
                      events={personalEvents}
                      C={C}
                      showHeader={true}
                      compact={true}
                      googleConnected={false}
                      onConnectClick={() => setPage("settings")}
                      promptDismissed={googleCalPromptDismissed}
                      onDismissConnectPrompt={dismissGoogleCalPrompt}
                      onCreate={async (entry) => {
                        const optimistic = { id: `tmp-${Date.now()}`, source: "manual", ...entry };
                        setPersonalEvents(prev => [...prev, optimistic].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)));
                        const { data, error } = await personalCalendarDb.create(user.id, entry);
                        if (error) {
                          console.error("Calendar create failed:", error);
                          setPersonalEvents(prev => prev.filter(e => e.id !== optimistic.id));
                          return;
                        }
                        setPersonalEvents(prev => prev.map(e => e.id === optimistic.id ? data : e).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)));
                      }}
                      onUpdate={async (id, patch) => {
                        const prev = personalEvents;
                        setPersonalEvents(prev.map(e => e.id === id ? { ...e, ...patch } : e).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)));
                        const { error } = await personalCalendarDb.update(id, patch);
                        if (error) {
                          console.error("Calendar update failed:", error);
                          setPersonalEvents(prev);
                        }
                      }}
                      onDelete={async (id) => {
                        const prev = personalEvents;
                        setPersonalEvents(prev.filter(e => e.id !== id));
                        const { error } = await personalCalendarDb.remove(id);
                        if (error) {
                          console.error("Calendar delete failed:", error);
                          setPersonalEvents(prev);
                        }
                      }}
                    />
                  </div>
                )}
              </div>

              {/* COMPOSER */}
              <div className="rt-composer" style={{ gridArea: "composer", background: C.card, borderRadius: 14, boxShadow: "var(--rt-sh-card)", position: "relative" }}>
                {/* Row 1: purple puck plus + input */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px 8px" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 14, background: C.btnLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon name="plus" size={14} color={C.btn} />
                  </div>
                  <div style={{ flex: 1, minWidth: 140, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {/*
                      Smart composer input. As the user types, parseComposer() runs and:
                        - lights up Client / Worker / Date chips below
                      Manual chip clicks still override parser output.
                    */}
                    <input
                      id="rt-composer-input"
                      value={newTask}
                      onChange={e => {
                        const v = e.target.value;
                        setNewTask(v);
                        const parsed = parseComposer(v, clients, workersList);
                        if (parsed.matchedClient && composerClient !== parsed.matchedClient.name) {
                          setComposerClient(parsed.matchedClient.name);
                          triggerChipPulse("client");
                        }
                        if (parsed.matchedWorker && newTaskWorkerId !== parsed.matchedWorker.id) {
                          setNewTaskWorkerId(parsed.matchedWorker.id);
                          triggerChipPulse("worker");
                        }
                        // Recurrence wins over due_date: they're mutually
                        // exclusive in the data model, and the parser already
                        // voided matchedDate when matchedRecurrence fired.
                        if (parsed.matchedRecurrence) {
                          if (!newTaskRecurring) {
                            setNewTaskRecurring(true);
                            triggerChipPulse("due");
                          }
                          if (JSON.stringify(newTaskRecurrencePattern) !== JSON.stringify(parsed.matchedRecurrence.pattern)) {
                            setNewTaskRecurrencePattern(parsed.matchedRecurrence.pattern);
                          }
                          if (newTaskDueDate) setNewTaskDueDate(null);
                          // Record what the parser set so we can detect later
                          // if the user deletes the trigger phrase.
                          parserSetRecurrenceRef.current = parsed.matchedRecurrence.pattern;
                          parserSetDueDateRef.current = null;
                        } else if (parsed.matchedDate && parsed.matchedDate.date) {
                          const ymd = dateToYmd(parsed.matchedDate.date);
                          if (ymd && newTaskDueDate !== ymd) {
                            setNewTaskDueDate(ymd);
                            setNewTaskRecurring(false);
                            triggerChipPulse("due");
                          }
                          parserSetDueDateRef.current = ymd;
                          parserSetRecurrenceRef.current = null;
                        } else {
                          // No recurrence/date phrase in the text right now.
                          // If the current chip state still matches what the
                          // PARSER last set, the user just deleted the trigger
                          // phrase — clear the chip. If it differs, the user
                          // set it manually via the chip menu — leave it.
                          if (
                            parserSetRecurrenceRef.current &&
                            newTaskRecurring &&
                            JSON.stringify(newTaskRecurrencePattern) === JSON.stringify(parserSetRecurrenceRef.current)
                          ) {
                            setNewTaskRecurring(false);
                            setNewTaskRecurrencePattern({ kind: "daily" });
                            parserSetRecurrenceRef.current = null;
                          }
                          if (
                            parserSetDueDateRef.current &&
                            newTaskDueDate === parserSetDueDateRef.current
                          ) {
                            setNewTaskDueDate(null);
                            parserSetDueDateRef.current = null;
                          }
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === "Enter" && newTask.trim()) { e.preventDefault(); submitComposer(); }
                        else if (e.key === "Escape") { setComposerMenuOpen(false); }
                      }}
                      placeholder="Add a task. Natural language = magic."
                      style={{
                        flex: 1, minWidth: 100,
                        border: "none", outline: "none", background: "transparent",
                        fontSize: 14.5, padding: "4px 0", fontFamily: "inherit",
                        color: C.text,
                        fontStyle: newTask ? "normal" : "italic",
                      }}
                    />
                  </div>
                </div>

                {/* Divider between rows */}
                <div style={{ height: 1, background: C.borderLight, margin: "0 14px" }} />

                {/* Row 2: chips + Add Task button */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px 10px", flexWrap: "wrap" }}>
                  <div className="rt-composer-controls" style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "nowrap", flex: 1, minWidth: 0 }}>
                    {(() => {
                      const selectedClientObj = composerClient ? clients.find(c => c.name === composerClient) : null;
                      return (
                        <div style={{ position: "relative", flexShrink: 0 }}>
                          <button
                            onClick={() => setComposerMenuOpen(!composerMenuOpen)}
                            className={"rt-composer-pill" + (selectedClientObj ? " is-filled" : "") + (pulseChip === "client" ? " chip-pulse" : "")}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 5,
                              padding: selectedClientObj ? "0 4px 0 4px" : "0 10px",
                              height: 28,
                              border: "none",
                              borderRadius: 8,
                              fontSize: 12,
                              color: selectedClientObj ? C.btn : C.textSec,
                              background: selectedClientObj ? C.btnLight : C.card,
                              cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
                              fontWeight: selectedClientObj ? 600 : 500,
                            }}
                          >
                            {selectedClientObj ? (
                              <>
                                <ClientAvatar client={selectedClientObj} size={22} />
                                <span className="rt-composer-client-name" style={{ paddingRight: 4 }}>{selectedClientObj.name}</span>
                              </>
                            ) : (
                              <>
                                <Icon name="clients" size={14} simple />
                                <span style={{ fontWeight: 500 }}>Client</span>
                              </>
                            )}
                          </button>
                          {selectedClientObj && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setComposerClient(""); }}
                              style={{
                                position: "absolute",
                                top: -3, right: -3,
                                width: 16, height: 16,
                                borderRadius: 8,
                                background: C.card,
                                color: C.textMuted,
                                cursor: "pointer",
                                display: "grid", placeItems: "center",
                                padding: 0,
                              }}
                              aria-label="Clear client"
                              title="Clear client"
                            >
                              <Icon name="x" size={9} />
                            </button>
                          )}
                {composerMenuOpen && (
                  <>
                    {/* Click-outside backdrop — invisible but captures clicks anywhere on the page */}
                    <div
                      onClick={() => { setComposerMenuOpen(false); setComposerQuery(""); }}
                      style={{ position: "fixed", inset: 0, zIndex: 29, background: "transparent" }}
                    />
                    <div className="rt-client-picker" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, width: 300, background: C.card, borderRadius: 12, boxShadow: "0 12px 32px rgba(10,10,10,0.12)", zIndex: 30, padding: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderBottom: "1px solid " + C.borderLight }}>
                      <Icon name="search" size={12} color={C.textMuted} />
                      <input autoFocus value={composerQuery}
                        onChange={e => { setComposerQuery(e.target.value); setComposerHighlight(0); }}
                        onKeyDown={e => {
                          if (e.key === "Escape") { setComposerMenuOpen(false); return; }
                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            setComposerHighlight(h => Math.min(h + 1, Math.max(0, clientMatches.length - 1)));
                            return;
                          }
                          if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setComposerHighlight(h => Math.max(h - 1, 0));
                            return;
                          }
                          if (e.key === "Enter") {
                            const pick = clientMatches[composerHighlight] || clientMatches[0];
                            if (pick) {
                              setComposerClient(pick.name);
                              setComposerMenuOpen(false);
                              setComposerQuery("");
                              setComposerHighlight(0);
                              // Refocus the task input so the user can type immediately
                              setTimeout(() => {
                                const el = document.getElementById("rt-composer-input");
                                if (el) el.focus();
                              }, 0);
                            }
                          }
                        }}
                        placeholder="Search clients…" style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 12.5, fontFamily: "inherit", color: C.text }} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", paddingTop: 4, maxHeight: 300, overflow: "auto" }}>
                      {clientMatches.map((c, idx) => (
                        <button key={c.id || c.name}
                          onClick={() => {
                            setComposerClient(c.name);
                            setComposerMenuOpen(false);
                            setComposerQuery("");
                            setComposerHighlight(0);
                            // Refocus the task input so the user can type immediately
                            setTimeout(() => {
                              const el = document.getElementById("rt-composer-input");
                              if (el) el.focus();
                            }, 0);
                          }}
                          onMouseEnter={() => setComposerHighlight(idx)}
                          style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "7px 8px", borderRadius: 6, textAlign: "left",
                            background: idx === composerHighlight ? "rgba(0,0,0,0.04)" : "none",
                            border: "none", cursor: "pointer", fontFamily: "inherit",
                          }}>
                          <ClientAvatar client={c} size={22} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: idx === composerHighlight ? 600 : 500, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                            <div style={{ fontSize: 10.5, color: C.textMuted }}>{c.industry || "Client"}</div>
                          </div>
                          <ScoreChip score={c.ret} size="sm" />
                        </button>
                      ))}
                      {clientMatches.length === 0 && <div style={{ padding: "12px 10px", fontSize: 12, color: C.textMuted }}>No matches</div>}
                    </div>
                  </div>
                  </>
                )}
                        </div>
                      );
                    })()}
                    {/* Worker chip — only renders if user has at least one worker added.
                        When clicked, opens picker. Mutual exclusion: just selecting/clearing,
                        no other state interaction. Default (null) = self-assigned. */}
                    {workersList.length > 0 && (() => {
                      const selectedWorker = workersList.find(w => w.id === newTaskWorkerId);
                      return (
                        <div style={{ position: "relative", flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => setWorkerPickerOpen(!workerPickerOpen)}
                            className={"rt-composer-pill" + (selectedWorker ? " is-filled" : "") + (pulseChip === "worker" ? " chip-pulse" : "")}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 5,
                              padding: "0 10px",
                              height: 28,
                              border: "none",
                              borderRadius: 8,
                              fontSize: 12,
                              color: selectedWorker ? C.btn : C.textSec,
                              background: selectedWorker ? C.btnLight : C.card,
                              cursor: "pointer", fontFamily: "inherit",
                              fontWeight: selectedWorker ? 600 : 500,
                            }}
                            title={selectedWorker ? `Assigned to ${selectedWorker.name}` : "Assign to a worker"}
                          >
                            <Icon name="workers" size={14} simple color={selectedWorker ? C.btn : C.textMuted} />
                            <span>{selectedWorker ? selectedWorker.name.split(' ')[0] : "Worker"}</span>
                          </button>
                          {selectedWorker && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setNewTaskWorkerId(null); }}
                              style={{
                                position: "absolute",
                                top: -3, right: -3,
                                width: 16, height: 16,
                                borderRadius: 8,
                                background: C.card,
                                color: C.textMuted,
                                cursor: "pointer",
                                display: "grid", placeItems: "center",
                                padding: 0,
                              }}
                              aria-label="Clear worker"
                              title="Clear worker"
                            >
                              <Icon name="x" size={9} />
                            </button>
                          )}
                          {workerPickerOpen && (
                            <>
                              <div onClick={() => setWorkerPickerOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 49 }} />
                              <div style={{
                                position: "absolute",
                                top: "calc(100% + 6px)",
                                left: 0,
                                width: 260,
                                background: C.card,
                                borderRadius: 10,
                                padding: 6,
                                boxShadow: "0 12px 32px rgba(20,30,22,0.12)",
                                zIndex: 50,
                              }}>
                                {/* Self-assigned (default) option */}
                                <button
                                  onClick={() => { setNewTaskWorkerId(null); setWorkerPickerOpen(false); }}
                                  style={{
                                    width: "100%",
                                    display: "flex", alignItems: "center", gap: 10,
                                    padding: "8px 9px",
                                    background: !newTaskWorkerId ? "rgba(0,0,0,0.04)" : "transparent",
                                    border: "none", borderRadius: 6,
                                    cursor: "pointer", fontFamily: "inherit",
                                    textAlign: "left",
                                  }}
                                  onMouseEnter={e => { if (newTaskWorkerId) e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
                                  onMouseLeave={e => { if (newTaskWorkerId) e.currentTarget.style.background = "transparent"; }}
                                >
                                  <div style={{ width: 22, height: 22, borderRadius: 11, background: C.primary, color: "#fff", fontSize: 9, fontWeight: 700, display: "grid", placeItems: "center", flexShrink: 0 }}>
                                    {getUserInitial(user)}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: !newTaskWorkerId ? 600 : 500, color: C.text }}>Just me</div>
                                    <div style={{ fontSize: 11, color: C.textMuted }}>Default — keep on my list</div>
                                  </div>
                                </button>
                                <div style={{ height: 1, background: C.borderLight, margin: "4px 6px" }} />
                                {workersList.map(w => (
                                  <button
                                    key={w.id}
                                    onClick={() => { setNewTaskWorkerId(w.id); setWorkerPickerOpen(false); }}
                                    style={{
                                      width: "100%",
                                      display: "flex", alignItems: "center", gap: 10,
                                      padding: "8px 9px",
                                      background: newTaskWorkerId === w.id ? "rgba(0,0,0,0.04)" : "transparent",
                                      border: "none", borderRadius: 6,
                                      cursor: "pointer", fontFamily: "inherit",
                                      textAlign: "left",
                                    }}
                                    onMouseEnter={e => { if (newTaskWorkerId !== w.id) e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
                                    onMouseLeave={e => { if (newTaskWorkerId !== w.id) e.currentTarget.style.background = "transparent"; }}
                                  >
                                    <div style={{ width: 22, height: 22, borderRadius: 11, background: C.primary, color: "#fff", fontSize: 9, fontWeight: 700, display: "grid", placeItems: "center", flexShrink: 0 }}>
                                      {getWorkerInitials(w.name)}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: 13, fontWeight: newTaskWorkerId === w.id ? 600 : 500, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.name}</div>
                                      <div style={{ fontSize: 11, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.email}</div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}
                    {/* Due chip — opens date picker. Mutually exclusive with Recurring (which lives inside the menu). */}
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => setDuePickerOpen(!duePickerOpen)}
                        className={"rt-composer-pill" + ((newTaskDueDate || newTaskRecurring) ? " is-filled" : "") + (pulseChip === "due" ? " chip-pulse" : "")}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "0 10px",
                          height: 28,
                          border: "none",
                          borderRadius: 8,
                          fontSize: 12,
                          color: (newTaskDueDate || newTaskRecurring) ? C.btn : C.textSec,
                          background: (newTaskDueDate || newTaskRecurring) ? C.btnLight : C.card,
                          cursor: "pointer", fontFamily: "inherit",
                          fontWeight: (newTaskDueDate || newTaskRecurring) ? 600 : 500,
                        }}
                      >
                        <Icon name={newTaskRecurring ? "infinity" : "due"} size={newTaskRecurring ? 14 : 14} simple color={(newTaskDueDate || newTaskRecurring) ? C.btn : C.textMuted} />
                        <span>{newTaskRecurring ? formatRecurrenceLabel(newTaskRecurrencePattern) : (newTaskDueDate ? formatDueLabel(newTaskDueDate, _todayStr, _tomorrowStr) : "Due")}</span>
                      </button>
                      {(newTaskDueDate || newTaskRecurring) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setNewTaskDueDate(null); setNewTaskRecurring(false); setNewTaskRecurrencePattern({ kind: "daily" }); }}
                          style={{
                            position: "absolute",
                            top: -3, right: -3,
                            width: 16, height: 16,
                            borderRadius: 8,
                            background: C.card,
                            color: C.textMuted,
                            cursor: "pointer",
                            display: "grid", placeItems: "center",
                            padding: 0,
                            zIndex: 1,
                          }}
                          aria-label="Clear due date"
                          title="Clear due date"
                        >
                          <Icon name="x" size={9} />
                        </button>
                      )}
                      {duePickerOpen && (
                        <>
                        <div
                          onClick={() => setDuePickerOpen(false)}
                          style={{ position: "fixed", inset: 0, zIndex: 49, background: "transparent" }}
                        />
                        <div className="rt-due-picker" style={{
                          position: "absolute",
                          top: "calc(100% + 6px)",
                          left: 0,
                          background: C.card,
                          borderRadius: 10,
                          padding: 8,
                          boxShadow: "0 4px 16px rgba(20,30,22,0.12), 0 1px 3px rgba(20,30,22,0.06)",
                          zIndex: 50,
                          minWidth: 240,
                          display: "flex",
                          flexDirection: "column",
                          gap: 2,
                        }}>
                          {(() => {
                            const _later6 = new Date(_now);
                            _later6.setDate(_later6.getDate() + 6);
                            const _later6Str = `${_later6.getFullYear()}-${String(_later6.getMonth() + 1).padStart(2, "0")}-${String(_later6.getDate()).padStart(2, "0")}`;
                            const opts = [
                              { label: "Today", value: _todayStr },
                              { label: "Tomorrow", value: _tomorrowStr },
                              { label: "Later", value: _later6Str },
                            ];
                            return (
                              <>
                                {opts.map(o => {
                                  const isSel = !newTaskRecurring && newTaskDueDate === o.value;
                                  return (
                                    <button
                                      key={o.value}
                                      onClick={() => { setNewTaskDueDate(o.value); setNewTaskRecurring(false); setDuePickerOpen(false); }}
                                      style={{
                                        textAlign: "left",
                                        padding: "8px 10px",
                                        background: isSel ? "rgba(0,0,0,0.04)" : "transparent",
                                        border: "none",
                                        borderRadius: 6,
                                        fontSize: 13,
                                        color: C.text,
                                        fontWeight: isSel ? 600 : 500,
                                        cursor: "pointer",
                                        fontFamily: "inherit",
                                        display: "block",
                                        width: "100%",
                                      }}
                                      onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
                                      onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
                                    >
                                      {o.label}
                                    </button>
                                  );
                                })}
                                {/* CALENDAR GRID — pick any date. Hidden in recurring mode. */}
                                {!newTaskRecurring && (() => {
                                  const [yr, mo] = calendarMonth.split("-").map(Number);
                                  const firstOfMonth = new Date(yr, mo - 1, 1);
                                  const startDow = firstOfMonth.getDay();
                                  const daysInMonth = new Date(yr, mo, 0).getDate();
                                  const monthLabel = firstOfMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
                                  const cells = [];
                                  // pad with empty cells until first day-of-month aligns with weekday column
                                  for (let i = 0; i < startDow; i++) cells.push(null);
                                  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
                                  // pad to multiple of 7
                                  while (cells.length % 7 !== 0) cells.push(null);
                                  const goPrev = () => {
                                    let nyr = yr, nmo = mo - 1;
                                    if (nmo < 1) { nmo = 12; nyr--; }
                                    setCalendarMonth(`${nyr}-${String(nmo).padStart(2, "0")}`);
                                  };
                                  const goNext = () => {
                                    let nyr = yr, nmo = mo + 1;
                                    if (nmo > 12) { nmo = 1; nyr++; }
                                    setCalendarMonth(`${nyr}-${String(nmo).padStart(2, "0")}`);
                                  };
                                  return (
                                    <div style={{ padding: "6px 4px 2px" }}>
                                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, padding: "0 6px" }}>
                                        <button
                                          onClick={goPrev}
                                          style={{ width: 22, height: 22, border: "none", background: "transparent", color: C.textSec, cursor: "pointer", borderRadius: 4, fontSize: 14, lineHeight: 1, padding: 0 }}
                                          onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.04)"}
                                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                        >‹</button>
                                        <span style={{ fontSize: 11.5, color: C.text, fontWeight: 600, letterSpacing: 0.2 }}>{monthLabel}</span>
                                        <button
                                          onClick={goNext}
                                          style={{ width: 22, height: 22, border: "none", background: "transparent", color: C.textSec, cursor: "pointer", borderRadius: 4, fontSize: 14, lineHeight: 1, padding: 0 }}
                                          onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.04)"}
                                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                        >›</button>
                                      </div>
                                      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, padding: "0 4px 4px" }}>
                                        {["S","M","T","W","T","F","S"].map((d,i) => (
                                          <div key={i} style={{ fontSize: 9, color: C.textMuted, textAlign: "center", fontWeight: 600, padding: "2px 0" }}>{d}</div>
                                        ))}
                                        {cells.map((d, i) => {
                                          if (d === null) return <div key={i} />;
                                          const dateStr = `${yr}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                                          const isSel = newTaskDueDate === dateStr && !newTaskRecurring;
                                          const isToday = dateStr === _todayStr;
                                          return (
                                            <button
                                              key={i}
                                              onClick={() => { setNewTaskDueDate(dateStr); setNewTaskRecurring(false); setDuePickerOpen(false); }}
                                              style={{
                                                width: "100%", height: 24,
                                                border: "none",
                                                background: isSel ? "var(--rt-grad-btn)" : "transparent",
                                                color: isSel ? "#fff" : (isToday ? C.btn : C.text),
                                                borderRadius: 6,
                                                fontSize: 11,
                                                fontWeight: isToday || isSel ? 700 : 500,
                                                cursor: "pointer",
                                                fontFamily: "inherit",
                                                padding: 0,
                                                boxShadow: isSel ? "var(--rt-sh-purple)" : "none",
                                                transition: "all 160ms var(--rt-ease-out)",
                                              }}
                                              onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "rgba(0,0,0,0.06)"; }}
                                              onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}
                                            >{d}</button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })()}
                                {/* Recurring option — bottom of menu, divider above. */}
                                <div style={{ height: 1, background: C.borderLight, margin: "4px 6px" }} />
                                {!newTaskRecurring && (
                                  <button
                                    onClick={() => { setNewTaskRecurring(true); setNewTaskDueDate(null); }}
                                    style={{
                                      textAlign: "left",
                                      padding: "8px 10px",
                                      background: "transparent",
                                      border: "none",
                                      borderRadius: 6,
                                      fontSize: 13,
                                      color: C.text,
                                      fontWeight: 500,
                                      cursor: "pointer",
                                      fontFamily: "inherit",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 7,
                                      width: "100%",
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = "rgba(0,0,0,0.04)"}
                                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                                  >
                                    <Icon name="infinity" size={14} color={C.textMuted} />
                                    Recurring
                                  </button>
                                )}
                                {newTaskRecurring && (
                                  <div style={{ padding: "8px 10px 4px", display: "flex", flexDirection: "column", gap: 8 }}>
                                    <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
                                      <Icon name="infinity" size={12} color={C.btn} />
                                      Recurring
                                    </div>
                                    {/* Frequency chips — site-standard pill buttons.
                                        No borders, shadow-based active. Active: btnLight
                                        fill + purple shadow + btn text (same as Ranked
                                        by Rai active). Inactive: transparent + hover
                                        surface tint. */}
                                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                                      {[
                                        { key: "daily", label: "Daily" },
                                        { key: "weekdays", label: "Weekdays" },
                                        { key: "weekly", label: "Weekly" },
                                        { key: "monthly_date", label: "Monthly" },
                                      ].map(opt => {
                                        const isSel = newTaskRecurrencePattern.kind === opt.key
                                          || (opt.key === "monthly_date" && newTaskRecurrencePattern.kind === "monthly_weekday");
                                        return (
                                          <button
                                            key={opt.key}
                                            className={"rt-rec-chip" + (isSel ? " is-active" : "")}
                                            onClick={() => {
                                              if (opt.key === "daily") setNewTaskRecurrencePattern({ kind: "daily" });
                                              else if (opt.key === "weekdays") setNewTaskRecurrencePattern({ kind: "weekdays" });
                                              else if (opt.key === "weekly") setNewTaskRecurrencePattern({ kind: "weekly", days: [(_now.getDay())] });
                                              else if (opt.key === "monthly_date") setNewTaskRecurrencePattern({ kind: "monthly_date", day: _now.getDate() });
                                            }}
                                            style={{
                                              padding: "6px 14px",
                                              border: "none",
                                              borderRadius: 999,
                                              fontSize: 12,
                                              fontWeight: 600,
                                              cursor: "pointer",
                                              fontFamily: "inherit",
                                              ...(isSel
                                                ? { background: C.btnLight, color: C.btn, boxShadow: "var(--rt-sh-chip-purple)" }
                                                : { background: C.card, color: C.textSec, boxShadow: "var(--rt-sh-xs)" }),
                                            }}
                                          >
                                            {opt.label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    {/* Weekly: day-of-week multi-select — same chip
                                        language at smaller size. Circular by use of
                                        equal width/height + radius 999. */}
                                    {newTaskRecurrencePattern.kind === "weekly" && (
                                      <div style={{ display: "flex", gap: 4 }}>
                                        {["S", "M", "T", "W", "T", "F", "S"].map((label, dow) => {
                                          const days = newTaskRecurrencePattern.days || [];
                                          const isSel = days.includes(dow);
                                          return (
                                            <button
                                              key={dow}
                                              className={"rt-rec-chip" + (isSel ? " is-active" : "")}
                                              onClick={() => {
                                                const newDays = isSel
                                                  ? days.filter(d => d !== dow)
                                                  : [...days, dow];
                                                if (newDays.length === 0) return; // require at least one
                                                setNewTaskRecurrencePattern({ kind: "weekly", days: newDays });
                                              }}
                                              style={{
                                                width: 28, height: 28,
                                                border: "none",
                                                borderRadius: 999,
                                                fontSize: 11.5,
                                                fontWeight: 700,
                                                cursor: "pointer",
                                                fontFamily: "inherit",
                                                padding: 0,
                                                ...(isSel
                                                  ? { background: C.btn, color: "#fff", boxShadow: "var(--rt-sh-chip-purple)" }
                                                  : { background: C.card, color: C.textSec, boxShadow: "var(--rt-sh-xs)" }),
                                              }}
                                            >{label}</button>
                                          );
                                        })}
                                      </div>
                                    )}
                                    {/* Monthly: date OR weekday-of-month — same chip
                                        pattern. Two side-by-side pills. */}
                                    {(newTaskRecurrencePattern.kind === "monthly_date" || newTaskRecurrencePattern.kind === "monthly_weekday") && (
                                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                        <div style={{ display: "flex", gap: 5 }}>
                                          <button
                                            className={"rt-rec-chip" + (newTaskRecurrencePattern.kind === "monthly_date" ? " is-active" : "")}
                                            onClick={() => setNewTaskRecurrencePattern({ kind: "monthly_date", day: _now.getDate() })}
                                            style={{
                                              flex: 1, padding: "6px 12px",
                                              border: "none",
                                              borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                                              ...(newTaskRecurrencePattern.kind === "monthly_date"
                                                ? { background: C.btnLight, color: C.btn, boxShadow: "var(--rt-sh-chip-purple)" }
                                                : { background: C.card, color: C.textSec, boxShadow: "var(--rt-sh-xs)" }),
                                            }}
                                          >Date of month</button>
                                          <button
                                            className={"rt-rec-chip" + (newTaskRecurrencePattern.kind === "monthly_weekday" ? " is-active" : "")}
                                            onClick={() => {
                                              const week = Math.ceil(_now.getDate() / 7);
                                              setNewTaskRecurrencePattern({ kind: "monthly_weekday", week, day: _now.getDay() });
                                            }}
                                            style={{
                                              flex: 1, padding: "6px 12px",
                                              border: "none",
                                              borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                                              ...(newTaskRecurrencePattern.kind === "monthly_weekday"
                                                ? { background: C.btnLight, color: C.btn, boxShadow: "var(--rt-sh-chip-purple)" }
                                                : { background: C.card, color: C.textSec, boxShadow: "var(--rt-sh-xs)" }),
                                            }}
                                          >Day of week</button>
                                        </div>
                                        {newTaskRecurrencePattern.kind === "monthly_date" && (
                                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: C.textSec }}>
                                            On the
                                            <select
                                              value={newTaskRecurrencePattern.day}
                                              onChange={e => setNewTaskRecurrencePattern({ kind: "monthly_date", day: parseInt(e.target.value, 10) })}
                                              style={{ padding: "5px 10px", borderRadius: 7, fontSize: 12.5, fontFamily: "inherit", background: C.surfaceWarm, color: C.text, border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)" }}
                                            >
                                              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
                                            </select>
                                            of each month
                                          </div>
                                        )}
                                        {newTaskRecurrencePattern.kind === "monthly_weekday" && (
                                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: C.textSec, flexWrap: "wrap" }}>
                                            The
                                            <select
                                              value={newTaskRecurrencePattern.week}
                                              onChange={e => setNewTaskRecurrencePattern(p => ({ ...p, week: parseInt(e.target.value, 10) }))}
                                              style={{ padding: "5px 10px", borderRadius: 7, fontSize: 12.5, fontFamily: "inherit", background: C.surfaceWarm, color: C.text, border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)" }}
                                            >
                                              <option value={1}>1st</option>
                                              <option value={2}>2nd</option>
                                              <option value={3}>3rd</option>
                                              <option value={4}>4th</option>
                                              <option value={5}>5th</option>
                                            </select>
                                            <select
                                              value={newTaskRecurrencePattern.day}
                                              onChange={e => setNewTaskRecurrencePattern(p => ({ ...p, day: parseInt(e.target.value, 10) }))}
                                              style={{ padding: "5px 10px", borderRadius: 7, fontSize: 12.5, fontFamily: "inherit", background: C.surfaceWarm, color: C.text, border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)" }}
                                            >
                                              <option value={0}>Sunday</option>
                                              <option value={1}>Monday</option>
                                              <option value={2}>Tuesday</option>
                                              <option value={3}>Wednesday</option>
                                              <option value={4}>Thursday</option>
                                              <option value={5}>Friday</option>
                                              <option value={6}>Saturday</option>
                                            </select>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    {/* Cancel + Done — site-standard modal action pair.
                                        Cancel = C.surface secondary chip (matches every
                                        other modal Cancel in the app). Done = primary
                                        purple, anchored right via marginLeft auto. */}
                                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                                      <button
                                        onClick={() => { setNewTaskRecurring(false); setNewTaskRecurrencePattern({ kind: "daily" }); }}
                                        style={{ padding: "8px 14px", background: C.surface, color: C.textSec, border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                                      >Cancel</button>
                                      <button
                                        className="r-btn" data-tone="purple"
                                        onClick={() => setDuePickerOpen(false)}
                                        style={{ padding: "8px 16px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginLeft: "auto", boxShadow: "var(--rt-sh-chip-purple)" }}
                                      >Done</button>
                                    </div>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        </>
                      )}
                    </div>
                    <button
                      onClick={submitComposer}
                      disabled={!newTask.trim()}
                      className="rt-add-task-btn"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "0 14px",
                        height: 28,
                        borderRadius: 8,
                        border: "none",
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: "inherit",
                        marginLeft: "auto",
                        flexShrink: 0,
                        cursor: newTask.trim() ? "pointer" : "default",
                        // Two-state treatment: at rest = warm-neutral box with
                        // soft shadow (no fake-purple). When armed = full purple
                        // gradient with halo. Same shape across both — only the
                        // color does the work.,
                        background: newTask.trim() ? "var(--rt-grad-btn)" : C.surfaceWarm,
                        color: newTask.trim() ? "#fff" : C.textMuted,
                        boxShadow: newTask.trim() ? "var(--rt-sh-rai-pop)" : "none",
                        transition: "all 220ms var(--rt-ease-out)",
                      }}
                    >
                      Add Task
                    </button>
                  </div>
                </div>



              </div>

              {/* TASKS COLUMN */}
              <div className="rt-tasks-col" data-focus-keep style={{ gridArea: "tasks", minWidth: 0 }}>
                  <div className="rt-toolbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 4px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {/* Ranked by Rai / Manual toggle — pill segmented control */}
                      <div style={{ display: "inline-flex", background: C.surface, borderRadius: 999, padding: 3, gap: 0 }}>
                        <button
                          className={"rt-rank-opt" + (rankMode === "rai" ? " is-active" : "")}
                          onClick={() => setRankMode("rai")}
                          style={{
                            padding: "6px 14px",
                            // Option B "perfectly nested" geometry: inner radius
                            // = (outer height ÷ 2) − container padding. Locked
                            // to current button dimensions (padding 6/14, fontSize 12,
                            // container padding 3); if you resize either, recompute.,
                            borderRadius: 13,
                            border: "none",
                            fontFamily: "inherit",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            ...(rankMode === "rai"
                              ? { background: C.btnLight, color: C.btn, boxShadow: "0 1px 2px rgba(91,33,182,0.12), 0 2px 6px rgba(91,33,182,0.08)" }
                              : {}),
                          }}
                        >
                          <span style={{}}>Ranked by Rai</span>
                        </button>
                        <button
                          className={"rt-rank-opt" + (rankMode === "manual" ? " is-active" : "")}
                          onClick={() => setRankMode("manual")}
                          style={{
                            padding: "6px 14px",
                            borderRadius: 13,
                            border: "none",
                            fontFamily: "inherit",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            ...(rankMode === "manual"
                              ? { background: C.card, color: C.text, boxShadow: "var(--rt-sh-card)" }
                              : {}),
                          }}
                        >
                          Manual
                        </button>
                      </div>
                      {/* Focus mode button — only enabled in Rai mode.
                          Idle: transparent with site-standard ink-300 outline.
                          Active: deep-green fill with white text. No watermark,
                          no icon — text alone. Physical dimensions locked to
                          padding 6px/14px, border-radius 999, font-size 12. */}
                      {rankMode === "rai" && (
                        <button
                          onClick={() => {
                            setFocusMode(!focusMode);
                          }}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "6px 14px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 600,
                            fontFamily: "inherit",
                            cursor: "pointer",
                            ...(focusMode
                              ? {
                                  background: "var(--rt-grad-green-deep)",
                                  border: "none",
                                  color: "#fff",
                                  boxShadow: "var(--rt-sh-green-glow)",
                                }
                              : {}),
                          }}
                          className={"rt-focus-btn" + (focusMode ? " is-active" : "")}
                        >
                          {focusMode ? "Focusing" : "Focus"}
                        </button>
                      )}
                      {debugScores && (
                        <span style={{
                          fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "3px 8px",
                          borderRadius: 999,
                          background: "#FEF3C7",
                          color: "#7C2D12",
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                        }}>
                          Debug · ⌘⇧D
                        </span>
                      )}
                    </div>
                    {/* Mobile-only calendar trigger (LEGACY — hidden, replaced by band-level trigger above) */}
                    <button
                      className="rt-mob-cal-trigger"
                      onClick={() => setTodayStripOpen(!todayStripOpen)}
                      style={{
                        display: "none",
                        alignItems: "center",
                        gap: 5,
                        padding: "5px 4px",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: C.textSec,
                        fontSize: 12,
                        fontWeight: 600,
                        fontFamily: "inherit"
                      }}
                    >
                      <Icon name="calendar" size={13} color={C.textSec} />
                      <span>3 events today</span>
                      <Icon name="chevron-right" size={11} color={C.textSec} />
                    </button>
                  </div>

                  {/* Mobile-only expanded calendar sheet (toggled by trigger above)
                      Renders the today timeline in compact mode (caps at 6 visible
                      hours with internal scroll). */}
                  {todayStripOpen && (
                    <div className="rt-mob-cal-sheet" style={{ display: "none", marginBottom: 12, background: C.card, borderRadius: 10, padding: "14px" }}>
                      <TodayTimeline
                        events={personalEvents}
                        C={C}
                        showHeader={true}
                        compact={true}
                        googleConnected={false}
                        onConnectClick={() => setPage("settings")}
                        promptDismissed={googleCalPromptDismissed}
                        onDismissConnectPrompt={dismissGoogleCalPrompt}
                        onCreate={async (entry) => {
                          const optimistic = { id: `tmp-${Date.now()}`, source: "manual", ...entry };
                          setPersonalEvents(prev => [...prev, optimistic].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)));
                          const { data, error } = await personalCalendarDb.create(user.id, entry);
                          if (error) {
                            console.error("Calendar create failed:", error);
                            setPersonalEvents(prev => prev.filter(e => e.id !== optimistic.id));
                            return;
                          }
                          setPersonalEvents(prev => prev.map(e => e.id === optimistic.id ? data : e).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)));
                        }}
                        onUpdate={async (id, patch) => {
                          // Optimistic move/resize. Capture prev so we can
                          // roll back if the server rejects the update.
                          const prev = personalEvents;
                          setPersonalEvents(prev.map(e => e.id === id ? { ...e, ...patch } : e).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)));
                          const { error } = await personalCalendarDb.update(id, patch);
                          if (error) {
                            console.error("Calendar update failed:", error);
                            setPersonalEvents(prev);
                          }
                        }}
                        onDelete={async (id) => {
                          const prev = personalEvents;
                          setPersonalEvents(prev.filter(e => e.id !== id));
                          const { error } = await personalCalendarDb.remove(id);
                          if (error) {
                            console.error("Calendar delete failed:", error);
                            setPersonalEvents(prev);
                          }
                        }}
                      />
                    </div>
                  )}

                  {!dataLoaded && (
                    <div style={{ padding: "12px 0 4px" }}>
                      <SkeletonTaskList rows={4} />
                    </div>
                  )}

                  {dataLoaded && openTasks.length === 0 && completedTasks.length === 0 && (
                    <div style={{ padding: "40px 4px 28px", borderTop: "1px solid " + C.borderLight, textAlign: "center" }}>
                      <div style={{
                        fontFamily: "'Fraunces', Georgia, serif",
                        fontVariationSettings: "'opsz' 96, 'SOFT' 50, 'WONK' 0",
                        fontStyle: "italic",
                        fontWeight: 500,
                        fontSize: 22,
                        letterSpacing: "-0.015em",
                        color: C.text,
                        marginBottom: 8,
                      }}>
                        Nothing on the list yet.
                      </div>
                      <div style={{
                        fontFamily: "'Fraunces', Georgia, serif",
                        fontVariationSettings: "'opsz' 96, 'SOFT' 50, 'WONK' 0",
                        fontStyle: "italic",
                        fontWeight: 500,
                        fontSize: 14,
                        lineHeight: 1.55,
                        color: C.textSec,
                        maxWidth: 380,
                        margin: "0 auto",
                      }}>
                        Add the first one — a call, a check-in, a thing you've been meaning to do. I'll pick up from there.
                      </div>
                    </div>
                  )}

                  {/* TASK LIST — three buckets: Today / Tomorrow / Later
                      Within each bucket, assigned tasks (delegated to a worker)
                      sort to the BOTTOM. Operator's own tasks (no assignment)
                      keep their existing order (Rai ranking or manual). */}
                  {(() => {
                    // Stable partition: unassigned first (preserving order), then assigned (preserving order).
                    const partitionByAssignment = (arr) => {
                      const unassigned = arr.filter(t => !t.assigned_worker_id);
                      const assigned = arr.filter(t => !!t.assigned_worker_id);
                      return [...unassigned, ...assigned];
                    };
                    const _todayBucket = partitionByAssignment(renderTasks.filter(t => bucketOf(t) === "today" && !collapsedDoneIds[t.id]));
                    const _tomorrowBucket = partitionByAssignment(
                      renderTasks.filter(t => bucketOf(t) === "tomorrow" && !collapsedDoneIds[t.id])
                        .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""))
                    );
                    const _laterBucket = partitionByAssignment(
                      renderTasks.filter(t => bucketOf(t) === "later" && !collapsedDoneIds[t.id])
                        .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""))
                    );
                    // Tasks that were completed and have collapsed out of the active list.
                    // They appear in the "Completed today" group below all buckets.
                    // Tasks that were completed and have collapsed out of the active list.
                    // Sorted newest-completed first — the log answers "what did I just do?"
                    // so the most recent action belongs at the top. Falls back to completed_at
                    // from the DB for tasks that were already done before this session loaded
                    // (the seeded ones from initial load); falls back to ID order for legacy
                    // tasks with no timestamp at all.
                    const _collapsedDoneTasks = renderTasks
                      .filter(t => collapsedDoneIds[t.id])
                      .sort((a, b) => {
                        const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0;
                        const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0;
                        if (aTime !== bTime) return bTime - aTime;
                        // Tie-breaker: stable by id so render order doesn't shuffle on every render
                        return String(b.id).localeCompare(String(a.id));
                      });

                    // Inline row renderer — captures bucketKey so the push button knows direction.
                    const renderRow = (t, bucketKey) => {
                        const client = clients.find(c => c.name === t.client);
                        const isDone = !!t.done;
                        const isJustDone = !!justCompletedIds[t.id];
                        const isManual = rankMode === "manual";
                        const isDragging = draggingTaskId === t.id;
                        const isDragOver = dragOverTaskId === t.id && draggingTaskId !== t.id;
                        // Focus target: first incomplete task in priority order, falling
                        // through buckets. Today first, then Tomorrow, then Later. This way
                        // focus mode always has something to lock onto if any incomplete
                        // task exists anywhere — even if today's bucket is empty (all done).
                        const focusTopId = (() => {
                          for (const bucket of ["today", "tomorrow", "later"]) {
                            const t = renderTasks.find(rt => !rt.done && bucketOf(rt) === bucket);
                            if (t) return t.id;
                          }
                          return null;
                        })();
                        const isFocusTop = focusMode && t.id === focusTopId;
                        // Rai's client-of-the-day: every task assigned to the boosted
                        // client gets the purple inset bar + ✦ medallion. Client-level
                        // designation, not task-level — see UX spec.
                        const raiBoostClient = (() => {
                          if (!raiPicks || !raiPicks.client_id) return null;
                          return clients.find(c => c.id === raiPicks.client_id) || null;
                        })();
                        const isRaiBoosted = !!(raiBoostClient && t.client && t.client === raiBoostClient.name);
                        const cls = "rt-row" + (isDone ? " is-done" : "") + (isJustDone ? " is-just-done" : "") + (isFocusTop ? " rt-focus-top" : "") + (isRaiBoosted ? " rt-rai-boost" : "");
  
                        // Reorder handler: when dropping onto target, move dragging task to target's position
                        const handleDrop = (e) => {
                          e.preventDefault();
                          if (!draggingTaskId || draggingTaskId === t.id) {
                            setDraggingTaskId(null);
                            setDragOverTaskId(null);
                            return;
                          }
                          // Build current order from renderTasks (current visual order)
                          const currentOrder = renderTasks.map(rt => rt.id);
                          const fromIdx = currentOrder.indexOf(draggingTaskId);
                          const toIdx = currentOrder.indexOf(t.id);
                          if (fromIdx === -1 || toIdx === -1) {
                            setDraggingTaskId(null);
                            setDragOverTaskId(null);
                            return;
                          }
                          const newOrder = [...currentOrder];
                          newOrder.splice(fromIdx, 1);
                          newOrder.splice(toIdx, 0, draggingTaskId);
                          setManualTaskOrder(newOrder);
                          setDraggingTaskId(null);
                          setDragOverTaskId(null);
                        };
  
                        const offset = swipeOffset[t.id] || 0;
                        const SWIPE_THRESHOLD = 90;
                        const SWIPE_MAX = 130;
                        // Industry-standard gesture defaults (iOS Mail / Things / Linear):
                        //   DEAD_ZONE — finger must travel this many px before any
                        //     row movement begins. Filters micro-jitter from finger
                        //     contact + small horizontal drift while scrolling.
                        //   ANGLE_RATIO — once the gesture passes the dead zone, we
                        //     measure horizontal vs vertical travel. If vertical is
                        //     greater (i.e. user is scrolling up/down), we lock the
                        //     gesture as "scroll" and never translate the row for
                        //     this touch. If horizontal wins, we lock as "swipe"
                        //     and process the remainder normally.
                        // The lock holds until touchEnd. This prevents the row from
                        // accidentally tracking sideways while the user is just
                        // scrolling the task list.
                        const DEAD_ZONE = 12;
                        const ANGLE_RATIO = 1.0; // dx must exceed dy to commit to swipe

                        const handleTouchStart = (e) => {
                          if (e.touches.length !== 1) return;
                          setSwipeStartX(prev => ({ ...prev, [t.id]: e.touches[0].clientX }));
                          // Stash startY in a ref-like field on the same map so we
                          // don't need a second state hook just for this.
                          setSwipeStartY(prev => ({ ...prev, [t.id]: e.touches[0].clientY }));
                          setSwipeLock(prev => ({ ...prev, [t.id]: null })); // null = undecided
                          setSwipeOffset(prev => ({ ...prev, [t.id]: 0 }));
                        };
                        const handleTouchMove = (e) => {
                          const startX = swipeStartX[t.id];
                          const startY = swipeStartY[t.id];
                          if (startX == null || startY == null) return;
                          const deltaX = e.touches[0].clientX - startX;
                          const deltaY = e.touches[0].clientY - startY;

                          // Look up our current lock state. If we already decided
                          // this gesture is a vertical scroll, do nothing (let the
                          // page handle it).
                          const lock = swipeLock[t.id];
                          if (lock === "scroll") return;

                          if (lock !== "swipe") {
                            // Still undecided — apply the dead zone + angle test.
                            const absX = Math.abs(deltaX);
                            const absY = Math.abs(deltaY);
                            if (Math.max(absX, absY) < DEAD_ZONE) return; // not enough travel yet
                            if (absY * ANGLE_RATIO >= absX) {
                              // Vertical wins → lock as scroll, never move the row.
                              setSwipeLock(prev => ({ ...prev, [t.id]: "scroll" }));
                              return;
                            }
                            // Horizontal wins → lock as swipe and proceed.
                            setSwipeLock(prev => ({ ...prev, [t.id]: "swipe" }));
                          }

                          // Recurring tasks can be deleted (left swipe) but not pushed
                          // to another bucket (right swipe blocked — they have no due_date
                          // and the bucket concept doesn't apply).
                          const minDelta = t.recurring ? -SWIPE_MAX : -SWIPE_MAX;
                          const maxDelta = t.recurring ? 0 : SWIPE_MAX;
                          // Subtract the dead zone from the displayed offset so the
                          // row starts at 0 visually when the swipe is just-committed,
                          // not at +/- DEAD_ZONE (which would be a visual jump).
                          const adjustedDelta = deltaX > 0
                            ? Math.max(0, deltaX - DEAD_ZONE)
                            : Math.min(0, deltaX + DEAD_ZONE);
                          const clamped = Math.max(minDelta, Math.min(maxDelta, adjustedDelta));
                          setSwipeOffset(prev => ({ ...prev, [t.id]: clamped }));
                        };
                        const handleTouchEnd = () => {
                          const off = swipeOffset[t.id] || 0;
                          // Always clear the lock + startY on end so the next touch
                          // starts fresh.
                          setSwipeStartY(prev => { const n = { ...prev }; delete n[t.id]; return n; });
                          setSwipeLock(prev => { const n = { ...prev }; delete n[t.id]; return n; });
                          if (off <= -SWIPE_THRESHOLD) {
                            // Left swipe past threshold → DELETE the task. Slide off-screen left, then remove.
                            setSwipeOffset(prev => ({ ...prev, [t.id]: -SWIPE_MAX }));
                            setTimeout(() => {
                              setTasks(prev => prev.filter(t2 => t2.id !== t.id));
                              tasksDb.delete(t.id);
                              setSwipeOffset(prev => { const n = { ...prev }; delete n[t.id]; return n; });
                              setSwipeStartX(prev => { const n = { ...prev }; delete n[t.id]; return n; });
                            }, 180);
                          } else if (off >= SWIPE_THRESHOLD && !t.recurring) {
                            // Right swipe past threshold → PUSH to next bucket. Recurring tasks
                            // skip this branch — they don't move between buckets.
                            setSwipeOffset(prev => ({ ...prev, [t.id]: SWIPE_MAX }));
                            setTimeout(() => {
                              if (bucketKey === "today") pushToTomorrow(t.id);
                              else if (bucketKey === "tomorrow") pushToLater(t.id);
                              else if (bucketKey === "later") pullToToday(t.id);
                              setSwipeOffset(prev => { const n = { ...prev }; delete n[t.id]; return n; });
                              setSwipeStartX(prev => { const n = { ...prev }; delete n[t.id]; return n; });
                            }, 180);
                          } else {
                            // Snap back
                            setSwipeOffset(prev => ({ ...prev, [t.id]: 0 }));
                            setSwipeStartX(prev => { const n = { ...prev }; delete n[t.id]; return n; });
                          }
                        };

                        // Action label per bucket — shown when swiping right (push)
                        const swipeActionLabel = bucketKey === "today" ? "Tomorrow"
                          : bucketKey === "tomorrow" ? "Later"
                          : "Today";

                        // Swipeable = any task that's not done. Recurring is allowed
                        // (left-swipe delete works); right-swipe push is gated separately
                        // in handleTouchEnd.
                        const swipeable = !isDone;

                        const isExiting = !!exitingDoneIds[t.id];

                        return (
                          <div key={t.id} className={"rt-row-wrap" + (isFocusTop && focusMode ? " rt-focus-top-wrap" : "") + (isExiting ? " is-exiting" : "")} style={{ position: "relative", borderRadius: 12, overflow: offset !== 0 ? "hidden" : "visible" }}>
                            {/* Swipe action background. Two directions:
                                - LEFT (offset < 0): red bg with delete signal. Row sliding left = delete.
                                - RIGHT (offset > 0): purple bg with destination bucket. Row sliding right = push.
                                Only renders when actively swiping. */}
                            {swipeable && offset < 0 && (
                              <div style={{
                                position: "absolute",
                                inset: 0,
                                background: C.danger,
                                borderRadius: 12,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "flex-end",
                                paddingRight: 22,
                                gap: 8,
                                color: "#fff",
                                fontSize: 13,
                                fontWeight: 600,
                                pointerEvents: "none",
                              }}>
                                <span>Delete</span>
                              </div>
                            )}
                            {swipeable && offset > 0 && (
                              <div style={{
                                position: "absolute",
                                inset: 0,
                                background: C.btn,
                                borderRadius: 12,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "flex-start",
                                paddingLeft: 22,
                                gap: 8,
                                color: "#fff",
                                fontSize: 13,
                                fontWeight: 600,
                                pointerEvents: "none",
                              }}>
                                <span>{swipeActionLabel}</span>
                              </div>
                            )}
                          <div
                            className={cls}
                            data-task-id={t.id}
                            draggable={isManual}
                            onDragStart={isManual ? (e) => {
                              setDraggingTaskId(t.id);
                              try { e.dataTransfer.effectAllowed = "move"; } catch {}
                            } : undefined}
                            onDragOver={isManual ? (e) => {
                              e.preventDefault();
                              if (draggingTaskId && draggingTaskId !== t.id) setDragOverTaskId(t.id);
                            } : undefined}
                            onDragLeave={isManual ? () => {
                              if (dragOverTaskId === t.id) setDragOverTaskId(null);
                            } : undefined}
                            onDrop={isManual ? handleDrop : undefined}
                            onDragEnd={isManual ? () => {
                              setDraggingTaskId(null);
                              setDragOverTaskId(null);
                            } : undefined}
                            onTouchStart={swipeable ? handleTouchStart : undefined}
                            onTouchMove={swipeable ? handleTouchMove : undefined}
                            onTouchEnd={swipeable ? handleTouchEnd : undefined}
                            onTouchCancel={swipeable ? handleTouchEnd : undefined}
                            style={{
                              display: "flex", alignItems: "center", gap: 12,
                              padding: "9px 14px",
                              background: C.card,
                              borderRadius: 12,
                              boxShadow: isDragOver ? "0 0 0 2px " + C.btnLight + ", var(--rt-sh-row-hover)" : "var(--rt-sh-row)",
                              opacity: isDragging ? 0.4 : 1,
                              cursor: isManual ? "grab" : "default",
                              transform: offset !== 0 ? `translateX(${offset}px)` : undefined,
                              transition: swipeStartX[t.id] != null
                                ? "box-shadow 200ms var(--rt-ease-out), opacity 120ms"
                                : "box-shadow 200ms var(--rt-ease-out), opacity 120ms, transform 200ms var(--rt-ease-out)",
                              touchAction: swipeable ? "pan-y" : "auto",
                              position: "relative",
                              zIndex: 2,
                            }}>
                            {isManual && (
                              <div
                                aria-hidden="true"
                                onTouchStart={(e) => {
                                  // Mobile drag-to-reorder: initiate from grip only.
                                  // Stops touch-start from propagating to row swipe handlers
                                  // (left/right swipe = complete/delete).
                                  e.stopPropagation();
                                  setDraggingTaskId(t.id);
                                }}
                                onTouchMove={(e) => {
                                  if (!draggingTaskId) return;
                                  e.preventDefault();
                                  e.stopPropagation();
                                  // Find which task row sits under the current touch point.
                                  // Walks up the DOM looking for a [data-task-id] ancestor.
                                  const touch = e.touches[0];
                                  if (!touch) return;
                                  let el = document.elementFromPoint(touch.clientX, touch.clientY);
                                  while (el && !el.dataset?.taskId) el = el.parentElement;
                                  const overId = el?.dataset?.taskId;
                                  if (overId && overId !== draggingTaskId && overId !== dragOverTaskId) {
                                    setDragOverTaskId(overId);
                                  }
                                }}
                                onTouchEnd={(e) => {
                                  if (!draggingTaskId) return;
                                  e.stopPropagation();
                                  // Commit reorder using the same logic as desktop drop.
                                  const targetId = dragOverTaskId;
                                  if (targetId && targetId !== draggingTaskId) {
                                    const currentOrder = renderTasks.map(rt => rt.id);
                                    const fromIdx = currentOrder.indexOf(draggingTaskId);
                                    const toIdx   = currentOrder.indexOf(targetId);
                                    if (fromIdx !== -1 && toIdx !== -1) {
                                      const newOrder = [...currentOrder];
                                      newOrder.splice(fromIdx, 1);
                                      newOrder.splice(toIdx, 0, draggingTaskId);
                                      setManualTaskOrder(newOrder);
                                    }
                                  }
                                  setDraggingTaskId(null);
                                  setDragOverTaskId(null);
                                }}
                                onTouchCancel={() => {
                                  setDraggingTaskId(null);
                                  setDragOverTaskId(null);
                                }}
                                style={{
                                  color: C.textMuted,
                                  fontSize: 14,
                                  lineHeight: 1,
                                  letterSpacing: "-1px",
                                  userSelect: "none",
                                  flexShrink: 0,
                                  cursor: "grab",
                                  padding: "0 2px",
                                  touchAction: "none",
                                }}>
                                ⋮⋮
                              </div>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleTask(t.id); }}
                              aria-label={isDone ? "mark incomplete" : "mark complete"}
                              className="rt-check"
                              style={{
                                width: 22, height: 22, borderRadius: 6, border: "2px solid " + C.ink300,
                                background: C.card, display: "flex", alignItems: "center", justifyContent: "center",
                                flexShrink: 0, cursor: "pointer", padding: 0,
                              }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </button>
  
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {/* Rai's pick badge — daily annotation. The system selects which
                                  task gets the badge from Rai's ranked client picks (primary,
                                  backup1, backup2) using priority_score + the 60s burst rule.
                                  Reason renders inline below the badge so users see Rai's
                                  rationale without needing to hover (also works on mobile).
                                  Disappears in Manual mode (activeBadgeTaskId is null there). */}
                              {activeBadgeTaskId === t.id && activeBadgePick && (
                                <div
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    letterSpacing: "0.04em",
                                    textTransform: "uppercase",
                                    color: C.btn,
                                    marginBottom: 3,
                                  }}
                                >
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                    <path d="M12 0l2.5 7.5L22 10l-7.5 2.5L12 20l-2.5-7.5L2 10l7.5-2.5L12 0z" />
                                  </svg>
                                  Rai's pick
                                </div>
                              )}
                              <div style={{ fontSize: 14, fontWeight: 500, color: C.text, lineHeight: 1.25, paddingBottom: 2, overflow: "hidden" }}>
                                {(() => {
                                  // Title is interactive when the text contains a thinking
                                  // verb AND has a client tag AND task isn't done. Click
                                  // opens the Rai chat page with task + client preloaded.
                                  const isDiscussable = !isDone && client && detectThinkingVerb(t.text);
                                  if (isDiscussable) {
                                    return (
                                      <span
                                        className="rt-task-title is-discussable"
                                        title={`${t.text}\n\nClick to talk this through with Rai`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setAiConvoId(null);
                                          setAiMessages([{
                                            role: "ai",
                                            text: `You're looking at "${t.text}" for ${client.name}. What's the part you're chewing on?`,
                                          }]);
                                          setPage("coach");
                                        }}
                                        style={{ display: "inline-block", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom" }}
                                      >
                                        {t.text}
                                      </span>
                                    );
                                  }
                                  return <span className="rt-task-title" title={t.text} style={{ display: "inline-block", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom" }}>{t.text}</span>;
                                })()}
                              </div>
                              <div className="rt-row-meta" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: C.ink500, marginTop: 2, minWidth: 0 }}>
                                {client
                                  ? <div className="rt-task-avatar" style={{ display: "flex", flexShrink: 0 }}><ClientAvatar client={client} size={16} /></div>
                                  : <div className="rt-task-avatar" style={{ width: 16, height: 16, borderRadius: 8, background: C.borderSoft, flexShrink: 0 }} />}
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{client ? client.name : "N/A"}</span>
                                {debugScores && client && (() => {
                                  const psFloat = calcProfileScore(client.ret || 50, client, clients);
                                  const psRaw = calcProfileScoreRaw(client.ret || 50, client, clients);
                                  const totalRev = clients.reduce((a, x) => a + (x.revenue || 0), 0);
                                  const revPct = totalRev > 0 ? (client.revenue || 0) / totalRev : 0;
                                  const newBoost = calcNewClientBoost(client.ret || 50, revPct, client.daysOld != null ? client.daysOld : 999);
                                  const raiBoost = t.raiPriority ? getRaiBoost(psFloat) : 0;
                                  const nudge = client.raiNudge || 0;
                                  const isPicked = raiPicks && raiPicks.client_id === client.id;
                                  const pickBoost = isPicked ? (Number(raiPicks.pick_boost) || 0) : 0;
                                  const finalScore = Math.min(99, psFloat + newBoost + raiBoost + nudge + pickBoost);
                                  return (
                                    <span style={{
                                      fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                                      fontSize: 10,
                                      fontWeight: 600,
                                      padding: "2px 6px",
                                      borderRadius: 4,
                                      background: "#FEF3C7",
                                      color: "#7C2D12",
                                      border: "1px solid #FDE68A",
                                      flexShrink: 0,
                                      whiteSpace: "nowrap",
                                    }}>
                                      ret:{client.ret} raw:{psRaw} ps:{psFloat.toFixed(1)} nb:{newBoost} rai:{raiBoost} nudge:{nudge >= 0 ? "+" : ""}{nudge}{isPicked ? ` pick:+${pickBoost}` : ""} → <b>{finalScore.toFixed(1)}</b>
                                    </span>
                                  );
                                })()}
                              </div>
                              {/* Rai's reason renders at the bottom of the tile, below the
                                  client name. Italic Fraunces. We strip a leading "ClientName: "
                                  prefix from the reason because the client name is already shown
                                  in the meta row above — repeating it is noise. */}
                              {activeBadgeTaskId === t.id && activeBadgePick && activeBadgePick.reason && (
                                <div
                                  style={{
                                    fontFamily: "'Fraunces', Georgia, serif",
                                    fontStyle: "italic",
                                    fontSize: 13,
                                    lineHeight: 1.4,
                                    color: C.textSec,
                                    marginTop: 6,
                                    whiteSpace: "normal",
                                    wordBreak: "break-word",
                                  }}
                                >
                                  {(() => {
                                    let reason = activeBadgePick.reason;
                                    // Strip leading "ClientName: " or "ClientName — " or "ClientName, " prefix
                                    if (client && client.name) {
                                      const prefixes = [
                                        client.name + ": ",
                                        client.name + " — ",
                                        client.name + " - ",
                                        client.name + ", ",
                                        client.name + ". ",
                                      ];
                                      for (const p of prefixes) {
                                        if (reason.startsWith(p)) {
                                          reason = reason.slice(p.length);
                                          if (reason.length > 0) {
                                            reason = reason.charAt(0).toUpperCase() + reason.slice(1);
                                          }
                                          break;
                                        }
                                      }
                                    }
                                    return reason;
                                  })()}
                                </div>
                              )}
                            </div>

                            {/* Worker assignment badge — only renders if task is assigned. */}
                            {t.assigned_worker_id && (() => {
                              const w = workersList.find(x => x.id === t.assigned_worker_id);
                              if (!w) return null;
                              const initials = getWorkerInitials(w.name);
                              const isWorkerDone = !!t.worker_completed_at;
                              return (
                                <span className="rt-row-worker" style={{
                                  display: "inline-flex", alignItems: "center", gap: 5,
                                  padding: "3px 9px 3px 3px",
                                  borderRadius: 999,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  flexShrink: 0,
                                  // Pending = gold (warning) — distinct from purple (selected) and green (done).
                                  // Done = neutral grey, doesn't compete with the strikethrough on the title.,
                                  background: isWorkerDone ? C.surfaceWarm : "rgba(184,139,21,0.14)",
                                  color: isWorkerDone ? C.textMuted : C.warning,
                                }} title={isWorkerDone ? `${w.name} completed this` : `Assigned to ${w.name}`}>
                                  <span style={{
                                    width: 18, height: 18, borderRadius: 9,
                                    background: isWorkerDone ? C.textMuted : C.warning,
                                    color: "#fff", fontSize: 8, fontWeight: 700,
                                    display: "grid", placeItems: "center",
                                  }}>{initials}</span>
                                  <span className="rt-row-text">{w.name.split(' ')[0]}{isWorkerDone ? " · done" : ""}</span>
                                </span>
                              );
                            })()}

                            {/* Right-side indicator — recurring infinity OR date pill (mutually exclusive) */}
                            {t.recurring ? (
                              <span className="rt-row-recur" style={{
                                display: "inline-flex", alignItems: "center", gap: 4,
                                padding: "3px 9px",
                                borderRadius: 999,
                                fontSize: 11,
                                fontWeight: 600,
                                flexShrink: 0,
                                color: C.textMuted,
                                border: "none",
                                background: C.surfaceWarm,
                                boxShadow: "var(--rt-sh-xs)",
                              }} title={formatRecurrenceLabel(t.recurrence_pattern)}>
                                <Icon name="infinity" size={12} color={C.textMuted} />
                                <span className="rt-row-text">{formatRecurrenceLabel(t.recurrence_pattern)}</span>
                              </span>
                            ) : t.due_date ? (() => {
                              const isToday = String(t.due_date).slice(0,10) === _todayStr;
                              const isTomorrow = String(t.due_date).slice(0,10) === _tomorrowStr;
                              const isOverdue = !isDone && String(t.due_date).slice(0,10) < _todayStr;
                              const label = isOverdue
                                ? (() => {
                                    const days = Math.round((new Date(_todayStr) - new Date(String(t.due_date).slice(0,10))) / 86400000);
                                    return days === 1 ? "1d late" : days + "d late";
                                  })()
                                : isToday ? "Today"
                                : isTomorrow ? "Tomorrow"
                                : new Date(String(t.due_date).slice(0,10) + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
                              return (
                                <span className={"rt-row-due " + (isToday ? "rt-due-today" : isOverdue ? "rt-due-overdue" : "rt-due-future")} style={{
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                  padding: "3px 9px",
                                  borderRadius: 999,
                                  fontSize: 11,
                                  fontWeight: 600,
                                  flexShrink: 0,
                                  // When the task is done, the Today/Overdue pill
                                  // collapses to the muted "future" treatment
                                  // (transparent bg, hairline border, muted text)
                                  // so it visually matches the rest of the dimmed
                                  // task row instead of staying full-color.,
                                  background: isDone ? "transparent" : (isOverdue ? "rgba(196,67,43,0.10)" : isToday ? C.surfaceWarm : C.surfaceWarm),
                                  color: isDone ? C.textMuted : (isOverdue ? C.danger : isToday ? C.text : C.textMuted),
                                  border: "none",
                                  boxShadow: isDone ? "none" : "var(--rt-sh-xs)",
                                }}>
                                  <Icon name="calendar" size={10} color={isDone ? C.textMuted : (isOverdue ? C.danger : isToday ? C.text : C.textMuted)} />
                                  <span className="rt-row-text">{label}</span>
                                </span>
                              );
                            })() : null}
  
                            {/* Push button — direction depends on bucket.
                                Today/Tomorrow → push forward to next bucket.
                                Later → pull back to Today.
                                Hidden on done tasks (no point pushing a completed item).
                                Hidden on recurring (they have no due_date by design). */}
                            {!isDone && !t.recurring && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (bucketKey === "today") pushToTomorrow(t.id);
                                  else if (bucketKey === "tomorrow") pushToLater(t.id);
                                  else if (bucketKey === "later") pullToToday(t.id);
                                }}
                                className="rt-push"
                                style={{
                                  width: 28, height: 28, borderRadius: 6,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  color: C.textMuted, opacity: 0.4,
                                  background: "none", border: "none", cursor: "pointer",
                                  flexShrink: 0,
                                  transition: "opacity 120ms ease, background 120ms ease, color 120ms ease",
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.opacity = "1";
                                  e.currentTarget.style.background = C.btnLight;
                                  e.currentTarget.style.color = C.btn;
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.opacity = "0.4";
                                  e.currentTarget.style.background = "none";
                                  e.currentTarget.style.color = C.textMuted;
                                }}
                                aria-label={bucketKey === "later" ? "pull to today" : bucketKey === "tomorrow" ? "push to later" : "push to tomorrow"}
                                title={bucketKey === "later" ? "Pull to Today" : bucketKey === "tomorrow" ? "Push to Later" : "Push to Tomorrow"}
                              >
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ transform: bucketKey === "later" ? "rotate(180deg)" : "none" }}>
                                  <path d="M3 8h9M9 5l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                            )}

                            <button onClick={(e) => { e.stopPropagation(); setTasks(tasks.filter(t2 => t2.id !== t.id)); tasksDb.delete(t.id); }}
                              className="rt-dismiss"
                              style={{ width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted, opacity: 0.4, background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}
                              aria-label="dismiss">
                              <Icon name="x" size={12} />
                            </button>
                          </div>
                          </div>
                        );
                    };

                    // Bucket header component (inline).
                    const BucketHeader = ({ name, dimmed, count }) => {
                      // Polish layer: each bucket gets a tiny color-coded dot
                      // with a soft halo. Green-light for today (the active surface),
                      // muted ink for tomorrow/later. Same primary palette.
                      // Optional count shown after the name with a thin separator —
                      // at-a-glance awareness of what's queued without scanning.
                      const isToday = name === "Today";
                      const dotColor = isToday ? C.primaryLight : C.ink300;
                      const dotHalo = isToday ? C.primarySoft : C.surfaceWarm;
                      return (
                        <div className="rt-bucket-head" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "18px 4px 10px" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, color: dimmed ? C.textMuted : C.text }}>
                            <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: dotColor, boxShadow: "0 0 0 3px " + dotHalo }} />
                            {name}
                            {typeof count === "number" && count > 0 && (
                              <>
                                <span style={{ color: C.border, fontWeight: 400, letterSpacing: 0 }}>·</span>
                                <span style={{ color: C.textSec, fontVariantNumeric: "tabular-nums", letterSpacing: 0 }}>{count}</span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    };


                    return (
                      <>
                        {/* TODAY bucket */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {_todayBucket.map(t => renderRow(t, "today"))}
                        </div>

                        {/* Today bucket empty states. Two distinct conditions
                            with different tones — emptiness only earns
                            acknowledgment when something was actually done.

                            CASE A: nothing exists yet. todayCount === 0 means
                            no tasks created for today at all (neither open nor
                            done). Show a quiet prompt — no congratulation,
                            because there is nothing to congratulate.

                            CASE B: all complete. todayCount > 0 means tasks
                            existed; _todayBucket.length === 0 means none are
                            still open; todayDoneCount === todayCount confirms
                            every one is checked off. Modest acknowledgment —
                            user earned this — plus a Tomorrow preview if there
                            is one. The voice stays direct and unsentimental
                            (no "you crushed it" energy). */}
                        {_todayBucket.length === 0 && todayCount === 0 && (
                          <div style={{ textAlign: "center", padding: "32px 20px", background: "transparent", border: "1px dashed " + C.border, borderRadius: 10, color: C.textMuted, fontSize: 13, fontStyle: "italic", fontFamily: "'Fraunces', Georgia, serif", fontVariationSettings: "'opsz' 96, 'SOFT' 50, 'WONK' 0", fontWeight: 500 }}>
                            Nothing on today&rsquo;s list yet. Add one above &uarr;
                          </div>
                        )}
                        {_todayBucket.length === 0 && todayCount > 0 && todayCount === todayDoneCount && (
                          <div style={{ textAlign: "center", padding: "28px 20px", background: C.primarySoft, borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.primary, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 2 }}>
                              <Icon name="check" size={14} color="#fff" />
                            </div>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: C.primaryDeep }}>Today&rsquo;s list is clear.</div>
                            {_tomorrowBucket.length > 0 && (
                              <div style={{ fontSize: 12, color: C.textSec }}>
                                <b style={{ color: C.text, fontWeight: 700 }}>{_tomorrowBucket.length}</b> {_tomorrowBucket.length === 1 ? "task" : "tasks"} queued for tomorrow.
                              </div>
                            )}
                          </div>
                        )}

                        {/* TOMORROW bucket */}
                        {_tomorrowBucket.length > 0 && (<>
                          <BucketHeader name="Tomorrow" dimmed={true} count={_tomorrowBucket.length} />
                          <div style={{ display: "flex", flexDirection: "column", gap: 8, opacity: 0.76 }}>
                            {_tomorrowBucket.map(t => renderRow(t, "tomorrow"))}
                          </div>
                        </>)}

                        {/* LATER bucket */}
                        {_laterBucket.length > 0 && (<>
                          <BucketHeader name="Later" dimmed={true} count={_laterBucket.length} />
                          <div style={{ display: "flex", flexDirection: "column", gap: 8, opacity: 0.76 }}>
                            {_laterBucket.map(t => renderRow(t, "later"))}
                          </div>
                        </>)}

                        {/* COMPLETED TODAY log — sits at the bottom, below all
                            active buckets. Active work gets prime real estate;
                            completed work is reference, not action. Collapsed
                            by default; the line doubles as the toggle button. */}
                        {_collapsedDoneTasks.length > 0 && (
                          <div className="rt-completed-log" style={{ marginTop: 24 }}>
                            <button
                              onClick={() => setCompletedLogOpen(!completedLogOpen)}
                              style={{
                                width: "100%",
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "12px 14px",
                                background: completedLogOpen ? C.primarySoft : "transparent",
                                border: "1px dashed " + (completedLogOpen ? C.primaryLight : C.border),
                                borderRadius: 10,
                                color: completedLogOpen ? C.primary : C.textSec,
                                fontSize: 13,
                                fontWeight: 500,
                                cursor: "pointer",
                                fontFamily: "inherit",
                                transition: "background 160ms var(--rt-ease-out), border-color 160ms var(--rt-ease-out), color 160ms var(--rt-ease-out)",
                              }}
                              onMouseEnter={e => {
                                if (completedLogOpen) return; // already in green state
                                e.currentTarget.style.background = C.primarySoft;
                                e.currentTarget.style.borderColor = C.primaryLight;
                                e.currentTarget.style.color = C.primary;
                              }}
                              onMouseLeave={e => {
                                if (completedLogOpen) return; // keep green while open
                                e.currentTarget.style.background = "transparent";
                                e.currentTarget.style.borderColor = C.border;
                                e.currentTarget.style.color = C.textSec;
                              }}
                            >
                              <span>
                                <span style={{ color: C.textMuted, marginRight: 4 }}>{_collapsedDoneTasks.length}</span>
                                completed today
                              </span>
                              <svg
                                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                style={{ transform: completedLogOpen ? "rotate(90deg)" : "rotate(0)", transition: "transform 220ms var(--rt-ease-out)" }}
                              >
                                <path d="M9 6l6 6-6 6" />
                              </svg>
                            </button>
                            <div
                              style={{
                                // Smooth height-animation pattern: grid row
                                // toggles between 0fr (collapsed) and 1fr
                                // (expanded). The child uses overflow:hidden
                                // and min-height:0 so it collapses cleanly.
                                // Animates to the ACTUAL content height — no
                                // dead-space scrubbing (the old max-height:2000
                                // approach would run the full 320ms even when
                                // content was only ~300px tall, producing the
                                // truncated/janky feel). Opacity fade rides
                                // alongside for a polished entry.
                                display: "grid",
                                gridTemplateRows: completedLogOpen ? "1fr" : "0fr",
                                marginTop: completedLogOpen ? 8 : 0,
                                opacity: completedLogOpen ? 1 : 0,
                                transition: "grid-template-rows 280ms var(--rt-ease-out), margin-top 240ms var(--rt-ease-out), opacity 220ms var(--rt-ease-out)",
                              }}
                            >
                              <div style={{ overflow: "hidden", minHeight: 0 }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6, opacity: 0.7 }}>
                                  {_collapsedDoneTasks.map(t => renderRow(t, "today"))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {/* Completed section removed — done tasks now render inline above with strikethrough state. */}
                </div>

              {/* CALENDAR — right column on desktop (>900px). Mobile gets the strip instead.
                  Now wired to the today timeline: dynamic hour window, NOW marker, manual
                  events with inline composer. Google events will render alongside manual
                  ones once sync ships. */}
              <div className="rt-focus-col" style={{ gridArea: "focus", display: "flex", flexDirection: "column", position: "sticky", top: 20 }}>
                <div style={{ background: C.card, borderRadius: 14, boxShadow: "var(--rt-sh-card)", padding: "14px 16px" }}>
                  <TodayTimeline
                    events={personalEvents}
                    C={C}
                    showHeader={true}
                    compact={false}
                    googleConnected={false}
                        onConnectClick={() => setPage("settings")}
                        promptDismissed={googleCalPromptDismissed}
                        onDismissConnectPrompt={dismissGoogleCalPrompt}
                    onCreate={async (entry) => {
                      const optimistic = { id: `tmp-${Date.now()}`, source: "manual", ...entry };
                      setPersonalEvents(prev => [...prev, optimistic].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)));
                      const { data, error } = await personalCalendarDb.create(user.id, entry);
                      if (error) {
                        console.error("Calendar create failed:", error);
                        setPersonalEvents(prev => prev.filter(e => e.id !== optimistic.id));
                        return;
                      }
                      setPersonalEvents(prev => prev.map(e => e.id === optimistic.id ? data : e).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)));
                    }}
                    onUpdate={async (id, patch) => {
                      // Optimistic move/resize. Capture prev so we can
                      // roll back if the server rejects the update.
                      const prev = personalEvents;
                      setPersonalEvents(prev.map(e => e.id === id ? { ...e, ...patch } : e).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)));
                      const { error } = await personalCalendarDb.update(id, patch);
                      if (error) {
                        console.error("Calendar update failed:", error);
                        setPersonalEvents(prev);
                      }
                    }}
                    onDelete={async (id) => {
                      const prev = personalEvents;
                      setPersonalEvents(prev.filter(e => e.id !== id));
                      const { error } = await personalCalendarDb.remove(id);
                      if (error) {
                        console.error("Calendar delete failed:", error);
                        setPersonalEvents(prev);
                      }
                    }}
                  />
                </div>
              </div>

              {/* DAYBOOK COLUMN — wide desktop only (>=1440px). Right-rail notepad. */}
              <div className="rt-rai-col" style={{ gridArea: "rai", display: "none", flexDirection: "column", gap: 16, position: "sticky", top: 20, alignSelf: "start" }}>
                <DaybookPanel
                  entry={daybookEntry}
                  yesterday={daybookYesterday}
                  saveStatus={daybookSaveStatus}
                  onChange={handleDaybookChange}
                />
              </div>

              {/* CONFETTI */}
              {confetti && (
                <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 200, overflow: "hidden" }}>
                  {Array.from({ length: 18 }).map((_, i) => {
                    const x = 40 + Math.random() * 20;
                    const tx = (Math.random() - 0.5) * 60;
                    const rot = Math.random() * 540;
                    const dur = 900 + Math.random() * 600;
                    const delay = Math.random() * 120;
                    const colors = [C.primary, C.primaryLight, "#4FB896", C.btn, "#D17A1B", C.retElite];
                    const c = colors[i % colors.length];
                    return (
                      <span key={i} style={{
                        position: "absolute", top: "40%", left: `${x}%`,
                        width: 8, height: 12, background: c, borderRadius: 2,
                        animation: `confetti-fall ${dur}ms cubic-bezier(.2,.6,.3,1) ${delay}ms forwards`,
                        "--tx": `${tx}vw`, "--rot": `${rot}deg`,
                      }} />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* ═══ SWEEPS (ENTERPRISE) ═══ */}
        {page === "sweeps" && tier === "enterprise" && (
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 4 }}>Sweeps</h1>
            <p style={{ fontSize: 14, color: C.textMuted, marginBottom: 16 }}>Daily Sweep · April 9, 2026 · 6:02 AM · {sweepData.clients_analyzed} clients · {sweepData.alerts_count} alerts · {sweepData.tasks_generated} tasks generated</p>

            {/* Alerts */}
            {sweepTasks.filter(t => t.priority === "urgent").length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.danger, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>🚨 Alerts ({sweepTasks.filter(t => t.priority === "urgent").length})</div>
                {sweepTasks.filter(t => t.priority === "urgent").map(t => (
                  <div key={t.id} style={{ background: "#FAE8E4", borderRadius: 12, border: "1px solid " + C.danger + "33", padding: "14px 16px", marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.danger }}>CRITICAL · {t.client}</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>{t.signal}</div>
                    <p style={{ fontSize: 14, color: C.text, lineHeight: 1.5 }}>{t.action}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Priority Ranking */}
            <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Priority Ranking</div>
            <div style={{ background: C.card, borderRadius: 14, overflow: "hidden" }}>
              {/* Header row */}
              <div style={{ display: "flex", padding: "10px 16px", borderBottom: "1px solid " + C.border, fontSize: 12, fontWeight: 600, color: C.textMuted }}>
                <span style={{ width: 28 }}>#</span>
                <span style={{ flex: 1 }}>Client</span>
                <span style={{ width: 50, textAlign: "right" }}>Score</span>
                <span style={{ width: 50, textAlign: "right" }}>Drift</span>
                <span style={{ width: 80, textAlign: "right" }}>Outlook</span>
                <span style={{ width: 90, textAlign: "right", display: "none" }} className="r-desk-inline">Archetype</span>
              </div>
              {[...enterpriseClients].sort((a, b) => b.ret - a.ret).map((c, i) => {
                const e = c.enterprise;
                const drift = c.ret - e.prior_baseline;
                const outlookLabel = { long_term: "Long-term", strong: "Strong", uncertain: "Uncertain", at_risk: "At Risk", critical: "Critical" }[e.retention_outlook] || "";
                const archLabel = { slow_fade: "Slow Fade", tone_shift: "Tone Shift", silent_exit: "Silent Exit", budget_squeeze: "Budget Sq." }[e.archetype] || "";
                const scoreColor = c.ret > 80 ? C.success : c.ret > 65 ? C.text : c.ret > 50 ? C.warning : c.ret > 30 ? "#D97706" : C.danger;
                return (
                  <div key={c.id} className="row-hover" onClick={() => { setSelectedClient(c); setClientTab("overview"); }} style={{ display: "flex", padding: "12px 16px", borderBottom: i < enterpriseClients.length - 1 ? "1px solid " + C.borderLight : "none", alignItems: "center" }}>
                    <span style={{ width: 28, fontSize: 12, color: C.textMuted }}>{i + 1}</span>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</span>
                      <div style={{ fontSize: 12, color: C.textMuted }}>{c.contact}</div>
                    </div>
                    <span style={{ width: 50, textAlign: "right", fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: scoreColor }}>{c.ret}</span>
                    <span style={{ width: 50, textAlign: "right", fontSize: 12, fontWeight: 600, color: drift > 0 ? C.success : drift < 0 ? C.danger : C.textMuted }}>{drift > 0 ? "+" : ""}{drift} {drift > 0 ? "↑" : drift < 0 ? "↓" : "—"}</span>
                    <span style={{ width: 80, textAlign: "right", fontSize: 12, fontWeight: 600, color: scoreColor }}>{outlookLabel}</span>
                  </div>
                );
              })}
            </div>

            {/* Tasks from Sweep */}
            <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8, marginTop: 20 }}>Tasks Generated ({sweepTasks.length})</div>
            {sweepTasks.filter(t => t.priority !== "urgent").map(t => (
              <div key={t.id} style={{ background: C.card, borderRadius: 12, padding: "14px 16px", marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{t.client}</span>
                  <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 4, fontWeight: 600, background: t.priority === "high" ? "#FEF3C7" : C.primarySoft, color: t.priority === "high" ? "#D97706" : C.primary }}>{t.priority === "high" ? "High" : "Medium"} · {t.timeframe}</span>
                </div>
                <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>{t.signal}</div>
                <p style={{ fontSize: 14, color: C.text, lineHeight: 1.5 }}>{t.action}</p>
              </div>
            ))}

            {/* Sweep History */}
            <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8, marginTop: 20 }}>Previous Sweeps</div>
            <div style={{ background: C.card, borderRadius: 14, overflow: "hidden" }}>
              {sweepHistory.map((s, i) => (
                <div key={i} style={{ padding: "12px 16px", borderBottom: i < sweepHistory.length - 1 ? "1px solid " + C.borderLight : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{s.date}</span>
                  <span style={{ fontSize: 12, color: C.textMuted }}>{s.clients} clients · Avg: {s.avg} · {s.alerts} alert{s.alerts !== 1 ? "s" : ""}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ CLIENTS v2 — compare-first ═══ */}
        {page === "clients" && (() => {
          // ─── Stubs for v2-specific per-client fields ──────────────────────
          // Real data lives in clients[]: name, ret, contact, role, months, revenue, velocity, lastHC, lastContact, tag
          // Stubs provide: owner + ownerColor, cadence target/actual, 12-week trend array, score delta, stage bucket, renewal days
          const hashStr = (s) => (s || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
          const stubDelta = (clientName) => {
            if (!clientName) return 0;
            return (hashStr(clientName) % 11) - 5;
          };
          const OWNERS = [
            { name: "Ana K.",    color: "#2C9A76" },
            { name: "Dev R.",    color: "#D17A1B" },
            { name: "Jordan P.", color: "#6D2BD9" },
            { name: "Sam L.",    color: "#1F7A5C" },
          ];
          const stubOwner = (name) => OWNERS[hashStr(name) % OWNERS.length];
          const stubCadenceTarget = (c) => {
            const h = hashStr(c.name);
            return (h % 3 === 0) ? 14 : 7; // weekly or biweekly target
          };
          const stubCadenceActual = (c) => {
            // derive from lastContact if available, else pseudo
            const lc = (c.lastContact || "").toLowerCase();
            if (lc.includes("today")) return 1;
            const m = lc.match(/(\d+)\s*d/);
            if (m) return parseInt(m[1], 10);
            return (hashStr(c.name) % 20) + 5;
          };
          const stubTrend = (c) => {
            // 12-week synthetic revenue trend keyed to current score direction
            const base = c.revenue || 5000;
            const delta = stubDelta(c.name);
            const direction = delta > 1 ? 1 : delta < -1 ? -1 : 0;
            const pts = [];
            for (let i = 0; i < 12; i++) {
              const progress = i / 11;
              const shift = direction * base * 0.08 * progress;
              const wobble = Math.sin((i + hashStr(c.name)) * 1.1) * base * 0.01;
              pts.push(Math.round(base - direction * base * 0.08 + shift + wobble));
            }
            pts[pts.length - 1] = base;
            return pts;
          };
          const stubStage = (score) => score >= 80 ? "thriving" : score >= 65 ? "healthy" : score >= 45 ? "watch" : score >= 30 ? "at-risk" : "critical";
          const stubRenewal = (c) => {
            const h = hashStr(c.name);
            const days = (h % 180) + 5; // 5-184 days
            return days < 30 ? `${days}d` : `${Math.round(days / 30)}mo`;
          };
          const stubRenewalDays = (c) => (hashStr(c.name) % 180) + 5;
          const cadenceHealth = (target, actual) => {
            const drift = Math.abs(actual - target) / target;
            if (drift <= 0.2) return "on-track";
            if (drift <= 0.5) return "slipping";
            return "broken";
          };

          // ─── v2 Primitives (local to Clients page) ─────────────────────────
          const ScoreRing2 = ({ client, size = 38 }) => {
            const r = (size - 4) / 2;
            const circ = 2 * Math.PI * r;
            const score = client.ret || 60;
            const pct = Math.max(0, Math.min(1, score / 100));
            const color = retColor(score);
            const initials = (client.name || "?").split(/\s|&/).filter(Boolean).slice(0, 2).map(s => s[0]).join("").toUpperCase();
            return (
              <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
                <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
                  <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.borderLight} strokeWidth="2" />
                  <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"
                    strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} />
                </svg>
                <div style={{
                  position: "absolute", inset: 3, borderRadius: "50%",
                  background: color, color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: size * 0.28, fontWeight: 700, letterSpacing: 0.2,
                }}>{initials}</div>
              </div>
            );
          };

          const V2Sparkline = ({ points, width = 72, height = 22, stroke, fill, showEnd = false, responsive = false }) => {
            if (!points || points.length === 0) return null;
            const min = Math.min(...points);
            const max = Math.max(...points);
            const range = max - min || 1;
            const pad = 1.5;
            const w = width - pad * 2;
            const h = height - pad * 2;
            const coords = points.map((p, i) => {
              const x = pad + (i / (points.length - 1)) * w;
              const y = pad + h - ((p - min) / range) * h;
              return [x, y];
            });
            const path = coords.map((c, i) => (i === 0 ? `M${c[0]},${c[1]}` : `L${c[0]},${c[1]}`)).join(" ");
            const area = `${path} L${coords[coords.length-1][0]},${pad+h} L${coords[0][0]},${pad+h} Z`;
            const last = coords[coords.length - 1];
            const first = points[0], lastV = points[points.length - 1];
            const dir = lastV > first ? "up" : lastV < first ? "dn" : "flat";
            const auto = dir === "up" ? C.retGood : dir === "dn" ? C.retWarn : C.textMuted;
            const sColor = stroke || auto;
            // Responsive mode: SVG fills its parent container width via CSS (100%).
            // viewBox is always set so internal coordinates remain stable. This is
            // used in the columns view where each card width depends on the
            // bucket column width and we don't want the sparkline overflowing.
            const svgWidth = responsive ? "100%" : width;
            const svgHeight = responsive ? "100%" : height;
            return (
              <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: "block" }}>
                {fill && <path d={area} fill={sColor} fillOpacity={0.08} />}
                <path d={path} fill="none" stroke={sColor} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                {showEnd && <circle cx={last[0]} cy={last[1]} r={1.8} fill={sColor} />}
              </svg>
            );
          };

          const CadencePips = ({ target, actual, showLabel = false }) => {
            const health = cadenceHealth(target, actual);
            const color = health === "on-track" ? C.retGood : health === "slipping" ? C.retOk : C.retWarn;
            const dots = [
              { filled: true, color: C.borderLight },
              { filled: true, color: health === "on-track" ? color : C.borderLight },
              { filled: health !== "broken", color },
            ];
            const label = health === "on-track" ? "On rhythm" : health === "slipping" ? `${actual}d cadence` : `${actual}d silent`;
            return (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <div style={{ display: "inline-flex", gap: 2 }}>
                  {dots.map((d, i) => (
                    <span key={i} style={{
                      width: 5, height: 5, borderRadius: 3,
                      background: d.filled ? d.color : "transparent",
                      border: d.filled ? "none" : `1px solid ${d.color}`,
                    }} />
                  ))}
                </div>
                {showLabel && <span style={{ fontSize: 11, color, fontWeight: 500 }}>{label}</span>}
              </div>
            );
          };

          const OwnerChip = ({ owner, color, size = "md", showLabel = true, firstOnly = false }) => {
            const dim = size === "sm" ? 18 : 22;
            const initials = owner.split(" ").map(s => s[0]).join("").slice(0, 2);
            const display = firstOnly ? owner.split(" ")[0] : owner;
            return (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                <div style={{
                  width: dim, height: dim, borderRadius: dim / 2, flexShrink: 0,
                  background: color, color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: size === "sm" ? 9 : 10, fontWeight: 700, letterSpacing: 0.2,
                }}>{initials}</div>
                {showLabel && <span style={{ fontSize: 11.5, color: C.textSec, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{display}</span>}
              </div>
            );
          };

          // ─── Aggregates ────────────────────────────────────────────────────
          const activeClients = clients || [];
          const avgScore = activeClients.length ? Math.round(activeClients.reduce((a, c) => a + (c.ret || 0), 0) / activeClients.length) : 0;
          const totalMRR = activeClients.reduce((a, c) => a + (c.revenue || 0), 0);
          const byStage = {
            thriving: activeClients.filter(c => stubStage(c.ret || 0) === "thriving").length,
            healthy:  activeClients.filter(c => stubStage(c.ret || 0) === "healthy").length,
            watch:    activeClients.filter(c => stubStage(c.ret || 0) === "watch").length,
            atRisk:   activeClients.filter(c => stubStage(c.ret || 0) === "at-risk").length,
            critical: activeClients.filter(c => stubStage(c.ret || 0) === "critical").length,
          };
          // Drift counts for filter-chip badges. Missing drift_status defaults to "Stable".
          const byDrift = {
            Improving: activeClients.filter(c => (c.drift_status || "Stable") === "Improving").length,
            Stable:    activeClients.filter(c => (c.drift_status || "Stable") === "Stable").length,
            "Something shifted": activeClients.filter(c => (c.drift_status || "Stable") === "Something shifted").length,
            Declining: activeClients.filter(c => (c.drift_status || "Stable") === "Declining").length,
            "At risk": activeClients.filter(c => (c.drift_status || "Stable") === "At risk").length,
          };
          const portfolioTrend = activeClients.reduce((a, c) => {
            const t = stubTrend(c);
            return a + (t[t.length - 1] - t[0]);
          }, 0);
          const trendPct = totalMRR > 0 ? (portfolioTrend / Math.max(1, totalMRR - portfolioTrend)) * 100 : 0;
          const climbing = [...activeClients]
            .map(c => ({ c, d: stubDelta(c.name) }))
            .filter(x => x.d >= 2)
            .sort((a, b) => b.d - a.d).slice(0, 3);
          const slipping = [...activeClients]
            .map(c => ({ c, d: stubDelta(c.name) }))
            .filter(x => x.d <= -2)
            .sort((a, b) => a.d - b.d).slice(0, 3);
          const longestClient = [...activeClients].sort((a, b) => (b.months || 0) - (a.months || 0))[0];

          // ─── Sort + filter ─────────────────────────────────────────────────
          const sortId = clientsSort || "retention";
          const filteredClients = (() => {
            let xs = activeClients;
            const q = (clientSearch || "").trim().toLowerCase();
            if (q) {
              xs = xs.filter(c =>
                c.name.toLowerCase().includes(q) ||
                (c.contact || "").toLowerCase().includes(q) ||
                (c.tag || "").toLowerCase().includes(q) ||
                stubOwner(c.name).name.toLowerCase().includes(q)
              );
            }
            // Drift filter — exact match against c.drift_status. "all" passes everything.
            if (clientsDriftFilter !== "all") {
              xs = xs.filter(c => (c.drift_status || "Stable") === clientsDriftFilter);
            }
            // Score-bucket filter — bands match the Drift Wall thresholds.
            if (clientsScoreFilter !== "all") {
              xs = xs.filter(c => {
                const s = c.ret || 0;
                if (clientsScoreFilter === "thriving") return s >= 80;
                if (clientsScoreFilter === "healthy")  return s >= 65 && s < 80;
                if (clientsScoreFilter === "watch")    return s >= 45 && s < 65;
                if (clientsScoreFilter === "atrisk")   return s < 45;
                return true;
              });
            }
            const copy = [...xs];
            // Retention: highest score first (your healthiest clients at top).
            // Use "Attention" sort for inverse — who needs help most.
            if (sortId === "retention") copy.sort((a, b) => (b.ret || 0) - (a.ret || 0));
            else if (sortId === "attention") copy.sort((a, b) => (a.ret || 0) - (b.ret || 0));
            else if (sortId === "revenue") copy.sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
            else if (sortId === "trend") {
              const pct = c => {
                const t = stubTrend(c);
                return ((t[t.length - 1] - t[0]) / Math.max(1, t[0])) * 100;
              };
              copy.sort((a, b) => pct(b) - pct(a)); // flipped — green top → red bottom
            }
            else if (sortId === "cadence") {
              const drift = c => Math.abs(stubCadenceActual(c) - stubCadenceTarget(c)) / stubCadenceTarget(c);
              copy.sort((a, b) => drift(b) - drift(a));
            }
            else if (sortId === "renewal") copy.sort((a, b) => stubRenewalDays(a) - stubRenewalDays(b));
            else if (sortId === "alpha") copy.sort((a, b) => a.name.localeCompare(b.name));
            return copy;
          })();

          const variant = clientsView || "table";
          const sortOptions = [
            { id: "retention",  label: "Retention" },
            { id: "revenue",    label: "Revenue" },
            { id: "trend",      label: "Trend" },
            { id: "cadence",    label: "Cadence" },
            { id: "renewal",    label: "Renewal" },
            { id: "alpha",      label: "A–Z" },
          ];
          const viewOptions = [
            { id: "table",   label: "Table",   icon: "sweeps" },
            { id: "columns", label: "Columns", icon: "bento" },
            { id: "heatmap", label: "Cards", icon: "heatmapGrid" },
          ];

          return (
            <div style={{ width: "100%" }}>
              {/* STATUS BAND */}
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "4px 4px 20px", marginBottom: 20, borderBottom: "1px solid " + C.borderLight }}>
                <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                  <div style={{ fontSize: 11.5, color: C.textMuted, letterSpacing: 0.3, marginBottom: 4 }}>Your portfolio</div>
                  <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: -0.4, color: C.text }}>Clients</h1>
                  <div style={{ fontSize: 13.5, color: C.textMuted, marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span><b style={{ color: C.text, fontWeight: 700 }}>{activeClients.length}</b> active</span>
                    <span style={{ color: C.border }}>·</span>
                    <span><b style={{ color: C.text, fontWeight: 700 }}>${(totalMRR/1000).toFixed(1)}k</b> /mo</span>
                    <span style={{ color: C.border }}>·</span>
                    <span><b style={{ color: retColor(avgScore), fontWeight: 700 }}>{avgScore}</b> avg</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  {tier === "enterprise" && (
                    <button
                      onClick={() => { setShowImport(!showImport); setShowAddClient(false); }}
                      style={{ padding: "8px 14px", background: "transparent", color: C.primary, border: "1px solid " + C.primary + "44", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", transition: "background 120ms ease, border-color 120ms ease" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(51,84,62,0.06)"; e.currentTarget.style.borderColor = C.primary + "88"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = C.primary + "44"; }}
                    >Import Clients</button>
                  )}
                  <button className="r-btn" data-tone="purple" onClick={() => { setShowAddClient(true); setShowImport(false); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", background: C.btn, color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 1px 2px rgba(91,33,182,0.15), 0 2px 6px rgba(91,33,182,0.22)", whiteSpace: "nowrap" }}>
                    Add Client
                  </button>
                </div>
              </div>

              {/* MAIN GRID: rail + main + rai (rai shows on >=1440px) */}
              <div className="rc-grid" style={{ display: "grid", gap: 20, alignItems: "start" }}>

                {/* LEFT RAIL — Portfolio, Book history, Recent movement (3 separate cards) */}
                <div className="rc-rail" style={{ position: "sticky", top: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* Card 1: Portfolio */}
                  <div style={{ background: C.card, borderRadius: 12, boxShadow: "var(--rt-sh-card)", padding: "14px" }}>
                    <div style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 10 }}>Portfolio</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                      <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
                        <svg width={64} height={64} style={{ transform: "rotate(-90deg)" }}>
                          <circle cx={32} cy={32} r={28} fill="none" stroke={C.borderLight} strokeWidth="3" />
                          <circle cx={32} cy={32} r={28} fill="none" stroke={retColor(avgScore)} strokeWidth="3" strokeLinecap="round"
                            strokeDasharray={2 * Math.PI * 28} strokeDashoffset={2 * Math.PI * 28 * (1 - avgScore / 100)} />
                        </svg>
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <div style={{ fontSize: 19, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums", letterSpacing: -0.3, lineHeight: 1 }}>{avgScore}</div>
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                          <span style={{ fontSize: 11.5, color: C.textMuted }}>Clients</span>
                          <span style={{ fontSize: 12, color: C.textSec, fontVariantNumeric: "tabular-nums" }}>{activeClients.length}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                          <span style={{ fontSize: 11.5, color: C.textMuted }}>MRR</span>
                          <span style={{ fontSize: 12, color: C.text, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>${(totalMRR/1000).toFixed(1)}k</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                          <span style={{ fontSize: 11.5, color: C.textMuted }}>Avg health</span>
                          <span style={{ fontSize: 12, color: retColor(avgScore), fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{avgScore}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", height: 4, borderRadius: 2, overflow: "hidden", gap: 1, marginBottom: 10 }} title={`Thriving ${byStage.thriving} · Healthy ${byStage.healthy} · Watch ${byStage.watch} · At risk ${byStage.atRisk} · Critical ${byStage.critical}`}>
                      {byStage.thriving > 0 && <div style={{ flex: byStage.thriving, background: C.retElite }} />}
                      {byStage.healthy > 0  && <div style={{ flex: byStage.healthy,  background: C.retGood }} />}
                      {byStage.watch > 0    && <div style={{ flex: byStage.watch,    background: C.retOk }} />}
                      {byStage.atRisk > 0   && <div style={{ flex: byStage.atRisk,   background: C.retWarn }} />}
                      {byStage.critical > 0 && <div style={{ flex: byStage.critical, background: C.retCrit }} />}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {[
                        { color: C.retElite, num: byStage.thriving, label: "Thriving" },
                        { color: C.retGood,  num: byStage.healthy,  label: "Healthy" },
                        { color: C.retOk,    num: byStage.watch,    label: "Watch" },
                        { color: C.retWarn,  num: byStage.atRisk,   label: "At risk" },
                        { color: C.retCrit,  num: byStage.critical, label: "Critical" },
                      ].map((s, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                          <span style={{ width: 6, height: 6, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums", minWidth: 16 }}>{s.num}</span>
                          <span style={{ fontSize: 11, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card 2: Book history */}
                  <div style={{ background: C.card, borderRadius: 12, boxShadow: "var(--rt-sh-card)", padding: "14px" }}>
                    <div style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 10 }}>Book history</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 19, fontWeight: 700, color: C.text, letterSpacing: -0.3, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                          ${(activeClients.reduce((a, c) => a + Number(c.ltv || 0), 0) / 1000000).toFixed(1)}M
                        </div>
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, letterSpacing: 0.1 }}>Lifetime rev</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 19, fontWeight: 700, color: C.text, letterSpacing: -0.3, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                          {activeClients.length ? (activeClients.reduce((a, c) => a + (c.months || 0), 0) / activeClients.length / 12).toFixed(1) : "0"} yr
                        </div>
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, letterSpacing: 0.1 }}>Avg tenure</div>
                      </div>
                    </div>
                    {longestClient && (
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6, paddingTop: 10, borderTop: "1px solid " + C.borderLight, fontSize: 11 }}>
                        <span style={{ color: C.textMuted }}>Longest</span>
                        <span style={{ color: C.text, fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{longestClient.name}</span>
                        <span style={{ color: C.textMuted, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{((longestClient.months || 0) / 12).toFixed(1)} yr</span>
                      </div>
                    )}
                  </div>

                  {/* Card 3: Recent movement */}
                  <div style={{ background: C.card, borderRadius: 12, boxShadow: "var(--rt-sh-card)", padding: "14px" }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
                      <span style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>Recent movement</span>
                      <span style={{ fontSize: 10.5, color: C.textMuted, letterSpacing: 0.2 }}>7d</span>
                    </div>
                    {climbing.length > 0 && (
                      <>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 6, color: C.retElite }}>Climbing</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: climbing.length && slipping.length ? 10 : 0 }}>
                          {climbing.map(({ c, d }) => (
                            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                              <ScoreRing2 client={c} size={22} />
                              <span style={{ fontSize: 12, color: C.text, fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                              <span style={{ fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums", flexShrink: 0, color: C.retGood }}>+{d}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    {slipping.length > 0 && (
                      <>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 6, color: C.retWarn }}>Slipping</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          {slipping.map(({ c, d }) => (
                            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                              <ScoreRing2 client={c} size={22} />
                              <span style={{ fontSize: 12, color: C.text, fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                              <span style={{ fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums", flexShrink: 0, color: C.retWarn }}>{d}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    {climbing.length === 0 && slipping.length === 0 && (
                      <div style={{ fontSize: 12, color: C.textMuted, fontStyle: "italic" }}>No significant movement this week.</div>
                    )}
                  </div>
                </div>

                {/* MAIN COLUMN */}
                <div style={{ minWidth: 0 }}>

                  {/* Import & Add Client — unchanged blocks, preserved as-is */}
            {showImport && tier === "enterprise" && (
              <div style={{ background: C.card, borderRadius: 14, border: "1.5px solid " + C.primary, padding: "20px", marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Import Clients</div>
                  <button onClick={() => { setShowImport(false); setImportPreview([]); setImportPaste(""); setImportFile(null); }} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: C.textMuted }}>×</button>
                </div>

                {/* Tab toggle */}
                <div style={{ display: "flex", gap: 0, marginBottom: 16, background: C.surface, borderRadius: 8, padding: 3 }}>
                  {[{ id: "csv", label: "Upload CSV" }, { id: "paste", label: "Paste from Spreadsheet" }].map(t => (
                    <button key={t.id} onClick={() => { setImportTab(t.id); setImportPreview([]); }} style={{ flex: 1, padding: "8px", borderRadius: 6, border: "none", background: importTab === t.id ? C.card : "transparent", color: importTab === t.id ? C.text : C.textMuted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", boxShadow: importTab === t.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>{t.label}</button>
                  ))}
                </div>

                {/* CSV Upload */}
                {importTab === "csv" && (
                  <div>
                    <div
                      onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = C.primary; }}
                      onDragLeave={e => { e.currentTarget.style.borderColor = C.border; }}
                      onDrop={e => {
                        e.preventDefault();
                        e.currentTarget.style.borderColor = C.border;
                        const file = e.dataTransfer.files[0];
                        if (file && file.name.endsWith(".csv")) {
                          setImportFile(file);
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const lines = ev.target.result.split("\n").filter(l => l.trim());
                            const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
                            const rows = lines.slice(1).map(line => {
                              const cols = line.split(",").map(c => c.trim().replace(/"/g, ""));
                              return { name: cols[0] || "", contact: cols[1] || "", email: cols[2] || "", role: cols[3] || "", tag: cols[4] || "", revenue: parseInt(cols[5]) || 0, months: parseInt(cols[6]) || 0, valid: !!(cols[0] && cols[1] && cols[2]) };
                            });
                            setImportPreview(rows);
                          };
                          reader.readAsText(file);
                        }
                      }}
                      style={{ border: "2px dashed " + C.border, borderRadius: 10, padding: "32px 20px", textAlign: "center", marginBottom: 12, transition: "border-color 0.2s" }}
                    >
                      {importFile ? (
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>📄 {importFile.name}</div>
                          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{importPreview.length} rows found</div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: 24, marginBottom: 8 }}>📁</div>
                          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Drag & drop your CSV here</div>
                          <div style={{ fontSize: 12, color: C.textMuted }}>or <label style={{ color: C.primary, cursor: "pointer", fontWeight: 600 }}>browse files<input type="file" accept=".csv" style={{ display: "none" }} onChange={e => {
                            const file = e.target.files[0];
                            if (file) {
                              setImportFile(file);
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                const lines = ev.target.result.split("\n").filter(l => l.trim());
                                const rows = lines.slice(1).map(line => {
                                  const cols = line.split(",").map(c => c.trim().replace(/"/g, ""));
                                  return { name: cols[0] || "", contact: cols[1] || "", email: cols[2] || "", role: cols[3] || "", tag: cols[4] || "", revenue: parseInt(cols[5]) || 0, months: parseInt(cols[6]) || 0, valid: !!(cols[0] && cols[1] && cols[2]) };
                                });
                                setImportPreview(rows);
                              };
                              reader.readAsText(file);
                            }
                          }} /></label></div>
                          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>Expected columns: Business Name, Contact Name, Email, Role, Industry, Revenue, Months</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Paste from Spreadsheet */}
                {importTab === "paste" && (
                  <div>
                    <textarea
                      value={importPaste}
                      onChange={e => {
                        setImportPaste(e.target.value);
                        const lines = e.target.value.split("\n").filter(l => l.trim());
                        const rows = lines.map(line => {
                          const cols = line.split(/\t|,/).map(c => c.trim().replace(/"/g, ""));
                          return { name: cols[0] || "", contact: cols[1] || "", email: cols[2] || "", role: cols[3] || "", tag: cols[4] || "", revenue: parseInt(cols[5]) || 0, months: parseInt(cols[6]) || 0, valid: !!(cols[0] && cols[1] && cols[2]) };
                        });
                        setImportPreview(rows);
                      }}
                      placeholder={"Business Name\tContact Name\tEmail\tRole\tIndustry\tRevenue\tMonths\nAcme Corp\tJane Smith\tjane@acme.com\tCMO\tSaaS\t5000\t12"}
                      rows={6}
                      style={{ width: "100%", padding: "12px 14px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "monospace", outline: "none", background: C.surfaceWarm, resize: "vertical", lineHeight: 1.6 }}
                    />
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 6 }}>Paste rows from Excel or Google Sheets. Tab or comma-separated. First 3 columns required.</div>
                  </div>
                )}

                {/* Preview Table */}
                {importPreview.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Preview ({importPreview.filter(r => r.valid).length} valid of {importPreview.length})</div>
                    <div style={{ background: C.bg, borderRadius: 10, overflow: "hidden" }}>
                      {/* Header */}
                      <div style={{ display: "flex", padding: "8px 12px", borderBottom: "1px solid " + C.border, fontSize: 12, fontWeight: 600, color: C.textMuted }}>
                        <span style={{ width: 24 }}></span>
                        <span style={{ flex: 2, minWidth: 0 }}>Business</span>
                        <span style={{ flex: 2, minWidth: 0 }}>Contact</span>
                        <span style={{ flex: 2, minWidth: 0 }}>Email</span>
                        <span style={{ flex: 1, minWidth: 0 }}>Role</span>
                      </div>
                      {importPreview.slice(0, 10).map((r, i) => (
                        <div key={i} style={{ display: "flex", padding: "8px 12px", borderBottom: i < Math.min(importPreview.length, 10) - 1 ? "1px solid " + C.borderLight : "none", fontSize: 12, alignItems: "center" }}>
                          <span style={{ width: 24, color: r.valid ? C.success : C.danger, fontWeight: 700 }}>{r.valid ? "✓" : "✗"}</span>
                          <span style={{ flex: 2, minWidth: 0, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name || "—"}</span>
                          <span style={{ flex: 2, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.contact || "—"}</span>
                          <span style={{ flex: 2, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: C.textMuted }}>{r.email || "—"}</span>
                          <span style={{ flex: 1, minWidth: 0, color: C.textMuted }}>{r.role || "—"}</span>
                        </div>
                      ))}
                      {importPreview.length > 10 && (
                        <div style={{ padding: "8px 12px", fontSize: 12, color: C.textMuted, textAlign: "center" }}>+ {importPreview.length - 10} more rows</div>
                      )}
                    </div>
                    {importPreview.some(r => !r.valid) && (
                      <div style={{ fontSize: 12, color: C.danger, marginTop: 6 }}>{importPreview.filter(r => !r.valid).length} row{importPreview.filter(r => !r.valid).length > 1 ? "s" : ""} missing required fields (Business Name, Contact Name, Email) — will be skipped</div>
                    )}
                  </div>
                )}

                {/* Actions */}
                {importPreview.filter(r => r.valid).length > 0 && (
                  <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                    <button className="r-btn" data-tone="purple" onClick={async () => {
                      // BEFORE THIS FIX: import wrote only to local React state. Imported
                      // clients appeared in the list, then vanished on refresh because
                      // nothing was persisted to Supabase. Same exact failure mode as
                      // the rolodex move-to-rolodex bug.
                      //
                      // Now we persist each valid row through clientsDb.create, then
                      // also seed an initial client_revenue_history row when revenue>0
                      // so LTV math is correct from minute one. Parallel insert via
                      // Promise.allSettled so a single failure doesn't block the rest.
                      const validRows = importPreview.filter(r => r.valid);
                      const todayIsoDate = localYmd();
                      const todayMs = Date.now();
                      const MS_PER_MONTH = 30.44 * 24 * 60 * 60 * 1000;

                      // Optimistic UI: insert with temp negative IDs so we can swap
                      // them for real DB IDs once the inserts return. Negative IDs
                      // can't collide with real UUIDs.
                      const tempBase = -todayMs;
                      const optimistic = validRows.map((r, idx) => ({
                        id: tempBase - idx,
                        _isTemp: true,
                        name: r.name,
                        contact: r.contact,
                        role: r.role || "",
                        tag: r.tag || "",
                        months: r.months || 0,
                        revenue: r.revenue || 0,
                        lifetime_revenue_at_entry: 0,
                        ltv: 0,
                        velocity: "normal",
                        lastHC: null,
                        lastContact: "today",
                        ret: 50,
                        referrals: 0,
                        profileScores: {},
                        qualifyingFlags: {},
                        daysOld: 0,
                        is_paused: false,
                        engagement_started_at: localYmd(new Date(todayMs - (r.months || 0) * MS_PER_MONTH)),
                      }));
                      setClients(prev => [...prev, ...optimistic]);
                      setShowImport(false);
                      setImportPreview([]);
                      setImportPaste("");
                      setImportFile(null);

                      // Persist each row. Track successes + failures so we can
                      // reconcile the local state with what actually landed.
                      const results = await Promise.allSettled(
                        validRows.map(async (r) => {
                          const tenureMonths = parseInt(r.months) || 0;
                          const monthlyRate = parseInt(r.revenue) || 0;
                          const engagementStart = localYmd(new Date(todayMs - tenureMonths * MS_PER_MONTH));
                          const payload = {
                            name: r.name,
                            contact: r.contact || "",
                            role: r.role || "",
                            tag: r.tag || "",
                            revenue: monthlyRate,
                            months: tenureMonths, // legacy field; engagement_started_at is the truth
                            engagement_started_at: engagementStart,
                            lifetime_revenue_at_entry: 0,
                            retention_score: 50,
                            profile_scores: {},
                            qualifying_flags: {},
                          };
                          const { data: created, error } = await clientsDb.create(user.id, payload);
                          if (error) throw error;
                          // Seed initial revenue history row when there's a rate.
                          // Without this, LTV math has no anchor and Rai signals
                          // about revenue won't surface for imported clients.
                          if (created?.id && monthlyRate > 0) {
                            try {
                              await supabase.from('client_revenue_history').insert({
                                user_id: user.id,
                                client_id: created.id,
                                monthly_rate: monthlyRate,
                                started_at: new Date().toISOString(),
                                ended_at: null,
                              });
                            } catch (e) {
                              // Non-fatal — client exists; revenue history can
                              // be filled in later through the UI.
                              console.warn("Revenue history seed failed for imported client:", e);
                            }
                          }
                          return { rowName: r.name, created };
                        })
                      );

                      // Reconcile: swap optimistic temp IDs for real DB IDs on
                      // successes; remove temp rows for failures.
                      const succeeded = [];
                      const failed = [];
                      results.forEach((res, idx) => {
                        const tempId = tempBase - idx;
                        if (res.status === "fulfilled" && res.value.created) {
                          succeeded.push({ tempId, real: res.value.created });
                        } else {
                          failed.push({ tempId, rowName: validRows[idx].name, reason: res.reason });
                        }
                      });

                      setClients(prev => {
                        const tempIds = new Set([
                          ...succeeded.map(s => s.tempId),
                          ...failed.map(f => f.tempId),
                        ]);
                        // Drop ALL temp rows first
                        const kept = prev.filter(c => !tempIds.has(c.id));
                        // Add back the succeeded ones with real DB shape
                        const realRows = succeeded.map(s => ({
                          ...s.real,
                          contact: s.real.contact || "",
                          role: s.real.role || "",
                          tag: s.real.tag || "",
                          months: s.real.months || 0,
                          revenue: s.real.revenue || 0,
                          lifetime_revenue_at_entry: Number(s.real.lifetime_revenue_at_entry || 0),
                          ltv: Number(s.real.lifetime_revenue_at_entry || 0),
                          velocity: "normal",
                          lastHC: null,
                          lastContact: "today",
                          ret: s.real.retention_score || 50,
                          referrals: 0,
                          profileScores: s.real.profile_scores || {},
                          qualifyingFlags: s.real.qualifying_flags || {},
                          daysOld: 0,
                          is_paused: false,
                        }));
                        return [...kept, ...realRows].sort((a, b) => (b.ret || 0) - (a.ret || 0));
                      });

                      // Tell the user what landed and what didn't. Silent partial
                      // failure is worse than a clear message.
                      if (failed.length > 0) {
                        const failedNames = failed.map(f => f.rowName).join(", ");
                        console.error("Import failures:", failed);
                        alert(
                          succeeded.length > 0
                            ? `Imported ${succeeded.length} client${succeeded.length === 1 ? "" : "s"}. ${failed.length} failed: ${failedNames}. Please try again.`
                            : `Import failed. None of the ${failed.length} client${failed.length === 1 ? " was" : "s were"} saved. Please try again.`
                        );
                      }
                    }} style={{ flex: 1, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Import {importPreview.filter(r => r.valid).length} Client{importPreview.filter(r => r.valid).length > 1 ? "s" : ""}</button>
                    <button onClick={() => { setShowImport(false); setImportPreview([]); setImportPaste(""); setImportFile(null); }} style={{ padding: "10px 16px", background: C.surface, color: C.textMuted, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                  </div>
                )}
              </div>
            )}

            {showAddClient && (
              <div style={{ background: C.card, borderRadius: 14, border: "2px solid " + C.primary, padding: "20px", marginBottom: 16, boxShadow: "var(--rt-sh-card)" }}>
                {profileStep === 0 && (
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>New Client</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <input value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} placeholder="Company name" style={{ padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.surfaceWarm }} />
                      <input value={newClient.contact} onChange={e => setNewClient({...newClient, contact: e.target.value})} placeholder="Primary contact name" style={{ padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.surfaceWarm }} />
                      <input value={newClient.role} onChange={e => setNewClient({...newClient, role: e.target.value})} placeholder="Their role" style={{ padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.surfaceWarm }} />
                      <input value={newClient.tag} onChange={e => setNewClient({...newClient, tag: e.target.value})} placeholder="Industry (e.g. Fitness, Real Estate)" style={{ width: "100%", padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.surfaceWarm }} />
                      <div>
                        <input value={newClient.months} onChange={e => setNewClient({...newClient, months: e.target.value})} placeholder="Months working together" type="number" style={{ width: "100%", padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.surfaceWarm, boxSizing: "border-box" }} />
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, lineHeight: 1.4 }}>
                          Calibrates the engagement start. Tenure grows automatically from here — you won't need to update this.
                        </div>
                      </div>
                      <div>
                        <input value={newClient.revenue} onChange={e => setNewClient({...newClient, revenue: e.target.value})} placeholder="Current monthly rate ($)" type="number" style={{ width: "100%", padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.surfaceWarm, boxSizing: "border-box" }} />
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, lineHeight: 1.4 }}>
                          Your best estimate of monthly revenue. Changing this will not affect prior months.
                        </div>
                      </div>
                      <div>
                        <input value={newClient.lifetime_revenue_at_entry} onChange={e => setNewClient({...newClient, lifetime_revenue_at_entry: e.target.value})} placeholder="Lifetime revenue earned before today ($)" type="number" style={{ width: "100%", padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.surfaceWarm, boxSizing: "border-box" }} />
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, lineHeight: 1.4 }}>
                          Optional. Backfill what you earned from this client before Retayned tracked them. Skip this and Retayned will calculate LTV from today forward, using current rate × tenure.
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                      <button className="r-btn" data-tone="purple" onClick={() => { if (newClient.name && newClient.contact) setProfileStep(1); }} style={{ flex: 1, padding: "10px", background: newClient.name && newClient.contact ? C.btn : C.surface, color: newClient.name && newClient.contact ? "#fff" : C.textMuted, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: newClient.name && newClient.contact ? "pointer" : "default", fontFamily: "inherit" }}>Next: Relationship Profile</button>
                      <button onClick={() => { setShowAddClient(false); setProfileStep(0); setProfileScores({}); }} style={{ padding: "10px 14px", background: C.surface, color: C.textMuted, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                    </div>
                  </div>
                )}

                {profileStep >= 1 && profileStep <= 12 && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 800 }}>Relationship Profile</h3>
                      <span style={{ fontSize: 12, color: C.textMuted }}>{profileStep} of 12</span>
                    </div>
                    <div style={{ display: "flex", gap: 3, marginBottom: 14 }}>
                      {profileDimensions.map((_, i) => (
                        <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < profileStep ? C.primary : profileScores[profileDimensions[i].key] !== undefined ? C.primaryLight : C.borderLight }} />
                      ))}
                    </div>
                    {(() => {
                      const dim = profileDimensions[profileStep - 1];
                      const current = profileScores[dim.key];
                      return (
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{dim.name}</p>
                          <p style={{ fontSize: 12, color: C.textSec, marginBottom: 14 }}>{dim.desc}</p>
                          <div style={{ textAlign: "center", marginBottom: 8 }}>
                            <span style={{ fontSize: 32, fontWeight: 900, color: current !== undefined && current !== null ? C.primary : C.borderLight }}>{current !== undefined && current !== null ? current : "—"}</span>
                          </div>
                          <div style={{ padding: "0 4px", marginBottom: 6 }}>
                            <input type="range" min="0" max="10" value={current !== undefined && current !== null ? current : 5} onChange={e => setProfileScores({...profileScores, [dim.key]: parseInt(e.target.value)})} style={{ width: "100%", height: 6, appearance: "none", WebkitAppearance: "none", background: `linear-gradient(to right, ${C.border} 0%, ${C.primary} 100%)`, borderRadius: 3, outline: "none", cursor: "pointer" }} />
                            <style>{`input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 24px; height: 24px; border-radius: 50%; background: ${C.primary}; border: 3px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.2); cursor: pointer; } input[type="range"]::-moz-range-thumb { width: 24px; height: 24px; border-radius: 50%; background: ${C.primary}; border: 3px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.2); cursor: pointer; }`}</style>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.textMuted, marginBottom: 14 }}>
                            <span>{dim.left}</span><span>{dim.right}</span>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => setProfileStep(profileStep - 1)} style={{ padding: "8px 14px", background: C.surface, color: C.textSec, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Back</button>
                            <button className="r-btn" data-tone="purple" onClick={() => { if (current !== undefined && current !== null) { profileStep < 12 ? setProfileStep(profileStep + 1) : setProfileStep(13); } }} style={{ flex: 1, padding: "8px", background: current !== undefined && current !== null ? C.btn : C.surface, color: current !== undefined && current !== null ? "#fff" : C.textMuted, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: current !== undefined && current !== null ? "pointer" : "default", fontFamily: "inherit" }}>{profileStep < 12 ? "Next" : "Review"}</button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {profileStep === 13 && (
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Review</h3>
                    <div style={{ background: C.bg, borderRadius: 10, padding: "14px", marginBottom: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{newClient.name}</div>
                      <div style={{ fontSize: 12, color: C.textMuted }}>{newClient.contact} · {newClient.role}</div>
                      {newClient.tag && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{newClient.tag} · {newClient.months || 0}mo · ${parseInt(newClient.revenue || 0).toLocaleString()}/mo</div>}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Relationship Profile</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 14 }}>
                      {profileDimensions.map(d => (
                        <div key={d.key} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: C.bg, borderRadius: 6, fontSize: 12 }}>
                          <span style={{ color: C.textSec }}>{d.name}</span>
                          <span style={{ fontWeight: 700, color: C.primary }}>{profileScores[d.key]}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 12, color: C.textMuted, textAlign: "center", marginBottom: 14 }}>
                      {(() => {
                        const b = calcRetentionScore(profileScores, null) || 50;
                        const label = b >= 75 ? "Strong" : b >= 55 ? "Stable" : b >= 35 ? "Watch" : "At Risk";
                        const color = b >= 75 ? C.success : b >= 55 ? C.warning : C.danger;
                        return <span>Starting Signal: <span style={{ fontWeight: 700, color }}>{b}% — {label}</span></span>;
                      })()}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setProfileStep(12)} style={{ padding: "10px 14px", background: C.surface, color: C.textSec, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Edit</button>
                      <button className="r-btn" data-tone="purple" onClick={submitNewClient} style={{ flex: 1, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Add Client</button>
                    </div>
                    <div style={{ fontSize: 10.5, color: C.textMuted, lineHeight: 1.45, marginTop: 10, textAlign: "center" }}>
                      By adding this client, you confirm you have the right to process their information for client management purposes.
                    </div>
                  </div>
                )}
              </div>
            )}


                  {/* Toolbar: search + sort + view toggle */}
                  <div style={{ background: C.card, borderRadius: 12, boxShadow: "var(--rt-sh-card)", padding: "10px 14px", marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Icon name="search" size={14} color={C.textMuted} />
                      <input value={clientSearch} onChange={e => setClientSearch(e.target.value)} placeholder="Search clients, owners, industries…" style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 14, padding: "2px 0", fontFamily: "inherit", color: C.text }} />
                      {clientSearch && <button className="rt-icon-close" onClick={() => setClientSearch("")} style={{ width: 22, height: 22, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted, background: "none", border: "none", cursor: "pointer" }}><Icon name="x" size={11} /></button>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, paddingTop: 10, borderTop: "1px solid " + C.borderLight, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", marginRight: 2 }}>Sort</span>
                        {sortOptions.map(s => (
                          <button key={s.id} onClick={() => setClientsSort(s.id)} className={(sortId === s.id ? "" : "rt-sort-opt ") + (s.id === "cadence" ? "rc-sort-cadence" : s.id === "renewal" ? "rc-sort-renewal" : "")} style={{
                            padding: "4px 10px", fontSize: 11.5, borderRadius: 999, fontWeight: sortId === s.id ? 600 : 500, cursor: "pointer", fontFamily: "inherit",
                            transition: "transform 180ms var(--rt-ease-out), box-shadow 180ms var(--rt-ease-out)",
                            // Active = lifted card chip (sh-card-lift + 0.5px translate).
                            // Matches the chip-language used by view toggle, tabs, and
                            // nav active states. Inactive resting + hover styles live in
                            // .rt-sort-opt (subtle card surface).
                            ...(sortId === s.id
                              ? { background: C.card, color: C.text, border: "none", boxShadow: "var(--rt-sh-card-lift)", transform: "translateY(-0.5px)" }
                              : {}),
                          }}>{s.label}</button>
                        ))}
                      </div>
                      <div className="rc-view-toggle" style={{ display: "inline-flex", gap: 2, padding: 2, background: C.bg, borderRadius: 8 }}>
                        {viewOptions.map(v => (
                          <button key={v.id} onClick={() => setClientsView(v.id)} title={v.label} className={variant === v.id ? "" : "rt-view-opt"} style={{
                            display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
                            border: "none",
                            transition: "transform 180ms var(--rt-ease-out), box-shadow 180ms var(--rt-ease-out)",
                            ...(variant === v.id
                              ? { background: C.card, color: C.text, boxShadow: "var(--rt-sh-card-lift)", transform: "translateY(-0.5px)" }
                              : {}),
                          }}>
                            <Icon name={v.icon} size={14} color={variant === v.id ? C.text : C.textMuted} />
                            <span style={{ fontSize: 12, fontWeight: 500 }}>{v.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Meta row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: C.textMuted, padding: "0 4px 10px", letterSpacing: 0.1 }}>
                    <span>{filteredClients.length} {filteredClients.length === 1 ? "client" : "clients"}</span>
                    <span style={{ flex: 1 }} />
                    <span>Sort: <b style={{ color: C.text, fontWeight: 500 }}>{sortOptions.find(s => s.id === sortId)?.label || "Retention"}</b></span>
                  </div>

                  {/* COMPARE SURFACE — 3 variants */}

                  {/* Mobile card list — always rendered, CSS reveals only <=768px */}
                  {dataLoaded && (
                  <div className="rc-mobile-list" style={{ display: "none", flexDirection: "column", background: C.card, borderRadius: 12, boxShadow: "var(--rt-sh-card)", overflow: "hidden" }}>
                    {filteredClients.map((c, i, arr) => {
                      const delta = stubDelta(c.name);
                      const scoreColor = retColor(c.ret || 0);
                      const months = c.months || 0;
                      const tenureDisplay = months < 12 ? `${months}mo` : `${(months / 12).toFixed(1)}yr`;
                      return (
                        <div key={c.id} className="row-hover-neutral" onClick={() => { setSelectedClient(c); setRolodexConfirm(false); setRemoveConfirm(false); setPauseConfirm(false); setResumeConfirm(false); }} style={{ padding: "12px 14px", borderBottom: i < arr.length - 1 ? "1px solid " + C.borderLight : "none", cursor: "pointer" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <ScoreRing2 client={c} size={32} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: -0.1 }}>{c.name}</div>
                                {c.is_paused && (
                                  <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 6px", borderRadius: 4, color: C.textMuted, background: C.surfaceWarm, letterSpacing: 0.3, textTransform: "uppercase", flexShrink: 0 }}>Paused</span>
                                )}
                              </div>
                              <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {(c.tag || "Client")} · ${((c.revenue || 0) / 1000).toFixed(1)}k/mo · {tenureDisplay}
                              </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0, gap: 2 }}>
                              <div style={{ fontSize: 16, fontWeight: 700, color: scoreColor, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{c.ret || 0}</div>
                              {/* Score delta — Treatment B. Threshold-gated: only |Δ| ≥ 3 renders.
                                  Down moves get a loud red pill (catches the scan); up moves get
                                  quiet green text (good news shouldn't compete with bad news). */}
                              {Math.abs(delta) >= 3 && delta < 0 && (
                                <span style={{ background: "#FBE6DE", color: C.retWarn, fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 999, fontVariantNumeric: "tabular-nums" }}>
                                  ↓ {Math.abs(delta)}
                                </span>
                              )}
                              {Math.abs(delta) >= 3 && delta > 0 && (
                                <span style={{ color: C.retGood, fontSize: 10.5, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                                  ↑ {delta}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  )}

                  {dataLoaded && variant === "table" && (
                    <div className="rc-desktop-view" style={{ background: C.card, borderRadius: 12, boxShadow: "var(--rt-sh-card)", overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderBottom: "1px solid " + C.borderLight, background: C.bg }}>
                        <div style={{ width: 32, fontSize: 10.5, fontWeight: 700, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase" }} />
                        <div style={{ flex: 2, fontSize: 10.5, fontWeight: 700, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase" }}>Client</div>
                        <div style={{ width: 56, textAlign: "center", fontSize: 10.5, fontWeight: 700, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase" }}>Health</div>
                        <div style={{ width: 78, fontSize: 10.5, fontWeight: 700, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase" }}>Revenue</div>
                        <div style={{ width: 64, fontSize: 10.5, fontWeight: 700, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase" }}>Tenure</div>
                        <div className="rt-tcol-lcv" style={{ width: 74, fontSize: 10.5, fontWeight: 700, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase" }}>LCV</div>
                        <div className="rt-tcol-trend" style={{ width: 88, fontSize: 10.5, fontWeight: 700, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase" }}>12-wk trend</div>
                        <div className="rt-tcol-cadence" style={{ width: 92, fontSize: 10.5, fontWeight: 700, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase" }}>Cadence</div>
                        <div className="rt-tcol-renews" style={{ width: 64, textAlign: "right", fontSize: 10.5, fontWeight: 700, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase" }}>Renews</div>
                      </div>
                      <div>
                        {filteredClients.map((c, i, arr) => {
                          const trend = stubTrend(c);
                          const trendStart = trend[0], trendEnd = trend[trend.length - 1];
                          const pct = ((trendEnd - trendStart) / Math.max(1, trendStart)) * 100;
                          const ct = stubCadenceTarget(c);
                          const ca = stubCadenceActual(c);
                          const renewStr = stubRenewal(c);
                          const renewDays = stubRenewalDays(c);
                          const renewUrgent = renewDays <= 14;
                          const delta = stubDelta(c.name);
                          return (
                            <div key={c.id} className="row-hover-neutral" onClick={() => { setSelectedClient(c); setRolodexConfirm(false); setRemoveConfirm(false); setPauseConfirm(false); setResumeConfirm(false); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderBottom: i < arr.length - 1 ? "1px solid " + C.borderLight : "none", cursor: "pointer" }}>
                              <div style={{ width: 32, display: "flex", alignItems: "center" }}>
                                <ScoreRing2 client={c} size={28} />
                              </div>
                              <div style={{ flex: 2, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <div style={{ fontSize: 13.5, fontWeight: 500, color: C.text, letterSpacing: -0.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                                  {c.is_paused && (
                                    <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 6px", borderRadius: 4, color: C.textMuted, background: C.surfaceWarm, letterSpacing: 0.3, textTransform: "uppercase", flexShrink: 0 }}>Paused</span>
                                  )}
                                </div>
                                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.tag || "Client"} · last {c.lastContact || "—"}</div>
                              </div>
                              <div style={{ width: 56, display: "flex", justifyContent: "center", alignItems: "baseline", gap: 3 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: retColor(c.ret || 0), fontVariantNumeric: "tabular-nums" }}>{c.ret || 0}</span>
                                {/* Treatment B — threshold-gated, asymmetric. */}
                                {Math.abs(delta) >= 3 && delta < 0 && (
                                  <span style={{ background: "#FBE6DE", color: C.retWarn, fontSize: 9.5, fontWeight: 700, padding: "1px 5px", borderRadius: 999, fontVariantNumeric: "tabular-nums" }}>
                                    ↓{Math.abs(delta)}
                                  </span>
                                )}
                                {Math.abs(delta) >= 3 && delta > 0 && (
                                  <span style={{ color: C.retGood, fontSize: 10, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                                    +{delta}
                                  </span>
                                )}
                              </div>
                              <div style={{ width: 78 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, fontVariantNumeric: "tabular-nums" }}>${((c.revenue || 0) / 1000).toFixed(1)}k</div>
                                <div style={{ fontSize: 10.5, color: C.textMuted }}>/mo</div>
                              </div>
                              <div style={{ width: 64 }}>
                                {(() => {
                                  const months = c.months || 0;
                                  const display = months < 12 ? `${months} mo` : `${(months / 12).toFixed(1)} yr`;
                                  return <div style={{ fontSize: 13, fontWeight: 500, color: C.text, fontVariantNumeric: "tabular-nums" }}>{display}</div>;
                                })()}
                              </div>
                              <div className="rt-tcol-lcv" style={{ width: 74 }}>
                                {(() => {
                                  // Read honest LTV computed at hydration time from the
                                  // revenue history table + lifetime_revenue_at_entry.
                                  // OLD math (c.revenue × c.months) is wrong after rate
                                  // changes — it pretends the current rate has always been
                                  // the rate. The helper text under the rate field promises
                                  // "changing this will not affect prior months", and that
                                  // promise lives in c.ltv.
                                  const lcv = Number(c.ltv || 0);
                                  const display = lcv >= 1000000 ? `$${(lcv / 1000000).toFixed(1)}M` : lcv >= 1000 ? `$${Math.round(lcv / 1000)}k` : `$${Math.round(lcv)}`;
                                  return <div style={{ fontSize: 13, fontWeight: 500, color: C.text, fontVariantNumeric: "tabular-nums" }}>{display}</div>;
                                })()}
                              </div>
                              <div className="rt-tcol-trend" style={{ width: 88, display: "flex", alignItems: "center", gap: 6 }}>
                                <V2Sparkline points={trend} width={50} height={20} />
                                <span style={{ fontSize: 11, fontWeight: 700, color: pct >= 1 ? C.retGood : pct <= -1 ? C.retWarn : C.textMuted, fontVariantNumeric: "tabular-nums" }}>
                                  {pct >= 0 ? "+" : ""}{pct.toFixed(0)}%
                                </span>
                              </div>
                              <div className="rt-tcol-cadence" style={{ width: 92 }}>
                                <CadencePips target={ct} actual={ca} showLabel />
                              </div>
                              <div className="rt-tcol-renews" style={{ width: 64, textAlign: "right" }}>
                                <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums", color: renewUrgent ? C.retWarn : C.textSec, fontWeight: renewUrgent ? 700 : 500 }}>{renewStr}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {dataLoaded && variant === "columns" && (
                    /* Columns view — five retention-stage buckets side-by-side.
                       The buckets are the whole point of this view (Thriving →
                       Healthy → Watch → At risk → Critical), so we don't let
                       them collapse or wrap; instead the grid scrolls horizontally
                       once the viewport is too narrow to show all 5 at the
                       minmax min-width. Each column has overflow:hidden so card
                       contents (especially the sparkline) can't bleed into
                       neighbouring buckets. */
                    <div style={{ overflowX: "auto", overflowY: "hidden", paddingBottom: 4 }}>
                      <div className="rc-desktop-view" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(240px, 1fr))", gap: 10, alignItems: "flex-start" }}>
                        {[
                          { id: "thriving", label: "Thriving",  color: C.retElite, bg: "#E5EDE7" },
                          { id: "healthy",  label: "Healthy",   color: C.retGood,  bg: "#EFF5F1" },
                          { id: "watch",    label: "Watch",     color: C.retOk,    bg: "#F6F4E5" },
                          { id: "at-risk",  label: "At risk",   color: C.retWarn,  bg: "#F9EEE0" },
                          { id: "critical", label: "Critical",  color: C.retCrit,  bg: "#F5E4E0" },
                        ].map(s => {
                          const col = filteredClients.filter(c => stubStage(c.ret || 0) === s.id);
                          const mrr = col.reduce((a, c) => a + (c.revenue || 0), 0);
                          return (
                            <div key={s.id} style={{ background: s.bg, border: "1px solid " + s.color + "22", borderRadius: 12, padding: 10, display: "flex", flexDirection: "column", gap: 8, minHeight: 200, minWidth: 0, overflow: "hidden" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 6px 8px", borderBottom: "1px solid " + C.borderLight, gap: 8, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                                  <span style={{ width: 8, height: 8, borderRadius: 4, background: s.color, flexShrink: 0 }} />
                                  <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text, letterSpacing: -0.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</span>
                                  <span style={{ fontSize: 11, color: C.textMuted, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{col.length}</span>
                                </div>
                                <div style={{ fontSize: 11, color: C.textMuted, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>${(mrr/1000).toFixed(1)}k</div>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                                {col.map(c => {
                                  const trend = stubTrend(c);
                                  const trendStart = trend[0], trendEnd = trend[trend.length - 1];
                                  const pct = ((trendEnd - trendStart) / Math.max(1, trendStart)) * 100;
                                  const owner = stubOwner(c.name);
                                  const ct = stubCadenceTarget(c);
                                  const ca = stubCadenceActual(c);
                                  const delta = stubDelta(c.name);
                                  return (
                                    <div key={c.id} className="row-hover" onClick={() => setSelectedClient(c)} style={{ background: C.card, borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8, cursor: "pointer", minWidth: 0, overflow: "hidden" }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                                        <ScoreRing2 client={c} size={32} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <div style={{ fontSize: 13, fontWeight: 500, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: -0.1 }}>{c.name}</div>
                                          <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.tag || "Client"} · renews {stubRenewal(c)}</div>
                                        </div>
                                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                                          <div style={{ fontSize: 12.5, fontWeight: 700, color: retColor(c.ret || 0), fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                                            {c.ret || 0}{delta !== 0 && <span style={{ fontSize: 9.5, marginLeft: 3, color: delta > 0 ? C.retGood : C.retWarn }}>{delta > 0 ? "+" : ""}{delta}</span>}
                                          </div>
                                        </div>
                                      </div>
                                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minWidth: 0 }}>
                                        <OwnerChip owner={owner.name} color={owner.color} size="sm" showLabel firstOnly />
                                        <CadencePips target={ct} actual={ca} />
                                      </div>
                                      <div style={{ position: "relative", background: C.bg, borderRadius: 6, padding: "4px 6px", minWidth: 0, overflow: "hidden" }}>
                                        <V2Sparkline points={trend} width={156} height={28} fill responsive />
                                        <div style={{ position: "absolute", top: 4, left: 0, right: 6, display: "flex", justifyContent: "space-between", padding: "0 6px", pointerEvents: "none" }}>
                                          <span style={{ fontSize: 11.5, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums" }}>${((c.revenue || 0)/1000).toFixed(1)}k</span>
                                          <span style={{ fontSize: 10.5, fontWeight: 700, color: pct >= 1 ? C.retGood : pct <= -1 ? C.retWarn : C.textMuted, fontVariantNumeric: "tabular-nums" }}>{pct >= 0 ? "+" : ""}{pct.toFixed(0)}%</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                                {col.length === 0 && (
                                  <div style={{ fontSize: 12, color: C.textMuted, textAlign: "center", padding: "20px 0", fontStyle: "italic" }}>No clients</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {dataLoaded && variant === "heatmap" && (
                    <div className="rc-desktop-view" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
                      {filteredClients.map(c => {
                        const trend = stubTrend(c);
                        const trendStart = trend[0], trendEnd = trend[trend.length - 1];
                        const pct = ((trendEnd - trendStart) / Math.max(1, trendStart)) * 100;
                        const scoreColor = retColor(c.ret || 0);
                        const renewDays = stubRenewalDays(c);
                        const renewUrgent = renewDays <= 14;
                        const owner = stubOwner(c.name);
                        const ct = stubCadenceTarget(c);
                        const ca = stubCadenceActual(c);
                        const delta = stubDelta(c.name);
                        return (
                          <div key={c.id} className="row-hover" onClick={() => setSelectedClient(c)} style={{ position: "relative", background: C.card, borderRadius: 12, boxShadow: "var(--rt-sh-card)", padding: 12, paddingLeft: 14, overflow: "hidden", cursor: "pointer" }}>
                            <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 3, background: scoreColor }} />
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                              <ScoreRing2 client={c} size={34} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13.5, fontWeight: 500, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: -0.1 }}>{c.name}</div>
                                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{c.tag || "Client"}</div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 15, fontWeight: 700, color: scoreColor, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{c.ret || 0}</div>
                                {delta !== 0 && (
                                  <div style={{ fontSize: 10, fontWeight: 500, color: delta > 0 ? C.retGood : C.retWarn, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{delta > 0 ? "+" : ""}{delta} pts</div>
                                )}
                              </div>
                            </div>
                            <div style={{ position: "relative", background: C.primaryGhost, borderRadius: 6, padding: "4px 6px", marginBottom: 10, overflow: "hidden" }}>
                              <V2Sparkline points={trend} width={200} height={32} fill showEnd />
                              <div style={{ position: "absolute", top: 4, left: 6, right: 6, display: "flex", justifyContent: "space-between", alignItems: "center", pointerEvents: "none" }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums", background: "rgba(255,255,255,0.9)", padding: "1px 4px", borderRadius: 3 }}>${((c.revenue || 0)/1000).toFixed(1)}k<span style={{ fontWeight: 400, fontSize: 10.5, color: C.textMuted }}>/mo</span></span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: pct >= 1 ? C.retGood : pct <= -1 ? C.retWarn : C.textMuted, fontVariantNumeric: "tabular-nums", background: "rgba(255,255,255,0.9)", padding: "1px 4px", borderRadius: 3 }}>{pct >= 0 ? "+" : ""}{pct.toFixed(0)}% 12w</span>
                              </div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, auto) minmax(0, auto)", gap: 10, alignItems: "center" }}>
                              <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
                                <OwnerChip owner={owner.name} color={owner.color} size="sm" showLabel firstOnly />
                              </div>
                              <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
                                <CadencePips target={ct} actual={ca} />
                                <span style={{ fontSize: 10.5, color: C.textMuted, marginLeft: 5 }}>{ca}d</span>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", minWidth: 0, justifyContent: "flex-end" }}>
                                <Icon name="clock" size={10} color={renewUrgent ? C.retWarn : C.textMuted} />
                                <span style={{ fontSize: 11, color: renewUrgent ? C.retWarn : C.textMuted, fontWeight: renewUrgent ? 700 : 500, marginLeft: 4, fontVariantNumeric: "tabular-nums" }}>{stubRenewal(c)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {!dataLoaded && (
                    <SkeletonClientList rows={5} />
                  )}

                  {dataLoaded && filteredClients.length === 0 && activeClients.length === 0 && (
                    <EmptyState
                      icon="clients"
                      headline="Your client book starts here."
                      body="Add the people you work with and Retayned starts reading the room — drift, cadence, who needs a check-in. Most users add 10 to start."
                      cta={{ label: "Add Client", onClick: () => { setShowAddClient(true); setShowImport(false); } }}
                      secondaryCta={{ label: "Import Clients", onClick: () => { setShowImport(true); setShowAddClient(false); } }}
                    />
                  )}

                  {dataLoaded && filteredClients.length === 0 && activeClients.length > 0 && (
                    <div style={{ textAlign: "center", padding: "40px 20px", background: C.card, borderRadius: 12 }}>
                      <div style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 6 }}>
                        No clients match {clientSearch ? `"${clientSearch}"` : "your filters"}.
                      </div>
                      <div style={{ fontSize: 14, color: C.textSec }}>
                        Check the spelling, or{" "}
                        <span
                          onClick={() => setClientSearch("")}
                          className="rt-purple-link"
                          style={{ cursor: "pointer", paddingBottom: 1 }}
                        >clear the search</span>
                        {" "}to see your full list.
                      </div>
                    </div>
                  )}
                </div>

                {/* DAYBOOK COLUMN — wide desktop only (>=1440px) */}
                <div className="rc-rai-col" style={{ display: "none", position: "sticky", top: 20, alignSelf: "start" }}>
                  <DaybookPanel
                    entry={daybookEntry}
                    yesterday={daybookYesterday}
                    saveStatus={daybookSaveStatus}
                    onChange={handleDaybookChange}
                  />
                </div>
              </div>
            </div>
          );
        })()}

        {/* ═══ HEALTH CHECKS ═══ */}
        {page === "health" && (() => {
          // ─── Observer card renderer ───
          // Rendered TWICE in the JSX below: once above the mobile calendar
          // widget (rt-mob-strip), once inside the desktop rc-grid main column.
          // The two callsites are mutually exclusive via the isMobile flag, so
          // only one instance ever renders at a time. Returns null when there's
          // no current observation or one is being dismissed.
          const renderObserver = () => {
            if (!observation || obsDismissing) return null;
                    const obs = observation;
                    const rawName = obs.card_name || "Observation";
                    const archetype = /^the\s/i.test(rawName) ? rawName : `The ${rawName}`;

                    // Top-bar metadata: № (observation number) / WK (ISO week) / DATE
                    const firedAt = new Date(obs.fired_at);
                    const obsNum = String(obs.observation_number || "").padStart(2, "0");
                    const weekNum = (() => {
                      // ISO week number
                      const d = new Date(Date.UTC(firedAt.getFullYear(), firedAt.getMonth(), firedAt.getDate()));
                      const dayNum = d.getUTCDay() || 7;
                      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
                      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
                      return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
                    })();
                    const firedDate = firedAt.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }).replace(/\//g, '.');

                    // Illustration asset for this observation. Lookup by
                    // card_name through a normalizer so casing/punctuation
                    // variants resolve correctly. null if unmapped → card
                    // renders without illo and content flows full-width.
                    const illoSrc = lookupObservationIllustration(obs.card_name);

                    // ─── Action handlers ───
                    const handleDrop = async () => {
                      setObsDismissing(true);
                      setTimeout(() => setObservation(null), 280);
                      try { await observationsDb.updateStatus(obs.id, "dropped"); } catch (e) { /* non-blocking */ }
                    };
                    const handleUnpack = async () => {
                      try { await observationsDb.updateStatus(obs.id, "unpacked"); } catch (e) { /* non-blocking */ }
                      const seededMessage = `You pulled ${archetype}. ${obs.front_headline}\n\nWhere do you want to start?`;
                      setAiMessages([{ role: "ai", text: seededMessage }]);
                      setPage("coach");
                    };

                    // ─── Metric strip: per-detector label mapping ───
                    // Each detector outputs different metric keys. We translate them
                    // into short, readable labels for display.
                    const METRIC_LABELS = {
                      // Counts & generic
                      count: "Clients",
                      book_size: "Book size",
                      // Frequency / depth
                      avg_touch_30d: "Avg / 30d",
                      avg_touch_60d: "Avg / 60d",
                      median_touch_30d: "Book median",
                      expected_touch: "Expected",
                      // Anniversaries
                      nearest_days: "Days out",
                      farthest_days: "Latest",
                      avg_years: "Avg years",
                      days_window: "Window",
                      count_anniv: "Anniversaries",
                      count_stale_rate: "Stale rates",
                      // Tenure
                      avg_tenure_yrs: "Avg tenure",
                      long_tenure_pct: "Long tenure",
                      year_two_count: "Year two",
                      // Score
                      avg_score: "Avg score",
                      avg_drop: "Avg drop",
                      max_drop: "Max drop",
                      avg_score_drop: "Score drop",
                      // Health checks
                      never_had: "No HC ever",
                      avg_days_since_hc: "Days since HC",
                      // Expectations
                      avg_expectations: "Avg score",
                      // Effort
                      effort_multiple: "Effort",
                      revenue_gap_pct: "Revenue gap",
                      task_pct: "Task share",
                      revenue_pct: "Revenue share",
                      top_pct: "Top share",
                      // Rates
                      avg_rate_age_days: "Rate age",
                      gap_pct: "Rate gap",
                      median: "Book median",
                      max: "Top rate",
                      drop_pct: "Drop",
                      // Referrals
                      avg_referrals_made: "Avg referrals",
                      days_since_last: "Days since",
                      // Cadence / drift census
                      touched: "Touched",
                      silent: "Silent",
                      Stable: "Stable",
                      Improving: "Improving",
                      "Something shifted": "Shifted",
                      Declining: "Declining",
                      "At risk": "At risk",
                      // Self-cluster
                      patterns_count: "Patterns",
                      affected_pct: "Affected",
                    };

                    const formatMetricValue = (key, val) => {
                      if (val == null) return "—";
                      // Percentages
                      if (key.endsWith("_pct") || key === "long_tenure_pct" || key === "affected_pct") {
                        return `${val}%`;
                      }
                      // Day counts
                      if (key.endsWith("_days") || key === "days_window") {
                        return `${val}d`;
                      }
                      // Year counts
                      if (key.endsWith("_yrs") || key === "avg_years") {
                        return `${val}yr`;
                      }
                      // Effort multiples
                      if (key === "effort_multiple") {
                        return `${val}x`;
                      }
                      // Score drops — show as negative
                      if (key.includes("drop") && typeof val === "number" && val > 0) {
                        return `−${val}`;
                      }
                      return String(val);
                    };

                    const metrics = (obs.data_payload && obs.data_payload.metrics) || {};
                    const metricEntries = Object.entries(metrics)
                      .filter(([k, v]) => v != null && v !== 0 || (k === "count" && v != null))  // hide zero-value noise except count
                      .slice(0, 4);  // cap at 4 metrics in the strip

                    return (
                      <div
                        style={{
                          marginBottom: 24,
                          opacity: obsDismissing ? 0 : 1,
                          transform: obsDismissing ? "scale(0.97)" : "scale(1)",
                          transition: "opacity 280ms ease, transform 280ms ease",
                          borderRadius: 14,
                        }}
                      >
                        {/* ═══════════════════════════════════════════
                            OBSERVER CARD — desktop and mobile layouts
                            ═══════════════════════════════════════════
                            Two separate JSX trees, picked by `isMobile`.
                            Each owns its own layout end-to-end. No
                            !important wars. No responsive class fights.
                            Shared closure scope: archetype, illoSrc,
                            obsNum, weekNum, firedDate, handleUnpack,
                            handleDrop, metricEntries, METRIC_LABELS,
                            formatMetricValue, obsMobileExpanded,
                            setObsMobileExpanded. */}
                        {isMobile ? (
                          /* ─── MOBILE LAYOUT — V1 spec ───
                             Compact card. Topbar pairs the archetype name
                             with a small (60×50) illo. Corner ✕ replaces
                             the inline Dismiss button. Headline only, by
                             default. Body + metadata + metric strip live
                             behind a "More" tap. Action row uses text
                             links (no harsh button background). */
                          <div style={{
                            background: C.primarySoft,
                            color: C.text,
                            borderRadius: 14,
                            padding: "16px 18px",
                            position: "relative",
                            overflow: "hidden",
                            boxShadow: "var(--rt-sh-card)",
                          }}>
                            {/* Corner ✕ dismiss — top-right notification pattern */}
                            <button
                              type="button"
                              onClick={handleDrop}
                              aria-label="Dismiss observation"
                              style={{
                                position: "absolute",
                                top: 10, right: 10,
                                width: 28, height: 28,
                                borderRadius: 14,
                                background: "transparent",
                                border: "none",
                                color: C.textMuted,
                                fontSize: 16,
                                lineHeight: 1,
                                cursor: "pointer",
                                fontFamily: "inherit",
                                padding: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                zIndex: 2,
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = "rgba(28,50,36,0.06)"; e.currentTarget.style.color = C.text; }}
                              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.textMuted; }}
                            >
                              ✕
                            </button>

                            {/* TOPBAR — dot + name + illo (right side, with margin to clear ✕) */}
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                              <div style={{ width: 6, height: 6, borderRadius: 999, background: C.btn, flexShrink: 0 }} />
                              <div style={{
                                fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                                fontSize: 10,
                                fontWeight: 700,
                                letterSpacing: "0.16em",
                                textTransform: "uppercase",
                                color: C.text,
                                flex: 1,
                              }}>
                                {archetype}
                              </div>
                              {illoSrc && (
                                <img
                                  src={illoSrc}
                                  alt=""
                                  aria-hidden="true"
                                  style={{
                                    width: 60, height: 50,
                                    flexShrink: 0,
                                    pointerEvents: "none",
                                    opacity: 0.9,
                                    objectFit: "contain",
                                    marginRight: 32,
                                  }}
                                />
                              )}
                            </div>

                            {/* HEADLINE — always visible. padding-right clears the corner ✕ */}
                            <h3 style={{
                              fontFamily: "'Fraunces', Georgia, serif",
                              fontVariationSettings: '"opsz" 96, "SOFT" 50, "WONK" 0',
                              fontWeight: 500,
                              fontStyle: "italic",
                              fontSize: 19,
                              lineHeight: 1.25,
                              letterSpacing: "-0.005em",
                              color: C.text,
                              margin: "0 0 14px",
                              paddingRight: 28,
                            }}>
                              {obs.front_headline}
                            </h3>

                            {/* EXPANDABLE — meta + body + metric strip, shown after "More" tap */}
                            {obsMobileExpanded && (
                              <>
                                <div style={{
                                  fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                                  fontSize: 10.5,
                                  letterSpacing: "0.14em",
                                  color: C.textMuted,
                                  marginBottom: 12,
                                }}>
                                  № {obsNum}&nbsp;&nbsp;/&nbsp;&nbsp;WK {weekNum}&nbsp;&nbsp;/&nbsp;&nbsp;{firedDate}
                                </div>
                                <p style={{
                                  fontSize: 13.5,
                                  lineHeight: 1.55,
                                  color: C.textSec,
                                  margin: "0 0 16px",
                                }}>
                                  {obs.front_body}
                                </p>
                                {metricEntries.length > 0 && (
                                  <div style={{ display: "flex", gap: 22, marginBottom: 16, flexWrap: "wrap" }}>
                                    {metricEntries.map(([key, val]) => (
                                      <div key={key}>
                                        <div style={{
                                          fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                                          fontSize: 16,
                                          fontWeight: 600,
                                          color: C.text,
                                          lineHeight: 1,
                                        }}>
                                          {formatMetricValue(key, val)}
                                        </div>
                                        <div style={{
                                          fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                                          fontSize: 9,
                                          fontWeight: 700,
                                          letterSpacing: "0.16em",
                                          textTransform: "uppercase",
                                          color: C.textMuted,
                                          marginTop: 4,
                                        }}>
                                          {METRIC_LABELS[key] || key.replace(/_/g, " ")}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}

                            {/* ACTIONS — text links, no button background */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <button
                                type="button"
                                onClick={() => setObsMobileExpanded(v => !v)}
                                style={{
                                  background: "transparent",
                                  color: C.textMuted,
                                  border: "none",
                                  padding: "8px 0",
                                  fontSize: 12.5,
                                  fontWeight: 500,
                                  cursor: "pointer",
                                  fontFamily: "inherit",
                                }}
                              >
                                {obsMobileExpanded ? "Less" : "More"}
                              </button>
                              <button
                                type="button"
                                onClick={handleUnpack}
                                style={{
                                  background: "transparent",
                                  color: C.btn,
                                  border: "none",
                                  padding: "8px 0",
                                  fontSize: 13,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  fontFamily: "inherit",
                                }}
                              >
                                Unpack with Rai
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* ─── DESKTOP LAYOUT ───
                             Full editorial card. Topbar with archetype name,
                             rule, and full № WK DATE metadata. 200×165 illo
                             absolutely positioned to top-right corner.
                             Body always visible. Metric strip + actions row
                             at the bottom. "Unpack with Rai" as purple text
                             link (no button background) + "Dismiss" muted. */
                          <div style={{
                            background: C.primarySoft,
                            color: C.text,
                            borderRadius: 14,
                            padding: "24px 28px 22px",
                            position: "relative",
                            overflow: "hidden",
                            boxShadow: "var(--rt-sh-card)",
                          }}>
                            {/* Illustration — absolute corner placement */}
                            {illoSrc && (
                              <img
                                src={illoSrc}
                                alt=""
                                aria-hidden="true"
                                style={{
                                  position: "absolute",
                                  top: 28, right: 36,
                                  width: 200, height: 165,
                                  pointerEvents: "none",
                                  opacity: 0.9,
                                  objectFit: "contain",
                                }}
                              />
                            )}

                            {/* Content column — padding-right reserves space for the corner illo */}
                            <div style={{ paddingRight: illoSrc ? 220 : 0 }}>
                              {/* TOPBAR — dot + name + rule + metadata */}
                              <div style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                                paddingBottom: 14,
                                borderBottom: "1px dashed " + C.borderLight,
                                marginBottom: 18,
                              }}>
                                <div style={{ width: 8, height: 8, borderRadius: 999, background: C.btn, flexShrink: 0 }} />
                                <div style={{
                                  fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  letterSpacing: "0.18em",
                                  textTransform: "uppercase",
                                  color: C.text,
                                }}>
                                  {archetype}
                                </div>
                                <div style={{ flex: 1, height: 1, background: C.borderLight }} />
                                <div style={{
                                  fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                                  fontSize: 11,
                                  letterSpacing: "0.14em",
                                  color: C.textMuted,
                                  whiteSpace: "nowrap",
                                }}>
                                  № {obsNum}&nbsp;&nbsp;/&nbsp;&nbsp;WK {weekNum}&nbsp;&nbsp;/&nbsp;&nbsp;{firedDate}
                                </div>
                              </div>

                              {/* HEADLINE */}
                              <h3 style={{
                                fontFamily: "'Fraunces', Georgia, serif",
                                fontVariationSettings: '"opsz" 96, "SOFT" 50, "WONK" 0',
                                fontWeight: 500,
                                fontStyle: "italic",
                                fontSize: 25,
                                lineHeight: 1.22,
                                letterSpacing: "-0.005em",
                                color: C.text,
                                margin: "0 0 12px",
                              }}>
                                {obs.front_headline}
                              </h3>

                              {/* BODY */}
                              <p style={{
                                fontSize: 13.5,
                                lineHeight: 1.55,
                                color: C.textSec,
                                margin: "0 0 22px",
                              }}>
                                {obs.front_body}
                              </p>
                            </div>

                            {/* ACTIONS ROW — metrics on left, links on right */}
                            <div style={{
                              paddingTop: 16,
                              borderTop: "1px solid " + C.borderLight,
                              display: "flex",
                              alignItems: "center",
                              gap: 24,
                            }}>
                              {/* Metric strip */}
                              <div style={{ display: "flex", gap: 28 }}>
                                {metricEntries.map(([key, val]) => (
                                  <div key={key}>
                                    <div style={{
                                      fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                                      fontSize: 18,
                                      fontWeight: 600,
                                      color: C.text,
                                      lineHeight: 1,
                                    }}>
                                      {formatMetricValue(key, val)}
                                    </div>
                                    <div style={{
                                      fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                                      fontSize: 9.5,
                                      fontWeight: 700,
                                      letterSpacing: "0.18em",
                                      textTransform: "uppercase",
                                      color: C.textMuted,
                                      marginTop: 5,
                                    }}>
                                      {METRIC_LABELS[key] || key.replace(/_/g, " ")}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <div style={{ flex: 1 }} />

                              {/* Unpack as purple text link (no button background) */}
                              <button
                                type="button"
                                onClick={handleUnpack}
                                style={{
                                  background: "transparent",
                                  color: C.btn,
                                  border: "none",
                                  padding: "8px 4px",
                                  fontSize: 13,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  fontFamily: "inherit",
                                }}
                              >
                                Unpack with Rai
                              </button>
                              {/* Dismiss as muted text link */}
                              <button
                                type="button"
                                onClick={handleDrop}
                                style={{
                                  background: "transparent",
                                  color: C.textMuted,
                                  border: "none",
                                  padding: "8px 4px",
                                  fontSize: 13,
                                  fontWeight: 500,
                                  cursor: "pointer",
                                  fontFamily: "inherit",
                                }}
                                onMouseEnter={e => e.currentTarget.style.color = C.text}
                                onMouseLeave={e => e.currentTarget.style.color = C.textMuted}
                              >
                                Dismiss
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
          };

          const hcQuestions = [
            { q: "Has anything changed with this relationship?", weight: 0.40, options: [{ text: "Nothing — same as always", mod: 2 }, { text: "Something minor, could be nothing", mod: 0 }, { text: "Noticeably different from before", mod: -3 }, { text: "Something has clearly changed", mod: -5 }] },
            { q: "Is this relationship better or worse than last month?", weight: 0.20, options: [{ text: "Better — things are trending up", mod: 3 }, { text: "About the same", mod: 0 }, { text: "Slightly worse", mod: -3 }, { text: "Noticeably worse", mod: -5 }] },
            { q: "Has the way this client communicates with you changed?", weight: 0.20, options: [{ text: "No — same rhythm, same tone", mod: 2 }, { text: "Slightly different but nothing alarming", mod: 0 }, { text: "Noticeably different", mod: -3 }, { text: "Yes — clearly different from before", mod: -5 }] },
            { q: "If they cancelled tomorrow, would you be surprised?", weight: 0.10, options: [{ text: "Very surprised — not on my radar at all", mod: 2 }, { text: "Somewhat surprised but I could see it", mod: 0 }, { text: "Not really surprised", mod: -3 }, { text: "I’ve had the thought myself", mod: -5 }] },
            { q: "Is this client getting more or less value from your work than last quarter?", weight: 0.10, options: [{ text: "More — results are improving", mod: 3 }, { text: "About the same", mod: 0 }, { text: "Less — results are slipping", mod: -3 }, { text: "Significantly less", mod: -5 }] },
          ];

          const selectAnswer = (client, qIdx, mod) => {
            const key = client;
            const prev = hcAnswers[key] || [];
            const alreadyAnswered = prev[qIdx] !== undefined;
            const updated = [...prev];
            updated[qIdx] = mod;
            setHcAnswers({ ...hcAnswers, [key]: updated });
            if (!alreadyAnswered) {
              setTimeout(() => {
                setHcStep(prev => ({ ...prev, [key]: qIdx + 1 }));
              }, 300);
            }
          };

          const calcDrift = (answers) => {
            if (!answers || answers.length < 5) return null;
            let delta = 0;
            hcQuestions.forEach((q, i) => {
              if (answers[i] != null) delta += answers[i] * q.weight;
            });
            delta = Math.round(delta);
            if (delta >= 2) return "Improving";
            if (delta >= 0) return "Stable";
            if (delta >= -2) return "Something shifted";
            if (delta >= -4) return "Declining";
            return "At risk";
          };

          // Drift wall uses a 4-tier label set (Thriving / Stable / Shifted / Declining).
          // calcDrift() returns 5 states; merge "At risk" into "Declining" and "Improving"
          // into "Thriving" for plot + pill purposes.
          const toDriftTier = (d) => {
            if (!d) return "Stable";
            if (d === "Improving") return "Thriving";
            if (d === "Stable") return "Stable";
            if (d === "Something shifted") return "Shifted";
            if (d === "Declining" || d === "At risk") return "Declining";
            return "Stable";
          };
          const driftTierColor = (t) => t === "Thriving" ? C.retElite : t === "Stable" ? C.retGood : t === "Shifted" ? C.retWarn : C.retCrit;
          // Stubbed one-liner per drift tier (wired to real note field post-launch)
          const driftStub = (t) => t === "Thriving" ? "Relationship trending up." : t === "Stable" ? "Steady. Nothing to flag." : t === "Shifted" ? "Something worth watching." : "Signals are declining.";

          const submitHc = async (client) => {
            const answers = hcAnswers[client] || [];
            const drift = calcDrift(answers);
            
            // Update local state
            setClientDrift(prev => ({ ...prev, [client]: drift }));
            setClients(prev => prev.map(x => x.name === client ? { ...x, lastHC: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }) } : x));
            setHcDone(prev => ({ ...prev, [client]: true }));
            setHcOpen(null);
            
            // Persist to Supabase
            const clientObj = clients.find(c => c.name === client);
            if (clientObj) {
              // Find the HC record for this client
              const hcRecord = hcQueue.find(h => h.client === client);
              if (hcRecord?.id) {
                // Complete the health check
                const answersObj = {};
                answers.forEach((a, i) => { answersObj["q" + (i + 1)] = a; });
                await hcDb.complete(hcRecord.id, answersObj, null, drift);
                // Schedule next HC (30 days)
                await hcDb.scheduleNext(user.id, hcRecord.client_id || clientObj.id);
              }
              // Update client drift
              await clientsDb.updateDrift(clientObj.id, drift, localYmd());
            }
          };

          // Active = runnable NOW: overdue, due today, OR a first HC (Start Early-eligible)
          const activeQueue = hcQueue.filter(h => h.runnable && !hcDone[h.client]).sort((a, b) => {
            // Overdue first, then due today, then first-HCs (Start Early) sorted by soonest due
            if (a.overdue !== b.overdue) return b.overdue - a.overdue;
            if (a.due === "Today" && b.due !== "Today") return -1;
            if (b.due === "Today" && a.due !== "Today") return 1;
            return a.daysUntil - b.daysUntil;
          });
          const justCompleted = hcQueue.filter(h => h.runnable && hcDone[h.client]);
          // Upcoming-locked: HC #2+ that aren't yet due. Visible but not tappable until due date.
          const upcomingQueue = hcQueue.filter(h => !h.runnable).sort((a, b) => a.daysUntil - b.daysUntil);

          const totalClients = clients.length;
          const checkedThisMonth = hcQueue.filter(h => hcDone[h.client]).length;
          const pctChecked = totalClients > 0 ? Math.round((checkedThisMonth / totalClients) * 100) : 0;
          const now = new Date();
          const monthLabel = now.toLocaleString("en-US", { month: "long", year: "numeric" });

          // ─── Drift Wall stubs ────────────────────────────────────────────
          const _hash = (s) => (s || "").split("").reduce((a, ch) => a + ch.charCodeAt(0), 0);
          const _dwDelta = (name) => ((_hash(name) % 11) - 5); // -5..+5
          const _dwCadenceTarget = (name) => (_hash(name) % 3 === 0) ? 14 : 7;
          const _dwCadenceActual = (c) => {
            const lc = (c.lastContact || "").toLowerCase();
            if (lc.includes("today")) return 1;
            const m = lc.match(/(\d+)\s*d/);
            if (m) return parseInt(m[1], 10);
            return (_hash(c.name) % 20) + 5;
          };
          // Cadence drift days: negative = on or ahead, positive = slower than target
          const _dwCadenceDrift = (c) => _dwCadenceActual(c) - _dwCadenceTarget(c.name);

          // Plot: X = cadence drift days (clamped -10..+20), Y = score delta (-5..+5)
          const driftPoints = clients.map(c => {
            const delta = _dwDelta(c.name);
            const drift = _dwCadenceDrift(c);
            return { c, delta, drift };
          });

          return (
            <div style={{ width: "100%" }}>
              {!dataLoaded && (
                <div style={{ width: "100%", padding: "20px 4px" }}>
                  <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 20px", letterSpacing: -0.4, color: C.text, padding: "0 4px" }}>Health</h1>
                  <SkeletonHealthQueue rows={3} />
                </div>
              )}
              {dataLoaded && totalClients === 0 && (
                <div style={{ width: "100%", padding: "20px 4px" }}>
                  <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 20px", letterSpacing: -0.4, color: C.text, padding: "0 4px" }}>Health</h1>
                  <EmptyState
                    icon="health"
                    headline="No health checks yet."
                    body="A health check is five quick questions — trust, expectations, communication. Scores update from your answers, so the model gets sharper the more you do."
                    cta={{ label: "Start First Check", onClick: () => goTo("clients") }}
                  />
                </div>
              )}
              {dataLoaded && totalClients > 0 && (<>
              {/* STATUS BAND */}
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "4px 4px 20px", marginBottom: 20, borderBottom: "1px solid " + C.borderLight, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                  <div style={{ fontSize: 11.5, color: C.textMuted, letterSpacing: 0.3, marginBottom: 4 }}>Monthly cadence · {monthLabel}</div>
                  <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: -0.4, color: C.text }}>Health</h1>
                  <div style={{ fontSize: 13.5, color: C.textMuted, marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ color: activeQueue.filter(h => h.overdue > 0).length > 0 ? C.retWarn : C.textMuted, fontWeight: 600 }}>
                      <b>{activeQueue.filter(h => h.overdue > 0).length}</b> overdue
                    </span>
                    <span style={{ color: C.border }}>·</span>
                    <span><b style={{ color: C.text, fontWeight: 700 }}>{activeQueue.filter(h => h.due === "Today").length}</b> due today</span>
                    {justCompleted.length > 0 && <>
                      <span style={{ color: C.border }}>·</span>
                      <span style={{ color: C.retGood, fontWeight: 600 }}>
                        <b>{justCompleted.length}</b> done today
                      </span>
                    </>}
                  </div>
                </div>
                <div style={{ flexShrink: 0, minWidth: 200 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="rt-pct-bar" style={{ position: "relative", flex: 1, height: 5, minWidth: 60, background: C.borderLight, borderRadius: 999, overflow: "hidden", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.10)" }}>
                      <div className="rt-pct-fill" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.max(0, Math.min(100, pctChecked))}%`, background: `linear-gradient(90deg, ${C.primaryLight}, ${C.primary})`, borderRadius: 999, transition: "width 400ms cubic-bezier(.2,.7,.3,1)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.30), 0 0 6px rgba(51,84,62,0.25)" }} />
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums", letterSpacing: -0.2, flexShrink: 0 }}>
                      {pctChecked}<span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>%</span>
                    </span>
                    <span style={{ fontSize: 10.5, color: C.textMuted, letterSpacing: 0.3, textTransform: "uppercase", fontWeight: 600, flexShrink: 0 }}>of book checked</span>
                  </div>
                </div>
              </div>



              {/* Mobile observation — placed ABOVE the calendar widget. Desktop renders the same observation inside the rc-grid main column below. Mutually exclusive via isMobile. */}
              {isMobile && renderObserver()}

              {/* MOBILE UPCOMING STRIP — between band and main grid (mobile only) */}
              <div className="rt-mob-strip" style={{ marginBottom: 16 }}>
                {(() => {
                  const today = new Date();
                  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
                  const daysLeft = daysInMonth - today.getDate();
                  const planned = hcQueue.filter(h => !h.runnable).length;
                  const summary = `${checkedThisMonth} logged · ${planned} planned · ${daysLeft}d left`;
                  const monthName = today.toLocaleString("en-US", { month: "long" });
                  const year = today.getFullYear();
                  const monthIdx = today.getMonth();
                  const todayDay = today.getDate();
                  const firstDay = new Date(year, monthIdx, 1);
                  const startCol = firstDay.getDay();
                  const byDay = {};
                  hcQueue.forEach(h => {
                    if (h.due_date) {
                      const d = new Date(h.due_date);
                      if (d.getFullYear() === year && d.getMonth() === monthIdx && d.getDate() >= todayDay) {
                        byDay[d.getDate()] = "planned";
                      }
                    }
                  });
                  Object.keys(hcDone).forEach(cn => { if (hcDone[cn]) byDay[todayDay] = "logged"; });
                  const cells = [];
                  for (let i = 0; i < startCol; i++) cells.push(null);
                  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
                  while (cells.length % 7 !== 0) cells.push(null);
                  const daysHdr = ["S", "M", "T", "W", "T", "F", "S"];
                  return (
                    <div style={{ background: C.card, borderRadius: 10, overflow: "hidden" }}>
                      <div onClick={() => setHealthStripOpen(!healthStripOpen)} style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, cursor: "pointer" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: C.primaryGhost, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Icon name="health" size={14} simple color={C.primary} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 0.3, textTransform: "uppercase", fontWeight: 700, marginBottom: 2 }}>{monthName} rhythm</div>
                            <div style={{ fontSize: 13.5, color: C.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{summary}</div>
                          </div>
                        </div>
                        <Icon name={healthStripOpen ? "chevron-up" : "chevron-down"} size={14} color={C.textMuted} />
                      </div>
                      {healthStripOpen && (
                        <div style={{ padding: 14, borderTop: "1px solid " + C.borderLight }}>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 6 }}>
                            {daysHdr.map((d, i) => <div key={"h-" + i} style={{ fontSize: 9.5, color: C.textMuted, textAlign: "center", fontWeight: 500 }}>{d}</div>)}
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
                            {cells.map((d, i) => {
                              if (d === null) return <div key={"c-" + i} />;
                              const state = d === todayDay ? "today" : byDay[d] || null;
                              const isToday = state === "today";
                              const isLogged = state === "logged";
                              const isPlanned = state === "planned";
                              return (
                                <div key={"c-" + i} style={{
                                  aspectRatio: "1",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 11,
                                  fontWeight: isToday || isLogged ? 700 : 500,
                                  fontVariantNumeric: "tabular-nums",
                                  borderRadius: 4,
                                  color: isToday || isLogged ? "#fff" : isPlanned ? C.textSec : C.textMuted,
                                  background: isToday ? C.btn : isLogged ? C.retGood : "transparent",
                                  border: isPlanned ? "1px dashed " + C.border : "1px solid transparent",
                                }}>{d}</div>
                              );
                            })}
                          </div>
                          <div style={{ display: "flex", gap: 10, marginTop: 10, fontSize: 10, color: C.textMuted, flexWrap: "wrap" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: C.retGood }} />logged</span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "transparent", border: "1px dashed " + C.border }} />planned</span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: C.btn }} />today</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* MAIN GRID: rail + main + rai (rai shows on >=1440px) */}
              <div className="rc-grid" style={{ display: "grid", gap: 20, alignItems: "start" }}>

                {/* LEFT RAIL — calendar + queue */}
                <div className="rc-rail" style={{ position: "sticky", top: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* ─── Calendar — current month rhythm ─── */}
                  {(() => {
                    const today = new Date();
                    const year = today.getFullYear();
                    const monthIdx = today.getMonth();
                    const todayDay = today.getDate();
                    const firstDay = new Date(year, monthIdx, 1);
                    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
                    const startCol = firstDay.getDay(); // 0=Sun
                    // Build day states from hcQueue: due_date in current month (not yet done) → planned.
                    // Logged days require a completed-HC fetch which we don't do yet; they'll
                    // light up when that fetch gets wired in. "Today" always wins over planned.
                    const byDay = {};
                    hcQueue.forEach(h => {
                      if (h.due_date) {
                        const d = new Date(h.due_date);
                        if (d.getFullYear() === year && d.getMonth() === monthIdx && d.getDate() >= todayDay) {
                          byDay[d.getDate()] = "planned";
                        }
                      }
                    });
                    // Mark just-completed sessions so the user gets immediate visual feedback
                    Object.keys(hcDone).forEach(clientName => {
                      if (hcDone[clientName]) byDay[todayDay] = "logged";
                    });
                    const loggedCount = Object.values(byDay).filter(s => s === "logged").length;
                    const monthName = today.toLocaleString("en-US", { month: "long" });
                    // Build the grid: 6 rows × 7 cols, fill with null where out-of-month
                    const cells = [];
                    for (let i = 0; i < startCol; i++) cells.push(null);
                    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
                    while (cells.length % 7 !== 0) cells.push(null);
                    const daysHdr = ["S", "M", "T", "W", "T", "F", "S"];
                    return (
                      <div style={{ background: C.card, borderRadius: 12, boxShadow: "var(--rt-sh-card)", padding: "14px" }}>
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
                          <span style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>{monthName} rhythm</span>
                          <span style={{ fontSize: 10.5, color: C.textMuted, fontVariantNumeric: "tabular-nums" }}><b style={{ color: C.text }}>{loggedCount}</b> checks · <b style={{ color: C.text }}>{todayDay}</b>/{daysInMonth}</span>
                        </div>
                        {/* Day-of-week header */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
                          {daysHdr.map((d, i) => (
                            <div key={"h-" + i} style={{ fontSize: 9.5, color: C.textMuted, textAlign: "center", fontWeight: 500 }}>{d}</div>
                          ))}
                        </div>
                        {/* Day grid */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                          {cells.map((d, i) => {
                            if (d === null) return <div key={"c-" + i} />;
                            const state = d === todayDay ? "today" : byDay[d] || null;
                            const isToday = state === "today";
                            const isLogged = state === "logged";
                            const isPlanned = state === "planned";
                            return (
                              <div key={"c-" + i} style={{
                                aspectRatio: "1",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 11,
                                fontWeight: isToday || isLogged ? 700 : 500,
                                fontVariantNumeric: "tabular-nums",
                                borderRadius: 6,
                                color: isToday ? "#fff" : isLogged ? "#fff" : isPlanned ? C.textSec : C.textMuted,
                                background: isToday ? C.btn : isLogged ? C.retGood : "transparent",
                                border: isPlanned ? "1px dashed " + C.border : "1px solid transparent",
                              }}>{d}</div>
                            );
                          })}
                        </div>
                        {/* Legend */}
                        <div style={{ display: "flex", gap: 10, marginTop: 12, fontSize: 10, color: C.textMuted, flexWrap: "wrap" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: C.retGood }} />logged</span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "transparent", border: "1px dashed " + C.border }} />planned</span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: C.btn }} />today</span>
                        </div>
                      </div>
                    );
                  })()}
                  <div style={{ background: C.card, borderRadius: 12, boxShadow: "var(--rt-sh-card)", padding: "14px" }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
                      <span style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>Queue</span>
                      <span style={{ fontSize: 10.5, color: C.textMuted, fontVariantNumeric: "tabular-nums" }}>{activeQueue.length}</span>
                    </div>
                    {activeQueue.length === 0 && (
                      <div style={{ fontSize: 12, color: C.textMuted, fontStyle: "italic", padding: "10px 0" }}>All caught up.</div>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {activeQueue.map((h, i) => {
                        const isOpen = hcOpen === h.client;
                        const overdueDays = h.overdue;
                        const isStartEarly = h.isFirstHC && overdueDays === 0 && h.due !== "Today";
                        const subLabel = overdueDays > 0 ? `${overdueDays}d overdue` : h.due === "Today" ? "Due today" : `Start early · in ${h.daysUntil}d`;
                        const subColor = overdueDays > 0 ? C.retWarn : isStartEarly ? C.btn : C.retOk;
                        return (
                          <div key={i} onClick={() => setHcOpen(isOpen ? null : h.client)}
                            className="rc-queue-item"
                            style={{
                            position: "relative",
                            padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                            background: isOpen ? C.primarySoft : "transparent",
                            border: "1px solid " + (isOpen ? C.primary + "55" : "transparent"),
                            display: "flex", alignItems: "center", gap: 10,
                            transition: "background 140ms",
                          }}>
                            {/* Overdue red dot — top right */}
                            {overdueDays > 0 && (
                              <span style={{ position: "absolute", top: 8, right: 10, width: 7, height: 7, borderRadius: 4, background: C.retCrit }} />
                            )}
                            <div style={{ width: 24, height: 24, borderRadius: 12, background: retColor(h.ret), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, flexShrink: 0 }}>
                              {h.client.split(/\s|&/).filter(Boolean).slice(0,2).map(s=>s[0]).join("").toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 500, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.client}</div>
                              <div style={{ fontSize: 10.5, color: subColor, marginTop: 1 }}>{subLabel}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* MAIN COLUMN */}
                <div style={{ minWidth: 0 }}>
                  {/* ═══════════════════════════════════════════════════════════════
                      OBSERVER CARD — single dark green panel, no flip.
                      Top bar: card name + observation number/week/date.
                      Headline + body, then divider, then metric strip + actions.
                  ═══════════════════════════════════════════════════════════════ */}
                  {/* Observation — rendered TWICE (once for mobile above calendar, once for desktop in this main column). renderObserver returns null when conditions aren't met. */}
                  {!isMobile && renderObserver()}
                  {activeQueue.length === 0 && justCompleted.length === 0 && (
                    <div style={{ textAlign: "center", padding: "60px 20px", background: C.card, borderRadius: 12, boxShadow: "var(--rt-sh-card)" }}>
                      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: C.text }}>All caught up</div>
                      <div style={{ fontSize: 12.5, color: C.textMuted }}>No health checks due right now. Check back when the next one is ready.</div>
                    </div>
                  )}

                  {/* Active HC cards */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {activeQueue.map((h, i) => {
                      const isOpen = hcOpen === h.client;
                      const step = hcStep[h.client] || 0;
                      const answers = hcAnswers[h.client] || [];
                      const allAnswered = answers.length === 5 && answers.every(a => a !== undefined);
                      const client = clients.find(c => c.name === h.client);

                      return (
                        <div key={i} style={{ background: C.card, borderRadius: 12, border: "1px solid " + (isOpen ? C.primary + "55" : C.border), boxShadow: "var(--rt-sh-card)", transition: "border-color 150ms" }}>
                          <div onClick={() => setHcOpen(isOpen ? null : h.client)} style={{ padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 18, background: retColor(h.ret), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                              {h.client.split(/\s|&/).filter(Boolean).slice(0,2).map(s=>s[0]).join("").toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: -0.2 }}>{h.client}</span>
                                <span style={{ fontSize: 12, fontWeight: 700, color: retColor(h.ret), fontVariantNumeric: "tabular-nums" }}>{h.ret}</span>
                                {client?.tag && <span style={{ fontSize: 11, color: C.textMuted }}>· {client.tag}</span>}
                              </div>
                              <div style={{ fontSize: 12, color: h.overdue > 0 ? C.retWarn : (h.isFirstHC && h.due !== "Today") ? C.btn : C.retOk, marginTop: 2, fontWeight: 500 }}>
                                {h.overdue > 0 ? `Overdue by ${h.overdue}d` : h.due === "Today" ? "Due today" : `Start early · due in ${h.daysUntil}d`}
                              </div>
                            </div>
                            {!isOpen && (
                              <button className="r-btn" data-tone="purple" style={{ padding: "8px 16px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{h.isFirstHC && h.due !== "Today" && h.overdue === 0 ? "Start early" : "Start"}</button>
                            )}
                          </div>

                          {/* Expanded HC flow */}
                          {isOpen && (
                            <div style={{ padding: "0 18px 18px", borderTop: "1px solid " + C.borderLight, marginTop: 4 }}>
                              {/* Progress */}
                              <div style={{ display: "flex", gap: 4, margin: "16px 0" }}>
                                {Array.from({ length: hcQuestions.length }).map((_, qi) => (
                                  <div key={qi} style={{ flex: 1, height: 3, borderRadius: 2, background: qi < step || answers[qi] !== undefined ? C.primary : C.borderLight, transition: "background 200ms" }} />
                                ))}
                              </div>

                              {step < hcQuestions.length && (
                                <div style={{ marginBottom: 12 }}>
                                  <p style={{ fontSize: 16, fontWeight: 600, margin: "0 0 14px", lineHeight: 1.4, color: C.text, letterSpacing: -0.2 }}>{hcQuestions[step].q}</p>
                                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {hcQuestions[step].options.map((opt, oi) => {
                                      const isSelected = answers[step] === opt.mod;
                                      return (
                                        <div key={oi} onClick={() => selectAnswer(h.client, step, opt.mod)} style={{
                                          padding: "12px 14px", borderRadius: 8, cursor: "pointer",
                                          background: isSelected ? C.primaryGhost : C.bg,
                                          border: "1px solid " + (isSelected ? C.primary : C.borderLight),
                                          fontSize: 14, color: isSelected ? C.primary : C.textSec,
                                          fontWeight: isSelected ? 600 : 400,
                                          transition: "all 150ms",
                                        }}>{opt.text}</div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {step < hcQuestions.length && (
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
                                  <button onClick={() => step > 0 && setHcStep({ ...hcStep, [h.client]: step - 1 })} style={{ padding: "8px 14px", background: step > 0 ? C.surface : "transparent", color: step > 0 ? C.textSec : "transparent", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: step > 0 ? "pointer" : "default", fontFamily: "inherit" }}>Back</button>
                                  <span style={{ fontSize: 11, color: C.textMuted, fontVariantNumeric: "tabular-nums" }}>{step + 1} of {hcQuestions.length}</span>
                                  {(() => {
                                    const answered = answers[step] !== undefined;
                                    return <button onClick={() => answered && setHcStep({ ...hcStep, [h.client]: step + 1 })} style={{ padding: "8px 18px", background: answered ? C.primary : C.surface, color: answered ? "#fff" : C.textMuted, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: answered ? "pointer" : "default", fontFamily: "inherit" }}>Next</button>;
                                  })()}
                                </div>
                              )}

                              {step >= hcQuestions.length && allAnswered && (() => {
                                if (!hcDone[h.client]) {
                                  setTimeout(() => submitHc(h.client), 0);
                                }
                                return null;
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* ─── Drift Wall — 2D quadrant ─── */}
                  {driftPoints.length > 0 && (() => {
                    const W = 640, H = 380;
                    const padL = 46, padR = 22, padT = 40, padB = 50;
                    const innerW = W - padL - padR;
                    const innerH = H - padT - padB;
                    const xMin = -10, xMax = 20;
                    const yMin = -8, yMax = 6;
                    const xToPx = (x) => padL + ((Math.max(xMin, Math.min(xMax, x)) - xMin) / (xMax - xMin)) * innerW;
                    const yToPx = (y) => padT + innerH - ((Math.max(yMin, Math.min(yMax, y)) - yMin) / (yMax - yMin)) * innerH;
                    const zeroX = xToPx(0);
                    const zeroY = yToPx(0);
                    return (
                      <div style={{ marginTop: 24, background: C.card, borderRadius: 12, boxShadow: "var(--rt-sh-card)", padding: "20px 22px 16px" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
                          <div>
                            <div style={{ fontSize: 10.5, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.4 }}>Drift wall — this month</div>
                            <div style={{ fontSize: 13, color: C.textSec, marginTop: 3 }}>Every client, plotted by how they moved.</div>
                          </div>
                          <div style={{ display: "flex", gap: 14, fontSize: 11, color: C.textSec, flexWrap: "wrap" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: C.retElite }} />Thriving</span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: C.retGood }} />Stable</span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: C.retWarn }} />Shifted</span>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: C.retCrit }} />Declining</span>
                          </div>
                        </div>
                        <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
                          {/* Subtle quadrant tints */}
                          <rect x={padL}   y={padT}   width={zeroX - padL}      height={zeroY - padT}      fill={C.retGood + "10"} />
                          <rect x={zeroX}  y={padT}   width={W - padR - zeroX}  height={zeroY - padT}      fill={C.retWarn + "0A"} />
                          <rect x={padL}   y={zeroY}  width={zeroX - padL}      height={H - padB - zeroY}  fill={C.retWarn + "0A"} />
                          <rect x={zeroX}  y={zeroY}  width={W - padR - zeroX}  height={H - padB - zeroY}  fill={C.retCrit + "10"} />
                          {/* Zero-axis dividers — subtle */}
                          <line x1={zeroX} y1={padT} x2={zeroX} y2={padT + innerH} stroke={C.borderLight} strokeWidth="1" />
                          <line x1={padL} y1={zeroY} x2={padL + innerW} y2={zeroY} stroke={C.borderLight} strokeWidth="1" />
                          {/* Quadrant labels — positioned in the 4 corners, muted */}
                          <text x={padL + 10}          y={padT + 18}          fontSize="10" fontWeight="700" fill={C.retElite} letterSpacing="0.5" opacity="0.75">SCORE ↑ · CADENCE HELD</text>
                          <text x={W - padR - 10}      y={padT + 18}          fontSize="10" fontWeight="700" fill={C.retWarn}  letterSpacing="0.5" opacity="0.75" textAnchor="end">SCORE ↑ · CADENCE SLIP</text>
                          <text x={padL + 10}          y={padT + innerH - 10} fontSize="10" fontWeight="700" fill={C.retWarn}  letterSpacing="0.5" opacity="0.75">SCORE ↓ · CADENCE HELD</text>
                          <text x={W - padR - 10}      y={padT + innerH - 10} fontSize="10" fontWeight="700" fill={C.retCrit}  letterSpacing="0.5" opacity="0.75" textAnchor="end">SCORE ↓ · CADENCE SLIP</text>
                          {/* Axis tick labels */}
                          <text x={padL - 10} y={padT + 6}          fontSize="10" fill={C.textMuted} textAnchor="end">+{yMax}</text>
                          <text x={padL - 10} y={padT + innerH + 4} fontSize="10" fill={C.textMuted} textAnchor="end">{yMin}</text>
                          <text x={padL}            y={H - 14}       fontSize="10.5" fill={C.textMuted}>on-target cadence</text>
                          <text x={padL + innerW}   y={H - 14}       fontSize="10.5" fill={C.textMuted} textAnchor="end">+{xMax} days slower</text>
                          {/* Client dots — colored by drift tier */}
                          {driftPoints.map(({ c, delta, drift }) => {
                            const cx = xToPx(drift);
                            const cy = yToPx(delta);
                            const tier = toDriftTier(clientDrift[c.name]);
                            const color = driftTierColor(tier);
                            const initials = c.name.split(/\s|&/).filter(Boolean).slice(0,2).map(s=>s[0]).join("").toUpperCase();
                            return (
                              <g key={c.id}>
                                <circle cx={cx} cy={cy} r={16} fill={color} opacity="0.95" />
                                <text x={cx} y={cy + 3.8} fontSize="9.5" fontWeight="700" fill="#fff" textAnchor="middle" style={{ pointerEvents: "none", fontFamily: "inherit" }}>{initials}</text>
                              </g>
                            );
                          })}
                        </svg>
                      </div>
                    );
                  })()}

                  {/* Done this month */}
                  {justCompleted.length > 0 && (
                    <div style={{ marginTop: 24, background: C.card, borderRadius: 12, boxShadow: "var(--rt-sh-card)", overflow: "hidden" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "16px 20px 12px", borderBottom: "1px solid " + C.borderLight }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.4 }}>Done this month</span>
                        <span style={{ fontSize: 11, color: C.textMuted }}>Most recent first</span>
                      </div>
                      {justCompleted.map((h, i) => {
                        const tier = toDriftTier(clientDrift[h.client]);
                        const tc = driftTierColor(tier);
                        const initials = h.client.split(/\s|&/).filter(Boolean).slice(0,2).map(s=>s[0]).join("").toUpperCase();
                        return (
                          <div key={"done-" + i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 20px 12px 16px", borderBottom: i < justCompleted.length - 1 ? "1px solid " + C.borderLight : "none" }}>
                            {/* Left priority bar */}
                            <div style={{ width: 3, alignSelf: "stretch", background: tc, borderRadius: 2, flexShrink: 0 }} />
                            {/* Avatar */}
                            <div style={{ width: 28, height: 28, borderRadius: 14, background: tc, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{initials}</div>
                            {/* Name */}
                            <span style={{ fontSize: 13.5, fontWeight: 600, color: C.text, flexShrink: 0 }}>{h.client}</span>
                            {/* Drift pill */}
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 999, border: "1px solid " + tc, color: tc, letterSpacing: 0.4, textTransform: "uppercase", flexShrink: 0 }}>{tier}</span>
                            {/* One-liner stub */}
                            <span style={{ fontSize: 12.5, color: C.textSec, fontStyle: "italic", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{driftStub(tier)}</span>
                            {/* Timestamp — stubbed as "Today" for just-completed checks */}
                            <span style={{ fontSize: 11.5, color: C.textMuted, flexShrink: 0 }}>Today</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Upcoming */}
                  {upcomingQueue.length > 0 && (
                    <div style={{ marginTop: 24 }}>
                      <div onClick={() => setShowUpcoming(!showUpcoming)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 8, cursor: "pointer", background: C.card }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: C.textSec }}>Upcoming · {upcomingQueue.length}</span>
                        <span style={{ fontSize: 12, color: C.textMuted }}>{showUpcoming ? "Hide" : "Show"}</span>
                      </div>
                      {showUpcoming && (
                        <div style={{ background: C.card, borderRadius: 12, overflow: "hidden", marginTop: 6 }}>
                          {upcomingQueue.map((h, i) => (
                            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderBottom: i < upcomingQueue.length - 1 ? "1px solid " + C.borderLight : "none", opacity: 0.6 }}>
                              <span style={{ fontSize: 13, color: C.textSec }}>{h.client}</span>
                              <span style={{ fontSize: 12, color: C.textMuted, fontVariantNumeric: "tabular-nums" }}>In {h.daysUntil}d · {h.due}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* DAYBOOK COLUMN — wide desktop only (>=1440px) */}
                <div className="rc-rai-col" style={{ display: "none", position: "sticky", top: 20, alignSelf: "start" }}>
                  <DaybookPanel
                    entry={daybookEntry}
                    yesterday={daybookYesterday}
                    saveStatus={daybookSaveStatus}
                    onChange={handleDaybookChange}
                  />
                </div>
              </div>
              </>)}
            </div>
          );
        })()}

        {/* ═══ REFERRAL INTELLIGENCE (ENTERPRISE) ═══ */}
        {page === "referral_intel" && tier === "enterprise" && (
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 4 }}>Referral Intelligence</h1>
            <p style={{ fontSize: 14, color: C.textMuted, marginBottom: 16 }}>Rai analyzes your portfolio and ranks clients by referral readiness. No guessing — just data.</p>

            {/* Summary stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
              {[
                { l: "Ready to Ask", v: referralReadiness.filter(r => r.tier === "ready").length, c: C.success },
                { l: "Building", v: referralReadiness.filter(r => r.tier === "building").length, c: C.warning },
                { l: "Not Yet", v: referralReadiness.filter(r => r.tier === "not_yet").length, c: C.textMuted },
              ].map((s, i) => (
                <div key={i} style={{ background: C.card, borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", marginBottom: 3 }}>{s.l}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: s.c }}>{s.v}</div>
                </div>
              ))}
            </div>

            {/* Ready to Ask */}
            {referralReadiness.filter(r => r.tier === "ready").length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.success, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>🎯 Ready to Ask</div>
                {referralReadiness.filter(r => r.tier === "ready").map(c => (
                  <div key={c.id} style={{ background: C.card, borderRadius: 12, padding: "16px", marginBottom: 10, boxShadow: "var(--rt-sh-card)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{c.name}</span>
                        <span style={{ fontSize: 12, color: C.textMuted, marginLeft: 8 }}>{c.contact} · {c.months}mo</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: C.success }}>{c.readiness}%</span>
                        <span style={{ fontSize: 12, color: C.textMuted }}>ready</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                      {c.reasons.map((r, ri) => (
                        <span key={ri} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 4, background: C.primarySoft, color: C.primary, fontWeight: 500 }}>{r}</span>
                      ))}
                    </div>
                    <div style={{ background: C.raiGrad, borderRadius: 12, padding: "14px 16px", color: "#fff" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", color: "rgba(255,255,255,.4)", marginBottom: 6 }}>Rai's Approach</div>
                      <p style={{ fontSize: 14, lineHeight: 1.55, color: "rgba(255,255,255,.7)" }}>{c.approach}</p>
                    </div>
                    <button className="r-btn" data-tone="purple" onClick={() => { setPage("coach"); setAiMessages([{ role: "ai", text: `Let's talk about getting a referral from ${c.contact} at ${c.name}. Here's what I'm thinking: ${c.approach}` }]); }} style={{ width: "100%", marginTop: 10, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Talk to Rai About This</button>
                  </div>
                ))}
              </div>
            )}

            {/* Building Toward It */}
            {referralReadiness.filter(r => r.tier === "building").length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.warning, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>🔄 Building Toward It</div>
                {referralReadiness.filter(r => r.tier === "building").map(c => (
                  <div key={c.id} style={{ background: C.card, borderRadius: 12, padding: "16px", marginBottom: 10, boxShadow: "var(--rt-sh-card)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{c.name}</span>
                        <span style={{ fontSize: 12, color: C.textMuted, marginLeft: 8 }}>{c.contact} · {c.months}mo</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: C.warning }}>{c.readiness}%</span>
                        <span style={{ fontSize: 12, color: C.textMuted }}>ready</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                      {c.reasons.map((r, ri) => (
                        <span key={ri} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 4, background: "#FEF3C7", color: "#92400E", fontWeight: 500 }}>{r}</span>
                      ))}
                    </div>
                    <p style={{ fontSize: 14, color: C.textSec, lineHeight: 1.5 }}>{c.approach}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Not Yet */}
            {referralReadiness.filter(r => r.tier === "not_yet").length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>⏳ Not Yet</div>
                <div style={{ background: C.card, borderRadius: 12, overflow: "hidden" }}>
                  {referralReadiness.filter(r => r.tier === "not_yet").map((c, i, arr) => (
                    <div key={c.id} style={{ padding: "12px 16px", borderBottom: i < arr.length - 1 ? "1px solid " + C.borderLight : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</span>
                        <span style={{ fontSize: 12, color: C.textMuted, marginLeft: 8 }}>{c.contact}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: C.textMuted }}>{c.readiness}%</span>
                        <span style={{ fontSize: 12, color: C.textMuted }}>{c.approach.split(".")[0]}.</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rai blanket */}
            <div style={{ background: C.raiGrad, borderRadius: 14, padding: "16px 18px", color: "#fff", marginTop: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", color: "rgba(255,255,255,.4)", marginBottom: 6 }}>Rai</div>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,.7)", lineHeight: 1.55 }}>Referral readiness is recalculated with every sweep. As relationships deepen and trust builds, clients move up the list. The best time to ask is when they're riding a win.</p>
              <button className="r-btn" data-tone="purple" onClick={() => { setPage("coach"); setAiMessages([{ role: "ai", text: "Let's talk referral strategy. Who are you thinking about asking? I can help you find the right moment and the right words." }]); }} style={{ width: "100%", marginTop: 10, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Talk to Rai</button>
            </div>
          </div>
        )}

        {/* ═══ WORKERS — delegate tasks to team / freelancers ═══ */}
        {page === "workers" && (() => {
          // Inline mini Stat component for the per-worker stat grid
          const Stat = ({ label, value, sub, tone = "default", isText = false }) => {
            const valueColor =
              tone === "danger" ? C.danger :
              tone === "warning" ? C.warning :
              tone === "success" ? C.success :
              C.text;
            return (
              <div>
                <div style={{ fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: C.textMuted, fontWeight: 600 }}>{label}</div>
                <div style={{
                  fontSize: isText ? 13 : 17,
                  fontWeight: isText ? 600 : 700,
                  color: valueColor,
                  marginTop: 3,
                  fontVariantNumeric: "tabular-nums",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>{value}</div>
                {sub && (
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{sub}</div>
                )}
              </div>
            );
          };

          // Distribution row in the Team rail card
          const DistRow = ({ color, count, label, muted = false }) => (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: color, opacity: muted ? 0.5 : 1, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: count > 0 ? C.text : C.textMuted, fontWeight: 600, fontVariantNumeric: "tabular-nums", width: 24 }}>{count}</span>
              <span style={{ fontSize: 12.5, color: C.textMuted }}>{label}</span>
            </div>
          );

          // ─── Stats engine ──────────────────────────────────────────────
          // For each worker, compute throughput, reliability, client mix,
          // and a Worker Impact Score that weights completions by client value.
          // Day boundary at midnight local (matches task rollover at 00:00).
          const _now = new Date();
          const _todayStr = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}-${String(_now.getDate()).padStart(2, "0")}`;
          const _30dAgo = new Date(_now); _30dAgo.setDate(_30dAgo.getDate() - 30);
          const _30dAgoIso = _30dAgo.toISOString();

          // All tasks ever assigned to a worker (for all-time stats).
          // We rely on the in-memory `tasks` array for now; for a deeper history we'd query.
          const allAssigned = tasks.filter(t => !!t.assigned_worker_id);

          // Compute total revenue across clients (for revenue concentration in Impact).
          const totalRevenue = clients.reduce((a, c) => a + (c.revenue || 0), 0) || 1;

          // Per-client value heuristic (used in Impact Score).
          // 0 → low value, ~1 → top-tier value.
          const clientValue = (clientName) => {
            const c = clients.find(x => x.name === clientName);
            if (!c) return 0.3; // unknown client → conservative floor
            const ret = (c.ret || 60) / 100;                 // 0..1
            const conc = (c.revenue || 0) / totalRevenue;     // 0..1
            const tenureBoost = 1 + Math.min((c.months || 0) / 24, 1); // 1..2
            return ret * conc * tenureBoost;
          };

          // Compute per-worker stats.
          //
          // Data sources:
          //   (1) `allAssigned` — open tasks currently assigned to a worker.
          //       From the in-memory `tasks` array (today's open set).
          //       Used for: pending, overdue, currently-open client mix.
          //   (2) `workerCompletions` — historical completion events from
          //       the task_completions table. Persists across day rollovers
          //       and resetRecurring (the in-memory tasks array loses these
          //       on refresh). Used for: all-time completed counts, on-time
          //       rates, time-windowed counts, completion-based client mix.
          //
          // Without (2), refreshing wiped historical completion data because
          // resetRecurring nulls tasks.completed_at every morning.
          const computeStats = (workerId) => {
            const wOpen = allAssigned.filter(t => t.assigned_worker_id === workerId);
            const wCompletions = workerCompletions.filter(c => c.assigned_worker_id === workerId);

            // Pending + overdue come from currently-open tasks only.
            const pending = wOpen.filter(t => !t.done).length;
            const overdue = wOpen.filter(t => !t.done && t.due_date && String(t.due_date).slice(0, 10) < _todayStr).length;

            // Completed counts come from task_completions (persistent history).
            // Each completion row is a discrete event — recurring tasks
            // completed N times produce N rows.
            const completedAll = wCompletions.length;
            const completed30 = wCompletions.filter(c => new Date(c.completed_at).getTime() >= _30dAgo.getTime()).length;

            // "Done" count combines historical completions + tasks that are
            // currently flagged done in the open set. Mostly redundant since
            // a completed task will also have a completion row, but kept for
            // safety in case of any in-flight state where the task row was
            // toggled done but the completion insert hasn't landed yet.
            const wDone = completedAll;
            const wDone30 = completed30;

            // Assigned counts: in-memory open + historical completions
            // (each completion implies that task was assigned at some point).
            // Sums across both axes; doesn't perfectly dedupe (recurring tasks
            // get counted once per completion), which matches throughput
            // semantics — "how many things has this worker done."
            const wTasksAll = wOpen.length + completedAll;
            const wAssigned30 = wOpen.filter(t => {
              const ts = t.created_at || 0;
              return new Date(ts).getTime() >= _30dAgo.getTime();
            }).length + completed30;

            // On-time rates come from completion rows directly. was_on_time
            // is frozen at insert time so it's historically stable.
            const onTimeAll = wCompletions.filter(c => c.was_on_time !== false).length;
            const onTimeRateAll = completedAll > 0 ? Math.round((onTimeAll / completedAll) * 100) : null;

            const wCompletions30 = wCompletions.filter(c => new Date(c.completed_at).getTime() >= _30dAgo.getTime());
            const onTime30 = wCompletions30.filter(c => c.was_on_time !== false).length;
            const onTimeRate30 = wCompletions30.length > 0 ? Math.round((onTime30 / wCompletions30.length) * 100) : null;

            // Client mix — combine open and completed for an honest picture.
            const clientMap = {};
            wOpen.forEach(t => {
              const k = t.client || "(no client)";
              clientMap[k] = (clientMap[k] || 0) + 1;
            });
            wCompletions.forEach(c => {
              const k = c.client_name || "(no client)";
              clientMap[k] = (clientMap[k] || 0) + 1;
            });
            const clientEntries = Object.entries(clientMap).sort((a, b) => b[1] - a[1]);
            const topClient = clientEntries[0]?.[0] || null;
            const clientDiversity = clientEntries.filter(([k]) => k !== "(no client)").length;

            // Top client (last 30d) — same blend, time-windowed.
            const clientMap30 = {};
            wOpen.forEach(t => {
              const ts = t.created_at || 0;
              if (new Date(ts).getTime() < _30dAgo.getTime()) return;
              const k = t.client || "(no client)";
              clientMap30[k] = (clientMap30[k] || 0) + 1;
            });
            wCompletions30.forEach(c => {
              const k = c.client_name || "(no client)";
              clientMap30[k] = (clientMap30[k] || 0) + 1;
            });
            const topClient30 = Object.entries(clientMap30).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

            // ─── Worker Impact Score ───────────────────────────────────
            // Per-completion average impact, scaled to a 0-99 range.
            //
            // For each historical completion:
            //   cv = clientValue(client_name) — 0 if no client mapped
            //   ageDecay = exp(-ageDays / 180) — smooth half-life ~125d
            //   weight = 1.5 if on-time non-recurring,
            //            1.0 if on-time recurring,
            //            0.7 if late (either type)
            //   contribution = weight × cv × ageDecay
            //
            // For each currently-OPEN overdue task:
            //   severity = min(1, daysOverdue / 14) — cap penalty at 14d
            //   penalty = 0.5 × clientValue × severity
            //
            // Impact = average contribution per completion, ×50 to land in
            // 0-99 range. Workers with <5 completions are flagged "building"
            // and the score is shown as a placeholder until they have a
            // real sample size.
            let rawImpact = 0;
            let scorableCompletions = 0; // completions with a real client (cv > 0)
            wCompletions.forEach(c => {
              const cv = clientValue(c.client_name);
              if (cv <= 0) return; // "(no client)" tasks don't contribute to impact
              const ageDays = (Date.now() - new Date(c.completed_at).getTime()) / 86400000;
              const ageDecay = Math.exp(-ageDays / 180);
              const isOnTime = c.was_on_time !== false;
              let weight;
              if (c.is_recurring) {
                weight = isOnTime ? 1.0 : 0.7;
              } else {
                weight = isOnTime ? 1.5 : 0.7;
              }
              rawImpact += weight * cv * ageDecay;
              scorableCompletions++;
            });

            // Severity-scaled overdue penalty.
            wOpen.filter(t => !t.done && t.due_date && String(t.due_date).slice(0, 10) < _todayStr).forEach(t => {
              const cv = clientValue(t.client);
              if (cv <= 0) return;
              const dueMs = new Date(t.due_date).getTime();
              const daysOverdue = Math.max(0, (Date.now() - dueMs) / 86400000);
              const severity = Math.min(1, daysOverdue / 14);
              rawImpact -= 0.5 * cv * severity;
            });

            // Per-completion average impact. Avoids the previous sqrt-divisor
            // bug where doubling completions made the score go DOWN.
            const avgImpact = scorableCompletions > 0 ? rawImpact / scorableCompletions : 0;
            let impact = Math.round(avgImpact * 50);
            impact = Math.max(0, Math.min(99, impact));

            // "Building track record" if < 5 scorable completions.
            const isBuilding = scorableCompletions < 5;

            return {
              wTasksAll, wDone, wAssigned30, wDone30,
              pending, overdue,
              onTimeRateAll, onTimeRate30,
              completedAll, completed30,
              topClient, topClient30, clientDiversity,
              impact, isBuilding,
            };
          };

          // Build stats map
          const statsByWorker = {};
          workersList.forEach(w => { statsByWorker[w.id] = computeStats(w.id); });

          // Subhead aggregates
          const teamPending = workersList.reduce((a, w) => a + (statsByWorker[w.id]?.pending || 0), 0);
          const teamOnTimeRate = (() => {
            // Aggregate completion + on-time across team
            let totalCompleted = 0, totalOnTime = 0;
            workersList.forEach(w => {
              const s = statsByWorker[w.id];
              if (s?.onTimeRateAll != null && s.completedAll > 0) {
                totalCompleted += s.completedAll;
                totalOnTime += Math.round(s.completedAll * (s.onTimeRateAll / 100));
              }
            });
            return totalCompleted > 0 ? Math.round((totalOnTime / totalCompleted) * 100) : null;
          })();

          // Comparative: leaderboards
          const sortedByImpact = [...workersList]
            .map(w => ({ w, s: statsByWorker[w.id] }))
            .filter(x => !x.s.isBuilding)
            .sort((a, b) => b.s.impact - a.s.impact);
          const sortedByVolume = [...workersList]
            .map(w => ({ w, s: statsByWorker[w.id] }))
            .sort((a, b) => b.s.completed30 - a.s.completed30);

          // ─── Left-rail aggregations ─────────────────────────────────
          // Avg Impact (only includes workers with track record)
          const scorableWorkers = workersList.filter(w => !statsByWorker[w.id].isBuilding);
          const avgImpact = scorableWorkers.length
            ? Math.round(scorableWorkers.reduce((a, w) => a + statsByWorker[w.id].impact, 0) / scorableWorkers.length)
            : null;

          // Distribution buckets (mirrors Clients page Thriving/Healthy/Watch/At-risk/Critical)
          const distHigh   = workersList.filter(w => !statsByWorker[w.id].isBuilding && statsByWorker[w.id].impact >= 70).length;
          const distSolid  = workersList.filter(w => !statsByWorker[w.id].isBuilding && statsByWorker[w.id].impact >= 40 && statsByWorker[w.id].impact < 70).length;
          const distLow    = workersList.filter(w => !statsByWorker[w.id].isBuilding && statsByWorker[w.id].impact < 40).length;
          const distBuild  = workersList.filter(w => statsByWorker[w.id].isBuilding).length;

          // Lifetime team task count + avg time-to-complete
          const allCompletedAcrossTeam = allAssigned.filter(t => t.done && (t.completed_at || t.worker_completed_at));
          const lifetimeTasksDone = allCompletedAcrossTeam.length;
          // Avg time-to-complete (days). created_at → completed_at/worker_completed_at.
          const avgDaysToComplete = (() => {
            if (allCompletedAcrossTeam.length === 0) return null;
            const total = allCompletedAcrossTeam.reduce((acc, t) => {
              const start = t.created_at ? new Date(t.created_at).getTime() : null;
              const end = (t.completed_at || t.worker_completed_at) ? new Date(t.completed_at || t.worker_completed_at).getTime() : null;
              if (!start || !end || end < start) return acc;
              return acc + (end - start) / 86400000;
            }, 0);
            return Math.round((total / allCompletedAcrossTeam.length) * 10) / 10; // 1 decimal
          })();

          // Most-tenured worker (longest with us by created_at)
          const mostTenured = (() => {
            if (workersList.length === 0) return null;
            const sorted = [...workersList].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
            const w = sorted[0];
            if (!w.created_at) return null;
            const months = Math.max(1, Math.round((Date.now() - new Date(w.created_at).getTime()) / (86400000 * 30)));
            return { name: w.name, months };
          })();

          // Recent movement: completions last 7d vs prior 7d
          const _7dAgo = new Date(_now); _7dAgo.setDate(_7dAgo.getDate() - 7);
          const _14dAgo = new Date(_now); _14dAgo.setDate(_14dAgo.getDate() - 14);
          const movementByWorker = workersList.map(w => {
            const wTasks = allAssigned.filter(t => t.assigned_worker_id === w.id);
            const completed = wTasks.filter(t => t.done && (t.completed_at || t.worker_completed_at));
            const last7 = completed.filter(t => {
              const c = new Date(t.completed_at || t.worker_completed_at);
              return c >= _7dAgo;
            }).length;
            const prior7 = completed.filter(t => {
              const c = new Date(t.completed_at || t.worker_completed_at);
              return c >= _14dAgo && c < _7dAgo;
            }).length;
            return { w, last7, prior7, delta: last7 - prior7 };
          });
          const climbing = [...movementByWorker]
            .filter(x => x.delta > 0)
            .sort((a, b) => b.delta - a.delta)
            .slice(0, 3);
          const slipping = [...movementByWorker]
            .filter(x => x.delta < 0)
            .sort((a, b) => a.delta - b.delta)
            .slice(0, 3);

          return (
            <div style={{ width: "100%" }}>
              {/* STATUS BAND — mirrors Clients page exactly (border, spacing, alignment) */}
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "4px 4px 20px", marginBottom: 20, borderBottom: "1px solid " + C.borderLight }}>
                <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                  <div style={{ fontSize: 11.5, color: C.textMuted, letterSpacing: 0.3, marginBottom: 4 }}>Your team</div>
                  <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: -0.4, color: C.text }}>Workers</h1>
                  <div style={{ fontSize: 13.5, color: C.textMuted, marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span><b style={{ color: C.text, fontWeight: 700 }}>{workersList.length}</b> {workersList.length === 1 ? "worker" : "workers"}</span>
                    <span style={{ color: C.border }}>·</span>
                    <span><b style={{ color: C.text, fontWeight: 700 }}>{teamPending}</b> pending</span>
                    <span style={{ color: C.border }}>·</span>
                    {teamOnTimeRate != null ? (
                      <span><b style={{ color: teamOnTimeRate >= 80 ? C.success : teamOnTimeRate >= 60 ? C.warning : C.danger, fontWeight: 700 }}>{teamOnTimeRate}%</b> on-time</span>
                    ) : (
                      <span style={{ color: C.textMuted, fontStyle: "italic" }}>building track record</span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button
                    className="r-btn" data-tone="purple"
                    onClick={() => { setNewWorkerName(""); setNewWorkerEmail(""); setNewWorkerRole(""); setAddWorkerOpen(true); }}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "10px 16px",
                      background: C.btn, color: "#fff",
                      border: "none", borderRadius: 10,
                      fontSize: 13.5, fontWeight: 600,
                      cursor: "pointer", fontFamily: "inherit",
                      boxShadow: "0 1px 2px rgba(91,33,182,0.15), 0 2px 6px rgba(91,33,182,0.22)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Add Worker
                  </button>
                </div>
              </div>

              {workersList.length === 0 ? (
                <div style={{ padding: "60px 20px", textAlign: "center", border: "1px dashed " + C.borderLight, borderRadius: 14 }}>
                  <div style={{
                    fontFamily: "'Fraunces', Georgia, serif",
                    fontVariationSettings: "'opsz' 96, 'SOFT' 50, 'WONK' 0",
                    fontStyle: "italic",
                    fontSize: 16,
                    color: C.textMuted,
                    marginBottom: 4,
                  }}>No workers yet.</div>
                  <div style={{ fontSize: 13, color: C.textMuted }}>Add someone you delegate tasks to — internal employee, freelancer, VA. They'll get an email when you assign them work.</div>
                </div>
              ) : (
                <div className="rc-grid" style={{ display: "grid", gap: 20, alignItems: "start" }}>
                  {/* LEFT RAIL — Team / Team History / Recent Movement */}
                  <div className="rc-rail" style={{ position: "sticky", top: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                    {/* Card 1: TEAM (mirrors Portfolio) */}
                    <div style={{ background: C.card, borderRadius: 12, boxShadow: "var(--rt-sh-card)", padding: "14px" }}>
                      <div style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 10 }}>Team</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                        <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
                          <svg width={64} height={64} style={{ transform: "rotate(-90deg)" }}>
                            <circle cx={32} cy={32} r={28} fill="none" stroke={C.borderLight} strokeWidth="3" />
                            {avgImpact != null && (
                              <circle cx={32} cy={32} r={28} fill="none"
                                stroke={avgImpact >= 70 ? C.success : avgImpact >= 40 ? C.warning : C.danger}
                                strokeWidth="3" strokeLinecap="round"
                                strokeDasharray={2 * Math.PI * 28}
                                strokeDashoffset={2 * Math.PI * 28 * (1 - avgImpact / 100)} />
                            )}
                          </svg>
                          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <div style={{ fontSize: 19, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums", letterSpacing: -0.3, lineHeight: 1 }}>{avgImpact != null ? avgImpact : "—"}</div>
                          </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                            <span style={{ fontSize: 11.5, color: C.textMuted }}>Workers</span>
                            <span style={{ fontSize: 12, color: C.textSec, fontVariantNumeric: "tabular-nums" }}>{workersList.length}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                            <span style={{ fontSize: 11.5, color: C.textMuted }}>Pending</span>
                            <span style={{ fontSize: 12, color: C.textSec, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{teamPending}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                            <span style={{ fontSize: 11.5, color: C.textMuted }}>On-time</span>
                            <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums", fontWeight: 600, color: teamOnTimeRate == null ? C.textMuted : teamOnTimeRate >= 80 ? C.success : teamOnTimeRate >= 60 ? C.warning : C.danger }}>
                              {teamOnTimeRate != null ? `${teamOnTimeRate}%` : "—"}
                            </span>
                          </div>
                        </div>
                      </div>
                      {/* Distribution bar — mirrors Clients health distribution */}
                      <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", background: C.borderLight, marginBottom: 10 }}>
                        {distHigh > 0 && <div style={{ background: C.success, flex: distHigh }} />}
                        {distSolid > 0 && <div style={{ background: C.warning, flex: distSolid }} />}
                        {distLow > 0 && <div style={{ background: C.danger, flex: distLow }} />}
                        {distBuild > 0 && <div style={{ background: C.textMuted, opacity: 0.4, flex: distBuild }} />}
                      </div>
                      {/* Bucket counts */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <DistRow color={C.success} count={distHigh} label="High impact" />
                        <DistRow color={C.warning} count={distSolid} label="Solid" />
                        <DistRow color={C.danger} count={distLow} label="Underperforming" />
                        <DistRow color={C.textMuted} count={distBuild} label="Building" muted />
                      </div>
                    </div>

                    {/* Card 2: TEAM HISTORY */}
                    <div style={{ background: C.card, borderRadius: 12, boxShadow: "var(--rt-sh-card)", padding: "14px" }}>
                      <div style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 10 }}>Team history</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 22, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums", letterSpacing: -0.5, lineHeight: 1.05 }}>{lifetimeTasksDone}</div>
                          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>Tasks done</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 22, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums", letterSpacing: -0.5, lineHeight: 1.05 }}>
                            {avgDaysToComplete != null ? `${avgDaysToComplete}d` : "—"}
                          </div>
                          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>Avg time</div>
                        </div>
                      </div>
                      {mostTenured && (
                        <div style={{ paddingTop: 10, borderTop: "1px solid " + C.borderLight, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                          <span style={{ fontSize: 11.5, color: C.textMuted }}>Most tenured</span>
                          <div style={{ display: "flex", gap: 6, alignItems: "baseline", minWidth: 0 }}>
                            <span style={{ fontSize: 12, color: C.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mostTenured.name}</span>
                            <span style={{ fontSize: 11, color: C.textMuted, flexShrink: 0 }}>{mostTenured.months >= 12 ? `${(mostTenured.months / 12).toFixed(1)} yr` : `${mostTenured.months} mo`}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card 3: RECENT MOVEMENT */}
                    <div style={{ background: C.card, borderRadius: 12, boxShadow: "var(--rt-sh-card)", padding: "14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                        <div style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>Recent movement</div>
                        <div style={{ fontSize: 10.5, color: C.textMuted }}>7d</div>
                      </div>
                      {climbing.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: C.success, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 6 }}>More active</div>
                          {climbing.map(({ w, delta }) => (
                            <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
                              <div style={{ width: 22, height: 22, borderRadius: 11, background: C.primary, color: "#fff", fontSize: 9, fontWeight: 700, display: "grid", placeItems: "center", flexShrink: 0 }}>{getWorkerInitials(w.name)}</div>
                              <span style={{ flex: 1, fontSize: 13, color: C.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.name}</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: C.success, fontVariantNumeric: "tabular-nums" }}>+{delta}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {slipping.length > 0 && (
                        <div>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: C.warning, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 6 }}>Gone quiet</div>
                          {slipping.map(({ w, delta }) => (
                            <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
                              <div style={{ width: 22, height: 22, borderRadius: 11, background: C.primary, color: "#fff", fontSize: 9, fontWeight: 700, display: "grid", placeItems: "center", flexShrink: 0 }}>{getWorkerInitials(w.name)}</div>
                              <span style={{ flex: 1, fontSize: 13, color: C.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.name}</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: C.warning, fontVariantNumeric: "tabular-nums" }}>{delta}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {climbing.length === 0 && slipping.length === 0 && (
                        <div style={{ fontSize: 12, color: C.textMuted, fontStyle: "italic", padding: "4px 0" }}>No movement to report yet</div>
                      )}
                    </div>
                  </div>

                  {/* MAIN COLUMN — leaderboards + worker rows */}
                  <div style={{ minWidth: 0 }}>
                  {/* Comparative — Team Leaderboards */}
                  {workersList.length >= 2 && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginBottom: 20 }}>
                      {/* Impact leaderboard */}
                      <div style={{ background: C.card, borderRadius: 12, padding: "14px 16px" }}>
                        <div style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, color: C.textMuted, marginBottom: 8 }}>Impact · last 90 days</div>
                        {sortedByImpact.length === 0 ? (
                          <div style={{ fontSize: 12, color: C.textMuted, fontStyle: "italic" }}>Not enough completed tasks yet</div>
                        ) : sortedByImpact.slice(0, 3).map(({ w, s }, i) => (
                          <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
                            <span style={{ fontSize: 11, color: C.textMuted, fontVariantNumeric: "tabular-nums", width: 14 }}>{i + 1}</span>
                            <span style={{ flex: 1, fontSize: 13, color: C.text, fontWeight: 500 }}>{w.name}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: s.impact >= 70 ? C.success : s.impact >= 40 ? C.text : C.warning, fontVariantNumeric: "tabular-nums" }}>{s.impact}</span>
                          </div>
                        ))}
                      </div>
                      {/* Volume leaderboard */}
                      <div style={{ background: C.card, borderRadius: 12, padding: "14px 16px" }}>
                        <div style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, color: C.textMuted, marginBottom: 8 }}>Throughput · last 30 days</div>
                        {sortedByVolume.slice(0, 3).map(({ w, s }, i) => (
                          <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
                            <span style={{ fontSize: 11, color: C.textMuted, fontVariantNumeric: "tabular-nums", width: 14 }}>{i + 1}</span>
                            <span style={{ flex: 1, fontSize: 13, color: C.text, fontWeight: 500 }}>{w.name}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums" }}>{s.completed30}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Worker rows */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {workersList.map(w => {
                      const s = statsByWorker[w.id];
                      const initials = getWorkerInitials(w.name);
                      return (
                        <div key={w.id} style={{
                          padding: "16px 18px",
                          background: C.card,
                          borderRadius: 12,
                        }}>
                          {/* Top row: avatar + name + impact + remove */}
                          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 20, background: C.primary, color: "#fff", fontSize: 13, fontWeight: 700, display: "grid", placeItems: "center", flexShrink: 0 }}>{initials}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{w.name}</div>
                              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                                {w.email}{w.role ? " · " + w.role : ""}
                              </div>
                            </div>
                            {!s.isBuilding && (
                              <div style={{ textAlign: "right", flexShrink: 0 }}>
                                <div style={{ fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: C.textMuted, fontWeight: 600 }}>Impact</div>
                                <div style={{ fontSize: 22, fontWeight: 700, color: s.impact >= 70 ? C.success : s.impact >= 40 ? C.text : C.warning, fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>{s.impact}</div>
                              </div>
                            )}
                            <button
                              onClick={async () => {
                                if (!confirm(`Remove ${w.name}? Their assigned tasks stay assigned for history.`)) return;
                                await workersDb.archive(w.id);
                                setWorkersList(prev => prev.filter(x => x.id !== w.id));
                              }}
                              style={{ width: 28, height: 28, background: "transparent", border: 0, borderRadius: 6, color: C.textMuted, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}
                              title="Remove worker"
                            >
                              <Icon name="x" size={14} />
                            </button>
                          </div>

                          {/* Stats grid */}
                          <div style={{
                            marginTop: 14,
                            paddingTop: 14,
                            borderTop: "1px solid " + C.borderLight,
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                            gap: 12,
                          }}>
                            <Stat
                              label="Pending"
                              value={s.pending}
                              sub={s.overdue > 0 ? `${s.overdue} overdue` : null}
                              tone={s.overdue > 0 ? "danger" : "default"}
                            />
                            <Stat
                              label="Done · 30d"
                              value={s.completed30}
                              sub={`${s.completedAll} all-time`}
                            />
                            <Stat
                              label="On-time · 30d"
                              value={s.onTimeRate30 != null ? `${s.onTimeRate30}%` : "—"}
                              sub={s.onTimeRateAll != null ? `${s.onTimeRateAll}% all-time` : "no data"}
                              tone={s.onTimeRate30 != null && s.onTimeRate30 < 60 ? "warning" : "default"}
                            />
                            <Stat
                              label="Top client"
                              value={s.topClient30 || "—"}
                              sub={s.clientDiversity ? `${s.clientDiversity} client${s.clientDiversity === 1 ? "" : "s"} total` : "no clients yet"}
                              isText
                            />
                          </div>

                          {s.isBuilding && (
                            <div style={{
                              marginTop: 12,
                              padding: "8px 12px",
                              background: C.surfaceWarm,
                              borderRadius: 8,
                              fontSize: 11.5,
                              color: C.textMuted,
                              fontStyle: "italic",
                            }}>
                              Building track record — Impact score appears once {w.name.split(' ')[0]} has completed 5+ tasks.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  </div>
                  {/* DAYBOOK COLUMN — wide desktop only (>=1440px), shared global notes */}
                  <div className="rc-rai-col" style={{ display: "none", position: "sticky", top: 20, alignSelf: "start" }}>
                    <DaybookPanel
                      entry={daybookEntry}
                      yesterday={daybookYesterday}
                      saveStatus={daybookSaveStatus}
                      onChange={handleDaybookChange}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Add-worker modal */}
        {addWorkerOpen && (
          <>
            <div onClick={() => setAddWorkerOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(20,30,22,0.40)", zIndex: 99 }} />
            <div style={{
              position: "fixed", top: "20vh", left: "50%", transform: "translateX(-50%)",
              width: 460, maxWidth: "calc(100vw - 32px)",
              background: C.card, borderRadius: 14, padding: "24px 26px",
              boxShadow: "0 20px 50px rgba(20,30,22,0.30)",
              zIndex: 100,
            }}>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 14px" }}>Add Worker</h3>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: C.textSec, marginBottom: 5, letterSpacing: "0.02em" }}>Name</label>
                <input
                  autoFocus
                  value={newWorkerName}
                  onChange={e => setNewWorkerName(e.target.value)}
                  placeholder="Sarah Kim"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, fontFamily: "inherit", fontSize: 13.5, color: C.text, background: C.bg, outline: "none" }}
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: C.textSec, marginBottom: 5, letterSpacing: "0.02em" }}>Email</label>
                <input
                  type="email"
                  value={newWorkerEmail}
                  onChange={e => setNewWorkerEmail(e.target.value)}
                  placeholder="sarah@yourdomain.com"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, fontFamily: "inherit", fontSize: 13.5, color: C.text, background: C.bg, outline: "none" }}
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: C.textSec, marginBottom: 5, letterSpacing: "0.02em" }}>Role <span style={{ color: C.textMuted, fontWeight: 400 }}>· optional</span></label>
                <input
                  value={newWorkerRole}
                  onChange={e => setNewWorkerRole(e.target.value)}
                  placeholder="Internal · Freelancer · VA"
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, fontFamily: "inherit", fontSize: 13.5, color: C.text, background: C.bg, outline: "none" }}
                />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22, paddingTop: 18, borderTop: "1px solid " + C.borderLight }}>
                <button
                  onClick={() => setAddWorkerOpen(false)}
                  style={{ padding: "8px 14px", background: "transparent", color: C.textSec, borderRadius: 8, fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >Cancel</button>
                <button
                  onClick={async () => {
                    if (!newWorkerName.trim() || !newWorkerEmail.trim()) return;
                    const { data, error } = await workersDb.create(user.id, {
                      name: newWorkerName.trim(),
                      email: newWorkerEmail.trim(),
                      role: newWorkerRole.trim() || null,
                    });
                    if (data) {
                      setWorkersList(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
                      setAddWorkerOpen(false);
                    } else if (error) {
                      alert("Failed to add worker: " + error.message);
                    }
                  }}
                  disabled={!newWorkerName.trim() || !newWorkerEmail.trim()}
                  style={{
                    padding: "8px 14px",
                    background: (!newWorkerName.trim() || !newWorkerEmail.trim()) ? C.btnDisabled : C.btn,
                    color: "#fff", border: "none", borderRadius: 8,
                    fontFamily: "inherit", fontSize: 13, fontWeight: 600,
                    cursor: (!newWorkerName.trim() || !newWorkerEmail.trim()) ? "default" : "pointer",
                  }}
                >Add Worker</button>
              </div>
            </div>
          </>
        )}

        {/* ═══ REFERRALS v2 — "The Network Map" ═══ */}
        {page === "referrals" && (() => {
          try {
          // ─── Helpers ───────────────────────────────────────────────────
          const AVATAR_COLORS = ["#1F7A5C", "#2C9A76", "#0C3A2E", C.btn, "#D17A1B", "#12523F"];
          const getInitials = (name) => (name || "?").split(/\s+/).map(w => w[0]).filter(Boolean).join("").slice(0, 2).toUpperCase();
          const getAvatarColor = (id) => { const s = String(id || ""); let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return AVATAR_COLORS[h % AVATAR_COLORS.length]; };
          const Avatar = ({ id, name, size = 32 }) => (
            <div style={{ width: size, height: size, borderRadius: size / 2, flexShrink: 0, background: getAvatarColor(id), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.32, fontWeight: 600, letterSpacing: 0.2 }}>{getInitials(name)}</div>
          );

          // ─── Aggregates ─────────────────────────────────────────────────
          const totalRefs = refs.length;
          const activeRefs = refs.filter(r => r.status === "converted" || (r.converted && r.status !== "closed"));
          const becameClients = activeRefs.length;
          const mrrAdded = activeRefs.reduce((a, r) => a + (r.revenue || 0), 0);
          const avgTenureMo = clients.length ? clients.reduce((a, c) => a + (c.months || 0), 0) / clients.length : 24;
          const projLCV = Math.round(mrrAdded * Math.max(12, avgTenureMo));

          // ─── Ask-next scoring algorithm ─────────────────────────────────
          // 6-factor weighted, bell curves for Comm Freq + Stress Response.
          // Profile scores are 1-10 per dimension. Missing = treat as 5 (neutral).
          //   Loyalty 30% · Depth 30% · Decision Making 10% · Comm Tone 10% ·
          //   Comm Frequency 10% (bell) · Stress Response 10% (bell)
          const bellScore = (v) => {
            // Peak at 5 → 100. Distance from 5 penalizes linearly.
            // 5=100, 4|6=80, 3|7=60, 2|8=40, 1|9=20, 0|10=0
            if (v == null) return 50;
            const d = Math.abs(5 - v);
            return Math.max(0, 100 - d * 20);
          };
          const linearScore = (v) => {
            // Higher = better. 1→10, 10→100
            if (v == null) return 50;
            return Math.max(0, Math.min(100, v * 10));
          };
          const calcAskScore = (client) => {
            const p = client.profile_scores || client.profile || {};
            const loyalty = linearScore(p.loyalty);
            const depth = linearScore(p.relationship_depth ?? p.depth);
            const decision = linearScore(p.decision_making ?? p.decisionMaking);
            const tone = linearScore(p.communication_tone ?? p.commTone);
            const freq = bellScore(p.communication_frequency ?? p.commFrequency);
            const stress = bellScore(p.stress_response ?? p.stressResponse);
            const score = loyalty * 0.30 + depth * 0.30 + decision * 0.10 + tone * 0.10 + freq * 0.10 + stress * 0.10;
            return Math.round(score);
          };

          // Build ask queue: clients who haven't been referral sources AND haven't been acted on.
          // Rank by score. Keep top 3 (per design).
          const referredFrom = new Set(refs.map(r => r.from));
          const askQueue = [...clients]
            .filter(c => !referredFrom.has(c.name) && !askActed.has(c.name))
            .map(c => ({ ...c, askScore: calcAskScore(c) }))
            .filter(c => c.askScore >= 55) // signal threshold
            .sort((a, b) => b.askScore - a.askScore)
            .slice(0, 3);

          // Strength label from score
          const strengthFor = (score) => score >= 80 ? { label: "STRONG", color: C.retGood, bg: "#E8F3EC" } : { label: "MEDIUM", color: C.retOk, bg: "#F6F4E5" };

          // Primer text — Rai-generated in production; for now use rules-based primers keyed off strongest signal.
          // In a future pass, these get pulled from rai_ask_primers table populated by the monthly sweep.
          const getPrimer = (client) => {
            const p = client.profile_scores || client.profile || {};
            const loyalty = p.loyalty || 5;
            const depth = p.relationship_depth ?? p.depth ?? 5;
            if (loyalty >= 8 && depth >= 8) return "They're vocal fans and know you deeply — this is as ripe as an ask gets.";
            if (loyalty >= 8) return "Strong loyalty. They'll want to help even if the relationship is still building.";
            if (depth >= 8) return "Deep relationship. They understand your value enough to describe it to someone else.";
            if ((client.ret || 0) >= 85) return "Their health has held elite for months. Predictable thrivers make reliable asks.";
            return "Signals look right. Timing matters more than the script here.";
          };

          // Active ask — selected from queue, defaults to top of queue
          const activeAsk = askQueue.find(c => c.name === askActiveId) || askQueue[0];

          // Tone-shifted draft template
          const buildDraft = (client, tone) => {
            if (!client) return "";
            const firstName = (client.contact || client.name).split(/\s+/)[0];
            if (tone === "softer") {
              return `Hi ${firstName},\n\nHope you're doing well. I've been thinking about who in your network might benefit from what we do together — no pressure at all. If anyone comes to mind, I'd love an intro. If not, no worries.\n\nAppreciate you either way.\n\n[Your name]`;
            } else if (tone === "firmer") {
              return `Hi ${firstName},\n\nQuick ask: who are 2-3 people in your network who'd benefit from what we've built together? I'm looking to take on one or two more clients like you this quarter, and the best ones always come from intros.\n\nHappy to write the first email so you just forward it.\n\n[Your name]`;
            }
            return `Hi ${firstName},\n\nI'm reaching out because clients like you are my best source of new work. If anyone in your network could use what we do, I'd love an introduction — even a quick "here's someone worth a call" email works.\n\nNo rush. Just know the door's open.\n\n[Your name]`;
          };

          // Draft shown in textarea: user's edits take priority; otherwise compute from active + tone.
          // This avoids setState-in-render while still showing a populated draft by default.
          const draftIsUserEdited = askDraft && askActiveId === activeAsk?.name;
          const displayedDraft = draftIsUserEdited ? askDraft : (activeAsk ? buildDraft(activeAsk, askTone) : "");

          const markAsked = (client) => {
            const next = new Set(askActed);
            next.add(client.name);
            setAskActed(next);
            try { localStorage.setItem("rt-ask-acted", JSON.stringify(Array.from(next))); } catch {}
            setAskActiveId(null);
            setAskDraft("");
          };

          // ─── Network Map data ────────────────────────────────────────────
          // Referrers = clients who have sent at least one referral.
          // Build: { id, name, revenue, children: [{ id, name, mrr, status }] }
          //
          // Bug fix May 2026: the hydrated ref object has `to` (mapped from DB
          // column `referred_to`), not `name`. Reading r.name fell through to
          // "Untitled" for every saved referral. Order is r.to → r.name → fallback.
          const referrerMap = {};
          refs.forEach(r => {
            const fromName = r.from || "Unknown";
            if (!referrerMap[fromName]) referrerMap[fromName] = { id: fromName, name: fromName, revenue: 0, children: [] };
            const childName = r.to || r.name || null;
            referrerMap[fromName].children.push({
              id: r.id || "ref-" + Math.random().toString(36).slice(2, 8),
              name: childName,
              hasName: !!childName,
              mrr: r.revenue || 0,
              totalRevenue: r.totalRevenue || r.total_revenue || 0,
              status: r.status || "pending",
              on: r.on || r.date,
            });
            referrerMap[fromName].revenue += (r.revenue || 0);
          });
          const referrers = Object.values(referrerMap);

          // ─── Render ─────────────────────────────────────────────────────
          return (
            <div style={{ width: "100%" }}>
              {!dataLoaded && (
                <div style={{ width: "100%" }}>
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "4px 4px 20px", marginBottom: 20, borderBottom: "1px solid " + C.borderLight, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                      <div style={{ fontSize: 11.5, color: C.textMuted, letterSpacing: 0.3, marginBottom: 4 }}>Word of mouth · this quarter</div>
                      <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: -0.4, color: C.text }}>Referrals</h1>
                    </div>
                  </div>
                  <SkeletonClientList rows={4} />
                </div>
              )}
              {dataLoaded && totalRefs === 0 && (
                <>
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "4px 4px 20px", marginBottom: 20, borderBottom: "1px solid " + C.borderLight, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                      <div style={{ fontSize: 11.5, color: C.textMuted, letterSpacing: 0.3, marginBottom: 4 }}>Word of mouth · this quarter</div>
                      <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: -0.4, color: C.text }}>Referrals</h1>
                    </div>
                  </div>
                  <EmptyState
                    icon="referrals"
                    headline="No referrals tracked yet."
                    body="Log who sent you to whom and Retayned starts surfacing your quiet sources — the clients quietly compounding your book without ever being asked."
                    cta={{ label: "Log Referral", onClick: () => setRefForm(true) }}
                  />
                </>
              )}
              {dataLoaded && totalRefs > 0 && (<>
              {/* STATUS BAND */}
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "4px 4px 20px", marginBottom: 20, borderBottom: "1px solid " + C.borderLight, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                  <div style={{ fontSize: 11.5, color: C.textMuted, letterSpacing: 0.3, marginBottom: 4 }}>Word of mouth · this quarter</div>
                  <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: -0.4, color: C.text }}>Referrals</h1>
                  <div style={{ fontSize: 13.5, color: C.textMuted, marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span><b style={{ color: C.text, fontWeight: 700 }}>{totalRefs}</b> referrals</span>
                    <span style={{ color: C.border }}>·</span>
                    <span><b style={{ color: C.text, fontWeight: 700 }}>{becameClients}</b> became clients</span>
                    <span style={{ color: C.border }}>·</span>
                    <span><b style={{ color: C.retGood, fontWeight: 700 }}>${mrrAdded.toLocaleString()}</b>/mo added</span>
                    {projLCV > 0 && <>
                      <span style={{ color: C.border }}>·</span>
                      <span><b style={{ color: C.btn, fontWeight: 700 }}>${projLCV.toLocaleString()}</b> projected LCV</span>
                    </>}
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <button className="r-btn" data-tone="purple" onClick={() => setRefForm(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", background: C.btn, color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 1px 2px rgba(91,33,182,0.15), 0 2px 6px rgba(91,33,182,0.22)", whiteSpace: "nowrap" }}>
                    Log Referral
                  </button>
                </div>
              </div>

              {/* MAIN GRID: rail + main + rai (rai shows on >=1440px) */}
              <div className="rc-grid" style={{ display: "grid", gap: 20, alignItems: "start" }}>

                {/* LEFT RAIL: Who to ask next */}
                <div className="rc-rail" style={{ display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 0, alignSelf: "start" }}>
                  <div style={{ background: C.card, borderRadius: 12, boxShadow: "var(--rt-sh-card)", overflow: "hidden" }}>
                    <div style={{ padding: "12px 14px 10px", borderBottom: "1px solid " + C.borderLight }}>
                      <div style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>Who to ask next</div>
                      <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 3 }}>Strongest signals first</div>
                    </div>
                    {askQueue.length === 0 ? (
                      <div style={{ padding: "20px 14px", textAlign: "center" }}>
                        <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.5 }}>No strong referral asks right now.</div>
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>Build deeper profiles on your clients to unlock new asks.</div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        {askQueue.map((q, i) => {
                          const isActive = activeAsk?.name === q.name;
                          const st = strengthFor(q.askScore);
                          return (
                            <button key={q.name} onClick={() => { setAskActiveId(q.name); setAskDraft(""); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: isActive ? C.primarySoft : "transparent", border: "none", borderBottom: i === askQueue.length - 1 ? "none" : "1px solid " + C.borderLight, borderLeft: isActive ? "3px solid " + C.primary : "3px solid transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "background 120ms" }}>
                              <Avatar id={q.name} name={q.name} size={30} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12.5, color: C.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.name}</div>
                                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Score {q.askScore} · {q.months || 0}mo tenure</div>
                              </div>
                              <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 3, letterSpacing: 0.3, whiteSpace: "nowrap", flexShrink: 0, color: q.askScore >= 80 ? "#fff" : C.textSec, background: q.askScore >= 80 ? C.retGood : C.borderLight }}>{st.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Compounding ribbon — who's sent the most revenue */}
                  {referrers.length > 0 && (() => {
                    const sorted = [...referrers].sort((a, b) => b.revenue - a.revenue);
                    const max = Math.max(1, ...sorted.map(r => r.revenue));
                    return (
                      <div style={{ background: C.card, borderRadius: 12, boxShadow: "var(--rt-sh-card)", padding: "14px" }}>
                        <div style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>Who's compounding</div>
                        <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 3, marginBottom: 12 }}>Revenue through each client's referrals</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {sorted.map(r => {
                            const pct = (r.revenue / max) * 100;
                            return (
                              <div key={r.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                                    <Avatar id={r.id} name={r.name} size={18} />
                                    <span style={{ fontSize: 11.5, color: C.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                                  </div>
                                  <span style={{ fontSize: 11, color: C.retGood, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>${r.revenue.toLocaleString()}/mo</span>
                                </div>
                                <div style={{ height: 6, background: C.borderLight, borderRadius: 3, overflow: "hidden" }}>
                                  <div style={{ width: pct + "%", height: "100%", background: "linear-gradient(90deg, " + C.retGood + " 0%, #2C9A76 100%)", borderRadius: 3 }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* MAIN COLUMN */}
                <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>

                  {/* ASK DRAFT CARD */}
                  {activeAsk && (
                    <div style={{ background: C.card, border: "1.5px solid " + C.retGood, borderRadius: 14, boxShadow: "0 2px 8px rgba(10,10,10,0.06)", padding: "16px 18px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 10, flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, letterSpacing: -0.2 }}>Ask {activeAsk.name}</div>
                          <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 4, display: "inline-flex", alignItems: "center", gap: 5 }}>
                            <Icon name="sparkles" size={11} color={C.btn} />
                            Score {activeAsk.askScore} · {(() => { const p = activeAsk.profile_scores || {}; const pieces = []; if ((p.loyalty || 0) >= 8) pieces.push("high loyalty"); if ((p.relationship_depth || 0) >= 8) pieces.push("deep relationship"); return pieces.join(" · ") || "strong composite signals"; })()}
                          </div>
                        </div>
                        {/* Tone toggle */}
                        <div style={{ display: "inline-flex", gap: 2, padding: 3, background: C.bg, borderRadius: 8 }}>
                          {["softer", "neutral", "firmer"].map(t => (
                            <button key={t} onClick={() => { setAskTone(t); setAskDraft(""); }} style={{ padding: "5px 12px", fontSize: 11, borderRadius: 6, textTransform: "capitalize", letterSpacing: 0.2, border: "none", cursor: "pointer", fontFamily: "inherit", background: askTone === t ? C.text : "transparent", color: askTone === t ? "#fff" : C.textMuted, fontWeight: askTone === t ? 600 : 500, transition: "all 120ms" }}>{t}</button>
                          ))}
                        </div>
                      </div>
                      {/* Primer */}
                      <div style={{ fontSize: 12, color: C.textSec, fontStyle: "italic", padding: "8px 12px", background: C.primarySoft, borderLeft: "2px solid " + C.btn, borderRadius: 4, marginBottom: 12, lineHeight: 1.45 }}>
                        {getPrimer(activeAsk)}
                      </div>
                      {/* Editable draft */}
                      <textarea
                        value={displayedDraft}
                        onChange={e => { setAskDraft(e.target.value); if (activeAsk) setAskActiveId(activeAsk.name); }}
                        style={{ width: "100%", minHeight: 150, padding: "12px 14px", borderRadius: 10, fontSize: 13, fontFamily: "inherit", background: C.bg, outline: "none", resize: "vertical", lineHeight: 1.55, color: C.text, boxSizing: "border-box", marginBottom: 12, whiteSpace: "pre-wrap" }}
                      />
                      {/* Action row */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <a href={`mailto:${activeAsk.email || ""}?subject=${encodeURIComponent("Quick ask")}&body=${encodeURIComponent(displayedDraft)}`} onClick={() => markAsked(activeAsk)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 11px", background: C.bg, borderRadius: 7, fontSize: 11.5, color: C.textSec, fontWeight: 500, cursor: "pointer", textDecoration: "none" }}>
                            <Icon name="mail" size={13} color={C.textSec} />
                            <span>Email</span>
                          </a>
                          <a href={`sms:${activeAsk.phone || ""}?body=${encodeURIComponent(displayedDraft)}`} onClick={() => markAsked(activeAsk)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 11px", background: C.bg, borderRadius: 7, fontSize: 11.5, color: C.textSec, fontWeight: 500, cursor: "pointer", textDecoration: "none" }}>
                            <Icon name="phone" size={13} color={C.textSec} />
                            <span>Text</span>
                          </a>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => { const nextIdx = askQueue.findIndex(c => c.name === activeAsk.name) + 1; const nxt = askQueue[nextIdx]; if (nxt) { setAskActiveId(nxt.name); setAskDraft(""); } else { setAskActiveId(null); setAskDraft(""); } }} style={{ padding: "8px 12px", fontSize: 12, color: C.textMuted, background: "transparent", border: "none", borderRadius: 7, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Ask someone else →</button>
                          <button onClick={() => markAsked(activeAsk)} style={{ padding: "8px 16px", fontSize: 12.5, color: "#fff", background: C.retGood, borderRadius: 7, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit", boxShadow: "var(--rt-sh-card)" }}>Mark asked</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* NETWORK MAP — d3-force live simulation */}
                  <div style={{ background: C.card, borderRadius: 14, boxShadow: "var(--rt-sh-card)", padding: "18px 20px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12, gap: 16, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>Referral Network</div>
                        <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 3 }}>Live — click any node to drill in</div>
                      </div>
                      <div style={{ display: "flex", gap: 14, fontSize: 10.5, color: C.textMuted, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 4, background: C.retGood }} />Converted
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 4, background: "#D17A1B" }} />Pending
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 4, background: C.textMuted }} />Lost
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 5, background: "var(--rt-grad-btn)", boxShadow: "0 0 0 2px rgba(91,33,182,0.16)" }} />Likely
                        </span>
                      </div>
                    </div>

                    {referrers.length === 0 ? (
                      <div style={{ padding: "60px 20px", textAlign: "center", color: C.textMuted }}>
                        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>No referrals yet.</div>
                        <div style={{ fontSize: 12 }}>Log your first one to start building the network.</div>
                      </div>
                    ) : (() => {
                      // Compute predicted referrers — clients who haven't referred
                      // anyone but score high on the same dimensions calcAskScore
                      // uses for the "ask for a referral" rubric. Filter out
                      // anyone already in the referrer set.
                      const existingReferrerNames = new Set(referrers.map(r => r.name));
                      const predicted = clients
                        .filter(c => !existingReferrerNames.has(c.name))
                        .map(c => ({ ...c, askScore: calcAskScore(c) }))
                        .filter(c => c.askScore >= 60)
                        .sort((a, b) => b.askScore - a.askScore)
                        .slice(0, 4)
                        .map(c => ({
                          id: c.id,
                          name: c.name,
                          reason: (() => {
                            const p = c.profile_scores || c.profile || {};
                            const tags = [];
                            if ((p.loyalty || 0) >= 8) tags.push("high loyalty");
                            if ((p.relationship_depth || 0) >= 8) tags.push("deep relationship");
                            return tags.join(", ") || "strong overall signals";
                          })(),
                        }));

                      const handleNodeClick = (payload) => {
                        if (payload.kind === "child") {
                          const refId = payload.data.id;
                          const r = refs.find(x => x.id === refId);
                          if (r) {
                            setRefEditData({ to: r.to, from: r.from, status: r.status, converted: r.converted, revenue: r.revenue, totalRevenue: r.totalRevenue });
                            setRefEditing(refId);
                          }
                        } else if (payload.kind === "referrer") {
                          // Scroll the referral-log section into view
                          const logEl = document.getElementById("ref-log");
                          if (logEl) logEl.scrollIntoView({ behavior: "smooth", block: "start" });
                        } else if (payload.kind === "ghost") {
                          // Predicted referrer — prefill the referral form with them as "from"
                          setRefFrom(payload.data.name);
                          setRefForm(true);
                        }
                      };

                      return (
                        <>
                          <ReferralNetworkD3
                            referrers={referrers}
                            predictedReferrers={predicted}
                            asOfDate={networkAsOf}
                            onNodeClick={handleNodeClick}
                            C={C}
                            getAvatarColor={getAvatarColor}
                            getInitials={getInitials}
                          />

                          {/* Time-as-of slider — drag to see the network grow.
                              Range = earliest referral to today. Default = today (latest).
                              Off when there are fewer than 3 referrals (no meaningful range). */}
                          {(() => {
                            const allDates = refs.map(r => r.date || r.on).filter(Boolean).map(d => new Date(d).getTime()).filter(t => Number.isFinite(t));
                            if (allDates.length < 3) return null;
                            const minMs = Math.min(...allDates);
                            const maxMs = Date.now();
                            const curMs = networkAsOf ? new Date(networkAsOf).getTime() : maxMs;
                            const pct = ((curMs - minMs) / (maxMs - minMs)) * 100;
                            const fmt = (ms) => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
                            return (
                              <div style={{ marginTop: 14, padding: "10px 12px", background: C.bg, borderRadius: 10 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, fontSize: 11, color: C.textMuted }}>
                                  <span style={{ fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase" }}>Time travel</span>
                                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{networkAsOf ? `Showing as of ${fmt(curMs)}` : `Today (${fmt(maxMs)})`}</span>
                                </div>
                                <input
                                  type="range"
                                  min={minMs}
                                  max={maxMs}
                                  value={curMs}
                                  onChange={(e) => {
                                    const v = parseInt(e.target.value, 10);
                                    setNetworkAsOf(v >= maxMs - 86400000 ? null : new Date(v).toISOString());
                                  }}
                                  style={{ width: "100%", accentColor: C.btn }}
                                />
                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2, fontSize: 10, color: C.textMuted, fontVariantNumeric: "tabular-nums" }}>
                                  <span>{fmt(minMs)}</span>
                                  <span>now</span>
                                </div>
                              </div>
                            );
                          })()}
                        </>
                      );
                    })()}
                  </div>

                  {/* REFERRAL LOG (compact) */}
                  <div id="ref-log">
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "0 4px 10px" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: C.textMuted }}>Log</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, padding: "1px 8px", background: C.borderLight, borderRadius: 999 }}>{totalRefs}</span>
                      </div>
                    </div>
                    {refs.length === 0 ? (
                      <div style={{ padding: "30px 20px", background: C.card, border: "1px dashed " + C.border, borderRadius: 12, textAlign: "center", color: C.textMuted, fontSize: 13 }}>
                        No referrals logged yet.
                      </div>
                    ) : (
                      <div style={{ background: C.card, borderRadius: 12, boxShadow: "var(--rt-sh-card)", overflow: "hidden" }}>
                        {refs.map((r, i) => {
                          const isActive = r.status === "converted" || r.status === "active";
                          return (
                            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i === refs.length - 1 ? "none" : "1px solid " + C.borderLight }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13.5, color: C.text, fontWeight: 600 }}>{r.name}</div>
                                <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 2 }}>Referred by {r.from} · {r.on || "recent"}</div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                                {r.revenue > 0 && <span style={{ fontSize: 12, color: C.text, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>${r.revenue.toLocaleString()}/mo</span>}
                                <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 3, letterSpacing: 0.3, color: isActive ? "#fff" : C.textSec, background: isActive ? C.retGood : C.borderLight, textTransform: "uppercase" }}>
                                  {isActive ? "Active" : r.status || "Pending"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* DAYBOOK COLUMN — wide desktop only (>=1440px) */}
                <div className="rc-rai-col" style={{ display: "none", position: "sticky", top: 20, alignSelf: "start" }}>
                  <DaybookPanel
                    entry={daybookEntry}
                    yesterday={daybookYesterday}
                    saveStatus={daybookSaveStatus}
                    onChange={handleDaybookChange}
                  />
                </div>
              </div>

              {/* Referral form modal — preserved from v1 */}
              {refForm && (
                <div onClick={() => setRefForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(20,30,22,0.40)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div onClick={e => e.stopPropagation()} style={{ background: C.card, borderRadius: 14, padding: 24, width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 18 }}>Log Referral</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>New client name</label>
                        <input value={refName} onChange={e => setRefName(e.target.value)} placeholder="e.g. White Mountain Puzzles" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14, fontFamily: "inherit", background: C.bg, outline: "none", boxSizing: "border-box" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Referred by</label>
                        <select value={refFrom} onChange={e => setRefFrom(e.target.value)} style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14, fontFamily: "inherit", background: C.bg, outline: "none", boxSizing: "border-box" }}>
                          <option value="">Choose a client…</option>
                          {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Monthly revenue (optional)</label>
                        <input value={refRevenue} onChange={e => setRefRevenue(e.target.value)} placeholder="4000" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14, fontFamily: "inherit", background: C.bg, outline: "none", boxSizing: "border-box" }} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={addRef} disabled={!refName.trim() || !refFrom} style={{ flex: 1, padding: "10px", background: (refName.trim() && refFrom) ? C.btn : C.surface, color: (refName.trim() && refFrom) ? "#fff" : C.textMuted, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: (refName.trim() && refFrom) ? "pointer" : "default", fontFamily: "inherit" }}>Log Referral</button>
                      <button onClick={() => { setRefForm(false); setRefName(""); setRefFrom(""); setRefRevenue(""); }} style={{ padding: "10px 18px", background: C.surface, color: C.textMuted, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}
              </>)}
            </div>
          );
          } catch (err) {
            return (
              <div style={{ padding: 40, background: "#FFF5F5", border: "2px solid #C04323", borderRadius: 14, margin: 20 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#C04323", marginBottom: 12 }}>Referrals page crashed</div>
                <div style={{ fontSize: 13, color: C.text, marginBottom: 8 }}>Error: <code style={{ background: C.bg, padding: "2px 6px", borderRadius: 4 }}>{String(err?.message || err)}</code></div>
                <pre style={{ fontSize: 11, color: C.textSec, background: C.bg, padding: 12, borderRadius: 6, overflow: "auto", maxHeight: 300 }}>{String(err?.stack || "No stack trace")}</pre>
              </div>
            );
          }
        })()}

        {/* ═══ ROLODEX v2 — "The Deck" ═══ */}
        {page === "retros" && (() => {
          try {
          // ─── Helpers ───────────────────────────────────────────────────
          // Avatars: deterministic palette by id, initials from name.
          const AVATAR_COLORS = ["#1F7A5C", "#2C9A76", "#0C3A2E", C.btn, "#D17A1B", "#12523F"];
          const getInitials = (name) => (name || "?").split(/\s+/).map(w => w[0]).filter(Boolean).join("").slice(0, 2).toUpperCase();
          const getAvatarColor = (id) => { const s = String(id || ""); let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return AVATAR_COLORS[h % AVATAR_COLORS.length]; };
          const Avatar = ({ id, name, size = 32 }) => (
            <div style={{ width: size, height: size, borderRadius: size / 2, flexShrink: 0, background: getAvatarColor(id), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.32, fontWeight: 600, letterSpacing: 0.2 }}>{getInitials(name)}</div>
          );

          // Heat score: 0-100.
          //   Recency (40%): ≤30d=100, 31-90=70, 91-180=40, >180=10
          //   Warmth (40%): good+comeback+refer=100, good+refer=75, good=50, mixed=30, rough=0
          //   Recent-signal bonus (20%): +20 if last touch ≤30d (same as recency hot bucket)
          const calcHeat = (r) => {
            const answers = r.retro_answers || {};
            // Recency — from last touch stored date, else fall back to priority set date
            const lastTouchDate = r.last_touch ? new Date(r.last_touch) : (r.priority_set_at ? new Date(r.priority_set_at) : (r.created_at ? new Date(r.created_at) : null));
            let recencyScore = 10;
            if (lastTouchDate) {
              const days = Math.max(0, Math.floor((Date.now() - lastTouchDate.getTime()) / (1000 * 60 * 60 * 24)));
              if (days <= 30) recencyScore = 100;
              else if (days <= 90) recencyScore = 70;
              else if (days <= 180) recencyScore = 40;
              else recencyScore = 10;
            }
            // Warmth — from retro answers
            const ended = (answers.ended || answers.terms || "").toString().toLowerCase();
            const comeback = (answers.comeback || "").toString().toLowerCase();
            const refer = (answers.refer || "").toString().toLowerCase();
            let warmth = 0;
            if (ended.includes("good")) {
              warmth = 50;
              if (refer.includes("yes")) warmth += 25;
              if (comeback.includes("yes")) warmth += 25;
            } else if (ended.includes("mixed")) warmth = 30;
            else if (ended.includes("rough")) warmth = 0;
            else warmth = 40; // unknown defaults to neutral
            // Recent signal bonus
            const bonus = recencyScore === 100 ? 20 : 0;
            return Math.min(100, Math.round(recencyScore * 0.4 + warmth * 0.4 + bonus));
          };

          // Derive canonical tags from retro answers — used on filed cards.
          const deriveTags = (r) => {
            const answers = r.retro_answers || {};
            const tags = [];
            const ended = (answers.ended || answers.terms || "").toString().toLowerCase();
            const comeback = (answers.comeback || "").toString().toLowerCase();
            const refer = (answers.refer || "").toString().toLowerCase();
            if (ended.includes("good")) tags.push("Good terms");
            if (refer.includes("yes")) tags.push("Would refer");
            if (comeback.includes("yes")) tags.push("Would come back");
            if (r.type === "oneoff") tags.push("One-off");
            return tags;
          };

          // Retro step definitions
          const RETRO_STEPS_FORMER = [
            { id: "happened", q: "What happened?",        kind: "text", placeholder: "Budget cut, pivot, quiet churn…" },
            { id: "ended",    q: "How did it end?",       kind: "pick", options: [
                { v: "good",  label: "Good terms", tone: C.retGood },
                { v: "mixed", label: "Mixed",      tone: C.retWarn },
                { v: "rough", label: "Rough",      tone: C.retCrit }] },
            { id: "comeback", q: "Would they come back?", kind: "pick", options: [
                { v: "yes",   label: "Yes",   tone: C.retGood },
                { v: "maybe", label: "Maybe", tone: C.retWarn },
                { v: "no",    label: "No",    tone: C.textMuted }] },
            { id: "refer",    q: "Would they refer you?", kind: "pick", options: [
                { v: "yes",   label: "Yes — has people in mind", tone: C.retGood },
                { v: "maybe", label: "Probably", tone: C.retWarn },
                { v: "no",    label: "Unlikely", tone: C.textMuted }] },
            { id: "priority", q: "Where in the deck?",    kind: "priority" },
          ];
          const RETRO_STEPS_ONEOFF = [
            { id: "did",      q: "What did you do for them?", kind: "text", placeholder: "The work in one line…" },
            { id: "refer",    q: "Would they refer you?",     kind: "pick", options: [
                { v: "yes",   label: "Yes — has people in mind", tone: C.retGood },
                { v: "maybe", label: "Probably", tone: C.retWarn },
                { v: "no",    label: "Unlikely", tone: C.textMuted }] },
            { id: "priority", q: "Where in the deck?",        kind: "priority" },
          ];

          // ─── Data slices ────────────────────────────────────────────────
          const queued = rolodex.filter(r => !r.priority);
          const searchFilter = (r) => !rolodexSearch || (r.client_name || r.client || "").toLowerCase().includes(rolodexSearch.toLowerCase()) || (r.contact_name || r.contact || "").toLowerCase().includes(rolodexSearch.toLowerCase());
          const saved = rolodex.filter(r => r.priority && searchFilter(r));
          const byPrio = {
            high: saved.filter(r => r.priority === "high"),
            medium: saved.filter(r => r.priority === "medium"),
            low: saved.filter(r => r.priority === "low"),
          };
          const referReady = saved.filter(r => deriveTags(r).includes("Would refer")).length;

          // ─── Active retro state ─────────────────────────────────────────
          // rolodexFlowOpen acts as activeId. If null and queued exists, default to first.
          const activeId = rolodexFlowOpen || queued[0]?.id || null;
          const active = queued.find(r => r.id === activeId) || queued[0];
          const activeSteps = active?.type === "former" ? RETRO_STEPS_FORMER : RETRO_STEPS_ONEOFF;
          const currentAnswers = (active && active.retro_answers) || {};
          // Determine starting step from saved answers — skip filled, land on first empty
          const startStep = (() => {
            if (!active) return 0;
            for (let i = 0; i < activeSteps.length; i++) {
              const s = activeSteps[i];
              if (s.kind === "priority") return i;
              const v = currentAnswers[s.id];
              if (v === undefined || v === null || v === "") return i;
            }
            return activeSteps.length - 1;
          })();
          const [localStep, setLocalStep] = [rolodexStep, setRolodexStep];
          const effectiveStep = (localStep != null && activeId === rolodexStepOwner) ? localStep : startStep;
          const [localText, setLocalText] = [rolodexStepText, setRolodexStepText];
          const currentStepDef = activeSteps[effectiveStep];
          const textValue = (currentStepDef?.kind === "text")
            ? (localText != null && activeId === rolodexStepOwner ? localText : (currentAnswers[currentStepDef.id] || ""))
            : "";

          const saveAnswer = async (stepDef, value) => {
            if (!active) return;
            const nextAnswers = { ...currentAnswers, [stepDef.id]: value };
            setRolodex(prev => prev.map(r => r.id === active.id ? { ...r, retro_answers: nextAnswers } : r));
            try { await rolodexDb.update(active.id, { retro_answers: nextAnswers }); } catch (e) { console.warn("Retro save failed:", e); }
          };

          const advanceAfterRetro = () => {
            const remaining = rolodex.filter(r => !r.priority && r.id !== active?.id);
            setRolodexFlowOpen(remaining[0]?.id || null);
            setRolodexStep(null);
            setRolodexStepOwner(null);
            setRolodexStepText(null);
          };

          const onNext = () => {
            if (!active || !currentStepDef) return;
            if (currentStepDef.kind === "text") {
              saveAnswer(currentStepDef, textValue);
            }
            if (effectiveStep >= activeSteps.length - 1) {
              advanceAfterRetro();
            } else {
              setRolodexStep(effectiveStep + 1);
              setRolodexStepOwner(active.id);
              setRolodexStepText(null);
            }
          };
          const onPrev = () => {
            setRolodexStep(Math.max(0, effectiveStep - 1));
            setRolodexStepOwner(active?.id || null);
            setRolodexStepText(null);
          };
          const onPick = (v) => {
            if (!currentStepDef) return;
            saveAnswer(currentStepDef, v);
            // Auto-advance on pick for non-priority picks
            if (effectiveStep < activeSteps.length - 1) {
              setRolodexStep(effectiveStep + 1);
              setRolodexStepOwner(active.id);
              setRolodexStepText(null);
            }
          };
          const onPickPriority = async (priority) => {
            if (!active) return;
            // Derive and save tags + priority
            const finalAnswers = { ...currentAnswers, _priority: priority };
            const tags = deriveTags({ ...active, retro_answers: finalAnswers });
            // Single timestamp used for BOTH local state and the DB write,
            // so the retro-queue "last touched" sort stays consistent
            // across refreshes. Previously priority_set_at was set in local
            // state only — the DB update omitted it, so on refresh the
            // sort fell back to created_at.
            const setAt = new Date().toISOString();
            setRolodex(prev => prev.map(r => r.id === active.id ? { ...r, priority, retro_answers: finalAnswers, tags, priority_set_at: setAt } : r));
            try { await rolodexDb.update(active.id, { priority, retro_answers: finalAnswers, tags, priority_set_at: setAt }); } catch (e) { console.warn("Priority save failed:", e); }
            advanceAfterRetro();
          };

          // Filed list filter (click a stack)
          const [filedFilter, setFiledFilter] = [rolodexFiledFilter, setRolodexFiledFilter];
          const filteredFiled = filedFilter === "all" ? saved : byPrio[filedFilter] || [];

          // ─── Render ─────────────────────────────────────────────────────
          return (
            <div style={{ width: "100%" }}>
              {!dataLoaded && (
                <div style={{ width: "100%" }}>
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "4px 4px 20px", marginBottom: 20, borderBottom: "1px solid " + C.borderLight }}>
                    <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                      <div style={{ fontSize: 11.5, color: C.textMuted, letterSpacing: 0.3, marginBottom: 4 }}>Past clients · one-offs · kept warm</div>
                      <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: -0.4, color: C.text }}>Rolodex</h1>
                    </div>
                  </div>
                  <SkeletonClientList rows={4} />
                </div>
              )}
              {dataLoaded && rolodex.length === 0 && (
                <>
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "4px 4px 20px", marginBottom: 20, borderBottom: "1px solid " + C.borderLight }}>
                    <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                      <div style={{ fontSize: 11.5, color: C.textMuted, letterSpacing: 0.3, marginBottom: 4 }}>Past clients · one-offs · kept warm</div>
                      <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: -0.4, color: C.text }}>Rolodex</h1>
                    </div>
                  </div>
                  <EmptyState
                    icon="rolodex"
                    headline="Your Rolodex is empty."
                    body="The people behind the logos — the buyer, the operator, the assistant who actually forwards the email. Adding contacts lets Rai narrate at the human level, not just the account level."
                    cta={{ label: "Add Contact", onClick: () => setShowAddRolodex(true) }}
                  />
                </>
              )}
              {dataLoaded && rolodex.length > 0 && (<>
              {/* STATUS BAND */}
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "4px 4px 20px", marginBottom: 20, borderBottom: "1px solid " + C.borderLight }}>
                <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                  <div style={{ fontSize: 11.5, color: C.textMuted, letterSpacing: 0.3, marginBottom: 4 }}>Past clients · one-offs · kept warm</div>
                  <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: -0.4, color: C.text }}>Rolodex</h1>
                  <div style={{ fontSize: 13.5, color: C.textMuted, marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span><b style={{ color: C.text, fontWeight: 700 }}>{saved.length}</b> filed</span>
                    {byPrio.high.length > 0 && <><span style={{ color: C.border }}>·</span><span><b style={{ color: C.retGood, fontWeight: 700 }}>{byPrio.high.length}</b> high priority</span></>}
                    {queued.length > 0 && <><span style={{ color: C.border }}>·</span><span style={{ color: C.btn, fontWeight: 600 }}><b>{queued.length}</b> waiting for retro</span></>}
                    {referReady > 0 && <><span style={{ color: C.border }}>·</span><span><b style={{ color: C.retGood, fontWeight: 700 }}>{referReady}</b> would refer</span></>}
                  </div>
                </div>
                <button className="r-btn" data-tone="purple" onClick={() => setShowAddRolodex(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", background: C.btn, color: "#fff", borderRadius: 10, fontSize: 13.5, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 1px 2px rgba(91,33,182,0.15), 0 2px 6px rgba(91,33,182,0.22)", flexShrink: 0 }}>
                  <span style={{ whiteSpace: "nowrap" }}>New Contact</span>
                </button>
              </div>

              {/* MAIN GRID: rail + main + rai (rai shows on >=1440px) */}
              <div className="rc-grid" style={{ display: "grid", gap: 20, alignItems: "start" }}>

                {/* LEFT RAIL: stacks + queue */}
                <div className="rc-rail" style={{ display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 0, alignSelf: "start" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", padding: "0 4px 2px" }}>Stacks</div>
                    {[
                      { key: "high", label: "High", tone: C.retGood, toneBg: "#E8F3EC" },
                      { key: "medium", label: "Medium", tone: C.retWarn, toneBg: "#FAF0DF" },
                      { key: "low", label: "Low", tone: C.textMuted, toneBg: C.borderLight },
                    ].map(s => {
                      const count = byPrio[s.key].length;
                      const selected = filedFilter === s.key;
                      const cards = Math.min(6, count);
                      return (
                        <button key={s.key} onClick={() => setFiledFilter(selected ? "all" : s.key)} style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", padding: "12px 14px", borderRadius: 12, boxShadow: "var(--rt-sh-card)", cursor: "pointer", textAlign: "left", background: selected ? s.toneBg : C.card, border: "1px solid " + (selected ? s.tone : C.border), fontFamily: "inherit", transition: "all 150ms" }}>
                          <div style={{ position: "relative", width: 36, height: 44, flexShrink: 0 }}>
                            {cards === 0 ? (
                              <div style={{ position: "absolute", inset: 0, border: "1px dashed " + C.border, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, color: C.textMuted }}>empty</div>
                            ) : (
                              Array.from({ length: cards }).map((_, i) => (
                                <div key={i} style={{ position: "absolute", bottom: i * 3, left: i * 2, right: -i * 2, top: i * 3, background: C.card, border: "1px solid " + s.tone, borderRadius: 5, opacity: 0.35 + (i / cards) * 0.6, boxShadow: i === cards - 1 ? "0 1px 2px rgba(0,0,0,0.05)" : "none" }} />
                              ))
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase" }}>{s.label}</div>
                            <div style={{ fontSize: 22, fontWeight: 700, color: s.tone, letterSpacing: -0.4, marginTop: 2, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{count}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Awaiting retro queue */}
                  {queued.length > 0 && (
                    <div style={{ background: C.card, borderRadius: 12, boxShadow: "var(--rt-sh-card)", padding: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <div style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>Awaiting retro</div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, padding: "1px 8px", background: C.borderLight, borderRadius: 999 }}>{queued.length}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {queued.map(e => {
                          const isActive = active?.id === e.id;
                          const name = e.client_name || e.client || "Untitled";
                          const contact = e.contact_name || e.contact || "";
                          return (
                            <button key={e.id} onClick={() => { setRolodexFlowOpen(e.id); setRolodexStep(null); setRolodexStepOwner(null); setRolodexStepText(null); }} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 8px", borderRadius: 8, background: isActive ? C.primarySoft : "transparent", border: "1px solid " + (isActive ? C.primary : "transparent"), cursor: "pointer", transition: "all 120ms", fontFamily: "inherit" }}>
                              <Avatar id={e.id} name={name} size={22} />
                              <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                                <div style={{ fontSize: 12.5, color: C.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                                <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 1 }}>{e.type === "former" ? "Former" : "One-off"}{contact ? " · " + contact.split(" ")[0] : ""}</div>
                              </div>
                              {isActive && <span style={{ width: 7, height: 7, borderRadius: 4, background: C.primary, boxShadow: "0 0 0 3px " + C.primarySoft, flexShrink: 0 }} />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* MAIN COLUMN */}
                <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>

                  {/* ACTIVE RETRO (top card) or empty state */}
                  {active ? (
                    <div style={{ position: "relative", paddingBottom: 8 }}>
                      {/* Peek of next cards behind */}
                      {queued.length > 1 && <div style={{ position: "absolute", top: 8, left: 8, right: 8, bottom: 16, background: C.card, borderRadius: 14, opacity: 0.5, zIndex: 0 }} />}
                      {queued.length > 2 && <div style={{ position: "absolute", top: 4, left: 4, right: 4, bottom: 12, background: C.card, borderRadius: 14, opacity: 0.8, zIndex: 0 }} />}
                      <div style={{ position: "relative", zIndex: 1, background: C.card, borderRadius: 14, boxShadow: "0 4px 12px rgba(10,10,10,0.06)", overflow: "hidden" }}>
                        {/* Header */}
                        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 20px 14px" }}>
                          <Avatar id={active.id} name={active.client_name || active.client} size={44} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: -0.2 }}>{active.client_name || active.client}</div>
                            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{active.contact_name || active.contact || "No contact"}{active.type === "former" ? " · Former client" : " · One-off"}</div>
                          </div>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: active.type === "former" ? C.retGood : C.btn, background: active.type === "former" ? "#E8F3EC" : C.primarySoft, padding: "3px 8px", borderRadius: 4, letterSpacing: 0.3, textTransform: "uppercase" }}>
                            {active.type === "former" ? "Former client" : "One-off"}
                          </span>
                        </div>
                        {/* Progress */}
                        <div style={{ padding: "0 20px 8px" }}>
                          <div style={{ display: "flex", gap: 3 }}>
                            {activeSteps.map((s, i) => (
                              <div key={s.id} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= effectiveStep ? C.primary : C.borderLight }} />
                            ))}
                          </div>
                          <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 6, fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase" }}>Step {effectiveStep + 1} of {activeSteps.length}</div>
                        </div>
                        {/* Question */}
                        <div style={{ padding: "12px 20px 18px" }}>
                          <div style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 16 }}>{currentStepDef.q}</div>
                          {currentStepDef.kind === "text" && (
                            <textarea
                              value={textValue}
                              onChange={e => { setRolodexStepText(e.target.value); setRolodexStepOwner(active.id); }}
                              onBlur={() => { if (localText != null) saveAnswer(currentStepDef, localText); }}
                              placeholder={currentStepDef.placeholder}
                              rows={3}
                              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, fontSize: 14, fontFamily: "inherit", background: C.bg, outline: "none", resize: "vertical", lineHeight: 1.55, color: C.text, boxSizing: "border-box" }}
                            />
                          )}
                          {currentStepDef.kind === "pick" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              {currentStepDef.options.map(o => {
                                const picked = currentAnswers[currentStepDef.id] === o.v;
                                return (
                                  <button key={o.v} onClick={() => onPick(o.v)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: picked ? "#E8F3EC" : C.card, border: "1px solid " + (picked ? o.tone : C.border), borderRadius: 10, cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "all 120ms" }}>
                                    <span style={{ width: 16, height: 16, borderRadius: 8, border: "2px solid " + (picked ? o.tone : C.border), display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                      {picked && <span style={{ width: 8, height: 8, borderRadius: 4, background: o.tone }} />}
                                    </span>
                                    <span style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{o.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          {currentStepDef.kind === "priority" && (
                            <div>
                              <div style={{ fontSize: 13, color: C.textSec, lineHeight: 1.5, marginBottom: 14 }}>Where does this contact go in your deck? High = worth regular check-ins. Medium = warm but not urgent. Low = archive in case something changes.</div>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                                {[
                                  { id: "high", label: "High", color: C.retGood, bg: "#E8F3EC", desc: "Check in quarterly" },
                                  { id: "medium", label: "Medium", color: C.retWarn, bg: "#FAF0DF", desc: "Check in twice a year" },
                                  { id: "low", label: "Low", color: C.textMuted, bg: C.borderLight, desc: "Archive, monitor" },
                                ].map(p => (
                                  <button key={p.id} onClick={() => onPickPriority(p.id)} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "14px 12px", background: p.bg, border: "1px solid " + p.color, borderRadius: 10, cursor: "pointer", fontFamily: "inherit", textAlign: "center", transition: "all 120ms" }}>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: p.color }}>{p.label}</div>
                                    <div style={{ fontSize: 11, color: C.textSec }}>{p.desc}</div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        {/* Footer nav — hidden on priority step (buttons ARE the actions) */}
                        {currentStepDef.kind !== "priority" && (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px 14px", borderTop: "1px solid " + C.borderLight, background: C.bg }}>
                            <button onClick={advanceAfterRetro} style={{ fontSize: 11.5, color: C.textMuted, padding: "6px 10px", borderRadius: 6, background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Skip for now</button>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button onClick={onPrev} disabled={effectiveStep === 0} style={{ padding: "8px 14px", background: C.borderLight, color: C.textSec, borderRadius: 8, fontSize: 12.5, fontWeight: 500, border: "none", cursor: effectiveStep === 0 ? "default" : "pointer", opacity: effectiveStep === 0 ? 0.5 : 1, fontFamily: "inherit" }}>Back</button>
                              <button onClick={onNext} style={{ padding: "8px 18px", background: C.retGood, color: "#fff", borderRadius: 8, fontSize: 12.5, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit", boxShadow: "var(--rt-sh-card)" }}>Next →</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", padding: "40px 20px", background: C.card, borderRadius: 14, boxShadow: "var(--rt-sh-card)" }}>
                      <div style={{ width: 44, height: 44, borderRadius: 22, background: "#E8F3EC", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", border: "2px solid " + C.retGood }}>
                        <Icon name="check" size={20} color={C.retGood} />
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>Deck cleared.</div>
                      <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 4 }}>All contacts are filed. Tap "New Contact" to add more.</div>
                    </div>
                  )}

                  {/* FILED LIST */}
                  <div>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "0 4px 10px" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: C.textMuted }}>Filed</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, padding: "1px 8px", background: C.borderLight, borderRadius: 999 }}>{filteredFiled.length}</span>
                        {filedFilter !== "all" && (
                          <button onClick={() => setFiledFilter("all")} style={{ fontSize: 10.5, color: C.btn, fontWeight: 500, padding: "2px 8px", background: C.primarySoft, borderRadius: 4, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                            {filedFilter} · clear
                          </button>
                        )}
                      </div>
                      <input value={rolodexSearch} onChange={e => setRolodexSearch(e.target.value)} placeholder="Search filed…" style={{ width: 180, padding: "6px 10px", borderRadius: 8, fontSize: 12, fontFamily: "inherit", background: C.card, outline: "none" }} />
                    </div>

                    {filteredFiled.length === 0 ? (
                      <div style={{ padding: "30px 20px", background: C.card, border: "1px dashed " + C.border, borderRadius: 12, textAlign: "center", color: C.textMuted, fontSize: 13 }}>
                        {filedFilter === "all" ? "No filed contacts yet." : `Nothing in ${filedFilter} priority.`}
                      </div>
                    ) : (
                      filteredFiled.map(e => {
                        const tags = deriveTags(e);
                        const heat = calcHeat(e);
                        const prioTone = e.priority === "high" ? C.retGood : e.priority === "medium" ? C.retWarn : C.textMuted;
                        const name = e.client_name || e.client || "Untitled";
                        const contact = e.contact_name || e.contact || "";
                        // Summary = History > What you did/happened (step 1 text answer)
                        const summary = (e.retro_answers && (e.retro_answers.happened || e.retro_answers.did || e.retro_answers.what)) || "";
                        return (
                          <div key={e.id} onClick={() => setSelectedRolodex(e)} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", background: C.card, borderRadius: 12, boxShadow: "var(--rt-sh-card)", marginBottom: 8, cursor: "pointer" }}>
                            <div style={{ width: 3, alignSelf: "stretch", background: prioTone, borderRadius: 2, flexShrink: 0 }} />
                            <Avatar id={e.id} name={name} size={40} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 14.5, fontWeight: 600, color: C.text, letterSpacing: -0.2 }}>{name}</span>
                                <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 999, letterSpacing: 0.2, color: e.type === "former" ? C.retGood : C.btn, background: e.type === "former" ? "#E8F3EC" : C.primarySoft }}>
                                  {e.type === "former" ? "Former" : "One-off"}
                                </span>
                                {e.priority === "high" && (
                                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, letterSpacing: 0.2, color: "#fff", background: "linear-gradient(90deg, #D17A1B, #C04323)" }}>Heat {heat}</span>
                                )}
                              </div>
                              <div style={{ fontSize: 11.5, color: C.textMuted, marginBottom: 8 }}>
                                {contact && <span>{contact}</span>}
                              </div>
                              {summary && <div style={{ fontSize: 12.5, color: C.textSec, lineHeight: 1.55, marginBottom: 8 }}>{summary}</div>}
                              {tags.length > 0 && (
                                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                  {tags.map(t => (
                                    <span key={t} style={{ fontSize: 10.5, fontWeight: 600, padding: "3px 8px", borderRadius: 4, letterSpacing: 0.1, color: C.retGood, background: "#E8F3EC", border: "1px solid #C9E4D1" }}>{t}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* DAYBOOK COLUMN — wide desktop only (>=1440px) */}
                <div className="rc-rai-col" style={{ display: "none", position: "sticky", top: 20, alignSelf: "start" }}>
                  <DaybookPanel
                    entry={daybookEntry}
                    yesterday={daybookYesterday}
                    saveStatus={daybookSaveStatus}
                    onChange={handleDaybookChange}
                  />
                </div>
              </div>

              {/* Add contact modal */}
              {showAddRolodex && (
                <div onClick={() => setShowAddRolodex(false)} style={{ position: "fixed", inset: 0, background: "rgba(20,30,22,0.40)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div onClick={e => e.stopPropagation()} style={{ background: C.card, borderRadius: 14, padding: 24, width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 6 }}>New rolodex contact</div>
                    <div style={{ fontSize: 12.5, color: C.textMuted, marginBottom: 18 }}>Add someone to your deck. You'll run a quick retro to file them.</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Company / client name</label>
                        <input value={newRolodexEntry.client} onChange={e => setNewRolodexEntry({ ...newRolodexEntry, client: e.target.value })} placeholder="Northbeam Studios" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14, fontFamily: "inherit", background: C.bg, outline: "none", boxSizing: "border-box" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Contact person</label>
                        <input value={newRolodexEntry.contact} onChange={e => setNewRolodexEntry({ ...newRolodexEntry, contact: e.target.value })} placeholder="Jordan Reeve" style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14, fontFamily: "inherit", background: C.bg, outline: "none", boxSizing: "border-box" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Type</label>
                        <div style={{ display: "flex", gap: 8 }}>
                          {[{ v: "former", label: "Former client" }, { v: "oneoff", label: "One-off" }].map(t => (
                            <button key={t.v} onClick={() => setNewRolodexEntry({ ...newRolodexEntry, type: t.v })} style={{ flex: 1, padding: "8px 12px", background: newRolodexEntry.type === t.v ? C.primarySoft : C.card, border: "1px solid " + (newRolodexEntry.type === t.v ? C.primary : C.border), borderRadius: 8, fontSize: 13, fontWeight: 500, color: newRolodexEntry.type === t.v ? C.primary : C.textSec, cursor: "pointer", fontFamily: "inherit" }}>{t.label}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {(() => {
                        const ready = newRolodexEntry.client.trim() && newRolodexEntry.contact.trim();
                        return (
                          <button disabled={!ready} onClick={async () => {
                            const entryType = newRolodexEntry.type || "former";
                            const { data: created } = await rolodexDb.create(user.id, {
                              client_name: newRolodexEntry.client.trim(),
                              contact_name: newRolodexEntry.contact.trim(),
                              type: entryType,
                              retro_answers: {},
                            });
                            if (created) {
                              const newEntry = { ...created, client: created.client_name, contact: created.contact_name, type: entryType, retro_answers: {}, tags: [] };
                              setRolodex(prev => [newEntry, ...prev]);
                              setRolodexFlowOpen(created.id);
                              setRolodexStep(0);
                              setRolodexStepOwner(created.id);
                              setRolodexStepText(null);
                            }
                            setNewRolodexEntry({ client: "", contact: "", work: "", type: "former" });
                            setShowAddRolodex(false);
                          }} style={{ flex: 1, padding: "10px", background: ready ? C.btn : C.surface, color: ready ? "#fff" : C.textMuted, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: ready ? "pointer" : "default", fontFamily: "inherit" }}>Add & start retro</button>
                        );
                      })()}
                      <button onClick={() => { setShowAddRolodex(false); setNewRolodexEntry({ client: "", contact: "", work: "", type: "former" }); }} style={{ padding: "10px 18px", background: C.surface, color: C.textMuted, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}
              </>)}
            </div>
          );
          } catch (err) {
            return (
              <div style={{ padding: 40, background: "#FFF5F5", border: "2px solid #C04323", borderRadius: 14, margin: 20 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#C04323", marginBottom: 12 }}>Rolodex page crashed</div>
                <div style={{ fontSize: 13, color: C.text, marginBottom: 8 }}>Error: <code style={{ background: C.bg, padding: "2px 6px", borderRadius: 4 }}>{String(err?.message || err)}</code></div>
                <pre style={{ fontSize: 11, color: C.textSec, background: C.bg, padding: 12, borderRadius: 6, overflow: "auto", maxHeight: 300 }}>{String(err?.stack || "No stack trace")}</pre>
              </div>
            );
          }
        })()}
        {/* ═══ COACH / TALK TO RAI — Claude-style chat ═══ */}
        {page === "coach" && (
          <div className={"r-rai-page " + (aiMessages.length === 0 ? "r-rai-intro" : "r-rai-chat")} style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
            <div className="r-rai-scroll" style={{ flex: 1, overflow: "auto", WebkitOverflowScrolling: "touch", display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div className="r-rai-inner" style={{ width: "100%", maxWidth: aiMessages.length === 0 ? 760 : 720, margin: "0 auto", padding: "24px 24px 0", flex: aiMessages.length === 0 ? 1 : "0 0 auto", display: aiMessages.length === 0 ? "flex" : "block", flexDirection: "column", justifyContent: aiMessages.length === 0 ? "center" : "flex-start", paddingBottom: aiMessages.length === 0 ? 80 : 0 }}>
                {aiMessages.length === 0 ? (() => {
                  const greeting = (() => {
                    const h = new Date().getHours();
                    if (h >= 5 && h < 12) return "Morning";
                    if (h >= 12 && h < 17) return "Afternoon";
                    return "Evening";
                  })();
                  const firstName = user?.user_metadata?.full_name?.split(" ")[0]
                    || (user?.email ? user.email.split("@")[0].charAt(0).toUpperCase() + user.email.split("@")[0].slice(1) : "");
                  const starters = [
                    "Who needs me today?",
                    "Summarize this week",
                    "Find risk patterns",
                    "Draft a renewal note",
                  ];
                  return (
                    <div style={{ width: "100%", margin: "0 auto", textAlign: "center" }}>
                      <h1 style={{ fontSize: 34, fontWeight: 600, color: C.text, lineHeight: 1.15, letterSpacing: "-0.02em", margin: 0, fontFamily: "'Outfit', system-ui, sans-serif" }}>
                        {greeting}{firstName ? ", " + firstName : ""}.
                      </h1>
                      <p style={{ fontSize: 19, fontWeight: 400, color: C.textSec, lineHeight: 1.5, marginTop: 10, marginBottom: 36, letterSpacing: "-0.01em" }}>
                        What's on your mind today?
                      </p>
                      <div className="rt-composer" style={{ background: C.card, borderRadius: 14, padding: "20px 22px 14px", textAlign: "left", boxShadow: "var(--rt-sh-card)" }}>
                        {aiAttachments.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                            {aiAttachments.map(a => (
                              <span key={a.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 8px 5px 10px", background: C.surfaceWarm, borderRadius: 8, fontSize: 12, color: C.text, maxWidth: 240 }}>
                                <Icon name={a.type === "image" ? "image" : "file"} size={12} color={C.textSec} />
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
                                <button onClick={() => setAiAttachments(prev => prev.filter(x => x.id !== a.id))} style={{ background: "none", border: "none", padding: 2, cursor: "pointer", color: C.textMuted, display: "flex" }} aria-label={"Remove " + a.name}>
                                  <Icon name="x" size={10} />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        <textarea
                          value={aiInput}
                          onChange={e => { setAiInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 240) + "px"; }}
                          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAi(); } }}
                          placeholder="Ask about a client, draft a message, get advice…"
                          rows={3}
                          style={{ width: "100%", minHeight: 72, padding: "2px 0", border: "none", fontSize: 16, fontFamily: "inherit", background: "transparent", outline: "none", resize: "none", lineHeight: 1.55, color: C.text, overflowY: "auto" }}
                        />
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                          <label title="Attach a file (PDF or image, max 10MB)" style={{ width: 36, height: 36, borderRadius: 10, background: C.card, color: C.textSec, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s" }}>
                            <input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" onChange={e => { handleFilePick(Array.from(e.target.files || [])); e.target.value = ""; }} style={{ display: "none" }} />
                            <Icon name="plus" size={16} />
                          </label>
                          <button onClick={() => sendAi()} disabled={!aiInput.trim() && aiAttachments.length === 0} style={{ width: 36, height: 36, borderRadius: 10, border: "none", background: (aiInput.trim() || aiAttachments.length > 0) ? C.btn : C.borderLight, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: (aiInput.trim() || aiAttachments.length > 0) ? "pointer" : "default", transition: "background 0.15s" }}>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 13L13 8L3 3V7L9 8L3 9V13Z" fill="#fff"/></svg>
                          </button>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 20 }}>
                        {starters.map(s => (
                          <button
                            key={s}
                            onClick={() => {
                              setAiInput(s);
                              setTimeout(() => {
                                const ta = document.querySelector('textarea[placeholder="Ask about a client, draft a message, get advice…"]');
                                if (ta) { ta.focus(); ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 240) + "px"; }
                              }, 0);
                            }}
                            style={{
                              padding: "8px 16px",
                              background: C.card,
                              border: "none",
                              borderRadius: 999,
                              fontSize: 13,
                              fontWeight: 500,
                              color: C.textSec,
                              cursor: "pointer",
                              fontFamily: "inherit",
                              boxShadow: "var(--rt-sh-xs)",
                              transition: "all 180ms var(--rt-ease-out)",
                            }}
                            onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--rt-sh-card)"; e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.color = C.text; }}
                            onMouseLeave={e => { e.currentTarget.style.boxShadow = "var(--rt-sh-xs)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.color = C.textSec; }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                      <p style={{ fontSize: 11.5, color: C.textMuted, textAlign: "center", marginTop: 24 }}>Rai can make mistakes. Double-check anything you act on.</p>
                    </div>
                  );
                })() : (
                  <div style={{ paddingBottom: 200 }}>
                    {aiMessages.map((m, i) => {
                      const isLastUser = m.role === "user" && i === aiMessages.length - 1;
                      const messageRef = isLastUser ? aiUserRef : null;
                      return m.role === "user" ? (
                        <div key={i} ref={messageRef} className="r-chat-msg-user" style={{ marginBottom: 28, display: "flex", justifyContent: "flex-end" }}>
                          <div style={{ maxWidth: "75%", background: C.surfaceWarm, borderRadius: 20, padding: "12px 18px", boxShadow: "var(--rt-sh-xs)" }}>
                            {m.text.split("\n").map((l, j) => l.trim() === "" ? <div key={j} style={{ height: 8 }} /> : <p key={j} style={{ fontSize: 17, color: C.text, lineHeight: 1.5, margin: 0 }}>{l}</p>)}
                          </div>
                        </div>
                      ) : (
                        <div key={i} style={{ marginBottom: 28 }}>
                          <RaiMarkdown text={m.text} size={17} lineHeight={1.55} />
                        </div>
                      );
                    })}
                    {aiTyping && <div style={{ marginBottom: 28, display: "flex", gap: 4, padding: "4px 0" }}>{[0,1,2].map(j => <div key={j} style={{ width: 6, height: 6, borderRadius: "50%", background: C.textMuted, animation: `pulse 1.2s ease-in-out ${j*0.2}s infinite` }} />)}</div>}
                    <div ref={aiEndRef} />
                  </div>
                )}
              </div>
            </div>
            {/* Input bar — fixed bottom once conversation started */}
            {aiMessages.length > 0 && (
              <div className="r-rai-inputbar" style={{ background: C.bg, padding: "12px 24px 16px" }}>
                <div style={{ maxWidth: 720, margin: "0 auto" }}>
                  <div style={{ background: C.card, border: "none", boxShadow: "var(--rt-sh-card)", borderRadius: 14, padding: "14px 16px 10px" }}>
                    {aiAttachments.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                        {aiAttachments.map(a => (
                          <span key={a.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 8px 5px 10px", background: C.surfaceWarm, borderRadius: 8, fontSize: 12, color: C.text, maxWidth: 240 }}>
                            <Icon name={a.type === "image" ? "image" : "file"} size={12} color={C.textSec} />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
                            <button onClick={() => setAiAttachments(prev => prev.filter(x => x.id !== a.id))} style={{ background: "none", border: "none", padding: 2, cursor: "pointer", color: C.textMuted, display: "flex" }} aria-label={"Remove " + a.name}>
                              <Icon name="x" size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <textarea value={aiInput} onChange={e => { setAiInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px"; }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAi(); } }} placeholder="Reply to Rai…" rows={1} style={{ width: "100%", padding: "4px 0", border: "none", fontSize: 17, fontFamily: "inherit", background: "transparent", outline: "none", resize: "none", lineHeight: 1.5, color: C.text, overflowY: "auto" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                      <label title="Attach a file (PDF or image, max 10MB)" style={{ width: 32, height: 32, borderRadius: 8, background: C.card, color: C.textSec, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                        <input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" onChange={e => { handleFilePick(Array.from(e.target.files || [])); e.target.value = ""; }} style={{ display: "none" }} />
                        <Icon name="plus" size={14} />
                      </label>
                      <button onClick={() => sendAi()} disabled={!aiInput.trim() && aiAttachments.length === 0} style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: (aiInput.trim() || aiAttachments.length > 0) ? C.btn : C.borderLight, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: (aiInput.trim() || aiAttachments.length > 0) ? "pointer" : "default", transition: "background 0.15s" }}>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 13L13 8L3 3V7L9 8L3 9V13Z" fill="#fff"/></svg>
                      </button>
                    </div>
                  </div>
                  <p style={{ fontSize: 11, color: C.textMuted, textAlign: "center", marginTop: 10 }}>Rai can make mistakes. Double-check anything you act on.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ SETTINGS ═══ */}
        {page === "settings" && (
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 16 }}>Settings</h1>

            {/* Integrations — real, all-tiers. Currently just Google
                Calendar. This is the permanent home for the connection:
                the Today-page nudge can be dismissed, but this row is
                always here. When real Google OAuth ships (TODO I), the
                Connect button + connected state light up from the same
                googleConnected source the Today page reads. */}
            <div style={{ background: C.card, borderRadius: 10, padding: "14px 16px", marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 10 }}>Integrations</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Icon name="calendar" size={16} color={C.textSec} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Google Calendar</div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>Show your events alongside tasks on the Today page</div>
                  </div>
                </div>
                <button
                  onClick={() => { /* TODO I: real Google OAuth flow */ }}
                  style={{
                    padding: "6px 14px",
                    background: C.btn,
                    color: "#fff",
                    border: "none",
                    borderRadius: 7,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    flexShrink: 0,
                  }}
                >
                  Connect
                </button>
              </div>
            </div>

            {[{ title: "Account", desc: "Name, email, password" }, { title: "Notifications", desc: "Email alerts, daily digest" }, { title: "Team", desc: "Invite members, assign clients" }, { title: "Billing", desc: "Plan, payment method, invoices" }].map((s, i) => (
              <div key={i} className="row-hover" style={{ background: C.card, borderRadius: 10, padding: "14px 16px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div><div style={{ fontSize: 14, fontWeight: 600 }}>{s.title}</div><div style={{ fontSize: 12, color: C.textMuted }}>{s.desc}</div></div>
                <Icon name="chevron" size={16} color={C.border} />
              </div>
            ))}

            {/* Enterprise: Automated Sweep */}
            {tier === "enterprise" && (
              <div style={{ marginTop: 20 }}>
                {/* Sweep Schedule */}
                <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 12 }}>Automated Sweep</div>
                <div style={{ background: C.card, borderRadius: 12, padding: "16px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>Frequency</span>
                      <select style={{ padding: "6px 12px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 6, fontSize: 14, fontFamily: "inherit", background: C.surfaceWarm }}>
                        <option>Daily</option><option>Twice daily</option><option>Weekly (Monday AM)</option>
                      </select>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>Time</span>
                      <select style={{ padding: "6px 12px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 6, fontSize: 14, fontFamily: "inherit", background: C.surfaceWarm }}>
                        <option>6:00 AM</option><option>7:00 AM</option><option>8:00 AM</option><option>9:00 AM</option>
                      </select>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>Timezone</span>
                      <select style={{ padding: "6px 12px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 6, fontSize: 14, fontFamily: "inherit", background: C.surfaceWarm }}>
                        <option>Eastern</option><option>Central</option><option>Mountain</option><option>Pacific</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ marginTop: 12, fontSize: 12, color: C.textMuted }}>Last sweep: Today at 6:02 AM · {sweepData.clients_analyzed} clients</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>Next sweep: Tomorrow at 6:00 AM</div>
                  <button className="r-btn" data-tone="purple" style={{ width: "100%", marginTop: 12, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Run Sweep Now</button>
                </div>

                {/* Output Routing */}
                <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 12, marginTop: 20 }}>Output Routing</div>
                <div style={{ background: C.card, borderRadius: 12, padding: "16px" }}>
                  {[
                    { label: "Retayned Dashboard", checked: true, disabled: true, meta: "Always on" },
                    { label: "Slack Channel", checked: false, meta: "#retention-alerts" },
                    { label: "Webhook URL", checked: false, meta: "https://..." },
                    { label: "Email Digest", checked: false, meta: "team@company.com" },
                  ].map((r, ri) => (
                    <div key={ri} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: ri < 3 ? "1px solid " + C.borderLight : "none" }}>
                      <input type="checkbox" checked={r.checked} disabled={r.disabled} readOnly style={{ width: 16, height: 16 }} />
                      <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{r.label}</span>
                      <span style={{ fontSize: 12, color: C.textMuted }}>{r.meta}</span>
                    </div>
                  ))}
                </div>

                {/* API Access */}
                <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 12, marginTop: 20 }}>API Access</div>
                <div style={{ background: C.card, borderRadius: 12, padding: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>API Key</div>
                      <div style={{ fontSize: 12, color: C.textMuted }}>Use this key to authenticate API requests</div>
                    </div>
                    <button className="r-btn" data-tone="purple" style={{ padding: "6px 14px", background: C.btn, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Regenerate</button>
                  </div>
                  <div style={{ background: C.bg, borderRadius: 8, padding: "10px 14px", fontFamily: "monospace", fontSize: 12, color: C.textSec, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>sk_live_ret_••••••••••••••••••••a4f2</span>
                    <button style={{ background: "none", border: "none", fontSize: 12, color: C.primary, cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>Copy</button>
                  </div>

                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 16, marginBottom: 10 }}>Endpoints</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[
                      { method: "GET", path: "/api/sweeps/latest", desc: "Most recent sweep results" },
                      { method: "POST", path: "/api/sweeps/trigger", desc: "Run a sweep now" },
                      { method: "GET", path: "/api/clients/{id}/signals", desc: "Client automated analysis" },
                      { method: "GET", path: "/api/tasks", desc: "All open tasks" },
                      { method: "PATCH", path: "/api/tasks/{id}", desc: "Mark task complete" },
                      { method: "POST", path: "/api/clients/{id}/analyze", desc: "Trigger analysis on one client" },
                      { method: "GET", path: "/api/referrals/readiness", desc: "Referral readiness ranking" },
                    ].map((ep, ei) => (
                      <div key={ei} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: C.bg, borderRadius: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace", padding: "2px 6px", borderRadius: 3, background: ep.method === "GET" ? C.primarySoft : ep.method === "POST" ? "#EDE9FE" : "#FEF3C7", color: ep.method === "GET" ? C.primary : ep.method === "POST" ? C.btn : "#92400E" }}>{ep.method}</span>
                        <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 600, flex: 1 }}>{ep.path}</span>
                        <span style={{ fontSize: 12, color: C.textMuted }}>{ep.desc}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 16, marginBottom: 10 }}>Webhook Payload</div>
                  <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>On every sweep completion, the configured webhook receives the full output schema:</p>
                  <div style={{ background: "#1E261F", borderRadius: 8, padding: "14px", fontFamily: "monospace", fontSize: 11, color: "#A7C4B5", lineHeight: 1.6, overflow: "auto", maxHeight: 200 }}>
                    <div style={{ color: "#558B68" }}>{"// POST to your webhook URL"}</div>
                    <div>{"{"}</div>
                    <div style={{ paddingLeft: 16 }}>{'"sweep_id": "sweep_20260409",'}</div>
                    <div style={{ paddingLeft: 16 }}>{'"timestamp": "2026-04-09T06:02:00Z",'}</div>
                    <div style={{ paddingLeft: 16 }}>{'"portfolio_avg_score": 74,'}</div>
                    <div style={{ paddingLeft: 16 }}>{'"clients_analyzed": 47,'}</div>
                    <div style={{ paddingLeft: 16 }}>{'"alerts": [{ "client_id": "...", "level": "critical" }],'}</div>
                    <div style={{ paddingLeft: 16 }}>{'"tasks": [{ "client_id": "...", "action": "..." }],'}</div>
                    <div style={{ paddingLeft: 16 }}>{'"priority_ranking": [{ "client_id": "...", "score": 91, "drift": 2 }],'}</div>
                    <div style={{ paddingLeft: 16 }}>{'"data_gaps": [{ "client_id": "...", "missing": ["billing"] }]'}</div>
                    <div>{"}"}</div>
                  </div>
                </div>

                {/* MCP Server */}
                <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 12, marginTop: 20 }}>MCP Server</div>
                <div style={{ background: C.card, borderRadius: 12, padding: "16px" }}>
                  <p style={{ fontSize: 14, color: C.text, lineHeight: 1.5, marginBottom: 12 }}>Expose Retayned as a tool server for your AI agents. Any MCP-compatible agent can connect and call Retayned tools directly.</p>
                  
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "10px 14px", background: C.bg, borderRadius: 8 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted }}>Server URL</div>
                      <div style={{ fontSize: 12, fontFamily: "monospace", color: C.text, marginTop: 2 }}>https://mcp.retayned.com/v1/your-org-id</div>
                    </div>
                    <button style={{ background: "none", border: "none", fontSize: 12, color: C.primary, cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}>Copy</button>
                  </div>

                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Available Tools</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {[
                      { tool: "get_priority_ranking", desc: "Full client portfolio ranked by retention score" },
                      { tool: "get_client_risk_assessment", desc: "Single client signals, archetype, and Rai summary" },
                      { tool: "get_open_tasks", desc: "All pending tasks with priority and context" },
                      { tool: "complete_task", desc: "Mark a task as done" },
                      { tool: "trigger_sweep", desc: "Run an immediate portfolio analysis" },
                      { tool: "get_referral_readiness", desc: "Clients ranked by referral readiness" },
                      { tool: "get_sweep_history", desc: "Historical sweep results and trends" },
                    ].map((t, ti) => (
                      <div key={ti} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: C.bg, borderRadius: 6 }}>
                        <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 700, color: C.btn }}>{t.tool}</span>
                        <span style={{ fontSize: 12, color: C.textMuted, flex: 1 }}>{t.desc}</span>
                      </div>
                    ))}
                  </div>

                  {/* Sign Out */}
            <button onClick={async () => { await supabase.auth.signOut(); }} style={{ width: "100%", padding: "14px", background: "transparent", border: "1.5px solid " + C.danger + "44", borderRadius: 10, fontSize: 14, fontWeight: 600, color: C.danger, cursor: "pointer", fontFamily: "inherit", marginBottom: 16 }}>Sign Out</button>

            <div style={{ background: C.raiGrad, borderRadius: 12, padding: "14px 16px", color: "#fff", marginTop: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", color: "rgba(255,255,255,.4)", marginBottom: 6 }}>Coming Soon</div>
                    <p style={{ fontSize: 14, lineHeight: 1.55, color: "rgba(255,255,255,.7)" }}>Your AI agents will be able to connect to Retayned the same way Rai connects to Slack and HubSpot. Retention intelligence as a tool, not just a dashboard.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CLIENT SLIDE-OVER */}
      {selectedClient && (() => {
        const sc = selectedClient;
        const dims = sc.profileScores || {};
        const dimLabels = { trust: ["Trust", "Heavy oversight", "Full delegation"], loyalty: ["Loyalty", "Actively shopping", "Locked in, not looking"], expectations: ["Expectations", "Highly ambitious", "Reasonable, aligned"], grace: ["Grace", "Zero tolerance", "Gives benefit of the doubt"], commFrequency: ["Communication Frequency", "Radio silence", "Nonstop"], stressResponse: ["Stress Response", "Goes quiet internally", "Immediately escalates"], budgetCommitment: ["Budget Commitment", "Always under pressure", "Non-issue"], relationshipDepth: ["Relationship Depth", "Strictly transactional", "Genuine connection"], reportingNeed: ["Reporting Need", "Hands-off, minimal updates", "Wants every detail"], replaceability: ["Replaceability", "Plug and play", "Deeply embedded"], commTone: ["Communication Tone", "Reserved, guarded", "Warm, direct"], decisionMaking: ["Decision Making", "No authority, just a relay", "Full authority"] };

        // Hero+ helpers
        const _hash = (s) => (s || "").split("").reduce((a, ch) => a + ch.charCodeAt(0), 0);
        const _delta = sc.name ? ((_hash(sc.name) % 11) - 5) : 0;
        const _OWNERS = [
          { name: "Ana K.",    color: "#2C9A76" },
          { name: "Dev R.",    color: "#D17A1B" },
          { name: "Jordan P.", color: "#6D2BD9" },
          { name: "Sam L.",    color: "#1F7A5C" },
        ];
        const _owner = _OWNERS[_hash(sc.name || "") % _OWNERS.length];
        const _driftRaw = clientDrift[sc.name] || (sc.ret ? (sc.ret >= 80 ? "Thriving" : sc.ret >= 65 ? "Stable" : sc.ret >= 45 ? "Shifted" : "Declining") : "Stable");
        const _driftLabel = _driftRaw === "Something shifted" ? "Shifted" : _driftRaw;
        const _driftMeta = {
          Thriving:  { fg: C.retElite, bg: C.primaryGhost },
          Stable:    { fg: C.retGood,  bg: C.primaryGhost },
          Healthy:   { fg: C.retGood,  bg: C.primaryGhost },
          Watch:     { fg: C.retOk,    bg: "#FAF8EC" },
          Shifted:   { fg: C.retWarn,  bg: "#FBF1E2" },
          "At Risk": { fg: C.retWarn,  bg: "#FBF1E2" },
          Declining: { fg: C.retCrit,  bg: "#FBEAE3" },
          Critical:  { fg: C.retCrit,  bg: "#FBEAE3" },
        }[_driftLabel] || { fg: C.textSec, bg: C.bg };
        const _bucket = sc.ret ? (sc.ret >= 80 ? "Thriving" : sc.ret >= 65 ? "Healthy" : sc.ret >= 45 ? "Watch" : sc.ret >= 30 ? "At Risk" : "Critical") : "New";

        // 12-week retention trend (stubbed) — synthesizes trajectory ending at current score
        const _trend = (() => {
          const score = sc.ret || 50;
          const base = Math.max(10, score - _delta * 2.4);
          const pts = [];
          for (let i = 0; i < 12; i++) {
            const progress = i / 11;
            const target = base + (score - base) * progress;
            const wobble = Math.sin((i + _hash(sc.name || "")) * 1.1) * 2;
            pts.push(Math.max(1, Math.min(99, Math.round(target + wobble))));
          }
          pts[pts.length - 1] = score;
          return pts;
        })();
        const _trendUp = _trend[_trend.length - 1] > _trend[0];
        const _trendColor = _trendUp ? C.retGood : C.retWarn;

        return (
          <>
            <div onClick={() => setSelectedClient(null)} style={{ position: "fixed", inset: 0, background: "rgba(20,30,22,0.32)", zIndex: 90 }} />
            <div className="r-client-modal" style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "100%", maxWidth: 520, maxHeight: "90vh", background: C.card, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", zIndex: 100, overflowY: "auto", borderRadius: 16 }}>
              {/* Top bar — close only (industry now lives in hero eyebrow) */}
              <div style={{ padding: "12px 20px", display: "flex", justifyContent: "flex-end", position: "sticky", top: 0, background: C.card, zIndex: 1, borderBottom: "1px solid " + C.borderLight }}>
                <button onClick={() => setSelectedClient(null)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.textMuted, lineHeight: 1, padding: 0, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
              </div>

              {/* Hero — gradient band: eyebrow meta · name · delta · score */}
              <div style={{ padding: "20px 20px 14px", background: "linear-gradient(180deg, " + C.surfaceWarm + " 0%, " + C.card + " 100%)" }}>
                {/* Eyebrow: industry · tenure */}
                <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, marginBottom: 6 }}>
                  {sc.tag || "Client"}{sc.months ? " · with you " + (sc.months >= 12 ? (sc.months / 12).toFixed(1) + " years" : sc.months + " months") : ""}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, color: C.text, margin: 0, lineHeight: 1.15 }}>{sc.name}</h2>
                    {(() => {
                      // Pause status line: "Currently paused since May 4 · 2 previous pauses"
                      // Renders only when relevant — if a client has never been paused,
                      // skip the line entirely to keep the header clean.
                      const pauses = engagementPausesByClient[sc.id] || [];
                      if (pauses.length === 0) return null;
                      const openPause = pauses.find(p => !p.resumed_at);
                      const previousCount = pauses.filter(p => p.resumed_at).length;
                      const fmtDate = (d) => {
                        try {
                          return new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString(undefined, { month: "short", day: "numeric" });
                        } catch { return d; }
                      };
                      const parts = [];
                      if (openPause) parts.push("Currently paused since " + fmtDate(openPause.paused_at));
                      if (previousCount > 0) parts.push(previousCount + " previous pause" + (previousCount === 1 ? "" : "s"));
                      if (parts.length === 0) return null;
                      return (
                        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4, fontWeight: 500 }}>
                          {parts.join(" · ")}
                        </div>
                      );
                    })()}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                      {sc.ret ? (
                        <span style={{ fontSize: 11.5, fontWeight: 700, padding: "4px 11px", borderRadius: 999, color: _driftMeta.fg, background: _driftMeta.bg, fontVariantNumeric: "tabular-nums" }}>
                          {_delta >= 0 ? "↑" : "↓"} {Math.abs(_delta)} · {_driftLabel}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11.5, fontWeight: 700, padding: "4px 11px", borderRadius: 999, color: C.textSec, background: C.bg }}>First check pending</span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    {sc.ret ? (
                      <>
                        <div style={{ fontSize: 44, fontWeight: 800, color: retColor(sc.ret), letterSpacing: -1.6, lineHeight: 0.9, fontVariantNumeric: "tabular-nums" }}>{sc.ret}</div>
                        <div style={{ fontSize: 9.5, fontWeight: 700, color: C.textMuted, letterSpacing: 1.2, marginTop: 6, textTransform: "uppercase" }}>{_bucket}</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 22, fontWeight: 700, color: C.textMuted, letterSpacing: -0.5 }}>New</div>
                    )}
                  </div>
                </div>

                {/* 12-week trend — lives inside the gradient hero */}
                {sc.ret && (() => {
                  const w = 480, h = 56, pad = 2;
                  const min = Math.min(..._trend);
                  const max = Math.max(..._trend);
                  const range = Math.max(1, max - min);
                  const innerW = w - pad * 2;
                  const innerH = h - pad * 2;
                  const coords = _trend.map((v, i) => [
                    pad + (i / (_trend.length - 1)) * innerW,
                    pad + innerH - ((v - min) / range) * innerH,
                  ]);
                  const linePath = coords.map((c, i) => (i === 0 ? "M" : "L") + c[0].toFixed(1) + "," + c[1].toFixed(1)).join(" ");
                  const areaPath = `${linePath} L${coords[coords.length - 1][0].toFixed(1)},${pad + innerH} L${coords[0][0].toFixed(1)},${pad + innerH} Z`;
                  return (
                    <div style={{ marginTop: 16 }}>
                      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
                        <path d={areaPath} fill={_trendColor} fillOpacity="0.12" />
                        <path d={linePath} fill="none" stroke={_trendColor} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                      </svg>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: C.textMuted, letterSpacing: 0.1 }}>
                        <span>12 weeks ago</span>
                        <span>this week</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Stat strip — MRR · LTV · Tenure */}
              {sc.ret && (
                <div style={{ display: "flex", padding: "14px 20px", background: C.surfaceWarm, borderTop: "1px solid " + C.borderLight, borderBottom: "1px solid " + C.borderLight }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase" }}>MRR</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>${(sc.revenue / 1000).toFixed(1)}k</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase" }}>LTV</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>${Math.round(getAdjustedLTV(sc) / 1000)}k</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase" }}>Tenure</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>{sc.months >= 12 ? (sc.months / 12).toFixed(1) + " yr" : sc.months + " mo"}</div>
                  </div>
                </div>
              )}

              <div style={{ padding: "16px 20px 0" }}>
                <div style={{ display: "flex", gap: 0, background: C.surface, borderRadius: 10, padding: 3 }}>
                  {["Overview", "Profile", "Billing", "Flags"].map(t => {
                    const isActive = clientTab === t.toLowerCase();
                    return (
                      <button key={t} onClick={() => setClientTab(t.toLowerCase())} style={{
                        flex: 1, padding: "10px", borderRadius: 8, border: "none",
                        background: isActive ? C.card : "transparent",
                        color: isActive ? C.text : C.textMuted,
                        fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                        boxShadow: isActive ? "var(--rt-sh-card-lift)" : "none",
                        transform: isActive ? "translateY(-0.5px)" : "none",
                        transition: "background 0.15s ease, color 0.15s ease, box-shadow 180ms var(--rt-ease-out), transform 180ms var(--rt-ease-out)",
                      }}>{t}</button>
                    );
                  })}
                </div>
              </div>

              <div style={{ padding: "16px 20px" }}>
                {/* Overview */}
                {clientTab === "overview" && (
                  <div>
                    {!editingOverview ? (
                      <>
                        {(() => {
                          const pendingHc = hcQueue.find(h => h.client === sc.name);
                          const hcValue = (() => {
                            if (!pendingHc) return sc.lastHC ? "Last: " + sc.lastHC : "Pending";
                            if (pendingHc.overdue > 0) return `Overdue by ${pendingHc.overdue}d`;
                            if (pendingHc.due === "Today") return "Due today";
                            return `In ${pendingHc.daysUntil}d`;
                          })();
                          const canStartEarly = pendingHc && pendingHc.isFirstHC && pendingHc.overdue === 0 && pendingHc.due !== "Today";
                          return (
                            <>
                              {[
                                { l: "Contact",      v: sc.contact || "—" },
                                { l: "Role",         v: sc.role || "—" },
                              ].map((d, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid " + C.borderLight }}>
                                  <span style={{ fontSize: 14, color: C.textSec }}>{d.l}</span>
                                  <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{d.v}</span>
                                </div>
                              ))}
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid " + C.borderLight, gap: 10 }}>
                                <span style={{ fontSize: 14, color: C.textSec }}>Health Check</span>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{hcValue}</span>
                                  {canStartEarly && (
                                    <button onClick={() => { setPage("health"); setHcOpen(sc.name); setSelectedClient(null); }} style={{ background: "none", border: "none", padding: 0, fontSize: 12, fontWeight: 600, color: C.btn, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
                                      Start early
                                    </button>
                                  )}
                                </div>
                              </div>
                              {[
                                { l: "Referrals",    v: sc.referrals || 0 },
                                { l: "Renewal",      v: sc.renewal_date ? new Date(sc.renewal_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Not set", muted: !sc.renewal_date },
                              ].map((d, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid " + C.borderLight }}>
                                  <span style={{ fontSize: 14, color: C.textSec }}>{d.l}</span>
                                  <span style={{ fontSize: 14, fontWeight: 600, color: d.muted ? C.textMuted : C.text }}>{d.v}</span>
                                </div>
                              ))}
                            </>
                          );
                        })()}
                        {/* Recent activity — last 7 days. Pulls from completed
                            tasks and logged touchpoints for this client. Empty
                            state suppresses entirely so a brand-new client
                            doesn't render an empty container. */}
                        {(() => {
                          const NOW = Date.now();
                          const SEVEN_D = 7 * 24 * 60 * 60 * 1000;

                          const taskEvents = (tasks || [])
                            .filter(t => t.client === sc.name && t.done && t.completed_at)
                            .map(t => {
                              const ts = new Date(t.completed_at).getTime();
                              return { ts, kind: "task", text: t.text };
                            })
                            .filter(e => (NOW - e.ts) <= SEVEN_D);

                          const tpEvents = (allTouchpoints || [])
                            .filter(tp => (tp.client_name === sc.name || tp.client_id === sc.id) && tp.occurred_at)
                            .map(tp => {
                              const ts = new Date(tp.occurred_at).getTime();
                              return { ts, kind: "touchpoint", text: tp.channel || "Touchpoint" };
                            })
                            .filter(e => (NOW - e.ts) <= SEVEN_D);

                          const events = [...taskEvents, ...tpEvents].sort((a, b) => b.ts - a.ts).slice(0, 6);
                          if (events.length === 0) return null;

                          const relTime = (ts) => {
                            const diff = NOW - ts;
                            const hours = Math.floor(diff / (60 * 60 * 1000));
                            if (hours < 1) return "just now";
                            if (hours < 24) return hours + "h ago";
                            const days = Math.floor(hours / 24);
                            if (days === 1) return "yesterday";
                            return days + "d ago";
                          };

                          return (
                            <div style={{ marginTop: 18 }}>
                              <div style={{ fontSize: 10.5, fontWeight: 700, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 8 }}>Recent activity · 7d</div>
                              <div style={{ background: C.bg, borderRadius: 10, padding: 4 }}>
                                {events.map((e, i) => (
                                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderTop: i > 0 ? "1px solid " + C.borderLight : "none" }}>
                                    <div style={{
                                      width: 22, height: 22, borderRadius: "50%",
                                      background: e.kind === "task" ? C.primarySoft : C.surface,
                                      color: e.kind === "task" ? C.primary : C.textMuted,
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                      fontSize: 11, fontWeight: 700, flexShrink: 0,
                                    }}>
                                      {e.kind === "task" ? "✓" : "·"}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      <span style={{ color: C.text, fontWeight: 600 }}>
                                        {e.kind === "task" ? "Task done" : (e.text || "Touchpoint")}
                                      </span>
                                      {e.kind === "task" && e.text ? <span>: {e.text}</span> : null}
                                    </div>
                                    <div style={{ fontSize: 11, color: C.textMuted, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{relTime(e.ts)}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Edit Client Details</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {[{ key: "contact", label: "Contact name" }, { key: "role", label: "Role" }, { key: "tag", label: "Industry" }].map(f => (
                            <div key={f.key}>
                              <label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>{f.label}</label>
                              <input value={overviewEditData[f.key] || ""} onChange={e => setOverviewEditData({ ...overviewEditData, [f.key]: e.target.value })} style={{ width: "100%", padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.surfaceWarm, background: C.bg }} />
                            </div>
                          ))}
                          <div>
                            <label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Months together</label>
                            <input type="number" value={overviewEditData.months || 0} onChange={e => setOverviewEditData({ ...overviewEditData, months: parseInt(e.target.value) || 0 })} style={{ width: "100%", padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.surfaceWarm, background: C.bg }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Current monthly rate ($)</label>
                            <input type="number" value={overviewEditData.revenue || 0} onChange={e => setOverviewEditData({ ...overviewEditData, revenue: parseInt(e.target.value) || 0 })} style={{ width: "100%", padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.surfaceWarm, background: C.bg }} />
                            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, lineHeight: 1.4 }}>
                              Your best estimate of monthly revenue. Changing this will not affect prior months.
                            </div>
                          </div>
                          {/* Revenue change reason — only revealed when the rate actually
                              differs from the current saved value. Optional. Lets Rai see
                              the narrative behind movement (expansion, contraction, etc)
                              rather than just the numbers. */}
                          {Number(overviewEditData.revenue || 0) !== Number(sc.revenue || 0) && (
                            <div style={{ background: C.surfaceWarm, borderRadius: 8, padding: "12px" }}>
                              <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>Why is the rate changing? (optional)</label>
                              <select value={overviewEditData.change_reason || ""} onChange={e => setOverviewEditData({ ...overviewEditData, change_reason: e.target.value })} style={{ width: "100%", padding: "10px 12px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", background: C.surfaceWarm, marginBottom: 6 }}>
                                <option value="">Skip — no reason given</option>
                                <option value="expansion">Expansion (scope grew)</option>
                                <option value="contraction">Contraction (scope shrank)</option>
                                <option value="annual_increase">Annual rate increase</option>
                                <option value="discount_expired">Discount expired</option>
                                <option value="discount_applied">Discount applied</option>
                                <option value="renegotiation">Renegotiation</option>
                                <option value="correction">Correction (typo / wrong rate)</option>
                                <option value="other">Other</option>
                              </select>
                              <input type="text" value={overviewEditData.change_note || ""} onChange={e => setOverviewEditData({ ...overviewEditData, change_note: e.target.value })} placeholder="Note (optional)" style={{ width: "100%", padding: "10px 12px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", background: C.surfaceWarm, boxSizing: "border-box" }} />
                            </div>
                          )}
                          {!showBaselineEdit ? (
                            <button
                              type="button"
                              onClick={() => setShowBaselineEdit(true)}
                              style={{
                                fontSize: 12,
                                color: C.textMuted,
                                background: "transparent",
                                border: "none",
                                padding: "4px 0",
                                cursor: "pointer",
                                fontFamily: "inherit",
                                textAlign: "left",
                                textDecoration: "underline",
                                textDecorationColor: C.borderLight,
                                textUnderlineOffset: 3,
                                alignSelf: "flex-start",
                              }}
                            >
                              Adjust historical revenue baseline
                            </button>
                          ) : (
                            <div>
                              <label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Lifetime revenue earned before today ($)</label>
                              <input type="number" value={overviewEditData.lifetime_revenue_at_entry || 0} onChange={e => setOverviewEditData({ ...overviewEditData, lifetime_revenue_at_entry: parseFloat(e.target.value) || 0 })} style={{ width: "100%", padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.surfaceWarm, background: C.bg }} />
                              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, lineHeight: 1.4 }}>
                                What you earned from this client BEFORE Retayned tracked them. Only edit this if you skipped it during onboarding or got the number wrong.
                              </div>
                            </div>
                          )}
                          <div>
                            <label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Renewal date <span style={{ color: C.textMuted, fontWeight: 400 }}>· optional</span></label>
                            <input type="date" value={overviewEditData.renewal_date ? String(overviewEditData.renewal_date).split("T")[0] : ""} onChange={e => setOverviewEditData({ ...overviewEditData, renewal_date: e.target.value || null })} style={{ width: "100%", padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.surfaceWarm, background: C.bg, colorScheme: "light" }} />
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                          <button onClick={() => setEditingOverview(false)} style={{ padding: "10px 16px", background: C.surface, color: C.textSec, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                          <button onClick={async () => {
                            const newRate = Number(overviewEditData.revenue) || 0;
                            const newBaseline = Number(overviewEditData.lifetime_revenue_at_entry) || 0;
                            const rateChanged = newRate !== Number(sc.revenue || 0);

                            // Always save the non-revenue fields via clientsDb.update.
                            // Revenue specifically goes through revenueHistoryDb.changeRate
                            // when it changed — that closes the active history row, opens
                            // a new one, AND updates clients.revenue. Calling clientsDb.update
                            // first with the new revenue would race with that.
                            const baseUpdates = {
                              contact: overviewEditData.contact,
                              role: overviewEditData.role,
                              tag: overviewEditData.tag,
                              months: overviewEditData.months,
                              renewal_date: overviewEditData.renewal_date || null,
                              lifetime_revenue_at_entry: newBaseline,
                            };
                            // If revenue did NOT change, include it in the update so we
                            // don't make an extra call.
                            if (!rateChanged) baseUpdates.revenue = newRate;

                            // Optimistic local update
                            const updated = {
                              ...sc,
                              ...baseUpdates,
                              revenue: newRate,
                              // ltv recompute: pre-entry baseline + history. Since rate
                              // change just happened (or didn't), the current row's
                              // contribution stays roughly the same. The new pre-entry
                              // baseline shifts the total directly.
                              ltv: newBaseline + (Number(sc.ltv || 0) - Number(sc.lifetime_revenue_at_entry || 0)),
                            };
                            setClients(prev => prev.map(c => c.id === sc.id ? updated : c));
                            setSelectedClient(updated);
                            setEditingOverview(false);

                            // Persist
                            try {
                              await clientsDb.update(sc.id, baseUpdates);
                              if (rateChanged) {
                                await revenueHistoryDb.changeRate(user.id, sc.id, newRate, overviewEditData.change_reason || null, overviewEditData.change_note || null);
                              }
                            } catch (e) {
                              console.error("Failed to save client edits:", e);
                            }
                          }} style={{ flex: 1, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
                        </div>
                      </>
                    )}
                {/* Destructive action CONFIRM blocks — triggered by the
                    sticky footer at modal level. When no confirm is active
                    this renders nothing (the sticky footer is visible
                    instead). The four confirm dialogs preserve the existing
                    state-machine semantics. */}
                <div style={{ marginTop: 18 }}>
                  {!rolodexConfirm && !removeConfirm && !pauseConfirm && !resumeConfirm ? null : pauseConfirm ? (
                    <div style={{ background: C.surfaceWarm, borderRadius: 12, padding: "16px" }}>
                      <p style={{ fontSize: 14, color: C.text, lineHeight: 1.55, marginBottom: 14 }}>This client will be paused. Their tasks stay visible but Rai stops surfacing them, and their retention score will drop -4. Tenure clock freezes until you resume.</p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={async () => {
                          // Optimistic: flip is_paused, drop ret -4
                          const newRet = Math.max(1, (sc.ret || 50) - 4);
                          setClients(clients.map(c => c.id === sc.id ? { ...c, is_paused: true, ret: newRet, retention_score: newRet } : c));
                          setSelectedClient({ ...sc, is_paused: true, ret: newRet, retention_score: newRet });
                          setPauseConfirm(false);
                          // Persist: open pause row + bump retention_score down -4
                          try {
                            await clientEngagementPausesDb.start(user.id, sc.id);
                            await clientsDb.update(sc.id, { retention_score: newRet });
                            // Refresh pauses map so subsequent reads see the new pause
                            setEngagementPausesByClient(prev => ({
                              ...prev,
                              [sc.id]: [...(prev[sc.id] || []), { paused_at: localYmd(), resumed_at: null }],
                            }));
                          } catch (e) {
                            console.error("Failed to pause:", e);
                          }
                        }} style={{ flex: 1, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Pause engagement</button>
                        <button onClick={() => setPauseConfirm(false)} style={{ padding: "10px 14px", background: C.surface, color: C.textMuted, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                      </div>
                    </div>
                  ) : resumeConfirm ? (
                    <div style={{ background: C.primarySoft, borderRadius: 12, padding: "16px", border: "1px solid " + C.primary + "33" }}>
                      <p style={{ fontSize: 14, color: C.text, lineHeight: 1.55, marginBottom: 14 }}>Resume the engagement with this client. Their tasks will start surfacing again and tenure resumes growing. The -4 retention dent from pausing stays — it doesn't auto-restore.</p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={async () => {
                          // Optimistic
                          setClients(clients.map(c => c.id === sc.id ? { ...c, is_paused: false } : c));
                          setSelectedClient({ ...sc, is_paused: false });
                          setResumeConfirm(false);
                          try {
                            await clientEngagementPausesDb.end(user.id, sc.id);
                            // Update pauses map: set resumed_at on the open one
                            setEngagementPausesByClient(prev => {
                              const list = prev[sc.id] || [];
                              const today = localYmd();
                              const updated = list.map(p => p.resumed_at ? p : { ...p, resumed_at: today });
                              return { ...prev, [sc.id]: updated };
                            });
                          } catch (e) {
                            console.error("Failed to resume:", e);
                          }
                        }} style={{ flex: 1, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Resume engagement</button>
                        <button onClick={() => setResumeConfirm(false)} style={{ padding: "10px 14px", background: C.surface, color: C.textMuted, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                      </div>
                    </div>
                  ) : rolodexConfirm ? (
                    <div style={{ background: C.primarySoft, borderRadius: 12, padding: "16px", border: "1px solid " + C.primary + "33" }}>
                      <p style={{ fontSize: 14, color: C.text, lineHeight: 1.55, marginBottom: 14 }}>This client will be moved to your Rolodex for future tracking. Relationships change — this keeps the door open. Rai's memory of them will be cleared.</p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="r-btn" data-tone="purple" onClick={async () => {
                          // Build the rolodex row from the client being moved.
                          // Preserve as much context as possible — relationship
                          // history is the entire point of the Rolodex. None of
                          // this is reversible without manual reconstruction.
                          const todayDisplay = new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" });
                          const payload = {
                            client_name: sc.name,
                            contact_name: sc.contact || "",
                            months: sc.months || 0,
                            type: "former",
                            date_added: todayDisplay,
                            tags: [],
                            priority: null,
                            // Carry notes if present — gives the user a starting
                            // point in the retro flow rather than blank slate.
                            notes: sc.notes || "",
                            // Empty retro_answers so the standard retro flow
                            // engages (lets the user fill in why they parted).
                            retro_answers: {},
                          };
                          // Optimistic UI: insert into local state first so the
                          // user sees the row immediately. If the DB insert
                          // fails, roll back.
                          const tempId = "tmp-" + Date.now();
                          const optimistic = {
                            id: tempId,
                            client: sc.name,
                            contact: sc.contact || "",
                            months: sc.months || 0,
                            type: "former",
                            date: todayDisplay,
                            tags: [],
                            priority: null,
                            work: sc.notes || "",
                          };
                          setRolodex(prev => [optimistic, ...prev]);
                          setClients(clients.filter(c => c.id !== sc.id));
                          // Persist. Sequencing matters: deactivate the client
                          // BEFORE creating the rolodex row so that if the
                          // rolodex insert succeeds but the deactivate fails,
                          // we don't end up with the client visible in both
                          // surfaces. Reverse order would risk the opposite.
                          let createdRow = null;
                          try {
                            const { data, error } = await rolodexDb.create(user.id, payload);
                            if (error) throw error;
                            createdRow = data;
                          } catch (e) {
                            console.error("Failed to persist rolodex move:", e);
                            // Roll back UI — re-add client, drop optimistic row.
                            setRolodex(prev => prev.filter(r => r.id !== tempId));
                            setClients(prev => [...prev, sc]);
                            setRolodexConfirm(false);
                            alert("Could not move " + sc.name + " to the Rolodex. Please try again — they have not been moved.");
                            return;
                          }
                          // Swap temp row for the real DB row (gets the real
                          // UUID so subsequent edits hit the right record).
                          if (createdRow) {
                            setRolodex(prev => prev.map(r => r.id === tempId ? {
                              id: createdRow.id,
                              client: createdRow.client_name,
                              contact: createdRow.contact_name,
                              months: createdRow.months || 0,
                              type: createdRow.type,
                              date: createdRow.date_added,
                              tags: createdRow.tags || [],
                              priority: createdRow.priority,
                              work: createdRow.notes,
                            } : r));
                          }
                          // Mark the client deactivated in DB. If this fails
                          // we don't roll the rolodex back — the row IS in the
                          // rolodex truthfully; the client will reappear on
                          // next refresh because deactivate didn't land, but
                          // the user can retry from there. Logged loudly.
                          try {
                            await clientsDb.deactivate(sc.id);
                          } catch (e) {
                            console.error("Failed to deactivate client after rolodex move:", e);
                          }
                          setSelectedClient(null);
                          setRolodexConfirm(false);
                          setPage("retros");
                        }} style={{ flex: 1, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Move to Rolodex</button>
                        <button onClick={() => setRolodexConfirm(false)} style={{ padding: "10px 14px", background: C.surface, color: C.textMuted, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: C.bg, borderRadius: 12, padding: "16px" }}>
                      <p style={{ fontSize: 14, color: C.text, lineHeight: 1.55, marginBottom: 14 }}>This will permanently delete this client from your account — all tasks, touchpoints, health checks, and Rai's memory of them will be erased. This cannot be undone.</p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => { setClients(clients.filter(c => c.id !== sc.id));
                          clientsDb.hardDelete(sc.id); setSelectedClient(null); setRemoveConfirm(false); }} style={{ flex: 1, padding: "10px", background: C.surface, color: C.textSec, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Terminate Permanently</button>
                        <button className="r-btn" data-tone="purple" onClick={() => setRemoveConfirm(false)} style={{ padding: "10px 14px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
                  </div>
                )}

                {/* Profile — 12 dimensions */}
                {clientTab === "profile" && (
                  <div>
                    {!editingProfile ? (
                      <div>
                        {Object.keys(dims).length > 0 ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                            {/* Radar visualization — 12-point polygon. Shape reads the
                                relationship at a glance; dents (low dimensions) pop
                                visually. Background rings at quartiles, faint spokes
                                from center, polygon filled at 18% opacity + 1.5px
                                stroke + corner dots. */}
                            <svg width="200" height="200" viewBox="0 0 200 200" style={{ flexShrink: 0 }}>
                              <g fill="none" stroke={C.borderLight} strokeWidth="1">
                                <circle cx="100" cy="100" r="20" />
                                <circle cx="100" cy="100" r="40" />
                                <circle cx="100" cy="100" r="60" />
                                <circle cx="100" cy="100" r="80" />
                              </g>
                              <g fill="none" stroke={C.borderLight} strokeWidth="0.5">
                                {profileDimensions.map((d, i) => {
                                  const angle = (i / profileDimensions.length) * 2 * Math.PI - Math.PI / 2;
                                  const x = 100 + 80 * Math.cos(angle);
                                  const y = 100 + 80 * Math.sin(angle);
                                  return <line key={d.key} x1="100" y1="100" x2={x} y2={y} />;
                                })}
                              </g>
                              {(() => {
                                const points = profileDimensions.map((d, i) => {
                                  const val = dims[d.key] !== undefined && dims[d.key] !== null ? Number(dims[d.key]) : 0;
                                  const angle = (i / profileDimensions.length) * 2 * Math.PI - Math.PI / 2;
                                  const r = (Math.max(0, Math.min(10, val)) / 10) * 80;
                                  return [100 + r * Math.cos(angle), 100 + r * Math.sin(angle)];
                                });
                                const polyStr = points.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
                                return (
                                  <>
                                    <polygon points={polyStr} fill={C.primary} fillOpacity="0.18" stroke={C.primary} strokeWidth="1.5" strokeLinejoin="round" />
                                    {points.map((p, i) => (
                                      <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill={C.primary} />
                                    ))}
                                  </>
                                );
                              })()}
                            </svg>
                            {/* Legend — 12 dimension rows. Low values (≤4) coloured
                                warn-red so weak points jump off the list even
                                without looking at the radar shape. */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 180 }}>
                              {profileDimensions.map(d => {
                                const val = dims[d.key];
                                const isSet = val !== undefined && val !== null;
                                const isLow = isSet && Number(val) <= 4;
                                return (
                                  <div key={d.key} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, fontSize: 11.5, padding: "2px 0" }}>
                                    <span style={{ color: C.textSec }}>{d.name}</span>
                                    <span style={{ color: isLow ? C.retWarn : C.text, fontWeight: 700, fontVariantNumeric: "tabular-nums", minWidth: 18, textAlign: "right" }}>{isSet ? val : "—"}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div style={{ textAlign: "center", padding: "20px 0", color: C.textMuted, fontSize: 14 }}>
                            No profile set yet. Build one to help Rai understand this client.
                          </div>
                        )}
                        <button className="r-btn" data-tone="purple" onClick={() => { setEditScores({ ...dims }); setEditingProfile(true); }} style={{ width: "100%", padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 12 }}>
                          {Object.keys(dims).length > 0 ? "Edit Profile" : "Build Profile"}
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Edit Relationship Profile</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {profileDimensions.map(d => {
                            const val = editScores[d.key] !== undefined ? editScores[d.key] : 5;
                            const labels = dimLabels[d.key] || [d.name, "Low", "High"];
                            return (
                              <div key={d.key}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                                  <span style={{ fontSize: 14, fontWeight: 600 }}>{d.name}</span>
                                  <span style={{ fontSize: 14, fontWeight: 700, color: C.primary }}>{val}</span>
                                </div>
                                <input type="range" min="0" max="10" value={val} onChange={e => setEditScores({ ...editScores, [d.key]: parseInt(e.target.value) })} style={{ width: "100%", height: 6, appearance: "none", WebkitAppearance: "none", background: `linear-gradient(to right, ${C.border} 0%, ${C.primary} 100%)`, borderRadius: 3, outline: "none", cursor: "pointer" }} />
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.textMuted }}>
                                  <span>{labels[1]}</span><span>{labels[2]}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                          <button onClick={() => setEditingProfile(false)} style={{ padding: "10px 16px", background: C.surface, color: C.textSec, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                          <button onClick={async () => {
                            const newRet = calcRetentionScore(editScores, null, sc.qualifyingFlags || {}, sc.months || 0);
                            const updated = clients.map(c => c.id === sc.id ? { ...c, profileScores: { ...editScores }, ret: newRet || c.ret } : c);
                            setClients(updated);
                            setSelectedClient({ ...sc, profileScores: { ...editScores }, ret: newRet || sc.ret });
                            setEditingProfile(false);
                            clientsDb.updateScores(sc.id, newRet || sc.ret, { ...editScores });
                          }} style={{ flex: 1, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Save Profile</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}




                {/* Billing */}
                {clientTab === "billing" && (() => {
                  const billing = clientBilling[sc.id] || { items: [] };
                  const now = new Date();
                  const currentMonth = now.toLocaleString("default", { month: "long", year: "numeric" });
                  const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                  const nextMonth = nextDate.toLocaleString("default", { month: "long", year: "numeric" });
                  // Previous month for read-only retrospective view.
                  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                  const prevMonth = prevDate.toLocaleString("default", { month: "long", year: "numeric" });
                  // Active months = the three we render at full fidelity.
                  // prev = read-only (status togglable but no item edits).
                  // current/next = fully editable.
                  const activeMonths = [prevMonth, currentMonth, nextMonth];

                  const getMonthItems = (month) => billing.items.filter(i => i.month === month);
                  const getMonthTotal = (month) => getMonthItems(month).reduce((a, i) => a + i.amount, 0);
                  // pastMonths now means "older than previous month" — the deeper history list.
                  const pastMonths = [...new Set(billing.items.map(i => i.month))].filter(m => !activeMonths.includes(m));

                  // Status lookup helper. Returns { invoiced, paid } for a given
                  // month (defaults false/false if no row exists yet).
                  const getStatus = (month) => {
                    const clientStatus = billingMonthStatus[sc.id] || {};
                    const row = clientStatus[month];
                    return { invoiced: !!row?.invoiced, paid: !!row?.paid };
                  };

                  // Toggle invoiced/paid for a month. Optimistic update + DB write.
                  const toggleInvoiced = async (month) => {
                    const cur = getStatus(month);
                    const next = !cur.invoiced;
                    // Optimistic local update
                    setBillingMonthStatus(prev => {
                      const c = { ...(prev[sc.id] || {}) };
                      c[month] = { ...(c[month] || {}), invoiced: next, invoiced_at: next ? new Date().toISOString() : null };
                      return { ...prev, [sc.id]: c };
                    });
                    try {
                      const { error } = await clientBillingMonthStatusDb.setInvoiced(user.id, sc.id, month, next);
                      if (error) throw error;
                    } catch (e) {
                      console.warn("setInvoiced failed:", e);
                      // Roll back
                      setBillingMonthStatus(prev => {
                        const c = { ...(prev[sc.id] || {}) };
                        c[month] = { ...(c[month] || {}), invoiced: cur.invoiced, invoiced_at: cur.invoiced ? new Date().toISOString() : null };
                        return { ...prev, [sc.id]: c };
                      });
                    }
                  };
                  const togglePaid = async (month) => {
                    const cur = getStatus(month);
                    const next = !cur.paid;
                    setBillingMonthStatus(prev => {
                      const c = { ...(prev[sc.id] || {}) };
                      c[month] = { ...(c[month] || {}), paid: next, paid_at: next ? new Date().toISOString() : null };
                      return { ...prev, [sc.id]: c };
                    });
                    try {
                      const { error } = await clientBillingMonthStatusDb.setPaid(user.id, sc.id, month, next);
                      if (error) throw error;
                    } catch (e) {
                      console.warn("setPaid failed:", e);
                      setBillingMonthStatus(prev => {
                        const c = { ...(prev[sc.id] || {}) };
                        c[month] = { ...(c[month] || {}), paid: cur.paid, paid_at: cur.paid ? new Date().toISOString() : null };
                        return { ...prev, [sc.id]: c };
                      });
                    }
                  };

                  // ─── Billing terms handlers ────────────────────────────────
                  // Terms are an editable, append-able log per client. Newest entry
                  // is "current" (sorted by created_at desc). All entries editable
                  // and deletable.
                  const termsForClient = billingTerms[sc.id] || [];
                  const currentTerm = termsForClient[0] || null;
                  const historyTerms = termsForClient.slice(1);

                  const addTerm = async () => {
                    const body = (termsEditDraft || "").trim();
                    if (!body) return;
                    const tempId = "temp-" + Date.now();
                    // Optimistic prepend
                    const optimistic = { id: tempId, body, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
                    setBillingTerms(prev => ({ ...prev, [sc.id]: [optimistic, ...(prev[sc.id] || [])] }));
                    setTermsAddingNew(prev => ({ ...prev, [sc.id]: false }));
                    setTermsEditDraft("");
                    try {
                      const { data, error } = await clientBillingTermsDb.create(user.id, sc.id, body);
                      if (error) throw error;
                      // Swap temp ID for real
                      if (data) {
                        setBillingTerms(prev => {
                          const list = (prev[sc.id] || []).map(t => t.id === tempId ? {
                            id: data.id, body: data.body, created_at: data.created_at, updated_at: data.updated_at,
                          } : t);
                          return { ...prev, [sc.id]: list };
                        });
                      }
                    } catch (e) {
                      console.warn("addTerm failed:", e);
                      // Roll back
                      setBillingTerms(prev => ({ ...prev, [sc.id]: (prev[sc.id] || []).filter(t => t.id !== tempId) }));
                    }
                  };

                  const saveTermEdit = async (entryId) => {
                    const body = (termsEditDraft || "").trim();
                    if (!body) return;
                    const prev = termsForClient.find(t => t.id === entryId);
                    if (!prev) return;
                    setBillingTerms(curr => {
                      const list = (curr[sc.id] || []).map(t => t.id === entryId ? { ...t, body, updated_at: new Date().toISOString() } : t);
                      return { ...curr, [sc.id]: list };
                    });
                    setTermsEditingId(null);
                    setTermsEditDraft("");
                    try {
                      const { error } = await clientBillingTermsDb.update(entryId, body);
                      if (error) throw error;
                    } catch (e) {
                      console.warn("saveTermEdit failed:", e);
                      setBillingTerms(curr => {
                        const list = (curr[sc.id] || []).map(t => t.id === entryId ? prev : t);
                        return { ...curr, [sc.id]: list };
                      });
                    }
                  };

                  const removeTerm = async (entryId) => {
                    if (!confirm("Delete this entry?")) return;
                    const removed = termsForClient.find(t => t.id === entryId);
                    setBillingTerms(curr => ({ ...curr, [sc.id]: (curr[sc.id] || []).filter(t => t.id !== entryId) }));
                    try {
                      const { error } = await clientBillingTermsDb.remove(entryId);
                      if (error) throw error;
                    } catch (e) {
                      console.warn("removeTerm failed:", e);
                      // Roll back
                      if (removed) {
                        setBillingTerms(curr => {
                          const list = [...(curr[sc.id] || []), removed].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                          return { ...curr, [sc.id]: list };
                        });
                      }
                    }
                  };

                  const formatTermDate = (iso) => {
                    if (!iso) return "";
                    const d = new Date(iso);
                    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                  };


                  // ─── DB-backed billing handlers ──────────────────────────
                  // All three handlers update local state optimistically (so the
                  // UI feels snappy), then persist to Supabase. On DB error we
                  // roll back to the previous state and warn — the user sees
                  // their change revert and can try again.

                  const addItem = async (month) => {
                    if (!billingNewItem.description.trim() || !billingNewItem.amount) return;
                    const prev = clientBilling[sc.id] || { items: [] };
                    const description = billingNewItem.description.trim();
                    const amount = parseFloat(billingNewItem.amount) || 0;
                    const recurring = !!billingNewItem.recurring;

                    // Build the rows we'll insert. Recurring items mirror into the
                    // other active month (unless a same-description row already
                    // exists there — avoids dupes if the user manually added it).
                    const rowsToInsert = [{ description, amount, recurring, month }];
                    if (recurring) {
                      const otherMonth = month === currentMonth ? nextMonth : currentMonth;
                      const alreadyExists = prev.items.some(i => i.description === description && i.month === otherMonth);
                      if (!alreadyExists) {
                        rowsToInsert.push({ description, amount, recurring: true, month: otherMonth });
                      }
                    }

                    // Optimistic update — temporary local IDs (negative numbers)
                    // are replaced with real DB IDs once the insert returns.
                    const tempBase = -Date.now();
                    const optimisticRows = rowsToInsert.map((r, idx) => ({ ...r, id: tempBase - idx }));
                    const newItems = [...prev.items, ...optimisticRows];
                    setClientBilling({ ...clientBilling, [sc.id]: { ...prev, items: newItems } });
                    setBillingNewItem({ description: "", amount: "", recurring: false });
                    setBillingAddOpen(false);

                    // Persist
                    try {
                      const { data: created, error } = await clientBillingDb.createBatch(user.id, sc.id, rowsToInsert);
                      if (error) throw error;
                      // Swap optimistic IDs for real IDs from the DB
                      const tempIds = new Set(optimisticRows.map(r => r.id));
                      const finalRows = (created || []).map(r => ({
                        id: r.id,
                        description: r.description,
                        amount: Number(r.amount),
                        recurring: r.recurring,
                        month: r.month,
                      }));
                      setClientBilling(curr => {
                        const c = curr[sc.id] || { items: [] };
                        const kept = c.items.filter(i => !tempIds.has(i.id));
                        return { ...curr, [sc.id]: { ...c, items: [...kept, ...finalRows] } };
                      });
                    } catch (e) {
                      console.warn("Billing item create failed:", e);
                      // Roll back to the pre-optimistic state
                      setClientBilling({ ...clientBilling, [sc.id]: prev });
                    }
                  };

                  const removeItem = async (itemId) => {
                    const prev = clientBilling[sc.id] || { items: [] };
                    // Optimistic remove
                    setClientBilling({
                      ...clientBilling,
                      [sc.id]: { ...prev, items: prev.items.filter(i => i.id !== itemId) },
                    });
                    // Persist (skip if it's still an optimistic temp ID — those
                    // never made it to the DB, so nothing to delete).
                    if (typeof itemId === "string" || itemId >= 0) {
                      try {
                        const { error } = await clientBillingDb.remove(itemId);
                        if (error) throw error;
                      } catch (e) {
                        console.warn("Billing item remove failed:", e);
                        setClientBilling({ ...clientBilling, [sc.id]: prev });
                      }
                    }
                  };

                  const toggleRecurring = async (itemId) => {
                    const prev = clientBilling[sc.id] || { items: [] };
                    const item = prev.items.find(i => i.id === itemId);
                    if (!item) return;
                    const turningOn = !item.recurring;

                    // Build the new local state first (same logic as before).
                    let newItems = prev.items.map(i => i.id === itemId ? { ...i, recurring: !i.recurring } : i);
                    let mirrorRow = null; // populated if we add a mirror line
                    if (turningOn) {
                      const otherMonth = item.month === currentMonth ? nextMonth : currentMonth;
                      const alreadyExists = prev.items.some(i => i.description === item.description && i.month === otherMonth);
                      if (!alreadyExists) {
                        const tempId = -Date.now();
                        mirrorRow = {
                          id: tempId,
                          description: item.description,
                          amount: item.amount,
                          recurring: true,
                          month: otherMonth,
                        };
                        newItems = [...newItems, mirrorRow];
                      }
                    }

                    // Optimistic update
                    setClientBilling({ ...clientBilling, [sc.id]: { ...prev, items: newItems } });

                    // Persist: update the toggled row, and insert the mirror if needed.
                    try {
                      const { error: updateErr } = await clientBillingDb.update(itemId, { recurring: !item.recurring });
                      if (updateErr) throw updateErr;
                      if (mirrorRow) {
                        const { data: created, error: insertErr } = await clientBillingDb.create(user.id, sc.id, {
                          description: mirrorRow.description,
                          amount: mirrorRow.amount,
                          recurring: true,
                          month: mirrorRow.month,
                        });
                        if (insertErr) throw insertErr;
                        if (created) {
                          // Swap the temp ID for the real one
                          setClientBilling(curr => {
                            const c = curr[sc.id] || { items: [] };
                            const swapped = c.items.map(i => i.id === mirrorRow.id ? {
                              id: created.id,
                              description: created.description,
                              amount: Number(created.amount),
                              recurring: created.recurring,
                              month: created.month,
                            } : i);
                            return { ...curr, [sc.id]: { ...c, items: swapped } };
                          });
                        }
                      }
                    } catch (e) {
                      console.warn("Billing item toggle failed:", e);
                      setClientBilling({ ...clientBilling, [sc.id]: prev });
                    }
                  };

                  // Pill toggle component for month-level invoiced/paid status.
                  // Lives inline with the month total. Three states:
                  //   off     — gray text, gray border, transparent fill
                  //   on (invoiced)  — gold text/border, soft gold fill
                  //   on (paid)      — green text/border, soft green fill
                  const StatusPill = ({ kind, on, onClick, disabled = false }) => {
                    const onColor = kind === "invoiced" ? C.warning : C.success;
                    const onBg = kind === "invoiced" ? "#FAF0DF" : "#E8F3EC";
                    return (
                      <button
                        type="button"
                        onClick={disabled ? undefined : onClick}
                        style={{
                          padding: "3px 10px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 600,
                          border: "1px solid " + (on ? onColor : C.border),
                          background: on ? onBg : "transparent",
                          color: on ? onColor : C.textMuted,
                          cursor: disabled ? "default" : "pointer",
                          fontFamily: "inherit",
                          opacity: disabled ? 0.85 : 1,
                          transition: "background 120ms, color 120ms, border-color 120ms",
                        }}
                      >
                        {kind === "invoiced" ? "Invoiced" : "Paid"}
                      </button>
                    );
                  };

                  // renderMonth — handles current, next, and previous (read-only).
                  // readOnly controls: hides × on rows, hides "+ Add line item",
                  // hides recurring toggle button. Month-level invoiced/paid pills
                  // remain togglable even on read-only months (you might mark a past
                  // month paid after the fact).
                  const renderMonth = (month, opts = {}) => {
                    const { isNext = false, readOnly = false } = opts;
                    const items = getMonthItems(month);
                    const total = getMonthTotal(month);
                    const isAdding = billingAddOpen === month;
                    const status = getStatus(month);

                    return (
                      <div key={month} style={{ marginBottom: 20, opacity: readOnly ? 0.85 : 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 12 }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 700 }}>{month}</div>
                            {isNext && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Forward billing</div>}
                            {readOnly && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Past · read-only</div>}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                            <StatusPill kind="invoiced" on={status.invoiced} onClick={() => toggleInvoiced(month)} />
                            <StatusPill kind="paid" on={status.paid} onClick={() => togglePaid(month)} />
                            {items.length > 0 && (
                              <span style={{ fontSize: 14, fontWeight: 700, color: C.primary, marginLeft: 4 }}>${total.toLocaleString()}</span>
                            )}
                          </div>
                        </div>

                        {items.map(item => (
                          <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderBottom: "1px solid " + C.borderLight }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontSize: 14, fontWeight: 600 }}>{item.description}</span>
                                {item.recurring && <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 3, background: C.primarySoft, color: C.primary, fontWeight: 600 }}>↻ Recurring</span>}
                              </div>
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 700, marginRight: 4 }}>${item.amount.toLocaleString()}</span>
                            {!readOnly && (
                              <>
                                <button onClick={() => toggleRecurring(item.id)} style={{ background: "none", border: "none", fontSize: 12, color: item.recurring ? C.primary : C.borderLight, cursor: "pointer", padding: "2px" }}>↻</button>
                                <button onClick={() => removeItem(item.id)} style={{ background: "none", border: "none", fontSize: 14, color: C.borderLight, cursor: "pointer", padding: "0 2px" }}>×</button>
                              </>
                            )}
                          </div>
                        ))}

                        {items.length === 0 && !isAdding && (
                          <div style={{ padding: "12px 0", fontSize: 14, color: C.textMuted }}>
                            {readOnly ? "No items logged for this month." : "No items yet."}
                          </div>
                        )}

                        {!readOnly && (isAdding ? (
                          <div style={{ padding: "12px 0", display: "flex", flexDirection: "column", gap: 8 }}>
                            <input value={billingNewItem.description} onChange={e => setBillingNewItem({ ...billingNewItem, description: e.target.value })} placeholder="Description (e.g. Retainer, Creative refresh)" style={{ padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.surfaceWarm, background: C.bg }} />
                            <input type="number" value={billingNewItem.amount} onChange={e => setBillingNewItem({ ...billingNewItem, amount: e.target.value })} placeholder="Amount ($)" style={{ padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.surfaceWarm, background: C.bg }} />
                            <div onClick={() => setBillingNewItem({ ...billingNewItem, recurring: !billingNewItem.recurring })} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", cursor: "pointer" }}>
                              <div style={{ width: 18, height: 18, borderRadius: 4, border: billingNewItem.recurring ? "none" : "1.5px solid " + C.border, background: billingNewItem.recurring ? C.primary : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {billingNewItem.recurring && <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>✓</span>}
                              </div>
                              <span style={{ fontSize: 14, color: C.textSec }}>Make recurring (auto-adds each month)</span>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button className="r-btn" data-tone="purple" onClick={() => addItem(month)} style={{ flex: 1, padding: "10px", background: billingNewItem.description.trim() && billingNewItem.amount ? C.btn : C.surface, color: billingNewItem.description.trim() && billingNewItem.amount ? "#fff" : C.textMuted, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Add</button>
                              <button onClick={() => { setBillingAddOpen(false); setBillingNewItem({ description: "", amount: "", recurring: false }); }} style={{ padding: "10px 14px", background: C.surface, color: C.textMuted, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setBillingAddOpen(month)} style={{ width: "100%", padding: "10px", background: "transparent", color: C.primary, border: "1px dashed " + C.border, borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 6 }}>+ Add line item</button>
                        ))}
                      </div>
                    );
                  };

                  return (
                    <div>
                      {/* ─── Billing terms section ─── */}
                      {/* Standard card pattern: white bg, hairline border,
                          10px radius. Matches every other card in the app
                          (Settings rows, client list cards, etc). No tinted
                          surface, no gold left rule — the cream-on-cream
                          collision with the tab bar above made the previous
                          paper-note treatment feel buried. */}
                      <div style={{
                        background: C.card,
                        borderRadius: 10,
                        padding: "14px 16px",
                        marginBottom: 18,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                            Billing terms
                          </span>
                          <span style={{ fontSize: 11, color: C.textMuted }}>
                            {currentTerm ? formatTermDate(currentTerm.created_at) : "No entries yet"}
                            {termsForClient.length > 0 && ` · ${termsForClient.length === 1 ? "1 entry" : `${termsForClient.length} entries`}`}
                          </span>
                        </div>

                        {/* Body — current entry, edit, add, or empty */}
                        {currentTerm && termsEditingId !== currentTerm.id && !termsAddingNew[sc.id] && (
                          <div>
                            <div style={{ fontSize: 13, lineHeight: 1.55, color: C.text, whiteSpace: "pre-wrap" }}>{currentTerm.body}</div>
                            <div style={{ display: "flex", gap: 14, marginTop: 8, paddingTop: 8, borderTop: "0.5px dashed " + C.borderLight, fontSize: 11, color: C.textMuted }}>
                              <button onClick={() => { setTermsEditingId(currentTerm.id); setTermsEditDraft(currentTerm.body); }} style={{ background: "none", border: "none", padding: 0, fontSize: 11, color: C.textMuted, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Edit</button>
                              <button onClick={() => removeTerm(currentTerm.id)} style={{ background: "none", border: "none", padding: 0, fontSize: 11, color: C.textMuted, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
                              {historyTerms.length > 0 && (
                                <button onClick={() => setTermsHistoryOpen(prev => ({ ...prev, [sc.id]: !prev[sc.id] }))} style={{ background: "none", border: "none", padding: 0, fontSize: 11, color: C.textMuted, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                                  {termsHistoryOpen[sc.id] ? "Hide" : "View"} history ({historyTerms.length})
                                </button>
                              )}
                              <span style={{ flex: 1 }} />
                              <button onClick={() => { setTermsAddingNew(prev => ({ ...prev, [sc.id]: true })); setTermsEditDraft(""); }} style={{ background: "none", border: "none", padding: 0, fontSize: 11, color: C.textMuted, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>+ New entry</button>
                            </div>
                          </div>
                        )}

                        {/* Editing the current entry */}
                        {currentTerm && termsEditingId === currentTerm.id && (
                          <div>
                            <textarea autoFocus value={termsEditDraft} onChange={e => setTermsEditDraft(e.target.value)} placeholder="Describe the billing arrangement…" style={{ width: "100%", padding: "10px 12px", borderRadius: 4, fontSize: 13, fontFamily: "inherit", outline: "none", background: C.card, minHeight: 100, resize: "vertical", lineHeight: 1.55, color: C.text, boxSizing: "border-box" }} />
                            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                              <button onClick={() => saveTermEdit(currentTerm.id)} disabled={!termsEditDraft.trim()} style={{ padding: "6px 12px", background: termsEditDraft.trim() ? C.text : "transparent", color: termsEditDraft.trim() ? "#fff" : C.textMuted, border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: termsEditDraft.trim() ? "pointer" : "default", fontFamily: "inherit" }}>Save</button>
                              <button onClick={() => { setTermsEditingId(null); setTermsEditDraft(""); }} style={{ padding: "6px 12px", background: "transparent", color: C.textMuted, borderRadius: 4, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                            </div>
                          </div>
                        )}

                        {/* Adding a new entry */}
                        {termsAddingNew[sc.id] && (
                          <div>
                            {currentTerm && <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8, fontStyle: "italic" }}>Adding a new entry will become the current terms. Previous entry stays in history.</div>}
                            <textarea autoFocus value={termsEditDraft} onChange={e => setTermsEditDraft(e.target.value)} placeholder="Describe the billing arrangement…" style={{ width: "100%", padding: "10px 12px", borderRadius: 4, fontSize: 13, fontFamily: "inherit", outline: "none", background: C.card, minHeight: 100, resize: "vertical", lineHeight: 1.55, color: C.text, boxSizing: "border-box" }} />
                            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                              <button onClick={addTerm} disabled={!termsEditDraft.trim()} style={{ padding: "6px 12px", background: termsEditDraft.trim() ? C.text : "transparent", color: termsEditDraft.trim() ? "#fff" : C.textMuted, border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: termsEditDraft.trim() ? "pointer" : "default", fontFamily: "inherit" }}>Add entry</button>
                              <button onClick={() => { setTermsAddingNew(prev => ({ ...prev, [sc.id]: false })); setTermsEditDraft(""); }} style={{ padding: "6px 12px", background: "transparent", color: C.textMuted, borderRadius: 4, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                            </div>
                          </div>
                        )}

                        {/* Empty state — no entries, not adding */}
                        {!currentTerm && !termsAddingNew[sc.id] && (
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 4 }}>
                            <span style={{ fontSize: 12, color: C.textMuted, fontStyle: "italic" }}>No billing terms recorded.</span>
                            <button onClick={() => { setTermsAddingNew(prev => ({ ...prev, [sc.id]: true })); setTermsEditDraft(""); }} style={{ background: "none", border: "none", padding: 0, fontSize: 11, color: C.textMuted, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>+ Add entry</button>
                          </div>
                        )}

                        {/* History (older entries) — expanded */}
                        {termsHistoryOpen[sc.id] && historyTerms.length > 0 && (
                          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "0.5px solid " + C.borderLight }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>History</div>
                            {historyTerms.map(t => (
                              <div key={t.id} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: "0.5px dashed " + C.borderLight }}>
                                {termsEditingId === t.id ? (
                                  <div>
                                    <textarea autoFocus value={termsEditDraft} onChange={e => setTermsEditDraft(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 4, fontSize: 13, fontFamily: "inherit", outline: "none", background: C.card, minHeight: 80, resize: "vertical", lineHeight: 1.55, color: C.text, boxSizing: "border-box" }} />
                                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                      <button onClick={() => saveTermEdit(t.id)} disabled={!termsEditDraft.trim()} style={{ padding: "6px 12px", background: termsEditDraft.trim() ? C.text : "transparent", color: termsEditDraft.trim() ? "#fff" : C.textMuted, border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: termsEditDraft.trim() ? "pointer" : "default", fontFamily: "inherit" }}>Save</button>
                                      <button onClick={() => { setTermsEditingId(null); setTermsEditDraft(""); }} style={{ padding: "6px 10px", background: "transparent", color: C.textMuted, borderRadius: 4, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, marginBottom: 4 }}>{formatTermDate(t.created_at)}</div>
                                    <div style={{ fontSize: 13, lineHeight: 1.55, color: C.textSec, whiteSpace: "pre-wrap" }}>{t.body}</div>
                                    <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                                      <button onClick={() => { setTermsEditingId(t.id); setTermsEditDraft(t.body); }} style={{ background: "none", border: "none", padding: 0, fontSize: 11, color: C.textMuted, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Edit</button>
                                      <button onClick={() => removeTerm(t.id)} style={{ background: "none", border: "none", padding: 0, fontSize: 11, color: C.textMuted, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Delete</button>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Months — next, current, previous (all read-write for status, prev read-only for items) */}
                      {renderMonth(nextMonth, { isNext: true })}
                      <div style={{ height: 1, background: C.border, margin: "4px 0 20px" }} />
                      {renderMonth(currentMonth)}
                      <div style={{ height: 1, background: C.border, margin: "4px 0 20px" }} />
                      {renderMonth(prevMonth, { readOnly: true })}

                      {pastMonths.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8, paddingTop: 12, borderTop: "1px solid " + C.borderLight }}>Earlier months</div>
                          {pastMonths.map((month, mi) => {
                            const items = getMonthItems(month);
                            const total = getMonthTotal(month);
                            const status = getStatus(month);
                            return (
                              <div key={mi} style={{ background: C.bg, borderRadius: 8, padding: "10px 12px", marginBottom: 6 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: items.length > 0 ? 4 : 0 }}>
                                  <span style={{ fontSize: 14, fontWeight: 600 }}>{month}</span>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    {status.invoiced && <span style={{ fontSize: 10, fontWeight: 700, color: C.warning, padding: "2px 7px", borderRadius: 999, background: "#FAF0DF" }}>Invoiced</span>}
                                    {status.paid && <span style={{ fontSize: 10, fontWeight: 700, color: C.success, padding: "2px 7px", borderRadius: 999, background: "#E8F3EC" }}>Paid</span>}
                                    <span style={{ fontSize: 14, fontWeight: 700, color: C.primary, marginLeft: 4 }}>${total.toLocaleString()}</span>
                                  </div>
                                </div>
                                {items.length > 0 && (
                                  <div style={{ fontSize: 12, color: C.textMuted }}>
                                    {items.map(i => i.description).join(", ")}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Flags — pill toggles with descriptions. Score impact hidden — scoring is magic. */}
                {clientTab === "flags" && (
                  <div>
                    <div style={{ fontSize: 12.5, color: C.textSec, lineHeight: 1.5, marginBottom: 14 }}>
                      These characteristics shape your health score behind the scenes. Keep them current as your client relationship changes.
                    </div>
                    {[
                      { flag: "latePayments",   label: "Late payments",       desc: "Has missed or delayed invoices", delta: -4 },
                      { flag: "prevTerminated", label: "Previously terminated", desc: "Has churned and returned",      delta: -8 },
                      { flag: "otherVendors",   label: "Works with competitors", desc: "Uses other vendors in parallel", delta: -3 },
                      { flag: "fromReferral",   label: "From referral",       desc: "Introduced by an existing client", delta: 2  },
                    ].map(f => {
                      const on = !!sc.qualifyingFlags?.[f.flag];
                      return (
                        <div key={f.flag} onClick={async () => {
                          const newFlags = { ...(sc.qualifyingFlags || {}), [f.flag]: !on };
                          const newRet = Math.max(1, Math.min(99, (sc.ret || 50) + (on ? -f.delta : f.delta)));
                          setClients(prev => prev.map(c => c.id === sc.id ? { ...c, qualifyingFlags: newFlags, ret: newRet } : c));
                          setSelectedClient({ ...sc, qualifyingFlags: newFlags, ret: newRet });
                          clientsDb.update(sc.id, { qualifying_flags: newFlags, retention_score: newRet });
                        }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 0", borderBottom: "1px solid " + C.borderLight, cursor: "pointer" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{f.label}</div>
                            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{f.desc}</div>
                          </div>
                          <div style={{ width: 40, height: 22, borderRadius: 11, background: on ? C.primary : C.border, padding: 2, transition: "background 0.2s", display: "flex", alignItems: "center", flexShrink: 0 }}>
                            <div style={{ width: 18, height: 18, borderRadius: 9, background: "#fff", transform: on ? "translateX(18px)" : "translateX(0)", transition: "transform 0.2s" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>

              {/* Sticky action footer — Discuss · Edit · Pause/Resume · Remove.
                  Sits at the bottom of the modal regardless of which tab is
                  open. The Discuss button uses the gradient + halo Rai-territory
                  treatment (same as armed Add Task, New Rai Chat). Edit/Pause/
                  Remove are chip-language buttons (card + sh-xs).
                  Auto-switches to Overview tab when a destructive action is
                  triggered so the existing inline confirm dialog is visible.
                  When a confirm is already active the footer hides — the
                  confirm UI in the Overview tab takes over. */}
              {!pauseConfirm && !resumeConfirm && !rolodexConfirm && !removeConfirm && (
                <div style={{
                  position: "sticky",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: "rgba(255,255,255,0.96)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  borderTop: "1px solid " + C.borderLight,
                  padding: "12px 16px",
                  zIndex: 5,
                  display: "flex",
                  gap: 6,
                  alignItems: "stretch",
                }}>
                  <button
                    onClick={() => {
                      // Open Rai chat preloaded with this client.
                      const opener = coachOpeners[sc.name] || `Let's talk about ${sc.name}. What's on your mind?`;
                      setAiConvoId(null);
                      setAiMessages([{ role: "ai", text: opener }]);
                      setSelectedClient(null);
                      setPage("coach");
                    }}
                    className="rt-cm-btn-primary"
                    style={{
                      flex: 1,
                      padding: "10px 16px",
                      border: "none",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>✦</span>
                    <span>Discuss</span>
                  </button>
                  <button
                    onClick={() => {
                      setClientTab("overview");
                      setEditingOverview(true);
                      setOverviewEditData({ contact: sc.contact, role: sc.role, tag: sc.tag, months: sc.months, revenue: sc.revenue, lifetime_revenue_at_entry: sc.lifetime_revenue_at_entry || 0, renewal_date: sc.renewal_date || "" });
                    }}
                    className="rt-cm-btn-secondary"
                    style={{ padding: "10px 14px", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                  >Edit</button>
                  <button
                    onClick={() => {
                      // Auto-switch to Overview so the confirm dialog is visible.
                      setClientTab("overview");
                      if (sc.is_paused) { setResumeConfirm(true); }
                      else { setPauseConfirm(true); }
                      setRolodexConfirm(false); setRemoveConfirm(false);
                    }}
                    className="rt-cm-btn-secondary"
                    style={{ padding: "10px 14px", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                  >{sc.is_paused ? "Resume" : "Pause"}</button>
                  <button
                    onClick={() => {
                      // Remove = Move to Rolodex (the soft-remove path).
                      // Auto-switch to Overview so the confirm dialog is visible.
                      setClientTab("overview");
                      setRolodexConfirm(true);
                      setPauseConfirm(false); setResumeConfirm(false); setRemoveConfirm(false);
                    }}
                    className="rt-cm-btn-danger"
                    style={{ padding: "10px 14px", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                  >Remove</button>
                </div>
              )}
            </div>
          </>
        );
      })()}


      {/* ROLODEX SLIDE-OVER */}
      {selectedRolodex && (() => {
        const sr = selectedRolodex;
        const answers = retroAnswers[sr.id] || {};
        const ed = rolodexEditData;
        const priorityOpts = [
          { id: "high", label: "High priority", color: C.success },
          { id: "medium", label: "Medium priority", color: C.warning },
          { id: "low", label: "Low priority", color: C.textMuted },
        ];
        return (
          <>
            <div onClick={() => setSelectedRolodex(null)} style={{ position: "fixed", inset: 0, background: "rgba(20,30,22,0.32)", zIndex: 90 }} />
            <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "100%", maxWidth: 420, background: C.card, boxShadow: "-4px 0 24px rgba(0,0,0,0.08)", zIndex: 100, overflowY: "scroll" }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid " + C.borderLight, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: C.card, zIndex: 1 }}>
                <h2 style={{ fontSize: 20, fontWeight: 800 }}>{sr.client}</h2>
                <button onClick={() => setSelectedRolodex(null)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.textMuted }}>×</button>
              </div>
              <div style={{ textAlign: "center", padding: "16px 20px 0" }}>
                <div style={{ fontSize: 32, marginBottom: 4 }}>📇</div>
                <span style={{ fontSize: 14, padding: "4px 12px", borderRadius: 4, background: sr.type === "oneoff" ? C.surface : C.primarySoft, color: sr.type === "oneoff" ? C.textSec : C.primary, fontWeight: 600 }}>{sr.type === "oneoff" ? "One-off" : "Former Client"}</span>
              </div>
              <div style={{ padding: "16px 20px" }}>
                {!rolodexEditing ? (
                  <>
                    {[
                      { l: "Contact", v: sr.contact },
                      { l: "Together", v: sr.months > 0 ? sr.months + " months" : "One-time" },
                      { l: "Added", v: sr.date },
                      { l: "Priority", v: sr.priority ? (sr.priority === "high" ? "High" : sr.priority === "medium" ? "Medium" : "Low") : "Not set" },
                      { l: "Reminder", v: sr.reminder ? new Date(sr.reminder).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "None set" },
                    ].map((d, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid " + C.borderLight }}>
                        <span style={{ fontSize: 14, color: C.textMuted }}>{d.l}</span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: d.l === "Reminder" && sr.reminder ? C.primary : C.text }}>{d.v}</span>
                      </div>
                    ))}
                    {sr.notes && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>Notes</div>
                        <div style={{ fontSize: 14, color: C.text, lineHeight: 1.5, background: C.bg, borderRadius: 8, padding: "10px 12px" }}>{sr.notes}</div>
                      </div>
                    )}
                    {(answers.what || answers.work) && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>History</div>
                        {[
                          { l: "What happened", v: answers.what },
                          { l: "What you did", v: answers.work },
                          { l: "How it ended", v: answers.terms },
                          { l: "Would come back", v: answers.comeback },
                          { l: "Would refer", v: answers.refer },
                        ].filter(d => d.v).map((d, i) => (
                          <div key={i} style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 14, color: C.textMuted, marginBottom: 2 }}>{d.l}</div>
                            <div style={{ fontSize: 14, color: C.text, lineHeight: 1.4 }}>{d.v}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {sr.tags.length > 0 && (
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 14 }}>
                        {sr.tags.map((t, j) => <span key={j} style={{ fontSize: 12, padding: "3px 8px", borderRadius: 4, background: t.includes("Would refer") || t.includes("Good terms") || t.includes("Would come back") ? C.primarySoft : C.surface, color: t.includes("Would refer") || t.includes("Good terms") || t.includes("Would come back") ? C.primary : C.textSec, fontWeight: 600 }}>{t}</span>)}
                      </div>
                    )}
                    {!showReminderPicker ? (
                      <button onClick={() => { setShowReminderPicker(true); setReminderDate(sr.reminder || ""); }} className="r-btn" data-tone="purple" style={{ width: "100%", padding: sr.reminder ? "12px" : "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 16, textAlign: sr.reminder ? "left" : "center" }}>
                        {sr.reminder ? (
                          <div>
                            <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginBottom: 2 }}>⏰ Reminder set</div>
                            <div>{new Date(sr.reminder).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</div>
                          </div>
                        ) : "⏰ Set Check-in Reminder"}
                      </button>
                    ) : (
                      <div style={{ marginTop: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>When should Rai remind you?</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                          {[
                            { label: "2 weeks", days: 14 },
                            { label: "1 month", days: 30 },
                            { label: "3 months", days: 90 },
                            { label: "6 months", days: 180 },
                          ].map(q => {
                            const target = new Date(Date.now() + q.days * 24 * 60 * 60 * 1000);
                            const dow = target.getDay();
                            const diff = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
                            const monday = new Date(target.getTime() + diff * 24 * 60 * 60 * 1000);
                            const d = localYmd(monday);
                            const sel = reminderDate === d;
                            return (
                              <button key={q.label} onClick={() => setReminderDate(d)} style={{ flex: 1, padding: "10px 8px", borderRadius: 8, border: "1.5px solid " + (sel ? C.primary : C.border), background: sel ? C.primarySoft : C.bg, color: sel ? C.primary : C.text, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{q.label}</button>
                            );
                          })}
                        </div>
                        {reminderDate && <div style={{ fontSize: 14, color: C.primary, fontWeight: 600, marginBottom: 12 }}>Monday, {new Date(reminderDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>}
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="r-btn" data-tone="purple" onClick={async () => {
                            // Persist the reminder date to DB. Before this fix
                            // the reminder was only kept in local state and
                            // would disappear on refresh — silent data loss.
                            if (reminderDate) {
                              const prev = rolodex;
                              setRolodex(p => p.map(x => x.id === sr.id ? { ...x, reminder: reminderDate } : x));
                              setSelectedRolodex({ ...sr, reminder: reminderDate });
                              try {
                                const { error } = await rolodexDb.update(sr.id, { reminder_date: reminderDate });
                                if (error) throw error;
                              } catch (e) {
                                console.error("Reminder save failed:", e);
                                setRolodex(prev);
                                setSelectedRolodex(sr);
                                alert("Could not save reminder. Please try again.");
                                return;
                              }
                            }
                            setShowReminderPicker(false);
                          }} style={{ flex: 1, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
                          {sr.reminder && <button onClick={async () => {
                            // Persist the reminder removal to DB. Same data-
                            // loss pattern as the save path — was previously
                            // local-only.
                            const prev = rolodex;
                            setRolodex(p => p.map(x => x.id === sr.id ? { ...x, reminder: null } : x));
                            setSelectedRolodex({ ...sr, reminder: null });
                            setReminderDate("");
                            setShowReminderPicker(false);
                            try {
                              const { error } = await rolodexDb.update(sr.id, { reminder_date: null });
                              if (error) throw error;
                            } catch (e) {
                              console.error("Reminder remove failed:", e);
                              setRolodex(prev);
                              setSelectedRolodex(sr);
                              alert("Could not remove reminder. Please try again.");
                            }
                          }} style={{ padding: "10px 14px", background: "transparent", color: C.danger, border: "1px solid " + C.danger + "44", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Remove</button>}
                          <button onClick={() => setShowReminderPicker(false)} style={{ padding: "10px 14px", background: C.surface, color: C.text, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                        </div>
                      </div>
                    )}
                    <button onClick={() => { setRolodexEditing(true); setRolodexEditData({ contact: sr.contact, months: sr.months, priority: sr.priority || "", notes: sr.notes || "", what: answers.what || "", work: answers.work || "", terms: answers.terms || "", comeback: answers.comeback || "", refer: answers.refer || "" }); }} style={{ width: "100%", padding: "10px", background: "transparent", color: C.primary, border: "1px solid " + C.primary + "44", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 10 }}>Edit Details</button>
                    <div style={{ marginTop: 10 }}>
                      {!rolodexRemoveConfirm ? (
                        <button onClick={() => setRolodexRemoveConfirm(true)} style={{ width: "100%", padding: "10px", background: "transparent", color: C.danger, border: "1px solid " + C.danger + "44", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Remove from Rolodex</button>
                      ) : (
                        <div style={{ background: C.bg, borderRadius: 12, padding: "16px" }}>
                          <p style={{ fontSize: 14, color: C.text, lineHeight: 1.55, marginBottom: 14 }}>This will remove {sr.client} from your Rolodex. No more check-in reminders, no more tracking. You can always add them back later.</p>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => { setRolodex(prev => prev.filter(x => x.id !== sr.id)); rolodexDb.delete(sr.id); setSelectedRolodex(null); setRolodexRemoveConfirm(false); }} style={{ flex: 1, padding: "10px", background: C.surface, color: C.textSec, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Remove</button>
                            <button className="r-btn" data-tone="purple" onClick={() => setRolodexRemoveConfirm(false)} style={{ padding: "10px 14px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Edit Details</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Contact name</label>
                        <input value={ed.contact} onChange={e => setRolodexEditData({...ed, contact: e.target.value})} style={{ width: "100%", padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.surfaceWarm, background: C.bg }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Months together</label>
                        <input type="number" value={ed.months} onChange={e => setRolodexEditData({...ed, months: parseInt(e.target.value) || 0})} style={{ width: "100%", padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.surfaceWarm, background: C.bg }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Priority</label>
                        <div style={{ display: "flex", gap: 6 }}>
                          {priorityOpts.map(opt => (
                            <button key={opt.id} onClick={() => setRolodexEditData({...ed, priority: opt.id})} style={{ flex: 1, padding: "8px", borderRadius: 6, border: "1.5px solid " + (ed.priority === opt.id ? opt.color : C.borderLight), background: ed.priority === opt.id ? opt.color + "18" : C.bg, color: ed.priority === opt.id ? opt.color : C.textSec, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{opt.label.replace(" priority", "")}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Notes</label>
                        <textarea value={ed.notes} onChange={e => setRolodexEditData({...ed, notes: e.target.value})} placeholder="Log a check-in, add context, anything worth remembering..." style={{ width: "100%", padding: "10px 12px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.surfaceWarm, background: C.bg, minHeight: 80, resize: "vertical" }} />
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginTop: 16, marginBottom: 12 }}>History</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {sr.type === "former" ? (
                        <>
                          <div><label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>What happened?</label><textarea value={ed.what} onChange={e => setRolodexEditData({...ed, what: e.target.value})} placeholder="Contract ended, budget cut, went in-house..." style={{ width: "100%", padding: "10px 12px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.surfaceWarm, background: C.bg, minHeight: 60, resize: "vertical" }} /></div>
                          <div><label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>How did it end?</label><textarea value={ed.terms} onChange={e => setRolodexEditData({...ed, terms: e.target.value})} placeholder="Good terms, neutral, rough..." style={{ width: "100%", padding: "10px 12px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.surfaceWarm, background: C.bg, minHeight: 60, resize: "vertical" }} /></div>
                          <div><label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Would they come back?</label><textarea value={ed.comeback} onChange={e => setRolodexEditData({...ed, comeback: e.target.value})} placeholder="Yes, maybe, no..." style={{ width: "100%", padding: "10px 12px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.surfaceWarm, background: C.bg, minHeight: 60, resize: "vertical" }} /></div>
                        </>
                      ) : (
                        <div><label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>What did you do for them?</label><textarea value={ed.work} onChange={e => setRolodexEditData({...ed, work: e.target.value})} placeholder="Site audit, consulting session..." style={{ width: "100%", padding: "10px 12px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.surfaceWarm, background: C.bg, minHeight: 60, resize: "vertical" }} /></div>
                      )}
                      <div><label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Would they refer you?</label><textarea value={ed.refer} onChange={e => setRolodexEditData({...ed, refer: e.target.value})} placeholder="Even if they left, would they recommend you?" style={{ width: "100%", padding: "10px 12px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.surfaceWarm, background: C.bg, minHeight: 60, resize: "vertical" }} /></div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                      <button onClick={() => setRolodexEditing(false)} style={{ padding: "10px 16px", background: C.surface, color: C.textSec, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                      <button onClick={async () => {
                        const tags = [];
                        if ((ed.terms || "").toLowerCase().includes("good")) tags.push("Good terms");
                        if ((ed.refer || "").toLowerCase().includes("yes")) tags.push("Would refer");
                        if ((ed.comeback || "").toLowerCase().includes("yes")) tags.push("Would come back");
                        if (sr.type === "oneoff") tags.push("One-off");
                        const newRetroAnswers = { ...(retroAnswers[sr.id] || {}), what: ed.what, work: ed.work, terms: ed.terms, comeback: ed.comeback, refer: ed.refer };
                        const updated = { ...sr, contact: ed.contact, months: ed.months, priority: ed.priority, notes: ed.notes, tags };
                        // Persist to DB. Before this fix, edits were local-only —
                        // refreshing the page lost every change. The DB column
                        // map: contact→contact_name, months→months, priority→
                        // priority, notes→notes, tags→tags, plus retro_answers.
                        const prevRolodex = rolodex;
                        const prevAnswers = retroAnswers;
                        setRolodex(prev => prev.map(x => x.id === sr.id ? updated : x));
                        setRetroAnswers(prev => ({ ...prev, [sr.id]: newRetroAnswers }));
                        setSelectedRolodex(updated);
                        setRolodexEditing(false);
                        try {
                          const { error } = await rolodexDb.update(sr.id, {
                            contact_name: ed.contact,
                            months: parseInt(ed.months) || 0,
                            priority: ed.priority || null,
                            notes: ed.notes || "",
                            tags,
                            retro_answers: newRetroAnswers,
                          });
                          if (error) throw error;
                        } catch (e) {
                          console.error("Rolodex edit save failed:", e);
                          setRolodex(prevRolodex);
                          setRetroAnswers(prevAnswers);
                          setSelectedRolodex(sr);
                          alert("Could not save changes. Please try again — your edits were not persisted.");
                        }
                      }} style={{ flex: 1, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        );
      })()}


      {/* REFERRAL SLIDE-OVER */}
      {refEditing !== null && (() => {
        const r = refs.find((x, i) => (x.id || i) === refEditing);
        if (!r) return null;
        const isActive = r.status === "converted" || (r.converted && r.status !== "closed");
        return (
          <>
            <div onClick={() => setRefEditing(null)} style={{ position: "fixed", inset: 0, background: "rgba(20,30,22,0.32)", zIndex: 90 }} />
            <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "100%", maxWidth: 420, background: C.card, boxShadow: "-4px 0 24px rgba(0,0,0,0.08)", zIndex: 100, overflowY: "scroll" }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid " + C.borderLight, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: C.card, zIndex: 1 }}>
                <h2 style={{ fontSize: 20, fontWeight: 800 }}>{refEditData.to || r.to}</h2>
                <button onClick={() => setRefEditing(null)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.textMuted }}>×</button>
              </div>

              <div style={{ padding: "20px" }}>
                {/* Status badge */}
                <div style={{ marginBottom: 20 }}>
                  <span style={{ fontSize: 14, padding: "6px 16px", borderRadius: 6, fontWeight: 600, background: isActive ? "#E2F3EB" : "#FAE8E4", color: isActive ? C.success : C.danger }}>{isActive ? "Active" : "Closed"}</span>
                </div>

                {/* Details */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Referred person or company</label>
                    <input value={refEditData.to || ""} onChange={e => setRefEditData({...refEditData, to: e.target.value})} style={{ width: "100%", padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.surfaceWarm, background: C.bg }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Referred by</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {[...clients].sort((a, b) => b.ret - a.ret).map(c => (
                        <span key={c.id} onClick={() => setRefEditData({...refEditData, from: c.name})} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, background: refEditData.from === c.name ? C.primarySoft : C.bg, border: "1.5px solid " + (refEditData.from === c.name ? C.primary : C.borderLight), cursor: "pointer", fontWeight: refEditData.from === c.name ? 600 : 500, color: refEditData.from === c.name ? C.primary : C.textSec }}>{c.name}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Status</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      {[{ id: "converted", label: "Active" }, { id: "closed", label: "Closed" }].map(s => {
                        const sel = (refEditData.status || (refEditData.converted ? "converted" : "lost")) === s.id;
                        const isRed = s.id === "closed";
                        return (
                          <button key={s.id} onClick={() => setRefEditData({...refEditData, status: s.id, converted: s.id === "converted" || s.id === "closed"})} style={{ padding: "8px 18px", borderRadius: 8, border: "1.5px solid " + (sel ? (isRed ? C.danger : C.primary) : C.borderLight), background: sel ? (isRed ? "#FAE8E4" : C.primarySoft) : C.bg, color: sel ? (isRed ? C.danger : C.primary) : C.textMuted, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{s.label}</button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Average monthly revenue ($)</label>
                    <input type="number" value={refEditData.revenue || ""} onChange={e => setRefEditData({...refEditData, revenue: e.target.value})} placeholder="0" style={{ width: "100%", padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.surfaceWarm, background: C.bg }} />
                  </div>
                  {(refEditData.status === "closed") && (
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Total revenue earned ($)</label>
                      <input type="number" value={refEditData.totalRevenue || ""} onChange={e => setRefEditData({...refEditData, totalRevenue: e.target.value})} placeholder="0" style={{ width: "100%", padding: "12px 16px", border: "none", boxShadow: "inset 0 1px 2px rgba(20,30,22,0.08)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.surfaceWarm, background: C.bg }} />
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                  <button onClick={() => setRefEditing(null)} style={{ padding: "10px 16px", background: C.surface, color: C.textSec, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                  <button className="r-btn" data-tone="purple" onClick={() => {
                    setRefs(prev => prev.map((x, idx) => (x.id || idx) === refEditing ? { ...x, to: refEditData.to, from: refEditData.from, status: refEditData.status, converted: refEditData.status === "converted" || refEditData.status === "closed", revenue: parseInt(refEditData.revenue) || 0, totalRevenue: parseInt(refEditData.totalRevenue) || 0 } : x));
                    // Persist
                    referralsDb.update(refEditing, {
                      referred_to: refEditData.to,
                      referred_by: refEditData.from,
                      status: refEditData.status,
                      revenue: parseInt(refEditData.revenue) || 0,
                      total_revenue: parseInt(refEditData.totalRevenue) || 0,
                    });
                    setRefEditing(null);
                  }} style={{ flex: 1, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
                </div>

                <button onClick={() => { setRefs(prev => prev.filter((x, idx) => (x.id || idx) !== refEditing)); referralsDb.delete(refEditing); setRefEditing(null); }} style={{ width: "100%", padding: "10px", background: "transparent", color: C.danger, border: "1px solid " + C.danger + "44", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 12 }}>Delete Referral</button>
              </div>
            </div>
          </>
        );
      })()}


      {/* MOBILE BOTTOM NAV — horizontally-scrollable strip.
          Replaces the old "More" popup pattern. All pages live inline; the
          user swipes left/right within the strip to access ones that scroll
          off-screen. Active item auto-scrolls into view via the ref hook
          below. The right-edge fade is a visual hint that there's more
          content scrollable beyond. Hidden when keyboard is up so inputs
          aren't covered. */}
      <div
        ref={mobileNavRef}
        className="r-mob-bot rt-mob-nav-scroll"
        style={{
          position: "fixed",
          top: "calc(var(--vv-offset-top, 0px) + var(--app-h, 100vh) - 82px)",
          left: 12,
          right: 12,
          background: C.sidebar,
          borderRadius: 18,
          boxShadow: "var(--rt-sh-card)",
          padding: "10px 6px 12px",
          zIndex: 40,
          display: keyboardOpen ? "none" : "flex",
          alignItems: "center",
          gap: 4,
          overflowX: "auto",
          overflowY: "hidden",
          scrollSnapType: "x proximity",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
        }}
      >
        {(tier === "enterprise" ? mobileNavEnterprise : mobileNavCore).map(n => {
          const dot = hasDot(n.id);
          const active = page === n.id;
          return (
            <div
              key={n.id}
              data-nav-id={n.id}
              onClick={() => goTo(n.id)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                cursor: "pointer",
                padding: "5px 12px",
                borderRadius: 10,
                background: active ? C.card : "transparent",
                boxShadow: active ? "var(--rt-sh-card-lift)" : "none",
                transform: active ? "translateY(-0.5px)" : "none",
                position: "relative",
                flexShrink: 0,
                scrollSnapAlign: "center",
                minWidth: 60,
                transition: "all 180ms var(--rt-ease-out)",
              }}
            >
              <Icon name={n.icon} size={24} color={active ? C.primaryDeep : C.textSec} accent={active ? C.primary : C.ink500} />
              <span style={{ fontSize: 9.5, fontWeight: active ? 700 : 600, color: active ? C.primaryDeep : C.textSec }}>{n.label}</span>
              {dot && <div style={{ position: "absolute", top: 2, right: 6, width: 7, height: 7, borderRadius: "50%", background: C.danger, boxShadow: "0 0 0 2.5px " + (active ? C.card : C.sidebar) }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
