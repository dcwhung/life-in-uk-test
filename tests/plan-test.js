// Study plan domain + storage (PR1, T-301–T-308; arch §B / §C / §G rows 1–2). Node only: the app's classic scripts run
// in one vm context (top-level const / let are shared across scripts there, as in a page) with an in-memory
// localStorage. Every date the domain sees is passed in as an ISO string, so no clock is mocked; the whole suite is
// then re-run as a child process under three time zones (DST edges, other side of the date line).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const APP_FILES = [
  'data/exams.js', 'data/study.js', 'js/core/config.js', 'js/core/utils.js', 'js/core/store.js',
  'js/domain/questions.js', 'js/domain/mastery.js', 'js/domain/similar.js', 'js/domain/plan.js', 'js/domain/planProgress.js',
];
const PLAN_FILES = ['js/domain/plan.js', 'js/domain/planProgress.js'];
const TZ_VARIANTS = ['Europe/London', 'Pacific/Auckland', 'America/Los_Angeles'];
const IS_CHILD = !!process.env.PLAN_TEST_CHILD;

// headline numbers (SK-020: checked against the data on 2026-10-08, arch §0)
const FACT_COUNT = 236;
const QUESTION_COUNT = 408;
const CANON_COUNT = 389;
const CANON_PER_CHAPTER = { 1: 9, 2: 11, 3: 161, 4: 106, 5: 102 };
const FACTS_PER_CHAPTER = { 1: 2, 2: 4, 3: 91, 4: 68, 5: 71 };
const MAX_SRC_PER_FACT = 8; // fact #21 (arch §0)
const MAX_QIDS_PER_FACT = 6; // fact #21's 8 sources are 6 distinct English questions
const STUDY_ORDER = [1, 2, 5, 4, 3]; // handoff §2.3
const TODAY = '2026-10-08'; // a Thursday
const STORAGE_BUDGET_BYTES = 300000; // arch §B.5

let asserts = 0;
const assert = (c, m) => {
  if (!c) throw new Error('FAIL: ' + m);
  asserts++;
  if (!IS_CHILD) console.log('ok:', m);
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const clone = v => JSON.parse(JSON.stringify(v));

function memoryStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  const api = {
    writes: 0,
    getItem: k => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { api.writes++; data.set(k, String(v)); },
    removeItem: k => { api.writes++; data.delete(k); },
    key: i => [...data.keys()][i] ?? null,
    get length() { return data.size; },
    dump: () => Object.fromEntries(data),
  };
  return api;
}

function loadApp(seed) {
  const storage = memoryStorage(seed);
  const ctx = vm.createContext({ localStorage: storage, console });
  for (const f of APP_FILES) {
    const file = path.join(ROOT, f);
    assert(fs.existsSync(file), `${f} exists`);
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: f });
  }
  return { storage, g: code => vm.runInContext(code, ctx) };
}

const app = loadApp();
const g = app.g;
const STUDY = g('STUDY');
const isoAddDays = g('isoAddDays');
const goalFor = (days, dailyMins = 60, restDays = [0], level = 'none', from = TODAY) =>
  ({ examDate: isoAddDays(from, days), dailyMins, restDays, level });
const allTasks = plan => plan.days.flatMap(d => d.tasks);
const tasksOf = (plan, type) => allTasks(plan).filter(t => t.type === type);
const emptyLog = () => ({ v: 1, days: {} });
const logWith = (iso, ok = [], bad = [], mock = []) => ({
  v: 1, days: { [iso]: { ok: Object.fromEntries(ok.map(k => [k, 1])), bad: Object.fromEntries(bad.map(k => [k, 1])), mock } },
});

function checkConfigAndStore() {
  assert(g('STUDY_PLAN_READY') === false, 'STUDY_PLAN_READY is false until PR7 (G19)');
  assert(g('STUDY_PLAN_ENABLED_LS') === 'lifeuk.studyPlanEnabled' && g('STUDY_PLAN_LS') === 'lifeuk.studyPlan'
    && g('STUDY_PLAN_PROGRESS_LS') === 'lifeuk.studyPlanProgress', 'three plan localStorage keys carry the lifeuk. prefix');
  assert(g('PLAN_PREFIX') === 'p', "plan side sessions use the 'p' set id prefix");
  assert(!g('LEGACY_LS_MIGRATION').studyPlan && !g('MERGE_LS').includes(g('STUDY_PLAN_LS')), 'new keys are not in the legacy migration tables');
  const fresh = loadApp({ 'other.app': 'x' });
  assert(fresh.g('isStudyPlanEnabled()') === true, 'the plan switch defaults to on (no value stored)');
  fresh.g('setStudyPlanEnabled(false)');
  assert(fresh.storage.getItem('lifeuk.studyPlanEnabled') === 'false' && fresh.g('isStudyPlanEnabled()') === false, 'switch off is stored as false');
  fresh.g('setStudyPlanEnabled(true)');
  assert(fresh.g('isStudyPlanEnabled()') === true, 'switch on again');
  fresh.storage.setItem('lifeuk.studyPlan', '{"v":1}');
  fresh.storage.setItem('lifeuk.studyPlanProgress', '{"v":1}');
  fresh.g('clearStudyPlan()');
  const left = fresh.storage.dump();
  assert(!('lifeuk.studyPlan' in left) && !('lifeuk.studyPlanProgress' in left), 'clearStudyPlan removes the plan and its log');
  assert(left['lifeuk.studyPlanEnabled'] === 'true' && left['other.app'] === 'x', 'clearStudyPlan keeps the switch and other keys');
  fresh.storage.setItem('lifeuk.homePrefs', '{}');
  fresh.g("removeLS('lifeuk.homePrefs')");
  assert(fresh.storage.getItem('lifeuk.homePrefs') === null, 'removeLS removes a key');
}

function checkHeadlineNumbers() {
  assert(STUDY.length === FACT_COUNT && g('TOTAL_QUESTIONS') === QUESTION_COUNT, `${FACT_COUNT} facts, ${QUESTION_COUNT} questions`);
  assert(g('PLAN_TOTAL_QIDS') === CANON_COUNT, `${CANON_COUNT} distinct English questions (canonical keys, G4)`);
  assert(Object.keys(g('PLAN_CANON_QKEY')).length === QUESTION_COUNT, 'every question has a canonical key');
  const perCh = g('PLAN_CHAPTER_QIDS');
  assert(same(Object.fromEntries(Object.entries(perCh).map(([ch, ks]) => [ch, ks.length])), CANON_PER_CHAPTER), 'canonical questions per chapter 9 / 11 / 161 / 106 / 102');
  const factsPerCh = {};
  STUDY.forEach(f => { factsPerCh[f.ch] = (factsPerCh[f.ch] || 0) + 1; });
  assert(same(factsPerCh, FACTS_PER_CHAPTER), 'facts per chapter 2 / 4 / 91 / 68 / 71');
  const qidsOf = g('planFactQids');
  const factOfKey = g('FACT_BY_QKEY');
  const all = STUDY.flatMap(f => qidsOf(f));
  assert(new Set(all).size === CANON_COUNT && all.length === CANON_COUNT, 'facts split the canonical questions with no overlap');
  assert(STUDY.every(f => qidsOf(f).every(k => factOfKey[k].id === f.id)), 'a canonical question never crosses to another fact');
  assert(Math.max(...STUDY.map(f => f.src.length)) === MAX_SRC_PER_FACT && STUDY.find(f => f.id === 21).src.length === MAX_SRC_PER_FACT, 'fact #21 has the most sources (8)');
  assert(STUDY.every(f => qidsOf(f).length >= 1) && Math.max(...STUDY.map(f => qidsOf(f).length)) === MAX_QIDS_PER_FACT && qidsOf(STUDY.find(f => f.id === 21)).length === MAX_QIDS_PER_FACT, 'every fact has 1–6 canonical questions (fact #21: 6)');
  assert(g("planCanonKey('4.14')") === '3.12' && g("planCanonKey('3.12')") === '3.12', 'a repeated question maps to its first appearance in exam order');
  assert(g("planCanonKey('99.99')") === '99.99', 'an unknown key maps to itself');
  // W-030: every stored copy of one question, whichever copy is asked about
  assert(same(g("planSameQuestionKeys(['1.0', '4.14', '3.12', '9.9'], '3.12')"), ['4.14', '3.12'])
    && same(g("planSameQuestionKeys(['4.14'], '3.12')"), ['4.14']) && same(g("planSameQuestionKeys(['1.0'], '4.14')"), []),
    'planSameQuestionKeys: every key that is the same question (4.14 = 3.12), none when absent');
  assert(same(g('PLAN_LEARN_ORDER'), STUDY_ORDER.flatMap(ch => STUDY.filter(f => f.ch === ch).map(f => f.id))), 'learn order = Ch 1, 2, 5, 4, 3, Study card order inside');
}

