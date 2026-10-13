// v2.0.5 (proposal: 題號行方案 Y, then C3, user 2026-10-13): the question card's top row keeps the counter and the stars
// on one line before and after answering, so the question text never moves when an answer is given. Translate (before
// answering; "Hide" once pressed) and the quick ← → (after answering; always on desktop, F4) share that row. The
// counter is fitted against every state the question goes through, tier by tier: full "Question n of N"
// (quiz.questionOf) → short "Question n/N" (quiz.questionOfShort) → tiny "Q n/N" (quiz.questionOfTiny); the first one
// that stays on one line in all states is used in all of them.
// Per case, every question of Exam 1 in practice (or an exam): unanswered, Translate pressed, answered:
// - the counter is one line and the stars sit on that line (C3: no question may wrap, user; at 320 large text the
//   known exceptions below, user 2026-10-13)
// - #qText's offset below the row's top (less the row's margin) changes by ≤ 0.5px
// - where there is room (1280 × 800), the full counter stays
// Also: the pressed Translate button reads "Hide" (中文 "隱藏", W-071) and keeps its full name for assistive tech, and the
// counter is re-fitted on a resize, a language / text size / translation switch.
const dt = require('./desktop-helpers');
const { assert } = dt;

const EXAM_ONE = 1;
const MOVE_SLACK_PX = 0.5;
const ORDER_SEED = 20261013;
// phone sizes below the 390 one the desktop helpers know: the smallest phone (iPhone SE 1st gen) and a common Android
const SMALLEST = { width: 320, height: 568 };
const ANDROID = { width: 360, height: 640 };
// W-071 / S-256 (user 2026-10-13 accepted 320 large text as an exception): at 320 × 568 in large text some questions
// cannot keep the stars on the counter's line in every state, even with the tiny counter and the short "Hide" / 隱藏:
// - English, translation on: all of them, before Translate is pressed (the "Translate" button is the widest control)
// - 中文: a few, once answered (the quick ← →) or throughout an exam; which ones follows their stars and their number
//   ("14/24 題" is wider than "4/24 題")
// knownWrap locks them in by question key (qKey "exam.origIdx"); practice order is seeded (ORDER_SEED) so each key keeps
// its number from run to run. A wrap outside the list fails; a listed question that no longer wraps is only logged (the
// list can be narrowed). 'all': any question may wrap. A listed question may only have its stars drop below the
// counter (and #qText move with them); the counter itself stays one line and the same in every state.
// Taken from a run of this suite at v2.0.5 with 中文 "隱藏" (W-071; "隱藏翻譯" wrapped all 24 中文 questions)
const KNOWN_EN = 'all'; // user 2026-10-13: 320 exception accepted
const KNOWN_ZH = ['1.0', '1.1', '1.9', '1.10', '1.20']; // Q20, Q24, Q23, Q14, Q22 in the seeded order; translation on or off
const KNOWN_ZH_EXAM = ['1.13', '1.19', '1.21', '1.22', '1.23']; // exam order: Q14, Q20, Q22, Q23, Q24
const CASES = [
  { viewport: dt.VIEWPORTS.tiny, lang: 'en', fontSize: 'large', translation: true },
  { viewport: dt.VIEWPORTS.phone, lang: 'en', fontSize: 'large', translation: false },
  { viewport: dt.VIEWPORTS.phone, lang: 'en', fontSize: 'large', translation: true },
  { viewport: dt.VIEWPORTS.phone, lang: 'en', fontSize: 'small', translation: true },
  { viewport: dt.VIEWPORTS.wide, lang: 'en', fontSize: 'large', translation: true, full: true },
  { viewport: dt.VIEWPORTS.tiny, lang: 'zh-HK', fontSize: 'large', translation: true },
  { viewport: dt.VIEWPORTS.phone, lang: 'zh-HK', fontSize: 'large', translation: true },
  // S-255: translation off in 中文, a 360 phone, and the exam (the quick ← → in the row throughout)
  { viewport: dt.VIEWPORTS.phone, lang: 'zh-HK', fontSize: 'large', translation: false },
  { viewport: ANDROID, lang: 'en', fontSize: 'large', translation: true },
  { viewport: ANDROID, lang: 'zh-HK', fontSize: 'large', translation: true },
  { viewport: dt.VIEWPORTS.phone, lang: 'en', fontSize: 'large', translation: true, mode: 'exam' },
  { viewport: SMALLEST, lang: 'zh-HK', fontSize: 'large', translation: true, mode: 'exam', knownWrap: KNOWN_ZH_EXAM },
  // W-071 / S-256: 320 large text, the accepted exception
  { viewport: SMALLEST, lang: 'en', fontSize: 'large', translation: true, knownWrap: KNOWN_EN },
  { viewport: SMALLEST, lang: 'zh-HK', fontSize: 'large', translation: true, knownWrap: KNOWN_ZH },
  { viewport: SMALLEST, lang: 'zh-HK', fontSize: 'large', translation: false, knownWrap: KNOWN_ZH },
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
const wraps = st => st.counterLines !== 1 || !st.starsOnCounterLine;

// the current question through its states (unanswered, Translate pressed when shown, answered); put back unanswered
async function questionStates(page, i, translation) {
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
  await page.evaluate(n => { delete state.answers[n]; delete state.revealed[n]; delete state.yueShown[n]; goToQuestion(n); }, i);
  await dt.nextFrame(page);
  return states;
}
// the misses of one question: a wrap in any state, #qText moving, the counter changing between states. A known
// exception (knownWrap) may have its stars drop below the counter, and #qText move with them; nothing else
function stateMisses(n, states, known = false) {
  const [, first] = states[0];
  const misses = [];
  states.forEach(([what, st]) => {
    if (st.counterLines !== 1 || (!known && wraps(st))) misses.push(`Q${n} ${what}: "${st.text}" ${st.counterLines} line(s), stars ${st.starsOnCounterLine ? 'on' : 'below'} its line`);
    if (!known && Math.abs(st.offset - first.offset) > MOVE_SLACK_PX) misses.push(`Q${n} ${what}: #qText moved ${(st.offset - first.offset).toFixed(1)}px`);
    if (st.text !== first.text) misses.push(`Q${n} ${what}: counter "${st.text}" (was "${first.text}")`);
  });
  return misses;
}
const isKnownWrap = (knownWrap, key) => knownWrap === 'all' || (knownWrap || []).includes(key);

async function checkCase(b, { viewport, lang, fontSize, translation, mode = 'practice', full, knownWrap }) {
  const opened = await dt.openDesktop(b, { viewport, lang, fontSize, translation });
  const { page, errors } = opened, label = `${opened.label} ${mode}`;
  await page.evaluate(([m, n, seed]) => {
    // practice shuffles: a seeded Math.random (mulberry32) keeps each question at the same number on every run, so
    // a known exception (whose wrap depends on its number's digits too) stays put
    let a = seed;
    Math.random = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    pendingMode = m; startExam(n);
  }, [mode, EXAM_ONE, ORDER_SEED]);
  const count = await page.evaluate(() => state.questions.length);
  const misses = [], wrapped = [], tiers = {}, numbers = {};
  let fullCount = 0;
  for (let i = 0; i < count; i++) {
    const key = await page.evaluate(n => qKey(state.questions[n]), i);
    const states = await questionStates(page, i, translation && mode === 'practice');
    misses.push(...stateMisses(i + 1, states, isKnownWrap(knownWrap, key)));
    if (states.some(([, st]) => wraps(st))) wrapped.push(key);
    numbers[key] = i + 1;
    const [, first] = states[0];
    if (first.full) fullCount++;
    const tier = first.text.replace(/\d+/g, 'n');
    tiers[tier] = (tiers[tier] || 0) + 1;
  }
  console.log(`note: ${label}: ${wrapped.length}/${count} question(s) wrap ${JSON.stringify(wrapped.map(k => `Q${numbers[k]}=${k}`))}; counters ${JSON.stringify(tiers)}`);
  if (Array.isArray(knownWrap)) {
    const gone = knownWrap.filter(key => !wrapped.includes(key));
    if (gone.length) console.log(`note: ${label}: known exception(s) ${JSON.stringify(gone)} no longer wrap; the knownWrap list can be narrowed`);
  }
  const what = knownWrap ? `outside the known exceptions (${knownWrap === 'all' ? 'all, user 2026-10-13' : knownWrap.length})` : 'every question';
  assert(misses.length === 0, `${label}: counter + stars on one line before / after answering, #qText still, ${what} (${misses.slice(0, 4).join(' | ') || count + ' questions'})`);
  if (full) assert(fullCount === count, `${label}: room for the full counter on all ${count} questions (${fullCount})`);
  assert(errors.length === 0, 'no page error: ' + errors.join(' | '));
  await page.close();
}

const yueButton = page => page.$eval('#yueToggle', e => ({ text: e.textContent, aria: e.getAttribute('aria-label'), title: e.title }));
// the pressed Translate button: "Hide" in English (C3), its accessible name and tooltip stay "Hide translation"
async function checkHideLabel(b) {
  const { page, errors } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.phone, lang: 'en', fontSize: 'large', translation: true });
  await page.evaluate(n => { pendingMode = 'practice'; startExam(n); }, EXAM_ONE);
  let btn = await yueButton(page);
  assert(btn.text === 'Translate' && btn.aria === 'Translate' && btn.title === 'Translate', 'Translate button before pressing: ' + JSON.stringify(btn));
  await page.click('#yueToggle');
  btn = await yueButton(page);
  assert(btn.text === 'Hide' && btn.aria === 'Hide translation' && btn.title === 'Hide translation', 'pressed: reads "Hide", named "Hide translation": ' + JSON.stringify(btn));
  await page.evaluate(() => setLang('zh-HK'));
  btn = await yueButton(page);
  assert(btn.text === '隱藏' && btn.aria === '隱藏翻譯' && btn.title === '隱藏翻譯', '中文 pressed: reads 隱藏 (W-071), named 隱藏翻譯: ' + JSON.stringify(btn));
  await page.click('#yueToggle');
  btn = await yueButton(page);
  assert(btn.text === '翻譯' && btn.aria === '翻譯', '中文 not pressed: 翻譯: ' + JSON.stringify(btn));
  assert(errors.length === 0, 'no page error: ' + errors.join(' | '));
  await page.close();
}

