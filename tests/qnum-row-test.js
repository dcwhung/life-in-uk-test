// v2.0.5 (proposal: 題號行方案 Y, user 2026-10-13): the question card's top row keeps "Question n of N" and the stars on
// one line before and after answering, so the question text never moves when an answer is given. Translate (before
// answering) and the quick ← → (after answering; always on desktop, F4) share that row: wherever either state would
// push the stars (or the counter) onto a second line, both states use the short counter (quiz.questionOfShort).
// Per case, every question of Exam 1 in practice: unanswered, Translate pressed, answered:
// - #qText's offset below the row's top (less the row's margin) changes by ≤ 0.5px
// - the counter is one line and the stars sit on that line
// - where there is room (1280 × 800), the full counter stays
// (Translate pressed is checked too; a question where even the short counter cannot fit is logged, not failed: C3)
const dt = require('./desktop-helpers');
const { assert } = dt;

const EXAM_ONE = 1;
const MOVE_SLACK_PX = 0.5;
const CASES = [
  { viewport: dt.VIEWPORTS.tiny, lang: 'en', translation: true },
  { viewport: dt.VIEWPORTS.phone, lang: 'en', translation: false },
  { viewport: dt.VIEWPORTS.phone, lang: 'en', translation: true },
  { viewport: dt.VIEWPORTS.wide, lang: 'en', translation: true, full: true },
  { viewport: dt.VIEWPORTS.tiny, lang: 'zh-HK', translation: true },
  { viewport: dt.VIEWPORTS.phone, lang: 'zh-HK', translation: true },
];

// the row as drawn now: #qText below the row's top, the counter's lines, the stars against the counter's line
const rowState = page => page.evaluate(() => {
  const counter = document.querySelector('#qNum > span[data-full]');
  const stars = document.querySelector('#qNum > .stars');
  const rowEl = document.querySelector('.q-num');
  const c = counter.getBoundingClientRect(), s = stars.getBoundingClientRect();
  return {
    // less the row's margin: on a short desktop fitQuiz's .is-compact (tighter gaps once the answer adds content)
    // narrows it, which is the column fitting, not the row; what this guards is the row's own height
    offset: byId('qText').getBoundingClientRect().top - rowEl.getBoundingClientRect().top - parseFloat(getComputedStyle(rowEl).marginBottom),
    counterLines: textLineCount(counter),
    starsOnCounterLine: s.top < c.bottom && s.bottom > c.top,
    full: counter.textContent === counter.dataset.full,
    text: counter.textContent,
  };
});

async function checkCase(b, { viewport, lang, translation, full }) {
  const { page, errors, label } = await dt.openDesktop(b, { viewport, lang, fontSize: 'large', translation });
  await page.evaluate(n => { pendingMode = 'practice'; startExam(n); }, EXAM_ONE);
  const count = await page.evaluate(() => state.questions.length);
  const misses = [], overflows = [];
  let fullCount = 0;
  for (let i = 0; i < count; i++) {
    await page.evaluate(n => { delete state.answers[n]; delete state.revealed[n]; delete state.yueShown[n]; goToQuestion(n); }, i);
    await dt.nextFrame(page);
    const states = [['unanswered', await rowState(page)]];
    if (translation) {
      await page.evaluate(() => toggleQuestionYue());
      await dt.nextFrame(page);
      states.push(['Translate pressed', await rowState(page)]);
    }
    await page.evaluate(() => { const q = state.questions[state.current]; state.answers[state.current] = [...q.a]; revealAnswer(); });
    await dt.nextFrame(page);
    states.push(['answered', await rowState(page)]);
    const [, first] = states[0];
    const wraps = st => st.counterLines !== 1 || !st.starsOnCounterLine;
    // C3: where even the short counter cannot share the row with Translate / "Hide translation" the stars keep
    // wrapping (they never disappear) and the row can change height; logged for the report, not a fail
    const overflowing = states.filter(([, st]) => !st.full && wraps(st)).map(([what]) => what);
    if (overflowing.length) {
      overflows.push(`Q${i + 1} (${overflowing.join(', ')})`);
      if (states.some(([, st]) => st.full)) misses.push(`Q${i + 1}: full counter in one state, short in another`);
      continue;
    }
    states.forEach(([what, st]) => {
      if (wraps(st)) misses.push(`Q${i + 1} ${what}: "${st.text}" ${st.counterLines} line(s), stars ${st.starsOnCounterLine ? 'on' : 'below'} its line`);
      if (Math.abs(st.offset - first.offset) > MOVE_SLACK_PX) misses.push(`Q${i + 1} ${what}: #qText moved ${(st.offset - first.offset).toFixed(1)}px`);
      if (st.full !== first.full) misses.push(`Q${i + 1} ${what}: counter "${st.text}" (was "${first.text}")`);
    });
    if (first.full) fullCount++;
  }
  assert(misses.length === 0, `${label}: counter + stars on one line before / after answering, #qText still (${misses.slice(0, 4).join(' | ') || count + ' questions'})`);
  if (overflows.length) console.log(`note: ${label}: even the short counter wraps the stars on ${overflows.length} question(s): ${overflows.join(' ')}`);
  if (full) assert(fullCount === count, `${label}: room for the full counter on all ${count} questions (${fullCount})`);
  assert(errors.length === 0, 'no page error: ' + errors.join(' | '));
  await page.close();
}

(async () => {
  const b = await dt.launch();
  for (const c of CASES) await checkCase(b, c);
  await b.close();
  console.log('QNUM-ROW PASS');
})().catch(e => { console.error(e.message || e); process.exit(1); });
