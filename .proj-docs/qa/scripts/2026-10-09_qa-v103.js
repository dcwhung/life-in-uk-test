// QA v1.0.3 — study order rows, reset boxes, My Review tiles by orientation, day list chapter bullets / pill column,
// plus flows (day screen from a row click / Enter, language switch, change goal, reset plan, home resets, tiles).
// usage: NODE_PATH=/opt/node-tools/node_modules node 2026-10-09_qa-v103.js <new-root> <shot-dir>
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const [ROOT, OUT] = process.argv.slice(2);
const NOW = new Date('2026-10-08T09:00:00');
const GOAL = { examDate: '2026-10-29', dailyMins: 120, restDays: [0], level: 'none' };
const START = '2026-09-28';
const LANGS = ['en', 'zh-HK'];
const VIEWPORTS = [[320, 640], [390, 844], [600, 900], [768, 1024], [844, 390], [1024, 768]];
let pass = 0, fail = 0; const fails = [];
const ck = (c, m) => { if (c) pass++; else { fail++; fails.push(m); console.log('FAIL:', m); } };
const url = (q = '?preview=plan') => 'file://' + path.resolve(ROOT, 'index.html') + q;
async function fresh(pg, q) { await pg.goto(url(q)); await pg.evaluate(() => localStorage.clear()); await pg.goto(url(q)); }
async function seed(pg) {
  await pg.evaluate(({ goal, start }) => {
    const plan = buildPlan(goal, start); writeStudyPlan(plan);
    const qidsOf = d => d.tasks.flatMap(planTaskQids), ok = l => Object.fromEntries(l.map(k => [k, 1]));
    const d2 = plan.days[1], d3 = plan.days[2];
    writePlanLog({ v: 1, days: { [d2.date]: { ok: ok(qidsOf(d2)) }, [d3.date]: { ok: ok(qidsOf(d3).slice(0, 5)) } } });
  }, { goal: GOAL, start: START });
}
const seedReview = (pg, w, f) => pg.evaluate(([w, f]) => {
  const keys = n => Object.fromEntries(Array.from({ length: n }, (_, i) => [`${1 + Math.floor(i / 24)}.${(i % 24) + 1}`, true]));
  wrongList = keys(w); practiceFlags = keys(f);
  localStorage.setItem('lifeuk.wrongList', JSON.stringify(wrongList));
  localStorage.setItem('lifeuk.practiceFlags', JSON.stringify(practiceFlags));
  leaveToHome(); startMode('practice');
}, [w, f]);
const noHScroll = pg => pg.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
const shot = async (pg, name, sel) => { const p = path.join(OUT, name + '.png'); if (sel) { const e = await pg.$(sel); if (e) { await e.screenshot({ path: p }); return; } } await pg.screenshot({ path: p }); };

