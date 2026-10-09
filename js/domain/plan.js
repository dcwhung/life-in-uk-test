// ════════════════════════════════════════
// STUDY PLAN — pure schedule functions: ISO dates, canonical questions, feasibility, goal validation, buildPlan.
// Never reads the clock (today is always a parameter; planTodayIso is the one clock reader, called by
// screens / the service), state, streaks, wrongList or the DOM. Shapes: arch §B.3. Every top-level name carries
// plan / PLAN_ / iso: classic scripts share one global scope (S-036).
// ════════════════════════════════════════

// ── tuning (G12: estimates kept as constants, adjusted after real use) ──
const PLAN_STUDY_ORDER = [1, 2, 5, 4, 3]; // easy → hard; History (Ch 3: dates, names) last so it is freshest on exam day
// minutes per fact read / per question practised, and the share of study days given to mocks
const PLAN_LEVELS = {
  none: { minPerFact: 1.5, minPerQ: 0.75, mockShare: 0.2 },
  some: { minPerFact: 1.0, minPerQ: 0.6, mockShare: 0.3 },
  exam: { minPerFact: 0.8, minPerQ: 0.5, mockShare: 0.4 },
};
const PLAN_SECOND_PASS_RATIO = 0.4; // share of questions re-done in the drill phase
const PLAN_MIN_MOCK_DAYS = 1; // G13: even a plan that is short of time keeps one mock day
const PLAN_MOCK_REVIEW_MINS = 15;
const PLAN_MOCK_BLOCK_MINS = EXAM_MINUTES + PLAN_MOCK_REVIEW_MINS;
const PLAN_MIN_MOCKS = 5; // mocks the time estimate allows for
const PLAN_MAX_MOCKS_PER_DAY = 2;
const PLAN_REVIEW_SLOT_MINS = 15; // a learn day's wrong-answer slot, taken off its reading / practice time
const PLAN_WRONG_FACTS_QUOTA = 10; // facts in a "review the facts of wrong answers" task
const PLAN_FEAS_OK = 1.15; // available / needed time at or above this: plenty
const PLAN_FEAS_TIGHT = 0.95; // …at or above this: just enough; below: short
const PLAN_MINS = { min: 30, max: 120, step: 15 };
const PLAN_EXAM_DAY_PRESETS = [14, 21, 28, 42];
const PLAN_MIN_DAYS = 7; // earliest exam date = today + 7
const PLAN_MAX_MONTHS = 6; // latest exam date = today + 6 months
const PLAN_MIN_STUDY_DAYS = 7; // G28
// G36: changing a running plan's goal (e.g. in the exam's last week) may move the exam up to tomorrow and leave
// a single study day; a new plan keeps the limits above
const PLAN_EDIT_MIN_DAYS_AHEAD = 1;
const PLAN_EDIT_MIN_STUDY_DAYS = 1;
const PLAN_SAFE_SCORE = 21; // "mock ≥ 21 / 24" progress bar
const PLAN_SCHEMA_VERSION = 1;
const PLAN_STORAGE_BUDGET_BYTES = 300000; // plan + log, worst case (arch §B.5; tests/plan-test.js)
const PLAN_WEEK_DAYS = 7;

const PLAN_PHASE = { learn: 'learn', drill: 'drill', mock: 'mock', rest: 'rest' };
const PLAN_TASK = { read: 'read', practice: 'practice', drill: 'drill', wrongFacts: 'wrongFacts', review: 'review', mock: 'mock' };
const PLAN_FEAS = { ok: 'ok', tight: 'tight', short: 'short' };
const PLAN_GOAL_MODE = { create: 'create', edit: 'edit' };
const PLAN_GOAL_LIMITS = {
  create: { minDaysAhead: PLAN_MIN_DAYS, minStudyDays: PLAN_MIN_STUDY_DAYS },
  edit: { minDaysAhead: PLAN_EDIT_MIN_DAYS_AHEAD, minStudyDays: PLAN_EDIT_MIN_STUDY_DAYS },
};
const PLAN_GOAL_ERROR = { examDate: 'examDate', dailyMins: 'dailyMins', restDays: 'restDays', level: 'level', studyDays: 'studyDays' };

// ── ISO dates ('YYYY-MM-DD', the device's local calendar date) ──
// Day arithmetic runs on UTC day numbers, so DST changes and the device time zone never shift a date.
const ISO_MS_PER_DAY = 86400000;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATE_LENGTH = 10;
const ISO_MONTHS_PER_YEAR = 12;

