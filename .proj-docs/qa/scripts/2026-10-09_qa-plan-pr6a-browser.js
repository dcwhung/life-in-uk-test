// QA plan PR6a (runner: practise / drill / clear wrong answers, review mode, task Result card, G37 mastered = done):
// real-browser checks over http
//   node 2026-10-09_qa-plan-pr6a-browser.js <repo-root> <work-dir> <shot-dir> [base-ref=origin/main] [v102-ref=f7fa19b]
// H. hidden (no preview): base tree (origin/main = PR5) vs PR tree, same seeded-random flow through Practice (by exam,
//    Similar "Practise these N"), Wrong answers, Flagged, Chapter, Exam mode (leave + submit): storage writes, DOM, errors
// F. real user flow, entered by URL (?preview=plan), clicks / keyboard only, flowing clock (CUI-0011 guard sees real
//    time): create → day → practise task (wrong / skip / redo) → rounds (> 24) → Result card → clear wrong answers →
//    all done 🎉 → review mode (G17) → Home "Continue" → catch-up (G8) / past / ahead (G5 / G23) → G15 → language
// G. G37: seeded streaks → mastered tasks, reading counted, review on entry, numbers agree on Home / day / schedule /
//    calendar / KPI; half mastered asks the rest (W-038 rounds); Practice mastering later; a wrong answer undoes 🏆;
//    drill / clear wrong unaffected; no plan → no plan writes
// E. QA edge cases: empty wrong list, W-030 copies, re-entry mid-task round numbers, midnight inside the runner,
//    plan deleted in another tab, another tab's answers kept, unreadable log, quick-nav button, double tap, keyboard
// P. performance: 183-day plan, open the runner / Result card / language (CPU ×1 and ×4)
// L. 360 / 375 / 400 × en / zh-HK (touch): runner, Similar, review mode, Result card: overflow, 44px, contrast, zh-HK
// U. upgrade: v1.0.2 and PR5 (origin/main) SW → PR tree; planRun.js in cache; offline runner; mixed old shell + new js
// Re-test (f24cec2): CUI-0024 rounds on re-entry (E2 / E2b), O-2 Result card after midnight (E3 / E8), O-3 quick-nav
// title (E6), G38 any plan runner clears the wrong list on a right answer, plain Practice does not (F3 / F9 / G8).
// QA_ONLY=HFGEPLU picks parts.
const { chromium } = require('playwright-core');
const { execSync } = require('child_process');
const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(process.argv[2]); const WORK = path.resolve(process.argv[3]); const SHOTS = path.resolve(process.argv[4]);
const BASE = process.argv[5] || 'origin/main'; const V102 = process.argv[6] || 'f7fa19b';
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

