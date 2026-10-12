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

(async () => {
  const b = await dt.launch();
  try {
    await checkStatTiles(b);
    console.log('DESKTOP-PLAN PASS');
  } catch (e) {
    console.error(e.message);
    console.log('DESKTOP-PLAN FAIL');
    process.exitCode = 1;
  } finally {
    await b.close();
  }
})();
