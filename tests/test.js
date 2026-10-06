const { chromium } = require('playwright-core');
const path = require('path');
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
(async () => {
  const b = await chromium.launch(launchOpts);
  const pg = await b.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(APP_URL);
  const cls = i => pg.$eval('#opt' + i, e => Array.from(e.classList));
  const dialogs = [];
  const box = () => pg.$eval('#answerBox', e => e.className);
  const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

  // ── Exam mode (real-test style): pick freely, change any time, one Submit on the last question ──
  pg.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
  await pg.evaluate(() => { pendingMode = 'exam'; startExam(1); });
  const multiIdx = await pg.evaluate(() => state.questions.findIndex(q => q.a.length > 1));
  const singleIdx = await pg.evaluate(() => state.questions.findIndex(q => q.a.length === 1));
  const last = await pg.evaluate(() => state.questions.length - 1);
  const nextText = () => pg.$eval('#nextBtn', e => e.textContent);

  // single question: select is neutral, no answer box, no submit before the last question
  await pg.evaluate(i => { state.current = i; renderQuestion(); }, singleIdx);
  const wrongOpt = await pg.evaluate(() => state.questions[state.current].o.findIndex((_, i) => !state.questions[state.current].a.includes(i)));
  const rightOpt = await pg.evaluate(() => state.questions[state.current].a[0]);
  await pg.click('#opt' + wrongOpt);
  let c = await cls(wrongOpt);
  assert(!c.includes('disabled') && !c.includes('wrong') && !c.includes('correct') && c.includes('selected'), 'exam select is neutral, not disabled');
  assert((await box()) === 'answer-box', 'no answer box in exam mode');
  assert((await nextText()) === 'Next →' && (await pg.$$('#examSubmitRow, #examSubmitBtn')).length === 0, 'not the last question: Next, no separate Submit row');
  // Next keeps the pick; Prev shows it again in blue and it can be changed
  await pg.click('#nextBtn');
  assert(await pg.evaluate(i => state.current === i + 1, singleIdx), 'Next moves on');
  await pg.click('#prevBtn');
  c = await cls(wrongOpt);
  assert(c.includes('selected') && !c.includes('disabled') && !c.includes('wrong'), 'back with Prev: own pick in blue, still editable');
  assert(!(await cls(rightOpt)).includes('correct'), 'correct option never revealed');
  assert(!(await pg.$eval('#qYue', e => e.classList.contains('show'))) && (await pg.$$('.opt-yue')).length === 0, 'no translation in exam mode');
  await pg.click('#opt' + rightOpt);
  assert(JSON.stringify(await pg.evaluate(() => state.answers[state.current])) === JSON.stringify([rightOpt]), 'answer can be changed after coming back');
  assert(await pg.evaluate(() => Object.keys(state.revealed).length === 0), 'nothing is marked / scored before Submit');

  // multi question: toggles freely, never auto-submits
  await pg.evaluate(i => { state.current = i; renderQuestion(); }, multiIdx);
  const ans = await pg.evaluate(() => state.questions[state.current].a);
  await pg.click('#opt' + ans[0]); await pg.click('#opt' + ans[1]);
  await pg.click('#opt' + ans[1]); await pg.click('#opt' + ans[1]);
  assert(JSON.stringify(await pg.evaluate(() => [...state.answers[state.current]].sort())) === JSON.stringify([...ans].sort()), 'multi: toggle on / off, all picks kept');
  assert((await box()) === 'answer-box' && (await nextText()) === 'Next →', 'multi: no box, still Next');

  // last question: Submit instead of Next; unanswered questions are confirmed first
  await pg.evaluate(i => { state.current = i; renderQuestion(); }, last);
  assert((await nextText()) === 'Submit' && !(await pg.$eval('#nextBtn', e => e.disabled)), 'last question: the Next button becomes Submit');
  assert(await pg.$eval('#nextBtn', e => e.parentElement.contains(document.getElementById('prevBtn'))), 'Submit sits next to Prev');
  await pg.click('#nextBtn');
  assert(/22 questions unanswered/.test(await pg.$eval('#confirmMsg', e => e.textContent)), 'warning modal counts unanswered questions');
  await pg.click('#confirmCancel');
  assert(await pg.evaluate(() => document.getElementById('screenQuiz').classList.contains('active')), 'cancel on the unanswered warning stays in the exam');
  await pg.click('#nextBtn'); await pg.click('#confirmOk');
  assert(await pg.evaluate(() => document.getElementById('screenResult').classList.contains('active')), 'Submit opens the results');
  assert((await pg.$eval('#resultScore', e => e.textContent)).startsWith('2 / 24 · '), 'results score the saved picks (2 correct)');

  // everything answered: no warning
  await pg.evaluate(() => {
    pendingMode = 'exam'; startExam(1);
    state.questions.forEach((q, i) => { state.answers[i] = [...q.a]; });
    state.current = state.questions.length - 1; renderQuestion();
  });
  await pg.click('#nextBtn');
  assert(await pg.evaluate(() => !document.getElementById('confirmModal').classList.contains('show') && document.getElementById('resultScore').textContent === '24 / 24 · 100%'), 'all answered: submits without a warning, 24/24');
  assert(dialogs.length === 0, 'exam never uses a browser alert / confirm box');

  // ── Practice mode: wrong answer must still reveal + lock ──
  await pg.evaluate(() => { pendingMode = 'practice'; startExam(1); });
  await pg.evaluate(i => { state.current = i; renderQuestion(); }, await pg.evaluate(() => state.questions.findIndex(q => q.a.length === 1)));
  const pw = await pg.evaluate(() => state.questions[state.current].o.findIndex((_, i) => !state.questions[state.current].a.includes(i)));
  await pg.click('#opt' + pw);
  assert((await cls(pw)).includes('wrong') && (await cls(pw)).includes('disabled'), 'practice wrong: red + disabled');
  assert((await box()).includes('show'), 'practice wrong: answer box shown');
  assert((await pg.$eval('#nextBtn', e => e.textContent)) !== 'Submit', 'practice: no Submit');
  // multi in practice auto-reveals
  await pg.evaluate(i => { state.current = i; renderQuestion(); }, await pg.evaluate(() => state.questions.findIndex(q => q.a.length > 1)));
  const pa = await pg.evaluate(() => state.questions[state.current].a);
  for (const i of pa) await pg.click('#opt' + i);
  assert(await pg.evaluate(() => state.revealed[state.current] === true), 'practice multi auto-reveals');

  assert(errs.length === 0, 'no page errors: ' + errs.join(';'));
  await b.close();
  console.log('ALL PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
