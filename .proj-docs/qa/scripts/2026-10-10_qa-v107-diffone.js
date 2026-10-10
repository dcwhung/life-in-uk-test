// QA v1.0.7: print Practice #ansNote HTML for given question keys (exam.idx0) in two app copies, to diff
const { chromium } = require('playwright-core');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
  for (const dir of [ROOT, process.argv[2]]) {
    const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
    await pg.goto('file://' + dir + '/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload();
    for (const key of process.argv.slice(3)) {
      const h = await pg.evaluate(key => { const [e, i] = key.split('.').map(Number); pendingMode = 'practice'; startExam(e);
        state.current = state.questions.findIndex(x => x.examNum === e && x.origIdx === i); renderQuestion(); selectOption(state.questions[state.current].a[0]);
        return { note: EXAMS[e][i].note, html: document.getElementById('ansNote').innerHTML }; }, key);
      console.log(dir === ROOT ? 'BRANCH' : 'MAIN', key, JSON.stringify(h));
    }
    await pg.close();
  }
  await b.close();
})();
