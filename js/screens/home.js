// ════════════════════════════════════════
// HOME — mode cards, practice set grids, My Review tiles, reset rows
// ════════════════════════════════════════
const MODE_DESC_HTML = {
  // W-058: translation off (v1.4.0) drops the "Cantonese translation" promise; a pre-v1.4.0 store.js reads as on (W-057)
  // S-205: a pre-v1.4.0 locale has no no-translation wording — keep the original sentence rather than a raw key
  [PRACTICE_MODE]: () => {
    const descKey = typeof isTranslationOn !== 'function' || isTranslationOn() ? 'home.practiceDescHtml' : 'home.practiceDescNoYueHtml';
    const desc = t(descKey);
    return desc === descKey ? t('home.practiceDescHtml') : desc;
  },
  [EXAM_MODE]: () => t('home.examDescHtml', { n: REAL_TEST_SIZE }),
};
const DEFAULT_MODE = PRACTICE_MODE;
const DEFAULT_PRACTICE_VIEW = 'difficulty';
const PRACTICE_VIEWS = ['difficulty', 'chapter', 'exam'];
let pendingMode = DEFAULT_MODE;
let practiceView = DEFAULT_PRACTICE_VIEW;

function loadHomePrefs() {
  const p = readHomePrefs();
  if (p.mode === PRACTICE_MODE || p.mode === EXAM_MODE) pendingMode = p.mode;
  if (PRACTICE_VIEWS.includes(p.view)) practiceView = p.view;
}
function saveHomePrefs() { writeHomePrefs({ mode: pendingMode, view: practiceView }); }
function startMode(mode) {
  pendingMode = mode;
  saveHomePrefs();
  buildExamGrid(); // mastery labels vs ✓ done depend on the mode
  renderModeSelection();
}
function setPracticeView(view) {
  practiceView = view;
  saveHomePrefs();
  renderModeSelection();
}

// ── grids ──
function examMasteryHtml(list) {
  const m = masteryOf(list);
  return `<span class="exam-mastery${m.mastered ? '' : ' zero'}">${masteryText(m)}</span>${masteryBarHtml(m)}`;
}
function allExamsButtonHtml(isPractice) {
  const inner = isPractice
    ? t('home.allExams', { n: TOTAL_QUESTIONS }) + examMasteryHtml(allQuestions())
    : `${t('home.randomExam')}<span class="exam-sub">${t('home.randomExamSub', { n: RANDOM_EXAM_SIZE, total: TOTAL_QUESTIONS })}</span>`;
  return `<button class="exam-btn all" data-action="startExam" data-arg="${escapeHtml(ALL_EXAM)}">${inner}</button>`;
}
function buildExamGrid() {
  const done = completedExams();
  const isPractice = pendingMode === PRACTICE_MODE;
  const buttons = EXAM_NUMBERS.map(n => {
    const doneCls = !isPractice && done[n] ? ' done' : '';
    const mastery = isPractice ? examMasteryHtml(examQuestions(n)) : '';
    return `<button class="exam-btn${doneCls}" data-action="startExam" data-arg="${escapeHtml(n)}">${t('common.examN', { n })}${mastery}</button>`;
  });
  byId('examGrid').innerHTML = allExamsButtonHtml(isPractice) + buttons.join('');
  buildChapterGrid();
  buildDiffGrid();
}
function buildDiffGrid() {
  byId('diffGrid').innerHTML = DIFF_LEVELS.map(d => setButtonHtml({
    extraCls: ' diff-btn', action: 'startDifficulty', arg: d, list: difficultyQuestions(d),
    labelHtml: `${starsHtml(d)}<span class="ch-name">${difficultyLabel(d)}</span>`,
  })).join('');
}
// CUI-0014: chapter names stay English in every language (plan Q10), so screen readers read them as en;
// S-057: so does the "Ch {n}" label (common.chapterShort is untranslated by choice)
function buildChapterGrid() {
  byId('chapterGrid').innerHTML = CHAPTER_NUMBERS.map(ch => setButtonHtml({
    action: 'startChapter', arg: ch, list: chapterQuestions(ch),
    labelHtml: `<span class="ch-num" lang="en">${escapeHtml(t('common.chapterShort', { n: ch }))}</span>
      <span class="ch-name" lang="en">${t(`data.chapterShort.${ch}`)}</span>`,
  })).join('');
}
function startDifficulty(level) {
  pendingMode = PRACTICE_MODE;
  startExam(DIFFICULTY_PREFIX + level);
}
function startChapter(ch) {
  pendingMode = PRACTICE_MODE;
  startExam(CHAPTER_PREFIX + ch);
}

