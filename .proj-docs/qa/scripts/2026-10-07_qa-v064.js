// QA v0.64 batch (CUI-0011 double tap guard, S-035 / S-036 guard internals, S-034 form control font, W-012 Practise
// padding, S-031 node helper move, version / SW) — manual, not part of run-all.sh. Writes screenshots.
//   NODE_PATH=/opt/node-tools/node_modules CHROMIUM_PATH=/opt/pw-browsers/chromium \
//     node .proj-docs/qa/scripts/2026-10-07_qa-v064.js <repo-root> <screenshot-dir> [base-ref=984d374]
// QA_ONLY=section,section limits the run.
//
// S-039: since v0.64 a pointer click within 40px of a click that changed the view, less than 350ms after it, is
// swallowed by the double tap guard. Every "normal flow" step below that clicks right after a screen change either
// waits GUARD_WAIT (> 350ms) or clicks somewhere else first; the E9 cases do the opposite on purpose.
const { chromium } = require('playwright-core');
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ROOT = path.resolve(process.argv[2] || '.');
const SHOT_DIR = path.resolve(process.argv[3] || '.');
const BASE_REF = process.argv[4] || '984d374';
const { startPagesServer } = require(path.join(ROOT, 'tests', 'pages-server.js'));
const APP_URL = 'file://' + path.join(ROOT, 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
let pass = 0, fail = 0;
const failures = [];
const ok = (c, m) => { if (c) { pass++; console.log('ok:', m); } else { fail++; failures.push(m); console.log('FAIL:', m); } };
const note = (...a) => console.log('  note:', ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const GUARD_WAIT = 450; // > SCREEN_CHANGE_CLICK_GUARD_MS (350)
const TOUCH = w => ({ viewport: { width: w, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36' });
const shot = n => path.join(SHOT_DIR, `2026-10-07_v064_${n}.png`);
const card = id => `#studyContent .fact[data-fact-id="${id}"]`;
const W012_IDS = [25, 30, 62, 67, 74, 76, 78, 128, 155, 159, 181, 225, 231];
// deterministic Math.random so base and HEAD render the same question / option order
const SEED_SCRIPT = `(() => { let s = 0x2f6b1c3d; Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();`;

let BASE_DIR = null;
const BASE_URL = () => 'file://' + path.join(BASE_DIR, 'index.html');

function watchErrors(pg) {
  const errs = [];
  pg.on('pageerror', e => errs.push('pageerror: ' + e.message));
  pg.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  return errs;
}
async function fresh(b, w, opts = {}, url = APP_URL) {
  const ctx = await b.newContext({ viewport: { width: w, height: 844 }, ...opts }); const pg = await ctx.newPage(); const errs = watchErrors(pg);
  if (opts.seed) await pg.addInitScript(SEED_SCRIPT);
  await pg.goto(url); await pg.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await pg.reload();
  return { ctx, pg, errs };
}
const writes = pg => pg.evaluate(() => ({ answered: Object.keys(state.answers).length, revealed: Object.keys(state.revealed).length,
  streak: localStorage.getItem('lifeuk.practiceStreak'), wrong: localStorage.getItem('lifeuk.wrongList'), screen: document.querySelector('.screen.active').id,
  side: typeof isSideSession === 'function' && isSideSession(), ex: state.examNum }));
const clearPractice = pg => pg.evaluate(() => { localStorage.removeItem('lifeuk.practiceStreak'); localStorage.removeItem('lifeuk.wrongList'); streaks = {}; wrongList = {}; });
const optionAt = (pg, x, y) => pg.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return !!(e && e.closest('[data-action="selectOption"]')); }, [x, y]);
const center = (pg, sel) => pg.$eval(sel, e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
async function second(pg, touch, x, y, gap) { if (touch) { await pg.touchscreen.tap(x, y); await sleep(gap); await pg.touchscreen.tap(x, y); } else await pg.mouse.dblclick(x, y); }

// ══════════ 7. version / SW ══════════
async function versionCheck(b) {
  const { base, server } = await startPagesServer(ROOT);
  try {
    const ctx = await b.newContext(); const pg = await ctx.newPage();
    await pg.goto(base);
    ok(await pg.evaluate(() => APP_VERSION) === '0.64', 'APP_VERSION === 0.64');
    ok((await pg.textContent('#appVersion')) === 'v0.64', 'header shows v0.64');
    await pg.evaluate(() => navigator.serviceWorker.ready);
    await pg.waitForFunction(async () => (await caches.keys()).includes('lifeuk-v0.64'), null, { timeout: 15000 }).catch(() => {});
    const keys = await pg.evaluate(() => caches.keys());
    ok(keys.length === 1 && keys[0] === 'lifeuk-v0.64', `SW cache = lifeuk-v0.64 only (${keys})`);
    const cached = await pg.evaluate(async () => { const c = await caches.open('lifeuk-v0.64');
      return Promise.all(['js/core/actions.js', 'js/core/config.js', 'css/base/layout.css', 'css/components/fact.css', 'js/components/tags.js'].map(async f => !!(await c.match(f)))); });
    ok(cached.every(Boolean), `changed files are in the installed SW cache (${cached})`);
    await ctx.close();
  } finally { server.kill(); }
  const diffFiles = execSync(`git diff --name-only ${BASE_REF} HEAD -- index.html sw.js`, { cwd: ROOT }).toString().trim();
  ok(diffFiles === '', `index.html / sw.js unchanged since ${BASE_REF} (no new file, SHELL unchanged): "${diffFiles}"`);
}

// ══════════ 2. S-035 / S-036 guard internals ══════════
async function guardInternals(b) {
  const src = fs.readFileSync(path.join(ROOT, 'js/core/actions.js'), 'utf8');
  ok(/clickGuard = \{ view, x: e\.clientX, y: e\.clientY, at: e\.timeStamp \}/.test(src), 'S-035: guard.at = first tap e.timeStamp (not performance.now())');
  ok(!/performance\.now/.test(src), 'S-035: actions.js has no performance.now()');
  ok(/dt >= 0 && dt < SCREEN_CHANGE_CLICK_GUARD_MS/.test(src), 'S-035: condition is 0 <= dt < SCREEN_CHANGE_CLICK_GUARD_MS');
  ok(!/\b(let|const|var|function)\s+(guard|currentView|sameView)\b/.test(execSync('cat js/*/*.js js/*.js', { cwd: ROOT, shell: '/bin/bash' }).toString()), 'S-036: no top-level guard / currentView / sameView anywhere in js/');
  const { ctx, pg, errs } = await fresh(b, 390);
  const g = await pg.evaluate(() => ({ clickGuard: typeof clickGuard, view: typeof clickGuardView, same: typeof isSameClickView,
    guard: typeof guard, currentView: typeof currentView, sameView: typeof sameView, ms: SCREEN_CHANGE_CLICK_GUARD_MS, slop: DOUBLE_TAP_SLOP_PX }));
  ok(g.clickGuard === 'object' && g.view === 'function' && g.same === 'function', `S-036: clickGuard / clickGuardView / isSameClickView exist (${JSON.stringify(g)})`);
  ok(g.guard === 'undefined' && g.currentView === 'undefined' && g.sameView === 'undefined', 'S-036: old globals guard / currentView / sameView do not exist');
  ok(g.ms === 350 && g.slop === 40, `constants 350ms / 40px (${g.ms} / ${g.slop})`);
  // arm the guard with a real click on Home › By Exam cell 1, then probe dt / slop boundaries with synthetic clicks
  await pg.evaluate(() => { startMode(PRACTICE_MODE); setPracticeView('exam'); });
  const cell = await center(pg, '#screenHome [data-action="startExam"][data-arg="1"]');
  await pg.mouse.click(cell.x, cell.y);
  const armed = await pg.evaluate(() => clickGuard && { at: clickGuard.at, x: clickGuard.x, y: clickGuard.y, scr: clickGuard.view[0].id });
  ok(armed && armed.scr === 'screenQuiz', `real click on an exam cell arms the guard on the quiz (${JSON.stringify(armed)})`);
  const probe = (dt, dx = 0, dy = 0) => pg.evaluate(([dt, dx, dy]) => {
    const g0 = { ...clickGuard };
    state.answers = {}; state.revealed = {}; renderQuestion();
    const opt = byId('opt0');
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1, clientX: g0.x + dx, clientY: g0.y + dy });
    clickGuard = { ...g0, at: ev.timeStamp - dt };
    opt.dispatchEvent(ev);
    const answered = Object.keys(state.answers).length;
    clickGuard = g0;
    return answered;
  }, [dt, dx, dy]);
  const rows = [];
  for (const [dt, dx, dy, want] of [[0, 0, 0, 0], [200, 0, 0, 0], [349.9, 0, 0, 0], [350, 0, 0, 1], [351, 0, 0, 1], [-0.1, 0, 0, 1], [-60000, 0, 0, 1],
    [100, 40, 0, 0], [100, 0, -40, 0], [100, 28, 28, 0], [100, 29, 29, 1], [100, 41, 0, 1], [100, 0, 41, 1]]) {
    const a = await probe(dt, dx, dy); rows.push(`dt ${dt} d(${dx},${dy}) → ${a ? 'runs' : 'blocked'}`);
    ok(a === want, `E-new1/2 boundary: dt=${dt}ms, offset (${dx}, ${dy}) → ${want ? 'runs' : 'blocked'} (answered ${a})`);
  }
  // detail 0 (keyboard / el.click()) at the same point is never blocked
  const kb = await pg.evaluate(() => { const g0 = { ...clickGuard }; state.answers = {}; state.revealed = {}; renderQuestion();
    const ev = new MouseEvent('click', { bubbles: true, detail: 0, clientX: g0.x, clientY: g0.y }); clickGuard = { ...g0, at: ev.timeStamp };
    byId('opt0').dispatchEvent(ev); clickGuard = g0; return Object.keys(state.answers).length; });
  ok(kb === 1, `detail 0 click at the guard point, dt 0 → runs (${kb})`);
  // confirm modal at the guard point is exempt
  const modal = await pg.evaluate(() => { const g0 = { ...clickGuard }; resetPracticeProgress(); const open1 = isConfirmOpen();
    const ev = new MouseEvent('click', { bubbles: true, detail: 1, clientX: g0.x, clientY: g0.y }); clickGuard = { ...g0, at: ev.timeStamp };
    byId('confirmCancel').dispatchEvent(ev); return { open1, open2: isConfirmOpen(), same: isSameClickView(g0.view, clickGuardView()) }; });
  ok(modal.open1 && !modal.open2 && modal.same, `confirm modal Keep at the guard point, dt 0, same view → runs (${JSON.stringify(modal)})`);
  ok(errs.length === 0, 'guard internals — no page errors ' + errs.join('|'));
  await ctx.close();
}

// ══════════ 1a. E9 reproduction (v0.63 script, Study ▶ Practise, 5 heights) ══════════
async function e9StudyRun(b, url, w, touch, gap) {
  const { ctx, pg, errs } = await fresh(b, w, touch ? TOUCH(w) : {}, url);
  await pg.evaluate(() => { openStudy(); studySetTab('chapters'); studySetChapter(3); });
  const res = [];
  for (const yc of [150, 300, 450, 600, 750]) {
    await clearPractice(pg);
    await pg.evaluate(() => { state.examNum = null; state.answers = {}; state.revealed = {}; });
    // put the button's centre at viewport y = yc
    await pg.evaluate(t => { const el = document.querySelector('#studyContent .fact[data-fact-id="21"] .fact-practise'); const r = el.getBoundingClientRect(); window.scrollTo(0, scrollY + r.top + r.height / 2 - t); }, yc);
    const p = await pg.locator(`${card(21)} .fact-practise`).boundingBox();
    const x = p.x + p.width / 2, y = p.y + p.height / 2;
    await second(pg, touch, x, y, gap);
    await sleep(100);
    const r = await writes(pg);
    res.push({ y: Math.round(y), onOpt: await optionAt(pg, x, y), ...r });
    await pg.evaluate(() => { leaveToHome(); openStudy(); });
    await sleep(GUARD_WAIT);
  }
  await ctx.close();
  return { res, errs };
}
async function e9Study(b) {
  for (const [w, touch, gap] of [[390, true, 120], [390, true, 50], [390, false, 0], [900, false, 0], [900, true, 120]]) {
    const { res, errs } = await e9StudyRun(b, APP_URL, w, touch, gap);
    const label = `${w} ${touch ? `touch (gap ${gap}ms)` : 'mouse dblclick'}`;
    note(`E9 Study ${label}:`, JSON.stringify(res.map(r => ({ y: r.y, onOpt: r.onOpt, ex: r.ex, a: r.answered, s: r.streak, wl: r.wrong }))));
    const bad = res.filter(r => r.answered || r.revealed || r.streak !== null || r.wrong !== null || r.ex !== 'f21');
    ok(bad.length === 0, `E9 Study ▶ Practise ${label}: 5 heights (${res.filter(r => r.onOpt).length} with the 2nd tap on an option) → session f21 opened, Q1 unanswered, no streak / wrongList`);
    ok(errs.length === 0, `E9 Study ${label}: no page errors ` + errs.join('|'));
  }
  // control: the same runs on the v0.63 base reproduce the bug (proves the cases reach an option)
  for (const [w, touch, gap] of [[390, true, 120], [390, false, 0], [900, false, 0]]) {
    const { res } = await e9StudyRun(b, BASE_URL(), w, touch, gap);
    const hit = res.filter(r => r.answered > 0);
    note(`E9 control ${BASE_REF} ${w} ${touch ? 'touch' : 'mouse'}: ${hit.length}/5 answered Q1`, JSON.stringify(hit.map(r => ({ y: r.y, s: r.streak, wl: r.wrong }))));
    ok(hit.length > 0, `E9 control: ${BASE_REF} ${w} ${touch ? 'touch' : 'mouse'} still reproduces (${hit.length}/5 answered Q1)`);
  }
}

// ══════════ 1b. Home › By Exam: every cell, Practice and Exam mode ══════════
async function e9HomeRun(b, url, w, touch, mode) {
  const { ctx, pg, errs } = await fresh(b, w, touch ? TOUCH(w) : {}, url);
  const cells = await pg.evaluate(m => { startMode(m); setPracticeView('exam'); return [...document.querySelectorAll('#screenHome [data-action="startExam"]')].map(e => e.dataset.arg); }, mode);
  const res = [];
  for (const arg of cells) {
    await clearPractice(pg);
    await pg.evaluate(([m]) => { leaveToHome(); state.examNum = null; state.answers = {}; state.revealed = {}; startMode(m); setPracticeView('exam'); window.scrollTo(0, 0); }, [mode]);
    const sel = `#screenHome [data-action="startExam"][data-arg="${arg}"]`;
    await pg.$eval(sel, e => e.scrollIntoView({ block: 'center' }));
    const p = await center(pg, sel);
    await second(pg, touch, p.x, p.y, 120);
    await sleep(80);
    const r = await writes(pg);
    res.push({ arg, onOpt: await optionAt(pg, p.x, p.y), ...r });
    await pg.evaluate(() => stopExamTimer());
    await sleep(GUARD_WAIT);
  }
  await ctx.close();
  return { res, errs };
}
async function e9Home(b) {
  for (const [w, touch, mode] of [[390, true, 'practice'], [390, false, 'practice'], [900, false, 'practice'], [900, true, 'practice'], [390, true, 'exam']]) {
    const { res, errs } = await e9HomeRun(b, APP_URL, w, touch, mode);
    const label = `${w} ${touch ? 'touch' : 'mouse'} ${mode}`;
    const hitOpt = res.filter(r => r.onOpt).length;
    const bad = res.filter(r => r.answered || r.revealed || r.streak !== null || r.wrong !== null || r.screen !== 'screenQuiz' || String(r.ex) !== r.arg);
    note(`E9 Home ${label}: ${res.length} cells, ${hitOpt} with the 2nd tap on an option; bad`, JSON.stringify(bad));
    ok(bad.length === 0, `E9 Home By Exam ${label}: ${res.length} cells (${hitOpt} on an option) → that exam opened, Q1 unanswered, no storage writes`);
    ok(errs.length === 0, `E9 Home ${label}: no page errors ` + errs.join('|'));
  }
  for (const [w, touch] of [[390, true], [900, false]]) {
    const { res } = await e9HomeRun(b, BASE_URL(), w, touch, 'practice');
    const hit = res.filter(r => r.answered > 0);
    ok(hit.length > 0, `E9 control: ${BASE_REF} Home ${w} ${touch ? 'touch' : 'mouse'} reproduces (${hit.length}/${res.length} cells answered Q1: ${hit.map(r => r.arg)})`);
  }
}

// align a trigger's centre with option A of the screen it opens
async function alignOn(pg, triggerSel, openFn, reopenFn) {
  const o = await pg.evaluate(fn => { new Function(fn)(); const r = byId('opt0').getBoundingClientRect(); return { y: r.top + r.height / 2, top: r.top, bottom: r.bottom, left: r.left, right: r.right }; }, openFn);
  await pg.evaluate(fn => new Function(fn)(), reopenFn);
  return pg.evaluate(([s, o]) => {
    const el = document.querySelector(s); const r0 = el.getBoundingClientRect();
    window.scrollTo(0, window.scrollY + r0.top + r0.height / 2 - o.y);
    const r = el.getBoundingClientRect(); const x = Math.max(r.left + 4, Math.min(r.right - 4, (o.left + o.right) / 2)); const y = r.top + r.height / 2;
    return { x, y, onOption: y > o.top && y < o.bottom && x > o.left && x < o.right, hits: document.elementFromPoint(x, y)?.closest(s) === el };
  }, [triggerSel, o]);
}
const OPEN_SIMILAR = `localStorage.clear(); streaks = {}; wrongList = {}; clearSideSession(); pendingMode = PRACTICE_MODE; startExam(4);
  state.current = state.questions.findIndex(q => q.origIdx === 15); renderQuestion();
  const q = state.questions[state.current]; state.answers[state.current] = [...q.a]; revealAnswer();`;
const SIMILAR_BTN = '#similarBox .sqm-cta [data-action="startSimilarPractice"]';
const FACT_BTN = '#studyContent [data-action="startFactPractice"][data-arg="21"]';
const OPEN_STUDY = `localStorage.clear(); streaks = {}; wrongList = {}; clearSideSession(); leaveToHome(); openStudy(); studySetTab('chapters'); studySetChapter(3);`;
const EXAM_BTN = '#screenHome [data-action="startExam"][data-arg="1"]';
const OPEN_HOME = `localStorage.clear(); streaks = {}; wrongList = {}; clearSideSession(); leaveToHome(); startMode(PRACTICE_MODE); setPracticeView('exam');`;

// ══════════ 1c. Similar "Practise these N" + aligned triggers: double tap vs human-speed second tap ══════════
async function e9Aligned(b) {
  const cases = [
    ['Similar Practise these N', SIMILAR_BTN, OPEN_SIMILAR + ' startSimilarPractice();', OPEN_SIMILAR, 420],
    ['Study ▶ Practise #21', FACT_BTN, OPEN_STUDY + ' startFactPractice(21);', OPEN_STUDY, 844],
    ['Home By Exam 1', EXAM_BTN, OPEN_HOME + ' pendingMode = PRACTICE_MODE; startExam(1);', OPEN_HOME, 844],
  ];
  for (const w of [390, 900]) for (const touch of [false, true]) {
    for (const [name, sel, openFn, reopenFn, h] of cases) {
      const opts = touch ? { ...TOUCH(w), viewport: { width: w, height: h } } : { viewport: { width: w, height: h } };
      const { ctx, pg, errs } = await fresh(b, w, opts);
      const label = `${name} ${w} ${touch ? 'touch' : 'mouse'}`;
      let p = await alignOn(pg, sel, openFn, reopenFn);
      if (!p.hits || !p.onOption) { note(`${label}: cannot align trigger with option A (${JSON.stringify(p)}) — skipped`); await ctx.close(); continue; }
      const before = await pg.evaluate(() => [localStorage.getItem('lifeuk.practiceStreak'), localStorage.getItem('lifeuk.wrongList')]);
      await second(pg, touch, p.x, p.y, 120);
      let r = await writes(pg);
      const ls = [r.streak, r.wrong];
      ok(r.screen === 'screenQuiz' && r.answered === 0 && r.revealed === 0 && JSON.stringify(ls) === JSON.stringify(before) && (name.startsWith('Similar') ? r.side : true),
        `E9 ${label}: double ${touch ? 'tap' : 'click'} on the aligned point → new session, Q1 unanswered, storage unchanged (${JSON.stringify({ a: r.answered, side: r.side, ex: r.ex })})`);
      // triple tap: the third tap inside the window is ignored too
      await sleep(GUARD_WAIT);
      p = await alignOn(pg, sel, openFn, reopenFn);
      if (touch) { await pg.touchscreen.tap(p.x, p.y); await sleep(80); await pg.touchscreen.tap(p.x, p.y); await sleep(80); await pg.touchscreen.tap(p.x, p.y); }
      else await pg.mouse.click(p.x, p.y, { clickCount: 3, delay: 0 }).catch(async () => { await pg.mouse.click(p.x, p.y); await pg.mouse.click(p.x, p.y); await pg.mouse.click(p.x, p.y); });
      r = await writes(pg);
      ok(r.answered === 0, `E-new3 ${label}: triple ${touch ? 'tap' : 'click'} → Q1 unanswered (${r.answered})`);
      // human speed: second tap > 350ms later acts on the new screen
      await sleep(GUARD_WAIT);
      p = await alignOn(pg, sel, openFn, reopenFn);
      if (touch) await pg.touchscreen.tap(p.x, p.y); else await pg.mouse.click(p.x, p.y);
      await sleep(GUARD_WAIT);
      // the quiz order is random (startExam shuffles), so check the point is really on an option of the question shown
      const onOpt = await optionAt(pg, p.x, p.y);
      if (touch) await pg.touchscreen.tap(p.x, p.y); else await pg.mouse.click(p.x, p.y);
      r = await writes(pg);
      if (!onOpt) { note(`${label}: human-speed check — this run's Q1 has no option under the point (gap between options); answered ${r.answered}`); ok(errs.length === 0, `${label}: no page errors ` + errs.join('|')); await ctx.close(); continue; }
      ok(r.answered === 1 && r.revealed === 1 && r.streak !== null, `${label}: second tap ${GUARD_WAIT}ms later answers option A as normal (${JSON.stringify({ a: r.answered, s: r.streak })})`);
      ok(errs.length === 0, `${label}: no page errors ` + errs.join('|'));
      await ctx.close();
    }
  }
}

// ══════════ 1d. Back-navigation double taps (new edge cases): fact session ↩ Back, side session ↩ Back, last Next → results, Retry ══════════
async function e9Back(b) {
  for (const touch of [false, true]) {
    const w = 390; const { ctx, pg, errs } = await fresh(b, w, touch ? TOUCH(w) : {});
    const dbl = async sel => { const p = await center(pg, sel); await second(pg, touch, p.x, p.y, 100); return p; };
    // fact session ↩ Back: the second tap lands on Study (could be a Practise / bookmark / ✓ under it)
    for (const top of [150, 300, 450, 600]) {
      await pg.evaluate(t => { localStorage.clear(); streaks = {}; wrongList = {}; leaveToHome(); openStudy(); studySetTab('chapters'); studySetChapter(3);
        const el = document.querySelector('#studyContent .fact[data-fact-id="21"]'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - t);
        startFactPractice(21); state.current = state.questions.length - 1; const q = state.questions[state.current]; state.answers[state.current] = [...q.a]; revealAnswer(); renderQuestion(); }, top);
      await pg.$eval('#nextBtn', e => e.scrollIntoView({ block: 'center' }));
      const marks0 = await pg.evaluate(() => [localStorage.getItem('lifeuk.studyBookmarks'), localStorage.getItem('lifeuk.studyMastered')]);
      const p = await dbl('#nextBtn');
      await sleep(80);
      const under = await pg.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); const a = e && e.closest('[data-action]'); return a ? a.dataset.action : null; }, [p.x, p.y]);
      const r = await pg.evaluate(() => ({ screen: document.querySelector('.screen.active').id, ret: sessionReturn, ex: state.examNum, marks: [localStorage.getItem('lifeuk.studyBookmarks'), localStorage.getItem('lifeuk.studyMastered')] }));
      ok(r.screen === 'screenStudy' && r.ret === null && JSON.stringify(r.marks) === JSON.stringify(marks0),
        `E-new4 ${touch ? 'touch' : 'mouse'} fact session ↩ Back double tap (top ${top}, under 2nd tap on Study: ${under}) → stays on Study, no new session, marks unchanged`);
      await sleep(GUARD_WAIT);
    }
    // side session ↩ Back: the second tap lands on the original question (Similar panel / Practise these N)
    await pg.setViewportSize({ width: w, height: 844 });
    await pg.evaluate(fn => new Function(fn)(), OPEN_SIMILAR + ' startSimilarPractice(); state.current = state.questions.length - 1; const q2 = state.questions[state.current]; state.answers[state.current] = [...q2.a]; revealAnswer(); renderQuestion();');
    const orig = await pg.evaluate(() => state.questions.length);
    await pg.$eval('#nextBtn', e => e.scrollIntoView({ block: 'center' }));
    await dbl('#nextBtn');
    await sleep(80);
    let r = await writes(pg);
    ok(!r.side && r.screen === 'screenQuiz', `E-new5 ${touch ? 'touch' : 'mouse'} side session ↩ Back double tap → back in the original session, not a new side session (side ${r.side}, was ${orig} q)`);
    await sleep(GUARD_WAIT);
    // last Next → results: the second tap must not hit Retry / ← Home on the results page
    await pg.evaluate(() => { localStorage.clear(); clearSideSession(); pendingMode = PRACTICE_MODE; startExam(2);
      state.questions.forEach((q, i) => { state.answers[i] = [...q.a]; }); state.current = state.questions.length - 1; revealAnswer(); renderQuestion(); });
    const qs = await pg.evaluate(() => { window.__qs = state.questions; return true; });
    await pg.$eval('#nextBtn', e => e.scrollIntoView({ block: 'center' }));
    const pn = await dbl('#nextBtn');
    await sleep(80);
    const under = await pg.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); const a = e && e.closest('[data-action]'); return a ? a.dataset.action : null; }, [pn.x, pn.y]);
    r = await pg.evaluate(() => ({ screen: document.querySelector('.screen.active').id, same: state.questions === window.__qs }));
    ok(qs && r.screen === 'screenResult' && r.same, `E-new6 ${touch ? 'touch' : 'mouse'} last-question Next double tap → results, not restarted / left (under 2nd tap: ${under}; ${JSON.stringify(r)})`);
    await sleep(GUARD_WAIT);
    // Retry: double tap → new session, Q1 unanswered
    await pg.$eval('#screenResult .retry-btn:not([hidden])', e => e.scrollIntoView({ block: 'center' })).catch(() => {});
    const retrySel = await pg.evaluate(() => { const v = [...document.querySelectorAll('#screenResult .retry-btn')].find(e => e.offsetParent); v.id = 'qaRetry'; return '#qaRetry'; });
    await pg.$eval(retrySel, e => e.scrollIntoView({ block: 'center' }));
    const pr = await dbl(retrySel);
    await sleep(80);
    r = await writes(pg);
    ok(r.screen === 'screenQuiz' && r.answered === 0, `E-new7 ${touch ? 'touch' : 'mouse'} Retry double tap → new session, Q1 unanswered (2nd tap on option: ${await optionAt(pg, pr.x, pr.y)}; answered ${r.answered})`);
    ok(errs.length === 0, `back-navigation ${touch ? 'touch' : 'mouse'}: no page errors ` + errs.join('|'));
    await ctx.close();
  }
}

