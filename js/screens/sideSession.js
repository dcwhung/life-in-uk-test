// ════════════════════════════════════════
// SIDE SESSION — a one-off Practice session run on top of something else: Similar Questions
// (back to the stashed quiz session) or a Study fact's source questions (back to Study).
// Each question once, listed order; the last one offers "↩ Back" instead of results.
// ════════════════════════════════════════
const SESSION_RETURN_KIND = { quiz: 'quiz', study: 'study', plan: 'plan', memo: 'memo' };
// null | { kind: 'quiz', state } | { kind: 'study', scrollY, factId } — scrollY = the page's, or on desktop the card
//        panel's offset (js/screens/study.js studyScrollTop)
//      | { kind: 'plan', date, taskIndex, type, ch, from, … } — a study plan task (js/screens/planRun.js): date = the plan
//        day it counts for (G5), type = PLAN_TASK, from = the day screen to go back to (null = today); a round adds
//        retry / round / rounds, review mode (G17) review / page / pages / wrong; fact / pos = one fact of a reading or
//        wrong-facts task (PR6b), back to that card when done
//      | { kind: 'memo', id } — a memory-note group's test (v1.6.0, js/screens/memo.js): back to its result
let sessionReturn = null;
function isSideSession() { return sessionReturn !== null; }
function clearSideSession() { sessionReturn = null; }
function isPlanReturn(ret) { return ret !== null && ret.kind === SESSION_RETURN_KIND.plan; }
function isPlanSession() { return isPlanReturn(sessionReturn); }

// every state field is set here (no spread of the previous session): review counters, the set pool, exam flags
// and the mode would otherwise leak in. Always Practice, whatever Home's pendingMode says, and no exam timer.
function sideSessionState(examNum, questions) {
  return {
    mode: PRACTICE_MODE,
    examNum,
    questions,
    current: 0,
    answers: {},
    revealed: {},
    yueShown: {},
    flags: {},
    setPool: null,
    masteredBefore: 0,
    reviewTotal: 0,
    cleared: 0,
    sessionCorrect: 0,
    sessionTotal: 0,
    planDay: null,
  };
}
function startSideSession(examNum, questions, returnTo) {
  sessionReturn = returnTo;
  state = sideSessionState(examNum, questions);
  if (isPlanReturn(returnTo)) state.planDay = returnTo.date;
  if (isPlanReturn(returnTo) && returnTo.review) planFillReview(returnTo); // G17: answered + revealed, nothing recorded
  stopExamTimer();
  examTimeUp = false;
  showScreen('screenQuiz');
  renderQuestion();
  window.scrollTo(0, 0);
}

const SESSION_RETURNS = {
  // the original session, at the question it was left on
  [SESSION_RETURN_KIND.quiz]: ret => {
    state = ret.state;
    renderQuestion();
    window.scrollTo(0, 0);
  },
  // Study keeps its tab / chips / search in the `study` object and the search box, so a re-render restores them
  [SESSION_RETURN_KIND.study]: ret => {
    showScreen('screenStudy');
    renderStudy();
    setStudyScroll(ret.scrollY);
    flashStudyFact(ret.factId);
  },
  // a plan task goes back to the day screen it was opened from (its last question normally offers the next round)
  [SESSION_RETURN_KIND.plan]: ret => { sessionReturn = ret; planBackToDay(); },
  // v1.6.0: a memory-note group's test scores the session, records the group's level once, shows the result
  [SESSION_RETURN_KIND.memo]: ret => finishMemoTest(ret),
};
function returnFromSideSession() {
  const ret = sessionReturn;
  sessionReturn = null;
  SESSION_RETURNS[ret.kind](ret);
}

