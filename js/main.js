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
  // v1.3.1: rows that stack when their texts do not fit (goal form, My Review) and the quiz counter's line count
  { src: 'js/components/fitRow.js', ready: () => typeof fitRows === 'function' },
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
  // PR5: the Home card and schedule rows open the day screen
  { src: 'js/screens/planDay.js', ready: () => typeof openPlanDay === 'function' },
  // PR6a: every Practice render asks planRun.js about a plan task session (header, notes, last button)
  { src: 'js/screens/planRun.js', ready: () => typeof renderPlanRunNotes === 'function' },
  // v2.0.0: the desktop fits (render tails, i18n.js rerenderCurrentScreen) call runRefits / onRefit
  { src: 'js/components/fit.js', ready: () => typeof runRefits === 'function' },
  // v2.0.0: the screens move parts into desktop columns and register their fits through it (W-377)
  { src: 'js/components/deskPlace.js', ready: () => typeof deskKeepFocus === 'function' },
  // v2.5.0: the loading splash and the first-run intro (an older shell has no #splash: startSplash returns)
  { src: 'js/components/splash.js', ready: () => typeof startSplash === 'function' },
  { src: 'js/screens/intro.js', ready: () => typeof openIntro === 'function' },
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

// W-055 (v1.2.0): during an SW update a v1.1.x cached index.html can run with this js (CUI-0004). Its language pill has
// no handler any more and its "← Home" buttons name a removed key, so until the next load the pill hides (as W-013) and
// the Home buttons become the 🏠 icon buttons (fillStaticIcons and applyStaticI18n below fill them)
function upgradeLegacyHeaderMarkup() {
  const pill = byId('langBtn');
  if (pill) {
    pill.hidden = true;
    pill.removeAttribute('data-i18n');
    pill.removeAttribute('data-i18n-attr');
  }
  document.querySelectorAll('.back-btn[data-i18n="common.home"]').forEach(btn => {
    btn.removeAttribute('data-i18n');
    btn.classList.add('icon-btn');
    btn.dataset.icon = 'home';
    btn.dataset.i18nAttr = 'aria-label:common.homeLabel;title:common.homeLabel';
  });
}

// W-058 (v1.3.1): a v1.3.0 cached index.html has no data-fit-row, and the rules that kept those rows in shape (W-036,
// W-056, the portrait My Review rule) are gone from the css: mark the rows here (same selectors as index.html)
const LEGACY_FIT_ROWS = [
  ['#planDaysChips', '.chip'],
  ['#planLevelGrid', '.mode-title, .plan-level-sub'],
  ['#myReview .my-grid', '.my-tile b, .my-tile .sub, .my-tile .t-note'],
];
function upgradeLegacyFitRows() {
  LEGACY_FIT_ROWS.forEach(([rowSel, textSel]) => {
    const row = document.querySelector(rowSel);
    if (row && !row.dataset.fitRow) row.dataset.fitRow = textSel;
  });
}
// CUI-0038 (v2.1.0): a pre-v2.1.0 cached index.html still names the retired G36 date note's key: drop only the key.
// W-382: the node stays, since a cached pre-v2.1.0 planGoal.js still toggles it (it then shows nothing)
function removeLegacyPlanMarkup() {
  const note = byId('planDateNote');
  if (!note) return;
  note.removeAttribute('data-i18n');
  note.textContent = '';
}
// S-237 / v1.6.1: a pre-v1.6.1 cached index.html still has glyphs on its static controls ("←" on the quick Prev, "‹ ›" on
// the plan arrows, "✕" on the install banner) and buttons whose data-i18n words now carry no glyph: give the icon-only
// ones their data-icon and wrap the others' words beside a line icon slot (fillStaticIcons below fills both)
// CUI-0035: and the header ⓘ
const LEGACY_ICON_ONLY = [['#quickPrev', 'arrowLeft'], ['.install-close', 'close'], ['#infoBtn', 'info'], ['#planDayPrev', 'chevronLeft'],
  ['#planDayNext', 'chevronRight'], ['#planCalPrev', 'chevronLeft'], ['#planCalNext', 'chevronRight']];
const LEGACY_ICON_LABELS = [['#prevBtn', { lead: 'arrowLeft' }], ['.reset-btn[data-i18n]', { lead: 'reset' }],
  ['#screenMemo .memo-back', { lead: 'chevronLeft' }], ['#planBackToday', { lead: 'arrowLeft' }],
  ['#screenPlanSchedule .plan-block[data-action="openPlanDay"]', { trail: 'arrowRight' }]];
