const { chromium } = require('playwright-core');
const path = require('path');
// v1.6.1 (user, iPhone screenshots of v1.6.0): on Study the 5 tabs (#studyTabs) and the chip rows under them (#studyChips,
// #studySubChips) stay pinned under the sticky app header while the list scrolls under them; the 🏠 header and the
// search box scroll away. Same on every tab. Modelled on flagged-sticky-test.js (v1.4.4 precedent). Runs with the
// app's first-run defaults (zh-HK, large text), then en / zh-HK × small / large at 320 / 360 / 390px.
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

const PHONE = { width: 390, height: 844 };
const SHORT = { width: 844, height: 390 }; // landscape phone: too short to pin (same rule as Flagged W-2)
const TABS = ['chapters', 'timeline', 'geo', 'people', 'memo'];
const WIDTHS = [320, 360, 390];
const WIDTH_CHECK_HEIGHT = 700;
const LANGS = ['en', 'zh-HK'];
const SIZES = ['small', 'large'];
const TOLERANCE_PX = 1;
const SHIFT_TABS = 8; // Shift+Tab back past the cards in view, to ones scrolled above the pinned block (W-1 precedent)
const SEARCH_GAP_PX = 12; // the search box's margin-bottom (--space-6) above the tabs at rest
const BELOW_PX = 6; // probe just under the last chip row (inside its margin-bottom)
const CHAPTER_CHIP = 3;
const MEMO_DUE_GROUP = 'vote';

// pinned = the block that holds the tabs and chip rows; its rect, the header bottom and the parts' rects
async function layout(pg) {
  return pg.evaluate(() => {
    const r = el => el && el.getBoundingClientRect();
    const rows = ['studyChips', 'studySubChips'].map(id => document.getElementById(id)).filter(e => !e.hidden);
    const block = document.querySelector('#screenStudy .study-top');
    return {
      header: r(document.querySelector('header')).bottom,
      block: block ? r(block).toJSON() : null,
      position: block ? getComputedStyle(block).position : 'none',
      tabs: r(document.getElementById('studyTabs')).toJSON(),
      search: r(document.getElementById('studySearch')).toJSON(),
      rows: rows.map(e => r(e).toJSON()),
      count: r(document.getElementById('studyCount')).toJSON(),
      docW: document.documentElement.scrollWidth,
    };
  });
}
const toBottom = pg => pg.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
const openTab = (pg, tab) => pg.evaluate(tab => { openStudy(); studySetTab(tab); }, tab);

// the block is stuck right under the header, the tabs and every visible chip row are inside it and on screen
function assertPinned(l, label) {
  assert(l.block && l.position === 'sticky', `${label}: tabs + chips sit in a sticky block`);
  assert(Math.abs(l.block.top - l.header) <= TOLERANCE_PX, `${label}: block sticks right under the app header`);
  const parts = [l.tabs, ...l.rows];
  assert(parts.every(p => p.top >= l.header - TOLERANCE_PX && p.bottom <= l.block.bottom + TOLERANCE_PX),
    `${label}: tabs and chip rows stay in view inside the block`);
  assert(l.search.bottom <= l.header + TOLERANCE_PX, `${label}: search box scrolled away`);
}
// nothing of the list paints over the tabs, a chip row or the gap under the last row
async function assertCovered(pg, label) {
  const hits = await pg.evaluate(dy => {
    const pts = [];
    const tabs = document.getElementById('studyTabs').getBoundingClientRect();
    pts.push([tabs.left + tabs.width / 2, tabs.top + tabs.height / 2]);
    const rows = ['studyChips', 'studySubChips'].map(id => document.getElementById(id)).filter(e => !e.hidden);
    rows.forEach(e => { const r = e.getBoundingClientRect(); pts.push([r.left + 4, r.top + r.height / 2]); });
    const last = rows.length ? rows[rows.length - 1].getBoundingClientRect() : tabs;
    pts.push([last.left + last.width / 2, last.bottom + dy]);
    return pts.filter(([x, y]) => !!document.elementFromPoint(x, y).closest('#studyContent, #studyCount')).length;
  }, BELOW_PX);
  assert(hits === 0, `${label}: the list scrolls under the pinned block, not over it`);
}

async function phoneChecks(pg) {
  await pg.evaluate(() => openStudy());
  const rest = await layout(pg);
  assert(Math.abs(rest.tabs.top - rest.search.bottom - SEARCH_GAP_PX) <= TOLERANCE_PX, 'resting layout: tabs 12px under the search box');
  for (const tab of TABS) {
    await openTab(pg, tab);
    const docH = await pg.evaluate(() => document.documentElement.scrollHeight);
    assert(docH > PHONE.height * 1.5, `${tab}: list is taller than the viewport (${docH}px)`);
    await toBottom(pg);
    assertPinned(await layout(pg), tab);
    await assertCovered(pg, tab);
  }
}

// a chip / tab tapped while the list is scrolled: the new list starts right under the pinned block (not mid-list)
async function chipTapChecks(pg) {
  await openTab(pg, 'chapters');
  await toBottom(pg);
  await pg.click(`#studySubChips .chip:nth-child(${CHAPTER_CHIP})`);
  let l = await layout(pg);
  assert(Math.abs(l.count.top - l.block.bottom) <= TOLERANCE_PX, 'chapter chip tapped while scrolled: list starts under the block');
  await toBottom(pg);
  await pg.click('.study-tab[data-tab="people"]');
  l = await layout(pg);
  assert(Math.abs(l.count.top - l.block.bottom) <= TOLERANCE_PX, 'tab tapped while scrolled: list starts under the block');
  await pg.evaluate(() => window.scrollTo(0, 0));
  await pg.click('.study-tab[data-tab="chapters"]');
  assert(await pg.evaluate(() => window.scrollY) === 0, 'tab tapped at the top: page stays at the top');
}

