
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
  // Muted sage — same hue family as primaryLight (#558B68) but with
  // saturation cut roughly in half. Used for inactive nav icons so the
  // rail recedes and the active item carries brand color. Paired with
  // primaryMutedDeep below for the darker accent stops inside icons
  // (replaces the dark #2F2F31 accents in inactive state).
  primaryMuted: "#8FA597", primaryMutedDeep: "#4D5C50",

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
  btn: "#7c5cf3", btnHover: "#6a4ce8", btnLight: "var(--rt-btn-light)",

};

// CSS variable definitions. Injected in the App component's
// style block so they're authoritative at the document root.
const THEME_CSS = `
  :root {
    --rt-bg: #FAFBFA;
    --rt-card: #FFFFFF;
    --rt-surface: #F4F6F4;
    --rt-surface-warm: #F4F6F4;
    --rt-deep-cream: #DCE0DC;
    --rt-sidebar: #1C3224;
    --rt-text: #1E261F;
    --rt-text-sec: #6B6B66;
    --rt-text-muted: #9A9A93;
    --rt-ink-500: #6B6B66;
    --rt-ink-300: #C4C4BD;
    /* Card edge — darkened Jun 2026. #ECEFEC sat ~14 RGB pts off the bg,
       so 1px borders antialiased into invisibility on most displays and the
       whole border-standardization pass read as "didn't take." */
    --rt-border: #E1E5E1;
    --rt-border-light: #F2F4F2;
    --rt-border-soft: #F2F4F2;
    --rt-btn-light: #d6cbfb;
    /* ────────────── POLISH LAYER ──────────────
       Same palette, just enhanced with gradients, layered shadows for
       hover-lift, and a uniform motion curve. Applied across the Today
       page interactive surfaces. */
    --rt-grad-btn: linear-gradient(135deg, #8f72f5 0%, #7c5cf3 55%, #6a4ce8 100%);
    --rt-grad-btn-hover: linear-gradient(135deg, #7c5cf3 0%, #6a4ce8 55%, #5a3dd6 100%);
    --rt-grad-green-deep: linear-gradient(135deg, #33543E 0%, #1C3224 100%);
    --rt-sh-xs: 0 1px 2px rgba(20,30,22,0.05);
    --rt-sh-row: 0 0 0 1px rgba(20,30,22,0.12), 0 1px 2px rgba(20,30,22,0.04), 0 1px 6px rgba(20,30,22,0.025);
    --rt-sh-row-hover: 0 0 0 1px rgba(20,30,22,0.12), 0 2px 4px rgba(20,30,22,0.05), 0 6px 16px rgba(20,30,22,0.06);
    --rt-sh-card: 0 2px 0 -1px rgba(20,30,22,0.04), 0 4px 12px rgba(20,30,22,0.05);
    --rt-sh-card-hover: 0 2px 4px rgba(20,30,22,0.05), 0 8px 20px rgba(20,30,22,0.06);
    --rt-sh-purple: 0 0 0 1px rgba(124,92,243,0.10), 0 2px 8px rgba(124,92,243,0.20), 0 1px 2px rgba(124,92,243,0.10);
    --rt-sh-purple-hover: 0 0 0 1px rgba(124,92,243,0.22), 0 8px 22px rgba(124,92,243,0.34), 0 2px 4px rgba(124,92,243,0.16);
    --rt-sh-green-glow: 0 0 0 1px rgba(51,84,62,0.10), 0 2px 6px rgba(51,84,62,0.16);
    --rt-sh-chip-purple: 0 1px 2px rgba(124,92,243,0.12), 0 2px 6px rgba(124,92,243,0.08);
    /* Rai-territory gradient-halo shadow. Used on the armed Add Task
       button and the New Rai Chat button so they read as the inspiration's
       Ask AI pill: tight ambient + glowing purple bleed underneath. Halo
       reserved — applied sparingly so it stays meaningful. */
    --rt-sh-rai-pop: 0 1px 2px rgba(124,92,243,0.22), 0 6px 14px rgba(124,92,243,0.18), 0 14px 32px rgba(143,114,245,0.32);
    --rt-sh-rai-pop-hover: 0 2px 4px rgba(124,92,243,0.28), 0 8px 18px rgba(124,92,243,0.22), 0 18px 40px rgba(143,114,245,0.38);
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

  /* Range input thumb — primary green across the app so the profile-edit
     sliders never fall back to system blue. accent-color handles modern
     browsers; the ::-webkit and ::-moz pseudos handle older/specific cases. */
  input[type="range"] {
    accent-color: #33543E;
  }
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 22px; height: 22px;
    border-radius: 50%;
    background: #33543E;
    border: 3px solid #fff;
    box-shadow: 0 1px 4px rgba(0,0,0,0.18);
    cursor: pointer;
  }
  input[type="range"]::-moz-range-thumb {
    width: 22px; height: 22px;
    border-radius: 50%;
    background: #33543E;
    border: 3px solid #fff;
    box-shadow: 0 1px 4px rgba(0,0,0,0.18);
    cursor: pointer;
  }
`;

export { C, THEME_CSS };
