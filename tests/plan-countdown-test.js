// v2.0.0 F7 (desktop Home plan card, grill 2026-10-12 implementation notes; mockup desktop-home-plan.html rev 5–7): the countdown
// timeline's numbers come from planCountdown(plan, todayIso) in js/domain/planProgress.js (pure, no DOM, no clock).
// Node only, like plan-test.js: the domain scripts run in one vm context.
// - ≤ 42 days: one run per day (rest days grey, their own run); > 42: one run per phase and done / to come, rest days
//   taken into the phase they sit in, plus month ticks (the 1st of each month after the start)
// - today counts as done (solid); every run after it is "future" (an outline); `at` = today's left edge in % of the bar
// - the bracket from today to the exam: its label sits at the end once the span is under 28% of the bar
// - no timeline (null) on the exam day, after it, and before the plan starts
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const APP_FILES = [
  'data/exams.js', 'data/study.js', 'js/core/config.js', 'js/core/utils.js', 'js/core/store.js',
  'js/domain/questions.js', 'js/domain/mastery.js', 'js/domain/similar.js', 'js/domain/plan.js', 'js/domain/planProgress.js',
];
const START = '2026-10-12'; // a Monday
const PER_DAY_MAX = 42;
const LABEL_END_BELOW_PCT = 28;
const EPS = 1e-9;
const LONG = 181; // about half a year: the longest plan the goal form allows (PLAN_MAX_MONTHS) from START

let asserts = 0;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); asserts++; console.log('ok:', m); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function loadApp() {
  const data = new Map();
  const localStorage = { getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k), key: () => null, length: 0 };
  const ctx = vm.createContext({ localStorage, console });
  APP_FILES.forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
  return code => vm.runInContext(code, ctx);
}
const g = loadApp();
const isoAddDays = g('isoAddDays');
const buildPlan = g('buildPlan');
const planCountdown = g('planCountdown');
const plan = (days, restDays = [0]) => buildPlan({ examDate: isoAddDays(START, days), dailyMins: 120, restDays, level: 'none' }, START);
const dayIso = (p, n) => p.days[n - 1].date; // Day n of the plan
const total = runs => runs.reduce((s, r) => s + r.days, 0);

function checkShortPlan() {
  const p = plan(21), cd = planCountdown(p, dayIso(p, 9));
  assert(cd && cd.len === 21 && cd.perDay === true && cd.todayIndex === 8, '21 days: one cell per day, today = Day 9');
  assert(cd.left === 13, '21 days, Day 9: 13 days to the exam (the exam is the day after Day 21)');
  assert(cd.runs.length === 21 && total(cd.runs) === 21 && cd.runs.every(r => r.days === 1), 'one run per day');
  assert(same(cd.runs.map(r => r.phase), p.days.map(d => d.phase)), 'each cell takes its own day\'s phase, rest days included');
  assert(cd.runs.slice(0, 9).every(r => !r.future) && cd.runs.slice(9).every(r => r.future), 'days gone and today solid, the rest to come');
  assert(Math.abs(cd.at - 8 / 21 * 100) < EPS, 'today\'s marker at its left edge: 8/21 of the bar');
  assert(cd.labelEnd === false, 'a span of 62% keeps its label centred');
  assert(cd.months.length === 0, 'no month ticks on a short plan');
  assert(cd.start === START && cd.exam === p.goal.examDate, 'start and exam dates for the two ends');
  const first = planCountdown(p, START);
  assert(first.todayIndex === 0 && first.at === 0 && first.runs.filter(r => !r.future).length === 1 && first.left === 21, 'Day 1: marker at 0, one solid cell, 21 days left');
  const last = planCountdown(p, dayIso(p, 21));
  assert(last.left === 1 && Math.abs(last.at - 20 / 21 * 100) < EPS && last.labelEnd === true, 'the last day: 1 day left, label at the end (span < 28%)');
}

function checkSixWeeks() {
  const p = plan(PER_DAY_MAX), cd = planCountdown(p, dayIso(p, 1));
  assert(cd.len === PER_DAY_MAX && cd.perDay === true && cd.runs.length === PER_DAY_MAX, `${PER_DAY_MAX} days (6 weeks) is still one cell per day`);
  const p43 = plan(PER_DAY_MAX + 1), cd43 = planCountdown(p43, dayIso(p43, 1));
  assert(cd43.perDay === false && cd43.runs.length < PER_DAY_MAX, `${PER_DAY_MAX + 1} days: one bar per phase`);
}

function checkLongPlan() {
  const p = plan(LONG), today = dayIso(p, 60), cd = planCountdown(p, today);
  assert(p && cd.len === LONG && cd.perDay === false && total(cd.runs) === LONG, 'half a year: runs cover every day');
  assert(cd.runs.every(r => r.phase !== 'rest'), 'rest days are taken into the phase they sit in (no grey run)');
  assert(cd.runs.every((r, i) => i === 0 || r.phase !== cd.runs[i - 1].phase || r.future !== cd.runs[i - 1].future), 'neighbouring runs differ in phase or done / to come');
  const phases = [...new Set(cd.runs.map(r => r.phase))];
  assert(same(phases, ['learn', 'drill', 'mock']), 'phases in plan order: learn, drill, mock');
  const doneDays = total(cd.runs.filter(r => !r.future));
  assert(doneDays === 60, 'Day 60: 60 days solid (today included): ' + doneDays);
  assert(cd.left === LONG + 1 - 60 && Math.abs(cd.at - 59 / LONG * 100) < EPS, `${LONG + 1 - 60} days left, marker at 59/${LONG}`);
  // month ticks: every 1st of a month after the start, at its day's left edge
  const firsts = p.days.map((d, i) => [d.date, i]).filter(([iso, i]) => i > 0 && iso.endsWith('-01'));
  assert(cd.months.length === firsts.length && cd.months.length === 6, 'one tick per month start: ' + cd.months.length);
  assert(cd.months.every((m, k) => m.month === Number(firsts[k][0].slice(5, 7)) && Math.abs(m.at - firsts[k][1] / LONG * 100) < EPS),
    'each tick names its month (1–12) at that day\'s left edge');
  const late = planCountdown(p, dayIso(p, 160));
  assert(late.labelEnd === true && (100 - late.at) < LABEL_END_BELOW_PCT, 'a span under 28% puts the label at the end');
  const mid = planCountdown(p, dayIso(p, 130));
  assert(mid.labelEnd === false && (100 - mid.at) >= LABEL_END_BELOW_PCT, 'a span of 28% or more keeps it centred');
}

function checkThreeMonths() {
  const p = plan(90), cd = planCountdown(p, dayIso(p, 40));
  assert(cd.perDay === false && cd.months.length >= 2 && total(cd.runs) === 90, '3 months: phase bars + month ticks');
}

function checkNoTimeline() {
  const p = plan(21);
  assert(planCountdown(p, p.goal.examDate) === null, 'the exam day: no timeline');
  assert(planCountdown(p, isoAddDays(p.goal.examDate, 3)) === null, 'after the exam (plan finished): no timeline');
  assert(planCountdown(p, isoAddDays(START, -1)) === null, 'before the plan starts: no timeline (the card says when it starts)');
}

try {
  checkShortPlan();
  checkSixWeeks();
  checkLongPlan();
  checkThreeMonths();
  checkNoTimeline();
  console.log(`PLAN-COUNTDOWN PASS (${asserts} checks)`);
} catch (e) {
  console.error(e.message);
  console.log('PLAN-COUNTDOWN FAIL');
  process.exitCode = 1;
}
