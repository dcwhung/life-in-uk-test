const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
// Study plan PR4 (T-319–T-322; handoff §2.3, grill G7 / G16 / G27 / G30 / G34; PR3 S-110 / S-112, PR1 QA O-1):
// the schedule screen, "Change goal" (re-plan from today) and "↺ Reset plan". The entry stays hidden
// (STUDY_PLAN_READY = false) unless ?preview=plan (G31), so every flow below starts from the preview.
// - create → schedule; Home card "Schedule" button; hidden entry: openPlanSchedule() does nothing
// - summary, phase bar + strategy (three phases), study order card (Ch1–2 → Ch5 → Ch4 → Ch3 with reasons)
// - day list: its own scroller opened at today (below the sticky full-width WEEK heading, the page not moved),
//   past days dimmed, status pills (✓ / heat band / today n% / rest), task text without minutes or 🏆,
//   exam day row with the amber lattice; rows are not interactive until the day screen (PR5)
// - Change goal: the goal screen is prefilled; past days (tasks + completion) unchanged; Day 1 unchanged (G7)
// - G36: Change goal takes an exam from tomorrow with 1 study day (note + edit hint); a new plan keeps today + 7 / 7
// - Reset: app modal (Confirm), plan + log deleted, practice records + switch kept, toast, Home create card;
//   a corrupt log is cleared the same way (S-110 / O-1)
// - S-112: Cancel / Confirm / Esc on the switch-off modal keep the ⓘ popover open with focus on the switch
// - 44px tap areas, 360 / 375 / 390 / 400px en + zh-HK without horizontal scroll, [hidden] never displayed
// - v1.0.2: equal phase segments (name / days on two lines), equal study order bars with a gap before the count,
//   task lines "Ch n" + a remarks line of full chapter names, the pill under the date box ("Today 100%" fits)
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

const TODAY = '2026-10-08'; // a Thursday
const NOW = new Date(TODAY + 'T09:00:00');
const START = '2026-09-28'; // the seeded plan began 10 days ago: today is Day 11
const GOAL = { examDate: '2026-10-29', dailyMins: 120, restDays: [0], level: 'none' };
const WIDTHS = [360, 375, 390, 400];
const HIT_MIN_PX = 44;

const activeScreen = pg => pg.evaluate(() => document.querySelector('.screen.active').id);
const text = (pg, sel) => pg.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim());
const visible = (pg, sel) => pg.evaluate(sel => { const e = document.querySelector(sel); return !!e && e.getClientRects().length > 0; }, sel);
const fresh = async (pg, query = '?preview=plan') => {
  await pg.goto(APP_URL + query);
  await pg.evaluate(() => localStorage.clear());
  await pg.goto(APP_URL + query);
};
// a plan that started START (built as on that day), plus an answer log: Day 2 fully done, Day 3 part done
async function seedPlan(pg, { log = true } = {}) {
  await pg.evaluate(({ goal, start, log }) => {
    const plan = buildPlan(goal, start);
    writeStudyPlan(plan);
    if (!log) return;
    const qidsOf = day => day.tasks.flatMap(planTaskQids);
    const ok = list => Object.fromEntries(list.map(k => [k, 1]));
    const d2 = plan.days[1], d3 = plan.days[2];
    const half = qidsOf(d3).slice(0, Math.floor(qidsOf(d3).length / 3));
    writePlanLog({ v: 1, days: { [d2.date]: { ok: ok(qidsOf(d2)) }, [d3.date]: { ok: ok(half), bad: { [qidsOf(d3)[0]]: 1 } } } });
  }, { goal: GOAL, start: START, log });
}
// tap area: the points HIT_MIN_PX / 2 above and below the centre still land on the element
const hitOk = (pg, sel) => pg.evaluate(({ s, min }) => {
  const e = document.querySelector(s);
  e.scrollIntoView({ block: 'center' });
  const r = e.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const at = (x, y) => { const h = document.elementFromPoint(x, y); return !!h && (h === e || e.contains(h)); };
  return at(cx, cy - min / 2 + 1) && at(cx, cy + min / 2 - 1) && r.width >= min;
}, { s: sel, min: HIT_MIN_PX });

async function checkHidden(pg) {
  await fresh(pg, '');
  await pg.evaluate(() => { writeStudyPlan(buildPlan({ examDate: '2026-10-29', dailyMins: 120, restDays: [0], level: 'none' }, planTodayIso())); openPlanSchedule(); });
  assert(await activeScreen(pg) === 'screenHome', 'hidden: openPlanSchedule() stays on Home');
  assert(await pg.evaluate(() => PLAN_SCREEN_IDS.includes('screenPlanSchedule')), 'W-031: the schedule is a plan screen (switch off leaves it)');
}

// create → the schedule (PR3 went back to Home); Home's plan card links to it
async function checkCreateOpensSchedule(pg) {
  await fresh(pg);
  await pg.click('#planCard .plan-cta');
  await pg.click('#planDaysChips .chip >> nth=1');
  await pg.click('#planCreateBtn');
  assert(await activeScreen(pg) === 'screenPlanSchedule', 'create: "Build my plan" opens the schedule');
  assert(await pg.evaluate(() => scrollY) === 0, 'schedule opens at the top of the page');
  await pg.click('#screenPlanSchedule .back-btn');
  assert(await activeScreen(pg) === 'screenHome', 'schedule ← Home');
  assert(await visible(pg, '#planCard .plan-home [data-action="openPlanSchedule"]'), 'Home plan card: "Schedule" button');
  assert(await hitOk(pg, '#planCard [data-action="openPlanSchedule"]'), `Home "Schedule" button: ${HIT_MIN_PX}px tap area`);
  await pg.click('#planCard [data-action="openPlanSchedule"]');
  assert(await activeScreen(pg) === 'screenPlanSchedule', 'Home "Schedule" opens the schedule');
}

