// QA v1.4.0 round 2 (HEAD 23bd39e): 🌐 popover row, S-202 Study search placeholder, quick AC regression.
// Usage: NODE_PATH=/opt/node-tools/node_modules node 2026-10-12_qa-v140-r2.js <shotDir>
const { chromium } = require('playwright-core');
const APP = 'file:///home/user/life-in-uk-test/index.html';
const SHOTS = process.argv[2] || __dirname + '/shots';
require('fs').mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0;
const log = (ok, name, info) => { ok ? pass++ : fail++; console.log(ok ? 'ok  ' : 'BAD ', name, info === undefined ? '' : JSON.stringify(info)); };
const EXPECT = { en: { on: 'Search facts (English / Cantonese)', off: 'Search facts' }, 'zh-HK': { on: '搜尋知識點（英文／廣東話）', off: '搜尋知識點' } };
const LABEL = { en: '🌐 Translation', 'zh-HK': '🌐 廣東話翻譯' };

async function fresh(b, w, { size = 'small', lang = 'en', tr = null } = {}) {
  const c = await b.newContext({ viewport: { width: w, height: 760 } });
  const p = await c.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.goto(APP);
  await p.evaluate(([s, l, t]) => { localStorage.clear(); localStorage.setItem('lifeuk.fontSize', JSON.stringify(s)); localStorage.setItem('lifeuk.uiLang', JSON.stringify(l)); if (t) localStorage.setItem('lifeuk.translation', JSON.stringify(t)); }, [size, lang, tr]);
  await p.goto(APP);
  return { c, p };
}
// placeholder fit: text width (canvas, input's computed font) vs content box
const ph = p => p.evaluate(() => {
  const i = byId('studySearch'), cs = getComputedStyle(i), cx = document.createElement('canvas').getContext('2d');
  cx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const box = i.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const se = document.scrollingElement;
  return { text: i.placeholder, textW: Math.round(cx.measureText(i.placeholder).width), box: Math.round(box), fits: cx.measureText(i.placeholder).width <= box, hs: se.scrollWidth - se.clientWidth };
});
const toggleViaUI = async p => { await p.click('#settingsBtn'); await p.click('#translationSwitch'); };
const chooseLang = async (p, l) => { await p.click('#settingsBtn'); await p.click(`#settingsPop [data-action="chooseLang"][data-arg="${l}"]`); };

