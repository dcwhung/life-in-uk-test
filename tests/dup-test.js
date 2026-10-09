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
  await openPracticeQ(pg, '4.12');
  await answer(pg, true);
  assert(!(await panel(pg)).show, 'a fact whose sources are all copies of the answered question: no Similar panel');
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
    const out = { today: t('plan.run.allDoneToday'), day: t('plan.run.allDoneDayHtml', { day: 'X' }) };
    setLang('en');
    return { ...out, en: t('plan.run.allDoneToday'), v: APP_VERSION };
  });
  assert(w.today === '今日任務已全部完成！' && w.day === 'X 任務已全部完成！', 'zh-HK 「已全部完成」: ' + JSON.stringify(w));
  assert(w.en === "All of today's tasks are done!", 'en unchanged');
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
    await checkSimilarPanel(pg);
    await checkStandalonePanel(pg);
    await checkWording(pg);
    assert(errs.length === 0, 'no page errors: ' + errs.join(' | '));
    console.log('DUP PASS');
  } catch (e) {
    console.log(e.message); process.exitCode = 1;
  } finally { await b.close(); }
})();
