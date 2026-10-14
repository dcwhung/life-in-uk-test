// ════════════════════════════════════════
// HEADER POPOVERS — ⓘ "about" and (v1.2.0) ⚙ settings: each button toggles its own popover, only one is open at a
// time, and any click outside them or Escape closes them (see core/actions.js)
// ════════════════════════════════════════
const INFO_ARROW_X_VAR = '--info-arrow-x'; // css/components/popover.css .info-pop::after
const INFO_ARROW_MIX_VAR = '--info-arrow-mix'; // v2.6.1: how far along the card's gradient the arrow sits (its fill)
// v2.6.2: room between the arrow's base and each top corner (caps that corner's radius, css .info-pop)
const INFO_ROOM_LEFT_VAR = '--info-pop-room-l';
const INFO_ROOM_RIGHT_VAR = '--info-pop-room-r';
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
  // v2.6.1 (user: the arrow showed a darker diamond and a seam): the card is a 135deg gradient, whose colour on the top
  // edge at x is x / (width + height) of the way; offset sizes, so a transform or zoom never skews it
  const mix = (x / (pop.offsetWidth + pop.offsetHeight)) * PERCENT;
  pop.style.setProperty(INFO_ARROW_MIX_VAR, `${mix.toFixed(1)}%`);
  capArrowCorners(pop, x);
}
// v2.6.2 (user: the ⚙ arrow still came loose): ⚙ sits ~19px from the card's right edge, so the arrow's base reached
// into the 14px rounded corner, where the edge has already curved away. Each top corner's radius is capped at the
// room between the arrow's base (half the rotated square's diagonal from its centre) and that edge
function capArrowCorners(pop, x) {
  const half = parseFloat(getComputedStyle(pop, '::after').width) * Math.SQRT1_2;
  const room = edgeDistance => `${Math.max(0, Math.floor(edgeDistance - half))}px`;
  pop.style.setProperty(INFO_ROOM_LEFT_VAR, room(x));
  pop.style.setProperty(INFO_ROOM_RIGHT_VAR, room(pop.offsetWidth - x));
}
function toggleInfo() { setInfoOpen(!isPopoverOpen('infoPop')); }
function toggleSettingsPopover() { setSettingsOpen(!isPopoverOpen('settingsPop')); }
// counts in the popover text come from the data
// W-057: a cached pre-v2.7.0 questions.js has no QUESTION_COUNT_LABEL: fall back to the exact total (as before v2.7.0)
const questionCountLabel = () => (typeof QUESTION_COUNT_LABEL !== 'undefined' ? QUESTION_COUNT_LABEL : TOTAL_QUESTIONS);
function fillInfoCounts() {
  byId('infoTitle').textContent = t('app.title'); // v1.0.6 (user): the app title, as <title> and the header
  byId('infoIntro').textContent = t('app.infoIntro', { n: questionCountLabel() });
  byId('infoExamCount').textContent = t('app.infoExams', { n: EXAM_COUNT });
  const chapterBadge = byId('infoChapterCount'); // a pre-v1.0.5 shell has no chapter badge
  if (chapterBadge) chapterBadge.textContent = t('app.infoChapters', { n: CHAPTER_NUMBERS.length });
  const questionBadge = byId('infoQuestionCount');
  questionBadge.textContent = t('app.infoQuestions', { n: questionCountLabel() });
  questionBadge.setAttribute('aria-label', t('app.infoQuestionsLabel', { n: questionCountLabel() })); // role="img": read as full words
}
// a rotation / resize with a popover open moves its button relative to it
window.addEventListener('resize', () => {
  Object.entries(HEADER_POPOVERS).filter(([popId]) => isPopoverOpen(popId)).forEach(([popId, btnId]) => pointArrowAt(byId(popId), byId(btnId)));
});
