// QA plan PR3 (ⓘ switch, Home create card, goal screen, toast, ?preview=plan): real-browser checks over http
//   node 2026-10-08_qa-plan-pr3-browser.js <repo-root> <work-dir> <shot-dir> [base-ref=origin/main]
// H. hidden (no preview): base tree vs PR tree, same boot + ⓘ + language + Home flow → storage writes, DOM, console
// F. real user flow, entered by URL (?preview=plan), clicks / keyboard / touch only (no planEntryReady override)
// E. QA edge cases (preview param variants, storage throws, corrupt plan, double tap, reload keeps switch off …)
// L. 360 / 375 / 400 × en / zh-HK: horizontal scroll, touch targets, zh-HK colloquial scan, screenshots (+ mockup)
// U. upgrade: base (v1.0.1) SW + cache → PR tree; new css / js in cache, offline reload; mixed old shell + new js
// QA_ONLY=HFELU picks parts.
const { chromium } = require('playwright-core');
const { execSync } = require('child_process');
const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(process.argv[2]); const WORK = path.resolve(process.argv[3]); const SHOTS = path.resolve(process.argv[4]);
const BASE = process.argv[5] || 'origin/main';
const { startPagesServer, appFiles } = require(path.join(ROOT, 'tests', 'pages-server.js'));
let pass = 0, fail = 0; const notes = [];
const ok = (c, m) => { if (c) { pass++; console.log('ok:', m); } else { fail++; console.log('FAIL:', m); } };
const note = m => { notes.push(m); console.log('note:', m); };
const launchOpts = { args: ['--no-sandbox'] }; if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const TODAY = '2026-10-08'; const NOW = new Date(TODAY + 'T09:00:00');
const settle = (pg, ms = 150) => pg.waitForTimeout(ms);
const INIT = () => {
  window.__w = [];
  const set = Storage.prototype.setItem, rm = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (k, v) { window.__w.push(['set', k, v]); return set.call(this, k, v); };
  Storage.prototype.removeItem = function (k) { window.__w.push(['rm', k]); return rm.call(this, k); };
};
const screen = pg => pg.evaluate(() => document.querySelector('.screen.active').id);
const visible = (pg, sel) => pg.evaluate(sel => { const e = document.querySelector(sel); return !!e && e.getClientRects().length > 0; }, sel);
const txt = (pg, sel) => pg.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim());
const ls = (pg, k) => pg.evaluate(k => localStorage.getItem(k), k);
const draft = pg => pg.evaluate(() => JSON.parse(JSON.stringify(planGoalDraft)));
const watch = pg => { const errs = []; pg.on('pageerror', e => errs.push('pageerror: ' + e.message)); pg.on('console', m => { if (m.type() === 'error' || /\[i18n\] missing/.test(m.text())) errs.push('console: ' + m.text()); }); return errs; };
const toastState = pg => pg.evaluate(() => { const e = byId('appToast'); return { shown: !e.hidden && e.getClientRects().length > 0, text: e.textContent }; });
const archive = (ref, dir) => { fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true }); execSync(`git archive ${ref} | tar -x -C "${dir}"`, { cwd: ROOT, shell: '/bin/bash' }); };
const iso = n => { const d = new Date(NOW); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

// ── H: hidden state, base vs PR ──
async function hiddenFlow(b, base, label) {
  const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
  await ctx.addInitScript(INIT);
  const pg = await ctx.newPage(); const errs = watch(pg);
  await pg.clock.setFixedTime(NOW);
  await pg.goto(base); await settle(pg);
  await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('lifeuk.installDismissed', 'true'); });
  await pg.goto(base); await settle(pg, 300);
  const r = {};
  r.boot = await pg.evaluate(() => window.__w.map(w => w.join(':')));
  await pg.click('#infoBtn'); await settle(pg);
  r.info = await pg.$eval('#infoPop', e => e.innerText);
  await pg.click('#infoBtn'); await settle(pg);
  await pg.click('#langBtn'); await settle(pg, 300);
  await pg.click('#infoBtn'); await settle(pg);
  r.infoZh = await pg.$eval('#infoPop', e => e.innerText);
  await pg.click('#infoBtn'); await settle(pg);
  r.homeZh = await pg.$eval('#screenHome', e => e.innerText);
  await pg.click('#langBtn'); await settle(pg, 300);
  await pg.click('#modePractice'); await settle(pg);
  r.home = await pg.$eval('#screenHome', e => e.innerText);
  r.homeHtml = await pg.$eval('#screenHome', e => e.outerHTML);
  r.writes = await pg.evaluate(() => window.__w.map(w => w.join(':')));
  r.storage = await pg.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
  r.url = await pg.evaluate(() => location.search);
  if (label === 'pr') {
    r.dom = await pg.evaluate(() => ({ card: !!byId('planCard'), row: byId('infoPlanRow').hidden, goal: byId('screenPlanGoal').classList.contains('active'),
      toast: byId('appToast').hidden, sw: !!byId('planFeatureSwitch') }));
  }
  r.errs = errs; await ctx.close(); return r;
}
async function partH(b) {
  const dir = path.join(WORK, 'pr3-base'); archive(BASE, dir);
  const s1 = await startPagesServer(dir), s2 = await startPagesServer(ROOT);
  try {
    const a = await hiddenFlow(b, s1.base, 'base'), p = await hiddenFlow(b, s2.base, 'pr');
    ok(JSON.stringify(a.writes) === JSON.stringify(p.writes), `[H1] boot + ⓘ + en↔zh-HK + Practice: storage write sequence identical (${p.writes.length} writes) ${p.writes.join(' | ')}`);
    ok(JSON.stringify(a.storage) === JSON.stringify(p.storage), '[H2] final localStorage identical to base');
    ok(!p.writes.some(w => /studyPlan/.test(w)), '[H3] 0 lifeuk.studyPlan* writes (incl. the preview flag)');
    ok(a.info === p.info && a.infoZh === p.infoZh, '[H4] ⓘ popover text identical (en + zh-HK), no Features row');
    ok(a.home === p.home && a.homeZh === p.homeZh && a.homeHtml === p.homeHtml, '[H5] Home text + outerHTML identical (no #planCard)');
    ok(!p.dom.card && p.dom.row && !p.dom.goal && p.dom.toast && !p.dom.sw, `[H6] PR DOM: no #planCard, #infoPlanRow hidden, goal screen inactive, toast hidden, switch never built ${JSON.stringify(p.dom)}`);
    ok(a.errs.length === 0 && p.errs.length === 0, `[H7] 0 console / page errors ${a.errs.concat(p.errs).join(' | ')}`);
  } finally { s1.server.kill(); s2.server.kill(); fs.rmSync(dir, { recursive: true, force: true }); }
}

