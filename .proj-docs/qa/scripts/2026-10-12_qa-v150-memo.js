// QA v1.5.0 memory-note study (Study tab 5 🧠, #screenMemo). Real clicks, the repo served over http (python, Pages-like
// Cache-Control, tests/pages-server.js) so the service worker / offline part is real. Clock: Playwright setFixedTime
// (Date only, timers stay real), timezone Europe/London.
//   M  matrix: 360 / 390 × en / zh-HK × small / large × translation on / off = 16 fresh contexts, each a full user flow
//      (Home → Study → 🧠 → card → look → test pass → result → Next → test fail → result → ‹ back → list), layout checks
//   S  scenarios at 390: Lv4 fail / pass, 70% boundary, skipped / partial multi-answer, next button, banner + date
//      boundary, ⚙ language / text / translation switch on the result, Home mid-test, search, chapter chips, single group,
//      memo tab persistence
//   O  offline: SW caches the 4 new files; offline reload → memo flow works
//   R  regression: other Study tabs after memo, fact practice ↩ back to Study, Practice exam, Exam mode, plan
// Screenshots -> ../screenshots/v150/ (a few evidence shots + any finding)
//   NODE_PATH=... CHROMIUM_PATH=... node 2026-10-12_qa-v150-memo.js
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '../../..');
const { startPagesServer } = require(path.join(ROOT, 'tests/pages-server.js'));
const SHOTS = path.join(__dirname, '../screenshots/v150');
fs.mkdirSync(SHOTS, { recursive: true });
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const GUARD = 450;          // > SCREEN_CHANGE_CLICK_GUARD_MS
const MEMO_LS = 'lifeuk.memoProgress';
const TODAY = '2026-10-12';
const NOON = new Date('2026-10-12T12:00:00+01:00'); // BST
const res = [];
const findings = [];
const log = (ok, id, m, extra) => {
  res.push({ ok, id, m });
  if (!ok) findings.push(id + ' ' + m + (extra !== undefined ? ' ' + JSON.stringify(extra) : ''));
  console.log((ok ? 'ok   ' : 'FAIL ') + id + ' ' + m + (extra !== undefined && !ok ? ' ' + JSON.stringify(extra) : ''));
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const RAW_KEY = /\b(memo|study|common|quiz|app|home|plan|modal|result)\.[a-z][A-Za-z]+\b/;

let base, server, browser;

async function newPage({ width = 390, height = 844, lang = 'en', font = 'small', trans = 'on', time = NOON, offlineCtx } = {}) {
  const ctx = offlineCtx || await browser.newContext({ viewport: { width, height }, timezoneId: 'Europe/London', serviceWorkers: 'block' });
  await ctx.clock.setFixedTime(time);
  const pg = await ctx.newPage();
  pg.errs = []; pg.warns = [];
  pg.on('pageerror', e => pg.errs.push(e.message));
  pg.on('console', m => { if (/\[i18n\] missing key|\[memo\]|\[actions\]/.test(m.text())) pg.warns.push(m.text()); });
  await pg.goto(base + 'index.html');
  await pg.evaluate(([l, f, t]) => {
    localStorage.clear();
    localStorage.setItem('lifeuk.uiLang', JSON.stringify(l));
    localStorage.setItem('lifeuk.fontSize', JSON.stringify(f));
    if (t === 'off') localStorage.setItem('lifeuk.translation', JSON.stringify('off'));
  }, [lang, font, trans]);
  await pg.reload();
  pg.ctx = ctx;
  return pg;
}
const stored = pg => pg.evaluate(k => JSON.parse(localStorage.getItem(k)), MEMO_LS);
const seed = (pg, v) => pg.evaluate(([k, x]) => localStorage.setItem(k, JSON.stringify(x)), [MEMO_LS, v]);
const text = (pg, sel) => pg.$eval(sel, e => e.textContent.trim());
const active = pg => pg.evaluate(() => document.querySelector('.screen.active').id);
const cardIds = pg => pg.$$eval('#studyContent .memo-card', els => els.map(e => e.dataset.arg));
const addDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);

