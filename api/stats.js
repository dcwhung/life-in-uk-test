// ════════════════════════════════════════
// GET /api/stats?days=all — the owner's read of the usage counters (stats.html, v2.9.0).
// Auth: HTTP Basic with STATS_USERNAME / STATS_PASSWORD (Vercel env vars; either unset = always 401). The 401 names a
// non-Basic scheme (S-284), so a browser never pops its own login dialog: stats.html has its own sign-in form.
// Login attempts are counted per UTC hour with no IP stored (W-384): each attempt reserves a slot with INCR before the
// password is checked (atomic, so a parallel burst gets no extra checks) and a good login gives its slot back. Past
// AUTH_FAIL_LIMIT everyone gets 429 until the hour turns: anyone can lock the owner out for an hour (accepted trade-off).
// days: 'all' = launch day → today; a number = that many days back (1..MAX_DAYS; default DEFAULT_DAYS).
// Returns { launch, days: [{ date, open, standalone, dau, install }] (newest first, UTC), totals: {...} }.
// ════════════════════════════════════════
const crypto = require('crypto');
const { EVENTS, counterKey, recentUtcDates, utcIsoDate } = require('./_lib/events');
const { redisPipeline } = require('./_lib/redis');

// the day the counter went live (v2.8.0, PR #142): no key before it holds data
const LAUNCH_DATE = '2026-10-14';
const ALL_DAYS = 'all';
const DEFAULT_DAYS = 30;
const MIN_DAYS = 1;
const MAX_DAYS = 730;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const BASIC = 'Basic ';
const AUTH_FAIL_LIMIT = 10;
const AUTH_FAIL_PREFIX = 'lifeuk:authfail:';
const MS_PER_SECOND = 1000;
const SECONDS_PER_HOUR = 60 * 60;
const MS_PER_HOUR = SECONDS_PER_HOUR * MS_PER_SECOND;
const AUTH_SCHEME_HEADER = 'StatsBasic realm="usage stats"';
const ISO_HOUR_LENGTH = 13; // '2026-10-14T23'

const failKey = nowMs => AUTH_FAIL_PREFIX + new Date(nowMs).toISOString().slice(0, ISO_HOUR_LENGTH);
const secondsToNextHour = nowMs => Math.ceil((MS_PER_HOUR - (nowMs % MS_PER_HOUR)) / MS_PER_SECOND);

// same-length digests, so the compare takes the same time whatever was typed
const digest = s => crypto.createHash('sha256').update(String(s), 'utf8').digest();
const sameSecret = (given, expected) => crypto.timingSafeEqual(digest(given), digest(expected));

// null = no Basic credentials at all; otherwise { user, password } split at the first colon
function readBasic(header) {
  if (typeof header !== 'string' || !header.startsWith(BASIC)) return null;
  const decoded = Buffer.from(header.slice(BASIC.length), 'base64').toString('utf8');
  const colon = decoded.indexOf(':');
  return colon < 0 ? { user: '', password: null } : { user: decoded.slice(0, colon), password: decoded.slice(colon + 1) };
}

function isAuthorized(creds) {
  const user = process.env.STATS_USERNAME;
  const password = process.env.STATS_PASSWORD;
  if (!user || !password || !creds || creds.password === null) return false;
  const userOk = sameSecret(creds.user, user);
  const passwordOk = sameSecret(creds.password, password); // both always compared
  return userOk && passwordOk;
}

const launchDayCount = nowMs =>
  Math.max(MIN_DAYS, Math.round((Date.parse(utcIsoDate(nowMs)) - Date.parse(LAUNCH_DATE)) / MS_PER_DAY) + 1);
function parseDays(raw, nowMs) {
  if (raw === ALL_DAYS) return launchDayCount(nowMs);
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
  return { launch: LAUNCH_DATE, days, totals };
}

const unauthorized = res => res.setHeader('WWW-Authenticate', AUTH_SCHEME_HEADER).status(401).end();

async function stats(req, res) {
  if (req.method !== 'GET') return res.setHeader('Allow', 'GET').status(405).end();
  const now = Date.now();
  const key = failKey(now);
  // only a real attempt counts: a request with no credentials (a crawler, a first load) cannot lock the owner out
  const creds = readBasic(req.headers.authorization);
  if (!creds) return unauthorized(res);
  try {
    const [attempts] = await redisPipeline([['INCR', key], ['EXPIRE', key, SECONDS_PER_HOUR]]);
    if (attempts > AUTH_FAIL_LIMIT) {
      return res.setHeader('Retry-After', String(secondsToNextHour(now))).status(429).end();
    }
    if (!isAuthorized(creds)) return unauthorized(res);
    await redisPipeline([['DECR', key]]); // a good login is not a failure
    const dates = recentUtcDates(parseDays(req.query.days, now), now);
    const keys = dates.flatMap(date => EVENTS.map(e => counterKey(e, date)));
    const [values] = await redisPipeline([['MGET', ...keys]]);
    return res.setHeader('Cache-Control', 'no-store').status(200).json(buildReport(dates, values));
  } catch (e) {
    console.error('stats:', e.message);
    return res.status(502).end();
  }
}

module.exports = stats;
module.exports.LAUNCH_DATE = LAUNCH_DATE;
module.exports.AUTH_FAIL_LIMIT = AUTH_FAIL_LIMIT;
