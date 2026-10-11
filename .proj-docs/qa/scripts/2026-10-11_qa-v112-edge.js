// QA v1.1.2 edge cases for the S168 地區議會 memo: E1 Practice wrong answer still shows the memo table;
// E2 280px (below supported 320) page never scrolls sideways; E3 Study search "council" finds #203 with its table;
// E4 the memo's table HTML contains no unescaped tag other than the table markup
const { chromium } = require('playwright-core');
const path = require('path');
const ROOT = process.env.QA_ROOT || path.resolve(__dirname, '../../..');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
(async () => {
  const opts = { args: ['--no-sandbox'] }; if (process.env.CHROMIUM_PATH) opts.executablePath = process.env.CHROMIUM_PATH;
  const b = await chromium.launch(opts); const errs = [];
  for (const width of [390, 280]) {
    const pg = await b.newPage({ viewport: { width, height: 800 } }); pg.on('pageerror', e => errs.push(e.message));
    await pg.goto('file://' + ROOT + '/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload();
    for (const [e, i] of [[9, 14], [12, 18], [12, 5]]) {
      const r = await pg.evaluate(({ e, i }) => {
        pendingMode = 'practice'; startExam(e);
        state.current = state.questions.findIndex(q => q.examNum === e && q.origIdx === i); renderQuestion();
        const q = state.questions[state.current]; selectOption((q.a[0] + 1) % q.o.length);
        const box = document.getElementById('ansNote'), w = box.querySelector('.note-table-wrap');
        return { vis: box.offsetParent !== null, rows: box.querySelectorAll('.note-table tr').length, sw: w && w.scrollWidth, cw: w && w.clientWidth, docW: document.documentElement.scrollWidth, vw: innerWidth,
          tags: [...new Set([...box.querySelectorAll('.ans-note-text *')].map(n => n.tagName))].sort().join(',') };
      }, { e, i });
      ok(r.vis && r.rows === 4, `${width}px E${e} Q${i + 1} wrong answer: answer box shows the 4-row memo table`);
      ok(r.docW <= r.vw, `${width}px E${e} Q${i + 1}: page no horizontal scroll (${r.docW}/${r.vw}); table scroll ${r.sw}/${r.cw}`);
      if (width === 390) ok(r.tags === 'DIV,SPAN,TABLE,TBODY,TD,TH,THEAD,TR', `E${e} Q${i + 1}: .ans-note-text markup only DIV/SPAN/table tags (${r.tags})`);
    }
    const s = await pg.evaluate(() => {
      openStudy(); studySetTab('chapters'); studySetSearch('council');
      const c = document.querySelector('#studyContent .fact[data-fact-id="203"]'); if (!c) return null;
      const d = c.querySelector('details.fact-mem'); d.open = true;
      const w = d.querySelector('.note-table-wrap');
      return { rows: d.querySelectorAll('tr').length, sw: w.scrollWidth, cw: w.clientWidth, docW: document.documentElement.scrollWidth, vw: innerWidth };
    });
    ok(s && s.rows === 4 && s.docW <= s.vw, `${width}px Study search "council": #203 shown with 4-row table, page no scroll ${JSON.stringify(s)}`);
    await pg.close();
  }
  ok(errs.length === 0, 'no page errors ' + JSON.stringify(errs));
  await b.close(); console.log(fail ? `QA112-EDGE FAIL (${fail})` : 'QA112-EDGE PASS'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