async function toMemoTab(pg) {
  if (await active(pg) !== 'screenStudy') {
    if (await active(pg) !== 'screenHome') { await pg.click('#screenQuiz .back-btn, #screenMemo .memo-back').catch(() => {}); await sleep(GUARD); }
    await pg.click('#modeStudy'); await sleep(GUARD);
  }
  await pg.click('.study-tab[data-tab="memo"]');
}
async function openCard(pg, id, query) {
  if (query !== undefined) await pg.fill('#studySearch', query);
  await pg.click(`#studyContent .memo-card[data-arg="${id}"]`);
  await sleep(GUARD);
}
// pattern entries: true right, false wrong, null skip, 'partial' = one pick of a multi-answer question (not revealed)
async function answer(pg, how) {
  const picks = await pg.evaluate(h => {
    const q = state.questions[state.current];
    const wrong = q.o.map((_, i) => i).filter(i => !q.a.includes(i));
    if (h === 'partial') return [q.a[0]];
    return h ? q.a : wrong.slice(0, q.a.length);
  }, how);
  for (const p of picks) await pg.click('#opt' + p);
}
async function runTest(pg, pattern, { stopAt } = {}) {
  await pg.click('#memoBody .memo-start');
  await sleep(GUARD);
  const n = await pg.evaluate(() => state.questions.length);
  for (let i = 0; i < n; i++) {
    if (stopAt === i) return n;
    const h = i < pattern.length ? pattern[i] : null;
    if (h !== null) await answer(pg, h);
    await pg.click('#nextBtn');
    await sleep(i === n - 1 ? GUARD : 60);
  }
  return n;
}
// layout: no horizontal page scroll; memo elements inside the viewport; badges not clipped; no raw keys
async function layout(pg) {
  return pg.evaluate(rawSrc => {
    const raw = new RegExp(rawSrc);
    const W = innerWidth;
    const scr = document.querySelector('.screen.active');
    const out = [];
    scr.querySelectorAll('.memo-card, .memo-due, .memo-due-start, .memo-badge, .memo-step, .memo-hook, .memo-panel, .memo-lv, .memo-actions .nav-btn, .memo-start, .study-tab, #studySubChips .chip, .memo-title, .memo-back')
      .forEach(e => { const r = e.getBoundingClientRect(); if (r.width && (r.left < -0.5 || r.right > W + 0.5)) out.push(e.className + ' ' + Math.round(r.right)); });
    const clipped = [...scr.querySelectorAll('.memo-badge, .memo-due-start, .memo-step, .memo-lv, .memo-actions .nav-btn, .study-tab')]
      .filter(e => e.offsetWidth && e.scrollWidth > e.clientWidth + 1).map(e => e.className + ':' + e.textContent.trim());
    // a card's title and badge must not overlap
    const overlap = [...scr.querySelectorAll('.memo-card')].filter(c => {
      const a = c.querySelector('.memo-name').getBoundingClientRect(), b = c.querySelector('.memo-badge').getBoundingClientRect();
      return a.right > b.left + 0.5 && a.top < b.bottom && b.top < a.bottom;
    }).map(c => c.dataset.arg);
    const vis = document.body.innerText;
    const m = vis.match(raw);
    return { hscroll: document.scrollingElement.scrollWidth > W, out, clipped, overlap, raw: m ? m[0] : null };
  }, RAW_KEY.source);
}
const layoutOk = l => !l.hscroll && !l.out.length && !l.clipped.length && !l.overlap.length && !l.raw;

// expected strings per language
const STR = {
  en: { look: '① Look', start: 'Got it — start the test ▶', pass1: 'Test 5/5 (≥ 70%) → up to Lv1', fail0: 'Test 0/5 · below 70%, review again tomorrow',
    back: '‹ Memory', next: 'Next: ', count: n => `${n} / ${n} groups`, learning1: 'Learning · Lv1', tab: 'Memory', wrong: 'Look at these again:' },
  'zh-HK': { look: '① 睇', start: '記住咗，開始試 ▶', pass1: '試 5/5（≥ 70%）→ 升到 Lv1', fail0: '試 0/5 · 未夠 70%，聽日再溫',
    back: '‹ 記憶法', next: '下一組：', count: n => `${n} / ${n} 組`, learning1: '溫緊 · Lv1', tab: '記憶法', wrong: '要再睇嘅：' },
};

