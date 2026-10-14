// v2.5.0: loading splash + first-run intro (js/components/splash.js, js/screens/intro.js; mockup
// mockups/v2.2.0/intro-b-cards.html). Both skip automated browsers (navigator.webdriver) and file://, so this suite serves
// the app over http and switches navigator.webdriver off; Math.random is pinned to choose the splash animation.
const { chromium } = require('playwright-core');
const path = require('path');
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
  await pg.keyboard.press('Escape');
  assert(!(await introState(pg)), 'Esc skips the intro');
  await pg.click('#infoBtn');
  await pg.click('#infoPop .info-replay');
  await pg.click('#introOverlay .intro-dots button:nth-child(3)');
  await pg.click('#introOverlay [data-arg="plan"]');
  assert(await pg.$eval('#screenPlanGoal', el => el.classList.contains('active')), 'Make a study plan opens the plan goal form');
  assert(errs.length === 0, 'no page errors: ' + errs.join(' / '));
  await ctx.close();
}
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
  assert(await noSideScroll(pg), 'desktop: no sideways scroll');
  assert(errs.length === 0, 'no page errors: ' + errs.join(' / '));
  await ctx.close();
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
    console.log('INTRO PASS');
  } catch (e) {
    console.log(e.message);
    process.exitCode = 1;
  } finally {
    await b.close();
    server.kill();
  }
})();