// ── F: real user flow via URL ──
async function partF(b) {
  const s = await startPagesServer(ROOT);
  try {
    const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
    await ctx.addInitScript(INIT);
    const pg = await ctx.newPage(); const errs = watch(pg);
    await pg.clock.install({ time: NOW });
    await pg.goto(s.base); await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('lifeuk.installDismissed', 'true'); });
    // F1 preview on via URL
    await pg.goto(s.base + '?preview=plan'); await settle(pg, 300);
    const u1 = await pg.evaluate(() => ({ href: location.href, search: location.search, lsv: localStorage.getItem('lifeuk.studyPlanPreview'),
      planWrites: window.__w.filter(w => /studyPlan/.test(w[1])).map(w => w.join(':')) }));
    ok(u1.search === '' && !u1.href.includes('preview'), `[F1] ?preview=plan removed from the URL (${u1.href})`);
    ok(u1.lsv === 'true' && JSON.stringify(u1.planWrites) === JSON.stringify(['set:lifeuk.studyPlanPreview:true']), `[F1] only the preview flag is written ${JSON.stringify(u1.planWrites)}`);
    ok(await visible(pg, '#planCard .plan-cta'), '[F1] Home shows the dashed create card');
    await pg.goto(s.base); await settle(pg, 300);
    ok(await visible(pg, '#planCard .plan-cta'), '[F2] reload without the param: preview remembered');
    // F3 ⓘ switch: on by default, row text, hit area
    await pg.click('#infoBtn'); await settle(pg);
    const row = await pg.evaluate(() => ({ shown: byId('infoPlanRow').getClientRects().length > 0, checked: byId('planFeatureSwitch').getAttribute('aria-checked'),
      note: byId('infoPlanStatus').textContent, title: document.querySelector('#infoPlanRow .plan-settings-title').textContent, enabledKey: localStorage.getItem('lifeuk.studyPlanEnabled') }));
    ok(row.shown && row.checked === 'true' && row.enabledKey === null && row.title === 'Features', `[F3] ⓘ Features row: switch on by default, nothing written ${JSON.stringify(row)}`);
    const hit = await pg.evaluate(() => { const r = byId('planFeatureSwitch').getBoundingClientRect(); const pts = [[r.left + r.width / 2, r.top - 6], [r.left + r.width / 2, r.bottom + 6], [r.left - 3, r.top + r.height / 2], [r.right + 3, r.top + r.height / 2]];
      return { w: r.width, h: r.height, edges: pts.map(([x, y]) => document.elementFromPoint(x, y)?.id === 'planFeatureSwitch') }; });
    ok(hit.edges.every(Boolean), `[F3] switch ${hit.w}×${hit.h} visual, tap lands 6px above / below and 3px left / right (≥ 44px hit) ${JSON.stringify(hit)}`);
    // F4 off → modal (Cancel first)
    await pg.click('#planFeatureSwitch'); await settle(pg, 300);
    const m = await pg.evaluate(() => ({ open: isConfirmOpen(), title: byId('confirmTitle').textContent, ok: byId('confirmOk').textContent, cancel: byId('confirmCancel').textContent,
      focus: document.activeElement.id, msg: byId('confirmMsg').textContent }));
    ok(m.open && m.ok === 'Confirm' && m.cancel === 'Cancel' && m.focus === 'confirmCancel', `[F4] switch off asks in the app modal, en OK = "Confirm" (G33), focus on Cancel ${JSON.stringify(m)}`);
    await pg.screenshot({ path: path.join(SHOTS, 'F-375-en-switch-off-modal.png') });
    await pg.click('#confirmCancel'); await settle(pg);
    ok(await pg.evaluate(() => isStudyPlanEnabled() && localStorage.getItem('lifeuk.studyPlanEnabled') === null) && !(await toastState(pg)).shown && await visible(pg, '#planCard'), '[F4] Cancel: still on, nothing written, no toast, card stays');
    // F5 off → Confirm → toast
    if (!(await visible(pg, '#infoPlanRow'))) { await pg.click('#infoBtn'); await settle(pg); }
    await pg.click('#planFeatureSwitch'); await settle(pg, 300); await pg.click('#confirmOk'); await settle(pg, 250);
    const t1 = await toastState(pg);
    ok(t1.shown && t1.text === 'Study plan turned off', `[F5] Confirm → toast "${t1.text}" (G34)`);
    await pg.screenshot({ path: path.join(SHOTS, 'F-375-en-toast-off.png') });
    ok(await ls(pg, 'lifeuk.studyPlanEnabled') === 'false' && !(await pg.evaluate(() => !!byId('planCard'))), '[F5] off: stored false, Home card removed');
    await pg.clock.runFor(2500); await settle(pg);
    ok(!(await toastState(pg)).shown, '[F5] toast gone after ~2.4 s');
    // F6 on → no modal, popover stays, focus stays, toast
    if (!(await visible(pg, '#infoPlanRow'))) { await pg.click('#infoBtn'); await settle(pg); }
    await pg.click('#planFeatureSwitch'); await settle(pg, 250);
    const on = await pg.evaluate(() => ({ modal: isConfirmOpen(), pop: byId('infoPop').classList.contains('show'), focus: document.activeElement.id, checked: byId('planFeatureSwitch').getAttribute('aria-checked'),
      note: byId('infoPlanStatus').textContent, card: !!byId('planCard') }));
    const t2 = await toastState(pg);
    ok(!on.modal && on.pop && on.focus === 'planFeatureSwitch' && on.checked === 'true' && on.card, `[F6] switch on: no modal, popover open, focus on switch, card back ${JSON.stringify(on)}`);
    ok(t2.shown && /turned on/.test(t2.text), `[F6] toast "${t2.text}"`);
    // F7 keyboard: Space toggles off → modal → Escape cancels
    await pg.focus('#planFeatureSwitch'); await pg.keyboard.press('Space'); await settle(pg, 250);
    const kb = await pg.evaluate(() => isConfirmOpen());
    await pg.keyboard.press('Escape'); await settle(pg);
    ok(kb && await pg.evaluate(() => !isConfirmOpen() && isStudyPlanEnabled()), '[F7] keyboard Space on the switch opens the modal; Escape cancels (still on)');
    await pg.evaluate(() => { if (byId('infoPop').classList.contains('show')) byId('infoBtn').click(); });
    await settle(pg);
    // F8 create card → goal screen defaults
    await pg.click('#planCard .plan-cta'); await settle(pg, 250);
    const g = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, chips: [...document.querySelectorAll('#planDaysChips .chip')].map(c => c.textContent + (c.classList.contains('active') ? '*' : '')),
      val: byId('planDaysVal').textContent, date: byId('planExamDate').value, min: byId('planExamDate').min, max: byId('planExamDate').max,
      range: [byId('planMins').min, byId('planMins').max, byId('planMins').step, byId('planMins').value], minsVal: byId('planMinsVal').textContent,
      ticks: [...document.querySelectorAll('#planMinsTicks span')].map(s => s.textContent + (s.classList.contains('on') ? '*' : '')),
      rest: [...document.querySelectorAll('#planRestChips .chip')].map(c => c.textContent + (c.getAttribute('aria-pressed') === 'true' ? '*' : '')),
      levels: [...document.querySelectorAll('#planLevelGrid .mode-card')].map(c => c.querySelector('.mode-title').textContent + (c.classList.contains('selected') ? '*' : '')),
      pill: byId('planFeasPill').className + '|' + byId('planFeasPill').textContent, cta: byId('planCreateBtn').disabled, scrollY }));
    ok(g.scr === 'screenPlanGoal', '[F8] create card → goal screen');
    ok(JSON.stringify(g.chips) === JSON.stringify(['2 weeks', '3 weeks*', '4 weeks', '1.5 months']) && g.val === '21 days' && g.date === '2026-10-29', `[F8] presets ${g.chips} (U-1 / G33 "1.5 months"), 21 days, date ${g.date}`);
    ok(g.min === '2026-10-15' && g.max === '2027-04-08', `[F8] date min today+7 ${g.min}, max today+6 months ${g.max}`);
    ok(JSON.stringify(g.range) === JSON.stringify(['30', '120', '15', '120']) && g.minsVal === '2 hr', `[F8] slider 30–120 step 15, default 120 = "${g.minsVal}"`);
    ok(JSON.stringify(g.ticks) === JSON.stringify(['30 min', '45 min', '1 hr', '15 min', '30 min', '45 min', '2 hr*']), `[F8] ticks after 1 hr show only minutes ${g.ticks}`);
    ok(JSON.stringify(g.rest) === JSON.stringify(['Sun*', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) && g.levels[0] === 'Starting fresh*' && g.levels.length === 3, `[F8] rest ${g.rest}; levels ${g.levels}`);
    await pg.screenshot({ path: path.join(SHOTS, 'F-375-en-goal-default.png'), fullPage: true });
    // F9 slider by keyboard
    await pg.focus('#planMins'); await pg.keyboard.press('ArrowLeft'); await settle(pg, 80);
    const s105 = await pg.evaluate(() => [planGoalDraft.dailyMins, byId('planMinsVal').textContent, byId('planMins').getAttribute('aria-valuetext'), document.querySelector('#planMinsTicks .on').textContent, document.activeElement.id]);
    ok(s105[0] === 105 && s105[1] === '1 hr 45 min' && s105[2] === '1 hr 45 min' && s105[3] === '45 min' && s105[4] === 'planMins', `[F9] ArrowLeft → ${JSON.stringify(s105)}`);
    await pg.keyboard.press('Home'); await settle(pg, 80);
    const s30 = await pg.evaluate(() => [planGoalDraft.dailyMins, byId('planMinsVal').textContent]);
    await pg.keyboard.press('ArrowRight'); await pg.keyboard.press('ArrowRight'); await settle(pg, 80);
    const s60 = await pg.evaluate(() => [planGoalDraft.dailyMins, byId('planMinsVal').textContent, document.querySelector('#planMinsTicks .on').textContent]);
    ok(s30[0] === 30 && s30[1] === '30 min' && s60[0] === 60 && s60[1] === '1 hr' && s60[2] === '1 hr', `[F9] Home → ${s30}; 2× ArrowRight → ${s60}`);
    // slider by mouse drag to the far right
    const sb = await pg.$eval('#planMins', e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, w: r.width }; });
    await pg.mouse.click(sb.x + sb.w - 2, sb.y); await settle(pg, 80);
    ok((await draft(pg)).dailyMins === 120, '[F9] mouse click at the right end → 120');
    // F10 presets by click
    await pg.click('#planDaysChips .chip >> nth=0'); await settle(pg, 80);
    const p14 = await pg.evaluate(() => [planGoalDraft.examDate, byId('planDaysVal').textContent, byId('planExamDate').value, document.activeElement.dataset.arg]);
    await pg.click('#planDaysChips .chip >> nth=3'); await settle(pg, 80);
    const p42 = await pg.evaluate(() => [planGoalDraft.examDate, byId('planDaysVal').textContent]);
    ok(p14[0] === '2026-10-22' && p14[1] === '14 days' && p14[2] === '2026-10-22' && p42[0] === '2026-11-19' && p42[1] === '42 days', `[F10] 2 weeks ${p14}; 1.5 months ${p42}`);
    // F11 date by keyboard (desktop): type segment by segment, then Tab away
    const order = await pg.evaluate(() => new Intl.DateTimeFormat(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(2026, 11, 25)).filter(p => p.type !== 'literal').map(p => p.value).join(''));
    await pg.focus('#planExamDate'); await pg.keyboard.type(order, { delay: 30 }); await settle(pg, 80);
    const typed = await pg.evaluate(() => [planGoalDraft.examDate, byId('planExamDate').value, byId('planDaysVal').textContent, document.activeElement.id]);
    await pg.click('#screenPlanGoal .plan-h2'); await settle(pg, 80); // leave the field (Tab first walks the date segments)
    const afterTab = await pg.evaluate(() => [planGoalDraft.examDate, byId('planExamDate').value, document.activeElement.id]);
    ok(typed[0] === '2026-12-25' && typed[1] === '2026-12-25' && typed[2] === '78 days' && afterTab[0] === '2026-12-25' && afterTab[2] !== 'planExamDate', `[F11] keyboard "${order}" → ${typed}; leave field → ${afterTab} (W-033)`);
    // too early typed → Tab snaps back to the draft
    const early = await pg.evaluate(() => new Intl.DateTimeFormat(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(2026, 9, 10)).filter(p => p.type !== 'literal').map(p => p.value).join(''));
    await pg.focus('#planExamDate'); await pg.keyboard.type(early, { delay: 30 }); await pg.click('#screenPlanGoal .plan-h2'); await settle(pg, 80);
    const e1 = await pg.evaluate(() => [planGoalDraft.examDate, byId('planExamDate').value]);
    ok(e1[0] === e1[1] && e1[0] >= '2026-10-15', `[F11] typed 2026-10-10 (< min) → leaving snaps the field back to the draft ${e1}`);
    if (e1[0] !== '2026-12-25') note(`typing 2026-10-10 over 2026-12-25 segment by segment: the half-typed 2026-10-25 (in range) was taken, so the snap-back lands on ${e1[0]}, not the previous 2026-12-25`);
    const late = await pg.evaluate(() => new Intl.DateTimeFormat(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(2028, 0, 5)).filter(p => p.type !== 'literal').map(p => p.value).join(''));
    await pg.focus('#planExamDate'); await pg.keyboard.type(late, { delay: 30 }); await pg.click('#screenPlanGoal .plan-h2'); await settle(pg, 80);
    const e2 = await pg.evaluate(() => [planGoalDraft.examDate, byId('planExamDate').value]);
    ok(e2[0] === '2027-04-08' && e2[1] === '2027-04-08', `[F11] typed 2028-01-05 (> max) → leaving clamps to max ${e2}`);
    // F11b (CUI-0019): with the date field focused, the first click on a preset / rest / level button
    for (const [sel, read, want] of [['#planDaysChips [data-arg="14"]', 'planGoalDraft.examDate', '2026-10-22'], ['#planRestChips [data-arg="3"]', 'planGoalDraft.restDays.includes(3)', true], ['#planLevelGrid [data-arg="exam"]', 'planGoalDraft.level', 'exam']]) {
      await pg.click('#planExamDate'); await settle(pg, 60);
      await pg.click(sel); await settle(pg, 100);
      const got = await pg.evaluate(r => eval(r), read);
      ok(got === want, `[F11b] date field focused → one click on ${sel} → ${read} = ${JSON.stringify(got)} (want ${JSON.stringify(want)})`);
      if (got !== want) { await pg.click(sel); await settle(pg, 80); }
    }
    await pg.click('#planRestChips [data-arg="3"]'); await pg.click('#planLevelGrid [data-arg="none"]'); await settle(pg, 80);
    // F12 rest days + G28
    await pg.click('#planDaysChips .chip >> nth=0'); await settle(pg, 80); // 14 days
    for (const d of [1, 2, 3, 4]) { await pg.click(`#planRestChips [data-arg="${d}"]`); await settle(pg, 60); }
    const g28 = await pg.evaluate(() => ({ rest: planGoalDraft.restDays, days: byId('planFeasDays').textContent, sub: byId('planFeasDaysSub').textContent, cta: byId('planCreateBtn').disabled,
      hint: byId('planGoalHint').hidden ? null : byId('planGoalHint').textContent, msg: byId('planFeasMsg').hidden, pressed: byId('planRestChips').querySelector('[data-arg="4"]').getAttribute('aria-pressed') }));
    ok(g28.cta && g28.hint && /Fewer than 7 study days/.test(g28.hint) && g28.msg && g28.pressed === 'true', `[F12] G28: 14 days, rest Sun–Thu → ${g28.days} study days → CTA disabled + hint ${JSON.stringify(g28)}`);
    await pg.screenshot({ path: path.join(SHOTS, 'F-375-en-goal-g28.png'), fullPage: true });
    await pg.click('#planCreateBtn', { force: true }); await settle(pg, 120);
    ok((await screen(pg)) === 'screenPlanGoal' && (await ls(pg, 'lifeuk.studyPlan')) === null, '[F12] disabled CTA tap does nothing');
    await pg.click('#planRestChips [data-arg="4"]'); await settle(pg, 80);
    const g28b = await pg.evaluate(() => [byId('planFeasDays').textContent, byId('planCreateBtn').disabled, byId('planGoalHint').hidden]);
    ok(g28b[0] === '7' ? (!g28b[1] && g28b[2]) : true, `[F12] Thu back on → ${g28b[0]} study days, CTA ${g28b[1] ? 'disabled' : 'enabled'}`);
    // F13 feasibility three states via clicks
    const feasOf = () => pg.evaluate(() => ({ cls: byId('planFeasPill').className, pill: byId('planFeasPill').textContent, meter: byId('planFeasMeter').style.width, meterCls: byId('planFeasMeter').className,
      msg: byId('planFeasMsg').textContent, cta: byId('planCreateBtn').disabled, avail: byId('planFeasAvail').textContent, need: byId('planFeasNeed').textContent }));
    async function setUi({ preset, mins, rest, level }) {
      await pg.click(`#planDaysChips [data-arg="${preset}"]`);
      const cur = await draft(pg);
      for (let d = 0; d < 7; d++) if (cur.restDays.includes(d) !== rest.includes(d)) await pg.click(`#planRestChips [data-arg="${d}"]`);
      await pg.focus('#planMins'); await pg.keyboard.press('Home'); for (let i = 0; i < (mins - 30) / 15; i++) await pg.keyboard.press('ArrowRight');
      await pg.click(`#planLevelGrid [data-arg="${level}"]`); await settle(pg, 80);
    }
    const found = await pg.evaluate(() => { const out = {}; const today = planTodayIso();
      for (const days of [14, 21, 28, 42]) for (const mins of [30, 45, 60, 75, 90, 105, 120]) for (const level of ['none', 'some', 'exam']) for (const rest of [[], [0], [0, 6]]) {
        const goal = { examDate: isoAddDays(today, days), dailyMins: mins, restDays: rest, level };
        if (!validatePlanGoal(goal, today).ok) continue; const f = planFeasibility(goal, today); if (!out[f.status]) out[f.status] = { preset: days, mins, rest, level }; }
      return out; });
    for (const st of ['ok', 'tight', 'short']) {
      if (!found[st]) { ok(false, `[F13] no preset combination reaches ${st}`); continue; }
      await setUi(found[st]); const f = await feasOf();
      ok(f.cls === 'plan-pill ' + st && f.meterCls === 'plan-meter-fill ' + st && !f.cta, `[F13] ${st} via clicks ${JSON.stringify(found[st])} → ${f.pill}, meter ${f.meter}, CTA enabled (G13 short still builds) · "${f.msg}"`);
      await pg.screenshot({ path: path.join(SHOTS, `F-375-en-goal-feas-${st}.png`), fullPage: true });
    }
    // F14 en grammar of the feasibility message for every reachable n (QA edge)
    const msgs = await pg.evaluate(() => { const today = planTodayIso(); const seen = {};
      for (let days = 7; days <= 182; days++) for (const mins of [30, 45, 60, 75, 90, 105, 120]) for (const level of ['none', 'some', 'exam']) for (const rest of [[], [0], [0, 6], [0, 3, 6]]) {
        const goal = { examDate: isoAddDays(today, days), dailyMins: mins, restDays: rest, level };
        if (!validatePlanGoal(goal, today).ok) continue; const f = planFeasibility(goal, today); if (f.status === 'tight') continue;
        const n = planHours(f.diffMins); const k = f.status + ':' + (n <= 1 ? n : 'n'); if (!seen[k]) seen[k] = { days, mins, level, rest, diff: f.diffMins, msg: t(f.status === 'ok' ? 'plan.feas.okMsg' : 'plan.feas.shortMsg', { n, m: 15 }) }; }
      return seen; });
    const bad = Object.entries(msgs).filter(([k]) => /:(0|1)$/.test(k));
    ok(bad.every(([k, v]) => !/\b1 hours\b|\b0 hours\b/.test(v.msg)), '[F14] CUI-0020: n = 0 / 1 messages read singular: ' + bad.map(([k, v]) => `${k} "${v.msg.slice(0, 30)}…"`).join(' ; '));
    ok(true, `[F14] feasibility message n buckets reachable: ${Object.keys(msgs).join(', ')}`);
    // F15 create (with an old plan + log stored) → Home simplified card
    await pg.evaluate(() => { localStorage.setItem('lifeuk.studyPlan', '{"v":1,"old":true}'); localStorage.setItem('lifeuk.studyPlanProgress', '{"2026-10-01":{"ok":{"1.0":1}}}'); });
    await setUi({ preset: 21, mins: 120, rest: [0], level: 'none' });
    await pg.click('#planCreateBtn'); await settle(pg, 300);
    const cr = await pg.evaluate(() => { const p = JSON.parse(localStorage.getItem('lifeuk.studyPlan') || 'null');
      return { scr: document.querySelector('.screen.active').id, start: p && p.start, exam: p && p.goal.examDate, days: p && p.days.length, log: localStorage.getItem('lifeuk.studyPlanProgress'),
        card: byId('planCard') && byId('planCard').innerText.replace(/\s+/g, ' '), cta: !!document.querySelector('#planCard .plan-cta') }; });
    ok(cr.scr === 'screenHome' && cr.start === TODAY && cr.exam === '2026-10-29' && cr.log === null, `[F15] Build → Home; plan start ${cr.start} exam ${cr.exam} (${cr.days} days); old log cleared`);
    ok(!cr.cta && /Day 1 \/ \d+/.test(cr.card) && /21 days to the exam · 29\/10/.test(cr.card), `[F15] Home simplified card "${cr.card}"`);
    await pg.screenshot({ path: path.join(SHOTS, 'F-375-en-home-plan-card.png') });
    // F16 W-031: Exam mode running → switch off → stays, timer runs
    await pg.click('#modeExam'); await settle(pg); await pg.click('#examGrid [data-action="startExam"][data-arg="3"]'); await settle(pg, 250);
    await pg.click('#opt0'); await settle(pg, 80);
    const t0 = await txt(pg, '#examTimer');
    await pg.click('#infoBtn'); await settle(pg); await pg.click('#planFeatureSwitch'); await settle(pg, 250); await pg.click('#confirmOk'); await settle(pg, 200);
    await pg.clock.runFor(3000); await settle(pg);
    const ex = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, exam: state.examNum, ans: Object.keys(state.answers).length, en: isStudyPlanEnabled() }));
    const t3 = await txt(pg, '#examTimer');
    ok(ex.scr === 'screenQuiz' && ex.exam === 3 && ex.ans >= 1 && !ex.en && t3 !== t0, `[F16] W-031: Exam 3 running, switch off → still on the exam, answer kept, timer ${t0} → ${t3} ${JSON.stringify(ex)}`);
    await pg.click('#screenQuiz .back-btn'); await settle(pg); if (await pg.evaluate(() => isConfirmOpen())) { await pg.click('#confirmOk'); await settle(pg); }
    ok(!(await pg.evaluate(() => !!byId('planCard'))), '[F16] back on Home after Leave: no plan card while off');
    // Study screen: switch on, then off from Study → stays on Study
    await pg.click('#infoBtn'); await settle(pg); await pg.click('#planFeatureSwitch'); await settle(pg, 150); await pg.click('#infoBtn'); await settle(pg);
    await pg.click('#modeStudy'); await settle(pg, 300);
    await pg.click('#infoBtn'); await settle(pg); await pg.click('#planFeatureSwitch'); await settle(pg, 250); await pg.click('#confirmOk'); await settle(pg, 200);
    ok((await screen(pg)) === 'screenStudy', '[F16] switch off on Study → stays on Study');
    await pg.evaluate(() => { if (byId('infoPop').classList.contains('show')) byId('infoBtn').click(); });
    // goal screen: off → Home
    await pg.evaluate(() => goHome()); await settle(pg);
    await pg.click('#infoBtn'); await settle(pg); await pg.click('#planFeatureSwitch'); await settle(pg, 150); await pg.click('#infoBtn'); await settle(pg);
    await pg.evaluate(() => { localStorage.removeItem('lifeuk.studyPlan'); renderPlanCard(); });
    await pg.click('#planCard .plan-cta'); await settle(pg, 200);
    await pg.click('#infoBtn'); await settle(pg); await pg.click('#planFeatureSwitch'); await settle(pg, 250); await pg.click('#confirmOk'); await settle(pg, 200);
    ok((await screen(pg)) === 'screenHome' && !(await pg.evaluate(() => !!byId('planCard'))), '[F16] switch off on the goal screen → Home, no card (G15)');
    // F17 zh-HK: goal screen + modal label
    await pg.click('#infoBtn'); await settle(pg); await pg.click('#planFeatureSwitch'); await settle(pg, 150); await pg.click('#infoBtn'); await settle(pg);
    await pg.click('#planCard .plan-cta'); await settle(pg, 200);
    await pg.click('#planDaysChips .chip >> nth=2'); await settle(pg, 80);
    await pg.click('#langBtn'); await settle(pg, 300);
    const zh = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, chips: [...document.querySelectorAll('#planDaysChips .chip')].map(c => c.textContent + (c.classList.contains('active') ? '*' : '')),
      val: byId('planDaysVal').textContent, ticks: [...document.querySelectorAll('#planMinsTicks span')].map(s => s.textContent), cta: byId('planCreateBtn').textContent, date: planGoalDraft.examDate }));
    ok(zh.scr === 'screenPlanGoal' && JSON.stringify(zh.chips) === JSON.stringify(['2 星期', '3 星期', '4 星期*', '一個半月']) && zh.val === '28 日' && zh.date === '2026-11-05', `[F17] language → zh-HK keeps the draft ${JSON.stringify(zh)}`);
    ok(JSON.stringify(zh.ticks) === JSON.stringify(['30 分鐘', '45 分鐘', '1 小時', '15 分', '30 分', '45 分', '2 小時']), `[F17] zh-HK ticks ${zh.ticks}`);
    await pg.click('#infoBtn'); await settle(pg); await pg.click('#planFeatureSwitch'); await settle(pg, 250);
    const zm = await pg.evaluate(() => [byId('confirmTitle').textContent, byId('confirmOk').textContent, byId('confirmCancel').textContent]);
    ok(zm[1] === '確定' && zm[2] === '取消', `[F17] zh-HK modal ${zm}`);
    await pg.screenshot({ path: path.join(SHOTS, 'F-375-zh-switch-off-modal.png') });
    await pg.click('#confirmCancel'); await settle(pg);
    await pg.click('#langBtn').catch(() => {}); await settle(pg, 300);
    // F18 ?preview=off
    await pg.goto(s.base + '?preview=off'); await settle(pg, 300);
    const off = await pg.evaluate(() => ({ search: location.search, lsv: localStorage.getItem('lifeuk.studyPlanPreview'), card: !!byId('planCard') }));
    await pg.click('#infoBtn'); await settle(pg);
    const rowOff = await visible(pg, '#infoPlanRow');
    ok(off.search === '' && off.lsv === null && !off.card && !rowOff, `[F18] ?preview=off: URL cleaned, flag removed, no card / Features row ${JSON.stringify(off)}`);
    await pg.click('#infoBtn'); await settle(pg);
    ok(errs.length === 0, `[F] 0 console / page errors ${errs.join(' | ')}`);
    await ctx.close();

    // F19 phone: touch + native date picker (fill = picker sets the value in one go)
    const mob = await b.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, serviceWorkers: 'block' });
    const mp = await mob.newPage(); const merrs = watch(mp);
    await mp.clock.setFixedTime(NOW);
    await mp.goto(s.base + '?preview=plan'); await mp.evaluate(() => localStorage.setItem('lifeuk.installDismissed', 'true')); await mp.goto(s.base); await settle(mp, 300);
    await mp.tap('#planCard .plan-cta'); await settle(mp, 300);
    await mp.tap('#planDaysChips .chip >> nth=2'); await settle(mp, 100);
    await mp.fill('#planExamDate', '2026-12-01'); await settle(mp, 100);
    const md = await mp.evaluate(() => [planGoalDraft.examDate, byId('planDaysVal').textContent, byId('planExamDate').value]);
    ok(md[0] === '2026-12-01' && md[1] === '54 days', `[F19] phone: native picker value 2026-12-01 → draft ${md}`);
    await mp.tap('#planRestChips [data-arg="6"]'); await settle(mp, 100);
    const swallowed = await mp.evaluate(() => planGoalDraft.restDays.includes(6));
    ok(swallowed, `[F19b] phone: after the native picker, one tap on "Sat" → rest Sat ${swallowed} (CUI-0019)`);
    if (!swallowed) await mp.tap('#planRestChips [data-arg="6"]');
    await mp.tap('#planLevelGrid [data-arg="exam"]'); await settle(mp, 100);
    const mr = await mp.evaluate(() => [planGoalDraft.restDays, planGoalDraft.level]);
    ok(JSON.stringify(mr) === JSON.stringify([[0, 6], 'exam']), `[F19] phone taps: rest Sun+Sat, level exam ${JSON.stringify(mr)}`);
    await mp.tap('#planCreateBtn'); await settle(mp, 300);
    const mc = await mp.evaluate(() => ({ scr: document.querySelector('.screen.active').id, card: byId('planCard').innerText.replace(/\s+/g, ' ') }));
    ok(mc.scr === 'screenHome' && /54 days to the exam · 1\/12/.test(mc.card), `[F19] phone: Build → Home card "${mc.card}"`);
    ok(merrs.length === 0, `[F19] 0 errors ${merrs.join(' | ')}`);
    await mob.close();
  } finally { s.server.kill(); }
}

