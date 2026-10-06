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
  return window.matchMedia(INSTALL_TOUCH_QUERY).matches && !getLS(INSTALL_DISMISSED_KEY);
}
window.addEventListener('beforeinstallprompt', e => {
  // always keep Chrome's own mini-infobar away; the prompt stays available even when the banner is not shown
  e.preventDefault();
  deferredPrompt = e;
  if (shouldShowInstallBanner()) byId('installBanner').classList.add('visible');
});
function dismissInstallBanner() {
  byId('installBanner').classList.remove('visible');
  setLS(INSTALL_DISMISSED_KEY, true);
}
async function promptInstall() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') byId('installBanner').classList.remove('visible');
  deferredPrompt = null;
}
