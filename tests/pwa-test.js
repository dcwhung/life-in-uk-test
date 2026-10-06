const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const { startPagesServer } = require('./pages-server');
// App icon (CUI-0001): favicon + apple-touch-icon resolve, no 404 on page load.
// Served over http (python static server on the repo root, read-only) or APP_URL when that is http(s).
const ROOT = path.resolve(__dirname, '..');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };
const APPLE_TOUCH_SIZE = 180;
const FAVICON_SETTLE_MS = 1500;

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

(async () => {
  const external = /^https?:/.test(process.env.APP_URL || '');
  let server = null;
  let base = external ? process.env.APP_URL.replace(/index\.html$/, '') : null;
  if (!external) ({ base, server } = await startPagesServer(ROOT));
  const b = await chromium.launch(launchOpts);
  try {
    const ctx = await b.newContext();
    const pg = await ctx.newPage();
    const failed = [];
    pg.on('response', r => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
    pg.on('requestfailed', r => failed.push('failed ' + r.url()));
    await pg.goto(base);
    await pg.waitForTimeout(FAVICON_SETTLE_MS);
    assert(failed.length === 0, 'page load has no 404 / failed requests (favicon included)' + (failed.length ? ': ' + failed.join(' / ') : ''));
    const links = await headLinks(pg);
    await checkFavicon(pg, links, ctx.request);
    await ctx.close();
  } finally {
    await b.close();
    if (server) server.kill();
  }
  console.log('PWA PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
