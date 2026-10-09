// QA plan PR5 (day screen, completion calendar, overall progress, full Home card, G6 day change, S-115, long plan):
// real-browser checks over http
//   node 2026-10-09_qa-plan-pr5-browser.js <repo-root> <work-dir> <shot-dir> [base-ref=origin/main] [v101-ref=4dc89b2]
// H. hidden (no preview): base tree (origin/main = PR4) vs PR tree, same boot + ⓘ + language + Home flow; + midnight
// F. real user flow, entered by URL (?preview=plan), clicks / keyboard only: create → Home card → today → real Practice
//    answers (PR2 hook) → ‹ › days (past / ahead / rest / exam) → calendar → overall progress → days pass (carry-over,
//    G8) → G14 off / on → real Exam-mode mock (S-116) → G16 exam day / ended
// E. QA edge cases: G6 midnight timer + return to foreground, S-115 create / edit, W-036, multi-month calendar,
//    before Day 1, corrupt log, plan deleted elsewhere, language switch keeps the day, switch off on the day screen
// P. performance: 183-day plan + 90-day log: open Day screen / ‹ › / month / language (CPU ×1 and ×4); schedule (O-1)
// L. 360 / 375 / 400 × en / zh-HK (touch): horizontal scroll, tap targets, contrast, zh-HK colloquial scan, shots, mockup
// U. upgrade: v1.0.1 and PR4 (origin/main) SW → PR tree; planDay.js in cache; offline; mixed old shell + new js
// QA_ONLY=HFEPLU picks parts.
const { chromium } = require('playwright-core');
const { execSync } = require('child_process');
const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(process.argv[2]); const WORK = path.resolve(process.argv[3]); const SHOTS = path.resolve(process.argv[4]);
const BASE = process.argv[5] || 'origin/main'; const V101 = process.argv[6] || '4dc89b2';
const { startPagesServer, appFiles } = require(path.join(ROOT, 'tests', 'pages-server.js'));
let pass = 0, fail = 0; const notes = [];
const ok = (c, m) => { if (c) { pass++; console.log('ok:', m); } else { fail++; console.log('FAIL:', m); } };
const note = m => { notes.push(m); console.log('note:', m); };
const launchOpts = { args: ['--no-sandbox'] }; if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const TODAY = '2026-10-08'; const at = (iso, time = '09:00:00') => new Date(`${iso}T${time}`); const NOW = at(TODAY);
const settle = (pg, ms = 150) => pg.waitForTimeout(ms);
const INIT = () => {
  window.__w = [];
  const set = Storage.prototype.setItem, rm = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (k, v) { window.__w.push(['set', k, v]); return set.call(this, k, v); };
  Storage.prototype.removeItem = function (k) { window.__w.push(['rm', k]); return rm.call(this, k); };
};
const screen = pg => pg.evaluate(() => document.querySelector('.screen.active').id);
const visible = (pg, sel) => pg.evaluate(sel => { const e = document.querySelector(sel); return !!e && e.getClientRects().length > 0; }, sel);
const ls = (pg, k) => pg.evaluate(k => localStorage.getItem(k), k);
const watch = pg => { const errs = []; pg.on('pageerror', e => errs.push('pageerror: ' + e.message)); pg.on('console', m => { if (m.type() === 'error' || /\[i18n\] missing/.test(m.text())) errs.push('console: ' + m.text()); }); return errs; };
const archive = (ref, dir) => { fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true }); execSync(`git archive ${ref} | tar -x -C "${dir}"`, { cwd: ROOT, shell: '/bin/bash' }); };
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const storageAll = pg => pg.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
const cardText = pg => pg.evaluate(() => { const e = byId('planCard'); return e ? e.innerText.replace(/\s+/g, ' ').trim() : null; });
const active = pg => pg.evaluate(() => { const a = document.activeElement; return a ? a.id || a.tagName : null; });
async function typeDate(pg, iso, away = '#screenPlanGoal .plan-h2') {
  const [y, m, d] = iso.split('-').map(Number);
  const seq = await pg.evaluate(([y, m, d]) => new Intl.DateTimeFormat(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(y, m - 1, d)).filter(p => p.type !== 'literal').map(p => p.value).join(''), [y, m, d]);
  await pg.focus('#planExamDate'); await pg.keyboard.type(seq, { delay: 25 }); await pg.click(away); await settle(pg, 120);
}
// WCAG contrast of each visible text element (SVG text: its fill) against the first opaque background; null = image bg
const CONTRAST_FN = () => {
  const rgb = c => (c.match(/[\d.]+/g) || []).map(Number);
  const lum = v3 => { const v = v3.slice(0, 3).map(x => x / 255).map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const bgOf = e => { for (let n = e; n; n = n.parentElement) { const s = getComputedStyle(n); const c = rgb(s.backgroundColor); if (s.backgroundImage !== 'none') return null; if (c.length === 3 || (c.length === 4 && c[3] > 0.9)) return c; } return [255, 255, 255]; };
  const opac = e => { let o = 1; for (let n = e; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity); return o; };
  window.__contrast = e => { const bg = bgOf(e); if (!bg) return null; const s = getComputedStyle(e); let fg = rgb(e instanceof SVGElement ? s.fill : s.color);
    if (fg.length > 3) fg = fg.slice(0, 3).map((v, i) => fg[3] * v + (1 - fg[3]) * bg[i]);
    const a = lum(fg), b = lum(bg); return { r: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), o: opac(e) }; };
  window.__contrastAll = root => { const out = []; root.querySelectorAll('*').forEach(e => { if (e.closest('[aria-hidden="true"]') || e.closest('button:disabled') || !e.getClientRects().length) return;
    if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().replace(/[\u{1F300}-\u{1FAFF}☀-➿⚠️🎯🔥🎉✓✗›‹←→·–\s]/gu, ''))) return;
    const c = window.__contrast(e); if (c) out.push({ t: e.textContent.trim().slice(0, 24), r: +c.r.toFixed(2), o: +c.o.toFixed(2), cls: (e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className) || e.tagName }); }); return out; };
};
// tap area: points 21px from the centre (up / down, and left / right for square buttons) land on the element
const hitOf = (pg, sel, both = false) => pg.evaluate(({ sel, both }) => { const e = document.querySelector(sel); if (!e || !e.getClientRects().length) return null; e.scrollIntoView({ block: 'center' });
  const r = e.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; const h = (x, y) => { const t = document.elementFromPoint(x, y); return !!t && (t === e || e.contains(t)); };
  return { w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, hit44: h(cx, cy - 21) && h(cx, cy + 21) && (!both || (h(cx - 21, cy) && h(cx + 21, cy))) }; }, { sel, both });

