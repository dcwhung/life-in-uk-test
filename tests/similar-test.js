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

  // Exam 12, Q6 (12.5, local councils) shares fact #203 with 9.14 and 12.18
  const openQ = (mode, exam, origIdx) => pg.evaluate(({ mode, exam, origIdx }) => {
    pendingMode = mode; startExam(exam);
    state.current = state.questions.findIndex(q => q.origIdx === origIdx);
    renderQuestion();
  }, { mode, exam, origIdx });
  const answer = correct => pg.evaluate(correct => {
    const i = state.current, q = state.questions[i];
    state.answers[i] = correct ? [...q.a] : [q.o.findIndex((_, k) => !q.a.includes(k))];
    revealAnswer();
  }, correct);

  await pg.evaluate(() => { localStorage.setItem('lifeuk.practiceStreak', JSON.stringify({ '9.14': 3, '12.18': 1 })); });
  await pg.reload();
  await openQ('practice', 12, 5);
  assert(!(await vis('#similarBox')), 'similar section hidden before answering');

  await answer(true);
  assert(await vis('#similarBox'), 'similar section shown after a correct answer');
  assert((await text('#similarBox .sqm-title b')) === 'Similar Questions', 'English section title');
  assert((await text('#similarBox .sqm-title span')) === 'Same fact, asked differently', 'subtitle has no mastery count');
  assert((await text('#similarBox .sqm-count')) === '+2', 'count badge +2');
  // 2026-10-07: the Core Fact shows the per-chapter "Ch n #k" (counted here from STUDY), not the global "#203"
  const coreNum = await pg.evaluate(() => {
    const f = STUDY.find(x => x.id === 203);
    return `Ch ${f.ch} #${STUDY.filter(x => x.ch === f.ch).indexOf(f) + 1}`;
  });
  const coreLabel = () => pg.$eval('#similarBox .sqm-fact-label', e => {
    const num = [...e.querySelectorAll('[lang="en"]')].map(s => s.textContent);
    return { text: e.textContent.replace(/\s+/g, ' ').trim(), num };
  });
  const enLabel = await coreLabel();
  assert(enLabel.text === `📌 Core Fact ${coreNum}` && enLabel.num.includes(coreNum) && !enLabel.text.includes('#203'),
    `core fact label "📌 Core Fact ${coreNum}", number in lang="en": ` + JSON.stringify(enLabel));
  await pg.evaluate(() => setLang('zh-HK'));
  const zhLabel = await coreLabel();
  assert(zhLabel.text === `📌 核心知識 ${coreNum}` && zhLabel.num.includes(coreNum), `zh-HK core fact label "📌 核心知識 ${coreNum}": ` + JSON.stringify(zhLabel));
  await pg.evaluate(() => setLang('en'));
  assert((await text('#similarBox .sqm-fact-en')).startsWith('Towns, cities and rural areas'), 'core fact English');
  // v0.62 (P3 T-106, O8): Core Fact keeps its gold fill but shares the Study fact card shape (4px border, --radius-md, 12px 14px)
  const coreShape = await pg.$eval('#similarBox .sqm-fact', e => {
    const cs = getComputedStyle(e);
    const md = getComputedStyle(document.documentElement).getPropertyValue('--radius-md').trim();
    return { border: cs.borderLeftWidth, radius: [cs.borderTopLeftRadius, cs.borderBottomLeftRadius, cs.borderTopRightRadius].every(r => r === md), padding: cs.padding };
  });
  assert(coreShape.border === '4px' && coreShape.radius && coreShape.padding === '12px 14px', 'core fact shape matches Study fact card: ' + JSON.stringify(coreShape));
  // v0.63 (P3 T-203, Q3-1): the Core Fact is factCardHtml's core variant (gold card, no buttons / node row)
  const core = await pg.evaluate(() => {
    const fn = typeof factCardHtml === 'function';
    const flat = s => s.replace(/\s+/g, ' ');
    const expected = fn ? new DOMParser().parseFromString(factCardHtml(STUDY.find(f => f.id === 203), { variant: 'core' }), 'text/html').body.firstChild.outerHTML : '';
    return {
      fn,
      same: fn && flat(document.querySelector('#similarBox .sqm-fact').outerHTML) === flat(expected),
      extras: document.querySelectorAll('#similarBox .sqm-fact button, #similarBox .sqm-fact .fact-src').length,
    };
  });
  assert(core.fn && core.same && core.extras === 0, 'Core Fact = factCardHtml(f, { variant: core }), no buttons / source row: ' + JSON.stringify(core));
  const nodes = await pg.$$eval('#similarBox .sqm-node', els => els.map(e => e.textContent + ':' + e.className));
  assert(JSON.stringify(nodes) === JSON.stringify(['E12·Q6:sqm-node current', 'E9·Q15:sqm-node mastered', 'E12·Q19:sqm-node weak']), 'appears-in chips (E9·Q15, 1-based) with state: ' + nodes);
  const ids = await pg.$$eval('#similarBox .sqm-id', els => els.map(e => e.textContent));
  assert(JSON.stringify(ids) === JSON.stringify(['Exam 9 · Q15', 'Exam 12 · Q19']), 'every similar question listed: ' + ids);
  const streaks = await pg.$$eval('#similarBox .sqm-streak', els => els.map(e => e.textContent));
  assert(JSON.stringify(streaks) === JSON.stringify(['🏆 Mastered', '🔥 1/3']), 'per-question streak: ' + streaks);
  assert((await text('#similarBox .sqm-q')) === 'What do local councils do?', 'question text shown');
  // the translation is read from the data (Track 2 rewrites yue wording), not hard-coded
  const qYue = await pg.evaluate(() => EXAMS[9][14].yue);
  assert(qYue && (await text('#similarBox .sqm-qy')) === qYue, 'question translation shown (EXAMS[9][14].yue): ' + qYue);
  const boxText = await text('#similarBox');
  assert(!boxText.includes('Provide local services') && !boxText.includes('represent their local community'), 'no answers shown');
  assert((await pg.$$('#similarBox .sqm-angle')).length === 0, 'no question-angle tags');
  assert((await text('#similarBox .sqm-cta button')) === '▶ Practise these 2', 'practise button');
  // CUI-0007: the button label is a plural — one similar question reads "this one", not "these 1"
  assert(await pg.evaluate(() => t('similar.practise', { n: 1 })) === '▶ Practise this one', 'practise plural one: ▶ Practise this one');
  assert(await pg.evaluate(() => t('similar.practise', { n: 3 })) === '▶ Practise these 3', 'practise plural other: ▶ Practise these 3');
  assert(await pg.evaluate(() => {
    const nav = document.querySelector('#screenQuiz .nav-row'), box = document.getElementById('similarBox');
    return !!(nav.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING);
  }), 'Prev / Next sit above the similar section');
  await pg.screenshot({ path: 'shot-similar.png', fullPage: true });

  // wrong answer also shows the section
  await openQ('practice', 12, 5);
  await answer(false);
  assert(await vis('#similarBox'), 'similar section shown after a wrong answer');

  // a fact with exactly two source questions -> one similar question -> singular button label
  const pair = await pg.evaluate(() => {
    const f = STUDY.find(f => f.src.length === 2);
    const [e, i] = f.src[0].split('.').map(Number);
    return { e, i };
  });
  await openQ('practice', pair.e, pair.i);
  await answer(true);
  assert((await text('#similarBox .sqm-cta button')) === '▶ Practise this one', 'one similar question: ▶ Practise this one');

  // question whose fact has no other source questions -> hidden
  const lonely = await pg.evaluate(() => {
    const f = STUDY.find(f => f.src.length === 1);
    const [e, i] = f.src[0].split('.').map(Number);
    return { e, i };
  });
  await openQ('practice', lonely.e, lonely.i);
  await answer(true);
  assert(!(await vis('#similarBox')), 'hidden when the fact has no similar questions');

  // exam mode: never shown
  await openQ('exam', 12, 5);
  await pg.evaluate(() => { const q = state.questions[state.current]; state.answers[state.current] = [...q.a]; renderQuestion(); });
  assert(!(await vis('#similarBox')), 'hidden in exam mode');

  // practise these N: one-off session, then back to the original question
  await openQ('practice', 12, 5);
  await answer(true);
  const before = await pg.evaluate(() => ({ len: state.questions.length, cur: state.current, examNum: state.examNum }));
  await pg.click('#similarBox .sqm-cta button');
  assert(await pg.evaluate(() => state.questions.map(qKey).join(',') === '9.14,12.18'), 'temporary session holds only the similar questions');
  assert((await text('#quizLabel')) === 'Similar Questions', 'session label');
  assert((await text('#qNum')).startsWith('Question 1 of 2'), 'progress counts the similar questions');
  await answer(false);
  assert(!(await vis('#similarBox')), 'no nested similar section inside the temporary session');
  assert(await pg.evaluate(() => state.questions.length === 2), 'wrong answer is not re-queued (each question once)');
  assert(await pg.evaluate(() => JSON.parse(localStorage.getItem('lifeuk.practiceStreak'))['9.14'] === 0), 'streak still recorded in the temporary session');
  assert((await text('#nextBtn')) === 'Next →', 'next button before the last question');
  await pg.click('#nextBtn');
  await answer(true);
  // plain "Back": a question number read like Q1 of the similar session
  assert((await text('#nextBtn')) === '↩ Back', 'last question offers the way back');
  await pg.click('#nextBtn');
  const after = await pg.evaluate(() => ({ len: state.questions.length, cur: state.current, examNum: state.examNum }));
  assert(JSON.stringify(after) === JSON.stringify(before), 'original session restored at the same question');
  assert(await vis('#similarBox') && await vis('#answerBox'), 'original question still shows its answer and similar section');

  // leaving to Home drops the stashed session
  await pg.click('#similarBox .sqm-cta button');
  await pg.evaluate(() => goHome());
  assert(await pg.evaluate(() => sessionReturn === null), 'home clears the temporary session');

  assert(errs.length === 0, 'no page errors: ' + errs.join('; '));
  console.log('SIMILAR PASS');
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
