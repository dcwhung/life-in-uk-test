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
  const vis = sel => pg.$eval(sel, e => e.offsetParent !== null || getComputedStyle(e).position === 'fixed');
  const text = sel => pg.$eval(sel, e => e.textContent.trim());
  const active = id => pg.evaluate(id => document.getElementById(id).classList.contains('active'), id);
  const dotCls = () => pg.$$eval('#navDots .dot', els => els.map(e => e.className.replace('dot', '').trim()));
  await pg.goto(APP_URL);
  await pg.evaluate(() => localStorage.clear()); await pg.reload();
  // confirmations use the in-app modal, never the browser's alert / confirm box
  let nativeDialogs = 0;
  pg.on('dialog', d => { nativeDialogs++; d.dismiss(); });
  const modalOpen = () => pg.$eval('#confirmModal', e => e.classList.contains('show'));
  const modalText = async () => (await text('#confirmTitle')) + ' ' + (await text('#confirmMsg'));
  const focusedId = () => pg.evaluate(() => document.activeElement && document.activeElement.id);

  // practice: none of the exam tools
  await pg.evaluate(() => { pendingMode = 'practice'; startExam(1); });
  assert(!(await vis('#examTimer')) && (await pg.$$('#dotsMeta .lg-done')).length === 0, 'practice: no timer; its dots show right / wrong (see practicedots-test)');
  assert(!(await vis('.q-progress')), 'practice: dots replace the progress bar');

  // exam: timer replaces the badge, 24 dots, flag button, no progress bar
  await pg.evaluate(() => { pendingMode = 'exam'; startExam(4); });
  assert(await vis('#examTimer') && (await text('#examTimer')) === '⏱ 45:00', 'exam: timer starts at 45:00');
  assert(!(await vis('#modeBadge')), 'exam: timer takes the badge place');
  assert(!(await vis('.q-progress')), 'exam: dots replace the progress bar');
  assert((await pg.$$('#navDots .dot')).length === 24, '24 numbered dots');
  assert((await pg.$$eval('#navDots .dot', els => els.map(e => e.textContent).join(','))) === Array.from({ length: 24 }, (_, i) => i + 1).join(','), 'dots numbered 1–24');
  assert((await dotCls())[0] === 'current', 'dot 1 is current');
  assert((await text('#dotsMeta')).replace(/\s+/g, ' ') === 'Answered 0 | Unanswered 24 | Flagged 0', 'counts: 0 / 24 / 0');
  assert(await vis('#flagBtn') && (await pg.$eval('#flagBtn', e => e.getAttribute('aria-label'))) === 'Flag for review', 'flag button (bookmark) visible before answering');

  // answer Q1, flag Q1 (answered + flagged = solid orange) and Q3 (unanswered + flagged = orange outline)
  await pg.click('#opt0');
  await pg.click('#flagBtn');
  assert((await pg.$eval('#flagBtn', e => e.classList.contains('on') && e.getAttribute('aria-label') === 'Unflag')), 'flag toggles on');
  await pg.click('#navDots .dot:nth-child(3)');
  assert(await pg.evaluate(() => state.current === 2), 'clicking dot 3 jumps to question 3');
  await pg.click('#flagBtn');
  const cls = await dotCls();
  assert(cls[0] === 'done flag' && cls[1] === '' && cls[2] === 'flag current', 'dot states: answered+flagged / empty / flagged+current: ' + cls.slice(0, 3));
  assert(await pg.$eval('#navDots .dot:nth-child(1)', e => getComputedStyle(e).backgroundColor !== getComputedStyle(e).borderColor ? false : getComputedStyle(e).backgroundColor !== 'rgb(255, 255, 255)'), 'answered + flagged: solid fill');
  assert(await pg.$eval('#navDots .dot:nth-child(3)', e => getComputedStyle(e).backgroundColor === 'rgb(255, 255, 255)' && getComputedStyle(e).borderColor !== 'rgb(221, 226, 240)'), 'unanswered + flagged: outline only');
  assert((await text('#dotsMeta')).replace(/\s+/g, ' ') === 'Answered 1 | Unanswered 23 | Flagged 2', 'counts update');
  await pg.click('#flagBtn');
  assert((await dotCls())[2] === 'current', 'flag toggles off');
  await pg.click('#flagBtn');

  // submit warns about unanswered and flagged
  await pg.evaluate(() => { state.current = state.questions.length - 1; renderQuestion(); });
  await pg.click('#nextBtn');
  assert(await modalOpen() && /Submit exam\?/.test(await modalText()) && /23 questions unanswered/.test(await modalText()) && /2 flagged/.test(await modalText()), 'submit opens the modal: unanswered + flagged');
  assert((await text('#confirmOk')) === 'Submit' && (await text('#confirmCancel')) === 'Keep going', 'modal buttons: Keep going / Submit');
  assert((await focusedId()) === 'confirmOk', 'submit modal focuses Submit');
  await pg.click('#confirmCancel');
  assert(!(await modalOpen()) && await active('screenQuiz'), 'Keep going closes the modal and stays');
  await pg.click('#nextBtn'); await pg.keyboard.press('Escape');
  assert(!(await modalOpen()) && await active('screenQuiz'), 'Escape also cancels');
  // S-025: Tab / Shift+Tab stay on the modal's two buttons; closing returns focus to the button that opened it
  await pg.focus('#nextBtn'); await pg.keyboard.press('Enter');
  assert(await modalOpen() && (await focusedId()) === 'confirmOk', 'S-025: Enter on Submit opens the modal on Submit');
  await pg.keyboard.press('Tab');
  assert((await focusedId()) === 'confirmCancel', 'S-025: Tab from the last button wraps to Keep going');
  await pg.keyboard.press('Tab');
  assert((await focusedId()) === 'confirmOk', 'S-025: Tab moves on to Submit');
  await pg.keyboard.press('Shift+Tab'); await pg.keyboard.press('Shift+Tab');
  assert((await focusedId()) === 'confirmOk', 'S-025: Shift+Tab from the first button wraps to Submit');
  await pg.keyboard.press('Escape');
  assert(!(await modalOpen()) && (await focusedId()) === 'nextBtn', 'S-025: Escape returns focus to Submit');
  await pg.keyboard.press('Enter'); await pg.keyboard.press('Shift+Tab'); await pg.keyboard.press('Enter');
  assert(!(await modalOpen()) && (await focusedId()) === 'nextBtn', 'S-025: Keep going returns focus to Submit');
  // S-103: holding Enter on Submit opens the prompt once; the key repeats must not press its Submit
  await pg.keyboard.down('Enter'); await pg.keyboard.down('Enter'); await pg.keyboard.down('Enter'); await pg.keyboard.up('Enter');
  assert(await modalOpen() && await active('screenQuiz'), 'S-103: held Enter leaves the submit prompt open (no submit)');
  await pg.keyboard.press('Escape');
  assert(!(await modalOpen()) && (await focusedId()) === 'nextBtn', 'S-103: Escape closes it, focus back on Submit');
  // S-095: a second prompt over an open one keeps the first opener
  await pg.keyboard.press('Enter'); await pg.evaluate(() => goHome());
  assert(await modalOpen() && /Leave the exam\?/.test(await modalText()), 'S-095: Home over the submit modal shows the leave modal');
  await pg.keyboard.press('Escape');
  assert(!(await modalOpen()) && (await focusedId()) === 'nextBtn', 'S-095: closing it returns focus to the first opener (Submit)');

  // Home asks before leaving a running exam
  await pg.click('#screenQuiz .back-btn');
  assert(await modalOpen() && /Leave the exam\?/.test(await modalText()) && /Your answers will be lost\./.test(await modalText()), 'Home opens the leave modal');
  assert((await text('#confirmOk')) === 'Leave' && (await text('#confirmCancel')) === 'Cancel', 'leave modal buttons: Cancel / Leave');
  // destructive: default focus on Cancel (v0.60)
  assert((await focusedId()) === 'confirmCancel', 'leave modal focuses Cancel');
  await pg.click('#confirmCancel');
  assert(await active('screenQuiz'), 'Cancel keeps the exam');
  await pg.click('#screenQuiz .back-btn'); await pg.click('#confirmOk');
  assert(!(await modalOpen()) && await active('screenHome') && await pg.evaluate(() => examTimerId === null), 'Leave goes home and stops the timer');

  // timer: red in the last 5 minutes, auto-submit at 0 straight to results with a note
  await pg.evaluate(() => { pendingMode = 'exam'; startExam(4); selectOption(0); });
  await pg.evaluate(() => { examDeadline = Date.now() + 4 * 60 * 1000 + 30 * 1000; examTick(); });
  assert((await text('#examTimer')).startsWith('⏱ 04:') && await pg.$eval('#examTimer', e => e.classList.contains('warn')), 'last 5 minutes: red');
  await pg.evaluate(() => { examDeadline = Date.now() - 1; examTick(); });
  assert(await active('screenResult') && !(await modalOpen()), 'time up: straight to results, no prompt');
  assert(await vis('#resultTimeUp') && (await text('#resultTimeUp')).includes("Time's up"), 'results note the auto-submit');
  assert(await pg.evaluate(() => examTimerId === null), 'timer stopped');
  // W-024: time up while the submit modal is open closes it — results are not covered and cannot be submitted twice
  await pg.evaluate(() => { pendingMode = 'exam'; startExam(4); state.current = state.questions.length - 1; renderQuestion(); });
  await pg.focus('#nextBtn'); await pg.keyboard.press('Enter'); // S-099: keyboard-opened, so focus returns to Submit
  assert(await modalOpen(), 'W-024: submit modal open before time up');
  // S-099: press Enter straight after time up (no layout read in between, which would let Chromium drop the focus
  // itself) — it must not reopen Submit, so the exam cannot be finished twice
  await pg.evaluate(() => { examDeadline = Date.now() - 1; examTick(); });
  await pg.keyboard.press('Enter');
  assert(await active('screenResult') && !(await modalOpen()), 'W-024: time up closes the open modal on the way to results');
  assert(await vis('#resultTimeUp'), "W-024 / S-099: results keep the time-up note after a stray Enter");
  // S-098: same with the Leave prompt open — time up still submits, and a stray Enter does not go home
  await pg.evaluate(() => { pendingMode = 'exam'; startExam(4); });
  await pg.focus('#screenQuiz .back-btn'); await pg.keyboard.press('Enter'); // S-099: keyboard-opened, so focus returns there
  assert(await modalOpen() && /Leave the exam\?/.test(await modalText()), 'S-098: leave modal open before time up');
  await pg.evaluate(() => { examDeadline = Date.now() - 1; examTick(); });
  await pg.keyboard.press('Enter');
  assert(await active('screenResult') && !(await modalOpen()) && await vis('#resultTimeUp'), 'S-098: time up over the leave modal lands on results and stays');
  // a normal submit has no time-up note; results "Choose Another" does not ask
  await pg.evaluate(() => { pendingMode = 'exam'; startExam(4); state.questions.forEach((q, i) => { state.answers[i] = [...q.a]; }); state.current = 23; renderQuestion(); });
  await pg.click('#nextBtn');
  assert(await active('screenResult') && !(await vis('#resultTimeUp')) && !(await modalOpen()), 'manual submit with everything answered: no modal, no time-up note');
  await pg.evaluate(() => goHome());
  assert(await active('screenHome') && !(await modalOpen()), 'leaving the results does not ask');

  // Random Exam (exam mode › All Exams): 24 random questions from all 408, never two from the same fact
  const draws = await pg.evaluate(() => Array.from({ length: 30 }, () => {
    pendingMode = 'exam'; startExam('all');
    const keys = state.questions.map(qKey);
    const facts = keys.map(k => FACT_BY_QKEY[k].id);
    return { n: keys.length, uniqKeys: new Set(keys).size, uniqFacts: new Set(facts).size, sig: keys.join(',') };
  }));
  assert(draws.every(d => d.n === 24 && d.uniqKeys === 24 && d.uniqFacts === 24), 'every draw: 24 questions, 24 different facts (no similar questions)');
  assert(new Set(draws.map(d => d.sig)).size === draws.length, 'every draw is a different set');
  await pg.evaluate(() => { pendingMode = 'exam'; startExam('all'); });
  assert(await vis('#examTimer') && (await pg.$$('#navDots .dot')).length === 24 && await vis('#flagBtn'), 'Random Exam: timer, 24 dots, flag');
  assert((await text('#quizLabel')) === 'Random Exam', 'quiz label: Random Exam');
  await pg.evaluate(() => { state.questions.forEach((q, i) => { state.answers[i] = [...q.a]; }); state.current = 23; renderQuestion(); });
  await pg.click('#nextBtn');
  assert(await active('screenResult') && (await text('#resultLabel2')) === '🎉 PASSED' && (await text('#resultLabel')) === 'Random Exam', 'results: PASSED verdict, Random Exam label');
  const before = await pg.evaluate(() => state.questions.map(qKey).join(','));
  await pg.evaluate(() => retryExam());
  assert(await pg.evaluate(b => state.questions.length === 24 && state.questions.map(qKey).join(',') !== b, before), 'retry draws a fresh set');
  await pg.evaluate(() => goHome()); await pg.click('#confirmOk');
  // home grid: exam mode shows Random Exam; practice keeps All Questions (408)
  await pg.click('#modeExam');
  assert((await pg.$eval('#examGrid .exam-btn.all', e => e.firstChild.textContent.trim())) === '🎲 Random Exam' && (await text('#examGrid .exam-btn.all .exam-sub')) === '24 questions from 408', 'exam grid: 🎲 Random Exam / 24 questions from 408');
  await pg.click('#modePractice'); await pg.click('#ptabExam');
  assert((await text('#examGrid .exam-btn.all')).startsWith('🎯 All Questions (408)'), 'practice grid shows All Questions (408)');
  await pg.evaluate(() => { pendingMode = 'practice'; startExam('all'); });
  assert(await pg.evaluate(() => state.questions.length === 24) && !(await vis('#examTimer')), 'practice All Exams unchanged: round of 24, no timer');

  assert(nativeDialogs === 0, 'no browser alert / confirm boxes were used');
  assert(errs.length === 0, 'no page errors: ' + errs.join('; '));
  console.log('EXAMTOOLS PASS');
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