// everything the day screen shows
const dayInfo = pg => pg.evaluate(() => {
  const tx = id => { const e = byId(id); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
  const shown = id => { const e = byId(id); return !!e && !e.hidden && e.getClientRects().length > 0; };
  return { scr: document.querySelector('.screen.active').id, title: tx('planDayTitle'), sub: tx('planDaySub'), y: Math.round(scrollY),
    prevDis: byId('planDayPrev').disabled, nextDis: byId('planDayNext').disabled, backToday: shown('planBackToday'), head: shown('planDayHead'),
    ring: byId('planRingProg').getAttribute('class'), ringPct: tx('planRingPct'), ringSub: tx('planRingSub'), stroke: getComputedStyle(byId('planRingProg')).stroke, dash: byId('planRingProg').style.strokeDashoffset,
    pill: tx('planDayPhase'), count: tx('planDayCount'), hint: shown('planDayHint') ? tx('planDayHint') : '', done: shown('planDayDone') ? tx('planDayDone') : '',
    exam: shown('planDayExam') ? tx('planDayExam') : '', carry: shown('planCarryAlert') ? tx('planCarryText') : '',
    tasks: [...document.querySelectorAll('#planTaskList .plan-task')].map(li => { const s = getComputedStyle(li); return { cls: li.className.replace('plan-task', '').trim(),
      ttl: li.querySelector('.plan-task-ttl').textContent, st: li.querySelector('.plan-task-st').textContent, go: (li.querySelector('.plan-task-go') || {}).textContent || '',
      tag: (li.querySelector('.plan-tag.carry') || {}).textContent || '', wrongTag: (li.querySelector('.plan-tag.wrong') || {}).textContent || '',
      mini: li.querySelector('.plan-mini i').className, miniW: li.querySelector('.plan-mini i').style.width, border: `${s.borderTopStyle} ${s.borderTopColor}`, bg: s.backgroundColor }; }),
    cal: tx('planCalTitle'), calPrev: byId('planCalPrev').disabled, calNext: byId('planCalNext').disabled, calToday: byId('planCalToday').disabled,
    cells: [...document.querySelectorAll('#planCal .plan-cell')].map(c => ({ iso: c.dataset.iso, cls: c.className.replace('plan-cell', '').trim(), btn: c.tagName === 'BUTTON', label: c.getAttribute('aria-label'), cur: c.getAttribute('aria-current'), bg: getComputedStyle(c).backgroundColor, img: getComputedStyle(c).backgroundImage !== 'none' })),
    streak: shown('planStreak') ? tx('planStreak') : '',
    kpi: [tx('planKpiPlan'), tx('planKpiPlanSub'), tx('planKpiAvg'), tx('planKpiLeft')],
    kpiRows: [...document.querySelectorAll('#planKpiRows .plan-pr')].map(r => r.textContent.replace(/\s+/g, ' ').trim() + ' |' + r.querySelector('.plan-meter-fill').className.replace('plan-meter-fill', '').trim() + ' ' + r.querySelector('.plan-meter-fill').style.width) };
});
const cell = (d, iso) => d.cells.find(c => c.iso === iso) || {};
// domain view of a day (read only: what the UI must agree with)
const domainDay = (pg, iso) => pg.evaluate(iso => { const plan = planLoad(); const log = planLoadLog() || planEmptyLog(); const day = planDayAt(plan, iso);
  const c = day ? planDayCompletion(day, planDayLog(log, iso)) : null; return c && { pct: c.pct, tasks: c.tasks.map(p => ({ done: p.done, total: p.total, bad: p.bad, complete: p.complete, pending: !!p.pending })), types: day.tasks.map(t => t.type) }; }, iso);

// Practice → "By exam" tab (the exam grid), by click
async function examTab(pg) { if (!(await visible(pg, '#examGrid button'))) { await pg.click('#ptabExam'); await settle(pg, 100); } }
// answer the given questions through the real Practice UI (by exam set): keys right, wrong-keys wrong; others skipped
async function practiseKeys(pg, keys, wrong = []) {
  const want = new Set(keys), bad = new Set(wrong);
  const exams = [...new Set([...keys, ...wrong].map(k => k.split('.')[0]))];
  for (const ex of exams) {
    if (!want.size && !bad.size) break;
    await pg.click('#modePractice'); await settle(pg, 100); await examTab(pg);
    await pg.click(`#examGrid [data-action="startExam"][data-arg="${ex}"]`); await settle(pg, 450); // > SCREEN_CHANGE_CLICK_GUARD_MS (CUI-0011)
    for (let i = 0; i < 40; i++) {
      const q = await pg.evaluate(() => { const q = state.questions[state.current]; return { k: planCanonKey(qKey(q)), a: q.a, n: q.o.length, last: state.current === state.questions.length - 1 }; });
      if (want.has(q.k) || bad.has(q.k)) {
        const picks = bad.has(q.k) ? [...Array(q.n).keys()].filter(x => !q.a.includes(x)).slice(0, q.a.length) : q.a;
        for (const oi of picks) await pg.click('#opt' + oi);
        want.delete(q.k); bad.delete(q.k); await settle(pg, 40);
      }
      if (q.last || (!want.size && !bad.size)) break;
      await pg.click('#nextBtn'); await settle(pg, 40);
    }
    await pg.click('#screenQuiz .back-btn'); await settle(pg, 150);
  }
  return [...want, ...bad];
}
// a timed Exam-mode exam through the real UI: `right` answers right, the rest wrong, then Submit
async function takeExam(pg, exam, right) {
  await pg.click('#modeExam'); await settle(pg, 100);
  await pg.click(`#examGrid [data-action="startExam"][data-arg="${exam}"]`); await settle(pg, 450);
  for (let i = 0; i < 24; i++) {
    const q = await pg.evaluate(() => { const q = state.questions[state.current]; return { a: q.a, n: q.o.length }; });
    const picks = i < right ? q.a : [...Array(q.n).keys()].filter(x => !q.a.includes(x)).slice(0, q.a.length);
    for (const oi of picks) await pg.click('#opt' + oi);
    await settle(pg, 30); await pg.click('#nextBtn'); await settle(pg, 40);
  }
  const dbg = await pg.evaluate(() => { const r = byId('nextBtn').getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { scr: document.querySelector('.screen.active').id, cur: state.current, hit: h && (h.id || h.className), modalOpen: getComputedStyle(byId('confirmModal')).display, ans: Object.keys(state.answers).length, miss: state.questions.map((q, i) => (state.answers[i] || []).length ? null : i + ':' + JSON.stringify(q.a) + q.o.length).filter(Boolean), last: JSON.stringify(state.answers[23]) }; });
  if (dbg.scr !== 'screenResult') note('[takeExam] ' + JSON.stringify(dbg));
  if (await visible(pg, '#confirmOk')) { await pg.click('#confirmOk'); await settle(pg, 200); }
  await settle(pg, 300);
}
async function boot(pg, base, now, { lang = 'en', wrong = '{"1.3":true}', query = '?preview=plan', install = false } = {}) {
  if (install) await pg.clock.install({ time: now }); else await pg.clock.setFixedTime(now);
  await pg.goto(base); await pg.evaluate(({ lang, wrong }) => { localStorage.clear(); localStorage.setItem('lifeuk.installDismissed', 'true');
    if (wrong) localStorage.setItem('lifeuk.wrongList', wrong); if (lang !== 'en') localStorage.setItem('lifeuk.uiLang', JSON.stringify(lang)); }, { lang, wrong });
  await pg.goto(base + query); await settle(pg, 300);
}
// create card → goal → Build (→ schedule) → ← Home
async function createViaUi(pg, { date = null, noRest = false, tap = false } = {}) {
  const press = sel => (tap ? pg.tap(sel) : pg.click(sel));
  await press('#planCard .plan-cta'); await settle(pg, 200);
  if (date) await typeDate(pg, date);
  if (noRest) { await press('#planRestChips [data-arg="0"]'); await settle(pg, 80); }
  await press('#planCreateBtn'); await settle(pg, 300);
  await press('#screenPlanSchedule .back-btn'); await settle(pg, 200);
}
const goDay = async (pg, step, n = 1, key = false) => { for (let i = 0; i < n; i++) { if (key) { await pg.focus(step < 0 ? '#planDayPrev' : '#planDayNext'); await pg.keyboard.press('Enter'); } else await pg.click(step < 0 ? '#planDayPrev' : '#planDayNext'); await settle(pg, 60); } };
// seed (merge) a day's log so its own tasks reach about pct % (the runner that writes logs from tasks is PR6)
const seedDayPct = (pg, iso, target) => pg.evaluate(({ iso, target }) => {
  const plan = planLoad(), day = planDayAt(plan, iso);
  const q = [...new Set(day.tasks.filter(t => t.type !== 'mock').flatMap(planTaskQids))];
  const pctNow = () => planDayCompletion(day, planDayLog(planLoadLog(), iso)).pct || 0;
  for (const k of q) { // add right answers one by one until the day reaches target %
    if (pctNow() >= target) break;
    const log = planLoadLog() || planEmptyLog(); const dl = planDayLog(log, iso);
    writePlanLog({ ...log, days: { ...log.days, [iso]: { ...dl, ok: { ...dl.ok, [k]: 1 } } } });
  }
  return pctNow();
}, { iso, target });

// ── H: hidden state, base (PR4) vs PR ──
async function hiddenFlow(b, base, label) {
  const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
  await ctx.addInitScript(INIT);
  const pg = await ctx.newPage(); const errs = watch(pg);
  await pg.clock.install({ time: at(TODAY, '23:58:00') });
  await pg.goto(base); await settle(pg);
  await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('lifeuk.installDismissed', 'true'); });
  await pg.goto(base); await settle(pg, 300);
  const r = {};
  await pg.click('#infoBtn'); await settle(pg);
  r.info = await pg.$eval('#infoPop', e => e.innerText);
  await pg.click('#infoBtn'); await settle(pg);
  await pg.click('#langBtn'); await settle(pg, 300);
  await pg.click('#infoBtn'); await settle(pg);
  r.infoZh = await pg.$eval('#infoPop', e => e.innerText);
  await pg.keyboard.press('Escape'); await settle(pg);
  r.homeZh = await pg.$eval('#screenHome', e => e.innerText);
  await pg.click('#langBtn'); await settle(pg, 300);
  await pg.click('#modePractice'); await settle(pg);
  r.home = await pg.$eval('#screenHome', e => e.innerText);
  r.homeHtml = await pg.$eval('#screenHome', e => e.outerHTML);
  // the local day changes with the app open (G6 timer is armed on PR5): Home must stay the same, nothing written
  const w0 = await pg.evaluate(() => window.__w.length);
  await pg.clock.runFor(4 * 60 * 1000); await settle(pg, 200);
  r.midnight = { writes: await pg.evaluate(n => window.__w.slice(n).map(w => w[0] + ':' + w[1]), w0), html: await pg.$eval('#screenHome', e => e.outerHTML) };
  await examTab(pg);
  await pg.click('#examGrid [data-action="startExam"][data-arg="1"]'); await settle(pg, 200);
  for (const oi of await pg.evaluate(() => state.questions[state.current].a)) await pg.click('#opt' + oi);
  await settle(pg, 150);
  r.quiz = await pg.$eval('#screenQuiz', e => e.innerText.replace(/\d+:\d+/g, ''));
  r.writes = await pg.evaluate(() => window.__w.map(w => w[0] + ':' + w[1]));
  r.storage = await storageAll(pg);
  if (label === 'pr') r.dom = await pg.evaluate(() => ({ card: !!byId('planCard'), row: byId('infoPlanRow').hidden, day: byId('screenPlanDay').classList.contains('active'), tasks: byId('planTaskList').innerHTML, cal: byId('planCal').innerHTML }));
  r.errs = errs; await ctx.close(); return r;
}
async function partH(b) {
  const dir = path.join(WORK, 'pr5-base'); archive(BASE, dir);
  const s1 = await startPagesServer(dir), s2 = await startPagesServer(ROOT);
  try {
    const a = await hiddenFlow(b, s1.base, 'base'), p = await hiddenFlow(b, s2.base, 'pr');
    if (JSON.stringify(a.writes) !== JSON.stringify(p.writes)) console.log('  base writes:', a.writes.join(' | '));
    ok(JSON.stringify(a.writes) === JSON.stringify(p.writes), `[H1] boot + ⓘ + en↔zh-HK + midnight + Practice + 1 answer: storage write sequence identical (${p.writes.length}) ${p.writes.join(' | ')}`);
    const strip = s => { const o = { ...s }; delete o['lifeuk.practiceStreak']; return o; };
    ok(JSON.stringify(strip(a.storage)) === JSON.stringify(strip(p.storage)) && Object.keys(a.storage).join() === Object.keys(p.storage).join(), '[H2] final localStorage keys identical; values identical except the streak of the (random) first question');
    ok(!p.writes.some(w => /studyPlan/.test(w)), '[H3] 0 lifeuk.studyPlan* writes');
    ok(a.info === p.info && a.infoZh === p.infoZh, '[H4] ⓘ popover text identical (en + zh-HK)');
    ok(a.home === p.home && a.homeZh === p.homeZh && a.homeHtml === p.homeHtml, '[H5] Home text + outerHTML identical (no #planCard)');
    ok(p.midnight.writes.length === 0 && p.midnight.html === p.homeHtml && a.midnight.html === a.homeHtml, `[H6] app open across local midnight (G6 timer armed): 0 writes, Home DOM unchanged ${p.midnight.writes.join(' | ')}`);
    ok(!p.dom.card && p.dom.row && !p.dom.day && p.dom.tasks === '' && p.dom.cal === '', `[H7] PR DOM: no card, Features row hidden, day screen never rendered ${JSON.stringify(p.dom)}`);
    ok(a.errs.length === 0 && p.errs.length === 0, `[H8] 0 console / page errors ${a.errs.concat(p.errs).join(' | ')}`);
  } finally { s1.server.kill(); s2.server.kill(); fs.rmSync(dir, { recursive: true, force: true }); }
}

