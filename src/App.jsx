import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "./lib/supabase";
import { clients as clientsDb, tasks as tasksDb, healthChecks as hcDb, rolodex as rolodexDb, referrals as referralsDb, raiConversations as convoDb, touchpoints as touchpointsDb, observations as observationsDb, daybook as daybookDb, profile as profileDb, workers as workersDb, workerTokens as workerTokensDb, raiUserState as raiUserStateDb, raiPicks as raiPicksDb, realtime as realtimeDb } from "./lib/db";
import WorkerDashboard from "./WorkerDashboard";

// ============================================================
// PALETTE
// ============================================================
// Surface tones (bg, card, text, borders) reference CSS variables so
// theme can swap at runtime by toggling `data-theme="dark"` on <html>.
// Accent colors (purple, green, gold, danger) stay as hex — they look
// good in both light and warm-dark, no variant needed (Direction A).
//
// The CSS variable definitions live in a <style> block injected at App
// mount-time so they're available before any component reads them.
const C = {
  primary: "#33543E", primaryDark: "#274230", primaryDeep: "#1C3224", primaryLight: "#558B68", primarySoft: "#E6EFE9", primaryGhost: "#F3F8F5",

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
  ink900: "var(--rt-ink-900)", ink700: "var(--rt-ink-700)", ink500: "var(--rt-ink-500)", ink400: "var(--rt-ink-400)", ink300: "var(--rt-ink-300)",

  // Borders — themed
  border: "var(--rt-border)",
  borderLight: "var(--rt-border-light)",
  borderSoft: "var(--rt-border-soft)",
  surfaceSelected: "var(--rt-surface-selected)",

  // Gradients use only fixed dark colors so they read well on either theme bg
  heroGrad: "linear-gradient(145deg, #1E261F 0%, #2A382C 40%, #33543E 100%)",
  raiGrad: "linear-gradient(145deg, #1E261F 0%, #33543E 55%, #558B68 100%)",

  // Accents — fixed (Direction A: warm dark; original colors hold up against warm-brown bg)
  danger: "#C4432B", warning: "#B88B15", success: "#2D8659",
  retCrit: "#B4341F", retWarn: "#D17A1B", retOk: "#A8A420", retGood: "#1F7A5C", retElite: "#0C3A2E",
  btn: "#5B21B6", btnHover: "#4C1D95", btnLight: "var(--rt-btn-light)",

  // Shadows — slightly stronger in dark mode for depth perception
  cardShadow: "var(--rt-shadow-card)",
  shadowSm: "var(--rt-shadow-sm)",
  shadowMd: "var(--rt-shadow-md)",
};

// CSS variable definitions for both themes. Injected in the App component's
// style block so they're authoritative at the document root.
const THEME_CSS = `
  :root, :root[data-theme="light"] {
    --rt-bg: #FAFAF7;
    --rt-card: #FFFFFF;
    --rt-surface: #EEEFEB;
    --rt-surface-warm: #F2EEE8;
    --rt-deep-cream: #EAE4D6;
    --rt-sidebar: #FAFAF7;
    --rt-text: #1E261F;
    --rt-text-sec: #6B6B66;
    --rt-text-muted: #9A9A93;
    --rt-ink-900: #0A0A0A;
    --rt-ink-700: #2A2A28;
    --rt-ink-500: #6B6B66;
    --rt-ink-400: #9A9A93;
    --rt-ink-300: #C4C4BD;
    --rt-border: #D8DFD8;
    --rt-border-light: #EFEFEA;
    --rt-border-soft: #EFEFEA;
    --rt-surface-selected: #F3F8F5;
    --rt-btn-light: #EDE4FA;
    --rt-shadow-card: 0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04);
    --rt-shadow-sm: 0 1px 2px rgba(10,10,10,0.04), 0 1px 3px rgba(10,10,10,0.03);
    --rt-shadow-md: 0 2px 4px rgba(10,10,10,0.04), 0 4px 12px rgba(10,10,10,0.05);
  }
  :root[data-theme="dark"] {
    /* Editorial Black — cream and gold on near-black. The journal at midnight. */
    --rt-bg: #0D0D0B;
    --rt-card: #18170E;
    --rt-surface: #1F1E15;
    --rt-surface-warm: #1F1E15;
    --rt-deep-cream: #2A2820;
    --rt-sidebar: #0D0D0B;
    --rt-text: #EDE6D6;
    --rt-text-sec: #B5A788;
    --rt-text-muted: #807766;
    --rt-ink-900: #EDE6D6;
    --rt-ink-700: #B5A788;
    --rt-ink-500: #807766;
    --rt-ink-400: #6B6452;
    --rt-ink-300: #4A4338;
    --rt-border: rgba(237, 230, 214, 0.10);
    --rt-border-light: rgba(237, 230, 214, 0.06);
    --rt-border-soft: rgba(237, 230, 214, 0.06);
    --rt-surface-selected: #2C2820;
    --rt-btn-light: rgba(91,33,182,0.22);
    --rt-shadow-card: 0 1px 3px rgba(0,0,0,0.50), 0 4px 16px rgba(0,0,0,0.40);
    --rt-shadow-sm: 0 1px 2px rgba(0,0,0,0.40), 0 1px 3px rgba(0,0,0,0.30);
    --rt-shadow-md: 0 2px 4px rgba(0,0,0,0.50), 0 4px 12px rgba(0,0,0,0.45);
  }
  html, body { background: var(--rt-bg); }
`;