async function checkOverview(pg) {
  await fresh(pg);
  await seedPlan(pg);
  await pg.evaluate(() => openPlanSchedule());
  const sum = await text(pg, '#planSummary');
  assert(sum === 'Starts 28/9 · exam 29/10 · up to 2 hr a day · Starting fresh', 'summary: start, exam, daily limit, level: ' + sum);
  const r = await pg.evaluate(() => {
    const plan = parseStoredPlan(readStudyPlan());
    const count = ph => plan.days.filter(d => d.phase === ph).length;
    return {
      want: ['learn', 'drill', 'mock'].map(count),
      bar: [...document.querySelectorAll('#planPhaseBar > div')].map(e => {
        const name = e.querySelector('.plan-ph-name'), days = e.querySelector('.plan-ph-days');
        return { cls: e.className, name: name && name.textContent, days: days && days.textContent, w: e.getBoundingClientRect().width,
          below: !!name && !!days && days.getBoundingClientRect().top >= name.getBoundingClientRect().bottom - 1 };
      }),
      strat: [...document.querySelectorAll('#planStrategy .plan-strat')].map(e => [e.className, e.querySelector('h4').textContent, e.querySelector('[lang="en"]').textContent]),
      mocks: plan.days.flatMap(d => d.tasks).filter(t => t.type === 'mock').length,
    };
  });
  // v1.0.2: three equal segments, the phase name on line 1 and its day count on line 2
  assert(r.bar.length === 3 && r.bar.every(b => Math.abs(b.w - r.bar[0].w) <= 1), 'phase bar: three segments of equal width: ' + JSON.stringify(r.bar));
  assert(r.bar.map(b => b.name).join() === 'Read + practise,Drill,Mocks' && r.bar[0].cls.includes('plan-bg-learn'), 'phase bar: phase names: ' + JSON.stringify(r.bar));
  assert(JSON.stringify(r.bar.map(b => b.days)) === JSON.stringify(r.want.map(n => `${n} days`)), 'phase bar: "n days" per phase: ' + JSON.stringify(r.bar));
  assert(r.bar.every(b => b.below), 'phase bar: the day count sits on a second line under the name');
  assert(r.strat.length === 3 && r.strat.map(s => s[0].split(' ')[1]).join() === 'learn,drill,mock', 'strategy: three phases in order');
  assert(r.strat[0][2].startsWith('Day 1–') && r.strat[2][1].includes(`${r.mocks} timed exams`), 'strategy: day range + mock count: ' + JSON.stringify(r.strat));
  const stratText = await text(pg, '#planStrategy');
  assert(stratText.includes('236 facts') && stratText.includes('389 questions') && stratText.includes('18/24'), 'strategy: facts / questions totals and the pass mark');
  const order = await pg.$$eval('#planOrder .plan-ord', els => els.map(e => [e.querySelector('b').textContent, e.querySelector('.plan-ord-why').textContent, e.querySelector('.plan-chw-c').textContent]));
  assert(JSON.stringify(order.map(o => o[0])) === JSON.stringify(['Ch 1 Values & principles + Ch 2 What is the UK?', 'Ch 5 Government & law', 'Ch 4 Modern society', 'Ch 3 History']),
    'order card: Ch1–2 → Ch5 → Ch4 → Ch3: ' + JSON.stringify(order.map(o => o[0])));
  assert(order.every(o => o[1].length > 10), 'order card: every step says why');
  assert(order[0][2] === '6 facts · 20 Qs' && order[3][2].startsWith('91 facts'), 'order card: facts / Qs per step: ' + order.map(o => o[2]));
  await checkOrderBars(pg, 'en 390px');
  assert(await pg.evaluate(() => PLAN_ORDER_STEPS.flat().join() === PLAN_STUDY_ORDER.join()), 'order card steps follow PLAN_STUDY_ORDER');
  assert(await pg.$$eval('#planOrder b', els => els.every(e => e.closest('[lang="en"]'))), 'chapter names are English: lang="en"');
}

// v1.0.2: every chapter bar track has the same length and leaves a clear gap before its count
const ORDER_BAR_GAP_MIN_PX = 8;
async function checkOrderBars(pg, where) {
  const r = await pg.$$eval('#planOrder .plan-chw', els => els.map(e => {
    const bar = e.querySelector('.plan-chw-bar').getBoundingClientRect(), c = e.querySelector('.plan-chw-c').getBoundingClientRect();
    return { w: Math.round(bar.width), gap: Math.round(c.left - bar.right), fit: e.querySelector('.plan-chw-c').scrollWidth <= Math.ceil(c.width) };
  }));
  assert(r.every(x => x.w === r[0].w && x.w > 0), `${where}: study order bar tracks all the same length: ` + JSON.stringify(r));
  assert(r.every(x => x.gap >= ORDER_BAR_GAP_MIN_PX && x.fit), `${where}: ≥ ${ORDER_BAR_GAP_MIN_PX}px between bar and count, count not clipped: ` + JSON.stringify(r));
}

