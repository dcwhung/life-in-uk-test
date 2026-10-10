// QA plan PR7c (G41: reading runner "✓ Practice done" tag + last-fact "n facts still need practice · q questions" note,
// W-048 mastered-card fade in the runner): real-browser checks over http, UI clicks, zh-HK + en, 320 / 375 / 390px
//   NODE_PATH=/opt/node-tools/node_modules CHROMIUM_PATH=/opt/pw-browsers/chromium \
//     node .proj-docs/qa/scripts/2026-10-10_qa-plan-pr7c-browser.js . <shot-dir>
// D. data: every reading task's paired practice qids == the union of its facts' planFactQids (so n > 0 <=> q > 0)
// A. fresh plan (UI-created): walk Ch 2 reading (4 facts) first → last with Next: no tag, ▶ Practise on every card,
//    last fact note counts all facts, q == main button N; widths 320 / 375 / 390
// B. partly done (Day 3 Ch 4 reading, 24 facts, first = #98): earlier half round of the paired practice task (UI, left
//    mid-way), ▶ Practise #98 from its card, a 🏆 fact (streak seeded), a ticked-not-🏆 fact (ticked in the runner):
//    tags on exactly the done facts across the whole walk, #98 merged node + tag fit 320–390, mastered look (W-048),
//    last fact note n / q, q == N; ▶ Practise the last fact (one answer wrong first → retry) → back on the card, counts
//    drop, tag on; main button → practice task asks exactly q questions → reading done → review: tags everywhere, no note
// C. Ch 1 reading (2 facts): practise the last fact, then the first → the task completes (Result card); forced
//    non-review all-done view: no note, "Finish ✓"
// E. wrong-facts task (drill day): Similar panel, no tag / note on any card
// F. Study mode: no tag even for done facts; tick a card → whole card fades (--fact-mastered-opacity), children not
const { chromium } = require('playwright-core');
const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(process.argv[2]); const SHOTS = path.resolve(process.argv[3] || '/tmp/qa-pr7c-shots');
fs.mkdirSync(SHOTS, { recursive: true });
const { startPagesServer } = require(path.join(ROOT, 'tests', 'pages-server.js'));
let pass = 0, fail = 0; const notes = [];
const ok = (c, m) => { if (c) { pass++; console.log('ok:', m); } else { fail++; console.log('FAIL:', m); } };
const note = m => { notes.push(m); console.log('note:', m); };
const launchOpts = { args: ['--no-sandbox'] }; if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const TODAY = '2026-10-08', DAY3 = '2026-10-10';
const at = (iso, time = '09:00:00') => new Date(`${iso}T${time}`);
const settle = (pg, ms = 150) => pg.waitForTimeout(ms);
const GUARD_MS = 420, WIDTHS = [320, 375, 390], FADE = 0.55, MIN_CONTRAST = 4.5;
const norm = s => (s || '').replace(/\s+/g, ' ').trim();
const screen = pg => pg.evaluate(() => document.querySelector('.screen.active').id);
const T = (pg, key, vars) => pg.evaluate(([k, v]) => t(k, v || undefined), [key, vars || null]);
const boxSel = (d, i) => `#planTaskList button[data-arg="${d}"][data-task="${i}"]`;
const NEXT = '#planRunBody .plan-run-nav [data-action="planStepFact"][data-arg="1"]';
const PREV = '#planRunBody .plan-run-nav [data-action="planStepFact"][data-arg="-1"]';
const MAIN = '#planRunBody .plan-run-nav .nav-btn:last-child';

