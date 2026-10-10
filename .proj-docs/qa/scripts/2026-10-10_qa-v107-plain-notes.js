// QA v1.0.7: notes WITHOUT tables are unchanged vs origin/main — data (note text) and rendered DOM
// (Practice #ansNote innerHTML + Study 記憶法 body) for every question / fact outside the 101 table questions.
// args: <dir with origin/main copy (git archive)>
const { chromium } = require('playwright-core');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const MAIN = process.argv[2];
const isTable = n => (n || '').split('\n').some(l => l.trim().startsWith('|'));

async function collect(b, dir) {
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  await pg.goto('file://' + dir + '/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload();
  const r = await pg.evaluate(() => {
    const out = { notes: {}, practice: {}, study: {} };
    for (const e of Object.keys(EXAMS)) {
      pendingMode = 'practice'; startExam(Number(e));
      EXAMS[e].forEach((q, i) => {
        const key = `${e}.${i}`;
        out.notes[key] = q.note || '';
        state.current = state.questions.findIndex(x => x.examNum === Number(e) && x.origIdx === i);
        renderQuestion(); state.questions[state.current].a.forEach(selectOption);
        out.practice[key] = document.getElementById('ansNote').innerHTML;
      });
    }
    STUDY.forEach(f => { out.study[f.id] = (typeof factMemoryText === 'function') ? noteHtml(factMemoryText(f)) : null; });
    return out;
  });
  await pg.close();
  return r;
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
  const now = await collect(b, ROOT), old = await collect(b, MAIN);
  const keys = Object.keys(now.notes);
  const tableKeys = keys.filter(k => isTable(now.notes[k]));
  const plain = keys.filter(k => !isTable(now.notes[k]));
  const dataDiff = plain.filter(k => now.notes[k] !== old.notes[k]);
  const renderDiff = plain.filter(k => now.practice[k] !== old.practice[k]);
  const studyIds = Object.keys(now.study).filter(id => !(now.study[id] || '').includes('note-table'));
  const studyDiff = studyIds.filter(id => now.study[id] !== old.study[id]);
  const changedTable = tableKeys.filter(k => now.notes[k] !== old.notes[k]);
  console.log(JSON.stringify({ total: keys.length, tableQs: tableKeys.length, tableChanged: changedTable.length, plain: plain.length, dataDiff, renderDiff, studyFactsNoTable: studyIds.length, studyDiff }));
  console.log('E1Q6 note:', JSON.stringify(now.notes['1.5']).slice(0, 0), JSON.stringify(now.notes['1.5'] === old.notes['1.5']));
  const tudor = keys.filter(k => now.notes[k].includes('都鐸')).slice(0, 5);
  console.log('Tudor sample', tudor.map(k => [k, now.notes[k] === old.notes[k], now.practice[k] === old.practice[k]]));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
