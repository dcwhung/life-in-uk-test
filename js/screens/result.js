// ════════════════════════════════════════
// RESULTS — score + verdict, result dots, By Difficulty table, Review Answers (All / Wrong / Flagged)
// ════════════════════════════════════════
const MODE_ICONS = { [PRACTICE_MODE]: '🎯', [EXAM_MODE]: '📝' };
const PASS_PCT = PASS_RATIO * PERCENT;
const PASS_MARK = REAL_TEST_SIZE * PASS_RATIO;
const REVIEW_FILTERS = [
  { key: 'all', label: 'All', keep: () => true },
  { key: 'wrong', label: 'Wrong', keep: r => !r.isCorrect },   // includes unanswered
  { key: 'flagged', label: 'Flagged', keep: r => r.flagged, icon: true },
];
let reviewItems = [];        // one per session question: { q, idx, userAns, flagged, isCorrect }
let reviewIsPractice = false;
let reviewFilter = 'all';

function finishExam() {
  stopExamTimer();
  setShown('resultTimeUp', examTimeUp);
  examTimeUp = false;
  reviewItems = state.questions.map((q, idx) => {
    const userAns = state.answers[idx] || [];
    return { q, idx, userAns, flagged: isFlaggedNow(idx), isCorrect: isCorrectAnswer(q, userAns) };
  });
  recordExamResults();
  renderScore(reviewItems.filter(r => r.isCorrect).length, reviewItems.length);
  renderResultActions();
  byId('resultLabel').textContent = examLabel(state.examNum);
  byId('diffTable').innerHTML = diffTableHtml();
  reviewIsPractice = state.mode !== EXAM_MODE;
  reviewFilter = 'all';
  renderResultDots();
  renderReview();
  showScreen('screenResult');
  window.scrollTo(0, 0);
}
function recordExamResults() {
  // practice adds wrong answers as it goes; exam adds the answered-but-wrong ones here (unanswered are not added)
  if (state.mode === EXAM_MODE) reviewItems.forEach(r => { if (r.userAns.length && !r.isCorrect) addWrong(r.q); });
  if (isNumberedExam(state.examNum)) markExamCompleted(state.examNum);
}

// ── score card ──
function renderScore(correct, total) {
  const pct = percent(correct, total);
  const passed = pct >= PASS_PCT;
  // pass / fail verdict + remark only make sense for real-test-shaped sets
  const showVerdict = isNumberedExam(state.examNum) || isRandomExam(state.examNum);
  byId('resultEmoji').textContent = MODE_ICONS[state.mode];
  const scoreEl = byId('resultScore');
  scoreEl.innerHTML = `${correct} <span>/ ${total} · ${pct}%</span>`;
  scoreEl.classList.toggle('fail', state.mode === EXAM_MODE && showVerdict && !passed);
  renderVerdict(passed, pct, total, showVerdict);
  byId('rbCorrect').textContent = correct;
  byId('rbWrong').textContent = total - correct;
  byId('rbPct').textContent = pct + '%';
}
function renderVerdict(passed, pct, total, showVerdict) {
  const verdict = byId('resultLabel2');
  verdict.textContent = passed ? '🎉 PASSED' : '📚 NEEDS IMPROVEMENT'; // verdict icon; the top icon shows the mode
  verdict.className = 'result-label ' + (passed ? 'pass' : 'fail');
  verdict.hidden = !showVerdict;
  const sub = byId('resultSub');
  sub.textContent = total <= REAL_TEST_SIZE
    ? `You need ${PASS_MARK}/${REAL_TEST_SIZE} (${PASS_PCT}%) to pass the real test.`
    : `${PASS_PCT}% pass threshold. You scored ${pct}%.`;
  sub.hidden = !showVerdict;
}
function renderResultActions() {
  const isExamMode = state.mode === EXAM_MODE;
  const note = byId('resultNote');
  note.textContent = isExamMode ? '' : practiceResultNote();
  note.hidden = !note.textContent;
  const anotherLabel = isExamMode ? 'Another Exam' : 'Another Practice';
  document.querySelectorAll('#screenResult .retry-btn').forEach(btn => { btn.textContent = 'Retry'; });
  document.querySelectorAll('#screenResult .another-btn').forEach(btn => { btn.textContent = anotherLabel; });
}
// practice result line: wrong-answer review → cleared / left; other sets → mastery gained this round
function practiceResultNote() {
  if (state.examNum === WRONG_EXAM) {
    return `Cleared ${state.cleared} from your wrong list · ${keysOf(wrongList).length} left`;
  }
  if (state.examNum === SIMILAR_EXAM || !state.setPool) return '';
  const m = masteryOf(state.setPool);
  return `Mastered ${Math.max(0, m.mastered - state.masteredBefore)} more this round · ${m.mastered}/${m.total} in ${examLabel(state.examNum)}`;
}

