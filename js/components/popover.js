// ════════════════════════════════════════
// HEADER INFO POPOVER — ⓘ toggles it; any click outside it or Escape closes it (see core/actions.js)
// ════════════════════════════════════════
const INFO_ARROW_X_VAR = '--info-arrow-x'; // css/components/popover.css .info-pop::after
function setInfoOpen(open) {
  const pop = byId('infoPop');
  pop.classList.toggle('show', open);
  const btn = byId('infoBtn');
  if (open) pointArrowAt(pop, btn);
  btn.classList.toggle('open', open);
  btn.setAttribute('aria-expanded', String(open));
}
// v1.0.4: the popover spans the width, so its arrow follows the ⓘ (header name length / language / screen width)
function pointArrowAt(pop, btn) {
  const btnBox = btn.getBoundingClientRect();
  const x = btnBox.left + btnBox.width / 2 - pop.getBoundingClientRect().left;
  pop.style.setProperty(INFO_ARROW_X_VAR, `${Math.round(x)}px`);
}
function toggleInfo() {
  setInfoOpen(!byId('infoPop').classList.contains('show'));
}
// counts in the popover text come from the data
function fillInfoCounts() {
  byId('infoTitle').textContent = t('app.infoTitle', { n: EXAM_COUNT });
  byId('infoIntro').textContent = t('app.infoIntro', { n: TOTAL_QUESTIONS });
  byId('infoExamCount').textContent = t('app.infoExams', { n: EXAM_COUNT });
  const chapterBadge = byId('infoChapterCount'); // a pre-v1.0.4 shell has no chapter badge
  if (chapterBadge) chapterBadge.textContent = t('app.infoChapters', { n: CHAPTER_NUMBERS.length });
  byId('infoQuestionCount').textContent = t('app.infoQuestions', { n: TOTAL_QUESTIONS });
}
// a rotation / resize with the popover open moves ⓘ relative to it
window.addEventListener('resize', () => {
  const pop = byId('infoPop');
  if (pop.classList.contains('show')) pointArrowAt(pop, byId('infoBtn'));
});
