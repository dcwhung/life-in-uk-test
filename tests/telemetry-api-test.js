// v2.7.0 usage counter, server side: api/track.js (POST, counts events per UTC day) and api/stats.js (GET, token-gated
// read). Node only: the Vercel handlers are called with fake req / res objects and global fetch stands in for the
// Upstash Redis REST API, so no network or Redis is needed.
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REDIS_URL = 'https://redis.test';
const REDIS_TOKEN = 'redis-token';
const STATS_TOKEN = 'stats-secret';
const ORIGIN = 'https://life-uk.vercel.app';
const TODAY = '2026-10-14';
const NOW = Date.UTC(2026, 9, 14, 23, 59);

let asserts = 0;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); asserts++; console.log('ok:', m); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// fake Upstash: an in-memory counter map; records every pipeline call
function fakeRedis({ fail = false } = {}) {
  const counts = new Map();
  const calls = [];
  global.fetch = async (url, init) => {
    const commands = JSON.parse(init.body);
    calls.push({ url, auth: init.headers.Authorization, commands });
    if (fail) return { ok: false, status: 500, json: async () => ({ error: 'down' }) };
    const result = commands.map(([cmd, ...args]) => {
      if (cmd === 'INCR') { counts.set(args[0], (counts.get(args[0]) || 0) + 1); return { result: counts.get(args[0]) }; }
      if (cmd === 'MGET') return { result: args.map(k => (counts.has(k) ? String(counts.get(k)) : null)) };
      return { error: 'unknown command' };
    });
    return { ok: true, status: 200, json: async () => result };
  };
  return { counts, calls };
}
function fakeRes() {
  const res = { statusCode: 200, headers: {}, body: undefined, ended: false };
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; return res; };
  res.status = code => { res.statusCode = code; return res; };
  res.json = obj => { res.body = obj; res.ended = true; return res; };
  res.end = () => { res.ended = true; return res; };
  return res;
}
const req = ({ method = 'POST', body, headers = {}, query = {} } = {}) => ({ method, body, headers: { origin: ORIGIN, ...headers }, query });

function setEnv() {
  process.env.UPSTASH_REDIS_REST_URL = REDIS_URL;
  process.env.UPSTASH_REDIS_REST_TOKEN = REDIS_TOKEN;
  process.env.STATS_TOKEN = STATS_TOKEN;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
}
const realNow = Date.now;
Date.now = () => NOW;
setEnv();
const track = require(path.join(ROOT, 'api/track.js'));
const stats = require(path.join(ROOT, 'api/stats.js'));

// ── track ──
async function checkTrackCounts() {
  const redis = fakeRedis();
  const res = fakeRes();
  // sendBeacon posts text/plain, so Vercel hands the body over as a string
  await track(req({ body: JSON.stringify({ events: ['open', 'standalone', 'dau'] }) }), res);
  assert(res.statusCode === 204 && res.ended, 'valid beacon → 204');
  assert(redis.calls.length === 1 && redis.calls[0].url === `${REDIS_URL}/pipeline` && redis.calls[0].auth === `Bearer ${REDIS_TOKEN}`,
    'one pipeline call with the Redis token');
  assert(same(redis.calls[0].commands, [
    ['INCR', `lifeuk:open:${TODAY}`], ['INCR', `lifeuk:standalone:${TODAY}`], ['INCR', `lifeuk:dau:${TODAY}`],
  ]), 'one INCR per event, keyed by UTC day');
  await track(req({ body: { events: ['install'] } }), fakeRes());
  assert(redis.counts.get(`lifeuk:install:${TODAY}`) === 1, 'object body (application/json) works too');
}

async function checkTrackFilters() {
  const redis = fakeRedis();
  const res = fakeRes();
  await track(req({ body: JSON.stringify({ events: ['open', 'open', 'hack', 42, 'dau'] }) }), res);
  assert(res.statusCode === 204 && same(redis.calls[0].commands.map(c => c[1]), [`lifeuk:open:${TODAY}`, `lifeuk:dau:${TODAY}`]),
    'unknown and repeated events dropped');
  for (const [label, body] of [
    ['no known event', { events: ['hack'] }], ['events not an array', { events: 'open' }],
    ['bad json', '{nope'], ['no body', undefined], ['too many events', { events: Array(50).fill('open') }],
  ]) {
    const r = fakeRes();
    const before = redis.calls.length;
    await track(req({ body }), r);
    assert(r.statusCode === 400 && redis.calls.length === before, `${label} → 400, Redis untouched`);
  }
}