function checkDates() {
  const cases = [
    ['2026-10-24', 1, '2026-10-25'], ['2026-10-24', 2, '2026-10-26'], ['2027-03-27', 1, '2027-03-28'], ['2027-03-28', 1, '2027-03-29'],
    ['2026-12-31', 1, '2027-01-01'], ['2028-02-28', 1, '2028-02-29'], ['2028-02-28', 2, '2028-03-01'], ['2027-01-01', -1, '2026-12-31'],
  ];
  assert(cases.every(([from, n, to]) => isoAddDays(from, n) === to), 'isoAddDays across BST start / end, year end, leap day, backwards');
  const diff = g('isoDiffDays');
  assert(diff('2026-10-24', '2026-10-26') === 2 && diff('2026-10-26', '2026-10-24') === -2, 'isoDiffDays across the BST change (both ways)');
  assert(diff('2028-01-01', '2029-01-01') === 366 && diff('2026-01-01', '2027-01-01') === 365, 'isoDiffDays over a leap / plain year');
  assert(g("isoWeekday('2026-10-08')") === 4 && g("isoWeekday('2026-10-11')") === 0, 'isoWeekday: Thu 8 Oct, Sun 11 Oct 2026');
  const months = g('isoAddMonths');
  assert(months('2026-08-31', 6) === '2027-02-28' && months('2027-08-31', 6) === '2028-02-29' && months(TODAY, 6) === '2027-04-08', 'isoAddMonths clamps to the month end');
  const isIso = g('isoIsValid');
  assert(isIso('2028-02-29') && !isIso('2027-02-29') && !isIso('2026-2-3') && !isIso('x') && !isIso(null) && !isIso(20261008), 'isoIsValid accepts real dates only');
  const today = g('planTodayIso');
  assert(today(new Date(2026, 9, 24, 23, 30)) === '2026-10-24' && today(new Date(2026, 9, 25, 0, 30)) === '2026-10-25', 'planTodayIso is the local date either side of midnight');
  assert(today(new Date(2026, 9, 25, 1, 30)) === '2026-10-25' && today(new Date(2027, 2, 28, 3, 0)) === '2027-03-28', 'planTodayIso on DST change days');
  assert(same(g('planExamDateRange')(TODAY), { min: '2026-10-15', max: '2027-04-08' }), 'exam date range: +7 days … +6 months');
}

function checkValidation() {
  const v = (goal, today = TODAY) => g('validatePlanGoal')(goal, today);
  assert(v(goalFor(21)).ok && v(goalFor(21)).errors.length === 0, 'a normal goal is valid');
  assert(v(goalFor(6, 60, [])).errors.includes('examDate') && v(goalFor(7, 60, [])).ok, 'exam date: 6 days out rejected, 7 accepted');
  const max = g('planExamDateRange')(TODAY).max;
  assert(v({ ...goalFor(21), examDate: max }).ok && v({ ...goalFor(21), examDate: isoAddDays(max, 1) }).errors.includes('examDate'), 'exam date: 6 months accepted, one day more rejected');
  assert(v({ ...goalFor(21), examDate: '2026-13-01' }).errors.includes('examDate'), 'exam date must be a real ISO date');
  assert([29, 135, 50, '60', 37.5].every(m => v(goalFor(21, m)).errors.includes('dailyMins')) && [30, 45, 120].every(m => v(goalFor(21, m)).ok), 'daily minutes 30–120 in steps of 15');
  assert([[0, 1, 2, 3, 4, 5, 6], [7], [0, 0], 'x', [-1]].every(r => v(goalFor(28, 60, r)).errors.includes('restDays')), 'rest days: 0–6, unique, not all seven');
  assert(v(goalFor(21, 60, [0], 'pro')).errors.includes('level'), 'unknown level rejected');
  assert(v(goalFor(7, 60, [0])).errors.includes('studyDays') && v(goalFor(8, 60, [0])).ok, 'G28: 6 study days rejected, 7 accepted');
  assert(!v(null).ok && !v({}).ok && !v(undefined).ok, 'missing goal is invalid and does not throw');
}

function checkFeasibility() {
  const status = g('planFeasStatus');
  assert(status(1.15) === 'ok' && status(1.1499) === 'tight' && status(0.95) === 'tight' && status(0.9499) === 'short', 'feasibility boundaries 1.15 / 0.95');
  const f = mins => g('planFeasibility')(goalFor(21, mins), TODAY);
  const need = Math.round(FACT_COUNT * 1.5 + CANON_COUNT * 0.75 + CANON_COUNT * 0.4 * 0.75 + 5 * 60);
  assert(f(60).needMins === need, `need minutes (none) = ${need}`);
  assert(f(60).studyDays === 18 && f(60).restCount === 3 && f(60).availMins === 18 * 60, '21 days with Sundays off = 18 study days');
  assert(f(120).status === 'ok' && f(60).status === 'tight' && f(30).status === 'short', 'three feasibility states');
  assert(f(60).diffMins === 18 * 60 - need, 'diffMins = available - needed');
  const nf = l => g('planNeedMinutes')(l);
  assert(nf('none') > nf('some') && nf('some') > nf('exam'), 'need minutes shrink with the level');
  checkFeasibilityFactsLeft();
}
// W-035: a goal changed mid-plan is measured against the facts still to learn (what replanFrom schedules), not the
// whole syllabus. Review case: a 21-day plan at 60 min / day, 12 days in, 44 facts left → 9 days left is not short
function checkFeasibilityFactsLeft() {
  const order = g('PLAN_LEARN_ORDER'), left = order.slice(order.length - 44);
  const goal = goalFor(9, 60, []);
  const all = g('planFeasibility')(goal, TODAY), part = g('planFeasibility')(goal, TODAY, left);
  assert(all.status === 'short' && part.status !== 'short', `W-035: 9 days × 60 min: whole syllabus ${all.status}, 44 facts left ${part.status}`);
  const drillAndMocks = all.needMins - Math.round(g('planLearnMinutes')('none'));
  assert(Math.abs(part.needMins - Math.round(g('planLearnMinutes')('none', left)) - drillAndMocks) <= 1, 'W-035: only the learn part shrinks (drill + mocks estimate unchanged)');
  assert(JSON.stringify(g('planFeasibility')(goal, TODAY, order)) === JSON.stringify(all), 'W-035: the default is the whole learn order');
}

function checkChunkAndSplit() {
  const chunk = g('planChunkWeighted');
  const items = (n, w = 1, ch = 1) => Array.from({ length: n }, (_, i) => ({ ch, id: i + 1, w }));
  assert(chunk(items(10), 10).every(c => c.length === 1 && c[0].ids.length === 1), '10 items into 10 days: one each');
  const heavy = [{ ch: 1, id: 1, w: 9 }, { ch: 1, id: 2, w: 1 }, { ch: 1, id: 3, w: 1 }];
  assert(chunk(heavy, 3).every(c => c.length === 1), 'no empty chunk when items >= days');
  assert(same(chunk(items(4), 1), [[{ ch: 1, ids: [1, 2, 3, 4] }]]), 'one day takes everything, same chapter merged');
  const mixed = [...items(2, 1, 1), ...items(2, 1, 2)];
  assert(same(chunk(mixed, 1)[0].map(gr => gr.ch), [1, 2]), 'a chapter change starts a new group');
  const big = chunk(items(100, 2), 7);
  const ws = big.map(c => c.reduce((s, gr) => s + gr.ids.length * 2, 0));
  assert(Math.max(...ws) - Math.min(...ws) <= 2 * 2, 'chunks are balanced by weight');
  const split = (n, goal, mins) => g('planSplitStudyDays')(n, goal, mins);
  const s1 = split(20, goalFor(21, 120), 645.75);
  assert(same(s1, { learn: 7, drill: 9, mock: 4, overload: false }), 'split 20 days / 120 min: learn 7, drill 9, mock 4');
  const s2 = split(10, goalFor(21, 60), 645.75);
  assert(s2.learn === 9 && s2.mock === 1 && s2.drill === 0 && s2.overload, 'G13: too little time → learn takes all but 1 mock day, overload');
  assert(split(10, goalFor(21, 60), 0).learn === 0, 'nothing left to learn → 0 learn days');
}

