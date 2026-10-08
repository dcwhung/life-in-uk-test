const { chromium } = require('playwright-core');
const path = require('path');
// Study plan PR2 (T-309–T-313; arch §D, §E.1, §E.5): the answer / exam hooks that feed the plan log.
// No UI yet (STUDY_PLAN_READY = false): a plan is seeded with evaluate, the clock is fixed with page.clock.
// - no plan: answering and submitting write no study plan key (R3); state.planDay is null
// - Practice / wrong answers / Flagged / Similar: a right answer on one of today's task questions → today's ok (G2);
//   a wrong one only feeds bad; a question no task holds is not written; one log write per recorded answer
// - plan side session ('p' + Day n): counts for its own day (G5), header "Day n", ↩ Back goes Home for now;
//   a plan review task clears the wrong list (R9)
// - Exam mode answers never count for practice tasks (G22); Exam 1–17 / Random Exam submitted in Exam mode on a
//   mock day write a mock attempt (G10); Practice mode and Leave do not (G15); switch off still records (G14)
// - startExam(examNum, mode) runs that mode without touching Home's pendingMode (R8)
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

const TODAY = '2026-10-08';
const MORNING = 'T09:00:00';
const PLAN_DAYS = 21;
const DAILY_MINS = 60;
const OTHER_DAY_INDEX = 2; // Day 3: a learn day after today
// W-030: one of the 19 duplicate questions — Exam 4 Q15 has the same text as Exam 3 Q13 (its canonical key)
const DUP_COPY_KEY = '4.14';
const DUP_CANON_KEY = '3.12';

const at = iso => new Date(iso + MORNING);
// every lifeuk.studyPlan* key in storage
const planKeys = pg => pg.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('lifeuk.studyPlan')));
const dayLog = (pg, iso) => pg.evaluate(iso => {
  const log = JSON.parse(localStorage.getItem(STUDY_PLAN_PROGRESS_LS) || 'null');
  return log && log.days[iso] ? log.days[iso] : { ok: {}, bad: {}, mock: [] };
}, iso);
// answer the session question whose canonical key is qid (or the current one), right or wrong
const answerQid = (pg, qid, correct) => pg.evaluate(({ qid, correct }) => {
  const i = qid ? state.questions.findIndex(q => planCanonKey(qKey(q)) === qid) : state.current;
  const q = state.questions[i];
  state.current = i;
  state.answers[i] = correct ? [...q.a] : [q.o.findIndex((_, k) => !q.a.includes(k))];
  revealAnswer();
  return i;
}, { qid, correct });
const startPracticeOf = (pg, qid) => pg.evaluate(qid => { pendingMode = PRACTICE_MODE; startExam(questionByKey(qid).examNum); }, qid);
// counts writes of the plan log from now on
const spyLogWrites = pg => pg.evaluate(() => {
  window.planLogWrites = 0;
  if (window.planSpyOn) return;
  window.planSpyOn = true;
  const set = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { if (k === STUDY_PLAN_PROGRESS_LS) window.planLogWrites++; return set.call(this, k, v); };
});
const logWrites = pg => pg.evaluate(() => window.planLogWrites);
// a 21-day plan from today, today's tasks filled; returns the days' dates and task lists
const seedPlan = pg => pg.evaluate(({ days, mins }) => {
  const todayIso = planTodayIso();
  writeStudyPlan(buildPlan({ examDate: isoAddDays(todayIso, days), dailyMins: mins, restDays: [], level: 'none' }, todayIso));
  return ensurePlanToday().days.map(d => ({ date: d.date, tasks: d.tasks }));
}, { days: PLAN_DAYS, mins: DAILY_MINS });
const practiceQids = day => day.tasks.find(t => t.type === 'practice').qids;

async function checkNoPlan(pg) {
  await startPracticeOf(pg, '1.0');
  await answerQid(pg, null, true);
  await answerQid(pg, '1.1', false);
  assert(await pg.evaluate(() => state.planDay === null && sideSessionState('similar', []).planDay === null),
    'no plan: state.planDay and a fresh side session planDay are null');
  await pg.evaluate(() => { startExam(2, EXAM_MODE); state.questions.forEach((q, i) => { state.answers[i] = [...q.a]; }); finishExam(); });
  await pg.evaluate(() => { startExam(ALL_EXAM, EXAM_MODE); finishExam(); });
  assert((await planKeys(pg)).length === 0, 'no plan: Practice answers and exam submits write no study plan key (R3)');
}

async function checkStartExamMode(pg) {
  const r = await pg.evaluate(() => {
    pendingMode = PRACTICE_MODE;
    startExam(3, EXAM_MODE);
    const exam = { mode: state.mode, pending: pendingMode, planDay: state.planDay };
    startExam(3);
    return { exam, practice: state.mode, pending: pendingMode };
  });
  assert(r.exam.mode === 'exam' && r.exam.pending === 'practice' && r.exam.planDay === null,
    'startExam(3, EXAM_MODE): Exam mode, Home pendingMode stays practice, planDay null (R8)');
  assert(r.practice === 'practice' && r.pending === 'practice', 'startExam(3): defaults to pendingMode');
  await pg.evaluate(() => leaveToHome());
}