// ── E: QA edge cases ──
async function partE(b) {
  const s = await startPagesServer(ROOT);
  try {
    const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
    await ctx.addInitScript(INIT);
    const pg = await ctx.newPage(); const errs = watch(pg);
    await pg.clock.install({ time: NOW });
    await pg.goto(s.base); await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('lifeuk.installDismissed', 'true'); });
    // E1 param variants
    for (const q of ['?preview=PLAN', '?preview=', '?preview=yes', '?Preview=plan']) {
      await pg.goto(s.base + q); await settle(pg, 200);
      const r = await pg.evaluate(() => ({ search: location.search, lsv: localStorage.getItem('lifeuk.studyPlanPreview'), card: !!byId('planCard') }));
      ok(r.search === q && r.lsv === null && !r.card, `[E1] ${q}: ignored (URL kept, nothing written, hidden) ${JSON.stringify(r)}`);
    }
    await pg.goto(s.base + '?preview=plan&preview=off'); await settle(pg, 200);
    const dup = await pg.evaluate(() => ({ search: location.search, lsv: localStorage.getItem('lifeuk.studyPlanPreview') }));
    ok(dup.lsv === 'true', `[E1] ?preview=plan&preview=off: first value wins, all copies removed ${JSON.stringify(dup)}`);
    if (dup.search !== '') note(`?preview=plan&preview=off leaves "${dup.search}" in the URL`);
    // E2 history.state kept and no extra history entry
    await pg.goto(s.base); await settle(pg, 150);
    const hl = await pg.evaluate(() => history.length);
    await pg.goto(s.base + '?preview=plan'); await settle(pg, 200);
    const h2 = await pg.evaluate(() => history.length);
    ok(h2 === hl + 1, `[E2] replaceState adds no history entry (${hl} → ${h2})`);
    // E3 reload keeps the switch off; preview on + off shows the row with the switch off and no card
    await pg.evaluate(() => setStudyPlanEnabled(false)); await pg.goto(s.base); await settle(pg, 250);
    await pg.click('#infoBtn'); await settle(pg);
    const e3 = await pg.evaluate(() => ({ row: byId('infoPlanRow').getClientRects().length > 0, checked: byId('planFeatureSwitch').getAttribute('aria-checked'), note: byId('infoPlanStatus').textContent, card: !!byId('planCard') }));
    ok(e3.row && e3.checked === 'false' && /^Off/.test(e3.note) && !e3.card, `[E3] reload with switch off: row shows off, no card ${JSON.stringify(e3)}`);
    await pg.click('#planFeatureSwitch'); await settle(pg, 150); await pg.click('#infoBtn'); await settle(pg);
    // E4 corrupt / wrong-shape plan → create card; build replaces it
    await pg.evaluate(() => { localStorage.setItem('lifeuk.studyPlan', '{oops'); localStorage.setItem('lifeuk.studyPlanProgress', '{bad'); }); await pg.goto(s.base); await settle(pg, 250);
    ok(await visible(pg, '#planCard .plan-cta'), '[E4] corrupt stored plan → create card (no crash)');
    await pg.click('#planCard .plan-cta'); await settle(pg, 200); await pg.click('#planCreateBtn'); await settle(pg, 250);
    const e4 = await pg.evaluate(() => ({ plan: !!parseStoredPlan(readStudyPlan()), log: localStorage.getItem('lifeuk.studyPlanProgress') }));
    ok(e4.plan && e4.log === null, `[E4] build over a corrupt plan + log → valid plan, log cleared ${JSON.stringify(e4)}`);
    // E5 double tap on Build → one plan write, ends on Home, no error
    await pg.evaluate(() => { localStorage.removeItem('lifeuk.studyPlan'); renderPlanCard(); });
    await pg.click('#planCard .plan-cta'); await settle(pg, 200);
    await pg.evaluate(() => { window.__w = []; });
    await pg.dblclick('#planCreateBtn'); await settle(pg, 300);
    const e5 = await pg.evaluate(() => ({ writes: window.__w.filter(w => w[1] === 'lifeuk.studyPlan' && w[0] === 'set').length, scr: document.querySelector('.screen.active').id }));
    ok(e5.writes === 1 && e5.scr === 'screenHome', `[E5] double tap Build → ${e5.writes} plan write, ${e5.scr}`);
    // E6 two quick switch toggles → one toast, latest text, timer restarted
    await pg.click('#infoBtn'); await settle(pg); await pg.click('#planFeatureSwitch'); await settle(pg, 150); await pg.click('#confirmOk'); await settle(pg, 150);
    await pg.clock.runFor(1500);
    if (!(await visible(pg, '#infoPlanRow'))) { await pg.click('#infoBtn'); await settle(pg); }
    await pg.click('#planFeatureSwitch'); await settle(pg, 150);
    const e6a = await pg.evaluate(() => ({ n: document.querySelectorAll('.toast').length, text: byId('appToast').textContent }));
    await pg.clock.runFor(1500); const e6b = await toastState(pg);
    await pg.clock.runFor(1200); const e6c = await toastState(pg);
    ok(e6a.n === 1 && /turned on/.test(e6a.text) && e6b.shown && !e6c.shown, `[E6] toast replaced (1 element "${e6a.text}"), still shown 1.5 s later, gone after 2.7 s`);
    // E7 midnight while the goal screen is open with today+7, then language switch re-renders → clamp to new min
    await pg.evaluate(() => { if (byId('infoPop').classList.contains('show')) byId('infoBtn').click(); });
    await pg.click('#planCard').catch(() => {});
    await pg.evaluate(() => { localStorage.removeItem('lifeuk.studyPlan'); leaveToHome(); });
    await pg.click('#planCard .plan-cta'); await settle(pg, 200);
    await pg.fill('#planExamDate', '2026-10-15'); await pg.click('#screenPlanGoal .plan-h2'); await settle(pg, 80);
    await pg.clock.setSystemTime(new Date('2026-10-09T00:00:30')); await pg.click('#langBtn'); await settle(pg, 300);
    const e7 = await pg.evaluate(() => ({ date: planGoalDraft.examDate, min: byId('planExamDate').min, cta: byId('planCreateBtn').disabled, hint: byId('planGoalHint').hidden ? '' : byId('planGoalHint').textContent }));
    ok(e7.date === '2026-10-16' && e7.min === '2026-10-16', `[E7] past midnight + re-render → draft clamps to the new min ${JSON.stringify(e7)}`);
    await pg.click('#langBtn'); await settle(pg, 300);
    await pg.clock.setSystemTime(NOW);
    // E8 exam date already passed in a stored plan → card clamps (Day n ≤ N, 0 days)
    await pg.evaluate(() => { const p = buildPlan({ examDate: '2026-10-20', dailyMins: 120, restDays: [], level: 'none' }, '2026-10-01'); localStorage.setItem('lifeuk.studyPlan', JSON.stringify(p)); leaveToHome(); });
    await pg.clock.setSystemTime(new Date('2026-11-02T09:00:00')); await pg.evaluate(() => renderPlanCard());
    const e8 = await pg.evaluate(() => byId('planCard').innerText.replace(/\s+/g, ' '));
    ok(/Day 19 \/ 19/.test(e8) && /0 days to the exam/.test(e8), `[E8] plan past its exam date → "${e8}"`);
    await pg.clock.setSystemTime(NOW);
    // E9 Escape while the popover is open and the switch focused closes the popover only
    await pg.click('#infoBtn'); await settle(pg); await pg.focus('#planFeatureSwitch'); await pg.keyboard.press('Escape'); await settle(pg);
    const e9 = await pg.evaluate(() => ({ pop: byId('infoPop').classList.contains('show'), en: isStudyPlanEnabled() }));
    ok(!e9.pop && e9.en, `[E9] Escape on the focused switch closes the popover, setting unchanged ${JSON.stringify(e9)}`);
    // E10 every rest day on → 0 study days → disabled, no exception
    await pg.evaluate(() => { localStorage.removeItem('lifeuk.studyPlan'); leaveToHome(); });
    await pg.click('#planCard .plan-cta'); await settle(pg, 200);
    for (let d = 1; d < 7; d++) await pg.click(`#planRestChips [data-arg="${d}"]`);
    const e10 = await pg.evaluate(() => ({ days: byId('planFeasDays').textContent, cta: byId('planCreateBtn').disabled, hint: !byId('planGoalHint').hidden, pill: byId('planFeasPill').textContent }));
    ok(e10.days === '0' && e10.cta && e10.hint, `[E10] all 7 rest days → 0 study days, CTA disabled + hint ${JSON.stringify(e10)}`);
    ok(errs.length === 0, `[E] 0 console / page errors ${errs.join(' | ')}`);
    await ctx.close();
    // E11 localStorage throws (Safari private / blocked) with ?preview=plan → app boots, hidden, no error
    const c2 = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
    await c2.addInitScript(() => { Storage.prototype.setItem = function () { throw new DOMException('quota', 'QuotaExceededError'); }; });
    const p2 = await c2.newPage(); const e2s = watch(p2);
    await p2.goto(s.base + '?preview=plan'); await settle(p2, 300);
    const e11 = await p2.evaluate(() => ({ grid: document.querySelectorAll('#examGrid button').length, search: location.search, card: !!byId('planCard') }));
    ok(e11.grid > 0 && e2s.length === 0, `[E11] setItem throws + ?preview=plan → app boots ${JSON.stringify(e11)} ${e2s.join(' | ')}`);
    await c2.close();
  } finally { s.server.kill(); }
}

