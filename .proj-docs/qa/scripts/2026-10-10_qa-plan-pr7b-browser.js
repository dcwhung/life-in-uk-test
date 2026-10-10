// QA plan PR7b (G40 ①–⑧, v1.0.7: same-text questions across exams are one question): real-browser checks over http
//   node 2026-10-10_qa-plan-pr7b-browser.js <repo-root> <shot-dir>
// S. Study cards #98 (St George, 3 src / 2 questions) and #21 (8 src / 6 questions): merged node, "Practise these N",
//    the session asks each once (UI clicks), 375 + 320 × en + zh-HK, overflow
// P. Practice Similar panel after answering E10·Q1 (click), its CTA session; an all-copy fact (#67) panel; 320px
// R. chapter rounds never show two copies (UI-started, 12 rounds × 2 chapters); a round with only the 3 copies left
//    asks 1, streak +1 on all three; exam papers unchanged
// W. wrong list with 3 copies: Home tile 1, one round clears all, result note; F. flag sync via 🔖 button, flagged list
//    merged, unflag from the list clears every copy; Home tiles
// U. upgrade: old localStorage with differing copy streaks / flags / wrong entries (+ a stale key) loads clean
// L. plan runner: reading card source row + practise n, practice task dedup + G37 (old max streak) + G38 (wrong copy
//    cleared), day finished → zh「已」strings, schedule pill at 320px, mock pass note
const { chromium } = require('playwright-core');
const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(process.argv[2]); const SHOTS = path.resolve(process.argv[3] || '/tmp/qa-pr7b-shots');
fs.mkdirSync(SHOTS, { recursive: true });
const { startPagesServer } = require(path.join(ROOT, 'tests', 'pages-server.js'));
let pass = 0, fail = 0; const notes = [];
const ok = (c, m) => { if (c) { pass++; console.log('ok:', m); } else { fail++; console.log('FAIL:', m); } };
const note = m => { notes.push(m); console.log('note:', m); };
const launchOpts = { args: ['--no-sandbox'] }; if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const TODAY = '2026-10-08'; const at = (iso, time = '09:00:00') => new Date(`${iso}T${time}`);
const settle = (pg, ms = 150) => pg.waitForTimeout(ms);
const GUARD_MS = 420;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const norm = s => (s || '').replace(/\s+/g, ' ').trim();
const stripTags = s => s.replace(/<[^>]+>/g, '');
const screen = pg => pg.evaluate(() => document.querySelector('.screen.active').id);
const T = (pg, key, vars) => pg.evaluate(([k, v]) => t(k, v || undefined), [key, vars || null]);
const TRIPLE = ['8.13', '12.23', '15.6'];
const overflow = (pg, sel) => pg.evaluate(sel => {
  const root = document.querySelector(sel); if (!root) return ['no root ' + sel];
  const vw = document.documentElement.clientWidth, out = [];
  if (document.documentElement.scrollWidth > vw) out.push(`page scrollWidth ${document.documentElement.scrollWidth} > ${vw}`);
  root.querySelectorAll('*').forEach(e => {
    if (!e.getClientRects().length) return;
    const hasText = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (!hasText) return;
    const s = getComputedStyle(e), r = e.getBoundingClientRect();
    if (r.right > vw + 0.5) out.push(`past viewport: "${e.textContent.trim().slice(0, 30)}" right ${Math.round(r.right)}`);
    const clipX = /hidden|clip/.test(s.overflowX) || s.textOverflow === 'ellipsis';
    if (clipX && e.scrollWidth > e.clientWidth + 1) out.push(`clipped-x: "${e.textContent.trim().slice(0, 30)}"`);
  });
  return out;
}, sel);

