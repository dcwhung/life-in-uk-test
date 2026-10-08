// ════════════════════════════════════════
// STUDY PLAN PROGRESS — completion = a day's tasks ∩ that day's answer log (arch §B.1): status, lazy task contents,
// carry-over, answer attribution, round queue, overview numbers, re-planning; then a small service section that
// reads / writes the store. Pure functions take today as an ISO parameter; only the service reads the clock.
// ════════════════════════════════════════
const PLAN_STATUS = { active: 'active', examDay: 'examDay', ended: 'ended' };
const PLAN_NEXT = { today: 'today', carry: 'carry', done: 'done' };
const PLAN_LOG_OK = 'ok'; // a log day's map of questions answered right that day
const PLAN_LOG_BAD = 'bad'; // …and of questions answered wrong that day
const PLAN_PCT_BAND_FROM = [1, 50, 75, PERCENT]; // G27: colour band n starts at the n-th value (0 = nothing done)

// ── position / status ──
function planDayIndex(plan, iso) { return isoDiffDays(plan.start, iso); }
function planDayNumber(plan, iso) { return planDayIndex(plan, iso) + 1; }
function planDayAt(plan, iso) {
  const i = planDayIndex(plan, iso);
  return i >= 0 && i < plan.days.length ? plan.days[i] : null;
}
// G16: no tasks on the exam day, the plan has ended after it
function planStatus(plan, todayIso) {
  if (todayIso < plan.goal.examDate) return PLAN_STATUS.active;
  return todayIso === plan.goal.examDate ? PLAN_STATUS.examDay : PLAN_STATUS.ended;
}

// ── answer log { v, days: { iso: { ok, bad, mock } } } ──
function planEmptyLog() { return { v: PLAN_SCHEMA_VERSION, days: {} }; }
function planDayLog(log, iso) {
  const d = (log && log.days[iso]) || {};
  return { ok: d.ok || {}, bad: d.bad || {}, mock: d.mock || [] };
}
function planValidLogDay(iso, d) {
  return isoIsValid(iso) && planIsObject(d) && (d.ok === undefined || planIsObject(d.ok))
    && (d.bad === undefined || planIsObject(d.bad)) && (d.mock === undefined || Array.isArray(d.mock));
}
// a malformed log → null: the service then never overwrites it (arch §B.6)
function parsePlanLog(raw) {
  if (!planIsObject(raw) || raw.v !== PLAN_SCHEMA_VERSION || !planIsObject(raw.days)) return null;
  const entries = Object.entries(raw.days);
  if (!entries.every(([iso, d]) => planValidLogDay(iso, d))) return null;
  return { v: PLAN_SCHEMA_VERSION, days: Object.fromEntries(entries.map(([iso]) => [iso, planDayLog(raw, iso)])) };
}
function planEverKeys(log, field) {
  return new Set(log ? Object.values(log.days).flatMap(d => Object.keys(d[field] || {})) : []);
}

