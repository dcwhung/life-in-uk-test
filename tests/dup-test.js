const { chromium } = require('playwright-core');
const path = require('path');
// v1.0.7 (G40, user 2026-10-09): some questions have the same text in several exams (17 facts, 19 extra keys).
// One question text is one question wherever a fact's sources are listed: the fact card's source row and the
// Similar panel merge the copies into one node ("E7·Q16 = E13·Q1"), a practise button counts distinct questions
// and its session asks each once; answering any copy writes the same streak to every copy (read: the copies' max).
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const DUP_FACTS = 17;
const DUP_EXTRA_KEYS = 19;
const ST_GEORGE = 98;      // src ['10.0', '7.15', '13.0']: 13.0 has the same text as 7.15
const ST_GEORGE_CH = 4;
const TWIN_FIRST = '7.15'; // first copy in exam order (the canonical key)
const TWIN_LATER = '13.0';
const ALL_TWINS = 67;      // src ['4.12', '15.5']: one question asked twice
const ALL_TWINS_LATER = '15.5';
const ALL_COPY_FACTS = [67, 81, 116, 128, 130, 147, 185, 230, 231];
const TRIPLE = ['8.13', '12.23', '15.6']; // fact #21: three copies of one question text
const TRIPLE_CH = 3;
const PLAN_DAY = '2026-10-09';
const WRONG_SET = 'wrong';
const FLAGGED_SET = 'flagged';
const MASTERY_LAST = 2; // one correct answer away from mastered
const NARROW_W = 320;
const FACT_CARD = id => `#studyContent .fact[data-fact-id="${id}"]`;

const answer = (pg, correct) => pg.evaluate(c => {
  const i = state.current, q = state.questions[i];
  state.answers[i] = c ? [...q.a] : [q.o.findIndex((_, k) => !q.a.includes(k))];
  revealAnswer();
}, correct);
const openPracticeQ = (pg, key) => pg.evaluate(k => {
  const [exam, idx] = k.split('.').map(Number);
  pendingMode = PRACTICE_MODE; startExam(exam);
  state.current = state.questions.findIndex(q => q.origIdx === idx);
  renderQuestion();
}, key);
const setStreaks = (pg, s) => pg.evaluate(v => { streaks = v; saveStreaks(); }, s);

async function checkDomain(pg) {
  const d = await pg.evaluate(([later, f98]) => {
    const groups = STUDY.map(f => questionGroups(f.src));
    return {
      copies: questionCopies(later), canon: canonQuestionKey(later), self: canonQuestionKey('99.99'),
      g98: questionGroups(STUDY.find(f => f.id === f98).src),
      facts: groups.filter((g, i) => g.length < STUDY[i].src.length).length,
      extra: groups.reduce((n, g, i) => n + STUDY[i].src.length - g.length, 0),
      planSame: Object.keys(PLAN_CANON_QKEY).every(k => planCanonKey(k) === canonQuestionKey(k)),
    };
  }, [TWIN_LATER, ST_GEORGE]);
  assert(same(d.copies, [TWIN_FIRST, TWIN_LATER]) && d.canon === TWIN_FIRST && d.self === '99.99', 'questionCopies / canonQuestionKey: ' + JSON.stringify(d));
  assert(same(d.g98, [['10.0'], [TWIN_FIRST, TWIN_LATER]]), 'questionGroups keeps the source order, copies in exam order: ' + JSON.stringify(d.g98));
  assert(d.facts === DUP_FACTS && d.extra === DUP_EXTRA_KEYS, `${DUP_FACTS} facts / ${DUP_EXTRA_KEYS} extra keys have a copy (${d.facts} / ${d.extra})`);
  assert(d.planSame, 'the plan uses the same canonical keys (one source of truth)');
}

