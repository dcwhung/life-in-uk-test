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
  byId('infoTitle').firstChild.textContent = `Exam 1–${EXAM_COUNT} Practice `;
  byId('infoIntro').textContent =
    `${TOTAL_QUESTIONS} official-style questions from lifeintheuktestweb.co.uk, with Cantonese translations and notes.`;
  byId('infoExamCount').textContent = `📋 ${EXAM_COUNT} Exams`;
  byId('infoQuestionCount').textContent = `❓ ${TOTAL_QUESTIONS} Questions`;
}
