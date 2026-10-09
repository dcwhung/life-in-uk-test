// QA v1.0.2 — study plan UI exploratory checks (goal form + schedule) at 320 / 360 / 390 / 600px, en + zh-HK,
// plus flows (language switch, change goal, reset, rest-day toggle) and .chip / .chip-row regression vs a baseline.
// usage: NODE_PATH=/opt/node-tools/node_modules node 2026-10-09_qa-v102-plan-ui.js <new-root> <old-root> <shot-dir>
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const [NEW_ROOT, OLD_ROOT, OUT] = process.argv.slice(2);
const CHROMIUM = process.env.CHROMIUM_PATH;
const NOW = new Date('2026-10-08T09:00:00');
const WIDTHS = [320, 360, 390, 600];
const LANGS = ['en', 'zh-HK'];
const GOAL = { examDate: '2026-10-29', dailyMins: 120, restDays: [0], level: 'none' };
const START = '2026-09-28';
let pass = 0, fail = 0;
const fails = [];
const ck = (c, m) => { if (c) pass++; else { fail++; fails.push(m); console.log('FAIL:', m); } };
const url = (root, q = '?preview=plan') => 'file://' + path.resolve(root, 'index.html') + q;

async function fresh(pg, root, q) { await pg.goto(url(root, q)); await pg.evaluate(() => localStorage.clear()); await pg.goto(url(root, q)); }
async function seed(pg) {
  await pg.evaluate(({ goal, start }) => {
    const plan = buildPlan(goal, start);
    writeStudyPlan(plan);
    const qidsOf = d => d.tasks.flatMap(planTaskQids);
    const ok = l => Object.fromEntries(l.map(k => [k, 1]));
    const d2 = plan.days[1], d3 = plan.days[2];
    writePlanLog({ v: 1, days: { [d2.date]: { ok: ok(qidsOf(d2)) }, [d3.date]: { ok: ok(qidsOf(d3).slice(0, 5)) } } });
  }, { goal: GOAL, start: START });
}
const noHScroll = pg => pg.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

// ── goal form ──
async function goalChecks(pg, tag) {
  const r = await pg.evaluate(() => {
    const rect = e => e.getBoundingClientRect();
    const pre = [...document.querySelectorAll('#planDaysChips .chip')];
    const rest = [...document.querySelectorAll('#planRestChips .chip')];
    const pick = document.querySelector('.plan-date-pick');
    const row = (els) => ({ n: els.length, tops: new Set(els.map(e => Math.round(rect(e).top))).size,
      ws: els.map(e => +rect(e).width.toFixed(1)), clipped: els.filter(e => e.scrollWidth > e.clientWidth + 0.5).map(e => e.textContent),
      lines: els.filter(e => { const rg = document.createRange(); rg.selectNodeContents(e); return new Set([...rg.getClientRects()].map(q => Math.round(q.top))).size > 1; }).map(e => e.textContent),
      labels: els.map(e => e.textContent) });
    const card = document.querySelector('#planDaysChips').getBoundingClientRect();
    return { pre: row(pre), rest: row(rest), pickTop: rect(pick).top, preBottom: Math.max(...pre.map(e => rect(e).bottom)),
      pickRight: rect(pick).right, cardRight: card.right, preRight: rect(pre[3]).right, preLeft: rect(pre[0]).left, cardLeft: card.left,
      pickInputRight: rect(pick.querySelector('input')).right };
  });
  const eq = ws => Math.max(...ws) - Math.min(...ws) <= 1;
  ck(r.pre.n === 4 && r.pre.tops === 1, `${tag} goal: 4 presets on one row (${r.pre.n}, rows ${r.pre.tops})`);
  ck(eq(r.pre.ws), `${tag} goal: presets equal width ${r.pre.ws}`);
  ck(r.pre.clipped.length === 0 && r.pre.lines.length === 0, `${tag} goal: preset labels unclipped, 1 line ${JSON.stringify(r.pre.clipped)} ${JSON.stringify(r.pre.lines)}`);
  ck(Math.abs(r.preLeft - r.cardLeft) <= 1 && Math.abs(r.preRight - r.cardRight) <= 1, `${tag} goal: presets span the row`);
  ck(r.pickTop >= r.preBottom, `${tag} goal: "or exam date" on its own row below presets`);
  ck(r.pickInputRight <= r.cardRight + 0.5, `${tag} goal: date input inside the card`);
  ck(r.rest.n === 7 && r.rest.tops === 1, `${tag} goal: 7 rest chips one row (rows ${r.rest.tops})`);
  ck(eq(r.rest.ws), `${tag} goal: rest chips equal width ${r.rest.ws}`);
  ck(r.rest.clipped.length === 0 && r.rest.lines.length === 0, `${tag} goal: rest labels unclipped ${JSON.stringify(r.rest.clipped)}`);
  ck(await noHScroll(pg), `${tag} goal: no horizontal scroll`);
  return r;
}

