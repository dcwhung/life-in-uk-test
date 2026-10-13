// ════════════════════════════════════════
// RESULTS — score + verdict, result dots, By Difficulty table, Review Answers (All / Wrong / Flagged)
// ════════════════════════════════════════
const MODE_ICONS = { [PRACTICE_MODE]: '📝', [EXAM_MODE]: '🎯' }; // v0.71: swapped (user request)
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
  desktopRefit('screenResult', fitResult); // the screen is shown only now: measure it again
}
// draws the results from reviewItems without recording anything (also used to re-render on a language change)
function renderResults() {
  renderScore(reviewItems.filter(r => r.isCorrect).length, reviewItems.length);
  renderResultActions();
  renderResultPlanRow(); // a study plan mock: task done / retake as a Random Exam (js/screens/planRun.js)
  setExamLabel(byId('resultLabel'), state.examNum);
  byId('diffTable').innerHTML = diffTableHtml();
  renderResultDots();
  renderReview();
  arrangeResult(deskOn());
  desktopRefit('screenResult', fitResult);
}
function recordExamResults() {
  // practice adds wrong answers as it goes; exam adds the answered-but-wrong ones here (unanswered are not added)
  if (state.mode === EXAM_MODE) reviewItems.forEach(r => { if (r.userAns.length && !r.isCorrect) addWrong(r.q); });
  if (isNumberedExam(state.examNum)) markExamCompleted(state.examNum);
  recordPlanExam();
}
// G10 / G22: a submitted Exam 1-17 or Random Exam in Exam mode is a mock attempt; its answers never count for
// practice tasks. Leave never gets here (G15).
function recordPlanExam() {
  if (isPlanPlainRetake()) return; // G39: Retry after a passed plan mock is a plain retake, never a plan attempt
  const isRealTest = state.mode === EXAM_MODE && (isNumberedExam(state.examNum) || isRandomExam(state.examNum));
  const correct = reviewItems.filter(r => r.isCorrect).length;
  planNoteMockRecorded(recordPlanMock({ examNum: state.examNum, correct, total: reviewItems.length, isRealTest }, state.planDay || null));
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
    // W-047: left = distinct questions (copies of one text are one question, cleared together)
    return t('result.clearedNote', { n: state.cleared, left: questionGroups(keysOf(wrongList)).length });
  }
  if (state.examNum === SIMILAR_EXAM || !state.setPool) return '';
  const m = masteryOf(state.setPool), asked = masteryOf(state.questions).mastered; // n: asked this round only
  return t('result.masteredNote', {
    n: Math.max(0, asked - state.masteredBefore), mastered: m.mastered, total: m.total, set: examLabel(state.examNum),
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
    [['lg-ok', t('common.correct'), count(r => r.isCorrect)], ['lg-skip', t('common.unanswered'), count(r => !r.userAns.length)]],
    [['lg-bad', t('common.wrong'), count(r => !r.isCorrect && r.userAns.length)], ['lg-flag', t('common.flagged'), count(r => r.flagged)]],
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
  if (typeof refreshFades === 'function') refreshFades(byId('screenResult')); // v2.0.0 desktop: the list panel's fades
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
// v2.2.0: the note in the UI language (localNote); the 💡 label reads with the note (S-048)
function noteReviewHtml(note) {
  const local = localNote(note);
  return `<div class="rv-note" lang="${local.lang}"><div class="rv-note-label">${t('common.noteLabel')}</div>${noteHtml(local.text, local.lang)}</div>`;
}
function reviewItemHtml({ q, idx, userAns, isCorrect, flagged }) {
  const correctText = q.a.map(ai => q.o[ai]).join(ANSWER_SEP);
  const note = q.note ? noteReviewHtml(q.note) : '';
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

// ── v2.0.0 desktop (≥ 1024px): mockups/v2.0.0/desktop-result.html A rev 5 (helpers in js/components/deskPlace.js) ──
// left 5/12: the score card with Retry / Another inside it, then By difficulty at the bottom (never scrolls);
// right 7/12: Review Answers, the list in a fading scroll panel. The second button row (below the list) is not
// shown: the card's pair stays in view
let resultDesk = null; // built on the first desktop render (S-238, as the quiz's S-233: never on a phone)
function buildResultDesk() {
  const screen = byId('screenResult');
  const [diffTitle, reviewTitle] = screen.querySelectorAll(':scope > .section-title');
  const moved = {
    card: screen.querySelector('.result-card'), diffTitle, diff: byId('diffTable'), actions: screen.querySelector('.result-actions'),
    reviewTitle, order: byId('reviewOrder'), list: byId('reviewList'),
  };
  Object.values(moved).forEach(deskRemember);
  const d = {
    moved, cols: deskEl('div', 'result-cols'), left: deskEl('div', 'result-left fit-panel'), right: deskEl('div', 'result-right'),
    // C-006: the left column's fade wrapper (step ④ only: until then the column never scrolls)
    leftWrap: deskEl('div', 'result-left-wrap fit-fade'),
    listWrap: deskEl('div', 'result-review-wrap fit-fade'), panel: deskEl('div', 'result-review-panel fit-panel'),
  };
  d.leftWrap.append(d.left);
  d.listWrap.append(d.panel);
  d.cols.append(d.leftWrap, d.right);
  d.cols.hidden = true;
  deskHome(moved.card).before(d.cols); // where the card starts on the phone (under the time-up line)
  screen.classList.add('is-fit'); // css/components/fit.css: one screen high from 1024px only
  return d;
}
function arrangeResult(desktop) {
  if (!desktop && !resultDesk) return; // S-238: a phone that never was desktop has nothing to put back
  const d = resultDesk || (resultDesk = buildResultDesk()), m = d.moved;
  d.cols.hidden = !desktop;
  // S-228: focus back once every box is in the document
  deskKeepFocus(() => {
    if (!desktop) { deskRestore(Object.values(m)); return; }
    // the card's last child (mockup: inside the card, after the plan row); left alone when already there (focus)
    if (m.card.lastElementChild !== m.actions) m.card.append(m.actions);
    deskFill(d.left, [m.card, m.diffTitle, m.diff]);
    deskFill(d.panel, [m.list]);
    deskFill(d.right, [m.reviewTitle, m.order, d.listWrap]);
  });
}
// mockup fitLeft(): the left column and the card must not scroll. ① smaller score, closer By difficulty rows →
// ② tighter card gaps → ③ smaller emoji / score (1024px English large text) → ④ (C-006: a short laptop window,
// 1366 × 657, or 1024 × 600) still too tall: the card stops clipping and grows to its content, and the left column
// scrolls with fades, so Retry / Another (inside the card, mockup rev 5) can always be scrolled to and focused
const RESULT_FIT_STEPS = ['is-compact', 'is-compact2', 'is-compact3'];
const RESULT_SCROLL_STEP = 'is-scroll';
function fitResult(desktop) {
  arrangeResult(desktop);
  if (!resultDesk) return; // S-238: nothing built yet, nothing to fit
  const { left, leftWrap, moved: { card } } = resultDesk;
  // the card clips (overflow hidden) until step ④: measure it too (S-229)
  fitSteps(left, [...RESULT_FIT_STEPS, [leftWrap, RESULT_SCROLL_STEP]], { measure: () => overflowsY(left) || overflowsY(card) });
}

function retryExam() {
  if (isPlanMock() || isPlanPlainRetake()) { planRetryMock(); return; } // G11 / G39: Exam mode, never Home's pendingMode
  startExam(state.examNum);
}