const overflow = (pg, sel) => pg.evaluate(sel => {
  const root = document.querySelector(sel); if (!root) return ['no root ' + sel];
  const vw = document.documentElement.clientWidth, out = [];
  if (document.documentElement.scrollWidth > vw) out.push(`page scrollWidth ${document.documentElement.scrollWidth} > ${vw}`);
  root.querySelectorAll('*').forEach(e => {
    if (!e.getClientRects().length) return;
    if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return;
    const s = getComputedStyle(e), r = e.getBoundingClientRect();
    if (r.right > vw + 0.5) out.push(`past viewport: "${e.textContent.trim().slice(0, 30)}" right ${Math.round(r.right)}`);
    if ((/hidden|clip/.test(s.overflowX) || s.textOverflow === 'ellipsis') && e.scrollWidth > e.clientWidth + 1) out.push(`clipped-x: "${e.textContent.trim().slice(0, 30)}"`);
  });
  return out;
}, sel);
// text vs what is painted behind it, every ancestor's background + opacity composited (as plan-read-done-test)
const contrastOf = (pg, sel) => pg.evaluate(sel => {
  const rgba = x => { const v = (x.match(/[\d.]+/g) || []).map(Number); return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1]; };
  const over = (back, [r, g, b, a]) => [r, g, b].map((c, i) => c * a + back[i] * (1 - a));
  const mix = (back, top, o) => top.map((c, i) => c * o + back[i] * (1 - o));
  const lum = c => c.map(u => { u /= 255; return u <= 0.03928 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4; }).reduce((a, u, i) => a + u * [0.2126, 0.7152, 0.0722][i], 0);
  const paint = (chain, i, back, fg) => {
    if (i === chain.length) return { bg: back, fg: over(back, fg) };
    const cs = getComputedStyle(chain[i]), o = Number(cs.opacity);
    const inner = paint(chain, i + 1, over(back, rgba(cs.backgroundColor)), fg);
    return { bg: mix(back, inner.bg, o), fg: mix(back, inner.fg, o) };
  };
  const e = document.querySelector(sel); if (!e) return null;
  const chain = []; for (let x = e; x; x = x.parentElement) chain.unshift(x);
  const { bg, fg } = paint(chain, 0, [255, 255, 255], rgba(getComputedStyle(e).color));
  const a = lum(fg), b = lum(bg); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}, sel);

