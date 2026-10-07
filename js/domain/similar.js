// ════════════════════════════════════════
// SIMILAR — every question belongs to one STUDY fact (fact.src = "exam.idx" keys);
// other questions of the same fact are the same point asked differently
// ════════════════════════════════════════
const FACT_BY_QKEY = {};
STUDY.forEach(f => f.src.forEach(k => { FACT_BY_QKEY[k] = f; }));
function factOf(q) { return FACT_BY_QKEY[qKey(q)]; }
function similarKeys(q) {
  const f = factOf(q);
  return f ? f.src.filter(k => k !== qKey(q)) : [];
}

// ── chapter fact number: a fact's 1-based position among the STUDY facts of its chapter ("Ch 3 #1") ──
// Counted over the whole data set, never a filtered list, so a search or filter cannot renumber a card.
// Display only: bookmarks, mastery, data-fact-id and localStorage keep the global fact id.
// Lives here, not in a new file: a cached older index.html has no <script> tag for a new domain file (SW cutover).
let chapterFactNumbers = null; // fact id → number, built on first use
function buildChapterFactNumbers() {
  const seen = {}, numbers = {};
  STUDY.forEach(f => {
    seen[f.ch] = (seen[f.ch] || 0) + 1;
    numbers[f.id] = seen[f.ch];
  });
  return numbers;
}
function chapterFactNumber(id) {
  if (!chapterFactNumbers) chapterFactNumbers = buildChapterFactNumbers();
  return chapterFactNumbers[id];
}
