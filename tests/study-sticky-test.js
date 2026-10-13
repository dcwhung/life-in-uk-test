const { chromium } = require('playwright-core');
const path = require('path');
// v1.6.1 (user, iPhone screenshots of v1.6.0): on Study the 5 tabs (#studyTabs) and the chip rows under them (#studyChips,
// #studySubChips) stay pinned under the sticky app header while the list scrolls under them; the 🏠 header and the
// search box scroll away. Same on every tab. Modelled on flagged-sticky-test.js (v1.4.4 precedent). Runs with the
// app's first-run defaults (zh-HK, large text), then en / zh-HK × small / large at 320 / 360 / 390px.
// v1.6.1 review follow-up: W-067 the real fact-practice ↩ Back path (startFactPractice → skip to the last question → Back)
// leaves the card below the pinned block (W-069: started by a DOM click from a card asserted to be hidden behind the
// block, so Playwright's auto-scroll can't move it out first); W-068 (user decision) the chip rows stay on ONE line and scroll sideways, so
// the pinned block fits small phones (header + block ≤ 40% of 320×568 … 390×844, en / zh-HK large text); S-239 the
// Hide mastered / Bookmarked toggles and the memo chapter chips go through studyRefilter; short landscape screens stay static.
// v2.0.4 merge (main v2.0.0 desktop, ≥ 1024px): Study is one screen high with a rail beside a card panel that scrolls on
// its own, so the block is not pinned there: it sits in the rail as display: contents, the chip rows wrap again, the page
// keeps scroll-padding auto, a new list starts the panel at its top; back below 1024px the block pins again.
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

const PHONE = { width: 390, height: 844 };
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
const GUARD_WAIT_MS = 400; // > SCREEN_CHANGE_CLICK_GUARD_MS: a click right after a screen change is eaten (CUI-0011)
const FACT_CARD_INDEX = 6; // a fact card well down the People list
const CARD_UNDER_HEADER_PX = 30; // its top just under the app header: behind the pinned block
const MAX_SKIPS = 40;
// W-068 (user): small phones keep the pinned header + block within this share of the viewport height
const PIN_BUDGET = 0.4;
const BUDGET_VIEWPORTS = [{ width: 320, height: 568 }, { width: 360, height: 640 }, { width: 375, height: 667 }, { width: 390, height: 844 }];
// landscape phones / short windows: too short to pin (same rule as Flagged W-2)
const SHORT_VIEWPORTS = [{ width: 568, height: 320 }, { width: 667, height: 375 }, { width: 844, height: 390 }, { width: 900, height: 500 }];
const MIN_CHIP_H = 27; // chips keep their v1.6.1 height in a one-line row, never squeezed (27px small text, 29px large)
const ROW_IDS = ['studyChips', 'studySubChips'];

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

// memo: v2.3.0 (mockup desktop-memo.html rev 4 / rev 5, user 2026-10-13: 「今日要溫」固定唔郁, superseding v1.6.1's banner
// as a list row) the "due today" banner stays on screen: it sticks right under the pinned block
async function memoChecks(pg) {
  await pg.evaluate(id => {
    localStorage.setItem('lifeuk.memoProgress', JSON.stringify({ [id]: { lv: 1, due: planTodayIso() } }));
  }, MEMO_DUE_GROUP);
  await openTab(pg, 'memo');
  await toBottom(pg);
  const b = await pg.evaluate(() => {
    const r = document.querySelector('#studyLead .memo-due').getBoundingClientRect();
    return { bannerTop: r.top, block: document.querySelector('#screenStudy .study-top').getBoundingClientRect().bottom, scrolled: window.scrollY };
  });
  assert(b.scrolled > 0 && Math.abs(b.bannerTop - b.block) <= TOLERANCE_PX, 'memo due banner stays pinned right under the block: ' + JSON.stringify(b));
  await pg.evaluate(() => localStorage.removeItem('lifeuk.memoProgress'));
}

