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
  await pg.evaluate(() => { pendingMode = 'practice'; startExam(1);
    // questions are shuffled: jump to one whose options have Cantonese translations
    state.current = state.questions.findIndex(q => q.oy && q.oy.some(Boolean)); renderQuestion(); });
  // 3) button in q-num row, right, no emoji
  assert(await pg.$eval('#yueToggle', e => e.parentElement.classList.contains('q-num')), 'toggle inside Question # row');
  assert((await pg.$eval('#yueToggle', e => e.textContent)) === 'Translate', 'label is plain "Translate"');
  const [tb, qb] = await pg.evaluate(() => [document.getElementById('yueToggle').getBoundingClientRect(), document.getElementById('qNum').getBoundingClientRect()]);
  assert(tb.left > qb.left && Math.abs(tb.top - qb.top) < 20, 'toggle sits right of Question # on the same line');
  // before answering: hidden until toggled
  assert(!(await vis('#qYue')) && (await pg.$$('.opt-yue')).length === 0, 'hidden before answering');
  await pg.click('#yueToggle');
  assert(await vis('#qYue') && (await pg.$$('.opt-yue')).length > 0, 'toggle shows question + options');
  await pg.click('#yueToggle');
  // 2) answer -> translations auto shown, toggle hidden
  await pg.evaluate(() => { state.answers[state.current] = [...state.questions[state.current].a]; revealAnswer(); });
  assert(await vis('#qYue') && (await pg.$$('.opt-yue')).length > 0, 'after answering: question + option translations shown automatically');
  assert(!(await vis('#yueToggle')), 'toggle hidden once answered');
  // 1) answer box format
  const yue = await pg.$eval('#ansYue', e => e.innerText);
  const q = await pg.evaluate(() => state.questions[state.current]);
  const expA = q.a.map(i => q.oy[i] || q.o[i]).join('  |  ');
  assert(yue.startsWith('【廣東話翻譯】') && yue.includes('Q)') && yue.includes(q.yue) && yue.includes('A)') && yue.replace(/\s+/g, ' ').includes(expA.replace(/\s+/g, ' ')), 'answer box: 【廣東話翻譯】 / Q) / A): ' + yue.replace(/\n/g, ' ⏎ '));
  assert(!(await pg.$eval('#ansEn', e => e.textContent)).includes('（'), 'English answer line has no inline translation');
  await pg.screenshot({ path: 'shot-answer-format.png', fullPage: true });
  // next question -> hidden again
  await pg.click('#nextBtn');
  assert(!(await vis('#qYue')) && (await pg.$$('.opt-yue')).length === 0 && (await vis('#yueToggle')), 'next question: translations hidden, toggle back');
  // year-only answer falls back to English in A)
  await pg.evaluate(() => { state.current = 2; renderQuestion(); });
  const isYears = await pg.evaluate(() => state.questions[2].o.every(o => /^\d{4}$/.test(o)));
  if (isYears) { await pg.click('#opt0'); assert((await pg.$eval('#ansYue', e => e.innerText)).match(/A\)\s*\d{4}/), 'A) falls back to year when no translation'); }
  // exam mode: no toggle before submit; translations after submit
  await pg.evaluate(() => { pendingMode = 'exam'; startExam(1); });
  assert(!(await vis('#yueToggle')) && !(await vis('#qYue')), 'exam: no toggle, no translation before submit');
  await pg.click('#opt0'); await pg.click('#examSubmitBtn');
  assert(await vis('#qYue') && (await pg.$$('.opt-yue')).length > 0 && (await pg.$eval('#ansYue', e => e.innerText)).includes('【廣東話翻譯】'), 'exam: after submit, question/options/answer translations shown');
  assert(errs.length === 0, 'no page errors: ' + errs.join(';'));
  await b.close(); console.log('YUE2 PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