// ── schedule ──
const BAR_STEP = w => (w <= 339 ? 96 : w <= 374 ? 120 : 150);
async function scheduleChecks(pg, tag, w, lang) {
  const r = await pg.evaluate(() => {
    const rect = e => e.getBoundingClientRect();
    const segs = [...document.querySelectorAll('#planPhaseBar > div')].map(d => {
      const n = d.querySelector('.plan-ph-name'), dd = d.querySelector('.plan-ph-days');
      return { w: rect(d).width, nameBottom: rect(n).bottom, daysTop: rect(dd).top, days: dd.textContent, name: n.textContent,
        clip: [n, dd].some(e => e.scrollWidth > e.clientWidth + 0.5) };
    });
    const card = document.querySelector('#planOrder') || document.querySelector('.plan-chw').closest('.card, section, div');
    const chw = [...document.querySelectorAll('.plan-chw')].map(c => {
      const bar = c.querySelector('.plan-chw-bar'), cnt = c.querySelector('.plan-chw-c');
      return { bw: rect(bar).width, bx: rect(bar).left, gap: rect(cnt).left + (cnt.clientWidth - (() => { const rg = document.createRange(); rg.selectNodeContents(cnt); return rg.getBoundingClientRect().width; })()) - rect(bar).right,
        textGap: (() => { const rg = document.createRange(); rg.selectNodeContents(cnt); return rg.getBoundingClientRect().left - rect(bar).right; })(),
        cntRight: (() => { const rg = document.createRange(); rg.selectNodeContents(cnt); return rg.getBoundingClientRect().right; })(), rowRight: rect(c).right, txt: cnt.textContent };
    });
    const screen = document.querySelector('#screenPlanSchedule');
    const qWords = (screen.textContent.match(/\d+\s+questions?\b/g) || []);
    const qsCount = (screen.textContent.match(/\d+\s+Qs?\b/g) || []).length;
    const rows = [...document.querySelectorAll('#planDayList .plan-day')];
    const fullName = /Ch \d+ [A-Z]/;
    const dayInfo = rows.map(row => {
      const side = row.querySelector('.plan-day-side'), box = side && side.querySelector('.plan-day-d'), pill = side && side.querySelector('.plan-pill');
      const tasks = [...row.querySelectorAll('.plan-day-t')].map(e => e.textContent);
      const chs = row.querySelector('.plan-day-chs');
      return { cls: row.className, cols: getComputedStyle(row).gridTemplateColumns, sideW: side ? rect(side).width : -1,
        pill: pill ? pill.textContent : null, pillBelow: pill ? rect(pill).top >= rect(box).bottom - 0.5 : null,
        pillIn: pill ? rect(pill).left >= rect(side).left - 0.5 && rect(pill).right <= rect(side).right + 0.5 : null,
        tasksFull: tasks.filter(x => fullName.test(x)), chs: chs ? chs.textContent : null, chsLast: chs ? chs === row.querySelector('.plan-day-tasks').lastElementChild : null,
        tasksCh: [...new Set(tasks.join(' ').match(/Ch \d+/g) || [])], kids: row.children.length };
    });
    return { segs, chw, qWords, qsCount, dayInfo, orderRight: rect(document.querySelector('.plan-chw').parentElement).right };
  });
  const ws = r.segs.map(s => s.w);
  ck(r.segs.length === 3 && Math.max(...ws) - Math.min(...ws) <= 1, `${tag} sched: 3 equal phase segments ${ws.map(x => x.toFixed(1))}`);
  ck(r.segs.every(s => s.daysTop >= s.nameBottom - 0.5), `${tag} sched: day count on second line`);
  ck(r.segs.every(s => !s.clip), `${tag} sched: phase labels unclipped`);
  ck(r.segs.every(s => (lang === 'en' ? /^\d+ days?$/ : /^\d+ 日$/).test(s.days)), `${tag} sched: "n days" text ${r.segs.map(s => s.days)}`);
  const bw = r.chw.map(c => Math.round(c.bw));
  ck(bw.every(b => b === BAR_STEP(w)), `${tag} sched: order bars ${bw} == ${BAR_STEP(w)}px`);
  ck(r.chw.every(c => c.textGap >= 12 - 0.5), `${tag} sched: >=12px gap bar->count ${r.chw.map(c => c.textGap.toFixed(1))}`);
  ck(r.chw.every(c => c.cntRight <= c.rowRight + 0.5), `${tag} sched: counts inside row`);
  if (w > 480) ck(new Set(r.chw.map(c => Math.round(c.bx))).size === 1, `${tag} sched: bars aligned (same x) on wide layout`);
  if (lang === 'en') {
    ck(r.qWords.length === 0, `${tag} sched: no "<n> questions" in en: ${r.qWords.slice(0, 3)}`);
    ck(r.qsCount > 0 && r.chw.every(c => /Qs$/.test(c.txt)), `${tag} sched: en counts use Qs`);
  } else {
    ck(r.chw.every(c => /題/.test(c.txt)), `${tag} sched: zh-HK counts use 題`);
  }
  const study = r.dayInfo.filter(d => !/\b(rest|exam)\b/.test(d.cls) && d.tasksCh.length);
  ck(r.dayInfo.every(d => d.tasksFull.length === 0), `${tag} sched: task lines show "Ch n" only`);
  ck(study.every(d => d.chs && d.chsLast), `${tag} sched: study days end with remarks line (${study.length} days)`);
  ck(study.every(d => d.tasksCh.every(c => d.chs.includes(c + ' '))), `${tag} sched: remarks names every Ch n used in tasks`);
  ck(r.dayInfo.filter(d => /\brest\b/.test(d.cls)).every(d => d.chs === null), `${tag} sched: rest days have no remarks line`);
  ck(r.dayInfo.every(d => d.kids === 2 && Math.round(d.sideW) === 64), `${tag} sched: every row 2 cols, side 64px`);
  const past = r.dayInfo.filter(d => /\bpast\b/.test(d.cls)), today = r.dayInfo.filter(d => /\btoday\b/.test(d.cls)),
    ahead = r.dayInfo.filter(d => !/\b(past|today)\b/.test(d.cls) && !/\bexam\b/.test(d.cls)), exam = r.dayInfo.filter(d => /\bexam\b/.test(d.cls));
  ck(past.length === 10 && past.every(d => d.pill && d.pillBelow && d.pillIn), `${tag} sched: past rows (${past.length}) pill under date, in column`);
  ck(today.length === 1 && today[0].pill && today[0].pillBelow && today[0].pillIn, `${tag} sched: today row pill ${today[0] && today[0].pill}`);
  ck(ahead.filter(d => !/\brest\b/.test(d.cls)).every(d => d.pill === null), `${tag} sched: ahead study rows no pill`);
  ck(exam.length === 1 && exam[0].pill === null && exam[0].kids === 2, `${tag} sched: exam row 2 cols, no pill`);
  ck(await noHScroll(pg), `${tag} sched: no horizontal scroll`);
  // "Today 0%" one line
  const z = await pg.evaluate(() => {
    const pill = document.querySelector('#planDayList .plan-day.today .plan-pill'), was = pill.textContent;
    pill.textContent = t('plan.status.today', { n: 0 });
    const rg = document.createRange(); rg.selectNodeContents(pill);
    const n = new Set([...rg.getClientRects()].map(q => Math.round(q.top))).size; const txt = pill.textContent; pill.textContent = was; return { n, txt };
  });
  ck(z.n === 1, `${tag} sched: "${z.txt}" on one line`);
  return r;
}

