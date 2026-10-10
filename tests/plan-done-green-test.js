const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
// G43 (user 2026-10-10, preview approved: scratchpad green/1-4): the schedule shows what is finished in green.
// - "Three phases" bar: a phase whose content is 100% done (planPhaseDone) turns green with a ✓ before its name; three
//   distinct greens (learn darkest, drill mid, mock lightest), so two finished phases side by side keep their edge;
//   text ≥ 4.5:1 on each; folded and expanded; screen readers hear "(done)"
// - "Study order": a step whose chapters' facts are all done (planChaptersDone) has a green dot with a ✓ instead of its
//   number, in the expanded steps and the folded stepper; the chapter names stay announced, plus "(done)"
// - day list: today at 100% = a solid green pill "Done today" / 「今日已完成」 (past 100% days keep the light "✓ Done");
//   below 100% today stays "Today n%"; the pill fits the 72px column on one line (plan-schedule-test checkPhaseLabelsAndPill)
// - 320 / 390px en + zh-HK: no horizontal scroll, no label clipped. The entry stays hidden: every flow uses ?preview=plan
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

const TODAY = '2026-10-08'; // a Thursday
const NOW = new Date(TODAY + 'T09:00:00');
const START = '2026-09-28'; // today is Day 11
const GOAL = { examDate: '2026-10-29', dailyMins: 120, restDays: [0], level: 'none' };
const WIDTHS = [320, 390];
const MIN_CONTRAST = 4.5;
const PHASES = ['learn', 'drill', 'mock'];

