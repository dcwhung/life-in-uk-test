// ════════════════════════════════════════
// HOME — mode cards, practice set grids, My Review tiles, reset rows
// ════════════════════════════════════════
const MODE_DESC = {
  practice: '<strong>Practice</strong> — See the answer and Cantonese translation immediately after each question. Pick a set by difficulty, chapter or exam; each shows how much you have mastered.',
  exam: `<strong>Exam</strong> — Answer all ${REAL_TEST_SIZE} questions like the real test; you can go back and change answers. Submit on the last question to see your score and answers. Pick an exam below.`,
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
    ? `🎯 All Exams (${TOTAL_QUESTIONS} Q)${examMasteryHtml(allQuestions())}`
    : `🎲 Random Exam<span class="exam-sub">${RANDOM_EXAM_SIZE} Qs from ${TOTAL_QUESTIONS} Qs</span>`;
  return `<button class="exam-btn all" data-action="startExam" data-arg="${ALL_EXAM}">${inner}</button>`;
}
function buildExamGrid() {
  const done = completedExams();
  const isPractice = pendingMode === PRACTICE_MODE;
  const buttons = EXAM_NUMBERS.map(n => {
    const doneCls = !isPractice && done[n] ? ' done' : '';
    const mastery = isPractice ? examMasteryHtml(examQuestions(n)) : '';
    return `<button class="exam-btn${doneCls}" data-action="startExam" data-arg="${n}">Exam ${n}${mastery}</button>`;
  });
  byId('examGrid').innerHTML = allExamsButtonHtml(isPractice) + buttons.join('');
  buildChapterGrid();
  buildDiffGrid();
}
function buildDiffGrid() {
  byId('diffGrid').innerHTML = DIFF_LEVELS.map(d => setButtonHtml({
    extraCls: ' diff-btn', action: 'startDifficulty', arg: d, list: difficultyQuestions(d),
    labelHtml: `${starsHtml(d)}<span class="ch-name">${DIFF_LABELS[d]}</span>`,
  })).join('');
}
function buildChapterGrid() {
  byId('chapterGrid').innerHTML = CHAPTER_NUMBERS.map(ch => setButtonHtml({
    action: 'startChapter', arg: ch, list: chapterQuestions(ch),
    labelHtml: `<span class="ch-num">Ch ${ch}</span>
      <span class="ch-name">${CHAPTER_SHORT[ch]}</span>`,
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
  panel.innerHTML = pendingMode ? MODE_DESC[pendingMode] : '';
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
  byId('practiceHint').innerHTML =
    `Answer a question correctly <b>${MASTERY_STREAK} times in a row</b> to master it. Each round draws up to <b>${PRACTICE_ROUND_MAX}</b> unmastered questions, each asked once; unmastered ones come back in the next round. Mastered ones are skipped until the whole set is mastered.`;
  byId('practiceReset').classList.toggle('show', isPractice);
  byId('examReset').classList.toggle('show', pendingMode === EXAM_MODE);
}
function resetPracticeProgress() {
  if (!confirm('Reset all practice progress? 掌握進度、錯題同 flag 會全部清除。')) return;
  resetPracticeStore();
  buildExamGrid();
  renderMyReview();
}
function resetCompletedExams() {
  if (!confirm('Reset all completed exams? 所有 ✓ 完成記錄會清除。')) return;
  clearCompletedExams();
  buildExamGrid();
}

// ── My Review (practice): wrong answers + flagged tiles, hidden while both are empty ──
function renderReviewTile(id, n, iconHtml, title, sub) {
  const el = byId(id);
  el.classList.toggle('empty', !n);
  el.disabled = !n;
  el.innerHTML = `<div class="t-top"><span class="t-icon">${iconHtml}</span><span class="t-num">${n}</span></div><b>${title}</b><span class="sub">${sub}</span>`;
}
function wrongTileSub(n) {
  if (!n) return 'Nothing to review yet';
  return n > PRACTICE_ROUND_MAX ? `${n} to clear · ${PRACTICE_ROUND_MAX} per round` : `${n} to clear`;
}
function renderMyReview() {
  const wrongN = keysOf(wrongList).length, flagN = keysOf(practiceFlags).length;
  byId('myReview').classList.toggle('show', pendingMode === PRACTICE_MODE && (wrongN + flagN) > 0);
  renderReviewTile('tileWrong', wrongN, '✗', 'Wrong answers', wrongTileSub(wrongN));
  renderReviewTile('tileFlagged', flagN, bookmarkSvg('rv-flag-tile'), 'Flagged',
    flagN ? `${flagN} saved` : `Tap ${bookmarkSvg('bm-inline')} on a question to save it`);
  byId('myReviewNote').textContent =
    `Wrong answers come from Practice and Exam, and clear when you get them right here. Up to ${PRACTICE_ROUND_MAX} per round.`;
}
function startWrongReview() { pendingMode = PRACTICE_MODE; startExam(WRONG_EXAM); }
function startFlaggedPractice() { pendingMode = PRACTICE_MODE; startExam(FLAGGED_EXAM); }

// ── back to home (asks first while an exam is running) ──
function goHome() {
  if (isExamRunning()) {
    showConfirm({ title: 'Leave the exam?', message: 'Your answers will be lost.',
      okLabel: 'Leave', cancelLabel: 'Stay', onOk: leaveToHome });
    return;
  }
  leaveToHome();
}
function leaveToHome() {
  stopExamTimer();
  similarReturn = null;
  showScreen('screenHome');
  buildExamGrid();
  renderModeSelection(); // keeps the last chosen mode and practice tab
}
