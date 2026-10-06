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
  const MASTERY_ROUNDS = 3; // matches MASTERY_STREAK: one correct answer per round
  const distinct = () => pg.evaluate(() => new Set(state.questions.map(qKey)).size);
  // answer every question in the session correctly (fixed length, no in-session repeats)
  const answerSession = () => pg.evaluate(() => {
    for (let i = 0; i < state.questions.length; i++) {
      state.current = i; state.answers[i] = [...state.questions[i].a]; revealAnswer();
    }
  });

  // big practice sets are capped at 24 distinct questions per round
  for (const set of ['ch3', 'd3', 'd4', 'all']) {
    await start('practice', set);
    assert(await pg.evaluate(() => state.questions.length === 24), `${set}: round starts with 24 questions`);
  }
  // small sets are not padded
  await start('practice', 'ch1');
  assert(await pg.evaluate(() => state.questions.length === 9), 'ch1 (9 Q): all 9 asked');
  // exam mode is never capped
  // exam mode All Exams = Random Exam: 24 questions, no two from the same study fact
  await start('exam', 'all');
  assert(await pg.evaluate(() => state.questions.length === 24), 'exam mode Random Exam: 24 questions');

  // round 1 of Ch3 (167 Q): 24 picked, each answered once; master them over 3 rounds
  await start('practice', 'ch3');
  const round1 = await pg.evaluate(() => state.questions.map(qKey));
  await answerSession();
  assert(await pg.evaluate(() => state.questions.length === 24), 'round 1: 24 answers, length unchanged');
  assert((await distinct()) === 24, 'round 1: 24 distinct questions');
  await pg.evaluate((r1) => r1.forEach(k => { streaks[k] = MASTERY_STREAK; }), round1);
  assert(await pg.evaluate(() => masteryOf(chapterQuestions(3)).mastered === 24), 'Ch3: 24 mastered');
  // round 2: next 24 drawn from the unmastered pool only
  await start('practice', 'ch3');
  assert(await pg.evaluate((r1) => state.questions.length === 24 && state.questions.every(q => !r1.includes(qKey(q))), round1), 'round 2: 24 new unmastered questions');
  // last round: fewer than 24 left -> only those
  await pg.evaluate(() => {
    chapterQuestions(3).slice(0, 160).forEach(q => { streaks[qKey(q)] = MASTERY_STREAK; });
    chapterQuestions(3).slice(160).forEach(q => { delete streaks[qKey(q)]; });
  });
  await start('practice', 'ch3');
  assert(await pg.evaluate(() => state.questions.length === 7), 'last round: only the 7 unmastered left');
  // the same 7 come back each round until mastered (3 correct rounds)
  for (let r = 0; r < MASTERY_ROUNDS; r++) {
    if (r) await start('practice', 'ch3');
    assert(await pg.evaluate(() => state.questions.length === 7), `last 7 asked again in round ${r + 1}`);
    await answerSession();
  }
  // whole set mastered -> review round, still capped at 24
  await start('practice', 'ch3');
  assert(await pg.evaluate(() => state.questions.length === 24), 'fully mastered set: review round of 24');
  assert(await pg.evaluate(() => document.getElementById('practiceHint').textContent.includes('24')), 'hint mentions 24 per round');
  assert(errs.length === 0, 'no page errors: ' + errs.join(';'));
  await b.close(); console.log('BATCH PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
