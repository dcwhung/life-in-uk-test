// ════════════════════════════════════════
// PWA — service worker (sw.js at the site root) + install banner
// ════════════════════════════════════════
// A new version must reach an installed app without a manual reload (iOS standalone has none):
// • check for an update whenever the app comes back to the foreground — iOS resumes a Home-screen app from
//   memory, so there is no page load that would check on its own
// • when the new worker takes over (sw.js: skipWaiting + clients.claim), reload once so the page runs the new
//   files instead of the ones it already loaded. Only on Home: a reload elsewhere would drop a running quiz /
//   plan session, so it waits until the user is back on Home
const UPDATE_RELOAD_SCREEN = 'screenHome';
let swReloadPending = false;
let swHadController = false; // set at registration, then true after any takeover
const isUpdateReloadSafe = () => byId(UPDATE_RELOAD_SCREEN).classList.contains('active');
function reloadForUpdate() {
  if (!swReloadPending || !isUpdateReloadSafe()) return;
  swReloadPending = false;
  location.reload();
}
function watchUpdateReloadScreen() {
  // showScreen() toggles the .active class: reload as soon as Home is shown again
  new MutationObserver(reloadForUpdate).observe(byId(UPDATE_RELOAD_SCREEN), { attributes: true, attributeFilter: ['class'] });
}
function onControllerChange() {
  // the first install also fires controllerchange (clients.claim) but the page already runs the cached files
  const wasControlled = swHadController;
  swHadController = true;
  if (!wasControlled) return;
  swReloadPending = true;
  reloadForUpdate();
}
function checkForUpdateOnResume(reg) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') reg.update().catch(() => {}); // offline: try again next time
  });
}
function registerSW() {
  // file:// pages cannot register a service worker; skip instead of logging an error
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  swHadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
  watchUpdateReloadScreen();
  // a version bump only changes the imported config.js, so update checks must bypass the HTTP cache
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
    .then(checkForUpdateOnResume)
    .catch(e => console.warn('SW error:', e));
}

let deferredPrompt = null;
// phones / tablets only, and never again once the user closed it with ✕
function shouldShowInstallBanner() {
  return window.matchMedia(INSTALL_TOUCH_QUERY).matches && !getLS(INSTALL_DISMISSED_LS);
}
window.addEventListener('beforeinstallprompt', e => {
  // always keep Chrome's own mini-infobar away; the prompt stays available even when the banner is not shown
  e.preventDefault();
  deferredPrompt = e;
  if (shouldShowInstallBanner()) byId('installBanner').classList.add('visible');
});
function hideInstallBanner() {
  byId('installBanner').classList.remove('visible');
}
// ✕: hide for good
function dismissInstallBanner() {
  hideInstallBanner();
  setLS(INSTALL_DISMISSED_LS, true);
}
// installed from the browser menu (or via our prompt): the banner has nothing left to offer, and the saved
// event is spent (S-027: drop it so a stray promptInstall() cannot prompt() an installed app again)
function onAppInstalled() {
  deferredPrompt = null;
  hideInstallBanner();
}
window.addEventListener('appinstalled', onAppInstalled);
async function promptInstall() {
  // claim the event before awaiting: a second tap finds nothing, so prompt() runs at most once per event
  // (Chromium rejects a second prompt() on the same event)
  const ev = deferredPrompt;
  if (!ev) return;
  deferredPrompt = null;
  try {
    await Promise.all([ev.prompt(), ev.userChoice]);
  } catch {
    // a rejected prompt still spends the event; fall through and hide the banner
  }
  // either outcome spends the event, so hide the banner. A cancelled dialog is not a ✕: no INSTALL_DISMISSED_LS,
  // and the banner comes back when Chrome fires beforeinstallprompt again
  hideInstallBanner();
}