(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });

  // ── (a) popover 🌐 row: 320/360/400 × small/large × en/zh-HK × on/off
  for (const w of [320, 360, 400]) for (const size of ['small', 'large']) for (const lang of ['en', 'zh-HK']) for (const tr of ['on', 'off']) {
    const { c, p } = await fresh(b, w, { size, lang, tr });
    await p.click('#settingsBtn');
    const r = await p.evaluate(() => {
      const pop = byId('settingsPop'), pr = pop.getBoundingClientRect(), row = byId('settingsTransRow'), rr = row.getBoundingClientRect();
      const lab = row.querySelector('b'), lr = lab.getBoundingClientRect(), lh = parseFloat(getComputedStyle(lab).lineHeight) || parseFloat(getComputedStyle(lab).fontSize) * 1.4;
      const pill = byId('settingsTransPill').getBoundingClientRect(), sw = byId('translationSwitch').getBoundingClientRect();
      const plan = byId('infoPlanRow'), planLab = plan.hidden ? null : plan.querySelector('b').getBoundingClientRect();
      const se = document.scrollingElement;
      return {
        label: lab.textContent, labLines: Math.round(lr.height / lh), labW: Math.round(lr.width),
        pillSameLine: Math.abs(pill.top - lr.top) < lh, pillRight: Math.round(pill.right), swLeft: Math.round(sw.left),
        noCollide: pill.right <= sw.left + 0.5, swInRow: sw.right <= rr.right + 0.5 && sw.left >= rr.left - 0.5,
        popL: Math.round(pr.left), popR: Math.round(innerWidth - pr.right), popInner: pop.scrollWidth - pop.clientWidth,
        rowInner: row.scrollWidth - row.clientWidth, page: se.scrollWidth - se.clientWidth,
        rawKey: (pop.innerText.match(/\b(app|common)\.[a-z]+[A-Z]\w*/g) || []).length,
        htmlLang: document.documentElement.lang, fs: document.documentElement.dataset.fontSize || '',
        planLabW: planLab ? Math.round(planLab.width) : null,
      };
    });
    const ok = r.label === LABEL[lang] && r.labLines === 1 && r.noCollide && r.swInRow && r.popL >= 16 && r.popR >= 16 && r.popInner <= 0 && r.rowInner <= 4 && r.page <= 0 && r.rawKey === 0 && r.htmlLang === lang && p.errs.length === 0;
    log(ok, `(a) pop ${w} ${size} ${lang} ${tr}`, r);
    if ((w === 320 && size === 'large') || (w === 400 && size === 'small')) await p.screenshot({ path: `${SHOTS}/r2-pop-${w}-${size}-${lang}-${tr}.png` });
    await c.close();
  }

  // ── (b) Study search placeholder
  for (const lang of ['en', 'zh-HK']) for (const size of ['small', 'large']) for (const w of [320, 400]) {
    const { c, p } = await fresh(b, w, { size, lang });
    await p.click('#modeStudy');
    let r = await ph(p);
    log(r.text === EXPECT[lang].on && r.fits && r.hs <= 0, `(b) ${lang} ${size} ${w} default on`, r);
    await toggleViaUI(p); // toggle on Study screen
    r = await ph(p);
    log(r.text === EXPECT[lang].off && r.fits && r.hs <= 0, `(b) ${lang} ${size} ${w} toggled off on Study`, r);
    if (w === 320 && size === 'large') await p.screenshot({ path: `${SHOTS}/r2-study-search-off-${lang}-320-large.png` });
    if (w === 320 && size === 'small') await p.screenshot({ path: `${SHOTS}/r2-study-search-off-${lang}-320-small.png` });
    await p.reload();
    await p.click('#modeStudy');
    r = await ph(p);
    log(r.text === EXPECT[lang].off, `(b) ${lang} ${size} ${w} off after reload`, r);
    const other = lang === 'en' ? 'zh-HK' : 'en';
    await chooseLang(p, other); // language switch while on Study
    r = await ph(p);
    log(r.text === EXPECT[other].off && r.fits, `(b) ${lang}->${other} ${size} ${w} lang switch keeps off wording`, r);
    await toggleViaUI(p);
    r = await ph(p);
    log(r.text === EXPECT[other].on && r.fits, `(b) ${other} ${size} ${w} toggled back on`, r);
    if (w === 320 && size === 'large') await p.screenshot({ path: `${SHOTS}/r2-study-search-on-${other}-320-large.png` });
    log(p.errs.length === 0, `(b) ${lang} ${size} ${w} no page errors`, p.errs);
    await c.close();
  }
  // toggle from Home, then open Study; lang switch on Home; search still matches Cantonese when off
  {
    const { c, p } = await fresh(b, 360, { lang: 'zh-HK' });
    await toggleViaUI(p); // off on Home
    await chooseLang(p, 'en'); await chooseLang(p, 'zh-HK'); // lang switch on Home round-trip
    await p.click('#modeStudy');
    let r = await ph(p);
    log(r.text === EXPECT['zh-HK'].off, '(b) off set on Home + lang round-trip on Home, then Study', r);
    await p.fill('#studySearch', '國王');
    const cnt = await p.$eval('#studyCount', e => e.textContent);
    const empty = await p.$$eval('.study-empty', es => es.filter(e => e.getClientRects().length).length);
    log(empty === 0 && !/^0\b/.test(cnt), '(b) off: Cantonese search still matches (matching unchanged)', { cnt, empty });
    await p.fill('#studySearch', '');
    // stored value unknown -> treated on
    await p.evaluate(() => localStorage.setItem('lifeuk.translation', JSON.stringify('maybe'))); await p.reload(); await p.click('#modeStudy');
    r = await ph(p);
    log(r.text === EXPECT['zh-HK'].on, '(b) unknown stored value -> on wording', r);
    // value typed in search survives a toggle; placeholder unaffected by value
    await p.fill('#studySearch', 'king');
    await toggleViaUI(p);
    const v = await p.$eval('#studySearch', e => e.value);
    r = await ph(p);
    log(v === 'king' && r.text === EXPECT['zh-HK'].off, '(b) typed query kept across toggle, placeholder updated', { v, r });
    log(p.errs.length === 0, '(b) extra no page errors', p.errs);
    await c.close();
  }

  // ── (d) quick AC regression (real UI paths)
  {
    const { c, p } = await fresh(b, 390, { lang: 'en' });
    const st = () => p.evaluate(() => localStorage.getItem('lifeuk.translation'));
    log(await st() === null, 'AC1 default nothing stored');
    await p.click('#settingsBtn');
    const a1 = await p.evaluate(() => ({ pill: byId('settingsTransPill').textContent, label: document.querySelector('#settingsTransRow b').textContent, order: [...document.querySelectorAll('#settingsFeatures .plan-setting-row')].map(e => e.id) }));
    log(a1.pill === 'On' && a1.label === '🌐 Translation' && a1.order[0] === 'settingsTransRow', 'AC1 row 🌐 + On pill, first in Features', a1);
    await p.click('#translationSwitch');
    const a1b = await p.evaluate(() => ({ popOpen: byId('settingsPop').getClientRects().length > 0, focus: document.activeElement.id, attr: document.documentElement.dataset.translation }));
    log(!a1b.popOpen && a1b.focus === 'settingsBtn' && await st() === '"off"', 'AC1 switch -> off, stored, popover closed, focus ⚙', a1b);
    await p.reload();
    await p.click('#settingsBtn');
    log(await p.$eval('#settingsTransPill', e => e.textContent) === 'Off', 'AC1 reload keeps Off');
    await p.keyboard.press('Escape');
    // AC4 home desc
    const desc = await p.$eval('#modeDesc', e => e.textContent);
    log(!/Cantonese/i.test(desc) && !/home\.\w+/.test(desc), 'AC4 Home desc off has no Cantonese promise / raw key', desc.slice(0, 90));
    // AC2 practice: no translate button, answer has no yue
    await p.evaluate(() => { pendingMode = 'practice'; startExam(1); });
    const vis = sel => p.$$eval(sel, es => es.filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').length);
    log(await vis('#yueToggle') === 0, 'AC2 off: no Translate button before answering');
    await p.click('.option-btn, .opt, [data-action="pickOption"]').catch(() => {});
    await p.evaluate(() => { const i = state.current, q = state.questions[i]; if (!state.answers[i]) { state.answers[i] = [...q.a]; revealAnswer(); } });
    const yueVis = await vis('.yue, .q-yue, .opt-yue, .ans-yue, .fact-yue, .note-yue, [lang="yue"], [lang="zh-HK"].yue');
    log(yueVis === 0, 'AC2 off: no Cantonese after answering', { yueVis });
    // AC3 notes still visible when present
    await p.evaluate(() => { const k = state.questions.findIndex(q => q.note); if (k >= 0) { state.current = k; renderQuestion(); const q = state.questions[k]; state.answers[k] = [...q.a]; revealAnswer(); } });
    const note = await p.evaluate(() => { const n = byId('ansNote'); return { vis: n.getClientRects().length > 0 && n.textContent.trim().length > 0, len: n.textContent.length }; });
    log(note.vis, 'AC3 note still shown when off', note);
    // AC6 exam unaffected: exam has no translate UI either way
    await p.reload();
    await p.evaluate(() => { pendingMode = 'exam'; startExam(1); });
    log(await vis('#yueToggle') === 0, 'AC6 exam: no Translate button');
    // back on (fresh load to avoid the leave-exam confirm)
    await p.reload();
    await toggleViaUI(p);
    const descOn = await p.$eval('#modeDesc', e => e.textContent);
    await p.evaluate(() => { pendingMode = 'practice'; startExam(1); });
    log(await vis('#yueToggle') === 1, 'AC2 on: Translate button back');
    log(/Cantonese/i.test(descOn), 'AC4 on: desc mentions Cantonese', descOn.slice(0, 90));
    log(p.errs.length === 0, 'AC regression no page errors', p.errs);
    await c.close();
  }
  console.log(`R2 TOTAL ${pass} ok / ${fail} bad`);
  await b.close();
})();
