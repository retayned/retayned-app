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
const mobileNavEnterprisePrimary = [
  { id: "today", icon: "today", label: "Today" },
  { id: "sweeps", icon: "sweeps", label: "Sweeps" },
  { id: "clients", icon: "clients", label: "Clients" },
  { id: "coach", icon: "rai", label: "Rai" },
];
const mobileNavEnterpriseMore = [
  { id: "health", icon: "health", label: "Health" },
  { id: "referral_intel", icon: "target", label: "Referral Intel" },
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
  "Who needs attention this week?": "This week: Ridgeline (1-year approaching), Copper & Sage (review due), Foxglove (decision time).",
  "What patterns do my best clients share?": "Your top clients share three traits: they give honest feedback early, they trust your judgment on strategy, and they've been with you long enough to see results compound. Northvane and Oakline both check all three.",
};

const Dot = () => <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.danger, flexShrink: 0 }} />;

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

export { navItemsCore, navItemsEnterprise, mobileNavPrimary, mobileNavMore, mobileNavEnterprisePrimary, mobileNavEnterpriseMore, moreItemsCore, moreItemsEnterprise, coachOpeners, coachDemos, Dot };
