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
  const start = (mode, set) => pg.evaluate(({ mode, set }) => { pendingMode = mode; startExam(set); }, { mode, set });
  const distinct = () => pg.evaluate(() => new Set(state.questions.map(qKey)).size);
  // answer everything in the session queue correctly (queue grows while unmastered ones come back)
  const answerSession = () => pg.evaluate(() => {
    for (let i = 0; i < state.questions.length; i++) {
      state.current = i; state.answers[i] = [...state.questions[i].a]; revealAnswer();
    }
  });

  // big practice sets are capped at 25 distinct questions per round
  for (const set of ['ch3', 'd3', 'dhard', 'all']) {
    await start('practice', set);
    assert(await pg.evaluate(() => state.questions.length === 25), `${set}: round starts with 25 questions`);
  }
  // small sets are not padded
  await start('practice', 'ch1');
  assert(await pg.evaluate(() => state.questions.length === 9), 'ch1 (9 Q): all 9 asked');
  // exam mode is never capped
  await start('exam', 'all');
  assert(await pg.evaluate(() => state.questions.length === 408), 'exam mode All Exams: all 408 asked');

  // round 1 of Ch3 (167 Q): 25 picked, re-queued within those 25 until mastered (75 answers)
  await start('practice', 'ch3');
  const round1 = await pg.evaluate(() => state.questions.map(qKey));
  await answerSession();
  assert(await pg.evaluate(() => state.questions.length === 75), 'round 1: 25 questions x 3 answers');
  assert((await distinct()) === 25, 'round 1: re-queue stays within the 25 picked');
  assert(await pg.evaluate(() => masteryOf(chapterQuestions(3)).mastered === 25), 'Ch3: 25 mastered after round 1');
  // round 2: next 25 drawn from the unmastered pool only
  await start('practice', 'ch3');
  assert(await pg.evaluate((r1) => state.questions.length === 25 && state.questions.every(q => !r1.includes(qKey(q))), round1), 'round 2: 25 new unmastered questions');
  // last round: fewer than 25 left -> only those
  await pg.evaluate(() => {
    chapterQuestions(3).slice(0, 160).forEach(q => { streaks[qKey(q)] = MASTERY_STREAK; });
    chapterQuestions(3).slice(160).forEach(q => { delete streaks[qKey(q)]; });
  });
  await start('practice', 'ch3');
  assert(await pg.evaluate(() => state.questions.length === 7), 'last round: only the 7 unmastered left');
  // whole set mastered -> review round, still capped at 25
  await answerSession();
  await start('practice', 'ch3');
  assert(await pg.evaluate(() => state.questions.length === 25), 'fully mastered set: review round of 25');
  assert(await pg.evaluate(() => document.getElementById('practiceHint').textContent.includes('25')), 'hint mentions 25 per round');
  assert(errs.length === 0, 'no page errors: ' + errs.join(';'));
  await b.close(); console.log('BATCH PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