function checkPlanShape(plan, goal, label) {
  const n = g('isoDiffDays')(TODAY, goal.examDate);
  assert(plan.v === 1 && plan.start === TODAY && plan.days.length === n, `${label}: one day per date before the exam`);
  assert(plan.days.every((d, i) => d.date === isoAddDays(TODAY, i)), `${label}: consecutive dates from Day 1`);
  const rest = new Set(goal.restDays);
  assert(plan.days.every(d => (d.phase === 'rest') === rest.has(g('isoWeekday')(d.date)) && (d.phase !== 'rest' || d.tasks.length === 0)), `${label}: rest days have no tasks`);
  const rank = { learn: 0, drill: 1, mock: 2 };
  const order = plan.days.filter(d => d.phase !== 'rest').map(d => rank[d.phase]);
  assert(order.every((r, i) => r !== undefined && (i === 0 || r >= order[i - 1])), `${label}: learn → drill → mock`);
  const facts = tasksOf(plan, 'read').flatMap(t => t.facts);
  assert(same(facts, g('PLAN_LEARN_ORDER')), `${label}: every fact read exactly once, in learn order`);
  const qids = tasksOf(plan, 'practice').flatMap(t => t.qids);
  assert(qids.length === CANON_COUNT && new Set(qids).size === CANON_COUNT, `${label}: every canonical question practised exactly once`);
  return plan;
}

function checkPlanTasks(plan, goal, label) {
  const study = plan.days.filter(d => d.phase !== 'rest');
  const last = study[study.length - 1];
  assert(last.light === true && last.tasks.every(t => t.type !== 'mock'), `${label}: last study day is a light review`);
  assert(study.some(d => d.tasks.some(t => t.type === 'mock')), `${label}: at least one mock day`);
  const perDay = Math.max(1, Math.min(2, Math.floor(goal.dailyMins / 60)));
  assert(study.filter(d => d.phase === 'mock' && !d.light).every(d => d.tasks.filter(t => t.type === 'mock').length === perDay), `${label}: ${perDay} mock(s) per mock day`);
  assert(study.filter(d => d.phase === 'learn').every(d => d.tasks.some(t => t.type === 'review') && d.tasks.some(t => t.type === 'read')), `${label}: every learn day reads facts and clears wrong answers`);
  assert(study.filter(d => d.phase === 'drill').every(d => d.tasks.some(t => t.type === 'drill' && t.quota > 0)), `${label}: every drill day drills a chapter`);
  const pairOk = d => d.tasks.every(t => t.type !== 'read' || (d.tasks[t.pair].type === 'practice' && d.tasks[t.pair].ch === t.ch
    && same(d.tasks[t.pair].qids, t.facts.flatMap(id => g('planFactQids')(STUDY.find(f => f.id === id))))));
  assert(plan.days.every(pairOk), `${label}: each read task pairs with the practice task of its facts`);
  assert(tasksOf(plan, 'review').every(t => !('qids' in t)) && tasksOf(plan, 'mock').every(t => !('exam' in t)), `${label}: review / mock contents wait for the day (G9 lazy)`);
}

function checkBuildPlan() {
  const build = g('buildPlan');
  const durations = [14, 21, 28, 42, g('isoDiffDays')(TODAY, g('planExamDateRange')(TODAY).max)];
  let built = 0;
  for (const days of durations) for (const level of ['none', 'some', 'exam']) for (const rest of [[], [0], [0, 6], [1, 3, 5]]) for (const mins of [30, 60, 120]) {
    const goal = goalFor(days, mins, rest, level);
    if (!g('validatePlanGoal')(goal, TODAY).ok) continue;
    const label = `${days}d ${level} rest[${rest}] ${mins}m`;
    checkPlanTasks(checkPlanShape(build(goal, TODAY), goal, label), goal, label);
    built++;
  }
  assert(built > 150, `built ${built} valid goal combinations`);
  const sunday = build(goalFor(21, 60, [0], 'none', '2026-10-11'), '2026-10-11');
  assert(sunday.days[0].phase === 'rest', 'G6: a plan created on a rest day starts with a rest day');
  const tight = goalFor(14, 30, [0, 6]);
  assert(g('planFeasibility')(tight, TODAY).status === 'short' && g('planFeasibility')(tight, TODAY).overload, 'G13: 14 days × 30 min is short and overloaded (still built above)');
  assert(build(goalFor(5), TODAY) === null, 'an invalid goal builds no plan');
  const input = goalFor(21);
  const plan = build(input, TODAY);
  input.restDays.push(3);
  assert(same(plan.goal.restDays, [0]) && plan.createdAt === TODAY && same(plan.goalHistory, []), 'the plan keeps its own copy of the goal');
}

function checkParse() {
  const parse = g('parseStoredPlan');
  const plan = g('buildPlan')(goalFor(21), TODAY);
  assert(same(parse(clone(plan)), plan), 'a stored plan parses back unchanged');
  const broken = [null, '', 'x', 3, [], { ...plan, v: 2 }, { ...plan, days: 'x' }, { ...plan, start: '2026-13-01' }, { ...plan, goal: null },
    { ...plan, goal: { ...plan.goal, level: 'pro' } }, { ...plan, days: plan.days.slice(1) }, { ...plan, days: [{ ...plan.days[0], tasks: [{ type: 'nope' }] }, ...plan.days.slice(1)] },
    { ...plan, days: [{ ...plan.days[0], phase: 'x' }, ...plan.days.slice(1)] },
    { ...plan, days: [{ ...plan.days[0], tasks: [{ type: 'read', ch: 1, facts: [9999], pair: 1 }] }, ...plan.days.slice(1)] },
    { ...plan, days: [{ ...plan.days[0], tasks: [{ type: 'practice', ch: 1, qids: 'x' }] }, ...plan.days.slice(1)] }];
  assert(broken.every(b => parse(clone(b)) === null), `${broken.length} malformed plans parse to null without throwing`);
  const parseLog = g('parsePlanLog');
  assert(same(parseLog({ v: 1, days: { [TODAY]: { ok: { '1.0': 1 } } } }), { v: 1, days: { [TODAY]: { ok: { '1.0': 1 }, bad: {}, mock: [] } } }), 'a log day is filled with empty ok / bad / mock');
  const badLogs = [null, 'x', [], { v: 2, days: {} }, { v: 1, days: [] }, { v: 1, days: { x: {} } }, { v: 1, days: { [TODAY]: { ok: [] } } }, { v: 1, days: { [TODAY]: { mock: {} } } }];
  assert(badLogs.every(b => parseLog(b) === null), `${badLogs.length} malformed logs parse to null without throwing`);
}

function checkProgress() {
  const plan = g('buildPlan')(goalFor(21), TODAY);
  const day = plan.days[0];
  const prog = (task, dl) => g('planTaskProgress')(task, g('planDayLog')(dl, TODAY));
  const practice = day.tasks.find(t => t.type === 'practice');
  assert(prog(practice, emptyLog()).done === 0 && prog(practice, emptyLog()).total === practice.qids.length, 'practice starts at 0 / n');
  const [first, ...others] = practice.qids;
  assert(prog(practice, logWith(TODAY, [], [first])).done === 0 && prog(practice, logWith(TODAY, [], [first])).bad === 1, 'a wrong answer does not count, it is tallied as bad');
  assert(prog(practice, logWith(TODAY, [first], [first])).done === 1 && prog(practice, logWith(TODAY, [first], [first])).bad === 0, 'right after wrong counts and clears the bad tally');
  assert(prog(practice, logWith(TODAY, practice.qids)).complete, 'all questions right completes the task');
  const read = day.tasks.find(t => t.type === 'read');
  const multi = read.facts.map(id => STUDY.find(f => f.id === id)).find(f => g('planFactQids')(f).length > 1);
  const mq = g('planFactQids')(multi);
  assert(prog(read, logWith(TODAY, mq.slice(1))).done === 0 && prog(read, logWith(TODAY, mq)).done === 1, 'G3 / G4: a fact counts once all its questions are right');
  assert(prog(read, logWith(TODAY, practice.qids)).complete, 'practising the block completes its reading');
  assert(prog({ type: 'review' }, emptyLog()).pending && prog({ type: 'review' }, emptyLog()).total === 0, 'an unopened review is pending and weighs nothing (G24)');
  assert(prog({ type: 'review', qids: [] }, emptyLog()).complete && prog({ type: 'review', qids: [] }, emptyLog()).total === 1, 'an empty wrong list is one done unit');
  assert(prog({ type: 'wrongFacts', facts: [], anchor: {} }, emptyLog()).complete, 'no wrong facts = done');
  assert(prog({ type: 'drill', ch: 3, quota: 12 }, emptyLog()).pending && prog({ type: 'drill', ch: 3, quota: 12 }, emptyLog()).total === 12, 'an unopened drill is pending, quota units');
  const mock = slot => ({ type: 'mock', slot, exam: 4 });
  const fail = { exam: 4, correct: 17, total: 24 }, pass = { exam: 'all', correct: 18, total: 24 };
  assert(prog(mock(0), logWith(TODAY, [], [], [fail])).done === 0 && prog(mock(0), logWith(TODAY, [], [], [fail, pass])).done === 24, 'G10 / G25: a mock is 24 units once passed (18 / 24)');
  assert(!prog(mock(1), logWith(TODAY, [], [], [pass])).complete && prog(mock(1), logWith(TODAY, [], [], [pass, pass])).complete, 'the second mock slot needs a second pass');
  assert(prog(mock(0), logWith(TODAY, [], [], [fail, pass])).best === 18, 'the best score is kept for the card');
  const dc = g('planDayCompletion')(day, g('planDayLog')(logWith(TODAY, practice.qids.slice(0, 1)), TODAY));
  const weights = day.tasks.filter(t => t.type !== 'review').reduce((s, t) => s + (t.qids || t.facts).length, 0);
  assert(dc.total === weights && dc.pct > 0 && dc.pct < 100, 'day % = done / total units, the unopened review left out');
  assert(g('planDayCompletion')(plan.days[3], g('planDayLog')(emptyLog(), plan.days[3].date)).pct === null, 'a rest day has no %');
}

