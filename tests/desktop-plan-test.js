// v2.0.0 desktop layout, Lane A — the study plan screens (handoff .proj-docs/plans/2026-10-12_handoff_desktop-layout.md
// §3 #2 / #3 / #5 / #6, §4 F2 / F3; Design Origin: mockups/v2.0.0/desktop-plan-{goal,schedule,day,run}.html):
// - F2 (every width): the 3 stat tiles ("Overall progress", "Is there enough time?") share label / number / sub rows
// - Plan Goal A: header across, questions 7/12 | feasibility + Build 5/12 (sticky); presets + date one row while no
//   chip is cut
// - Plan Schedule B: one column; the day list scrolls sideways (one column a day, a group a Week) and opens at today
// - Plan Day A: today / calendar / overall 5/12 | tasks 7/12, the task panel never taller than the left column
// - Plan Run A: a centred reading column one screen high; only the fact panel scrolls
// at 1024 × 768 and 1280 × 800, EN / 中 × small / large text (translation on / off where the screen shows any)
const dt = require('./desktop-helpers');
const { assert } = dt;

const PX = 1; // layout slack (sub-pixel rounding)
const near = (a, b, slack = PX) => Math.abs(a - b) <= slack;
const GOAL = { dailyMins: 120, restDays: [0], level: 'none' };

// a plan of `days` days (+ the exam day after them) whose Day `dayN` is today
const seedPlan = (page, { days = 21, dayN = 9, goal = GOAL } = {}) => page.evaluate(({ days, dayN, goal }) => {
  const today = planTodayIso(), start = isoAddDays(today, 1 - dayN);
  writeStudyPlan(buildPlan({ ...goal, examDate: isoAddDays(start, days) }, start));
  writePlanLog(planEmptyLog());
}, { days, dayN, goal });

// ── F2: label / number / sub line rows shared by the tiles; labels sit on their number, subs on the tile bottom ──
const statRows = (page, screen) => page.$$eval(`#${screen} .plan-stat`, tiles => tiles.map(s => {
  const box = sel => s.querySelector(sel).getBoundingClientRect();
  const tile = s.getBoundingClientRect(), pad = parseFloat(getComputedStyle(s).paddingBottom);
  return { kBottom: box('.k').bottom, vTop: box('.v').top, vBottom: box('.v').bottom, sBottom: box('.s').bottom, tileTop: tile.top, inner: tile.bottom - pad };
}));
function rowsAligned(tiles) {
  const rows = [];
  tiles.forEach(t => { const row = rows.find(r => near(r[0].tileTop, t.tileTop)); if (row) row.push(t); else rows.push([t]); });
  return rows.every(row => row.every(t => near(t.vTop, row[0].vTop) && near(t.vBottom, row[0].vBottom) && near(t.sBottom, t.inner, 2)))
    && tiles.every(t => t.kBottom <= t.vTop + PX && t.vTop - t.kBottom < 8);
}
async function checkStatTiles(b) {
  for (const viewport of [{ width: 390, height: 844 }, { width: 600, height: 900 }, dt.VIEWPORTS.small, dt.VIEWPORTS.wide]) {
    for (const lang of dt.LANGS) {
      const { page, errors } = await dt.openDesktop(b, { viewport, lang });
      await seedPlan(page);
      await page.evaluate(() => openPlanDay());
      const day = await statRows(page, 'screenPlanDay');
      assert(day.length === 3 && rowsAligned(day), `F2 ${viewport.width}px ${lang}: Plan Day tiles share label / number / sub rows`);
      await page.evaluate(() => openPlanGoal());
      const goal = await statRows(page, 'screenPlanGoal');
      assert(goal.length === 3 && rowsAligned(goal), `F2 ${viewport.width}px ${lang}: Plan Goal tiles line up too`);
      assert(errors.length === 0, 'no page errors: ' + errors.join(' | '));
      await page.close();
    }
  }
}

// ── column boxes: share of the row, and the phone DOM back below 1024px ──
const colBoxes = (page, boxSel) => page.evaluate(sel => {
  const box = document.querySelector(sel);
  if (!box) return null;
  const r = e => e.getBoundingClientRect();
  return { box: r(box), cols: [...box.children].map(c => ({ ...r(c).toJSON(), pos: getComputedStyle(c).position })), gap: parseFloat(getComputedStyle(box).columnGap) };
}, boxSel);
const shareOk = (l, share) => near(l.cols[0].width, (l.box.width - l.gap) * share, 2);
// every child of the screen's .plan-stack is a direct child again (no column box left)
const phoneStack = (page, screen) => page.evaluate(id => !document.querySelector(`#${id} .plan-cols`)
  && [...document.querySelectorAll(`#${id} .plan-card-box`)].every(c => c.parentElement.classList.contains('plan-stack')), screen);

