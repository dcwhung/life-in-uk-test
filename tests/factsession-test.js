const { chromium } = require('playwright-core');
const path = require('path');
// v0.62 (P3 Lane C2): fact → source questions session engine (no entry button yet; PR-3 adds it).
// Set id FACT_PREFIX + id ('f21', header "Fact #21"); startFactPractice(id) runs f.src once each in Practice,
// whatever the Home mode; last question "↩ Back" returns to Study with tab / chip / search / scroll restored.
// R-001: every state field is reset (no leak from the session before); R-002: never pendingMode = exam.
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

const FACT_ID = 21; // Magna Carta, chapter 3, 8 source questions
const FACT_SRC = '4.16,6.6,7.14,8.13,12.23,15.6,16.16,17.21';
// Study is scrolled so fact #21 sits this far below the viewport top, as when its "▶ Practise" is tapped
// (v0.63: ↩ Back brings the card into view if the restored scroll no longer shows it, R-010)
const CARD_OFFSET_Y = 200;
const SCROLL_TOLERANCE = 2;
const SEARCH_TERM = 'magna';

const text = (pg, sel) => pg.$eval(sel, e => e.textContent);
const shown = (pg, sel) => pg.$eval(sel, e => !e.hidden && getComputedStyle(e).display !== 'none');
const activeScreen = pg => pg.$eval('.screen.active', e => e.id);
// answer the current question right (true) or wrong (false)
const answer = (pg, correct) => pg.evaluate(c => {
  const i = state.current, q = state.questions[i];
  state.answers[i] = c ? [...q.a] : [q.o.findIndex((_, k) => !q.a.includes(k))];
  revealAnswer();
}, correct);
const goLast = pg => pg.evaluate(() => { state.current = state.questions.length - 1; renderQuestion(); });

// set ids: 'f21' is a fact set, 'flagged' (also starts with "f") is not
async function checkSetIds(pg) {
  const ids = await pg.evaluate(() => ({
    fact: isFactExam('f21'), flagged: isFactExam(FLAGGED_EXAM), num: isFactExam(21), id: factIdOf('f21'),
    label: examLabel(FACT_PREFIX + 21), flaggedLabel: examLabel(FLAGGED_EXAM),
  }));
  assert(ids.fact && !ids.flagged && !ids.num, `isFactExam: 'f21' yes, 'flagged' / 21 no (${JSON.stringify(ids)})`);
  assert(ids.id === 21, `factIdOf('f21') === 21 (${ids.id})`);
  assert(ids.label === 'Fact #21' && ids.flaggedLabel === 'Flagged', `examLabel: Fact #21 / Flagged (${ids.label} / ${ids.flaggedLabel})`);
}

// Home on Exam, a timed Exam 1 running with exam flags / review counters, then Study › Chapters › Ch 3, Hide mastered, scrolled
async function dirtyExamThenStudy(pg) {
  await pg.evaluate(() => {
    pendingMode = EXAM_MODE; startExam(1);
    state.flags[0] = true; state.reviewTotal = 50; state.cleared = 3; examTimeUp = true;
    openStudy(); studySetTab('chapters'); studySetChapter(3); studyToggle('hideMastered');
  });
  await pg.evaluate(([id, off]) => {
    const card = document.querySelector(`#studyContent .fact[data-fact-id="${id}"]`);
    window.scrollTo(0, card.getBoundingClientRect().top + window.scrollY - off);
  }, [FACT_ID, CARD_OFFSET_Y]);
  return pg.evaluate(() => window.scrollY);
}

