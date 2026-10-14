// v2.5.0: loading splash + first-run intro (js/components/splash.js, js/screens/intro.js; mockup
// mockups/v2.2.0/intro-b-cards.html). Both skip automated browsers (navigator.webdriver) and file://, so this suite serves
// the app over http and switches navigator.webdriver off; Math.random is pinned to choose the splash animation.
const { chromium } = require('playwright-core');
const path = require('path');
const { execSync } = require('child_process');
const { startPagesServer } = require('./pages-server');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const ROOT = path.resolve(__dirname, '..');
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };
const FAN_RANDOM = 0.1;   // 0.1 × (3 + 1) = 0.4 → the first weight: card fan
const RING_RANDOM = 0.9;  // 3.6 → past the fan's 3: progress ring
const FAN_MIN_MS = 3100;  // SPLASH_ANIM_MS (js/core/config.js): the app opens only after the animation
const RING_MIN_MS = 4000;
const OPEN_TIMEOUT_MS = 8000;
const EDGE_PAD_PX = 20;   // --intro-edge-pad
const EDGE_TOL_PX = 1;
const SWIPE_PX = 120;
const ART_SHARE = 0.55;
const MAX_OVERLAP_PCT = 25; // v2.5.2: two illustration pieces may share at most this much of the smaller one (tilted corners)   // the illustration's share of a phone card (css/screens/intro.css)
const FAILSAFE_WAIT_MS = 12000;  // --splash-failsafe 10s + slack
const PRE_SPLASH_REF = '73822f9'; // main v2.4.2 merged in: its js/main.js never calls the splash (C-008 mixed cache)
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

// a real-user page: not automated, a fixed Math.random, nothing stored
async function userPage(b, viewport, random) {
  const ctx = await b.newContext({ viewport });
  await ctx.addInitScript(r => {
    Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false });
    Math.random = () => r;
  }, random);
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  return { pg, ctx, errs };
}
// load, then time how long until the intro (or Home without a splash) is reachable
async function loadAndTime(pg, url) {
  await pg.goto(url);
  const t0 = await pg.evaluate(() => performance.now());
  const kind = await pg.$eval('#splash', el => el.dataset.anim);
  await pg.waitForFunction(() => !document.getElementById('splash'), null, { timeout: OPEN_TIMEOUT_MS });
  const t1 = await pg.evaluate(() => performance.now());
  return { kind, ms: t1 - t0 };
}
const introState = pg => pg.evaluate(() => {
  const root = document.getElementById('introOverlay');
  if (!root) return null;
  const front = root.querySelector('.intro-card[data-pos="0"]');
  return {
    step: root.querySelector('.intro-step').textContent, front: front && front.dataset.i,
    nextHidden: root.querySelector('.intro-next').hidden, ctasHidden: root.querySelector('.intro-ctas').hidden,
    skipGone: root.querySelector('.intro-skip').classList.contains('gone'), title: front && front.querySelector('.intro-title').textContent,
  };
});
// every scattered piece of the front card sits ≥ 20px inside its illustration
const piecesInside = pg => pg.evaluate(([pad, tol]) => {
  const art = document.querySelector('#introOverlay .intro-card[data-pos="0"] .intro-art');
  const box = art.getBoundingClientRect();
  return [...art.querySelectorAll('.intro-piece')].every(el => {
    const r = el.getBoundingClientRect();
    return r.left >= box.left + pad - tol && r.right <= box.right - pad + tol && r.top >= box.top + pad - tol && r.bottom <= box.bottom - pad + tol;
  });
}, [EDGE_PAD_PX, EDGE_TOL_PX]);
const noSideScroll = pg => pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

