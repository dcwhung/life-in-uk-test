// QA v2.3.0 (branch claude/quirky-newton-wdelbs @ 4913ce1): memo desktop + phone layout (mockup
// mockups/v2.0.0/desktop-memo.html rev 6) + phone one-screen Quiz (P6) + per-session fallback latch (W-082 / S-268).
// Exploratory checks beyond tests/*.js: real taps (isMobile + hasTouch below 1024px) / mouse clicks, whole flows.
//   NODE_PATH=/opt/node-tools/node_modules CHROMIUM_PATH=… node .proj-docs/qa/scripts/2026-10-13_qa-v230.js [M E Q P L R D] [--shots DIR]
// Sections: M memo flow matrix, E English reminders, Q phone quiz every mode, P plan review mode, L latch, R regression smoke, D documented risks
// Soft checks: every check is printed (ok / FAIL) and counted; exit code 1 when any check fails.
const path = require('path');
const fs = require('fs');
const dt = require(path.resolve(__dirname, '../../../tests/desktop-helpers'));
const { chromium } = require('playwright-core');

const argv = process.argv.slice(2);
const shotsAt = argv.indexOf('--shots');
const SHOTS = shotsAt >= 0 ? argv[shotsAt + 1] : null;
const SECTIONS = argv.filter((a, i) => /^[A-Z]$/.test(a) && (shotsAt < 0 || i !== shotsAt + 1));
const want = s => !SECTIONS.length || SECTIONS.includes(s);
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const GUARD_WAIT_MS = 400; // > SCREEN_CHANGE_CLICK_GUARD_MS (350): a later tap is never a stray double tap
const NAV_ROOM = 40; // Prev / Next within the screen's last 40px (phone-quiz-test BOTTOM_ROOM)
const PHONES = [{ width: 390, height: 844 }, { width: 375, height: 667 }, { width: 375, height: 553 }, { width: 320, height: 568 }];
const DESKS = [{ width: 1024, height: 768 }, { width: 1280, height: 800 }];
const LANGS = ['en', 'zh-HK'], FONTS = ['small', 'large'], TRANS = [true, false];

const tally = {};
const fails = [];
function check(sec, label, ok, detail = '') {
  tally[sec] = tally[sec] || { pass: 0, fail: 0 };
  tally[sec][ok ? 'pass' : 'fail']++;
  const line = `${ok ? 'ok  ' : 'FAIL'} [${sec}] ${label}${detail ? ' — ' + detail : ''}`;
  if (!ok) fails.push(line);
  if (!ok || process.env.VERBOSE) console.log(line);
  return ok;
}
const note = (sec, text) => console.log(`note [${sec}] ${text}`);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const frame = page => dt.nextFrame(page);
const cfgLabel = c => `${c.viewport.width}×${c.viewport.height} ${c.lang} ${c.fontSize} tr-${c.translation ? 'on' : 'off'}`;
const isPhone = c => c.viewport.width < 1024;

async function open(b, cfg) {
  const phone = isPhone(cfg);
  // reducedMotion (R only): the plan schedule's day list scrolls smoothly, so scrollIntoView would still be moving when measured
  const ctx = await b.newContext({ viewport: cfg.viewport, isMobile: phone, hasTouch: phone, deviceScaleFactor: 1, reducedMotion: cfg.reducedMotion || 'no-preference' });
  await ctx.addInitScript(([lang, font, tr]) => {
    try {
      if (sessionStorage.getItem('qa.seeded')) return;
      localStorage.setItem('lifeuk.uiLang', JSON.stringify(lang));
      localStorage.setItem('lifeuk.fontSize', JSON.stringify(font));
      localStorage.setItem('lifeuk.translation', JSON.stringify(tr ? 'on' : 'off'));
      sessionStorage.setItem('qa.seeded', '1');
    } catch { /* about:blank */ }
  }, [cfg.lang, cfg.fontSize, cfg.translation]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(dt.APP_URL);
  return { page, ctx, errors, phone, label: cfgLabel(cfg) };
}
// a tap on a phone (touch), a mouse click on a desktop; the element is scrolled into view first (as a user would)
async function press(page, phone, sel) {
  const el = await page.$(sel);
  if (!el) throw new Error('no element ' + sel);
  await el.scrollIntoViewIfNeeded();
  if (phone) await el.tap(); else await el.click();
  await frame(page);
}
async function shot(page, name) { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); }

// ── seeds ──
// 3 groups due (one with copies in its questions), 4 learning, 2 done; streaks: one mastered + one weak question in the
// first due group (pill colours)
const seedMemo = page => page.evaluate(() => {
  const today = planTodayIso(), gs = memoGroups().filter(g => g.id !== MEMO_SINGLE_ID);
  const withCopies = gs.find(g => g.body && g.hook && questionGroups(g.qkeys).some(k => k.length > 1));
  const order = [withCopies, ...gs.filter(g => g !== withCopies)];
  const progress = {};
  order.slice(0, 3).forEach(g => { progress[g.id] = { lv: 1, due: isoAddDays(today, -1) }; });
  order.slice(3, 7).forEach(g => { progress[g.id] = { lv: 2, due: isoAddDays(today, 3) }; });
  order.slice(7, 9).forEach(g => { progress[g.id] = { lv: 4, due: isoAddDays(today, 10) }; });
  setLS(MEMO_PROGRESS_LS, progress);
  const keys = questionGroups(withCopies.qkeys);
  streaks[keys[0][0]] = MASTERY_STREAK; streaks[keys[1][0]] = 1; saveStreaks();
  return withCopies.id;
});
const GOAL = { dailyMins: 120, restDays: [0], level: 'none' };
const seedPlan = page => page.evaluate(goal => {
  const today = planTodayIso();
  writeStudyPlan(buildPlan({ ...goal, examDate: isoAddDays(today, 21) }, today));
  writePlanLog(planEmptyLog());
}, GOAL);
const seedRandom = page => page.evaluate(seed => {
  let a = seed >>> 0;
  Math.random = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}, 20261013);