// R-001 / R-002: the fact session starts clean, in Practice, with no timer
async function checkStart(pg) {
  const savedY = await dirtyExamThenStudy(pg);
  assert(savedY > 0, `Study scrolled before the session (${savedY})`);
  await pg.evaluate(id => startFactPractice(id), FACT_ID);
  const s = await pg.evaluate(() => ({
    mode: state.mode, pendingMode, examNum: state.examNum, keys: state.questions.map(qKey).join(','),
    current: state.current, answers: state.answers, revealed: state.revealed, yueShown: state.yueShown, flags: state.flags,
    setPool: state.setPool, masteredBefore: state.masteredBefore, reviewTotal: state.reviewTotal, cleared: state.cleared,
    examTimeUp, timer: examTimerId, ret: sessionReturn, side: isSideSession(),
  }));
  assert(s.mode === 'practice' && s.pendingMode === 'exam', `mode forced to Practice, Home's pendingMode untouched (${s.mode} / ${s.pendingMode})`);
  assert(s.examNum === 'f21', `examNum 'f21' (${s.examNum})`);
  assert(s.keys === FACT_SRC, `questions = f.src, in order, each once (${s.keys})`);
  assert(s.current === 0, 'starts at question 1');
  const empty = ['answers', 'revealed', 'yueShown', 'flags'].filter(k => Object.keys(s[k]).length);
  assert(empty.length === 0, 'answers / revealed / yueShown / flags all empty' + (empty.length ? ': ' + empty.join(', ') : ''));
  assert(s.setPool === null && s.masteredBefore === 0 && s.reviewTotal === 0 && s.cleared === 0,
    `setPool null, masteredBefore / reviewTotal / cleared 0 (${JSON.stringify([s.setPool, s.masteredBefore, s.reviewTotal, s.cleared])})`);
  assert(s.examTimeUp === false && s.timer === null, `exam timer stopped, examTimeUp false (${s.timer} / ${s.examTimeUp})`);
  assert(s.side && s.ret && s.ret.kind === 'study' && s.ret.scrollY === savedY, `sessionReturn = { kind: 'study', scrollY: ${savedY} } (${JSON.stringify(s.ret)})`);
  // CUI-0010: a second call from inside the session (double tap / key repeat on "▶ Practise") must keep the way
  // back to Study — the quiz screen is scrolled to 0 by then, and ↩ Back below checks the restored scroll
  await pg.evaluate(id => startFactPractice(id), FACT_ID);
  const again = await pg.evaluate(() => sessionReturn);
  assert(again && again.kind === 'study' && again.scrollY === savedY, `second startFactPractice keeps scrollY ${savedY} (${JSON.stringify(again)})`);
  return savedY;
}

// header, no round note even with review counters, no Similar panel; answers count like any Practice answer
async function checkInSession(pg) {
  assert(await activeScreen(pg) === 'screenQuiz', 'quiz screen shown');
  assert(await text(pg, '#quizLabel') === 'Fact #21' && await text(pg, '#modeBadge') === 'Practice', 'header: Fact #21 · Practice');
  assert((await text(pg, '#qNum')).startsWith('Question 1 of 8'), 'Question 1 of 8');
  await pg.evaluate(() => { state.reviewTotal = 50; renderQuestion(); renderRoundNote(); });
  assert(!(await shown(pg, '#roundRow')), 'no round note inside a side session (even with a review total)');
  await answer(pg, false);
  assert(!(await shown(pg, '#similarBox')), 'no Similar Questions panel inside a fact session');
  const after = await pg.evaluate(() => ({
    streak: JSON.parse(localStorage.getItem('lifeuk.practiceStreak') || '{}')['4.16'],
    wrong: !!JSON.parse(localStorage.getItem('lifeuk.wrongList') || '{}')['4.16'],
  }));
  assert(after.streak === 0 && after.wrong, `wrong answer: practiceStreak written (0) and joins wrong answers (${JSON.stringify(after)})`);
  assert(await text(pg, '#nextBtn') === 'Next →', 'Next → before the last question');
  await pg.click('#nextBtn');
  await answer(pg, true);
  assert(await pg.evaluate(() => JSON.parse(localStorage.getItem('lifeuk.practiceStreak'))['6.6']) === 1, 'right answer: practiceStreak 6.6 = 1');
  await goLast(pg);
  await answer(pg, true);
  assert(await text(pg, '#nextBtn') === '↩ Back' && await text(pg, '#quickNext') === '↩', 'last question: ↩ Back / ↩ (no results page)');
}