// ════════ M: matrix ════════
async function matrix() {
  for (const width of [360, 390]) for (const lang of ['en', 'zh-HK']) for (const font of ['small', 'large']) for (const trans of ['on', 'off']) {
    const tag = `M[${width} ${lang} ${font} tr-${trans}]`;
    const S = STR[lang];
    const pg = await newPage({ width, height: 800, lang, font, trans });
    try {
      await pg.click('#modeStudy'); await sleep(GUARD);
      await pg.click('.study-tab[data-tab="memo"]');
      const ids = await cardIds(pg);
      const tabTxt = await text(pg, '.study-tab[data-tab="memo"] [data-i18n]');
      log(ids.length === 62 && await text(pg, '#studyCount') === S.count(62) && tabTxt === S.tab, tag, 'list: 62 cards, count, tab label', { n: ids.length, tabTxt });
      let l = await layout(pg);
      log(layoutOk(l), tag, 'list layout (no h-scroll / overflow / clipped badge / title-badge overlap / raw key)', l);
      // look
      await openCard(pg, ids[0]);
      const look = await pg.evaluate(() => ({ title: byId('memoTitle').textContent, step: document.querySelector('#memoSteps .memo-step').textContent,
        hook: !!document.querySelector('.memo-hook'), rows: document.querySelectorAll('#memoBody .note-table tbody tr').length,
        start: document.querySelector('.memo-start').textContent, back: document.querySelector('#screenMemo .memo-back').textContent }));
      log(look.title === '🎆 英國節日' && look.step === S.look && look.hook && look.rows === 6 && look.start === S.start && look.back === S.back, tag, 'look: title, ① step, hook, 6-row table, start + back labels', look);
      l = await layout(pg);
      log(layoutOk(l), tag, 'look layout', l);
      if (width === 390 && font === 'large' && trans === 'on') await pg.screenshot({ path: path.join(SHOTS, `look-${lang}-390-large.png`), fullPage: true });
      // test: all right
      await pg.click('#memoBody .memo-start'); await sleep(GUARD);
      const qh = await pg.evaluate(() => ({ label: byId('quizLabel').textContent, span: (byId('quizLabel').querySelector('[lang="zh-HK"]') || {}).textContent, n: state.questions.length,
        distinct: new Set(state.questions.map(q => q.q)).size }));
      log(qh.label === '🧠 英國節日' && qh.span === '英國節日' && qh.n === 5 && qh.distinct === 5, tag, 'quiz header 🧠 英國節日 (title lang zh-HK), 5 distinct questions', qh);
      await answer(pg, true);
      const yueVis = await pg.evaluate(() => ['qYue', 'ansYue'].map(id => getComputedStyle(byId(id)).display !== 'none' && byId(id).offsetHeight > 0));
      log(trans === 'on' ? yueVis.every(Boolean) : yueVis.every(v => !v), tag, `quiz Cantonese ${trans === 'on' ? 'shown' : 'hidden'} (q-yue, ans-yue)`, yueVis);
      await pg.click('#nextBtn'); await sleep(60);
      for (let i = 1; i < 5; i++) { await answer(pg, true); await pg.click('#nextBtn'); await sleep(i === 4 ? GUARD : 60); }
      const r1 = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, pct: document.querySelector('.memo-pct').textContent, verdict: document.querySelector('.memo-verdict').textContent,
        sched: [...document.querySelectorAll('.memo-lv')].map(e => e.className.replace('memo-lv', '').trim()).join(','), next: (document.querySelector('.memo-next') || {}).textContent || '' }));
      const st1 = (await stored(pg))['uk-festivals'];
      log(r1.scr === 'screenMemo' && r1.pct === '100%' && r1.verdict === S.pass1 && r1.sched === 'next,,,' && st1.lv === 1 && st1.due === addDays(TODAY, 1), tag, 'pass: 100%, up to Lv1, Lv1 box next, stored Lv1 due tomorrow', { r1, st1 });
      log(r1.next.startsWith(S.next + '投票權'), tag, 'Next button = next new group (投票權)', r1.next);
      l = await layout(pg);
      log(layoutOk(l), tag, 'result (pass) layout', l);
      // Next → vote, fail all
      await pg.click('#memoBody .memo-next'); await sleep(GUARD);
      log(await text(pg, '#memoTitle') === '🗳️ 投票權', tag, 'Next opens 🗳️ 投票權 on its look view');
      await runTest(pg, [false, false, false, false, false]);
      const r2 = await pg.evaluate(() => ({ pct: document.querySelector('.memo-pct').textContent, verdict: document.querySelector('.memo-verdict').textContent,
        wrongTitle: (document.querySelector('.memo-wrong-title') || {}).textContent, wrong: document.querySelectorAll('.memo-wrong li').length,
        yueShown: [...document.querySelectorAll('.memo-wrong-yue')].map(e => e.offsetHeight > 0), cls: document.querySelector('.memo-score').className }));
      const st2 = (await stored(pg)).vote;
      log(r2.pct === '0%' && /\bfail\b/.test(r2.cls) && r2.verdict === S.fail0 && r2.wrongTitle === S.wrong && r2.wrong === 5 && st2.lv === 0 && st2.due === addDays(TODAY, 1), tag, 'fail: 0%, review tomorrow, 5 wrong listed, stored Lv0 due tomorrow', { r2, st2 });
      log(trans === 'on' ? r2.yueShown.every(Boolean) : r2.yueShown.every(v => !v), tag, `wrong-list Cantonese ${trans === 'on' ? 'shown' : 'hidden'}`);
      l = await layout(pg);
      log(layoutOk(l), tag, 'result (fail) layout', l);
      if (width === 360 && font === 'large') await pg.screenshot({ path: path.join(SHOTS, `result-fail-${lang}-360-large-tr${trans}.png`), fullPage: true });
      // back to list
      await pg.click('#screenMemo .memo-back'); await sleep(GUARD);
      const badges = await pg.$$eval('#studyContent .memo-card', els => Object.fromEntries(els.map(e => [e.dataset.arg, e.querySelector('.memo-badge').textContent])));
      const order = await cardIds(pg);
      log(badges['uk-festivals'] === S.learning1 && badges.vote.includes('Lv0') && order.indexOf('uk-festivals') > order.indexOf('ministers') && !(await pg.$('.memo-due')), tag,
        'list after: learning badges, the two tested groups sort after the new ones, no banner (due tomorrow)', { f: badges['uk-festivals'], v: badges.vote });
      l = await layout(pg);
      log(layoutOk(l), tag, 'list layout after progress', l);
      log(!pg.errs.length && !pg.warns.length, tag, 'no page errors / missing keys', pg.errs.concat(pg.warns));
    } catch (e) { log(false, tag, 'threw: ' + e.message.split('\n')[0]); }
    await pg.ctx.close();
  }
}