async function boot(pg, base, { lang = 'en', ls = {}, query = '?preview=plan' } = {}) {
  await pg.goto(base); await pg.evaluate(({ lang, ls }) => { localStorage.clear(); localStorage.setItem('lifeuk.installDismissed', 'true');
    Object.entries(ls).forEach(([k, v]) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)));
    localStorage.setItem('lifeuk.uiLang', JSON.stringify(lang)); }, { lang, ls });
  await pg.goto(base + query); await settle(pg, 400);
}
async function answer(pg, right) {
  const c = await pg.evaluate(() => { const q = state.questions[state.current]; return { a: q.a, n: q.o.length }; });
  const picks = right ? c.a : [...Array(c.n).keys()].filter(x => !c.a.includes(x)).slice(0, c.a.length);
  for (const oi of picks) await pg.click('#opt' + oi);
  await settle(pg, 40);
}
// answer the rounds through the UI (wrongFirst: the very first question wrong); returns the distinct keys asked
async function playAll(pg, { wrongFirst = false, max = 200 } = {}) {
  const asked = []; let first = true;
  for (let i = 0; i < max; i++) {
    if ((await screen(pg)) !== 'screenQuiz') break;
    const c = await pg.evaluate(() => ({ i: state.current, n: state.questions.length, k: canonQuestionKey(qKey(state.questions[state.current])) }));
    asked.push(c.k);
    await answer(pg, !(wrongFirst && first)); first = false;
    await pg.click('#nextBtn'); await settle(pg, c.i === c.n - 1 ? GUARD_MS : 30);
  }
  return [...new Set(asked)];
}
// the expected state of the open reading task from storage: done facts (stored ok today + streak-3 🏆), q left
const expected = (pg, date, ti) => pg.evaluate(([date, ti]) => {
  const day = planDayAt(planLoad(), date), task = day.tasks[ti], pair = day.tasks[task.pair];
  const raw = JSON.parse(localStorage.getItem(lsKey(STUDY_PLAN_PROGRESS_LS)) || 'null');
  const log = planLoadLogView(), dl = planDayLog(log, date), okk = dl.ok;
  const st = JSON.parse(localStorage.getItem(lsKey(STREAK_LS)) || '{}');
  const troph = k => questionCopies(k).some(c => (st[c] || 0) >= MASTERY_STREAK);
  const done = task.facts.map(id => { const q = planFactQids(planFactById(id)); return q.length > 0 && q.every(k => okk[k] || troph(k)); });
  const q = planTaskQids(pair).filter(k => !troph(k) && !okk[k]).length;
  return { facts: task.facts, done, n: done.filter(x => !x).length, q, rawOk: raw ? Object.keys((raw.days[date] || {}).ok || {}).length : null };
}, [date, ti]);
const card = pg => pg.evaluate(() => { const norm = s => (s || '').replace(/\s+/g, ' ').trim();
  const body = byId('planRunBody'), f = body.querySelector('.fact'), tag = body.querySelector('.fact-done-tag'), left = body.querySelector('.plan-fact-left');
  const main = body.querySelector('.plan-run-nav .nav-btn:last-child'), pr = body.querySelector('.fact-practise');
  return { id: f ? Number(f.dataset.factId) : null, mastered: !!f && f.classList.contains('mastered'), tag: tag ? tag.textContent.trim() : null,
    tagLast: !!tag && tag === tag.parentElement.lastElementChild, practise: pr ? pr.textContent.trim() : null,
    left: left ? norm(left.textContent) : null, leftRole: left ? left.getAttribute('role') : null,
    leftBeforeNav: !!left && !!left.nextElementSibling && left.nextElementSibling.matches('.plan-run-nav'),
    main: main ? norm(main.textContent) : null, action: main ? main.dataset.action : null, review: !!planRunView && !!planRunView.review,
    pos: planRunView ? planRunView.pos : null, sqm: !!body.querySelector('.sqm.show') };
});
const mainN = c => Number(((c.main || '').match(/\d+/) || [])[0] || (/this one/.test(c.main || '') ? 1 : 0));
const noteText = async (pg, n, q) => T(pg, 'plan.run.lastUndoneNote', { n, qs: await T(pg, 'plan.run.lastUndoneQs', { n: q }) });
const tagText = pg => T(pg, 'plan.run.factDoneTag');
async function toFirst(pg) { for (let i = 0; i < 60; i++) { if (await pg.isDisabled(PREV)) return; await pg.click(PREV); await settle(pg, 60); } }
async function openDayTask(pg, date, ti) {
  if ((await screen(pg)) !== 'screenPlanDay') { await pg.evaluate(() => openPlanDay()); await settle(pg, 250); }
  await pg.click(boxSel(date, ti)); await settle(pg, GUARD_MS);
}
// tag fit at a width: inside the card, one line, clear of the nodes; whole screen no overflow
async function fitAt(pg, L, w, label) {
  await pg.setViewportSize({ width: w, height: 844 }); await settle(pg, 120);
  const o = await overflow(pg, '#screenPlanRun');
  ok(o.length === 0, `[${L} ${w}] ${label}: no overflow${o.length ? ' — ' + o.join('; ') : ''}`);
  const r = await pg.evaluate(() => {
    const c = document.querySelector('#planRunBody .fact'), tagEl = document.querySelector('#planRunBody .fact-done-tag');
    const left = document.querySelector('#planRunBody .plan-fact-left'), vw = document.documentElement.clientWidth;
    const res = {};
    if (tagEl && c) {
      const cr = c.getBoundingClientRect(), tr = tagEl.getBoundingClientRect(), cs = getComputedStyle(tagEl);
      const nodes = [...document.querySelectorAll('#planRunBody .fact-src .sqm-node')].map(n => n.getBoundingClientRect());
      res.tag = { inside: tr.left >= cr.left - 0.5 && tr.right <= cr.right + 0.5, oneLine: tr.height < 2 * (parseFloat(cs.fontSize) + parseFloat(cs.paddingTop)),
        overlap: nodes.some(n => n.left < tr.right && tr.left < n.right && n.top < tr.bottom && tr.top < n.bottom), rightGap: Math.round(cr.right - tr.right) };
    }
    if (left) { const lr = left.getBoundingClientRect(); res.left = { inside: lr.left >= 0 && lr.right <= vw, h: Math.round(lr.height) }; }
    return res;
  });
  if (r.tag) ok(r.tag.inside && r.tag.oneLine && !r.tag.overlap, `[${L} ${w}] ${label}: tag inside card, one line, clear of nodes ${JSON.stringify(r.tag)}`);
  if (r.left) ok(r.left.inside, `[${L} ${w}] ${label}: note inside viewport (h ${r.left.h})`);
  return r;
}
// W-048 runner look of a mastered card: card itself opaque, parts faded, tag (if any) unfaded + ≥ 4.5:1
async function masteredLook(pg, L, kind) {
  const r = await pg.evaluate(() => {
    const prod = e => { let o = 1; for (let x = e; x; x = x.parentElement) o *= Number(getComputedStyle(x).opacity); return o; };
    const f = document.querySelector('#planRunBody .fact.mastered'); if (!f) return null;
    const q = s => f.querySelector(s);
    return { card: Number(getComputedStyle(f).opacity), en: prod(q('.fact-en')), top: prod(q('.fact-top')), nodes: prod(q('.fact-src-nodes')),
      tag: q('.fact-done-tag') ? prod(q('.fact-done-tag')) : null, practise: q('.fact-practise') ? prod(q('.fact-practise')) : null };
  });
  const near = (a, b) => a !== null && Math.abs(a - b) < 1e-3;
  ok(r && near(r.card, 1) && near(r.en, FADE) && near(r.top, FADE) && near(r.nodes, FADE), `[${L}] ${kind} runner card: card opaque, text / buttons / nodes ${FADE} ${JSON.stringify(r)}`);
  if (r && r.tag !== null) {
    ok(near(r.tag, 1), `[${L}] ${kind}: tag not faded (${r.tag})`);
    const cr = await contrastOf(pg, '#planRunBody .fact-done-tag');
    ok(cr >= MIN_CONTRAST, `[${L}] ${kind}: tag composited contrast ${cr.toFixed(2)}:1 ≥ ${MIN_CONTRAST}`);
  }
  return r;
}