async function boot(pg, base, { lang = 'en', ls = {}, query = '' } = {}) {
  await pg.goto(base); await pg.evaluate(({ lang, ls }) => { localStorage.clear(); localStorage.setItem('lifeuk.installDismissed', 'true');
    Object.entries(ls).forEach(([k, v]) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)));
    localStorage.setItem('lifeuk.uiLang', JSON.stringify(lang)); }, { lang, ls });
  await pg.goto(base + query); await settle(pg, 400);
}
const curKey = pg => pg.evaluate(() => qKey(state.questions[state.current]));
async function answer(pg, right) {
  const c = await pg.evaluate(() => { const q = state.questions[state.current]; return { a: q.a, n: q.o.length }; });
  const picks = right ? c.a : [...Array(c.n).keys()].filter(x => !c.a.includes(x)).slice(0, c.a.length);
  for (const oi of picks) await pg.click('#opt' + oi);
  await settle(pg, 60);
}
async function playAll(pg, right = true) { // answer every question of the round through the UI, then Next past the end
  for (let i = 0; i < 40; i++) {
    if ((await screen(pg)) !== 'screenQuiz') return;
    const c = await pg.evaluate(() => ({ i: state.current, n: state.questions.length }));
    await answer(pg, right); await pg.click('#nextBtn'); await settle(pg, c.i === c.n - 1 ? GUARD_MS : 40);
  }
}
const streaksOf = (pg, keys) => pg.evaluate(ks => { const s = JSON.parse(localStorage.getItem('lifeuk.practiceStreak') || '{}'); return ks.map(k => s[k] || 0); }, keys);
const lsKeys = (pg, k) => pg.evaluate(k => Object.keys(JSON.parse(localStorage.getItem(k) || '{}')).sort(), k);
const panel = pg => pg.evaluate(() => {
  const box = byId('similarBox'), has = s => !!box.querySelector(s);
  return { show: box.classList.contains('show'), nodes: [...box.querySelectorAll('.sqm-node')].map(n => n.textContent + (n.classList.contains('current') ? '*' : '')),
    ids: [...box.querySelectorAll('.sqm-id')].map(e => e.textContent), count: box.querySelector('.sqm-count')?.textContent || null,
    cta: box.querySelector('.sqm-cta button')?.textContent || null, fact: has('.sqm-fact'), legend: has('.sqm-legend'), list: has('.sqm-item') };
});
// a practice round of exam n started from Home's Exam tab (UI), then jump to question key k
async function practiseExamQ(pg, n, k) {
  await pg.evaluate(() => goHome()); await settle(pg, GUARD_MS);
  await pg.click('#modePractice'); await settle(pg, 120);
  if (!(await pg.isVisible('#examGrid button'))) { await pg.click('#ptabExam'); await settle(pg, 120); }
  await pg.click(`#examGrid button[data-arg="${n}"]`); await settle(pg, GUARD_MS);
  const i = await pg.evaluate(k => state.questions.findIndex(q => qKey(q) === k), k);
  if (i < 0) return false;
  await pg.evaluate(i => goToQuestion(i), i); await settle(pg, 60);
  return true;
}