async function checkDayList(pg) {
  // still on the seeded schedule (checkOverview)
  const r = await pg.evaluate(() => {
    const plan = parseStoredPlan(readStudyPlan());
    const rows = [...document.querySelectorAll('#planDayList .plan-day')];
    return {
      days: plan.days.length, rows: rows.length, weeks: [...document.querySelectorAll('#planDayList .plan-week')].map(e => e.textContent),
      first: rows[0].querySelector('.plan-day-d').firstChild.textContent, firstSub: rows[0].querySelector('.plan-day-d small').textContent,
      today: rows.findIndex(e => e.classList.contains('today')), past: rows.filter(e => e.classList.contains('past')).length,
      rest: rows.filter(e => e.classList.contains('rest')).map(e => e.querySelector('.plan-day-tasks').textContent.trim()),
      text: rows.filter(e => !e.classList.contains('exam')).map(e => e.textContent).join(' | '), // the exam day's tip names an arrival time
      exam: (() => { const e = rows[rows.length - 1]; return { cls: e.className, pat: !!e.querySelector('.plan-exam-pat'), text: e.textContent }; })(),
      interactive: rows.filter(e => e.matches('[role="button"], [tabindex], [data-action]')).length,
    };
  });
  assert(r.rows === r.days + 1, `day list: one row per plan day + the exam day (${r.rows})`);
  assert(r.first === '1' && r.firstSub === '28/9 Mon', 'day list: Day 1 · 28/9 Mon: ' + r.first + ' ' + r.firstSub);
  assert(JSON.stringify(r.weeks) === JSON.stringify(['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5']), 'WEEK headings every 7 days: ' + r.weeks);
  assert(r.today === 10 && r.past === 10, 'today = Day 11, the 10 days before are past');
  assert(r.rest.length > 0 && r.rest.every(s => s.includes('Rest day')), 'rest days say so');
  assert(!/\bmin\b|minute|🏆/.test(r.text), 'task text has no minutes and no 🏆 (handoff §2.3)');
  assert(r.text.includes('Read Ch 5 facts #') && r.text.includes('not yet mastered'), 'task text: read range, "not yet mastered" in words');
  assert(/Practise Ch \d: \d+ Qs/.test(r.text) && !/questions/.test(r.text), 'task text: practice / drill counts in "Qs"');
  // v1.0.2: task lines name the chapter number only; a muted line under the tasks names each chapter in full
  const notes = await pg.evaluate(() => {
    const plan = parseStoredPlan(readStudyPlan());
    const rows = [...document.querySelectorAll('#planDayList .plan-day')];
    return plan.days.map((d, i) => {
      const chs = [...new Set(d.tasks.filter(t => t.ch).map(t => t.ch))];
      const note = rows[i].querySelector('.plan-day-chs');
      const tasks = [...rows[i].querySelectorAll('.plan-day-t')].map(e => e.textContent).join(' | ');
      return { chs, note: note && note.textContent, lang: note && note.getAttribute('lang'), tasks, light: !!d.light, last: note && note === rows[i].querySelector('.plan-day-tasks').lastElementChild };
    });
  });
  const fullNames = await pg.evaluate(() => [1, 2, 3, 4, 5].map(ch => planChapterText(ch)));
  const withCh = notes.filter(n => n.chs.length && !n.light);
  assert(withCh.length > 10 && withCh.every(n => n.note === n.chs.map(ch => fullNames[ch - 1]).join(' · ') && n.lang === 'en' && n.last),
    'remarks: each study day lists its chapters in full, unique, in order, last line, lang="en": ' + JSON.stringify(withCh.slice(0, 3)));
  assert(notes.filter(n => !n.chs.length || n.light).every(n => n.note === null), 'remarks: none on rest / mock-only / light days');
  assert(notes.every(n => !fullNames.some(f => n.tasks.includes(f))), 'task lines show "Ch n" without the chapter name');
  assert(r.exam.cls.includes('exam') && r.exam.pat && r.exam.text.includes('🎯') && r.exam.text.includes('29/10 Thu') && r.exam.text.includes('Exam day'),
    'exam day row: lattice, 🎯, date + weekday: ' + r.exam.text);
  assert(r.interactive === 0, 'rows are not interactive yet (the day screen is PR5)');
  // W-034: past days are dimmed by grey colours, not opacity: every text in them stays ≥ 4.5:1 (WCAG 1.4.3)
  const look = await pg.evaluate(() => {
    const rows = [...document.querySelectorAll('#planDayList .plan-day')];
    const rgb = c => c.match(/[\d.]+/g).map(Number);
    const lum = c => { const v = rgb(c).slice(0, 3).map(x => x / 255).map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
    const bgOf = e => { for (let n = e; n; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor; if (rgb(c)[3] !== 0) return c; } return 'rgb(255, 255, 255)'; };
    const opaque = e => { for (let n = e; n; n = n.parentElement) if (Number(getComputedStyle(n).opacity) < 1) return false; return true; };
    const ratio = e => { const a = lum(getComputedStyle(e).color), b = lum(bgOf(e)); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
    const texts = rows.filter(r => r.classList.contains('past'))
      .flatMap(r => [...r.querySelectorAll('.plan-day-d, .plan-day-d small, .plan-pill, .plan-day-tasks span:not(.plan-day-ic)')]);
    const bad = texts.filter(e => !opaque(e) || ratio(e) < 4.5).map(e => `${e.className || e.tagName} "${e.textContent.slice(0, 12)}" ${ratio(e).toFixed(2)} op${opaque(e) ? 1 : '<1'}`);
    const dColor = i => getComputedStyle(rows[i].querySelector('.plan-day-d')).color;
    const exam = rows[rows.length - 1].querySelector('.plan-exam-pat');
    return { n: texts.length, bad, past: dColor(2), today: dColor(10), future: dColor(12), examBg: getComputedStyle(exam).backgroundImage, scroll: getComputedStyle(byId('planDayList')).overflowY };
  });
  assert(look.n > 20 && look.bad.length === 0, `W-034: past-day texts (${look.n}) have no opacity and ≥ 4.5:1 contrast: ` + look.bad.join(' | '));
  assert(look.past !== look.today && look.today === look.future, 'past days dimmed (grey date box); today and later keep their phase colour: ' + JSON.stringify([look.past, look.today, look.future]));
  assert(look.examBg.includes('linear-gradient') && look.scroll === 'auto', 'exam day lattice; the list scrolls on its own');
}

async function checkPills(pg) {
  const pills = await pg.evaluate(() => {
    const plan = parseStoredPlan(readStudyPlan()), log = parsePlanLog(JSON.parse(localStorage.getItem(STUDY_PLAN_PROGRESS_LS)));
    const rows = [...document.querySelectorAll('#planDayList .plan-day')];
    const pill = i => { const e = rows[i].querySelector('.plan-pill'); return e ? [e.className, e.textContent] : null; };
    const pct = i => planDayCompletion(plan.days[i], planDayLog(log, plan.days[i].date)).pct;
    return { d2: pill(1), d3: pill(2), d3pct: pct(2), d3band: planPctBand(pct(2)), d1: pill(0), rest: pill(6), today: pill(10), todayPct: pct(10) || 0, future: pill(12) };
  });
  assert(pills.d2 && pills.d2[1] === '✓ Done' && pills.d2[0].includes('ok'), 'pill: a 100% past day reads ✓ Done: ' + pills.d2);
  assert(pills.d3[1] === pills.d3pct + '%' && pills.d3[0].includes('h' + pills.d3band) && pills.d3band > 0 && pills.d3band < 4, 'pill: a part-done day shows its % in its G27 band: ' + pills.d3);
  assert(pills.d1[1] === '0%' && pills.d1[0].includes('h0'), 'pill: a past day with nothing done: 0% (band 0)');
  assert(pills.rest[1] === 'Rest' && pills.rest[0].includes('mute'), 'pill: rest');
  assert(pills.today[1] === `Today ${pills.todayPct}%` && pills.today[0].includes('now'), 'pill: today n%: ' + pills.today);
  assert(pills.future === null, 'future days have no pill yet');
  // v1.0.2: the pill sits under the date box in the left column; the tasks take the rest of the row
  const lay = await pg.evaluate(() => [...document.querySelectorAll('#planDayList .plan-day')].map(row => {
    const pill = row.querySelector('.plan-pill'), side = row.querySelector('.plan-day-side'), box = row.querySelector('.plan-day-d');
    const tasks = row.querySelector('.plan-day-tasks').getBoundingClientRect(), rr = row.getBoundingClientRect();
    const cols = getComputedStyle(row).gridTemplateColumns.split(' ').length;
    if (!pill) return { cols, pill: false, tasksToEnd: Math.round(rr.right - tasks.right) - parseFloat(getComputedStyle(row).paddingRight) };
    const p = pill.getBoundingClientRect(), b = box.getBoundingClientRect(), s = side && side.getBoundingClientRect();
    return { cols, pill: true, inSide: !!side && side.contains(pill), below: p.top >= b.bottom - 1, fits: !!s && p.left >= s.left - 0.5 && p.right <= s.right + 0.5,
      tasksToEnd: Math.round(rr.right - tasks.right) - parseFloat(getComputedStyle(row).paddingRight) };
  }));
  assert(lay.every(l => l.cols === 2), 'day rows: two columns (date + pill | tasks): ' + JSON.stringify(lay.map(l => l.cols)));
  assert(lay.filter(l => l.pill).every(l => l.inSide && l.below && l.fits), 'pill: inside the left column, under the date box, within its width: ' + JSON.stringify(lay.filter(l => l.pill)));
  assert(lay.every(l => Math.abs(l.tasksToEnd) <= 1), 'tasks reach the right edge of the row (no pill column): ' + JSON.stringify(lay.map(l => l.tasksToEnd)));
  const colours = await pg.evaluate(() => [0, 1, 2, 3].map(n => { const e = document.createElement('span'); e.className = 'plan-pill h' + n; document.body.append(e); const c = getComputedStyle(e).backgroundColor; e.remove(); return c; }));
  assert(new Set(colours).size === 4 && colours.every(c => c !== 'rgba(0, 0, 0, 0)'), 'G27: heat bands 0–3 each have their own token colour: ' + colours);
}

// opens at today: below the sticky WEEK heading, the page itself not scrolled; the heading spans the full width
async function checkScrollToToday(pg) {
  await pg.evaluate(() => openPlanSchedule());
  // the jump to today is instant (no smooth scroll); wait for the list to settle on it instead of a fixed delay
  await pg.waitForFunction(() => { const l = byId('planDayList'), row = l.querySelector('.plan-day.today'), head = l.querySelector('.plan-week');
    return !!row && Math.abs(l.scrollTop - (row.offsetTop - head.offsetHeight)) <= 1; });
  const r = await pg.evaluate(() => {
    const list = byId('planDayList'), row = list.querySelector('.plan-day.today');
    const page = scrollY, scrolled = list.scrollTop;
    list.scrollIntoView({ block: 'end' }); // measure on screen: elementFromPoint needs the list in the viewport
    const lr = list.getBoundingClientRect(), rr = row.getBoundingClientRect();
    const hit = document.elementFromPoint(lr.left + 4, lr.top + 3);
    const head = hit && hit.closest('.plan-week');
    return { scrolled, kept: list.scrollTop === scrolled, gap: rr.top - lr.top, head: head && head.textContent, headH: head && head.getBoundingClientRect().height,
      headW: head && Math.round(head.getBoundingClientRect().width), listW: list.clientWidth, sticky: head && getComputedStyle(head).position, page,
      inView: rr.bottom <= lr.bottom };
  });
  assert(r.scrolled > 0 && r.kept && r.page === 0, 'day list scrolled to today, the page stays at the top: ' + JSON.stringify(r));
  assert(r.head === 'Week 2' && r.sticky === 'sticky', 'the WEEK heading of today sticks at the top of the list: ' + r.head);
  assert(Math.abs(r.gap - r.headH) <= 2 && r.inView, 'today sits just below the sticky heading: ' + JSON.stringify(r));
  assert(r.headW === r.listW, `the sticky heading spans the list's full width (${r.headW} = ${r.listW})`);
}

// G7: Change goal keeps the past (tasks + completion) and Day 1; G30: today's filled contents stay
async function checkChangeGoal(pg) {
  await fresh(pg);
  await seedPlan(pg);
  await pg.evaluate(() => openPlanSchedule());
  const before = await pg.evaluate(() => ({ plan: parseStoredPlan(readStudyPlan()),
    rows: [...document.querySelectorAll('#planDayList .plan-day.past')].map(e => e.outerHTML) }));
  assert(await hitOk(pg, '#screenPlanSchedule [data-action="planEditGoal"]'), `"Change goal": ${HIT_MIN_PX}px tap area`);
  await pg.click('#screenPlanSchedule [data-action="planEditGoal"]');
  assert(await activeScreen(pg) === 'screenPlanGoal', 'Change goal opens the goal screen');
  const g = await pg.evaluate(() => ({ draft: JSON.parse(JSON.stringify(planGoalDraft)), step: byId('planGoalStep').textContent, cta: byId('planCreateBtn').textContent, steps: byId('planGoalSteps').hidden }));
  assert(g.steps, 'edit mode: no 1 / 2 stepper');
  assert(JSON.stringify(g.draft) === JSON.stringify(GOAL), 'goal screen prefilled with the current goal: ' + JSON.stringify(g.draft));
  assert(g.step === 'Change goal' && g.cta === 'Update my plan →', 'goal screen in edit mode: header + CTA: ' + g.step + ' / ' + g.cta);
  await pg.click('#planRestChips .chip >> nth=6');
  await pg.click('#planCreateBtn');
  assert(await activeScreen(pg) === 'screenPlanSchedule', 'Update my plan → back to the schedule');
  const after = await pg.evaluate(() => ({ plan: parseStoredPlan(readStudyPlan()), log: localStorage.getItem(STUDY_PLAN_PROGRESS_LS),
    rows: [...document.querySelectorAll('#planDayList .plan-day.past')].map(e => e.outerHTML), first: document.querySelector('#planDayList .plan-day-d').firstChild.textContent }));
  const past = p => JSON.stringify(p.days.filter(d => d.date < TODAY));
  assert(past(after.plan) === past(before.plan), 'G7: past days unchanged word for word');
  assert(JSON.stringify(after.rows) === JSON.stringify(before.rows), 'G7: past rows (tasks + completion) look the same');
  assert(after.plan.start === START && after.first === '1', 'G7: Day 1 is still the original start');
  assert(JSON.stringify(after.plan.goal.restDays) === '[0,6]' && after.plan.goalHistory.length === 1, 'new goal stored, old goal in goalHistory');
  assert(after.log !== null, 'Change goal keeps the answer log');
  await pg.click('#screenPlanSchedule [data-action="planEditGoal"]');
  assert(JSON.stringify(await pg.evaluate(() => planGoalDraft.restDays)) === '[0,6]', 'Change goal again: prefilled with the new goal');
  await pg.click('#screenPlanGoal .back-btn');
  assert(await activeScreen(pg) === 'screenHome', 'goal screen ← Home');
  const create = await pg.evaluate(() => { openPlanGoal(); return { step: byId('planGoalStep').textContent, cta: byId('planCreateBtn').textContent, steps: byId('planGoalSteps').hidden }; });
  assert(!create.steps && create.step === 'New plan · 1 / 2' && create.cta === 'Build my plan →', 'a new plan opens the goal screen in create mode again');
}

// W-035: Change goal measures the time against the facts still to learn (review case: 21 days at 60 min, 12 days in,
// 44 facts left, no rest days → not ✕)
async function checkChangeGoalFeasibility(pg) {
  await fresh(pg);
  const r = await pg.evaluate(() => {
    const start = isoAddDays(planTodayIso(), -12);
    writeStudyPlan(buildPlan({ examDate: isoAddDays(start, 21), dailyMins: 60, restDays: [], level: 'none' }, start));
    const done = PLAN_LEARN_ORDER.slice(0, PLAN_LEARN_ORDER.length - 44);
    writePlanLog({ v: 1, days: { [isoAddDays(start, 1)]: { ok: Object.fromEntries(done.flatMap(id => planFactQids(planFactById(id))).map(k => [k, 1])) } } });
    openPlanSchedule();
    return { left: planFactsLeft(planLoadLog()).length, whole: planFeasibility(planLoad().goal, planTodayIso()).status };
  });
  await pg.click('#screenPlanSchedule [data-action="planEditGoal"]');
  const pill = await pg.$eval('#planFeasPill', e => e.className);
  assert(r.left === 44 && r.whole === 'short' && !pill.includes('short'), 'W-035: Change goal with 44 facts left is not "✕ Not enough": ' + pill);
  await pg.evaluate(() => { openPlanGoal(); Object.assign(planGoalDraft, planCopyGoal(planLoad().goal)); renderPlanGoal(); });
  assert((await pg.$eval('#planFeasPill', e => e.className)).includes('short'), 'W-035: the same goal as a new plan still measures the whole syllabus (✕)');
}

// G36: Change goal may pick an exam as soon as tomorrow and keep as little as 1 study day; a new plan keeps today + 7
// and 7 study days (G28)
async function checkChangeGoalLastWeek(pg) {
  await fresh(pg);
  await seedPlan(pg);
  await pg.evaluate(() => openPlanSchedule());
  const before = await pg.evaluate(() => parseStoredPlan(readStudyPlan()));
  await pg.click('#screenPlanSchedule [data-action="planEditGoal"]');
  const edit = await pg.evaluate(() => ({ min: byId('planExamDate').min, note: byId('planDateNote').getClientRects().length > 0, noteText: byId('planDateNote').textContent }));
  assert(edit.min === '2026-10-09' && edit.note && edit.noteText === 'When you change your goal, the exam date can be as soon as tomorrow.',
    'G36: Change goal: the date field starts tomorrow, with a note: ' + JSON.stringify(edit));
  await pg.fill('#planExamDate', '2026-10-09');
  await pg.click('#planDaysVal'); // leave the field (commits it, W-033)
  const r = await pg.evaluate(() => ({ exam: planGoalDraft.examDate, field: byId('planExamDate').value, days: byId('planDaysVal').textContent,
    study: byId('planFeasDays').textContent, sub: byId('planFeasDaysSub').textContent, cta: byId('planCreateBtn').disabled, hint: byId('planGoalHint').hidden, chips: document.querySelectorAll('#planDaysChips .chip.active').length }));
  assert(r.exam === '2026-10-09' && r.field === '2026-10-09' && r.days === '1 day' && r.study === '1' && r.sub === '1 day, 0 rest', 'G36: exam tomorrow taken (1 day, 1 study day): ' + JSON.stringify(r));
  assert(!r.cta && r.hint && r.chips === 0, 'G36: 1 study day is enough to update (no hint), no preset chip on: ' + JSON.stringify(r));
  await pg.click('#planRestChips .chip >> nth=4'); // Thursday = today: no study day left
  const none = await pg.evaluate(() => ({ cta: byId('planCreateBtn').disabled, hint: byId('planGoalHint').hidden ? null : byId('planGoalHint').textContent, msg: byId('planFeasMsg').hidden }));
  assert(none.cta && none.hint === "At least 1 study day is needed before the exam, so the plan can't be updated. Choose fewer rest days or a later exam date." && none.msg,
    'G36: 0 study days disables the update with the edit hint: ' + JSON.stringify(none));
  await pg.click('#planRestChips .chip >> nth=4');
  assert(!(await pg.$eval('#planCreateBtn', e => e.disabled)), 'G36: Thursday studied again → update enabled');
  await pg.click('#planCreateBtn');
  const after = await pg.evaluate(() => parseStoredPlan(readStudyPlan()));
  const past = p => JSON.stringify(p.days.filter(d => d.date < TODAY));
  assert(await activeScreen(pg) === 'screenPlanSchedule' && after.goal.examDate === '2026-10-09' && after.days.length === 11, 'G36: re-planned to tomorrow, the schedule opens (11 days from Day 1)');
  assert(past(after) === past(before) && after.start === START, 'G36 / G7: past days unchanged word for word, Day 1 unchanged');
  const last = after.days[10];
  const left = await pg.evaluate(() => planFactsLeft(planLoadLog()));
  const reads = last.tasks.filter(t => t.type === 'read').flatMap(t => t.facts);
  assert(last.date === TODAY && last.phase === 'learn' && JSON.stringify(reads) === JSON.stringify(left), `G36: the one day left reads all ${left.length} unfinished facts once (G13)`);
  await pg.evaluate(() => openPlanGoal());
  const create = await pg.evaluate(() => ({ min: byId('planExamDate').min, note: byId('planDateNote').getClientRects().length > 0 }));
  assert(create.min === '2026-10-15' && !create.note, 'G28: a new plan still starts at today + 7, no note: ' + JSON.stringify(create));
  await pg.fill('#planExamDate', '2026-10-09');
  await pg.click('#planDaysVal');
  assert(await pg.evaluate(() => planGoalDraft.examDate) !== '2026-10-09', 'G28: a new plan does not take tomorrow');
  await pg.evaluate(() => { setLang('zh-HK'); openPlanSchedule(); });
  await pg.click('#screenPlanSchedule [data-action="planEditGoal"]');
  await pg.click('#planRestChips .chip >> nth=4');
  const zh = await pg.evaluate(() => ({ note: byId('planDateNote').textContent, hint: byId('planGoalHint').textContent }));
  assert(zh.note === '改目標時，考試日期最早可選明天。' && zh.hint === '考試前最少需要 1 個溫習日，未能更新進度表。請減少休息日或延後考試日期。', 'G36 zh-HK: note + hint: ' + JSON.stringify(zh));
  await pg.evaluate(() => setLang('en'));
}

async function checkReset(pg, { corruptLog = false } = {}) {
  await fresh(pg);
  await seedPlan(pg);
  await pg.evaluate(bad => {
    localStorage.setItem(STREAK_LS, '{"1.0":3}');
    localStorage.setItem(WRONG_LS, '{"3.4":true}');
    setStudyPlanEnabled(true);
    if (bad) localStorage.setItem(STUDY_PLAN_PROGRESS_LS, '{not json');
    openPlanSchedule();
  }, corruptLog);
  const tag = corruptLog ? 'S-110: corrupt log: ' : '';
  assert(await activeScreen(pg) === 'screenPlanSchedule', tag + 'the schedule opens');
  assert(await hitOk(pg, '#screenPlanSchedule .reset-btn'), `${tag}"↺ Reset plan": ${HIT_MIN_PX}px tap area`);
  await pg.click('#screenPlanSchedule .reset-btn');
  const m = await pg.evaluate(() => ({ open: isConfirmOpen(), title: byId('confirmTitle').textContent, ok: byId('confirmOk').textContent, focus: document.activeElement.id }));
  assert(m.open && m.title === 'Reset the study plan?' && m.ok === 'Confirm' && m.focus === 'confirmCancel', tag + 'reset asks in the app modal (Confirm; focus on Cancel): ' + JSON.stringify(m));
  await pg.click('#confirmCancel');
  assert(await pg.evaluate(() => readStudyPlan() !== null), tag + 'Cancel keeps the plan');
  await pg.click('#screenPlanSchedule .reset-btn');
  await pg.click('#confirmOk');
  const r = await pg.evaluate(() => ({ plan: localStorage.getItem(STUDY_PLAN_LS), log: localStorage.getItem(STUDY_PLAN_PROGRESS_LS),
    streak: localStorage.getItem(STREAK_LS), wrong: localStorage.getItem(WRONG_LS), on: localStorage.getItem(STUDY_PLAN_ENABLED_LS),
    toast: byId('appToast').hidden ? null : byId('appToast').textContent, screen: document.querySelector('.screen.active').id }));
  assert(r.plan === null && r.log === null, tag + 'Confirm deletes the plan and its log');
  assert(r.streak === '{"1.0":3}' && r.wrong === '{"3.4":true}' && r.on === 'true', tag + 'practice records and the switch are kept');
  assert(r.toast === 'Study plan reset: you can build a new one', tag + 'toast after reset (G34): ' + r.toast);
  const inView = await pg.$eval('#planCard .plan-cta', e => e.getBoundingClientRect().top >= 0 && e.getBoundingClientRect().bottom <= innerHeight);
  assert(r.screen === 'screenHome' && await visible(pg, '#planCard .plan-cta') && inView, tag + 'back to Home with the create card in view');
}

// S-112: the switch-off modal sits outside #infoPop: its buttons / Esc must not close the popover behind it
async function checkSwitchModalKeepsPopover(pg) {
  await fresh(pg);
  const state = () => pg.evaluate(() => ({ pop: byId('infoPop').classList.contains('show'), modal: isConfirmOpen(), focus: document.activeElement.id,
    shown: byId('planFeatureSwitch').getClientRects().length > 0, on: isStudyPlanEnabled() }));
  await pg.click('#infoBtn');
  for (const [how, act] of [['Cancel', () => pg.click('#confirmCancel')], ['Esc', () => pg.keyboard.press('Escape')]]) {
    await pg.click('#planFeatureSwitch');
    await act();
    const s = await state();
    assert(s.pop && !s.modal && s.focus === 'planFeatureSwitch' && s.shown && s.on, `S-112: ${how} → popover open, focus on the visible switch: ` + JSON.stringify(s));
  }
  await pg.click('#planFeatureSwitch');
  await pg.click('#confirmOk');
  const s = await state();
  assert(s.pop && s.focus === 'planFeatureSwitch' && s.shown && !s.on, 'S-112: Confirm → popover open showing the switch off, focus on it: ' + JSON.stringify(s));
  await pg.keyboard.press('Escape');
  assert(!(await state()).pop, 'Esc with no modal open closes the popover');
}

// G16: after the exam the schedule still opens, every day past
async function checkEnded(pg) {
  await fresh(pg);
  await pg.evaluate(() => { writeStudyPlan(buildPlan({ examDate: '2026-10-05', dailyMins: 60, restDays: [], level: 'some' }, '2026-09-27')); openPlanSchedule(); });
  const r = await pg.evaluate(() => ({ screen: document.querySelector('.screen.active').id, rows: document.querySelectorAll('#planDayList .plan-day').length,
    past: document.querySelectorAll('#planDayList .plan-day.past').length, today: document.querySelectorAll('#planDayList .plan-day.today').length }));
  assert(r.screen === 'screenPlanSchedule' && r.past === r.rows && r.today === 0, 'G16: an ended plan still shows, every day past: ' + JSON.stringify(r));
}

async function checkHiddenAttr(pg) {
  const shown = await pg.evaluate(() => [...document.querySelectorAll('[hidden]')]
    .filter(e => getComputedStyle(e).display !== 'none').map(e => e.id || e.className));
  assert(shown.length === 0, '[hidden] elements are never displayed: ' + shown.join(', '));
}
// v1.0.2: phase labels unclipped, order bars equal, and every pill (also "Today 100%") fits the left column
async function checkScheduleFit(pg, where) {
  const r = await pg.evaluate(() => {
    const clipped = [...document.querySelectorAll('#planPhaseBar span')].filter(e => e.scrollWidth > e.clientWidth + 0.5).map(e => e.textContent);
    const row = document.querySelector('#planDayList .plan-day.today'), pill = row.querySelector('.plan-pill');
    const before = pill.textContent;
    pill.textContent = t('plan.status.today', { n: PERCENT });
    const side = row.querySelector('.plan-day-side').getBoundingClientRect(), p = pill.getBoundingClientRect();
    const out = { clipped, full: pill.textContent, fits: p.left >= side.left - 0.5 && p.right <= side.right + 0.5, p: [p.left, p.right], side: [side.left, side.right] };
    pill.textContent = before;
    return out;
  });
  assert(r.clipped.length === 0, `${where}: phase bar labels not clipped: ` + r.clipped);
  assert(r.fits, `${where}: "${r.full}" pill fits the left column: ` + JSON.stringify(r));
  await checkOrderBars(pg, where);
}
async function checkWidths(pg) {
  await fresh(pg);
  await seedPlan(pg);
  for (const lang of ['en', 'zh-HK']) {
    await pg.evaluate(l => setLang(l), lang);
    for (const w of WIDTHS) {
      await pg.setViewportSize({ width: w, height: 800 });
      for (const open of [() => leaveToHome(), () => openPlanSchedule()]) {
        await pg.evaluate(open);
        const fit = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, s: document.querySelector('.screen.active').id,
          list: (() => { const l = byId('planDayList'); return l.scrollWidth - l.clientWidth; })(),
          bar: (() => { const e = byId('planPhaseBar'); return e.getClientRects().length ? e.scrollWidth - e.clientWidth : 0; })() }));
        assert(fit.bar <= 0, `${lang} ${w}px ${fit.s}: every phase bar label shows in full (${fit.bar})`);
        if (fit.s === 'screenPlanSchedule') await checkScheduleFit(pg, `${lang} ${w}px`);
        assert(fit.sw <= fit.cw && fit.list <= 0, `${lang} ${w}px ${fit.s}: no horizontal scroll (${fit.sw} <= ${fit.cw}, list ${fit.list})`);
        await checkHiddenAttr(pg);
      }
    }
  }
  const zh = await pg.evaluate(() => ({ title: byId('planSummary').textContent, pill: document.querySelector('#planDayList .plan-day.today .plan-pill').textContent,
    week: document.querySelector('#planDayList .plan-week').getAttribute('lang') }));
  assert(zh.title.includes('開始') && zh.pill.startsWith('今日') && zh.week === 'en', 'zh-HK: summary / pill in Chinese, WEEK heading lang="en": ' + JSON.stringify(zh));
  await pg.evaluate(() => setLang('en'));
  await pg.setViewportSize({ width: 390, height: 844 });
}

