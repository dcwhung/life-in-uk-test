// QA v0.71 delta: icon swap shots + edge cases. node qa071d-icons.js <root> <out>
//   NODE_PATH=/opt/node-tools/node_modules CHROMIUM_PATH=/opt/pw-browsers/chromium node .proj-docs/qa/scripts/2026-10-08_qa-v071-delta-icons.js <repo-root> <out-dir>
const { chromium } = require('playwright-core'); const path = require('path'); const fs = require('fs');
const ROOT = path.resolve(process.argv[2]); const OUT = path.resolve(process.argv[3]); fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('ok:', m); } else { fail++; console.log('FAIL:', m); } };
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.CHROMIUM_PATH });
  const open = async (lang, w = 390) => {
    const ctx = await b.newContext({ viewport: { width: w, height: 844 }, hasTouch: true });
    const pg = await ctx.newPage(); pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message)); pg.on('console', m => { if (/missing key/.test(m.text())) pg.errs.push(m.text()); });
    await pg.goto('file://' + path.join(ROOT, 'index.html'));
    await pg.evaluate(l => { localStorage.clear(); localStorage.setItem('lifeuk.installDismissed', 'true'); localStorage.setItem('lifeuk.uiLang', JSON.stringify(l)); }, lang);
    await pg.reload(); await pg.waitForTimeout(300); return pg; };
  const txt = (pg, s) => pg.$eval(s, e => e.textContent.replace(/\s+/g, ' ').trim());
  const noH = pg => pg.evaluate(() => document.scrollingElement.scrollWidth <= window.innerWidth);
  for (const lang of ['en', 'zh-HK']) {
    const L = lang === 'en' ? 'en' : 'zh';
    let pg = await open(lang);
    ok(await txt(pg, '#modePractice .mode-icon') === '📝' && await txt(pg, '#modeExam .mode-icon') === '🎯', `[${L}] home cards Practice 📝 / Exam 🎯`);
    await pg.screenshot({ path: path.join(OUT, `home-cards-${L}-390.png`) });
    await pg.click('#modePractice'); await pg.click('#ptabExam'); await pg.waitForTimeout(200);
    const cell = await txt(pg, '#examGrid [data-arg="all"]');
    ok(cell.startsWith(lang === 'en' ? '📝 All Questions (408)' : '📝 全部試題（408 題）'), `[${L}] practice all cell "${cell}"`);
    ok(await noH(pg), `[${L}] practice exam grid no h-scroll`);
    await pg.screenshot({ path: path.join(OUT, `practice-all-cell-${L}-390.png`) });
    await pg.click('#modeExam'); await pg.waitForTimeout(200);
    const rnd = await pg.$eval('#examGrid [data-arg="all"]', e => e.firstChild.textContent.trim());
    ok(rnd.startsWith('🎲'), `[${L}] exam grid random cell keeps 🎲 (${rnd})`);
    await pg.evaluate(() => { pendingMode = 'practice'; startExam('ch1'); state.questions.forEach((q, i) => { state.answers[i] = [...q.a]; }); finishExam(); });
    ok(await txt(pg, '#resultEmoji') === '📝', `[${L}] practice result 📝`);
    await pg.screenshot({ path: path.join(OUT, `result-practice-${L}-390.png`) });
    await pg.click('#langBtn'); await pg.waitForTimeout(250);
    ok(await txt(pg, '#resultEmoji') === '📝', `[${L}] edge1 practice result icon unchanged after lang switch`);
    await pg.click('#langBtn'); await pg.waitForTimeout(250);
    await pg.evaluate(() => { goHome(); pendingMode = 'exam'; startExam(1); state.questions.forEach((q, i) => { state.answers[i] = [...q.a]; }); finishExam(); });
    ok(await txt(pg, '#resultEmoji') === '🎯', `[${L}] exam result 🎯`);
    await pg.screenshot({ path: path.join(OUT, `result-exam-${L}-390.png`) });
    await pg.click('#langBtn'); await pg.waitForTimeout(250);
    ok(await txt(pg, '#resultEmoji') === '🎯', `[${L}] edge1b exam result icon unchanged after lang switch`);
    await pg.click('#langBtn'); await pg.waitForTimeout(250);
    await pg.evaluate(() => { goHome(); pendingMode = 'practice'; startExam(5); state.questions.forEach((q, i) => { state.answers[i] = []; }); finishExam(); });
    ok(await txt(pg, '#resultEmoji') === '📝', `[${L}] edge2 practice › Exam 5 (all unanswered) 📝`);
    await pg.evaluate(() => { goHome(); pendingMode = 'exam'; startExam('all'); state.questions.forEach((q, i) => { state.answers[i] = q.o.map((_, j) => j).filter(j => !q.a.includes(j)).slice(0, 1); }); finishExam(); });
    ok(await txt(pg, '#resultEmoji') === '🎯', `[${L}] edge3 random exam (all wrong) result 🎯`);
    await pg.evaluate(() => { goHome(); pendingMode = 'practice'; startExam('wrong'); });
    const wrongN = await pg.evaluate(() => state.examNum === 'wrong' ? state.questions.length : 0);
    if (wrongN) { await pg.evaluate(() => { state.questions.forEach((q, i) => { state.answers[i] = [...q.a]; }); finishExam(); });
      ok(await txt(pg, '#resultEmoji') === '📝', `[${L}] edge3b wrong-answers review (${wrongN}) result 📝`); }
    else ok(false, `[${L}] edge3b wrong list empty after a failed random exam`);
    ok(pg.errs.length === 0, `[${L}] no page errors / missing keys ${pg.errs}`);
    await pg.context().close();
    pg = await open(lang, 320); await pg.click('#modePractice'); await pg.click('#ptabExam'); await pg.waitForTimeout(200);
    const fit = await pg.$eval('#examGrid [data-arg="all"]', e => e.scrollWidth <= e.clientWidth + 1);
    ok(fit && await noH(pg), `[${L}] edge4 320px all cell fits, no h-scroll`);
    await pg.screenshot({ path: path.join(OUT, `practice-all-cell-${L}-320.png`) });
    await pg.context().close();
  }
  await b.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
