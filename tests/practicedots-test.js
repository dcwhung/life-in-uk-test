const { chromium } = require('playwright-core');
const path = require('path');
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
// Practice question dots (v0.55), exam quick ✓ submit, Flagged list icon colour
(async () => {
  const b = await chromium.launch(launchOpts);
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };
  const vis = sel => pg.$eval(sel, e => e.offsetParent !== null);
  const text = sel => pg.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim());
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
  const dotCls = () => pg.$$eval('#navDots .dot', els => els.map(e => e.className.replace('dot', '').trim()));
  const answer = (i, right) => pg.evaluate(({ i, right }) => {
    const q = state.questions[i]; state.current = i;
    state.answers[i] = right ? [...q.a] : [q.o.findIndex((_, k) => !q.a.includes(k))];
    revealAnswer();
  }, { i, right });
  await pg.goto(APP_URL);
  await pg.evaluate(() => localStorage.clear()); await pg.reload();

  // practice: dots replace the progress bar; no timer; Practice badge kept
  await pg.evaluate(() => { pendingMode = 'practice'; startExam('ch5'); });
  assert(await vis('#navDots') && (await pg.$$('#navDots .dot')).length === 24, 'practice: 24 numbered dots');
  assert(!(await vis('.q-progress')) && !(await vis('#examTimer')) && await vis('#modeBadge'), 'practice: no progress bar, no timer, Practice badge');
  assert((await dotCls())[0] === 'current', 'dot 1 is current before answering');

  // right = green, wrong = red, flag = orange border on top of the fill, unanswered flag = outline
  await answer(0, true); await answer(1, false);
  await pg.evaluate(() => { state.current = 0; renderQuestion(); });
  await pg.click('#flagBtn');
  await pg.evaluate(() => { state.current = 5; renderQuestion(); });
  await pg.click('#flagBtn');
  const cls = await dotCls();
  assert(cls[0] === 'ok flag' && cls[1] === 'bad' && cls[2] === '' && cls[5] === 'flag current', 'dot states: ' + cls.slice(0, 6));
  assert(await pg.$eval('#navDots .dot:nth-child(1)', e => getComputedStyle(e).backgroundColor === 'rgb(82, 183, 136)' && getComputedStyle(e).borderTopColor === 'rgb(217, 130, 43)'), 'right + flagged: green fill, orange border');
  assert(await pg.$eval('#navDots .dot:nth-child(2)', e => getComputedStyle(e).backgroundColor === 'rgb(231, 76, 60)'), 'wrong: red fill');
  assert((await text('#dotsMeta')) === 'Correct 1 | Wrong 1 | Unanswered 22 | Flagged 2', 'counts: ' + await text('#dotsMeta'));
  assert(await pg.$eval('#dotsMeta', e => new Set([...e.children].map(c => Math.round(c.getBoundingClientRect().top))).size === 1), 'counts fit one line at 390px');
  assert((await pg.$$('.score-pill')).length === 0, 'score pill removed (counts show it)');

  // tap a dot to jump, also forward to an unanswered question
  await pg.click('#navDots .dot:nth-child(2)');
  assert(await pg.evaluate(() => state.current === 1) && await pg.$eval('#opt0', e => e.disabled || e.className.includes('correct') || e.className.includes('wrong')), 'jump back to an answered question shows its result');
  await pg.click('#navDots .dot:nth-child(12)');
  assert(await pg.evaluate(() => state.current === 11) && (await text('#qNum')).startsWith('Question 12 of 24'), 'jump ahead to an unanswered question');

  // smaller sets: one dot per question
  await pg.evaluate(() => { pendingMode = 'practice'; startExam('ch1'); });
  assert((await pg.$$('#navDots .dot')).length === 9, 'Ch1: 9 dots');
  // review round has dots too
  await pg.evaluate(() => { wrongList = { '3.0': true, '3.1': true, '3.2': true }; setLS('lifeuk.wrongList', wrongList); pendingMode = 'practice'; startExam('wrong'); });
  assert(await vis('#navDots') && (await pg.$$('#navDots .dot')).length === 3, 'Wrong answers review: 3 dots');

  // exam: last question quick ✓ submits (same as Practice Finish ✓)
  await pg.evaluate(() => { pendingMode = 'exam'; startExam(4); state.current = 23; renderQuestion(); });
  assert(await vis('#quickNext') && (await text('#quickNext')) === '✓' && await pg.$eval('#quickNext', e => e.title === 'Submit'), 'exam last question: quick ✓ (Submit)');
  assert((await text('#nextBtn')) === 'Submit', 'bottom button still Submit');
  // CUI-0012: 320px — 24 exam dots stay inside the question card's content box, no page side-scroll
  await pg.setViewportSize({ width: 320, height: 844 });
  const fit320 = await dotsFit('#navDots', '.q-card');
  assert(fit320.doc <= fit320.vw, '320px exam: no horizontal page scroll: ' + fit320.doc + ' / ' + fit320.vw);
  assert(fit320.over <= 0.5, '320px exam: nav dots inside the card content box: ' + fit320.over.toFixed(2));
  assert(fit320.round && fit320.textIn && fit320.minW >= 16, '320px exam: dots round, number inside the border, ≥ 16px: ' + JSON.stringify(fit320));
  await pg.setViewportSize({ width: 390, height: 844 });
  const fit390 = await dotsFit('#navDots', '.q-card');
  assert(fit390.over <= 0.5 && fit390.round && fit390.textIn && fit390.minW >= 20, '390px exam: nav dots fit, round, ≥ 20px: ' + JSON.stringify(fit390));
  await pg.click('#quickNext');
  assert(await pg.$eval('#confirmModal', e => e.classList.contains('show')) && /Submit exam\?/.test(await text('#confirmTitle')), 'quick ✓ with unanswered questions opens the Submit modal');
  await pg.click('#confirmCancel');
  await pg.evaluate(() => { state.questions.forEach((q, i) => { state.answers[i] = [...q.a]; }); renderQuestion(); });
  await pg.click('#quickNext');
  assert(await pg.evaluate(() => document.getElementById('screenResult').classList.contains('active')), 'quick ✓ with everything answered goes to results');

  // Flagged list: start button bookmark icon visible on navy (orange, not black)
  await pg.evaluate(() => { practiceFlags = { '4.1': true }; setLS('lifeuk.practiceFlags', practiceFlags); openFlagged(); });
  const fill = await pg.$eval('#flaggedStart svg path', e => getComputedStyle(e).fill);
  assert(fill === 'rgb(217, 130, 43)', 'Practise flagged icon is orange: ' + fill);
  // every bookmark icon is styled (an SVG path with no fill renders black)
  await pg.evaluate(() => goHome());
  const tileFill = await pg.$eval('#tileFlagged .t-icon svg path', e => getComputedStyle(e).fill);
  assert(tileFill === 'rgb(217, 130, 43)', 'home Flagged tile icon is orange: ' + tileFill);
  const black = await pg.evaluate(() => [...document.querySelectorAll('svg path')].filter(p => p.getClientRects().length && getComputedStyle(p).fill === 'rgb(0, 0, 0)').length);
  assert(black === 0, 'no visible black SVG icons on Home: ' + black);

  assert(errs.length === 0, 'no page errors: ' + errs.join('; '));
  console.log('PRACTICEDOTS PASS');
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
