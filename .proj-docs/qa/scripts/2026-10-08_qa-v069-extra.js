const { chromium } = require('playwright-core'); const path = require('path');
const APP_URL = 'file://' + path.resolve(process.argv[2], 'index.html');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.CHROMIUM_PATH });
  const fresh = async () => { const pg = await b.newPage({ viewport: { width: 390, height: 740 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(APP_URL); await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('lifeuk.installDismissed', 'true'); }); await pg.reload();
    await pg.evaluate(() => { window.__fin = 0; const f = finishExam; finishExam = (...a) => { window.__fin++; return f(...a); }; });
    pg.errs = errs; return pg; };
  const tabTo = async (pg, sel, k = 'Tab') => { for (let i = 0; i < 200; i++) { if (await pg.evaluate(s => document.activeElement.matches(s), sel)) return; await pg.keyboard.press(k); } throw new Error(sel); };
  const st = pg => pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, modal: isConfirmOpen(), fin: window.__fin, ae: document.activeElement.id || document.activeElement.tagName, cur: state.current }));
  const startExam = async pg => { await tabTo(pg, '#modeExam'); await pg.keyboard.press('Enter'); await tabTo(pg, '#examGrid [data-arg="4"]'); await pg.keyboard.press('Enter'); };
  // 1. hold Enter (auto-repeat) on Submit with unanswered questions
  { const pg = await fresh(); await startExam(pg); await tabTo(pg, '#navDots .dot:last-child'); await pg.keyboard.press('Enter'); await tabTo(pg, '#nextBtn');
    await pg.keyboard.down('Enter'); await pg.keyboard.down('Enter'); await pg.keyboard.down('Enter'); await pg.keyboard.up('Enter');
    console.log('hold Enter on Submit (3 keydowns):', JSON.stringify(await st(pg))); await pg.close(); }
  // 2. hold Enter on ← Home in exam
  { const pg = await fresh(); await startExam(pg); await tabTo(pg, '#screenQuiz .back-btn', 'Shift+Tab');
    for (let i = 0; i < 5; i++) await pg.keyboard.down('Enter'); await pg.keyboard.up('Enter');
    console.log('hold Enter on ← Home (5 keydowns):', JSON.stringify(await st(pg))); await pg.close(); }
  // 3. hold Enter on Reset → Keep
  { const pg = await fresh(); await pg.evaluate(() => localStorage.setItem('lifeuk.wrongList', '{"1.0":true}')); await pg.reload();
    await tabTo(pg, '#modePractice'); await pg.keyboard.press('Enter'); await tabTo(pg, '[data-action="resetPracticeProgress"]');
    for (let i = 0; i < 6; i++) await pg.keyboard.down('Enter'); await pg.keyboard.up('Enter');
    console.log('hold Enter on Reset (6 keydowns):', JSON.stringify(await st(pg)), await pg.evaluate(() => localStorage.getItem('lifeuk.wrongList'))); await pg.close(); }
  // 4. time up with focus on an option (no modal), then Enter / Space
  { const pg = await fresh(); await startExam(pg); await tabTo(pg, '#opt1');
    await pg.evaluate(() => { examDeadline = Date.now() + 200; }); await sleep(1300);
    const a = await st(pg); await pg.keyboard.press('Enter'); await pg.keyboard.press('Space'); const c = await st(pg);
    console.log('time up, focus on option:', JSON.stringify(a), '→ after Enter/Space', JSON.stringify(c)); await pg.close(); }
  // 5. time up with focus on header pill (outside .screen) – Enter switches language on results (visible control)
  { const pg = await fresh(); await startExam(pg); await tabTo(pg, '#langBtn', 'Shift+Tab');
    await pg.evaluate(() => { examDeadline = Date.now() + 200; }); await sleep(1300);
    const a = await st(pg); await pg.keyboard.press('Enter'); const c = await st(pg); const lang = await pg.evaluate(() => document.documentElement.lang);
    console.log('time up, focus on pill:', JSON.stringify(a), '→ Enter', JSON.stringify(c), lang, pg.errs); await pg.close(); }
  // 6. time up while Submit open AND focus moved to body by clicking modal text
  { const pg = await fresh(); await startExam(pg); await tabTo(pg, '#navDots .dot:last-child'); await pg.keyboard.press('Enter'); await tabTo(pg, '#nextBtn'); await pg.keyboard.press('Enter');
    const [x, y] = await pg.$eval('#confirmMsg', e => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); await pg.mouse.click(x, y);
    await pg.evaluate(() => { examDeadline = Date.now() + 200; }); await sleep(1300); await pg.keyboard.press('Enter'); await pg.keyboard.press('Tab'); console.log('  after Tab focus:', await pg.evaluate(() => { const a = document.activeElement; return a.outerHTML.slice(0, 120) + ' visible=' + !!a.getClientRects().length + ' screen=' + (a.closest('.screen') || {}).id; })); await pg.keyboard.press('Enter');
    console.log('time up, modal open, focus body, Enter/Tab/Enter:', JSON.stringify(await st(pg))); await pg.close(); }
  // 7. Esc with no modal on quiz: nothing
  { const pg = await fresh(); await startExam(pg); await tabTo(pg, '#nextBtn'); await pg.keyboard.press('Escape'); console.log('Esc, no modal:', JSON.stringify(await st(pg)), pg.errs); await pg.close(); }
  await b.close();
})();
