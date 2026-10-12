const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
// v1.4.1: first-run defaults (user-approved): with nothing stored, the UI is Traditional Chinese (zh-HK) and the text is
// large; Cantonese translation and the study plan stay on. Nothing is written until the user picks, a choice survives a
// reload, and a stored language with no locale reads as zh-HK. DEFAULT_LANG stays en: it is the fallback for keys a
// language lacks (js/core/i18n.js resolveKey), not the first-run language (INITIAL_LANG)
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

const LANG_LS = 'lifeuk.uiLang';
const FONT_LS = 'lifeuk.fontSize';
const ZH_HK = 'zh-HK';
const CJK = /[一-鿿]/;

const fresh = async pg => {
  await pg.goto(APP_URL);
  await pg.evaluate(() => localStorage.clear());
  await pg.goto(APP_URL);
};
const stateOf = pg => pg.evaluate(([langKey, fontKey]) => ({
  htmlLang: document.documentElement.lang,
  lang: getLang(),
  fontSize: document.documentElement.dataset.fontSize || null,
  translation: document.documentElement.dataset.translation || null,
  plan: isStudyPlanEnabled(),
  storedLang: localStorage.getItem(langKey),
  storedFont: localStorage.getItem(fontKey),
}), [LANG_LS, FONT_LS]);

// the markup before any script runs already names the first-run language
function checkMarkup() {
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');
  assert(/<html lang="zh-HK">/.test(html), 'index.html: <html lang="zh-HK"> before JS');
}

async function checkFirstRun(pg) {
  await fresh(pg);
  const s = await stateOf(pg);
  assert(s.htmlLang === ZH_HK && s.lang === ZH_HK, 'first run: zh-HK UI: ' + JSON.stringify(s));
  assert(s.fontSize === 'large', 'first run: large text (data-font-size="large")');
  assert(s.storedLang === null && s.storedFont === null, 'first run: nothing written to lifeuk.uiLang / lifeuk.fontSize');
  assert(s.translation === null, 'first run: Cantonese translation on (no data-translation)');
  assert(s.plan === true, 'first run: study plan on');
  const ui = await pg.evaluate(() => ({ title: document.title, settings: t('app.settings'), zh: LOCALES['zh-HK'].app.settings, body: document.body.innerText }));
  assert(ui.settings === ui.zh && CJK.test(ui.body), 'first run: visible UI text is Chinese: ' + ui.settings);
  // the ⚙ rows press the defaults
  await pg.click('#settingsBtn');
  const pressed = await pg.evaluate(() => [...document.querySelectorAll('#settingsLangRow [data-arg], #settingsFontRow [data-arg]')]
    .filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.arg));
  assert(JSON.stringify(pressed) === JSON.stringify([ZH_HK, 'large']), '⚙ presses zh-HK and large: ' + JSON.stringify(pressed));
  await pg.keyboard.press('Escape');
}

async function checkChoicePersists(pg) {
  await fresh(pg);
  await pg.click('#settingsBtn');
  await pg.click('#settingsLangRow [data-arg="en"]');
  await pg.click('#settingsBtn');
  await pg.click('#settingsFontRow [data-arg="small"]');
  await pg.reload();
  const s = await stateOf(pg);
  assert(s.lang === 'en' && s.htmlLang === 'en' && s.fontSize === null, 'en + small survive a reload: ' + JSON.stringify(s));
  assert(s.storedLang === JSON.stringify('en') && s.storedFont === JSON.stringify('small'), 'choices stored');
}

async function checkUnknownLang(pg) {
  await fresh(pg);
  await pg.evaluate(k => localStorage.setItem(k, JSON.stringify('xx-YY')), LANG_LS);
  await pg.reload();
  assert(await pg.evaluate(() => getLang()) === ZH_HK, 'a stored language with no locale reads as zh-HK');
  await pg.evaluate(k => localStorage.setItem(k, JSON.stringify('huge')), FONT_LS);
  await pg.reload();
  assert(await pg.evaluate(() => document.documentElement.dataset.fontSize) === 'large', 'an unknown text size reads as large');
}

// DEFAULT_LANG is still the fallback for keys zh-HK lacks
async function checkFallback(pg) {
  await fresh(pg);
  const r = await pg.evaluate(() => {
    LOCALES.en.zzProbe = { only: 'English only' };
    const out = { def: DEFAULT_LANG, lang: getLang(), text: t('zzProbe.only') };
    delete LOCALES.en.zzProbe;
    return out;
  });
  assert(r.def === 'en' && r.lang === 'zh-HK' && r.text === 'English only', 'missing zh-HK key falls back to English: ' + JSON.stringify(r));
}

(async () => {
  const b = await chromium.launch(launchOpts);
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  checkMarkup();
  await checkFirstRun(pg);
  await checkChoicePersists(pg);
  await checkUnknownLang(pg);
  await checkFallback(pg);
  assert(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  await b.close();
  console.log('DEFAULT-SETTINGS PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