async function runLang(b, base, lang) {
  const L = lang === 'en' ? 'en' : 'zh';
  const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
  const pg = await ctx.newPage(); pg.setDefaultTimeout(8000); const errs = [];
  pg.on('pageerror', e => errs.push('pageerror: ' + e.message));
  pg.on('console', m => { if (m.type() === 'error' || /\[i18n\] missing/.test(m.text())) errs.push('console: ' + m.text()); });
  const shot = (name, full = false) => pg.screenshot({ path: path.join(SHOTS, `${L}-${name}.png`), fullPage: full });
  const over = async (label, sel) => { const o = await overflow(pg, sel); ok(o.length === 0, `[${L}] ${label}: no overflow${o.length ? ' — ' + o.join('; ') : ''}`); };
  await pg.clock.install({ time: at(TODAY) });
  await boot(pg, base, { lang, ls: { 'lifeuk.practiceStreak': { '7.15': 3 } } });

  // ── S: Study cards ──
  const card = async id => pg.$eval(`#studyContent .fact[data-fact-id="${id}"]`, e => ({
    nodes: [...e.querySelectorAll('.fact-src .sqm-node')].map(n => n.textContent + (n.classList.contains('mastered') ? '(m)' : n.classList.contains('weak') ? '(w)' : '')),
    btn: e.querySelector('.fact-practise').textContent }));
  const practN = n => T(pg, 'similar.practise', { n });
  for (const w of [375, 320]) {
    await pg.setViewportSize({ width: w, height: 812 });
    await pg.click('#modeStudy'); await settle(pg, GUARD_MS);
    await pg.fill('#studySearch', 'patron saint of England'); await settle(pg, 200);
    const c98 = await card(98);
    ok(same(c98.nodes, ['E10·Q1', 'E7·Q16 = E13·Q1(m)']) && c98.btn === await practN(2), `[${L} ${w}] #98 source row ${c98.nodes.join(' | ')} / "${c98.btn}"`);
    await pg.$eval('#studyContent .fact[data-fact-id="98"]', e => e.scrollIntoView({ block: 'center' }));
    await over(`#98 card ${w}px`, '#studyContent .fact[data-fact-id="98"]'); await shot(`study-98-${w}`);
    await pg.fill('#studySearch', 'Magna Carta'); await settle(pg, 200);
    const c21 = await card(21);
    ok(c21.nodes.length === 6 && c21.nodes.includes('E8·Q14 = E12·Q24 = E15·Q7') && c21.btn === await practN(6), `[${L} ${w}] #21 source row ${c21.nodes.join(' | ')} / "${c21.btn}"`);
    const wrap = await pg.$$eval('#studyContent .fact[data-fact-id="21"] .fact-src .sqm-node', ns => ns.map(n => n.getClientRects().length));
    ok(wrap.every(x => x === 1), `[${L} ${w}] #21 merged node stays on one line (${wrap})`);
    await pg.$eval('#studyContent .fact[data-fact-id="21"]', e => e.scrollIntoView({ block: 'center' }));
    await over(`#21 card ${w}px`, '#studyContent .fact[data-fact-id="21"]'); await shot(`study-21-${w}`);
    await pg.fill('#studySearch', ''); await pg.evaluate(() => goHome()); await settle(pg, GUARD_MS);
  }
  await pg.setViewportSize({ width: 375, height: 812 });
  await pg.click('#modeStudy'); await settle(pg, GUARD_MS);
  await pg.fill('#studySearch', 'Magna Carta'); await settle(pg, 200);
  await pg.click('#studyContent .fact[data-fact-id="21"] .fact-practise'); await settle(pg, GUARD_MS);
  const s21 = await pg.evaluate(() => ({ keys: state.questions.map(qKey), qnum: byId('qNum').textContent }));
  const canon21 = await pg.evaluate(ks => ks.map(canonQuestionKey), s21.keys);
  ok(s21.keys.length === 6 && new Set(canon21).size === 6 && s21.qnum.includes(lang === 'en' ? 'of 6' : '6'), `[${L}] #21 ▶ session: 6 distinct questions (${s21.keys}) "${s21.qnum}"`);
  await playAll(pg, true);
  ok((await streaksOf(pg, TRIPLE)).every(x => x === 1), `[${L}] #21 session: triple copies all streak 1 after one answer (${await streaksOf(pg, TRIPLE)})`);
  if ((await screen(pg)) === 'screenQuiz') await pg.evaluate(() => returnFromSideSession());
  await settle(pg, GUARD_MS);
  note(`[${L}] after #21 session, screen = ${await screen(pg)}`);

  // ── P: Similar panel ──
  await pg.evaluate(() => { localStorage.setItem('lifeuk.practiceStreak', '{}'); streaks = {}; });
  ok(await practiseExamQ(pg, 10, '10.0'), `[${L}] Exam 10 practice holds 10.0`);
  await answer(pg, true);
  const p10 = await panel(pg);
  ok(p10.show && same(p10.nodes, ['E10·Q1*', 'E7·Q16 = E13·Q1']) && p10.count === '+1' && same(p10.ids, [lang === 'en' ? 'Exam 7 · Q16 = Exam 13 · Q1' : await pg.evaluate(() => copiesRefText(['7.15', '13.0']).replace(/<[^>]+>/g, ''))]) && p10.cta === await practN(1),
    `[${L}] E10·Q1 panel: ${JSON.stringify(p10)}`);
  await pg.$eval('#similarBox', e => e.scrollIntoView()); await over('Similar panel E10·Q1', '#similarBox'); await shot('similar-10.0', true);
  await pg.setViewportSize({ width: 320, height: 700 }); await settle(pg, 100);
  await over('Similar panel E10·Q1 320px', '#similarBox'); await shot('similar-10.0-320', true);
  await pg.setViewportSize({ width: 375, height: 812 });
  await pg.click('#similarBox .sqm-cta button'); await settle(pg, GUARD_MS);
  const sim = await pg.evaluate(() => state.questions.map(qKey));
  ok(sim.length === 1 && ['7.15', '13.0'].includes(sim[0]), `[${L}] Similar ▶ session asks the copies once: ${sim}`);
  await playAll(pg, true); await settle(pg, GUARD_MS);
  ok(same(await streaksOf(pg, ['7.15', '13.0']), [1, 1]), `[${L}] Similar session: both copies streak 1`);
  note(`[${L}] after Similar session, screen = ${await screen(pg)}, back at ${await pg.evaluate(() => state.questions[state.current] && qKey(state.questions[state.current]))}`);
  // all-copy fact #67 (4.12 / 15.5)
  ok(await practiseExamQ(pg, 15, '15.5'), `[${L}] Exam 15 practice holds 15.5`);
  await answer(pg, false);
  const p67 = await panel(pg);
  ok(p67.show && p67.fact && same(p67.nodes, ['E15·Q6 = E4·Q13*']) && !p67.count && !p67.cta && !p67.legend && !p67.list, `[${L}] #67 all-copy panel: ${JSON.stringify(p67)}`);
  await pg.setViewportSize({ width: 320, height: 700 }); await settle(pg, 100);
  await over('Similar panel #67 320px', '#similarBox'); await shot('similar-67-320', true);
  await pg.setViewportSize({ width: 375, height: 812 });
  ok(same(await lsKeys(pg, 'lifeuk.wrongList'), ['15.5']), `[${L}] wrong answer outside the plan lists only the answered copy`);

  // ── R: chapter rounds ──
  await pg.evaluate(() => { streaks = {}; saveStreaks(); });
  let dup = 0, rounds = 0;
  for (const ch of [3, 4]) for (let i = 0; i < 6; i++) {
    await pg.evaluate(() => goHome()); await settle(pg, GUARD_MS);
    await pg.click('#ptabChapter'); await settle(pg, 80);
    await pg.click(`#chapterGrid button[data-arg="${ch}"]`); await settle(pg, GUARD_MS);
    dup += await pg.evaluate(() => { const c = state.questions.map(q => canonQuestionKey(qKey(q))); return c.length - new Set(c).size; }); rounds++;
  }
  ok(dup === 0, `[${L}] ${rounds} UI-started chapter rounds (Ch 3 / 4): never two copies`);
  await pg.evaluate(keys => { streaks = {}; chapterQuestions(3).forEach(q => { if (!keys.includes(qKey(q))) streaks[qKey(q)] = 3; }); saveStreaks(); }, TRIPLE);
  await pg.evaluate(() => goHome()); await settle(pg, GUARD_MS);
  await pg.click('#chapterGrid button[data-arg="3"]'); await settle(pg, GUARD_MS);
  const r3 = await pg.evaluate(() => state.questions.map(qKey));
  ok(r3.length === 1 && TRIPLE.includes(r3[0]), `[${L}] Ch 3 with only the triple unmastered: 1 question (${r3})`);
  await playAll(pg, true);
  ok(same(await streaksOf(pg, TRIPLE), [1, 1, 1]), `[${L}] streak rises by 1 on all three copies`);
  const rn = await pg.evaluate(() => byId('resultNote').textContent);
  note(`[${L}] Ch 3 result note: "${rn}"`);
  // exam papers: Exam 7 and 13 keep 7.15 / 13.0
  await pg.evaluate(() => goHome()); await settle(pg, GUARD_MS);
  await pg.click('#modeExam'); await settle(pg, 120);
  await pg.click('#examGrid button[data-arg="13"]'); await settle(pg, GUARD_MS);
  ok(await pg.evaluate(() => state.questions.length === EXAMS[13].length && state.questions[0] && qKey(state.questions[0]) === '13.0'), `[${L}] Exam mode: Exam 13 paper unchanged, starts with 13.0`);
  await pg.evaluate(() => leaveToHome()); await settle(pg, GUARD_MS);
  await pg.click('#modePractice'); await settle(pg, 120);

  // ── W: wrong list with 3 copies ──
  await pg.evaluate(keys => { wrongList = Object.fromEntries(keys.map(k => [k, true])); setLS(WRONG_LS, wrongList); streaks = {}; saveStreaks(); renderMyReview(); }, TRIPLE);
  ok(await pg.$eval('#tileWrong .t-num', e => e.textContent) === '1', `[${L}] Home wrong tile: 3 copies = 1`);
  await shot('home-tiles-wrong');
  await pg.click('#tileWrong'); await settle(pg, GUARD_MS);
  ok(await pg.evaluate(() => state.questions.length) === 1, `[${L}] wrong round asks 1`);
  await playAll(pg, true);
  const wr = await pg.evaluate(() => ({ note: byId('resultNote').textContent, left: Object.keys(getLS(WRONG_LS) || {}) }));
  ok(wr.left.length === 0 && wr.note === await T(pg, 'result.clearedNote', { n: 1, left: 0 }), `[${L}] one right answer clears all 3: "${wr.note}"`);
  await over('Result (wrong round)', '#screenResult');
  await pg.evaluate(() => goHome()); await settle(pg, GUARD_MS);
  ok(await pg.$eval('#tileWrong', e => e.disabled), `[${L}] Home wrong tile empty after`);

  // ── F: flags ──
  await pg.evaluate(() => { practiceFlags = {}; setLS(FLAGS_LS, practiceFlags); });
  await practiseExamQ(pg, 13, '13.0');
  await pg.click('#flagBtn'); await settle(pg, 80);
  ok(same(await lsKeys(pg, 'lifeuk.practiceFlags'), ['13.0', '7.15']), `[${L}] 🔖 on 13.0 flags both copies`);
  await practiseExamQ(pg, 7, '7.15');
  ok(await pg.$eval('#flagBtn', e => e.classList.contains('on') || e.getAttribute('aria-pressed') === 'true'), `[${L}] 7.15 shows flagged`);
  await pg.evaluate(keys => { keys.forEach(k => { practiceFlags[k] = true; }); setLS(FLAGS_LS, practiceFlags); }, TRIPLE);
  await pg.evaluate(() => goHome()); await settle(pg, GUARD_MS);
  ok(await pg.$eval('#tileFlagged .t-num', e => e.textContent) === '2', `[${L}] Home flagged tile: 5 keys = 2 questions`);
  await over('Home review tiles', '#myReview'); await shot('home-tiles');
  await pg.click('#tileFlagged'); await settle(pg, GUARD_MS);
  const fl = await pg.evaluate(() => ({ items: [...document.querySelectorAll('#flaggedList .flag-item small')].map(e => e.textContent), start: byId('flaggedStart').textContent }));
  ok(fl.items.length === 2 && fl.items.some(s => s.includes(lang === 'en' ? 'Exam 7 · Q16 = Exam 13 · Q1' : ' = ')) && fl.start.includes(norm(stripTags(await T(pg, 'flagged.practise', { n: 2 })))), `[${L}] flagged list merged: ${JSON.stringify(fl)}`);
  for (const w of [375, 320]) { await pg.setViewportSize({ width: w, height: 700 }); await settle(pg, 100); await over(`flagged list ${w}px`, '#screenFlagged'); await shot(`flagged-${w}`, true); }
  await pg.setViewportSize({ width: 375, height: 812 });
  await pg.click('#flaggedList .flag-item:nth-child(1) button'); await settle(pg, 200);
  const afterUn = await lsKeys(pg, 'lifeuk.practiceFlags');
  ok(afterUn.length === 2 || afterUn.length === 3, `[${L}] unflag first item clears all its copies: left ${afterUn}`);
  await pg.click('#flaggedList .flag-item:nth-child(1) button'); await settle(pg, 200);
  ok((await lsKeys(pg, 'lifeuk.practiceFlags')).length === 0 && (await pg.$$('#flaggedList .flag-item')).length === 0, `[${L}] unflag second item: list empty, no flags stored`);

  ok(errs.length === 0, `[${L}] no page errors / missing i18n${errs.length ? ': ' + errs.join(' | ') : ''}`);
  await ctx.close();
}