function checkStatusAndCarry() {
  const plan = g('buildPlan')(goalFor(21), TODAY);
  const st = iso => g('planStatus')(plan, iso);
  assert(st(TODAY) === 'active' && st(isoAddDays(TODAY, 20)) === 'active' && st(plan.goal.examDate) === 'examDay' && st(isoAddDays(plan.goal.examDate, 1)) === 'ended', 'G16: active → examDay → ended');
  assert(g('planDayNumber')(plan, '2026-10-10') === 3 && g('planDayAt')(plan, '2026-10-10').date === '2026-10-10' && g('planDayAt')(plan, plan.goal.examDate) === null, 'Day n from the start date; the exam day has no day entry');
  const today = '2026-10-10';
  const p = clone(plan);
  p.days[0].tasks.find(t => t.type === 'review').qids = [p.days[12].tasks.find(t => t.type === 'practice').qids[0]];
  const day0Practice = p.days[0].tasks.filter(t => t.type === 'practice').flatMap(t => t.qids);
  const log = logWith('2026-10-08', day0Practice);
  const carry = g('planCarryTasks')(p, log, today);
  assert(carry.every(c => c.date < today && c.task.type !== 'mock'), 'G8: carry only lists past non-mock tasks');
  assert(carry.some(c => c.date === '2026-10-08' && c.task.type === 'review') && !carry.some(c => c.date === '2026-10-08' && c.task.type === 'practice'), 'finished tasks are not carried, an unfinished review is');
  assert(!carry.some(c => c.date === '2026-10-09' && c.task.type === 'review'), 'G24: a never-opened past review is not carried');
  assert(carry[0].dayNumber === 1 && carry.every((c, i) => i === 0 || c.date >= carry[i - 1].date), 'carry is oldest first with its Day n');
  assert(g('planCarryTasks')(p, log, isoAddDays(plan.goal.examDate, 1)).length === 0, 'G16: no carry after the exam');
  assert(g('planCarryTasks')({ ...p, carryFrom: today }, log, today).length === 0, 'G7: tasks before a re-plan are never carried again');
  const step = g('planNextStep')(p, log, today);
  assert(step.kind === 'today' && step.taskIndex === 0 && step.resumeAt === p.days[2].tasks[0].facts[0], "next step: today's first unfinished task, from its first fact");
  const allDone = { v: 1, days: { [today]: { ok: Object.fromEntries(p.days[2].tasks.flatMap(t => g('planTaskQids')(t)).map(k => [k, 1])), bad: {}, mock: [] } } };
  p.days[2].tasks.find(t => t.type === 'review').qids = [];
  assert(g('planNextStep')(p, { v: 1, days: { ...log.days, ...allDone.days } }, today).kind === 'carry', 'next step: carry-over once today is done');
  assert(g('planNextStep')(p, log, plan.goal.examDate).kind === 'done', 'next step: nothing on the exam day');
}

function checkAttribution() {
  const plan = clone(g('buildPlan')(goalFor(21), TODAY));
  const today = '2026-10-10';
  const attr = (qid, log, ctxIso, on = today) => g('planAttributeAnswer')(plan, log, qid, on, ctxIso);
  const qPast = plan.days[0].tasks.find(t => t.type === 'practice').qids[0];
  const qToday = plan.days[2].tasks.find(t => t.type === 'practice').qids[0];
  const qFuture = plan.days[12].tasks.find(t => t.qids).qids[0];
  const rows = [
    ['ctx past day', qToday, emptyLog(), '2026-10-08', '2026-10-08'],
    ['ctx future day (early)', qToday, emptyLog(), '2026-10-20', '2026-10-20'],
    ['ctx outside the plan', qToday, emptyLog(), '2026-12-01', null],
    ['no ctx, in today', qToday, emptyLog(), null, today],
    ['no ctx, in a past task', qPast, emptyLog(), null, '2026-10-08'],
    ['no ctx, past task already right', qPast, logWith('2026-10-08', [qPast]), null, null],
    ['no ctx, only in a future day', qFuture, emptyLog(), null, null],
  ];
  rows.forEach(([why, qid, log, ctxIso, want]) => assert(attr(qid, log, ctxIso) === want, `G2 / G5 attribution: ${why} → ${want}`));
  plan.days[0].tasks.find(t => t.type === 'review').qids = [qFuture];
  plan.days[1].tasks.find(t => t.type === 'review').qids = [qFuture];
  assert(attr(qFuture, emptyLog(), null) === '2026-10-08', 'the earliest unfinished carry task wins');
  assert(attr(qToday, emptyLog(), null, plan.goal.examDate) === null && attr(qToday, emptyLog(), '2026-10-08', isoAddDays(plan.goal.examDate, 2)) === null, 'G16: nothing is attributed on / after the exam day');
  const mockDay = plan.days.find(d => d.tasks.some(t => t.type === 'mock'));
  const am = (on, ctxIso) => g('planAttributeMock')(plan, on, ctxIso);
  assert(am(mockDay.date, null) === mockDay.date && am(mockDay.date, mockDay.date) === mockDay.date, 'a mock counts on a day that has a mock task');
  assert(am(today, null) === null && am(isoAddDays(mockDay.date, 1), mockDay.date) === null, 'a mock never counts on other days or late');
  const l1 = g('planApplyAnswer')(emptyLog(), today, 'a', false);
  const l2 = g('planApplyAnswer')(l1, today, 'a', true);
  assert(same(l1.days[today], { ok: {}, bad: { a: 1 }, mock: [] }) && l2.days[today].ok.a === 1 && l2.days[today].bad.a === 1, 'apply answer: wrong → bad, then right → ok');
  assert(same(emptyLog(), { v: 1, days: {} }) && !l1.days[today].ok.a, 'apply answer returns a new log');
  const lm = g('planApplyMock')(emptyLog(), today, { exam: 4, correct: 20, total: 24 });
  assert(same(lm.days[today].mock, [{ exam: 4, correct: 20, total: 24 }]), 'apply mock appends the attempt');
}

function checkRounds() {
  const qids = Array.from({ length: 30 }, (_, i) => `1.${i}`);
  const task = { type: 'practice', ch: 1, qids };
  const next = (dl, skipped) => g('planNextRound')(task, g('planDayLog')(dl, TODAY), skipped);
  assert(same(next(emptyLog(), []), qids.slice(0, 24)), 'a round is at most 24 unanswered questions');
  assert(next(emptyLog(), qids.slice(0, 3)).slice(0, 3).join() === qids.slice(3, 6).join(), 'skipped questions go after the others');
  const answered = logWith(TODAY, qids.slice(0, 28), qids.slice(28));
  assert(same(next(answered, []), qids.slice(28)) && g('planRetryLeft')(task, g('planDayLog')(answered, TODAY)) === 2, 'wrong ones come back once the rest are done (🔁 n left)');
  const mixed = logWith(TODAY, qids.slice(0, 20), [qids[0], qids[25]]);
  assert(same(next(mixed, []), [...qids.slice(20, 25), ...qids.slice(26), qids[25]]), 'unanswered first, then wrong-not-yet-right');
}