// ════════ S: scenarios ════════
async function scenarios() {
  let pg = await newPage({ lang: 'en' });
  const T = 'S';
  await pg.click('#modeStudy'); await sleep(GUARD);
  await pg.click('.study-tab[data-tab="memo"]');

  // S1 Lv4 fail → Lv3 via the banner Start
  await seed(pg, { parliament: { lv: 4, due: TODAY } });
  await pg.evaluate(() => renderStudy());
  const ban = await pg.evaluate(() => ({ b: document.querySelector('.memo-due b').textContent, s: document.querySelector('.memo-due small').textContent }));
  log(ban.b === '1 group to review today' && ban.s === '國會兩院', T + '1', 'banner singular "1 group to review today" + title', ban);
  await pg.click('.memo-due-start'); await sleep(GUARD);
  await runTest(pg, [false, false, true, false, false]);
  let r = await pg.evaluate(() => ({ v: document.querySelector('.memo-verdict').textContent, s: [...document.querySelectorAll('.memo-lv')].map(e => e.className.replace('memo-lv', '').trim() + ':' + e.textContent).join('|') }));
  log(r.v === 'Test 1/5 · below 70%, down to Lv3, review again tomorrow' && r.s === 'past:Lv11 day|past:Lv23 days|retry:Lv3Tomorrow|:Lv414 days'
    && JSON.stringify((await stored(pg)).parliament) === JSON.stringify({ lv: 3, due: addDays(TODAY, 1) }), T + '1', 'Lv4 fail (1/5) → Lv3, due tomorrow, Lv3 box "Tomorrow" dashed', r);
  await pg.click('#screenMemo .memo-back'); await sleep(GUARD);
  log(await pg.$eval('.memo-card[data-arg="parliament"] .memo-badge', e => e.textContent) === 'Learning · Lv3', T + '1', 'list badge Learning · Lv3 (not Known)');

  // S2 Lv3 pass → Lv4 (+14, Known), Lv4 pass → stays Lv4 (+14)
  await seed(pg, { parliament: { lv: 3, due: TODAY } });
  await openCard(pg, 'parliament', '國會兩院');
  await runTest(pg, [true, true, true, true, false]);
  r = await pg.evaluate(() => document.querySelector('.memo-verdict').textContent);
  log(r === 'Test 4/5 (≥ 70%) → up to Lv4' && JSON.stringify((await stored(pg)).parliament) === JSON.stringify({ lv: 4, due: addDays(TODAY, 14) }), T + '2', 'Lv3 4/5 → Lv4, due +14', r);
  await pg.click('#screenMemo .memo-back'); await sleep(GUARD);
  log(await pg.$eval('.memo-card[data-arg="parliament"] .memo-badge', e => e.textContent) === 'Known · in 14 days', T + '2', 'badge Known · in 14 days, full bar',
    await pg.$eval('.memo-card[data-arg="parliament"] .memo-bar i', e => e.style.width));
  await seed(pg, { parliament: { lv: 4, due: TODAY } });
  await openCard(pg, 'parliament', '國會兩院');
  await runTest(pg, [true, true, true, true, true]);
  r = await pg.evaluate(() => ({ v: document.querySelector('.memo-verdict').textContent, s: [...document.querySelectorAll('.memo-lv')].map(e => e.className.replace('memo-lv', '').trim()).join(',') }));
  log(r.v === 'Test 5/5 (≥ 70%) → stays at Lv4' && r.s === 'past,past,past,next' && JSON.stringify((await stored(pg)).parliament) === JSON.stringify({ lv: 4, due: addDays(TODAY, 14) }), T + '2', 'Lv4 pass → stays Lv4, due +14', r);

  // S3 70% boundary with skips: 2/3 answered (67%) fail; 3/4 (75%) pass; 1/1 pass (S-236 accepted); 0/1 fail
  const boundary = async (seedLv, pattern, expPass, expLv, label) => {
    await pg.click('#screenMemo .memo-back'); await sleep(GUARD);
    await seed(pg, { ww2: { lv: seedLv, due: TODAY } });
    await openCard(pg, 'ww2', '二次世界大戰');
    await runTest(pg, pattern);
    const v = await pg.evaluate(() => document.querySelector('.memo-verdict').textContent);
    const s = (await stored(pg)).ww2;
    log(s.lv === expLv && (expPass ? !/below/.test(v) : /below/.test(v)), T + '3', label, { v, s });
  };
  await boundary(2, [true, true, false, null, null], false, 1, '2 of 3 answered right (67%) → fail, Lv2 → Lv1');
  await boundary(2, [true, true, true, false, null], true, 3, '3 of 4 answered right (75%) → pass, Lv2 → Lv3');
  await boundary(1, [true, null, null, null, null], true, 2, '1 of 1 answered (100%) → pass (S-236, accepted)');
  await boundary(1, [null, null, null, null, false], false, 0, 'only the last answered, wrong → fail, Lv1 → Lv0');
  log((await stored(pg)).ww2.due === addDays(TODAY, 1), T + '3', 'fail due tomorrow');

  // S4 all skipped: nothing recorded, steps not done; multi-answer partial pick = not answered
  await pg.click('#screenMemo .memo-back'); await sleep(GUARD);
  await seed(pg, { citizen: { lv: 2, due: TODAY } });
  await openCard(pg, 'citizen', '公民責任');
  await pg.click('#memoBody .memo-start'); await sleep(GUARD);
  const multi = await pg.evaluate(() => state.questions.map(q => q.a.length));
  await pg.click('#screenQuiz .back-btn'); await sleep(GUARD); // Home mid-test (also part of S7)
  // build a pattern: partial pick on every multi-answer question, skip others
  await pg.click('#modeStudy'); await sleep(GUARD);
  await openCard(pg, 'citizen', '公民責任');
  await pg.click('#memoBody .memo-start'); await sleep(GUARD);
  const multis = await pg.evaluate(() => state.questions.map(q => q.a.length));
  for (let i = 0; i < multis.length; i++) {
    if (multis[i] > 1) await answer(pg, 'partial');
    await pg.click('#nextBtn'); await sleep(i === multis.length - 1 ? GUARD : 60);
  }
  r = await pg.evaluate(() => ({ none: (document.querySelector('.memo-none') || {}).textContent, steps: [...document.querySelectorAll('.memo-step')].map(e => e.className + ':' + e.textContent).join('|'),
    next: !!document.querySelector('.memo-next') }));
  log(multis.some(n => n > 1), T + '4', 'citizen test has a multi-answer question', multis);
  log(r.none === 'No answers were recorded — nothing changed.' && !r.next && /on:① Look/.test(r.steps) && JSON.stringify((await stored(pg)).citizen) === JSON.stringify({ lv: 2, due: TODAY }),
    T + '4', 'partial multi-answer picks + skips = 0 answered: "No answers were recorded", ① step on, Lv2 / due unchanged', r);
  await pg.click('#memoBody .memo-again');
  log(!!(await pg.$('#memoBody .memo-start')), T + '4', 'Review again → look view');

  // S5 Next button: with every other group learning (not due), no Next; with one due elsewhere, Next names it
  await pg.click('#screenMemo .memo-back'); await sleep(GUARD);
  const allIds = await pg.evaluate(() => memoGroups().map(g => g.id));
  const prog = Object.fromEntries(allIds.map(id => [id, { lv: 2, due: addDaysG(id) }]));
  function addDaysG() { return '2026-10-20'; }
  await seed(pg, prog);
  await openCard(pg, 'writers', '作家');
  await runTest(pg, [true, true, true, true, true]);
  log(!(await pg.$('#memoBody .memo-next')) && !!(await pg.$('#memoBody .memo-again')), T + '5', 'nothing due / new left → no Next button, Review again only');
  prog.jury = { lv: 1, due: '2026-10-01' }; // overdue
  await seed(pg, { ...prog, writers: (await stored(pg)).writers });
  await pg.click('#memoBody .memo-again'); await sleep(GUARD);
  await runTest(pg, [true, true, true, true, true]);
  r = await pg.$eval('#memoBody .memo-next', e => e.textContent).catch(() => null);
  log(r === 'Next: 陪審員 ▶', T + '5', 'an overdue group elsewhere → Next: 陪審員 ▶', r);
  await pg.click('#memoBody .memo-next'); await sleep(GUARD);
  log(await text(pg, '#memoTitle') === '👥 陪審員', T + '5', 'Next opens 陪審員');

  // S6 banner: overdue + today + tomorrow; chapter filter does not hide the banner; date boundary
  await pg.click('#screenMemo .memo-back'); await sleep(GUARD);
  await pg.fill('#studySearch', '');
  await seed(pg, { vote: { lv: 1, due: addDays(TODAY, -3) }, ww2: { lv: 2, due: TODAY }, writers: { lv: 1, due: addDays(TODAY, 1) }, parks: { lv: 3, due: addDays(TODAY, 1) } });
  await pg.evaluate(() => renderStudy());
  r = await pg.evaluate(() => ({ b: document.querySelector('.memo-due b').textContent, s: document.querySelector('.memo-due small').textContent, first: document.querySelector('.memo-card').dataset.arg }));
  log(r.b === '2 groups to review today' && r.s === '投票權 · 二次世界大戰' && r.first === 'vote', T + '6', 'banner counts overdue + today, not tomorrow', r);
  await pg.click('#studySubChips .chip:nth-child(6)'); // Ch 5 (vote, ww2 are not Ch 5?)
  r = await pg.evaluate(() => ({ banner: !!document.querySelector('.memo-due'), ids: [...document.querySelectorAll('.memo-card')].map(e => e.dataset.arg) }));
  log(r.banner && !r.ids.includes('ww2'), T + '6', 'banner stays (all chapters) when a chapter chip hides its groups (by design)', r.ids.length);
  await pg.click('#studySubChips .chip:nth-child(1)');
  // 23:59:30 on the 12th → still 2 due; the clock passes midnight; going back to the list → 4 due
  await pg.ctx.clock.setFixedTime(new Date('2026-10-12T23:59:30+01:00'));
  await pg.evaluate(() => renderStudy());
  r = await pg.$eval('.memo-due b', e => e.textContent);
  log(r === '2 groups to review today', T + '6', '23:59:30 local: still 2 due', r);
  await pg.ctx.clock.setFixedTime(new Date('2026-10-13T00:00:30+01:00'));
  await openCard(pg, 'vote');
  await pg.click('#screenMemo .memo-back'); await sleep(GUARD);
  r = await pg.evaluate(() => ({ b: document.querySelector('.memo-due b').textContent, s: document.querySelector('.memo-due small').textContent }));
  log(r.b === '4 groups to review today', T + '6', '00:00:30 next day (tab left open): ‹ back re-renders → 4 due (tomorrow ones now due)', r);
  // a test right after midnight: due counted from the new day
  await openCard(pg, 'writers');
  await runTest(pg, [true, true, true, true, true]);
  log(JSON.stringify((await stored(pg)).writers) === JSON.stringify({ lv: 2, due: '2026-10-16' }), T + '6', 'test after midnight: Lv1 → Lv2, due 13th + 3 = 16th', (await stored(pg)).writers);
  // timezone: 23:30 UTC on the 12th is 00:30 BST on the 13th → local date wins
  await pg.ctx.clock.setFixedTime(new Date('2026-10-12T23:30:00Z'));
  log(await pg.evaluate(() => planTodayIso()) === '2026-10-13', T + '6', 'today = local (Europe/London) date, not UTC');
  // DST end (25 Oct): a Lv2 pass on 24 Oct is due 31 Oct (+7 across the change)
  await pg.ctx.clock.setFixedTime(new Date('2026-10-24T20:00:00+01:00'));
  await seed(pg, { ww2: { lv: 2, due: '2026-10-24' } });
  await pg.click('#screenMemo .memo-back'); await sleep(GUARD);
  await openCard(pg, 'ww2', '二次世界大戰');
  await runTest(pg, [true, true, true, true, true]);
  log((await stored(pg)).ww2.due === '2026-10-31', T + '6', 'Lv2 → Lv3 on 24 Oct (BST) → due 31 Oct across the DST change', (await stored(pg)).ww2);
  await pg.ctx.clock.setFixedTime(new Date('2026-10-31T00:10:00Z')); // GMT now
  await pg.click('#screenMemo .memo-back'); await sleep(GUARD);
  r = await pg.$eval('.memo-card[data-arg="ww2"] .memo-badge', e => e.textContent);
  log(r === 'Due today', T + '6', '31 Oct 00:10 GMT: ww2 "Due today"', r);
  await pg.ctx.clock.setFixedTime(NOON);
  await pg.ctx.close();

  // S7 ⚙ language / text size / translation on the result screen: no second record; Home mid-test; reload on result
  pg = await newPage({ lang: 'en' });
  await toMemoTab(pg);
  await openCard(pg, 'vote');
  await runTest(pg, [true, true, true, false, true]);
  const rec1 = JSON.stringify(await stored(pg));
  await pg.click('#settingsBtn'); await pg.click('#settingsPop [data-action="chooseLang"][data-arg="zh-HK"]'); await sleep(200);
  let zr = await pg.evaluate(() => ({ v: document.querySelector('.memo-verdict').textContent, steps: [...document.querySelectorAll('.memo-step')].map(e => e.textContent).join('|'), pct: document.querySelector('.memo-pct').textContent,
    next: (document.querySelector('.memo-next') || {}).textContent, scr: document.querySelector('.screen.active').id }));
  log(zr.scr === 'screenMemo' && zr.v === '試 4/5（≥ 70%）→ 升到 Lv1' && zr.steps === '✓ 睇|✓ 試 4/5' && zr.pct === '80%' && zr.next.startsWith('下一組：'), T + '7', '⚙ 中文 on the result: same result in zh-HK', zr);
  await pg.click('#settingsBtn'); await pg.click('#settingsPop [data-action="chooseFontSize"][data-arg="large"]'); await sleep(200);
  await pg.click('#settingsBtn'); await pg.click('#translationSwitch'); await sleep(200);
  const yueWrong = await pg.$$eval('.memo-wrong-yue', els => els.map(e => e.offsetHeight > 0));
  await pg.keyboard.press('Escape').catch(() => {});
  await pg.click('#settingsBtn').catch(() => {}); await pg.click('#settingsPop [data-action="chooseLang"][data-arg="en"]'); await sleep(200);
  log(JSON.stringify(await stored(pg)) === rec1 && yueWrong.length === 1 && !yueWrong[0], T + '7', 'language ×2 + text size + translation off on the result: progress unchanged (no re-record), wrong-list Cantonese hidden', { yueWrong });
  log(await pg.$eval('.memo-verdict', e => e.textContent) === 'Test 4/5 (≥ 70%) → up to Lv1', T + '7', 'back in en, verdict still "up to Lv1" (not "stays")');
  await pg.reload(); await sleep(GUARD);
  log(await active(pg) === 'screenHome' && JSON.stringify(await stored(pg)) === rec1, T + '7', 'reload on the result → Home, nothing recorded again');
  // Home mid-test: nothing recorded; a normal practice afterwards is not treated as a memo test
  await toMemoTab(pg);
  log(await pg.$eval('.study-tab[data-tab="memo"]', e => e.classList.contains('active')), T + '7', 'memo tab remembered after reload (studyPrefs)');
  await openCard(pg, 'ww2');
  await runTest(pg, [true, true], { stopAt: 2 });
  await pg.click('#screenQuiz .back-btn'); await sleep(GUARD);
  log(await active(pg) === 'screenHome' && JSON.stringify(await stored(pg)) === rec1, T + '7', '🏠 Home mid-test (2 answered): Home, no modal, nothing recorded for ww2');
  await pg.click('#modePractice'); await sleep(100);
  await pg.click('#ptabExam'); await sleep(100);
  await pg.click('#examGrid .exam-btn[data-arg="1"]');
  await sleep(GUARD);
  r = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, side: isSideSession(), label: byId('quizLabel').textContent, n: state.questions.length }));
  log(r.scr === 'screenQuiz' && !r.side && !/🧠/.test(r.label), T + '7', 'a Practice exam after leaving a memo test is a normal session (no side session, no 🧠 label)', r);
  const n = r.n;
  for (let i = 0; i < n; i++) { await answer(pg, true); await pg.click('#nextBtn'); await sleep(i === n - 1 ? GUARD : 40); }
  r = await pg.evaluate(() => document.querySelector('.screen.active').id);
  log(r === 'screenResult' && JSON.stringify(await stored(pg)) === rec1, T + '7', 'that exam ends on the normal results screen, memo progress untouched', r);
  // ‹ back on the look view, then the test via the quick ↩ in the question header on the last question
  await pg.evaluate(() => goHome()); await sleep(GUARD);
  await toMemoTab(pg);
  await openCard(pg, 'jury', '陪審員');
  await pg.click('#memoBody .memo-start'); await sleep(GUARD);
  for (let i = 0; i < 3; i++) { await answer(pg, true); if (i < 2) { await pg.click('#quickNext'); await sleep(60); } }
  const quick = await pg.evaluate(() => byId('quickNext').textContent);
  await pg.click('#quickNext'); await sleep(GUARD);
  log(quick === '↩' && await active(pg) === 'screenMemo' && (await stored(pg)).jury.lv === 1, T + '7', 'the header quick ↩ on the last question also finishes the test (Lv0 → Lv1)', quick);
  // ← Prev during the test then finish: still recorded once
  log(!pg.errs.length && !pg.warns.length, T + '7', 'no page errors', pg.errs.concat(pg.warns));
  await pg.ctx.close();

  // S8 search + chapter chips (zh-HK large)
  pg = await newPage({ lang: 'zh-HK', font: 'large' });
  await toMemoTab(pg);
  log(await pg.$eval('#studySearch', e => e.placeholder) === '搜尋記憶法', T + '8', 'zh-HK search placeholder 搜尋記憶法');
  const sq = async q => { await pg.fill('#studySearch', q); return cardIds(pg); };
  let ids = await sq('hadrian');
  log(ids.join() === 'early-britain', T + '8', 'search "hadrian" (lower case, English in the note) → 早期英國', ids);
  ids = await sq('  HADRIAN ');
  log(ids.join() === 'early-britain', T + '8', 'search trims + ignores case ("  HADRIAN ")', ids);
  ids = await sq('長城');
  log(ids.includes('early-britain'), T + '8', 'search the hook / note Chinese "長城"', ids);
  ids = await sq('Robert Burns');
  log(ids.join() === 'uk-festivals', T + '8', 'search across the note "Robert Burns"', ids);
  ids = await sq('Which');
  log(ids.length === 0 && await text(pg, '#studyContent') === '沒有符合的記憶法。' && await text(pg, '#studyCount') === '0 / 62 組', T + '8', 'search does not match question text ("Which") → empty state 沒有符合的記憶法。, 0 / 62 組', ids.length);
  ids = await sq('<img src=x onerror=alert(1)>');
  log(ids.length === 0 && !pg.errs.length, T + '8', 'markup-like search text: no match, no error');
  // search kept after opening a group and coming back
  await sq('1928');
  const before = await cardIds(pg);
  await openCard(pg, before[0]);
  await pg.click('#screenMemo .memo-back'); await sleep(GUARD);
  log(await pg.$eval('#studySearch', e => e.value) === '1928' && (await cardIds(pg)).join() === before.join(), T + '8', 'search box + results kept after ‹ back from a group', before);
  await pg.fill('#studySearch', '');
  // chips: Ch1..Ch5 partition the 62 groups
  const per = [];
  for (let c = 2; c <= 6; c++) { await pg.click(`#studySubChips .chip:nth-child(${c})`); per.push((await cardIds(pg)).length); }
  const cnt5 = await text(pg, '#studyCount');
  log(per.reduce((a, b) => a + b, 0) === 62 && per.every(x => x > 0), T + '8', 'Ch 1–5 chips partition the 62 groups', per);
  log(cnt5 === `${per[4]} / ${per[4]} 組`, T + '8', 'count follows the chip', cnt5);
  await pg.fill('#studySearch', '1928');
  const chSearch = await cardIds(pg);
  const chCnt = await text(pg, '#studyCount');
  log(chCnt === `${chSearch.length} / ${per[4]} 組`, T + '8', 'chip + search: shown / chapter total', chCnt);
  await pg.fill('#studySearch', '');
  const chips = await pg.$$eval('#studySubChips .chip', els => els.map(e => [e.textContent.trim(), e.querySelector('[lang="en"]') ? 'en' : '-']));
  log(chips[0][0] === '全部' && chips.slice(1).every(([t, l], i) => t.endsWith(`Ch ${i + 1}`) && l === 'en'), T + '8', 'zh-HK chips 全部 + "Ch n" (lang en)', chips);
  const l8 = await layout(pg);
  log(layoutOk(l8), T + '8', '390 zh-HK large list layout with chip', l8);
  await pg.click('#studySubChips .chip:nth-child(1)');
  await pg.screenshot({ path: path.join(SHOTS, 'list-zh-HK-390-large.png') });

  // S9 single-note group (zh-HK)
  await openCard(pg, 'single', '');
  r = await pg.evaluate(() => ({ items: document.querySelectorAll('.memo-single-item').length, hook: !!document.querySelector('.memo-hook'),
    step: document.querySelectorAll('.memo-step')[1].textContent, meta: null }));
  log(r.items === 8 && !r.hook && r.step === '② 試 (5)', T + '9', 'single-note group: 8 question + note items, no hook, ② 試 (5)', r);
  await runTest(pg, [true, true, true, true, false]);
  r = await pg.evaluate(() => ({ v: document.querySelector('.memo-verdict').textContent, t: byId('memoTitle').textContent }));
  log(r.v === '試 4/5（≥ 70%）→ 升到 Lv1' && r.t === '📝 單題注解' && (await stored(pg)).single.lv === 1, T + '9', 'single-note group test → Lv1', r);
  const l9 = await layout(pg);
  log(layoutOk(l9), T + '9', 'single result layout', l9);
  await pg.screenshot({ path: path.join(SHOTS, 'result-pass-zh-HK-390-large.png'), fullPage: true });
  log(!pg.errs.length && !pg.warns.length, T + '9', 'no page errors', pg.errs.concat(pg.warns));
  await pg.ctx.close();

  // S10 every group opens + tests without error (one pass each, en small 390) — catches a group with a broken note / table
  pg = await newPage({ lang: 'en' });
  await toMemoTab(pg);
  const every = await pg.evaluate(() => memoGroups().map(g => ({ id: g.id, count: g.count, body: !!g.body })));
  const bad = [];
  for (const g of every) {
    await pg.evaluate(id => openMemoGroup(id), g.id);
    const ok = await pg.evaluate(g => {
      const hs = document.documentElement.scrollWidth > innerWidth;
      const want = Math.min(g.count, 5);
      return !hs && document.querySelectorAll('.memo-step')[1].textContent === `② Test (${want})` && (g.body ? !!document.querySelector('.memo-note') : !!document.querySelector('.memo-single'));
    }, g);
    if (!ok) bad.push(g.id);
  }
  log(!bad.length && !pg.errs.length, 'S10', `all ${every.length} groups open (look view, ② Test (min(count,5)), no h-scroll at 390)`, bad);
  const counts = await pg.evaluate(() => memoGroups().map(g => [g.id, memoTestPick(g).length, Math.min(g.count, 5), new Set(memoTestPick(g).map(i => canonQuestionKey(qKey(i)))).size]));
  log(counts.every(([, a, b, c]) => a === b && c === a), 'S10', 'memoTestPick: min(count, 5) distinct questions for every group', counts.filter(([, a, b, c]) => a !== b || c !== a));
  await pg.ctx.close();
}

