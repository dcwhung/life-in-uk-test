// QA v0.68 batch (CUI-0016, per-chapter fact numbers, S-057, S-054, Home UI, Study tab colour) — manual, not part of run-all.sh.
//   NODE_PATH=/opt/node-tools/node_modules CHROMIUM_PATH=/opt/pw-browsers/chromium \
//     node .proj-docs/qa/scripts/2026-10-08_qa-v068.js <repo-root> <screenshot-dir>
// QA_ONLY=cui16,factnum,s057,s054,home,studytab,qa2 limits the run.
// Black box: real clicks / hovers / typing; page.evaluate only seeds localStorage and reads state / computed style
// (which option is correct, which question sits on screen). Expected fact numbers come from data/study.js read in
// Node (independent of js/domain/similar.js).
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(process.argv[2] || '.');
const SHOT_DIR = path.resolve(process.argv[3] || '.');
fs.mkdirSync(SHOT_DIR, { recursive: true });
const APP_URL = 'file://' + path.join(ROOT, 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const ONLY = process.env.QA_ONLY ? process.env.QA_ONLY.split(',') : null;
const want = s => !ONLY || ONLY.includes(s);
let pass = 0, fail = 0;
const failures = [];
const ok = (c, m) => { if (c) { pass++; console.log('ok:', m); } else { fail++; failures.push(m); console.log('FAIL:', m); } };
const note = (...a) => console.log('  note:', ...a);
const GUARD_WAIT = 420; // > SCREEN_CHANGE_CLICK_GUARD_MS (350)
const ZH = 'zh-HK';
const LANGS = ['en', ZH];
const shot = n => path.join(SHOT_DIR, `${n}.png`);

// ── oracle: chapter fact numbers from the raw data ──
const ctx = {};
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'data/study.js'), 'utf8') + ';this.STUDY=STUDY;', ctx);
const STUDY = ctx.STUDY;
const EXP_NUM = {}; const perCh = {};
STUDY.forEach(f => { perCh[f.ch] = (perCh[f.ch] || 0) + 1; EXP_NUM[f.id] = perCh[f.ch]; });
const EXP_CH = Object.fromEntries(STUDY.map(f => [f.id, f.ch]));

async function newPage(b, lang, width, seed = {}) {
  const pg = await b.newPage({ viewport: { width, height: 844 }, hasTouch: false });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(APP_URL);
  await pg.evaluate(([lang, seed]) => {
    localStorage.clear();
    localStorage.setItem('lifeuk.uiLang', JSON.stringify(lang));
    localStorage.setItem('lifeuk.installDismissed', 'true');
    Object.entries(seed).forEach(([k, v]) => localStorage.setItem('lifeuk.' + k, JSON.stringify(v)));
  }, [lang, seed]);
  await pg.reload();
  await pg.waitForTimeout(150);
  return { pg, errs };
}
const click = async (pg, sel) => { await pg.click(sel); await pg.waitForTimeout(GUARD_WAIT); };
const text = (pg, sel) => pg.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim());
const innerText = (pg, sel) => pg.$eval(sel, e => e.innerText.replace(/\s+/g, ' ').trim());
const active = (pg, id) => pg.evaluate(id => document.getElementById(id).classList.contains('active'), id);
const anyVisible = (pg, sel) => pg.$$eval(sel, els => els.some(e => e.offsetParent !== null));
const ls = (pg, k) => pg.evaluate(k => JSON.parse(localStorage.getItem('lifeuk.' + k) || '{}'), k);
const picks = (pg, correct) => pg.evaluate(c => {
  const q = state.questions[state.current];
  return c ? [...q.a] : [q.o.findIndex((_, k) => !q.a.includes(k))];
}, correct);
async function answerByClick(pg, correct) { for (const oi of await picks(pg, correct)) await pg.click('#opt' + oi); }
async function playRound(pg, pattern, perQ) {
  for (let i = 0; i < pattern.length; i++) {
    if (perQ) await perQ(i);
    await answerByClick(pg, pattern[i]);
    await click(pg, '#nextBtn');
  }
}
const cssVarRgb = (pg, v) => pg.evaluate(v => { const d = document.createElement('div'); d.style.color = `var(${v})`;
  document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; }, v);
const keysRange = (exam, from, n) => Array.from({ length: n }, (_, i) => `${exam}.${from + i}`);
const toMap = keys => Object.fromEntries(keys.map(k => [k, true]));
const L = (lang, en, zh) => (lang === ZH ? zh : en);

