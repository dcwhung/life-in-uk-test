// ════════════════════════════════════════
// SHARE (v2.6.0) — the header share button: the system share sheet (Web Share API: WhatsApp, Messages, AirDrop, Copy …)
// where the browser has one, else the link goes to the clipboard with a toast. Cancelling the sheet does nothing.
// ════════════════════════════════════════
const SHARE_ABORT_ERROR = 'AbortError';

// the app's own folder, without any ?query or #hash (works for the live site and a local copy alike)
function shareUrl() {
  return new URL('.', location.href).href;
}

async function shareApp() {
  const data = { title: t('app.title'), text: t('app.shareText'), url: shareUrl() };
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share(data);
      return;
    } catch (err) {
      if (err && err.name === SHARE_ABORT_ERROR) return; // the user closed the sheet
      // NotAllowedError / a sheet already open …: fall through to the copy
    }
  }
  await copyShareLink(data.url);
}

async function copyShareLink(url) {
  try {
    await navigator.clipboard.writeText(url);
    showToast(t('app.shareCopied'));
  } catch (err) {
    showToast(t('app.shareFailed', { url })); // no clipboard (http / permission): show the link to copy by hand
  }
}
