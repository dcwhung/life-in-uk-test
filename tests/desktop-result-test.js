// v2.0.0 desktop layout, Result + Flagged (handoff .proj-docs/plans/2026-10-12_handoff_desktop-layout.md §3 #10 / #11,
// §5; mockups/v2.0.0/desktop-result.html A rev 5, desktop-flagged.html B). At 1024 × 768 and 1280 × 800, EN / 中,
// small / large text, translation on / off:
// - Result: one screen high; left 5/12 = score card (Retry / Another exam inside it) + By difficulty, never scrolls
//   (fitLeft() steps is-compact → is-compact2 → is-compact3); right 7/12 = Review Answers, its list scrolls in a panel;
//   one set of buttons (the bottom pair is not shown)
// - Flagged: one screen high; the practise button across the top; the list in 2 columns in a scrolling panel (the
//   v1.4.4 phone pin, .flagged-top sticky, is off here);
//   unflagging the last one shows the empty hint
// - C-006 / W-379: on a short laptop (1366 × 657, 1280 × 720) and at 1024 × 600, large text, 中, exam and practice:
//   when even step ③ does not fit, the left column scrolls (fades) instead of cutting the card; Retry / Another stay
//   in the card and can be scrolled to, clicked and reached by keyboard (focus brings them into view)
// - below 1024px nothing moves (390px: the v1.4 order)
const dt = require('./desktop-helpers');
const { assert } = dt;

const EXAM_ONE = 1;
const FLAGGED_N = 14;

const visible = (page, sel) => page.evaluate(s => {
  const el = document.querySelector(s);
  return !!el && el.getClientRects().length > 0;
}, sel);
const visibleCount = (page, sel) => page.$$eval(sel, els => els.filter(e => e.getClientRects().length > 0).length);
// Exam 1 in exam mode: answer every other question right, leave four blank, flag one, submit
const finishExam1 = page => page.evaluate(n => {
  pendingMode = 'exam'; startExam(n);
  state.questions.forEach((q, i) => {
    if (i >= 20) return;
    state.answers[i] = i % 2 ? [...q.a] : [q.o.findIndex((_, oi) => !q.a.includes(oi))];
  });
  state.flags[6] = true;
  finishExam();
}, EXAM_ONE);
const finishPractice = page => page.evaluate(n => {
  pendingMode = 'practice'; startExam(n);
  state.questions.forEach((q, i) => { state.answers[i] = [...q.a]; state.revealed[i] = true; });
  finishExam();
}, EXAM_ONE);

async function oneScreen(page, label, what) {
  const h = await dt.noHorizontalScroll(page);
  const v = await dt.pageNotScrolling(page);
  assert(h.ok && v.ok, `${label} ${what}: no sideways scroll (${h.detail}), the page does not scroll (${v.detail})`);
}

async function checkResult(page, label, what) {
  await oneScreen(page, label, what);
  const left = await dt.fitsWithoutScroll(page, '.result-left');
  const card = await dt.fitsWithoutScroll(page, '#screenResult .result-card');
  assert(left.ok && card.ok, `${label} ${what}: the left column and score card never scroll (${left.detail}, card ${card.detail})`);
  const steps = await page.$eval('.result-left', e => e.className);
  const only = await dt.panelOnlyScroll(page, '.result-review-panel');
  assert(only.ok, `${label} ${what}: the review list scrolls in its own panel (${only.detail}) [${steps}]`);
  const geo = await page.evaluate(() => {
    const l = document.querySelector('.result-left').getBoundingClientRect(), r = document.querySelector('.result-right').getBoundingClientRect();
    const diff = byId('diffTable').getBoundingClientRect();
    return { side: r.left > l.right, diffBottom: Math.round(diff.bottom), leftBottom: Math.round(l.bottom),
      actionsInCard: !!document.querySelector('#screenResult .result-actions').closest('.result-card') };
  });
  assert(geo.side && geo.actionsInCard, `${label} ${what}: two columns, Retry / Another inside the score card`);
  assert(Math.abs(geo.diffBottom - geo.leftBottom) <= 1, `${label} ${what}: By difficulty sits at the bottom of the left column (${geo.diffBottom} / ${geo.leftBottom})`);
  assert(await visibleCount(page, '#screenResult .another-btn') === 1, `${label} ${what}: one set of buttons`);
}

async function checkJump(page, label) {
  await page.click('#resultDots .rdot:nth-child(20)');
  // smooth scroll: wait until the item has arrived at the top of the panel (or give up and let the assert report)
  await page.waitForFunction(() => {
    const p = document.querySelector('.result-review-panel').getBoundingClientRect(), it = byId('rv19').getBoundingClientRect();
    return Math.abs(it.top - p.top) < p.height / 2;
  }, null, { timeout: 4000 }).catch(() => {});
  const r = await page.evaluate(() => {
    const p = document.querySelector('.result-review-panel').getBoundingClientRect(), it = byId('rv19').getBoundingClientRect();
    return { inside: it.top >= p.top - 1 && it.top < p.bottom, scrolled: document.querySelector('.result-review-panel').scrollTop > 0, page: document.scrollingElement.scrollTop };
  });
  assert(r.inside && r.scrolled && r.page === 0, `${label}: a result dot scrolls the review panel to that question (page stays put): ${JSON.stringify(r)}`);
}

