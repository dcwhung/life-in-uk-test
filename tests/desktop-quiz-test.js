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
const EXAM_COUNT = 17;
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

// S-233: a phone never builds the desktop parts; the first desktop render builds and fills them (tabs included)
async function checkLazyDesk(b) {
  const { page, errors } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.phone });
  await startSet(page, 'practice', EXAM_ONE);
  assert(await goToSimilarQuestion(page), '390px: found a question with similar questions');
  await answerCurrent(page);
  await page.evaluate(() => goToQuestion(state.current)); // a few more renders
  assert(await page.evaluate(() => !document.querySelector('.quiz-cols, .quiz-dots-bar, #quizTabAnswer')), 'S-233 390px: no desktop quiz parts built on the phone');
  await dt.setViewport(page, dt.VIEWPORTS.wide);
  const tab = await page.evaluate(() => ({ text: byId('quizTabAnswer').textContent.trim(), sel: byId('quizTabAnswer').getAttribute('aria-selected'), similar: !byId('quizTabSimilar').hidden && byId('quizTabSimilar').textContent.length > 0 }));
  assert(tab.text.endsWith(ANSWER_TAB.en) && tab.sel === 'true' && tab.similar && await visible(page, '.quiz-tabs'), 'S-233 390 → 1280: the desktop parts are built and filled on the first desktop refit: ' + JSON.stringify(tab));
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

// W-378: Answer / Similar is a full ARIA tab pattern (← → wrap, Home, End; roving tabindex)
async function checkTabKeys(b) {
  const { page, errors } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.wide });
  await startSet(page, 'practice', EXAM_ONE);
  assert(await goToSimilarQuestion(page), 'found a question with similar questions');
  await answerCurrent(page);
  const tabState = () => page.evaluate(() => ['quizTabAnswer', 'quizTabSimilar'].map(id => {
    const el = byId(id);
    return `${el.getAttribute('aria-selected')}/${el.tabIndex}${document.activeElement === el ? '*' : ''}`;
  }).join(' '));
  assert(await tabState() === 'true/0 false/-1', 'W-378: roving tabindex, the chosen tab 0, the other -1: ' + await tabState());
  await page.focus('#quizTabAnswer');
  await page.keyboard.press('ArrowRight');
  assert(await tabState() === 'false/-1 true/0*' && await visible(page, '#similarBox'), 'W-378 → moves to Similar, selects it and focuses it: ' + await tabState());
  await page.keyboard.press('ArrowRight');
  assert(await tabState() === 'true/0* false/-1' && await visible(page, '#answerBox'), 'W-378 → on the last tab wraps to Answer: ' + await tabState());
  await page.keyboard.press('ArrowLeft');
  assert(await tabState() === 'false/-1 true/0*', 'W-378 ← on the first tab wraps to Similar: ' + await tabState());
  await page.keyboard.press('Home');
  assert(await tabState() === 'true/0* false/-1', 'W-378 Home: Answer: ' + await tabState());
  await page.keyboard.press('End');
  assert(await tabState() === 'false/-1 true/0*', 'W-378 End: Similar: ' + await tabState());
  // a question without similar questions: one tab, arrows stay on it
  await page.evaluate(() => {
    const i = state.questions.findIndex((q, n) => !(n in state.revealed) && !(factOf(q) && similarGroups(q).length));
    goToQuestion(i);
    const q = state.questions[i];
    state.answers[i] = [...q.a];
    revealAnswer();
  });
  if (await page.evaluate(() => byId('quizTabSimilar').hidden)) {
    await page.focus('#quizTabAnswer');
    await page.keyboard.press('ArrowRight');
    assert(await tabState() === 'true/0* false/-1', 'W-378 a lone Answer tab keeps focus on → : ' + await tabState());
  }
  assert(errors.length === 0, 'no page error: ' + errors.join(' | '));
  await page.close();
}

