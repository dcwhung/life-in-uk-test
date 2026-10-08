const { chromium } = require('playwright-core');
const path = require('path');
const APP_URL = 'file://' + path.resolve(process.argv[2], 'index.html');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.CHROMIUM_PATH });
  const F = pg => pg.evaluate(() => { const a = document.activeElement; return (a.id || a.className) + ' fv=' + a.matches(':focus-visible'); });
  const c = async (pg, sel) => { const [x, y] = await pg.$eval(sel, e => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); await pg.mouse.click(x, y); await sleep(450); };
  for (const hasTouch of [false, true]) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 740 }, hasTouch });
    const pg = await ctx.newPage();
    await pg.goto(APP_URL); await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('lifeuk.installDismissed', 'true'); localStorage.setItem('lifeuk.wrongList', '{"1.0":true}'); }); await pg.reload(); await sleep(200);
    const tap = hasTouch ? async sel => { await pg.tap(sel); await sleep(450); } : sel => c(pg, sel);
    console.log('--- touch=' + hasTouch);
    await tap('#modePractice');
    await tap('[data-action="resetPracticeProgress"]'); console.log('pure pointer reset open:', await F(pg));
    await tap('#confirmCancel'); console.log('after Cancel:', await F(pg));
    await tap('#modeExam'); await tap('#examGrid [data-arg="4"]');
    await tap('#navDots .dot:last-child'); await tap('#nextBtn'); console.log('pure pointer submit open:', await F(pg));
    await tap('#confirmCancel'); console.log('after Keep going:', await F(pg));
    await tap('#screenQuiz .back-btn'); console.log('leave open:', await F(pg));
    await pg.mouse.click(4, 730); await sleep(100); console.log('after backdrop:', await F(pg));
    // mixed: one Tab press, then pointer
    await pg.keyboard.press('Tab'); await tap('#nextBtn'); console.log('after a Tab, pointer submit open:', await F(pg));
    await tap('#confirmCancel'); console.log('  then pointer cancel:', await F(pg));
    await tap('#nextBtn'); console.log('  pointer again:', await F(pg));
    await ctx.close();
  }
  await b.close();
})();