// ══════════ 1e. Normal flow not affected ══════════
async function normalFlow(b) {
  for (const w of [390, 900]) {
    const { ctx, pg, errs } = await fresh(b, w);
    // quick option then Next (Practice), opened by a real click; first click elsewhere right away
    await pg.evaluate(() => { startMode(PRACTICE_MODE); setPracticeView('exam'); });
    await pg.click(EXAM_BTN);
    const farOpt = await pg.evaluate(() => { const c = clickGuard; let best = null;
      for (const e of document.querySelectorAll('[data-action="selectOption"]')) { const r = e.getBoundingClientRect(); const d = Math.hypot(r.left + r.width / 2 - c.x, r.top + r.height / 2 - c.y); if (d > 40 && (!best || d > best.d)) best = { id: e.id, d }; }
      return best; });
    await pg.click('#' + farOpt.id);
    let s = await writes(pg);
    ok(s.answered === 1 && (s.revealed === 1 || await pg.evaluate(() => state.questions[0].a.length > 1)), `${w}: right after a click opened the quiz, an option away from that point answers at once (${farOpt.id}, ${farOpt.d.toFixed(0)}px, ${JSON.stringify(s)}, multi ${await pg.evaluate(() => state.questions[0].a.length)})`);
    await pg.click('#nextBtn');
    ok(await pg.evaluate(() => state.current) === 1, `${w}: quick Next after the answer moves on`);
    await pg.click('#opt0'); await pg.click('#nextBtn');
    ok(await pg.evaluate(() => state.current === 2 && Object.keys(state.answers).length === 2), `${w}: option + immediate Next on the same screen both count`);
    // exam mode: dots / Next twice
    await pg.evaluate(() => { leaveToHome(); startMode(EXAM_MODE); setPracticeView && setPracticeView('exam'); });
    await sleep(GUARD_WAIT);
    await pg.click(EXAM_BTN);
    await sleep(GUARD_WAIT);
    await pg.click('#nextBtn'); await pg.click('#nextBtn');
    ok(await pg.evaluate(() => state.current) === 2, `${w}: exam: two quick Next clicks`);
    await pg.click('#navDots .dot >> nth=5'); await pg.click('#navDots .dot >> nth=9');
    ok(await pg.evaluate(() => state.current) === 9, `${w}: exam: quick question-dot clicks`);
    await pg.click('#quickPrev'); await pg.click('#quickPrev');
    ok(await pg.evaluate(() => state.current) === 7, `${w}: exam: two quick ← move back two`);
    await pg.click('#quickNext'); await pg.click('#quickNext');
    ok(await pg.evaluate(() => state.current) === 9, `${w}: exam: two quick → move on two`);
    // keyboard Enter / Space at the guard point right after a pointer open
    await pg.evaluate(() => { stopExamTimer(); leaveToHome(); startMode(PRACTICE_MODE); setPracticeView('exam'); });
    await sleep(GUARD_WAIT);
    await pg.click(EXAM_BTN);
    await pg.focus('#opt0'); await pg.keyboard.press('Enter');
    s = await writes(pg);
    ok(s.answered === 1, `${w}: keyboard Enter on an option right after a click opened the quiz`);
    await pg.focus('#nextBtn'); await pg.keyboard.press(' ');
    await pg.focus('#opt1'); await pg.keyboard.press('Enter'); await pg.focus('#nextBtn'); await pg.keyboard.press('Enter');
    ok(await pg.evaluate(() => state.current) === 2, `${w}: keyboard Space / Enter on Next and options`);
    // confirm modal: exam running, ← Home → Leave modal; Keep then ← Home → Leave, clicked right away
    await pg.evaluate(() => { leaveToHome(); startMode(EXAM_MODE); setPracticeView('exam'); });
    await sleep(GUARD_WAIT);
    await pg.click(EXAM_BTN);
    await pg.click('#screenQuiz .back-btn');
    ok(await pg.evaluate(() => isConfirmOpen()), `${w}: ← Home right after opening an exam asks to leave`);
    await pg.click('#confirmCancel');
    ok(!(await pg.evaluate(() => isConfirmOpen())) && (await writes(pg)).screen === 'screenQuiz', `${w}: modal Keep at once`);
    await pg.click('#screenQuiz .back-btn'); await pg.click('#confirmOk');
    ok((await writes(pg)).screen === 'screenHome', `${w}: modal Leave at once → Home`);
    // Submit via modal (pointer) → results; then result dots (wait, then quick clicks), and a dot away from the Submit point at once
    await sleep(GUARD_WAIT);
    await pg.click(EXAM_BTN);
    await sleep(GUARD_WAIT);
    await pg.evaluate(() => { state.questions.forEach((q, i) => { if (i % 3) state.answers[i] = [...q.a]; }); state.current = state.questions.length - 1; renderQuestion(); });
    await pg.click('#nextBtn');
    ok(await pg.evaluate(() => isConfirmOpen()), `${w}: Finish asks to submit`);
    await pg.click('#confirmOk');
    ok((await writes(pg)).screen === 'screenResult', `${w}: modal Submit → results`);
    const dots = await pg.$$eval('#resultDots [data-action="jumpToReview"]', ds => ds.map(d => d.dataset.arg));
    const okBox = await pg.evaluate(() => ({ x: clickGuard.x, y: clickGuard.y }));
    const farDot = await pg.evaluate(c => { const ds = [...document.querySelectorAll('#resultDots [data-action="jumpToReview"]')];
      return ds.map(d => { const r = d.getBoundingClientRect(); return { arg: d.dataset.arg, d: Math.hypot(r.left + r.width / 2 - c.x, r.top + r.height / 2 - c.y) }; }).filter(o => o.d > 40)[0]; }, okBox);
    if (farDot) { await pg.click(`#resultDots [data-arg="${farDot.arg}"]`); ok(await pg.evaluate(a => byId('rv' + a)?.classList.contains('hl'), farDot.arg), `${w}: result dot away from the Submit point works at once (#${farDot.arg})`); }
    await sleep(GUARD_WAIT);
    await pg.evaluate(() => window.scrollTo(0, 0));
    for (const a of [dots[3], dots[10]]) { await pg.click(`#resultDots [data-arg="${a}"]`); }
    ok(await pg.evaluate(a => byId('rv' + a)?.classList.contains('hl'), dots[10]), `${w}: quick result-dot clicks (last one highlights)`);
    // timer: the real exam timer runs out → results; same point clicked inside the window acts on the results page
    await pg.evaluate(() => { leaveToHome(); startMode(EXAM_MODE); setPracticeView('exam'); window.scrollTo(0, 0); });
    await sleep(GUARD_WAIT);
    const cellP = await center(pg, EXAM_BTN);
    await pg.mouse.click(cellP.x, cellP.y);
    // the timer's own tick ends the exam (as when time runs out), then a pointer click at the opening point, inside the window
    const lapse = await pg.evaluate(() => { examDeadline = Date.now() - 1; examTick();
      const scr = document.querySelector('.screen.active').id; const g = clickGuard; const dot = document.querySelector('#resultDots [data-action="jumpToReview"]');
      const ev = new MouseEvent('click', { bubbles: true, detail: 1, clientX: g.x, clientY: g.y }); const dt = ev.timeStamp - g.at;
      const stray = isStrayClick(ev, dot); dot.dispatchEvent(ev);
      return { scr, dt: Math.round(dt), stray, sameView: isSameClickView(g.view, clickGuardView()), hl: byId('rv' + dot.dataset.arg)?.classList.contains('hl') }; });
    note(`${w}: timer lapse`, JSON.stringify(lapse));
    ok(lapse.scr === 'screenResult' && lapse.dt < 350 && !lapse.stray && !lapse.sameView && lapse.hl, `${w}: time up (examTick) → results; a click at the opening point ${lapse.dt}ms later is not stray, result dot works (${JSON.stringify(lapse)})`);
    // Study tabs: opened by a click; quick tab switches; then far-away tab at once
    await pg.evaluate(() => { leaveToHome(); window.scrollTo(0, 0); });
    await sleep(GUARD_WAIT);
    await pg.click('#modeStudy');
    for (const tab of ['timeline', 'geo', 'people', 'chapters']) await pg.click(`.study-tab[data-tab="${tab}"]`);
    ok(await pg.evaluate(() => study.tab) === 'chapters', `${w}: Study opened by a click, 4 quick tab switches all count`);
    await pg.click('#studySubChips .chip[data-arg="2"]'); await pg.click('#studySubChips .chip[data-arg="4"]');
    ok(await pg.evaluate(() => study.chapter) === 4, `${w}: quick chapter chip clicks`);
    // Flagged: three flags, open via the tile, unflag one by one quickly (rows move up under the pointer)
    await pg.evaluate(() => { leaveToHome(); const ks = allQuestions().slice(0, 3).map(qKey); ks.forEach(k => setPracticeFlag(k, true)); leaveToHome(); startMode(PRACTICE_MODE); window.scrollTo(0, 0); });
    await sleep(GUARD_WAIT);
    await pg.click('#tileFlagged');
    await sleep(GUARD_WAIT);
    const p1 = await center(pg, '#screenFlagged [data-action="unflagFromList"]');
    for (let i = 0; i < 3; i++) await pg.mouse.click(p1.x, p1.y);
    const left = await pg.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('lifeuk.practiceFlags') || '{}')).filter(k => JSON.parse(localStorage.getItem('lifeuk.practiceFlags'))[k]).length);
    ok(left === 0, `${w}: Flagged — three quick unflags at the same point all count (${left} left)`);
    ok(errs.length === 0, `${w}: normal flow — no page errors ` + errs.join('|'));
    await ctx.close();
  }
}