// W-067: the real path. A card scrolled behind the pinned block → its "▶ Practise" session → skip to the last question →
// ↩ Back: flashStudyFact must bring the whole card below the block (the block height read 0 while Study was hidden)
async function factReturnChecks(pg) {
  await openTab(pg, 'people');
  await toBottom(pg);
  const id = await pg.evaluate(([idx, dy]) => {
    const cards = [...document.querySelectorAll('#studyContent .fact[data-fact-id]')]
      .filter(c => c.querySelector('[data-action="startFactPractice"]'));
    const card = cards[idx];
    const header = document.querySelector('header').getBoundingClientRect().bottom;
    window.scrollBy(0, card.getBoundingClientRect().top - header - dy);
    return card.dataset.factId;
  }, [FACT_CARD_INDEX, CARD_UNDER_HEADER_PX]);
  // W-069: precondition — the card really starts behind the pinned block, else the check proves nothing
  const pre = await pg.evaluate(id => ({
    card: Math.round(document.querySelector(`#studyContent .fact[data-fact-id="${id}"]`).getBoundingClientRect().top),
    block: Math.round(document.querySelector('#screenStudy .study-top').getBoundingClientRect().bottom),
  }), id);
  assert(pre.card < pre.block - TOLERANCE_PX, `W-069 precondition: card top starts under the pinned block ${JSON.stringify(pre)}`);
  // W-069: DOM click (no Playwright auto-scroll into view), so the saved scrollY keeps the card hidden behind the block
  await pg.evaluate(id => document.querySelector(`#studyContent .fact[data-fact-id="${id}"] [data-action="startFactPractice"]`).click(), id);
  await pg.waitForTimeout(GUARD_WAIT_MS);
  assert(await pg.evaluate(() => document.querySelector('.screen.active').id) === 'screenQuiz', 'W-067: ▶ Practise opens the fact session');
  for (let i = 0; i < MAX_SKIPS && !(await pg.evaluate(() => state.current === state.questions.length - 1)); i++) await pg.click('#nextBtn');
  await pg.click('#nextBtn'); // ↩ Back on the last question
  const r = await pg.evaluate(id => {
    const card = document.querySelector(`#studyContent .fact[data-fact-id="${id}"]`).getBoundingClientRect();
    const block = document.querySelector('#screenStudy .study-top').getBoundingClientRect();
    return { screen: document.querySelector('.screen.active').id, card: Math.round(card.top), block: Math.round(block.bottom) };
  }, id);
  assert(r.screen === 'screenStudy' && r.card >= r.block - TOLERANCE_PX,
    `W-067: ↩ Back from fact practice: card top below the pinned block ${JSON.stringify(r)}`);
}

