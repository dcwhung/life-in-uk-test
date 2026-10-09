// QA plan PR6b (runner: reading / facts behind wrong answers / mock exams): real-browser checks over http
//   node 2026-10-09_qa-plan-pr6b-browser.js <repo-root> <work-dir> <shot-dir> [base-ref=origin/main]
// H. hidden (no preview): base tree (origin/main = v1.0.4) vs PR tree, same seeded-random flow through Study (read,
//    bookmark, ▶ Practise), Practice + Similar, Wrong answers, Flagged, Chapter, Exam mode (leave / submit / Retry):
//    storage writes, DOM, visible text, errors
// R. reading (G3, W-043): boxes → Study card, Fact n of m, Prev / Next focus (mouse + keyboard), 0 writes for reading,
//    bookmarks, card ▶ Practise counts for the plan day and comes back, last fact → "Practise these n →", review
// W. facts behind wrong answers: Similar panel, anchor current, CTA = plan practise (G26), last fact, review
// M. mock exams: Exam mode whatever Home's mode, 24 Q / 45 min, pass ≥ 18 (G10), fail → retake Random (G11), Retry,
//    W-044 two slots, Leave / switch off (G15), time up, S-131 midnight, G22 / G32 / G25, language, double tap
// C. Home "Continue" / Result card "Start next" open every type; a whole day done start → end → 100% 🎉
// V. v1.0.4 + ⓘ: switch / confirm / toast / S-112 / focus, schedule fold cards, rest day, month selector, W-040
// P. performance (183-day plan) · L. 360 / 375 / 400 × en / zh-HK · U. upgrade v1.0.4 → PR, mixed shell, offline
// QA_ONLY=HRWMCVPLU picks parts.
// Re-test (f24cec2): CUI-0024 rounds on re-entry (E2 / E2b), O-2 Result card after midnight (E3 / E8), O-3 quick-nav
// title (E6), G38 any plan runner clears the wrong list on a right answer, plain Practice does not (F3 / F9 / G8).
// QA_ONLY=HFGEPLU picks parts.
const { chromium } = require('playwright-core');
const { execSync } = require('child_process');
const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(process.argv[2]); const WORK = path.resolve(process.argv[3]); const SHOTS = path.resolve(process.argv[4]);
const BASE = process.argv[5] || 'origin/main'; // QA run 2026-10-09: 5039512 (v1.0.4) 
const { startPagesServer, appFiles } = require(path.join(ROOT, 'tests', 'pages-server.js'));
let pass = 0, fail = 0; const notes = [];
const ok = (c, m) => { if (c) { pass++; console.log('ok:', m); } else { fail++; console.log('FAIL:', m); } };
const note = m => { notes.push(m); console.log('note:', m); };
const launchOpts = { args: ['--no-sandbox'] }; if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const TODAY = '2026-10-08'; const at = (iso, time = '09:00:00') => new Date(`${iso}T${time}`); const NOW = at(TODAY);
const settle = (pg, ms = 150) => pg.waitForTimeout(ms);
const GUARD_MS = 420; // > SCREEN_CHANGE_CLICK_GUARD_MS (CUI-0011): wait after a click that changed the view
const INIT = () => {
  window.__w = [];
  const set = Storage.prototype.setItem, rm = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (k, v) { window.__w.push(['set', k, v]); return set.call(this, k, v); };
  Storage.prototype.removeItem = function (k) { window.__w.push(['rm', k]); return rm.call(this, k); };
};
// same pseudo-random sequence on both trees (H): shuffles pick the same questions / options
const SEEDED = () => { let s = 0x2f6a; Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const screen = pg => pg.evaluate(() => document.querySelector('.screen.active').id);
const visible = (pg, sel) => pg.evaluate(sel => { const e = document.querySelector(sel); return !!e && e.getClientRects().length > 0; }, sel);
const ls = (pg, k) => pg.evaluate(k => localStorage.getItem(k), k);
const watch = pg => { const errs = []; pg.on('pageerror', e => errs.push('pageerror: ' + e.message)); pg.on('console', m => { if (m.type() === 'error' || /\[i18n\] missing/.test(m.text())) errs.push('console: ' + m.text()); }); return errs; };
const archive = (ref, dir) => { fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true }); execSync(`git archive ${ref} | tar -x -C "${dir}"`, { cwd: ROOT, shell: '/bin/bash' }); };
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const storageAll = pg => pg.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
const cardText = pg => pg.evaluate(() => { const e = byId('planCard'); return e ? e.innerText.replace(/\s+/g, ' ').trim() : null; });
const writesSince = (pg, n) => pg.evaluate(n => window.__w.slice(n).map(w => w[0] + ':' + w[1]), n);
const wN = pg => pg.evaluate(() => window.__w.length);
const CONTRAST_FN = () => {
  const rgb = c => (c.match(/[\d.]+/g) || []).map(Number);
  const lum = v3 => { const v = v3.slice(0, 3).map(x => x / 255).map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const bgOf = e => { for (let n = e; n; n = n.parentElement) { const s = getComputedStyle(n); const c = rgb(s.backgroundColor); if (s.backgroundImage !== 'none') return null; if (c.length === 3 || (c.length === 4 && c[3] > 0.9)) return c; } return [255, 255, 255]; };
  const opac = e => { let o = 1; for (let n = e; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity); return o; };
  window.__contrast = e => { const bg = bgOf(e); if (!bg) return null; const s = getComputedStyle(e); let fg = rgb(e instanceof SVGElement ? s.fill : s.color);
    if (fg.length > 3) fg = fg.slice(0, 3).map((v, i) => fg[3] * v + (1 - fg[3]) * bg[i]);
    const a = lum(fg), b = lum(bg); return { r: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), o: opac(e) }; };
  window.__contrastAll = root => { const out = []; root.querySelectorAll('*').forEach(e => { if (e.closest('[aria-hidden="true"]') || e.closest('button:disabled') || !e.getClientRects().length) return;
    if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().replace(/[\u{1F300}-\u{1FAFF}☀-➿⚠️🎯🔥🎉✓✗›‹←→·–🔁🏆\s]/gu, ''))) return;
    const c = window.__contrast(e); if (c) out.push({ t: e.textContent.trim().slice(0, 24), r: +c.r.toFixed(2), o: +c.o.toFixed(2), cls: (e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className) || e.tagName }); }); return out; };
};
const hitOf = (pg, sel, both = false) => pg.evaluate(({ sel, both }) => { const e = document.querySelector(sel); if (!e || !e.getClientRects().length) return null; e.scrollIntoView({ block: 'center' });
  const r = e.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; const h = (x, y) => { const t = document.elementFromPoint(x, y); return !!t && (t === e || e.contains(t)); };
  return { w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, hit44: h(cx, cy - 21) && h(cx, cy + 21) && (!both || (h(cx - 21, cy) && h(cx + 21, cy))) }; }, { sel, both });