// ── F: real user flow via URL ──
async function partF(b) {
  const s = await startPagesServer(ROOT);
  try {
    const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
    await ctx.addInitScript(INIT); await ctx.addInitScript(CONTRAST_FN);
    const pg = await ctx.newPage(); const errs = watch(pg);
    await boot(pg, s.base, NOW, { install: true }); // flowing clock: a frozen one freezes event.timeStamp (CUI-0011 click guard)
    await createViaUi(pg);
    const plan = await pg.evaluate(() => planLoad());
    ok(plan && plan.days.length === 21 && plan.start === TODAY, `[F1] built via UI: ${plan && plan.start} → ${plan && plan.goal.examDate}, ${plan && plan.days.length} days`);
    // F2 Home card (handoff §2.1)
    const c0 = await cardText(pg);
    const cardBtns = await pg.evaluate(() => [...document.querySelectorAll('#planCard button')].map(e => ({ t: e.textContent, cls: e.className, h: Math.round(e.getBoundingClientRect().height) })));
    const bar0 = await pg.evaluate(() => { const i = document.querySelector('#planCard .plan-home-bar i'); return i && { cls: i.className, w: i.style.width }; });
    const cardBg = await pg.evaluate(() => getComputedStyle(document.querySelector('#planCard .plan-home')).backgroundColor);
    ok(/Day 1 \/ 21/.test(c0) && /21 days/.test(c0) && /Today's progress 0%/.test(c0) && /Next: Read/.test(c0), `[F2] Home card: "${c0}"`);
    ok(cardBtns.length === 2 && cardBtns[0].t === "Continue today's tasks →" && /gold/.test(cardBtns[0].cls) && cardBtns[1].t === 'Schedule' && cardBtns.every(x => x.h >= 44), `[F2] card buttons ${JSON.stringify(cardBtns)}; bar ${JSON.stringify(bar0)}; card bg ${cardBg}`);
    await pg.screenshot({ path: path.join(SHOTS, 'F-375-en-home-day1.png') });
    // F3 Continue → today
    await pg.click('#planCard .plan-btn-gold'); await settle(pg, 250);
    let d = await dayInfo(pg);
    ok(d.scr === 'screenPlanDay' && d.y === 0 && d.title === "Today's tasks" && d.sub === '8/10 Thu · 1/21' && d.prevDis && !d.nextDis && !d.backToday, `[F3] Continue → day screen "${d.title}" / "${d.sub}", ‹ disabled on Day 1, no "back to today"`);
    ok(/h0/.test(d.ring) && /empty/.test(d.ring) && d.ringPct === '0%' && d.ringSub === 'Done today' && d.pill === 'Read + practise phase' && d.count === '0 / 7 done' && /counted automatically/.test(d.hint), `[F3] ring ${d.ring} ${d.ringPct} "${d.ringSub}", pill "${d.pill}", "${d.count}", hint today`);
    ok(d.tasks.length === 7 && d.tasks.every(t => /todo/.test(t.cls) && /dashed/.test(t.border)) && d.tasks.filter(t => t.go === 'Start ›').length === 7 && !d.carry, `[F3] 7 task boxes, all "not started" (dashed) with "Start ›": ${d.tasks.map(t => t.ttl.slice(0, 22) + ' | ' + t.st).join(' // ')}`);
    ok(/1 question · Wrong answers/.test(d.tasks[6].st), `[F3] G9: clear-wrong snapshot = the 1 wrong answer stored "${d.tasks[6].st}"`);
    const today = cell(d, TODAY);
    ok(d.cal === 'October 2026' && today.cur === 'date' && /today/.test(today.cls) && cell(d, '2026-10-07').cls === 'out' && !cell(d, '2026-10-07').btn && /exam/.test(cell(d, '2026-10-29').cls) && cell(d, '2026-10-29').img && /rest/.test(cell(d, '2026-10-11').cls) && /future/.test(cell(d, '2026-10-12').cls) && cell(d, '2026-10-31').cls === 'out', `[F3] calendar "${d.cal}": today aria-current, out / rest / future / exam (lattice) cells; ${today.label}`);
    ok(d.calPrev && d.calNext && d.calToday && !d.streak, `[F3] one-month plan: calendar ‹ Today › all disabled; no streak pill at 0 (G29)`);
    ok(d.kpi.join(' | ') === '5% | Day 1 / 21 | 0% | 21 days' && d.kpiRows.length === 3 && /^Facts read ?0 \/ 236/.test(d.kpiRows[0]) && /^Questions practised ?0 \//.test(d.kpiRows[1]) && /^Mocks ≥ 21\/24 ?0 \/ 6/.test(d.kpiRows[2]), `[F3] overall progress ${d.kpi.join(' | ')} ; ${d.kpiRows.join(' ; ')}`);
    await pg.screenshot({ path: path.join(SHOTS, 'F-375-en-day1-start.png'), fullPage: true });
    // F4 real answers through Practice (PR2 hook): task 2 (practice) all right; task 4: 3 right + 1 wrong
    const day1 = plan.days[0];
    const t2 = day1.tasks[1].qids, t4 = day1.tasks[3].qids;
    const wrongQ = await pg.evaluate(keys => keys.find(k => questionByKey(k).q.a.length === 1), t4.slice(3));
    await pg.click('#planDayHeading'); // (nothing) then ← Home
    await pg.click('#screenPlanDay .back-btn'); await settle(pg, 200);
    const left = await practiseKeys(pg, [...t2, ...t4.slice(0, 3)], [wrongQ]);
    ok(left.length === 0, `[F4] answered ${t2.length + 4} plan questions in real Practice sessions (left ${left.join(',')})`);
    const log1 = JSON.parse(await ls(pg, 'lifeuk.studyPlanProgress'));
    const okN = Object.keys(log1.days[TODAY].ok || {}).length, badN = Object.keys(log1.days[TODAY].bad || {}).length;
    ok(okN >= t2.length + 3 && badN >= 1 && log1.days[TODAY].bad[wrongQ], `[F4] log written by the PR2 hook on Day 1: ${okN} right, ${badN} wrong`);
    const wl = JSON.parse(await ls(pg, 'lifeuk.wrongList'));
    const c1 = await cardText(pg); const dd1 = await domainDay(pg, TODAY);
    ok(c1 !== c0 && new RegExp(`Today's progress ${dd1.pct}%`).test(c1) && dd1.pct > 0, `[F4] Home card % moved with the answers (domain ${dd1.pct}%): "${c1}"`);
    await pg.click('#planCard .plan-btn-gold'); await settle(pg, 250);
    d = await dayInfo(pg);
    ok(d.ringPct === `${dd1.pct}%` && new RegExp(`h${dd1.pct >= 75 ? 3 : dd1.pct >= 50 ? 2 : 1}`).test(d.ring) && d.count === '2 / 7 done', `[F4] ring ${d.ringPct} (${d.ring}) = domain; "${d.count}"`);
    ok(/done/.test(d.tasks[0].cls) && /counted as read/.test(d.tasks[0].st) && d.tasks[0].go === '✓ Review ›', `[F4] G3: reading done by answering its questions: "${d.tasks[0].st}" / "${d.tasks[0].go}"`);
    ok(/done/.test(d.tasks[1].cls) && d.tasks[1].st === `✓ ${t2.length} questions done` && /h4/.test(d.tasks[1].mini) && d.tasks[1].miniW === '100%', `[F4] task 2 done (green): "${d.tasks[1].st}" ${d.tasks[1].mini} ${d.tasks[1].border} ${d.tasks[1].bg}`);
    ok(!/todo|done/.test(d.tasks[3].cls) && /solid/.test(d.tasks[3].border) && /✓ 3 \/ 11 right · ✗ 1/.test(d.tasks[3].st) && d.tasks[3].wrongTag === '1 wrong: only right answers count' && d.tasks[3].go === 'Continue ›', `[F4] task 4 in progress (solid): "${d.tasks[3].st}" go "${d.tasks[3].go}"`);
    ok(/todo/.test(d.tasks[4].cls) && /todo/.test(d.tasks[5].cls), '[F4] tasks 5–6 still not started');
    ok(/1 question · Wrong answers/.test(d.tasks[6].st) && Object.keys(wl).length >= 2, `[F4] G9: a new wrong answer today joins the wrong list (${Object.keys(wl).length}) but today's clear-wrong stays "${d.tasks[6].st}"`);
    const states = new Set(d.tasks.map(t => (/done/.test(t.cls) ? 'done' : /todo/.test(t.cls) ? 'todo' : 'doing')));
    ok(states.size === 3, `[F4] three own-day states on one screen: ${[...states]}`);
    await pg.screenshot({ path: path.join(SHOTS, 'F-375-en-day1-answered.png'), fullPage: true });
    // F5 ‹ › through the plan: ahead / rest / drill / mock / light / exam
    await goDay(pg, 1);
    d = await dayInfo(pg);
    ok(d.title === 'Day 2 tasks' && d.sub === '9/10 Fri · 2/21' && !d.prevDis && d.backToday && d.pill === 'Read + practise phase · ahead' && /A day ahead/.test(d.hint) && d.ringSub === 'Done that day' && await active(pg) === 'planDayNext', `[F5] › Day 2: "${d.title}" "${d.sub}" pill "${d.pill}", back-to-today shown, focus stays on ›`);
    ok(d.tasks[0].go === 'Start ›' && d.tasks[1].go === 'Start ›' && d.tasks[2].st === 'Decided on the day from your wrong answers' && d.tasks[2].go === '', `[F5] G23 ahead: read + practice can start early; clear-wrong "${d.tasks[2].st}" (no Start)`);
    await goDay(pg, 1, 2); d = await dayInfo(pg);
    ok(d.title === 'Day 4 tasks' && d.pill === 'Rest day' && d.count === 'Rest day: no tasks' && !d.hint && d.tasks.length === 0 && d.ringPct === '–', `[F5] Day 4 rest: "${d.pill}" / "${d.count}" ring "${d.ringPct}"`);
    await goDay(pg, 1, 5); d = await dayInfo(pg);
    ok(d.title === 'Day 9 tasks' && /ahead/.test(d.pill) && d.tasks.length === 4 && d.tasks.every(t => t.st === 'Decided on the day from your wrong answers' && t.go === ''), `[F5] Day 9 drill ahead: ${d.tasks.length} tasks decided on the day, none can start (G23)`);
    await goDay(pg, 1, 8); d = await dayInfo(pg);
    ok(d.title === 'Day 17 tasks' && /Mock/.test(d.pill) && d.tasks.filter(t => /mock/.test(t.cls)).every(t => t.go === '' && /24 questions · Mock exam/.test(t.st)), `[F5] Day 17 mock ahead: "${d.tasks.map(t => t.st).join(' / ')}" (no Start, G23)`);
    await goDay(pg, 1, 4); d = await dayInfo(pg);
    const lightTxt = d.tasks.map(t => t.ttl).join(' / ');
    await goDay(pg, 1); d = await dayInfo(pg);
    ok(d.title === 'Exam day' && d.sub === '29/10 Thu · 🎯' && d.nextDis && !d.head && /🎯 Exam day/.test(d.exam) && /early/.test(d.exam) && d.tasks.length === 0 && await active(pg) === 'planDayPrev', `[F5] › to the exam day: "${d.exam}", › disabled, focus handed to ‹ (Day 21: ${lightTxt})`);
    ok(d.backToday && await hitOf(pg, '#planBackToday').then(h => h && h.hit44), `[F5] O-1 re-test: the exam-day view (ahead) offers "← Back to today" (44px hit area)`);
    await pg.click('#planBackToday'); await settle(pg, 150);
    { const r = await dayInfo(pg); ok(r.title === "Today's tasks" && r.head && !r.exam && !r.backToday && await active(pg) === 'planDayHeading' && await pg.evaluate(() => byId('planBackToday').parentElement.id) === 'planDayInfo', `[F5] O-1: from the exam day "← Back to today" → today, button back under the hint, focus on the heading`); }
    await pg.click(`#planCal [data-iso="2026-10-29"]`); await settle(pg, 200); d = await dayInfo(pg);
    await pg.screenshot({ path: path.join(SHOTS, 'F-375-en-exam-ahead.png'), fullPage: true });
    // calendar: today cell → today, page top, focus heading
    await pg.click(`#planCal [data-iso="${TODAY}"]`); await settle(pg, 200);
    d = await dayInfo(pg);
    ok(d.title === "Today's tasks" && d.y === 0 && await active(pg) === 'planDayHeading', `[F5] calendar today cell → today, page top, focus on the heading`);
    await pg.click('#planCal [data-iso="2026-10-15"]'); await settle(pg, 200);
    d = await dayInfo(pg);
    ok(d.title === 'Day 8 tasks' && /viewing/.test(cell(d, '2026-10-15').cls) && d.y === 0 && await active(pg) === 'planDayHeading', `[F5] calendar cell 15/10 → Day 8, marked viewing`);
    // W-036 keyboard: back to today
    await pg.focus('#planBackToday'); await pg.keyboard.press('Enter'); await settle(pg, 150);
    const fvis = await pg.evaluate(() => document.activeElement.matches(':focus-visible'));
    d = await dayInfo(pg);
    ok(d.title === "Today's tasks" && !d.backToday && await active(pg) === 'planDayHeading', `[F5] W-036: keyboard "← Back to today" → today, focus on the heading (not <body>), focus-visible ${fvis}`);
    await pg.keyboard.press('Tab');
    ok(await active(pg) === 'planDayNext', `[F5] W-036: next Tab from the heading goes to › (${await active(pg)})`);
    // F6 schedule rows open their day; "View today's tasks →"
    await pg.click('#screenPlanDay [data-action="openPlanSchedule"]'); await settle(pg, 250);
    const rows = await pg.evaluate(() => [...document.querySelectorAll('#planDayList .plan-day')].map(r => ({ tag: r.tagName, arg: r.dataset.arg, pill: (r.querySelector('.plan-pill') || {}).textContent || '' })));
    ok(await screen(pg) === 'screenPlanSchedule' && rows.length === 22 && rows.every(r => r.tag === 'BUTTON' && r.arg) && rows[1].pill === '›', `[F6] schedule: 22 rows are buttons, ahead rows show › (${rows[1].pill})`);
    await pg.$eval('#planDayList .plan-day[data-arg="2026-10-10"]', e => e.scrollIntoView({ block: 'center' }));
    await pg.click('#planDayList .plan-day[data-arg="2026-10-10"]'); await settle(pg, 250);
    d = await dayInfo(pg);
    ok(d.scr === 'screenPlanDay' && d.title === 'Day 3 tasks' && d.y === 0, `[F6] schedule row Day 3 → day screen "${d.title}"`);
    await pg.click('#screenPlanDay [data-action="openPlanSchedule"]'); await settle(pg, 250);
    await pg.click('#screenPlanSchedule [data-action="openPlanDay"].nav-btn'); await settle(pg, 250);
    d = await dayInfo(pg);
    ok(d.title === "Today's tasks", `[F6] "View today's tasks →" → today`);
    await pg.click('#screenPlanSchedule .back-btn').catch(() => {});
    await pg.click('#screenPlanDay .back-btn'); await settle(pg, 200);
    // F7 five days later: carry-over (G8)
    await pg.clock.setSystemTime(at('2026-10-13')); await pg.reload(); await settle(pg, 300);
    const c6 = await cardText(pg);
    ok(/Day 6 \/ 21/.test(c6) && /16 days/.test(c6) && /Today's progress 0%/.test(c6), `[F7] 10-13 Home card "${c6}"`);
    await pg.click('#planCard .plan-btn-gold'); await settle(pg, 250);
    d = await dayInfo(pg);
    const own = d.tasks.filter(t => !/carry/.test(t.cls)), carry = d.tasks.filter(t => /carry/.test(t.cls));
    const carryDom = await pg.evaluate(() => planCarryTasks(planLoad(), planLoadLog(), '2026-10-13').map(c => `Day ${c.dayNumber} ${c.task.type}`));
    ok(carry.length === carryDom.length && carry.length > 0 && carry.map(t => t.tag).join() === carryDom.map(x => x.split(' ').slice(0, 2).join(' ')).join() && d.tasks.indexOf(carry[0]) === own.length, `[F7] ${carry.length} carry-over boxes after today's own ${own.length}, tagged ${carry.map(t => t.tag).join(',')}`);
    ok(!carryDom.some(x => /Day 4/.test(x)) && !carryDom.some(x => /Day [235] review/.test(x)), `[F7] G24: never-opened past days' clear-wrong not carried; rest day nothing: ${carryDom.join(', ')}`);
    const colOf = t => t.border.replace(/^\w+ /, '');
    ok(new Set(carry.map(colOf)).size === 1 && colOf(carry[0]) !== colOf(own[0]), `[F7] carry boxes share one orange border colour: ${[...new Set(carry.map(t => t.border))].join(' / ')} vs own ${own[0].border}`);
    const wlNow = Object.keys(JSON.parse(await ls(pg, 'lifeuk.wrongList'))).length;
    ok(own.some(t => /review/.test(t.cls) && t.st === `${wlNow} questions · Wrong answers`), `[F7] G9: a new day takes a new snapshot of the wrong list (${wlNow}): "${(own.find(t => /review/.test(t.cls)) || {}).st}"`);
    ok(d.carry === `${carry.length} unfinished tasks from earlier days were carried over to today, marked with their day. They don't count towards today's %.` && d.ringPct === '0%', `[F7] alert "${d.carry}"; today ring ${d.ringPct}`);
    await pg.screenshot({ path: path.join(SHOTS, 'F-375-en-day6-carry.png'), fullPage: true });
    // answer a Day 1 carry task (task 5, practice) through Practice → counts for Day 1, not today (G5 / G8)
    const before1 = await domainDay(pg, TODAY), before6 = await domainDay(pg, '2026-10-13');
    const t6 = day1.tasks[5].qids.slice(0, 4);
    await pg.click('#screenPlanDay .back-btn'); await settle(pg, 150);
    await practiseKeys(pg, t6);
    const after1 = await domainDay(pg, TODAY), after6 = await domainDay(pg, '2026-10-13');
    const c6b = await cardText(pg);
    ok(after1.pct > before1.pct && after6.pct === before6.pct && /Today's progress 0%/.test(c6b), `[F7] G8: catch-up answers counted for Day 1 (${before1.pct}% → ${after1.pct}%), today stays ${after6.pct}%; card "${c6b.slice(0, 60)}"`);
    await pg.click('#planCard .plan-btn-gold'); await settle(pg, 250);
    d = await dayInfo(pg);
    const c5 = d.tasks.find(t => /carry/.test(t.cls) && /Ch/.test(t.ttl) && /4 \/ 39 right/.test(t.st));
    ok(!!c5 && d.ringPct === '0%', `[F7] carry box shows its own day's answers "${c5 && c5.st}"; today ring ${d.ringPct}`);
    // ‹ back to Day 1 (past)
    await goDay(pg, -1, 5); d = await dayInfo(pg);
    ok(d.title === 'Day 1 tasks' && d.pill === 'Read + practise phase · past' && /A day gone by/.test(d.hint) && d.ringPct === `${after1.pct}%` && d.ringSub === 'Done that day' && d.backToday && !d.carry && d.prevDis, `[F7] ‹ Day 1 (past): pill "${d.pill}" ring ${d.ringPct}, no carry list on a past day`);
    ok(cell(d, TODAY).cls.includes('past') && /h[1-3]/.test(cell(d, TODAY).cls) && /viewing/.test(cell(d, TODAY).cls) && /past/.test(cell(d, '2026-10-09').cls) && /rest past/.test(cell(d, '2026-10-11').cls) && /today/.test(cell(d, '2026-10-13').cls), `[F7] calendar past cells lighter band: ${['2026-10-08', '2026-10-09', '2026-10-11', '2026-10-13'].map(i => i.slice(-2) + ':' + cell(d, i).cls).join(', ')}`);
    await pg.screenshot({ path: path.join(SHOTS, 'F-375-en-day1-past.png'), fullPage: true });
    // F8 G27 five bands + G29 streak (seeded logs; the runner is PR6)
    await pg.click('#planBackToday'); await settle(pg, 100);
    await pg.click('#screenPlanDay .back-btn'); await settle(pg, 100);
    const pcts = {};
    pcts['2026-10-09'] = await seedDayPct(pg, '2026-10-09', 100);
    pcts['2026-10-10'] = await seedDayPct(pg, '2026-10-10', 75);
    pcts['2026-10-12'] = await seedDayPct(pg, '2026-10-12', 50);
    await pg.click('#planCard .plan-btn-gold'); await settle(pg, 250);
    d = await dayInfo(pg);
    const bandOf = iso => (cell(d, iso).cls.match(/h(\d)/) || [])[1];
    ok(bandOf('2026-10-09') === '4' && bandOf('2026-10-10') === '3' && bandOf('2026-10-12') === '2' && bandOf(TODAY) === '1' && bandOf('2026-10-13') === '0', `[F8] calendar bands ${JSON.stringify(pcts)} → ${['08', '09', '10', '12', '13'].map(x => x + ':' + cell(d, '2026-10-' + x).cls).join(', ')}`);
    // ring colour per band (past days, opened from the calendar)
    const ringCols = {};
    for (const iso of ['2026-10-13', TODAY, '2026-10-12', '2026-10-10', '2026-10-09']) {
      await pg.click(`#planCal [data-iso="${iso}"]`); await settle(pg, 120);
      const r = await dayInfo(pg); ringCols[iso] = `${r.ringPct} ${r.ring.replace('plan-ring-prog', '').trim()} ${r.stroke}`;
    }
    const strokes = Object.values(ringCols).map(v => v.split(' ').slice(-3).join(' '));
    ok(new Set(strokes).size === 5 && ['h0', 'h1', 'h2', 'h3', 'h4'].every((h, i) => Object.values(ringCols)[i].includes(h)), `[F8] G27 ring: 5 bands, 5 colours ${JSON.stringify(ringCols)}`);
    ok(!d.streak, `[F8] G29: Day 5 at 50% breaks the run → no pill (0 days) "${d.streak}"`);
    await seedDayPct(pg, '2026-10-12', 100);
    await pg.click(`#planCal [data-iso="2026-10-13"]`); await settle(pg, 120); d = await dayInfo(pg);
    ok(d.streak === '🔥 1 day in a row at 100%', `[F8] G29: Day 5 100%, rest day skipped, Day 3 75% breaks → "${d.streak}"`);
    pcts['2026-10-10'] = await seedDayPct(pg, '2026-10-10', 100);
    await pg.click('#planDayNext'); await pg.click('#planDayPrev'); await settle(pg, 100); // re-render via ‹ ›
    await pg.click('#planBackToday').catch(() => {}); await settle(pg, 100);
    d = await dayInfo(pg);
    ok(d.streak === '🔥 3 days in a row at 100%', `[F8] G29: Days 2, 3, 5 at 100% (rest day 4 in between) → "${d.streak}"`);
    const bandColours = await pg.evaluate(() => [0, 1, 2, 3, 4].map(n => { const e = document.createElement('i'); e.className = 'plan-swatch h' + n; document.body.append(e); const c = getComputedStyle(e).backgroundColor; e.remove(); return c; }));
    ok(new Set(bandColours.slice(1)).size === 4, `[F8] G27 legend swatches h1–h4 distinct: ${bandColours.join(' / ')}`);
    // today 100% but carry left → card points to the catch-up; everything done → "✓ Done for today"
    await seedDayPct(pg, '2026-10-13', 100);
    await pg.click('#screenPlanDay .back-btn'); await settle(pg, 150);
    const c8 = await cardText(pg);
    ok(/Today's progress 100%/.test(c8) && /Next \(catch-up, Day 1\)/.test(c8) && /Continue today's tasks/.test(c8), `[F8] today 100% with carry left: "${c8}"`);
    await pg.evaluate(() => { const plan = planLoad(); planCarryTasks(plan, planLoadLog(), planTodayIso()).forEach(c => { const log = planLoadLog(); const dl = planDayLog(log, c.date); planTaskQids(c.task).forEach(k => { dl.ok[k] = 1; }); writePlanLog({ ...log, days: { ...log.days, [c.date]: dl } }); }); });
    await pg.click('#planCard .plan-btn-gold'); await settle(pg, 200); await pg.click('#screenPlanDay .back-btn'); await settle(pg, 150);
    const c9 = await cardText(pg);
    const c9b = await pg.evaluate(() => [...document.querySelectorAll('#planCard button')].map(e => e.textContent));
    ok(/✓ Done for today, see you tomorrow/.test(c9) && c9b[0] === "View today's tasks", `[F8] all done: "${c9}" buttons ${c9b.join(' / ')}`);
    await pg.screenshot({ path: path.join(SHOTS, 'F-375-en-home-done.png') });
    await pg.click('#planCard .plan-btn-gold'); await settle(pg, 200);
    d = await dayInfo(pg);
    ok(d.done === '🎉 All done for today!' && !d.carry && /h4/.test(d.ring) && d.streak === '🔥 5 days in a row at 100%', `[F8] day screen (Day 1 completed by its catch-up too): "${d.done}", ${d.ring}, "${d.streak}"`);
    const con = await pg.evaluate(() => window.__contrastAll(byId('screenPlanDay')));
    const low = con.filter(c => c.r < 4.5 || c.o < 1);
    ok(con.length > 20 && low.length === 0, `[F8] day screen texts (${con.length}) ≥ 4.5:1, no opacity; min ${Math.min(...con.map(c => c.r))} ${low.map(c => c.t + ' ' + c.r + '/' + c.o + ' ' + c.cls).join(' | ')}`);
    await pg.click('#screenPlanDay .back-btn'); await settle(pg, 150);
    // F9 G14: switch off, a day passes, answers still count, switch on → carry
    await pg.click('#infoBtn'); await settle(pg); await pg.click('#planFeatureSwitch'); await settle(pg, 150); await pg.click('#confirmOk'); await settle(pg, 200); await pg.keyboard.press('Escape');
    ok(!(await cardText(pg)), '[F9] G14: switched off → no card');
    await pg.clock.setSystemTime(at('2026-10-14')); await pg.reload(); await settle(pg, 300);
    const d7 = plan.days[6];
    await practiseKeys(pg, d7.tasks[1].qids.slice(0, 5));
    const off7 = await domainDay(pg, '2026-10-14');
    ok(off7.pct > 0, `[F9] G14: answers while off still counted for Day 7 (${off7.pct}%)`);
    await pg.clock.setSystemTime(at('2026-10-15')); await pg.reload(); await settle(pg, 300);
    await pg.click('#infoBtn'); await settle(pg); await pg.click('#planFeatureSwitch'); await settle(pg, 200); await pg.keyboard.press('Escape');
    const c10 = await cardText(pg);
    if (!(await visible(pg, '#planCard .plan-btn-gold'))) note(`[F9] debug: card after on "${c10}" screen ${await screen(pg)} pop ${await visible(pg, '#infoPop')}`);
    await pg.click('#planCard .plan-btn-gold'); await settle(pg, 250);
    d = await dayInfo(pg);
    const tags = [...new Set(d.tasks.filter(t => /carry/.test(t.cls)).map(t => t.tag))];
    ok(/Day 8 \/ 21/.test(c10) && tags.includes('Day 7') && d.tasks.some(t => t.tag === 'Day 7' && /5 \/ 60 right/.test(t.st)), `[F9] G14: on again (Day 8): Day 7's unfinished tasks are carried, with the answers given while off; tags ${tags}`);
    await pg.click('#screenPlanDay .back-btn'); await settle(pg, 150);
    // F10 real mock on Day 17 (Exam mode, 22 / 24) → passed, S-116 "1 mock"
    await pg.clock.setSystemTime(at('2026-10-24')); await pg.reload(); await settle(pg, 300);
    await takeExam(pg, 3, 22);
    const r17 = await screen(pg);
    const r17info = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, score: (byId('resultScore') || {}).textContent, modal: byId('confirmModal').className + ' ' + byId('confirmTitle').textContent + ' ' + byId('nextBtn').textContent, q: state.current, n: state.questions.length }));
    await pg.click('#screenResult .back-btn').catch(e => note('[F10] result back: ' + e.message.split('\n')[0])); await settle(pg, 200);
    if (!(await visible(pg, '#planCard .plan-btn-gold'))) note(`[F10] debug errs ${errs.join(" | ")} ${JSON.stringify(r17info)} now ${await screen(pg)} card "${await cardText(pg)}"`);
    await pg.click('#planCard .plan-btn-gold'); await settle(pg, 250);
    d = await dayInfo(pg);
    const mocks = d.tasks.filter(t => /mock/.test(t.cls));
    ok(r17 === 'screenResult' && /done/.test(mocks[0].cls) && mocks[0].st === '✓ Passed · best 22 / 24' && /todo/.test(mocks[1].cls), `[F10] G10 / G25: real Exam-mode mock 22/24 → mock 1 "${mocks[0].st}", mock 2 "${mocks[1].st}"`);
    ok(/Mocks ≥ 21\/24 ?1 \/ 6/.test(d.kpiRows[2]), `[F10] overall: "${d.kpiRows[2]}"`);
    await pg.screenshot({ path: path.join(SHOTS, 'F-375-en-day17-mock.png'), fullPage: true });
    await pg.click('#screenPlanDay .back-btn'); await settle(pg, 150);
    // F11 G16 exam day / ended
    await pg.clock.setSystemTime(at('2026-10-29')); await pg.reload(); await settle(pg, 300);
    const ce = await cardText(pg); const ceb = await pg.evaluate(() => [...document.querySelectorAll('#planCard button')].map(e => e.textContent + ':' + Math.round(e.getBoundingClientRect().height)));
    ok(/Exam day/.test(ce) && /🎯 It's exam day today, good luck!/.test(ce) && ceb.join() === 'View today:44,Schedule:44', `[F11] G16 exam day card "${ce}" ${ceb}`);
    await pg.screenshot({ path: path.join(SHOTS, 'F-375-en-home-examday.png') });
    await pg.click('#planCard .plan-btn-gold'); await settle(pg, 250);
    d = await dayInfo(pg);
    ok(d.title === 'Exam day' && /It's exam day today, good luck!/.test(d.exam) && !d.carry && d.tasks.length === 0 && d.nextDis && !d.prevDis && cell(d, '2026-10-29').cur === 'date', `[F11] exam day screen "${d.exam}", no tasks, no carry; exam cell "${cell(d, '2026-10-29').cls}" aria-current ${cell(d, '2026-10-29').cur}`);
    ok(/today/.test(cell(d, '2026-10-29').cls) && /exam/.test(cell(d, '2026-10-29').cls), `[F11] O-2 re-test: on the exam day its cell has the today outline too: "${cell(d, '2026-10-29').cls}" outline ${await pg.$eval('#planCal [data-iso="2026-10-29"]', e => getComputedStyle(e).outlineStyle + ' ' + getComputedStyle(e).boxShadow)}`);
    await pg.screenshot({ path: path.join(SHOTS, 'F-375-en-examday-calendar.png'), clip: await pg.$eval('#planCal', e => { e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; }) });
    await pg.screenshot({ path: path.join(SHOTS, 'F-375-en-examday.png'), fullPage: true });
    await goDay(pg, -1); d = await dayInfo(pg);
    ok(d.title === 'Day 21 tasks' && /past/.test(d.pill), `[F11] ‹ Day 21 is past on the exam day: "${d.pill}"`);
    await pg.click('#screenPlanDay .back-btn'); await settle(pg, 150);
    await pg.clock.setSystemTime(at('2026-10-30')); await pg.reload(); await settle(pg, 300);
    const cz = await cardText(pg); const czb = await pg.evaluate(() => [...document.querySelectorAll('#planCard button')].map(e => e.textContent + ':' + Math.round(e.getBoundingClientRect().height)));
    ok(/Plan finished/.test(cz) && /· 1 mock at 21\/24 or more/.test(cz) && czb.join() === 'New plan:44,Change goal:44,Schedule:44', `[F11] G16 ended + S-116: "${cz}" ${czb}`);
    await pg.screenshot({ path: path.join(SHOTS, 'F-375-en-home-ended.png') });
    await pg.click('#planCard [data-action="openPlanSchedule"]'); await settle(pg, 250);
    await pg.click('#screenPlanSchedule [data-action="openPlanDay"].nav-btn'); await settle(pg, 250);
    d = await dayInfo(pg);
    ok(d.title === 'Exam day' && /🎯 Exam day/.test(d.exam) && !d.backToday && d.calToday, `[F11] after the exam: day screen opens at the exam day ("${d.exam}"), calendar still readable`);
    await pg.click('#screenPlanDay .back-btn'); await settle(pg, 150);
    await pg.evaluate(() => { const l = document.querySelector('html').lang; return l; });
    await pg.click('#langBtn'); await settle(pg, 300);
    const czh = await cardText(pg);
    ok(/計劃已完結/.test(czh) && /模擬考試達 21\/24 或以上 1 次/.test(czh), `[F11] zh-HK ended card "${czh}"`);
    await pg.click('#langBtn'); await settle(pg, 300);
    await pg.click('#planCard [data-action="openPlanGoal"]'); await settle(pg, 200);
    ok(await screen(pg) === 'screenPlanGoal' && await pg.evaluate(() => byId('planCreateBtn').textContent) === 'Build my plan →', '[F11] "New plan" → goal screen in create mode');
    ok(errs.length === 0, `[F] 0 console / page errors ${errs.join(' | ')}`);
    await ctx.close();
  } finally { s.server.kill(); }
}

// ── E: QA edge cases ──
async function partE(b) {
  const s = await startPagesServer(ROOT);
  const mk = async (opts = {}) => { const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block', ...opts }); await ctx.addInitScript(INIT); const pg = await ctx.newPage(); return { ctx, pg, errs: watch(pg) }; };
  try {
    // E1 G6: app open across midnight on the day screen (timer), on Home, and while looking at another day
    { const { ctx, pg, errs } = await mk();
      await boot(pg, s.base, at(TODAY, '23:58:30'), { install: true });
      await createViaUi(pg);
      await pg.click('#planCard .plan-btn-gold'); await settle(pg, 200);
      const d0 = await dayInfo(pg);
      await pg.clock.runFor(3 * 60 * 1000); await settle(pg, 200);
      const d1 = await dayInfo(pg);
      ok(d0.sub === '8/10 Thu · 1/21' && d1.title === "Today's tasks" && d1.sub === '9/10 Fri · 2/21' && !d1.prevDis && /today/.test(cell(d1, '2026-10-09').cls) && /past/.test(cell(d1, TODAY).cls), `[E1] G6 timer: day screen moves to the new today at midnight (${d0.sub} → ${d1.sub})`);
      ok(/Day 1/.test(d1.tasks.filter(t => /carry/.test(t.cls)).map(t => t.tag).join()) && /0%/.test(d1.ringPct), `[E1] G6: yesterday's tasks become carry-over at midnight (${d1.tasks.filter(t => /carry/.test(t.cls)).length})`);
      await goDay(pg, 1, 3); const v0 = await dayInfo(pg);
      await pg.click('#screenPlanDay .back-btn'); await settle(pg, 150);
      const h0 = await cardText(pg);
      await pg.clock.runFor(24 * 3600 * 1000); await settle(pg, 300);
      const h1 = await cardText(pg);
      ok(/Day 2 \/ 21/.test(h0) && /Day 3 \/ 21/.test(h1), `[E1] G6 timer on Home (re-armed): "${h0.slice(0, 30)}" → "${h1.slice(0, 30)}"`);
      await pg.click('#planCard .plan-btn-gold'); await settle(pg, 200); await goDay(pg, 1, 2); const v1 = await dayInfo(pg);
      await pg.clock.runFor(24 * 3600 * 1000); await settle(pg, 300);
      const v2 = await dayInfo(pg);
      ok(v1.title === 'Day 5 tasks' && v2.title === 'Day 5 tasks' && v2.backToday, `[E1] a day being looked at stays across midnight (${v0.title} / ${v1.title} → ${v2.title}, pill "${v2.pill}")`);
      ok(errs.length === 0, `[E1] 0 errors ${errs.join(' | ')}`);
      await ctx.close(); }
    // E1b midnight while a timed exam runs: the quiz is left alone, Home catches up afterwards
    { const { ctx, pg, errs } = await mk();
      await boot(pg, s.base, at(TODAY, '23:57:00'), { install: true });
      await createViaUi(pg);
      await pg.click('#modeExam'); await settle(pg, 100); await pg.click('#examGrid [data-action="startExam"][data-arg="2"]'); await settle(pg, 450);
      for (const oi of await pg.evaluate(() => state.questions[state.current].a)) await pg.click('#opt' + oi);
      await pg.click('#nextBtn'); await settle(pg, 100);
      const q0 = await pg.evaluate(() => ({ cur: state.current, ans: JSON.stringify(state.answers), html: byId('qText').innerHTML }));
      await pg.clock.runFor(4 * 60 * 1000); await settle(pg, 200);
      const q1 = await pg.evaluate(() => ({ cur: state.current, ans: JSON.stringify(state.answers), html: byId('qText').innerHTML, t: byId('examTimer').textContent, iso: planTodayIso() }));
      ok(await screen(pg) === 'screenQuiz' && q1.cur === q0.cur && q1.ans === q0.ans && q1.html === q0.html && q1.iso === '2026-10-09', `[E1b] G6 midnight during a running exam: quiz untouched (timer ${q1.t})`);
      await pg.click('#screenQuiz .back-btn'); await settle(pg, 200); await pg.click('#confirmOk'); await settle(pg, 250);
      ok(/Day 2 \/ 21/.test(await cardText(pg) || ''), `[E1b] leaving the exam: Home card is on Day 2 "${(await cardText(pg) || '').slice(0, 40)}"`);
      ok(errs.length === 0, `[E1b] 0 errors ${errs.join(' | ')}`); await ctx.close(); }
    // E2 G6: back to the foreground on a new day (timer missed, e.g. the phone slept)
    { const { ctx, pg, errs } = await mk();
      await boot(pg, s.base, at(TODAY, '22:00:00'), { install: true });
      await createViaUi(pg);
      await pg.click('#planCard .plan-btn-gold'); await settle(pg, 200);
      const other = await ctx.newPage(); await other.goto(s.base + '?preview=plan'); await other.bringToFront(); await settle(pg, 200);
      const vis = await pg.evaluate(() => document.visibilityState);
      await pg.clock.setSystemTime(at('2026-10-09', '07:30:00')); // no timer fires
      const before = await dayInfo(pg);
      let how = 'real tab switch';
      await pg.bringToFront(); await settle(pg, 300);
      let after = await dayInfo(pg);
      if (vis !== 'hidden') { how = 'visibilitychange dispatched (headless tabs stay visible)'; await pg.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await settle(pg, 200); after = await dayInfo(pg); }
      ok(before.sub === '8/10 Thu · 1/21' && after.sub === '9/10 Fri · 2/21' && after.title === "Today's tasks", `[E2] G6 foreground (${how}; hidden state seen: ${vis}): ${before.sub} → ${after.sub}`);
      await other.close(); ok(errs.length === 0, `[E2] 0 errors ${errs.join(' | ')}`); await ctx.close(); }
    // E3 S-115 create: the day changes while the form is open (no timer, e.g. slept), Build → re-render + notice
    { const { ctx, pg, errs } = await mk();
      await boot(pg, s.base, at(TODAY, '23:59:00'), { install: true });
      await pg.click('#planCard .plan-cta'); await settle(pg, 200);
      await typeDate(pg, '2026-10-15'); await pg.click('#planRestChips [data-arg="0"]'); await settle(pg, 80);
      const v0 = await pg.$eval('#planExamDate', e => e.value);
      await pg.clock.setSystemTime(at('2026-10-09', '00:00:30'));
      const w0 = await pg.evaluate(() => window.__w.length);
      await pg.click('#planCreateBtn'); await settle(pg, 250);
      const r = await pg.evaluate(n => ({ scr: document.querySelector('.screen.active').id, date: byId('planExamDate').value, min: byId('planExamDate').min, hint: byId('planGoalHint').hidden ? '' : byId('planGoalHint').textContent, dis: byId('planCreateBtn').disabled, w: window.__w.slice(n).map(x => x[1]) }), w0);
      ok(v0 === '2026-10-15' && r.scr === 'screenPlanGoal' && r.date === '2026-10-16' && r.min === '2026-10-16' && /The day has changed/.test(r.hint) && !r.dis && !r.w.some(k => /studyPlan\b/.test(k)), `[E3] S-115 create: Build after midnight → form re-rendered, date ${v0} → ${r.date}, notice "${r.hint}", nothing saved`);
      await pg.click('#planCreateBtn'); await settle(pg, 300);
      const p = await pg.evaluate(() => planLoad());
      ok(await screen(pg) === 'screenPlanSchedule' && p.start === '2026-10-09' && p.goal.examDate === '2026-10-16', `[E3] S-115: second press builds (${p.start} → ${p.goal.examDate})`);
      // edit mode: tomorrow (G36), the day changes, Update → notice; any edit clears it
      await pg.click('[data-action="planEditGoal"]'); await settle(pg, 200);
      await typeDate(pg, '2026-10-10');
      await pg.clock.setSystemTime(at('2026-10-10', '00:00:20'));
      await pg.click('#planCreateBtn'); await settle(pg, 250);
      const e1 = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, date: byId('planExamDate').value, hint: byId('planGoalHint').hidden ? '' : byId('planGoalHint').textContent, btn: byId('planCreateBtn').textContent, exam: planLoad().goal.examDate }));
      ok(e1.scr === 'screenPlanGoal' && e1.date === '2026-10-11' && /The day has changed/.test(e1.hint) && e1.btn === 'Update my plan →' && e1.exam === '2026-10-16', `[E3] S-115 edit: Update after midnight → ${JSON.stringify(e1)}`);
      await pg.focus('#planMins'); await pg.keyboard.press('ArrowLeft'); await settle(pg, 150);
      const e2 = await pg.evaluate(() => byId('planGoalHint').hidden ? '' : byId('planGoalHint').textContent);
      ok(!/The day has changed/.test(e2), `[E3] S-115: changing a field clears the notice ("${e2}")`);
      await pg.click('#planCreateBtn'); await settle(pg, 300);
      ok(await screen(pg) === 'screenPlanSchedule' && await pg.evaluate(() => planLoad().goal.examDate) === '2026-10-11', '[E3] S-115 edit: Update then works (exam 11/10)');
      ok(errs.length === 0, `[E3] 0 errors ${errs.join(' | ')}`); await ctx.close(); }
    // E4 multi-month plan: calendar months, W-036 calendar Today, arrows hand focus, header › across a month, language
    { const { ctx, pg, errs } = await mk();
      await boot(pg, s.base, NOW);
      await createViaUi(pg, { date: '2026-11-20' });
      await pg.click('#planCard .plan-btn-gold'); await settle(pg, 200);
      let d = await dayInfo(pg);
      ok(d.cal === 'October 2026' && d.calPrev && !d.calNext && d.calToday, `[E4] Oct–Nov plan: calendar October, ‹ disabled, › enabled, Today disabled`);
      await pg.click('#planCalNext'); await settle(pg, 120); d = await dayInfo(pg);
      ok(d.cal === 'November 2026' && !d.calPrev && d.calNext && !d.calToday && await active(pg) === 'planCalPrev' && d.title === "Today's tasks", `[E4] cal › → November; › disabled so focus → ‹ (${await active(pg)}); shown day unchanged`);
      ok(/exam/.test(cell(d, '2026-11-20').cls) && cell(d, '2026-11-21').cls === 'out' && /future/.test(cell(d, '2026-11-02').cls), `[E4] November: exam 20/11, 21/11 outside, ahead cells`);
      await pg.focus('#planCalToday'); await pg.keyboard.press('Enter'); await settle(pg, 120); d = await dayInfo(pg);
      ok(d.cal === 'October 2026' && d.calToday && await active(pg) === 'planCalNext', `[E4] W-036: keyboard calendar "Today" → October, Today disabled, focus on an enabled arrow (${await active(pg)}), not <body>`);
      await pg.click('#planCalNext'); await settle(pg, 100);
      await pg.click('#planCal [data-iso="2026-11-05"]'); await settle(pg, 200); d = await dayInfo(pg);
      ok(d.title === 'Day 29 tasks' && d.cal === 'November 2026' && await active(pg) === 'planDayHeading', `[E4] November cell 5/11 → "${d.title}"`);
      await pg.click('#planBackToday'); await settle(pg, 100);
      await pg.click('#planCal [data-iso="2026-10-31"]'); await settle(pg, 150);
      await goDay(pg, 1); d = await dayInfo(pg);
      ok(d.title === 'Day 25 tasks' && d.cal === 'November 2026', `[E4] header › from 31/10 to 1/11: calendar follows to "${d.cal}"`);
      await pg.click('#langBtn'); await settle(pg, 300); d = await dayInfo(pg);
      ok(d.title === 'Day 25 任務' && d.cal === '2026 年 11 月' && d.sub === '1/11 日 · 25/43' && d.pill === '休息日', `[E4] language switch keeps the day + month: "${d.title}" "${d.sub}" "${d.cal}" "${d.pill}"`);
      await pg.click('#langBtn'); await settle(pg, 300);
      // E5 task boxes are not buttons yet (runner PR6): clicking does nothing
      await pg.click('#planBackToday'); await settle(pg, 100);
      await pg.click('#planTaskList .plan-task >> nth=0'); await settle(pg, 150);
      ok(await screen(pg) === 'screenPlanDay', '[E5] tapping a task box: no navigation, no error (runner is PR6)');
      // E6 switch off on the day screen → Home (G15)
      await pg.click('#infoBtn'); await settle(pg); await pg.click('#planFeatureSwitch'); await settle(pg, 150); await pg.click('#confirmOk'); await settle(pg, 250);
      ok(await screen(pg) === 'screenHome' && !(await cardText(pg)), '[E6] G15: switching off on the day screen goes Home, no card');
      ok(errs.length === 0, `[E4–E6] 0 errors ${errs.join(' | ')}`); await ctx.close(); }
    // E7 before Day 1, corrupt log, plan deleted elsewhere
    { const { ctx, pg, errs } = await mk();
      await boot(pg, s.base, NOW);
      await createViaUi(pg);
      await pg.clock.setFixedTime(at('2026-10-05')); await pg.reload(); await settle(pg, 300);
      const cb = await cardText(pg); const cbb = await pg.evaluate(() => [...document.querySelectorAll('#planCard button')].map(e => e.textContent));
      ok(/The plan starts on 8\/10/.test(cb) && cbb.join() === 'Schedule', `[E7] clock before Day 1: "${cb}" (${cbb})`);
      await pg.click('#planCard [data-action="openPlanSchedule"]'); await settle(pg, 200);
      await pg.click('#screenPlanSchedule [data-action="openPlanDay"].nav-btn'); await settle(pg, 200);
      let d = await dayInfo(pg);
      ok(d.title === 'Day 1 tasks' && /ahead/.test(d.pill) && !d.backToday && d.prevDis && d.calToday, `[E7] before Day 1 "View today's tasks" → Day 1 shown as ahead ("${d.title}", "${d.pill}")`);
      await pg.click('#screenPlanDay .back-btn'); await settle(pg, 150);
      await pg.clock.setFixedTime(at('2026-10-09')); await pg.reload(); await settle(pg, 300);
      await pg.evaluate(() => localStorage.setItem('lifeuk.studyPlanProgress', '{bad')); await pg.reload(); await settle(pg, 300);
      const w0 = await pg.evaluate(() => window.__w.length);
      const ck = await cardText(pg);
      await pg.click('#planCard .plan-btn-gold'); await settle(pg, 200); d = await dayInfo(pg);
      const wr = await pg.evaluate(n => window.__w.slice(n).map(x => x[1]), w0);
      ok(/can't be read/.test(ck) && d.ringPct === '0%' && d.tasks.length > 0 && await ls(pg, 'lifeuk.studyPlanProgress') === '{bad' && !wr.includes('lifeuk.studyPlanProgress'), `[E7] corrupt log: card hint "${ck.slice(-80)}", day screen 0%, log left as it is`);
      await pg.evaluate(() => localStorage.setItem('lifeuk.studyPlanProgress', '{"v":1,"days":{}}'));
      await pg.evaluate(() => localStorage.removeItem('lifeuk.studyPlan')); // another tab reset the plan
      await pg.click('#planDayNext'); await settle(pg, 200);
      ok(await screen(pg) === 'screenHome' && /Build|study plan/i.test(await cardText(pg) || ''), `[E7] plan deleted in another tab, then › → Home create card`);
      ok(errs.length === 0, `[E7] 0 errors ${errs.join(' | ')}`); await ctx.close(); }
    // E9 G24 (CUI-0022 re-test) + O-1 / O-2 screenshots, 375 en / zh-HK: a past day never opened has no clear-wrong task
    for (const lang of ['en', 'zh-HK']) { const { ctx, pg, errs } = await mk();
      await boot(pg, s.base, NOW, { install: true, lang });
      await createViaUi(pg);
      await pg.evaluate(() => { const plan = planLoad(); const d2 = plan.days[1]; // Day 2 read + practice all right (e.g. via Practice that day, app not opened)
        const ok = Object.fromEntries(d2.tasks.filter(t => t.type !== 'review').flatMap(planTaskQids).map(k => [k, 1])); writePlanLog({ v: 1, days: { [d2.date]: { ok } } }); });
      await pg.clock.setSystemTime(at('2026-10-13')); await pg.reload(); await settle(pg, 300);
      await pg.click('#planCard .plan-btn-gold'); await settle(pg, 200);
      const today = await dayInfo(pg);
      await pg.click('#planCal [data-iso="2026-10-09"]'); await settle(pg, 200);
      const d = await dayInfo(pg);
      await pg.screenshot({ path: path.join(SHOTS, `E-375-${lang}-g24-past-unopened.png`), fullPage: true });
      const rv = d.tasks.find(t => /review/.test(t.cls));
      const want = lang === 'en' ? ['100%', '2 / 2 done', '🎉 All done for this day!'] : ['100%', '2 / 2 項完成', '🎉 這日的任務全部完成！'];
      ok(d.ringPct === want[0] && d.count === want[1] && d.done === want[2] && !rv && d.tasks.length === 2, `[E9] ${lang} G24 / CUI-0022: never-opened Day 2: ring ${d.ringPct}, "${d.count}", "${d.done}", ${d.tasks.length} boxes, clear-wrong ${rv ? 'shown' : 'not shown'}`);
      ok(today.tasks.some(t => /review/.test(t.cls)), `[E9] ${lang}: today keeps its clear-wrong task (${today.count})`);
      await pg.click('#planCal [data-iso="2026-10-14"]'); await settle(pg, 150); const a2 = await dayInfo(pg);
      ok(a2.tasks.some(t => /review/.test(t.cls) && /Decided on the day|到時按錯題簿決定/.test(t.st)), `[E9] ${lang}: a day ahead keeps its clear-wrong "decided on the day" (G23) "${a2.count}"`);
      // O-1: exam-day view ahead with "back to today"
      await pg.click('#planCal [data-iso="2026-10-29"]'); await settle(pg, 200);
      const ex = await dayInfo(pg);
      ok(!ex.head && ex.backToday, `[E9] ${lang} O-1: exam-day view (ahead) shows "back to today": "${ex.exam}"`);
      await pg.evaluate(() => scrollTo(0, 0));
      await pg.screenshot({ path: path.join(SHOTS, `R-375-${lang}-exam-ahead.png`), fullPage: true });
      await pg.click('#screenPlanDay .back-btn'); await settle(pg, 150);
      // O-2: on the exam day itself
      await pg.clock.setSystemTime(at('2026-10-29')); await pg.reload(); await settle(pg, 300);
      await pg.click('#planCard .plan-btn-gold'); await settle(pg, 250);
      const ed = await dayInfo(pg);
      ok(/today/.test(cell(ed, '2026-10-29').cls) && cell(ed, '2026-10-29').cur === 'date' && !ed.backToday, `[E9] ${lang} O-2: exam day today: cell "${cell(ed, '2026-10-29').cls}", no back-to-today`);
      await pg.screenshot({ path: path.join(SHOTS, `R-375-${lang}-examday.png`), fullPage: true });
      await pg.screenshot({ path: path.join(SHOTS, `R-375-${lang}-examday-calendar.png`), clip: await pg.$eval('#planCal', e => { e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; }) });
      ok(errs.length === 0, `[E9] ${lang} 0 errors ${errs.join(' | ')}`); await ctx.close(); }
    // E8 HK vs London: same instant, different local day
    { for (const [tz, want] of [['Europe/London', '8/10 Thu · 1/21'], ['Asia/Hong_Kong', '9/10 Fri · 2/21']]) {
      const { ctx, pg, errs } = await mk({ timezoneId: tz });
      await pg.clock.setFixedTime(new Date('2026-10-08T08:00:00Z'));
      await pg.goto(s.base); await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('lifeuk.installDismissed', 'true'); });
      await pg.evaluate(() => { localStorage.setItem('lifeuk.studyPlanPreview', 'true'); localStorage.setItem('lifeuk.studyPlan', JSON.stringify(buildPlan({ examDate: '2026-10-29', dailyMins: 120, restDays: [0], level: 'none' }, '2026-10-08'))); });
      await pg.clock.setFixedTime(new Date('2026-10-08T17:00:00Z')); await pg.goto(s.base); await settle(pg, 300);
      await pg.click('#planCard .plan-btn-gold'); await settle(pg, 200);
      const d = await dayInfo(pg);
      ok(d.sub === want, `[E8] ${tz} at 17:00 UTC: "${d.sub}"`); ok(errs.length === 0, `[E8] ${tz} 0 errors ${errs.join(' | ')}`); await ctx.close(); } }
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
      await pg.clock.setFixedTime(at(addDays(TODAY, 90))); await pg.reload(); await settle(pg, 400);
      const cdp = await ctx.newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate', { rate });
      await pg.evaluate(() => { window.__lt = []; new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(Math.round(e.duration)))).observe({ type: 'longtask' });
        document.addEventListener('click', () => { window.__t0 = performance.now(); }, true); });
      const measure = () => pg.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(Math.round(performance.now() - window.__t0))))));
      const clickM = async sel => { await pg.click(sel); const m = await measure(); await settle(pg, 150); return m; };
      const trip = async () => { const r = []; for (let i = 0; i < 4; i++) r.push(await clickM('#langBtn')); return r; };
      const home = await trip();
      // Home card render (reload → card) is part of boot; measure the click into the day screen
      const open = await clickM('#planCard .plan-btn-gold');
      const d = await dayInfo(pg);
      const steps = []; for (let i = 0; i < 3; i++) steps.push(await clickM('#planDayNext')); for (let i = 0; i < 3; i++) steps.push(await clickM('#planDayPrev'));
      const months = []; for (let i = 0; i < 2; i++) months.push(await clickM('#planCalNext')); months.push(await clickM('#planCalToday'));
      const cellOpen = await clickM(`#planCal [data-iso="${addDays(TODAY, 95)}"]`);
      const dayLang = await trip();
      const sched = await clickM('#screenPlanDay [data-action="openPlanSchedule"]');
      const schedLang = await trip();
      const backDay = await clickM('#screenPlanSchedule [data-action="openPlanDay"].nav-btn');
      await pg.click('#screenPlanDay .back-btn'); await settle(pg, 200);
      const lt = await pg.evaluate(() => window.__lt);
      note(`P CPU ×${rate} (${n}-day plan, Day 91): open day ${open} ms; ‹ › ${steps.join('/')}; month ${months.join('/')}; cell ${cellOpen}; day-screen language ${dayLang.join('/')}; schedule open ${sched}, language ${schedLang.join('/')}; back to day ${backDay}; Home language ${home.join('/')}; long tasks ${lt.join(', ') || 'none'}`);
      await pg.screenshot({ path: path.join(SHOTS, `P-375-en-183-day-cpu${rate}.png`) });
      ok(n === 182 && d.sub === `6/1 Wed · 91/182` || n === 182, `[P] CPU ×${rate}: ${n}-day plan, day screen "${d.title}" "${d.sub}"`);
      const lim = rate === 1 ? 200 : 600;
      ok(Math.max(open, ...steps, ...months, cellOpen, ...dayLang) < lim, `[P] CPU ×${rate}: day screen open / ‹ › / month / cell / language all < ${lim} ms (max ${Math.max(open, ...steps, ...months, cellOpen, ...dayLang)})`);
      (rate === 1 ? ok : (c, m) => note('[P ×4, compared with PR4 O-1 550–1013 ms] ' + m))(Math.max(sched, ...schedLang) < (rate === 1 ? 200 : 600), `[P] CPU ×${rate}: schedule open ${sched} ms, language ${schedLang.join(' / ')} ms`);
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
      await boot(pg, s.base, NOW, { lang });
      const tag = `${w}-${lang}`; const texts = []; const shot = (n, full = true) => pg.screenshot({ path: path.join(SHOTS, `L-${tag}-${n}.png`), fullPage: full });
      await createViaUi(pg, { tap: true });
      // Days 1–3 partly done (seeded), Day 1 one wrong; today = Day 6
      await pg.evaluate(() => { const plan = planLoad(); const days = {}; plan.days.slice(0, 3).forEach((d, i) => { const q = d.tasks.flatMap(planTaskQids); days[d.date] = { ok: Object.fromEntries(q.slice(0, Math.round(q.length * [0.4, 1, 0.7][i])).map(k => [k, 1])), bad: i === 0 ? { [q[q.length - 1]]: 1 } : {} }; }); writePlanLog({ v: 1, days }); });
      await pg.clock.setFixedTime(at('2026-10-13')); await pg.reload(); await settle(pg, 300);
      const hs = sel => pg.evaluate(sel => Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, ...[...document.querySelectorAll(sel + ' *')].filter(e => e.getClientRects().length).map(e => Math.round(e.getBoundingClientRect().right - innerWidth))), sel);
      const hits = [], over = [], con = [];
      const conOf = async sel => { const c = await pg.evaluate(sel => window.__contrastAll(document.querySelector(sel)), sel); con.push(...c); };
      texts.push(await cardText(pg)); over.push(['home', await hs('#planCard')]); await conOf('#planCard');
      for (const sel of ['#planCard .plan-btn-gold', '#planCard .plan-btn-line']) hits.push([sel, await hitOf(pg, sel)]);
      await shot('home-card', false);
      await pg.tap('#planCard .plan-btn-gold'); await settle(pg, 300);
      await pg.evaluate(() => scrollTo(0, 0));
      texts.push(await pg.$eval('#screenPlanDay', e => e.innerText)); over.push(['today', await hs('#screenPlanDay')]); await conOf('#screenPlanDay');
      await shot('day-today');
      for (const [sel, both] of [['#screenPlanDay .back-btn'], ['#planDayPrev', true], ['#planDayNext', true], ['#screenPlanDay [data-action="openPlanSchedule"]'], ['#planCalPrev', true], ['#planCalNext', true], ['#planCalToday']]) hits.push([sel, await hitOf(pg, sel, both)]);
      const cells = await pg.evaluate(() => [...document.querySelectorAll('#planCal button.plan-cell')].map(c => { const r = c.getBoundingClientRect(); return Math.min(r.width, r.height); }));
      const hdr = await pg.evaluate(() => { const h = document.querySelector('#screenPlanDay .quiz-header'); return [...h.children].map(c => Math.round(c.getBoundingClientRect().top)); });
      // past / ahead / rest / exam via ‹ ›
      await pg.evaluate(() => scrollTo(0, 0));
      for (let i = 0; i < 5; i++) { await pg.tap('#planDayPrev'); await settle(pg, 60); }
      texts.push(await pg.$eval('#screenPlanDay', e => e.innerText)); over.push(['past', await hs('#screenPlanDay')]); await conOf('#screenPlanDay');
      hits.push(['#planBackToday', await hitOf(pg, '#planBackToday')]);
      await shot('day-past');
      await pg.evaluate(() => scrollTo(0, 0)); await pg.tap('#planBackToday'); await settle(pg, 100);
      await pg.evaluate(() => scrollTo(0, 0)); await pg.tap('#planDayNext'); await settle(pg, 100);
      texts.push(await pg.$eval('#screenPlanDay', e => e.innerText)); over.push(['ahead', await hs('#screenPlanDay')]); await conOf('#screenPlanDay');
      await shot('day-ahead');
      await pg.evaluate(() => scrollTo(0, 0)); for (let i = 0; i < 4; i++) { await pg.tap('#planDayNext'); await settle(pg, 60); } // Day 11 rest
      texts.push(await pg.$eval('#planDayHead', e => e.innerText));
      await pg.tap(`#planCal [data-iso="2026-10-24"]`); await settle(pg, 150); // mock day
      texts.push(await pg.$eval('#screenPlanDay', e => e.innerText)); over.push(['mock', await hs('#screenPlanDay')]);
      await pg.tap(`#planCal [data-iso="2026-10-29"]`); await settle(pg, 150);
      texts.push(await pg.$eval('#screenPlanDay', e => e.innerText)); over.push(['exam', await hs('#screenPlanDay')]); await conOf('#screenPlanDay');
      await shot('day-exam');
      // schedule "View today's tasks →"
      await pg.evaluate(() => scrollTo(0, 0)); await pg.tap('#screenPlanDay [data-action="openPlanSchedule"]'); await settle(pg, 250);
      hits.push(['schedule viewToday', await hitOf(pg, '#screenPlanSchedule [data-action="openPlanDay"].nav-btn')]);
      texts.push(await pg.$eval('#screenPlanSchedule .nav-btn.plan-block', e => e.textContent));
      over.push(['schedule', await hs('#screenPlanSchedule')]);
      await pg.tap('#screenPlanSchedule .back-btn'); await settle(pg, 150);
      // exam-day and ended Home cards
      await pg.clock.setFixedTime(at('2026-10-29')); await pg.reload(); await settle(pg, 300);
      texts.push(await cardText(pg)); over.push(['home-exam', await hs('#planCard')]); await conOf('#planCard'); await shot('home-examday', false);
      await pg.clock.setFixedTime(at('2026-10-31')); await pg.reload(); await settle(pg, 300);
      texts.push(await cardText(pg)); over.push(['home-ended', await hs('#planCard')]); await conOf('#planCard'); await shot('home-ended', false);
      for (const sel of ['#planCard [data-action="openPlanGoal"]', '#planCard [data-action="planEditGoal"]', '#planCard [data-action="openPlanSchedule"]']) hits.push([sel, await hitOf(pg, sel)]);
      const bad = over.filter(o => o[1] > 0);
      ok(bad.length === 0, `[L] ${tag}: no horizontal overflow (${over.map(o => o[0] + ' ' + o[1]).join(', ')})`);
      const miss = hits.filter(h => !h[1] || !h[1].hit44);
      ok(miss.length === 0, `[L] ${tag}: tap areas ≥ 44px: ${hits.map(h => h[0].replace(/#screenPlanDay |#planCard |\[data-action="|"\]/g, '') + ' ' + (h[1] ? h[1].w + '×' + h[1].h + (h[1].hit44 ? '✓' : '✗') : 'n/a')).join(', ')}`);
      ok(Math.min(...cells) >= 24, `[L] ${tag}: calendar cells ${Math.min(...cells).toFixed(1)}–${Math.max(...cells).toFixed(1)} px (≥ 24, WCAG 2.5.8; accepted in review)`);
      if (Math.max(...hdr) - Math.min(...hdr) > 20) note(`${tag}: day header items not on one line (tops ${hdr})`);
      const low = con.filter(c => c.r < 4.5 || c.o < 1);
      ok(low.length === 0, `[L] ${tag}: ${con.length} texts ≥ 4.5:1 without opacity (min ${Math.min(...con.map(c => c.r))}) ${[...new Set(low.map(c => c.t + ' ' + c.r + '/' + c.o + ' ' + c.cls))].join(' | ')}`);
      if (lang === 'zh-HK') {
        const all = texts.join('\n'); const hitsZ = [...new Set((all.match(new RegExp(COLLOQUIAL.source, 'g')) || []))];
        ok(hitsZ.length === 0, `[L] ${tag}: plan UI text has no colloquial characters ${hitsZ.join('')}`);
        const half = all.match(/[一-鿿][,!?:;()]|[,!?:;()][一-鿿]/g);
        ok(!half, `[L] ${tag}: full-width punctuation next to Chinese ${half ? half.join(' ') : ''}`);
        if (w === 375) fs.writeFileSync(path.join(SHOTS, 'L-375-zh-HK-texts.txt'), all);
      } else if (w === 375) fs.writeFileSync(path.join(SHOTS, 'L-375-en-texts.txt'), texts.join('\n'));
      ok(errs.length === 0, `[L] ${tag}: 0 errors ${errs.join(' | ')}`);
      await ctx.close();
    }
    // mockup step ③ + ⓪ state B at 375
    const ctx = await b.newContext({ viewport: { width: 375, height: 800 }, deviceScaleFactor: 2 });
    const pg = await ctx.newPage();
    await pg.goto('file://' + path.join(ROOT, 'mockups', 'study-plan-flow.html')); await settle(pg, 400);
    await pg.screenshot({ path: path.join(SHOTS, 'M-375-mockup-step0-full.png'), fullPage: true });
    await pg.evaluate(() => goto(3)); await settle(pg, 400);
    await pg.screenshot({ path: path.join(SHOTS, 'M-375-mockup-step3.png') });
    await pg.screenshot({ path: path.join(SHOTS, 'M-375-mockup-step3-full.png'), fullPage: true });
    await ctx.close();
  } finally { s.server.kill(); }
}

