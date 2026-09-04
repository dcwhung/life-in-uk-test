const { chromium } = require('playwright-core');
const path = require('path');
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
(async () => {
  const b = await chromium.launch(launchOpts);
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  pg.on('dialog', d => d.accept());
  const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };
  const vis = sel => pg.$eval(sel, e => getComputedStyle(e).display !== 'none');
  await pg.goto(APP_URL);
  await pg.evaluate(() => localStorage.clear()); await pg.reload();

  // mastery labels on all three practice views
  assert((await pg.$eval('#diffGrid .diff-btn:first-child .ch-count', e => e.textContent)) === '0/84 · 0%', 'difficulty button shows mastered/total');
  await pg.click('#ptabChapter');
  assert((await pg.$eval('#chapterGrid .chapter-btn:first-child .ch-count', e => e.textContent)) === '0/9 · 0%', 'chapter button shows mastery');
  await pg.click('#ptabExam');
  assert((await pg.$eval('#examGrid .exam-btn.all .exam-mastery', e => e.textContent)) === '0/408 · 0%', 'All Exams shows mastery in practice');
  assert(await vis('#practiceReset') && !(await vis('#examReset')), 'practice reset row shown, exam reset hidden');
  assert((await pg.$eval('#practiceHint', e => e.textContent)).includes('3 times in a row'), 'hint text reads from MASTERY_STREAK');

  // streak: answer Ch1 (9 Q) correctly 5x -> mastered; wrong resets
  const answerAll = async (correct) => {
    await pg.evaluate(async (correct) => {
      pendingMode = 'practice'; startExam('ch1');
      for (let i = 0; i < state.questions.length; i++) {
        state.current = i; const q = state.questions[i];
        state.answers[i] = correct ? [...q.a] : [q.o.findIndex((_, k) => !q.a.includes(k))];
        revealAnswer();
      }
    }, correct);
  };
  await answerAll(true);
  assert((await pg.$eval('#ansLabel', e => e.textContent)).includes('🔥 1/3'), 'streak indicator 1/3 after one correct');
  await answerAll(true);
  assert(await pg.evaluate(() => Object.values(JSON.parse(localStorage.getItem('practiceStreak'))).every(v => v === 2)), 'all Ch1 streaks at 2 after 2 rounds');
  assert(await pg.evaluate(() => { startExam('ch1'); return state.questions.length === 9; }), 'not yet mastered: all 9 still asked');
  await answerAll(true);
  assert((await pg.$eval('#ansLabel', e => e.textContent)).includes('🏆 Mastered'), 'mastered label at 3/3');
  await pg.evaluate(() => goHome());
  await pg.click('#ptabChapter');
  assert((await pg.$eval('#chapterGrid .chapter-btn:first-child .ch-count', e => e.textContent)) === '9/9 · 100%', 'Ch1 shows 9/9 · 100%');
  assert(await pg.$eval('#chapterGrid .chapter-btn:first-child', e => e.classList.contains('complete')), 'complete styling');
  await pg.screenshot({ path: 'shot-mastery-home.png' });
  // whole set mastered -> all asked again
  assert(await pg.evaluate(() => { startExam('ch1'); return state.questions.length === 9; }), 'fully mastered set: all 9 asked again');
  // one wrong resets that question to 0 and it comes back alone
  await pg.evaluate(() => { state.current = 0; const q = state.questions[0]; state.answers[0] = [q.o.findIndex((_, k) => !q.a.includes(k))]; revealAnswer(); });
  assert((await pg.$eval('#ansLabel', e => e.textContent)).includes('🔥 0/3'), 'wrong answer resets streak to 0');
  const only = await pg.evaluate(() => { const k = qKey(state.questions[0]); startExam('ch1'); return state.questions.length === 1 && qKey(state.questions[0]) === k; });
  assert(only, 'only the reset question is asked next time (others mastered)');
  await pg.evaluate(() => goHome());
  await pg.click('#ptabChapter');
  assert((await pg.$eval('#chapterGrid .chapter-btn:first-child .ch-count', e => e.textContent)) === '8/9 · 89%', 'Ch1 now 8/9');
  // difficulty / exam views reflect the same streaks
  await pg.click('#ptabDifficulty');
  const diffTotal = await pg.$$eval('#diffGrid .diff-btn:nth-child(-n+5) .ch-count', els => els.reduce((a, e) => a + parseInt(e.textContent), 0));
  assert(diffTotal === 8, 'difficulty view sums to 8 mastered');
  // exam mode does not touch streaks, hides mastery text, shows exam reset
  await pg.click('#modeExam');
  assert(!(await vis('#practiceReset')) && await vis('#examReset'), 'exam reset row shown in exam mode');
  assert((await pg.$$('#examGrid .exam-mastery')).length === 0, 'no mastery text in exam mode');
  await pg.evaluate(() => { startExam(1); state.answers[0] = [...state.questions[0].a]; examSubmitAnswer(); });
  assert(!(await pg.$eval('#ansLabel', e => e.textContent)).includes('🔥'), 'exam mode has no streak indicator');
  const before = await pg.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('practiceStreak'))));
  await pg.evaluate(() => { state.current = state.questions.length - 1; finishExam(); });
  assert(await pg.evaluate((b) => JSON.stringify(JSON.parse(localStorage.getItem('practiceStreak'))) === b, before), 'exam mode leaves streaks untouched');
  await pg.evaluate(() => goHome());
  assert(await pg.$eval('#examGrid .exam-btn:nth-child(2)', e => e.classList.contains('done')), 'Exam 1 marked done');
  await pg.click('#examReset .reset-btn');
  assert(!(await pg.$eval('#examGrid .exam-btn:nth-child(2)', e => e.classList.contains('done'))), 'reset completed exams clears ✓');
  // reset practice progress
  await pg.click('#modePractice');
  await pg.click('#practiceReset .reset-btn');
  assert((await pg.$eval('#diffGrid .diff-btn:first-child .ch-count', e => e.textContent)) === '0/84 · 0%' && await pg.evaluate(() => localStorage.getItem('practiceStreak') === '{}'), 'reset progress clears streaks');
  assert(errs.length === 0, 'no page errors: ' + errs.join(';'));
  await b.close(); console.log('MASTERY PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
