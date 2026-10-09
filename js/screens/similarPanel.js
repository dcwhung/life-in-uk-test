// ════════════════════════════════════════
// SIMILAR PANEL — practice only, once answered: other questions of the same STUDY fact,
// plus a one-off "Practise these N" session (hidden inside that session)
// ════════════════════════════════════════
// one card per distinct question; keys = its copies (G40: refs joined, "Exam 7 · Q16 = Exam 13 · Q1"; the copies share
// text and streak). mark: text after the ref (a study plan's wrong answer: "· You got this wrong"); none by default
function similarItemHtml(keys, mark = '') {
  const item = questionByKey(keys[0]);
  return `<div class="sqm-item">
      <div class="sqm-item-top">
        <span class="sqm-id">${copiesRefText(keys)}${mark ? LIST_SEP + escapeHtml(mark) : ''}</span>
        <span class="sqm-streak${isMastered(item) ? ' done' : ''}">${streakLabel(item)}</span>
      </div>
      <div class="sqm-q" lang="en">${escapeHtml(item.q.q)}</div>
      <div class="sqm-qy" lang="zh-HK">${escapeHtml(item.q.yue)}</div>
    </div>`;
}
// groups: similarGroups(q); q's own copies join its "current" node (G40)
function similarMapHtml(q, groups) {
  const nodes = [`<span class="sqm-node current">${copiesNodeText(currentCopies(q))}</span>`].concat(groups.map(questionNodeHtml));
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
// mark and the count is every question of the fact (no "+"). groups = similarGroups(q): counts are distinct questions (G40)
function similarCtaHtml(groups, cta) {
  const { action, arg, n } = cta || { action: 'startSimilarPractice', n: groups.length };
  const argAttr = arg === undefined ? '' : ` data-arg="${escapeHtml(arg)}"`;
  return `<div class="sqm-cta"><button data-action="${action}"${argAttr}>${t('similar.practise', { n })}</button></div>`;
}
function similarPanelHtml(q, groups, { practise = true, cta = null, currentMark = '' } = {}) {
  const ctaHtml = practise ? similarCtaHtml(groups, cta) : '';
  const items = (currentMark ? [similarItemHtml(currentCopies(q), currentMark)] : []).concat(groups.map(g => similarItemHtml(g)));
  const count = currentMark ? groups.length + 1 : `+${groups.length}`;
  return `
    <div class="sqm-head">
      <span class="sqm-icon">🗺️</span>
      <span class="sqm-title"><b>${t('similar.title')}</b><span>${t('similar.subtitle')}</span></span>
      <span class="sqm-count">${count}</span>
    </div>
    ${factCardHtml(factOf(q), { variant: FACT_VARIANT.core })}
    ${similarMapHtml(q, groups)}
    ${similarLegendHtml()}
    <div class="sqm-list">${items.join('')}</div>
    ${ctaHtml}`;
}
function renderSimilar(q, revealed) {
  const box = byId('similarBox');
  // G26: a plan task session shows the panel too, without its own side session
  const show = state.mode === PRACTICE_MODE && revealed && (!isSideSession() || isPlanSession());
  const groups = show ? similarGroups(q) : [];
  box.classList.toggle('show', groups.length > 0);
  box.innerHTML = groups.length ? similarPanelHtml(q, groups, { practise: !isPlanSession() }) : '';
}

// one-off side session over the similar questions (each distinct question once, G40) (js/screens/sideSession.js); the original session
// is stashed and restored at the same question when the last one is done
function startSimilarPractice() {
  const keys = similarKeys(state.questions[state.current]);
  if (!keys.length) return;
  startSideSession(SIMILAR_EXAM, keys.map(questionByKey).map(toQuestionItem),
    { kind: SESSION_RETURN_KIND.quiz, state });
}
