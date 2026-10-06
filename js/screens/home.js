// ════════════════════════════════════════
// HOME — mode cards, practice set grids, My Review tiles, reset rows
// ════════════════════════════════════════
const MODE_DESC_HTML = {
  [PRACTICE_MODE]: () => t('home.practiceDescHtml'),
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
    ? t('home.allExams', { count: t('common.questions', { n: TOTAL_QUESTIONS }) }) + examMasteryHtml(allQuestions())
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
function buildChapterGrid() {
  byId('chapterGrid').innerHTML = CHAPTER_NUMBERS.map(ch => setButtonHtml({
    action: 'startChapter', arg: ch, list: chapterQuestions(ch),
    labelHtml: `<span class="ch-num">${t('common.chapterShort', { n: ch })}</span>
      <span class="ch-name">${t(`data.chapterShort.${ch}`)}</span>`,
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
  renderPracticeViews(isPractice);
  renderResetRows(isPractice);
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
    okLabel: t('modal.resetOk'), cancelLabel: t('modal.resetCancel'), onOk, focusCancel: true });
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
function renderReviewTile(id, n, iconHtml, title, sub) {
  const el = byId(id);
  el.classList.toggle('empty', !n);
  el.disabled = !n;
  el.innerHTML = `<div class="t-top"><span class="t-icon">${iconHtml}</span><span class="t-num">${n}</span></div><b>${title}</b><span class="sub">${sub}</span>`;
}
function wrongTileSub(n) {
  if (!n) return t('home.wrongEmpty');
  return n > PRACTICE_ROUND_MAX ? t('home.wrongToClearRounds', { n, max: PRACTICE_ROUND_MAX }) : t('home.wrongToClear', { n });
}
function flaggedTileSub(n) {
  return n ? t('home.flaggedCount', { n }) : t('home.flaggedEmptyHtml', { icon: bookmarkSvg('bm-inline') });
}
function renderMyReview() {
  const wrongN = keysOf(wrongList).length, flagN = keysOf(practiceFlags).length;
  byId('myReview').classList.toggle('show', pendingMode === PRACTICE_MODE && (wrongN + flagN) > 0);
  renderReviewTile('tileWrong', wrongN, '✗', t('home.wrongTitle'), wrongTileSub(wrongN));
  renderReviewTile('tileFlagged', flagN, bookmarkSvg('rv-flag-tile'), t('home.flaggedTitle'), flaggedTileSub(flagN));
  byId('myReviewNote').textContent = t('home.myReviewNote', { max: PRACTICE_ROUND_MAX });
}
function startWrongReview() { pendingMode = PRACTICE_MODE; startExam(WRONG_EXAM); }
function startFlaggedPractice() { pendingMode = PRACTICE_MODE; startExam(FLAGGED_EXAM); }

// ── back to home (asks first while an exam is running) ──
function goHome() {
  if (isExamRunning()) {
    showConfirm({ title: t('modal.leaveTitle'), message: t('modal.leaveMessage'),
      okLabel: t('modal.leaveOk'), cancelLabel: t('modal.leaveCancel'), onOk: leaveToHome, focusCancel: true });
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