async function checkFlagged(page, label) {
  await page.evaluate(n => {
    allQuestions().slice(0, n).forEach(it => setPracticeFlag(qKey(it), true));
    openFlagged();
  }, FLAGGED_N);
  await oneScreen(page, label, 'flagged');
  const grid = await page.evaluate(() => {
    const items = [...document.querySelectorAll('#flaggedList .flag-item')].map(e => e.getBoundingClientRect());
    const start = byId('flaggedStart').getBoundingClientRect(), list = byId('flaggedList').getBoundingClientRect();
    return { n: items.length, cols: new Set(items.map(r => Math.round(r.left))).size, sameRow: Math.round(items[0].top) === Math.round(items[1].top),
      equal: Math.abs(items[0].height - items[1].height) < 1, startW: start.width, listW: list.width, above: start.bottom <= list.top };
  });
  assert(grid.cols === 2 && grid.sameRow && grid.equal, `${label}: flagged list in 2 columns, a row's cards one height`);
  assert(grid.above && grid.startW >= grid.listW - 1, `${label}: the practise button spans the top`);
  const only = await dt.panelOnlyScroll(page, '#flaggedList');
  assert(only.ok, `${label}: the list scrolls in its own panel: ${only.detail}`);
  // v1.4.4 merge: the phone's pinned block (.flagged-top sticky, reaching over main's padding, scroll-padding for focus)
  // is the phone's; on desktop the list panel scrolls, so the block is plain: in flow, no offset, the header and
  // practise button on main's content edges as before the merge
  const top = await page.evaluate(() => {
    const el = document.querySelector('#screenFlagged .flagged-top'), cs = getComputedStyle(el);
    const scr = byId('screenFlagged').getBoundingClientRect(), r = el.getBoundingClientRect();
    return { pos: cs.position, margin: cs.margin, left: r.left - scr.left, right: scr.right - r.right, top: r.top - scr.top,
      pad: getComputedStyle(document.documentElement).scrollPaddingTop };
  });
  assert(top.pos === 'static' && Math.abs(top.left) < 1 && Math.abs(top.right) < 1 && Math.abs(top.top) < 1 && top.pad === 'auto',
    `${label}: Flagged's v1.4.4 pinned block is off on desktop (the panel scrolls): ` + JSON.stringify(top));
  // unflag everything from the list: the empty hint
  await page.evaluate(() => { keysOf(practiceFlags).forEach(k => setPracticeFlag(k, false)); openFlagged(); });
  assert(await visible(page, '#flaggedList .empty-hint') && !(await visible(page, '#flaggedStart')), `${label}: 0 flagged → empty hint`);
  await oneScreen(page, label, 'flagged, empty');
}