// ── task contents ──
// read / practice are fixed at build time; review / drill / wrongFacts / mock wait for their day (G9)
function planIsMaterialized(task) {
  if (task.type === PLAN_TASK.mock) return 'exam' in task;
  if (task.type === PLAN_TASK.read || task.type === PLAN_TASK.wrongFacts) return Array.isArray(task.facts);
  return Array.isArray(task.qids);
}
function planTaskQids(task) {
  if (Array.isArray(task.qids)) return task.qids;
  return Array.isArray(task.facts) ? task.facts.flatMap(id => planFactQids(planFactById(id))) : [];
}
function planAssignedExams(plan) {
  return plan ? plan.days.flatMap(d => d.tasks.filter(t => t.type === PLAN_TASK.mock && 'exam' in t).map(t => t.exam)) : [];
}
function planMasteredKeys(streaks) {
  return new Set(Object.keys(streaks || {}).filter(k => streaks[k] >= MASTERY_STREAK).map(planCanonKey));
}
// G9: today's first 24 wrong-list questions, canonical, no repeats; [] = "no wrong answers" (done)
function planMaterializeReview(task, ctx) {
  return { ...task, qids: planUnique((ctx.wrongKeys || []).map(planCanonKey)).slice(0, PRACTICE_ROUND_MAX) };
}
// drill: the chapter's questions, not yet 🏆 first, then ones the plan saw answered wrong, then the rest
function planMaterializeDrill(task, ctx) {
  const mastered = planMasteredKeys(ctx.streaks);
  const wrong = planEverKeys(ctx.log, PLAN_LOG_BAD);
  const rank = k => (mastered.has(k) ? 2 : 0) + (wrong.has(k) ? 0 : 1);
  return { ...task, qids: [...PLAN_CHAPTER_QIDS[task.ch]].sort((a, b) => rank(a) - rank(b)).slice(0, task.quota) };
}
// the facts of wrong answers (wrong list, then the plan's own wrong answers); anchor = the question shown as current
function planMaterializeWrongFacts(task, ctx) {
  const facts = [], anchor = {};
  [...(ctx.wrongKeys || []), ...planEverKeys(ctx.log, PLAN_LOG_BAD)].map(planCanonKey).forEach(k => {
    const f = FACT_BY_QKEY[k];
    if (!f || f.id in anchor || facts.length >= task.quota) return;
    facts.push(f.id);
    anchor[f.id] = k;
  });
  return { ...task, facts, anchor };
}
// a mock takes the first Exam 1–17 neither completed nor already in the plan, else goes round again
function planMaterializeMock(task, ctx, taken) {
  const completed = ctx.completedExams || {};
  const free = EXAM_NUMBERS.find(n => !completed[n] && !taken.includes(n));
  return { ...task, exam: free !== undefined ? free : EXAM_NUMBERS[taken.length % EXAM_NUMBERS.length] };
}
const PLAN_MATERIALIZERS = {
  [PLAN_TASK.review]: planMaterializeReview,
  [PLAN_TASK.drill]: planMaterializeDrill,
  [PLAN_TASK.wrongFacts]: planMaterializeWrongFacts,
  [PLAN_TASK.mock]: planMaterializeMock,
};
// ctx = { wrongKeys, streaks, completedExams, plan, log }; returns a new day, the input is never changed
function materializePlanDay(day, ctx) {
  const taken = planAssignedExams(ctx.plan);
  let changed = false;
  const tasks = day.tasks.map(task => {
    if (planIsMaterialized(task) || !PLAN_MATERIALIZERS[task.type]) return task;
    changed = true;
    const filled = PLAN_MATERIALIZERS[task.type](task, ctx, taken);
    if ('exam' in filled) taken.push(filled.exam);
    return filled;
  });
  return { day: changed ? { ...day, tasks } : day, changed };
}

// ── completion (G3 / G4 / G5 / G10 / G24 / G25) ──
function planProgressOf(done, total, bad, extra = {}) {
  return { done, total, bad, pct: percent(done, total), complete: total > 0 && done >= total, pending: false, ...extra };
}
function planFactDone(id, dayLog) {
  const qids = planFactQids(planFactById(id));
  return qids.length > 0 && qids.every(k => dayLog.ok[k]);
}
function planMockPassed(a) { return !!a && a.total > 0 && a.correct / a.total >= PASS_RATIO; }
// a mock is REAL_TEST_SIZE units, all of them once the day has one more pass than the slots before it
function planMockProgress(task, dayLog) {
  const passes = dayLog.mock.filter(planMockPassed).length;
  const scores = dayLog.mock.map(a => a && a.correct).filter(Number.isFinite);
  return planProgressOf(passes > task.slot ? REAL_TEST_SIZE : 0, REAL_TEST_SIZE, 0, { best: scores.length ? Math.max(...scores) : null });
}
// G24: an unopened review weighs nothing; other unopened tasks count their quota as not done
function planPendingProgress(task) {
  return { ...planProgressOf(0, task.type === PLAN_TASK.review ? 0 : task.quota || 0, 0), pending: true };
}
function planTaskProgress(task, dayLog) {
  if (task.type === PLAN_TASK.mock) return planMockProgress(task, dayLog);
  if (!planIsMaterialized(task)) return planPendingProgress(task);
  const byFact = !Array.isArray(task.qids);
  const items = byFact ? task.facts : task.qids;
  const bad = planTaskQids(task).filter(k => dayLog.bad[k] && !dayLog.ok[k]).length;
  if (!items.length) return planProgressOf(1, 1, 0);
  const done = items.filter(x => (byFact ? planFactDone(x, dayLog) : dayLog.ok[x])).length;
  return planProgressOf(done, items.length, bad);
}
// G8: only the day's own tasks (carry-over done today counts for its own day)
function planDayCompletion(day, dayLog) {
  const tasks = day.tasks.map(t => planTaskProgress(t, dayLog));
  const total = tasks.reduce((s, p) => s + p.total, 0);
  const done = tasks.reduce((s, p) => s + Math.min(p.done, p.total), 0);
  return { pct: total ? percent(done, total) : null, done, total, tasks };
}