// ── Plan Goal A rev 2 ──
const goalLook = page => page.evaluate(() => {
  const row = document.querySelector('#screenPlanGoal .plan-date-row'), chips = [...byId('planDaysChips').querySelectorAll('.chip')];
  const pick = document.querySelector('#screenPlanGoal .plan-date-pick').getBoundingClientRect();
  return { stacked: row.classList.contains('is-stacked'), cut: chips.some(c => c.scrollWidth > c.clientWidth + 1),
    oneRow: chips.every(c => near(c.getBoundingClientRect().top, pick.top, 20)),
    steps: document.querySelector('#screenPlanGoal .plan-steps').getBoundingClientRect().width,
    btnInSide: !!document.querySelector('.plan-goal-side #planCreateBtn') && !!document.querySelector('.plan-goal-side .plan-stats'),
    levelsStacked: byId('planLevelGrid').classList.contains('is-stacked') };
  function near(a, b, s) { return Math.abs(a - b) <= s; }
});
async function checkGoal(b) {
  await dt.forEachCase(b, async ({ page, label, errors, viewport, lang, fontSize }) => {
    await page.evaluate(() => openPlanGoal());
    const side = await dt.noHorizontalScroll(page);
    const l = await colBoxes(page, '.plan-goal-cols'), g = await goalLook(page);
    assert(side.ok && l && shareOk(l, 7 / 12) && l.cols[1].pos === 'sticky' && g.btnInSide, `${label}: Goal questions 7/12 | feasibility + Build 5/12 (sticky), no sideways scroll`);
    assert(near(g.steps, l.box.width), `${label}: steps bar across both columns`);
    assert(!g.cut && g.stacked !== g.oneRow, `${label}: presets + date ${g.stacked ? 'two rows' : 'one row'}, no chip cut`);
    if (viewport.width === 1280 && lang === 'en' && fontSize === 'small') assert(!g.stacked, '1280 en small: presets and date share one row (mockup)');
    if (viewport.width === 1024 && lang === 'en') assert(g.stacked, '1024 en: two rows (a chip would be cut, mockup)');
    if (fontSize === 'small') assert(!g.levelsStacked, `${label}: the three level cards in a row`);
    assert(errors.length === 0, `${label}: no page errors ` + errors.join(' | '));
  }, { translations: [true] });
  const { page } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.wide });
  await page.evaluate(() => openPlanGoal());
  await dt.setViewport(page, dt.VIEWPORTS.belowDesktop);
  assert(await phoneStack(page, 'screenPlanGoal'), 'Goal 1023px: the cards back in their phone order');
  assert(!(await goalLook(page)).stacked, 'Goal 1023px: the desktop date-row rule is off');
  await page.close();
}