// a language switch re-renders in place and keeps the list where the user scrolled it
async function checkLangKeepsScroll(pg) {
  await pg.evaluate(() => openPlanSchedule());
  await pg.evaluate(() => byId('planDayList').scrollTo({ top: 40, behavior: 'instant' }));
  await pg.click('#langBtn');
  const r = await pg.evaluate(() => ({ top: byId('planDayList').scrollTop, lang: getLang(), sum: byId('planSummary').textContent }));
  assert(r.lang === 'zh-HK' && r.top === 40 && r.sum.includes('開始'), 'language switch: re-rendered, list scroll kept: ' + JSON.stringify(r));
  await pg.click('#langBtn');
}

function checkWiring() {
  const read = f => fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8');
  const main = read('js/main.js');
  assert(main.includes("'js/screens/planSchedule.js'"), 'R1: LATE_BOOT_SCRIPTS loads planSchedule.js for old shells');
  assert(read('sw.js').includes("'js/screens/planSchedule.js'"), 'sw.js SHELL caches planSchedule.js');
}

async function main() {
  checkWiring();
  const b = await chromium.launch(launchOpts);
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.clock.setFixedTime(NOW);
  for (const check of [checkHidden, checkCreateOpensSchedule, checkOverview, checkDayList, checkPills, checkScrollToToday, checkChangeGoal, checkChangeGoalFeasibility, checkChangeGoalLastWeek,
    checkReset, pg2 => checkReset(pg2, { corruptLog: true }), checkSwitchModalKeepsPopover, checkEnded, checkWidths, checkLangKeepsScroll]) {
    await check(pg);
  }
  assert(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close();
}
main().then(() => console.log('PLAN-SCHEDULE PASS')).catch(e => { console.error(e.message); process.exit(1); });