// ── H: hidden state, base (PR5) vs PR ──
const NORM_DOM = () => {
  window.__dom = () => { const a = document.querySelector('.screen.active'); const c = a.cloneNode(true);
    c.querySelectorAll('#planRunNote, #planPairNote').forEach(e => e.remove()); // PR6a's two hidden notes (not shown outside a plan task)
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
  const writes = await pg.evaluate(() => window.__w.map(w => w[0] + ':' + w[1] + '=' + (w[2] || '').slice(0, 400)));
  const st = await storageAll(pg);
  await ctx.close();
  return { dom, vis, writes, storage: st, errs, log };
}
async function partH(b) {
  const dir = path.join(WORK, 'pr6a-base'); archive(BASE, dir);
  const s1 = await startPagesServer(dir), s2 = await startPagesServer(ROOT);
  try {
    const a = await hiddenFlow(b, s1.base), p = await hiddenFlow(b, s2.base);
    note(`[H] flow: ${p.log.join(', ')}; ${p.dom.length} DOM snapshots, ${p.writes.length} storage writes`);
    const wDiff = a.writes.map((w, i) => (w === p.writes[i] ? null : `#${i} base ${w} / pr ${p.writes[i]}`)).filter(Boolean);
    ok(a.writes.length === p.writes.length && wDiff.length === 0, `[H1] Practice / Similar / Wrong answers / Flagged / Chapter / Exam (leave + submit): storage write sequence identical (${p.writes.length} writes) ${wDiff.slice(0, 3).join(' | ')}`);
    ok(JSON.stringify(a.storage) === JSON.stringify(p.storage), '[H2] final localStorage identical (keys + values)');
    ok(!p.writes.some(w => /studyPlan/.test(w)), '[H3] 0 lifeuk.studyPlan* writes');
    const dDiff = a.dom.map((d, i) => (d === p.dom[i] ? null : i + ' ' + d.split('::')[0])).filter(Boolean);
    if (dDiff.length) { const i = Number(dDiff[0].split(' ')[0]); const x = a.dom[i], y = p.dom[i]; let k = 0; while (x[k] === y[k]) k++; note(`[H4] first DOM diff at ${dDiff[0]}: base …${x.slice(k - 80, k + 120)}… / pr …${y.slice(k - 80, k + 120)}…`); }
    ok(a.dom.length === p.dom.length && dDiff.length === 0, `[H4] active screen DOM identical at ${p.dom.length} points (PR6a's two hidden notes left out) ${dDiff.join(', ')}`);
    ok(JSON.stringify(a.vis) === JSON.stringify(p.vis), '[H5] visible text identical at every point');
    ok(a.errs.length === 0 && p.errs.length === 0, `[H6] 0 console / page errors ${a.errs.concat(p.errs).join(' | ')}`);
    ok(p.log.length === 1, '[H7] the flow reached a Similar "Practise these N" side session (shown outside a plan task)');
  } finally { s1.server.kill(); s2.server.kill(); fs.rmSync(dir, { recursive: true, force: true }); }
}

// ── F: real user flow via URL ──
async function partF(b) {
  const s = await startPagesServer(ROOT);
  try {
    const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
    await ctx.addInitScript(INIT); await ctx.addInitScript(CONTRAST_FN);
    const pg = await ctx.newPage(); const errs = watch(pg);
    await boot(pg, s.base, NOW, { wrong: '{"1.3":true,"3.12":true,"4.14":true}' });
    await createViaUi(pg);
    const plan = await pg.evaluate(() => planLoad());
    const d1 = plan.days[0].tasks;
    ok(plan.days.length === 21 && d1.map(t => t.type).join() === 'read,practice,read,practice,read,practice,review', `[F1] built via UI: Day 1 ${d1.map(t => t.type + (t.ch || '') + (t.qids ? '(' + t.qids.length + ')' : '')).join(' ')}`);
    // F2 Home "Continue": Day 1's next step is reading (PR6b) → the day screen
    let c0 = await cardText(pg);
    await pg.click('#planCard .plan-btn-gold'); await settle(pg, GUARD_MS);
    ok((await screen(pg)) === 'screenPlanDay' && /Next: Read/.test(c0), `[F2] Home "Continue" with reading next (PR6b): opens the day screen ("${c0.slice(0, 80)}…")`);
    let bx = await boxes(pg);
    ok(bx.filter(x => x.btn).map(x => x.task).join() === '1,3,5,6' && bx.filter(x => !x.btn).length === 3, `[F2] day boxes: practise ×3 + clear wrong are buttons, reading ×3 not (PR6b): ${bx.map(x => (x.btn ? 'B' : 'li') + ':' + x.ttl.slice(0, 18)).join(' / ')}`);
    ok(/1 question · Wrong answers|2 questions · Wrong answers/.test(bx[6].st), `[F2] G9 snapshot: clear wrong answers "${bx[6].st}" (wrong list 1.3 + 3.12 + its copy 4.14)`);
    // F3 tap "Practise Ch 1" (9): Q1 wrong, Q2 skipped, rest right
    const q1 = d1[1].qids;
    await pg.click(boxSel(TODAY, 1)); await settle(pg, GUARD_MS);
    let r = await run(pg);
    ok(r.scr === 'screenQuiz' && r.plan && r.label === 'Chapter 1' && r.badge === 'Practice' && r.back === "← Today's tasks" && r.n === 9 && r.dots === 9 && !r.timer && r.planDay === TODAY, `[F3] task box → runner = Practice screen: "${r.label}" · ${r.badge}, ${r.dots} dots, "${r.back}", no timer, counts for ${r.planDay}`);
    ok(r.round === '' && r.pair === 'Once these questions are right, the matching facts count as read.' && r.note === '', `[F3] one round: no round note; G3 pair note "${r.pair}"`);
    const dom0 = await pg.evaluate(() => ({ card: !!document.querySelector('#screenQuiz .q-card, #screenQuiz .question-card, #qCard'), opts: document.querySelectorAll('#screenQuiz [data-action="selectOption"]').length, meta: !!document.querySelector('#screenQuiz .dots-meta'), nav: !!document.querySelector('#screenQuiz .nav-row #prevBtn') }));
    ok(dom0.opts >= 2 && dom0.meta && dom0.nav, `[F3] same Practice markup: options ${dom0.opts}, dots-meta, nav-row Prev / Next`);
    const wrongK = r.key;
    let w0 = await wN(pg);
    await answer(pg, false);
    r = await run(pg);
    const wA = await writesSince(pg, w0);
    ok(/^✗ Wrong/.test(r.ans) && !r.simCta, `[F3] wrong answer: "${r.ans}"; Similar panel ${r.simShow ? 'shown' : 'none for this question'}, no "Practise these N" (G26)`);
    ok(wA.filter(w => /practiceStreak/.test(w)).length === 1 && wA.filter(w => /studyPlanProgress/.test(w)).length === 1 && wA.some(w => /wrongList/.test(w)), `[F3] one answer: streak ×1, plan log ×1, wrong list (${wA.join(' | ')})`);
    let lg = await dayLog(pg, TODAY);
    ok(lg.bad[wrongK] === 1 && !lg.ok[wrongK], '[F3] wrong only in bad (counts for nothing)');
    await pg.click('#nextBtn'); await settle(pg, 40);
    const skipK = (await run(pg)).key; await pg.click('#nextBtn'); await settle(pg, 40); // skip Q2
    let simSeen = r.simShow ? 1 : 0;
    const rest = await playRound(pg, { onEach: async c => { if (c.idx > 2) {} } });
    ok(rest.last.next === 'Next round →', `[F3] last question after a skip + a wrong: "${rest.last.next}"`);
    r = await run(pg);
    ok(r.n === 2 && r.key === skipK, `[F3] next round: the skipped one first, then the wrong one (${r.n} questions), note "${r.round}"`);
    await answer(pg, true); await pg.click('#nextBtn'); await settle(pg, 40);
    r = await run(pg);
    ok(r.key === wrongK && r.round === '🔁 Redo the wrong answer (1 left)', `[F3] redo note on the wrong one: "${r.round}"`);
    await answer(pg, false); r = await run(pg);
    ok(r.next === '🔁 Redo the wrong answer (1 left)', `[F3] wrong again: last button "${r.next}"`);
    await pg.click('#nextBtn'); await settle(pg, GUARD_MS);
    r = await run(pg);
    ok(r.n === 1 && r.key === wrongK, '[F3] redo round: only the wrong one, same day');
    await answer(pg, true); r = await run(pg);
    ok(r.next === 'Finish ✓', `[F3] right: "${r.next}"`);
    await pg.click('#nextBtn'); await settle(pg, GUARD_MS);
    const wlF3 = JSON.parse(await ls(pg, 'lifeuk.wrongList'));
    ok(!wlF3[wrongK], `[F3] G38: the one answered wrong, then redone right in the practise task, left the wrong list (${wrongK})`);
    let cd = await cardInfo(pg);
    const pct1 = await domainPct(pg, TODAY);
    ok(cd.scr === 'screenPlanRun' && cd.emoji === '✅' && cd.score === `${pct1}%` && cd.result === "Task done · today's progress" && cd.sub === 'All 9 questions right, 1 of them after a redo.', `[F4] Result card: ${cd.emoji} ${cd.score} "${cd.result}" "${cd.sub}"`);
    ok(/^The matching “Read Ch 1 .+” now counts as read\.$/.test(cd.pairNote || ''), `[F4] G3 note: "${cd.pairNote}"`);
    ok(/^Next/.test(cd.next || '') && /Read Ch 2/.test(cd.next) && cd.acts.map(a => a[0]).join('|') === 'Review this task|Start next →', `[F4] next "${cd.next}"; buttons ${cd.acts.map(a => a[0]).join(' / ')}`);
    ok(cd.focus && !cd.side && cd.back === "← Today's tasks" && cd.label === 'Chapter 1' && cd.badge === 'Practice', `[F4] S-121 focus on the result line; side session ended; header "${cd.back}" ${cd.label} · ${cd.badge}`);
    await pg.screenshot({ path: path.join(SHOTS, 'F-375-en-result-ch1.png'), fullPage: true });
    // F5 Start next → reading = day screen (PR6b); Ch 1 box ✓ Review; reading 1 done
    await pg.click('#planRunBody [data-action="planOpenTask"]'); await settle(pg, GUARD_MS);
    bx = await boxes(pg);
    ok((await screen(pg)) === 'screenPlanDay' && /done/.test(bx[0].cls) && /counted as read/.test(bx[0].st) && /done/.test(bx[1].cls) && bx[1].go === '✓ Review ›', `[F5] "Start next →" (reading) → day screen; Read Ch 1 "${bx[0].st}", Practise Ch 1 "${bx[1].st}" ${bx[1].go}`);
    ok((await ringPct(pg)) === `${pct1}%`, `[F5] ring ${await ringPct(pg)} = Result card %`);
    // F6 review mode by the box: 0 writes except the bookmark
    const st0 = await storageAll(pg); w0 = await wN(pg);
    await pg.click(boxSel(TODAY, 1)); await settle(pg, GUARD_MS);
    r = await run(pg);
    const rv = await pg.evaluate(() => ({ labels: state.questions.map((_, i) => { goToQuestion(i); return byId('ansLabel').textContent; }), dots: [...byId('navDots').children].map(d => d.className) }));
    await pg.evaluate(() => goToQuestion(0)); await settle(pg, 60);
    ok(r.review && r.note === '✅ This task is done · reviewing it does not change your progress.' && r.round === '' && r.pair === '', `[F6] G17 review mode: "${r.note}", no round / pair note`);
    const wrongIdx = await pg.evaluate(k => state.questions.findIndex(q => qKey(q) === k), wrongK);
    ok(rv.labels[wrongIdx] === '✗ You got this wrong · correct answer' && rv.labels.filter(l => l === '✓ Correct answer').length === 8 && /bad/.test(rv.dots[wrongIdx]), `[F6] review: "✗ You got this wrong" on the redone one (red dot), "✓ Correct answer" ×8`);
    for (let i = 0; i < 3; i++) await pg.click('#opt' + i).catch(() => {}); // taps on options do nothing
    await pg.click('#flagBtn'); await settle(pg, 60); await pg.click('#flagBtn'); await settle(pg, 60);
    if (await visible(pg, '#yueToggle')) await pg.click('#yueToggle').catch(() => {});
    for (let i = 0; i < 9; i++) { const c = await run(pg); if (c.idx === c.n - 1) break; await pg.click('#nextBtn'); await settle(pg, 40); }
    r = await run(pg);
    ok(r.next === 'Finish ✓', `[F6] review last button "${r.next}"`);
    await pg.click('#nextBtn'); await settle(pg, GUARD_MS);
    const wR = (await writesSince(pg, w0)).filter(w => !/practiceFlags/.test(w));
    const st1 = await storageAll(pg); delete st0['lifeuk.practiceFlags']; delete st1['lifeuk.practiceFlags'];
    ok(wR.length === 0 && JSON.stringify(st0) === JSON.stringify(st1), `[F6] G17: option taps / Translate / Next / Finish wrote nothing (bookmark on + off only) ${wR.join(' | ')}`);
    ok((await screen(pg)) === 'screenPlanDay' && (await activeInfo(pg)).task === '1', `[F6] review Finish → day screen, focus back on the task box ${JSON.stringify(await activeInfo(pg))}`);
    // F7 Practise Ch 5 (39): Round 1 of 2 (24) + Round 2 of 2; one wrong in round 1; quick check of round notes
    const q5 = d1[5].qids;
    await pg.click(boxSel(TODAY, 5)); await settle(pg, GUARD_MS);
    r = await run(pg);
    ok(r.n === 24 && r.dots === 24 && r.round === 'Round 1 of 2', `[F7] 39 questions: round 1 = ${r.n} questions, "${r.round}"`);
    const w5 = r.key;
    const r1 = await playRound(pg, { wrong: [w5], onEach: async c => { if (c.simShow) simSeen++; } });
    ok(r1.seen.length === 24 && r1.last.next === 'Next round →', `[F7] round 1 last: "${r1.last.next}"`);
    r = await run(pg);
    ok(r.n === 16 && r.round === 'Round 2 of 2', `[F7] round 2: 15 new + the wrong one = ${r.n}, "${r.round}"`);
    const r2 = await playRound(pg, { onEach: async c => { if (c.key === w5) note(`[F7] round 2 redo note: "${c.round}"`); } });
    ok(r2.seen[r2.seen.length - 1] === w5 && r2.last.next === 'Finish ✓', `[F7] the wrong one last in round 2; "${r2.last.next}"`);
    cd = await cardInfo(pg);
    ok(cd.scr === 'screenPlanRun' && cd.sub === 'All 39 questions right, 1 of them after a redo.', `[F7] Result card "${cd.sub}"`);
    lg = await dayLog(pg, TODAY);
    ok(q5.every(k => lg.ok[k]), '[F7] every question of the task right for today');
    // F8 Result card ← → day; Practise Ch 2 via the keyboard (Enter), all right first time
    await pg.click('#planRunBack'); await settle(pg, GUARD_MS);
    ok((await screen(pg)) === 'screenPlanDay' && (await activeInfo(pg)).task === '5', '[F8] Result card ← → day screen, focus on the Ch 5 box');
    await pg.focus(boxSel(TODAY, 3)); await pg.keyboard.press('Enter'); await settle(pg, GUARD_MS);
    r = await run(pg);
    ok(r.plan && r.label === 'Chapter 2' && r.n === 11, `[F8] keyboard Enter on the box opens the runner (${r.label}, ${r.n})`);
    await finishTask(pg);
    cd = await cardInfo(pg);
    ok(cd.sub === 'All 11 questions right first time.' && /Wrong answers|Clear/.test(cd.next || ''), `[F8] "${cd.sub}"; next "${cd.next}"`);
    // F9 "Start next →" = clear wrong answers (runner directly): W-030 copy cleared
    await pg.click('#planRunBody [data-action="planOpenTask"]'); await settle(pg, GUARD_MS);
    r = await run(pg);
    const snapQ = await pg.evaluate(() => state.questions.map(qKey));
    const snapT = (await tasksOf(pg, TODAY))[6].qids;
    ok(r.plan && r.label === 'Wrong answers' && r.pair === '', `[F9] "Start next →" opens clear wrong answers: "${r.label}", asks ${r.n}: ${snapQ.join(',')} (task ${snapT.join(',')})`);
    const wl0 = JSON.parse(await ls(pg, 'lifeuk.wrongList'));
    const lgR = await dayLog(pg, TODAY);
    ok(snapT.length === 2 && snapT.includes('1.3') && snapT.includes('3.12') && !snapT.includes('4.14'), `[F9] G9: the snapshot taken at Home = 1.3, 3.12 (+ copy 4.14 once), not today's ${Object.keys(wl0).length - 3} new wrong answers`);
    ok((lgR.ok['1.3'] ? !wl0['1.3'] : true) && snapQ.join() === '3.12', `[F9] G38: 1.3 answered right in Practise Ch 1 (log ok ${lgR.ok['1.3'] || 0}) left the wrong list (${!wl0['1.3']}); the clear-wrong task counts it (G2), asks only ${snapQ.join(',')}`);
    const rr = await playRound(pg, { wrong: ['3.12'] });
    const wl1 = JSON.parse(await ls(pg, 'lifeuk.wrongList'));
    ok(wl1['3.12'] && wl1['4.14'] && rr.last.next === '🔁 Redo the wrong answer (1 left)', `[F9] wrong on 3.12: stays (with its copy); "${rr.last.next}"`);
    await finishTask(pg);
    const wl2 = JSON.parse(await ls(pg, 'lifeuk.wrongList'));
    cd = await cardInfo(pg);
    ok(!wl2['3.12'] && !wl2['4.14'], `[F9] W-030: redone right on 3.12 clears 3.12 and 4.14`);
    ok(cd.emoji === '🎉' && cd.score === '100%' && cd.pass && cd.result === "All of today's tasks are done!" && cd.sub === "Open the app tomorrow: Home shows the next day's tasks.", `[F9] all done: ${cd.emoji} ${cd.score} "${cd.result}" "${cd.sub}"`);
    ok(cd.acts.map(a => a[1]).join() === 'planReviewTask,planBackToDay' && cd.label === 'Wrong answers', `[F9] all done: "Review this task" / "${cd.acts[1] && cd.acts[1][0]}"`);
    await pg.screenshot({ path: path.join(SHOTS, 'F-375-en-result-alldone.png'), fullPage: true });
    // review from the card
    await pg.click('#planRunBody [data-action="planReviewTask"]'); await settle(pg, GUARD_MS);
    r = await run(pg);
    ok(r.review && r.label === 'Wrong answers' && r.n === 2, `[F9] "Review this task" → review mode (${r.n})`);
    await pg.click('#screenQuiz .back-btn'); await settle(pg, GUARD_MS);
    let dd = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, done: !byId('planDayDone').hidden && byId('planDayDone').textContent, count: byId('planDayCount').textContent }));
    ok(dd.scr === 'screenPlanDay' && /All done/.test(dd.done || '') && dd.count === '7 / 7 done', `[F9] ← → day: "${dd.done}" "${dd.count}"`);
    // Home card: done for today
    await pg.click('#screenPlanDay .back-btn'); await settle(pg, GUARD_MS);
    c0 = await cardText(pg);
    ok(/Today's progress 100%/.test(c0) && /View today's tasks/.test(c0), `[F9] Home card "${c0}"`);
    ok(simSeen > 0, `[F] G26: the Similar panel showed in the runner ${simSeen}× (never with "Practise these N")`);

    // F10 next day, nothing done on Day 2 → Day 3: catch-up (G8) from today's list; today % unchanged
    await pg.clock.setSystemTime(at('2026-10-10')); await pg.reload(); await settle(pg, 400);
    c0 = await cardText(pg);
    ok(/Day 3 \/ 21/.test(c0), `[F10] Day 3 card "${c0.slice(0, 70)}…"`);
    await pg.click('#planCard .plan-btn-gold'); await settle(pg, GUARD_MS); // next = reading → day screen
    bx = await boxes(pg);
    const carry = bx.filter(x => x.tag === 'Day 2');
    ok(carry.length >= 2 && carry.some(x => x.btn && x.date === '2026-10-09'), `[F10] Day 2 carry-over boxes on today (${carry.map(x => (x.btn ? 'B' : 'li') + ' ' + x.ttl.slice(0, 16)).join(' / ')})`);
    const ring3 = await ringPct(pg); const pct2 = await domainPct(pg, '2026-10-09');
    const cBox = carry.find(x => x.btn);
    await pg.click(boxSel(cBox.date, cBox.task)); await settle(pg, GUARD_MS);
    r = await run(pg);
    ok(r.plan && r.planDay === '2026-10-09' && r.back === "← Today's tasks" && r.round === 'Round 1 of 3', `[F10] carry box → runner for Day 2 (${r.planDay}), "${r.back}", "${r.round}"`);
    for (let i = 0; i < 3; i++) { await answer(pg, true); await pg.click('#nextBtn'); await settle(pg, 40); }
    await pg.click('#screenQuiz .back-btn'); await settle(pg, GUARD_MS);
    const l2 = await dayLog(pg, '2026-10-09'), l3 = await dayLog(pg, '2026-10-10');
    ok(Object.keys(l2.ok).length === 3 && Object.keys(l3.ok).length === 0, `[F10] G8: 3 answers written to Day 2, 0 to today`);
    ok((await ringPct(pg)) === ring3 && (await domainPct(pg, '2026-10-09')) > pct2 && (await activeInfo(pg)).arg === '2026-10-09', `[F10] today's ring ${ring3} unchanged; Day 2 ${pct2}% → ${await domainPct(pg, '2026-10-09')}%; focus on the carry box`);
    // F11 ‹ Day 2 page: the same task, "← Day 2 tasks", re-entry round number, finish → "that day's progress"
    await pg.click('#planDayPrev'); await settle(pg, 150);
    await pg.click(boxSel('2026-10-09', cBox.task)); await settle(pg, GUARD_MS);
    r = await run(pg);
    ok(r.back === '← Day 2 tasks' && r.planDay === '2026-10-09' && r.round === 'Round 2 of 3' && r.n === 24, `[F11] (CUI-0024: 3 answered before = round 1 begun) past day box → "${r.back}", "${r.round}" (${r.n}; 3 of 51 answered before)`);
    await finishTask(pg);
    cd = await cardInfo(pg);
    const p2 = await domainPct(pg, '2026-10-09');
    ok(cd.scr === 'screenPlanRun' && cd.back === '← Day 2 tasks' && cd.score === `${p2}%` && p2 === 100 && cd.emoji === '🎉' && cd.result === 'All Day 2 tasks are done!' && cd.sub === 'The schedule and the completion calendar are up to date.', `[F11] Result card for Day 2: "${cd.back}" ${cd.score} "${cd.result}" "${cd.sub}"`);
    await pg.screenshot({ path: path.join(SHOTS, 'F-375-en-result-past.png'), fullPage: true });
    note(`[F11] Day 2 Result card next: "${cd.next}"; buttons ${cd.acts.map(a => a[0] + '→' + a[2]).join(' / ')}`);
    await pg.click('#planRunBack'); await settle(pg, GUARD_MS);
    let title = await pg.$eval('#planDayTitle', e => e.textContent);
    ok(title === 'Day 2 tasks' && (await activeInfo(pg)).task === String(cBox.task), `[F11] ← → "${title}", focus on the box`);
    // F12 › › Day 5 (ahead): practise early (G23), clear wrong not a button
    await pg.click('#planBackToday'); await settle(pg, 150); await pg.click('#planDayNext'); await settle(pg, 80); await pg.click('#planDayNext'); await settle(pg, 80); // Day 3 → Day 4 (rest) → Day 5
    title = await pg.$eval('#planDayTitle', e => e.textContent);
    bx = await boxes(pg);
    const ahead = bx.find(x => x.btn);
    ok(title === 'Day 5 tasks' && ahead && bx.filter(x => x.btn).length === 1 && /Decided on the day/.test(bx[bx.length - 1].st) && !bx[bx.length - 1].btn, `[F12] ${title}: practise is a button, clear wrong "${bx[bx.length - 1].st}" is not (G23)`);
    await pg.click(boxSel(ahead.date, ahead.task)); await settle(pg, GUARD_MS);
    r = await run(pg);
    ok(r.back === '← Day 5 tasks' && r.planDay === '2026-10-12', `[F12] early: "${r.back}", counts for ${r.planDay}`);
    await answer(pg, true); await pg.click('#nextBtn'); await settle(pg, 40); await answer(pg, false);
    // F13 language switch inside the runner keeps the question
    const before = await run(pg);
    await pg.click('#langBtn'); await settle(pg, 300);
    r = await run(pg);
    ok(r.idx === before.idx && r.key === before.key && r.back === '← Day 5 任務' && r.label === 'Chapter 4' && /^第 1 輪（共 3 輪）$/.test(r.round) && /^✗/.test(r.ans), `[F13] zh-HK in the runner: "${r.back}" "${r.label}" "${r.round}" "${r.ans}", same question / answer`);
    await pg.click('#langBtn'); await settle(pg, 300);
    await pg.click('#screenQuiz .back-btn'); await settle(pg, GUARD_MS);
    const l5 = await dayLog(pg, '2026-10-12');
    ok(Object.keys(l5.ok).length === 1 && Object.keys(l5.bad).length === 1 && (await pg.$eval('#planDayTitle', e => e.textContent)) === 'Day 5 tasks', '[F12] G5: 1 right + 1 wrong written to Day 5; ← → Day 5');
    // F14 G15: switch off inside the runner
    await pg.click(boxSel(ahead.date, ahead.task)); await settle(pg, GUARD_MS);
    await answer(pg, true);
    await pg.click('#infoBtn'); await settle(pg, 150);
    await pg.click('#infoPlanRow [role="switch"], #planFeatureSwitch, #infoPlanRow button'); await settle(pg, 200);
    if (await visible(pg, '#confirmOk')) { note('[F14] switch off: confirm "' + (await pg.$eval('#confirmModal', e => e.innerText.replace(/\s+/g, ' ').slice(0, 140))) + '"'); await pg.click('#confirmOk'); await settle(pg, GUARD_MS); }
    if (await visible(pg, '#infoPop')) { await pg.keyboard.press('Escape'); await settle(pg, 100); }
    const off = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, side: isSideSession(), card: !!byId('planCard') }));
    ok(off.scr === 'screenHome' && !off.side && !off.card && Object.keys((await dayLog(pg, '2026-10-12')).ok).length === 2, `[F14] G15: switch off in the runner → Home, session left, no card; the answer is kept ${JSON.stringify(off)}`);
    // normal Practice after that: no plan header / notes; Similar CTA back
    await pg.click('#modePractice'); await settle(pg, 100); await examTab(pg);
    await pg.click('#examGrid [data-action="startExam"][data-arg="5"]'); await settle(pg, GUARD_MS);
    r = await run(pg);
    ok(!r.plan && r.back === '← Home' && r.round === '' && r.note === '' && r.pair === '' && /^Exam 5|E5|Exam/.test(r.label), `[F14] plain Practice afterwards: "${r.back}" "${r.label}", no plan notes`);
    let cta = false; for (let i = 0; i < 12 && !cta; i++) { await answer(pg, true); cta = (await run(pg)).simCta; if (!cta) { await pg.click('#nextBtn'); await settle(pg, 40); } }
    ok(cta, '[F14] plain Practice: Similar panel has "Practise these N" again');
    await pg.click('#screenQuiz .back-btn'); await settle(pg, GUARD_MS);
    await pg.click('#infoBtn'); await settle(pg, 150);
    await pg.click('#infoPlanRow [role="switch"], #planFeatureSwitch, #infoPlanRow button'); await settle(pg, 200);
    if (await visible(pg, '#infoPop')) { await pg.keyboard.press('Escape'); await settle(pg, 100); }
    ok(!!(await cardText(pg)), '[F14] switch on again: the card is back');
    ok(errs.length === 0, `[F] 0 console / page errors ${errs.join(' | ')}`);
    await ctx.close();
  } finally { s.server.kill(); }
}

