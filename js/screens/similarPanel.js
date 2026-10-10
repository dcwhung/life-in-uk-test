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
// mark and the count is every question of the fact (no "+"). groups = similarGroups(q): counts are distinct questions (G40).
// No item to list (S-141a, user 2026-10-09: in Practice, a fact whose sources are all copies of q, 9 facts): the core
// fact card and the map's merged current node only; no list, count badge, legend (it explains the other nodes'
// colours) or practise button. Standalone (plan runner) always lists q itself, so it keeps its list, count and CTA
function similarCtaHtml(groups, cta) {
  const { action, arg, n } = cta || { action: 'startSimilarPractice', n: groups.length };
  const argAttr = arg === undefined ? '' : ` data-arg="${escapeHtml(arg)}"`;
  return `<div class="sqm-cta"><button data-action="${action}"${argAttr}>${t('similar.practise', { n })}</button></div>`;
}
// legend, item cards (q first when standalone) and the practise button; '' when there is no item
function similarListHtml(q, groups, { practise, cta, currentMark }) {
  const items = (currentMark ? [similarItemHtml(currentCopies(q), currentMark)] : []).concat(groups.map(g => similarItemHtml(g)));
  if (!items.length) return '';
  const ctaHtml = practise ? similarCtaHtml(groups, cta) : '';
  return `${similarLegendHtml()}<div class="sqm-list">${items.join('')}</div>${ctaHtml}`;
}
function similarPanelHtml(q, groups, { practise = true, cta = null, currentMark = '' } = {}) {
  const count = currentMark ? groups.length + 1 : `+${groups.length}`;
  const countHtml = groups.length || currentMark ? `<span class="sqm-count">${count}</span>` : '';
  return `
    <div class="sqm-head">
      <span class="sqm-icon">🗺️</span>
      <span class="sqm-title"><b>${t('similar.title')}</b><span>${t('similar.subtitle')}</span></span>
      ${countHtml}
    </div>
    ${factCardHtml(factOf(q), { variant: FACT_VARIANT.core })}
    ${similarMapHtml(q, groups)}
    ${similarListHtml(q, groups, { practise, cta, currentMark })}`;
}
function renderSimilar(q, revealed) {
  const box = byId('similarBox');
  // G26: a plan task session shows the panel too, without its own side session
  const show = state.mode === PRACTICE_MODE && revealed && (!isSideSession() || isPlanSession());
  // S-141a: a fact whose other sources are all copies of q still shows it; a one-source fact has nothing to map
  const fact = show ? factOf(q) : null, shown = !!fact && fact.src.length > 1;
  box.classList.toggle('show', shown);
  box.innerHTML = shown ? similarPanelHtml(q, similarGroups(q), { practise: !isPlanSession() }) : '';
}

// one-off side session over the similar questions (js/screens/sideSession.js), each distinct question once (G40);
// the original session is stashed and restored at the same question when the last one is done
function startSimilarPractice() {
  const keys = similarKeys(state.questions[state.current]);
  if (!keys.length) return;
  startSideSession(SIMILAR_EXAM, keys.map(questionByKey).map(toQuestionItem),
    { kind: SESSION_RETURN_KIND.quiz, state });
}
