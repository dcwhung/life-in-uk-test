// ════════════════════════════════════════
// FIT ROW (v1.3.1, user) — a row of items stays on one row only while the texts it names fit as designed; otherwise
// it stacks. Markup: <div data-fit-row=".chip">: the selector names the texts to check. A text fits when it runs to one
// line and nothing is cut (its own padding included). The row gets .is-stacked and its CSS says how it stacks (the
// goal form presets 2 × 2, the level cards and the My Review tiles one per row). Rows are fitted after each render, on
// resize and (through the re-render) after a language or text size change.
// ════════════════════════════════════════
const FIT_ROW_STACKED_CLASS = 'is-stacked';
// how many lines an element's text runs to (also the C3 quiz counter's check)
function textLineCount(el) {
  const range = document.createRange();
  range.selectNodeContents(el);
  return new Set([...range.getClientRects()].map(r => Math.round(r.top))).size;
}
function fitsOneLine(el) { return textLineCount(el) <= 1 && el.scrollWidth <= el.clientWidth + 1; }
// a hidden row cannot be measured: it is fitted when its screen renders
function fitRow(row) {
  if (!row || !row.getClientRects().length) return;
  row.classList.remove(FIT_ROW_STACKED_CLASS);
  const texts = [...row.querySelectorAll(row.dataset.fitRow)];
  row.classList.toggle(FIT_ROW_STACKED_CLASS, texts.some(el => !fitsOneLine(el)));
}
function fitRows(root = document) { root.querySelectorAll('[data-fit-row]').forEach(fitRow); }
window.addEventListener('resize', () => fitRows());
