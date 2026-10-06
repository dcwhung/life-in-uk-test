// ════════════════════════════════════════
// FLAGGED — practice flags list (My Review › Flagged): unflag one by one or practise them all
// ════════════════════════════════════════
function flaggedStartHtml(n) {
  return `${bookmarkSvg('rv-flag-tile')}<div><b>${t('flagged.practise', { n })}</b><span class="fs-sub">${t('flagged.practiseSub', { max: PRACTICE_ROUND_MAX })}</span></div><span class="go">→</span>`;
}
function flaggedItemHtml(k) {
  const item = questionByKey(k);
  const unflag = escapeHtml(t('common.unflag'));
  return `<div class="flag-item"><div class="fi-text"><small>${questionRefText(item)}${LIST_SEP}${starsHtml(item.q.d)}</small>${escapeHtml(item.q.q)}<div class="fi-yue">${escapeHtml(item.q.yue)}</div></div>
        <button data-action="unflagFromList" data-arg="${escapeHtml(k)}" title="${unflag}" aria-label="${unflag}">${bookmarkSvg('rv-flag')}</button></div>`;
}
function openFlagged() {
  const keys = keysOf(practiceFlags);
  setShown('flaggedStart', keys.length > 0);
  byId('flaggedStart').innerHTML = flaggedStartHtml(keys.length);
  byId('flaggedList').innerHTML = keys.length
    ? keys.map(flaggedItemHtml).join('')
    : `<div class="empty-hint">${t('flagged.empty')}</div>`;
  showScreen('screenFlagged');
}
function unflagFromList(key) { setPracticeFlag(key, false); openFlagged(); }
