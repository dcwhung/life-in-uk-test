const { chromium } = require('playwright-core');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startPagesServer, appFiles } = require('./pages-server');
// Service worker: registers from sw.js, caches the whole app shell, and the app opens offline.
// A service worker needs http(s), so this suite serves a copy of the app with a python3 static server
// (or uses APP_URL when that is an http(s) URL, e.g. the live site).
const ROOT = path.resolve(__dirname, '..');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };
const SW_SETTLE_TRIES = 40;
const SW_SETTLE_INTERVAL_MS = 250;
// W-017: python http.server answers If-Modified-Since to the second, so a bump written in the copy's second gets a 304
const BUMP_MTIME_AHEAD_S = 2;

// SHELL list from sw.js and every <script src> / <link href> from index.html
const swSource = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const SHELL = [...swSource.match(/const SHELL = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const pageFiles = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g), ...html.matchAll(/<link[^>]*\shref="([^"]+)"/g)].map(m => m[1]);

// version bump: only the imported config.js changes; the update must still install a new cache
// (updateViaCache: 'none') and drop the old lifeuk cache, but leave other apps' caches alone
async function checkVersionBump(pg, serveDir, oldCache) {
  const configPath = path.join(serveDir, 'js/core/config.js');
  const bumped = 'bump-test';
  fs.writeFileSync(configPath, fs.readFileSync(configPath, 'utf8').replace(/const APP_VERSION = '[^']*';/, `const APP_VERSION = '${bumped}';`));
  const bumpMtime = Date.now() / 1000 + BUMP_MTIME_AHEAD_S;
  fs.utimesSync(configPath, bumpMtime, bumpMtime);
  const poll = await pg.evaluate(async ([newCache, tries, intervalMs]) => {
    const reg = await navigator.serviceWorker.getRegistration();
    const settled = keys => keys.includes(newCache) && !keys.some(k => k.startsWith('lifeuk-v') && k !== newCache);
    const workerStates = () => Object.fromEntries(['installing', 'waiting', 'active'].map(k => [k, reg[k] ? reg[k].state : null]));
    // re-check for updates until the new worker has installed and activated (an update check can race the file write)
    for (let i = 0; i < tries; i++) {
      if (!reg.installing && !reg.waiting) await reg.update().catch(() => {});
      await new Promise(r => setTimeout(r, intervalMs));
      const keys = await caches.keys();
      if (settled(keys) && !reg.installing && !reg.waiting) return { settled: true, keys };
    }
    return { settled: false, keys: await caches.keys(), workers: workerStates() };
  }, ['lifeuk-v' + bumped, SW_SETTLE_TRIES, SW_SETTLE_INTERVAL_MS]);
  // S-063: the bump check has failed intermittently; log worker + cache state so the next failure carries evidence
  if (!poll.settled) console.log('diag: version bump did not settle —', JSON.stringify({ workers: poll.workers, caches: poll.keys }));
  const names = poll.keys;
  assert(names.includes('lifeuk-v' + bumped), 'version bump in config.js alone installs a new cache');
  assert(!names.includes(oldCache), `version bump removes the old cache (${oldCache})`);
  assert(names.includes('other-app'), "version bump leaves another app's cache alone");
  assert(poll.settled, `version bump: new worker activates within ${SW_SETTLE_TRIES} × ${SW_SETTLE_INTERVAL_MS}ms`);
}

(async () => {
  // ── static: nothing the page loads can be missing from the offline cache ──
  const missing = pageFiles.filter(f => !SHELL.includes(f));
  assert(pageFiles.length > 10 && missing.length === 0, `every <script src> / <link href> in index.html is in sw.js SHELL${missing.length ? ' — missing: ' + missing.join(', ') : ''}`);
  const absent = SHELL.filter(f => f !== './' && !fs.existsSync(path.join(ROOT, f)));
  assert(absent.length === 0, `every SHELL entry exists on disk${absent.length ? ' — absent: ' + absent.join(', ') : ''}`);
  assert(SHELL.includes('./') && SHELL.includes('index.html'), 'SHELL has ./ and index.html');

  const external = /^https?:/.test(process.env.APP_URL || '');
  let server = null;
  let base = external ? process.env.APP_URL.replace(/index\.html$/, '') : null;
  // serve a temp copy of the app so the version-bump check can edit its config.js
  const serveDir = external ? null : fs.mkdtempSync(path.join(os.tmpdir(), 'lifeuk-sw-'));
  if (!external) {
    appFiles(ROOT).forEach(f => fs.cpSync(path.join(ROOT, f), path.join(serveDir, f), { recursive: true }));
    ({ base, server } = await startPagesServer(serveDir));
  }
  const b = await chromium.launch(launchOpts);
  try {
    const ctx = await b.newContext();
    const pg = await ctx.newPage();
    const errs = [];
    pg.on('pageerror', e => errs.push(e.message));
    // the browser's own /favicon.ico probe 404s on the static server; that is not an app error
    pg.on('console', m => {
      if ((m.type() === 'error' || /SW error/.test(m.text())) && !/favicon\.ico/.test(m.location().url)) errs.push(m.text());
    });
    // another app's cache on the same origin (GitHub Pages user site) must survive our activation
    await pg.goto(base + 'sw.js');
    // S-003: it also holds a same-origin URL this app loads; our fetch handler must only read our own cache
    await pg.evaluate(async poisoned => {
      const c = await caches.open('other-app');
      await c.put('/other', new Response('x'));
      await c.put(poisoned, new Response('window.__foreignCacheServed = true;', { headers: { 'Content-Type': 'text/javascript' } }));
    }, base + 'js/main.js');
    await pg.goto(base);

    // ── registration + cache ──
    const sw = await pg.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return { scope: reg.scope, script: reg.active && reg.active.scriptURL };
    });
    assert(sw.script === base + 'sw.js' && sw.scope === base, 'sw.js registered and active for the app scope');
    const cache = await pg.evaluate(async () => {
      const name = 'lifeuk-v' + APP_VERSION;
      const c = await caches.open(name);
      return { name, urls: (await c.keys()).map(r => r.url), names: await caches.keys() };
    });
    assert(cache.names.includes(cache.name), `cache named from APP_VERSION (${cache.name})`);
    const notCached = SHELL.map(f => new URL(f, base).href).filter(u => !cache.urls.includes(u));
    assert(notCached.length === 0, `all ${SHELL.length} SHELL entries cached${notCached.length ? ' — not cached: ' + notCached.join(', ') : ''}`);
    assert(cache.names.includes('other-app'), "another app's cache on the origin survives activation");

    // ── offline reload: the app still opens on the home screen ──
    await pg.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await pg.reload();
    assert(await pg.evaluate(() => navigator.serviceWorker.controller !== null && window.__foreignCacheServed === undefined), "fetch never serves another app's cache entry for our URL (S-003)");
    await ctx.setOffline(true);
    await pg.reload();
    assert(await pg.evaluate(() => document.getElementById('screenHome').classList.contains('active')), 'offline reload shows the home screen');
    assert(await pg.$$eval('#examGrid .exam-btn', els => els.length) > 1, 'offline: exam grid rendered (scripts came from the cache)');
    assert(await pg.$eval('.mode-card', e => getComputedStyle(e).borderTopStyle === 'solid'), 'offline: stylesheets came from the cache');
    await pg.evaluate(() => { pendingMode = 'practice'; startExam(1); });
    assert(await pg.$$eval('#optionsContainer .opt', els => els.length) > 1, 'offline: a practice set starts');
    assert(errs.length === 0, 'no page errors, console errors or SW errors' + (errs.length ? ': ' + errs.join(' / ') : ''));
    await ctx.setOffline(false);
    if (!external) await checkVersionBump(pg, serveDir, cache.name);
    await ctx.close();
  } finally {
    await b.close();
    if (server) server.kill();
    if (serveDir) fs.rmSync(serveDir, { recursive: true, force: true });
  }
  console.log('SW PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
