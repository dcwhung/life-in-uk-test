const { chromium } = require('playwright-core');
const APP = 'file://' + __dirname + '/mix/index.html';
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  for (const [lang, tr] of [['en', null], ['en', 'off'], ['zh-HK', 'off']]) {
    await pg.goto(APP); await pg.evaluate(([l, t]) => { localStorage.clear(); localStorage.setItem('lifeuk.uiLang', JSON.stringify(l)); if (t) localStorage.setItem('lifeuk.translation', JSON.stringify(t)); }, [lang, tr]);
    await pg.goto(APP);
    await pg.click('#settingsBtn');
    const r = await pg.evaluate(() => ({ desc: byId('modeDesc').textContent.slice(0, 80), attr: document.documentElement.dataset.translation || 'on', row: !byId('settingsTransRow').hidden }));
    console.log(lang, tr, JSON.stringify(r));
    await pg.keyboard.press('Escape');
    await pg.screenshot({ path: `${__dirname}/shots/18-s205-${lang}-${tr}.png` });
    // practice quiz still OK?
    await pg.evaluate(() => { pendingMode = 'practice'; startExam(1); });
    console.log('  quiz toggle visible', await pg.$$eval('#yueToggle', e => e.filter(x => x.getClientRects().length).length));
  }
  console.log('errs', errs); await b.close();
})();
