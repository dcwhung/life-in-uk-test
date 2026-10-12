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
  assert(await pg.$('#studyContent .memo-due') === null, 'no due banner with no progress');
  const first = await pg.$eval('#studyContent .memo-card', e => ({ title: e.querySelector('.memo-name').textContent, lang: e.querySelector('.memo-name').getAttribute('lang'),
    badge: e.querySelector('.memo-badge').textContent, meta: e.querySelector('.memo-meta').textContent, bar: e.querySelector('.memo-bar i').style.width }));
  assert(first.title === '🎆 英國節日' && first.lang === 'zh-HK' && first.badge === 'New' && first.meta === '16 questions' && first.bar === '0%',
    'new groups by question count: first card 🎆 英國節日 · New · 16 questions · empty bar (title lang zh-HK): ' + JSON.stringify(first));
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
  const banner = await pg.$eval('#studyContent .memo-due', e => ({ title: e.querySelector('b').textContent, sub: e.querySelector('small').textContent, lang: e.querySelector('small').getAttribute('lang'), start: e.querySelector('button').textContent }));
  assert(banner.title === '2 groups to review today' && banner.sub === '投票權 · 二次世界大戰' && banner.lang === 'zh-HK' && banner.start === 'Start ▶',
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
  await pg.$eval('#studyContent .memo-due button', e => e.click());
  assert(await pg.$eval('#screenMemo', e => e.classList.contains('active')) && await text('#memoTitle') === '🗳️ 投票權', 'Start opens the first due group (🗳️ 投票權)');
  const look = await pg.evaluate(() => ({
    steps: [...document.querySelectorAll('#memoSteps .memo-step')].map(e => e.textContent + (e.classList.contains('on') ? '*' : '')),
    hook: (document.querySelector('#memoBody .memo-hook') || {}).textContent, hookLang: (document.querySelector('#memoBody .memo-hook [lang]') || {}).lang,
    table: document.querySelectorAll('#memoBody .note-table tbody tr').length, start: (document.querySelector('#memoBody .memo-start') || {}).textContent,
    heading: document.querySelector('#memoBody').textContent.includes('記憶法（投票權）'),
  }));
  assert(look.steps.join('|') === '① Look*|② Test (5)', 'steps ① Look (on) / ② Test (5): ' + look.steps.join('|'));
  assert(/89 冇票/.test(look.hook) && look.hookLang === 'zh-HK' && look.table === 7 && !look.heading, 'hook box + the 7-row table (no repeated heading line)');
  assert(look.start === 'Got it — start the test ▶', 'start button text');
  assert(await pg.evaluate(() => document.activeElement === byId('memoTitle')), 'S-227: opening a group moves focus to its title');

  // ── test → result (4 / 5 from Lv2 → Lv3) ──
  await runTest([true, true, false, true, true]);
  assert(await pg.$eval('#screenMemo', e => e.classList.contains('active')), '↩ Back on the last question returns to the group screen');
  const res = await pg.evaluate(() => ({
    pct: document.querySelector('#memoBody .memo-pct').textContent, verdict: document.querySelector('#memoBody .memo-verdict').textContent,
    sched: [...document.querySelectorAll('#memoBody .memo-lv')].map(e => e.className.replace('memo-lv', '').trim() + ':' + e.textContent),
    wrong: [...document.querySelectorAll('#memoBody .memo-wrong li')].map(li => [li.querySelector('[lang="en"]').textContent, li.querySelector('[lang="zh-HK"]').textContent]),
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
  assert(res.next === 'Next: 二次世界大戰 ▶', 'next group = the next due / new group in list order: ' + res.next);
  await pg.click('#memoBody .memo-next');
  assert(await text('#memoTitle') === '✈️ 二次世界大戰' && await pg.$('#memoBody .memo-start') !== null, 'next group opens on its look view');

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

  // ── S-231: a double tap on the last ↩ Back records the test once ──
  await pg.click('#screenMemo .memo-back');
  await setRecord('writers', { lv: 1, due: day });
  await openFromList('作家', 'writers');
  await runTest([true, true, true, true, true], { dblBack: true });
  assert(await pg.$eval('#screenMemo', e => e.classList.contains('active')) && JSON.stringify((await stored()).writers) === JSON.stringify({ lv: 2, due: await addDays(day, 3) }),
    'S-231: double tap on ↩ Back: one record (Lv1 → Lv2), result shown');

  // ── single-note group: each question with its own note ──
  await pg.click('#screenMemo .memo-back');
  await pg.fill('#studySearch', '');
  await pg.click('#studyContent .memo-card[data-arg="single"]');
  const singles = await pg.$$eval('#memoBody .memo-single-item', els => els.map(e => [e.querySelector('.memo-single-q').getAttribute('lang'), e.querySelector('.memo-single-note').getAttribute('lang'), e.querySelector('.memo-single-note').textContent.length]));
  assert(singles.length === 8 && singles.every(([en, zh, n]) => en === 'en' && zh === 'zh-HK' && n > 0), 'single-note group: 8 questions (lang en) with their notes (lang zh-HK)');

  // ── zh-HK strings ──
  await pg.evaluate(() => setLang('zh-HK'));
  assert(await text('#memoSteps .memo-step') === '① 睇' && await text('#memoBody .memo-start') === '記住咗，開始試 ▶' && await text('#screenMemo .memo-back') === '‹ 記憶法', 'zh-HK look view: ① 睇 / 記住咗，開始試 ▶ / ‹ 記憶法');
  await pg.click('#screenMemo .memo-back');
  await pg.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [MEMO_LS, { vote: { lv: 1, due: day }, parliament: { lv: 4, due: later } }]);
  await pg.evaluate(() => renderStudy());
  const zh = await pg.evaluate(() => ({ tab: document.querySelector('.study-tab[data-tab="memo"] [data-i18n]').textContent, banner: document.querySelector('.memo-due b').textContent,
    start: document.querySelector('.memo-due button').textContent, count: document.querySelector('#studyCount').textContent,
    badges: [...document.querySelectorAll('.memo-card')].map(e => e.querySelector('.memo-badge').textContent) }));
  assert(zh.tab === '記憶法' && zh.banner === '今日要溫 1 組' && zh.start === '開始 ▶' && zh.count === `${GROUP_COUNT} / ${GROUP_COUNT} 組`, 'zh-HK list: 記憶法 tab, 今日要溫 1 組, 開始 ▶, count: ' + JSON.stringify(zh).slice(0, 160));
  assert(zh.badges[0] === '今日到期' && zh.badges.includes('未溫') && zh.badges[GROUP_COUNT - 1] === '已熟 · 9 日後', 'zh-HK badges: 今日到期 / 未溫 / 已熟 · 9 日後');
  await pg.click('.memo-due button');
  await runTest([true, true, true, true, true]);
  assert(await text('#memoBody .memo-verdict') === '試 5/5（≥ 70%）→ 升到 Lv2' && await text('#memoBody .memo-again') === '再溫一次', 'zh-HK result: 試 5/5（≥ 70%）→ 升到 Lv2 / 再溫一次');
  assert((await text('#memoBody .memo-next')).startsWith('下一組：'), 'zh-HK next: 下一組：…');
  const zhFail = await pg.evaluate(() => [memoVerdictText({ passed: false, prevLv: 4, lv: 3, correct: 0, total: 5 }), memoVerdictText({ passed: false, prevLv: 0, lv: 0, correct: 1, total: 5 }), t('memo.noAnswers'), t('memo.tomorrow')]);
  assert(zhFail.join('|') === '試 0/5 · 未夠 70%，跌返 Lv3，聽日再溫|試 1/5 · 未夠 70%，聽日再溫|一題都未答，冇記錄進度|聽日', 'zh-HK fail texts: ' + zhFail.join('|'));
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