async function shot(pg, name, sel) {
  const p = path.join(OUT, name + '.png');
  if (sel) { const e = await pg.$(sel); if (e) await e.screenshot({ path: p }); } else await pg.screenshot({ path: p, fullPage: false });
}

async function layoutMatrix(pg) {
  await fresh(pg, NEW_ROOT);
  await seed(pg);
  for (const lang of LANGS) {
    await pg.evaluate(l => setLang(l), lang);
    for (const w of WIDTHS) {
      await pg.setViewportSize({ width: w, height: 900 });
      const tag = `${lang} ${w}px`;
      await pg.evaluate(() => openPlanGoal());
      await goalChecks(pg, tag + ' new');
      await shot(pg, `goal-new-${lang}-${w}`, '#screenPlanGoal .plan-stack');
      await pg.evaluate(() => openPlanSchedule());
      await scheduleChecks(pg, tag, w, lang);
      await shot(pg, `sched-top-${lang}-${w}`);
      await pg.$eval('#planDayList', e => e.scrollIntoView());
      await shot(pg, `sched-days-${lang}-${w}`, '#planDayList');
      await pg.evaluate(() => byId('planDayList').scrollTo({ top: 1e6, behavior: 'instant' }));
      await shot(pg, `sched-exam-${lang}-${w}`, '#planDayList');
      await pg.click('#screenPlanSchedule [data-action="planEditGoal"]');
      await goalChecks(pg, tag + ' edit');
    }
  }
}

