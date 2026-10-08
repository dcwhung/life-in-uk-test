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
  // CUI-0012: dot grid geometry against the card's content box (dots right edge, round, number inside the border)
  const dotsFit = (sel, cardSel) => pg.$eval(sel, (el, cardSel) => {
    const card = el.closest(cardSel), cs = getComputedStyle(card), cr = card.getBoundingClientRect();
    const dots = [...el.children].map(d => { const r = d.getBoundingClientRect(), rg = document.createRange(); rg.selectNodeContents(d); return { r, cw: d.clientWidth, tw: rg.getBoundingClientRect().width }; });
    return {
      doc: document.documentElement.scrollWidth, vw: innerWidth,
      over: Math.max(...dots.map(d => d.r.right)) - (cr.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth)),
      round: dots.every(d => Math.abs(d.r.width - d.r.height) < 0.5), textIn: dots.every(d => d.tw <= d.cw + 0.5),
      minW: Math.min(...dots.map(d => d.r.width)),
    };
  }, cardSel);
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

  // CUI-0012: 320px — the 12-column grid stays inside the result card, no page side-scroll, dots still round with the number inside
  await pg.setViewportSize({ width: 320, height: 844 });
  const fit320 = await dotsFit('#resultDots', '.result-card');
  assert(fit320.doc <= fit320.vw, '320px: no horizontal page scroll: ' + fit320.doc + ' / ' + fit320.vw);
  assert(fit320.over <= 0.5, '320px: result dots inside the card content box: ' + fit320.over.toFixed(2));
  assert(fit320.round && fit320.textIn && fit320.minW >= 16, '320px: dots round, number inside the border, ≥ 16px: ' + JSON.stringify(fit320));
  await pg.setViewportSize({ width: 390, height: 844 });
  const fit390 = await dotsFit('#resultDots', '.result-card');
  assert(fit390.over <= 0.5 && fit390.round && fit390.textIn && fit390.minW >= 20, '390px: result dots fit, round, ≥ 20px: ' + JSON.stringify(fit390));

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

  // v0.70: the Practice answer box draws the note the same way; a wrapped bullet / sub line continues under its text,
  // after the "•" / "◦", not back at the left edge (hanging indent). 1.19's shared memory note has long wrapped lines
  const hang = await pg.evaluate(() => {
    pendingMode = 'practice'; startExam(1);
    state.current = state.questions.findIndex(q => (q.note || '').startsWith('記憶法（三層）')); renderQuestion();
    selectOption(state.questions[state.current].a[0]);
    const lines = [...document.querySelectorAll('#ansNote .rv-note-line.bullet, #ansNote .rv-note-line.sub')];
    return { n: lines.length, subs: lines.filter(l => l.classList.contains('sub')).length, bad: lines.filter(l => {
      const r = document.createRange(); r.selectNodeContents(l);
      const boxes = [...r.getClientRects()]; if (boxes.length < 2) return false;
      const txt = l.querySelector('.note-mark').nextSibling, t = document.createRange(); t.setStart(txt, 0); t.setEnd(txt, 1); // first char after the marker
      return Math.abs(boxes[boxes.length - 1].left - t.getBoundingClientRect().left) > 1;
    }).map(l => l.textContent.slice(0, 12)), wrapped: lines.filter(l => { const r = document.createRange(); r.selectNodeContents(l.querySelector('.note-mark').nextSibling); return new Set([...r.getClientRects()].map(b => Math.round(b.top))).size > 1; }).length };
  });
  assert(hang.n === 13 && hang.subs === 9 && hang.wrapped > 0 && hang.bad.length === 0, `Practice answer note: bullet / sub rows with a hanging indent (${JSON.stringify(hang)})`);

  assert(errs.length === 0, 'no page errors: ' + errs.join('; '));
  console.log('EXAMRESULT PASS');
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
