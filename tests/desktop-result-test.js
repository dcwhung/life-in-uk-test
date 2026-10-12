// v2.0.0 desktop layout, Result + Flagged (handoff .proj-docs/plans/2026-10-12_handoff_desktop-layout.md §3 #10 / #11,
// §5; mockups/v2.0.0/desktop-result.html A rev 5, desktop-flagged.html B). At 1024 × 768 and 1280 × 800, EN / 中,
// small / large text, translation on / off:
// - Result: one screen high; left 5/12 = score card (Retry / Another exam inside it) + By difficulty, never scrolls
//   (fitLeft() steps is-compact → is-compact2 → is-compact3); right 7/12 = Review Answers, its list scrolls in a panel;
//   one set of buttons (the bottom pair is not shown)
// - Flagged: one screen high; the practise button across the top; the list in 2 columns in a scrolling panel;
//   unflagging the last one shows the empty hint
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
  // unflag everything from the list: the empty hint
  await page.evaluate(() => { keysOf(practiceFlags).forEach(k => setPracticeFlag(k, false)); openFlagged(); });
  assert(await visible(page, '#flaggedList .empty-hint') && !(await visible(page, '#flaggedStart')), `${label}: 0 flagged → empty hint`);
  await oneScreen(page, label, 'flagged, empty');
}

const resultOrder = page => page.evaluate(() => [...byId('screenResult').children].filter(e => !e.matches('.result-cols'))
  .map(e => e.id || e.className).join(' | ') + ' // ' + [...document.querySelector('#screenResult .result-card').children].map(e => e.id || e.className).join(' '));

async function checkPhone(b) {
  const { page, errors } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.phone });
  await finishExam1(page);
  const before = await resultOrder(page);
  assert(await visibleCount(page, '#screenResult .another-btn') === 2 && !(await visible(page, '.result-cols')), '390px: v1.4 result (two button rows, no columns)');
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
  await checkPhone(b);
  await b.close();
  console.log('DESKTOP-RESULT PASS');
})().catch(e => { console.error(e.message || e); process.exit(1); });
