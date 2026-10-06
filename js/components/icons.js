// ════════════════════════════════════════
// ICONS — bookmark SVG + difficulty stars
// A bookmark <path> has no fill of its own: every class passed to bookmarkSvg() needs a CSS colour rule.
// ════════════════════════════════════════
const BOOKMARK_PATH = 'M7.5 3.5h9A2.5 2.5 0 0 1 19 6v14.5l-7-5.1-7 5.1V6a2.5 2.5 0 0 1 2.5-2.5z';
// decorative: inside a button that carries its own label (no class, hidden from screen readers)
function bookmarkSvg(cls, { decorative = false } = {}) {
  const attrs = decorative ? 'aria-hidden="true"' : `aria-label="${escapeHtml(t('common.flagged'))}"`;
  const clsAttr = cls ? `class="${cls}" ` : '';
  return `<svg ${clsAttr}viewBox="0 0 24 24" ${attrs}><path d="${BOOKMARK_PATH}"/></svg>`;
}

// tooltip "Difficulty d/5" (attribute-safe)
function difficultyTitle(d) { return escapeHtml(t('common.difficultyTitle', { d, max: MAX_DIFFICULTY })); }
// Difficulty stars (1-5) as inline HTML.
function starsHtml(d) {
  return `<span class="stars" title="${difficultyTitle(d)}">${'★'.repeat(d)}<span class="off">${'★'.repeat(MAX_DIFFICULTY - d)}</span></span>`;
}
