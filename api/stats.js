// ════════════════════════════════════════
// GET /api/stats?days=all — the owner's read of the usage counters (stats.html, v2.9.0).
// Auth: HTTP Basic with STATS_USERNAME / STATS_PASSWORD (Vercel env vars; either unset = always 401). The 401 names a
// non-Basic scheme (S-284), so a browser never pops its own login dialog: stats.html has its own sign-in form.
// Login lockout (SEC-03, .proj-docs/audits/2026-10-14_13-40_audit_full-codebase-v2.md; W-384): each attempt reserves a
// slot in two buckets per UTC hour, first one per client, then one global, with INCR before the password is checked.
// Each INCR is atomic (the Upstash /pipeline is not a transaction), so a parallel burst gets no extra checks. Past
// AUTH_FAIL_LIMIT_PER_CLIENT that client gets 429 and never reaches the global bucket (W-389); past
// AUTH_FAIL_LIMIT_GLOBAL (a distributed brute force) everyone does, until the hour turns. A good login or a global 429
// gives both slots back. The client id is an HMAC of the IP (/64 for IPv6) keyed by the password, so no IP is stored
// in Redis or logged; every key expires after 1 hour.
// days: 'all' = launch day → today; a number = that many days back (1..MAX_DAYS; default DEFAULT_DAYS).
// Returns { launch, days: [{ date, open, standalone, dau, install }] (newest first, UTC), totals: {...} }.
// ════════════════════════════════════════
const crypto = require('crypto');
const net = require('net');
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
const AUTH_FAIL_LIMIT_PER_CLIENT = 5;
const AUTH_FAIL_LIMIT_GLOBAL = 100;
const AUTH_FAIL_PREFIX = 'lifeuk:authfail:';
const UNKNOWN_IP = 'unknown'; // every request without an IP header shares this one bucket
const CLIENT_ID_LENGTH = 16; // hex chars of the HMAC kept in the key
const IPV6_GROUPS = 8;
const IPV6_PREFIX_GROUPS = 4; // a /64: one subscriber's network
const IPV4_MAPPED = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i;
const HEX = 16;
const MS_PER_SECOND = 1000;
const SECONDS_PER_HOUR = 60 * 60;
const MS_PER_HOUR = SECONDS_PER_HOUR * MS_PER_SECOND;
const AUTH_SCHEME_HEADER = 'StatsBasic realm="usage stats"';
const ISO_HOUR_LENGTH = 13; // '2026-10-14T23'

const utcHour = nowMs => new Date(nowMs).toISOString().slice(0, ISO_HOUR_LENGTH);
const secondsToNextHour = nowMs => Math.ceil((MS_PER_HOUR - (nowMs % MS_PER_HOUR)) / MS_PER_SECOND);

// IPv4 as is; IPv6 → its /64 (first 4 groups, lowercase, no leading zeros); IPv4-mapped IPv6 → the IPv4 address.
// S-289: anything else (a port, brackets, junk) is returned as is, so it gets a bucket of its own
function normalizeIp(ip) {
  const mapped = IPV4_MAPPED.exec(ip);
  if (mapped && net.isIPv4(mapped[1])) return mapped[1];
  const bare = ip.split('%')[0]; // drop a zone id (fe80::1%eth0)
  if (!net.isIPv6(bare)) return ip;
  const [head, tail = ''] = bare.split('::');
  const groups = s => (s ? s.split(':') : []);
  const left = groups(head);
  const right = groups(tail);
  const missing = Math.max(0, IPV6_GROUPS - left.length - right.length); // an IPv4 tail counts as 1 group: /64 unaffected
  const zeros = bare.includes('::') ? Array(missing).fill('0') : [];
  const full = [...left, ...zeros, ...right];
  return full.slice(0, IPV6_PREFIX_GROUPS).map(g => (Number.parseInt(g, HEX) || 0).toString(HEX)).join(':');
}