// G8: every unfinished past task except mocks, oldest first; G7: nothing from before the last re-plan; G16: none after
function planCarryTasks(plan, log, todayIso) {
  if (planStatus(plan, todayIso) !== PLAN_STATUS.active) return [];
  const out = [];
  plan.days.forEach((day, i) => {
    if (day.date >= todayIso || (plan.carryFrom && day.date < plan.carryFrom)) return;
    const dayLog = planDayLog(log, day.date);
    day.tasks.forEach((task, taskIndex) => {
      const p = task.type === PLAN_TASK.mock ? null : planTaskProgress(task, dayLog);
      if (p && p.total > 0 && !p.complete) out.push({ date: day.date, dayNumber: i + 1, taskIndex, task });
    });
  });
  return out;
}

// ── attribution: which day an answer counts for (G2 / G5) ──
// ① opened from a plan day → that day (past = carry-over, future = early); ② today's tasks hold it → today;
// ③ the oldest unfinished carry task still missing it → that day; ④ otherwise not recorded. Nothing from the exam day on.
function planAttributeAnswer(plan, log, qid, todayIso, ctxIso) {
  if (planStatus(plan, todayIso) !== PLAN_STATUS.active) return null;
  if (ctxIso) return planDayAt(plan, ctxIso) ? ctxIso : null;
  const today = planDayAt(plan, todayIso);
  if (today && today.tasks.some(t => planTaskQids(t).includes(qid))) return todayIso;
  const carry = planCarryTasks(plan, log, todayIso)
    .find(c => planTaskQids(c.task).includes(qid) && !planDayLog(log, c.date).ok[qid]);
  return carry ? carry.date : null;
}
// G10 / G23: a mock only counts on the day itself, and only on a day with a mock task (mocks are never carried)
function planAttributeMock(plan, todayIso, ctxIso) {
  if (planStatus(plan, todayIso) !== PLAN_STATUS.active || (ctxIso && ctxIso !== todayIso)) return null;
  const day = planDayAt(plan, todayIso);
  return day && day.tasks.some(t => t.type === PLAN_TASK.mock) ? todayIso : null;
}
// right once = done for that day (a later wrong answer takes nothing away); wrong answers only feed the tallies
function planApplyAnswer(log, iso, qid, correct) {
  const day = planDayLog(log, iso);
  const next = correct ? { ...day, ok: { ...day.ok, [qid]: 1 } } : { ...day, bad: { ...day.bad, [qid]: 1 } };
  return { ...log, days: { ...log.days, [iso]: next } };
}
function planApplyMock(log, iso, attempt) {
  const day = planDayLog(log, iso);
  const mock = [...day.mock, { exam: attempt.exam, correct: attempt.correct, total: attempt.total }];
  return { ...log, days: { ...log.days, [iso]: { ...day, mock } } };
}

// ── runner queue: unanswered first (skipped ones last), then wrong-not-yet-right; one round ≤ PRACTICE_ROUND_MAX ──
function planNextRound(task, dayLog, skipped = []) {
  const qids = planTaskQids(task);
  const fresh = qids.filter(k => !dayLog.ok[k] && !dayLog.bad[k]);
  const retry = qids.filter(k => dayLog.bad[k] && !dayLog.ok[k]);
  const order = [...fresh.filter(k => !skipped.includes(k)), ...fresh.filter(k => skipped.includes(k)), ...retry];
  return order.slice(0, PRACTICE_ROUND_MAX);
}
function planRetryLeft(task, dayLog) { return planTaskQids(task).filter(k => dayLog.bad[k] && !dayLog.ok[k]).length; }
function planResumeAt(task, dayLog) {
  if (!Array.isArray(task.qids) && Array.isArray(task.facts)) return task.facts.find(id => !planFactDone(id, dayLog)) || null;
  return planNextRound(task, dayLog)[0] || null;
}
// home card "continue from …": today's first unfinished task, else the oldest carry task
function planNextStep(plan, log, todayIso) {
  if (planStatus(plan, todayIso) !== PLAN_STATUS.active) return { kind: PLAN_NEXT.done };
  const day = planDayAt(plan, todayIso);
  const dayLog = planDayLog(log, todayIso);
  const taskIndex = day ? day.tasks.findIndex(t => { const p = planTaskProgress(t, dayLog); return p.total > 0 && !p.complete; }) : -1;
  if (taskIndex >= 0) return { kind: PLAN_NEXT.today, date: todayIso, taskIndex, resumeAt: planResumeAt(day.tasks[taskIndex], dayLog) };
  const carry = planCarryTasks(plan, log, todayIso)[0];
  if (!carry) return { kind: PLAN_NEXT.done };
  return { kind: PLAN_NEXT.carry, date: carry.date, taskIndex: carry.taskIndex, resumeAt: planResumeAt(carry.task, planDayLog(log, carry.date)) };
}

