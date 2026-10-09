// ════════════════════════════════════════
// SIMILAR PANEL — practice only, once answered: other questions of the same STUDY fact,
// plus a one-off "Practise these N" session (hidden inside that session)
// ════════════════════════════════════════
// mark: text after the ref (a study plan's wrong answer: "· You got this wrong"); none by default
function similarItemHtml(k, mark = '') {
  const item = questionByKey(k);
  return `<div class="sqm-item">
      <div class="sqm-item-top">
        <span class="sqm-id">${questionRefText(item)}${mark ? LIST_SEP + escapeHtml(mark) : ''}</span>
        <span class="sqm-streak${isMastered(item) ? ' done' : ''}">${streakLabel(item)}</span>
      </div>
      <div class="sqm-q" lang="en">${escapeHtml(item.q.q)}</div>
      <div class="sqm-qy" lang="zh-HK">${escapeHtml(item.q.yue)}</div>
    </div>`;
}
function similarMapHtml(q, keys) {
  const nodes = [`<span class="sqm-node current">${questionNodeText(q)}</span>`].concat(keys.map(questionNodeHtml));
  return `<div class="sqm-map"><span class="sqm-map-label">${t('similar.appearsIn')}</span>${nodes.join('')}</div>`;
}
function similarLegendHtml() {
  return `<div class="sqm-legend">
      <span><i class="lg-current"></i>${t('similar.legendCurrent')}</span>
      <span><i class="lg-mastered"></i>${t('common.mastered')}</span>
      <span><i class="lg-weak"></i>${t('similar.legendInProgress')}</span>
      <span><i class="lg-new"></i>${streakText(0)}</span>
    </div>`;
}
// practise: false = no "Practise these N" (G26: a plan task session, which has nowhere to come back to after it);
// cta (arch §E.3): { action, arg, n } another session for the button (a study plan's wrong fact), n = the questions it asks;
// currentMark (CUI-0025): the panel stands alone (no question card above it), so q itself is listed first with this
// mark and the count is every question of the fact (no "+")
function similarCtaHtml(keys, cta) {
  const { action, arg, n } = cta || { action: 'startSimilarPractice', n: keys.length };
  const argAttr = arg === undefined ? '' : ` data-arg="${escapeHtml(arg)}"`;
  return `<div class="sqm-cta"><button data-action="${action}"${argAttr}>${t('similar.practise', { n })}</button></div>`;
}
function similarPanelHtml(q, keys, { practise = true, cta = null, currentMark = '' } = {}) {
  const ctaHtml = practise ? similarCtaHtml(keys, cta) : '';
  const items = (currentMark ? [similarItemHtml(qKey(q), currentMark)] : []).concat(keys.map(k => similarItemHtml(k)));
  const count = currentMark ? keys.length + 1 : `+${keys.length}`;
  return `
    <div class="sqm-head">
      <span class="sqm-icon">🗺️</span>
      <span class="sqm-title"><b>${t('similar.title')}</b><span>${t('similar.subtitle')}</span></span>
      <span class="sqm-count">${count}</span>
    </div>
    ${factCardHtml(factOf(q), { variant: FACT_VARIANT.core })}
    ${similarMapHtml(q, keys)}
    ${similarLegendHtml()}
    <div class="sqm-list">${items.join('')}</div>
    ${ctaHtml}`;
}
function renderSimilar(q, revealed) {
  const box = byId('similarBox');
  // G26: a plan task session shows the panel too, without its own side session
  const show = state.mode === PRACTICE_MODE && revealed && (!isSideSession() || isPlanSession());
  const keys = show ? similarKeys(q) : [];
  box.classList.toggle('show', keys.length > 0);
  box.innerHTML = keys.length ? similarPanelHtml(q, keys, { practise: !isPlanSession() }) : '';
}

// one-off side session over the similar questions (js/screens/sideSession.js); the original session
// is stashed and restored at the same question when the last one is done
function startSimilarPractice() {
  const keys = similarKeys(state.questions[state.current]);
  if (!keys.length) return;
  startSideSession(SIMILAR_EXAM, keys.map(questionByKey).map(toQuestionItem),
    { kind: SESSION_RETURN_KIND.quiz, state });
}