// CUI-0036 (QA v1.6.1 F-1; user 2026-10-12: align the card top): on small phones with large text a People card can be
// taller than the room under the pinned block. Its "▶ Practise" sits at the bottom, so the card top is behind the block
// when it is tapped; after ↩ Back the card's top (year / title) must sit right under the block, even if its bottom (▶)
// then goes off-screen. The real path: DOM click (no Playwright auto-scroll), skip to the last question, ↩ Back.
const TALL_VIEWPORTS = [{ width: 320, height: 568 }, { width: 360, height: 640 }];
const TALL_BOTTOM_GAP_PX = 12; // the card's ▶ just above the screen's bottom edge, as tapped
async function factReturnTo(pg, id) {
  await pg.evaluate(id => document.querySelector(`#studyContent .fact[data-fact-id="${id}"] [data-action="startFactPractice"]`).click(), id);
  await pg.waitForTimeout(GUARD_WAIT_MS);
  for (let i = 0; i < MAX_SKIPS && !(await pg.evaluate(() => state.current === state.questions.length - 1)); i++) {
    await pg.evaluate(() => byId('nextBtn').click());
  }
  await pg.evaluate(() => byId('nextBtn').click()); // ↩ Back on the last question
}
async function tallCardReturnChecks(browser) {
  for (const vp of TALL_VIEWPORTS) for (const lang of LANGS) {
    const label = `CUI-0036 ${vp.width}x${vp.height} ${lang} large`;
    const pg = await browser.newPage({ viewport: vp });
    await pg.goto(APP_URL);
    await pg.evaluate(l => { localStorage.setItem('lifeuk.uiLang', JSON.stringify(l)); localStorage.setItem('lifeuk.fontSize', JSON.stringify('large')); }, lang);
    await pg.reload();
    await openTab(pg, 'people');
    await toBottom(pg); // pinned: the block's real height
    const pre = await pg.evaluate(gap => {
      const blockBottom = () => document.querySelector('#screenStudy .study-top').getBoundingClientRect().bottom;
      const room = innerHeight - blockBottom();
      const card = [...document.querySelectorAll('#studyContent .fact[data-fact-id]')]
        .filter(c => c.querySelector('[data-action="startFactPractice"]'))
        .find(c => c.getBoundingClientRect().height > room + 20);
      if (!card) return null;
      window.scrollBy(0, card.getBoundingClientRect().bottom - (innerHeight - gap));
      return { id: card.dataset.factId, h: Math.round(card.getBoundingClientRect().height), room: Math.round(room),
        top: Math.round(card.getBoundingClientRect().top), block: Math.round(blockBottom()) };
    }, TALL_BOTTOM_GAP_PX);
    assert(pre && pre.top < pre.block - TOLERANCE_PX, `${label} precondition: a card taller than the room under the block, its top behind the block ${JSON.stringify(pre)}`);
    await factReturnTo(pg, pre.id);
    const r = await pg.evaluate(id => {
      const card = document.querySelector(`#studyContent .fact[data-fact-id="${id}"]`);
      const c = card.getBoundingClientRect();
      const block = document.querySelector('#screenStudy .study-top').getBoundingClientRect().bottom;
      const hit = document.elementFromPoint(c.left + c.width / 2, c.top + 6);
      return { screen: document.querySelector('.screen.active').id, card: Math.round(c.top), block: Math.round(block), topShown: !!hit && card.contains(hit), flash: card.classList.contains('flash') };
    }, pre.id);
    assert(r.screen === 'screenStudy' && Math.abs(r.card - r.block) <= TOLERANCE_PX && r.topShown && r.flash,
      `${label}: ↩ Back puts the tall card's top right under the pinned block ${JSON.stringify(r)}`);
    await pg.close();
  }
}
// CUI-0036 on desktop (≥ 1024px): the cards scroll in their panel; after ↩ Back the card's top sits below the panel's
// top fade (the title clear of it), whether the card was above the panel's top or further down
const DESKTOP_RETURN_VP = { width: 1280, height: 800 };
async function desktopFactReturnChecks(browser) {
  const pg = await browser.newPage({ viewport: DESKTOP_RETURN_VP });
  await pg.goto(APP_URL);
  await pg.evaluate(() => { localStorage.setItem('lifeuk.uiLang', JSON.stringify('en')); localStorage.setItem('lifeuk.fontSize', JSON.stringify('large')); });
  await pg.reload();
  await openTab(pg, 'people');
  const id = await pg.evaluate(([idx, dy]) => {
    const panel = byId('studyContent');
    const card = [...panel.querySelectorAll('.fact[data-fact-id]')].filter(c => c.querySelector('[data-action="startFactPractice"]'))[idx];
    panel.scrollTop += card.getBoundingClientRect().top - panel.getBoundingClientRect().top + dy; // card top above the panel
    return card.dataset.factId;
  }, [FACT_CARD_INDEX, CARD_UNDER_HEADER_PX]);
  await factReturnTo(pg, id);
  const r = await pg.evaluate(id => {
    const panel = byId('studyContent');
    const main = document.querySelector('#screenStudy .study-main');
    const probe = document.createElement('div'); // --fit-fade-h is a calc(): resolve it as a height
    probe.style.cssText = 'position:absolute;visibility:hidden;height:var(--fit-fade-h)';
    main.append(probe);
    const fade = probe.getBoundingClientRect().height;
    probe.remove();
    const c = document.querySelector(`#studyContent .fact[data-fact-id="${id}"]`).getBoundingClientRect();
    return { screen: document.querySelector('.screen.active').id, gap: Math.round(c.top - panel.getBoundingClientRect().top), fade: Math.round(fade), page: window.scrollY };
  }, id);
  assert(r.screen === 'screenStudy' && r.page === 0 && r.fade > 0 && Math.abs(r.gap - r.fade) <= TOLERANCE_PX + 1,
    `CUI-0036 desktop 1280x800: ↩ Back puts the card's top just below the panel's top fade ${JSON.stringify(r)}`);
  await pg.close();
}

