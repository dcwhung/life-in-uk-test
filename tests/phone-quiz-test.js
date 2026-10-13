// v2.1.0 Quiz on a phone (390 × 844; mockup mockups/v2.0.0/desktop-memo.html rev 5 / rev 6 placeQuizPhone, decision log
// .proj-docs/plans/2026-10-13_grill_desktop-memo.md P6: every quiz, not only the memo test):
// - #screenQuiz is one screen high, the page never scrolls (no sideways scroll either)
// - the quiz header on top and the question card (dots, number, question, translation) stay put; everything after the
//   card (options, answer box, notes, Similar panel) is one panel that scrolls on its own with top / bottom fades
// - Prev / Next (.nav-row) always at the bottom of the screen
// - every quiz: Practice (before / after answering), Exam (timer in the header, Submit on the last question), the memo
//   test (a side session), a study plan task (its notes); EN / 中 × small / large text; every control reachable
// - a new question starts its panel at the top
const dt = require('./desktop-helpers');
const { assert } = dt;

const EXAM_ONE = 1;
const BOTTOM_ROOM = 40; // the nav row sits in the screen's last 40px (main's bottom padding + rounding)
const GOAL = { dailyMins: 120, restDays: [0], level: 'none' };
const PANEL = '#screenQuiz .quiz-scroll > .fit-panel';

const seedPlan = page => page.evaluate(goal => {
  const today = planTodayIso();
  writeStudyPlan(buildPlan({ ...goal, examDate: isoAddDays(today, 21) }, today));
  writePlanLog(planEmptyLog());
}, GOAL);

// [what, open(page), { scroll: the panel overflows, timer, submit, note: a plan note element shown }]
const CASES = [
  ['practice, unanswered', page => page.evaluate(n => { pendingMode = 'practice'; startExam(n); }, EXAM_ONE), {}],
  ['practice, answered', page => page.evaluate(() => {
    const q = state.questions[state.current];
    state.answers[state.current] = [...q.a];
    revealAnswer();
  }), { scroll: true }],
  ['exam, first question', page => page.evaluate(n => { pendingMode = 'exam'; startExam(n); }, EXAM_ONE), { timer: true }],
  ['exam, last question', page => page.evaluate(() => goToQuestion(state.questions.length - 1)), { timer: true, submit: true }],
  ['memo test', page => page.evaluate(() => { openStudy(); studySetTab('memo'); openMemoGroup('vote'); startMemoTest(); }), {}],
  ['memo test, answered', page => page.evaluate(() => {
    const q = state.questions[state.current];
    state.answers[state.current] = [...q.a];
    revealAnswer();
  }), { scroll: true }],
  ['plan practice task, answered', async page => {
    await seedPlan(page);
    await page.evaluate(() => {
      const today = planTodayIso(), day = planLoad().days.find(d => d.date === today);
      planOpenTask(today, day.tasks.findIndex(t => t.type === 'practice'));
      const q = state.questions[state.current];
      state.answers[state.current] = [...q.a];
      revealAnswer();
    });
  }, { scroll: true, note: 'planPairNote' }],
];

const quizState = page => page.evaluate(sel => {
  const box = el => el.getBoundingClientRect();
  const screen = byId('screenQuiz'), panel = document.querySelector(sel), wrap = panel && panel.parentElement;
  const card = screen.querySelector('.q-card'), nav = screen.querySelector('.nav-row'), head = screen.querySelector('.quiz-header');
  const shown = el => !!el && el.getClientRects().length > 0 && el.checkVisibility();
  return {
    panel: panel && { top: box(panel).top, bottom: box(panel).bottom, h: panel.clientHeight, scrolls: panel.scrollHeight > panel.clientHeight + 1,
      overflow: getComputedStyle(panel).overflowY, up: wrap.classList.contains('can-up'), down: wrap.classList.contains('can-down'), scrollTop: panel.scrollTop },
    inPanel: ['optionsContainer', 'answerBox', 'similarBox', 'planPairNote'].every(id => !byId(id) || panel.contains(byId(id))),
    cardTop: box(card).top, cardBottom: box(card).bottom, headBottom: box(head).bottom,
    navTop: box(nav).top, navBottom: box(nav).bottom, viewH: innerHeight,
    timer: shown(byId('examTimer')), next: byId('nextBtn').textContent, submitText: t('exam.submit'),
    planPairNote: shown(byId('planPairNote')),
  };
}, PANEL);
const scrollPanel = (page, to) => page.$eval(PANEL, (el, y) => { el.scrollTop = y === 'end' ? el.scrollHeight : y; el.dispatchEvent(new Event('scroll')); }, to);

