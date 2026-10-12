// ════════════════════════════════════════
// FLAGGED — practice flags list (My Review › Flagged): unflag one by one or practise them all
// ════════════════════════════════════════
function flaggedStartHtml(n) {
  return `${bookmarkSvg('rv-flag-tile')}<div><b>${t('flagged.practise', { n })}</b><span class="fs-sub">${t('flagged.practiseSub', { max: PRACTICE_ROUND_MAX })}</span></div><span class="go">${lineIconSvg('arrowRight')}</span>`;
}
// keys: one question's flagged copies (G40: one item, refs joined); unflagging it clears every copy
function flaggedItemHtml(keys) {
  const k = keys[0], item = questionByKey(k);
  const unflag = escapeHtml(t('common.unflag'));
  return `<div class="flag-item"><div class="fi-text"><small>${copiesRefText(keys)}${LIST_SEP}${starsHtml(item.q.d)}</small><span class="fi-q" lang="en">${escapeHtml(item.q.q)}</span><div class="fi-yue" lang="zh-HK">${escapeHtml(item.q.yue)}</div></div>
        <button data-action="unflagFromList" data-arg="${escapeHtml(k)}" title="${unflag}" aria-label="${unflag}">${bookmarkSvg('rv-flag')}</button></div>`;
}
function openFlagged() {
  const groups = questionGroups(keysOf(practiceFlags)); // one per distinct question (G40)
  setShown('flaggedStart', groups.length > 0);
  byId('flaggedStart').innerHTML = flaggedStartHtml(groups.length);
  byId('flaggedList').innerHTML = groups.length
    ? groups.map(flaggedItemHtml).join('')
    : `<div class="empty-hint">${t('flagged.empty')}</div>`;
  showScreen('screenFlagged');
}
function unflagFromList(key) { setPracticeFlag(key, false); openFlagged(); }
// W-1: the pinned block's height as --flagged-top-h (css/screens/flagged.css scroll-padding-top); follows text size,
// language, the empty state and rotation. An older cached index.html (before v1.4.4) has no block, and a browser without
// ResizeObserver (Safari < 13.1) keeps the header-only padding: nothing to observe
const flaggedTop = document.querySelector('#screenFlagged .flagged-top');
if (flaggedTop && typeof ResizeObserver !== 'undefined') new ResizeObserver(([entry]) => {
  document.documentElement.style.setProperty('--flagged-top-h', `${entry.target.offsetHeight}px`);
}).observe(flaggedTop);
