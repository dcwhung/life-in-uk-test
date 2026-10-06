// ════════════════════════════════════════
// INIT — runs last, after every other script has defined its globals
// ════════════════════════════════════════
byId('appVersion').textContent = 'v' + APP_VERSION;
byId('appVersionPop').textContent = 'v' + APP_VERSION;
fillInfoCounts();
byId('flagBtn').innerHTML = bookmarkSvg('', { decorative: true });
loadHomePrefs();
buildExamGrid();
renderModeSelection();
registerSW();