// S-231: the rail's Submit is the card's ✓ on the last question: label and title from nextAction()
async function checkSubmitLabel(b) {
  const { page, errors } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.wide });
  await startSet(page, 'exam', EXAM_ONE);
  const r = await page.evaluate(() => {
    const real = nextAction;
    window.nextAction = (idx, total) => (idx === total - 1 ? { ...real(idx, total), label: 'Hand in', title: 'Hand in the paper' } : real(idx, total));
    goToQuestion(state.questions.length - 1);
    const submit = document.querySelector('.exam-submit');
    const out = { text: submit.textContent.trim(), title: submit.title, quick: byId('quickNext').title };
    window.nextAction = real;
    goToQuestion(state.questions.length - 1);
    return out;
  });
  assert(r.text === 'Hand in' && r.title === 'Hand in the paper' && r.quick === r.title, 'S-231: rail Submit label / title follow nextAction() like the card ✓: ' + JSON.stringify(r));
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

// v2.0.1: the desktop panes are built once and kept from question to question, so a new question must open each
// pane at the top (not where the last question's pane was scrolled to); within one question a tab swap keeps each
// pane's own scroll. ← → (the card's quick buttons) and the number dots both count as a new question
const PANE = { answer: '#quizPaneAnswer', similar: '#quizPaneSimilar', main: '.quiz-main' };
// which questions overflow each pane once answered (and the main column before answering); leaves them unanswered
const probeOverflow = page => page.evaluate(() => {
  const over = el => el.scrollHeight > el.clientHeight + 1;
  const out = state.questions.map((q, i) => {
    goToQuestion(i);
    const main = over(document.querySelector('.quiz-main'));
    state.answers[i] = [...q.a];
    revealAnswer();
    const answer = over(byId('quizPaneAnswer'));
    let similar = false;
    if (!byId('quizTabSimilar').hidden) {
      setQuizTab('similar');
      similar = over(byId('quizPaneSimilar'));
      setQuizTab('answer');
    }
    delete state.answers[i];
    delete state.revealed[i];
    return { main, answer, similar };
  });
  goToQuestion(0);
  return out;
});
// two different questions that both overflow `pane`, the second right after the first when `adjacent` (for →)
function pickPair(probe, pane, used, adjacent) {
  const ok = i => i >= 0 && i < probe.length && probe[i][pane] && !used.has(i);
  for (let i = 0; i < probe.length; i++) {
    if (!ok(i)) continue;
    const j = adjacent ? (ok(i + 1) ? i + 1 : -1) : probe.findIndex((_, n) => n !== i && n !== i + 1 && ok(n));
    if (j >= 0) { used.add(i).add(j); return [i, j]; }
  }
  return null;
}
const scrollToBottom = async (page, sel) => {
  await page.$eval(sel, el => { el.scrollTop = el.scrollHeight; });
  await dt.nextFrame(page);
};
// halfway (not the bottom: the panel's height may change by a few px between tabs, which would move a bottom position)
const scrollToMiddle = async (page, sel) => {
  await page.$eval(sel, el => { el.scrollTop = Math.floor((el.scrollHeight - el.clientHeight) / 2); });
  await dt.nextFrame(page);
};
const paneState = (page, sel) => page.$eval(sel, el => {
  const wrap = el.closest('.fit-fade');
  return { top: Math.round(el.scrollTop), up: wrap.classList.contains('can-up'), down: wrap.classList.contains('can-down'), over: el.scrollHeight > el.clientHeight + 1 };
});
async function goTo(page, from, to, how) {
  if (how === 'quick') { assert(to === from + 1, 'quick → goes to the next question'); await page.click('#quickNext'); }
  else await page.locator('#navDots .dot').nth(to).click();
  assert(await page.evaluate(n => state.current === n, to), `moved to Q${to + 1} by ${how === 'quick' ? '→' : 'the number dot'}`);
}

