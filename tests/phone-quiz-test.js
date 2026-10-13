// v2.2.0 Quiz on a phone (390 × 844; mockup mockups/v2.0.0/desktop-memo.html rev 5 / rev 6 placeQuizPhone, decision log
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

// C-007 / W-078: short phones (≥ 500px high, so the one-screen layout is on). The fixed question card may leave the
// panel little room: then the screen falls back to the scrolling page (main's layout), re-checked on every render.
// Every question of Exam 1 with its translation shown (the tallest cards), large text: either the panel keeps at least
// MIN_PANEL_PX (about two option rows) or the screen falls back; every option and Prev / Next can be reached
const MIN_PANEL_PX = 120;
const SHORT_PHONES = [
  { viewport: { width: 375, height: 553 }, fontSize: 'small' }, // iPhone SE / 8 in Safari with its bars
  { viewport: { width: 375, height: 553 }, fontSize: 'large' },
  { viewport: { width: 320, height: 568 }, fontSize: 'large' },
  { viewport: { width: 360, height: 640 }, fontSize: 'large' },
];
const LANDSCAPE = { width: 844, height: 390 }; // below the 500px floor: the one-screen layout is off
const TIGHT = { width: 360, height: 520 }; // large text + translation: no room for the panel at all
const fitState = page => page.evaluate(sel => {
  const screen = byId('screenQuiz'), panel = document.querySelector(sel), el = document.scrollingElement;
  return { fit: getComputedStyle(screen).display === 'flex', panelH: panel ? panel.clientHeight : 0,
    pageScrolls: el.scrollHeight > el.clientHeight + 1, sideways: el.scrollWidth > el.clientWidth + 1 };
}, PANEL);
async function checkShortPhones(b) {
  for (const { viewport, fontSize } of SHORT_PHONES) {
    const { page, errors, label } = await dt.openDesktop(b, { viewport, lang: 'zh-HK', fontSize, translation: true });
    let fits = 0, falls = 0;
    for (const mode of ['practice', 'exam']) {
      await page.evaluate(([m, n]) => { pendingMode = m; startExam(n); }, [mode, EXAM_ONE]);
      const total = await page.evaluate(() => state.questions.length);
      for (let i = 0; i < total; i++) {
        await page.evaluate(k => { goToQuestion(k); if (state.mode === 'practice') { state.yueShown[k] = true; renderQuestion(); } }, i);
        await dt.nextFrame(page);
        const f = await fitState(page);
        assert(!f.sideways, `${label} ${mode} Q${i + 1}: no sideways scroll`);
        if (f.fit) fits++; else falls++;
        assert(!f.fit || f.panelH >= MIN_PANEL_PX, `${label} ${mode} Q${i + 1}: one screen high only with room for the options (panel ${f.panelH}px ≥ ${MIN_PANEL_PX}), else the page scrolls`);
        const reach = await dt.controlsReachable(page, '#screenQuiz .options, #screenQuiz .nav-row');
        assert(reach.ok && reach.count > 0, `${label} ${mode} Q${i + 1}: every option and Prev / Next reachable (${reach.detail})`);
      }
    }
    console.log(`  ${label}: ${fits} one-screen, ${falls} scrolling-page renders`);
    assert(errors.length === 0, `${label} short phone: no page errors ` + errors.join(' | '));
    await page.close();
  }
}
// the fallback itself: no room → the page scrolls as before v2.2.0 (the card, options and Prev / Next in the page flow);
// a roomy screen again → one screen high again (re-checked on resize); a landscape phone (< 500px high) never goes one-screen
async function checkFallback(b) {
  const { page, errors } = await dt.openDesktop(b, { viewport: TIGHT, lang: 'zh-HK', fontSize: 'large', translation: true });
  await page.evaluate(n => { pendingMode = 'practice'; startExam(n); state.yueShown[0] = true; renderQuestion(); }, EXAM_ONE);
  await dt.nextFrame(page);
  let f = await fitState(page);
  assert(!f.fit && f.pageScrolls, `${TIGHT.width}×${TIGHT.height} large: no room, the page scrolls instead (${JSON.stringify(f)})`);
  const reach = await dt.controlsReachable(page);
  assert(reach.ok, `${TIGHT.width}×${TIGHT.height}: every control reachable on the scrolling page (${reach.detail})`);
  await dt.setViewport(page, dt.VIEWPORTS.phone);
  f = await fitState(page);
  assert(f.fit && f.panelH >= MIN_PANEL_PX && !f.pageScrolls, `390×844 after a resize: one screen high again (${JSON.stringify(f)})`);
  await dt.setViewport(page, LANDSCAPE);
  f = await fitState(page);
  assert(!f.fit, `${LANDSCAPE.width}×${LANDSCAPE.height} (landscape, < 500px high): the page layout (${JSON.stringify(f)})`);
  assert((await dt.controlsReachable(page)).ok, 'landscape: every control reachable');
  assert(errors.length === 0, 'fallback: no page errors ' + errors.join(' | '));
  await page.close();
}

// W-082 (user 2026-10-13, option A): near the threshold the card height decides per question, so the layout would flip
// between one screen and the scrolling page from question to question (Prev / Next jumping). The choice is made once per
// quiz session: once a render falls back, the rest of the session keeps the scrolling page; a new session decides
// afresh. Every question of Exam 1 (Practice, translation shown), large / small text: the mode only ever goes one
// screen → page, never back
const LATCH_PHONES = [
  { viewport: { width: 375, height: 667 }, fontSize: 'large' }, // iPhone SE / 8 from the home screen
  { viewport: { width: 375, height: 667 }, fontSize: 'small' },
  { viewport: { width: 390, height: 664 }, fontSize: 'large' },
];
const modeRun = async (page, { showYue }) => {
  const total = await page.evaluate(() => state.questions.length);
  let run = '';
  for (let i = 0; i < total; i++) {
    await page.evaluate(([k, y]) => { goToQuestion(k); if (y) { state.yueShown[k] = true; renderQuestion(); } }, [i, showYue]);
    await dt.nextFrame(page);
    run += (await fitState(page)).fit ? 'F' : 's';
  }
  return run;
};
async function checkSessionLatch(b) {
  let fellBack = false;
  for (const { viewport, fontSize } of LATCH_PHONES) {
    const { page, errors, label } = await dt.openDesktop(b, { viewport, lang: 'zh-HK', fontSize, translation: true });
    await page.evaluate(n => { pendingMode = 'practice'; startExam(n); }, EXAM_ONE);
    const run = await modeRun(page, { showYue: true });
    fellBack = fellBack || run.includes('s');
    assert(!/s.*F/.test(run), `${label} W-082: within a session the layout never goes back to one screen after a fallback (${run})`);
    // a new session decides afresh (the short cards without translation fit again)
    await page.evaluate(n => { pendingMode = 'practice'; startExam(n); }, EXAM_ONE);
    const fresh = await modeRun(page, { showYue: false });
    assert(!/s.*F/.test(fresh) && (fontSize === 'large' || fresh.startsWith('F')), `${label} W-082: a new session decides again (${fresh})`);
    assert(errors.length === 0, `${label} latch: no page errors ` + errors.join(' | '));
    await page.close();
  }
  assert(fellBack, 'W-082: the matrix has a session that falls back (the latch is exercised)');
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
    await checkShortPhones(b);
    await checkFallback(b);
    await checkSessionLatch(b);
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