// ── memo measurements ──
const screenState = (page, id) => page.evaluate(sid => {
  const s = byId(sid), el = document.scrollingElement;
  return { active: s.classList.contains('active'), fitPhone: s.classList.contains('is-fit-phone'), flex: getComputedStyle(s).display === 'flex',
    pageScrolls: el.scrollHeight > el.clientHeight + 1, sideways: el.scrollWidth > el.clientWidth + 1, h: el.scrollHeight, view: el.clientHeight };
}, id);
const panelsState = page => page.evaluate(() => [...document.querySelectorAll('.screen.active .fit-panel')].filter(p => p.getClientRects().length && p.clientHeight > 0).map(p => ({
  cls: p.className, scrolls: p.scrollHeight > p.clientHeight + 1, overflow: getComputedStyle(p).overflowY,
  down: !!p.closest('.fit-fade') && p.closest('.fit-fade').classList.contains('can-down'), top: p.scrollTop })));
const pillsState = (page, root) => page.evaluate(sel => [...document.querySelectorAll(sel + ' .memo-pills')].map((r, i) => {
  const tags = r.querySelectorAll('.tag'), node = r.querySelector('.sqm-node');
  return { i, num: tags[0] && tags[0].textContent.trim(), ch: tags[1] && tags[1].textContent.trim(), node: node && node.textContent, nodeCls: node && node.className };
}), root);
function checkPills(sec, L, what, rows, { needCopy = false } = {}) {
  const bad = rows.filter(r => r.num !== `#${r.i + 1}` || !/Ch \d+$/.test(r.ch || '') || !/^E\d+·Q\d+( = E\d+·Q\d+)*$/.test(r.node || ''));
  check(sec, `${L} ${what}: pill rows #n · Ch n · E·Q (${rows.length})`, rows.length > 0 && bad.length === 0, bad.length ? JSON.stringify(bad[0]) : '');
  if (needCopy) check(sec, `${L} ${what}: a question in several exams joins its copies with " = "`, rows.some(r => r.node.includes(' = ')));
}

async function checkOneScreen(sec, L, what, page, phone, id) {
  const s = await screenState(page, id);
  check(sec, `${L} ${what}: no sideways scroll`, !s.sideways);
  if (!phone) check(sec, `${L} ${what}: one screen high, page does not scroll`, !s.pageScrolls, `${s.h}/${s.view}`);
  else if (s.fitPhone && s.flex) check(sec, `${L} ${what}: phone one screen high, page does not scroll`, !s.pageScrolls, `${s.h}/${s.view}`);
  else note(sec, `${L} ${what}: phone fallback (page scrolls; is-fit-phone ${s.fitPhone}, flex ${s.flex})`);
  const reach = await dt.controlsReachable(page);
  check(sec, `${L} ${what}: every control reachable`, reach.ok && reach.count > 0, reach.detail);
  const panels = await panelsState(page);
  panels.filter(p => p.scrolls).forEach(p => check(sec, `${L} ${what}: scrolling panel has overflow auto + bottom fade (${p.cls})`, ['auto', 'scroll'].includes(p.overflow) && (p.top > 1 || p.down)));
  return { s, panels };
}

async function checkList(sec, L, cfg, page, phone) {
  const w = cfg.viewport.width, cols = w >= 1280 ? 4 : w >= 1024 ? 3 : 2;
  const m = await dt.memoListLayout(page);
  check(sec, `${L} list: ${cols} columns`, m.columns === cols, `${m.columns} cols, ${m.cards} cards`);
  check(sec, `${L} list: badge top-right, bar at foot, rows even`, m.bad.length === 0 && m.unequal === 0, m.bad.slice(0, 2).join(' | ') + (m.unequal ? ` unequal ${m.unequal}` : ''));
  check(sec, `${L} list: due banner shown`, !!m.due);
  check(sec, `${L} list: no sideways scroll`, (await dt.noHorizontalScroll(page)).ok);
  if (!phone) {
    check(sec, `${L} list: due banner above the card panel, not inside it`, !!m.due && !m.dueInPanel && m.due.bottom <= m.panel.top + 1, m.due ? `${Math.round(m.due.bottom)} / ${Math.round(m.panel.top)}` : '');
    const moved = await page.evaluate(() => {
      const p = byId('studyContent').closest('.fit-panel') || byId('studyContent'), due = document.querySelector('#screenStudy .memo-due');
      const before = due.getBoundingClientRect().top; p.scrollTop = 400; const after = due.getBoundingClientRect().top; p.scrollTop = 0;
      return { before, after, scrolled: p.scrollHeight > p.clientHeight + 1 };
    });
    check(sec, `${L} list: due banner fixed while the cards scroll`, Math.abs(moved.before - moved.after) <= 1, JSON.stringify(moved));
    check(sec, `${L} list: page does not scroll`, (await dt.pageNotScrolling(page)).ok);
  } else {
    const st = await page.evaluate(() => {
      window.scrollTo(0, 600);
      const top = document.querySelector('#screenStudy .study-top').getBoundingClientRect(), due = document.querySelector('#screenStudy .memo-due').getBoundingClientRect();
      const rows = [...document.querySelectorAll('#screenStudy .study-top .chip-row, #screenStudy .study-top .study-tabs')].map(e => e.getBoundingClientRect().bottom);
      const header = document.querySelector('header').getBoundingClientRect().bottom;
      const r = { y: scrollY, topBottom: top.bottom, dueTop: due.top, dueBottom: due.bottom, lastRow: Math.max(...rows), header, view: innerHeight };
      window.scrollTo(0, 0);
      return r;
    });
    const sticks = st.y > 0 && Math.abs(st.dueTop - st.topBottom) <= 1.5 && st.dueTop - st.lastRow >= 4;
    if (cfg.viewport.height >= 500) check(sec, `${L} list: phone due banner sticks right under .study-top with a gap`, sticks, JSON.stringify(st));
    note(sec, `${L} list: pinned block + banner = ${Math.round(st.dueBottom - st.header)}px of ${st.view}px (${Math.round((st.dueBottom - st.header) / st.view * 100)}%)`);
  }
}