async function checkFirstRun(b, base) {
  const { pg, ctx, errs } = await userPage(b, PHONE, FAN_RANDOM);
  const t = await loadAndTime(pg, base);
  assert(t.kind === 'fan', 'Math.random 0.1 draws the card fan: ' + t.kind);
  assert(t.ms >= FAN_MIN_MS - 200, `the app waits for the fan to finish (${Math.round(t.ms)}ms ≥ ~${FAN_MIN_MS}ms)`);
  let s = await introState(pg);
  assert(s && s.step === '1 / 3' && s.front === '0' && !s.nextHidden && s.ctasHidden && !s.skipGone, 'first run: the intro opens on card 1 of 3 with Next + Skip: ' + JSON.stringify(s));
  assert(await piecesInside(pg), 'card 1: every illustration piece stays ≥ 20px inside its box');
  const fit = await cardsFit(pg);
  assert(fit.every(c => c.half && c.textFits), 'phone: every illustration ≤ 55% of the card and every card text fits: ' + JSON.stringify(fit));
  const over = await worstOverlap(pg);
  assert(over <= MAX_OVERLAP_PCT, `phone: illustration pieces do not pile up (worst overlap ${over}% ≤ ${MAX_OVERLAP_PCT}%)`);
  assert(await pg.evaluate(() => document.documentElement.classList.contains('intro-open') && getComputedStyle(document.body).overflow === 'hidden'), 'the page under the intro does not scroll');
  await pg.click('#introOverlay .intro-next');
  s = await introState(pg);
  assert(s.step === '2 / 3' && s.front === '1', 'Next turns to card 2');
  assert(await pg.$$eval('#introOverlay .p2 .intro-opt', els => els.map(e => e.querySelector('.intro-opt-letter').textContent).join('')) === 'ABCD', 'card 2: the sample question shows options A–D');
  assert(await pg.$$eval('#introOverlay .p2 .intro-sim-nodes span', els => els.length) >= 2, 'card 2: the similar-question card lists real nodes');
  await swipe(pg, -SWIPE_PX);
  assert((await introState(pg)).front === '2', 'a left swipe turns to card 3');
  await swipe(pg, SWIPE_PX);
  assert((await introState(pg)).front === '1', 'a right swipe goes back');
  await pg.click('#introOverlay .intro-dots button:nth-child(3)');
  s = await introState(pg);
  assert(s.step === '3 / 3' && s.nextHidden && !s.ctasHidden && s.skipGone, 'the third dot opens the last card: the two ways in, no Skip');
  await checkLastCardSettings(pg);
  await pg.click('#introOverlay [data-arg="start"]');
  assert(!(await introState(pg)) && await pg.evaluate(() => localStorage.getItem('lifeuk.introSeen')) === 'true', 'Start now closes it and stores lifeuk.introSeen');
  assert(await pg.$eval('#screenHome', el => el.classList.contains('active')), 'Home is underneath');
  await pg.reload();
  await pg.waitForFunction(() => !document.getElementById('splash'), null, { timeout: OPEN_TIMEOUT_MS });
  await pg.waitForTimeout(300);
  assert(!(await introState(pg)), 'next launch: the splash, then no intro');
  assert(errs.length === 0, 'no page errors: ' + errs.join(' / '));
  await ctx.close();
}
async function swipe(pg, dx) {
  const box = await pg.$eval('#introOverlay .intro-stack', el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await pg.mouse.move(box.x, box.y);
  await pg.mouse.down();
  await pg.mouse.move(box.x + dx, box.y, { steps: 4 });
  await pg.mouse.up();
}
// language + Cantonese translation on the last card apply at once
async function checkLastCardSettings(pg) {
  const zhTitle = (await introState(pg)).title;
  await pg.click('#introOverlay [data-action="introLang"][data-arg="en"]');
  const s = await introState(pg);
  assert(s.front === '2' && s.title !== zhTitle && /pass first time/i.test(s.title), 'EN switches the intro language in place: ' + s.title);
  assert(await pg.evaluate(() => document.documentElement.lang === 'en' && localStorage.getItem('lifeuk.uiLang') === '"en"'), 'the app language is now English');
  await pg.click('#introYueSwitch');
  const off = await pg.evaluate(() => ({ aria: byId('introYueSwitch').getAttribute('aria-checked'), html: document.documentElement.dataset.translation }));
  assert(off.aria === 'false' && off.html === 'off', 'the switch turns Cantonese translation off: ' + JSON.stringify(off));
  await pg.click('#introYueSwitch');
}
// ⓘ replay; Esc = skip; "Make a study plan" opens the goal form
async function checkReplayAndPlan(b, base) {
  const { pg, ctx, errs } = await userPage(b, PHONE, FAN_RANDOM);
  await ctx.addInitScript(() => { if (!localStorage.getItem('lifeuk.introSeen')) localStorage.setItem('lifeuk.introSeen', 'true'); });
  await loadAndTime(pg, base);
  assert(!(await introState(pg)), 'introSeen stored: no intro on launch');
  await pg.click('#infoBtn');
  assert(await pg.$eval('#infoPop .info-replay', el => getComputedStyle(el).display !== 'none'), 'ⓘ shows the Replay intro row');
  await pg.click('#infoPop .info-replay');
  assert((await introState(pg)).step === '1 / 3' && !(await pg.$eval('#infoPop', el => el.classList.contains('show'))), 'Replay intro closes ⓘ and opens card 1');
  await pg.keyboard.press('ArrowRight');
  assert((await introState(pg)).front === '1', '→ turns the page');
  assert(await pg.evaluate(() => document.querySelector('header').inert && !document.getElementById('introOverlay').inert), 'W-088: while open, the page under the intro is inert');
  await pg.keyboard.press('Escape');
  assert(!(await introState(pg)), 'Esc skips the intro');
  assert(await pg.evaluate(() => document.activeElement === byId('infoBtn') && !document.querySelector('header').inert), 'W-088: focus returns to ⓘ and the page is live again');
  await pg.click('#infoBtn');
  await pg.click('#infoPop .info-replay');
  await pg.click('#introOverlay .intro-dots button:nth-child(3)');
  const ctas = await pg.$$eval('#introOverlay .intro-ctas button', els => els.map(e => e.dataset.arg));
  assert(JSON.stringify(ctas) === '["back"]', 'a replay ends with Back only (no Start now / Make a study plan): ' + ctas.join(','));
  await pg.click('#introOverlay [data-arg="back"]');
  assert(!(await introState(pg)) && await pg.$eval('#screenHome', el => el.classList.contains('active')), 'Back closes the replay on Home');
  assert(errs.length === 0, 'no page errors: ' + errs.join(' / '));
  await ctx.close();
  await checkPlanWayIn(b, base);
}
// first run: Make a study plan opens the plan goal form
async function checkPlanWayIn(b, base) {
  const { pg, ctx } = await userPage(b, PHONE, FAN_RANDOM);
  await loadAndTime(pg, base);
  await pg.click('#introOverlay .intro-dots button:nth-child(3)');
  await pg.click('#introOverlay [data-arg="plan"]');
  assert(await pg.$eval('#screenPlanGoal', el => el.classList.contains('active')), 'Make a study plan opens the plan goal form');
  await ctx.close();
}
// v2.5.2: the worst overlap between two pieces of one illustration, as % of the smaller piece (rows: they barely touch)
const worstOverlap = pg => pg.evaluate(() => Math.max(...[...document.querySelectorAll('#introOverlay .intro-card')].map(card => {
  const boxes = [...card.querySelectorAll('.intro-piece')].map(el => el.getBoundingClientRect());
  return Math.max(0, ...boxes.flatMap((a, i) => boxes.slice(i + 1).map(b => {
    const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)), h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    return Math.round(100 * w * h / Math.min(a.width * a.height, b.width * b.height));
  })));
})));
// every card: the illustration is at most half the card (phone), its pieces stay inside, the text fits without scrolling
const cardsFit = pg => pg.evaluate(share => [...document.querySelectorAll('#introOverlay .intro-card')].map(card => {
  const art = card.querySelector('.intro-art').getBoundingClientRect(), all = card.getBoundingClientRect();
  const text = card.querySelector('.intro-text');
  return { half: art.height <= all.height * share + 1, textFits: text.scrollHeight <= text.clientHeight + 1 };
}), ART_SHARE);
async function checkRingAndDesktop(b, base) {
  const { pg, ctx, errs } = await userPage(b, DESKTOP, RING_RANDOM);
  await pg.goto(base);
  assert(await pg.$$eval('#splashMemos .splash-memo', els => els.filter(e => getComputedStyle(e).display !== 'none').length) === 3, 'desktop splash: three tip memos');
  assert(await pg.$eval('#splash', el => getComputedStyle(el).gridTemplateColumns.split(' ').length === 2), 'desktop splash: brand left, memos right');
  const t0 = await pg.evaluate(() => performance.now());
  assert(await pg.$eval('#splash', el => el.dataset.anim) === 'ring', 'Math.random 0.9 draws the progress ring');
  await pg.waitForFunction(() => !document.getElementById('splash'), null, { timeout: OPEN_TIMEOUT_MS });
  const ms = await pg.evaluate(() => performance.now()) - t0;
  assert(ms >= RING_MIN_MS - 300, `the app waits for the ring's lap (${Math.round(ms)}ms)`);
  const cols = await pg.$eval('#introOverlay .intro-card[data-pos="0"]', el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  assert(cols === 2, 'desktop intro: illustration left, text right');
  assert(await piecesInside(pg), 'desktop card 1: pieces stay ≥ 20px inside');
  const over = await worstOverlap(pg);
  assert(over <= MAX_OVERLAP_PCT, `desktop: illustration pieces do not pile up (worst overlap ${over}% ≤ ${MAX_OVERLAP_PCT}%)`);
  const fit = await cardsFit(pg);
  assert(fit.every(c => c.textFits), 'desktop: every card text fits without scrolling: ' + JSON.stringify(fit));
  const sizes = await pg.$$eval('#introOverlay .intro-title', els => [...new Set(els.map(e => getComputedStyle(e).fontSize))]);
  assert(sizes.length === 1, 'desktop: the three titles share one size: ' + sizes.join(', '));
  assert(await noSideScroll(pg), 'desktop: no sideways scroll');
  assert(errs.length === 0, 'no page errors: ' + errs.join(' / '));
  await ctx.close();
}
// C-008: the splash never stays over the app: startApp throws part-way, or an old cached main.js never calls the splash
async function checkSplashFailsafe(b, base) {
  const thrown = await userPage(b, PHONE, FAN_RANDOM);
  await thrown.ctx.route('**/js/screens/home.js', async route => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text()) + '\nfunction buildExamGrid() { throw new Error("boot test"); }' });
  });
  await thrown.pg.goto(base);
  await thrown.pg.waitForFunction(() => !document.getElementById('splash'), null, { timeout: OPEN_TIMEOUT_MS });
  assert(thrown.errs.some(m => /boot test/.test(m)), 'startApp threw part-way, and the splash still went away (try / finally)');
  await thrown.ctx.close();
  const oldMain = execSync(`git -C ${ROOT} show ${PRE_SPLASH_REF}:js/main.js`).toString();
  const mixed = await userPage(b, PHONE, FAN_RANDOM);
  await mixed.ctx.route('**/js/main.js', route => route.fulfill({ contentType: 'text/javascript', body: oldMain }));
  await mixed.pg.goto(base);
  await mixed.pg.waitForFunction(() => getComputedStyle(document.getElementById('splash')).visibility === 'hidden', null, { timeout: FAILSAFE_WAIT_MS });
  await mixed.pg.click('#infoBtn');
  assert(await mixed.pg.$eval('#infoPop', el => el.classList.contains('show')), 'old cached main.js: the css failsafe hides the splash and the app takes clicks');
  await mixed.ctx.close();
}
async function checkReducedMotion(b, base) {
  const { pg, ctx } = await userPage(b, PHONE, FAN_RANDOM);
  await pg.emulateMedia({ reducedMotion: 'reduce' });
  const t = await loadAndTime(pg, base);
  assert(t.ms < FAN_MIN_MS, `reduced motion: no animation to wait for (${Math.round(t.ms)}ms)`);
  assert(await noSideScroll(pg), 'phone: no sideways scroll');
  await ctx.close();
}

(async () => {
  const { base, server } = await startPagesServer(ROOT);
  const b = await chromium.launch(launchOpts);
  try {
    await checkFirstRun(b, base);
    await checkReplayAndPlan(b, base);
    await checkRingAndDesktop(b, base);
    await checkReducedMotion(b, base);
    await checkSplashFailsafe(b, base);
    console.log('INTRO PASS');
  } catch (e) {
    console.log(e.message);
    process.exitCode = 1;
  } finally {
    await b.close();
    server.kill();
  }
})();
