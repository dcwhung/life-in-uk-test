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

// v1.2.0: line icons for icon-only buttons (header ⚙, screen headers 🏠 / 📅 / ✏️). Stroke follows currentColor and the
// size follows the button's font size (1em boxes in css/components/buttons.css), so a larger text size grows them too
const LINE_ICON_PATHS = {
  home: ['M3 10.5 12 3l9 7.5', 'M5.5 9v11h13V9', 'M10 20v-6h4v6'],
  calendar: ['M5.5 5h13a2 2 0 0 1 2 2v11.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'M3.5 10h17', 'M8 3v4', 'M16 3v4'],
  pencil: ['M4 20h4L19 9l-4-4L4 16z', 'M13.5 6.5l4 4'],
  gear: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'],
};
// decorative: the button around it carries the label (aria-label / title from data-i18n-attr)
function lineIconSvg(name) {
  const paths = LINE_ICON_PATHS[name].map(d => `<path d="${d}"/>`).join('');
  return `<svg class="line-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;
}
// an element's accessible name (aria-label, for screen readers) and the same words as its pointer tooltip (title):
// icon buttons and the role="img" Study pill (S-191)
function setAccessibleName(el, label) {
  el.setAttribute('aria-label', label);
  el.setAttribute('title', label);
}
// static markup: <button data-icon="home"> gets its SVG at start-up (index.html keeps no inline SVG)
function fillStaticIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = lineIconSvg(el.dataset.icon); });
}

// tooltip "Difficulty d/5" (attribute-safe)
function difficultyTitle(d) { return escapeHtml(t('common.difficultyTitle', { d, max: MAX_DIFFICULTY })); }
// Difficulty stars (1-5) as inline HTML.
function starsHtml(d) {
  return `<span class="stars" title="${difficultyTitle(d)}">${'★'.repeat(d)}<span class="off">${'★'.repeat(MAX_DIFFICULTY - d)}</span></span>`;
}
