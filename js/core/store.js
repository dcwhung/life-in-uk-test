// ════════════════════════════════════════
// STORE — persisted practice records (localStorage). Tests reassign these lets directly.
// ════════════════════════════════════════
let streaks = getLS(STREAK_LS) || {};        // { "exam.idx": consecutive correct answers }
let practiceFlags = getLS(FLAGS_LS) || {};   // { "exam.idx": true } — practice flags, kept across sessions
let wrongList = getLS(WRONG_LS) || {};       // { "exam.idx": true } — practice + exam mistakes

function saveStreaks() { setLS(STREAK_LS, streaks); }
function setPracticeFlag(key, on) {
  if (on) practiceFlags[key] = true; else delete practiceFlags[key];
  setLS(FLAGS_LS, practiceFlags);
}
function addWrong(q) { wrongList[qKey(q)] = true; setLS(WRONG_LS, wrongList); }
function clearWrong(q) { delete wrongList[qKey(q)]; setLS(WRONG_LS, wrongList); }
function resetPracticeStore() {
  streaks = {};
  saveStreaks();
  wrongList = {};
  setLS(WRONG_LS, wrongList);
  practiceFlags = {};
  setLS(FLAGS_LS, practiceFlags);
}

function completedExams() { return getLS(COMPLETED_LS) || {}; }
function markExamCompleted(examNum) {
  const done = completedExams();
  done[examNum] = true;
  setLS(COMPLETED_LS, done);
}
function clearCompletedExams() { setLS(COMPLETED_LS, {}); }

function readHomePrefs() { return getLS(HOME_PREFS_LS) || {}; }
function writeHomePrefs(prefs) { setLS(HOME_PREFS_LS, prefs); }
