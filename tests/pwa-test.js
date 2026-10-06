const { chromium } = require('playwright-core');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startPagesServer } = require('./pages-server');
// App icon (CUI-0001): favicon + apple-touch-icon resolve, no 404 on page load.
// Web manifest (CUI-0002): fetched + parsed, required fields, icons at their declared sizes, Chrome sees
// no manifest / installability errors, and the existing beforeinstallprompt banner still works.
// Served over http (python static server on the repo root, read-only) or APP_URL when that is http(s).
const ROOT = path.resolve(__dirname, '..');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };
const APPLE_TOUCH_SIZE = 180;
const FAVICON_SETTLE_MS = 1500;
const NAVY = fs.readFileSync(path.join(ROOT, 'css/base/tokens.css'), 'utf8').match(/--navy:\s*(#[0-9a-f]{6})/i)[1];
const EXPECTED_MANIFEST = {
  name: 'Life in the UK Test', short_name: 'Life in UK', start_url: './', scope: './',
  display: 'standalone', background_color: NAVY, theme_color: NAVY,
};
const REQUIRED_ICONS = [
  { sizes: '192x192', purpose: 'any' },
  { sizes: '512x512', purpose: 'any' },
  { sizes: '512x512', purpose: 'maskable' },
];

// decode an image in the page and return its natural size (0 x 0 when it fails to load)
const imageSize = (pg, url) => pg.evaluate(src => new Promise(resolve => {
  const img = new Image();
  img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
  img.onerror = () => resolve({ w: 0, h: 0 });
  img.src = src;
}), url);

// every <link rel=…> in the head as { rel, href (absolute), type, sizes }
const headLinks = pg => pg.$$eval('head link[rel]', els => els.map(e => ({
  rel: e.rel, href: e.href, type: e.type, sizes: e.getAttribute('sizes'),
})));

async function checkFavicon(pg, links, request) {
  const icons = links.filter(l => l.rel === 'icon');
  const svg = icons.find(l => l.type === 'image/svg+xml');
  const png = icons.find(l => l.type === 'image/png');
  assert(svg && png, `<link rel="icon"> has an SVG and a PNG fallback (${icons.map(l => l.type).join(', ') || 'none'})`);
  for (const icon of [svg, png]) {
    const res = await request.get(icon.href);
    assert(res.status() === 200, `${icon.href.replace(/.*\//, '')} loads with 200 (${res.status()})`);
  }
  assert((await imageSize(pg, svg.href)).w > 0, 'SVG favicon decodes as an image');
  const pngSize = await imageSize(pg, png.href);
  assert(pngSize.w > 0 && `${pngSize.w}x${pngSize.h}` === png.sizes, `PNG favicon is ${png.sizes} (${pngSize.w}x${pngSize.h})`);
  const apple = links.find(l => l.rel === 'apple-touch-icon');
  const appleSize = apple ? await imageSize(pg, apple.href) : { w: 0, h: 0 };
  assert(appleSize.w === APPLE_TOUCH_SIZE && appleSize.h === APPLE_TOUCH_SIZE, `apple-touch-icon is ${APPLE_TOUCH_SIZE}x${APPLE_TOUCH_SIZE} (${appleSize.w}x${appleSize.h})`);
}

// manifest JSON from the <link rel="manifest"> href; fields + every icon checked against the files
async function checkManifest(pg, links, request) {
  const link = links.find(l => l.rel === 'manifest');
  assert(link, 'index.html has <link rel="manifest">');
  const res = await request.get(link.href);
  assert(res.status() === 200, `manifest loads with 200 (${res.status()})`);
  const manifest = JSON.parse(await res.text());
  const wrong = Object.keys(EXPECTED_MANIFEST).filter(k => manifest[k] !== EXPECTED_MANIFEST[k]);
  assert(wrong.length === 0, 'manifest is valid JSON with name, short_name, start_url, scope, display, colours' + (wrong.length ? ' — wrong: ' + wrong.map(k => `${k}=${manifest[k]}`).join(', ') : ''));
  const metaTheme = await pg.$eval('meta[name="theme-color"]', e => e.content);
  assert(metaTheme.toLowerCase() === NAVY.toLowerCase(), `theme-color meta is the header navy (${metaTheme})`);
  const icons = manifest.icons || [];
  const missing = REQUIRED_ICONS.filter(r => !icons.some(i => i.sizes === r.sizes && (i.purpose || 'any') === r.purpose));
  assert(missing.length === 0, 'manifest has 192 + 512 icons and a 512 maskable' + (missing.length ? ' — missing: ' + missing.map(r => r.sizes + ' ' + r.purpose).join(', ') : ''));
  for (const icon of icons) {
    const url = new URL(icon.src, link.href).href;
    const size = await imageSize(pg, url);
    assert(`${size.w}x${size.h}` === icon.sizes, `manifest icon ${icon.src} loads at ${icon.sizes} (${size.w}x${size.h})`);
  }
}

// Chrome's own view: the manifest parses cleanly and nothing blocks installation
async function checkInstallable(pg) {
  await pg.evaluate(() => navigator.serviceWorker.ready);
  const cdp = await pg.context().newCDPSession(pg);
  const { errors } = await cdp.send('Page.getAppManifest');
  assert(errors.length === 0, 'Chrome parses the manifest without errors' + (errors.length ? ': ' + errors.map(e => e.message).join(' / ') : ''));
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  const ids = installabilityErrors.map(e => e.errorId);
  assert(ids.length === 0, 'Chrome reports no installability errors' + (ids.length ? ': ' + ids.join(', ') : ''));
}

// js/pwa/pwa.js: a beforeinstallprompt shows the banner; Install prompts and an accepted choice hides it
async function checkInstallBanner(pg) {
  const shown = await pg.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = () => { window.__installPrompted = true; };
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);
    return byId('installBanner').classList.contains('visible');
  });
  assert(shown, 'beforeinstallprompt shows the install banner');
  await pg.evaluate(() => promptInstall());
  const after = await pg.evaluate(() => ({ prompted: window.__installPrompted === true, visible: byId('installBanner').classList.contains('visible') }));
  assert(after.prompted && !after.visible, 'Install calls prompt() and an accepted choice hides the banner');
}

(async () => {
  const external = /^https?:/.test(process.env.APP_URL || '');
  let server = null;
  let base = external ? process.env.APP_URL.replace(/index\.html$/, '') : null;
  if (!external) ({ base, server } = await startPagesServer(ROOT));
  // a persistent profile: Chrome never treats an incognito context (browser.newContext) as installable
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeuk-pwa-'));
  const ctx = await chromium.launchPersistentContext(profileDir, launchOpts);
  try {
    const pg = ctx.pages()[0] || await ctx.newPage();
    const failed = [];
    pg.on('response', r => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
    pg.on('requestfailed', r => failed.push('failed ' + r.url()));
    await pg.goto(base);
    await pg.waitForTimeout(FAVICON_SETTLE_MS);
    assert(failed.length === 0, 'page load has no 404 / failed requests (favicon included)' + (failed.length ? ': ' + failed.join(' / ') : ''));
    const links = await headLinks(pg);
    await checkFavicon(pg, links, ctx.request);
    await checkManifest(pg, links, ctx.request);
    await checkInstallable(pg);
    await checkInstallBanner(pg);
  } finally {
    await ctx.close();
    if (server) server.kill();
    fs.rmSync(profileDir, { recursive: true, force: true });
  }
  console.log('PWA PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
