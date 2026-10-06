// ════════════════════════════════════════
// SIDE SESSION — a one-off Practice session run on top of something else: Similar Questions
// (back to the stashed quiz session) or a Study fact's source questions (back to Study).
// Each question once, listed order; the last one offers "↩ Back" instead of results.
// ════════════════════════════════════════
const SESSION_RETURN_KIND = { quiz: 'quiz', study: 'study' };
// null | { kind: 'quiz', state } | { kind: 'study', scrollY }
let sessionReturn = null;
function isSideSession() { return sessionReturn !== null; }
function clearSideSession() { sessionReturn = null; }

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
  };
}
function startSideSession(examNum, questions, returnTo) {
  sessionReturn = returnTo;
  state = sideSessionState(examNum, questions);
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
    window.scrollTo(0, ret.scrollY);
  },
};
function returnFromSideSession() {
  const ret = sessionReturn;
  sessionReturn = null;
  SESSION_RETURNS[ret.kind](ret);
}

// Study fact → its source questions (f.src order, each once), header "Fact #id"; ↩ Back returns to Study
// at the same scroll. No entry button yet (v0.62 engine only); PR-3 adds "▶ Practise these N" on the fact card.
function startFactPractice(factId) {
  const fact = STUDY.find(f => f.id === factId);
  if (!fact) return;
  startSideSession(FACT_PREFIX + factId, fact.src.map(questionByKey).map(toQuestionItem),
    { kind: SESSION_RETURN_KIND.study, scrollY: window.scrollY });
}