// S-239: Hide mastered / Bookmarked (studyToggle) and the memo chapter chips also start the new list under the block
async function toggleChipChecks(pg) {
  await openTab(pg, 'chapters'); // openStudy reloads the marks: bookmark some facts after it, so "Bookmarked" lists a few
  await pg.evaluate(() => { study.bookmarks = Object.fromEntries(STUDY.slice(0, 60).map(f => [f.id, true])); renderStudy(); });
  for (const arg of ['hideMastered', 'bookmarksOnly']) {
    await toBottom(pg);
    await pg.click(`#studyChips .chip[data-arg="${arg}"]`);
    const l = await layout(pg);
    assert(Math.abs(l.count.top - l.block.bottom) <= TOLERANCE_PX, `S-239: ${arg} chip tapped while scrolled: list starts under the block`);
    await pg.click(`#studyChips .chip[data-arg="${arg}"]`);
  }
  await openTab(pg, 'memo');
  await toBottom(pg);
  await pg.click(`#studySubChips .chip[data-arg="${CHAPTER_CHIP}"]`);
  const l = await layout(pg);
  assert(Math.abs(l.count.top - l.block.bottom) <= TOLERANCE_PX, 'S-239: memo chapter chip tapped while scrolled: list starts under the block');
  await pg.evaluate(() => { studySetMemoChapter('all'); study.bookmarks = {}; localStorage.removeItem('lifeuk.studyBookmarks'); });
}

// W-068: every visible Study chip row is one line that scrolls sideways (hidden scrollbar, edge fade), its active chip
// fully in view, chips at their tap height, no page h-scroll; returns the problems found
async function chipRowProblems(pg) {
  return pg.evaluate(([ids, minH]) => {
    const out = [];
    ids.map(id => document.getElementById(id)).filter(row => !row.hidden).forEach(row => {
      const cs = getComputedStyle(row), r = row.getBoundingClientRect();
      const chips = [...row.querySelectorAll('.chip')];
      const tops = new Set(chips.map(c => Math.round(c.getBoundingClientRect().top)));
      if (tops.size !== 1) out.push(`${row.id} wraps into ${tops.size} lines`);
      if (cs.overflowX !== 'auto') out.push(`${row.id} overflow-x ${cs.overflowX}`);
      if (cs.scrollbarWidth !== 'none') out.push(`${row.id} scrollbar shown`);
      const mask = cs.maskImage || cs.webkitMaskImage;
      if (!mask || mask === 'none') out.push(`${row.id} no edge fade`);
      if (chips.some(c => c.getBoundingClientRect().height < minH)) out.push(`${row.id} chip shorter than ${minH}px`);
      const active = row.querySelector('.chip.active');
      if (active) {
        const a = active.getBoundingClientRect();
        if (a.left < r.left - 1 || a.right > r.right + 1) out.push(`${row.id} active chip out of view (${Math.round(a.left)}-${Math.round(a.right)} in ${Math.round(r.left)}-${Math.round(r.right)})`);
      }
    });
    if (document.documentElement.scrollWidth > window.innerWidth) out.push(`page h-scroll ${document.documentElement.scrollWidth}`);
    return out;
  }, [ROW_IDS, MIN_CHIP_H]);
}

