const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');
// Service worker: registers from sw.js, caches the whole app shell, and the app opens offline.
// A service worker needs http(s), so this suite serves the repo with `python3 -m http.server`
// (or uses APP_URL when that is an http(s) URL, e.g. the live site).
const ROOT = path.resolve(__dirname, '..');
const PORT = 8700 + Math.floor(Math.random() * 200);
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

// SHELL list from sw.js and every <script src> / <link href> from index.html
const swSource = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const SHELL = [...swSource.match(/const SHELL = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const pageFiles = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g), ...html.matchAll(/<link[^>]*\shref="([^"]+)"/g)].map(m => m[1]);

const waitForServer = url => new Promise((resolve, reject) => {
  const started = Date.now();
  const ping = () => http.get(url, res => { res.resume(); resolve(); }).on('error', () => {
    if (Date.now() - started > 10000) reject(new Error('http.server did not start')); else setTimeout(ping, 100);
  });
  ping();
});

(async () => {
  // ── static: nothing the page loads can be missing from the offline cache ──
  const missing = pageFiles.filter(f => !SHELL.includes(f));
  assert(pageFiles.length > 10 && missing.length === 0, `every <script src> / <link href> in index.html is in sw.js SHELL${missing.length ? ' — missing: ' + missing.join(', ') : ''}`);
  const absent = SHELL.filter(f => f !== './' && !fs.existsSync(path.join(ROOT, f)));
  assert(absent.length === 0, `every SHELL entry exists on disk${absent.length ? ' — absent: ' + absent.join(', ') : ''}`);
  assert(SHELL.includes('./') && SHELL.includes('index.html'), 'SHELL has ./ and index.html');

  const external = /^https?:/.test(process.env.APP_URL || '');
  let server = null;
  const base = external ? process.env.APP_URL.replace(/index\.html$/, '') : `http://127.0.0.1:${PORT}/`;
  if (!external) {
    server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
    await waitForServer(base);
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

    // ── offline reload: the app still opens on the home screen ──
    await pg.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await ctx.setOffline(true);
    await pg.reload();
    assert(await pg.evaluate(() => document.getElementById('screenHome').classList.contains('active')), 'offline reload shows the home screen');
    assert(await pg.$$eval('#examGrid .exam-btn', els => els.length) > 1, 'offline: exam grid rendered (scripts came from the cache)');
    assert(await pg.$eval('.mode-card', e => getComputedStyle(e).borderTopStyle === 'solid'), 'offline: stylesheets came from the cache');
    await pg.evaluate(() => { pendingMode = 'practice'; startExam(1); });
    assert(await pg.$$eval('#optionsContainer .opt', els => els.length) > 1, 'offline: a practice set starts');
    assert(errs.length === 0, 'no page errors, console errors or SW errors' + (errs.length ? ': ' + errs.join(' / ') : ''));
    await ctx.close();
  } finally {
    await b.close();
    if (server) server.kill();
  }
  console.log('SW PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