// ── schedule ──
async function scheduleChecks(pg, tag) {
  const r = await pg.evaluate(() => {
    const R = e => e.getBoundingClientRect();
    const txt = e => { const g = document.createRange(); g.selectNodeContents(e); return g.getBoundingClientRect(); };
    const ord = [...document.querySelectorAll('.plan-ord-body')].map(b => {
      const name = b.querySelector('.plan-ord-name'), why = b.querySelector('.plan-ord-why'), chw = b.querySelector('.plan-chw');
      const bar = chw.querySelector('.plan-chw-bar'), c = chw.querySelector('.plan-chw-c');
      return { order: R(name).bottom <= R(why).top + 0.5 && R(why).bottom <= R(chw).top + 0.5,
        bw: R(bar).width, bx: R(bar).left, cx: R(c).left, cw: R(c).width, gapTxt: txt(c).left - R(bar).right, gapCol: R(c).left - R(bar).right,
        cRight: txt(c).right, rowRight: R(chw).right, bodyRight: R(b).right, rowLeft: R(chw).left, bodyLeft: R(b).left, cOver: c.scrollWidth - c.clientWidth };
    });
    const rows = [...document.querySelectorAll('#planDayList .plan-day')];
    const day = rows.map(row => {
      const side = row.querySelector('.plan-day-side'), box = side.querySelector('.plan-day-d'), pill = side.querySelector('.plan-pill');
      const chs = row.querySelector('.plan-day-chs'), items = chs ? [...chs.querySelectorAll('.plan-day-ch')] : [];
      return { cls: row.className, tag: row.tagName, sideW: R(side).width, pill: pill ? pill.textContent : null,
        pillOk: pill ? R(pill).top >= R(box).bottom - 0.5 && R(pill).left >= R(side).left - 0.5 && R(pill).right <= R(side).right + 0.5 : null,
        items: items.length, itemTops: new Set(items.map(e => Math.round(R(e).top))).size, itemLang: items.every(e => e.getAttribute('lang') === 'en'),
        bullet: items.length ? getComputedStyle(items[0], '::before').content : null, inBtn: chs ? chs.closest('button') === row : null,
        ul: row.querySelectorAll('ul, li, div').length, color: chs ? getComputedStyle(chs).color : null, opens: row.dataset.action === 'openPlanDay' && !!row.dataset.arg };
    });
    const cs = getComputedStyle(document.documentElement);
    return { ord, day, tok: { chs: cs.getPropertyValue('--plan-day-chs-text').trim(), past: cs.getPropertyValue('--plan-past-text').trim(), card: cs.getPropertyValue('--card').trim(), sel: cs.getPropertyValue('--selected-bg').trim(), pastRow: cs.getPropertyValue('--plan-past-row').trim() },
      todayBg: getComputedStyle(document.querySelector('#planDayList .plan-day.today')).backgroundColor };
  });
  const bws = r.ord.map(o => o.bw), bxs = r.ord.map(o => o.bx);
  ck(r.ord.length >= 4 && r.ord.every(o => o.order), `${tag} order: name / why / bar row stacked`);
  ck(Math.max(...bws) - Math.min(...bws) <= 0.5 && Math.max(...bxs) - Math.min(...bxs) <= 0.5, `${tag} order: bars equal length + aligned ${bws.map(Math.round)}`);
  ck(r.ord.every(o => Math.abs(o.rowLeft - o.bodyLeft) <= 0.5 && Math.abs(o.rowRight - o.bodyRight) <= 0.5), `${tag} order: bar row spans full body width`);
  ck(r.ord.every(o => o.gapCol >= 11.5 && o.gapTxt >= 11.5), `${tag} order: >=12px gap ${r.ord.map(o => o.gapTxt.toFixed(0))}`);
  ck(r.ord.every(o => Math.round(o.cw) === 112 && o.cOver <= 0 && o.cRight <= o.rowRight + 0.5), `${tag} order: fixed 112px count column, count fits`);
  const tday = r.day.find(d => /\btoday\b/.test(d.cls));
  ck(r.day.every(d => Math.round(d.sideW) === 72), `${tag} day: 72px side column`);
  ck(r.day.every(d => d.tag === 'BUTTON' && d.opens), `${tag} day: every row is a button that opens its day`);
  ck(r.day.every(d => d.ul === 0), `${tag} day: no block elements (ul/li/div) inside row buttons`);
  const study = r.day.filter(d => d.items);
  ck(study.length > 0 && study.every(d => d.itemTops === d.items && d.itemLang && d.inBtn), `${tag} day: chapter bullets one per line, lang=en, inside the button (${study.length})`);
  ck(study.every(d => /•/.test(d.bullet)), `${tag} day: bullet ::before ${study[0] && study[0].bullet}`);
  const ahead = r.day.filter(d => !/\b(past|today|rest|exam)\b/.test(d.cls));
  ck(ahead.length > 0 && ahead.every(d => d.pill === null), `${tag} day: no pill on ${ahead.length} days ahead`);
  ck(r.day.filter(d => /\b(past|today)\b/.test(d.cls) && !/\brest\b/.test(d.cls)).every(d => d.pill && d.pillOk), `${tag} day: past / today pill under date box, in column`);
  ck(!r.day.some(d => d.pill === '›'), `${tag} day: no "›" pill anywhere`);
  ck(await noHScroll(pg), `${tag} schedule: no horizontal scroll`);
  // pill one line for 0..99
  const lines = await pg.evaluate(() => {
    const pill = document.querySelector('#planDayList .plan-day.today .plan-pill'), was = pill.textContent, bad = [];
    for (let n = 0; n <= 100; n++) {
      pill.textContent = t('plan.status.today', { n });
      const g = document.createRange(); g.selectNodeContents(pill);
      const k = new Set([...g.getClientRects()].map(q => Math.round(q.top))).size;
      const side = pill.parentElement.getBoundingClientRect(), p = pill.getBoundingClientRect();
      if ((n < 100 && k !== 1) || p.right > side.right + 0.5 || p.left < side.left - 0.5) bad.push(n + ':' + k);
    }
    pill.textContent = was; return bad;
  });
  ck(lines.length === 0, `${tag} day: "Today 0–99%" one line, 100% inside column ${lines}`);
  return r;
}
// WCAG contrast from computed rgb strings
function lum(rgb) { const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
async function contrastChecks(pg) {
  const c = await pg.evaluate(() => {
    const rgb = v => { const d = document.createElement('i'); d.style.color = v; document.body.appendChild(d); const o = getComputedStyle(d).color; d.remove(); return o; };
    const cs = getComputedStyle(document.documentElement), tk = n => rgb(cs.getPropertyValue(n).trim());
    const today = document.querySelector('#planDayList .plan-day.today .plan-day-chs'), past = document.querySelector('#planDayList .plan-day.past .plan-day-chs'),
      ahead = document.querySelector('#planDayList .plan-day:not(.past):not(.today) .plan-day-chs');
    const bgOf = e => { for (let n = e; n; n = n.parentElement) { const b = getComputedStyle(n).backgroundColor; if (!/rgba\(0, 0, 0, 0\)|transparent/.test(b)) return b; } return 'rgb(255, 255, 255)'; };
    return { chs: tk('--plan-day-chs-text'), card: tk('--card'), sel: tk('--selected-bg'), white: 'rgb(255, 255, 255)',
      todayFg: getComputedStyle(today).color, todayBg: bgOf(today), aheadFg: getComputedStyle(ahead).color, aheadBg: bgOf(ahead),
      pastFg: past ? getComputedStyle(past).color : null, pastBg: past ? bgOf(past) : null, pastTok: tk('--plan-past-text') };
  });
  const rows = [['token on white', c.chs, c.white], ['token on --selected-bg', c.chs, c.sel], ['today row (rendered)', c.todayFg, c.todayBg], ['ahead row (rendered)', c.aheadFg, c.aheadBg]];
  if (c.pastFg) rows.push(['past row (rendered)', c.pastFg, c.pastBg]);
  const out = rows.map(([n, f, b]) => [n, f, b, ratio(f, b).toFixed(2)]);
  out.forEach(([n, , , v]) => ck(+v >= 4.5, `contrast ${n} ${v}:1`));
  ck(c.todayFg === c.chs && c.aheadFg === c.chs, 'chapter list uses --plan-day-chs-text on today / ahead');
  ck(!c.pastFg || c.pastFg === c.pastTok, 'past rows chapter list grey (--plan-past-text)');
  return out;
}

async function resetBoxChecks(pg, sel, tag) {
  const r = await pg.evaluate(sel => {
    const box = document.querySelector(sel), hint = box.firstElementChild, btn = box.querySelector('.reset-btn');
    const B = box.getBoundingClientRect(), b = btn.getBoundingClientRect(), h = hint.getBoundingClientRect(), cs = getComputedStyle(box);
    const inner = B.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
    btn.scrollIntoView({ block: 'center' });
    const bb = btn.getBoundingClientRect(), cx = bb.left + bb.width / 2, cy = bb.top + bb.height / 2;
    const hit = d => { const e = document.elementFromPoint(cx, cy + d); return !!e && (e === btn || btn.contains(e)); };
    return { below: b.top >= h.bottom - 0.5, full: Math.abs(b.width - inner) <= 1, w: [b.width, inner], h: b.height, tap44: hit(-21) && hit(21), disp: cs.display };
  }, sel);
  ck(r.disp === 'grid' && r.below, `${tag}: button on its own row below the hint`);
  ck(r.full, `${tag}: button full box width ${r.w.map(Math.round)}`);
  return r;
}

async function scheduleMatrix(pg) {
  await fresh(pg); await seed(pg);
  for (const lang of LANGS) {
    await pg.evaluate(l => setLang(l), lang);
    for (const [w, h] of VIEWPORTS) {
      await pg.setViewportSize({ width: w, height: h });
      const tag = `${lang} ${w}x${h}`;
      await pg.evaluate(() => openPlanSchedule());
      await scheduleChecks(pg, tag);
      const pr = await resetBoxChecks(pg, '#screenPlanSchedule .plan-reset', tag + ' plan reset');
      ck(pr.tap44, `${tag} plan reset: >=44px tap (${Math.round(pr.h)}px box)`);
      if ([320, 390, 600].includes(w)) {
        await pg.$eval('#planOrder', e => e.scrollIntoView());
        await shot(pg, `order-${lang}-${w}`, '#planOrder');
        await pg.$eval('#planDayList', e => e.scrollIntoView());
        await shot(pg, `days-${lang}-${w}`, '#planDayList');
        await shot(pg, `plan-reset-${lang}-${w}`, '#screenPlanSchedule .plan-reset');
      }
    }
  }
  await pg.setViewportSize({ width: 390, height: 844 });
  await pg.evaluate(() => { setLang('en'); openPlanSchedule(); });
  return contrastChecks(pg);
}

async function homeMatrix(pg) {
  await fresh(pg, '');
  for (const lang of LANGS) {
    await pg.evaluate(l => setLang(l), lang);
    for (const [w, h] of VIEWPORTS) {
      await pg.setViewportSize({ width: w, height: h });
      const tag = `${lang} ${w}x${h}`;
      await seedReview(pg, 30, 8);
      const t = await pg.evaluate(() => {
        const a = byId('tileWrong').getBoundingClientRect(), b = byId('tileFlagged').getBoundingClientRect(), g = document.querySelector('.my-grid').getBoundingClientRect();
        return { stacked: b.top >= a.bottom, full: Math.abs(a.width - g.width) <= 1 && Math.abs(b.width - g.width) <= 1, side: Math.abs(a.top - b.top) <= 1 && a.right <= b.left, eqH: Math.abs(a.height - b.height) <= 1, portrait: matchMedia('(orientation: portrait)').matches };
      });
      if (h >= w) ck(t.portrait && t.stacked && t.full, `${tag} My Review: portrait stacked full width ${JSON.stringify(t)}`);
      else ck(!t.portrait && t.side && t.eqH, `${tag} My Review: landscape side by side, equal height ${JSON.stringify(t)}`);
      await resetBoxChecks(pg, '#practiceReset', tag + ' practice reset');
      ck(await noHScroll(pg), `${tag} home practice: no horizontal scroll`);
      if ([320, 390, 844].includes(w)) { await pg.evaluate(() => scrollTo(0, 0)); await shot(pg, `home-practice-${lang}-${w}x${h}`, '#screenHome'); }
      await pg.evaluate(() => startMode('exam'));
      await resetBoxChecks(pg, '#examReset', tag + ' exam reset');
      ck(await noHScroll(pg), `${tag} home exam: no horizontal scroll`);
      if (w === 320) await shot(pg, `exam-reset-${lang}-320`, '#examReset');
    }
  }
}

async function flows(pg) {
  const errs = [];
  await fresh(pg); await seed(pg);
  await pg.setViewportSize({ width: 390, height: 844 });
  for (const lang of LANGS) {
    await pg.evaluate(l => { setLang(l); openPlanSchedule(); }, lang);
    // click a day ahead (no pill) → day screen for that date
    const iso = await pg.evaluate(() => { const r = document.querySelector('#planDayList .plan-day:not(.past):not(.today):not(.rest):not(.exam)'); r.scrollIntoView({ block: 'center' }); return r.dataset.arg; });
    await pg.click(`#planDayList .plan-day[data-arg="${iso}"]`);
    let s = await pg.evaluate(() => ({ s: document.querySelector('.screen.active').id, view: planDayView, title: byId('planDayHeading').textContent }));
    ck(s.s === 'screenPlanDay' && s.view === iso, `${lang} click day ahead ${iso} → day screen ${JSON.stringify(s)}`);
    await shot(pg, `dayscreen-${lang}-390`);
    await pg.click('#screenPlanDay .back-btn');
    ck(await pg.evaluate(() => document.querySelector('.screen.active').id) === 'screenHome', `${lang} day screen back → Home`);
    // Enter on a past row
    await pg.evaluate(() => openPlanSchedule());
    const past = await pg.evaluate(() => { const r = document.querySelector('#planDayList .plan-day.past'); r.focus(); return r.dataset.arg; });
    await pg.keyboard.press('Enter');
    s = await pg.evaluate(() => ({ s: document.querySelector('.screen.active').id, view: planDayView }));
    ck(s.s === 'screenPlanDay' && s.view === past, `${lang} Enter on past row ${past} → day screen`);
    // today row and exam row
    await pg.evaluate(() => openPlanSchedule());
    await pg.evaluate(() => document.querySelector('#planDayList .plan-day.today').click());
    s = await pg.evaluate(() => ({ s: document.querySelector('.screen.active').id, view: planDayView }));
    ck(s.s === 'screenPlanDay' && s.view === null, `${lang} today row → day screen (today)`);
    await pg.evaluate(() => openPlanSchedule());
    await pg.evaluate(() => document.querySelector('#planDayList .plan-day.exam').click());
    s = await pg.evaluate(() => ({ s: document.querySelector('.screen.active').id, view: planDayView }));
    ck(s.s === 'screenPlanDay' && s.view === '2026-10-29', `${lang} exam row → exam day`);
  }
  // language switch on schedule via header pill
  await pg.evaluate(() => { setLang('en'); openPlanSchedule(); });
  await pg.setViewportSize({ width: 320, height: 640 });
  await pg.click('#langBtn');
  ck(await pg.evaluate(() => getLang()) === 'zh-HK', 'lang switch on schedule → zh-HK');
  await scheduleChecks(pg, 'after switch zh 320');
  await pg.click('#langBtn');
  await scheduleChecks(pg, 'after switch en 320');
  // change goal
  const before = await pg.evaluate(() => JSON.stringify(readStudyPlan().days.filter(d => d.date < '2026-10-08')));
  await pg.click('#screenPlanSchedule [data-action="planEditGoal"]');
  await pg.click('#planDaysChips .chip >> nth=2');
  await pg.click('#planCreateBtn');
  const cg = await pg.evaluate(() => ({ s: document.querySelector('.screen.active').id, past: JSON.stringify(readStudyPlan().days.filter(d => d.date < '2026-10-08')) }));
  ck(cg.s === 'screenPlanSchedule' && cg.past === before, 'change goal: schedule reopens, past days unchanged');
  await scheduleChecks(pg, 'after change goal 320');
  // reset plan via tap on the button
  const guard = await pg.evaluate(() => { const g = clickGuard; const b = document.querySelector('#screenPlanSchedule .plan-reset .reset-btn'); b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return { g: g && { x: g.x, y: g.y, at: g.at }, btn: [r.left + r.width / 2, r.top + r.height / 2], now: performance.now() }; });
  console.log('guard before reset click', JSON.stringify(guard));
  await pg.waitForTimeout(400); // CUI-0011 guard: a pointer click within 40px / 350ms of the Create click is a stray double tap
  await pg.click('#screenPlanSchedule .plan-reset .reset-btn');
  const rm = await pg.evaluate(() => ({ open: isConfirmOpen(), s: document.querySelector('.screen.active').id, y: scrollY, focus: document.activeElement.className, toast: byId('appToast').hidden ? null : byId('appToast').textContent }));
  ck(rm.open, 'reset plan: confirm modal ' + JSON.stringify(rm));
  if (!rm.open) { await shot(pg, 'DEBUG-reset'); return errs; }
  await pg.click('#confirmOk');
  ck(await pg.evaluate(() => readStudyPlan() === null && document.querySelector('.screen.active').id === 'screenHome'), 'reset plan: plan deleted, Home');
  // home practice reset
  await seedReview(pg, 5, 3);
  await pg.evaluate(() => localStorage.setItem(STREAK_LS, '{"1.1":3}'));
  await pg.click('#practiceReset .reset-btn');
  ck(await pg.evaluate(() => isConfirmOpen()), 'practice reset: confirm modal');
  await pg.click('#confirmCancel');
  ck(await pg.evaluate(() => localStorage.getItem(STREAK_LS)) === '{"1.1":3}', 'practice reset: Cancel keeps progress');
  await pg.click('#practiceReset .reset-btn'); await pg.click('#confirmOk');
  ck(await pg.evaluate(() => { const s = localStorage.getItem(STREAK_LS); return !s || s === '{}'; }), 'practice reset: Confirm clears streaks');
  // exam reset
  await pg.evaluate(() => localStorage.setItem(COMPLETED_LS, '[1,2]'));
  await pg.reload();
  await pg.evaluate(() => startMode('exam'));
  await pg.click('#examReset .reset-btn');
  ck(await pg.evaluate(() => isConfirmOpen()), 'exam reset: confirm modal');
  await pg.click('#confirmOk');
  ck(await pg.evaluate(() => { const s = localStorage.getItem(COMPLETED_LS); return !s || s === '[]' || s === '{}'; }), 'exam reset: Confirm clears completed exams');
  // tiles open their screens
  await seedReview(pg, 6, 4);
  await pg.click('#tileWrong');
  ck(await pg.evaluate(() => document.querySelector('.screen.active').id) === 'screenQuiz', 'wrong tile → quiz');
  await pg.evaluate(() => leaveToHome());
  await seedReview(pg, 6, 4);
  await pg.click('#tileFlagged');
  ck(await pg.evaluate(() => document.querySelector('.screen.active').id) === 'screenFlagged', 'flagged tile → flagged screen');
  // version
  ck(await pg.evaluate(() => APP_VERSION === '1.0.3' && byId('appVersion').textContent.includes('1.0.3')), 'APP_VERSION 1.0.3 shown');
  return errs;
}

async function presets(pg) {
  await fresh(pg);
  for (const lang of LANGS) for (const w of [320, 340, 341, 390]) {
    await pg.setViewportSize({ width: w, height: 800 });
    await pg.evaluate(l => { setLang(l); openPlanGoal(); }, lang);
    await pg.waitForTimeout(600); // chip padding / font-size transition
    const r = await pg.evaluate(() => { const c = [...document.querySelectorAll('#planDaysChips .chip')]; return { rows: new Set(c.map(e => Math.round(e.getBoundingClientRect().top))).size, clip: c.filter(e => e.scrollWidth > e.clientWidth + 0.5).length, pad: getComputedStyle(c[0]).paddingLeft, fs: getComputedStyle(c[0]).fontSize }; });
    ck(r.rows === 1 && r.clip === 0, `${lang} ${w} presets one row, unclipped ${JSON.stringify(r)}`);
    ck((w <= 340) === (r.pad === '0px'), `${lang} ${w} <=340px rule applies only at <=340 (${r.pad})`);
  }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--no-sandbox'], executablePath: process.env.CHROMIUM_PATH });
  const pg = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.clock.setFixedTime(NOW);
  console.log('== schedule'); const contrast = await scheduleMatrix(pg);
  console.log('== home'); await homeMatrix(pg);
  console.log('== presets'); await presets(pg);
  console.log('== flows'); await flows(pg);
  ck(errs.length === 0, 'no page errors ' + errs.join(' | '));
  await b.close();
  console.log('contrast', JSON.stringify(contrast));
  console.log(`\nRESULT ${pass} pass / ${fail} fail`); if (fails.length) console.log(fails.join('\n'));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
