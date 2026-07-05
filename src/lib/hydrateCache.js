// ── hydrateCache (Jul 2026) ───────────────────────────────────────────
// Instant-paint boot cache. After every successful hydrate, the 22-query
// result batch is snapshotted to localStorage; on the next boot the app
// paints IMMEDIATELY from the snapshot (zero network), then the normal
// network hydrate runs and fresh data replaces it — the same wholesale
// state replacement the app already performs on every visibilitychange,
// so cached-then-fresh is not a new consistency model, just a faster
// first frame. Perceived mobile boot drops from "code + 3-4 sequential
// round trips" to "code only."
//
// Safety rails:
//  - VERSION bump invalidates every snapshot (schema/shape changes).
//  - Keyed per user id; another account on the same browser never
//    reads it.
//  - 72h age cap — older snapshots are ignored and purged.
//  - ~2.5MB size guard — oversized books simply skip caching.
//  - ?nocache in the URL skips reads and purges the current user's key.
//  - Corrupt JSON purges itself.

const VERSION = 1;
const MAX_AGE_MS = 72 * 3600000;
const MAX_BYTES = 2_500_000;

const keyFor = (uid) => `rt:hydrate:v${VERSION}:${uid}`;

const cacheDisabled = () => {
  try { return /[?&]nocache/.test(window.location.search); } catch (_) { return false; }
};

export function readHydrateSnapshot(uid) {
  try {
    if (!uid) return null;
    if (cacheDisabled()) { localStorage.removeItem(keyFor(uid)); return null; }
    const raw = localStorage.getItem(keyFor(uid));
    if (!raw) return null;
    const env = JSON.parse(raw);
    if (!env || env.v !== VERSION || env.uid !== uid || !Array.isArray(env.batch)) {
      localStorage.removeItem(keyFor(uid));
      return null;
    }
    if (Date.now() - (env.at || 0) > MAX_AGE_MS) {
      localStorage.removeItem(keyFor(uid));
      return null;
    }
    return env;
  } catch (_) {
    try { localStorage.removeItem(keyFor(uid)); } catch (_) { /* storage unavailable */ }
    return null;
  }
}

export function saveHydrateSnapshot(uid, bookId, tz, batch) {
  try {
    if (!uid || !Array.isArray(batch) || cacheDisabled()) return;
    // Store only the data payloads — errors and response metadata are
    // meaningless a day later.
    const slim = batch.map((r) => ({ data: r && r.data !== undefined ? r.data : null }));
    const payload = JSON.stringify({ v: VERSION, uid, bookId, tz: tz || null, at: Date.now(), batch: slim });
    if (payload.length > MAX_BYTES) return;
    localStorage.setItem(keyFor(uid), payload);
  } catch (_) { /* quota or private mode — caching is optional by design */ }
}

export function clearHydrateSnapshot(uid) {
  try { if (uid) localStorage.removeItem(keyFor(uid)); } catch (_) { /* storage unavailable */ }
}
