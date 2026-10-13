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
  quizMainHold = holdQuizMainView(); // CUI-0034: measured before anything below changes the left column
  try {
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
    forgetQuizPanelsOnNewQuestion();
    quizDeskStale = true; // S-233: the desktop parts are filled by arrangeQuiz, and only on desktop
    arrangeQuiz(deskOn()); // v2.0.0: the desktop columns first, so the counter below measures the row it ends up in
    arrangeQuizPhone(deskOn()); // v2.3.0: the phone's scroll panel
    fitQuestionCounter(); // C3: measured once the counter's row (bookmark, arrows) is final
    desktopRefit('screenQuiz', fitQuiz);
  } finally {
    quizMainHold = null; // S-249: used by fitQuiz above; never carried to a later resize, even if the render throws
  }
}
// W-016: a fact set's "Ch c #n" is English in every language (S-057), so it goes in a lang="en" span; v1.6.0: a memo
// set's group title is Cantonese data (lang="zh-HK"; v2.2.0: English in the English UI, memoLocal). Built from text nodes, never innerHTML, so the locale string
// cannot inject markup
function examLabelPart(examNum) {
  if (isFactExam(examNum)) return { text: t('study.chapterFactId', factSetParams(examNum)), lang: 'en' };
  return { text: memoSetTitle(examNum), lang: memoSetLang(examNum) };
}
function setExamLabel(el, examNum) {
  const label = examLabel(examNum), part = examLabelPart(examNum);
  const at = part.text ? label.indexOf(part.text) : -1;
  if (at < 0) { el.textContent = label; return; }
  const partEl = document.createElement('span');
  partEl.lang = part.lang;
  partEl.textContent = part.text;
  el.replaceChildren(label.slice(0, at), partEl, label.slice(at + part.text.length));
}
// C3 (v1.3.0, user): "Question 1 of 24" unless it wraps (large text at 320px), then quiz.questionOfShort ("Question 1/24");
// where even that wraps (the wide Translate button in the row) it stays short on two lines (user).
// v2.0.5 (proposal "question-row option Y", user 2026-10-13): the counter and its stars share the row with Translate (before
// answering) and the quick ← → (after answering; always on desktop, F4). Measured against every state the question
// goes through, not only the one on screen: if any of them would push the stars or the counter onto a second line,
// every state uses the short form, so the row (and the question text below it) never changes height on answering
function fitQuestionCounter() {
  const counter = document.querySelector('#qNum > span[data-full]');
  if (!counter) return;
  const qNum = byId('qNum');
  // v2.0.5 C3 (user 2026-10-13): full → short → tiny ("Q 1/24"); the first that fits every state. Where even tiny
  // cannot, tiny stays (the stars then wrap below it; they never disappear)
  const tiers = [counter.dataset.full, counter.dataset.short, counter.dataset.tiny || counter.dataset.short];
  const fits = tiers.find(text => {
    counter.textContent = text;
    return questionRowFitsEveryState(qNum);
  });
  counter.textContent = fits || tiers[tiers.length - 1];
}
// the row's controls in each state: practice shows Translate (either label) until answered, then the quick pair;
// an exam has the quick pair throughout (renderTranslation, renderNavButtons). Desktop css shows the pair regardless
function questionRowStates() {
  const answered = { yue: false, quick: true };
  if (state.mode !== PRACTICE_MODE) return [answered];
  return [
    { yue: true, label: t('quiz.translate'), quick: false },
    { yue: true, label: yueHideLabel(), quick: false },
    answered,
  ];
}
// C3 (user 2026-10-13): the pressed button reads the short "Hide" (quiz.hideShort) so the row keeps room for the counter;
// its accessible name stays the full quiz.hideTranslation. A pre-v2.0.5 locale has no hideShort: the full words
function yueHideLabel() {
  const hideKey = 'quiz.hideShort', text = t(hideKey);
  return text === hideKey ? t('quiz.hideTranslation') : text;
}
// true when the counter and stars stay on one line in every state; the controls are put back as they were before the
// next paint (translation off keeps Translate hidden: its !important rule beats .visible)
function questionRowFitsEveryState(qNum) {
  const yue = byId('yueToggle'), quick = byId('quickNav');
  const saved = { yueClass: yue.className, yueLabel: yue.textContent, quickClass: quick.className };
  try {
    return questionRowStates().every(row => {
      yue.classList.toggle('visible', row.yue);
      if (row.label) yue.textContent = row.label;
      quick.classList.toggle('visible', row.quick);
      return textLineCount(qNum) === 1;
    });
  } finally {
    yue.className = saved.yueClass;
    yue.textContent = saved.yueLabel;
    quick.className = saved.quickClass;
  }
}
// a rotation / resize changes the room the counter has. S-257: a drag fires many resize events a frame; each fit
// measures every row state (forced layouts), so they are merged into one fit on the next frame
let questionCounterFitFrame = 0;
window.addEventListener('resize', () => {
  if (questionCounterFitFrame) return;
  questionCounterFitFrame = requestAnimationFrame(() => {
    questionCounterFitFrame = 0;
    if (byId('screenQuiz').classList.contains('active')) fitQuestionCounter();
  });
});
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
  // v2.0.5 C3: the third tier "Q 1/24"; a locale without it falls back to the short form
  const tinyKey = 'quiz.questionOfTiny', tinyText = t(tinyKey, { n: idx + 1, total }), tiny = tinyText === tinyKey ? short : escapeHtml(tinyText);
  byId('qNum').innerHTML = `<span data-full="${full}" data-short="${short}" data-tiny="${tiny}">${full}</span>${starsHtml(q.d)}`;
  byId('qText').textContent = q.q;
}
function renderTranslation(q, revealed, yueOn) {
  const yueToggle = byId('yueToggle');
  yueToggle.classList.toggle('visible', state.mode === PRACTICE_MODE && !revealed);
  yueToggle.classList.toggle('on', yueOn);
  yueToggle.textContent = yueOn ? yueHideLabel() : t('quiz.translate');
  // C3: the visible "Hide" is short; the name and tooltip keep the full words
  const yueName = yueOn ? t('quiz.hideTranslation') : t('quiz.translate');
  yueToggle.setAttribute('aria-label', yueName);
  yueToggle.title = yueName;
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
  // v2.2.0: the note in the UI language (localNote); #ansNote carries its lang, so the 💡 label reads with it (S-048)
  byId('ansNote').innerHTML = q.note ? `<strong>${t('common.noteLabel')}</strong>${localNoteHtml(q.note, 'ans-note-text')}` : '';
  byId('ansNote').lang = q.note ? localNote(q.note).lang : ZH_HK_LANG;
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
  setIconLabel(byId('nextBtn'), next.label, next.labelIcons); // v1.6.1: words + line icon, never a glyph
  const quickNext = byId('quickNext');
  quickNext.innerHTML = lineIconSvg(next.icon); // C1: a line icon, never a glyph (iOS draws "↩" as an emoji)
  setAccessibleName(quickNext, next.label);
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
// label + labelIcons ({ lead, trail }: where the old glyph sat) = bottom button; icon = quick button in the question
// header (LINE_ICON_PATHS names), named by the same label
const QUICK_ICON = { prev: 'arrowLeft', next: 'arrowRight', finish: 'check', back: 'returnLeft' };
const NEXT_LABEL_ICONS = { next: { trail: QUICK_ICON.next }, finish: { trail: QUICK_ICON.finish }, back: { lead: QUICK_ICON.back } };
function nextAction(idx, total) {
  if (idx < total - 1) {
    return { label: t('quiz.next'), labelIcons: NEXT_LABEL_ICONS.next, icon: QUICK_ICON.next, run: nextQ };
  }
  if (isPlanSession()) return planNextAction();
  if (isSideSession()) {
    return { label: t('quiz.back'), labelIcons: NEXT_LABEL_ICONS.back, icon: QUICK_ICON.back, run: returnFromSideSession };
  }
  if (state.mode === EXAM_MODE) return { label: t('exam.submit'), icon: QUICK_ICON.finish, run: submitExam };
  return { label: t('quiz.finish'), labelIcons: NEXT_LABEL_ICONS.finish, icon: QUICK_ICON.finish, run: finishExam };
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
const QUIZ_TAB = { answer: 'answer', similar: 'similar' };
const QUIZ_TAB_KEYS = { ArrowRight: 1, ArrowLeft: -1 }; // W-378: ← → step (and wrap); Home / End below
let quizDesk = null; // built on the first desktop render (S-233: never on a phone)
let quizDeskStale = true; // the question changed since the desktop parts were last filled
let quizTab = QUIZ_TAB.answer;
let quizTabQuestion = null; // the question the open tab belongs to: a new question opens on Answer
// v2.0.1: the scroll panels are kept from question to question, so each remembers the question it last showed
// ([set, index]: the same question in a new set counts as new) and starts at the top the first time it is shown
// for another one; a hidden panel ignores scrollTop, so this waits until it is shown (a tab swap keeps the scroll)
let quizPanelSeen = new WeakMap();
// CUI-0033 (v2.0.2): a panel hidden on the question in between never saw it, so going back would keep its old scroll;
// every render of a different question forgets what all the panels saw, and each starts at the top once shown
let quizRenderedQuestion = null;
function forgetQuizPanelsOnNewQuestion() {
  const r = quizRenderedQuestion;
  if (r && r[0] === state.questions && r[1] === state.current) return;
  quizRenderedQuestion = [state.questions, state.current];
  quizPanelSeen = new WeakMap();
}
// CUI-0034 (v2.0.3): answering (or Translate) re-renders the same question: the options are rewritten, the card's
// Translate gives way to ← → (a lower header row), and fitQuiz takes its steps off and on again. The left column keeps
// its scrollTop (overflow-anchor: none in css/screens/quiz.css: the browser's own anchoring moved it again a frame
// later, by ~10px), and the element the user was looking at (the question text, else the first option still in view) is
// put back where it was once the fit is done; the column's ends clamp it
let quizMainHold = null;
function quizMainAnchors(main) {
  return [byId('qText'), ...byId('optionsContainer').querySelectorAll('.opt')].filter(el => el && main.contains(el));
}
function holdQuizMainView() {
  const r = quizRenderedQuestion, main = quizDesk && quizDesk.main;
  if (!main || !main.getClientRects().length || !main.scrollTop) return null;
  if (!r || r[0] !== state.questions || r[1] !== state.current) return null; // a new question starts at the top
  const panelTop = main.getBoundingClientRect().top;
  const anchor = quizMainAnchors(main).find(el => el.getBoundingClientRect().bottom > panelTop + FIT_SLACK_PX);
  if (!anchor) return null;
  const id = anchor.id, y = anchor.getBoundingClientRect().top; // ids (qText, opt0…) outlive the options' innerHTML
  return () => {
    const el = byId(id);
    if (el && main.getClientRects().length) main.scrollTop += el.getBoundingClientRect().top - y;
  };
}
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
  d.tabs.addEventListener('keydown', onQuizTabKey);
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
  const layout = quizDeskLayout(desktop);
  if (!layout && !quizDesk) return; // S-233: a phone that never was desktop has nothing to put back
  const d = quizDeskParts();
  if (layout && quizDeskStale) renderQuizDesk();
  deskKeepFocus(() => placeQuizParts(d, layout)); // S-228: focus back once every box is in the document
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
// tab labels, which pane shows, the rail's timer copy and Submit for the current question; no measuring (the fit
// does that). Called by arrangeQuiz on desktop only, once per question render
function renderQuizDesk() {
  const d = quizDeskParts(), idx = state.current, q = state.questions[idx], total = state.questions.length;
  const showAnswer = idx in state.revealed && state.mode === PRACTICE_MODE;
  quizDeskStale = false;
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
  renderExamSubmit(d.submit, idx, total);
}
// S-231: the rail's Submit is the card's ✓ on the last question, so it says what nextAction() says
function renderExamSubmit(submit, idx, total) {
  const last = idx === total - 1;
  submit.hidden = !last;
  if (!last) return;
  const next = nextAction(idx, total);
  // v2.0.4 merge: nextAction() has no separate title since the v1.6.1 line icons (the quick ✓ is named by its label,
  // icons.js setAccessibleName); the Submit's own words name it. Words only: an exam's Submit has no icon (no
  // labelIcons), and .with-icon's display would override [hidden] on the other questions
  submit.textContent = next.label;
}
// W-378: roving tabindex (the chosen tab 0, the other -1) with aria-selected
function applyQuizTab(showAnswer = !quizDeskParts().tabs.hidden) {
  const d = quizDeskParts(), onAnswer = quizTab === QUIZ_TAB.answer;
  [[d.tabAnswer, onAnswer], [d.tabSimilar, !onAnswer]].forEach(([tab, chosen]) => {
    tab.setAttribute('aria-selected', String(chosen));
    tab.tabIndex = chosen ? 0 : -1;
  });
  d.paneAnswer.hidden = !showAnswer || !onAnswer;
  d.paneSimilar.hidden = !showAnswer || onAnswer;
  topQuizPanelsOnNewQuestion(d);
}
function topQuizPanelsOnNewQuestion(d) {
  [d.main, d.paneAnswer.firstElementChild, d.paneSimilar.firstElementChild].forEach(topQuizPanelOnNewQuestion);
}
function topQuizPanelOnNewQuestion(panel) {
  const seen = quizPanelSeen.get(panel);
  if (!panel.getClientRects().length || (seen && seen[0] === state.questions && seen[1] === state.current)) return;
  quizPanelSeen.set(panel, [state.questions, state.current]);
  panel.scrollTop = 0;
}
// a tab click swaps the pane in place (no re-render: each pane keeps its scroll position)
function setQuizTab(tab) {
  quizTab = tab;
  applyQuizTab();
  if (typeof refreshFades === 'function') refreshFades(byId('screenQuiz'));
}
// W-378 (WAI-ARIA tabs, automatic activation): ← / → move to the previous / next shown tab (wrapping), Home / End
// to the first / last; the tab moved to is chosen and focused
function onQuizTabKey(e) {
  const d = quizDeskParts();
  const tabs = [[d.tabAnswer, QUIZ_TAB.answer], [d.tabSimilar, QUIZ_TAB.similar]].filter(([tab]) => !tab.hidden);
  const at = tabs.findIndex(([tab]) => tab === document.activeElement);
  if (at < 0) return;
  let to;
  if (e.key in QUIZ_TAB_KEYS) to = (at + QUIZ_TAB_KEYS[e.key] + tabs.length) % tabs.length;
  else if (e.key === 'Home') to = 0;
  else if (e.key === 'End') to = tabs.length - 1;
  else return;
  e.preventDefault();
  setQuizTab(tabs[to][1]);
  tabs[to][0].focus();
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
  arrangeQuizPhone(desktop);
  if (!quizDesk) return; // S-233: never built on a phone, so no steps to take off
  const d = quizDesk;
  fitSteps(d.main, [[d.moved.options, 'is-tight'], 'is-compact']);
  if (quizMainHold) { quizMainHold(); quizMainHold = null; } // CUI-0034: same question, before runRefits refreshes the fades
  topQuizPanelsOnNewQuestion(d); // after every render and when the screen is shown (runRefits then refreshes the fades)
}

// ── v2.3.0 phone (< 1024px; mockup mockups/v2.0.0/desktop-memo.html rev 5 / rev 6 placeQuizPhone; decision log
// .proj-docs/plans/2026-10-13_grill_desktop-memo.md P6: every quiz — Practice, Exam, the memo test, plan tasks) ──
// One screen high (.is-fit-phone, css/components/fit.css): the quiz header and the question card stay put; the parts
// after the card (options, answer box, the plan pair note, the Similar panel) share one panel that scrolls on its own
// with fades; Prev / Next stay at the bottom. The panel is built once, on the first phone render (never on a desktop,
// like the desktop parts never on a phone), before Prev / Next, and kept; from 1024px the desktop columns take the
// parts and it is left empty, 0px high (their phone place, deskRemember, may be inside it; quiz.css)
const QUIZ_PHONE_PART_IDS = ['optionsContainer', 'answerBox', 'planPairNote', 'similarBox'];
let quizPhone = null;
function buildQuizPhone() {
  const screen = byId('screenQuiz'), nav = screen.querySelector(':scope > .nav-row');
  const wrap = deskEl('div', 'quiz-scroll fit-fade'), panel = deskEl('div', 'quiz-scroll-panel fit-panel');
  wrap.append(panel);
  nav.before(wrap);
  screen.classList.add(QUIZ_PHONE_FIT_CLASS);
  return { wrap, panel };
}
function arrangeQuizPhone(desktop) {
  if (desktop) return;
  if (!quizPhone) quizPhone = buildQuizPhone();
  deskFill(quizPhone.panel, QUIZ_PHONE_PART_IDS.map(byId)); // in place: moves nothing (focus, scroll)
  fitQuizPhone();
  topQuizPanelOnNewQuestion(quizPhone.panel); // a new question starts at the top (runRefits then refreshes the fades)
}
// C-007: one screen high only while the panel keeps room for the options (a tall card on a short phone: the page
// scrolls instead, as before v2.3.0). W-082 (user 2026-10-13, option A): decided once per quiz session, so the layout
// (and Prev / Next with it) does not flip from question to question: once a render falls back, the session keeps the
// scrolling page. The session is its question list (state.questions: a new set, round or side session has its own;
// ↩ Back to a session finds its decision again). A new screen width (rotation, a resized window), text size,
// translation setting or language is a new start: the latch is kept with that context and decided afresh when it
// differs. S-268: the height is left out — a phone browser's toolbar folding away while the page scrolls changes only
// innerHeight, and that must not re-decide mid-session
const QUIZ_PHONE_FIT_CLASS = 'is-fit-phone';
const quizPhoneFallbacks = new WeakMap(); // state.questions → the layout context it fell back in
function quizPhoneContext() {
  const root = document.documentElement;
  return [innerWidth, root.lang, root.dataset.fontSize || '', root.dataset.translation || ''].join('|');
}
function fitQuizPhone() {
  if (typeof fitPhoneScreen !== 'function') return; // W-057: a cached shell may load js/components/fit.js late
  const screen = byId('screenQuiz'), context = quizPhoneContext();
  if (quizPhoneFallbacks.get(state.questions) === context) { screen.classList.remove(QUIZ_PHONE_FIT_CLASS); return; }
  if (!fitPhoneScreen(screen, quizPhone.panel)) quizPhoneFallbacks.set(state.questions, context);
}
