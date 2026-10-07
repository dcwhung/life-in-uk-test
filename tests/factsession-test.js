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
const STUDY_SCROLL_Y = 600;
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
  await pg.evaluate(y => window.scrollTo(0, y), STUDY_SCROLL_Y);
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
  await checkUnknownFact(pg);
  assert(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join('; ') : ''));
  await b.close();
  console.log('FACTSESSION PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