function checkMaterialize() {
  const plan = g('buildPlan')(goalFor(42, 60, [0]), TODAY);
  const day = plan.days[0];
  const wrong = ['4.14', '3.12', ...g('allQuestions')().slice(0, 30).map(({ examNum, origIdx }) => `${examNum}.${origIdx}`)];
  const ctx = { wrongKeys: wrong, streaks: {}, completedExams: {}, plan, log: emptyLog() };
  const m = g('materializePlanDay')(day, ctx);
  const review = m.day.tasks.find(t => t.type === 'review');
  assert(m.changed && review.qids.length === 24 && review.qids[0] === '3.12' && new Set(review.qids).size === 24, 'G9: review = first 24 wrong questions, canonical, no repeats');
  assert(!day.tasks.find(t => t.type === 'review').qids, 'materialise returns a new day (input untouched)');
  const again = g('materializePlanDay')(m.day, { ...ctx, wrongKeys: [] });
  assert(!again.changed && same(again.day, m.day), 'materialise is idempotent: a snapshot is frozen');
  assert(same(g('materializePlanDay')(day, { ...ctx, wrongKeys: [] }).day.tasks.find(t => t.type === 'review').qids, []), 'no wrong answers → empty review');
  const drillDay = plan.days.find(d => d.phase === 'drill');
  const drill = drillDay.tasks.find(t => t.type === 'drill');
  const chQ = g('PLAN_CHAPTER_QIDS')[drill.ch];
  const mastered = Object.fromEntries(chQ.slice(0, chQ.length - 2).map(k => [k, 3]));
  const md = g('materializePlanDay')(drillDay, { ...ctx, streaks: mastered }).day.tasks.find(t => t.type === 'drill');
  assert(md.qids.length === drill.quota && same(md.qids.slice(0, 2), chQ.slice(-2)), 'drill picks unmastered questions of its chapter first');
  const wf = g('materializePlanDay')(drillDay, ctx).day.tasks.find(t => t.type === 'wrongFacts');
  assert(wf.facts.length > 0 && wf.facts.every(id => wf.anchor[id]) && wf.facts.length <= wf.quota, 'wrong facts come from the wrong list, each with its anchor question');
  const mockDay = plan.days.find(d => d.tasks.filter(t => t.type === 'mock').length);
  const mk = g('materializePlanDay')(mockDay, { ...ctx, completedExams: { 1: true, 2: true } }).day.tasks.filter(t => t.type === 'mock');
  assert(mk[0].exam === 3, 'a mock takes the first exam not yet completed');
}

function checkReplan() {
  const plan = g('buildPlan')(goalFor(21), TODAY);
  const today = '2026-10-10';
  const doneQ = plan.days[0].tasks.find(t => t.type === 'practice').qids;
  const log = logWith('2026-10-08', doneQ);
  const goal = goalFor(28, 90, [0, 6]);
  const re = g('replanFrom')(clone(plan), goal, today, log);
  assert(same(re.days.slice(0, 2), plan.days.slice(0, 2)), 'G7: past days are frozen word for word');
  assert(re.start === TODAY && re.days.every((d, i) => d.date === isoAddDays(TODAY, i)) && re.days.length === 28, 'G7: Day numbers still count from the original Day 1');
  assert(re.carryFrom === today && same(re.goal, goal) && same(re.goalHistory, [{ at: today, goal: plan.goal }]), 'new goal stored, old one in goalHistory');
  const readDone = plan.days[0].tasks.find(t => t.type === 'read').facts;
  const futureFacts = re.days.slice(2).flatMap(d => d.tasks.filter(t => t.type === 'read').flatMap(t => t.facts));
  assert(same(futureFacts, g('PLAN_LEARN_ORDER').filter(id => !readDone.includes(id))), 'unfinished facts are re-planned once each, in learn order');
  assert(g('planCarryTasks')(re, log, today).length === 0, 'nothing from before the re-plan is carried');
  assert(g('replanFrom')(clone(plan), goalFor(5, 60, [0], 'none', today), today, log) === null, 'an invalid new goal is refused');
  const late = isoAddDays(plan.goal.examDate, 3);
  const after = g('replanFrom')(clone(plan), goalFor(21, 60, [0], 'none', late), late, log);
  assert(after.days.every((d, i) => d.date === isoAddDays(TODAY, i)) && same(after.days.slice(0, 21), plan.days), 'a re-plan after the exam keeps the old days and fills the gap');
  assert(after.days.slice(21, 24).every(d => d.phase === 'rest'), 'gap days are rest days');
}

// W-026: a fact finished today or early on a later day is never planned again; today's finished groups stay on today
function checkReplanKeepsDoneFacts() {
  const readFacts = days => days.flatMap(d => d.tasks.filter(t => t.type === 'read').flatMap(t => t.facts));
  const plan = g('buildPlan')(goalFor(21, 120), TODAY);
  const dayQids = d => d.tasks.filter(t => t.type === 'practice').flatMap(t => t.qids);
  const sameDay = logWith(TODAY, dayQids(plan.days[0]));
  const doneToday = readFacts([plan.days[0]]);
  const re = g('replanFrom')(clone(plan), goalFor(21, 30), TODAY, sameDay);
  assert(doneToday.length > 20 && !readFacts(re.days.slice(1)).some(id => doneToday.includes(id)), `W-026: ${doneToday.length} facts done today, then 30 min/day the same day → none moved to later days`);
  assert(doneToday.every(id => readFacts([re.days[0]]).includes(id)), "W-026: today's finished groups stay on the new today");
  const after = g('planDayCompletion')(re.days[0], g('planDayLog')(sameDay, TODAY));
  assert(after.done >= doneToday.length + dayQids(plan.days[0]).length, "W-026: today's % keeps the work already done");
  const all = readFacts(re.days);
  assert(all.length === FACT_COUNT && new Set(all).size === FACT_COUNT, 'W-026: every fact still appears exactly once');
  assert(re.days[0].tasks.every(t => t.type !== 'read' || (re.days[0].tasks[t.pair].type === 'practice' && same(re.days[0].tasks[t.pair].qids, t.facts.flatMap(id => g('planFactQids')(STUDY.find(f => f.id === id)))))), 'W-026: pinned read tasks point at their own practice task');
  const early = plan.days.find(d => d.date === '2026-10-13');
  const earlyLog = logWith('2026-10-13', dayQids(early));
  const earlyFacts = readFacts([early]);
  const re2 = g('replanFrom')(clone(plan), goalFor(28, 60, [0]), '2026-10-09', earlyLog);
  const planned = readFacts(re2.days.slice(1));
  assert(earlyFacts.length > 0 && !planned.some(id => earlyFacts.includes(id)), `W-026: ${earlyFacts.length} facts finished early on 10-13 are not planned again after a re-plan on 10-09`);
  assert(same(planned, g('PLAN_LEARN_ORDER').filter(id => !earlyFacts.includes(id))), 'W-026: every other fact (Day 1 ones included, unfinished) is planned once, in learn order');
}

// W-028: finished facts stay finished through any number of re-plans, even once no read task holds them any more
function checkReplanTwice() {
  const readFacts = days => days.flatMap(d => d.tasks.filter(t => t.type === 'read').flatMap(t => t.facts));
  const dayQids = d => d.tasks.filter(t => t.type === 'practice').flatMap(t => t.qids);
  const plan = g('buildPlan')(goalFor(21, 60), TODAY);
  const early = plan.days.find(d => d.date === '2026-10-13');
  const earlyLog = logWith('2026-10-13', dayQids(early));
  const earlyFacts = readFacts([early]);
  const once = g('replanFrom')(clone(plan), goalFor(28, 60, [0]), '2026-10-09', earlyLog);
  const twice = g('replanFrom')(clone(once), goalFor(35, 90, [0, 6]), '2026-10-09', earlyLog);
  const again = readFacts(twice.days.slice(1)).filter(id => earlyFacts.includes(id));
  assert(earlyFacts.length > 0 && again.length === 0, `W-028: ${earlyFacts.length} facts finished early, re-planned twice → ${again.length} planned again`);
  assert(same(readFacts(twice.days.slice(1)), g('PLAN_LEARN_ORDER').filter(id => !earlyFacts.includes(id))), 'W-028: the rest are still planned once each');
  const full = g('buildPlan')(goalFor(21, 120), TODAY);
  const todayLog = logWith(TODAY, dayQids(full.days[0]));
  const doneToday = readFacts([full.days[0]]);
  const restToday = g('replanFrom')(clone(full), goalFor(21, 120, [4]), TODAY, todayLog);
  assert(restToday.days[0].phase === 'rest' && !readFacts(restToday.days).some(id => doneToday.includes(id)), 'W-028 setup: today turned into a rest day holds none of the facts done today');
  const back = g('replanFrom')(clone(restToday), goalFor(21, 120, [0]), TODAY, todayLog);
  const moved = readFacts(back.days.slice(1)).filter(id => doneToday.includes(id));
  assert(moved.length === 0, `W-028: ${doneToday.length} facts done today, today made a rest day and back → ${moved.length} planned again`);
  const all = readFacts(back.days);
  assert(doneToday.every(id => readFacts([back.days[0]]).includes(id)) && all.length === FACT_COUNT && new Set(all).size === FACT_COUNT, 'W-028: they are back on today, every fact once');
}

