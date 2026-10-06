// ════════════════════════════════════════
// MASTERY — consecutive correct answers per question (practice mode only)
// ════════════════════════════════════════
const qKey = q => q.examNum + '.' + q.origIdx;
function streakOf(q) { return streaks[qKey(q)] || 0; }
function isMastered(q) { return streakOf(q) >= MASTERY_STREAK; }
function recordPracticeAnswer(q, correct) {
  const k = qKey(q);
  streaks[k] = correct ? Math.min(MASTERY_STREAK, (streaks[k] || 0) + 1) : 0;
  saveStreaks();
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
