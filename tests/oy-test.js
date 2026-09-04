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
  // data integrity: oy aligned with o for every question, and shuffle keeps alignment
  const r = await pg.evaluate(() => {
    let bad = 0, translated = 0, total = 0;
    for (let e = 1; e <= 17; e++) EXAMS[e].forEach(q => { if (!q.oy || q.oy.length !== q.o.length) bad++; total += q.o.length; translated += q.oy.filter(Boolean).length; });
    // shuffle alignment: after shuffle, oy[i] must equal original oy for o[i]
    let misaligned = 0;
    for (let e = 1; e <= 17; e++) EXAMS[e].forEach(q => { const s = shuffleOptions(q); s.o.forEach((o, i) => { if (q.oy[q.o.indexOf(o)] !== s.oy[i]) misaligned++; }); });
    return { bad, translated, total, misaligned };
  });
  assert(r.bad === 0 && r.misaligned === 0, `oy aligned for all questions and after shuffle (${r.translated}/${r.total} options translated)`);
  await pg.evaluate(() => { pendingMode = 'practice'; startExam(1); });
  assert((await pg.$eval('#yueToggle', e => e.textContent)) === 'Translate', 'button says Translate');
  assert((await pg.$$('.opt-yue')).length === 0, 'no option translations before toggle');
  await pg.click('#yueToggle');
  assert((await pg.$eval('#yueToggle', e => e.textContent)) === 'Hide translation', 'button flips');
  const n = await pg.$$eval('.opt-yue', els => els.length);
  const expected = await pg.evaluate(() => state.questions[0].oy.filter(Boolean).length);
  assert(n === expected && n > 0, `option translations shown: ${n}`);
  const first = await pg.evaluate(() => ({ en: state.questions[0].o[0], yue: state.questions[0].oy[0] }));
  assert((await pg.$eval('#opt0 .opt-body', e => e.textContent)).includes(first.yue), 'translation matches the option under it');
  // hide before answering removes option translations
  await pg.click('#yueToggle');
  assert((await pg.$$('.opt-yue')).length === 0, 'hide removes option translations');
  await pg.click('#yueToggle');
  // answer -> answer box A) line carries the correct answer translation
  await pg.evaluate(() => { state.answers[0] = [...state.questions[0].a]; revealAnswer(); });
  const ansYue = await pg.$eval('#ansYue', e => e.innerText);
  const corr = await pg.evaluate(() => state.questions[0].a.map(i => state.questions[0].oy[i]));
  assert(corr.every(y => !y || ansYue.includes(y)), 'answer box A) includes correct answer translation');
  assert((await pg.$$('.opt-yue')).length === n, 'option translations stay after reveal');
  await pg.screenshot({ path: 'shot-translate.png' });
  // year-only options: no translation shown
  await pg.evaluate(() => { state.current = 2; state.yueShown[2] = true; renderQuestion(); }); // Q 1.2 all years
  const yrs = await pg.evaluate(() => state.questions[2].o.every(o => /^\d{4}$/.test(o)) ? 'years' : 'other');
  if (yrs === 'years') assert((await pg.$$('.opt-yue')).length === 0, 'year-only options show no translation line');
  // exam mode: never
  await pg.evaluate(() => { pendingMode = 'exam'; startExam(1); state.yueShown[0] = true; renderQuestion(); });
  assert((await pg.$$('.opt-yue')).length === 0, 'exam mode never shows option translations');
  assert(errs.length === 0, 'no page errors: ' + errs.join(';'));
  await b.close(); console.log('OY PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