// ── G: G37 mastered = done ──
const streakFor = keys => JSON.stringify(Object.fromEntries(keys.map(k => [k, 3])));
async function partG(b) {
  const s = await startPagesServer(ROOT);
  try {
    // plan to know the questions (built the same way as the UI's default)
    const ctx0 = await b.newContext({ serviceWorkers: 'block' }); const p0 = await ctx0.newPage();
    await p0.clock.setFixedTime(NOW); await p0.goto(s.base);
    const P = await p0.evaluate(() => buildPlan({ examDate: '2026-10-29', dailyMins: 120, restDays: [0], level: 'none' }, '2026-10-08'));
    await ctx0.close();
    const d1 = P.days[0].tasks; const ch1 = d1[1].qids, ch5 = d1[5].qids;
    const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
    await ctx.addInitScript(INIT);
    const pg = await ctx.newPage(); const errs = watch(pg);
    // G0 no plan: mastered streaks + Practice answers → no plan key written
    await boot(pg, s.base, NOW, { streak: streakFor(ch1) });
    await pg.click('#modePractice'); await settle(pg, 100); await examTab(pg);
    await pg.click('#examGrid [data-action="startExam"][data-arg="1"]'); await settle(pg, GUARD_MS);
    await answer(pg, true); await pg.click('#nextBtn'); await settle(pg, 40); await answer(pg, false);
    await pg.click('#screenQuiz .back-btn'); await settle(pg, GUARD_MS);
    ok(!(await pg.evaluate(() => window.__w.some(w => /studyPlan(?!Preview)/.test(w[1])))) && (await ls(pg, 'lifeuk.studyPlan')) === null, '[G0] no plan: 🏆 streaks + Practice answers write no plan key');
    // G1 Ch 1 practice all 🏆 + 20 of Ch 5 → create via UI
    const half = ch5.slice(0, 20);
    await boot(pg, s.base, NOW, { streak: streakFor([...ch1, ...half]) });
    await createViaUi(pg);
    const c = await cardText(pg); const hp = await domainPct(pg, TODAY);
    ok(new RegExp(`Today's progress ${hp}%`).test(c) && hp > 0 && /Next: Read Ch 2/.test(c), `[G1] Home card counts 🏆 (${hp}%), next skips Ch 1: "${c}"`);
    await pg.click('#planCard .plan-btn-gold'); await settle(pg, GUARD_MS);
    let bx = await boxes(pg);
    ok(/done/.test(bx[1].cls) && bx[1].st === '✓ Mastered (9 questions)' && bx[1].go === '✓ Review ›' && /done/.test(bx[0].cls) && /counted as read/.test(bx[0].st), `[G1] Practise Ch 1 "${bx[1].st}" ${bx[1].go}; Read Ch 1 "${bx[0].st}"`);
    ok(/🏆 20 mastered/.test(bx[5].st) && !/done/.test(bx[5].cls), `[G1] Practise Ch 5 partly: "${bx[5].st}"`);
    ok((await ringPct(pg)) === `${hp}%` && (await pg.$eval('#planDayCount', e => e.textContent)) === '2 / 7 done', `[G1] ring ${await ringPct(pg)}, "${await pg.$eval('#planDayCount', e => e.textContent)}"`);
    const kpi = await pg.evaluate(() => [...document.querySelectorAll('#planKpiRows .plan-pr')].map(r => r.textContent.replace(/\s+/g, ' ').trim()));
    const kq = await pg.evaluate(() => { const log = planLoadLogView(); return planKpis(planLoad(), log, planTodayIso()); });
    note(`[G1] KPI rows ${kpi.join(' ; ')} / domain ${JSON.stringify(kq).slice(0, 300)}`);
    ok(/Questions practised ?29 \//.test(kpi[1]) && /Facts read ?([1-9]\d*) \/ 236/.test(kpi[0]), `[G1] KPI counts 🏆: "${kpi[0]}" / "${kpi[1]}" (9 + 20 mastered)`);
    const cal = await pg.evaluate(iso => { const e = document.querySelector(`#planCal [data-iso="${iso}"]`); return e.className; }, TODAY);
    const band = `h${hp >= 100 ? 4 : hp >= 75 ? 3 : hp >= 50 ? 2 : hp > 0 ? 1 : 0}`;
    ok(new RegExp(band).test(cal), `[G1] calendar today "${cal}" (${band})`);
    await pg.click('#screenPlanDay [data-action="openPlanSchedule"]'); await settle(pg, GUARD_MS);
    const row = await pg.evaluate(iso => { const r = [...document.querySelectorAll('#screenPlanSchedule button, #screenPlanSchedule li')].find(e => e.dataset && e.dataset.arg === iso); return r ? r.textContent.replace(/\s+/g, ' ').trim() : null; }, TODAY);
    ok(!!row && row.includes(`${hp}%`), `[G1] schedule row Day 1 "${row}"`);
    await pg.click('#screenPlanSchedule [data-action="openPlanDay"].nav-btn'); await settle(pg, GUARD_MS);
    // G2 all-mastered box → review mode; 0 writes
    const st0 = await storageAll(pg);
    await pg.click(boxSel(TODAY, 1)); await settle(pg, GUARD_MS);
    let r = await run(pg);
    ok(r.review && r.n === 9 && /done/.test(r.note), `[G2] all-🏆 task opens in review mode (${r.n}) "${r.note}"`);
    await pg.click('#screenQuiz .back-btn'); await settle(pg, GUARD_MS);
    ok(JSON.stringify(await storageAll(pg)) === JSON.stringify(st0), '[G2] G37 is live: nothing written (no migration)');
    // G3 half mastered: 19 asked, one round, no "Round 1 of 2" (W-038)
    await pg.click(boxSel(TODAY, 5)); await settle(pg, GUARD_MS);
    r = await run(pg);
    const asked = await pg.evaluate(() => state.questions.map(qKey));
    ok(r.n === 19 && asked.every(k => !half.includes(k)) && r.round === '', `[G3] 20 of 39 🏆: asks the other ${r.n}, round note "${r.round}" (W-038)`);
    await finishTask(pg);
    let cd = await cardInfo(pg);
    ok(cd.sub === 'All 19 questions right first time.', `[G3] Result card "${cd.sub}"`);
    await pg.click('#planRunBack'); await settle(pg, GUARD_MS);
    bx = await boxes(pg);
    ok(/done/.test(bx[5].cls) && bx[5].st === '✓ 39 questions done · 🏆 20 mastered', `[G3] box "${bx[5].st}"`);
    // G4 10 of 39 mastered (fresh context): 29 → Round 1 of 2, then Round 2 of 2 with 5
    {
      const c2 = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' }); const p2 = await c2.newPage(); const e2 = watch(p2);
      await boot(p2, s.base, NOW, { streak: streakFor(ch5.slice(0, 10)) }); await createViaUi(p2);
      await p2.click('#planCard .plan-btn-gold'); await settle(p2, GUARD_MS);
      await p2.click(boxSel(TODAY, 5)); await settle(p2, GUARD_MS);
      let x = await run(p2);
      const a1 = x.round; const n1 = x.n;
      await playRound(p2);
      x = await run(p2);
      ok(n1 === 24 && a1 === 'Round 1 of 2' && x.n === 5 && x.round === 'Round 2 of 2', `[G4] 10 of 39 🏆: "${a1}" (${n1}) then "${x.round}" (${x.n})`);
      // re-entry mid-task: leave after 4 of round 2, come back
      for (let i = 0; i < 4; i++) { await answer(p2, true); await p2.click('#nextBtn'); await settle(p2, 40); }
      await p2.click('#screenQuiz .back-btn'); await settle(p2, GUARD_MS);
      await p2.click(boxSel(TODAY, 5)); await settle(p2, GUARD_MS);
      x = await run(p2);
      ok(x.n === 1 && x.round === 'Round 3 of 3', `[G4] back in after 28 of 29 (mid round 2): ${x.n} left, "${x.round}" (CUI-0024: a begun round counts as one; the last is N of N)`);
      ok(e2.length === 0, `[G4] 0 errors ${e2.join(' | ')}`); await c2.close();
    }
    // G5 later Practice mastering: a Day 5 (ahead) question at streak 2, answered right in plain Practice → done there
    const d5 = P.days[4].tasks.find(t => t.type === 'practice'); const k5 = d5.qids[0];
    const ctx3 = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' }); await ctx3.addInitScript(INIT);
    const p3 = await ctx3.newPage(); const e3 = watch(p3);
    await boot(p3, s.base, NOW, { streak: JSON.stringify({ [k5]: 2 }) }); await createViaUi(p3);
    const pctAhead = async () => p3.evaluate(() => { const d = planDayAt(planLoad(), '2026-10-12'); const t = d.tasks.find(x => x.type === 'practice'); return planTaskProgress(t, planDayLog(planLoadLogView(), '2026-10-12')); });
    const before5 = await pctAhead();
    // answer k5 in plain Practice by exam
    const [ex, idx] = k5.split('.').map(Number);
    await p3.click('#modePractice'); await settle(p3, 100); await examTab(p3);
    await p3.click(`#examGrid [data-action="startExam"][data-arg="${ex}"]`); await settle(p3, GUARD_MS);
    for (let i = 0; i < 30; i++) { const c3 = await run(p3); if (planCanonOf(c3.key) === k5 || c3.key === k5) break; await p3.click('#nextBtn'); await settle(p3, 30); }
    function planCanonOf(k) { return k; }
    const at5 = await run(p3);
    await p3.click('#flagBtn'); await settle(p3, 60); // flagged, to find it again once mastered (Practice skips 🏆 ones)
    await answer(p3, true);
    await p3.click('#screenQuiz .back-btn'); await settle(p3, GUARD_MS);
    const after5 = await pctAhead();
    const l5 = await p3.evaluate(() => planDayLog(planLoadLog(), '2026-10-12'));
    ok(at5.key === k5 && before5.done === 0 && after5.done === 1 && after5.mastered === 1 && !l5.ok[k5], `[G5] ${k5} mastered in plain Practice (Day 5 not today, not logged): Day 5 practise ${before5.done} → ${after5.done} done (🏆 ${after5.mastered}) live`);
    await p3.click('#planCard .plan-btn-line'); await settle(p3, GUARD_MS); // Schedule
    await p3.evaluate(() => openPlanDay('2026-10-12')); await settle(p3, 200);
    let b3 = await boxes(p3);
    ok(b3.some(x => /🏆 1 mastered/.test(x.st)), `[G5] Day 5 box "${(b3.find(x => /practise|Practise/.test(x.ttl)) || {}).st}"`);
    // G6 a wrong answer undoes 🏆 (streak 0): the box goes back
    await p3.click('#screenPlanDay .back-btn'); await settle(p3, GUARD_MS);
    await p3.click('#modePractice'); await settle(p3, 100);
    await p3.click('#tileFlagged'); await settle(p3, GUARD_MS); await p3.click('#flaggedStart'); await settle(p3, GUARD_MS);
    const fl = await run(p3);
    await answer(p3, false);
    await p3.click('#screenQuiz .back-btn'); await settle(p3, GUARD_MS);
    const undo = await pctAhead();
    ok(fl.key === k5 && undo.done === 0 && undo.mastered === 0, `[G6] wrong in Flagged practice → streak 0 → Day 5 practise back to ${undo.done} done (not complete)`);
    ok(e3.length === 0, `[G5/6] 0 errors ${e3.join(' | ')}`); await ctx3.close();
    // G7 drill + clear wrong unaffected: Ch 1 all 🏆, 1.x in the wrong list; Day 9 drill Ch 1 asks the 🏆 ones
    const ctx4 = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
    const p4 = await ctx4.newPage(); const e4 = watch(p4);
    const ch1All = await (async () => { const cx = await b.newContext({ serviceWorkers: 'block' }); const px = await cx.newPage(); await px.goto(s.base); const v = await px.evaluate(() => allQuestions().filter(q => q.ch === 1 || (q.chapter === 1)).map(qKey)); await cx.close(); return v; })();
    await boot(p4, s.base, NOW, { streak: streakFor([...ch1, ...ch1All]), wrong: JSON.stringify({ [ch1[0]]: true }) }); await createViaUi(p4);
    await p4.click('#planCard .plan-btn-gold'); await settle(p4, GUARD_MS);
    let b4 = await boxes(p4);
    ok(/1 question · Wrong answers/.test(b4[6].st) && !/done/.test(b4[6].cls), `[G7] clear wrong answers with a 🏆 question still asks it: "${b4[6].st}"`);
    await p4.click(boxSel(TODAY, 6)); await settle(p4, GUARD_MS);
    let x4 = await run(p4);
    ok(x4.plan && !x4.review && x4.n === 1 && x4.key === ch1[0], `[G7] clear wrong runner asks ${x4.key} (🏆) — not review mode`);
    await p4.click('#screenQuiz .back-btn'); await settle(p4, GUARD_MS);
    await p4.clock.setSystemTime(at('2026-10-16')); await p4.reload(); await settle(p4, 400);
    await p4.evaluate(() => openPlanDay()); await settle(p4, 200);
    b4 = await boxes(p4);
    const drill1 = await p4.evaluate(() => { const d = planDayAt(planLoad(), planTodayIso()); return d.tasks.map((t, i) => ({ i, type: t.type, ch: t.ch, n: (t.qids || []).length })); });
    const di = drill1.find(t => t.type === 'drill' && t.ch === 1);
    const mastered1 = await p4.evaluate(i => { const d = planDayAt(planLoad(), planTodayIso()); const t = d.tasks[i]; const m = planMasteredKeys(streaks); return t.qids.filter(k => m.has(k)).length; }, di.i);
    await p4.click(boxSel('2026-10-16', di.i)); await settle(p4, GUARD_MS);
    x4 = await run(p4);
    ok(di && x4.plan && !x4.review && x4.n === Math.min(24, di.n) && mastered1 > 0, `[G7] Day 9 drill Ch 1 (${di.n} questions, ${mastered1} 🏆) asks them all: ${x4.n} in round 1, "${x4.label}" (G5: drill again)`);
    // G8 / G38: a right answer in the drill clears it from the wrong list (with its copies); plain Chapter Practice does not
    const dq = await p4.evaluate(() => state.questions.map(qKey));
    await p4.evaluate(k => addWrong(questionByKey(k)), dq[1]); // as if answered wrong elsewhere earlier
    await answer(p4, true); await p4.click('#nextBtn'); await settle(p4, 40); await answer(p4, true);
    const wlD = await p4.evaluate(() => ({ ...wrongList }));
    ok(!wlD[dq[1]], `[G8] G38: right in a drill task clears ${dq[1]} from the wrong list`);
    await p4.click('#screenQuiz .back-btn'); await settle(p4, GUARD_MS); await p4.click('#screenPlanDay .back-btn'); await settle(p4, GUARD_MS);
    const wk = dq[2];
    await p4.evaluate(k => addWrong(questionByKey(k)), wk);
    await p4.click('#modePractice'); await settle(p4, 100); await p4.click('#ptabChapter'); await settle(p4, 100);
    await p4.click('#chapterGrid [data-action="startChapter"][data-arg="1"]'); await settle(p4, GUARD_MS);
    let found = false; for (let i = 0; i < 80; i++) { const c = await run(p4); if (c.key === wk) { found = true; break; } if (c.idx === c.n - 1) break; await p4.click('#nextBtn'); await settle(p4, 25); }
    if (!found) note(`[G8] ${wk} not in this Chapter 1 session (Practice skips 🏆 ones: streak ${await p4.evaluate(k => streaks[k], wk)})`);
    if (found) { await answer(p4, true); }
    const wlC = await p4.evaluate(() => ({ ...wrongList, plan: isPlanSession() }));
    ok(found && wlC[wk] && !wlC.plan, `[G8] plain Chapter Practice: right on ${wk} keeps it in the wrong list (as before)`);
    await p4.click('#screenQuiz .back-btn'); await settle(p4, GUARD_MS);
    ok(e4.length === 0, `[G7] 0 errors ${e4.join(' | ')}`); await ctx4.close();
    ok(errs.length === 0, `[G] 0 errors ${errs.join(' | ')}`);
    await ctx.close();
  } finally { s.server.kill(); }
}

// ── E: QA edge cases ──
async function partE(b) {
  const s = await startPagesServer(ROOT);
  try {
    const mk = async (opts = {}) => { const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' }); await ctx.addInitScript(INIT); const pg = await ctx.newPage(); const errs = watch(pg); await boot(pg, s.base, opts.now || NOW, opts); return { ctx, pg, errs }; };
    // E1 empty wrong list → ✓ No wrong answers, not a button, counted done
    { const { ctx, pg, errs } = await mk({ wrong: null }); await createViaUi(pg);
      await pg.click('#planCard .plan-btn-gold'); await settle(pg, GUARD_MS);
      const bx = await boxes(pg);
      ok(!bx[6].btn && bx[6].st === '✓ No wrong answers' && /done/.test(bx[6].cls) && (await pg.$eval('#planDayCount', e => e.textContent)) === '1 / 7 done', `[E1] empty wrong list: "${bx[6].st}" (not a button, done, "1 / 7 done")`);
      ok(errs.length === 0, '[E1] 0 errors'); await ctx.close(); }
    // E2 re-entry after a skip (23 answered + 1 skipped of 39): round label
    { const { ctx, pg, errs } = await mk(); await createViaUi(pg);
      await pg.click('#planCard .plan-btn-gold'); await settle(pg, GUARD_MS);
      await pg.click(boxSel(TODAY, 5)); await settle(pg, GUARD_MS);
      const first = await run(pg);
      await playRound(pg, { skip: [first.key] }); // 23 right, 1 skipped; now round 2 (16)
      let r = await run(pg); const r2 = r.round;
      await pg.click('#screenQuiz .back-btn'); await settle(pg, GUARD_MS); // leave at the start of round 2
      await pg.click(boxSel(TODAY, 5)); await settle(pg, GUARD_MS);
      r = await run(pg);
      note(`[E2] 39-question task: 23 right + 1 skipped in round 1 → "${r2}"; leave and come back → ${r.n} questions, "${r.round}"`);
      ok(r2 === 'Round 2 of 2' && r.n === 16, `[E2] round 2 before leaving: "${r2}"; back in: ${r.n} left`);
      ok(r.round === 'Round 2 of 2', `[E2] re-entry keeps the round number: "${r.round}" (the first round is already behind)`);
      await finishTask(pg);
      ok((await screen(pg)) === 'screenPlanRun', '[E2] finish → Result card');
      // E2b the commonest case: a 51-question task (Day 2) left after 10 answers, opened again
      await pg.clock.setSystemTime(at('2026-10-09')); await pg.reload(); await settle(pg, 400);
      await pg.evaluate(() => openPlanDay()); await settle(pg, 200);
      await pg.click(boxSel('2026-10-09', 1)); await settle(pg, GUARD_MS);
      const s0 = await run(pg);
      for (let i = 0; i < 10; i++) { await answer(pg, true); await pg.click('#nextBtn'); await settle(pg, 40); }
      await pg.click('#screenQuiz .back-btn'); await settle(pg, GUARD_MS);
      await pg.click(boxSel('2026-10-09', 1)); await settle(pg, GUARD_MS);
      const seq = [];
      for (let i = 0; i < 6; i++) { const c = await run(pg); if (c.scr !== 'screenQuiz') break; seq.push(`${c.n} Qs "${c.round}"`); await playRound(pg); }
      note(`[E2b] 51 questions: first entry "${s0.round}" (${s0.n}); left after 10, back in: ${seq.join(' → ')} → ${await screen(pg)}`);
      ok(seq.length === 2 && seq[0] === '24 Qs "Round 2 of 3"' && seq[1] === '17 Qs "Round 3 of 3"', `[E2b] after an interruption the rounds left add up: ${seq.join(' → ')} (2 rounds left, the last one says so)`);
      ok(errs.length === 0, '[E2] 0 errors'); await ctx.close(); }
    // E3 midnight inside the runner: answers keep counting for the day it was opened for; Result card after midnight
    { const { ctx, pg, errs } = await mk({ now: at(TODAY, '23:58:30') }); await createViaUi(pg);
      await pg.click('#planCard .plan-btn-gold'); await settle(pg, GUARD_MS);
      await pg.click(boxSel(TODAY, 1)); await settle(pg, GUARD_MS);
      await answer(pg, true); await pg.click('#nextBtn'); await settle(pg, 40);
      await pg.clock.runFor(2 * 60 * 1000); await settle(pg, 300);
      const r = await run(pg);
      ok(r.scr === 'screenQuiz' && r.idx === 1 && r.plan, `[E3] past midnight in the runner: still on question ${r.idx + 1} (${await pg.evaluate(() => planTodayIso())})`);
      await finishTask(pg);
      const l8 = await dayLog(pg, TODAY), l9 = await dayLog(pg, '2026-10-09');
      const cd = await cardInfo(pg);
      ok(Object.keys(l8.ok).length === 9 && Object.keys(l9.ok).length === 0, `[E3] all 9 answers count for 8/10 (opened then), 0 for 9/10`);
      note(`[E3] Result card after midnight: ${cd.score} "${cd.result}" back "${cd.back}" next "${cd.next}"`);
      const p8 = await domainPct(pg, TODAY);
      ok(cd.scr === 'screenPlanRun' && cd.score === `${p8}%` && cd.result === "Task done · that day's progress" && cd.back === '← Day 1 tasks' && errs.length === 0, `[E3] O-2: Result card after midnight is about 8/10: ${cd.score} (= ${p8}%) "${cd.result}" "${cd.back}"; 0 errors ${errs.join(' | ')}`);
      await pg.click('#planRunBack'); await settle(pg, GUARD_MS);
      const t = await pg.evaluate(() => [byId('planDayTitle').textContent, byId('planDaySub').textContent]);
      ok(t[0] === 'Day 1 tasks', `[E3] ← after midnight → "${t.join(' / ')}" (the list it came from)`);
      await ctx.close(); }
    // E4 plan deleted in another tab while the runner is open; another tab's answers kept (R17)
    { const { ctx, pg, errs } = await mk(); await createViaUi(pg);
      await pg.click('#planCard .plan-btn-gold'); await settle(pg, GUARD_MS);
      await pg.click(boxSel(TODAY, 5)); await settle(pg, GUARD_MS);
      const k = await pg.evaluate(() => planLoad().days[0].tasks[5].qids[30]);
      await pg.evaluate(k => { const log = JSON.parse(localStorage.getItem('lifeuk.studyPlanProgress')) || { v: 1, days: {} }; const d = log.days['2026-10-08'] || {}; log.days['2026-10-08'] = { ...d, ok: { ...(d.ok || {}), [k]: 1 } }; localStorage.setItem('lifeuk.studyPlanProgress', JSON.stringify(log)); }, k);
      await answer(pg, true);
      let l = await dayLog(pg, TODAY);
      ok(l.ok[k] === 1 && Object.keys(l.ok).length === 2, '[E4] R17: another tab\'s answer survives the runner\'s write');
      const other = await ctx.newPage(); await other.goto(s.base); await settle(other, 300);
      await other.evaluate(() => { localStorage.removeItem('lifeuk.studyPlan'); localStorage.removeItem('lifeuk.studyPlanProgress'); }); await other.close();
      await pg.click('#nextBtn'); await settle(pg, 40); await answer(pg, true);
      const r = await run(pg);
      await pg.click('#screenQuiz .back-btn'); await settle(pg, GUARD_MS);
      const after = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, plan: localStorage.getItem('lifeuk.studyPlan'), log: localStorage.getItem('lifeuk.studyPlanProgress'), card: byId('planCard') && byId('planCard').innerText.slice(0, 40) }));
      ok(r.scr === 'screenQuiz' && after.plan === null && after.log === null && after.scr === 'screenHome', `[E4] plan deleted elsewhere: answering goes on, nothing re-created; ← → Home (create card) ${JSON.stringify(after)}`);
      ok(errs.length === 0, `[E4] 0 errors ${errs.join(' | ')}`); await ctx.close(); }
    // E5 unreadable log: a task box opens nothing, writes nothing
    { const { ctx, pg, errs } = await mk(); await createViaUi(pg);
      await pg.evaluate(() => localStorage.setItem('lifeuk.studyPlanProgress', '{bad'));
      await pg.reload(); await settle(pg, 300);
      await pg.evaluate(() => openPlanDay()); await settle(pg, 200);
      const btn = await visible(pg, boxSel(TODAY, 1));
      if (btn) { await pg.click(boxSel(TODAY, 1)); await settle(pg, GUARD_MS); }
      const r = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, log: localStorage.getItem('lifeuk.studyPlanProgress') }));
      ok(r.scr === 'screenPlanDay' && r.log === '{bad', `[E5] unreadable log: box ${btn ? 'tapped' : 'n/a'} → stays on the day screen, log untouched ${JSON.stringify(r)}`);
      ok(errs.length === 0, `[E5] 0 errors ${errs.join(' | ')}`); await ctx.close(); }
    // E6 quick-nav button (question header) on the last question = the bottom button; double tap → one round
    { const { ctx, pg, errs } = await mk(); await createViaUi(pg);
      await pg.click('#planCard .plan-btn-gold'); await settle(pg, GUARD_MS);
      await pg.click(boxSel(TODAY, 5)); await settle(pg, GUARD_MS);
      const qn = await pg.evaluate(() => { const e = document.querySelector('#screenQuiz [data-action="next"]:not(#nextBtn)'); return e ? { id: e.id, title: e.title || e.getAttribute('aria-label') } : null; });
      for (let i = 0; i < 23; i++) { await answer(pg, true); await pg.click('#nextBtn'); await settle(pg, 40); }
      await answer(pg, true);
      const last = await pg.evaluate(() => { const e = document.querySelector('#screenQuiz [data-action="next"]:not(#nextBtn)'); return e ? { title: e.title || e.getAttribute('aria-label'), text: e.textContent.trim(), shown: e.getClientRects().length > 0 } : null; });
      note(`[E6] quick-nav: ${JSON.stringify(qn)} → last question ${JSON.stringify(last)}`);
      await pg.dblclick('#nextBtn'); await settle(pg, GUARD_MS);
      const r = await run(pg);
      ok(r.round === 'Round 2 of 2' && r.idx === 0 && r.n === 15 && !(await pg.evaluate(() => 0 in state.revealed)), `[E6] double tap on "Next round →": one round on, nothing answered (${r.round}, ${r.n})`);
      if (last && last.shown) {
        for (let i = 0; i < 14; i++) { await answer(pg, true); await pg.click('#nextBtn'); await settle(pg, 40); }
        await answer(pg, true); await settle(pg, 60);
        const t = await pg.evaluate(() => { const e = document.querySelector('#screenQuiz [data-action="next"]:not(#nextBtn)'); return e.title || e.getAttribute('aria-label'); });
        await pg.click('#screenQuiz [data-action="next"]:not(#nextBtn)'); await settle(pg, GUARD_MS);
        ok((await screen(pg)) === 'screenPlanRun', `[E6] quick-nav (title "${t}") on the last question → Result card`);
        const aria = await pg.evaluate(() => byId('quickNext').getAttribute('aria-label'));
        ok(last.title === 'Next round' && t === 'Finish', `[E6] O-3: quick-nav title / aria-label in plain words ("${last.title}" / "${t}")`);
      }
      ok(errs.length === 0, `[E6] 0 errors ${errs.join(' | ')}`); await ctx.close(); }
    // E7 keyboard only: Tab to the box, Enter, answer by keyboard?, Result card focus + Tab order
    { const { ctx, pg, errs } = await mk(); await createViaUi(pg);
      await pg.click('#planCard .plan-btn-gold'); await settle(pg, GUARD_MS);
      await pg.focus(boxSel(TODAY, 1)); await pg.keyboard.press('Enter'); await settle(pg, GUARD_MS);
      for (let i = 0; i < 9; i++) { const a = await pg.evaluate(() => state.questions[state.current].a); for (const oi of a) { await pg.focus('#opt' + oi); await pg.keyboard.press('Enter'); } await settle(pg, 40); await pg.focus('#nextBtn'); await pg.keyboard.press('Enter'); await settle(pg, i === 8 ? GUARD_MS : 40); }
      const f0 = await activeInfo(pg);
      await pg.keyboard.press('Tab'); const f1 = await activeInfo(pg); await pg.keyboard.press('Tab'); const f2 = await activeInfo(pg);
      ok((await screen(pg)) === 'screenPlanRun' && /result-label/.test(f0.cls) && f1.action === 'planReviewTask' && f2.action === 'planOpenTask', `[E7] keyboard: Result card focus "${f0.cls}" → Tab ${f1.action} → Tab ${f2.action}`);
      await pg.keyboard.press('Shift+Tab'); await pg.keyboard.press('Enter'); await settle(pg, GUARD_MS);
      ok((await run(pg)).review, '[E7] Enter on "Review this task" → review mode');
      // language switch on the Result card
      await pg.click('#screenQuiz .back-btn'); await settle(pg, GUARD_MS);
      ok(errs.length === 0, `[E7] 0 errors ${errs.join(' | ')}`); await ctx.close(); }
    // E8 Result card language switch + G6 day change while the card is shown
    { const { ctx, pg, errs } = await mk({ now: at(TODAY, '23:57:00') }); await createViaUi(pg);
      await pg.click('#planCard .plan-btn-gold'); await settle(pg, GUARD_MS);
      await pg.click(boxSel(TODAY, 1)); await settle(pg, GUARD_MS);
      await finishTask(pg);
      const en = await cardInfo(pg);
      await pg.click('#langBtn'); await settle(pg, 300);
      const zh = await cardInfo(pg);
      ok(zh.back === '← 今日任務' && zh.label === 'Chapter 1' && /此項已完成 · 今日完成度/.test(zh.result) && zh.score === en.score && zh.acts.map(a => a[0]).join('|') === '重溫此項內容|開始下一項 →', `[E8] Result card in zh-HK: "${zh.back}" "${zh.label}" "${zh.result}" "${zh.sub}" ${zh.acts.map(a => a[0]).join(' / ')}`);
      await pg.click('#langBtn'); await settle(pg, 300);
      await pg.clock.runFor(4 * 60 * 1000); await settle(pg, 400);
      const mid = await cardInfo(pg);
      note(`[E8] Result card across midnight: before ${en.score} "${en.result}" next "${en.next}" → after ${mid.score} "${mid.result}" next "${mid.next}" (${await pg.evaluate(() => planTodayIso())})`);
      ok(mid.scr === 'screenPlanRun' && mid.score === en.score && mid.result === "Task done · that day's progress" && mid.back === '← Day 1 tasks' && errs.length === 0, `[E8] O-2: Result card shown across midnight keeps 8/10: ${en.score} → ${mid.score} "${mid.result}" "${mid.back}", 0 errors ${errs.join(' | ')}`);
      await ctx.close(); }
    // E9 Home "Continue" opens the runner directly when the next step is a question task (drill day)
    { const { ctx, pg, errs } = await mk(); await createViaUi(pg);
      await pg.clock.setSystemTime(at('2026-10-16')); await pg.reload(); await settle(pg, 400);
      const c = await cardText(pg);
      await pg.click('#planCard .plan-btn-gold'); await settle(pg, GUARD_MS);
      const r = await run(pg);
      ok(r.plan && /^Chapter \d$/.test(r.label) && r.back === "← Today's tasks" && /Next: Drill|Next: /.test(c), `[E9] drill day: Home "Continue" → runner directly ("${r.label}") from "${c.slice(0, 90)}"`);
      await pg.click('#screenQuiz .back-btn'); await settle(pg, GUARD_MS);
      ok((await screen(pg)) === 'screenPlanDay' && (await pg.$eval('#planDayTitle', e => e.textContent)) === "Today's tasks", '[E9] ← from a runner opened on Home → today\'s day screen');
      ok(errs.length === 0, `[E9] 0 errors ${errs.join(' | ')}`); await ctx.close(); }
    // E10 mock day: mock boxes not buttons (PR6b), clear wrong is
    { const { ctx, pg, errs } = await mk(); await createViaUi(pg);
      await pg.clock.setSystemTime(at('2026-10-24')); await pg.reload(); await settle(pg, 400);
      await pg.click('#planCard .plan-btn-gold'); await settle(pg, GUARD_MS);
      const scr = await screen(pg);
      if (scr === 'screenQuiz') { note('[E10] mock day Continue opened the runner: ' + JSON.stringify(await run(pg))); await pg.click('#screenQuiz .back-btn'); await settle(pg, GUARD_MS); }
      const bx = await boxes(pg);
      const own = bx.filter(x => !x.tag);
      ok(scr === 'screenPlanDay' && own.filter(x => /mock/.test(x.cls)).every(x => !x.btn), `[E10] mock day: Continue → day screen (mock first, PR6b); mock boxes not buttons: ${own.map(x => (x.btn ? 'B' : 'li') + ' ' + x.ttl.slice(0, 20)).join(' / ')}`);
      ok(errs.length === 0, `[E10] 0 errors ${errs.join(' | ')}`); await ctx.close(); }
  } finally { s.server.kill(); }
}