// ══════════ 3. S-034 font + sizes vs base, 4. W-012, 5. S-031 ══════════
const STATES = {
  home: `leaveToHome();`,
  homeExam: `leaveToHome(); startMode(PRACTICE_MODE); setPracticeView('exam');`,
  homeChapter: `leaveToHome(); startMode(PRACTICE_MODE); setPracticeView('chapter');`,
  install: `leaveToHome(); byId('installBanner').hidden = false; byId('installBanner').style.display = 'flex';`,
  quizPractice: OPEN_SIMILAR,
  quizExam: `leaveToHome(); pendingMode = EXAM_MODE; startExam(2); stopExamTimer(); state.current = 3; renderQuestion();`,
  result: `leaveToHome(); pendingMode = EXAM_MODE; startExam(3); stopExamTimer(); state.questions.forEach((q, i) => { if (i % 2) state.answers[i] = [...q.a]; }); finishExam();`,
  flagged: `leaveToHome(); allQuestions().slice(0, 4).map(qKey).forEach(k => setPracticeFlag(k, true)); openFlagged();`,
  studyCh3: `leaveToHome(); openStudy(); studySetTab('chapters'); studySetChapter(3);`,
  studyTimeline: `leaveToHome(); openStudy(); studySetTab('timeline');`,
  studyPeople: `leaveToHome(); openStudy(); studySetTab('people');`,
  modal: `leaveToHome(); resetPracticeProgress();`,
};
const COLLECT = () => {
  const bodyFont = getComputedStyle(document.body).fontFamily;
  const els = [...document.querySelectorAll('button, input, select, textarea')].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
  const linesOf = e => { const rg = document.createRange(); rg.selectNodeContents(e); return new Set([...rg.getClientRects()].filter(x => x.width > 0).map(x => Math.round(x.bottom))).size; };
  return { bodyFont, docW: document.documentElement.scrollWidth, vw: innerWidth, els: els.map(e => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e);
    return { key: (e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + [...e.classList].join('.')) + '|' + (e.dataset.arg || '') + '|' + e.textContent.trim().slice(0, 24),
      font: c.fontFamily, w: r.width, h: r.height, lines: linesOf(e), rowLines: Math.max(...[...e.parentElement.children].filter(x => x.tagName === e.tagName).map(linesOf)), ov: c.overflow, sw: e.scrollWidth, cw: e.clientWidth, sh: e.scrollHeight, ch: e.clientHeight, right: r.right, left: r.left, ws: c.whiteSpace }; }) };
};
async function collect(b, url, w, stateCode) {
  const { ctx, pg } = await fresh(b, w, { seed: true }, url);
  await pg.evaluate(fn => new Function(fn)(), stateCode);
  await sleep(50);
  const r = await pg.evaluate(COLLECT);
  await ctx.close();
  return r;
}
async function fontAndSizes(b) {
  const wrappedTotal = [];
  for (const w of [320, 390, 900]) {
    const summary = [];
    for (const [name, code] of Object.entries(STATES)) {
      const head = await collect(b, APP_URL, w, code); const base = await collect(b, BASE_URL(), w, code);
      const badFont = head.els.filter(e => e.font !== head.bodyFont).map(e => e.key);
      ok(badFont.length === 0, `S-034 ${w} ${name}: all ${head.els.length} button / input font-family = body (${badFont.slice(0, 3)})`);
      // label spills / is cut: wider content than the box, or (overflow not visible) taller; a 2px glyph ascent overflow on an
      // overflow:visible control (ⓘ) and the ::before tap rings (fact buttons, Practise) are not truncation
      const cut = e => e.sw > e.cw + 1 || (e.ov !== 'visible' && e.sh > e.ch + 1);
      const baseCut = new Set(base.els.filter(cut).map(e => e.key));
      const newCut = head.els.filter(e => cut(e) && !baseCut.has(e.key)).map(e => `${e.key} ${e.sw}/${e.cw}×${e.sh}/${e.ch}`);
      ok(newCut.length === 0 && head.els.every(e => e.right <= w + 0.5 && e.left >= -0.5), `S-034 ${w} ${name}: no control spills / is cut, none past the viewport (${newCut.slice(0, 3)})`);
      ok(head.docW <= Math.max(w, base.docW), `S-034 ${w} ${name}: no new horizontal page overflow (doc ${head.docW}, base ${base.docW})`);
      if (head.docW > w) note(`${w} ${name}: page scrollWidth ${head.docW} > ${w} (base ${base.docW})`);
      // height delta per control (matched by key + order)
      const bmap = {}; base.els.forEach(e => { (bmap[e.key] = bmap[e.key] || []).push(e); });
      const deltas = [];
      head.els.forEach(e => { const m = bmap[e.key] && bmap[e.key].shift(); if (m) deltas.push({ key: e.key, dh: +(e.h - m.h).toFixed(2), dw: +(e.w - m.w).toFixed(2), lines: e.lines, baseLines: m.lines, rowLines: e.rowLines }); });
      // +1..2px per text line; a control whose label now wraps onto more lines is listed separately (observation)
      const wrapped = deltas.filter(d => d.lines > d.baseLines);
      if (wrapped.length) note(`S-034 ${w} ${name}: label wraps onto more lines than at ${BASE_REF}:`, wrapped.map(d => `${d.key.replace(/\s+/g, ' ')} ${d.baseLines}→${d.lines} lines +${d.dh}px`).join('; '));
      wrappedTotal.push(...wrapped.map(d => `${w} ${name} ${d.key.split('|')[0]} ${d.baseLines}→${d.lines}`));
      const outOfRange = deltas.filter(d => d.lines <= d.baseLines && (d.dh < -0.01 || d.dh > 1.5 * Math.max(1, d.rowLines) + 0.51));
      summary.push(`${name}: n=${deltas.length} dh ${Math.min(...deltas.map(d => d.dh))}..${Math.max(...deltas.map(d => d.dh))}`);
      ok(outOfRange.length === 0, `S-034 ${w} ${name}: every control's height changed by 0..+1.5px per text line (row's tallest label) vs ${BASE_REF} (${outOfRange.slice(0, 3).map(d => d.key + ' ' + d.dh).join('; ')})`);
    }
    note(`S-034 ${w} height deltas:`, summary.join(' | '));
  }
  note(`S-034: controls whose label wraps onto an extra line (${wrappedTotal.length}):`, wrappedTotal.join('; '));
}