async function checkPracticeToday(pg, days) {
  const [qWrong, qRight, qFlag, qSimilar] = practiceQids(days[0]);
  await spyLogWrites(pg);
  await startPracticeOf(pg, qWrong);
  await answerQid(pg, qWrong, false);
  let log = await dayLog(pg, TODAY);
  assert(log.bad[qWrong] === 1 && !log.ok[qWrong], 'Practice: a wrong answer on a today task question → bad only (G2)');
  await startPracticeOf(pg, qRight);
  await answerQid(pg, qRight, true);
  log = await dayLog(pg, TODAY);
  assert(log.ok[qRight] === 1, 'Practice: a right answer on a today task question → today ok (G2)');
  assert(await logWrites(pg) === 2, 'one plan log write per recorded answer');
  await pg.evaluate(() => { startExam(WRONG_EXAM); });
  await answerQid(pg, qWrong, true);
  assert((await dayLog(pg, TODAY)).ok[qWrong] === 1, 'wrong answers review: right on a today task question → today ok (G2)');
  await pg.evaluate(qid => { setPracticeFlag(qid, true); startExam(FLAGGED_EXAM); }, qFlag);
  await answerQid(pg, qFlag, true);
  assert((await dayLog(pg, TODAY)).ok[qFlag] === 1, 'Flagged: right on a today task question → today ok (G2)');
  await pg.evaluate(qid => startSideSession(SIMILAR_EXAM, [questionByKey(qid)].map(toQuestionItem),
    { kind: SESSION_RETURN_KIND.quiz, state }), qSimilar);
  await answerQid(pg, qSimilar, true);
  assert((await dayLog(pg, TODAY)).ok[qSimilar] === 1, 'Similar session: right on a today task question → today ok (G2)');
  await pg.evaluate(() => leaveToHome());
}

async function checkNotInPlanToday(pg, days) {
  const todayQids = new Set(days[0].tasks.flatMap(t => t.qids || []));
  const later = practiceQids(days[OTHER_DAY_INDEX]).find(q => !todayQids.has(q));
  await spyLogWrites(pg);
  await startPracticeOf(pg, later);
  await answerQid(pg, later, true);
  assert(await logWrites(pg) === 0 && !(await dayLog(pg, TODAY)).ok[later],
    'Practice: a question no today / carry task holds is not written (G5)');
  await pg.evaluate(() => leaveToHome());
}

async function checkPlanSession(pg, days) {
  const day = days[OTHER_DAY_INDEX];
  const taskIndex = day.tasks.findIndex(t => t.type === 'practice');
  const qid = day.tasks[taskIndex].qids[0];
  const ids = await pg.evaluate(() => ({ p3: isPlanExam('p3'), bare: isPlanExam('p'), word: isPlanExam('pa'), num: isPlanExam(3) }));
  assert(ids.p3 && !ids.bare && !ids.word && !ids.num, "isPlanExam: 'p' + digits only");
  await pg.evaluate(({ qid, ret }) => startSideSession(PLAN_PREFIX + 3, [questionByKey(qid)].map(toQuestionItem), ret),
    { qid, ret: { kind: 'plan', date: day.date, taskIndex, type: 'practice' } });
  const head = await pg.evaluate(() => ({ label: byId('quizLabel').textContent, planDay: state.planDay, mode: state.mode }));
  assert(head.label === 'Day 3' && head.planDay === day.date && head.mode === 'practice',
    'plan side session: Practice, header "Day 3", planDay = its date');
  await answerQid(pg, qid, true);
  assert((await dayLog(pg, day.date)).ok[qid] === 1 && !(await dayLog(pg, TODAY)).ok[qid],
    'plan side session: a right answer counts for its own day, not today (G5)');
  await pg.evaluate(() => runNextAction());
  const back = await pg.evaluate(() => ({ screen: document.querySelector('.screen.active').id, side: isSideSession() }));
  assert(back.screen === 'screenHome' && !back.side, 'plan side session: ↩ Back goes Home (task card comes in PR6a)');
  await pg.evaluate(() => startExam(1));
  assert(await pg.evaluate(() => state.planDay === null), 'startExam after a plan session: planDay null');
  await pg.evaluate(() => leaveToHome());
}

