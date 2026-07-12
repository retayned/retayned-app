// ─── App-level CSS (June 2026 refactor) ─────────────────────────────
// Extracted verbatim from App.jsx's inline <style> template — 2,100+
// lines of pure stylesheet that were drowning the component. Interpolates
// the same C tokens + THEME_CSS it always did; App renders it via
// <style>{APP_CSS}</style>. Byte-identical output, verified by SSR hash.
import { C, THEME_CSS } from "./theme";

export const APP_CSS = `
        ${THEME_CSS}

        /* ═══════════════════════════════════════════════════════════════
           TODAY-PAGE REDESIGN (Jun 6 2026 — Adam direction)
           ───────────────────────────────────────────────────────────────
           MIGRATED Jun 7 2026: this block originally lived under
           body.rt-today-redesign so it only applied to the Today page.
           After Today landed, Adam migrated everything sitewide — the
           cool palette + sidebar + composer greening + FAB greening +
           dial greening are now the DEFAULT app state, not a scoped
           override. Most palette redirects moved to :root above. The
           rules below are the non-variable styling (sidebar geometry,
           component recoloring) that needed to land as global defaults.

           Changes baked in:
           1. Sidebar → primaryDeep green, flush-left, no card chrome
           2. Logo → white
           3. Nav items recolored for dark bg
           4. Page bg → #FAFBFA (via --rt-bg, set on :root)
           5. Cards/tiles stay white
           6. Link color (was purple) → primaryDeep with dotted underline
           7. + buttons (composer plus, FAB) → green
           8. Composer Add button → green when triggered
           9. Dial now-dot → forest green (was purple)
           ═══════════════════════════════════════════════════════════════ */

        body {
          background: #FAFBFA !important;
          /* Brand font on body — portals (More sheet, modals, pickers) mount
             on document.body and previously fell back to the UA default font
             because Manrope only lived on .app-root. */
          font-family: 'Manrope', system-ui, sans-serif;
          color: #1E261F;
        }
        /* Content scroll container — force same bg as body so the
           area right of the sidebar reads as a single continuous surface. */
        .r-main {
          background: #FAFBFA !important;
        }
        /* Kill the legacy paper-grain dots on body. */
        body {
          background-image: none !important;
        }

        /* (V1_GRAD kill-rule removed June 2026 refactor — the gradients it
           targeted are gone from the codebase.) */

        /* Today canvas backdrop — Variant A border-cool-strong wash.
           A soft cool-grey zone behind the task list. Top stop at 0.32. */
        .rt-today-canvas {
          background: linear-gradient(180deg, rgba(220,224,220,0.32), rgba(220,224,220,0.02)) !important;
          background-image: linear-gradient(180deg, rgba(220,224,220,0.32), rgba(220,224,220,0.02)) !important;
        }

        /* Sidebar — flush left, primaryDeep green, no float chrome.
           Uses primaryDeep (#1C3224), the darkest stop. html prefix outranks
           inline styles on the .r-desk element. */
        html .r-desk,
        html div.r-desk {
          background: #1C3224 !important;
          background-image: none !important;
          top: 0 !important;
          left: 0 !important;
          bottom: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          width: 240px !important;
        }
        html .r-desk.is-collapsed,
        html div.r-desk.is-collapsed {
          width: 64px !important;
        }

        /* Logo color is set further down (warm cream override) */

        /* Nav items — readable on dark green. Hover/active states lift the
           dark green toward primary (lighter same-family) instead of
           layering white. Pure white at any opacity reads as grey-cool on
           dark green and introduces a foreign hue. Lifting within the
           green family keeps the hover looking like "this row got more
           illuminated" rather than "a grey film was laid on top."

           html prefix on all rules — there are conflicting global
           .nav-item rules later in the stylesheet (set white card bg on
           hover, designed for old cream sidebar). Equal-specificity later
           rules would override. html prefix bumps these rules to a
           higher specificity (0,2,1 vs 0,2,0) so they win unconditionally. */
        html .r-desk .nav-item {
          color: rgba(255,255,255,0.78) !important;
          background: transparent !important;
          background-image: none !important;
        }
        html .r-desk .nav-item:hover,
        html .r-desk .nav-item:hover:not(.is-active) {
          background: rgba(80, 130, 95, 0.18) !important;
          background-image: none !important;
          color: #FFFFFF !important;
          box-shadow: none !important;
        }
        /* Active state: the inline JSX sets a white→cream embossed gradient
           with stacked inset shadows + translateY. That treatment was right
           for a cream sidebar but reads as a kid-UI white chip on the dark
           green. Kill the gradient + shadows; lift the row in-family. */
        html .r-desk .nav-item.is-active {
          background: rgba(255, 255, 255, 0.06) !important;
          background-image: none !important;
          color: #FFFFFF !important;
          box-shadow: none !important;
          transform: none !important;
        }
        /* Active text + icon — JSX inlined C.primaryDeep (same as sidebar
           bg) so they vanish on the green tint. Force white. */
        html .r-desk .nav-item.is-active span {
          color: #FFFFFF !important;
        }
        html .r-desk .nav-item.is-active svg,
        html .r-desk .nav-item.is-active svg * {
          stroke: #FFFFFF !important;
          color: #FFFFFF !important;
          stroke-width: 2.15 !important;
        }
        /* Hovered nav-item svg — brighter than rest (78%) but NOT full
           white, so hover stays visibly distinct from the active state
           (which is pure white). Without this, hover and active icons
           looked identical even though the row background differed. */
        html .r-desk .nav-item:hover:not(.is-active) svg,
        html .r-desk .nav-item:hover:not(.is-active) svg * {
          color: rgba(255,255,255,0.88) !important;
          stroke: rgba(255,255,255,0.88) !important;
        }
        .r-desk .nav-item svg {
          stroke: currentColor !important;
        }

        /* Stamp/Caveat text — slightly muted on dark */
        .r-desk .caveat,
        .r-desk [style*="Caveat"] {
          color: rgba(255,255,255,0.55) !important;
        }

        /* User chip + divider lines inside sidebar */
        .r-desk .rt-user-chip {
          color: rgba(255,255,255,0.88) !important;
        }
        .r-desk hr,
        .r-desk [style*="border-top"] {
          border-color: rgba(255,255,255,0.08) !important;
        }

        /* Toggle button between sidebar and content — restyle for dark */
        .rt-sidebar-toggle {
          background: #33543E !important;
          color: #FFFFFF !important;
          border: 1px solid rgba(255,255,255,0.12) !important;
          box-shadow: 0 1px 4px rgba(20,30,22,0.18) !important;
        }

        /* Main content shift — sidebar is now flush-left (no 14px inset)
           so the main content's left padding should account for new width */
        .r-mainwrap {
          padding-left: 0 !important;
        }

        .rt-purple-link {
          color: #33543E !important;
          text-decoration-color: #33543E !important;
        }
        @media (hover: hover) {
          .rt-purple-link:hover {
            color: #2D4A37 !important;
            text-decoration-color: #2D4A37 !important;
            text-decoration-style: solid !important;
          }
        }

        /* Client-name link color in the daily brief (.rt-today-lede a). */
        .rt-today-lede a,
        .rt-today-lede a:visited {
          color: #33543E !important;
          text-decoration-color: rgba(51,84,62,0.5) !important;
        }

        /* Composer plus button → primarySoft locked as default. No
           separate hover treatment — the soft green stays regardless. */
        /* .rt-composer-plus green !important overrides REMOVED (June 2026).
           The puck is now the Brain Dump button and styles itself inline —
           purple silhouette with white fissure strokes. The old force-fill
           turned the brain into a solid green blob. */

        /* Composer Add button — green when armed (button only shows the
           gradient when newTask.trim() is truthy; we override that armed
           state to forest green). */
        .rt-add-task-btn:not(:disabled) {
          background: #33543E !important;
          background-image: none !important;
          color: #FFFFFF !important;
          box-shadow: 0 1px 2px rgba(20,30,22,0.10), 0 2px 6px rgba(51,84,62,0.25) !important;
        }
        .rt-add-task-btn:not(:disabled):hover {
          background: #2D4A37 !important;
        }
        /* Disabled / rest state — was cream (C.surfaceWarm).
           Now hoverSurface #F4F6F4 with textMuted text. */
        .rt-add-task-btn:disabled,
        .rt-add-task-btn[disabled] {
          background: #F4F6F4 !important;
          background-image: none !important;
          color: #9A9A93 !important;
          box-shadow: none !important;
        }

        /* Dial now-marker — was purple; switch to forest green */
        .rt-dial-now-dot,
        .rt-dial-now circle {
          fill: #33543E !important;
        }
        .rt-dial-now-ring {
          stroke: #33543E !important;
        }

        /* Floating quick-log FAB (bottom-right) — was purple gradient.
           Override to forest green globally. */
        .rt-quicklog-fab {
          background: #33543E !important;
          background-image: none !important;
          box-shadow: 0 1px 2px rgba(20,30,22,0.10), 0 6px 20px rgba(51,84,62,0.30) !important;
        }
        .rt-quicklog-fab:hover {
          background: #274230 !important;
        }

        /* ── BRAND LOGO COLOR ───────────────────────────────────────────
           Pure white #FFFFFF — what the major B2B SaaS brands do on dark
           sidebars (Notion, Linear, Vercel, Stripe Dashboard). Maximum
           legibility, brand-agnostic, no second-guessing. */
        .r-desk > div:first-child span {
          color: #FFFFFF !important;
        }

        /* ── NAV DOT BULLSEYE FIX ──────────────────────────────────────
           hasDot() rendered the red unread indicator with a solid white
           ring (boxShadow: 0 0 0 2.5px C.card) so it would stand out from
           the sidebar's cream background. Now that the sidebar is dark
           green, a solid white ring around a red dot reads as kid-UI
           bullseye. Subtler ring via inset rgba — adds a tiny crisp
           separation against the active row's background without screaming. */
        .r-desk .nav-item > div[style*="border-radius: 50%"][style*="background"] {
          box-shadow: 0 0 0 1.5px rgba(0,0,0,0.18) !important;
        }

        /* ── DONE / PORTFOLIO WIDGET — DARK MODE TEXT ──────────────────
           Widget uses C.text / C.textSec / C.primaryDeep / C.border which
           all read as dark ink on light. On the dark sidebar everything
           goes invisible. Class-scoped overrides for reliability. The
           bucket count colors (retElite green, retGood softer green,
           retWarn yellow) pop fine on dark — preserved. */
        .rt-sidebar-widget {
          background: transparent !important;
          box-shadow: none !important;
          border-top: 1px solid rgba(255,255,255,0.08) !important;
          border-radius: 0 !important;
        }
        /* All text inside the widget gets lifted to light by default. Then
           specific bucket count digits get re-colored by inline style which
           outranks this. */
        .rt-sidebar-widget,
        .rt-sidebar-widget * {
          color: rgba(255,255,255,0.55) !important;
        }
        /* Big "108" number + active period selector — brighter than rest */
        .rt-sidebar-widget > div:first-child > div:nth-child(3) > div:first-child {
          color: rgba(255,255,255,0.92) !important;
        }
        /* MRR dollar figure — same brightness as the tasks number (the
           positional selector above only catches the tasks number's DOM
           slot, so the MRR figure is whitened by class instead). */
        .rt-sidebar-widget .rt-widget-mrr {
          color: rgba(255,255,255,0.92) !important;
        }
        /* Borders / dividers — soft on dark */
        .rt-sidebar-widget > div:first-child {
          border-bottom-color: rgba(255,255,255,0.08) !important;
        }
        /* Active period selector underline */
        .rt-sidebar-widget div[style*="border-bottom: 1px"] {
          border-bottom-color: rgba(255,255,255,0.55) !important;
        }
        /* Squiggle SVG underline — was C.primaryDeep (same as sidebar bg) */
        .rt-sidebar-widget svg path {
          stroke: rgba(111,191,142,0.55) !important;
        }
        /* Bucket count NUMBERS — restored to the real retention palette,
           brightened so each hue reads on the dark green sidebar. Keeps the
           green → gold → red meaning consistent with the rest of the app
           instead of a foreign monochrome grey ramp. */
        .rt-sidebar-widget [style*="color: rgb(12, 58, 46)"],
        .rt-sidebar-widget [style*="color: #0C3A2E"] {
          color: #6FBF8E !important; /* Thriving */
        }
        .rt-sidebar-widget [style*="color: rgb(31, 122, 92)"],
        .rt-sidebar-widget [style*="color: #1F7A5C"] {
          color: #4FB389 !important; /* Healthy */
        }
        .rt-sidebar-widget [style*="color: rgb(168, 164, 32)"],
        .rt-sidebar-widget [style*="color: #A8A420"] {
          color: #D4C84A !important; /* Watch */
        }
        .rt-sidebar-widget [style*="color: rgb(209, 122, 27)"],
        .rt-sidebar-widget [style*="color: #D17A1B"] {
          color: #E89B47 !important; /* At-risk */
        }
        .rt-sidebar-widget [style*="color: rgb(180, 52, 31)"],
        .rt-sidebar-widget [style*="color: #B4341F"] {
          color: #E0654A !important; /* Critical */
        }
        .r-desk-bucket-dark-fix {}  /* anchor */
        /* Stacked bucket bar — same brightened retention ramp as the numbers. */
        .rt-sidebar-widget [style*="background: rgb(12, 58, 46)"],
        .rt-sidebar-widget [style*="background: #0C3A2E"],
        .rt-sidebar-widget [style*="background:#0C3A2E"] {
          background: #6FBF8E !important; /* Thriving */
        }
        .rt-sidebar-widget [style*="background: rgb(31, 122, 92)"],
        .rt-sidebar-widget [style*="background: #1F7A5C"],
        .rt-sidebar-widget [style*="background:#1F7A5C"] {
          background: #4FB389 !important; /* Healthy */
        }
        .rt-sidebar-widget [style*="background: rgb(168, 164, 32)"],
        .rt-sidebar-widget [style*="background: #A8A420"],
        .rt-sidebar-widget [style*="background:#A8A420"] {
          background: #D4C84A !important; /* Watch */
        }
        .rt-sidebar-widget [style*="background: rgb(209, 122, 27)"],
        .rt-sidebar-widget [style*="background: #D17A1B"],
        .rt-sidebar-widget [style*="background:#D17A1B"] {
          background: #E89B47 !important; /* At-risk */
        }
        .rt-sidebar-widget [style*="background: rgb(180, 52, 31)"],
        .rt-sidebar-widget [style*="background: #B4341F"],
        .rt-sidebar-widget [style*="background:#B4341F"] {
          background: #E0654A !important; /* Critical */
        }

        /* ── PERIOD SELECTOR (Week / Month / Year) — SIDEBAR DARK MODE ─
           Base CSS sets hover to var(--rt-text) (near-black ink) which
           is invisible on the dark sidebar. Override here with a sage
           tint — same brand family as the nav hover state, just text
           only (no background fill, the period selectors are inline
           text toggles not chip rows).

           Active state: brighter sage + sage underline. Affordance
           escalates from hover (soft sage at 40% underline) to active
           (sharper sage at full underline). Active has no className
           in JSX (only inactive items get .r-period-opt), so we target
           via the inline border-bottom signature with the primary-green
           color — uniquely identifies the active period row. */
        html .r-desk .rt-sidebar-widget .r-period-opt:hover {
          color: #A8C4B5 !important;
          border-bottom-color: rgba(168,196,181,0.40) !important;
        }
        html .r-desk .rt-sidebar-widget div[style*="border-bottom: 1px solid rgb(51, 84, 62)"],
        html .r-desk .rt-sidebar-widget div[style*="border-bottom:1px solid rgb(51, 84, 62)"],
        html .r-desk .rt-sidebar-widget div[style*="border-bottom: 1px solid #33543E"] {
          color: #C8DCD0 !important;
          border-bottom-color: #C8DCD0 !important;
        }

        /* ── PROFILE CHIP (A circle + name + company) ──────────────────
           Avatar: C.primarySoft (#E6EFE9) — pale on dark = wafer.
           Name: C.text (#1E261F) — invisible on dark.
           Company: C.textSec — invisible.
           Make avatar a subtle white-on-dark chip, text light. */
        .rt-user-chip > div:first-child {
          background: rgba(255,255,255,0.10) !important;
          color: #FFFFFF !important;
        }
        .rt-user-chip > div:nth-child(2) > div:first-child {
          color: rgba(255,255,255,0.88) !important;
        }
        .rt-user-chip > div:nth-child(2) > div:nth-child(2) {
          color: rgba(255,255,255,0.55) !important;
        }
        .rt-user-chip:hover {
          background: rgba(255,255,255,0.05) !important;
        }

        /* ═══════════════════════════════════════════════════════════════
           END SITEWIDE MIGRATION
           ═══════════════════════════════════════════════════════════════ */

        /* ── RAI CHAT — HIDE SCROLLBAR ─────────────────────────────────
           The internal scrollbar on .r-rai-scroll clashes visually with
           the rounded card chrome / page border. Keep scroll functional,
           hide the visible scrollbar across all browsers. */
        .r-rai-scroll {
          scrollbar-width: none !important;          /* Firefox */
          -ms-overflow-style: none !important;       /* IE / old Edge */
        }
        .r-rai-scroll::-webkit-scrollbar {
          display: none !important;                  /* Chrome / Safari / Edge */
          width: 0 !important;
          height: 0 !important;
        }

        /* ── RAI SIDEBAR CONVO LIST — HIDE SCROLLBAR ───────────────────
           Same treatment as the chat container — the past-chats list
           inside the sidebar gets a scrollbar that visually clashes
           with the dark green chrome. */
        .r-rai-sidebar-list {
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }
        .r-rai-sidebar-list::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }

        /* ── RAI SIDEBAR — NEW CHAT BUTTON ─────────────────────────────
           Inline JSX uses var(--rt-grad-btn) (purple gradient) + purple
           shadow. That gradient was right for the old cream sidebar but
           reads as loud / AI-generated against the dark green. Override
           to coherent sidebar treatment — primary-tinted ghost button
           with hover state matching nav rows. */
        html .r-desk .rt-rai-pop-btn {
          background: transparent !important;
          background-image: none !important;
          color: rgba(255,255,255,0.78) !important;
          box-shadow: none !important;
          border: none !important;
        }
        html .r-desk .rt-rai-pop-btn:hover {
          background: rgba(80, 130, 95, 0.18) !important;
          background-image: none !important;
          color: #FFFFFF !important;
          box-shadow: none !important;
          transform: none !important;
        }
        html .r-desk .rt-rai-pop-btn:active {
          background: rgba(80, 130, 95, 0.24) !important;
          transform: none !important;
        }
        html .r-desk .rt-rai-pop-btn svg,
        html .r-desk .rt-rai-pop-btn svg * {
          stroke: currentColor !important;
          color: currentColor !important;
        }

        /* ── RAI SIDEBAR — CONVO ROW STATES ───────────────────────────
           Mirrors the main nav rows exactly:
             rest   → transparent, 65% white text
             hover  → green-tint, white text
             active → white-tint pill (rgba 255 .06), white text, 600
           Active bg + color come from the inline JSX; these rules set
           the rest/hover text and kill any leftover shadow. */
        html .r-desk .r-convo-row {
          box-shadow: none !important;
        }
        html body .r-desk .r-convo-row:not(:hover):not(.is-active),
        html body .r-desk .r-convo-row:not(:hover):not(.is-active) span {
          color: rgba(255,255,255,0.65) !important;
        }
        html body .r-desk .r-convo-row.is-active,
        html body .r-desk .r-convo-row.is-active span {
          color: #FFFFFF !important;
        }
        html body .r-desk .r-convo-row:hover {
          background: rgba(80, 130, 95, 0.18) !important;
          box-shadow: none !important;
        }
        html body .r-desk .r-convo-row:hover,
        html body .r-desk .r-convo-row:hover span {
          color: #FFFFFF !important;
        }

        /* Section labels (Starred / Recent) above convo lists — JSX sets
           color: C.textSec which is dark ink, invisible on dark sidebar. */
        .r-rai-sidebar-list > div[style*="text-transform: uppercase"],
        .r-rai-sidebar-list > div[style*="textTransform: uppercase"] {
          color: rgba(255,255,255,0.45) !important;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        /* Paper grain — barely-perceptible noise texture on the cream
           substrate. Eight 1px radial dots tiled at 220px gives the
           background warmth and depth without being legible up close.
           Coated paper feel vs flat SaaS cream. Tile size deliberately
           prime-adjacent so the pattern doesn't visibly repeat. */
        html, body {
          background:
            radial-gradient(ellipse 1px 1px at 13% 27%, rgba(20,30,22,0.04) 50%, transparent 50%),
            radial-gradient(ellipse 1px 1px at 42% 71%, rgba(20,30,22,0.03) 50%, transparent 50%),
            radial-gradient(ellipse 1px 1px at 78% 13%, rgba(20,30,22,0.04) 50%, transparent 50%),
            radial-gradient(ellipse 1px 1px at 89% 89%, rgba(20,30,22,0.025) 50%, transparent 50%),
            radial-gradient(ellipse 1px 1px at 33% 91%, rgba(20,30,22,0.035) 50%, transparent 50%),
            radial-gradient(ellipse 1px 1px at 64% 33%, rgba(20,30,22,0.03) 50%, transparent 50%),
            radial-gradient(ellipse 1px 1px at 24% 53%, rgba(20,30,22,0.04) 50%, transparent 50%),
            radial-gradient(ellipse 1px 1px at 71% 64%, rgba(20,30,22,0.035) 50%, transparent 50%),
            var(--rt-bg);
          background-size: 220px 220px;
          overscroll-behavior: none;
        }
        input, textarea, select { font-size: 16px !important; }
        @media (min-width: 768px) { input, textarea, select { font-size: 14px !important; } }
        /* Rai chat inputs (both surfaces — the welcome-screen composer and
           the in-conversation "Reply to Rai" bar) opt out of the global
           14px desktop input override. The global rule exists to prevent
           iOS zoom-on-focus (which needs 16px+ on mobile) and to keep
           dense forms tight on desktop; but the Rai surface is a writing
           surface, not a form field — it should read at the same comfort
           as a chat message, not a filter input. Selector specificity
           (.r-rai-page descendant) beats the bare textarea selector
           even with the !important on it, so this rule wins on desktop. */
        @media (min-width: 768px) {
          .r-rai-page textarea { font-size: 16px !important; }
        }
        ::selection { background: #33543E; color: #fff; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: var(--rt-border); border-radius: 2px; }
        /* ── NAV ITEM ICON COLOR STATES ───────────────────────────────
           Three-state flow controlled via CSS custom properties on the
           parent .nav-item / .nav-item-mobile, picked up by the SVG
           paths inside via var(--icon-body) / var(--icon-accent).
             rest      → warm gray (textMuted), feels quiet
             hover     → sage (primaryMuted), brand color previewing
             active    → full green (primaryLight), brand color committed
           The :hover override only fires on devices that actually
           hover (hover: hover) so mobile gets a clean 2-state flow:
           gray at rest, full green when active. */
        .nav-item, .nav-item-mobile {
          --icon-body: #9A9A93;
          --icon-accent: #6B6B66;
        }
        /* Mobile nav: kill the OS tap-highlight flash. Without this, a tap
           fires TWO visual changes — the browser's grey tap overlay, then
           our is-active transition — which reads as a janky double color
           change. Suppressing the native highlight leaves only the single,
           smooth is-active background+shadow transition, matching desktop. */
        .nav-item-mobile {
          -webkit-tap-highlight-color: transparent;
          -webkit-touch-callout: none;
          user-select: none;
          -webkit-user-select: none;
        }
        .nav-item-mobile:active { background: transparent; }
        .nav-item-mobile.is-active:active { background: var(--rt-card, #fff); }
        @media (hover: hover) {
          .nav-item:hover:not(.is-active),
          .nav-item-mobile:hover:not(.is-active) {
            --icon-body: #8FA597;
            --icon-accent: #4D5C50;
          }
        }
        .nav-item.is-active,
        .nav-item-mobile.is-active {
          --icon-body: #558B68;
          --icon-accent: #2F2F31;
        }
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
          background: rgba(255,255,255,0.05) !important;
          box-shadow: none !important;
          transform: none !important;
        }

        /* Slideover topbar nav buttons (↑↓) — subtle surface wash and
           darker color on hover. No transform — hover stays light. */
        .rt-so-nav:not(:disabled):hover {
          background: var(--rt-surface) !important;
          color: var(--rt-text) !important;
        }
        .rt-so-nav .rt-so-preview {
          position: absolute;
          top: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%);
          background: var(--rt-text);
          color: #fff;
          padding: 6px 9px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 500;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: opacity 140ms var(--rt-ease-out);
          display: inline-flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 4px 12px rgba(20,30,22,0.18);
          z-index: 10;
        }
        .rt-so-nav .rt-so-preview::before {
          content: "";
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 4px solid transparent;
          border-bottom-color: var(--rt-text);
        }
        .rt-so-nav:not(:disabled):hover .rt-so-preview {
          opacity: 1;
        }
        .rt-so-nav .rt-so-preview .rt-so-preview-kicker {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.6px;
          text-transform: uppercase;
          opacity: 0.7;
        }

        /* Sidebar collapse toggle — floating disc that straddles the
           sidebar's right edge, vertically aligned with the brand mark.
           Variant C from the wide options mock.

           Sizing: 22×22 — large enough to read as an intentional control,
           small enough not to compete with the brand mark or nav items.

           Weight (Retayned tokens):
             — background: var(--rt-card) (white, contrasts with cream sidebar)
             — shadow: stacked rt-sh-xs + 1px hairline outline at 6% black
               (gives lift without the "stranded chip" feel of heavy shadows)
             — color: text-muted at rest, text on hover (mirrors the
               rest→hover color shift the nav items use)

           Position: fixed against the viewport, left computed from
           --sidebar-w so the disc tracks the sidebar's right edge
           through the collapse/expand transition. top: 36px centers the
           disc on the brand mark (14px sidebar offset + 22px brand
           padding-top + 11px to the brand text vertical center, minus
           11px to center the 22px disc → 36px). */
        .rt-sidebar-toggle {
          display: none;
        }
        @media (min-width: 768px) {
          .rt-sidebar-toggle {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            position: fixed;
            left: calc(var(--sidebar-w, 240px) + 14px - 11px);
            top: 36px;
            width: 22px;
            height: 22px;
            border-radius: 50%;
            background: var(--rt-card);
            color: var(--rt-text-muted);
            border: none;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
            line-height: 1;
            padding: 0;
            font-family: inherit;
            /* Stacked: tiny drop + hairline outline. Together they give
               just enough definition for the disc to read as a touchable
               element without the "floating chip" effect. */
            box-shadow:
              0 1px 2px rgba(20, 30, 22, 0.05),
              0 2px 6px rgba(20, 30, 22, 0.04),
              0 0 0 1px rgba(20, 30, 22, 0.06);
            z-index: 51;
            transition: left 220ms var(--rt-ease-out),
                        color 160ms var(--rt-ease-out),
                        box-shadow 200ms var(--rt-ease-out),
                        transform 180ms var(--rt-ease-out);
          }
          .rt-sidebar-toggle:hover {
            color: var(--rt-text);
            box-shadow:
              0 1px 2px rgba(20, 30, 22, 0.06),
              0 3px 10px rgba(20, 30, 22, 0.08),
              0 0 0 1px rgba(20, 30, 22, 0.10);
            transform: scale(1.06);
          }
          .rt-sidebar-toggle:active {
            transform: scale(0.94);
            transition: transform 80ms var(--rt-ease-press);
          }
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

        /* Inline links — Magic Scoop client name, Connect Google
           Calendar. Hover signal: color darkens + dotted underline goes
           to solid. Font-weight stays at 600 at rest AND hover so the
           box geometry never shifts — hovering can't push neighboring
           text or change the link's footprint.

           Uses primary green (#33543E) — was originally C.btn (purple).
           Migrated sitewide so all dotted-underlined links and client
           names match the brand palette. Hover deepens to primaryDark.

           Uses text-decoration (not border-bottom) so the underline
           survives when the consuming element has an inline border:none
           reset on it (which buttons do, to kill the native button
           outline). A border-bottom-based version got wiped out by
           those resets — Connect Google Calendar rendered with no
           underline at all. */
        /* Navigation links (client names, connect actions) stay GREEN.
           Purple is reserved for Rai interactions — see .is-discussable. */
        .rt-purple-link {
          color: #33543E;
          font-weight: 600;
          text-decoration: underline;
          text-decoration-style: dotted;
          text-decoration-color: #33543E;
          text-decoration-thickness: 1px;
          text-underline-offset: 3px;
          transition: color 0.12s, text-decoration-style 0.12s, text-decoration-color 0.12s;
        }
        @media (hover: hover) {
          .rt-purple-link:hover {
            color: #2D4A37;
            text-decoration-style: solid;
            text-decoration-color: #2D4A37;
          }
        }

        /* Dot-bullet separator — replaces the · character which has
           inconsistent vertical alignment and weight across fonts. A
           real 4×4px circular div sits perfectly centered between
           adjacent text and renders identically across all browsers.
           Used in meta rows across pages (X referrals · Y conv · etc). */
        .rt-sep {
          display: inline-block;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--rt-border);
          margin: 0 2px;
          vertical-align: middle;
          flex-shrink: 0;
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

        /* ── UNIFIED PICKER SURFACE — Client / Worker / Due dropdowns.
           These three composer pickers were built at different times
           and had drifted: three different border-radii, three different
           paddings, three different shadow languages. This unifies them
           to one panel + one item treatment that matches Retayned's
           --rt-sh-card stacked-shadow language (just stronger, because
           a picker overlays content and needs more elevation than a
           card at rest). */
        .rt-picker-panel {
          background: var(--rt-card);
          border-radius: 12px;
          padding: 6px;
          box-shadow:
            0 0 0 1px rgba(20, 30, 22, 0.08),
            0 2px 6px rgba(20, 30, 22, 0.08),
            0 12px 32px rgba(20, 30, 22, 0.16);
        }
        /* Due picker — base (desktop) positioning. Anchored absolutely
           to the chip wrapper (position:relative parent), opening
           below the chip with a 6px gap, flush to the chip's left
           edge. CSS owns positioning so mobile media queries can
           override without losing to React inline-style specificity
           (inline always wins against !important CSS). */
        .rt-due-picker {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
        }
        .rt-picker-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border-radius: 6px;
          border: none;
          background: transparent;
          cursor: pointer;
          font-family: inherit;
          text-align: left;
          color: var(--rt-text);
          font-size: 13px;
          width: 100%;
          transition: background 120ms var(--rt-ease-out),
                      color 120ms var(--rt-ease-out);
        }
        .rt-picker-item:hover,
        .rt-picker-item.is-highlight {
          background: rgba(20, 30, 22, 0.04);
        }
        .rt-picker-item.is-active {
          background: rgba(20, 30, 22, 0.04);
        }
        .rt-picker-divider {
          height: 1px;
          background: var(--rt-border-light);
          margin: 4px 6px;
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
        /* Rolodex rhythm cards: gentle lift on hover, TimeDial-style pulsing
           now-dot on the most-overdue (slipping) cards. Motion disabled under
           prefers-reduced-motion. */
        .rt-rolo-card { transition: box-shadow 160ms var(--rt-ease-out), transform 160ms var(--rt-ease-out); }
        .rt-rolo-card:hover { box-shadow: 0 2px 6px rgba(20,30,22,0.08), 0 8px 20px rgba(20,30,22,0.06); transform: translateY(-1px); }
        @keyframes rt-rhythm-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(168,93,76,0.45); } 50% { box-shadow: 0 0 0 5px rgba(168,93,76,0); } }
        .rt-rhythm-dot { animation: rt-rhythm-pulse 2.2s infinite; }
        @media (prefers-reduced-motion: reduce) { .rt-rhythm-dot { animation: none; } .rt-rolo-card { transition: none; } }
        /* Neutral row-hover variant — for table rows where green is too
           loud / fights with status pills inside the row. Same shift-right
           motion, lighter wash. Used in the Clients Table view (both mobile
           + desktop variants). */
        .row-hover-neutral { transition: background 0.1s, transform 180ms var(--rt-ease-out); cursor: pointer; }
        .row-hover-neutral:hover { background: rgba(0,0,0,0.03); transform: translateX(2px); }

        /* ── .rt-soft-row — queue row with sage hover preview ──
           Used by left-side widget queues (Who to ask next, Awaiting
           retro, Health queue). Idle = transparent. Hover = sage wash
           (#EAEDE9) which previews the active soft-green commit state
           without being as loud. Active state is set inline at the
           call site (typically primarySoft bg + primary border-left).
           The :not selector ensures hover doesn't override the active
           treatment when the row is also active. */
        .rt-soft-row { transition: background 140ms, border-left-color 140ms; cursor: pointer; background: transparent; }
        /* ── .rt-divider-inset — in-card hairlines (Jun 2026) ──────
           Full-bleed borders against rounded card corners read as a
           defect next to the inset hairlines used elsewhere (see the
           Warmth card footer). This keeps the ROW full width — hover
           backgrounds still light edge-to-edge — while the divider
           itself stops short of the corners. Inset defaults to 14px,
           overridable per-container via --rt-inset to match padding. */
        /* ── .rt-msg-act — draft action chips under Rai replies ────
           (Jun 2026) Quiet bordered chips in the app's pill language:
           hairline border, muted label, sage hover, green confirmed
           state for Copy. Rendered only under replies containing an
           actual draft (see RaiMessageActions). */
        .rt-msg-act {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 5px 11px; border-radius: 8px;
          border: 1px solid var(--rt-border-light);
          background: transparent; color: #8A8F8A;
          font-family: inherit; font-size: 11.5px; font-weight: 600;
          letter-spacing: 0.01em; cursor: pointer; text-decoration: none;
          transition: background 140ms, color 140ms, border-color 140ms;
        }
        .rt-msg-act:hover {
          background: var(--rt-primary-soft, #E6EFE9);
          color: var(--rt-primary, #33543E);
          border-color: transparent;
        }
        .rt-msg-act.is-done {
          color: var(--rt-primary, #33543E);
          border-color: var(--rt-primary-soft, #E6EFE9);
          background: var(--rt-primary-soft, #E6EFE9);
        }
        .rt-divider-inset { position: relative; }
        .rt-divider-inset::after {
          content: ""; position: absolute; bottom: 0; height: 1px;
          left: var(--rt-inset, 14px); right: var(--rt-inset, 14px);
          background: var(--rt-border-light);
        }
        .rt-divider-inset-top { position: relative; }
        .rt-divider-inset-top::before {
          content: ""; position: absolute; top: 0; height: 1px;
          left: var(--rt-inset, 14px); right: var(--rt-inset, 14px);
          background: var(--rt-border-light);
        }
        .rt-soft-row:not(.is-active):hover { background: #EAEDE9 !important; }

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
          background: #274230 !important;
          box-shadow: 0 1px 2px rgba(20,30,22,0.10), 0 6px 20px rgba(51,84,62,0.30) !important;
          transform: translateY(-1px);
        }
        .rt-add-task-btn:not(:disabled):active {
          transform: translateY(0) scale(0.97);
          transition: transform 80ms var(--rt-ease-press);
        }
        /* Rai-territory gradient buttons (sidebar New Chat, future
           additions). Use the SITE STANDARD --rt-sh-purple at rest and
           --rt-sh-purple-hover on hover (same as every other primary
           purple CTA). Previously used the special --rt-sh-rai-pop
           token which had a 32px halo bleed — hover-tier intensity for
           a rest state. The class kept its name for compatibility but
           no longer applies the heavy halo. */
        /* New Chat button (.rt-rai-pop-btn) lives only in the dark Rai
           sidebar, where the html .r-desk ghost rules above own all of its
           states (transparent + hairline, faint white-tint hover). No
           purple gradient / lift here anymore. */
        .rt-rai-pop-btn:active {
          transform: none;
        }

        /* ──────────────────────────────────────────────────────
           CLIENT MODAL — STICKY FOOTER BUTTONS
           Discuss at rest is flat C.btn (matches Add Client, Add
           Worker — the standard primary button style). On hover
           it reveals the Rai-territory gradient + halo + 1px lift.
           Edit/Pause/Remove are card chips at rest and lift to
           sh-card on hover, same chip language as nav/composer.
           ────────────────────────────────────────────────────── */
        /* Discuss button uses the legacy .r-btn[data-tone="purple"]
           pattern (gradient + halo + 1px lift) — same as Add Client.
           Earlier iterations had a custom rt-cm-btn-primary that felt
           janky on hover; removed in favor of the standard. */
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
        .rt-row:hover .rt-dismiss,
        .rt-row:hover .rt-push { opacity: 1 !important; }

        /* ── TODAY EMPHASIS (break-out, "B") ───────────────
           The first today task is pulled LEFT out of the grid,
           lifted and larger — physically closest to the reader.
           The rest sit indented on a quiet vertical thread.
           Misalignment is the attention magnet; no color trick.
           Condensed = future buckets tighten. */
        .rt-today-canvas {
          background: linear-gradient(180deg, rgba(234,228,214,0.32), rgba(234,228,214,0.02));
          position: relative;
          border-radius: 20px;
          padding: 6px 14px 16px;
          margin: 6px -8px 0;
        }
        /* Break-out top task — same full width as every other row, just
           shifted left via transform so it breaks the rhythm without
           changing length. Lifted + bigger checkbox carry the emphasis.
           When a new task becomes the break-out (e.g. task 1 completed,
           task 2 promotes), it eases in from the normal row position
           instead of popping into the offset+lift. */
        .rt-today-breakout {
          transform: translateX(-24px);
          margin-bottom: 14px;
        }
        /* Entry animation ONLY when a task just promoted into the slot — gated
           by the .rt-today-breakout-animate class (set briefly via justPromoted
           state). Without this gate the animation replayed on every page mount,
           causing a spurious swing when returning to the Today tab. */
        .rt-today-breakout-animate {
          animation: rt-breakout-in 200ms cubic-bezier(.22,.61,.36,1) both;
        }
        @keyframes rt-breakout-in {
          from { transform: translateX(-24px) translateY(-3px); opacity: 0.85; }
          to   { transform: translateX(-24px) translateY(0); opacity: 1; }
        }
        .rt-today-breakout .rt-row {
          padding: 16px 18px;
          box-shadow: 0 0 0 1px rgba(20,30,22,0.10), 0 3px 8px rgba(20,30,22,0.07), 0 12px 30px rgba(20,30,22,0.09) !important;
        }
        .rt-today-breakout-animate .rt-row {
          animation: rt-breakout-row-in 190ms cubic-bezier(.25,.8,.35,1) both;
        }
        @keyframes rt-breakout-row-in {
          from { box-shadow: 0 0 0 1px rgba(20,30,22,0.12), 0 1px 2px rgba(20,30,22,0.04), 0 1px 6px rgba(20,30,22,0.025); }
          to   { box-shadow: 0 0 0 1px rgba(20,30,22,0.10), 0 3px 8px rgba(20,30,22,0.07), 0 12px 30px rgba(20,30,22,0.09); }
        }
        .rt-today-breakout .rt-row .rt-task-title { font-size: 14.5px; font-weight: 500; }
        .rt-today-breakout .rt-row .rt-check { width: 24px; height: 24px; }
        /* When the break-out top task is ALSO a Rai task, layer the
           1px purple ring + soft purple halo OVER the breakout's
           lifted shadow. Per Adam's spec: in this position, the Rai
           hairline gets a little shading too — the breakout already
           carries elevation, so a faint purple glow ties the
           authorship signal into the lift. */
        .rt-today-breakout .rt-row.rt-rai-boost {
          box-shadow: 0 0 0 1px rgba(124,92,243,0.45), 0 3px 8px rgba(20,30,22,0.07), 0 12px 30px rgba(124,92,243,0.10) !important;
        }
        .rt-today-breakout .rt-row.rt-rai-boost:hover:not(.is-done) {
          box-shadow: 0 0 0 1px rgba(124,92,243,0.45), 0 4px 10px rgba(20,30,22,0.08), 0 14px 34px rgba(124,92,243,0.13) !important;
        }
        /* The rest — plain stack, no thread (break-out carries emphasis). */
        .rt-today-rest { position: relative; }
        /* Three type tiers: first today 14.5 / today secondary 14 (base) /
           tomorrow, later, completed 13.5 — a subtle step down for non-today. */
        .rt-row-condensed .rt-row .rt-task-title,
        .rt-completed-log .rt-row .rt-task-title { font-size: 13.5px; }
        /* Tomorrow/Later/completed are dimmed (opacity on their wrappers)
           but otherwise match the today secondary rows exactly — same
           row size, title, and checkbox. No size-shrink. */

        /* ── COMPOSER ────────────────────────────────────── */
        .rt-composer {
          transition: box-shadow 200ms var(--rt-ease-out);
        }
        .rt-rai-inputbox {
          transition: box-shadow 200ms var(--rt-ease-out);
        }
        /* Purple focus state — when the user clicks into the task composer or
           the initial Rai chat input (both use .rt-composer), a soft purple
           ring + gentle glow appears. Deliberately understated (low alpha,
           tight spread) so it reads as elegant focus, not the loud
           primary-button purple. The in-conversation Rai input
           (.rt-rai-inputbox) intentionally does NOT get this — once you're
           in a normal chat it stays neutral. */
        .rt-composer:focus-within {
          box-shadow: 0 0 0 1px rgba(124,92,243,0.30),
                      0 1px 2px rgba(20,30,22,0.04),
                      0 2px 10px rgba(124,92,243,0.10) !important;
        }
        /* Rai new-chat composer focus — no ring. The in-conversation input
           (.rt-rai-inputbox) has no focus treatment, and the new-chat input
           should match: clicking in must not draw a border. Hold the resting
           shadow on focus so nothing changes. */
        .r-rai-intro .rt-composer:focus-within {
          box-shadow: 0 1px 3px rgba(20,30,22,0.04),
                      0 8px 24px rgba(20,30,22,0.06) !important;
        }
        /* (1) The TASK composer (inside the Today page) is an underline-
           style input, not a card. On focus, the 1.5px hairline at the
           bottom thickens and darkens, like a serious text input. */
        .rt-today-v4 .rt-composer {
          transition: border-bottom-color 140ms var(--rt-ease-out);
        }
        .rt-today-v4 .rt-composer:focus-within {
          box-shadow: none !important;
          border-bottom-color: rgba(20,30,22,0.40) !important;
        }
        /* V5 readout fade-in: when the user pauses typing for 400ms, the
           readout line below the composer fades in. Subtle and quick. */
        @keyframes rt-readout-fade-in {
          from { opacity: 0; transform: translateY(-2px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ── CHECKBOX ────────────────────────────────────── */
        .rt-row .rt-check {
          transition: background 240ms ease, border-color 240ms ease,
                      box-shadow 200ms var(--rt-ease-out),
                      transform 280ms cubic-bezier(.34,1.56,.64,1);
        }
        @media (hover: hover) {
          .rt-row:not(.is-done) .rt-check:hover {
            border-color: #558B68 !important;
            box-shadow: 0 0 0 4px var(--rt-primary-soft, #E6EFE9);
          }
        }
        .rt-row .rt-check svg {
          opacity: 0;
          transform: scale(0.4);
          transition: opacity 220ms ease 60ms, transform 320ms cubic-bezier(.34,1.56,.64,1) 60ms;
        }
        .rt-row.is-done .rt-check {
          background: linear-gradient(135deg, #33543E 0%, #274230 100%) !important;
          border-color: #33543E !important;
          box-shadow: var(--rt-sh-green-glow);
          transform: scale(1);
        }
        .rt-row.is-done .rt-check svg { opacity: 1; transform: scale(1); }
        /* Touch devices: bigger visual box + a 48px invisible hit area
           (Apple HIG minimum is 44). The ::after expands the tappable
           region without moving layout. (Jun 2026 — mobile check-off.) */
        @media (hover: none) {
          .rt-row .rt-check { width: 26px; height: 26px; position: relative; }
          .rt-row .rt-check::after { content: ""; position: absolute; inset: -11px; }
        }

        /* ── RAI TASK MARKER ──────────────────────────────────────
           Rai-suggested tasks get TWO signals, both minimal:
             1. A 1px purple hairline border around the row (replaces
                the previous purple ring + inset bar + glow + bobbing
                medallion combo).
             2. An inline purple star icon BEFORE the task title text
                inside the row content (rendered in JSX, not CSS).
           No outer shadow, no extra shading, no animation. Reads as
           typographic attribution, not as AI-marker chrome — the
           "purple-glow AI row" pattern has become a template
           fingerprint we're explicitly avoiding. The hairline says
           "this row belongs to Rai" quietly. The star says it once.
           Done. */
        .rt-rai-boost {
          box-shadow: var(--rt-sh-row), 0 0 0 1px rgba(124,92,243,0.35) !important;
        }
        .rt-rai-boost:hover:not(.is-done) {
          box-shadow: var(--rt-sh-row-hover), 0 0 0 1px rgba(124,92,243,0.35) !important;
        }
        /* When checked off, drop the hairline — completed tasks
           shouldn't read as still-needing-attention. The inline star
           remains in the title, but greyed via .is-done .text rules. */
        .rt-rai-boost.is-done {
          box-shadow: var(--rt-sh-row) !important;
        }

        /* Calendar composer (G) — idle is the flush hairline-divider
           treatment set inline at the call site. On focus-within, the
           row softens into a warm-cream recessed input. Lets us keep
           the lightweight idle state Adam wanted while restoring real
           input weight while typing. Transitions cover the morph so
           neither state feels jumpy. */
        .rt-cal-composer {
          transition: background 180ms var(--rt-ease-out),
                      box-shadow 180ms var(--rt-ease-out);
        }
        .rt-cal-composer:focus-within {
          background: rgba(255,255,255,0.78) !important;
          box-shadow: inset 0 1px 2px rgba(20,30,22,0.06);
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
          0%, 100% { box-shadow: 0 0 0 1px rgba(139,106,27,0.18), 0 2px 8px rgba(139,106,27,0.28); }
          50%      { box-shadow: 0 0 0 1px rgba(139,106,27,0.24), 0 2px 14px rgba(139,106,27,0.42); }
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
          /* Slower, softer shimmer. Was 1.4s with a stronger highlight —
             too mechanical for the brand's calm voice. 2.4s with a more
             modest highlight reads as breathing rather than spinning. */
          background-color: #E8E9E5;
          background-image: linear-gradient(90deg, rgba(232,233,229,0.7) 0%, rgba(247,245,240,0.95) 50%, rgba(232,233,229,0.7) 100%);
          background-size: 480px 100%;
          background-repeat: no-repeat;
          animation: rtShimmer 2.4s ease-in-out infinite;
          border-radius: 4px;
          display: inline-block;
        }
        @keyframes chipPulse {
          0%   { box-shadow: 0 0 0 0 rgba(124,92,243,0.55); }
          40%  { box-shadow: 0 0 0 6px rgba(124,92,243,0.18); }
          100% { box-shadow: 0 0 0 10px rgba(124,92,243,0); }
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
           composer chip pills, etc.
           Hover adds a tiny 180° gradient (white → faint warm) on top of
           the existing lift — gives the chip a physical "rising" feel
           rather than a flat color change. */
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
            background: linear-gradient(180deg, #FFFFFF 0%, #FCFCFA 100%);
            box-shadow: 0 1px 2px rgba(20,30,22,0.05), 0 6px 14px rgba(20,30,22,0.08);
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
        /* Sidebar hidden on mobile. Must use !important because the
           sidebar root has inline display: flex (needed for flex layout
           on desktop), which would otherwise beat the no-important rule
           below 768px and show the desktop sidebar on phones. The
           min-width: 768px rule also uses !important and wins via
           cascade order. */
        .r-desk { display: none !important; }
        .r-mob-bot-dock { display: flex; }
        /* Hide WebKit scrollbars on the horizontal nav strips so the bar
           reads as a clean dock. Firefox uses scrollbarWidth: none inline. */
        .r-mob-nav-strip::-webkit-scrollbar { display: none; }
        .rt-dock-strip::-webkit-scrollbar { display: none; }
        .rt-dock-strip { scrollbar-width: none; -ms-overflow-style: none; }
        /* The scrollable mobile dock is MOBILE-ONLY. Desktop navigates via the
           sidebar, so hide the whole dock wrap at >=768px. (It's portaled to
           <body>, so this rule must target the wrap class directly, not an
           ancestor.) */
        .rt-dock-wrap { display: flex; }        @media (min-width: 768px) { .rt-dock-wrap { display: none !important; } }
        /* Capture FAB — lives in its OWN viewport-fixed portal (a sibling of
           the dock wrap) so the dock's scroll-shrink transform never scales it.
           MOBILE-ONLY, same as the dock: desktop has its own .rt-quicklog-fab,
           so without this gate both would show. The button's own inline style
           uses flex when visible; hide it outright at >=768px. */
        @media (min-width: 768px) { .rt-dock-fab { display: none !important; } }
        /* Mobile Rai-history New Chat button — mirrors desktop .rt-rai-pop-btn. */
        .rt-rai-new-mobile:active { background: rgba(80,130,95,0.26) !important; }
        @media (hover: hover) { .rt-rai-new-mobile:hover { background: rgba(80,130,95,0.18) !important; } }
        /* Active dock item: subtle press feedback only; color is set inline. */
        .rt-dock-item { transition: opacity 160ms ease, transform 120ms ease; }
        .rt-dock-item:active { transform: scale(0.92); }
        /* Mobile-only Revenue-from-referrals card. The desktop version
           lives in the .rc-rail sticky column, which is display:none
           below 768px — so on phones the $ widget vanished entirely.
           This wrapper renders the same content above the network map
           on mobile and hides itself on desktop. */
        .rt-refs-money-mobile { display: none; }
        @media (max-width: 768px) {
          .rt-refs-money-mobile { display: block; margin-bottom: 14px; }
        }
        /* QuickLog FAB — DESKTOP ONLY (power-user quick-capture, all pages).
           Hidden on mobile. Desktop: 52px, bottom-right.
           !important is required: the button sets display:flex inline, which
           would otherwise beat this class rule and leak the FAB onto mobile. */
        .rt-quicklog-fab { display: none !important; }
        @media (min-width: 768px) {
          .rt-quicklog-fab {
            display: flex !important;
            top: auto; bottom: 24px;
            width: 52px; height: 52px;
            border-radius: 50%;
            font-size: 28px;
          }
        }
        /* QuickLog popover — desktop: anchored above the bottom-right FAB. */
        .rt-quicklog-popover { top: auto; bottom: 90px; }
        /* QuickLog ON MOBILE = the capture SHEET (Phase 2): full-width
           bottom sheet over a blurred backdrop, safe-area aware. Desktop
           keeps the bottom-right popover (rule above). */
        @media (max-width: 768px) {
          .rt-quicklog-popover {
            top: auto !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: auto !important;
            max-width: none !important;
            border-radius: 18px 18px 0 0 !important;
            padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px)) !important;
            max-height: 76vh;
            overflow-y: auto;
          }
          .rt-quicklog-backdrop {
            background: rgba(20,30,22,0.38) !important;
            backdrop-filter: blur(2px);
            -webkit-backdrop-filter: blur(2px);
          }
        }
        .rt-quicklog-toast { top: auto; bottom: 90px; }
        /* Mobile pinned FAB lives in the docked nav; hide it on desktop. */
        .rt-mob-fab { display: flex; }
        @media (min-width: 768px) { .rt-mob-fab { display: none !important; } }
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
        .r-main { padding: 16px 16px 96px; scrollbar-gutter: stable; }
        /* Mobile: the dock FLOATS (bottom 10px + safe-area + ~58px pill).
           On phones with a home indicator that stack reaches ~100px, so a
           fixed 96px clearance left the last row hidden until the URL bar
           collapsed. Generous, safe-area-aware clearance. */
        @media (max-width: 768px) {
          .r-main { padding-bottom: calc(132px + env(safe-area-inset-bottom, 0px)) !important; }
        }
        /* Today page: hide the scrollbar (and its gutter) for a clean edge. */
        .r-main:has(.rt-today-v4) { scrollbar-gutter: auto; }
        .r-main:has(.rt-today-v4)::-webkit-scrollbar { display: none; }
        .r-main:has(.rt-today-v4) { scrollbar-width: none; -ms-overflow-style: none; }
        .r-main:has(.r-rai-page) { background: none; padding: 0 !important; }
        /* Rai page must fill the mobile viewport (minus the ~60px bottom nav) so
           the flex column lets the scroll area grow and the input bar pins to the
           true bottom. Without an explicit height, height:100% resolves against a
           content-sized parent and the input floats mid-screen. dvh handles the
           mobile URL bar. Scoped to mobile so desktop's sidebar layout is untouched. */
        @media (max-width: 767px) {
          /* iOS chat shell (Jul 2026 — third iteration, read before touching).
             v1 used 100dvh: it resized mid-scroll as Safari's chrome collapsed
             and let the whole chat be dragged ("nav pulls the chat down").
             v2 used 100svh: stable, but svh assumes chrome at its LARGEST —
             with the URL bar collapsed the real screen is taller, the page
             ended early, and the composer floated mid-screen over dead space.
             v3 (now): position:fixed + inset:0. A fixed box tracks the layout
             viewport through chrome collapse/expand automatically (bottom edge
             is always the true bottom), and because the page no longer
             participates in body scroll, mid-scroll resize can't drag it —
             both prior bugs are structurally impossible. Only r-rai-scroll
             scrolls, as before. */
          .r-main:has(.r-rai-page) {
            position: fixed !important;
            inset: 0 !important;
            height: auto !important;
            overflow: hidden !important;
            min-height: 0 !important;
          }
          .r-rai-page { height: 100% !important; }
          /* Break-out task on mobile: the desktop -24px shift pops into the
             64px page padding, which mobile doesn't have — at -24px the row +
             its purple rai ring clipped off the left edge. Scale the shift to
             what the mobile canvas can absorb (canvas already bleeds -8px past
             the list, r-main has 16px padding) so it still BREAKS the rhythm
             and reads as the hero — just a mobile-native amount. Lift + larger
             type carry the rest of the emphasis, same as desktop. */
          .rt-today-breakout { transform: translateX(-10px) !important; }
          @keyframes rt-breakout-in-mobile {
            from { transform: translateX(-10px) translateY(-3px); opacity: 0.85; }
            to   { transform: translateX(-10px) translateY(0); opacity: 1; }
          }
          .rt-today-breakout-animate { animation: rt-breakout-in-mobile 200ms cubic-bezier(.22,.61,.36,1) both !important; }
          /* Band More/Less expand is the wrong UX on mobile — hide it. */
          .rt-band-more { display: none !important; }
          /* Hide the per-row calendar/due pill on mobile — swipe-right pushes a
             task forward (today→tomorrow→later), so the button is redundant and
             wastes row space. (Desktop keeps it.) */
          .rt-row-due { display: none !important; }
        }
        .r-today-panel { display: none !important; }
        .r-client-modal { top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; transform: none !important; max-width: 100% !important; max-height: 100% !important; border-radius: 0 !important; }
        /* Mobile: chat user-message clearance from sticky top bar when scrolled */
        .r-rai-inner { padding-top: 32px !important; }
        .r-chat-msg-user { scroll-margin-top: 56px !important; }
        /* Mobile: tighten chat input bar bottom padding — clear mobile nav (60px) + breathing room */
        .r-rai-inputbar { flex-shrink: 0; padding: 10px 16px calc(86px + env(safe-area-inset-bottom, 0px)) !important; }
        /* Rai page surface — flat bg. The purple radial-gradient wash was
           removed: send button + chrome are green now, the purple page
           glow was the last thing making Rai read as purple. Flat bg also
           means the input bar's matching bg no longer shows a seam line. */
        .r-rai-intro {
          background: ${C.bg};
        }
        .r-rai-chat {
          background: ${C.bg};
        }
        /* Make the inputbar inherit the gradient background so it doesn't show a seam */
        .r-rai-intro .r-rai-inputbar,
        .r-rai-chat .r-rai-inputbar { background: transparent !important; }
        /* De-facto (intro) Rai surface: the hero input box ("Ask about a
           client…") is a .rt-composer inside .r-rai-intro. Give it the purple
           hairline + shadow at rest (same --rt-sh-purple as the Rai suggestion
           cards) so it reads as Rai's surface. Targets BOTH the hero composer
           and the reply inputbox for that state. */
        .r-rai-intro .rt-composer,
        .r-rai-intro .rt-rai-inputbox { box-shadow: 0 1px 3px rgba(20,30,22,0.04), 0 8px 24px rgba(20,30,22,0.06) !important; }
        /* Mobile: don't vertically center the intro — start content near the top */
        @media (max-width: 767px) {
          .r-rai-intro .r-rai-inner { justify-content: flex-start !important; padding-top: 48px !important; }
        }
        @media (min-width: 768px) {
          :root { --sidebar-w: 240px; --page-gap: 14px; --sidebar-left: 14px; }
          /* html/body bg owned by base rule (with paper-grain texture);
             previous !important override here was wiping the texture
             on desktop. App.app-root inherits transparently. */
          .app-root { background: transparent !important; }
          .r-desk { display: flex !important; }
          .r-mob-bot { display: none !important; }
          .r-mob-bot-dock { display: none !important; }
          .r-today-panel { display: block !important; }
          /* Desktop: right-side slideover panel. Sits flush with sidebar
             top/bottom (14px gap), takes 560px width on the right. List
             stays visible behind the 32% backdrop so clicking another row
             swaps content in place. */
          .r-client-modal {
            top: 14px !important;
            right: 14px !important;
            left: auto !important;
            bottom: 14px !important;
            transform: none !important;
            width: 560px !important;
            max-width: 560px !important;
            max-height: none !important;
            border-radius: 14px !important;
            box-shadow: -8px 0 24px rgba(20,30,22,0.06), -2px 0 8px rgba(20,30,22,0.04), 0 4px 12px rgba(20,30,22,0.04) !important;
            animation: rt-slideover-in 320ms var(--rt-ease-out) backwards;
          }
          .r-main {
            padding: 28px 64px;
            position: fixed;
            top: var(--page-gap);
            right: var(--page-gap);
            bottom: var(--page-gap);
            left: calc(var(--sidebar-left) + var(--content-sidebar-w, var(--sidebar-w)) + var(--sidebar-content-gap, 16px));
            background: ${C.bg};
            overflow-y: auto;
            overflow-x: hidden;
          }
          /* Force-apply the gap regardless of var resolution. Pinned (≥1700)
             gets a clearly larger gap than rail. */
          html[data-sidebar-pin="rail"] .r-main { left: calc(14px + 64px + 24px) !important; }
          html[data-sidebar-pin="pinned"] .r-main { left: calc(14px + 240px + 36px) !important; }
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
        @keyframes rtCaretBlink { 0%,45%{opacity:1} 55%,100%{opacity:0} }
        .rt-stream-caret { animation: rtCaretBlink 1s steps(1) infinite; }
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
          /* Two-line clamp (Jun 2026). Tasks are capped at 75 chars at save
             time; at 14px Manrope that's up to ~two lines on mobile. Clamp to
             2 lines so the full title is visible without exploding row height;
             a chevron (rendered in JSX when the title still overflows 2 lines)
             lifts the clamp to show the rest. The per-row inline style sets
             WebkitLineClamp to "unset" when expanded. */
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 1;
          max-width: 100%;
          overflow: hidden;
          font-size: 14px;
          font-weight: 500;
          line-height: 1.4;
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
            max-height 220ms cubic-bezier(.22,.61,.36,1),
            opacity 160ms cubic-bezier(.22,.61,.36,1),
            margin 220ms cubic-bezier(.22,.61,.36,1);
        }
        .rt-row-wrap.is-exiting {
          max-height: 0 !important;
          opacity: 0;
          margin-bottom: -10px;
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
        /* Dotted underline on task titles whose text contains a thinking
           verb. Indicates "click me to discuss with Rai" — a Rai
           interaction, so it wears RAI PURPLE (June 2026 rule: purple is
           reserved for Rai-authored intelligence and Rai interactions;
           plain navigation links stay green). Title text stays black;
           underline goes dotted→solid on hover. Done tasks lose the
           affordance entirely. text-underline-offset stays small (parent
           has overflow:hidden — large offsets clip the dots). */
        .rt-task-title.is-discussable {
          text-decoration: underline;
          text-decoration-style: dotted;
          text-decoration-color: #7c5cf3;
          text-decoration-thickness: 2px;
          text-underline-offset: 2px;
          cursor: pointer;
          transition: text-decoration-color 160ms ease, text-decoration-style 160ms ease;
        }
        .rt-task-title.is-discussable:hover {
          text-decoration-style: solid;
          text-decoration-color: #6a4ce8;
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
        .rc-queue-item:hover:not([data-active="true"]) { background: #EAEDE9 !important; }
        /* Rai sidebar — reveal star/delete on row hover */
        .r-convo-row:hover:not([style*="rgba(124,92,243"]) { background: var(--rt-deep-cream) !important; color: var(--rt-text) !important; }
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

        /* Dim the sidebar as a single unit — fading the shell fades its
           content AND its deep-cream hairline box-shadow uniformly (no
           compounding). Plus the collapse toggle on the sidebar edge. */
        body:has(.rt-focus-on) .r-desk,
        body:has(.rt-focus-on) .rt-sidebar-toggle,
        body:has(.rt-focus-on) .r-mob-bot-dock > * {
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
          position: relative;
          z-index: 6;
          transform: scale(1.015);
          box-shadow:
            0 0 0 1px rgba(124,92,243,0.35),
            0 4px 14px rgba(124,92,243,0.16),
            0 8px 22px rgba(20,30,22,0.07) !important;
          transition: transform 320ms ease 100ms, box-shadow 320ms ease 100ms;
        }
        /* When focus row is wrapped in a swipe container, scale + shadow apply to wrapper */
        .rt-focus-on .rt-focus-top-wrap {
          position: relative;
          z-index: 6;
          transform: scale(1.015);
          box-shadow:
            0 0 0 1px rgba(124,92,243,0.35),
            0 4px 14px rgba(124,92,243,0.16),
            0 8px 22px rgba(20,30,22,0.07);
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
        /* Dim the bucket empty states ("No tasks tomorrow." / "No tasks
           scheduled.") in focus mode. They live inside the tasks column
           but aren't rows, so without this they stay bright. */
        .rt-focus-on .rt-bucket-empty {
          opacity: 0.06 !important;
          pointer-events: none !important;
          transition: opacity 280ms ease;
        }
        /* Dim the Tomorrow / Later bucket calendar widgets in focus mode.
           Wraps the Calendar toggle pill + its expanded event grid as a
           single unit, so the whole calendar surface fades together
           instead of leaving the toggle icon visible while the events
           hide. */
        .rt-focus-on .rt-bucket-cal {
          opacity: 0.06 !important;
          pointer-events: none !important;
          transition: opacity 280ms ease;
        }

        /* (rt-flash lightning animation removed — retired in favor of the
           calmer UI language. Focus mode now toggles silently.) */

        /* Today v4 — Grid layout, 3 breakpoints */
        /* Default: narrow desktop (901-1439px) — 2 cols, status + composer span full width, tasks + focus below */
        .rt-today-v4 {
          grid-template-columns: minmax(0, 1fr);
          grid-template-areas:
            "band"
            "composer"
            "tasks";
        }
        /* Desktop: hold the left content (tasks, composer, band) to the left
           portion so the dial's body shows to their right. Tasks get more room
           than before (52% was too cramped); composer + band stop before the
           dial rather than running full width under it. */
        /* The dial is a FIXED-width layer (~560px) anchored to the right edge,
           shown >1099px. The left content must reserve room for it as the
           screen shrinks, or tasks collide with the dial. Cap by both an
           absolute ceiling AND calc(100% - reserve) so the gap to the dial is
           preserved at every width. Tasks reserve the most (they must never
           overlap); composer/band reserve less since they intentionally fade
           UNDER the dial's faded edge. */
        /* Tasks bundle (band + composer + tasks-col) capped proportional to the
           dial: right edge sits 180px clear of the dial's visible left edge.
           Formula = viewport − sidebar-left(14) − sidebar width − sidebar-content-gap
                   − dial scaled width (720*scale) − gap(120).
           Falls back to scale 1 + content-sidebar-w 240 + gap 16 if vars don't resolve. */
        .rt-tasks-col,
        .rt-today-v4 > .rt-band,
        .rt-today-v4 > .rt-composer {
          max-width: calc(100vw - 14px - var(--content-sidebar-w, 240px) - var(--sidebar-content-gap, 16px) - (720px * var(--dial-scale, 1)) - 120px);
        }
        .rt-dial-help:hover .rt-dial-help-tip,
        .rt-dial-help:focus .rt-dial-help-tip { opacity: 1 !important; transform: translateY(0) !important; }
        /* Hub delete link — hidden by default, fades in on hub hover or when
           the delete button itself is focused (keyboard a11y). Destructive
           action on the most prominent dial element shouldn't sit permanently
           visible; revealing on intent (hover/focus) is the right register. */
        .rt-dial-hub-delete { opacity: 0; transition: opacity 140ms var(--rt-ease-out); }
        .rt-dial-hub:hover .rt-dial-hub-delete,
        .rt-dial-hub-delete:focus-within { opacity: 1; }
        /* Dial event row — full strip is the click target. Subtle gray wash
           on hover. The "next" event already has a sage bg painted via inline
           styles so it stays visually distinct. */
        /* Rail event row — full strip is the click target. Subtle grey
           wash on hover, matching the scrubbed-state indicator's hover
           treatment for consistency. Padding + border-radius give the
           hover a defined shape rather than bleeding to the rail edges. */
        .rt-dial-event-row { transition: background 120ms var(--rt-ease-out); }
        /* No hover background — the wide container extends well past the
           visible text content (230px wide vs ~140px of actual text), so
           painting bg on the container shows a misaligned rectangle to
           the left of the event. The cursor change + slight title color
           shift on hover (set inline below) carry the click affordance. */
        /* Counter-scale utility — SOFTENED (June 2026). The old rule pinned
           events/controls at CONSTANT on-screen size (scale 1/s) while the
           dial shrank around them; at laptop sizes events rendered ~156% of
           proportional and the geometry broke. Now: a per-breakpoint
           --dial-cs lets them shrink WITH the dial, just ~10% less, so the
           composition stays proportional and the text stays readable.
           Effective event size = --dial-scale × --dial-cs. Per-element
           transform-origin stays inline so anchors hold. */
        .rt-dial-cs { transform: scale(var(--dial-cs, 1)); }
        /* Controls sit in the gap, just left of the scaled dial's visible edge. */
        /* (Today/Tomorrow + Now controls now render inside the dial component
           at the disc's bottom-center, so they scale with the dial.) */
        /* Dial scales down on smaller screens (it's a fixed 720×888 composition;
           scaling the whole layer keeps every internal piece aligned). */
        /* Dial scale = ORIGINAL values. The content column's max-width is
           derived from (720px × --dial-scale), so raising the dial floor
           directly steals width from the task column — tried June 2026,
           rejected. The event-proportion fix lives entirely in --dial-cs:
           events compensate only ~35% toward constant size (was 100%),
           so they shrink with the dial instead of towering over it. */
        .rt-today-v4 { --dial-scale: 0.90; --dial-cs: 1.04; }
        @media (max-width: 1600px) { .rt-today-v4 { --dial-scale: 0.82; --dial-cs: 1.08; } }
        @media (max-width: 1440px) { .rt-today-v4 { --dial-scale: 0.74; --dial-cs: 1.12; } }
        @media (max-width: 1300px) { .rt-today-v4 { --dial-scale: 0.64; --dial-cs: 1.20; } }
        @media (max-width: 1200px) { .rt-today-v4 { --dial-scale: 0.56; --dial-cs: 1.28; } }
        @media (max-height: 860px) { .rt-today-v4 { --dial-scale: 0.72; --dial-cs: 1.14; } }
        @media (max-height: 760px) { .rt-today-v4 { --dial-scale: 0.62; --dial-cs: 1.22; } }
        @media (max-height: 680px) { .rt-today-v4 { --dial-scale: 0.52; --dial-cs: 1.32; } }
        /* Connect Google Calendar nudge — dotted underline on rest,
           solid on hover. Primary green to match the rest of the link
           treatment sitewide. */
        .rt-gcal-connect-link:hover {
          text-decoration-style: solid !important;
          text-decoration-color: #33543E !important;
        }
        @media (max-width: 1099px) {
          .rt-dial-layer { display: none !important; }
          .rt-dial-controls { display: none !important; }
          .rt-tasks-col { max-width: none !important; }
          .rt-today-v4 > .rt-band,
          .rt-today-v4 > .rt-composer { max-width: none !important; }
        }
        .rt-mob-strip { display: none; }
        @media (max-width: 1099px) {
          .rt-today-v4 {
            grid-template-columns: 1fr;
            grid-template-areas:
              "band"
              "composer"
              "tasks";
          }
          .rt-focus-col { display: none !important; }
          .rt-rai-col { display: none !important; }
        }
        @media (max-width: 900px) {
          /* Mobile band — condensed Option 1 layout. */
          .rt-band {
            display: flex !important;
            flex-direction: column !important;
            position: relative !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
          }
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
             below. Button anchors right (closer to the thumb) — left of
             the row stays empty, button stays compact. */
          .rt-composer-controls {
            flex: 0 0 100% !important;
            width: 100%;
          }
          .rt-add-task-btn {
            margin-left: auto !important;
            margin-right: 0 !important;
          }
          .rt-composer-pill { padding: 6px 8px !important; gap: 4px !important; }
          .rt-composer-pill span { font-size: 11.5px !important; }
          .rt-row-meta span:nth-child(n+4) { display: none !important; }
          /* DUE PICKER ON MOBILE — fixed, full content width (16px
             gutters = composer width/position). Vertical position is set
             inline from the Due chip's measured rect so it sits right
             under the composer, attached. Inline top + bottom:auto
             override the fallback bottom below (used only if JS hasn't
             measured yet). Cannot clip horizontally — gutters are fixed. */
          .rt-due-picker {
            position: fixed !important;
            left: 16px !important;
            right: 16px !important;
            bottom: 84px;
            margin: 0 !important;
            width: auto !important;
            min-width: 0 !important;
            max-width: none !important;
            max-height: 60vh !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            box-shadow:
              0 1px 3px rgba(20, 30, 22, 0.10),
              0 12px 32px rgba(20, 30, 22, 0.18) !important;
          }
          /* Compact calendar cells on mobile so the grid stays tight and
             the picker reads as a small popover, not a page. */
          .rt-due-picker [role="grid"] button,
          .rt-due-picker > div > div > div > button {
            height: 30px !important;
            font-size: 12px !important;
          }
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
          /* Path C — outlined, flat. The chips don't elevate (no shadow,
             no card-bg), they're defined by their edge. Lives confidently
             on the flat page without needing a container to be lifted
             from. Fully rounded (pill shape, borderRadius 999) reinforces
             that they're discrete affordances, not embedded form fields.
             The !important overrides the inline borderRadius:8 / border:
             none that the four chip buttons set individually — cheaper
             than patching all four call sites. */
          background: transparent !important;
          box-shadow: none !important;
          border: 1px solid rgba(20,30,22,0.12) !important;
          border-radius: 999px !important;
          transition: background 160ms var(--rt-ease-out),
                      border-color 160ms var(--rt-ease-out),
                      color 160ms var(--rt-ease-out);
        }
        .rt-composer-pill:hover {
          background: rgba(20,30,22,0.03) !important;
          border-color: rgba(20,30,22,0.20) !important;
          box-shadow: none !important;
          transform: none !important;
          color: var(--rt-text);
        }
        .rt-composer-pill:active {
          transform: scale(0.98);
          transition: transform 80ms var(--rt-ease-press);
        }
        .rt-composer-pill.is-filled {
          /* Filled state — slightly stronger border to indicate selection
             without going back to a filled bg (which would clash with the
             flat treatment). The avatar / value text carries the personality. */
          border-color: rgba(20,30,22,0.25) !important;
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
          box-shadow: 0 1px 2px rgba(20,30,22,0.05), 0 2px 6px rgba(20,30,22,0.06) !important;
        }
        .rt-rec-chip:active {
          transform: translateY(0) scale(0.97);
          transition: transform 80ms var(--rt-ease-press);
        }
        /* Wide desktop (>=1500px): 3 cols — notes (daybook) joins only
           when there's genuine room. Below this, tasks + calendar share
           the width and notes stays hidden so it never crowds out what
           matters. Raised to 1700 (at 1500 the timeline + notes together
           pinched the task column; notes is lowest-priority so it waits for
           genuinely comfortable width). */
        @media (min-width: 1700px) {
          .rt-today-v4 {
            grid-template-columns: minmax(0, 1fr);
            grid-template-rows: auto auto 1fr;
            grid-template-areas:
              "band"
              "composer"
              "tasks";
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
          /* The right-column Rai brief now shows the full reason_detail, so the
             band's inline More/Less expand is redundant at this width — hide it. */
          .rt-band-more { display: none !important; }
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
          .rc-sort-renewal { display: none !important; }
          .rt-mob-cal-trigger { display: none !important; }
          .rt-mob-cal-sheet { display: none !important; }
          .rt-mob-cal-sheet-band { display: block !important; grid-area: calstrip !important; }
          /* The sky strip renders date+greeting itself on mobile, so hide the
             band's duplicate copy. */
          .rt-band-greet { display: none !important; }
          /* Tighten the row gap so "Today's client" sits 12px under the sky
             header instead of the 20px desktop grid gap (the greeting used to
             fill this space; now it's in the strip, so the gap read as too low). */
          .rt-today-v4 { row-gap: 8px !important; }
          .rt-today-v4 {
            grid-template-areas: "calstrip" "band" "tasks" !important;
          }
          /* Composer hidden on mobile FOR THE TODAY PAGE ONLY — the center "+"
             FAB in the bottom nav covers quick-capture there, so Today's inline
             composer is redundant. Scoped to .rt-today-v4 because .rt-composer
             is ALSO the Rai chat input class; an unscoped hide here removed the
             only way to type to Rai on mobile (left users stuck with canned
             starter chips). Hidden only (no deletion); removed from the grid
             template above so its row collapses rather than leaving a gap. */
          .rt-today-v4 > .rt-composer { display: none !important; }
          .rt-composer-hint { display: none !important; }
          /* Composer selected-client chip: avatar only on mobile, name hidden */
          .rt-composer-client-name { display: none !important; }
        }
        /* Container query on the composer itself: when the composer is narrow
           (proportional to dial scale + sidebar state), hide the long hint so
           Client / Worker / Date / Add stay in one row without overflow. The
           Add button has margin-left: auto inline, so when the row wraps it
           naturally drops to its own line and stays anchored to the right. */
        @container (max-width: 620px) {
          .rt-composer-hint { display: none !important; }
        }
        @media (max-width: 640px) {
          /* Task right-side indicators on mobile — ALL pills render as one
             standardized circle: same width/height, icon centered, no text,
             no chevron. Applies to recurring (∞), Today, Tomorrow/Later, and
             overdue alike so the right edge is visually uniform. */
          .rt-row-text { display: none !important; }
          .rt-due-chevron { display: none !important; }
          .rt-row-recur,
          .rt-row-due.rt-due-today,
          .rt-row-due.rt-due-overdue,
          .rt-row-due.rt-due-future {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: 26px !important;
            height: 26px !important;
            padding: 0 !important;
            gap: 0 !important;
            border-radius: 999px !important;
            box-sizing: border-box !important;
          }
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
          /* Rai brief / right rail removed — main content stretches to fill.
             Both grid variants are now 2-col (240px nav + flexible main); the
             .rc-rai-col panels are hidden everywhere. */
          .rc-grid { grid-template-columns: 240px minmax(0, 1fr); }
          .rc-grid.rc-grid-2col { grid-template-columns: 240px minmax(0, 1fr); }
          .rc-rai-col { display: none !important; }
        }
        @keyframes rt-slideover-in {
          from { transform: translateX(40px); opacity: 0.5; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes rt-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes rt-drawer-in {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
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
      `;