// ── L: layout at 360 / 375 / 400 × en / zh-HK ──
const COLLOQUIAL = /[唔嘅咗嚟睇喺冇啲咁仲揀攞諗嘢係佢哋噉囉喎啱晒俾畀嗰呢乜㗎嘞咩]/;
async function partL(b) {
  const s = await startPagesServer(ROOT);
  try {
    for (const w of [360, 375, 400]) for (const lang of ['en', 'zh-HK']) {
      const ctx = await b.newContext({ viewport: { width: w, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, serviceWorkers: 'block' });
      const pg = await ctx.newPage(); const errs = watch(pg);
      await pg.clock.setFixedTime(NOW);
      await pg.goto(s.base); await pg.evaluate(l => { localStorage.clear(); localStorage.setItem('lifeuk.installDismissed', 'true'); localStorage.setItem('lifeuk.uiLang', JSON.stringify(l)); }, lang);
      await pg.goto(s.base + '?preview=plan'); await settle(pg, 300);
      const tag = `${w}-${lang}`; const texts = [];
      const hscroll = () => pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const targets = sel => pg.evaluate(sel => [...document.querySelectorAll(sel)].filter(e => e.getClientRects().length).map(e => { const r = e.getBoundingClientRect();
        return { id: e.id || e.className.split(' ')[0] + (e.dataset.arg ? '[' + e.dataset.arg + ']' : ''), w: Math.round(r.width), h: Math.round(r.height) }; }), sel);
      const h0 = await hscroll();
      const card = await targets('#planCard .plan-cta');
      texts.push(await pg.$eval('#planCard', e => e.innerText));
      await pg.screenshot({ path: path.join(SHOTS, `L-${tag}-home-create.png`) });
      await pg.tap('#infoBtn'); await settle(pg, 300);
      texts.push(await pg.$eval('#infoPlanRow', e => e.innerText));
      const popFits = await pg.evaluate(() => { const r = byId('infoPop').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; });
      await pg.screenshot({ path: path.join(SHOTS, `L-${tag}-info-switch.png`) });
      await pg.tap('#planFeatureSwitch'); await settle(pg, 400);
      texts.push(await pg.$eval('#confirmModal', e => e.innerText));
      await pg.screenshot({ path: path.join(SHOTS, `L-${tag}-switch-off-modal.png`) });
      await pg.tap('#confirmOk'); await settle(pg, 300);
      texts.push(await pg.$eval('#appToast', e => e.textContent));
      const toastFits = await pg.evaluate(() => { const r = byId('appToast').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.height > 0; });
      await pg.screenshot({ path: path.join(SHOTS, `L-${tag}-toast-off.png`) });
      await pg.tap('#infoBtn').catch(() => {}); await settle(pg, 200);
      if (!(await visible(pg, '#infoPlanRow'))) { await pg.tap('#infoBtn'); await settle(pg, 200); }
      await pg.tap('#planFeatureSwitch'); await settle(pg, 300);
      texts.push(await pg.$eval('#appToast', e => e.textContent), await pg.$eval('#infoPlanRow', e => e.innerText));
      await pg.screenshot({ path: path.join(SHOTS, `L-${tag}-toast-on.png`) });
      await pg.evaluate(() => { if (byId('infoPop').classList.contains('show')) byId('infoBtn').click(); }); await settle(pg, 150);
      await pg.tap('#planCard .plan-cta'); await settle(pg, 300);
      const h1 = await hscroll();
      const goalT = await targets('#screenPlanGoal button, #screenPlanGoal input');
      texts.push(await pg.$eval('#screenPlanGoal', e => e.innerText));
      await pg.screenshot({ path: path.join(SHOTS, `L-${tag}-goal.png`), fullPage: true });
      // the other two feasibility states + G28 hint text for the scan
      for (const [preset, rest] of [[14, [0, 1, 2, 3, 4]], [42, [0]]]) {
        await pg.tap(`#planDaysChips [data-arg="${preset}"]`);
        const cur = await draft(pg); for (let d = 0; d < 7; d++) if (cur.restDays.includes(d) !== rest.includes(d)) await pg.tap(`#planRestChips [data-arg="${d}"]`);
        await settle(pg, 100); texts.push(await pg.$eval('#screenPlanGoal', e => e.innerText));
        if (preset === 14) await pg.screenshot({ path: path.join(SHOTS, `L-${tag}-goal-g28.png`), fullPage: true });
      }
      const h2 = await hscroll();
      await pg.tap('#planCreateBtn'); await settle(pg, 300);
      const h3 = await hscroll(); texts.push(await pg.$eval('#planCard', e => e.innerText));
      await pg.screenshot({ path: path.join(SHOTS, `L-${tag}-home-plan-card.png`) });
      ok(Math.max(h0, h1, h2, h3) === 0, `[L] ${tag}: no horizontal scroll (home ${h0}, goal ${h1}/${h2}, card ${h3})`);
      ok(popFits && toastFits, `[L] ${tag}: ⓘ popover + toast inside the viewport`);
      const small = [...card, ...goalT].filter(t => t.h < 44);
      const sm = small.map(t => `${t.id} ${t.w}×${t.h}`).join(', ');
      console.log(`  [L] ${tag} targets < 44px high: ${sm || 'none'}`);
      if (w === 375 && lang === 'en') note(`touch targets < 44px high at 375 (en): ${sm}`);
      // .back-btn (32px) and .chip (27–29px) are the shared components at their app-wide size (Quiz / Study measure the same);
      // the standalone .nav-btn CTA is 41–42px (paired .nav-btn rows stretch to 45px) → reported, see O-3
      ok(!small.some(t => /plan-cta|mode-card/.test(t.id)), `[L] ${tag}: create card + level cards ≥ 44px high (switch hit area: F3)`);
      const cta = goalT.find(t => t.id === 'planCreateBtn');
      ok(cta && cta.h >= 44, `[L] ${tag}: Build CTA ${cta && cta.w}×${cta && cta.h} ≥ 44px (O-3)`);
      if (lang === 'zh-HK') {
        const all = texts.join('\n'); const hits = [...new Set((all.match(new RegExp(COLLOQUIAL.source, 'g')) || []))];
        ok(hits.length === 0, `[L] ${tag}: plan UI text has no colloquial characters ${hits.join('')}`);
        const latin = all.split('\n').filter(l => /[A-Za-z]{3,}/.test(l) && !/Day \d+ \/ \d+|Life in the UK/.test(l));
        if (latin.length && w === 375) note('zh-HK lines with Latin words: ' + latin.join(' / '));
      }
      ok(errs.length === 0, `[L] ${tag}: 0 errors ${errs.join(' | ')}`);
      await ctx.close();
    }
    // mockup at 375 for comparison (state A, ⓘ, step ①)
    const ctx = await b.newContext({ viewport: { width: 375, height: 800 }, deviceScaleFactor: 2 });
    const pg = await ctx.newPage();
    await pg.goto('file://' + path.join(ROOT, 'mockups', 'study-plan-flow.html')); await settle(pg, 400);
    await pg.screenshot({ path: path.join(SHOTS, 'M-375-mockup-step0.png') });
    await pg.click('#infoBtn'); await settle(pg, 300); await pg.screenshot({ path: path.join(SHOTS, 'M-375-mockup-info.png') });
    await pg.click('#moduleSwitch'); await settle(pg, 400); await pg.screenshot({ path: path.join(SHOTS, 'M-375-mockup-switch-off-modal.png') });
    await pg.evaluate(() => goto(1)); await settle(pg, 300); await pg.screenshot({ path: path.join(SHOTS, 'M-375-mockup-step1.png'), fullPage: true });
    await ctx.close();
  } finally { s.server.kill(); }
}

// ── U: upgrade from the base SW + mixed load ──
async function partU(b) {
  const dir = path.join(WORK, 'pr3-up'); archive(BASE, dir);
  const { base, server } = await startPagesServer(dir);
  const CACHE = 'lifeuk-v1.0.1';
  try {
    const ctx = await b.newContext({ viewport: { width: 375, height: 812 } });
    const pg = await ctx.newPage(); const errs = watch(pg);
    await pg.clock.setFixedTime(NOW);
    await pg.goto(base); await pg.evaluate(() => navigator.serviceWorker.ready);
    await pg.evaluate(async c => { for (let i = 0; i < 75; i++) { if ((await caches.keys()).includes(c)) return; await new Promise(r => setTimeout(r, 200)); } }, CACHE);
    await pg.reload(); await pg.waitForFunction(() => !!navigator.serviceWorker.controller);
    const old = await pg.evaluate(() => ({ v: APP_VERSION, plan: typeof renderPlanCard }));
    ok(old.v === '1.0.1' && old.plan === 'undefined', `[U1] base v1.0.1 SW controlling, no planHome ${JSON.stringify(old)}`);
    await pg.evaluate(() => localStorage.setItem('lifeuk.wrongList', '{"1.0":true}'));
    fs.readdirSync(dir).forEach(f => fs.rmSync(path.join(dir, f), { recursive: true, force: true }));
    appFiles(ROOT).forEach(f => fs.cpSync(path.join(ROOT, f), path.join(dir, f), { recursive: true }));
    const NEW = ['css/screens/plan.css', 'css/components/switch.css', 'css/components/toast.css', 'js/components/switch.js', 'js/components/toast.js', 'js/screens/planHome.js', 'js/screens/planGoal.js'];
    const up = await pg.evaluate(async ({ NEW, CACHE }) => { const reg = await navigator.serviceWorker.getRegistration();
      for (let i = 0; i < 100; i++) { const ch = await caches.open(CACHE); const have = await Promise.all(NEW.map(p => ch.match(new URL(p, location.href).href)));
        const idx = await ch.match(new URL('index.html', location.href).href); const idxTxt = idx ? await idx.text() : '';
        if (have.every(Boolean) && /screenPlanGoal/.test(idxTxt) && !reg.installing && !reg.waiting) return { ok: true, keys: (await caches.keys()).filter(k => k.startsWith('lifeuk')) };
        if (!reg.installing && !reg.waiting) await reg.update().catch(() => {}); await new Promise(r => setTimeout(r, 200)); } return { ok: false }; }, { NEW, CACHE });
    ok(up.ok && up.keys.length === 1, `[U2] new SW (sw.js SHELL changed) refilled ${CACHE} with the 7 new css / js + new index.html ${JSON.stringify(up)}`);
    await pg.reload(); await settle(pg, 400);
    const after = await pg.evaluate(() => ({ plan: typeof renderPlanCard, card: !!byId('planCard'), wrong: localStorage.getItem('lifeuk.wrongList'), keys: Object.keys(localStorage).filter(k => /studyPlan/.test(k)) }));
    ok(after.plan === 'function' && !after.card && after.wrong === '{"1.0":true}' && after.keys.length === 0, `[U3] reload: PR code, entry still hidden, data kept, no plan key ${JSON.stringify(after)}`);
    // preview through the upgraded app, then offline
    await pg.goto(base + '?preview=plan'); await settle(pg, 400);
    ok(await visible(pg, '#planCard .plan-cta'), '[U4] upgraded app: ?preview=plan shows the create card');
    await ctx.setOffline(true);
    await pg.reload(); await settle(pg, 500);
    const offl = await pg.evaluate(() => ({ card: !!document.querySelector('#planCard .plan-cta'), css: getComputedStyle(document.querySelector('#planCard .plan-cta')).borderTopStyle }));
    await pg.click('#planCard .plan-cta'); await settle(pg, 250);
    const gs = await screen(pg);
    await pg.click('#planCreateBtn'); await settle(pg, 300);
    const offCard = await pg.evaluate(() => byId('planCard') && byId('planCard').innerText.replace(/\s+/g, ' '));
    await pg.click('#infoBtn'); await settle(pg); await pg.click('#planFeatureSwitch'); await settle(pg, 200); await pg.click('#confirmOk'); await settle(pg, 200);
    const offToast = await toastState(pg);
    ok(offl.card && offl.css === 'dashed' && gs === 'screenPlanGoal' && /Day 1/.test(offCard || '') && offToast.shown, `[U5] offline: card styled (plan.css from cache), goal screen, Build → "${offCard}", switch + toast work`);
    await ctx.setOffline(false);
    ok(errs.length === 0, `[U] 0 console / page errors ${errs.join(' | ')}`);
    await ctx.close();
  } finally { server.kill(); fs.rmSync(dir, { recursive: true, force: true }); }
  // mixed: base index.html (no PR3 tags / markup) + PR js / css
  const mix = path.join(WORK, 'pr3-mixed'); fs.rmSync(mix, { recursive: true, force: true }); fs.mkdirSync(mix, { recursive: true });
  appFiles(ROOT).forEach(f => fs.cpSync(path.join(ROOT, f), path.join(mix, f), { recursive: true }));
  fs.writeFileSync(path.join(mix, 'index.html'), execSync(`git show ${BASE}:index.html`, { cwd: ROOT }));
  const s2 = await startPagesServer(mix);
  try {
    for (const preview of [false, true]) {
      const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
      const pg = await ctx.newPage(); const errs = watch(pg);
      await pg.clock.setFixedTime(NOW);
      await pg.goto(s2.base); await pg.evaluate(p => { localStorage.clear(); localStorage.setItem('lifeuk.installDismissed', 'true'); if (p) localStorage.setItem('lifeuk.studyPlanPreview', 'true'); }, preview);
      await pg.goto(s2.base); await settle(pg, 500);
      const r = await pg.evaluate(() => ({ fns: [typeof switchHtml, typeof showToast, typeof renderPlanCard, typeof openPlanGoal].join(','),
        css: ['css/components/switch.css', 'css/components/toast.css', 'css/screens/plan.css'].every(h => !!document.querySelector(`link[href="${h}"]`)), grid: document.querySelectorAll('#examGrid button').length, card: !!byId('planCard') }));
      await pg.click('#infoBtn'); await settle(pg); await pg.click('#infoBtn'); await settle(pg);
      await pg.click('#langBtn'); await settle(pg, 300); await pg.click('#langBtn'); await settle(pg, 300);
      await pg.click('#modeExam'); await settle(pg); await pg.click('#examGrid [data-action="startExam"][data-arg="2"]'); await settle(pg, 200); await pg.click('#opt0');
      const quizOk = (await screen(pg)) === 'screenQuiz';
      let goal = '';
      if (preview && r.card) {
        await pg.evaluate(() => leaveToHome()); await settle(pg);
        await pg.click('#planCard .plan-cta').catch(e => { goal = 'click failed ' + e.message; }); await settle(pg, 300);
        goal = goal || await screen(pg);
      }
      const label = preview ? 'preview on' : 'no preview';
      ok(r.fns === 'function,function,function,function' && r.css && r.grid > 0 && quizOk, `[U6] mixed old shell + new js (${label}): late boot loaded switch / toast / planHome / planGoal + 3 css, Home + ⓘ + language + Exam OK ${JSON.stringify(r)}`);
      if (!preview) ok(errs.length === 0 && !r.card, `[U6] mixed (no preview): no card, 0 errors ${errs.join(' | ')}`);
      else ok(!r.card && errs.length === 0, `[U6] mixed + preview on (CUI-0021): no create card on the old shell, 0 errors ${goal} ${errs.join(' | ')}`);
      await ctx.close();
    }
  } finally { s2.server.kill(); fs.rmSync(mix, { recursive: true, force: true }); }
}

(async () => {
  fs.mkdirSync(WORK, { recursive: true }); fs.mkdirSync(SHOTS, { recursive: true });
  const b = await chromium.launch(launchOpts);
  const only = process.env.QA_ONLY || 'HFELU';
  try {
    if (only.includes('H')) await partH(b);
    if (only.includes('F')) await partF(b);
    if (only.includes('E')) await partE(b);
    if (only.includes('L')) await partL(b);
    if (only.includes('U')) await partU(b);
  } catch (e) { fail++; console.log('FAIL: exception', e.stack); }
  await b.close();
  console.log('\nnotes:\n- ' + notes.join('\n- '));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
