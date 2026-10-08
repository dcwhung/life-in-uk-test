// ════════════════════════════════════════
// SWITCH — an on / off toggle (role="switch"); css/components/switch.css. The caller's action flips the
// setting and re-renders, so the markup only reflects `on`.
// ════════════════════════════════════════
function switchHtml({ id, on, action, labelKey, describedBy = '' }) {
  const desc = describedBy ? ` aria-describedby="${describedBy}"` : '';
  return `<button type="button" class="switch" id="${id}" role="switch" aria-checked="${on ? 'true' : 'false'}"`
    + ` aria-label="${escapeHtml(t(labelKey))}"${desc} data-action="${action}"><i aria-hidden="true"></i></button>`;
}