// ↩ Back: Study with the same tab, chapter chip, Hide mastered chip and scroll; session cleared
async function checkBackToStudy(pg, savedY) {
  await pg.click('#nextBtn');
  const r = await pg.evaluate(() => ({
    screen: document.querySelector('.screen.active').id, ret: sessionReturn, side: isSideSession(),
    tab: document.querySelector('.study-tab.active').dataset.tab, chapter: study.chapter, hide: study.hideMastered,
    chip: !!document.querySelector('#studyChips .chip.active'), facts: document.querySelectorAll('#studyContent .fact').length,
    y: window.scrollY,
  }));
  assert(r.screen === 'screenStudy', `↩ Back opens Study, not results (${r.screen})`);
  assert(r.ret === null && !r.side, 'sessionReturn cleared');
  assert(r.tab === 'chapters' && r.chapter === 3 && r.hide && r.chip, `tab / chapter chip / Hide mastered restored (${JSON.stringify(r)})`);
  assert(r.facts > 0, 'Study content rendered');
  assert(Math.abs(r.y - savedY) <= SCROLL_TOLERANCE, `scroll position restored (${r.y} vs ${savedY})`);
}

// search box + another tab survive the round trip too
async function checkSearchRestored(pg) {
  await pg.evaluate(() => { studyToggle('hideMastered'); studySetTab('timeline'); });
  await pg.fill('#studySearch', SEARCH_TERM);
  const before = await text(pg, '#studyCount');
  await pg.evaluate(id => startFactPractice(id), FACT_ID);
  await goLast(pg);
  await answer(pg, true);
  await pg.click('#nextBtn');
  const r = await pg.evaluate(() => ({
    tab: document.querySelector('.study-tab.active').dataset.tab, box: byId('studySearch').value, search: study.search,
    count: byId('studyCount').textContent,
  }));
  assert(r.tab === 'timeline' && r.box === SEARCH_TERM && r.search === SEARCH_TERM, `timeline tab + search "${SEARCH_TERM}" restored (${JSON.stringify(r)})`);
  assert(r.count === before, `same Study results after ↩ Back (${r.count} vs ${before})`);
}

// ← Home mid-session clears the way back; a normal set afterwards ends on its results page
async function checkHomeAndAfter(pg) {
  await pg.evaluate(id => { startFactPractice(id); goHome(); }, FACT_ID);
  assert(await activeScreen(pg) === 'screenHome', '← Home mid-session goes Home');
  assert(await pg.evaluate(() => sessionReturn === null && !isSideSession()), '← Home clears sessionReturn');
  await pg.evaluate(id => { startFactPractice(id); pendingMode = PRACTICE_MODE; startExam('ch1'); }, FACT_ID);
  assert(await pg.evaluate(() => sessionReturn === null), 'startExam clears sessionReturn');
  await goLast(pg);
  await answer(pg, true);
  assert(await text(pg, '#nextBtn') === 'Finish ✓', 'a normal set afterwards: last question Finish ✓');
  await pg.click('#nextBtn');
  assert(await activeScreen(pg) === 'screenResult', 'a normal set afterwards ends on its results page');
}

