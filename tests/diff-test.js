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
  await pg.goto(APP_URL);
  await pg.evaluate(() => localStorage.clear()); await pg.reload();

  // data
  const dist = await pg.evaluate(() => { const d = {}; for (let i = 1; i <= 17; i++) EXAMS[i].forEach(q => d[q.d] = (d[q.d] || 0) + 1); return d; });
  assert(Object.values(dist).reduce((a, b) => a + b, 0) === 408 && Object.keys(dist).join('') === '12345', 'all 408 have d in 1..5: ' + JSON.stringify(dist));
  assert(await pg.evaluate(() => STUDY.every(f => f.d >= 1 && f.d <= 5)), 'all facts have d');
  assert(await pg.evaluate(() => STUDY.every(f => f.src.every(s => { const [e, i] = s.split('.'); return EXAMS[e][+i].d <= f.d; }))), 'fact d = max of its questions');
  assert(await pg.evaluate(() => EXAMS[1][6].d === 5), 'Bill of Rights T/F trap = 5 stars');

  // home grid
  const counts = await pg.$$eval('#diffGrid .ch-count', els => els.map(e => parseInt(e.textContent.split('/')[1])));
  assert(counts.length === 6 && counts.slice(0, 5).reduce((a, b) => a + b, 0) === 408 && counts[5] === counts[3] + counts[4], 'difficulty grid counts: ' + counts.join('/'));
  await pg.screenshot({ path: 'shot-diff-home.png', fullPage: true });

  // practice by difficulty
  await pg.click('#diffGrid .diff-btn:nth-child(6)');
  assert(await pg.evaluate(() => state.questions.length === 85 && state.questions.every(q => q.d >= 4)), 'hard set 85 Q all >=4');
  assert((await pg.$eval('#quizLabel', e => e.textContent)) === 'Hard ★★★★+', 'hard label');
  assert((await pg.$eval('#qNum .stars', e => e.textContent)).length === 5, 'stars shown on question card');
  await pg.screenshot({ path: 'shot-diff-q.png' });
  await pg.click('#screenQuiz .back-btn');
  await pg.click('#diffGrid .diff-btn:nth-child(2)');
  assert(await pg.evaluate(() => state.questions.every(q => q.d === 2)), 'level 2 set all d=2');
  assert(await pg.evaluate(() => !localStorage.getItem('completedExams')), 'difficulty practice not saved as completed');
  await pg.click('#screenQuiz .back-btn');

  // exam mode still shows stars, results breakdown
  await pg.evaluate(() => { pendingMode = 'exam'; startExam(1); });
  assert((await pg.$$('#qNum .stars')).length === 1, 'stars in exam mode');
  await pg.evaluate(() => { state.questions.forEach((q, i) => { if (i % 2 === 0) state.answers[i] = [...q.a]; }); finishExam(); });
  const rows = await pg.$$eval('.diff-row', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
  assert(rows.length >= 3 && rows.every(r => /\d+\/\d+ · \d+%/.test(r)), 'results by difficulty rows: ' + rows.join(' | '));
  const total = await pg.$$eval('.diff-pct', els => els.reduce((a, e) => a + parseInt(e.textContent.split('/')[1]), 0));
  assert(total === 24, 'breakdown totals 24');
  await pg.screenshot({ path: 'shot-diff-result.png' });
  await pg.click('text=Choose Another');

  // study fact stars
  await pg.click('#modeStudy');
  assert((await pg.$$('.tag.diff')).length === 2, 'Ch1 facts show star tags');
  assert(errs.length === 0, 'no page errors: ' + errs.join(';'));
  await b.close(); console.log('DIFF PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