// ── D + A + B + C on one UI-created plan; E + F separate ──
async function partMain(b, base, lang) {
  const L = lang === 'en' ? 'en' : 'zh';
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const pg = await ctx.newPage(); pg.setDefaultTimeout(8000); const errs = [];
  pg.on('pageerror', e => errs.push('pageerror: ' + e.message));
  pg.on('console', m => { if (m.type() === 'error' || /\[i18n\] missing/.test(m.text())) errs.push('console: ' + m.text()); });
  const shot = (name, full = false) => pg.screenshot({ path: path.join(SHOTS, `${L}-${name}.png`), fullPage: full });
  await pg.clock.install({ time: at(TODAY) });
  await boot(pg, base, { lang });
  await pg.click('#planCard .plan-cta'); await settle(pg, GUARD_MS);
  await pg.click('#planCreateBtn'); await settle(pg, GUARD_MS);
  ok(await pg.evaluate(() => !!planLoad()), `[${L}] plan created via UI`);
  const TAG = await tagText(pg);
  if (lang === 'zh-HK') ok(TAG === '✓ 已完成練習', `[zh] tag text "${TAG}"`); else ok(TAG === '✓ Practice done', `[en] tag text "${TAG}"`);

  // D: data
  const d = await pg.evaluate(() => { const out = []; for (const day of planLoad().days) day.tasks.forEach((t0, i) => { if (t0.type !== 'read') return;
    const u = new Set(t0.facts.flatMap(id => planFactQids(planFactById(id)))), p = new Set(planTaskQids(day.tasks[t0.pair]));
    out.push({ date: day.date, i, same: u.size === p.size && [...u].every(k => p.has(k)) }); }); return out; });
  ok(d.length > 0 && d.every(x => x.same), `[${L}] D: ${d.length} reading tasks, paired practice qids == union of fact qids in every one`);

  // A: fresh plan, Ch 2 reading (task 2 on Day 1)
  const tasks = await pg.evaluate(dd => planDayAt(planLoad(), dd).tasks.map(x => ({ type: x.type, ch: x.ch, n: (x.facts || []).length, pair: x.pair })), TODAY);
  const readIdx = tasks.map((x, i) => (x.type === 'read' ? i : -1)).filter(i => i >= 0);
  const A = readIdx.find(i => tasks[i].n >= 3 && tasks[i].n <= 6) ?? readIdx[0];
  await openDayTask(pg, TODAY, A);
  let c = await card(pg);
  ok(c.pos === 0 && !c.review, `[${L}] A: fresh reading task opens on fact 1 (pos ${c.pos})`);
  let e = await expected(pg, TODAY, A);
  let tagsSeen = 0, practSeen = 0, notesBefore = 0;
  for (let p = 0; p < e.facts.length; p++) {
    c = await card(pg);
    if (c.tag) tagsSeen++; if (c.practise) practSeen++; if (p < e.facts.length - 1 && c.left) notesBefore++;
    if (p < e.facts.length - 1) { await pg.click(NEXT); await settle(pg, 80); }
  }
  ok(tagsSeen === 0 && practSeen === e.facts.length && notesBefore === 0, `[${L}] A: ${e.facts.length} cards: 0 tags, ▶ Practise on all, no note before the last`);
  c = await card(pg);
  const expA = await noteText(pg, e.facts.length, e.q);
  ok(c.left === norm(expA) && c.leftBeforeNav && c.leftRole === 'status', `[${L}] A last: note "${c.left}" (n ${e.facts.length} = all, q ${e.q}), above nav, role=status`);
  ok(mainN(c) === e.q && c.action === 'planOpenTask', `[${L}] A last: main button "${c.main}" N ${mainN(c)} == q ${e.q}`);
  if (lang === 'zh-HK') ok(c.left === `尚有 ${e.facts.length} 條知識點未完成練習，共 ${e.q} 題`, `[zh] A note literal`);
  else ok(c.left === `${e.facts.length} facts still need practice · ${e.q} questions`, `[en] A note literal plural`);
  const cn = await contrastOf(pg, '#planRunBody .plan-fact-left');
  ok(cn >= MIN_CONTRAST, `[${L}] A: note contrast ${cn.toFixed(2)}:1`);
  for (const w of WIDTHS) { await fitAt(pg, L, w, 'A fresh last fact'); await shot(`A-fresh-last-${w}`, true); }
  await pg.setViewportSize({ width: 390, height: 844 });

  // C: the small reading task (Ch 1, 2 facts): practise the last fact (note → 1), then the first → task done
  const C = readIdx.find(i => tasks[i].n === 2);
  if (C !== undefined) {
    await pg.click('#planRunBack'); await settle(pg, GUARD_MS);
    await openDayTask(pg, TODAY, C);
    await pg.click(NEXT); await settle(pg, 80);
    c = await card(pg); e = await expected(pg, TODAY, C);
    ok(c.left === norm(await noteText(pg, 2, e.q)) && mainN(c) === e.q, `[${L}] C last (nothing done): "${c.left}" / "${c.main}"`);
    await pg.click('#planRunBody .fact-practise'); await settle(pg, GUARD_MS);
    const askedLast = await playAll(pg);
    c = await card(pg); e = await expected(pg, TODAY, C);
    ok(c.pos === 1 && c.tag === TAG && !c.practise && c.tagLast, `[${L}] C: back on the last card after its ▶ Practise (${askedLast.length} Q): tagged, no ▶ Practise`);
    const exp1 = norm(await noteText(pg, 1, e.q));
    ok(e.n === 1 && c.left === exp1 && mainN(c) === e.q, `[${L}] C: note now "${c.left}" (singular n=1, q ${e.q} == N ${mainN(c)})`);
    if (lang === 'en') ok(/^1 fact still needs practice · \d+ questions?$/.test(c.left), `[en] C singular "fact … needs"`);
    await shot('C-last-one-left');
    await pg.click(PREV); await settle(pg, 80);
    c = await card(pg);
    ok(c.tag === null && !!c.practise && c.left === null, `[${L}] C first card: undone, no tag, no note`);
    await pg.click('#planRunBody .fact-practise'); await settle(pg, GUARD_MS);
    await playAll(pg);
    const scr = await screen(pg), kind = await pg.evaluate(() => planRunView && planRunView.kind);
    ok(scr === 'screenPlanRun' && kind === 'done', `[${L}] C: practising the last undone fact finishes the task → Result card (${scr}/${kind})`);
    // forced non-review all-done fact view (e.g. 🏆 changes while open): no note, Finish
    await pg.evaluate(([dd, i]) => planShowFacts({ date: dd, taskIndex: i, from: dd }, 1, false), [TODAY, C]); await settle(pg, 100);
    c = await card(pg);
    ok(c.left === null && c.action === 'planBackToDay' && c.tag === TAG, `[${L}] C all done (not review): no note, "${c.main}", tagged`);
    await pg.click('#planRunBack'); await settle(pg, GUARD_MS);
    await openDayTask(pg, TODAY, C);
    c = await card(pg);
    ok(c.review && c.pos === 0 && c.tag === TAG, `[${L}] C reopened: review mode at fact 1, tagged`);
    await pg.click(NEXT); await settle(pg, 80); c = await card(pg);
    ok(c.review && c.tag === TAG && c.left === null && c.action === 'planBackToDay', `[${L}] C review last: tag, no note, "${c.main}"`);
    await pg.click('#planRunBack'); await settle(pg, GUARD_MS);
  } else note(`[${L}] no 2-fact reading task on ${TODAY}`);

  // B: Day 3 Ch 4 reading (first fact #98)
  await pg.clock.setSystemTime(at(DAY3)); await pg.goto(base + '?preview=plan'); await settle(pg, 400);
  const B = await pg.evaluate(dd => planDayAt(planLoad(), dd).tasks.findIndex(x => x.type === 'read' && x.facts.includes(98)), DAY3);
  ok(B >= 0, `[${L}] B: Day 3 reading task with #98 = task ${B}`);
  const bt = await pg.evaluate(([dd, i]) => { const t0 = planDayAt(planLoad(), dd).tasks[i]; return { facts: t0.facts, pair: t0.pair }; }, [DAY3, B]);
  // a 🏆 fact (index 2) from earlier practice: its question copies at streak 3
  const trophyFact = bt.facts[2];
  await pg.evaluate(id => { planFactQids(planFactById(id)).forEach(k => questionCopies(k).forEach(c => { streaks[c] = MASTERY_STREAK; })); saveStreaks(); }, trophyFact);
  // earlier Practice: the paired practice task's first questions answered right (10), left mid-way via ←
  await pg.evaluate(() => openPlanDay()); await settle(pg, 250);
  await openDayTask(pg, DAY3, bt.pair);
  ok((await screen(pg)) === 'screenQuiz', `[${L}] B: paired practice task opens a round`);
  // (#98's questions answered wrong here, so #98 is left with a wrong answer for its own ▶ Practise below)
  const q98 = await pg.evaluate(() => planFactQids(planFactById(98)));
  for (let i = 0; i < 10; i++) { const k = await pg.evaluate(() => canonQuestionKey(qKey(state.questions[state.current])));
    await answer(pg, !q98.includes(k)); await pg.click('#nextBtn'); await settle(pg, 30); }
  await pg.click('#screenQuiz .back-btn'); await settle(pg, GUARD_MS);
  if (await pg.isVisible('#confirmOk')) { await pg.click('#confirmOk'); await settle(pg, GUARD_MS); }
  ok((await screen(pg)) === 'screenPlanDay', `[${L}] B: left the practice task mid-way → day list`);
  await openDayTask(pg, DAY3, B);
  await toFirst(pg);
  c = await card(pg);
  ok(c.id === 98, `[${L}] B: walk starts at #98`);
  // #98: merged node, ▶ Practise N (2 questions) unless done already
  const n98 = await pg.evaluate(() => planFactQids(planFactById(98)).length);
  const merged = await pg.evaluate(() => [...document.querySelectorAll('#planRunBody .fact-src .sqm-node')].map(n => n.textContent));
  ok(merged.some(x => x.includes('=')), `[${L}] B #98 nodes ${merged.join(' | ')} (merged)`);
  e = await expected(pg, DAY3, B);
  if (!e.done[0]) {
    ok(c.practise && Number((c.practise.match(/\d+/) || [1])[0]) <= n98, `[${L}] B #98 undone: "${c.practise}" (≤ ${n98})`);
    await pg.click('#planRunBody .fact-practise'); await settle(pg, GUARD_MS);
    await playAll(pg);
  } else note(`[${L}] B #98 already done by the half round`);
  c = await card(pg);
  ok(c.id === 98 && c.tag === TAG && c.tagLast && !c.practise, `[${L}] B #98 practised → back on its card, tag at the row end`);
  for (const w of WIDTHS) { await fitAt(pg, L, w, '#98 merged node + tag'); await shot(`B-98-${w}`); }
  await pg.setViewportSize({ width: 390, height: 844 });
  // tick by hand in the runner (✓ button): one done fact (tag stays readable) and one NOT done (mastered look, no tag,
  // ▶ Practise kept, still counted in the note: a tick is not 🏆, G37)
  e = await expected(pg, DAY3, B);
  const tickDone = e.done.findIndex((x, i) => x && i > 0 && e.facts[i] !== trophyFact);
  const tickUndone = e.done.findIndex((x, i) => !x && i > 2 && i < e.facts.length - 1);
  for (const [pos, kind] of [[tickDone, 'ticked (done)'], [tickUndone, 'ticked (not done)']].sort((a, b) => a[0] - b[0])) {
    if (pos < 0) { note(`[${L}] B: no fact for ${kind}`); continue; }
    while ((await card(pg)).pos < pos) { await pg.click(NEXT); await settle(pg, 50); }
    await pg.click(`#planRunBody .fact-btn[data-mark="mastered"]`); await settle(pg, 120);
    c = await card(pg);
    ok(c.mastered && (c.tag === TAG) === e.done[pos] && (!!c.practise) === !e.done[pos], `[${L}] B ${kind} #${c.id}: faded card, tag ${c.tag}, ▶ ${c.practise}`);
    await masteredLook(pg, L, kind);
    if (!e.done[pos]) await shot('B-ticked-undone', true);
  }
  const eT = await expected(pg, DAY3, B);
  ok(eT.n === e.n, `[${L}] B: ticking does not change n (${e.n} → ${eT.n})`);
  await toFirst(pg);
  // walk the whole task: tag iff done, never both
  e = await expected(pg, DAY3, B);
  const bad = []; let tags = 0;
  for (let p = 0; p < e.facts.length; p++) {
    c = await card(pg);
    if (c.id !== e.facts[p]) bad.push(`pos ${p} id ${c.id}≠${e.facts[p]}`);
    if ((c.tag === TAG) !== e.done[p]) bad.push(`#${c.id} tag ${c.tag} done ${e.done[p]}`);
    if (!!c.tag === !!c.practise) bad.push(`#${c.id} tag+practise both/neither`);
    if (c.tag && !c.tagLast) bad.push(`#${c.id} tag not last`);
    if (p < e.facts.length - 1 && c.left) bad.push(`#${c.id} note before last`);
    if (c.tag) tags++;
    if (c.id === trophyFact) { ok(c.tag === TAG && c.mastered, `[${L}] B 🏆 fact #${c.id}: tag + mastered`); await masteredLook(pg, L, '🏆'); await shot('B-trophy-card', true); }
    if (p < e.facts.length - 1) { await pg.click(NEXT); await settle(pg, 60); }
  }
  ok(bad.length === 0, `[${L}] B walk ${e.facts.length} cards: tag on exactly the ${e.done.filter(Boolean).length} done facts (${tags} tags)${bad.length ? ' — ' + bad.join('; ') : ''}`);
  ok(tags >= 2 && tags < e.facts.length, `[${L}] B: partly done (${tags} / ${e.facts.length}; stored ok today ${e.rawOk})`);
  c = await card(pg);
  const expB = norm(await noteText(pg, e.n, e.q));
  ok(c.left === expB && c.leftBeforeNav, `[${L}] B last: "${c.left}" (n ${e.n}, q ${e.q})`);
  ok(mainN(c) === e.q, `[${L}] B last: q ${e.q} == button N ${mainN(c)} ("${c.main}")`);
  for (const w of WIDTHS) { await fitAt(pg, L, w, 'B partly-done last fact'); await shot(`B-last-${w}`, true); }
  await pg.setViewportSize({ width: 390, height: 844 });
  // ▶ Practise the last fact, first answer wrong (retry round), back → counts drop, tag on
  const before = e;
  const lastQids = await pg.evaluate(id => planFactQids(planFactById(id)).length, e.facts[e.facts.length - 1]);
  if (c.practise) {
    await pg.click('#planRunBody .fact-practise'); await settle(pg, GUARD_MS);
    // first wrong, then leave mid-way? no: finish with retry
    await playAll(pg, { wrongFirst: true });
    c = await card(pg); e = await expected(pg, DAY3, B);
    ok(c.pos === e.facts.length - 1 && c.tag === TAG && !c.practise, `[${L}] B: ▶ Practise from the last fact (1 wrong → retried) → back on the last card, tagged`);
    ok(e.n === before.n - 1 && e.q <= before.q - 1 && e.q >= before.q - lastQids, `[${L}] B: counts updated n ${before.n}→${e.n}, q ${before.q}→${e.q} (last fact ${lastQids} qids)`);
    ok(c.left === norm(await noteText(pg, e.n, e.q)) && mainN(c) === e.q, `[${L}] B: note "${c.left}", button N ${mainN(c)}`);
  } else note(`[${L}] B last fact already done`);
  // main button → practice task asks exactly q, then the reading task is done (G3)
  const qNow = e.q;
  await pg.click(MAIN); await settle(pg, GUARD_MS);
  ok((await screen(pg)) === 'screenQuiz', `[${L}] B: main button opens the practice task`);
  const asked = await playAll(pg);
  ok(asked.length === qNow, `[${L}] B: practice task asked ${asked.length} distinct questions == q ${qNow}`);
  await pg.click('#planRunBack').catch(() => {}); await settle(pg, GUARD_MS);
  await openDayTask(pg, DAY3, B);
  c = await card(pg);
  ok(c.review && c.pos === 0, `[${L}] B: reading reopened → review mode (task done by the practice task)`);
  let rbad = 0; const total = (await expected(pg, DAY3, B)).facts.length;
  for (let p = 0; p < total; p++) { c = await card(pg); if (c.tag !== TAG || c.practise || (c.left && true)) rbad++; if (p < total - 1) { await pg.click(NEXT); await settle(pg, 50); } }
  ok(rbad === 0 && c.action === 'planBackToDay', `[${L}] B review: ${total} cards all tagged, no ▶ Practise, no note; last "${c.main}"`);
  for (const w of [320]) await fitAt(pg, L, w, 'B review last');
  await pg.setViewportSize({ width: 390, height: 844 });
  ok(errs.length === 0, `[${L}] main: no page errors / missing i18n${errs.length ? ': ' + errs.join(' | ') : ''}`);
  await ctx.close();
}

