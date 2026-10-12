const { chromium } = require('playwright-core');
const path = require('path');
// v1.4.4 (user): on My Review › Flagged the screen header (🏠 + FLAGGED) and the "Practise flagged" card stay pinned
// under the sticky app header; only the flagged question list scrolls under them. Runs with the app's first-run
// defaults (zh-HK, large text): no legacy seed.
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

const PHONE = { width: 390, height: 844 };
const FLAG_COUNT = 24; // the user's screenshot: a list much taller than the phone
const EXAMS = 10; // seed keys "exam.question" over the first exams, one distinct question each
const TOLERANCE_PX = 1;
const SHORT = { width: 844, height: 390 }; // landscape phone: too short to pin (W-2)
const SHIFT_TABS = 8; // Shift+Tab back past the items in view, to ones scrolled above the pinned block (W-1)
const GAP_PROBE_PX = 6; // inside the Practise card's margin-bottom (--space-6 12px) below it

(async () => {
  const browser = await chromium.launch(launchOpts);
  const pg = await browser.newPage({ viewport: PHONE });
  await pg.goto(APP_URL);
  await pg.evaluate(({ n, exams }) => {
    const f = {};
    for (let i = 0; i < n; i++) f[`${(i % exams) + 1}.${i}`] = true;
    localStorage.setItem('lifeuk.practiceFlags', JSON.stringify(f));
    practiceFlags = f;
    openFlagged();
  }, { n: FLAG_COUNT, exams: EXAMS });

  const rects = () => pg.evaluate(() => {
    const r = sel => document.querySelector(sel).getBoundingClientRect();
    return { header: r('header').bottom, top: r('#screenFlagged .flagged-top').top, start: r('#flaggedStart'), back: r('#screenFlagged .back-btn') };
  });
  const before = await rects();
  const docH = await pg.evaluate(() => document.documentElement.scrollHeight);
  assert(docH > PHONE.height * 2, 'flagged list is taller than the viewport');

  await pg.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const after = await rects();
  assert(Math.abs(after.top - after.header) <= TOLERANCE_PX, 'top block sticks right under the app header');
  assert(after.back.top >= after.header && after.start.bottom <= PHONE.height, 'home button and Practise card stay in view');

  // the list really scrolls under the pinned block: nothing of an item paints over the Practise card
  const covered = await pg.evaluate(() => {
    const s = document.getElementById('flaggedStart').getBoundingClientRect();
    const el = document.elementFromPoint(s.left + s.width / 2, s.top + s.height / 2);
    return !!el.closest('.flag-item');
  });
  assert(!covered, 'list items scroll under the Practise card, not over it');
  // the card's bottom margin stays inside the pinned block (no margin collapse), so no item peeks out in the gap
  const peek = await pg.evaluate(dy => {
    const s = document.getElementById('flaggedStart').getBoundingClientRect();
    const el = document.elementFromPoint(s.left + s.width / 2, s.bottom + dy);
    return !!el.closest('.flag-item');
  }, GAP_PROBE_PX);
  assert(!peek, 'gap under the Practise card is covered (no item peeks out)');

  // W-1: keyboard focus scrolled back into view stops below the pinned block, never under it
  await pg.evaluate(() => [...document.querySelectorAll('#flaggedList button')].pop().focus({ preventScroll: true }));
  let hidden = 0;
  for (let i = 0; i < SHIFT_TABS; i++) {
    await pg.keyboard.press('Shift+Tab');
    hidden += await pg.evaluate(tol => {
      const pinned = document.querySelector('#screenFlagged .flagged-top').getBoundingClientRect().bottom;
      return document.activeElement.getBoundingClientRect().top < pinned - tol ? 1 : 0;
    }, TOLERANCE_PX);
  }
  assert(hidden === 0, 'Shift+Tab never leaves the focused unflag button under the pinned block');

  await pg.evaluate(() => window.scrollTo(0, 0));
  const back = await rects();
  assert(Math.abs(back.start.top - before.start.top) <= TOLERANCE_PX, 'resting layout unchanged at the top');

  // W-2: a short (landscape) screen keeps the room for the list: nothing is pinned
  await pg.setViewportSize(SHORT);
  await pg.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const pos = await pg.$eval('#screenFlagged .flagged-top', e => getComputedStyle(e).position);
  const topNow = (await rects()).top;
  assert(pos === 'static' && topNow < 0, 'short viewport: the top block scrolls away with the list');

  await browser.close();
  console.log('PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
