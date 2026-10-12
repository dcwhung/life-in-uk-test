// QA v1.4.2: persistence, existing users, toggles regression and edge cases (fresh, UNSEEDED contexts).
//   NODE_PATH=... CHROMIUM_PATH=... node 2026-10-12_qa-v142-persist.js
// MIX_DIR (optional): a scratch copy of the repo with js/core/config.js from 2839741 (pre-v1.4.2, W-057 guard check)
const { chromium } = require('playwright-core');
const path = require('path');
const APP = process.env.APP_URL || 'file://' + path.resolve(__dirname, '../../../index.html');
const SHOTS = path.join(__dirname, 'shots');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const res = [];
const log = (ok, m, extra) => { res.push(ok); console.log((ok ? 'ok  ' : 'BUG ') + m + (extra !== undefined ? ' ' + JSON.stringify(extra) : '')); };
const st = pg => pg.evaluate(() => ({ lang: document.documentElement.lang, font: document.documentElement.dataset.fontSize || 'small',
  sLang: localStorage.getItem('lifeuk.uiLang'), sFont: localStorage.getItem('lifeuk.fontSize'),
  settings: byId('settingsLangLabel') ? byId('settingsLangLabel').textContent : null, title: document.title }));
const pressed = pg => pg.evaluate(() => [...document.querySelectorAll('#settingsLangRow [data-arg], #settingsFontRow [data-arg]')]
  .filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.arg).join(','));

async function withPage(b, fn, { url = APP, init, w = 390 } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: 800 } });
  if (init) await ctx.addInitScript(init);
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(url);
  await fn(pg, errs);
  await ctx.close();
}
const seed = (lang, font) => [`(() => { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', 1);`
  + (lang ? `localStorage.setItem('lifeuk.uiLang', ${JSON.stringify(JSON.stringify(lang))});` : '')
  + (font ? `localStorage.setItem('lifeuk.fontSize', ${JSON.stringify(JSON.stringify(font))});` : '') + '} })()'].join('');