async function checkLook(sec, L, cfg, page, phone, { expectId } = {}) {
  const st = await page.evaluate(() => ({ id: memoView.id, step: memoView.step, active: byId('screenMemo').classList.contains('active') }));
  check(sec, `${L} look: on #screenMemo ① look${expectId ? ' of ' + expectId : ''}`, st.active && st.step === 'look' && (!expectId || st.id === expectId), JSON.stringify(st));
  await checkOneScreen(sec, L, 'look', page, phone, 'screenMemo');
  const hook = await page.evaluate(() => {
    const h = document.querySelector('#memoBody .memo-hook');
    if (!h) return null;
    return { own: h.querySelector('b').getBoundingClientRect().bottom <= h.querySelector('span').getBoundingClientRect().top + 1, label: h.querySelector('b').textContent };
  });
  if (hook) check(sec, `${L} look: hook label "${hook.label}" on its own line`, hook.own);
  const qp = await page.evaluate(desktop => {
    const box = el => el.getBoundingClientRect();
    const qs = document.querySelector('#memoBody .memo-questions'), single = document.querySelector('#memoBody .memo-single');
    if (!qs) return { qs: false, single: !!single };
    const answers = qs.querySelectorAll('.answer-box, .ans-en, .ans-yue, .opt, .correct').length;
    const r = { qs: true, tag: qs.tagName, open: qs.open, answers, single: !!single };
    if (desktop) {
      const hook = document.querySelector('#memoBody .memo-hook') || document.querySelector('#memoBody .memo-note');
      r.rightCol = box(qs).left > box(hook).right - 1;
    }
    return r;
  }, !phone);
  if (qp.qs) {
    check(sec, `${L} look: group's questions panel has no answers`, qp.answers === 0);
    if (phone) check(sec, `${L} look: phone questions folded (<details> closed)`, qp.tag === 'DETAILS' && qp.open === false);
    else check(sec, `${L} look: desktop questions panel in the right column`, qp.rightCol);
  }
  if (qp.single) {
    const s = await page.evaluate(() => [...document.querySelectorAll('#memoBody .memo-single-item')].map(it => ({
      label: !!it.querySelector('.memo-note-label'), rule: getComputedStyle(it.querySelector('.memo-single-note')).borderLeftStyle, w: it.closest('.memo-single').getBoundingClientRect().width })));
    check(sec, `${L} look: single-note group = design C (label + gold rule)`, s.length > 0 && s.every(x => x.label && x.rule === 'solid'), JSON.stringify(s[0]));
  }
  if (phone && qp.qs) {
    await press(page, phone, '#memoBody details.memo-questions > summary');
    await checkOneScreen(sec, L, 'look (questions opened)', page, phone, 'screenMemo');
    checkPills(sec, L, 'look questions', await pillsState(page, '#memoBody .memo-questions'));
  } else if (qp.qs) checkPills(sec, L, 'look questions', await pillsState(page, '#memoBody .memo-questions'));
  return qp;
}

// answer the memo test with real taps: wrongFirst → the first question wrong, the rest right; ends with ↩ Back
async function answerTest(sec, L, page, phone, { wrongFirst }) {
  // the start button and option A / B can share a spot (short phones): a tap within 350ms of the start would be a stray
  // double tap the CUI-0011 guard eats (by design), so the first answer waits like a user would
  await sleep(GUARD_WAIT_MS);
  const n = await page.evaluate(() => state.questions.length);
  const head = await page.evaluate(() => {
    const back = document.querySelector('#screenQuiz [data-action="goHome"]');
    return { text: back.textContent.trim(), memo: back.classList.contains('memo-back') };
  });
  check(sec, `${L} test: quiz header back reads "${head.text}" (memo back)`, head.memo);
  const runs = [];
  for (let i = 0; i < n; i++) {
    const q = await page.evaluate(() => { const q = state.questions[state.current]; return { a: q.a, o: q.o.length }; });
    const picks = wrongFirst && i === 0 ? [...Array(q.o).keys()].filter(k => !q.a.includes(k)).slice(0, q.a.length) : q.a;
    for (const k of picks) await press(page, phone, `#opt${k}`);
    if (phone) {
      const s = await screenState(page, 'screenQuiz');
      runs.push(s.fitPhone && s.flex ? 'F' : 's');
      check(sec, `${L} test Q${i + 1}: no sideways scroll`, !s.sideways);
      if (s.fitPhone && s.flex) check(sec, `${L} test Q${i + 1}: one screen high`, !s.pageScrolls);
    }
    const nextSel = await page.evaluate(() => (byId('nextBtn').checkVisibility() ? '#nextBtn' : '#quickNext'));
    if (i === n - 1) {
      const label = await page.evaluate(sel => document.querySelector(sel).textContent.trim() || document.querySelector(sel).getAttribute('aria-label'), nextSel);
      check(sec, `${L} test: last question offers ↩ Back ("${label}")`, label === (await page.evaluate(() => t('quiz.back'))));
    }
    await press(page, phone, nextSel);
  }
  if (phone) check(sec, `${L} test: layout never flips back to one screen within the session (${runs.join('')})`, !/s.*F/.test(runs.join('')));
  return n;
}

async function checkResult(sec, L, cfg, page, phone, { allRight }) {
  const st = await page.evaluate(() => ({ step: memoView.step, r: memoView.result }));
  check(sec, `${L} result: shown (${st.r.correct}/${st.r.total})`, st.step === 'result' && !st.r.none);
  await checkOneScreen(sec, L, 'result', page, phone, 'screenMemo');
  if (!phone) {
    const lay = await page.evaluate(() => {
      const box = el => el.getBoundingClientRect();
      const cols = document.querySelector('#memoBody .memo-result-cols'), [left, right] = cols ? cols.children : [];
      const again = left.querySelector('.memo-again'), next = left.querySelector('.memo-next'), actions = left.querySelector('.memo-actions');
      return { score: !!left.querySelector('.memo-score-card'), panel: !!right.querySelector('.fit-panel'), share: box(left).width / box(cols).width,
        stacked: !next || (box(again).bottom <= box(next).top + 1 && Math.abs(box(again).left - box(next).left) <= 1),
        foot: Math.abs(box(actions).bottom - box(left).bottom) <= 2 };
    });
    check(sec, `${L} result B: left = score + Again/Next stacked at the foot, right = panel (left ${(lay.share * 12).toFixed(1)}/12)`, lay.score && lay.panel && lay.stacked && lay.foot && Math.abs(lay.share - 5 / 12) < 0.05, JSON.stringify(lay));
  } else {
    const lay = await page.evaluate(() => {
      const panel = document.querySelector('#memoBody .memo-scroll-panel'), actions = document.querySelector('#memoBody .memo-actions');
      return { scoreIn: !!panel.querySelector('.memo-score'), after: panel.getBoundingClientRect().bottom <= actions.getBoundingClientRect().top + 1 };
    });
    check(sec, `${L} result phone: score in panel, Again/Next after it`, lay.scoreIn && lay.after);
  }
  if (allRight) {
    const r = await page.evaluate(() => {
      const g = memoGroupById(memoView.id), key = memoLocal(g).hook ? 'memo.hookAgain' : 'memo.noteAgain';
      const p = document.querySelector('#memoBody .memo-again-text');
      return { text: p && p.textContent, want: t(key), hook: !!document.querySelector('#memoBody .memo-hook'), note: !!document.querySelector('#memoBody .memo-note, #memoBody .memo-single'), key };
    });
    check(sec, `${L} result all correct: "${r.want}" + ${r.key === 'memo.hookAgain' ? 'hook' : 'notes'}`, r.text === r.want && (r.key === 'memo.hookAgain' ? r.hook : r.note), JSON.stringify(r));
  } else {
    checkPills(sec, L, 'result wrong list', await pillsState(page, '#memoBody .memo-wrong'));
  }
}

