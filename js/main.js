// ════════════════════════════════════════
// INIT — runs last, after every other script has defined its globals
// ════════════════════════════════════════
// During a service-worker update a cached pre-v0.59 index.html can load these scripts without the
// locale + i18n tags it never had (same cutover as CUI-0004): fetch them first, then start.
const I18N_BOOT_SCRIPTS = ['locales/en.js', 'js/core/i18n.js'];

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.addEventListener('load', resolve);
    el.addEventListener('error', () => reject(new Error('could not load ' + src)));
    document.body.appendChild(el);
  });
}
async function loadI18nScripts() {
  for (const src of I18N_BOOT_SCRIPTS) await loadScript(src); // in order: i18n.js after the locale
}

function startApp() {
  byId('appVersion').textContent = 'v' + APP_VERSION;
  byId('appVersionPop').textContent = 'v' + APP_VERSION;
  applyLanguage(); // <html lang>, data-i18n markup, <title> / meta, ⓘ popover counts
  byId('flagBtn').innerHTML = bookmarkSvg('', { decorative: true });
  loadHomePrefs();
  buildExamGrid();
  renderModeSelection();
  registerSW();
}

if (typeof t === 'function') startApp();
else loadI18nScripts().then(startApp).catch(e => console.warn('[i18n] start-up failed:', e));