// ── Plan Schedule B rev 5 + F3 ──
const scheduleLook = page => page.evaluate(() => {
  const list = byId('planDayList'), lb = list.getBoundingClientRect();
  const today = list.querySelector('.plan-day.today') || list.querySelector('.plan-day.exam.past') || list.querySelector('.plan-day.exam');
  const tb = today.getBoundingClientRect(), cols = [...list.querySelectorAll('.plan-day')];
  const card = list.closest('.plan-card-box');
  const tops = cols.slice(0, 6).map(c => c.querySelector('.plan-day-tasks').getBoundingClientRect().top);
  return {
    todayInList: tb.left >= lb.left - 1 && tb.right <= lb.right + 1, todayInWindow: tb.left >= 0 && tb.right <= innerWidth,
    first: Math.abs(tb.left - lb.left) < 30, colW: cols[0].getBoundingClientRect().width, sideways: list.scrollWidth > list.clientWidth,
    pageScrollTop: scrollY, weeks: list.querySelectorAll('.plan-wk').length, rowsInWeeks: cols.every(c => c.parentElement.classList.contains('plan-wk-days')),
    oneLine: cols.slice(0, 3).every(c => { const d = c.querySelector('.plan-day-d'); return d.getBoundingClientRect().height < 2 * parseFloat(getComputedStyle(d).lineHeight || 20) + 8; }),
    tasksOneLine: tops.every(t => Math.abs(t - tops[0]) < 1),
    ctaInCard: !!card.querySelector(':scope > .plan-block[data-action="openPlanDay"]'),
    cueL: list.parentElement.classList.contains('can-l'), cueR: list.parentElement.classList.contains('can-r'),
    strats: getComputedStyle(byId('planStrategy')).gridTemplateColumns.split(' ').length,
    order: getComputedStyle(byId('planOrder')).gridTemplateColumns.split(' ').length,
  };
});
async function checkSchedule(b) {
  await dt.forEachCase(b, async ({ page, label, errors }) => {
    await seedPlan(page, { days: 21, dayN: 13 });
    await page.evaluate(() => openPlanSchedule());
    const side = await dt.noHorizontalScroll(page), s = await scheduleLook(page);
    assert(side.ok && s.sideways && s.weeks === 4 && s.rowsInWeeks, `${label}: Schedule one column; the day list scrolls sideways in Week groups (page: ${side.detail})`);
    assert(s.todayInList && s.todayInWindow && s.first && s.pageScrollTop === 0, `${label}: F3 opens with today's column first in view, the page not moved`);
    assert(near(s.colW, 240, 1) && s.oneLine && s.tasksOneLine, `${label}: 240px columns, "Day n – date" one line, tasks start on one line`);
    assert(s.cueL && s.cueR && s.ctaInCard && s.strats === 3 && s.order === 4, `${label}: ‹ › cues both sides; "View today's tasks" in the card; phases 3 across, order 4 across`);
    assert(errors.length === 0, `${label}: no page errors ` + errors.join(' | '));
  }, { translations: [true] });
  for (const [days, dayN] of [[181, 150], [21, 1], [21, 25]]) {
    const { page } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.small });
    await seedPlan(page, { days, dayN });
    await page.evaluate(() => openPlanSchedule());
    const s = await scheduleLook(page);
    assert(s.todayInList && s.todayInWindow, `F3 ${days} days, Day ${dayN}${dayN > days ? ' (after the exam: the exam day)' : ''}: in view on open`);
    if (dayN === 1) assert(!s.cueL && s.cueR, 'Day 1: no ‹ cue (nothing to the left)');
    await page.close();
  }
  // a language switch keeps the list where it was; below 1024px the phone list (rows, CTA under the card)
  const { page } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.wide });
  await seedPlan(page, { days: 21, dayN: 13 });
  await page.evaluate(() => openPlanSchedule());
  const before = await page.$eval('#planDayList', l => l.scrollLeft);
  await dt.applySettings(page, { lang: 'zh-HK' });
  assert(await page.$eval('#planDayList', l => l.scrollLeft) === before, 'language switch: the day list stays where it was');
  await dt.setViewport(page, dt.VIEWPORTS.belowDesktop);
  const phone = await page.evaluate(() => {
    const list = byId('planDayList'), card = list.closest('.plan-card-box');
    return { weeks: list.querySelectorAll('.plan-wk').length, wrap: list.parentElement.classList.contains('plan-hscroll'),
      cta: card.nextElementSibling && card.nextElementSibling.matches('.plan-block[data-action="openPlanDay"]'), top: list.scrollTop, x: list.scrollWidth <= list.clientWidth + 1 };
  });
  assert(!phone.weeks && !phone.wrap && phone.cta && phone.top > 0 && phone.x, '1023px: the phone list (rows, opened at today), the CTA under the card: ' + JSON.stringify(phone));
  await page.close();
}

// ── Plan Day A rev 4 ──
const dayLook = page => page.evaluate(() => {
  const r = e => (e ? e.getBoundingClientRect() : null);
  const rail = document.querySelector('.plan-day-rail'), panel = document.querySelector('.plan-day-panel'), sc = document.querySelector('.plan-day-scroller');
  return { rail: r(rail), panel: panel && !panel.hidden ? r(panel) : null, sc: r(sc), scrolls: !!sc && sc.scrollHeight > sc.clientHeight + 1,
    hint: !!panel && getComputedStyle(panel.querySelector('.plan-more-hint')).display !== 'none',
    listInPanel: !!sc && sc.contains(byId('planTaskList')), todayInRail: !!rail && rail.contains(byId('planDayHead')),
    todayInBody: !!document.querySelector('.plan-day-body') && document.querySelector('.plan-day-body').contains(byId('planDayHead')) };
});
async function checkDay(b) {
  await dt.forEachCase(b, async ({ page, label, errors }) => {
    await seedPlan(page, { days: 21, dayN: 9 }); // nothing done: earlier days' tasks are carried over, a long list
    await page.evaluate(() => openPlanDay());
    const side = await dt.noHorizontalScroll(page), d = await dayLook(page);
    const l = await colBoxes(page, '.plan-day-cols');
    assert(side.ok && l && shareOk(l, 5 / 12) && d.listInPanel && d.todayInRail, `${label}: Day ring / calendar / overall 5/12 | tasks 7/12`);
    assert(d.sc.height <= d.rail.height + PX && d.scrolls && d.hint, `${label}: the long task panel is no taller than the left column (${Math.round(d.sc.height)} / ${Math.round(d.rail.height)}), scrolls in itself, "↓ More tasks"`);
    await page.$eval('.plan-day-scroller', sc => { sc.scrollTop = sc.scrollHeight; });
    await dt.nextFrame(page);
    assert(!(await dayLook(page)).hint, `${label}: at the bottom the hint goes`);
    assert(errors.length === 0, `${label}: no page errors ` + errors.join(' | '));
  }, { translations: [true] });
  const { page } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.wide });
  await seedPlan(page, { days: 21, dayN: 1 });
  await page.evaluate(() => openPlanDay());
  let d = await dayLook(page);
  assert(d.sc.height < d.rail.height - 50 && !d.scrolls && !d.hint, 'Day 1: a short list keeps its own height, no hint');
  await page.evaluate(() => openPlanDay(planLoad().goal.examDate));
  d = await dayLook(page);
  assert(!d.panel && d.todayInBody, 'the exam day (no tasks): its card in the right column, no task panel');
  await page.evaluate(() => { const rest = planLoad().days.find(x => x.phase === 'rest'); openPlanDay(rest.date); });
  d = await dayLook(page);
  assert(!d.panel && d.todayInBody, 'a rest day: its 😴 card in the right column');
  await page.evaluate(() => openPlanDay());
  await dt.setViewport(page, dt.VIEWPORTS.belowDesktop);
  const phone = await page.evaluate(() => byId('planTaskList').parentElement === byId('planDayHead').closest('.plan-card-box') && !document.querySelector('.plan-day-cols'));
  assert(phone && await phoneStack(page, 'screenPlanDay'), '1023px: the task list back in the today card, phone order');
  await page.close();
}