// language switch via the header pill on the schedule; layout re-checked in the new language
async function langSwitch(pg) {
  await fresh(pg, NEW_ROOT); await seed(pg);
  for (const w of [320, 390]) {
    await pg.setViewportSize({ width: w, height: 900 });
    await pg.evaluate(() => { setLang('en'); openPlanSchedule(); });
    await pg.click('#langBtn');
    const l = await pg.evaluate(() => getLang());
    ck(l === 'zh-HK', `lang switch ${w}: en -> zh-HK`);
    await scheduleChecks(pg, `switch->zh ${w}px`, w, 'zh-HK');
    await pg.click('#langBtn');
    await scheduleChecks(pg, `switch->en ${w}px`, w, 'en');
    await shot(pg, `switch-back-en-${w}`);
  }
}

// change goal: pick a preset, toggle rest days, re-plan; past days kept; layout again
async function changeGoalFlow(pg) {
  await pg.setViewportSize({ width: 360, height: 900 });
  for (const lang of LANGS) {
    await fresh(pg, NEW_ROOT); await seed(pg);
    await pg.evaluate(l => { setLang(l); openPlanSchedule(); }, lang);
    const before = await pg.evaluate(() => JSON.stringify(readStudyPlan().days.filter(d => d.date < '2026-10-08')));
    await pg.click('#screenPlanSchedule [data-action="planEditGoal"]');
    await pg.click('#planDaysChips .chip >> nth=3');
    // toggle Saturday (index 6) on, Sunday (0) off
    const restBefore = await pg.evaluate(() => [...planGoalDraft.restDays]);
    await pg.click('#planRestChips .chip >> nth=6');
    await pg.click('#planRestChips .chip >> nth=0');
    const st = await pg.evaluate(() => ({ rest: [...planGoalDraft.restDays].sort(), active: [...document.querySelectorAll('#planRestChips .chip')].map(e => e.classList.contains('active')),
      pressed: [...document.querySelectorAll('#planRestChips .chip')].map(e => e.getAttribute('aria-pressed')), presetActive: [...document.querySelectorAll('#planDaysChips .chip')].map(e => e.classList.contains('active')) }));
    ck(JSON.stringify(restBefore) === '[0]', `${lang} change goal: prefilled rest [0]`);
    ck(st.rest.join() === '6' && st.active[6] && !st.active[0] && st.pressed[6] === 'true' && st.pressed[0] === 'false', `${lang} rest toggle: Sat on, Sun off, aria-pressed ${JSON.stringify(st.pressed)}`);
    ck(st.presetActive[3] && st.presetActive.filter(Boolean).length === 1, `${lang} preset 4 active only`);
    await goalChecks(pg, `${lang} 360 after toggles`);
    await shot(pg, `goal-toggled-${lang}-360`, '#screenPlanGoal .plan-stack');
    // all 7 on, then back
    for (let i = 0; i < 7; i++) if (!(await pg.evaluate(i => document.querySelectorAll('#planRestChips .chip')[i].classList.contains('active'), i))) await pg.click(`#planRestChips .chip >> nth=${i}`);
    const all = await pg.evaluate(() => ({ dis: byId('planCreateBtn').disabled, hint: byId('planGoalHint').textContent, rows: new Set([...document.querySelectorAll('#planRestChips .chip')].map(e => Math.round(e.getBoundingClientRect().top))).size }));
    ck(all.dis && all.hint.length > 0 && all.rows === 1, `${lang} all 7 rest days: CTA disabled with hint, still one row ${JSON.stringify(all)}`);
    await shot(pg, `goal-all-rest-${lang}-360`, '#screenPlanGoal .plan-stack');
    for (let i = 0; i < 6; i++) await pg.click(`#planRestChips .chip >> nth=${i}`);
    await pg.click('#planCreateBtn');
    const after = await pg.evaluate(() => ({ s: document.querySelector('.screen.active').id, past: JSON.stringify(readStudyPlan().days.filter(d => d.date < '2026-10-08')), rest: readStudyPlan().goal.restDays }));
    ck(after.s === 'screenPlanSchedule' && after.past === before && after.rest.join() === '6', `${lang} change goal: schedule reopens, past kept, rest [6]`);
    await scheduleChecks(pg, `${lang} 360 after change`, 360, lang);
    // the rest days in the new plan fall on Saturdays
    const sat = await pg.evaluate(() => readStudyPlan().days.filter(d => d.phase === 'rest' && d.date >= '2026-10-08').every(d => new Date(d.date + 'T12:00').getDay() === 6));
    ck(sat, `${lang} new plan rest days are Saturdays`);
  }
}

