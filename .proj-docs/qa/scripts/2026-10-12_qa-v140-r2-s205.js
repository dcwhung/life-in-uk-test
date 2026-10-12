// QA v1.4.0 round 2: S-205 (stale locale + stored off) on HEAD 23bd39e.
// Usage: node 2026-10-12_qa-v140-r2-s205.js <scratch> <shotDir>; <scratch>/mix-{v130en,v130zh,r1en} = HEAD files + one older locale file
const { chromium } = require('playwright-core');
const [S, SHOTS] = process.argv.slice(2);
let pass = 0, fail = 0;
const log = (ok, name, info) => { ok ? pass++ : fail++; console.log(ok ? 'ok  ' : 'BAD ', name, JSON.stringify(info)); };
const RAW = /\b(app|home|quiz|common|study|plan|exam)\.[a-z]+[A-Z]\w*\b/g;
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  // + S-206 mixes: HEAD + e1aad11 i18n.js / study.js / actions.js (pre-S-202 code)
  const cases = [['v130en', 'en'], ['v130zh', 'zh-HK'], ['r1en', 'en'], ['v130en', 'zh-HK'], ['head', 'en'], ['head', 'zh-HK'], ['oldi18n', 'zh-HK'], ['oldstudy', 'zh-HK'], ['oldactions', 'zh-HK']];
  for (const [mix, lang] of cases) for (const tr of [null, 'off']) {
    const url = mix === 'head' ? 'file:///home/user/life-in-uk-test/index.html' : `file://${S}/mix-${mix}/index.html`;
    const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(url);
    await p.evaluate(([l, t]) => { localStorage.clear(); localStorage.setItem('lifeuk.uiLang', JSON.stringify(l)); if (t) localStorage.setItem('lifeuk.translation', JSON.stringify(t)); }, [lang, tr]);
    await p.goto(url);
    const home = await p.evaluate(rx => ({ desc: byId('modeDesc').textContent, raw: document.body.innerText.match(new RegExp(rx, 'g')) || [], attr: document.documentElement.dataset.translation || 'on', row: !byId('settingsTransRow').hidden }), RAW.source);
    if (tr === 'off' && mix !== 'head') await p.screenshot({ path: `${SHOTS}/r2-s205-${mix}-${lang}-off.png` });
    await p.click('#modeStudy');
    const st = await p.evaluate(rx => ({ ph: byId('studySearch').placeholder, raw: document.body.innerText.match(new RegExp(rx, 'g')) || [], cnt: byId('studyCount').textContent }), RAW.source);
    await p.evaluate(() => { goHome(); pendingMode = 'practice'; startExam(1); });
    const q = await p.evaluate(() => ({ yueBtn: [...document.querySelectorAll('#yueToggle')].filter(e => e.getClientRects().length).length, n: state.questions.length }));
    const descRaw = /home\.\w+/.test(home.desc);
    const ok = !descRaw && home.raw.length === 0 && st.raw.length === 0 && !/study\./.test(st.ph) && errs.length === 0 && q.n > 0;
    log(ok, `S-205 ${mix} ui=${lang} stored=${tr || '-'}`, { desc: home.desc.slice(0, 70), attr: home.attr, row: home.row, ph: st.ph, yueBtn: q.yueBtn, raw: [...home.raw, ...st.raw], errs });
    await p.close();
  }
  console.log(`S205 TOTAL ${pass} ok / ${fail} bad`); await b.close();
})();
// S-206 extra (run with the same args + "toggle"): on the oldi18n / oldactions mixes, toggle on Study and switch language on Study
if (process.argv[4] === 'toggle') (async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  for (const mix of ['oldi18n', 'oldstudy', 'oldactions']) {
    const url = `file://${S}/mix-${mix}/index.html`, p = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(url); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('lifeuk.uiLang', '"zh-HK"'); }); await p.goto(url);
    await p.click('#modeStudy'); const a = await p.$eval('#studySearch', e => e.placeholder);
    await p.click('#settingsBtn'); await p.click('#translationSwitch'); const b1 = await p.$eval('#studySearch', e => e.placeholder);
    await p.click('#settingsBtn'); await p.click('#settingsPop [data-action="chooseLang"][data-arg="en"]'); const c = await p.$eval('#studySearch', e => e.placeholder);
    console.log('S-206', mix, JSON.stringify({ start: a, afterToggleOff: b1, afterLangEn: c, errs }));
    await p.close();
  }
  await b.close();
})();