const fresh = async pg => {
  await pg.goto(APP_URL + '?preview=plan');
  await pg.evaluate(() => localStorage.clear());
  await pg.goto(APP_URL + '?preview=plan');
};
// a plan from START with every task's contents fixed (reviews / wrong facts empty, drills filled), then a log where
// the first `phases` phases are done, the `chapters` given have every fact right, and today is 100% if `today`
async function seed(pg, { phases = 0, chapters = [], today = false } = {}) {
  await pg.evaluate(({ goal, start, phases, chapters, today }) => {
    const plan = buildPlan(goal, start);
    plan.days.forEach(d => d.tasks.forEach(t => {
      if (t.type === PLAN_TASK.review) t.qids = [];
      if (t.type === PLAN_TASK.wrongFacts) Object.assign(t, { facts: [], anchor: {} });
      if (t.type === PLAN_TASK.drill) t.qids = PLAN_CHAPTER_QIDS[t.ch].slice(0, t.quota);
    }));
    const days = {};
    const add = (iso, qids, mocks = 0) => {
      const d = days[iso] || (days[iso] = { ok: {}, bad: {}, mock: [] });
      qids.forEach(k => { d.ok[k] = 1; });
      for (let i = 0; i < mocks; i++) d.mock.push({ exam: 1, correct: 22, total: 24 });
    };
    const fill = d => add(d.date, d.tasks.flatMap(planTaskQids), d.tasks.filter(t => t.type === PLAN_TASK.mock).length);
    [PLAN_PHASE.learn, PLAN_PHASE.drill, PLAN_PHASE.mock].slice(0, phases).forEach(ph => plan.days.filter(d => d.phase === ph).forEach(fill));
    add(start, STUDY.filter(f => chapters.includes(f.ch)).flatMap(planFactQids));
    if (today) fill(planDayAt(plan, planTodayIso()));
    writeStudyPlan(plan);
    writePlanLog({ v: 1, days });
  }, { goal: GOAL, start: START, phases, chapters, today });
}
const openSchedule = (pg, expanded = true) => pg.evaluate(open => {
  leaveToHome();
  openPlanSchedule();
  document.querySelectorAll(`.plan-fold-btn[aria-expanded="${!open}"]`).forEach(b => b.click());
}, expanded);
// each phase segment: done class, the visible name, its screen-reader text, colours and contrast
const phaseState = pg => pg.evaluate(() => {
  const rgb = c => c.match(/[\d.]+/g).map(Number);
  const lum = c => { const v = rgb(c).slice(0, 3).map(x => x / 255).map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  return [...document.querySelectorAll('#planPhaseBar > div')].map(d => {
    const cs = getComputedStyle(d), name = d.querySelector('.plan-ph-name');
    return { cls: d.className, done: d.classList.contains('done'), name: name.textContent, mark: !!name.querySelector('[aria-hidden="true"]'),
      sr: [...d.querySelectorAll('.plan-sr')].map(s => s.textContent).join(''), bg: cs.backgroundColor,
      contrast: Math.min(...[...d.querySelectorAll('span:not(.plan-sr)')].filter(s => s.getClientRects().length).map(s => ratio(getComputedStyle(s).color, cs.backgroundColor))) };
  });
});
const orderState = pg => pg.evaluate(() => {
  const dot = n => ({ text: n.textContent, done: n.classList.contains('done'), hidden: n.getAttribute('aria-hidden'), bg: getComputedStyle(n).backgroundColor, color: getComputedStyle(n).color });
  return {
    steps: [...document.querySelectorAll('#planOrder .plan-ord')].map(s => ({ ...dot(s.querySelector('.plan-ord-n')), name: s.querySelector('.plan-ord-name').textContent,
      sr: [...s.querySelectorAll('.plan-sr')].map(e => e.textContent).join('') })),
    mini: [...document.querySelectorAll('#planOrderMini li')].map(li => ({ ...dot(li.querySelector('.plan-ord-n')),
      sr: [...li.querySelectorAll('.plan-sr')].map(e => e.textContent).join(' ') })),
  };
});
const contrastOf = (pg, fg, bg) => pg.evaluate(([a, b]) => {
  const rgb = c => c.match(/[\d.]+/g).map(Number);
  const lum = c => { const v = rgb(c).slice(0, 3).map(x => x / 255).map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}, [fg, bg]);

async function checkPhases(pg) {
  await fresh(pg);
  await seed(pg);
  await openSchedule(pg);
  const none = await phaseState(pg);
  assert(none.length === 3 && none.every(p => !p.done && !p.name.includes('✓') && !p.sr), 'G43: nothing done → no green, no ✓: ' + JSON.stringify(none.map(p => p.cls)));
  const plain = none.map(p => p.bg);
  const greens = [];
  for (const n of [1, 2, 3]) {
    await seed(pg, { phases: n });
    for (const expanded of [true, false]) {
      await openSchedule(pg, expanded);
      const s = await phaseState(pg);
      const where = `${n} phase(s) done, ${expanded ? 'expanded' : 'folded'}`;
      assert(s.every((p, i) => p.done === i < n), `G43 ${where}: the first ${n} segments are done: ` + JSON.stringify(s.map(p => p.cls)));
      assert(s.every((p, i) => (i < n ? p.name.startsWith('✓') && p.mark && p.sr === '(done)' : !p.name.includes('✓') && !p.sr && p.bg === plain[i])), `G43 ${where}: ✓ (aria-hidden) before the name + "(done)" for screen readers; the others unchanged: ` + JSON.stringify(s));
      assert(s.filter(p => p.done).every(p => p.contrast >= MIN_CONTRAST), `G43 ${where}: text ≥ 4.5:1 on each green: ` + JSON.stringify(s.map(p => p.contrast.toFixed(2))));
      if (n === 3) greens.push(...s.map(p => p.bg));
    }
  }
  const three = greens.slice(0, 3);
  assert(new Set(three).size === 3 && three.every((c, i) => c !== plain[i]), 'G43: three distinct greens, none the phase colour: ' + three.join(' / '));
  const lum = await pg.evaluate(cs => cs.map(c => c.match(/\d+/g).slice(0, 3).map(Number).reduce((s, v) => s + v, 0)), three);
  assert(lum[0] < lum[1] && lum[1] < lum[2], 'G43: learn darkest, drill mid, mock lightest: ' + three.join(' / '));
  await openSchedule(pg);
  const strat = await pg.$$eval('#planStrategy h4', hs => hs.map(h => [...h.querySelectorAll('.plan-sr')].map(s => s.textContent).join('')));
  assert(strat.every(x => x === '(done)'), 'G43: expanded (bar aria-hidden), each finished strategy title carries "(done)" for screen readers: ' + strat);
  await seed(pg, { phases: 1 });
  await openSchedule(pg);
  const strat1 = await pg.$$eval('#planStrategy h4', hs => hs.map(h => h.querySelectorAll('.plan-sr').length));
  assert(strat1.join() === '1,0,0', 'G43: only the finished phase\'s strategy title says "(done)": ' + strat1);
  await seed(pg, { phases: 3 });
  await openSchedule(pg);
  const g = await pg.evaluate(() => getComputedStyle(document.querySelector('#planPhaseBar .plan-bg-mock')).color);
  assert(await contrastOf(pg, g, three[2]) >= MIN_CONTRAST, 'G43: the light mock green takes dark text');
}

async function checkPhaseZh(pg) {
  await pg.evaluate(() => setLang('zh-HK'));
  await openSchedule(pg, false);
  const s = await phaseState(pg);
  assert(s.every(p => p.done && p.name.startsWith('✓') && p.sr === '（已完成）'), 'G43 zh-HK: ✓ + 「（已完成）」: ' + JSON.stringify(s.map(p => [p.name, p.sr])));
  await pg.evaluate(() => setLang('en'));
}

async function checkOrder(pg) {
  await seed(pg, { chapters: [1, 2, 5] });
  for (const expanded of [true, false]) {
    await openSchedule(pg, expanded);
    const o = await orderState(pg);
    const list = expanded ? o.steps : o.mini;
    const where = expanded ? 'expanded steps' : 'folded stepper';
    assert(list.length === 4 && list.map(x => x.done).join() === 'true,true,false,false', `G43 ${where}: Ch 1 + 2 and Ch 5 done, Ch 4 / Ch 3 not: ` + JSON.stringify(list.map(x => x.done)));
    assert(list.every((x, i) => x.text === (x.done ? '✓' : String(i + 1)) && x.hidden === 'true'), `G43 ${where}: a done dot shows ✓, the others their number (dots aria-hidden): ` + JSON.stringify(list.map(x => x.text)));
    assert(list.every(x => x.sr.includes('(done)') === x.done), `G43 ${where}: "(done)" for screen readers on done steps only: ` + JSON.stringify(list.map(x => x.sr)));
    for (const x of list.filter(d => d.done)) assert(await contrastOf(pg, x.color, x.bg) >= MIN_CONTRAST && x.bg !== list[3].bg, `G43 ${where}: white ✓ on green ≥ 4.5:1 (${x.bg})`);
    if (expanded) assert(o.steps[0].name.includes('Ch 1') && o.steps[1].name.includes('Ch 5'), 'G43: the chapter names stay (announced)');
    else assert(o.mini[0].sr.includes('Ch 1') && o.mini[1].sr.includes('Ch 5'), 'G43: the stepper still names its chapters for screen readers');
  }
  const steps = await pg.evaluate(() => PLAN_ORDER_STEPS.length);
  assert(steps === 4, 'four study-order steps');
}

const todayPill = pg => pg.$eval('#planDayList .plan-day.today .plan-pill', e => ({ cls: e.className, text: e.textContent, bg: getComputedStyle(e).backgroundColor, color: getComputedStyle(e).color,
  ok: (() => { const p = document.createElement('span'); p.className = 'plan-pill ok'; document.body.append(p); const c = getComputedStyle(p).backgroundColor; p.remove(); return c; })() }));
async function checkTodayPill(pg) {
  await seed(pg, { chapters: [1] });
  await openSchedule(pg);
  const part = await todayPill(pg);
  assert(/^Today \d+%$/.test(part.text) && part.cls.includes('now'), 'G43: today under 100% unchanged: ' + part.text);
  await seed(pg, { today: true });
  await openSchedule(pg);
  const done = await todayPill(pg);
  assert(done.text === 'Done today' && done.cls.includes('today-done') && !done.cls.includes('now'), 'G43: today at 100% → "Done today": ' + JSON.stringify(done));
  assert(done.bg !== done.ok && await contrastOf(pg, done.color, done.bg) >= MIN_CONTRAST && done.color === 'rgb(255, 255, 255)', 'G43: a solid green pill (not the light ✓ Done), white text ≥ 4.5:1: ' + JSON.stringify(done));
  const side = sel => pg.$eval(sel, e => parseFloat(getComputedStyle(e).paddingLeft));
  const enPad = await side('#planDayList .plan-day.today .plan-pill');
  await pg.evaluate(() => setLang('zh-HK'));
  assert((await todayPill(pg)).text === '今日已完成', 'G43 zh-HK: 「今日已完成」');
  const zhPad = await side('#planDayList .plan-day.today .plan-pill'), usual = await side('#planDayList .plan-day.past .plan-pill');
  assert(zhPad === usual && enPad === 2 && usual === 4, `S-161: zh-HK keeps the usual ${usual}px sides; en "Done today" ${enPad}px to fit 72px: ` + [zhPad, enPad, usual]);
  await pg.evaluate(() => setLang('en'));
}

async function checkWidths(pg) {
  await seed(pg, { phases: 3, today: true });
  for (const lang of ['en', 'zh-HK']) {
    await pg.evaluate(l => setLang(l), lang);
    for (const w of WIDTHS) {
      await pg.setViewportSize({ width: w, height: 800 });
      for (const expanded of [true, false]) {
        await openSchedule(pg, expanded);
        const r = await pg.evaluate(() => {
          const clipped = [...document.querySelectorAll('#planPhaseBar span:not(.plan-sr), #planOrderMini span:not(.plan-sr)')].filter(e => e.getClientRects().length && e.scrollWidth > e.clientWidth + 0.5).map(e => e.textContent);
          const pill = document.querySelector('#planDayList .plan-day.today .plan-pill'), side = pill.closest('.plan-day-side').getBoundingClientRect(), p = pill.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(pill);
          return { clipped, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, pill: pill.textContent,
            lines: new Set([...range.getClientRects()].map(q => Math.round(q.top))).size, fits: p.left >= side.left - 0.5 && p.right <= side.right + 0.5 };
        });
        const where = `${lang} ${w}px ${expanded ? 'expanded' : 'folded'}`;
        assert(r.clipped.length === 0 && r.sw <= r.cw, `G43 ${where}: no label clipped, no horizontal scroll: ` + JSON.stringify(r));
        assert(r.lines === 1 && r.fits, `G43 ${where}: "${r.pill}" on one line inside the date column: ` + JSON.stringify(r));
      }
    }
  }
  await pg.evaluate(() => setLang('en'));
  await pg.setViewportSize({ width: 390, height: 844 });
}

function checkTokens() {
  const read = f => fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8');
  const tokens = read('css/base/tokens.css');
  assert(['--plan-done-learn', '--plan-done-drill', '--plan-done-mock', '--plan-done-mock-text', '--plan-done-step', '--plan-done-today'].every(n => tokens.includes(n + ':')), 'G43: the greens are tokens in tokens.css');
  const css = read('css/screens/plan.css');
  assert(!/#[0-9a-f]{3,8}\b/i.test(css), 'plan.css has no raw hex colour');
  assert(PHASES.every(k => css.includes(`.plan-bg-${k}.done`)), 'plan.css styles each done phase');
}

async function main() {
  checkTokens();
  const b = await chromium.launch(launchOpts);
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.clock.setFixedTime(NOW);
  for (const check of [checkPhases, checkPhaseZh, checkOrder, checkTodayPill, checkWidths]) await check(pg);
  assert(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close();
}
main().then(() => console.log('PLAN-DONE-GREEN PASS')).catch(e => { console.error(e.message); process.exit(1); });
