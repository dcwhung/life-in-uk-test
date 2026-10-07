// CUI-0013 edge cases, real pointer clicks (lang via #langBtn); writes the 320 zh-HK multi screenshot
const { chromium } = require('playwright-core');
const path = require('path');
const ROOT = path.resolve(process.argv[2]); const SHOT = process.argv[3]; const TAG = process.argv[4] || 'head';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? 'ok:' : 'FAIL:', m); };
const measure = pg => pg.evaluate(() => {
  const card = document.querySelector('.q-card'), cs = getComputedStyle(card), cr = card.getBoundingClientRect();
  const cRight = cr.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight);
  const nx = byId('quickNext').getBoundingClientRect(), fl = byId('flagBtn').getBoundingClientRect();
  const hit = document.elementFromPoint(nx.left + nx.width / 2, nx.top + nx.height / 2);
  const qn = byId('qNum').getBoundingClientRect(), qt = byId('qText').getBoundingClientRect();
  const hdr = document.querySelector('.q-num').getBoundingClientRect();
  return { over: nx.right - cRight, flagOver: fl.width ? fl.right - cRight : null, hitOk: hit === byId('quickNext'), hdrBottom: hdr.bottom, qTextTop: qt.top,
    text: byId('qNum').textContent, sw: document.documentElement.scrollWidth, iw: document.documentElement.clientWidth, cur: state.current, nxW: nx.width };
});
async function open(b, w, lang) {
  const ctx = await b.newContext({ viewport: { width: w, height: 844 }, deviceScaleFactor: 2 }); const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + path.join(ROOT, 'index.html')); await pg.evaluate(() => localStorage.clear()); await pg.reload();
  if (lang === 'zh-HK') { await pg.click('#langBtn'); await sleep(80); }
  return { ctx, pg, errs };
}
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  for (const lang of ['en', 'zh-HK']) {
    // E1 exam, real clicks, 320: → is hit-testable and moves on; flag button inside; header does not overlap question text
    let { ctx, pg, errs } = await open(b, 320, lang);
    await pg.click('#modeExam'); await sleep(420); await pg.click('#examGrid [data-arg="1"]'); await sleep(420);
    let m = await measure(pg);
    ok(m.over <= 0.5 && m.hitOk && m.nxW >= 31, `E1 ${lang} 320 exam Q1 multi: → inside content box (${m.over.toFixed(1)}), elementFromPoint hits #quickNext, width ${m.nxW}`);
    ok(m.flagOver === null || m.flagOver <= 0.5, `E1 ${lang} 320 exam: flag button inside content box (${m.flagOver})`);
    ok(m.hdrBottom <= m.qTextTop + 0.5, `E1 ${lang} 320 exam: wrapped header does not overlap question text (${m.hdrBottom.toFixed(1)} <= ${m.qTextTop.toFixed(1)})`);
    if (lang === 'zh-HK' && SHOT) await pg.screenshot({ path: path.join(SHOT, `zh-HK_quiz-exam-multi_320_${TAG}.png`), clip: await pg.$eval('.q-card', e => { const r = e.getBoundingClientRect(); return { x: 0, y: Math.max(0, r.top + scrollY - 70), width: 320, height: r.height + 140 }; }) });
    if (lang === 'en' && SHOT) await pg.screenshot({ path: path.join(SHOT, `en_quiz-exam-multi_320_${TAG}.png`), clip: await pg.$eval('.q-card', e => { const r = e.getBoundingClientRect(); return { x: 0, y: Math.max(0, r.top + scrollY - 70), width: 320, height: r.height + 140 }; }) });
    await pg.click('#quickNext'); await sleep(420);
    ok((await pg.evaluate(() => state.current)) === 1, `E1 ${lang} 320 exam: real click on → moves to Q2`);
    // E2 live resize 390 → 300 → 320 on a multi question without re-render (pure CSS reflow)
    await pg.setViewportSize({ width: 390, height: 844 }); await pg.click('#navDots .dot:nth-child(1)'); await sleep(420);
    for (const w of [300, 320]) { await pg.setViewportSize({ width: w, height: 844 }); await sleep(80); m = await measure(pg);
      ok(m.over <= 0.5 && m.sw <= m.iw, `E2 ${lang} resize → ${w}px (no re-render): → inside (${m.over.toFixed(1)}), scrollWidth ${m.sw}<=${m.iw}`); }
    // E3 below-spec 280px (Galaxy Fold cover), informative + must not overflow
    await pg.setViewportSize({ width: 280, height: 844 }); await sleep(80); m = await measure(pg);
    ok(m.over <= 0.5, `E3 ${lang} 280px exam multi: → inside (${m.over.toFixed(1)})`);
    // E4 two-digit number + multi: jump to last question that is multi in Exam 5 (E5Q20)
    await pg.setViewportSize({ width: 320, height: 844 });
    await pg.evaluate(() => { pendingMode = 'exam'; });
    console.log('  pageerrors', errs.length); await ctx.close();
    // E5 practice, answer the multi question by real option clicks, 320
    ({ ctx, pg, errs } = await open(b, 320, lang));
    await pg.click('#modePractice'); await sleep(420); await pg.click('#ptabExam'); await sleep(80); await pg.click('#examGrid [data-arg="5"]'); await sleep(420);
    const idx = await pg.evaluate(() => state.questions.findIndex(q => q.a.length > 1));
    if (idx >= 0) {
      await pg.click(`#navDots .dot:nth-child(${idx + 1})`); await sleep(420);
      const a = await pg.evaluate(() => state.questions[state.current].a);
      for (const i of a) { await pg.click(`#opt${i}`); await sleep(60); }
      m = await measure(pg);
      ok(/select|選擇/.test(m.text) && m.over <= 0.5 && m.hitOk, `E5 ${lang} 320 practice Exam5 Q${idx + 1} (2-digit if >9) answered by clicks: → inside (${m.over.toFixed(1)}), hit-testable, header "${m.text.slice(0, 40)}"`);
      ok(m.hdrBottom <= m.qTextTop + 0.5, `E5 ${lang} 320 practice: header (with score pill) does not overlap question text`);
      await pg.click('#quickNext'); await sleep(420);
      ok((await pg.evaluate(() => state.current)) === idx + 1, `E5 ${lang} 320 practice: real click on → moves on`);
    } else ok(false, 'E5 no multi question in practice Exam 5');
    console.log('  pageerrors', errs.length); ok(errs.length === 0, `${lang}: no page errors`); await ctx.close();
  }
  console.log(`${pass} passed, ${fail} failed`); await b.close();
})();
