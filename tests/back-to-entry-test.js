const { chromium } = require('playwright-core');
const { seedLegacyDefaults } = require('./legacy-defaults'); // v1.4.2: keep the old en + small first run
const path = require('path');
// v2.1.1 (fix/quiz/back-to-entry; .proj-docs/qa/quiz-entry-back-audit.html #6–#9, #11): the quiz header's back button,
// tapped mid-session, goes back to where the session started instead of Home, on the phone and the desktop layout.
// v1.6.1 rule (main): the words carry no glyph; "‹" below is the chevronLeft line icon before them (backOf .chevron).
//   #6 Flagged list › Practise        → "‹ Flagged" → the Flagged list (the Result header too)
//   #7 Study fact › ▶ Practise        → "‹ Study" → Study, the same card
//   #8 Memory note › ② Test           → "‹ Memory" (main's C2 setQuizBackMemo) → the group's look view, nothing recorded
//   #9 Practice › Similar › Practise  → "‹ Q{n}" (named "Back to Q{n}") → the original session at the same question
//   #11 Plan reading › fact ▶ Practise → "‹ Back" (named "Back to the fact") → that fact's card (#screenPlanRun)
// The Home entries keep the 🏠 icon and go Home; an exam asks first. Also (S-259): zh-HK labels + a language switch,
// Similar inside a Flagged practice (back twice → the list), 320px en large text (W-074), focus after back (S-258).
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
  // the leading line icon of a text back button (v1.6.1: no glyph in the words)
  chevron: !!e.querySelector(':scope > svg.line-icon[data-icon-name="chevronLeft"]:first-child'),
}));
// a text back button: these words (no glyph) after the chevron line icon
const isTextBack = (back, words) => back.text === words && back.chevron && !back.icon;
// the reading screen's own back button (#planRunBack, not .back-btn)
const planRunBackOf = pg => pg.$eval('#planRunBack', e => ({ text: e.textContent.trim(), name: e.getAttribute('aria-label'), title: e.getAttribute('title') }));
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
  assert(isTextBack(back, 'Flagged'), `#6 quiz header reads "‹ Flagged" (${back.text})`);
  await tapBack(pg, 'screenQuiz');
  assert(await activeScreen(pg) === 'screenFlagged', '#6 mid-session back goes to the Flagged list');
  // S-258: focus lands on the list's Practise button (keyboard / screen reader users are not left on <body>)
  assert(await pg.evaluate(() => document.activeElement && document.activeElement.id) === 'flaggedStart', '#6 focus is on the Flagged Practise button');
  // the Result header of a flagged practice goes back to the list too; the bottom button stays Home
  await pg.evaluate(() => { startFlaggedPractice(); state.questions.forEach((q, i) => { state.answers[i] = [...q.a]; state.revealed[i] = true; }); finishExam(); });
  const result = await backOf(pg, 'screenResult');
  assert(isTextBack(result, 'Flagged'), `#6 Result header reads "‹ Flagged" (${result.text})`);
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
  assert(isTextBack(back, 'Study'), `#7 quiz header reads "‹ Study" (${back.text})`);
  await tapBack(pg, 'screenQuiz');
  const after = await pg.evaluate(() => ({ screen: document.querySelector('.screen.active').id, tab: study.tab, side: isSideSession() }));
  assert(after.screen === 'screenStudy' && after.tab === 'chapters' && !after.side, `#7 back goes to Study on its tab (${JSON.stringify(after)})`);
  // the same fact card flashes and is in view (flashStudyFact, as ↩ Back)
  const card = await pg.evaluate(id => {
    const el = document.querySelector(`#studyContent .fact[data-fact-id="${id}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { flash: el.classList.contains('flash'), inView: r.bottom > 0 && r.top < window.innerHeight };
  }, FACT_ID);
  assert(card && card.flash && card.inView, `#7 back flashes the same fact card in view (${JSON.stringify(card)})`);
}

async function checkMemo(pg) {
  await pg.evaluate(() => { openStudy(); studySetTab('memo'); document.querySelector('[data-action=openMemoGroup]').click(); });
  const before = await pg.evaluate(k => localStorage.getItem(k), MEMO_KEY);
  await pg.evaluate(() => startMemoTest());
  await answerAndNext(pg);
  const back = await backOf(pg, 'screenQuiz');
  assert(isTextBack(back, 'Memory') && back.name === null, `#8 quiz header reads "‹ Memory" (${JSON.stringify(back)})`);
  await tapBack(pg, 'screenQuiz');
  const after = await pg.evaluate(k => ({ screen: document.querySelector('.screen.active').id, step: memoView.step, rec: localStorage.getItem(k) }), MEMO_KEY);
  assert(after.screen === 'screenMemo' && after.step === 'look', `#8 back goes to the group's look view (${after.screen} / ${after.step})`);
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
  // W-074: the short "‹ Q{n}" on screen, the full words as its accessible name (they contain the visible "Q{n}")
  assert(isTextBack(back, `Q${start + 1}`), `#9 quiz header reads "‹ Q${start + 1}" (${back.text})`);
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
  assert(isTextBack(back, 'Back') && back.name === 'Back to the fact' && back.title === 'Back to the fact', `#11 quiz header reads "‹ Back", named "Back to the fact" (${JSON.stringify(back)})`);
  await tapBack(pg, 'screenQuiz');
  const after = await pg.evaluate(() => ({ screen: document.querySelector('.screen.active').id, view: planRunView && planRunView.kind, pos: planRunView && planRunView.pos }));
  assert(after.screen === 'screenPlanRun' && after.view === 'facts' && after.pos === pos, `#11 back goes to the same fact card (${JSON.stringify(after)})`);
  // S-258: focus goes back to the card's ▶ Practise (the control that opened the quiz)
  const focus = await pg.evaluate(() => { const el = document.activeElement; return { action: el && el.dataset.action, inBody: byId('planRunBody').contains(el) }; });
  assert(focus.action === 'planPractiseFact' && focus.inBody, `#11 focus is on the fact card's ▶ Practise (${JSON.stringify(focus)})`);
  // W-077 (WCAG 2.5.3 Label in Name): the reading's "‹ Back" is named "Back to today's tasks" (the visible word first)
  const run = await planRunBackOf(pg);
  assert(run.text === 'Back' && run.name === "Back to today's tasks" && run.title === run.name, `#planRunBack reads "‹ Back", named "Back to today's tasks" (${JSON.stringify(run)})`);
  // a whole practice task (the reading's pair, G3) reads "‹ Back" (named "Back to today's tasks", W-077) and goes back to the day
  await pg.evaluate(() => {
    const today = planTodayIso(), day = planDayAt(planLoad(), today);
    planOpenTask(today, day.tasks.findIndex(task => task.type === PLAN_TASK.practice));
  });
  assert(await activeScreen(pg) === 'screenQuiz', 'a plan practice task opens the quiz');
  const task = await backOf(pg, 'screenQuiz');
  assert(isTextBack(task, 'Back') && task.name === "Back to today's tasks" && task.title === task.name, `a plan practice task reads "‹ Back", named "Back to today's tasks" (${JSON.stringify(task)})`);
  await tapBack(pg, 'screenQuiz');
  assert(await activeScreen(pg) === 'screenPlanDay', 'a plan practice task goes back to the day');
}

// S-259: zh-HK labels, and a language switch redraws the label in place (rerenderCurrentScreen)
async function checkZhHk(pg) {
  await pg.evaluate(() => setLang('zh-HK'));
  await pg.evaluate(() => { startDifficulty(1); toggleFlag(); state.current = 1; toggleFlag(); leaveToHome(); openFlagged(); startFlaggedPractice(); });
  assert(isTextBack(await backOf(pg, 'screenQuiz'), '已標記'), 'zh-HK #6 quiz header reads "‹ 已標記"');
  await pg.evaluate(() => setLang('en'));
  assert(isTextBack(await backOf(pg, 'screenQuiz'), 'Flagged'), 'zh-HK → en: the Flagged label redraws as "‹ Flagged"');
  await pg.evaluate(() => setLang('zh-HK'));
  await pg.evaluate(id => { openStudy(); studySetTab('chapters'); studySetChapter(3); startFactPractice(id); }, FACT_ID);
  assert(isTextBack(await backOf(pg, 'screenQuiz'), '溫習'), 'zh-HK #7 quiz header reads "‹ 溫習"');
  await pg.evaluate(() => { leaveToHome(); openStudy(); studySetTab('memo'); document.querySelector('[data-action=openMemoGroup]').click(); startMemoTest(); });
  assert(isTextBack(await backOf(pg, 'screenQuiz'), '記憶法'), 'zh-HK #8 quiz header reads "‹ 記憶法"');
  await pg.evaluate(() => leaveToHome());
  const start = await startSimilarFrom(pg, false);
  await pg.evaluate(() => startSimilarPractice());
  const zh = await backOf(pg, 'screenQuiz');
  assert(isTextBack(zh, `第 ${start + 1} 題`) && zh.name === `返回第 ${start + 1} 題` && zh.title === zh.name, `zh-HK #9 reads "‹ 第 ${start + 1} 題", named "返回第 ${start + 1} 題" (${JSON.stringify(zh)})`);
  await pg.evaluate(() => setLang('en'));
  const en = await backOf(pg, 'screenQuiz');
  assert(isTextBack(en, `Q${start + 1}`) && en.name === `Back to Q${start + 1}`, `zh-HK → en: the Similar label and its name redraw (${JSON.stringify(en)})`);
  await pg.evaluate(() => setLang('zh-HK'));
  await pg.evaluate(() => { leaveToHome(); openPlanGoal(); byId('planCreateBtn').click(); openPlanDay(null); document.querySelector('#planTaskList [data-action=planOpenTask]').click(); });
  await pg.click('#planRunBody [data-action=planPractiseFact]');
  const zhFact = await backOf(pg, 'screenQuiz');
  assert(isTextBack(zhFact, '返回') && zhFact.name === '返回知識點', `zh-HK #11 quiz header reads "‹ 返回", named "返回知識點" (${JSON.stringify(zhFact)})`);
  // W-077: the day's names start with the visible 「返回」 too
  await tapBack(pg, 'screenQuiz');
  const zhRun = await planRunBackOf(pg);
  assert(zhRun.text === '返回' && zhRun.name === '返回今日任務' && zhRun.title === zhRun.name, `zh-HK #planRunBack reads "‹ 返回", named "返回今日任務" (${JSON.stringify(zhRun)})`);
  await pg.evaluate(() => { const today = planTodayIso(); planOpenTask(today, planDayAt(planLoad(), today).tasks.findIndex(task => task.type === PLAN_TASK.practice)); });
  const zhTask = await backOf(pg, 'screenQuiz');
  assert(isTextBack(zhTask, '返回') && zhTask.name === '返回今日任務' && zhTask.title === zhTask.name, `zh-HK plan practice task reads "‹ 返回", named "返回今日任務" (${JSON.stringify(zhTask)})`);
}

// S-259: Similar inside a Flagged practice: back → the Flagged session at the same question ("‹ Flagged"), back → the list
async function checkSimilarInFlagged(pg) {
  const start = await pg.evaluate(() => {
    startDifficulty(1);
    const withSimilar = state.questions.map((_, i) => i).filter(i => similarKeys(state.questions[i]).length).slice(0, 2);
    withSimilar.forEach(i => { state.current = i; toggleFlag(); });
    leaveToHome(); openFlagged(); startFlaggedPractice();
    const q = state.questions[0];
    state.answers[0] = [...q.a];
    revealAnswer();
    window.__origQuestions = state.questions;
    return state.current;
  });
  await pg.evaluate(() => startSimilarPractice());
  assert(isTextBack(await backOf(pg, 'screenQuiz'), `Q${start + 1}`), 'Similar in Flagged reads "‹ Q1"');
  await tapBack(pg, 'screenQuiz');
  const back1 = await pg.evaluate(() => ({ screen: document.querySelector('.screen.active').id, same: state.questions === window.__origQuestions, cur: state.current }));
  assert(back1.screen === 'screenQuiz' && back1.same && back1.cur === start, `back once → the Flagged session at Q${start + 1} (${JSON.stringify(back1)})`);
  assert(isTextBack(await backOf(pg, 'screenQuiz'), 'Flagged'), 'the Flagged session reads "‹ Flagged" again');
  await pg.waitForTimeout(400); // a later, deliberate tap (past SCREEN_CHANGE_CLICK_GUARD_MS: a quick second tap is eaten)
  await tapBack(pg, 'screenQuiz');
  assert(await activeScreen(pg) === 'screenFlagged', 'back twice → the Flagged list');
}

// S-259: a timed exam keeps the 🏠, and back asks first (goHome's confirm), still on the quiz
async function checkExam(pg) {
  await pg.evaluate(() => { pendingMode = EXAM_MODE; startExam(1); });
  const back = await backOf(pg, 'screenQuiz');
  assert(back.icon && back.name === 'Home', `exam: the header is the 🏠 (${JSON.stringify(back)})`);
  await tapBack(pg, 'screenQuiz');
  const r = await pg.evaluate(() => ({ modal: byId('confirmModal').classList.contains('show'), screen: document.querySelector('.screen.active').id }));
  assert(r.modal && r.screen === 'screenQuiz', `exam: back opens the leave confirm, still on the quiz (${JSON.stringify(r)})`);
  await pg.keyboard.press('Escape');
}

// W-074: 320px, English, large text, a two-digit question: the Similar header fits (no sideways page scroll)
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
  assert(start >= 9 && isTextBack(back, `Q${start + 1}`) && r.large === 'large', `320px en large: Similar from Q${start + 1} reads "${back.text}"`);
  assert(r.page <= r.vw && r.header !== false, `W-074 320px en large: no sideways scroll (${JSON.stringify(r)})`);
  assert(errors.length === 0, `320px: no page errors (${errors.join(' | ')})`);
  await ctx.close();
}

(async () => {
  const b = seedLegacyDefaults(await chromium.launch(launchOpts));
  try {
    for (const [name, viewport] of Object.entries(VIEWPORTS)) {
      for (const check of [checkHomeEntry, checkFlagged, checkStudyFact, checkMemo, checkSimilar, checkPlanFact, checkZhHk, checkSimilarInFlagged, checkExam]) {
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