(async () => {
  const b = await chromium.launch(launchOpts);

  // P1: first run → choose English + small through ⚙ → reload (twice) keeps them
  await withPage(b, async (pg, errs) => {
    let s = await st(pg);
    log(s.lang === 'zh-HK' && s.font === 'large' && s.sLang === null && s.sFont === null, 'P1 first run zh-HK + large, nothing stored', s);
    await pg.click('#settingsBtn'); await pg.click('#settingsLangRow [data-arg="en"]');
    s = await st(pg);
    log(s.lang === 'en' && s.sLang === '"en"' && s.sFont === null && s.font === 'large', 'P1 pick English: only uiLang written, text still large', s);
    await pg.click('#settingsBtn'); await pg.click('#settingsFontRow [data-arg="small"]');
    s = await st(pg);
    log(s.font === 'small' && s.sFont === '"small"', 'P1 pick small: fontSize written', s);
    await pg.reload(); await pg.reload();
    s = await st(pg);
    log(s.lang === 'en' && s.font === 'small' && /Language/.test(s.settings), 'P1 en + small survive 2 reloads', s);
    await pg.click('#settingsBtn'); log(await pressed(pg) === 'en,small', 'P1 ⚙ presses en + small after reload');
    await pg.screenshot({ path: `${SHOTS}/v142-390-persist-en-small.png` });
    log(errs.length === 0, 'P1 no page errors', errs);
  });

  // P2: choosing only the text size leaves the language unwritten (still zh-HK after reload)
  await withPage(b, async pg => {
    await pg.click('#settingsBtn'); await pg.click('#settingsFontRow [data-arg="small"]');
    await pg.reload();
    const s = await st(pg);
    log(s.lang === 'zh-HK' && s.font === 'small' && s.sLang === null && s.sFont === '"small"', 'P2 only size picked: zh-HK kept, uiLang unwritten', s);
  });

  // E1: pressing the already-pressed defaults (中文 / large A)
  await withPage(b, async (pg, errs) => {
    await pg.click('#settingsBtn'); await pg.click('#settingsLangRow [data-arg="zh-HK"]');
    await pg.click('#settingsBtn').catch(() => {}); if (!(await pg.$('#settingsPop:visible'))) await pg.click('#settingsBtn');
    await pg.click('#settingsFontRow [data-arg="large"]');
    const s = await st(pg);
    log(s.lang === 'zh-HK' && s.font === 'large' && errs.length === 0, 'E1 re-pick defaults: UI unchanged, no error (stored = ' + s.sLang + ' / ' + s.sFont + ')', s);
  });

  // P3: existing users keep stored values (4 combos), app does not rewrite them
  for (const [lang, font] of [['en', 'small'], ['en', 'large'], ['zh-HK', 'small'], ['zh-HK', 'large']]) {
    await withPage(b, async (pg, errs) => {
      await pg.reload();
      const s = await st(pg);
      log(s.lang === lang && s.font === font && s.sLang === JSON.stringify(lang) && s.sFont === JSON.stringify(font) && errs.length === 0,
        `P3 existing user ${lang}/${font} unaffected`, s);
      if (lang === 'en' && font === 'small') {
        await pg.click('#settingsBtn'); log(await pressed(pg) === 'en,small', 'P3 ⚙ presses en + small for existing user');
        await pg.keyboard.press('Escape'); await pg.screenshot({ path: `${SHOTS}/v142-390-existing-en-small.png` });
      }
    }, { init: seed(lang, font) });
  }
  // P3b: existing user with only one key stored (pre-v1.3.0 user: uiLang en, no fontSize) → en + large
  await withPage(b, async pg => { await pg.reload(); const s = await st(pg);
    log(s.lang === 'en' && s.font === 'large' && s.sFont === null, 'P3b stored en only (no fontSize) → en + large (new default size)', s); }, { init: seed('en', null) });

  // R1: language toggle regression — en ↔ zh-HK × 3, html lang + body text follow, each written; mid-quiz state kept
  await withPage(b, async (pg, errs) => {
    await pg.click('#modePractice'); await pg.click('#ptabExam'); await pg.click('#examGrid button');
    await pg.click('#opt0'); if (!(await pg.$('#answerBox.show'))) await pg.click('#nextBtn');
    const before = await pg.evaluate(() => JSON.stringify([state.current, state.answers, state.examNum]));
    let ok = true;
    for (const lang of ['en', 'zh-HK', 'en', 'zh-HK', 'en', 'zh-HK']) {
      await pg.click('#settingsBtn'); await pg.click(`#settingsLangRow [data-arg="${lang}"]`);
      const s = await st(pg); const back = await pg.$eval('#screenQuiz', e => e.innerText.slice(0, 400));
      const cjkUi = /上一題|下一題|全部試題|第\s*1\s*題/.test(back);
      if (s.lang !== lang || s.sLang !== JSON.stringify(lang) || (lang === 'zh-HK') !== cjkUi) { ok = false; console.log('   ', lang, s, back.slice(0, 80)); }
    }
    const after = await pg.evaluate(() => JSON.stringify([state.current, state.answers, state.examNum]));
    log(ok && before === after && errs.length === 0, 'R1 language toggle ×6 on quiz: lang/UI/storage follow, quiz state kept');
  });

  // R2: font toggle regression — small ↔ large × 3; --fs token moves 2px; stored each time
  await withPage(b, async (pg, errs) => {
    const fs = () => pg.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#modeDesc')).fontSize));
    const large = await fs(); let ok = true, small;
    for (const size of ['small', 'large', 'small', 'large', 'small', 'large']) {
      await pg.click('#settingsBtn'); await pg.click(`#settingsFontRow [data-arg="${size}"]`);
      const s = await st(pg); const f = await fs(); if (size === 'small') small = f;
      if (s.font !== size || s.sFont !== JSON.stringify(size) || (size === 'large' && f !== large)) { ok = false; console.log('   ', size, s, f); }
    }
    log(ok && large - small === 2 && errs.length === 0, `R2 font toggle ×6: data-font-size + storage follow, #modeDesc ${small}px ↔ ${large}px`);
  });

  // E2: localStorage blocked (getItem / setItem throw) → zh-HK + large, no error, toggles still work for the session
  await withPage(b, async (pg, errs) => {
    const s = await pg.evaluate(() => ({ lang: document.documentElement.lang, font: document.documentElement.dataset.fontSize }));
    await pg.click('#settingsBtn'); await pg.click('#settingsLangRow [data-arg="en"]');
    const l2 = await pg.evaluate(() => document.documentElement.lang);
    log(s.lang === 'zh-HK' && s.font === 'large' && errs.length === 0, `E2 storage blocked: first run zh-HK + large, no page error (switch to en in-session → ${l2})`, { s, errs });
  }, { init: `(() => { const T = () => { throw new DOMException('blocked', 'SecurityError'); }; Storage.prototype.getItem = T; Storage.prototype.setItem = T; })()` });

  // E3: corrupt stored values (non-JSON / wrong type) → defaults, no error
  for (const [k, v] of [['lifeuk.uiLang', 'en'], ['lifeuk.uiLang', '42'], ['lifeuk.uiLang', '"__proto__"'], ['lifeuk.fontSize', '{"a":1}'], ['lifeuk.fontSize', 'null']]) {
    await withPage(b, async (pg, errs) => { await pg.reload(); const s = await st(pg);
      log(s.lang === 'zh-HK' && s.font === 'large' && errs.length === 0, `E3 corrupt ${k}=${v} → zh-HK + large, no error`, s);
    }, { init: `(() => { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', 1); localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)}); } })()` });
  }

  // E4: first paint — <html lang> is zh-HK before any script (no en flash for screen readers)
  await withPage(b, async pg => {
    const html = require('fs').readFileSync(path.resolve(__dirname, '../../../index.html'), 'utf8');
    log(/<html lang="zh-HK">/.test(html), 'E4 static <html lang="zh-HK"> before JS');
    const s = await st(pg); console.log('     note S-221 <title> =', JSON.stringify(s.title));
  });

  // E5: W-057 mixed cache — pre-v1.4.2 config.js with current i18n.js / store.js
  if (process.env.MIX_DIR) {
    await withPage(b, async (pg, errs) => {
      const s = await st(pg);
      log(errs.length === 0 && s.lang === 'en' && s.font === 'small', 'E5 old config.js + new i18n/store: no error, old first run (en + small)', { s, errs });
      await pg.click('#settingsBtn'); await pg.click('#settingsLangRow [data-arg="zh-HK"]');
      await pg.click('#settingsBtn'); await pg.click('#settingsFontRow [data-arg="large"]');
      const s2 = await st(pg);
      log(errs.length === 0 && s2.lang === 'zh-HK' && s2.font === 'large', 'E5 toggles still work in the mixed page', s2);
    }, { url: 'file://' + path.join(process.env.MIX_DIR, 'index.html') });
  }

  await b.close();
  console.log(res.every(Boolean) ? `PERSIST ALL OK ${res.length}` : `PERSIST ${res.filter(x => !x).length} BAD / ${res.length}`);
})().catch(e => { console.error(e); process.exit(1); });
