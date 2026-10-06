const { chromium } = require('playwright-core');
const path = require('path');
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
(async () => {
  const b = await chromium.launch(launchOpts);
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };
  const vis = sel => pg.$eval(sel, e => getComputedStyle(e).display !== 'none');
  const text = sel => pg.$eval(sel, e => e.textContent);
  await pg.goto(APP_URL);
  await pg.evaluate(() => localStorage.clear()); await pg.reload();
  const answer = () => pg.evaluate(() => {
    const i = state.current, q = state.questions[i];
    state.answers[i] = [...q.a];
    if (state.mode === 'practice') revealAnswer(); else renderQuestion(); // exam: a pick is just saved
  });

  // practice: hidden before answering (Translate keeps its place), shown after
  await pg.evaluate(() => { pendingMode = 'practice'; startExam('ch1'); });
  assert(!(await vis('#quickNav')) && await vis('#yueToggle'), 'before answering: Translate shown, quick nav hidden');
  await answer();
  assert(await vis('#quickNav') && !(await vis('#yueToggle')), 'after answering: quick nav in the Translate spot');
  assert(await pg.$eval('#quickNav', e => e.closest('.q-num') !== null), 'quick nav sits in the question header row');
  assert((await text('#quickPrev')) === '←' && await pg.$eval('#quickPrev', e => e.disabled), 'symbol-only Prev, disabled on the first question');
  assert((await text('#quickNext')) === '→', 'symbol-only Next');
  assert(await pg.$eval('#quickPrev', e => e.title === 'Previous') && await pg.$eval('#quickNext', e => e.title === 'Next'), 'quick buttons keep a text label as title');
  await pg.click('#quickNext');
  assert(await pg.evaluate(() => state.current === 1), 'quick Next moves to the next question');
  assert(!(await vis('#quickNav')), 'hidden again on an unanswered question');
  await answer();
  await pg.click('#quickPrev');
  assert(await pg.evaluate(() => state.current === 0), 'quick Prev moves back');
  // last question mirrors the bottom button (Finish)
  await pg.evaluate(() => { state.current = state.questions.length - 1; renderQuestion(); });
  await answer();
  assert((await text('#quickNext')) === '✓' && (await text('#nextBtn')) === 'Finish ✓', 'last question: ✓ (bottom button keeps Finish ✓)');
  assert(await pg.$eval('#quickNext', e => e.title === 'Finish'), 'title names the action');
  await pg.click('#quickNext');
  assert(await vis('#screenResult'), 'quick Finish opens the results');

  // exam: quick nav once the question has a pick; no Next on the last question (Submit instead)
  await pg.evaluate(() => { pendingMode = 'exam'; startExam(1); });
  assert(!(await vis('#quickNav')), 'exam: hidden before picking');
  await answer();
  assert(await vis('#quickNav') && (await text('#quickNext')) === '→', 'exam: shown once picked');
  await pg.click('#quickNext');
  assert(await pg.evaluate(() => state.current === 1 && state.answers[0].length > 0), 'exam: quick Next keeps the pick');
  await pg.evaluate(() => { state.current = state.questions.length - 1; renderQuestion(); });
  await answer();
  assert(!(await vis('#quickNext')) && await vis('#quickPrev') && (await text('#nextBtn')) === 'Submit', 'exam last question: bottom button is Submit, no quick submit');

  // similar session: last question goes back
  await pg.evaluate(() => {
    pendingMode = 'practice'; startExam(12);
    state.current = state.questions.findIndex(q => q.origIdx === 5);
    const q = state.questions[state.current]; state.answers[state.current] = [...q.a]; revealAnswer();
    startSimilarPractice();
    state.current = state.questions.length - 1;
    const l = state.questions[state.current]; state.answers[state.current] = [...l.a]; revealAnswer();
  });
  assert((await text('#quickNext')) === '↩' && (await text('#nextBtn')) === '↩ Back', 'similar session: ↩ / ↩ Back');
  await pg.click('#quickNext');
  assert(await pg.evaluate(() => state.examNum === 12 && similarReturn === null), 'quick Back returns to the original session');

  // merged card header: "Question X of Y", progress bar as the card's top border, score pill
  await pg.evaluate(() => { localStorage.clear(); streaks = {}; pendingMode = 'practice'; startExam('ch1'); });
  assert((await pg.$$('#headerStats')).length === 0, 'app header has no correct / done stats');
  assert((await pg.$$('#progressText')).length === 0, 'no separate progress row');
  assert((await text('#qNum')).startsWith('Question 1 of 9'), 'question header reads "Question 1 of 9"');
  assert(await pg.$eval('#progressFill', e => e.closest('.q-card') !== null && e.parentElement.classList.contains('q-progress')), 'progress bar lives in the question card');
  assert(await pg.$eval('#progressFill', e => e.style.width === '11%'), 'bar width = 1 of 9');
  assert((await pg.$$('#qNum .score-pill')).length === 0, 'no score pill before the first answer');
  await answer();
  assert((await text('#qNum .score-pill')) === '✓ 1/1', 'score pill after answering');
  await pg.click('#quickNext');
  assert((await text('#qNum')).startsWith('Question 2 of 9') && (await text('#qNum .score-pill')) === '✓ 1/1', 'pill carries over to the next question');
  assert(await pg.$eval('#progressFill', e => e.style.width === '22%'), 'bar advances');
  await pg.evaluate(() => { pendingMode = 'exam'; startExam(1); });
  await answer();
  assert((await pg.$$('#qNum .score-pill')).length === 0 && (await text('#qNum')).startsWith('Question 1 of 24'), 'exam mode: no score pill');

  assert(errs.length === 0, 'no page errors: ' + errs.join('; '));
  console.log('QUICKNAV PASS');
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
