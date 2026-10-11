// ════════════════════════════════════════
// HEADER POPOVERS — ⓘ "about" and (v1.2.0) ⚙ settings: each button toggles its own popover, only one is open at a
// time, and any click outside them or Escape closes them (see core/actions.js)
// ════════════════════════════════════════
const INFO_ARROW_X_VAR = '--info-arrow-x'; // css/components/popover.css .info-pop::after
// popover id → the button that opens it (a pre-v1.2.0 shell has no #settingsPop / #settingsBtn)
const HEADER_POPOVERS = { infoPop: 'infoBtn', settingsPop: 'settingsBtn' };
function setPopoverOpen(popId, open) {
  const pop = byId(popId), btn = byId(HEADER_POPOVERS[popId]);
  if (!pop || !btn) return;
  if (open) Object.keys(HEADER_POPOVERS).filter(id => id !== popId).forEach(id => setPopoverOpen(id, false));
  // a choice that closes it (Q10) would drop the keyboard focus with the hidden popover: hand it back to the button
  if (!open && pop.contains(document.activeElement)) btn.focus({ preventScroll: true });
  pop.classList.toggle('show', open);
  if (open) pointArrowAt(pop, btn);
  btn.classList.toggle('open', open);
  btn.setAttribute('aria-expanded', String(open));
}
const isPopoverOpen = popId => !!byId(popId) && byId(popId).classList.contains('show');
function setInfoOpen(open) { setPopoverOpen('infoPop', open); }
function setSettingsOpen(open) { setPopoverOpen('settingsPop', open); }
function closeHeaderPopovers() { Object.keys(HEADER_POPOVERS).forEach(id => setPopoverOpen(id, false)); }
// v1.0.5: the popover spans the width, so its arrow follows the ⓘ (header name length / language / screen width)
function pointArrowAt(pop, btn) {
  const btnBox = btn.getBoundingClientRect();
  const x = btnBox.left + btnBox.width / 2 - pop.getBoundingClientRect().left;
  pop.style.setProperty(INFO_ARROW_X_VAR, `${Math.round(x)}px`);
}
function toggleInfo() { setInfoOpen(!isPopoverOpen('infoPop')); }
function toggleSettingsPopover() { setSettingsOpen(!isPopoverOpen('settingsPop')); }
// counts in the popover text come from the data
function fillInfoCounts() {
  byId('infoTitle').textContent = t('app.title'); // v1.0.6 (user): the app title, as <title> and the header
  byId('infoIntro').textContent = t('app.infoIntro', { n: TOTAL_QUESTIONS });
  byId('infoExamCount').textContent = t('app.infoExams', { n: EXAM_COUNT });
  const chapterBadge = byId('infoChapterCount'); // a pre-v1.0.5 shell has no chapter badge
  if (chapterBadge) chapterBadge.textContent = t('app.infoChapters', { n: CHAPTER_NUMBERS.length });
  const questionBadge = byId('infoQuestionCount');
  questionBadge.textContent = t('app.infoQuestions', { n: TOTAL_QUESTIONS });
  questionBadge.setAttribute('aria-label', t('app.infoQuestionsLabel', { n: TOTAL_QUESTIONS })); // role="img": read as full words
}
// a rotation / resize with a popover open moves its button relative to it
window.addEventListener('resize', () => {
  Object.entries(HEADER_POPOVERS).filter(([popId]) => isPopoverOpen(popId)).forEach(([popId, btnId]) => pointArrowAt(byId(popId), byId(btnId)));
});
