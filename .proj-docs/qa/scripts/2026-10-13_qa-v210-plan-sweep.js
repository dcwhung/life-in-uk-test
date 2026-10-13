// screenshot plan screens on a given build (APP_ROOT) into OUT
const { chromium } = require('playwright-core');
const path = require('path'), fs = require('fs');
const ROOT = process.argv[2], OUT = process.argv[3];
fs.mkdirSync(OUT, { recursive: true });
const APP = 'file://' + path.resolve(ROOT, 'index.html');
const TODAY = '2026-10-13';
const PLANS = {
  three: [{ examDate: '2026-11-03', dailyMins: 120, restDays: [0], level: 'none' }, '2026-10-06'],
  two: [{ examDate: '2026-10-20', dailyMins: 30, restDays: [], level: 'none' }, TODAY],
  long: [{ examDate: '2026-12-01', dailyMins: 60, restDays: [0, 6], level: 'some' }, '2026-10-01'],
};
const SCREENS = {
  home: () => { /* home */ },
  goalNew: () => openPlanGoal(),
  goalEdit: () => openPlanGoal(planLoad().goal),
  schedule: () => openPlanSchedule(),
  day: () => openPlanDay(),
};
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.CHROMIUM_PATH });
  for (const vp of [{ width: 390, height: 844 }, { width: 1024, height: 768 }, { width: 1280, height: 800 }]) for (const lang of ['en', 'zh-HK']) for (const plan in PLANS) {
    const ctx = await b.newContext({ viewport: vp }); const pg = await ctx.newPage();
    await pg.clock.setFixedTime(new Date(TODAY + 'T09:00:00'));
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(APP);
    await pg.evaluate(l => { localStorage.clear(); localStorage.setItem('lifeuk.uiLang', JSON.stringify(l)); localStorage.setItem('lifeuk.fontSize', '"small"'); }, lang);
    await pg.goto(APP);
    await pg.evaluate(([g, s]) => { writeStudyPlan(buildPlan(g, s)); }, PLANS[plan]);
    for (const sc in SCREENS) {
      if (plan !== 'three' && (sc === 'goalNew')) continue;
      await pg.goto(APP);
      await pg.evaluate(() => { try { localStorage.removeItem(PLAN_SCHEDULE_SEEN_LS); } catch (e) {} });
      await pg.evaluate(`(${SCREENS[sc].toString()})()`);
      await pg.waitForTimeout(400);
      await pg.screenshot({ path: path.join(OUT, `${sc}-${plan}-${vp.width}-${lang}.png`), fullPage: true });
    }
    if (errs.length) console.log('ERRORS', vp.width, lang, plan, errs.join('|'));
    await ctx.close();
  }
  await b.close();
})();
