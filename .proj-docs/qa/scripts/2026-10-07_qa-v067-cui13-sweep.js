// CUI-0013 sweep: every exam × every question × en/zh-HK × exam/practice(answered) × widths
const { chromium } = require('playwright-core');
const path = require('path');
const ROOT = path.resolve(process.argv[2]);
const WIDTHS = (process.argv[3] || '320,340,360,375,390').split(',').map(Number);
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + path.join(ROOT, 'index.html'));
  await pg.evaluate(() => localStorage.clear()); await pg.reload();
  const nExams = await pg.evaluate(() => EXAM_COUNT);
  const out = {};
  for (const lang of ['en', 'zh-HK']) {
    await pg.evaluate(l => { localStorage.clear(); setLang(l); }, lang);
    for (const w of WIDTHS) {
      await pg.setViewportSize({ width: w, height: 844 });
      for (const mode of ['exam', 'practice']) {
        const r = await pg.evaluate(([m, nEx]) => {
          const res = { multiMax: -1e9, singleMax: -1e9, multiN: 0, singleN: 0, singleWrap: [], multiLinesMax: 0, prevOut: 0, worst: '' };
          for (let ex = 1; ex <= nEx; ex++) {
            pendingMode = m; startExam(ex);
            for (let i = 0; i < state.questions.length; i++) {
              state.current = i; const q = state.questions[i];
              if (m === 'practice') { state.answers[i] = [...q.a]; renderQuestion(); revealAnswer(); } else renderQuestion();
              const card = document.querySelector('.q-card'), cs = getComputedStyle(card), cr = card.getBoundingClientRect();
              const contentRight = cr.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight);
              const nx = byId('quickNext').getBoundingClientRect(), pv = byId('quickPrev').getBoundingClientRect();
              const over = nx.right - contentRight;
              const range = document.createRange(); range.selectNodeContents(byId('qNum').firstElementChild);
              const lines = new Set([...range.getClientRects()].map(r => Math.round(r.top))).size;
              if (nx.width < 30 || pv.right > nx.left + 0.5) res.prevOut++;
              if (q.a.length > 1) { res.multiN++; if (over > res.multiMax) { res.multiMax = over; res.worst = `E${ex}Q${i + 1}`; } res.multiLinesMax = Math.max(res.multiLinesMax, lines); }
              else { res.singleN++; res.singleMax = Math.max(res.singleMax, over); if (lines > 1) res.singleWrap.push(`E${ex}Q${i + 1}`); }
            }
          }
          return res;
        }, [mode, nExams]);
        out[`${lang} ${w} ${mode}`] = r;
        console.log(`${lang.padEnd(5)} ${w} ${mode.padEnd(8)} multi n=${r.multiN} maxOver=${r.multiMax.toFixed(1)} (${r.worst}) lines<=${r.multiLinesMax} | single n=${r.singleN} maxOver=${r.singleMax.toFixed(1)} wraps=${r.singleWrap.length}${r.singleWrap.length ? ' ' + r.singleWrap.slice(0, 5).join(',') : ''} | btnIssues=${r.prevOut}`);
      }
    }
  }
  console.log('pageerrors:', errs.length, errs.slice(0, 3).join(' | '));
  await b.close();
})();
