// ─── useShellViewport (June 2026 refactor, Piece E module 2) ───────────
// Viewport-shell state, moved VERBATIM from App.jsx: the visualViewport
// keyboard detector (+ --app-h CSS var), the isMobile breakpoint state,
// and the dock scroll-shrink listener. Self-contained — touches only
// window/document.
import { useEffect, useState } from "react";

export function useShellViewport() {
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
  const [dockShrunk, setDockShrunk] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    let lastY = 0;
    const yOf = () => {
      const m = document.querySelector(".r-main");
      return Math.max(window.scrollY || 0, m ? m.scrollTop : 0);
    };
    const onScroll = () => {
      const y = yOf();
      const dy = y - lastY;
      if (y < 40) setDockShrunk(false);
      else if (dy > 6) setDockShrunk(true);
      else if (dy < -6) setDockShrunk(false);
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", onScroll, { capture: true });
  }, []);
  return { dockShrunk, isMobile, keyboardOpen };
}
