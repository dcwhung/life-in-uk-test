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
  planDay: null,         // study plan day (ISO) a plan task session counts for; null otherwise (G5)
};

// Practice: skip mastered questions until the whole set is mastered, keep one copy per question text (G40, W-046:
// the copies share a streak, so it moves once a round), shuffle, then draw at most PRACTICE_ROUND_MAX; review sets
// (wrong answers / flagged) ask every listed question, mastered or not, each text once.
// Exam: fixed exam order with all questions (All Exams shuffled, Random Exam drawn); a paper keeps its real questions.
function sessionQuestions(examNum, pool) {
  if (state.mode === PRACTICE_MODE) {
    const candidates = isReviewSet(examNum) ? pool : practicePool(pool);
    return distinctQuestions(candidates).slice(0, PRACTICE_ROUND_MAX).map(toQuestionItem);
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
// mode: R8 — a plan mock runs Exam mode without changing Home's pendingMode
function startExam(examNum, mode = pendingMode) {
  const pool = poolFor(examNum);
  // CUI-0016: an emptied review set has no question to render; go Home before any session state changes
  if (!pool.length) { leaveToHome(); return; }
  state.mode = mode;
  state.examNum = examNum;
  state.planDay = null;
  clearSideSession();
  state.setPool = pool;
  // S-145(a): distinct questions, as the round asks each text once ("Round 1 of N · n of your T")
  state.reviewTotal = isReviewSet(examNum) ? questionGroups(pool.map(qKey)).length : 0;
  state.cleared = 0;
  state.questions = sessionQuestions(examNum, pool);
  // S-141(b): "Mastered N more this round" counts the questions asked, not their unasked copies (G40)
  state.masteredBefore = masteryOf(state.questions).mastered;
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
  renderQuizDesk(q, idx, total, showAnswer);
  arrangeQuiz(deskOn()); // v2.0.0: the desktop columns first, so the counter below measures the row it ends up in
  fitQuestionCounter(); // C3: measured once the counter's row (bookmark, arrows) is final
  desktopRefit('screenQuiz', fitQuiz);
}
// W-016: a fact set's "Ch c #n" is English in every language (S-057), so it goes in a lang="en" span;
// built from text nodes, never innerHTML, so the locale string cannot inject markup
function setExamLabel(el, examNum) {
  const label = examLabel(examNum);
  const num = isFactExam(examNum) ? t('study.chapterFactId', factSetParams(examNum)) : '';
  const at = num ? label.indexOf(num) : -1;
  if (at < 0) { el.textContent = label; return; }
  const numEl = document.createElement('span');
  numEl.lang = 'en';
  numEl.textContent = num;
  el.replaceChildren(label.slice(0, at), numEl, label.slice(at + num.length));
}
// C3 (v1.3.0, user): "Question 1 of 24" unless it wraps (large text at 320px), then quiz.questionOfShort ("Question 1/24");
// where even that wraps (the wide Translate button in the row) it stays short on two lines (user)
function fitQuestionCounter() {
  const counter = document.querySelector('#qNum > span[data-full]');
  if (!counter) return;
  counter.textContent = counter.dataset.full;
  if (textLineCount(counter) > 1) counter.textContent = counter.dataset.short;
}
// a rotation / resize changes the room the counter has
window.addEventListener('resize', () => { if (byId('screenQuiz').classList.contains('active')) fitQuestionCounter(); });
function renderQuizHeader(q, idx, total) {
  const label = byId('quizLabel');
  if (state.examNum === ALL_EXAM && !isRandomExam(state.examNum)) label.textContent = t('quiz.allShuffled');
  else setExamLabel(label, state.examNum);
  renderPlanQuizHeader(); // a plan task: its own label, "← Today's tasks"
  byId('modeBadge').textContent = state.mode === PRACTICE_MODE ? t('common.practice') : t('common.exam');
  // progress: the question card's top border
  byId('progressFill').style.width = percent(idx + 1, total) + '%';
  // no "(select N)" hint: every multi-answer question already states its count (content-guard-test)
  const full = escapeHtml(t('quiz.questionOf', { n: idx + 1, total }));
  // W-057: a pre-v1.3.0 locale has no short form; t() would return the key, so the long form stays
  const shortKey = 'quiz.questionOfShort', shortText = t(shortKey, { n: idx + 1, total }), short = shortText === shortKey ? full : escapeHtml(shortText);
  byId('qNum').innerHTML = `<span data-full="${full}" data-short="${short}">${full}</span>${starsHtml(q.d)}`;
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
  // G17: plan review mode shows the correct answer, marked when it was answered wrong that day
  const review = isPlanReviewMode();
  const correct = review ? !planReviewWasWrong(idx) : isCorrectAnswer(q, state.answers[idx]);
  box.className = 'answer-box show' + (correct ? '' : ' wrong-ans');
  byId('ansLabel').className = 'ans-label' + (correct ? '' : ' wrong');
  const reviewKey = correct ? 'plan.run.reviewCorrect' : 'plan.run.reviewWasWrong';
  byId('ansLabel').textContent = review ? t(reviewKey) : (correct ? t('quiz.correct') : t('quiz.wrong')) + LIST_SEP + streakLabel(q);
  byId('ansEn').className = 'ans-en' + (correct ? '' : ' wrong');
  byId('ansEn').textContent = q.a.map(ai => q.o[ai]).join(ANSWER_SEP);
  renderAnswerTranslation(q);
  // v0.70: one row per note line (noteHtml), as on the Results review, so wrapped bullets keep a hanging indent
  byId('ansNote').innerHTML = q.note ? `<strong>${t('common.noteLabel')}</strong><div class="ans-note-text" lang="zh-HK">${noteHtml(q.note)}</div>` : '';
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
  renderPlanRunNotes(); // a plan task: its own notes (review / redo / round n of N)
  if (isPlanSession()) return;
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
  if (isPlanSession()) return planNextAction();
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
  // session length stays fixed; unmastered ones return next session
  recordPracticeAnswer(q, correct, state.planDay || null);
  // wrong answers join the review list; only a correct answer inside the review (or any plan task, R9 / G38) clears it
  if (!correct) addWrong(q);
  else if (isPlanSession() || state.examNum === WRONG_EXAM) clearWrongCopies(q);
}
// W-030 / G38 / W-047: a plan task or a wrong-answers round asks one copy of a question text (G40, W-046); clear
// every copy of that question the wrong list holds, counted once
function clearWrongCopies(q) {
  const keys = planSameQuestionKeys(keysOf(wrongList), qKey(q));
  keys.forEach(k => clearWrong(questionByKey(k)));
  if (keys.length) state.cleared++;
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

// ════════════════════════════════════════
// DESKTOP LAYOUT (v2.0.0, ≥ 1024px; handoff .proj-docs/plans/2026-10-12_handoff_desktop-layout.md §3 #8–#11)
// The Quiz / Result screens move some of their own elements into columns built once (js/components/deskPlace.js:
// deskRemember / deskFill / deskRestore, desktopRefit); below 1024px each goes back to its phone place.
// ════════════════════════════════════════
// ── Quiz: mockups/v2.0.0/desktop-quiz.html A rev 12 (Practice) and desktop-exam.html C rev 3 (Exam 1–17, Random) ──
// practice: the number dots bar across the top; question card + options (7/12) | Answer · Similar tabs (5/12)
// exam with the timer: rail (3/12: big timer, dots 6 × 4, counts, Submit on the last question) | question + options
// other exam sets (no dots, no answer): the question + options column alone, centred
// ── Quiz: mockups/v2.0.0/desktop-quiz.html A rev 12 (Practice) and desktop-exam.html C rev 3 (Exam 1–17, Random) ──
// practice: the number dots bar across the top; question card + options (7/12) | Answer · Similar tabs (5/12)
// exam with the timer: rail (3/12: big timer, dots 6 × 4, counts, Submit on the last question) | question + options
// other exam sets (no dots, no answer): the question + options column alone, centred
const QUIZ_TAB = { answer: 'answer', similar: 'similar' };
let quizDesk = null;
let quizTab = QUIZ_TAB.answer;
let quizTabQuestion = null; // the question the open tab belongs to: a new question opens on Answer
function quizTabButton(id, pane) {
  return deskEl('button', 'quiz-tab', { type: 'button', id, role: 'tab', 'aria-controls': pane });
}
function quizPane(id, tabId) {
  const wrap = deskEl('div', 'quiz-pane fit-fade');
  wrap.append(deskEl('div', 'fit-panel', { id, role: 'tabpanel', 'aria-labelledby': tabId }));
  return wrap;
}
// the desktop-only elements (built once, kept while hidden below 1024px)
function newQuizDeskParts() {
  return {
    bar: deskEl('div', 'quiz-dots-bar'),
    cols: deskEl('div', 'quiz-cols'),
    rail: deskEl('div', 'exam-rail'),
    // a copy of the header countdown (renderExamTimer writes both); the header one is hidden on desktop (F6)
    bigTimer: deskEl('span', 'exam-timer exam-big-timer', { id: 'examTimerBig', role: 'timer', 'aria-live': 'off' }),
    // F6: the same action as the card's ✓ on the last question (nextAction: Submit → the confirm)
    submit: deskEl('button', 'nav-btn exam-submit', { type: 'button', 'data-action': 'next' }),
    mainWrap: deskEl('div', 'quiz-main-wrap fit-fade'),
    main: deskEl('div', 'quiz-main fit-panel'),
    aside: deskEl('div', 'quiz-aside'),
    tabs: deskEl('div', 'quiz-tabs', { role: 'tablist' }),
    tabAnswer: quizTabButton('quizTabAnswer', 'quizPaneAnswer'),
    tabSimilar: quizTabButton('quizTabSimilar', 'quizPaneSimilar'),
    paneAnswer: quizPane('quizPaneAnswer', 'quizTabAnswer'),
    paneSimilar: quizPane('quizPaneSimilar', 'quizTabSimilar'),
    slot: deskEl('div', 'quiz-empty-slot', { 'aria-hidden': 'true' }), // before answering (mockup rev 11)
  };
}
function buildQuizDesk() {
  const screen = byId('screenQuiz');
  const moved = {
    card: screen.querySelector('.q-card'), dots: byId('navDots'), meta: byId('dotsMeta'), options: byId('optionsContainer'),
    pair: byId('planPairNote'), answer: byId('answerBox'), similar: byId('similarBox'),
  };
  Object.values(moved).forEach(deskRemember);
  const d = { moved, ...newQuizDeskParts() };
  d.mainWrap.append(d.main);
  d.tabs.append(d.tabAnswer, d.tabSimilar);
  d.aside.append(d.tabs, d.paneAnswer, d.paneSimilar, d.slot);
  d.tabAnswer.addEventListener('click', () => setQuizTab(QUIZ_TAB.answer));
  d.tabSimilar.addEventListener('click', () => setQuizTab(QUIZ_TAB.similar));
  d.bar.hidden = true;
  d.cols.hidden = true;
  deskHome(moved.card).before(d.bar, d.cols); // above the card's phone place (under the notes, round row)
  screen.classList.add('is-fit'); // css/components/fit.css: one screen high from 1024px only
  return d;
}
function quizDeskParts() { return quizDesk || (quizDesk = buildQuizDesk()); }
function quizDeskLayout(desktop) {
  if (!desktop) return '';
  if (hasExamTools()) return 'rail';
  return state.mode === PRACTICE_MODE ? 'practice' : 'plain';
}
function arrangeQuiz(desktop) {
  const d = quizDeskParts();
  deskKeepFocus(() => placeQuizParts(d, quizDeskLayout(desktop))); // S-228: focus back once every box is in the document
}
function placeQuizParts(d, layout) {
  const m = d.moved;
  const screen = byId('screenQuiz');
  ['practice', 'rail', 'plain'].forEach(name => screen.classList.toggle('quiz-desk-' + name, layout === name));
  d.bar.hidden = layout !== 'practice';
  d.cols.hidden = !layout;
  d.rail.hidden = layout !== 'rail';
  d.aside.hidden = layout !== 'practice';
  if (!layout) { deskRestore(Object.values(m)); return; }
  deskFill(d.main, [m.card, m.options, m.pair]);
  if (layout === 'practice') {
    deskFill(d.bar, [m.dots, m.meta]);
    deskFill(d.cols, [d.mainWrap, d.aside]);
    deskFill(d.paneAnswer.firstElementChild, [m.answer]);
    deskFill(d.paneSimilar.firstElementChild, [m.similar]);
    return;
  }
  deskRestore([m.answer, m.similar]); // exam never shows them
  if (layout === 'rail') {
    deskFill(d.rail, [d.bigTimer, m.dots, m.meta, d.submit]);
    deskFill(d.cols, [d.rail, d.mainWrap]);
  } else {
    deskRestore([m.dots, m.meta]); // hidden: these sets have no dots
    deskFill(d.cols, [d.mainWrap]);
  }
}
// tab labels, which pane shows, the rail's timer copy and Submit; no measuring (the fit does that)
function renderQuizDesk(q, idx, total, showAnswer) {
  const d = quizDeskParts();
  if (quizTabQuestion !== q) { quizTab = QUIZ_TAB.answer; quizTabQuestion = q; }
  const similarShown = byId('similarBox').classList.contains('show');
  if (!similarShown) quizTab = QUIZ_TAB.answer;
  d.tabAnswer.innerHTML = `<span aria-hidden="true">💡</span> ${escapeHtml(t('quiz.answerTab'))}`;
  d.tabSimilar.innerHTML = similarShown ? similarTabHtml(q) : '';
  d.tabSimilar.hidden = !similarShown;
  d.tabs.hidden = !showAnswer;
  d.slot.hidden = showAnswer;
  applyQuizTab(showAnswer);
  syncExamTimerCopy();
  d.submit.textContent = t('exam.submit');
  d.submit.hidden = idx !== total - 1;
}
function applyQuizTab(showAnswer = !quizDeskParts().tabs.hidden) {
  const d = quizDeskParts(), onAnswer = quizTab === QUIZ_TAB.answer;
  d.tabAnswer.setAttribute('aria-selected', String(onAnswer));
  d.tabSimilar.setAttribute('aria-selected', String(!onAnswer));
  d.paneAnswer.hidden = !showAnswer || !onAnswer;
  d.paneSimilar.hidden = !showAnswer || onAnswer;
}
// a tab click swaps the pane in place (no re-render: each pane keeps its scroll position)
function setQuizTab(tab) {
  quizTab = tab;
  applyQuizTab();
  if (typeof refreshFades === 'function') refreshFades(byId('screenQuiz'));
}
function syncExamTimerCopy() {
  if (!quizDesk) return; // not built yet: renderQuizDesk copies it on the first render
  const big = quizDesk.bigTimer, small = byId('examTimer');
  big.textContent = small.textContent;
  big.classList.toggle('warn', small.classList.contains('warn'));
}
// mockup fitOptions(): options always 2 × 2 (css), one height while it fits; ① rows by content (is-tight) →
// ② tighter card / option padding (is-compact) → ③ only then does the column scroll
function fitQuiz(desktop) {
  arrangeQuiz(desktop);
  const d = quizDeskParts();
  fitSteps(d.main, [[d.moved.options, 'is-tight'], 'is-compact']);
}