// answering any copy writes the same streak to every copy: right = the copies' max + 1 (capped), wrong = 0
async function checkStreakSync(pg) {
  const run = (s, key, correct) => pg.evaluate(({ s, key, correct }) => {
    streaks = { ...s };
    recordPracticeAnswer(questionByKey(key), correct);
    return { a: streaks['7.15'], b: streaks['13.0'], stored: getLS(STREAK_LS)['13.0'] };
  }, { s, key, correct });
  const up = await run({ [TWIN_FIRST]: 2 }, TWIN_LATER, true);
  assert(up.a === 3 && up.b === 3 && up.stored === 3, 'right on 13.0 (7.15 at 2): both copies 3, saved: ' + JSON.stringify(up));
  const cap = await run({ [TWIN_FIRST]: 3, [TWIN_LATER]: 3 }, TWIN_FIRST, true);
  assert(cap.a === 3 && cap.b === 3, 'capped at MASTERY_STREAK: ' + JSON.stringify(cap));
  const down = await run({ [TWIN_FIRST]: 3, [TWIN_LATER]: 1 }, TWIN_FIRST, false);
  assert(down.a === 0 && down.b === 0, 'wrong on 7.15: both copies 0: ' + JSON.stringify(down));
  // old data (copies differ): read as the copies' max, so the mastery counts and the merged node agree
  const old = await pg.evaluate(([first, later, all]) => {
    streaks = { [first]: 3, '4.12': 3 };
    return { later: streakOf(questionByKey(later)), mastered: isMastered(questionByKey(later)),
      fact: factMastery(STUDY.find(f => f.id === all)).derived, plan: planMasteredKeys(streaks).has(first) };
  }, [TWIN_FIRST, TWIN_LATER, ALL_TWINS]);
  assert(old.later === 3 && old.mastered && old.fact && old.plan, 'old data: a copy reads the max streak (isMastered, factMastery, plan G37): ' + JSON.stringify(old));
}

// S-143(b): the plan hook gets the answered copy's key and the plan day; (c) outside the plan the wrong list stays per copy
async function checkPlanAndWrongList(pg) {
  const hook = await pg.evaluate(([later, day]) => {
    const real = window.recordPlanAnswer, calls = [];
    window.recordPlanAnswer = (...args) => { calls.push(args); return null; };
    try { streaks = {}; recordPracticeAnswer(questionByKey(later), true, day); } finally { window.recordPlanAnswer = real; }
    return { calls, a: streaks['7.15'], b: streaks['13.0'] };
  }, [TWIN_LATER, PLAN_DAY]);
  assert(same(hook.calls, [[TWIN_LATER, true, PLAN_DAY]]) && hook.a === 1 && hook.b === 1, 'planDay path: one plan hook call with the answered copy, streaks synced: ' + JSON.stringify(hook));
  await setStreaks(pg, {});
  await pg.evaluate(() => { wrongList = {}; setLS(WRONG_LS, wrongList); });
  await openPracticeQ(pg, TWIN_LATER);
  await answer(pg, false);
  const wrong = await pg.evaluate(() => Object.keys(wrongList));
  assert(same(wrong, [TWIN_LATER]), 'outside the plan a wrong answer lists only the answered copy: ' + wrong);
}

// W-046: a Practice round asks one copy per question text, so a synced streak moves at most once a round
const canonDupes = pg => pg.evaluate(() => {
  const canon = state.questions.map(q => canonQuestionKey(qKey(q)));
  return canon.length - new Set(canon).size;
});
const answerRound = (pg, correct) => pg.evaluate(c => {
  state.questions.forEach((q, i) => { state.current = i; state.answers[i] = c ? [...q.a] : [q.o.findIndex((_, k) => !q.a.includes(k))]; revealAnswer(); });
}, correct);
// every question of chapter ch mastered except the given keys (left at streak n)
const masterChapterBut = (pg, ch, keys, n) => pg.evaluate(({ ch, keys, n }) => {
  streaks = {}; chapterQuestions(ch).forEach(q => { streaks[qKey(q)] = keys.includes(qKey(q)) ? n : MASTERY_STREAK; }); saveStreaks();
}, { ch, keys, n });
const startSet = (pg, set, mode = 'practice') => pg.evaluate(({ set, mode }) => { pendingMode = mode; startExam(set); }, { set, mode });
const ROUND_TRIES = 15;
async function checkRounds(pg) {
  await masterChapterBut(pg, TRIPLE_CH, TRIPLE, 0);
  await startSet(pg, 'ch' + TRIPLE_CH);
  const ch = await pg.evaluate(() => state.questions.map(qKey));
  assert(ch.length === 1 && TRIPLE.includes(ch[0]), 'chapter round with only the 3 copies left: asks one of them: ' + ch);
  await answerRound(pg, true);
  const st = await pg.evaluate(keys => keys.map(k => streaks[k]), TRIPLE);
  assert(same(st, [1, 1, 1]), 'one round moves the copies\' streak by 1, not 3: ' + st);
  await pg.evaluate(keys => { wrongList = Object.fromEntries(keys.map(k => [k, true])); setLS(WRONG_LS, wrongList); }, TRIPLE);
  await startSet(pg, WRONG_SET);
  assert(await pg.evaluate(() => state.questions.length) === 1, 'wrong-answers round holding 3 copies asks one');
  await pg.evaluate(keys => { practiceFlags = Object.fromEntries(keys.map(k => [k, true])); }, [TWIN_FIRST, TWIN_LATER]);
  await startSet(pg, FLAGGED_SET);
  assert(await pg.evaluate(() => state.questions.length) === 1, 'flagged round holding 2 copies asks one');
  await setStreaks(pg, {});
  for (const set of ['all', 'ch' + TRIPLE_CH, 'ch' + ST_GEORGE_CH, 'd1', 'd3']) {
    let dupes = 0;
    for (let i = 0; i < ROUND_TRIES; i++) { await startSet(pg, set); dupes += await canonDupes(pg); }
    assert(dupes === 0, `${set}: ${ROUND_TRIES} rounds, never two copies of one question`);
  }
  // timed exam papers keep their real questions (no paper holds two copies; Exam 13 still has 13.0)
  await startSet(pg, 13, 'exam');
  assert(await pg.evaluate(() => state.questions.length === EXAMS[13].length && state.questions.some(q => qKey(q) === '13.0')), 'Exam 13 paper unchanged');
  await pg.evaluate(() => leaveToHome());
}