// W-029: a re-plan on a non-learn day pins only facts first finished today; facts learnt earlier stay where they were
function checkReplanOnDrillDay() {
  const readFacts = days => days.flatMap(d => d.tasks.filter(t => t.type === 'read').flatMap(t => t.facts));
  const plan = clone(g('buildPlan')(goalFor(21, 120), TODAY));
  const drillIdx = plan.days.findIndex(d => d.phase === 'drill');
  const today = plan.days[drillIdx].date;
  const ctx = { wrongKeys: ['4.14', '1.0'], streaks: {}, completedExams: {}, plan, log: emptyLog() };
  plan.days[drillIdx] = g('materializePlanDay')(plan.days[drillIdx], ctx).day;
  const okOn = d => [d.date, { ok: Object.fromEntries(d.tasks.flatMap(t => g('planTaskQids')(t)).map(k => [k, 1])), bad: {}, mock: [] }];
  const log = { v: 1, days: Object.fromEntries(plan.days.filter(d => d.phase === 'learn' || d.date === today).map(okOn)) };
  const before = g('planDayCompletion')(plan.days[drillIdx], g('planDayLog')(log, today)).pct;
  const re = g('replanFrom')(clone(plan), goalFor(21, 90), today, log);
  const all = readFacts(re.days);
  assert(before === 100 && all.length === FACT_COUNT && new Set(all).size === FACT_COUNT, `W-029: re-plan on a finished drill day keeps every fact exactly once (${all.length} reads)`);
  assert(!re.days[drillIdx].tasks.some(t => t.type === 'read'), 'W-029: facts learnt before today are not pinned on today');
  const after = g('planDayCompletion')(re.days[drillIdx], g('planDayLog')(log, today)).pct;
  assert(after >= before, `W-029: today's % does not drop (${before} → ${after})`);
}

// W-027: a past drill / wrong-facts task gets its contents when opened; carry and next step never point at an empty task
function checkPastDayContents() {
  const plan = g('buildPlan')(goalFor(42, 60, [0]), TODAY);
  const drillIdx = plan.days.findIndex(d => d.phase === 'drill');
  const drillDay = plan.days[drillIdx];
  const today = isoAddDays(drillDay.date, 1);
  const carry = g('planCarryTasks')(plan, emptyLog(), today);
  assert(!carry.some(c => !g('planIsMaterialized')(c.task)), 'W-027: carry never lists a task with no contents yet');
  const step = g('planNextStep')(plan, emptyLog(), drillDay.date);
  assert(step.kind === 'done' || g('planIsMaterialized')(plan.days[g('planDayIndex')(plan, step.date)].tasks[step.taskIndex]), 'W-027: next step never points at a task with no contents');
  const ctx = { wrongKeys: ['4.14'], streaks: {}, completedExams: {}, plan, log: emptyLog(), types: g('PLAN_PAST_TYPES') };
  const past = g('materializePlanDay')(drillDay, ctx).day;
  assert(past.tasks.every(t => g('planIsMaterialized')(t)) && past.tasks.some(t => t.type === 'drill' && t.qids.length > 0), 'W-027: a past drill day gets its questions');
  const learnPast = g('materializePlanDay')(plan.days[0], ctx);
  assert(!learnPast.changed && !('qids' in learnPast.day.tasks.find(t => t.type === 'review')), 'G24: a never-opened past review stays empty');
  const mockDay = plan.days.find(d => d.tasks.some(t => t.type === 'mock'));
  assert(!g('materializePlanDay')(mockDay, ctx).changed, 'a past mock is never filled (mocks are not carried)');
  const p2 = clone(plan);
  p2.days[drillIdx] = past;
  const carry2 = g('planCarryTasks')(p2, emptyLog(), today);
  assert(carry2.some(c => c.date === drillDay.date && c.task.type === 'drill'), 'W-027: once filled, the past drill is carried');
}

function checkEnsurePlanDay() {
  const plan = g('buildPlan')(goalFor(42, 60, [0]), TODAY);
  const mockIdx = plan.days.findIndex(d => d.phase === 'mock' && !d.light);
  const drills = plan.days.slice(0, mockIdx).filter(d => d.phase === 'drill');
  const at = days => { const d = new Date(2026, 9, 8, 10, 0); d.setDate(d.getDate() + days); return d.toISOString(); };
  // learn days finished on their own days, so the oldest unfinished carry task holding a question is a drill day
  const learnLog = { v: 1, days: Object.fromEntries(plan.days.filter(d => d.phase === 'learn').map(d =>
    [d.date, { ok: Object.fromEntries(d.tasks.flatMap(t => t.qids || []).map(k => [k, 1])), bad: {}, mock: [] }])) };
  const a = loadApp({ 'lifeuk.studyPlan': JSON.stringify(plan), 'lifeuk.wrongList': JSON.stringify({ '4.14': true }), 'lifeuk.studyPlanProgress': JSON.stringify(learnLog) });
  a.g(`this.AT = ${JSON.stringify(at(mockIdx))}; this.PAST = ${JSON.stringify(at(mockIdx - 1))};`);
  const writes = a.storage.writes;
  a.g(`ensurePlanDay(${JSON.stringify(isoAddDays(plan.days[mockIdx].date, 1))}, new Date(AT))`);
  assert(a.storage.writes === writes, 'ensurePlanDay on a future day writes nothing (G23)');
  a.g('ensurePlanToday(new Date(AT))');
  const stored = JSON.parse(a.storage.getItem('lifeuk.studyPlan'));
  const sd = date => stored.days.find(d => d.date === date);
  assert(drills.length > 0 && drills.every(d => sd(d.date).tasks.every(t => Array.isArray(t.qids) || Array.isArray(t.facts))), `W-027: ensurePlanToday fills the ${drills.length} past drill days (drill + wrong facts)`);
  assert(sd(plan.days[0].date).tasks.every(t => t.type !== 'review' || !('qids' in t)), 'G24: past reviews stay empty');
  assert(sd(plan.days[mockIdx].date).tasks.filter(t => t.type === 'mock').every(t => Number.isInteger(t.exam)), "today's mock slots get their exam");
  const todayQ = new Set(sd(plan.days[mockIdx].date).tasks.flatMap(t => t.qids || []));
  const firstDrill = drills.map(d => sd(d.date)).find(d => d.tasks.some(t => t.type === 'drill' && t.qids.some(k => !todayQ.has(k))));
  const qid = firstDrill.tasks.find(t => t.type === 'drill').qids.find(k => !todayQ.has(k));
  const want = drills.map(d => sd(d.date)).find(d => d.tasks.some(t => (t.qids || []).includes(qid))).date;
  assert(a.g(`recordPlanAnswer(${JSON.stringify(qid)}, true, null, new Date(AT))`) === want, 'W-027: answering a carried drill question counts for its day');
  // Wednesdays off: the light day is Tue 17 Nov, so Wed 18 (the day before the exam) can still carry it
  const wedOff = g('buildPlan')(goalFor(42, 60, [3]), TODAY);
  const light = wedOff.days.find(d => d.light);
  const b = loadApp({ 'lifeuk.studyPlan': JSON.stringify(wedOff), 'lifeuk.wrongList': JSON.stringify({ '4.14': true }) });
  b.g(`this.AT = ${JSON.stringify(at(wedOff.days.indexOf(light) + 1))}`);
  b.g(`ensurePlanDay(${JSON.stringify(light.date)}, new Date(AT))`);
  const lightStored = JSON.parse(b.storage.getItem('lifeuk.studyPlan')).days.find(d => d.light);
  assert(light.date < isoAddDays(wedOff.goal.examDate, -1) && Array.isArray(lightStored.tasks.find(t => t.type === 'wrongFacts').facts)
    && !('qids' in lightStored.tasks.find(t => t.type === 'review')), 'W-027: a past light day fills its wrong-facts task (its review stays empty, G24)');
}