// ── app helpers ──
async function examTab(pg) { if (!(await visible(pg, '#examGrid button'))) { await pg.click('#ptabExam'); await settle(pg, 100); } }
async function boot(pg, base, now, { lang = 'en', wrong = '{"1.3":true,"2.5":true}', streak = null, query = '?preview=plan', install = true } = {}) {
  if (install) await pg.clock.install({ time: now }); else await pg.clock.setFixedTime(now);
  await pg.goto(base); await pg.evaluate(({ lang, wrong, streak }) => { localStorage.clear(); localStorage.setItem('lifeuk.installDismissed', 'true');
    if (wrong) localStorage.setItem('lifeuk.wrongList', wrong); if (streak) localStorage.setItem('lifeuk.practiceStreak', streak);
    if (lang !== 'en') localStorage.setItem('lifeuk.uiLang', JSON.stringify(lang)); }, { lang, wrong, streak });
  await pg.goto(base + query); await settle(pg, 300);
}
async function createViaUi(pg, { date = null, noRest = false, tap = false } = {}) {
  const press = sel => (tap ? pg.tap(sel) : pg.click(sel));
  await press('#planCard .plan-cta'); await settle(pg, GUARD_MS);
  if (date) { const [y, m, d] = date.split('-').map(Number);
    const seq = await pg.evaluate(([y, m, d]) => new Intl.DateTimeFormat(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(y, m - 1, d)).filter(p => p.type !== 'literal').map(p => p.value).join(''), [y, m, d]);
    await pg.focus('#planExamDate'); await pg.keyboard.type(seq, { delay: 25 }); await pg.click('#screenPlanGoal .plan-h2'); await settle(pg, 120); }
  if (noRest) { await press('#planRestChips [data-arg="0"]'); await settle(pg, 80); }
  await press('#planCreateBtn'); await settle(pg, GUARD_MS);
  await press('#screenPlanSchedule .back-btn'); await settle(pg, GUARD_MS);
}
// the runner as the user sees it
const run = pg => pg.evaluate(() => {
  const scr = document.querySelector('.screen.active').id;
  if (scr !== 'screenQuiz') return { scr };
  const q = state.questions[state.current]; const tx = id => byId(id).textContent.replace(/\s+/g, ' ').trim();
  return { scr, key: qKey(q), idx: state.current, n: state.questions.length, planDay: state.planDay || null, plan: typeof isPlanSession === 'function' && isPlanSession(), review: typeof isPlanReviewMode === 'function' && isPlanReviewMode(),
    label: tx('quizLabel'), badge: tx('modeBadge'), back: document.querySelector('#screenQuiz .back-btn').textContent.trim(),
    round: byId('roundRow').hidden ? '' : tx('roundNote'), note: !byId('planRunNote') || byId('planRunNote').hidden ? '' : tx('planRunNote'), pair: !byId('planPairNote') || byId('planPairNote').hidden ? '' : tx('planPairNote'),
    next: tx('nextBtn'), dots: byId('navDots').children.length, ans: byId('answerBox').classList.contains('show') ? tx('ansLabel') : '',
    timer: !byId('examTimer').hidden && getComputedStyle(byId('examTimer')).display !== 'none', a: q.a, nOpt: q.o.length,
    simShow: byId('similarBox').classList.contains('show'), simCta: !!byId('similarBox').querySelector('[data-action="startSimilarPractice"]') };
});
async function answer(pg, right) {
  const c = await pg.evaluate(() => { const q = state.questions[state.current]; return { a: q.a, n: q.o.length }; });
  const picks = right ? c.a : [...Array(c.n).keys()].filter(x => !c.a.includes(x)).slice(0, c.a.length);
  for (const oi of picks) await pg.click('#opt' + oi);
  await settle(pg, 40);
}
// one round through the UI: wrong / skip = sets of keys; returns the keys asked + the last question's state
async function playRound(pg, { wrong = [], skip = [], onEach = null } = {}) {
  const seen = []; let last = null;
  for (let i = 0; i < 30; i++) {
    const c = await run(pg); if (c.scr !== 'screenQuiz') break;
    seen.push(c.key);
    if (onEach) await onEach(c);
    if (!skip.includes(c.key)) await answer(pg, !wrong.includes(c.key));
    last = await run(pg);
    await pg.click('#nextBtn');
    await settle(pg, last.idx === last.n - 1 ? GUARD_MS : 40);
    if (last.idx === last.n - 1) break;
  }
  return { seen, last };
}
async function finishTask(pg, max = 8) { let r = null; for (let i = 0; i < max; i++) { if ((await screen(pg)) !== 'screenQuiz') break; r = await playRound(pg); } return r; }
const cardInfo = pg => pg.evaluate(() => { const b = byId('planRunBody'); const tx = s => { const e = b.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
  return { scr: document.querySelector('.screen.active').id, back: byId('planRunBack').textContent.trim(), label: byId('planRunLabel').textContent, badge: byId('planRunBadge').textContent,
    emoji: tx('.result-emoji'), score: tx('.result-score'), result: tx('.result-label'), pass: !!b.querySelector('.result-label.pass'), sub: tx('.result-sub'), pairNote: tx('.plan-note'),
    next: tx('.plan-run-next'), acts: [...b.querySelectorAll('.nav-row button')].map(x => [x.textContent.trim(), x.dataset.action, x.dataset.arg || '', x.dataset.task || '']),
    focus: document.activeElement === b.querySelector('.result-label'), side: isSideSession() }; });
const boxes = pg => pg.evaluate(() => [...document.querySelectorAll('#planTaskList > li')].map(li => { const b = li.querySelector('button.plan-task-btn'); const e = b || li;
  return { btn: !!b, date: b ? b.dataset.arg : null, task: b ? Number(b.dataset.task) : null, from: b ? b.dataset.from : null, cls: e.className,
    ttl: e.querySelector('.plan-task-ttl').textContent, st: e.querySelector('.plan-task-st').textContent, go: (e.querySelector('.plan-task-go') || {}).textContent || '',
    tag: (e.querySelector('.plan-tag.carry') || {}).textContent || '' }; }));
const boxSel = (date, i) => `#planTaskList button[data-arg="${date}"][data-task="${i}"]`;
const dayLog = (pg, iso) => pg.evaluate(iso => planDayLog(planLoadLog(), iso), iso);
const ringPct = pg => pg.$eval('#planRingPct', e => e.textContent.trim());
const domainPct = (pg, iso) => pg.evaluate(iso => { const plan = planLoad(); const d = planDayAt(plan, iso); return d ? planDayCompletion(d, planDayLog(planLoadLogView(), iso)).pct : null; }, iso);
const tasksOf = (pg, iso) => pg.evaluate(iso => planDayAt(planLoad(), iso).tasks, iso);
const activeInfo = pg => pg.evaluate(() => { const a = document.activeElement; return a ? { tag: a.tagName, id: a.id, action: a.dataset ? a.dataset.action : null, arg: a.dataset ? a.dataset.arg : null, task: a.dataset ? a.dataset.task : null, cls: a.className } : null; });
async function openToday(pg) { await pg.goto(pg.url().split('?')[0]); await settle(pg, 300); await pg.evaluate(() => openPlanDay()); await settle(pg, 200); }
async function toHomeAndDay(pg) { // ← Home (from the day screen) then the Home card's Schedule → View today? use the card: openPlanDay via Continue is a runner now
  await pg.click('#screenPlanDay .back-btn'); await settle(pg, GUARD_MS);
}

// ── H: hidden state, base (origin/main = v1.0.4) vs PR ──
const NORM_DOM = () => {
  window.__dom = () => { const a = document.querySelector('.screen.active'); const c = a.cloneNode(true);
    c.querySelectorAll('#resultPlanRow').forEach(e => e.remove()); // PR6b's hidden row, last in .result-card (shown for a plan mock only)
    c.querySelectorAll('#examTimer').forEach(e => { e.textContent = ''; });
    return a.id + '|' + c.outerHTML.replace(/<!--[\s\S]*?-->/g, '').replace(/>\s+</g, '><').replace(/\d+:\d\d/g, 'mm:ss'); }; // comments / whitespace between tags ignored
  window.__vis = () => { const a = document.querySelector('.screen.active'); return a.id + '|' + a.innerText.replace(/\d+:\d\d/g, 'mm:ss'); };
};
async function hiddenFlow(b, base) {
  const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
  await ctx.addInitScript(INIT); await ctx.addInitScript(SEEDED); await ctx.addInitScript(NORM_DOM);
  const pg = await ctx.newPage(); const errs = watch(pg);
  await pg.clock.install({ time: NOW });
  await pg.goto(base); await settle(pg);
  await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('lifeuk.installDismissed', 'true'); localStorage.setItem('lifeuk.wrongList', '{"1.3":true,"3.12":true,"4.14":true}'); });
  await pg.goto(base); await settle(pg, 300);
  const dom = [], vis = [], log = [];
  const snap = async tag => { dom.push(tag + '::' + await pg.evaluate(() => window.__dom())); vis.push(tag + '::' + await pg.evaluate(() => window.__vis())); };
  // s: Study: bookmark the first fact, its ▶ Practise session and back, a chapter chip, back Home
  await pg.click('#modeStudy'); await settle(pg, GUARD_MS); await snap('study-open');
  await pg.click('#screenStudy .fact .fact-btn.star'); await settle(pg, 80); await snap('study-bookmark');
  await pg.click('#screenStudy .fact .fact-practise'); await settle(pg, GUARD_MS); await snap('study-practise');
  for (let k = 0; k < 10; k++) { await answer(pg, k !== 1); const c = await run(pg); await pg.click('#nextBtn'); await settle(pg, c.idx === c.n - 1 ? GUARD_MS : 40); if (c.idx === c.n - 1) break; }
  await snap('study-back');
  await pg.click('#screenStudy .fact .fact-btn.tick'); await settle(pg, 80); await snap('study-tick');
  await pg.click('#screenStudy .back-btn'); await settle(pg, GUARD_MS); await snap('home-s');
  // a: Practice by exam: answer 1–5 (2nd wrong), Similar panel; Similar "Practise these N" side session and back
  await pg.click('#modePractice'); await settle(pg, 100); await examTab(pg);
  await pg.click('#examGrid [data-action="startExam"][data-arg="1"]'); await settle(pg, GUARD_MS);
  let simDone = false;
  for (let i = 0; i < 6; i++) {
    await answer(pg, i !== 1); await snap('ex1-q' + i);
    if (!simDone && await visible(pg, '#similarBox [data-action="startSimilarPractice"]')) {
      simDone = true; log.push('similar at q' + i);
      await pg.click('#similarBox [data-action="startSimilarPractice"]'); await settle(pg, GUARD_MS); await snap('sim-start');
      await answer(pg, true); await snap('sim-q0');
      for (let k = 0; k < 30; k++) { const c = await run(pg); if (c.idx === c.n - 1) break; await pg.click('#nextBtn'); await settle(pg, 40); }
      await snap('sim-last'); await pg.click('#nextBtn'); await settle(pg, GUARD_MS); await snap('sim-back');
    }
    await pg.click('#nextBtn'); await settle(pg, 40);
  }
  await pg.click('#screenQuiz .back-btn'); await settle(pg, GUARD_MS); await snap('home-a');
  // b: Wrong answers: first right (clears), second wrong
  await pg.click('#tileWrong'); await settle(pg, GUARD_MS); await snap('wrong-start');
  await answer(pg, true); await snap('wrong-q0'); await pg.click('#nextBtn'); await settle(pg, 40);
  await answer(pg, false); await snap('wrong-q1');
  await pg.click('#screenQuiz .back-btn'); await settle(pg, GUARD_MS);
  // c: flag in Exam 2, Flagged list → practise
  await pg.click('#modePractice'); await settle(pg, 100); await examTab(pg);
  await pg.click('#examGrid [data-action="startExam"][data-arg="2"]'); await settle(pg, GUARD_MS);
  await pg.click('#flagBtn'); await settle(pg, 60); await answer(pg, true); await snap('ex2-flag');
  await pg.click('#screenQuiz .back-btn'); await settle(pg, GUARD_MS);
  await pg.click('#tileFlagged'); await settle(pg, GUARD_MS); await snap('flagged-list');
  await pg.click('#flaggedStart'); await settle(pg, GUARD_MS); await snap('flagged-q0');
  await pg.click('#nextBtn'); await settle(pg, GUARD_MS); await snap('flagged-after'); // 1 question: Finish
  if ((await screen(pg)) !== 'screenHome') { await pg.evaluate(() => goHome()); await settle(pg, GUARD_MS); }
  // d: by chapter
  await pg.click('#modePractice'); await settle(pg, 100); await pg.click('#ptabChapter'); await settle(pg, 100);
  await pg.click('#chapterGrid button, [data-action="startChapter"]'); await settle(pg, GUARD_MS);
  await answer(pg, false); await snap('ch-q0');
  await pg.click('#screenQuiz .back-btn'); await settle(pg, GUARD_MS);
  // e: Exam mode: leave (confirm), then a full exam submitted
  await pg.click('#modeExam'); await settle(pg, 100);
  await pg.click('#examGrid [data-action="startExam"][data-arg="3"]'); await settle(pg, GUARD_MS);
  await answer(pg, true); await snap('exam3-q0');
  await pg.click('#screenQuiz .back-btn'); await settle(pg, 200); await pg.click('#confirmOk'); await settle(pg, GUARD_MS); await snap('exam3-left');
  await pg.click('#modeExam'); await settle(pg, 100);
  await pg.click('#examGrid [data-action="startExam"][data-arg="4"]'); await settle(pg, GUARD_MS);
  for (let i = 0; i < 24; i++) { await answer(pg, i % 3 !== 0); await pg.click('#nextBtn'); await settle(pg, 40); }
  if (await visible(pg, '#confirmOk')) { await pg.click('#confirmOk'); await settle(pg, 300); }
  await settle(pg, 300); await snap('exam4-result');
  // f: the result page's Retry (Home mode = Exam) → answer 2 → Leave
  await pg.click('#screenResult [data-action="retryExam"]'); await settle(pg, GUARD_MS); await snap('retry-start');
  await answer(pg, true); await pg.click('#nextBtn'); await settle(pg, 40); await answer(pg, false); await snap('retry-q1');
  await pg.click('#screenQuiz .back-btn'); await settle(pg, 200); await snap('retry-leave-modal');
  await pg.click('#confirmOk'); await settle(pg, GUARD_MS); await snap('retry-left');
  // g: Practice mode Exam 5 to the end (result page) and Retry there
  await pg.click('#modePractice'); await settle(pg, 100); await examTab(pg);
  await pg.click('#examGrid [data-action="startExam"][data-arg="5"]'); await settle(pg, GUARD_MS);
  for (let i = 0; i < 24; i++) { await answer(pg, i % 4 !== 0); const c = await run(pg); await pg.click('#nextBtn'); await settle(pg, c.idx === c.n - 1 ? GUARD_MS : 40); if (c.idx === c.n - 1) break; }
  await snap('ex5-practice-result');
  await pg.click('#screenResult [data-action="retryExam"]'); await settle(pg, GUARD_MS); await snap('ex5-retry');
  const writes = await pg.evaluate(() => window.__w.map(w => w[0] + ':' + w[1] + '=' + (w[2] || '').slice(0, 400)));
  const st = await storageAll(pg);
  await ctx.close();
  return { dom, vis, writes, storage: st, errs, log };
}
async function partH(b) {
  const dir = path.join(WORK, 'pr6b-base'); archive(BASE, dir);
  const s1 = await startPagesServer(dir), s2 = await startPagesServer(ROOT);
  try {
    const a = await hiddenFlow(b, s1.base), p = await hiddenFlow(b, s2.base);
    note(`[H] flow: ${p.log.join(', ')}; ${p.dom.length} DOM snapshots, ${p.writes.length} storage writes`);
    const wDiff = a.writes.map((w, i) => (w === p.writes[i] ? null : `#${i} base ${w} / pr ${p.writes[i]}`)).filter(Boolean);
    ok(a.writes.length === p.writes.length && wDiff.length === 0, `[H1] Study (bookmark / ▶ Practise / ✓) / Practice + Similar / Wrong answers / Flagged / Chapter / Exam (leave, submit, Retry + leave) / Practice-mode result + Retry: storage write sequence identical (${p.writes.length} writes) ${wDiff.slice(0, 3).join(' | ')}`);
    ok(JSON.stringify(a.storage) === JSON.stringify(p.storage), '[H2] final localStorage identical (keys + values)');
    ok(!p.writes.some(w => /studyPlan/.test(w)), '[H3] 0 lifeuk.studyPlan* writes');
    const dDiff = a.dom.map((d, i) => (d === p.dom[i] ? null : i + ' ' + d.split('::')[0])).filter(Boolean);
    if (dDiff.length) { const i = Number(dDiff[0].split(' ')[0]); const x = a.dom[i], y = p.dom[i]; let k = 0; while (x[k] === y[k]) k++; note(`[H4] first DOM diff at ${dDiff[0]}: base …${x.slice(k - 80, k + 120)}… / pr …${y.slice(k - 80, k + 120)}…`); }
    ok(a.dom.length === p.dom.length && dDiff.length === 0, `[H4] active screen DOM identical at ${p.dom.length} points (only the hidden #resultPlanRow left out) ${dDiff.join(', ')}`);
    ok(JSON.stringify(a.vis) === JSON.stringify(p.vis), '[H5] visible text identical at every point');
    ok(a.errs.length === 0 && p.errs.length === 0, `[H6] 0 console / page errors ${a.errs.concat(p.errs).join(' | ')}`);
    const row = p.dom.filter(d => /^exam4-result|^ex5-practice-result/.test(d)).length;
    ok(p.log.length === 1 && row === 2, '[H7] the flow reached a Similar "Practise these N" side session and two result pages');
  } finally { s1.server.kill(); s2.server.kill(); fs.rmSync(dir, { recursive: true, force: true }); }
}

// ── PR6b helpers ──
const GOAL = { examDate: '2026-10-29', dailyMins: 120, restDays: [0], level: 'none' };
// #screenPlanRun facts view as the user sees it
const factView = pg => pg.evaluate(() => {
  const scr = document.querySelector('.screen.active').id; const b = byId('planRunBody');
  if (scr !== 'screenPlanRun' || !b.querySelector('.plan-run-nav')) return { scr, facts: false };
  const tx = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : null);
  const btn = e => (e ? { t: tx(e), action: e.dataset.action, arg: e.dataset.arg || '', task: e.dataset.task || '', dis: e.disabled } : null);
  const nav = [...b.querySelectorAll('.plan-run-nav .nav-btn')];
  const card = b.querySelector('.fact') ? 'fact' : b.querySelector('.sqm') ? 'sqm' : '';
  const meta = [...b.querySelectorAll('.plan-run-meta > span')].map(tx);
  const a = document.activeElement;
  return { scr, facts: true, back: byId('planRunBack').textContent.trim(), label: byId('planRunLabel').textContent, badge: byId('planRunBadge').textContent,
    meta, card, id: card === 'fact' ? b.querySelector('.fact').dataset.factId : null, note: tx(b.querySelector('.plan-note')),
    practise: btn(b.querySelector('.fact-practise, .sqm-cta button')), prev: btn(nav[0]), next: btn(nav[1]),
    meter: (b.querySelector('.plan-run-meter i') || {}).style ? b.querySelector('.plan-run-meter i').style.width : null,
    star: (b.querySelector('.fact-btn.star') || {}).getAttribute ? b.querySelector('.fact-btn.star').getAttribute('aria-pressed') : null,
    current: tx(b.querySelector('.sqm-node.current')), sqmTitle: tx(b.querySelector('.sqm-title')), simStart: !!b.querySelector('[data-action="startSimilarPractice"], [data-action="startFactPractice"]'),
    focus: a && b.contains(a) ? (a.dataset.action || a.className) + (a.dataset.arg ? ':' + a.dataset.arg : '') : (a ? a.tagName + '#' + a.id : null) };
});
const mockInfo = pg => pg.evaluate(() => { const scr = document.querySelector('.screen.active').id;
  return { scr, mode: state.mode, exam: state.examNum, n: state.questions.length, planDay: state.planDay || null, mock: typeof isPlanMock === 'function' && isPlanMock(), side: isSideSession(),
    timer: byId('examTimer').textContent.trim(), timerShown: !!byId('examTimer').getClientRects().length, back: document.querySelector('#screenQuiz .back-btn').textContent.trim(), label: byId('quizLabel').textContent.trim() }; });
const resultRow = pg => pg.evaluate(() => { const r = byId('resultPlanRow'); const tx = e => e.textContent.replace(/\s+/g, ' ').trim();
  return { scr: document.querySelector('.screen.active').id, hidden: r.hidden, shown: !!r.getClientRects().length, note: r.querySelector('.plan-note') ? tx(r.querySelector('.plan-note')) : '', warn: !!r.querySelector('.plan-note.warn'),
    btns: [...r.querySelectorAll('button')].map(x => [tx(x), x.dataset.action]), score: tx(byId('screenResult').querySelector('.result-score, #resultScore') || document.body).slice(0, 12), timeUp: !byId('resultTimeUp').hidden }; });
// answer an Exam-mode exam: the first `right` questions right, the rest wrong; Submit (+ confirm when asked)
async function playExam(pg, right, { submit = true, upto = 99 } = {}) {
  for (let i = 0; i < 24 && i < upto; i++) { await answer(pg, i < right); const c = await run(pg); if (c.idx === c.n - 1) break; await pg.click('#nextBtn'); await settle(pg, 30); }
  if (!submit) return;
  await pg.click('#nextBtn'); await settle(pg, 250);
  if (await visible(pg, '#confirmOk')) { await pg.click('#confirmOk'); await settle(pg, 250); }
  await settle(pg, GUARD_MS);
}
async function planAt(pg, base, iso, opts = {}) { // the UI-built plan (started 10-08), then the clock on `iso`
  await boot(pg, base, NOW, opts); await createViaUi(pg);
  if (iso !== TODAY) { await pg.clock.setSystemTime(at(iso, opts.time || '09:00:00')); await pg.reload(); await settle(pg, 400); }
}
const dayView = (pg, iso = null) => pg.evaluate(iso => openPlanDay(iso), iso).then(() => settle(pg, 200)); // navigation only (the day screen is reached via Schedule in the UI)
const fullStorage = storageAll;

