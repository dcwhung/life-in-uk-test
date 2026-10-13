// ════════════════════════════════════════
// STORE — persisted practice records (localStorage). Tests reassign these lets directly.
// ════════════════════════════════════════
let streaks = getLS(STREAK_LS) || {};        // { "exam.idx": consecutive correct answers }
let practiceFlags = getLS(FLAGS_LS) || {};   // { "exam.idx": true } — practice flags, kept across sessions
let wrongList = getLS(WRONG_LS) || {};       // { "exam.idx": true } — practice + exam mistakes

function saveStreaks() { setLS(STREAK_LS, streaks); }

// CUI-0039: the three "exam.idx"-keyed records may hold keys with no question (a removed exam / index, MERGE_LS data
// from an older version, a hand edit); questionByKey trusts its key, so every consumer (Home tiles, review rounds,
// Flagged list, plan tasks, mastery) reads these already pruned. Runs once at start (main.js startApp, after the lazy
// legacy migration in getLS), after questions.js defines isValidQuestionKey. Only a { key: value } object that lost a
// key is written back, so a clean load writes nothing; any other stored value is left as is and reads as empty.
function pruneStaleQuestionKeys() {
  // W-075: an HTTP-cached pre-v2.0.6 questions.js has no isValidQuestionKey — keep the lists as stored (v2.0.5 behaviour)
  if (typeof isValidQuestionKey !== 'function') return;
  const prune = (key, record) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return {};
    const kept = Object.fromEntries(Object.entries(record).filter(([k]) => isValidQuestionKey(k)));
    if (Object.keys(kept).length !== Object.keys(record).length) setLS(key, kept);
    return kept;
  };
  streaks = prune(STREAK_LS, streaks);
  practiceFlags = prune(FLAGS_LS, practiceFlags);
  wrongList = prune(WRONG_LS, wrongList);
}

// v1.3.0: text size (⚙ settings). Small = the design sizes; large = <html data-font-size="large">, which moves every
// --fs-* token up 2px (css/base/tokens.css). Nothing is written until the user picks; nothing stored or an unknown value
// reads as DEFAULT_FONT_SIZE (v1.4.2: large)
function getFontSize() {
  const size = getLS(FONT_SIZE_LS);
  if (FONT_SIZES.includes(size)) return size;
  // W-057: a pre-v1.4.2 config.js (mixed SW / HTTP cache) has no DEFAULT_FONT_SIZE, so it keeps the old small first run
  return typeof DEFAULT_FONT_SIZE !== 'undefined' ? DEFAULT_FONT_SIZE : FONT_SIZE_SMALL;
}
function applyFontSize() {
  const root = document.documentElement;
  if (getFontSize() === FONT_SIZE_LARGE) root.dataset.fontSize = FONT_SIZE_LARGE;
  else delete root.dataset.fontSize;
}
function setFontSize(size) {
  if (!FONT_SIZES.includes(size)) return;
  setLS(FONT_SIZE_LS, size);
  applyFontSize();
}
// v1.4.0: Cantonese translation (⚙ Features). Off = <html data-translation="off">, which hides every translation
// (css/base/layout.css); nothing is written until the user picks; an unknown value reads as on
function isTranslationOn() { return getLS(TRANSLATION_LS) !== TRANSLATION_OFF; }
function applyTranslation() {
  const root = document.documentElement;
  if (isTranslationOn()) delete root.dataset.translation;
  else root.dataset.translation = TRANSLATION_OFF;
}
function setTranslationOn(on) {
  setLS(TRANSLATION_LS, on ? TRANSLATION_ON : TRANSLATION_OFF);
  applyTranslation();
}
// G40 (user 2026-10-10): copies of one question text share a flag, so a toggle writes every copy
// (questionCopies: js/domain/questions.js, loaded later; only called at run time)
function setPracticeFlag(key, on) {
  questionCopies(key).forEach(k => { if (on) practiceFlags[k] = true; else delete practiceFlags[k]; });
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

// ── study plan (shapes: arch §B; parsed by js/domain/plan.js parseStoredPlan / planProgress.js parsePlanLog) ──
// raw stored values: a malformed one must reach the parser untouched, so it is never "repaired" here
function readStudyPlan() { return getLS(STUDY_PLAN_LS); }
function writeStudyPlan(plan) { setLS(STUDY_PLAN_LS, plan); }
// { stored, value }: a log that is stored but does not parse (value undefined) must never be overwritten
function readPlanLog() {
  const raw = getRawLS(STUDY_PLAN_PROGRESS_LS);
  if (raw === null) return { stored: false, value: null };
  try { return { stored: true, value: JSON.parse(raw) }; } catch { return { stored: true, value: undefined }; }
}
function writePlanLog(log) { setLS(STUDY_PLAN_PROGRESS_LS, log); }
// "↺ Reset plan" deletes the schedule and its log (and the schedule's "seen" marker); practice records and the switch are kept
function clearStudyPlan() {
  removeLS(STUDY_PLAN_LS);
  removeLS(STUDY_PLAN_PROGRESS_LS);
  removeLS(STUDY_PLAN_SEEN_LS);
}
// v1.0.4: the identity of the plan whose schedule was opened (null = never)
function readPlanScheduleSeen() { return getLS(STUDY_PLAN_SEEN_LS); }
function writePlanScheduleSeen(id) { setLS(STUDY_PLAN_SEEN_LS, id); }
function isStudyPlanEnabled() { return getLS(STUDY_PLAN_ENABLED_LS) !== false; }
function setStudyPlanEnabled(on) { setLS(STUDY_PLAN_ENABLED_LS, !!on); }
