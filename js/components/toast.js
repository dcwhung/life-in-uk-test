// ════════════════════════════════════════
// TOAST — a short status line at the bottom of the screen (mockup .sp-toast; css/components/toast.css).
// It sits in a polite live region, never takes focus and hides itself after TOAST_MS; a new toast replaces the
// one showing. A shell without #appToast (older cached index.html) shows nothing.
// ════════════════════════════════════════
let toastTimer = null;
function showToast(message) {
  const el = byId('appToast');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, TOAST_MS);
}
function hideToast() {
  clearTimeout(toastTimer);
  toastTimer = null;
  const el = byId('appToast');
  if (el) el.hidden = true;
}
