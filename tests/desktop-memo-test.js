// v2.0.0 desktop layout — the memory-note group screen #screenMemo (v1.6.0, js/screens/memo.js), merged into v2.0.0.
// v2.1.0 Design Origin: mockup: mockups/v2.0.0/desktop-memo.html (rev 6); decision log
// .proj-docs/plans/2026-10-13_grill_desktop-memo.md:
// - ≥ 1024px: one screen high; a top row (‹ Memory + group title | ① Look / ② Test), both halves
// - ① look: left 7/12 = the hook (fixed, its label on its own line) + the memory note panel; right 5/12 = the group's
//   questions panel (pill row + English + Cantonese, no answers); both panels fill the height and scroll on their own
//   (fading); "start the test" under the right column. The single-note group: one white card (centred, ≤ 760 ×
//   scale), each question = pill row → question → "💡 備註：" + note (gold rule); the button under the card's right edge
// - result: see checkResult; no sideways scroll; every control reachable — 1024 × 768 / 1280 × 800, EN / 中, small / large
// - ↩ from a group to Study keeps the card panel's offset (desktop: the panel scrolls, not the page)
// - below 1024px see tests/phone-memo-test.js
const dt = require('./desktop-helpers');
const { assert } = dt;

const COLUMN_MAX = 760;
const PX = 1;
const LIST_OFFSET = 600;
const WRONG_N = 5;
const LOOK_SHARE = 7 / 12; // the left column of ① look
const START_SHARE = 5 / 12; // the single group's button: 5/12 of the card
const SHARE_SLACK = 0.03;

// the group with the longest memory note (the tallest look step), the shortest, and the single-note group
const groupIds = page => page.evaluate(() => {
  const withBody = memoGroups().filter(g => g.body).sort((a, b) => b.body.length - a.body.length);
  return { longest: withBody[0].id, shortest: withBody[withBody.length - 1].id, single: MEMO_SINGLE_ID };
});
const openGroup = (page, id) => page.evaluate(gid => { openStudy(); studySetTab('memo'); openMemoGroup(gid); }, id);
// a failed test with WRONG_N wrong questions: the tallest result step
const openResult = (page, id) => page.evaluate(([gid, n]) => {
  const wrong = allQuestions().slice(0, n).map(it => ({ q: it.q.q, yue: it.q.yue || '', keys: [qKey(it)] }));
  Object.assign(memoView, { id: gid, step: 'result', result: { passed: false, lv: 1, prevLv: 2, correct: 0, total: n, wrong } });
  showMemo();
}, [id, WRONG_N]);

const scale = page => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--desktop-scale')));

// the common checks of a one-screen memo view
async function checkCommon(page, label, what) {
  const side = await dt.noHorizontalScroll(page);
  assert(side.ok, `${label} ${what}: no sideways scroll (${side.detail})`);
  const still = await dt.pageNotScrolling(page);
  assert(still.ok, `${label} ${what}: one screen high, the page does not scroll (${still.detail})`);
  const reach = await dt.controlsReachable(page);
  assert(reach.ok && reach.count > 0, `${label} ${what}: every control reachable (${reach.detail})`);
}
// the top row: ‹ Memory + title in the left half, the steps in the right half, one row
const topRow = page => page.evaluate(() => {
  const box = el => el.getBoundingClientRect();
  const top = document.querySelector('#screenMemo .memo-top'), h = box(document.querySelector('#screenMemo .memo-header')), s = box(byId('memoSteps'));
  const t = top ? box(top) : null;
  return { ok: !!top && h.right <= s.left && Math.abs((h.top + h.bottom) / 2 - (s.top + s.bottom) / 2) <= h.height / 2
    && Math.abs(h.width - s.width) <= 1, detail: `header ${Math.round(h.left)}–${Math.round(h.right)} · steps ${Math.round(s.left)}–${Math.round(s.right)}${t ? ' · row ' + Math.round(t.width) : ''}` };
});
// a scroll panel (.memo-scroll > .fit-panel): its box, whether it scrolls, its fade
const panelInfo = (page, sel) => page.$eval(sel, el => {
  const r = el.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, scrolls: el.scrollHeight > el.clientHeight + 1,
    overflow: getComputedStyle(el).overflowY, fadeDown: el.parentElement.classList.contains('can-down') };
});
const fadeOk = p => !p.scrolls || (['auto', 'scroll'].includes(p.overflow) && p.fadeDown);

