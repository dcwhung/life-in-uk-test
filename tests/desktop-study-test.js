// v2.0.0 desktop layout — Study (mockup mockups/v2.0.0/desktop-study.html A rev 4; handoff §3 #7, §5):
// - one screen high: the page never scrolls; header row, then a 20% rail beside the card panel
// - rail: search, tabs 2 × 2 + the memo tab (v1.6.0) on its own row across the rail (2 + 2 + 1, user 2026-10-12), sub chips (wrapped by text, each row filled: flex 1 1 auto), count, then the filter chips
//   stacked full width at the rail's foot; a rail taller than the screen (1024px large text, People) scrolls itself
// - cards: one column in a panel that scrolls on its own with top / bottom fades
// - a new list starts at the panel top; ↩ Back from a fact's Practice returns to the panel offset
// - below 1024px the phone layout is untouched (wrappers draw nothing, filter chips back above the sub chips)
const dt = require('./desktop-helpers');
const { assert } = dt;

const RAIL_SHARE = 0.2;
const PX_SLACK = 1.5;
const FADE_WAIT_MS = 300;
const LONG_CHAPTER = 5; // 71 facts: the panel scrolls at every size
const FACT_ID = 21; // chapter 3, Magna Carta (tests/factsession-test.js)
const TABS = ['chapters', 'timeline', 'geo', 'people', 'memo'];

const openTab = (page, tab) => page.evaluate(([tb, ch]) => {
  if (!byId('screenStudy').classList.contains('active')) openStudy();
  studySetTab(tb);
  if (tb === 'chapters') studySetChapter(ch);
}, [tab, LONG_CHAPTER]);

// geometry of the rail, its rows and the panel
const studyLayout = page => page.evaluate(() => {
  const box = el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width }; };
  const rail = document.querySelector('#screenStudy .study-rail');
  const cols = document.querySelector('#screenStudy .study-cols');
  const sub = byId('studySubChips');
  const rows = {};
  [...sub.querySelectorAll('.chip')].forEach(c => { const b = box(c); (rows[Math.round(b.top)] = rows[Math.round(b.top)] || []).push(b); });
  const tabs = [...document.querySelectorAll('#studyTabs .study-tab')].map(box);
  const order = ['studySearch', 'studyTabs', 'studySubChips', 'studyCount', 'studyChips'].filter(id => !byId(id).hidden).map(id => [id, box(byId(id)).top]);
  return {
    cols: box(cols), rail: box(rail), railScroll: [rail.scrollHeight, rail.clientHeight], railOverflow: getComputedStyle(rail).overflowY,
    sub: sub.hidden ? null : { box: box(sub), rows: Object.values(rows) },
    chips: [...byId('studyChips').querySelectorAll('.chip')].map(box), chipsBox: byId('studyChips').hidden ? null : box(byId('studyChips')),
    tabsFit: [...document.querySelectorAll('#studyTabs .study-tab')].every(t => t.scrollWidth <= t.clientWidth + 1),
    tabs, order, domChipsAfterCount: byId('studyCount').nextElementSibling === byId('studyChips'),
    panel: box(byId('studyContent')), main: box(document.querySelector('#screenStudy .study-main')),
  };
});

