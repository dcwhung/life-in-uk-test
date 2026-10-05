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

  // Exam 12, Q6 (12.5, local councils) shares fact #203 with 9.14 and 12.18
  const openQ = (mode, exam, origIdx) => pg.evaluate(({ mode, exam, origIdx }) => {
    pendingMode = mode; startExam(exam);
    state.current = state.questions.findIndex(q => q.origIdx === origIdx);
    renderQuestion();
  }, { mode, exam, origIdx });
  const answer = correct => pg.evaluate(correct => {
    const i = state.current, q = state.questions[i];
    state.answers[i] = correct ? [...q.a] : [q.o.findIndex((_, k) => !q.a.includes(k))];
    revealAnswer();
  }, correct);

  await pg.evaluate(() => { localStorage.setItem('practiceStreak', JSON.stringify({ '9.14': 3, '12.18': 1 })); });
  await pg.reload();
  await openQ('practice', 12, 5);
  assert(!(await vis('#similarBox')), 'similar section hidden before answering');

  await answer(true);
  assert(await vis('#similarBox'), 'similar section shown after a correct answer');
  assert((await text('#similarBox .sqm-title b')) === 'Similar Questions', 'English section title');
  assert((await text('#similarBox .sqm-title span')) === 'Same fact, asked differently', 'subtitle has no mastery count');
  assert((await text('#similarBox .sqm-count')) === '+2', 'count badge +2');
  assert((await text('#similarBox .sqm-fact-label')).includes('Core Fact #203'), 'core fact label');
  assert((await text('#similarBox .sqm-fact-en')).startsWith('Towns, cities and rural areas'), 'core fact English');
  const nodes = await pg.$$eval('#similarBox .sqm-node', els => els.map(e => e.textContent + ':' + e.className));
  assert(JSON.stringify(nodes) === JSON.stringify(['12.5:sqm-node current', '9.14:sqm-node mastered', '12.18:sqm-node weak']), 'appears-in chips with state: ' + nodes);
  const ids = await pg.$$eval('#similarBox .sqm-id', els => els.map(e => e.textContent));
  assert(JSON.stringify(ids) === JSON.stringify(['Exam 9 · Q15', 'Exam 12 · Q19']), 'every similar question listed: ' + ids);
  const streaks = await pg.$$eval('#similarBox .sqm-streak', els => els.map(e => e.textContent));
  assert(JSON.stringify(streaks) === JSON.stringify(['✓ Mastered', '🔥 1/3']), 'per-question streak: ' + streaks);
  assert((await text('#similarBox .sqm-q')) === 'What do local councils do?', 'question text shown');
  assert((await text('#similarBox .sqm-qy')) === '地區議會做乜嘢？', 'question translation shown');
  const boxText = await text('#similarBox');
  assert(!boxText.includes('Provide local services') && !boxText.includes('represent their local community'), 'no answers shown');
  assert((await pg.$$('#similarBox .sqm-angle')).length === 0, 'no question-angle tags');
  assert((await text('#similarBox .sqm-cta button')) === '▶ Practise these 2', 'practise button');
  await pg.screenshot({ path: 'shot-similar.png', fullPage: true });

  // wrong answer also shows the section
  await openQ('practice', 12, 5);
  await answer(false);
  assert(await vis('#similarBox'), 'similar section shown after a wrong answer');

  // question whose fact has no other source questions -> hidden
  const lonely = await pg.evaluate(() => {
    const f = STUDY.find(f => f.src.length === 1);
    const [e, i] = f.src[0].split('.').map(Number);
    return { e, i };
  });
  await openQ('practice', lonely.e, lonely.i);
  await answer(true);
  assert(!(await vis('#similarBox')), 'hidden when the fact has no similar questions');

  // exam mode: never shown
  await openQ('exam', 12, 5);
  await pg.evaluate(() => { const q = state.questions[state.current]; state.answers[state.current] = [...q.a]; examSubmitAnswer(); });
  assert(!(await vis('#similarBox')), 'hidden in exam mode');

  // practise these N: one-off session, then back to the original question
  await openQ('practice', 12, 5);
  await answer(true);
  const before = await pg.evaluate(() => ({ len: state.questions.length, cur: state.current, examNum: state.examNum }));
  await pg.click('#similarBox .sqm-cta button');
  assert(await pg.evaluate(() => state.questions.map(qKey).join(',') === '9.14,12.18'), 'temporary session holds only the similar questions');
  assert((await text('#quizLabel')) === 'Similar Questions', 'session label');
  assert((await text('#progressText')) === 'Question 1 of 2', 'progress counts the similar questions');
  await answer(false);
  assert(!(await vis('#similarBox')), 'no nested similar section inside the temporary session');
  assert(await pg.evaluate(() => state.questions.length === 2), 'wrong answer is not re-queued (each question once)');
  assert(await pg.evaluate(() => JSON.parse(localStorage.getItem('practiceStreak'))['9.14'] === 0), 'streak still recorded in the temporary session');
  assert((await text('#nextBtn')) === 'Next →', 'next button before the last question');
  await pg.click('#nextBtn');
  await answer(true);
  assert((await text('#nextBtn')).startsWith('↩ Back to Question'), 'last question offers the way back');
  await pg.click('#nextBtn');
  const after = await pg.evaluate(() => ({ len: state.questions.length, cur: state.current, examNum: state.examNum }));
  assert(JSON.stringify(after) === JSON.stringify(before), 'original session restored at the same question');
  assert(await vis('#similarBox') && await vis('#answerBox'), 'original question still shows its answer and similar section');

  // leaving to Home drops the stashed session
  await pg.click('#similarBox .sqm-cta button');
  await pg.evaluate(() => goHome());
  assert(await pg.evaluate(() => similarReturn === null), 'home clears the temporary session');

  assert(errs.length === 0, 'no page errors: ' + errs.join('; '));
  console.log('SIMILAR PASS');
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