async function resetFlow(pg) {
  for (const lang of LANGS) {
    await fresh(pg, NEW_ROOT); await seed(pg);
    await pg.setViewportSize({ width: 320, height: 700 });
    await pg.evaluate(l => { setLang(l); openPlanSchedule(); }, lang);
    await pg.click('#screenPlanSchedule .reset-btn');
    await shot(pg, `reset-modal-${lang}-320`);
    await pg.click('#confirmOk');
    const r = await pg.evaluate(() => ({ s: document.querySelector('.screen.active').id, plan: readStudyPlan() }));
    ck(r.s === 'screenHome' && r.plan === null, `${lang} reset: home, plan cleared`);
    await pg.click('#planCard .plan-cta');
    await goalChecks(pg, `${lang} 320 after reset new goal`);
    await pg.click('#planCreateBtn');
    ck(await pg.evaluate(() => document.querySelector('.screen.active').id) === 'screenPlanSchedule', `${lang} reset -> new plan -> schedule`);
    const r2 = await pg.evaluate(() => ({ today: document.querySelectorAll('#planDayList .plan-day.today').length, past: document.querySelectorAll('#planDayList .plan-day.past').length }));
    ck(r2.today === 1 && r2.past === 0, `${lang} new plan: today row, no past ${JSON.stringify(r2)}`);
  }
}

// .chip / .chip-row elsewhere: rects identical to the baseline build
async function chipRegression(b) {
  const grab = async (root, lang, w) => {
    const pg = await b.newPage({ viewport: { width: w, height: 900 } });
    await pg.clock.setFixedTime(NOW);
    await fresh(pg, root, '');
    await pg.evaluate(l => setLang(l), lang);
    const out = {};
    await pg.evaluate(() => leaveToHome());
    out.home = await pg.evaluate(() => ({ h: document.querySelector('#screenHome').scrollHeight, sw: document.documentElement.scrollWidth }));
    await pg.evaluate(() => openStudy());
    out.study = await pg.evaluate(() => [...document.querySelectorAll('#studyChips .chip, #studySubChips .chip')].filter(e => e.getClientRects().length).map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; }));
    // open a sub filter row too (second chip in the main row)
    const chips = await pg.$$('#studyChips .chip');
    if (chips[1]) await chips[1].click();
    out.studySub = await pg.evaluate(() => [...document.querySelectorAll('#studySubChips .chip')].filter(e => e.getClientRects().length).map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; }));
    out.css = await pg.evaluate(() => { const c = document.querySelector('#studyChips .chip'), r = document.querySelector('#studyChips'); const a = getComputedStyle(c), q = getComputedStyle(r); return [a.paddingLeft, a.whiteSpace, a.textAlign, a.fontSize, q.display, q.flexWrap, q.marginBottom].join('|'); });
    if (root === NEW_ROOT) await pg.screenshot({ path: path.join(OUT, `regr-study-${lang}-${w}.png`) });
    await pg.close();
    return out;
  };
  for (const lang of LANGS) for (const w of [320, 390]) {
    const n = await grab(NEW_ROOT, lang, w), o = await grab(OLD_ROOT, lang, w);
    ck(JSON.stringify(n.home) === JSON.stringify(o.home), `regr ${lang} ${w} home height/scroll same ${JSON.stringify(n.home)} vs ${JSON.stringify(o.home)}`);
    ck(n.study.length > 0 && JSON.stringify(n.study) === JSON.stringify(o.study), `regr ${lang} ${w} study chips rects identical (${n.study.length})`);
    ck(JSON.stringify(n.studySub) === JSON.stringify(o.studySub), `regr ${lang} ${w} study sub chips identical (${n.studySub.length})`);
    ck(n.css === o.css, `regr ${lang} ${w} chip css same ${n.css}`);
  }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--no-sandbox'], executablePath: CHROMIUM });
  const pg = await b.newPage({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.clock.setFixedTime(NOW);
  for (const f of [layoutMatrix, langSwitch, changeGoalFlow, resetFlow]) { console.log('==', f.name); await f(pg); }
  console.log('== chipRegression'); await chipRegression(b);
  ck(errs.length === 0, 'no page errors ' + errs.join('|'));
  await b.close();
  console.log(`\nRESULT ${pass} pass / ${fail} fail`);
  if (fails.length) console.log(fails.join('\n'));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
