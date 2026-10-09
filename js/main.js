// ════════════════════════════════════════
// INIT — runs last, after every other script has defined its globals
// ════════════════════════════════════════
// During a service-worker update a cached older index.html can load these scripts without the tags it never had
// (same cutover as CUI-0004): fetch the missing ones first, in this order, then start.
// locale + i18n: pre-v0.59 shells; sideSession: pre-v0.62 shells (startExam / leaveToHome call it);
// factCard: pre-v0.63 shells (every Practice answer renders the Similar Core Fact, Study renders every card)
// W-010: "loaded" = the file's global exists, not that its <script> tag does — a current shell whose i18n.js failed
// still has the tag, and must get the same retry → reload → fallback (S-014). Ready files are never re-run
// (re-running en.js would throw "LOCALES has already been declared").
const LATE_BOOT_SCRIPTS = [
  { src: 'locales/en.js', ready: () => typeof LOCALES !== 'undefined' },
  { src: 'js/core/i18n.js', ready: () => typeof t === 'function' },
  { src: 'js/screens/sideSession.js', ready: () => typeof isSideSession === 'function' },
  { src: 'js/components/factCard.js', ready: () => typeof factCardHtml === 'function' },
  // study plan (PR2 answer hooks call recordPlanAnswer from mastery.js / result.js): plan.js before planProgress.js
  { src: 'js/domain/plan.js', ready: () => typeof buildPlan === 'function' },
  { src: 'js/domain/planProgress.js', ready: () => typeof recordPlanAnswer === 'function' },
  // study plan PR3: Home (renderModeSelection → renderPlanCard) and startApp call planHome.js, which renders the
  // ⓘ switch; the create card opens planGoal.js
  { src: 'js/components/switch.js', ready: () => typeof switchHtml === 'function' },
  { src: 'js/components/toast.js', ready: () => typeof showToast === 'function' },
  { src: 'js/screens/planHome.js', ready: () => typeof renderPlanCard === 'function' },
  { src: 'js/screens/planGoal.js', ready: () => typeof openPlanGoal === 'function' },
  // PR4: creating / changing a plan opens the schedule
  { src: 'js/screens/planSchedule.js', ready: () => typeof openPlanSchedule === 'function' },
];
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
function missingBootScripts() {
  return LATE_BOOT_SCRIPTS.filter(s => !s.ready()).map(s => s.src);
}
async function loadBootScripts(list) {
  for (const src of list) await loadScript(src); // in order: i18n.js after the locale
}

function startApp() {
  byId('appVersion').textContent = 'v' + APP_VERSION;
  byId('appVersionPop').textContent = 'v' + APP_VERSION;
  applyLanguage(); // <html lang>, data-i18n markup, <title> / meta, ⓘ popover counts
  byId('flagBtn').innerHTML = bookmarkSvg('', { decorative: true });
  loadHomePrefs();
  applyPlanPreviewParam(); // G31: before the first Home render
  renderPlanSettings();
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

// Same cutover for styles: v0.63 moved the .fact* / .sqm-fact* rules out of study.css / quiz.css into fact.css,
// which an older cached index.html never links — add the <link> so Study and the Similar Core Fact keep their look
const LATE_BOOT_STYLES = ['css/components/fact.css', 'css/components/switch.css', 'css/components/toast.css', 'css/screens/plan.css'];
function addMissingBootStyles() {
  LATE_BOOT_STYLES.filter(href => !document.querySelector(`link[rel="stylesheet"][href="${href}"]`)).forEach(href => {
    const el = document.createElement('link');
    el.rel = 'stylesheet';
    el.href = href;
    document.head.appendChild(el);
  });
}

addMissingBootStyles();
const bootMissing = missingBootScripts();
if (!bootMissing.length) startApp();
else loadBootScripts(bootMissing).then(() => { clearI18nBootRetry(); startApp(); }).catch(onI18nBootFailure);
