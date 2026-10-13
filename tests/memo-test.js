// Memory-note study (v1.6.0, memo mockup v2 (deleted at release; design: .proj-docs/design-baselines/2026-10-12_memo-*.png): pick a group → look → test → result): Study tab 5 "🧠",
// the group list (chapter chips, search, due banner, status cards), the group screen (#screenMemo: hook + memory note,
// test via the side session, result + schedule), stored progress, 360px fit, en + zh-HK strings and lang marks.
const { chromium } = require('playwright-core');
const { seedLegacyDefaults } = require('./legacy-defaults'); // v1.4.2: keep the old en + small first run
const path = require('path');
const APP_URL = process.env.APP_URL || 'file://' + path.resolve(__dirname, '..', 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const GROUP_COUNT = 62; // 61 titled memory notes + the single-note group
const NARROW = 360;
const GUARD_WAIT_MS = 400; // > SCREEN_CHANGE_CLICK_GUARD_MS: a click right after a screen change at the same point is eaten
const MEMO_LS = 'lifeuk.memoProgress';
const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok:', m); };

(async () => {
  const b = seedLegacyDefaults(await chromium.launch(launchOpts));
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const warns = []; pg.on('console', m => { if (/\[i18n\] missing key|\[memo\]|\[actions\]/.test(m.text())) warns.push(m.text()); });
  const text = sel => pg.$eval(sel, e => e.textContent.trim());
  const cardIds = () => pg.$$eval('#studyContent .memo-card', els => els.map(e => e.dataset.arg));
  const stored = () => pg.evaluate(k => JSON.parse(localStorage.getItem(k)), MEMO_LS);
  const today = () => pg.evaluate(() => planTodayIso());
  const addDays = (iso, n) => pg.evaluate(([d, k]) => isoAddDays(d, k), [iso, n]);
  const noHScroll = () => pg.evaluate(() => document.scrollingElement.scrollWidth <= window.innerWidth);
  async function openMemoTab() {
    await pg.click('#modeStudy');
    await pg.waitForTimeout(GUARD_WAIT_MS);
    await pg.click('.study-tab[data-tab="memo"]');
  }
  // answer the current question right or wrong (multi-answer: as many picks as answers), then go on
  async function answer(correct) {
    const picks = await pg.evaluate(ok => {
      const q = state.questions[state.current];
      return ok ? q.a : q.o.map((_, i) => i).filter(i => !q.a.includes(i)).slice(0, q.a.length);
    }, correct);
    for (const p of picks) await pg.click('#opt' + p);
  }
  // pattern: true = right, false = wrong, null = skipped (Next without answering); dblBack: double tap the last ↩ Back
  async function runTest(pattern, { dblBack = false } = {}) {
    await pg.click('.memo-start');
    await pg.waitForTimeout(GUARD_WAIT_MS);
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i] !== null) await answer(pattern[i]);
      if (dblBack && i === pattern.length - 1) await pg.dblclick('#nextBtn');
      else await pg.click('#nextBtn');
      if (i < pattern.length - 1) await pg.waitForTimeout(50);
    }
  }
  const schedule = () => pg.$$eval('#memoBody .memo-lv', els => els.map(e => e.className.replace('memo-lv', '').trim() + ':' + e.textContent).join('|'));
  const setRecord = (id, rec) => pg.evaluate(([k, i, r]) => { const p = JSON.parse(localStorage.getItem(k)) || {}; p[i] = r; localStorage.setItem(k, JSON.stringify(p)); }, [MEMO_LS, id, rec]);
  async function openFromList(query, id) {
    await pg.fill('#studySearch', query);
    await pg.click(`#studyContent .memo-card[data-arg="${id}"]`);
  }

  await pg.goto(APP_URL);
  await pg.evaluate(() => localStorage.clear());
  await pg.reload();

  // ── tab + list ──
  const tabs = await pg.$$eval('.study-tab', els => els.map(e => e.dataset.tab));
  assert(tabs.length === 5 && tabs[4] === 'memo', 'Study has 5 tabs, the 5th is memo: ' + tabs.join(','));
  assert(await text('.study-tab[data-tab="memo"] .tab-ic') === '🧠' && await text('.study-tab[data-tab="memo"] [data-i18n]') === 'Memory', 'memo tab: 🧠 + "Memory"');
  await openMemoTab();
  assert((await cardIds()).length === GROUP_COUNT, `memo tab lists ${GROUP_COUNT} groups`);
  assert(await text('#studyCount') === `${GROUP_COUNT} / ${GROUP_COUNT} groups`, 'count line "62 / 62 groups"');
  assert(await pg.$eval('#studyChips', e => e.hidden && !e.children.length), 'Hide mastered / Bookmarked chips do not apply on the memo tab (row hidden)');
  const subChips = await pg.$$eval('#studySubChips .chip', els => els.map(e => e.textContent.trim()));
  assert(subChips.length === 6 && subChips[0] === 'All' && subChips.slice(1).every((c, i) => c.endsWith(`Ch ${i + 1}`)), 'chapter chips: All + Ch 1–5: ' + subChips.join(' | '));
  assert(await pg.$('#studyLead .memo-due') === null, 'no due banner with no progress');
  const first = await pg.$eval('#studyContent .memo-card', e => ({ title: e.querySelector('.memo-name').textContent, lang: e.querySelector('.memo-name').getAttribute('lang'),
    badge: e.querySelector('.memo-badge').textContent, meta: e.querySelector('.memo-meta').textContent, bar: e.querySelector('.memo-bar i').style.width }));
  // v2.2.0: the English UI shows the English group title (titleEn), marked lang="en"
  assert(first.title === '🎆 UK festivals' && first.lang === 'en' && first.badge === 'New' && first.meta === '16 questions' && first.bar === '0%',
    'new groups by question count: first card 🎆 UK festivals · New · 16 questions · empty bar (title lang en): ' + JSON.stringify(first));
  const single = await pg.$eval('#studyContent .memo-card[data-arg="single"] .memo-meta', e => e.textContent);
  assert(/8 questions$/.test(single), 'single-note group card: 8 questions: ' + single);

  // chapter filter (study pref memoChapter)
  await pg.click('#studySubChips .chip:nth-child(4)'); // Ch 3
  const ch3 = await cardIds();
  const ch3Expected = await pg.evaluate(() => memoGroups().filter(g => g.ch === 3).map(g => g.id).sort());
  assert(ch3.length === ch3Expected.length && [...ch3].sort().join() === ch3Expected.join() && ch3.length < GROUP_COUNT, `Ch 3 chip: ${ch3.length} groups, all with main chapter 3`);
  assert(await text('#studyCount') === `${ch3.length} / ${ch3.length} groups`, 'count follows the chapter filter');
  assert((await pg.evaluate(() => JSON.parse(localStorage.getItem('lifeuk.studyPrefs')))).memoChapter === 3, 'memoChapter stored in studyPrefs');
  await pg.reload(); await openMemoTab();
  assert((await cardIds()).length === ch3.length && await pg.$eval('#studySubChips .chip:nth-child(4)', e => e.classList.contains('active')), 'chapter filter kept after reload');
  await pg.click('#studySubChips .chip:nth-child(1)');
  assert((await cardIds()).length === GROUP_COUNT, 'All chip: every group again');

  // search: title + memory note + hook
  await pg.fill('#studySearch', '1928');
  const hits = await cardIds();
  const hitsOk = await pg.evaluate(ids => ids.every(id => { const g = memoGroupById(id); return (g.title + ' ' + (g.body || '') + ' ' + g.hook).includes('1928'); }), hits);
  assert(hits.includes('vote') && hitsOk && await text('#studyCount') === `${hits.length} / ${GROUP_COUNT} groups`, `search "1928": ${hits.length} groups, each mentions it (${hits.join(',')})`);
  await pg.fill('#studySearch', '斬王');
  assert((await cardIds()).join() === 'king-parliament', 'search matches the hook text (斬王 → 國王 vs 國會)');
  await pg.fill('#studySearch', '投票權');
  assert((await cardIds())[0] === 'vote', 'search matches the title');
  await pg.fill('#studySearch', 'zzzz');
  assert(await text('#studyContent') === 'No groups match.', 'no match: "No groups match."');
  await pg.fill('#studySearch', '');

  // ── due banner (seeded progress) ──
  const day = await today(), yesterday = await addDays(day, -1), later = await addDays(day, 9);
  await pg.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [MEMO_LS, { vote: { lv: 2, due: day }, ww2: { lv: 1, due: yesterday }, parliament: { lv: 4, due: later }, writers: { lv: 1, due: later } }]);
  await pg.reload(); await openMemoTab();
  const banner = await pg.$eval('#studyLead .memo-due', e => ({ title: e.querySelector('b').textContent, sub: e.querySelector('small').textContent, lang: e.querySelector('small').getAttribute('lang'), start: e.querySelector('button').textContent }));
  assert(banner.title === '2 groups to review today' && banner.sub === 'Right to vote · Second World War' && banner.lang === 'en' && banner.start === 'Start',
    'banner: "2 groups to review today", due titles (vote has more questions, first), Start ▶: ' + JSON.stringify(banner));
  const order = await cardIds();
  assert(order[0] === 'vote' && order[1] === 'ww2' && order[GROUP_COUNT - 1] === 'parliament' && order[GROUP_COUNT - 2] === 'writers', 'list: due first, then new, learning, done last');
  const badges = await pg.$$eval('#studyContent .memo-card', els => Object.fromEntries(els.map(e => [e.dataset.arg, [e.querySelector('.memo-badge').textContent, e.querySelector('.memo-bar i').style.width, e.className]])));
  assert(badges.vote[0] === 'Due today' && badges.vote[1] === '50%' && /\bdue\b/.test(badges.vote[2]), 'due card: "Due today", bar Lv2 = 50%');
  assert(badges.writers[0] === 'Learning · Lv1' && badges.writers[1] === '25%' && /\blearning\b/.test(badges.writers[2]), 'learning card: "Learning · Lv1", bar 25%');
  assert(badges.parliament[0] === 'Known · in 9 days' && badges.parliament[1] === '100%' && /\bdone\b/.test(badges.parliament[2]), 'done card: "Known · in 9 days", full bar');
  const cardColour = await pg.evaluate(() => {
    const probe = name => { const i = document.createElement('i'); i.style.color = `var(${name})`; document.body.appendChild(i); const c = getComputedStyle(i).color; i.remove(); return c; };
    const left = sel => getComputedStyle(document.querySelector(sel)).borderLeftColor;
    return { due: left('.memo-card.due') === probe('--orange'), done: left('.memo-card.done') === probe('--green-light') };
  });
  assert(cardColour.due && cardColour.done, 'card status colours come from the tokens (due orange, done green)');

  // ── group screen: look ──
  await pg.evaluate(() => window.scrollTo(0, 400));
  const listY = await pg.evaluate(() => window.scrollY);
  // a DOM click: Playwright's own click would first scroll the banner (top of the list) into view
  await pg.$eval('#studyLead .memo-due button', e => e.click());
  assert(await pg.$eval('#screenMemo', e => e.classList.contains('active')) && await text('#memoTitle') === '🗳️ Right to vote', 'Start opens the first due group (🗳️ Right to vote)');
  const look = await pg.evaluate(() => ({
    steps: [...document.querySelectorAll('#memoSteps .memo-step')].map(e => e.textContent + (e.classList.contains('on') ? '*' : '')),
    hook: (document.querySelector('#memoBody .memo-hook') || {}).textContent, hookLang: (document.querySelector('#memoBody .memo-hook [lang]') || {}).lang,
    table: document.querySelectorAll('#memoBody .note-table tbody tr').length, start: (document.querySelector('#memoBody .memo-start') || {}).textContent,
    heading: /記憶法（投票權）|Memory aid \(Right to vote\)/.test(document.querySelector('#memoBody').textContent),
    noteLang: (document.querySelector('#memoBody .memo-note') || {}).lang,
  }));
  assert(look.steps.join('|') === '① Look*|② Test (5)', 'steps ① Look (on) / ② Test (5): ' + look.steps.join('|'));
  assert(/89 no votes/.test(look.hook) && look.hookLang === 'en' && look.table === 7 && !look.heading && look.noteLang === 'en', 'hook box + the 7-row table (no repeated heading line), English in the English UI (v2.2.0)');
  assert(look.start === 'Got it — start the test', 'start button text');
  assert(await pg.evaluate(() => document.activeElement === byId('memoTitle')), 'S-227: opening a group moves focus to its title');

  // ── test → result (4 / 5 from Lv2 → Lv3) ──
  await runTest([true, true, false, true, true]);
  assert(await pg.$eval('#screenMemo', e => e.classList.contains('active')), '↩ Back on the last question returns to the group screen');
  const res = await pg.evaluate(() => ({
    pct: document.querySelector('#memoBody .memo-pct').textContent, verdict: document.querySelector('#memoBody .memo-verdict').textContent,
    sched: [...document.querySelectorAll('#memoBody .memo-lv')].map(e => e.className.replace('memo-lv', '').trim() + ':' + e.textContent),
    wrong: [...document.querySelectorAll('#memoBody .memo-wrong li')].map(li => [li.querySelector('.memo-q').textContent, li.querySelector('.memo-wrong-yue').textContent]),
    steps: [...document.querySelectorAll('#memoSteps .memo-step')].map(e => e.textContent),
    next: (document.querySelector('#memoBody .memo-next') || {}).textContent,
  }));
  assert(res.pct === '80%' && res.verdict === 'Test 4/5 (≥ 70%) → up to Lv3', 'result: 80%, "Test 4/5 (≥ 70%) → up to Lv3": ' + res.verdict);
  assert(res.sched.join('|') === 'past:Lv11 day|past:Lv23 days|next:Lv37 days|:Lv414 days', 'schedule: Lv1–2 past, Lv3 next: ' + res.sched.join('|'));
  const wrongQ = await pg.evaluate(() => { const q = state.questions[2]; return [q.q, q.yue]; });
  assert(res.wrong.length === 1 && res.wrong[0][0] === wrongQ[0] && res.wrong[0][1] === wrongQ[1], 'the wrong question listed (English + Cantonese)');
  assert(res.steps.join('|') === '✓ Look|✓ Test 4/5', 'steps after the test: ✓ Look / ✓ Test 4/5');
  const due7 = await addDays(day, 7);
  assert(JSON.stringify((await stored()).vote) === JSON.stringify({ lv: 3, due: due7 }), `progress stored: vote Lv3, due ${due7}`);
  const streaks = await pg.evaluate(() => state.questions.map(q => streakOf(q)));
  assert(streaks.join() === '1,1,0,1,1', 'answers recorded practice streaks like any side session');
  // language switch / re-render never records twice
  await pg.evaluate(() => { setLang('zh-HK'); setLang('en'); rerenderCurrentScreen(); });
  assert(JSON.stringify((await stored()).vote) === JSON.stringify({ lv: 3, due: due7 }) && await pg.$eval('#memoBody .memo-pct', e => e.textContent) === '80%', 're-render keeps the result, records nothing more');
  assert(res.next === 'Next: Second World War', 'next group = the next due / new group in list order: ' + res.next);
  // v2.3.0: on the phone Next sits where the test's last ↩ Back was (both pinned bottom right): wait out the double tap
  // guard (CUI-0011) as a person's second, separate tap would
  await pg.waitForTimeout(GUARD_WAIT_MS);
  await pg.click('#memoBody .memo-next');
  assert(await text('#memoTitle') === '✈️ Second World War' && await pg.$('#memoBody .memo-start') !== null, 'next group opens on its look view');

  // back to the list at the same scroll
  await pg.click('#screenMemo .memo-back');
  assert(await pg.$eval('#screenStudy', e => e.classList.contains('active')) && await pg.$eval('.study-tab[data-tab="memo"]', e => e.classList.contains('active')), '‹ back: Study, memo tab');
  assert(Math.abs(await pg.evaluate(() => window.scrollY) - listY) <= 1, `list scroll restored (${listY})`);

  // ── a fail: 3-question group, all wrong → stays Lv0, due tomorrow; no hook box ──
  await pg.fill('#studySearch', '陪審員');
  await pg.click('#studyContent .memo-card[data-arg="jury"]');
  assert(await pg.$('#memoBody .memo-hook') === null && await text('#memoSteps .memo-step:nth-child(2)') === '② Test (3)', 'no hook → no hook box; a 3-question group tests 3');
  await runTest([false, false, false]);
  const fail = await pg.evaluate(() => ({ pct: document.querySelector('#memoBody .memo-pct').textContent, verdict: document.querySelector('#memoBody .memo-verdict').textContent }));
  const tomorrow = await addDays(day, 1);
  assert(fail.pct === '0%' && fail.verdict === 'Test 0/3 · below 70%, review again tomorrow', 'fail verdict: ' + fail.verdict);
  assert(JSON.stringify((await stored()).jury) === JSON.stringify({ lv: 0, due: tomorrow }), 'fail at Lv0: Lv0, due tomorrow');
  assert(await schedule() === ':Lv11 day|:Lv23 days|:Lv37 days|:Lv414 days', 'W-065: a Lv0 fail marks no schedule box: ' + await schedule());
  assert(await pg.evaluate(() => document.activeElement === byId('memoTitle')), 'S-227: the result moves focus to the group title');
  await pg.click('#memoBody .memo-again');
  assert(await pg.$('#memoBody .memo-start') !== null && await pg.$('#memoBody .memo-pct') === null, '"Review again" goes back to the look view');

  // ── W-064 / W-065 (user: a fail drops one level): Lv4 fail → Lv3, due tomorrow; Lv3 box reads Tomorrow, nothing "next" ──
  await pg.click('#screenMemo .memo-back');
  await setRecord('parliament', { lv: 4, due: day });
  await openFromList('國會兩院', 'parliament');
  await runTest([false, false, false, false, false]);
  assert(await text('#memoBody .memo-verdict') === 'Test 0/5 · below 70%, down to Lv3, review again tomorrow', 'W-064: Lv4 fail verdict says it dropped to Lv3');
  assert(JSON.stringify((await stored()).parliament) === JSON.stringify({ lv: 3, due: tomorrow }), 'W-064: Lv4 fail stored as Lv3, due tomorrow');
  assert(await schedule() === 'past:Lv11 day|past:Lv23 days|retry:Lv3Tomorrow|:Lv414 days' && await pg.$('#memoBody .memo-lv.next') === null,
    'W-065: fail schedule: Lv1–2 past, Lv3 "Tomorrow", no "next" interval: ' + await schedule());
  await pg.click('#screenMemo .memo-back');
  assert(await pg.$eval('#studyContent .memo-card[data-arg="parliament"] .memo-badge', e => e.textContent) === 'Learning · Lv3', 'W-064: the list reads "Learning · Lv3", not Known');

  // ── S-232 (user): unanswered questions do not count ──
  const voteBefore = (await stored()).vote;
  await openFromList('投票權', 'vote');
  await runTest([null, null, null, null, null]);
  const none = await pg.evaluate(() => ({ none: (document.querySelector('#memoBody .memo-none') || {}).textContent, pct: !!document.querySelector('#memoBody .memo-pct'),
    again: !!document.querySelector('#memoBody .memo-again'), next: !!document.querySelector('#memoBody .memo-next') }));
  assert(none.none === 'No answers were recorded — nothing changed.' && !none.pct && none.again && !none.next, 'S-232: nothing answered → "No answers were recorded", Review again only: ' + JSON.stringify(none));
  assert(JSON.stringify((await stored()).vote) === JSON.stringify(voteBefore), 'S-232: nothing answered → level and due unchanged');
  await pg.click('#memoBody .memo-again');
  await runTest([true, true, null, null, null]);
  assert(await text('#memoBody .memo-pct') === '100%' && await text('#memoBody .memo-verdict') === 'Test 2/2 (≥ 70%) → up to Lv4', 'S-232: 2 answered, both right → 2/2 = 100%, up a level');
  assert(JSON.stringify((await stored()).vote) === JSON.stringify({ lv: 4, due: await addDays(day, 14) }) && await pg.$('#memoBody .memo-wrong') === null, 'S-232: skipped questions are not listed as wrong');
  await pg.click('#memoBody .memo-again');
  await runTest([true, false, null, false, true]);
  assert(await text('#memoBody .memo-verdict') === 'Test 2/4 · below 70%, down to Lv3, review again tomorrow' && await pg.$$eval('#memoBody .memo-wrong li', l => l.length) === 2,
    'S-232: 2 of 4 answered right = 50% → down a level; the 2 wrong ones listed');

  // ── S-231: a double tap on the last Back records the test once ──
  await pg.click('#screenMemo .memo-back');
  await setRecord('writers', { lv: 1, due: day });
  await openFromList('作家', 'writers');
  await runTest([true, true, true, true, true], { dblBack: true });
  assert(await pg.$eval('#screenMemo', e => e.classList.contains('active')) && JSON.stringify((await stored()).writers) === JSON.stringify({ lv: 2, due: await addDays(day, 3) }),
    'S-231: double tap on ↩ Back: one record (Lv1 → Lv2), result shown');

  // ── C2 (user): leave a test mid-way. The quiz header has no 🏠 in a memo test, it reads "‹ Memory" (styled like the group
  // screen's .memo-back) and goes back to the group's look view, recording nothing ──
  await pg.click('#screenMemo .memo-back');
  await openFromList('陪審員', 'jury');
  const juryTitle = await text('#memoTitle');
  const progressBefore = JSON.stringify(await stored());
  const quizBack = () => pg.$eval('#screenQuiz .quiz-header .back-btn', e => ({ text: e.textContent.trim(), memo: e.classList.contains('memo-back'),
    // S-240 (v1.6.1): the ‹ is a decorative chevron line icon before the words; icon = the 🏠 icon button
    icon: e.classList.contains('icon-btn') || !!e.querySelector('svg:not([data-icon-name="chevronLeft"])'), label: e.getAttribute('aria-label'), title: e.getAttribute('title'),
    visible: !!e.getClientRects().length, chev: !!e.querySelector('svg.line-icon[data-icon-name="chevronLeft"][aria-hidden="true"]') }));
  const homeShown = () => pg.$$eval('#screenQuiz [data-icon-name="home"]', els => els.some(e => e.getClientRects().length));
  await pg.click('.memo-start');
  await pg.waitForTimeout(GUARD_WAIT_MS);
  let qb = await quizBack();
  assert(qb.visible && qb.memo && !qb.icon && qb.chev && qb.text === 'Memory' && qb.label === null && qb.title === null && !(await homeShown()),
    'C2: memo test header: "‹ Memory" (memo-back style, named by its words; S-240: ‹ = aria-hidden chevron icon), no 🏠: ' + JSON.stringify(qb));
  await answer(true);
  await pg.click('#nextBtn');
  await pg.evaluate(() => { setLang('zh-HK'); });
  qb = await quizBack();
  assert(qb.memo && qb.text === '記憶法' && !(await homeShown()), 'C2: zh-HK re-render keeps 「‹ 記憶法」: ' + qb.text);
  await pg.evaluate(() => { setLang('en'); rerenderCurrentScreen(); });
  assert((await quizBack()).text === 'Memory' && await pg.evaluate(() => state.current === 1), 'C2: back to en, still on question 2');
  await pg.evaluate(() => window.scrollTo(0, 300));
  await pg.click('#screenQuiz .quiz-header .back-btn');
  const left = await pg.evaluate(() => ({ screen: document.querySelector('.screen.active').id, ret: sessionReturn, start: !!document.querySelector('#memoBody .memo-start'),
    pct: !!document.querySelector('#memoBody .memo-pct'), focus: document.activeElement === byId('memoTitle'), y: window.scrollY, title: byId('memoTitle').textContent }));
  assert(left.screen === 'screenMemo' && left.ret === null && left.start && !left.pct && left.title === juryTitle,
    'C2: ‹ Memory → the same group\'s look view (hook + table), not Study, return point cleared: ' + JSON.stringify(left));
  assert(left.y === 0 && left.focus, 'C2: back on the group screen at the top, focus on the group title');
  assert(JSON.stringify(await stored()) === progressBefore, 'C2: leaving mid-way records no memo level / due');
  // another memo test, then other sessions: Home is back, and nothing of the memo return lingers
  await pg.click('.memo-start');
  await pg.waitForTimeout(GUARD_WAIT_MS);
  assert((await quizBack()).memo, 'C2: a new memo test shows ‹ Memory again');
  // a double tap: the 2nd tap lands on #screenMemo's own ‹ back (same spot) and is ignored (CUI-0011 guard)
  await pg.dblclick('#screenQuiz .quiz-header .back-btn');
  assert(await pg.evaluate(() => document.querySelector('.screen.active').id === 'screenMemo' && sessionReturn === null && !!document.querySelector('#memoBody .memo-start')),
    'C2: double tap on ‹ Memory stays on the group\'s look view (not Study)');
  assert(JSON.stringify(await stored()) === progressBefore, 'C2: still nothing recorded');
  await pg.click('.memo-start');
  await pg.waitForTimeout(GUARD_WAIT_MS);
  await pg.evaluate(() => startFactPractice(21)); // switching sessions straight from a memo test
  qb = await quizBack();
  assert(!qb.memo && qb.icon && qb.label === 'Home' && await homeShown(), 'C2: Study fact practice after it: 🏠 Home again: ' + JSON.stringify(qb));
  await pg.evaluate(() => { goHome(); pendingMode = 'practice'; startExam(1); });
  qb = await quizBack();
  assert(!qb.memo && qb.icon && qb.label === 'Home' && qb.text === '' && await pg.evaluate(() => sessionReturn === null), 'C2: a later Practice exam: 🏠 Home, no side session: ' + JSON.stringify(qb));
  await pg.evaluate(() => { state.current = state.questions.length - 1; const q = state.questions[state.current]; state.answers[state.current] = [...q.a]; revealAnswer(); });
  assert(await text('#nextBtn') === 'Finish', 'C2: its last question finishes normally (Finish ✓)');
  await pg.click('#screenQuiz .quiz-header .back-btn');
  assert(await pg.$eval('#screenHome', e => e.classList.contains('active')), 'C2: its 🏠 goes Home');
  await pg.click('#modeStudy');
  await pg.waitForTimeout(GUARD_WAIT_MS);

  // ── single-note group: each question with its own note ──
  await pg.fill('#studySearch', '');
  await pg.click('#studyContent .memo-card[data-arg="single"]');
  const singles = await pg.$$eval('#memoBody .memo-single-item', els => els.map(e => [e.querySelector('.memo-single-q').getAttribute('lang'), e.querySelector('.memo-single-note').getAttribute('lang'), e.querySelector('.memo-single-note').textContent.length]));
  assert(singles.length === 8 && singles.every(([q, note, n]) => q === 'en' && note === 'en' && n > 0), 'single-note group: 8 questions (lang en) with their English notes (lang en, v2.2.0)');

  // ── zh-HK strings ──
  await pg.evaluate(() => setLang('zh-HK'));
  // v2.2.0: back in zh-HK, the group screen shows the Cantonese title and notes again
  const zhSingle = await pg.evaluate(() => ({ title: byId('memoTitle').textContent, lang: byId('memoTitle').lang,
    notes: [...document.querySelectorAll('#memoBody .memo-single-note')].map(e => e.lang) }));
  assert(zhSingle.title === '📝 單題注解' && zhSingle.lang === 'zh-HK' && zhSingle.notes.length === 8 && zhSingle.notes.every(l => l === 'zh-HK'),
    'zh-HK: Cantonese group title and notes (lang zh-HK): ' + JSON.stringify(zhSingle));
  assert(await text('#memoSteps .memo-step') === '① 細閱' && await text('#memoBody .memo-start') === '已記住，開始測驗' && await text('#screenMemo .memo-back') === '記憶法', 'zh-HK look view: ① 細閱 / 已記住，開始測驗 ▶ / ‹ 記憶法');
  await pg.click('#screenMemo .memo-back');
  await pg.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [MEMO_LS, { vote: { lv: 1, due: day }, parliament: { lv: 4, due: later } }]);
  await pg.evaluate(() => renderStudy());
  const zh = await pg.evaluate(() => ({ tab: document.querySelector('.study-tab[data-tab="memo"] [data-i18n]').textContent, banner: document.querySelector('.memo-due b').textContent,
    start: document.querySelector('.memo-due button').textContent, count: document.querySelector('#studyCount').textContent,
    badges: [...document.querySelectorAll('.memo-card')].map(e => e.querySelector('.memo-badge').textContent) }));
  assert(zh.tab === '記憶法' && zh.banner === '今日需溫習 1 組' && zh.start === '開始' && zh.count === `${GROUP_COUNT} / ${GROUP_COUNT} 組`, 'zh-HK list: 記憶法 tab, 今日需溫習 1 組, 開始 ▶, count: ' + JSON.stringify(zh).slice(0, 160));
  assert(zh.badges[0] === '今日到期' && zh.badges.includes('未溫習') && zh.badges[GROUP_COUNT - 1] === '已熟記 · 9 日後', 'zh-HK badges: 今日到期 / 未溫習 / 已熟記 · 9 日後');
  await pg.click('.memo-due button');
  await runTest([true, true, true, true, true]);
  assert(await text('#memoBody .memo-verdict') === '測驗 5/5（≥ 70%）→ 升至 Lv2' && await text('#memoBody .memo-again') === '再溫習一次', 'zh-HK result: 測驗 5/5（≥ 70%）→ 升至 Lv2 / 再溫習一次');
  assert((await text('#memoBody .memo-next')).startsWith('下一組：'), 'zh-HK next: 下一組：…');
  const zhFail = await pg.evaluate(() => [memoVerdictText({ passed: false, prevLv: 4, lv: 3, correct: 0, total: 5 }), memoVerdictText({ passed: false, prevLv: 0, lv: 0, correct: 1, total: 5 }), t('memo.noAnswers'), t('memo.tomorrow')]);
  assert(zhFail.join('|') === '測驗 0/5 · 未達 70%，降至 Lv3，明日再溫習|測驗 1/5 · 未達 70%，明日再溫習|未有作答任何題目，不會記錄進度|明日', 'zh-HK fail texts: ' + zhFail.join('|'));
  await pg.evaluate(() => setLang('en'));

  // ── 360px: tabs fit, no horizontal scroll (list, look, result) ──
  await pg.setViewportSize({ width: NARROW, height: 740 });
  assert(await noHScroll(), `${NARROW}px result view: no horizontal scroll`);
  await pg.click('#memoBody .memo-again');
  assert(await noHScroll(), `${NARROW}px look view (table): no horizontal scroll`);
  await pg.click('#screenMemo .memo-back');
  const tabFit = await pg.$$eval('.study-tab', els => els.every(e => e.getBoundingClientRect().right <= window.innerWidth && e.scrollWidth <= e.clientWidth + 1));
  assert(tabFit && await noHScroll(), `${NARROW}px Study memo list: 5 tabs fit, no horizontal scroll`);
  await pg.evaluate(() => setLang('zh-HK'));
  assert(await noHScroll() && await pg.$$eval('.study-tab', els => els.every(e => e.getBoundingClientRect().right <= window.innerWidth)), `${NARROW}px zh-HK: tabs fit`);
  await pg.evaluate(() => setLang('en'));

  // ── v1.6.1 (user: 「記憶法列表用每個兩行顯示」 = two cards per row): a 2-column grid at phone widths; nothing overlaps or
  // clips, cards in a row share a height, DOM order runs row-wise; the due banner + count line stay full width; en / zh-HK
  // × small / large × 320 / 360 / 390 without sideways scroll. v2.3.0 (mockup desktop-memo.html rev 1 / rev 4, user
  // 2026-10-13): the badge sits top right beside the title (no longer below it), so a title may take more lines ──
  await pg.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [MEMO_LS, { vote: { lv: 1, due: day }, writers: { lv: 1, due: later }, parliament: { lv: 4, due: later } }]);
  const gridBad = [];
  for (const lang of ['en', 'zh-HK']) for (const size of ['small', 'large']) for (const width of [320, NARROW, 390]) {
    await pg.setViewportSize({ width, height: 740 });
    await pg.evaluate(([l, s]) => { setFontSize(s); setLang(l); renderStudy(); }, [lang, size]);
    const g = await pg.evaluate(() => {
      const content = document.querySelector('#studyContent').getBoundingClientRect();
      const banner = document.querySelector('#studyLead .memo-due').getBoundingClientRect();
      const cards = [...document.querySelectorAll('#studyContent .memo-card')];
      const out = [];
      const rects = cards.map(c => c.getBoundingClientRect());
      cards.forEach((c, i) => {
        const r = rects[i], name = c.querySelector('.memo-name'), badge = c.querySelector('.memo-badge');
        const n = name.getBoundingClientRect(), bd = badge.getBoundingClientRect();
        const lineH = parseFloat(getComputedStyle(name).lineHeight);
        if (n.left < r.left - 1 || n.right > r.right + 1 || bd.left < r.left - 1 || bd.right > r.right + 1) out.push(c.dataset.arg + ' outside card');
        if (bd.top > n.top + lineH / 2 || bd.left < n.right - 1) out.push(c.dataset.arg + ' badge not top right beside the title');
        if (name.scrollWidth > name.clientWidth + 1 || badge.scrollWidth > badge.clientWidth + 1) out.push(c.dataset.arg + ' clipped');
        const col = i % 2, mate = col ? rects[i - 1] : rects[i + 1];
        if (mate && (Math.abs(mate.top - r.top) > 1 || Math.abs(mate.height - r.height) > 1)) out.push(c.dataset.arg + ' row mismatch');
        if (col && r.left <= rects[i - 1].right) out.push(c.dataset.arg + ' not right column');
        if (i >= 2 && r.top < rects[i - 2].bottom) out.push(c.dataset.arg + ' row overlap');
      });
      const halfW = rects[0].width < content.width / 2;
      return { out, halfW, banner: Math.abs(banner.width - content.width) <= 1, docW: document.scrollingElement.scrollWidth, vw: window.innerWidth };
    });
    const ok = g.out.length === 0 && g.halfW && g.banner && g.docW <= g.vw;
    if (!ok) gridBad.push(`${lang} ${size} ${width}: ${JSON.stringify(g).slice(0, 300)}`);
  }
  assert(gridBad.length === 0, 'memo list: two cards per row, badge top right, no clip / overlap, equal row heights, full-width banner, no h-scroll (en/zh-HK × small/large × 320/360/390) ' + gridBad.join(' || '));
  await pg.evaluate(() => { setFontSize('small'); setLang('en'); });
  await pg.setViewportSize({ width: 390, height: 844 });

  // ── S-238 (b9443f4): at 320px, large text, every group's test header keeps the mode badge (Practice / 練習) on one line,
  // on the same row as the memo back button and inside the screen; the set label wraps instead.
  // S-241: and the badge stays inside the header's content box (en "🧠 CROWN DEPENDENCY" — one long word — pushed it ~9px
  // into the right gutter until .quiz-label could shrink and break anywhere) ──
  await pg.setViewportSize({ width: 320, height: 568 });
  const badgeBad = [];
  for (const lang of ['en', 'zh-HK']) {
    await pg.evaluate(l => { setFontSize('large'); setLang(l); }, lang);
    badgeBad.push(...await pg.evaluate(() => {
      const out = [];
      const lines = el => { const r = document.createRange(); r.selectNodeContents(el); return new Set([...r.getClientRects()].map(x => Math.round(x.top))).size; };
      MEMO_GROUPS.forEach(g => {
        openMemoGroup(g.id);
        startMemoTest();
        const header = document.querySelector('#screenQuiz .quiz-header');
        const back = header.querySelector('.back-btn').getBoundingClientRect(), badge = byId('modeBadge');
        const bd = badge.getBoundingClientRect();
        const sameRow = bd.top < back.bottom && bd.bottom > back.top;
        const hr = header.getBoundingClientRect(), contentRight = hr.right - parseFloat(getComputedStyle(header).paddingRight);
        const inHeader = bd.right <= contentRight + 0.5 && header.scrollWidth <= header.clientWidth;
        if (!isMemoSession() || lines(badge) !== 1 || !sameRow || bd.right > window.innerWidth || !inHeader) {
          out.push(`${getLang()} ${g.id}: lines ${lines(badge)}, same row ${sameRow}, badge right ${Math.round(bd.right)} / header content right ${Math.round(contentRight)}`);
        }
        goHome(); // a memo test: back to the group's look view, nothing recorded
      });
      return out;
    }));
  }
  assert(badgeBad.length === 0 && await noHScroll(), 'S-238 / S-241: 320px large text: mode badge on one line beside the memo back button and inside the header in every group test (en / zh-HK) ' + badgeBad.slice(0, 5).join('; '));
  await pg.evaluate(() => { setFontSize('small'); setLang('en'); memoBack(); });
  await pg.setViewportSize({ width: 390, height: 844 });

  // stored prefs / progress junk never breaks the tab
  await pg.evaluate(([k]) => { localStorage.setItem(k, '{bad'); localStorage.setItem('lifeuk.studyPrefs', JSON.stringify({ tab: 'memo', memoChapter: 'x' })); }, [MEMO_LS]);
  await pg.reload(); await pg.click('#modeStudy');
  assert((await cardIds()).length === GROUP_COUNT && await pg.$('.memo-due') === null, 'bad progress + bad memoChapter: memo tab, all groups, no banner');

  // a cached pre-v1.6.0 index.html (SW cutover) has no memo tab / #screenMemo: a stored memo tab falls back, nothing throws
  await pg.reload(); // a fresh page: studyPrefs still says tab 'memo'
  await pg.evaluate(() => { document.querySelector('.study-tab[data-tab="memo"]').remove(); byId('screenMemo').remove(); });
  await pg.click('#modeStudy');
  const oldShell = await pg.evaluate(() => { openMemoGroup('vote'); return { tab: study.tab, active: document.querySelector('.screen.active').id, facts: document.querySelectorAll('#studyContent .fact').length }; });
  assert(oldShell.tab === 'chapters' && oldShell.active === 'screenStudy' && oldShell.facts > 0, 'old shell: stored memo tab → chapters; opening a group does nothing: ' + JSON.stringify(oldShell));

  assert(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  assert(warns.length === 0, 'no missing i18n keys / memo / action warnings: ' + warns.join(' | '));
  await b.close();
  console.log('MEMO PASS');
})().catch(e => { console.error(e.message); process.exit(1); });