async function checkPaneTopOnNewQuestion(b, viewport) {
  const { page, errors, label } = await dt.openDesktop(b, { viewport, lang: 'zh-HK', fontSize: 'large' });
  await startSet(page, 'practice', EXAM_ONE);
  const probe = await probeOverflow(page);
  const used = new Set();
  for (const [pane, how] of [['answer', 'quick'], ['answer', 'dot'], ['similar', 'quick'], ['similar', 'dot']]) {
    const pair = pickPair(probe, pane, used, how === 'quick') || pickPair(probe, pane, new Set(), how === 'quick');
    assert(pair, `${label}: two questions whose ${pane} pane scrolls (${how})`);
    const [from, to] = pair;
    const sel = PANE[pane];
    await page.evaluate(i => { delete state.answers[i]; delete state.revealed[i]; goToQuestion(i); }, from);
    await answerCurrent(page);
    if (pane === 'similar') await page.click('#quizTabSimilar');
    await scrollToBottom(page, sel);
    const before = await paneState(page, sel);
    assert(before.top > 0 && before.up, `${label}: Q${from + 1} ${pane} pane scrolled down (${before.top}px, can-up)`);
    await page.evaluate(i => { delete state.answers[i]; delete state.revealed[i]; }, to);
    await goTo(page, from, to, how);
    await answerCurrent(page);
    if (pane === 'similar') await page.click('#quizTabSimilar');
    await dt.nextFrame(page);
    const after = await paneState(page, sel);
    assert(after.top === 0 && !after.up && after.down === after.over,
      `${label}: v2.0.1 Q${from + 1} → Q${to + 1} (${how === 'quick' ? '→' : 'dot'}), answered: the ${pane} pane starts at the top, fades follow: ${JSON.stringify(after)}`);
  }
  // within one question a tab swap keeps each pane's scroll (setQuizTab does not re-render)
  const i = probe.findIndex(p => p.answer && p.similar);
  assert(i >= 0, `${label}: a question whose Answer and Similar panes both scroll`);
  await page.evaluate(n => { delete state.answers[n]; delete state.revealed[n]; goToQuestion(n); }, i);
  await answerCurrent(page);
  await scrollToMiddle(page, PANE.answer);
  const kept = (await paneState(page, PANE.answer)).top;
  await page.click('#quizTabSimilar');
  await scrollToMiddle(page, PANE.similar);
  const keptSimilar = (await paneState(page, PANE.similar)).top;
  await page.click('#quizTabAnswer');
  await dt.nextFrame(page);
  const back = await paneState(page, PANE.answer);
  assert(kept > 0 && Math.abs(back.top - kept) <= 1 && back.up, `${label}: same question, Answer → Similar → Answer keeps the Answer pane at ${kept}px (${back.top})`);
  await page.click('#quizTabSimilar');
  await dt.nextFrame(page);
  const backSimilar = await paneState(page, PANE.similar);
  assert(keptSimilar > 0 && Math.abs(backSimilar.top - keptSimilar) <= 1, `${label}: same question, the Similar pane keeps ${keptSimilar}px (${backSimilar.top})`);
  assert(errors.length === 0, 'no page error: ' + errors.join(' | '));
  await page.close();
}