// hit areas vs base: fact buttons (CUI-0009), Practise (S-030), install ✕ (S-022), quick nav, dots
const HIT = () => {
  const at = (x, y, el) => { const e = document.elementFromPoint(x, y); return !!e && (e === el || el.contains(e)); };
  const span = (el, axis) => { const r = el.getBoundingClientRect(); const mid = axis === 'v' ? r.left + r.width / 2 : r.top + r.height / 2; const out = [];
    const lo = axis === 'v' ? r.top : r.left, hi = axis === 'v' ? r.bottom : r.right;
    for (let d = Math.floor(lo) - 15; d <= Math.ceil(hi) + 15; d += 0.5) if (axis === 'v' ? at(mid, d, el) : at(d, mid, el)) out.push(d);
    return out.length ? +(out[out.length - 1] - out[0] + 0.5).toFixed(1) : 0; };
  return (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { w: +r.width.toFixed(2), h: +r.height.toFixed(2), hv: span(el, 'v'), hh: span(el, 'h') }; };
};
async function hitAreas(b) {
  const groups = [
    ['studyCh3', `const e = document.querySelector('#studyContent .fact[data-fact-id="21"]'); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 300);`,
      [`${card(21)} .fact-btn.star`, `${card(21)} .fact-btn.tick`, `${card(21)} .fact-practise`]],
    ['install', '', ['#installBanner .install-close', '#installBtn']],
    ['quizExam', '', ['#quickPrev', '#quickNext', '#navDots .dot', '#flagBtn', '#nextBtn', '#prevBtn']],
    ['result', '', ['#resultDots .rdot']],
  ];
  for (const w of [390, 900]) for (const [st, extra, sels] of groups) {
    const run = async url => { const { ctx, pg } = await fresh(b, w, { seed: true }, url);
      await pg.evaluate(fn => new Function(fn)(), STATES[st] + extra); await sleep(50);
      const r = await pg.evaluate(([s, fn]) => { const f = new Function('return ' + fn)()(); return s.map(x => [x, f(x)]); }, [sels, HIT.toString()]);
      await ctx.close(); return r; };
    const head = await run(APP_URL), base = await run(BASE_URL());
    for (let i = 0; i < sels.length; i++) {
      const [s, h] = head[i], bb = base[i][1];
      if (!h) { note(`${w} ${s} not rendered`); continue; }
      const isPractise = s.endsWith('.fact-practise');
      const fixedSize = !/nextBtn|prevBtn|installBtn/.test(s);
      const sameHit = h.hv === bb.hv && (isPractise ? true : h.hh === bb.hh);
      const msg = `${w} ${s}: box ${h.w}×${h.h} (base ${bb.w}×${bb.h}), hit ${h.hh}×${h.hv} (base ${bb.hh}×${bb.hv})`;
      if (fixedSize) ok(sameHit && h.h === bb.h, `S-034 hit area unchanged — ${msg}`);
      else ok(h.hv >= bb.hv && h.hv - bb.hv <= 2, `S-034 hit height +0..2 — ${msg}`);
      if (/star|tick/.test(s)) ok(h.w === 32 && h.h === 32 && h.hv >= 44, `CUI-0009 ${w} ${s}: 32×32, tappable height ${h.hv} ≥ 44`);
      if (isPractise) ok(h.hv >= 44, `S-030 ${w} Practise tappable height ${h.hv} ≥ 44`);
    }
  }
}

