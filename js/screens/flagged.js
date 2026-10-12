// ════════════════════════════════════════
// FLAGGED — practice flags list (My Review › Flagged): unflag one by one or practise them all
// ════════════════════════════════════════
function flaggedStartHtml(n) {
  return `${bookmarkSvg('rv-flag-tile')}<div><b>${t('flagged.practise', { n })}</b><span class="fs-sub">${t('flagged.practiseSub', { max: PRACTICE_ROUND_MAX })}</span></div><span class="go">→</span>`;
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
  wrapFlaggedList();
  showScreen('screenFlagged');
  desktopRefit('screenFlagged', () => {}); // nothing to measure: the run refreshes the list panel's fades
}
// v2.0.0 desktop (mockups/v2.0.0/desktop-flagged.html B): the list is a fading scroll panel under the practise button
// (css/screens/flagged.css, ≥ 1024px only; the wrapper and classes do nothing below that)
function wrapFlaggedList() {
  const list = byId('flaggedList');
  if (list.parentElement.classList.contains('fit-fade')) return;
  const wrap = deskEl('div', 'flagged-wrap fit-fade');
  list.before(wrap);
  wrap.append(list);
  list.classList.add('fit-panel');
  byId('screenFlagged').classList.add('is-fit');
}
function unflagFromList(key) { setPracticeFlag(key, false); openFlagged(); }