// ── M: memo flow end to end ──
async function sectionM(b) {
  let i = 0;
  const only = process.env.QA_VIEWPORTS ? process.env.QA_VIEWPORTS.split(',') : null; // e.g. 375x553,320x568
  for (const viewport of [...DESKS, ...PHONES].filter(v => !only || only.includes(`${v.width}x${v.height}`))) for (const lang of LANGS) for (const fontSize of FONTS) for (const translation of TRANS) {
    const cfg = { viewport, lang, fontSize, translation };
    const { page, errors, phone, label: L } = await open(b, cfg);
    try {
      const first = await seedMemo(page);
      await page.evaluate(() => { openStudy(); });
      await press(page, phone, '.study-tab[data-tab="memo"]');
      await checkList('M', L, cfg, page, phone);
      if (i % 8 === 0) await shot(page, `M-list-${L.replace(/ /g, '_')}`);
      const firstCard = await page.evaluate(() => document.querySelector('#studyContent .memo-card').dataset.arg);
      check('M', `${L} list: first card is the due group with copies`, firstCard === first, firstCard);
      await press(page, phone, `#studyContent .memo-card[data-arg="${first}"]`);
      await checkLook('M', L, cfg, page, phone, { expectId: first });
      if (i % 8 === 0) await shot(page, `M-look-${L.replace(/ /g, '_')}`);
      // ② test, one wrong → result (wrong list); Again → look
      await sleep(GUARD_WAIT_MS);
      await press(page, phone, '#memoBody .memo-start');
      await answerTest('M', L, page, phone, { wrongFirst: true });
      await checkResult('M', L, cfg, page, phone, { allRight: false });
      if (i % 8 === 0) await shot(page, `M-result-${L.replace(/ /g, '_')}`);
      await sleep(GUARD_WAIT_MS);
      await press(page, phone, '#memoBody .memo-again');
      await checkLook('M', L + ' (Again)', cfg, page, phone, { expectId: first });
      // leave a test mid-way: back on ① look, nothing recorded
      const before = await page.evaluate(() => JSON.stringify(memoLoadProgress()));
      await sleep(GUARD_WAIT_MS);
      await press(page, phone, '#memoBody .memo-start');
      await press(page, phone, '#opt0');
      await sleep(GUARD_WAIT_MS);
      await press(page, phone, '#screenQuiz [data-action="goHome"]');
      const left = await page.evaluate(() => ({ step: memoView.step, active: byId('screenMemo').classList.contains('active'), p: JSON.stringify(memoLoadProgress()) }));
      check('M', `${L} test ‹ Memory mid-way: back on ① look, nothing recorded`, left.active && left.step === 'look' && left.p === before);
      // all right → result reminder; Next → the next group's look; ‹ → the list
      await sleep(GUARD_WAIT_MS);
      await press(page, phone, '#memoBody .memo-start');
      await answerTest('M', L, page, phone, { wrongFirst: false });
      await checkResult('M', L, cfg, page, phone, { allRight: true });
      const nextId = await page.evaluate(() => { const n = document.querySelector('#memoBody .memo-next'); return n && n.dataset.arg; });
      check('M', `${L} result: Next names another group`, !!nextId && nextId !== first, nextId);
      await sleep(GUARD_WAIT_MS);
      await press(page, phone, '#memoBody .memo-next');
      await checkLook('M', L + ' (Next)', cfg, page, phone, { expectId: nextId });
      await sleep(GUARD_WAIT_MS);
      await press(page, phone, '#screenMemo .memo-back');
      const back = await page.evaluate(() => ({ study: byId('screenStudy').classList.contains('active'), tab: study.tab }));
      check('M', `${L} ‹ Memory: back on the Study memo list`, back.study && back.tab === 'memo', JSON.stringify(back));
      // the due banner's Start opens the first due group
      await sleep(GUARD_WAIT_MS);
      await press(page, phone, '#screenStudy .memo-due-start');
      const viaBanner = await page.evaluate(() => ({ id: memoView.id, due: memoDueGroups(memoLoadProgress(), planTodayIso()).map(g => g.id)[0] }));
      check('M', `${L} due banner Start opens the first due group`, viaBanner.id === viaBanner.due, JSON.stringify(viaBanner));
      // single-note group
      await page.evaluate(() => { openStudy(); studySetTab('memo'); openMemoGroup(MEMO_SINGLE_ID); });
      await checkLook('M', L + ' (single)', cfg, page, phone, { expectId: 'single' });
      check('M', `${L}: no page errors`, errors.length === 0, errors.join(' | '));
    } catch (e) {
      check('M', `${L}: flow ran`, false, e.message.split('\n')[0]);
    }
    await page.context().close();
    i++;
  }
}