// W-068: the selected chip stays in view (Ch 5, the last people group) after a tab switch / reload / re-render, without
// moving the page; the People groups row is wider than the screen (it scrolls); keyboard focus scrolls a chip into view
async function chipScrollChecks(browser) {
  const pg = await browser.newPage({ viewport: { width: 320, height: 568 } });
  await pg.goto(APP_URL);
  await pg.evaluate(() => { localStorage.setItem('lifeuk.uiLang', JSON.stringify('en')); localStorage.setItem('lifeuk.fontSize', JSON.stringify('large')); });
  await pg.reload();
  await openTab(pg, 'people');
  const wide = await pg.$eval('#studySubChips', e => ({ sw: e.scrollWidth, cw: e.clientWidth }));
  assert(wide.sw > wide.cw, `W-068: 320px People groups row is wider than its box, so it scrolls (${wide.sw} > ${wide.cw})`);
  await pg.evaluate(() => { studySetGroup('reformer'); studySetTab('chapters'); studySetChapter(5); studySetTab('geo'); studySetTab('chapters'); });
  let p = await chipRowProblems(pg);
  assert(p.length === 0, 'W-068: Ch 5 still in view after a tab switch ' + p.join('; '));
  await pg.evaluate(() => studySetTab('people'));
  p = await chipRowProblems(pg);
  assert(p.length === 0, 'W-068: the last people group (Reformers) chip in view after a tab switch ' + p.join('; '));
  await pg.reload();
  await pg.evaluate(() => openStudy());
  p = await chipRowProblems(pg);
  assert(p.length === 0 && await pg.evaluate(() => window.scrollY) === 0, 'W-068: after a reload the selected chip is in view, page still at the top ' + p.join('; '));
  // a re-render mid-list with the row swiped back to its start: the row scrolls to the active chip, the page does not move
  const moved = await pg.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight / 2);
    const y = window.scrollY;
    byId('studySubChips').scrollLeft = 0;
    rerenderCurrentScreen();
    return window.scrollY - y;
  });
  p = await chipRowProblems(pg);
  assert(moved === 0 && p.length === 0, `W-068: re-render while scrolled: page does not move (${moved}px), active chip in view ` + p.join('; '));
  await pg.evaluate(() => setLang('zh-HK'));
  p = await chipRowProblems(pg);
  assert(p.length === 0, 'W-068: language change: active chip still in view ' + p.join('; '));
  await pg.evaluate(() => setLang('en'));
  // keyboard, list scrolled under the pinned block: Tab along the people group chips: each focused chip is fully inside
  // its row (a half-shown one too), and the page does not move (sideways or up: the chip is already in view)
  const y0 = await pg.evaluate(() => { window.scrollTo(0, document.documentElement.scrollHeight / 2); document.querySelector('#studySubChips .chip').focus(); return window.scrollY; });
  const n = await pg.$$eval('#studySubChips .chip', els => els.length);
  const bad = [];
  for (let i = 1; i < n; i++) {
    await pg.keyboard.press('Tab');
    const f = await pg.evaluate(y0 => {
      const el = document.activeElement, row = el.closest('#studySubChips');
      if (!row) return 'left the row';
      const a = el.getBoundingClientRect(), r = row.getBoundingClientRect();
      const inRow = a.left >= r.left - 1 && a.right <= r.right + 1;
      return inRow && window.scrollX === 0 && window.scrollY === y0 ? '' : `${el.textContent.trim()} ${Math.round(a.left)}-${Math.round(a.right)} page ${window.scrollX},${window.scrollY - y0}`;
    }, y0);
    if (f) bad.push(f);
  }
  assert(bad.length === 0, 'W-068: Tab through the chip row (list scrolled): every focused chip scrolls into view, page stays put ' + bad.join('; '));
  await pg.close();
}