const Icon = ({ name, size = 18, color = "currentColor" }) => {
  const paths = {
    today: (<><circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" fill="none"/><circle cx="12" cy="12" r="3.5" fill={color}/></>),
    clients: (<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke={color} strokeWidth="1.8" fill="none"/><path d="M23 21v-2a4 4 0 00-3-3.87" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round"/><path d="M16 3.13a4 4 0 010 7.75" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round"/></>),
    user: (<><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round"/><circle cx="12" cy="7" r="4" stroke={color} strokeWidth="1.8" fill="none"/></>),
    health: (<><path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>),
    rai: (<><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>),
    rolodex: (<><rect x="2" y="5" width="20" height="14" rx="2" stroke={color} strokeWidth="1.8" fill="none"/><path d="M2 10h20" stroke={color} strokeWidth="1.8"/><circle cx="12" cy="14.5" r="1.5" fill={color}/></>),
    referrals: (<><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke={color} strokeWidth="1.8" fill="none"/><path d="M19 8v6M22 11h-6" stroke={color} strokeWidth="2" strokeLinecap="round"/></>),
    settings: (<><circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.8" fill="none"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke={color} strokeWidth="1.8" fill="none"/></>),
    sun: (<><circle cx="12" cy="12" r="4.5" stroke={color} strokeWidth="1.8" fill="none"/><path d="M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4L7 17M17 7l1.4-1.4" stroke={color} strokeWidth="1.8" strokeLinecap="round"/></>),
    moon: (<><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>),
    sweeps: (<><path d="M18 20V10M12 20V4M6 20v-6" stroke={color} strokeWidth="2" strokeLinecap="round"/></>),
    target: (<><circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.8" fill="none"/><circle cx="12" cy="12" r="6" stroke={color} strokeWidth="1.8" fill="none"/><circle cx="12" cy="12" r="2" fill={color}/></>),
    spark: (<><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z" stroke={color} strokeWidth="1.6" fill="none" strokeLinejoin="round"/></>),
    send: (<><line x1="22" y1="2" x2="11" y2="13" stroke={color} strokeWidth="2" strokeLinecap="round"/><polygon points="22 2 15 22 11 13 2 9 22 2" stroke={color} strokeWidth="1.8" fill="none" strokeLinejoin="round"/></>),
    more: (<><circle cx="12" cy="5" r="1.5" fill={color}/><circle cx="12" cy="12" r="1.5" fill={color}/><circle cx="12" cy="19" r="1.5" fill={color}/></>),
    chevron: (<><polyline points="9 18 15 12 9 6" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>),
    bento: (<><rect x="3" y="3" width="7" height="7" rx="1.5" fill={color}/><rect x="14" y="3" width="7" height="7" rx="1.5" fill={color}/><rect x="3" y="14" width="7" height="7" rx="1.5" fill={color}/><rect x="14" y="14" width="7" height="7" rx="1.5" fill={color}/></>),
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


  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">{paths[name]}</svg>);
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

const integrations = [
  { cat: "Communication", items: [
    { name: "Slack", icon: "💬", connected: true, meta: "3 workspaces" },
    { name: "Microsoft Teams", icon: "📱", connected: false },
    { name: "Gmail / Google", icon: "📧", connected: true, meta: "2 accounts" },
    { name: "Outlook / Microsoft", icon: "📨", connected: false },
  ]},
  { cat: "Meetings", items: [
    { name: "Zoom", icon: "🎥", connected: true, meta: "Connected" },
    { name: "Google Meet", icon: "📹", connected: false },
    { name: "Microsoft Teams", icon: "📞", connected: false },
  ]},
  { cat: "CRM", items: [
    { name: "HubSpot", icon: "🟠", connected: false },
    { name: "Salesforce", icon: "☁️", connected: false },
    { name: "Pipedrive", icon: "📊", connected: false },
  ]},
  { cat: "Billing", items: [
    { name: "Stripe", icon: "💳", connected: false },
    { name: "QuickBooks", icon: "📗", connected: false },
    { name: "FreshBooks", icon: "📘", connected: false },
  ]},
];

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

// Returns "today" anchored to 2am local — between midnight and 2am, "today" is
// still yesterday's calendar date. This matches the bucket logic in the today
// page so parseComposer's "tomorrow" lands in the same bucket the UI calls
// "tomorrow", not in "later" by being one day off.
function todayAnchored() {
  const d = new Date();
  if (d.getHours() < 2) d.setDate(d.getDate() - 1);
  // Reset time-of-day to start of day so addDays() math is clean
  d.setHours(12, 0, 0, 0);
  return d;
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
  switch (pattern.kind) {
    case "daily":
      return true;
    case "weekdays":
      return dow >= 1 && dow <= 5;
    case "weekly":
      return Array.isArray(pattern.days) && pattern.days.includes(dow);
    case "monthly_date":
      return dom === (pattern.day || 1);
    case "monthly_weekday": {
      // "Nth weekday of month" — week is 1..5, day is 0..6
      if (date.getDay() !== pattern.day) return false;
      const occurrence = Math.ceil(dom / 7);
      return occurrence === pattern.week;
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
      return days.sort().map(d => dayShort[d]).join("/");
    }
    case "monthly_date": return `${ordinal(pattern.day || 1)} of month`;
    case "monthly_weekday": return `${weekOrd[pattern.week]} ${dayShort[pattern.day]} of month`;
    default: return "Recurring";
  }
}

function parseComposer(rawText, clients, workers) {
  const text = rawText || "";
  const lower = text.toLowerCase();
  const matches = []; // {start, end, kind: 'client'|'worker'|'date'}

  // ─── client match ──────────────────────────────────────────────
  // Try full client name first (longest match wins). Then try first-token match
  // ("Matte Collection" → "matte"). Case-insensitive substring with word boundaries.
  let matchedClient = null;
  if (clients && clients.length > 0) {
    const sortedClients = [...clients].sort((a, b) => b.name.length - a.name.length);
    // Articles to skip when picking candidate tokens — "The Motley Fool"
    // should match on "Motley" or "Fool", not on "The".
    const STOP_WORDS = new Set(["the", "a", "an", "and", "of", "&"]);
    for (const c of sortedClients) {
      const candidates = [c.name];
      // Add each individual token (4+ chars, not a stop word) as a fallback.
      // E.g. "The Motley Fool" → adds "Motley", "Fool". "Lemon Law Assist" →
      // adds "Lemon", "Assist" (skips "Law" — too short).
      const tokens = c.name.split(/\s+/);
      for (const tok of tokens) {
        const clean = tok.replace(/[^\w]/g, "").toLowerCase();
        if (clean.length >= 4 && !STOP_WORDS.has(clean) && !candidates.includes(tok)) {
          candidates.push(tok);
        }
      }
      for (const cand of candidates) {
        const re = new RegExp(`\\b${escapeRegexChars(cand.toLowerCase())}(?:'s)?\\b`, "i");
        const m = lower.match(re);
        if (m && m.index !== undefined) {
          matchedClient = c;
          matches.push({ start: m.index, end: m.index + m[0].length, kind: "client" });
          break;
        }
      }
      if (matchedClient) break;
    }
  }

  // ─── worker match ──────────────────────────────────────────────
  // Workers are humans → match on first name.
  let matchedWorker = null;
  if (workers && workers.length > 0) {
    const clientSpans = matches.filter(m => m.kind === "client");
    for (const w of workers) {
      const firstName = (w.name || w.display_name || "").trim().split(/\s+/)[0];
      if (!firstName || firstName.length < 2) continue;
      const re = new RegExp(`\\b${escapeRegexChars(firstName.toLowerCase())}\\b`, "i");
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

  // ─── date match ────────────────────────────────────────────────
  let matchedDate = null;
  const datePatterns = [
    { re: /\btoday\b/i, value: () => addDays(todayAnchored(), 0), kind: "today" },
    { re: /\btomorrow\b/i, value: () => addDays(todayAnchored(), 1), kind: "tomorrow" },
    { re: /\blater\b/i, value: () => addDays(todayAnchored(), 6), kind: "later" },
    { re: /\bnext week\b/i, value: () => addDays(todayAnchored(), 7), kind: "later" },
    { re: /\bin (\d+) days?\b/i, value: (m) => addDays(todayAnchored(), parseInt(m[1], 10)), kind: "later" },
    { re: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, value: (m) => nextWeekdayDate(m[1]), kind: "weekday" },
  ];
  for (const p of datePatterns) {
    const m = lower.match(p.re);
    if (m && m.index !== undefined) {
      matchedDate = { date: p.value(m), kind: p.kind };
      matches.push({ start: m.index, end: m.index + m[0].length, kind: "date" });
      break;
    }
  }

  // ─── build cleaned title ────────────────────────────────────────
  let title = text;
  const sortedMatches = [...matches].sort((a, b) => b.start - a.start);
  for (const m of sortedMatches) {
    let endIdx = m.end;
    if (m.kind === "client" && lower.slice(endIdx, endIdx + 2) === "'s") {
      endIdx += 2;
    }
    title = title.slice(0, m.start) + title.slice(endIdx);
  }
  title = title.replace(/^\s*(have|for|with|by|tell)\s+/i, "");
  title = title.replace(/\s{2,}/g, " ").trim();
  title = title.replace(/\s+'s\b/g, "");
  title = title.replace(/^'s\s+/, "");
  // Strip trailing prepositions repeatedly — handles cases like
  // "ads for matte for tomorrow" where stripping leaves two trailing "for"s.
  let prev;
  do {
    prev = title;
    title = title.replace(/\s+(for|with|by|to)\s*$/i, "").trim();
  } while (title !== prev);
  title = title.trim();
  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }
  if (title.length > 0 && !/[.!?]$/.test(title)) {
    title += ".";
  }

  return {
    matchedClient,
    matchedWorker,
    matchedDate,
    title,
    matches,
  };
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

const navItemsCore = [
  { id: "today", icon: "today", label: "Today" },
  { id: "clients", icon: "user", label: "Clients" },
  { id: "health", icon: "health", label: "Health" },
  { id: "retros", icon: "rolodex", label: "Rolodex" },
  { id: "referrals", icon: "referrals", label: "Referrals" },
  { id: "workers", icon: "clients", label: "Workers" },
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
const mobileNavCore = [
  { id: "today", icon: "today", label: "Today" },
  { id: "clients", icon: "clients", label: "Clients" },
  { id: "coach", icon: "rai", label: "Rai" },
  { id: "health", icon: "health", label: "Health" },
  { id: "more", icon: "bento", label: "More" },
];
const mobileNavEnterprise = [
  { id: "today", icon: "today", label: "Today" },
  { id: "sweeps", icon: "sweeps", label: "Sweeps" },
  { id: "clients", icon: "clients", label: "Clients" },
  { id: "coach", icon: "rai", label: "Rai" },
  { id: "more", icon: "bento", label: "More" },
];
const moreItemsCore = [
  { id: "retros", icon: "rolodex", label: "Rolodex" },
  { id: "referrals", icon: "referrals", label: "Referrals" },
  { id: "settings", icon: "settings", label: "Settings" },
];
const moreItemsEnterprise = [
  { id: "settings", icon: "settings", label: "Settings" },
];

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
        border: "1px solid " + C.borderLight,
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "0 1px 2px rgba(10,10,10,0.04), 0 4px 12px rgba(10,10,10,0.05)",
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
                <span style={{ width: 5, height: 5, borderRadius: 999, background: C.success }} />
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
              fontWeight: 400,
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

export default function App({ user }) {
  // ─── ROUTING: Worker magic-link page lives at /w/{token} (no auth needed) ──
  // Detect this route before any auth-gated logic runs. Returns WorkerDashboard
  // standalone if matched.
  if (typeof window !== "undefined" && /^\/w\//.test(window.location.pathname)) {
    return <WorkerDashboard />;
  }

  const [tier, setTier] = useState("core");  // "core" | "enterprise"
  const [page, setPage] = useState("today");

  // ─── Theme (light / dark) ───────────────────────────────────────────
  // Persisted in localStorage. Applies `data-theme` to <html> so CSS
  // variables flip without re-render. Defaults to user's system preference
  // on first visit; then the choice sticks.
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    try {
      const saved = window.localStorage.getItem("rt-theme");
      if (saved === "light" || saved === "dark") return saved;
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch { return "light"; }
  });
  useEffect(() => {
    try {
      document.documentElement.setAttribute("data-theme", theme);
      window.localStorage.setItem("rt-theme", theme);
    } catch {}
  }, [theme]);
  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");
  // Scroll to top on page change. .r-main is now a fixed-positioned scroll
  // container (not the document), so we reset its scrollTop plus the Rai
  // chat's internal scroller. The document itself no longer scrolls, so no
  // window.scrollTo needed.
  useEffect(() => {
    document.querySelectorAll(".r-main, .r-rai-scroll").forEach(el => { el.scrollTop = 0; });
  }, [page]);
  // iOS Safari viewport fix — when the address bar collapses/expands, 100vh doesn't update,
  // leaving fixed-positioned elements (like the bottom nav) anchored to the wrong bottom.
  // visualViewport API tracks the actual visible viewport. We write its height to a CSS var
  // that components can use instead of 100vh. Falls back gracefully on non-supporting browsers.
  // Also: detect keyboard open on mobile so we can hide the bottom nav (iOS covers the input
  // with the keyboard + the fixed bottom nav, making the input unreachable).
  const [keyboardOpen, setKeyboardOpen] = useState(false);
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
  const [showMore, setShowMore] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientTab, setClientTab] = useState("overview");
  const [clientBilling, setClientBilling] = useState({});
  const [billingAddOpen, setBillingAddOpen] = useState(false);
  const [billingNewItem, setBillingNewItem] = useState({ description: "", amount: "", recurring: false });
  const [editingOverview, setEditingOverview] = useState(false);
  const [overviewEditData, setOverviewEditData] = useState({});
  const [editingProfile, setEditingProfile] = useState(false);
  const [editScores, setEditScores] = useState({});
  // ═══ DATA LOADING ═══
  const [dataLoaded, setDataLoaded] = useState(false);
  const [hcQueue, setHcQueue] = useState([]);
  const [todayStripOpen, setTodayStripOpen] = useState(false);
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
  // Burst tracker — per-client timestamp of most recent task creation.
  // Used by the 60s burst rule (with 5-min hard cap) to keep the "Rai's pick"
  // badge from flickering while the user is rapidly creating tasks for a
  // picked client. Lives in a ref so updates don't trigger renders.
  // Shape: { [clientName]: { firstCreatedAt: ms, lastCreatedAt: ms } }
  const raiBurstTrackerRef = useRef({});
  // Focus mode: laser-focus on top task, dim everything else. Only available in Rai mode.
  // Not persisted — resets to off on each session/page reload.
  const [focusMode, setFocusMode] = useState(false);
  // One-shot flash trigger when entering Focus mode. Cleared after animation completes.
  const [focusFlash, setFocusFlash] = useState(false);
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
  const [dragOverTaskId, setDragOverTaskId] = useState(null);
  const [healthStripOpen, setHealthStripOpen] = useState(false);
  const [retroAnswers, setRetroAnswers] = useState({});
  const [rolodex, setRolodex] = useState([]);
  const [rolodexFlowOpen, setRolodexFlowOpen] = useState(null);
  const [showAddRolodex, setShowAddRolodex] = useState(false);
  const [newRolodexEntry, setNewRolodexEntry] = useState({ client: "", contact: "", work: "", type: "former" });
  const [rolodexConfirm, setRolodexConfirm] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState(false);
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
  const [newClient, setNewClient] = useState({ name: "", contact: "", role: "", tag: "", revenue: "", months: "", latePayments: false, prevTerminated: false, otherVendors: false, fromReferral: false });
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

  // Referral-adjusted LTV: client's own LTV + 50% of revenue from clients they referred
  const getAdjustedLTV = (client) => {
    const ownLTV = (client.revenue || 0) * (client.months || 0);
    const referralRevenue = refs
      .filter(r => r.from === client.name && (r.status === "converted" || r.converted))
      .reduce((sum, r) => {
        // Find the referred client's total revenue
        const referredClient = clients.find(c => c.name === r.to);
        const refLTV = referredClient 
          ? (referredClient.revenue || 0) * (referredClient.months || 0)
          : (r.revenue || 0) * 12; // estimate if not a client yet
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
    // Soft clamp: anything <= 85 untouched. Above 85, compress excess to 50%.
    // This preserves real differentiation among top-tier clients (which used to
    // pile up at the hard 99 ceiling) while leaving mid/bottom tier clients
    // exactly where the multiplier puts them.
    // Returns a FLOAT — sort comparators use it directly. UI rounds for display.
    // Hard ceiling at 97 protects against runaway outliers without flattening the top.
    const T = 85;
    const ratio = 0.50;
    const softClamped = raw <= T ? raw : Math.min(97, T + (raw - T) * ratio);
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
    
    // Insert into Supabase first
    const { data: created, error } = await clientsDb.create(user.id, {
      name: newClient.name,
      contact: newClient.contact,
      role: newClient.role || "",
      tag: newClient.tag || "",
      revenue: parseInt(newClient.revenue) || 0,
      months: parseInt(newClient.months) || 0,
      retention_score: baseline || 50,
      profile_scores: { ...profileScores },
      qualifying_flags: qualFlags,
    });
    
    if (error) { console.error("Failed to create client:", error); return; }

    const client = {
      id: created?.id || Date.now(),
      name: newClient.name,
      contact: newClient.contact,
      role: newClient.role,
      tag: newClient.tag,
      revenue: parseInt(newClient.revenue) || 0,
      months: parseInt(newClient.months) || 0,
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
      const dueDateStr = dueDate.toISOString().split('T')[0];

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
    setNewClient({ name: "", contact: "", role: "", tag: "", revenue: "", months: "" });
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
  const [newTaskClient, setNewTaskClient] = useState("");
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
  const [workerCounts, setWorkerCounts] = useState({}); // { worker_id: { pending, done } }
  const [newTaskWorkerId, setNewTaskWorkerId] = useState(null);   // composer: assigned worker for new task
  const [workerPickerOpen, setWorkerPickerOpen] = useState(false); // composer popover
  const [addWorkerOpen, setAddWorkerOpen] = useState(false);       // add-worker modal
  const [newWorkerName, setNewWorkerName] = useState("");
  const [newWorkerEmail, setNewWorkerEmail] = useState("");
  const [newWorkerRole, setNewWorkerRole] = useState("");
  const [showClientPicker, setShowClientPicker] = useState(false);
  // Touchpoint data layer is intact (allTouchpoints + tpLogged still load from DB
  // for rhythm calc and history) — only the manual Log UI was removed.
  const [tpLogged, setTpLogged] = useState([]);
  const [allTouchpoints, setAllTouchpoints] = useState([]);
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
    
    const [clientRes, taskRes, refRes, rolodexRes, hcRes, tpRes, hcCountsRes, convoListRes, raiStateRes, raiPicksRes] = await Promise.all([
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
    ]);
    if (raiStateRes?.data) setRaiState(raiStateRes.data);
    setRaiPicks(raiPicksRes?.data || null);

    // Cadence data — loaded separately with fallback so a missing db function
    // degrades cadence only, doesn't nuke the whole page
    try {
      if (typeof touchpointsDb.list === "function") {
        const tpAllRes = await touchpointsDb.list(uid, 90);
        if (tpAllRes?.data) setAllTouchpoints(tpAllRes.data);
      }
    } catch (e) {
      console.warn("Cadence data failed to load:", e);
    }

    // Observer card — loaded separately. If table doesn't exist or is empty, no card shows.
    try {
      if (typeof observationsDb?.getCurrent === "function") {
        const obsRes = await observationsDb.getCurrent(uid);
        if (obsRes?.data) {
          setObservation(obsRes.data);
        }
      }
    } catch (e) {
      console.warn("Observer card failed to load:", e);
    }

    // Daybook — fetch today + yesterday in one shot. Hydrate the textarea once.
    try {
      if (typeof daybookDb?.getTodayAndYesterday === "function") {
        const dbRes = await daybookDb.getTodayAndYesterday(uid);
        if (dbRes?.data) {
          setDaybookEntry(dbRes.data.today?.body || "");
          setDaybookYesterday(dbRes.data.yesterday || null);
          setDaybookSaveStatus(dbRes.data.today ? "saved" : "idle");
          daybookHydratedRef.current = true;
        }
      }
    } catch (e) {
      console.warn("Daybook failed to load:", e);
    }

    if (tpRes.data) setTpLogged(tpRes.data.map(t => ({
      id: t.id,
      client: t.client_name,
      channel: t.channel,
    })));

    if (clientRes.data) setClients(clientRes.data.map(c => ({
      ...c,
      ret: c.retention_score || 0,
      contact: c.contact || "",
      role: c.role || "",
      months: c.months || 0,
      revenue: c.revenue || 0,
      tag: c.tag || "",
      lastHC: c.last_hc_date || null,
      lastContact: c.last_task_date ? "recent" : "—",
      referrals: 0,
      profileScores: c.profile_scores || {},
      qualifyingFlags: c.qualifying_flags || {},
      // Rai's daily reweighting + reasoning (per-client). Sweep writes raiNudge
      // overnight. Sort comparator reads raiNudge to influence task ordering.
      // raiSignal/raiRationale at client-level are debug fields; the pick badge
      // hover text comes from rai_picks.reason (per-pick), not the client.
      raiNudge: c.rai_nudge != null ? Number(c.rai_nudge) : 0,
      raiSignal: c.rai_signal || null,
      raiRationale: c.rai_rationale || null,
    })));

    if (taskRes.data) {
      // Auto-cleanup at the most recent 2 AM local time:
      //   - Recurring tasks completed before cutoff → reset is_done (they reappear fresh)
      //   - Non-recurring tasks completed before cutoff → SOFT-CLEARED via cleared_at
      //     timestamp. Row stays in DB so Rai/detectors can still count historical
      //     task volume, identify client task patterns, etc. Hidden only from the
      //     active Today list.
      //   - Open tasks (not done) → preserved regardless of age (carry forward)
      //
      // Cutoff is today at 2 AM local; if it's currently before 2 AM, cutoff is
      // yesterday at 2 AM (so user's late-night completed tasks survive into the
      // morning until the natural 2 AM rollover).
      const now = new Date();
      const today2am = new Date(now);
      today2am.setHours(2, 0, 0, 0);
      const cutoff = now < today2am ? new Date(today2am.getTime() - 86400000) : today2am;

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

    // Workers — non-blocking, optional table
    try {
      const [wRes, wcRes] = await Promise.all([
        workersDb.list(uid),
        workersDb.getCounts(uid),
      ]);
      if (wRes?.data) setWorkersList(wRes.data);
      if (wcRes?.data) setWorkerCounts(wcRes.data);
    } catch (e) {
      console.warn("Workers load failed (table may not exist yet):", e);
    }

    setDataLoaded(true);
  }, [user]);


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
        // Refresh worker counts if a worker assignment changed or task got completed
        if (row.assigned_worker_id) {
          workersDb.getCounts(user.id).then(({ data }) => {
            if (data) setWorkerCounts(data);
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
    if (!raiPicks || raiPicks.length === 0) return; // no picks today

    // Day is over: badge has been set at some point today. Never re-badge.
    if (raiState.todays_badge_set_at) return;
    if (raiState.todays_badged_task_id) return;

    let timeoutId;

    const evaluate = async () => {
      const SETTLE_MS = 60 * 1000;
      const now = Date.now();
      const todayIso = new Date().toISOString().slice(0, 10);

      for (const pick of raiPicks) {
        const c = clients.find(x => x.id === pick.client_id);
        if (!c) continue;

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
        if (clientTodayTasks.length === 0) continue;

        // Eligible = at least one of these tasks has settled >60s
        const settled = clientTodayTasks.filter(t => (now - (t.created_at || 0)) >= SETTLE_MS);
        if (settled.length === 0) continue;

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
        return;
      }
    };

    // Debounce: re-evaluate after 5 seconds of no changes
    timeoutId = setTimeout(evaluate, 5000);
    return () => { clearTimeout(timeoutId); };
  }, [user, rankMode, raiState, raiPicks, tasks, clients, todayDismissed]);


  // Sync user's IANA timezone to the profiles table once per session.
  // Used by the Observer cron and any future server-side scheduling that
  // needs to anchor "today" / "this week" to the user's local clock instead
  // of UTC. Only writes if the detected tz differs from what's stored
  // (avoids unnecessary writes on every load).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        const profRes = await profileDb.get(user.id);
        if (cancelled) return;
        const storedTz = profRes?.data?.timezone || 'UTC';
        if (detectedTz && detectedTz !== storedTz) {
          await profileDb.update(user.id, { timezone: detectedTz });
        }
      } catch (e) {
        // Non-blocking — failure here just means observations/etc fall back to UTC
        console.warn('Timezone sync failed:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Schedule automatic recurring-task reset at 2 AM local, every day
  // Fires even if the tab stays open across midnight — ensures no one sees stale "done" checkmarks
  useEffect(() => {
    if (!user) return;
    let timeoutId;
    const scheduleNext2am = () => {
      const now = new Date();
      const next2am = new Date(now);
      next2am.setHours(2, 0, 0, 0);
      if (next2am <= now) next2am.setDate(next2am.getDate() + 1);
      const msUntil = next2am.getTime() - now.getTime();
      timeoutId = setTimeout(() => {
        loadData();
        scheduleNext2am();
      }, msUntil);
    };
    scheduleNext2am();

    // Also refresh when tab regains focus — catches laptop-sleep case where setTimeout
    // may have paused across system sleep and missed the 2 AM fire
    const onVisible = () => { if (document.visibilityState === "visible") loadData(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user, loadData]);

  // ═══ SUPABASE-BACKED MUTATIONS ═══
  const toggleTask = async (id) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const newDone = !task.done;
    const nowIso = new Date().toISOString();
    // Optimistic update
    const updated = tasks.map(t => t.id === id ? { ...t, done: newDone, completed_at: newDone ? nowIso : null } : t);
    setTasks(updated);
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
    // Fireworks fire only when ALL of TODAY's tasks are complete.
    // "Today" = recurring + no due_date + due_date <= today.
    // Tomorrow / Later tasks don't count toward the celebration.
    // Day boundary anchored to 2am local — between midnight and 2am, "today"
    // still refers to yesterday's calendar date (matches task soft-clear cron).
    const _now = new Date();
    if (_now.getHours() < 2) _now.setDate(_now.getDate() - 1);
    const _todayStr = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}-${String(_now.getDate()).padStart(2, "0")}`;
    const todayCountable = countable.filter(t => {
      if (t.recurring) return true;
      if (!t.due_date) return true;
      const d = String(t.due_date).slice(0, 10);
      return d <= _todayStr;
    });
    const todayDoneNow = todayCountable.filter(t => t.done).length;
    if (todayDoneNow === todayCountable.length && todayCountable.length > 0) {
      setConfetti(true);
      setTimeout(() => setConfetti(false), 3000);
    }
    // Persist
    await tasksDb.toggle(id, newDone);
  };

  const recurringTasks = tasks.filter(t => t.recurring);
  const todayTasks = tasks.filter(t => !t.recurring);
  const countableTasks = tasks;

  const tasksDone = countableTasks.filter(t => t.done).length;
  const tasksTotal = countableTasks.length;

  // Task sorting — by Profile Score (invisible), highest first
  // Rai priority boost — applied to one task per day during sweep
  const getRaiBoost = (score) => {
    if (score >= 90) return 5;
    if (score >= 80) return 10;
    if (score >= 70) return 15;
    if (score >= 60) return 20;
    return 25;
  };

  const getProfileSortScore = (clientName, hasRaiBoost = false, pickBoost = 0) => {
    if (!clientName || clientName === "All Clients") return 200; // All Clients tasks first
    const c = clients.find(x => x.name === clientName);
    if (!c) return 0;
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
    return Math.min(99, ps + boost + raiBoost + raiNudge + (pickBoost || 0));
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
  // Referrals v2 — ask-next queue interaction state
  const [askActiveId, setAskActiveId] = useState(null);
  const [askTone, setAskTone] = useState("neutral"); // softer | neutral | firmer
  const [askDraft, setAskDraft] = useState("");
  // Persisted "already asked" set — once acted-on, a client never appears in ask queue again.
  // Loaded from localStorage so the state survives reloads.
  const [askActed, setAskActed] = useState(() => {
    try { const raw = localStorage.getItem("rt-ask-acted"); return raw ? new Set(JSON.parse(raw)) : new Set(); } catch { return new Set(); }
  });
  // Network Map hover highlight
  const [networkHoverId, setNetworkHoverId] = useState(null);

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
  const goTo = (id) => { if (page === "health" && id !== "health") { setHcDone({}); setHcOpen(null); } setPage(id); setShowMore(false); };
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
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,300..700,30..100,0..1;1,9..144,300..700,30..100,0..1&display=swap');
        ${THEME_CSS}
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: var(--rt-bg); overscroll-behavior: none; }
        input, textarea, select { font-size: 16px !important; }
        @media (min-width: 768px) { input, textarea, select { font-size: 14px !important; } }
        ::selection { background: #33543E; color: #fff; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: var(--rt-border); border-radius: 2px; }
        .nav-item { transition: all 0.12s; cursor: pointer; }
        .nav-item:hover { background: var(--rt-deep-cream); }
        .r-btn { transition: all 0.15s ease; cursor: pointer; }
        @media (hover: hover) {
          .r-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(91,33,182,0.18); }
        }
        .r-btn:active { transform: scale(0.98); }
        .row-hover { transition: background 0.1s; cursor: pointer; }
        .row-hover:hover { background: ${C.primarySoft}; }
        .r-desk { display: none; }
        .r-mob-top { display: flex; }
        .r-mob-bot { display: flex; }
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
          .r-mob-top { display: none !important; }
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
        .rt-row:hover .rt-dismiss { opacity: 1 !important; }
        /* Composer focus-within — soft purple glow when the user is creating a task */
        .rt-composer { transition: border-color 200ms ease, box-shadow 200ms ease; }
        .rt-composer:focus-within {
          border-color: rgba(91,33,182,0.32) !important;
          box-shadow: 0 0 0 4px rgba(91,33,182,0.08), ${C.shadowMd} !important;
        }
        /* ASMR completion — done state styling */
        .rt-row.is-done {
          background: ${C.bg} !important;
          border-color: ${C.borderLight} !important;
          transition: background 320ms ease, border-color 320ms ease;
        }
        .rt-row .rt-check {
          transition: background 240ms ease, border-color 240ms ease, transform 280ms cubic-bezier(.34,1.56,.64,1);
        }
        .rt-row .rt-check svg {
          opacity: 0;
          transform: scale(0.4);
          transition: opacity 220ms ease 60ms, transform 320ms cubic-bezier(.34,1.56,.64,1) 60ms;
        }
        .rt-row.is-done .rt-check {
          background: #C4C4BC !important;
          border-color: #C4C4BC !important;
          transform: scale(1);
        }
        .rt-row.is-done .rt-check svg { opacity: 1; transform: scale(1); }
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
        .r-convo-row:hover { background: rgba(91,33,182,0.06); }
        .r-convo-row:hover .r-convo-action { opacity: 1 !important; }
        /* ═══════════════════════════════════════════════════════════════
           FOCUS MODE
           Page stays cream. Everything dims to 0.06 opacity except:
             - .rt-toolbar (the toggle row with Ranked by Rai + Focus button)
             - .rt-row.rt-focus-top (the highlighted top task)
        ═══════════════════════════════════════════════════════════════ */

        /* Dim sidebar contents */
        body:has(.rt-focus-on) .r-desk > *,
        body:has(.rt-focus-on) .r-mob-top > *,
        body:has(.rt-focus-on) .r-mob-bot > * {
          opacity: 0.06 !important;
          transition: opacity 280ms ease;
          pointer-events: none;
        }

        /* Dim every direct child of the today grid except the tasks column */
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

        /* Lightning flash — single white burst when toggling focus on */
        .rt-flash {
          position: fixed;
          top: 0; right: 0; bottom: 0; left: 0;
          background: rgba(255, 255, 255, 0);
          pointer-events: none;
          z-index: 100;
        }
        .rt-flash.is-firing {
          animation: rt-flash-anim 380ms ease-out;
        }
        @keyframes rt-flash-anim {
          0%   { background: rgba(255, 255, 255, 0); }
          8%   { background: rgba(255, 255, 255, 0.85); }
          100% { background: rgba(255, 255, 255, 0); }
        }

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
          /* Band stays row-direction on mobile so compact % sits right of headline */
          .rt-band { flex-wrap: nowrap !important; gap: 12px !important; }
          .rt-band-greet { font-size: 24px !important; white-space: nowrap; }
          .rt-band-right { display: block !important; min-width: 0 !important; flex-shrink: 0; }
          .rt-band-right .rt-pct-num { font-size: 24px !important; }
          .rt-band-right .rt-pct-num span { font-size: 13px !important; }
          .rt-band-right .rt-pct-lbl { display: block !important; font-size: 9px !important; }
          .rt-band-right .rt-pct-bar { width: 100% !important; height: 4px !important; margin-top: 6px !important; }
          .rt-band-sub-pct { display: none !important; }
          .rt-band-sub-bar { display: none !important; }
          .rt-band-sub { width: 100% !important; }
          .rt-composer-controls { width: 100%; }
          .rt-composer-pill { padding: 6px 8px !important; gap: 4px !important; }
          .rt-composer-pill span { font-size: 11.5px !important; }
          .rt-row-meta span:nth-child(n+4) { display: none !important; }
        }
        /* Focus button bolt watermark — sized proportional to viewport */
        .rt-focus-bolt { font-size: 60px; }
        @media (max-width: 900px) {
          .rt-focus-bolt { font-size: 32px; }
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
          .rt-composer-client-chip { padding: 2px 4px 2px 2px !important; }
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
      {focusFlash && <div className="rt-flash is-firing" />}

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

      {/* SIDEBAR */}
      <div className="r-desk" style={{ width: 240, background: C.surfaceWarm, flexDirection: "column", position: "fixed", top: 14, left: 14, bottom: 14, zIndex: 50, borderRadius: 14, boxShadow: "0 1px 2px rgba(10,10,10,0.04), 0 2px 6px rgba(10,10,10,0.04)" }}>
        {/* Logo — fixed at top */}
        <div style={{ padding: "20px 18px 18px", flexShrink: 0 }}>
          <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.04em", color: theme === "dark" ? "#FFFFFF" : C.primary, fontFamily: "system-ui, -apple-system, sans-serif" }}>Retayned<span style={{ letterSpacing: "0" }}>.</span></span>
        </div>

        {/* Nav items — fixed, always visible */}
        <div style={{ padding: "0 10px", flexShrink: 0 }}>
          {(tier === "enterprise" ? navItemsEnterprise : navItemsCore).map(n => {
            const active = page === n.id;
            return (
              <div key={n.id} className="nav-item" onClick={() => goTo(n.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, marginBottom: 2, background: active ? C.deepCream : "transparent", color: active ? C.text : C.text, fontWeight: active ? 600 : 500, boxShadow: active ? "inset 0 1px 2px rgba(0,0,0,0.06)" : "none", cursor: "pointer" }}>
                <span style={{ width: 20, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={n.icon} size={16} color={active ? C.primary : C.ink500} /></span><span style={{ fontSize: 14, flex: 1 }}>{n.label}</span>
                {hasDot(n.id) && <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.danger, boxShadow: "0 0 0 2.5px " + C.surfaceWarm, flexShrink: 0 }} />}
              </div>
            );
          })}
        </div>

        {/* Coach-only: New Chat button + scrollable past-chats list. Takes all
            remaining vertical space so the list scrolls internally without
            affecting nav items or the Portfolio widget at the bottom. */}
        {page === "coach" ? (
          <div style={{ padding: "12px 10px 0", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <button onClick={startNewRaiChat} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: C.btn, color: "#fff", fontSize: 13, fontWeight: 600, textAlign: "center", cursor: "pointer", border: "none", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 2px rgba(91,33,182,0.15), 0 2px 6px rgba(91,33,182,0.22)", flexShrink: 0 }}>
              New Chat
            </button>
            {raiConvoList.length > 0 && (() => {
              const starred = raiConvoList.filter(c => c.is_starred);
              const recent = raiConvoList.filter(c => !c.is_starred);
              const section = (label, items) => (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: 0.5, textTransform: "uppercase", padding: "14px 10px 6px" }}>{label}</div>
                  {items.map(c => {
                    const isActive = c.id === aiConvoId;
                    const title = c.title || c.client?.name || "Untitled chat";
                    return (
                      <div
                        key={c.id}
                        className="r-convo-row"
                        onClick={() => openRaiChat(c.id)}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 8px 7px 10px", borderRadius: 7, cursor: "pointer", background: isActive ? C.primarySoft : "transparent", color: isActive ? C.primary : C.text, fontSize: 12.5, fontWeight: isActive ? 600 : 500, position: "relative", transition: "background 0.12s" }}
                      >
                        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
                        <button
                          className="r-convo-action"
                          onClick={e => { e.stopPropagation(); toggleRaiChatStar(c.id, c.is_starred); }}
                          style={{ background: "none", border: "none", padding: 3, cursor: "pointer", color: c.is_starred ? "#E6B800" : C.textMuted, display: "flex", opacity: c.is_starred ? 1 : 0, transition: "opacity 0.12s" }}
                          title={c.is_starred ? "Unstar" : "Star"}
                        >
                          <Icon name={c.is_starred ? "starFill" : "star"} size={12} />
                        </button>
                        <button
                          className="r-convo-action"
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
                <div style={{ marginTop: 4, overflowY: "auto", flex: 1, minHeight: 0, paddingBottom: 10 }}>
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
        {/* Portfolio widget — G: bar + counts only, scale demoted to eyebrow */}
        {(() => {
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
          return (
            <div style={{ padding: "14px 16px", margin: "0 10px 8px", background: C.deepCream, borderRadius: 8, boxShadow: "inset 0 1px 2px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase" }}>Portfolio · {total}</div>
                <div style={{ fontSize: 9.5, color: C.textMuted, fontStyle: "italic", fontFamily: "'Fraunces', Georgia, serif", fontVariationSettings: '"opsz" 96, "SOFT" 50, "WONK" 0', fontWeight: 400, fontVariantNumeric: "tabular-nums" }}>${(totalRev / 1000).toFixed(1)}k MRR</div>
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
        <div style={{ padding: "4px 6px 8px" }}>
          <div onClick={() => setTier(tier === "core" ? "enterprise" : "core")} className="nav-item" style={{ display: "none", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 8, color: C.textSec }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{tier === "enterprise" ? "Enterprise" : "Core"}</span>
            <div style={{ width: 36, height: 20, borderRadius: 10, background: tier === "enterprise" ? C.btn : C.border, position: "relative", transition: "background 0.2s", cursor: "pointer" }}>
              <div style={{ width: 16, height: 16, borderRadius: 8, background: "#fff", position: "absolute", top: 2, left: tier === "enterprise" ? 18 : 2, transition: "left 0.2s" }} />
            </div>
          </div>
          {(() => {
            const active = page === "settings";
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div className="nav-item" onClick={() => goTo("settings")} style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", borderRadius: 8, color: active ? C.text : C.text, background: active ? C.deepCream : "transparent", fontWeight: active ? 600 : 500, boxShadow: active ? "inset 0 1px 2px rgba(0,0,0,0.06)" : "none", cursor: "pointer" }}>
                  <span style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="settings" size={20} color={active ? C.primary : C.ink500} /></span><span style={{ fontSize: 14, flex: 1 }}>Settings</span>
                </div>
                <button
                  onClick={toggleTheme}
                  title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                  aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                  style={{
                    width: 34, height: 34, border: 0,
                    background: "transparent",
                    borderRadius: 8,
                    cursor: "pointer",
                    display: "grid", placeItems: "center",
                    color: C.ink500,
                    flexShrink: 0,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = C.deepCream}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <Icon name={theme === "dark" ? "sun" : "moon"} size={16} color={C.ink500} />
                </button>
              </div>
            );
          })()}
        </div>
        <div style={{ padding: "10px 16px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 15, background: C.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>{(() => { const n = user?.user_metadata?.full_name; if (n) return n.split(" ").map(x => x[0]).join("").slice(0,2).toUpperCase(); return (user?.email || "U")[0].toUpperCase(); })()}</div>
            <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600, color: C.text, textTransform: "capitalize", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User"}</div><div style={{ fontSize: 11, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.user_metadata?.company || ""}</div></div>
          </div>
        </div>
      </div>

      {/* MOBILE TOP */}
      <div className="r-mob-top" style={{ justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: C.card, borderBottom: "1px solid " + C.borderLight }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: "-0.04em", color: theme === "dark" ? "#FFFFFF" : C.primary, fontFamily: "system-ui, -apple-system, sans-serif" }}>Retayned<span style={{ letterSpacing: "0" }}>.</span></span>
        </div>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: C.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff" }}>{(() => { const n = user?.user_metadata?.full_name; if (n) return n.split(" ").map(x => x[0]).join("").slice(0,2).toUpperCase(); return (user?.email || "U")[0].toUpperCase(); })()}</div>
      </div>

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
          const activeBadgePick = activeBadgeTaskId
            ? raiPicks.find(p => {
                // Match the picked client to the badged task
                const t = tasks.find(x => x.id === activeBadgeTaskId);
                if (!t) return false;
                const c = clients.find(x => x.name === t.client);
                return c && p.client_id === c.id;
              })
            : null;

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
            const psA = getProfileSortScore(a.client, a.raiPriority, pickBoostForClient(a.client));
            const psB = getProfileSortScore(b.client, b.raiPriority, pickBoostForClient(b.client));
            if (psA !== psB) return psB - psA;
            // Rai's tiebreak: larger nudge magnitude wins (positive = stronger
            // surface signal, negative = stronger demote signal — both meaningful).
            const nudgeA = Math.abs(nudgeForClient(a.client));
            const nudgeB = Math.abs(nudgeForClient(b.client));
            if (nudgeA !== nudgeB) return nudgeB - nudgeA;
            if (a.alert !== b.alert) return a.alert ? -1 : 1;
            if (a.recurring !== b.recurring) return a.recurring ? -1 : 1;
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
          const displayDate = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

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
            const sizes = size === "sm" ? { fs: 11, pad: "2px 7px" } : { fs: 13, pad: "4px 10px" };
            return (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: bg, color, fontSize: sizes.fs, fontWeight: 700, fontVariantNumeric: "tabular-nums", padding: sizes.pad, borderRadius: 5 }}>
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
          const ClientAvatar = ({ client, size = 28 }) => {
            if (!client) return null;
            const initials = client.name.split(/\s|&/).filter(Boolean).slice(0, 2).map(s => s[0]).join("").toUpperCase();
            const color = retColor(client.ret || 60);
            return (
              <div style={{ width: size, height: size, borderRadius: "50%", background: color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 700, flexShrink: 0, letterSpacing: 0.2 }}>
                {initials}
              </div>
            );
          };

          // ─── DATE BOUNDARIES (hoisted so status band can count today-only tasks) ──
          // Day boundary anchored to 2am local — between midnight and 2am, "today"
          // still refers to yesterday's calendar date (matches task soft-clear cron
          // and worker dashboard logic).
          const _now = new Date();
          if (_now.getHours() < 2) _now.setDate(_now.getDate() - 1);
          const _todayStr = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}-${String(_now.getDate()).padStart(2, "0")}`;
          const _tomorrow = new Date(_now);
          _tomorrow.setDate(_tomorrow.getDate() + 1);
          const _tomorrowStr = `${_tomorrow.getFullYear()}-${String(_tomorrow.getMonth() + 1).padStart(2, "0")}-${String(_tomorrow.getDate()).padStart(2, "0")}`;

          const bucketOf = (t) => {
            // Recurring tasks: only show in today bucket if today matches the pattern.
            // Otherwise hide entirely (returns "hidden" — buckets filter that out).
            if (t.recurring) {
              return recurrenceMatchesDate(t.recurrence_pattern, _now) ? "today" : "hidden";
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
            // Recurring tasks cannot have a due_date — they reset daily at 2am local.
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
              <div className="rt-band" style={{ gridArea: "band", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "4px 4px 20px", borderBottom: "1px solid " + C.borderLight, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                  <div style={{ fontSize: 11.5, color: C.textMuted, letterSpacing: 0.3, marginBottom: 4 }}>{displayDate}</div>
                  <h1 className="rt-band-greet" style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: -0.4, color: C.text }}>
                    {greeting}{firstName ? ", " + firstName : ""}.
                  </h1>

                  {/* Rai's Pick of the Day — editorial sentence directly under
                      the greeting. Hidden when: rankMode is manual, no pick row
                      exists, picked client isn't in roster, or user dismissed
                      it today. The pick boost stays active even after dismiss
                      (boost rides on tasks, not on the card). */}
                  {(() => {
                    if (rankMode !== "rai") return null;
                    if (!raiPicks || !raiPicks.client_id) return null;
                    if (raiState?.todays_pick_dismissed_at) return null;
                    const pickClient = clients.find(c => c.id === raiPicks.client_id);
                    if (!pickClient) return null;

                    const handleDismiss = async () => {
                      setRaiState(prev => prev ? { ...prev, todays_pick_dismissed_at: new Date().toISOString() } : prev);
                      try { await raiUserStateDb.dismissTodaysPick(user.id); } catch (e) { console.warn("Failed to dismiss Rai pick:", e); }
                    };
                    const handleEditProfile = () => { setSelectedClient(pickClient); };
                    const handleAddTask = () => {
                      setTodayComposerClient(pickClient.name);
                      setTimeout(() => {
                        const el = document.getElementById("rt-composer-input");
                        if (el) { el.focus(); el.scrollIntoView({ behavior: "smooth", block: "center" }); }
                      }, 0);
                    };

                    return (
                      <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.55, color: C.textSec, fontFamily: "Fraunces, Georgia, serif", fontStyle: "italic" }}>
                        <span style={{ display: "inline-block", fontSize: 10.5, letterSpacing: "0.12em", fontWeight: 600, color: "#1C3224", fontFamily: "inherit", fontStyle: "normal", marginRight: 10, verticalAlign: 1 }}>
                          RAI
                        </span>
                        Today,{" "}
                        <span
                          onClick={handleEditProfile}
                          style={{ color: C.btn, cursor: "pointer", borderBottom: `1px dotted ${C.btn}`, paddingBottom: 1, fontStyle: "normal", fontFamily: "inherit", fontWeight: 500 }}
                        >
                          {pickClient.name}
                        </span>{" "}
                        is on her mind &mdash; {raiPicks.reason ? raiPicks.reason.replace(/^["']|["']$/g, "").replace(/\.$/, "").toLowerCase() : "worth a check-in"}.
                        <span style={{ display: "inline-block", marginLeft: 10, fontSize: 12.5, fontFamily: "inherit", fontStyle: "normal" }}>
                          <button onClick={handleAddTask} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", color: C.textSec, textDecoration: "underline", textDecorationColor: C.borderLight, textUnderlineOffset: 3, fontFamily: "inherit", fontSize: "inherit" }}>
                            Add a task
                          </button>
                          <span style={{ margin: "0 6px", color: C.borderLight }}>&middot;</span>
                          <button onClick={handleEditProfile} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", color: C.textSec, textDecoration: "underline", textDecorationColor: C.borderLight, textUnderlineOffset: 3, fontFamily: "inherit", fontSize: "inherit" }}>
                            refresh profile
                          </button>
                          <span style={{ margin: "0 6px", color: C.borderLight }}>&middot;</span>
                          <button onClick={handleDismiss} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", color: C.textMuted, textDecoration: "underline", textDecorationColor: C.borderLight, textUnderlineOffset: 3, fontFamily: "inherit", fontSize: "inherit" }}>
                            not today
                          </button>
                        </span>
                      </div>
                    );
                  })()}

                  <div className="rt-band-sub" style={{ fontSize: 13.5, color: C.textMuted, marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
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
                    <span className="rt-band-sub-pct" style={{ display: "none", marginLeft: "auto", fontSize: 11, fontWeight: 700, color: C.primary, background: C.primarySoft, padding: "2px 8px", borderRadius: 999 }}>
                      {Math.round(pct * 100)}%
                    </span>
                  </div>

                  {/* Mobile calendar dropdown — drops down right under the band trigger */}
                  {todayStripOpen && (
                    <div className="rt-mob-cal-sheet rt-mob-cal-sheet-band" style={{ display: "none", marginTop: 10, background: C.card, border: "1px solid " + C.borderLight, borderRadius: 10, padding: "14px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                          <div style={{ width: 26, height: 26, borderRadius: 7, background: C.primaryGhost, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Icon name="calendar" size={13} color={C.primary} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 0.3, textTransform: "uppercase", fontWeight: 700 }}>Today's calendar</div>
                            <span
                              className="rt-task-title is-discussable"
                              onClick={() => setPage("settings")}
                              style={{ fontSize: 12, color: C.textSec, marginTop: 1, display: "inline-block", cursor: "pointer" }}
                            >
                              Connect to activate
                            </span>
                          </div>
                        </div>
                      </div>
                      <div style={{ marginTop: 4 }}>
                        {[
                          { time: "2:30pm", title: "Backyard Discovery sync" },
                          { time: "4:00pm", title: "Motley Fool review" },
                          { time: "5:30pm", title: "Internal — weekly planning" },
                        ].map((e, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderTop: "1px solid " + C.borderLight }}>
                            <span style={{ fontSize: 11.5, color: C.textMuted, fontVariantNumeric: "tabular-nums", fontWeight: 500, width: 48, flexShrink: 0 }}>{e.time}</span>
                            <span style={{ fontSize: 13, color: C.text, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="rt-band-sub-bar" style={{ display: "none", height: 3, background: C.borderLight, borderRadius: 2, marginTop: 10, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct * 100}%`, background: `linear-gradient(90deg, ${C.primaryLight}, ${C.primary})`, borderRadius: 2, transition: "width 400ms cubic-bezier(.2,.7,.3,1)" }} />
                  </div>
                </div>
                <div className="rt-band-right" style={{ minWidth: 220, textAlign: "right" }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end", gap: 8 }}>
                    <span className="rt-pct-num" style={{ fontSize: 26, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums", letterSpacing: -0.3 }}>
                      {Math.round(pct * 100)}<span style={{ fontSize: 15, color: C.textMuted, fontWeight: 500 }}>%</span>
                    </span>
                    <span className="rt-pct-lbl" style={{ fontSize: 11, color: C.textMuted, letterSpacing: 0.3, textTransform: "uppercase", fontWeight: 600 }}>of today done</span>
                  </div>
                  <div className="rt-pct-bar" style={{ height: 4, background: C.borderLight, borderRadius: 2, marginTop: 8, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct * 100}%`, background: `linear-gradient(90deg, ${C.primaryLight}, ${C.primary})`, borderRadius: 2, transition: "width 400ms cubic-bezier(.2,.7,.3,1)" }} />
                  </div>
                </div>
              </div>

              {/* COMPOSER */}
              <div className="rt-composer" style={{ gridArea: "composer", background: C.card, border: "1px solid " + C.border, borderRadius: 14, boxShadow: C.shadowMd, position: "relative" }}>
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
                        }
                        if (parsed.matchedWorker && newTaskWorkerId !== parsed.matchedWorker.id) {
                          setNewTaskWorkerId(parsed.matchedWorker.id);
                        }
                        if (parsed.matchedDate && parsed.matchedDate.date) {
                          const ymd = dateToYmd(parsed.matchedDate.date);
                          if (ymd && newTaskDueDate !== ymd) {
                            setNewTaskDueDate(ymd);
                            setNewTaskRecurring(false);
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
                            className="rt-composer-pill"
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 5,
                              padding: selectedClientObj ? "0 4px 0 4px" : "0 10px",
                              height: 28,
                              border: "none",
                              borderRadius: 7,
                              fontSize: 12,
                              color: selectedClientObj ? C.btn : C.textSec,
                              background: selectedClientObj ? C.btnLight : (composerMenuOpen ? "rgba(0,0,0,0.04)" : "transparent"),
                              cursor: "pointer", fontFamily: "inherit", flexShrink: 0,
                              fontWeight: selectedClientObj ? 600 : 500,
                              transition: "background 120ms ease, color 120ms ease",
                            }}
                            onMouseEnter={e => { if (!selectedClientObj && !composerMenuOpen) e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
                            onMouseLeave={e => { if (!selectedClientObj && !composerMenuOpen) e.currentTarget.style.background = "transparent"; }}
                          >
                            {selectedClientObj ? (
                              <>
                                <ClientAvatar client={selectedClientObj} size={20} />
                                <span className="rt-composer-client-name" style={{ paddingRight: 4 }}>{selectedClientObj.name}</span>
                              </>
                            ) : (
                              <>
                                <Icon name="clients" size={12} />
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
                                border: "1px solid " + C.borderLight,
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
                            className="rt-composer-pill"
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 5,
                              padding: "0 10px",
                              height: 28,
                              border: "none",
                              borderRadius: 7,
                              fontSize: 12,
                              color: selectedWorker ? C.btn : C.textSec,
                              background: selectedWorker ? C.btnLight : (workerPickerOpen ? "rgba(0,0,0,0.04)" : "transparent"),
                              cursor: "pointer", fontFamily: "inherit",
                              fontWeight: selectedWorker ? 600 : 500,
                              transition: "background 120ms ease, color 120ms ease",
                            }}
                            onMouseEnter={e => { if (!selectedWorker && !workerPickerOpen) e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
                            onMouseLeave={e => { if (!selectedWorker && !workerPickerOpen) e.currentTarget.style.background = "transparent"; }}
                            title={selectedWorker ? `Assigned to ${selectedWorker.name}` : "Assign to a worker"}
                          >
                            <Icon name="clients" size={12} color={selectedWorker ? C.btn : C.textMuted} />
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
                                border: "1px solid " + C.borderLight,
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
                                border: "1px solid " + C.border,
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
                                    background: !newTaskWorkerId ? C.btnLight : "transparent",
                                    border: "none", borderRadius: 6,
                                    cursor: "pointer", fontFamily: "inherit",
                                    textAlign: "left",
                                  }}
                                  onMouseEnter={e => { if (newTaskWorkerId) e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
                                  onMouseLeave={e => { if (newTaskWorkerId) e.currentTarget.style.background = "transparent"; }}
                                >
                                  <div style={{ width: 22, height: 22, borderRadius: 11, background: C.borderLight, display: "grid", placeItems: "center", flexShrink: 0 }}>
                                    <Icon name="clients" size={12} color={C.textMuted} />
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: !newTaskWorkerId ? 600 : 500, color: !newTaskWorkerId ? C.btn : C.text }}>Just me</div>
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
                                      background: newTaskWorkerId === w.id ? C.btnLight : "transparent",
                                      border: "none", borderRadius: 6,
                                      cursor: "pointer", fontFamily: "inherit",
                                      textAlign: "left",
                                    }}
                                    onMouseEnter={e => { if (newTaskWorkerId !== w.id) e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
                                    onMouseLeave={e => { if (newTaskWorkerId !== w.id) e.currentTarget.style.background = "transparent"; }}
                                  >
                                    <div style={{ width: 22, height: 22, borderRadius: 11, background: C.primary, color: "#fff", fontSize: 9, fontWeight: 700, display: "grid", placeItems: "center", flexShrink: 0 }}>
                                      {w.name.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase()}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: 13, fontWeight: newTaskWorkerId === w.id ? 600 : 500, color: newTaskWorkerId === w.id ? C.btn : C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.name}</div>
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
                        className="rt-composer-pill"
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "0 10px",
                          height: 28,
                          border: "none",
                          borderRadius: 7,
                          fontSize: 12,
                          color: (newTaskDueDate || newTaskRecurring) ? C.btn : C.textSec,
                          background: (newTaskDueDate || newTaskRecurring) ? C.btnLight : (duePickerOpen ? "rgba(0,0,0,0.04)" : "transparent"),
                          cursor: "pointer", fontFamily: "inherit",
                          fontWeight: (newTaskDueDate || newTaskRecurring) ? 600 : 500,
                          transition: "background 120ms ease, color 120ms ease",
                        }}
                        onMouseEnter={e => { if (!newTaskDueDate && !newTaskRecurring && !duePickerOpen) e.currentTarget.style.background = "rgba(0,0,0,0.04)"; }}
                        onMouseLeave={e => { if (!newTaskDueDate && !newTaskRecurring && !duePickerOpen) e.currentTarget.style.background = "transparent"; }}
                      >
                        <Icon name={newTaskRecurring ? "infinity" : "calendar"} size={newTaskRecurring ? 14 : 12} color={(newTaskDueDate || newTaskRecurring) ? C.btn : C.textMuted} />
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
                            border: "1px solid " + C.borderLight,
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
                        <div style={{
                          position: "absolute",
                          top: "calc(100% + 6px)",
                          right: 0,
                          background: C.card,
                          border: "1px solid " + C.border,
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
                                        background: isSel ? C.btnLight : "transparent",
                                        border: "none",
                                        borderRadius: 6,
                                        fontSize: 13,
                                        color: isSel ? C.btn : C.text,
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
                                                background: isSel ? C.btn : "transparent",
                                                color: isSel ? "#fff" : (isToday ? C.btn : C.text),
                                                borderRadius: 4,
                                                fontSize: 11,
                                                fontWeight: isToday || isSel ? 700 : 500,
                                                cursor: "pointer",
                                                fontFamily: "inherit",
                                                padding: 0,
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
                                    {/* Frequency chips */}
                                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
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
                                            onClick={() => {
                                              if (opt.key === "daily") setNewTaskRecurrencePattern({ kind: "daily" });
                                              else if (opt.key === "weekdays") setNewTaskRecurrencePattern({ kind: "weekdays" });
                                              else if (opt.key === "weekly") setNewTaskRecurrencePattern({ kind: "weekly", days: [(_now.getDay())] });
                                              else if (opt.key === "monthly_date") setNewTaskRecurrencePattern({ kind: "monthly_date", day: _now.getDate() });
                                            }}
                                            style={{
                                              padding: "5px 10px",
                                              background: isSel ? C.btnLight : "transparent",
                                              color: isSel ? C.btn : C.textSec,
                                              border: "1px solid " + (isSel ? C.btn : C.borderLight),
                                              borderRadius: 7,
                                              fontSize: 11.5,
                                              fontWeight: 600,
                                              cursor: "pointer",
                                              fontFamily: "inherit",
                                            }}
                                          >
                                            {opt.label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    {/* Weekly: day-of-week multi-select */}
                                    {newTaskRecurrencePattern.kind === "weekly" && (
                                      <div style={{ display: "flex", gap: 3 }}>
                                        {["S", "M", "T", "W", "T", "F", "S"].map((label, dow) => {
                                          const days = newTaskRecurrencePattern.days || [];
                                          const isSel = days.includes(dow);
                                          return (
                                            <button
                                              key={dow}
                                              onClick={() => {
                                                const newDays = isSel
                                                  ? days.filter(d => d !== dow)
                                                  : [...days, dow];
                                                if (newDays.length === 0) return; // require at least one
                                                setNewTaskRecurrencePattern({ kind: "weekly", days: newDays });
                                              }}
                                              style={{
                                                width: 26, height: 26,
                                                background: isSel ? C.btn : "transparent",
                                                color: isSel ? "#fff" : C.textSec,
                                                border: "1px solid " + (isSel ? C.btn : C.borderLight),
                                                borderRadius: 13,
                                                fontSize: 11,
                                                fontWeight: 700,
                                                cursor: "pointer",
                                                fontFamily: "inherit",
                                                padding: 0,
                                              }}
                                            >{label}</button>
                                          );
                                        })}
                                      </div>
                                    )}
                                    {/* Monthly: date OR weekday-of-month */}
                                    {(newTaskRecurrencePattern.kind === "monthly_date" || newTaskRecurrencePattern.kind === "monthly_weekday") && (
                                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        <div style={{ display: "flex", gap: 4 }}>
                                          <button
                                            onClick={() => setNewTaskRecurrencePattern({ kind: "monthly_date", day: _now.getDate() })}
                                            style={{
                                              flex: 1, padding: "5px 8px",
                                              background: newTaskRecurrencePattern.kind === "monthly_date" ? C.btnLight : "transparent",
                                              color: newTaskRecurrencePattern.kind === "monthly_date" ? C.btn : C.textSec,
                                              border: "1px solid " + (newTaskRecurrencePattern.kind === "monthly_date" ? C.btn : C.borderLight),
                                              borderRadius: 6, fontSize: 10.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                                            }}
                                          >Date of month</button>
                                          <button
                                            onClick={() => {
                                              const week = Math.ceil(_now.getDate() / 7);
                                              setNewTaskRecurrencePattern({ kind: "monthly_weekday", week, day: _now.getDay() });
                                            }}
                                            style={{
                                              flex: 1, padding: "5px 8px",
                                              background: newTaskRecurrencePattern.kind === "monthly_weekday" ? C.btnLight : "transparent",
                                              color: newTaskRecurrencePattern.kind === "monthly_weekday" ? C.btn : C.textSec,
                                              border: "1px solid " + (newTaskRecurrencePattern.kind === "monthly_weekday" ? C.btn : C.borderLight),
                                              borderRadius: 6, fontSize: 10.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                                            }}
                                          >Day of week</button>
                                        </div>
                                        {newTaskRecurrencePattern.kind === "monthly_date" && (
                                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.textSec }}>
                                            On the
                                            <select
                                              value={newTaskRecurrencePattern.day}
                                              onChange={e => setNewTaskRecurrencePattern({ kind: "monthly_date", day: parseInt(e.target.value, 10) })}
                                              style={{ padding: "3px 6px", borderRadius: 5, border: "1px solid " + C.borderLight, fontSize: 12, fontFamily: "inherit", background: C.card, color: C.text }}
                                            >
                                              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
                                            </select>
                                            of each month
                                          </div>
                                        )}
                                        {newTaskRecurrencePattern.kind === "monthly_weekday" && (
                                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.textSec, flexWrap: "wrap" }}>
                                            The
                                            <select
                                              value={newTaskRecurrencePattern.week}
                                              onChange={e => setNewTaskRecurrencePattern(p => ({ ...p, week: parseInt(e.target.value, 10) }))}
                                              style={{ padding: "3px 6px", borderRadius: 5, border: "1px solid " + C.borderLight, fontSize: 12, fontFamily: "inherit", background: C.card, color: C.text }}
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
                                              style={{ padding: "3px 6px", borderRadius: 5, border: "1px solid " + C.borderLight, fontSize: 12, fontFamily: "inherit", background: C.card, color: C.text }}
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
                                    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                                      <button
                                        onClick={() => { setNewTaskRecurring(false); setNewTaskRecurrencePattern({ kind: "daily" }); }}
                                        style={{ padding: "5px 10px", background: "transparent", color: C.textMuted, border: "1px solid " + C.borderLight, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                                      >Cancel</button>
                                      <button
                                        onClick={() => setDuePickerOpen(false)}
                                        style={{ padding: "5px 12px", background: C.btn, color: "#fff", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginLeft: "auto" }}
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
                        padding: newTask.trim() ? "0 8px 0 14px" : "0 14px",
                        height: 28,
                        background: newTask.trim() ? C.btn : "#DBD0EF",
                        color: "#fff",
                        borderRadius: 7,
                        fontSize: 12,
                        fontWeight: 600,
                        border: "none",
                        cursor: newTask.trim() ? "pointer" : "default",
                        fontFamily: "inherit",
                        marginLeft: "auto",
                        flexShrink: 0,
                        boxShadow: newTask.trim()
                          ? "0 1px 2px rgba(91,33,182,0.20), 0 4px 12px rgba(91,33,182,0.18)"
                          : "none",
                        transition: "transform 200ms cubic-bezier(.2,.7,.3,1), box-shadow 200ms ease, background 200ms ease, padding 200ms ease",
                      }}
                      onMouseEnter={e => {
                        if (newTask.trim()) {
                          e.currentTarget.style.background = C.btnHover;
                          e.currentTarget.style.transform = "translateY(-1px)";
                        }
                      }}
                      onMouseLeave={e => {
                        if (newTask.trim()) {
                          e.currentTarget.style.background = C.btn;
                          e.currentTarget.style.transform = "translateY(0)";
                        }
                      }}
                    >
                      Add Task
                      {newTask.trim() && (
                        <span style={{
                          background: "rgba(255,255,255,0.20)",
                          padding: "1px 6px",
                          borderRadius: 4,
                          fontSize: 10.5,
                          fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
                          lineHeight: 1.3,
                        }}>⏎</span>
                      )}
                    </button>
                  </div>
                </div>

                {composerMenuOpen && (
                  <>
                    {/* Click-outside backdrop — invisible but captures clicks anywhere on the page */}
                    <div
                      onClick={() => { setComposerMenuOpen(false); setComposerQuery(""); }}
                      style={{ position: "fixed", inset: 0, zIndex: 29, background: "transparent" }}
                    />
                    <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 16, width: 300, background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: "0 12px 32px rgba(10,10,10,0.12)", zIndex: 30, padding: 6 }}>
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
                      <button onClick={() => { setComposerMenuOpen(false); setComposerQuery(""); }} style={{ padding: 2, background: "none", border: "none", cursor: "pointer", color: C.textMuted, display: "flex", alignItems: "center" }}><Icon name="x" size={14} /></button>
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
                            background: idx === composerHighlight ? C.btnLight : "none",
                            border: "none", cursor: "pointer", fontFamily: "inherit",
                          }}>
                          <ClientAvatar client={c} size={22} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: idx === composerHighlight ? 600 : 500, color: idx === composerHighlight ? C.btn : C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
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

              {/* TASKS COLUMN */}
              <div className="rt-tasks-col" data-focus-keep style={{ gridArea: "tasks", minWidth: 0 }}>
                  <div className="rt-toolbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 4px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {/* Ranked by Rai / Manual toggle — pill segmented control */}
                      <div style={{ display: "inline-flex", background: C.surface, borderRadius: 999, padding: 3, gap: 0 }}>
                        <button
                          onClick={() => setRankMode("rai")}
                          style={{
                            padding: "6px 14px",
                            borderRadius: 999,
                            border: "none",
                            background: rankMode === "rai" ? C.card : "transparent",
                            fontFamily: "inherit",
                            fontSize: 12,
                            fontWeight: 600,
                            color: rankMode === "rai" ? C.btn : C.textSec,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            boxShadow: rankMode === "rai" ? C.shadowSm : "none",
                            transition: "background 120ms"
                          }}
                        >
                          <span style={{}}>Ranked by Rai</span>
                        </button>
                        <button
                          onClick={() => setRankMode("manual")}
                          style={{
                            padding: "6px 14px",
                            borderRadius: 999,
                            border: "none",
                            background: rankMode === "manual" ? C.card : "transparent",
                            fontFamily: "inherit",
                            fontSize: 12,
                            fontWeight: 600,
                            color: rankMode === "manual" ? C.text : C.textSec,
                            cursor: "pointer",
                            boxShadow: rankMode === "manual" ? C.shadowSm : "none",
                            transition: "background 120ms"
                          }}
                        >
                          Manual
                        </button>
                      </div>
                      {/* Focus mode button — only enabled in Rai mode */}
                      {rankMode === "rai" && (
                        <button
                          onClick={() => {
                            const next = !focusMode;
                            setFocusMode(next);
                            if (next) {
                              setFocusFlash(true);
                              setTimeout(() => setFocusFlash(false), 900);
                            }
                          }}
                          style={{
                            position: "relative",
                            overflow: "hidden",
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "6px 14px",
                            borderRadius: 999,
                            background: focusMode ? C.primaryDeep : "transparent",
                            border: focusMode ? "1px solid " + C.primaryDeep : "1px solid " + C.ink300,
                            color: focusMode ? "#fff" : C.textSec,
                            fontSize: 12,
                            fontWeight: 600,
                            fontFamily: "inherit",
                            cursor: "pointer",
                            boxShadow: focusMode ? "0 1px 2px rgba(28,50,36,0.18), 0 2px 6px rgba(28,50,36,0.22)" : "none",
                            transition: "background 120ms, color 120ms, border-color 120ms"
                          }}
                        >
                          {/* Background bolt watermark — V4 fill style, offset +15% right of center */}
                          <span aria-hidden="true" className="rt-focus-bolt" style={{
                            position: "absolute",
                            top: "50%",
                            left: "65%",
                            transform: "translate(-50%, -50%)",
                            color: focusMode ? "rgba(251,181,64,0.18)" : "rgba(251,181,64,0.10)",
                            zIndex: 1,
                            pointerEvents: "none",
                            lineHeight: 1,
                          }}>⚡</span>
                          <span style={{ position: "relative", zIndex: 2 }}>
                            {focusMode ? "Focusing" : "Focus"}
                          </span>
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

                  {/* Mobile-only expanded calendar sheet (toggled by trigger above) */}
                  {todayStripOpen && (
                    <div className="rt-mob-cal-sheet" style={{ display: "none", marginBottom: 12, background: C.card, border: "1px solid " + C.borderLight, borderRadius: 10, padding: "14px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                          <div style={{ width: 26, height: 26, borderRadius: 7, background: C.primaryGhost, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Icon name="calendar" size={13} color={C.primary} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 0.3, textTransform: "uppercase", fontWeight: 700 }}>Today's calendar</div>
                            <span
                              className="rt-task-title is-discussable"
                              onClick={() => setPage("settings")}
                              style={{ fontSize: 12, color: C.textSec, marginTop: 1, display: "inline-block", cursor: "pointer" }}
                            >
                              Connect to activate
                            </span>
                          </div>
                        </div>
                      </div>
                      <div style={{ marginTop: 4 }}>
                        {(() => {
                          const events = [
                            { time: "2:30pm", title: "Backyard Discovery sync" },
                            { time: "4:00pm", title: "Motley Fool review" },
                            { time: "5:30pm", title: "Internal — weekly planning" },
                          ];
                          return events.map((e, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderTop: "1px solid " + C.borderLight }}>
                              <span style={{ fontSize: 11.5, color: C.textMuted, fontVariantNumeric: "tabular-nums", fontWeight: 500, width: 48, flexShrink: 0 }}>{e.time}</span>
                              <span style={{ fontSize: 13, color: C.text, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</span>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  )}

                  {dataLoaded && openTasks.length === 0 && completedTasks.length === 0 && (
                    <div style={{ padding: "28px 4px 20px", borderTop: "1px solid " + C.borderLight }}>
                      <div style={{
                        fontFamily: "'Fraunces', Georgia, serif",
                        fontVariationSettings: "'opsz' 96, 'SOFT' 50, 'WONK' 0",
                        fontStyle: "italic",
                        fontWeight: 400,
                        fontSize: 15,
                        color: C.textMuted,
                      }}>
                        No tasks for today.
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
                        const cls = "rt-row" + (isDone ? " is-done" : "") + (isJustDone ? " is-just-done" : "") + (isFocusTop ? " rt-focus-top" : "");
  
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

                        const handleTouchStart = (e) => {
                          if (e.touches.length !== 1) return;
                          setSwipeStartX(prev => ({ ...prev, [t.id]: e.touches[0].clientX }));
                          setSwipeOffset(prev => ({ ...prev, [t.id]: 0 }));
                        };
                        const handleTouchMove = (e) => {
                          const startX = swipeStartX[t.id];
                          if (startX == null) return;
                          const deltaX = e.touches[0].clientX - startX;
                          // Recurring tasks can be deleted (left swipe) but not pushed
                          // to another bucket (right swipe blocked — they have no due_date
                          // and the bucket concept doesn't apply).
                          const minDelta = t.recurring ? -SWIPE_MAX : -SWIPE_MAX;
                          const maxDelta = t.recurring ? 0 : SWIPE_MAX;
                          const clamped = Math.max(minDelta, Math.min(maxDelta, deltaX));
                          setSwipeOffset(prev => ({ ...prev, [t.id]: clamped }));
                        };
                        const handleTouchEnd = () => {
                          const off = swipeOffset[t.id] || 0;
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
                              border: isDragOver ? "1px solid " + C.btn : "1px solid " + C.borderSoft,
                              borderRadius: 12,
                              boxShadow: isDragOver ? "0 0 0 2px " + C.btnLight + ", " + C.shadowSm : C.shadowSm,
                              opacity: isDragging ? 0.4 : 1,
                              cursor: isManual ? "grab" : "default",
                              transform: offset !== 0 ? `translateX(${offset}px)` : undefined,
                              transition: swipeStartX[t.id] != null
                                ? "border-color 120ms, box-shadow 120ms, opacity 120ms"
                                : "border-color 120ms, box-shadow 120ms, opacity 120ms, transform 200ms ease",
                              touchAction: swipeable ? "pan-y" : "auto",
                              position: "relative",
                              zIndex: 2,
                            }}>
                            {isManual && (
                              <div
                                aria-hidden="true"
                                style={{
                                  color: C.textMuted,
                                  fontSize: 14,
                                  lineHeight: 1,
                                  letterSpacing: "-1px",
                                  userSelect: "none",
                                  flexShrink: 0,
                                  cursor: "grab",
                                  padding: "0 2px",
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
                                        title={`Talk this through with Rai`}
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
                                  return <span className="rt-task-title" style={{ display: "inline-block", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom" }}>{t.text}</span>;
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
                              const initials = w.name.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase();
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
                                  // Done = neutral grey, doesn't compete with the strikethrough on the title.
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
                                border: "1px solid " + C.borderLight,
                                background: "transparent",
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
                                  background: isOverdue ? "rgba(196,67,43,0.10)" : isToday ? C.surfaceWarm : "transparent",
                                  color: isOverdue ? C.danger : isToday ? C.text : C.textMuted,
                                  border: isOverdue || isToday ? "none" : "1px solid " + C.borderLight,
                                }}>
                                  <Icon name="calendar" size={10} color={isOverdue ? C.danger : isToday ? C.text : C.textMuted} />
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
                    const BucketHeader = ({ name, dimmed }) => (
                      <div className="rt-bucket-head" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "18px 4px 10px" }}>
                        <div style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, color: dimmed ? C.textMuted : C.text }}>{name}</div>
                      </div>
                    );


                    return (
                      <>
                        {/* TODAY bucket */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {_todayBucket.map(t => renderRow(t, "today"))}
                        </div>

                        {/* TOMORROW bucket */}
                        {_tomorrowBucket.length > 0 && (<>
                          <BucketHeader name="Tomorrow" dimmed={true} />
                          <div style={{ display: "flex", flexDirection: "column", gap: 8, opacity: 0.76 }}>
                            {_tomorrowBucket.map(t => renderRow(t, "tomorrow"))}
                          </div>
                        </>)}

                        {/* LATER bucket */}
                        {_laterBucket.length > 0 && (<>
                          <BucketHeader name="Later" dimmed={true} />
                          <div style={{ display: "flex", flexDirection: "column", gap: 8, opacity: 0.76 }}>
                            {_laterBucket.map(t => renderRow(t, "later"))}
                          </div>
                        </>)}

                        {/* COMPLETED TODAY log — sits at the bottom, below all
                            active buckets. Active work gets prime real estate;
                            completed work is reference, not action. Collapsed
                            by default; the line doubles as the toggle button. */}
                        {_collapsedDoneTasks.length > 0 && (
                          <div style={{ marginTop: 24 }}>
                            <button
                              onClick={() => setCompletedLogOpen(!completedLogOpen)}
                              style={{
                                width: "100%",
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                padding: "12px 14px",
                                background: "transparent",
                                border: "1px dashed " + C.border,
                                borderRadius: 10,
                                color: C.textSec,
                                fontSize: 13,
                                fontWeight: 500,
                                cursor: "pointer",
                                fontFamily: "inherit",
                                transition: "background 120ms ease",
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = C.surfaceWarm}
                              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                            >
                              <span>
                                <span style={{ color: C.textMuted, marginRight: 4 }}>{_collapsedDoneTasks.length}</span>
                                completed today
                              </span>
                              <svg
                                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                style={{ transform: completedLogOpen ? "rotate(90deg)" : "rotate(0)", transition: "transform 200ms ease" }}
                              >
                                <path d="M9 6l6 6-6 6" />
                              </svg>
                            </button>
                            <div
                              style={{
                                maxHeight: completedLogOpen ? 2000 : 0,
                                overflow: "hidden",
                                transition: "max-height 320ms ease",
                                marginTop: completedLogOpen ? 8 : 0,
                              }}
                            >
                              <div style={{ display: "flex", flexDirection: "column", gap: 6, opacity: 0.7 }}>
                                {_collapsedDoneTasks.map(t => renderRow(t, "today"))}
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {/* Completed section removed — done tasks now render inline above with strikethrough state. */}
                </div>

              {/* CALENDAR — right column on desktop (>900px). Mobile gets the strip instead. */}
              <div className="rt-focus-col" style={{ gridArea: "focus", display: "flex", flexDirection: "column", position: "sticky", top: 20 }}>
                <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: C.shadowSm, padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <div style={{ width: 26, height: 26, borderRadius: 7, background: C.primaryGhost, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon name="calendar" size={13} color={C.primary} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 0.3, textTransform: "uppercase", fontWeight: 700 }}>Today's calendar</div>
                        <span
                          className="rt-task-title is-discussable"
                          onClick={() => setPage("settings")}
                          style={{ fontSize: 12, color: C.textSec, marginTop: 1, display: "inline-block", cursor: "pointer" }}
                        >
                          Connect to activate
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ opacity: 0.55 }}>
                    {[
                      { time: "2:30pm", title: "Backyard Discovery sync" },
                      { time: "4:00pm", title: "Motley Fool review" },
                      { time: "5:30pm", title: "Internal — weekly planning" },
                    ].map((e, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderTop: "1px solid " + C.borderLight }}>
                        <span style={{ fontSize: 11.5, color: C.textMuted, fontVariantNumeric: "tabular-nums", fontWeight: 500, width: 56, flexShrink: 0 }}>{e.time}</span>
                        <span style={{ fontSize: 13, color: C.text, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</span>
                      </div>
                    ))}
                  </div>
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
            <div style={{ background: C.card, borderRadius: 14, border: "1px solid " + C.border, overflow: "hidden" }}>
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
              <div key={t.id} style={{ background: C.card, borderRadius: 12, border: "1px solid " + C.border, padding: "14px 16px", marginBottom: 8 }}>
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
            <div style={{ background: C.card, borderRadius: 14, border: "1px solid " + C.border, overflow: "hidden" }}>
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

          const V2Sparkline = ({ points, width = 72, height = 22, stroke, fill, showEnd = false }) => {
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
            return (
              <svg width={width} height={height} style={{ display: "block" }}>
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
            { id: "heatmap", label: "Heatmap", icon: "health" },
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
                    <button onClick={() => { setShowImport(!showImport); setShowAddClient(false); }} style={{ padding: "8px 14px", background: "transparent", color: C.primary, border: "1px solid " + C.primary + "44", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Import Clients</button>
                  )}
                  <button className="r-btn" onClick={() => { setShowAddClient(true); setShowImport(false); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", background: C.btn, color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 1px 2px rgba(91,33,182,0.15), 0 2px 6px rgba(91,33,182,0.22)", whiteSpace: "nowrap" }}>
                    Add client
                  </button>
                </div>
              </div>

              {/* MAIN GRID: rail + main + rai (rai shows on >=1440px) */}
              <div className="rc-grid" style={{ display: "grid", gap: 20, alignItems: "start" }}>

                {/* LEFT RAIL — Portfolio, Book history, Recent movement (3 separate cards) */}
                <div className="rc-rail" style={{ position: "sticky", top: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* Card 1: Portfolio */}
                  <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: C.shadowSm, padding: "14px" }}>
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
                  <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: C.shadowSm, padding: "14px" }}>
                    <div style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 10 }}>Book history</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 19, fontWeight: 700, color: C.text, letterSpacing: -0.3, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                          ${(activeClients.reduce((a, c) => a + (c.revenue || 0) * (c.months || 1), 0) / 1000000).toFixed(1)}M
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
                  <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: C.shadowSm, padding: "14px" }}>
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
                      style={{ width: "100%", padding: "12px 14px", border: "1.5px solid " + C.border, borderRadius: 8, fontSize: 14, fontFamily: "monospace", outline: "none", background: C.bg, resize: "vertical", lineHeight: 1.6 }}
                    />
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 6 }}>Paste rows from Excel or Google Sheets. Tab or comma-separated. First 3 columns required.</div>
                  </div>
                )}

                {/* Preview Table */}
                {importPreview.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Preview ({importPreview.filter(r => r.valid).length} valid of {importPreview.length})</div>
                    <div style={{ background: C.bg, borderRadius: 10, border: "1px solid " + C.border, overflow: "hidden" }}>
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
                    <button className="r-btn" onClick={() => {
                      const newClients = importPreview.filter(r => r.valid).map(r => ({
                        id: Date.now() + Math.random(),
                        name: r.name,
                        contact: r.contact,
                        role: r.role || "—",
                        tag: r.tag || "—",
                        months: r.months || 0,
                        revenue: r.revenue || 0,
                        velocity: "normal",
                        lastHC: null,
                        lastContact: "—",
                        ret: 0,
                        referrals: 0,
                      }));
                      setClients(prev => [...prev, ...newClients]);
                      setShowImport(false);
                      setImportPreview([]);
                      setImportPaste("");
                      setImportFile(null);
                    }} style={{ flex: 1, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Import {importPreview.filter(r => r.valid).length} Client{importPreview.filter(r => r.valid).length > 1 ? "s" : ""}</button>
                    <button onClick={() => { setShowImport(false); setImportPreview([]); setImportPaste(""); setImportFile(null); }} style={{ padding: "10px 16px", background: C.surface, color: C.textMuted, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                  </div>
                )}
              </div>
            )}

            {showAddClient && (
              <div style={{ background: C.card, borderRadius: 14, border: "2px solid " + C.primary, padding: "20px", marginBottom: 16, boxShadow: C.cardShadow }}>
                {profileStep === 0 && (
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>New Client</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <input value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} placeholder="Company name" style={{ padding: "12px 16px", border: "1.5px solid " + C.border, borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none" }} />
                      <input value={newClient.contact} onChange={e => setNewClient({...newClient, contact: e.target.value})} placeholder="Primary contact name" style={{ padding: "12px 16px", border: "1.5px solid " + C.border, borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none" }} />
                      <input value={newClient.role} onChange={e => setNewClient({...newClient, role: e.target.value})} placeholder="Their role" style={{ padding: "12px 16px", border: "1.5px solid " + C.border, borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none" }} />
                      <input value={newClient.tag} onChange={e => setNewClient({...newClient, tag: e.target.value})} placeholder="Industry (e.g. Fitness, Real Estate)" style={{ width: "100%", padding: "12px 16px", border: "1.5px solid " + C.border, borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none" }} />
                      <input value={newClient.months} onChange={e => setNewClient({...newClient, months: e.target.value})} placeholder="Months working together" type="number" style={{ width: "100%", padding: "12px 16px", border: "1.5px solid " + C.border, borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none" }} />
                      <input value={newClient.revenue} onChange={e => setNewClient({...newClient, revenue: e.target.value})} placeholder="Estimated monthly revenue ($)" type="number" style={{ padding: "12px 16px", border: "1.5px solid " + C.border, borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none" }} />
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                      <button className="r-btn" onClick={() => { if (newClient.name && newClient.contact) setProfileStep(1); }} style={{ flex: 1, padding: "10px", background: newClient.name && newClient.contact ? C.btn : C.surface, color: newClient.name && newClient.contact ? "#fff" : C.textMuted, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: newClient.name && newClient.contact ? "pointer" : "default", fontFamily: "inherit" }}>Next: Relationship Profile</button>
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
                            <button className="r-btn" onClick={() => { if (current !== undefined && current !== null) { profileStep < 12 ? setProfileStep(profileStep + 1) : setProfileStep(13); } }} style={{ flex: 1, padding: "8px", background: current !== undefined && current !== null ? C.btn : C.surface, color: current !== undefined && current !== null ? "#fff" : C.textMuted, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: current !== undefined && current !== null ? "pointer" : "default", fontFamily: "inherit" }}>{profileStep < 12 ? "Next" : "Review"}</button>
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
                      <button className="r-btn" onClick={submitNewClient} style={{ flex: 1, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Add Client</button>
                    </div>
                    <div style={{ fontSize: 10.5, color: C.textMuted, lineHeight: 1.45, marginTop: 10, textAlign: "center" }}>
                      By adding this client, you confirm you have the right to process their information for client management purposes.
                    </div>
                  </div>
                )}
              </div>
            )}


                  {/* Toolbar: search + sort + view toggle */}
                  <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: C.shadowSm, padding: "10px 14px", marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Icon name="search" size={14} color={C.textMuted} />
                      <input value={clientSearch} onChange={e => setClientSearch(e.target.value)} placeholder="Search clients, owners, industries…" style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 14, padding: "2px 0", fontFamily: "inherit", color: C.text }} />
                      {clientSearch && <button onClick={() => setClientSearch("")} style={{ width: 22, height: 22, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: C.textMuted, background: "none", border: "none", cursor: "pointer" }}><Icon name="x" size={11} /></button>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, paddingTop: 10, borderTop: "1px solid " + C.borderLight, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", marginRight: 2 }}>Sort</span>
                        {sortOptions.map(s => (
                          <button key={s.id} onClick={() => setClientsSort(s.id)} className={s.id === "cadence" ? "rc-sort-cadence" : s.id === "renewal" ? "rc-sort-renewal" : ""} style={{
                            padding: "4px 10px", fontSize: 11.5, borderRadius: 999, fontWeight: sortId === s.id ? 600 : 500, cursor: "pointer", fontFamily: "inherit",
                            background: sortId === s.id ? C.deepCream : "transparent",
                            color: sortId === s.id ? C.text : C.textMuted,
                            border: "1px solid " + (sortId === s.id ? C.deepCream : C.borderLight),
                          }}>{s.label}</button>
                        ))}
                      </div>
                      <div className="rc-view-toggle" style={{ display: "inline-flex", gap: 2, padding: 2, background: C.bg, border: "1px solid " + C.border, borderRadius: 8 }}>
                        {viewOptions.map(v => (
                          <button key={v.id} onClick={() => setClientsView(v.id)} title={v.label} style={{
                            display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
                            background: variant === v.id ? C.card : "transparent",
                            color: variant === v.id ? C.text : C.textMuted,
                            boxShadow: variant === v.id ? C.shadowSm : "none",
                            border: "none",
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
                  <div className="rc-mobile-list" style={{ display: "none", flexDirection: "column", background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: C.shadowSm, overflow: "hidden" }}>
                    {filteredClients.map((c, i, arr) => {
                      const delta = stubDelta(c.name);
                      const scoreColor = retColor(c.ret || 0);
                      const months = c.months || 0;
                      const tenureDisplay = months < 12 ? `${months}mo` : `${(months / 12).toFixed(1)}yr`;
                      return (
                        <div key={c.id} onClick={() => { setSelectedClient(c); setRolodexConfirm(false); setRemoveConfirm(false); }} style={{ padding: "12px 14px", borderBottom: i < arr.length - 1 ? "1px solid " + C.borderLight : "none", cursor: "pointer" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <ScoreRing2 client={c} size={32} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: -0.1 }}>{c.name}</div>
                              <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {(c.tag || "Client")} · ${((c.revenue || 0) / 1000).toFixed(1)}k/mo · {tenureDisplay}
                              </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0, gap: 2 }}>
                              <div style={{ fontSize: 16, fontWeight: 700, color: scoreColor, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{c.ret || 0}</div>
                              {delta !== 0 && (
                                <div style={{ fontSize: 10.5, fontWeight: 600, color: delta > 0 ? C.retGood : C.retWarn, fontVariantNumeric: "tabular-nums" }}>
                                  {delta > 0 ? "↑" : "↓"} {Math.abs(delta)}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {variant === "table" && (
                    <div className="rc-desktop-view" style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: C.shadowSm, overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderBottom: "1px solid " + C.borderLight, background: C.bg }}>
                        <div style={{ width: 32, fontSize: 10.5, fontWeight: 700, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase" }} />
                        <div style={{ flex: 1.4, fontSize: 10.5, fontWeight: 700, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase" }}>Client</div>
                        <div style={{ width: 56, textAlign: "center", fontSize: 10.5, fontWeight: 700, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase" }}>Health</div>
                        <div style={{ width: 78, fontSize: 10.5, fontWeight: 700, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase" }}>Revenue</div>
                        <div style={{ width: 64, fontSize: 10.5, fontWeight: 700, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase" }}>Tenure</div>
                        <div style={{ width: 74, fontSize: 10.5, fontWeight: 700, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase" }}>LCV</div>
                        <div style={{ width: 88, fontSize: 10.5, fontWeight: 700, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase" }}>12-wk trend</div>
                        <div style={{ width: 92, fontSize: 10.5, fontWeight: 700, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase" }}>Cadence</div>
                        <div style={{ width: 64, textAlign: "right", fontSize: 10.5, fontWeight: 700, color: C.textMuted, letterSpacing: 0.4, textTransform: "uppercase" }}>Renews</div>
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
                            <div key={c.id} className="row-hover" onClick={() => { setSelectedClient(c); setRolodexConfirm(false); setRemoveConfirm(false); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderBottom: i < arr.length - 1 ? "1px solid " + C.borderLight : "none", cursor: "pointer" }}>
                              <div style={{ width: 32, display: "flex", alignItems: "center" }}>
                                <ScoreRing2 client={c} size={28} />
                              </div>
                              <div style={{ flex: 1.4, minWidth: 0 }}>
                                <div style={{ fontSize: 13.5, fontWeight: 500, color: C.text, letterSpacing: -0.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{c.tag || "Client"} · last {c.lastContact || "—"}</div>
                              </div>
                              <div style={{ width: 56, display: "flex", justifyContent: "center", alignItems: "baseline", gap: 3 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: retColor(c.ret || 0), fontVariantNumeric: "tabular-nums" }}>{c.ret || 0}</span>
                                {delta !== 0 && (
                                  <span style={{ fontSize: 10, fontWeight: 500, color: delta > 0 ? C.retGood : C.retWarn }}>
                                    {delta > 0 ? "+" : ""}{delta}
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
                              <div style={{ width: 74 }}>
                                {(() => {
                                  const lcv = (c.revenue || 0) * (c.months || 0);
                                  const display = lcv >= 1000000 ? `$${(lcv / 1000000).toFixed(1)}M` : lcv >= 1000 ? `$${Math.round(lcv / 1000)}k` : `$${lcv}`;
                                  return <div style={{ fontSize: 13, fontWeight: 500, color: C.text, fontVariantNumeric: "tabular-nums" }}>{display}</div>;
                                })()}
                              </div>
                              <div style={{ width: 88, display: "flex", alignItems: "center", gap: 6 }}>
                                <V2Sparkline points={trend} width={50} height={20} />
                                <span style={{ fontSize: 11, fontWeight: 700, color: pct >= 1 ? C.retGood : pct <= -1 ? C.retWarn : C.textMuted, fontVariantNumeric: "tabular-nums" }}>
                                  {pct >= 0 ? "+" : ""}{pct.toFixed(0)}%
                                </span>
                              </div>
                              <div style={{ width: 92 }}>
                                <CadencePips target={ct} actual={ca} showLabel />
                              </div>
                              <div style={{ width: 64, textAlign: "right" }}>
                                <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums", color: renewUrgent ? C.retWarn : C.textSec, fontWeight: renewUrgent ? 700 : 500 }}>{renewStr}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {variant === "columns" && (
                    <div className="rc-desktop-view" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, alignItems: "flex-start" }}>
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
                          <div key={s.id} style={{ background: s.bg, border: "1px solid " + s.color + "22", borderRadius: 12, padding: 10, display: "flex", flexDirection: "column", gap: 8, minHeight: 200 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 6px 8px", borderBottom: "1px solid " + C.borderLight }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ width: 8, height: 8, borderRadius: 4, background: s.color }} />
                                <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text, letterSpacing: -0.1 }}>{s.label}</span>
                                <span style={{ fontSize: 11, color: C.textMuted, fontVariantNumeric: "tabular-nums" }}>{col.length}</span>
                              </div>
                              <div style={{ fontSize: 11, color: C.textMuted, fontVariantNumeric: "tabular-nums" }}>${(mrr/1000).toFixed(1)}k</div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              {col.map(c => {
                                const trend = stubTrend(c);
                                const trendStart = trend[0], trendEnd = trend[trend.length - 1];
                                const pct = ((trendEnd - trendStart) / Math.max(1, trendStart)) * 100;
                                const owner = stubOwner(c.name);
                                const ct = stubCadenceTarget(c);
                                const ca = stubCadenceActual(c);
                                const delta = stubDelta(c.name);
                                return (
                                  <div key={c.id} className="row-hover" onClick={() => setSelectedClient(c)} style={{ background: C.card, border: "1px solid " + C.borderLight, borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 8, cursor: "pointer" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                      <ScoreRing2 client={c} size={32} />
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 500, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: -0.1 }}>{c.name}</div>
                                        <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 1 }}>{c.tag || "Client"} · renews {stubRenewal(c)}</div>
                                      </div>
                                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                                        <div style={{ fontSize: 12.5, fontWeight: 700, color: retColor(c.ret || 0), fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                                          {c.ret || 0}{delta !== 0 && <span style={{ fontSize: 9.5, marginLeft: 3, color: delta > 0 ? C.retGood : C.retWarn }}>{delta > 0 ? "+" : ""}{delta}</span>}
                                        </div>
                                      </div>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                      <OwnerChip owner={owner.name} color={owner.color} size="sm" showLabel firstOnly />
                                      <CadencePips target={ct} actual={ca} />
                                    </div>
                                    <div style={{ position: "relative", background: C.bg, border: "1px solid " + C.borderLight, borderRadius: 6, padding: "4px 6px" }}>
                                      <V2Sparkline points={trend} width={156} height={28} fill />
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
                  )}

                  {variant === "heatmap" && (
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
                          <div key={c.id} className="row-hover" onClick={() => setSelectedClient(c)} style={{ position: "relative", background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: C.shadowSm, padding: 12, paddingLeft: 14, overflow: "hidden", cursor: "pointer" }}>
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
                            <div style={{ position: "relative", background: C.primaryGhost, border: "1px solid " + C.borderLight, borderRadius: 6, padding: "4px 6px", marginBottom: 10, overflow: "hidden" }}>
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

                  {filteredClients.length === 0 && (
                    <div style={{ textAlign: "center", padding: "40px 20px", background: C.primaryGhost, border: "1px dashed " + C.border, borderRadius: 14 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>No clients match.</div>
                      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>Try clearing the search or switching sort.</div>
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
              await clientsDb.updateDrift(clientObj.id, drift, new Date().toISOString().split("T")[0]);
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
                <div style={{ flexShrink: 0, textAlign: "right", minWidth: 140 }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end", gap: 8 }}>
                    <span style={{ fontSize: 26, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums", letterSpacing: -0.3 }}>
                      {pctChecked}<span style={{ fontSize: 15, color: C.textMuted, fontWeight: 500 }}>%</span>
                    </span>
                    <span style={{ fontSize: 11, color: C.textMuted, letterSpacing: 0.3, textTransform: "uppercase", fontWeight: 600 }}>checked</span>
                  </div>
                  <div style={{ height: 4, background: C.borderLight, borderRadius: 2, marginTop: 8, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pctChecked}%`, background: `linear-gradient(90deg, ${C.primaryLight}, ${C.primary})`, borderRadius: 2, transition: "width 400ms cubic-bezier(.2,.7,.3,1)" }} />
                  </div>
                </div>
              </div>

                  {/* ═══════════════════════════════════════════════════════════════
                      OBSERVER CARD — single dark green panel, no flip.
                      Top bar: card name + observation number/week/date.
                      Headline + body, then divider, then metric strip + actions.
                  ═══════════════════════════════════════════════════════════════ */}
                  {observation && !obsDismissing && (() => {
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
                        <div style={{
                          background: C.card,
                          color: C.text,
                          borderRadius: 14,
                          border: "1px solid " + C.border,
                          padding: "24px 28px 22px",
                          position: "relative",
                          overflow: "hidden",
                          boxShadow: "0 1px 2px rgba(20,30,22,0.03)",
                        }}>
                          {/* ─── ILLUSTRATION — top-right inside card ─── */}
                          <div style={{
                            position: "absolute",
                            right: 36,
                            top: 28,
                            width: 200,
                            height: 165,
                            pointerEvents: "none",
                            opacity: 0.9,
                          }}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 300" style={{ width: "100%", height: "100%" }}>
                              <g fill="none" stroke="#2F2F31" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M150 58 Q144 44 154 34 Q162 24 154 12"/>
                                <path d="M178 54 Q172 38 182 28 Q188 20 182 8"/>
                                <path d="M204 60 Q198 46 208 36 Q216 26 208 14"/>
                              </g>
                              <g transform="translate(110 70)">
                                <path fill="#FCFCFE" stroke="#2F2F31" strokeWidth="2" strokeLinejoin="round" d="M130 50 Q170 50 170 90 Q170 130 130 130"/>
                                <path fill="none" stroke="#2F2F31" strokeWidth="1.4" strokeLinecap="round" d="M130 62 Q158 62 158 90 Q158 118 130 118"/>
                                <path fill="#FCFCFE" stroke="#2F2F31" strokeWidth="2" strokeLinejoin="round" d="M6 44 Q4 38 12 38 L134 38 Q142 38 140 44 L132 174 Q130 184 120 184 L26 184 Q16 184 14 174 Z"/>
                                <ellipse cx="73" cy="45" rx="62" ry="9" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="1.4"/>
                                <ellipse cx="73" cy="45" rx="54" ry="6" fill="#3F434B" opacity="0.9"/>
                                <path d="M40 42 Q52 38 70 39" stroke="#FCFCFE" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.8"/>
                                <g stroke="#2F2F31" strokeWidth="0.9" opacity="0.35" strokeLinecap="round" fill="none">
                                  <line x1="118" y1="70" x2="122" y2="164"/>
                                  <line x1="124" y1="70" x2="127" y2="160"/>
                                  <line x1="112" y1="72" x2="115" y2="166"/>
                                </g>
                              </g>
                              <g transform="translate(220 130) rotate(10)">
                                <rect x="0" y="0" width="92" height="140" rx="12" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="2" strokeLinejoin="round"/>
                                <rect x="6" y="14" width="80" height="118" rx="6" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="1.4"/>
                                <rect x="36" y="6" width="20" height="3" rx="1.5" fill="#2F2F31"/>
                                <g transform="translate(10 22)">
                                  <rect x="0" y="0" width="72" height="44" rx="6" fill="#558B68"/>
                                  <rect x="0" y="0" width="72" height="44" rx="6" fill="none" stroke="#2F2F31" strokeWidth="1.8" strokeLinejoin="round"/>
                                  <circle cx="10" cy="10" r="4" fill="#FCFCFE"/>
                                  <circle cx="10" cy="10" r="4" fill="none" stroke="#2F2F31" strokeWidth="1.2"/>
                                  <line x1="20" y1="8" x2="58" y2="8" stroke="#FCFCFE" strokeWidth="2" strokeLinecap="round"/>
                                  <line x1="20" y1="14" x2="48" y2="14" stroke="#FCFCFE" strokeWidth="1.4" strokeLinecap="round" opacity="0.85"/>
                                  <line x1="6" y1="26" x2="66" y2="26" stroke="#FCFCFE" strokeWidth="1.4" strokeLinecap="round"/>
                                  <line x1="6" y1="32" x2="58" y2="32" stroke="#FCFCFE" strokeWidth="1.4" strokeLinecap="round"/>
                                  <line x1="6" y1="38" x2="42" y2="38" stroke="#FCFCFE" strokeWidth="1.4" strokeLinecap="round"/>
                                </g>
                                <g transform="translate(10 74)">
                                  <rect x="0" y="0" width="72" height="22" rx="5" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="1.4"/>
                                  <circle cx="9" cy="11" r="3" fill="none" stroke="#2F2F31" strokeWidth="1.4"/>
                                  <line x1="18" y1="9" x2="58" y2="9" stroke="#2F2F31" strokeWidth="1.4" strokeLinecap="round"/>
                                  <line x1="18" y1="15" x2="44" y2="15" stroke="#2F2F31" strokeWidth="1.4" strokeLinecap="round"/>
                                </g>
                                <g transform="translate(10 102)">
                                  <rect x="0" y="0" width="72" height="22" rx="5" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="1.4"/>
                                  <circle cx="9" cy="11" r="3" fill="none" stroke="#2F2F31" strokeWidth="1.4"/>
                                  <line x1="18" y1="9" x2="54" y2="9" stroke="#2F2F31" strokeWidth="1.4" strokeLinecap="round"/>
                                  <line x1="18" y1="15" x2="40" y2="15" stroke="#2F2F31" strokeWidth="1.4" strokeLinecap="round"/>
                                </g>
                                <line x1="92" y1="30" x2="92" y2="48" stroke="#2F2F31" strokeWidth="1.4" strokeLinecap="round"/>
                              </g>
                              <g stroke="#2F2F31" strokeWidth="1.8" strokeLinecap="round" fill="none">
                                <path d="M232 108 L228 100"/>
                                <path d="M246 102 L244 92"/>
                                <path d="M260 100 L262 90"/>
                                <path d="M274 104 L280 96"/>
                              </g>
                              <g transform="translate(300 100)">
                                <circle cx="0" cy="0" r="10" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="2"/>
                                <line x1="0" y1="-4" x2="0" y2="2" stroke="#2F2F31" strokeWidth="2.4" strokeLinecap="round"/>
                                <circle cx="0" cy="6" r="1.4" fill="#2F2F31"/>
                              </g>
                            </svg>
                          </div>

                          {/* ─── CONTENT (right-padded so it doesn't collide with illo) ─── */}
                          <div style={{ paddingRight: 220 }}>
                          {/* ─── TOP BAR: dot + name on left, № WK DATE on right ─── */}
                          <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            paddingBottom: 14,
                            borderBottom: "1px dashed " + C.borderLight,
                            marginBottom: 18,
                          }}>
                            <div style={{
                              width: 8, height: 8, borderRadius: 999,
                              background: C.btn, flexShrink: 0,
                            }} />
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

                          {/* ─── HEADLINE ─── */}
                          <h3 style={{
                            fontFamily: "'Fraunces', Georgia, serif",
                            fontVariationSettings: '"opsz" 96, "SOFT" 50, "WONK" 0',
                            fontWeight: 400,
                            fontStyle: "italic",
                            fontSize: 25,
                            lineHeight: 1.22,
                            letterSpacing: "-0.005em",
                            color: C.text,
                            margin: "0 0 12px",
                          }}>
                            {obs.front_headline}
                          </h3>

                          {/* ─── BODY ─── */}
                          <p style={{
                            fontSize: 13.5,
                            lineHeight: 1.55,
                            color: C.textSec,
                            margin: "0 0 22px",
                          }}>
                            {obs.front_body}
                          </p>
                          </div>

                          {/* ─── DIVIDER + BOTTOM ROW: metric strip on left, buttons on right ─── */}
                          <div style={{
                            paddingTop: 16,
                            borderTop: "1px solid " + C.borderLight,
                            display: "flex",
                            alignItems: "center",
                            gap: 24,
                          }}>
                            {/* METRIC STRIP */}
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

                            {/* SPACER */}
                            <div style={{ flex: 1 }} />

                            {/* BUTTONS */}
                            <button
                              type="button"
                              onClick={handleUnpack}
                              style={{
                                background: C.btn,
                                color: "#FFFFFF",
                                border: "none",
                                padding: "8px 14px",
                                borderRadius: 8,
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: "pointer",
                                fontFamily: "inherit",
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = C.btnHover}
                              onMouseLeave={e => e.currentTarget.style.background = C.btn}
                            >
                              Unpack with Rai
                            </button>
                            <button
                              type="button"
                              onClick={handleDrop}
                              style={{
                                background: "transparent",
                                color: C.textMuted,
                                border: "none",
                                padding: "10px 8px",
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
                      </div>
                    );
                  })()}

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
                    <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 10, overflow: "hidden" }}>
                      <div onClick={() => setHealthStripOpen(!healthStripOpen)} style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, cursor: "pointer" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: C.primaryGhost, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Icon name="health" size={14} color={C.primary} />
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
                      <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: C.shadowSm, padding: "14px" }}>
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
                  <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: C.shadowSm, padding: "14px" }}>
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
                  {activeQueue.length === 0 && justCompleted.length === 0 && (
                    <div style={{ textAlign: "center", padding: "60px 20px", background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: C.shadowSm }}>
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
                        <div key={i} style={{ background: C.card, borderRadius: 12, border: "1px solid " + (isOpen ? C.primary + "55" : C.border), boxShadow: C.shadowSm, transition: "border-color 150ms" }}>
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
                              <button className="r-btn" style={{ padding: "8px 16px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{h.isFirstHC && h.due !== "Today" && h.overdue === 0 ? "Start early" : "Start"}</button>
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
                      <div style={{ marginTop: 24, background: C.card, borderRadius: 12, border: "1px solid " + C.border, boxShadow: C.shadowSm, padding: "20px 22px 16px" }}>
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
                    <div style={{ marginTop: 24, background: C.card, borderRadius: 12, border: "1px solid " + C.border, boxShadow: C.shadowSm, overflow: "hidden" }}>
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
                      <div onClick={() => setShowUpcoming(!showUpcoming)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: 8, cursor: "pointer", border: "1px solid " + C.borderLight, background: C.card }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: C.textSec }}>Upcoming · {upcomingQueue.length}</span>
                        <span style={{ fontSize: 12, color: C.textMuted }}>{showUpcoming ? "Hide" : "Show"}</span>
                      </div>
                      {showUpcoming && (
                        <div style={{ background: C.card, borderRadius: 12, border: "1px solid " + C.borderLight, overflow: "hidden", marginTop: 6 }}>
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
                <div key={i} style={{ background: C.card, borderRadius: 10, padding: "12px 14px", border: "1px solid " + C.border, textAlign: "center" }}>
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
                  <div key={c.id} style={{ background: C.card, borderRadius: 12, border: "1px solid " + C.border, padding: "16px", marginBottom: 10, boxShadow: C.cardShadow }}>
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
                    <button className="r-btn" onClick={() => { setPage("coach"); setAiMessages([{ role: "ai", text: `Let's talk about getting a referral from ${c.contact} at ${c.name}. Here's what I'm thinking: ${c.approach}` }]); }} style={{ width: "100%", marginTop: 10, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Talk to Rai About This</button>
                  </div>
                ))}
              </div>
            )}

            {/* Building Toward It */}
            {referralReadiness.filter(r => r.tier === "building").length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.warning, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>🔄 Building Toward It</div>
                {referralReadiness.filter(r => r.tier === "building").map(c => (
                  <div key={c.id} style={{ background: C.card, borderRadius: 12, border: "1px solid " + C.border, padding: "16px", marginBottom: 10, boxShadow: C.cardShadow }}>
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
                <div style={{ background: C.card, borderRadius: 12, border: "1px solid " + C.border, overflow: "hidden" }}>
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
              <button className="r-btn" onClick={() => { setPage("coach"); setAiMessages([{ role: "ai", text: "Let's talk referral strategy. Who are you thinking about asking? I can help you find the right moment and the right words." }]); }} style={{ width: "100%", marginTop: 10, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Talk to Rai</button>
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
          // Day boundary anchored to 2am local — matches task soft-clear cron.
          const _now = new Date();
          if (_now.getHours() < 2) _now.setDate(_now.getDate() - 1);
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

          // Compute per-worker stats
          const computeStats = (workerId) => {
            const wTasks = allAssigned.filter(t => t.assigned_worker_id === workerId);
            const wTasksAll = wTasks.length;
            const wDone = wTasks.filter(t => t.done).length;

            // 30-day window — based on completed_at for done tasks, created_at for assigned
            const wAssigned30 = wTasks.filter(t => {
              const ts = t.created_at || 0;
              return new Date(ts).getTime() >= _30dAgo.getTime();
            }).length;
            const wDone30 = wTasks.filter(t => {
              if (!t.done) return false;
              const cAt = t.completed_at || t.worker_completed_at;
              return cAt && new Date(cAt).getTime() >= _30dAgo.getTime();
            }).length;

            // On-time: completed_at <= due_date (or no due_date counts as on-time if completed)
            const completedTasks = wTasks.filter(t => t.done && (t.completed_at || t.worker_completed_at));
            const onTimeAll = completedTasks.filter(t => {
              if (!t.due_date) return true;
              const cAt = t.completed_at || t.worker_completed_at;
              return String(cAt).slice(0,10) <= String(t.due_date).slice(0,10);
            }).length;
            const onTimeRateAll = completedTasks.length ? Math.round((onTimeAll / completedTasks.length) * 100) : null;

            const completed30 = completedTasks.filter(t => {
              const cAt = t.completed_at || t.worker_completed_at;
              return new Date(cAt).getTime() >= _30dAgo.getTime();
            });
            const onTime30 = completed30.filter(t => {
              if (!t.due_date) return true;
              const cAt = t.completed_at || t.worker_completed_at;
              return String(cAt).slice(0,10) <= String(t.due_date).slice(0,10);
            }).length;
            const onTimeRate30 = completed30.length ? Math.round((onTime30 / completed30.length) * 100) : null;

            // Pending + overdue
            const pending = wTasks.filter(t => !t.done).length;
            const overdue = wTasks.filter(t => !t.done && t.due_date && String(t.due_date).slice(0,10) < _todayStr).length;

            // Client mix
            const clientMap = {};
            wTasks.forEach(t => {
              const k = t.client || "(no client)";
              clientMap[k] = (clientMap[k] || 0) + 1;
            });
            const clientEntries = Object.entries(clientMap).sort((a, b) => b[1] - a[1]);
            const topClient = clientEntries[0]?.[0] || null;
            const clientDiversity = clientEntries.filter(([k]) => k !== "(no client)").length;

            // Top client (last 30d)
            const wTasks30 = wTasks.filter(t => {
              const ts = t.created_at || 0;
              return new Date(ts).getTime() >= _30dAgo.getTime();
            });
            const clientMap30 = {};
            wTasks30.forEach(t => {
              const k = t.client || "(no client)";
              clientMap30[k] = (clientMap30[k] || 0) + 1;
            });
            const topClient30 = Object.entries(clientMap30).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

            // Worker Impact Score
            // For each completed task: weight = on-time bonus, multiplied by client_value.
            // Penalty for overdue tasks (still open, past due).
            // Normalize by total task count, then scale to 0-99.
            let rawImpact = 0;
            completedTasks.forEach(t => {
              const isOnTime = !t.due_date || (() => {
                const cAt = t.completed_at || t.worker_completed_at;
                return String(cAt).slice(0,10) <= String(t.due_date).slice(0,10);
              })();
              const taskWeight = t.recurring ? 1.0 : (isOnTime ? 1.5 : 0.7);
              // Time decay: tasks > 90 days old count for half
              const cAt = t.completed_at || t.worker_completed_at;
              const ageDays = cAt ? (Date.now() - new Date(cAt).getTime()) / 86400000 : 0;
              const decay = ageDays > 90 ? 0.5 : 1.0;
              rawImpact += taskWeight * clientValue(t.client) * decay;
            });
            // Penalty for overdue
            const overdueTasks = wTasks.filter(t => !t.done && t.due_date && String(t.due_date).slice(0,10) < _todayStr);
            overdueTasks.forEach(t => {
              rawImpact -= 0.5 * clientValue(t.client);
            });

            // Normalize. Empirical: scale by sqrt of total task count to dampen massive volume.
            // Floor at 0, cap at 99.
            const denom = Math.sqrt(Math.max(wTasksAll, 1));
            let impact = denom ? Math.round((rawImpact / denom) * 35) : 0;
            impact = Math.max(0, Math.min(99, impact));

            // "Building track record" if < 5 completed
            const isBuilding = completedTasks.length < 5;

            return {
              wTasksAll, wDone, wAssigned30, wDone30,
              pending, overdue,
              onTimeRateAll, onTimeRate30,
              completedAll: completedTasks.length,
              completed30: completed30.length,
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
                    Add worker
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
                    <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: C.shadowSm, padding: "14px" }}>
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
                    <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: C.shadowSm, padding: "14px" }}>
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
                    <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: C.shadowSm, padding: "14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                        <div style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>Recent movement</div>
                        <div style={{ fontSize: 10.5, color: C.textMuted }}>7d</div>
                      </div>
                      {climbing.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: C.success, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 6 }}>More active</div>
                          {climbing.map(({ w, delta }) => (
                            <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
                              <div style={{ width: 22, height: 22, borderRadius: 11, background: C.primary, color: "#fff", fontSize: 9, fontWeight: 700, display: "grid", placeItems: "center", flexShrink: 0 }}>{w.name.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase()}</div>
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
                              <div style={{ width: 22, height: 22, borderRadius: 11, background: C.primary, color: "#fff", fontSize: 9, fontWeight: 700, display: "grid", placeItems: "center", flexShrink: 0 }}>{w.name.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase()}</div>
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
                      <div style={{ background: C.card, border: "1px solid " + C.borderLight, borderRadius: 12, padding: "14px 16px" }}>
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
                      <div style={{ background: C.card, border: "1px solid " + C.borderLight, borderRadius: 12, padding: "14px 16px" }}>
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
                      const initials = w.name.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase();
                      return (
                        <div key={w.id} style={{
                          padding: "16px 18px",
                          background: C.card,
                          border: "1px solid " + C.borderLight,
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
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 14px" }}>Add a worker</h3>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: C.textSec, marginBottom: 5, letterSpacing: "0.02em" }}>Name</label>
                <input
                  autoFocus
                  value={newWorkerName}
                  onChange={e => setNewWorkerName(e.target.value)}
                  placeholder="Sarah Kim"
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid " + C.border, borderRadius: 8, fontFamily: "inherit", fontSize: 13.5, color: C.text, background: C.bg, outline: "none" }}
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: C.textSec, marginBottom: 5, letterSpacing: "0.02em" }}>Email</label>
                <input
                  type="email"
                  value={newWorkerEmail}
                  onChange={e => setNewWorkerEmail(e.target.value)}
                  placeholder="sarah@yourdomain.com"
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid " + C.border, borderRadius: 8, fontFamily: "inherit", fontSize: 13.5, color: C.text, background: C.bg, outline: "none" }}
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: C.textSec, marginBottom: 5, letterSpacing: "0.02em" }}>Role <span style={{ color: C.textMuted, fontWeight: 400 }}>· optional</span></label>
                <input
                  value={newWorkerRole}
                  onChange={e => setNewWorkerRole(e.target.value)}
                  placeholder="Internal · Freelancer · VA"
                  style={{ width: "100%", padding: "10px 12px", border: "1px solid " + C.border, borderRadius: 8, fontFamily: "inherit", fontSize: 13.5, color: C.text, background: C.bg, outline: "none" }}
                />
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22, paddingTop: 18, borderTop: "1px solid " + C.borderLight }}>
                <button
                  onClick={() => setAddWorkerOpen(false)}
                  style={{ padding: "8px 14px", background: "transparent", color: C.textSec, border: "1px solid " + C.border, borderRadius: 8, fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
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
                >Add worker</button>
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

          // ─── Network Map (hub-and-spoke SVG) ────────────────────────────
          // Referrers = clients who have sent at least one referral.
          // Build: { id, name, revenue, children: [{ name, mrr, status }] }
          // Guard against missing/null `from` and `name` fields on logged refs.
          const referrerMap = {};
          refs.forEach(r => {
            const fromName = r.from || "Unknown";
            if (!referrerMap[fromName]) referrerMap[fromName] = { id: fromName, name: fromName, revenue: 0, children: [] };
            referrerMap[fromName].children.push({ id: r.id || Math.random(), name: r.name || "Untitled", mrr: r.revenue || 0, status: r.status || "pending", on: r.on });
            referrerMap[fromName].revenue += (r.revenue || 0);
          });
          const referrers = Object.values(referrerMap);

          // ─── Render ─────────────────────────────────────────────────────
          return (
            <div style={{ width: "100%" }}>
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
                  <button onClick={() => setRefForm(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", background: C.btn, color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 1px 2px rgba(91,33,182,0.15), 0 2px 6px rgba(91,33,182,0.22)", whiteSpace: "nowrap" }}>
                    Log a referral
                  </button>
                </div>
              </div>

              {/* MAIN GRID: rail + main + rai (rai shows on >=1440px) */}
              <div className="rc-grid" style={{ display: "grid", gap: 20, alignItems: "start" }}>

                {/* LEFT RAIL: Who to ask next */}
                <div className="rc-rail" style={{ display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 0, alignSelf: "start" }}>
                  <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: C.shadowSm, overflow: "hidden" }}>
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
                      <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: C.shadowSm, padding: "14px" }}>
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

                  {/* NETWORK MAP SVG */}
                  <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 14, boxShadow: C.shadowSm, padding: "18px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>Referral Network</div>
                        <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 3 }}>Who your clients sent your way</div>
                      </div>
                      <div style={{ display: "flex", gap: 14, fontSize: 10.5, color: C.textMuted, alignItems: "center" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: C.retGood }} />Active</span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: "#D17A1B" }} />Closed</span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 16, height: 1.5, background: C.border }} /> = referral</span>
                      </div>
                    </div>
                    {referrers.length === 0 ? (
                      <div style={{ padding: "60px 20px", textAlign: "center", color: C.textMuted }}>
                        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>No referrals yet.</div>
                        <div style={{ fontSize: 12 }}>Log your first one to start building the network.</div>
                      </div>
                    ) : (() => {
                      // Layout: hub center, referrers on inner ring, children on outer ring.
                      // Angle offset prevents 2-node or 4-node layouts from collapsing to a
                      // straight vertical line (the bug in v1). Offset is largest when n is
                      // small and approaches 0 as n grows.
                      const W = 820, H = 440;
                      const cx = W / 2, cy = H / 2;
                      const innerR = 140;
                      const outerExtra = 110;
                      const n = referrers.length;
                      const angleOffset = n <= 2 ? Math.PI / 4 : (n <= 4 ? Math.PI / 6 : 0);
                      const maxRev = Math.max(1, ...referrers.map(rr => rr.revenue));
                      const nodes = referrers.map((r, i) => {
                        const theta = (i / n) * Math.PI * 2 - Math.PI / 2 + angleOffset;
                        const thickness = 1.5 + (r.revenue / maxRev) * 3.5;
                        return { ...r, x: cx + Math.cos(theta) * innerR, y: cy + Math.sin(theta) * innerR, theta, thickness };
                      });
                      // Curved path from hub to referrer — bezier with control point offset
                      // perpendicular to the line, creating a subtle arc.
                      const curvedPath = (x1, y1, x2, y2, curvature = 0.15) => {
                        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
                        const dx = x2 - x1, dy = y2 - y1;
                        const len = Math.sqrt(dx * dx + dy * dy);
                        const nx = -dy / len, ny = dx / len; // perpendicular unit vector
                        const cpx = mx + nx * len * curvature;
                        const cpy = my + ny * len * curvature;
                        return `M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`;
                      };
                      return (
                        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", maxHeight: 460 }} onMouseLeave={() => setNetworkHoverId(null)}>
                          <defs>
                            <radialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
                              <stop offset="0%" stopColor={C.primary} stopOpacity="0.25" />
                              <stop offset="100%" stopColor={C.primary} stopOpacity="0" />
                            </radialGradient>
                            <filter id="softShadow" x="-50%" y="-50%" width="200%" height="200%">
                              <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000" floodOpacity="0.12" />
                            </filter>
                          </defs>
                          {/* Decorative concentric rings for depth */}
                          <circle cx={cx} cy={cy} r={innerR + outerExtra + 30} fill="none" stroke={C.borderLight} strokeWidth="1" strokeDasharray="2 4" opacity="0.35" />
                          <circle cx={cx} cy={cy} r={innerR + outerExtra} fill="none" stroke={C.borderLight} strokeWidth="1" strokeDasharray="2 4" opacity="0.5" />
                          <circle cx={cx} cy={cy} r={innerR} fill="none" stroke={C.borderLight} strokeWidth="1" strokeDasharray="2 4" opacity="0.7" />
                          {/* Hub glow aura */}
                          <circle cx={cx} cy={cy} r="80" fill="url(#hubGlow)" />
                          {/* Curved edges from hub to each referrer */}
                          {nodes.map(node => {
                            const dim = networkHoverId && networkHoverId !== node.id ? 0.2 : 1;
                            const side = node.x < cx ? -1 : 1;
                            return (
                              <g key={"edge-" + node.id} opacity={dim}>
                                <path d={curvedPath(cx, cy, node.x, node.y, 0.1 * side)} stroke={C.retGood} strokeWidth={node.thickness} fill="none" opacity="0.45" strokeLinecap="round" />
                              </g>
                            );
                          })}
                          {/* Curved edges from referrer to their children */}
                          {nodes.map(node => {
                            const dim = networkHoverId && networkHoverId !== node.id ? 0.12 : 1;
                            const cn = node.children.length;
                            const spread = cn === 1 ? 0 : Math.PI / 2.5;
                            return node.children.map((ch, ci) => {
                              const childTheta = node.theta + (cn === 1 ? 0 : (ci / (cn - 1) - 0.5) * spread);
                              const childX = node.x + Math.cos(childTheta) * outerExtra;
                              const childY = node.y + Math.sin(childTheta) * outerExtra;
                              const color = ch.status === "converted" || ch.status === "active" ? C.retGood : "#D17A1B";
                              const side = childX < node.x ? -1 : 1;
                              const name = ch.name || "Untitled";
                              const displayName = name.length > 16 ? name.slice(0, 15) + "…" : name;
                              return (
                                <g key={"ch-" + node.id + "-" + ci} opacity={dim}>
                                  <path d={curvedPath(node.x, node.y, childX, childY, 0.12 * side)} stroke={color} strokeWidth="1.5" fill="none" opacity="0.55" strokeLinecap="round" />
                                  <circle cx={childX} cy={childY} r="7" fill={color} filter="url(#softShadow)" />
                                  <circle cx={childX} cy={childY} r="3" fill="#fff" opacity="0.9" />
                                  <text x={childX} y={childY + 22} fontSize="11" fill={C.text} textAnchor="middle" fontWeight="500">{displayName}</text>
                                  {ch.mrr > 0 && <text x={childX} y={childY + 36} fontSize="9.5" fill={C.textMuted} textAnchor="middle" fontWeight="500">${(ch.mrr / 1000).toFixed(ch.mrr >= 10000 ? 0 : 1)}k/mo</text>}
                                </g>
                              );
                            });
                          })}
                          {/* Referrer nodes */}
                          {nodes.map(node => {
                            const highlighted = networkHoverId === node.id;
                            const name = node.name || "Unknown";
                            const displayName = name.length > 18 ? name.slice(0, 17) + "…" : name;
                            return (
                              <g key={"node-" + node.id} style={{ cursor: "pointer" }} onMouseEnter={() => setNetworkHoverId(node.id)}>
                                <circle cx={node.x} cy={node.y} r={highlighted ? 26 : 22} fill={getAvatarColor(node.id)} stroke="#fff" strokeWidth="3" filter="url(#softShadow)" style={{ transition: "r 180ms" }} />
                                <text x={node.x} y={node.y + 4} fontSize="11" fill="#fff" textAnchor="middle" fontWeight="700">{getInitials(name)}</text>
                                <text x={node.x} y={node.y - 34} fontSize="12" fill={C.text} textAnchor="middle" fontWeight="600">{displayName}</text>
                                {node.revenue > 0 && <text x={node.x} y={node.y - 48} fontSize="10" fill={C.retGood} textAnchor="middle" fontWeight="700">${(node.revenue / 1000).toFixed(node.revenue >= 10000 ? 0 : 1)}k/mo</text>}
                              </g>
                            );
                          })}
                          {/* Hub (you) */}
                          <circle cx={cx} cy={cy} r="42" fill={C.primary} stroke="#fff" strokeWidth="4" filter="url(#softShadow)" />
                          <text x={cx} y={cy - 3} fontSize="12" fill="#fff" textAnchor="middle" fontWeight="700" letterSpacing="0.8">YOU</text>
                          <text x={cx} y={cy + 13} fontSize="10" fill="#fff" textAnchor="middle" fontWeight="500" opacity="0.85">Retaynd</text>
                        </svg>
                      );
                    })()}
                  </div>

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
                        <div style={{ display: "inline-flex", gap: 2, padding: 3, background: C.bg, border: "1px solid " + C.border, borderRadius: 8 }}>
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
                        style={{ width: "100%", minHeight: 150, padding: "12px 14px", border: "1px solid " + C.border, borderRadius: 10, fontSize: 13, fontFamily: "inherit", background: C.bg, outline: "none", resize: "vertical", lineHeight: 1.55, color: C.text, boxSizing: "border-box", marginBottom: 12, whiteSpace: "pre-wrap" }}
                      />
                      {/* Action row */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <a href={`mailto:${activeAsk.email || ""}?subject=${encodeURIComponent("Quick ask")}&body=${encodeURIComponent(displayedDraft)}`} onClick={() => markAsked(activeAsk)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 11px", background: C.bg, border: "1px solid " + C.border, borderRadius: 7, fontSize: 11.5, color: C.textSec, fontWeight: 500, cursor: "pointer", textDecoration: "none" }}>
                            <Icon name="mail" size={13} color={C.textSec} />
                            <span>Email</span>
                          </a>
                          <a href={`sms:${activeAsk.phone || ""}?body=${encodeURIComponent(displayedDraft)}`} onClick={() => markAsked(activeAsk)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 11px", background: C.bg, border: "1px solid " + C.border, borderRadius: 7, fontSize: 11.5, color: C.textSec, fontWeight: 500, cursor: "pointer", textDecoration: "none" }}>
                            <Icon name="phone" size={13} color={C.textSec} />
                            <span>Text</span>
                          </a>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => { const nextIdx = askQueue.findIndex(c => c.name === activeAsk.name) + 1; const nxt = askQueue[nextIdx]; if (nxt) { setAskActiveId(nxt.name); setAskDraft(""); } else { setAskActiveId(null); setAskDraft(""); } }} style={{ padding: "8px 12px", fontSize: 12, color: C.textMuted, background: "transparent", border: "none", borderRadius: 7, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>Ask someone else →</button>
                          <button onClick={() => markAsked(activeAsk)} style={{ padding: "8px 16px", fontSize: 12.5, color: "#fff", background: C.retGood, borderRadius: 7, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit", boxShadow: C.shadowSm }}>Mark asked</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* REFERRAL LOG (compact) */}
                  <div>
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
                      <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: C.shadowSm, overflow: "hidden" }}>
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
                <div onClick={() => setRefForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div onClick={e => e.stopPropagation()} style={{ background: C.card, borderRadius: 14, padding: 24, width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 18 }}>Log a referral</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>New client name</label>
                        <input value={refName} onChange={e => setRefName(e.target.value)} placeholder="e.g. White Mountain Puzzles" style={{ width: "100%", padding: "10px 14px", border: "1px solid " + C.border, borderRadius: 8, fontSize: 14, fontFamily: "inherit", background: C.bg, outline: "none", boxSizing: "border-box" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Referred by</label>
                        <select value={refFrom} onChange={e => setRefFrom(e.target.value)} style={{ width: "100%", padding: "10px 14px", border: "1px solid " + C.border, borderRadius: 8, fontSize: 14, fontFamily: "inherit", background: C.bg, outline: "none", boxSizing: "border-box" }}>
                          <option value="">Choose a client…</option>
                          {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Monthly revenue (optional)</label>
                        <input value={refRevenue} onChange={e => setRefRevenue(e.target.value)} placeholder="4000" style={{ width: "100%", padding: "10px 14px", border: "1px solid " + C.border, borderRadius: 8, fontSize: 14, fontFamily: "inherit", background: C.bg, outline: "none", boxSizing: "border-box" }} />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={addRef} disabled={!refName.trim() || !refFrom} style={{ flex: 1, padding: "10px", background: (refName.trim() && refFrom) ? C.btn : C.surface, color: (refName.trim() && refFrom) ? "#fff" : C.textMuted, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: (refName.trim() && refFrom) ? "pointer" : "default", fontFamily: "inherit" }}>Log referral</button>
                      <button onClick={() => { setRefForm(false); setRefName(""); setRefFrom(""); setRefRevenue(""); }} style={{ padding: "10px 18px", background: C.surface, color: C.textMuted, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}
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
            setRolodex(prev => prev.map(r => r.id === active.id ? { ...r, priority, retro_answers: finalAnswers, tags, priority_set_at: new Date().toISOString() } : r));
            try { await rolodexDb.update(active.id, { priority, retro_answers: finalAnswers, tags }); } catch (e) { console.warn("Priority save failed:", e); }
            advanceAfterRetro();
          };

          // Filed list filter (click a stack)
          const [filedFilter, setFiledFilter] = [rolodexFiledFilter, setRolodexFiledFilter];
          const filteredFiled = filedFilter === "all" ? saved : byPrio[filedFilter] || [];

          // ─── Render ─────────────────────────────────────────────────────
          return (
            <div style={{ width: "100%" }}>
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
                <button onClick={() => setShowAddRolodex(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", background: C.btn, color: "#fff", borderRadius: 10, fontSize: 13.5, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 1px 2px rgba(91,33,182,0.15), 0 2px 6px rgba(91,33,182,0.22)", flexShrink: 0 }}>
                  <span style={{ whiteSpace: "nowrap" }}>New contact</span>
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
                        <button key={s.key} onClick={() => setFiledFilter(selected ? "all" : s.key)} style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", padding: "12px 14px", borderRadius: 12, boxShadow: C.shadowSm, cursor: "pointer", textAlign: "left", background: selected ? s.toneBg : C.card, border: "1px solid " + (selected ? s.tone : C.border), fontFamily: "inherit", transition: "all 150ms" }}>
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
                    <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: C.shadowSm, padding: 14 }}>
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
                      {queued.length > 1 && <div style={{ position: "absolute", top: 8, left: 8, right: 8, bottom: 16, background: C.card, border: "1px solid " + C.borderLight, borderRadius: 14, opacity: 0.5, zIndex: 0 }} />}
                      {queued.length > 2 && <div style={{ position: "absolute", top: 4, left: 4, right: 4, bottom: 12, background: C.card, border: "1px solid " + C.border, borderRadius: 14, opacity: 0.8, zIndex: 0 }} />}
                      <div style={{ position: "relative", zIndex: 1, background: C.card, border: "1px solid " + C.border, borderRadius: 14, boxShadow: "0 4px 12px rgba(10,10,10,0.06)", overflow: "hidden" }}>
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
                              style={{ width: "100%", padding: "12px 14px", border: "1px solid " + C.border, borderRadius: 10, fontSize: 14, fontFamily: "inherit", background: C.bg, outline: "none", resize: "vertical", lineHeight: 1.55, color: C.text, boxSizing: "border-box" }}
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
                              <button onClick={onNext} style={{ padding: "8px 18px", background: C.retGood, color: "#fff", borderRadius: 8, fontSize: 12.5, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit", boxShadow: C.shadowSm }}>Next →</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", padding: "40px 20px", background: C.card, border: "1px solid " + C.border, borderRadius: 14, boxShadow: C.shadowSm }}>
                      <div style={{ width: 44, height: 44, borderRadius: 22, background: "#E8F3EC", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", border: "2px solid " + C.retGood }}>
                        <Icon name="check" size={20} color={C.retGood} />
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>Deck cleared.</div>
                      <div style={{ fontSize: 12.5, color: C.textMuted, marginTop: 4 }}>All contacts are filed. Tap "New contact" to add more.</div>
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
                      <input value={rolodexSearch} onChange={e => setRolodexSearch(e.target.value)} placeholder="Search filed…" style={{ width: 180, padding: "6px 10px", border: "1px solid " + C.border, borderRadius: 8, fontSize: 12, fontFamily: "inherit", background: C.card, outline: "none" }} />
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
                          <div key={e.id} onClick={() => setSelectedRolodex(e)} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: C.shadowSm, marginBottom: 8, cursor: "pointer" }}>
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
                <div onClick={() => setShowAddRolodex(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div onClick={e => e.stopPropagation()} style={{ background: C.card, borderRadius: 14, padding: 24, width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 6 }}>New rolodex contact</div>
                    <div style={{ fontSize: 12.5, color: C.textMuted, marginBottom: 18 }}>Add someone to your deck. You'll run a quick retro to file them.</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Company / client name</label>
                        <input value={newRolodexEntry.client} onChange={e => setNewRolodexEntry({ ...newRolodexEntry, client: e.target.value })} placeholder="Northbeam Studios" style={{ width: "100%", padding: "10px 14px", border: "1px solid " + C.border, borderRadius: 8, fontSize: 14, fontFamily: "inherit", background: C.bg, outline: "none", boxSizing: "border-box" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Contact person</label>
                        <input value={newRolodexEntry.contact} onChange={e => setNewRolodexEntry({ ...newRolodexEntry, contact: e.target.value })} placeholder="Jordan Reeve" style={{ width: "100%", padding: "10px 14px", border: "1px solid " + C.border, borderRadius: 8, fontSize: 14, fontFamily: "inherit", background: C.bg, outline: "none", boxSizing: "border-box" }} />
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
                      <div className="rt-composer" style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 18, padding: "20px 22px 14px", textAlign: "left", boxShadow: "0 1px 2px rgba(10,10,10,0.03), 0 6px 20px rgba(91,33,182,0.08)" }}>
                        {aiAttachments.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                            {aiAttachments.map(a => (
                              <span key={a.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 8px 5px 10px", background: C.surfaceWarm, border: "1px solid " + C.border, borderRadius: 8, fontSize: 12, color: C.text, maxWidth: 240 }}>
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
                          <label title="Attach a file (PDF or image, max 10MB)" style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid " + C.border, background: C.card, color: C.textSec, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s" }}>
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
                              padding: "7px 14px",
                              background: C.card,
                              border: "1px solid " + C.border,
                              borderRadius: 999,
                              fontSize: 13,
                              fontWeight: 500,
                              color: C.textSec,
                              cursor: "pointer",
                              fontFamily: "inherit",
                              transition: "all 0.15s",
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = C.surfaceWarm; e.currentTarget.style.color = C.text; }}
                            onMouseLeave={e => { e.currentTarget.style.background = C.card; e.currentTarget.style.color = C.textSec; }}
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
                          <div style={{ maxWidth: "75%", background: C.surface, borderRadius: 20, padding: "12px 18px" }}>
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
                  <div style={{ background: C.card, border: "1.5px solid " + C.border, borderRadius: 14, padding: "14px 16px 10px" }}>
                    {aiAttachments.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                        {aiAttachments.map(a => (
                          <span key={a.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 8px 5px 10px", background: C.surfaceWarm, border: "1px solid " + C.border, borderRadius: 8, fontSize: 12, color: C.text, maxWidth: 240 }}>
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
                      <label title="Attach a file (PDF or image, max 10MB)" style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid " + C.border, background: C.card, color: C.textSec, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
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

            {/* Appearance — theme toggle. Lives here because mobile has no
                sidebar where the desktop toggle button lives, so this is
                the only theme control reachable on phones. */}
            <div className="row-hover" style={{ background: C.card, borderRadius: 10, padding: "14px 16px", border: "1px solid " + C.border, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Appearance</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{theme === "dark" ? "Dark mode" : "Light mode"}</div>
              </div>
              <button
                onClick={toggleTheme}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "6px 12px",
                  background: C.btnLight, color: C.btn,
                  border: "none", borderRadius: 7,
                  fontSize: 12, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                <Icon name={theme === "dark" ? "sun" : "moon"} size={12} color={C.btn} />
                {theme === "dark" ? "Switch to light" : "Switch to dark"}
              </button>
            </div>

            {[{ title: "Account", desc: "Name, email, password" }, { title: "Notifications", desc: "Email alerts, daily digest" }, { title: "Team", desc: "Invite members, assign clients" }, { title: "Billing", desc: "Plan, payment method, invoices" }].map((s, i) => (
              <div key={i} className="row-hover" style={{ background: C.card, borderRadius: 10, padding: "14px 16px", border: "1px solid " + C.border, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div><div style={{ fontSize: 14, fontWeight: 600 }}>{s.title}</div><div style={{ fontSize: 12, color: C.textMuted }}>{s.desc}</div></div>
                <Icon name="chevron" size={16} color={C.border} />
              </div>
            ))}

            {/* Enterprise: Integrations */}
            {tier === "enterprise" && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 12 }}>Integrations</div>
                {integrations.map((cat, ci) => (
                  <div key={ci} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>{cat.cat}</div>
                    <div style={{ background: C.card, borderRadius: 12, border: "1px solid " + C.border, overflow: "hidden" }}>
                      {cat.items.map((item, ii) => (
                        <div key={ii} className="row-hover" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: ii < cat.items.length - 1 ? "1px solid " + C.borderLight : "none" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 14, width: 24, textAlign: "center" }}>{item.icon}</span>
                            <span style={{ fontSize: 14, fontWeight: 600 }}>{item.name}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {item.connected ? (
                              <span style={{ fontSize: 12, color: C.success, fontWeight: 600 }}>🟢 {item.meta}</span>
                            ) : (
                              <button className="r-btn" style={{ padding: "5px 14px", background: C.btn, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Connect</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Sweep Schedule */}
                <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 12, marginTop: 20 }}>Automated Sweep</div>
                <div style={{ background: C.card, borderRadius: 12, border: "1px solid " + C.border, padding: "16px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>Frequency</span>
                      <select style={{ padding: "6px 12px", border: "1.5px solid " + C.border, borderRadius: 6, fontSize: 14, fontFamily: "inherit", background: C.bg }}>
                        <option>Daily</option><option>Twice daily</option><option>Weekly (Monday AM)</option>
                      </select>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>Time</span>
                      <select style={{ padding: "6px 12px", border: "1.5px solid " + C.border, borderRadius: 6, fontSize: 14, fontFamily: "inherit", background: C.bg }}>
                        <option>6:00 AM</option><option>7:00 AM</option><option>8:00 AM</option><option>9:00 AM</option>
                      </select>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>Timezone</span>
                      <select style={{ padding: "6px 12px", border: "1.5px solid " + C.border, borderRadius: 6, fontSize: 14, fontFamily: "inherit", background: C.bg }}>
                        <option>Eastern</option><option>Central</option><option>Mountain</option><option>Pacific</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ marginTop: 12, fontSize: 12, color: C.textMuted }}>Last sweep: Today at 6:02 AM · {sweepData.clients_analyzed} clients</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>Next sweep: Tomorrow at 6:00 AM</div>
                  <button className="r-btn" style={{ width: "100%", marginTop: 12, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Run Sweep Now</button>
                </div>

                {/* Output Routing */}
                <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 12, marginTop: 20 }}>Output Routing</div>
                <div style={{ background: C.card, borderRadius: 12, border: "1px solid " + C.border, padding: "16px" }}>
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
                <div style={{ background: C.card, borderRadius: 12, border: "1px solid " + C.border, padding: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>API Key</div>
                      <div style={{ fontSize: 12, color: C.textMuted }}>Use this key to authenticate API requests</div>
                    </div>
                    <button className="r-btn" style={{ padding: "6px 14px", background: C.btn, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Regenerate</button>
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
                <div style={{ background: C.card, borderRadius: 12, border: "1px solid " + C.border, padding: "16px" }}>
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
            <div onClick={() => setSelectedClient(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 90 }} />
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
                  {["Overview", "Profile", "Billing", "Flags"].map(t => (
                    <button key={t} onClick={() => setClientTab(t.toLowerCase())} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: clientTab === t.toLowerCase() ? C.card : "transparent", color: clientTab === t.toLowerCase() ? C.text : C.textMuted, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", boxShadow: clientTab === t.toLowerCase() ? C.shadowSm : "none", transition: "background 0.15s ease, color 0.15s ease" }}>{t}</button>
                  ))}
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
                        <button onClick={() => { setEditingOverview(true); setOverviewEditData({ contact: sc.contact, role: sc.role, tag: sc.tag, months: sc.months, revenue: sc.revenue, renewal_date: sc.renewal_date || "" }); }} style={{ width: "100%", padding: "11px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 14, boxShadow: "0 1px 2px rgba(91,33,182,0.15), 0 2px 6px rgba(91,33,182,0.22)" }}>Edit Details</button>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Edit Client Details</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {[{ key: "contact", label: "Contact name" }, { key: "role", label: "Role" }, { key: "tag", label: "Industry" }].map(f => (
                            <div key={f.key}>
                              <label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>{f.label}</label>
                              <input value={overviewEditData[f.key] || ""} onChange={e => setOverviewEditData({ ...overviewEditData, [f.key]: e.target.value })} style={{ width: "100%", padding: "12px 16px", border: "1.5px solid " + C.border, borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg }} />
                            </div>
                          ))}
                          <div>
                            <label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Months together</label>
                            <input type="number" value={overviewEditData.months || 0} onChange={e => setOverviewEditData({ ...overviewEditData, months: parseInt(e.target.value) || 0 })} style={{ width: "100%", padding: "12px 16px", border: "1.5px solid " + C.border, borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Estimated monthly revenue ($)</label>
                            <input type="number" value={overviewEditData.revenue || 0} onChange={e => setOverviewEditData({ ...overviewEditData, revenue: parseInt(e.target.value) || 0 })} style={{ width: "100%", padding: "12px 16px", border: "1.5px solid " + C.border, borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Renewal date <span style={{ color: C.textMuted, fontWeight: 400 }}>· optional</span></label>
                            <input type="date" value={overviewEditData.renewal_date ? String(overviewEditData.renewal_date).split("T")[0] : ""} onChange={e => setOverviewEditData({ ...overviewEditData, renewal_date: e.target.value || null })} style={{ width: "100%", padding: "12px 16px", border: "1.5px solid " + C.border, borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg, colorScheme: "light" }} />
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                          <button onClick={() => setEditingOverview(false)} style={{ padding: "10px 16px", background: C.surface, color: C.textSec, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                          <button onClick={async () => {
                            const updated = { ...sc, contact: overviewEditData.contact, role: overviewEditData.role, tag: overviewEditData.tag, months: overviewEditData.months, revenue: overviewEditData.revenue, renewal_date: overviewEditData.renewal_date || null };
                            setClients(prev => prev.map(c => c.id === sc.id ? updated : c));
                            setSelectedClient(updated);
                            setEditingOverview(false);
                            clientsDb.update(sc.id, { contact: overviewEditData.contact, role: overviewEditData.role, tag: overviewEditData.tag, months: overviewEditData.months, revenue: overviewEditData.revenue, renewal_date: overviewEditData.renewal_date || null });
                          }} style={{ flex: 1, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
                        </div>
                      </>
                    )}
                {/* Destructive actions — text-link strip (rare events, light visual weight) */}
                <div style={{ marginTop: 18 }}>
                  {!rolodexConfirm && !removeConfirm ? (
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, fontSize: 12 }}>
                      <button onClick={() => { setRolodexConfirm(true); setRemoveConfirm(false); }} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: 4 }}>Move to Rolodex</button>
                      <span style={{ color: C.border }}>·</span>
                      <button onClick={() => { setRemoveConfirm(true); setRolodexConfirm(false); }} style={{ background: "none", border: "none", color: C.danger, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", padding: 4 }}>Remove</button>
                    </div>
                  ) : rolodexConfirm ? (
                    <div style={{ background: C.primarySoft, borderRadius: 12, padding: "16px", border: "1px solid " + C.primary + "33" }}>
                      <p style={{ fontSize: 14, color: C.text, lineHeight: 1.55, marginBottom: 14 }}>This client will be moved to your Rolodex for future tracking. Relationships change — this keeps the door open. Rai's memory of them will be cleared.</p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="r-btn" onClick={() => { setRolodex(prev => [...prev, { id: Date.now(), client: sc.name, contact: sc.contact, months: sc.months, type: "former", date: "Mar 2026", tags: [], priority: null }]); setClients(clients.filter(c => c.id !== sc.id));
                          clientsDb.deactivate(sc.id); setSelectedClient(null); setRolodexConfirm(false); setPage("retros"); }} style={{ flex: 1, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Move to Rolodex</button>
                        <button onClick={() => setRolodexConfirm(false)} style={{ padding: "10px 14px", background: C.surface, color: C.textMuted, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: C.bg, borderRadius: 12, padding: "16px", border: "1px solid " + C.border }}>
                      <p style={{ fontSize: 14, color: C.text, lineHeight: 1.55, marginBottom: 14 }}>This will permanently delete this client from your account — all tasks, touchpoints, health checks, and Rai's memory of them will be erased. This cannot be undone.</p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => { setClients(clients.filter(c => c.id !== sc.id));
                          clientsDb.hardDelete(sc.id); setSelectedClient(null); setRemoveConfirm(false); }} style={{ flex: 1, padding: "10px", background: C.surface, color: C.textSec, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Remove Permanently</button>
                        <button className="r-btn" onClick={() => setRemoveConfirm(false)} style={{ padding: "10px 14px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
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
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {profileDimensions.map(d => {
                              const val = dims[d.key];
                              if (val === undefined || val === null) return null;
                              const labels = dimLabels[d.key] || [d.name, "Low", "High"];
                              return (
                                <div key={d.key} style={{ background: C.bg, borderRadius: 8, padding: "10px 12px" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                    <span style={{ fontSize: 14, fontWeight: 600 }}>{labels[0]}</span>
                                    <span style={{ fontSize: 14, fontWeight: 700, color: C.primary }}>{val}</span>
                                  </div>
                                  <div style={{ height: 4, background: C.borderLight, borderRadius: 2, marginBottom: 4 }}>
                                    <div style={{ height: "100%", width: `${val * 10}%`, background: C.primary, borderRadius: 2 }} />
                                  </div>
                                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.textMuted }}>
                                    <span>{labels[1]}</span><span>{labels[2]}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={{ textAlign: "center", padding: "20px 0", color: C.textMuted, fontSize: 14 }}>
                            No profile set yet. Build one to help Rai understand this client.
                          </div>
                        )}
                        <button className="r-btn" onClick={() => { setEditScores({ ...dims }); setEditingProfile(true); }} style={{ width: "100%", padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 12 }}>
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
                  const activeMonths = [currentMonth, nextMonth];

                  const getMonthItems = (month) => billing.items.filter(i => i.month === month);
                  const getMonthTotal = (month) => getMonthItems(month).reduce((a, i) => a + i.amount, 0);
                  const pastMonths = [...new Set(billing.items.map(i => i.month))].filter(m => !activeMonths.includes(m));

                  const addItem = (month) => {
                    if (!billingNewItem.description.trim() || !billingNewItem.amount) return;
                    const prev = clientBilling[sc.id] || { items: [] };
                    const item = { id: Date.now(), description: billingNewItem.description.trim(), amount: parseFloat(billingNewItem.amount) || 0, recurring: billingNewItem.recurring, month };
                    const newItems = [...prev.items, item];
                    if (billingNewItem.recurring) {
                      const otherMonth = month === currentMonth ? nextMonth : currentMonth;
                      const alreadyExists = prev.items.some(i => i.description === item.description && i.month === otherMonth);
                      if (!alreadyExists) {
                        newItems.push({ ...item, id: Date.now() + 1, month: otherMonth });
                      }
                    }
                    setClientBilling({ ...clientBilling, [sc.id]: { ...prev, items: newItems } });
                    setBillingNewItem({ description: "", amount: "", recurring: false });
                    setBillingAddOpen(false);
                  };

                  const removeItem = (itemId) => {
                    const prev = clientBilling[sc.id] || { items: [] };
                    setClientBilling({ ...clientBilling, [sc.id]: { ...prev, items: prev.items.filter(i => i.id !== itemId) } });
                  };

                  const toggleRecurring = (itemId) => {
                    const prev = clientBilling[sc.id] || { items: [] };
                    setClientBilling({ ...clientBilling, [sc.id]: { ...prev, items: prev.items.map(i => i.id === itemId ? { ...i, recurring: !i.recurring } : i) } });
                  };

                  const renderMonth = (month, isNext) => {
                    const items = getMonthItems(month);
                    const total = getMonthTotal(month);
                    const isAdding = billingAddOpen === month;
                    return (
                      <div key={month} style={{ marginBottom: 20 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700 }}>{month}</div>
                            {isNext && <div style={{ fontSize: 12, color: C.textMuted }}>Forward billing</div>}
                          </div>
                          {items.length > 0 && <div style={{ fontSize: 14, fontWeight: 700, color: C.primary }}>${total.toLocaleString()}</div>}
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
                            <button onClick={() => toggleRecurring(item.id)} style={{ background: "none", border: "none", fontSize: 12, color: item.recurring ? C.primary : C.borderLight, cursor: "pointer", padding: "2px" }}>↻</button>
                            <button onClick={() => removeItem(item.id)} style={{ background: "none", border: "none", fontSize: 14, color: C.borderLight, cursor: "pointer", padding: "0 2px" }}>×</button>
                          </div>
                        ))}

                        {items.length === 0 && !isAdding && (
                          <div style={{ padding: "12px 0", fontSize: 14, color: C.textMuted }}>No items yet.</div>
                        )}

                        {isAdding ? (
                          <div style={{ padding: "12px 0", display: "flex", flexDirection: "column", gap: 8 }}>
                            <input value={billingNewItem.description} onChange={e => setBillingNewItem({ ...billingNewItem, description: e.target.value })} placeholder="Description (e.g. Retainer, Creative refresh)" style={{ padding: "12px 16px", border: "1.5px solid " + C.border, borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg }} />
                            <input type="number" value={billingNewItem.amount} onChange={e => setBillingNewItem({ ...billingNewItem, amount: e.target.value })} placeholder="Amount ($)" style={{ padding: "12px 16px", border: "1.5px solid " + C.border, borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg }} />
                            <div onClick={() => setBillingNewItem({ ...billingNewItem, recurring: !billingNewItem.recurring })} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", cursor: "pointer" }}>
                              <div style={{ width: 18, height: 18, borderRadius: 4, border: billingNewItem.recurring ? "none" : "1.5px solid " + C.border, background: billingNewItem.recurring ? C.primary : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {billingNewItem.recurring && <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>✓</span>}
                              </div>
                              <span style={{ fontSize: 14, color: C.textSec }}>Make recurring (auto-adds each month)</span>
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button className="r-btn" onClick={() => addItem(month)} style={{ flex: 1, padding: "10px", background: billingNewItem.description.trim() && billingNewItem.amount ? C.btn : C.surface, color: billingNewItem.description.trim() && billingNewItem.amount ? "#fff" : C.textMuted, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Add</button>
                              <button onClick={() => { setBillingAddOpen(false); setBillingNewItem({ description: "", amount: "", recurring: false }); }} style={{ padding: "10px 14px", background: C.surface, color: C.textMuted, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setBillingAddOpen(month)} style={{ width: "100%", padding: "10px", background: "transparent", color: C.primary, border: "1px dashed " + C.border, borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 6 }}>+ Add line item</button>
                        )}

                        {items.length > 0 && (
                          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 0", marginTop: 8, borderTop: "2px solid " + C.border }}>
                            <span style={{ fontSize: 14, fontWeight: 800 }}>Total</span>
                            <span style={{ fontSize: 14, fontWeight: 800, color: C.primary }}>${total.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    );
                  };

                  return (
                    <div>
                      {renderMonth(nextMonth, true)}
                      <div style={{ height: 1, background: C.border, margin: "4px 0 20px" }} />
                      {renderMonth(currentMonth, false)}

                      {pastMonths.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8, paddingTop: 12, borderTop: "1px solid " + C.borderLight }}>Previous months</div>
                          {pastMonths.map((month, mi) => {
                            const items = getMonthItems(month);
                            const total = getMonthTotal(month);
                            return (
                              <div key={mi} style={{ background: C.bg, borderRadius: 8, padding: "10px 12px", marginBottom: 6 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: items.length > 0 ? 4 : 0 }}>
                                  <span style={{ fontSize: 14, fontWeight: 600 }}>{month}</span>
                                  <span style={{ fontSize: 14, fontWeight: 700, color: C.primary }}>${total.toLocaleString()}</span>
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
            <div onClick={() => setSelectedRolodex(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 90 }} />
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
                      <button onClick={() => { setShowReminderPicker(true); setReminderDate(sr.reminder || ""); }} className="r-btn" style={{ width: "100%", padding: sr.reminder ? "12px" : "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 16, textAlign: sr.reminder ? "left" : "center" }}>
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
                            const d = monday.toISOString().split("T")[0];
                            const sel = reminderDate === d;
                            return (
                              <button key={q.label} onClick={() => setReminderDate(d)} style={{ flex: 1, padding: "10px 8px", borderRadius: 8, border: "1.5px solid " + (sel ? C.primary : C.border), background: sel ? C.primarySoft : C.bg, color: sel ? C.primary : C.text, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{q.label}</button>
                            );
                          })}
                        </div>
                        {reminderDate && <div style={{ fontSize: 14, color: C.primary, fontWeight: 600, marginBottom: 12 }}>Monday, {new Date(reminderDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>}
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="r-btn" onClick={() => {
                            if (reminderDate) { setRolodex(prev => prev.map(x => x.id === sr.id ? { ...x, reminder: reminderDate } : x)); setSelectedRolodex({ ...sr, reminder: reminderDate }); }
                            setShowReminderPicker(false);
                          }} style={{ flex: 1, padding: "10px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
                          {sr.reminder && <button onClick={() => { setRolodex(prev => prev.map(x => x.id === sr.id ? { ...x, reminder: null } : x)); setSelectedRolodex({ ...sr, reminder: null }); setReminderDate(""); setShowReminderPicker(false); }} style={{ padding: "10px 14px", background: "transparent", color: C.danger, border: "1px solid " + C.danger + "44", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Remove</button>}
                          <button onClick={() => setShowReminderPicker(false)} style={{ padding: "10px 14px", background: C.surface, color: C.text, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                        </div>
                      </div>
                    )}
                    <button onClick={() => { setRolodexEditing(true); setRolodexEditData({ contact: sr.contact, months: sr.months, priority: sr.priority || "", notes: sr.notes || "", what: answers.what || "", work: answers.work || "", terms: answers.terms || "", comeback: answers.comeback || "", refer: answers.refer || "" }); }} style={{ width: "100%", padding: "10px", background: "transparent", color: C.primary, border: "1px solid " + C.primary + "44", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 10 }}>Edit Details</button>
                    <div style={{ marginTop: 10 }}>
                      {!rolodexRemoveConfirm ? (
                        <button onClick={() => setRolodexRemoveConfirm(true)} style={{ width: "100%", padding: "10px", background: "transparent", color: C.danger, border: "1px solid " + C.danger + "44", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Remove from Rolodex</button>
                      ) : (
                        <div style={{ background: C.bg, borderRadius: 12, padding: "16px", border: "1px solid " + C.border }}>
                          <p style={{ fontSize: 14, color: C.text, lineHeight: 1.55, marginBottom: 14 }}>This will remove {sr.client} from your Rolodex. No more check-in reminders, no more tracking. You can always add them back later.</p>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => { setRolodex(prev => prev.filter(x => x.id !== sr.id)); rolodexDb.delete(sr.id); setSelectedRolodex(null); setRolodexRemoveConfirm(false); }} style={{ flex: 1, padding: "10px", background: C.surface, color: C.textSec, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Remove</button>
                            <button className="r-btn" onClick={() => setRolodexRemoveConfirm(false)} style={{ padding: "10px 14px", background: C.btn, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
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
                        <input value={ed.contact} onChange={e => setRolodexEditData({...ed, contact: e.target.value})} style={{ width: "100%", padding: "12px 16px", border: "1.5px solid " + C.border, borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Months together</label>
                        <input type="number" value={ed.months} onChange={e => setRolodexEditData({...ed, months: parseInt(e.target.value) || 0})} style={{ width: "100%", padding: "12px 16px", border: "1.5px solid " + C.border, borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg }} />
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
                        <textarea value={ed.notes} onChange={e => setRolodexEditData({...ed, notes: e.target.value})} placeholder="Log a check-in, add context, anything worth remembering..." style={{ width: "100%", padding: "10px 12px", border: "1.5px solid " + C.border, borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg, minHeight: 80, resize: "vertical" }} />
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, marginTop: 16, marginBottom: 12 }}>History</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {sr.type === "former" ? (
                        <>
                          <div><label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>What happened?</label><textarea value={ed.what} onChange={e => setRolodexEditData({...ed, what: e.target.value})} placeholder="Contract ended, budget cut, went in-house..." style={{ width: "100%", padding: "10px 12px", border: "1.5px solid " + C.border, borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg, minHeight: 60, resize: "vertical" }} /></div>
                          <div><label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>How did it end?</label><textarea value={ed.terms} onChange={e => setRolodexEditData({...ed, terms: e.target.value})} placeholder="Good terms, neutral, rough..." style={{ width: "100%", padding: "10px 12px", border: "1.5px solid " + C.border, borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg, minHeight: 60, resize: "vertical" }} /></div>
                          <div><label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Would they come back?</label><textarea value={ed.comeback} onChange={e => setRolodexEditData({...ed, comeback: e.target.value})} placeholder="Yes, maybe, no..." style={{ width: "100%", padding: "10px 12px", border: "1.5px solid " + C.border, borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg, minHeight: 60, resize: "vertical" }} /></div>
                        </>
                      ) : (
                        <div><label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>What did you do for them?</label><textarea value={ed.work} onChange={e => setRolodexEditData({...ed, work: e.target.value})} placeholder="Site audit, consulting session..." style={{ width: "100%", padding: "10px 12px", border: "1.5px solid " + C.border, borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg, minHeight: 60, resize: "vertical" }} /></div>
                      )}
                      <div><label style={{ fontSize: 14, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Would they refer you?</label><textarea value={ed.refer} onChange={e => setRolodexEditData({...ed, refer: e.target.value})} placeholder="Even if they left, would they recommend you?" style={{ width: "100%", padding: "10px 12px", border: "1.5px solid " + C.border, borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg, minHeight: 60, resize: "vertical" }} /></div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                      <button onClick={() => setRolodexEditing(false)} style={{ padding: "10px 16px", background: C.surface, color: C.textSec, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                      <button onClick={() => {
                        const tags = [];
                        if ((ed.terms || "").toLowerCase().includes("good")) tags.push("Good terms");
                        if ((ed.refer || "").toLowerCase().includes("yes")) tags.push("Would refer");
                        if ((ed.comeback || "").toLowerCase().includes("yes")) tags.push("Would come back");
                        if (sr.type === "oneoff") tags.push("One-off");
                        const updated = { ...sr, contact: ed.contact, months: ed.months, priority: ed.priority, notes: ed.notes, tags };
                        setRolodex(prev => prev.map(x => x.id === sr.id ? updated : x));
                        setRetroAnswers(prev => ({ ...prev, [sr.id]: { ...prev[sr.id], what: ed.what, work: ed.work, terms: ed.terms, comeback: ed.comeback, refer: ed.refer } }));
                        setSelectedRolodex(updated);
                        setRolodexEditing(false);
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
            <div onClick={() => setRefEditing(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 90 }} />
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
                    <input value={refEditData.to || ""} onChange={e => setRefEditData({...refEditData, to: e.target.value})} style={{ width: "100%", padding: "12px 16px", border: "1.5px solid " + C.border, borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg }} />
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
                    <input type="number" value={refEditData.revenue || ""} onChange={e => setRefEditData({...refEditData, revenue: e.target.value})} placeholder="0" style={{ width: "100%", padding: "12px 16px", border: "1.5px solid " + C.border, borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg }} />
                  </div>
                  {(refEditData.status === "closed") && (
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: "block", marginBottom: 4 }}>Total revenue earned ($)</label>
                      <input type="number" value={refEditData.totalRevenue || ""} onChange={e => setRefEditData({...refEditData, totalRevenue: e.target.value})} placeholder="0" style={{ width: "100%", padding: "12px 16px", border: "1.5px solid " + C.border, borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg }} />
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                  <button onClick={() => setRefEditing(null)} style={{ padding: "10px 16px", background: C.surface, color: C.textSec, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                  <button className="r-btn" onClick={() => {
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


      {/* MOBILE BOTTOM NAV — hidden when keyboard is up so inputs aren't covered */}
      <div className="r-mob-bot" style={{ position: "fixed", top: "calc(var(--vv-offset-top, 0px) + var(--app-h, 100vh) - 82px)", left: 12, right: 12, background: C.surfaceWarm, borderRadius: 18, boxShadow: "0 2px 6px rgba(10,10,10,0.04), 0 4px 14px rgba(10,10,10,0.07)", justifyContent: "space-around", padding: "10px 6px 12px", zIndex: 40, display: keyboardOpen ? "none" : undefined }}>
        {(tier === "enterprise" ? mobileNavEnterprise : mobileNavCore).map(n => {
          const dot = hasDot(n.id);
          const active = page === n.id || (n.id === "more" && showMore);
          return (
            <div key={n.id} onClick={() => n.id === "more" ? setShowMore(!showMore) : goTo(n.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", padding: "5px 10px", borderRadius: 10, background: active ? C.deepCream : "transparent", boxShadow: active ? "inset 0 1px 2px rgba(0,0,0,0.06)" : "none", position: "relative" }}>
              <Icon name={n.icon} size={20} color={active ? C.primary : C.ink500} />
              <span style={{ fontSize: 9.5, fontWeight: active ? 700 : 600, color: active ? C.text : C.ink500 }}>{n.label}</span>
              {dot && <div style={{ position: "absolute", top: 2, right: 6, width: 7, height: 7, borderRadius: "50%", background: C.danger, boxShadow: "0 0 0 2.5px " + (active ? C.deepCream : C.surfaceWarm) }} />}
            </div>
          );
        })}
      </div>
      {showMore && (
        <>
          <div onClick={() => setShowMore(false)} style={{ position: "fixed", inset: 0, zIndex: 45 }} />
          <div style={{ position: "fixed", top: "calc(var(--vv-offset-top, 0px) + var(--app-h, 100vh) - 94px)", right: 20, transform: "translateY(-100%)", background: C.card, borderRadius: "12px 12px 12px 12px", border: "1px solid " + C.border, boxShadow: "0 -4px 24px rgba(0,0,0,0.08)", zIndex: 46, overflow: "hidden", minWidth: 180, animation: "fadeIn 0.15s ease" }}>
            {(tier === "enterprise" ? moreItemsEnterprise : moreItemsCore).map((m, i, arr) => (
              <div key={m.id} onClick={() => goTo(m.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", cursor: "pointer", borderBottom: "1px solid " + C.borderLight, background: page === m.id ? C.bg : "transparent" }}>
                <span style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name={m.icon} size={18} color={page === m.id ? C.text : C.textMuted} /></span><span style={{ fontSize: 13, fontWeight: page === m.id ? 700 : 500, color: page === m.id ? C.text : C.text, flex: 1 }}>{m.label}</span>
                {hasDot(m.id) && <Dot />}
              </div>
            ))}
            <div onClick={() => { setTier(tier === "core" ? "enterprise" : "core"); setShowMore(false); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", cursor: "pointer" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.textMuted }}>{tier === "enterprise" ? "Enterprise" : "Core"}</span>
              <div style={{ width: 36, height: 20, borderRadius: 10, background: tier === "enterprise" ? C.btn : C.borderLight, position: "relative", transition: "background 0.2s" }}>
                <div style={{ width: 16, height: 16, borderRadius: 8, background: "#fff", position: "absolute", top: 2, left: tier === "enterprise" ? 18 : 2, transition: "left 0.2s" }} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