// ════════ O: offline ════════
async function offline() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/London' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await ctx.clock.setFixedTime(NOON);
  await pg.goto(base + 'index.html');
  await pg.evaluate(() => { localStorage.setItem('lifeuk.uiLang', '"en"'); });
  await pg.evaluate(() => navigator.serviceWorker.ready);
  await pg.reload();
  await pg.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15000 });
  const cached = await pg.evaluate(async () => {
    const files = ['data/memo.js', 'js/domain/memo.js', 'js/screens/memo.js', 'css/screens/memo.css'];
    const out = {};
    for (const f of files) out[f] = !!(await caches.match(new URL(f, location.href).href));
    out.keys = await caches.keys();
    return out;
  });
  log(['data/memo.js', 'js/domain/memo.js', 'js/screens/memo.js', 'css/screens/memo.css'].every(f => cached[f]), 'O1', 'SW cache holds data/memo.js, js/domain/memo.js, js/screens/memo.js, css/screens/memo.css', cached);
  await ctx.setOffline(true);
  await pg.reload();
  await pg.click('#modeStudy'); await sleep(GUARD);
  await pg.click('.study-tab[data-tab="memo"]');
  const n = (await cardIds(pg)).length;
  const css = await pg.$eval('.memo-card', e => getComputedStyle(e).borderLeftWidth);
  log(n === 62 && css === '4px', 'O2', 'offline reload: memo list 62 cards, memo.css applied', { n, css });
  await openCard(pg, 'uk-festivals');
  await runTest(pg, [true, true, true, true, true]);
  const st = JSON.parse(await pg.evaluate(k => localStorage.getItem(k), MEMO_LS));
  log(st['uk-festivals'].lv === 1 && !errs.length, 'O3', 'offline: look → test → result recorded (Lv1)', errs);
  await ctx.close();
}

