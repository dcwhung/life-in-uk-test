const { chromium } = require('playwright-core');
const path = require('path');
// v0.64 (CUI-0011): a double tap / double click on a button that opens a new screen must not let the
// second tap act on that screen. "▶ Practise" on a Study fact card and the Home Practice › By Exam
// cells open the quiz; the second tap used to land on an option and answer Question 1 (practiceStreak
// + wrongList written). actions.js ignores pointer clicks for SCREEN_CHANGE_CLICK_GUARD_MS after a
// click changed the screen (or started a new session); keyboard, same-screen repeats and the
// confirm modal are not affected.
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

const FACT_ID = 21;        // Magna Carta, chapter 3, 8 source questions
const EXAM_CELL = 1;       // Home Practice › By Exam cell
const SECOND_TAP_MS = 50;  // gap between the two taps of a double tap
const GUARD_FALLBACK_MS = 350; // before the fix the const does not exist (Red run)
const SETTLE_EXTRA_MS = 100;   // wait past the guard for the "normal flow" checks

const sleep = ms => new Promise(r => setTimeout(r, ms));
const guardMs = pg => pg.evaluate(f => (typeof SCREEN_CHANGE_CLICK_GUARD_MS === 'number' ? SCREEN_CHANGE_CLICK_GUARD_MS : f), GUARD_FALLBACK_MS);
const factBtn = `#studyContent [data-action="startFactPractice"][data-arg="${FACT_ID}"]`;
const examBtn = `#screenHome [data-action="startExam"][data-arg="${EXAM_CELL}"]`;

// what a stray answer would leave behind
const practiceWrites = pg => pg.evaluate(() => ({
  answered: Object.keys(state.answers).length,
  revealed: Object.keys(state.revealed).length,
  streak: localStorage.getItem(STREAK_LS),
  wrong: localStorage.getItem(WRONG_LS),
}));
const clean = w => w.answered === 0 && w.revealed === 0 && w.streak === null && w.wrong === null;

// Study › Chapters › Ch 3 with nothing stored
const openStudyCh3 = pg => pg.evaluate(() => {
  localStorage.clear(); streaks = {}; wrongList = {};
  clearSideSession(); openStudy(); studySetTab('chapters'); studySetChapter(3);
});
// Home › Practice › By Exam with nothing stored
const openHomeExamGrid = pg => pg.evaluate(() => {
  localStorage.clear(); streaks = {}; wrongList = {};
  clearSideSession(); goHome(); startMode(PRACTICE_MODE); setPracticeView('exam');
});

// Centre of option A on the quiz screen that `openQuiz` starts (measured, then the caller re-opens its screen)
const optionCentre = (pg, openQuiz) => pg.evaluate(fn => {
  new Function(fn)();
  const r = byId('opt0').getBoundingClientRect();
  return { y: r.top + r.height / 2, top: r.top, bottom: r.bottom, left: r.left, right: r.right };
}, openQuiz);

// Scroll so the trigger button's centre sits at the y where option A will appear; returns the tap point
async function alignTrigger(pg, sel, opt) {
  return pg.evaluate(([s, o]) => {
    const el = document.querySelector(s);
    const r0 = el.getBoundingClientRect();
    window.scrollTo(0, window.scrollY + r0.top + r0.height / 2 - o.y);
    const r = el.getBoundingClientRect();
    const x = Math.max(r.left + 4, Math.min(r.right - 4, (o.left + o.right) / 2));
    const y = r.top + r.height / 2;
    // onOption: the same point is inside option A of the (still unanswered) quiz screen
    const onOption = y > o.top && y < o.bottom && x > o.left && x < o.right;
    return { x, y, onOption, hitsTrigger: document.elementFromPoint(x, y)?.closest(s) === el };
  }, [sel, opt]);
}
async function setupFact(pg) {
  await openStudyCh3(pg);
  const opt = await optionCentre(pg, `startFactPractice(${FACT_ID});`);
  await openStudyCh3(pg);
  return alignTrigger(pg, factBtn, opt);
}
async function setupExam(pg) {
  await openHomeExamGrid(pg);
  const opt = await optionCentre(pg, `pendingMode = PRACTICE_MODE; startExam(${EXAM_CELL});`);
  await openHomeExamGrid(pg);
  return alignTrigger(pg, examBtn, opt);
}