// E: wrong-facts task on a drill day (as plan-run2-test: plan from 09-28, today 10-06, wrong 1.0 / 2.3 / 5.7)
async function partE(b, base, lang) {
  const L = lang === 'en' ? 'en' : 'zh';
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const pg = await ctx.newPage(); pg.setDefaultTimeout(8000); const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.clock.install({ time: at('2026-10-06') });
  await boot(pg, base, { lang });
  await pg.evaluate(() => { ['1.0', '2.3', '5.7'].forEach(k => addWrong(questionByKey(k)));
    writeStudyPlan(buildPlan({ examDate: '2026-10-29', dailyMins: 120, restDays: [0], level: 'none' }, '2026-09-28')); });
  await pg.goto(base + '?preview=plan'); await settle(pg, 400);
  await pg.evaluate(() => openPlanDay()); await settle(pg, 250);
  const wi = await pg.evaluate(() => planDayAt(planLoad(), '2026-10-06').tasks.findIndex(x => x.type === 'wrongFacts'));
  ok(wi >= 0, `[${L}] E: drill day has a wrong-facts task (${wi})`);
  if (wi >= 0) {
    await openDayTask(pg, '2026-10-06', wi);
    await toFirst(pg);
    const n = await pg.evaluate(() => planRunContext(planRunView.date, planRunView.taskIndex).task.facts.length);
    let bad = 0, c;
    for (let p = 0; p < n; p++) { c = await card(pg); if (!c.sqm || c.tag || c.left) bad++; if (p < n - 1) { await pg.click(NEXT); await settle(pg, 60); } }
    ok(bad === 0 && c.action === 'planPractiseTask', `[${L}] E: ${n} wrong-fact cards: Similar panel, no tag, no note; last "${c.main}"`);
    const o = await overflow(pg, '#screenPlanRun'); ok(o.length === 0, `[${L}] E: no overflow`);
  }
  ok(errs.length === 0, `[${L}] E: no page errors`);
  await ctx.close();
}

