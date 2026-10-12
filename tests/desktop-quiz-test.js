// v2.0.0 desktop layout, Quiz (handoff .proj-docs/plans/2026-10-12_handoff_desktop-layout.md §3 #8 / #9, §4 F4–F6, §5;
// mockups/v2.0.0/desktop-quiz.html A rev 12, desktop-exam.html C rev 3). At 1024 × 768 and 1280 × 800, EN / 中,
// small / large text, translation on / off:
// - one screen high: no sideways scroll, the page itself never scrolls
// - Practice: number dots in a bar across the top (24 in one row); left 7/12 question card + 2 × 2 options;
//   right 5/12 "💡 Answer | 🗺️ Similar Questions" tabs (F5, new key quiz.answerTab), a dashed slot before answering;
//   no bottom Prev / Next; the card's ← → always shown (F4)
// - Exam 1: left rail 3/12 (big timer, dots 6 × 4, counts, Submit on the last question, F6), the header timer hidden;
//   every one of the 24 questions fits without the options scrolling
// - below 1024px nothing moves (390px: the v1.4 order, dots in the card, bottom Prev / Next, header timer)
const dt = require('./desktop-helpers');
const { assert } = dt;

const EXAM_ONE = 1;
const QUESTIONS_PER_EXAM = 24;
const DOTS_PER_RAIL_ROW = 6;
const ANSWER_TAB = { en: 'Answer', 'zh-HK': '答案' };
const SUBMIT = { en: 'Submit', 'zh-HK': '提交' };

const visible = (page, sel) => page.evaluate(s => {
  const el = document.querySelector(s);
  return !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
}, sel);
const startSet = (page, mode, examNum) => page.evaluate(([m, n]) => { pendingMode = m; startExam(n); }, [mode, examNum]);
const answerCurrent = page => page.evaluate(() => {
  const i = state.current, q = state.questions[i];
  state.answers[i] = [...q.a];
  if (state.mode === 'practice') revealAnswer(); else renderQuestion();
});
// a practice question whose fact has other questions (the Similar tab has content)
const goToSimilarQuestion = page => page.evaluate(() => {
  const i = state.questions.findIndex(q => { const f = factOf(q); return f && similarGroups(q).length > 0; });
  if (i < 0) return false;
  goToQuestion(i);
  return true;
});
const rowTops = (page, sel) => page.$$eval(sel, els => [...new Set(els.map(e => Math.round(e.getBoundingClientRect().top)))].length);
const colLefts = (page, sel) => page.$$eval(sel, els => [...new Set(els.map(e => Math.round(e.getBoundingClientRect().left)))].length);

async function oneScreen(page, label, what) {
  const h = await dt.noHorizontalScroll(page);
  const v = await dt.pageNotScrolling(page);
  assert(h.ok && v.ok, `${label} ${what}: no sideways scroll (${h.detail}), the page does not scroll (${v.detail})`);
}

