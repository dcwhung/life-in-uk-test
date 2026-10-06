// ════════════════════════════════════════
// DOTS — numbered question dots + the counts legend under them (quiz navigator and result dots)
// ════════════════════════════════════════
const LEGEND_SEP = ' <span class="sep">|</span> ';

// tap target: data-action receives the 0-based question index
function dotButtonHtml(cls, action, idx) {
  return `<button class="${cls}" data-action="${action}" data-arg="${idx}" aria-label="Question ${idx + 1}">${idx + 1}</button>`;
}

// entries: [legend class, label, count] → "Correct 3 | Wrong 1 | …"
function countsLegendHtml(entries) {
  return entries.map(([cls, label, n]) => `<span><i class="${cls}"></i>${label} <b>${n}</b></span>`).join(LEGEND_SEP);
}
