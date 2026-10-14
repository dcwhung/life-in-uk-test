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

// fake Redis SET: NX (W-400) leaves an existing key alone and replies null, like Redis
function fakeSet(counts, [key, value, flag]) {
  if (flag === 'NX' && counts.has(key)) return { result: null };
  counts.set(key, Number(value));
  return { result: 'OK' };
}

function fakeCommand(counts, [cmd, ...args]) {
  if (cmd === 'INCR') { counts.set(args[0], (counts.get(args[0]) || 0) + 1); return { result: counts.get(args[0]) }; }
  if (cmd === 'MGET') return { result: args.map(k => (counts.has(k) ? String(counts.get(k)) : null)) };
  if (cmd === 'GET') return { result: counts.has(args[0]) ? String(counts.get(args[0])) : null };
  if (cmd === 'EXPIRE') return { result: 1 };
  if (cmd === 'SET') return fakeSet(counts, args);
  if (cmd === 'DECR') { counts.set(args[0], (counts.get(args[0]) || 0) - 1); return { result: counts.get(args[0]) }; }
  return { error: 'unknown command' };
}

// fake Upstash: an in-memory counter map; records every pipeline call. W-400: breakCall(commands) → 'error' (every
// command in that pipeline replies with an error, none runs) or 'lost' (Redis runs it, the reply never arrives)
function fakeRedis({ fail = false, breakCall = () => null } = {}) {
  const counts = new Map();
  const calls = [];
  global.fetch = async (url, init) => {
    await new Promise(r => setImmediate(r)); // a real round trip: parallel requests interleave between commands
    const commands = JSON.parse(init.body);
    calls.push({ url, auth: init.headers.Authorization, commands, signal: init.signal });
    if (fail) return { ok: false, status: 500, json: async () => ({ error: 'down' }) };
    const broken = breakCall(commands);
    if (broken === 'error') return { ok: true, status: 200, json: async () => commands.map(() => ({ error: 'ERR set failed' })) };
    const result = commands.map(c => fakeCommand(counts, c));
    if (broken === 'lost') throw new Error('The operation was aborted due to timeout');
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
const TRACK_PATH = path.join(ROOT, 'api/track.js');
// S-301: a fresh api/track.js per check = a cold Vercel instance, so no check depends on another's module state
// (SEC-02 budgetSpentOn) or on running order. api/_lib/* holds no state, so it stays cached
function freshTrack() {
  delete require.cache[require.resolve(TRACK_PATH)];
  return require(TRACK_PATH);
}
const BUDGET = freshTrack().DAILY_REQUEST_BUDGET;
const stats = require(path.join(ROOT, 'api/stats.js'));

// ── track ──
async function checkTrackCounts() {
  const track = freshTrack();
  const redis = fakeRedis();
  const res = fakeRes();
  // sendBeacon posts text/plain, so Vercel hands the body over as a string
  await track(req({ body: JSON.stringify({ events: ['open', 'standalone', 'dau'] }) }), res);
  assert(res.statusCode === 204 && res.ended, 'valid beacon → 204');
  assert(redis.calls.length === 2 && redis.calls.every(c => c.url === `${REDIS_URL}/pipeline` && c.auth === `Bearer ${REDIS_TOKEN}`),
    'two pipeline calls with the Redis token');
  assert(same(redis.calls[0].commands, [['INCR', `lifeuk:budget:${TODAY}`]]), 'first the daily request budget');
  // AU-031: the day's first request also sets the budget key's TTL (in the event pipeline: no extra round trip)
  assert(same(redis.calls[1].commands, [
    ['INCR', `lifeuk:open:${TODAY}`], ['INCR', `lifeuk:standalone:${TODAY}`], ['INCR', `lifeuk:dau:${TODAY}`],
    ['EXPIRE', `lifeuk:budget:${TODAY}`, track.BUDGET_TTL_SECONDS],
  ]), 'then one INCR per event, keyed by UTC day, + EXPIRE on the budget key (first request of the day)');
  assert(track.BUDGET_TTL_SECONDS === 2 * 24 * 60 * 60, 'AU-031: the budget key lives 2 days');
  assert(redis.calls[0].signal instanceof AbortSignal, 'S-100: the Redis fetch has a timeout signal');
  await track(req({ body: { events: ['install'] } }), fakeRes());
  assert(redis.counts.get(`lifeuk:install:${TODAY}`) === 1, 'object body (application/json) works too');
  assert(same(redis.calls[3].commands, [['INCR', `lifeuk:install:${TODAY}`]]), 'later requests that day: no EXPIRE again');
}

async function checkTrackFilters() {
  const track = freshTrack();
  const redis = fakeRedis();
  const res = fakeRes();
  await track(req({ body: JSON.stringify({ events: ['open', 'open', 'hack', 42, 'dau'] }) }), res);
  const counted = redis.calls[1].commands.filter(c => c[0] === 'INCR').map(c => c[1]);
  assert(res.statusCode === 204 && same(counted, [`lifeuk:open:${TODAY}`, `lifeuk:dau:${TODAY}`]),
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
  const track = freshTrack();
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
  const track = freshTrack();
  const redis = fakeRedis();
  redis.counts.set(`lifeuk:budget:${TODAY}`, track.DAILY_REQUEST_BUDGET);
  const res = fakeRes();
  await track(req({ body: { events: ['open', 'dau'] } }), res);
  assert(res.statusCode === 204, 'over budget → still 204');
  assert(!redis.counts.has(`lifeuk:open:${TODAY}`) && !redis.counts.has(`lifeuk:dau:${TODAY}`), 'over budget → no event counted');
  assert(same(redis.calls[0].commands, [['INCR', `lifeuk:budget:${TODAY}`]]), 'over budget → the budget INCR, no event INCR');
  // SEC-01: an over-budget request marks the day capped (no TTL), so the dashboard can say so later. W-400: NX, so
  // any over-budget request can (re)write it without the crossing request being the only chance
  // S-300: the same pipeline re-sets the budget key's TTL, so a day whose first-request EXPIRE failed still expires
  assert(redis.calls.length === 2 && same(redis.calls[1].commands, [
    ['SET', `lifeuk:capped:${TODAY}`, '1', 'NX'], ['EXPIRE', `lifeuk:budget:${TODAY}`, track.BUDGET_TTL_SECONDS],
  ]), 'an over-budget request sets lifeuk:capped:<day> NX + EXPIRE on the budget key, in one pipeline');
  assert(redis.counts.get(`lifeuk:capped:${TODAY}`) === 1, 'the day is marked capped');
}

// SEC-02: once a warm instance has seen the day's budget run out it stops calling Redis for that UTC day, so a
// sustained flood no longer costs one INCR per request; the next UTC day counts again
async function checkTrackBudgetShortCircuit() {
  const track = freshTrack();
  const redis = fakeRedis();
  redis.counts.set(`lifeuk:budget:${TODAY}`, track.DAILY_REQUEST_BUDGET);
  await track(req({ body: { events: ['open'] } }), fakeRes());
  // S-301: the first call really finds the cap in Redis (a fresh module has not seen it yet)
  assert(redis.calls.length > 0 && redis.counts.get(`lifeuk:budget:${TODAY}`) === track.DAILY_REQUEST_BUDGET + 1,
    'a fresh instance learns from Redis that the budget is used up');
  const before = redis.calls.length;
  const again = fakeRes();
  await track(req({ body: { events: ['open'] } }), again);
  assert(again.statusCode === 204 && redis.calls.length === before, 'budget used up → same instance, same day: 204 with no Redis call');
  const nextDay = Date.UTC(2026, 9, 15, 0, 1);
  Date.now = () => nextDay;
  const fresh = fakeRes();
  await track(req({ body: { events: ['open'] } }), fresh);
  Date.now = () => NOW;
  assert(fresh.statusCode === 204 && redis.counts.get('lifeuk:budget:2026-10-15') === 1 && redis.counts.get('lifeuk:open:2026-10-15') === 1,
    'next UTC day: the budget is INCRed again and the event counted');
}

// W-400: a cold instance meeting a budget already past the crossing point writes the capped mark too (NX: an existing
// mark stays); with SEC-02 that is at most one extra command per instance per day
async function checkTrackBudgetPastCrossing() {
  const track = freshTrack();
  const redis = fakeRedis();
  redis.counts.set(`lifeuk:budget:${TODAY}`, track.DAILY_REQUEST_BUDGET + 5);
  // S-307: another instance already marked the day, so SET NX replies { result: null }; that is not an error
  redis.counts.set(`lifeuk:capped:${TODAY}`, 1);
  const res = fakeRes();
  await track(req({ body: { events: ['open'] } }), res);
  assert(redis.calls.length === 2 && same(redis.calls[1].commands[0], ['SET', `lifeuk:capped:${TODAY}`, '1', 'NX']) &&
    redis.counts.get(`lifeuk:capped:${TODAY}`) === 1, 'past the crossing point: the budget INCR + SET capped NX');
  assert(res.statusCode === 204, 'S-307: SET NX on an existing capped mark (result null) still answers 204');
  assert(same(redis.calls[1].commands[1], ['EXPIRE', `lifeuk:budget:${TODAY}`, track.BUDGET_TTL_SECONDS]),
    'S-300: past the crossing point the budget key gets its TTL again too');
}

// W-400: the crossing request's SET fails → a later instance still marks the day capped
async function checkTrackCappedSetFails() {
  const redis = fakeRedis({ breakCall: cmds => (cmds[0][0] === 'SET' && redis.calls.length === 2 ? 'error' : null) });
  redis.counts.set(`lifeuk:budget:${TODAY}`, BUDGET);
  const warn = console.error;
  console.error = () => {};
  await freshTrack()(req({ body: { events: ['open'] } }), fakeRes());
  console.error = warn;
  assert(!redis.counts.has(`lifeuk:capped:${TODAY}`), 'the crossing request\'s SET failed: no capped mark yet');
  await freshTrack()(req({ body: { events: ['open'] } }), fakeRes());
  assert(redis.counts.get(`lifeuk:capped:${TODAY}`) === 1, 'W-400: the next fresh instance writes the capped mark');
}

// W-400: the crossing INCR ran but its reply was lost (timeout) → a later instance still marks the day capped
async function checkTrackCrossingReplyLost() {
  const redis = fakeRedis({ breakCall: () => (redis.calls.length === 1 ? 'lost' : null) });
  redis.counts.set(`lifeuk:budget:${TODAY}`, BUDGET);
  const res = fakeRes();
  const warn = console.error;
  console.error = () => {};
  await freshTrack()(req({ body: { events: ['open'] } }), res);
  console.error = warn;
  assert(res.statusCode === 502 && redis.counts.get(`lifeuk:budget:${TODAY}`) === BUDGET + 1 &&
    !redis.counts.has(`lifeuk:capped:${TODAY}`), 'crossing INCR ran but its reply was lost: 502, no capped mark');
  await freshTrack()(req({ body: { events: ['open'] } }), fakeRes());
  assert(redis.counts.get(`lifeuk:capped:${TODAY}`) === 1, 'W-400: the next fresh instance writes the capped mark');
}

async function checkTrackRedisDown() {
  const track = freshTrack();
  fakeRedis({ fail: true });
  const res = fakeRes();
  const warn = console.error;
  console.error = () => {};
  await track(req({ body: { events: ['open'] } }), res);
  console.error = warn;
  assert(res.statusCode === 502, 'Redis error → 502');
}

async function checkKvEnvFallback() {
  const track = freshTrack();
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
const KEYS_PER_DAY = 5; // 4 event counters + the SEC-01 capped mark
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
  assert(same(res.body.days, [{ date: TODAY, open: 5, standalone: 2, dau: 3, install: 0, capped: false }]), 'days=all on launch day: one day, not capped');
  assert(same(res.body.totals, { open: 5, standalone: 2, dau: 3, install: 0 }), 'totals over the range');
  assert(lastCall(redis).commands.length === 1 && lastCall(redis).commands[0][0] === 'MGET', 'one MGET for the whole range');
  assert(lastCall(redis).commands[0].includes(`lifeuk:capped:${TODAY}`), 'SEC-01: the MGET reads the capped mark too');
  assert(failKeys(redis).length === 2 && failKeys(redis).every(k => !(redis.counts.get(k) > 0)),
    'a good login leaves no failure counted in either bucket (its reserved attempts are given back)');
  redis.counts.set(`lifeuk:capped:${TODAY}`, 1);
  const capped = fakeRes();
  await stats(statsReq(), capped);
  assert(capped.body.days[0].capped === true && same(capped.body.totals, res.body.totals),
    'SEC-01: a day with lifeuk:capped:<day> → capped: true (totals unchanged)');
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
  assert(mget.length - 1 === 366 * KEYS_PER_DAY && !mget.includes('lifeuk:open:2026-10-13'), 'MGET covers launch → today only');
  assert(res.body.totals.open === 4, 'pre-launch keys never counted');
}

async function checkStatsDays() {
  for (const [days, expected] of [[undefined, 30], ['0', 1], ['abc', 30], ['9999', 730], ['7', 7]]) {
    const redis = fakeRedis();
    await stats(statsReq(AUTH, days === undefined ? {} : { days }), fakeRes());
    const keys = lastCall(redis).commands[0].length - 1;
    assert(keys === expected * KEYS_PER_DAY, `days=${days} → ${expected} days (${keys} keys)`);
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
    ['fe80::1%eth0', 'fe80:0:0:0'], ['2001:db8:a:b:c:d:e:f', '2001:db8:a:b'], ['::', '0:0:0:0'],
    // S-293: a dotted IPv4 tail fills two groups
    ['1::3:4:5:6:1.2.3.4', '1:0:3:4'], ['1:0:3:4:5:6:1.2.3.4', '1:0:3:4'],
    // S-289: anything that is not a valid IPv4 / IPv6 address keeps its own bucket, as is
    ['1:2:3:4:5:6:7:8::9', '1:2:3:4:5:6:7:8::9'], ['1.2.3.4:5678', '1.2.3.4:5678'], ['[2001:db8::1]', '[2001:db8::1]'],
    ['[2001:db8::1]:443', '[2001:db8::1]:443'], ['zzzz::1', 'zzzz::1'], [':::::', ':::::'],
    ['::ffff:999.1.1.1', '::ffff:999.1.1.1'],
    // the hex form of IPv4-mapped is a valid IPv6 address: bucketed by its /64 (Vercel sends the dotted form)
    ['::ffff:0102:0304', '0:0:0:0'],
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
  assert(same(redis.calls[0].commands, [['INCR', clientKey], ['EXPIRE', clientKey, 3600]]) &&
    same(redis.calls[1].commands, [['INCR', GLOBAL_KEY], ['EXPIRE', GLOBAL_KEY, 3600]]),
    'W-384 / W-389: the client slot is reserved first, then the global one, each INCR atomic and expiring in an hour');
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
  const expected = codes.map((_, i) => (i < PER_CLIENT() ? 401 : 429));
  assert(same(codes, expected), `SEC-03: ${attempts} wrong logins from IP A → the first ${PER_CLIENT()} 401, the rest 429`);
  const owner = fakeRes();
  await stats(statsReq(fromIp('192.0.2.50')), owner);
  assert(owner.statusCode === 200, 'SEC-03: the owner on IP B with the right password → 200');
}

// W-389: a locked-out client never touches the global bucket, so even a parallel flood from one IP cannot crowd out the owner
async function checkStatsLockedClientNeverTouchesGlobal() {
  const redis = fakeRedis();
  const FLOOD = 300;
  const flood = Array.from({ length: FLOOD }, (_, i) => stats(wrongFrom('198.51.100.2', i), fakeRes()));
  const owner = fakeRes();
  const mid = stats(statsReq(fromIp('192.0.2.50')), owner); // sent while the flood is in flight
  await Promise.all([...flood, mid]);
  assert(owner.statusCode === 200, `W-389: during a parallel flood of ${FLOOD} from one IP the owner on another IP → 200`);
  assert(redis.counts.get(GLOBAL_KEY) === PER_CLIENT(), `the flood used only ${PER_CLIENT()} global slots`);
  const before = redis.calls.length;
  const locked = fakeRes();
  await stats(wrongFrom('198.51.100.2', 'late'), locked);
  const sent = redis.calls.slice(before).flatMap(c => c.commands);
  assert(locked.statusCode === 429 && sent.length <= 2 && sent.every(([, key]) => key !== GLOBAL_KEY),
    `a locked client's request: ${sent.length} Redis commands (≤ 2), none on the global key`);
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
  const ownerKey = clientKeys(redis).find(k => redis.calls.some(c => c.commands.some(([cmd, key]) => cmd === 'DECR' && key === k)));
  assert(ownerKey && redis.counts.get(ownerKey) === 0, 'and its client slot too (W-389 / S-290)');
}

// the buckets are per UTC hour: once the hour turns a locked-out client starts afresh
async function checkStatsLockoutHourTurns() {
  const redis = fakeRedis();
  const A = '203.0.113.8';
  for (let i = 0; i <= PER_CLIENT(); i++) await stats(wrongFrom(A, i), fakeRes());
  const locked = fakeRes();
  await stats(statsReq(fromIp(A)), locked);
  const [oldKey] = clientKeys(redis);
  const NEXT_HOUR = Date.UTC(2026, 9, 15, 0, 0, 1);
  Date.now = () => NEXT_HOUR;
  const before = redis.calls.length;
  const later = fakeRes();
  try {
    await stats(statsReq(fromIp(A)), later);
  } finally {
    Date.now = () => NOW;
  }
  const newKey = redis.calls[before].commands[0][1];
  assert(locked.statusCode === 429 && later.statusCode === 200, 'same IP: 429 before the hour turns, 200 with the right password after');
  assert(/^lifeuk:authfail:2026-10-15T00:[0-9a-f]{16}$/.test(newKey) && newKey !== oldKey,
    'the new hour uses a new client key');
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
  assert(checked === PER_CLIENT() && results.every(code => code === 401 || code === 429),
    `parallel burst of ${BURST}: exactly ${checked} password checks (= ${PER_CLIENT()}), the rest 429`);
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
  await checkTrackRedisDown();
  await checkKvEnvFallback();
  await checkTrackBudget();
  await checkTrackBudgetShortCircuit();
  await checkTrackBudgetPastCrossing();
  await checkTrackCappedSetFails();
  await checkTrackCrossingReplyLost();
  await checkStats();
  await checkStatsAllDays();
  await checkStatsDays();
  await checkStatsAuth();
  checkNormalizeIp();
  await checkStatsLockout();
  await checkStatsLockoutSec03();
  await checkStatsLockedClientNeverTouchesGlobal();
  await checkStatsLockoutGlobal();
  await checkStatsLockoutHourTurns();
  await checkStatsIpv6Buckets();
  await checkStatsClientIpHeaders();
  await checkStatsNoIpStored();
  await checkStatsLockoutBurst();
  await checkStatsRedisDown();
  Date.now = realNow;
  console.log(`PASS (${asserts} asserts)`);
})().catch(e => { console.error(e.message); process.exit(1); });
