// ════════════════════════════════════════
// ACTIONS — event delegation instead of inline handlers.
// Markup: <button data-action="name" data-arg="…">; inputs: <input data-input-action="name">.
// One document-level click, input and keydown (Escape) listener each.
// ════════════════════════════════════════
const numArg = el => Number(el.dataset.arg);
// Exam 1–17 are numbers; 'all' and the other set ids stay strings (isNumberedExam checks the type)
const examArg = el => (/^\d+$/.test(el.dataset.arg) ? Number(el.dataset.arg) : el.dataset.arg);

const ACTIONS = {
  // header + home
  toggleInfo: () => toggleInfo(),
  install: () => promptInstall(),
  dismissInstall: () => dismissInstallBanner(),
  openStudy: () => openStudy(),
  startMode: el => startMode(el.dataset.arg),
  setPracticeView: el => setPracticeView(el.dataset.arg),
  startExam: el => startExam(examArg(el)),
  startDifficulty: el => startDifficulty(numArg(el)),
  startChapter: el => startChapter(numArg(el)),
  startWrongReview: () => startWrongReview(),
  openFlagged: () => openFlagged(),
  resetPracticeProgress: () => resetPracticeProgress(),
  resetCompletedExams: () => resetCompletedExams(),
  goHome: () => goHome(),
  // quiz
  selectOption: el => selectOption(numArg(el)),
  toggleQuestionYue: () => toggleQuestionYue(),
  toggleFlag: () => toggleFlag(),
  goToQuestion: el => goToQuestion(numArg(el)),
  prevQ: () => prevQ(),
  next: () => runNextAction(),
  startSimilarPractice: () => startSimilarPractice(),
  // results
  retryExam: () => retryExam(),
  setReviewFilter: el => setReviewFilter(el.dataset.arg),
  jumpToReview: el => jumpToReview(numArg(el)),
  // flagged list
  startFlaggedPractice: () => startFlaggedPractice(),
  unflagFromList: el => unflagFromList(el.dataset.arg),
  // study
  studySetTab: el => studySetTab(el.dataset.arg),
  studySetChapter: el => studySetChapter(numArg(el)),
  studySetNation: el => studySetNation(el.dataset.arg),
  studySetGroup: el => studySetGroup(el.dataset.arg),
  studyToggle: el => studyToggle(el.dataset.arg),
  studyToggleMark: el => studyToggleMark(el.dataset.mark, numArg(el)),
  studySetSearch: el => studySetSearch(el.value),
  startFactPractice: el => startFactPractice(numArg(el)),
  // confirm modal
  confirmAccept: () => confirmAccept(),
  closeConfirm: () => closeConfirm(),
  // backdrop click cancels; clicks inside the card bubble here too and are ignored
  confirmBackdrop: (el, e) => { if (e.target === el) closeConfirm(); },
};

// an unknown name (typo in markup) warns instead of throwing, so the popover close below still runs
function runAction(name, el, e) {
  const handler = ACTIONS[name];
  if (!handler) { console.warn(`[actions] no handler for data-action "${name}"`); return; }
  handler(el, e);
}

// CUI-0011: a double tap on a button that opens a new screen ("▶ Practise", a Home exam cell) lands
// its second tap on that screen; on an option it answered Q1 and wrote practiceStreak / wrongList.
// So after a pointer click changes the view, a pointer click on that same view, within
// DOUBLE_TAP_SLOP_PX of the first and SCREEN_CHANGE_CLICK_GUARD_MS after it, is ignored. The view is
// the active .screen plus the question list: Similar "Practise these N" and ↩ Back swap the session
// while staying on the quiz screen. Same-view repeats (quick Next, ← →) never arm the guard, a tap
// elsewhere (e.g. ← Home) is not stray, and once the view moves on without a click it lapses.
// S-036: classic scripts share one global scope, so these names carry a clickGuard prefix.
let clickGuard = null; // { view, x, y, at } of the last click that changed the view
const clickGuardView = () => [document.querySelector('.screen.active'), state.questions];
const isSameClickView = (a, b) => a[0] === b[0] && a[1] === b[1];
// keyboard Enter / Space (and el.click()) fire click with detail 0: they neither arm nor hit the guard
const isPointerClick = e => e.detail > 0;
// the confirm modal opens on top of the screen it was asked from, so its buttons always work
function isStrayClick(e, el) {
  if (!clickGuard || !isPointerClick(e) || el.closest('#confirmModal') || !isSameClickView(clickGuard.view, clickGuardView())) return false;
  const near = Math.hypot(e.clientX - clickGuard.x, e.clientY - clickGuard.y) <= DOUBLE_TAP_SLOP_PX;
  // S-035: the time between the two taps' own event timeStamps (a tap queued while the first handler ran
  // still has a later timeStamp); a negative gap means an unreliable clock, so the guard fails open
  const dt = e.timeStamp - clickGuard.at;
  return near && dt >= 0 && dt < SCREEN_CHANGE_CLICK_GUARD_MS;
}
function runClickAction(el, e) {
  if (isStrayClick(e, el)) return;
  const before = clickGuardView();
  runAction(el.dataset.action, el, e);
  const view = clickGuardView();
  if (isPointerClick(e) && !isSameClickView(before, view)) clickGuard = { view, x: e.clientX, y: e.clientY, at: e.timeStamp };
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (el && !el.disabled) runClickAction(el, e);
  // the ⓘ button toggles the popover itself; any other click outside the popover closes it
  if (el && el.dataset.action === 'toggleInfo') return;
  if (!e.target.closest('#infoPop')) setInfoOpen(false);
});
document.addEventListener('input', e => {
  const el = e.target.closest('[data-input-action]');
  if (el) runAction(el.dataset.inputAction, el, e);
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (isConfirmOpen()) closeConfirm();
  setInfoOpen(false);
});