function isoParts(iso) { return iso.split('-').map(Number); }
function isoDayNumber(iso) {
  const [y, m, d] = isoParts(iso);
  return Date.UTC(y, m - 1, d) / ISO_MS_PER_DAY;
}
function isoFromDayNumber(n) { return new Date(n * ISO_MS_PER_DAY).toISOString().slice(0, ISO_DATE_LENGTH); }
function isoAddDays(iso, n) { return isoFromDayNumber(isoDayNumber(iso) + n); }
function isoDiffDays(fromIso, toIso) { return isoDayNumber(toIso) - isoDayNumber(fromIso); }
function isoWeekday(iso) { return new Date(isoDayNumber(iso) * ISO_MS_PER_DAY).getUTCDay(); }
function isoIsValid(s) {
  return typeof s === 'string' && ISO_DATE_RE.test(s) && isoFromDayNumber(isoDayNumber(s)) === s;
}
function isoDaysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
// same day n months later, clamped to the month end (31 Aug + 6 → 28 / 29 Feb)
function isoAddMonths(iso, n) {
  const [y, m, d] = isoParts(iso);
  const index = m - 1 + n;
  const year = y + Math.floor(index / ISO_MONTHS_PER_YEAR);
  const month = (index % ISO_MONTHS_PER_YEAR + ISO_MONTHS_PER_YEAR) % ISO_MONTHS_PER_YEAR + 1;
  return `${year}-${pad2(month)}-${pad2(Math.min(d, isoDaysInMonth(year, month)))}`;
}
// the only function that reads the clock: the local date now (G6)
function planTodayIso(now = new Date()) {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}
// mode: PLAN_GOAL_MODE; anything else is a new plan (the stricter limits)
function planGoalLimits(mode = PLAN_GOAL_MODE.create) {
  return mode === PLAN_GOAL_MODE.edit ? PLAN_GOAL_LIMITS.edit : PLAN_GOAL_LIMITS.create;
}
function planExamDateRange(todayIso, mode = PLAN_GOAL_MODE.create) {
  return { min: isoAddDays(todayIso, planGoalLimits(mode).minDaysAhead), max: isoAddMonths(todayIso, PLAN_MAX_MONTHS) };
}

// ── canonical questions (G4): the same English question in several exams is one question ──
// the shared copies map (js/domain/questions.js): "exam.idx" → first "exam.idx" (exam order) with the same text
const PLAN_CANON_QKEY = QUESTION_COPIES.canon;
const planCanonKey = canonQuestionKey; // plan name kept: planProgress.js and the plan tests use it (S-142)
function planUnique(list) { return [...new Set(list)]; }
// a fact's questions as canonical keys (a repeated question never crosses facts: plan-test checks it)
function planFactQids(f) { return planUnique(f.src.map(planCanonKey)); }
const PLAN_FACT_BY_ID = Object.fromEntries(STUDY.map(f => [f.id, f]));
function planFactById(id) { return PLAN_FACT_BY_ID[id]; }
function planIsLevel(level) { return Object.prototype.hasOwnProperty.call(PLAN_LEVELS, level); }
const PLAN_TOTAL_QIDS = new Set(Object.values(PLAN_CANON_QKEY)).size;
// fact ids in learn order: chapters by PLAN_STUDY_ORDER, Study card order inside a chapter
const PLAN_LEARN_ORDER = PLAN_STUDY_ORDER.flatMap(ch => STUDY.filter(f => f.ch === ch).map(f => f.id));
// chapter → its canonical questions, in learn order
const PLAN_CHAPTER_QIDS = Object.fromEntries(PLAN_STUDY_ORDER.map(ch =>
  [ch, STUDY.filter(f => f.ch === ch).flatMap(planFactQids)]));

