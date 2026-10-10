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
// a view log (planWithMastered) also hands each day the mastered set (G37); a stored log has none
function planDayLog(log, iso) {
  const d = (log && log.days[iso]) || {};
  const day = { ok: d.ok || {}, bad: d.bad || {}, mock: d.mock || [] };
  return log && log.mastered ? { ...day, mastered: log.mastered } : day;
}
// G37: mastered (🏆) questions count as done in reading + practice tasks, live: the screens read the log through
// this (mastered = canonical keys, planMasteredKeys); never stored, so nothing is migrated and drills still ask again
const PLAN_NO_MASTERED = new Set();
const PLAN_MASTERY_TYPES = [PLAN_TASK.read, PLAN_TASK.practice];
function planWithMastered(log, mastered) { return log && { ...log, mastered: mastered || PLAN_NO_MASTERED }; }
function planTaskMastered(task, dayLog) {
  return PLAN_MASTERY_TYPES.includes(task.type) && dayLog.mastered ? dayLog.mastered : PLAN_NO_MASTERED;
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
// W-027: a past day opened for carry-over fills only these; its review stays empty (G24), its mocks are never carried
const PLAN_PAST_TYPES = [PLAN_TASK.drill, PLAN_TASK.wrongFacts];
const PLAN_MATERIALIZERS = {
  [PLAN_TASK.review]: planMaterializeReview,
  [PLAN_TASK.drill]: planMaterializeDrill,
  [PLAN_TASK.wrongFacts]: planMaterializeWrongFacts,
  [PLAN_TASK.mock]: planMaterializeMock,
};
// ctx = { wrongKeys, streaks, completedExams, plan, log, types? } (types: only these task types are filled);
// returns a new day, the input is never changed
function materializePlanDay(day, ctx) {
  const taken = planAssignedExams(ctx.plan);
  let changed = false;
  const tasks = day.tasks.map(task => {
    if (planIsMaterialized(task) || !PLAN_MATERIALIZERS[task.type] || (ctx.types && !ctx.types.includes(task.type))) return task;
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
function planFactDone(id, dayLog, mastered = PLAN_NO_MASTERED) {
  const qids = planFactQids(planFactById(id));
  return qids.length > 0 && qids.every(k => dayLog.ok[k] || mastered.has(k));
}
function planMockPassed(a) { return !!a && a.total > 0 && a.correct / a.total >= PASS_RATIO; }
// a mock is REAL_TEST_SIZE units, all of them once the day has one more pass than the slots before it
function planMockProgress(task, dayLog) {
  const passes = dayLog.mock.filter(planMockPassed).length;
  const scores = dayLog.mock.map(a => a && a.correct).filter(Number.isFinite);
  return planProgressOf(passes > task.slot ? REAL_TEST_SIZE : 0, REAL_TEST_SIZE, 0, { best: scores.length ? Math.max(...scores) : null });
}
// G11 / W-044: slot k is sat after k passes, so it is a retake (Random Exam) only while the day has exactly k passes and
// its last attempt failed; otherwise the slot opens its own exam (earlier failed retakes of other slots do not count)
function planMockRetake(dayLog, slot) {
  const passes = dayLog.mock.filter(planMockPassed).length;
  const last = dayLog.mock[dayLog.mock.length - 1];
  return passes === slot && !!last && !planMockPassed(last);
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
  const m = planTaskMastered(task, dayLog);
  const bad = planTaskQids(task).filter(k => dayLog.bad[k] && !dayLog.ok[k] && !m.has(k)).length;
  if (!items.length) return planProgressOf(1, 1, 0);
  const done = items.filter(x => (byFact ? planFactDone(x, dayLog, m) : dayLog.ok[x] || m.has(x))).length;
  const mastered = byFact ? 0 : items.filter(k => !dayLog.ok[k] && m.has(k)).length; // done by 🏆 alone
  return planProgressOf(done, items.length, bad, { mastered });
}
// G24 / CUI-0022: a past day never opened has no clear-wrong task (its review was never filled: it weighs nothing
// and is never carried), so the day screen neither lists nor counts it; today and days ahead keep theirs (G23)
function planVisibleTasks(day, todayIso) {
  if (day.date >= todayIso) return day.tasks;
  return day.tasks.filter(t => t.type !== PLAN_TASK.review || planIsMaterialized(t));
}
// G8: only the day's own tasks (carry-over done today counts for its own day)
function planDayCompletion(day, dayLog) {
  const tasks = day.tasks.map(t => planTaskProgress(t, dayLog));
  const total = tasks.reduce((s, p) => s + p.total, 0);
  const done = tasks.reduce((s, p) => s + Math.min(p.done, p.total), 0);
  return { pct: total ? percent(done, total) : null, done, total, tasks };
}

// ── phase / chapter done (G43): content, not dates, so a phase may turn green before its last day ──
// S-160: the facts / questions done, worked out once per render. G3 / G4: a fact is done once one day's log holds
// all its questions right; G37: 🏆 ones count on any day, or alone. Questions: right on any day, or 🏆
function planDoneSets(log) {
  const mastered = (log && log.mastered) || PLAN_NO_MASTERED;
  const facts = new Set(), qids = new Set(mastered);
  const check = (keys, dayLog) => keys.forEach(k => {
    const f = FACT_BY_QKEY[k];
    if (f && !facts.has(f.id) && planFactDone(f.id, dayLog, mastered)) facts.add(f.id);
  });
  check([...mastered], planDayLog(null, ''));
  if (log) Object.keys(log.days).forEach(iso => {
    const dayLog = planDayLog(log, iso);
    Object.keys(dayLog.ok).forEach(k => qids.add(k));
    check(Object.keys(dayLog.ok), dayLog);
  });
  return { facts, qids };
}
function planFactDoneEver(log, id) { return planDoneSets(log).facts.has(id); }
// learn: every fact of its reading tasks and every question of its practice tasks, answered on whichever day
function planLearnContentDone(days, done) {
  const tasks = days.flatMap(d => d.tasks);
  const facts = tasks.filter(t => t.type === PLAN_TASK.read).flatMap(t => t.facts || []);
  const qids = tasks.filter(t => t.type === PLAN_TASK.practice).flatMap(t => t.qids || []);
  return facts.every(id => done.facts.has(id)) && qids.every(k => done.qids.has(k));
}
// W-049 (user decision): drill / mock count only the days still doable, from the latest re-plan on (G7: the
// days before carryFrom are frozen, never carried); when every day of the phase is frozen, all of them count
function planCountableDays(plan, phase) {
  const days = plan.days.filter(d => d.phase === phase);
  const open = plan.carryFrom ? days.filter(d => d.date >= plan.carryFrom) : days;
  return open.length ? open : days;
}
// W-049: a mock day's other tasks (review, the light day's wrong facts) done; an unopened review weighs nothing (G24)
function planMockDayRestDone(day, dayLog) {
  return day.tasks.filter(t => t.type !== PLAN_TASK.mock).every(t => { const p = planTaskProgress(t, dayLog); return p.complete || p.total === 0; });
}
// W-049: a failed / skipped mock day never blocks (mocks are not carried, G10 / G23): every countable day's other tasks
// done and the phase's latest attempt a pass (G10), so the phase only turns green after a pass that follows the last fail
function planMockPhaseDone(plan, days, log) {
  const attempts = plan.days.filter(d => d.phase === PLAN_PHASE.mock).flatMap(d => planDayLog(log, d.date).mock);
  const latest = attempts[attempts.length - 1];
  return planMockPassed(latest) && days.every(d => planMockDayRestDone(d, planDayLog(log, d.date)));
}
// learn: content (above); drill: every countable day at 100% (G8 / G24 day rules); mock: planMockPhaseDone. Rest days
// have their own phase; no days = never. done = planDoneSets(log), passed in once per render (S-160)
function planPhaseDone(plan, log, phase, done = null) {
  if (!plan.days.some(d => d.phase === phase)) return false;
  if (phase === PLAN_PHASE.learn) return planLearnContentDone(plan.days.filter(d => d.phase === phase), done || planDoneSets(log));
  const days = planCountableDays(plan, phase);
  if (phase === PLAN_PHASE.mock) return planMockPhaseDone(plan, days, log);
  return days.every(d => planDayCompletion(d, planDayLog(log, d.date)).pct === PERCENT);
}
// a study-order step (chapters chs): every fact of those chapters done
function planChaptersDone(log, chs, done = null) {
  const facts = (done || planDoneSets(log)).facts;
  return STUDY.filter(f => chs.includes(f.ch)).every(f => facts.has(f.id));
}

// G8: every unfinished past task except mocks, oldest first; G7: nothing from before the last re-plan; G16: none after.
// W-027: only tasks with contents (ensurePlanToday fills past drill / wrong-facts days first)
function planCarryTasks(plan, log, todayIso) {
  if (planStatus(plan, todayIso) !== PLAN_STATUS.active) return [];
  const out = [];
  plan.days.forEach((day, i) => {
    if (day.date >= todayIso || (plan.carryFrom && day.date < plan.carryFrom)) return;
    const dayLog = planDayLog(log, day.date);
    day.tasks.forEach((task, taskIndex) => {
      const p = task.type === PLAN_TASK.mock || !planIsMaterialized(task) ? null : planTaskProgress(task, dayLog);
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
// W-030: every key in keys that is the same question as key (G1: copies of one question text count once) —
// a plan task asks the canonical copy, the wrong list holds whichever copy was answered
function planSameQuestionKeys(keys, key) {
  const canon = planCanonKey(key);
  return keys.filter(k => planCanonKey(k) === canon);
}
// G10 / G23: a mock only counts on the day itself, and only on a day with a mock task (mocks are never carried)
function planAttributeMock(plan, todayIso, ctxIso) {
  if (planStatus(plan, todayIso) !== PLAN_STATUS.active || (ctxIso && ctxIso !== todayIso)) return null;
  const day = planDayAt(plan, todayIso);
  return day && day.tasks.some(t => t.type === PLAN_TASK.mock) ? todayIso : null;
}
// right once = done for that day (a later wrong answer takes nothing away); wrong answers only feed the tallies
// the stored shape only ({ v, days: { ok, bad, mock } }): a view log's mastered set is never written (G37)
function planStoredDay(log, iso) {
  const { ok, bad, mock } = planDayLog(log, iso);
  return { ok, bad, mock };
}
function planApplyAnswer(log, iso, qid, correct) {
  const day = planStoredDay(log, iso);
  const next = correct ? { ...day, ok: { ...day.ok, [qid]: 1 } } : { ...day, bad: { ...day.bad, [qid]: 1 } };
  return { v: log.v, days: { ...log.days, [iso]: next } };
}
function planApplyMock(log, iso, attempt) {
  const day = planStoredDay(log, iso);
  const mock = [...day.mock, { exam: attempt.exam, correct: attempt.correct, total: attempt.total }];
  return { v: log.v, days: { ...log.days, [iso]: { ...day, mock } } };
}

// ── runner queue: unanswered first (skipped ones last), then wrong-not-yet-right; one round ≤ PRACTICE_ROUND_MAX ──
// the questions a runner still asks: G37 / W-038: 🏆 ones of a practice task are done already
function planAskableQids(task, dayLog) {
  const m = planTaskMastered(task, dayLog);
  return planTaskQids(task).filter(k => !m.has(k));
}
function planNextRound(task, dayLog, skipped = []) {
  const qids = planAskableQids(task, dayLog);
  const fresh = qids.filter(k => !dayLog.ok[k] && !dayLog.bad[k]);
  const retry = qids.filter(k => dayLog.bad[k] && !dayLog.ok[k]);
  const order = [...fresh.filter(k => !skipped.includes(k)), ...fresh.filter(k => skipped.includes(k)), ...retry];
  return order.slice(0, PRACTICE_ROUND_MAX);
}
function planRetryLeft(task, dayLog) { return planAskableQids(task, dayLog).filter(k => dayLog.bad[k] && !dayLog.ok[k]).length; }
function planResumeAt(task, dayLog) {
  const m = planTaskMastered(task, dayLog);
  if (!Array.isArray(task.qids) && Array.isArray(task.facts)) return task.facts.find(id => !planFactDone(id, dayLog, m)) || null;
  return planNextRound(task, dayLog)[0] || null;
}
// home card "continue from …": today's first unfinished task, else the oldest carry task
function planNextStep(plan, log, todayIso) {
  if (planStatus(plan, todayIso) !== PLAN_STATUS.active) return { kind: PLAN_NEXT.done };
  const day = planDayAt(plan, todayIso);
  const dayLog = planDayLog(log, todayIso);
  const open = t => { const p = planTaskProgress(t, dayLog); return planIsMaterialized(t) && p.total > 0 && !p.complete; };
  const taskIndex = day ? day.tasks.findIndex(open) : -1;
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
  const right = new Set([...planEverKeys(log, PLAN_LOG_OK), ...(log.mastered || PLAN_NO_MASTERED)]); // G37: 🏆 = practised
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
// W-026 / W-028: a fact is done once one day's log has all its canonical questions right (G3 / G4), whichever task
// that day held them: the log only keeps answers credited to plan tasks, and it outlives every re-plan, so a fact
// finished early or on a day a later re-plan turned into a rest day stays finished however often the goal changes
function planFactsDoneOn(log, iso) {
  const dayLog = planDayLog(log, iso);
  const facts = planUnique(Object.keys(dayLog.ok).map(k => FACT_BY_QKEY[k]).filter(Boolean).map(f => f.id));
  return facts.filter(id => planFactDone(id, dayLog));
}
function planFactsDoneSet(log) {
  return new Set(Object.keys(log.days).flatMap(iso => planFactsDoneOn(log, iso)));
}
function planFactsLeft(log) {
  const done = planFactsDoneSet(log);
  return PLAN_LEARN_ORDER.filter(id => !done.has(id));
}
// facts first finished today (W-029: not ones already finished on another day, e.g. re-answered on a drill day) as
// read + practice groups (learn order, one group per chapter run), so the new today still shows and counts them
function planTodayDoneTasks(todayIso, log) {
  const earlier = planFactsDoneSet({ ...log, days: Object.fromEntries(Object.entries(log.days).filter(([iso]) => iso !== todayIso)) });
  const done = new Set(planFactsDoneOn(log, todayIso).filter(id => !earlier.has(id)));
  const items = PLAN_LEARN_ORDER.filter(id => done.has(id)).map(id => ({ ch: planFactById(id).ch, id, w: 1 }));
  return items.length ? planLearnTasks(planChunkWeighted(items, 1)[0]).slice(0, -1) : [];
}
// pinned groups go first on the new today (not on a rest day); the day's own pair indexes shift past them
function planPinToday(days, pinned) {
  if (!pinned.length || !days.length || days[0].phase === PLAN_PHASE.rest) return days;
  const pin = pinned.map((t, i) => (t.type === PLAN_TASK.read ? { ...t, pair: i + 1 } : t));
  const own = days[0].tasks.map(t => (t.type === PLAN_TASK.read ? { ...t, pair: t.pair + pin.length } : t));
  return [{ ...days[0], tasks: [...pin, ...own] }, ...days.slice(1)];
}
// W-029: today's tasks already filled (G9 review snapshot, a drill of the same chapter, wrong facts, a mock slot)
// keep their contents on the new today, so a re-plan does not throw away what was answered today
function planSameTask(a, b) {
  return a.type === b.type && (a.type !== PLAN_TASK.drill || a.ch === b.ch) && (a.type !== PLAN_TASK.mock || a.slot === b.slot);
}
function planKeepTodayContents(oldDay, days) {
  if (!oldDay || !days.length || days[0].date !== oldDay.date) return days;
  const left = oldDay.tasks.filter(t => planIsMaterialized(t) && PLAN_MATERIALIZERS[t.type]);
  const tasks = days[0].tasks.map(t => {
    const k = planIsMaterialized(t) ? -1 : left.findIndex(o => planSameTask(o, t));
    return k < 0 ? t : left.splice(k, 1)[0];
  });
  return [{ ...days[0], tasks }, ...days.slice(1)];
}
// days before today as they are; a re-plan after the exam fills the dates in between with rest days
function planFrozenDays(plan, todayIso) {
  const kept = plan.days.filter(d => d.date < todayIso);
  const gap = Array.from({ length: isoDiffDays(plan.start, todayIso) - kept.length }, (_, i) =>
    ({ date: isoAddDays(plan.start, kept.length + i), phase: PLAN_PHASE.rest, tasks: [] }));
  return [...kept, ...gap];
}
function replanFrom(plan, goal, todayIso, log) {
  // G36: a changed goal has the looser limits (exam from tomorrow, 1 study day)
  if (!validatePlanGoal(goal, todayIso, PLAN_GOAL_MODE.edit).ok) return null;
  const history = [...(plan.goalHistory || []), { at: todayIso, goal: plan.goal }];
  // clock moved before Day 1: nothing is frozen, the plan restarts today
  if (todayIso < plan.start) return { ...buildPlan(goal, todayIso, PLAN_GOAL_MODE.edit), createdAt: plan.createdAt, goalHistory: history };
  const own = planCopyGoal(goal);
  const built = planKeepTodayContents(planDayAt(plan, todayIso), buildPlanDays(todayIso, own, planFactsLeft(log)));
  const fresh = planPinToday(built, planTodayDoneTasks(todayIso, log));
  const days = [...planFrozenDays(plan, todayIso), ...fresh];
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
// the log as the screens show it: mastered questions count (G37); null = unreadable; never written back as is
function planLoadLogView() { return planWithMastered(planLoadLog(), planMasteredKeys(streaks)); }
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
function planMaterializeCtx(plan) {
  return { wrongKeys: keysOf(wrongList), streaks, completedExams: completedExams(), plan, log: planLoadLog() };
}
// fills the given day indexes (today: every type; past: PLAN_PAST_TYPES) against the current wrong list / streaks
function planFillDays(plan, indexes, todayIso) {
  const base = planMaterializeCtx(plan); // read once: up to ~180 days may be filled in one call
  let next = plan, changed = false;
  indexes.forEach(i => {
    const ctx = { ...base, plan: next, types: next.days[i].date === todayIso ? null : PLAN_PAST_TYPES };
    const filled = materializePlanDay(next.days[i], ctx);
    if (!filled.changed) return;
    changed = true;
    next = { ...next, days: next.days.map((d, k) => (k === i ? filled.day : d)) };
  });
  return { plan: next, changed };
}
function planWriteFilled(plan, indexes, todayIso) {
  const { plan: next, changed } = planFillDays(plan, indexes, todayIso);
  if (changed) writeStudyPlan(next);
  return next;
}
// W-027 / G9: the first open of a plan day (today, or a past day shown for carry-over) fixes its contents; future
// days, days before the last re-plan, plan-less devices and unchanged days write nothing. Returns the plan or null.
function ensurePlanDay(iso, now = new Date()) {
  const plan = planLoad();
  if (!plan) return null;
  const todayIso = planTodayIso(now);
  const i = planDayIndex(plan, iso);
  const open = planStatus(plan, todayIso) === PLAN_STATUS.active && iso <= todayIso && !!plan.days[i]
    && !(plan.carryFrom && iso < plan.carryFrom);
  return open ? planWriteFilled(plan, [i], todayIso) : plan;
}
// today plus every past day carry-over can still show, in one write (plan page / home card first open)
function ensurePlanToday(now = new Date()) {
  const plan = planLoad();
  if (!plan) return null;
  const todayIso = planTodayIso(now);
  if (planStatus(plan, todayIso) !== PLAN_STATUS.active) return plan;
  const from = plan.carryFrom || plan.start;
  const indexes = plan.days.map((d, i) => i).filter(i => plan.days[i].date >= from && plan.days[i].date <= todayIso);
  return planWriteFilled(plan, indexes, todayIso);
}
