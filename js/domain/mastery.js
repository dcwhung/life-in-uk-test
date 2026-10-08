// ════════════════════════════════════════
// MASTERY — consecutive correct answers per question (practice mode only)
// ════════════════════════════════════════
const qKey = q => q.examNum + '.' + q.origIdx;
function streakOf(q) { return streaks[qKey(q)] || 0; }
function isMastered(q) { return streakOf(q) >= MASTERY_STREAK; }
// planDay: the study plan day the session was opened from (null outside a plan task); the plan log decides the day (G2 / G5)
function recordPracticeAnswer(q, correct, planDay = null) {
  const k = qKey(q);
  streaks[k] = correct ? Math.min(MASTERY_STREAK, (streaks[k] || 0) + 1) : 0;
  saveStreaks();
  recordPlanAnswer(k, correct, planDay); // no plan stored → writes nothing (R3)
}
function isPracticeFlagged(q) { return !!practiceFlags[qKey(q)]; }

function masteryOf(list) {
  const mastered = list.filter(isMastered).length;
  return { mastered, total: list.length, pct: percent(mastered, list.length) };
}
function masteryText(m) { return `${m.mastered}/${m.total} · ${m.pct}%`; }
// questions still to practise: skip mastered ones until the whole set is mastered
function practicePool(list) {
  const remaining = list.filter(item => !isMastered(item));
  return remaining.length ? remaining : list;
}
// a Study fact's Practice mastery: its source questions (f.src); `derived` = every one of them is 🏆.
// Computed on each render, never stored — "Reset practice progress" clears it together with the streaks.
function factMastery(f) {
  const m = masteryOf(f.src.map(questionByKey));
  // W-011: 0 / 0 is "no sources", not "all mastered" — guard the zero case instead of relying on the data
  return { ...m, derived: m.total > 0 && m.mastered === m.total };
}