// F: Study mode (UI): no tag on done facts; tick → whole card fades
async function partF(b, base, lang) {
  const L = lang === 'en' ? 'en' : 'zh';
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const pg = await ctx.newPage(); pg.setDefaultTimeout(8000); const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.clock.install({ time: at(TODAY) });
  await boot(pg, base, { lang });
  await pg.evaluate(() => { const plan = buildPlan({ examDate: '2026-10-29', dailyMins: 120, restDays: [0], level: 'none' }, '2026-10-08'); writeStudyPlan(plan);
    const ok = {}; STUDY.slice(0, 6).forEach(f => planFactQids(f).forEach(k => { ok[k] = 1; })); writePlanLog({ v: 1, days: { '2026-10-08': { ok } } }); });
  await pg.goto(base + '?preview=plan'); await settle(pg, 400);
  await pg.click('#modeStudy'); await settle(pg, GUARD_MS);
  // the cards on screen: their questions all right today in the plan log (+ one 🏆) → done in plan terms, then redraw
  const shown = await pg.evaluate(() => { const ids = [...document.querySelectorAll('#screenStudy .fact')].map(e => Number(e.dataset.factId));
    const lg = JSON.parse(localStorage.getItem(lsKey(STUDY_PLAN_PROGRESS_LS))); ids.forEach(id => planFactQids(planFactById(id)).forEach(k => { lg.days['2026-10-08'].ok[k] = 1; }));
    writePlanLog(lg); renderStudy();
    return ids.filter(id => planFactDone(id, planDayLog(planLoadLogView(), '2026-10-08'))).length; });
  const r = await pg.evaluate(() => ({ cards: document.querySelectorAll('#screenStudy .fact').length, tags: document.querySelectorAll('.fact-done-tag').length }));
  ok(r.cards > 0 && shown === r.cards && r.tags === 0, `[${L}] F: Study ${r.cards} cards, ${shown} of them done in the plan today: 0 tags`);
  const id = await pg.evaluate(() => document.querySelector('#screenStudy .fact:not(.mastered)').dataset.factId);
  await pg.click(`#screenStudy .fact[data-fact-id="${id}"] .fact-btn[data-mark="mastered"]`); await settle(pg, 150);
  const o = await pg.evaluate(id => { const f = document.querySelector(`#screenStudy .fact[data-fact-id="${id}"]`);
    return { card: Number(getComputedStyle(f).opacity), en: Number(getComputedStyle(f.querySelector('.fact-en')).opacity), mastered: f.classList.contains('mastered'),
      token: getComputedStyle(document.documentElement).getPropertyValue('--fact-mastered-opacity').trim() }; }, id);
  ok(o.mastered && Math.abs(o.card - FADE) < 1e-3 && o.en === 1 && o.token === '0.55', `[${L}] F: ticked Study card fades whole ${JSON.stringify(o)}`);
  await pg.evaluate(id => document.querySelector(`#screenStudy .fact[data-fact-id="${id}"]`).scrollIntoView({ block: 'center' }), id);
  await pg.screenshot({ path: path.join(SHOTS, `${L}-F-study-mastered.png`) });
  ok(errs.length === 0, `[${L}] F: no page errors`);
  await ctx.close();
}

(async () => {
  const b = await chromium.launch(launchOpts);
  const s = await startPagesServer(ROOT);
  const only = process.env.QA_ONLY || 'MEF';
  try {
    for (const lang of ['zh-HK', 'en']) {
      if (only.includes('M')) await partMain(b, s.base, lang);
      if (only.includes('E')) await partE(b, s.base, lang);
      if (only.includes('F')) await partF(b, s.base, lang);
    }
  } finally { s.server.kill(); await b.close(); }
  notes.forEach(n => console.log('note:', n));
  console.log(`\nQA PR7c browser: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