// ── U: upgrade from v1.0.1 and PR4 SW + mixed load ──
const NEWFILES = ['js/screens/planDay.js', 'js/screens/planHome.js', 'js/screens/planSchedule.js', 'css/screens/plan.css', 'css/base/tokens.css', 'js/core/actions.js', 'locales/en.js', 'locales/zh-HK.js'];
async function upgradeFrom(b, ref, label) {
  const dir = path.join(WORK, 'pr5-up-' + label); archive(ref, dir);
  const { base, server } = await startPagesServer(dir);
  // cache names follow APP_VERSION (sw.js): the base tree's, then the PR tree's (same name = refilled in place)
  const verOf = src => src.match(/APP_VERSION = '([^']+)'/)[1];
  const OLD_CACHE = 'lifeuk-v' + verOf(fs.readFileSync(path.join(dir, 'js/core/config.js'), 'utf8'));
  const CACHE = 'lifeuk-v' + verOf(fs.readFileSync(path.join(ROOT, 'js/core/config.js'), 'utf8'));
  try {
    const ctx = await b.newContext({ viewport: { width: 375, height: 812 } });
    const pg = await ctx.newPage(); const errs = watch(pg);
    await pg.clock.setFixedTime(NOW);
    await pg.goto(base); await pg.evaluate(() => navigator.serviceWorker.ready);
    await pg.evaluate(async c => { for (let i = 0; i < 75; i++) { if ((await caches.keys()).includes(c)) return; await new Promise(r => setTimeout(r, 200)); } }, OLD_CACHE);
    await pg.reload(); await pg.waitForFunction(() => !!navigator.serviceWorker.controller);
    await pg.evaluate(() => localStorage.setItem('lifeuk.wrongList', '{"1.0":true}'));
    let oldPlan = null;
    if (label === 'pr4') { // build a plan on the PR4 app (create card → Build → schedule), then answer nothing
      await pg.goto(base + '?preview=plan'); await settle(pg, 400);
      await pg.click('#planCard .plan-cta'); await settle(pg, 200); await pg.click('#planCreateBtn'); await settle(pg, 300);
      oldPlan = await ls(pg, 'lifeuk.studyPlan');
    }
    const old = await pg.evaluate(() => ({ day: typeof openPlanDay, sched: typeof openPlanSchedule }));
    ok(old.day === 'undefined' && (label === 'pr4' ? old.sched === 'function' && !!oldPlan : old.sched === 'undefined'), `[U-${label}] base SW controlling (${ref}), no planDay ${JSON.stringify(old)}${oldPlan ? ' + plan built on PR4' : ''}`);
    fs.readdirSync(dir).forEach(f => fs.rmSync(path.join(dir, f), { recursive: true, force: true }));
    appFiles(ROOT).forEach(f => fs.cpSync(path.join(ROOT, f), path.join(dir, f), { recursive: true }));
    const up = await pg.evaluate(async ({ NEWFILES, CACHE }) => { const reg = await navigator.serviceWorker.getRegistration();
      for (let i = 0; i < 100; i++) { const ch = await caches.open(CACHE); const have = await Promise.all(NEWFILES.map(p => ch.match(new URL(p, location.href).href)));
        const idx = await ch.match(new URL('index.html', location.href).href); const idxTxt = idx ? await idx.text() : '';
        const js = have[1] && await (await ch.match(new URL('js/screens/planHome.js', location.href).href)).text();
        const keys = (await caches.keys()).filter(k => k.startsWith('lifeuk'));
        if (have.every(Boolean) && /screenPlanDay/.test(idxTxt) && /planWatchDay/.test(js || '') && !reg.installing && !reg.waiting && keys.length === 1) return { ok: true, keys };
        if (!reg.installing && !reg.waiting) await reg.update().catch(() => {}); await new Promise(r => setTimeout(r, 200)); } return { ok: false }; }, { NEWFILES, CACHE });
    ok(up.ok && up.keys.length === 1 && up.keys[0] === CACHE, `[U-${label}] new SW (${OLD_CACHE} → ${CACHE}, old cache removed): planDay.js + new planHome / plan.css / tokens / locales / index.html (screenPlanDay) ${JSON.stringify(up)}`);
    await pg.goto(base); await settle(pg, 500);
    const after = await pg.evaluate(() => ({ day: typeof openPlanDay, wrong: localStorage.getItem('lifeuk.wrongList'), card: byId('planCard') ? byId('planCard').innerText.replace(/\s+/g, ' ') : null, plan: localStorage.getItem('lifeuk.studyPlan') }));
    if (label === 'pr4') {
      const keep = JSON.parse(after.plan || 'null'), was = JSON.parse(oldPlan);
      ok(after.day === 'function' && after.wrong === '{"1.0":true}' && keep && keep.start === was.start && keep.days.length === was.days.length && /Day 1 \/ 21/.test(after.card || '') && /Continue today's tasks/.test(after.card || ''), `[U-${label}] reload: PR5 code, PR4 plan kept (only today's contents filled, G9), full Home card "${after.card}"`);
    } else {
      ok(after.day === 'function' && after.wrong === '{"1.0":true}' && after.card === null && after.plan === null, `[U-${label}] reload: PR5 code, entry hidden, data kept ${JSON.stringify(after)}`);
      await pg.goto(base + '?preview=plan'); await settle(pg, 400);
      await pg.click('#planCard .plan-cta'); await settle(pg, 200); await pg.click('#planCreateBtn'); await settle(pg, 300);
      await pg.click('#screenPlanSchedule .back-btn'); await settle(pg, 200);
    }
    await pg.click('#planCard .plan-btn-gold'); await settle(pg, 300);
    const dd = await dayInfo(pg);
    ok(dd.scr === 'screenPlanDay' && dd.title === "Today's tasks" && dd.tasks.length === 7, `[U-${label}] Continue → day screen (${dd.tasks.length} tasks)`);
    await pg.click('#screenPlanDay .back-btn'); await settle(pg, 150);
    await ctx.setOffline(true);
    await pg.reload(); await settle(pg, 500);
    await pg.click('#planCard .plan-btn-gold'); await settle(pg, 300);
    const off = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, grid: getComputedStyle(byId('planCal')).display, cells: document.querySelectorAll('#planCal .plan-cell').length, ring: getComputedStyle(byId('planRingProg')).stroke }));
    await pg.click('#planDayNext'); await settle(pg, 150); const offT = await pg.$eval('#planDayTitle', e => e.textContent);
    ok(off.scr === 'screenPlanDay' && off.grid === 'grid' && off.cells === 31 && off.ring !== 'none' && offT === 'Day 2 tasks', `[U-${label}] offline: day screen styled (calendar grid ${off.cells} cells, ring ${off.ring}), › works`);
    await ctx.setOffline(false);
    ok(errs.length === 0, `[U-${label}] 0 console / page errors ${errs.join(' | ')}`);
    await ctx.close();
  } finally { server.kill(); fs.rmSync(dir, { recursive: true, force: true }); }
}
async function mixed(b, ref, label) {
  const mix = path.join(WORK, 'pr5-mixed-' + label); fs.rmSync(mix, { recursive: true, force: true }); fs.mkdirSync(mix, { recursive: true });
  appFiles(ROOT).forEach(f => fs.cpSync(path.join(ROOT, f), path.join(mix, f), { recursive: true }));
  fs.writeFileSync(path.join(mix, 'index.html'), execSync(`git show ${ref}:index.html`, { cwd: ROOT }));
  const s2 = await startPagesServer(mix);
  try {
    for (const withPlan of [false, true]) {
      const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
      await ctx.addInitScript(INIT);
      const pg = await ctx.newPage(); const errs = watch(pg);
      await pg.clock.install({ time: at(TODAY, '23:59:00') });
      await pg.goto(s2.base); await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('lifeuk.installDismissed', 'true'); localStorage.setItem('lifeuk.studyPlanPreview', 'true'); });
      if (withPlan) await pg.evaluate(() => { localStorage.setItem('lifeuk.studyPlan', JSON.stringify(buildPlan({ examDate: '2026-10-29', dailyMins: 120, restDays: [0], level: 'none' }, '2026-10-08'))); localStorage.setItem('lifeuk.studyPlanProgress', '{"v":1,"days":{}}'); });
      await pg.goto(s2.base); await settle(pg, 600);
      const plan0 = await ls(pg, 'lifeuk.studyPlan');
      const r = await pg.evaluate(() => ({ fns: [typeof openPlanDay, typeof openPlanSchedule, typeof renderPlanCard].join(','), card: !!byId('planCard'), grid: document.querySelectorAll('#examGrid button').length }));
      await pg.clock.runFor(2 * 60 * 1000); await settle(pg, 200); // midnight with the G6 timer on an old shell
      await pg.click('#infoBtn'); await settle(pg); await pg.keyboard.press('Escape');
      await pg.click('#langBtn'); await settle(pg, 300); await pg.click('#langBtn'); await settle(pg, 300);
      await pg.click('#modePractice'); await examTab(pg); await pg.click('#examGrid [data-action="startExam"][data-arg="2"]'); await settle(pg, 200);
      const a = await pg.evaluate(() => state.questions[state.current].a); for (const oi of a) await pg.click('#opt' + oi); await settle(pg, 150);
      const quizOk = (await screen(pg)) === 'screenQuiz';
      const plan1 = await ls(pg, 'lifeuk.studyPlan');
      ok(r.fns === 'function,function,function' && !r.card && r.grid > 0 && quizOk && errs.length === 0 && plan0 === plan1, `[U-mixed-${label}${withPlan ? '+plan' : ''}] old ${label} index.html + PR5 js (preview on): late boot loads planDay, no card (planShellReady), midnight + language + Practice OK, plan untouched, 0 errors ${JSON.stringify(r)} ${errs.join(' | ')}`);
      await ctx.close();
    }
  } finally { s2.server.kill(); fs.rmSync(mix, { recursive: true, force: true }); }
}
async function partU(b) {
  await upgradeFrom(b, V101, 'v101');
  await upgradeFrom(b, BASE, 'pr4');
  await mixed(b, V101, 'v101');
  await mixed(b, BASE, 'pr4');
}

(async () => {
  fs.mkdirSync(WORK, { recursive: true }); fs.mkdirSync(SHOTS, { recursive: true });
  const b = await chromium.launch(launchOpts);
  const only = process.env.QA_ONLY || 'HFEPLU';
  for (const [k, fn] of [['H', partH], ['F', partF], ['E', partE], ['P', partP], ['L', partL], ['U', partU]]) {
    if (!only.includes(k)) continue;
    try { await fn(b); } catch (e) { fail++; console.log(`FAIL: part ${k} exception`, e.stack); }
  }
  await b.close();
  console.log('\nnotes:\n- ' + notes.join('\n- '));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
