const { chromium } = require('playwright-core'); const path = require('path');
const ROOT = path.resolve(process.argv[2]);
const measure = sel => [...document.querySelectorAll(sel + ' .rv-note-line')].map(r => {
  const mark = r.querySelector('.note-mark'); const tn = [...r.childNodes].filter(n => n.nodeType === 3);
  const rg = document.createRange(); const rects = []; tn.forEach(n => { rg.selectNodeContents(n); rects.push(...rg.getClientRects()); });
  const lines = []; rects.forEach(x => { const l = lines.find(L => Math.abs(L.top - x.top) < 4); if (l) l.left = Math.min(l.left, x.left); else lines.push({ top: x.top, left: x.left }); });
  lines.sort((a, b) => a.top - b.top); const rb = r.getBoundingClientRect(); const pl = parseFloat(getComputedStyle(r).paddingLeft);
  return { cls: r.className.replace('rv-note-line', '').trim(), n: lines.length, markL: mark ? +(mark.getBoundingClientRect().left - rb.left).toFixed(2) : null, first: lines[0] ? +(lines[0].left - rb.left).toFixed(2) : null,
    rest: [...new Set(lines.slice(1).map(l => +(l.left - rb.left).toFixed(2)))], pl };
});
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.CHROMIUM_PATH });
  const bad = []; let wrapped = 0, rowsN = 0;
  for (const w of [320, 390, 900]) {
    const pg = await b.newPage({ viewport: { width: w, height: 900 } });
    await pg.goto('file://' + path.join(ROOT, 'index.html'));
    // every question with a note, Practice answer box + results review
    const res = await pg.evaluate(([w, measureSrc]) => { const measure = eval(measureSrc); const out = [];
      for (let e = 1; e <= 17; e++) { pendingMode = 'exam'; startExam(e); state.questions.forEach((q, i) => { state.answers[i] = [...q.a]; }); finishExam();
        document.querySelectorAll('#reviewList .review-item').forEach((it, i) => { it.id = it.id || ('rvq' + i); measure('#' + it.id + ' .rv-note').forEach(m => out.push({ where: 'rv', e, i, ...m })); });
        goHome(); pendingMode = 'practice';
        for (let i = 0; i < EXAMS[e].length; i++) { if (!EXAMS[e][i].note || !EXAMS[e][i].note.includes('\n')) continue;
          startExam(e); state.current = state.questions.findIndex(q => qKey(q) === e + '.' + i); if (state.current < 0) continue; renderQuestion();
          const q = state.questions[state.current]; state.answers[state.current] = [...q.a]; revealAnswer();
          measure('#ansNote').forEach(m => out.push({ where: 'ans', e, i, ...m })); goHome(); } }
      return out; }, [w, `(${measure.toString()})`]);
    for (const m of res) { rowsN++; if (m.n > 1) wrapped++;
      const textStart = m.cls ? (m.markL !== null ? m.markL + (m.cls === 'sub' ? 0 : 0) : null) : null;
      // with a marker: every wrapped line starts where the text after the marker starts (first)
      if (m.markL !== null && m.rest.some(x => Math.abs(x - m.first) > 0.6)) bad.push({ w, ...m });
      // no marker: wrapped lines start at the row padding (0 for plain rows)
      if (m.markL === null && m.cls === '' && m.rest.some(x => Math.abs(x) > 0.6)) bad.push({ w, ...m }); }
    await pg.close();
  }
  console.log('rows', rowsN, 'wrapped', wrapped, 'bad', bad.length, JSON.stringify(bad.slice(0, 6)));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