// ── E: English UI reminders (groups with / without an English hook; single group) ──
async function sectionE(b) {
  for (const viewport of [DESKS[1], PHONES[0]]) {
    const cfg = { viewport, lang: 'en', fontSize: 'small', translation: true };
    const { page, errors, phone, label: L } = await open(b, cfg);
    const kinds = await page.evaluate(() => {
      const gs = memoGroups();
      return { total: gs.length, enHook: gs.filter(g => g.hookEn).length, noEnHook: gs.filter(g => g.id !== MEMO_SINGLE_ID && !g.hookEn).map(g => g.id),
        hook: (gs.find(g => g.hookEn) || {}).id, plain: (gs.find(g => g.id !== MEMO_SINGLE_ID && !g.hookEn) || {}).id };
    });
    note('E', `${L}: ${kinds.total} groups, ${kinds.enHook} with an English hook, ${kinds.noEnHook.length} without (${kinds.noEnHook.slice(0, 6).join(', ')})`);
    for (const id of [kinds.hook, kinds.plain, 'single'].filter(Boolean)) {
      await page.evaluate(gid => { openStudy(); studySetTab('memo'); openMemoGroup(gid); }, id);
      await sleep(GUARD_WAIT_MS);
      await press(page, phone, '#memoBody .memo-start');
      await answerTest('E', `${L} ${id}`, page, phone, { wrongFirst: false });
      const r = await page.evaluate(() => {
        const g = memoGroupById(memoView.id), text = (document.querySelector('#memoBody .memo-again-text') || {}).textContent;
        const hook = document.querySelector('#memoBody .memo-hook span'), noteEl = document.querySelector('#memoBody .memo-note, #memoBody .memo-single');
        return { text, hookEn: g.hookEn || '', hookText: hook && hook.textContent, noteLang: noteEl && (noteEl.lang || noteEl.querySelector('[lang]') && noteEl.querySelector('[lang]').lang),
          noteText: noteEl && noteEl.textContent.slice(0, 60), cjk: noteEl ? /[一-鿿]/.test(noteEl.textContent.replace(/（[^）]*）/g, '')) : null };
      });
      if (id === kinds.hook) check('E', `${L} ${id} (English hook): "All correct 🎉 The memory hook once more:" + the English hook`, r.text === 'All correct 🎉 The memory hook once more:' && r.hookText === r.hookEn, JSON.stringify(r));
      else check('E', `${L} ${id} (no English hook): "All correct 🎉 The notes once more:" + English notes`, r.text === 'All correct 🎉 The notes once more:' && r.noteLang === 'en', JSON.stringify(r));
      await shot(page, `E-${phone ? 'phone' : 'desk'}-${id}`);
    }
    check('E', `${L}: no page errors`, errors.length === 0, errors.join(' | '));
    await page.context().close();
  }
}