// S-108: chapter / quota / slot / pair are checked too, so a bad value is "no plan" instead of a throw later
function checkParseTaskFields() {
  const plan = g('buildPlan')(goalFor(42, 60, [0]), TODAY);
  const drillIdx = plan.days.findIndex(d => d.phase === 'drill');
  const mockIdx = plan.days.findIndex(d => d.tasks.some(t => t.type === 'mock'));
  const withTask = (i, k, patch) => { const p = clone(plan); Object.assign(p.days[i].tasks[k], patch); return p; };
  const drillK = plan.days[drillIdx].tasks.findIndex(t => t.type === 'drill');
  const wfK = plan.days[drillIdx].tasks.findIndex(t => t.type === 'wrongFacts');
  const mockK = plan.days[mockIdx].tasks.findIndex(t => t.type === 'mock');
  const bad = [withTask(drillIdx, drillK, { ch: 9 }), withTask(drillIdx, drillK, { quota: -1 }), withTask(drillIdx, drillK, { quota: 1.5 }),
    withTask(drillIdx, wfK, { quota: 'x' }), withTask(mockIdx, mockK, { slot: 'x' }), withTask(mockIdx, mockK, { slot: -1 }),
    withTask(0, 0, { ch: 6 }), withTask(0, 0, { pair: 99 }), withTask(0, 1, { ch: undefined }), withTask(0, 1, { qids: [1] })];
  assert(bad.every(b => g('parseStoredPlan')(b) === null), `S-108: ${bad.length} plans with a bad ch / quota / slot / pair / qid parse to null`);
  const a = loadApp({ 'lifeuk.studyPlan': JSON.stringify(bad[0]) });
  const at = new Date(2026, 9, 8, 10, 0);
  at.setDate(at.getDate() + drillIdx);
  a.g('this.AT = ' + JSON.stringify(at.toISOString()));
  const writes = a.storage.writes;
  assert(a.g('ensurePlanToday(new Date(AT))') === null && a.storage.writes === writes, 'S-108: ensurePlanToday on a bad drill chapter returns no plan, no throw, no write');
}

function checkOverview() {
  const band = g('planPctBand');
  assert([[0, 0], [1, 1], [49, 1], [50, 2], [74, 2], [75, 3], [99, 3], [100, 4]].every(([p, b]) => band(p) === b), 'G27: 5 colour bands 0 / <50 / <75 / <100 / 100');
  const plan = g('buildPlan')(goalFor(42), TODAY);
  assert(same(g('planMonths')(plan), [{ year: 2026, month: 10 }, { year: 2026, month: 11 }]), 'calendar months from start to exam day');
  const year = g('buildPlan')(goalFor(100), TODAY);
  assert(g('planMonths')(year).length === 4 && g('planMonths')(year)[3].year === 2027, 'months run across the year end');
  const grid = g('planMonthGrid')(plan, emptyLog(), 2026, 10, '2026-10-10');
  assert(grid.lead === 4 && grid.cells.length === 31, 'October 2026 grid: Thursday start, 31 cells');
  const c = d => grid.cells[d - 1];
  assert(!c(7).inPlan && c(8).inPlan && c(8).past && c(10).today && !c(11).past && c(11).rest, 'cells know in plan / past / today / rest');
  const nov = g('planMonthGrid')(plan, emptyLog(), 2026, 11, '2026-10-10');
  assert(nov.cells[18].examDay && nov.cells[18].iso === plan.goal.examDate && !nov.cells[19].inPlan, 'the exam day is marked; days after are out of the plan');
  assert(c(8).pct === 0 && c(12).pct === null, 'past days have a %, future days none');
  const k = g('planKpis')(plan, logWith('2026-10-08', ['1.0']), '2026-10-10');
  assert(k.factsTotal === FACT_COUNT && k.qidsTotal === CANON_COUNT && k.qidsDone === 1 && k.dayNumber === 3 && k.totalDays === 42 && k.daysLeft === 40, 'KPIs: totals 236 / 389, Day 3 / 42, 40 days left');
  assert(k.mocksPlanned === tasksOf(plan, 'mock').length && k.safeMocks === 0, 'KPIs count planned mocks');
}

function checkStreak() {
  const plan = clone(g('buildPlan')(goalFor(21), TODAY)); // Thu 8 … Sun 11 rest
  const full = iso => plan.days.find(d => d.date === iso).tasks.flatMap(t => g('planTaskQids')(t));
  plan.days.forEach(d => d.tasks.forEach(t => { if (t.type === 'review') t.qids = []; }));
  const merge = (...isos) => ({ v: 1, days: Object.fromEntries(isos.map(iso => [iso, { ok: Object.fromEntries(full(iso).map(k => [k, 1])), bad: {}, mock: [] }])) });
  const s = (log, on) => g('planStreakDays')(plan, log, on);
  assert(s(merge('2026-10-08', '2026-10-09', '2026-10-10'), '2026-10-12') === 3, 'G29: a rest day does not break the streak; today not done yet does not either');
  assert(s(merge('2026-10-08', '2026-10-10'), '2026-10-12') === 1, 'a day under 100% resets it');
  assert(s(merge('2026-10-08', '2026-10-09', '2026-10-10', '2026-10-12'), '2026-10-12') === 4 && s(emptyLog(), '2026-10-12') === 0, 'today counts once it is 100%; 0 when none');
}

function checkService() {
  const empty = loadApp({ 'other.app': '1' });
  const before = empty.storage.dump();
  const writes = empty.storage.writes;
  empty.g("recordPlanAnswer('1.0', true)");
  empty.g("recordPlanMock({ examNum: 1, correct: 20, total: 24, isRealTest: true })");
  empty.g('ensurePlanToday()');
  assert(empty.storage.writes === writes && same(empty.storage.dump(), before), 'R3: with no plan nothing is written');
  const plan = g('buildPlan')(goalFor(21), TODAY);
  const now = new Date(2026, 9, 8, 10, 0);
  const a = loadApp({ 'lifeuk.studyPlan': JSON.stringify(plan) });
  a.g('this.NOW = ' + JSON.stringify(now.toISOString()));
  const qid = plan.days[0].tasks.find(t => t.type === 'practice').qids[0];
  assert(a.g(`recordPlanAnswer(${JSON.stringify(qid)}, true, null, new Date(NOW))`) === TODAY, 'recordPlanAnswer returns the day it wrote');
  const log1 = JSON.parse(a.storage.getItem('lifeuk.studyPlanProgress'));
  assert(log1.days[TODAY].ok[qid] === 1, "a right answer to today's task lands in today's log");
  const tab2 = clone(log1);
  tab2.days[TODAY].ok.other = 1;
  a.storage.setItem('lifeuk.studyPlanProgress', JSON.stringify(tab2));
  a.g(`recordPlanAnswer(${JSON.stringify(plan.days[0].tasks.find(t => t.type === 'practice').qids[1])}, false, null, new Date(NOW))`);
  const log2 = JSON.parse(a.storage.getItem('lifeuk.studyPlanProgress'));
  assert(log2.days[TODAY].ok.other === 1 && Object.keys(log2.days[TODAY].bad).length === 1, 'R17: read-modify-write keeps what another tab wrote');
  checkServiceDuplicateKey(plan, now);
  checkServiceCorrupt(plan, now);
  checkServiceMockAndEnsure(now);
}

function checkServiceDuplicateKey(plan, now) {
  const day = plan.days.findIndex(d => d.tasks.some(t => (t.qids || []).includes('3.12')));
  const on = plan.days[day].date;
  const a = loadApp({ 'lifeuk.studyPlan': JSON.stringify(plan) });
  const at = new Date(now.getTime());
  at.setDate(at.getDate() + day);
  a.g('this.AT = ' + JSON.stringify(at.toISOString()));
  a.g("recordPlanAnswer('4.14', true, null, new Date(AT))");
  const log = JSON.parse(a.storage.getItem('lifeuk.studyPlanProgress'));
  assert(log.days[on].ok['3.12'] === 1 && !log.days[on].ok['4.14'], 'G4: the same English question in another exam counts as its canonical key');
}