// ── P: performance with the longest plan ──
async function partP(b) {
  const s = await startPagesServer(ROOT);
  try {
    for (const rate of [1, 4]) {
      const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
      const pg = await ctx.newPage(); const errs = watch(pg);
      await boot(pg, s.base, NOW);
      await createViaUi(pg, { date: '2027-04-08', noRest: true });
      const n = await pg.evaluate(() => planLoad().days.length);
      await pg.evaluate(() => { const plan = planLoad(); const days = {}; plan.days.slice(0, 90).forEach((d, i) => { const q = d.tasks.flatMap(planTaskQids); days[d.date] = { ok: Object.fromEntries(q.slice(0, Math.round(q.length * (i % 5) / 4)).map(k => [k, 1])) }; }); writePlanLog({ v: 1, days }); });
      await pg.clock.setSystemTime(at(addDays(TODAY, 90))); await pg.reload(); await settle(pg, 400);
      // a past day (catch-up, G8) with the biggest practice task not done: rounds of 24 on a long plan
      const bigDay = await pg.evaluate(() => { const plan = planLoad(), log = planLoadLogView(), today = planTodayIso(); let best = null;
        plan.days.filter(d => d.date < today).forEach(d => d.tasks.forEach((t, i) => { if (t.type === 'practice' && t.qids.length > 24 && !planTaskProgress(t, planDayLog(log, d.date)).complete && (!best || t.qids.length > best.n)) best = { date: d.date, i, n: t.qids.length }; })); return best; });
      note(`[P] CPU ×${rate}: runner on ${JSON.stringify(bigDay)}`);
      await pg.evaluate(d => openPlanDay(d), bigDay.date); await settle(pg, 300);
      const cdp = await ctx.newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate', { rate });
      await pg.evaluate(() => { window.__lt = []; new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(Math.round(e.duration)))).observe({ type: 'longtask' });
        document.addEventListener('click', () => { window.__t0 = performance.now(); }, true); });
      const measure = () => pg.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(Math.round(performance.now() - window.__t0))))));
      const clickM = async sel => { await pg.click(sel); const m = await measure(); await settle(pg, GUARD_MS); return m; };
      const bx = (await boxes(pg)).filter(x => x.btn && !x.tag);
      const big = bx.find(x => x.task === bigDay.i) || bx[0];
      note(`[P] CPU ×${rate}: today's boxes ${bx.map(x => x.ttl.slice(0, 24) + ' | ' + x.st.slice(0, 20)).join(' // ')}`);
      const open = await clickM(boxSel(big.date, big.task));
      const ans = []; for (let i = 0; i < 3; i++) { const cc = await run(pg); if (cc.scr !== 'screenQuiz' || cc.idx === cc.n - 1) break; const a = cc.a; await pg.click('#opt' + a[0]); ans.push(await measure()); await settle(pg, 60); if (a.length > 1) { await pg.click('#opt' + a[1]); await settle(pg, 60); } await pg.click('#nextBtn'); await settle(pg, 60); }
      const langR = []; for (let i = 0; i < 2; i++) langR.push(await clickM('#langBtn'));
      // the rest of the task; the last question's button of each round is timed (round change / Result card)
      let finish = null; const roundT = [];
      for (let k = 0; k < 400; k++) { const c = await run(pg); if (c.scr !== 'screenQuiz') break;
        if (!c.ans) await answer(pg, true);
        if (c.idx === c.n - 1) { const t = await clickM('#nextBtn'); if ((await screen(pg)) === 'screenPlanRun') finish = t; else roundT.push(t); }
        else { await pg.click('#nextBtn'); await settle(pg, 30); } }
      const scr = await screen(pg);
      const langC = []; for (let i = 0; i < 2; i++) langC.push(await clickM('#langBtn'));
      const back = await clickM('#planRunBack');
      const lt = await pg.evaluate(() => window.__lt);
      note(`[P] CPU ×${rate} (${n}-day plan, Day 91): open runner ${open} ms; answer ${ans.join('/')}; runner language ${langR.join('/')}; next round ${roundT.join('/')}; finish → Result card ${finish}; card language ${langC.join('/')}; ← day ${back}; long tasks ${lt.join(', ') || 'none'}`);
      await pg.screenshot({ path: path.join(SHOTS, `P-375-en-183-cpu${rate}.png`) });
      const lim = rate === 1 ? 200 : 600; const all = [open, ...ans, ...langR, ...roundT, finish || 0, ...langC, back];
      ok(n === 182 && scr === 'screenPlanRun' && Math.max(...all) < lim, `[P] CPU ×${rate}: ${n}-day plan, runner open / answer / language / finish / card / back all < ${lim} ms (max ${Math.max(...all)})`);
      ok(errs.length === 0, `[P] CPU ×${rate}: 0 errors ${errs.join(' | ')}`);
      await ctx.close();
    }
  } finally { s.server.kill(); }
}