// CUI-0033 (v2.0.2, option A): any new question starts every pane at the top, even when the pane stayed hidden on the
// question in between. Q1 answered, pane scrolled → an unanswered question (the pane hidden there) → back: the pane is
// at 0, the same as via an answered question (QA E1)
async function checkPaneTopAfterReturn(b, viewport) {
  const { page, errors, label } = await dt.openDesktop(b, { viewport, lang: 'zh-HK', fontSize: 'large' });
  await startSet(page, 'practice', EXAM_ONE);
  const probe = await probeOverflow(page);
  for (const pane of ['answer', 'similar']) {
    const from = probe.findIndex(p => p[pane]);
    assert(from >= 0, `${label}: a question whose ${pane} pane scrolls`);
    const via = (from + 2) % probe.length;
    const sel = PANE[pane];
    for (const answeredVia of [false, true]) {
      await page.evaluate(([i, v]) => {
        [i, v].forEach(n => { delete state.answers[n]; delete state.revealed[n]; });
        goToQuestion(i);
      }, [from, via]);
      await answerCurrent(page);
      if (pane === 'similar') await page.click('#quizTabSimilar');
      await scrollToBottom(page, sel);
      const before = await paneState(page, sel);
      assert(before.top > 0 && before.up, `${label}: Q${from + 1} ${pane} pane scrolled down (${before.top}px, can-up)`);
      await goTo(page, from, via, 'dot');
      if (answeredVia) await answerCurrent(page);
      // the right column shows (answered) or hides (unanswered) on the question in between
      assert(await visible(page, '.quiz-tabs') === answeredVia && await visible(page, PANE.answer) === answeredVia,
        `${label}: Q${via + 1} ${answeredVia ? 'answered, the panes shown' : 'unanswered, the panes hidden'}`);
      await goTo(page, via, from, 'dot');
      if (pane === 'similar') await page.click('#quizTabSimilar');
      await dt.nextFrame(page);
      const after = await paneState(page, sel);
      assert(after.top === 0 && !after.up && after.down === after.over,
        `${label}: CUI-0033 Q${from + 1} → Q${via + 1} (${answeredVia ? 'answered' : 'unanswered'}) → Q${from + 1}: the ${pane} pane starts at the top: ${JSON.stringify(after)}`);
    }
  }
  assert(errors.length === 0, 'no page error: ' + errors.join(' | '));
  await page.close();
}

// the left column scrolls only after fit step ③ (1024 × 600, 中文, large text): a new question starts it at the top
async function checkMainTopOnNewQuestion(b) {
  const { page, errors, label } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.tiny, lang: 'zh-HK', fontSize: 'large' });
  await startSet(page, 'practice', EXAM_ONE);
  const probe = await probeOverflow(page);
  const longs = probe.map((p, i) => p.main && i).filter(i => i !== false);
  assert(longs.length > 0, `${label}: a question whose left column scrolls (${longs.map(i => 'Q' + (i + 1)).join(' ')})`);
  for (const how of ['quick', 'dot']) {
    // S-245: → only proves the reset when the next question is long too (a short one starts at 0 anyway)
    const from = how === 'quick' ? longs.find(i => longs.includes(i + 1)) : longs[0];
    if (from === undefined) { console.log(`skip: ${label}: no two long questions in a row (→)`); continue; }
    // the dot goes to another long question when there is one, else to any other question
    const to = how === 'quick' ? from + 1 : (longs.find(i => i !== from) ?? (from + 2) % probe.length);
    await page.evaluate(n => goToQuestion(n), from);
    await scrollToBottom(page, PANE.main);
    const before = await paneState(page, PANE.main);
    assert(before.top > 0 && before.up, `${label}: Q${from + 1} left column scrolled down (${before.top}px)`);
    await goTo(page, from, to, how);
    await dt.nextFrame(page);
    const after = await paneState(page, PANE.main);
    assert(after.top === 0 && !after.up && after.down === after.over,
      `${label}: Q${from + 1} → Q${to + 1} (${how === 'quick' ? '→' : 'dot'}${probe[to].main ? ', also long' : ''}): the left column starts at the top: ${JSON.stringify(after)}`);
  }
  assert(errors.length === 0, 'no page error: ' + errors.join(' | '));
  await page.close();
}