// S-141(b): "Mastered N more this round" counts the questions asked this round, not their unasked copies
async function checkResultNote(pg) {
  await masterChapterBut(pg, ST_GEORGE_CH, [TWIN_FIRST, TWIN_LATER], MASTERY_LAST);
  await startSet(pg, 'ch' + ST_GEORGE_CH);
  await answerRound(pg, true);
  await pg.evaluate(() => finishExam());
  const note = await pg.$eval('#resultNote', e => e.textContent);
  assert(/^Mastered 1 more this round · (\d+)\/\1 in /.test(note), 'one copy asked and mastered: 1 more (both copies count in the set total): ' + note);
  await pg.evaluate(() => leaveToHome());
}

// S-140: a merged ref only breaks between copies (" = "), never inside "Exam 12 · Q24" (320px, with the plan's mark)
async function checkRefWrap(pg) {
  await pg.setViewportSize({ width: NARROW_W, height: 700 });
  await setStreaks(pg, {});
  await openPracticeQ(pg, '4.16');
  await answer(pg, true);
  const r = await pg.evaluate(keys => {
    const box = byId('similarBox'), q = questionByKey(keys[0]);
    box.innerHTML = similarPanelHtml(q, similarGroups(q), { currentMark: t('plan.run.youGotWrong') });
    const refs = [...box.querySelectorAll('.sqm-item:first-child .sqm-id .sqm-ref')];
    return { n: refs.length, ws: refs.map(e => getComputedStyle(e).whiteSpace), lines: refs.map(e => e.getClientRects().length),
      wide: document.documentElement.scrollWidth };
  }, TRIPLE.slice().reverse());
  assert(r.n === TRIPLE.length && r.ws.every(w => w === 'nowrap') && r.lines.every(l => l === 1), '320px: each ref in a merged ref stays on one line: ' + JSON.stringify(r));
  assert(r.wide <= NARROW_W, '320px: no horizontal scroll: ' + r.wide);
  await pg.setViewportSize({ width: 390, height: 844 });
  await pg.evaluate(() => leaveToHome());
}

async function sourceRow(pg) {
  return pg.$eval(FACT_CARD(ST_GEORGE), e => ({
    nodes: [...e.querySelectorAll('.fact-src .sqm-node')].map(n => n.textContent + ':' + n.className),
    btn: e.querySelector('.fact-src .fact-practise').textContent,
    label: e.querySelector('.fact-src .sqm-map-label').textContent,
  }));
}
async function checkFactCard(pg) {
  await setStreaks(pg, { [TWIN_FIRST]: 3 });
  await pg.evaluate(ch => { openStudy(); studySetTab('chapters'); studySetChapter(ch); }, ST_GEORGE_CH);
  await pg.fill('#studySearch', '');
  const en = await sourceRow(pg);
  assert(same(en.nodes, ['E10·Q1:sqm-node', 'E7·Q16 = E13·Q1:sqm-node mastered']), 'source row merges the copies, coloured by the max streak: ' + en.nodes);
  assert(en.btn === '▶ Practise these 2' && en.label === 'Appears in:', 'Practise counts distinct questions: ' + en.btn);
  await pg.evaluate(() => setLang('zh-HK'));
  const zh = await sourceRow(pg);
  assert(same(zh.nodes, en.nodes) && zh.btn === '▶ 練習這 2 題' && zh.label === '出現於：', 'zh-HK: ' + JSON.stringify(zh));
  await pg.evaluate(() => setLang('en'));
  const node = await pg.$eval(`${FACT_CARD(ST_GEORGE)} .sqm-node.mastered`, e => getComputedStyle(e).whiteSpace);
  assert(node === 'nowrap', 'a merged node never wraps inside: ' + node);
  await pg.evaluate(id => startFactPractice(id), ST_GEORGE);
  const keys = await pg.evaluate(() => state.questions.map(qKey));
  assert(same(keys, ['10.0', TWIN_FIRST]), 'startFactPractice asks each distinct question once: ' + keys);
  await pg.evaluate(() => { clearSideSession(); showScreen('screenHome'); });
}

