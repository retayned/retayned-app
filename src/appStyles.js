import React, { useState, useEffect, useRef } from "react";

// ═══ Shared palette ═══
const C = {
  primary: "#33543E", primaryDark: "#274230", primaryDeep: "#1C3224",
  primaryLight: "#558B68", primarySoft: "#E6EFE9", primaryGhost: "#F3F8F5",
  bg: "#FAFAF7", card: "#FFFFFF", surface: "#EEEFEB",
  surfaceWarm: "#F2EEE8", surfaceWarmEdge: "#E0DACB",
  surfaceCool: "#EBEDF0", surfaceCoolEdge: "#D1D5DB",
  text: "#1E261F", textSec: "#4A4F4A", textMuted: "#8A8F8A",
  border: "#D8DFD8", borderLight: "#E8ECE6",
  sidebar: "#1E261F", sidebarAccent: "#558B68",
  heroGrad: "linear-gradient(135deg, #1E261F, #2A382C)",
  danger: "#C4432B", dangerBg: "#FAE8E4",
  warning: "#B88B15", warningBg: "#FBF2DC",
  success: "#2D8659", successBg: "#E2F3EB",
  btn: "#7c5cf3", btnHover: "#6a4ce8",
  btnSoft: "rgba(124,92,243,0.06)", btnLight: "#d6cbfb",
  cardShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)",
  raiGrad: "linear-gradient(145deg, #1E261F 0%, #33543E 55%, #558B68 100%)",
};

// Spacing tokens (on an 8px-ish grid). Single source of truth for repeated gaps.
const EYEBROW_GAP = 24; // gap between an eyebrow pill and the headline beneath it
const HERO_TOP = 56; // gap from the top of the page content to the hero eyebrow

const HEADSHOT = "/AdamLawrence.jpg";

const inputStyle = { width: "100%", padding: "14px 16px", border: "2px solid " + C.border, borderRadius: 10, fontSize: 15, fontFamily: "inherit", background: C.card, boxSizing: "border-box", outline: "none" };

// ═══ Reveal on Scroll ═══

// ═══ Swipe Drawer ═══
function SwipeDrawer({ open, setOpen, children }) {
  const startX = useRef(0);
  const currentX = useRef(0);
  const dragging = useRef(false);
  const drawerRef = useRef(null);
  const DRAWER_W = 280;
  const EDGE_ZONE = 30;

  // Touch on overlay or edge of screen
  const handleTouchStart = (e) => {
    const x = e.touches[0].clientX;
    if (open) {
      startX.current = x;
      dragging.current = true;
    }
  };

  const handleTouchMove = (e) => {
    if (!dragging.current) return;
    currentX.current = e.touches[0].clientX;
    const diff = startX.current - currentX.current;
    if (diff > 0 && drawerRef.current) {
      drawerRef.current.style.transform = `translateX(${-diff}px)`;
    }
  };

  const handleTouchEnd = () => {
    if (!dragging.current) return;
    dragging.current = false;
    const diff = startX.current - currentX.current;
    if (diff > 80) {
      setOpen(false);
    }
    if (drawerRef.current) {
      drawerRef.current.style.transform = "";
    }
  };

  // Edge swipe to open
  useEffect(() => {
    const onTouchStart = (e) => {
      const x = e.touches[0].clientX;
      if (!open && x < EDGE_ZONE) {
        startX.current = x;
        dragging.current = true;
      }
    };
    const onTouchMove = (e) => {
      if (!dragging.current || open) return;
      currentX.current = e.touches[0].clientX;
    };
    const onTouchEnd = () => {
      if (!dragging.current || open) return;
      dragging.current = false;
      const diff = currentX.current - startX.current;
      if (diff > 60) {
        setOpen(true);
      }
    };
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [open, setOpen]);

  return (
    <>
      {/* Overlay */}
      <div
        onClick={() => setOpen(false)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 150,
          opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.3s ease",
        }}
      />
      {/* Drawer */}
      <div
        ref={drawerRef}
        onClick={e => e.stopPropagation()}
        style={{
          position: "fixed", top: 0, left: 0, width: DRAWER_W, height: "100%",
          background: C.card, zIndex: 200,
          boxShadow: open ? "4px 0 24px rgba(0,0,0,.1)" : "none",
          transform: open ? "translateX(0)" : `translateX(-${DRAWER_W}px)`,
          transition: "transform 0.3s ease",
          overflowY: "auto",
        }}
      >
        {children}
      </div>
    </>
  );
}

// ═══ Nav icon set (inline SVG, no asset loading) ═══
const NAV_ICONS = {
  today: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><rect x="5" y="7" width="22" height="20" rx="2" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="1.6"/><path d="M5 9 Q5 7 7 7 L25 7 Q27 7 27 9 L27 12 L5 12 Z" fill="#558B68" stroke="#2F2F31" strokeWidth="1.6" strokeLinejoin="round"/><line x1="11" y1="4" x2="11" y2="9" stroke="#2F2F31" strokeWidth="1.6" strokeLinecap="round"/><line x1="21" y1="4" x2="21" y2="9" stroke="#2F2F31" strokeWidth="1.6" strokeLinecap="round"/><circle cx="16" cy="20" r="5" fill="none" stroke="#558B68" strokeWidth="1.6"/><line x1="13" y1="20" x2="19" y2="20" stroke="#2F2F31" strokeWidth="1.4" strokeLinecap="round" opacity="0.5"/><line x1="13" y1="23" x2="17" y2="23" stroke="#2F2F31" strokeWidth="1.4" strokeLinecap="round" opacity="0.5"/></svg>,
  "retention-score": <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><path d="M5 22 Q5 8 16 8 Q27 8 27 22" fill="none" stroke="#2F2F31" strokeWidth="1.6" strokeLinecap="round"/><path d="M16 8 Q27 8 27 22" fill="none" stroke="#558B68" strokeWidth="2.2" strokeLinecap="round"/><line x1="5" y1="22" x2="7" y2="20.5" stroke="#2F2F31" strokeWidth="1.2" strokeLinecap="round"/><line x1="9" y1="13" x2="10.5" y2="14.5" stroke="#2F2F31" strokeWidth="1.2" strokeLinecap="round"/><line x1="16" y1="8" x2="16" y2="10" stroke="#2F2F31" strokeWidth="1.2" strokeLinecap="round"/><line x1="23" y1="13" x2="21.5" y2="14.5" stroke="#2F2F31" strokeWidth="1.2" strokeLinecap="round"/><line x1="27" y1="22" x2="25" y2="20.5" stroke="#2F2F31" strokeWidth="1.2" strokeLinecap="round"/><line x1="16" y1="22" x2="22" y2="13" stroke="#2F2F31" strokeWidth="1.8" strokeLinecap="round"/><circle cx="16" cy="22" r="2" fill="#558B68" stroke="#2F2F31" strokeWidth="1.4"/></svg>,
  "health-checks": <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><rect x="6" y="7" width="20" height="22" rx="2" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="1.6"/><rect x="12" y="4" width="8" height="5" rx="1" fill="#558B68" stroke="#2F2F31" strokeWidth="1.4"/><path d="M16 23 C 12 20.5, 9 18.5, 9 15.5 C 9 13.8, 10.4 12.5, 12 12.5 C 13.2 12.5, 14.4 13.2, 16 14.5 C 17.6 13.2, 18.8 12.5, 20 12.5 C 21.6 12.5, 23 13.8, 23 15.5 C 23 18.5, 20 20.5, 16 23 Z" fill="none" stroke="#558B68" strokeWidth="1.8" strokeLinejoin="round"/><path d="M9 18 L12 18 L13.5 15.5 L15 20.5 L17 16 L19 18 L23 18" fill="none" stroke="#2F2F31" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  "talk-to-rai": <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><path d="M5 9 Q5 6 8 6 L24 6 Q27 6 27 9 L27 19 Q27 22 24 22 L14 22 L9 27 L10 22 Q5 22 5 19 Z" fill="#558B68" stroke="#2F2F31" strokeWidth="1.6" strokeLinejoin="round"/><line x1="16" y1="6" x2="16" y2="2" stroke="#2F2F31" strokeWidth="1.4" strokeLinecap="round"/><circle cx="16" cy="1.6" r="1.4" fill="#558B68" stroke="#2F2F31" strokeWidth="1.2"/><ellipse cx="13" cy="13" rx="2.2" ry="2.6" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="1.2"/><circle cx="13" cy="13" r="1.2" fill="#2F2F31"/><ellipse cx="20" cy="13" rx="2.2" ry="2.6" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="1.2"/><circle cx="20" cy="13" r="1.2" fill="#2F2F31"/><path d="M12 18 Q16 20 20 18" fill="none" stroke="#FCFCFE" strokeWidth="1.4" strokeLinecap="round"/></svg>,
  rolodex: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><rect x="3" y="22" width="26" height="4" rx="1" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="1.6"/><circle cx="6" cy="14" r="2" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="1.4"/><circle cx="26" cy="14" r="2" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="1.4"/><line x1="6" y1="14" x2="26" y2="14" stroke="#2F2F31" strokeWidth="1.4"/><path d="M9 14 Q12 4 16 7 Q20 10 23 14 L20 14 L20 22 L12 22 L12 14 Z" fill="#558B68" stroke="#2F2F31" strokeWidth="1.6" strokeLinejoin="round"/><line x1="14" y1="16" x2="20" y2="16" stroke="#FCFCFE" strokeWidth="1.2" strokeLinecap="round"/><line x1="14" y1="19" x2="18" y2="19" stroke="#FCFCFE" strokeWidth="1.2" strokeLinecap="round"/><rect x="5" y="16" width="5" height="6" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="1.4"/></svg>,
  referrals: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><circle cx="6" cy="16" r="3.5" fill="#558B68" stroke="#2F2F31" strokeWidth="1.6"/><path d="M9.5 16 Q15 16 18 8" fill="none" stroke="#2F2F31" strokeWidth="1.6" strokeLinecap="round"/><path d="M9.5 16 Q15 16 18 24" fill="none" stroke="#2F2F31" strokeWidth="1.6" strokeLinecap="round"/><path d="M14 8 L18 7 L17 11" fill="none" stroke="#2F2F31" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 24 L18 25 L17 21" fill="none" stroke="#2F2F31" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><circle cx="22" cy="6" r="3" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="1.6"/><circle cx="26" cy="14" r="3" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="1.6"/><circle cx="22" cy="26" r="3" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="1.6"/><path d="M9.5 16 Q18 16 23 14" fill="none" stroke="#2F2F31" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  freelancers: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><ellipse cx="16" cy="25" rx="9" ry="2" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="1.4"/><path d="M8 14 L9.5 23 Q10 25 12 25 L20 25 Q22 25 22.5 23 L24 14 Z" fill="#558B68" stroke="#2F2F31" strokeWidth="1.6" strokeLinejoin="round"/><ellipse cx="16" cy="14" rx="8" ry="1.6" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="1.4"/><path d="M24 16 Q28 17 27 21 Q26 23 23 22.5" fill="none" stroke="#2F2F31" strokeWidth="1.6" strokeLinecap="round"/><path d="M14 11 Q12 8 14 6 Q16 4 15 2" fill="none" stroke="#2F2F31" strokeWidth="1.4" strokeLinecap="round"/><path d="M19 11 L20 9 L21 12 L22 8 L23 11" fill="none" stroke="#558B68" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  agencies: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><path d="M19 5 Q26 5 26 11 Q26 16 21 17 L19 20 L19 17 Q14 16 14 11 Q14 5 19 5 Z" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="1.6" strokeLinejoin="round"/><path d="M11 11 Q18 11 18 17 Q18 22 13 23 L11 26 L11 23 Q6 22 6 17 Q6 11 11 11 Z" fill="#558B68" stroke="#2F2F31" strokeWidth="1.6" strokeLinejoin="round"/><circle cx="9" cy="17" r="1" fill="#FCFCFE"/><circle cx="12" cy="17" r="1" fill="#FCFCFE"/><circle cx="15" cy="17" r="1" fill="#FCFCFE"/></svg>,
  workers: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><circle cx="11" cy="11" r="4" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="1.6"/><path d="M4 25 Q4 17 11 17 Q15 17 17 19" fill="#558B68" stroke="#2F2F31" strokeWidth="1.6" strokeLinejoin="round"/><path d="M17 13 L27 13 Q29 13 29 15 L29 21 Q29 23 27 23 L21 23 L18 26 L19 23 Q17 23 17 21 Z" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="1.6" strokeLinejoin="round"/><path d="M20 18 L22.5 20.5 L27 15.5" fill="none" stroke="#558B68" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  enterprise: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><rect x="4" y="14" width="11" height="14" rx="1" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="1.6"/><line x1="9.5" y1="14" x2="9.5" y2="28" stroke="#2F2F31" strokeWidth="1"/><line x1="4" y1="20" x2="15" y2="20" stroke="#2F2F31" strokeWidth="1" opacity="0.6"/><rect x="14" y="10" width="9" height="18" rx="1" fill="#558B68" stroke="#2F2F31" strokeWidth="1.6"/><line x1="14" y1="18" x2="23" y2="18" stroke="#FCFCFE" strokeWidth="1" opacity="0.7"/><line x1="18.5" y1="10" x2="18.5" y2="28" stroke="#FCFCFE" strokeWidth="1" opacity="0.7"/><rect x="22" y="16" width="7" height="12" rx="1" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="1.6"/><line x1="22" y1="22" x2="29" y2="22" stroke="#2F2F31" strokeWidth="1" opacity="0.6"/><line x1="25.5" y1="16" x2="25.5" y2="11" stroke="#2F2F31" strokeWidth="1.4"/><path d="M25.5 11 L29 12 L25.5 13.5 Z" fill="#558B68" stroke="#2F2F31" strokeWidth="1.2" strokeLinejoin="round"/></svg>,
};

function NavIcon({ name, size = 20 }) {
  const icon = NAV_ICONS[name];
  if (!icon) return null;
  return <span style={{ width: size, height: size, display: "inline-flex" }}>{React.cloneElement(icon, { width: size, height: size })}</span>;
}

// Hand-drawn iso-style icons for the interactive tools (match NAV_ICONS language).
const TOOL_ICONS = {
  health: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><path d="M16 27 C 9 22, 4 17.5, 4 12 C 4 8.4, 6.8 6, 10 6 C 12.4 6, 14.4 7.4, 16 9.6 C 17.6 7.4, 19.6 6, 22 6 C 25.2 6, 28 8.4, 28 12 C 28 17.5, 23 22, 16 27 Z" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="1.6" strokeLinejoin="round"/><path d="M6 16 L11 16 L13 11 L16 21 L19 13 L21 16 L26 16" fill="none" stroke="#558B68" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  calculator: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><rect x="7" y="4" width="18" height="24" rx="2.5" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="1.6"/><rect x="10" y="7" width="12" height="5" rx="1" fill="#558B68" stroke="#2F2F31" strokeWidth="1.4"/><g fill="#2F2F31"><circle cx="11.5" cy="17" r="1.3"/><circle cx="16" cy="17" r="1.3"/><circle cx="20.5" cy="17" r="1.3"/><circle cx="11.5" cy="21.5" r="1.3"/><circle cx="16" cy="21.5" r="1.3"/></g><rect x="19" y="20" width="3" height="5.5" rx="1.2" fill="#558B68" stroke="#2F2F31" strokeWidth="1.2"/></svg>,
  profile: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="11" r="5" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="1.6"/><path d="M6 27 Q6 18 16 18 Q26 18 26 27" fill="#558B68" stroke="#2F2F31" strokeWidth="1.6" strokeLinejoin="round"/><path d="M11 24 L14 24 L15.5 21 L17 27 L18.5 23 L21 24" fill="none" stroke="#FCFCFE" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  simulator: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><path d="M4 8 Q4 6 6 6 L19 6 Q21 6 21 8 L21 15 Q21 17 19 17 L11 17 L7 21 L8 17 Q4 17 4 15 Z" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="1.6" strokeLinejoin="round"/><path d="M14 14 Q14 12 16 12 L26 12 Q28 12 28 14 L28 20 Q28 22 26 22 L26 26 L22 22 L16 22 Q14 22 14 20 Z" fill="#558B68" stroke="#2F2F31" strokeWidth="1.6" strokeLinejoin="round"/></svg>,
};
function ToolIcon({ name, size = 30 }) {
  const icon = TOOL_ICONS[name];
  if (!icon) return null;
  return <span style={{ width: size, height: size, display: "inline-flex" }}>{React.cloneElement(icon, { width: size, height: size })}</span>;
}

// ═══ Nav ═══
function Nav({ page, setPage }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [platformOpen, setPlatformOpen] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const [mobilePlatformExpanded, setMobilePlatformExpanded] = useState(false);
  const [mobileSolutionsExpanded, setMobileSolutionsExpanded] = useState(false);
  const platformTimer = useRef(null);
  const solutionsTimer = useRef(null);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const openPlatform = () => {
    if (platformTimer.current) { clearTimeout(platformTimer.current); platformTimer.current = null; }
    setSolutionsOpen(false);
    setPlatformOpen(true);
  };
  const closePlatform = () => {
    platformTimer.current = setTimeout(() => setPlatformOpen(false), 150);
  };
  const openSolutions = () => {
    if (solutionsTimer.current) { clearTimeout(solutionsTimer.current); solutionsTimer.current = null; }
    setPlatformOpen(false);
    setSolutionsOpen(true);
  };
  const closeSolutions = () => {
    solutionsTimer.current = setTimeout(() => setSolutionsOpen(false), 150);
  };

  const features = [
    { id: "feature-today", label: "Today", desc: "The dash to keep more business", icon: "today" },
    { id: "feature-scoring", label: "Clients", desc: "Scored and sorted by what matters.", icon: "retention-score" },
    { id: "feature-health", label: "Health", desc: "Catch drift before damage.", icon: "health-checks" },
    { id: "feature-rolodex", label: "Rolodex", desc: "Forward-looking pipeline.", icon: "rolodex" },
    { id: "feature-referrals", label: "Referrals", desc: "Who's ready, with data.", icon: "referrals" },
    { id: "feature-workers", label: "Workers", desc: "Delegate by secure link.", icon: "workers" },
    { id: "feature-rai", label: "Rai", desc: "AI advisor for your book.", icon: "talk-to-rai" },
  ];
  const solutions = [
    { id: "freelancers", label: "Freelancers", desc: "For the one person holding every relationship.", icon: "freelancers" },
    { id: "agencies", label: "Agencies", desc: "For the team sharing the book.", icon: "agencies" },
    { id: "enterprise", label: "Enterprise", desc: "Account management as a service.", icon: "enterprise" },
  ];

  const topLinks = [
    { id: "pricing", label: "Pricing" },
    { id: "about", label: "About" },
    { id: "blog", label: "Resources" },
  ];

  const platformActive = ["feature-today", "feature-scoring", "feature-health", "feature-rai", "feature-rolodex", "feature-referrals", "feature-workers"].includes(page);
  const solutionsActive = ["freelancers", "agencies", "enterprise"].includes(page);

  return (
    <>
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: scrolled ? "rgba(242, 238, 232, 0.85)" : "#F2EEE8", WebkitBackdropFilter: scrolled ? "saturate(180%) blur(12px)" : "none", backdropFilter: scrolled ? "saturate(180%) blur(12px)" : "none", borderBottom: scrolled ? "1px solid rgba(0,0,0,0.06)" : "1px solid transparent", boxShadow: scrolled ? "0 1px 0 rgba(0,0,0,0.02), 0 8px 24px -12px rgba(0,0,0,0.08)" : "none", transition: "box-shadow 0.25s, border-color 0.25s, background 0.25s" }}>
        <div className="r-nav-inner" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", maxWidth: 1600, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button className="r-mobile-only" onClick={() => setOpen(!open)} aria-label={open ? "Close menu" : "Open menu"} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", alignItems: "center", zIndex: 110 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="2.5" strokeLinecap="round">
                {open ? <><line x1="6" y1="6" x2="18" y2="18" /><line x1="6" y1="18" x2="18" y2="6" /></> : <><line x1="3" y1="7" x2="21" y2="7" /><line x1="3" y1="12" x2="17" y2="12" /><line x1="3" y1="17" x2="21" y2="17" /></>}
              </svg>
            </button>
            <div style={{ display: "flex", alignItems: "baseline", cursor: "pointer" }} onClick={() => { setPage("home"); setOpen(false); }}>
              <span style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-0.04em", color: C.primary, fontFamily: "system-ui, -apple-system, sans-serif" }}>Retayned</span>
              <span style={{ fontSize: 24, fontWeight: 900, color: C.primary, marginLeft: 1, fontFamily: "system-ui, -apple-system, sans-serif" }}>.</span>
            </div>
          </div>
          <div className="r-desktop-nav" style={{ display: "none", alignItems: "baseline", gap: 28, position: "relative" }}>
            {/* Platform dropdown */}
            <div onMouseEnter={openPlatform} onMouseLeave={closePlatform} style={{ position: "relative" }}>
              <span
                onClick={() => platformOpen ? closePlatform() : openPlatform()}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === "Enter" && (platformOpen ? closePlatform() : openPlatform())}
                style={{
                  fontSize: 15,
                  fontWeight: platformActive ? 700 : 600,
                  color: platformActive ? C.primary : C.text,
                  cursor: "pointer",
                  letterSpacing: "-0.01em",
                  borderBottom: platformActive ? "2px solid " + C.btn : "2px solid transparent",
                  paddingBottom: 2,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                Platform
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6, transform: platformOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s", }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </span>
              {platformOpen && (
                <div
                  onMouseEnter={openPlatform}
                  onMouseLeave={closePlatform}
                  style={{
                    position: "absolute",
                    top: "calc(100% + 10px)",
                    left: "-14px",
                    background: C.card,
                    border: "1px solid " + C.border,
                    borderRadius: 16,
                    boxShadow: "0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.04)",
                    padding: 16,
                    minWidth: 360,
                    zIndex: 100,
                    animation: "megaFadeIn 0.2s ease",
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: C.textMuted, padding: "0 10px 10px", marginBottom: 4, borderBottom: "1px solid " + C.borderLight }}>Features</div>
                  {features.map((f, i) => (
                    <div
                      key={i}
                      onClick={() => { setPage(f.id); setPlatformOpen(false); }}
                      className="r-mega-row"
                      style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: 10, borderRadius: 8, cursor: "pointer" }}
                    >
                      <span style={{ width: 32, height: 32, borderRadius: 8, background: C.primarySoft, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><NavIcon name={f.icon} size={20} /></span>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{f.label}</span>
                        <span style={{ fontSize: 11.5, color: C.textSec, lineHeight: 1.4 }}>{f.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Solutions dropdown */}
            <div onMouseEnter={openSolutions} onMouseLeave={closeSolutions} style={{ position: "relative" }}>
              <span
                role="button"
                tabIndex={0}
                style={{
                  fontSize: 15,
                  fontWeight: solutionsActive ? 700 : 600,
                  color: solutionsActive ? C.primary : C.text,
                  cursor: "pointer",
                  letterSpacing: "-0.01em",
                  borderBottom: solutionsActive ? "2px solid " + C.btn : "2px solid transparent",
                  paddingBottom: 2,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                Solutions
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6, transform: solutionsOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s", }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </span>
              {solutionsOpen && (
                <div
                  onMouseEnter={openSolutions}
                  onMouseLeave={closeSolutions}
                  style={{
                    position: "absolute",
                    top: "calc(100% + 10px)",
                    left: "-14px",
                    background: C.card,
                    border: "1px solid " + C.border,
                    borderRadius: 16,
                    boxShadow: "0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.04)",
                    padding: 16,
                    minWidth: 360,
                    zIndex: 100,
                    animation: "megaFadeIn 0.2s ease",
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: C.textMuted, padding: "0 10px 10px", marginBottom: 4, borderBottom: "1px solid " + C.borderLight }}>For who</div>
                  {solutions.map((a, i) => (
                    <div
                      key={i}
                      onClick={() => { setPage(a.id); setSolutionsOpen(false); }}
                      className="r-mega-row"
                      style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: 10, borderRadius: 8, cursor: "pointer" }}
                    >
                      <span style={{ width: 32, height: 32, borderRadius: 8, background: C.primarySoft, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><NavIcon name={a.icon} size={20} /></span>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{a.label}</span>
                        <span style={{ fontSize: 11.5, color: C.textSec, lineHeight: 1.4 }}>{a.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Other top-level links */}
            {topLinks.map(l => (
              <span key={l.id} onClick={() => setPage(l.id)} role="button" tabIndex={0} onKeyDown={e => e.key === "Enter" && setPage(l.id)} style={{ fontSize: 15, fontWeight: page === l.id ? 700 : 600, color: page === l.id ? C.primary : C.text, cursor: "pointer", letterSpacing: "-0.01em", borderBottom: page === l.id ? "2px solid " + C.btn : "2px solid transparent", paddingBottom: 2, transition: "border-color 0.2s" }}>{l.label}</span>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <span className="r-desktop-nav" onClick={() => setPage("login")} role="button" tabIndex={0} onKeyDown={e => e.key === "Enter" && setPage("login")} style={{ fontSize: 14, fontWeight: 600, color: C.textSec, cursor: "pointer" }}>Log In</span>
          <button className="cta-btn" onClick={() => { setPage("signup"); setOpen(false); }} style={{ padding: "10px 22px", background: C.btn, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Start Free Trial
          </button>
        </div>
      </div>
      </nav>

      {/* Mobile drawer with expandable Platform group */}
      <SwipeDrawer open={open} setOpen={setOpen}>
        <div style={{ padding: "24px 24px 24px 24px" }}>
          <div style={{ display: "flex", alignItems: "baseline", marginBottom: 32, cursor: "pointer" }} onClick={() => { setPage("home"); setOpen(false); }}>
            <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.04em", color: C.primary, fontFamily: "system-ui, -apple-system, sans-serif" }}>Retayned</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: C.primary, marginLeft: 1, fontFamily: "system-ui, -apple-system, sans-serif" }}>.</span>
          </div>

          {/* Platform: label + chevron both expand the feature list */}
          <div style={{ display: "flex", alignItems: "stretch", borderBottom: "1px solid " + C.borderLight }}>
            <button
              onClick={() => setMobilePlatformExpanded(!mobilePlatformExpanded)}
              style={{
                flex: 1, textAlign: "left", padding: "14px 0",
                background: "none", border: "none",
                fontSize: 17, fontWeight: platformActive ? 700 : 500,
                color: platformActive ? C.primary : C.text,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Platform
            </button>
            <button
              onClick={() => setMobilePlatformExpanded(!mobilePlatformExpanded)}
              aria-label={mobilePlatformExpanded ? "Collapse Platform" : "Expand Platform"}
              style={{
                width: 44, display: "flex", alignItems: "center", justifyContent: "flex-end",
                background: "none", border: "none", cursor: "pointer", padding: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={platformActive ? C.primary : C.text} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, transform: mobilePlatformExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
          </div>

          {mobilePlatformExpanded && (
            <div style={{ paddingLeft: 8, paddingTop: 10, paddingBottom: 10 }}>
              {features.map(f => (
                <button
                  key={f.id}
                  onClick={() => { setPage(f.id); setOpen(false); setMobilePlatformExpanded(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    width: "100%", textAlign: "left", padding: "10px 0",
                    background: "none", border: "none",
                    fontSize: 15, fontWeight: page === f.id ? 700 : 500,
                    color: page === f.id ? C.primary : C.text,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  <span style={{ width: 28, height: 28, borderRadius: 6, background: C.primarySoft, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <NavIcon name={f.icon} size={18} />
                  </span>
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {/* Solutions expandable group */}
          <button
            onClick={() => setMobileSolutionsExpanded(!mobileSolutionsExpanded)}
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              width: "100%", textAlign: "left", padding: "14px 0",
              background: "none", border: "none",
              borderBottom: "1px solid " + C.borderLight,
              fontSize: 17, fontWeight: solutionsActive ? 700 : 500,
              color: solutionsActive ? C.primary : C.text,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Solutions
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, transform: mobileSolutionsExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {mobileSolutionsExpanded && (
            <div style={{ paddingLeft: 8, paddingTop: 10, paddingBottom: 10 }}>
              {solutions.map(a => (
                <button
                  key={a.id}
                  onClick={() => { setPage(a.id); setOpen(false); setMobileSolutionsExpanded(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    width: "100%", textAlign: "left", padding: "10px 0",
                    background: "none", border: "none",
                    fontSize: 15, fontWeight: page === a.id ? 700 : 500,
                    color: page === a.id ? C.primary : C.text,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  <span style={{ width: 28, height: 28, borderRadius: 6, background: C.primarySoft, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <NavIcon name={a.icon} size={18} />
                  </span>
                  {a.label}
                </button>
              ))}
            </div>
          )}

          {/* Other top-level links */}
          {topLinks.map(l => (
            <button key={l.id} onClick={() => { setPage(l.id); setOpen(false); }} style={{
              display: "block", width: "100%", textAlign: "left", padding: "14px 0",
              background: "none", border: "none",
              borderBottom: "1px solid " + C.borderLight,
              fontSize: 17, fontWeight: page === l.id ? 700 : 500,
              color: page === l.id ? C.primary : C.text,
              cursor: "pointer", fontFamily: "inherit",
            }}>
              {l.label}
            </button>
          ))}

          {/* Log In */}
          <button onClick={() => { setPage("login"); setOpen(false); }} style={{
            display: "block", width: "100%", textAlign: "left", padding: "14px 0",
            background: "none", border: "none",
            borderBottom: "1px solid " + C.borderLight,
            fontSize: 17, fontWeight: page === "login" ? 700 : 500,
            color: page === "login" ? C.primary : C.text,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            Log In
          </button>

          <button className="cta-btn" onClick={() => { setPage("signup"); setOpen(false); }} style={{
            width: "100%", padding: "14px 20px", background: C.btn, color: "#fff",
            border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit", marginTop: 24,
          }}>
            Try Free Now
          </button>
        </div>
      </SwipeDrawer>
    </>
  );
}

// ═══ Footer ═══
function Footer({ setPage }) {
  return (
    <footer className="v2-footer r-full-bleed">
      <style>{`
        .v2-footer { background: ${C.primaryDeep}; color: #fff; padding: 72px 48px 36px; }
        .v2-footer-inner {
          max-width: 1320px; margin: 0 auto;
          display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
          gap: 40px;
        }
        .v2-footer-wordmark {
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 26px; font-weight: 900;
          letter-spacing: -0.04em; color: #fff;
          margin-bottom: 14px; cursor: pointer;
        }
        .v2-footer-tag {
          font-size: 13px; color: rgba(255,255,255,0.5);
          line-height: 1.6; max-width: 280px;
        }
        .v2-footer-col h5 {
          font-size: 11px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.14em;
          color: rgba(255,255,255,0.5); margin: 0 0 14px;
        }
        .v2-footer-col a {
          display: block; font-size: 13px; color: rgba(255,255,255,0.85);
          margin-bottom: 9px; cursor: pointer; text-decoration: none;
        }
        .v2-footer-col a:hover { color: #fff; }
        .v2-footer-bottom {
          max-width: 1320px; margin: 40px auto 0;
          padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.08);
          font-size: 12px; color: rgba(255,255,255,0.4);
          display: flex; justify-content: space-between;
          flex-wrap: wrap; gap: 8px;
        }
        .v2-footer-citation {
          max-width: 1320px; margin: 32px auto 0;
          font-size: 11px; color: rgba(255,255,255,0.32);
          line-height: 1.5;
        }
        .v2-footer-citation sup { font-size: 9px; }
        @media (max-width: 1024px) {
          .v2-footer { padding: 56px 24px 32px; }
          .v2-footer-inner { grid-template-columns: 1fr 1fr; gap: 32px; }
        }
        @media (max-width: 640px) {
          .v2-footer { padding: 48px 20px 28px; }
          .v2-footer-inner { grid-template-columns: 1fr; gap: 28px; }
        }
      `}</style>
      <div className="v2-footer-inner">
        <div className="v2-footer-brand">
          <div className="v2-footer-wordmark" onClick={() => setPage("home")} role="button" tabIndex={0}>Retayned.</div>
          <p className="v2-footer-tag">The CRM that prevents churn. Built for the freelancers, agencies, and teams who take client relationships personally.</p>
        </div>
        <div className="v2-footer-col">
          <h5>Product</h5>
          <a href="/features/today" onClick={(e) => { e.preventDefault(); setPage("feature-today"); }}>Today</a>
          <a href="/features/retention-score" onClick={(e) => { e.preventDefault(); setPage("feature-scoring"); }}>Clients</a>
          <a href="/features/health-checks" onClick={(e) => { e.preventDefault(); setPage("feature-health"); }}>Health</a>
          <a href="/features/rolodex" onClick={(e) => { e.preventDefault(); setPage("feature-rolodex"); }}>Rolodex</a>
          <a href="/features/referrals" onClick={(e) => { e.preventDefault(); setPage("feature-referrals"); }}>Referrals</a>
          <a href="/features/workers" onClick={(e) => { e.preventDefault(); setPage("feature-workers"); }}>Workers</a>
          <a href="/features/talk-to-rai" onClick={(e) => { e.preventDefault(); setPage("feature-rai"); }}>Rai</a>
        </div>
        <div className="v2-footer-col">
          <h5>Who it's for</h5>
          <a href="/freelancers" onClick={(e) => { e.preventDefault(); setPage("freelancers"); }}>Freelancers</a>
          <a href="/agencies" onClick={(e) => { e.preventDefault(); setPage("agencies"); }}>Agencies</a>
          <a href="/enterprise" onClick={(e) => { e.preventDefault(); setPage("enterprise"); }}>Enterprise</a>
          <a href="/pricing" onClick={(e) => { e.preventDefault(); setPage("pricing"); }}>Pricing</a>
        </div>
        <div className="v2-footer-col">
          <h5>Company</h5>
          <a href="/about" onClick={(e) => { e.preventDefault(); setPage("about"); }}>About</a>
          <a href="/blog" onClick={(e) => { e.preventDefault(); setPage("blog"); }}>Blog</a>
          <a href="/contact" onClick={(e) => { e.preventDefault(); setPage("contact"); }}>Contact</a>
          <a href="/faq" onClick={(e) => { e.preventDefault(); setPage("faq"); }}>FAQ</a>
        </div>
        <div className="v2-footer-col">
          <h5>Legal</h5>
          <a href="/privacy" onClick={(e) => { e.preventDefault(); setPage("privacy"); }}>Privacy</a>
          <a href="/terms" onClick={(e) => { e.preventDefault(); setPage("terms"); }}>Terms</a>
        </div>
      </div>
      <div className="v2-footer-citation">
        <sup>1</sup> Reichheld, F. & Schefter, P. "The Economics of E-Loyalty." Harvard Business School / Bain & Company.
        <br /><sup>2</sup> Acquiring a new client costs 5–25× more than retaining one. Bain & Company; Harvard Business Review.
      </div>
      <div className="v2-footer-bottom">
        <div>© {new Date().getFullYear()} Maniac Digital, LLC · Retayned</div>
        <div>Built in Washington, DC · There's no "i" in Retayned.</div>
      </div>
    </footer>
  );
}

// Inline footer for pages ending in the 4-stop gradient — renders inside the gradient wrapper
// so the gradient flows seamlessly through it (no hard cut from gradient to solid).
// ═══ HOME FEATURE SWITCHER VISUALS ═══
// Renders the feature graphic for the homepage platform-section tab strip.
// Clients (the portfolio table) is rendered inline in the homepage section itself;
// this component covers the other six features, reusing their feature-page graphics.
function HomeFeatureVisual({ tab }) {
  const card = { background: C.card, borderRadius: 20, border: "1px solid " + C.border, padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.06)" };

  if (tab === "today") {
    return <div style={{ ...card, padding: 0, overflow: "hidden" }}><V2TodayFeed /></div>;
  }

  if (tab === "workers") {
    return <div style={{ ...card, padding: "32px 28px" }}><WorkersFlowGraphic /></div>;
  }

  if (tab === "scoring") {
    return (
      <div style={card}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center", marginBottom: 24 }}>
          <div style={{ textAlign: "center", flex: "0 0 auto" }}>
            <div style={{ width: 118, height: 118, borderRadius: "50%", background: "linear-gradient(135deg, #FEF3C7, #FDE68A)", border: "4px solid #92400E20", display: "inline-flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
              <span style={{ fontSize: 44, fontWeight: 900, color: "#92400E", lineHeight: 1 }}>67</span>
              <div style={{ position: "absolute", bottom: -10, background: "#fff", padding: "3px 10px", border: "1px solid #92400E30", borderRadius: 100, fontSize: 10, fontWeight: 700, color: "#92400E", textTransform: "uppercase", letterSpacing: ".08em" }}>At risk</div>
            </div>
          </div>
          <div style={{ flex: "1 1 200px" }}>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>Broadleaf Media</div>
            <div style={{ fontSize: 13, color: C.textMuted, marginTop: 3 }}>Rachel Chen · Account Lead · 14 months</div>
            <div style={{ marginTop: 12, fontSize: 12.5, color: C.danger, fontWeight: 700 }}>↓ Dropped 11 points in 2 weeks</div>
          </div>
        </div>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>Core dimensions</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[["Trust", 6, C.warning], ["Loyalty", 7, C.primaryLight], ["Expectations", 7, C.primaryLight], ["Grace", 5, C.warning]].map(([name, val, color]) => (
            <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: C.bg, borderRadius: 8, fontSize: 13 }}>
              <span style={{ color: C.textSec, fontWeight: 600 }}>{name}</span>
              <span style={{ fontWeight: 800, color }}>{val}/10</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>Active combinations</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ padding: "8px 14px", background: C.danger + "15", borderRadius: 8, fontSize: 12.5, color: C.danger, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.danger }} />No Room to Operate
          </div>
          <div style={{ padding: "8px 14px", background: C.warning + "15", borderRadius: 8, fontSize: 12.5, color: C.warning, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.warning }} />Ice Wall
          </div>
        </div>
      </div>
    );
  }

  if (tab === "health") {
    return (
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 2 }}>Health Check</div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.01em" }}>Broadleaf Media</div>
          </div>
          <div style={{ fontSize: 11.5, color: C.textMuted, fontWeight: 700 }}>2 of 5</div>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: C.borderLight, marginBottom: 22, overflow: "hidden" }}>
          <div style={{ width: "40%", height: "100%", background: C.primary }} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, lineHeight: 1.4, marginBottom: 18 }}>
          Has their communication cadence changed in the last month?
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { t: "Same as always — steady and responsive", sel: false },
            { t: "Slightly slower, but nothing alarming", sel: true },
            { t: "Noticeably quieter than they used to be", sel: false },
            { t: "Gone cold — I'm chasing replies", sel: false },
          ].map((o, i) => (
            <div key={i} style={{ padding: "13px 16px", borderRadius: 12, fontSize: 14, fontWeight: o.sel ? 700 : 500, border: "1.5px solid " + (o.sel ? C.primary : C.borderLight), background: o.sel ? C.primaryGhost : C.card, color: o.sel ? C.primary : C.textSec }}>{o.t}</div>
          ))}
        </div>
      </div>
    );
  }

  if (tab === "rolodex") {
    return (
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, paddingBottom: 14, borderBottom: "1px solid " + C.borderLight }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 2 }}>Rolodex</div>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em" }}>12 former clients</div>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 100, background: C.primarySoft, fontSize: 11, fontWeight: 700, color: C.primary }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.primary }} />3 ready now
          </div>
        </div>
        {[
          { name: "Maplewood Agency", type: "Former", months: "14 months together", reason: "Budget cut Q3 2024", tags: ["Would refer", "Would come back"], readiness: 88, signal: "Just raised Series A" },
          { name: "Harlow & Associates", type: "Former", months: "8 months together", reason: "Internal hire", tags: ["Would come back"], readiness: 82, signal: "Their hire just left" },
        ].map((r, i) => (
          <div key={i} style={{ padding: "14px 0", borderTop: i > 0 ? "1px solid " + C.borderLight : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{r.name}</span>
                  <span style={{ fontSize: 11, color: C.textMuted }}>{r.type} · {r.months}</span>
                </div>
                <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>Ended: {r.reason}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {r.tags.map(t => (
                    <span key={t} style={{ fontSize: 10.5, fontWeight: 600, padding: "3px 9px", borderRadius: 5, background: C.primarySoft, color: C.primary }}>{t}</span>
                  ))}
                </div>
              </div>
              <div style={{ textAlign: "center", flexShrink: 0 }}>
                <div style={{ width: 42, height: 42, borderRadius: "50%", background: C.success + "15", border: "1.5px solid " + C.success + "40", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13.5, fontWeight: 800, color: C.success }}>{r.readiness}</div>
                <div style={{ fontSize: 9.5, color: C.textMuted, marginTop: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>ready</div>
              </div>
            </div>
            <div style={{ padding: "8px 12px", background: C.primarySoft + "60", borderRadius: 8, fontSize: 12.5, color: C.primary }}>
              <strong>Signal:</strong> {r.signal}
            </div>
          </div>
        ))}
        <div style={{ marginTop: 16, fontSize: 13, color: C.btn, fontWeight: 700, textAlign: "center" }}>3 re-engagement opportunities this week</div>
      </div>
    );
  }

  if (tab === "referrals") {
    return (
      <div style={card}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 14 }}>Referral Intelligence · Last 90 days</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
          {[["Asked", "7"], ["Converted", "4"], ["Revenue added", "$18.4k"]].map(([label, val]) => (
            <div key={label} style={{ background: C.bg, borderRadius: 11, padding: 14, textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.primary, lineHeight: 1 }}>{val}</div>
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 12, color: C.text }}>Ready to refer this week</div>
        {[
          { name: "Northvane Studios", contact: "Sarah Chen", readiness: 94, note: "Just wrapped their anniversary retainer renewal." },
          { name: "Oakline Outdoors", contact: "James Park", readiness: 86, note: "Loyalty score hit 95 after Q1 campaign success." },
        ].map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 0", borderTop: i > 0 ? "1px solid " + C.borderLight : "none" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{r.name}</span>
                <span style={{ fontSize: 11.5, color: C.textMuted }}>· {r.contact}</span>
              </div>
              <div style={{ fontSize: 12.5, color: C.textSec, lineHeight: 1.45 }}>{r.note}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <div style={{ width: 56, height: 6, borderRadius: 3, background: C.borderLight, overflow: "hidden" }}>
                <div style={{ width: r.readiness + "%", height: "100%", background: "linear-gradient(90deg, " + C.primaryLight + ", " + C.success + ")" }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: C.success, minWidth: 28 }}>{r.readiness}</span>
            </div>
          </div>
        ))}
        <div style={{ marginTop: 16, padding: "12px 14px", background: C.primarySoft, borderRadius: 10, fontSize: 13, color: C.text, lineHeight: 1.55 }}>
          <strong style={{ color: C.primary }}>Rai says:</strong> Sarah at Northvane is textbook ready. Ask in-person at Thursday's sync — not by email.
        </div>
      </div>
    );
  }

  if (tab === "rai") {
    return (
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, paddingBottom: 14, borderBottom: "1px solid " + C.borderLight }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, " + C.primary + ", " + C.primaryLight + ")", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 15, fontWeight: 800 }}>✦</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800 }}>Rai</div>
            <div style={{ fontSize: 11.5, color: C.textMuted }}>Senior retention advisor</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ alignSelf: "flex-end", maxWidth: "82%", padding: "11px 15px", background: C.primary, color: "#fff", borderRadius: "16px 16px 4px 16px", fontSize: 13, lineHeight: 1.5 }}>
            Rachel at Broadleaf has been different lately. What should I do?
          </div>
          <div style={{ alignSelf: "flex-start", maxWidth: "92%", padding: "13px 15px", background: C.bg, borderRadius: "16px 16px 16px 4px", fontSize: 13, lineHeight: 1.6, border: "1px solid " + C.borderLight }}>
            <div style={{ fontWeight: 800, color: C.primary, marginBottom: 6, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 5 }}><span>✦</span> Rai</div>
            Rachel's score dropped from 78 to 67 over two check-ins. "No Room to Operate" just triggered.<br /><br />
            <strong style={{ color: C.text }}>Call her. Not email.</strong> Open with: <em>"I've noticed things have felt different lately — what's on your mind?"</em>
          </div>
          <div style={{ alignSelf: "flex-start", maxWidth: "82%", padding: "10px 14px", background: C.primarySoft, borderRadius: "14px 14px 14px 4px", fontSize: 12.5, color: C.primary, fontStyle: "italic" }}>
            I've flagged a profile re-evaluation for Broadleaf. Queue it after the call?
          </div>
        </div>
        <div style={{ marginTop: 18, padding: "11px 14px", background: C.surface, borderRadius: 10, fontSize: 12.5, color: C.textMuted }}>
          Ask Rai anything about your book...
        </div>
      </div>
    );
  }

  return null;
}

// ═══ HERO INTERACTIVE DEMO ═══
function V2TodayFeed() {
  // Breakpoint-aware row heights — same architecture as desktop+mobile reference files.
  const [bp, setBp] = useState(() => {
    if (typeof window === "undefined") return "desktop";
    if (window.innerWidth <= 420) return "small";
    if (window.innerWidth <= 760) return "mobile";
    return "desktop";
  });
  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      setBp(w <= 420 ? "small" : w <= 760 ? "mobile" : "desktop");
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const ROW_H = bp === "small" ? 150 : bp === "mobile" ? 142 : 124;
  const GAP = bp === "small" ? 10 : 12;
  const STEP = ROW_H + GAP;

  // 4-task pool with kind-based color tokens
  const pool = useRef([
    { id: "hollis",    kind: "deepen",    title: "Hollis & Lee just hit one year — send handwritten note", meta: "Tenure: 12 mo · LTV: $144k", score: 91 },
    { id: "baxter",    kind: "nurture",   title: "Baxter Firm renewal in 21 days, confirm updated scope with Jesse",          meta: "Tenure: 20 mo · LTV: $52k",     score: 87 },
    { id: "pinebrook", kind: "nurture",   title: "Pinebrook contract expires in 10 days — align pricing",   meta: "Tenure: 8 mo · LTV: $38k",     score: 76 },
    { id: "meridian",  kind: "develop",    title: "Meridian Co. needs a dedicated report on all our recent wins",            meta: "Tenure: 16 mo · LTV: $96k", score: 42 },
  ]).current;

  const raiLines = {
    meridian:  "Meridian's primed to expand — a recent-wins recap now sets up the upsell. Pulling it to second so it doesn't slip.",
    pinebrook: "I drafted this one for you: Pinebrook's renewal probability slipped this morning. Bumping it — they need you first.",
    baxter:    "Baxter Firm just confirmed scope on their renewal call. Pinebrook can wait — putting Baxter back ahead.",
    hollis:    "Hollis & Lee are stable at 91. They\'re not urgent today — dropping them so the at-risk accounts surface.",
  };

  const INITIAL = ["hollis","baxter","pinebrook","meridian"];

  const [order, setOrder] = useState(INITIAL);
  const [selectingId, setSelectingId] = useState(null);
  const [thinking, setThinking] = useState(false);
  const [raiText, setRaiText] = useState("");
  const [raiCaret, setRaiCaret] = useState(true);
  const [raiVisible, setRaiVisible] = useState(true);

  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    const sleep = (ms) => new Promise((r, rej) => {
      const t = setTimeout(() => cancelled.current ? rej() : r(), ms);
      return () => clearTimeout(t);
    });

    async function typeLine(text) {
      // fade out current, fade in new
      setRaiVisible(false);
      await sleep(280);
      setRaiText("");
      setRaiCaret(true);
      setRaiVisible(true);
      for (let i = 0; i < text.length; i++) {
        setRaiText(text.slice(0, i + 1));
        const ch = text[i];
        await sleep(ch === " " ? 14 : (16 + Math.random() * 22));
      }
      await sleep(1800);
      setRaiCaret(false);
    }

    async function moveTask(id, toIdx) {
      setThinking(true);
      await sleep(550);
      setSelectingId(id);
      await sleep(650);
      setOrder(prev => {
        const fromIdx = prev.indexOf(id);
        if (fromIdx < 0 || fromIdx === toIdx) return prev;
        const next = [...prev];
        next.splice(fromIdx, 1);
        next.splice(toIdx, 0, id);
        return next;
      });
      await sleep(780);
      setSelectingId(null);
      setThinking(false);
    }

    async function step(id, toIdx) {
      const typing = typeLine(raiLines[id]);
      await moveTask(id, toIdx);
      await typing;
      await sleep(900);
    }

    async function resetOrder() {
      setOrder(INITIAL);
    }

    async function choreography() {
      try {
        await sleep(1400);
        // eslint-disable-next-line no-constant-condition
        while (true) {
          await step("meridian", 1);
          await step("pinebrook", 2);
          await step("baxter", 2);
          await step("hollis", 3);
          await sleep(1600);
          await resetOrder();
          await sleep(1200);
        }
      } catch (e) {
        // cancelled — exit cleanly
      }
    }

    choreography();
    return () => { cancelled.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="v2tf-root">
      <div className="v2tf-body">
        <div className="v2tf-head">
          <div>
            <h3 className="v2tf-h">Today</h3>
            <div className="v2tf-sub">{order.length} tasks · sorted by Rai</div>
          </div>
          <div className={"v2tf-ranking" + (thinking ? " thinking" : "")}>Rai is ranking</div>
        </div>

        <div className="v2tf-list-wrap" style={{ height: `${4 * ROW_H + 3 * GAP}px` }}>
          <div
            className="v2tf-list"
            style={{ height: `${order.length * ROW_H + (order.length - 1) * GAP}px` }}
          >
            {pool.map(t => {
              const idx = order.indexOf(t.id);
              const visible = idx >= 0;
              const selecting = selectingId === t.id;
              return (
                <div
                  key={t.id}
                  className={"v2tf-task" + (selecting ? " selecting" : "") + (visible ? "" : " leaving")}
                  style={{
                    height: `${ROW_H}px`,
                    transform: `translateY(${(visible ? idx : 0) * STEP}px)`,
                  }}
                >
                  <div className="v2tf-row1">
                    <div className={"v2tf-label v2tf-label-" + t.kind}>{({ develop: "at-risk", nurture: "stable", deepen: "strong" })[t.kind] || t.kind}</div>
                    <div className={"v2tf-score v2tf-score-" + t.kind}>{t.score}</div>
                  </div>
                  <div className="v2tf-title">
                    {t.id === "pinebrook" && (
                      <span title="Created by Rai" style={{ color: C.btn, fontSize: 13, fontWeight: 700, marginRight: 6, verticalAlign: "0px", flexShrink: 0 }}>✦</span>
                    )}
                    {(t.id === "hollis" || t.id === "baxter") ? (
                      <span style={{ textDecoration: "underline", textDecorationStyle: "dotted", textDecorationColor: C.btn, textDecorationThickness: "2px", textUnderlineOffset: "3px" }}>{t.title}</span>
                    ) : t.title}
                  </div>
                  {(t.id === "hollis" || t.id === "baxter") ? (
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                      <span className="v2tf-meta">{t.meta}</span>
                      <span style={{ fontFamily: "'Caveat', cursive", color: C.btn, fontSize: 16, fontWeight: 700, lineHeight: 1.1 }}>(Rai can draft this for you with context)</span>
                    </div>
                  ) : (
                    <div className="v2tf-meta">{t.meta}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="v2tf-rai">
          <div className="v2tf-avatar" aria-label="Rai">
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="50" fill="#5c3dbf" />
              <path d="M50 18 L57 43 L82 50 L57 57 L50 82 L43 57 L18 50 L43 43 Z" fill="#ffffff" />
            </svg>
          </div>
          <div className="v2tf-msg">
            <span className={"v2tf-msg-line" + (raiVisible ? " show" : "")}>
              <b>Rai:</b> <span className="v2tf-msg-body">{raiText}</span>
              {raiCaret && <span className="v2tf-caret" />}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── JS-smooth-scroll wordmark tapestry ───
function V2ScrollBand({ items, direction = "left", speed = 35 }) {
  // items: array of { className, label, colorClass }
  // direction: "left" means content moves left (so track translates to negative X)
  // speed: pixels per second
  const trackRef = useRef(null);
  const rafRef = useRef(null);
  const lastTimeRef = useRef(null);
  const offsetRef = useRef(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    // Wait for layout, then capture width of one copy (half of total since we duplicate)
    const measure = () => track.scrollWidth / 2;
    let halfWidth = measure();

    const tick = (ts) => {
      if (lastTimeRef.current == null) lastTimeRef.current = ts;
      const dt = (ts - lastTimeRef.current) / 1000; // seconds
      lastTimeRef.current = ts;
      const delta = speed * dt * (direction === "left" ? -1 : 1);
      offsetRef.current += delta;
      // Wrap — keep offset in [-halfWidth, 0] for left, or [0, halfWidth] for right
      if (direction === "left") {
        if (offsetRef.current <= -halfWidth) offsetRef.current += halfWidth;
      } else {
        if (offsetRef.current >= 0) offsetRef.current -= halfWidth;
      }
      track.style.transform = `translate3d(${offsetRef.current}px, 0, 0)`;
      rafRef.current = requestAnimationFrame(tick);
    };

    // Initial offset for right direction — start at -halfWidth so content is "ahead"
    if (direction === "right") {
      offsetRef.current = -halfWidth;
      track.style.transform = `translate3d(${offsetRef.current}px, 0, 0)`;
    }

    // Start animation
    rafRef.current = requestAnimationFrame(tick);

    // Re-measure on window resize
    const onResize = () => {
      halfWidth = measure();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
    };
  }, [direction, speed]);

  return (
    <div className="v2-scroll-band">
      <div className="v2-scroll-track" ref={trackRef}>
        {items.map((it, i) => (
          <span key={"a" + i} className={it.className}>{it.label}</span>
        ))}
        {items.map((it, i) => (
          <span key={"b" + i} className={it.className}>{it.label}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Audience illustrations (freelancers / agencies / enterprise) ───
const AUDIENCE_SVG = {
  freelancers: "<g stroke=\"#2F2F31\" stroke-linejoin=\"round\" stroke-linecap=\"round\"> <path d=\"M230 90 L410 190 L230 290 L50 190 Z\" fill=\"#FCFCFE\" stroke-width=\"1.4\" opacity=\"0.6\"></path> <path d=\"M230 90 L410 190 L230 290 L50 190 Z\" fill=\"none\" stroke-width=\"1\" stroke-dasharray=\"3 4\" opacity=\"0.35\"></path> <path d=\"M150 180 L330 180 L390 210 L210 210 Z\" fill=\"#FCFCFE\" stroke-width=\"2\"></path> <path d=\"M210 210 L390 210 L390 218 L210 218 Z\" fill=\"#FCFCFE\" stroke-width=\"2\"></path> <path d=\"M210 210 L210 218 L150 188 L150 180 Z\" fill=\"#FCFCFE\" stroke-width=\"2\"></path> <path d=\"M220 215 L220 268 M378 215 L378 268 M222 215 L180 250\" fill=\"none\" stroke-width=\"2\"></path> <path d=\"M238 188 L326 188 L342 196 L254 196 Z\" fill=\"#FCFCFE\" stroke-width=\"1.8\"></path> <path d=\"M238 188 L254 196 L254 156 L238 148 Z\" fill=\"#558B68\" stroke-width=\"1.8\"></path> <path d=\"M238 148 L326 148 L342 156 L254 156 Z\" fill=\"#558B68\" stroke-width=\"1.8\"></path> <path d=\"M326 148 L342 156 L342 196 L326 188 Z\" fill=\"#558B68\" stroke-width=\"1.8\"></path> <path d=\"M248 154 L330 154 L330 185 L248 185 Z\" fill=\"#FCFCFE\" stroke-width=\"1.2\"></path> <g stroke=\"#2F2F31\" stroke-width=\"1.2\" opacity=\"0.7\"> <line x1=\"254\" y1=\"162\" x2=\"308\" y2=\"162\"></line> <line x1=\"254\" y1=\"170\" x2=\"298\" y2=\"170\"></line> <line x1=\"254\" y1=\"178\" x2=\"312\" y2=\"178\"></line> </g> <g> <ellipse cx=\"180\" cy=\"188\" rx=\"12\" ry=\"5\" fill=\"#FCFCFE\" stroke-width=\"1.6\"></ellipse> <path d=\"M168 188 L170 200 Q180 204 190 200 L192 188\" fill=\"#558B68\" stroke-width=\"1.6\"></path> <path d=\"M192 190 Q200 190 200 196 Q200 202 192 202\" fill=\"none\" stroke-width=\"1.6\"></path> <path d=\"M178 184 Q176 176 182 172\" fill=\"none\" stroke-width=\"1.4\"></path> <path d=\"M186 184 Q184 176 190 172\" fill=\"none\" stroke-width=\"1.4\"></path> </g> <g transform=\"translate(340 170)\"> <path d=\"M-6 8 L18 8 L14 24 L-2 24 Z\" fill=\"#FCFCFE\" stroke-width=\"1.6\"></path> <path d=\"M6 8 Q-6 -10 4 -18 Q14 -8 6 8\" fill=\"#558B68\" stroke-width=\"1.6\"></path> <path d=\"M10 6 Q20 -6 26 4 Q18 12 10 6\" fill=\"#558B68\" stroke-width=\"1.6\"></path> </g> <g transform=\"translate(300 188)\"> <path d=\"M0 0 L-10 -16 L4 -34\" fill=\"none\" stroke-width=\"2\"></path> <path d=\"M-2 -34 L12 -34 L6 -24 L-8 -24 Z\" fill=\"#558B68\" stroke-width=\"1.6\"></path> <ellipse cx=\"0\" cy=\"0\" rx=\"8\" ry=\"3\" fill=\"#FCFCFE\" stroke-width=\"1.6\"></ellipse> </g> <path d=\"M210 222 L210 180 L240 194 L240 236 Z\" fill=\"#FCFCFE\" stroke-width=\"2\"></path> </g>",
  agencies: "<g stroke=\"#2F2F31\" stroke-linejoin=\"round\" stroke-linecap=\"round\"> <path d=\"M230 70 L430 180 L230 290 L30 180 Z\" fill=\"#FCFCFE\" stroke-width=\"1.4\" opacity=\"0.45\"></path> <path d=\"M70 90 L230 6 L230 130 L70 214 Z\" fill=\"#FCFCFE\" stroke-width=\"1.6\" opacity=\"0.55\"></path> <path d=\"M118 90 L230 30 L230 110 L118 170 Z\" fill=\"#FCFCFE\" stroke-width=\"2\"></path> <path d=\"M118 90 L230 30 L240 34 L128 94 Z\" fill=\"#FCFCFE\" stroke-width=\"1.4\"></path> <g> <path d=\"M138 100 L168 84 L168 100 L138 116 Z\" fill=\"#558B68\" stroke-width=\"1.4\"></path> <path d=\"M178 80 L208 64 L208 80 L178 96 Z\" fill=\"#FCFCFE\" stroke-width=\"1.4\"></path> <path d=\"M138 132 L168 116 L168 132 L138 148 Z\" fill=\"#FCFCFE\" stroke-width=\"1.4\"></path> <path d=\"M178 112 L208 96 L208 112 L178 128 Z\" fill=\"#558B68\" stroke-width=\"1.4\"></path> </g> <path d=\"M118 170 L230 110 L240 114 L128 174 Z\" fill=\"#FCFCFE\" stroke-width=\"1.4\"></path> <path d=\"M230 124 L370 194 L230 264 L90 194 Z\" fill=\"#FCFCFE\" stroke-width=\"2\"></path> <line x1=\"160\" y1=\"159\" x2=\"300\" y2=\"229\" stroke-width=\"1\" opacity=\"0.4\"></line> <line x1=\"300\" y1=\"159\" x2=\"160\" y2=\"229\" stroke-width=\"1\" opacity=\"0.4\"></line> <path d=\"M370 194 L370 206 L230 276 L230 264 Z\" fill=\"#FCFCFE\" stroke-width=\"1.6\"></path> <path d=\"M230 264 L230 276 L90 206 L90 194 Z\" fill=\"#FCFCFE\" stroke-width=\"1.6\"></path> <line x1=\"100\" y1=\"200\" x2=\"100\" y2=\"252\" stroke-width=\"1.6\"></line> <line x1=\"360\" y1=\"200\" x2=\"360\" y2=\"252\" stroke-width=\"1.6\"></line> <line x1=\"230\" y1=\"270\" x2=\"230\" y2=\"318\" stroke-width=\"1.6\"></line> <line x1=\"230\" y1=\"130\" x2=\"230\" y2=\"178\" stroke-width=\"1.4\" opacity=\"0.5\"></line> <g transform=\"translate(168 162)\"> <path d=\"M0 0 L26 13 L26 -13 L0 -26 Z\" fill=\"#558B68\" stroke-width=\"1.6\"></path> <path d=\"M3 -3 L23 7 L23 -10 L3 -20 Z\" fill=\"#FCFCFE\" stroke-width=\"1\"></path> <path d=\"M13 6 L13 14 L20 18\" fill=\"none\" stroke-width=\"1.4\"></path> <ellipse cx=\"14\" cy=\"20\" rx=\"6\" ry=\"2\" fill=\"#FCFCFE\" stroke-width=\"1.2\"></ellipse> </g> <g transform=\"translate(292 162)\"> <path d=\"M0 0 L-26 13 L-26 -13 L0 -26 Z\" fill=\"#FCFCFE\" stroke-width=\"1.6\"></path> <path d=\"M-3 -3 L-23 7 L-23 -10 L-3 -20 Z\" fill=\"#558B68\" stroke-width=\"1\"></path> <path d=\"M-13 6 L-13 14 L-20 18\" fill=\"none\" stroke-width=\"1.4\"></path> <ellipse cx=\"-14\" cy=\"20\" rx=\"6\" ry=\"2\" fill=\"#FCFCFE\" stroke-width=\"1.2\"></ellipse> </g> <g transform=\"translate(150 218)\"> <path d=\"M0 0 L36 18 L52 10 L16 -8 Z\" fill=\"#FCFCFE\" stroke-width=\"1.4\"></path> <path d=\"M16 -8 L52 10 L52 -8 L16 -26 Z\" fill=\"#558B68\" stroke-width=\"1.4\"></path> <path d=\"M19 -10 L49 5 L49 -8 L19 -23 Z\" fill=\"#FCFCFE\" stroke-width=\"1\"></path> </g> <g transform=\"translate(258 218)\"> <path d=\"M0 0 L-36 18 L-52 10 L-16 -8 Z\" fill=\"#FCFCFE\" stroke-width=\"1.4\"></path> <path d=\"M-16 -8 L-52 10 L-52 -8 L-16 -26 Z\" fill=\"#FCFCFE\" stroke-width=\"1.4\"></path> <path d=\"M-19 -10 L-49 5 L-49 -8 L-19 -23 Z\" fill=\"#558B68\" stroke-width=\"1\"></path> </g> <g transform=\"translate(230 195)\"> <ellipse cx=\"0\" cy=\"0\" rx=\"9\" ry=\"4\" fill=\"#558B68\" stroke-width=\"1.4\"></ellipse> <path d=\"M-9 0 L-7 8 Q0 12 7 8 L9 0\" fill=\"#558B68\" stroke-width=\"1.4\"></path> <path d=\"M-3 -4 Q-5 -12 -1 -16\" fill=\"none\" stroke-width=\"1.2\"></path> <path d=\"M3 -4 Q1 -12 5 -16\" fill=\"none\" stroke-width=\"1.2\"></path> </g> <g transform=\"translate(120 160)\"> <path d=\"M0 0 L24 12 L24 -22 L0 -34 Z\" fill=\"#FCFCFE\" stroke-width=\"1.6\"></path> <line x1=\"2\" y1=\"14\" x2=\"2\" y2=\"40\" stroke-width=\"1.4\"></line> <line x1=\"22\" y1=\"24\" x2=\"22\" y2=\"50\" stroke-width=\"1.4\"></line> </g> <g transform=\"translate(316 160)\"> <path d=\"M0 0 L24 -12 L24 -46 L0 -34 Z\" fill=\"#FCFCFE\" stroke-width=\"1.6\"></path> <line x1=\"2\" y1=\"14\" x2=\"2\" y2=\"40\" stroke-width=\"1.4\"></line> <line x1=\"22\" y1=\"2\" x2=\"22\" y2=\"28\" stroke-width=\"1.4\"></line> </g> <g transform=\"translate(120 232)\"> <path d=\"M0 0 L24 12 L24 -22 L0 -34 Z\" fill=\"#FCFCFE\" stroke-width=\"1.6\"></path> <line x1=\"2\" y1=\"14\" x2=\"2\" y2=\"40\" stroke-width=\"1.4\"></line> <line x1=\"22\" y1=\"24\" x2=\"22\" y2=\"50\" stroke-width=\"1.4\"></line> </g> <g transform=\"translate(316 232)\"> <path d=\"M0 0 L24 -12 L24 -46 L0 -34 Z\" fill=\"#FCFCFE\" stroke-width=\"1.6\"></path> <line x1=\"2\" y1=\"14\" x2=\"2\" y2=\"40\" stroke-width=\"1.4\"></line> <line x1=\"22\" y1=\"2\" x2=\"22\" y2=\"28\" stroke-width=\"1.4\"></line> </g> <g transform=\"translate(60 244)\"> <path d=\"M-8 10 L14 10 L10 28 L-4 28 Z\" fill=\"#FCFCFE\" stroke-width=\"1.6\"></path> <path d=\"M3 10 Q-8 -8 0 -18 Q12 -8 3 10\" fill=\"#558B68\" stroke-width=\"1.6\"></path> <path d=\"M8 8 Q22 -2 26 6 Q14 14 8 8\" fill=\"#558B68\" stroke-width=\"1.4\"></path> </g> </g>",
  enterprise: "<g stroke=\"#2F2F31\" stroke-linejoin=\"round\" stroke-linecap=\"round\"> <ellipse cx=\"230\" cy=\"316\" rx=\"180\" ry=\"14\" fill=\"#2F2F31\" opacity=\"0.10\" stroke=\"none\"></ellipse> <path d=\"M230 310 L420 220 L420 234 L230 324 L40 234 L40 220 Z\" fill=\"#EAE0CE\" stroke-width=\"1.6\"></path> <path d=\"M230 70 L370 130 L230 190 L90 130 Z\" fill=\"#F2E8D6\" stroke-width=\"2\"></path> <path d=\"M90 130 L230 70 L230 190 L230 310 L90 250 Z\" fill=\"#E6DBC6\" stroke-width=\"2\"></path> <path d=\"M230 70 L370 130 L370 250 L230 310 L230 190 Z\" fill=\"#558B68\" stroke-width=\"2\"></path> <line x1=\"230\" y1=\"190\" x2=\"230\" y2=\"310\" stroke-width=\"2\"></line> <g stroke-width=\"1.2\" opacity=\"0.85\"> <line x1=\"90\" y1=\"160\" x2=\"230\" y2=\"220\"></line> <line x1=\"90\" y1=\"190\" x2=\"230\" y2=\"250\"></line> <line x1=\"90\" y1=\"220\" x2=\"230\" y2=\"280\"></line> <line x1=\"230\" y1=\"220\" x2=\"370\" y2=\"160\"></line> <line x1=\"230\" y1=\"250\" x2=\"370\" y2=\"190\"></line> <line x1=\"230\" y1=\"280\" x2=\"370\" y2=\"220\"></line> </g> <g stroke-width=\"1.2\" fill=\"#FCFCFE\"> <path d=\"M104 144 L132 132 L132 152 L104 164 Z\"></path> <path d=\"M148 124 L176 112 L176 132 L148 144 Z\" fill=\"#558B68\"></path> <path d=\"M192 104 L220 92 L220 112 L192 124 Z\"></path> <path d=\"M104 174 L132 162 L132 182 L104 194 Z\" fill=\"#558B68\"></path> <path d=\"M148 154 L176 142 L176 162 L148 174 Z\"></path> <path d=\"M192 134 L220 122 L220 142 L192 154 Z\" fill=\"#558B68\"></path> <path d=\"M104 204 L132 192 L132 212 L104 224 Z\"></path> <path d=\"M148 184 L176 172 L176 192 L148 204 Z\" fill=\"#558B68\"></path> <path d=\"M192 164 L220 152 L220 172 L192 184 Z\"></path> <path d=\"M104 234 L132 222 L132 254 L104 266 Z\"></path> <path d=\"M148 214 L176 202 L176 232 L148 244 Z\"></path> <line x1=\"162\" y1=\"208\" x2=\"162\" y2=\"238\" stroke-width=\"1\"></line> <path d=\"M192 194 L220 182 L220 212 L192 224 Z\" fill=\"#558B68\"></path> </g> <g stroke-width=\"1.2\" fill=\"#FCFCFE\"> <path d=\"M250 144 L278 156 L278 136 L250 124 Z\"></path> <path d=\"M294 168 L322 180 L322 160 L294 148 Z\" fill=\"#558B68\"></path> <path d=\"M338 192 L366 204 L366 184 L338 172 Z\"></path> <path d=\"M250 174 L278 186 L278 166 L250 154 Z\" fill=\"#558B68\"></path> <path d=\"M294 198 L322 210 L322 190 L294 178 Z\"></path> <path d=\"M338 222 L366 234 L366 214 L338 202 Z\" fill=\"#558B68\"></path> <path d=\"M250 204 L278 216 L278 196 L250 184 Z\"></path> <path d=\"M294 228 L322 240 L322 220 L294 208 Z\" fill=\"#558B68\"></path> <path d=\"M338 252 L366 264 L366 244 L338 232 Z\"></path> <path d=\"M250 234 L278 246 L278 216 L250 204 Z\"></path> <path d=\"M294 258 L322 270 L322 240 L294 228 Z\"></path> <path d=\"M338 282 L366 294 L366 264 L338 252 Z\" fill=\"#558B68\"></path> </g> <line x1=\"230\" y1=\"70\" x2=\"230\" y2=\"34\" stroke-width=\"2\"></line> <circle cx=\"230\" cy=\"30\" r=\"3\" fill=\"#558B68\" stroke-width=\"1.4\"></circle> <g fill=\"none\" stroke-width=\"1.4\"> <path d=\"M222 30 Q230 18 238 30\"></path> <path d=\"M216 30 Q230 10 244 30\" opacity=\"0.6\"></path> </g> <g transform=\"translate(70 280)\"> <path d=\"M0 0 Q-9 -16 0 -26 Q9 -16 0 0 Z\" fill=\"#558B68\" stroke-width=\"1.4\"></path> <line x1=\"0\" y1=\"0\" x2=\"0\" y2=\"10\" stroke-width=\"1.4\"></line> </g> <g transform=\"translate(390 280)\"> <path d=\"M0 0 Q-9 -16 0 -26 Q9 -16 0 0 Z\" fill=\"#558B68\" stroke-width=\"1.4\"></path> <line x1=\"0\" y1=\"0\" x2=\"0\" y2=\"10\" stroke-width=\"1.4\"></line> </g> <g transform=\"translate(120 296)\"> <path d=\"M0 0 Q-7 -12 0 -20 Q7 -12 0 0 Z\" fill=\"#558B68\" stroke-width=\"1.4\"></path> <line x1=\"0\" y1=\"0\" x2=\"0\" y2=\"8\" stroke-width=\"1.4\"></line> </g> <g transform=\"translate(340 296)\"> <path d=\"M0 0 Q-7 -12 0 -20 Q7 -12 0 0 Z\" fill=\"#558B68\" stroke-width=\"1.4\"></path> <line x1=\"0\" y1=\"0\" x2=\"0\" y2=\"8\" stroke-width=\"1.4\"></line> </g> </g>",
};

function AudienceIllustration({ tab }) {
  const inner = AUDIENCE_SVG[tab] || AUDIENCE_SVG.freelancers;
  return (
    <svg
      viewBox="0 0 460 340"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "auto", display: "block" }}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}


// ─── Main HomeV2 component ───
function HomeV2({ setPage }) {
  // Toggle the homepage platform feature-switcher. false = original Clients-only
  // section (current). Set true to bring back the 7-tab switcher (code preserved below).
  const SHOW_FEATURE_SWITCHER = false;
  const [audienceTab, setAudienceTab] = useState("freelancers");
  const [activeTab, setActiveTab] = useState(1);
  const [expandedText, setExpandedText] = useState(false);

  // Spaceship scroll-trigger: add .animate when Final CTA enters viewport
  const finalCtaRef = useRef(null);
  useEffect(() => {
    const el = finalCtaRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            el.classList.add("v2-final-animate");
            obs.disconnect();
          }
        });
      },
      { threshold: 0.25 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const homeTabs = [
    { id: "today", label: "Today", icon: "◉", headline: "One page. Every priority.", sub: "Your Today tab is where Rai suggests and ranks the work that matters most — tasks sorted by an invisible priority engine that weighs relationship health against business value. Green clients surface first. At-risk clients with high revenue jump the line." },
    { id: "scoring", label: "Clients", icon: "◎", headline: "Every relationship, scored and sorted.", sub: "Your client list, ranked by what matters. Each client carries a Retention Score built from 12 weighted dimensions and 20 combination signals — a 1–99 read on exactly where the relationship stands, not where you hope it does." },
    { id: "health", label: "Health", icon: "♡", headline: "Catch the drift before it becomes damage.", sub: "Structured check-ins that surface what you already sense but haven't said out loud. The twelve relationship dimensions assess health directly, so keeping a profile current keeps its score honest. No lengthy forms. Just the signal." },
    { id: "rolodex", label: "Rolodex", icon: "⟐", headline: "Your pipeline is forward-looking.", sub: "Former clients aren't dead relationships — they're future revenue. The Rolodex tracks who left, how it ended, and whether they'd come back. One-off projects become re-engagement opportunities." },
    { id: "referrals", label: "Referrals", icon: "⟡", headline: "Your best clients send you their friends.", sub: "Retayned tracks referral readiness based on loyalty, trust, and relationship depth. When a client is ready to refer, the system knows before you do." },
    { id: "workers", label: "Workers", icon: "⟿", headline: "Delegate the task. Keep the relationship.", sub: "Hand a single task to a contractor or VA with one secure link — no account, no login, no access to the rest of your book. The work flows outward; you stay the hub." },
    { id: "rai", label: "Rai", icon: "✦", headline: "She writes the words you need when it matters most.", sub: "Rai is an AI advisor calibrated to your specific relationships. When you don't know what to say — the opening line, the tone, whether to call or email — Rai gives you the script." },
  ];
  const ht = homeTabs[activeTab];

  const dimensions = [
    { className: "v2-dim v2-dim-serif-italic", label: "Grace" },
    { className: "v2-dim v2-dim-heavy-caps", label: "TRUST" },
    { className: "v2-dim v2-dim-spaced-lower", label: "communication" },
    { className: "v2-dim v2-dim-serif", label: "Loyalty" },
    { className: "v2-dim v2-dim-small-caps", label: "BUDGET RISK" },
    { className: "v2-dim v2-dim-serif-italic-lg", label: "Depth" },
    { className: "v2-dim v2-dim-small-caps", label: "STRESS" },
    { className: "v2-dim v2-dim-serif-italic", label: "Expectations" },
    { className: "v2-dim v2-dim-spaced-lower", label: "FUNGIBILITY" },
    { className: "v2-dim v2-dim-serif-italic-lg", label: "tone" },
    { className: "v2-dim v2-dim-heavy-caps", label: "AUTHORITY" },
    { className: "v2-dim v2-dim-small-caps", label: "REPORTING" },
  ];

  const combinations = [
    { className: "v2-wm v2-wm-pos v2-wm-bulletproof", label: "Bulletproof" },
    { className: "v2-wm v2-wm-neg v2-wm-icewall", label: "Ice Wall" },
    { className: "v2-wm v2-wm-pos v2-wm-lockedvault", label: "LOCKED VAULT" },
    { className: "v2-wm v2-wm-neg v2-wm-ontheclock", label: "On the Clock" },
    { className: "v2-wm v2-wm-pos v2-wm-cornerstone", label: "Cornerstone" },
    { className: "v2-wm v2-wm-neg v2-wm-silentexit", label: "Silent Exit" },
    { className: "v2-wm v2-wm-pos v2-wm-decisionexpress", label: "DECISION EXPRESS" },
    { className: "v2-wm v2-wm-neg v2-wm-noroom", label: "NO ROOM TO OPERATE" },
    { className: "v2-wm v2-wm-pos v2-wm-truepartner", label: "True Partner" },
    { className: "v2-wm v2-wm-neg v2-wm-tickingbomb", label: "TICKING TIME BOMB" },
    { className: "v2-wm v2-wm-pos v2-wm-smoothop", label: "Smooth Operator" },
    { className: "v2-wm v2-wm-neg v2-wm-onefoot", label: "One Foot Out" },
    { className: "v2-wm v2-wm-pos v2-wm-allinvestor", label: "All-in Investor" },
    { className: "v2-wm v2-wm-neg v2-wm-powderkeg", label: "POWDER KEG" },
    { className: "v2-wm v2-wm-pos v2-wm-openbook", label: "Open Book" },
    { className: "v2-wm v2-wm-neg v2-wm-nickeldime", label: "Nickel and Dime" },
    { className: "v2-wm v2-wm-pos v2-wm-resilient", label: "RESILIENT UNDER FIRE" },
    { className: "v2-wm v2-wm-neg v2-wm-noanchor", label: "No Anchor" },
    { className: "v2-wm v2-wm-pos v2-wm-lowmaint", label: "Low Maintenance Loyalty" },
    { className: "v2-wm v2-wm-neg v2-wm-bottleneck", label: "BOTTLENECK DOOM" },
  ];

  const audiencePanels = {
    freelancers: {
      h: "A team of one, finally backed up.",
      p: "You're a team of one. You can't be laser-focused on every Slack thread and hint of drift. Retayned watches the whole book while you do the work.",
      cta: "See Platform",
      ctaTarget: "freelancers",
    },
    agencies: {
      h: "Your team's memory, on one system.",
      p: "When an account manager leaves, they take 40 client relationships with them. Retayned holds that institutional knowledge for the next rep (and you).",
      cta: "See Agencies",
      ctaTarget: "agencies",
    },
    enterprise: {
      h: "A managed agent for your whole book.",
      p: "Retayned scores every account and surfaces the next right action. You choose who acts on it — your account managers, your AI agents, or both.",
      cta: "See Enterprise",
      ctaTarget: "enterprise",
    },
  };
  const panel = audiencePanels[audienceTab];

  return (
    <div className="v2-root">
      {/* ══════ HERO ══════ */}
      <section className="v2-hero r-full-bleed">
        <div className="v2-hero-inner">
          <div className="v2-trust-pill">
            <svg className="v2-trust-dot" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 4.2 C8.5 2.8 3.4 6 3.1 11.5 C2.8 17.2 7.6 21.4 13 21 C18.4 20.6 21.8 16.2 20.7 11 C19.9 7.1 16.4 4.2 11.6 4.6 C9.9 4.7 8.3 5.4 7.4 6.6" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round" /></svg>
            For freelancers, solopreneurs, and agency owners.
          </div>
          <h1 className="v2-hero-h1">
            The AI-native CRM that{" "}
            <span className="v2-strike-wrap">
              <span className="v2-strike">predicts</span>
              <span className="v2-caveat">prevents</span>
            </span>{" "}churn.
          </h1>
          <p className="v2-hero-sub">Stop losing clients you should have kept.</p>
          <p className="v2-hero-desc">Replace the spreadsheets, docs, and notes with an AI agent that manages your entire client book.</p>
          <div className="v2-hero-cta-row">
            <button className="v2-btn-primary-lg cta-btn" onClick={() => setPage("signup")}>Start Free Trial</button>
          </div>
          <p className="v2-hero-fine">14-day free trial. No credit card required.</p>

          <div className="v2-hero-device">
            <div className="v2-hero-device-inner">
              <V2TodayFeed />
            </div>
          </div>
        </div>
      </section>

      {/* curve: hero (beige) → stats (cream) */}
      <div className="v2-curve r-full-bleed r-no-pad" style={{ background: "#F2EEE8" }}>
        <svg viewBox="0 0 1440 100" preserveAspectRatio="none"><path d="M 0,100 L 1440,100 L 1440,20 Q 720,140 0,30 Z" fill={C.bg} /></svg>
      </div>

      {/* ══════ MEET RAI ══════ */}
      <section className="v2-section-rai r-full-bleed">
        <div className="v2-section-inner">
          <div className="v2-section-head">
            <div className="v2-eyebrow">How it works</div>
            <h2 className="v2-section-h2">Meet <span style={{ color: C.btn }}>Rai</span>. She pays attention to every client, every day.</h2>
            <p className="v2-section-sub">When something shifts, she catches it — and tells you what to do about it.</p>
          </div>
          <div className="v2-rai-steps">
            {[
              {
                num: "01",
                h: <>She watches.</>,
                p: "Email tone, meeting cadence, payment timing — every signal that ever predicted a client leaving. Across all 30 of your relationships. While you're in your fourth Zoom of the day.",
                bg: `url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20360%20300%22%3E%0A%20%20%0A%0A%20%20%0A%20%20%3Cg%20transform%3D%22translate%2814%2022%29%22%3E%0A%20%20%20%20%3Crect%20x%3D%220%22%20y%3D%220%22%20width%3D%2236%22%20height%3D%2228%22%20rx%3D%223%22%20fill%3D%22%23558B68%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%3E%3C/rect%3E%0A%20%20%20%20%3Ccircle%20cx%3D%228%22%20cy%3D%2220%22%20r%3D%221.4%22%20fill%3D%22%23FCFCFE%22%3E%3C/circle%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2214%22%20cy%3D%2214%22%20r%3D%221.4%22%20fill%3D%22%23FCFCFE%22%3E%3C/circle%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2220%22%20cy%3D%2218%22%20r%3D%221.4%22%20fill%3D%22%23FCFCFE%22%3E%3C/circle%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2226%22%20cy%3D%2210%22%20r%3D%221.4%22%20fill%3D%22%23FCFCFE%22%3E%3C/circle%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2230%22%20cy%3D%228%22%20r%3D%221.4%22%20fill%3D%22%23FCFCFE%22%3E%3C/circle%3E%0A%20%20%20%20%3Cpolyline%20points%3D%224%2C22%2012%2C18%2020%2C14%2028%2C10%2032%2C6%22%20fill%3D%22none%22%20stroke%3D%22%23FCFCFE%22%20stroke-width%3D%221.4%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3C/polyline%3E%0A%20%20%3C/g%3E%0A%0A%20%20%0A%20%20%3Cg%20transform%3D%22translate%2856%2014%29%22%3E%0A%20%20%20%20%3Crect%20x%3D%220%22%20y%3D%220%22%20width%3D%2236%22%20height%3D%2228%22%20rx%3D%223%22%20fill%3D%22%23FCFCFE%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.2%22%3E%3C/rect%3E%0A%20%20%20%20%0A%20%20%20%20%3Cpath%20d%3D%22M4%206%20Q4%204%206%204%20L18%204%20Q20%204%2020%206%20L20%2012%20Q20%2014%2018%2014%20L10%2014%20L6%2017%20L7%2014%20Q4%2014%204%2012%20Z%22%20fill%3D%22%23FCFCFE%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221%22%3E%3C/path%3E%0A%20%20%20%20%3Cline%20x1%3D%227%22%20y1%3D%228%22%20x2%3D%2217%22%20y2%3D%228%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%220.9%22%20stroke-linecap%3D%22round%22%3E%3C/line%3E%0A%20%20%20%20%3Cline%20x1%3D%227%22%20y1%3D%2211%22%20x2%3D%2214%22%20y2%3D%2211%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%220.9%22%20stroke-linecap%3D%22round%22%3E%3C/line%3E%0A%20%20%20%20%0A%20%20%20%20%3Cpath%20d%3D%22M16%2017%20Q16%2015%2018%2015%20L30%2015%20Q32%2015%2032%2017%20L32%2023%20Q32%2025%2030%2025%20L22%2025%20L19%2028%20L20%2025%20Q16%2025%2016%2023%20Z%22%20fill%3D%22%232F2F31%22%3E%3C/path%3E%0A%20%20%20%20%3Cline%20x1%3D%2219%22%20y1%3D%2219%22%20x2%3D%2229%22%20y2%3D%2219%22%20stroke%3D%22%23FCFCFE%22%20stroke-width%3D%220.9%22%20stroke-linecap%3D%22round%22%3E%3C/line%3E%0A%20%20%20%20%3Cline%20x1%3D%2219%22%20y1%3D%2222%22%20x2%3D%2227%22%20y2%3D%2222%22%20stroke%3D%22%23FCFCFE%22%20stroke-width%3D%220.9%22%20stroke-linecap%3D%22round%22%3E%3C/line%3E%0A%20%20%3C/g%3E%0A%0A%20%20%0A%20%20%3Cg%20transform%3D%22translate%2816%2058%29%22%3E%0A%20%20%20%20%3Crect%20x%3D%220%22%20y%3D%220%22%20width%3D%2236%22%20height%3D%2228%22%20rx%3D%223%22%20fill%3D%22%23FCFCFE%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.2%22%3E%3C/rect%3E%0A%20%20%20%20%3Cg%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.6%22%20stroke-linecap%3D%22round%22%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%226%22%20y1%3D%2222%22%20x2%3D%226%22%20y2%3D%2216%22%3E%3C/line%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%2212%22%20y1%3D%2222%22%20x2%3D%2212%22%20y2%3D%2210%22%3E%3C/line%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%2218%22%20y1%3D%2222%22%20x2%3D%2218%22%20y2%3D%2214%22%3E%3C/line%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%2224%22%20y1%3D%2222%22%20x2%3D%2224%22%20y2%3D%228%22%3E%3C/line%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%2230%22%20y1%3D%2222%22%20x2%3D%2230%22%20y2%3D%2212%22%3E%3C/line%3E%0A%20%20%20%20%3C/g%3E%0A%20%20%3C/g%3E%0A%0A%20%20%0A%20%20%3Cg%20transform%3D%22translate%28264%2010%29%22%3E%0A%20%20%20%20%3Crect%20x%3D%220%22%20y%3D%220%22%20width%3D%2236%22%20height%3D%2228%22%20rx%3D%223%22%20fill%3D%22%23FCFCFE%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.2%22%3E%3C/rect%3E%0A%20%20%20%20%3Cpolyline%20points%3D%224%2C16%2010%2C18%2016%2C12%2022%2C14%2028%2C6%2032%2C10%22%20fill%3D%22none%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3C/polyline%3E%0A%20%20%3C/g%3E%0A%0A%20%20%0A%20%20%3Cg%20transform%3D%22translate%28308%2024%29%22%3E%0A%20%20%20%20%3Crect%20x%3D%220%22%20y%3D%220%22%20width%3D%2236%22%20height%3D%2228%22%20rx%3D%223%22%20fill%3D%22%23FCFCFE%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.2%22%3E%3C/rect%3E%0A%20%20%20%20%3Cpath%20d%3D%22M4%205%20Q4%203%206%203%20L20%203%20Q22%203%2022%205%20L22%2011%20Q22%2013%2020%2013%20L10%2013%20L6%2016%20L7%2013%20Q4%2013%204%2011%20Z%22%20fill%3D%22%23FCFCFE%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221%22%3E%3C/path%3E%0A%20%20%20%20%3Cline%20x1%3D%227%22%20y1%3D%227%22%20x2%3D%2219%22%20y2%3D%227%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%220.9%22%20stroke-linecap%3D%22round%22%3E%3C/line%3E%0A%20%20%20%20%3Cline%20x1%3D%227%22%20y1%3D%2210%22%20x2%3D%2216%22%20y2%3D%2210%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%220.9%22%20stroke-linecap%3D%22round%22%3E%3C/line%3E%0A%20%20%20%20%3Cpath%20d%3D%22M14%2016%20Q14%2014%2016%2014%20L30%2014%20Q32%2014%2032%2016%20L32%2022%20Q32%2024%2030%2024%20L20%2024%20L17%2027%20L18%2024%20Q14%2024%2014%2022%20Z%22%20fill%3D%22%232F2F31%22%3E%3C/path%3E%0A%20%20%20%20%3Cline%20x1%3D%2217%22%20y1%3D%2218%22%20x2%3D%2229%22%20y2%3D%2218%22%20stroke%3D%22%23FCFCFE%22%20stroke-width%3D%220.9%22%20stroke-linecap%3D%22round%22%3E%3C/line%3E%0A%20%20%20%20%3Cline%20x1%3D%2217%22%20y1%3D%2221%22%20x2%3D%2225%22%20y2%3D%2221%22%20stroke%3D%22%23FCFCFE%22%20stroke-width%3D%220.9%22%20stroke-linecap%3D%22round%22%3E%3C/line%3E%0A%20%20%3C/g%3E%0A%0A%20%20%0A%20%20%3Cg%20transform%3D%22translate%28306%2062%29%22%3E%0A%20%20%20%20%3Crect%20x%3D%220%22%20y%3D%220%22%20width%3D%2236%22%20height%3D%2228%22%20rx%3D%223%22%20fill%3D%22%23558B68%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%3E%3C/rect%3E%0A%20%20%20%20%3Cpolyline%20points%3D%224%2C22%2010%2C18%2016%2C14%2022%2C16%2028%2C10%2032%2C6%22%20fill%3D%22none%22%20stroke%3D%22%23FCFCFE%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3C/polyline%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%226%22%20r%3D%222%22%20fill%3D%22%23FCFCFE%22%3E%3C/circle%3E%0A%20%20%3C/g%3E%0A%0A%20%20%0A%20%20%3Cg%20transform%3D%22translate%2812%20212%29%22%3E%0A%20%20%20%20%3Crect%20x%3D%220%22%20y%3D%220%22%20width%3D%2236%22%20height%3D%2228%22%20rx%3D%223%22%20fill%3D%22%23FCFCFE%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.2%22%3E%3C/rect%3E%0A%20%20%20%20%3Cpolyline%20points%3D%224%2C12%2010%2C10%2016%2C16%2022%2C14%2028%2C22%2032%2C20%22%20fill%3D%22none%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3C/polyline%3E%0A%20%20%3C/g%3E%0A%0A%20%20%0A%20%20%3Cg%20transform%3D%22translate%2814%20250%29%22%3E%0A%20%20%20%20%3Crect%20x%3D%220%22%20y%3D%220%22%20width%3D%2236%22%20height%3D%2228%22%20rx%3D%223%22%20fill%3D%22%23FCFCFE%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.2%22%3E%3C/rect%3E%0A%20%20%20%20%3Ccircle%20cx%3D%228%22%20cy%3D%2210%22%20r%3D%221.3%22%20fill%3D%22%232F2F31%22%3E%3C/circle%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2214%22%20cy%3D%2218%22%20r%3D%221.3%22%20fill%3D%22%232F2F31%22%3E%3C/circle%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2222%22%20cy%3D%2214%22%20r%3D%221.3%22%20fill%3D%22%232F2F31%22%3E%3C/circle%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2228%22%20cy%3D%2220%22%20r%3D%221.3%22%20fill%3D%22%232F2F31%22%3E%3C/circle%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2232%22%20cy%3D%228%22%20r%3D%221.3%22%20fill%3D%22%232F2F31%22%3E%3C/circle%3E%0A%20%20%3C/g%3E%0A%0A%20%20%0A%20%20%3Cg%20transform%3D%22translate%28304%20222%29%22%3E%0A%20%20%20%20%3Crect%20x%3D%220%22%20y%3D%220%22%20width%3D%2236%22%20height%3D%2228%22%20rx%3D%223%22%20fill%3D%22%23FCFCFE%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.2%22%3E%3C/rect%3E%0A%20%20%20%20%3Cg%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.6%22%20stroke-linecap%3D%22round%22%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%226%22%20y1%3D%2222%22%20x2%3D%226%22%20y2%3D%2210%22%3E%3C/line%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%2212%22%20y1%3D%2222%22%20x2%3D%2212%22%20y2%3D%2216%22%3E%3C/line%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%2218%22%20y1%3D%2222%22%20x2%3D%2218%22%20y2%3D%228%22%3E%3C/line%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%2224%22%20y1%3D%2222%22%20x2%3D%2224%22%20y2%3D%2214%22%3E%3C/line%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%2230%22%20y1%3D%2222%22%20x2%3D%2230%22%20y2%3D%226%22%3E%3C/line%3E%0A%20%20%20%20%3C/g%3E%0A%20%20%3C/g%3E%0A%0A%20%20%0A%20%20%3Cg%20transform%3D%22translate%28308%20260%29%22%3E%0A%20%20%20%20%3Crect%20x%3D%220%22%20y%3D%220%22%20width%3D%2236%22%20height%3D%2228%22%20rx%3D%223%22%20fill%3D%22%23FCFCFE%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.2%22%3E%3C/rect%3E%0A%20%20%20%20%3Cpolyline%20points%3D%224%2C20%2010%2C14%2016%2C8%2022%2C12%2028%2C10%2032%2C4%22%20fill%3D%22none%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3C/polyline%3E%0A%20%20%3C/g%3E%0A%0A%20%20%0A%20%20%3Cg%20fill%3D%22%232F2F31%22%20opacity%3D%220.18%22%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2280%22%20cy%3D%22118%22%20r%3D%221.4%22%3E%3C/circle%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2296%22%20cy%3D%2296%22%20r%3D%221.4%22%3E%3C/circle%3E%0A%20%20%20%20%3Ccircle%20cx%3D%22104%22%20cy%3D%22152%22%20r%3D%221.4%22%3E%3C/circle%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2272%22%20cy%3D%22172%22%20r%3D%221.4%22%3E%3C/circle%3E%0A%20%20%20%20%3Ccircle%20cx%3D%22266%22%20cy%3D%22108%22%20r%3D%221.4%22%3E%3C/circle%3E%0A%20%20%20%20%3Ccircle%20cx%3D%22284%22%20cy%3D%22146%22%20r%3D%221.4%22%3E%3C/circle%3E%0A%20%20%20%20%3Ccircle%20cx%3D%22272%22%20cy%3D%22186%22%20r%3D%221.4%22%3E%3C/circle%3E%0A%20%20%20%20%3Ccircle%20cx%3D%22252%22%20cy%3D%22130%22%20r%3D%221.4%22%3E%3C/circle%3E%0A%20%20%3C/g%3E%0A%0A%20%20%0A%20%20%3Cg%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221%22%20stroke-linecap%3D%22round%22%20fill%3D%22none%22%20opacity%3D%220.4%22%20stroke-dasharray%3D%222%203%22%3E%0A%20%20%20%20%3Cpath%20d%3D%22M50%2034%20L146%20118%22%3E%3C/path%3E%0A%20%20%20%20%3Cpath%20d%3D%22M56%2072%20L146%20128%22%3E%3C/path%3E%0A%20%20%20%20%3Cpath%20d%3D%22M52%2086%20L146%20160%22%3E%3C/path%3E%0A%20%20%20%20%3Cpath%20d%3D%22M300%2030%20L214%20118%22%3E%3C/path%3E%0A%20%20%20%20%3Cpath%20d%3D%22M324%2090%20L214%20128%22%3E%3C/path%3E%0A%20%20%20%20%3Cpath%20d%3D%22M48%20232%20L146%20180%22%3E%3C/path%3E%0A%20%20%20%20%3Cpath%20d%3D%22M48%20264%20L146%20190%22%3E%3C/path%3E%0A%20%20%20%20%3Cpath%20d%3D%22M322%20240%20L214%20180%22%3E%3C/path%3E%0A%20%20%20%20%3Cpath%20d%3D%22M326%20280%20L214%20184%22%3E%3C/path%3E%0A%20%20%3C/g%3E%0A%0A%20%20%0A%20%20%3Cg%20transform%3D%22translate%28106%20102%29%22%3E%0A%20%20%20%20%3Crect%20x%3D%223%22%20y%3D%225%22%20width%3D%22150%22%20height%3D%22110%22%20rx%3D%2210%22%20fill%3D%22%232F2F31%22%20opacity%3D%220.10%22%3E%3C/rect%3E%0A%20%20%20%20%3Crect%20x%3D%220%22%20y%3D%220%22%20width%3D%22150%22%20height%3D%22110%22%20rx%3D%2210%22%20fill%3D%22%23FCFCFE%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%222.2%22%20stroke-linejoin%3D%22round%22%3E%3C/rect%3E%0A%0A%20%20%20%20%3Cline%20x1%3D%2212%22%20y1%3D%2214%22%20x2%3D%2270%22%20y2%3D%2214%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%222.2%22%20stroke-linecap%3D%22round%22%3E%3C/line%3E%0A%20%20%20%20%3Cline%20x1%3D%2212%22%20y1%3D%2221%22%20x2%3D%2252%22%20y2%3D%2221%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.3%22%20stroke-linecap%3D%22round%22%20opacity%3D%220.7%22%3E%3C/line%3E%0A%20%20%20%20%3Crect%20x%3D%22104%22%20y%3D%228%22%20width%3D%2234%22%20height%3D%2214%22%20rx%3D%227%22%20fill%3D%22%23558B68%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.2%22%3E%3C/rect%3E%0A%20%20%20%20%3Ccircle%20cx%3D%22112%22%20cy%3D%2215%22%20r%3D%222%22%20fill%3D%22%23FCFCFE%22%3E%3C/circle%3E%0A%20%20%20%20%3Cline%20x1%3D%22118%22%20y1%3D%2215%22%20x2%3D%22132%22%20y2%3D%2215%22%20stroke%3D%22%23FCFCFE%22%20stroke-width%3D%221.6%22%20stroke-linecap%3D%22round%22%3E%3C/line%3E%0A%0A%20%20%20%20%3Crect%20x%3D%2212%22%20y%3D%2232%22%20width%3D%22126%22%20height%3D%2264%22%20rx%3D%224%22%20fill%3D%22%23FCFCFE%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.2%22%3E%3C/rect%3E%0A%20%20%20%20%3Cg%20stroke%3D%22%232F2F31%22%20stroke-width%3D%220.8%22%20opacity%3D%220.25%22%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%2212%22%20y1%3D%2248%22%20x2%3D%22138%22%20y2%3D%2248%22%3E%3C/line%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%2212%22%20y1%3D%2264%22%20x2%3D%22138%22%20y2%3D%2264%22%3E%3C/line%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%2212%22%20y1%3D%2280%22%20x2%3D%22138%22%20y2%3D%2280%22%3E%3C/line%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%2240%22%20y1%3D%2232%22%20x2%3D%2240%22%20y2%3D%2296%22%3E%3C/line%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%2272%22%20y1%3D%2232%22%20x2%3D%2272%22%20y2%3D%2296%22%3E%3C/line%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%22104%22%20y1%3D%2232%22%20x2%3D%22104%22%20y2%3D%2296%22%3E%3C/line%3E%0A%20%20%20%20%3C/g%3E%0A%20%20%20%20%3Cg%20fill%3D%22%232F2F31%22%20opacity%3D%220.45%22%3E%0A%20%20%20%20%20%20%3Ccircle%20cx%3D%2222%22%20cy%3D%2282%22%20r%3D%221.3%22%3E%3C/circle%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2274%22%20r%3D%221.3%22%3E%3C/circle%3E%3Ccircle%20cx%3D%2238%22%20cy%3D%2278%22%20r%3D%221.3%22%3E%3C/circle%3E%0A%20%20%20%20%20%20%3Ccircle%20cx%3D%2246%22%20cy%3D%2270%22%20r%3D%221.3%22%3E%3C/circle%3E%3Ccircle%20cx%3D%2254%22%20cy%3D%2266%22%20r%3D%221.3%22%3E%3C/circle%3E%3Ccircle%20cx%3D%2262%22%20cy%3D%2272%22%20r%3D%221.3%22%3E%3C/circle%3E%0A%20%20%20%20%20%20%3Ccircle%20cx%3D%2270%22%20cy%3D%2260%22%20r%3D%221.3%22%3E%3C/circle%3E%3Ccircle%20cx%3D%2278%22%20cy%3D%2258%22%20r%3D%221.3%22%3E%3C/circle%3E%3Ccircle%20cx%3D%2286%22%20cy%3D%2252%22%20r%3D%221.3%22%3E%3C/circle%3E%0A%20%20%20%20%20%20%3Ccircle%20cx%3D%2294%22%20cy%3D%2254%22%20r%3D%221.3%22%3E%3C/circle%3E%3Ccircle%20cx%3D%22102%22%20cy%3D%2246%22%20r%3D%221.3%22%3E%3C/circle%3E%3Ccircle%20cx%3D%22110%22%20cy%3D%2248%22%20r%3D%221.3%22%3E%3C/circle%3E%0A%20%20%20%20%20%20%3Ccircle%20cx%3D%22118%22%20cy%3D%2242%22%20r%3D%221.3%22%3E%3C/circle%3E%3Ccircle%20cx%3D%22126%22%20cy%3D%2238%22%20r%3D%221.3%22%3E%3C/circle%3E%3Ccircle%20cx%3D%2234%22%20cy%3D%2288%22%20r%3D%221.3%22%3E%3C/circle%3E%0A%20%20%20%20%20%20%3Ccircle%20cx%3D%2258%22%20cy%3D%2280%22%20r%3D%221.3%22%3E%3C/circle%3E%3Ccircle%20cx%3D%2282%22%20cy%3D%2266%22%20r%3D%221.3%22%3E%3C/circle%3E%3Ccircle%20cx%3D%22106%22%20cy%3D%2258%22%20r%3D%221.3%22%3E%3C/circle%3E%0A%20%20%20%20%20%20%3Ccircle%20cx%3D%22122%22%20cy%3D%2252%22%20r%3D%221.3%22%3E%3C/circle%3E%0A%20%20%20%20%3C/g%3E%0A%20%20%20%20%3Cpolyline%20points%3D%2218%2C84%2034%2C78%2052%2C70%2070%2C62%2088%2C54%20106%2C46%20124%2C40%20134%2C36%22%20fill%3D%22none%22%20stroke%3D%22%23558B68%22%20stroke-width%3D%223%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3C/polyline%3E%0A%20%20%20%20%3Ccircle%20cx%3D%22124%22%20cy%3D%2240%22%20r%3D%224.8%22%20fill%3D%22%23558B68%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.6%22%3E%3C/circle%3E%0A%20%20%20%20%3Cline%20x1%3D%22124%22%20y1%3D%2240%22%20x2%3D%22124%22%20y2%3D%2228%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221%22%20stroke-linecap%3D%22round%22%3E%3C/line%3E%0A%20%20%20%20%3Ccircle%20cx%3D%22124%22%20cy%3D%2226%22%20r%3D%222.2%22%20fill%3D%22%23FCFCFE%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221%22%3E%3C/circle%3E%0A%0A%20%20%20%20%3Cline%20x1%3D%2212%22%20y1%3D%22102%22%20x2%3D%2290%22%20y2%3D%22102%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.3%22%20stroke-linecap%3D%22round%22%3E%3C/line%3E%0A%20%20%20%20%3Cline%20x1%3D%2296%22%20y1%3D%22102%22%20x2%3D%22138%22%20y2%3D%22102%22%20stroke%3D%22%23558B68%22%20stroke-width%3D%223%22%20stroke-linecap%3D%22round%22%3E%3C/line%3E%0A%20%20%3C/g%3E%0A%0A%20%20%0A%20%20%3Cg%20transform%3D%22translate%28250%20160%29%22%3E%0A%20%20%20%20%3Ccircle%20cx%3D%220%22%20cy%3D%220%22%20r%3D%2214%22%20fill%3D%22%23558B68%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%222%22%3E%3C/circle%3E%0A%20%20%20%20%3Cpath%20d%3D%22M0%2C-8%20L2%2C-2%20L8%2C0%20L2%2C2%20L0%2C8%20L-2%2C2%20L-8%2C0%20L-2%2C-2%20Z%22%20fill%3D%22%23FCFCFE%22%20stroke%3D%22none%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3C/path%3E%0A%20%20%3C/g%3E%0A%3C/svg%3E")`,
              },
              {
                num: "02",
                h: <>She decides.</>,
                p: "Most signals are really just noise. Rai cuts the day's intel down to the small handful of things you'd actually act on if you had the time to read every email twice.",
                bg: `url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20360%20300%22%3E%0A%20%20%0A%0A%20%20%0A%20%20%3Cg%20fill%3D%22none%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%0A%20%20%20%20%3Cpath%20d%3D%22M150%2058%20Q144%2044%20154%2034%20Q162%2024%20154%2012%22%3E%3C/path%3E%0A%20%20%20%20%3Cpath%20d%3D%22M178%2054%20Q172%2038%20182%2028%20Q188%2020%20182%208%22%3E%3C/path%3E%0A%20%20%20%20%3Cpath%20d%3D%22M204%2060%20Q198%2046%20208%2036%20Q216%2026%20208%2014%22%3E%3C/path%3E%0A%20%20%3C/g%3E%0A%0A%20%20%0A%20%20%3Cg%20transform%3D%22translate%28110%2070%29%22%3E%0A%20%20%20%20%3Cpath%20fill%3D%22%23FCFCFE%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%222%22%20stroke-linejoin%3D%22round%22%20d%3D%22M130%2050%20Q170%2050%20170%2090%20Q170%20130%20130%20130%22%3E%3C/path%3E%0A%20%20%20%20%3Cpath%20fill%3D%22none%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%20stroke-linecap%3D%22round%22%20d%3D%22M130%2062%20Q158%2062%20158%2090%20Q158%20118%20130%20118%22%3E%3C/path%3E%0A%20%20%20%20%3Cpath%20fill%3D%22%23FCFCFE%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%222%22%20stroke-linejoin%3D%22round%22%20d%3D%22M6%2044%20Q4%2038%2012%2038%20L134%2038%20Q142%2038%20140%2044%20L132%20174%20Q130%20184%20120%20184%20L26%20184%20Q16%20184%2014%20174%20Z%22%3E%3C/path%3E%0A%20%20%20%20%3Cellipse%20cx%3D%2273%22%20cy%3D%2245%22%20rx%3D%2262%22%20ry%3D%229%22%20fill%3D%22%23FCFCFE%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%3E%3C/ellipse%3E%0A%20%20%20%20%3Cellipse%20cx%3D%2273%22%20cy%3D%2245%22%20rx%3D%2254%22%20ry%3D%226%22%20fill%3D%22%233F434B%22%20opacity%3D%220.9%22%3E%3C/ellipse%3E%0A%20%20%20%20%3Cpath%20d%3D%22M40%2042%20Q52%2038%2070%2039%22%20stroke%3D%22%23FCFCFE%22%20stroke-width%3D%221.4%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20opacity%3D%220.8%22%3E%3C/path%3E%0A%20%20%20%20%3Cg%20stroke%3D%22%232F2F31%22%20stroke-width%3D%220.9%22%20opacity%3D%220.35%22%20stroke-linecap%3D%22round%22%20fill%3D%22none%22%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%22118%22%20y1%3D%2270%22%20x2%3D%22122%22%20y2%3D%22164%22%3E%3C/line%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%22124%22%20y1%3D%2270%22%20x2%3D%22127%22%20y2%3D%22160%22%3E%3C/line%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%22112%22%20y1%3D%2272%22%20x2%3D%22115%22%20y2%3D%22166%22%3E%3C/line%3E%0A%20%20%20%20%3C/g%3E%0A%20%20%3C/g%3E%0A%0A%20%20%0A%20%20%3Cg%20transform%3D%22translate%28220%20130%29%20rotate%2810%29%22%3E%0A%20%20%20%20%3Crect%20x%3D%220%22%20y%3D%220%22%20width%3D%2292%22%20height%3D%22140%22%20rx%3D%2212%22%20fill%3D%22%23FCFCFE%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%222%22%20stroke-linejoin%3D%22round%22%3E%3C/rect%3E%0A%20%20%20%20%3Crect%20x%3D%226%22%20y%3D%2214%22%20width%3D%2280%22%20height%3D%22118%22%20rx%3D%226%22%20fill%3D%22%23FCFCFE%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%3E%3C/rect%3E%0A%20%20%20%20%3Crect%20x%3D%2236%22%20y%3D%226%22%20width%3D%2220%22%20height%3D%223%22%20rx%3D%221.5%22%20fill%3D%22%232F2F31%22%3E%3C/rect%3E%0A%0A%20%20%20%20%0A%20%20%20%20%3Cg%20transform%3D%22translate%2810%2022%29%22%3E%0A%20%20%20%20%20%20%3Crect%20x%3D%220%22%20y%3D%220%22%20width%3D%2272%22%20height%3D%2244%22%20rx%3D%226%22%20fill%3D%22%23558B68%22%3E%3C/rect%3E%0A%20%20%20%20%20%20%3Crect%20x%3D%220%22%20y%3D%220%22%20width%3D%2272%22%20height%3D%2244%22%20rx%3D%226%22%20fill%3D%22none%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.8%22%20stroke-linejoin%3D%22round%22%3E%3C/rect%3E%0A%20%20%20%20%20%20%3Ccircle%20cx%3D%2210%22%20cy%3D%2210%22%20r%3D%224%22%20fill%3D%22%23FCFCFE%22%3E%3C/circle%3E%0A%20%20%20%20%20%20%3Ccircle%20cx%3D%2210%22%20cy%3D%2210%22%20r%3D%224%22%20fill%3D%22none%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.2%22%3E%3C/circle%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%2220%22%20y1%3D%228%22%20x2%3D%2258%22%20y2%3D%228%22%20stroke%3D%22%23FCFCFE%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%3E%3C/line%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%2220%22%20y1%3D%2214%22%20x2%3D%2248%22%20y2%3D%2214%22%20stroke%3D%22%23FCFCFE%22%20stroke-width%3D%221.4%22%20stroke-linecap%3D%22round%22%20opacity%3D%220.85%22%3E%3C/line%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%226%22%20y1%3D%2226%22%20x2%3D%2266%22%20y2%3D%2226%22%20stroke%3D%22%23FCFCFE%22%20stroke-width%3D%221.4%22%20stroke-linecap%3D%22round%22%3E%3C/line%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%226%22%20y1%3D%2232%22%20x2%3D%2258%22%20y2%3D%2232%22%20stroke%3D%22%23FCFCFE%22%20stroke-width%3D%221.4%22%20stroke-linecap%3D%22round%22%3E%3C/line%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%226%22%20y1%3D%2238%22%20x2%3D%2242%22%20y2%3D%2238%22%20stroke%3D%22%23FCFCFE%22%20stroke-width%3D%221.4%22%20stroke-linecap%3D%22round%22%3E%3C/line%3E%0A%20%20%20%20%3C/g%3E%0A%0A%20%20%20%20%3Cg%20transform%3D%22translate%2810%2074%29%22%3E%0A%20%20%20%20%20%20%3Crect%20x%3D%220%22%20y%3D%220%22%20width%3D%2272%22%20height%3D%2222%22%20rx%3D%225%22%20fill%3D%22%23FCFCFE%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%3E%3C/rect%3E%0A%20%20%20%20%20%20%3Ccircle%20cx%3D%229%22%20cy%3D%2211%22%20r%3D%223%22%20fill%3D%22none%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%3E%3C/circle%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%2218%22%20y1%3D%229%22%20x2%3D%2258%22%20y2%3D%229%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%20stroke-linecap%3D%22round%22%3E%3C/line%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%2218%22%20y1%3D%2215%22%20x2%3D%2244%22%20y2%3D%2215%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%20stroke-linecap%3D%22round%22%3E%3C/line%3E%0A%20%20%20%20%3C/g%3E%0A%20%20%20%20%3Cg%20transform%3D%22translate%2810%20102%29%22%3E%0A%20%20%20%20%20%20%3Crect%20x%3D%220%22%20y%3D%220%22%20width%3D%2272%22%20height%3D%2222%22%20rx%3D%225%22%20fill%3D%22%23FCFCFE%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%3E%3C/rect%3E%0A%20%20%20%20%20%20%3Ccircle%20cx%3D%229%22%20cy%3D%2211%22%20r%3D%223%22%20fill%3D%22none%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%3E%3C/circle%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%2218%22%20y1%3D%229%22%20x2%3D%2254%22%20y2%3D%229%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%20stroke-linecap%3D%22round%22%3E%3C/line%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%2218%22%20y1%3D%2215%22%20x2%3D%2240%22%20y2%3D%2215%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%20stroke-linecap%3D%22round%22%3E%3C/line%3E%0A%20%20%20%20%3C/g%3E%0A%0A%20%20%20%20%3Cline%20x1%3D%2292%22%20y1%3D%2230%22%20x2%3D%2292%22%20y2%3D%2248%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%20stroke-linecap%3D%22round%22%3E%3C/line%3E%0A%20%20%3C/g%3E%0A%0A%20%20%3Cg%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20fill%3D%22none%22%3E%0A%20%20%20%20%3Cpath%20d%3D%22M232%20108%20L228%20100%22%3E%3C/path%3E%0A%20%20%20%20%3Cpath%20d%3D%22M246%20102%20L244%2092%22%3E%3C/path%3E%0A%20%20%20%20%3Cpath%20d%3D%22M260%20100%20L262%2090%22%3E%3C/path%3E%0A%20%20%20%20%3Cpath%20d%3D%22M274%20104%20L280%2096%22%3E%3C/path%3E%0A%20%20%3C/g%3E%0A%0A%20%20%3Cg%20transform%3D%22translate%28300%20100%29%22%3E%0A%20%20%20%20%3Ccircle%20cx%3D%220%22%20cy%3D%220%22%20r%3D%2210%22%20fill%3D%22%23FCFCFE%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%222%22%3E%3C/circle%3E%0A%20%20%20%20%3Cline%20x1%3D%220%22%20y1%3D%22-4%22%20x2%3D%220%22%20y2%3D%222%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%222.4%22%20stroke-linecap%3D%22round%22%3E%3C/line%3E%0A%20%20%20%20%3Ccircle%20cx%3D%220%22%20cy%3D%226%22%20r%3D%221.4%22%20fill%3D%22%232F2F31%22%3E%3C/circle%3E%0A%20%20%3C/g%3E%0A%3C/svg%3E")`,
              },
              {
                num: "03",
                h: <>She ranks.</>,
                p: "Open Today at 8:47am. Ranked by what costs you most to ignore; the most expensive move is at the top. With a script in your voice if it's the kind of thing that needs a script.",
                bg: `url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20360%20300%22%3E%0A%20%20%0A%0A%20%20%0A%20%20%3Cg%20transform%3D%22translate%2850%20220%29%20rotate%28-3%29%22%3E%0A%20%20%20%20%3Crect%20x%3D%220%22%20y%3D%220%22%20width%3D%22240%22%20height%3D%2244%22%20rx%3D%226%22%20fill%3D%22%23FCFCFE%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%222%22%20stroke-linejoin%3D%22round%22%3E%3C/rect%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2222%22%20cy%3D%2222%22%20r%3D%2212%22%20fill%3D%22%23FAF0E4%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%3E%3C/circle%3E%0A%20%20%20%20%3Ctext%20x%3D%2222%22%20y%3D%2227%22%20font-family%3D%22Georgia%2C%20serif%22%20font-size%3D%2215%22%20font-weight%3D%22600%22%20fill%3D%22%232F2F31%22%20text-anchor%3D%22middle%22%3E4%3C/text%3E%0A%20%20%20%20%3Cline%20x1%3D%2244%22%20y1%3D%2216%22%20x2%3D%22160%22%20y2%3D%2216%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%20stroke-linecap%3D%22round%22%3E%3C/line%3E%0A%20%20%20%20%3Cline%20x1%3D%2244%22%20y1%3D%2226%22%20x2%3D%22120%22%20y2%3D%2226%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%20stroke-linecap%3D%22round%22%3E%3C/line%3E%0A%20%20%20%20%3Crect%20x%3D%22180%22%20y%3D%2216%22%20width%3D%2244%22%20height%3D%226%22%20rx%3D%223%22%20fill%3D%22%23FCFCFE%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%3E%3C/rect%3E%0A%20%20%20%20%3Crect%20x%3D%22180%22%20y%3D%2216%22%20width%3D%2212%22%20height%3D%226%22%20rx%3D%223%22%20fill%3D%22%232F2F31%22%20opacity%3D%220.6%22%3E%3C/rect%3E%0A%20%20%20%20%3Cline%20x1%3D%22180%22%20y1%3D%2230%22%20x2%3D%22212%22%20y2%3D%2230%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%20stroke-linecap%3D%22round%22%3E%3C/line%3E%0A%20%20%3C/g%3E%0A%0A%20%20%0A%20%20%3Cg%20transform%3D%22translate%2856%20170%29%20rotate%28-1%29%22%3E%0A%20%20%20%20%3Crect%20x%3D%220%22%20y%3D%220%22%20width%3D%22240%22%20height%3D%2244%22%20rx%3D%226%22%20fill%3D%22%23FCFCFE%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%222%22%20stroke-linejoin%3D%22round%22%3E%3C/rect%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2222%22%20cy%3D%2222%22%20r%3D%2212%22%20fill%3D%22%23FAF0E4%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%3E%3C/circle%3E%0A%20%20%20%20%3Ctext%20x%3D%2222%22%20y%3D%2227%22%20font-family%3D%22Georgia%2C%20serif%22%20font-size%3D%2215%22%20font-weight%3D%22600%22%20fill%3D%22%232F2F31%22%20text-anchor%3D%22middle%22%3E3%3C/text%3E%0A%20%20%20%20%3Cline%20x1%3D%2244%22%20y1%3D%2216%22%20x2%3D%22168%22%20y2%3D%2216%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%20stroke-linecap%3D%22round%22%3E%3C/line%3E%0A%20%20%20%20%3Cline%20x1%3D%2244%22%20y1%3D%2226%22%20x2%3D%22132%22%20y2%3D%2226%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%20stroke-linecap%3D%22round%22%3E%3C/line%3E%0A%20%20%20%20%3Crect%20x%3D%22180%22%20y%3D%2216%22%20width%3D%2244%22%20height%3D%226%22%20rx%3D%223%22%20fill%3D%22%23FCFCFE%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%3E%3C/rect%3E%0A%20%20%20%20%3Crect%20x%3D%22180%22%20y%3D%2216%22%20width%3D%2222%22%20height%3D%226%22%20rx%3D%223%22%20fill%3D%22%232F2F31%22%20opacity%3D%220.6%22%3E%3C/rect%3E%0A%20%20%20%20%3Cline%20x1%3D%22180%22%20y1%3D%2230%22%20x2%3D%22212%22%20y2%3D%2230%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%20stroke-linecap%3D%22round%22%3E%3C/line%3E%0A%20%20%3C/g%3E%0A%0A%20%20%0A%20%20%3Cg%20transform%3D%22translate%2852%20120%29%20rotate%28-2%29%22%3E%0A%20%20%20%20%3Crect%20x%3D%220%22%20y%3D%220%22%20width%3D%22240%22%20height%3D%2244%22%20rx%3D%226%22%20fill%3D%22%23FCFCFE%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%222%22%20stroke-linejoin%3D%22round%22%3E%3C/rect%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2222%22%20cy%3D%2222%22%20r%3D%2212%22%20fill%3D%22%23FAF0E4%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%3E%3C/circle%3E%0A%20%20%20%20%3Ctext%20x%3D%2222%22%20y%3D%2227%22%20font-family%3D%22Georgia%2C%20serif%22%20font-size%3D%2215%22%20font-weight%3D%22600%22%20fill%3D%22%232F2F31%22%20text-anchor%3D%22middle%22%3E1%3C/text%3E%0A%20%20%20%20%3Cline%20x1%3D%2244%22%20y1%3D%2216%22%20x2%3D%22172%22%20y2%3D%2216%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%20stroke-linecap%3D%22round%22%3E%3C/line%3E%0A%20%20%20%20%3Cline%20x1%3D%2244%22%20y1%3D%2226%22%20x2%3D%22140%22%20y2%3D%2226%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%20stroke-linecap%3D%22round%22%3E%3C/line%3E%0A%20%20%20%20%3Crect%20x%3D%22180%22%20y%3D%2216%22%20width%3D%2244%22%20height%3D%226%22%20rx%3D%223%22%20fill%3D%22%23FCFCFE%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%3E%3C/rect%3E%0A%20%20%20%20%3Crect%20x%3D%22180%22%20y%3D%2216%22%20width%3D%2232%22%20height%3D%226%22%20rx%3D%223%22%20fill%3D%22%232F2F31%22%20opacity%3D%220.65%22%3E%3C/rect%3E%0A%20%20%20%20%3Cline%20x1%3D%22180%22%20y1%3D%2230%22%20x2%3D%22212%22%20y2%3D%2230%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%20stroke-linecap%3D%22round%22%3E%3C/line%3E%0A%20%20%3C/g%3E%0A%0A%20%20%0A%20%20%3Cg%20transform%3D%22translate%2848%2038%29%20rotate%28-2%29%22%3E%0A%20%20%20%20%3Crect%20x%3D%223%22%20y%3D%225%22%20width%3D%22264%22%20height%3D%2258%22%20rx%3D%228%22%20fill%3D%22%232F2F31%22%20opacity%3D%220.12%22%3E%3C/rect%3E%0A%20%20%20%20%3Crect%20x%3D%220%22%20y%3D%220%22%20width%3D%22264%22%20height%3D%2258%22%20rx%3D%228%22%20fill%3D%22%23558B68%22%3E%3C/rect%3E%0A%20%20%20%20%3Crect%20x%3D%220%22%20y%3D%220%22%20width%3D%22264%22%20height%3D%2258%22%20rx%3D%228%22%20fill%3D%22none%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%222.4%22%20stroke-linejoin%3D%22round%22%3E%3C/rect%3E%0A%0A%20%20%20%20%3Ccircle%20cx%3D%2228%22%20cy%3D%2229%22%20r%3D%2216%22%20fill%3D%22%23FCFCFE%22%3E%3C/circle%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2228%22%20cy%3D%2229%22%20r%3D%2216%22%20fill%3D%22none%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%222%22%3E%3C/circle%3E%0A%20%20%20%20%3Ctext%20x%3D%2228%22%20y%3D%2235%22%20font-family%3D%22Georgia%2C%20serif%22%20font-size%3D%2220%22%20font-weight%3D%22700%22%20fill%3D%22%232F2F31%22%20text-anchor%3D%22middle%22%3E2%3C/text%3E%0A%0A%20%20%20%20%3Cline%20x1%3D%2254%22%20y1%3D%2220%22%20x2%3D%22176%22%20y2%3D%2220%22%20stroke%3D%22%23FCFCFE%22%20stroke-width%3D%222.6%22%20stroke-linecap%3D%22round%22%3E%3C/line%3E%0A%20%20%20%20%3Cline%20x1%3D%2254%22%20y1%3D%2232%22%20x2%3D%22148%22%20y2%3D%2232%22%20stroke%3D%22%23FCFCFE%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20opacity%3D%220.9%22%3E%3C/line%3E%0A%0A%20%20%20%20%3Crect%20x%3D%22190%22%20y%3D%2220%22%20width%3D%2260%22%20height%3D%228%22%20rx%3D%224%22%20fill%3D%22%23FCFCFE%22%20opacity%3D%220.55%22%3E%3C/rect%3E%0A%20%20%20%20%3Crect%20x%3D%22190%22%20y%3D%2220%22%20width%3D%2260%22%20height%3D%228%22%20rx%3D%224%22%20fill%3D%22none%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.2%22%3E%3C/rect%3E%0A%20%20%20%20%3Crect%20x%3D%22192%22%20y%3D%2222%22%20width%3D%2250%22%20height%3D%224%22%20rx%3D%222%22%20fill%3D%22%23FCFCFE%22%3E%3C/rect%3E%0A%0A%20%20%20%20%3Cg%20transform%3D%22translate%28190%2036%29%22%3E%0A%20%20%20%20%20%20%3Crect%20x%3D%220%22%20y%3D%220%22%20width%3D%2260%22%20height%3D%2212%22%20rx%3D%226%22%20fill%3D%22%23FCFCFE%22%3E%3C/rect%3E%0A%20%20%20%20%20%20%3Crect%20x%3D%220%22%20y%3D%220%22%20width%3D%2260%22%20height%3D%2212%22%20rx%3D%226%22%20fill%3D%22none%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%3E%3C/rect%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%228%22%20y1%3D%226%22%20x2%3D%2252%22%20y2%3D%226%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%20stroke-linecap%3D%22round%22%3E%3C/line%3E%0A%20%20%20%20%3C/g%3E%0A%0A%20%20%20%20%3Cg%20transform%3D%22translate%28252%20-6%29%20rotate%2815%29%22%3E%0A%20%20%20%20%20%20%3Cpath%20d%3D%22M0%20-8%20L2.4%20-2.4%20L8%20-2%20L3.6%202%20L5%208%20L0%204.6%20L-5%208%20L-3.6%202%20L-8%20-2%20L-2.4%20-2.4%20Z%22%20fill%3D%22%23FCFCFE%22%3E%3C/path%3E%0A%20%20%20%20%20%20%3Cpath%20d%3D%22M0%20-8%20L2.4%20-2.4%20L8%20-2%20L3.6%202%20L5%208%20L0%204.6%20L-5%208%20L-3.6%202%20L-8%20-2%20L-2.4%20-2.4%20Z%22%20fill%3D%22none%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%20stroke-linejoin%3D%22round%22%3E%3C/path%3E%0A%20%20%20%20%3C/g%3E%0A%20%20%3C/g%3E%0A%0A%20%20%3Cg%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.6%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20fill%3D%22none%22%20opacity%3D%220.9%22%3E%0A%20%20%20%20%3Cpath%20d%3D%22M320%20180%20Q332%20140%20320%2096%22%3E%3C/path%3E%0A%20%20%20%20%3Cpath%20d%3D%22M316%20100%20L320%2092%20L326%2098%22%3E%3C/path%3E%0A%20%20%3C/g%3E%0A%0A%20%20%3Cg%20transform%3D%22translate%28322%20226%29%22%3E%0A%20%20%20%20%3Ccircle%20cx%3D%220%22%20cy%3D%220%22%20r%3D%2212%22%20fill%3D%22%23FCFCFE%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%3E%3C/circle%3E%0A%20%20%20%20%3Ccircle%20cx%3D%220%22%20cy%3D%220%22%20r%3D%224%22%20fill%3D%22none%22%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%3E%3C/circle%3E%0A%20%20%20%20%3Cg%20stroke%3D%22%232F2F31%22%20stroke-width%3D%221.4%22%20stroke-linecap%3D%22round%22%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%220%22%20y1%3D%22-12%22%20x2%3D%220%22%20y2%3D%22-16%22%3E%3C/line%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%220%22%20y1%3D%2212%22%20x2%3D%220%22%20y2%3D%2216%22%3E%3C/line%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%22-12%22%20y1%3D%220%22%20x2%3D%22-16%22%20y2%3D%220%22%3E%3C/line%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%2212%22%20y1%3D%220%22%20x2%3D%2216%22%20y2%3D%220%22%3E%3C/line%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%22-8.5%22%20y1%3D%22-8.5%22%20x2%3D%22-11.3%22%20y2%3D%22-11.3%22%3E%3C/line%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%228.5%22%20y1%3D%228.5%22%20x2%3D%2211.3%22%20y2%3D%2211.3%22%3E%3C/line%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%22-8.5%22%20y1%3D%228.5%22%20x2%3D%22-11.3%22%20y2%3D%2211.3%22%3E%3C/line%3E%0A%20%20%20%20%20%20%3Cline%20x1%3D%228.5%22%20y1%3D%22-8.5%22%20x2%3D%2211.3%22%20y2%3D%22-11.3%22%3E%3C/line%3E%0A%20%20%20%20%3C/g%3E%0A%20%20%3C/g%3E%0A%3C/svg%3E")`,
              },
            ].map((s, i) => (
              <div key={i} className="v2-rai-step">
                <div className="v2-rai-step-illustration" style={{ backgroundImage: s.bg }} />
                <div className="v2-rai-step-content">
                  <h3 className="v2-rai-step-h">{s.h}</h3>
                  <p className="v2-rai-step-p">{s.p}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* curve: rai (cream) → platform (warm) */}
      <div className="v2-curve r-full-bleed r-no-pad" style={{ background: C.bg }}>
        <svg viewBox="0 0 1440 100" preserveAspectRatio="none"><path d="M 0,100 L 1440,100 L 1440,30 C 1080,-20 360,140 0,25 Z" fill="#EAE4D6" /></svg>
      </div>

      {/* ══════ PLATFORM ══════ */}
      <section className="v2-section-platform r-full-bleed">
        <div className="v2-section-inner">
          <div className="v2-platform-grid">
            <div>
              <div className="v2-eyebrow">The platform</div>
              <h2 className="v2-section-h2">Most CRMs track deals. Retayned tracks relationships.</h2>
              <p className="v2-section-sub">Your pipeline only looks ahead. Your clients aren't in it — they're the revenue you already earned, and most CRMs treat them like they're safe. They're not.</p>
              <div className="v2-bullets">
                <div className="v2-bullet"><div className="v2-check">✓</div><div><strong>12-dimension retention scoring.</strong> Relationship health, not transaction volume — one number that tells you who's drifting before they say a word.</div></div>
                <div className="v2-bullet"><div className="v2-check">✓</div><div><strong>Observations and health checks.</strong> Business-level insights that separate the forest from the trees on a weekly basis. With no client left behind.</div></div>
                <div className="v2-bullet"><div className="v2-check">✓</div><div><strong>Rai writes the words that save the account.</strong> The exact message for the exact relationship, the moment it matters most, straight from today's tasks.</div></div>
                <div className="v2-bullet"><div className="v2-check">✓</div><div><strong>Your Rolodex is future revenue.</strong> Every client you've lost is a potential re-engagement — not dead weight. This pipeline runs both directions.</div></div>
              </div>
            </div>
            <div className="v2-platform-portfolio">
              {/* Feature tab strip — switches the visual below */}
              {SHOW_FEATURE_SWITCHER && (
              <div className="v2-feature-tabs">
                {homeTabs.map((t, i) => (
                  <button
                    key={t.id}
                    className={"v2-feature-tab" + (activeTab === i ? " active" : "")}
                    onClick={() => setActiveTab(i)}
                  >{t.label}</button>
                ))}
              </div>
              )}

              {(!SHOW_FEATURE_SWITCHER || activeTab === 1) ? (
              <>
              {/* Header */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 3, letterSpacing: "0.03em" }}>Your portfolio</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em" }}>Clients</span>
                </div>
                <div style={{ fontSize: 11, color: C.textMuted }}>
                  <span style={{ color: C.text, fontWeight: 600 }}>14 active</span> · <span style={{ color: C.primary, fontWeight: 700 }}>$58.2k</span>/mo · <span style={{ color: C.primary, fontWeight: 700 }}>71</span> avg
                </div>
              </div>

              {/* Two-column layout: left sidebar + main table */}
              <div className="v2-platform-portfolio-grid">

                {/* Left sidebar — portfolio summary + recent movement */}
                <div className="v2-port-sidebar">
                  <div className="v2-port-card">
                    <div className="v2-port-card-label">PORTFOLIO</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: "50%",
                        border: "3px solid " + C.primary,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14, fontWeight: 900, color: C.primary,
                      }}>71</div>
                      <div style={{ fontSize: 11, lineHeight: 1.55, flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: C.textMuted }}>Clients</span><span style={{ fontWeight: 700 }}>14</span></div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: C.textMuted }}>MRR</span><span style={{ fontWeight: 700 }}>$58.2k</span></div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: C.textMuted }}>Avg</span><span style={{ fontWeight: 700 }}>71</span></div>
                      </div>
                    </div>
                    <div style={{ display: "flex", height: 3, borderRadius: 2, overflow: "hidden", marginBottom: 10 }}>
                      <div style={{ flex: 5, background: C.success }} />
                      <div style={{ flex: 4, background: C.primaryLight }} />
                      <div style={{ flex: 4, background: "#B88B15" }} />
                      <div style={{ flex: 1, background: C.danger }} />
                    </div>
                    <div style={{ fontSize: 10.5, lineHeight: 1.7 }}>
                      <div><span style={{ color: C.success, marginRight: 4 }}>●</span><strong>5</strong> <span style={{ color: C.textMuted }}>Thriving</span></div>
                      <div><span style={{ color: C.primaryLight, marginRight: 4 }}>●</span><strong>4</strong> <span style={{ color: C.textMuted }}>Healthy</span></div>
                      <div><span style={{ color: "#B88B15", marginRight: 4 }}>●</span><strong>4</strong> <span style={{ color: C.textMuted }}>Watch</span></div>
                      <div><span style={{ color: C.danger, marginRight: 4 }}>●</span><strong>1</strong> <span style={{ color: C.textMuted }}>At risk</span></div>
                    </div>
                  </div>

                  <div className="v2-port-card">
                    <div className="v2-port-card-label" style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>RECENT MOVEMENT</span><span style={{ color: C.textMuted }}>7d</span>
                    </div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: C.success, marginBottom: 6, letterSpacing: "0.06em" }}>CLIMBING</div>
                    <div className="v2-port-movement-item"><span className="v2-port-avatar" style={{ background: C.primaryLight }}>NR</span><span style={{ flex: 1, fontSize: 11 }}>Northvane Retail</span><span style={{ fontSize: 10, color: C.success, fontWeight: 700 }}>+5</span></div>
                    <div className="v2-port-movement-item"><span className="v2-port-avatar" style={{ background: C.primary }}>HP</span><span style={{ flex: 1, fontSize: 11 }}>Harbor Pines</span><span style={{ fontSize: 10, color: C.success, fontWeight: 700 }}>+3</span></div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: C.danger, marginTop: 10, marginBottom: 6, letterSpacing: "0.06em" }}>SLIPPING</div>
                    <div className="v2-port-movement-item"><span className="v2-port-avatar" style={{ background: "#B88B15" }}>EC</span><span style={{ flex: 1, fontSize: 11 }}>Ellis & Co.</span><span style={{ fontSize: 10, color: C.danger, fontWeight: 700 }}>−4</span></div>
                    <div className="v2-port-movement-item"><span className="v2-port-avatar" style={{ background: "#92A596" }}>BQ</span><span style={{ flex: 1, fontSize: 11 }}>Birchwood Quarry</span><span style={{ fontSize: 10, color: C.danger, fontWeight: 700 }}>−3</span></div>
                  </div>
                </div>

                {/* Main table */}
                <div className="v2-port-table-wrap">
                  <div className="v2-port-controls">
                    <div style={{ display: "flex", gap: 4, fontSize: 10, alignItems: "center" }}>
                      <span style={{ color: C.textMuted, letterSpacing: "0.08em" }}>SORT</span>
                      <span className="v2-port-pill v2-port-pill-active">Priority</span>
                      <span className="v2-port-pill">Revenue</span>
                      <span className="v2-port-pill">Trend</span>
                      <span className="v2-port-pill">Renewal</span>
                    </div>
                  </div>
                  <div style={{ padding: "8px 14px", fontSize: 10, color: C.textMuted, borderBottom: "1px solid " + C.borderLight, display: "flex", justifyContent: "space-between" }}>
                    <span>14 clients</span><span>Sort: <strong style={{ color: C.text }}>Priority</strong></span>
                  </div>

                  {/* Column headers */}
                  <div className="v2-port-row v2-port-row-header">
                    <div style={{ flex: "2 1 0", minWidth: 0 }}>CLIENT</div>
                    <div className="v2-port-col-num">HEALTH</div>
                    <div className="v2-port-col-num">REVENUE</div>
                    <div className="v2-port-col-num">12-WK</div>
                    <div className="v2-port-col-num">CADENCE</div>
                    <div className="v2-port-col-num">RENEWS</div>
                  </div>

                  {/* Client rows */}
                  {[
                    { i: "HM", name: "Harlow Media", industry: "Financial Services", score: 88, scoreColor: C.success, delta: "−3", revenue: "$5.8k", trend: "down", trendPct: "−6%", trendColor: C.danger, cadence: "12d silent", cadenceColor: "o", renews: "4mo" },
                    { i: "VC", name: "Vantage Collective", industry: "Ecommerce", score: 87, scoreColor: C.success, delta: "−2", revenue: "$9.2k", trend: "down", trendPct: "−6%", trendColor: C.danger, cadence: "18d cadence", cadenceColor: "●", renews: "5mo" },
                    { i: "OR", name: "Orchard Ridge", industry: "Ecommerce", score: 79, scoreColor: C.primaryLight, delta: "−2", revenue: "$8.7k", trend: "down", trendPct: "−7%", trendColor: C.danger, cadence: "10d cadence", cadenceColor: "●", renews: "6mo" },
                    { i: "NR", name: "Northvane Retail", industry: "Ecommerce", score: 92, scoreColor: C.success, delta: "+2", revenue: "$4.3k", trend: "up", trendPct: "+8%", trendColor: C.success, cadence: "10d cadence", cadenceColor: "●", renews: "1mo" },
                    { i: "LG", name: "Lantern Group", industry: "Legal Services", score: 72, scoreColor: "#B88B15", delta: "+4", revenue: "$5.5k", trend: "up", trendPct: "+10%", trendColor: C.success, cadence: "19d cadence", cadenceColor: "●", renews: "2mo" },
                    { i: "EC", name: "Ellis & Co.", industry: "Ecommerce", score: 78, scoreColor: C.primaryLight, delta: "−4", revenue: "$4.1k", trend: "down", trendPct: "−6%", trendColor: C.danger, cadence: "On rhythm", cadenceColor: "●●", renews: "3mo" },
                    { i: "SG", name: "Sidegate", industry: "Ecommerce", score: 84, scoreColor: C.success, delta: "+3", revenue: "$1.2k", trend: "up", trendPct: "+9%", trendColor: C.success, cadence: "17d cadence", cadenceColor: "●", renews: "5mo" },
                  ].map((r, idx) => (
                    <div key={idx} className="v2-port-row">
                      <div style={{ flex: "2 1 0", display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <span className="v2-port-avatar" style={{ background: r.scoreColor }}>{r.i}</span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                          <div style={{ fontSize: 10, color: C.textMuted }}>{r.industry}</div>
                        </div>
                      </div>
                      <div className="v2-port-col-num">
                        <span style={{ fontSize: 13, fontWeight: 900, color: r.scoreColor }}>{r.score}</span>
                        <span style={{ fontSize: 9, color: C.textMuted, marginLeft: 4 }}>{r.delta}</span>
                      </div>
                      <div className="v2-port-col-num"><span style={{ fontSize: 11, fontWeight: 600 }}>{r.revenue}</span><span style={{ fontSize: 9, color: C.textMuted, display: "block" }}>/mo</span></div>
                      <div className="v2-port-col-num">
                        <svg width="34" height="12" viewBox="0 0 34 12" style={{ display: "block", margin: "0 auto" }}>
                          <polyline points={r.trend === "up" ? "0,10 8,7 16,6 24,4 34,2" : "0,2 8,4 16,6 24,8 34,10"} fill="none" stroke={r.trendColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span style={{ fontSize: 9, color: r.trendColor, fontWeight: 700 }}>{r.trendPct}</span>
                      </div>
                      <div className="v2-port-col-num"><span style={{ fontSize: 10, color: r.cadenceColor === "o" ? "#B88B15" : C.primaryLight, marginRight: 3 }}>{r.cadenceColor}</span><span style={{ fontSize: 10 }}>{r.cadence}</span></div>
                      <div className="v2-port-col-num" style={{ fontSize: 10 }}>{r.renews}</div>
                    </div>
                  ))}
                </div>

              </div>
              </>
              ) : (
                <HomeFeatureVisual tab={ht.id} />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* curve: platform (warm) → combos (cream) */}
      <div className="v2-curve r-full-bleed r-no-pad" style={{ background: "#EAE4D6" }}>
        <svg viewBox="0 0 1440 100" preserveAspectRatio="none"><path d="M 0,100 L 1440,100 L 1440,30 Q 720,-30 0,25 Z" fill={C.bg} /></svg>
      </div>

      {/* ══════ COMBOS — flowing wordmark tapestry ══════ */}
      <section className="v2-section-combos r-full-bleed">
        <div className="v2-combos-head">
          <div className="v2-eyebrow">The math behind the magic</div>
          <h2 className="v2-combos-h2">A scoring engine built on years of client research.</h2>
          <p className="v2-combos-p">Twelve dimensions. Twenty combinations. Every pattern.</p>
        </div>
        <V2ScrollBand items={dimensions} direction="left" speed={64} />
        <div className="v2-become">
          <span className="v2-become-rule" />
          <span className="v2-become-word">Become</span>
          <span className="v2-become-rule" />
        </div>
        <V2ScrollBand items={combinations} direction="right" speed={72} />
      </section>

      {/* ════ FEATURE TABS (preserved from old Home — to evaluate / decide) ════ */}
        {/* ══════════════ FEATURE TABS ══════════════ */}


      {/* curve: combos (cream) → audience (warm) */}
      <div className="v2-curve r-full-bleed r-no-pad" style={{ background: C.bg }}>
        <svg viewBox="0 0 1440 100" preserveAspectRatio="none"><path d="M 0,100 L 1440,100 L 1440,30 C 1100,140 340,-30 0,35 Z" fill="#EAE4D6" /></svg>
      </div>

      {/* ══════ AUDIENCE TABS ══════ */}
      <section className="v2-section-audience r-full-bleed">
        <div className="v2-section-inner">
          <div className="v2-section-head" style={{ textAlign: "center", margin: "0 auto 56px", maxWidth: 820 }}>
            <div className="v2-eyebrow">Built for the way you work</div>
            <h2 className="v2-section-h2">Retayned is shaped to your book.</h2>
          </div>
          <div className="v2-audience-tabs-wrap">
            <div className="v2-audience-tabs">
              {[
                { k: "freelancers", l: "Freelancers" },
                { k: "agencies", l: "Agencies" },
                { k: "enterprise", l: "Enterprise" },
              ].map((t) => (
                <button
                  key={t.k}
                  className={"v2-audience-tab" + (audienceTab === t.k ? " v2-audience-tab-active" : "")}
                  onClick={() => setAudienceTab(t.k)}
                >
                  {t.l}
                </button>
              ))}
            </div>
          </div>
          <div className="v2-audience-content">
            <div>
              <h3 className="v2-audience-h">{panel.h}</h3>
              <p className="v2-audience-p">{panel.p}</p>
              <div className="v2-hero-cta-row">
                <button className="v2-btn-primary-lg cta-btn" onClick={() => setPage("signup")}>Start Free Trial</button>
              </div>
            </div>
            <div className="v2-audience-demo">
              <AudienceIllustration tab={audienceTab} />
            </div>
          </div>
        </div>
      </section>

      {/* curve: audience (warm) → enterprise (deep green) */}
      <div className="v2-curve r-full-bleed r-no-pad" style={{ background: "#EAE4D6" }}>
        <svg viewBox="0 0 1440 100" preserveAspectRatio="none"><path d="M 0,100 L 1440,100 L 1440,25 Q 720,140 0,20 Z" fill={C.primaryDeep} /></svg>
      </div>

      {/* ══════ ENTERPRISE ══════ */}
      <section className="v2-section-enterprise r-full-bleed">
        <div className="v2-section-inner">
          <div className="v2-section-head" style={{ textAlign: "center", margin: "0 auto 32px", maxWidth: 880 }}>
            <div className="v2-eyebrow v2-eyebrow-enterprise">Retayned Enterprise · Coming Soon</div>
            <h2 className="v2-section-h2 v2-h2-enterprise">A managed agent for<br /><span className="v2-accent-ent">your whole book.</span></h2>
            <p className="v2-section-sub v2-sub-enterprise" style={{ margin: "0 auto" }}>Retayned scores every account and surfaces the next right action for each one. You choose who acts on it — your account managers, your AI agents, or both — all powered by the same retention intelligence.</p>
          </div>

          {/* CTA moved above the dashboard */}
          <div className="v2-enterprise-cta-row" style={{ marginTop: 0, marginBottom: 48 }}>
            <button className="v2-btn-enterprise cta-btn" onClick={() => setPage("contact")}>Let's Talk</button>
          </div>

          {/* 3 tiles first */}
          <div className="v2-enterprise-grid">
            <div className="v2-enterprise-card">
              <div className="v2-enterprise-label">Managed agent</div>
              <h4 className="v2-enterprise-h">Rai as autonomous service</h4>
              <p className="v2-enterprise-p">Daily sweeps across your entire book. Twelve-dimension scoring. Archetype detection. Prioritized task lists delivered to your AMs.</p>
            </div>
            <div className="v2-enterprise-card">
              <div className="v2-enterprise-label">Multi-seat app</div>
              <h4 className="v2-enterprise-h">Your team, one view</h4>
              <p className="v2-enterprise-p">Unlimited seats. Role-based permissions. Full handoff history per client. When an account manager leaves, their knowledge stays...permanently and in full.</p>
            </div>
            <div className="v2-enterprise-card">
              <div className="v2-enterprise-label">MCP + REST API</div>
              <h4 className="v2-enterprise-h">Plug into your stack</h4>
              <p className="v2-enterprise-p">Give your internal agents the same retention intelligence. Integrate with the communication tools your clients love. Connect to Salesforce, HubSpot, and more.</p>
            </div>
          </div>

          {/* RaiS Live view dashboard below */}
          <div className="r-ent-dashboard" style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: 28,
            position: "relative",
            overflow: "hidden",
            marginTop: 48,
            maxWidth: 1400,
            marginLeft: "auto",
            marginRight: "auto",
          }}>
            <div aria-hidden="true" style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 1,
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)",
            }} />

            {/* Dashboard header */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: 24, paddingBottom: 16,
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: "rgba(85,139,104,0.2)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.primaryLight} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>RaiS · Live view</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Portfolio: 1,247 clients · Last sweep: 08:04</div>
                </div>
              </div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 11px", borderRadius: 100,
                background: "rgba(45,134,89,0.15)",
                fontSize: 11, fontWeight: 600, color: "#7EC29A",
              }}>
                <span className="r-ent-blink" style={{ width: 5, height: 5, borderRadius: "50%", background: "#7EC29A" }} />
                Running
              </div>
            </div>

            {/* Log output */}
            <div style={{
              background: "rgba(0,0,0,0.25)",
              borderRadius: 10,
              padding: "14px 16px",
              fontFamily: "'SF Mono', Menlo, Monaco, monospace",
              fontSize: 11.5,
              color: "rgba(255,255,255,0.55)",
              lineHeight: 1.75,
              overflow: "hidden",
            }}>
              {[
                { time: "08:04", lvl: "SWEEP", lvlColor: C.primaryLight, msg: "Scored 1,247 clients. Δ avg score: −0.4. Flagged 38 at-risk." },
                { time: "08:04", lvl: "ALERT", lvlColor: "#E89580", msg: "Foxglove Partners entered \"Velocity decay\" archetype. Confidence: 0.87." },
                { time: "08:05", lvl: "TASK ", lvlColor: "#7EC29A", msg: "Generated 92 tasks. 28 outreach emails drafted and queued for review." },
                { time: "08:05", lvl: "SYNC ", lvlColor: C.primaryLight, msg: "Dispatched to Slack (42), CRM (50). Next sweep: 08:04 tomorrow." },
              ].map((line, i) => (
                <div key={i} style={{ display: "flex", gap: 12 }}>
                  <span style={{ color: "rgba(255,255,255,0.3)", minWidth: 44 }}>{line.time}</span>
                  <span style={{ color: line.lvlColor, fontWeight: 700, minWidth: 50 }}>{line.lvl}</span>
                  <span style={{ flex: 1 }}>{line.msg}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>


      {/* curve: enterprise (deep green) → final (beige) */}
      <div className="v2-curve r-full-bleed r-no-pad" style={{ background: C.primaryDeep }}>
        <svg viewBox="0 0 1440 100" preserveAspectRatio="none"><path d="M 0,100 L 1440,100 L 1440,25 C 1080,-30 360,140 0,20 Z" fill="#F2EEE8" /></svg>
      </div>

      {/* ══════ TESTIMONIALS + STATS (7-cell mixed grid) ══════ */}
      <section className="r-full-bleed" style={{
        background: "#F2EEE8",
        padding: "112px 48px",
      }}>
        <div style={{ maxWidth: 880, margin: "0 auto 56px", textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(40px, 5.5vw, 72px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.02 }}>
            What folks are saying.
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, maxWidth: 1320, margin: "0 auto" }} className="v2-testimonials-grid">

          {/* Cell 1 — stat: 90% */}
          <div className="v2-mix-cell v2-mix-stat">
            <div className="v2-mix-stat-num">90%</div>
            <div className="v2-mix-stat-label">Of churn is predictable</div>
          </div>

          {/* Cell 2 — founder note */}
          <div className="v2-mix-cell v2-mix-testimonial">
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 56, lineHeight: 1, color: C.btn, fontWeight: 700, display: "block", height: 34, overflow: "hidden" }}>&ldquo;</span>
            </div>
            <p className="v2-mix-quote">"I built Retayned as an agency owner to keep more of the business I worked so hard to win. I'm happy to say I still use it every day for my own projects and clients."</p>
            <div className="v2-mix-footer">
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.primary, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14, fontWeight: 700, color: "#fff" }}>AL</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Adam</div>
                <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>Founder, Retayned</div>
              </div>
            </div>
          </div>

          {/* Cell 3 — stat: 25x */}
          <div className="v2-mix-cell v2-mix-stat">
            <div className="v2-mix-stat-num">25x</div>
            <div className="v2-mix-stat-label">Cheaper to retain than acquire</div>
          </div>



          {/* Row 2 (spans 3) — 5% increase headline */}
          <div className="v2-mix-cell v2-mix-stat v2-mix-stat-wide" style={{ gridColumn: "span 3" }}>
            <div className="v2-mix-stat-headline">
              A 5% increase in retention can boost profits by 95%.<sup style={{ fontSize: "0.4em", color: C.textMuted, verticalAlign: "super" }}>¹</sup>
            </div>
          </div>

          {/* Cell 4 — stat: 1+ */}
          <div className="v2-mix-cell v2-mix-stat">
            <div className="v2-mix-stat-num">1+</div>
            <div className="v2-mix-stat-label">Saved client pays for itself</div>
          </div>

          {/* Cell 5 — testimonial (Freelancer JR) */}
          <div className="v2-mix-cell v2-mix-testimonial">
            <div style={{ display: "flex", gap: 2, marginBottom: 18 }}>
              {Array(5).fill(0).map((_, j) => <span key={j} style={{ fontSize: 16, color: "#E6A817" }}>★</span>)}
            </div>
            <p className="v2-mix-quote">"It gave me the exact words to say to a client I had a tough week with. I had that conversation that afternoon. They're still with me today. I'm still with Retayned."</p>
            <div className="v2-mix-footer">
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.btn, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14, fontWeight: 700, color: "#fff" }}>NS</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Pinterest Marketer</div>
                <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>3 Clients</div>
              </div>
            </div>
          </div>

          {/* Cell 6 — testimonial */}
          <div className="v2-mix-cell v2-mix-testimonial">
            <div style={{ display: "flex", gap: 2, marginBottom: 18 }}>
              {Array(5).fill(0).map((_, j) => <span key={j} style={{ fontSize: 16, color: "#E6A817" }}>★</span>)}
            </div>
            <p className="v2-mix-quote">"The health check questions are uncomfortable in the best way. They force you to admit what you already know but haven't said out loud. It's something we thought we'd use for crises and it's turned into our daily operations hub."</p>
            <div className="v2-mix-footer">
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#92A596", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14, fontWeight: 700, color: "#fff" }}>JD</div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Healthcare Consultant</span>
                </div>
                <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>15 Clients</div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ══════ FINAL CTA ══════ */}
      <section className="v2-section-final v2-final-animated r-full-bleed" ref={finalCtaRef}>
        {/* Spaceship animation layer */}
        <div className="v2-ship-wrapper" aria-hidden="true">
          <svg className="v2-ship-svg" viewBox="0 0 1440 400" preserveAspectRatio="xMidYMid meet">
            {/* Dashed trail: bottom-left corner → upper right edge */}
            <path className="v2-ship-trail"
              d="M80 340 Q320 320 560 280 Q800 240 1040 180 Q1200 140 1340 100"
              fill="none" stroke="#558B68" strokeWidth="3"
              strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray="4 10" />
            {/* Start dot */}
            <circle cx="80" cy="340" r="4" fill="#558B68" stroke="#2F2F31" strokeWidth="1.4" />
            {/* Spaceship — positioned at the right edge */}
            <g className="v2-ship-body" transform="translate(1360 90) rotate(-14) scale(1.6)">
              <path d="M-38 6 Q-54 0 -38 -6 Q-30 0 -38 6 Z" fill="#558B68" stroke="#2F2F31" strokeWidth="1.4" strokeLinejoin="round"/>
              <path d="M-32 3 Q-44 0 -32 -3 Q-26 0 -32 3 Z" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="1"/>
              <ellipse cx="0" cy="6" rx="34" ry="10" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M-28 10 Q0 18 28 10" fill="none" stroke="#2F2F31" strokeWidth="1.4" strokeLinecap="round"/>
              <circle cx="-18" cy="11" r="2" fill="#558B68" stroke="#2F2F31" strokeWidth="1"/>
              <circle cx="0" cy="12" r="2" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="1"/>
              <circle cx="18" cy="11" r="2" fill="#558B68" stroke="#2F2F31" strokeWidth="1"/>
              <path d="M-16 -2 Q-16 -18 0 -20 Q16 -18 16 -2 Z" fill="#558B68" stroke="#2F2F31" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M-10 -6 Q-12 -14 -2 -16" fill="none" stroke="#FCFCFE" strokeWidth="2" strokeLinecap="round" opacity="0.9"/>
              <ellipse cx="0" cy="-2" rx="16" ry="3" fill="none" stroke="#2F2F31" strokeWidth="1.4"/>
              <ellipse cx="0" cy="-9" rx="9" ry="8" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="1.6"/>
              <ellipse cx="0" cy="-9" rx="5" ry="5.6" fill="#2F2F31"/>
              <circle cx="-1.6" cy="-11" r="1.4" fill="#FCFCFE"/>
              <circle cx="1.8" cy="-7.6" r="0.7" fill="#FCFCFE"/>
              <path d="M0 -17 Q-2 -21 1 -24" fill="none" stroke="#2F2F31" strokeWidth="1.4" strokeLinecap="round"/>
              <circle cx="1.4" cy="-25" r="1.8" fill="#558B68" stroke="#2F2F31" strokeWidth="1.2"/>
              <circle cx="6" cy="-7" r="0.8" fill="#2F2F31" opacity="0.5"/>
              <path d="M4 -4 Q6 -2 8 -4" fill="none" stroke="#2F2F31" strokeWidth="1.2" strokeLinecap="round"/>
              <g transform="translate(11 -6) rotate(20)">
                <path d="M0 0 L0 -7" stroke="#2F2F31" strokeWidth="1.6" strokeLinecap="round"/>
                <circle cx="0" cy="-8.5" r="2.2" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="1.4"/>
              </g>
              <g stroke="#2F2F31" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.8">
                <line x1="-40" y1="-10" x2="-48" y2="-14"/>
                <line x1="-36" y1="-16" x2="-44" y2="-22"/>
              </g>
            </g>
          </svg>
        </div>

        <h3 className="v2-final-h v2-final-h-small">
          You work too hard to get new clients.<br />Keep them Retayned.
        </h3>
        <p className="v2-final-sub">See the signal. Get the script. Keep the client.</p>
        <div className="v2-hero-cta-row" style={{ justifyContent: "center" }}>
          <button className="v2-btn-primary-lg cta-btn" onClick={() => setPage("signup")}>Start Free Trial</button>
        </div>
        <p className="v2-final-fine">14-day free trial. No credit card required.</p>
      </section>
      <Footer setPage={setPage} />
    </div>
  );
}


// ═══ HOME ═══
// ═══ PRICING — ported from final/pricing.html ═══
const roiLabelStyle = { fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700, color: C.textSec };
const roiValueStyle = { fontWeight: 900, fontSize: 22, marginTop: 4, color: C.text, letterSpacing: "-0.02em" };

// Defined at module scope (NOT inside ROICalculator) so its component identity
// is stable across renders. A nested definition gets recreated every render,
// which makes React remount the <input> mid-drag — causing janky, stepwise sliding.
const ROISlider = ({ label, value, set, min, max, step, prefix = "", suffix = "" }) => (
  <div>
    <div style={roiLabelStyle}>{label}</div>
    <div style={roiValueStyle}>{prefix}{value.toLocaleString()}{suffix}</div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => set(Number(e.target.value))}
      style={{ width: "100%", marginTop: 10, accentColor: C.btn }}
    />
  </div>
);

function ROICalculator() {
  const [clients, setClients] = useState(12);
  const [avgValue, setAvgValue] = useState(2500);
  const [savedRate, setSavedRate] = useState(15);
  const monthlyCost = 29;
  const clientsSaved = clients * (savedRate / 100);
  const revenueSaved = clientsSaved * avgValue;
  const roi = monthlyCost > 0 ? Math.round(revenueSaved / monthlyCost) : 0;

  const labelStyle = roiLabelStyle;
  const valueStyle = roiValueStyle;

  const Slider = ROISlider;

  return (
    <div style={{ background: C.card, border: "1px solid " + C.borderLight, borderRadius: 18, padding: "32px 36px", boxShadow: "0 12px 40px rgba(28,50,36,0.06), 0 2px 6px rgba(28,50,36,0.04)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <span style={{ display: "inline-block", padding: "4px 12px", background: C.primarySoft, color: C.primary, borderRadius: 999, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em" }}>ROI Calculator</span>
        <span style={{ fontSize: 12, color: C.textMuted }}>Move the sliders →</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 28, marginTop: 20 }} className="pricing-roi-grid">
        <Slider label="Active clients" value={clients} set={setClients} min={1} max={25} step={1} />
        <Slider label="Avg client value / mo" value={avgValue} set={setAvgValue} min={250} max={10000} step={50} prefix="$" />
        <Slider label="Churn prevented" value={savedRate} set={setSavedRate} min={1} max={50} step={1} suffix="%" />
      </div>

      <div style={{ marginTop: 28, padding: "22px 24px", background: C.primaryGhost, borderRadius: 14, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }} className="pricing-roi-result">
        <div>
          <div style={labelStyle}>Retayned cost / mo</div>
          <div style={valueStyle}>${monthlyCost}<span style={{ fontSize: 13, fontWeight: 600, color: C.textMuted }}> flat</span></div>
        </div>
        <div>
          <div style={labelStyle}>Revenue saved / mo</div>
          <div style={{ ...valueStyle, color: C.success }}>${Math.round(revenueSaved).toLocaleString()}</div>
        </div>
        <div>
          <div style={labelStyle}>Return on Retayned</div>
          <div style={{ ...valueStyle, color: C.btn, fontSize: 26 }}>{roi.toLocaleString()}×</div>
        </div>
      </div>
    </div>
  );
}

function Pricing({ setPage }) {
  const features = [
    "Today (prioritized tasks, ranked by impact)",
    "Today (Rai-ranked tasks, by impact)",
    "Clients (scored 1–99 · 12 dimensions)",
    "Health (relationship drift detection)",
    "Rai · calibrated scripts (fair-use limits)",
    "Rolodex of former clients, ready to re-engage",
    "Referrals · readiness scoring, right-time asks",
    "5 team seats included · +$19 per extra seat",
    "Daily exports + CSV",
  ];

  const tiers = [
    {
      name: "Solo",
      tagline: "For freelancers and consultants running their own book.",
      price: "$29",
      priceSub: "25 managed clients · unlimited advisory clients",
      points: [
        "Everything in Retayned, every feature",
        "Today, Clients, Health",
        "Unlimited Rai*",
        "Rolodex + Referrals",
        "Worker assignments and tasking",
      ],
      cta: "Start Free Trial",
      action: "signup",
      featured: true,
    },
    {
      name: "Agency",
      tagline: "For human teams and agencies sharing a book of business.",
      price: "$99",
      priceSub: "5 seats included · no client cap",
      points: [
        "Everything in Solo, no client cap",
        "Owner's Brief across every AM's book",
        "Per-AM coverage + assignment",
        "Role-based access",
        "Only $19 per seat after 5",
      ],
      cta: "Start Free Trial",
      action: "signup",
      featured: false,
    },
    {
      name: "Enterprise",
      tagline: "For autonomous agents and books at massive scale.",
      price: null,
      priceSub: "Custom · managed Rai, API, SSO, white-glove",
      points: [
        "Rai as an autonomous managed service",
        "MCP + REST API for your agents",
        "SOC 2, SAML/SSO, audit log",
        "Dedicated CS + custom playbooks",
        "Volume pricing",
      ],
      cta: "Contact Us",
      action: "contact",
      featured: false,
    },
  ];

  const enterpriseCards = [
    { eyebrow: "Managed Agent", title: "Rai as autonomous service.", body: "Daily sweeps across your entire book. Twelve-dimension scoring. Archetype detection. Prioritized task lists delivered to your AMs." },
    { eyebrow: "Multi-seat App", title: "Your team, one view.", body: "Unlimited seats. Role-based permissions. Full handoff history per client. When an account manager leaves, their knowledge stays...permanently and in full." },
    { eyebrow: "MCP + REST API", title: "Plug into your stack.", body: "Give your internal agents the same retention intelligence. Integrate with the communication tools your clients love. Connect to Salesforce, HubSpot, and more." },
    { eyebrow: "White-glove", title: "Onboarding + dedicated CS.", body: "A real person who knows your book. SOC 2, SAML, audit log. Quarterly business reviews. Custom playbook training." },
  ];

  return (
    <div className="pricing-page">
      <RetPageStyles />
      <style>{`
        @media (max-width: 760px) {
          .pricing-roi-grid { grid-template-columns: 1fr !important; }
          .pricing-roi-result { grid-template-columns: 1fr !important; }
          .pricing-ent-grid { grid-template-columns: 1fr !important; }
          .pricing-tier-grid { grid-template-columns: 1fr !important; }
          .pricing-ent-cta { flex-direction: column; align-items: stretch !important; }
          .pricing-contrast { flex-direction: column !important; gap: 24px !important; }
          .pricing-contrast-divider { display: none !important; }
        }
      `}</style>

      {/* ─── HERO (forest dark) ─── */}
      <section className="r-full-bleed" style={{ background: "#F2EEE8", color: C.text, padding: `${HERO_TOP}px 48px 72px`, textAlign: "center" }}>
        <div className="ret-eyebrow">Pricing</div>
        <h1 className="ret-h1" style={{ color: C.text, maxWidth: 760, margin: "0 auto" }}>
          Built to pay for itself by Tuesday afternoon.
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.55, color: C.textSec, maxWidth: 540, margin: "20px auto 0" }}>
          Every plan unlocks the entire platform — including advanced AI features. Nothing gated, nothing held back for a higher tier.
        </p>

        <div style={{ marginTop: 36 }}>
          <button className="cta-btn" onClick={() => setPage("signup")} style={{ padding: "16px 36px", fontSize: 16, fontWeight: 700, background: C.btn, color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", fontFamily: "inherit" }}>Start Free Trial</button>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 14 }}>14-day free trial. No credit card required.</div>
        </div>

        {/* Value-vs-cost contrast */}
        <div className="pricing-contrast" style={{ marginTop: 44, paddingTop: 32, borderTop: "0.5px solid " + C.border, maxWidth: 560, marginLeft: "auto", marginRight: "auto", textAlign: "center" }}>
          <p style={{ fontSize: 17, lineHeight: 1.6, color: C.textSec, margin: 0 }}>
            Replacing a lost client costs <strong style={{ color: C.text, fontWeight: 800 }}>5–25× more</strong><sup style={{ fontSize: 11, color: C.textMuted, fontWeight: 400, marginLeft: 1 }}>2</sup> than keeping one.
          </p>
        </div>
      </section>

      <RetCurve from="#F2EEE8" to={C.primaryDeep} variant="leftCrest" />

      {/* ─── THREE TIERS ─── */}
      <section className="ret-section r-full-bleed" style={{ background: C.primaryDeep, color: "#fff", paddingTop: 80 }}>
        <div className="ret-section-inner">
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div className="ret-section-head">
              <div className="ret-eyebrow ret-eyebrow-light">Plans</div>
              <h2 className="ret-h2" style={{ fontSize: "clamp(24px, 3.5vw, 36px)", color: "#fff" }}>Solve your business's most consequential problem for the cost of a Netflix subscription.</h2>
            </div>
            <div className="pricing-tier-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18, alignItems: "stretch" }}>
              {tiers.map(t => (
                <div key={t.name} className="ret-card" style={{
                  padding: "30px 30px 32px",
                  display: "flex", flexDirection: "column",
                  border: t.featured ? "1.5px solid " + C.btn : "1px solid " + C.borderLight,
                  position: "relative",
                  boxShadow: t.featured ? "0 14px 44px rgba(124,92,243,0.14)" : undefined,
                }}>
                  {t.featured && (
                    <span style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: C.btn, color: "#fff", fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", padding: "5px 14px", borderRadius: 999 }}>Most popular</span>
                  )}
                  <div style={{ fontSize: 12, fontWeight: 800, color: C.btn, textTransform: "uppercase", letterSpacing: "0.14em" }}>{t.name}</div>
                  <div style={{ fontSize: 13.5, color: C.textSec, marginTop: 8, lineHeight: 1.5, minHeight: 40 }}>{t.tagline}</div>
                  <div style={{ marginTop: 18, display: "flex", alignItems: "baseline", gap: 6 }}>
                    {t.price ? (
                      <>
                        <span style={{ fontSize: 48, fontWeight: 900, letterSpacing: "-0.03em", color: C.text, lineHeight: 1 }}>{t.price}</span>
                        <span style={{ fontSize: 15, color: C.textMuted, fontWeight: 600 }}>/mo</span>
                      </>
                    ) : (
                      <span style={{ fontSize: 48, fontWeight: 900, letterSpacing: "-0.03em", color: C.text, lineHeight: 1 }}>Let's talk</span>
                    )}
                  </div>
                  {t.priceSub && <div style={{ fontSize: 13, color: C.textSec, marginTop: 8 }}>{t.priceSub}</div>}
                  <ul style={{ listStyle: "none", margin: "22px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 11 }}>
                    {t.points.map(p => (
                      <li key={p} style={{ display: "flex", gap: 10, fontSize: 14, color: C.textSec, lineHeight: 1.5 }}>
                        <span style={{ color: C.primary, fontWeight: 800, flexShrink: 0 }}>✓</span>{p}
                      </li>
                    ))}
                  </ul>
                  <div style={{ flex: 1 }} />
                  <button
                    className="cta-btn"
                    onClick={() => setPage(t.action)}
                    style={{
                      marginTop: 26, width: "100%", padding: "13px 20px", fontSize: 15, fontWeight: 700,
                      background: t.featured ? C.btn : "transparent",
                      color: t.featured ? "#fff" : C.text,
                      border: t.featured ? "none" : "1px solid " + C.border,
                      borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
                    }}
                  >{t.cta}</button>
                </div>
              ))}
            </div>
            <div style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
              Every plan includes a 14-day free trial. No credit card required.
            </div>
            <div style={{ textAlign: "center", marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
              * Unlimited Rai is subject to fair-use limits to prevent abuse.
            </div>
          </div>
        </div>
      </section>

      <RetCurve from={C.primaryDeep} to={C.bg} variant="rightRise" />

      {/* ─── ROI CALCULATOR ─── */}
      <section className="ret-section r-full-bleed" style={{ background: C.bg }}>
        <div className="ret-section-inner">
          <div className="ret-section-head">
            <div className="ret-eyebrow">Run the math</div>
            <h2 className="ret-h2" style={{ maxWidth: 720, margin: "12px auto 0" }}>
              See what saving a client or two can do for your bottom line.
            </h2>
            <p style={{ marginTop: 14, fontSize: 17, color: C.textSec, lineHeight: 1.5 }}>Move the sliders to your reality.</p>
          </div>
          <div style={{ maxWidth: 920, margin: "0 auto" }}>
            <ROICalculator />
          </div>

          {/* Reference receipt */}
          <div style={{ maxWidth: 580, margin: "56px auto 0" }}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, color: C.textSec }}>Reference receipt</span>
            </div>
            <div className="ret-card" style={{ padding: "28px 32px" }}>
              {[
                ["You charge", "$2,500 / mo"],
                ["Retayned (Solo)", "$29.00"],
                ["—", "—"],
                ["Net per saved client", "$2,471.00"],
                ["One save covers", "85 months"],
              ].map(([k, v], i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: i < 4 ? "1px dashed " + C.borderLight : "none", fontSize: 14.5, fontWeight: i >= 3 ? 800 : 500, color: i >= 3 ? C.text : C.textSec }}>
                  <span>{k}</span><span>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <RetCurve from={C.bg} to={C.primaryDeep} variant="leftRise" />

      {/* ─── ENTERPRISE ─── */}
      <section className="r-full-bleed" style={{ background: C.primaryDeep, color: "#fff", padding: "88px 48px" }}>
        <div className="ret-section-inner" style={{ maxWidth: 1100 }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div className="ret-eyebrow ret-eyebrow-light">Retayned Enterprise · Coming Soon</div>
            <h2 className="ret-h2" style={{ color: "#fff", maxWidth: 720, margin: "0 auto" }}>
              Relationship intelligence, <span style={{ fontFamily: "'Caveat', cursive", color: C.primaryLight, fontWeight: 700, fontSize: "1.1em" }}>scaled.</span>
            </h2>
            <p style={{ color: "rgba(255,255,255,0.7)", maxWidth: 620, margin: "16px auto 0", fontSize: 15.5, lineHeight: 1.6 }}>
              For teams and agents managing your book. Multi-seat plumbing, manager dashboards, agent API.
            </p>
          </div>

          {/* What enterprise includes */}
          <div className="pricing-ent-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 18, marginTop: 8 }}>
            {enterpriseCards.map(c => (
              <div key={c.title} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "26px 28px" }}>
                <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 800, color: C.primaryLight }}>{c.eyebrow}</div>
                <div style={{ fontWeight: 800, fontSize: 19, marginTop: 10, color: "#fff", letterSpacing: "-0.01em" }}>{c.title}</div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", marginTop: 10, lineHeight: 1.6 }}>{c.body}</div>
              </div>
            ))}
          </div>

          {/* Live console mock */}
          <div style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "20px 24px", marginTop: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontSize: 13, color: C.primaryLight, fontWeight: 600 }}>● RaiS · Live view <span style={{ color: "rgba(255,255,255,0.4)", marginLeft: 10, fontWeight: 400 }}>Points to 1,247 clients · Last sweep 09:04</span></span>
              <span style={{ fontSize: 11, color: C.primaryLight, background: "rgba(85,139,104,0.12)", padding: "3px 10px", borderRadius: 999, fontWeight: 700 }}>● Running</span>
            </div>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 12.5, color: "#D4DBD2", lineHeight: 1.7 }}>
              <div><span style={{ color: "#9FB29D" }}>09:04</span> <span style={{ color: C.warning }}>SWEEP</span>  Scored 1,247 clients. Δ avg score: −0.4. Flagged 38 at-risk.</div>
              <div><span style={{ color: "#9FB29D" }}>09:04</span> <span style={{ color: C.danger }}>ALERT</span>  Foxglove Partners entered "velocity decay" archetype. Confidence: 0.87.</div>
              <div><span style={{ color: "#9FB29D" }}>09:15</span> <span style={{ color: C.primaryLight }}>TASK</span>   Generated 62 tasks. 28 outreach emails drafted and queued for review.</div>
              <div><span style={{ color: "#9FB29D" }}>09:15</span> <span style={{ color: C.primaryLight }}>SYNC</span>   Dispatched to Slack (#42), CRM (58). Next sweep: 09:04 tomorrow.</div>
            </div>
          </div>

          {/* CTA */}
          <div className="pricing-ent-cta" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 36, padding: "26px 30px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, gap: 18 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 19, color: "#fff" }}>Ready to talk?</div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", marginTop: 6, lineHeight: 1.55 }}>30-minute call with Adam. Bring your book size, your stack, and one tough account.</div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="cta-btn" onClick={() => setPage("contact")} style={{ padding: "14px 22px", fontSize: 15, fontWeight: 700, background: "#fff", color: C.primaryDeep, border: "none", borderRadius: 12, cursor: "pointer", fontFamily: "inherit" }}>Request Early Access</button>
            </div>
          </div>
        </div>
      </section>

      <RetCurve from={C.primaryDeep} to="#F2EEE8" variant="rightCrest" />

      {/* ─── FINAL CALLBACK ─── */}
      <section className="ret-section r-full-bleed" style={{ background: "#F2EEE8", textAlign: "center", padding: "72px 48px" }}>
        <div className="ret-section-inner" style={{ maxWidth: 880 }}>
          <h3 style={{ fontSize: "clamp(28px, 3.5vw, 48px)", fontWeight: 900, color: C.text, lineHeight: 1.05, letterSpacing: "-0.03em" }}>
            Saving just one relationship could pay for Retayned for a decade.
          </h3>
          <p style={{ fontSize: 17, color: C.textSec, lineHeight: 1.6, maxWidth: 620, margin: "16px auto 0" }}>See the signal. Get the script. Keep the client.</p>
          <button className="cta-btn" onClick={() => setPage("signup")} style={{ marginTop: 24, padding: "16px 36px", fontSize: 16, fontWeight: 700, background: C.btn, color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", fontFamily: "inherit" }}>Start Free Trial</button>
          <div style={{ fontSize: 13, color: C.textSec, marginTop: 12 }}>14-day free trial. No credit card required.</div>
        </div>
      </section>

      <Footer setPage={setPage} />
    </div>
  );
}

// ═══ ABOUT — ported from final/about.html ═══
function About({ setPage }) {
  const values = [
    { n: "01", t: "A 5% lift in retention beats every growth hack.", b: "Run the math. We do, and it's really not even close." },
    { n: "02", t: "AI can't do what you can.", b: "Rai drafts, reminds, and supports. You preserve and grow relationships." },
    { n: "03", t: "Water your flowers, not your weeds.", b: "Your best clients shouldn't get neglected because of new, risky business." },
    { n: "04", t: "Tools should be cheap.", b: "It's easier than ever to build world-class software. Our pricing is deliberate." },
    { n: "05", t: "CRMs shouldn't make you feel dumb.", b: "If you need onboarding calls to understand Retayned, we've failed." },
  ];

  const timeline = [
    { y: "2014", label: "First retained client.", sub: "A restaurant. Kept for four years, still friends." },
    { y: "2018", label: "The pattern emerges.", sub: "We rarely lost accounts. We started asking why." },
    { y: "2021", label: "Retention pays off.", sub: "Five-year clients. Referrals everywhere. Real growth." },
    { y: "2025", label: "A founder moment.", sub: "\"You're not in paid social. You're in retention.\"" },
  ];

  return (
    <div className="about-page">
      <RetPageStyles />
      <style>{`
        @media (max-width: 760px) {
          .about-founder-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
          .about-timeline { grid-template-columns: 1fr 1fr !important; gap: 32px 16px !important; }
          .about-timeline-line { display: none !important; }
        }
      `}</style>

      {/* ─── HERO ─── */}
      <section className="ret-section r-full-bleed" style={{ background: "#F2EEE8", paddingTop: HERO_TOP, paddingBottom: 24, textAlign: "center" }}>
        <div className="ret-section-inner" style={{ maxWidth: 880 }}>
          <div className="ret-eyebrow">About</div>
          <h1 className="ret-h1" style={{ maxWidth: 880, marginInline: "auto" }}>
            We didn't set out to build a CRM. It just made cents.
          </h1>
        </div>
      </section>

      {/* Subhead */}
      <section className="r-full-bleed" style={{ background: "#F2EEE8", padding: "8px 48px 56px", textAlign: "center" }}>
        <p style={{ maxWidth: 600, margin: "0 auto", fontSize: 18, lineHeight: 1.55, color: C.textSec }}>
          After ten years of keeping clients others lost, we knew we had something worth building (and sharing).
        </p>
      </section>

      <RetCurve from="#F2EEE8" to={C.primaryDeep} variant="leftRise" />

      {/* ─── MANIFESTO ON DARK ─── */}
      <section className="r-full-bleed" style={{ background: C.primaryDeep, color: "#fff", padding: "88px 48px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div className="ret-eyebrow ret-eyebrow-light">Our purpose</div>
          <div style={{ marginTop: 32, fontSize: "clamp(19px, 2.4vw, 24px)", lineHeight: 1.55, color: "#E8EFE8", fontWeight: 400 }}>
            <p>Most CRMs are built around the deal. The signed contract. The closed-won.</p>
            <p style={{ marginTop: 22 }}>
              We think the deal is the <em style={{ fontStyle: "italic" }}>least</em> interesting moment in a client relationship.
            </p>
            <p style={{ marginTop: 22 }}>
              It's the part everyone celebrates yet nobody protects. The real work — and the real growth — is in what comes after: the relationships you keep, renew, and strengthen while your competitors are still chasing strangers.
            </p>
            <p style={{ marginTop: 22 }}>
              It isn't flashy. <strong style={{ fontWeight: 900, color: "#fff" }}>It's just better business.</strong>
            </p>
          </div>
        </div>
      </section>

      <RetCurve from={C.primaryDeep} to="#F2EEE8" variant="rightCrest" />

      {/* ─── FOUNDER + VALUES ─── */}
      <section className="ret-section r-full-bleed" style={{ background: "#F2EEE8" }}>
        <div className="ret-section-inner" style={{ maxWidth: 1100 }}>
          <div className="about-founder-grid" style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 40, alignItems: "start" }}>
            {/* Founder card */}
            <div className="ret-card" style={{ padding: "36px 32px" }}>
              <div className="ret-eyebrow">Founder</div>
              <div style={{ display: "flex", gap: 18, marginTop: 18, alignItems: "center" }}>
                <div style={{ width: 84, height: 84, borderRadius: 16, overflow: "hidden", background: C.primarySoft, flexShrink: 0 }}>
                  <img src="/AdamLawrence.jpg" alt="Adam Lawrence" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 22%" }} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 19, color: C.text }}>Adam Lawrence</div>
                  <div style={{ fontSize: 13, color: C.textSec, marginTop: 2 }}>Owner-operator turned Founder. At your service.</div>
                </div>
              </div>
              <p style={{ fontSize: 14.5, color: C.textSec, marginTop: 22, lineHeight: 1.6 }}>
                Ten years of paid social. Ran campaigns for agencies, DTC brands, SMBs and Fortune 500 companies. Kept the clients other people lost. Eventually figured out why — and then turned it into the system you're looking at.
              </p>
              <div style={{ marginTop: 22, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span style={{ display: "inline-block", padding: "5px 12px", background: C.primarySoft, color: C.primary, borderRadius: 999, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em" }}>Washington, DC</span>
                <a href="mailto:adam@retayned.com" style={{ display: "inline-block", padding: "5px 12px", background: C.primarySoft, color: C.primary, borderRadius: 999, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", textDecoration: "none" }}>adam@retayned.com</a>
              </div>
            </div>

            {/* Values list */}
            <div>
              <div className="ret-eyebrow">What we believe</div>
              <div style={{ marginTop: 22 }}>
                {values.map((v, i) => (
                  <div key={v.n} style={{ padding: "18px 0", borderBottom: i < values.length - 1 ? "1px solid " + C.borderLight : "none" }}>
                    <div style={{ display: "flex", gap: 14, alignItems: "baseline" }}>
                      <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: C.btn, fontWeight: 800, letterSpacing: "0.05em" }}>{v.n}</span>
                      <strong style={{ fontSize: 15.5, color: C.text, letterSpacing: "-0.01em" }}>{v.t}</strong>
                    </div>
                    <div style={{ fontSize: 13.5, color: C.textSec, marginLeft: 28, marginTop: 6, lineHeight: 1.55 }}>{v.b}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <RetCurve from="#F2EEE8" to={C.bg} variant="leftCrest" />

      {/* ─── TIMELINE ─── */}
      <section className="ret-section r-full-bleed" style={{ background: C.bg, paddingBottom: 96 }}>
        <div className="ret-section-inner">
          <div className="ret-section-head">
            <div className="ret-eyebrow">The Timeline</div>
            <h2 className="ret-h2">
              How we got here, in four moments.
            </h2>
          </div>

          <div className="about-timeline" style={{ maxWidth: 1000, margin: "44px auto 0", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", position: "relative" }}>
            <div className="about-timeline-line" style={{ position: "absolute", top: 14, left: "6%", right: "6%", height: 1, background: C.borderLight }} />
            {timeline.map(m => (
              <div key={m.y} style={{ textAlign: "center", position: "relative", padding: "0 14px" }}>
                <div style={{ width: 14, height: 14, borderRadius: 999, background: C.btn, margin: "8px auto 0", border: "3px solid " + C.bg }} />
                <div style={{ fontWeight: 900, fontSize: 15, marginTop: 16, color: C.primary, letterSpacing: "0.04em" }}>{m.y}</div>
                <div style={{ fontSize: 14.5, fontWeight: 800, marginTop: 8, color: C.text, letterSpacing: "-0.01em" }}>{m.label}</div>
                <div style={{ fontSize: 13, color: C.textSec, marginTop: 8, lineHeight: 1.55 }}>{m.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <RetCurve from={C.bg} to="#F2EEE8" variant="leftCrest" />

      {/* ─── FINAL CTA ─── */}
      <section className="ret-section r-full-bleed" style={{ background: "#F2EEE8", paddingBottom: 96 }}>
        <div className="ret-section-inner">
          <div style={{ textAlign: "center" }}>
            <p style={{ fontWeight: 900, fontSize: "clamp(28px, 3.5vw, 48px)", color: C.text, lineHeight: 1.05, letterSpacing: "-0.03em" }}>
              Your clients won't know Retayned exists.<br />They'll just stay.
            </p>
            <p style={{ fontSize: 17, color: C.textSec, lineHeight: 1.6, maxWidth: 620, margin: "16px auto 0" }}>Everything you need and more to keep a client.</p>
            <button className="cta-btn" onClick={() => setPage("signup")} style={{ marginTop: 18, padding: "16px 36px", fontSize: 16, fontWeight: 700, background: C.btn, color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", fontFamily: "inherit" }}>Start Free Trial</button>
            <div style={{ fontSize: 13, color: C.textSec, marginTop: 10 }}>14-day free trial. No credit card required.</div>
          </div>
        </div>
      </section>

      <Footer setPage={setPage} />
    </div>
  );
}

// ═══ RESOURCES (was Blog) — ported from final/resources.html ═══
const RESOURCES_CONTENT = [
  {
    slug: "water-your-flowers-before-your-weeds",
    tag: "DIAGNOSTICS",
    read: "4 min read",
    kind: "article",
    featured: false,
    title: "Water your flowers before your weeds",
    excerpt: "Your best client gets a quiet quarter while you pour energy into the new account that may never be great. That trade is more expensive than it feels.",
    body: `# Water your flowers before your weeds

Look at where your attention actually went last month. Not where you meant for it to go. Where it went.

For most operators, the honest answer is uncomfortable: the loudest, newest, least-proven accounts got the most of you. The new logo you're still trying to impress. The difficult client who emails at 11pm. The prospect who might sign. Meanwhile the three clients who have paid you on time for two years, never made a scene, and refer you without being asked got a few quick replies and a quarter of silence.

You watered the weeds. The flowers went dry.

## The trap is that weeds demand and flowers don't

A struggling or demanding account announces itself. It generates fires, threads, escalations. It feels urgent, so it gets your hours. A great account does the opposite. It runs quietly, asks for little, and gives you no reason to think about it. Its very health is what makes it easy to ignore.

So the natural pull of any given week is to spend your best energy on your worst-fit business, and your leftover energy on your best. Repeat that for a year and you've systematically underinvested in exactly the relationships that fund everything else.

## What the neglect actually costs

A new, marginal client might become great, or might churn in six months and was never going to be worth the acquisition cost. That's a bet. A two-year client with a clean payment history and a habit of referring you is not a bet. It's a known, compounding asset. When you let it coast untended, you're risking a sure thing to chase a maybe.

And the downside isn't symmetric. Lose the maybe and you've lost a maybe. Lose the flower and you've lost recurring revenue, the referrals that came with it, and the reputation that client carried for you in rooms you were never in.

## The discipline is deciding on purpose

This isn't "ignore new business." New clients are how you grow, and some weeds become flowers. The discipline is refusing to let urgency alone allocate your attention, because urgency always over-funds the wrong accounts.

Once a week, before the inbox sets your agenda, look at your best clients specifically and ask one question: when did I last give this relationship something it didn't ask for? A useful insight, a heads-up, a recap of a win, a genuine check-in. If the answer is "I can't remember," that flower is going dry while you weren't looking, and a competitor's pitch lands cleanest on exactly the client you stopped watering.

---

*Retayned watches your whole book at once, including the quiet accounts you'd otherwise forget, so the clients keeping your business alive never go a quarter without your attention.*`,
  },
  {
    slug: "how-to-stop-losing-clients",
    tag: "RETENTION",
    read: "6 min read",
    kind: "article",
    featured: false,
    title: "How to stop losing the clients you worked to win",
    excerpt: "You can do everything right and still lose a client six months later without knowing why. The quiet signals that predict it — and the habits that catch it in time.",
    body: `# How to Stop Losing the Clients You Worked So Hard to Win

You can do everything right to win a client — the pitch, the onboarding, the first great deliverable — and still lose them six months later without ever knowing why. No blowup. No complaint. Just a relationship that slowly went cold until one day the work stopped coming and a quiet "we're going in a different direction" email landed in your inbox.

Losing a client you fought to win is one of the most demoralizing things in freelancing, and one of the most expensive. It costs roughly five times more to land a new client than to keep an existing one, which means every avoidable departure sends you back to the most exhausting, lowest-paid part of the job: chasing strangers. This is a guide to the other path — keeping the clients you already have, by understanding why they leave and building the habits that stop it.

## Start here: it's almost never the work

When freelancers lose a client, the first place they look is the work. Was the last project not good enough? Usually that's not it. Talent is what got you hired. What keeps you hired is everything *around* the work — and that's the part most freelancers stop maintaining the moment they get busy.

The real reasons clients leave are quieter:

- **They drifted.** The project ended, nobody initiated the next step, and inertia did the rest. The client didn't decide to leave so much as fail to decide to stay.
- **The relationship thinned.** You were close once; the regular rhythm faded; you became a vendor instead of a partner. Vendors are replaceable.
- **Their champion left.** The person who hired you and defended your budget moved on. Whoever inherited the relationship never chose you.
- **A small frustration compounded.** A little less patience, a slightly slower reply, a scope disagreement nobody addressed — individually trivial, together corrosive.

None of those is "the work was bad." All of them are catchable, if you're paying attention.

## The early-warning signs of a client about to leave

Departures leave a trail. Here are the signals, roughly in the order they appear:

**Communication cools.** The earliest and most reliable sign. Replies that came in an hour now take three days. Messages get shorter and more formal. The warmth drains out before anything is ever said. If you're suddenly the one doing most of the reaching out, pay attention.

**The post-delivery silence.** Counterintuitively, the riskiest stretch is right after you deliver something great. The project wraps, everyone's happy, and then nothing. A finished win with no follow-up is where repeat work quietly dies.

**Payment rhythm shifts.** Invoices that cleared in ten days now take thirty. Budget questions come up more. Requests to move from retainer to one-off work. Money is a lagging signal, but an unambiguous one.

**The quiet, steady client you've stopped thinking about.** The one who never causes trouble, sits at the top of your book, and hasn't heard from you in two months — because they never demanded attention. The clients who leave quietly are almost always the ones who never gave you any trouble. They're the easiest to take for granted and the most expensive to lose.

## Why these signals are so easy to miss

If the signs are this knowable, why does anyone get blindsided? Because no single signal trips an alarm. One slow reply is a busy week. One late invoice is accounting. One skipped check-in is the season. Each piece looks like nothing on its own, and connecting them across your *entire* book, every week, is a real job — one you don't have time for because you're busy doing the actual work.

This is the core bind of running a book of business solo. You can hold maybe 15 relationships in your head through sheer attention. Past that, memory and instinct stop scaling, and the quiet ones slip through exactly because they're quiet.

## The habits that actually stop client loss

You don't need to care more — you already care. You need to make the signals visible without relying on memory. These work even with nothing but a calendar and a spreadsheet:

1. **Keep a simple health read on every client.** Warm, cooling, cold. Update it when something shifts. Naming it is the first catch.
2. **Run a real check-in cadence.** Not "when I remember" — a schedule. A recurring reminder to reach out to your top relationships beats waiting for them to go quiet.
3. **Watch the quiet ones on purpose.** Your at-risk list isn't the clients complaining; it's the steady ones who've gone silent. Build a habit of checking who you *haven't* talked to.
4. **Never let a win go cold.** Put a follow-up on the calendar for a week after every project wraps, while they still feel the value.
5. **Catch friction early.** The small frustration you address this week is the cancellation you avoid next quarter.

The thread through all of it: retention is attention paid consistently, and the moment you get busy is the exact moment that attention slips.

## Where Retayned fits

This is the whole reason Retayned exists. It watches the health of every client relationship the way you would if you had the time — scoring each one, flagging the quiet client who's drifting, surfacing the win you never followed up on, and telling you who needs you this week before "drifting" becomes "gone."

It won't do the relationship for you. It makes sure nothing reaches you too late to act on while there's still time. If you've ever lost a client and thought *I should have seen that coming* — that's the gap this closes, and it's a far cheaper way to grow than starting over with a stranger every time one slips away.`,
  },
  {
    slug: "how-to-get-more-freelance-clients",
    tag: "GROWTH",
    read: "5 min read",
    kind: "article",
    featured: false,
    title: "How to get more freelance clients (start with the ones you have)",
    excerpt: "Everyone points you toward strangers. The cheapest, highest-converting clients are the ones already in your orbit — here's how to work the warm sources first.",
    body: `# How to Get More Freelance Clients (Start With the Ones You Already Have)

Search "how to get more freelance clients" and you'll drown in the same advice: optimize your profile, post on LinkedIn, cold pitch, bid on job boards, niche down, network harder. It's not wrong. But it all points in one direction — *out*, toward strangers — and it skips the cheapest, highest-converting source of new work you have: the clients and former clients already in your orbit.

This isn't a "don't market yourself" argument. New leads matter. But if you're only ever hunting cold, you're working the hardest, slowest, lowest-paid version of growth and ignoring the warm one sitting right next to it. Here's how to get more clients by starting with the people who already know you're good.

## Why warm beats cold, every time

A cold prospect has to be found, convinced you're competent, and talked past their hesitation — that's hours of unpaid effort with low odds. Someone who's already worked with you needs none of that. They've seen your work, they trust you, and the friction of saying yes again is almost zero. Repeat and referred clients convert at a far higher rate, pay better, and stick around longer, because the relationship does the selling.

So before you spend another evening cold-pitching, work these three warmer sources.

## 1. Turn one-off clients into repeat clients

Most freelancers treat a finished project as an ending. It's not — it's the warmest moment you'll ever have with that client. They just experienced your work; the trust is at its peak.

- **Propose the next thing while you're still top of mind.** A week after delivery, not six months later: "Here's what I'd tackle next if I were you." Project-to-retainer conversions are dramatically higher when proposed right after a win than when pitched cold later.
- **Make staying easy.** Offer a retainer or a maintenance package. Recurring work is the single best antidote to the feast-or-famine cycle, and clients often prefer it too — it means they don't have to go re-hire someone.

## 2. Reactivate past clients

The clients you finished with months ago haven't forgotten you — they've just gotten busy. A finished project is a relationship on pause, not a closed account. A simple, no-pressure reconnect ("thinking of you, saw this and it made me think of your work, how's everything going?") reopens doors more often than you'd guess. No pitch required; just presence at the right moment.

The catch: this only works if you actually remember to do it, and remember *who*. Most freelancers mean to stay in touch with past clients and never do, because there's no system holding those names.

## 3. Ask for referrals — at the right moment

Your happy clients know other people who need what you do. Most freelancers never ask, or ask awkwardly at the wrong time. The move is to ask when the relationship is warmest — right after you've delivered something they're thrilled with — and to make it easy and low-pressure: "If you know anyone wrestling with the same thing, I'd love an introduction." A warm referral is the highest-converting lead there is, because it arrives pre-trusted.

## Then, yes — go get cold leads too

With the warm sources working, your cold outreach gets easier, because you're not desperate. Network, post, pitch, niche down — all of it works better when you're not scrambling to fill a famine. The freelancers who look effortless at getting clients usually aren't better at cold outreach; they just have a warm base that keeps producing, so the cold stuff is a bonus rather than a lifeline.

## The system underneath all of this

Every warm source above depends on one thing: actually keeping track of your relationships — who you've worked with, who's gone quiet, who's due for a check-in, who just had a win worth following up on. Do that in your head and it works until about 15 clients, then the names start slipping and the warm opportunities go cold from neglect.

That's what Retayned does: it keeps every client and former client in one place, tracks the health of each relationship, and tells you who's worth reaching out to and when — so "get more clients" stops meaning "find more strangers" and starts meaning "stop leaving warm business on the table." The cheapest new client is the one you already earned.`,
  },
  {
    slug: "how-to-fire-a-client",
    tag: "BOUNDARIES",
    read: "5 min read",
    kind: "article",
    featured: false,
    title: "How to fire a client without burning the bridge",
    excerpt: "Some clients cost more than they pay. How to know when it's time, end it cleanly, and keep the door open for the referral or return down the line.",
    body: `# How to Fire a Client (Without Burning the Bridge)

Some clients cost more than they pay. The 11pm "quick question" texts. The scope that keeps creeping. The invoices you have to chase every single month. The knot in your stomach when their name shows up in your inbox. At some point the math stops working: this one client is quietly eating the time, energy, and goodwill you need for the clients who actually deserve it.

Firing a client is one of the hardest things to do as a freelancer, because it goes against every instinct that got you here. You fought to land clients. Letting one go feels like moving backward. But keeping the wrong one is what's actually moving you backward — it just doesn't show up on an invoice.

This guide walks through how to know when it's time, how to do it cleanly, and how to end the relationship in a way that protects your reputation, your income, and your peace of mind.

## First: are you sure it's a firing, not a fixing?

Before you end anything, be honest about whether the problem is the client or the setup. A lot of "bad clients" are really bad boundaries or a vague agreement. Run through this first:

- **Is the scope actually defined?** Scope creep usually means the original agreement was loose. That's fixable with a clear statement of work, not a breakup.
- **Have you raised the issue directly?** Many clients don't know they're being difficult. The late-night texts, the constant revisions — sometimes one calm conversation ("I want to make sure I'm giving you my best work, so let's set how we communicate") solves it.
- **Is it a money problem or a respect problem?** An underpaying client can be repriced. A disrespectful one usually can't be repaired.

If you've genuinely tried to fix it and the relationship still drains more than it gives, it's a firing. The clients worth keeping respond to a boundary. The ones worth firing ignore it.

## The signs it's actually time

You're past fixing when:

- They cost you more in stress and hours than they pay, and repricing won't close the gap.
- Every interaction leaves you depleted, and it's affecting your work for *other* clients.
- They've crossed a line on respect — talking down to you, ignoring agreements, disputing fair invoices in bad faith.
- You're avoiding their emails. That avoidance is information.

## How to fire a client cleanly

The goal is a clean, professional exit that leaves no smoke behind you. Freelancing is a small world; today's fired client knows people you'll want as clients later.

**1. Finish or formally close the current obligation.** Don't abandon work mid-deliverable — that's the one move that genuinely damages your reputation. Complete what's contracted, or define a clear, fair stopping point.

**2. Keep the reason simple and non-personal.** You don't owe a detailed indictment. "It's not the right fit" or "my focus is shifting and I won't be able to give your work the attention it deserves" is enough. Make it about fit, not fault. The "it's me, not you" framing isn't a cliché here — it's the professional move.

**3. Give reasonable notice.** Enough for them to find a replacement. Two to four weeks is standard for ongoing work. This single courtesy is what turns a firing into a "we parted on good terms."

**4. Put it in writing, warmly.** A short email confirming the end date, what you'll deliver before then, and a genuine well-wish. Calm, brief, kind.

**5. Offer a soft landing if you can.** Recommending another freelancer who'd be a better fit is the move that makes a fired client *thank* you. It costs you nothing and it's the difference between a resentful ex-client and one who still refers you.

## A template you can adapt

> Hi [Name], I've been thinking about our work together and I want to be straight with you. I don't think I'm the right fit for what you need going forward, and you deserve someone who can give it their full attention. I'll wrap up [current deliverable] by [date] so you're not left in a tough spot. If it's helpful, I'm happy to recommend a couple of people who'd be a great match. It's been good working with you, and I wish you the best with it.

No drama, no blame, no door slammed.

## The part most freelancers miss: a fired client is still a relationship

Here's what separates freelancers who run a stable business from ones stuck on the hamster wheel: they understand that ending a *project* doesn't have to mean ending a *relationship*. The client you let go of gracefully today is someone who might refer you, or come back under better terms, or vouch for you in a room you're not in.

That only works if you keep the bridge intact — and if you actually remember them later. Most freelancers fire a client, feel the relief, and forget the name. The ones who play the long game file that person away, note that you parted well, and stay loosely in touch.

This is exactly the kind of thing Retayned is built to hold for you. When you part with a client on good terms, they don't vanish — they stay in your book as a former client you left the door open with, so a graceful exit today can quietly become a referral or a return down the line. Firing a client is sometimes the right call. Forgetting them afterward rarely is.`,
  },
  {
    slug: "how-to-deal-with-difficult-clients",
    tag: "BOUNDARIES",
    read: "4 min read",
    kind: "article",
    featured: false,
    title: "How to deal with difficult clients",
    excerpt: "The micromanager, the scope-creeper, the slow payer. Most difficult clients aren't bad people — they're a boundaries problem. Type by type, what actually works.",
    body: `# How to Deal With Difficult Clients

Every freelancer has one. The client who needs five revisions on a logo. The one who texts at 11pm expecting an answer by 11:05. The one who questions every line of every invoice. A single difficult client can sour your whole week and bleed into the work you do for everyone else.

Here's the reframe that actually helps: most difficult clients aren't bad people. They're usually anxious, unclear, or operating without the structure that would make them easy to work with. The good news is that a lot of "difficult" is fixable with better boundaries and clearer agreements — and the part that *isn't* fixable, you can spot early and exit cleanly. Let's go type by type.

## The micromanager

They check in constantly, want to approve every step, and seem to have hired you only to watch you work. Usually this isn't distrust of *you* — it's anxiety about letting go of something with their name on it.

**What works:** give them structure that scratches the control itch without handing them the wheel. A scheduled weekly update, a shared progress doc, a clear "here's what I'll send and when." When someone knows exactly when the next update lands, the impulse to poke at you mid-task fades. You're replacing their anxiety with a system.

## The scope-creeper

It starts with "just one small thing" and ends with you doing double the work for the original fee. Scope creep is rarely malice; it's usually a vague agreement and a client who doesn't realize each "small thing" adds up.

**What works:** a clear statement of work you can point back to, and a calm, repeatable line for out-of-scope asks: "Happy to do that — it's outside our current scope, so I'll send a quick quote for it." Said warmly and consistently, it trains the relationship without friction. You're not refusing; you're pricing.

## The slow payer

Invoices that clear in ten days start taking thirty. Sometimes it's cash-flow trouble on their end; sometimes it's just disorganization. Either way it's your income on the line.

**What works:** clear payment terms up front (due dates on every invoice, a deposit for larger work), and friendly, prompt follow-up the moment something runs late — not three weeks after. Most late payment is fixed by a polite nudge, not a confrontation. If it's chronic and the conversation goes nowhere, that's a signal about the relationship, not just the invoice.

## The one who doesn't value your expertise

They argue with your recommendations, want it done their way, and seem to think they could've done it themselves. Draining, because it makes you doubt yourself.

**What works:** don't take it personally, and don't get defensive. Step back, understand what they're actually worried about, and explain your reasoning once, clearly. Often the disagreement is a misunderstanding about goals. If you explain your thinking and they still want to override your expertise on everything — that's a fit problem, and fit problems usually don't get better.

## The throughline: structure prevents most "difficult"

Notice the pattern. Almost every difficult-client situation traces back to one of two things: a fuzzy agreement, or weak communication cadence. Tighten those two and most "difficult" never materializes:

- **Set expectations before you start** — scope, communication channels, response times, payment terms, in writing.
- **Communicate proactively** — the freelancer who sends the update first is rarely the one getting anxious 11pm texts.
- **Address problems early and calmly** — small course-corrections beat big confrontations.

## When it's not fixable

Some relationships can't be saved, and that's okay. If you've set clear boundaries, communicated in good faith, and the client still disrespects your time, your work, or your rates — it may be time to part ways. Knowing how to end it cleanly is its own skill, and protecting your energy for the clients who *do* value you is not a failure. It's good business.

## Where this connects to keeping the right clients

The flip side of managing difficult clients well is that it makes the good relationships obvious — and worth protecting. The same habits that defuse a micromanager (proactive updates, a clear cadence, catching friction early) are exactly what keeps your *best* clients from quietly drifting away.

That's the thinking behind Retayned: a clear read on every client relationship and a nudge when one needs attention, so the difficult ones get handled before they blow up and the good ones don't get neglected while you're busy putting out fires. Managing clients well isn't just damage control. It's how the relationships worth keeping stay kept.`,
  },
  {
    slug: "the-compounding-edge",
    tag: "FRAMEWORK",
    read: "5 min read",
    kind: "article",
    featured: false,
    title: "The compounding edge nobody brags about",
    excerpt: "New deals get the applause. Kept clients build the thing nobody can take from you. Why retention is the most underrated advantage a small operator has.",
    body: `# The compounding edge nobody brags about

Walk into any room of operators and listen to what they talk about. New clients. Big wins. The pitch they just landed. Nobody stands up and says "I kept everyone I had this year." It doesn't sound like an accomplishment. It sounds like nothing happened.

That's exactly why retention is the most underrated edge in business. The thing that compounds fastest is the thing nobody thinks to brag about.

## Acquisition is a tax you pay over and over

Winning a new client is expensive. It costs pitches, proposals, discovery calls, the price of every prospect who said no, and the slow ramp before a new account is profitable. Most operators pay that tax constantly because they treat their book as a leaky bucket: pour new clients in the top, lose old ones out the bottom, and run hard just to stay level.

Keeping a client you already have skips the entire tax. No pitch, no ramp, no acquisition cost. The relationship is already profitable and the trust is already built. A dollar of retained revenue is worth more than a dollar of new revenue because it cost you almost nothing to earn it again.

## Why it compounds and acquisition doesn't

A new client is a flat event. You won them, once. A kept client is a curve. Year two they're more profitable than year one, because you understand their business and the work goes faster. Year three they refer someone. Year four they're a case study, a reference, the reason a prospect trusts you on the first call.

Retention doesn't add. It multiplies. Every year you keep a good client, they're worth more than the year before, and that surplus stacks. The operator who keeps clients for five years isn't doing five times the work of the one who churns annually. They're doing less work for more money, and the gap widens every year.

## How the quiet operator wins

This is how a single person out-earns a whole sales team. The team is busy paying the acquisition tax, running flat, celebrating new logos that replace the ones quietly leaving. The operator who masters retention stops paying the tax, lets their book compound, and ends up owning a niche nobody noticed them taking, because the win didn't look like a win. It looked like a quiet year where everyone stayed.

It will never trend. It will never get applause. It just works, relentlessly, in the background, which is the whole point.

---

*Retayned is built for the part of the business that compounds: the relationships you already earned. It watches them, scores them, and tells you who needs you, so keeping clients stops depending on memory and starts being a system.*`,
  },
  {
    slug: "your-best-client-is-fragile",
    tag: "DIAGNOSTICS",
    read: "4 min read",
    kind: "article",
    featured: false,
    title: "Why your best client is your most fragile",
    excerpt: "Stable is not safe. The account you've stopped worrying about is the one a competitor's pitch lands on cleanest.",
    body: `# Why your best client is your most fragile

Ask an operator which client keeps them up at night and they'll name the difficult one. The escalations, the late payments, the impossible stakeholder. That's the account they're watching.

Which is exactly why it's not the one in danger. The client you're watching closely is safe. The one that should keep you up at night is the one you've completely stopped thinking about, because it never gives you a reason to.

## Stable is a status, not a guarantee

A long, smooth, low-drama relationship feels permanent. It's been good for two years, so you assume it'll be good for two more. But "stable" only describes the past. It tells you the relationship hasn't given you trouble. It doesn't tell you the client still values you, still remembers why they chose you, or still feels like they're getting their money's worth.

Those things decay quietly. A client can drift from "this is essential" to "this is a line item I haven't questioned in a while" without a single negative interaction. Nothing breaks. The work still ships, the invoices still get paid. And then a budget review happens, or a new boss arrives, or a competitor sends a sharp pitch, and the relationship that felt permanent turns out to have been coasting on inertia.

## Inertia cuts both ways

The thing keeping a coasting client is the same thing that makes them easy to lose: they haven't thought about you in a while. Inertia is holding the relationship in place. The moment something interrupts the inertia, a reorg, a cost-cutting mandate, a rival who shows up with a number, there's nothing underneath it. No recent win they can point to. No fresh reason to stay. Just a habit, and habits break the instant someone gives a reason to question them.

A difficult, engaged client has the opposite problem and the opposite safety. They're annoying precisely because they're paying attention, and a client paying attention is a client you can still win.

## The move is to interrupt your own inertia first

You can't stop a competitor from pitching or a new stakeholder from arriving. What you can do is make sure that when they do, your best client has a fresh, specific reason to stay, one you put there on purpose.

That means periodically doing for your coasting accounts what you do reflexively for your fires: showing up with something. A recent result framed clearly. A recommendation they didn't ask for. A reminder, made concrete, of what they're actually getting. Not because anything is wrong, but because the absence of anything wrong is exactly the condition under which good clients quietly slip away.

---

*Retayned flags the accounts that have gone quiet and stable, the ones you've stopped watching, so the relationships most likely to be lost to inertia are the ones you re-engage before someone else does.*`,
  },
  {
    slug: "rai-drafts-you-decide",
    tag: "PLAYBOOK",
    read: "5 min read",
    kind: "article",
    featured: false,
    title: "Rai drafts, you decide: where AI belongs in a client relationship",
    excerpt: "AI can surface the signal and draft the words. It cannot carry the relationship. Here's the line, and why it matters.",
    body: `# Rai drafts, you decide: where AI belongs in a client relationship

There's a version of "AI for client management" that's a trap. It promises to automate the relationship: auto-send the check-ins, auto-reply to the emails, run the account on autopilot so you don't have to. That version will lose you clients faster than neglect, because clients can feel when they're being managed by a script.

The useful version is the opposite. AI handles the parts that are pattern, memory, and drafting. You handle the parts that are judgment, relationship, and accountability. Getting that line right is the whole game.

## What AI is genuinely good at here

Three things, and they're real.

First, watching. A person cannot hold the state of fifty relationships in their head, notice that one client's emails have cooled over six weeks, and remember that another's renewal is forty days out. Pattern detection across a whole book is exactly what software is for, and it's the part humans are worst at.

Second, remembering. The contact's role, the last touchpoint, the rate history, the win from four months ago that's worth resurfacing. AI doesn't forget the context that makes a message land.

Third, drafting. Staring at a blank message to a client who's gone quiet is where good intentions die. A strong first draft, in your voice, calibrated to that specific relationship, gets you from nothing to "almost right" in a way that makes the move actually happen.

## What it must never do

It must not decide, and it must not send blind.

The judgment call, is this the moment to push, or to give space, is yours, because only you carry the history and the stakes. The relationship is yours, not the tool's. When you send a client a message, your name is on it and your reputation is behind it, and that accountability is exactly what makes the message mean something. A client who finds out they've been talking to an autoresponder doesn't think "how efficient." They think "I don't matter enough for a real person."

So the draft is a starting point, never a send button you stopped reading. The tool gets you to the doorstep. You're the one who knocks.

## Why the line is the point

The fear that AI will replace the operator gets this backwards. The operator's edge was never doing the busywork faster. It was the attention, the judgment, the relationship. Hand the busywork to the tool and you don't become less essential. You become more, because now all of your attention goes to the part only you can do.

AI can give you the signal and the script. It cannot care about the client. That part is still your job, and it always will be.

---

*Rai drafts, reminds, and surfaces what's worth your attention. The decision, the relationship, and the send are always yours. That's the line Retayned is built around.*`,
  },
  {
    slug: "the-referral-you-didnt-ask-for",
    tag: "PLAYBOOK",
    read: "4 min read",
    kind: "article",
    featured: false,
    title: "The referral you didn't ask for",
    excerpt: "Your best growth channel isn't a campaign. It's the client who already trusts you. Here's how to make referrals happen without it feeling like a pitch.",
    body: `# The referral you didn't ask for

The cheapest, highest-converting lead you'll ever get is a client referral. The prospect arrives pre-trusting you, pre-sold by someone they respect, and ready to skip the entire skeptical phase. No ad spend, no cold outreach, no proving yourself from zero.

So why do most operators get so few of them? Not because their clients wouldn't refer. Because nobody made it easy, and the moment was never set up on purpose.

## Referrals come from kept clients, not happy ones

There's a difference. A happy client likes the work. A kept client, one who's been with you long enough to see results compound, has staked a little of their own credibility on you. They've told their boss you're worth it. When they refer you, they're not doing you a favor. They're reinforcing a decision they already made and want to feel good about.

This is why retention and referrals are the same engine. You don't run a referral program. You keep clients long enough and well enough that referring you becomes a natural extension of how they already talk about you. The book you've retained is your sales team, and they work for free.

## The timing nobody uses

The instinct is to ask for referrals at renewal, bundled with the awkward money conversation. That's the worst moment. The client is evaluating you, not advocating for you.

The right moment is right after a concrete win. You delivered a result, they're feeling it, the value is fresh and specific. That's when a client is most willing to put their name behind you, because the evidence is sitting right in front of them. The move isn't "do you know anyone who needs us." It's lighter: "Glad that landed. If anyone in your network is wrestling with the same thing, I'd love an intro, no pressure." You're attaching the ask to a moment of proof, not a moment of doubt.

## Make the referral effortless to give

A client who has to think about how to refer you usually won't. Hand them the language. A one-line description of exactly who you help and what you solve, easy to forward, easy to repeat. The goal is that referring you costs them ten seconds and zero risk, because every bit of friction is a referral that doesn't happen.

The operators with overflowing pipelines and no ad budget aren't lucky. They kept clients long enough to earn advocacy, then made it easy and well-timed to act on. That's a system, not a stroke of luck.

---

*Retayned tracks the wins worth following up on and the relationships strong enough to ask, so the referral conversation happens at the right moment with the right client, instead of never happening at all.*`,
  },
  {
    slug: "the-renewal-is-decided-before-the-renewal",
    tag: "DIAGNOSTICS",
    read: "4 min read",
    kind: "article",
    featured: false,
    title: "The renewal is decided before the renewal",
    excerpt: "By the time the contract is up, the decision is already made. The work that keeps a client happens in the quiet months nobody's watching.",
    body: `# The renewal is decided before the renewal

Here's the mistake that loses good accounts: treating the renewal as the moment you win or lose the client. By the time the renewal date arrives, the decision has usually already been made, weeks or months earlier, in conversations you weren't part of. The renewal is just the paperwork that confirms it.

If you're trying to save a relationship at renewal time, you're not negotiating. You're appealing a verdict that's already been reached.

## The decision is a slow accumulation

A client doesn't decide to leave at renewal. They drift toward it. A cooled relationship here, a result that didn't quite land there, a stretch where they couldn't quite remember what they were paying for. None of it is dramatic. Each individual moment is forgettable. But they accumulate, quietly, into a default position, and by renewal that position is set: "I'm not sure this is worth it anymore."

The reverse is also true and more useful. A client who renews enthusiastically doesn't decide at renewal either. They decided over months of small, accumulated reasons to stay: the win they remember, the heads-up that saved them, the sense that you're paying attention. Renewal just ratifies what the quiet months already built.

## This is why the quiet months matter most

The months when nothing is happening, no fire, no deadline, no renewal pressure, feel like the safe stretch where you can take your foot off the gas. They're actually the only stretch that decides anything. The renewal conversation is downstream of them. Whatever you did or didn't do in those quiet months is what the client is voting on when the contract comes up.

So the work isn't a strong renewal pitch. It's a steady accumulation of reasons to stay, deposited during the months when it would be easiest to deposit nothing. A recap of a result. A useful flag. A check-in with substance. Each one is a small entry on the side of "worth it," made long before anyone's counting.

## Earn it before it's due

The operators who never sweat renewals aren't better closers. They've moved the work upstream. They treat every quiet month as part of the renewal, because it is. By the time the contract is actually up, there's nothing to sweat, because the case for staying was made continuously, in the open, while their competitors were waiting for a deadline to start trying.

The renewal is a lagging indicator. Manage the months. The date takes care of itself.

---

*Retayned makes the quiet months legible, surfacing the touchpoints, wins, and warning signs that decide a renewal long before the date arrives, so you're building the case to stay the whole time, not scrambling at the end.*`,
  },
  {
    slug: "the-client-tenure-audit",
    tag: "GUIDE",
    read: "6 min read",
    kind: "guide",
    featured: false,
    title: "The Client Tenure Audit",
    excerpt: "A simple, repeatable way to look at your whole book by tenure and health, and find the accounts quietly drifting before they're gone.",
    body: `# The Client Tenure Audit

Most operators have never looked at their entire book in one view. They look at clients one at a time, as each one surfaces a task or a fire. That means the accounts that aren't surfacing anything, the quiet ones, are invisible by definition, and the quiet ones are where churn hides.

This is a simple audit you can run in an afternoon, with a spreadsheet and an honest eye. Do it once a quarter.

## Step 1: List every active client with three numbers

For each client, write down three things: how long they've been with you (tenure), roughly how much they're worth to you per year (value), and the last time you had real contact, not an invoice or an automated email, but an actual exchange (last touch).

That's it. No scoring model yet. Just the raw facts, all in one place, where you can see them at once for the first time.

## Step 2: Sort by last touch, not by value

The instinct is to sort by value and focus on the big accounts. Resist it. Sort by last touch, oldest first. The clients at the top, the ones you haven't genuinely engaged with in the longest, are your real risk list, regardless of size. A high-value client you haven't spoken to in two months is more dangerous than a small one you talked to yesterday.

This sort surfaces the flowers going dry: the good, stable accounts that have drifted out of your attention precisely because they never demanded it.

## Step 3: Cross it with tenure

Now look at tenure alongside that. The combination tells you the story:

Long tenure, long since last touch. This is the most dangerous cell in the audit. A multi-year client you've stopped engaging is coasting on inertia, and inertia breaks the moment something interrupts it. These get your attention first.

Short tenure, long since last touch. A newer client already drifting is a relationship that never fully formed. They're deciding right now whether you're worth it, and silence is answering for you.

Recent touch, any tenure. These are fine for now. Don't spend the audit's energy here.

## Step 4: Pick three, and do something specific

Don't try to fix the whole risk list at once, you won't, and a vague "reconnect with everyone" produces nothing. Pick the three accounts where the combination of value and neglect is worst. For each, decide on one concrete move: a recap of a recent result, a useful flag, a real check-in with substance. Not "touch base." Something that requires a genuine response.

## Step 5: Note what you couldn't answer

As you go, you'll hit clients where you can't remember the last win, can't name their current priority, can't recall who the real decision-maker is now. Those blanks are the audit's most valuable output. A relationship you can't describe is a relationship you've stopped managing, and that's the one most easily taken from you.

Run this quarterly and the worst outcome, finding out a client is gone after they've already decided, stops happening. You catch the drift while it's still drift.

---

*The tenure audit is the manual version of what Retayned does continuously: watch every relationship's tenure, value, and engagement at once, and surface the quiet drift automatically, so you don't have to remember to look.*`,
  },
  {
    slug: "the-win-recap-template",
    tag: "TEMPLATE",
    read: "4 min read",
    kind: "guide",
    featured: false,
    title: "The Win-Recap Template",
    excerpt: "A reusable structure for reminding a client what they're getting, on purpose, before they forget. The single highest-leverage retention move there is.",
    body: `# The Win-Recap Template

The most common reason a good client leaves isn't dissatisfaction. It's forgetting. They stop being able to clearly articulate what they're getting for what they're paying, and a client who can't defend the engagement is a client someone else can talk out of it.

The win recap fixes that. It's a short, deliberate message that re-anchors the value in the client's mind, sent not when something's wrong, but on purpose, during the quiet stretches. Here's the structure.

## When to send it

Two triggers. The first is right after a concrete result, while the proof is fresh. The second is during a quiet stretch, a month or two with no natural touchpoint, when the client is most at risk of forgetting what you do. The second one is the one nobody sends and the one that matters most.

## The structure

Four short parts. Keep the whole thing under a screen.

The result, stated plainly. What actually happened, in their terms, with a number if you have one. Not "we did a lot this quarter." Instead: "Since March, the thing we set out to fix is measurably better, here's the figure." Concrete beats comprehensive.

The connection to what they care about. Tie the result to their actual goal, the one they told you mattered. The client doesn't care about your deliverables. They care about their outcome. Bridge the two explicitly so they don't have to.

The forward look. One line about what's next, so the message reads as momentum, not a victory lap. "Next, I want to build on this by X." This signals the relationship is going somewhere, not winding down.

The light open door. Not a hard ask. An invitation: "Anything you want me to prioritize from here?" It gives them a reason to respond, which tells you whether they're still engaged, and reminds them they have an attentive partner, not a vendor running on autopilot.

## Why it works

It does three things at once. It refreshes the client's memory of your value before they had a chance to forget it. It generates a response, which is a live read on how engaged they actually are. And it builds one more entry on the "worth it" side of the ledger, during the quiet months when the renewal is quietly being decided.

It is the highest-leverage retention move there is, because it's cheap, it's repeatable, and it works on exactly the clients you'd otherwise lose to silence: the good ones, coasting, who just needed a reason to remember why they stay.

## The discipline

The template is easy. The discipline is sending it when nothing is prompting you to, which is precisely when it counts. Put it on a cadence. The win recap that saves a client is the one you send in the quiet month, not the one you scramble to write when they've already gone cold.

---

*Retayned tells you which clients are due for a recap and drafts the first version in your voice, pulling the real wins and context, so the highest-leverage move you keep meaning to make actually gets made.*`,
  },
  {
    slug: "the-signal-you-keep-missing",
    tag: "DIAGNOSTICS",
    read: "4 min read",
    kind: "article",
    featured: true,
    title: "The signal you keep missing: vague positivity",
    excerpt: "\"Looks good.\" \"All good on our end.\" When engaged clients go quiet, the silence is the warning.",
    body: `# The signal you keep missing: vague positivity

"Looks good." "All good on our end." "No notes."

You read those and feel fine. The work shipped, the client didn't complain, the inbox is quiet. You move to the next fire.

Here's the problem. When a client who used to engage starts handing you frictionless approvals, that isn't satisfaction. It's distance. And distance is the first thing that happens before a client leaves.

## Approval is not the same as engagement

Early in a relationship, a good client argues with you a little. They ask why. They push on the headline, question the number, want to understand the call you made. That friction is a sign they care about the outcome and trust you enough to be honest about it.

When that friction disappears, two things could be true. Either you've earned so much trust that they've stopped checking your work, or they've stopped caring how it turns out. From the outside, those two look identical. Both produce "looks good." Only one of them renews.

The tell is the change, not the words. A client who has always been low-touch and says "looks good" is being themselves. A client who used to dig in and now waves everything through has changed, and a change you can't explain is the one worth a second look.

## Why the quiet ones are the dangerous ones

The clients who complain are giving you information. They're telling you exactly what's wrong and exactly what would fix it. A complaining client is an engaged client.

The client who goes vaguely positive has stopped giving you information. They've decided it isn't worth the energy to tell you what they actually think, which usually means they've half-decided the relationship isn't worth that energy either. By the time the silence becomes a non-renewal, the decision was made weeks ago, in a meeting you weren't in.

This is the trap inside a stable relationship. Stable is not safe. A coasting account is the single most vulnerable thing in your book, because it's the one you've stopped paying attention to, and it's the one a competitor's pitch or an internal review lands on cleanest.

## What to do when you see it

Don't accuse. "You seem distant" puts the client on defense and asks them to do the diagnostic work for you. Instead, bring them something that requires a real opinion.

Send a decision, not a status update. A choice between two genuine directions. A recommendation you're willing to defend. Something they have to actually weigh in on. If a normally-sharp client still hands it back with "whatever you think is best," you've confirmed the drift, and now you can have the real conversation: "I want to make sure you're still happy with where this is going." Curious, not needy.

The goal isn't to manufacture a problem. It's to find out whether one already exists while you can still do something about it. A client who can't tell you why they're satisfied is a client someone else can talk out of working with you. Give them the language to defend the engagement, and make sure they still want to.

---

*Retayned reads the shape of a client relationship, not just the last email. Vague positivity is exactly the kind of drift it's built to surface, before the silence hardens into a decision.*`,
  },
  {
    slug: "the-new-stakeholder-play",
    tag: "PLAYBOOK",
    read: "5 min read",
    kind: "article",
    featured: false,
    title: "How to handle the new stakeholder without burning your champion",
    excerpt: "A new boss wants to review every vendor. Your contact says don't worry. Here's the move that keeps both relationships intact.",
    body: `# How to handle the new stakeholder without burning your champion

Your main contact's new boss wants to review all the vendor relationships. Your contact says don't worry about it. Standard process, nothing personal.

Believe half of that. The "nothing personal" part is probably true. The "don't worry" part is the most expensive advice you'll get all quarter.

## What actually just happened

A new decision-maker reviewing vendors is someone asking a simple question about every line item: is this worth it? They have no history with you. None of the goodwill you've built over months, none of the wins, none of the trust. To them you are a cost with a logo.

Your champion has all of that context. The new stakeholder has none of it. And the new stakeholder is the one holding the pen.

This is the single point of failure that every long relationship eventually hits. Your champion is your most valuable asset, and the moment a new person sits above them, your champion becomes a liability you've been ignoring: if your entire relationship lives inside one person's head, you are one org-chart change away from starting over.

## The move that protects both relationships

The instinct is to go around your champion, introduce yourself to the new boss, and make your own case. That burns the champion. They told you not to worry, and you went over their head at the first sign of pressure. Now you've signaled you don't trust them, in front of the exact person whose opinion of them matters most.

The opposite instinct, doing nothing because your champion said so, leaves your fate entirely in the hands of someone who can't see your value.

The move is to do both relationships at once, in the right order.

First, arm your champion. Give them the wins, the numbers, the language. Not a brag sheet, an internal-defense kit: the three things you've done this quarter that they can say out loud in a review without sounding like your publicist. Most champions want to defend you and simply don't have the words ready. Hand them the words.

Then, ask, don't act: "Would it make sense for me to introduce myself to [new stakeholder] directly, or would you rather walk them through our work yourself?" You've offered. You've made it their call. If they say yes, you get the introduction with your champion's blessing. If they say no, you've shown respect and reinforced that you're a team, which is its own argument for keeping you.

## The 48-hour version

If the change is bigger than a new boss, an acquisition, a restructure, a reorg that scrambles the whole reporting line, compress the timeline. Reach out within 48 hours, to your existing contact, with one question: "What does this mean for our work together?"

You're not pitching. You're being the stable, calm constant while everyone around them is anxious about their own job. In a period of organizational chaos, the vendor who is unbothered and useful is the one that survives the cuts. The vendor who goes quiet and hopes is the one nobody fights for.

## The thing to never do

Never badmouth the old way of doing things, the old org chart, or the people who left. The new stakeholder doesn't know yet whose side anyone is on, and the consultant who throws shade in week one reads as a political risk. Be the person who makes the transition easier, and you'll still be here when it's over.

---

*Retayned tracks who else at a client knows your name, so a new face in the reporting line is a prompt to act, not a surprise you find out about at renewal.*`,
  },
  {
    slug: "score-a-client-relationship",
    tag: "FRAMEWORK",
    read: "8 min read",
    kind: "article",
    featured: false,
    title: "Twelve dimensions, twenty combinations: how to actually score a client relationship",
    excerpt: "Most retention scoring is a wrapped-up NPS. Here's a framework that captures how clients actually behave before they leave.",
    body: `# Twelve dimensions, twenty combinations: how to actually score a client relationship

Most retention scoring is a satisfaction survey wearing a lab coat. You ask the client how things are going, they say fine because saying anything else is awkward, you log a number, and the number tells you nothing you didn't already fear.

The problem isn't the math. It's the input. You're asking the wrong person. The client is the last to admit a relationship is cooling, often because they haven't admitted it to themselves yet. The person who actually knows is you. You just haven't had a structured way to write down what you already sense.

That's what a real relationship score is for. Not to grade the client. To force you to be honest about what you're seeing.

## Why a single number lies

A relationship is a shape, not a score. Two clients can both sit at the same overall health and be in completely different situations.

One trusts you completely but is quietly shopping competitors. The other is loyal as a dog but micromanages every deliverable because they don't trust you to make a call. Same number. Opposite problems. Opposite moves. If your scoring collapses both into "68, watch closely," it has told you nothing about what to actually do on Tuesday morning.

So you score the dimensions underneath the number, and you read them together.

## The twelve dimensions

Think of them in two groups: the ones that decide whether the relationship survives, and the ones that tell you how to handle it.

The heavy ones, the dimensions that carry the most weight because they predict churn most directly:

- **Trust.** Do they trust you to do your job? When trust is low, you get micromanagement, second-guessing, approval bottlenecks. High trust is delegation.
- **Loyalty.** Are they looking at other options? Low loyalty is a client actively comparing you to alternatives, even if they're perfectly pleasant about it.
- **Expectations.** Are their expectations realistic? Misaligned expectations are a ticking clock; every week you don't address the gap, it widens.
- **Grace.** When something goes wrong, how do they react? Zero-tolerance clients turn one bad week into a relationship crisis. Clients with grace give you room to recover.

If you only score four things, score those four.

The supporting ones add texture, and several of them are U-shaped, meaning both extremes are the risk, not just the low end:

- **Budget Commitment.** Will money be the reason they leave?
- **Relationship Depth.** Is there a real relationship beyond the work? Moderate is healthiest; zero is fragile, but total enmeshment is its own kind of unstable.
- **Replaceability.** How embedded are you? More embedded is safer.
- **Communication Tone.** Warm and direct, or cold and clipped?
- **Decision-Making Authority.** Can your contact actually say yes, or are they a relay to someone who can?
- **Communication Frequency.** Here's the U-shape: radio silence is a risk, and so is constant frantic contact. The healthy zone is a rhythm.
- **Stress Response.** Another U-shape. The client who goes silent under pressure and the client who escalates loudly both create risk, in opposite directions.
- **Reporting Need.** "Don't bother me" and "send me everything" are both harder to sustain than a steady middle.

## Read the combinations, not the columns

The insight isn't in any single dimension. It's in the two or three lowest ones, read together.

Low Trust plus low Grace is a different animal than low Loyalty plus high Trust. The first is a client who doesn't trust you and won't forgive a mistake, which means you operate with no margin for error and should be over-communicating every step. The second is a client who likes your work fine but isn't committed, which means the move is to deepen the relationship and make leaving feel like a loss, not to tighten your process.

There are roughly twenty of these combinations worth naming, and once you start looking for them, you stop being surprised by departures. The "looks good" client whose tone has cooled and whose engagement has dropped isn't a mystery. It's a pattern with a name, and a play.

## Always read against baseline

The last rule, and the one people skip: a score only means something compared to where it was.

A client steady at 70 for six months is stable. A client at 70 who was at 85 a quarter ago is in freefall, and 70 is just the number you happened to catch on the way down. The absolute value is almost meaningless. The delta is everything.

This is why scoring once and filing it away is worthless. The relationship moves. Your read has to move with it, which is the entire reason to keep the profile current instead of treating it like a form you filled out at onboarding.

## What the score is actually for

It is not a verdict. Low Loyalty doesn't doom a relationship, and high Trust doesn't make one safe. The profile tells you where to look and how to communicate. It does not tell you who's leaving.

What it does is end the guessing. Instead of a vague unease about an account, you have a specific read: here's the dimension that slipped, here's what that pattern usually means, here's the conversation to have this week. The number gets you to look. The shape tells you what to do.

---

*Retayned scores all twelve dimensions for every client and reads the combinations automatically, so the pattern surfaces before you'd have noticed it on your own. How those dimensions combine into a single Retention Score is the engine; what you do with it is the job.*`,
  },
  {
    slug: "the-cancelled-meeting-math",
    tag: "DIAGNOSTICS",
    read: "3 min read",
    kind: "article",
    featured: false,
    title: "The cancelled-meeting math",
    excerpt: "A meeting moved once is a calendar problem. Twice is a relationship problem. Three times is a renewal problem.",
    body: `# The cancelled-meeting math

A meeting moved once is a calendar problem.

Twice is a relationship problem.

Three times is a renewal problem.

That's the whole framework. The rest of this is why it's true and what to do at each stage.

## Once: take it at face value

People are busy. Calendars collide. A single reschedule, with a real reason and a quick rebooking, is noise. If you read churn risk into every shifted call, you'll exhaust yourself and annoy clients who are perfectly happy.

So the first time, you do nothing except rebook cleanly and move on. Reading too much into a one-off is its own kind of mistake. Don't overengineer a response to a non-trend.

## Twice: the pattern starts

The second cancellation is where attention is warranted, not alarm. One reschedule is an event. Two is the beginning of a pattern, and patterns are the only thing worth acting on.

What's happening underneath is a quiet reordering of priorities. Your meeting used to be protected time. Now it's the thing that gets moved when something else comes up. That shift, from protected to optional, is the client telling you where you currently sit in their week, whether they mean to or not.

The move here is light. Not a confrontation, a recalibration. When you rebook the second one, make the next touch worth protecting: bring a decision they need to make, a result they'll want to hear, a reason the time matters. You're testing whether the deprioritization is about you or about a genuinely chaotic month on their end. Both happen. You want to know which.

## Three times: the window is closing

By the third cancellation, the meeting has effectively stopped existing. And a relationship with no live contact is running on memory, which means it's running on borrowed time.

This is no longer a scheduling issue to solve over email. Three cancellations is the client showing you, through behavior rather than words, that the engagement has drifted to the bottom of their list. The renewal conversation, whenever it comes, is going to start from that drifted position unless you change it now.

The move is to stop chasing the recurring meeting and have the direct one. Not "can we finally find a time," which keeps you in the weak position of the thing that's easy to cancel. Instead: "I want to make sure this is still delivering what you need. Can we take fifteen minutes to talk about where it goes from here?" You're naming the drift without accusing, and you're reframing the call as a decision about the future rather than another status update they can skip.

## Why this matters more than it looks

Cancelled meetings feel administrative. They're not. They're one of the cleanest behavioral signals you get, because behavior doesn't lie the way "looks good" does. A client can tell you everything's fine while their calendar quietly says otherwise.

The trap is that each individual cancellation has a perfectly reasonable explanation, so you accept each one in isolation and never see the line they're drawing. The math exists so you stop evaluating cancellations one at a time and start counting them. One, two, three. The number tells you which conversation to have.

---

*Retayned counts the pattern for you, so a third reschedule shows up as a flag instead of slipping past as one more reasonable excuse.*`,
  },
  {
    slug: "i-noticed-something",
    tag: "PLAYBOOK",
    read: "6 min read",
    kind: "article",
    featured: false,
    title: "Saying \"I noticed something\" without sounding paranoid",
    excerpt: "The exact opening structure for surfacing a concern before it hardens into a reason to leave.",
    body: `# Saying "I noticed something" without sounding paranoid

There's a specific fear that keeps consultants from surfacing concerns early: that naming a problem creates one. That if you say "I've noticed things feel a little different lately," the client will think *I hadn't noticed, but now that you mention it...* and you'll have talked yourself out of a renewal.

So you wait. You tell yourself you're being patient, reading the room, not being needy. And the concern you could have addressed in a two-minute conversation hardens into a reason to leave that you never saw coming.

Hard conversations are only hard because they were postponed. The opener below is how you have them early, when they're still easy.

## Why "I noticed something" works when "is everything okay?" doesn't

"Is everything okay?" is a trap. It's vague, it asks the client to do the diagnostic work, and it invites the reflexive "yeah, all good" that ends the conversation without surfacing anything. You've signaled anxiety and gotten nothing back.

"I noticed something specific" does the opposite. It's grounded in an observation, which makes it feel like attentiveness rather than insecurity. And it gives the client something concrete to respond to instead of a mood to reassure.

The structure is: a specific, neutral observation, then a genuine question, then silence.

- **Observation, not accusation.** "I noticed the last couple of approvals came back faster than usual" is a fact. "You seem checked out" is a charge. The first invites an answer; the second invites a defense.
- **A real question.** "I want to make sure we're still aimed at the right thing. Has anything shifted on your end I should know about?" You're not asking them to manage your feelings. You're asking for information that makes your work better.
- **Then stop talking.** The instinct is to fill the silence by softening it, walking it back, adding "but no worries if not." Don't. The pause is where the real answer lives.

## Anchor it to something you actually saw

The difference between attentive and paranoid is evidence. A concern grounded in a specific, observable change reads as a professional paying attention. A concern grounded in a vibe reads as someone fishing for reassurance.

Good anchors are behavioral and concrete: a change in response time, a meeting that moved twice, a new name on the thread, scope that quietly shrank, a tone that cooled. You're not interpreting their inner life. You're pointing at a thing that happened and asking what it means.

This is also why you don't lead with the feeling. "Something feels off" is your anxiety talking. "Your team's been looping in [new name] on the last few threads, and I want to make sure I'm supporting that right" is an observation they can actually engage with. Lead with the fact. The feeling stays yours.

## Match the delivery to the client

The same concern lands differently depending on who's receiving it.

- A **data-driven client** wants the numbers. Bring the metric that changed, not the worry about it.
- A **relationship-first client** needs the personal framing. "I value working with you and want to keep it strong" is the right doorway.
- A **client who spirals under stress** needs the headline first and the reassurance attached, so a careful question doesn't read as a crisis: "Small thing, easily handled, I just want to flag it."

Reading which one you're talking to is the entire skill. The observation is the same. The packaging is everything.

## The cost of not saying it

Here's the part that should change the calculus. Bad news delivered well builds more trust than good news delivered generically. When you surface a small concern early and handle it cleanly, you've shown the client that you watch the relationship, you're honest about it, and you'll tell them the truth before it's a problem. That is exactly the reputation that survives a budget review.

The consultant who never raises anything until renewal looks, in hindsight, like someone who either wasn't paying attention or wasn't being straight. Neither is who you want to be when the contract's on the table.

Name the uncomfortable thing while it's still small. It almost never costs you the relationship. Letting it grow in silence is what does.

---

*Retayned surfaces the specific change worth naming, the cooled tone, the shrinking scope, the new stakeholder, so the conversation you have is grounded in something real, not a hunch you're second-guessing.*`,
  },
  {
    slug: "quiet-client-script-pack",
    tag: "GUIDE",
    read: "Guide",
    kind: "guide",
    featured: false,
    title: "The Quiet-Client Script Pack",
    excerpt: "Ten openers for the awkward check-in, built on observation, question, silence.",
    body: `# The Quiet-Client Script Pack
### Ten openers for the check-in you keep putting off

A client has gone quiet. Not angry, not complaining, just... less. Slower replies, frictionless approvals, a meeting that moved twice. You want to say something, but every draft sounds either needy ("just checking in!!") or accusatory ("you seem distant"), so you say nothing and the quiet gets louder.

These ten openers solve that. Each one is built on the same structure: a specific, neutral observation, a genuine question, then silence. Anchor to something real. Lead with the fact, not the feeling. Then stop talking and let them answer.

Use them as starting points, not copy-paste. Reshape each into your own voice and the channel you actually use with that client.

---

## 1. The faster-approvals tell
*When a normally-engaged client starts waving everything through.*

> Quick one. The last few approvals came back fast, which is great, and I also want to make sure I'm not moving past anything you'd actually want to weigh in on. Anything you'd want me to slow down and walk through?

Why it works: names the behavior change without judgment, and reframes "you've gone quiet" as "I want to serve you better."

---

## 2. The honest happiness check
*When everything looks fine but your gut says otherwise.*

> I want to make sure you're genuinely happy with where things are, not just fine with them. If there's something you'd change about how we work together, I'd rather hear it now than guess.

Why it works: "happy, not just fine" gives them permission to say the small thing they've been sitting on. Curious, not needy.

---

## 3. The decision, not the update
*When you want to test engagement without asking about it directly.*

> I'm at a fork on [specific thing] and I'd rather have your read than make the call myself. Option A gets us [outcome]. Option B gets us [outcome]. Which feels right to you?

Why it works: you're not asking "are we okay," you're handing them a real decision. A disengaged client hands it back with "whatever you think." That answer is your answer.

---

## 4. The new name on the thread
*When someone you don't know starts getting cc'd.*

> I noticed [name] has been on the last couple of threads, and I want to make sure I'm supporting that well. Is there context on their involvement that would help me show up right?

Why it works: treats a new stakeholder as a chance to serve, not a threat to defend against. Surfaces the org change before it surfaces you.

---

## 5. The twice-moved meeting
*When the recurring call keeps sliding.*

> Our check-in has moved a couple of times, which usually just means it's a busy stretch. Before we rebook, is the current rhythm still useful to you, or would a different cadence fit your month better?

Why it works: names the pattern lightly, hands them control of the cadence, and tests whether the deprioritization is about you or about a chaotic month.

---

## 6. The value narration
*When you're delivering but they may not see it.*

> Wanted to connect the dots on the last stretch: here's what we did, and here's what it produced for you. If your team ever needs this in a format that's easy to forward upward, say the word and I'll put it together.

Why it works: a client who can't articulate why they keep you is a client someone can talk out of keeping you. This hands them the language to defend the engagement internally.

---

## 7. The pre-renewal soft open
*When the contract end is inside 60 days and no one's mentioned it.*

> Before we get close to the wire on the agreement, I've been thinking about what the next phase could look like. Mind if I share a rough sketch and get your gut reaction? No pressure, I just plan better with your input.

Why it works: a client invested in the future renews; a client reviewing the past is evaluating. This points them at the future, early and informally.

---

## 8. The post-dip repair
*When results slipped and the client went distant.*

> Results came in softer than we both wanted last cycle, and I don't want to let that sit behind a dashboard. Can we grab fifteen minutes? I want to walk you through what happened, what I'm changing, and hear anything that's on your mind.

Why it works: a report doesn't repair broken trust; a direct conversation within 48 hours does. Leads with the fact, owns the next move, invites their side.

---

## 9. The comprehensive-summary request
*When they suddenly ask for a big performance recap.*

> Happy to pull that together, I'll have it to you by [day]. While I'm at it, is there a particular question behind it I should make sure to answer? Sometimes these come up because someone upstairs is asking, and I'd rather speak directly to that.

Why it works: a sudden "send me everything" usually means someone above is asking "is this worth it." You deliver, then gently find out what prompted it.

---

## 10. The autopilot interrupt
*When nothing's wrong, which is exactly the risk.*

> No fire here, just didn't want a quiet stretch to turn into a coasting one. I pulled a couple of ideas for where we could push next. Want me to send them over, or save them for our next sync?

Why it works: stable is not safe. A proactive touch precisely because nothing has happened lately is how you keep a coasting account from drifting toward a competitor's pitch.

---

## The rules underneath all ten

- **Observation, not accusation.** "I noticed the approvals sped up" invites an answer. "You seem checked out" invites a defense.
- **Lead with the fact, keep the feeling.** Your anxiety stays yours. Point at the thing that actually happened.
- **Then stop.** The pause after the question is where the real answer lives. Don't soften it away.
- **Match the person.** Data clients want the number. Relationship clients want the personal framing. Stress-reactive clients want the headline first so a careful question doesn't read as a crisis.

---

*Retayned tells you which client has gone quiet and why, and Rai will reshape any of these into your voice and your channel before you hit send.*`,
  },
  {
    slug: "renewal-pre-mortem",
    tag: "TEMPLATE",
    read: "Template",
    kind: "guide",
    featured: false,
    title: "The Renewal Pre-Mortem",
    excerpt: "A 60-day playbook for at-risk accounts, with a copy-paste worksheet.",
    body: `# The Renewal Pre-Mortem
### A 60-day playbook for the accounts you can't afford to lose

A pre-mortem flips the usual question. Instead of waiting for the non-renewal and asking "what went wrong," you stand at 60 days out and ask: *if this client doesn't renew, what will the reason have been?* Then you go fix that reason while there's still time.

The renewal conversation doesn't start at the deadline. It starts 60 days out, informally, and the work below is what fills those 60 days. Run it on every account where losing them would change your quarter.

---

## Step 1 — Write the obituary (Day 60)

Imagine the client has left. Write the one-sentence reason. Be honest, not generous to yourself.

Common true reasons, roughly in order of how often they're the real one:
- The relationship went quiet and a competitor or internal review filled the silence.
- A new decision-maker who has no history with you reviewed the spend.
- Results dipped and trust never got repaired with a direct conversation.
- Their budget got squeezed for reasons that have nothing to do with you.
- They could never quite articulate the value, so someone talked them out of it.

Pick the most likely one. That's your pre-mortem. The rest of the playbook is aimed at it.

---

## Step 2 — Pull the real read (Day 60 to 55)

Before you act, get honest about where the relationship actually stands.

- **Score the relationship against baseline.** Not "are they happy," but "where is each dimension *heading*." A 70 that used to be an 85 is the story.
- **Identify the lowest two or three dimensions** and read them together. That combination tells you which conversation to have.
- **Map the org.** Who is your champion? Who else there knows your name? If the answer is "only my one contact," that's a single point of failure to fix this month.
- **Check the behavioral signals,** not just the sentiment: response times, meeting reschedules, scope trajectory, approval friction. Behavior doesn't lie the way "looks good" does.

---

## Step 3 — Run the plays that match the reason (Day 55 to 20)

Aim your effort at the obituary you wrote. Don't do everything; do the thing that addresses the actual risk.

**If the risk is silence / autopilot:** Re-engage with substance, not a status update. Bring a decision, a result, an idea for what's next. A proactive touch precisely because nothing has happened lately is the whole move.

**If the risk is a new decision-maker:** Arm your champion with wins, numbers, and language they can use in a review. Then offer, don't act: "Would it help if I introduced myself to [name], or would you rather walk them through our work?" Their call.

**If the risk is broken trust after a dip:** Have the direct conversation within 48 hours of recognizing it. Lead with the fact, own what you're changing, then listen. A dashboard does not repair trust. A conversation does.

**If the risk is budget pressure:** Don't preemptively cut your rate or signal you're expendable. Find the highest-value smaller engagement that keeps you in the account. Staying in beats short-term revenue.

**If the risk is unspoken value:** Narrate what you've done and what it produced, in a format your champion can forward upward. Give them the language to defend you when you're not in the room.

---

## Step 4 — Open the renewal, informally (Day 30 to 20)

Don't wait for the formal conversation. Open it as a future-tense, low-pressure sketch:

> Here's what I'm thinking for the next phase. How are you feeling about how things have been going?

A client invested in the future renews. A client reviewing the past is evaluating. Your job in this window is to get them thinking forward.

---

## Step 5 — The capacity honesty check (ongoing)

If several accounts are hitting this list at once, the problem usually isn't the clients. It's capacity. Spreading attention equally across all of them saves none of them.

Be honest about which relationships deserve your full attention and which need transitioning, pausing, or referring out. Never jeopardize your winners to rescue a relationship that was always going to close. Some chapters are supposed to end, and protecting a thriving account is often a better use of the hour than rescuing a dying one.

---

## The one-page worksheet

Copy this per at-risk account:

\`\`\`
CLIENT: ________________     RENEWAL DATE: __________  (days out: ____)

THE OBITUARY (most likely reason they leave):
__________________________________________________________

RELATIONSHIP READ:
  Overall direction (improving / stable / shifted / declining): ______
  Lowest dimensions: ____________  +  ____________
  Champion: ____________   Others who know me: ____________
  Behavioral flags (reschedules, slow replies, scope, approvals):
  __________________________________________________________

THE MATCHED PLAY (from Step 3): ________________________________

INFORMAL RENEWAL OPENED?  Y / N    Date: __________

VERDICT: fight for it / transition gracefully / let it close
\`\`\`

---

*Retayned runs a version of this read continuously, flagging the at-risk accounts and the reason before you'd have built the spreadsheet yourself. The pre-mortem is the manual version; the point of both is the same: never be surprised by a non-renewal.*`,
  },
  {
    slug: "health-check-question-bank",
    tag: "GUIDE",
    read: "Guide",
    kind: "guide",
    featured: false,
    title: "The Health Check Question Bank",
    excerpt: "The questions worth asking yourself about every client, organized by dimension.",
    body: `# The Health Check Question Bank
### The questions that surface drift before the client does

A health check works because of who it asks. Not the client, who is the last to admit a relationship is cooling, but you, who already senses it and just hasn't written it down. The questions below are organized by the twelve dimensions. You won't answer all of them every time; you answer the ones that fit the moment.

Two rules before you start:
- **Answer against baseline.** The question isn't "is this good," it's "is this different from how it used to be."
- **An honest "I don't know" is data.** If you can't answer a question about a client, that gap is itself a signal worth noticing.

---

## Trust — *do they trust you to do your job?*
- Are approvals getting faster because they trust me, or because they've stopped engaging?
- Am I being asked to justify decisions I wasn't asked to justify three months ago?
- When I make a judgment call, do they back it or relitigate it?
- Has anything happened recently that would have dented their trust, even if neither of us named it?

## Loyalty — *are they looking at other options?*
- Have they mentioned a competitor, a price they saw elsewhere, or "exploring options"?
- If a cheaper alternative pitched them tomorrow, would they take the call?
- Do they talk about our work as a long-term thing, or one cycle at a time?
- Are they comparing me to a previous provider in a way that suggests they haven't fully committed?

## Expectations — *are their expectations realistic?*
- Is there a gap between what they expect and what this engagement can actually produce?
- Did I make a promise early on that's quietly becoming a liability?
- Have we explicitly aligned on what success looks like, or are we each assuming?
- Is any unrealistic expectation widening week over week without being addressed?

## Grace — *how do they react when something goes wrong?*
- The last time something slipped, did they give benefit of the doubt or treat it as a referendum?
- Am I operating with margin for error, or does every detail have to be perfect?
- Do they judge me on the recovery, or on the stumble?

## Budget Commitment — *will money be the reason they leave?*
- Is there budget pressure on their side, even if it has nothing to do with my work?
- Have invoices, scope, or spend conversations changed tone recently?
- If their budget got cut 20%, would my line item survive the conversation?

## Relationship Depth — *is there a real relationship beyond the work?*
- Is there a genuine connection here, or is it purely transactional?
- Has the personal warmth changed in either direction recently?
- Am I relying on one human bond that could vanish if that person left?

## Replaceability — *how embedded am I?*
- How hard would it actually be for them to replace me?
- Is my work woven into how they operate, or is it a discrete deliverable anyone could pick up?
- Have I become more essential over the last six months, or less?

## Communication Tone — *warm and direct, or cold and clipped?*
- Has the tone of their messages cooled, even slightly?
- Are replies shorter, later, or more formal than they used to be?
- Is there warmth that's gone missing without an obvious reason?

## Decision-Making Authority — *can my contact actually say yes?*
- Does my main contact have the authority to keep me, or are they a relay?
- Has decision-making quietly moved to someone I don't have a relationship with?
- Do I know who, besides my contact, could decide my fate here?

## Communication Frequency — *the rhythm (U-shaped: both extremes are risk)*
- Has our contact gone from a steady rhythm to radio silence, where I always initiate?
- Or has it spiked into constant, anxious back-and-forth?
- Does the current frequency match what this client actually wants, or what's convenient for me?

## Stress Response — *how do I find out when something's wrong? (U-shaped)*
- When something goes wrong on their end, do they tell me, or go quiet and handle it internally?
- Do they escalate loudly in a way that destabilizes the work?
- Am I finding out about problems too late because they don't surface them?

## Reporting Need — *how much do they want to hear from me? (U-shaped)*
- Is the current reporting cadence sustainable, or is it drifting toward "don't bother me" or "send me everything"?
- Have they asked for more detail recently, and if so, why now?
- Could a sudden request for a comprehensive summary mean someone above them is asking "is this worth it?"

---

## Cross-cutting questions worth asking every time
- What's my honest gut feeling about this relationship right now, and what evidence would confirm or kill it?
- What's changed since the last check, in either direction?
- If this client left in 90 days, what would the reason most likely be?
- Where would the next hour of my attention produce the most relationship value, here or somewhere else in my book?

---

## How to run it
1. **Cadence by health, not calendar.** Monthly for critical accounts, quarterly for stable ones, yearly for thriving. Don't get pinged on a schedule that makes you rush through to clear the queue.
2. **Answer honestly, including the blanks.** The questions you can't answer are telling you where you've stopped paying attention.
3. **Read the lowest dimensions together.** The combination is the diagnosis.
4. **Update the profile.** A health check only sharpens your reads if the answers actually go back into the system.

---

*Retayned chooses the right questions for each client based on what's already shifting, so a check-in stays short and pointed instead of becoming a 47-question form you fill out to get it off your plate.*`,
  },
];
// ── Lightweight markdown renderer (no dependencies) ──
// Handles: # ## ### headings, **bold**, *italic*, `code`, > blockquote,
// - bullet lists, 1. ordered lists, ``` fenced code, --- hr, and paragraphs.
function renderMarkdown(md) {
  const lines = md.split("\n");
  const blocks = [];
  let i = 0;
  const inline = (text) => {
    // escape nothing (trusted authored content); apply inline md
    const parts = [];
    let key = 0;
    // process **bold**, *italic*, `code`
    const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
    let last = 0, m;
    while ((m = regex.exec(text)) !== null) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      if (m[2] !== undefined) parts.push(<strong key={key++}>{m[2]}</strong>);
      else if (m[3] !== undefined) parts.push(<em key={key++}>{m[3]}</em>);
      else if (m[4] !== undefined) parts.push(<code key={key++} className="md-code">{m[4]}</code>);
      last = m.index + m[0].length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts;
  };

  while (i < lines.length) {
    let line = lines[i];

    if (line.trim() === "") { i++; continue; }

    // fenced code
    if (line.trim().startsWith("```")) {
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) { buf.push(lines[i]); i++; }
      i++;
      blocks.push(<pre key={blocks.length} className="md-pre"><code>{buf.join("\n")}</code></pre>);
      continue;
    }
    // hr
    if (line.trim() === "---") { blocks.push(<hr key={blocks.length} className="md-hr" />); i++; continue; }
    // headings
    if (line.startsWith("### ")) { blocks.push(<h3 key={blocks.length} className="md-h3">{inline(line.slice(4))}</h3>); i++; continue; }
    if (line.startsWith("## ")) { blocks.push(<h2 key={blocks.length} className="md-h2">{inline(line.slice(3))}</h2>); i++; continue; }
    if (line.startsWith("# ")) { blocks.push(<h1 key={blocks.length} className="md-h1">{inline(line.slice(2))}</h1>); i++; continue; }
    // blockquote (may span multiple lines)
    if (line.startsWith(">")) {
      const buf = [];
      while (i < lines.length && lines[i].startsWith(">")) { buf.push(lines[i].replace(/^>\s?/, "")); i++; }
      blocks.push(<blockquote key={blocks.length} className="md-quote">{inline(buf.join(" "))}</blockquote>);
      continue;
    }
    // unordered list
    if (/^[-*]\s/.test(line.trim())) {
      const items = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^[-*]\s/, "")); i++; }
      blocks.push(<ul key={blocks.length} className="md-ul">{items.map((it, k) => <li key={k}>{inline(it)}</li>)}</ul>);
      continue;
    }
    // ordered list
    if (/^\d+\.\s/.test(line.trim())) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^\d+\.\s/, "")); i++; }
      blocks.push(<ol key={blocks.length} className="md-ol">{items.map((it, k) => <li key={k}>{inline(it)}</li>)}</ol>);
      continue;
    }
    // paragraph (gather until blank)
    const buf = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,3}\s|>|[-*]\s|\d+\.\s|```|---)/.test(lines[i].trim())) { buf.push(lines[i]); i++; }
    blocks.push(<p key={blocks.length} className="md-p">{inline(buf.join(" "))}</p>);
  }
  return blocks;
}

const RESOURCES_BY_SLUG = Object.fromEntries(RESOURCES_CONTENT.map(r => [r.slug, r]));

function BlogPost({ slug, setPage }) {
  const post = RESOURCES_BY_SLUG[slug] || RESOURCES_CONTENT[0];
  const related = RESOURCES_CONTENT.filter(r => r.slug !== post.slug && r.kind === post.kind).slice(0, 3);
  const relatedPool = related.length ? related : RESOURCES_CONTENT.filter(r => r.slug !== post.slug).slice(0, 3);
  return (
    <div>
      <RetPageStyles />
      <style>{`
        .md-article { max-width: 720px; margin: 0 auto; }
        .md-h1 { font-size: clamp(30px, 5vw, 44px); font-weight: 900; letter-spacing: -0.03em; line-height: 1.12; color: ${C.text}; margin: 0 0 8px; }
        .md-h2 { font-size: clamp(22px, 3vw, 28px); font-weight: 800; letter-spacing: -0.02em; color: ${C.text}; margin: 40px 0 14px; }
        .md-h3 { font-size: 19px; font-weight: 800; color: ${C.text}; margin: 28px 0 10px; }
        .md-p { font-size: 17px; line-height: 1.75; color: ${C.textSec}; margin: 0 0 20px; }
        .md-p strong, .md-ul strong, .md-ol strong, .md-quote strong { color: ${C.text}; font-weight: 800; }
        .md-ul, .md-ol { margin: 0 0 20px; padding-left: 24px; }
        .md-ul li, .md-ol li { font-size: 17px; line-height: 1.7; color: ${C.textSec}; margin-bottom: 10px; }
        .md-ul { list-style: none; padding-left: 4px; }
        .md-ul li { position: relative; padding-left: 22px; }
        .md-ul li::before { content: ""; position: absolute; left: 2px; top: 12px; width: 6px; height: 6px; border-radius: 50%; background: ${C.primaryLight}; }
        .md-quote { border-left: 3px solid ${C.btn}; background: ${C.primaryGhost}; padding: 16px 22px; margin: 0 0 22px; border-radius: 0 12px 12px 0; font-size: 17px; line-height: 1.7; color: ${C.text}; font-style: italic; }
        .md-code { font-family: 'Courier New', monospace; font-size: 0.88em; background: ${C.surfaceWarm}; padding: 2px 6px; border-radius: 5px; color: ${C.primaryDeep}; }
        .md-pre { background: ${C.sidebar}; color: #E8ECE6; padding: 20px 22px; border-radius: 12px; overflow-x: auto; margin: 0 0 22px; font-size: 13.5px; line-height: 1.6; }
        .md-pre code { font-family: 'Courier New', monospace; white-space: pre; }
        .md-hr { border: none; border-top: 1px solid ${C.borderLight}; margin: 36px 0; }
      `}</style>

      {/* Article hero */}
      <section className="ret-section r-full-bleed" style={{ background: "#F2EEE8", paddingBottom: 28 }}>
        <div className="ret-section-inner">
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <span onClick={() => setPage("blog")} style={{ fontSize: 13, fontWeight: 700, color: C.btn, cursor: "pointer", display: "inline-block", marginBottom: 20 }}>← All resources</span>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <MiniTag color={post.kind === "guide" ? "warning" : "primary"}>{post.tag}</MiniTag>
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>{post.read} · Adam Lawrence</div>
          </div>
        </div>
      </section>

      <RetCurve from="#F2EEE8" to={C.bg} variant="rightCrest" />

      {/* Body */}
      <section className="ret-section r-full-bleed" style={{ background: C.bg }}>
        <div className="ret-section-inner">
          <article className="md-article">
            {renderMarkdown(post.body)}
          </article>
        </div>
      </section>

      <RetCurve from={C.bg} to="#F2EEE8" variant="default" />

      {/* Related */}
      <section className="ret-section ret-bg-cream r-full-bleed">
        <div className="ret-section-inner">
          <div className="ret-section-head">
            <div className="ret-eyebrow">Keep reading</div>
            <h2 className="ret-h2">More from the library.</h2>
          </div>
          <div className="ret-grid-3">
            {relatedPool.map(r => (
              <div key={r.slug} className="ret-card ret-card-hover" style={{ cursor: "pointer" }} onClick={() => setPage("post:" + r.slug)}>
                <MiniTag color={r.kind === "guide" ? "warning" : "primary"}>{r.tag}</MiniTag>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: "12px 0 8px", lineHeight: 1.3, letterSpacing: "-0.015em" }}>{r.title}</h3>
                <p style={{ fontSize: 14, color: C.textSec, lineHeight: 1.6, margin: 0 }}>{r.excerpt}</p>
                <div style={{ marginTop: 14, fontSize: 13, fontWeight: 700, color: C.btn }}>Read →</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <RetFinalCTA
        h2="Stop guessing which client is about to go quiet."
        sub="Start free. Retayned reads the relationship so you can act before it drifts."
        setPage={setPage}
      />
      <Footer setPage={setPage} />
    </div>
  );
}


const RESOURCES_TOOLS = [
  { kind: "ASSESSMENT", dur: "60 sec", title: "Retention Health Check", sub: "Think of one client. Answer five questions honestly. Get a retention score and know what to do next." },
  { kind: "CALCULATOR", dur: "30 sec", title: "The Retention Calculator", sub: "See what client churn is actually costing you. The number is always bigger than you think." },
  { kind: "ASSESSMENT", dur: "2 min", title: "Grade Your Client Relationship", sub: "Score one client across 12 relationship dimensions. See where the cracks are." },
  { kind: "SIMULATOR", dur: "4 min", title: "The Hard Conversation Simulator", sub: "Five scenarios. Three approaches each. See how your instincts play out." },
];

const RESOURCES_WEBINARS = [
  { date: "TBD", dur: "60 min", title: "Office hours: bring one client, leave with a plan.", sub: "Live, with five operators per session.", kind: "Coming soon" },
];

function MiniTag({ color = "primary", children }) {
  const map = {
    primary: { bg: C.primarySoft, fg: C.primary },
    btn: { bg: "#EFE9FB", fg: C.btn },
    warning: { bg: "#F4E5C2", fg: "#8B6A1B" },
    danger: { bg: "#F2D6CE", fg: "#8E2A18" },
  };
  const c = map[color] || map.primary;
  return (
    <span style={{ display: "inline-block", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 800, padding: "4px 10px", borderRadius: 999, background: c.bg, color: c.fg }}>{children}</span>
  );
}

function Blog({ setPage }) {
  const [filter, setFilter] = useState("All");
  const filters = ["All", "Articles", "Tools", "Guides", "Webinars"];
  const articles = RESOURCES_CONTENT.filter(r => r.kind === "article");
  const guidePosts = RESOURCES_CONTENT.filter(r => r.kind === "guide");
  const featured = articles[0];
  const sideFeatured = articles.slice(1, 3);
  const restArticles = articles.slice(3);

  // ── Interactive tools (ported) ──
  const [activeModule, setActiveModule] = useState(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [sliderVals, setSliderVals] = useState({});

  const reset = () => { setActiveModule(null); setStep(0); setAnswers({}); setSliderVals({}); };

  useEffect(() => { if (activeModule) window.scrollTo(0, 0); }, [step, activeModule]);

  const modules = [
    { id: "health", title: "Retention Health Check", desc: "Think of one client. Answer five questions honestly. Get a retention score and know what to do next.", time: "60 sec", tag: "Assessment" },
    { id: "calculator", title: "The Retention Calculator", desc: "See what client churn is actually costing you. The number is always bigger than you think.", time: "30 sec", tag: "Calculator" },
    { id: "profile", title: "Grade Your Client Relationship", desc: "Score one client across 12 relationship dimensions. See where the cracks are.", time: "2 min", tag: "Assessment" },
    { id: "simulator", title: "The Hard Conversation Simulator", desc: "Five scenarios. Three approaches each. See how your instincts play out.", time: "4 min", tag: "Simulator" },
  ];

  // ── Health Check data ──
  const hcQuestions = [
    { q: "Has this client's communication pattern changed recently?", opts: [{ t: "Same as always — no shift in how we talk", s: 10 }, { t: "Slightly different but could be nothing", s: 8 }, { t: "Noticeably different from normal", s: 3 }, { t: "Something has clearly changed", s: 1 }] },
    { q: "When was your last meaningful conversation?", opts: [{ t: "This week — we're in a good rhythm", s: 10 }, { t: "Within 2 weeks — normal for us", s: 8 }, { t: "It's been a while — longer than usual", s: 4 }, { t: "It's been 84 years...", s: 1 }] },
    { q: "How honest is the feedback you're getting?", opts: [{ t: "Same as always — they engage the way they always have", s: 10 }, { t: "Slightly less engaged than normal", s: 8 }, { t: "Noticeably pulled back from how they used to be", s: 4 }, { t: "Little to no feedback at all — and that's new", s: 1 }] },
    { q: "Is there a conversation you've been putting off?", opts: [{ t: "No — we're aligned and I feel good about it", s: 10 }, { t: "Something small I should probably mention", s: 8 }, { t: "Something real that's been on my mind", s: 4 }, { t: "Yes — and the longer I wait the harder it gets", s: 1 }] },
    { q: "If they cancelled tomorrow, how would you feel?", opts: [{ t: "Surprised. Unexpected for sure.", s: 10 }, { t: "Surprised but I could see it if I'm honest", s: 6 }, { t: "Not that surprised", s: 3 }, { t: "I've had the thought myself", s: 1 }] },
  ];

  // ── Simulator data ──
  const raiNudge = " The truth is, by the time response times have doubled and meetings are slipping, you're playing catch-up. The A play was having this conversation weeks ago when the first signal appeared. Want help spotting those earlier? Talk to Rai.";
  const simScenarios = [
    { title: "The New Stakeholder", setup: "Your main contact Mike just told you his new boss wants to \"review all vendor relationships.\" Mike says not to worry. What do you do?",
      opts: [
        { label: "Ask for an intro to Mike's new boss to set the tone directly", desc: "\"Mike, we'd really like to speak to your new boss to make sure he sees our value..\"", outcome: "If Mike is protective of the relationship, you just undermined your biggest advocate. If you are already providing value, the new boss will likely see it regardless. Rai can help diagnose situations like this.", score: "C" },
        { label: "Ask Mike how he'd like to handle it together", desc: "\"I trust your read on this. How do you want to play it — should I put something together for you, or would it help if I met them directly?\"", outcome: "You're respecting Mike's position while giving him options. He knows whether an intro helps or hurts.", score: "A" },
        { label: "Trust Mike and wait it out", desc: "He knows the internal dynamics better than you.", outcome: "This can work — if Mike has real influence and a strong relationship with the new boss. But you're betting your contract on someone else's political capital without knowing how much they have.", score: "B" },
      ]},
    { title: "The Vague Feedback Shift", setup: "Your client Ally used to give detailed, specific feedback on every deliverable. For the last three rounds, it's been \"looks good\" and nothing else. What do you do?",
      opts: [
        { label: "Send a longer-form review request or survey", desc: "A formal feedback form covering satisfaction, communication, and goals.", outcome: "Formality when the relationship has been informal signals that you know something is wrong. It also gives her an easy out — she'll check all the positive boxes and you'll learn nothing.", score: "C" },
        { label: "Enjoy the easy approval and move on", desc: "Less revision means more efficiency. Maybe she just trusts you now.", outcome: "Vague positivity is one of the most missed churn signals. Engaged clients give details. Disengaging clients say \"looks good.\"", score: "D" },
        { label: "Ask a specific question that forces a real answer", desc: "\"Ally, on the last campaign — was the creative direction what you had in mind, or would you have gone a different way?\"", outcome: "You're not asking, \"Is everything okay?\" — you're making it easy for her to give you something real without it feeling like a confrontation.", score: "A" },
      ]},
    { title: "The Budget Conversation", setup: "Your client James casually mentions they're \"tightening budgets across the board this quarter.\" He hasn't said anything about your contract specifically. What do you do?",
      opts: [
        { label: "Proactively propose a restructured package", desc: "\"James, I heard you on the budget pressure. Here's what I'd suggest if we need to adjust — these are the highest-impact pieces I'd protect.\"", outcome: "You're showing you listened, you're flexible, and you're strategic. Clients cut vendors who seem rigid first.", score: "A" },
        { label: "Wait to see if it affects you", desc: "He didn't mention your contract. No need to bring it up and plant ideas.", outcome: "You're hoping the problem doesn't find you. It usually does — and by then you've lost the chance to shape the conversation.", score: "C" },
        { label: "Ask directly if your contract is at risk", desc: "\"James, should I be worried about our engagement?\"", outcome: "Direct, but it puts him in an awkward position and frames you as a cost to defend rather than a partner solving a problem.", score: "C" },
      ]},
    { title: "The Competitor Mention", setup: "During a call, your client Priya casually says \"we've been getting pitched by a few other agencies lately.\" She laughs it off. What do you do?",
      opts: [
        { label: "Laugh it off too and change the subject", desc: "She brought it up casually, so it's probably nothing. Don't make it weird.", outcome: "She told you for a reason. Clients don't mention competitors by accident. This was either a test or a warning — either way, ignoring it is the worst response.", score: "D" },
        { label: "Immediately pitch new ideas to prove your value", desc: "Launch into everything new you've been thinking about to remind her why she hired you.", outcome: "Reactive and transparent. She'll see through it — and it signals insecurity rather than confidence.", score: "C" },
        { label: "Match her energy with confidence", desc: "\"Of course you are! You're a great client. I'd be worried if they weren't calling you.\"", outcome: "No panic, no defensiveness. You're reminding her she's valuable and you're not threatened. Confidence is the most underrated retention tool.", score: "A" },
      ]},
    { title: "The Slow Fade", setup: "Your client Sarah used to respond within hours. Now it takes days. Meetings keep getting rescheduled. The work quality hasn't changed. What do you do?",
      opts: [
        { label: "Name the pattern directly", desc: "\"Sarah, I've noticed our rhythm has shifted. I want to make sure I'm still delivering what matters most to you.\"", outcome: "This is the right instinct and it may still work." + raiNudge, score: "B" },
        { label: "Send a check-in email", desc: "\"Hey Sarah, just checking in — everything okay on your end?\"", outcome: "She'll say \"All good!\" and the fade continues. You've confirmed nothing and changed nothing." + raiNudge, score: "C" },
        { label: "Increase deliverables to prove value", desc: "Send an extra report, add a new initiative, work harder.", outcome: "More output doesn't fix a relationship problem. You're solving the wrong thing and burning resources." + raiNudge, score: "D" },
      ]},
  ];

  // ── Profile dimensions ──
  const profileDims = [
    { key: "commFreq", name: "Communication Frequency", left: "Rarely", right: "Constantly" },
    { key: "commTone", name: "Communication Tone", left: "Reserved", right: "Direct" },
    { key: "trustLevel", name: "Trust Level", left: "Hands-on", right: "Delegated" },
    { key: "decisionSpeed", name: "Decision Speed", left: "Deliberate", right: "Immediate" },
    { key: "feedbackStyle", name: "Feedback Style", left: "Indirect", right: "Blunt" },
    { key: "metricFocus", name: "Metric Focus", left: "Gut feel", right: "Data-driven" },
    { key: "expectLevel", name: "Expectation Level", left: "Conservative", right: "Aggressive" },
    { key: "reportNeed", name: "Reporting Need", left: "Hands-off", right: "Everything" },
    { key: "stressResponse", name: "Stress Response", left: "Goes quiet", right: "Gets loud" },
    { key: "changeAppetite", name: "Change Appetite", left: "Stable", right: "Experimenting" },
    { key: "loyaltySignal", name: "Loyalty Signal", left: "Shopping around", right: "Locked in" },
    { key: "relationDepth", name: "Relationship Depth", left: "Business", right: "Personal" },
  ];

  // ── Shared email gate ──
  const EmailGate = ({ title, sub }) => (
    <div style={{ background: C.raiGrad, borderRadius: 16, padding: "28px 26px", color: "#fff", textAlign: "center" }}>
      <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 6, letterSpacing: "-0.01em" }}>{title || "Want help before your next hard conversation?"}</div>
      <p style={{ fontSize: 14.5, color: "rgba(255,255,255,.72)", lineHeight: 1.6, margin: "0 auto 18px", maxWidth: 380 }}>{sub || "Rai reads the relationship and gives you the next move. See it on your own book."}</p>
      <button onClick={() => setPage("signup")} className="cta-btn" style={{ padding: "13px 30px", background: "#fff", color: C.btn, border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Start Free Trial</button>
    </div>
  );

  const Opt = ({ text, selected, onClick }) => (
    <div onClick={onClick} style={{ padding: "13px 16px", borderRadius: 12, cursor: "pointer", background: selected ? C.primaryGhost : C.card, border: "1.5px solid " + (selected ? C.primary : C.borderLight), fontSize: 14.5, color: selected ? C.primary : C.textSec, fontWeight: selected ? 700 : 500, transition: "all 0.15s", boxShadow: selected ? "none" : C.cardShadow }}>{text}</div>
  );

  const BackBtn = ({ onClick }) => <button onClick={onClick} style={{ padding: "9px 18px", background: C.surface, color: C.textSec, border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>← Back</button>;
  const NextBtn = ({ onClick, disabled, label }) => <button onClick={onClick} disabled={disabled} style={{ padding: "9px 22px", background: disabled ? C.surface : C.btn, color: disabled ? C.textMuted : "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: disabled ? "default" : "pointer", fontFamily: "inherit", transition: "background 0.15s" }}>{label || "Next"}</button>;

  const renderHealth = () => {
    const total = hcQuestions.length;
    if (step < total) {
      const q = hcQuestions[step];
      return (
        <div>
          <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>{Array.from({ length: total }).map((_, i) => <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? C.primary : C.borderLight }} />)}</div>
          <p style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>{step + 1} of {total}</p>
          <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, lineHeight: 1.4 }}>{q.q}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {q.opts.map((o, i) => <Opt key={i} text={o.t} selected={answers[step] === i} onClick={() => { setAnswers({ ...answers, [step]: i }); setTimeout(() => setStep(step + 1), 300); }} />)}
          </div>
          {step > 0 && <div style={{ marginTop: 14 }}><BackBtn onClick={() => setStep(step - 1)} /></div>}
        </div>
      );
    }
    const score = Math.round(hcQuestions.reduce((a, q, i) => a + q.opts[answers[i]]?.s, 0) / 50 * 100);
    const label = score >= 90 ? "Thriving" : score >= 80 ? "Healthy" : score >= 70 ? "Check In" : score >= 60 ? "Attention Needed" : score >= 50 ? "Watch Closely" : score >= 40 ? "At Risk" : score >= 30 ? "Serious" : score >= 20 ? "Critical" : "Emergency";
    const color = score >= 70 ? C.success : score >= 50 ? C.warning : C.danger;
    const msg = score >= 90 ? "This relationship is strong. Keep showing up the way you have been. Great work!"
      : score >= 80 ? "Healthy. Nothing urgent that stands out, but don't coast — momentum is easier to keep than rebuild."
      : score >= 70 ? "Nothing alarming, but worth considering what you can do slightly differently to improve this engagement."
      : score >= 60 ? "Something is off. You seem to sense it. Think through what's changed and how you can address any new variables. We recommend reviewing with Rai."
      : score >= 50 ? "There's a pattern forming here. Multiple signals suggest this isn't a one-off rough patch. We recommend having an honest conversation soon. Speak with Rai."
      : score >= 40 ? "Several things need attention and they're compounding. The longer you wait, the harder each one gets to fix. Speak with Rai before this escalates."
      : score >= 30 ? "This client relationship has serious, overlapping problems. We strongly recommend building a retention gameplan with Rai today. Not this week — today."
      : score >= 20 ? "This relationship has deep fractures on multiple fronts. If there's a path back, it requires a direct, honest conversation immediately. Speak with Rai and prepare for either outcome."
      : "There's no way to sugarcoat this one. It's time to decide: is a last effort worth it, or is it time for the Rolodex? If things are ending, a graceful exit can still pave the way for referrals and future business.";
    return (
      <div>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 56, fontWeight: 900, color, letterSpacing: "-0.04em" }}>{score}%</div>
          <div style={{ fontSize: 18, fontWeight: 700, color }}>{label}</div>
          <p style={{ fontSize: 14, color: C.textSec, marginTop: 8 }}>{msg}</p>
        </div>
        <EmailGate title="You know the score. Now get the fix." />
      </div>
    );
  };

  const renderCalculator = () => {
    const clients = parseInt(answers.clients) || 0;
    const avgRev = parseInt(answers.avgRev) || 0;
    const churnPct = parseInt(answers.churnPct) || 0;
    const calculated = clients > 0 && avgRev > 0 && churnPct > 0;
    const annualLoss = Math.round(clients * (churnPct / 100) * avgRev * 12);
    const fivePctImprove = Math.round(annualLoss * 0.05 * 20);
    return (
      <div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>How many active clients do you have?</label>
            <input type="number" value={answers.clients || ""} onChange={e => setAnswers({ ...answers, clients: e.target.value })} placeholder="e.g. 12" style={{ width: "100%", padding: "12px 14px", border: "1.5px solid " + C.border, borderRadius: 12, fontSize: 15, fontFamily: "inherit", outline: "none", background: C.bg, boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Average monthly revenue per client ($)</label>
            <input type="number" value={answers.avgRev || ""} onChange={e => setAnswers({ ...answers, avgRev: e.target.value })} placeholder="e.g. 4000" style={{ width: "100%", padding: "12px 14px", border: "1.5px solid " + C.border, borderRadius: 12, fontSize: 15, fontFamily: "inherit", outline: "none", background: C.bg, boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>What % of clients do you lose per year?</label>
            <input type="number" value={answers.churnPct || ""} onChange={e => setAnswers({ ...answers, churnPct: e.target.value })} placeholder="e.g. 20" style={{ width: "100%", padding: "12px 14px", border: "1.5px solid " + C.border, borderRadius: 12, fontSize: 15, fontFamily: "inherit", outline: "none", background: C.bg, boxSizing: "border-box" }} />
          </div>
        </div>
        {calculated && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ background: C.dangerBg, borderRadius: 14, padding: "24px", border: "1px solid " + C.danger + "44", textAlign: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.danger, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>You're losing</div>
              <div style={{ fontSize: 44, fontWeight: 900, color: C.danger, letterSpacing: "-0.03em" }}>${annualLoss.toLocaleString()}</div>
              <div style={{ fontSize: 14, color: C.danger }}>per year to client churn</div>
            </div>
            <div style={{ background: C.primarySoft, borderRadius: 14, padding: "24px", border: "1px solid " + C.primary + "44", textAlign: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.primary, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>A 5% retention improvement =</div>
              <div style={{ fontSize: 44, fontWeight: 900, color: C.primary, letterSpacing: "-0.03em" }}>+${fivePctImprove.toLocaleString()}</div>
              <div style={{ fontSize: 14, color: C.primary }}>in profit impact (at 95% margin on retained revenue)</div>
            </div>
          </div>
        )}
        {calculated && <EmailGate title="Ready to reduce your churn?" />}
      </div>
    );
  };

  const renderProfile = () => {
    const total = profileDims.length;
    if (step < total) {
      const dim = profileDims[step];
      const val = sliderVals[dim.key];
      const hasVal = val !== undefined;
      return (
        <div>
          <div style={{ display: "flex", gap: 3, marginBottom: 14 }}>{profileDims.map((_, i) => <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? C.primary : C.borderLight }} />)}</div>
          <p style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>{step + 1} of {total}</p>
          <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{dim.name}</p>
          <div style={{ textAlign: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 36, fontWeight: 900, color: hasVal ? C.primary : C.borderLight }}>{hasVal ? val : "—"}</span>
          </div>
          <div style={{ padding: "0 4px", marginBottom: 6 }}>
            <input type="range" min="0" max="10" value={hasVal ? val : 5} onChange={e => setSliderVals({ ...sliderVals, [dim.key]: parseInt(e.target.value) })} style={{ width: "100%", height: 6, appearance: "none", WebkitAppearance: "none", background: `linear-gradient(to right, ${C.border} 0%, ${C.primary} 100%)`, borderRadius: 3, outline: "none", cursor: "pointer" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.textMuted, marginBottom: 14 }}>
            <span>{dim.left}</span><span>{dim.right}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            {step > 0 ? <BackBtn onClick={() => setStep(step - 1)} /> : <div />}
            <NextBtn onClick={() => hasVal && setStep(step + 1)} disabled={!hasVal} label={step < total - 1 ? "Next" : "See Profile"} />
          </div>
        </div>
      );
    }
    const loyalty = (sliderVals.loyaltySignal || 5) / 10;
    const trust = (sliderVals.trustLevel || 5) / 10;
    const baseline = Math.round((loyalty * 0.30 + trust * 0.20 + 0.50) * 100);
    const label = baseline >= 75 ? "Strong" : baseline >= 55 ? "Stable" : baseline >= 35 ? "Watch" : "At Risk";
    const color = baseline >= 75 ? C.success : baseline >= 55 ? C.warning : C.danger;
    return (
      <div>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 56, fontWeight: 900, color, letterSpacing: "-0.04em" }}>{baseline}%</div>
          <div style={{ fontSize: 18, fontWeight: 700, color }}>{label}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 20 }}>
          {profileDims.map(d => (
            <div key={d.key} style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", background: C.bg, borderRadius: 8, fontSize: 12 }}>
              <span style={{ color: C.textSec }}>{d.name}</span>
              <span style={{ fontWeight: 700, color: C.primary }}>{sliderVals[d.key]}</span>
            </div>
          ))}
        </div>
        <EmailGate title="Want to level up your client relationships?" />
      </div>
    );
  };

  const renderSimulator = () => {
    const total = simScenarios.length;
    if (step < total) {
      const s = simScenarios[step];
      const picked = answers[step];
      const revealed = picked !== undefined;
      return (
        <div>
          <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>{Array.from({ length: total }).map((_, i) => <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? C.primary : C.borderLight }} />)}</div>
          <p style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>Scenario {step + 1} of {total}</p>
          <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{s.title}</p>
          <p style={{ fontSize: 14, color: C.textSec, lineHeight: 1.55, marginBottom: 16 }}>{s.setup}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {s.opts.map((o, i) => (
              <div key={i} onClick={() => !revealed && setAnswers({ ...answers, [step]: i })} style={{ padding: "14px 16px", borderRadius: 10, cursor: revealed ? "default" : "pointer", background: revealed && picked === i ? (o.score === "A" ? C.primarySoft : o.score === "B" ? C.warningBg : C.dangerBg) : C.bg, border: "1.5px solid " + (revealed && picked === i ? (o.score === "A" ? C.primary : o.score === "B" ? C.warning : C.danger) : C.borderLight) }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{o.label}</div>
                <div style={{ fontSize: 13, color: C.textSec, fontStyle: "italic" }}>{o.desc}</div>
                {revealed && picked === i && (
                  <div style={{ marginTop: 10, padding: "10px 12px", background: "rgba(0,0,0,0.03)", borderRadius: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Grade: {o.score}</div>
                    <p style={{ fontSize: 13, color: C.textSec, lineHeight: 1.5 }}>{o.outcome}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
            {step > 0 ? <BackBtn onClick={() => setStep(step - 1)} /> : <div />}
            {revealed && <NextBtn onClick={() => setStep(step + 1)} label={step < total - 1 ? "Next" : "See Results"} />}
          </div>
        </div>
      );
    }
    const grades = simScenarios.map((s, i) => s.opts[answers[i]]?.score || "?");
    return (
      <div>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 12 }}>
            {grades.map((g, i) => (
              <div key={i} style={{ width: 56, height: 56, borderRadius: 12, background: g === "A" ? C.primarySoft : g === "B" ? C.warningBg : C.dangerBg, border: "2px solid " + (g === "A" ? C.primary : g === "B" ? C.warning : C.danger), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 900, color: g === "A" ? C.primary : g === "B" ? C.warning : C.danger }}>{g}</div>
            ))}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{grades.filter(g => g === "A").length >= 3 ? "Strong conversational instincts." : "Most people avoid these conversations entirely."}</div>
          <p style={{ fontSize: 14, color: C.textSec, marginTop: 8 }}>The right words at the right time save accounts. The wrong ones — or no words at all — lose them.</p>
        </div>
        <EmailGate />
      </div>
    );
  };

  const renderers = { health: renderHealth, calculator: renderCalculator, profile: renderProfile, simulator: renderSimulator };

  return (
    <div className="resources-page">
      <RetPageStyles />
      <style>{`
        @media (max-width: 900px) {
          .res-featured-grid { grid-template-columns: 1fr !important; }
          .res-library-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 600px) {
          .res-library-grid { grid-template-columns: 1fr !important; }
          .res-filter-row { flex-direction: column; align-items: flex-start !important; gap: 16px !important; }
          .res-newsletter-row { flex-direction: column; gap: 10px !important; }
          .res-newsletter-input { width: 100% !important; }
        }
      `}</style>

      {/* ─── HERO ─── */}
      <section className="ret-section r-full-bleed" style={{ background: "#F2EEE8", textAlign: "center", paddingTop: HERO_TOP, paddingBottom: 32 }}>
        <div className="ret-section-inner">
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            <div className="ret-eyebrow">Resources</div>
            <h1 className="ret-h1">
              Field notes from the retention business.
            </h1>
            <p style={{ marginTop: 18, fontSize: 17, color: C.textSec, lineHeight: 1.55 }}>Articles, tools, guides, and webinars. Free. No sign-up required.</p>
          </div>

          {/* Featured row */}
          <div className="res-featured-grid" style={{ maxWidth: 1100, margin: "44px auto 0", display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20, textAlign: "left" }}>
            <div className="ret-card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ height: 280, background: "linear-gradient(135deg, " + C.primarySoft + ", #EFE9FB)", position: "relative" }}>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ fontFamily: "'Caveat', cursive", fontSize: 72, color: C.primary, textAlign: "center", lineHeight: 0.9, fontWeight: 700 }}>
                    the<br/><span style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 900, color: C.primary, letterSpacing: "-0.04em", fontSize: 64 }}>SIGNAL</span>
                  </div>
                </div>
                <div style={{ position: "absolute", top: 16, left: 16, display: "flex", gap: 8 }}>
                  <MiniTag color="btn">Featured</MiniTag>
                  <MiniTag color="primary">{featured.tag}</MiniTag>
                </div>
              </div>
              <div style={{ padding: "24px 28px" }}>
                <div style={{ fontSize: 11, color: C.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>{featured.read} · Adam Lawrence</div>
                <h3 style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.2, marginTop: 8, color: C.text, letterSpacing: "-0.02em" }}>{featured.title}</h3>
                <p style={{ fontSize: 14, color: C.textSec, marginTop: 10, lineHeight: 1.6 }}>{featured.excerpt}</p>
                <span onClick={() => setPage("post:" + featured.slug)} style={{ color: C.btn, fontSize: 13.5, fontWeight: 800, marginTop: 14, display: "inline-block", cursor: "pointer" }}>Read post →</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {sideFeatured.map(p => (
                <div key={p.slug} className="ret-card ret-card-hover" style={{ padding: "22px 24px", flex: 1, cursor: "pointer" }} onClick={() => setPage("post:" + p.slug)}>
                  <MiniTag color="primary">{p.tag}</MiniTag>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 8, fontWeight: 600, letterSpacing: "0.05em" }}>{p.read}</div>
                  <h4 style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.25, marginTop: 8, color: C.text, letterSpacing: "-0.01em" }}>{p.title}</h4>
                  <p style={{ fontSize: 13, color: C.textSec, marginTop: 6, lineHeight: 1.55 }}>{p.excerpt}</p>
                  <span style={{ color: C.btn, fontSize: 13, fontWeight: 800, marginTop: 10, display: "inline-block" }}>Read →</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <RetCurve from="#F2EEE8" to={C.bg} variant="rightCrest" />

      {/* ─── LIBRARY + FILTER ─── */}
      <section className="ret-section r-full-bleed" style={{ background: C.bg }}>
        <div className="ret-section-inner">
          {activeModule ? (
            <div style={{ maxWidth: 640, margin: "0 auto" }}>
              <button onClick={reset} style={{ background: "none", border: "none", fontSize: 13, fontWeight: 700, color: C.btn, cursor: "pointer", fontFamily: "inherit", marginBottom: 16, padding: 0 }}>← Back to all tools</button>
              <div style={{ background: C.card, borderRadius: 16, padding: "28px 26px", border: "1px solid " + C.border, boxShadow: C.cardShadow }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: C.primaryGhost, border: "1px solid " + C.borderLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ToolIcon name={activeModule} size={28} />
                  </div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>{modules.find(m => m.id === activeModule)?.title}</h2>
                </div>
                {renderers[activeModule]?.()}
              </div>
            </div>
          ) : (
          <>
          <div className="res-filter-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32, flexWrap: "wrap", gap: 14 }}>
            <h2 className="ret-h2" style={{ fontSize: "clamp(28px, 4vw, 42px)", margin: 0 }}>The library.</h2>
            <div style={{ display: "inline-flex", background: C.card, padding: 5, borderRadius: 999, border: "1px solid " + C.borderLight, flexWrap: "wrap" }}>
              {filters.map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: "8px 18px", borderRadius: 999, fontSize: 13, fontWeight: 700,
                  background: filter === f ? C.text : "transparent",
                  color: filter === f ? "#fff" : C.textSec,
                  border: "none", cursor: "pointer", fontFamily: "inherit",
                  transition: "all 0.15s ease",
                }}>{f}</button>
              ))}
            </div>
          </div>

          <div className="res-library-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {(filter === "All" || filter === "Tools") && RESOURCES_TOOLS.map(t => {
              const modId = { "Retention Health Check": "health", "The Retention Calculator": "calculator", "Grade Your Client Relationship": "profile", "The Hard Conversation Simulator": "simulator" }[t.title];
              return (
              <div key={t.title} className="ret-card ret-card-hover" style={{ padding: "24px 26px", background: "#EFE9FB", cursor: "pointer" }} onClick={() => { reset(); setActiveModule(modId); window.scrollTo(0, 0); }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div style={{ width: 46, height: 46, borderRadius: 12, background: C.card, border: "1px solid " + C.btnLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ToolIcon name={modId} size={28} />
                  </div>
                  <MiniTag color="btn">{t.kind}</MiniTag>
                </div>
                <h4 style={{ fontSize: 17, fontWeight: 800, color: C.text, letterSpacing: "-0.01em" }}>{t.title}</h4>
                <p style={{ fontSize: 13.5, color: C.textSec, marginTop: 6, lineHeight: 1.55 }}>{t.sub}</p>
                <span style={{ color: C.btn, fontSize: 13.5, fontWeight: 800, marginTop: 12, display: "inline-block" }}>Start interactive →</span>
              </div>
            );})}
            {(filter === "All" || filter === "Articles") && restArticles.map(p => (
              <div key={p.slug} className="ret-card ret-card-hover" style={{ padding: "24px 26px", cursor: "pointer" }} onClick={() => setPage("post:" + p.slug)}>
                <MiniTag color="primary">{p.tag}</MiniTag>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 8, fontWeight: 600, letterSpacing: "0.05em" }}>{p.read}</div>
                <h4 style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.2, marginTop: 8, color: C.text, letterSpacing: "-0.01em" }}>{p.title}</h4>
                <p style={{ fontSize: 13.5, color: C.textSec, marginTop: 6, lineHeight: 1.55 }}>{p.excerpt}</p>
                <span style={{ color: C.btn, fontSize: 13.5, fontWeight: 800, marginTop: 10, display: "inline-block" }}>Read →</span>
              </div>
            ))}
            {(filter === "All" || filter === "Guides") && guidePosts.map(g => (
              <div key={g.slug} className="ret-card ret-card-hover" style={{ padding: "24px 26px", cursor: "pointer" }} onClick={() => setPage("post:" + g.slug)}>
                <MiniTag color="warning">{g.tag}</MiniTag>
                <h4 style={{ fontSize: 17, fontWeight: 800, marginTop: 14, color: C.text, letterSpacing: "-0.01em" }}>{g.title}</h4>
                <p style={{ fontSize: 13.5, color: C.textSec, marginTop: 6, lineHeight: 1.55 }}>{g.excerpt}</p>
                <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 8, fontWeight: 600 }}>{g.read}</div>
                <span style={{ color: C.btn, fontSize: 13.5, fontWeight: 800, marginTop: 12, display: "inline-block" }}>Read guide →</span>
              </div>
            ))}
            {(filter === "All" || filter === "Webinars") && RESOURCES_WEBINARS.map(w => (
              <div key={w.title} className="ret-card" style={{ padding: "24px 26px", background: C.primaryDeep, color: "#fff", border: "1px solid " + C.primaryDeep }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 800, color: C.primaryLight }}>WEBINAR</span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>{w.dur}</span>
                </div>
                <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11.5, color: C.primaryLight, marginTop: 10, fontWeight: 600 }}>{w.date} · {w.kind}</div>
                <h4 style={{ fontSize: 17, fontWeight: 800, marginTop: 10, color: "#fff", letterSpacing: "-0.01em" }}>{w.title}</h4>
                <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.7)", marginTop: 6, lineHeight: 1.55 }}>{w.sub}</p>
                <span onClick={() => { const el = document.getElementById("newsletter"); if (el) el.scrollIntoView({ behavior: "smooth" }); }} style={{ color: C.primaryLight, fontSize: 13.5, fontWeight: 800, marginTop: 12, display: "inline-block", cursor: "pointer" }}>{w.kind === "Coming soon" ? "Notify me →" : w.kind === "Upcoming" ? "Reserve a seat →" : "Watch →"}</span>
              </div>
            ))}
          </div>
          </>
          )}
        </div>
      </section>

      <RetCurve from={C.bg} to="#F2EEE8" variant="leftCrest" />

      {/* ─── NEWSLETTER ─── */}
      <section id="newsletter" className="ret-section r-full-bleed" style={{ background: "#F2EEE8", textAlign: "center", paddingBottom: 88 }}>
        <div className="ret-section-inner" style={{ maxWidth: 760 }}>
          <div className="ret-eyebrow">Stay in the loop</div>
          <h3 className="ret-h2" style={{ fontSize: "clamp(28px, 3.5vw, 48px)", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.03em" }}>Get notified when we publish.</h3>
          <div className="res-newsletter-row" style={{ marginTop: 22, display: "inline-flex", gap: 8, alignItems: "stretch", background: C.card, padding: 6, borderRadius: 999, border: "1px solid " + C.borderLight, maxWidth: "100%", boxSizing: "border-box" }}>
            <input
              type="email"
              placeholder="you@agency.com"
              className="res-newsletter-input"
              style={{ background: "transparent", border: "none", outline: "none", margin: 0, padding: "12px 18px", width: 280, maxWidth: "100%", minWidth: 0, flex: "1 1 auto", boxSizing: "border-box", fontSize: 14.5, lineHeight: "20px", color: C.text, fontFamily: "inherit", borderRadius: 999, appearance: "none", WebkitAppearance: "none" }}
            />
            <button className="cta-btn" style={{ padding: "12px 22px", fontSize: 14, fontWeight: 700, background: C.btn, color: "#fff", border: "none", borderRadius: 999, cursor: "pointer", fontFamily: "inherit", flexShrink: 0, lineHeight: "20px" }}>Subscribe</button>
          </div>
          <div style={{ fontSize: 12.5, color: C.textSec, marginTop: 12 }}>One email a month. Unsubscribe with one click.</div>
        </div>
      </section>

      <Footer setPage={setPage} />
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// SHARED PAGE PRIMITIVES — used by all non-home pages
// ═══════════════════════════════════════════════════════════════

// Reusable eyebrow pill, H2, sub, CTA row, section wrapper, curve.
// Everything renders at the site's standard clamp() sizes and uses C constants.

function RetPageStyles() {
  return (
    <style>{`
      .trd-chip { font-family: inherit; font-size: 12.5px; font-weight: 700; padding: 9px 15px; border-radius: 100px; border: 1px solid ${C.border}; background: ${C.card}; cursor: pointer; color: ${C.text}; transition: all 0.18s; }
      .trd-chip:hover { border-color: ${C.primary}; color: ${C.primary}; transform: translateY(-1px); }
      .trd-chip-muted { color: ${C.textMuted}; }
      .trd-chip-on { background: ${C.primary}; border-color: ${C.primary}; color: #fff; }
      .trd-chip-on:hover { background: ${C.primaryDark}; border-color: ${C.primaryDark}; color: #fff; }
      .rai-send { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 700; color: ${C.primary}; padding: 7px 14px; border: 1px solid ${C.primary}55; border-radius: 100px; }
      @media (min-width: 768px) { .rai-send { margin-left: auto; } }
      .sdemo-range { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 100px; background: ${C.borderLight}; outline: none; }
      .sdemo-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 20px; height: 20px; border-radius: 50%; background: ${C.primary}; cursor: pointer; border: 3px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.18); }
      .sdemo-range::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: ${C.primary}; cursor: pointer; border: 3px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.18); }
      @media (max-width: 640px) { .sdemo-grid { grid-template-columns: 1fr !important; } }
      .feat-cine-hero { background: ${C.sidebar || "#1E261F"}; color: #F4F0E6; padding: ${HERO_TOP + 24}px 32px 72px; position: relative; overflow: hidden; }
      .feat-cine-inner { max-width: 720px; margin: 0 auto; }
      .feat-cine-h1 { font-size: clamp(34px, 5.5vw, 60px); font-weight: 900; letter-spacing: -0.035em; line-height: 1.08; margin: 0 0 22px; }
      .feat-cine-sub { font-size: clamp(16px, 2vw, 19px); line-height: 1.6; color: #C8D2C9; max-width: 560px; }
      .ret-hero { background: #F2EEE8; padding: ${HERO_TOP}px 48px 72px; position: relative; overflow: hidden; }
      .ret-hero-inner { max-width: 1100px; margin: 0 auto; text-align: center; }
      .ret-hero-left { max-width: 1100px; margin: 0 auto; text-align: left; }
      .ret-eyebrow {
        font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em;
        color: ${C.primary}; background: ${C.primarySoft};
        display: inline-block; padding: 6px 14px; border-radius: 100px;
        margin-bottom: ${EYEBROW_GAP}px;
      }
      .ret-eyebrow-purple { color: ${C.btn}; background: #EDE4F8; }
      .ret-eyebrow-light { color: ${C.primaryLight}; background: rgba(255,255,255,0.08); }
      .ret-h1 {
        font-size: clamp(38px, 6vw, 76px); font-weight: 900;
        letter-spacing: -0.045em; line-height: 1.08;
        margin: 0 auto 20px; color: ${C.text};
      }
      .ret-h1-left { margin-left: 0; margin-right: 0; max-width: 820px; }
      .ret-strike-wrap { position: relative; display: inline-block; margin: 0 0 0 0.15em; padding-top: 0.2em; }
      .ret-strike { color: ${C.textMuted}; position: relative; }
      .ret-strike::after {
        content: ''; position: absolute; left: -3%; top: 53%;
        height: 0.07em; width: 106%; background: ${C.danger};
        border-radius: 2px; transform: rotate(-1deg);
      }
      .ret-caveat {
        font-family: 'Caveat', cursive; font-weight: 700; color: ${C.primary};
        position: absolute; top: -0.2em; left: 50%;
        transform: translateX(-50%) rotate(-2deg);
        font-size: 0.78em; white-space: nowrap; line-height: 1;
      }
      .ret-sub {
        font-size: clamp(17px, 1.6vw, 19px); color: ${C.textSec};
        max-width: 680px; margin: 0 auto; line-height: 1.55;
      }
      .ret-sub-left { margin-left: 0; margin-right: 0; }
      .ret-hero-fine { font-size: 13.5px; color: ${C.textMuted}; margin-top: 16px; }
      .ret-cta-row { display: flex; gap: 12px; justify-content: center; align-items: center; flex-wrap: wrap; margin-top: 28px; }
      .ret-cta-row-left { justify-content: flex-start; }

      .ret-btn-primary, .ret-btn-secondary, .ret-btn-onDark, .ret-btn-onDark-outline {
        display: inline-flex; align-items: center; justify-content: center;
        height: 52px; padding: 0 28px;
        border-radius: 12px;
        font-size: 16px; font-weight: 700;
        cursor: pointer; font-family: inherit;
        box-sizing: border-box;
        line-height: 1;
        border: 2px solid ${C.btn};
        white-space: nowrap;
        transition: all 0.2s ease;
      }
      .ret-btn-primary { background: ${C.btn}; color: #fff; }
      .ret-btn-primary:hover { background: ${C.btnHover}; border-color: ${C.btnHover}; transform: translateY(-1px); }
      .ret-btn-secondary { background: transparent; color: ${C.btn}; }
      .ret-btn-secondary:hover { background: ${C.btnSoft}; }
      .ret-btn-onDark { background: #fff; color: ${C.btn}; border-color: #fff; }
      .ret-btn-onDark:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0,0,0,0.15); }
      .ret-btn-onDark-outline { background: transparent; color: #fff; border-color: rgba(255,255,255,0.4); }
      .ret-btn-onDark-outline:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.6); }

      .ret-section { padding: 112px 48px; }
      .ret-section-inner { max-width: 1100px; margin: 0 auto; }
      .ret-section-head { text-align: center; max-width: 820px; margin: 0 auto 56px; }
      .ret-bg-cream { background: #F2EEE8; }
      .ret-bg-light { background: ${C.bg}; }
      .ret-bg-beige { background: #EAE4D6; }
      .ret-bg-deep { background: ${C.primaryDeep}; color: #fff; }
      .ret-bg-deep .ret-h2 { color: #fff; }
      .ret-bg-deep .ret-sub { color: rgba(255,255,255,0.72); }

      .ret-h2 {
        font-size: clamp(32px, 4.5vw, 56px); font-weight: 900;
        letter-spacing: -0.035em; line-height: 1.05;
        color: ${C.text}; margin: 0 0 18px;
      }
      .ret-h3 {
        font-size: clamp(22px, 2.4vw, 28px); font-weight: 800;
        letter-spacing: -0.025em; line-height: 1.2;
        color: ${C.text}; margin: 0 0 12px;
      }

      .ret-card {
        background: #fff; border-radius: 16px; padding: 28px 26px;
        box-shadow: 0 4px 16px rgba(60,40,10,0.04);
        border: 1px solid ${C.borderLight};
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }
      .ret-card-hover:hover { transform: translateY(-3px); box-shadow: 0 16px 40px rgba(60,40,10,0.08); }
      .ret-card-deep { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 28px 26px; }

      .ret-grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
      .ret-grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; }

      .ret-curve { display: block; width: 100vw; height: 140px; margin: 0 0 -1px; padding: 0; line-height: 0; }
      .ret-curve svg { display: block; width: 100%; height: calc(100% + 1px); }

      /* Prose block for legal / long-form */
      .ret-prose { font-size: 16px; line-height: 1.75; color: ${C.text}; }
      .ret-prose p { margin: 0 0 18px; }
      .ret-prose h3 { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; color: ${C.text}; margin: 32px 0 12px; }
      .ret-prose strong { font-weight: 700; }

      @media (max-width: 760px) {
        .ret-hero { padding: 48px 24px 56px; }
        .ret-section { padding: 72px 24px; }
        .ret-section-head { margin-bottom: 36px; }
        .ret-curve { height: 80px; }
      }
    `}</style>
  );
}

// Curve: top color = current section bg, bottom color = next section bg
const RET_CURVE_PATHS = {
  // gentle dip in the middle, low-amplitude S
  default: "M 0,100 L 1440,100 L 1440,25 Q 720,140 0,20 Z",
  // wave that crests on the right
  rightCrest: "M 0,100 L 1440,100 L 1440,30 C 1080,-20 360,140 0,25 Z",
  // wave that crests on the left
  leftCrest: "M 0,100 L 1440,100 L 1440,30 C 1100,140 340,-30 0,35 Z",
  // shallow-arc dome
  dome: "M 0,100 L 1440,100 L 1440,25 C 1080,-30 360,140 0,20 Z",
  // gentle right-side rise
  rightRise: "M 0,100 L 1440,100 L 1440,15 C 1080,80 360,40 0,55 Z",
  // gentle left-side rise
  leftRise: "M 0,100 L 1440,100 L 1440,55 C 1080,40 360,80 0,15 Z",
};

// ─── Solutions page graphics (inline SVG, no external files) ───
function FreelancerNetworkGraphic() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 340" style={{ display: "block", width: "100%", height: "auto", maxWidth: 460, margin: "0 auto" }}>
      <g stroke="#2F2F31" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.85">
        <line x1="230" y1="170" x2="86" y2="86" />
        <line x1="230" y1="170" x2="380" y2="70" />
        <line x1="230" y1="170" x2="410" y2="180" />
        <line x1="230" y1="170" x2="360" y2="280" />
        <line x1="230" y1="170" x2="110" y2="270" />
        <line x1="230" y1="170" x2="60" y2="200" />
        <line x1="230" y1="170" x2="250" y2="54" />
      </g>
      <g>
        <circle cx="86" cy="86" r="16" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="2" />
        <circle cx="380" cy="70" r="18" fill="#558B68" stroke="#2F2F31" strokeWidth="2" />
        <circle cx="410" cy="180" r="14" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="2" />
        <circle cx="360" cy="280" r="16" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="2" />
        <circle cx="110" cy="270" r="18" fill="#558B68" stroke="#2F2F31" strokeWidth="2" />
        <circle cx="60" cy="200" r="14" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="2" />
        <circle cx="250" cy="54" r="14" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="2" />
      </g>
      <circle cx="230" cy="170" r="30" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="2.6" />
      <circle cx="230" cy="170" r="22" fill="#558B68" stroke="#2F2F31" strokeWidth="2" />
      <circle cx="230" cy="170" r="4" fill="#FCFCFE" />
      <ellipse cx="230" cy="170" rx="160" ry="110" fill="none" stroke="#2F2F31" strokeWidth="1" strokeDasharray="2 5" opacity="0.3" />
    </svg>
  );
}

function AgencyNetworkGraphic() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 340" style={{ display: "block", width: "100%", height: "auto", maxWidth: 460, margin: "0 auto" }}>
      <g fill="#558B68" opacity="0.12">
        <ellipse cx="90" cy="90" rx="62" ry="46" />
        <ellipse cx="380" cy="86" rx="58" ry="44" />
        <ellipse cx="94" cy="258" rx="58" ry="40" />
        <ellipse cx="378" cy="262" rx="60" ry="42" />
      </g>
      <g stroke="#2F2F31" strokeWidth="1.4" strokeLinecap="round" opacity="0.8">
        <line x1="230" y1="170" x2="90" y2="90" />
        <line x1="230" y1="170" x2="380" y2="86" />
        <line x1="230" y1="170" x2="94" y2="258" />
        <line x1="230" y1="170" x2="378" y2="262" />
      </g>
      <g stroke="#2F2F31" strokeWidth="0.9" strokeLinecap="round" opacity="0.5" fill="none">
        <path d="M60 72 L92 90 L120 68 L92 90 L80 120 L92 90 L128 100" />
        <path d="M350 60 L380 86 L414 72 L380 86 L420 108 L380 86 L346 110" />
        <path d="M62 232 L94 258 L124 236 L94 258 L130 286 L94 258 L62 288" />
        <path d="M346 234 L378 262 L416 244 L378 262 L414 288 L378 262 L342 290" />
      </g>
      <g fill="#FCFCFE" stroke="#2F2F31" strokeWidth="1.4">
        <circle cx="60" cy="72" r="6" /><circle cx="120" cy="68" r="6" />
        <circle cx="80" cy="120" r="6" fill="#558B68" /><circle cx="128" cy="100" r="6" />
        <circle cx="52" cy="104" r="5" /><circle cx="108" cy="126" r="5" />
        <circle cx="92" cy="90" r="8" />
        <circle cx="350" cy="60" r="6" /><circle cx="414" cy="72" r="6" fill="#558B68" />
        <circle cx="420" cy="108" r="6" /><circle cx="346" cy="110" r="6" />
        <circle cx="342" cy="80" r="5" /><circle cx="400" cy="54" r="5" />
        <circle cx="380" cy="86" r="8" />
        <circle cx="62" cy="232" r="6" /><circle cx="124" cy="236" r="6" />
        <circle cx="130" cy="286" r="6" fill="#558B68" /><circle cx="62" cy="288" r="6" />
        <circle cx="54" cy="262" r="5" /><circle cx="108" cy="212" r="5" />
        <circle cx="94" cy="258" r="8" />
        <circle cx="346" cy="234" r="6" fill="#558B68" /><circle cx="416" cy="244" r="6" />
        <circle cx="414" cy="288" r="6" /><circle cx="342" cy="290" r="6" />
        <circle cx="400" cy="216" r="5" /><circle cx="422" cy="214" r="5" />
        <circle cx="378" cy="262" r="8" />
      </g>
      <circle cx="230" cy="170" r="30" fill="#FCFCFE" stroke="#2F2F31" strokeWidth="2.6" />
      <circle cx="230" cy="170" r="22" fill="#558B68" stroke="#2F2F31" strokeWidth="2" />
      <g stroke="#FCFCFE" strokeWidth="2" strokeLinecap="round">
        <line x1="222" y1="170" x2="238" y2="170" />
        <line x1="230" y1="162" x2="230" y2="178" />
      </g>
    </svg>
  );
}

function EnterpriseNetworkGraphic() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 340" style={{ display: "block", width: "100%", height: "auto", maxWidth: 540, margin: "0 auto" }}>
      <g fill="#558B68" opacity="0.10">
        <circle cx="88" cy="92" r="58" /><circle cx="230" cy="70" r="54" /><circle cx="370" cy="92" r="58" />
        <circle cx="88" cy="260" r="58" /><circle cx="230" cy="278" r="54" /><circle cx="370" cy="260" r="58" />
      </g>
      <g stroke="#2F2F31" strokeWidth="1" strokeLinecap="round" opacity="0.55" fill="none">
        <path d="M88 92 L230 70 L370 92 L370 260 L230 278 L88 260 Z" />
        <path d="M88 92 L370 260 M370 92 L88 260 M230 70 L230 278" />
        <path d="M88 92 L230 278 M370 92 L230 278 M88 260 L370 92" />
      </g>
      <g stroke="#2F2F31" strokeWidth="0.7" strokeLinecap="round" opacity="0.55" fill="none">
        <g>
          <line x1="88" y1="92" x2="50" y2="58" /><line x1="88" y1="92" x2="80" y2="46" />
          <line x1="88" y1="92" x2="124" y2="52" /><line x1="88" y1="92" x2="140" y2="86" />
          <line x1="88" y1="92" x2="132" y2="122" /><line x1="88" y1="92" x2="96" y2="138" />
          <line x1="88" y1="92" x2="52" y2="134" /><line x1="88" y1="92" x2="38" y2="100" />
          <line x1="88" y1="92" x2="42" y2="78" />
        </g>
        <g>
          <line x1="230" y1="70" x2="194" y2="32" /><line x1="230" y1="70" x2="232" y2="22" />
          <line x1="230" y1="70" x2="268" y2="32" /><line x1="230" y1="70" x2="284" y2="66" />
          <line x1="230" y1="70" x2="274" y2="102" /><line x1="230" y1="70" x2="230" y2="116" />
          <line x1="230" y1="70" x2="188" y2="102" /><line x1="230" y1="70" x2="178" y2="74" />
        </g>
        <g>
          <line x1="370" y1="92" x2="336" y2="56" /><line x1="370" y1="92" x2="370" y2="42" />
          <line x1="370" y1="92" x2="414" y2="56" /><line x1="370" y1="92" x2="424" y2="92" />
          <line x1="370" y1="92" x2="418" y2="128" /><line x1="370" y1="92" x2="378" y2="138" />
          <line x1="370" y1="92" x2="326" y2="128" /><line x1="370" y1="92" x2="320" y2="98" />
          <line x1="370" y1="92" x2="344" y2="132" />
        </g>
        <g>
          <line x1="88" y1="260" x2="50" y2="224" /><line x1="88" y1="260" x2="80" y2="212" />
          <line x1="88" y1="260" x2="126" y2="220" /><line x1="88" y1="260" x2="142" y2="256" />
          <line x1="88" y1="260" x2="132" y2="292" /><line x1="88" y1="260" x2="92" y2="306" />
          <line x1="88" y1="260" x2="52" y2="302" /><line x1="88" y1="260" x2="38" y2="270" />
          <line x1="88" y1="260" x2="44" y2="244" />
        </g>
        <g>
          <line x1="230" y1="278" x2="194" y2="238" /><line x1="230" y1="278" x2="232" y2="228" />
          <line x1="230" y1="278" x2="270" y2="240" /><line x1="230" y1="278" x2="284" y2="274" />
          <line x1="230" y1="278" x2="274" y2="310" /><line x1="230" y1="278" x2="228" y2="322" />
          <line x1="230" y1="278" x2="186" y2="310" /><line x1="230" y1="278" x2="176" y2="280" />
        </g>
        <g>
          <line x1="370" y1="260" x2="336" y2="224" /><line x1="370" y1="260" x2="370" y2="210" />
          <line x1="370" y1="260" x2="414" y2="224" /><line x1="370" y1="260" x2="424" y2="258" />
          <line x1="370" y1="260" x2="418" y2="298" /><line x1="370" y1="260" x2="378" y2="310" />
          <line x1="370" y1="260" x2="326" y2="300" /><line x1="370" y1="260" x2="318" y2="266" />
        </g>
      </g>
      <g fill="#FCFCFE" stroke="#2F2F31" strokeWidth="1.1">
        <circle cx="50" cy="58" r="4" /><circle cx="80" cy="46" r="4" /><circle cx="124" cy="52" r="4" />
        <circle cx="140" cy="86" r="4" fill="#558B68" /><circle cx="132" cy="122" r="4" /><circle cx="96" cy="138" r="4" />
        <circle cx="52" cy="134" r="4" /><circle cx="38" cy="100" r="4" fill="#558B68" /><circle cx="42" cy="78" r="4" />
        <circle cx="194" cy="32" r="4" /><circle cx="232" cy="22" r="4" fill="#558B68" /><circle cx="268" cy="32" r="4" />
        <circle cx="284" cy="66" r="4" /><circle cx="274" cy="102" r="4" /><circle cx="230" cy="116" r="4" />
        <circle cx="188" cy="102" r="4" fill="#558B68" /><circle cx="178" cy="74" r="4" />
        <circle cx="336" cy="56" r="4" /><circle cx="370" cy="42" r="4" /><circle cx="414" cy="56" r="4" fill="#558B68" />
        <circle cx="424" cy="92" r="4" /><circle cx="418" cy="128" r="4" /><circle cx="378" cy="138" r="4" />
        <circle cx="326" cy="128" r="4" /><circle cx="320" cy="98" r="4" /><circle cx="344" cy="132" r="4" fill="#558B68" />
        <circle cx="50" cy="224" r="4" fill="#558B68" /><circle cx="80" cy="212" r="4" /><circle cx="126" cy="220" r="4" />
        <circle cx="142" cy="256" r="4" /><circle cx="132" cy="292" r="4" /><circle cx="92" cy="306" r="4" />
        <circle cx="52" cy="302" r="4" /><circle cx="38" cy="270" r="4" /><circle cx="44" cy="244" r="4" fill="#558B68" />
        <circle cx="194" cy="238" r="4" /><circle cx="232" cy="228" r="4" /><circle cx="270" cy="240" r="4" fill="#558B68" />
        <circle cx="284" cy="274" r="4" /><circle cx="274" cy="310" r="4" /><circle cx="228" cy="322" r="4" />
        <circle cx="186" cy="310" r="4" fill="#558B68" /><circle cx="176" cy="280" r="4" />
        <circle cx="336" cy="224" r="4" /><circle cx="370" cy="210" r="4" fill="#558B68" /><circle cx="414" cy="224" r="4" />
        <circle cx="424" cy="258" r="4" /><circle cx="418" cy="298" r="4" /><circle cx="378" cy="310" r="4" />
        <circle cx="326" cy="300" r="4" /><circle cx="318" cy="266" r="4" fill="#558B68" />
        <circle cx="158" cy="148" r="3" /><circle cx="158" cy="204" r="3" />
        <circle cx="302" cy="148" r="3" /><circle cx="302" cy="204" r="3" />
        <circle cx="152" cy="176" r="3" /><circle cx="308" cy="176" r="3" />
        <circle cx="230" cy="170" r="3" /><circle cx="200" cy="170" r="3" /><circle cx="260" cy="170" r="3" />
        <circle cx="100" cy="176" r="3" /><circle cx="360" cy="176" r="3" />
      </g>
      <g fill="#558B68" stroke="#2F2F31" strokeWidth="1.8">
        <circle cx="88" cy="92" r="10" /><circle cx="230" cy="70" r="10" /><circle cx="370" cy="92" r="10" />
        <circle cx="88" cy="260" r="10" /><circle cx="230" cy="278" r="10" /><circle cx="370" cy="260" r="10" />
      </g>
    </svg>
  );
}

function RetCurve({ from, to, variant = "default" }) {
  const d = RET_CURVE_PATHS[variant] || RET_CURVE_PATHS.default;
  return (
    <div className="ret-curve r-full-bleed r-no-pad" style={{ background: from }}>
      <svg viewBox="0 0 1440 100" preserveAspectRatio="none"><path d={d} fill={to} /></svg>
    </div>
  );
}

function RetHero({ eyebrow, h1, sub, primaryCta = "Start Free Trial", primaryAction, secondaryCta, secondaryAction, fine = "14-day free trial. No credit card required.", setPage, eyebrowStyle }) {
  return (
    <section className="ret-hero r-full-bleed">
      <div className="ret-hero-inner">
        {eyebrow && <div className={"ret-eyebrow" + (eyebrowStyle === "purple" ? " ret-eyebrow-purple" : "")}>{eyebrow}</div>}
        <h1 className="ret-h1">{h1}</h1>
        {sub && <p className="ret-sub">{sub}</p>}
        {(primaryCta || secondaryCta) && (
          <div className="ret-cta-row">
            {primaryCta && <button className="ret-btn-primary" onClick={() => primaryAction && setPage(primaryAction)}>{primaryCta}</button>}
            {secondaryCta && <button className="ret-btn-secondary" onClick={() => secondaryAction && setPage(secondaryAction)}>{secondaryCta}</button>}
          </div>
        )}
        {fine && <p className="ret-hero-fine">{fine}</p>}
      </div>
    </section>
  );
}

function RetFinalCTA({ h2, sub, setPage, primaryCta = "Start Free Trial", primaryAction = "signup", mailto = null, fine = "14-day free trial. No credit card required." }) {
  return (
    <section className="ret-section ret-bg-cream r-full-bleed" style={{ textAlign: "center" }}>
      <div className="ret-section-inner">
        <h2 className="ret-h2">{h2}</h2>
        {sub && <p className="ret-sub" style={{ margin: "0 auto 28px" }}>{sub}</p>}
        <div className="ret-cta-row">
          <button className="ret-btn-primary" onClick={() => { if (mailto) { window.location.href = `mailto:${mailto}`; } else { setPage(primaryAction); } }}>{primaryCta}</button>
        </div>
        {fine && <p className="ret-hero-fine">{fine}</p>}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// CONTACT
// ═══════════════════════════════════════════════════════════════
function Contact({ setPage }) {
  return (
    <div>
      <RetPageStyles />
      <section className="r-full-bleed" style={{ background: "#F2EEE8", minHeight: "calc(100vh - 80px)", padding: "60px 20px 80px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <h1 style={{ fontSize: "clamp(40px, 5vw, 56px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.05, margin: "0 0 16px", color: C.text }}>Get in Touch</h1>
            <p style={{ fontSize: 17, color: C.textSec, lineHeight: 1.55, maxWidth: 520, margin: "0 auto" }}>
              Questions, feedback, partnerships, or just want to talk retention.
            </p>
          </div>

          <div style={{ background: "#fff", borderRadius: 18, padding: "36px 36px 32px", boxShadow: "0 1px 3px rgba(30,38,31,0.04)", marginBottom: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 8 }}>Name</label>
                <input
                  type="text"
                  id="contact-name"
                  placeholder="Your name"
                  style={{ width: "100%", padding: "14px 16px", border: "1.5px solid " + C.borderLight, borderRadius: 12, fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box", background: "#fff" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 8 }}>Email</label>
                <input
                  type="email"
                  id="contact-email"
                  placeholder="you@agency.com"
                  style={{ width: "100%", padding: "14px 16px", border: "1.5px solid " + C.borderLight, borderRadius: 12, fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box", background: "#fff" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 8 }}>Message</label>
                <textarea
                  placeholder="What's on your mind?"
                  id="contact-message"
                  rows={5}
                  style={{ width: "100%", padding: "14px 16px", border: "1.5px solid " + C.borderLight, borderRadius: 12, fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box", background: "#fff", resize: "vertical", minHeight: 120 }}
                />
              </div>
              <button className="ret-btn-primary" style={{ width: "100%", marginTop: 4 }} onClick={() => {
                const name = (document.getElementById("contact-name") || {}).value || "";
                const email = (document.getElementById("contact-email") || {}).value || "";
                const message = (document.getElementById("contact-message") || {}).value || "";
                const subject = encodeURIComponent(name ? `Message from ${name}` : "Message from the Retayned site");
                const body = encodeURIComponent(`${message}\n\n— ${name}${email ? ` (${email})` : ""}`);
                window.location.href = `mailto:hello@retayned.com?subject=${subject}&body=${body}`;
              }}>Send Message</button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "Email", value: "hello@retayned.com" },
              { label: "Based in", value: "Washington, DC" },
              { label: "Response time", value: "Usually within a few hours" },
            ].map(item => (
              <div key={item.label} style={{ background: "#fff", borderRadius: 14, padding: "18px 22px", boxShadow: "0 1px 3px rgba(30,38,31,0.04)" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 14.5, color: C.textSec }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <Footer setPage={setPage} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════
function Login({ setPage }) {
  // REAL SIGNUP LIVES IN THE APP (Jul 2026). This page used to be a
  // dead mockup — inputs with no state, a button wired to nothing.
  // Every visitor who "signed up" here was silently discarded. Now it
  // forwards to app.retayned.com (Supabase auth). The 400ms delay
  // gives the Meta Lead pixel beacon time to leave.
  useEffect(() => {
    const t = setTimeout(() => { window.location.replace("https://app.retayned.com/?src=site_login"); }, 400);
    return () => clearTimeout(t);
  }, []);
  return (
    <div>
      <RetPageStyles />
      <section className="r-full-bleed" style={{ background: "#F2EEE8", minHeight: "calc(100vh - 80px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.04em", color: C.primary, fontFamily: "system-ui, -apple-system, sans-serif" }}>Retayned.</div>
          <div style={{ fontSize: 15, color: C.textSec, marginTop: 10 }}>Taking you to sign in…</div>
        </div>
      </section>
    </div>
  );
}
function Signup({ setPage }) {
  // REAL SIGNUP LIVES IN THE APP (Jul 2026). This page used to be a
  // dead mockup — inputs with no state, a button wired to nothing.
  // Every visitor who "signed up" here was silently discarded. Now it
  // forwards to app.retayned.com (Supabase auth). The 400ms delay
  // gives the Meta Lead pixel beacon time to leave.
  useEffect(() => {
    const t = setTimeout(() => { window.location.replace("https://app.retayned.com/?src=site_signup"); }, 400);
    return () => clearTimeout(t);
  }, []);
  return (
    <div>
      <RetPageStyles />
      <section className="r-full-bleed" style={{ background: "#F2EEE8", minHeight: "calc(100vh - 80px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.04em", color: C.primary, fontFamily: "system-ui, -apple-system, sans-serif" }}>Retayned.</div>
          <div style={{ fontSize: 15, color: C.textSec, marginTop: 10 }}>Taking you to your free trial…</div>
        </div>
      </section>
    </div>
  );
}
const FAQ_DATA = [
  {
    label: "About Retayned",
    questions: [
      { q: "What is Retayned?", a: "Retayned is a new client relationship management platform built for agencies, freelancers, consultants, stylists, coaches...anyone who manages ongoing client relationships. It combines AI-powered retention scoring with communication signal tracking and 10+ years of proprietary client retention data and expertise. Retayned doesn't just tell you which clients need attention — it gives you the exact action steps and script to turn a potential loss into lifelong business." },
      { q: "How is this different from a CRM?", a: "Traditional CRMs track deals and contacts. Retayned tracks the health of relationships. It profiles how each client communicates, monitors engagement velocity across your channels, and uses AI to predict churn well before it happens. A CRM tells you who your clients are. Retayned tells you how your clients are feeling and what to do to make things better." },
      { q: "What does the AI actually do?", a: "Rai ingests several inputs — relationship profiles, health checks, velocity signals, deliverable tracking, billing, and more — then generates personalized action points. It tells you who to talk to today, what the real problem is, and gives you an opening to delight your clients." },
      { q: "Who is this built for?", a: "Anyone who manages one or more ongoing client relationships. Agency owners, freelancers, consultants, stylists, coaches, account managers. If losing a client changes your month, quarter, or year, Retayned is for you." },
    ],
  },
  {
    label: "Pricing & Plans",
    questions: [
      { q: "What does it cost?", a: "Flat, predictable pricing — no per-client fees. Solo is $29/mo for freelancers and consultants (25 managed clients, unlimited advisory). Team is $99/mo for human teams and agencies: 5 seats included, $19 per extra seat, no client cap. Both include every feature — Rai chats (unlimited within fair-use limits), dynamic scoring, health checks, integrations — and a 14-day free trial with no credit card required. Enterprise (for autonomous agents and books at massive scale) is custom; contact us." },
    ],
  },
  {
    label: "Getting Started",
    questions: [
      { q: "Do I need to connect my email or Slack?", a: "Nope. The core platform — profiles, health checks, AI coaching, and deliverable tracking — works without any integrations. Channel connections unlock additional velocity detection and automated signals, but you can start without them and add integrations when you're ready." },
      { q: "How long does setup take?", a: "Minutes. Add your clients, score their relationship profiles, and you're in. The AI starts generating insights immediately. Connect every channel take a few clicks each when you're ready for them." },
      { q: "Is my client data safe?", a: "Yes. We access communication metadata (timestamps, response frequency) — not message content. Your data is encrypted in transit and at rest, hosted on secure US infrastructure. We don't sell your data or use it to train AI models. You own everything you put in." },
    ],
  },
];

function FAQ({ dark = false }) {
  const [open, setOpen] = useState(null);
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {FAQ_DATA.map((group, gi) => (
        <div key={gi} style={{ marginBottom: 32 }}>
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: dark ? "rgba(255,255,255,0.6)" : C.primary }}>{group.label}</span>
          </div>
          {group.questions.map((item, qi) => {
            const key = `${gi}-${qi}`;
            const isOpen = open === key;
            return (
              <div key={key} onClick={() => setOpen(isOpen ? null : key)} style={{
                cursor: "pointer",
                borderBottom: "1px solid " + (dark ? "rgba(255,255,255,0.12)" : C.borderLight),
                padding: "22px 4px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                  <h3 style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em", color: dark ? "#fff" : C.text, lineHeight: 1.3, margin: 0 }}>{item.q}</h3>
                  <span style={{ fontSize: 22, fontWeight: 400, color: dark ? "rgba(255,255,255,0.5)" : C.textMuted, transform: isOpen ? "rotate(45deg)" : "none", transition: "transform 0.2s ease", lineHeight: 1, flexShrink: 0, marginTop: 2 }}>+</span>
                </div>
                {isOpen && (
                  <p style={{ fontSize: 15, color: dark ? "rgba(255,255,255,0.72)" : C.textSec, lineHeight: 1.65, marginTop: 14 }}>{item.a}</p>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function FAQPage({ setPage }) {
  return (
    <div>
      <RetPageStyles />
      <RetHero
        eyebrow="Common questions"
        h1="Frequently asked."
        sub="The answers to what people ask us most."
        primaryCta={null}
        secondaryCta={null}
        fine={null}
        setPage={setPage}
      />
      <section className="ret-section ret-bg-cream r-full-bleed" style={{ paddingTop: 0 }}>
        <div className="ret-section-inner" style={{ maxWidth: 1100 }}>
          <FAQ />
        </div>
      </section>
      <RetFinalCTA
        h2="Still have questions?"
        sub="Email us directly — we respond within a business day."
        primaryCta="Send Message"
        mailto="hello@retayned.com"
        fine={null}
        setPage={setPage}
      />
      <Footer setPage={setPage} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PRIVACY
// ═══════════════════════════════════════════════════════════════
function Privacy({ setPage }) {
  return (
    <div>
      <RetPageStyles />
      <RetHero
        eyebrow="Legal"
        h1="Privacy Policy"
        sub="Last updated: May 23, 2026."
        primaryCta={null}
        secondaryCta={null}
        fine={null}
        setPage={setPage}
      />
      <section className="ret-section ret-bg-cream r-full-bleed" style={{ paddingTop: 0 }}>
        <div className="ret-section-inner" style={{ maxWidth: 1100 }}>
          <div className="ret-card" style={{ padding: "44px 40px" }}>
            <div className="ret-prose">
              <p>Retayned, operated by Maniac Digital, LLC ("Retayned," "we," "our," "us"), is committed to protecting the privacy of our users and the clients they manage through the Service. This Privacy Policy describes how we collect, use, store, and share information when you use the Retayned platform, website (retayned.com), and related services (collectively, the "Service").</p>
              <p>Retayned is designed for freelancers, consultants, and agencies to manage their relationships with their own clients. Because of this, the Service involves two distinct categories of people: (1) <strong>Users</strong> — the account holders who subscribe to Retayned, and (2) <strong>Clients</strong> — the third parties whose information Users enter into the Service. This policy explains how we handle data about both.</p>

              <h3>1. Roles and Responsibilities</h3>
              <p><strong>You are the controller of your Client Data.</strong> When you enter information about your clients into the Service, you act as the data controller for that information under applicable privacy laws (including GDPR, UK GDPR, and CCPA). Retayned acts as your data processor and processes Client Data solely on your behalf and according to your instructions as set out in these terms and our Data Processing Addendum.</p>
              <p><strong>This means you are responsible for:</strong> having a lawful basis to collect and process your clients' information (typically legitimate interest for B2B client management, but this is your determination to make); providing any notices your clients are entitled to under applicable law; obtaining any consents required in your jurisdiction; and responding to requests from your clients to access, correct, or delete information about them.</p>
              <p><strong>We will support you</strong> by providing tools to export, edit, and delete Client Data, and by routing any direct requests we receive from your clients to you for response. A Data Processing Addendum is available on request at privacy@retayned.com.</p>

              <h3>2. Information We Collect</h3>
              <p><strong>Account Information.</strong> When you register, we collect your name, email address, company name, and billing information. If you sign up via Google OAuth, we receive your name and email from Google. We do not store your Google password.</p>
              <p><strong>Client Data.</strong> You enter information about your clients into the Service, including names, contact information, relationship profiles, health check responses, revenue and billing records, notes, logged touchpoints, and other client-related data ("Client Data"). You control what Client Data you provide.</p>
              <p><strong>AI-Generated Data.</strong> The Service produces derived data about your clients, including retention scores, profile scores, archetype classifications, suggested daily actions, and conversation history with the Rai advisor ("AI-Generated Data"). This data is stored in association with the relevant client record.</p>
              <p><strong>Integration Data.</strong> Retayned offers an opt-in integration with Google Calendar, and may offer additional opt-in integrations in future (such as Gmail or Slack). If you choose to connect Google Calendar, we receive your Google account identifier and, with your authorization, read access to your calendar events via the <code>https://www.googleapis.com/auth/calendar.readonly</code> scope. We use this data only to display upcoming meetings inside Retayned, link calendar events to client records you have created, and inform Rai's preparation suggestions for those meetings. We do not modify your calendar, we do not access events the API does not return, and we do not read email or other Google services. Integrations are opt-in, can be disconnected at any time from your account settings, and disconnection deletes all stored Google event data within 30 days. See Section 5 below for additional protections specific to Google user data.</p>
              <p><strong>Usage Data.</strong> We automatically collect information about how you interact with the Service, including pages viewed, features used, session duration, device type, browser type, IP address, and referring URLs.</p>
              <p><strong>Cookies and Tracking.</strong> We use essential cookies to maintain your session and preferences, and analytics tools to understand usage patterns. We do not use third-party advertising cookies. You may disable non-essential cookies through your browser settings.</p>

              <h3>3. How We Use Your Information</h3>
              <p>We use the information we collect to: provide, operate, and maintain the Service; generate retention scores, health assessments, and AI-powered recommendations through Rai; process payments and manage your subscription; send transactional communications (account confirmations, billing notices, security alerts); respond to support requests; and comply with legal obligations.</p>
              <p>We do not sell, rent, or lease your personal information or Client Data to third parties. We do not use your Client Data for advertising purposes.</p>

              <h3>4. How Rai and AI Features Work</h3>
              <p><strong>What Rai does.</strong> Rai is Retayned's AI advisor. When you interact with Rai or when the Daily Sweep runs, Client Data relevant to the request — relationship profiles, scores, recent notes, revenue data, and recent Rai conversation history — is sent to a third-party AI provider (currently Anthropic's Claude API) to generate recommendations, suggestions, and responses.</p>
              <p><strong>Data minimization.</strong> We send only the Client Data necessary to generate a relevant response. We do not send your full account, your billing details, your credentials, or data about clients other than those relevant to the request.</p>
              <p><strong>Zero retention at the AI provider.</strong> Our AI provider is contractually prohibited from retaining your Client Data beyond the duration of the API request and from using it for model training. We rely on Anthropic's zero-retention posture for API traffic.</p>
              <p><strong>Rai conversations.</strong> When you chat with Rai about a specific client, the conversation is stored in Retayned so Rai can maintain context across sessions. Conversations are capped at a rolling window (currently 20 messages per client) and are stored against that client record. Individual messages are automatically purged 180 days after they are sent, on a rolling per-message basis, so Rai's context reflects only recent relationship history. You can delete a Rai conversation at any time from the client profile. Deleting a client deletes all associated Rai conversations and AI-Generated Data within 30 days.</p>
              <p><strong>Daily Sweep outputs.</strong> Rai generates suggested tasks for your clients on a scheduled basis. These suggestions, along with whether you promoted or dismissed them, are stored as history to improve suggestion quality for you over time and to avoid repeating completed suggestions. This history is treated as Client Data and is deleted when the associated client is deleted.</p>
              <p><strong>AI Outputs are not professional advice.</strong> Retention scores, suggestions, scripts, and Rai responses are informational. They do not constitute legal, financial, or business advice, and you should exercise your own judgment before acting on them.</p>

              <h3>5. Google User Data</h3>
              <p>This section describes how Retayned handles user data received from Google APIs. It is in addition to, and not in place of, the rest of this Privacy Policy.</p>
              <p><strong>Limited Use compliance.</strong> Retayned's use and transfer of information received from Google APIs to any other app will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>
              <p><strong>Scopes we request.</strong> Retayned currently requests one Google scope: <code>https://www.googleapis.com/auth/calendar.readonly</code>. This grants read-only access to a User's Google Calendar events. We do not request write, delete, or share scopes for Google Calendar, and we do not request any other Google scope (Gmail, Drive, Contacts, etc.).</p>
              <p><strong>How we use Google user data.</strong> Google Calendar data is used exclusively to provide and improve user-facing features of the Service. Specifically:</p>
              <ul>
                <li>To show your upcoming meetings inside Retayned, in your Today view and on individual client profiles.</li>
                <li>To link calendar events to client records you have created in Retayned, so the system understands which meetings relate to which clients.</li>
                <li>To inform Rai's meeting preparation suggestions (for example, surfacing recent notes about a client before an upcoming meeting with them).</li>
              </ul>
              <p><strong>How we do <em>not</em> use Google user data.</strong></p>
              <ul>
                <li>We do <strong>not</strong> use Google user data to train, develop, fine-tune, or improve any generalized AI or machine learning model. Calendar event data is not sent to our AI provider as part of any model training pipeline.</li>
                <li>We do <strong>not</strong> sell, rent, license, or otherwise transfer Google user data to data brokers, ad networks, or third parties for advertising or marketing purposes.</li>
                <li>We do <strong>not</strong> transfer Google user data to third parties except (a) as necessary to provide or improve user-facing features of the Service (for example, transmitting calendar metadata to our cloud infrastructure provider for processing and storage), (b) to comply with applicable law, or (c) as part of a merger, acquisition, or sale of assets, with notice to affected Users.</li>
                <li>We do <strong>not</strong> allow humans to read Google user data unless we have your affirmative consent for specific events, it is necessary for security purposes (for example, investigating abuse), or it is necessary to comply with applicable law.</li>
              </ul>
              <p><strong>Storage and processing of Google user data.</strong> Calendar event data is stored in our database (currently Supabase, encrypted at rest with AES-256) and is accessible only to the User who connected the integration and to Retayned personnel with a legitimate operational need. Calendar event data is included in your account's regular data retention and deletion practices (see Section 9).</p>
              <p><strong>Disconnecting Google Calendar.</strong> You may disconnect Google Calendar at any time from your Retayned account settings, or by revoking access at <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">your Google Account permissions page</a>. Disconnection stops further data retrieval immediately and deletes stored Google event data from your Retayned account within 30 days.</p>
              <p><strong>Questions specific to Google data.</strong> Contact <strong>privacy@retayned.com</strong> with "Google data" in the subject line.</p>

              <h3>6. Use of Aggregated Data</h3>
              <p>We may use aggregated, de-identified patterns derived from Service usage to improve the Service — including refining scoring weights, archetype definitions, and suggestion quality. Aggregated data of this kind is stripped of identifiers that would allow it to be linked back to you, your clients, or any specific account, and is used in the aggregate only.</p>
              <p>We do not use your Client Data, your Rai conversations, your AI-Generated Data, or your Google user data to train, fine-tune, or improve any third-party AI or machine learning models. Our AI API providers are contractually prohibited from doing so.</p>

              <h3>7. Data Sharing and Third Parties</h3>
              <p>We share information only in the following circumstances: with service providers who help us operate the Service, subject to contractual obligations to protect your data; with your consent or at your direction; to comply with applicable law, regulation, legal process, or governmental request; to protect the rights, safety, or property of Retayned, our users, or the public; and in connection with a merger, acquisition, or sale of assets, in which case you will be notified of any change in data practices.</p>
              <p><strong>Categories of service providers we use:</strong></p>
              <ul>
                <li><strong>Anthropic</strong> — AI API provider that powers Rai. Subject to a zero-retention API agreement; does not retain or train on your data.</li>
                <li><strong>Stripe</strong> — payment processor for subscriptions and billing.</li>
                <li><strong>Supabase</strong> — database, authentication, and serverless functions infrastructure (data stored encrypted at rest).</li>
                <li><strong>Vercel</strong> — web hosting for the marketing site and the Retayned app.</li>
                <li><strong>Google</strong> — calendar integration (only when you connect it); see Section 5.</li>
                <li><strong>Transactional email</strong> — for account confirmations and security notices.</li>
                <li><strong>Privacy-respecting analytics</strong> — for aggregated product analytics; no third-party advertising cookies.</li>
              </ul>
              <p>All service providers are bound by data processing agreements that prohibit them from using your data for their own purposes. A current list of sub-processors is available on request at privacy@retayned.com.</p>

              <h3>8. Data Security</h3>
              <p>We implement industry-standard security measures to protect your data, including: encryption of data in transit (TLS 1.2+) and at rest (AES-256); secure authentication with password hashing and optional OAuth; row-level access controls in our database limiting access between accounts; administrative access controls limiting employee access to production data; regular security reviews of our infrastructure and dependencies; and secure API communication with all third-party providers.</p>
              <p>No method of transmission or storage is 100% secure. While we strive to protect your data, we cannot guarantee absolute security.</p>
              <p><strong>Breach notification.</strong> In the event of a data breach affecting your personal information or Client Data, we will notify affected Users without undue delay and, where required by applicable law, within the statutory timeframe (typically 72 hours under GDPR). Our notice will describe the nature of the breach, the categories and approximate number of records affected, likely consequences, and the steps we are taking to address it.</p>

              <h3>9. Data Retention and Deletion</h3>
              <p><strong>Active accounts.</strong> We retain Account Information, Client Data, and AI-Generated Data for as long as your account is active.</p>
              <p><strong>Account cancellation.</strong> If you cancel your subscription, your data will be retained in an inactive state for 30 days to allow for reactivation, after which it will be permanently deleted within 90 days.</p>
              <p><strong>Deleting a client.</strong> When you delete a client from your portfolio, all associated Client Data, AI-Generated Data, Rai conversations, and suggestion history for that client will be deleted within 30 days. Backups may retain deleted data for an additional period not to exceed 60 days, after which it is purged from backup media.</p>
              <p><strong>Rai conversation messages.</strong> Individual Rai conversation messages are automatically deleted 180 days after they are sent, on a rolling per-message basis, regardless of whether the associated client is still in your portfolio.</p>
              <p><strong>Immediate deletion.</strong> You may request immediate deletion of your account and all associated data at any time by contacting privacy@retayned.com.</p>
              <p><strong>Legal retention.</strong> Certain data may be retained as required by law (for example, billing records for tax purposes) even after account deletion.</p>
              <p><strong>Aggregated data.</strong> Aggregated, de-identified data that cannot be used to identify you or your clients may be retained indefinitely for product improvement purposes.</p>

              <h3>10. Your Rights</h3>
              <p>Depending on your jurisdiction, you may have the right to: access, correct, or delete your personal information; export your data in a portable format; restrict or object to certain processing; withdraw consent where processing is based on consent; and lodge a complaint with a supervisory authority. These rights are recognized by, among others, the EU General Data Protection Regulation (GDPR), the UK GDPR, the California Consumer Privacy Act and CPRA (CCPA), and the District of Columbia's Consumer Personal Data Privacy Act.</p>
              <p>To exercise any of these rights regarding information about <strong>you</strong> (as a User), contact us at privacy@retayned.com. We will respond within 30 days.</p>
              <p><strong>Requests from your clients.</strong> If you are a third-party client (not a User) and you believe a Retayned User has entered information about you into the Service, please contact that User directly — they are the controller of information about you and are responsible for responding to your request. If you are unable to identify or reach the relevant User, you may contact us at privacy@retayned.com and we will make reasonable efforts to route your request to the appropriate User. We do not independently access, modify, or delete client records without instruction from the controlling User, except where required by law.</p>

              <h3>11. International Data Transfers</h3>
              <p>Retayned is based in Washington, DC, United States. If you access the Service from outside the United States, your information may be transferred to, stored, and processed in the United States. By using the Service, you consent to the transfer of your information to the United States, where data protection laws may differ from those in your jurisdiction. For transfers from the EEA, UK, or Switzerland, we rely on Standard Contractual Clauses or equivalent safeguards as set out in our Data Processing Addendum.</p>

              <h3>12. Children's Privacy</h3>
              <p>The Service is not directed to individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that we have collected data from a child, we will delete it promptly.</p>

              <h3>13. Enterprise and API Access</h3>
              <p>Retayned offers an Enterprise product with additional access surfaces, including a managed agent API. Enterprise customers are governed by a separate agreement that may include additional or modified data processing terms. The practices described in this policy apply to the self-serve Service unless superseded by an Enterprise agreement.</p>

              <h3>14. Changes to This Policy</h3>
              <p>We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy on the Service and updating the "Last updated" date, and, for material changes, by email or in-app notice. Your continued use of the Service after any changes constitutes acceptance of the updated policy.</p>

              <h3>15. Contact Us</h3>
              <p>If you have questions about this Privacy Policy or our data practices, contact us at:</p>
              <p><strong>privacy@retayned.com</strong><br />Maniac Digital, LLC<br />Washington, DC, United States</p>
            </div>
          </div>
        </div>
      </section>
      <Footer setPage={setPage} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TERMS
// ═══════════════════════════════════════════════════════════════
function Terms({ setPage }) {
  return (
    <div>
      <RetPageStyles />
      <RetHero
        eyebrow="Legal"
        h1="Terms of Service"
        sub="Last updated: May 23, 2026."
        primaryCta={null}
        secondaryCta={null}
        fine={null}
        setPage={setPage}
      />
      <section className="ret-section ret-bg-cream r-full-bleed" style={{ paddingTop: 0 }}>
        <div className="ret-section-inner" style={{ maxWidth: 1100 }}>
          <div className="ret-card" style={{ padding: "44px 40px" }}>
            <div className="ret-prose">
              <p>These Terms of Service ("Terms") govern your access to and use of the Retayned platform, website, and related services (collectively, the "Service") provided by Maniac Digital, LLC ("Retayned," "we," "our," "us"). By creating an account or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.</p>

              <h3>1. Eligibility and Account</h3>
              <p>You must be at least 18 years old and have the legal authority to enter into these Terms. If you are using the Service on behalf of an organization, you represent that you have the authority to bind that organization to these Terms. You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You agree to notify us immediately of any unauthorized use of your account.</p>
              <p>You agree to provide accurate, current, and complete information during registration and to keep your account information updated.</p>

              <h3>2. The Service</h3>
              <p>Retayned provides client relationship management tools including AI-powered retention scoring, communication signal analysis, health check assessments, suggested daily actions, a client relationship advisor ("Rai"), and related features. The Service is designed to help you manage and strengthen relationships with your own clients. We reserve the right to modify, suspend, or discontinue any part of the Service at any time with reasonable notice.</p>
              <p>The Service offers an opt-in integration with Google Calendar (read-only) and may offer additional opt-in integrations in future. Your use of any such integration is also subject to the terms and privacy policies of the third-party provider, and to the Google API Services User Data Policy where Google integrations are concerned (see our Privacy Policy, Section 5).</p>

              <h3>3. Your Data and Your Responsibilities</h3>
              <p><strong>Ownership.</strong> You retain full ownership of all data you enter into the Service, including client information, relationship profiles, health check responses, billing records, notes, and any other content you provide ("Your Data"). We do not claim any intellectual property rights over Your Data.</p>
              <p><strong>License to Us.</strong> You grant Retayned a limited, non-exclusive, worldwide license to use, process, and store Your Data solely for the purpose of providing the Service to you and, in de-identified and aggregated form only, for improving the Service. This license terminates when you delete Your Data or your account.</p>
              <p><strong>You are the data controller.</strong> You are the data controller for any information you enter about your clients, and Retayned acts as your data processor. You represent and warrant that:</p>
              <ul>
                <li>You have a lawful basis under applicable privacy laws (including GDPR, UK GDPR, CCPA, and any other applicable regime) to enter your clients' information into the Service and to permit its processing as described in these Terms and the Privacy Policy;</li>
                <li>You have provided any notices and obtained any consents required of you in your jurisdiction;</li>
                <li>Entering your clients' information into the Service does not violate any confidentiality agreement, non-disclosure agreement, contract with your clients, or other legal obligation;</li>
                <li>You will respond in a timely manner to any request we route to you from one of your clients exercising rights under applicable privacy law.</li>
              </ul>
              <p><strong>Data Portability and Deletion.</strong> You may export Your Data at any time while your account is active. You may delete individual client records, Rai conversations, or your entire account at any time. Retention and deletion timelines are described in the Privacy Policy. A Data Processing Addendum is available on request at privacy@retayned.com.</p>
              <p><strong>Indemnification for your representations.</strong> You agree to indemnify Retayned for any claim, regulatory action, or loss arising from your breach of the representations in this Section 3, including claims brought by your clients or by privacy regulators in connection with your processing of your clients' data.</p>

              <h3>4. AI-Powered Features</h3>
              <p><strong>Rai and AI Outputs.</strong> The Service includes AI-powered features, including the Rai advisor, retention scoring, archetype classification, Daily Sweep suggestions, and conversation scripts. These features are powered by third-party AI models accessed via API. AI-generated recommendations, scores, scripts, and suggestions ("AI Outputs") are provided for informational purposes only and do not constitute professional advice of any kind — including legal, financial, tax, or business advice.</p>
              <p><strong>No Guarantees.</strong> AI Outputs are generated based on the data you provide and may not be accurate, complete, or appropriate for your specific situation. You are solely responsible for evaluating and acting on AI Outputs. Retayned does not guarantee any specific business outcome, client retention rate, revenue result, or other outcome from using the Service or following AI Outputs.</p>
              <p><strong>No Training on Your Data.</strong> We do not use Your Data to train, fine-tune, or improve any third-party AI or machine learning models. Your Data is processed in real-time through the API to generate responses and is not retained by our AI providers beyond the duration of the API request, in accordance with their data processing agreements.</p>
              <p><strong>Aggregated, de-identified improvement.</strong> We reserve the right to use aggregated, de-identified patterns derived from Service usage to improve our own scoring logic, archetype library, and suggestion quality. This aggregated data cannot be used to identify you, your clients, or any specific account. This activity is not "model training" of any third-party AI model.</p>
              <p><strong>Rai Conversations.</strong> Rai may store recent conversation history against a client record so it can maintain context across sessions. You can delete these conversations at any time. We do not use the content of Rai conversations for any purpose other than providing the Service to you and, in de-identified and aggregated form, improving the Service as described above.</p>
              <p><strong>Human Oversight.</strong> You acknowledge that all actions taken based on AI Outputs are your own decisions. You should exercise your own professional judgment before acting on any recommendation provided by the Service, including before sending communications to clients, changing pricing, or terminating a client relationship.</p>

              <h3>5. Payment and Billing</h3>
              <p><strong>Subscription Plans.</strong> The Service is offered on a subscription basis. Current pricing is displayed on our pricing page. Prices are subject to change with 30 days' notice. Subscription fees are non-refundable except as described below.</p>
              <p><strong>Subscription pricing.</strong> Retayned is offered on a flat monthly subscription basis across the plans described on our pricing page. The Agency plan includes a set number of team seats; additional seats beyond the included allotment are charged at the per-seat rate shown on the pricing page in effect at the start of each billing period.</p>
              <p><strong>Free Trial.</strong> We may offer a free trial period. At the end of the trial, your subscription will begin automatically unless you cancel before the trial ends. We will notify you before charging.</p>
              <p><strong>Billing.</strong> Fees are billed on a recurring basis (monthly or annual, depending on your plan) through Stripe. You authorize us to charge your payment method on file for all applicable fees, including any additional seat charges on the Agency plan.</p>
              <p><strong>Cancellation.</strong> You may cancel your subscription at any time. Cancellation takes effect at the end of your current billing period. You will retain access to the Service until then. We do not provide prorated refunds for partial billing periods.</p>
              <p><strong>Refunds.</strong> If you are dissatisfied with the Service, you may request a refund within 14 days of your first paid subscription charge. Refund requests after 14 days are handled at our discretion.</p>

              <h3>6. Acceptable Use</h3>
              <p>You agree not to: use the Service for any unlawful purpose or in violation of any applicable law; upload or transmit malicious code, viruses, or harmful data; attempt to gain unauthorized access to the Service, other accounts, or our systems; interfere with or disrupt the Service or its infrastructure; resell, sublicense, or redistribute the Service without our written consent; use the Service to store or process data you do not have a lawful basis to process; enter special-category personal data (including health, biometric, or racial/ethnic data) about your clients unless you have a specific lawful basis and have notified us in advance; use automated tools (bots, scrapers) to access the Service except through our published APIs; or use the Service to harass, abuse, or harm any person, including by using AI Outputs to manipulate or coerce a client.</p>
              <p>We reserve the right to suspend or terminate your account for violations of these terms, with notice where practicable.</p>

              <h3>7. Intellectual Property</h3>
              <p>The Service, including its design, code, features, documentation, branding, archetype library, scoring methodology, and all related intellectual property, is owned by Maniac Digital, LLC. You may not copy, modify, distribute, or create derivative works based on the Service without our written permission.</p>
              <p>The Retayned name, logo, "Rai," and related marks are trademarks of Maniac Digital, LLC. You may not use our trademarks without prior written consent.</p>

              <h3>8. Limitation of Liability</h3>
              <p>To the maximum extent permitted by law, Retayned and its officers, directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of revenue, lost profits, loss of clients, loss of data, or business interruption, arising out of or related to your use of the Service — whether based on warranty, contract, tort, or any other legal theory, even if we have been advised of the possibility of such damages.</p>
              <p>Our total aggregate liability for all claims arising out of or related to the Service shall not exceed the greater of (a) the total amount you paid to us in the twelve (12) months preceding the claim, or (b) one hundred U.S. dollars ($100).</p>
              <p>Some jurisdictions do not allow the exclusion of certain warranties or limitation of liability, so some of the above limitations may not apply to you.</p>

              <h3>9. Disclaimer of Warranties</h3>
              <p>The Service is provided "as is" and "as available" without warranties of any kind, either express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, title, and non-infringement. We do not warrant that the Service will be uninterrupted, error-free, or secure; that AI Outputs will be accurate, reliable, or suitable for your needs; that any defects will be corrected; or that the Service will meet your specific requirements or expectations.</p>

              <h3>10. Indemnification</h3>
              <p>You agree to indemnify, defend, and hold harmless Retayned and its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including reasonable attorneys' fees) arising out of or related to: your use of the Service; Your Data or your violation of any third party's rights (including claims brought by your clients); your violation of the representations in Section 3; your violation of these Terms; or any actions you take based on AI Outputs.</p>

              <h3>11. Enterprise Product</h3>
              <p>Retayned offers a separate Enterprise product with additional access surfaces, including a managed agent API. Use of the Enterprise product is governed by a separate agreement that may supersede or supplement these Terms. These Terms govern the self-serve Service unless an Enterprise agreement is in effect.</p>

              <h3>12. Termination</h3>
              <p>Either party may terminate these Terms at any time. You may terminate by canceling your subscription and deleting your account. We may terminate or suspend your access to the Service immediately, without prior notice, for conduct that we determine violates these Terms, is harmful to other users or the Service, or is otherwise objectionable.</p>
              <p>Upon termination, your right to use the Service ceases immediately. Sections that by their nature should survive termination — including ownership, your representations in Section 3, warranty disclaimers, indemnification, and limitation of liability — shall survive.</p>

              <h3>13. Dispute Resolution</h3>
              <p>These Terms are governed by the laws of the District of Columbia, United States, without regard to conflict of law provisions. Any disputes arising from these Terms or the Service shall be resolved through binding arbitration administered in Washington, DC, except that either party may seek injunctive relief in any court of competent jurisdiction. You agree to resolve disputes on an individual basis and waive any right to participate in a class action.</p>

              <h3>14. Changes to These Terms</h3>
              <p>We may update these Terms from time to time. We will notify you of material changes by posting the updated Terms on the Service, sending an email to your registered address, or through an in-app notification. Your continued use of the Service after changes take effect constitutes acceptance of the updated Terms. If you do not agree to the updated Terms, you must stop using the Service.</p>

              <h3>15. General Provisions</h3>
              <p><strong>Entire Agreement.</strong> These Terms, together with the Privacy Policy and any applicable Data Processing Addendum or Enterprise agreement, constitute the entire agreement between you and Retayned regarding the Service.</p>
              <p><strong>Severability.</strong> If any provision of these Terms is found to be unenforceable, the remaining provisions shall continue in full force and effect.</p>
              <p><strong>Waiver.</strong> Our failure to enforce any provision of these Terms shall not constitute a waiver of that provision.</p>
              <p><strong>Assignment.</strong> You may not assign your rights under these Terms without our consent. We may assign our rights at any time without notice.</p>

              <h3>16. Contact Us</h3>
              <p>If you have questions about these Terms, contact us at:</p>
              <p><strong>legal@retayned.com</strong><br />Maniac Digital, LLC<br />Washington, DC, United States</p>
            </div>
          </div>
        </div>
      </section>
      <Footer setPage={setPage} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PLATFORM — one page linking to all six feature pages
// ═══════════════════════════════════════════════════════════════
const PLATFORM_FEATURES = [
  { id: "feature-today", label: "Today", headline: "One page. Every priority.", sub: "Your Today tab is where Rai suggests and ranks the work that matters most — tasks sorted by an invisible priority engine that weighs relationship health against business value, so you always know who needs you right now." },
  { id: "feature-scoring", label: "Clients", headline: "Every relationship, scored and sorted.", sub: "Your client list, ranked by what matters. Each client carries a Retention Score built from 12 weighted dimensions and 20 combination signals — a 1–99 read on exactly where the relationship stands." },
  { id: "feature-health", label: "Health", headline: "Catch the drift before it becomes damage.", sub: "Structured check-ins that surface what you already sense but haven't said out loud. The twelve relationship dimensions assess health directly, so keeping a profile current keeps its score honest." },
  { id: "feature-rolodex", label: "Rolodex", headline: "Your pipeline is forward-looking.", sub: "Former clients aren't dead relationships — they're future revenue. The Rolodex tracks who left, how it ended, and whether they'd come back." },
  { id: "feature-referrals", label: "Referrals", headline: "Your best clients send you their friends.", sub: "Retayned tracks referral readiness based on loyalty, trust, and relationship depth. When a client is ready to refer, the system knows before you do." },
  { id: "feature-workers", label: "Workers", headline: "Delegate the task. Keep the relationship.", sub: "Hand a single task to a contractor or VA with one secure link — no account, no login, no access to the rest of your book. You stay the hub; the work flows outward." },
  { id: "feature-rai", label: "Rai", headline: "She writes the words you need when it matters most.", sub: "Rai is an AI advisor calibrated to your specific relationships. When you don't know what to say, Rai gives you the script." },
];

// ═══════════════════════════════════════════════════════════════
// FREELANCERS — full-page port of final/freelancer.html
// ═══════════════════════════════════════════════════════════════
function FreelancerWeb() {
  // 18 nodes around a center "you", with severity by index
  const nodes = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2 - Math.PI / 2;
    const r = 165 + Math.sin(i * 7.31) * 14;
    const sev = i % 7 === 0 ? "danger" : i % 5 === 0 ? "warning" : "success";
    return { x: 220 + Math.cos(a) * r, y: 220 + Math.sin(a) * r, sev };
  });
  const sevColor = { danger: C.danger, warning: C.warning, success: C.success };
  const sevR = { danger: 9, warning: 7, success: 6 };
  return (
    <div style={{ position: "relative", maxWidth: 480, margin: "0 auto" }}>
      <svg viewBox="0 0 440 440" style={{ width: "100%", height: "auto", display: "block" }}>
        <circle cx="220" cy="220" r="165" fill="none" stroke={C.borderLight} strokeDasharray="2 4" />
        <circle cx="220" cy="220" r="100" fill="none" stroke={C.borderLight} strokeDasharray="2 4" />
        {nodes.map((n, i) => (
          <line key={"l" + i} x1="220" y1="220" x2={n.x} y2={n.y} stroke={C.borderLight} strokeWidth="0.6" />
        ))}
        {nodes.map((n, i) => (
          <circle key={"n" + i} cx={n.x} cy={n.y} r={sevR[n.sev]} fill={sevColor[n.sev]} stroke="#F2EEE8" strokeWidth="2" />
        ))}
        <circle cx="220" cy="220" r="32" fill={C.primary} />
        <text x="220" y="226" textAnchor="middle" fill="#fff" fontFamily="'Caveat', cursive" fontSize="18" fontWeight="700">you</text>
      </svg>
      <div style={{ display: "flex", justifyContent: "center", gap: 18, fontSize: 11.5, color: C.textSec, marginTop: 12, flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 999, background: C.danger }} /> Drift signal</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 999, background: C.warning }} /> Cooling</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 999, background: C.success }} /> Healthy</span>
      </div>
    </div>
  );
}

function FrDayTimeline() {
  const wrapRef = useRef(null);
  const [progress, setProgress] = useState(0); // 0..1 how far the spine has "drawn"
  const moments = [
    { t: "08:47", h: "Open Today.", b: "Six tasks ranked by impact. The most expensive one — Rachel — is right at the top.", dot: C.btn },
    { t: "09:02", h: "Fix Rachel.", b: "Open Rai. Get four script options. Send the second one in your voice.", dot: C.btn },
    { t: "09:14", h: "Self-assigned tasks.", b: "A few of these may have slipped your mind last month. But today, you have Retayned.", dot: C.primary },
    { t: "12:30", h: "Lunch.", b: "A reply comes in from Rachel. The score moves on its own. Logged automatically.", dot: C.primary, chip: "38 → 46" },
    { t: "15:40", h: "A signal.", b: "Wes's renewal moved to 14 days. New task added to tomorrow with a checkup later.", dot: C.btn },
    { t: "18:00", h: "Close the laptop.", b: "Tomorrow's seven tasks will be ranked along with Rai's brief at midnight.", dot: C.primary },
  ];

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let raf = 0;
    const compute = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      const start = vh * 0.78;
      const end = vh * 0.40;
      const span = rect.height + (start - end);
      const scrolled = start - rect.top;
      const p = Math.max(0, Math.min(1, scrolled / span));
      setProgress(p);
    };
    const onScroll = () => { if (!raf) raf = window.requestAnimationFrame(compute); };
    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  const n = moments.length;
  return (
    <div ref={wrapRef} className="fr-timeline" style={{ maxWidth: 640, margin: "0 auto", position: "relative" }}>
      <div className="fr-timeline-spine" style={{ position: "absolute", left: 75, top: 14, bottom: 14, width: 2, background: C.border }} />
      <div className="fr-timeline-fill" style={{ position: "absolute", left: 75, top: 14, width: 2, background: C.primary, height: `calc((100% - 28px) * ${progress})`, transition: "height 120ms linear" }} />
      {moments.map((m, i) => {
        const lit = progress >= (i + 0.5) / n;
        return (
          <div key={i} className="fr-timeline-row" style={{ display: "grid", gridTemplateColumns: "64px 24px 1fr", alignItems: "start", padding: "16px 0" }}>
            <div style={{ fontFamily: "'Courier New', monospace", fontSize: 13, fontWeight: 800, color: C.btn, textAlign: "right", paddingTop: 2, letterSpacing: "0.02em" }}>{m.t}</div>
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 5 }}>
              <div style={{ width: 11, height: 11, borderRadius: "50%", background: lit ? m.dot : C.card, border: `2px solid ${C.bg}`, boxShadow: `0 0 0 2px ${lit ? m.dot : C.border}`, transition: "background 200ms ease, box-shadow 200ms ease", zIndex: 2 }} />
            </div>
            <div style={{ paddingLeft: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 800, fontSize: 16, color: C.text, letterSpacing: "-0.01em" }}>{m.h}</span>
                {m.chip && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: C.primarySoft, borderRadius: 100, padding: "3px 10px", fontSize: 12, fontWeight: 800, fontFamily: "'Courier New', monospace", color: C.success }}>{m.chip} ▲</span>}
              </div>
              <div style={{ fontSize: 14, color: C.textSec, marginTop: 5, lineHeight: 1.6 }}>{m.b}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Freelancers({ setPage }) {
  return (
    <div className="freelancer-page">
      <RetPageStyles />
      <style>{`
        @media (max-width: 760px) {
          .fr-week-grid { grid-template-columns: 1fr 1fr !important; }
          .fr-timeline-row { grid-template-columns: 52px 22px 1fr !important; }
          .fr-timeline-spine, .fr-timeline-fill { left: 62px !important; }
        }
        @media (max-width: 480px) {
          .fr-week-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* HERO */}
      <section className="ret-section r-full-bleed" style={{ background: "#F2EEE8", textAlign: "center", paddingTop: HERO_TOP, paddingBottom: 40 }}>
        <div className="ret-section-inner" style={{ maxWidth: 880 }}>
          <div className="ret-eyebrow">For freelancers, consultants & coaches</div>
          <h1 className="ret-h1">
            Open the app at 8:47am. Know who needs you first.
          </h1>
          <p style={{ marginTop: 22, fontSize: 17, color: C.textSec, lineHeight: 1.6, maxWidth: 620, marginInline: "auto" }}>
            Retayned is the operating system you didn't know was missing — the one that watches all your client relationships while you focus on the work.
          </p>
          <div style={{ marginTop: 28, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="cta-btn" onClick={() => setPage("signup")} style={{ padding: "14px 28px", fontSize: 15, fontWeight: 700, background: C.btn, color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", fontFamily: "inherit" }}>Start Free Trial</button>
          </div>
          <div style={{ fontSize: 13, color: C.textSec, marginTop: 12 }}>14-day free trial. No credit card required.</div>
        </div>
      </section>

      <RetCurve from="#F2EEE8" to={C.bg} variant="rightCrest" />

      {/* RELATIONSHIP WEB */}
      <section className="ret-section r-full-bleed" style={{ background: C.bg, paddingTop: 80 }}>
        <div className="ret-section-inner">
          <div className="ret-section-head">
            <div className="ret-eyebrow">The freelancer reality</div>
            <h2 className="ret-h2">
              You carry 22 clients in your head.
            </h2>
            <p style={{ marginTop: 16, fontSize: 16, color: C.textSec, lineHeight: 1.6, maxWidth: 640, marginInline: "auto" }}>
              You remember Rachel's daughter just started kindergarten. You remember James hates phone calls before 11. By Thursday, you've been in 14 Zooms, written 3 proposals, and just have to get that report out before it's too late.
            </p>
            <p style={{ marginTop: 16, fontFamily: "'Caveat', cursive", color: C.primary, fontWeight: 700, fontSize: 22, lineHeight: 1.4, maxWidth: 640, marginInline: "auto" }}>
              You're not forgetting because you don't care. You're forgetting because no brain holds 22 relationships at this fidelity.
            </p>
          </div>
          <FreelancerWeb />
        </div>
      </section>

      {/* DAY IN THE LIFE */}
      <section className="ret-section r-full-bleed" style={{ background: C.bg, paddingTop: 24 }}>
        <div className="ret-section-inner">
          <div className="ret-section-head">
            <div className="ret-eyebrow">A day in the life</div>
            <h2 className="ret-h2">A Monday with Retayned, hour by hour.</h2>
          </div>
          <FrDayTimeline />
        </div>
      </section>

      <RetCurve from={C.bg} to="#EAE4D6" variant="leftCrest" />

      {/* WEEKLY RHYTHM */}
      <section className="ret-section r-full-bleed" style={{ background: "#EAE4D6" }}>
        <div className="ret-section-inner">
          <div className="ret-section-head">
            <div className="ret-eyebrow">A week with Retayned</div>
            <h2 className="ret-h2">
              The operating system for solopreneurs.
            </h2>
          </div>
          <div className="fr-week-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, maxWidth: 1100, margin: "0 auto" }}>
            {[
              { d: "MON", t: "Read the brief", b: "Rai swept your whole book overnight. Open Today to a ranked list and more on who moved and why.", tag: "Today" },
              { d: "TUE", t: "Send two scripts", b: "Two relationships need words, not work. Rai drafts them in your voice. You edit a line and send.", tag: "Rai" },
              { d: "WED", t: "Ask while it's warm", b: "A client's referral-readiness crossed the line. Make the intro now, before the moment cools.", tag: "Referrals" },
              { d: "THU", t: "Run a health check", b: "Pick the account. A few honest questions re-score the relationship and surface the drift.", tag: "Clients" },
              { d: "FRI", t: "Work the pipeline", b: "Revisit the Rolodex. A former client just hit a trigger worth a no-pressure reconnect.", tag: "Rolodex" },
            ].map(d => (
              <div key={d.d} className="ret-card" style={{ padding: "22px 20px" }}>
                <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, letterSpacing: "0.16em", color: C.btn, fontWeight: 800 }}>{d.d}</div>
                <div style={{ fontWeight: 800, fontSize: 16, marginTop: 12, color: C.text, letterSpacing: "-0.01em" }}>{d.t}</div>
                <div style={{ fontSize: 13, color: C.textSec, marginTop: 6, lineHeight: 1.55, minHeight: 72 }}>{d.b}</div>
                <div style={{ marginTop: 12 }}>
                  <span style={{ display: "inline-block", padding: "4px 10px", background: "#EFE9FB", color: C.btn, borderRadius: 999, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em" }}>{d.tag}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <RetCurve from="#EAE4D6" to={C.bg} variant="rightRise" />

      {/* ROI */}
      <section className="ret-section r-full-bleed" style={{ background: C.bg }}>
        <div className="ret-section-inner">
          <div className="ret-section-head">
            <div className="ret-eyebrow">The numbers</div>
            <h2 className="ret-h2">
              The math is <span style={{ fontFamily: "'Caveat', cursive", color: C.primary, fontWeight: 700, fontSize: "1.05em" }}>not</span> subtle.
            </h2>
          </div>
          <div className="ret-card" style={{ maxWidth: 620, margin: "0 auto", padding: "30px 36px" }}>
            <div style={{ textAlign: "center", fontSize: 11, letterSpacing: "0.18em", color: C.textSec, textTransform: "uppercase", fontWeight: 700 }}>
              One client at $2,500/mo · any book size on Solo
            </div>
            {[["Retayned Solo", "$29.00"], ["Per-client fees", "$0.00"], ["Your monthly cost", "$29.00"]].map(([k, v], i, a) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "14px 0", borderBottom: i < a.length - 1 ? "1px dashed " + C.borderLight : "none", fontSize: 14.5 }}>
                <span style={{ color: C.textSec }}>{k}</span>
                <span style={{ fontWeight: i === a.length - 1 ? 800 : 500, color: C.text }}>{v}</span>
              </div>
            ))}
            <div style={{ background: C.primarySoft, borderRadius: 10, padding: "16px 18px", marginTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontSize: 11.5, color: C.primary, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>Save one client</div>
              <div style={{ fontWeight: 900, fontSize: 18, color: C.primary, letterSpacing: "-0.01em" }}>= over 7 years of Retayned</div>
            </div>
          </div>
        </div>
      </section>

      <RetCurve from={C.bg} to="#F2EEE8" variant="leftRise" />

      {/* GRAPHIC */}
      <section className="ret-section r-full-bleed" style={{ background: "#F2EEE8" }}>
        <div className="ret-section-inner" style={{ maxWidth: 900, textAlign: "center" }}>
          <FreelancerNetworkGraphic />
        </div>
      </section>

      {/* FAQ */}
      <section className="ret-section r-full-bleed" style={{ background: "#F2EEE8", paddingTop: 32 }}>
        <div className="ret-section-inner" style={{ maxWidth: 760 }}>
          <div className="ret-section-head"><div className="ret-eyebrow">Freelancer FAQ</div></div>
          <div>
            {[
              ["Is this just a CRM?", "No. A CRM is a place to store data; you feed it and it sits there. Retayned reads the data and tells you what to do with it. It feeds you, not the other way around."],
              ["How long does setup take?", "Minutes, not days. Connect your email and calendar, bring in your existing client list, and Retayned scores every relationship overnight. You wake up to a ranked book."],
              ["What if I only have a few clients?", "Then it's even simpler to stay on top of. Solo is $29/mo flat and covers up to 25 managed clients, with unlimited advisory beyond that. Save a single relationship once and the year has paid for itself."],
              ["Will my client know I'm using it?", "No. Retayned works from your side of the relationship — your notes, your calendar, the patterns you observe. It never contacts your clients. They see you, not the system."],
            ].map(([q, a]) => (
              <div key={q} style={{ padding: "18px 0", borderBottom: "1px solid " + C.borderLight }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.text, letterSpacing: "-0.01em" }}>{q}</div>
                <div style={{ fontSize: 14, color: C.textSec, marginTop: 8, lineHeight: 1.6 }}>{a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="ret-section r-full-bleed" style={{ background: "#F2EEE8", textAlign: "center", paddingBottom: 88 }}>
        <div className="ret-section-inner" style={{ maxWidth: 720 }}>
          <h2 className="ret-h2">
            Stop carrying your whole book in your head.
          </h2>
          <button className="cta-btn" onClick={() => setPage("signup")} style={{ marginTop: 24, padding: "16px 36px", fontSize: 16, fontWeight: 700, background: C.btn, color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", fontFamily: "inherit" }}>Start Free Trial</button>
          <div style={{ fontSize: 13, color: C.textSec, marginTop: 12 }}>14-day free trial. No credit card required.</div>
        </div>
      </section>

      <Footer setPage={setPage} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// AGENCIES — full-page port of final/agency.html
// ═══════════════════════════════════════════════════════════════
function AgencySparkline({ data, color, w = 100, h = 26 }) {
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * w},${h - ((d - min) / (max - min || 1)) * h}`).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AgencyAvatar({ initials, size = 32, tone = "btn" }) {
  const palette = {
    btn: ["#EFE9FB", C.btn],
    primary: [C.primarySoft, C.primary],
    primaryDeep: ["rgba(28,50,36,0.08)", C.primaryDeep],
    warning: ["rgba(184,139,21,0.12)", C.warning],
  }[tone] || ["#eee", "#444"];
  return (
    <div style={{ width: size, height: size, borderRadius: 999, background: palette[0], color: palette[1], display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: size * 0.42, fontFamily: "'Caveat', cursive", flexShrink: 0 }}>{initials}</div>
  );
}

function Agencies({ setPage }) {
  const drift = (n) => n === 0
    ? <span style={{ display: "inline-block", padding: "3px 10px", background: C.primarySoft, color: C.primary, borderRadius: 999, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em" }}>none</span>
    : n <= 2
      ? <span style={{ display: "inline-block", padding: "3px 10px", background: "#F4E5C2", color: "#8B6A1B", borderRadius: 999, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em" }}>{n} cooling</span>
      : <span style={{ display: "inline-block", padding: "3px 10px", background: "#F2D6CE", color: "#8E2A18", borderRadius: 999, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em" }}>{n} at risk</span>;

  const rollup = [
    { am: "Priya N.", ini: "PN", tone: "btn", clients: 18, score: 78, spark: [62, 64, 68, 71, 74, 76, 78], drift: 1, mrr: "$47.2k", sparkColor: C.primary },
    { am: "Marcus R.", ini: "MR", tone: "primaryDeep", clients: 14, score: 71, spark: [68, 70, 72, 74, 73, 72, 71], drift: 2, mrr: "$33.5k", sparkColor: C.warning },
    { am: "Eliza K.", ini: "EK", tone: "primary", clients: 22, score: 82, spark: [74, 76, 78, 80, 81, 82, 82], drift: 0, mrr: "$58.9k", sparkColor: C.primary },
    { am: "Theo V.", ini: "TV", tone: "warning", clients: 11, score: 64, spark: [72, 70, 68, 66, 65, 64, 64], drift: 4, mrr: "$22.1k", sparkColor: C.danger },
    { am: "Sam D.", ini: "SD", tone: "btn", clients: 16, score: 75, spark: [70, 72, 73, 74, 75, 75, 75], drift: 1, mrr: "$39.8k", sparkColor: C.primary },
  ];

  return (
    <div className="agency-page">
      <RetPageStyles />
      <style>{`
        @media (max-width: 840px) {
          .ag-handoff-grid { grid-template-columns: 1fr !important; }
          .ag-handoff-grid > div:first-child { border-right: none !important; border-bottom: 1px solid ${C.borderLight} !important; }
          .ag-rollup-table { font-size: 12px !important; }
          .ag-rollup-table th, .ag-rollup-table td { padding: 10px 12px !important; }
          .ag-rhythm-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 480px) {
          .ag-rhythm-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* HERO */}
      <section className="ret-section r-full-bleed" style={{ background: "#F2EEE8", textAlign: "center", paddingTop: HERO_TOP, paddingBottom: 40 }}>
        <div className="ret-section-inner" style={{ maxWidth: 940 }}>
          <div className="ret-eyebrow">For agencies & studios</div>
          <h1 className="ret-h1">
            Know which clients need you before they go dark.
          </h1>
          <p style={{ marginTop: 22, fontSize: 17, color: C.textSec, lineHeight: 1.6, maxWidth: 660, marginInline: "auto" }}>
            Retayned is the OS for your agency's client relationships. Every account scored, every AM's book in one view, every at-risk relationship surfaced early.
          </p>
          <div style={{ marginTop: 28, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="cta-btn" onClick={() => setPage("signup")} style={{ padding: "14px 28px", fontSize: 15, fontWeight: 700, background: C.btn, color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", fontFamily: "inherit" }}>Start Free Trial</button>
          </div>
          <div style={{ fontSize: 13, color: C.textSec, marginTop: 12 }}>$99/mo · 5 seats included · +$19 per extra seat · no client cap</div>
        </div>
      </section>

      <RetCurve from="#F2EEE8" to={C.bg} variant="rightCrest" />

      {/* HANDOFF SPLIT-CARD */}
      <section className="ret-section r-full-bleed" style={{ background: C.bg }}>
        <div className="ret-section-inner">
          <div className="ret-section-head">
            <div className="ret-eyebrow">The handoff problem</div>
            <h2 className="ret-h2">
              What walks out the door when an AM does.
            </h2>
          </div>
          <div className="ret-card ag-handoff-grid" style={{ maxWidth: 880, margin: "0 auto", padding: 0, overflow: "hidden", display: "grid", gridTemplateColumns: "1fr 1fr", position: "relative" }}>
            {/* "vs." text centered on the split */}
            <div className="ag-vs-badge" style={{
              position: "absolute",
              top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              fontFamily: "'Caveat', cursive",
              fontSize: 32, fontWeight: 700,
              color: C.btn,
              zIndex: 2,
              letterSpacing: "-0.02em",
              lineHeight: 1,
              pointerEvents: "none",
            }}>vs.</div>
            <div style={{ padding: "30px 32px", borderRight: "1px solid " + C.borderLight }}>
              <div style={{ fontSize: 11, letterSpacing: "0.18em", color: C.textSec, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>Without Retayned</div>
              <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 16, color: C.text, letterSpacing: "-0.01em" }}>The brain leaves with the person.</div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", fontSize: 14, color: C.textSec, lineHeight: 1.7 }}>
                <li>— "Wait, what was the client's wife's name?"</li>
                <li>— Two weeks of Slack archaeology per account</li>
                <li>— Quiet accounts slip away mid-handoff</li>
                <li>— The new AM starts from a cold zero</li>
              </ul>
            </div>
            <div style={{ padding: "30px 32px", background: C.primarySoft }}>
              <div style={{ fontSize: 11, letterSpacing: "0.18em", color: C.primary, textTransform: "uppercase", marginBottom: 14, fontWeight: 700 }}>With Retayned</div>
              <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 16, color: C.primaryDeep, letterSpacing: "-0.01em" }}>The brain belongs to the agency.</div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", fontSize: 14, color: C.primaryDeep, lineHeight: 1.7 }}>
                <li>+ Every relationship scored and on record</li>
                <li>+ A full handoff brief in thirty seconds</li>
                <li>+ The account never feels the transition</li>
                <li>+ The new AM picks up exactly where it left off</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* PORTFOLIO ROLLUP TABLE */}
      <section className="ret-section r-full-bleed" style={{ background: C.bg, paddingTop: 24 }}>
        <div className="ret-section-inner">
          <div className="ret-section-head">
            <div className="ret-eyebrow">The portfolio view</div>
            <h2 className="ret-h2">
              One screen. All your AMs, all their books.
            </h2>
          </div>
          <div className="ret-card" style={{ maxWidth: 1000, margin: "0 auto", padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "20px 26px", borderBottom: "1px solid " + C.borderLight, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 14.5, color: C.text }}>Q1 · Account Manager Rollup</div>
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11.5, color: C.textSec, fontWeight: 600 }}>updated 8 min ago</div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="ag-rollup-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                <thead>
                  <tr style={{ background: C.bg, textAlign: "left" }}>
                    {["AM", "Clients", "Avg score", "Trend (90d)", "Drift", "MRR"].map(h => (
                      <th key={h} style={{ padding: "13px 18px", fontSize: 11, letterSpacing: "0.12em", color: C.textSec, textTransform: "uppercase", fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rollup.map((r, i) => (
                    <tr key={r.am} style={{ borderTop: i ? "1px solid " + C.borderLight : "none" }}>
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <AgencyAvatar initials={r.ini} size={28} tone={r.tone} />
                          <span style={{ fontWeight: 700, color: C.text }}>{r.am}</span>
                        </div>
                      </td>
                      <td style={{ padding: "14px 18px", color: C.textSec }}>{r.clients}</td>
                      <td style={{ padding: "14px 18px", fontWeight: 800, color: r.score >= 75 ? C.primary : r.score >= 70 ? C.text : C.danger }}>{r.score}</td>
                      <td style={{ padding: "14px 18px" }}><AgencySparkline data={r.spark} color={r.sparkColor} /></td>
                      <td style={{ padding: "14px 18px" }}>{drift(r.drift)}</td>
                      <td style={{ padding: "14px 18px", fontFamily: "'Courier New', monospace", fontSize: 13, color: C.text, fontWeight: 600 }}>{r.mrr}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ textAlign: "center", marginTop: 16, fontSize: 12.5, color: C.textSec }}>
            Sortable. Filterable. Exportable. Drill into any AM's book in one click.
          </div>
        </div>
      </section>

      <RetCurve from={C.bg} to="#EAE4D6" variant="leftCrest" />

      {/* AGENCY RHYTHM */}
      <section className="ret-section r-full-bleed" style={{ background: "#EAE4D6" }}>
        <div className="ret-section-inner">
          <div className="ret-section-head">
            <div className="ret-eyebrow">The agency rhythm</div>
            <h2 className="ret-h2">
              A heartbeat for your book of business.
            </h2>
          </div>
          <div className="ag-rhythm-grid" style={{ maxWidth: 940, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {[
              { c: "Daily", t: "The morning read", b: "Rai's overnight sweep ranks the whole book. The team opens to today's accounts; the owner sees the portfolio at a glance." },
              { c: "Weekly", t: "Portfolio sweep", b: "Drift signals across every AM's book. Decide what to escalate, reassign, or step into directly." },
              { c: "Monthly", t: "Health checks", b: "Structured pulse on each account so the score reflects the relationship, not last quarter's guess." },
              { c: "Quarterly", t: "Renewal forecast", b: "Referral-readiness and churn risk across the next 90 days, so renewals start as conversations, not scrambles." },
            ].map(d => (
              <div key={d.c} className="ret-card" style={{ padding: "22px 20px" }}>
                <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, letterSpacing: "0.16em", color: C.btn, fontWeight: 800, textTransform: "uppercase" }}>{d.c}</div>
                <div style={{ fontWeight: 800, fontSize: 16, marginTop: 12, color: C.text, letterSpacing: "-0.01em" }}>{d.t}</div>
                <div style={{ fontSize: 13, color: C.textSec, marginTop: 6, lineHeight: 1.55 }}>{d.b}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <RetCurve from="#EAE4D6" to={C.bg} variant="rightRise" />

      {/* AGENCY MATH */}
      <section className="ret-section r-full-bleed" style={{ background: C.bg }}>
        <div className="ret-section-inner">
          <div className="ret-section-head">
            <div className="ret-eyebrow">Agency math</div>
            <h2 className="ret-h2">
              8 AMs. $156/mo.
            </h2>
          </div>
          <div className="ret-card" style={{ maxWidth: 620, margin: "0 auto", padding: "30px 36px" }}>
            <div style={{ textAlign: "center", fontSize: 11, letterSpacing: "0.18em", color: C.textSec, textTransform: "uppercase", fontWeight: 700 }}>
              Mid-size agency · 8 AMs · 120 active accounts · no client cap
            </div>
            {[["Retayned Team", "$99.00"], ["5 seats included", "$0.00"], ["3 extra seats × $19", "$57.00"], ["Per-client fees", "$0.00"], ["Total monthly cost", "$156.00"]].map(([k, v], i, a) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "14px 0", borderBottom: i < a.length - 1 ? "1px dashed " + C.borderLight : "none", fontSize: 14.5 }}>
                <span style={{ color: C.textSec }}>{k}</span>
                <span style={{ fontWeight: i === a.length - 1 ? 800 : 500, color: C.text }}>{v}</span>
              </div>
            ))}
            <div style={{ background: C.primarySoft, borderRadius: 10, padding: "16px 18px", marginTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontSize: 11.5, color: C.primary, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>Save one $4k/mo account</div>
              <div style={{ fontWeight: 900, fontSize: 18, color: C.primary, letterSpacing: "-0.01em" }}>= 25 months covered</div>
            </div>
          </div>
        </div>
      </section>

      <RetCurve from={C.bg} to="#F2EEE8" variant="leftRise" />

      {/* GRAPHIC */}
      <section className="ret-section r-full-bleed" style={{ background: "#F2EEE8" }}>
        <div className="ret-section-inner" style={{ maxWidth: 900, textAlign: "center" }}>
          <AgencyNetworkGraphic />
        </div>
      </section>

      {/* FAQ */}
      <section className="ret-section r-full-bleed" style={{ background: "#F2EEE8", paddingTop: 32 }}>
        <div className="ret-section-inner" style={{ maxWidth: 760 }}>
          <div className="ret-section-head"><div className="ret-eyebrow">Agency FAQ</div></div>
          <div>
            {[
              ["How does AM-level permissioning work?", "AMs see their own book by default. Owners and managers see the full portfolio. More granular roles will be available on Enterprise."],
              ["Can we white-label client-facing artifacts?", "Yes — health-check exports and QBR briefs ship with your agency mark on Enterprise. Retayned itself stays internal-only."],
              ["How does seat pricing work?", "Team is $99/mo and includes 5 seats. Each additional seat is $19/mo — add or remove them as your team changes. There's no per-client fee and no client cap, so your book can grow without your bill tracking it."],
              ["How does this fit alongside our existing CRM?", "Most agencies keep their CRM as the system of record for deals. Retayned plugs into it as the relationship-intelligence layer above. Two-way sync with HubSpot, Salesforce, Pipedrive, and Folk."],
            ].map(([q, a]) => (
              <div key={q} style={{ padding: "18px 0", borderBottom: "1px solid " + C.borderLight }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.text, letterSpacing: "-0.01em" }}>{q}</div>
                <div style={{ fontSize: 14, color: C.textSec, marginTop: 8, lineHeight: 1.6 }}>{a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="ret-section r-full-bleed" style={{ background: "#F2EEE8", textAlign: "center", paddingBottom: 88 }}>
        <div className="ret-section-inner" style={{ maxWidth: 760 }}>
          <h2 className="ret-h2">
            Run the whole book from one place.
          </h2>
          <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="cta-btn" onClick={() => setPage("signup")} style={{ padding: "14px 28px", fontSize: 15, fontWeight: 700, background: C.btn, color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", fontFamily: "inherit" }}>Start Free Trial</button>
          </div>
          <div style={{ fontSize: 13, color: C.textSec, marginTop: 12 }}>14-day free trial · No credit card required · 5 seats included, +$19 each after</div>
        </div>
      </section>

      <Footer setPage={setPage} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ENTERPRISE — full-page port of final/enterprise.html
// ═══════════════════════════════════════════════════════════════
function Enterprise({ setPage }) {
  return (
    <div className="enterprise-page">
      <RetPageStyles />
      <style>{`
        .ent-code-block { background: #14201A; color: #DCE6E0; font-family: 'Courier New', monospace; font-size: 12.5px; line-height: 1.7; padding: 22px 24px; border-radius: 12px; overflow-x: auto; }
        .ent-code-block .k { color: #d6a3ff; }
        .ent-code-block .s { color: #9ad9b9; }
        .ent-code-block .n { color: #6dd2a3; }
        .ent-code-block .c { color: #5a6f64; font-style: italic; }
        .ent-code-block .p { color: #8aa39a; }
        @media (max-width: 840px) {
          .ent-surface-grid { grid-template-columns: 1fr !important; }
          .ent-api-grid { grid-template-columns: 1fr !important; }
          .ent-rhythm-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 480px) {
          .ent-rhythm-grid { grid-template-columns: 1fr !important; }
        }
        .ent-hero { padding: ${HERO_TOP}px 48px 56px; }
        @media (max-width: 760px) {
          .ent-hero { padding: ${HERO_TOP}px 24px 48px; }
        }
      `}</style>

      {/* HERO ON DARK */}
      <section className="r-full-bleed ent-hero" style={{ background: C.primaryDeep, color: "#fff", textAlign: "center" }}>
        <div className="ret-eyebrow ret-eyebrow-light">For large enterprises</div>
        <h1 className="ret-h1" style={{ color: "#fff", maxWidth: 920, marginInline: "auto" }}>
          A managed agent that gives your team the next right move.
        </h1>
        <p style={{ color: "rgba(255,255,255,0.78)", fontSize: 17.5, lineHeight: 1.6, marginTop: 22, maxWidth: 700, marginInline: "auto" }}>
          Retayned watches every account, scores every relationship, and surfaces the one move that matters most for each one. The only question is who acts on it: your people, your AI agents, or both. Same brain underneath.
        </p>

        {/* TWO-SURFACE VISUAL */}
        <div className="ent-surface-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, maxWidth: 1000, margin: "44px auto 0", textAlign: "left" }}>
          {[
            { tag: "FOR YOUR PEOPLE", t: "Account managers", sub: "Each AM opens to a ranked book and the next right action on every account — who to call, what to say, and why it matters today." },
            { tag: "FOR YOUR AGENTS", t: "AI agents", sub: "Hand accounts to Retayned's agents. They read the signals, take approved actions, and escalate to a human the moment it matters." },
          ].map(c => (
            <div key={c.tag} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "28px 30px" }}>
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, letterSpacing: "0.2em", color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>{c.tag}</div>
              <div style={{ fontSize: 26, fontWeight: 900, marginTop: 14, color: "#fff", letterSpacing: "-0.02em" }}>{c.t}</div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.6, marginTop: 12 }}>{c.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 40, flexWrap: "wrap" }}>
          <button className="cta-btn" onClick={() => setPage("contact")} style={{ padding: "14px 28px", fontSize: 15, fontWeight: 700, background: "#fff", color: C.primaryDeep, border: "none", borderRadius: 12, cursor: "pointer", fontFamily: "inherit" }}>Request Early Access</button>
        </div>
      </section>

      <RetCurve from={C.primaryDeep} to="#F2EEE8" variant="leftCrest" />

      {/* HOW IT WORKS */}
      <section className="ret-section r-full-bleed" style={{ background: "#F2EEE8" }}>
        <div className="ret-section-inner">
          <div className="ret-section-head">
            <div className="ret-eyebrow">How it works</div>
            <h2 className="ret-h2" style={{ maxWidth: 820, marginInline: "auto" }}>
              Our brain reads the book.<br /><span style={{ fontFamily: "'Caveat', cursive", color: C.primary, fontWeight: 700, fontSize: "1.05em" }}>You decide who acts.</span>
            </h2>
            <p style={{ marginTop: 18, fontSize: 16, color: C.textSec, lineHeight: 1.6, maxWidth: 660, marginInline: "auto" }}>
              Retayned scores every account and figures out the next right action for each relationship. From there, the work flows wherever you point it — to a person, an agent, or both.
            </p>
          </div>
          <div className="ret-grid-3">
            {[
              { h: "It watches every account", p: "Email, calendar, product usage, billing, support — every signal feeds a live Retention Score on every relationship, not just the few that get a human." },
              { h: "It names the next right action", p: "For each account, Retayned surfaces the one move that matters most right now, and the reasoning behind it. No dashboards to interpret, no guessing." },
              { h: "Your team or your agents act on it", p: "Route an account to an AM and it shows up in their book. Route it to a Retayned agent and it gets handled, with escalation to a human the moment it needs one." },
            ].map((s, i) => (
              <div key={i} className="ret-card">
                <div style={{ fontSize: 11, fontWeight: 700, color: C.btn, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10 }}>0{i + 1}</div>
                <h3 className="ret-h3">{s.h}</h3>
                <p style={{ fontSize: 14.5, color: C.textSec, lineHeight: 1.6, margin: 0 }}>{s.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <RetCurve from="#F2EEE8" to={C.bg} variant="rightCrest" />

      {/* CODE-FORWARD: THE API */}
      <section className="ret-section r-full-bleed" style={{ background: C.bg }}>
        <div className="ret-section-inner">
          <div className="ret-section-head">
            <div className="ret-eyebrow">Built like infrastructure</div>
            <h2 className="ret-h2">
              Account Management as a Service <span style={{ fontFamily: "'Caveat', cursive", color: C.primary, fontWeight: 700, fontSize: "1.05em" }}>(or AMaaS if that's your thing).</span>
            </h2>
            <p style={{ marginTop: 16, fontSize: 16, color: C.textSec, lineHeight: 1.6, maxWidth: 660, marginInline: "auto" }}>
              Score any account on demand. Pipe signals from your data warehouse. Trigger Rai actions from any system in your stack. Webhook out the moment a relationship cools.
            </p>
          </div>

          <div className="ent-api-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 26, maxWidth: 1100, margin: "0 auto", alignItems: "start" }}>
            <div className="ent-code-block">
              <div><span className="c">{"// Score any account in your warehouse"}</span></div>
              <div><span className="k">const</span> health <span className="p">=</span> <span className="k">await</span> retayned.<span className="n">accounts</span>.score({"{"}</div>
              <div>{"  "}id: <span className="s">"acc_8w12kf"</span>,</div>
              <div>{"  "}signals: [<span className="s">"emails"</span>, <span className="s">"meetings"</span>, <span className="s">"usage"</span>],</div>
              <div>{"}"});</div>
              <div>&nbsp;</div>
              <div><span className="c">{"// => { score: 73, drift: -4, dimensions: ... }"}</span></div>
              <div>&nbsp;</div>
              <div><span className="k">if</span> (health.drift <span className="p">{"<"}</span> -<span className="n">5</span>) {"{"}</div>
              <div>{"  "}<span className="k">await</span> rai.<span className="n">handle</span>(health.id, {"{"} mode: <span className="s">"escalate"</span> {"}"});</div>
              <div>{"}"}</div>
            </div>
            <div>
              {[
                { ep: "POST /accounts/score", d: "On-demand health score across 12 dimensions, callable from any system." },
                { ep: "POST /signals/ingest", d: "Pipe behavioral signals from your warehouse — usage, billing, support, custom events." },
                { ep: "POST /rai/handle", d: "Hand an account to a Retayned agent. Returns a transcript and an outcome score." },
                { ep: "GET  /portfolio/rollup", d: "Org-wide portfolio view: AM rollups, vertical slices, cohort drift." },
                { ep: "WEBHOOK score.dropped", d: "Fires the moment any account crosses a configurable drift threshold." },
              ].map(r => (
                <div key={r.ep} style={{ padding: "16px 0", borderBottom: "1px solid " + C.borderLight }}>
                  <div style={{ fontFamily: "'Courier New', monospace", fontSize: 12.5, color: C.btn, fontWeight: 700 }}>{r.ep}</div>
                  <div style={{ fontSize: 13.5, color: C.textSec, marginTop: 6, lineHeight: 1.55 }}>{r.d}</div>
                </div>
              ))}
            </div>
          </div>

          {/* INTEGRATIONS */}
          <div style={{ maxWidth: 1100, margin: "44px auto 0", paddingTop: 32, borderTop: "1px solid " + C.borderLight }}>
            <div style={{ fontSize: 11, letterSpacing: "0.18em", color: C.textSec, textTransform: "uppercase", textAlign: "center", marginBottom: 20, fontWeight: 700 }}>Planned integrations with the stack you already run</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
              {["Salesforce", "HubSpot", "Snowflake", "Segment", "Slack", "Gong", "Zendesk", "Intercom", "Linear", "Notion", "Google Workspace", "Microsoft 365"].map(n => (
                <div key={n} style={{ padding: "10px 18px", background: C.card, border: "1px solid " + C.borderLight, borderRadius: 10, fontSize: 13, fontWeight: 600, color: C.text }}>{n}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <RetCurve from={C.bg} to="#F2EEE8" variant="rightCrest" />

      {/* ENTERPRISE MATH — hidden until pricing is ready */}
      {false && (
      <>
      <RetCurve from={C.bg} to={C.primaryDeep} variant="rightCrest" />

      <section className="ret-section r-full-bleed" style={{ background: C.primaryDeep, color: "#fff" }}>
        <div className="ret-section-inner">
          <div className="ret-section-head">
            <div className="ret-eyebrow ret-eyebrow-light">Enterprise math</div>
            <h2 className="ret-h2" style={{ color: "#fff" }}>
              One retained account at <span style={{ fontFamily: "'Caveat', cursive", color: C.primaryLight, fontWeight: 700, fontSize: "1.05em" }}>$120k ARR</span> covers the year.
            </h2>
          </div>
          <div className="ret-card" style={{ maxWidth: 660, margin: "0 auto", padding: "30px 36px" }}>
            <div style={{ textAlign: "center", fontSize: 11, letterSpacing: "0.18em", color: C.textSec, textTransform: "uppercase", fontWeight: 700 }}>
              1,000 accounts · 8 AMs · annual contract
            </div>
            {[
              ["Platform license (annual)", "$48,000"],
              ["Per-account fee (1,000)", "$12,000"],
              ["Rai agent runtime", "included"],
              ["Onboarding + integrations", "included"],
              ["Annual cost", "$60,000"],
            ].map(([k, v], i, a) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "14px 0", borderBottom: i < a.length - 1 ? "1px dashed " + C.borderLight : "none", fontSize: 14.5 }}>
                <span style={{ color: C.textSec }}>{k}</span>
                <span style={{ fontWeight: i === a.length - 1 ? 800 : 500, color: C.text }}>{v}</span>
              </div>
            ))}
            <div style={{ background: C.primarySoft, borderRadius: 10, padding: "16px 18px", marginTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontSize: 11.5, color: C.primary, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>Retain one $120k account</div>
              <div style={{ fontWeight: 900, fontSize: 18, color: C.primary, letterSpacing: "-0.01em" }}>= 2× ROI in year one</div>
            </div>
          </div>
          <div style={{ textAlign: "center", marginTop: 16, fontSize: 12.5, color: "rgba(255,255,255,0.6)" }}>
            Indicative. Real pricing scales with account volume and integration scope.
          </div>
        </div>
      </section>

      <RetCurve from={C.primaryDeep} to="#F2EEE8" variant="leftRise" />
      </>
      )}

      {/* GRAPHIC */}
      <section className="ret-section r-full-bleed" style={{ background: "#F2EEE8" }}>
        <div className="ret-section-inner" style={{ maxWidth: 900, textAlign: "center" }}>
          <EnterpriseNetworkGraphic />
        </div>
      </section>

      {/* FAQ */}
      <section className="ret-section r-full-bleed" style={{ background: "#F2EEE8", paddingTop: 32 }}>
        <div className="ret-section-inner" style={{ maxWidth: 760 }}>
          <div className="ret-section-head"><div className="ret-eyebrow">Enterprise FAQ</div></div>
          <div style={{ background: C.primarySoft, border: "1px solid " + C.borderLight, borderRadius: 12, padding: "16px 20px", marginBottom: 24, fontSize: 14, color: C.primary, lineHeight: 1.6 }}>
            <strong>Retayned Enterprise is pre-launch.</strong> We're sharing the planned design and gauging interest with a small group of design partners who want to shape it before it ships. The answers below describe where we're headed, not features you can buy today.
          </div>
          <div>
            {[
              ["What deployment model are you planning?", "We're designing for cloud or VPC-isolated deployment with configurable data residency, and we're building toward SOC 2, GDPR, and HIPAA alignment with SSO via SAML and SCIM. Design partners help us prioritize which of these lands first. We won't claim a certification until we've actually earned it."],
              ["How will Rai stay in our voice?", "The plan is for you to provision Rai with your brand voice samples, approved scripts, and escalation rules, with every action routed through your approval workflow until you choose to give it more autonomy. Nothing acts on your clients without your sign-off — that principle is fixed, the exact controls are still being shaped with early partners."],
              ["What signals will it ingest?", "We're planning connectors for email and calendar (Microsoft 365, Google), major CRMs, product-usage and data warehouses, support tools, and custom events via API. These are planned integrations, not live ones — design partners tell us which sources to build first."],
              ["What will rollout look like?", "We're designing a phased rollout: platform layer first, then Rai ramping through shadow mode to assisted to autonomous on a per-segment basis, so you expand trust at your own pace. Early partners get white-glove onboarding and a direct line to the team building it."],
            ].map(([q, a]) => (
              <div key={q} style={{ padding: "18px 0", borderBottom: "1px solid " + C.borderLight }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.text, letterSpacing: "-0.01em" }}>{q}</div>
                <div style={{ fontSize: 14, color: C.textSec, marginTop: 8, lineHeight: 1.6 }}>{a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="r-full-bleed" style={{ background: "#F2EEE8", color: C.text, padding: "80px 48px", textAlign: "center" }}>
        <div className="ret-eyebrow">Retayned Enterprise · Coming Soon</div>
        <h2 className="ret-h2" style={{ color: C.text, maxWidth: 780, marginInline: "auto" }}>
          One brain for the book.<br />
          <span style={{ fontFamily: "'Caveat', cursive", color: C.primary, fontWeight: 700, fontSize: "1.05em" }}>Your people, your agents, or both.</span>
        </h2>
        <p style={{ color: C.textSec, fontSize: 15.5, marginTop: 20, maxWidth: 600, marginInline: "auto", lineHeight: 1.6 }}>
          We're onboarding a small group of design partners now. White-glove deployment, a dedicated solutions engineer, and direct access to the team that builds Retayned.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 32, flexWrap: "wrap" }}>
          <button className="cta-btn" onClick={() => setPage("contact")} style={{ padding: "14px 28px", fontSize: 15, fontWeight: 700, background: C.btn, color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", fontFamily: "inherit" }}>Request Early Access</button>
        </div>
      </section>

      <Footer setPage={setPage} />
    </div>
  );
}


function TodayRankDemo() {
  const ROW_H = 70;
  // Your tasks, in the order you entered them (Manual view)
  const base = [
    { id: "o", n: "Review Oakline Q1 numbers", m: "QBR in 6 days", s: 73, entry: 1 },
    { id: "r", n: "Call Rachel at Broadleaf", m: "at-risk · 11 days silent", s: 65, entry: 2 },
    { id: "n", n: "Plan Northvane anniversary", m: "referral-ready", s: 91, entry: 3 },
    { id: "f", n: "Complete Foxglove Health Check", m: "12 days overdue", s: 42, entry: 4 },
  ];
  // Tasks Rai suggests adding (only appear in "Rai Task & Rank")
  const suggested = [
    { id: "s1", n: "Check in with Wes before renewal", m: "renewal in 14 days · Rai spotted this", s: 58, suggested: true },
    { id: "s2", n: "Thank Marisol for the referral", m: "referred you Tuesday · strike while warm", s: 88, suggested: true },
  ];

  const MODES = [
    { id: "taskrank", label: "Rai Task & Rank", desc: "Rai ranks your list + adds suggested tasks.", icons: 2 },
    { id: "rank", label: "Rai Rank", desc: "Rai ranks your task list.", icons: 1 },
    { id: "manual", label: "Manual", desc: "Your tasks, your way. No Rai.", icons: 0 },
  ];
  const [mode, setMode] = useState("taskrank");
  const scoreColor = (s) => (s < 55 ? C.danger : s < 78 ? C.warning : C.success);

  // Build the visible list for the current mode
  let list;
  if (mode === "manual") {
    list = [...base].sort((a, b) => a.entry - b.entry);
  } else if (mode === "rank") {
    list = [...base].sort((a, b) => b.s - a.s);
  } else {
    list = [...base, ...suggested].sort((a, b) => b.s - a.s);
  }
  const showScores = mode !== "manual";
  const pos = {}; list.forEach((t, i) => { pos[t.id] = i; });
  const allRows = [...base, ...suggested];
  const raiLine = mode === "manual"
    ? "Manual mode: your list, exactly as you left it. No ranking, no suggestions — you're driving."
    : mode === "rank"
    ? "Rai Rank: same tasks, sorted by what matters most today. Rachel's risk now sits above the routine QBR prep."
    : "Rai Task & Rank: ranked, plus two moves you'd have missed — Wes's renewal window and a referral worth thanking while it's warm.";

  return (
    <div className="trd-wrap" style={{ maxWidth: 540, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "center", gap: 9, marginBottom: 22, flexWrap: "wrap" }}>
        {MODES.map(md => (
          <button key={md.id} onClick={() => setMode(md.id)} className={"trd-chip" + (mode === md.id ? " trd-chip-on" : "")}>
            {md.icons > 0 && <span style={{ color: mode === md.id ? "#fff" : C.btn, marginRight: 5 }}>{md.icons === 2 ? "✦✦" : "✦"}</span>}
            {md.label}
          </button>
        ))}
      </div>
      <div style={{ background: C.card, border: "1px solid " + C.borderLight, borderRadius: 18, padding: 8, boxShadow: "0 20px 60px rgba(0,0,0,0.07)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px 10px" }}>
          <span style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 15, color: C.text }}>today</span>
          <span style={{ fontSize: 11, color: mode === "manual" ? C.textMuted : C.btn, fontWeight: 800, letterSpacing: "0.04em", transition: "color 0.3s" }}>{mode === "manual" ? "MANUAL" : mode === "rank" ? "✦ RAI RANKED" : "✦✦ RAI TASK & RANK"}</span>
        </div>
        <div style={{ position: "relative", height: list.length * ROW_H, transition: "height 0.5s cubic-bezier(.4,0,.2,1)" }}>
          {allRows.map(t => {
            const i = pos[t.id];
            const visible = i !== undefined;
            const top = i === 0;
            return (
              <div key={t.id} style={{
                position: "absolute", left: 0, right: 0,
                transform: `translateY(${(visible ? i : list.length) * ROW_H}px)`,
                opacity: visible ? 1 : 0,
                pointerEvents: visible ? "auto" : "none",
                transition: "transform 0.6s cubic-bezier(.4,0,.2,1), opacity 0.45s, background 0.4s",
                display: "flex", alignItems: "center", gap: 13, padding: "13px 14px",
                borderRadius: 11, background: top && showScores ? "#EFE9FB" : "transparent",
              }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, border: "1.5px solid " + (top && showScores ? C.btn : C.borderLight), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: top && showScores ? C.btn : C.textMuted, flexShrink: 0 }}>{visible ? i + 1 : ""}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: C.text, display: "flex", alignItems: "center", gap: 7 }}>
                    {t.n}
                    {t.suggested && <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: C.btn, background: "#EFE9FB", padding: "2px 7px", borderRadius: 100, flexShrink: 0 }}>✦ suggested</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 2 }}>{t.m}</div>
                </div>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: scoreColor(t.s) + "1f", border: "1.5px solid " + scoreColor(t.s) + "55", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: scoreColor(t.s), flexShrink: 0, opacity: showScores ? 1 : 0, transform: showScores ? "scale(1)" : "scale(0.7)", transition: "opacity 0.4s, transform 0.4s" }}>{t.s}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ maxWidth: 540, margin: "14px auto 0", padding: "13px 16px", background: "#EFE9FB", borderRadius: 12, fontSize: 13, color: "#3e2f72", lineHeight: 1.55, display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span style={{ color: C.btn, fontSize: 15, flexShrink: 0 }}>✦</span>
        <span>{raiLine}</span>
      </div>
      <div style={{ textAlign: "center", fontSize: 12.5, color: C.textMuted, marginTop: 14, fontStyle: "italic" }}>Switch modes — you decide how much Rai does.</div>
    </div>
  );
}

function FeatureToday({ setPage }) {
  const otherFeatures = PLATFORM_FEATURES.filter(f => f.id !== "feature-today").slice(0, 3);
  return (
    <div>
      <RetPageStyles />
      <RetHero
        eyebrow="Today"
        h1="Your highest-value move is always first."
        sub="Today tells you who needs you most — right now. Tasks are sorted by an AI-enhanced priority engine that weighs relationship health, business value, and several other dynamic factors."
        primaryCta="Start Free Trial"
        primaryAction="signup"
        setPage={setPage}
      />

      {/* INTERACTIVE — PRODUCT IN MOTION */}
      <RetCurve from="#F2EEE8" to={C.bg} variant="dome" />
      <section className="ret-section ret-bg-light r-full-bleed" style={{ paddingTop: 56, paddingBottom: 56 }}>
        <div className="ret-section-inner">
          <div className="ret-section-head">
            <div className="ret-eyebrow">See it work</div>
            <h2 className="ret-h2">You decide how much Rai does.</h2>
            <p className="ret-sub" style={{ margin: "0 auto" }}>Every night, Rai studies your whole book and sets the next morning's order. Choose your mode and watch what changes — from your raw list to a ranked, Rai-suggested day.</p>
          </div>
          <TodayRankDemo />
        </div>
      </section>

      {/* HOW IT WORKS — three moves (connected to interactive above, same bg) */}
      <section className="ret-section ret-bg-light r-full-bleed" style={{ paddingTop: 56 }}>
        <div className="ret-section-inner">
          <div className="ret-section-head">
            <div className="ret-eyebrow">How it works</div>
            <h2 className="ret-h2">The priority engine, in three moves.</h2>
            <p className="ret-sub" style={{ margin: "0 auto" }}>Today isn't a to-do list. It's a custom-ranked ladder of what to do next — calculated with real-time data.</p>
          </div>
          <div className="ret-grid-3">
            {[
              { h: "Score relationships", p: "Every client carries a Retention Score, set from Health Checks, velocity, billing patterns, LTV, past revenue, revenue potential, and more." },
              { h: "Weigh by impact", p: "A task for a $200/mo at-risk client doesn't outrank an $8,000/mo green client who's ready to refer. Priority factors in revenue, tenure, and upside." },
              { h: "Surface the big one", p: "You open Retayned in the morning and see the move that matters most. Not fifty tasks. The one that will save or grow the most revenue today." },
            ].map((s, i) => (
              <div key={i} className="ret-card">
                <div style={{ fontSize: 11, fontWeight: 700, color: C.btn, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10 }}>0{i + 1}</div>
                <h3 className="ret-h3">{s.h}</h3>
                <p style={{ fontSize: 14.5, color: C.textSec, lineHeight: 1.6, margin: 0 }}>{s.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RAI VOICE MOMENT */}
      <RetCurve from={C.bg} to={C.sidebar} variant="leftRise" />
      <section className="r-full-bleed" style={{ background: C.sidebar, color: "#F4F0E6", padding: "84px 32px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 15, color: "#9DC4AC", marginBottom: 18 }}>How Rai thinks.</div>
          <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: "clamp(20px, 3vw, 27px)", lineHeight: 1.55, color: "#E8E4D8", borderLeft: "2px solid " + C.primaryLight, paddingLeft: 22 }}>
            "I've spent more hours than I can count watching how client relationships actually end. <span style={{ color: "#fff" }}>It's almost never the work. It's the email that didn't get sent, the check-in that slipped a month, the quiet client nobody worried about.</span> I read your whole book every day, so the small thing has to get through me before it ever becomes the big one."
          </div>
          <p style={{ fontSize: 16, lineHeight: 1.65, color: "#C8D2C9", marginTop: 36, maxWidth: 560 }}>The point was never to replace your judgment. It's to make sure nothing reaches it too late while there's still time to act. I watch every relationship with the same care you'd watch your most important one 24/7.</p>
        </div>
      </section>

      {/* RELATED — connected to final CTA below, same cream bg */}
      <RetCurve from={C.sidebar} to="#F2EEE8" variant="leftRise" />
      <section className="ret-section ret-bg-cream r-full-bleed" style={{ paddingBottom: 24 }}>
        <div className="ret-section-inner">
          <div className="ret-section-head">
            <div className="ret-eyebrow">Related features</div>
            <h2 className="ret-h2">Better together.</h2>
          </div>
          <div className="ret-grid-3">
            {otherFeatures.map(f => (
              <div key={f.id} className="ret-card ret-card-hover" style={{ cursor: "pointer" }} onClick={() => setPage(f.id)}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.btn, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10 }}>{f.label}</div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 8, lineHeight: 1.3, letterSpacing: "-0.015em" }}>{f.headline}</h3>
                <p style={{ fontSize: 14, color: C.textSec, lineHeight: 1.6, margin: 0 }}>{f.sub}</p>
                <div style={{ marginTop: 14, fontSize: 13, fontWeight: 700, color: C.btn }}>Learn more →</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <RetFinalCTA
        h2="Know what to do first. Every single day."
        sub="Start free. See your first prioritized Today in 60 seconds."
        setPage={setPage}
      />
      <Footer setPage={setPage} />
    </div>
  );
}

function ScoringDemo() {
  const [dims, setDims] = useState({ Trust: 6, Loyalty: 7, Expectations: 7, Grace: 5 });
  const keys = ["Trust", "Loyalty", "Expectations", "Grace"];
  const avg = keys.reduce((a, k) => a + dims[k], 0) / keys.length;
  // map 0-10 avg to a 1-99 score, weighted slightly toward trust+grace
  const weighted = (dims.Trust * 1.4 + dims.Grace * 1.3 + dims.Loyalty + dims.Expectations) / 4.7;
  const score = Math.max(1, Math.min(99, Math.round(weighted * 9.6)));
  const band = score >= 90 ? ["Thriving", C.success, "Don't upsell. Don't ask for referrals. Leave it alone and let it compound."]
    : score >= 75 ? ["Healthy", C.primary, "Stable. Maintain cadence. Watch for drift without over-correcting."]
    : score >= 55 ? ["At risk", C.warning, "The most actionable band. Still salvageable — move fast."]
    : score >= 30 ? ["Critical", C.danger, "Something already broke. Call, don't email. Use Rai's scripts."]
    : ["Exiting", "#6B7280", "A \"pause\" is almost always an exit. Plan the offboard, protect the referral."];
  // combination signals fire on specific low pairs
  const combos = [];
  if (dims.Trust <= 5 && dims.Grace <= 5) combos.push("No Room to Operate");
  if (dims.Trust <= 4 && dims.Expectations <= 5) combos.push("Ice Wall");
  if (dims.Loyalty <= 4 && dims.Grace <= 4) combos.push("Silent Exit");
  const set = (k, v) => setDims(d => ({ ...d, [k]: v }));

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "stretch" }} className="sdemo-grid">
      <div style={{ background: C.card, border: "1px solid " + C.borderLight, borderRadius: 18, padding: "22px 24px", boxShadow: "0 18px 50px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 16 }}>Adjust the dimensions</div>
        {keys.map(k => (
          <div key={k} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 6 }}>
              <span style={{ color: C.textSec, fontWeight: 600 }}>{k}</span>
              <span style={{ fontWeight: 800, color: dims[k] <= 4 ? C.danger : dims[k] <= 6 ? C.warning : C.primary }}>{dims[k]}/10</span>
            </div>
            <input type="range" min="1" max="10" value={dims[k]} onChange={e => set(k, +e.target.value)} className="sdemo-range" style={{ width: "100%" }} />
          </div>
        ))}
      </div>
      <div style={{ background: C.card, border: "1px solid " + C.borderLight, borderRadius: 18, padding: "22px 24px", boxShadow: "0 18px 50px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 14 }}>Retention Score</div>
        <div style={{ width: 130, height: 130, borderRadius: "50%", background: band[1] + "18", border: "4px solid " + band[1] + "40", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.4s" }}>
          <span style={{ fontSize: 46, fontWeight: 900, color: band[1], lineHeight: 1, transition: "color 0.4s" }}>{score}</span>
        </div>
        <div style={{ marginTop: 14, fontSize: 12, fontWeight: 800, color: band[1], textTransform: "uppercase", letterSpacing: ".08em" }}>{band[0]}</div>
        <div style={{ marginTop: 8, fontSize: 13, color: C.textSec, lineHeight: 1.5, maxWidth: 240, minHeight: 58 }}>{band[2]}</div>
        <div style={{ marginTop: combos.length ? 16 : 0, display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "center", alignItems: "flex-start" }}>
          {combos.map(c => (
                <span key={c} style={{ padding: "6px 12px", background: C.danger + "15", borderRadius: 8, fontSize: 12, color: C.danger, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.danger }} />{c}
                </span>
              ))}
        </div>
      </div>
      <div style={{ gridColumn: "1 / -1", textAlign: "center", fontSize: 12.5, color: C.textMuted, fontStyle: "italic" }}>Drag a dimension down — watch the score fall and the risk patterns fire.</div>
    </div>
  );
}

function FeatureScoring({ setPage }) {
  return (
    <div>
      <RetPageStyles />
      <RetHero
        eyebrow="Clients"
        h1="A number that means something."
        sub="Every client gets a score from 1–99. It tells you exactly where the relationship stands — not where you hope it is."
        primaryCta="Start Free Trial"
        primaryAction="signup"
        setPage={setPage}
      />

      {/* DEMO + connected explanation (same bg) */}
      <RetCurve from="#F2EEE8" to={C.bg} variant="dome" />
      <section className="ret-section ret-bg-light r-full-bleed" style={{ paddingTop: 56, paddingBottom: 56 }}>
        <div className="ret-section-inner">
          <div className="ret-section-head">
            <div className="ret-eyebrow">See it work</div>
            <h2 className="ret-h2">Twelve dimensions. One honest number.</h2>
            <p className="ret-sub" style={{ margin: "0 auto" }}>Move a relationship dimension and watch the Retention Score recalculate — and the risk patterns fire when the wrong things go low together.</p>
          </div>
          <ScoringDemo />
        </div>
      </section>

      {/* How the score is built — connected tiles */}
      <section className="ret-section ret-bg-light r-full-bleed" style={{ paddingTop: 56 }}>
        <div className="ret-section-inner">
          <div className="ret-section-head">
            <div className="ret-eyebrow">How it works</div>
            <h2 className="ret-h2">How the score is built.</h2>
            <p className="ret-sub" style={{ maxWidth: 700, marginTop: 12 }}>
              The Retention Score isn't a gut feeling. It's the weighted output of how every relationship dimension is scored, adjusted for the facts that move risk, and updated every time you keep a profile current.
            </p>
          </div>
          <div className="ret-grid-3">
            {[
              { h: "Dimensional profiling", p: "Each client is scored on twelve dimensions — trust, loyalty, grace, and more. When the wrong pairs go low together, a combination fires to catch patterns no single metric can." },
              { h: "Qualifying info", p: "Hard facts adjust the number directly — late payments, a prior termination, competing vendors pull it down; a referral origin and every year of tenure nudge it up." },
              { h: "Profile context", p: "Revenue concentration, LTV, and tenure act as a multiplier on the Today page's sort — so the score you see reflects business impact, not just relationship state." },
            ].map((s, i) => (
              <div key={i} className="ret-card">
                <div style={{ fontSize: 11, fontWeight: 700, color: C.btn, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10 }}>0{i + 1}</div>
                <h3 className="ret-h3">{s.h}</h3>
                <p style={{ fontSize: 14.5, color: C.textSec, lineHeight: 1.6, margin: 0 }}>{s.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RAI VOICE MOMENT */}
      <RetCurve from={C.bg} to={C.sidebar} variant="leftRise" />
      <section className="r-full-bleed" style={{ background: C.sidebar, color: "#F4F0E6", padding: "84px 32px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 15, color: "#9DC4AC", marginBottom: 18 }}>How Rai thinks.</div>
          <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: "clamp(20px, 3vw, 27px)", lineHeight: 1.55, color: "#E8E4D8", borderLeft: "2px solid " + C.primaryLight, paddingLeft: 22 }}>
            "I've spent more hours than I can count watching how client relationships actually end. <span style={{ color: "#fff" }}>It's almost never the work. It's the email that didn't get sent, the check-in that slipped a month, the quiet client nobody worried about.</span> I read your whole book every day, so the small thing has to get through me before it ever becomes the big one."
          </div>
          <p style={{ fontSize: 16, lineHeight: 1.65, color: "#C8D2C9", marginTop: 36, maxWidth: 560 }}>The point was never to replace your judgment. It's to make sure nothing reaches it too late while there's still time to act. I watch every relationship with the same care you'd watch your most important one 24/7.</p>
        </div>
      </section>

      {/* RELATED + CTA connected on cream */}
      <RetCurve from={C.sidebar} to="#F2EEE8" variant="leftRise" />
      <section className="ret-section ret-bg-cream r-full-bleed" style={{ paddingBottom: 24 }}>
        <div className="ret-section-inner">
          <div className="ret-section-head">
            <div className="ret-eyebrow">Related features</div>
            <h2 className="ret-h2">Better together.</h2>
          </div>
          <div className="ret-grid-3">
            {PLATFORM_FEATURES.filter(f => f.id !== "feature-scoring").slice(0, 3).map(f => (
              <div key={f.id} className="ret-card ret-card-hover" style={{ cursor: "pointer" }} onClick={() => setPage(f.id)}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.btn, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10 }}>{f.label}</div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 8, lineHeight: 1.3, letterSpacing: "-0.015em" }}>{f.headline}</h3>
                <p style={{ fontSize: 14, color: C.textSec, lineHeight: 1.6, margin: 0 }}>{f.sub}</p>
                <div style={{ marginTop: 14, fontSize: 13, fontWeight: 700, color: C.btn }}>Learn more →</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <RetFinalCTA
        h2="Know exactly where every relationship stands."
        sub="Start free. Your first client is scored in minutes."
        setPage={setPage}
      />
      <Footer setPage={setPage} />
    </div>
  );
}

function HealthCheckDemo() {
  const observations = [
    {
      id: "compounder", chip: "The Quiet Compounder", accent: C.btn,
      eyebrow: "THE QUIET COMPOUNDER", headline: "Six years of steady work is a statement.",
      read: "Hartwell & Cole is sitting at a 90 with 15 logged activities in the last 30 days. Tasks completing, meetings landing, notes written. No fanfare, just work.",
      stats: [["1", "CLIENTS"], ["90", "AVG SCORE"], ["15", "ACTIVITY 30D"]],
    },
    {
      id: "drift", chip: "Quiet Drift", accent: C.warning,
      eyebrow: "QUIET DRIFT", headline: "Two of your strongest just went quiet at once.",
      read: "Oakline and Maplewood both crossed 21 days without contact this week — and both were 80+ a month ago. Nothing's broken yet. That's why it's worth a look.",
      stats: [["2", "CLIENTS"], ["83", "AVG SCORE"], ["21d", "SINCE CONTACT"]],
    },
    {
      id: "win", chip: "Unclaimed Win", accent: C.success,
      eyebrow: "UNCLAIMED WIN", headline: "You delivered. Nobody asked what's next.",
      read: "Northvane's project wrapped 9 days ago at a 91, and the thread's been silent since. A finished win with no follow-up is where renewals quietly go to die.",
      stats: [["1", "CLIENTS"], ["91", "AVG SCORE"], ["9d", "SINCE DELIVERY"]],
    },
    {
      id: "fragile", chip: "Fragile High", accent: C.danger,
      eyebrow: "FRAGILE HIGH", headline: "High score, thin foundation, needs an eye.",
      read: "Broadleaf reads 76, but it's resting almost entirely on tenure — trust and grace are both soft underneath. The number looks fine. The structure under it is the story.",
      stats: [["1", "CLIENTS"], ["76", "AVG SCORE"], ["2", "SOFT DIMENSIONS"]],
    },
  ];
  const [active, setActive] = useState("compounder");
  const obs = observations.find(o => o.id === active);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "center", gap: 9, marginBottom: 20, flexWrap: "wrap" }}>
        {observations.map(o => (
          <button key={o.id} onClick={() => setActive(o.id)} className={"trd-chip" + (active === o.id ? " trd-chip-on" : "")}>{o.chip}</button>
        ))}
      </div>
      <div style={{ background: C.primarySoft, border: "1px solid " + C.primary + "22", borderRadius: 20, padding: "26px 30px", boxShadow: "0 18px 50px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: obs.accent, flexShrink: 0 }} />
          <span style={{ fontFamily: "'Courier New', monospace", fontSize: 12.5, fontWeight: 800, letterSpacing: "0.18em", color: C.text }}>{obs.eyebrow}</span>
          <span style={{ marginLeft: "auto", fontFamily: "'Courier New', monospace", fontSize: 12, letterSpacing: "0.12em", color: C.textMuted }}>№ 11 / WK 25</span>
        </div>
        <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: "clamp(20px, 3vw, 26px)", fontWeight: 700, color: C.text, lineHeight: 1.2, letterSpacing: "-0.01em", marginBottom: 14 }}>{obs.headline}</div>
        <div style={{ fontSize: 15, color: C.textSec, lineHeight: 1.6, maxWidth: 560, marginBottom: 22 }}>{obs.read}</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 32, flexWrap: "wrap" }}>
          {obs.stats.map(([n, label]) => (
            <div key={label}>
              <div style={{ fontSize: 28, fontWeight: 900, color: C.text, lineHeight: 1 }}>{n}</div>
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: 10.5, letterSpacing: "0.1em", color: C.textMuted, marginTop: 6 }}>{label}</div>
            </div>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 18 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.btn }}>Unpack with Rai</span>
            <span style={{ fontSize: 14, color: C.textMuted }}>Dismiss</span>
          </div>
        </div>
      </div>
      <div style={{ textAlign: "center", fontSize: 12.5, color: C.textMuted, marginTop: 14, fontStyle: "italic" }}>Each week, Rai surfaces the patterns you'd never have time to find.</div>
    </div>
  );
}

function RaiScriptDemo() {
  const scenarios = [
    {
      id: "email", label: "Complete this task",
      variants: {
        default: "Hi Rachel, wanted to check in before the week gets away from me. How are things looking on your end with the Q2 rollout? If it's useful, I've got time Thursday or Friday to talk through anything. No rush if all's quiet.",
        warmer: "Hi Rachel, you've been on my mind this week. I know Q2 has been a lot, and I want to make sure you've got what you need from us. Would love to catch up properly. Thursday or Friday work? Even just to say hi.",
        shorter: "Hi Rachel, checking in on the Q2 rollout. Free Thursday or Friday if you want to talk it through. No rush.",
      },
    },
    {
      id: "quiet", label: "They've gone quiet",
      variants: {
        default: "Hi Rachel, noticed it's been a few weeks and didn't want to let that slide. No agenda. I just want to make sure things are landing the way you need. Got 15 minutes this week for a quick call?",
        warmer: "Hi Rachel, it's been a little too quiet and I miss the regular rhythm we had. Nothing's wrong on my end, I just value the relationship and want to keep it close. Free for a quick call this week?",
        shorter: "Hi Rachel, it's been a few weeks. Everything good? Happy to grab 15 minutes this week if useful.",
      },
    },
    {
      id: "late", label: "Late payment, again",
      variants: {
        default: "Hey Marcus, quick one. The last two invoices have run past terms, and rather than let it become a thing, I'd rather just ask directly. Is everything okay on your end? Happy to find a cadence that works better for you.",
        warmer: "Hey Marcus, I hope things are okay. The last couple invoices ran late and I'd rather check in than assume anything. If there's a billing rhythm that fits your side better, let's set it up. No stress either way.",
        shorter: "Hey Marcus, the last two invoices are past terms. Everything okay? Happy to adjust the schedule if that helps.",
      },
    },
  ];
  const [active, setActive] = useState("email");
  const [tone, setTone] = useState("default");
  const sc = scenarios.find(s => s.id === active);
  const pick = (id) => { setActive(id); setTone("default"); };
  const toneLabel = { default: "Rai's draft", warmer: "Warmer", shorter: "Shorter" };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "center", gap: 9, marginBottom: 18, flexWrap: "wrap" }}>
        {scenarios.map(s => (
          <button key={s.id} onClick={() => pick(s.id)} className={"trd-chip" + (active === s.id ? " trd-chip-on" : "")}>{s.label}</button>
        ))}
      </div>
      <div style={{ background: C.card, border: "1px solid " + C.borderLight, borderRadius: 18, padding: "8px", boxShadow: "0 18px 50px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px 12px", borderBottom: "1px solid " + C.borderLight }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: C.btn, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13 }}>✦</div>
          <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{tone === "default" ? "Rai drafted this for you" : toneLabel[tone] + " version"}</span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: C.textMuted, fontStyle: "italic" }}>in your voice</span>
        </div>
        <div style={{ padding: "18px 18px", fontSize: 15, color: C.text, lineHeight: 1.65, minHeight: 92 }}>{sc.variants[tone]}</div>
        <div style={{ display: "flex", gap: 8, padding: "0 16px 14px", flexWrap: "wrap" }}>
          <button onClick={() => setTone("warmer")} className="trd-chip" style={{ fontSize: 12.5, padding: "7px 14px" }} aria-pressed={tone === "warmer"}>{tone === "warmer" ? "✓ Warmer" : "Make it warmer"}</button>
          <button onClick={() => setTone("shorter")} className="trd-chip" style={{ fontSize: 12.5, padding: "7px 14px" }} aria-pressed={tone === "shorter"}>{tone === "shorter" ? "✓ Shorter" : "Make it shorter"}</button>
          {tone !== "default" && (
            <button onClick={() => setTone("default")} className="trd-chip trd-chip-muted" style={{ fontSize: 12.5, padding: "7px 14px" }}>↺ Reset</button>
          )}
          <span className="rai-send">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
            Send as text or email
          </span>
        </div>
      </div>
      <div style={{ textAlign: "center", fontSize: 12.5, color: C.textMuted, marginTop: 14, fontStyle: "italic" }}>Pick a situation, shape the tone, send it straight from Retayned.</div>
    </div>
  );
}

function RolodexDemo() {
  const initial = [
    { id: "d", n: "Devi Kapoor", sub: "former client", warmth: "cold", due: -13, queued: true },
    { id: "m", n: "Marcus Hale", sub: "referred you twice", warmth: "cooling", due: 6, queued: true },
    { id: "p", n: "Priya Nair", sub: "left on great terms", warmth: "warm", due: 21, queued: false },
    { id: "j", n: "Jonah Reed", sub: "past project", warmth: "cold", due: null, queued: false },
  ];
  const [people, setPeople] = useState(initial);
  const [note, setNote] = useState("");
  const warmthColor = (w) => (w === "warm" ? C.success : w === "cooling" ? C.warning : C.textMuted);
  const counts = { warm: 0, cooling: 0, cold: 0 };
  people.forEach(p => { counts[p.warmth]++; });
  const queue = people.filter(p => p.queued).sort((a, b) => (a.due ?? 999) - (b.due ?? 999));

  const dueLabel = (d) => d === null ? "no check-in set" : d < 0 ? `${-d}d overdue` : d === 0 ? "due today" : `due in ${d}d`;
  const dueColor = (d) => d !== null && d < 0 ? C.danger : C.textMuted;

  const reachOut = (id) => {
    setPeople(ps => ps.map(p => p.id === id ? { ...p, warmth: "warm", due: 30, queued: false } : p));
    const who = people.find(p => p.id === id);
    setNote(`You reached out to ${who.n.split(" ")[0]}. They're warm again, and the next check-in is already 30 days out.`);
  };
  const schedule = () => {
    setPeople(ps => ps.map(p => p.id === "p" ? { ...p, queued: true, due: 14 } : p));
    setNote("Priya's on the calendar for a check-in in 14 days. You'll never have to remember it again.");
  };
  const addFormer = () => {
    setPeople(ps => ps.some(p => p.id === "x") ? ps : [...ps, { id: "x", n: "Hartwell & Cole", sub: "wrapped a project · kept", warmth: "cooling", due: 7, queued: true }]);
    setNote("Hartwell & Cole filed as a former client, not a closed account. The project ended; the relationship didn't.");
  };
  const reset = () => { setPeople(initial); setNote(""); };

  const Avatar = ({ n, w }) => (
    <div style={{ width: 32, height: 32, borderRadius: "50%", background: w === "warm" ? C.success : w === "cooling" ? "#FBF1DD" : "#EEF1ED", color: w === "warm" ? "#fff" : warmthColor(w), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 800, flexShrink: 0 }}>{n.split(" ").map(x => x[0]).join("").slice(0, 2)}</div>
  );

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "center", gap: 9, marginBottom: 20, flexWrap: "wrap" }}>
        <button onClick={schedule} className="trd-chip">Schedule a check-in</button>
        <button onClick={addFormer} className="trd-chip">Add a former client</button>
        <button onClick={reset} className="trd-chip trd-chip-muted">↺ Reset</button>
      </div>
      <div style={{ background: C.card, border: "1px solid " + C.borderLight, borderRadius: 18, boxShadow: "0 18px 50px rgba(0,0,0,0.05)", overflow: "hidden" }}>
        {/* Header strip: warmth tiers inline + label */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "16px 20px", borderBottom: "1px solid " + C.borderLight, background: C.primaryGhost, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            {[["warm", "Warm"], ["cooling", "Cooling"], ["cold", "Cold"]].map(([k, label]) => (
              <span key={k} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: C.textSec }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: warmthColor(k) }} />
                {label}<b style={{ color: C.text, marginLeft: 1, transition: "all 0.3s" }}>{counts[k]}</b>
              </span>
            ))}
          </div>
          <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: C.textMuted }}>Check-in queue</span>
        </div>
        {/* Queue rows */}
        <div style={{ padding: 8 }}>
          {queue.length === 0 && <div style={{ padding: "16px 12px", fontSize: 13, color: C.textMuted, fontStyle: "italic" }}>All caught up. Schedule the next one whenever you like.</div>}
          {queue.map(p => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 12px", borderRadius: 10, transition: "background 0.3s" }}>
              <Avatar n={p.n} w={p.warmth} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{p.n}</div>
                <div style={{ fontSize: 11, color: dueColor(p.due), marginTop: 1 }}>{p.sub} · {dueLabel(p.due)}</div>
              </div>
              <button onClick={() => reachOut(p.id)} className="trd-chip" style={{ fontSize: 11.5, padding: "6px 12px", flexShrink: 0 }}>Reach out →</button>
            </div>
          ))}
        </div>
        {/* Footer note */}
        <div style={{ padding: "11px 20px", borderTop: "1px solid " + C.borderLight, fontSize: 11.5, color: C.textMuted }}>Nothing leaves the book — people just move between tiers.</div>
      </div>
      {note && (
        <div style={{ marginTop: 14, padding: "13px 16px", background: "#EFE9FB", borderRadius: 12, fontSize: 13, color: "#3e2f72", lineHeight: 1.55, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ color: C.btn, fontSize: 15, flexShrink: 0 }}>✦</span><span>{note}</span>
        </div>
      )}
      <div style={{ textAlign: "center", fontSize: 12.5, color: C.textMuted, marginTop: 14, fontStyle: "italic" }}>Work the queue, schedule the next touch, and keep every past client in reach.</div>
    </div>
  );
}

function ReferralsDemo() {
  const [readiness, setReadiness] = useState(48);
  const ready = readiness >= 75;
  const barColor = ready ? C.success : readiness >= 50 ? C.warning : C.textMuted;
  const factors = [
    ["Loyalty", Math.min(10, Math.round(readiness / 10))],
    ["Trust depth", Math.min(10, Math.round(readiness / 11))],
    ["Recent win", readiness >= 70 ? 9 : readiness >= 50 ? 6 : 3],
  ];
  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <div style={{ background: C.card, border: "1px solid " + C.borderLight, borderRadius: 18, padding: "24px 26px", boxShadow: "0 18px 50px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Northvane Studio</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: barColor }}>{readiness} / 100</span>
        </div>
        <div style={{ fontSize: 11.5, color: C.textMuted, marginBottom: 16 }}>Referral readiness</div>
        <div style={{ height: 12, borderRadius: 100, background: C.surfaceWarm, overflow: "hidden", marginBottom: 4 }}>
          <div style={{ height: "100%", width: readiness + "%", background: barColor, borderRadius: 100, transition: "width 0.4s, background 0.4s" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: C.textMuted, marginBottom: 18 }}>
          <span>Too soon</span><span>Ready to ask →</span>
        </div>
        <input type="range" min="10" max="98" value={readiness} onChange={e => setReadiness(+e.target.value)} className="sdemo-range" style={{ width: "100%", marginBottom: 18 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
          {factors.map(([name, v]) => (
            <div key={name} style={{ background: C.bg, borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 17, fontWeight: 900, color: v >= 7 ? C.success : v >= 5 ? C.warning : C.textMuted }}>{v}/10</div>
              <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 2 }}>{name}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: "14px 16px", borderRadius: 12, background: ready ? C.primarySoft : C.surfaceWarm, transition: "background 0.4s", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ color: ready ? C.btn : C.textMuted, fontSize: 15, flexShrink: 0 }}>✦</span>
          <span style={{ fontSize: 13, color: ready ? "#3e2f72" : C.textMuted, lineHeight: 1.55 }}>{ready ? "Northvane crossed the line. Rai drafted the ask — make the intro while the trust is high." : "Not yet. Asking now would cost you more than the referral is worth. Rai will tell you the moment it's time."}</span>
        </div>
      </div>
      <div style={{ textAlign: "center", fontSize: 12.5, color: C.textMuted, marginTop: 14, fontStyle: "italic" }}>Slide the readiness up — the ask unlocks only when it should.</div>
    </div>
  );
}

function WorkersDemo() {
  const [delegated, setDelegated] = useState(false);
  const canSee = ["The one task you assigned", "The single client it's for", "A due date and your note"];
  const cantSee = ["The rest of your book", "Retention scores & health", "Revenue, notes, or history"];
  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
        <button onClick={() => setDelegated(d => !d)} className={"trd-chip" + (delegated ? " trd-chip-on" : "")} style={{ fontSize: 13.5, padding: "11px 20px" }}>
          {delegated ? "✓ Task handed off to a worker" : "→ Hand this task to a worker"}
        </button>
      </div>
      <div style={{ background: C.card, border: "1px solid " + C.borderLight, borderRadius: 18, padding: "22px 24px", boxShadow: "0 18px 50px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 16, borderBottom: "1px solid " + C.borderLight, marginBottom: 16 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: delegated ? C.primarySoft : C.surfaceWarm, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, transition: "background 0.3s" }}>{delegated ? "🔗" : "📋"}</div>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: C.text }}>Design the Q3 onboarding deck</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{delegated ? "Sent to Jordan (VA) via secure link · no login" : "Assigned to you"}</div>
          </div>
        </div>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 12, opacity: delegated ? 1 : 0.5, transition: "opacity 0.3s" }}>{delegated ? "What Jordan can see" : "Toggle the handoff to see scoped access"}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, opacity: delegated ? 1 : 0.35, transition: "opacity 0.4s" }} className="sdemo-grid">
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.success, marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>✓ Can see</div>
            {canSee.map(x => <div key={x} style={{ fontSize: 12.5, color: C.textSec, padding: "6px 0", borderBottom: "1px dashed " + C.borderLight, lineHeight: 1.4 }}>{x}</div>)}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.danger, marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>✕ Can't see</div>
            {cantSee.map(x => <div key={x} style={{ fontSize: 12.5, color: C.textMuted, padding: "6px 0", borderBottom: "1px dashed " + C.borderLight, lineHeight: 1.4 }}>{x}</div>)}
          </div>
        </div>
      </div>
      <div style={{ textAlign: "center", fontSize: 12.5, color: C.textMuted, marginTop: 14, fontStyle: "italic" }}>Hand off the task — never the keys to your book.</div>
    </div>
  );
}

function FeatureHealth({ setPage }) {
  return (
    <div>
      <RetPageStyles />
      <RetHero
        eyebrow="Health"
        h1="The patterns you'd never have time to find."
        sub="Every week, Rai studies your whole book and surfaces what's quietly working, quietly slipping, or quietly overlooked — the high-level reads a frontier model catches that you'd miss in the day-to-day. Keep profiles current, and the reads stay sharp."
        primaryCta="Start Free Trial"
        primaryAction="signup"
        setPage={setPage}
      />

      <RetCurve from="#F2EEE8" to={C.bg} variant="dome" />
      <section className="ret-section ret-bg-light r-full-bleed" style={{ paddingTop: 56, paddingBottom: 56 }}>
        <div className="ret-section-inner">
          <div className="ret-section-head">
            <div className="ret-eyebrow">See it work</div>
            <h2 className="ret-h2">Rai's weekly read on your book.</h2>
            <p className="ret-sub" style={{ margin: "0 auto" }}>Each week brings a new observation — a thriving client you've stopped noticing, a quiet drift, an unclaimed win. Cycle through the kinds of patterns Rai surfaces.</p>
          </div>
          <HealthCheckDemo />
        </div>
      </section>

      <section className="ret-section ret-bg-light r-full-bleed" style={{ paddingTop: 56 }}>
        <div className="ret-section-inner">
          <div className="ret-section-head">
            <div className="ret-eyebrow">How it works</div>
            <h2 className="ret-h2">A second set of eyes, every week.</h2>
            <p className="ret-sub" style={{ maxWidth: 700, marginTop: 12 }}>
              You can't re-read your whole book every Monday. Rai does — and tells you the few things actually worth your attention, plus when a profile's gone stale enough to dull the read.
            </p>
          </div>
          <div className="ret-grid-3">
            {[
              { h: "Rai watches the book", p: "Scores, activity, cadence, the patterns across every relationship at once. Each week Rai surfaces a handful of observations before they become business-wide problems." },
              { h: "Frontier-model reads", p: "Not a rules engine — a frontier model reading your book the way a sharp partner would. It catches the high-level things no single metric flags: fragile highs, unclaimed wins, the slow fade." },
              { h: "Keep profiles current", p: "When a relationship's changed — scope, contacts, pace — a quick profile update keeps Rai's scoring honest. The observations are only as sharp as the profiles behind them." },
            ].map((s, i) => (
              <div key={i} className="ret-card">
                <div style={{ fontSize: 11, fontWeight: 700, color: C.btn, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10 }}>0{i + 1}</div>
                <h3 className="ret-h3">{s.h}</h3>
                <p style={{ fontSize: 14.5, color: C.textSec, lineHeight: 1.6, margin: 0 }}>{s.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <RetCurve from={C.bg} to={C.sidebar} variant="leftRise" />
      <section className="r-full-bleed" style={{ background: C.sidebar, color: "#F4F0E6", padding: "84px 32px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 15, color: "#9DC4AC", marginBottom: 18 }}>How Rai thinks.</div>
          <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: "clamp(20px, 3vw, 27px)", lineHeight: 1.55, color: "#E8E4D8", borderLeft: "2px solid " + C.primaryLight, paddingLeft: 22 }}>
            "I've spent more hours than I can count watching how client relationships actually end. <span style={{ color: "#fff" }}>It's almost never the work. It's the email that didn't get sent, the check-in that slipped a month, the quiet client nobody worried about.</span> I read your whole book every day, so the small thing has to get through me before it ever becomes the big one."
          </div>
          <p style={{ fontSize: 16, lineHeight: 1.65, color: "#C8D2C9", marginTop: 36, maxWidth: 560 }}>The point was never to replace your judgment. It's to make sure nothing reaches it too late while there's still time to act. I watch every relationship with the same care you'd watch your most important one 24/7.</p>
        </div>
      </section>

      <RetCurve from={C.sidebar} to="#F2EEE8" variant="leftRise" />
      <section className="ret-section ret-bg-cream r-full-bleed" style={{ paddingBottom: 24 }}>
        <div className="ret-section-inner">
          <div className="ret-section-head">
            <div className="ret-eyebrow">Related features</div>
            <h2 className="ret-h2">Better together.</h2>
          </div>
          <div className="ret-grid-3">
            {PLATFORM_FEATURES.filter(f => f.id !== "feature-health").slice(0, 3).map(f => (
              <div key={f.id} className="ret-card ret-card-hover" style={{ cursor: "pointer" }} onClick={() => setPage(f.id)}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.btn, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10 }}>{f.label}</div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 8, lineHeight: 1.3, letterSpacing: "-0.015em" }}>{f.headline}</h3>
                <p style={{ fontSize: 14, color: C.textSec, lineHeight: 1.6, margin: 0 }}>{f.sub}</p>
                <div style={{ marginTop: 14, fontSize: 13, fontWeight: 700, color: C.btn }}>Learn more →</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <RetFinalCTA
        h2="Let Rai read the book you don't have time to."
        sub="Start free. Get your first weekly observations in days."
        setPage={setPage}
      />
      <Footer setPage={setPage} />
    </div>
  );
}

function FeatureRai({ setPage }) {
  return (
    <div>
      <RetPageStyles />
      <RetHero
        eyebrow="Rai"
        h1="She writes the words you need when it matters most."
        sub="Rai is an AI advisor calibrated to your specific relationships. When you don't know what to say — the opening line, the tone, whether to call or email — Rai gives you the script."
        primaryCta="Start Free Trial"
        primaryAction="signup"
        setPage={setPage}
      />

      <RetCurve from="#F2EEE8" to={C.bg} variant="dome" />
      <section className="ret-section ret-bg-light r-full-bleed" style={{ paddingTop: 56, paddingBottom: 56 }}>
        <div className="ret-section-inner">
          <div className="ret-section-head">
            <div className="ret-eyebrow">See it work</div>
            <h2 className="ret-h2">You name the moment. Rai writes the words.</h2>
            <p className="ret-sub" style={{ margin: "0 auto" }}>Pick a situation you've been avoiding — Rai drafts the message in your voice, ready to send or soften.</p>
          </div>
          <RaiScriptDemo />
        </div>
      </section>

      <section className="ret-section ret-bg-light r-full-bleed" style={{ paddingTop: 56 }}>
        <div className="ret-section-inner">
          <div className="ret-section-head">
            <div className="ret-eyebrow">How it works</div>
            <h2 className="ret-h2">Rai isn't a chatbot. She's a practitioner.</h2>
            <p className="ret-sub" style={{ maxWidth: 700, marginTop: 12 }}>
              Built from hundreds of real client-retention scenarios, Rai reads the relationship before she writes a word.
            </p>
          </div>
          <div className="ret-grid-3">
            {[
              { h: "She has context", p: "Every time you Talk to Rai about a client, she pulls the current Retention Score, the active combinations, the last Health Check, the velocity trend — then writes." },
              { h: "She knows your tone", p: "Warm, steady tone. Specific, not vague. \"Call her — not email\" rather than \"consider reaching out.\" Rai tells you exactly what to do and exactly what to say." },
              { h: "She adapts with time", p: "Your blunt client gets a blunt script. Your formal client gets a formal one. Rai knows each relationship's style — she doesn't talk to Rachel the way she talks to Jordan." },
            ].map((s, i) => (
              <div key={i} className="ret-card">
                <div style={{ fontSize: 11, fontWeight: 700, color: C.btn, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10 }}>0{i + 1}</div>
                <h3 className="ret-h3">{s.h}</h3>
                <p style={{ fontSize: 14.5, color: C.textSec, lineHeight: 1.6, margin: 0 }}>{s.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <RetCurve from={C.bg} to={C.sidebar} variant="leftRise" />
      <section className="r-full-bleed" style={{ background: C.sidebar, color: "#F4F0E6", padding: "84px 32px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 15, color: "#9DC4AC", marginBottom: 18 }}>How Rai thinks.</div>
          <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: "clamp(20px, 3vw, 27px)", lineHeight: 1.55, color: "#E8E4D8", borderLeft: "2px solid " + C.primaryLight, paddingLeft: 22 }}>
            "I've spent more hours than I can count watching how client relationships actually end. <span style={{ color: "#fff" }}>It's almost never the work. It's the email that didn't get sent, the check-in that slipped a month, the quiet client nobody worried about.</span> I read your whole book every day, so the small thing has to get through me before it ever becomes the big one."
          </div>
          <p style={{ fontSize: 16, lineHeight: 1.65, color: "#C8D2C9", marginTop: 36, maxWidth: 560 }}>The point was never to replace your judgment. It's to make sure nothing reaches it too late while there's still time to act. I watch every relationship with the same care you'd watch your most important one 24/7.</p>
        </div>
      </section>

      <RetCurve from={C.sidebar} to="#F2EEE8" variant="leftRise" />
      <section className="ret-section ret-bg-cream r-full-bleed" style={{ paddingBottom: 24 }}>
        <div className="ret-section-inner">
          <div className="ret-section-head">
            <div className="ret-eyebrow">Related features</div>
            <h2 className="ret-h2">Better together.</h2>
          </div>
          <div className="ret-grid-3">
            {PLATFORM_FEATURES.filter(f => f.id !== "feature-rai").slice(0, 3).map(f => (
              <div key={f.id} className="ret-card ret-card-hover" style={{ cursor: "pointer" }} onClick={() => setPage(f.id)}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.btn, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10 }}>{f.label}</div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 8, lineHeight: 1.3, letterSpacing: "-0.015em" }}>{f.headline}</h3>
                <p style={{ fontSize: 14, color: C.textSec, lineHeight: 1.6, margin: 0 }}>{f.sub}</p>
                <div style={{ marginTop: 14, fontSize: 13, fontWeight: 700, color: C.btn }}>Learn more →</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <RetFinalCTA
        h2="Never stare at a blank message again."
        sub="Start free. Ask Rai your first hard question in minutes."
        setPage={setPage}
      />
      <Footer setPage={setPage} />
    </div>
  );
}

function FeatureRolodex({ setPage }) {
  return (
    <div>
      <RetPageStyles />
      <RetHero
        eyebrow="Rolodex"
        h1="Former clients aren't dead. They're future revenue."
        sub="The Rolodex tracks who left, how it ended, and whether they'd come back. One-off projects become re-engagement opportunities. Your pipeline is forward-looking."
        primaryCta="Start Free Trial"
        primaryAction="signup"
        setPage={setPage}
      />

      <RetCurve from="#F2EEE8" to={C.bg} variant="dome" />
      <section className="ret-section ret-bg-light r-full-bleed" style={{ paddingTop: 56, paddingBottom: 56 }}>
        <div className="ret-section-inner">
          <div className="ret-section-head">
            <div className="ret-eyebrow">See it work</div>
            <h2 className="ret-h2">Keep every past client in reach.</h2>
            <p className="ret-sub" style={{ margin: "0 auto" }}>A check-in queue tells you who's due, scheduling keeps the cadence, and former clients stay filed as relationships. Work the queue and watch the book stay warm.</p>
          </div>
          <RolodexDemo />
        </div>
      </section>

      <section className="ret-section ret-bg-light r-full-bleed" style={{ paddingTop: 56 }}>
        <div className="ret-section-inner">
          <div className="ret-section-head">
            <div className="ret-eyebrow">How it works</div>
            <h2 className="ret-h2">A pipeline that looks backward to move forward.</h2>
            <p className="ret-sub" style={{ maxWidth: 700, marginTop: 12 }}>
              Most CRMs forget a client the day the contract ends. The Rolodex keeps the relationship alive — and tells you when it's worth reviving.
            </p>
          </div>
          <div className="ret-grid-3">
            {[
              { h: "Remembers the end", p: "Every former client carries the context — why they left, on what terms, whether the door's open. A price walk-away isn't a falling-out, and the Rolodex knows the difference." },
              { h: "Watches for triggers", p: "A funding round, a new role, a job change — the events that make a dormant client suddenly reachable again. The Rolodex surfaces them so you reach out at the right moment, not a random one." },
              { h: "Warms the cold ones", p: "When a trigger fires, the name moves up and the tag turns warm. Rai drafts the no-pressure reconnect — we help the opening come to you by always being there at the right time." },
            ].map((s, i) => (
              <div key={i} className="ret-card">
                <div style={{ fontSize: 11, fontWeight: 700, color: C.btn, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10 }}>0{i + 1}</div>
                <h3 className="ret-h3">{s.h}</h3>
                <p style={{ fontSize: 14.5, color: C.textSec, lineHeight: 1.6, margin: 0 }}>{s.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <RetCurve from={C.bg} to={C.sidebar} variant="leftRise" />
      <section className="r-full-bleed" style={{ background: C.sidebar, color: "#F4F0E6", padding: "84px 32px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 15, color: "#9DC4AC", marginBottom: 18 }}>How Rai thinks.</div>
          <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: "clamp(20px, 3vw, 27px)", lineHeight: 1.55, color: "#E8E4D8", borderLeft: "2px solid " + C.primaryLight, paddingLeft: 22 }}>
            "I've spent more hours than I can count watching how client relationships actually end. <span style={{ color: "#fff" }}>It's almost never the work. It's the email that didn't get sent, the check-in that slipped a month, the quiet client nobody worried about.</span> I read your whole book every day, so the small thing has to get through me before it ever becomes the big one."
          </div>
          <p style={{ fontSize: 16, lineHeight: 1.65, color: "#C8D2C9", marginTop: 36, maxWidth: 560 }}>The point was never to replace your judgment. It's to make sure nothing reaches it too late while there's still time to act. I watch every relationship with the same care you'd watch your most important one 24/7.</p>
        </div>
      </section>

      <RetCurve from={C.sidebar} to="#F2EEE8" variant="leftRise" />
      <section className="ret-section ret-bg-cream r-full-bleed" style={{ paddingBottom: 24 }}>
        <div className="ret-section-inner">
          <div className="ret-section-head">
            <div className="ret-eyebrow">Related features</div>
            <h2 className="ret-h2">Better together.</h2>
          </div>
          <div className="ret-grid-3">
            {PLATFORM_FEATURES.filter(f => f.id !== "feature-rolodex").slice(0, 3).map(f => (
              <div key={f.id} className="ret-card ret-card-hover" style={{ cursor: "pointer" }} onClick={() => setPage(f.id)}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.btn, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10 }}>{f.label}</div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 8, lineHeight: 1.3, letterSpacing: "-0.015em" }}>{f.headline}</h3>
                <p style={{ fontSize: 14, color: C.textSec, lineHeight: 1.6, margin: 0 }}>{f.sub}</p>
                <div style={{ marginTop: 14, fontSize: 13, fontWeight: 700, color: C.btn }}>Learn more →</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <RetFinalCTA
        h2="Your next client might be an old one."
        sub="Start free. Bring your former clients back into view."
        setPage={setPage}
      />
      <Footer setPage={setPage} />
    </div>
  );
}

function FeatureReferrals({ setPage }) {
  return (
    <div>
      <RetPageStyles />
      <RetHero
        eyebrow="Referrals"
        h1="Your best clients send you their friends."
        sub="Retayned tracks referral readiness based on loyalty, trust, and relationship depth. When a client is ready to refer, the system knows before you do."
        primaryCta="Start Free Trial"
        primaryAction="signup"
        setPage={setPage}
      />

      <RetCurve from="#F2EEE8" to={C.bg} variant="dome" />
      <section className="ret-section ret-bg-light r-full-bleed" style={{ paddingTop: 56, paddingBottom: 56 }}>
        <div className="ret-section-inner">
          <div className="ret-section-head">
            <div className="ret-eyebrow">See it work</div>
            <h2 className="ret-h2">The ask unlocks only when it should.</h2>
            <p className="ret-sub" style={{ margin: "0 auto" }}>Ask too early and you spend trust you haven't earned. Slide a client's readiness and watch the moment the ask becomes the right move.</p>
          </div>
          <ReferralsDemo />
        </div>
      </section>

      <section className="ret-section ret-bg-light r-full-bleed" style={{ paddingTop: 56 }}>
        <div className="ret-section-inner">
          <div className="ret-section-head">
            <div className="ret-eyebrow">How it works</div>
            <h2 className="ret-h2">Timing is the whole game.</h2>
            <p className="ret-sub" style={{ maxWidth: 700, marginTop: 12 }}>
              A referral asked at the wrong time costs you more than the referral is worth. Retayned watches for the right one so you never have to guess.
            </p>
          </div>
          <div className="ret-grid-3">
            {[
              { h: "A unique algo", p: "Loyalty, trust depth, and a recent win combine into a single readiness read. It's not whether you want the referral — it's whether the relationship can carry the ask." },
              { h: "Waits for the win", p: "The best moment to ask is right after you've delivered something they're thrilled about. Retayned catches that window and tells you it's open." },
              { h: "Hands you the words", p: "When readiness crosses the line, Rai drafts the ask — specific, low-pressure, and easy to say yes to. You make the intro; the system made the timing." },
            ].map((s, i) => (
              <div key={i} className="ret-card">
                <div style={{ fontSize: 11, fontWeight: 700, color: C.btn, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10 }}>0{i + 1}</div>
                <h3 className="ret-h3">{s.h}</h3>
                <p style={{ fontSize: 14.5, color: C.textSec, lineHeight: 1.6, margin: 0 }}>{s.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <RetCurve from={C.bg} to={C.sidebar} variant="leftRise" />
      <section className="r-full-bleed" style={{ background: C.sidebar, color: "#F4F0E6", padding: "84px 32px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 15, color: "#9DC4AC", marginBottom: 18 }}>How Rai thinks.</div>
          <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: "clamp(20px, 3vw, 27px)", lineHeight: 1.55, color: "#E8E4D8", borderLeft: "2px solid " + C.primaryLight, paddingLeft: 22 }}>
            "I've spent more hours than I can count watching how client relationships actually end. <span style={{ color: "#fff" }}>It's almost never the work. It's the email that didn't get sent, the check-in that slipped a month, the quiet client nobody worried about.</span> I read your whole book every day, so the small thing has to get through me before it ever becomes the big one."
          </div>
          <p style={{ fontSize: 16, lineHeight: 1.65, color: "#C8D2C9", marginTop: 36, maxWidth: 560 }}>The point was never to replace your judgment. It's to make sure nothing reaches it too late while there's still time to act. I watch every relationship with the same care you'd watch your most important one 24/7.</p>
        </div>
      </section>

      <RetCurve from={C.sidebar} to="#F2EEE8" variant="leftRise" />
      <section className="ret-section ret-bg-cream r-full-bleed" style={{ paddingBottom: 24 }}>
        <div className="ret-section-inner">
          <div className="ret-section-head">
            <div className="ret-eyebrow">Related features</div>
            <h2 className="ret-h2">Better together.</h2>
          </div>
          <div className="ret-grid-3">
            {PLATFORM_FEATURES.filter(f => f.id !== "feature-referrals").slice(0, 3).map(f => (
              <div key={f.id} className="ret-card ret-card-hover" style={{ cursor: "pointer" }} onClick={() => setPage(f.id)}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.btn, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10 }}>{f.label}</div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 8, lineHeight: 1.3, letterSpacing: "-0.015em" }}>{f.headline}</h3>
                <p style={{ fontSize: 14, color: C.textSec, lineHeight: 1.6, margin: 0 }}>{f.sub}</p>
                <div style={{ marginTop: 14, fontSize: 13, fontWeight: 700, color: C.btn }}>Learn more →</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <RetFinalCTA
        h2="Ask at the right time. Every time."
        sub="Start free. See which clients are ready to refer."
        setPage={setPage}
      />
      <Footer setPage={setPage} />
    </div>
  );
}

function FeatureWorkers({ setPage }) {
  return (
    <div>
      <RetPageStyles />
      <RetHero
        eyebrow="Workers"
        h1="Delegate the task. Keep the relationship."
        sub="You don't do every piece of the work yourself — but the contractor doing one task doesn't need the keys to your whole book. Workers is the lightweight bridge: hand off a single task with one secure link, and stay the hub for everything else."
        primaryCta="Start Free Trial"
        primaryAction="signup"
        setPage={setPage}
      />

      <RetCurve from="#F2EEE8" to={C.bg} variant="dome" />
      <section className="ret-section ret-bg-light r-full-bleed" style={{ paddingTop: 56, paddingBottom: 56 }}>
        <div className="ret-section-inner">
          <div className="ret-section-head">
            <div className="ret-eyebrow">See it work</div>
            <h2 className="ret-h2">One task out. Your whole book stays in.</h2>
            <p className="ret-sub" style={{ margin: "0 auto" }}>Hand off a task and watch exactly what a worker can — and can't — see. They get the job, never the relationship.</p>
          </div>
          <WorkersDemo />
        </div>
      </section>

      <section className="ret-section ret-bg-light r-full-bleed" style={{ paddingTop: 56 }}>
        <div className="ret-section-inner">
          <div className="ret-section-head">
            <div className="ret-eyebrow">How it works</div>
            <h2 className="ret-h2">Help that doesn't cost you the relationship.</h2>
            <p className="ret-sub" style={{ maxWidth: 700, marginTop: 12 }}>
              Delegation usually means handing someone access to your clients. Workers flips that — they get the work, you keep the book.
            </p>
          </div>
          <div className="ret-grid-3">
            {[
              { h: "One link, one task", p: "No account, no login, no onboarding. The worker opens a secure link, sees the single task you assigned, and gets to work. Nothing else is reachable." },
              { h: "Scoped appropriately", p: "They see what the task needs — the client it's for, your note, a due date — and nothing of your scores, revenue, history, or the rest of your relationships." },
              { h: "You stay the hub", p: "The client never deals with a stranger. The work flows outward, the relationship stays with you, and you remain the only point of contact that matters." },
            ].map((s, i) => (
              <div key={i} className="ret-card">
                <div style={{ fontSize: 11, fontWeight: 700, color: C.btn, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10 }}>0{i + 1}</div>
                <h3 className="ret-h3">{s.h}</h3>
                <p style={{ fontSize: 14.5, color: C.textSec, lineHeight: 1.6, margin: 0 }}>{s.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <RetCurve from={C.bg} to={C.sidebar} variant="leftRise" />
      <section className="r-full-bleed" style={{ background: C.sidebar, color: "#F4F0E6", padding: "84px 32px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 15, color: "#9DC4AC", marginBottom: 18 }}>How Rai thinks.</div>
          <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: "clamp(20px, 3vw, 27px)", lineHeight: 1.55, color: "#E8E4D8", borderLeft: "2px solid " + C.primaryLight, paddingLeft: 22 }}>
            "I've spent more hours than I can count watching how client relationships actually end. <span style={{ color: "#fff" }}>It's almost never the work. It's the email that didn't get sent, the check-in that slipped a month, the quiet client nobody worried about.</span> I read your whole book every day, so the small thing has to get through me before it ever becomes the big one."
          </div>
          <p style={{ fontSize: 16, lineHeight: 1.65, color: "#C8D2C9", marginTop: 36, maxWidth: 560 }}>The point was never to replace your judgment. It's to make sure nothing reaches it too late while there's still time to act. I watch every relationship with the same care you'd watch your most important one 24/7.</p>
        </div>
      </section>

      <RetCurve from={C.sidebar} to="#F2EEE8" variant="leftRise" />
      <section className="ret-section ret-bg-cream r-full-bleed" style={{ paddingBottom: 24 }}>
        <div className="ret-section-inner">
          <div className="ret-section-head">
            <div className="ret-eyebrow">Related features</div>
            <h2 className="ret-h2">Better together.</h2>
          </div>
          <div className="ret-grid-3">
            {PLATFORM_FEATURES.filter(f => f.id !== "feature-workers").slice(0, 3).map(f => (
              <div key={f.id} className="ret-card ret-card-hover" style={{ cursor: "pointer" }} onClick={() => setPage(f.id)}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.btn, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10 }}>{f.label}</div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 8, lineHeight: 1.3, letterSpacing: "-0.015em" }}>{f.headline}</h3>
                <p style={{ fontSize: 14, color: C.textSec, lineHeight: 1.6, margin: 0 }}>{f.sub}</p>
                <div style={{ marginTop: 14, fontSize: 13, fontWeight: 700, color: C.btn }}>Learn more →</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <RetFinalCTA
        h2="Scale the work. Keep the relationships."
        sub="Start free. Hand off your first task in minutes."
        setPage={setPage}
      />
      <Footer setPage={setPage} />
    </div>
  );
}

const DEFAULT_DESC = "Retayned is the client CRM that predicts and prevents churn. Track relationship health, catch at-risk clients early, and keep the business you've already earned.";

const PAGE_META = {
  home: { title: "Retayned | CRM for Freelancers & Agencies", desc: "Retayned is the client CRM that predicts and prevents churn. Track relationship health, catch at-risk clients early, and keep the business you've already earned." },
  pricing: { title: "Pricing | Retayned", desc: "Flat, predictable pricing with every feature included. Solo $29/mo, Team $99/mo. No per-client fees, no feature gates. 14-day free trial, no credit card required." },
  about: { title: "Why We Built Retayned", desc: "Built by a performance marketer who spent ten years keeping the clients other people lost. Retayned is the system that came out of it." },
  blog: { title: "Client Retention Playbook | Retayned", desc: "Field notes on client retention, relationship health, and running a book of business that compounds instead of churns." },
  freelancers: { title: "Client CRM for Freelancers & Consultants | Retayned", desc: "Track every client relationship, catch churn early, and keep the business you worked to win. Built for solo operators. $29/mo flat." },
  agencies: { title: "Client Retention Software for Agencies | Retayned", desc: "Shared client visibility, handoff briefs, and per-account-manager coverage so client knowledge stays when people move. $99/mo for 5 seats." },
  enterprise: { title: "Retention Intelligence at Scale | Retayned Enterprise", desc: "Relationship intelligence for autonomous agents and books of business managing thousands of accounts. Managed Rai, API, and SSO." },
  platform: { title: "How Retayned Works | The Retention Platform", desc: "One brain for your entire book: retention scoring, health checks, and advanced AI built on frontier models. Every feature, every plan." },
  faq: { title: "Retayned FAQ | Pricing, Features & Data", desc: "Answers on pricing, features, data, and how Retayned predicts and prevents client churn." },
  "feature-today": { title: "Daily Client Priorities | Retayned Today", desc: "Your daily operating view. Rai suggests and ranks the work that matters most, so the few relationships that need you surface before they become problems." },
  "feature-scoring": { title: "Client Retention Scoring | Retayned", desc: "Your client list, scored and sorted by what matters. A twelve-dimension Retention Score on every relationship, so you see where you stand before the client tells you." },
  "feature-health": { title: "Client Health Checks | Retayned", desc: "Weekly reads on your whole book. Rai surfaces the patterns you'd never have time to find, so a quiet client gets caught before they churn." },
  "feature-rolodex": { title: "Keep Past Clients Warm | Retayned Rolodex", desc: "Every contact, relationship, and piece of history in one place, so nothing about a client lives only in your head and no past client goes cold." },
  "feature-referrals": { title: "Track Client Referrals | Retayned", desc: "Track and grow the referrals your best relationships generate, instead of leaving them to chance." },
  "feature-workers": { title: "Delegate Client Work Securely | Retayned Workers", desc: "Hand a single task to a contractor or VA with one secure link. No account, no login, no access to the rest of your book. You stay the hub." },
  "feature-rai": { title: "Meet Rai, Your AI Client Advisor | Retayned", desc: "Rai is your senior advisor for every account: ranked priorities, the exact words for a hard conversation, and context that carries across sessions." },
  privacy: { title: "Privacy Policy | Retayned", desc: "How Retayned collects, uses, and protects your data." },
  terms: { title: "Terms of Service | Retayned", desc: "The terms governing your use of Retayned." },
  signup: { title: "Start Your Free Trial | Retayned", desc: "Start a 14-day free trial of Retayned. No credit card required. Every feature included." },
  login: { title: "Log In | Retayned", desc: "Log in to your Retayned account." },
  contact: { title: "Contact Retayned", desc: "Get in touch with the Retayned team." },
};

// Map between page state and URL paths. Pages not listed here have no URL.
const PAGE_TO_PATH = {
  home: "/",
  pricing: "/pricing",
  about: "/about",
  blog: "/blog",
  freelancers: "/freelancers",
  agencies: "/agencies",
  enterprise: "/enterprise",
  platform: "/platform",
  faq: "/faq",
  "feature-today": "/features/today",
  "feature-scoring": "/features/retention-score",
  "feature-health": "/features/health-checks",
  "feature-rai": "/features/talk-to-rai",
  "feature-rolodex": "/features/rolodex",
  "feature-referrals": "/features/referrals",
  "feature-workers": "/features/workers",
  privacy: "/privacy",
  terms: "/terms",
  signup: "/signup",
  login: "/login",
  contact: "/contact",
};
const PATH_TO_PAGE = Object.fromEntries(Object.entries(PAGE_TO_PATH).map(([k, v]) => [v, k]));

function pageFromPath(pathname) {
  // Trim trailing slash (except root), then lookup. Fallback to "home".
  const cleaned = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  // Dynamic resource posts: /blog/<slug> or /guides/<slug>
  const m = cleaned.match(/^\/(?:blog|guides)\/([a-z0-9-]+)$/);
  if (m && RESOURCES_BY_SLUG[m[1]]) return "post:" + m[1];
  return PATH_TO_PAGE[cleaned] || "home";
}

// Resolve a page-state value to its URL path (handles dynamic post: pages).
function pathForPage(p) {
  if (p && p.startsWith("post:")) {
    const post = RESOURCES_BY_SLUG[p.slice(5)];
    if (post) return (post.kind === "guide" ? "/guides/" : "/blog/") + post.slug;
  }
  return PAGE_TO_PATH[p] || "/";
}

// Every URL the site serves — used by the build-time prerenderer to snapshot each page.
// Excludes auth/util routes (signup, login) that shouldn't be indexed.
export function getAllRoutes() {
  const skip = new Set(["signup", "login"]);
  const staticPaths = Object.entries(PAGE_TO_PATH)
    .filter(([page]) => !skip.has(page))
    .map(([, path]) => path);
  const postPaths = RESOURCES_CONTENT.map(
    (r) => (r.kind === "guide" ? "/guides/" : "/blog/") + r.slug
  );
  return [...staticPaths, ...postPaths];
}

export default function RetaynedSite({ initialPath } = {}) {
  const [page, setPageState] = useState(() => {
    // Browser: read the real URL. Build-time prerender: use the path passed in.
    if (typeof window !== "undefined") return pageFromPath(window.location.pathname);
    if (initialPath) return pageFromPath(initialPath);
    return "home";
  });

  // Wrap setPage so it also updates the URL via History API.
  const setPage = (next) => {
    setPageState(next);
    if (typeof window !== "undefined") {
      const path = pathForPage(next);
      if (window.location.pathname !== path) {
        window.history.pushState({ page: next }, "", path);
      }
    }
  };

  // Listen for back/forward navigation.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPop = () => setPageState(pageFromPath(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => { window.scrollTo(0, 0); }, [page]);

  // Keep the document title + meta description in sync with the current page.
  useEffect(() => {
    if (typeof document === "undefined") return;
    let meta = PAGE_META[page];
    if (!meta && page && page.startsWith("post:")) {
      const post = RESOURCES_BY_SLUG[page.slice(5)];
      if (post) meta = { title: post.title + " — Retayned", desc: post.excerpt };
    }
    if (!meta) meta = PAGE_META.home;
    document.title = meta.title;
    const setMeta = (selector, attr, value) => {
      const el = document.querySelector(selector);
      if (el) el.setAttribute(attr, value);
    };
    setMeta('meta[name="description"]', "content", meta.desc);
    setMeta('meta[property="og:title"]', "content", meta.title);
    setMeta('meta[property="og:description"]', "content", meta.desc);
    setMeta('meta[name="twitter:title"]', "content", meta.title);
    setMeta('meta[name="twitter:description"]', "content", meta.desc);
    const path = pathForPage(page);
    setMeta('meta[property="og:url"]', "content", "https://www.retayned.com" + (path === "/" ? "/" : path));
    let canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute("href", "https://www.retayned.com" + (path === "/" ? "/" : path));

    // Meta Pixel: fire a Lead event when the signup page is reached (once per page view).
    if (page === "signup" && typeof window !== "undefined" && typeof window.fbq === "function" && !window.__retSignupLead) {
      window.__retSignupLead = true;
      window.fbq("track", "Lead");
    }
    if (page !== "signup" && typeof window !== "undefined") {
      window.__retSignupLead = false;
    }
  }, [page]);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Manrope', system-ui, sans-serif", color: C.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=Caveat:wght@500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::selection { background: #33543E; color: #fff; }
        .cta-btn { transition: all 0.2s ease; }
        .cta-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(124,92,243,0.25); }
        .cta-btn:active { transform: translateY(0); }
        @keyframes megaFadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        .r-mega-row { transition: background 0.15s ease; }
        .r-mega-row:hover { background: ${C.primarySoft}; }
        .ch-pill { transition: all 0.15s ease; }
        .ch-pill:active { transform: scale(0.97); }
        input:focus, textarea:focus { border-color: #7c5cf3 !important; outline: none; box-shadow: 0 0 0 3px rgba(124,92,243,0.1); }
        ::-webkit-scrollbar { width: 0; }
        @keyframes flyAway { 0%{transform:translateY(0) translateX(0) rotate(0deg);opacity:1}20%{transform:translateY(-4px) translateX(2px) rotate(-1deg);opacity:1}40%{transform:translateY(-14px) translateX(8px) rotate(-3deg);opacity:.9}60%{transform:translateY(-30px) translateX(18px) rotate(-7deg);opacity:.6}80%{transform:translateY(-50px) translateX(32px) rotate(-12deg);opacity:.3}100%{transform:translateY(-75px) translateX(50px) rotate(-16deg);opacity:0} }
        .fly-away { display: inline-block; animation: flyAway 2.5s ease-out forwards; }
        .r-wrap { max-width: 100%; margin: 0 auto; padding: 0; }
        .r-mobile-only { display: flex; }
        .r-desktop-nav { display: none !important; }
        input[type=range] { -webkit-appearance: none; width: 100%; height: 8px; border-radius: 4px; background: #E8ECE6; outline: none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 28px; height: 28px; border-radius: 50%; background: #7c5cf3; cursor: pointer; box-shadow: 0 2px 8px rgba(124,92,243,0.3); }
        input[type=range]::-moz-range-thumb { width: 28px; height: 28px; border-radius: 50%; background: #7c5cf3; cursor: pointer; border: none; }
        .r-full-bleed { width: 100vw; position: relative; left: 50%; transform: translateX(-50%); padding-left: 20px; padding-right: 20px; }
        .r-no-pad { padding-left: 0 !important; padding-right: 0 !important; }
        
        @media (min-width: 768px) {
          section { padding-left: 40px !important; padding-right: 40px !important; }
          .r-nav-inner { padding-left: 40px !important; padding-right: 40px !important; }
          .r-wrap { max-width: 100%; }
          .r-mobile-only { display: none !important; }
          .r-desktop-nav { display: flex !important; }
          .r-full-bleed { padding-left: 40px; padding-right: 40px; }

        }
        @media (min-width: 1024px) {
          section { padding-left: 60px !important; padding-right: 60px !important; }
          .r-nav-inner { padding-left: 60px !important; padding-right: 60px !important; }
          .r-full-bleed { padding-left: 60px; padding-right: 60px; }
        }
        @media (min-width: 1280px) {
          section { padding-left: 80px !important; padding-right: 80px !important; }
          .r-nav-inner { padding-left: 80px !important; padding-right: 80px !important; }
          .r-wrap { max-width: 100%; margin: 0 auto; }
          .r-full-bleed { padding-left: 80px; padding-right: 80px; }
        }

        /* ═══════════════════════════════════════════════════ */
        /* V2 — Marketing homepage                             */
        /* ═══════════════════════════════════════════════════ */
        .v2-root { }
        .v2-final-h-small { font-size: clamp(28px, 3.5vw, 48px) !important; line-height: 1.05 !important; letter-spacing: -0.03em !important; font-weight: 900 !important; }

        /* ═══ Final CTA spaceship animation ═══ */
        .v2-section-final { position: relative; overflow: hidden; }
        .v2-section-final > *:not(.v2-ship-wrapper) { position: relative; z-index: 2; }
        .v2-ship-wrapper {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 1;
        }
        .v2-ship-svg {
          width: 100%;
          height: 100%;
          display: block;
          overflow: visible;
        }
        /* Resting state: trail hidden, ship hidden and offset */
        .v2-ship-trail {
          stroke-dasharray: 1800;
          stroke-dashoffset: 1800;
        }
        .v2-ship-body {
          opacity: 0;
          transform-box: fill-box;
          transform-origin: center;
        }
        /* Animated state (added by IntersectionObserver) */
        .v2-final-animate .v2-ship-trail {
          animation: shipTrailDraw 2.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .v2-final-animate .v2-ship-body {
          animation: shipBodyFadeIn 0.8s ease-out 1.8s forwards;
        }
        @keyframes shipTrailDraw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes shipBodyFadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }

        /* ═══ Platform portfolio dashboard (right column) ═══ */
        .v2-platform-portfolio {
          background: ${C.card};
          border: 8px solid #F5ECD8;
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 12px 40px rgba(0,0,0,0.07), 0 2px 8px rgba(0,0,0,0.04);
          font-size: 12px;
        }
        .v2-platform-portfolio-grid {
          display: grid;
          grid-template-columns: 180px 1fr;
          gap: 12px;
          align-items: start;
        }
        .v2-port-sidebar {
          display: flex; flex-direction: column; gap: 10px;
        }
        .v2-port-card {
          background: ${C.bg};
          border: 1px solid ${C.borderLight};
          border-radius: 10px;
          padding: 12px;
        }
        .v2-port-card-label {
          font-size: 9px; font-weight: 700;
          color: ${C.textMuted};
          letter-spacing: 0.1em;
          margin-bottom: 10px;
        }
        .v2-port-movement-item {
          display: flex; align-items: center; gap: 8px;
          padding: 3px 0;
        }
        .v2-port-avatar {
          width: 22px; height: 22px; border-radius: 50%;
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 8.5px; font-weight: 700; color: #fff;
          flex-shrink: 0;
        }
        .v2-port-table-wrap {
          background: #fff;
          border: 1px solid ${C.borderLight};
          border-radius: 10px;
          overflow: hidden;
          min-width: 0;
        }
        .v2-port-controls {
          display: flex; justify-content: space-between; align-items: center;
          padding: 10px 14px;
          border-bottom: 1px solid ${C.borderLight};
        }
        .v2-port-pill {
          padding: 3px 9px; border-radius: 5px;
          font-size: 10px; color: ${C.textSec};
        }
        .v2-port-pill-active {
          background: ${C.text}; color: #fff; font-weight: 700;
        }
        .v2-port-row {
          display: flex; align-items: center; gap: 8px;
          padding: 9px 14px;
          border-bottom: 1px solid ${C.borderLight};
        }
        .v2-port-row:last-child { border-bottom: none; }
        .v2-port-row-header {
          background: ${C.bg};
          font-size: 9px; font-weight: 700;
          color: ${C.textMuted};
          letter-spacing: 0.08em;
        }
        .v2-port-col-num {
          flex: 1 1 0;
          text-align: right;
          min-width: 0;
        }
        @media (max-width: 1100px) {
          .v2-platform-portfolio-grid { grid-template-columns: 1fr; }
          .v2-port-sidebar { flex-direction: row; }
          .v2-port-sidebar > * { flex: 1; }
        }

        /* ═══ 7-cell mixed testimonials/stats grid ═══ */
        .v2-mix-cell {
          background: #EAE4D6;
          border: 1px solid rgba(28,50,36,0.06);
          border-radius: 16px;
          padding: 32px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.03);
        }
        .v2-mix-testimonial {
          display: flex; flex-direction: column;
        }
        .v2-mix-quote {
          font-size: 16px; color: ${C.text};
          line-height: 1.65; margin-bottom: 24;
          font-style: italic; flex: 1; margin-bottom: 24px;
        }
        .v2-mix-footer {
          border-top: 1px solid rgba(28,50,36,0.08);
          padding-top: 16px;
          display: flex; align-items: center; gap: 12px;
        }
        .v2-mix-stat {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          text-align: center;
          min-height: 220px;
          background: #FAFAF7 !important;
        }
        .v2-mix-stat-num {
          font-size: clamp(56px, 7vw, 96px);
          font-weight: 900; color: ${C.primary};
          letter-spacing: -0.045em; line-height: 1;
          margin-bottom: 14px;
        }
        .v2-mix-stat-label {
          font-size: 13px; font-weight: 600;
          color: ${C.textMuted};
          text-transform: uppercase; letter-spacing: 0.06em;
          max-width: 220px;
        }
        .v2-mix-stat-wide {
          min-height: 160px;
          padding: 48px 32px;
          background: linear-gradient(135deg, #D7E6D9 0%, ${C.primarySoft} 60%, #FAFAF7 100%) !important;
          border: 1px solid rgba(51, 84, 62, 0.08) !important;
        }
        .v2-mix-stat-headline {
          font-size: clamp(28px, 3.5vw, 48px);
          font-weight: 900; letter-spacing: -0.03em;
          line-height: 1.05; color: ${C.text};
          max-width: 1000px; margin: 0 auto;
        }
        @media (max-width: 1024px) {
          .v2-testimonials-grid { grid-template-columns: 1fr !important; }
          .v2-mix-stat-wide { grid-column: span 1 !important; }
        }

        /* Fonts: Caveat + DM Serif Display are loaded in hero via @import */
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=DM+Serif+Display:ital@0;1&display=swap');

        /* ═══ HERO ═══ */
        .v2-hero {
          background: #F2EEE8;
          position: relative;
          padding: 56px 48px 60px;
          overflow: hidden;
        }
        .v2-hero-inner { max-width: 1320px; margin: 0 auto; }
        @keyframes subtleBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        .v2-trust-pill {
          display: inline-flex; align-items: center; gap: 8px;
          padding: clamp(6px, 0.4vw, 7px) clamp(14px, 1vw, 16px); border-radius: 100px;
          background: rgba(255,255,255,0.9);
          border: 1px solid rgba(216,223,216,0.8);
          box-shadow: 0 4px 16px rgba(0,0,0,0.04);
          font-size: 14.5px; font-weight: 600;
          color: ${C.text};
          margin-bottom: clamp(20px, 1.5vw, 28px);
          animation: subtleBob 4s ease-in-out infinite;
          max-width: 100%; white-space: nowrap;
        }
        .v2-trust-dot { flex-shrink: 0; display: block; }
        .v2-hero-h1 {
          font-size: clamp(40px, 7.5vw, 104px);
          font-weight: 900; letter-spacing: -0.045em;
          line-height: 0.98;
          margin-bottom: 24px;
          color: ${C.text};
        }
        @media (min-width: 768px) {
          .v2-hero-h1 { margin-top: 0; }
        }
        .v2-strike-wrap { position: relative; display: inline-block; margin: 0 0.15em; padding-top: 0.5em; }
        .v2-strike { color: ${C.textMuted}; position: relative; }
        .v2-strike::after {
          content: ''; position: absolute;
          left: -3%; top: 53%; height: 0.07em; width: 106%;
          background: ${C.danger}; border-radius: 2px;
          transform: rotate(-1deg) scaleX(0);
          transform-origin: left center;
          animation: v2StrikeDraw 0.55s cubic-bezier(0.65, 0, 0.35, 1) 0.9s forwards;
        }
        @keyframes v2StrikeDraw {
          0%   { transform: rotate(-1deg) scaleX(0); }
          100% { transform: rotate(-1deg) scaleX(1); }
        }
        .v2-caveat {
          font-family: 'Caveat', cursive;
          font-weight: 700; color: ${C.primary};
          position: absolute; top: -0.2em; left: 50%;
          transform: translateX(-50%) rotate(-2deg);
          font-size: 0.78em; white-space: nowrap;
          line-height: 1;
          opacity: 0;
          animation: v2CaveatIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 1.5s forwards;
        }
        @keyframes v2CaveatIn {
          0%   { opacity: 0; transform: translateX(-50%) rotate(-2deg) translateY(6px) scale(0.9); }
          100% { opacity: 1; transform: translateX(-50%) rotate(-2deg) translateY(0) scale(1); }
        }
        .v2-hero-sub {
          font-size: clamp(17px, 2vw, 24px);
          font-weight: 600; color: ${C.text};
          max-width: 760px; margin-bottom: 14px; line-height: 1.35;
        }
        .v2-hero-desc {
          font-size: clamp(15px, 1.5vw, 19px);
          color: ${C.textSec};
          max-width: 620px; line-height: 1.6; margin-bottom: 32px;
        }
        .v2-hero-cta-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
        .v2-btn-primary-lg, .v2-btn-secondary-lg {
          display: inline-flex; align-items: center; justify-content: center;
          height: 52px; padding: 0 28px;
          border-radius: 12px;
          font-size: 16px; font-weight: 700;
          cursor: pointer; font-family: inherit;
          box-sizing: border-box;
          line-height: 1;
          border: 2px solid ${C.btn};
          white-space: nowrap;
        }
        .v2-btn-primary-lg { background: ${C.btn}; color: #fff; }
        .v2-btn-primary-lg:hover { background: ${C.btnHover}; border-color: ${C.btnHover}; }
        .v2-hero-fine { margin-top: 16px; font-size: clamp(13px, 1vw, 15px); color: ${C.textMuted}; }

        /* Hero device — beige on beige */
        .v2-hero-device {
          background: #EAE4D6;
          border-radius: 24px;
          padding: 32px;
          max-width: 1100px; margin: 56px auto 0;
          position: relative;
        }
        .v2-hero-device-inner {
          background: #fff;
          border-radius: 14px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.04);
          overflow: hidden;
        }

        @keyframes v2-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }

        /* ═══ Today feed v4 (v2tf-*) — hero animated task list ═══
           Architecture matches reference mobile/desktop files exactly:
           - Cards absolute-positioned, transform: translateY()
           - Fixed --row-h per breakpoint, --gap between cards
           - DOM is stacked: row1 (label + score) → title → meta
        */
        .v2tf-root {
          background: #fff;
          font-family: inherit;
          color: #1a1614;
          border-radius: 18px;
          overflow: hidden;
        }
        .v2tf-body {
          padding: 28px 32px 30px;
        }
        .v2tf-head {
          display: flex; align-items: flex-start; justify-content: space-between;
          padding-bottom: 18px;
          border-bottom: 1px solid #f1ecde;
          margin-bottom: 18px;
        }
        .v2tf-h {
          margin: 0 0 4px;
          font-size: 28px; font-weight: 700;
          letter-spacing: -0.02em;
          color: #1a1614;
        }
        .v2tf-sub {
          font-size: 13px;
          color: #8a8278;
        }
        .v2tf-ranking {
          display: inline-flex; align-items: center; gap: 8px;
          background: #ddd2f0;
          color: #4a3a82;
          padding: 8px 14px;
          border-radius: 999px;
          font-size: 13px; font-weight: 500;
          white-space: nowrap;
        }
        .v2tf-ranking::before {
          content: '';
          width: 7px; height: 7px;
          border-radius: 50%;
          background: #7b66c7;
          box-shadow: 0 0 0 0 rgba(123,102,199,0.5);
          animation: v2tf-pulse 1.8s ease-out infinite;
        }
        @keyframes v2tf-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(123,102,199,0.55); }
          70%  { box-shadow: 0 0 0 8px rgba(123,102,199,0); }
          100% { box-shadow: 0 0 0 0 rgba(123,102,199,0); }
        }
        .v2tf-ranking.thinking::before { animation: v2tf-pulse 0.8s ease-out infinite; }

        .v2tf-list-wrap { position: relative; }
        .v2tf-list {
          position: relative; display: block;
          transition: height 500ms cubic-bezier(.6,.05,.2,1);
        }

        .v2tf-task {
          position: absolute;
          left: 0; right: 0;
          display: flex; flex-direction: column; justify-content: center;
          background: #fff;
          border: 1px solid #ebe4d4;
          border-radius: 14px;
          padding: 12px 16px;
          overflow: hidden;
          transition:
            transform 700ms cubic-bezier(.6,.05,.2,1),
            opacity 420ms ease,
            box-shadow 400ms ease,
            border-color 400ms ease,
            background 400ms ease;
          will-change: transform, opacity;
        }
        .v2tf-task.selecting {
          background: #f4ecd6;
          border-color: #ddd1ac;
          box-shadow:
            inset 0 0 0 1px rgba(180, 150, 70, 0.18),
            0 6px 18px -10px rgba(80, 60, 20, 0.18);
        }
        .v2tf-task.leaving {
          opacity: 0;
          pointer-events: none;
        }

        .v2tf-row1 {
          display: flex; align-items: center; gap: 8px;
          margin-bottom: 6px;
        }
        .v2tf-label {
          flex: 0 0 auto;
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 600;
          letter-spacing: 0.08em;
          padding: 5px 9px;
          border-radius: 5px;
          text-transform: uppercase;
        }
        .v2tf-label-deepen    { background: #e7efe2; color: #3f5a39; }
        .v2tf-label-urgent    { background: #f9dcd4; color: #a04432; }
        .v2tf-label-nurture   { background: #f1e2bf; color: #7a5a1b; }
        .v2tf-label-proactive { background: #e3dcf2; color: #534392; }
        .v2tf-label-develop   { background: #f9dcd4; color: #a04432; }

        .v2tf-score {
          margin-left: auto;
          flex: 0 0 auto;
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 40px;
          padding: 5px 10px;
          border-radius: 6px;
          font-weight: 600; font-size: 12.5px;
          font-variant-numeric: tabular-nums;
          transition: background 400ms ease, color 400ms ease, transform 400ms ease;
        }
        .v2tf-score-deepen    { background: #dbe8d3; color: #3f5a39; }
        .v2tf-score-urgent    { background: #f5c6ba; color: #a04432; }
        .v2tf-score-nurture   { background: #ecd59e; color: #7a5a1b; }
        .v2tf-score-proactive { background: #dcd3ee; color: #534392; }
        .v2tf-score-develop   { background: #f5c6ba; color: #a04432; }

        .v2tf-title {
          font-size: 14.5px; font-weight: 600;
          color: #1a1614;
          letter-spacing: -0.005em;
          line-height: 1.3;
          margin-bottom: 3px;
          text-wrap: pretty;
        }
        .v2tf-meta {
          font-size: 12px;
          color: #8a8278;
          line-height: 1.35;
        }

        .v2tf-rai {
          margin-top: 22px;
          background: #e7dff5;
          color: #3e2f72;
          border-radius: 12px;
          padding: 14px 18px;
          display: flex; align-items: center; gap: 14px;
          font-size: 14px;
          height: 72px;
          overflow: hidden;
        }
        .v2tf-avatar {
          flex: 0 0 auto;
          width: 36px; height: 36px;
          border-radius: 50%;
          overflow: hidden;
        }
        .v2tf-avatar svg { width: 100%; height: 100%; display: block; }
        .v2tf-msg {
          flex: 1;
          position: relative;
          min-height: 20px;
        }
        .v2tf-msg b { font-weight: 600; color: #2c1f5c; }
        .v2tf-msg-line {
          display: block;
          opacity: 0;
          transform: translateY(8px);
          transition: opacity 450ms ease, transform 450ms ease;
        }
        .v2tf-msg-line.show { opacity: 1; transform: translateY(0); }
        .v2tf-caret {
          display: inline-block;
          width: 2px; height: 14px;
          background: #3e2f72;
          vertical-align: middle;
          margin-left: 2px;
          animation: v2tf-blink 1s steps(2) infinite;
        }
        @keyframes v2tf-blink { 50% { opacity: 0; } }

        /* Mobile: taller card to fit 2-line title + meta. Same architecture, different sizing. */
        @media (max-width: 760px) {
          .v2tf-body { padding: 20px 18px 22px; }
          .v2tf-head { flex-direction: column; align-items: flex-start; gap: 10px; padding-bottom: 14px; margin-bottom: 14px; }
          .v2tf-h { font-size: 24px; }
          .v2tf-sub { font-size: 12px; }
          .v2tf-ranking { font-size: 12px; padding: 7px 12px; }
          .v2tf-task { padding: 12px 14px; border-radius: 14px; }
          .v2tf-row1 { margin-bottom: 8px; }
          .v2tf-label { font-size: 9.5px; padding: 4px 8px; }
          .v2tf-score { min-width: 38px; font-size: 12px; padding: 4px 9px; }
          .v2tf-title { font-size: 14px; line-height: 1.3; margin-bottom: 4px; }
          .v2tf-meta { font-size: 11.5px; }
          .v2tf-rai { padding: 12px 14px; gap: 10px; font-size: 12.5px; }
          .v2tf-avatar { width: 30px; height: 30px; }
        }
        @media (max-width: 420px) {
          .v2tf-body { padding: 16px 12px 18px; }
          .v2tf-h { font-size: 22px; }
          .v2tf-task { padding: 11px 12px; }
          .v2tf-title { font-size: 13.5px; }
          .v2tf-meta { font-size: 11px; }
          .v2tf-msg { font-size: 12px; }
        }


        /* ═══ CURVES ═══ */
        .v2-curve { display: block; width: 100vw; height: 140px; margin-top: 0; margin-bottom: -1px; padding: 0; line-height: 0; position: relative; z-index: 1; }
        .v2-curve svg { display: block; width: 100%; height: calc(100% + 1px); }

        /* ═══ SECTION SHARED ═══ */
        .v2-section-inner { max-width: 1400px; margin: 0 auto; }
        .v2-section-head { margin-bottom: 56px; }
        .v2-eyebrow {
          display: inline-block;
          font-size: 12px; font-weight: 700;
          color: ${C.primary};
          text-transform: uppercase; letter-spacing: 0.14em;
          margin-bottom: ${EYEBROW_GAP}px;
          padding: 6px 14px;
          background: ${C.primarySoft};
          border-radius: 6px;
        }
        .v2-section-h2 {
          font-size: clamp(32px, 5vw, 72px);
          font-weight: 900; letter-spacing: -0.04em;
          line-height: 1.02; margin-bottom: 20px;
          color: ${C.text};
        }
        .v2-section-sub {
          font-size: clamp(16px, 1.8vw, 18px);
          color: ${C.textSec};
          line-height: 1.6;
        }

        /* ═══ MEET RAI ═══ */
        .v2-section-rai { background: ${C.bg}; padding: 96px 48px; }
        .v2-rai-steps {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
          max-width: 1400px; margin: 0 auto;
        }
        .v2-rai-step {
          background: transparent;
          border: none;
          box-shadow: none;
          padding: 0;
          display: flex;
          flex-direction: column;
        }
        .v2-rai-step-illustration {
          width: 50%;
          aspect-ratio: 360 / 300;
          background-size: contain;
          background-position: center;
          background-repeat: no-repeat;
          margin: 0 auto 48px;
        }
        .v2-rai-step-content {
          padding: 0 8px;
        }
        .v2-rai-step-h {
          font-size: 22px; font-weight: 800;
          letter-spacing: -0.02em; margin-bottom: 10px;
          color: ${C.text};
        }
        .v2-rai-step-p {
          font-size: 14px; color: ${C.textSec}; line-height: 1.65;
        }
        /* Legacy step classes — removed */

        /* ═══ PLATFORM ═══ */
        .v2-section-platform { background: #EAE4D6; padding: 112px 48px; }
        .v2-feature-tabs {
          display: flex; flex-wrap: wrap; gap: 4px;
          background: rgba(255,255,255,0.5); border: 1px solid rgba(0,0,0,0.05);
          border-radius: 999px; padding: 5px; margin-bottom: 20px;
        }
        .v2-feature-tab {
          flex: 1; min-width: 0; padding: 8px 12px; border: none; background: transparent;
          border-radius: 999px; font-family: inherit; font-size: 13px; font-weight: 700;
          color: ${C.textSec}; cursor: pointer; transition: all 0.15s ease; white-space: nowrap;
        }
        .v2-feature-tab:hover { color: ${C.text}; }
        .v2-feature-tab.active { background: #fff; color: ${C.text}; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
        @media (max-width: 640px) {
          .v2-feature-tabs { gap: 2px; padding: 4px; }
          .v2-feature-tab { padding: 7px 8px; font-size: 12px; }
        }
        .v2-platform-grid {
          display: grid; grid-template-columns: 1fr 1.4fr; gap: 64px;
          align-items: center;
          max-width: 1400px; margin: 0 auto;
        }
        .v2-bullets { margin-top: 28px; }
        .v2-bullet {
          display: flex; align-items: flex-start; gap: 14px;
          padding: 18px 0;
          border-top: 1px solid rgba(216, 223, 216, 0.6);
          font-size: 15px; line-height: 1.5;
          color: ${C.text};
        }
        .v2-bullet:last-child { border-bottom: 1px solid rgba(216, 223, 216, 0.6); }
        .v2-check {
          flex-shrink: 0; width: 22px; height: 22px;
          background: ${C.primary}; color: #fff;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 900; margin-top: 2px;
        }

        /* ═══ COMBOS ═══ */
        .v2-section-combos { background: ${C.bg}; padding: 112px 48px; }
        .v2-combos-head { max-width: 960px; margin: 0 auto 72px; text-align: center; }
        .v2-combos-h2 {
          font-size: clamp(40px, 5.5vw, 72px);
          font-weight: 900; letter-spacing: -0.04em;
          line-height: 1.02; margin: 14px 0 16px;
          color: ${C.text};
        }
        .v2-combos-p {
          font-size: 18px; color: ${C.textSec}; line-height: 1.6;
        }
        .v2-scroll-band {
          overflow: hidden; padding: 32px 0; position: relative;
          -webkit-mask-image: linear-gradient(90deg, transparent 0, black 10%, black 90%, transparent 100%);
          mask-image: linear-gradient(90deg, transparent 0, black 10%, black 90%, transparent 100%);
        }
        .v2-scroll-track {
          display: flex; gap: 72px; align-items: baseline;
          white-space: nowrap; width: max-content;
          padding: 8px 0;
          will-change: transform;
          color: ${C.textSec};
        }
        .v2-become {
          display: flex; align-items: center; justify-content: center;
          gap: 18px; padding: 40px 0; max-width: 960px; margin: 0 auto;
        }
        .v2-become-rule { flex: 1; height: 1px; background: ${C.border}; max-width: 360px; }
        .v2-become-word {
          font-size: 13px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.16em;
          color: ${C.textMuted}; white-space: nowrap;
        }

        /* Wordmark typography */
        .v2-wm-pos { color: rgba(45,134,89,0.9); }
        .v2-wm-neg { color: rgba(196,67,43,0.88); }
        .v2-wm-bulletproof { font-size: 42px; font-weight: 800; letter-spacing: -0.02em; }
        .v2-wm-icewall { font-size: 38px; font-weight: 300; font-family: 'DM Serif Display', serif; font-style: italic; }
        .v2-wm-lockedvault { font-size: 28px; font-weight: 900; letter-spacing: 0.12em; text-transform: uppercase; }
        .v2-wm-ontheclock { font-size: 36px; font-weight: 800; letter-spacing: -0.02em; }
        .v2-wm-cornerstone { font-size: 40px; font-weight: 400; font-family: 'DM Serif Display', serif; }
        .v2-wm-silentexit { font-size: 38px; font-weight: 400; font-family: 'DM Serif Display', serif; font-style: italic; }
        .v2-wm-decisionexpress { font-size: 26px; font-weight: 900; letter-spacing: 0.12em; text-transform: uppercase; }
        .v2-wm-noroom {
          font-size: 36px; font-weight: 900; letter-spacing: -0.04em;
          font-family: 'Arial Narrow', 'Helvetica Neue Condensed', Impact, sans-serif;
          transform: scaleX(0.78); transform-origin: center;
        }
        .v2-wm-truepartner { font-size: 38px; font-weight: 700; font-family: 'DM Serif Display', serif; }
        .v2-wm-tickingbomb { font-size: 28px; font-weight: 900; letter-spacing: 0.06em; text-transform: uppercase; }
        .v2-wm-smoothop { font-size: 40px; font-weight: 300; font-family: 'DM Serif Display', serif; font-style: italic; }
        .v2-wm-onefoot { font-size: 38px; font-weight: 700; }
        .v2-wm-allinvestor { font-size: 34px; font-weight: 800; letter-spacing: -0.01em; }
        .v2-wm-powderkeg { font-size: 28px; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; }
        .v2-wm-openbook { font-size: 40px; font-weight: 400; font-family: 'DM Serif Display', serif; }
        .v2-wm-nickeldime { font-size: 34px; font-weight: 400; font-family: 'DM Serif Display', serif; font-style: italic; }
        .v2-wm-resilient { font-size: 26px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
        .v2-wm-noanchor { font-size: 36px; font-weight: 300; font-family: 'DM Serif Display', serif; font-style: italic; }
        .v2-wm-lowmaint { font-size: 32px; font-weight: 800; letter-spacing: -0.02em; }
        .v2-wm-bottleneck { font-size: 28px; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; }

        .v2-dim-serif { font-size: 46px; font-weight: 400; letter-spacing: -0.02em; font-family: 'DM Serif Display', serif; }
        .v2-dim-serif-italic { font-size: 46px; font-weight: 400; font-style: italic; font-family: 'DM Serif Display', serif; }
        .v2-dim-serif-italic-lg { font-size: 50px; font-weight: 400; font-style: italic; font-family: 'DM Serif Display', serif; }
        .v2-dim-heavy-caps { font-size: 40px; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; }
        .v2-dim-spaced-lower { font-size: 24px; font-weight: 400; letter-spacing: 0.2em; text-transform: uppercase; }
        .v2-dim-small-caps { font-size: 22px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }

        /* ═══ AUDIENCE ═══ */
        .v2-section-audience { background: #EAE4D6; padding: 112px 48px; }
        .v2-audience-tabs {
          display: inline-flex; gap: 4px; justify-content: center;
          margin: 0 auto 48px;
          padding: 5px;
          background: #F5ECD8;
          border-radius: 100px;
          box-shadow: inset 0 0 0 1px rgba(28, 50, 36, 0.04);
        }
        .v2-audience-tabs-wrap {
          display: flex; justify-content: center; width: 100%;
        }
        .v2-audience-tab {
          padding: 8px 22px; border-radius: 100px;
          font-size: 13.5px; font-weight: 600;
          color: ${C.textSec};
          border: none;
          background: transparent; cursor: pointer; font-family: inherit;
          transition: all 0.2s ease;
        }
        .v2-audience-tab:hover { color: ${C.text}; }
        .v2-audience-tab-active {
          background: #FAFAF7;
          color: ${C.text};
          font-weight: 700;
          box-shadow: 0 2px 8px rgba(28, 50, 36, 0.08);
        }
        .v2-audience-tab-active:hover { color: ${C.text}; background: #FAFAF7; }
        .v2-audience-content {
          background: #F5ECD8;
          border-radius: 24px;
          padding: 56px 48px;
          display: grid; grid-template-columns: 1fr 1fr; gap: 48px;
          align-items: center;
          max-width: 1280px; margin: 0 auto;
          box-shadow: 0 24px 48px rgba(28, 50, 36, 0.06);
        }
        .v2-audience-h {
          font-size: clamp(28px, 3.5vw, 48px);
          font-weight: 900; letter-spacing: -0.03em;
          line-height: 1.05; margin-bottom: 18px;
          color: ${C.text};
        }
        .v2-audience-p {
          font-size: 16px; color: ${C.textSec}; line-height: 1.6;
          margin-bottom: 24px;
        }
        .v2-audience-demo {
          background: transparent; border-radius: 0; padding: 0;
          box-shadow: none;
        }

        /* ═══ ENTERPRISE ═══ */
        .v2-section-enterprise {
          background: ${C.primaryDeep};
          color: #fff;
          padding: 112px 48px;
        }
        .v2-eyebrow-enterprise {
          background: rgba(255,255,255,0.08) !important;
          color: rgba(255,255,255,0.75) !important;
        }
        .v2-h2-enterprise { color: #fff !important; }
        .v2-accent-ent { color: ${C.primaryLight}; }
        .v2-sub-enterprise { color: rgba(255,255,255,0.7) !important; }
        .v2-enterprise-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
          margin: 48px auto 0;
          max-width: 1400px;
        }
        .v2-enterprise-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px; padding: 28px;
        }
        .v2-enterprise-label {
          font-size: 10px; font-weight: 700;
          color: ${C.primaryLight};
          text-transform: uppercase; letter-spacing: 0.14em;
          margin-bottom: 16px;
        }
        .v2-enterprise-h {
          font-size: 20px; font-weight: 800;
          margin-bottom: 8px; letter-spacing: -0.02em;
          color: #fff;
        }
        .v2-enterprise-p {
          font-size: 14px; color: rgba(255,255,255,0.65); line-height: 1.6;
        }
        .v2-enterprise-cta-row {
          display: flex; gap: 14px; justify-content: center; margin-top: 48px;
        }
        .v2-btn-enterprise {
          background: #fff; color: ${C.primaryDeep};
          padding: 14px 32px; border-radius: 12px;
          font-size: 15px; font-weight: 700; cursor: pointer;
          border: none; font-family: inherit;
        }
        .v2-btn-enterprise:hover { background: ${C.primarySoft}; }

        /* ═══ FINAL CTA ═══ */
        .v2-section-final {
          background: #F2EEE8;
          padding: 112px 48px 140px;
          text-align: center;
        }
        .v2-final-h {
          font-size: clamp(36px, 6vw, 80px);
          font-weight: 900; letter-spacing: -0.04em;
          line-height: 1.02; max-width: 1000px; margin: 0 auto 20px;
          color: ${C.text};
        }
        .v2-final-sub {
          font-size: 17px; color: ${C.textSec}; line-height: 1.6;
          max-width: 620px; margin: 0 auto 32px;
        }
        .v2-final-fine { font-size: 13px; color: ${C.textMuted}; margin-top: 18px; }

        /* ═══ FOOTER ═══ */
        .v2-footer { background: ${C.primaryDeep}; color: #fff; padding: 72px 48px 36px; }
        .v2-footer-inner {
          max-width: 1320px; margin: 0 auto;
          display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
          gap: 40px;
        }
        .v2-footer-wordmark {
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 26px; font-weight: 900;
          letter-spacing: -0.04em; color: #fff;
          margin-bottom: 14px; cursor: pointer;
        }
        .v2-footer-tag {
          font-size: 13px; color: rgba(255,255,255,0.5);
          line-height: 1.6; max-width: 280px;
        }
        .v2-footer-col h5 {
          font-size: 11px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.14em;
          color: rgba(255,255,255,0.5); margin: 0 0 14px;
        }
        .v2-footer-col a {
          display: block; font-size: 13px; color: rgba(255,255,255,0.85);
          margin-bottom: 9px; cursor: pointer; text-decoration: none;
        }
        .v2-footer-col a:hover { color: #fff; }
        .v2-footer-bottom {
          max-width: 1320px; margin: 40px auto 0;
          padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.08);
          font-size: 12px; color: rgba(255,255,255,0.4);
          display: flex; justify-content: space-between;
          flex-wrap: wrap; gap: 8px;
        }
        .v2-footer-citation {
          max-width: 1320px; margin: 32px auto 0;
          font-size: 11px; color: rgba(255,255,255,0.32);
          line-height: 1.5;
        }
        .v2-footer-citation sup { font-size: 9px; }

        /* ═══ V2 RESPONSIVE ═══ */
        @media (max-width: 1024px) {
          .v2-hero { padding: 56px 24px 48px; }
          .v2-hero-device { padding: 20px 16px 20px; margin-top: 40px; }
          .v2-section-rai, .v2-section-platform, .v2-section-audience, .v2-section-combos { padding: 72px 24px; }
          .v2-section-enterprise, .v2-section-final { padding: 72px 24px; }
          .v2-platform-grid { grid-template-columns: 1fr; gap: 40px; }
          .v2-rai-steps { grid-template-columns: 1fr; gap: 16px; }
          .v2-audience-content { grid-template-columns: 1fr; padding: 40px 32px; gap: 32px; }
          .v2-enterprise-grid { grid-template-columns: 1fr; gap: 14px; }
          .v2-footer { padding: 56px 24px 32px; }
          .v2-footer-inner { grid-template-columns: 1fr 1fr; gap: 32px; }
        }
        @media (max-width: 640px) {
          .v2-hero { padding: 40px 20px 40px; }
          .v2-hero-h1 { font-size: clamp(30px, 8vw, 38px); }
          .v2-hero-h1 { font-size: clamp(30px, 8.7vw, 38px); line-height: 1.04; }
          .v2-hero-device { padding: 16px 12px 16px; margin-top: 32px; border-radius: 18px; }
          .v2-section-rai, .v2-section-platform, .v2-section-audience, .v2-section-combos { padding: 64px 20px; }
          .v2-section-enterprise, .v2-section-final { padding: 64px 20px; }
          .v2-section-head { margin-bottom: 40px; }
          .v2-audience-content { padding: 32px 24px; gap: 24px; border-radius: 18px; }
          .v2-enterprise-card { padding: 22px; }
          .v2-footer { padding: 48px 20px 28px; }
          .v2-footer-inner { grid-template-columns: 1fr; gap: 28px; }
          .v2-curve { height: 80px; }
          .v2-port-row-header > div:nth-child(5),
          .v2-port-row:not(.v2-port-row-header) > div:nth-child(5) { display: none !important; }
        }
      `}</style>

      <Nav page={page} setPage={setPage} />
      <div style={{ overflowX: "hidden" }}>
      <div className="r-wrap">
        {page === "home" && <HomeV2 setPage={setPage} />}
        {page === "freelancers" && <Freelancers setPage={setPage} />}
        {page === "agencies" && <Agencies setPage={setPage} />}
        {page === "enterprise" && <Enterprise setPage={setPage} />}
        {page === "feature-today" && <FeatureToday setPage={setPage} />}
        {page === "feature-scoring" && <FeatureScoring setPage={setPage} />}
        {page === "feature-health" && <FeatureHealth setPage={setPage} />}
        {page === "feature-rai" && <FeatureRai setPage={setPage} />}
        {page === "feature-rolodex" && <FeatureRolodex setPage={setPage} />}
        {page === "feature-referrals" && <FeatureReferrals setPage={setPage} />}
        {page === "feature-workers" && <FeatureWorkers setPage={setPage} />}
        {page === "pricing" && <Pricing setPage={setPage} />}
        {page === "about" && <About setPage={setPage} />}
        {page === "faq" && <FAQPage setPage={setPage} />}
        {page === "blog" && <Blog setPage={setPage} />}
        {page && page.startsWith("post:") && <BlogPost slug={page.slice(5)} setPage={setPage} />}
        {page === "contact" && <Contact setPage={setPage} />}
        {page === "login" && <Login setPage={setPage} />}
        {page === "signup" && <Signup setPage={setPage} />}
        {page === "privacy" && <Privacy setPage={setPage} />}
        {page === "terms" && <Terms setPage={setPage} />}
      </div>
      </div>
    </div>
  );
}
