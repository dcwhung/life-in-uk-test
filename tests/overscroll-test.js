const { chromium } = require('playwright-core');
const path = require('path');
// v1.4.3: at the top of the page a pull-down (iOS rubber-band, installed PWA) used to drag the whole document, sticky
// header included, and showed the light page background between the navy status bar and the navy header. The root
// no longer bounces (overscroll-behavior-y: none) and, where a bounce still happens, the gap above the document is navy.
// The bounce is simulated by moving the document down / up (transform on <html>): headless Chromium does not rubber-band.
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

const WIDTH = 390;
const PHONE = { width: WIDTH, height: 844 };
const TALL = { width: WIDTH, height: 3000 }; // taller than the Home screen: a "short page"
const PULL_PX = 300; // the gap the user saw
const EDGE_PX = 20; // rows sampled at the bottom edge of the viewport
const SHADOW_PX = 16; // the header's box-shadow blur (--shadow-header) bleeds into the rows just above it

const tokens = pg => pg.evaluate(() => {
  const css = getComputedStyle(document.documentElement);
  const probe = document.createElement('i');
  document.body.appendChild(probe);
  const rgb = v => { probe.style.color = v; return getComputedStyle(probe).color; };
  const out = { navy: rgb(css.getPropertyValue('--navy').trim()), bg: rgb(css.getPropertyValue('--bg').trim()) };
  probe.remove();
  return out;
});

// every distinct rgb() colour in a screenshot clip (decoded with a canvas in the page)
async function coloursIn(pg, clip) {
  const b64 = (await pg.screenshot({ clip })).toString('base64'); // a Buffer: no file is written
  return pg.evaluate(async src => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + src;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const seen = new Set();
    for (let i = 0; i < d.length; i += 4) seen.add(`rgb(${d[i]}, ${d[i + 1]}, ${d[i + 2]})`);
    return [...seen];
  }, b64);
}
const shift = (pg, px) => pg.evaluate(y => { document.documentElement.style.transform = y ? `translateY(${y}px)` : ''; }, px);
const only = (cols, want) => cols.length === 1 && cols[0] === want;

async function checkRoot(pg, tk) {
  const r = await pg.evaluate(() => {
    const scroller = document.createElement('div');
    scroller.className = 'plan-day-scroll';
    document.body.appendChild(scroller);
    const inner = getComputedStyle(scroller).overscrollBehaviorY;
    scroller.remove();
    return {
      root: getComputedStyle(document.documentElement).overscrollBehaviorY,
      body: getComputedStyle(document.body).backgroundColor,
      inner,
    };
  });
  assert(r.root === 'none', 'html overscroll-behavior-y: none (no root bounce): ' + r.root);
  assert(r.body === tk.bg, 'body background stays --bg: ' + r.body);
  assert(r.inner === 'contain', '.plan-day-scroll still overscroll-behavior: contain: ' + r.inner);
}

async function checkPullDown(pg, tk) {
  await pg.evaluate(() => window.scrollTo(0, 0));
  await shift(pg, PULL_PX);
  const gap = await coloursIn(pg, { x: 0, y: 0, width: WIDTH, height: PULL_PX - SHADOW_PX });
  await shift(pg, 0);
  assert(only(gap, tk.navy), 'pull-down at the top: the gap above the header is navy: ' + gap.slice(0, 5).join(' / '));
}

async function checkPullUp(pg, tk, vp) {
  await pg.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await shift(pg, -PULL_PX);
  const gap = await coloursIn(pg, { x: 0, y: vp.height - PULL_PX, width: WIDTH, height: PULL_PX });
  await shift(pg, 0);
  assert(only(gap, tk.bg), 'pull-up at the bottom: the gap below the content is --bg, not navy: ' + gap.slice(0, 5).join(' / '));
}

async function checkBottomEdge(pg, tk, vp, label) {
  await pg.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const edge = await coloursIn(pg, { x: 0, y: vp.height - EDGE_PX, width: WIDTH, height: EDGE_PX });
  assert(only(edge, tk.bg), `${label}: the bottom of the viewport is --bg, no navy band: ` + edge.slice(0, 5).join(' / '));
}

async function checkSticky(pg) {
  const top = await pg.evaluate(async () => {
    window.scrollTo(0, 500);
    await new Promise(r => requestAnimationFrame(r));
    return { y: window.scrollY, top: document.querySelector('header').getBoundingClientRect().top };
  });
  assert(top.y > 0 && top.top === 0, 'header stays pinned at top 0 after scrolling: ' + JSON.stringify(top));
}

(async () => {
  const b = await chromium.launch(launchOpts);
  const errs = [];
  const open = async vp => {
    const pg = await b.newPage({ viewport: vp });
    pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(APP_URL);
    await pg.waitForSelector('#examGrid *', { state: 'attached' });
    return pg;
  };

  const phone = await open(PHONE);
  const tk = await tokens(phone);
  const long = await phone.evaluate(h => document.documentElement.scrollHeight > h, PHONE.height);
  assert(long, 'Home at 390x844 is a long page (scrolls)');
  await checkPullDown(phone, tk);
  await checkRoot(phone, tk);
  await checkPullUp(phone, tk, PHONE);
  await checkBottomEdge(phone, tk, PHONE, 'long page scrolled to the end');
  await checkSticky(phone);

  const tall = await open(TALL);
  const short = await tall.evaluate(h => document.documentElement.scrollHeight <= h, TALL.height);
  assert(short, 'Home at 390x3000 is a short page (no scroll)');
  await checkBottomEdge(tall, tk, TALL, 'short page');
  await checkPullDown(tall, tk);
  await checkPullUp(tall, tk, TALL);

  assert(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close();
  console.log('OVERSCROLL PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
