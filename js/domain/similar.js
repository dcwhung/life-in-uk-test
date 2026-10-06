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
