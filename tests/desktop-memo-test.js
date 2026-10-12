// v2.0.0 desktop layout — the memory-note group screen #screenMemo (v1.6.0, js/screens/memo.js), merged into v2.0.0.
// Design Origin: baseline: Plan Run desktop 置中欄（用戶 2026-10-12 決定，冇 mockup）— the same centred reading column as
// Plan Run (mockups/v2.0.0/desktop-plan-run.html A rev 4; handoff .proj-docs/plans/2026-10-12_handoff_desktop-layout.md §3 #6):
// - ≥ 1024px: one screen high; header, steps and body in a centred column at most 760px × --desktop-scale wide; the
//   memory note / result panel scrolls on its own (fading at its ends) when long, so "start the test" / Again / Next
//   stay on the screen; no sideways scroll; every control reachable — 1024 × 768 / 1280 × 800, EN / 中, small / large
// - ↩ from a group to Study keeps the card panel's offset (desktop: the panel scrolls, not the page)
// - below 1024px the phone layout is unchanged (the page scrolls, the panel does not)
const dt = require('./desktop-helpers');
const { assert } = dt;

const COLUMN_MAX = 760;
const PX = 1;
const LIST_OFFSET = 600;
const WRONG_N = 5;

// the group with the longest memory note (the tallest look step) and the single-note group
const groupIds = page => page.evaluate(() => {
  const withBody = memoGroups().filter(g => g.body).sort((a, b) => b.body.length - a.body.length);
  return { longest: withBody[0].id, single: MEMO_SINGLE_ID };
});
const openGroup = (page, id) => page.evaluate(gid => { openStudy(); studySetTab('memo'); openMemoGroup(gid); }, id);
// a failed test with WRONG_N wrong questions: the tallest result step
const openResult = (page, id) => page.evaluate(([gid, n]) => {
  const wrong = allQuestions().slice(0, n).map(it => ({ q: it.q.q, yue: it.q.yue || '' }));
  Object.assign(memoView, { id: gid, step: 'result', result: { passed: false, lv: 1, prevLv: 2, correct: 0, total: n, wrong } });
  showMemo();
}, [id, WRONG_N]);

const column = page => page.evaluate(() => {
  const box = el => el.getBoundingClientRect();
  const screen = byId('screenMemo'), main = document.querySelector('main');
  const parts = ['.memo-header', '#memoSteps', '#memoBody'].map(s => box(screen.querySelector(s)));
  const mainBox = box(main), pad = parseFloat(getComputedStyle(main).paddingLeft);
  const inner = { left: mainBox.left + pad, right: mainBox.right - pad };
  const panel = screen.querySelector('.memo-scroll > .memo-panel');
  const acts = screen.querySelector('#memoBody > .memo-start, #memoBody > .memo-actions');
  return {
    widths: parts.map(p => p.width), centred: parts.every(p => Math.abs((p.left - inner.left) - (inner.right - p.right)) <= 1),
    panelScrolls: !!panel && panel.scrollHeight > panel.clientHeight + 1, panelOverflow: panel ? getComputedStyle(panel).overflowY : null,
    fadeDown: !!panel && panel.parentElement.classList.contains('can-down'),
    actsBottom: acts ? box(acts).bottom : null, viewH: innerHeight, isFit: screen.classList.contains('is-fit'),
  };
});

