// ════════════════════════════════════════
// MODAL — in-app confirm (no browser alert / confirm boxes during an exam)
// ════════════════════════════════════════
let confirmOnOk = null;
function showConfirm({ title, message, okLabel, cancelLabel, onOk }) {
  byId('confirmTitle').textContent = title;
  byId('confirmMsg').textContent = message;
  byId('confirmOk').textContent = okLabel;
  byId('confirmCancel').textContent = cancelLabel;
  confirmOnOk = onOk;
  byId('confirmModal').classList.add('show');
  byId('confirmOk').focus();
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