async function factCardGeometry(b, url, w) {
  const { ctx, pg } = await fresh(b, w, {}, url);
  const r = await pg.evaluate(() => { openStudy(); studySetTab('chapters'); const out = {};
    for (const ch of CHAPTERS) { studySetChapter(ch);
      for (const e of document.querySelectorAll('#studyContent .fact')) {
        const nodes = [...e.querySelectorAll('.fact-src .sqm-node')]; const pr = e.querySelector('.fact-practise'); const src = e.querySelector('.fact-src');
        out[e.dataset.factId] = { h: +e.getBoundingClientRect().height.toFixed(2), rows: new Set(nodes.map(n => Math.round(n.getBoundingClientRect().top))).size,
          nodesH: +e.querySelector('.fact-src-nodes').getBoundingClientRect().height.toFixed(2), srcHtml: e.querySelector('.fact-src-nodes').innerHTML,
          btnTop: pr.getBoundingClientRect().top - nodes[0].getBoundingClientRect().top, wrap: src.classList.contains('wrap-btn'), prW: +pr.getBoundingClientRect().width.toFixed(2),
          nodeBoxes: nodes.map(n => { const b = n.getBoundingClientRect(); return [+b.width.toFixed(2), +b.height.toFixed(2)]; }) };
      } }
    return out; });
  await ctx.close();
  return r;
}
async function w012AndS031(b) {
  for (const w of [390, 900]) {
    const head = await factCardGeometry(b, APP_URL, w), base = await factCardGeometry(b, BASE_URL(), w);
    const ids = Object.keys(head);
    ok(ids.length === 236, `${w}: 236 fact cards measured`);
    const htmlDiff = ids.filter(id => head[id].srcHtml !== base[id].srcHtml);
    ok(htmlDiff.length === 0, `S-031 ${w}: source row nodes HTML identical to ${BASE_REF} for all 236 facts (${htmlDiff.slice(0, 5)})`);
    const nodeDiff = ids.filter(id => JSON.stringify(head[id].nodeBoxes) !== JSON.stringify(base[id].nodeBoxes));
    ok(nodeDiff.length === 0, `S-031 ${w}: every source node box identical (${nodeDiff.slice(0, 5)})`);
    const hDiff = ids.filter(id => Math.abs(head[id].h - base[id].h) > 0.01).map(id => `${id}:${(head[id].h - base[id].h).toFixed(2)}`);
    note(`${w}: fact cards whose height differs from ${BASE_REF}: ${hDiff.length}`, hDiff.slice(0, 20).join(' '));
    const rowsMore = ids.filter(id => head[id].rows > base[id].rows || head[id].nodesH > base[id].nodesH + 0.5);
    const rowsLess = ids.filter(id => head[id].rows < base[id].rows);
    ok(rowsMore.length === 0, `W-012 ${w}: no source row wraps onto more node lines than at ${BASE_REF} (${rowsMore.slice(0, 8).map(id => `${id} ${base[id].rows}→${head[id].rows}`)})`);
    if (rowsLess.length) note(`W-012 ${w}: source rows now on fewer lines than ${BASE_REF} (narrower Practise pill):`, rowsLess.map(id => `#${id} ${base[id].rows}→${head[id].rows} (card ${(head[id].h - base[id].h).toFixed(1)}px)`).join(', '));
    if (w === 390) {
      const bad = W012_IDS.filter(id => head[id].rows !== 1 || head[id].nodesH > 23 || Math.abs(head[id].btnTop) > 6 || head[id].wrap);
      ok(bad.length === 0, `W-012 390: the 13 facts (${W012_IDS.join(',')}) have their source row on one line, Practise inline (${bad.map(id => JSON.stringify({ id, rows: head[id].rows, nodesH: head[id].nodesH, btnTop: head[id].btnTop }))})`);
      note('W-012 390 #25', JSON.stringify({ h: head[25].h, base: base[25].h, nodesH: head[25].nodesH, prW: head[25].prW, basePrW: base[25].prW }));
      ok(Math.abs(head[25].h - 242) <= 3, `W-012 390: #25 card height ≈ 242 (${head[25].h}; base ${base[25].h})`);
      const tall = ids.filter(id => head[id].h - base[id].h > 3);
      ok(tall.length === 0, `W-012 390: no fact card grows more than 3px vs ${BASE_REF} (${tall.slice(0, 8)})`);
    } else {
      ok(hDiff.length === 0, `W-012 900: all 236 card heights identical to ${BASE_REF}`);
    }
  }
  // Practise tappable height on the 13 cards at 390 + a screenshot of #25 (HEAD and base)
  for (const [url, tag] of [[APP_URL, 'head'], [BASE_URL(), 'base']]) {
    const { ctx, pg } = await fresh(b, 390, {}, url);
    const hv = [];
    for (const id of W012_IDS) {
      const r = await pg.evaluate(([id, fn]) => { const f = STUDY.find(x => x.id === id); openStudy(); studySetTab('chapters'); studySetChapter(f.ch);
        const e = document.querySelector(`#studyContent .fact[data-fact-id="${id}"]`); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 250);
        return new Function('return ' + fn)()()(`#studyContent .fact[data-fact-id="${id}"] .fact-practise`); }, [id, HIT.toString()]);
      hv.push([id, r.hv]);
      if (id === 25) await pg.locator(card(25)).screenshot({ path: shot(`w012_fact25_390_${tag}`) });
    }
    if (tag === 'head') ok(hv.every(([, v]) => v >= 44), `W-012 390: Practise tappable height ≥ 44 on the 13 cards (${hv.map(x => x.join(':')).join(' ')})`);
    else note('base Practise tappable heights', hv.map(x => x.join(':')).join(' '));
    await ctx.close();
  }
  // Similar map: HTML + pixels identical to base, for every answered question of Exam 4 that has similars
  for (const w of [390, 900]) {
    const grab = async url => { const { ctx, pg } = await fresh(b, w, { seed: true }, url); const out = [];
      const n = await pg.evaluate(() => { pendingMode = PRACTICE_MODE; startExam(4); return state.questions.length; });
      for (let i = 0; i < n; i++) {
        const html = await pg.evaluate(i => { state.current = i; renderQuestion(); const q = state.questions[i]; state.answers[i] = [...q.a]; revealAnswer();
          const m = document.querySelector('#similarBox .sqm-map'); return m && byId('similarBox').classList.contains('show') ? m.outerHTML : null; }, i);
        if (!html) continue;
        const png = await pg.locator('#similarBox .sqm-map').screenshot({ animations: 'disabled' });
        const geo = await pg.evaluate(() => { const m = document.querySelector('#similarBox .sqm-map'); const r = m.getBoundingClientRect();
          return { y: +(r.top + scrollY).toFixed(3), w: +r.width.toFixed(2), h: +r.height.toFixed(2), nodes: [...m.children].map(n => { const b = n.getBoundingClientRect(); return [+(b.left - r.left).toFixed(2), +(b.top - r.top).toFixed(2), +b.width.toFixed(2), +b.height.toFixed(2)].join(','); }).join(' ') }; });
        out.push({ i, html, png, geo });
      }
      await ctx.close(); return out; };
    const head = await grab(APP_URL), base = await grab(BASE_URL());
    const htmlBad = head.filter((h, k) => !base[k] || base[k].html !== h.html).map(h => h.i);
    const pxBad = head.filter((h, k) => !base[k] || !base[k].png.equals(h.png)).map(h => h.i);
    ok(head.length > 0 && head.length === base.length && htmlBad.length === 0, `S-031 ${w}: Similar map HTML identical to ${BASE_REF} on ${head.length} questions with similars (${htmlBad})`);
    const geoBad = head.filter((h, k) => !base[k] || base[k].geo.w !== h.geo.w || base[k].geo.h !== h.geo.h || base[k].geo.nodes !== h.geo.nodes).map(h => h.i);
    ok(geoBad.length === 0, `S-031 ${w}: Similar map size and every node's position / size inside it identical to ${BASE_REF} (${geoBad})`);
    // a pixel difference with identical geometry comes from the map's page y (S-034 made the buttons above 1-2px taller), i.e. sub-pixel text rasterisation
    const pxNote = pxBad.map(i => { const h = head.find(x => x.i === i), bb = base[head.indexOf(h)]; return `Q${i}: page y ${bb.geo.y}→${h.geo.y}`; });
    ok(pxBad.every(i => { const h = head.find(x => x.i === i), bb = base[head.indexOf(h)]; return bb.geo.y !== h.geo.y; }), `S-031 ${w}: Similar map pixels identical except where the map sits at a different page y (${pxBad.length} of ${head.length}: ${pxNote.join('; ')})`);
    if (head[0]) fs.writeFileSync(shot(`s031_similar_map_${w}`), head[0].png);
  }
}