// ── overview ──
function planPctBand(pct) { return PLAN_PCT_BAND_FROM.filter(at => pct >= at).length; }
function planAveragePct(plan, log, todayIso) {
  const pcts = plan.days.filter(d => d.date < todayIso)
    .map(d => planDayCompletion(d, planDayLog(log, d.date)).pct).filter(p => p !== null);
  return pcts.length ? Math.round(pcts.reduce((s, p) => s + p, 0) / pcts.length) : 0;
}
function planKpis(plan, log, todayIso) {
  const right = planEverKeys(log, PLAN_LOG_OK);
  const totalDays = plan.days.length;
  const dayNumber = Math.min(totalDays, Math.max(1, planDayNumber(plan, todayIso)));
  const attempts = Object.values(log.days).flatMap(d => d.mock || []);
  return {
    planPct: percent(dayNumber, totalDays), dayNumber, totalDays, avgPct: planAveragePct(plan, log, todayIso),
    daysLeft: Math.max(0, isoDiffDays(todayIso, plan.goal.examDate)),
    factsDone: STUDY.filter(f => planFactQids(f).every(k => right.has(k))).length, factsTotal: STUDY.length,
    qidsDone: [...right].filter(k => PLAN_CANON_QKEY[k] === k).length, qidsTotal: PLAN_TOTAL_QIDS,
    safeMocks: attempts.filter(a => a && a.total > 0 && a.correct / a.total >= PLAN_SAFE_SCORE / REAL_TEST_SIZE).length,
    mocksPlanned: plan.days.flatMap(d => d.tasks).filter(t => t.type === PLAN_TASK.mock).length,
  };
}
// G29: days at 100% in a row up to today; rest / empty days are skipped, today only counts once it is 100%
function planStreakDays(plan, log, todayIso) {
  let streak = 0;
  for (let i = Math.min(planDayIndex(plan, todayIso), plan.days.length - 1); i >= 0; i--) {
    const day = plan.days[i];
    const pct = planDayCompletion(day, planDayLog(log, day.date)).pct;
    if (pct === PERCENT) streak++;
    else if (pct !== null && day.date !== todayIso) break;
  }
  return streak;
}
// months { year, month (1–12) } from the start month to the exam month
function planMonths(plan) {
  const [y0, m0] = isoParts(plan.start);
  const [y1, m1] = isoParts(plan.goal.examDate);
  const count = (y1 - y0) * ISO_MONTHS_PER_YEAR + m1 - m0 + 1;
  return Array.from({ length: count }, (_, i) => {
    const [year, month] = isoParts(isoAddMonths(`${y0}-${pad2(m0)}-01`, i));
    return { year, month };
  });
}
function planGridCell(plan, log, iso, todayIso) {
  const day = planDayAt(plan, iso);
  const rest = !!day && day.phase === PLAN_PHASE.rest;
  const shown = !!day && !rest && iso <= todayIso;
  return {
    iso, inPlan: !!day, past: iso < todayIso, today: iso === todayIso, examDay: iso === plan.goal.examDate, rest,
    pct: shown ? planDayCompletion(day, planDayLog(log, iso)).pct : null,
  };
}
// one month: lead = blank cells before day 1 (weeks start on Sunday), then one cell per date
function planMonthGrid(plan, log, year, month, todayIso) {
  const first = `${year}-${pad2(month)}-01`;
  const cells = Array.from({ length: isoDaysInMonth(year, month) }, (_, i) => planGridCell(plan, log, isoAddDays(first, i), todayIso));
  return { lead: isoWeekday(first), cells };
}