// mouse double click, then a click 50ms after the first, then a touch double tap: Q1 untouched
async function checkDoubleTap(pg, touchPg, name, setup) {
  let p = await setup(pg);
  assert(p.hitsTrigger && p.onOption, `${name}: tap point is on the button and where option A will be`);
  await pg.mouse.dblclick(p.x, p.y);
  assert(await pg.$eval('.screen.active', e => e.id) === 'screenQuiz', `${name}: double click opens the quiz`);
  let w = await practiceWrites(pg);
  assert(clean(w), `${name}: mouse double click leaves Q1 unanswered, no streak / wrong list (${JSON.stringify(w)})`);

  p = await setup(pg);
  await pg.mouse.click(p.x, p.y);
  await sleep(SECOND_TAP_MS);
  await pg.mouse.click(p.x, p.y);
  w = await practiceWrites(pg);
  assert(clean(w), `${name}: second click ${SECOND_TAP_MS}ms later is ignored (${JSON.stringify(w)})`);

  p = await setup(touchPg);
  await touchPg.touchscreen.tap(p.x, p.y);
  await sleep(SECOND_TAP_MS);
  await touchPg.touchscreen.tap(p.x, p.y);
  assert(p.onOption, `${name} (touch): tap point is where option A will be`);
  w = await practiceWrites(touchPg);
  assert(clean(w), `${name} (touch): double tap leaves Q1 unanswered (${JSON.stringify(w)})`);
}

// a normal single tap and a later tap on an option still answer
async function checkNormalFlow(pg) {
  const guard = await guardMs(pg);
  const p = await setupFact(pg);
  await pg.mouse.click(p.x, p.y);
  await sleep(guard + SETTLE_EXTRA_MS);
  await pg.click('#opt0');
  const w = await practiceWrites(pg);
  assert(w.answered === 1 && w.revealed === 1 && w.streak !== null, `single tap, then an option after the guard: answered (${JSON.stringify(w)})`);
}

// same screen: two quick Next clicks both count (the guard only follows a screen change, and a real
// click started the exam so the guard window is open while these run)
async function checkSameScreenRepeat(pg) {
  await openHomeExamGrid(pg);
  await pg.evaluate(() => { pendingMode = EXAM_MODE; });
  await pg.click(examBtn);
  await sleep((await guardMs(pg)) + SETTLE_EXTRA_MS);
  await pg.click('#nextBtn');
  await pg.click('#nextBtn');
  assert(await pg.evaluate(() => state.current) === 2, 'exam: two quick Next clicks move two questions');
  await pg.click('#opt0');
  await pg.click('#nextBtn');
  assert(await pg.evaluate(() => state.answers[2]?.length === 1 && state.current === 3), 'exam: pick then a quick Next both count');
  await pg.click('#quickPrev');
  await pg.click('#quickPrev');
  assert(await pg.evaluate(() => state.current) === 1, 'exam: two quick ← clicks move back two');
  await pg.evaluate(() => { stopExamTimer(); });
}

// keyboard: Enter on "▶ Practise" opens the quiz, an immediate Enter on an option still answers
async function checkKeyboard(pg) {
  await openStudyCh3(pg);
  await pg.focus(factBtn);
  await pg.keyboard.press('Enter');
  assert(await pg.$eval('.screen.active', e => e.id) === 'screenQuiz', 'keyboard Enter opens the fact session');
  await pg.focus('#opt0');
  await pg.keyboard.press('Enter');
  const w = await practiceWrites(pg);
  assert(w.answered === 1, `keyboard Enter on an option right away is not blocked (${JSON.stringify(w)})`);
  await openStudyCh3(pg);
  await pg.focus(factBtn);
  await pg.keyboard.press(' ');
  await pg.focus('#opt1');
  await pg.keyboard.press(' ');
  assert((await practiceWrites(pg)).answered === 1, 'keyboard Space likewise');
}

// confirm modal: its buttons work straight after a screen change
async function checkModal(pg) {
  await openStudyCh3(pg);
  const home = await pg.$eval('#screenStudy [data-action="goHome"]', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await pg.mouse.click(home.x, home.y);
  assert(await pg.$eval('.screen.active', e => e.id) === 'screenHome', 'Study ← Home click opens Home');
  await pg.evaluate(() => resetPracticeProgress());
  const c = await pg.$eval('#confirmCancel', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await pg.mouse.click(c.x, c.y);
  assert(!(await pg.evaluate(() => isConfirmOpen())), 'confirm modal Keep works right after a screen change');
}

(async () => {
  const b = await chromium.launch(launchOpts);
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const touchCtx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const touchPg = await touchCtx.newPage();
  const errs = [];
  [pg, touchPg].forEach(p => p.on('pageerror', e => errs.push(e.message)));
  for (const p of [pg, touchPg]) { await p.goto(APP_URL); await p.evaluate(() => localStorage.clear()); await p.reload(); }

  await checkDoubleTap(pg, touchPg, 'Study ▶ Practise', setupFact);
  await checkDoubleTap(pg, touchPg, 'Home By Exam cell', setupExam);
  await checkNormalFlow(pg);
  await checkSameScreenRepeat(pg);
  await checkKeyboard(pg);
  await checkModal(pg);

  assert(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  console.log('PASS');
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