// ══════════ screenshots ══════════
async function shots(b) {
  for (const w of [390, 900]) {
    for (const [name, code] of [['studyCh3', STATES.studyCh3 + `const e = document.querySelector('#studyContent .fact[data-fact-id="21"]'); window.scrollTo(0, e.getBoundingClientRect().top + scrollY - 200);`],
      ['quizPractice', STATES.quizPractice], ['home', STATES.homeExam], ['result', STATES.result]]) {
      const { ctx, pg } = await fresh(b, w, { seed: true });
      await pg.evaluate(fn => new Function(fn)(), code); await sleep(100);
      await pg.screenshot({ path: shot(`${name}_${w}`) });
      await ctx.close();
    }
  }
  const { ctx, pg } = await fresh(b, 320, { seed: true });
  await pg.evaluate(fn => new Function(fn)(), STATES.studyCh3); await sleep(100);
  await pg.screenshot({ path: shot('studyCh3_320') });
  await ctx.close();
}

(async () => {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  BASE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeuk-qa064-base-'));
  execSync(`git archive ${BASE_REF} | tar -x -C "${BASE_DIR}"`, { cwd: ROOT, shell: '/bin/bash' });
  const b = await chromium.launch(launchOpts);
  const sections = { versionCheck, guardInternals, e9Study, e9Home, e9Aligned, e9Back, normalFlow, fontAndSizes, hitAreas, w012AndS031, shots };
  const only = process.env.QA_ONLY ? process.env.QA_ONLY.split(',') : Object.keys(sections);
  try {
    for (const k of only) {
      console.log(`\n── ${k} ──`);
      try { await sections[k](b); } catch (e) { fail++; failures.push(`${k} threw ${e.message}`); console.log(`FAIL: ${k} threw`, e); }
    }
  } finally { await b.close(); fs.rmSync(BASE_DIR, { recursive: true, force: true }); }
  console.log(`\n${pass} passed, ${fail} failed`);
  if (failures.length) console.log('failures:\n - ' + failures.join('\n - '));
  process.exit(fail ? 1 : 0);
})();