// per Vercel docs, Vercel overwrites x-real-ip and x-forwarded-for with the real client address, so a client cannot pick
// its bucket. A proxy put in front of Vercel (e.g. Cloudflare) would make every client share the proxy's IP (S-291)
function clientIp(headers) {
  const first = v => String(Array.isArray(v) ? v[0] : v).split(',')[0].trim();
  for (const name of ['x-real-ip', 'x-forwarded-for']) {
    const value = headers[name];
    if ((typeof value === 'string' || Array.isArray(value)) && first(value)) return first(value);
  }
  return UNKNOWN_IP;
}

// same-length digests, so the compare takes the same time whatever was typed
const digest = s => crypto.createHash('sha256').update(String(s), 'utf8').digest();
const sameSecret = (given, expected) => crypto.timingSafeEqual(digest(given), digest(expected));

// HMAC keyed by the password hash: the stored id cannot be turned back into an IP without the password, and the hour in
// the input makes ids of different hours unlinkable. Only called once the password is known to be set.
// W-391 (owner's decision, 2026-10-14): the key comes from the password, so anyone who can read Redis can test password
// guesses offline against a known IP: STATS_PASSWORD must be ≥ 20 random characters and never reused elsewhere.
const clientId = (ip, hour) => crypto.createHmac('sha256', digest(process.env.STATS_PASSWORD))
  .update(normalizeIp(ip) + '|' + hour).digest('hex').slice(0, CLIENT_ID_LENGTH);

// null = no Basic credentials at all; otherwise { user, password } split at the first colon
function readBasic(header) {
  if (typeof header !== 'string' || !header.startsWith(BASIC)) return null;
  const decoded = Buffer.from(header.slice(BASIC.length), 'base64').toString('utf8');
  const colon = decoded.indexOf(':');
  return colon < 0 ? { user: '', password: null } : { user: decoded.slice(0, colon), password: decoded.slice(colon + 1) };
}

const isConfigured = () => Boolean(process.env.STATS_USERNAME && process.env.STATS_PASSWORD);

function isAuthorized(creds) {
  const user = process.env.STATS_USERNAME;
  const password = process.env.STATS_PASSWORD;
  if (!isConfigured() || !creds || creds.password === null) return false;
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

const lockoutKeys = (req, nowMs) => {
  const hour = utcHour(nowMs);
  const global = AUTH_FAIL_PREFIX + hour;
  return { client: `${global}:${clientId(clientIp(req.headers), hour)}`, global };
};
const giveBack = keys => redisPipeline([['DECR', keys.client], ['DECR', keys.global]]);

const reserve = async key => (await redisPipeline([['INCR', key], ['EXPIRE', key, SECONDS_PER_HOUR]]))[0];

// reserve the client slot, then the global one; true = over a limit (no password is checked)
async function isLockedOut(keys) {
  // W-389: a locked-out client stops here and never touches the global bucket, so even a parallel flood from one IP
  // holds no global slot; its own counter just keeps rising until the hour turns
  if (await reserve(keys.client) > AUTH_FAIL_LIMIT_PER_CLIENT) return true;
  if (await reserve(keys.global) <= AUTH_FAIL_LIMIT_GLOBAL) return false;
  await giveBack(keys); // global cap hit: no password was checked, so both slots go back
  return true;
}

async function stats(req, res) {
  if (req.method !== 'GET') return res.setHeader('Allow', 'GET').status(405).end();
  const now = Date.now();
  // only a real attempt counts: a request with no credentials (a crawler, a first load) cannot lock the owner out;
  // fail closed while the env is unset (always 401 anyway), so the HMAC never runs without its secret key
  const creds = readBasic(req.headers.authorization);
  if (!creds || !isConfigured()) return unauthorized(res);
  const buckets = lockoutKeys(req, now);
  try {
    if (await isLockedOut(buckets)) {
      return res.setHeader('Retry-After', String(secondsToNextHour(now))).status(429).end();
    }
    if (!isAuthorized(creds)) return unauthorized(res);
    await giveBack(buckets); // a good login is not a failure
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
module.exports.AUTH_FAIL_LIMIT_PER_CLIENT = AUTH_FAIL_LIMIT_PER_CLIENT;
module.exports.AUTH_FAIL_LIMIT_GLOBAL = AUTH_FAIL_LIMIT_GLOBAL;
module.exports.normalizeIp = normalizeIp;
