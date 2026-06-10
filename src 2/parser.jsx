import { expandWeekday, nextWeekdayDate, weekdayIndex } from "./recurrence";
import { addDays, escapeRegexChars, todayAnchored } from "./utils";


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

// Levenshtein edit distance (classic DP). Used by parseComposer's fuzzy tier
// to catch misspelled client names / contact first names that the prefix-typo
// tier misses (mid-word substitutions, transpositions, deletions).
function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// Is `input` a close misspelling of `target`? Edit budget scales with target
// length so short names aren't matched too loosely: ≤4 chars → 1 edit, 5-7
// chars → 1 edit, 8+ chars → 2 edits. Requires the same first letter to avoid
// matching unrelated short words. Both args should be lowercased.
function isFuzzyMatch(input, target) {
  if (!input || !target) return false;
  if (input.length < 4 || target.length < 4) return false;
  if (input[0] !== target[0]) return false;          // anchor on first letter
  if (Math.abs(input.length - target.length) > 2) return false;
  const budget = target.length >= 8 ? 2 : 1;
  return levenshtein(input, target) <= budget;
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

    // Contact first-name uniqueness map. A bare first name ("Henry")
    // should only match a client if exactly ONE client has a contact
    // with that first name — otherwise it's ambiguous and we don't
    // guess. Built once here, consulted in the contact-match tier below.
    const firstNameCounts = {};
    for (const c of validClients) {
      const first = (c.contact || "").trim().split(/\s+/)[0].toLowerCase();
      if (first && first.length >= 2) {
        firstNameCounts[first] = (firstNameCounts[first] || 0) + 1;
      }
    }

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
        allCandidates.push({ client: c, score: 100, matchType: "company", start: fullM.index, end: fullM.index + fullM[0].length });
        continue; // best possible — skip lower-priority candidates for this client
      }

      // 95 — full contact name match ("Henry Stone"). The person's full
      // name is nearly as specific as the company name. Only fires when
      // the client has a multi-word contact (a bare first name is handled
      // by the score-70 tier below with a uniqueness guard).
      const contactName = (c.contact || "").trim();
      if (contactName && contactName.includes(" ")) {
        const contactRe = new RegExp(
          `(?<=^|[^\\p{L}\\p{N}])${escapeRegexChars(contactName.toLowerCase())}(?:'s)?(?=[^\\p{L}\\p{N}]|$)`,
          "iu"
        );
        const cm = lower.match(contactRe);
        if (cm && cm.index !== undefined) {
          allCandidates.push({ client: c, score: 95, matchType: "contact", start: cm.index, end: cm.index + cm[0].length });
          continue;
        }
      }

      // 70 — contact FIRST name alone ("Henry"). Convenient but riskier:
      // only fires if exactly one client has a contact with this first
      // name (uniqueness guard built above). If two clients have a
      // "Henry", a bare "Henry" matches neither — we don't guess.
      const firstName = contactName.split(/\s+/)[0].toLowerCase();
      if (firstName && firstName.length >= 2 && firstNameCounts[firstName] === 1) {
        const firstRe = new RegExp(
          `(?<=^|[^\\p{L}\\p{N}])${escapeRegexChars(firstName)}(?:'s)?(?=[^\\p{L}\\p{N}]|$)`,
          "iu"
        );
        const fm = lower.match(firstRe);
        if (fm && fm.index !== undefined) {
          allCandidates.push({ client: c, score: 70, matchType: "contact", start: fm.index, end: fm.index + fm[0].length });
          continue;
        }
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

      // 65 — fuzzy (edit-distance) match. Lowest-priority tier: catches
      // misspellings the prefix-typo tier misses (mid-word substitutions,
      // transpositions, deletions) like "Sentigrms" → "Sentigrams" or
      // "Justna" → contact "Justina". Checks each ≥4-char user token against
      // (a) each meaningful client name token and (b) the contact's first
      // name (only when that first name is unique across the roster, same
      // guard as the exact score-70 contact tier). isFuzzyMatch anchors on
      // the first letter and uses a length-scaled edit budget, so collisions
      // are rare. Sits below prefix/abbrev/token so exact intent always wins.
      let fuzzyHit = null;
      for (const ut of userTokens) {
        if (ut.tok.length < 4) continue;
        if (COMPOSER_STOP_WORDS.has(ut.tok)) continue;
        if (COMPOSER_COMMON_WORDS.has(ut.tok)) continue;
        // (a) client name tokens
        for (const ctok of tokens) {
          const cclean = ctok.replace(/[^\w]/g, "").toLowerCase();
          if (cclean.length < 4) continue;
          if (COMPOSER_STOP_WORDS.has(cclean) || COMPOSER_COMMON_WORDS.has(cclean)) continue;
          if (isFuzzyMatch(ut.tok, cclean)) {
            fuzzyHit = { client: c, score: 65, matchType: "company", start: ut.start, end: ut.end };
            break;
          }
        }
        if (fuzzyHit) break;
        // (b) contact first name (uniqueness-guarded, same as score-70 tier)
        const fnameFuzzy = (c.contact || "").trim().split(/\s+/)[0].toLowerCase();
        if (fnameFuzzy && fnameFuzzy.length >= 4 && firstNameCounts[fnameFuzzy] === 1) {
          if (isFuzzyMatch(ut.tok, fnameFuzzy)) {
            fuzzyHit = { client: c, score: 65, matchType: "contact", start: ut.start, end: ut.end };
            break;
          }
        }
      }
      if (fuzzyHit) {
        allCandidates.push(fuzzyHit);
        continue;
      }
    }

    // Pick highest-scoring candidate; tie-break by earliest start
    if (allCandidates.length > 0) {
      allCandidates.sort((a, b) => b.score - a.score || a.start - b.start);
      const winner = allCandidates[0];
      matchedClient = winner.client;
      clientMatchSpan = { start: winner.start, end: winner.end, kind: "client", matchType: winner.matchType || "company" };
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
    // Contact-name matches stay in the title — "Call David" should read
    // "Call David." (the person's name is part of the action). Company-name
    // matches are stripped because the client chip carries them ("Call
    // Bushel" → "Call." + Bushel chip). Date/worker spans strip as before.
    if (m.kind === "client" && m.matchType === "contact") {
      // Keep it, but restore the contact's stored casing over whatever the
      // user typed ("call david" → "Call David"). Use the matched portion's
      // length from the contact name so partial (first-name) matches get
      // their proper case too.
      const properName = (matchedClient && matchedClient.contact) ? matchedClient.contact.trim() : null;
      if (properName) {
        const matchedLen = m.end - m.start;
        // First-name match → take the leading word of the contact name;
        // full match → use the whole contact name.
        const replacement = matchedLen < properName.length
          ? properName.split(/\s+/)[0]
          : properName;
        title = title.slice(0, m.start) + replacement + title.slice(m.end);
      }
      continue;
    }
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
function parseCalendarEntry(rawText, anchorDate = new Date(), clients = null) {
  if (!rawText || !rawText.trim()) return null;
  let text = rawText.trim();

  // ─── Date-word detection ─────────────────────────────────────
  // Calendar events can name a day: "tomorrow", a weekday ("Friday",
  // "next Monday"), "next week", or "in N days". Detect it, shift the
  // anchor to that day, and strip the word so it doesn't pollute the time
  // parse or title. Time-of-day parsing below then sets the hour.
  {
    const base = new Date(anchorDate); base.setHours(0, 0, 0, 0);
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    let matched = null;
    let m;
    if ((m = text.match(/\btomorrow\b/i))) {
      const d = new Date(base); d.setDate(d.getDate() + 1);
      matched = { date: d, re: /\btomorrow\b/i };
    } else if ((m = text.match(/\bin (\d+) days?\b/i))) {
      const d = new Date(base); d.setDate(d.getDate() + parseInt(m[1], 10));
      matched = { date: d, re: /\bin \d+ days?\b/i };
    } else if ((m = text.match(/\bnext week\b/i))) {
      const d = new Date(base); d.setDate(d.getDate() + 7);
      matched = { date: d, re: /\bnext week\b/i };
    } else if ((m = text.match(/\b(?:(next)\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i))) {
      const target = dayNames.indexOf(m[2].toLowerCase());
      const d = new Date(base);
      let delta = (target - d.getDay() + 7) % 7;
      if (delta === 0) delta = 7; // bare weekday → upcoming occurrence, never "today"
      d.setDate(d.getDate() + delta);
      matched = { date: d, re: new RegExp("\\b(?:next\\s+)?" + m[2] + "\\b", "i") };
    } else if ((m = text.match(/\btoday\b/i))) {
      matched = { date: new Date(base), re: /\btoday\b/i };
    }
    if (matched) {
      anchorDate = matched.date;
      text = text.replace(matched.re, " ").replace(/\s{2,}/g, " ").trim();
    }
  }

  // Helper: build a Date for the anchor day at HH:MM given an hour+minute
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

      // Pass 3: bare COLON-form time only (e.g. "15:30", "9:00"). Bare integers
      // like "1620", "300", "12" are NOT treated as times — they're almost
      // always IDs, quantities, or prices, and grabbing them silently misrouted
      // tasks into calendar events. A colon is an unambiguous time signal;
      // without "at/@" (Pass 1) or a meridiem (Pass 2), require it.
      if (!pick) {
        const bareRe = /\b(\d{1,2}:\d{2})\b/;
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
    // A date phrase (weekday / "tomorrow" / etc.) was stripped elsewhere,
    // but the connector word that introduced it ("on", "by", "this",
    // "next") is often left dangling at the end — e.g. "Call w/Fool on
    // Tuesday" → strip "Tuesday" → "Call w/Fool on". Remove a trailing
    // connector so the title reads clean.
    .replace(/\s+(on|by|this|next|the|for)\s*$/i, "")
    .replace(/^\s*[-–—,:]\s*/, "")
    .replace(/\s*[-–—,:]\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!title) title = "Untitled";
  // Capitalize first letter
  title = title.charAt(0).toUpperCase() + title.slice(1);

  // ─── Client detection ───────────────────────────────────────
  // Reuse the task composer's client matcher (single source of
  // truth for "find a client name in free text"). We only want
  // its matchedClient result — the time/title parsing above is
  // the calendar parser's own job. Runs against the ORIGINAL raw
  // text so the matcher sees the client name before we stripped
  // time tokens. Linking the event to a client makes scheduled
  // time a signal Rai can read.
  let client_id = null;
  let client_name = null;
  if (clients && clients.length > 0) {
    try {
      const composed = parseComposer(rawText, clients, []);
      if (composed && composed.matchedClient) {
        client_id = composed.matchedClient.id;
        client_name = composed.matchedClient.name;
      }
    } catch { /* matcher failure is non-fatal — event still saves without a client */ }
  }

  return {
    starts_at: starts.toISOString(),
    ends_at: ends ? ends.toISOString() : null,
    title,
    client_id,
    client_name,
  };
}

export { COMPOSER_TYPO_DICT, COMPOSER_CASING_DICT, TRAILING_PHRASE_REGEX, TRAILING_PREP_REGEX, COMPOSER_STOP_WORDS, COMPOSER_COMMON_WORDS, computeAbbreviations, normalizeComposerText, levenshtein, isFuzzyMatch, parseComposer, parseCalendarEntry };
