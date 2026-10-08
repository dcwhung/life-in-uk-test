// ════════════════════════════════════════
// SIMILAR + fact indexes — every question belongs to one STUDY fact (fact.src = "exam.idx" keys);
// other questions of the same fact are the same point asked differently. Also numbers each fact within its chapter.
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
function buildChapterFactNumbers() {
  const seen = {}, numbers = {};
  STUDY.forEach(f => {
    seen[f.ch] = (seen[f.ch] || 0) + 1;
    numbers[f.id] = seen[f.ch];
  });
  return numbers;
}
const CHAPTER_FACT_NUMBER = buildChapterFactNumbers(); // fact id → number; STUDY is loaded before this file
function chapterFactNumber(id) { return CHAPTER_FACT_NUMBER[id]; }

// v0.71 (B3): a fact's memory method = the part of its first source question's note that starts at the memory-method
// heading word, without that heading line; '' when none. Read from the notes, so Study never drifts from the questions
const MEMORY_MARK = '\u8A18\u61B6\u6CD5'; // the heading word notes use for a memory method (see HANDOFF note format rules)
function factMemoryText(f) {
  for (const k of f.src) {
    const note = questionByKey(k).q.note || '';
    const at = note.indexOf(MEMORY_MARK);
    if (at >= 0) return note.slice(at).split('\n').slice(1).join('\n');
  }
  return '';
}