async function checkPractice(page, label, { lang, translation }) {
  await startSet(page, 'practice', EXAM_ONE);
  await oneScreen(page, label, 'practice, unanswered');
  const bar = await page.evaluate(() => {
    const dots = byId('navDots');
    return { inBar: !!dots.closest('.quiz-dots-bar'), inCard: !!dots.closest('.q-card'), meta: !!byId('dotsMeta').closest('.quiz-dots-bar') };
  });
  assert(bar.inBar && !bar.inCard && bar.meta, `${label}: practice dots + counts in the bar across the top, not in the card`);
  assert(await rowTops(page, '#navDots .dot') === 1, `${label}: the 24 dots sit in one row`);
  const optRows = await page.evaluate(() => Math.ceil(state.questions[state.current].o.length / 2)); // True / False: one row
  assert(await rowTops(page, '#optionsContainer .opt') === optRows && await colLefts(page, '#optionsContainer .opt') === 2, `${label}: options 2 × 2`);
  assert(await visible(page, '#quickNav') && await visible(page, '#quickPrev') && await visible(page, '#quickNext'), `${label}: F4 ← → shown before answering`);
  assert(await visible(page, '#yueToggle') === translation, `${label}: Translate beside them (translation ${translation ? 'on' : 'off'})`);
  assert(!(await visible(page, '#prevBtn')) && !(await visible(page, '#nextBtn')), `${label}: no bottom Prev / Next`);
  assert(await visible(page, '.quiz-empty-slot') && !(await visible(page, '.quiz-tabs')), `${label}: dashed slot on the right before answering, no tabs`);
  const slot = await page.evaluate(() => {
    const s = document.querySelector('.quiz-empty-slot').getBoundingClientRect(), col = document.querySelector('.quiz-main-wrap').getBoundingClientRect();
    return { bottom: Math.round(s.bottom), colBottom: Math.round(col.bottom), sLeft: s.left, colRight: col.right };
  });
  assert(Math.abs(slot.bottom - slot.colBottom) <= 1 && slot.sLeft > slot.colRight, `${label}: the slot fills the right column's height (${slot.bottom} / ${slot.colBottom})`);
  // ← → work before answering (F4: the only way besides the dots to skip a question)
  await page.click('#quickNext');
  assert(await page.evaluate(() => state.current === 1), `${label}: quick → moves on unanswered`);
  await page.click('#quickPrev');

  assert(await goToSimilarQuestion(page), `${label}: found a question with similar questions`);
  await answerCurrent(page);
  await oneScreen(page, label, 'practice, answered');
  assert(await visible(page, '.quiz-tabs') && !(await visible(page, '.quiz-empty-slot')), `${label}: answered → tabs, slot gone`);
  const tab = await page.evaluate(() => ({
    answer: byId('quizTabAnswer').textContent.trim(), sel: byId('quizTabAnswer').getAttribute('aria-selected'),
    similar: byId('quizTabSimilar').textContent, count: !!byId('quizTabSimilar').querySelector('.sqm-count'),
    subtitle: byId('quizTabSimilar').querySelector('small') && byId('quizTabSimilar').querySelector('small').textContent,
    t: [t('quiz.answerTab'), t('similar.title'), t('similar.subtitle')],
  }));
  assert(tab.answer.endsWith(ANSWER_TAB[lang]) && tab.t[0] === ANSWER_TAB[lang] && tab.sel === 'true', `${label}: F5 "💡 ${ANSWER_TAB[lang]}" tab open first`);
  assert(tab.similar.includes(tab.t[1]) && tab.subtitle === tab.t[2] && tab.count, `${label}: F5 the Similar tab carries title, subtitle and +n`);
  assert(await visible(page, '#answerBox') && !(await visible(page, '#similarBox')), `${label}: Answer pane shown, Similar pane hidden`);
  assert(!(await visible(page, '#similarBox .sqm-head')), `${label}: the Similar card's own header is not repeated`);
  const widths = await page.evaluate(() => {
    const bar = document.querySelector('.quiz-tabs').getBoundingClientRect(), box = byId('answerBox').getBoundingClientRect();
    return { bar: bar.width, box: box.width, l: bar.left - box.left };
  });
  assert(Math.abs(widths.bar - widths.box) <= 1 && Math.abs(widths.l) <= 1, `${label}: tab bar as wide as the box under it (${widths.bar} / ${widths.box})`);
  await page.click('#quizTabSimilar');
  assert(await visible(page, '#similarBox') && !(await visible(page, '#answerBox')), `${label}: the Similar tab swaps the pane`);
  assert(await page.$eval('#quizTabSimilar', e => e.getAttribute('aria-selected')) === 'true', `${label}: aria-selected follows`);
  await oneScreen(page, label, 'practice, Similar tab');
  const pane = await page.evaluate(() => {
    const p = byId('similarBox').closest('.fit-panel');
    return !!p && ['auto', 'scroll'].includes(getComputedStyle(p).overflowY) && !!p.closest('.fit-fade');
  });
  assert(pane, `${label}: each pane is its own fading scroll panel`);
  await page.click('#quizTabAnswer');
  assert(await visible(page, '#answerBox'), `${label}: back to the Answer tab`);
  // the next question opens on the Answer tab again
  await page.click('#quizTabSimilar');
  await page.evaluate(() => goToQuestion((state.current + 1) % state.questions.length));
  await answerCurrent(page);
  assert(await page.$eval('#quizTabAnswer', e => e.getAttribute('aria-selected')) === 'true', `${label}: a new question starts on the Answer tab`);
}

async function checkExam(page, label, { lang }) {
  await startSet(page, 'exam', EXAM_ONE);
  await oneScreen(page, label, 'exam');
  assert(!(await visible(page, '#examTimer')), `${label}: F6 the header timer is hidden`);
  const rail = await page.evaluate(() => ({
    big: document.querySelector('.exam-big-timer') && document.querySelector('.exam-big-timer').textContent,
    small: byId('examTimer').textContent, dotsInRail: !!byId('navDots').closest('.exam-rail'), metaInRail: !!byId('dotsMeta').closest('.exam-rail'),
  }));
  assert(rail.big && rail.big === rail.small && rail.dotsInRail && rail.metaInRail, `${label}: rail has the big timer (${rail.big}), the dots and the counts`);
  assert(await visible(page, '.exam-big-timer'), `${label}: the big timer is shown`);
  assert(await rowTops(page, '#navDots .dot') === QUESTIONS_PER_EXAM / DOTS_PER_RAIL_ROW && await colLefts(page, '#navDots .dot') === DOTS_PER_RAIL_ROW, `${label}: dots 6 × 4`);
  assert(await visible(page, '#quickNav') && !(await visible(page, '#nextBtn')), `${label}: ← → in the card, no bottom buttons`);
  const over = [];
  for (let i = 0; i < QUESTIONS_PER_EXAM; i++) {
    await page.evaluate(n => goToQuestion(n), i);
    const fit = await dt.fitsWithoutScroll(page, '.quiz-main');
    const v = await dt.pageNotScrolling(page);
    const h = await dt.noHorizontalScroll(page);
    if (!fit.ok || !v.ok || !h.ok) over.push(`Q${i + 1} ${fit.detail}`);
    const submit = await visible(page, '.exam-submit');
    if (submit !== (i === QUESTIONS_PER_EXAM - 1)) over.push(`Q${i + 1} submit ${submit}`);
  }
  assert(over.length === 0, `${label}: Exam 1 all 24 questions fit (options never scroll), Submit only on Q24` + (over.length ? ': ' + over.join(', ') : ''));
  assert((await page.$eval('.exam-submit', e => e.textContent.trim())) === SUBMIT[lang], `${label}: Submit reads "${SUBMIT[lang]}"`);
  await page.click('.exam-submit');
  assert(await page.evaluate(() => isConfirmOpen() && byId('confirmTitle').textContent === t('modal.submitTitle')), `${label}: Submit opens the submit confirm`);
  await page.click('#confirmCancel');
  assert(await page.evaluate(() => !isConfirmOpen() && byId('screenQuiz').classList.contains('active')), `${label}: Keep going stays on the exam`);
}

