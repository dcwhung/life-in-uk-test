// ════════════════════════════════════════
// PWA — service worker (sw.js at the site root) + install banner
// ════════════════════════════════════════
function registerSW() {
  // file:// pages cannot register a service worker; skip instead of logging an error
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  // a version bump only changes the imported config.js, so update checks must bypass the HTTP cache
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
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