async function checkCase({ page, label, viewport, lang, fontSize, errors }) {
  for (const tab of TABS) {
    await openTab(page, tab);
    const where = `${label} ${tab}`;
    const side = await dt.noHorizontalScroll(page);
    assert(side.ok, `${where}: no sideways scroll (${side.detail})`);
    const only = await dt.panelOnlyScroll(page, '#studyContent');
    assert(only.ok, `${where}: page one screen high, the card panel scrolls (${only.detail})`);
    const L = await studyLayout(page);
    assert(Math.abs(L.rail.width - L.cols.width * RAIL_SHARE) <= PX_SLACK && L.panel.left > L.rail.right,
      `${where}: rail ${L.rail.width.toFixed(1)}px = 20% of ${L.cols.width.toFixed(1)}px, cards to its right`);
    assert(L.tabs[0].top === L.tabs[1].top && L.tabs[2].top === L.tabs[3].top && L.tabs[2].top > L.tabs[0].top && Math.abs(L.tabs[0].left - L.tabs[2].left) < PX_SLACK,
      `${where}: tabs 2 × 2`);
    // v1.6.0 merge (user 2026-10-12): the 5th tab (🧠 memo) on a row of its own under the 2 × 2, as wide as the rail
    const memoTab = L.tabs[4];
    assert(L.tabs.length === 5 && memoTab.top > L.tabs[2].top && Math.abs(memoTab.left - L.tabs[0].left) < PX_SLACK
      && Math.abs(memoTab.right - L.tabs[1].right) < PX_SLACK && Math.abs(memoTab.width - L.rail.width) <= PX_SLACK,
      `${where}: tabs 2 + 2 + 1, the memo tab across the rail (${memoTab.width.toFixed(1)} / ${L.rail.width.toFixed(1)}px)`);
    assert(L.tabsFit, `${where}: every tab label fits its tab`);
    const tops = L.order.map(o => o[1]);
    assert(tops.every((t, i) => i === 0 || t > tops[i - 1]) && L.domChipsAfterCount,
      `${where}: rail order search → tabs → sub chips → count → filter chips (DOM too): ${L.order.map(o => o[0]).join(' → ')}`);
    assert(L.chips.every(c => Math.abs(c.width - L.rail.width) <= PX_SLACK), `${where}: filter chips full rail width, stacked`);
    if (L.sub) {
      const ragged = L.sub.rows.filter(r => Math.abs(r[0].left - L.sub.box.left) > PX_SLACK || Math.abs(r[r.length - 1].right - L.sub.box.right) > PX_SLACK);
      assert(ragged.length === 0, `${where}: ${L.sub.rows.length} sub chip rows, each filled edge to edge`);
    }
    const railFits = L.railScroll[0] <= L.railScroll[1] + dt.FIT_SLACK_PX;
    assert(['auto', 'scroll'].includes(L.railOverflow), `${where}: the rail can scroll on its own (overflow-y ${L.railOverflow})`);
    if (railFits && L.chipsBox) { // the memo tab has no filter chips (v1.6.0: the row hides)
      assert(Math.abs(L.chipsBox.bottom - L.rail.bottom) <= PX_SLACK, `${where}: filter chips at the rail's foot (${L.chipsBox.bottom.toFixed(1)} / ${L.rail.bottom.toFixed(1)})`);
    }
    if (viewport.width === dt.DESKTOP_MIN_WIDTH && fontSize === 'large' && tab === 'people') {
      assert(!railFits, `${where}: the long rail (mockup case) overflows ${L.railScroll.join(' / ')} and scrolls itself, the page does not`);
    }
    assert(Math.abs(L.panel.bottom - L.rail.bottom) <= PX_SLACK, `${where}: panel and rail end on one line`);
  }
  assert(errors.length === 0, `${label}: no page error ${errors.join(' | ')}`);
  return lang;
}

const fadeState = page => page.evaluate(() => {
  const w = document.querySelector('#screenStudy .study-main');
  return { up: w.classList.contains('can-up'), down: w.classList.contains('can-down'),
    before: getComputedStyle(w, '::before').opacity, after: getComputedStyle(w, '::after').opacity };
});
async function checkFadesAndScroll(b) {
  const { page, errors } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.small });
  await openTab(page, 'timeline');
  await page.waitForTimeout(FADE_WAIT_MS);
  let f = await fadeState(page);
  assert(!f.up && f.down && f.after === '1' && f.before === '0', 'panel top: bottom fade only ' + JSON.stringify(f));
  await page.$eval('#studyContent', el => { el.scrollTop = el.scrollHeight / 2; el.dispatchEvent(new Event('scroll')); });
  f = await fadeState(page);
  assert(f.up && f.down, 'panel mid-way: both fades');
  await page.$eval('#studyContent', el => { el.scrollTop = el.scrollHeight; el.dispatchEvent(new Event('scroll')); });
  f = await fadeState(page);
  assert(f.up && !f.down, 'panel bottom: top fade only');
  await page.evaluate(() => studySetTab('people'));
  const top = await page.$eval('#studyContent', el => el.scrollTop);
  f = await fadeState(page);
  assert(top === 0 && !f.up && f.down, `another tab starts at the panel top (scrollTop ${top}), fades refreshed`);
  await page.evaluate(() => { byId('studyContent').scrollTop = 500; studySetGroup('writer'); });
  assert(await page.$eval('#studyContent', el => el.scrollTop) === 0, 'a sub chip starts its list at the top');
  // a bookmark toggle re-renders in place: the panel keeps its offset
  await page.evaluate(() => { studySetGroup('all'); byId('studyContent').scrollTop = 800; });
  const id = await page.evaluate(() => {
    const p = byId('studyContent').getBoundingClientRect();
    const card = [...document.querySelectorAll('#studyContent .fact')].find(c => c.getBoundingClientRect().top > p.top);
    return Number(card.dataset.factId);
  });
  await page.evaluate(i => studyToggleMark('bookmarks', i), id);
  assert(await page.$eval('#studyContent', el => el.scrollTop) === 800, 'bookmark toggle keeps the panel offset');
  await page.evaluate(i => studyToggleMark('bookmarks', i), id);

  // ↩ Back from a fact's Practice: the same panel offset, the card flashes
  await openTab(page, 'chapters');
  await page.evaluate(() => studySetChapter(3));
  const saved = await page.evaluate(fid => {
    const p = byId('studyContent'), card = p.querySelector(`.fact[data-fact-id="${fid}"]`);
    p.scrollTop = card.offsetTop - p.offsetTop - 40;
    return p.scrollTop;
  }, FACT_ID);
  await page.evaluate(fid => startFactPractice(fid), FACT_ID);
  const ret = await page.evaluate(() => sessionReturn);
  assert(ret && ret.kind === 'study' && ret.scrollY === saved, `fact Practice saves the panel offset ${saved} (${JSON.stringify(ret)})`);
  await page.evaluate(() => returnFromSideSession());
  const back = await page.evaluate(fid => ({ top: byId('studyContent').scrollTop, flash: !!document.querySelector(`#studyContent .fact.flash[data-fact-id="${fid}"]`), win: window.scrollY }), FACT_ID);
  assert(Math.abs(back.top - saved) <= 1 && back.flash && back.win === 0, `↩ Back: panel at ${back.top} (saved ${saved}), card flashes, page not scrolled`);
  await page.evaluate(() => goHome());
  await page.evaluate(() => openStudy());
  assert(await page.$eval('#studyContent', el => el.scrollTop) === 0, 'opening Study again starts at the top');
  assert(errors.length === 0, 'no page error: ' + errors.join(' | '));
  await page.close();
}

