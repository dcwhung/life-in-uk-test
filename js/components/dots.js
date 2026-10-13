// ════════════════════════════════════════
// DOTS — numbered question dots + the counts legend under them (quiz navigator and result dots)
// ════════════════════════════════════════
const LEGEND_SEP = ' <span class="sep">|</span> ';

// tap target: data-action receives the 0-based question index
function dotButtonHtml(cls, action, idx) {
  return `<button class="${cls}" data-action="${escapeHtml(action)}" data-arg="${escapeHtml(idx)}" aria-label="${escapeHtml(t('common.questionN', { n: idx + 1 }))}">${idx + 1}</button>`;
}

// rows: [[legend class, label, count], …] per row → one .lg-row each, "Correct 3 | Unanswered 1".
// v1.6.1 (user 2026-10-12): always two fixed rows (Correct + Unanswered / Wrong + Flagged) instead of one wrapping
// line, which left "Flagged 0" alone under a trailing "|" on iPhone. Separators only go between a row's own
// entries, so a row never starts or ends with one; an empty row is left out.
function countsLegendHtml(rows) {
  const entryHtml = ([cls, label, n]) => `<span><i class="${cls}"></i>${label} <b>${n}</b></span>`;
  return rows.filter(row => row.length).map(row => `<span class="lg-row">${row.map(entryHtml).join(LEGEND_SEP)}</span>`).join('');
}
