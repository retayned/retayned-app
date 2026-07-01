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
// Mobile bottom nav (June 2026 redesign): ALL destinations live on one
// horizontally-scrollable track. The center "+" FAB is pinned on its own layer
// and items scroll BEHIND it (fade masks dissolve them at the center and edges
// rather than hard-clipping). No "More" sheet, no three-dot menu — every page
// is one swipe away. Order = frequency: the 4 most-used first, then the rest.
const mobileNavStrip = [
  { id: "today", icon: "today", label: "Today" },
  { id: "clients", icon: "clients", label: "Clients" },
  { id: "health", icon: "health", label: "Health" },
  { id: "coach", icon: "rai", label: "Rai" },
  { id: "retros", icon: "rolodex", label: "Rolodex" },
  { id: "referrals", icon: "referrals", label: "Referrals" },
  { id: "workers", icon: "workers", label: "Workers" },
  { id: "settings", icon: "settings", label: "Settings" },
];



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

export { navItemsCore, mobileNavStrip };