// ════════ R: regression ════════
async function regression() {
  const pg = await newPage({ lang: 'en' });
  await toMemoTab(pg);
  for (const tab of ['chapters', 'timeline', 'geo', 'people']) {
    await pg.click('.study-tab[data-tab="memo"]');
    await pg.click(`.study-tab[data-tab="${tab}"]`);
    const r = await pg.evaluate(() => ({ chipsHidden: byId('studyChips').hidden, chips: byId('studyChips').children.length, ph: byId('studySearch').placeholder,
      facts: document.querySelectorAll('#studyContent .fact').length, memo: document.querySelectorAll('.memo-card, .memo-due').length, count: byId('studyCount').textContent }));
    log(!r.chipsHidden && r.chips > 0 && r.ph === 'Search facts' && r.facts > 0 && !r.memo && !/group/.test(r.count), 'R1', `memo → ${tab}: chips row back, placeholder "Search facts", facts listed, fact count`, r);
  }
  // fact practice ↩ back to Study still works after a memo test
  await pg.click('.study-tab[data-tab="memo"]');
  await openCard(pg, 'vote');
  await runTest(pg, [true, true, true, true, true]);
  await pg.click('#screenMemo .memo-back'); await sleep(GUARD);
  await pg.click('.study-tab[data-tab="chapters"]');
  await pg.click('#studyContent [data-action="startFactPractice"] >> nth=0'); await sleep(GUARD);
  const n = await pg.evaluate(() => state.questions.length);
  for (let i = 0; i < n; i++) { await answer(pg, true); await pg.click('#nextBtn'); await sleep(i === n - 1 ? GUARD : 50); }
  const r2 = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, tab: study.tab }));
  log(r2.scr === 'screenStudy' && r2.tab === 'chapters', 'R2', 'Study fact practice ↩ Back returns to Study (not the memo screen)', r2);
  // Exam mode starts / leaves normally
  await pg.click('#screenStudy .back-btn'); await sleep(GUARD);
  await sleep(GUARD);
  await pg.click('#modeExam').catch(() => {}); await sleep(100);
  await pg.click('#examGrid .exam-btn[data-arg="1"]'); await sleep(GUARD);
  const ex = await pg.evaluate(() => ({ mode: state.mode, side: isSideSession(), timer: !byId('examTimer').hidden }));
  log(ex.mode === 'exam' && !ex.side && ex.timer, 'R3', 'Exam mode: timer running, not a side session', ex);
  await pg.click('#screenQuiz .back-btn'); await sleep(200);
  const modal = await pg.evaluate(() => byId('confirmModal').classList.contains('show'));
  log(modal, 'R3', 'leaving an exam still asks to confirm');
  log(!pg.errs.length, 'R', 'no page errors', pg.errs);
  await pg.ctx.close();
}

(async () => {
  ({ base, server } = await startPagesServer(ROOT));
  browser = await chromium.launch(launchOpts);
  const only = process.argv[2];
  try {
    if (!only || only === 'M') await matrix();
    if (!only || only === 'S') await scenarios();
    if (!only || only === 'O') await offline();
    if (!only || only === 'R') await regression();
  } catch (e) { log(false, 'X', 'script threw: ' + e.stack); }
  await browser.close();
  server.kill();
  const pass = res.filter(r => r.ok).length;
  console.log(`\n${pass} / ${res.length} checks passed`);
  if (findings.length) { console.log('FINDINGS:\n' + findings.join('\n')); process.exit(1); }
})();