// C-006: the buttons can be scrolled into view inside the card / left column, clicked, and focus brings them on screen
const actionsOnScreen = (page, sel) => page.$eval(sel, el => {
  const inside = (r, b) => r.top >= b.top - 1 && r.bottom <= b.bottom + 1 && r.left >= b.left - 1 && r.right <= b.right + 1;
  const r = el.getBoundingClientRect(), card = el.closest('.result-card').getBoundingClientRect();
  const left = el.closest('.result-left').getBoundingClientRect();
  const view = { top: 0, left: 0, bottom: innerHeight, right: innerWidth };
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { ok: inside(r, view) && inside(r, card) && inside(r, left) && (hit === el || el.contains(hit)),
    detail: `button ${Math.round(r.top)}–${Math.round(r.bottom)}, card ${Math.round(card.top)}–${Math.round(card.bottom)}, column ${Math.round(left.top)}–${Math.round(left.bottom)}` };
});
async function checkShortResult(b) {
  for (const viewport of dt.SHORT_VIEWPORTS) for (const finish of [finishExam1, finishPractice]) {
    const { page, errors, label } = await dt.openDesktop(b, { viewport, lang: 'zh-HK', fontSize: 'large' });
    const what = finish === finishExam1 ? 'exam' : 'practice';
    await finish(page);
    await dt.nextFrame(page);
    const h = await dt.noHorizontalScroll(page);
    const card = await dt.fitsWithoutScroll(page, '#screenResult .result-card');
    assert(h.ok && card.ok, `${label} ${what}: no sideways scroll, the score card never cuts its content (${card.detail})`);
    assert(await page.evaluate(() => !!document.querySelector('#screenResult .result-actions').closest('.result-card')), `${label} ${what}: Retry / Another stay in the card`);
    for (const sel of ['#screenResult .result-card .retry-btn', '#screenResult .result-card .another-btn']) {
      await page.$eval('.result-left', el => { el.scrollTop = 0; });
      await page.focus(sel); // keyboard: focus scrolls it into view
      const focused = await actionsOnScreen(page, sel);
      assert(focused.ok, `${label} ${what}: ${sel.split(' .').pop()} on screen once focused (${focused.detail})`);
      await page.$eval('.result-left', el => { el.scrollTop = 0; });
      await page.$eval(sel, el => el.scrollIntoView({ block: 'nearest' }));
      const shown = await actionsOnScreen(page, sel);
      assert(shown.ok, `${label} ${what}: ${sel.split(' .').pop()} scrolls into view in the left column (${shown.detail})`);
    }
    const reach = await dt.controlsReachable(page);
    assert(reach.ok, `${label} ${what}: every control reachable (${reach.detail})`);
    const fade = await page.evaluate(() => { const l = document.querySelector('.result-left'); l.scrollTop = 0; l.dispatchEvent(new Event('scroll')); return l.closest('.fit-fade') && l.closest('.fit-fade').classList.contains('can-down'); });
    if (await page.$eval('.result-left', el => el.scrollHeight > el.clientHeight + 1)) assert(fade, `${label} ${what}: a scrolling left column fades at the bottom`);
    await page.click('#screenResult .result-card .another-btn');
    assert(await page.evaluate(() => !byId('screenResult').classList.contains('active')), `${label} ${what}: Another can be clicked`);
    assert(errors.length === 0, `${label} ${what}: no page error ` + errors.join(' | '));
    await page.close();
  }
}

const resultOrder = page => page.evaluate(() => [...byId('screenResult').children].filter(e => !e.matches('.result-cols'))
  .map(e => e.id || e.className).join(' | ') + ' // ' + [...document.querySelector('#screenResult .result-card').children].map(e => e.id || e.className).join(' '));

async function checkPhone(b) {
  const { page, errors } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.phone });
  await finishExam1(page);
  const before = await resultOrder(page);
  assert(await visibleCount(page, '#screenResult .another-btn') === 2 && !(await visible(page, '.result-cols')), '390px: v1.4 result (two button rows, no columns)');
  // S-238: as the quiz (S-233), a phone never builds the desktop containers; the first desktop render does
  assert(await page.evaluate(() => !document.querySelector('.result-cols, .result-left, .result-review-panel') && !byId('screenResult').classList.contains('is-fit')),
    'S-238 390px: no desktop result containers built on the phone');
  await dt.setViewport(page, dt.VIEWPORTS.wide);
  assert(await page.evaluate(() => { const cols = document.querySelector('#screenResult .result-cols'); return !!cols && !cols.hidden && !!cols.querySelector('.result-left .result-card .result-actions') && !!cols.querySelector('.result-review-panel #reviewList'); }),
    'S-238 390 → 1280: the desktop columns are built and filled on the first desktop refit');
  await dt.setViewport(page, dt.VIEWPORTS.phone);
  assert(await resultOrder(page) === before, 'S-238 1280 → 390: every result element back in its v1.4 place');
  await dt.setViewport(page, dt.VIEWPORTS.small);
  assert(await page.evaluate(() => !!document.querySelector('#screenResult .result-actions').closest('.result-card')), '390 → 1024: the desktop result takes over on resize');
  await dt.setViewport(page, dt.VIEWPORTS.phone);
  assert(await resultOrder(page) === before, '1024 → 390: every result element back in its v1.4 place');
  assert(await page.evaluate(() => getComputedStyle(byId('reviewList')).overflowY) === 'visible', '390px: the review list does not scroll on its own');
  await page.evaluate(() => { allQuestions().slice(0, 3).forEach(it => setPracticeFlag(qKey(it), true)); openFlagged(); });
  assert(await page.evaluate(() => getComputedStyle(byId('flaggedList')).display) === 'block', '390px: flagged list one column as before');
  assert(errors.length === 0, 'no page error: ' + errors.join(' | '));
  await page.close();
}

(async () => {
  const b = await dt.launch();
  await dt.forEachCase(b, async ({ page, label, errors }) => {
    await finishExam1(page);
    await checkResult(page, label, 'exam result');
    await checkJump(page, label);
    await finishPractice(page);
    await checkResult(page, label, 'practice result');
    await checkFlagged(page, label);
    assert(errors.length === 0, `${label}: no page error ` + errors.join(' | '));
  });
  await checkShortResult(b);
  await checkPhone(b);
  await b.close();
  console.log('DESKTOP-RESULT PASS');
})().catch(e => { console.error(e.message || e); process.exit(1); });
