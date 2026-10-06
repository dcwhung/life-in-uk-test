const { chromium } = require('playwright-core');
const path = require('path');
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
// Practice: persistent flags, wrong-answer list, "My Review" (Wrong answers / Flagged), Flagged list, practice results
(async () => {
  const b = await chromium.launch(launchOpts);
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };
  const vis = sel => pg.$eval(sel, e => e.offsetParent !== null);
  const text = sel => pg.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim());
  const texts = sel => pg.$$eval(sel, els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
  const active = id => pg.evaluate(id => document.getElementById(id).classList.contains('active'), id);
  const ls = key => pg.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), key);
  await pg.goto(APP_URL);
  await pg.evaluate(() => localStorage.clear()); await pg.reload();
  const answer = correct => pg.evaluate(correct => {
    const i = state.current, q = state.questions[i];
    state.answers[i] = correct ? [...q.a] : [q.o.findIndex((_, k) => !q.a.includes(k))];
    revealAnswer();
  }, correct);

  // home: "Practice By" categories; no My Review until something is recorded
  assert((await text('#practiceByTitle')) === 'Practice By', '"Practice By" section title (Title Case)');
  assert(JSON.stringify(await texts('#practiceTabs .practice-tab')) === JSON.stringify(['Difficulty', 'Chapter', 'Exam']), 'category tabs: Difficulty / Chapter / Exam');
  assert(!(await vis('#myReview')), 'fresh start: no My Review section');

  // practice flag: bookmark left of Translate, saved across reloads
  await pg.evaluate(() => { pendingMode = 'practice'; startExam(1); });
  assert(await vis('#flagBtn') && await pg.$eval('#flagBtn', e => e.compareDocumentPosition(document.getElementById('yueToggle')) & Node.DOCUMENT_POSITION_FOLLOWING), 'practice: bookmark shown, left of Translate');
  const k0 = await pg.evaluate(() => qKey(state.questions[0]));
  await pg.click('#flagBtn');
  assert((await ls('lifeuk.practiceFlags'))[k0] === true && await pg.$eval('#flagBtn', e => e.classList.contains('on')), 'flag saved to localStorage');
  await pg.reload();
  await pg.evaluate(k => { pendingMode = 'practice'; startExam(1); state.current = state.questions.findIndex(q => qKey(q) === k); renderQuestion(); }, k0);
  assert(await pg.$eval('#flagBtn', e => e.classList.contains('on')), 'flag still on after reload');

  // home now shows My Review: Wrong answers empty (disabled), Flagged 1
  await pg.evaluate(() => goHome());
  assert(await vis('#myReview'), 'My Review appears once something is recorded');
  assert(await pg.$eval('#tileWrong', e => e.classList.contains('empty')) && (await text('#tileWrong .t-num')) === '0', 'Wrong answers tile empty');
  assert((await text('#tileFlagged .t-num')) === '1' && (await text('#tileFlagged .sub')) === '1 flagged', 'Flagged tile: 1 flagged');
  await pg.click('#modeExam');
  assert(!(await vis('#myReview')), 'My Review only under Practice');
  await pg.click('#modePractice');

  // wrong list: practice wrong answers and exam wrong answers are collected
  await pg.evaluate(() => { pendingMode = 'practice'; startExam('ch1'); });
  const kw = await pg.evaluate(() => qKey(state.questions[0]));
  await answer(false);
  assert((await ls('lifeuk.wrongList'))[kw] === true, 'practice wrong answer added to the wrong list');
  await pg.evaluate(() => {
    pendingMode = 'exam'; startExam(2);
    state.answers[0] = [state.questions[0].o.findIndex((_, k) => !state.questions[0].a.includes(k))];
    state.answers[1] = [...state.questions[1].a];
    finishExam();
  });
  const wl = await ls('lifeuk.wrongList');
  assert(wl['2.0'] === true && !wl['2.1'] && !wl['2.2'], 'exam: answered-wrong added; correct / unanswered not');
  // a correct answer outside Review does not clear it
  await pg.evaluate(k => { pendingMode = 'practice'; startExam('ch1'); state.current = state.questions.findIndex(q => qKey(q) === k); renderQuestion(); }, kw);
  if (await pg.evaluate(k => state.questions.some(q => qKey(q) === k), kw)) {
    await answer(true);
    assert((await ls('lifeuk.wrongList'))[kw] === true, 'correct answer outside Review keeps it in the list');
  }

  // Wrong answers tile: starts a review round; a correct answer there clears the question
  await pg.evaluate(() => goHome());
  assert((await text('#tileWrong .t-num')) === '2' && (await text('#tileWrong .sub')) === '2 to clear', 'Wrong tile: 2 to clear');
  await pg.click('#tileWrong');
  assert((await text('#quizLabel')) === 'Wrong answers' && await pg.evaluate(() => state.questions.length === 2), 'review round of the 2 wrong answers');
  assert(!(await vis('#roundNote')), 'no round note when everything fits in one round');
  const firstKey = await pg.evaluate(() => qKey(state.questions[0]));
  await answer(true);
  assert(!(await ls('lifeuk.wrongList'))[firstKey], 'correct in Review: cleared from the list');
  await pg.evaluate(() => { state.current = 1; renderQuestion(); });
  const secondKey = await pg.evaluate(() => qKey(state.questions[1]));
  await answer(false);
  assert((await ls('lifeuk.wrongList'))[secondKey] === true, 'wrong in Review: stays');
  await pg.evaluate(() => finishExam());
  assert((await text('#resultNote')) === 'Cleared 1 from your wrong answers · 1 left', 'result note: cleared / left');

  // more than 24 wrong: round of 24 with a note above the question card
  await pg.evaluate(() => { const w = {}; for (let i = 0; i < 30; i++) w['3.' + (i % 24)] = true; for (let i = 0; i < 6; i++) w['5.' + i] = true; localStorage.setItem('lifeuk.wrongList', JSON.stringify(w)); wrongList = w; goHome(); });
  assert((await text('#tileWrong .sub')) === '30 to clear · 24 per round', 'tile remark: 24 per round');
  await pg.click('#tileWrong');
  assert(await pg.evaluate(() => state.questions.length === 24), 'review round capped at 24');
  assert(await vis('#roundNote') && (await text('#roundNote')) === 'Round 1 of 2 · 24 of your 30 wrong answers', 'round note text');
  assert(await pg.$eval('#roundNote', e => e.compareDocumentPosition(document.querySelector('#screenQuiz .q-card')) & Node.DOCUMENT_POSITION_FOLLOWING), 'round note sits above the question card');

  // Flagged tile opens the list; unflag there; practise flagged
  await pg.evaluate(() => { localStorage.setItem('lifeuk.practiceFlags', JSON.stringify({ '4.1': true, '4.2': true, '4.12': true })); practiceFlags = JSON.parse(localStorage.getItem('lifeuk.practiceFlags')); goHome(); });
  await pg.click('#tileFlagged');
  assert(await active('screenFlagged') && (await pg.$$('#flaggedList .flag-item')).length === 3, 'Flagged list: 3 items');
  assert((await text('#flaggedList .flag-item small')).startsWith('Exam 4 · Q2'), 'item shows exam / question number');
  assert((await text('#flaggedStart b')) === 'Practise flagged (3)', 'start button with count');
  await pg.click('#flaggedList .flag-item:nth-child(1) button');
  assert((await pg.$$('#flaggedList .flag-item')).length === 2 && !(await ls('lifeuk.practiceFlags'))['4.1'], 'unflag from the list');
  await pg.click('#flaggedStart');
  assert((await text('#quizLabel')) === 'Flagged' && await pg.evaluate(() => state.questions.map(qKey).sort().join() === ['4.12', '4.2'].sort().join()), 'flagged round = the flagged questions');
  await pg.evaluate(() => { localStorage.setItem('lifeuk.practiceFlags', '{}'); practiceFlags = {}; openFlagged(); });
  assert((await text('#flaggedList')) === 'No flagged questions left.' && !(await vis('#flaggedStart')), 'empty list message');

  // practice results: exam-style page
  await pg.evaluate(() => {
    localStorage.setItem('lifeuk.practiceFlags', JSON.stringify({ '1.1': true })); practiceFlags = { '1.1': true };
    pendingMode = 'practice'; startExam(1);
    state.questions.forEach((q, i) => { state.current = i; state.answers[i] = i % 4 ? [...q.a] : [q.o.findIndex((_, k) => !q.a.includes(k))]; revealAnswer(); });
    finishExam();
  });
  assert((await text('#resultEmoji')) === '🎯' && (await pg.$$('.result-breakdown')).length === 0, 'practice result: 🎯, no boxes');
  assert((await text('#resultScore')) === '18 / 24 · 75%' && !(await pg.$eval('#resultScore', e => e.classList.contains('fail'))), 'score line, never red in practice');
  assert((await pg.$$('#resultDots .rdot')).length === 24 && await pg.evaluate(() => document.querySelector('#resultDots .rdot.flag') !== null), 'practice result dots incl. flag ring');
  assert(JSON.stringify(await texts('#reviewOrder .chip')) === JSON.stringify(['All 24', 'Wrong 6', 'Flagged 1']), 'practice review filters');
  assert(/^Mastered \d+ more this round · \d+\/24 in Exam 1$/.test(await text('#resultNote')), 'mastery note: ' + await text('#resultNote'));
  assert((await pg.$$('#reviewList .rv-streak')).length === 24, 'review shows each question streak');

  assert(errs.length === 0, 'no page errors: ' + errs.join('; '));
  console.log('REVIEW PASS');
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
