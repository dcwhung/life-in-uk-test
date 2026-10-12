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

(async () => {
  const b = await dt.launch();
  try {
    await checkStatTiles(b);
    await checkGoal(b);
    console.log('DESKTOP-PLAN PASS');
  } catch (e) {
    console.error(e.message);
    console.log('DESKTOP-PLAN FAIL');
    process.exitCode = 1;
  } finally {
    await b.close();
  }
})();
