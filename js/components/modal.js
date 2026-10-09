// ════════════════════════════════════════
// MODAL — in-app confirm (no browser alert / confirm boxes during an exam)
// ════════════════════════════════════════
const MODAL_DANGER_CLASS = 'danger';
let confirmOnOk = null;
let confirmReturnFocus = null; // S-025: the element focused before the modal opened
// focusCancel: destructive confirms (reset, leave the exam) start on the safe button so a stray Enter
// or Space does not wipe anything; Submit keeps the default focus on OK
// danger: a destructive confirm (reset / turn off) draws in red (css/components/modal.css .modal-card.danger)
function showConfirm({ title, message, okLabel, cancelLabel, onOk, focusCancel = false, danger = false }) {
  byId('confirmModal').querySelector('.modal-card').classList.toggle(MODAL_DANGER_CLASS, danger);
  byId('confirmTitle').textContent = title;
  byId('confirmMsg').textContent = message;
  byId('confirmOk').textContent = okLabel;
  byId('confirmCancel').textContent = cancelLabel;
  confirmOnOk = onOk;
  if (!isConfirmOpen()) confirmReturnFocus = document.activeElement;
  byId('confirmModal').classList.add('show');
  byId(focusCancel ? 'confirmCancel' : 'confirmOk').focus();
}
function closeConfirm() {
  byId('confirmModal').classList.remove('show');
  confirmOnOk = null;
  const back = confirmReturnFocus;
  confirmReturnFocus = null;
  if (back && back.isConnected) back.focus();
}
// S-025: Tab / Shift+Tab cycle through the modal's buttons instead of leaving for the page behind it
function trapConfirmTab(e) {
  const buttons = [...byId('confirmModal').querySelectorAll('button')];
  const at = buttons.indexOf(document.activeElement);
  const next = at < 0 ? 0 : (at + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
  e.preventDefault();
  buttons[next].focus();
}
function isConfirmOpen() { return byId('confirmModal').classList.contains('show'); }
function confirmAccept() {
  const run = confirmOnOk;
  closeConfirm();
  if (run) run();
}
