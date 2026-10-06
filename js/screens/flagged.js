// ════════════════════════════════════════
// FLAGGED — practice flags list (My Review › Flagged): unflag one by one or practise them all
// ════════════════════════════════════════
function flaggedStartHtml(n) {
  return `${bookmarkSvg('rv-flag-tile')}<div><b>Practise flagged (${n})</b><span class="fs-sub">Each question once · up to ${PRACTICE_ROUND_MAX} per round</span></div><span class="go">→</span>`;
}
function flaggedItemHtml(k) {
  const item = questionByKey(k);
  return `<div class="flag-item"><div class="fi-text"><small>${questionRefText(item)} · ${starsHtml(item.q.d)}</small>${escapeHtml(item.q.q)}<div class="fi-yue">${escapeHtml(item.q.yue)}</div></div>
        <button data-action="unflagFromList" data-arg="${k}" title="Unflag" aria-label="Unflag">${bookmarkSvg('rv-flag')}</button></div>`;
}
function openFlagged() {
  const keys = keysOf(practiceFlags);
  setShown('flaggedStart', keys.length > 0);
  byId('flaggedStart').innerHTML = flaggedStartHtml(keys.length);
  byId('flaggedList').innerHTML = keys.length
    ? keys.map(flaggedItemHtml).join('')
    : '<div class="empty-hint">No flagged questions left.</div>';
  showScreen('screenFlagged');
}
function unflagFromList(key) { setPracticeFlag(key, false); openFlagged(); }
