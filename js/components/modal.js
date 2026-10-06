// ════════════════════════════════════════
// MODAL — in-app confirm (no browser alert / confirm boxes during an exam)
// ════════════════════════════════════════
let confirmOnOk = null;
// focusCancel: destructive confirms (reset, leave the exam) start on the safe button so a stray Enter
// or Space does not wipe anything; Submit keeps the default focus on OK
function showConfirm({ title, message, okLabel, cancelLabel, onOk, focusCancel = false }) {
  byId('confirmTitle').textContent = title;
  byId('confirmMsg').textContent = message;
  byId('confirmOk').textContent = okLabel;
  byId('confirmCancel').textContent = cancelLabel;
  confirmOnOk = onOk;
  byId('confirmModal').classList.add('show');
  byId(focusCancel ? 'confirmCancel' : 'confirmOk').focus();
}
function closeConfirm() {
  byId('confirmModal').classList.remove('show');
  confirmOnOk = null;
}
function isConfirmOpen() { return byId('confirmModal').classList.contains('show'); }
function confirmAccept() {
  const run = confirmOnOk;
  closeConfirm();
  if (run) run();
}
