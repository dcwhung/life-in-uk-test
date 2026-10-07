// ════════════════════════════════════════
// SIMILAR PANEL — practice only, once answered: other questions of the same STUDY fact,
// plus a one-off "Practise these N" session (hidden inside that session)
// ════════════════════════════════════════
function similarNodeClass(k) {
  const st = streakOf(questionByKey(k));
  return st >= MASTERY_STREAK ? ' mastered' : st > 0 ? ' weak' : '';
}
function similarItemHtml(k) {
  const item = questionByKey(k);
  return `<div class="sqm-item">
      <div class="sqm-item-top">
        <span class="sqm-id">${questionRefText(item)}</span>
        <span class="sqm-streak${isMastered(item) ? ' done' : ''}">${streakLabel(item)}</span>
      </div>
      <div class="sqm-q">${escapeHtml(item.q.q)}</div>
      <div class="sqm-qy">${escapeHtml(item.q.yue)}</div>
    </div>`;
}
// map node "E9·Q15" (1-based, like the "Exam 9 · Q15" refs)
function similarNodeText({ examNum, origIdx }) { return t('similar.node', { exam: examNum, n: origIdx + 1 }); }
// one display-only node coloured by its mastery (also the Study fact card's source row)
function similarNodeHtml(k) { return `<span class="sqm-node${similarNodeClass(k)}">${similarNodeText(questionByKey(k))}</span>`; }
function similarMapHtml(q, keys) {
  const nodes = [`<span class="sqm-node current">${similarNodeText(q)}</span>`].concat(keys.map(similarNodeHtml));
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
function similarPanelHtml(q, keys) {
  return `
    <div class="sqm-head">
      <span class="sqm-icon">🗺️</span>
      <span class="sqm-title"><b>${t('similar.title')}</b><span>${t('similar.subtitle')}</span></span>
      <span class="sqm-count">+${keys.length}</span>
    </div>
    ${factCardHtml(factOf(q), { variant: FACT_VARIANT.core })}
    ${similarMapHtml(q, keys)}
    ${similarLegendHtml()}
    <div class="sqm-list">${keys.map(similarItemHtml).join('')}</div>
    <div class="sqm-cta"><button data-action="startSimilarPractice">${t('similar.practise', { n: keys.length })}</button></div>`;
}
function renderSimilar(q, revealed) {
  const box = byId('similarBox');
  const show = state.mode === PRACTICE_MODE && revealed && !isSideSession();
  const keys = show ? similarKeys(q) : [];
  box.classList.toggle('show', keys.length > 0);
  box.innerHTML = keys.length ? similarPanelHtml(q, keys) : '';
}

// one-off side session over the similar questions (js/screens/sideSession.js); the original session
// is stashed and restored at the same question when the last one is done
function startSimilarPractice() {
  const keys = similarKeys(state.questions[state.current]);
  if (!keys.length) return;
  startSideSession(SIMILAR_EXAM, keys.map(questionByKey).map(toQuestionItem),
    { kind: SESSION_RETURN_KIND.quiz, state });
}
