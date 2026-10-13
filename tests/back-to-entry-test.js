const { chromium } = require('playwright-core');
const { seedLegacyDefaults } = require('./legacy-defaults'); // v1.4.2: keep the old en + small first run
const path = require('path');
// v2.0.5 (fix/quiz/back-to-entry; .proj-docs/qa/quiz-entry-back-audit.html #6–#9, #11): the quiz header's back button,
// tapped mid-session, goes back to where the session started instead of Home, on the phone and the desktop layout.
//   #6 Flagged list › Practise        → "‹ Flagged" → the Flagged list (the Result header too)
//   #7 Study fact › ▶ Practise        → "‹ Study" → Study, the same card
//   #8 Memory note › ② Test           → "‹ ① Look" → the group's ① look, nothing recorded
//   #9 Practice › Similar › Practise  → "‹ Q{n}" (named "Back to Q{n}") → the original session at the same question
//   #11 Plan reading › fact ▶ Practise → "‹ Back to the fact" → that fact's card (#screenPlanRun)
// The Home entries keep the 🏠 icon and go Home.
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

const VIEWPORTS = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };
const FACT_ID = 21; // Magna Carta: 6 distinct source questions
const MEMO_KEY = 'lifeuk.memoProgress';

const activeScreen = pg => pg.$eval('.screen.active', e => e.id);
const backOf = (pg, screen) => pg.$eval(`#${screen} .back-btn`, e => ({
  text: e.textContent.trim(), icon: e.classList.contains('icon-btn'), name: e.getAttribute('aria-label'), title: e.getAttribute('title'),
}));
const tapBack = (pg, screen) => pg.click(`#${screen} .back-btn`);
// answer the current question (right or wrong) and move to the next one, so the session is mid-way
const answerAndNext = pg => pg.evaluate(() => {
  const q = state.questions[state.current];
  state.answers[state.current] = [...q.a];
  revealAnswer();
  nextQ();
});

async function checkHomeEntry(pg) {
  await pg.evaluate(() => startDifficulty(1));
  const back = await backOf(pg, 'screenQuiz');
  assert(back.icon && back.name === 'Home', `Home entry keeps the 🏠 icon (${JSON.stringify(back)})`);
  await tapBack(pg, 'screenQuiz');
  assert(await activeScreen(pg) === 'screenHome', 'Home entry: back goes Home');
}

async function checkFlagged(pg) {
  await pg.evaluate(() => { startDifficulty(1); toggleFlag(); state.current = 1; toggleFlag(); leaveToHome(); openFlagged(); startFlaggedPractice(); });
  await answerAndNext(pg);
  const back = await backOf(pg, 'screenQuiz');
  assert(back.text === '‹ Flagged' && !back.icon, `#6 quiz header reads "‹ Flagged" (${back.text})`);
  await tapBack(pg, 'screenQuiz');
  assert(await activeScreen(pg) === 'screenFlagged', '#6 mid-session back goes to the Flagged list');
  // the Result header of a flagged practice goes back to the list too; the bottom button stays Home
  await pg.evaluate(() => { startFlaggedPractice(); state.questions.forEach((q, i) => { state.answers[i] = [...q.a]; state.revealed[i] = true; }); finishExam(); });
  const result = await backOf(pg, 'screenResult');
  assert(result.text === '‹ Flagged', `#6 Result header reads "‹ Flagged" (${result.text})`);
  await tapBack(pg, 'screenResult');
  assert(await activeScreen(pg) === 'screenFlagged', '#6 Result header back goes to the Flagged list');
  await pg.evaluate(() => { startFlaggedPractice(); state.questions.forEach((q, i) => { state.answers[i] = [...q.a]; state.revealed[i] = true; }); finishExam(); });
  await pg.click('#screenResult .another-btn');
  assert(await activeScreen(pg) === 'screenHome', '#6 Result bottom button still goes Home');
  // another set's Result keeps the 🏠
  await pg.evaluate(() => { startDifficulty(1); finishExam(); });
  assert((await backOf(pg, 'screenResult')).icon, 'a Home set Result keeps the 🏠 icon');
}

async function checkStudyFact(pg) {
  await pg.evaluate(id => { openStudy(); studySetTab('chapters'); studySetChapter(3); startFactPractice(id); }, FACT_ID);
  await answerAndNext(pg);
  const back = await backOf(pg, 'screenQuiz');
  assert(back.text === '‹ Study' && !back.icon, `#7 quiz header reads "‹ Study" (${back.text})`);
  await tapBack(pg, 'screenQuiz');
  const after = await pg.evaluate(() => ({ screen: document.querySelector('.screen.active').id, tab: study.tab, side: isSideSession() }));
  assert(after.screen === 'screenStudy' && after.tab === 'chapters' && !after.side, `#7 back goes to Study on its tab (${JSON.stringify(after)})`);
}

async function checkMemo(pg) {
  await pg.evaluate(() => { openStudy(); studySetTab('memo'); document.querySelector('[data-action=openMemoGroup]').click(); });
  const before = await pg.evaluate(k => localStorage.getItem(k), MEMO_KEY);
  await pg.evaluate(() => startMemoTest());
  await answerAndNext(pg);
  const back = await backOf(pg, 'screenQuiz');
  assert(back.text === '‹ ① Look' && !back.icon, `#8 quiz header reads "‹ ① Look" (${back.text})`);
  await tapBack(pg, 'screenQuiz');
  const after = await pg.evaluate(k => ({ screen: document.querySelector('.screen.active').id, step: memoView.step, rec: localStorage.getItem(k) }), MEMO_KEY);
  assert(after.screen === 'screenMemo' && after.step === 'look', `#8 back goes to the group's ① look (${after.screen} / ${after.step})`);
  assert(after.rec === before, '#8 leaving mid-test records nothing');
}