// ── schedule ──
function planCalendar(startIso, examIso, restDays) {
  return Array.from({ length: Math.max(0, isoDiffDays(startIso, examIso)) }, (_, i) => {
    const date = isoAddDays(startIso, i);
    return { date, rest: restDays.includes(isoWeekday(date)) };
  });
}
// one item per fact still to learn, weighted by its reading time plus its own questions (G1: the real src)
function planLearnItems(level, factIds = PLAN_LEARN_ORDER) {
  const lv = PLAN_LEVELS[level];
  return factIds.map(planFactById).map(f => ({ ch: f.ch, id: f.id, w: lv.minPerFact + planFactQids(f).length * lv.minPerQ }));
}
function planLearnMinutes(level, factIds = PLAN_LEARN_ORDER) {
  return planLearnItems(level, factIds).reduce((s, it) => s + it.w, 0);
}
// one item per question re-done in the drill phase, by chapter
function planDrillItems(level) {
  const w = PLAN_LEVELS[level].minPerQ;
  return PLAN_STUDY_ORDER.flatMap(ch => {
    const n = Math.max(1, Math.round(PLAN_CHAPTER_QIDS[ch].length * PLAN_SECOND_PASS_RATIO));
    return Array.from({ length: n }, (_, i) => ({ ch, id: i + 1, w }));
  });
}
// factIds: the facts still to learn (W-035: a changed goal only re-plans these); drill + mocks stay whole-syllabus
function planNeedMinutes(level, factIds = PLAN_LEARN_ORDER) {
  const drill = PLAN_TOTAL_QIDS * PLAN_SECOND_PASS_RATIO * PLAN_LEVELS[level].minPerQ;
  return Math.round(planLearnMinutes(level, factIds) + drill + PLAN_MIN_MOCKS * PLAN_MOCK_BLOCK_MINS);
}

// split ordered weighted items into dayCount chunks of about equal weight, never leaving a day empty while items
// remain; consecutive items of one chapter form one { ch, ids } group
function planChunkWeighted(items, dayCount) {
  const days = Array.from({ length: dayCount }, () => []);
  let d = 0, dayW = 0, left = items.reduce((s, it) => s + it.w, 0);
  let budget = left / dayCount;
  items.forEach((it, i) => {
    const mustMove = items.length - i <= dayCount - 1 - d;
    if (dayW > 0 && d < dayCount - 1 && (dayW >= budget || mustMove)) {
      d++;
      dayW = 0;
      budget = left / (dayCount - d);
    }
    const groups = days[d];
    const last = groups[groups.length - 1];
    if (last && last.ch === it.ch) last.ids.push(it.id); else groups.push({ ch: it.ch, ids: [it.id] });
    dayW += it.w;
    left -= it.w;
  });
  return days;
}

// G13: learn days first fit all the reading / practice (overload when even all-but-one day is not enough); mock days
// take their share of what is left (at least one), drill days the rest. G36: with a single day it learns (no mock)
function planSplitStudyDays(n, goal, learnMins) {
  if (n <= 0) return { learn: 0, drill: 0, mock: 0, overload: learnMins > 0 };
  const lv = PLAN_LEVELS[goal.level];
  const perDay = Math.max(1, goal.dailyMins - PLAN_REVIEW_SLOT_MINS);
  const fit = Math.ceil(learnMins / perDay);
  const mockRoom = n > PLAN_MIN_MOCK_DAYS ? PLAN_MIN_MOCK_DAYS : 0;
  const learn = learnMins > 0 ? Math.max(1, Math.min(fit, n - mockRoom)) : 0;
  const rest = n - learn;
  const mock = Math.min(rest, Math.max(PLAN_MIN_MOCK_DAYS, Math.round(n * lv.mockShare)));
  return { learn, drill: rest - mock, mock, overload: fit > learn };
}
// all study days: the last is the light review, except when it is the only one and facts are left (G36: a changed
// goal may leave one day; learning what is left comes first, G13)
function planStudySplit(studyCount, goal, learnMins) {
  const light = studyCount > 1 || (studyCount === 1 && learnMins === 0);
  return { light, ...planSplitStudyDays(studyCount - (light ? 1 : 0), goal, learnMins) };
}

function planFeasStatus(ratio) {
  if (ratio >= PLAN_FEAS_OK) return PLAN_FEAS.ok;
  return ratio >= PLAN_FEAS_TIGHT ? PLAN_FEAS.tight : PLAN_FEAS.short;
}
// factIds as planNeedMinutes: a new plan learns everything, a changed goal what planFactsLeft leaves
function planFeasibility(goal, todayIso, factIds = PLAN_LEARN_ORDER) {
  const cal = planCalendar(todayIso, goal.examDate, goal.restDays);
  const studyDays = cal.filter(d => !d.rest).length;
  const availMins = studyDays * goal.dailyMins;
  const needMins = planNeedMinutes(goal.level, factIds);
  const ratio = needMins ? availMins / needMins : 0;
  const split = planStudySplit(studyDays, goal, planLearnMinutes(goal.level, factIds));
  return {
    studyDays, restCount: cal.length - studyDays, availMins, needMins, ratio,
    status: planFeasStatus(ratio), diffMins: availMins - needMins, overload: split.overload,
  };
}

