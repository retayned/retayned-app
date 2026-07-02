
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
  "favorite":                   "/observations/21_the_favorite.svg",
  "rescue":                     "/observations/22_the_rescue.svg",
  "autopilot":                  "/observations/23_the_autopilot.svg",
  "self cluster":               "/observations/24_self_cluster.svg",
  "reverse pareto":             "/observations/25_reverse_pareto.svg",
  "client task disproportion":  "/observations/26_client_task_disproportion.svg",
  "concentration cliff":        "/observations/27_concentration_cliff.svg",
  "hours sink":                 "/observations/28_hours_sink.svg",
  "rate compression":           "/observations/29_rate_compression.svg",
  "pipeline drought":           "/observations/30_pipeline_drought.svg",
  "composition":                "/observations/31_the_composition.svg",
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
  // Leading "The" is stripped (Jul 2026): the observer emits archetype
  // names with and without it ("Slow Decline" vs "The Slow Decline"),
  // and the map mixed both conventions — so any prefixed name missed
  // its asset and the card silently rendered without the illustration.
  // Map keys are now stored WITHOUT "the"; normalize inputs the same way.
  const key = String(cardName).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/^the\s+/, "");
  return OBSERVATION_ILLUSTRATIONS[key] || null;
}

export { OBSERVATION_ILLUSTRATIONS, lookupObservationIllustration };
