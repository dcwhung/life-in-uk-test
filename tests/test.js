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
  const submit = () => pg.$eval('#examSubmitBtn', e => ({ t: e.textContent, d: e.disabled }));
  const box = () => pg.$eval('#answerBox', e => e.className);
  const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

  // ── Exam mode, find a multi-select and a single question in Exam 1 ──
  await pg.evaluate(() => { pendingMode = 'exam'; startExam(1); });
  const multiIdx = await pg.evaluate(() => state.questions.findIndex(q => q.a.length > 1));
  const singleIdx = await pg.evaluate(() => state.questions.findIndex(q => q.a.length === 1));
  console.log('multiIdx', multiIdx, 'singleIdx', singleIdx);

  // single question: select -> not disabled, no green/red, submit enabled
  await pg.evaluate(i => { state.current = i; renderQuestion(); }, singleIdx);
  const wrongOpt = await pg.evaluate(() => state.questions[state.current].o.findIndex((_, i) => !state.questions[state.current].a.includes(i)));
  const rightOpt = await pg.evaluate(() => state.questions[state.current].a[0]);
  await pg.click('#opt' + wrongOpt);
  let c = await cls(wrongOpt);
  assert(!c.includes('disabled') && !c.includes('wrong') && !c.includes('correct') && c.includes('selected'), 'Bug1: exam select is neutral, not disabled');
  assert((await box()) === 'answer-box', 'Bug3: answer box hidden before submit');
  let s = await submit(); assert(!s.d && s.t === 'Submit Answer', 'Bug4: single submit label/enabled');
  // can change selection
  await pg.click('#opt' + rightOpt);
  assert((await cls(rightOpt)).includes('selected') && !(await cls(wrongOpt)).includes('selected'), 'Bug1: can change selection before submit');
  await pg.click('#opt' + wrongOpt); // pick wrong, then submit -> revealed=false case
  await pg.click('#examSubmitBtn');
  c = await cls(wrongOpt);
  assert(c.includes('disabled') && c.includes('wrong'), 'reveal after submit: wrong option red+disabled');
  assert((await cls(rightOpt)).includes('correct'), 'reveal after submit: correct option green');
  assert((await box()).includes('show') && (await box()).includes('wrong-ans'), 'Bug3: answer box shown in exam mode after WRONG submit');
  s = await submit(); assert(s.d && s.t === '✓ Submitted', 'Bug4: submitted label');
  await pg.click('#opt' + rightOpt);
  assert(JSON.stringify(await pg.evaluate(() => state.answers[state.current])) === JSON.stringify([wrongOpt]), 'locked after submit');

  // multi question in exam mode: no auto-submit
  await pg.evaluate(i => { state.current = i; renderQuestion(); }, multiIdx);
  const need = await pg.evaluate(() => state.questions[state.current].a.length);
  const ans = await pg.evaluate(() => state.questions[state.current].a);
  s = await submit(); assert(s.d && s.t === `Submit Answer (0/${need} selected)`, 'Bug4: multi 0/N label disabled');
  await pg.click('#opt' + ans[0]);
  s = await submit(); assert(!s.d && s.t === `Submit Answer (1/${need} selected)`, 'Bug4: multi 1/N');
  await pg.click('#opt' + ans[1]);
  s = await submit(); assert(!s.d && s.t === `Submit Answer (${need}/${need} selected)`, 'Bug4: multi N/N');
  assert(await pg.evaluate(() => !(state.current in state.revealed)), 'Bug2: multi in exam does NOT auto-submit');
  assert((await box()) === 'answer-box', 'Bug2/3: box still hidden');
  await pg.click('#opt' + ans[1]); // deselect all-but-one
  await pg.click('#opt' + ans[0]);
  s = await submit(); assert(s.d && s.t === `Submit Answer (0/${need} selected)`, 'Bug4: deselect to 0 disables submit');
  await pg.click('#opt' + ans[0]); await pg.click('#opt' + ans[1]);
  await pg.click('#examSubmitBtn');
  assert(await pg.evaluate(() => state.revealed[state.current] === true), 'multi submit correct');
  assert((await box()).includes('show') && !(await box()).includes('wrong-ans'), 'Bug3: box shown after correct submit');

  // ── Practice mode: wrong answer must still reveal + lock ──
  await pg.evaluate(() => { pendingMode = 'practice'; startExam(1); });
  await pg.evaluate(i => { state.current = i; renderQuestion(); }, await pg.evaluate(() => state.questions.findIndex(q => q.a.length === 1)));
  const pw = await pg.evaluate(() => state.questions[state.current].o.findIndex((_, i) => !state.questions[state.current].a.includes(i)));
  await pg.click('#opt' + pw);
  assert((await cls(pw)).includes('wrong') && (await cls(pw)).includes('disabled'), 'practice wrong: red + disabled');
  assert((await box()).includes('show'), 'practice wrong: answer box shown');
  assert(await pg.$eval('#examSubmitRow', e => e.style.display) === 'none', 'practice: no submit row');
  // multi in practice auto-reveals
  await pg.evaluate(i => { state.current = i; renderQuestion(); }, await pg.evaluate(() => state.questions.findIndex(q => q.a.length > 1)));
  const pa = await pg.evaluate(() => state.questions[state.current].a);
  for (const i of pa) await pg.click('#opt' + i);
  assert(await pg.evaluate(() => state.revealed[state.current] === true), 'practice multi auto-reveals');

  assert(errs.length === 0, 'no page errors: ' + errs.join(';'));
  await b.close();
  console.log('ALL PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
