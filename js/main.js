// ════════════════════════════════════════
// INIT — runs last, after every other script has defined its globals
// ════════════════════════════════════════
// During a service-worker update a cached pre-v0.59 index.html can load these scripts without the
// locale + i18n tags it never had (same cutover as CUI-0004): fetch them first, then start.
const I18N_BOOT_SCRIPTS = ['locales/en.js', 'js/core/i18n.js'];
// shown when the scripts still fail after one reload; t() is not available then, so it cannot be a locale key
const I18N_BOOT_FALLBACK_MSG = 'The app could not finish loading. Please check your connection and reload the page.';

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

// A failed fetch during an update is usually transient: retry once with a full reload (the flag stops a loop),
// then show a plain message instead of a half-started page. No sessionStorage → no retry, straight to the message.
function hasRetriedI18nBoot() {
  try {
    if (sessionStorage.getItem(I18N_RELOAD_SS)) return true;
    sessionStorage.setItem(I18N_RELOAD_SS, '1');
    return false;
  } catch {
    return true;
  }
}
function onI18nBootFailure(err) {
  console.warn('[i18n] start-up failed:', err);
  if (!hasRetriedI18nBoot()) { location.reload(); return; }
  byId('examGrid').textContent = I18N_BOOT_FALLBACK_MSG;
}
function clearI18nBootRetry() {
  try { sessionStorage.removeItem(I18N_RELOAD_SS); } catch {}
}

if (typeof t === 'function') startApp();
else loadI18nScripts().then(() => { clearI18nBootRetry(); startApp(); }).catch(onI18nBootFailure);