// ── re-plan (G7): past days frozen word for word, unfinished facts re-planned from today, Day 1 unchanged ──
function planFactsLeft(plan, todayIso, log) {
  const done = new Set();
  plan.days.filter(d => d.date < todayIso).forEach(d => d.tasks
    .filter(t => t.type === PLAN_TASK.read)
    .forEach(t => t.facts.filter(id => planFactDone(id, planDayLog(log, d.date))).forEach(id => done.add(id))));
  return PLAN_LEARN_ORDER.filter(id => !done.has(id));
}
// days before today as they are; a re-plan after the exam fills the dates in between with rest days
function planFrozenDays(plan, todayIso) {
  const kept = plan.days.filter(d => d.date < todayIso);
  const gap = Array.from({ length: isoDiffDays(plan.start, todayIso) - kept.length }, (_, i) =>
    ({ date: isoAddDays(plan.start, kept.length + i), phase: PLAN_PHASE.rest, tasks: [] }));
  return [...kept, ...gap];
}
function replanFrom(plan, goal, todayIso, log) {
  if (!validatePlanGoal(goal, todayIso).ok) return null;
  const history = [...(plan.goalHistory || []), { at: todayIso, goal: plan.goal }];
  // clock moved before Day 1: nothing is frozen, the plan restarts today
  if (todayIso < plan.start) return { ...buildPlan(goal, todayIso), createdAt: plan.createdAt, goalHistory: history };
  const own = planCopyGoal(goal);
  const days = [...planFrozenDays(plan, todayIso), ...buildPlanDays(todayIso, own, planFactsLeft(plan, todayIso, log))];
  return { ...plan, goal: own, goalHistory: history, carryFrom: todayIso, days };
}

// ── service: the only part that touches storage (screens and answer hooks call these) ──
function planLoad() { return parseStoredPlan(readStudyPlan()); }
// the stored log, an empty one when none is stored, or null when the stored one is unreadable (left as it is)
function planLoadLog() {
  const stored = readPlanLog();
  if (!stored.stored) return planEmptyLog();
  return stored.value === undefined ? null : parsePlanLog(stored.value);
}
// key = "exam.idx" of any copy of the question; read-modify-write so another tab's answers survive (R17).
// No plan / unreadable log / no matching day → nothing is written (R3). Returns the day written or null.
function recordPlanAnswer(key, correct, ctxIso = null, now = new Date()) {
  const plan = planLoad();
  const log = plan && planLoadLog();
  if (!log) return null;
  const qid = planCanonKey(key);
  const iso = planAttributeAnswer(plan, log, qid, planTodayIso(now), ctxIso);
  if (iso) writePlanLog(planApplyAnswer(log, iso, qid, correct));
  return iso;
}
// result = { examNum, correct, total, isRealTest } — isRealTest: Exam 1–17 or Random Exam in Exam mode (screen decides)
function recordPlanMock(result, ctxIso = null, now = new Date()) {
  const plan = result && result.isRealTest ? planLoad() : null;
  const log = plan && planLoadLog();
  if (!log) return null;
  const iso = planAttributeMock(plan, planTodayIso(now), ctxIso);
  if (iso) writePlanLog(planApplyMock(log, iso, { exam: result.examNum, correct: result.correct, total: result.total }));
  return iso;
}
// G9: the first open of a day (plan page or home card) fixes today's review / drill / mock contents; later opens
// and plan-less devices write nothing
function ensurePlanToday(now = new Date()) {
  const plan = planLoad();
  if (!plan) return null;
  const todayIso = planTodayIso(now);
  const i = planDayIndex(plan, todayIso);
  if (planStatus(plan, todayIso) !== PLAN_STATUS.active || !plan.days[i]) return plan;
  const ctx = { wrongKeys: keysOf(wrongList), streaks, completedExams: completedExams(), plan, log: planLoadLog() };
  const { day, changed } = materializePlanDay(plan.days[i], ctx);
  if (!changed) return plan;
  const next = { ...plan, days: plan.days.map((d, k) => (k === i ? day : d)) };
  writeStudyPlan(next);
  return next;
}
