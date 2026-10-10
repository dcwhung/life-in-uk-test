// ════════════════════════════════════════
// TAGS — small shared HTML pieces: streak labels, question refs / map nodes, chips, mastery set buttons
// ════════════════════════════════════════
// "🔥 n/3" progress, or "🏆 Mastered" once the streak is complete
function streakText(n) { return t('common.streak', { n, max: MASTERY_STREAK }); }
function streakLabel(q) {
  const st = streakOf(q);
  return st >= MASTERY_STREAK ? t('common.mastered') : streakText(st);
}
function streakTagHtml(q) { return `<span class="rv-streak">${streakLabel(q)}</span>`; }

function questionRefText({ examNum, origIdx }) { return t('common.questionRef', { exam: examNum, n: origIdx + 1 }); }

// question map node "E9·Q15" (1-based, like the "Exam 9 · Q15" refs) — shared by the Similar panel's map and the
// fact card's source row; here (not in screens/similarPanel.js) because components load before screens (S-031)
function questionNodeClass(k) {
  const st = streakOf(questionByKey(k)); // G40: the copies' max streak
  return st >= MASTERY_STREAK ? ' mastered' : st > 0 ? ' weak' : '';
}
function questionNodeText({ examNum, origIdx }) { return t('similar.node', { exam: examNum, n: origIdx + 1 }); }
// G40: copies of one question text (questionGroups / currentCopies) are one node / ref, "E7·Q16 = E13·Q1"
function copiesNodeText(keys) { return keys.map(k => questionNodeText(questionByKey(k))).join(COPY_SEP); }
// S-140: each ref is nowrap (.sqm-ref), so a merged ref breaks only at " = ", never inside "Exam 12 · Q24"
function copiesRefText(keys) {
  return keys.map(k => `<span class="sqm-ref">${questionRefText(questionByKey(k))}</span>`).join(COPY_SEP);
}
// one display-only node for a question and its copies, coloured by its mastery
function questionNodeHtml(keys) { return `<span class="sqm-node${questionNodeClass(keys[0])}">${copiesNodeText(keys)}</span>`; }

function masteryBarHtml(m) { return `<span class="mastery-bar" style="width:${m.pct}%"></span>`; }

function chipHtml({ extraCls = '', active = false, action, arg, label, disabled = false }) {
  const argAttr = arg === undefined ? '' : ` data-arg="${escapeHtml(arg)}"`;
  return `<button class="chip${extraCls}${active ? ' active' : ''}" data-action="${escapeHtml(action)}"${argAttr}${disabled ? ' disabled' : ''}>${label}</button>`;
}

// home practice set button (difficulty / chapter rows) with its mastery count + bar
function setButtonHtml({ extraCls = '', action, arg, labelHtml, list }) {
  const m = masteryOf(list);
  return `<button class="chapter-btn${extraCls}${m.pct === PERCENT ? ' complete' : ''}" data-action="${escapeHtml(action)}" data-arg="${escapeHtml(arg)}">
      ${labelHtml}
      <span class="ch-count mastery${m.mastered ? '' : ' zero'}">${masteryText(m)}</span>${masteryBarHtml(m)}
    </button>`;
}

// v0.70: shared by the Practice answer box and the Results review, so a wrapped bullet keeps its hanging indent
// in both (css/components/note.css)
// note text: one row per \n line; "•" / "→" start a bullet, leading spaces + "◦" a sub-bullet, blank = gap.
// The marker sits in a fixed-width .note-mark box, so the text (and its wrapped lines) start at the same indent
const NOTE_MARK = /^([•◦→])\s*/;
function noteLineHtml(line) {
  const text = line.trim(), mark = text.match(NOTE_MARK);
  const cls = /^\s{2,}/.test(line) ? ' sub' : mark ? ' bullet' : '';
  const body = mark ? `<span class="note-mark">${mark[1]} </span>${escapeHtml(text.slice(mark[0].length))}` : escapeHtml(text);
  return `<div class="rv-note-line${cls}" lang="zh-HK">${body}</div>`;
}
// v1.0.7: consecutive lines starting with "|" are one table ("| a | b |", first row = header); "<br>" in a cell
// splits its main text from small remark lines (.note-cell-sub). Other lines still go through noteLineHtml
const NOTE_TABLE_ROW = /^\s*\|/;
const NOTE_CELL_BREAK = '<br>';
const NOTE_GAP_HTML = '<div class="rv-note-gap"></div>';
function noteHtml(note) {
  const out = [];
  let rows = [];
  const flushTable = () => { if (rows.length) out.push(noteTableHtml(rows)); rows = []; };
  for (const line of note.split('\n')) {
    if (NOTE_TABLE_ROW.test(line)) { rows.push(line); continue; }
    flushTable();
    out.push(line.trim() ? noteLineHtml(line) : NOTE_GAP_HTML);
  }
  flushTable();
  return out.join('');
}
// "| a | b |" lines -> table; lang on the table so it is marked like the .rv-note-line rows around it
function noteTableHtml(rows) {
  const [head, ...body] = rows.map(row => row.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim()));
  const rowHtml = (cells, tag) => `<tr>${cells.map(cell => noteCellHtml(cell, tag)).join('')}</tr>`;
  return `<div class="note-table-wrap"><table class="note-table" lang="zh-HK"><thead>${rowHtml(head, 'th')}</thead>`
    + `<tbody>${body.map(cells => rowHtml(cells, 'td')).join('')}</tbody></table></div>`;
}
// split on "<br>" first, then escape each part, so the only markup a note can add is the remark span
function noteCellHtml(cell, tag) {
  const [main, ...remarks] = cell.split(NOTE_CELL_BREAK);
  if (!remarks.length) return `<${tag}>${escapeHtml(cell)}</${tag}>`;
  const subs = remarks.map(remark => `<span class="note-cell-sub">${escapeHtml(remark)}</span>`).join('');
  return `<${tag} class="multi">${escapeHtml(main)}${subs}</${tag}>`;
}
