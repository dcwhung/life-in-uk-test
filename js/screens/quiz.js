// ════════════════════════════════════════
// QUIZ — session state, starting a set, rendering the question card, answering, navigation
// ════════════════════════════════════════
let state = {
  mode: PRACTICE_MODE,   // 'practice' | 'exam'
  examNum: 1,
  questions: [],
  current: 0,
  answers: {},           // index -> [selected option indices]
  revealed: {},          // index -> bool (correct or not); presence = revealed
  yueShown: {},          // index -> bool (practice: question translation expanded)
  sessionCorrect: 0,
  sessionTotal: 0,
};

// Practice: skip mastered questions until the whole set is mastered, shuffle, then draw at most
// PRACTICE_ROUND_MAX; review sets (wrong answers / flagged) ask every listed question, mastered or not.
// Exam: fixed exam order with all questions (All Exams shuffled, Random Exam drawn).
function sessionQuestions(examNum, pool) {
  if (state.mode === PRACTICE_MODE) {
    const candidates = isReviewSet(examNum) ? pool : practicePool(pool);
    return shuffle(candidates).slice(0, PRACTICE_ROUND_MAX).map(toQuestionItem);
  }
  if (isRandomExam(examNum)) return randomExamPick(pool).map(toQuestionItem);
  return (examNum === ALL_EXAM ? shuffle(pool) : pool).map(toQuestionItem);
}
function resetAnswers() {
  state.current = 0;
  state.answers = {};
  state.revealed = {};
  state.yueShown = {};
  state.flags = {};
}
function startExam(examNum) {
  state.mode = pendingMode;
  state.examNum = examNum;
  clearSideSession();
  const pool = poolFor(examNum);
  state.setPool = pool;
  state.masteredBefore = masteryOf(pool).mastered;
  state.reviewTotal = isReviewSet(examNum) ? pool.length : 0;
  state.cleared = 0;
  state.questions = sessionQuestions(examNum, pool);
  resetAnswers();
  examTimeUp = false;
  if (hasExamTools()) startExamTimer(); else stopExamTimer();
  showScreen('screenQuiz');
  renderQuestion();
}

// ── render ──
function renderQuestion() {
  const idx = state.current;
  const q = state.questions[idx];
  const total = state.questions.length;
  const revealed = idx in state.revealed;
  // exam mode never shows right / wrong, the answer or translations until the results page
  const showAnswer = revealed && state.mode === PRACTICE_MODE;
  // practice translation: "Translate" shows it before answering; always shown once revealed
  const yueOn = showAnswer || (state.mode === PRACTICE_MODE && !!state.yueShown[idx]);
  renderQuizHeader(q, idx, total);
  renderTranslation(q, revealed, yueOn);
  byId('optionsContainer').innerHTML = q.o.map((_, oi) => optionHtml(q, oi, { showAnswer, revealed, yueOn })).join('');
  renderAnswerBox(q, idx, showAnswer);
  renderSimilar(q, revealed);
  renderExamTools(idx);
  renderNavButtons(idx, total, revealed);
}
function renderQuizHeader(q, idx, total) {
  byId('quizLabel').textContent =
    state.examNum === ALL_EXAM && !isRandomExam(state.examNum) ? t('quiz.allShuffled') : examLabel(state.examNum);
  byId('modeBadge').textContent = state.mode === PRACTICE_MODE ? t('common.practice') : t('common.exam');
  // progress: the question card's top border
  byId('progressFill').style.width = percent(idx + 1, total) + '%';
  // no "(select N)" hint: every multi-answer question already states its count (content-guard-test)
  byId('qNum').innerHTML = `<span>${t('quiz.questionOf', { n: idx + 1, total })}</span>${starsHtml(q.d)}`;
  byId('qText').textContent = q.q;
}
function renderTranslation(q, revealed, yueOn) {
  const yueToggle = byId('yueToggle');
  yueToggle.classList.toggle('visible', state.mode === PRACTICE_MODE && !revealed);
  yueToggle.classList.toggle('on', yueOn);
  yueToggle.textContent = yueOn ? t('quiz.hideTranslation') : t('quiz.translate');
  const qYue = byId('qYue');
  qYue.textContent = q.yue;
  qYue.classList.toggle('show', yueOn);
}
function optionClass(q, oi, { showAnswer, revealed }) {
  const userPicked = (state.answers[state.current] || []).includes(oi);
  if (showAnswer) return 'opt disabled' + (q.a.includes(oi) ? ' correct' : userPicked ? ' wrong' : '');
  if (revealed) return 'opt disabled' + (userPicked ? ' selected' : ''); // exam: submitted, locked, no right / wrong
  return 'opt' + (userPicked ? ' selected' : ''); // provisional blue highlight before reveal
}
function optionHtml(q, oi, view) {
  const optYue = view.yueOn && q.oy && q.oy[oi] ? `<span class="opt-yue" lang="zh-HK">${escapeHtml(q.oy[oi])}</span>` : '';
  return `<button class="${optionClass(q, oi, view)}" data-action="selectOption" data-arg="${escapeHtml(oi)}" id="opt${oi}">
      <span class="opt-letter">${OPTION_LETTERS[oi]}</span>
      <span class="opt-body"><span>${escapeHtml(q.o[oi])}</span>${optYue}</span>
    </button>`;
}
// answer box (practice only, once revealed)
function renderAnswerBox(q, idx, showAnswer) {
  const box = byId('answerBox');
  if (!showAnswer) { box.className = 'answer-box'; return; }
  const correct = isCorrectAnswer(q, state.answers[idx]);
  box.className = 'answer-box show' + (correct ? '' : ' wrong-ans');
  byId('ansLabel').className = 'ans-label' + (correct ? '' : ' wrong');
  byId('ansLabel').textContent = (correct ? t('quiz.correct') : t('quiz.wrong')) + LIST_SEP + streakLabel(q);
  byId('ansEn').className = 'ans-en' + (correct ? '' : ' wrong');
  byId('ansEn').textContent = q.a.map(ai => q.o[ai]).join(ANSWER_SEP);
  renderAnswerTranslation(q);
  // .ans-note is pre-wrap: the note's own line breaks and indents show as written
  byId('ansNote').innerHTML = q.note ? `<strong>${t('common.noteLabel')}</strong>\n<span class="ans-note-text" lang="zh-HK">${escapeHtml(q.note)}</span>` : '';
}
// S-048: an answer with no Cantonese text (True / False / years) falls back to the English option, marked lang="en"
const answerYueHtml = (q, ai) => (q.oy && q.oy[ai] ? escapeHtml(q.oy[ai]) : `<span lang="en">${escapeHtml(q.o[ai])}</span>`);
function renderAnswerTranslation(q) {
  const ansYueHtml = q.a.map(ai => answerYueHtml(q, ai)).join(escapeHtml(ANSWER_SEP));
  byId('ansYue').innerHTML =
    `<div class="ans-yue-title">${t('common.yueTitle')}</div>
       <div class="ans-yue-row"><b>${t('quiz.yueQ')}</b><span>${escapeHtml(q.yue)}</span></div>
       <div class="ans-yue-row"><b>${t('quiz.yueA')}</b><span>${ansYueHtml}</span></div>`;
}
// bottom Prev / Next row, plus the quick pair in the question header
function renderNavButtons(idx, total, revealed) {
  const next = nextAction(idx, total);
  ['prevBtn', 'quickPrev'].forEach(id => { byId(id).disabled = idx === 0; });
  byId('nextBtn').textContent = next.label;
  const quickNext = byId('quickNext');
  quickNext.textContent = next.symbol;
  quickNext.title = next.title;
  quickNext.setAttribute('aria-label', next.title);
  // quick pair: practice once revealed (Translate holds the spot before that); exam always (no Translate there)
  byId('quickNav').classList.toggle('visible', revealed || state.mode === EXAM_MODE);
}
// review sets bigger than one round: "Round 1 of N · 24 of your T wrong answers" above the question card
function renderRoundNote() {
  const total = state.reviewTotal || 0;
  const show = state.mode === PRACTICE_MODE && total > PRACTICE_ROUND_MAX && !isSideSession();
  setShown('roundRow', show);
  if (!show) return;
  const noteKey = state.examNum === WRONG_EXAM ? 'quiz.roundNoteWrong' : 'quiz.roundNoteFlagged';
  byId('roundNote').textContent =
    t(noteKey, { rounds: Math.ceil(total / PRACTICE_ROUND_MAX), n: state.questions.length, total });
}