// ── R: reading (G3, W-043) ──
async function partR(b) {
  const s = await startPagesServer(ROOT);
  try {
    const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
    await ctx.addInitScript(INIT);
    const pg = await ctx.newPage(); const errs = watch(pg);
    await planAt(pg, s.base, TODAY, { wrong: '{"1.3":true,"3.12":true}' });
    const d1 = await tasksOf(pg, TODAY);
    await dayView(pg);
    let bx = await boxes(pg);
    ok(bx.length === 7 && bx.every(x => x.btn), `[R1] Day 1: all 7 boxes are buttons now, reading too: ${bx.map(x => x.ttl.slice(0, 22) + ' | ' + x.st).join(' // ')}`);
    const pct0 = await ringPct(pg);
    // R2 open Read Ch 2 (4 facts)
    let w0 = await wN(pg); const st0 = await storageAll(pg);
    await pg.click(boxSel(TODAY, 2)); await settle(pg, GUARD_MS);
    let v = await factView(pg);
    const f2 = d1[2].facts;
    ok(v.facts && v.card === 'fact' && v.id === String(f2[0]) && v.back === "← Today's tasks" && v.label === 'Chapter 2' && v.badge === 'Study', `[R2] box → reading: Study fact card #${v.id} (= task fact 1), header "${v.back}" ${v.label} · ${v.badge}`);
    ok(/^Read Ch 2 .+ facts #/.test(v.meta[0] || '') && v.meta[1] === 'Fact 1 of 4' && v.meter === '25%', `[R2] meta "${v.meta.join(' | ')}", bar ${v.meter}`);
    ok(v.prev.dis && v.prev.t === '← Prev' && v.next.t === 'Next →' && v.next.action === 'planStepFact', `[R2] nav: "${v.prev.t}" disabled, "${v.next.t}"`);
    const nQ = await pg.evaluate(id => planFactQids(planFactById(id)).length, f2[0]);
    ok(v.practise && v.practise.action === 'planPractiseFact' && v.practise.arg === String(f2[0]) && v.practise.t === (nQ === 1 ? '▶ Practise this one' : `▶ Practise these ${nQ}`) && !v.simStart, `[R2] card "${v.practise && v.practise.t}" → planPractiseFact (not Study's own startFactPractice)`);
    const studyDom = await pg.evaluate(() => { const f = document.querySelector('#planRunBody .fact'); return { cls: f.className, en: !!f.querySelector('.fact-en'), yue: !!f.querySelector('.fact-yue'), src: f.querySelectorAll('.fact-src .sqm-node').length, star: !!f.querySelector('.fact-btn.star'), tick: !!f.querySelector('.fact-btn.tick') }; });
    ok(studyDom.en && studyDom.yue && studyDom.src >= 1 && studyDom.star && studyDom.tick, `[R2] same .fact markup as Study (en / yue / source nodes ${studyDom.src} / bookmark / ✓)`);
    // R3 mouse Next ×3 + Prev: focus stays on the clicked control; last fact: W-043
    await pg.click('#planRunBody [data-action="planStepFact"][data-arg="1"]'); await settle(pg, 80);
    v = await factView(pg);
    ok(v.meta[1] === 'Fact 2 of 4' && v.meter === '50%' && !v.prev.dis && v.focus === 'planStepFact:1', `[R3] Next → "${v.meta[1]}", bar ${v.meter}, focus ${v.focus}`);
    await pg.click('#planRunBody [data-action="planStepFact"][data-arg="-1"]'); await settle(pg, 80);
    v = await factView(pg);
    ok(v.meta[1] === 'Fact 1 of 4' && v.prev.dis && v.focus === 'planStepFact:1', `[R3] Prev back to fact 1 (Prev now disabled): focus moves to "${v.focus}" (the enabled main button)`);
    // keyboard: Enter on Next to the last fact (W-043)
    await pg.focus('#planRunBody [data-action="planStepFact"][data-arg="1"]');
    for (let i = 0; i < 3; i++) { await pg.keyboard.press('Enter'); await settle(pg, 80); }
    v = await factView(pg);
    const left2 = d1[3].qids.length;
    ok(v.meta[1] === 'Fact 4 of 4' && v.meter === '100%' && v.next.t === `Practise these ${left2} →` && v.next.action === 'planOpenTask' && v.next.task === '3', `[R3] keyboard Enter ×3 → last fact; button "${v.next.t}" → the paired practice task`);
    ok(v.focus === 'planOpenTask:' + TODAY, `[R3] W-043: focus on the last fact's main button "${v.focus}" (not ← Prev)`);
    await pg.keyboard.press('Shift+Tab'); await pg.keyboard.press('Enter'); await settle(pg, 80);
    v = await factView(pg);
    ok(v.meta[1] === 'Fact 3 of 4' && v.focus === 'planStepFact:-1', `[R3] Shift+Tab + Enter = ← Prev: fact 3, focus stays on Prev (${v.focus})`);
    const wRead = (await writesSince(pg, w0));
    ok(wRead.length === 0, `[R4] G3: open + Prev / Next (mouse + keyboard) wrote nothing ${wRead.join(' | ')}`);
    // R5 bookmark on the card: Study's own mark, focus kept, shows in Study
    w0 = await wN(pg);
    await pg.click('#planRunBody .fact-btn.star'); await settle(pg, 100);
    v = await factView(pg);
    const wB = await writesSince(pg, w0);
    const bmKey = wB.length ? wB[0].split(':').slice(1).join(':') : '';
    ok(v.star === 'true' && wB.length === 1 && /studyBookmarks|bookmark/i.test(bmKey) && v.meta[1] === 'Fact 3 of 4' && v.focus === 'studyToggleMark:' + v.id, `[R5] bookmark: aria-pressed ${v.star}, 1 write (${wB.join()}), same fact, focus on the bookmark (${v.focus})`);
    const fid3 = v.id;
    const inStudy = await pg.evaluate(id => JSON.parse(localStorage.getItem(STUDY_MARK_LS.bookmarks) || '{}')[id] === true, fid3);
    ok(inStudy, `[R5] the bookmark is Study's (STUDY_MARK_LS.bookmarks has #${fid3})`);
    await pg.click('#planRunBody .fact-btn.star'); await settle(pg, 100);
    ok((await factView(pg)).star === 'false', '[R5] bookmark off again');
    // R6 card ▶ Practise on fact 3: a plan session for today, back to the same card
    v = await factView(pg); const qF = await pg.evaluate(id => planFactQids(planFactById(id)), Number(v.id));
    w0 = await wN(pg);
    await pg.click('#planRunBody .fact-practise'); await settle(pg, GUARD_MS);
    let r = await run(pg);
    ok(r.scr === 'screenQuiz' && r.plan && r.planDay === TODAY && r.n === qF.length && r.back === "← Today's tasks" && /Fact|Ch 2/.test(r.label) && !r.timer, `[R6] ▶ Practise: plan session of ${r.n} question(s) for ${r.planDay}, "${r.label}", "${r.back}"`);
    const rf = await playRound(pg, { wrong: qF.length > 1 ? [qF[0]] : [] });
    if ((await screen(pg)) === 'screenQuiz') await finishTask(pg);
    v = await factView(pg);
    lg = await dayLog(pg, TODAY);
    ok(v.facts && v.meta[1] === 'Fact 3 of 4' && !v.practise && qF.every(k => lg.ok[k]), `[R6] done → back on the same card (Fact 3 of 4), its ▶ Practise gone; ${qF.length} question(s) right for today`);
    const wP = await writesSince(pg, w0);
    note(`[R6] writes during the fact session: ${[...new Set(wP)].join(', ')} (${wP.length})`);
    await dayView(pg); bx = await boxes(pg);
    ok(/Read 1 \/ 4 facts|1 \/ 4/.test(bx[2].st) && !/done/.test(bx[2].cls), `[R6] reading box "${bx[2].st}" (1 fact counted by its questions, G3)`);
    // R7 the box again: starts at the first fact not done (fact 1); last → Practise these n → opens the practice task with the rest
    await pg.click(boxSel(TODAY, 2)); await settle(pg, GUARD_MS);
    v = await factView(pg);
    ok(v.meta[1] === 'Fact 1 of 4', `[R7] reopened at the first fact not done: "${v.meta[1]}"`);
    for (let i = 0; i < 3; i++) { await pg.click('#planRunBody .plan-run-nav .nav-btn:last-child'); await settle(pg, 80); }
    v = await factView(pg);
    const rest2 = d1[3].qids.filter(k => !qF.includes(k)).length;
    ok(v.next.t === `Practise these ${rest2} →`, `[R7] last fact: "${v.next.t}" (= ${left2} − ${qF.length} already right)`);
    await pg.click('#planRunBody .plan-run-nav .nav-btn:last-child'); await settle(pg, GUARD_MS);
    r = await run(pg);
    ok(r.scr === 'screenQuiz' && r.label === 'Chapter 2' && r.n === rest2 && r.pair === 'Once these questions are right, the matching facts count as read.', `[R7] → practice task Chapter 2, ${r.n} questions, pair note`);
    await finishTask(pg);
    let cd = await cardInfo(pg);
    ok(cd.scr === 'screenPlanRun' && /Read Ch 2/.test(cd.pairNote || '') && /^Next/.test(cd.next || '') && /Read Ch 1/.test(cd.next), `[R7] Result card (next = the first task not done: Read Ch 1): "${cd.sub}"; "${cd.pairNote}"; next "${cd.next}"`);
    // R8 reading done → review: note, no ▶ Practise, last "Finish ✓" → day, focus on its box
    await pg.click('#planRunBack'); await settle(pg, GUARD_MS);
    bx = await boxes(pg);
    ok(/done/.test(bx[2].cls) && bx[2].st === '✓ Practised its questions: counted as read' && bx[2].go === '✓ Review ›', `[R8] reading box "${bx[2].st}" ${bx[2].go}`);
    w0 = await wN(pg);
    await pg.click(boxSel(TODAY, 2)); await settle(pg, GUARD_MS);
    v = await factView(pg);
    ok(v.note === '✅ This task is done · reviewing it does not change your progress.' && v.meta[1] === 'Fact 1 of 4' && !v.practise, `[R8] review: "${v.note}", from fact 1, no ▶ Practise`);
    for (let i = 0; i < 3; i++) { await pg.click('#planRunBody .plan-run-nav .nav-btn:last-child'); await settle(pg, 80); }
    v = await factView(pg);
    ok(v.next.t === 'Finish ✓' && v.next.action === 'planBackToDay' && v.focus === 'planBackToDay', `[R8] review last: "${v.next.t}", focus ${v.focus}`);
    await pg.click('#planRunBody .plan-run-nav .nav-btn:last-child'); await settle(pg, GUARD_MS);
    ok((await screen(pg)) === 'screenPlanDay' && (await activeInfo(pg)).task === '2' && (await writesSince(pg, w0)).length === 0, `[R8] Finish → day screen, focus on the box, 0 writes`);
    // R9 G3 the other way: read every fact of Read Ch 5 (26) without practising → nothing counted
    const p5 = await domainPct(pg, TODAY); w0 = await wN(pg);
    await pg.click(boxSel(TODAY, 4)); await settle(pg, GUARD_MS);
    for (let i = 0; i < 30; i++) { v = await factView(pg); if (v.next.action !== 'planStepFact') break; await pg.click('#planRunBody .plan-run-nav .nav-btn:last-child'); await settle(pg, 40); }
    ok(v.meta[1] === 'Fact 26 of 26' && v.next.t === `Practise these ${d1[5].qids.length} →`, `[R9] all 26 facts browsed: "${v.meta[1]}", "${v.next.t}"`);
    await pg.click('#planRunBack'); await settle(pg, GUARD_MS);
    ok((await domainPct(pg, TODAY)) === p5 && (await writesSince(pg, w0)).length === 0 && !/done/.test((await boxes(pg))[4].cls), `[R9] G3: browsing all facts counts nothing (${p5}% unchanged, 0 writes), ← back to the day`);
    // R10 language switch on a card: same fact, zh-HK strings, focus kept
    await pg.click(boxSel(TODAY, 4)); await settle(pg, GUARD_MS);
    await pg.click('#planRunBody .plan-run-nav .nav-btn:last-child'); await settle(pg, 80);
    const idBefore = (await factView(pg)).id;
    await pg.click('#langBtn'); await settle(pg, 150);
    v = await factView(pg);
    ok(v.id === idBefore && v.meta[1] === '第 2 條（共 26 條）' && v.prev.t === '← 上一條' && v.next.t === '下一條 →' && v.back === '← 今日任務' && v.badge === '溫習' && /^▶ 練習這 \d+ 題$|^▶ 練習此題$/.test(v.practise.t), `[R10] zh-HK: "${v.meta.join(' | ')}" "${v.prev.t}" "${v.next.t}" "${v.back}" ${v.badge} "${v.practise.t}"`);
    await pg.click('#langBtn'); await settle(pg, 150);
    // R11 G37: a fact whose questions are all 🏆 counts as read, opens past it, no ▶ Practise
    const f5 = d1[4].facts;
    const fq = await pg.evaluate(ids => ids.map(id => planFactQids(planFactById(id))), f5.slice(0, 2));
    await pg.evaluate(keys => { const s = JSON.parse(localStorage.getItem('lifeuk.practiceStreak') || '{}'); keys.forEach(k => { s[k] = 3; }); localStorage.setItem('lifeuk.practiceStreak', JSON.stringify(s)); }, fq.flat());
    await pg.reload(); await settle(pg, 400); await dayView(pg);
    await pg.click(boxSel(TODAY, 4)); await settle(pg, GUARD_MS);
    v = await factView(pg);
    ok(v.meta[1] === 'Fact 3 of 26', `[R11] G37: first 2 facts 🏆 → opens at "${v.meta[1]}"`);
    await pg.click('#planRunBody [data-action="planStepFact"][data-arg="-1"]'); await settle(pg, 80);
    v = await factView(pg);
    ok(!v.practise && v.meta[1] === 'Fact 2 of 26', `[R11] a 🏆 fact has no ▶ Practise (nothing left to ask)`);
    await pg.click('#planRunBack'); await settle(pg, GUARD_MS);
    // R12 G23 ahead: Day 2 reading opens, its ▶ Practise counts for Day 2; G8 past: the next day, Day 1 reading opens as catch-up
    await dayView(pg, '2026-10-09'); bx = await boxes(pg);
    ok(bx[0].btn, `[R12] Day 2 (ahead) reading is a button (G23): "${bx[0].ttl}"`);
    await pg.click(boxSel('2026-10-09', 0)); await settle(pg, GUARD_MS);
    v = await factView(pg);
    ok(v.back === '← Day 2 tasks' && v.meta[1] === 'Fact 1 of 36', `[R12] ahead: "${v.back}", "${v.meta[1]}"`);
    await pg.click('#planRunBody .fact-practise'); await settle(pg, GUARD_MS);
    r = await run(pg); ok(r.planDay === '2026-10-09', `[R12] its ▶ Practise counts for Day 2 (${r.planDay})`);
    await pg.click('#screenQuiz .back-btn'); await settle(pg, GUARD_MS);
    ok((await screen(pg)) === 'screenPlanDay', '[R12] ← from the fact session → the day screen it came from');
    await pg.clock.setSystemTime(at('2026-10-09')); await pg.reload(); await settle(pg, 400); await dayView(pg);
    bx = await boxes(pg);
    const carry = bx.find(x => x.date === TODAY && x.btn && /Read/.test(x.ttl));
    ok(!!carry, `[R12] next day: Day 1 reading listed as catch-up (${carry ? carry.ttl + ' ' + carry.tag : 'none'})`);
    if (carry) { await pg.click(boxSel(carry.date, carry.task)); await settle(pg, GUARD_MS); v = await factView(pg);
      await pg.click('#planRunBody .fact-practise'); await settle(pg, GUARD_MS); r = await run(pg);
      ok(v.back === "← Today's tasks" && r.planDay === TODAY, `[R12] catch-up reading: "${v.back}", ▶ Practise counts for Day 1 (${r.planDay}, G8)`);
      await pg.click('#screenQuiz .back-btn'); await settle(pg, GUARD_MS); }
    ok(errs.length === 0, `[R] 0 console / page errors ${errs.join(' | ')}`);
    await ctx.close();
  } finally { s.server.kill(); }
}

// ── W: facts behind wrong answers (arch §E.3, G26, G38) ──
async function partW(b) {
  const s = await startPagesServer(ROOT);
  const DRILL = '2026-10-16';
  try {
    const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
    await ctx.addInitScript(INIT);
    const pg = await ctx.newPage(); const errs = watch(pg);
    await planAt(pg, s.base, DRILL, { wrong: '{"1.3":true,"3.12":true,"4.14":true,"2.5":true,"6.9":true}' });
    await dayView(pg);
    const tk = await tasksOf(pg, DRILL); const wi = tk.findIndex(t => t.type === 'wrongFacts'); const wf = tk[wi];
    let bx = await boxes(pg);
    ok(wi >= 0 && bx[wi].btn && wf.facts.length >= 2, `[W1] ${DRILL}: "${bx[wi].ttl}" is a button, ${wf.facts.length} facts (${bx[wi].st}); anchors ${JSON.stringify(wf.anchor)}`);
    let w0 = await wN(pg);
    await pg.click(boxSel(DRILL, wi)); await settle(pg, GUARD_MS);
    let v = await factView(pg);
    const anchorQ = await pg.evaluate(k => { const q = questionByKey(k); return { node: questionNodeLabel ? null : null, k }; }, wf.anchor[wf.facts[0]]).catch(() => null);
    ok(v.facts && v.card === 'sqm' && v.label === 'Wrong-answer facts' && v.badge === 'Practice' && v.back === "← Today's tasks" && v.meta[0] === 'Review the facts behind wrong answers' && v.meta[1] === `Fact 1 of ${wf.facts.length}`, `[W2] Similar panel page: ${v.label} · ${v.badge}, "${v.meta.join(' | ')}"`);
    const sqm = await pg.evaluate(() => { const p = document.querySelector('#planRunBody .sqm.show'); return { head: !!p.querySelector('.sqm-head'), fact: !!p.querySelector('.sqm-fact'), map: p.querySelectorAll('.sqm-map .sqm-node').length, cur: p.querySelectorAll('.sqm-node.current').length, legend: !!p.querySelector('.sqm-legend'), list: p.querySelectorAll('.sqm-item').length }; });
    ok(sqm.head && sqm.fact && sqm.map >= 1 && sqm.cur === 1 && sqm.legend, `[W2] same .sqm markup as Similar: head, core fact, "Appears in" ${sqm.map} node(s) with 1 current (the wrong answer "${v.current}"), legend, ${sqm.list} item(s)`);
    // W2b every fact of the task: the panel's count / list (a one-question fact has no "similar" question)
    const panels = [];
    for (let i = 0; i < wf.facts.length; i++) { panels.push(await pg.evaluate(() => { const p = document.querySelector('#planRunBody .sqm.show'); return { id: p.querySelector('.sqm-fact-label').textContent.replace(/\s+/g, ' ').trim(), count: p.querySelector('.sqm-count').textContent.trim(), items: p.querySelectorAll('.sqm-item').length, wrongShown: [...p.querySelectorAll('.sqm-q')].length }; }));
      if (i < wf.facts.length - 1) { await pg.click('#planRunBody .plan-run-nav .nav-btn:last-child'); await settle(pg, 60); } }
    await pg.screenshot({ path: path.join(SHOTS, 'W-375-en-wrongfacts-last.png'), fullPage: true });
    for (let i = 1; i < wf.facts.length; i++) { await pg.click('#planRunBody [data-action="planStepFact"][data-arg="-1"]'); await settle(pg, 60); }
    await pg.screenshot({ path: path.join(SHOTS, 'W-375-en-wrongfacts-1.png'), fullPage: true });
    const empty = panels.filter(x => x.items === 0);
    note(`[W2b] panels: ${panels.map(x => x.id + ' ' + x.count + ' items ' + x.items).join(' / ')}`);
    ok(empty.length === 0, `[W2b] every wrong-fact panel lists at least one question (the question answered wrong is never shown as text; mockup lists the fact's questions with "你答錯"): ${empty.length} / ${panels.length} panel(s) read "Similar Questions … ${empty.map(x => x.count).join(',')}" with an empty list`);
    const curOk = await pg.evaluate(k => { const cur = document.querySelector('#planRunBody .sqm-node.current'); const q = questionByKey(k); const html = similarPanelHtml(q, similarKeys(q), { practise: false }); const d = document.createElement('div'); d.innerHTML = html; const c = d.querySelector('.sqm-node.current'); return !!c && c.textContent === cur.textContent; }, wf.anchor[wf.facts[0]]);
    ok(curOk, '[W2] the current node is the anchor (the wrong-list question of that fact)');
    const nQ = await pg.evaluate(id => planNextRound({ ...planDayAt(planLoad(), planTodayIso()).tasks.find(t => t.type === 'wrongFacts'), facts: [id] }, planDayLog(planLoadLogView(), planTodayIso())).length, wf.facts[0]);
    ok(v.practise && v.practise.action === 'planPractiseFact' && v.practise.arg === String(wf.facts[0]) && v.practise.t === (nQ === 1 ? '▶ Practise this one' : `▶ Practise these ${nQ}`) && !v.simStart, `[W2] CTA "${v.practise && v.practise.t}" → planPractiseFact (G26: never startSimilarPractice)`);
    const cta = await hitOf(pg, '#planRunBody .sqm-cta button');
    ok(cta && cta.h >= 44, `[W2] CTA ${cta && cta.h}px tall (44 on the plan page)`);
    await pg.click('#planRunBody .plan-run-nav .nav-btn:last-child'); await settle(pg, 80);
    v = await factView(pg);
    ok(v.meta[1] === `Fact 2 of ${wf.facts.length}` && v.current, `[W3] Next → fact 2, current "${v.current}"`);
    await pg.click('#planRunBody [data-action="planStepFact"][data-arg="-1"]'); await settle(pg, 80);
    ok((await writesSince(pg, w0)).length === 0, '[W3] open + Prev / Next: 0 writes');
    // W4 CTA: a plan session for the drill day; a wrong answer there shows Similar without CTA; finish → same card; G38
    const qF = await pg.evaluate(id => planFactQids(planFactById(id)), wf.facts[0]);
    await pg.click('#planRunBody .sqm-cta button'); await settle(pg, GUARD_MS);
    let r = await run(pg);
    ok(r.scr === 'screenQuiz' && r.plan && r.planDay === DRILL && r.n === nQ && /^Fact Ch \d #\d+$/.test(r.label) && r.back === "← Today's tasks", `[W4] CTA → plan session (${r.n} Q, "${r.label}", counts for ${r.planDay})`);
    let simShown = 0, ctaSeen = false;
    const firstK = r.key;
    await playRound(pg, { wrong: [firstK], onEach: async () => {} });
    // after the first wrong pick the Similar panel was visible on that question: check on redo
    r = await run(pg);
    if (r.scr === 'screenQuiz') { await answer(pg, false); r = await run(pg); simShown = r.simShow ? 1 : 0; ctaSeen = r.simCta || await visible(pg, '#similarBox .sqm-cta'); await finishTask(pg); }
    ok(!ctaSeen, `[W4] G26: Similar inside the plan session ${simShown ? 'shown' : '(none for this question)'}, no "Practise these N"`);
    v = await factView(pg);
    const wl = JSON.parse(await ls(pg, 'lifeuk.wrongList'));
    lg = await dayLog(pg, DRILL);
    ok(v.facts && v.meta[1] === `Fact 1 of ${wf.facts.length}` && !v.practise && qF.every(k => lg.ok[k] || lg.mastered && lg.mastered[k] || !qF.includes(k)), `[W4] done → back on the same fact card, its CTA gone; right for ${DRILL}`);
    ok(!wl[wf.anchor[wf.facts[0]]], `[W4] G38: ${wf.anchor[wf.facts[0]]} left the wrong list (${Object.keys(wl).join(',')})`);
    // W5 last fact: "Practise these n →" = what is left of the task → Result card
    for (let i = 0; i < wf.facts.length; i++) { v = await factView(pg); if (v.next.action !== 'planStepFact') break; await pg.click('#planRunBody .plan-run-nav .nav-btn:last-child'); await settle(pg, 80); }
    const leftN = await pg.evaluate(() => { const t = planDayAt(planLoad(), planTodayIso()).tasks.find(x => x.type === 'wrongFacts'); const dl = planDayLog(planLoadLogView(), planTodayIso()); return planAskableQids(t, dl).filter(k => !dl.ok[k]).length; });
    ok(v.next.action === 'planPractiseTask' && v.next.t === (leftN === 1 ? 'Practise this one →' : `Practise these ${leftN} →`) && v.focus !== 'planStepFact:-1', `[W5] last fact: "${v.next.t}" (planPractiseTask), focus ${v.focus}`);
    await pg.click('#planRunBody .plan-run-nav .nav-btn:last-child'); await settle(pg, GUARD_MS);
    r = await run(pg);
    ok(r.scr === 'screenQuiz' && r.label === 'Wrong-answer facts' && r.n === Math.min(leftN, 24) && r.planDay === DRILL, `[W5] → session "${r.label}" ${r.n} Q for ${r.planDay}`);
    await finishTask(pg);
    let cd = await cardInfo(pg);
    ok(cd.scr === 'screenPlanRun' && cd.label === 'Wrong-answer facts' && cd.acts.some(a => a[1] === 'planReviewTask'), `[W5] Result card ${cd.emoji} ${cd.score} "${cd.result}" "${cd.sub}"; ${cd.acts.map(a => a[0]).join(' / ')}`);
    // W6 review: Similar panels without CTA, note, Finish
    w0 = await wN(pg);
    await pg.click('#planRunBody [data-action="planReviewTask"]'); await settle(pg, GUARD_MS);
    v = await factView(pg);
    const revCta = await visible(pg, '#planRunBody .sqm-cta');
    ok(v.card === 'sqm' && v.note === '✅ This task is done · reviewing it does not change your progress.' && !revCta && v.meta[1] === `Fact 1 of ${wf.facts.length}`, `[W6] review: Similar panel, note, no CTA`);
    for (let i = 0; i < wf.facts.length; i++) { v = await factView(pg); if (v.next.action !== 'planStepFact') break; await pg.click('#planRunBody .plan-run-nav .nav-btn:last-child'); await settle(pg, 60); }
    ok(v.next.t === 'Finish ✓', `[W6] review last "${v.next.t}"`);
    await pg.click('#planRunBody .plan-run-nav .nav-btn:last-child'); await settle(pg, GUARD_MS);
    bx = await boxes(pg);
    ok((await screen(pg)) === 'screenPlanDay' && /done/.test(bx[wi].cls) && (await writesSince(pg, w0)).length === 0, `[W6] Finish → day, box "${bx[wi].st}", 0 writes in review`);
    // W7 language on the Similar page
    await pg.click(boxSel(DRILL, wi)); await settle(pg, GUARD_MS); await pg.click('#langBtn'); await settle(pg, 150);
    v = await factView(pg);
    ok(v.label === '錯題知識點' && v.badge === '練習' && v.meta[0] === '重溫答錯題目的知識點' && /^第 1 條（共 \d+ 條）$/.test(v.meta[1]) && v.sqmTitle && /相似題目/.test(v.sqmTitle), `[W7] zh-HK: ${v.label} · ${v.badge}, "${v.meta.join(' | ')}", panel "${v.sqmTitle}"`);
    await pg.click('#langBtn'); await settle(pg, 150);
    ok(errs.length === 0, `[W] 0 console / page errors ${errs.join(' | ')}`);
    await ctx.close();
    // W8 nothing wrong: the box is done, not a button
    const c2 = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' }); const p2 = await c2.newPage(); const e2 = watch(p2);
    await planAt(p2, s.base, DRILL, { wrong: null }); await dayView(p2);
    const t2 = await tasksOf(p2, DRILL); const i2 = t2.findIndex(t => t.type === 'wrongFacts'); const b2 = await boxes(p2);
    ok(!b2[i2].btn && t2[i2].facts.length === 0 && /done/.test(b2[i2].cls), `[W8] empty wrong list: "${b2[i2].st}", not a button, done`);
    ok(e2.length === 0, `[W8] 0 errors ${e2.join(' | ')}`);
    await c2.close();
  } finally { s.server.kill(); }
}

// ── M: mock exams (arch §E.5; G10 / G11 / G15 / G22 / G25 / G32; W-044; S-131) ──
const MOCK = '2026-10-24';
const examLog = pg => pg.evaluate(() => JSON.parse(localStorage.getItem('lifeuk.completedExams') || '{}'));
async function partM(b) {
  const s = await startPagesServer(ROOT);
  try {
    const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
    await ctx.addInitScript(INIT);
    const pg = await ctx.newPage(); const errs = watch(pg);
    await planAt(pg, s.base, MOCK, { wrong: '{"1.3":true}' });
    const tk = await tasksOf(pg, MOCK);
    ok(tk.map(t => t.type + (t.type === 'mock' ? `(slot ${t.slot}, Exam ${t.exam})` : '')).join(' ') === 'mock(slot 0, Exam 1) mock(slot 1, Exam 2) review', `[M0] ${MOCK}: ${tk.map(t => t.type + (t.type === 'mock' ? `(slot ${t.slot}, Exam ${t.exam})` : '')).join(' ')}`);
    // M1 Home: Practice chosen, then "Continue" → the mock in Exam mode
    await pg.click('#modePractice'); await settle(pg, 120);
    const pend = await pg.evaluate(() => pendingMode);
    const c0 = await cardText(pg);
    let w0 = await wN(pg); const st0 = await storageAll(pg); const lg0 = await dayLog(pg, MOCK);
    await pg.click('#planCard .plan-btn-gold'); await settle(pg, GUARD_MS);
    let m = await mockInfo(pg);
    ok(pend === 'practice' && /Timed mock exam: Exam 1/.test(c0) && m.scr === 'screenQuiz' && m.mode === 'exam' && m.exam === 1 && m.n === 24 && m.planDay === MOCK && m.mock && !m.side, `[M1] Home mode Practice → "Continue" ("${c0.slice(0, 70)}…") opens Exam 1 in Exam mode, 24 Q, counts for ${m.planDay}`);
    ok(m.timerShown && /^(⏱ )?4[45]:\d\d/.test(m.timer.replace(/^[^\d]*/, '')) && m.back === "← Today's tasks" && m.label === 'Exam 1', `[M1] timer "${m.timer}", header "${m.back}" · ${m.label}`);
    const quizDom = await pg.evaluate(() => ({ flag: !!byId('flagBtn').getClientRects().length, ans: byId('answerBox').classList.contains('show') }));
    // M2 slot 0 fails 10 / 24 (G22: answers never reach the practice log)
    await playExam(pg, 10);
    let rr = await resultRow(pg);
    let dl = await dayLog(pg, MOCK);
    ok(rr.scr === 'screenResult' && rr.shown && rr.warn && rr.note === 'Not passed (pass mark 18 / 24): retake as a Random Exam today.' && rr.btns.map(x => x[0] + '>' + x[1]).join(' | ') === 'Retake: Random Exam>planRetryMock | Back to the task list>planBackToDay', `[M2] fail 10 / 24: row "${rr.note}" [${rr.btns.map(x => x[0]).join(' / ')}]`);
    ok(dl.mock.length === 1 && dl.mock[0].correct === 10 && dl.mock[0].total === 24 && dl.mock[0].exam === 1 && JSON.stringify(dl.ok) === JSON.stringify(lg0.ok) && JSON.stringify(dl.bad) === JSON.stringify(lg0.bad), `[M2] log: mock ${JSON.stringify(dl.mock)}; G22 ok / bad unchanged`);
    const wE = await writesSince(pg, w0);
    ok(!wE.some(w => /practiceStreak/.test(w)) && wE.filter(w => /studyPlanProgress/.test(w)).length === 1, `[M2] G22: no streak write; one plan-log write (the attempt): ${[...new Set(wE)].join(', ')}`);
    await pg.screenshot({ path: path.join(SHOTS, 'M-375-en-result-fail.png'), fullPage: true });
    // M3 Retake → Random Exam (Exam mode) → pass 20
    await pg.click('#resultPlanRow [data-action="planRetryMock"]'); await settle(pg, GUARD_MS);
    m = await mockInfo(pg);
    ok(m.mode === 'exam' && m.exam === 'all' && m.n === 24 && m.mock && m.label === 'Random Exam' && m.back === "← Today's tasks", `[M3] G11 Retake: ${m.label} (${m.exam}) Exam mode, ${m.n} Q, "${m.back}"`);
    await playExam(pg, 20);
    rr = await resultRow(pg);
    ok(rr.shown && !rr.warn && rr.note === '✓ Mock exam task done' && rr.btns.map(x => x[0]).join() === 'Back to the task list', `[M3] pass 20: "${rr.note}" [${rr.btns.map(x => x[0]).join(' / ')}]`);
    await pg.screenshot({ path: path.join(SHOTS, 'M-375-en-result-pass.png'), fullPage: true });
    await pg.click('#resultPlanRow [data-action="planBackToDay"]'); await settle(pg, GUARD_MS);
    let bx = await boxes(pg);
    ok((await screen(pg)) === 'screenPlanDay' && (await activeInfo(pg)).task === '0' && /done/.test(bx[0].cls) && bx[0].st === '✓ Passed · best 20 / 24' && bx[1].btn, `[M3] → day, focus on the box; slot 0 "${bx[0].st}" (G25); slot 1 open "${bx[1].st}"`);
    // M4 W-044: slot 1 opens its own exam (Exam 2), even after slot 0's fail + retake
    await pg.click(boxSel(MOCK, 1)); await settle(pg, GUARD_MS);
    m = await mockInfo(pg);
    ok(m.exam === 2 && m.label === 'Exam 2' && m.mode === 'exam', `[M4] W-044: slot 1 → ${m.label} (exam ${m.exam})`);
    await playExam(pg, 17);
    rr = await resultRow(pg);
    ok(rr.warn && /^Not passed/.test(rr.note), `[M4] 17 / 24 = not passed: "${rr.note}"`);
    // the result page's own Retry: Random Exam in Exam mode whatever Home's mode (G11, PR2 observation)
    await pg.click('#screenResult [data-action="retryExam"]'); await settle(pg, GUARD_MS);
    m = await mockInfo(pg);
    ok(m.mode === 'exam' && m.exam === 'all' && m.mock && (await pg.evaluate(() => pendingMode)) === 'practice', `[M4] result page Retry → ${m.label} in Exam mode (Home's pendingMode still practice)`);
    await playExam(pg, 18);
    rr = await resultRow(pg);
    ok(rr.note === '✓ Mock exam task done', `[M4] exactly 18 / 24 passes (G10): "${rr.note}"`);
    dl = await dayLog(pg, MOCK);
    ok(dl.mock.map(a => a.exam + ':' + a.correct).join() === '1:10,all:20,2:17,all:18', `[M4] attempts ${dl.mock.map(a => a.exam + ':' + a.correct).join(', ')}`);
    // M5 language on the result page and the day
    await pg.click('#langBtn'); await settle(pg, 150);
    rr = await resultRow(pg);
    ok(rr.note === '✓ 模擬考試任務完成' && rr.btns[0][0] === '返回任務列表', `[M5] zh-HK row "${rr.note}" [${rr.btns.map(x => x[0]).join()}]`);
    await pg.click('#langBtn'); await settle(pg, 150);
    await pg.click('#resultPlanRow [data-action="planBackToDay"]'); await settle(pg, GUARD_MS);
    bx = await boxes(pg);
    ok(/done/.test(bx[1].cls) && /^✓ Passed · best \d+ \/ 24$/.test(bx[1].st), `[M5] slot 1 done: "${bx[1].st}"`);
    note(`[M5] box best scores: slot 0 "${bx[0].st}", slot 1 "${bx[1].st}" (G25 best = the day's highest)`);
    // M6 a passed mock's box → Result card (no Review), Start next → clear wrong answers → 🎉
    await pg.click(boxSel(MOCK, 0)); await settle(pg, GUARD_MS);
    let cd = await cardInfo(pg);
    ok(cd.scr === 'screenPlanRun' && cd.label === 'Exam 1' && cd.badge === 'Exam' && /best 20 \/ 24/.test(cd.sub || '') && !cd.acts.some(a => a[1] === 'planReviewTask') && cd.acts.some(a => a[1] === 'planOpenTask'), `[M6] passed box → Result card ${cd.label} · ${cd.badge} "${cd.sub}", buttons ${cd.acts.map(a => a[0]).join(' / ')}`);
    await pg.click('#planRunBody [data-action="planOpenTask"]'); await settle(pg, GUARD_MS);
    let r = await run(pg);
    ok(r.scr === 'screenQuiz' && r.label === 'Wrong answers', `[M6] Start next → "${r.label}" runner`);
    await finishTask(pg);
    cd = await cardInfo(pg);
    const carryLeft = await pg.evaluate(() => planCarryTasks(planLoad(), planLoadLogView(), planTodayIso()).length);
    ok(cd.score === '100%' && (carryLeft ? cd.emoji === '✅' && /^Next/.test(cd.next || '') : cd.emoji === '🎉'), `[M6] the day's own tasks done: ${cd.emoji} ${cd.score} "${cd.result}"; ${carryLeft} catch-up task(s) left → next "${(cd.next || '').slice(0, 50)}" (🎉 only once nothing is left, PR6a)`);
    // M7 G32: Practice-mode Exam 5 does not count; plain Exam-mode Exam 6 counts (PR2), its result has no plan row; its Retry is plain
    await pg.click('#planRunBack'); await settle(pg, GUARD_MS);
    await pg.click('#screenPlanDay .back-btn'); await settle(pg, GUARD_MS);
    await pg.click('#modePractice'); await settle(pg, 100); await examTab(pg);
    const n0 = (await dayLog(pg, MOCK)).mock.length;
    await pg.click('#examGrid [data-action="startExam"][data-arg="5"]'); await settle(pg, GUARD_MS);
    for (let i = 0; i < 24; i++) { await answer(pg, true); const c = await run(pg); await pg.click('#nextBtn'); await settle(pg, c.idx === c.n - 1 ? GUARD_MS : 30); if (c.idx === c.n - 1) break; }
    rr = await resultRow(pg);
    ok(rr.scr === 'screenResult' && !rr.shown && (await dayLog(pg, MOCK)).mock.length === n0, `[M7] G32: Practice-mode Exam 5 (24 right) → no mock attempt, no plan row`);
    await pg.click('#screenResult .back-btn, #screenResult [data-action="goHome"]').catch(() => pg.evaluate(() => goHome())); await settle(pg, GUARD_MS);
    if ((await screen(pg)) !== 'screenHome') { await pg.evaluate(() => goHome()); await settle(pg, GUARD_MS); }
    await pg.click('#modeExam'); await settle(pg, 100);
    await pg.click('#examGrid [data-action="startExam"][data-arg="6"]'); await settle(pg, GUARD_MS);
    m = await mockInfo(pg);
    ok(!m.mock && m.back === '← Home' && m.label === 'Exam 6', `[M7] plain Exam 6 after a plan mock: not a plan mock, header "${m.back}"`);
    await playExam(pg, 19);
    rr = await resultRow(pg);
    ok(!rr.shown && rr.hidden, '[M7] its result page: #resultPlanRow hidden');
    note(`[M7] plain Exam-mode Exam 6 on a mock day: attempts ${n0} → ${(await dayLog(pg, MOCK)).mock.length} (G32 / PR2: any Exam-mode Exam 1–17 / Random counts)`);
    await pg.click('#screenResult [data-action="retryExam"]'); await settle(pg, GUARD_MS);
    m = await mockInfo(pg);
    ok(!m.mock && m.exam === 6 && m.mode === 'exam' && m.back === '← Home', `[M7] its Retry = plain Exam 6 again (${m.exam}, ${m.mode})`);
    await pg.click('#screenQuiz .back-btn'); await settle(pg, 200); await pg.click('#confirmOk'); await settle(pg, GUARD_MS);
    ok(errs.length === 0, `[M] main flow 0 errors ${errs.join(' | ')}`);
    await ctx.close();

    // ── G15 Leave / switch off, time up, double tap (10-26) ──
    const D26 = '2026-10-26';
    const c2 = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' }); await c2.addInitScript(INIT);
    const p2 = await c2.newPage(); const e2 = watch(p2);
    await planAt(p2, s.base, D26, { wrong: '{"1.3":true}' });
    await dayView(p2);
    let bx2 = await boxes(p2);
    ok(bx2[0].btn && bx2[1].btn, `[M8] ${D26}: two mock boxes "${bx2[0].ttl}" / "${bx2[1].ttl}"`);
    const ex26 = (await tasksOf(p2, D26))[0].exam;
    let sA = await storageAll(p2);
    await p2.click(boxSel(D26, 0)); await settle(p2, GUARD_MS);
    await playExam(p2, 3, { submit: false, upto: 3 });
    await p2.click('#screenQuiz .back-btn'); await settle(p2, 200);
    const modal = await p2.evaluate(() => ({ open: isConfirmOpen(), title: byId('confirmTitle') ? byId('confirmTitle').textContent : '', ok: byId('confirmOk').textContent, focus: document.activeElement.id }));
    ok(modal.open && modal.title === 'Leave the exam?' && modal.ok === 'Leave' && modal.focus === 'confirmCancel', `[M8] ← during a plan mock: "${modal.title}" (${modal.ok}), focus on Cancel`);
    await p2.click('#confirmCancel'); await settle(p2, 200);
    const t1 = (await mockInfo(p2)).timer; await p2.waitForTimeout(1300); const t2 = (await mockInfo(p2)).timer;
    ok((await screen(p2)) === 'screenQuiz' && t1 !== t2, `[M8] Cancel: still in the exam, timer running (${t1} → ${t2})`);
    await p2.click('#screenQuiz .back-btn'); await settle(p2, 200); await p2.click('#confirmOk'); await settle(p2, GUARD_MS);
    let sB = await storageAll(p2);
    ok((await screen(p2)) === 'screenPlanDay' && (await activeInfo(p2)).task === '0' && JSON.stringify(sA) === JSON.stringify(sB) && !(await p2.evaluate(() => examTimerId)), `[M8] G15 Leave → the day screen (focus on the box), timer stopped, storage unchanged (not submitted, nothing recorded)`);
    // switch off while timed
    await p2.click(boxSel(D26, 0)); await settle(p2, GUARD_MS);
    m = await mockInfo(p2);
    ok(m.exam === ex26, `[M9] the slot reopens its own exam after a Leave (${m.exam})`);
    await playExam(p2, 2, { submit: false, upto: 2 });
    sA = await storageAll(p2);
    await p2.click('#infoBtn'); await settle(p2, 150); await p2.click('#planFeatureSwitch'); await settle(p2, 200);
    const md2 = await p2.evaluate(() => ({ open: isConfirmOpen(), msg: byId('confirmMsg').textContent }));
    await p2.click('#confirmOk'); await settle(p2, GUARD_MS);
    sB = await storageAll(p2);
    const diffK = Object.keys({ ...sA, ...sB }).filter(k => sA[k] !== sB[k]);
    const toast = await p2.evaluate(() => byId('appToast').hidden ? '' : byId('appToast').textContent);
    ok(md2.open && (await screen(p2)) === 'screenHome' && diffK.join() === 'lifeuk.studyPlanEnabled' && !(await p2.evaluate(() => examTimerId)) && toast === 'Study plan turned off', `[M9] G15 switch off while timed: confirm ("${md2.msg.slice(0, 60)}…") → Home, timer stopped, only ${diffK.join()} written, toast "${toast}"`);
    await p2.click('#modeExam').catch(() => {}); await settle(p2, 100);
    const after = await p2.evaluate(() => ({ card: !!byId('planCard') && byId('planCard').getClientRects().length > 0, mock: isPlanMock() }));
    ok(!after.card, `[M9] off: no plan card (${JSON.stringify(after)})`);
    await p2.click('#infoBtn').catch(() => {}); await settle(p2, 150);
    if (!(await visible(p2, '#planFeatureSwitch'))) { await p2.click('#infoBtn'); await settle(p2, 150); }
    await p2.click('#planFeatureSwitch'); await settle(p2, 200);
    await p2.keyboard.press('Escape'); await settle(p2, 100);
    ok((await dayLog(p2, D26)).mock.length === 0, '[M9] switched back on: nothing recorded for the left mock');
    // a plain exam after switching off mid-mock: no plan leftovers
    await p2.click('#modeExam'); await settle(p2, 100); await p2.click('#examGrid [data-action="startExam"][data-arg="9"]'); await settle(p2, GUARD_MS);
    m = await mockInfo(p2);
    ok(!m.mock && m.back === '← Home' && m.planDay === null, `[M9] a plain Exam 9 afterwards: header "${m.back}", not a plan mock`);
    await p2.click('#screenQuiz .back-btn'); await settle(p2, 200); await p2.click('#confirmOk'); await settle(p2, GUARD_MS);
    // double tap on the box, then time up (20 right) → submitted, passed
    await dayView(p2);
    await p2.dblclick(boxSel(D26, 0)); await settle(p2, GUARD_MS);
    m = await mockInfo(p2);
    const picked = await p2.evaluate(() => Object.keys(state.answers).filter(k => (state.answers[k] || []).length).length);
    ok(m.mock && m.exam === ex26 && picked === 0 && (await p2.evaluate(() => state.current)) === 0, `[M10] double tap on the mock box: one exam, question 1, nothing picked (CUI-0011)`);
    await playExam(p2, 20, { submit: false, upto: 22 });
    await p2.clock.fastForward('45:00'); await settle(p2, 600);
    rr = await resultRow(p2);
    dl = await dayLog(p2, D26);
    ok(rr.scr === 'screenResult' && rr.timeUp && rr.note === '✓ Mock exam task done' && dl.mock.length === 1 && dl.mock[0].correct === 20, `[M10] time up → submitted automatically (time-up note), row "${rr.note}", attempt ${JSON.stringify(dl.mock)}`);
    // G39 (grill, after review S-133): Retry on a passed plan mock = a plain retake, not recorded, slot 1 unaffected
    await p2.click('#screenResult [data-action="retryExam"]'); await settle(p2, GUARD_MS);
    m = await mockInfo(p2);
    await playExam(p2, 5);
    const g39 = { mock: m.mock, planDay: m.planDay, row: (await resultRow(p2)).shown, n: (await dayLog(p2, D26)).mock.length };
    await dayView(p2);
    await p2.click(boxSel(D26, 1)); await settle(p2, GUARD_MS);
    const slot1 = (await mockInfo(p2)).exam; const ex1 = (await tasksOf(p2, D26))[1].exam;
    ok(!g39.mock && g39.planDay === null && !g39.row && g39.n === 1 && slot1 === ex1, `[M10] G39: Retry after a pass is a plain retake (got: plan mock ${g39.mock}, planDay ${g39.planDay}, row ${g39.row}, attempts ${g39.n}); then slot 1 opens Exam ${slot1} (its own: ${ex1})`);
    await p2.click('#screenQuiz .back-btn'); await settle(p2, 200); await p2.click('#confirmOk'); await settle(p2, GUARD_MS);
    // double tap on Retake (slot 1 fail first)
    await dayView(p2);
    await p2.click(boxSel(D26, 1)); await settle(p2, GUARD_MS);
    await playExam(p2, 5);
    await p2.dblclick('#resultPlanRow [data-action="planRetryMock"]'); await settle(p2, GUARD_MS);
    m = await mockInfo(p2);
    const picked2 = await p2.evaluate(() => Object.keys(state.answers).filter(k => (state.answers[k] || []).length).length);
    ok(m.exam === 'all' && m.mock && picked2 === 0 && (await p2.evaluate(() => state.current)) === 0, `[M10] double tap on Retake: one Random Exam, nothing picked`);
    // language inside a plan mock
    await p2.click('#langBtn'); await settle(p2, 150);
    m = await mockInfo(p2);
    ok(m.back === '← 今日任務' && m.label === '隨機試卷' && m.mock, `[M11] zh-HK inside the plan mock: "${m.back}" · ${m.label}`);
    await playExam(p2, 4);
    rr = await resultRow(p2);
    ok(rr.note === '未合格（合格需 18 / 24 分），可即日再考隨機試卷。' && rr.btns.map(x => x[0]).join(' / ') === '再考隨機試卷 / 返回任務列表', `[M11] zh-HK fail row "${rr.note}" [${rr.btns.map(x => x[0]).join(' / ')}]`);
    await p2.screenshot({ path: path.join(SHOTS, 'M-375-zh-HK-result-fail.png'), fullPage: true });
    await p2.click('#langBtn'); await settle(p2, 150);
    // past / ahead mocks are not buttons
    await dayView(p2, MOCK); bx2 = await boxes(p2);
    const tk24 = await tasksOf(p2, MOCK);
    ok(tk24.every((t, i) => t.type !== 'mock' || !bx2[i].btn), `[M12] a past day's mocks are not buttons (${bx2.map(x => (x.btn ? 'B' : 'li') + ':' + x.ttl.slice(0, 16)).join(' / ')})`);
    await dayView(p2, '2026-10-27'); bx2 = await boxes(p2);
    ok(!bx2[0].btn, `[M12] an ahead day's mock is not a button ("${bx2[0].ttl}" ${bx2[0].st})`);
    ok(e2.length === 0, `[M] G15 / time-up flow 0 errors ${e2.join(' | ')}`);
    await c2.close();

    // ── S-131: 23:50 start, 00:10 submit ──
    const D27 = '2026-10-27';
    const c3 = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
    const p3 = await c3.newPage(); const e3 = watch(p3);
    await planAt(p3, s.base, D27, { time: '23:50:00' });
    await dayView(p3);
    await p3.click(boxSel(D27, 0)); await settle(p3, GUARD_MS);
    m = await mockInfo(p3);
    await playExam(p3, 24, { submit: false });
    await p3.clock.fastForward('20:00'); await settle(p3, 400);
    const mid = await mockInfo(p3);
    await p3.click('#nextBtn'); await settle(p3, 250); if (await visible(p3, '#confirmOk')) { await p3.click('#confirmOk'); await settle(p3, 250); }
    await settle(p3, GUARD_MS);
    rr = await resultRow(p3);
    const l27 = await dayLog(p3, D27), l28 = await dayLog(p3, '2026-10-28');
    ok(m.planDay === D27 && mid.scr === 'screenQuiz' && rr.shown && rr.warn && rr.note === 'Submitted after midnight: this attempt does not count for that day.' && rr.btns.map(x => x[1]).join() === 'planBackToDay' && l27.mock.length === 0 && l28.mock.length === 0, `[M13] S-131: started 23:50 (${m.planDay}), submitted 00:10 → "${rr.note}" [${rr.btns.map(x => x[0]).join()}], no retake; 10-27 / 10-28 attempts ${l27.mock.length} / ${l28.mock.length}`);
    await p3.screenshot({ path: path.join(SHOTS, 'M-375-en-result-midnight.png'), fullPage: true });
    await p3.click('#langBtn'); await settle(p3, 150);
    rr = await resultRow(p3);
    ok(rr.note === '過了午夜才交卷，這次不計入當日計劃。', `[M13] zh-HK "${rr.note}"`);
    await p3.click('#langBtn'); await settle(p3, 150);
    await p3.click('#resultPlanRow [data-action="planBackToDay"]'); await settle(p3, GUARD_MS);
    const dv = await p3.evaluate(() => ({ scr: document.querySelector('.screen.active').id, h: (document.querySelector('#screenPlanDay h1, #screenPlanDay .plan-day-title, #planDayTitle') || {}).textContent }));
    ok(dv.scr === 'screenPlanDay', `[M13] Back to the task list → day screen (${(dv.h || '').trim().slice(0, 40)})`);
    ok(e3.length === 0, `[M13] 0 errors ${e3.join(' | ')}`);
    await c3.close();
  } finally { s.server.kill(); }
}

// ── C: Home "Continue" / "Start next" open every type; a whole day start → end ──
async function partC(b) {
  const s = await startPagesServer(ROOT);
  try {
    const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
    await ctx.addInitScript(INIT);
    const pg = await ctx.newPage(); const errs = watch(pg);
    await planAt(pg, s.base, TODAY, { wrong: '{"1.3":true,"3.12":true,"4.14":true}' });
    const c0 = await cardText(pg);
    await pg.click('#planCard .plan-btn-gold'); await settle(pg, GUARD_MS);
    let v = await factView(pg);
    ok(/Next: Read Ch 1/.test(c0) && v.facts && v.label === 'Chapter 1' && v.meta[1] === 'Fact 1 of 2', `[C1] Home "Continue" with reading next → the reading card itself ("${v.meta.join(' | ')}")`);
    const trail = []; let guard = 0;
    while (guard++ < 40) {
      const scr = await screen(pg);
      if (scr === 'screenQuiz') { const r = await run(pg); trail.push('Q:' + r.label + '(' + r.n + ')'); await finishTask(pg); continue; }
      if (scr !== 'screenPlanRun') break;
      v = await factView(pg);
      if (v.facts) { trail.push('F:' + v.label + ' ' + v.meta[1]);
        for (let i = 0; i < 40; i++) { v = await factView(pg); if (v.next.action !== 'planStepFact') break; await pg.click('#planRunBody .plan-run-nav .nav-btn:last-child'); await settle(pg, 30); }
        trail.push('→ "' + v.next.t + '"'); await pg.click('#planRunBody .plan-run-nav .nav-btn:last-child'); await settle(pg, GUARD_MS); continue; }
      const cd = await cardInfo(pg); trail.push('Card:' + cd.label + ' ' + cd.score);
      const go = cd.acts.find(a => a[1] === 'planOpenTask'); if (!go) break;
      await pg.click('#planRunBody [data-action="planOpenTask"]'); await settle(pg, GUARD_MS);
    }
    note(`[C2] Day 1 by "Continue" + "Start next": ${trail.join(' · ')}`);
    const cd = await cardInfo(pg);
    ok(cd.emoji === '🎉' && cd.score === '100%' && cd.result === "All of today's tasks are done!" && cd.acts.map(a => a[0]).join(' / ') === 'Review this task / Back to the task list', `[C2] whole Day 1 start → end: ${cd.emoji} ${cd.score} "${cd.result}" "${cd.sub}"`);
    ok(trail.filter(x => /^F:/.test(x)).length === 3 && trail.filter(x => /^Q:/.test(x)).length >= 4, '[C2] 3 reading cards + practise ×3 + clear wrong answers, every one opened by "Continue" / "Start next" / the last fact\'s button');
    await pg.click('#planRunBody [data-action="planBackToDay"]'); await settle(pg, GUARD_MS);
    const ring = await ringPct(pg); const bx = await boxes(pg);
    ok(ring === '100%' && bx.every(x => /done/.test(x.cls)), `[C2] day screen ${ring}, every box done: ${bx.map(x => x.st).join(' / ')}`);
    await pg.click('#screenPlanDay .back-btn'); await settle(pg, GUARD_MS);
    const c1 = await cardText(pg);
    ok(/100%/.test(c1) && /Done for today/i.test(c1), `[C2] Home card "${c1.slice(0, 120)}"`);
    // C3 drill day: wrong-facts next → "Continue" opens its Similar page; mock day: clear wrong first, "Start next" → the mock
    await pg.evaluate(() => localStorage.setItem('lifeuk.wrongList', '{"2.5":true,"6.9":true}')); // wrong answers made in plain Practice meanwhile
    await pg.clock.setSystemTime(at('2026-10-16')); await pg.reload(); await settle(pg, 400);
    await pg.evaluate(() => { const iso = planTodayIso(), d = planDayAt(planLoad(), iso), log = planLoadLog(); const ok = {}; d.tasks.filter(t => t.type === 'drill').forEach(t => t.qids.forEach(k => { ok[k] = 1; })); writePlanLog({ ...log, days: { ...log.days, [iso]: { ok, bad: {}, mock: [] } } }); });
    await pg.reload(); await settle(pg, 400);
    const c2 = await cardText(pg);
    await pg.click('#planCard .plan-btn-gold'); await settle(pg, GUARD_MS);
    v = await factView(pg);
    ok(v.facts && v.label === 'Wrong-answer facts' && v.card === 'sqm', `[C3] drill day, drills done (seeded log): "Continue" ("${c2.slice(0, 110)}") → the wrong-facts Similar page`);
    await pg.evaluate(() => localStorage.setItem('lifeuk.wrongList', '{"2.5":true,"6.9":true}'));
    await pg.clock.setSystemTime(at(MOCK)); await pg.reload(); await settle(pg, 400);
    await dayView(pg);
    const tk = await tasksOf(pg, MOCK); const ri = tk.findIndex(t => t.type === 'review');
    await pg.click(boxSel(MOCK, ri)); await settle(pg, GUARD_MS);
    if ((await screen(pg)) === 'screenQuiz') await finishTask(pg);
    let card = await cardInfo(pg);
    ok(/Timed mock exam/.test(card.next || ''), `[C3] mock day: clear wrong answers first → Result card next "${card.next}"`);
    await pg.click('#planRunBody [data-action="planOpenTask"]'); await settle(pg, GUARD_MS);
    const m = await mockInfo(pg);
    ok(m.scr === 'screenQuiz' && m.mock && m.mode === 'exam' && m.exam === tk[0].exam, `[C3] "Start next →" opens the mock (Exam ${m.exam}, Exam mode)`);
    await pg.click('#screenQuiz .back-btn'); await settle(pg, 200); await pg.click('#confirmOk'); await settle(pg, GUARD_MS);
    ok(errs.length === 0, `[C] 0 errors ${errs.join(' | ')}`);
    await ctx.close();
  } finally { s.server.kill(); }
}

// ── V: ⓘ Features switch (S-112) + G15 from the new screens (v1.0.4 itself: qa-v104.js run separately) ──
async function partV(b) {
  const s = await startPagesServer(ROOT);
  try {
    const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
    await ctx.addInitScript(INIT);
    const pg = await ctx.newPage(); const errs = watch(pg);
    await planAt(pg, s.base, TODAY, { wrong: '{"1.3":true}' });
    const pop = () => pg.evaluate(() => ({ open: byId('infoPop').getClientRects().length > 0 && getComputedStyle(byId('infoPop')).visibility !== 'hidden', row: !byId('infoPlanRow').hidden, title: byId('infoPlanRow').innerText.replace(/\s+/g, ' ').trim(),
      sw: byId('planFeatureSwitch') ? byId('planFeatureSwitch').getAttribute('aria-checked') : null, modal: isConfirmOpen(), focus: document.activeElement.id, toast: byId('appToast').hidden ? '' : byId('appToast').textContent, card: !!byId('planCard') && byId('planCard').getClientRects().length > 0 }));
    await pg.click('#infoBtn'); await settle(pg, 150);
    let p0 = await pop();
    ok(p0.open && p0.row && /^Features Study plan/.test(p0.title.replace(/🗓️ ?/, '')) && p0.sw === 'true', `[V1] ⓘ: "${p0.title}", switch ${p0.sw}`);
    await pg.click('#planFeatureSwitch'); await settle(pg, 200);
    let p1 = await pop();
    const mt = await pg.evaluate(() => ({ t: byId('confirmTitle').textContent, m: byId('confirmMsg').textContent, ok: byId('confirmOk').textContent, c: byId('confirmCancel').textContent }));
    ok(p1.modal && p1.open && p1.focus === 'confirmCancel', `[V2] switch off asks: "${mt.t}" / "${mt.m}" [${mt.ok} / ${mt.c}], popover stays, focus Cancel`);
    await pg.click('#confirmCancel'); await settle(pg, 200);
    p1 = await pop();
    ok(!p1.modal && p1.open && p1.sw === 'true' && p1.focus === 'planFeatureSwitch', `[V2] S-112 Cancel: popover still open, switch on, focus on the (visible) switch`);
    await pg.click('#planFeatureSwitch'); await settle(pg, 200); await pg.keyboard.press('Escape'); await settle(pg, 150);
    p1 = await pop();
    ok(!p1.modal && p1.open && p1.focus === 'planFeatureSwitch', '[V2] S-112 Esc: closes the modal only, popover open, focus on the switch');
    await pg.keyboard.press('Escape'); await settle(pg, 150);
    ok(!(await pop()).open, '[V2] second Esc closes the popover');
    await pg.click('#infoBtn'); await settle(pg, 150); await pg.click('#planFeatureSwitch'); await settle(pg, 200); await pg.click('#confirmOk'); await settle(pg, 300);
    p1 = await pop();
    ok(p1.open && p1.sw === 'false' && p1.focus === 'planFeatureSwitch' && p1.toast === 'Study plan turned off' && !p1.card, `[V3] OK: switch off, toast "${p1.toast}", card gone, popover open with focus on the switch`);
    await pg.click('#planFeatureSwitch'); await settle(pg, 300);
    p1 = await pop();
    ok(!p1.modal && p1.sw === 'true' && /^Study plan turned on/.test(p1.toast) && p1.card, `[V3] on again: no confirm, toast "${p1.toast}", card back`);
    await pg.keyboard.press('Escape'); await settle(pg, 150);
    // G15 from a reading card and from a wrong-facts page: switch off → Home, nothing written but the switch
    for (const [label, iso, pick] of [['reading', TODAY, t => t.type === 'read'], ['wrong facts', '2026-10-16', t => t.type === 'wrongFacts']]) {
      if (iso !== TODAY) { await pg.evaluate(() => localStorage.setItem('lifeuk.wrongList', '{"2.5":true,"3.12":true}')); await pg.clock.setSystemTime(at(iso)); await pg.reload(); await settle(pg, 400); }
      await dayView(pg); const tk = await tasksOf(pg, iso); const i = tk.findIndex(pick);
      await pg.click(boxSel(iso, i)); await settle(pg, GUARD_MS);
      const sA = await storageAll(pg);
      await pg.click('#infoBtn'); await settle(pg, 150); await pg.click('#planFeatureSwitch'); await settle(pg, 200); await pg.click('#confirmOk'); await settle(pg, GUARD_MS);
      const sB = await storageAll(pg); const dk = Object.keys({ ...sA, ...sB }).filter(k => sA[k] !== sB[k]);
      ok((await screen(pg)) === 'screenHome' && dk.join() === 'lifeuk.studyPlanEnabled', `[V4] G15 switch off on the ${label} page → Home, only ${dk.join()} written`);
      await pg.keyboard.press('Escape'); await settle(pg, 100);
      await pg.click('#infoBtn'); await settle(pg, 150); await pg.click('#planFeatureSwitch'); await settle(pg, 300); await pg.keyboard.press('Escape'); await settle(pg, 150);
    }
    // a plan mock's result page, switch off there: stays (not a plan screen), the row's "Back to the task list" → Home
    await pg.evaluate(() => localStorage.setItem('lifeuk.wrongList', '{"2.5":true}'));
    await pg.clock.setSystemTime(at(MOCK)); await pg.reload(); await settle(pg, 400);
    await pg.click('#planCard .plan-btn-gold'); await settle(pg, GUARD_MS);
    await playExam(pg, 19);
    await pg.click('#infoBtn'); await settle(pg, 150); await pg.click('#planFeatureSwitch'); await settle(pg, 200); await pg.click('#confirmOk'); await settle(pg, GUARD_MS);
    await pg.keyboard.press('Escape'); await settle(pg, 100);
    const scrR = await screen(pg); const rowR = await resultRow(pg);
    await pg.click('#resultPlanRow [data-action="planBackToDay"]').catch(() => {}); await settle(pg, GUARD_MS);
    const scrB = await screen(pg);
    note(`[V5] switch off on a plan mock's result page: stays on ${scrR} (row still ${rowR.shown ? 'shown: "' + rowR.note + '"' : 'hidden'}); its button → ${scrB}`);
    ok(scrR === 'screenResult' && scrB === 'screenHome', `[V5] switch off on the result page keeps the results (W-031 style); "Back to the task list" then goes Home (${scrB})`);
    ok(errs.length === 0, `[V] 0 errors ${errs.join(' | ')}`);
    await ctx.close();
  } finally { s.server.kill(); }
}

// ── L: 360 / 375 / 400 × en / zh-HK (touch) ──
const COLLOQUIAL = /[唔嘅咗嚟睇喺冇啲咁仲揀攞諗嘢係佢哋噉囉喎啱晒俾畀嗰呢乜㗎嘞咩]/;
async function partL(b) {
  const s = await startPagesServer(ROOT);
  try {
    for (const w of [360, 375, 400]) for (const lang of ['en', 'zh-HK']) {
      const ctx = await b.newContext({ viewport: { width: w, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, serviceWorkers: 'block' });
      await ctx.addInitScript(CONTRAST_FN);
      const pg = await ctx.newPage(); const errs = watch(pg);
      const tag = `${w}-${lang}`; const texts = []; const shot = (n, full = true) => pg.screenshot({ path: path.join(SHOTS, `L-${tag}-${n}.png`), fullPage: full });
      const hs = sel => pg.evaluate(sel => Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, ...[...document.querySelectorAll(sel + ' *')].filter(e => e.getClientRects().length).map(e => Math.round(e.getBoundingClientRect().right - innerWidth))), sel);
      const hits = [], over = [], con = [];
      const conOf = async sel => { if (await visible(pg, sel)) con.push(...await pg.evaluate(sel => { const e = document.querySelector(sel); const own = window.__contrast(e); return window.__contrastAll(e).concat(own && e.textContent.trim() && !e.children.length ? [{ t: e.textContent.trim().slice(0, 24), r: +own.r.toFixed(2), o: +own.o.toFixed(2), cls: e.className }] : []); }, sel)); };
      const take = async (name, scr, sels) => { await pg.evaluate(() => scrollTo(0, 0)); await settle(pg, 500); over.push([name, await hs(scr)]); for (const x of sels) await conOf(x); texts.push(name + '\n' + await pg.$eval(scr, e => e.innerText)); await shot(name); };
      // reading: Day 1 Read Ch 2 (first + last fact), review note
      await planAt(pg, s.base, TODAY, { lang, wrong: '{"1.3":true,"3.12":true}' });
      await dayView(pg);
      await pg.tap(boxSel(TODAY, 2)); await settle(pg, GUARD_MS);
      await take('read-first', '#screenPlanRun', ['#planRunBack', '#screenPlanRun .quiz-header', '#planRunBody .plan-run-head', '#planRunBody .plan-run-nav', '#planRunBody .fact-practise']);
      for (const sel of ['#planRunBack', '#planRunBody .fact-practise', '#planRunBody .plan-run-nav .nav-btn:last-child', '#planRunBody .fact-btn.star']) hits.push([sel, await hitOf(pg, sel)]);
      for (let i = 0; i < 3; i++) { await pg.tap('#planRunBody .plan-run-nav .nav-btn:last-child'); await settle(pg, 80); }
      await take('read-last', '#screenPlanRun', ['#planRunBody .plan-run-nav']);
      hits.push(['last main', await hitOf(pg, '#planRunBody .plan-run-nav .nav-btn:last-child')], ['prev', await hitOf(pg, '#planRunBody .plan-run-nav .nav-btn:first-child')]);
      const navH = await pg.evaluate(() => [...document.querySelectorAll('#planRunBody .plan-run-nav .nav-btn')].map(e => Math.round(e.getBoundingClientRect().height)));
      // wrong facts (drill day)
      await pg.evaluate(() => localStorage.setItem('lifeuk.wrongList', '{"1.3":true,"3.12":true,"4.14":true,"2.5":true}'));
      await pg.clock.setSystemTime(at('2026-10-16')); await pg.reload(); await settle(pg, 400); await dayView(pg);
      const tk = await tasksOf(pg, '2026-10-16'); const wi = tk.findIndex(t => t.type === 'wrongFacts');
      await pg.tap(boxSel('2026-10-16', wi)); await settle(pg, GUARD_MS);
      await take('wrongfacts', '#screenPlanRun', ['#planRunBack', '#planRunBody .plan-run-head', '#planRunBody .sqm-cta', '#planRunBody .plan-run-nav']);
      hits.push(['sqm cta', await hitOf(pg, '#planRunBody .sqm-cta button')]);
      // mock day: the exam, a failed result, a passed one
      await pg.clock.setSystemTime(at(MOCK)); await pg.reload(); await settle(pg, 400); await dayView(pg);
      await pg.tap(boxSel(MOCK, 0)); await settle(pg, GUARD_MS);
      await take('mock-exam', '#screenQuiz', ['#screenQuiz .quiz-header']);
      hits.push(['mock back', await hitOf(pg, '#screenQuiz .back-btn')]);
      const backLines = await pg.evaluate(() => { const e = document.querySelector('#screenQuiz .back-btn'); const r = document.createRange(); r.selectNodeContents(e); return new Set([...r.getClientRects()].map(x => Math.round(x.bottom))).size; });
      for (let i = 0; i < 24; i++) { const c = await pg.evaluate(() => { const q = state.questions[state.current]; return { a: q.a, n: q.o.length, idx: state.current }; }); const picks = i < 8 ? c.a : [...Array(c.n).keys()].filter(x => !c.a.includes(x)).slice(0, c.a.length); for (const oi of picks) await pg.tap('#opt' + oi); await settle(pg, 20); if (c.idx === 23) break; await pg.tap('#nextBtn'); await settle(pg, 20); }
      await pg.tap('#nextBtn'); await settle(pg, 250); if (await visible(pg, '#confirmOk')) { await pg.tap('#confirmOk'); await settle(pg, 250); }
      await settle(pg, GUARD_MS);
      await pg.evaluate(() => byId('resultPlanRow').scrollIntoView({ block: 'center' })); await settle(pg, 400);
      over.push(['mock-fail', await hs('#screenResult')]); await conOf('#resultPlanRow'); texts.push('mock-fail\n' + await pg.$eval('#resultPlanRow', e => e.innerText)); await shot('mock-fail', false);
      for (const sel of ['#resultPlanRow [data-action="planRetryMock"]', '#resultPlanRow [data-action="planBackToDay"]']) hits.push([sel, await hitOf(pg, sel, true)]);
      await pg.tap('#resultPlanRow [data-action="planRetryMock"]'); await settle(pg, GUARD_MS);
      for (let i = 0; i < 24; i++) { const c = await pg.evaluate(() => { const q = state.questions[state.current]; return { a: q.a, idx: state.current }; }); for (const oi of c.a) await pg.tap('#opt' + oi); await settle(pg, 20); if (c.idx === 23) break; await pg.tap('#nextBtn'); await settle(pg, 20); }
      await pg.tap('#nextBtn'); await settle(pg, 250); if (await visible(pg, '#confirmOk')) { await pg.tap('#confirmOk'); await settle(pg, 250); }
      await settle(pg, GUARD_MS);
      await pg.evaluate(() => byId('resultPlanRow').scrollIntoView({ block: 'center' })); await settle(pg, 400);
      over.push(['mock-pass', await hs('#screenResult')]); await conOf('#resultPlanRow'); texts.push('mock-pass\n' + await pg.$eval('#resultPlanRow', e => e.innerText)); await shot('mock-pass', false);
      hits.push(['pass back', await hitOf(pg, '#resultPlanRow [data-action="planBackToDay"]', true)]);
      const bad = over.filter(o => o[1] > 0);
      ok(bad.length === 0, `[L] ${tag}: no horizontal overflow (${over.map(o => o[0] + ' ' + o[1]).join(', ')})`);
      const miss = hits.filter(h => !h[1] || !h[1].hit44);
      ok(miss.length === 0 && navH.every(h => h >= 44), `[L] ${tag}: tap areas ≥ 44px: ${hits.map(h => h[0].replace(/#planRunBody |#resultPlanRow |\[data-action="|"\]/g, '') + ' ' + (h[1] ? h[1].w + '×' + h[1].h + (h[1].hit44 ? '✓' : '✗') : 'n/a')).join(', ')}; nav ${navH.join('/')}`);
      const low = con.filter(c => c.r < 4.5 || c.o < 1);
      ok(low.length === 0, `[L] ${tag}: ${con.length} texts ≥ 4.5:1 without opacity (min ${Math.min(...con.map(c => c.r))}) ${[...new Set(low.map(c => c.t + ' ' + c.r + '/' + c.o + ' ' + c.cls))].slice(0, 8).join(' | ')}`);
      ok(backLines === 1, `[L] ${tag}: mock header back on one line (${backLines})`);
      if (lang === 'zh-HK') {
        const planOnly = texts.join('\n').split('\n').filter(l => /條|任務|練習這|上一|下一|錯題知識點|模擬考|合格|再考|午夜|返回|重溫|溫習|閱讀/.test(l));
        const all = planOnly.join('\n'); const z = [...new Set((all.match(new RegExp(COLLOQUIAL.source, 'g')) || []))];
        ok(z.length === 0, `[L] ${tag}: plan text has no colloquial characters ${z.join('')} ${z.length ? planOnly.filter(l => COLLOQUIAL.test(l)).slice(0, 4).join(' / ') : ''}`);
        const half = all.match(/[一-鿿][,!?:;()]|[,!?:;()][一-鿿]/g);
        ok(!half, `[L] ${tag}: full-width punctuation next to Chinese ${half ? half.join(' ') : ''}`);
      }
      if (w === 375) fs.writeFileSync(path.join(SHOTS, `L-375-${lang}-texts.txt`), texts.join('\n\n----\n\n'));
      ok(errs.length === 0, `[L] ${tag}: 0 errors ${errs.join(' | ')}`);
      await ctx.close();
    }
    // mockup #runner at 375: reading, wrong facts
    const ctx = await b.newContext({ viewport: { width: 375, height: 800 }, deviceScaleFactor: 2 });
    const pg = await ctx.newPage();
    await pg.goto('file://' + path.join(ROOT, 'mockups', 'study-plan-flow.html')); await settle(pg, 400);
    const found = await pg.evaluate(() => { const out = {}; for (let d = 0; d < 40; d++) { let ts; try { ts = dayTasks(d); } catch (e) { break; } (ts || []).forEach((t, i) => { const k = t.wrongFacts ? 'wrongfacts' : t.type; if (!(k in out)) out[k] = [d, i]; }); } return out; });
    note(`[L] mockup task kinds: ${JSON.stringify(found)}`);
    for (const k of ['read', 'wrongfacts', 'mock']) { if (!found[k]) continue;
      await pg.evaluate(([d, i]) => { goto(3); state.viewDay = d; openRunner(i); }, found[k]); await settle(pg, 300);
      await pg.screenshot({ path: path.join(SHOTS, `M-375-mockup-runner-${k}.png`), fullPage: true }); }
    await ctx.close();
  } finally { s.server.kill(); }
}

// ── P: performance with the longest plan (182 days + exam day) ──
async function partP(b) {
  const s = await startPagesServer(ROOT);
  try {
    for (const rate of [1, 4]) {
      const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
      const pg = await ctx.newPage(); const errs = watch(pg);
      await boot(pg, s.base, NOW);
      await createViaUi(pg, { date: '2027-04-08', noRest: true });
      const n = await pg.evaluate(() => planLoad().days.length);
      // the biggest reading task of the plan, opened from its day (ahead / past as it falls)
      const big = await pg.evaluate(() => { let best = null; planLoad().days.forEach(d => d.tasks.forEach((t, i) => { if (t.type === 'read' && (!best || t.facts.length > best.n)) best = { date: d.date, i, n: t.facts.length }; })); return best; });
      await pg.evaluate(skip => { const plan = planLoad(); const days = {}; plan.days.slice(0, 90).forEach((d, i) => { if (d.date === skip) return; const q = d.tasks.flatMap(planTaskQids); days[d.date] = { ok: Object.fromEntries(q.slice(0, Math.round(q.length * (i % 5) / 4)).map(k => [k, 1])) }; }); writePlanLog({ v: 1, days }); }, big.date);
      const mockDay = await pg.evaluate(() => planLoad().days.find(d => d.tasks.some(t => t.type === 'mock')).date);
      const cdp = await ctx.newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate', { rate });
      await pg.evaluate(() => { document.addEventListener('click', () => { window.__t0 = performance.now(); }, true); });
      const measure = () => pg.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(Math.round(performance.now() - window.__t0))))));
      const clickM = async sel => { await pg.click(sel); const m = await measure(); await settle(pg, GUARD_MS); return m; };
      await pg.clock.setSystemTime(at(addDays(TODAY, 90))); await pg.reload(); await settle(pg, 400);
      await pg.evaluate(() => { document.addEventListener('click', () => { window.__t0 = performance.now(); }, true); });
      await dayView(pg, big.date);
      const open = await clickM(boxSel(big.date, big.i));
      const steps = []; for (let i = 0; i < 5; i++) steps.push(await clickM('#planRunBody .plan-run-nav .nav-btn:last-child'));
      const star = await clickM('#planRunBody .fact-btn.star'); await clickM('#planRunBody .fact-btn.star');
      const lang = []; for (let i = 0; i < 2; i++) lang.push(await clickM('#langBtn'));
      for (let i = 0; i < 40 && !(await visible(pg, '#planRunBody .fact-practise')); i++) { await pg.click('#planRunBody .plan-run-nav .nav-btn:last-child'); await settle(pg, 30); }
      const prac = await clickM('#planRunBody .fact-practise');
      const back = await clickM('#screenQuiz .back-btn');
      // a mock day: Continue → exam, Submit → result row
      await pg.clock.setSystemTime(at(mockDay)); await pg.reload(); await settle(pg, 400);
      await pg.evaluate(() => { document.addEventListener('click', () => { window.__t0 = performance.now(); }, true); });
      await dayView(pg); const mi = (await tasksOf(pg, mockDay)).findIndex(t => t.type === 'mock');
      const mopen = await clickM(boxSel(mockDay, mi));
      for (let i = 0; i < 23; i++) { await answer(pg, true); await pg.click('#nextBtn'); await settle(pg, 20); }
      await answer(pg, true);
      const sub = await clickM('#nextBtn');
      const row = await resultRow(pg);
      const all = [open, ...steps, star, ...lang, prac, back, mopen, sub];
      note(`[P] CPU ×${rate} (${n} days; reading ${big.n} facts on ${big.date}; mock ${mockDay}): open ${open} ms; Next ${steps.join('/')}; bookmark ${star}; language ${lang.join('/')}; ▶ Practise ${prac}; ← ${back}; mock open ${mopen}; submit → result + row ${sub}`);
      const lim = rate === 1 ? 200 : 600;
      ok(n === 182 && row.shown && Math.max(...all) < lim, `[P] CPU ×${rate}: all < ${lim} ms (max ${Math.max(...all)})`);
      ok(errs.length === 0, `[P] CPU ×${rate}: 0 errors ${errs.join(' | ')}`);
      await ctx.close();
    }
  } finally { s.server.kill(); }
}

