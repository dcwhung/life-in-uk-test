// v2.7.0 usage counter, client side (js/core/telemetry.js). Node only: config.js + utils.js + telemetry.js run in one
// vm context (as in a page) with an in-memory localStorage and stubbed window / navigator / location, so every launch
// case (host, standalone, offline, second open on the same day) is checked without a browser.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const APP_FILES = ['js/core/config.js', 'js/core/utils.js', 'js/core/telemetry.js'];
const PROD_HOST = 'life-uk.vercel.app';
const DAY_LS = 'lifeuk.telemetryDay';
const DAY_1 = new Date(2026, 9, 14, 9, 0);
const DAY_1_LATER = new Date(2026, 9, 14, 23, 30);
const DAY_2 = new Date(2026, 9, 15, 0, 5);

let asserts = 0;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); asserts++; console.log('ok:', m); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function memoryStorage() {
  const data = new Map();
  return {
    getItem: k => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: k => { data.delete(k); },
    key: i => [...data.keys()][i] ?? null,
    get length() { return data.size; },
  };
}
// host / display mode / online state of the fake page; beacons records every sendBeacon call
function loadApp({ host = PROD_HOST, standalone = false, iosStandalone = false, online = true, beacon = true } = {}) {
  const beacons = [];
  const navigator = { onLine: online };
  if (iosStandalone) navigator.standalone = true;
  if (beacon) navigator.sendBeacon = (url, body) => { beacons.push({ url, body: JSON.parse(body) }); return true; };
  const window = { matchMedia: q => ({ matches: standalone && q === '(display-mode: standalone)' }) };
  const storage = memoryStorage();
  const ctx = vm.createContext({ localStorage: storage, console, navigator, window, location: { hostname: host } });
  for (const f of APP_FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  return { beacons, storage, g: code => vm.runInContext(code, ctx), ctx };
}
const eventsOf = app => app.beacons.map(b => b.body.events);

// ── launchEvents(): the pure rule ──
function checkLaunchEvents() {
  const { g } = loadApp();
  assert(same(g("launchEvents({ today: '2026-10-14', lastDay: null, standalone: false })"), ['open', 'dau']),
    'first launch ever: open + dau');
  assert(same(g("launchEvents({ today: '2026-10-14', lastDay: '2026-10-14', standalone: false })"), ['open']),
    'second launch the same day: open only');
  assert(same(g("launchEvents({ today: '2026-10-15', lastDay: '2026-10-14', standalone: true })"), ['open', 'standalone', 'dau']),
    'installed app on a new day: open + standalone + dau');
}

// ── reportLaunch(): one beacon per load, dau once per local day ──
function checkReportLaunch() {
  const app = loadApp();
  app.g(`reportLaunch(new Date(${DAY_1.getTime()}))`);
  app.g(`reportLaunch(new Date(${DAY_1_LATER.getTime()}))`);
  app.g(`reportLaunch(new Date(${DAY_2.getTime()}))`);
  assert(same(eventsOf(app), [['open', 'dau'], ['open'], ['open', 'dau']]), 'dau counted once per local day, open on every launch');
  assert(app.beacons.every(b => b.url === '/api/track'), 'beacons go to /api/track (same origin)');
  assert(JSON.parse(app.storage.getItem(DAY_LS)) === '2026-10-15', `${DAY_LS} holds the last reported local day`);
}

function checkStandalone() {
  const android = loadApp({ standalone: true });
  android.g('reportLaunch()');
  assert(same(eventsOf(android), [['open', 'standalone', 'dau']]), 'display-mode standalone → standalone event');
  const ios = loadApp({ iosStandalone: true });
  ios.g('reportLaunch()');
  assert(same(eventsOf(ios), [['open', 'standalone', 'dau']]), 'iOS navigator.standalone → standalone event');
}

// user decision 2026-10-14 (option c): only the Vercel production host counts; GitHub Pages, previews and localhost never send
function checkHostGate() {
  for (const host of ['dcwhung.github.io', 'localhost', 'life-uk-git-feature-x.vercel.app']) {
    const app = loadApp({ host });
    app.g('reportLaunch()');
    app.g('reportInstall()');
    assert(app.beacons.length === 0 && app.storage.getItem(DAY_LS) === null, `${host}: nothing sent, nothing stored`);
  }
}

// offline: nothing sent and the day stays unreported, so the next online launch still counts it
function checkOffline() {
  const app = loadApp({ online: false });
  app.g('reportLaunch()');
  assert(app.beacons.length === 0 && app.storage.getItem(DAY_LS) === null, 'offline: nothing sent, day not marked');
  const noBeacon = loadApp({ beacon: false });
  noBeacon.g('reportLaunch()');
  assert(noBeacon.storage.getItem(DAY_LS) === null, 'no sendBeacon: day not marked, no error');
}

function checkInstall() {
  const app = loadApp();
  app.g('reportInstall()');
  assert(same(eventsOf(app), [['install']]), 'reportInstall sends install only');
  assert(app.storage.getItem(DAY_LS) === null, 'install does not touch the dau day');
}

// a throwing sendBeacon (rare browser bugs) must never break app start
function checkBeaconThrows() {
  const app = loadApp();
  app.ctx.navigator.sendBeacon = () => { throw new Error('boom'); };
  app.g('reportLaunch()');
  assert(app.storage.getItem(DAY_LS) === null, 'throwing sendBeacon: swallowed, day not marked');
}

// the server whitelist (api/_lib/events.js) and the client events are the same set
function checkEventParity() {
  const { g } = loadApp();
  const client = Object.values(g('TELEMETRY_EVENTS')).sort();
  const server = [...require(path.join(ROOT, 'api/_lib/events.js')).EVENTS].sort();
  assert(same(client, server), `client and server event names match (${client.join(', ')})`);
}

// wiring: main.js reports the launch, pwa.js reports appinstalled, the script is in index.html and the SW shell
function checkWiring() {
  const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
  assert(/reportLaunch\(\)/.test(read('js/main.js')), 'main.js calls reportLaunch()');
  assert(/function onAppInstalled\(\) \{[\s\S]*?reportInstall\(\)[\s\S]*?\n\}/.test(read('js/pwa/pwa.js')), 'onAppInstalled calls reportInstall()');
  assert(read('index.html').includes('<script src="js/core/telemetry.js"></script>'), 'index.html loads telemetry.js');
  assert(read('sw.js').includes("'js/core/telemetry.js'"), 'sw.js SHELL caches telemetry.js');
}

checkLaunchEvents();
checkReportLaunch();
checkStandalone();
checkHostGate();
checkOffline();
checkInstall();
checkBeaconThrows();
checkEventParity();
checkWiring();
console.log(`PASS (${asserts} asserts)`);