// ── U: upgrade with old data ──
async function partU(b, base) {
  const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
  const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await pg.clock.install({ time: at(TODAY) });
  await boot(pg, base, { lang: 'zh-HK', ls: {
    'lifeuk.practiceStreak': { '7.15': 3, '13.0': 1, '8.13': 2, '12.23': 0, '15.6': 1, '4.12': 0, '15.5': 3 },
    'lifeuk.practiceFlags': { '13.0': true, '12.23': true },
    'lifeuk.wrongList': { '8.13': true, '15.6': true, '7.15': true, '1.3': true },
  } });
  await pg.click('#modePractice'); await settle(pg, 150);
  const tiles = await pg.evaluate(() => [byId('tileWrong').querySelector('.t-num').textContent, byId('tileFlagged').querySelector('.t-num').textContent]);
  ok(same(tiles, ['3', '2']), `[U] old data: Home wrong 4 keys = 3 questions, flagged 2 keys = 2 (${tiles})`);
  const rd = await pg.evaluate(() => ({ s13: streakOf(questionByKey('13.0')), m13: isMastered(questionByKey('13.0')), s12: streakOf(questionByKey('12.23')), f7: isPracticeFlagged(questionByKey('7.15')), f8: isPracticeFlagged(questionByKey('8.13')) }));
  ok(rd.s13 === 3 && rd.m13 && rd.s12 === 2 && rd.f7 && rd.f8, `[U] old data reads max streak / any-copy flag: ${JSON.stringify(rd)}`);
  await pg.click('#tileFlagged'); await settle(pg, GUARD_MS);
  const fl = await pg.$$eval('#flaggedList .flag-item small', es => es.map(e => e.textContent));
  note(`[U] old one-copy flags list: ${JSON.stringify(fl)} (only stored copies are named)`);
  await pg.evaluate(() => goHome()); await settle(pg, GUARD_MS);
  await pg.click('#tileWrong'); await settle(pg, GUARD_MS);
  const wq = await pg.evaluate(() => state.questions.map(qKey));
  ok(wq.length === 3, `[U] wrong round asks 3 distinct (${wq})`);
  await playAll(pg, true);
  const st = await pg.evaluate(() => JSON.parse(localStorage.getItem('lifeuk.practiceStreak')));
  ok(st['8.13'] === 3 && st['12.23'] === 3 && st['15.6'] === 3 && st['7.15'] === 3 && st['13.0'] === 3, `[U] right answer writes max+1 (capped) to every copy: ${JSON.stringify(st)}`);
  ok((await lsKeys(pg, 'lifeuk.wrongList')).length === 0, '[U] wrong list emptied');
  // a stale key from an old build (not in EXAMS) in streaks / wrong list: Home still loads
  await pg.evaluate(() => { localStorage.setItem('lifeuk.practiceStreak', JSON.stringify({ '99.99': 2, '7.15': 1 })); });
  await pg.reload(); await settle(pg, 400);
  ok(await screen(pg) === 'screenHome', '[U] stale streak key: Home loads');
  ok(errs.length === 0, `[U] no page errors${errs.length ? ': ' + errs.join(' | ') : ''}`);
  await ctx.close();
}