// W-068 (user): worst case over the 5 tabs, scrolled to the bottom: header + pinned block share of the viewport height
async function budgetChecks(browser) {
  const rows = [];
  for (const lang of LANGS) for (const vp of BUDGET_VIEWPORTS) {
    const pg = await browser.newPage({ viewport: vp });
    await pg.goto(APP_URL);
    await pg.evaluate(l => { localStorage.setItem('lifeuk.uiLang', JSON.stringify(l)); localStorage.setItem('lifeuk.fontSize', JSON.stringify('large')); }, lang);
    await pg.reload();
    let worst = { share: 0 };
    for (const tab of TABS) {
      await openTab(pg, tab);
      await toBottom(pg);
      const l = await layout(pg);
      const share = l.block.bottom / vp.height;
      if (share > worst.share) worst = { tab, share, block: Math.round(l.block.height) };
    }
    rows.push(`${vp.width}x${vp.height} ${lang} large: ${worst.tab} block ${worst.block}px, header + block ${(worst.share * 100).toFixed(1)}%`);
    await pg.close();
  }
  console.log('pinned share (worst tab):\n  ' + rows.join('\n  '));
  const over = rows.filter(r => parseFloat(r.split(' ').pop()) > PIN_BUDGET * 100);
  assert(over.length === 0, `W-068: header + pinned block ≤ ${PIN_BUDGET * 100}% of the viewport on small phones ${over.join('; ')}`);
}

// short (landscape) screens: nothing is pinned on any tab, the tabs scroll away with the list
async function shortChecks(pg) {
  for (const vp of SHORT_VIEWPORTS) {
    await pg.setViewportSize(vp);
    const bad = [];
    for (const tab of TABS) {
      await openTab(pg, tab);
      await toBottom(pg);
      const l = await layout(pg);
      if (!(l.position === 'static' && l.tabs.bottom < l.header)) bad.push(`${tab} ${l.position}`);
    }
    assert(bad.length === 0, `short viewport ${vp.width}x${vp.height}: tabs and chips scroll away on every tab ${bad.join('; ')}`);
  }
}

// en / zh-HK × small / large × 320 / 360 / 390: pinned on every tab, no sideways scroll, one-line chip rows (W-068)
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
      const rows = await chipRowProblems(pg);
      if (rows.length) bad.push(`${tab}: ${rows.join(', ')}`);
    }
    assert(bad.length === 0, `${lang} ${size} ${width}px: pinned on every tab, no horizontal scroll, one-line chip rows ${bad.join('; ')}`);
    await pg.close();
  }
}

