// v2.0.0 desktop layout on short screens (W-379; handoff .proj-docs/plans/2026-10-12_handoff_desktop-layout.md §5 / §7):
// a laptop at 1366 × 657 or 1280 × 720 (a 768px / 800px panel less the browser's bars) and the smallest desktop window
// 1024 × 600. Every one-screen-high screen (Quiz Practice / Exam, Result, Flagged, Study incl. the memo tab, the memo
// group screen (v1.6.0; v2.3.0 look / single / result B), Plan Run) and Plan Day, in
// EN / 中 with large text (the tallest content):
// - no sideways page scroll
// - every control on the screen can be reached: on screen, or inside a panel that scrolls to it (never cut off by a
//   box that clips without scrolling, never under something else)
const dt = require('./desktop-helpers');
const { assert } = dt;

const EXAM_ONE = 1;
const FLAGGED_N = 14;
const LONG_CHAPTER = 5;
const GOAL = { dailyMins: 120, restDays: [0], level: 'none' };

const seedPlan = (page, { days = 21, dayN = 9 } = {}) => page.evaluate(({ days, dayN, goal }) => {
  const today = planTodayIso(), start = isoAddDays(today, 1 - dayN);
  writeStudyPlan(buildPlan({ ...goal, examDate: isoAddDays(start, days) }, start));
  writePlanLog(planEmptyLog());
}, { days, dayN, goal: GOAL });

// [what, open(page)]: each leaves its screen active
const SCREENS = [
  ['quiz practice, unanswered', page => page.evaluate(n => { pendingMode = 'practice'; startExam(n); }, EXAM_ONE)],
  ['quiz practice, answered', page => page.evaluate(() => {
    const q = state.questions[state.current];
    state.answers[state.current] = [...q.a];
    revealAnswer();
  })],
  ['quiz exam, last question', page => page.evaluate(n => { pendingMode = 'exam'; startExam(n); goToQuestion(state.questions.length - 1); }, EXAM_ONE)],
  ['result exam', page => page.evaluate(n => {
    pendingMode = 'exam'; startExam(n);
    state.questions.forEach((q, i) => { if (i < 20) state.answers[i] = [...q.a]; });
    finishExam();
  }, EXAM_ONE)],
  ['result practice', page => page.evaluate(n => {
    pendingMode = 'practice'; startExam(n);
    state.questions.forEach((q, i) => { state.answers[i] = [...q.a]; state.revealed[i] = true; });
    finishExam();
  }, EXAM_ONE)],
  ['flagged', page => page.evaluate(n => { allQuestions().slice(0, n).forEach(it => setPracticeFlag(qKey(it), true)); openFlagged(); }, FLAGGED_N)],
  ['study chapters', page => page.evaluate(ch => { openStudy(); studySetTab('chapters'); studySetChapter(ch); }, LONG_CHAPTER)],
  ['study people', page => page.evaluate(() => { openStudy(); studySetTab('people'); })],
  // memo (v1.6.0; v2.3.0 mockup desktop-memo.html rev 6): Study's memo tab with the due banner above the card panel,
  // ① look (note + the group's questions; the single-note card), the result B (wrong list, all correct, nothing answered)
  ['study memo (due banner)', page => page.evaluate(() => {
    const today = planTodayIso();
    localStorage.setItem('lifeuk.memoProgress', JSON.stringify({ vote: { lv: 1, due: today }, ww2: { lv: 2, due: today } }));
    openStudy(); studySetTab('memo');
  })],
  ['memo look (longest note)', page => page.evaluate(() => {
    openMemoGroup(memoGroups().filter(g => g.body).sort((a, b) => b.body.length - a.body.length)[0].id);
  })],
  ['memo look (single-note group)', page => page.evaluate(() => openMemoGroup(MEMO_SINGLE_ID))],
  ['memo result (5 wrong)', page => page.evaluate(() => {
    const wrong = allQuestions().slice(0, 5).map(it => ({ q: it.q.q, yue: it.q.yue || '', keys: [qKey(it)] }));
    Object.assign(memoView, { id: 'vote', step: 'result', result: { passed: false, lv: 1, prevLv: 2, correct: 0, total: 5, wrong } });
    showMemo();
  })],
  ['memo result (all correct)', page => page.evaluate(() => {
    Object.assign(memoView, { id: 'vote', step: 'result', result: { passed: true, lv: 2, prevLv: 1, correct: 5, total: 5, wrong: [] } });
    showMemo();
  })],
  ['memo result (nothing answered)', page => page.evaluate(() => {
    Object.assign(memoView, { id: MEMO_SINGLE_ID, step: 'result', result: { none: true } });
    showMemo();
  })],
  ['plan day', async page => { await seedPlan(page); await page.evaluate(() => openPlanDay()); }],
  ['plan run', async page => {
    await seedPlan(page, { dayN: 1 });
    await page.evaluate(() => { openPlanDay(); document.querySelector('#planTaskList .plan-task-btn').click(); });
  }],
];

(async () => {
  const b = await dt.launch();
  let failed = false;
  try {
    for (const viewport of dt.SHORT_VIEWPORTS) {
      for (const lang of dt.LANGS) {
        const { page, errors, label } = await dt.openDesktop(b, { viewport, lang, fontSize: 'large' });
        for (const [what, open] of SCREENS) {
          await open(page);
          await dt.nextFrame(page);
          const side = await dt.noHorizontalScroll(page);
          assert(side.ok, `${label} ${what}: no sideways scroll (${side.detail})`);
          const still = await dt.pageNotScrolling(page);
          if (what.startsWith('memo') || what.startsWith('study memo')) assert(still.ok, `${label} ${what}: one screen high (${still.detail})`);
          const reach = await dt.controlsReachable(page);
          assert(reach.ok && reach.count > 0, `${label} ${what}: every control reachable (${reach.detail})`);
        }
        assert(errors.length === 0, `${label}: no page errors ` + errors.join(' | '));
        await page.close();
      }
    }
    console.log('DESKTOP-SHORT PASS');
  } catch (e) {
    failed = true;
    console.error(e.message);
    console.log('DESKTOP-SHORT FAIL');
  } finally {
    await b.close();
    if (failed) process.exitCode = 1;
  }
})();
