// ════════════════════════════════════════
// PWA — service worker (sw.js at the site root) + install banner
// ════════════════════════════════════════
function registerSW() {
  // file:// pages cannot register a service worker; skip instead of logging an error
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('sw.js')
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
