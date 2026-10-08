// ════════════════════════════════════════
// RESULTS — score + verdict, result dots, By Difficulty table, Review Answers (All / Wrong / Flagged)
// ════════════════════════════════════════
const MODE_ICONS = { [PRACTICE_MODE]: '🎯', [EXAM_MODE]: '📝' };
const PASS_PCT = PASS_RATIO * PERCENT;
const PASS_MARK = REAL_TEST_SIZE * PASS_RATIO;
const ANSWER_SLOT = '{answer}'; // review.yourAnswer's parameter, as t() leaves it when not passed
const REVIEW_FILTERS = [
  { key: 'all', labelKey: 'review.filterAll', keep: () => true },
  { key: 'wrong', labelKey: 'review.filterWrong', keep: r => !r.isCorrect },   // includes unanswered
  { key: 'flagged', labelKey: 'review.filterFlagged', keep: r => r.flagged, icon: true },
];
let reviewItems = [];        // one per session question: { q, idx, userAns, flagged, isCorrect }
let reviewIsPractice = false;
let reviewFilter = 'all';

function finishExam() {
  stopExamTimer();
  // W-024: time up can land while Submit / Leave is asking; drop that prompt so it cannot cover or re-submit the results
  if (isConfirmOpen()) closeConfirm();
  setShown('resultTimeUp', examTimeUp);
  examTimeUp = false;
  reviewItems = state.questions.map((q, idx) => {
    const userAns = state.answers[idx] || [];
    return { q, idx, userAns, flagged: isFlaggedNow(idx), isCorrect: isCorrectAnswer(q, userAns) };
  });
  recordExamResults();
  reviewIsPractice = state.mode !== EXAM_MODE;
  reviewFilter = 'all';
  renderResults();
  showScreen('screenResult');
  window.scrollTo(0, 0);
}
// draws the results from reviewItems without recording anything (also used to re-render on a language change)
function renderResults() {
  renderScore(reviewItems.filter(r => r.isCorrect).length, reviewItems.length);
  renderResultActions();
  setExamLabel(byId('resultLabel'), state.examNum);
  byId('diffTable').innerHTML = diffTableHtml();
  renderResultDots();
  renderReview();
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
}
function renderVerdict(passed, pct, total, showVerdict) {
  const verdict = byId('resultLabel2');
  verdict.textContent = passed ? t('result.passed') : t('result.needsImprovement'); // verdict icon; the top icon shows the mode
  verdict.className = 'result-label ' + (passed ? 'pass' : 'fail');
  verdict.hidden = !showVerdict;
  const sub = byId('resultSub');
  sub.textContent = total <= REAL_TEST_SIZE
    ? t('result.passNeeded', { mark: PASS_MARK, size: REAL_TEST_SIZE, pct: PASS_PCT })
    : t('result.passThreshold', { pct: PASS_PCT, score: pct });
  sub.hidden = !showVerdict;
}
function renderResultActions() {
  const isExamMode = state.mode === EXAM_MODE;
  const note = byId('resultNote');
  note.textContent = isExamMode ? '' : practiceResultNote();
  note.hidden = !note.textContent;
  const anotherLabel = isExamMode ? t('result.anotherExam') : t('result.anotherPractice');
  // CUI-0016: a review set emptied this round has nothing left to retry (only Home stays)
  const canRetry = !isReviewSet(state.examNum) || poolFor(state.examNum).length > 0;
  document.querySelectorAll('#screenResult .retry-btn').forEach(btn => {
    btn.textContent = t('result.retry');
    btn.hidden = !canRetry;
  });
  document.querySelectorAll('#screenResult .another-btn').forEach(btn => { btn.textContent = anotherLabel; });
}
// practice result line: wrong-answer review → cleared / left; other sets → mastery gained this round
function practiceResultNote() {
  if (state.examNum === WRONG_EXAM) {
    return t('result.clearedNote', { n: state.cleared, left: keysOf(wrongList).length });
  }
  if (state.examNum === SIMILAR_EXAM || !state.setPool) return '';
  const m = masteryOf(state.setPool);
  return t('result.masteredNote', {
    n: Math.max(0, m.mastered - state.masteredBefore), mastered: m.mastered, total: m.total, set: examLabel(state.examNum),
  });
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
    ['lg-ok', t('common.correct'), count(r => r.isCorrect)],
    ['lg-bad', t('common.wrong'), count(r => !r.isCorrect && r.userAns.length)],
    ['lg-skip', t('common.unanswered'), count(r => !r.userAns.length)],
    ['lg-flag', t('common.flagged'), count(r => r.flagged)],
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
  // S-102: the chips are redrawn, so a chip that had focus (keyboard use) hands it to the chip just chosen
  const hadFocus = byId('reviewOrder').contains(document.activeElement);
  reviewFilter = key;
  renderReview();
  if (hadFocus) byId('reviewOrder').querySelector(`[data-arg="${key}"]`).focus();
}
function visibleReviewItems() {
  return reviewItems.filter(REVIEW_FILTERS.find(f => f.key === reviewFilter).keep);
}
// S-047: the label follows the UI language, the chosen English option is lang="en"; "{answer}" is left in by t()
// (no param) and swapped for the span after escaping, so no locale key changes. review.noAnswer is UI text: no span.
function yourAnswerHtml(q, userAns) {
  if (!userAns.length) return escapeHtml(t('review.yourAnswer', { answer: t('review.noAnswer') }));
  const answer = `<span lang="en">${escapeHtml(userAns.map(ai => q.o[ai]).join(ANSWER_SEP))}</span>`;
  return escapeHtml(t('review.yourAnswer')).replace(ANSWER_SLOT, () => answer); // a function: no $-patterns in option text
}
function reviewItemHtml({ q, idx, userAns, isCorrect, flagged }) {
  const correctText = q.a.map(ai => q.o[ai]).join(ANSWER_SEP);
  const note = q.note ? `<div class="rv-note" lang="zh-HK"><div class="rv-note-label">${t('common.noteLabel')}</div>${noteHtml(q.note)}</div>` : '';
  return `<div class="review-item ${isCorrect ? 'rv-correct' : 'rv-wrong'}" id="rv${idx}">
      <div class="rv-q">${reviewIsPractice ? streakTagHtml(q) : ''}${idx + 1}. <span class="rv-q-text" lang="en">${escapeHtml(q.q)}</span>${flagged ? bookmarkSvg('rv-flag') : ''}</div>
      ${!isCorrect ? `<div class="rv-your">${yourAnswerHtml(q, userAns)}</div>` : ''}
      <div class="rv-correct-ans" lang="en">✅ ${escapeHtml(correctText)}</div>
      <div class="rv-tr"><div class="rv-yue" lang="zh-HK">${t('common.yueTitle')}${escapeHtml(q.yue)}</div>${note}</div>
    </div>`;
}
function reviewChipsHtml() {
  return REVIEW_FILTERS.map(f => {
    const n = reviewItems.filter(f.keep).length;
    const label = `${f.icon ? bookmarkSvg('chip-flag') : ''}${t(f.labelKey)} <b>${n}</b>`;
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
