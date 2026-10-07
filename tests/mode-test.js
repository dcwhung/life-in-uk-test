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
  const shown = async () => (await Promise.all(['#secDifficulty', '#secChapter', '#secExam'].map(vis))).map((v, i) => v ? ['diff', 'chapter', 'exam'][i] : null).filter(Boolean).join(',');
  await pg.goto(APP_URL);
  await pg.evaluate(() => localStorage.clear()); await pg.reload();
  // 1. same style
  const styles = await pg.$$eval('.mode-grid .mode-card', els => els.map(e => { const c = getComputedStyle(e); return c.borderColor + '|' + getComputedStyle(e.querySelector('.mode-title')).color; }));
  assert(styles[0] === styles[2], 'Study styled like Exam (unselected): ' + styles[0]);
  // 2. default practice
  assert(await pg.$eval('#modePractice', e => e.classList.contains('selected')), 'Practice selected by default');
  assert(await vis('#modeDesc') && (await pg.$eval('#modeDesc', e => e.textContent)).includes('Practice'), 'practice description shown by default');
  // 4. practice tabs default difficulty
  assert(await vis('#practiceTabs') && await pg.$eval('#ptabDifficulty', e => e.classList.contains('active')), 'practice tabs visible, By Difficulty active');
  assert((await shown()) === 'diff', 'only difficulty section shown: ' + await shown());
  await pg.screenshot({ path: 'shot-home-v2.png' });
  await pg.click('#ptabChapter');
  assert((await shown()) === 'chapter' && await pg.$eval('#ptabChapter', e => e.classList.contains('active')), 'By Chapter shows only chapter section');
  await pg.click('#ptabExam');
  assert((await shown()) === 'exam', 'By Exam shows only exam section');
  await pg.click('#examGrid .exam-btn:nth-child(2)');
  assert((await pg.$eval('#modeBadge', e => e.textContent)) === 'Practice', 'exam picked under Practice runs practice mode');
  await pg.click('#screenQuiz .back-btn');
  assert(await pg.$eval('#modePractice', e => e.classList.contains('selected')) && (await shown()) === 'exam' && await pg.$eval('#ptabExam', e => e.classList.contains('active')), 'home keeps Practice / By Exam');
  assert(!(await vis('#secExamTitle')), 'no Select Exam header under Practice');
  assert((await pg.$$eval('#secDifficulty .section-title, #secChapter .section-title', els => els.length)) === 0, 'no sub headers for difficulty/chapter');
  // 3. exam mode hides practice tabs + chapter/difficulty
  await pg.click('#modeExam');
  assert(!(await vis('#practiceTabs')) && (await shown()) === 'exam' && await vis('#secExamTitle'), 'Exam mode: no practice tabs, Select Exam header shown');
  assert((await pg.$eval('#modeDesc', e => e.textContent)).includes('24 questions'), 'exam description');
  await pg.screenshot({ path: 'shot-home-exam.png' });
  await pg.click('#examGrid .exam-btn:nth-child(3)');
  assert((await pg.$eval('#modeBadge', e => e.textContent)) === 'Exam', 'exam mode starts');
  await pg.click('#screenQuiz .back-btn');
  assert((await pg.$eval('#confirmTitle', e => e.textContent)) === 'Leave the exam?', 'leaving a running exam asks first (modal)');
  await pg.click('#confirmOk');
  // study
  await pg.click('#modeStudy');
  assert(await pg.$eval('#screenStudy', e => e.classList.contains('active')), 'Study opens directly');
  await pg.click('#screenStudy .back-btn');
  assert(await pg.$eval('#modeExam', e => e.classList.contains('selected')), 'back from study: Exam still selected');
  await pg.reload();
  assert(await pg.$eval('#modeExam', e => e.classList.contains('selected')), 'mode persists across reload');
  await pg.click('#modePractice'); await pg.click('#ptabChapter'); await pg.reload();
  assert(await pg.$eval('#ptabChapter', e => e.classList.contains('active')) && (await shown()) === 'chapter', 'practice tab persists across reload');
  // Exam grid hover: a completed exam turns green with white text (its own .done green used to beat the hover
  // white); the ✓ badge flips to a card circle with a green tick so it does not vanish into the green button
  const tokenRgb = name => pg.evaluate(n => {
    const el = document.createElement('i');
    el.style.color = `var(${n})`;
    document.body.appendChild(el);
    const c = getComputedStyle(el).color;
    el.remove();
    return c;
  }, name);
  await pg.evaluate(() => { markExamCompleted(1); startMode('exam'); });
  await pg.addStyleTag({ content: '*, *::after { transition: none !important; }' }); // read the end state, not a frame mid-fade
  const hoverStyle = async sel => {
    await pg.hover(sel);
    return pg.$eval(sel, e => {
      const c = getComputedStyle(e), a = getComputedStyle(e, '::after');
      return { color: c.color, bg: c.backgroundColor, border: c.borderTopColor, badgeBg: a.backgroundColor, badgeColor: a.color };
    });
  };
  const done = await hoverStyle('#examGrid .exam-btn.done');
  const [inverse, green, navy, card] = await Promise.all(['--text-inverse', '--green', '--navy', '--card'].map(tokenRgb));
  assert(done.color === inverse && done.bg === green && done.border === green, 'completed exam hover: green background, white text: ' + JSON.stringify(done));
  assert(done.badgeBg === card && done.badgeColor === green, 'completed exam hover: ✓ badge flips to card with a green tick: ' + JSON.stringify(done));
  const open = await hoverStyle('#examGrid .exam-btn:not(.done):not(.all)');
  assert(open.color === inverse && open.bg === navy, 'not completed exam hover: still navy background, white text: ' + JSON.stringify(open));
  await pg.mouse.move(0, 0);
  await pg.evaluate(() => localStorage.clear()); await pg.reload();
  assert(await pg.$eval('#modePractice', e => e.classList.contains('selected')) && (await shown()) === 'diff', 'fresh start: Practice / By Difficulty');
  assert(errs.length === 0, 'no page errors: ' + errs.join(';'));
  await b.close(); console.log('MODE PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