// v0.63 (P3 T-206 / T-207): the fact card's source node row (display only) + "▶ Practise" button start the
// session for real; ↩ Back flashes the card gold for FACT_HIGHLIGHT_MS (Q8)
const FACT_NODES = 'E4·Q17:sqm-node mastered,E6·Q7:sqm-node weak,E7·Q15:sqm-node,E8·Q14:sqm-node,E12·Q24:sqm-node,E15·Q7:sqm-node,E16·Q17:sqm-node,E17·Q22:sqm-node';
const ONE_SOURCE_FACT = 10;
const MIN_TOUCH_PX = 44; // project touch-target standard (O2, CUI-0009)
const factCard = id => `#studyContent .fact[data-fact-id="${id}"]`;
async function openStudyChapter3(pg) {
  await pg.evaluate(() => { streaks = { '4.16': 3, '6.6': 1 }; openStudy(); studySetTab('chapters'); studySetChapter(3); });
  await pg.fill('#studySearch', '');
}
async function checkSourceRow(pg) {
  await openStudyChapter3(pg);
  const row = await pg.$eval(factCard(FACT_ID), e => {
    const btn = e.querySelector('.fact-src .fact-practise');
    return {
      nodes: [...e.querySelectorAll('.fact-src .sqm-node')].map(n => n.textContent + ':' + n.className).join(','),
      clickable: e.querySelectorAll('.fact-src .sqm-node[data-action], .fact-src button.sqm-node').length,
      appears: e.querySelectorAll('.tag.freq').length, label: e.querySelector('.fact-src .sqm-map-label')?.textContent,
      btn: btn && [btn.textContent, btn.dataset.action, btn.dataset.arg].join('|'),
      describedBy: btn && document.getElementById(btn.getAttribute('aria-describedby'))?.textContent,
    };
  });
  assert(row.nodes === FACT_NODES, 'source node row: E·Q nodes in f.src order with mastery colours: ' + row.nodes);
  assert(row.clickable === 0 && row.appears === 0 && row.label === 'Appears in:', `nodes are display only; "Appears ×n" tag gone (${JSON.stringify(row)})`);
  assert(row.btn === `▶ Practise these 8|startFactPractice|${FACT_ID}`, 'Practise button: plural label + startFactPractice action: ' + row.btn);
  assert(row.describedBy === `#${FACT_ID}`, 'Practise button is described by the card "#id": ' + row.describedBy);
  // S-030: the ~29px "▶ Practise" pill keeps its look but takes taps over >= 44px (invisible ::before ring);
  // scan the button's vertical centre line with elementFromPoint
  const hit = await pg.$eval(`${factCard(FACT_ID)} .fact-practise`, e => {
    e.scrollIntoView({ block: 'center' });
    const r = e.getBoundingClientRect(), x = r.left + r.width / 2;
    let rows = 0;
    for (let y = Math.floor(r.top) - 40; y <= Math.ceil(r.bottom) + 40; y++) if (document.elementFromPoint(x, y)?.closest('.fact-practise') === e) rows++;
    return { visible: r.height, rows };
  });
  assert(hit.rows >= MIN_TOUCH_PX, `Practise button tap height >= ${MIN_TOUCH_PX}px (visible ${hit.visible}px, tappable ${hit.rows}px)`);
  const one = await pg.$eval(`${factCard(ONE_SOURCE_FACT)} .fact-practise`, e => e.textContent);
  assert(one === '▶ Practise this one', 'one source question: ▶ Practise this one');
}
// W-012: at 390px the 2-source cards whose row fitted on one line before S-034 (form controls inherit the
// body font, "▶ Practise these 2" ~2.8px wider) must still fit: the 2nd node must not wrap under the 1st
const TWO_SOURCE_ONE_LINE_FACTS = [25, 30, 62, 67, 74, 76, 78, 128, 155, 159, 181, 225, 231];
const LINE_TOLERANCE_PX = 1;
async function checkTwoSourceRowsOneLine(pg) {
  const wrapped = await pg.evaluate(([ids, tol]) => {
    openStudy(); studySetTab('chapters');
    const bad = [];
    for (const ch of CHAPTER_NUMBERS) {
      studySetChapter(ch);
      for (const id of ids) {
        const card = document.querySelector(`#studyContent .fact[data-fact-id="${id}"]`);
        if (!card) continue;
        const nodes = [...card.querySelectorAll('.fact-src .sqm-node')].map(n => n.getBoundingClientRect());
        const btn = card.querySelector('.fact-src .fact-practise').getBoundingClientRect();
        const row = card.querySelector('.fact-src-nodes').getBoundingClientRect();
        // one line: every node on the first node's line, and the button beside them (not on a line below)
        const oneLine = nodes.length === 2 && nodes.every(n => Math.abs(n.top - nodes[0].top) <= tol)
          && row.height <= nodes[0].height + tol && btn.top < row.bottom;
        if (!oneLine) bad.push(`${id} (nodes row ${row.height}px)`);
      }
    }
    return bad;
  }, [TWO_SOURCE_ONE_LINE_FACTS, LINE_TOLERANCE_PX]);
  await openStudyChapter3(pg); // checkEntryAndFlash taps fact #21 next
  assert(wrapped.length === 0, `W-012: 390px 2-source rows stay on one line (wrapped: ${wrapped.join(', ') || 'none'})`);
}
async function checkEntryAndFlash(pg) {
  await pg.click(`${factCard(FACT_ID)} .fact-practise`);
  assert(await activeScreen(pg) === 'screenQuiz' && await text(pg, '#quizLabel') === 'Fact #21', 'Practise button opens the Fact #21 session');
  await goLast(pg);
  await answer(pg, true);
  await pg.click('#nextBtn');
  const back = await pg.$eval(factCard(FACT_ID), e => ({
    flash: e.classList.contains('flash'), outline: getComputedStyle(e).outlineColor, screen: document.querySelector('.screen.active').id,
    inView: e.getBoundingClientRect().bottom > 0 && e.getBoundingClientRect().top < innerHeight,
  }));
  const gold = await pg.evaluate(() => { const i = document.createElement('i'); i.style.color = 'var(--gold)'; document.body.append(i); const c = getComputedStyle(i).color; i.remove(); return c; });
  assert(back.screen === 'screenStudy' && back.flash && back.outline === gold && back.inView, '↩ Back: the fact card is in view with a gold highlight (Q8): ' + JSON.stringify(back));
  const ms = await pg.evaluate(() => FACT_HIGHLIGHT_MS);
  await pg.waitForTimeout(ms + 200);
  assert(!(await pg.$eval(factCard(FACT_ID), e => e.classList.contains('flash'))), `highlight removed after FACT_HIGHLIGHT_MS (${ms}ms)`);
  // R-010: a saved scroll that does not show the card (here: the top of Study) — ↩ Back brings the card into view
  await pg.evaluate(id => { window.scrollTo(0, 0); startFactPractice(id); }, FACT_ID);
  await goLast(pg);
  await answer(pg, true);
  await pg.click('#nextBtn');
  const seen = await pg.$eval(factCard(FACT_ID), e => e.getBoundingClientRect().bottom > 0 && e.getBoundingClientRect().top < innerHeight);
  assert(seen, 'R-010: card out of the restored view is scrolled into view');
}

async function checkUnknownFact(pg) {
  const r = await pg.evaluate(() => { const before = state; startFactPractice(-1); return { same: state === before, ret: sessionReturn }; });
  assert(r.same && r.ret === null, 'unknown fact id: no session, nothing stashed');
}

(async () => {
  const b = await chromium.launch(launchOpts);
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(APP_URL);
  await pg.evaluate(() => localStorage.clear());
  await pg.reload();
  await checkSetIds(pg);
  const savedY = await checkStart(pg);
  await checkInSession(pg);
  await checkBackToStudy(pg, savedY);
  await checkSearchRestored(pg);
  await checkHomeAndAfter(pg);
  await checkSourceRow(pg);
  await checkTwoSourceRowsOneLine(pg);
  await checkEntryAndFlash(pg);
  await checkUnknownFact(pg);
  assert(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join('; ') : ''));
  await b.close();
  console.log('FACTSESSION PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
