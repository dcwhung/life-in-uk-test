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
    if (state.mode === 'practice') revealAnswer(); else examSubmitAnswer();
  });

  // practice: hidden before answering (Translate keeps its place), shown after
  await pg.evaluate(() => { pendingMode = 'practice'; startExam('ch1'); });
  assert(!(await vis('#quickNav')) && await vis('#yueToggle'), 'before answering: Translate shown, quick nav hidden');
  await answer();
  assert(await vis('#quickNav') && !(await vis('#yueToggle')), 'after answering: quick nav in the Translate spot');
  assert(await pg.$eval('#quickNav', e => e.closest('.q-num') !== null), 'quick nav sits in the question header row');
  assert((await text('#quickPrev')) === '← Prev' && await pg.$eval('#quickPrev', e => e.disabled), 'Prev disabled on the first question');
  assert((await text('#quickNext')) === 'Next →', 'Next label');
  await pg.click('#quickNext');
  assert(await pg.evaluate(() => state.current === 1), 'quick Next moves to the next question');
  assert(!(await vis('#quickNav')), 'hidden again on an unanswered question');
  await answer();
  await pg.click('#quickPrev');
  assert(await pg.evaluate(() => state.current === 0), 'quick Prev moves back');
  // last question mirrors the bottom button (Finish)
  await pg.evaluate(() => { state.current = state.questions.length - 1; renderQuestion(); });
  await answer();
  assert((await text('#quickNext')) === (await text('#nextBtn')) && (await text('#quickNext')) === 'Finish ✓', 'last question: Finish ✓ like the bottom button');
  await pg.click('#quickNext');
  assert(await vis('#screenResult'), 'quick Finish opens the results');

  // exam: hidden until submitted, then See Results on the last question
  await pg.evaluate(() => { pendingMode = 'exam'; startExam(1); });
  assert(!(await vis('#quickNav')), 'exam: hidden before submit');
  await answer();
  assert(await vis('#quickNav'), 'exam: shown after submit');
  await pg.evaluate(() => { state.current = state.questions.length - 1; renderQuestion(); });
  await answer();
  assert((await text('#quickNext')) === 'See Results →', 'exam last question: See Results →');

  // similar session: last question goes back
  await pg.evaluate(() => {
    pendingMode = 'practice'; startExam(12);
    state.current = state.questions.findIndex(q => q.origIdx === 5);
    const q = state.questions[state.current]; state.answers[state.current] = [...q.a]; revealAnswer();
    startSimilarPractice();
    state.current = state.questions.length - 1;
    const l = state.questions[state.current]; state.answers[state.current] = [...l.a]; revealAnswer();
  });
  assert((await text('#quickNext')) === '↩ Back', 'similar session: ↩ Back');
  await pg.click('#quickNext');
  assert(await pg.evaluate(() => state.examNum === 12 && similarReturn === null), 'quick Back returns to the original session');

  assert(errs.length === 0, 'no page errors: ' + errs.join('; '));
  console.log('QUICKNAV PASS');
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