// ── Plan Run A rev 4: one screen high, only the fact panel scrolls ──
async function checkRun(b) {
  await dt.forEachCase(b, async ({ page, label, errors }) => {
    await seedPlan(page, { days: 21, dayN: 1 });
    await page.evaluate(() => { openPlanDay(); document.querySelector('#planTaskList .plan-task-btn').click(); });
    await page.evaluate(() => document.querySelectorAll('#planRunBody details.fact-mem').forEach(x => { x.open = true; }));
    await dt.nextFrame(page);
    const side = await dt.noHorizontalScroll(page);
    const r = await dt.panelOnlyScroll(page, '.plan-fact-scroll');
    const col = await page.evaluate(() => {
      const body = byId('planRunBody').getBoundingClientRect(), nav = document.querySelector('#planRunBody .plan-run-nav').getBoundingClientRect();
      return { w: body.width, centred: Math.abs(body.left + body.width / 2 - innerWidth / 2) < 2, navBottom: nav.bottom, inner: innerHeight, fade: document.querySelector('.plan-fact-fade').classList.contains('can-down') };
    });
    assert(side.ok && r.ok, `${label}: Run one screen high; the memory aid scrolls in the fact panel (${r.detail})`);
    assert(col.w <= 760 * 1.2 + PX && col.centred && col.navBottom <= col.inner && col.fade, `${label}: centred column ≤ 912px, Prev / Next on screen, bottom fade`);
    assert(errors.length === 0, `${label}: no page errors ` + errors.join(' | '));
  });
  const { page } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.small, lang: 'zh-HK', fontSize: 'large' });
  await seedPlan(page, { days: 21, dayN: 1 });
  await page.evaluate(() => { openPlanDay(); const btn = document.querySelector('#planTaskList .plan-task-btn'); planShowTaskDone(btn.dataset.arg, Number(btn.dataset.task), null); });
  const done = await page.evaluate(() => {
    const card = document.querySelector('#planRunBody .result-card').getBoundingClientRect(), nav = document.querySelector('#planRunBody .nav-row').getBoundingClientRect();
    return { card: card.height, navBottom: nav.bottom, inner: innerHeight };
  });
  assert((await dt.pageNotScrolling(page)).ok && done.card > 200 && done.navBottom <= done.inner, '1024 中 large, task done: the Result card fills the height, buttons on screen: ' + JSON.stringify(done));
  await dt.setViewport(page, dt.VIEWPORTS.belowDesktop);
  assert(await page.evaluate(() => !document.querySelector('.plan-fact-scroll')), '1023px: the phone card');
  await page.close();
}

(async () => {
  const b = await dt.launch();
  try {
    await checkStatTiles(b);
    await checkGoal(b);
    await checkSchedule(b);
    await checkDay(b);
    await checkRun(b);
    console.log('DESKTOP-PLAN PASS');
  } catch (e) {
    console.error(e.message);
    console.log('DESKTOP-PLAN FAIL');
    process.exitCode = 1;
  } finally {
    await b.close();
  }
})();