// ── Q: phone quiz, every mode ──
const PANEL = '#screenQuiz .quiz-scroll > .fit-panel';
const quizMeasure = page => page.evaluate(sel => {
  const box = el => el.getBoundingClientRect();
  const s = byId('screenQuiz'), p = document.querySelector(sel), el = document.scrollingElement;
  const card = s.querySelector('.q-card'), nav = s.querySelector(':scope > .nav-row');
  return { fit: s.classList.contains('is-fit-phone') && getComputedStyle(s).display === 'flex', pageScrolls: el.scrollHeight > el.clientHeight + 1,
    sideways: el.scrollWidth > el.clientWidth + 1, panelH: p ? p.clientHeight : 0, scrolls: p ? p.scrollHeight > p.clientHeight + 1 : false,
    cardTop: box(card).top, navTop: box(nav).top, navBottom: box(nav).bottom, viewH: innerHeight, cur: state.current, n: state.questions.length,
    timer: byId('examTimer').checkVisibility(), timerIn: (() => { const r = box(byId('examTimer')); return r.right <= innerWidth && r.left >= 0; })() };
}, PANEL);
async function measureQ(sec, L, what, page) {
  await frame(page);
  const m = await quizMeasure(page);
  check(sec, `${L} ${what}: no sideways scroll`, !m.sideways);
  if (m.fit) {
    check(sec, `${L} ${what}: one screen high, Prev/Next at the bottom`, !m.pageScrolls && m.navBottom <= m.viewH + 1 && m.navBottom >= m.viewH - NAV_ROOM, `${Math.round(m.navBottom)}/${m.viewH}`);
    if (m.scrolls) {
      await page.$eval(PANEL, el => { el.scrollTop = el.scrollHeight; el.dispatchEvent(new Event('scroll')); });
      const a = await quizMeasure(page);
      check(sec, `${L} ${what}: panel scrolls, card and Prev/Next stay put`, Math.abs(a.cardTop - m.cardTop) <= 1 && Math.abs(a.navTop - m.navTop) <= 1 && !a.pageScrolls);
      await page.$eval(PANEL, el => { el.scrollTop = 0; el.dispatchEvent(new Event('scroll')); });
    }
  }
  const reach = await dt.controlsReachable(page, '#screenQuiz');
  check(sec, `${L} ${what}: every control reachable (${m.fit ? 'one screen' : 'page'})`, reach.ok && reach.count > 0, reach.detail);
  return m;
}
const nextSelector = page => page.evaluate(() => (byId('nextBtn').checkVisibility() ? '#nextBtn' : '#quickNext'));
// walk `count` questions: tap the right options (practice reveals), measure, Next; returns the F / s run
async function walk(sec, L, what, page, phone, count) {
  let run = '';
  for (let i = 0; i < count; i++) {
    const q = await page.evaluate(() => ({ a: state.questions[state.current].a, done: state.current in state.revealed, cur: state.current, n: state.questions.length }));
    if (!q.done) for (const k of q.a) await press(page, phone, `#opt${k}`);
    const m = await measureQ(sec, L, `${what} Q${q.cur + 1}`, page);
    run += m.fit ? 'F' : 's';
    if (q.cur >= q.n - 1) break;
    await press(page, phone, await nextSelector(page));
  }
  check(sec, `${L} ${what}: never back to one screen after a fallback (${run})`, !/s.*F/.test(run));
  return run;
}
async function sectionQ(b) {
  for (const viewport of PHONES) for (const lang of LANGS) for (const fontSize of FONTS) for (const translation of TRANS) {
    const cfg = { viewport, lang, fontSize, translation };
    const { page, errors, phone, label: L } = await open(b, cfg);
    try {
      await seedRandom(page);
      // practice (Home → Practice → Exam 1 by taps)
      await page.evaluate(() => { pendingMode = 'practice'; startExam(1); });
      const run = await walk('Q', L, 'practice', page, phone, 4);
      // similar side session from a revealed question with a Similar panel; ↩ Back keeps the session's decision
      const simQ = await page.evaluate(() => {
        for (let i = state.current; i < state.questions.length; i++) {
          const q = state.questions[i];
          if (similarKeys(q).length) { goToQuestion(i); state.answers[i] = [...q.a]; revealAnswer(); return i; }
        }
        return -1;
      });
      if (simQ >= 0) {
        const before = (await quizMeasure(page)).fit;
        const btn = await page.$('#similarBox [data-action="startSimilarPractice"]');
        if (btn) {
          await press(page, phone, '#similarBox [data-action="startSimilarPractice"]');
          const side = await page.evaluate(() => ({ side: isSideSession(), n: state.questions.length }));
          check('Q', `${L} similar: side session started (${side.n} Qs)`, side.side);
          await walk('Q', L, 'similar side', page, phone, side.n);
          await sleep(GUARD_WAIT_MS);
          await press(page, phone, await nextSelector(page)); // ↩ Back
          const back = await page.evaluate(() => ({ cur: state.current, side: isSideSession() }));
          const m = await measureQ('Q', L, 'similar ↩ back', page);
          check('Q', `${L} similar ↩ Back: original session at Q${simQ + 1}`, !back.side && back.cur === simQ, JSON.stringify(back));
          check('Q', `${L} similar ↩ Back: keeps the original session's layout decision (${before ? 'F' : 's'} → ${m.fit ? 'F' : 's'})`, before || !m.fit);
        } else note('Q', `${L} similar: no "Practise these" button on Q${simQ + 1}`);
      }
      // exam: timer, Submit on the last, tap Submit
      await page.evaluate(() => { pendingMode = 'exam'; startExam(1); });
      const e1 = await measureQ('Q', L, 'exam Q1', page);
      check('Q', `${L} exam: timer in the header, on screen`, e1.timer && e1.timerIn);
      await press(page, phone, '#opt0');
      await press(page, phone, await nextSelector(page));
      await page.evaluate(() => goToQuestion(state.questions.length - 1));
      const eLast = await measureQ('Q', L, 'exam last', page);
      const label = await page.evaluate(() => byId('nextBtn').textContent.trim());
      check('Q', `${L} exam last: Next reads Submit`, label === (await page.evaluate(() => t('exam.submit'))), label);
      await press(page, phone, '#nextBtn');
      const modal = await page.evaluate(() => byId('confirmOk').checkVisibility());
      if (modal) {
        const reach = await dt.controlsReachable(page, '#confirmModal');
        check('Q', `${L} exam Submit: confirm modal buttons reachable`, reach.ok, reach.detail);
        await sleep(GUARD_WAIT_MS);
        await press(page, phone, '#confirmOk');
      }
      const res = await page.evaluate(() => document.querySelector('.screen.active').id);
      check('Q', `${L} exam Submit: lands on the result`, res === 'screenResult', res);
      // wrong-answers review and flagged practice
      await page.evaluate(() => {
        state.questions.slice(0, 8).forEach(q => addWrong(q));
        state.questions.slice(8, 14).forEach(q => setPracticeFlag(qKey(q), true));
      });
      await page.evaluate(() => startWrongReview());
      await walk('Q', L, 'review', page, phone, 3);
      await page.evaluate(() => startFlaggedPractice());
      const fl = await page.evaluate(() => state.questions.length);
      if (fl) await walk('Q', L, 'flagged', page, phone, 3); else note('Q', `${L} flagged: no flagged session (setPracticeFlag signature?)`);
      // plan tasks: practice + review (if any)
      await seedPlan(page);
      const tasks = await page.evaluate(() => { const today = planTodayIso(); return planLoad().days.find(d => d.date === today).tasks.map(t => t.type); });
      for (const type of ['practice', 'review', 'drill']) {
        const idx = tasks.indexOf(type);
        if (idx < 0) continue;
        await page.evaluate(k => planOpenTask(planTodayIso(), k), idx);
        const inQuiz = await page.evaluate(() => byId('screenQuiz').classList.contains('active') && state.questions.length);
        if (!inQuiz) { note('Q', `${L} plan ${type}: opened ${await page.evaluate(() => document.querySelector('.screen.active').id)}`); continue; }
        await walk('Q', L, `plan ${type}`, page, phone, 2);
      }
      // memo test
      await page.evaluate(() => { openStudy(); studySetTab('memo'); openMemoGroup(memoGroups().filter(g => g.body).sort((a, b) => b.body.length - a.body.length)[0].id); });
      await sleep(GUARD_WAIT_MS);
      await press(page, phone, '#memoBody .memo-start');
      await walk('Q', L, 'memo test', page, phone, 5);
      check('Q', `${L}: no page errors`, errors.length === 0, errors.join(' | '));
    } catch (e) {
      check('Q', `${L}: flow ran`, false, e.message.split('\n')[0]);
    }
    await page.context().close();
  }
}

// ── P: plan task review mode (G17: a done task re-opened, every question answered + revealed) on phones ──
async function sectionP(b) {
  for (const viewport of [PHONES[0], PHONES[1], PHONES[3]]) for (const lang of LANGS) {
    const cfg = { viewport, lang, fontSize: 'large', translation: true };
    const { page, errors, phone, label: L } = await open(b, cfg);
    try {
      await seedPlan(page);
      const idx = await page.evaluate(() => planLoad().days.find(d => d.date === planTodayIso()).tasks.findIndex(t => t.type === 'practice'));
      await page.evaluate(k => planOpenTask(planTodayIso(), k), idx);
      const done = await page.evaluate(() => {
        let n = 0;
        while (byId('screenQuiz').classList.contains('active') && isPlanSession() && n++ < 300) {
          const i = state.current, q = state.questions[i];
          if (!(i in state.revealed)) { state.answers[i] = [...q.a]; revealAnswer(); }
          runNextAction();
        }
        return { n, screen: document.querySelector('.screen.active').id };
      });
      note('P', `${L} practice task answered (${done.n} steps) → ${done.screen}`);
      await page.evaluate(k => planOpenTask(planTodayIso(), k), idx);
      const rev = await page.evaluate(() => ({ quiz: byId('screenQuiz').classList.contains('active'), review: !!(sessionReturn && sessionReturn.review), n: state.questions.length }));
      check('P', `${L} done task re-opens in review mode (${rev.n} Qs)`, rev.quiz && rev.review, JSON.stringify(rev));
      if (rev.quiz) await walk('P', L, 'plan review', page, phone, 4);
      check('P', `${L}: no page errors`, errors.length === 0, errors.join(' | '));
    } catch (e) {
      check('P', `${L}: flow ran`, false, e.message.split('\n')[0]);
    }
    await page.context().close();
  }
}

