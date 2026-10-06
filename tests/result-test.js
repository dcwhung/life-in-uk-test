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
  await pg.goto(APP_URL);
  await pg.evaluate(() => localStorage.clear()); await pg.reload();
  // finish a set with every question answered correctly
  const finish = (mode, set) => pg.evaluate(({ mode, set }) => {
    pendingMode = mode; startExam(set);
    state.questions.forEach((q, i) => { state.answers[i] = [...q.a]; });
    finishExam();
  }, { mode, set });
  const verdictShown = async () => (await vis('#resultLabel2')) && (await vis('#resultSub'));

  // numbered exams (Exam mode or Practice > By Exam): PASSED + remark
  await finish('exam', 1);
  assert(await verdictShown() && (await pg.$eval('#resultLabel2', e => e.textContent)) === 'PASSED', 'Exam mode: PASSED + remark shown');
  await finish('practice', 2);
  assert(await verdictShown(), 'Practice exam: PASSED + remark shown');
  // other sets: no verdict, no remark, score still shown
  for (const set of ['ch1', 'd1', 'dhard', 'all']) {
    await finish('practice', set);
    assert(!(await vis('#resultLabel2')) && !(await vis('#resultSub')), `${set}: no PASSED / remark`);
    assert((await pg.$eval('#rbPct', e => e.textContent)) === '100%', `${set}: score still shown`);
  }
  // back to an exam: verdict comes back
  await finish('exam', 3);
  assert(await verdictShown(), 'verdict shown again after a non-exam set');
  // retry button names the mode: practice sets are not exams
  // two button rows: one above Review Answers, one at the bottom; both carry the same label
  const retryText = async () => {
    const t = await pg.$$eval('#screenResult .retry-btn', els => els.map(e => e.textContent));
    return t.length === 2 && t[0] === t[1] ? t[0] : 'mismatch: ' + t.join(' / ');
  };
  assert(await pg.evaluate(() => {
    const rows = document.querySelectorAll('#screenResult .nav-row');
    const review = document.getElementById('reviewList');
    return rows.length === 2 && !!(rows[0].compareDocumentPosition(review) & Node.DOCUMENT_POSITION_FOLLOWING)
      && !!(review.compareDocumentPosition(rows[1]) & Node.DOCUMENT_POSITION_FOLLOWING);
  }), 'button rows above and below Review Answers');
  const anotherText = async () => {
    const t = await pg.$$eval('#screenResult .another-btn', els => els.map(e => e.textContent));
    return t.length === 2 && t[0] === t[1] ? t[0] : 'mismatch: ' + t.join(' / ');
  };
  assert((await retryText()) === 'Retry' && (await anotherText()) === 'Another Exam', 'Exam mode: Retry / Another Exam');
  for (const set of [2, 'ch1', 'd1', 'all']) {
    await finish('practice', set);
    assert((await retryText()) === 'Practise Again' && (await anotherText()) === 'Choose Another', `${set} practice: Practise Again / Choose Another`);
  }
  await finish('exam', 1);
  assert((await retryText()) === 'Retry' && (await anotherText()) === 'Another Exam', 'Retry / Another Exam again after a practice set');
  // review order: wrong answers first (original question numbers kept), choice remembered
  const finishWithWrong = (wrongIdx) => pg.evaluate((wrongIdx) => {
    pendingMode = 'practice'; startExam('ch1');
    state.questions.forEach((q, i) => {
      state.answers[i] = wrongIdx.includes(i) ? [q.o.findIndex((_, k) => !q.a.includes(k))] : [...q.a];
    });
    finishExam();
  }, wrongIdx);
  const chips = () => pg.$$eval('#reviewOrder .chip', els => els.map(e => e.textContent + (e.classList.contains('active') ? '*' : '')));
  const items = () => pg.$$eval('#reviewList .review-item', els => els.map(e => e.querySelector('.rv-q').textContent.split('.')[0] + (e.classList.contains('rv-wrong') ? 'x' : '')));
  await finishWithWrong([2, 5]);
  assert(JSON.stringify(await chips()) === JSON.stringify(['Original order*', 'Wrong first']), 'order chips, original by default');
  assert(JSON.stringify(await items()) === JSON.stringify(['1', '2', '3x', '4', '5', '6x', '7', '8', '9']), 'original order');
  await pg.click('#reviewOrder .chip:nth-child(2)');
  assert(JSON.stringify(await chips()) === JSON.stringify(['Original order', 'Wrong first*']), 'wrong-first chip active');
  assert(JSON.stringify(await items()) === JSON.stringify(['3x', '6x', '1', '2', '4', '5', '7', '8', '9']), 'wrong answers first, original numbers kept');
  await finishWithWrong([0]);
  assert(JSON.stringify(await items()) === JSON.stringify(['1x', '2', '3', '4', '5', '6', '7', '8', '9']) && (await chips())[1] === 'Wrong first*', 'choice remembered for the next result');
  await pg.click('#reviewOrder .chip:nth-child(1)');
  assert(JSON.stringify(await chips()) === JSON.stringify(['Original order*', 'Wrong first']), 'back to original order');
  assert(errs.length === 0, 'no page errors: ' + errs.join(';'));
  await b.close(); console.log('RESULT PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
