// v2.8.0 usage counter, server side: api/track.js (POST, counts events per UTC day) and api/stats.js (GET; v2.9.0:
// username + password, lockout after repeated wrong logins). Node only: the Vercel handlers are called with fake req / res objects and global fetch stands in for the
// Upstash Redis REST API, so no network or Redis is needed.
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REDIS_URL = 'https://redis.test';
const REDIS_TOKEN = 'redis-token';
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
    await new Promise(r => setImmediate(r)); // a real round trip: parallel requests interleave between commands
    const commands = JSON.parse(init.body);
    calls.push({ url, auth: init.headers.Authorization, commands, signal: init.signal });
    if (fail) return { ok: false, status: 500, json: async () => ({ error: 'down' }) };
    const result = commands.map(([cmd, ...args]) => {
      if (cmd === 'INCR') { counts.set(args[0], (counts.get(args[0]) || 0) + 1); return { result: counts.get(args[0]) }; }
      if (cmd === 'MGET') return { result: args.map(k => (counts.has(k) ? String(counts.get(k)) : null)) };
      if (cmd === 'GET') return { result: counts.has(args[0]) ? String(counts.get(args[0])) : null };
      if (cmd === 'EXPIRE') return { result: 1 };
      if (cmd === 'DECR') { counts.set(args[0], (counts.get(args[0]) || 0) - 1); return { result: counts.get(args[0]) }; }
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
  process.env.STATS_USERNAME = 'admin';
  process.env.STATS_PASSWORD = 'correct horse battery staple';
  delete process.env.STATS_TOKEN;
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
  assert(redis.calls.length === 2 && redis.calls.every(c => c.url === `${REDIS_URL}/pipeline` && c.auth === `Bearer ${REDIS_TOKEN}`),
    'two pipeline calls with the Redis token');
  assert(same(redis.calls[0].commands, [['INCR', `lifeuk:budget:${TODAY}`]]), 'first the daily request budget');
  assert(same(redis.calls[1].commands, [
    ['INCR', `lifeuk:open:${TODAY}`], ['INCR', `lifeuk:standalone:${TODAY}`], ['INCR', `lifeuk:dau:${TODAY}`],
  ]), 'then one INCR per event, keyed by UTC day');
  assert(redis.calls[0].signal instanceof AbortSignal, 'S-100: the Redis fetch has a timeout signal');
  await track(req({ body: { events: ['install'] } }), fakeRes());
  assert(redis.counts.get(`lifeuk:install:${TODAY}`) === 1, 'object body (application/json) works too');
}

async function checkTrackFilters() {
  const redis = fakeRedis();
  const res = fakeRes();
  await track(req({ body: JSON.stringify({ events: ['open', 'open', 'hack', 42, 'dau'] }) }), res);
  assert(res.statusCode === 204 && same(redis.calls[1].commands.map(c => c[1]), [`lifeuk:open:${TODAY}`, `lifeuk:dau:${TODAY}`]),
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

// W-088: past the daily request budget a beacon still gets 204 but counts nothing (caps a flood's Redis use)
async function checkTrackBudget() {
  const redis = fakeRedis();
  redis.counts.set(`lifeuk:budget:${TODAY}`, track.DAILY_REQUEST_BUDGET);
  const res = fakeRes();
  await track(req({ body: { events: ['open', 'dau'] } }), res);
  assert(res.statusCode === 204, 'over budget → still 204');
  assert(!redis.counts.has(`lifeuk:open:${TODAY}`) && !redis.counts.has(`lifeuk:dau:${TODAY}`), 'over budget → no event counted');
  assert(redis.calls.length === 1 && same(redis.calls[0].commands, [['INCR', `lifeuk:budget:${TODAY}`]]), 'over budget → only the budget INCR');
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

// ── stats (v2.9.0: username + password, all days since launch, lockout after repeated wrong logins) ──
const USER = 'admin';
const PASSWORD = 'correct horse battery staple';
const basic = (u, p) => ({ authorization: 'Basic ' + Buffer.from(`${u}:${p}`, 'utf8').toString('base64') });
const AUTH = basic(USER, PASSWORD);
const statsReq = (headers = AUTH, query = { days: 'all' }) => req({ method: 'GET', headers, query });
// SEC-03: one global bucket per UTC hour plus one bucket per client (an HMAC of the client's IP, never the IP itself)
const GLOBAL_KEY = 'lifeuk:authfail:2026-10-14T23';
const CLIENT_KEY_RE = /^lifeuk:authfail:2026-10-14T23:[0-9a-f]{16}$/;
const failKeys = redis => [...redis.counts.keys()].filter(k => k.startsWith('lifeuk:authfail:'));
const clientKeys = redis => failKeys(redis).filter(k => CLIENT_KEY_RE.test(k));
const fromIp = (ip, headers = AUTH) => ({ ...headers, 'x-real-ip': ip });
const wrongFrom = (ip, i) => statsReq(fromIp(ip, basic(USER, 'guess' + i)));
const PER_CLIENT = () => stats.AUTH_FAIL_LIMIT_PER_CLIENT;
// the client key a request lands in: the first INCR of its lockout pipeline
const keyOf = async (redis, headers) => {
  const before = redis.calls.length;
  await stats(statsReq(headers), fakeRes());
  return redis.calls[before].commands[0][1];
};
const lastCall = redis => redis.calls[redis.calls.length - 1];

async function checkStats() {
  const redis = fakeRedis();
  redis.counts.set(`lifeuk:open:${TODAY}`, 5);
  redis.counts.set(`lifeuk:standalone:${TODAY}`, 2);
  redis.counts.set(`lifeuk:dau:${TODAY}`, 3);
  const res = fakeRes();
  await stats(statsReq(), res);
  assert(res.statusCode === 200 && res.headers['cache-control'] === 'no-store', 'right username + password → 200, no-store');
  assert(res.body.launch === stats.LAUNCH_DATE && stats.LAUNCH_DATE === '2026-10-14', 'launch date in the response (2026-10-14)');
  assert(same(res.body.days, [{ date: TODAY, open: 5, standalone: 2, dau: 3, install: 0 }]), 'days=all on launch day: one day');
  assert(same(res.body.totals, { open: 5, standalone: 2, dau: 3, install: 0 }), 'totals over the range');
  assert(lastCall(redis).commands.length === 1 && lastCall(redis).commands[0][0] === 'MGET', 'one MGET for the whole range');
  assert(failKeys(redis).length === 2 && failKeys(redis).every(k => !(redis.counts.get(k) > 0)),
    'a good login leaves no failure counted in either bucket (its reserved attempts are given back)');
}

// days=all reaches back to the launch day and no further; keys never leave the event set
async function checkStatsAllDays() {
  const later = Date.UTC(2027, 9, 14, 12); // 365 days after launch
  Date.now = () => later;
  const redis = fakeRedis();
  redis.counts.set('lifeuk:open:2026-10-14', 4);
  redis.counts.set('lifeuk:open:2026-10-13', 99); // before launch: never read
  const res = fakeRes();
  await stats(statsReq(), res);
  Date.now = () => NOW;
  const mget = lastCall(redis).commands[0];
  assert(res.body.days.length === 366 && res.body.days[0].date === '2027-10-14' && res.body.days[365].date === '2026-10-14',
    'days=all a year on: 366 days, newest first, oldest = launch day');
  assert(mget.length - 1 === 366 * 4 && !mget.includes('lifeuk:open:2026-10-13'), 'MGET covers launch → today only');
  assert(res.body.totals.open === 4, 'pre-launch keys never counted');
}

async function checkStatsDays() {
  for (const [days, expected] of [[undefined, 30], ['0', 1], ['abc', 30], ['9999', 730], ['7', 7]]) {
    const redis = fakeRedis();
    await stats(statsReq(AUTH, days === undefined ? {} : { days }), fakeRes());
    const keys = lastCall(redis).commands[0].length - 1;
    assert(keys === expected * 4, `days=${days} → ${expected} days (${keys} keys)`);
  }
}

async function checkStatsAuth() {
  for (const [label, headers] of [
    ['no header', {}], ['wrong password', basic(USER, 'nope')], ['wrong username', basic('root', PASSWORD)],
    ['password with a suffix', basic(USER, PASSWORD + 'x')], ['bearer scheme', { authorization: 'Bearer x' }],
    ['not base64 / no colon', { authorization: 'Basic ###' }],
  ]) {
    fakeRedis();
    const res = fakeRes();
    await stats(statsReq(headers), res);
    const scheme = res.headers['www-authenticate'] || '';
    assert(res.statusCode === 401 && scheme && !/^(basic|digest)\b/i.test(scheme), `${label} → 401 with a non-Basic WWW-Authenticate (no browser dialog)`);
  }
  // a password that itself holds a colon: only the first colon splits user and password
  process.env.STATS_PASSWORD = 'a:b';
  fakeRedis();
  const colon = fakeRes();
  await stats(statsReq(basic(USER, 'a:b')), colon);
  assert(colon.statusCode === 200, 'password with a colon → 200');
  setEnv();
  for (const unset of ['STATS_USERNAME', 'STATS_PASSWORD']) {
    delete process.env[unset];
    const redis = fakeRedis();
    const res = fakeRes();
    await stats(statsReq(basic('', '')), res);
    assert(res.statusCode === 401 && redis.calls.length === 0, `${unset} unset → always 401 (even empty credentials), Redis untouched`);
    setEnv();
  }
  fakeRedis();
  const post = fakeRes();
  await stats(req({ method: 'POST', headers: AUTH }), post);
  assert(post.statusCode === 405 && post.headers.allow === 'GET', 'POST → 405 Allow: GET');
}

// SEC-03: IPv6 clients are bucketed by /64 (one subscriber's prefix); IPv4-mapped IPv6 is the IPv4 address
function checkNormalizeIp() {
  for (const [raw, expected] of [
    ['203.0.113.7', '203.0.113.7'], ['2001:db8:1:2:aaaa::1', '2001:db8:1:2'], ['2001:DB8:0001:0002:bbbb::9', '2001:db8:1:2'],
    ['2001:db8::1', '2001:db8:0:0'], ['::1', '0:0:0:0'], ['::ffff:1.2.3.4', '1.2.3.4'], ['::FFFF:1.2.3.4', '1.2.3.4'],
    ['fe80::1%eth0', 'fe80:0:0:0'], ['2001:db8:a:b:c:d:e:f', '2001:db8:a:b'], ['1:2:3:4:5:6:7:8::9', '1:2:3:4'],
  ]) assert(stats.normalizeIp(raw) === expected, `normalizeIp(${raw}) → ${expected}`);
}

// wrong logins are counted per client and per UTC hour: past the client limit that client gets 429 until the hour turns
async function checkStatsLockout() {
  const redis = fakeRedis();
  const A = '203.0.113.7';
  for (let i = 0; i < PER_CLIENT(); i++) await stats(wrongFrom(A, i), fakeRes());
  const [clientKey] = clientKeys(redis);
  assert(clientKeys(redis).length === 1 && redis.counts.get(clientKey) === PER_CLIENT(),
    `${PER_CLIENT()} wrong logins counted under one client key (${clientKey})`);
  assert(redis.counts.get(GLOBAL_KEY) === PER_CLIENT(), 'and under the global key');
  const pipe = redis.calls[0].commands;
  assert(same(pipe, [['INCR', clientKey], ['EXPIRE', clientKey, 3600], ['INCR', GLOBAL_KEY], ['EXPIRE', GLOBAL_KEY, 3600]]),
    'W-384: both buckets reserved in one pipeline, each expiring in an hour');
  const locked = fakeRes();
  await stats(statsReq(fromIp(A)), locked);
  assert(locked.statusCode === 429 && Number(locked.headers['retry-after']) === 60,
    `attempt ${PER_CLIENT() + 1}: even the right password → 429, Retry-After to the next hour (60 s)`);
  const noHeader = fakeRedis();
  await stats(statsReq(fromIp(A, {})), fakeRes());
  assert(failKeys(noHeader).length === 0, 'a request with no credentials is not counted as a failure');
}

// SEC-03 repro: one client's wrong logins must not lock out the owner on another IP
async function checkStatsLockoutSec03() {
  fakeRedis();
  const attempts = PER_CLIENT() + 6;
  const codes = [];
  for (let i = 0; i < attempts; i++) {
    const res = fakeRes();
    await stats(wrongFrom('198.51.100.1', i), res);
    codes.push(res.statusCode);
  }
  assert(codes[codes.length - 1] === 429, `SEC-03: ${attempts} wrong logins from IP A → A gets 429`);
  const owner = fakeRes();
  await stats(statsReq(fromIp('192.0.2.50')), owner);
  assert(owner.statusCode === 200, 'SEC-03: the owner on IP B with the right password → 200');
}

// a locked-out client's extra attempts get no password check, so they give their global slot back
async function checkStatsLockedClientSparesGlobal() {
  const redis = fakeRedis();
  const flood = stats.AUTH_FAIL_LIMIT_GLOBAL + 10;
  for (let i = 0; i < flood; i++) await stats(wrongFrom('198.51.100.2', i), fakeRes());
  assert(redis.counts.get(GLOBAL_KEY) === PER_CLIENT(), `${flood} attempts from one IP use only ${PER_CLIENT()} global slots`);
  const owner = fakeRes();
  await stats(statsReq(fromIp('192.0.2.50')), owner);
  assert(owner.statusCode === 200, 'one IP alone cannot exhaust the global budget');
}

// the global cap limits a distributed brute force: enough clients each at their limit lock everyone out
async function checkStatsLockoutGlobal() {
  const redis = fakeRedis();
  const clients = stats.AUTH_FAIL_LIMIT_GLOBAL / PER_CLIENT();
  for (let c = 0; c < clients; c++) {
    for (let i = 0; i < PER_CLIENT(); i++) await stats(wrongFrom(`10.0.${c >> 8}.${c & 255}`, i), fakeRes());
  }
  assert(redis.counts.get(GLOBAL_KEY) === stats.AUTH_FAIL_LIMIT_GLOBAL, `${clients} clients × ${PER_CLIENT()} = global limit`);
  const owner = fakeRes();
  await stats(statsReq(fromIp('192.0.2.50')), owner);
  assert(owner.statusCode === 429 && Number(owner.headers['retry-after']) === 60, 'past the global limit a fresh IP with the right password → 429');
  assert(redis.counts.get(GLOBAL_KEY) === stats.AUTH_FAIL_LIMIT_GLOBAL, 'the refused attempt gives its global slot back');
}

async function checkStatsIpv6Buckets() {
  const redis = fakeRedis();
  const a = await keyOf(redis, fromIp('2001:db8:1:2:aaaa::1', basic(USER, 'x')));
  const b = await keyOf(redis, fromIp('2001:DB8:1:2:bbbb::9', basic(USER, 'x')));
  const other = await keyOf(redis, fromIp('2001:db8:1:3:aaaa::1', basic(USER, 'x')));
  assert(a === b && CLIENT_KEY_RE.test(a), 'same /64, different interface id → same bucket');
  assert(a !== other, 'different /64 → different bucket');
  const mapped = await keyOf(redis, fromIp('::ffff:1.2.3.4', basic(USER, 'x')));
  const v4 = await keyOf(redis, fromIp('1.2.3.4', basic(USER, 'x')));
  assert(mapped === v4, 'IPv4-mapped IPv6 → the IPv4 bucket');
}

// Vercel sets x-real-ip and x-forwarded-for itself; a missing IP falls back to one shared bucket
async function checkStatsClientIpHeaders() {
  const redis = fakeRedis();
  const wrong = basic(USER, 'x');
  const first = await keyOf(redis, { ...wrong, 'x-forwarded-for': ' 1.1.1.1 , 2.2.2.2' });
  const single = await keyOf(redis, { ...wrong, 'x-real-ip': '1.1.1.1' });
  const second = await keyOf(redis, { ...wrong, 'x-real-ip': '2.2.2.2' });
  assert(first === single && first !== second, 'x-forwarded-for: the first address (trimmed)');
  const both = await keyOf(redis, { ...wrong, 'x-real-ip': '2.2.2.2', 'x-forwarded-for': '1.1.1.1' });
  assert(both === second, 'x-real-ip wins over x-forwarded-for');
  const none = await keyOf(redis, wrong);
  const junk = await keyOf(redis, { ...wrong, 'x-real-ip': ['', 'x'], 'x-forwarded-for': 42 });
  assert(CLIENT_KEY_RE.test(none) && none === junk, 'no usable IP header (missing / array / not a string) → one shared fallback bucket');
  const list = await keyOf(redis, { ...wrong, 'x-forwarded-for': ['1.1.1.1, 9.9.9.9'] });
  assert(list === single, 'x-forwarded-for given as an array: its first entry');
}

// privacy: no raw IP (or IPv6 fragment) is ever sent to Redis
async function checkStatsNoIpStored() {
  const redis = fakeRedis();
  const ips = ['203.0.113.77', '2001:db8:abcd:12:aaaa::1', '::ffff:198.51.100.99'];
  for (const ip of ips) {
    await stats(statsReq(fromIp(ip, basic(USER, 'x'))), fakeRes());
    await stats(statsReq(fromIp(ip)), fakeRes());
  }
  const sent = JSON.stringify(redis.calls.map(c => c.commands));
  const leaks = ['203.0.113.77', '198.51.100.99', '2001:db8', 'db8:abcd', 'abcd:12', '2001:0db8'].filter(s => sent.includes(s));
  assert(leaks.length === 0, `no raw IP in any Redis command (leaked: ${leaks.join(', ') || 'none'})`);
  const ids = clientKeys(redis).map(k => k.split(':').pop());
  assert(ids.length === 3 && ids.every(id => /^[0-9a-f]{16}$/.test(id)), 'client ids are 16 hex chars (HMAC)');
}

// W-384: a parallel burst of wrong logins from one client must not get more than the per-client limit of password checks
async function checkStatsLockoutBurst() {
  const redis = fakeRedis();
  const BURST = 25;
  const results = await Promise.all(Array.from({ length: BURST }, (_, i) => {
    const res = fakeRes();
    return stats(wrongFrom('203.0.113.9', 'burst' + i), res).then(() => res.statusCode);
  }));
  const checked = results.filter(code => code === 401).length;
  assert(checked <= PER_CLIENT() && results.every(code => code === 401 || code === 429),
    `parallel burst of ${BURST}: ${checked} password checks (≤ ${PER_CLIENT()}), the rest 429`);
  assert(redis.counts.get(GLOBAL_KEY) === checked, 'after the burst the global bucket holds only the checked attempts');
}

async function checkStatsRedisDown() {
  fakeRedis({ fail: true });
  const res = fakeRes();
  const warn = console.error;
  console.error = () => {};
  await stats(statsReq(), res);
  console.error = warn;
  assert(res.statusCode === 502, 'stats: Redis error → 502');
}

(async () => {
  await checkTrackCounts();
  await checkTrackFilters();
  await checkTrackGuards();
  await checkTrackBudget();
  await checkTrackRedisDown();
  await checkKvEnvFallback();
  await checkStats();
  await checkStatsAllDays();
  await checkStatsDays();
  await checkStatsAuth();
  checkNormalizeIp();
  await checkStatsLockout();
  await checkStatsLockoutSec03();
  await checkStatsLockedClientSparesGlobal();
  await checkStatsLockoutGlobal();
  await checkStatsIpv6Buckets();
  await checkStatsClientIpHeaders();
  await checkStatsNoIpStored();
  await checkStatsLockoutBurst();
  await checkStatsRedisDown();
  Date.now = realNow;
  console.log(`PASS (${asserts} asserts)`);
})().catch(e => { console.error(e.message); process.exit(1); });