// the v1.4 order of the quiz screen below 1024px: a snapshot of where every id'd element sits
const quizOrder = page => page.evaluate(() => [...byId('screenQuiz').querySelectorAll('[id]')]
  .filter(e => !e.closest('.quiz-cols, .quiz-dots-bar'))
  .map(e => `${e.parentElement.id || e.parentElement.className}>${e.id}`).join(' '));

async function checkPhone(b) {
  const { page, errors } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.phone });
  await startSet(page, 'practice', EXAM_ONE);
  const before = await quizOrder(page);
  assert(await page.evaluate(() => !!byId('navDots').closest('.q-card')), '390px: dots stay in the question card');
  assert(!(await visible(page, '#quickNav')) && await visible(page, '#nextBtn') && !(await visible(page, '.quiz-cols')), '390px: v1.4 quiz (quick nav after answering, bottom buttons, no desktop columns)');
  await dt.setViewport(page, dt.VIEWPORTS.small);
  assert(await page.evaluate(() => !!byId('navDots').closest('.quiz-dots-bar')), '390 → 1024: the desktop layout takes over on resize');
  await answerCurrent(page);
  await dt.setViewport(page, dt.VIEWPORTS.phone);
  await page.evaluate(() => goToQuestion(0));
  assert(await quizOrder(page) === before, '1024 → 390: every element back in its v1.4 place');
  assert(await page.evaluate(() => getComputedStyle(byId('screenQuiz')).display) === 'block', '390px: the screen is a plain block again');
  await startSet(page, 'exam', EXAM_ONE);
  assert(await visible(page, '#examTimer') && !(await visible(page, '.exam-big-timer')) && await page.evaluate(() => !!byId('navDots').closest('.q-card')), '390px exam: header timer, dots in the card');
  await dt.setViewport(page, dt.VIEWPORTS.belowDesktop);
  assert(await visible(page, '#examTimer') && !(await visible(page, '.exam-rail')), '1023px exam: still the phone layout');
  assert(errors.length === 0, 'no page error: ' + errors.join(' | '));
  await page.close();
}

// S-228: moving the options across 1024px keeps keyboard focus where it was
async function checkFocusKept(b) {
  const { page, errors } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.belowDesktop });
  await startSet(page, 'practice', EXAM_ONE);
  await page.focus('#opt0');
  await dt.setViewport(page, dt.VIEWPORTS.wide);
  assert(await page.evaluate(() => document.activeElement && document.activeElement.id) === 'opt0' && await page.evaluate(() => !!byId('opt0').closest('.quiz-main')), 'S-228 1023 → 1280: #opt0 moved into the column and still has focus');
  await dt.setViewport(page, dt.VIEWPORTS.belowDesktop);
  assert(await page.evaluate(() => document.activeElement && document.activeElement.id) === 'opt0' && await page.evaluate(() => !byId('opt0').closest('.quiz-main')), 'S-228 1280 → 1023: back in its phone place, still focused');
  assert(errors.length === 0, 'no page error: ' + errors.join(' | '));
  await page.close();
}

// switching settings on an open quiz re-runs the fit (onRefit)
async function checkRefit(b) {
  const { page, errors } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.small });
  await startSet(page, 'exam', EXAM_ONE);
  await dt.applySettings(page, { lang: 'zh-HK', fontSize: 'large' });
  const fit = await dt.fitsWithoutScroll(page, '.quiz-main');
  assert(fit.ok, '1024 exam: still fits after ⚙ 中文 + large text: ' + fit.detail);
  await dt.setViewport(page, dt.VIEWPORTS.wide);
  assert((await dt.pageNotScrolling(page)).ok, '1024 → 1280 resize: still one screen');
  assert(errors.length === 0, 'no page error: ' + errors.join(' | '));
  await page.close();
}

(async () => {
  const b = await dt.launch();
  await dt.forEachCase(b, async ({ page, label, errors, lang, translation }) => {
    await checkPractice(page, label, { lang, translation });
    await checkExam(page, label, { lang });
    assert(errors.length === 0, `${label}: no page error ` + errors.join(' | '));
  });
  await checkPhone(b);
  await checkRefit(b);
  await checkFocusKept(b);
  await b.close();
  console.log('DESKTOP-QUIZ PASS');
})().catch(e => { console.error(e.message || e); process.exit(1); });
