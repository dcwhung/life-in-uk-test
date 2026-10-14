// ════════════════════════════════════════
// POST /api/track — the app's usage beacon (js/core/telemetry.js).
// Body: { "events": ["open", "standalone", "dau", "install"] } (sendBeacon sends it as text/plain).
// Counts each known event once per UTC day in Redis. Stores no IP, id or other personal data.
// ════════════════════════════════════════
const { EVENTS, counterKey, utcIsoDate } = require('./_lib/events');
const { redisConfig, redisPipeline } = require('./_lib/redis');

// user decision 2026-10-14 (option c): only the Vercel production site counts. = 'https://' + TELEMETRY_HOST in
// js/core/config.js (tests/telemetry-test.js checks). A filter against other sites' pages, not auth: curl can send it
const ALLOWED_ORIGIN = 'https://life-uk.vercel.app';
// W-088: requests counted per UTC day; past it a beacon gets 204 but counts nothing, so a flood costs one INCR per
// request instead of one per event and cannot inflate the numbers beyond it (rate limiting = Vercel Firewall rule)
const DAILY_REQUEST_BUDGET = 20000;
const BUDGET_EVENT = 'budget';
// a launch sends at most every event once; a much longer list is not our client
const MAX_EVENTS = 10;

function parseEvents(body) {
  let data = body;
  if (typeof body === 'string') {
    try { data = JSON.parse(body); } catch { return null; }
  }
  if (!data || !Array.isArray(data.events) || data.events.length > MAX_EVENTS) return null;
  const known = [...new Set(data.events)].filter(e => EVENTS.includes(e));
  return known.length ? known : null;
}

async function track(req, res) {
  if (req.method !== 'POST') return res.setHeader('Allow', 'POST').status(405).end();
  if (req.headers.origin !== ALLOWED_ORIGIN) return res.status(403).end();
  const events = parseEvents(req.body);
  if (!events) return res.status(400).end();
  try {
    redisConfig();
  } catch (e) {
    console.error('track:', e.message);
    return res.status(500).end();
  }
  const today = utcIsoDate(Date.now());
  try {
    const [used] = await redisPipeline([['INCR', counterKey(BUDGET_EVENT, today)]]);
    if (used > DAILY_REQUEST_BUDGET) return res.status(204).end();
    await redisPipeline(events.map(e => ['INCR', counterKey(e, today)]));
  } catch (e) {
    console.error('track:', e.message);
    return res.status(502).end();
  }
  return res.status(204).end();
}

module.exports = track;
module.exports.ALLOWED_ORIGIN = ALLOWED_ORIGIN;
module.exports.DAILY_REQUEST_BUDGET = DAILY_REQUEST_BUDGET;
