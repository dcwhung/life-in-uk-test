// ════════════════════════════════════════
// HEADER INFO POPOVER — ⓘ toggles it; any click outside it or Escape closes it (see core/actions.js)
// ════════════════════════════════════════
function setInfoOpen(open) {
  byId('infoPop').classList.toggle('show', open);
  const btn = byId('infoBtn');
  btn.classList.toggle('open', open);
  btn.setAttribute('aria-expanded', String(open));
}
function toggleInfo() {
  setInfoOpen(!byId('infoPop').classList.contains('show'));
}
// counts in the popover text come from the data
function fillInfoCounts() {
  byId('infoTitle').textContent = t('app.infoTitle', { n: EXAM_COUNT });
  byId('infoIntro').textContent = t('app.infoIntro', { n: TOTAL_QUESTIONS });
  byId('infoExamCount').textContent = t('app.infoExams', { n: EXAM_COUNT });
  byId('infoQuestionCount').textContent = t('app.infoQuestions', { n: TOTAL_QUESTIONS });
}