// Easy: the first (or, fromEnd, the last: a two-digit number) question with similar questions, answered; then Similar
const startSimilarFrom = (pg, fromEnd) => pg.evaluate(last => {
  startDifficulty(1);
  const order = state.questions.map((_, i) => i);
  if (last) order.reverse();
  state.current = order.find(i => similarKeys(state.questions[i]).length);
  const q = state.questions[state.current];
  state.answers[state.current] = [...q.a];
  revealAnswer();
  window.__origQuestions = state.questions;
  return state.current;
}, fromEnd);

async function checkSimilar(pg) {
  const start = await startSimilarFrom(pg, false);
  await pg.evaluate(() => startSimilarPractice());
  const back = await backOf(pg, 'screenQuiz');
  // W-073: the short "‹ Q{n}" on screen, the full words as its accessible name (they contain the visible "Q{n}")
  assert(back.text === `‹ Q${start + 1}` && !back.icon, `#9 quiz header reads "‹ Q${start + 1}" (${back.text})`);
  assert(back.name === `Back to Q${start + 1}` && back.title === back.name, `#9 the back button is named "Back to Q${start + 1}" (${JSON.stringify(back)})`);
  await tapBack(pg, 'screenQuiz');
  const after = await pg.evaluate(() => ({ screen: document.querySelector('.screen.active').id, same: state.questions === window.__origQuestions, cur: state.current, side: isSideSession() }));
  assert(after.screen === 'screenQuiz' && after.same && after.cur === start && !after.side, `#9 back returns to the original session at Q${start + 1} (${JSON.stringify(after)})`);
  assert((await backOf(pg, 'screenQuiz')).icon, '#9 the original session shows the 🏠 again');
}

async function checkPlanFact(pg) {
  await pg.evaluate(() => { openPlanGoal(); byId('planCreateBtn').click(); openPlanDay(null); document.querySelector('#planTaskList [data-action=planOpenTask]').click(); });
  const pos = await pg.evaluate(() => { planStepFact(1); return planRunView.pos; });
  await pg.click('#planRunBody [data-action=planPractiseFact]');
  assert(await activeScreen(pg) === 'screenQuiz', '#11 a fact\'s ▶ Practise opens the quiz');
  const back = await backOf(pg, 'screenQuiz');
  assert(back.text === '‹ Back to the fact', `#11 quiz header reads "‹ Back to the fact" (${back.text})`);
  await tapBack(pg, 'screenQuiz');
  const after = await pg.evaluate(() => ({ screen: document.querySelector('.screen.active').id, view: planRunView && planRunView.kind, pos: planRunView && planRunView.pos }));
  assert(after.screen === 'screenPlanRun' && after.view === 'facts' && after.pos === pos, `#11 back goes to the same fact card (${JSON.stringify(after)})`);
  // a whole practice task (the reading's pair, G3) keeps "‹ Today's tasks" and goes back to the day
  await pg.evaluate(() => {
    const today = planTodayIso(), day = planDayAt(planLoad(), today);
    planOpenTask(today, day.tasks.findIndex(task => task.type === PLAN_TASK.practice));
  });
  assert(await activeScreen(pg) === 'screenQuiz', 'a plan practice task opens the quiz');
  const task = await backOf(pg, 'screenQuiz');
  assert(task.text === "‹ Today's tasks", `a plan practice task keeps "‹ Today's tasks" (${task.text})`);
  await tapBack(pg, 'screenQuiz');
  assert(await activeScreen(pg) === 'screenPlanDay', 'a plan practice task goes back to the day');
}

// W-073: 320px, English, large text, a two-digit question: the Similar header fits (no sideways page scroll)
async function checkSimilarNarrow(b) {
  const ctx = await b.newContext({ viewport: { width: 320, height: 640 } });
  const pg = await ctx.newPage();
  const errors = [];
  pg.on('pageerror', e => errors.push(e.message));
  await pg.goto(APP_URL);
  await pg.evaluate(() => setFontSize('large'));
  const start = await startSimilarFrom(pg, true);
  await pg.evaluate(() => startSimilarPractice());
  const r = await pg.evaluate(() => ({ large: document.documentElement.dataset.fontSize, page: document.documentElement.scrollWidth, vw: window.innerWidth,
    header: [byId('screenQuiz').querySelector('.quiz-header')].map(h => h && h.scrollWidth <= h.clientWidth)[0] }));
  const back = await backOf(pg, 'screenQuiz');
  assert(start >= 9 && back.text === `‹ Q${start + 1}` && r.large === 'large', `320px en large: Similar from Q${start + 1} reads "${back.text}"`);
  assert(r.page <= r.vw && r.header !== false, `W-073 320px en large: no sideways scroll (${JSON.stringify(r)})`);
  assert(errors.length === 0, `320px: no page errors (${errors.join(' | ')})`);
  await ctx.close();
}

(async () => {
  const b = seedLegacyDefaults(await chromium.launch(launchOpts));
  try {
    for (const [name, viewport] of Object.entries(VIEWPORTS)) {
      for (const check of [checkHomeEntry, checkFlagged, checkStudyFact, checkMemo, checkSimilar, checkPlanFact]) {
        const ctx = await b.newContext({ viewport });
        const pg = await ctx.newPage();
        const errors = [];
        pg.on('pageerror', e => errors.push(e.message));
        await pg.goto(APP_URL);
        console.log(`-- ${name}: ${check.name}`);
        await check(pg);
        assert(errors.length === 0, `${name} ${check.name}: no page errors (${errors.join(' | ')})`);
        await ctx.close();
      }
    }
    await checkSimilarNarrow(b);
    console.log('PASS');
  } finally {
    await b.close();
  }
})().catch(e => { console.error(e.message); process.exit(1); });
