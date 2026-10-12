// QA v1.4.1: quick v1.4.0 translation on/off regression through the real ⚙ switch (390px, en + zh-HK)
const { chromium } = require('playwright-core');
const APP = 'file:///home/user/life-in-uk-test/index.html';
const vis = (p, s) => p.$$eval(s, els => els.filter(e => e.getClientRects().length > 0).length);
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] }); let all = true;
  for (const lang of ['en', 'zh-HK']) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(APP); await p.evaluate(l => { localStorage.clear(); localStorage.setItem('lifeuk.uiLang', JSON.stringify(l)); }, lang); await p.goto(APP);
    const snap = async () => { await p.evaluate(() => { pendingMode = 'practice'; startExam(1); state.current = state.questions.findIndex(q => q.note); renderQuestion(); });
      const btn = await vis(p, '#yueToggle'); if (btn) await p.click('#yueToggle');
      await p.evaluate(() => { const i = state.current, q = state.questions[i]; state.answers[i] = [...q.a]; revealAnswer(); });
      const r = { btn, qYue: await vis(p, '#qYue'), ansYue: await vis(p, '#ansYue'), note: await vis(p, '#ansNote') };
      await p.evaluate(() => openStudy()); r.factYue = await vis(p, '.fact-yue'); r.mem = await vis(p, '.fact-mem');
      await p.evaluate(() => showScreen ? leaveToHome() : 0).catch(() => {}); return r; };
    const on1 = await snap();
    await p.goto(APP); await p.click('#settingsBtn'); await p.click('#translationSwitch');
    const stored = await p.evaluate(() => localStorage.getItem('lifeuk.translation'));
    await p.reload(); const off = await snap();
    await p.goto(APP); await p.click('#settingsBtn'); await p.click('#translationSwitch'); const on2 = await snap();
    const ok = on1.btn === 1 && on1.qYue === 1 && on1.ansYue === 1 && on1.factYue > 0 && stored === '"off"' && off.btn === 0 && off.qYue === 0 && off.ansYue === 0 && off.factYue === 0 && off.note === 1 && off.mem > 0
      && JSON.stringify(on2) === JSON.stringify(on1) && errs.length === 0;
    all = all && ok; console.log(ok ? 'ok ' : 'BUG', lang, JSON.stringify({ on1, stored, off, on2, errs }));
    await c.close();
  }
  console.log(all ? 'V140 CHECK OK' : 'V140 CHECK FAIL'); await b.close();
})();
