// QA v1.0.7 edge cases: (1) all 101 table questions in Practice at 320 / 375 / 412 px; (2) ④ "650 / 全英國 MP"
// line count at 320..1280 in Practice + Study; (3) noteHtml malformed-input behaviour (CRLF, ragged rows, empty
// cells, <BR>/<br/>, "||", indented rows, table-only note) — no throw, no markup injection
const { chromium } = require('playwright-core');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const isTable = n => (n || '').split('\n').some(l => l.trim().startsWith('|'));

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
  const errs = [];
  for (const vw of [320, 375, 412]) {
    const pg = await b.newPage({ viewport: { width: vw, height: 800 } });
    pg.on('pageerror', e => errs.push(e.message));
    await pg.goto('file://' + ROOT + '/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload();
    const r = await pg.evaluate(() => {
      const over = {}; let n = 0; let pageScroll = 0;
      for (const e of Object.keys(EXAMS)) {
        pendingMode = 'practice'; startExam(Number(e));
        EXAMS[e].forEach((q, i) => {
          if (!(q.note || '').split('\n').some(l => l.trim().startsWith('|'))) return;
          state.current = state.questions.findIndex(x => x.examNum === Number(e) && x.origIdx === i);
          renderQuestion(); q.a.forEach(selectOption); n++;
          const w = document.querySelector('#ansNote .note-table-wrap');
          if (document.documentElement.scrollWidth > innerWidth) pageScroll++;
          if (w.scrollWidth > w.clientWidth) { const hdr = w.querySelector('th').textContent; (over[hdr] = over[hdr] || []).push(`${e}.${i + 1}:+${w.scrollWidth - w.clientWidth}`); }
        });
      }
      return { n, over, pageScroll };
    });
    console.log(`Practice ${vw}px: ${r.n} table questions, page-scroll ${r.pageScroll}, wrap overflow by header:`, JSON.stringify(Object.fromEntries(Object.entries(r.over).map(([h, l]) => [h, [l.length, l[0]]]))));
    await pg.close();
  }
  // ④ MP cell lines
  for (const vw of [320, 340, 360, 375, 390, 412, 768, 1280]) {
    const pg = await b.newPage({ viewport: { width: vw, height: 800 } });
    await pg.goto('file://' + ROOT + '/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload();
    const r = await pg.evaluate(() => {
      const lines = root => { const s = [...root.querySelectorAll('.note-cell-sub')].find(x => /MP$/.test(x.textContent)); const rg = document.createRange(); rg.selectNodeContents(s.parentElement); return new Set([...rg.getClientRects()].filter(x => x.width > 0).map(x => Math.round(x.top))).size; };
      pendingMode = 'practice'; startExam(6); state.current = state.questions.findIndex(x => x.examNum === 6 && x.origIdx === 8); renderQuestion(); selectOption(state.questions[state.current].a[0]);
      const p = lines(document.getElementById('ansNote'));
      openStudy(); studySetTab('chapters');
      const f = STUDY.find(f => factMemoryText(f).includes('全⁠英'));
      studySetChapter(f.ch); const d = document.querySelector(`#studyContent .fact[data-fact-id="${f.id}"] details.fact-mem`); d.open = true;
      return { practice: p, study: lines(d) };
    });
    console.log(`④ 議員 cell lines @${vw}px:`, JSON.stringify(r));
    await pg.close();
  }
  // noteHtml malformed input
  const pg = await b.newPage();
  await pg.goto('file://' + ROOT + '/index.html');
  const cases = {
    crlf: '記憶法：\r\n| A | B |\r\n| 1 | 2 |\r\n• x',
    ragged: '| A | B | C |\n| 1 |\n| 1 | 2 | 3 | 4 |',
    emptyCell: '| A |  |\n|  | x |',
    upperBr: '| A | x<BR>y |\n| b | p<br/>q |',
    emptyRemark: '| A | x<br> |\n| b | <br>q |',
    doublePipe: '|| A ||\n| 1 || 2 |',
    indented: '  | A | B |\n    | 1 | 2 |',
    noClosingPipe: '| A | B\n| 1 | 2',
    inject: '| A | x<br><img src=x onerror=alert(1)> |\n| "><svg/onload=alert(1)> | b |',
    onlyPipe: '|',
  };
  const out = await pg.evaluate(cases => Object.fromEntries(Object.entries(cases).map(([k, v]) => {
    try {
      const d = document.createElement('div'); d.innerHTML = noteHtml(v);
      const t = d.querySelector('table');
      return [k, { rows: t ? [...t.rows].map(r => [...r.cells].map(c => (c.className ? c.className + ':' : '') + JSON.stringify(c.textContent))) : null,
        seq: [...d.children].map(c => c.className), danger: d.querySelectorAll('img,svg,script').length }];
    } catch (e) { return [k, { throw: e.message }]; }
  })), cases);
  for (const [k, v] of Object.entries(out)) console.log('unit', k, JSON.stringify(v));
  console.log('page errors', JSON.stringify(errs));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