// CUI-0034 (v2.0.3): answering re-renders the same question (options, feedback, the card header's Translate → ← →) and
// refits the left column; what the user was looking at must not move. Every question of the set whose left column
// scrolls before answering (the set is fixed, only its order is random), scrolled to the bottom and to the middle:
// the first element in view (the question text, else an option) stays within 2px, unless the column can no longer
// scroll that far (then it sits at the end it hit)
const mainView = page => page.$eval(PANE.main, main => {
  const top = main.getBoundingClientRect().top;
  const els = [byId('qText'), ...byId('optionsContainer').querySelectorAll('.opt')];
  const first = els.find(el => el.getBoundingClientRect().bottom > top + 1) || els[0];
  return { st: main.scrollTop, max: main.scrollHeight - main.clientHeight, id: first.id, y: first.getBoundingClientRect().top };
});
const elementTop = (page, id) => page.$eval('#' + id, el => el.getBoundingClientRect().top);
// unanswered questions whose left column scrolls, with the question's translation shown (Translate) or not
// measured a frame after each render, as the user sees it (1280 × 720 with Translate on overflows only mid-render)
async function mainLongs(page, translate) {
  const longs = [];
  const n = await page.evaluate(() => state.questions.length);
  for (let i = 0; i < n; i++) {
    await page.evaluate(([k, tr]) => { state.yueShown[k] = tr; goToQuestion(k); }, [i, translate]);
    await dt.nextFrame(page);
    if (await page.$eval(PANE.main, el => el.scrollHeight > el.clientHeight + 1)) longs.push(i);
  }
  return longs;
}
async function checkMainKeptOnAnswer(b, viewport, lang, { translate = false } = {}) {
  const { page, errors, label } = await dt.openDesktop(b, { viewport, lang, fontSize: 'large' });
  // the first of Exam 1–17 with such a question
  let longs = [], exam = 0;
  while (!longs.length && exam < EXAM_COUNT) {
    await startSet(page, 'practice', ++exam);
    longs = await mainLongs(page, translate);
  }
  const how = translate ? ', Translate on' : '';
  assert(longs.length > 0, `${label}${how}: Exam ${exam}: a question whose left column scrolls before answering (${longs.map(i => 'Q' + (i + 1)).join(' ')})`);
  for (const i of longs) {
    for (const where of ['bottom', 'middle']) {
      await page.evaluate(n => { delete state.answers[n]; delete state.revealed[n]; goToQuestion(n); }, i);
      if (where === 'bottom') await scrollToBottom(page, PANE.main); else await scrollToMiddle(page, PANE.main);
      const before = await mainView(page);
      assert(before.st > 0, `${label}: Q${i + 1} left column scrolled to the ${where} (${before.st}px)`);
      // a DOM click: page.click would first scroll the option into view, which is not what is being measured
      await page.evaluate(() => state.questions[state.current].a.forEach(oi => byId('opt' + oi).click()));
      await dt.nextFrame(page);
      assert(await page.evaluate(() => state.current in state.revealed), `${label}: Q${i + 1} answered`);
      const st = await page.$eval(PANE.main, el => el.scrollTop), max = await page.$eval(PANE.main, el => el.scrollHeight - el.clientHeight);
      const moved = (await elementTop(page, before.id)) - before.y;
      const wanted = st + moved; // the scroll that would put the element back where it was
      const clamped = (wanted > max + 1 && st >= max - 1) || (wanted < -1 && st <= 1);
      const fade = await paneState(page, PANE.main);
      assert((Math.abs(moved) <= 2 || clamped) && fade.up === st > 1 && fade.down === st < max - 1,
        `${label}${how}: CUI-0034 Q${i + 1} scrolled to the ${where} (${before.st}/${before.max}px), answered: #${before.id} moved ${moved.toFixed(1)}px (scroll ${st}/${max}${clamped ? ', clamped' : ''}, fades ${fade.up}/${fade.down})`);
    }
  }
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
  await checkLazyDesk(b);
  await checkFocusKept(b);
  await checkTabKeys(b);
  await checkSubmitLabel(b);
  await checkPaneTopOnNewQuestion(b, dt.VIEWPORTS.wide);
  await checkPaneTopOnNewQuestion(b, dt.VIEWPORTS.small);
  await checkPaneTopAfterReturn(b, dt.VIEWPORTS.small);
  await checkPaneTopAfterReturn(b, dt.VIEWPORTS.wide);
  await checkMainTopOnNewQuestion(b);
  await checkMainKeptOnAnswer(b, dt.VIEWPORTS.tiny, 'en');
  await checkMainKeptOnAnswer(b, dt.VIEWPORTS.tiny, 'zh-HK');
  await checkMainKeptOnAnswer(b, dt.VIEWPORTS.short, 'en', { translate: true }); // 1280 × 720: only with Translate on
  await b.close();
  console.log('DESKTOP-QUIZ PASS');
})().catch(e => { console.error(e.message || e); process.exit(1); });