// ↩ Back from a fact session (flashStudyFact) and keyboard focus scroll the card below the pinned block, never under it
async function anchorChecks(pg) {
  await openTab(pg, 'chapters');
  await toBottom(pg);
  const hidden = await pg.evaluate(() => {
    const card = document.querySelector('#studyContent .fact[data-fact-id]');
    const header = document.querySelector('header').getBoundingClientRect().bottom;
    window.scrollBy(0, card.getBoundingClientRect().top - header - 10); // card top just under the header: behind the block
    flashStudyFact(card.dataset.factId);
    return card.getBoundingClientRect().top < document.querySelector('#screenStudy .study-top').getBoundingClientRect().bottom - 1;
  });
  assert(!hidden, 'flashStudyFact brings the card into view below the pinned block');

  await toBottom(pg);
  await pg.evaluate(() => [...document.querySelectorAll('#studyContent button')].pop().focus({ preventScroll: true }));
  let under = 0;
  for (let i = 0; i < SHIFT_TABS; i++) {
    await pg.keyboard.press('Shift+Tab');
    under += await pg.evaluate(tol => {
      const pinned = document.querySelector('#screenStudy .study-top').getBoundingClientRect().bottom;
      const el = document.activeElement;
      return el.closest('#studyContent') && el.getBoundingClientRect().top < pinned - tol ? 1 : 0;
    }, TOLERANCE_PX);
  }
  assert(under === 0, 'Shift+Tab never leaves the focused fact button under the pinned block');
}

// timeline era bars are ordinary rows: they scroll under the pinned block, they do not stick or paint over it
async function timelineChecks(pg) {
  await openTab(pg, 'timeline');
  const res = await pg.evaluate(() => {
    const era = document.querySelectorAll('#studyContent .tl-era')[2];
    const header = document.querySelector('header').getBoundingClientRect().bottom;
    window.scrollBy(0, era.getBoundingClientRect().top - header - 20);
    const r = era.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { pos: getComputedStyle(era).position, inBlock: !!hit.closest('#screenStudy .study-top') };
  });
  assert(res.pos === 'static' && res.inBlock, 'timeline era bar scrolls under the pinned block (not sticky, not on top)');
}

// memo: the "due today" banner is part of the list, so it scrolls away under the block
async function memoChecks(pg) {
  await pg.evaluate(id => {
    localStorage.setItem('lifeuk.memoProgress', JSON.stringify({ [id]: { lv: 1, due: planTodayIso() } }));
  }, MEMO_DUE_GROUP);
  await openTab(pg, 'memo');
  await toBottom(pg);
  const b = await pg.evaluate(() => {
    const r = document.querySelector('#studyContent .memo-due').getBoundingClientRect();
    return { bannerBottom: r.bottom, header: document.querySelector('header').getBoundingClientRect().bottom };
  });
  assert(b.bannerBottom < b.header, 'memo due banner scrolls away with the list');
  await pg.evaluate(() => localStorage.removeItem('lifeuk.memoProgress'));
}

// en / zh-HK × small / large × 320 / 360 / 390: pinned on every tab and no sideways scroll
async function widthChecks(browser) {
  for (const lang of LANGS) for (const size of SIZES) for (const width of WIDTHS) {
    const pg = await browser.newPage({ viewport: { width, height: WIDTH_CHECK_HEIGHT } });
    await pg.goto(APP_URL);
    await pg.evaluate(([l, s]) => { localStorage.setItem('lifeuk.uiLang', JSON.stringify(l)); localStorage.setItem('lifeuk.fontSize', JSON.stringify(s)); }, [lang, size]);
    await pg.reload();
    let bad = [];
    for (const tab of TABS) {
      await openTab(pg, tab);
      await toBottom(pg);
      const l = await layout(pg);
      const ok = l.block && l.position === 'sticky' && Math.abs(l.block.top - l.header) <= TOLERANCE_PX && l.docW <= width;
      if (!ok) bad.push(`${tab} docW=${l.docW} pos=${l.position}`);
    }
    assert(bad.length === 0, `${lang} ${size} ${width}px: pinned on every tab, no horizontal scroll ${bad.join('; ')}`);
    await pg.close();
  }
}

(async () => {
  const browser = await chromium.launch(launchOpts);
  const pg = await browser.newPage({ viewport: PHONE });
  await pg.goto(APP_URL);
  await phoneChecks(pg);
  await chipTapChecks(pg);
  await anchorChecks(pg);
  await timelineChecks(pg);
  await memoChecks(pg);

  // short (landscape) screen: nothing is pinned, the tabs scroll away with the list
  await pg.setViewportSize(SHORT);
  await openTab(pg, 'chapters');
  await toBottom(pg);
  const l = await layout(pg);
  assert(l.position === 'static' && l.tabs.bottom < l.header, 'short viewport: tabs and chips scroll away with the list');

  await widthChecks(browser);
  await browser.close();
  console.log('PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