// ── L: layout at 360 / 375 / 400 × en / zh-HK ──
const COLLOQUIAL = /[唔嘅咗嚟睇喺冇啲咁仲揀攞諗嘢係佢哋噉囉喎啱晒俾畀嗰呢乜㗎嘞咩]/;
async function partL(b) {
  const s = await startPagesServer(ROOT);
  try {
    for (const w of [360, 375, 400]) for (const lang of ['en', 'zh-HK']) {
      const ctx = await b.newContext({ viewport: { width: w, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, serviceWorkers: 'block' });
      await ctx.addInitScript(CONTRAST_FN);
      const pg = await ctx.newPage(); const errs = watch(pg);
      await boot(pg, s.base, NOW, { lang, wrong: '{"1.3":true,"3.12":true}' });
      const tag = `${w}-${lang}`; const texts = []; const shot = (n, full = true) => pg.screenshot({ path: path.join(SHOTS, `L-${tag}-${n}.png`), fullPage: full });
      await createViaUi(pg, { tap: true });
      await pg.tap('#planCard .plan-btn-gold'); await settle(pg, GUARD_MS);
      const hs = sel => pg.evaluate(sel => Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, ...[...document.querySelectorAll(sel + ' *')].filter(e => e.getClientRects().length).map(e => Math.round(e.getBoundingClientRect().right - innerWidth))), sel);
      const hits = [], over = [], con = [];
      const conOf = async sel => { con.push(...await pg.evaluate(sel => window.__contrastAll(document.querySelector(sel)), sel)); };
      // the Practice screen itself is unchanged (H4: same DOM as base): contrast of the parts a plan task changes
      const conPlan = async () => { await settle(pg, 700); for (const sel of ['#screenQuiz .quiz-header', '#roundRow', '#planRunNote', '#planPairNote', '#answerBox .ans-label']) if (await visible(pg, sel)) con.push(...await pg.evaluate(sel => { const e = document.querySelector(sel); const own = window.__contrast(e); return window.__contrastAll(e).concat(own && e.textContent.trim() && !e.children.length ? [{ t: e.textContent.trim().slice(0, 24), r: +own.r.toFixed(2), o: +own.o.toFixed(2), cls: e.className }] : []); }, sel)); };
      hits.push(['task box', await hitOf(pg, boxSel(TODAY, 5))]);
      // runner: Practise Ch 5 (2 rounds): Q1 wrong (Similar), round note, pair note
      await pg.tap(boxSel(TODAY, 5)); await settle(pg, GUARD_MS);
      await pg.evaluate(() => scrollTo(0, 0));
      over.push(['runner', await hs('#screenQuiz')]); await conPlan(); texts.push(await pg.$eval('#screenQuiz', e => e.innerText));
      await shot('runner-round1');
      for (const sel of ['#screenQuiz .back-btn', '#nextBtn', '#prevBtn']) hits.push([sel, await hitOf(pg, sel)]);
      const hdr = await pg.evaluate(() => { const h = document.querySelector('#screenQuiz .quiz-header'); const bb = h.querySelector('.back-btn').getBoundingClientRect(); return { h: Math.round(h.getBoundingClientRect().height), backLines: Math.round(bb.height / parseFloat(getComputedStyle(h.querySelector('.back-btn')).lineHeight || 16)) }; });
      // find a question with similar questions, answer it wrong
      let sim = false;
      for (let i = 0; i < 24 && !sim; i++) { const has = await pg.evaluate(() => similarKeys(state.questions[state.current]).length > 0); if (has) { const c = await pg.evaluate(() => { const q = state.questions[state.current]; return { a: q.a, n: q.o.length }; }); for (const oi of [...Array(c.n).keys()].filter(x => !c.a.includes(x)).slice(0, c.a.length)) await pg.tap('#opt' + oi); sim = true; } else { await pg.tap('#nextBtn'); await settle(pg, 40); } }
      await settle(pg, 120);
      over.push(['runner-similar', await hs('#screenQuiz')]); await conPlan(); texts.push(await pg.$eval('#screenQuiz', e => e.innerText));
      await shot('runner-similar');
      // to the end of round 1 → round 2 → redo note
      for (let i = 0; i < 30; i++) { const c = await run(pg); if (c.scr !== 'screenQuiz') break; if (!c.ans) await answer(pg, true); const l = await run(pg); await pg.tap('#nextBtn'); await settle(pg, l.idx === l.n - 1 ? GUARD_MS : 30); if (l.idx === l.n - 1) break; }
      for (let i = 0; i < 30; i++) { const c = await run(pg); if (c.scr !== 'screenQuiz') break; if (c.round && /🔁/.test(c.round)) { await pg.evaluate(() => scrollTo(0, 0)); texts.push(await pg.$eval('#screenQuiz', e => e.innerText)); await conPlan(); over.push(['runner-redo', await hs('#screenQuiz')]); await shot('runner-redo', false); }
        await answer(pg, true); const l = await run(pg); await pg.tap('#nextBtn'); await settle(pg, l.idx === l.n - 1 ? GUARD_MS : 30); if (l.idx === l.n - 1) break; }
      // Result card
      await pg.evaluate(() => scrollTo(0, 0));
      over.push(['result', await hs('#screenPlanRun')]); await conOf('#screenPlanRun'); texts.push(await pg.$eval('#screenPlanRun', e => e.innerText));
      await shot('result');
      for (const sel of ['#planRunBack', '#planRunBody [data-action="planReviewTask"]', '#planRunBody [data-action="planOpenTask"]']) hits.push([sel, await hitOf(pg, sel)]);
      const btnRow = await pg.evaluate(() => [...document.querySelectorAll('#planRunBody .nav-row button')].map(e => Math.round(e.getBoundingClientRect().height)));
      // review mode
      await pg.tap('#planRunBody [data-action="planReviewTask"]'); await settle(pg, GUARD_MS);
      await pg.evaluate(() => scrollTo(0, 0));
      over.push(['review', await hs('#screenQuiz')]); await conPlan(); texts.push(await pg.$eval('#screenQuiz', e => e.innerText));
      await shot('review');
      // review of a redone one
      await pg.evaluate(() => { const i = state.questions.findIndex((_, k) => state.revealed[k] === false); if (i >= 0) goToQuestion(i); }); await settle(pg, 80);
      await conPlan(); texts.push(await pg.$eval('#answerBox', e => e.innerText)); await shot('review-wrong');
      await pg.tap('#screenQuiz .back-btn'); await settle(pg, GUARD_MS);
      // clear wrong answers runner + all done
      await pg.tap(boxSel(TODAY, 6)); await settle(pg, GUARD_MS);
      texts.push(await pg.$eval('#screenQuiz', e => e.innerText)); over.push(['clear', await hs('#screenQuiz')]);
      await finishTask(pg);
      texts.push(await pg.$eval('#screenPlanRun', e => e.innerText)); over.push(['result2', await hs('#screenPlanRun')]); await conOf('#screenPlanRun');
      await shot('result-clear');
      // past-day runner header (← Day n tasks) on the next day
      await pg.clock.setSystemTime(at('2026-10-09')); await pg.reload(); await settle(pg, 400);
      await pg.evaluate(() => openPlanDay('2026-10-08')); await settle(pg, 200);
      const pb = (await boxes(pg)).find(x => x.btn && !/done/.test(x.cls));
      if (pb) { await pg.tap(boxSel(pb.date, pb.task)); await settle(pg, GUARD_MS); await pg.evaluate(() => scrollTo(0, 0));
        texts.push(await pg.$eval('#screenQuiz .quiz-header', e => e.innerText)); over.push(['runner-past', await hs('#screenQuiz')]); hits.push(['past back', await hitOf(pg, '#screenQuiz .back-btn')]);
        const one = await pg.evaluate(() => { const e = document.querySelector('#screenQuiz .back-btn'); const range = document.createRange(); range.selectNodeContents(e); return new Set([...range.getClientRects()].map(r => Math.round(r.bottom))).size; });
        ok(one === 1, `[L] ${tag}: "${(texts[texts.length - 1] || '').split('\n')[0]}" on one line (${one} line)`); await shot('runner-past', false); }
      const bad = over.filter(o => o[1] > 0);
      ok(bad.length === 0, `[L] ${tag}: no horizontal overflow (${over.map(o => o[0] + ' ' + o[1]).join(', ')})`);
      const miss = hits.filter(h => !h[1] || !h[1].hit44);
      ok(miss.length === 0 && btnRow.every(h => h >= 44), `[L] ${tag}: tap areas ≥ 44px: ${hits.map(h => h[0].replace(/#planRunBody |\[data-action="|"\]/g, '') + ' ' + (h[1] ? h[1].w + '×' + h[1].h + (h[1].hit44 ? '✓' : '✗') : 'n/a')).join(', ')}; card buttons ${btnRow.join('/')}`);
      const low = con.filter(c => c.r < 4.5 || c.o < 1);
      ok(low.length === 0, `[L] ${tag}: ${con.length} texts ≥ 4.5:1 without opacity (min ${Math.min(...con.map(c => c.r))}) ${[...new Set(low.map(c => c.t + ' ' + c.r + '/' + c.o + ' ' + c.cls))].slice(0, 8).join(' | ')}`);
      ok(sim, `[L] ${tag}: Similar panel case reached`);
      if (lang === 'zh-HK') {
        const planOnly = texts.join('\n').split('\n').filter(l => /輪|重做|重溫|此項|今日|任務|已溫習|答對|正確答案|答錯過|下一項|返回|全部|明天|進度|完成/.test(l));
        const all = planOnly.join('\n'); const z = [...new Set((all.match(new RegExp(COLLOQUIAL.source, 'g')) || []))];
        ok(z.length === 0, `[L] ${tag}: plan runner text has no colloquial characters ${z.join('')} ${z.length ? planOnly.filter(l => COLLOQUIAL.test(l)).slice(0, 4).join(' / ') : ''}`);
        const half = all.match(/[一-鿿][,!?:;()]|[,!?:;()][一-鿿]/g);
        ok(!half, `[L] ${tag}: full-width punctuation next to Chinese ${half ? half.join(' ') : ''}`);
        if (w === 375) fs.writeFileSync(path.join(SHOTS, 'L-375-zh-HK-texts.txt'), texts.join('\n\n----\n\n'));
      } else if (w === 375) fs.writeFileSync(path.join(SHOTS, 'L-375-en-texts.txt'), texts.join('\n\n----\n\n'));
      note(`[L] ${tag}: quiz header ${hdr.h}px`);
      ok(errs.length === 0, `[L] ${tag}: 0 errors ${errs.join(' | ')}`);
      await ctx.close();
    }
    // mockup #runner at 375: today's practise task (question, wrong pick), its Result card, review mode
    const ctx = await b.newContext({ viewport: { width: 375, height: 800 }, deviceScaleFactor: 2 });
    const pg = await ctx.newPage();
    await pg.goto('file://' + path.join(ROOT, 'mockups', 'study-plan-flow.html')); await settle(pg, 400);
    const list = await pg.evaluate(() => { goto(3); return runList().map((t, i) => i + ':' + t.type); });
    note(`[L] mockup step ③ tasks: ${list.join(' ')}`);
    for (const [i, t] of list.map(x => x.split(':')).filter(x => /practice|review|drill/.test(x[1])).slice(0, 2)) {
      await pg.evaluate(i => { goto(3); openRunner(Number(i)); }, i); await settle(pg, 250);
      await pg.screenshot({ path: path.join(SHOTS, `M-375-mockup-runner-${t}.png`), fullPage: true });
      await pg.evaluate(() => { const o = document.querySelector('#runner [data-opt]'); if (o) o.click(); }); await settle(pg, 200);
      await pg.screenshot({ path: path.join(SHOTS, `M-375-mockup-runner-${t}-answered.png`), fullPage: true });
      await pg.evaluate(() => runAction('skip')); await settle(pg, 250);
      await pg.screenshot({ path: path.join(SHOTS, `M-375-mockup-result-${t}.png`), fullPage: true });
      await pg.evaluate(() => { const r = document.querySelector('#runner [data-review]'); if (r) r.click(); }); await settle(pg, 250);
      await pg.screenshot({ path: path.join(SHOTS, `M-375-mockup-review-${t}.png`), fullPage: true });
    }
    await ctx.close();
  } finally { s.server.kill(); }
}