async function checkTrackGuards() {
  const redis = fakeRedis();
  const get = fakeRes();
  await track(req({ method: 'GET' }), get);
  assert(get.statusCode === 405 && get.headers.allow === 'POST', 'GET → 405 Allow: POST');
  const foreign = fakeRes();
  await track(req({ body: { events: ['open'] }, headers: { origin: 'https://evil.example' } }), foreign);
  assert(foreign.statusCode === 403, 'other origin → 403');
  const github = fakeRes();
  await track(req({ body: { events: ['open'] }, headers: { origin: 'https://dcwhung.github.io' } }), github);
  assert(github.statusCode === 403 && redis.calls.length === 0, 'GitHub Pages origin → 403 (only Vercel counts)');
}

async function checkTrackRedisDown() {
  fakeRedis({ fail: true });
  const res = fakeRes();
  const warn = console.error;
  console.error = () => {};
  await track(req({ body: { events: ['open'] } }), res);
  console.error = warn;
  assert(res.statusCode === 502, 'Redis error → 502');
}

async function checkKvEnvFallback() {
  const redis = fakeRedis();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  process.env.KV_REST_API_URL = 'https://kv.test';
  process.env.KV_REST_API_TOKEN = 'kv-token';
  await track(req({ body: { events: ['open'] } }), fakeRes());
  assert(redis.calls[0].url === 'https://kv.test/pipeline' && redis.calls[0].auth === 'Bearer kv-token', 'KV_REST_API_* env names work too');
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  const res = fakeRes();
  const warn = console.error;
  console.error = () => {};
  await track(req({ body: { events: ['open'] } }), res);
  console.error = warn;
  assert(res.statusCode === 500, 'no Redis env → 500');
  setEnv();
}

// ── stats ──
async function checkStats() {
  const redis = fakeRedis();
  redis.counts.set(`lifeuk:open:${TODAY}`, 5);
  redis.counts.set(`lifeuk:dau:${TODAY}`, 3);
  redis.counts.set('lifeuk:open:2026-10-13', 2);
  redis.counts.set('lifeuk:install:2026-10-13', 1);
  const res = fakeRes();
  await stats(req({ method: 'GET', headers: { authorization: `Bearer ${STATS_TOKEN}` }, query: { days: '2' } }), res);
  assert(res.statusCode === 200 && res.headers['cache-control'] === 'no-store', 'valid token → 200, no-store');
  assert(same(res.body.days, [
    { date: TODAY, open: 5, standalone: 0, dau: 3, install: 0 },
    { date: '2026-10-13', open: 2, standalone: 0, dau: 0, install: 1 },
  ]), 'per-day counts, newest first, missing keys = 0');
  assert(same(res.body.totals, { open: 7, standalone: 0, dau: 3, install: 1 }), 'totals over the range');
  assert(redis.calls.length === 1 && redis.calls[0].commands[0][0] === 'MGET', 'one MGET for the whole range');
}

async function checkStatsGuards() {
  fakeRedis();
  for (const [label, headers, code] of [
    ['no token', {}, 401], ['wrong token', { authorization: 'Bearer nope' }, 401],
    ['wrong length token', { authorization: `Bearer ${STATS_TOKEN}x` }, 401],
  ]) {
    const res = fakeRes();
    await stats(req({ method: 'GET', headers }), res);
    assert(res.statusCode === code, `${label} → ${code}`);
  }
  const post = fakeRes();
  await stats(req({ method: 'POST', headers: { authorization: `Bearer ${STATS_TOKEN}` } }), post);
  assert(post.statusCode === 405 && post.headers.allow === 'GET', 'POST → 405 Allow: GET');
  delete process.env.STATS_TOKEN;
  const unset = fakeRes();
  await stats(req({ method: 'GET', headers: { authorization: 'Bearer ' } }), unset);
  assert(unset.statusCode === 401, 'STATS_TOKEN unset → always 401 (even an empty bearer)');
  setEnv();
}

async function checkStatsDays() {
  const auth = { authorization: `Bearer ${STATS_TOKEN}` };
  for (const [days, expected] of [[undefined, 30], ['0', 1], ['abc', 30], ['9999', 365]]) {
    const redis = fakeRedis();
    await stats(req({ method: 'GET', headers: auth, query: days === undefined ? {} : { days } }), fakeRes());
    const keys = redis.calls[0].commands[0].length - 1;
    assert(keys === expected * 4, `days=${days} → ${expected} days (${keys} keys)`);
  }
}

(async () => {
  await checkTrackCounts();
  await checkTrackFilters();
  await checkTrackGuards();
  await checkTrackRedisDown();
  await checkKvEnvFallback();
  await checkStats();
  await checkStatsGuards();
  await checkStatsDays();
  Date.now = realNow;
  console.log(`PASS (${asserts} asserts)`);
})().catch(e => { console.error(e.message); process.exit(1); });