async function checkPlanReviewClearsWrong(pg, days) {
  const reviewIndex = days[0].tasks.findIndex(t => t.type === 'review');
  const [qa, qb] = practiceQids(days[1]);
  const run = (qid, type) => pg.evaluate(({ qid, ret }) => {
    addWrong(questionByKey(qid));
    startSideSession(PLAN_PREFIX + 1, [questionByKey(qid)].map(toQuestionItem), ret);
  }, { qid, ret: { kind: 'plan', date: TODAY, taskIndex: reviewIndex, type } });
  await run(qa, 'practice');
  await answerQid(pg, qa, true);
  assert(await pg.evaluate(qid => !!wrongList[qid], qa), 'plan practice session: a right answer keeps the wrong list entry');
  await run(qb, 'review');
  await answerQid(pg, qb, true);
  assert(await pg.evaluate(qid => !wrongList[qid] && state.cleared === 1, qb), 'plan review session: a right answer clears the wrong list entry (R9)');
  // W-030: the wrong list holds the copy answered (4.14), the task the canonical one (3.12) — both copies go
  const dup = await pg.evaluate(({ copy, canon, ret }) => {
    addWrong(questionByKey(copy));
    addWrong(questionByKey(canon));
    startSideSession(PLAN_PREFIX + 1, [questionByKey(canon)].map(toQuestionItem), ret);
    return planCanonKey(copy);
  }, { copy: DUP_COPY_KEY, canon: DUP_CANON_KEY, ret: { kind: 'plan', date: TODAY, taskIndex: reviewIndex, type: 'review' } });
  assert(dup === DUP_CANON_KEY, `${DUP_COPY_KEY} is a copy of ${DUP_CANON_KEY}`);
  await answerQid(pg, DUP_CANON_KEY, true);
  assert(await pg.evaluate(({ copy, canon }) => !wrongList[copy] && !wrongList[canon] && state.cleared === 1,
    { copy: DUP_COPY_KEY, canon: DUP_CANON_KEY }),
    'plan review session: a right answer on 3.12 clears every copy (4.14 + 3.12) from the wrong list, cleared +1 (W-030)');
  await pg.evaluate(() => leaveToHome());
}

async function checkExamAnswersNotCounted(pg, days) {
  const qid = practiceQids(days[0]).slice(-1)[0];
  await pg.evaluate(qid => {
    startExam(questionByKey(qid).examNum, EXAM_MODE);
    state.questions.forEach((q, i) => { state.answers[i] = [...q.a]; });
    finishExam();
  }, qid);
  const log = await dayLog(pg, TODAY);
  assert(!log.ok[qid] && log.mock.length === 0, 'Exam mode answers do not count for practice tasks; no mock task today → no attempt (G22)');
  await pg.evaluate(() => leaveToHome());
}

async function checkSwitchOff(pg, days) {
  const qid = practiceQids(days[0]).slice(-2)[0];
  await pg.evaluate(() => setStudyPlanEnabled(false));
  await startPracticeOf(pg, qid);
  await answerQid(pg, qid, true);
  assert((await dayLog(pg, TODAY)).ok[qid] === 1, 'switch off: answers still recorded (G14)');
  await pg.evaluate(() => { setStudyPlanEnabled(true); leaveToHome(); });
}

async function checkMocks(pg, days) {
  const mockDay = days.find(d => d.tasks.some(t => t.type === 'mock')).date;
  await pg.clock.setFixedTime(at(mockDay));
  const submit = (examNum, mode, correct) => pg.evaluate(({ examNum, mode, correct }) => {
    startExam(examNum, mode);
    state.questions.forEach((q, i) => { if (i < correct) state.answers[i] = [...q.a]; });
    finishExam();
  }, { examNum, mode, correct });
  await submit(4, 'exam', 20);
  let mock = (await dayLog(pg, mockDay)).mock;
  assert(mock.length === 1 && mock[0].exam === 4 && mock[0].correct === 20 && mock[0].total === 24,
    'Exam 4 submitted in Exam mode on a mock day → mock attempt { exam 4, 20 / 24 } (G10)');
  await submit('all', 'exam', 12);
  mock = (await dayLog(pg, mockDay)).mock;
  assert(mock.length === 2 && mock[1].exam === 'all' && mock[1].total === 24, 'Random Exam submitted → second mock attempt (G11)');
  await submit(5, 'practice', 24);
  await submit('ch3', 'exam', 5);
  assert((await dayLog(pg, mockDay)).mock.length === 2, 'Practice-mode Exam 5 and an Exam-mode chapter set write no mock attempt');
  await pg.evaluate(() => { startExam(6, EXAM_MODE); leaveToHome(); });
  assert((await dayLog(pg, mockDay)).mock.length === 2, 'Leave from an exam writes no mock attempt (G15)');
  await pg.clock.setFixedTime(at(TODAY));
}

(async () => {
  const b = await chromium.launch(launchOpts);
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.clock.setFixedTime(at(TODAY));
  await pg.goto(APP_URL);
  await pg.evaluate(() => localStorage.clear());
  await pg.reload();
  await checkNoPlan(pg);
  await checkStartExamMode(pg);
  await pg.evaluate(() => { localStorage.clear(); resetPracticeStore(); });
  const days = await seedPlan(pg);
  assert(days[0].date === TODAY && days.length === PLAN_DAYS, `seeded a ${PLAN_DAYS}-day plan from ${TODAY}`);
  await checkPracticeToday(pg, days);
  await checkNotInPlanToday(pg, days);
  await checkPlanSession(pg, days);
  await checkPlanReviewClearsWrong(pg, days);
  await checkExamAnswersNotCounted(pg, days);
  await checkSwitchOff(pg, days);
  await checkMocks(pg, days);
  assert(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join('; ') : ''));
  await b.close();
  console.log('PLANHOOK PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
