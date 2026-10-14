// ════════════════════════════════════════
// POST /api/track — the app's usage beacon (js/core/telemetry.js).
// Body: { "events": ["open", "standalone", "dau", "install"] } (sendBeacon sends it as text/plain).
// Counts each known event once per UTC day in Redis. Stores no IP, id or other personal data.
// ════════════════════════════════════════
const { EVENTS, counterKey, cappedKey, utcIsoDate } = require('./_lib/events');
const { redisConfig, redisPipeline } = require('./_lib/redis');

// user decision 2026-10-14 (option c): only the Vercel production site counts. = 'https://' + TELEMETRY_HOST in
// js/core/config.js (tests/telemetry-test.js checks). A filter against other sites' pages, not auth: curl can send it
const ALLOWED_ORIGIN = 'https://life-uk.vercel.app';
// W-088: requests counted per UTC day; past it a beacon gets 204 but counts nothing, so a flood costs one INCR per
// request instead of one per event and cannot inflate the numbers beyond it (per-IP rate limiting = a Vercel Firewall
// rule set by hand: .proj-docs/deploys/2026-10-14_vercel-firewall-track.md).
// Sized to the Upstash free plan (500k commands / month): ~3 commands a request × 4000 × 30 days ≈ 360k
const DAILY_REQUEST_BUDGET = 4000;
const BUDGET_EVENT = 'budget';
// SEC-01: lifeuk:capped:<day> (SET NX by any over-budget request, W-400) keeps "this day hit the budget" for the
// dashboard after the budget key expires
const CAPPED_VALUE = '1';
// AU-031: the budget key is only read by this file on its own day (the dashboard reads the capped mark instead);
// 2 days leaves a margin past the UTC turn
const SECONDS_PER_DAY = 24 * 60 * 60;
const BUDGET_TTL_DAYS = 2;
const BUDGET_TTL_SECONDS = BUDGET_TTL_DAYS * SECONDS_PER_DAY;
const FIRST_REQUEST = 1;
// a launch sends at most every event once; a much longer list is not our client
const MAX_EVENTS = 10;

// SEC-02: the UTC day this instance has seen the budget run out on. Past it a beacon gets 204 with no Redis call, so a
// sustained flood stops costing one INCR per request. Module state lives only while Vercel keeps this instance warm:
// a cold start (or a parallel instance) spends one more INCR (+ the W-400 / S-300 capped pipeline) to find out, so
// this cuts the cost, it does not end it. A new UTC day no longer matches, so counting starts again by itself.
let budgetSpentOn = null;

function parseEvents(body) {
  let data = body;
  if (typeof body === 'string') {
    try { data = JSON.parse(body); } catch { return null; }
  }
  if (!data || !Array.isArray(data.events) || data.events.length > MAX_EVENTS) return null;
  const known = [...new Set(data.events)].filter(e => EVENTS.includes(e));
  return known.length ? known : null;
}

// AU-031: the day's first request (used = 1) also sets the budget key's TTL, inside the event pipeline: one command a
// day and no extra round trip. An EXPIRE beside every budget INCR would add ~1 command a request (~4 × 4000 × 30 ≈
// 480k of the 500k / month)
function eventCommands(events, today, used) {
  const commands = events.map(e => ['INCR', counterKey(e, today)]);
  if (used === FIRST_REQUEST) commands.push(['EXPIRE', counterKey(BUDGET_EVENT, today), BUDGET_TTL_SECONDS]);
  return commands;
}

// SEC-01 / W-400: every over-budget request marks the day for the dashboard, not only the crossing one: if that SET
// failed or its INCR reply was lost (timeout), a later request still writes it. NX keeps the first write.
// S-300: the same pipeline re-sets the budget key's TTL, so a capped day expires even if the day's first-request
// EXPIRE failed. With the SEC-02 short circuit this pipeline runs once per instance per day, 2 commands
// (concurrent in-flight requests may each run it)
function cappedCommands(today) {
  return [
    ['SET', cappedKey(today), CAPPED_VALUE, 'NX'],
    ['EXPIRE', counterKey(BUDGET_EVENT, today), BUDGET_TTL_SECONDS],
  ];
}

async function track(req, res) {
  if (req.method !== 'POST') return res.setHeader('Allow', 'POST').status(405).end();
  if (req.headers.origin !== ALLOWED_ORIGIN) return res.status(403).end();
  const events = parseEvents(req.body);
  if (!events) return res.status(400).end();
  const today = utcIsoDate(Date.now());
  if (budgetSpentOn === today) return res.status(204).end();
  try {
    redisConfig();
  } catch (e) {
    console.error('track:', e.message);
    return res.status(500).end();
  }
  try {
    const [used] = await redisPipeline([['INCR', counterKey(BUDGET_EVENT, today)]]);
    if (used > DAILY_REQUEST_BUDGET) {
      budgetSpentOn = today;
      await redisPipeline(cappedCommands(today));
      return res.status(204).end();
    }
    await redisPipeline(eventCommands(events, today, used));
  } catch (e) {
    console.error('track:', e.message);
    return res.status(502).end();
  }
  return res.status(204).end();
}

module.exports = track;
module.exports.ALLOWED_ORIGIN = ALLOWED_ORIGIN;
module.exports.DAILY_REQUEST_BUDGET = DAILY_REQUEST_BUDGET;
module.exports.BUDGET_TTL_SECONDS = BUDGET_TTL_SECONDS;