function upgradeLegacyIconMarkup() {
  LEGACY_ICON_ONLY.forEach(([sel, icon]) => document.querySelectorAll(`${sel}:not([data-icon])`).forEach(el => { el.dataset.icon = icon; }));
  LEGACY_ICON_LABELS.forEach(([sel, icons]) => document.querySelectorAll(sel).forEach(el => {
    const key = el.dataset.i18n;
    if (!key) return; // a v1.6.1 shell: its words are a span beside the icon already
    el.removeAttribute('data-i18n');
    el.classList.add('with-icon');
    const slot = icon => (icon ? `<span data-icon-slot="${icon}"></span>` : '');
    el.innerHTML = `${slot(icons.lead)}<span class="icon-label" data-i18n="${key}"></span>${slot(icons.trail)}`;
  }));
}
// v2.5.0: the splash fades once boot and its logo animation are done; the first-run intro opens underneath as it does
function finishBoot() {
  if (typeof finishSplash !== 'function') return; // W-057: a cached pre-v2.5.0 file mix
  finishSplash(() => { if (typeof maybeOpenIntro === 'function') maybeOpenIntro(); });
}
function startApp() {
  if (typeof startSplash === 'function') startSplash();
  upgradeLegacyHeaderMarkup();
  removeLegacyPlanMarkup();
  upgradeLegacyFitRows();
  upgradeLegacyIconMarkup();
  // v1.3.0: before anything renders at the default size; W-057: an HTTP-cached pre-v1.3.0 store.js has no text size
  if (typeof applyFontSize === 'function') applyFontSize();
  if (typeof applyTranslation === 'function') applyTranslation(); // v1.4.0, same W-057 guard
  if (typeof applyMemoMode === 'function') applyMemoMode(); // v2.3.0, same W-057 guard
  // v2.1.1 CUI-0039: stale question keys out of the stored lists before anything counts or opens them (W-057 guard)
  if (typeof pruneStaleQuestionKeys === 'function') pruneStaleQuestionKeys();
  byId('appVersion').textContent = 'v' + APP_VERSION;
  byId('appVersionPop').textContent = 'v' + APP_VERSION;
  applyLanguage(); // <html lang>, data-i18n markup, <title> / meta, ⓘ popover counts
  byId('flagBtn').innerHTML = bookmarkSvg('', { decorative: true });
  fillStaticIcons(); // v1.2.0: ⚙ and the icon-only screen-header buttons
  loadHomePrefs();
  renderPlanSettings();
  if (typeof renderTranslationSetting === 'function') renderTranslationSetting(); // v1.4.0 (W-057: a pre-v1.4.0 planHome.js)
  if (typeof renderMemoSetting === 'function') renderMemoSetting(); // v2.3.0 (W-057: a pre-v2.3.0 memo.js)
  planWatchDay(); // G6: the plan's "today" follows local midnight
  buildExamGrid();
  renderModeSelection();
  registerSW();
  if (typeof reportLaunch === 'function') reportLaunch(); // v2.7.0 usage counter (W-057: a pre-v2.7.0 shell has no telemetry.js)
}
// C-008: the splash fades even when startApp throws part-way (the page is then what it was before v2.5.0)
function bootApp() {
  try { startApp(); } finally { finishBoot(); }
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
  const splash = byId('splash'); // v2.5.0: the message must not stay under the splash (splash.js may be the file that failed)
  if (splash) splash.remove();
}
function clearI18nBootRetry() {
  try { sessionStorage.removeItem(I18N_RELOAD_SS); } catch {}
}

// Same cutover for styles: v0.63 moved the .fact* / .sqm-fact* rules out of study.css / quiz.css into fact.css,
// which an older cached index.html never links — add the <link> so Study and the Similar Core Fact keep their look
// v2.0.0: fit.css holds the desktop one-screen shell and panel fades
const LATE_BOOT_STYLES = ['css/components/fact.css', 'css/components/switch.css', 'css/components/toast.css', 'css/screens/plan.css', 'css/components/fit.css',
  'css/screens/intro.css']; // v2.5.0: the intro overlay (an older shell has no splash markup, so no splash.css)
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
if (!bootMissing.length) bootApp();
else loadBootScripts(bootMissing).then(() => { clearI18nBootRetry(); bootApp(); }).catch(onI18nBootFailure);