// the counter is re-fitted on every change of room: resize, language, text size, translation
async function checkRefit(b) {
  const { page, errors } = await dt.openDesktop(b, { viewport: dt.VIEWPORTS.wide, lang: 'en', fontSize: 'large', translation: true });
  await page.evaluate(n => { pendingMode = 'practice'; startExam(n); }, EXAM_ONE);
  await dt.nextFrame(page);
  const counterText = () => page.$eval('#qNum > span[data-full]', e => e.textContent);
  const oneLine = async what => {
    const misses = stateMisses(1, await questionStates(page, 0, await page.evaluate(() => isTranslationOn())));
    assert(misses.length === 0, `${what}: the counter fits every state (${misses.slice(0, 3).join(' | ') || await counterText()})`);
  };
  assert(await counterText() === 'Question 1 of 24', '1280 large: the full counter');
  await dt.setViewport(page, dt.VIEWPORTS.phone);
  assert(await counterText() === 'Q 1/24', 'resize to 390 large, translation on: the tiny counter "Q 1/24"');
  await oneLine('390 en large translation on');
  await dt.applySettings(page, { fontSize: 'small' });
  assert(await counterText() !== 'Q 1/24', 'text size small at 390: re-fitted away from the tiny counter (' + await counterText() + ')');
  await oneLine('390 en small translation on');
  await dt.applySettings(page, { fontSize: 'large', translation: false });
  assert(await counterText() === 'Question 1/24', 'translation off at 390 large: re-fitted to "Question 1/24" (no Translate in the row)');
  await oneLine('390 en large translation off');
  await dt.applySettings(page, { translation: true, lang: 'zh-HK' });
  assert(/^第/.test(await counterText()), '中文: re-fitted to a 中文 counter (' + await counterText() + ')');
  await oneLine('390 zh-HK large translation on');
  await dt.applySettings(page, { lang: 'en' });
  assert(await counterText() === 'Q 1/24', 'back to English at 390 large: "Q 1/24"');
  await dt.setViewport(page, dt.VIEWPORTS.wide);
  assert(await counterText() === 'Question 1 of 24', 'resize back to 1280: the full counter again');
  assert(errors.length === 0, 'no page error: ' + errors.join(' | '));
  await page.close();
}

(async () => {
  const b = await dt.launch();
  await checkHideLabel(b);
  for (const c of CASES) await checkCase(b, c);
  await checkRefit(b);
  await b.close();
  console.log('QNUM-ROW PASS');
})().catch(e => { console.error(e.message || e); process.exit(1); });