// ── L: per-session fallback latch ──
const fitNow = page => page.evaluate(() => byId('screenQuiz').classList.contains('is-fit-phone') && getComputedStyle(byId('screenQuiz')).display === 'flex');
async function runSession(page, showYue) {
  const n = await page.evaluate(() => state.questions.length);
  let run = '';
  for (let i = 0; i < n; i++) {
    await page.evaluate(([k, y]) => { goToQuestion(k); if (y) { state.yueShown[k] = true; renderQuestion(); } }, [i, showYue]);
    await frame(page);
    run += (await fitNow(page)) ? 'F' : 's';
  }
  return run;
}
async function sectionL(b) {
  const base = { viewport: { width: 375, height: 667 }, lang: 'zh-HK', fontSize: 'large', translation: true };
  const { page, errors, phone, label: L } = await open(b, base);
  await seedRandom(page);
  await page.evaluate(() => { pendingMode = 'practice'; startExam(1); });
  const run = await runSession(page, true);
  check('L', `${L} practice + translation shown: falls back once, never flips back (${run})`, run.includes('s') && !/s.*F/.test(run));
  // a short question (fits on its own): the first F of a fresh session without translation
  await seedRandom(page);
  await page.evaluate(() => { pendingMode = 'practice'; startExam(1); });
  const fresh = await runSession(page, false);
  check('L', `${L} new session re-decides (starts one screen): ${fresh}`, fresh.startsWith('F') && !/s.*F/.test(fresh));
  // fall back now in this session: show the translation on a tall question
  const fallAt = async () => {
    const n = await page.evaluate(() => state.questions.length);
    for (let i = 0; i < n; i++) {
      await page.evaluate(k => { goToQuestion(k); state.yueShown[k] = true; renderQuestion(); }, i);
      await frame(page);
      if (!(await fitNow(page))) return i;
    }
    return -1;
  };
  const shortQ = async () => { await page.evaluate(() => goToQuestion(0)); await page.evaluate(() => { state.yueShown[0] = false; renderQuestion(); }); await frame(page); return fitNow(page); };
  // real taps on Next within a latched session
  let k = await fallAt();
  check('L', `${L} session falls back at Q${k + 1}`, k >= 0);
  let taps = '';
  await page.evaluate(() => goToQuestion(0));
  for (let i = 0; i < 6; i++) { await press(page, phone, '#nextBtn'); taps += (await fitNow(page)) ? 'F' : 's'; }
  check('L', `${L} tapping Next after the fallback keeps the scrolling page (${taps})`, !taps.includes('F'));
  // height only (toolbar folding): keeps
  await page.setViewportSize({ width: 375, height: 740 }); await frame(page); await sleep(50);
  check('L', `${L} height-only 667 → 740: keeps the fallback on a short question`, !(await shortQ()));
  await page.setViewportSize({ width: 375, height: 553 }); await frame(page); await sleep(50);
  check('L', `${L} height-only 740 → 553: keeps the fallback`, !(await shortQ()));
  await page.setViewportSize(base.viewport); await frame(page);
  // width
  await page.setViewportSize({ width: 390, height: 667 }); await frame(page); await sleep(50);
  check('L', `${L} width 375 → 390: re-decides (short question one screen)`, await shortQ());
  await page.setViewportSize(base.viewport); await frame(page); await sleep(50);
  // text size / translation / language: each re-decides
  for (const [what, change, undo] of [
    ['text size large → small', { fontSize: 'small' }, { fontSize: 'large' }],
    ['translation on → off', { translation: false }, { translation: true }],
    ['language zh-HK → en', { lang: 'en' }, { lang: 'zh-HK' }],
  ]) {
    k = await fallAt();
    if (k < 0) { note('L', `${L} ${what}: could not provoke a fallback first`); continue; }
    // on a short question the latch holds; the change then re-decides on that question's own render
    check('L', `${L} ${what}: before the change the short question keeps the fallback`, !(await shortQ()));
    await dt.applySettings(page, change); await frame(page);
    check('L', `${L} ${what}: re-decides (the short question goes one screen)`, await fitNow(page));
    await dt.applySettings(page, undo); await frame(page);
  }
  // after undoing: context back to the original. The WeakMap keeps the latest context only, so the old fallback is gone
  k = await fallAt();
  await seedRandom(page);
  await page.evaluate(() => { pendingMode = 'practice'; startExam(1); });
  check('L', `${L} new set after a fallback: re-decides`, await shortQ());
  // side session ↩ Back keeps the original's fallback
  k = await fallAt();
  const sim = await page.evaluate(() => { const i = state.questions.findIndex(q => similarKeys(q).length); if (i < 0) return -1; goToQuestion(i); state.answers[i] = [...state.questions[i].a]; revealAnswer(); return i; });
  if (sim >= 0) {
    await page.evaluate(() => startSimilarPractice());
    await frame(page);
    const sideFit = await fitNow(page);
    note('L', `${L} similar side session decides on its own: ${sideFit ? 'one screen' : 'page'}`);
    await page.evaluate(() => { state.current = state.questions.length - 1; runNextAction(); });
    await frame(page);
    check('L', `${L} ↩ Back from Similar: the original session keeps its fallback`, !(await fitNow(page)) && !(await shortQ()));
  }
  check('L', `${L}: no page errors`, errors.length === 0, errors.join(' | '));
  await page.context().close();
}