(async () => {
  const b = await chromium.launch(launchOpts);

  // ══════════ 1. CUI-0016 ══════════
  if (want('cui16')) for (const lang of LANGS) {
    const tag = lang === ZH ? 'zh' : 'en';
    const { pg, errs } = await newPage(b, lang, 390, { wrongList: toMap(['1.0', '1.1', '1.2']) });
    await click(pg, '#modePractice');
    ok(await text(pg, '#tileWrong .t-num') === '3', `[${tag}] cui16: Home wrong tile shows 3`);
    await click(pg, '#tileWrong');
    ok(await active(pg, 'screenQuiz') && await text(pg, '#quizLabel') === L(lang, 'Wrong answers', '錯題'), `[${tag}] cui16: wrong tile opens review round`);
    await playRound(pg, [true, true, true]);
    ok(await active(pg, 'screenResult'), `[${tag}] cui16: all correct → Result`);
    ok(Object.keys(await ls(pg, 'wrongList')).length === 0, `[${tag}] cui16: wrongList emptied`);
    ok(!(await anyVisible(pg, '#screenResult .retry-btn')), `[${tag}] cui16: all cleared → no Retry`);
    ok(await anyVisible(pg, '#screenResult .another-btn'), `[${tag}] cui16: all cleared → home button still shown`);
    const anotherTxt = await pg.$eval('#screenResult .another-btn', e => e.textContent.trim());
    ok(anotherTxt === L(lang, 'Another Practice', '另一組練習'), `[${tag}] cui16: home button label "${anotherTxt}"`);
    note(`[${tag}] cui16 result note: "${await text(pg, '#resultNote')}"`);
    await pg.screenshot({ path: shot(`cui16-${tag}-all-cleared-result-390`), fullPage: true });
    // E3: language switch keeps Retry hidden
    await click(pg, '#langBtn');
    ok(!(await anyVisible(pg, '#screenResult .retry-btn')), `[${tag}] cui16 edge: Retry still hidden after language switch`);
    await click(pg, '#langBtn');
    // home button works; disabled empty tile does not start a quiz
    await click(pg, '#screenResult .another-btn');
    ok(await active(pg, 'screenHome'), `[${tag}] cui16: home button → Home`);
    // E2: wrong tile now 0 and disabled; a forced click opens no quiz (flag something so My Review shows)
    await pg.evaluate(() => { localStorage.setItem('lifeuk.practiceFlags', '{"2.0":true}'); });
    await pg.reload(); await pg.waitForTimeout(150); await click(pg, '#modePractice');
    ok(await pg.$eval('#tileWrong', e => e.disabled && e.classList.contains('empty')), `[${tag}] cui16 edge: wrong tile 0 → disabled`);
    await pg.click('#tileWrong', { force: true }); await pg.waitForTimeout(GUARD_WAIT);
    ok(await active(pg, 'screenHome') && !(await active(pg, 'screenQuiz')), `[${tag}] cui16 edge: forced click on empty tile stays Home`);

    // remaining wrong answers: Retry shown, opens a clean round
    await pg.evaluate(() => { localStorage.setItem('lifeuk.wrongList', '{"1.0":true,"1.1":true}'); localStorage.setItem('lifeuk.practiceFlags', '{}'); });
    await pg.reload(); await pg.waitForTimeout(150); await click(pg, '#modePractice');
    await click(pg, '#tileWrong');
    await playRound(pg, [true, false]);
    ok(await anyVisible(pg, '#screenResult .retry-btn'), `[${tag}] cui16: 1 left → Retry shown`);
    ok(await pg.$eval('#screenResult .retry-btn', e => e.textContent.trim()) === L(lang, 'Retry', '重做'), `[${tag}] cui16: Retry label`);
    await pg.screenshot({ path: shot(`cui16-${tag}-one-left-result-390`), fullPage: true });
    // E3b: language switch keeps a visible Retry visible
    await click(pg, '#langBtn');
    ok(await anyVisible(pg, '#screenResult .retry-btn'), `[${tag}] cui16 edge: visible Retry survives language switch`);
    await click(pg, '#langBtn');
    await click(pg, '#screenResult .retry-btn');
    const fresh = await pg.evaluate(() => ({ n: state.questions.length, answers: Object.keys(state.answers).length,
      revealed: Object.keys(state.revealed).length, cur: state.current }));
    ok(await active(pg, 'screenQuiz') && fresh.n === 1 && fresh.answers === 0 && fresh.revealed === 0 && fresh.cur === 0,
      `[${tag}] cui16: Retry → clean round of 1 (${JSON.stringify(fresh)})`);
    ok((await pg.$$('#optionsContainer .opt.selected, #optionsContainer .opt.correct, #optionsContainer .opt.wrong')).length === 0
      && !(await pg.$eval('#answerBox', e => e.classList.contains('show'))), `[${tag}] cui16: Retry → no option picked, answer box closed`);
    await pg.screenshot({ path: shot(`cui16-${tag}-retry-fresh-round-390`) });
    // E4: double click on Finish clears the last one, no error, no Retry
    await answerByClick(pg, true);
    await pg.dblclick('#nextBtn'); await pg.waitForTimeout(GUARD_WAIT);
    ok(await active(pg, 'screenResult') && !(await anyVisible(pg, '#screenResult .retry-btn')), `[${tag}] cui16 edge: double click Finish → Result, no Retry`);
    // E5: reload on the all-cleared Result → Home, no error
    await pg.reload(); await pg.waitForTimeout(200);
    ok(await active(pg, 'screenHome'), `[${tag}] cui16 edge: reload on Result → Home`);

    // flagged: unflag everything by click → no Retry
    await pg.evaluate(() => { localStorage.setItem('lifeuk.practiceFlags', '{"1.0":true,"1.1":true}'); });
    await pg.reload(); await pg.waitForTimeout(150); await click(pg, '#modePractice');
    await click(pg, '#tileFlagged'); await click(pg, '#flaggedStart');
    await playRound(pg, [true, false], async () => { await pg.click('#flagBtn'); });
    ok(await active(pg, 'screenResult') && Object.values(await ls(pg, 'practiceFlags')).every(v => !v), `[${tag}] cui16: flagged all unflagged → Result`);
    ok(!(await anyVisible(pg, '#screenResult .retry-btn')) && await anyVisible(pg, '#screenResult .another-btn'), `[${tag}] cui16: flagged emptied → no Retry, home button kept`);
    await pg.screenshot({ path: shot(`cui16-${tag}-flagged-cleared-result-390`), fullPage: true });
    // E6: flagged round, unflag both, re-flag the last → Retry visible
    await pg.evaluate(() => { localStorage.setItem('lifeuk.practiceFlags', '{"1.0":true,"1.1":true}'); });
    await pg.reload(); await pg.waitForTimeout(150); await click(pg, '#modePractice');
    await click(pg, '#tileFlagged'); await click(pg, '#flaggedStart');
    await playRound(pg, [true, true], async i => { await pg.click('#flagBtn'); if (i === 1) await pg.click('#flagBtn'); });
    ok(await anyVisible(pg, '#screenResult .retry-btn'), `[${tag}] cui16 edge: re-flag one during round → Retry shown`);
    await click(pg, '#screenResult .retry-btn');
    ok(await active(pg, 'screenQuiz') && await pg.evaluate(() => state.questions.length) === 1, `[${tag}] cui16 edge: Retry → flagged round of 1`);

    // E1: 30 wrong answers (round cap 24): clearing round 1 keeps Retry (6 left)
    const w30 = [...keysRange(3, 0, 24), ...keysRange(5, 0, 6)];
    await pg.evaluate(w => { localStorage.setItem('lifeuk.wrongList', JSON.stringify(w)); localStorage.setItem('lifeuk.practiceFlags', '{}'); }, toMap(w30));
    await pg.reload(); await pg.waitForTimeout(150); await click(pg, '#modePractice');
    ok(await text(pg, '#tileWrong .sub') === L(lang, '30 to clear', '尚餘 30 題'), `[${tag}] home: wrong tile sub "${await text(pg, '#tileWrong .sub')}" (no per-round part)`);
    await click(pg, '#tileWrong');
    ok(await pg.evaluate(() => state.questions.length) === 24, `[${tag}] cui16 edge: 30 wrong → round of 24`);
    await playRound(pg, Array(24).fill(true));
    ok(Object.keys(await ls(pg, 'wrongList')).length === 6 && await anyVisible(pg, '#screenResult .retry-btn'), `[${tag}] cui16 edge: 24 cleared, 6 left → Retry shown`);
    await click(pg, '#screenResult .retry-btn');
    ok(await pg.evaluate(() => state.questions.length) === 6, `[${tag}] cui16 edge: Retry → round of the 6 left`);
    await playRound(pg, Array(6).fill(true));
    ok(!(await anyVisible(pg, '#screenResult .retry-btn')), `[${tag}] cui16 edge: second round clears the rest → no Retry`);
    // 320px layout of the all-cleared Result
    await pg.setViewportSize({ width: 320, height: 700 });
    const ov = await pg.evaluate(() => document.documentElement.scrollWidth);
    ok(ov <= 320, `[${tag}] cui16: 320px all-cleared Result no horizontal overflow (scrollWidth ${ov})`);
    await pg.screenshot({ path: shot(`cui16-${tag}-all-cleared-result-320`), fullPage: true });
    // regression: exam result keeps Retry
    await pg.setViewportSize({ width: 390, height: 844 });
    await click(pg, '#screenResult .another-btn');
    await click(pg, '#modeExam');
    await pg.click('#examGrid .exam-btn[data-arg="1"]'); await pg.waitForTimeout(GUARD_WAIT);
    await pg.evaluate(() => { state.questions.forEach((q, i) => { state.answers[i] = [...q.a]; }); state.current = state.questions.length - 1; renderQuestion(); });
    await click(pg, '#nextBtn');
    if (await pg.$eval('#confirmModal', e => e.classList.contains('show'))) await click(pg, '#confirmOk');
    ok(await active(pg, 'screenResult') && await anyVisible(pg, '#screenResult .retry-btn'), `[${tag}] cui16 regression: exam result keeps Retry`);
    ok(errs.length === 0, `[${tag}] cui16: no page errors ${errs.join('; ')}`);
    await pg.close();
  }

  // ══════════ 2. fact numbers ══════════
  const readCards = pg => pg.$$eval('#studyContent .fact', els => els.map(e => ({
    id: Number(e.dataset.factId),
    num: (e.querySelector('.fact-id') || {}).textContent || null,
    pill: [...e.querySelectorAll('.fact-meta .tag')].map(t => t.innerText.trim()).find(s => /Ch\s*\d/i.test(s)) || null,
  })));
  const checkPills = (cards, label, tag) => {
    const bad = cards.filter(c => c.num !== null || !c.pill || !c.pill.endsWith(`Ch ${EXP_CH[c.id]} #${EXP_NUM[c.id]}`));
    ok(cards.length > 0 && bad.length === 0, `[${tag}] factnum ${label}: ${cards.length} cards, pill "Ch c #n" matches, no separate #id (bad ${JSON.stringify(bad.slice(0, 3))})`);
  };
  const groupTitlesClean = async (pg, label, tag) => {
    const t = await pg.$$eval('#studyContent .study-group-title', els => els.map(e => ({ txt: e.textContent.trim(), cnt: !!e.querySelector('.cnt') })));
    ok(t.every(x => !x.cnt && !/\s\d+$/.test(x.txt)), `[${tag}] factnum ${label}: ${t.length} group titles, no count (${t.slice(0, 3).map(x => x.txt).join(' | ')})`);
  };
  if (want('factnum')) for (const lang of LANGS) {
    const tag = lang === ZH ? 'zh' : 'en';
    const { pg, errs } = await newPage(b, lang, 390);
    await click(pg, '#modeStudy');
    await click(pg, '.study-tab[data-tab="chapters"]');
    for (let ch = 1; ch <= 5; ch++) {
      await click(pg, `#studySubChips .chip:nth-child(${ch})`);
      const cards = await readCards(pg);
      const seq = cards.map(c => c.num);
      const expSeq = cards.map((_, i) => `#${i + 1}`);
      ok(cards.length === perCh[ch] && JSON.stringify(seq) === JSON.stringify(expSeq) && cards.every(c => !c.pill),
        `[${tag}] factnum chapters Ch ${ch}: ${cards.length} cards numbered #1..#${cards.length}, no Ch pill`);
      if (ch === 3) await groupTitlesClean(pg, 'chapters', tag);
      if (ch === 3) await pg.screenshot({ path: shot(`factnum-${tag}-chapters-ch3-390`) });
    }
    for (const tab of ['timeline', 'geo', 'people']) {
      await click(pg, `.study-tab[data-tab="${tab}"]`);
      checkPills(await readCards(pg), tab, tag);
      if (tab !== 'timeline') await groupTitlesClean(pg, tab, tag);
      await pg.screenshot({ path: shot(`factnum-${tag}-${tab}-390`) });
    }
    // E: search does not renumber (chapters view, search spans chapters)
    await click(pg, '.study-tab[data-tab="chapters"]');
    await pg.fill('#studySearch', 'berlin'); await pg.waitForTimeout(250);
    let cards = await readCards(pg);
    ok(cards.length > 0 && cards.every(c => c.num === `#${EXP_NUM[c.id]}`), `[${tag}] factnum search "berlin": ${cards.map(c => c.id + '→' + c.num).join(', ')}`);
    await pg.fill('#studySearch', '1998'); await pg.waitForTimeout(250);
    cards = await readCards(pg);
    ok(cards.length > 0 && cards.every(c => c.num === `#${EXP_NUM[c.id]}`), `[${tag}] factnum search "1998": ${cards.map(c => c.id + '→' + c.num).join(', ')}`);
    await pg.screenshot({ path: shot(`factnum-${tag}-search-1998-390`) });
    await pg.fill('#studySearch', ''); await pg.waitForTimeout(250);
    // E: timeline + search + wars only keeps pill numbers
    await click(pg, '.study-tab[data-tab="timeline"]');
    await pg.fill('#studySearch', 'war'); await pg.waitForTimeout(250);
    checkPills(await readCards(pg), 'timeline search "war"', tag);
    await pg.fill('#studySearch', ''); await pg.waitForTimeout(250);
    const warChip = await pg.$('#studyChips .chip.war');
    if (warChip) { await click(pg, '#studyChips .chip.war'); checkPills(await readCards(pg), 'timeline wars-only', tag); await click(pg, '#studyChips .chip.war'); }
    // E: hide mastered after ticking the first two Ch 3 cards keeps the others' numbers
    await click(pg, '.study-tab[data-tab="chapters"]');
    await click(pg, '#studySubChips .chip:nth-child(3)');
    await pg.locator('#studyContent .fact .fact-btn.tick').nth(0).click(); await pg.waitForTimeout(150);
    await pg.locator('#studyContent .fact .fact-btn.tick').nth(1).click(); await pg.waitForTimeout(150);
    await click(pg, '#studyChips .chip:nth-child(1)'); // hide mastered
    cards = await readCards(pg);
    ok(cards.length < perCh[3] && cards.every(c => c.num === `#${EXP_NUM[c.id]}`) && cards[0].num !== '#1',
      `[${tag}] factnum hide-mastered: ${cards.length} left, first is ${cards[0] && cards[0].num}, numbers unchanged`);
    // E: geo / people sub-filter keeps pill numbers
    await click(pg, '#studyChips .chip:nth-child(1)');
    await click(pg, '.study-tab[data-tab="geo"]'); await click(pg, '#studySubChips .chip:nth-child(3)');
    checkPills(await readCards(pg), 'geo sub-filter', tag);
    await click(pg, '.study-tab[data-tab="people"]'); await click(pg, '#studySubChips .chip:nth-child(2)');
    checkPills(await readCards(pg), 'people sub-filter', tag);
    await click(pg, '#studySubChips .chip:nth-child(1)');

    // fact practice header: Ch 3 #15 (fact 21)
    await click(pg, '.study-tab[data-tab="chapters"]');
    await click(pg, '#studySubChips .chip:nth-child(3)');
    await pg.click('#studyContent .fact[data-fact-id="21"] .fact-practise'); await pg.waitForTimeout(GUARD_WAIT);
    const qlabel = await innerText(pg, '#quizLabel');
    // en: .quiz-label upper-cases the word "Fact" like every quiz label; only the lang="en" number keeps its case
    ok(qlabel === L(lang, 'FACT Ch 3 #15', '知識點 Ch 3 #15'), `[${tag}] factnum quiz header innerText "${qlabel}" (number not upper-cased)`);
    await pg.screenshot({ path: shot(`factnum-${tag}-fact-quiz-header-390`) });
    // edge (S-077 gap): the fact session's last step returns to Study; the Result label is not reached in a side session
    const n21 = await pg.evaluate(() => state.questions.length);
    await playRound(pg, Array(n21).fill(true));
    ok(await active(pg, 'screenStudy'), `[${tag}] factnum fact session (${n21} q) ends back on Study`);
    const back = await pg.$eval('#studyContent .fact[data-fact-id="21"] .fact-id', e => e.textContent).catch(() => null);
    ok(back === '#15', `[${tag}] factnum after the fact session the card still reads #15 (${back})`);

    // Similar Core Fact: fact 203 = Ch 5 #38, via a flagged round on 9.14
    await pg.evaluate(() => { localStorage.setItem('lifeuk.practiceFlags', '{"9.14":true}'); });
    await pg.reload(); await pg.waitForTimeout(150);
    await click(pg, '#modePractice'); await click(pg, '#tileFlagged'); await click(pg, '#flaggedStart');
    await answerByClick(pg, true); await pg.waitForTimeout(200);
    const core = await innerText(pg, '#similarBox .sqm-fact-label');
    ok(core === L(lang, '📌 CORE FACT Ch 5 #38', '📌 核心知識 Ch 5 #38'), `[${tag}] factnum Similar Core Fact innerText "${core}" (number keeps case)`);
    await pg.$eval('#similarBox', e => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 80));
    await pg.screenshot({ path: shot(`factnum-${tag}-similar-core-390`) });
    ok(errs.length === 0, `[${tag}] factnum: no page errors ${errs.join('; ')}`);
    await pg.close();
  }

  // ══════════ 3. S-057: every "Ch n" text node sits in lang="en" (zh-HK UI) ══════════
  if (want('s057')) {
    const { pg, errs } = await newPage(b, ZH, 390, { practiceFlags: { '9.14': true } });
    const scan = label => pg.evaluate(label => {
      const out = { n: 0, bad: [] };
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node; (node = w.nextNode());) {
        if (!/Ch \d/.test(node.textContent)) continue;
        const el = node.parentElement;
        if (!el || el.offsetParent === null) continue;
        out.n++;
        const l = el.closest('[lang]');
        if (!l || l.lang !== 'en') out.bad.push(`${label}: "${node.textContent.trim().slice(0, 30)}" lang=${l && l.lang}`);
      }
      return out;
    }, label);
    const report = (r, label) => ok(r.n > 0 && r.bad.length === 0, `[zh] s057 ${label}: ${r.n} "Ch n" nodes, all lang="en" ${r.bad.slice(0, 3).join(' / ')}`);
    await click(pg, '#modePractice'); await click(pg, '#ptabChapter');
    report(await scan('home chapter grid'), 'Home › Chapter grid');
    await pg.screenshot({ path: shot(`s057-zh-home-chapter-390`) });
    await click(pg, '#modeStudy');
    for (const tab of ['chapters', 'timeline', 'geo', 'people']) { await click(pg, `.study-tab[data-tab="${tab}"]`); report(await scan(tab), `Study ${tab}`); }
    await click(pg, '#screenStudy .back-btn');
    await click(pg, '#modePractice'); await click(pg, '#tileFlagged'); await click(pg, '#flaggedStart');
    await answerByClick(pg, true); await pg.waitForTimeout(200);
    report(await scan('similar'), 'Similar Core Fact');
    await click(pg, '#nextBtn');
    await click(pg, '#screenResult .another-btn');
    await click(pg, '#modeStudy'); await click(pg, '.study-tab[data-tab="chapters"]'); await click(pg, '#studySubChips .chip:nth-child(3)');
    await pg.click('#studyContent .fact[data-fact-id="21"] .fact-practise'); await pg.waitForTimeout(GUARD_WAIT);
    report(await scan('fact quiz'), 'fact quiz header');
    const lab = await pg.$eval('#quizLabel', e => e.innerHTML);
    ok(lab === '知識點 <span lang="en">Ch 3 #15</span>', `[zh] s057 quiz header markup ${lab}`);
    ok(errs.length === 0, `[zh] s057: no page errors ${errs.join('; ')}`);
    await pg.close();
  }

  // ══════════ 4. S-054: four Cantonese edits in the app ══════════
  if (want('s054')) for (const lang of LANGS) {
    const tag = lang === ZH ? 'zh' : 'en';
    const keys = ['3.3', '1.12', '8.2', '11.7'];
    const { pg, errs } = await newPage(b, lang, 390, { practiceFlags: toMap(keys) });
    await click(pg, '#modePractice'); await click(pg, '#tileFlagged'); await click(pg, '#flaggedStart');
    const seen = {};
    for (let i = 0; i < keys.length; i++) {
      const k = await pg.evaluate(() => qKey(state.questions[state.current]));
      await answerByClick(pg, true); await pg.waitForTimeout(150);
      seen[k] = {
        opts: await pg.$$eval('#optionsContainer .opt-yue', els => els.map(e => e.textContent)),
        ansYue: await text(pg, '#ansYue'), note: await text(pg, '#ansNote'),
      };
      if ((k === '3.3' || k === '11.7' || k === '1.12')) await pg.screenshot({ path: shot(`s054-${tag}-${k.replace('.', 'q')}-390`), fullPage: true });
      await click(pg, '#nextBtn');
    }
    ok(seen['3.3'].opts.includes('因為教宗想英格蘭變成天主教國家') && !seen['3.3'].opts.some(o => o.includes('成為')), `[${tag}] s054 E3·Q4 oy "變成" shown`);
    for (const k of ['1.12', '8.2']) ok(seen[k].note.includes('都可以去警署') && !seen[k].note.includes('亦可以'), `[${tag}] s054 ${k} note "都可以"`);
    ok(seen['11.7'].ansYue.includes('佢係第一位女首相，仲係20世紀任期最長嘅首相') && !seen['11.7'].ansYue.includes('亦係'), `[${tag}] s054 E11·Q8 answer yue "仲係"`);
    ok(seen['11.7'].opts.some(o => o.includes('仲係20世紀')), `[${tag}] s054 E11·Q8 option yue "仲係"`);
    await click(pg, '#screenResult .another-btn');
    await click(pg, '#modeStudy');
    await click(pg, '.study-tab[data-tab="chapters"]');
    await pg.fill('#studySearch', 'good friday'); await pg.waitForTimeout(250);
    const yue96 = await pg.$eval('#studyContent .fact[data-fact-id="96"] .fact-yue', e => e.textContent);
    ok(yue96.startsWith('1998 年嘅《耶穌受難日協議》（Good Friday Agreement）為北愛爾蘭') && !yue96.includes('（1998 年）'), `[${tag}] s054 fact #96 yue "${yue96.slice(0, 30)}…"`);
    await pg.screenshot({ path: shot(`s054-${tag}-fact96-390`) });
    ok(errs.length === 0, `[${tag}] s054: no page errors ${errs.join('; ')}`);
    await pg.close();
  }

  // ══════════ 5. Home UI ══════════
  if (want('home')) for (const lang of LANGS) {
    const tag = lang === ZH ? 'zh' : 'en';
    for (const width of [390, 320]) {
      const states = [
        { name: 'wrong0-flag2', seed: { practiceFlags: toMap(['2.0', '2.1']) } },
        { name: 'wrong5-flag0', seed: { wrongList: toMap(keysRange(4, 0, 5)) } },
        { name: 'wrong5-flag2', seed: { wrongList: toMap(keysRange(4, 0, 5)), practiceFlags: toMap(['2.0', '2.1']) } },
      ];
      for (const st of states) {
        const { pg, errs } = await newPage(b, lang, width, st.seed);
        await click(pg, '#modePractice');
        const info = await pg.evaluate(() => {
          const tw = document.getElementById('tileWrong'), tf = document.getElementById('tileFlagged');
          const op = el => Number(getComputedStyle(el).opacity);
          const kids = [...tw.children].map(c => ({ cls: c.className, op: op(c) }));
          const overflow = [tw, tf].some(t => { const r = t.getBoundingClientRect();
            return [...t.querySelectorAll('*')].some(c => { const cr = c.getBoundingClientRect(); return cr.width && (cr.right > r.right + 0.5 || cr.left < r.left - 0.5); }); });
          return { hW: tw.getBoundingClientRect().height, hF: tf.getBoundingClientRect().height, tileOp: op(tw), kids,
            note: (tw.querySelector('.t-note') || {}).textContent, sub: (tw.querySelector('.sub') || {}).textContent,
            fSub: (tf.querySelector('.sub') || {}).textContent || null, oldNote: !!document.getElementById('myReviewNote'),
            scrollW: document.documentElement.scrollWidth, overflow, empty: tw.classList.contains('empty'),
            fTop: tf.querySelector('.t-top').getBoundingClientRect().top - tf.getBoundingClientRect().top,
            wTop: tw.querySelector('.t-top').getBoundingClientRect().top - tw.getBoundingClientRect().top };
        });
        const pfx = `[${tag}] home ${width}px ${st.name}:`;
        ok(info.note === L(lang, 'From Practice and Exam; cleared once you get them right here. Up to 24 per round.', '來自練習及模擬考試，於此答對後便會清除。每輪最多 24 題。') && !info.oldNote, `${pfx} note inside wrong tile, old #myReviewNote gone`);
        ok(Math.abs(info.hW - info.hF) < 0.5, `${pfx} tiles same height (${info.hW} / ${info.hF})`);
        ok(Math.abs(info.wTop - info.fTop) < 0.5, `${pfx} tile content top-aligned`);
        ok(info.scrollW <= width && !info.overflow, `${pfx} no overflow (scrollWidth ${info.scrollW})`);
        if (st.name.startsWith('wrong0')) {
          const noteOp = info.kids.find(k => k.cls === 't-note').op, others = info.kids.filter(k => k.cls !== 't-note');
          ok(info.empty && info.tileOp === 1 && noteOp === 1 && others.every(k => k.op === 0.6), `${pfx} empty: note opacity 1, other parts 0.6 (${JSON.stringify(info.kids)})`);
          ok(info.sub === L(lang, 'Nothing to review yet', '暫時未有需要複習的題目'), `${pfx} empty sub "${info.sub}"`);
          const noteColor = await pg.$eval('#tileWrong .t-note', e => getComputedStyle(e).color);
          ok(noteColor === await cssVarRgb(pg, '--text-muted'), `${pfx} empty note colour = --text-muted (${noteColor})`);
        } else {
          ok(info.sub === L(lang, '5 to clear', '尚餘 5 題'), `${pfx} sub "${info.sub}"`);
          ok(info.kids.every(k => k.op === 1), `${pfx} non-empty tile parts full opacity`);
        }
        if (st.name.endsWith('flag2')) ok(info.fSub === null, `${pfx} flagged tile has no sub line`);
        else ok(info.fSub === L(lang, 'Tap  on a question to flag it', '於題目按  即可標記'), `${pfx} empty flagged tile shows how to flag ("${info.fSub}")`);
        await pg.$eval('#myReview', e => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 140)).then(() => pg.screenshot({ path: shot(`home-${tag}-myreview-${st.name}-${width}`) }));
        // practice hint list and reset button position
        const hint = await pg.evaluate(() => {
          const h = document.getElementById('practiceHint'), btn = document.querySelector('#practiceReset .reset-btn');
          const hr = h.getBoundingClientRect(), br = btn.getBoundingClientRect();
          return { li: [...h.querySelectorAll('li')].map(l => l.textContent), right: br.left >= hr.right - 0.5 && br.top < hr.bottom, br: br.right, hr: hr.right };
        });
        if (st.name === 'wrong5-flag2') {
          ok(hint.li.length === 4 && hint.li[0].includes('24') && hint.li[1].includes('3'), `${pfx} practice hint 4 bullets (${hint.li[0]})`);
          ok(hint.right && hint.br <= width, `${pfx} reset button on the right of the hint (btn right ${hint.br})`);
          await pg.$eval('#practiceReset', e => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 140)).then(() => pg.screenshot({ path: shot(`home-${tag}-practice-hint-${width}`) }));
        }
        ok(errs.length === 0, `${pfx} no page errors ${errs.join('; ')}`);
        await pg.close();
      }
    }
    // exam desc, leave modal, hovers (390)
    const { pg, errs } = await newPage(b, lang, 390, { completedExams: { 1: true }, practiceStreak: { '2.0': 3, '2.1': 3, '2.2': 3 } });
    await click(pg, '#modeExam');
    const desc = await text(pg, '#modeDesc');
    ok(desc.endsWith(L(lang, 'Submit on the last question to see your score and answers.', '於最後一題提交後，即可查看分數及答案。')) && !/Pick an exam below|請於下方選擇試卷/.test(desc), `[${tag}] home exam desc no tail sentence`);
    // exam .done hover
    await pg.hover('#examGrid .exam-btn.done'); await pg.waitForTimeout(350);
    const done = await pg.$eval('#examGrid .exam-btn.done', e => { const s = getComputedStyle(e), a = getComputedStyle(e, '::after');
      return { bg: s.backgroundColor, color: s.color, aBg: a.backgroundColor, aColor: a.color, aShadow: a.boxShadow, aContent: a.content }; });
    const green = await cssVarRgb(pg, '--green'), white = await cssVarRgb(pg, '--text-inverse'), card = await cssVarRgb(pg, '--card');
    ok(done.bg === green && done.color === white, `[${tag}] home exam .done:hover green bg / white text (${done.bg} / ${done.color})`);
    ok(done.aBg === card && done.aColor === green && done.aShadow.includes(green) && done.aBg !== done.bg, `[${tag}] home ✓ badge on hover: card circle, green tick + ring (${JSON.stringify(done)})`);
    await pg.screenshot({ path: shot(`home-${tag}-exam-done-hover-390`), clip: await pg.$eval('#examGrid', e => { const r = e.getBoundingClientRect(); return { x: 0, y: r.top + window.scrollY - 10, width: 390, height: Math.min(r.height + 20, 260) }; }) });
    // non-done exam hover still navy
    await pg.hover('#examGrid .exam-btn[data-arg="2"]'); await pg.waitForTimeout(350);
    const navy = await cssVarRgb(pg, '--navy');
    ok(await pg.$eval('#examGrid .exam-btn[data-arg="2"]', e => getComputedStyle(e).backgroundColor) === navy, `[${tag}] home exam not-done hover stays navy`);
    // leave modal
    await pg.mouse.move(0, 0);
    await click(pg, '#examGrid .exam-btn[data-arg="2"]');
    await click(pg, '#screenQuiz .back-btn');
    const cancel = await text(pg, '#confirmCancel');
    ok(cancel === L(lang, 'Cancel', '取消'), `[${tag}] home leave modal cancel label "${cancel}"`);
    await pg.screenshot({ path: shot(`home-${tag}-leave-modal-390`) });
    await click(pg, '#confirmCancel');
    ok(await active(pg, 'screenQuiz'), `[${tag}] home leave modal Cancel keeps the exam`);
    await click(pg, '#screenQuiz .back-btn'); await click(pg, '#confirmOk');
    // practice exam-button hover: mastery gold, zero muted
    await click(pg, '#modePractice'); await click(pg, '#ptabExam');
    const gold = await cssVarRgb(pg, '--gold-light'), muted = await cssVarRgb(pg, '--text-inverse-muted');
    await pg.hover('#examGrid .exam-btn[data-arg="2"]'); await pg.waitForTimeout(350);
    const m2 = await pg.$eval('#examGrid .exam-btn[data-arg="2"] .exam-mastery', e => ({ c: getComputedStyle(e).color, zero: e.classList.contains('zero'), t: e.textContent }));
    ok(!m2.zero && m2.c === gold, `[${tag}] home practice Exam 2 hover mastery gold (${m2.c} "${m2.t}")`);
    await pg.screenshot({ path: shot(`home-${tag}-practice-exam-hover-390`), clip: await pg.$eval('#examGrid', e => { const r = e.getBoundingClientRect(); return { x: 0, y: r.top + window.scrollY - 10, width: 390, height: Math.min(r.height + 20, 260) }; }) });
    await pg.hover('#examGrid .exam-btn[data-arg="3"]'); await pg.waitForTimeout(350);
    const m3 = await pg.$eval('#examGrid .exam-btn[data-arg="3"] .exam-mastery', e => ({ c: getComputedStyle(e).color, zero: e.classList.contains('zero') }));
    await pg.screenshot({ path: shot(`home-${tag}-practice-exam-hover-zero-390`), clip: await pg.$eval('#examGrid', e => { const r = e.getBoundingClientRect(); return { x: 0, y: r.top + window.scrollY - 10, width: 390, height: Math.min(r.height + 20, 260) }; }) });
    ok(m3.zero && m3.c === muted, `[${tag}] home practice Exam 3 (0%) hover mastery pale (${m3.c})`);
    ok(errs.length === 0, `[${tag}] home: no page errors ${errs.join('; ')}`);
    await pg.close();
  }

  // ══════════ 6. Study tab colour after a switch ══════════
  if (want('studytab')) for (const lang of LANGS) {
    const tag = lang === ZH ? 'zh' : 'en';
    const { pg, errs } = await newPage(b, lang, 390);
    await click(pg, '#modeStudy');
    await click(pg, '.study-tab[data-tab="chapters"]');
    await pg.mouse.move(0, 0); await pg.waitForTimeout(300);
    const navy = await cssVarRgb(pg, '--navy'), card = await cssVarRgb(pg, '--card');
    const sample = () => pg.$$eval('.study-tab', els => els.map(e => ({ tab: e.dataset.tab, active: e.classList.contains('active'), bg: getComputedStyle(e).backgroundColor })));
    // real click, then sample at once and over the next 300ms
    await pg.click('.study-tab[data-tab="timeline"]');
    const timeline = [];
    const t0 = Date.now();
    await pg.screenshot({ path: shot(`studytab-${tag}-immediate-390`), clip: { x: 0, y: 0, width: 390, height: 260 } });
    for (let i = 0; i < 8; i++) { timeline.push({ ms: Date.now() - t0, tabs: await sample() }); await pg.waitForTimeout(40); }
    await pg.waitForTimeout(300);
    const settled = await sample();
    await pg.screenshot({ path: shot(`studytab-${tag}-settled-390`), clip: { x: 0, y: 0, width: 390, height: 260 } });
    const first = timeline[0].tabs;
    note(`[${tag}] first sample @${timeline[0].ms}ms:`, first.map(t => `${t.tab}${t.active ? '*' : ''}=${t.bg}`).join(' '));
    const midSamples = timeline.filter(s => s.tabs.some(t => (t.active && t.bg !== navy) || (!t.active && t.bg !== card)));
    note(`[${tag}] samples still in transition: ${midSamples.map(s => s.ms + 'ms').join(', ') || 'none'}`);
    const act = settled.find(t => t.active), rest = settled.filter(t => !t.active);
    ok(act.tab === 'timeline' && act.bg === navy && rest.every(t => t.bg === card), `[${tag}] studytab settled: .active timeline = navy ${navy}, others = card (${settled.map(t => t.tab + '=' + t.bg).join(' ')})`);
    // hover over the active tab must not change its colour (cursor stays on it after the click)
    const hovered = await pg.$eval('.study-tab.active', e => e.matches(':hover'));
    note(`[${tag}] cursor still over the active tab: ${hovered}`);
    // all four tabs, cursor on and off
    for (const tab of ['geo', 'people', 'chapters']) {
      await pg.click(`.study-tab[data-tab="${tab}"]`); await pg.waitForTimeout(350);
      const s = await sample();
      ok(s.every(t => t.bg === (t.tab === tab ? navy : card)), `[${tag}] studytab ${tab} settled (cursor on tab): ${s.map(t => t.tab + '=' + t.bg).join(' ')}`);
    }
    // the transition-property: all 0.15s explains a mid-fade frame
    const tr = await pg.$eval('.study-tab', e => `${getComputedStyle(e).transitionProperty} ${getComputedStyle(e).transitionDuration}`);
    note(`[${tag}] .study-tab transition: ${tr}`);
    ok(errs.length === 0, `[${tag}] studytab: no page errors ${errs.join('; ')}`);
    await pg.close();
  }

  // ══════════ 7. QA round 2 additions (2026-10-08, second QA after container restart) ══════════
  if (want('qa2')) for (const lang of LANGS) {
    const tag = lang === ZH ? 'zh' : 'en';
    // QA2-1: wrong tile with exactly 1 left — sub copy, same height, no overflow at 390 / 320
    for (const width of [390, 320]) {
      const { pg, errs } = await newPage(b, lang, width, { wrongList: toMap(['4.0']), practiceFlags: toMap(['2.0']) });
      await click(pg, '#modePractice');
      const r = await pg.evaluate(() => { const tw = document.getElementById('tileWrong'), tf = document.getElementById('tileFlagged');
        return { sub: tw.querySelector('.sub').textContent, hW: tw.getBoundingClientRect().height, hF: tf.getBoundingClientRect().height,
          sw: document.documentElement.scrollWidth, num: tw.querySelector('.t-num').textContent }; });
      ok(r.num === '1' && r.sub === L(lang, '1 to clear', '尚餘 1 題') && Math.abs(r.hW - r.hF) < 0.5 && r.sw <= width,
        `[${tag}] qa2 home ${width}px wrong1: sub "${r.sub}", heights ${r.hW}/${r.hF}, scrollWidth ${r.sw}`);
      if (width === 320) await pg.$eval('#myReview', e => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - 140)).then(() => pg.screenshot({ path: shot(`qa2-${tag}-myreview-wrong1-320`) }));
      ok(errs.length === 0, `[${tag}] qa2 home ${width}px wrong1: no page errors ${errs.join('; ')}`);
      await pg.close();
    }
    // QA2-2: CUI-0016 multi-round loop — 3 wrong, miss 1 → Retry; miss again → Retry still; clear → no Retry
    {
      const { pg, errs } = await newPage(b, lang, 390, { wrongList: toMap(['6.0', '6.1', '6.2']) });
      await click(pg, '#modePractice'); await click(pg, '#tileWrong');
      await playRound(pg, [true, false, true]);
      const r1 = await anyVisible(pg, '#screenResult .retry-btn');
      await click(pg, '#screenResult .retry-btn');
      const n2 = await pg.evaluate(() => state.questions.length);
      await playRound(pg, [false]);
      const r2 = await anyVisible(pg, '#screenResult .retry-btn');
      await click(pg, '#screenResult .retry-btn');
      const n3 = await pg.evaluate(() => state.questions.length);
      await playRound(pg, [true]);
      const r3 = await anyVisible(pg, '#screenResult .retry-btn');
      ok(r1 && n2 === 1 && r2 && n3 === 1 && !r3 && Object.keys(await ls(pg, 'wrongList')).length === 0,
        `[${tag}] qa2 cui16 loop: retry1=${r1} n2=${n2} retry2=${r2} n3=${n3} retry3=${r3}`);
      await click(pg, '#screenResult .another-btn');
      ok(await active(pg, 'screenHome'), `[${tag}] qa2 cui16 loop: home button after final clear → Home`);
      ok(errs.length === 0, `[${tag}] qa2 cui16 loop: no page errors ${errs.join('; ')}`);
      await pg.close();
    }
    // QA2-3: fact-number pills at 320px — no horizontal overflow, numbers intact
    {
      const { pg, errs } = await newPage(b, lang, 320);
      await click(pg, '#modeStudy');
      for (const tab of ['timeline', 'geo', 'people']) {
        await click(pg, `.study-tab[data-tab="${tab}"]`);
        const cards = await readCards(pg);
        const sw = await pg.evaluate(() => document.documentElement.scrollWidth);
        const pillOv = await pg.$$eval('#studyContent .fact', els => els.filter(f => { const r = f.getBoundingClientRect();
          return [...f.querySelectorAll('.fact-meta .tag')].some(t => t.getBoundingClientRect().right > r.right + 0.5); }).length);
        ok(sw <= 320 && pillOv === 0 && cards.every(c => c.pill && c.pill.endsWith(`Ch ${EXP_CH[c.id]} #${EXP_NUM[c.id]}`)),
          `[${tag}] qa2 factnum 320px ${tab}: ${cards.length} cards, scrollWidth ${sw}, pills overflowing ${pillOv}`);
        if (tab === 'timeline') await pg.screenshot({ path: shot(`qa2-${tag}-factnum-timeline-320`) });
      }
      ok(errs.length === 0, `[${tag}] qa2 factnum 320px: no page errors ${errs.join('; ')}`);
      await pg.close();
    }
    // QA2-4: Study tab — wait for the real transitionend of background-color, then read .active colour
    {
      const { pg, errs } = await newPage(b, lang, 390);
      await click(pg, '#modeStudy'); await click(pg, '.study-tab[data-tab="chapters"]');
      await pg.mouse.move(0, 0); await pg.waitForTimeout(300);
      const navy = await cssVarRgb(pg, '--navy'), card = await cssVarRgb(pg, '--card');
      const ends = pg.evaluate(() => new Promise(res => {
        const seen = new Set(); const t0 = performance.now();
        document.querySelectorAll('.study-tab').forEach(el => el.addEventListener('transitionend', e => {
          if (e.propertyName === 'background-color') seen.add(el.dataset.tab);
          if (seen.has('timeline') && seen.has('chapters')) res({ ms: Math.round(performance.now() - t0), tabs: [...seen] });
        }));
        setTimeout(() => res({ ms: -1, tabs: [...seen] }), 1500);
      }));
      await pg.focus('.study-tab[data-tab="timeline"]'); await pg.keyboard.press('Enter');
      const ev = await ends;
      const s = await pg.$$eval('.study-tab', els => els.map(e => ({ tab: e.dataset.tab, active: e.classList.contains('active'), bg: getComputedStyle(e).backgroundColor })));
      ok(ev.ms >= 0 && s.find(t => t.active).tab === 'timeline' && s.every(t => t.bg === (t.active ? navy : card)),
        `[${tag}] qa2 studytab keyboard: transitionend after ${ev.ms}ms (${ev.tabs}); ${s.map(t => t.tab + (t.active ? '*' : '') + '=' + t.bg).join(' ')}`);
      await pg.screenshot({ path: shot(`qa2-${tag}-studytab-transitionend-390`), clip: { x: 0, y: 0, width: 390, height: 260 } });
      ok(errs.length === 0, `[${tag}] qa2 studytab keyboard: no page errors ${errs.join('; ')}`);
      await pg.close();
    }
  }
  // QA2-5: S-057 in the en UI — "Ch n" nodes resolve to lang="en" too
  if (want('qa2')) {
    const { pg, errs } = await newPage(b, 'en', 390);
    await click(pg, '#modeStudy');
    const r = await pg.evaluate(() => {
      const out = { n: 0, bad: 0 };
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node; (node = w.nextNode());) {
        if (!/Ch \d/.test(node.textContent) || !node.parentElement || node.parentElement.offsetParent === null) continue;
        out.n++; const l = node.parentElement.closest('[lang]'); if (!l || l.lang !== 'en') out.bad++;
      }
      return out;
    });
    ok(r.n > 0 && r.bad === 0, `[en] qa2 s057 en UI Study: ${r.n} "Ch n" nodes, ${r.bad} not lang="en"`);
    ok(errs.length === 0, `[en] qa2 s057: no page errors ${errs.join('; ')}`);
    await pg.close();
  }

  await b.close();
  console.log(`\n${pass} pass, ${fail} fail`);
  if (fail) { console.log('failures:\n  ' + failures.join('\n  ')); process.exit(1); }
})().catch(e => { console.error(e); process.exit(2); });