// ── L: study plan runner + zh「已」 ──
async function partL(b, base, lang) {
  const L = lang === 'en' ? 'en' : 'zh';
  const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
  const pg = await ctx.newPage(); pg.setDefaultTimeout(8000); const errs = [];
  pg.on('pageerror', e => errs.push('pageerror: ' + e.message));
  pg.on('console', m => { if (m.type() === 'error' || /\[i18n\] missing/.test(m.text())) errs.push('console: ' + m.text()); });
  const shot = (name, full = false) => pg.screenshot({ path: path.join(SHOTS, `${L}-${name}.png`), fullPage: full });
  const over = async (label, sel) => { const o = await overflow(pg, sel); ok(o.length === 0, `[${L}] ${label}: no overflow${o.length ? ' — ' + o.join('; ') : ''}`); };
  await pg.clock.install({ time: at(TODAY) });
  await boot(pg, base, { lang, query: '?preview=plan', ls: { 'lifeuk.wrongList': { '1.3': true, '3.12': true } } });
  await pg.click('#planCard .plan-cta'); await settle(pg, GUARD_MS);
  await pg.click('#planCreateBtn'); await settle(pg, GUARD_MS);
  await pg.click('#screenPlanSchedule .back-btn'); await settle(pg, GUARD_MS);
  ok(await pg.evaluate(() => !!planLoad()), `[${L}] plan created via UI`);
  // Day 1: finish it (practice 1, 3, 5, review 6) → all done
  const boxSel = (d, i) => `#planTaskList button[data-arg="${d}"][data-task="${i}"]`;
  await pg.evaluate(() => openPlanDay()); await settle(pg, 250);
  const tasks = await pg.evaluate(d => planDayAt(planLoad(), d).tasks.map(x => x.type), TODAY);
  for (const i of tasks.map((x, i) => (x === 'read' ? -1 : i)).filter(i => i >= 0)) {
    if ((await screen(pg)) !== 'screenPlanDay') { await pg.evaluate(() => openPlanDay()); await settle(pg, 250); }
    await pg.click(boxSel(TODAY, i)); await settle(pg, GUARD_MS);
    if (tasks[i] === 'practice' || tasks[i] === 'review' || tasks[i] === 'drill') {
      const n = await pg.evaluate(() => state.questions.length), c = await pg.evaluate(() => { const k = state.questions.map(q => canonQuestionKey(qKey(q))); return k.length - new Set(k).size; });
      ok(c === 0, `[${L}] Day 1 task ${i} (${tasks[i]}, ${n} Q): no two copies`);
    }
    await playAll(pg, true);
    if (i !== tasks.length - 1) { await pg.click('#planRunBack'); await settle(pg, GUARD_MS); }
  }
  const all = await pg.evaluate(() => byId('planRunBody').querySelector('.result-label')?.textContent.replace(/\s+/g, ' ').trim());
  const allExp = norm(await T(pg, 'plan.run.allDoneToday'));
  ok(all === allExp && (lang === 'en' || all === '今日任務已全部完成！'), `[${L}] all done: "${all}"`);
  for (const w of [375, 320]) { await pg.setViewportSize({ width: w, height: 700 }); await settle(pg, 100); await over(`all-done card ${w}px`, '#screenPlanRun'); await shot(`plan-alldone-${w}`); }
  await pg.setViewportSize({ width: 375, height: 812 });
  await pg.evaluate(() => goHome()); await settle(pg, GUARD_MS);
  const homeDone = await pg.$eval('#planCard', e => e.innerText.replace(/\s+/g, ' '));
  const hd = norm(stripTags(await T(pg, 'plan.home.doneHtml')));
  ok(homeDone.includes(hd) && (lang === 'en' || hd.includes('✓ 今日已完成')), `[${L}] Home done "${hd}"`);
  await over('Home plan card (done)', '#planCard'); await shot('plan-home-done');
  // schedule pill at 320 / 375 (a past 100% day: next morning)
  await pg.clock.setSystemTime(at('2026-10-09')); await pg.goto(base + '?preview=plan'); await settle(pg, 400);
  await pg.evaluate(() => openPlanSchedule()); await settle(pg, 300);
  const pillTxt = await T(pg, 'plan.status.done');
  for (const w of [320, 375]) {
    await pg.setViewportSize({ width: w, height: 760 }); await settle(pg, 150);
    const pill = await pg.evaluate(txt => { const e = [...document.querySelectorAll('#planDayList .plan-pill.ok')].find(x => x.textContent.trim() === txt); if (!e) return null;
      const r = e.getBoundingClientRect(), lh = parseFloat(getComputedStyle(e).lineHeight) || r.height; return { lines: Math.round(r.height / lh), right: Math.round(r.right), w: Math.round(r.width) }; }, pillTxt);
    ok(pill && pill.lines === 1 && pill.right <= w, `[${L} ${w}] schedule pill "${pillTxt}" one line ${JSON.stringify(pill)}`);
    await over(`schedule ${w}px`, '#planDayList'); await shot(`plan-schedule-${w}`);
  }
  await pg.setViewportSize({ width: 375, height: 812 });
  // find a read task with #98 or #21 and the practice task that has their questions
  const found = await pg.evaluate(() => { const p = planLoad(); for (const d of p.days) for (let i = 0; i < d.tasks.length; i++) { const t0 = d.tasks[i];
    if (t0.type === 'read' && (t0.facts || []).some(f => f === 98 || f === 21)) return { date: d.date, i, facts: t0.facts }; } return null; });
  ok(!!found, `[${L}] a read task holds #98 / #21: ${JSON.stringify(found)}`);
  if (found) {
    const fid = found.facts.includes(98) ? 98 : 21;
    await pg.clock.setSystemTime(at(found.date)); await pg.goto(base + '?preview=plan'); await settle(pg, 400);
    await pg.evaluate(() => openPlanDay()); await settle(pg, 250);
    await pg.click(boxSel(found.date, found.i)); await settle(pg, GUARD_MS);
    for (let s = 0; s < found.facts.indexOf(fid); s++) { await pg.click('#planRunBody [data-action="planStepFact"]:last-of-type'); await settle(pg, 150); }
    const rc = await pg.evaluate(id => { const e = document.querySelector(`#planRunBody .fact[data-fact-id="${id}"]`) || document.querySelector('#planRunBody .fact');
      return e ? { id: e.dataset.factId, nodes: [...e.querySelectorAll('.fact-src .sqm-node')].map(n => n.textContent), btn: (e.querySelector('.fact-practise') || {}).textContent || null,
        qids: planFactQids(STUDY.find(f => f.id === Number(e.dataset.factId))).length } : null; }, fid);
    ok(rc && rc.nodes.length === rc.qids && rc.nodes.some(n => n.includes(' = ')), `[${L}] plan reading card #${rc && rc.id}: ${rc && rc.nodes.join(' | ')} (qids ${rc && rc.qids}) btn "${rc && rc.btn}"`);
    await over('plan reading card', '#planRunBody'); await shot('plan-read-card');
    await pg.click('#planRunBack'); await settle(pg, GUARD_MS);
    // the matching practice task: dedup, G37 (old max streak), G38 (a wrong copy is cleared)
    const pr = await pg.evaluate(([d, id]) => { const day = planDayAt(planLoad(), d); const i = day.tasks.findIndex(t0 => t0.type === 'practice' && planTaskQids(t0).some(k => planFactQids(STUDY.find(f => f.id === id)).includes(k)));
      return i < 0 ? null : { i, qids: planTaskQids(day.tasks[i]) }; }, [found.date, fid]);
    if (pr) {
      const twin = fid === 98 ? ['7.15', '13.0'] : ['8.13', '15.6'];
      // old data: the LATER copy mastered (G37 via max), plus another fact copy in the wrong list
      await pg.evaluate(([later]) => { streaks = { [later]: 3 }; saveStreaks(); }, [twin[1]]);
      const other = fid === 98 ? null : ['15.6'];
      await pg.evaluate(() => openPlanDay()); await settle(pg, 250);
      await pg.click(boxSel(found.date, pr.i)); await settle(pg, GUARD_MS);
      const asked = await pg.evaluate(() => state.questions ? state.questions.map(qKey) : []);
      ok(!asked.some(k => twin.includes(k)), `[${L}] practice task: the copy mastered only as ${twin[1]} (old data) is not asked (G37 via max): asked ${asked.length}`);
      ok(new Set(asked.map(k => k)).size === asked.length, `[${L}] practice task asks each question once`);
      note(`[${L}] practice task ${pr.i}: ${pr.qids.length} qids, asked ${asked.length}; other=${other}`);
      // G38: a question asked here that has a copy; put the other copy in the wrong list, answer right → cleared
      const target = await pg.evaluate(() => state.questions.map(qKey).find(k => questionCopies(k).length > 1) || null);
      const wrongCopy = target && await pg.evaluate(k => questionCopies(k).find(c => c !== k), target);
      const before = await pg.evaluate(() => state.current);
      if (target) {
        await pg.evaluate(k => { wrongList[k] = true; setLS(WRONG_LS, wrongList); }, wrongCopy);
        await pg.evaluate(k => goToQuestion(state.questions.findIndex(q => qKey(q) === k)), target); await settle(pg, 60);
        await answer(pg, true);
        ok(!(await lsKeys(pg, 'lifeuk.wrongList')).includes(wrongCopy), `[${L}] G38: right answer on ${target} in the plan clears wrong copy ${wrongCopy}`);
      } else note(`[${L}] practice task round holds no question with a copy; G38 copy check skipped`);
      await pg.evaluate(i => goToQuestion(i), before);
      await pg.evaluate(() => goToQuestion(0)); await settle(pg, 60);
      await playAll(pg, true);
      await over('plan practice result', '#screenPlanRun');
    } else note(`[${L}] no practice task for #${fid} on ${found.date}`);
  }
  // mock: first mock task, clock on its day, pass 24/24 → mockPassNote
  const mock = await pg.evaluate(() => { const p = planLoad(); for (const d of p.days) { const i = d.tasks.findIndex(t0 => t0.type === 'mock'); if (i >= 0) return { date: d.date, i }; } return null; });
  if (mock) {
    await pg.clock.setSystemTime(at(mock.date)); await pg.goto(base + '?preview=plan'); await settle(pg, 400);
    await pg.evaluate(() => openPlanDay()); await settle(pg, 250);
    const can = await pg.isVisible(boxSel(mock.date, mock.i));
    if (can) {
      await pg.click(boxSel(mock.date, mock.i)); await settle(pg, GUARD_MS);
      for (let i = 0; i < 30; i++) { if ((await screen(pg)) !== 'screenQuiz') break; await answer(pg, true);
        const c = await pg.evaluate(() => ({ i: state.current, n: state.questions.length })); await pg.click('#nextBtn'); await settle(pg, 60);
        if (c.i === c.n - 1) { await settle(pg, 200); if (await pg.isVisible('#confirmOk')) { await pg.click('#confirmOk'); } await settle(pg, GUARD_MS); break; } }
      const body = await pg.evaluate(() => document.querySelector('.screen.active').innerText.replace(/\s+/g, ' '));
      const mp = await T(pg, 'plan.run.mockPassNote');
      ok(body.includes(mp) && (lang === 'en' || mp === '✓ 模擬考試任務已完成'), `[${L}] mock pass note "${mp}" on ${await screen(pg)}`);
      for (const w of [320, 375]) { await pg.setViewportSize({ width: w, height: 760 }); await settle(pg, 100); await over(`mock result ${w}px`, '.screen.active'); await shot(`plan-mock-${w}`); }
    } else note(`[${L}] mock box ${mock.date}#${mock.i} not clickable`);
  }
  ok(errs.length === 0, `[${L}] plan: no page errors / missing i18n${errs.length ? ': ' + errs.join(' | ') : ''}`);
  await ctx.close();
}

(async () => {
  const b = await chromium.launch(launchOpts);
  const s = await startPagesServer(ROOT);
  const only = process.env.QA_ONLY || 'MUL';
  try {
    if (only.includes('M')) for (const lang of ['zh-HK', 'en']) await runLang(b, s.base, lang);
    if (only.includes('U')) await partU(b, s.base);
    if (only.includes('L')) for (const lang of ['zh-HK', 'en']) await partL(b, s.base, lang);
  } finally { s.server.kill(); await b.close(); }
  notes.forEach(n => console.log('note:', n));
  console.log(`\nQA PR7b browser: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