// ── U: upgrade from v1.0.2 and PR5 SW + mixed load ──
const NEWFILES = ['js/screens/planRun.js', 'js/screens/quiz.js', 'js/screens/planDay.js', 'js/domain/planProgress.js', 'css/screens/plan.css', 'locales/en.js', 'locales/zh-HK.js'];
async function upgradeFrom(b, ref, label) {
  const dir = path.join(WORK, 'pr6a-up-' + label); archive(ref, dir);
  const { base, server } = await startPagesServer(dir);
  const verOf = src => src.match(/APP_VERSION = '([^']+)'/)[1];
  const OLD_CACHE = 'lifeuk-v' + verOf(fs.readFileSync(path.join(dir, 'js/core/config.js'), 'utf8'));
  const CACHE = 'lifeuk-v' + verOf(fs.readFileSync(path.join(ROOT, 'js/core/config.js'), 'utf8'));
  try {
    const ctx = await b.newContext({ viewport: { width: 375, height: 812 } });
    const pg = await ctx.newPage(); const errs = watch(pg);
    await pg.clock.install({ time: NOW });
    await pg.goto(base); await pg.evaluate(() => navigator.serviceWorker.ready);
    await pg.evaluate(async c => { for (let i = 0; i < 75; i++) { if ((await caches.keys()).includes(c)) return; await new Promise(r => setTimeout(r, 200)); } }, OLD_CACHE);
    await pg.reload(); await pg.waitForFunction(() => !!navigator.serviceWorker.controller);
    await pg.evaluate(() => { localStorage.setItem('lifeuk.wrongList', '{"1.3":true}'); localStorage.setItem('lifeuk.practiceStreak', '{"1.0":2}'); });
    let oldPlan = null;
    if (label === 'pr5') { await pg.goto(base + '?preview=plan'); await settle(pg, 400); await pg.click('#planCard .plan-cta'); await settle(pg, GUARD_MS); await pg.click('#planCreateBtn'); await settle(pg, GUARD_MS); oldPlan = await ls(pg, 'lifeuk.studyPlan'); }
    const old = await pg.evaluate(() => typeof planOpenTask);
    ok(old === 'undefined' && (label !== 'pr5' || !!oldPlan), `[U-${label}] base SW controlling (${ref}), no planRun${oldPlan ? ' + plan built on PR5' : ''}`);
    fs.readdirSync(dir).forEach(f => fs.rmSync(path.join(dir, f), { recursive: true, force: true }));
    appFiles(ROOT).forEach(f => fs.cpSync(path.join(ROOT, f), path.join(dir, f), { recursive: true }));
    const up = await pg.evaluate(async ({ NEWFILES, CACHE }) => { const reg = await navigator.serviceWorker.getRegistration();
      for (let i = 0; i < 100; i++) { const ch = await caches.open(CACHE); const have = await Promise.all(NEWFILES.map(p => ch.match(new URL(p, location.href).href)));
        const idx = await ch.match(new URL('index.html', location.href).href); const idxTxt = idx ? await idx.text() : '';
        const js = have[1] && await have[1].clone().text();
        const keys = (await caches.keys()).filter(k => k.startsWith('lifeuk'));
        if (have.every(Boolean) && /screenPlanRun/.test(idxTxt) && /renderPlanQuizHeader/.test(js || '') && !reg.installing && !reg.waiting && keys.length === 1) return { ok: true, keys };
        if (!reg.installing && !reg.waiting) await reg.update().catch(() => {}); await new Promise(r => setTimeout(r, 200)); } return { ok: false }; }, { NEWFILES, CACHE });
    ok(up.ok && up.keys[0] === CACHE, `[U-${label}] new SW (${OLD_CACHE} → ${CACHE}): planRun.js + new quiz / planDay / planProgress / plan.css / locales / index.html (screenPlanRun) ${JSON.stringify(up)}`);
    await pg.goto(base); await settle(pg, 500);
    const after = await pg.evaluate(() => ({ fn: typeof planOpenTask, wrong: localStorage.getItem('lifeuk.wrongList'), streak: localStorage.getItem('lifeuk.practiceStreak'), card: byId('planCard') ? byId('planCard').innerText.replace(/\s+/g, ' ') : null, plan: localStorage.getItem('lifeuk.studyPlan') }));
    if (label === 'pr5') ok(after.fn === 'function' && JSON.parse(after.plan).start === JSON.parse(oldPlan).start && JSON.parse(after.plan).days.length === JSON.parse(oldPlan).days.length && /Day 1 \/ 21/.test(after.card || ''), `[U-${label}] reload: PR6a code, PR5 plan kept, card "${(after.card || '').slice(0, 60)}"`);
    else { ok(after.fn === 'function' && after.card === null && after.plan === null && after.wrong === '{"1.3":true}' && after.streak === '{"1.0":2}', `[U-${label}] reload: PR6a code, entry hidden, data kept`);
      await pg.goto(base + '?preview=plan'); await settle(pg, 400); await createViaUi(pg); }
    await pg.evaluate(() => openPlanDay()); await settle(pg, 200);
    await ctx.setOffline(true);
    await pg.reload(); await settle(pg, 500);
    await pg.click('#planCard .plan-btn-gold'); await settle(pg, GUARD_MS);
    if ((await screen(pg)) !== 'screenPlanDay') await pg.evaluate(() => openPlanDay());
    await pg.click(boxSel(TODAY, 1)); await settle(pg, GUARD_MS);
    await finishTask(pg);
    const off = await cardInfo(pg);
    const styled = await pg.evaluate(() => getComputedStyle(document.querySelector('#planRunBody .nav-row .nav-btn')).minHeight);
    ok(off.scr === 'screenPlanRun' && off.emoji === '✅' && styled === '44px', `[U-${label}] offline: runner → Result card works, styled (min-height ${styled})`);
    await ctx.setOffline(false);
    ok(errs.length === 0, `[U-${label}] 0 console / page errors ${errs.join(' | ')}`);
    await ctx.close();
  } finally { server.kill(); fs.rmSync(dir, { recursive: true, force: true }); }
}
async function mixed(b, ref, label) {
  const mix = path.join(WORK, 'pr6a-mixed-' + label); fs.rmSync(mix, { recursive: true, force: true }); fs.mkdirSync(mix, { recursive: true });
  appFiles(ROOT).forEach(f => fs.cpSync(path.join(ROOT, f), path.join(mix, f), { recursive: true }));
  fs.writeFileSync(path.join(mix, 'index.html'), execSync(`git show ${ref}:index.html`, { cwd: ROOT }));
  const s2 = await startPagesServer(mix);
  try {
    for (const withPlan of [false, true]) {
      const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
      await ctx.addInitScript(INIT);
      const pg = await ctx.newPage(); const errs = watch(pg);
      await pg.clock.install({ time: NOW });
      await pg.goto(s2.base); await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('lifeuk.installDismissed', 'true'); localStorage.setItem('lifeuk.studyPlanPreview', 'true'); localStorage.setItem('lifeuk.wrongList', '{"1.3":true}'); });
      if (withPlan) await pg.evaluate(() => { localStorage.setItem('lifeuk.studyPlan', JSON.stringify(buildPlan({ examDate: '2026-10-29', dailyMins: 120, restDays: [0], level: 'none' }, '2026-10-08'))); localStorage.setItem('lifeuk.studyPlanProgress', '{"v":1,"days":{}}'); });
      await pg.goto(s2.base); await settle(pg, 600);
      const plan0 = await ls(pg, 'lifeuk.studyPlan'), log0 = await ls(pg, 'lifeuk.studyPlanProgress');
      const r = await pg.evaluate(() => ({ fns: [typeof planOpenTask, typeof renderPlanRunNotes].join(','), card: !!byId('planCard'), vis: planVisible() }));
      await pg.click('#modePractice'); await examTab(pg); await pg.click('#examGrid [data-action="startExam"][data-arg="2"]'); await settle(pg, GUARD_MS);
      let simCta = false; for (let i = 0; i < 10 && !simCta; i++) { await answer(pg, i !== 0); simCta = (await run(pg).catch(() => ({}))).simCta === true || await visible(pg, '#similarBox [data-action="startSimilarPractice"]'); if (!simCta) { await pg.click('#nextBtn'); await settle(pg, 40); } }
      const q = await pg.evaluate(() => ({ back: document.querySelector('#screenQuiz .back-btn').textContent, round: byId('roundRow').hidden }));
      await pg.click('#screenQuiz .back-btn'); await settle(pg, GUARD_MS);
      await pg.click('#tileWrong'); await settle(pg, GUARD_MS); await answer(pg, true); await pg.click('#screenQuiz .back-btn'); await settle(pg, GUARD_MS);
      const plan1 = await ls(pg, 'lifeuk.studyPlan'), log1 = await ls(pg, 'lifeuk.studyPlanProgress');
      ok(r.fns === 'function,function' && !r.card && !r.vis && q.back === '← Home' && simCta && plan0 === plan1 && (withPlan ? log1 !== null : log1 === log0) && errs.length === 0, `[U-mixed-${label}${withPlan ? '+plan' : ''}] old ${label} index.html + PR6a js (preview on): late boot loads planRun, no card (planShellReady: no #screenPlanRun), Practice / Similar / Wrong answers OK ("${q.back}"), plan untouched, 0 errors ${JSON.stringify(r)} ${errs.join(' | ')}`);
      await ctx.close();
    }
  } finally { s2.server.kill(); fs.rmSync(mix, { recursive: true, force: true }); }
}
async function partU(b) {
  await upgradeFrom(b, V102, 'v102');
  await upgradeFrom(b, BASE, 'pr5');  // origin/main = PR5 + v1.0.3
  await mixed(b, V102, 'v102');
  await mixed(b, BASE, 'pr5');  // origin/main = PR5 + v1.0.3
}

(async () => {
  fs.mkdirSync(WORK, { recursive: true }); fs.mkdirSync(SHOTS, { recursive: true });
  const b = await chromium.launch(launchOpts);
  const only = process.env.QA_ONLY || 'HFGEPLU';
  for (const [k, fn] of [['H', partH], ['F', partF], ['G', partG], ['E', partE], ['P', partP], ['L', partL], ['U', partU]]) {
    if (!only.includes(k)) continue;
    try { await fn(b); } catch (e) { fail++; console.log(`FAIL: part ${k} exception`, e.stack); }
  }
  await b.close();
  console.log('\nnotes:\n- ' + notes.join('\n- '));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