// ── result dots (tap to jump to the review) ──
function resultDotClass(r) {
  const st = r.isCorrect ? 'ok' : r.userAns.length ? 'bad' : 'skip';
  return 'rdot ' + st + (r.flagged ? ' flag' : '');
}
function renderResultDots() {
  setShown('resultDotsWrap', true);
  byId('resultDots').innerHTML = reviewItems.map(r => dotButtonHtml(resultDotClass(r), 'jumpToReview', r.idx)).join('');
  const count = pred => reviewItems.filter(pred).length;
  byId('resultDotsMeta').innerHTML = countsLegendHtml([
    ['lg-ok', 'Correct', count(r => r.isCorrect)],
    ['lg-bad', 'Wrong', count(r => !r.isCorrect && r.userAns.length)],
    ['lg-skip', 'Unanswered', count(r => !r.userAns.length)],
    ['lg-flag', 'Flagged', count(r => r.flagged)],
  ]);
}
// tap a result dot: show that question's review (switch to All if the filter hides it) and highlight it
function jumpToReview(idx) {
  if (!byId('rv' + idx)) setReviewFilter('all');
  const el = byId('rv' + idx);
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.classList.add('hl');
  setTimeout(() => el.classList.remove('hl'), REVIEW_HIGHLIGHT_MS);
}

// ── By Difficulty table ──
function diffRowHtml(d, { c, t }) {
  const p = percent(c, t);
  const cls = p < DIFF_BAR_LOW_PCT ? 'low' : p < DIFF_BAR_MID_PCT ? 'mid' : '';
  return `<div class="diff-row">${starsHtml(d)}
      <div class="diff-bar ${cls}"><div style="width:${p}%"></div></div>
      <div class="diff-pct">${c}/${t} · ${p}%</div></div>`;
}
function diffTableHtml() {
  const byDiff = {};
  reviewItems.forEach(({ q, isCorrect }) => {
    byDiff[q.d] = byDiff[q.d] || { c: 0, t: 0 };
    byDiff[q.d].t++;
    if (isCorrect) byDiff[q.d].c++;
  });
  return Object.keys(byDiff).sort().map(d => diffRowHtml(Number(d), byDiff[d])).join('');
}

// ── Review Answers ──
function setReviewFilter(key) {
  reviewFilter = key;
  renderReview();
}
function visibleReviewItems() {
  return reviewItems.filter(REVIEW_FILTERS.find(f => f.key === reviewFilter).keep);
}
// note text: one row per \n line; "•" / "→" start a bullet, leading spaces + "◦" a sub-bullet, blank = gap
function noteHtml(note) {
  return note.split('\n').map(line => {
    if (!line.trim()) return '<div class="rv-note-gap"></div>';
    const cls = /^\s{2,}/.test(line) ? ' sub' : /^\s*[•◦→]/.test(line) ? ' bullet' : '';
    return `<div class="rv-note-line${cls}">${escapeHtml(line.trim())}</div>`;
  }).join('');
}
function reviewItemHtml({ q, idx, userAns, isCorrect, flagged }) {
  const correctText = q.a.map(ai => q.o[ai]).join(' | ');
  const userText = userAns.length ? userAns.map(ai => q.o[ai]).join(' | ') : 'No answer';
  const note = q.note ? `<div class="rv-note"><div class="rv-note-label">💡 備注：</div>${noteHtml(q.note)}</div>` : '';
  return `<div class="review-item ${isCorrect ? 'rv-correct' : 'rv-wrong'}" id="rv${idx}">
      <div class="rv-q">${reviewIsPractice ? streakTagHtml(q) : ''}${idx + 1}. ${escapeHtml(q.q)}${flagged ? bookmarkSvg('rv-flag') : ''}</div>
      ${!isCorrect ? `<div class="rv-your">Your answer: ${escapeHtml(userText)}</div>` : ''}
      <div class="rv-correct-ans">✅ ${escapeHtml(correctText)}</div>
      <div class="rv-tr"><div class="rv-yue">【廣東話】${escapeHtml(q.yue)}</div>${note}</div>
    </div>`;
}
function reviewChipsHtml() {
  return REVIEW_FILTERS.map(f => {
    const n = reviewItems.filter(f.keep).length;
    const label = `${f.icon ? bookmarkSvg('chip-flag') : ''}${f.label} <b>${n}</b>`;
    return chipHtml({ active: reviewFilter === f.key, action: 'setReviewFilter', arg: f.key, label, disabled: !n });
  }).join('');
}
function renderReview() {
  byId('reviewOrder').innerHTML = reviewChipsHtml();
  byId('reviewList').innerHTML = visibleReviewItems().map(reviewItemHtml).join('');
}

function retryExam() {
  startExam(state.examNum);
}
