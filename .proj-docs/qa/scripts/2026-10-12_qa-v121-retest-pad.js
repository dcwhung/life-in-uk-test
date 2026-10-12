// QA v1.2.1 re-test (CUI-0028): computed padding of Study card / memory box / note-table cells (Study, Practice, Results)
// usage: node <this> <root> <w1,w2,..> [lang] -> one JSON line per width (compare HEAD vs origin/main)
const { chromium } = require('playwright-core');
const ROOT = process.argv[2], WIDTHS = process.argv[3].split(',').map(Number), LANG = process.argv[4] || 'en';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
  for (const width of WIDTHS) {
    const pg = await b.newPage({ viewport: { width, height: 844 } });
    await pg.goto('file://' + ROOT + '/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload();
    await pg.evaluate(l => setLang(l), LANG);
    const r = await pg.evaluate(() => {
      const p = el => { if (!el) return null; const s = getComputedStyle(el); return [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map(parseFloat).join('/'); };
      const out = {};
      openStudy(); studySetTab('chapters'); studySetChapter(4);
      const cards = [...document.querySelectorAll('#studyContent .fact')].filter(c => c.querySelector('details.fact-mem .note-table'));
      const card = cards.find(c => c.dataset.factId === '124') || cards[0]; out.fact = card.dataset.factId;
      const d = card.querySelector('details.fact-mem'); d.open = true;
      out.studyCard = p(card); out.memBox = p(d); out.memBody = p(d.querySelector('.fact-mem-body'));
      out.studyCell = p(d.querySelector('.note-table td')); out.studyWrapW = d.querySelector('.note-table-wrap').clientWidth;
      const e = Object.keys(EXAMS).map(Number).find(n => EXAMS[n].some(q => (q.note || '').includes('|')));
      const i = EXAMS[e].findIndex(q => (q.note || '').includes('|'));
      pendingMode = 'practice'; startExam(e); state.current = state.questions.findIndex(x => x.examNum === e && x.origIdx === i);
      renderQuestion(); state.questions[state.current].a.forEach(selectOption);
      out.practiceNote = p(document.getElementById('ansNote')); out.practiceCell = p(document.querySelector('#ansNote .note-table td'));
      pendingMode = 'exam'; startExam(e); state.questions.forEach((q, j) => { state.answers[j] = [...q.a]; }); finishExam();
      out.resultsCell = p(document.querySelector('#reviewList .note-table td'));
      return out;
    });
    console.log(JSON.stringify({ root: ROOT.split('/').pop(), lang: LANG, width, ...r }));
    await pg.close();
  }
  await b.close();
})();
