// ════════════════════════════════════════
// SIMILAR PANEL — practice only, once answered: other questions of the same STUDY fact,
// plus a one-off "Practise these N" session (hidden inside that session)
// ════════════════════════════════════════
let similarReturn = null; // the stashed session while practising similar questions
function isSimilarSession() { return similarReturn !== null; }

function similarNodeClass(k) {
  const st = streakOf(questionByKey(k));
  return st >= MASTERY_STREAK ? ' mastered' : st > 0 ? ' weak' : '';
}
function similarItemHtml(k) {
  const item = questionByKey(k);
  return `<div class="sqm-item">
      <div class="sqm-item-top">
        <span class="sqm-id">${questionRefText(item)}</span>
        <span class="sqm-streak${isMastered(item) ? ' done' : ''}">${streakLabel(item, '✓ Mastered')}</span>
      </div>
      <div class="sqm-q">${escapeHtml(item.q.q)}</div>
      <div class="sqm-qy">${escapeHtml(item.q.yue)}</div>
    </div>`;
}
function similarFactHtml(f) {
  return `<div class="sqm-fact">
      <div class="sqm-fact-label">📌 Core Fact #${f.id}</div>
      <div class="sqm-fact-en">${escapeHtml(f.en)}</div>
      <div class="sqm-fact-yue">${escapeHtml(f.yue)}</div>
    </div>`;
}
function similarMapHtml(q, keys) {
  const nodes = [`<span class="sqm-node current">${qKey(q)}</span>`]
    .concat(keys.map(k => `<span class="sqm-node${similarNodeClass(k)}">${k}</span>`));
  return `<div class="sqm-map"><span class="sqm-map-label">Appears in:</span>${nodes.join('')}</div>`;
}
function similarLegendHtml() {
  return `<div class="sqm-legend">
      <span><i class="lg-current"></i>This question</span>
      <span><i class="lg-mastered"></i>Mastered ${MASTERY_STREAK}/${MASTERY_STREAK}</span>
      <span><i class="lg-weak"></i>In progress</span>
      <span><i class="lg-new"></i>0/${MASTERY_STREAK}</span>
    </div>`;
}
function similarPanelHtml(q, keys) {
  return `
    <div class="sqm-head">
      <span class="sqm-icon">🗺️</span>
      <span class="sqm-title"><b>Similar Questions</b><span>Same fact, asked differently</span></span>
      <span class="sqm-count">+${keys.length}</span>
    </div>
    ${similarFactHtml(factOf(q))}
    ${similarMapHtml(q, keys)}
    ${similarLegendHtml()}
    <div class="sqm-list">${keys.map(similarItemHtml).join('')}</div>
    <div class="sqm-cta"><button data-action="startSimilarPractice">▶ Practise these ${keys.length}</button></div>`;
}
function renderSimilar(q, revealed) {
  const box = byId('similarBox');
  const show = state.mode === PRACTICE_MODE && revealed && !isSimilarSession();
  const keys = show ? similarKeys(q) : [];
  box.classList.toggle('show', keys.length > 0);
  box.innerHTML = keys.length ? similarPanelHtml(q, keys) : '';
}

// one-off session over the similar questions (each once, listed order); the original session
// is stashed and restored at the same question when the last one is done
function startSimilarPractice() {
  const keys = similarKeys(state.questions[state.current]);
  if (!keys.length) return;
  similarReturn = state;
  state = {
    ...state,
    examNum: SIMILAR_EXAM,
    questions: keys.map(questionByKey).map(toQuestionItem),
    current: 0,
    answers: {},
    revealed: {},
    yueShown: {},
  };
  renderQuestion();
  window.scrollTo(0, 0);
}
function returnFromSimilar() {
  state = similarReturn;
  similarReturn = null;
  renderQuestion();
  window.scrollTo(0, 0);
}