// v2.0.4 merge: the v1.6.1 block in main's v2.0.0 desktop Study (rail + card panel), then back to a phone width
const DESKTOP_VIEWPORTS = [{ width: 1024, height: 768 }, { width: 1280, height: 800 }];
const DESKTOP_CASES = [['en', 'large'], ['zh-HK', 'small']];
const MEMO_DESKTOP_COLS = { narrow: 3, wide: 4, wideFrom: 1280 }; // v2.3.0 (mockup desktop-memo.html rev 2): 4 from 1280px
async function desktopChecks(browser) {
  for (const vp of DESKTOP_VIEWPORTS) for (const [lang, size] of DESKTOP_CASES) {
    const label = `desktop ${vp.width}x${vp.height} ${lang} ${size}`;
    const pg = await browser.newPage({ viewport: vp });
    await pg.goto(APP_URL);
    await pg.evaluate(([l, s]) => { localStorage.setItem('lifeuk.uiLang', JSON.stringify(l)); localStorage.setItem('lifeuk.fontSize', JSON.stringify(s)); }, [lang, size]);
    await pg.reload();
    const bad = [];
    for (const tab of TABS) {
      await openTab(pg, tab);
      const d = await pg.evaluate(() => {
        const top = document.querySelector('#screenStudy .study-top');
        const rail = document.querySelector('#screenStudy .study-rail');
        const rows = ['studyChips', 'studySubChips'].map(id => document.getElementById(id)).filter(e => !e.hidden);
        const panel = document.getElementById('studyContent');
        panel.scrollTop = panel.scrollHeight; // the panel scrolls, the page does not
        return {
          inRail: !!rail && rail.contains(top) && rail.contains(document.getElementById('studyTabs')) && rows.every(e => rail.contains(e)),
          display: getComputedStyle(top).display,
          // sub chips wrap again (rev 4); the filter chips stack full width at the rail's foot (v2.0.0)
          wrap: rows.filter(e => e.id === 'studySubChips').map(e => getComputedStyle(e).flexWrap),
          stack: rows.filter(e => e.id === 'studyChips').map(e => getComputedStyle(e).flexDirection),
          chipsAfterCount: document.getElementById('studyCount').nextElementSibling === document.getElementById('studyChips'),
          pad: getComputedStyle(document.documentElement).scrollPaddingTop,
          pageY: window.scrollY, docW: document.documentElement.scrollWidth, panelTop: panel.scrollTop,
        };
      });
      const filterOk = tab === 'memo' || d.chipsAfterCount;
      if (!(d.inRail && d.display === 'contents' && d.wrap.every(w => w === 'wrap') && d.stack.every(f => f === 'column') && filterOk && d.pad === 'auto' && d.pageY === 0 && d.docW <= vp.width && d.panelTop > 0)) {
        bad.push(`${tab} ${JSON.stringify(d)}`);
      }
    }
    assert(bad.length === 0, `${label}: the block sits in the rail (display: contents, not pinned), sub chips wrap, filter chips stacked after the count, scroll-padding auto, only the panel scrolls ${bad.join('; ')}`);
    // a new list (another tab) starts the scrolled panel at its top; the page stays put
    await pg.click('.study-tab[data-tab="people"]');
    const after = await pg.evaluate(() => ({ panel: document.getElementById('studyContent').scrollTop, page: window.scrollY }));
    assert(after.panel === 0 && after.page === 0, `${label}: a tab tap starts the new list at the panel's top ${JSON.stringify(after)}`);
    // memo list: three cards a row in the panel, none past its column
    await openTab(pg, 'memo');
    const m = await pg.evaluate(() => {
      const grid = document.querySelector('#studyContent .memo-grid');
      const cards = [...grid.querySelectorAll('.memo-card')];
      const g = grid.getBoundingClientRect();
      const tops = new Set(cards.slice(0, 2 * getComputedStyle(grid).gridTemplateColumns.split(' ').length).map(c => Math.round(c.getBoundingClientRect().top)));
      return { cols: getComputedStyle(grid).gridTemplateColumns.split(' ').length, rows: tops.size, out: cards.filter(c => c.getBoundingClientRect().right > g.right + 1).length };
    });
    const wantCols = vp.width >= MEMO_DESKTOP_COLS.wideFrom ? MEMO_DESKTOP_COLS.wide : MEMO_DESKTOP_COLS.narrow;
    assert(m.cols === wantCols && m.rows === 2 && m.out === 0, `${label}: memo list ${wantCols} cards a row ${JSON.stringify(m)}`);
    // back below 1024px: the filter chips go back into the block and it pins again
    if (vp.width === DESKTOP_VIEWPORTS[1].width && lang === 'en') {
      await pg.setViewportSize(PHONE);
      await openTab(pg, 'chapters');
      await toBottom(pg);
      const l = await layout(pg);
      const inBlock = await pg.evaluate(() => document.querySelector('#screenStudy .study-top').contains(document.getElementById('studyChips')));
      assert(inBlock && l.position === 'sticky' && Math.abs(l.block.top - l.header) <= TOLERANCE_PX, `${label} → 390px: the filter chips back in the block, pinned again ${JSON.stringify({ inBlock, pos: l.position, top: l.block.top, header: l.header })}`);
    }
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
  await toggleChipChecks(pg);
  await shortChecks(pg);
  await pg.setViewportSize(PHONE);

  // review follow-up checks (W-067 / W-068) are collected: each prints its own ok / FAIL, the run fails if any failed
  const failures = [];
  for (const check of [() => factReturnChecks(pg), () => chipScrollChecks(browser), () => budgetChecks(browser), () => widthChecks(browser), () => desktopChecks(browser),
    () => tallCardReturnChecks(browser), () => desktopFactReturnChecks(browser)]) {
    try { await check(); } catch (e) { failures.push(e.message); console.log(e.message); }
  }
  if (failures.length) throw new Error(failures.join('\n'));
  await browser.close();
  console.log('PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