async function checkCase(page, label, what, opts) {
  await dt.nextFrame(page);
  const side = await dt.noHorizontalScroll(page);
  assert(side.ok, `${label} ${what}: no sideways scroll (${side.detail})`);
  const still = await dt.pageNotScrolling(page);
  assert(still.ok, `${label} ${what}: one screen high, the page does not scroll (${still.detail})`);
  const a = await quizState(page);
  assert(a.panel && a.inPanel && a.panel.h > 0, `${label} ${what}: options, answer, notes and Similar in one panel (${a.panel && a.panel.h}px)`);
  assert(a.cardTop >= a.headBottom && a.panel.top >= a.cardBottom && a.navTop >= a.panel.bottom, `${label} ${what}: header → question card → panel → Prev / Next`);
  assert(a.navBottom <= a.viewH && a.navBottom >= a.viewH - BOTTOM_ROOM, `${label} ${what}: Prev / Next at the bottom (${Math.round(a.navBottom)} / ${a.viewH})`);
  if (opts.timer) assert(a.timer, `${label} ${what}: the exam timer shows in the header`);
  if (opts.submit) assert(a.next === a.submitText, `${label} ${what}: the last question's button reads "${a.submitText}" (${a.next})`);
  if (opts.note) assert(a[opts.note], `${label} ${what}: the plan note #${opts.note} shows`);
  if (opts.scroll) assert(a.panel.scrolls, `${label} ${what}: the long content overflows its panel`);
  if (a.panel.scrolls) {
    assert(['auto', 'scroll'].includes(a.panel.overflow) && !a.panel.up && a.panel.down, `${label} ${what}: the panel scrolls on its own, fading at the bottom`);
    await scrollPanel(page, 'end');
    const b = await quizState(page);
    assert(b.panel.up && !b.panel.down && Math.abs(b.cardTop - a.cardTop) <= 1 && Math.abs(b.navTop - a.navTop) <= 1 && (await dt.pageNotScrolling(page)).ok,
      `${label} ${what}: scrolled to its end: top fade only, the question card and Prev / Next stay put`);
    await scrollPanel(page, 0);
  }
  const reach = await dt.controlsReachable(page);
  assert(reach.ok && reach.count > 0, `${label} ${what}: every control reachable (${reach.detail})`);
}

// a new question starts its panel at the top (the panel is kept from question to question)
async function checkNewQuestionTop(b) {
  const { page, errors } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.phone, fontSize: 'large' });
  await page.evaluate(n => { pendingMode = 'practice'; startExam(n); const q = state.questions[0]; state.answers[0] = [...q.a]; revealAnswer(); }, EXAM_ONE);
  await dt.nextFrame(page);
  await scrollPanel(page, 'end');
  assert((await quizState(page)).panel.scrollTop > 0, 'practice answered: the panel scrolled down');
  await page.click('#nextBtn');
  await dt.nextFrame(page);
  const n = await quizState(page);
  assert(n.panel.scrollTop === 0 && !n.panel.up, `Next: the new question's panel starts at the top (${n.panel.scrollTop})`);
  await page.click('#prevBtn');
  await dt.nextFrame(page);
  assert((await quizState(page)).panel.scrollTop === 0, 'Prev: back at the top too');
  assert(errors.length === 0, 'new question: no page errors ' + errors.join(' | '));
  await page.close();
}

// the desktop keeps its own layout: the phone panel draws nothing from 1024px, and back below it
async function checkBreakpoint(b) {
  const { page, errors } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.phone });
  await page.evaluate(n => { pendingMode = 'practice'; startExam(n); }, EXAM_ONE);
  await dt.setViewport(page, dt.VIEWPORTS.wide);
  const desk = await page.evaluate(() => ({ cols: !!document.querySelector('#screenQuiz .quiz-cols:not([hidden])'),
    phonePanel: document.querySelector('#screenQuiz .quiz-scroll').getBoundingClientRect().height,
    inCols: ['optionsContainer', 'answerBox', 'similarBox'].every(id => byId(id).closest('.quiz-cols')) }));
  assert(desk.cols && desk.inCols && desk.phonePanel === 0 && (await dt.pageNotScrolling(page)).ok, '1280px: the desktop columns hold the parts, the phone panel is empty (0px): ' + JSON.stringify(desk));
  await dt.setViewport(page, dt.VIEWPORTS.phone);
  await checkCase(page, '390 again', 'practice, unanswered', {});
  assert(errors.length === 0, 'breakpoint: no page errors ' + errors.join(' | '));
  await page.close();
}

(async () => {
  const b = await dt.launch();
  let failed = false;
  try {
    for (const lang of dt.LANGS) for (const fontSize of dt.FONT_SIZES) {
      const { page, errors, label } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.phone, lang, fontSize });
      for (const [what, open, opts] of CASES) {
        await open(page);
        await checkCase(page, label, what, opts);
      }
      assert(errors.length === 0, `${label}: no page errors ` + errors.join(' | '));
      await page.close();
    }
    await checkNewQuestionTop(b);
    await checkBreakpoint(b);
    console.log('PHONE-QUIZ PASS');
  } catch (e) {
    failed = true;
    console.error(e.message);
    console.log('PHONE-QUIZ FAIL');
  } finally {
    await b.close();
    if (failed) process.exitCode = 1;
  }
})();
