// extract: just the matrix part, with a lang sanity check
const { chromium } = require('playwright-core');
const APP = 'file:///home/user/life-in-uk-test/index.html';
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const hs = p => p.evaluate(() => { const se = document.scrollingElement, pop = byId('settingsPop'), shown = pop.getClientRects().length > 0;
    return { page: se.scrollWidth - se.clientWidth, popRight: shown ? Math.round(pop.getBoundingClientRect().right - innerWidth) : 0, popLeft: shown ? Math.round(pop.getBoundingClientRect().left) : 0, popInner: shown ? pop.scrollWidth - pop.clientWidth : 0 }; });
  const raw = p => p.evaluate(() => document.body.innerText.match(/\b(app|home|quiz|common|study|plan|exam)\.[a-z]+[A-Z][a-zA-Z]*\b/g) || []);
  const out = [];
  for (const w of [320, 360, 400]) for (const size of ['small', 'large']) for (const lang of ['en', 'zh-HK']) for (const tr of ['on', 'off']) {
    const c = await b.newContext({ viewport: { width: w, height: 760 } }); const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(APP);
    await p.evaluate(([s, l, t]) => { localStorage.setItem('lifeuk.fontSize', JSON.stringify(s)); localStorage.setItem('lifeuk.uiLang', JSON.stringify(l)); localStorage.setItem('lifeuk.translation', JSON.stringify(t)); }, [size, lang, tr]);
    await p.goto(APP);
    const htmlLang = await p.evaluate(() => document.documentElement.lang + '/' + (document.documentElement.dataset.fontSize || document.documentElement.className));
    await p.click('#settingsBtn');
    const pop = await hs(p);
    const row = await p.evaluate(() => { const r = byId('settingsTransRow').getBoundingClientRect(), s = byId('translationSwitch').getBoundingClientRect(), pill = byId('settingsTransPill');
      return { inside: s.width > 0 && s.right <= r.right + 0.5 && s.left >= r.left - 0.5, label: document.querySelector('#settingsTransRow b').textContent, pill: pill.textContent, swH: Math.round(s.height) }; });
    if (w === 320 || w === 400) await p.screenshot({ path: `${__dirname}/shots/m-pop-${w}-${size}-${lang}-${tr}.png` });
    await p.keyboard.press('Escape');
    const home = await hs(p); const homeDesc = await p.$eval('#modeDesc', e => e.textContent.slice(0, 50));
    await p.evaluate(() => { pendingMode = 'practice'; startExam(1); state.current = state.questions.findIndex(q => q.note && q.oy && q.oy.some(Boolean)); renderQuestion(); });
    if (tr === 'on') await p.click('#yueToggle');
    const qb = await hs(p);
    await p.evaluate(() => { const i = state.current, q = state.questions[i]; state.answers[i] = [...q.a]; revealAnswer(); });
    const qa = await hs(p);
    if (w === 320 && size === 'large') await p.screenshot({ path: `${__dirname}/shots/m-quiz-${w}-${size}-${lang}-${tr}.png`, fullPage: true });
    const rk = await raw(p);
    const ok = pop.page <= 0 && pop.popRight <= 0 && pop.popLeft >= 0 && pop.popInner <= 0 && row.inside && home.page <= 0 && qb.page <= 0 && qa.page <= 0 && rk.length === 0 && errs.length === 0;
    out.push({ w, size, lang, tr, htmlLang, ok, pop, row, homeDesc, qb: qb.page, qa: qa.page, rk, errs });
    await c.close();
  }
  out.forEach(o => console.log(o.ok ? 'ok ' : 'BAD', o.w, o.size, o.lang, o.tr, o.htmlLang, o.row.label, o.row.pill, 'swH' + o.row.swH, JSON.stringify(o.pop), o.qb, o.qa, o.rk.join(','), o.homeDesc));
  console.log(out.every(o => o.ok) ? 'MATRIX ALL OK ' + out.length : 'MATRIX FAIL');
  await b.close();
})();