// ── goal validation ──
function planValidMins(m) {
  return Number.isInteger(m) && m >= PLAN_MINS.min && m <= PLAN_MINS.max && (m - PLAN_MINS.min) % PLAN_MINS.step === 0;
}
function planValidRestDays(r) {
  return Array.isArray(r) && r.every(d => Number.isInteger(d) && d >= 0 && d < PLAN_WEEK_DAYS)
    && new Set(r).size === r.length && r.length < PLAN_WEEK_DAYS;
}
function planValidExamDate(examIso, todayIso, mode) {
  const range = planExamDateRange(todayIso, mode);
  return isoIsValid(examIso) && examIso >= range.min && examIso <= range.max;
}
// mode: PLAN_GOAL_MODE.create (default; G28) or .edit (changing a running plan's goal; G36)
function validatePlanGoal(goal, todayIso, mode = PLAN_GOAL_MODE.create) {
  if (!goal || typeof goal !== 'object') return { ok: false, errors: Object.values(PLAN_GOAL_ERROR) };
  const errors = [];
  if (!planValidExamDate(goal.examDate, todayIso, mode)) errors.push(PLAN_GOAL_ERROR.examDate);
  if (!planValidMins(goal.dailyMins)) errors.push(PLAN_GOAL_ERROR.dailyMins);
  if (!planValidRestDays(goal.restDays)) errors.push(PLAN_GOAL_ERROR.restDays);
  if (!planIsLevel(goal.level)) errors.push(PLAN_GOAL_ERROR.level);
  const datesOk = !errors.includes(PLAN_GOAL_ERROR.examDate) && Array.isArray(goal.restDays);
  const studyCount = datesOk ? planCalendar(todayIso, goal.examDate, goal.restDays).filter(d => !d.rest).length : 0;
  if (datesOk && studyCount < planGoalLimits(mode).minStudyDays) {
    errors.push(PLAN_GOAL_ERROR.studyDays);
  }
  return { ok: errors.length === 0, errors };
}

// ── tasks per phase (contents of review / drill / wrongFacts / mock are picked on the day: G9, arch §B.1 5) ──
function planLearnTasks(groups) {
  const tasks = [];
  groups.forEach(gr => {
    const qids = gr.ids.flatMap(id => planFactQids(planFactById(id)));
    tasks.push({ type: PLAN_TASK.read, ch: gr.ch, facts: gr.ids, pair: tasks.length + 1 });
    tasks.push({ type: PLAN_TASK.practice, ch: gr.ch, qids });
  });
  tasks.push({ type: PLAN_TASK.review });
  return tasks;
}
function planDrillTasks(groups) {
  const tasks = groups.map(gr => ({ type: PLAN_TASK.drill, ch: gr.ch, quota: gr.ids.length }));
  tasks.push({ type: PLAN_TASK.wrongFacts, quota: PLAN_WRONG_FACTS_QUOTA });
  return tasks;
}
function planMockTasks(dailyMins) {
  const perDay = Math.max(1, Math.min(PLAN_MAX_MOCKS_PER_DAY, Math.floor(dailyMins / PLAN_MOCK_BLOCK_MINS)));
  const tasks = Array.from({ length: perDay }, (_, slot) => ({ type: PLAN_TASK.mock, slot }));
  tasks.push({ type: PLAN_TASK.review });
  return tasks;
}
// the last study day: an easy review, no new mock
function planLightTasks() {
  return [{ type: PLAN_TASK.review }, { type: PLAN_TASK.wrongFacts, quota: PLAN_WRONG_FACTS_QUOTA }];
}