// ① look with a memory note
const lookLayout = page => page.evaluate(() => {
  const box = el => el && el.getBoundingClientRect();
  const cols = document.querySelector('#memoBody .memo-look-cols'), colEls = cols ? [...cols.children] : [];
  const hook = document.querySelector('#memoBody .memo-hook'), label = hook && hook.querySelector('b'), text = hook && hook.querySelector('span');
  const start = document.querySelector('#memoBody .memo-start');
  const qs = document.querySelector('#memoBody .memo-questions');
  return {
    cols: colEls.map(c => { const r = box(c); return { left: r.left, right: r.right, width: r.width, top: r.top, bottom: r.bottom }; }),
    gap: colEls.length === 2 ? box(colEls[1]).left - box(colEls[0]).right : 0,
    hookInLeft: !!hook && colEls[0] && colEls[0].contains(hook),
    hookLabelOwnLine: !!label && box(label).bottom <= box(text).top + 1,
    noteInLeft: !!colEls[0] && !!colEls[0].querySelector('.memo-note'),
    start: start && (r => ({ left: r.left, right: r.right, bottom: r.bottom }))(box(start)),
    qsInRight: !!qs && colEls[1] && colEls[1].contains(qs),
    qsTitle: qs && (qs.querySelector('.memo-questions-title') || {}).textContent,
    qsItems: qs ? qs.querySelectorAll('li').length : 0,
    qsKids: qs ? [...qs.querySelectorAll('li')].every(li => [...li.children].every(c => c.matches('.memo-pills, .memo-q, .memo-wrong-yue'))) : false,
    qsPills: qs ? qs.querySelectorAll('li > .memo-pills').length : 0,
    yueShown: qs ? [...qs.querySelectorAll('.memo-wrong-yue')].filter(e => e.getClientRects().length).length : 0,
    folded: document.querySelectorAll('#memoBody details').length,
    viewH: innerHeight,
  };
});
async function checkLook(page, label, id, translation) {
  const what = `look (${id})`;
  await checkCommon(page, label, what);
  const top = await topRow(page);
  assert(top.ok, `${label} ${what}: top row ‹ Memory + title | steps, both halves (${top.detail})`);
  const l = await lookLayout(page);
  assert(l.cols.length === 2, `${label} ${what}: two columns`);
  const share = l.cols[0].width / (l.cols[0].width + l.cols[1].width);
  assert(Math.abs(share - LOOK_SHARE) <= SHARE_SLACK, `${label} ${what}: left column 7/12 (${share.toFixed(3)})`);
  const hasHook = await page.evaluate(gid => !!memoGroupById(gid).hook, id);
  assert(l.noteInLeft && (!hasHook || (l.hookInLeft && l.hookLabelOwnLine)), `${label} ${what}: the hook (label on its own line; ${hasHook ? 'has one' : 'none'}) and the note in the left column`);
  const n = await page.evaluate(gid => questionGroups(memoGroupById(gid).qkeys).length, id);
  const title = await page.evaluate(k => t('memo.questions', { n: k }), n);
  assert(l.qsInRight && l.qsTitle === title && l.qsItems === n && l.qsPills === n && l.qsKids && l.folded === 0,
    `${label} ${what}: the group's questions panel on the right: "${l.qsTitle}", ${l.qsItems} questions with pills, no answers, not folded`);
  assert(translation ? l.yueShown === n : l.yueShown === 0, `${label} ${what}: question translations follow ⚙ translation (${l.yueShown} shown)`);
  const note = await panelInfo(page, '#memoBody .memo-note-scroll > .fit-panel'), qs = await panelInfo(page, '#memoBody .memo-questions');
  assert(Math.abs(note.bottom - qs.bottom) <= PX && Math.abs(note.bottom - l.cols[0].bottom) <= PX, `${label} ${what}: both panels reach the columns' foot (${Math.round(note.bottom)} / ${Math.round(qs.bottom)})`);
  assert(fadeOk(note) && fadeOk(qs), `${label} ${what}: a long panel scrolls on its own, fading at the bottom`);
  assert(l.start && Math.abs(l.start.left - l.cols[1].left) <= PX && Math.abs(l.start.right - l.cols[1].right) <= PX && l.start.bottom <= l.viewH,
    `${label} ${what}: "start the test" under the right column, on screen (${JSON.stringify(l.start)})`);
  return { scrolled: note.scrolls || qs.scrolls };
}
// ① look, the single-note group (design C)
const singleLayout = page => page.evaluate(() => {
  const box = el => el && el.getBoundingClientRect();
  const panel = document.querySelector('#memoBody .memo-single'), start = document.querySelector('#memoBody .memo-start');
  const items = [...document.querySelectorAll('#memoBody .memo-single-item')];
  const main = document.querySelector('main'), m = box(main), pad = parseFloat(getComputedStyle(main).paddingLeft);
  const p = box(panel), s = box(start);
  return {
    width: p.width, centred: Math.abs((p.left - (m.left + pad)) - ((m.right - pad) - p.right)) <= 1,
    startRight: s.right - p.right, startShare: s.width / p.width, startBottom: s.bottom, viewH: innerHeight,
    questions: !!document.querySelector('#memoBody .memo-questions'),
    items: items.map(it => ({ pills: !!it.querySelector(':scope > .memo-pills'), q: !!it.querySelector(':scope > .memo-single-q'),
      label: (it.querySelector('.memo-single-note .memo-note-label') || {}).textContent,
      rule: getComputedStyle(it.querySelector('.memo-single-note')).borderLeftStyle })),
  };
});
async function checkSingle(page, label) {
  const what = 'look (single-note group)';
  await checkCommon(page, label, what);
  const top = await topRow(page);
  assert(top.ok, `${label} ${what}: top row (${top.detail})`);
  const s = await singleLayout(page), max = COLUMN_MAX * await scale(page);
  const noteLabel = await page.evaluate(() => t('common.noteLabel'));
  assert(s.width <= max + PX && s.centred, `${label} ${what}: one card, centred, ≤ ${max}px (${Math.round(s.width)})`);
  assert(!s.questions, `${label} ${what}: no group's questions panel`);
  assert(s.items.length > 0 && s.items.every(it => it.pills && it.q && it.label === noteLabel && it.rule === 'solid'),
    `${label} ${what}: each item = pill row, question, "${noteLabel}" + the note with its rule`);
  assert(Math.abs(s.startRight) <= PX && Math.abs(s.startShare - START_SHARE) <= SHARE_SLACK && s.startBottom <= s.viewH,
    `${label} ${what}: the button under the card's right edge, 5/12 wide (${s.startShare.toFixed(3)})`);
  const p = await panelInfo(page, '#memoBody .memo-single');
  assert(fadeOk(p), `${label} ${what}: the card scrolls on its own, fading`);
}

