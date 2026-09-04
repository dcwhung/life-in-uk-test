const { chromium } = require('playwright-core');
const path = require('path');
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
(async () => {
  const b = await chromium.launch(launchOpts);
  const pg = await b.newPage();
  pg.on('pageerror', e => { console.log('ERR', e.message); process.exit(1); });
  await pg.goto(APP_URL);
  const r = await pg.evaluate(() => {
    let mismatch = 0, moved = 0, total = 0;
    for (let n = 1; n <= 17; n++) {
      pendingMode = 'exam'; startExam(n);
      state.questions.forEach(q => {
        const orig = EXAMS[q.examNum][q.origIdx];
        total++;
        const origCorrect = orig.a.map(i => orig.o[i]).sort().join('|');
        const newCorrect = q.a.map(i => q.o[i]).sort().join('|');
        if (origCorrect !== newCorrect) mismatch++;
        if ([...q.o].sort().join('|') !== [...orig.o].sort().join('|')) mismatch++;
        if (q.o.join('|') !== orig.o.join('|')) moved++;
      });
    }
    // second run of same exam gives different order
    pendingMode = 'practice'; startExam(1); const a1 = state.questions.map(q => q.o.join('|')).join('#');
    startExam(1); const a2 = state.questions.map(q => q.o.join('|')).join('#');
    return { total, mismatch, moved, differentBetweenRuns: a1 !== a2 };
  });
  console.log(JSON.stringify(r));
  if (r.mismatch !== 0 || r.moved < r.total * 0.5 || !r.differentBetweenRuns) { console.log('FAIL'); process.exit(1); }
  await b.close();
  console.log('SHUFFLE PASS');
})();
