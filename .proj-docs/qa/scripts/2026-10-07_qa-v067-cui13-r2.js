// CUI-0013 Round 2 (hint removed): sweep every multi + single question, en/zh-HK × exam/practice(answered) × widths,
// then real-click answer flow (multi needs N picks, scoring), yue count-word log, screenshots.
// usage: NODE_PATH=... node 2026-10-07_qa-v067-cui13-r2.js <repoRoot> <shotDir> [widths]
const { chromium } = require('playwright-core');
const path = require('path');
const ROOT = path.resolve(process.argv[2]); const SHOT = process.argv[3];
const WIDTHS = (process.argv[4] || '320,360,390').split(',').map(Number);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? 'ok:' : 'FAIL:', m); };
async function open(b, w, lang) {
  const ctx = await b.newContext({ viewport: { width: w, height: 844 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + path.join(ROOT, 'index.html')); await pg.evaluate(() => localStorage.clear()); await pg.reload();
  if (lang === 'zh-HK') { await pg.click('#langBtn'); await sleep(80); }
  return { ctx, pg, errs };
}
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  // ── Part 1: sweep ──
  const yueLog = {};
  for (const lang of ['en', 'zh-HK']) {
    const { ctx, pg, errs } = await open(b, 390, lang);
    ok((await pg.evaluate(() => document.documentElement.lang)) === lang, `${lang}: UI language set (${await pg.evaluate(() => document.documentElement.lang)})`);
    for (const w of WIDTHS) {
      await pg.setViewportSize({ width: w, height: 844 });
      for (const mode of ['exam', 'practice']) {
        const r = await pg.evaluate(([m]) => {
          const WORD = { 2: 'two', 3: 'three', 4: 'four' };
          const res = { multi: [], singleN: 0, singleBad: [], multiBad: [], yue: [] };
          const measure = () => {
            const card = document.querySelector('.q-card'), cs = getComputedStyle(card), cr = card.getBoundingClientRect();
            const cRight = cr.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight);
            const nx = byId('quickNext').getBoundingClientRect();
            const span = byId('qNum').firstElementChild; const range = document.createRange(); range.selectNodeContents(span);
            const lines = new Set([...range.getClientRects()].map(x => Math.round(x.top))).size;
            const hdrH = byId('qNum').getBoundingClientRect().height;
            return { over: nx.right - cRight, nxVis: nx.width > 0, lines, hdrH, text: byId('qNum').textContent, qText: byId('qText').textContent };
          };
          for (let ex = 1; ex <= EXAM_COUNT; ex++) {
            localStorage.clear(); pendingMode = m; startExam(ex);
            for (let i = 0; i < state.questions.length; i++) {
              state.current = i; const q = state.questions[i]; let yueTxt = null;
              if (m === 'practice') {
                if (q.a.length > 1) { renderQuestion(); toggleQuestionYue(); yueTxt = byId('qYue').classList.contains('show') ? byId('qYue').textContent : null; }
                state.answers[i] = [...q.a]; renderQuestion(); revealAnswer();
              } else renderQuestion();
              const mm = measure(); const id = `E${q.examNum}Q${q.origIdx + 1}`;
              const hint = /select|選擇|項）/i.test(mm.text);
              if (q.a.length > 1) {
                const countOk = new RegExp(`\\b${WORD[q.a.length]}\\b`, 'i').test(mm.qText);
                res.multi.push({ id, n: q.a.length, over: +mm.over.toFixed(1), lines: mm.lines, hint, countOk, text: mm.text });
                if (hint || mm.lines !== 1 || mm.over > 0.5 || !mm.nxVis || !countOk) res.multiBad.push(`${id} hint=${hint} lines=${mm.lines} over=${mm.over.toFixed(1)} nxVis=${mm.nxVis} count=${countOk}`);
                if (yueTxt !== null) res.yue.push({ id, n: q.a.length, yue: yueTxt, q: q.q });
              } else {
                res.singleN++;
                if (hint || mm.lines !== 1 || mm.over > 0.5 || !mm.nxVis) res.singleBad.push(`${id} hint=${hint} lines=${mm.lines} over=${mm.over.toFixed(1)}`);
              }
            }
          }
          return res;
        }, [mode]);
        const maxOver = Math.max(...r.multi.map(x => x.over));
        ok(r.multi.length === 15 && r.multiBad.length === 0,
          `${lang} ${w} ${mode}: ${r.multi.length} multi — no hint, 1 line, → inside (maxOver ${maxOver}), count word in English${r.multiBad.length ? ' BAD: ' + r.multiBad.join('; ') : ''}`);
        ok(r.singleBad.length === 0, `${lang} ${w} ${mode}: ${r.singleN} single — no hint, 1 line, → inside${r.singleBad.length ? ' BAD: ' + r.singleBad.slice(0, 5).join('; ') : ''}`);
        if (w === WIDTHS[0] && mode === 'exam') console.log('  sample header:', JSON.stringify(r.multi[0].text), r.multi[0].id);
        if (mode === 'practice' && lang === 'zh-HK' && w === WIDTHS[0]) yueLog.list = r.yue;
      }
    }
    ok(errs.length === 0, `${lang}: no page errors in sweep (${errs.length})`); await ctx.close();
  }
  // yue count-word log (record only, S-061)
  console.log('── zh-HK practice 翻譯 (yue) count words — record only ──');
  const CN = { 2: /兩|二|2/, 3: /三|3/ };
  let yueHas = 0;
  (yueLog.list || []).forEach(y => { const has = CN[y.n].test(y.yue); if (has) yueHas++; console.log(`  ${y.id} n=${y.n} yueHasCount=${has} | ${y.yue}`); });
  console.log(`  yue with count word: ${yueHas}/${(yueLog.list || []).length}`);

  // ── Part 2: real-click flow + screenshots ──
  for (const lang of ['en', 'zh-HK']) {
    // F1 exam E1, 320: Q1 multi screenshot, multi pick cap + toggle, partial = unanswered, score
    let { ctx, pg, errs } = await open(b, 320, lang);
    await pg.click('#modeExam'); await sleep(420); await pg.click('#examGrid [data-arg="1"]'); await sleep(420);
    const q1 = await pg.evaluate(() => ({ n: state.questions[0].a.length, a: state.questions[0].a, o: state.questions[0].o.length, hdr: byId('qNum').textContent }));
    ok(q1.n > 1 && !/select|選擇/i.test(q1.hdr), `F1 ${lang} E1 Q1 is multi (${q1.n}) and header "${q1.hdr}" has no hint`);
    const clip = await pg.$eval('.q-card', e => { const r = e.getBoundingClientRect(); return { x: 0, y: Math.max(0, r.top + scrollY - 70), width: 320, height: r.height + 140 }; });
    await pg.screenshot({ path: path.join(SHOT, `${lang}_quiz-exam-multi_E1Q1_320.png`), clip });
    // cap: click every option → only N selected
    for (let i = 0; i < q1.o; i++) { await pg.click(`#opt${i}`); await sleep(40); }
    let sel = await pg.evaluate(() => state.answers[0].length);
    ok(sel === q1.n, `F1 ${lang} exam multi: clicking all ${q1.o} options keeps ${q1.n} picks (got ${sel})`);
    // toggle off one → partial
    const firstPicked = await pg.evaluate(() => state.answers[0][0]);
    await pg.click(`#opt${firstPicked}`); await sleep(40);
    sel = await pg.evaluate(() => ({ len: state.answers[0].length, selCls: document.querySelectorAll('#optionsContainer .opt.selected').length }));
    ok(sel.len === q1.n - 1 && sel.selCls === q1.n - 1, `F1 ${lang} exam multi: tap a pick again deselects (${sel.len} picks, ${sel.selCls} .selected)`);
    // Set answers: Q1 partial (1 of N), Q2.. correct except: first other multi → wrong combo, first single (after Q1) → wrong
    const plan = await pg.evaluate(() => {
      const qs = state.questions; let wrongMulti = -1, wrongSingle = -1;
      qs.forEach((q, i) => { if (i === 0) return; if (q.a.length > 1 && wrongMulti < 0) wrongMulti = i; else if (q.a.length === 1 && wrongSingle < 0) wrongSingle = i; });
      return { total: qs.length, wrongMulti, wrongSingle };
    });
    for (let i = 1; i < plan.total; i++) {
      await pg.evaluate(i => goToQuestion(i), i); await sleep(20);
      const q = await pg.evaluate(() => { const q = state.questions[state.current]; return { a: q.a, o: q.o.length }; });
      let picks = q.a;
      if (i === plan.wrongMulti) { const wrongOpt = [...Array(q.o).keys()].find(k => !q.a.includes(k)); picks = [q.a[0], wrongOpt]; }
      if (i === plan.wrongSingle) picks = [[...Array(q.o).keys()].find(k => !q.a.includes(k))];
      for (const p of picks) { await pg.click(`#opt${p}`); await sleep(15); }
      if (i === plan.wrongSingle) { // single regression: second click replaces, not adds
        const alt = q.a[0]; await pg.click(`#opt${alt}`); await sleep(15);
        const s = await pg.evaluate(() => state.answers[state.current]);
        ok(s.length === 1 && s[0] === alt, `F1 ${lang} exam single Q${i + 1}: second click replaces pick (${JSON.stringify(s)})`);
        await pg.click(`#opt${picks[0]}`); await sleep(15);
      }
    }
    await pg.click('#quickNext'); await sleep(300); // last question → Submit
    // pre-existing (v0.57+): isAnswered = any pick, so a partial multi pick counts as "answered" (dot done, no submit warning);
    // it still scores wrong. Record it; not a CUI-0013 regression.
    const partialAnswered = await pg.evaluate(() => isAnswered(0));
    const modal = await pg.evaluate(() => getComputedStyle(byId('confirmModal')).display !== 'none' && byId('confirmModal').classList.contains('show'));
    console.log(`  note: partial multi (1 of ${q1.n}) isAnswered=${partialAnswered}, submit modal shown=${modal}`);
    if (modal) { await pg.click('#confirmOk'); await sleep(420); }
    ok(await pg.evaluate(() => byId('screenResult').classList.contains('active') || getComputedStyle(byId('screenResult')).display !== 'none'), `F1 ${lang} exam: submit opens results`);
    const score = await pg.evaluate(() => ({ txt: byId('resultScore').textContent, correct: reviewItems.filter(r => r.isCorrect).length, total: reviewItems.length,
      q1: reviewItems[0].isCorrect, wm: reviewItems.find((r, i) => i > 0 && r.q.a.length > 1 && !r.isCorrect) ? 1 : 0 }));
    const expect = plan.total - 3;
    ok(score.correct === expect && score.txt.startsWith(`${expect} `) && !score.q1, `F1 ${lang} exam score ${score.txt} == ${expect}/${plan.total} (Q1 partial wrong, Q${plan.wrongMulti + 1} multi wrong combo, Q${plan.wrongSingle + 1} single wrong)`);
    ok(errs.length === 0, `F1 ${lang}: no page errors`); await ctx.close();

    // F2 practice E1 at 320: multi needs N picks before reveal; correct / wrong; Translate shows yue; single reveals on 1 click
    ({ ctx, pg, errs } = await open(b, 320, lang));
    await pg.click('#modePractice'); await sleep(420); await pg.click('#ptabExam'); await sleep(80); await pg.click('#examGrid [data-arg="1"]'); await sleep(420);
    const multis = await pg.evaluate(() => state.questions.map((q, i) => q.a.length > 1 ? i : -1).filter(i => i >= 0));
    const singles = await pg.evaluate(() => state.questions.map((q, i) => q.a.length === 1 ? i : -1).filter(i => i >= 0));
    // multi #1 correct
    const doMulti = async (idx, correct) => {
      await pg.evaluate(i => goToQuestion(i), idx); await sleep(40);
      const q = await pg.evaluate(() => { const q = state.questions[state.current]; return { a: q.a, o: q.o.length }; });
      if (lang === 'zh-HK') {
        await pg.click('#yueToggle'); await sleep(40);
        const y = await pg.evaluate(() => ({ show: byId('qYue').classList.contains('show'), t: byId('qYue').textContent, btn: byId('yueToggle').textContent }));
        ok(y.show && y.t.length > 0, `F2 zh-HK practice Q${idx + 1}: real click 翻譯 shows yue ("${y.t}", button now "${y.btn}")`);
      }
      const picks = correct ? q.a : [q.a[0], [...Array(q.o).keys()].find(k => !q.a.includes(k))];
      await pg.click(`#opt${picks[0]}`); await sleep(40);
      const mid = await pg.evaluate(() => ({ rev: state.current in state.revealed, box: byId('answerBox').classList.contains('show') }));
      ok(!mid.rev && !mid.box, `F2 ${lang} practice multi Q${idx + 1}: 1 of ${q.a.length} picks → not revealed yet`);
      for (const p of picks.slice(1)) { await pg.click(`#opt${p}`); await sleep(40); }
      const end = await pg.evaluate(() => ({ rev: state.current in state.revealed, ok: state.revealed[state.current], box: byId('answerBox').className, hdr: byId('qNum').textContent }));
      ok(end.rev && end.ok === correct && /show/.test(end.box) && (correct ? !/wrong/.test(end.box) : /wrong/.test(end.box)) && !/select|選擇/i.test(end.hdr),
        `F2 ${lang} practice multi Q${idx + 1}: ${q.a.length} picks → revealed ${correct ? 'correct' : 'wrong'} (box "${end.box}"), header "${end.hdr}"`);
    };
    await doMulti(multis[0], true);
    if (multis[1] !== undefined) await doMulti(multis[1], false);
    await pg.evaluate(i => goToQuestion(i), singles[0]); await sleep(40);
    const sa = await pg.evaluate(() => state.questions[state.current].a[0]);
    await pg.click(`#opt${sa}`); await sleep(40);
    const sr = await pg.evaluate(() => ({ rev: state.current in state.revealed, ok: state.revealed[state.current] }));
    ok(sr.rev && sr.ok === true, `F2 ${lang} practice single Q${singles[0] + 1}: 1 click reveals correct`);
    // finish → score = correct ones among answered (unanswered count wrong)
    await pg.evaluate(() => finishExam()); await sleep(300);
    const ps = await pg.evaluate(() => ({ correct: reviewItems.filter(r => r.isCorrect).length, txt: byId('resultScore').textContent }));
    ok(ps.correct === 2 && ps.txt.startsWith('2 '), `F2 ${lang} practice result: ${ps.txt} (expected 2 correct: multi correct + single)`);
    ok(errs.length === 0, `F2 ${lang}: no page errors`); await ctx.close();
  }
  console.log(`${pass} passed, ${fail} failed`); await b.close();
})();