// result (v2.0.0 centred column; v2.1.0 B in a later step)
const column = page => page.evaluate(() => {
  const box = el => el.getBoundingClientRect();
  const screen = byId('screenMemo'), main = document.querySelector('main');
  const parts = ['.memo-top', '#memoBody'].map(s => box(screen.querySelector(s)));
  const mainBox = box(main), pad = parseFloat(getComputedStyle(main).paddingLeft);
  const inner = { left: mainBox.left + pad, right: mainBox.right - pad };
  const panel = screen.querySelector('.memo-scroll > .memo-panel');
  const acts = screen.querySelector('#memoBody > .memo-actions');
  return {
    widths: parts.map(p => p.width), centred: parts.every(p => Math.abs((p.left - inner.left) - (inner.right - p.right)) <= 1),
    panelScrolls: !!panel && panel.scrollHeight > panel.clientHeight + 1, panelOverflow: panel ? getComputedStyle(panel).overflowY : null,
    fadeDown: !!panel && panel.parentElement.classList.contains('can-down'),
    actsBottom: acts ? box(acts).bottom : null, viewH: innerHeight, isFit: screen.classList.contains('is-fit'),
  };
});
async function checkResult(page, label, what) {
  await checkCommon(page, label, what);
  const c = await column(page);
  const max = COLUMN_MAX * await scale(page);
  assert(c.isFit && c.widths.every(w => w <= max + PX) && c.centred, `${label} ${what}: centred column ≤ ${max}px (${c.widths.map(Math.round).join(' / ')})`);
  assert(c.actsBottom !== null && c.actsBottom <= c.viewH, `${label} ${what}: the buttons on screen (${Math.round(c.actsBottom)} ≤ ${c.viewH})`);
  if (c.panelScrolls) assert(['auto', 'scroll'].includes(c.panelOverflow) && c.fadeDown, `${label} ${what}: the long panel scrolls on its own, fading at the bottom`);
}

async function checkCases(b) {
  let longScrolled = false;
  await dt.forEachCase(b, async ({ page, label, errors, translation }) => {
    const ids = await groupIds(page);
    for (const id of [ids.longest, ids.shortest]) {
      await openGroup(page, id);
      await dt.nextFrame(page);
      const c = await checkLook(page, label, id, translation);
      if (id === ids.longest) longScrolled = longScrolled || c.scrolled;
    }
    await openGroup(page, ids.single);
    await dt.nextFrame(page);
    await checkSingle(page, label);
    await openResult(page, ids.longest);
    await dt.nextFrame(page);
    await checkResult(page, label, `result (${WRONG_N} wrong)`);
    assert(errors.length === 0, `${label}: no page errors ` + errors.join(' | '));
  });
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

(async () => {
  const b = await dt.launch();
  let failed = false;
  try {
    await checkCases(b);
    await checkBackKeepsPanel(b);
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