function checkServiceCorrupt(plan, now) {
  const a = loadApp({ 'lifeuk.studyPlan': JSON.stringify(plan), 'lifeuk.studyPlanProgress': '{bad json' });
  a.g('this.NOW = ' + JSON.stringify(now.toISOString()));
  const qid = plan.days[0].tasks.find(t => t.type === 'practice').qids[0];
  assert(a.g(`recordPlanAnswer(${JSON.stringify(qid)}, true, null, new Date(NOW))`) === null && a.storage.getItem('lifeuk.studyPlanProgress') === '{bad json', 'a corrupt log is never overwritten');
  const b = loadApp({ 'lifeuk.studyPlan': '{"v":1,"days":5}' });
  b.g('this.NOW = ' + JSON.stringify(now.toISOString()));
  b.g(`recordPlanAnswer(${JSON.stringify(qid)}, true, null, new Date(NOW))`);
  b.g('ensurePlanToday(new Date(NOW))');
  assert(b.storage.getItem('lifeuk.studyPlan') === '{"v":1,"days":5}' && b.storage.getItem('lifeuk.studyPlanProgress') === null, 'a corrupt plan counts as no plan and is left as it is');
}

function checkServiceMockAndEnsure(now) {
  const plan = g('buildPlan')(goalFor(21), TODAY);
  const mockIdx = plan.days.findIndex(d => d.tasks.some(t => t.type === 'mock'));
  const at = new Date(now.getTime());
  at.setDate(at.getDate() + mockIdx);
  const a = loadApp({ 'lifeuk.studyPlan': JSON.stringify(plan), 'lifeuk.wrongList': JSON.stringify({ '4.14': true, '1.0': true }) });
  a.g('this.AT = ' + JSON.stringify(at.toISOString()));
  a.g("recordPlanMock({ examNum: 'all', correct: 20, total: 24, isRealTest: false }, null, new Date(AT))");
  assert(a.storage.getItem('lifeuk.studyPlanProgress') === null, 'a Practice-mode set is not a mock attempt');
  a.g("recordPlanMock({ examNum: 4, correct: 20, total: 24, isRealTest: true }, null, new Date(AT))");
  const log = JSON.parse(a.storage.getItem('lifeuk.studyPlanProgress'));
  assert(same(log.days[plan.days[mockIdx].date].mock, [{ exam: 4, correct: 20, total: 24 }]), 'an exam on a mock day is recorded as an attempt');
  const b = loadApp({ 'lifeuk.studyPlan': JSON.stringify(plan), 'lifeuk.wrongList': JSON.stringify({ '4.14': true, '1.0': true }) });
  b.g('this.NOW = ' + JSON.stringify(now.toISOString()));
  b.g('ensurePlanToday(new Date(NOW))');
  const stored = JSON.parse(b.storage.getItem('lifeuk.studyPlan'));
  assert(same(stored.days[0].tasks.find(t => t.type === 'review').qids, ['3.12', '1.0']), "ensurePlanToday snapshots today's wrong list (G9)");
  assert(!stored.days[1].tasks.find(t => t.type === 'review').qids, 'other days stay unopened');
  const writes = b.storage.writes;
  b.g("addWrong({ examNum: 2, origIdx: 0 })");
  b.g('ensurePlanToday(new Date(NOW))');
  assert(b.storage.writes === writes + 1 && JSON.parse(b.storage.getItem('lifeuk.studyPlan')).days[0].tasks.find(t => t.type === 'review').qids.length === 2, 'a second open writes nothing; new mistakes wait for tomorrow');
}

function checkStorageBudget() {
  const plan = clone(g('buildPlan')({ ...goalFor(21, 120, []), examDate: g('planExamDateRange')(TODAY).max }, TODAY));
  const keys = g('allQuestions')().map(({ examNum, origIdx }) => g('planCanonKey')(`${examNum}.${origIdx}`));
  plan.days.forEach(d => d.tasks.forEach(t => {
    if (t.type === 'review' || t.type === 'drill') t.qids = keys.slice(0, 24);
    if (t.type === 'wrongFacts') { t.facts = STUDY.slice(0, t.quota).map(f => f.id); t.anchor = Object.fromEntries(t.facts.map(id => [id, '10.10'])); }
    if (t.type === 'mock') t.exam = 17;
  }));
  const log = { v: 1, days: {} };
  plan.days.forEach((d, i) => {
    const day = keys.slice(i % 200, (i % 200) + 120);
    log.days[d.date] = { ok: Object.fromEntries(day.slice(0, 100).map(k => [k, 1])), bad: Object.fromEntries(day.slice(100).map(k => [k, 1])), mock: [{ exam: 17, correct: 20, total: 24 }] };
  });
  const bytes = JSON.stringify(plan).length + JSON.stringify(log).length;
  assert(plan.days.length >= 181 && bytes < STORAGE_BUDGET_BYTES && g('PLAN_STORAGE_BUDGET_BYTES') === STORAGE_BUDGET_BYTES, `worst case ${plan.days.length} days × 120 answers = ${bytes} bytes < ${STORAGE_BUDGET_BYTES} (arch §B.5)`);
}

function checkNamesAndLoading() {
  const topNames = src => [...src.matchAll(/^(?:async\s+)?(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*))/gm)].map(m => m[1] || m[2]);
  const planNames = PLAN_FILES.flatMap(f => topNames(fs.readFileSync(path.join(ROOT, f), 'utf8')));
  const bad = planNames.filter(n => !/plan/i.test(n) && !/^(iso|ISO_)/.test(n));
  assert(bad.length === 0, 'R2: every top-level name in plan*.js carries plan / PLAN_ / iso' + (bad.length ? ': ' + bad.join(', ') : ''));
  const others = [];
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).forEach(d => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) walk(p);
    else if (d.name.endsWith('.js') && !PLAN_FILES.includes(path.relative(ROOT, p))) others.push(...topNames(fs.readFileSync(p, 'utf8')));
  });
  walk(path.join(ROOT, 'js'));
  const clash = planNames.filter(n => others.includes(n));
  assert(clash.length === 0 && new Set(planNames).size === planNames.length, 'plan names clash with no other js global' + (clash.length ? ': ' + clash.join(', ') : ''));
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const at = src => html.indexOf(`<script src="${src}"></script>`);
  assert(at('js/domain/similar.js') < at('js/domain/plan.js') && at('js/domain/plan.js') < at('js/domain/planProgress.js') && at('js/domain/planProgress.js') < at('js/components/icons.js'), 'index.html loads similar → plan → planProgress → components');
  const main = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
  const lb = main.slice(main.indexOf('LATE_BOOT_SCRIPTS'), main.indexOf('];', main.indexOf('LATE_BOOT_SCRIPTS')));
  assert(lb.indexOf("'js/domain/plan.js'") > 0 && lb.indexOf("'js/domain/plan.js'") < lb.indexOf("'js/domain/planProgress.js'"), 'R1: LATE_BOOT_SCRIPTS loads plan.js then planProgress.js for old shells');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  assert(PLAN_FILES.every(f => sw.includes(`'${f}'`)), 'sw.js SHELL caches both plan files');
  // G19 (no version bump in a middle PR) is a review rule: unrelated PRs may bump APP_VERSION (CUI-0018)
  assert(/^\d+\.\d+\.\d+$/.test(g('APP_VERSION')), 'APP_VERSION is MAJOR.MINOR.PATCH (SemVer)');
}

function runSuite() {
  checkConfigAndStore();
  checkHeadlineNumbers();
  checkDates();
  checkValidation();
  checkFeasibility();
  checkChunkAndSplit();
  checkBuildPlan();
  checkParse();
  checkProgress();
  checkStatusAndCarry();
  checkAttribution();
  checkRounds();
  checkMaterialize();
  checkReplan();
  checkReplanKeepsDoneFacts();
  checkReplanTwice();
  checkReplanOnDrillDay();
  checkPastDayContents();
  checkEnsurePlanDay();
  checkParseTaskFields();
  checkOverview();
  checkStreak();
  checkService();
  checkStorageBudget();
  checkNamesAndLoading();
}

function runTimeZones() {
  TZ_VARIANTS.forEach(tz => {
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, TZ: tz, PLAN_TEST_CHILD: '1' }, encoding: 'utf8' });
    const last = (r.stdout || '').trim().split('\n').pop();
    if (r.status !== 0) throw new Error(`FAIL: TZ=${tz}: ${(r.stderr || '').trim().split('\n')[0]}`);
    assert(/^TZ PASS \d+$/.test(last) && Number(last.split(' ')[2]) === asserts - TZ_VARIANTS.indexOf(tz), `whole suite passes under TZ=${tz} (${last.split(' ')[2]} checks)`);
  });
}

try {
  runSuite();
  if (IS_CHILD) {
    console.log(`TZ PASS ${asserts}`);
  } else {
    runTimeZones();
    console.log(`PLAN PASS (${asserts} checks)`);
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