// fromIso … examDate - 1: learn the given facts, then drill, then mock (shared by buildPlan and replanFrom)
function buildPlanDays(fromIso, goal, factIds = PLAN_LEARN_ORDER) {
  const cal = planCalendar(fromIso, goal.examDate, goal.restDays);
  // studyDays, not study: that name is the Study screen's global (structure-test plan layer guard)
  const studyDays = cal.filter(d => !d.rest);
  const split = planStudySplit(studyDays.length, goal, planLearnMinutes(goal.level, factIds));
  const learn = split.learn ? planChunkWeighted(planLearnItems(goal.level, factIds), split.learn) : [];
  const drill = split.drill ? planChunkWeighted(planDrillItems(goal.level), split.drill) : [];
  const light = split.light ? studyDays[studyDays.length - 1] : null;
  let s = 0;
  return cal.map(({ date, rest }) => {
    if (rest) return { date, phase: PLAN_PHASE.rest, tasks: [] };
    if (light && date === light.date) return { date, phase: PLAN_PHASE.mock, light: true, tasks: planLightTasks() };
    const i = s++;
    if (i < split.learn) return { date, phase: PLAN_PHASE.learn, tasks: planLearnTasks(learn[i]) };
    if (i < split.learn + split.drill) return { date, phase: PLAN_PHASE.drill, tasks: planDrillTasks(drill[i - split.learn]) };
    return { date, phase: PLAN_PHASE.mock, tasks: planMockTasks(goal.dailyMins) };
  });
}
function planCopyGoal(goal) {
  return { examDate: goal.examDate, dailyMins: goal.dailyMins, restDays: [...goal.restDays], level: goal.level };
}
// a new plan starting today (Day 1, G6); null for an invalid goal. mode as validatePlanGoal (replanFrom: edit)
function buildPlan(goal, todayIso, mode = PLAN_GOAL_MODE.create) {
  if (!validatePlanGoal(goal, todayIso, mode).ok) return null;
  const own = planCopyGoal(goal);
  return {
    v: PLAN_SCHEMA_VERSION, start: todayIso, createdAt: todayIso, goal: own, goalHistory: [],
    days: buildPlanDays(todayIso, own),
  };
}

// v1.0.4: one value per plan and goal: a new plan (created that day) or a changed goal (goalHistory grows) gives a new
// one, so the schedule's first open after either shows its cards expanded
function planIdentity(plan) { return `${plan.createdAt}#${(plan.goalHistory || []).length}`; }

// ── stored plan shape check: anything off → null (treated as no plan, never overwritten; arch §B.6) ──
function planIsObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function planValidGoalShape(goal) {
  return planIsObject(goal) && isoIsValid(goal.examDate) && planValidMins(goal.dailyMins)
    && planValidRestDays(goal.restDays) && planIsLevel(goal.level);
}
// S-108: every field a later step reads is checked here, so bad data is "no plan" rather than a throw later
// (a fact the data no longer has after a content change included)
function planIsCount(n) { return Number.isInteger(n) && n >= 0; }
function planValidList(list, isItem) { return list === undefined || (Array.isArray(list) && list.every(isItem)); }
function planValidTaskFields(t, dayTasks) {
  const needsCh = [PLAN_TASK.read, PLAN_TASK.practice, PLAN_TASK.drill].includes(t.type);
  if (needsCh && !PLAN_STUDY_ORDER.includes(t.ch)) return false;
  if ((t.type === PLAN_TASK.drill || t.type === PLAN_TASK.wrongFacts) && !planIsCount(t.quota)) return false;
  if (t.type === PLAN_TASK.mock && !planIsCount(t.slot)) return false;
  if (t.type === PLAN_TASK.read && !(planIsCount(t.pair) && dayTasks[t.pair] && dayTasks[t.pair].type === PLAN_TASK.practice)) return false;
  if (t.type === PLAN_TASK.read && !Array.isArray(t.facts)) return false;
  return t.type !== PLAN_TASK.practice || Array.isArray(t.qids);
}
function planValidTask(t, dayTasks) {
  return planIsObject(t) && Object.values(PLAN_TASK).includes(t.type) && planValidTaskFields(t, dayTasks)
    && planValidList(t.facts, id => !!PLAN_FACT_BY_ID[id]) && planValidList(t.qids, k => typeof k === 'string');
}
function planValidDay(day, i, start) {
  return planIsObject(day) && day.date === isoAddDays(start, i) && Object.values(PLAN_PHASE).includes(day.phase)
    && Array.isArray(day.tasks) && day.tasks.every(t => planValidTask(t, day.tasks));
}
function parseStoredPlan(raw) {
  if (!planIsObject(raw) || raw.v !== PLAN_SCHEMA_VERSION || !isoIsValid(raw.start)) return null;
  if (!planValidGoalShape(raw.goal) || !Array.isArray(raw.days) || !Array.isArray(raw.goalHistory || [])) return null;
  if (raw.days.length !== isoDiffDays(raw.start, raw.goal.examDate) || ('carryFrom' in raw && !isoIsValid(raw.carryFrom))) return null;
  return raw.days.every((d, i) => planValidDay(d, i, raw.start)) ? raw : null;
}