// ── U: upgrade from v1.0.4 (5039512) + mixed shell + offline ──
const V104 = process.env.QA_V104 || '5039512';
async function partU(b) {
  // U1 v1.0.4 SW controlling, files replaced by the PR tree (same APP_VERSION 1.0.4 → same cache name)
  { const dir = path.join(WORK, 'pr6b-up'); archive(V104, dir);
    const { base, server } = await startPagesServer(dir);
    try {
      const ctx = await b.newContext({ viewport: { width: 375, height: 812 } }); const pg = await ctx.newPage(); const errs = watch(pg);
      await pg.clock.install({ time: NOW });
      await pg.goto(base); await pg.evaluate(() => navigator.serviceWorker.ready); await pg.reload(); await pg.waitForFunction(() => !!navigator.serviceWorker.controller);
      await pg.goto(base + '?preview=plan'); await settle(pg, 400); await createViaUi(pg);
      const plan0 = await ls(pg, 'lifeuk.studyPlan');
      ok(await pg.evaluate(() => typeof planShowFacts === 'undefined'), `[U1] v1.0.4 (${V104}) SW controlling, plan built there`);
      fs.readdirSync(dir).forEach(f => fs.rmSync(path.join(dir, f), { recursive: true, force: true }));
      appFiles(ROOT).forEach(f => fs.cpSync(path.join(ROOT, f), path.join(dir, f), { recursive: true }));
      await pg.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update().catch(() => {}); });
      await settle(pg, 1500); await pg.reload(); await settle(pg, 600); await pg.reload(); await settle(pg, 600);
      const st = await pg.evaluate(async () => ({ fn: typeof planShowFacts, keys: (await caches.keys()).filter(k => k.startsWith('lifeuk')), plan: localStorage.getItem('lifeuk.studyPlan') }));
      note(`[U1] after the files change with APP_VERSION still 1.0.4: planShowFacts ${st.fn}, caches ${st.keys.join()} (cache-first shell: new code arrives with the next APP_VERSION, as every middle PR)`);
      ok(st.plan === plan0 && errs.length === 0, `[U1] plan kept, 0 errors ${errs.join(' | ')}`);
      await ctx.close();
    } finally { server.kill(); fs.rmSync(dir, { recursive: true, force: true }); } }
  // U2 the PR tree installed by its SW, offline: reading card, wrong-facts page, mock result row, styled
  { const s = await startPagesServer(ROOT);
    try {
      const ctx = await b.newContext({ viewport: { width: 375, height: 812 } }); const pg = await ctx.newPage(); const errs = watch(pg);
      await pg.clock.install({ time: NOW });
      await pg.goto(s.base); await pg.evaluate(() => navigator.serviceWorker.ready); await pg.reload(); await pg.waitForFunction(() => !!navigator.serviceWorker.controller);
      await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('lifeuk.installDismissed', 'true'); localStorage.setItem('lifeuk.wrongList', '{"1.3":true,"2.5":true}'); });
      await pg.goto(s.base + '?preview=plan'); await settle(pg, 400); await createViaUi(pg);
      await ctx.setOffline(true);
      await pg.reload(); await settle(pg, 500);
      await pg.click('#planCard .plan-btn-gold'); await settle(pg, GUARD_MS);
      const v = await factView(pg);
      const css = await pg.evaluate(() => ({ nav: getComputedStyle(document.querySelector('#planRunBody .plan-run-nav .nav-btn')).minHeight, meta: getComputedStyle(document.querySelector('#planRunBody .plan-run-meta')).display }));
      ok(v.facts && v.card === 'fact' && css.nav === '44px' && css.meta === 'flex', `[U2] offline: Continue → reading card, styled (${JSON.stringify(css)})`);
      await pg.clock.setSystemTime(at(MOCK)); await pg.reload(); await settle(pg, 500);
      await pg.click('#planCard .plan-btn-gold'); await settle(pg, GUARD_MS);
      await playExam(pg, 18);
      const rr = await resultRow(pg);
      const rcss = await pg.evaluate(() => getComputedStyle(document.querySelector('#resultPlanRow .nav-btn')).minHeight);
      ok(rr.shown && rr.note === '✓ Mock exam task done' && rcss === '44px', `[U2] offline mock → result row "${rr.note}" (min-height ${rcss})`);
      await ctx.setOffline(false);
      ok(errs.length === 0, `[U2] 0 errors ${errs.join(' | ')}`);
      await ctx.close();
    } finally { s.server.kill(); } }
  // U3 mixed: v1.0.4 index.html (no #resultPlanRow) + PR js
  { const mix = path.join(WORK, 'pr6b-mixed'); fs.rmSync(mix, { recursive: true, force: true }); fs.mkdirSync(mix, { recursive: true });
    appFiles(ROOT).forEach(f => fs.cpSync(path.join(ROOT, f), path.join(mix, f), { recursive: true }));
    fs.writeFileSync(path.join(mix, 'index.html'), execSync(`git show ${V104}:index.html`, { cwd: ROOT }));
    const s = await startPagesServer(mix);
    try {
      const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' }); const pg = await ctx.newPage(); const errs = watch(pg);
      await planAt(pg, s.base, TODAY, { wrong: '{"1.3":true}' });
      await pg.click('#planCard .plan-btn-gold'); await settle(pg, GUARD_MS);
      const v = await factView(pg);
      ok(v.facts && v.card === 'fact', `[U3] old v1.0.4 shell + PR js: Continue → reading card works (${v.meta.join(' | ')})`);
      await pg.clock.setSystemTime(at(MOCK)); await pg.reload(); await settle(pg, 400);
      await pg.click('#planCard .plan-btn-gold'); await settle(pg, GUARD_MS);
      await playExam(pg, 10);
      const r = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, row: !!byId('resultPlanRow'), mock: planDayLog(planLoadLog(), planTodayIso()).mock.length }));
      await pg.click('#screenResult [data-action="retryExam"]'); await settle(pg, GUARD_MS);
      const m = await mockInfo(pg);
      ok(r.scr === 'screenResult' && !r.row && r.mock === 1 && m.exam === 'all' && m.mode === 'exam', `[U3] old shell: plan mock submitted (attempt recorded, no #resultPlanRow to fill), Retry → Random Exam in Exam mode`);
      ok(errs.length === 0, `[U3] 0 errors ${errs.join(' | ')}`);
      await ctx.close();
    } finally { s.server.kill(); fs.rmSync(mix, { recursive: true, force: true }); } }
}
let lg = null;
(async () => {
  fs.mkdirSync(WORK, { recursive: true }); fs.mkdirSync(SHOTS, { recursive: true });
  const b = await chromium.launch(launchOpts);
  const only = process.env.QA_ONLY || 'HRWMCVPLU';
  const PARTS = { H: () => partH, R: () => partR, W: () => partW, M: () => partM, C: () => partC, V: () => partV, P: () => partP, L: () => partL, U: () => partU };
  for (const k of Object.keys(PARTS)) {
    if (!only.includes(k)) continue;
    try { await PARTS[k]()(b); } catch (e) { fail++; console.log(`FAIL: part ${k} exception`, e.stack); }
  }
  await b.close();
  console.log('\nnotes:\n- ' + notes.join('\n- '));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
