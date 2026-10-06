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
  const vis = sel => pg.$eval(sel, e => e.offsetParent !== null);
  const text = sel => pg.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim());
  const texts = sel => pg.$$eval(sel, els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
  await pg.goto(APP_URL);
  await pg.evaluate(() => localStorage.clear()); await pg.reload();

  // Exam 4: 17 correct, 6 wrong, 1 unanswered; 5 flagged (mix of right and wrong)
  const WRONG = [2, 6, 9, 14, 19, 21], SKIP = [17], FLAG = [1, 2, 12, 16, 22];
  const finishExam4 = (wrong, skip, flag) => pg.evaluate(({ wrong, skip, flag }) => {
    pendingMode = 'exam'; startExam(4);
    state.questions.forEach((q, i) => {
      if (skip.includes(i)) return;
      state.answers[i] = wrong.includes(i) ? [q.o.findIndex((_, k) => !q.a.includes(k))] : [...q.a];
    });
    flag.forEach(i => { state.flags[i] = true; });
    finishExam();
  }, { wrong, skip, flag });
  await finishExam4(WRONG, SKIP, FLAG);

  // header: mode icon, score once (red when failed), no 3-box breakdown
  assert((await text('#resultEmoji')) === '📝', 'exam result icon follows the mode (📝)');
  assert((await text('#resultScore')) === '17 / 24 · 71%', 'score line: 17 / 24 · 71%');
  assert(await pg.$eval('#resultScore', e => e.classList.contains('fail')), 'failed: score line red');
  assert((await text('#resultLabel2')) === '📚 NEEDS IMPROVEMENT', 'failed verdict with the book icon');
  assert((await pg.$$('.result-breakdown, #rbCorrect, #rbWrong, #rbPct')).length === 0, 'exam: Correct / Wrong / Score boxes removed from the page');
  assert(await pg.$$eval('#screenResult .section-title', els => els.some(e => e.textContent === 'By Difficulty') && els.every(e => !/[\u4e00-\u9fff]/.test(e.textContent))), 'section title "By Difficulty", no Chinese');

  // dots: green correct, red wrong, red outline unanswered, orange ring flagged
  const dots = await pg.$$eval('#resultDots .rdot', els => els.map(e => e.className.replace('rdot', '').trim()));
  assert(dots.length === 24, '24 result dots');
  assert(dots[0] === 'ok' && dots[1] === 'ok flag' && dots[2] === 'bad flag' && dots[6] === 'bad' && dots[17] === 'skip', 'dot states: ' + dots.slice(0, 3) + ' / ' + dots[6] + ' / ' + dots[17]);
  assert((await text('#resultDotsMeta')) === 'Correct 17 | Wrong 6 | Unanswered 1 | Flagged 5', 'counts line');

  // review filters: All / Wrong / Flagged, with counts and the bookmark icon
  assert(JSON.stringify(await texts('#reviewOrder .chip')) === JSON.stringify(['All 24', 'Wrong 7', 'Flagged 5']), 'filter chips with counts');
  assert(await pg.$eval('#reviewOrder .chip:nth-child(1)', e => e.classList.contains('active')), 'All is the default');
  assert((await pg.$$('#reviewOrder .chip svg')).length === 1, 'Flagged chip carries the bookmark icon');
  assert((await pg.$$('#reviewList .review-item')).length === 24, 'All: 24 items');
  await pg.click('#reviewOrder .chip:nth-child(2)');
  const wrongNums = (await texts('#reviewList .rv-q')).map(t => parseInt(t));
  assert(JSON.stringify(wrongNums) === JSON.stringify([3, 7, 10, 15, 18, 20, 22]), 'Wrong: wrong + unanswered, original numbers: ' + wrongNums);
  await pg.click('#reviewOrder .chip:nth-child(3)');
  const flagNums = (await texts('#reviewList .rv-q')).map(t => parseInt(t));
  assert(JSON.stringify(flagNums) === JSON.stringify([2, 3, 13, 17, 23]), 'Flagged: the 5 flagged questions');
  assert((await pg.$$('#reviewList .rv-q .rv-flag')).length === 5 && !(await text('#reviewList')).includes('Flagged'), 'flagged items show the bookmark icon, no "Flagged" text');

  // tapping a dot jumps to that question (switches back to All when filtered out)
  await pg.click('#resultDots .rdot:nth-child(5)');
  assert(await pg.$eval('#reviewOrder .chip:nth-child(1)', e => e.classList.contains('active')), 'jumping to an unlisted question switches to All');
  assert(await pg.$eval('#rv4', e => e.classList.contains('hl')), 'target review item highlighted');
  await pg.waitForTimeout(600);
  assert(await pg.$eval('#rv4', e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight; }), 'target scrolled into view');

  // translation + note: separated block, one row per note line, bullets indented
  assert(await pg.$eval('#rv0 .rv-tr .rv-yue', e => e.textContent.startsWith('【廣東話翻譯】')), 'Cantonese translation in its own block, labelled 【廣東話翻譯】');
  const noteIdx = await pg.evaluate(() => state.questions.findIndex(q => q.note && q.note.split('\n').some(l => /^\s*[•→]/.test(l))));
  const noteLines = await pg.$$eval(`#rv${noteIdx} .rv-note-line`, els => els.map(e => e.className));
  assert(noteLines.length > 2 && noteLines.some(c => c.includes('bullet')), 'note split into rows with bullet indent');
  assert((await text(`#rv${noteIdx} .rv-note-label`)) === '💡 備注：', 'note label row');

  // review items breathe: question / your answer / correct answer separated, roomy line height
  const gaps = await pg.$eval('#rv2', e => {
    const q = e.querySelector('.rv-q').getBoundingClientRect(), y = e.querySelector('.rv-your').getBoundingClientRect(),
      c = e.querySelector('.rv-correct-ans').getBoundingClientRect();
    const lh = parseFloat(getComputedStyle(e.querySelector('.rv-your')).lineHeight) / parseFloat(getComputedStyle(e.querySelector('.rv-your')).fontSize);
    return { qy: y.top - q.bottom, yc: c.top - y.bottom, lh };
  });
  assert(gaps.qy >= 6 && gaps.yc >= 4 && gaps.lh >= 1.5, 'review item spacing: ' + JSON.stringify(gaps));

  // buttons
  assert(JSON.stringify(await texts('#screenResult .retry-btn')) === '["Retry","Retry"]' && JSON.stringify(await texts('#screenResult .another-btn')) === '["Another Exam","Another Exam"]', 'exam buttons: Retry / Another Exam');

  // passed: score line stays navy
  await finishExam4([2], [], []);
  assert((await text('#resultScore')) === '23 / 24 · 96%' && !(await pg.$eval('#resultScore', e => e.classList.contains('fail'))), 'passed: score line not red');
  assert((await text('#resultLabel2')) === '🎉 PASSED', 'PASSED verdict with the celebration icon');
  assert(JSON.stringify(await texts('#reviewOrder .chip')) === JSON.stringify(['All 24', 'Wrong 1', 'Flagged 0']) && await pg.$eval('#reviewOrder .chip:nth-child(3)', e => e.disabled), 'empty filter disabled');

  // practice result now follows the exam layout (details in review-test.js)
  await pg.evaluate(() => { pendingMode = 'practice'; startExam('ch1'); state.questions.forEach((q, i) => { state.answers[i] = [...q.a]; }); finishExam(); });
  assert((await text('#resultEmoji')) === '🎯', 'practice result icon follows the mode (🎯)');
  assert((await pg.$$('.result-breakdown')).length === 0 && await vis('#resultDots'), 'practice: no boxes, result dots shown');
  assert(JSON.stringify(await texts('#reviewOrder .chip')) === JSON.stringify(['All 9', 'Wrong 0', 'Flagged 0']), 'practice uses the All / Wrong / Flagged filters');
  assert(JSON.stringify(await texts('#screenResult .retry-btn')) === '["Retry","Retry"]' && JSON.stringify(await texts('#screenResult .another-btn')) === '["Another Practice","Another Practice"]', 'practice buttons: Retry / Another Practice');

  assert(errs.length === 0, 'no page errors: ' + errs.join('; '));
  console.log('EXAMRESULT PASS');
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
