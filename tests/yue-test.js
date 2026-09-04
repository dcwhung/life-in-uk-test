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
  await pg.evaluate(() => { pendingMode = 'practice'; startExam(1); });
  assert(await vis('#yueToggle'), 'toggle visible in practice');
  assert(!(await vis('#qYue')), 'translation hidden by default');
  await pg.click('#yueToggle');
  assert(await vis('#qYue') && (await pg.$eval('#qYue', e => e.textContent)) === (await pg.evaluate(() => state.questions[0].yue)), 'click shows q.yue');
  assert((await pg.$eval('#yueToggle', e => e.textContent)).includes('Hide'), 'button label flips');
  await pg.click('#nextBtn');
  assert(!(await vis('#qYue')), 'next question starts collapsed');
  await pg.click('#prevBtn');
  assert(await vis('#qYue'), 'previous question remembers expanded state');
  // answering keeps it shown (post-reveal behaviour is covered by yue2-test)
  await pg.evaluate(() => { state.answers[state.current] = [...state.questions[state.current].a]; revealAnswer(); });
  assert(await vis('#qYue'), 'stays shown after answering');
  await pg.screenshot({ path: 'shot-yue.png' });
  // exam mode: hidden
  await pg.evaluate(() => { pendingMode = 'exam'; startExam(1); });
  assert(!(await vis('#yueToggle')) && !(await vis('#qYue')), 'hidden in exam mode');
  await pg.evaluate(() => toggleQuestionYue());
  assert(!(await vis('#qYue')), 'toggle no-op in exam mode');
  assert(errs.length === 0, 'no page errors: ' + errs.join(';'));
  await b.close(); console.log('YUE PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
