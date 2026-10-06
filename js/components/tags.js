// ════════════════════════════════════════
// TAGS — small shared HTML pieces: streak labels, question refs, chips, mastery set buttons
// ════════════════════════════════════════
// "🔥 n/3" progress, or "🏆 Mastered" once the streak is complete
function streakText(n) { return t('common.streak', { n, max: MASTERY_STREAK }); }
function streakLabel(q) {
  const st = streakOf(q);
  return st >= MASTERY_STREAK ? t('common.mastered') : streakText(st);
}
function streakTagHtml(q) { return `<span class="rv-streak">${streakLabel(q)}</span>`; }

function questionRefText({ examNum, origIdx }) { return t('common.questionRef', { exam: examNum, n: origIdx + 1 }); }

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
