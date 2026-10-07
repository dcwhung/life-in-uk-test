// ════════════════════════════════════════
// EXAM TOOLS — 45-min countdown (Exam 1–17 + Random Exam), flags, numbered question dots, Submit
// Practice gets the dots (right / wrong colours) and saved flags, but no timer.
// ════════════════════════════════════════
let examTimerId = null;
let examDeadline = 0;
let examTimeUp = false;

function hasExamTools() { return state.mode === EXAM_MODE && (isNumberedExam(state.examNum) || isRandomExam(state.examNum)); }
function hasNavDots() { return hasExamTools() || state.mode === PRACTICE_MODE; }
function isExamRunning() {
  return state.mode === EXAM_MODE && byId('screenQuiz').classList.contains('active');
}
function isAnswered(i) { return (state.answers[i] || []).length > 0; }
function flaggedCount() { return Object.values(state.flags || {}).filter(Boolean).length; }

// ── timer (examDeadline uses Date.now, so a late setInterval tick never drifts) ──
function startExamTimer() {
  stopExamTimer();
  examDeadline = Date.now() + EXAM_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND;
  examTimerId = setInterval(examTick, EXAM_TICK_MS);
  examTick();
}
function stopExamTimer() {
  if (examTimerId !== null) clearInterval(examTimerId);
  examTimerId = null;
}
function examSecondsLeft() { return Math.max(0, Math.ceil((examDeadline - Date.now()) / MS_PER_SECOND)); }
function renderExamTimer(left) {
  const el = byId('examTimer');
  el.textContent = t('exam.timer', { time: `${pad2(Math.floor(left / SECONDS_PER_MINUTE))}:${pad2(left % SECONDS_PER_MINUTE)}` });
  el.classList.toggle('warn', left <= EXAM_WARN_SECONDS);
}
function examTick() {
  const left = examSecondsLeft();
  renderExamTimer(left);
  // time up: submit as is, straight to the results (no prompt)
  if (left === 0) { examTimeUp = true; finishExam(); }
}
// a language switch redraws the countdown text only: examTick at 0 would submit the exam from a re-render
function refreshExamTimer() {
  if (examTimerId !== null) renderExamTimer(examSecondsLeft());
}

// ── flags: exam flags live for the session; practice flags are saved (My Review › Flagged) ──
function toggleFlag() {
  const i = state.current;
  if (state.mode === PRACTICE_MODE) setPracticeFlag(qKey(state.questions[i]), !isPracticeFlagged(state.questions[i]));
  else state.flags[i] = !state.flags[i];
  renderQuestion();
}
function isFlaggedNow(i) {
  return state.mode === PRACTICE_MODE ? isPracticeFlagged(state.questions[i]) : !!state.flags[i];
}

// ── dots: practice shows right / wrong once revealed; exam only answered / unanswered ──
function dotStateCls(i) {
  if (state.mode !== PRACTICE_MODE) return isAnswered(i) && 'done';
  if (!(i in state.revealed)) return '';
  return state.revealed[i] ? 'ok' : 'bad';
}
function navDotsHtml() {
  return state.questions.map((_, i) => {
    const cls = ['dot', dotStateCls(i), isFlaggedNow(i) && 'flag', i === state.current && 'current'].filter(Boolean).join(' ');
    return dotButtonHtml(cls, 'goToQuestion', i);
  }).join('');
}
function practiceDotsMetaHtml() {
  const results = Object.values(state.revealed), correct = results.filter(Boolean).length;
  const flagged = state.questions.filter((_, i) => isFlaggedNow(i)).length;
  return countsLegendHtml([
    ['lg-ok', t('common.correct'), correct],
    ['lg-bad', t('common.wrong'), results.length - correct],
    ['lg-todo', t('common.unanswered'), state.questions.length - results.length],
    ['lg-flag', t('common.flagged'), flagged],
  ]);
}
function dotsMetaHtml() {
  if (state.mode === PRACTICE_MODE) return practiceDotsMetaHtml();
  const done = state.questions.filter((_, i) => isAnswered(i)).length;
  return countsLegendHtml([
    ['lg-done', t('common.answered'), done],
    ['lg-todo', t('common.unanswered'), state.questions.length - done],
    ['lg-flag', t('common.flagged'), flaggedCount()],
  ]);
}

// ── render (called from renderQuestion) ──
function renderExamTools(idx) {
  const tools = hasExamTools(), dots = hasNavDots();
  setShown('examTimer', tools);
  setShown('modeBadge', !tools);
  // the dots replace the progress bar
  byId('screenQuiz').querySelector('.q-progress').hidden = dots;
  renderRoundNote();
  renderNavDots(dots);
  renderFlagButton(idx, tools || state.mode === PRACTICE_MODE);
}
function renderNavDots(dots) {
  setShown('navDots', dots);
  setShown('dotsMeta', dots);
  if (!dots) return;
  byId('navDots').innerHTML = navDotsHtml();
  byId('dotsMeta').innerHTML = dotsMetaHtml();
  byId('dotsMeta').classList.toggle('practice', state.mode === PRACTICE_MODE);
}
function renderFlagButton(idx, visible) {
  const flagBtn = byId('flagBtn');
  flagBtn.hidden = !visible;
  const flagged = isFlaggedNow(idx);
  flagBtn.classList.toggle('on', flagged);
  flagBtn.title = flagged ? t('common.unflag') : t('common.flagForReview');
  flagBtn.setAttribute('aria-label', flagBtn.title);
}

// exam: picks are saved as you go (and can be changed); Submit on the last question marks the
// whole exam and opens the results — no right / wrong is shown before that
function submitExam() {
  const unanswered = state.questions.filter((_, i) => !isAnswered(i)).length;
  const flagged = flaggedCount();
  const notes = [
    unanswered && t('modal.submitUnanswered', { n: unanswered }),
    flagged && t('modal.submitFlagged', { n: flagged }),
  ].filter(Boolean);
  if (!notes.length) { finishExam(); return; }
  // the modal message is pre-line: one note per line
  showConfirm({ title: t('modal.submitTitle'), message: [...notes, t('modal.submitCheck')].join('\n'),
    okLabel: t('exam.submit'), cancelLabel: t('modal.submitCancel'), onOk: finishExam });
}