// ── v2.0.5: back mid-session (quiz / Result header; .proj-docs/qa/quiz-entry-back-audit.html #6–#9, #11) ──
// Each session goes back to where it started; the Home entries keep the 🏠 and go Home (goHome asks first in an exam).
// Leaving mid-way is the last "↩ Back" without its finish: a memory-note test records nothing and shows ① look.
const SESSION_LEAVES = { ...SESSION_RETURNS, [SESSION_RETURN_KIND.memo]: ret => leaveMemoTest(ret) };
function leaveSideSession() {
  const ret = sessionReturn;
  sessionReturn = null;
  SESSION_LEAVES[ret.kind](ret);
}
// Flagged list › Practise is an ordinary session (Retry keeps it), so its set id names the list it came from
function isFlaggedSession() { return !isSideSession() && state.examNum === FLAGGED_EXAM; }
// S-255: showScreen drops the focus; the list's Practise button (else its first control) takes it, as memoLook / planBackToDay
function focusFlaggedEntry() {
  const start = byId('flaggedStart');
  const target = start && start.getClientRects().length ? start : document.querySelector('#flaggedList button');
  if (target) target.focus({ preventScroll: true });
}
function goBack() {
  if (isPlanSession()) { planLeaveSession(); return; }
  if (isSideSession()) { leaveSideSession(); return; }
  if (isFlaggedSession()) { openFlagged(); window.scrollTo(0, 0); focusFlaggedEntry(); return; }
  goHome();
}
// the header's words while away from Home; null = the 🏠 icon. A plan session has its own (planRun.js)
// { textKey, params, nameKey }: the visible words, and (W-073) the full words as the accessible name when they are shortened
const SESSION_BACK_LABELS = {
  [SESSION_RETURN_KIND.quiz]: ret => ({ textKey: 'quiz.backToQuestion', nameKey: 'quiz.backToQuestionLabel', params: { n: ret.state.current + 1 } }),
  [SESSION_RETURN_KIND.study]: () => ({ textKey: 'quiz.backToStudy' }),
  [SESSION_RETURN_KIND.memo]: () => ({ textKey: 'quiz.backToMemo' }),
};
function entryBackLabel() {
  if (isSideSession()) {
    const label = SESSION_BACK_LABELS[sessionReturn.kind];
    return label ? label(sessionReturn) : null;
  }
  return isFlaggedSession() ? { textKey: 'quiz.backToFlagged' } : null;
}
// W-071: a stale locale without the key (t returns the key) gets null rather than a raw key
function entryBackText(textKey, params) {
  const text = t(textKey, params);
  return text === textKey ? null : text;
}
// W-071: without a goBack handler (cached pre-v2.0.5 actions.js / planRun.js) the header goes Home, so it says 🏠
function setEntryBack(back) {
  const label = typeof hasGoBackAction === 'function' && hasGoBackAction() ? entryBackLabel() : null;
  const text = label && entryBackText(label.textKey, label.params);
  if (!text) { setQuizBackHome(back); return; }
  setQuizBackText(back, escapeHtml(text), label.nameKey && entryBackText(label.nameKey, label.params));
}

function isStudyReturn(ret) { return ret !== null && ret.kind === SESSION_RETURN_KIND.study; }
// CUI-0010: a second call while already on the way back to Study (double tap / key repeat on the fact card's
// "▶ Practise") keeps the saved Study scroll — window.scrollY belongs to the quiz screen by then
function studyReturnPoint(factId) {
  return isStudyReturn(sessionReturn) ? sessionReturn : { kind: SESSION_RETURN_KIND.study, scrollY: studyScrollTop(), factId };
}
// Study fact → its source questions (f.src order, each distinct question once: G40 asks one copy of a repeated
// text), header "Fact Ch c #n" (W-016); ↩ Back returns to Study at the same scroll.
// Entry: the fact card's "▶ Practise these N" (startFactPractice action).
function startFactPractice(factId) {
  const fact = STUDY.find(f => f.id === factId);
  if (!fact) return;
  startSideSession(FACT_PREFIX + factId, questionGroups(fact.src).map(g => questionByKey(g[0])).map(toQuestionItem), studyReturnPoint(factId));
}