// ── mode selection ──
function renderModeSelection() {
  byId('modePractice').classList.toggle('selected', pendingMode === PRACTICE_MODE);
  byId('modeExam').classList.toggle('selected', pendingMode === EXAM_MODE);
  const panel = byId('modeDesc');
  panel.innerHTML = pendingMode ? MODE_DESC_HTML[pendingMode]() : '';
  panel.classList.toggle('show', !!pendingMode);
  const isPractice = pendingMode === PRACTICE_MODE;
  byId('practiceTabs').classList.toggle('show', isPractice);
  byId('practiceByTitle').classList.toggle('show', isPractice);
  renderMyReview();
  renderPlanCard(); // study plan entry above "Choose Mode" (only while planVisible)
  renderPracticeViews(isPractice);
  renderResetRows(isPractice);
  desktopRefit('screenHome', homeRefit); // v2.0.0 desktop columns + fits (js/components/deskPlace.js: no-op without fit.js)
}
function renderPracticeViews(isPractice) {
  PRACTICE_VIEWS.forEach(v => {
    const id = v.charAt(0).toUpperCase() + v.slice(1);
    byId('ptab' + id).classList.toggle('active', isPractice && practiceView === v);
    // Practice: only the chosen view; Exam: only the exam list
    const show = isPractice ? practiceView === v : v === 'exam';
    byId('sec' + id).classList.toggle('hidden', !show);
  });
  // the "Select Exam" header is only needed when there are no practice tabs
  setShown('secExamTitle', !isPractice);
}
function renderResetRows(isPractice) {
  byId('practiceHint').innerHTML = t('home.practiceHintHtml', { streak: MASTERY_STREAK, max: PRACTICE_ROUND_MAX });
  byId('practiceReset').classList.toggle('show', isPractice);
  byId('examReset').classList.toggle('show', pendingMode === EXAM_MODE);
}
// both resets ask in the in-app modal first (Keep / Reset), like the exam's Submit / Leave prompts
function confirmReset(titleKey, messageKey, onOk) {
  showConfirm({ title: t(titleKey), message: t(messageKey),
    okLabel: t('modal.resetOk'), cancelLabel: t('modal.resetCancel'), onOk, focusCancel: true, danger: true });
}
function resetPracticeProgress() {
  confirmReset('modal.resetProgressTitle', 'modal.resetProgressMessage', () => {
    resetPracticeStore();
    buildExamGrid();
    renderMyReview();
  });
}
function resetCompletedExams() {
  confirmReset('modal.resetCompletedTitle', 'modal.resetCompletedMessage', () => {
    clearCompletedExams();
    buildExamGrid();
  });
}

// ── My Review (practice): wrong answers + flagged tiles, hidden while both are empty ──
function renderReviewTile(id, n, iconHtml, title, bodyHtml) {
  const el = byId(id);
  el.classList.toggle('empty', !n);
  el.disabled = !n;
  el.innerHTML = `<div class="t-top"><span class="t-icon">${iconHtml}</span><span class="t-num">${n}</span></div><b>${title}</b>${bodyHtml}`;
}
// v1.3.1 (user): the note may wrap to this many lines before the two tiles stack (js/components/fitRow.js)
const MY_REVIEW_NOTE_LINES = 2;
// v2.0.0 desktop (mockup desktop-home.html A rev 3): the right column's tiles stay side by side with the note on 3 lines
const MY_REVIEW_NOTE_LINES_DESKTOP = 3;
// v0.70: the count already shows in .t-num, so a non-empty tile only explains where wrong answers come from;
// the empty tile only says there is nothing to review
function wrongTileBody(n) {
  return n ? `<span class="t-note" data-fit-lines="${MY_REVIEW_NOTE_LINES}">${t('home.myReviewNote', { max: PRACTICE_ROUND_MAX })}</span>`
    : `<span class="sub">${t('home.wrongEmpty')}</span>`;
}
// the count already shows in .t-num; only the empty tile needs a line (how to flag)
function flaggedTileBody(n) {
  return n ? '' : `<span class="sub">${t('home.flaggedEmptyHtml', { icon: bookmarkSvg('bm-inline') })}</span>`;
}
function renderMyReview() {
  // G40: distinct questions (copies of one text are one question, as in the rounds and the result note)
  const wrongN = questionGroups(keysOf(wrongList)).length, flagN = questionGroups(keysOf(practiceFlags)).length;
  byId('myReview').classList.toggle('show', pendingMode === PRACTICE_MODE && (wrongN + flagN) > 0);
  // CUI-0037: a line icon like the flagged tile's bookmark SVG (controls use line icons, never glyphs)
  renderReviewTile('tileWrong', wrongN, lineIconSvg('cross'), t('home.wrongTitle'), wrongTileBody(wrongN));
  renderReviewTile('tileFlagged', flagN, bookmarkSvg('rv-flag-tile'), t('home.flaggedTitle'), flaggedTileBody(flagN));
  fitRows(byId('myReview')); // v1.3.1: side by side unless a title or empty line would wrap, or the note pass MY_REVIEW_NOTE_LINES
}
function startWrongReview() { pendingMode = PRACTICE_MODE; startExam(WRONG_EXAM); }
function startFlaggedPractice() { pendingMode = PRACTICE_MODE; startExam(FLAGGED_EXAM); }

