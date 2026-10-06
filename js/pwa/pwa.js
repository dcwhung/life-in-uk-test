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
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  byId('installBanner').classList.add('visible');
});
async function promptInstall() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') byId('installBanner').classList.remove('visible');
  deferredPrompt = null;
}