// ── answering ──
// what "Next" does on this question: next question, finish the set, or leave the side session (similar / fact)
// label = bottom button, symbol + title = quick button in the question header
function nextAction(idx, total) {
  if (idx < total - 1) return { label: t('quiz.nextButton'), symbol: '→', title: t('quiz.next'), run: nextQ };
  if (isSideSession()) return { label: t('quiz.backButton'), symbol: '↩', title: t('quiz.back'), run: returnFromSideSession };
  if (state.mode === EXAM_MODE) return { label: t('exam.submit'), symbol: '✓', title: t('exam.submit'), run: submitExam };
  return { label: t('quiz.finishButton'), symbol: '✓', title: t('quiz.finish'), run: finishExam };
}
function runNextAction() { nextAction(state.current, state.questions.length).run(); }

// multi-select: tap toggles a pick, never more picks than correct answers
function togglePick(sel, oi, max) {
  const pos = sel.indexOf(oi);
  if (pos !== -1) sel.splice(pos, 1);
  else if (sel.length < max) sel.push(oi);
}
function selectOption(oi) {
  const idx = state.current;
  const q = state.questions[idx];
  if (idx in state.revealed) return;
  if (q.a.length > 1) togglePick(state.answers[idx] = state.answers[idx] || [], oi, q.a.length);
  else state.answers[idx] = [oi];
  // practice reveals once enough options are picked; exam only saves the pick (changeable until Submit)
  const complete = state.answers[idx].length === q.a.length;
  if (state.mode === PRACTICE_MODE && complete) revealAnswer();
  else renderQuestion();
}
function toggleQuestionYue() {
  if (state.mode !== PRACTICE_MODE || (state.current in state.revealed)) return;
  state.yueShown[state.current] = !state.yueShown[state.current];
  renderQuestion();
}
function revealAnswer() {
  const idx = state.current;
  const q = state.questions[idx];
  const correct = isCorrectAnswer(q, state.answers[idx]);
  state.revealed[idx] = correct;
  if (state.mode === PRACTICE_MODE) recordPracticeResult(q, correct);
  renderQuestion();
}
function recordPracticeResult(q, correct) {
  recordPracticeAnswer(q, correct); // session length stays fixed; unmastered ones return next session
  // wrong answers join the review list; only a correct answer inside the review clears one
  if (!correct) addWrong(q);
  else if (state.examNum === WRONG_EXAM && wrongList[qKey(q)]) { clearWrong(q); state.cleared++; }
}

// ── navigation ──
function goToQuestion(i) {
  state.current = i;
  renderQuestion();
}
function nextQ() {
  if (state.current >= state.questions.length - 1) return;
  state.current++;
  renderQuestion();
  window.scrollTo(0, 0);
}
function prevQ() {
  if (state.current <= 0) return;
  state.current--;
  renderQuestion();
  window.scrollTo(0, 0);
}
