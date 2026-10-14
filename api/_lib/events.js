// ════════════════════════════════════════
// USAGE COUNTER — event names and Redis keys shared by api/track.js and api/stats.js.
// EVENTS must match TELEMETRY_EVENTS in js/core/config.js (tests/telemetry-test.js checks both sides).
// Files under api/_lib are helpers, not routes (Vercel skips paths starting with _).
// ════════════════════════════════════════
const EVENTS = ['open', 'standalone', 'dau', 'install'];
const KEY_PREFIX = 'lifeuk:';
const ISO_DATE_LENGTH = 10;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// one counter per event per UTC day: lifeuk:open:2026-10-14
const counterKey = (event, isoDate) => `${KEY_PREFIX}${event}:${isoDate}`;
const utcIsoDate = ms => new Date(ms).toISOString().slice(0, ISO_DATE_LENGTH);
// today first, then each earlier day: count dates in all
const recentUtcDates = (count, nowMs = Date.now()) =>
  Array.from({ length: count }, (_, i) => utcIsoDate(nowMs - i * MS_PER_DAY));

module.exports = { EVENTS, counterKey, utcIsoDate, recentUtcDates };