async function panel(pg) {
  return pg.evaluate(() => ({
    show: document.getElementById('similarBox').classList.contains('show'),
    nodes: [...document.querySelectorAll('#similarBox .sqm-node')].map(n => n.textContent + ':' + n.className),
    ids: [...document.querySelectorAll('#similarBox .sqm-id')].map(e => e.textContent),
    count: document.querySelector('#similarBox .sqm-count')?.textContent,
    cta: document.querySelector('#similarBox .sqm-cta button')?.textContent,
  }));
}
async function checkSimilarPanel(pg) {
  await setStreaks(pg, {});
  await openPracticeQ(pg, TWIN_LATER);
  await answer(pg, true);
  const a = await panel(pg);
  assert(same(a.nodes, ['E13·Q1 = E7·Q16:sqm-node current', 'E10·Q1:sqm-node']), 'answering 13.0: its copy joins the current node: ' + a.nodes);
  assert(same(a.ids, ['Exam 10 · Q1']) && a.count === '+1' && a.cta === '▶ Practise this one', 'one distinct other question: ' + JSON.stringify(a));
  await openPracticeQ(pg, '10.0');
  await answer(pg, false);
  const b = await panel(pg);
  assert(same(b.nodes, ['E10·Q1:sqm-node current', 'E7·Q16 = E13·Q1:sqm-node weak']) && b.count === '+1', 'answering 10.0: the copies are one node: ' + b.nodes);
  assert(same(b.ids, ['Exam 7 · Q16 = Exam 13 · Q1']) && b.cta === '▶ Practise this one', 'one item card, refs joined: ' + b.ids);
  await pg.evaluate(() => startSimilarPractice());
  const keys = await pg.evaluate(() => state.questions.map(qKey));
  assert(same(keys, [TWIN_FIRST]), 'the Similar session asks the copies once: ' + keys);
  await pg.evaluate(() => returnFromSideSession());
}

// S-141(a), user 2026-10-09: a fact whose sources are all copies of the answered question (9 facts) still shows the
// panel with the core fact card and the merged current node, but no item list, count badge, legend or practise button
async function soloPanel(pg) {
  return pg.evaluate(() => {
    const box = document.getElementById('similarBox'), has = sel => !!box.querySelector(sel);
    return { show: box.classList.contains('show'), fact: has('.sqm-fact'), nodes: [...box.querySelectorAll('.sqm-node')].map(n => n.textContent + ':' + n.className),
      label: box.querySelector('.sqm-map-label')?.textContent, list: has('.sqm-list, .sqm-item'), count: has('.sqm-count'), legend: has('.sqm-legend'), cta: has('.sqm-cta') };
  });
}
async function checkAllCopiesPanel(pg) {
  const ids = await pg.evaluate(() => STUDY.filter(f => f.src.length > 1 && questionGroups(f.src).length === 1).map(f => f.id));
  assert(same(ids, ALL_COPY_FACTS), 'the facts whose sources are all copies of one question: ' + ids);
  await openPracticeQ(pg, ALL_TWINS_LATER);
  await answer(pg, true);
  const p = await soloPanel(pg);
  assert(p.show && p.fact && same(p.nodes, ['E15·Q6 = E4·Q13:sqm-node current']), 'all copies: panel shown, core fact + merged current node: ' + JSON.stringify(p));
  assert(!p.list && !p.count && !p.legend && !p.cta, 'all copies: no item list, count badge, legend or practise button: ' + JSON.stringify(p));
  await pg.evaluate(() => setLang('zh-HK'));
  const zh = await soloPanel(pg);
  assert(zh.show && zh.label === '出現於：' && same(zh.nodes, p.nodes) && !zh.cta, 'zh-HK: 出現於 + merged node: ' + JSON.stringify(zh));
  await pg.evaluate(() => setLang('en'));
  // the plan runner's wrong-facts panel (planFactCardHtml: currentMark + its own cta) always lists the wrong answer
  // itself (CUI-0025), so it keeps its card, count and the plan's practise button for these facts too
  const plan = await pg.evaluate(([k, id]) => {
    const q = questionByKey(k), box = document.createElement('div');
    box.innerHTML = similarPanelHtml(q, similarGroups(q), { cta: { action: 'planPractiseFact', arg: id, n: 1 }, currentMark: 'wrong' });
    const has = sel => !!box.querySelector(sel);
    return { fact: has('.sqm-fact'), map: has('.sqm-map .sqm-node.current'), ids: [...box.querySelectorAll('.sqm-id')].map(e => e.textContent),
      count: box.querySelector('.sqm-count')?.textContent, cta: box.querySelector('.sqm-cta button')?.dataset.action };
  }, [ALL_TWINS_LATER, ALL_TWINS]);
  assert(plan.fact && plan.map && same(plan.ids, ['Exam 15 · Q6 = Exam 4 · Q13 · wrong']) && plan.count === '1' && plan.cta === 'planPractiseFact',
    'plan runner panel, all copies: the wrong answer listed once, count 1, the plan CTA: ' + JSON.stringify(plan));
  // a fact with a single source question still has no panel (nothing to map), as before G40
  const solo = await pg.evaluate(() => STUDY.find(f => f.src.length === 1).src[0]);
  await openPracticeQ(pg, solo);
  await answer(pg, true);
  assert(!(await soloPanel(pg)).show, 'a one-source fact: no Similar panel (' + solo + ')');
}

