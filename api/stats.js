// ════════════════════════════════════════
// GET /api/stats?days=30 — the owner's read of the usage counters.
// Header: Authorization: Bearer <STATS_TOKEN> (Vercel env var, 32+ random characters; unset = always 401).
// Returns { days: [{ date, open, standalone, dau, install }] (newest first, UTC), totals: {...} }.
// ════════════════════════════════════════
const crypto = require('crypto');
const { EVENTS, counterKey, recentUtcDates } = require('./_lib/events');
const { redisPipeline } = require('./_lib/redis');

const DEFAULT_DAYS = 30;
const MIN_DAYS = 1;
const MAX_DAYS = 365;
const BEARER = 'Bearer ';

// constant-time compare; false while STATS_TOKEN is unset so an empty bearer never matches
function isAuthorized(header) {
  const expected = process.env.STATS_TOKEN;
  if (!expected || typeof header !== 'string' || !header.startsWith(BEARER)) return false;
  const given = Buffer.from(header.slice(BEARER.length));
  const want = Buffer.from(expected);
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}

function parseDays(raw) {
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return DEFAULT_DAYS;
  return Math.min(MAX_DAYS, Math.max(MIN_DAYS, n));
}

const zeroCounts = () => Object.fromEntries(EVENTS.map(e => [e, 0]));

// MGET values come back day by day, EVENTS order within a day
function buildReport(dates, values) {
  const totals = zeroCounts();
  const days = dates.map((date, d) => {
    const row = { date, ...zeroCounts() };
    EVENTS.forEach((e, i) => {
      row[e] = Number(values[d * EVENTS.length + i]) || 0;
      totals[e] += row[e];
    });
    return row;
  });
  return { days, totals };
}

module.exports = async function stats(req, res) {
  if (req.method !== 'GET') return res.setHeader('Allow', 'GET').status(405).end();
  if (!isAuthorized(req.headers.authorization)) return res.status(401).end();
  const dates = recentUtcDates(parseDays(req.query.days));
  const keys = dates.flatMap(date => EVENTS.map(e => counterKey(e, date)));
  try {
    const [values] = await redisPipeline([['MGET', ...keys]]);
    return res.setHeader('Cache-Control', 'no-store').status(200).json(buildReport(dates, values));
  } catch (e) {
    console.error('stats:', e.message);
    return res.status(502).end();
  }
};
