const { chromium } = require('playwright-core');
const ROOT = process.argv[2], WIDTHS = process.argv[3].split(',').map(Number), LANG = process.argv[4] || 'en';
const FIT_JS = `(root) => [...root.querySelectorAll('.note-table-wrap')].map(w => {
  const lines = c => { const rg = document.createRange(); rg.selectNodeContents(c); return new Set([...rg.getClientRects()].filter(x => x.width > 0).map(x => Math.round(x.top))).size; };
  const broken = [...w.querySelectorAll('th:not(.multi), td:not(.multi)')].filter(c => c.textContent.trim() && lines(c) > 1).map(c => c.textContent);
  return { sw: w.scrollWidth, cw: w.clientWidth, broken: broken.length, docW: document.documentElement.scrollWidth };
})`;
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
  for (const width of WIDTHS) {
    const pg = await b.newPage({ viewport: { width, height: 844 } });
    await pg.goto('file://' + ROOT + '/index.html'); await pg.evaluate(() => localStorage.clear()); await pg.reload();
    await pg.evaluate(l => setLang(l), LANG);
    const r = await pg.evaluate(fitSrc => {
      const fit = new Function('return ' + fitSrc)(); const res = { practice: [0, []], results: [0, []], study: [0, []] };
      const bad = f => f.some(x => x.sw > x.cw || x.broken || x.docW > innerWidth);
      for (const e of Object.keys(EXAMS).map(Number)) {
        EXAMS[e].forEach((q, i) => { if (!(q.note || '').includes('|')) return;
          pendingMode = 'practice'; startExam(e); state.current = state.questions.findIndex(x => x.examNum === e && x.origIdx === i); if (state.current < 0) return;
          renderQuestion(); state.questions[state.current].a.forEach(selectOption);
          const f = fit(document.getElementById('ansNote')); if (!f.length) return; res.practice[0]++; if (bad(f)) res.practice[1].push(e + '.' + i + ':' + f.map(x => x.sw - x.cw).join()); });
        pendingMode = 'exam'; startExam(e); state.questions.forEach((q, j) => { state.answers[j] = [...q.a]; }); finishExam();
        document.querySelectorAll('#reviewList .review-item').forEach(it => { const f = fit(it); if (!f.length) return; res.results[0]++; const q = state.questions[Number(it.id.slice(2))]; if (bad(f)) res.results[1].push(q.examNum + '.' + q.origIdx + ':' + f.map(x => x.sw - x.cw).join()); });
      }
      openStudy();
      for (const ch of CHAPTER_NUMBERS) { studySetTab('chapters'); studySetChapter(ch);
        for (const c of document.querySelectorAll('#studyContent .fact')) { const d = c.querySelector('details.fact-mem'); if (!d) continue; d.open = true;
          const f = fit(d.querySelector('.fact-mem-body')); if (!f.length) continue; res.study[0]++; if (bad(f)) res.study[1].push('#' + c.dataset.factId + ':' + f.map(x => x.sw - x.cw).join()); } }
      return res;
    }, FIT_JS);
    console.log(ROOT.split('/').pop(), LANG, width, Object.entries(r).map(([k, [n, bad]]) => `${k} ${n} bad ${bad.length} [${bad.join(' ')}]`).join(' | '));
    await pg.close();
  }
  await b.close();
})();