// the study plan's wrong-facts panel (currentMark): the answered question and its copies come first, counted once
async function checkStandalonePanel(pg) {
  const p = await pg.evaluate(later => {
    const q = questionByKey(later), box = document.createElement('div');
    box.innerHTML = similarPanelHtml(q, similarGroups(q), { currentMark: 'wrong' });
    return { count: box.querySelector('.sqm-count').textContent, ids: [...box.querySelectorAll('.sqm-id')].map(e => e.textContent),
      cta: box.querySelector('.sqm-cta button').textContent };
  }, TWIN_LATER);
  assert(p.count === '2' && same(p.ids, ['Exam 13 · Q1 = Exam 7 · Q16 · wrong', 'Exam 10 · Q1']), 'standalone panel: 2 distinct questions: ' + JSON.stringify(p));
}

async function checkWording(pg) {
  const w = await pg.evaluate(() => {
    setLang('zh-HK');
    const out = { today: t('plan.run.allDoneToday'), day: t('plan.run.allDoneDayHtml', { day: 'X' }),
      home: t('plan.home.doneHtml'), mock: t('plan.run.mockPassNote'), pill: t('plan.status.done') };
    setLang('en');
    return { ...out, en: t('plan.run.allDoneToday'), enHome: t('plan.home.doneHtml'), enMock: t('plan.run.mockPassNote'), enPill: t('plan.status.done'), v: APP_VERSION };
  });
  assert(w.today === '今日任務已全部完成！' && w.day === 'X 任務已全部完成！', 'zh-HK 「已全部完成」: ' + JSON.stringify(w));
  assert(w.home === '<b>✓ 今日已完成</b>，明日再來' && w.mock === '✓ 模擬考試任務已完成' && w.pill === '✓ 已完成', 'zh-HK 「已完成」 (home card, mock pass, day pill): ' + JSON.stringify(w));
  assert(w.en === "All of today's tasks are done!" && w.enHome === '<b>✓ Done for today</b>, see you tomorrow' && w.enMock === '✓ Mock exam task done', 'en unchanged: ' + w.enPill);
  assert(w.enPill === '✓ Done', 'en day pill unchanged');
  assert(w.v === '1.0.7', 'APP_VERSION 1.0.7: ' + w.v);
}

(async () => {
  const b = await chromium.launch(launchOpts);
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(APP_URL);
  await pg.evaluate(() => localStorage.clear()); await pg.reload();
  try {
    await checkDomain(pg);
    await checkStreakSync(pg);
    await checkFactCard(pg);
    await checkPlanAndWrongList(pg);
    await checkSimilarPanel(pg);
    await checkAllCopiesPanel(pg);
    await checkStandalonePanel(pg);
    await checkRounds(pg);
    await checkResultNote(pg);
    await checkRefWrap(pg);
    await checkWording(pg);
    assert(errs.length === 0, 'no page errors: ' + errs.join(' | '));
    console.log('DUP PASS');
  } catch (e) {
    console.log(e.message); process.exitCode = 1;
  } finally { await b.close(); }
})();