// < 1024px: wrappers draw nothing, phone order (filter chips above the sub chips), the page scrolls; and back
async function checkBreakpoint(b) {
  const { page, errors } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.small });
  await openTab(page, 'people');
  const phoneState = () => page.evaluate(() => ({
    display: ['.study-cols', '.study-rail', '.study-main'].map(s => getComputedStyle(document.querySelector('#screenStudy ' + s)).display),
    chipsBeforeSub: byId('studyChips').nextElementSibling === byId('studySubChips'),
    panelOverflow: getComputedStyle(byId('studyContent')).overflowY,
    screenDisplay: getComputedStyle(byId('screenStudy')).display,
  }));
  for (const viewport of [dt.VIEWPORTS.belowDesktop, dt.VIEWPORTS.phone]) {
    await dt.setViewport(page, viewport);
    const s = await phoneState();
    const scrolls = !(await dt.pageNotScrolling(page)).ok;
    assert(s.display.every(d => d === 'contents') && s.chipsBeforeSub && s.panelOverflow === 'visible' && s.screenDisplay === 'block' && scrolls,
      `${viewport.width}px: phone layout (wrappers display contents, filter chips above sub chips, the page scrolls) ${JSON.stringify(s)}`);
  }
  await dt.setViewport(page, dt.VIEWPORTS.wide);
  const L = await studyLayout(page);
  assert(L.domChipsAfterCount && (await dt.panelOnlyScroll(page, '#studyContent')).ok, '1280px again: desktop rail order and panel scroll after a resize');
  assert(errors.length === 0, 'no page error: ' + errors.join(' | '));
  await page.close();
}

// v2.2.0 memo tab (mockup desktop-memo.html rev 6): cards in 3 columns below 1280px, 4 from 1280px; badge top right,
// bar at the foot, a row's cards equally high; the "due today" banner above the card panel (not in it), so it stays put
// while the cards scroll. Seeded with groups due today so the banner shows
const MEMO_LS = 'lifeuk.memoProgress';
const MEMO_COLUMNS = { wide: 4, narrow: 3, wideFrom: 1280 };
const MEMO_DUE_IDS = ['vote', 'ww2', 'parliament'];
async function checkMemoList({ page, label, viewport, errors }) {
  await page.evaluate(([k, ids]) => {
    const today = planTodayIso(), p = {};
    ids.forEach(id => { p[id] = { lv: 1, due: today }; });
    localStorage.setItem(k, JSON.stringify(p));
  }, [MEMO_LS, MEMO_DUE_IDS]);
  await openTab(page, 'memo');
  const want = viewport.width >= MEMO_COLUMNS.wideFrom ? MEMO_COLUMNS.wide : MEMO_COLUMNS.narrow;
  const L = await dt.memoListLayout(page);
  assert(L.columns === want, `${label} memo: ${want} card columns (${L.columns})`);
  assert(L.bad.length === 0 && L.unequal === 0, `${label} memo: badge top right, bar at the foot, rows equally high ${L.bad.slice(0, 3).join(' | ')}`);
  assert(L.due && !L.dueInPanel && L.due.bottom <= L.panel.top, `${label} memo: the due banner above the card panel, not in it`);
  await page.$eval('#studyContent', el => { el.scrollTop = el.scrollHeight; el.dispatchEvent(new Event('scroll')); });
  const after = await dt.memoListLayout(page);
  const only = await dt.panelOnlyScroll(page, '#studyContent');
  assert(only.ok && Math.abs(after.due.top - L.due.top) <= PX_SLACK && after.due.top >= 0, `${label} memo: cards scrolled, the banner stays put (${L.due.top.toFixed(1)} → ${after.due.top.toFixed(1)}; ${only.detail})`);
  await openTab(page, 'chapters');
  assert(await page.evaluate(() => !document.querySelector('#screenStudy .memo-due') || !document.querySelector('#screenStudy .memo-due').getClientRects().length),
    `${label}: no due banner on another tab`);
  assert(errors.length === 0, `${label} memo: no page error ${errors.join(' | ')}`);
}

(async () => {
  const b = await dt.launch();
  await dt.forEachCase(b, checkMemoList, { translations: [true] });
  await dt.forEachCase(b, checkCase);
  await checkFadesAndScroll(b);
  await checkBreakpoint(b);
  await b.close();
  console.log('DESKTOP-STUDY PASS');
})().catch(e => { console.error(e.message || e); process.exit(1); });