// ── R: regression smoke ──
async function sectionR(b) {
  for (const viewport of [...DESKS, PHONES[0]]) for (const lang of LANGS) {
    const cfg = { viewport, lang, fontSize: 'small', translation: true, reducedMotion: 'reduce' };
    const { page, errors, phone, label: L } = await open(b, cfg);
    const common = async what => {
      await frame(page);
      check('R', `${L} ${what}: no sideways scroll`, (await dt.noHorizontalScroll(page)).ok);
      const reach = await dt.controlsReachable(page);
      check('R', `${L} ${what}: every control reachable`, reach.ok && reach.count > 0, reach.detail);
      if (!phone) {
        const fit = await page.evaluate(() => document.querySelector('.screen.active').classList.contains('is-fit'));
        if (fit) check('R', `${L} ${what}: desktop one screen, page does not scroll`, (await dt.pageNotScrolling(page)).ok);
      }
    };
    try {
      await common('home');
      await shot(page, `R-home-${L.replace(/ /g, '_')}`);
      await page.evaluate(() => { pendingMode = 'practice'; startExam(1); });
      for (let i = 0; i < 3; i++) {
        const a = await page.evaluate(() => state.questions[state.current].a);
        for (const k of a) await press(page, phone, `#opt${k}`);
        await common(`practice Q${i + 1} answered`);
        await press(page, phone, await nextSelector(page));
      }
      await page.evaluate(() => finishExam());
      await common('practice result');
      await page.evaluate(() => { pendingMode = 'exam'; startExam(2); state.questions.forEach((q, i) => { state.answers[i] = [...q.a]; }); submitExam(); });
      if (await page.evaluate(() => byId('confirmOk').checkVisibility())) await press(page, phone, '#confirmOk');
      await common('exam result');
      await page.evaluate(() => openStudy());
      const tabs = await page.evaluate(() => [...document.querySelectorAll('.study-tab')].map(t => t.dataset.tab));
      for (const tab of tabs) { await press(page, phone, `.study-tab[data-tab="${tab}"]`); await common(`study ${tab}`); }
      await seedPlan(page);
      await page.evaluate(() => openPlanDay()); await common('plan day');
      await page.evaluate(() => openPlanSchedule()); await common('plan schedule');
      await page.evaluate(() => openPlanGoal()); await common('plan goal');
      await page.evaluate(() => goHome()); await common('home with plan');
      check('R', `${L}: no page errors`, errors.length === 0, errors.join(' | '));
    } catch (e) {
      check('R', `${L}: flow ran`, false, e.message.split('\n')[0]);
    }
    await page.context().close();
  }
}

// ── D: documented risks: double tap on the memo result Next (CUI-0011 guard), S-267 focus across 1024 ──
async function sectionD(b) {
  const cfg = { viewport: PHONES[0], lang: 'zh-HK', fontSize: 'small', translation: true };
  for (const gap of [100, 450]) {
    const { page, errors, phone, label: L } = await open(b, cfg);
    await seedMemo(page);
    const id = await page.evaluate(() => memoDueGroups(memoLoadProgress(), planTodayIso())[0].id);
    await page.evaluate(gid => { openStudy(); studySetTab('memo'); openMemoGroup(gid); startMemoTest(); }, id);
    const n = await page.evaluate(() => state.questions.length);
    for (let i = 0; i < n; i++) {
      const a = await page.evaluate(() => state.questions[state.current].a);
      for (const k of a) await press(page, phone, `#opt${k}`);
      if (i < n - 1) await press(page, phone, '#nextBtn');
    }
    const backBox = await page.$eval('#nextBtn', el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.touchscreen.tap(backBox.x, backBox.y);
    await sleep(gap);
    const nextBox = await page.$eval('#memoBody .memo-next', el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, l: r.left, r: r.right, t: r.top, b: r.bottom }; });
    const same = backBox.x >= nextBox.l && backBox.x <= nextBox.r && backBox.y >= nextBox.t && backBox.y <= nextBox.b;
    await page.touchscreen.tap(backBox.x, backBox.y);
    await frame(page);
    const after = await page.evaluate(() => ({ step: memoView.step, id: memoView.id }));
    if (gap < 350) check('D', `${L} ↩ Back then a 2nd tap after ${gap}ms on the same spot (Next ${same ? 'under it' : 'elsewhere'}): guard eats it, result stays`, after.step === 'result' && after.id === id, JSON.stringify(after));
    else check('D', `${L} 2nd tap after ${gap}ms: Next works (next group's look)`, after.step === 'look' && after.id !== id, JSON.stringify(after));
    check('D', `${L} gap ${gap}: no page errors`, errors.length === 0, errors.join(' | '));
    await page.context().close();
  }
  // S-267: focus across 1024 (documented) vs same-layout resize (must keep)
  const { page, errors } = await open(b, { viewport: DESKS[1], lang: 'en', fontSize: 'small', translation: true });
  await seedMemo(page);
  await page.evaluate(() => { openStudy(); studySetTab('memo'); openMemoGroup(memoGroups().find(g => g.body).id); });
  const focusOn = () => page.evaluate(() => { const a = document.activeElement; return a === document.body ? 'body' : (a.className || a.tagName); });
  await page.focus('#memoBody .memo-start');
  await page.setViewportSize({ width: 1100, height: 800 }); await frame(page); await sleep(50);
  const same = await focusOn();
  check('D', `S-267: resize 1280 → 1100 (same layout): focus stays on the start button (${same})`, same.includes('memo-start'));
  await page.setViewportSize({ width: 1100, height: 700 }); await frame(page); await sleep(50);
  check('D', `S-267: height change 800 → 700: focus stays (${await focusOn()})`, (await focusOn()).includes('memo-start'));
  await page.setViewportSize({ width: 900, height: 700 }); await frame(page); await sleep(50);
  const crossed = await focusOn();
  note('D', `S-267 (documented): across 1024 (1100 → 900) focus is on: ${crossed}`);
  check('D', 'S-267: focus loss happens only across 1024 (documented) — no page errors', errors.length === 0, errors.join(' | '));
  await page.context().close();
}

(async () => {
  const opts = { args: ['--no-sandbox'] };
  if (process.env.CHROMIUM_PATH) opts.executablePath = process.env.CHROMIUM_PATH;
  const b = await chromium.launch(opts);
  try {
    if (want('M')) await sectionM(b);
    if (want('E')) await sectionE(b);
    if (want('Q')) await sectionQ(b);
    if (want('P')) await sectionP(b);
    if (want('L')) await sectionL(b);
    if (want('R')) await sectionR(b);
    if (want('D')) await sectionD(b);
  } finally {
    await b.close();
  }
  console.log('\n== tally ==');
  Object.entries(tally).forEach(([s, v]) => console.log(`${s}: ${v.pass} pass / ${v.fail} fail`));
  if (fails.length) { console.log('\n== fails =='); fails.forEach(f => console.log(f)); process.exitCode = 1; }
})();
