const { chromium } = require('playwright-core');
const path = require('path');
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
(async () => {
  const b = await chromium.launch(launchOpts);
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };
  const vis = sel => pg.$eval(sel, e => getComputedStyle(e).display !== 'none');
  const text = sel => pg.$eval(sel, e => e.textContent);
  await pg.goto(APP_URL);
  await pg.evaluate(() => localStorage.clear()); await pg.reload();
  const answer = () => pg.evaluate(() => {
    const i = state.current, q = state.questions[i];
    state.answers[i] = [...q.a];
    if (state.mode === 'practice') revealAnswer(); else renderQuestion(); // exam: a pick is just saved
  });

  // practice: hidden before answering (Translate keeps its place), shown after
  await pg.evaluate(() => { pendingMode = 'practice'; startExam('ch1'); });
  assert(!(await vis('#quickNav')) && await vis('#yueToggle'), 'before answering: Translate shown, quick nav hidden');
  await answer();
  assert(await vis('#quickNav') && !(await vis('#yueToggle')), 'after answering: quick nav in the Translate spot');
  assert(await pg.$eval('#quickNav', e => e.closest('.q-num') !== null), 'quick nav sits in the question header row');
  assert((await text('#quickPrev')) === '←' && await pg.$eval('#quickPrev', e => e.disabled), 'symbol-only Prev, disabled on the first question');
  assert((await text('#quickNext')) === '→', 'symbol-only Next');
  assert(await pg.$eval('#quickPrev', e => e.title === 'Previous') && await pg.$eval('#quickNext', e => e.title === 'Next'), 'quick buttons keep a text label as title');
  await pg.click('#quickNext');
  assert(await pg.evaluate(() => state.current === 1), 'quick Next moves to the next question');
  assert(!(await vis('#quickNav')), 'hidden again on an unanswered question');
  await answer();
  await pg.click('#quickPrev');
  assert(await pg.evaluate(() => state.current === 0), 'quick Prev moves back');
  // last question mirrors the bottom button (Finish)
  await pg.evaluate(() => { state.current = state.questions.length - 1; renderQuestion(); });
  await answer();
  assert((await text('#quickNext')) === '✓' && (await text('#nextBtn')) === 'Finish ✓', 'last question: ✓ (bottom button keeps Finish ✓)');
  assert(await pg.$eval('#quickNext', e => e.title === 'Finish'), 'title names the action');
  await pg.click('#quickNext');
  assert(await vis('#screenResult'), 'quick Finish opens the results');

  // exam: quick nav always shown (no Translate there), also on unanswered questions; no Next on the last question
  await pg.evaluate(() => { pendingMode = 'exam'; startExam(1); });
  assert(await vis('#quickNav') && (await text('#quickNext')) === '→', 'exam: shown before picking');
  await answer();
  await pg.click('#quickNext');
  assert(await pg.evaluate(() => state.current === 1 && state.answers[0].length > 0), 'exam: quick Next keeps the pick');
  assert(await vis('#quickNav'), 'exam: still shown on the next (unanswered) question');
  await pg.evaluate(() => { state.current = state.questions.length - 1; renderQuestion(); });
  await answer();
  assert((await text('#quickNext')) === '✓' && await vis('#quickPrev') && (await text('#nextBtn')) === 'Submit', 'exam last question: quick ✓ submits, bottom button Submit');

  // similar session: last question goes back
  await pg.evaluate(() => {
    pendingMode = 'practice'; startExam(12);
    state.current = state.questions.findIndex(q => q.origIdx === 5);
    const q = state.questions[state.current]; state.answers[state.current] = [...q.a]; revealAnswer();
    startSimilarPractice();
    state.current = state.questions.length - 1;
    const l = state.questions[state.current]; state.answers[state.current] = [...l.a]; revealAnswer();
  });
  assert((await text('#quickNext')) === '↩' && (await text('#nextBtn')) === '↩ Back', 'similar session: ↩ / ↩ Back');
  await pg.click('#quickNext');
  assert(await pg.evaluate(() => state.examNum === 12 && sessionReturn === null), 'quick Back returns to the original session');

  // card header: "Question X of Y"; practice uses question dots instead of the progress bar and score pill (practicedots-test)
  await pg.evaluate(() => { localStorage.clear(); streaks = {}; pendingMode = 'practice'; startExam('ch1'); });
  assert((await pg.$$('#headerStats')).length === 0, 'app header has no correct / done stats');
  assert((await pg.$$('#progressText')).length === 0, 'no separate progress row');
  assert((await text('#qNum')).startsWith('Question 1 of 9'), 'question header reads "Question 1 of 9"');
  assert(await pg.$eval('#progressFill', e => e.closest('.q-card') !== null && e.parentElement.classList.contains('q-progress')), 'progress bar element lives in the question card');
  assert(!(await vis('.q-progress')) && await vis('#navDots'), 'practice: dots replace the progress bar');
  await answer();
  assert((await pg.$$('#qNum .score-pill')).length === 0, 'no score pill after answering');
  await pg.click('#quickNext');
  assert((await text('#qNum')).startsWith('Question 2 of 9'), 'header moves to question 2');
  await pg.evaluate(() => { pendingMode = 'exam'; startExam(1); });
  await answer();
  assert((await pg.$$('#qNum .score-pill')).length === 0 && (await text('#qNum')).startsWith('Question 1 of 24'), 'exam mode: no score pill');

  // CUI-0013: the English question already states how many to pick (content-guard-test), so the header carries no
  // "(select N)" hint and stays on one line even at 320px; ← → must stay inside the card (.q-card clips with overflow: hidden).
  const headerFit = (mode, multi) => pg.evaluate(([m, wantMulti]) => {
    pendingMode = m; startExam(1); // Exam 1 Q1 is a multi-answer question in exam order
    const i = state.questions.findIndex(q => (q.a.length > 1) === wantMulti);
    state.current = i; renderQuestion();
    if (m === 'practice') { state.answers[i] = [...state.questions[i].a]; revealAnswer(); } // practice shows ← → once answered
    const card = document.querySelector('.q-card'), cs = getComputedStyle(card);
    const contentRight = card.getBoundingClientRect().right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight);
    const range = document.createRange(); range.selectNodeContents(byId('qNum').firstElementChild);
    const lines = new Set([...range.getClientRects()].map(r => Math.round(r.top))).size;
    return { over: byId('quickNext').getBoundingClientRect().right - contentRight, lines, text: byId('qNum').textContent };
  }, [mode, multi]);
  for (const lang of ['en', 'zh-HK']) {
    await pg.evaluate(l => { localStorage.clear(); setLang(l); }, lang);
    for (const width of [320, 360]) {
      await pg.setViewportSize({ width, height: 844 });
      for (const mode of ['exam', 'practice']) {
        const m = await headerFit(mode, true);
        assert(m.over <= 0.5, `${lang} ${width}px ${mode} multi-answer: → inside the card content box (over by ${m.over.toFixed(1)}px)`);
        assert(!/select|選擇|項）/i.test(m.text), `${lang} ${width}px ${mode} multi-answer: no "(select N)" hint in the header (${m.text})`);
        assert(m.lines === 1, `${lang} ${width}px ${mode} multi-answer: header text stays on one line (${m.lines})`);
        const s = await headerFit(mode, false);
        assert(s.lines === 1 && s.over <= 0.5, `${lang} ${width}px ${mode} single-answer: header text stays on one line (${s.lines})`);
      }
    }
  }

  assert(errs.length === 0, 'no page errors: ' + errs.join('; '));
  console.log('QUICKNAV PASS');
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
