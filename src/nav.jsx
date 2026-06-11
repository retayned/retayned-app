import { C } from "./theme";

 
const navItemsCore = [
  { id: "today", icon: "today", label: "Today" },
  { id: "clients", icon: "clients", label: "Clients" },
  { id: "health", icon: "health", label: "Health" },
  { id: "retros", icon: "rolodex", label: "Rolodex" },
  { id: "referrals", icon: "referrals", label: "Referrals" },
  { id: "workers", icon: "workers", label: "Workers" },
  { id: "coach", icon: "rai", label: "Rai" },
];
// Mobile bottom nav — single horizontally-scrollable strip instead of a "More"
// popup. All destinations sit inline; user swipes the strip left/right to
// reveal additional items. The strip auto-scrolls to keep the active item in
// view when navigation happens. Order matters — primary destinations first
// (Today, Clients, Rai, Health) so they're visible without scrolling on
// typical phone widths.
// Mobile bottom nav — REBUILT as a fixed bar (no horizontal scroll, no JS
// positioning). 4 primary destinations flank a center capture FAB; everything
// else lives in the "More" sheet. Best-practice iOS pattern: rock-solid
// position:fixed bottom:0 + safe-area inset, nothing to lag on scroll.
const mobileNavPrimary = [
  { id: "today", icon: "today", label: "Today" },
  { id: "clients", icon: "clients", label: "Clients" },
  { id: "health", icon: "health", label: "Health" },
  { id: "coach", icon: "rai", label: "Rai" },
];
const mobileNavMore = [
  { id: "retros", icon: "rolodex", label: "Rolodex" },
  { id: "referrals", icon: "referrals", label: "Referrals" },
  { id: "workers", icon: "workers", label: "Workers" },
  { id: "settings", icon: "settings", label: "Settings" },
];
// Legacy "More" item lists — kept (empty-ish) so any straggler reference doesn't
// crash. The mobile More popup has been removed in favor of the swipeable strip.
const moreItemsCore = [];



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

export { navItemsCore, mobileNavPrimary, mobileNavMore, moreItemsCore };
