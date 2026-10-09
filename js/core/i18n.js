// ════════════════════════════════════════
// I18N — t(key, params) over LOCALES (locales/*.js), the UI language (localStorage) and static markup.
// Keys are dotted ("home.chooseMode"); "{name}" in a value is replaced by params.name; a value of the form
// { one, other } is a plural picked by params.n. Keys ending in "Html" hold markup (inserted with innerHTML;
// callers escape what they pass in). A key missing in the current language falls back to DEFAULT_LANG,
// then to the key itself, with a console warning.
// ════════════════════════════════════════
const PLURAL_N_PARAM = 'n';
const I18N_ATTR_PAIR_SEP = ';';
const I18N_ATTR_KEY_SEP = ':';

function lookupKey(lang, key) {
  return key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), LOCALES[lang]);
}
const isPluralValue = v => v !== null && typeof v === 'object' && 'other' in v;

function pluralForm(value, lang, n) {
  if (typeof n !== 'number') return value.other;
  // Intl knows each language's plural rules; en: 1 → one, everything else → other
  const form = new Intl.PluralRules(lang).select(n);
  return value[form] ?? value.other;
}
function interpolate(text, params) {
  return text.replace(/\{(\w+)\}/g, (whole, name) => (name in params ? String(params[name]) : whole));
}
function resolveKey(key) {
  const lang = getLang();
  const own = lookupKey(lang, key);
  if (own !== undefined) return { value: own, lang };
  console.warn('[i18n] missing key', key);
  const fallback = lang === DEFAULT_LANG ? undefined : lookupKey(DEFAULT_LANG, key);
  return { value: fallback, lang: DEFAULT_LANG };
}
function t(key, params = {}) {
  const { value, lang } = resolveKey(key);
  if (value === undefined) return key;
  const text = isPluralValue(value) ? pluralForm(value, lang, params[PLURAL_N_PARAM]) : value;
  return interpolate(text, params);
}

// ── language: stored as lifeuk.uiLang; a stored language with no locale reads as the default ──
let uiLang = null;
// own keys only: LOCALES is a plain object, so 'constructor' / '__proto__' would otherwise count as locales
const hasLocale = lang => Object.prototype.hasOwnProperty.call(LOCALES, lang);
function getLang() {
  if (uiLang === null) {
    const stored = getLS(UI_LANG_LS);
    uiLang = hasLocale(stored) ? stored : DEFAULT_LANG;
  }
  return uiLang;
}
// v0.65: the header pill (toggleLang in js/core/actions.js) calls this with en / zh-HK. Another language needs
// locales/<code>.js loaded after locales/en.js and listed in index.html + sw.js SHELL.
function setLang(lang) {
  if (!hasLocale(lang)) { console.warn('[i18n] no locale for', lang); return; }
  uiLang = lang;
  setLS(UI_LANG_LS, lang);
  applyLanguage();
  rerenderCurrentScreen();
}
function applyLanguage() {
  document.documentElement.lang = getLang();
  syncLangPill();
  applyStaticI18n();
  applyDocumentI18n();
}

// W-013: a shell whose locales/zh-HK.js failed has nothing to switch to, so hide the pill instead of a dead button;
// a pre-v0.65 shell has no pill at all
function syncLangPill() {
  const pill = byId('langBtn');
  if (pill) pill.hidden = !hasLocale(ZH_HK_LANG);
}

// ── static markup: data-i18n fills textContent; data-i18n-attr="placeholder:key;title:key" fills attributes ──
function applyStaticI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => {
    const textKey = el.dataset.i18n;
    el.textContent = t(textKey);
  });
  root.querySelectorAll('[data-i18n-attr]').forEach(el => {
    el.dataset.i18nAttr.split(I18N_ATTR_PAIR_SEP).forEach(pair => {
      const [attr, attrKey] = pair.split(I18N_ATTR_KEY_SEP);
      el.setAttribute(attr, t(attrKey));
    });
  });
}
// <title> and meta description keep an English literal in index.html for no-JS readers; counts come from the data
function applyDocumentI18n() {
  document.title = t('app.title');
  document.querySelector('meta[name="apple-mobile-web-app-title"]').setAttribute('content', t('app.shortName'));
  document.querySelector('meta[name="description"]').setAttribute('content', t('app.description', { n: EXAM_COUNT }));
  fillInfoCounts();
}

// screens re-render in the new language; arrows defer the lookup because the screens load after this file
const SCREEN_RERENDER = {
  screenHome: () => { buildExamGrid(); renderModeSelection(); },
  // the exam countdown text is rewritten at once instead of on the next tick
  screenQuiz: () => { renderQuestion(); refreshExamTimer(); },
  screenResult: () => renderResults(),
  screenFlagged: () => openFlagged(),
  screenStudy: () => renderStudy(),
  screenPlanGoal: () => renderPlanGoal(),
};
function rerenderCurrentScreen() {
  const active = document.querySelector('.screen.active');
  const rerender = active && SCREEN_RERENDER[active.id];
  if (rerender) rerender();
}