async function checkScreen(page, label, what) {
  const side = await dt.noHorizontalScroll(page);
  assert(side.ok, `${label} ${what}: no sideways scroll (${side.detail})`);
  const still = await dt.pageNotScrolling(page);
  assert(still.ok, `${label} ${what}: one screen high, the page does not scroll (${still.detail})`);
  const c = await column(page);
  const max = await page.evaluate(w => w * parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--desktop-scale')), COLUMN_MAX);
  assert(c.isFit && c.widths.every(w => w <= max + PX) && c.centred, `${label} ${what}: centred column ≤ ${max}px (${c.widths.map(Math.round).join(' / ')})`);
  assert(c.actsBottom !== null && c.actsBottom <= c.viewH, `${label} ${what}: the buttons on screen (${Math.round(c.actsBottom)} ≤ ${c.viewH})`);
  if (c.panelScrolls) assert(['auto', 'scroll'].includes(c.panelOverflow) && c.fadeDown, `${label} ${what}: the long panel scrolls on its own, fading at the bottom`);
  const reach = await dt.controlsReachable(page);
  assert(reach.ok && reach.count > 0, `${label} ${what}: every control reachable (${reach.detail})`);
  return c;
}

async function checkCases(b) {
  let longScrolled = false;
  await dt.forEachCase(b, async ({ page, label, errors }) => {
    const ids = await groupIds(page);
    await openGroup(page, ids.longest);
    await dt.nextFrame(page);
    const c = await checkScreen(page, label, `look (${ids.longest})`);
    longScrolled = longScrolled || c.panelScrolls;
    await openGroup(page, ids.single);
    await dt.nextFrame(page);
    await checkScreen(page, label, 'look (single-note group)');
    await openResult(page, ids.longest);
    await dt.nextFrame(page);
    await checkScreen(page, label, `result (${WRONG_N} wrong)`);
    assert(errors.length === 0, `${label}: no page errors ` + errors.join(' | '));
  }, { translations: [true] });
  assert(longScrolled, 'the longest memory note overflows its panel somewhere in the matrix (the scroll case is covered)');
}

// ↩ from a group: Study's card panel is where it was (desktop: the panel scrolls, the page stays at 0)
async function checkBackKeepsPanel(b) {
  const { page, errors } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.small });
  await page.evaluate(y => { openStudy(); studySetTab('memo'); byId('studyContent').scrollTop = y; }, LIST_OFFSET);
  const id = await page.evaluate(() => {
    const p = byId('studyContent').getBoundingClientRect();
    return [...document.querySelectorAll('#studyContent .memo-card')].find(c => c.getBoundingClientRect().top > p.top).dataset.arg;
  });
  await page.click(`#studyContent .memo-card[data-arg="${id}"]`);
  assert(await page.evaluate(() => byId('screenMemo').classList.contains('active')), 'a memo card opens its group');
  await page.click('#screenMemo .memo-back');
  const back = await page.evaluate(() => ({ panel: byId('studyContent').scrollTop, page: window.scrollY, study: byId('screenStudy').classList.contains('active') }));
  assert(back.study && Math.abs(back.panel - LIST_OFFSET) <= PX && back.page === 0, `‹ Memory: Study's card panel back at ${LIST_OFFSET}px: ` + JSON.stringify(back));
  assert(errors.length === 0, 'back: no page errors ' + errors.join(' | '));
  await page.close();
}

// the phone keeps its layout: the page scrolls a long note, the panel itself does not
async function checkPhone(b) {
  const { page, errors } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.phone });
  const ids = await groupIds(page);
  await openGroup(page, ids.longest);
  const p = await page.evaluate(() => {
    const panel = document.querySelector('#memoBody .memo-panel'), el = document.scrollingElement;
    return { overflow: getComputedStyle(panel).overflowY, pageScrolls: el.scrollHeight > el.clientHeight + 1,
      screenH: getComputedStyle(byId('screenMemo')).height, sideways: el.scrollWidth > el.clientWidth + 1 };
  });
  assert(p.overflow === 'visible' && p.pageScrolls && !p.sideways, '390px: the page scrolls the long note, the panel does not: ' + JSON.stringify(p));
  assert(errors.length === 0, 'phone: no page errors ' + errors.join(' | '));
  await page.close();
}

(async () => {
  const b = await dt.launch();
  let failed = false;
  try {
    await checkCases(b);
    await checkBackKeepsPanel(b);
    await checkPhone(b);
    console.log('DESKTOP-MEMO PASS');
  } catch (e) {
    failed = true;
    console.error(e.message);
    console.log('DESKTOP-MEMO FAIL');
  } finally {
    await b.close();
    if (failed) process.exitCode = 1;
  }
})();
