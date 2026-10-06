// ════════════════════════════════════════
// TAGS — small shared HTML pieces: streak labels, question refs, chips, mastery set buttons
// ════════════════════════════════════════
const MASTERED_LABEL = '🏆 Mastered';

// "🔥 n/3" or the mastered label (call sites keep their own mastered wording)
function streakLabel(q, masteredLabel = MASTERED_LABEL) {
  const st = streakOf(q);
  return st >= MASTERY_STREAK ? masteredLabel : `🔥 ${st}/${MASTERY_STREAK}`;
}
function streakTagHtml(q) { return `<span class="rv-streak">${streakLabel(q)}</span>`; }

function questionRefText({ examNum, origIdx }) { return `Exam ${examNum} · Q${origIdx + 1}`; }

function masteryBarHtml(m) { return `<span class="mastery-bar" style="width:${m.pct}%"></span>`; }

function chipHtml({ extraCls = '', active = false, action, arg, label, disabled = false }) {
  const argAttr = arg === undefined ? '' : ` data-arg="${arg}"`;
  return `<button class="chip${extraCls}${active ? ' active' : ''}" data-action="${action}"${argAttr}${disabled ? ' disabled' : ''}>${label}</button>`;
}

// home practice set button (difficulty / chapter rows) with its mastery count + bar
function setButtonHtml({ extraCls = '', action, arg, labelHtml, list }) {
  const m = masteryOf(list);
  return `<button class="chapter-btn${extraCls}${m.pct === PERCENT ? ' complete' : ''}" data-action="${action}" data-arg="${arg}">
      ${labelHtml}
      <span class="ch-count mastery${m.mastered ? '' : ' zero'}">${masteryText(m)}</span>${masteryBarHtml(m)}
    </button>`;
}