// ── back to home (asks first while an exam is running) ──
function goHome() {
  if (isPlanSession()) { planBackToDay(); return; } // the quiz header reads "← Today's tasks" in a plan task
  // C2: a memo test's header reads "‹ Memory": back to the group, nothing recorded. W-057: a cached pre-v1.6.1 sideSession.js
  if (typeof isMemoSession === 'function' && isMemoSession()) { leaveMemoTest(); return; }
  if (isExamRunning()) {
    showConfirm({ title: t('modal.leaveTitle'), message: t('modal.leaveMessage'),
      okLabel: t('modal.leaveOk'), cancelLabel: t('modal.leaveCancel'), onOk: isPlanMock() ? planLeaveMock : leaveToHome, focusCancel: true });
    return;
  }
  leaveToHome();
}
function leaveToHome() {
  stopExamTimer();
  clearSideSession();
  showScreen('screenHome');
  buildExamGrid();
  renderModeSelection(); // keeps the last chosen mode and practice tab
}

// ── v2.0.0 desktop (≥ 1024px; handoff §3 #1 / #4, mockups desktop-home.html A rev 3 + desktop-home-plan.html A rev 7):
// the plan card across the top; left rail 5/12 (modes, description, hint / reset), right 7/12 (My Review, practice
// tabs, sets). The rail is sticky while it fits the viewport; taller (⚙ large text + zh-HK) it scrolls with the page
// (F8). Below 1024px the parts go back to their phone order (js/components/deskPlace.js setDesktopColumns) ──
const HOME_TALL_CLASS = 'is-tall';
function homeColumns() {
  const home = byId('screenHome');
  return { key: 'home', boxClass: 'home-cols', columns: [
    { cls: 'home-rail', parts: [home.querySelector(':scope > [data-i18n="home.chooseMode"]'), home.querySelector(':scope > .mode-grid'),
      byId('modeDesc'), byId('practiceReset'), byId('examReset')] },
    { cls: 'home-main', parts: [byId('myReview'), byId('practiceByTitle'), byId('practiceTabs'),
      byId('secDifficulty'), byId('secChapter'), byId('secExam')] },
  ] };
}
// F8: sticky only while the rail (plus the gap it keeps from the header) fits under the header; a taller rail would
// hide its own bottom until the page reached the end
function fitHomeRail(box) {
  const rail = box && box.querySelector('.home-rail');
  if (!rail) return;
  rail.classList.remove(HOME_TALL_CLASS);
  const top = parseFloat(getComputedStyle(rail).top) || 0;
  const headerH = document.querySelector('header').getBoundingClientRect().height;
  rail.classList.toggle(HOME_TALL_CLASS, top + rail.offsetHeight + (top - headerH) > window.innerHeight);
}
// W-057-style mixed caches: without deskPlace.js / a v2.0.0 planHome.js the desktop helpers are missing: the phone layout stays
const homeDesktopReady = () => typeof setDesktopColumns === 'function' && typeof planCardDrawnForDesktop === 'function';
function homeRefit(desktop) {
  if (!homeDesktopReady()) return;
  const box = setDesktopColumns(homeColumns(), desktop);
  const note = document.querySelector('#tileWrong .t-note');
  if (note) note.dataset.fitLines = desktop ? MY_REVIEW_NOTE_LINES_DESKTOP : MY_REVIEW_NOTE_LINES;
  fitRows(byId('myReview')); // the tiles' width changed with the columns
  if (planCardDrawnForDesktop() !== desktop) renderPlanCard(); // ring + timeline on desktop, % bar on the phone
  fitPlanCard(desktop);
  fitHomeRail(box);
}
