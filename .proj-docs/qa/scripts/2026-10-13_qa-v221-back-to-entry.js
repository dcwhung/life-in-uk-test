// QA v2.2.1 back-to-entry (branch fix/quiz/back-to-entry @ eec49cf, incl. origin/main v2.2.0). Adapted from
// 2026-10-13_qa-v205-back-to-entry.js for the post-merge UI: the back words carry a chevronLeft line icon (no glyph),
// #8 memo reads main's "Memory", plan headers read "Back" named "Back to …", #9 reads "Q{n}" named "Back to Q{n}".
// Real clicks only for navigation (state is read to know which option is right / which task is which, never to navigate).
//   M  matrix: 320 / 390 / 1024 / 1280 × en / zh-HK × small / large = 16 fresh contexts; in each:
//      Home entry (home icon → Home), exam (home icon → confirm), #6 Flagged (quiz + Result header), #7 Study fact,
//      #8 memo test (+ v2.2.0 English notes regression), #9 Similar, #11 plan fact + plan practice task + #planRunBack;
//      per step: words, line icon (no glyph), accessible name ⊇ words, landing screen, focus, no sideways scroll, header
//      fits, back words on one line, plan "Chapter n" on one line, wrapped label right-aligned, no raw key, no errors
//   S  scenarios at 390 + 1280: language switch (⚙) inside each side session, nested Similar in Flagged, edges E1–E12
//   D  plan "Back to Day n tasks" (clock moved one day on; catch-up task of Day 1) in both languages
//   W  wrapped label: en "SIMILAR QUESTIONS" at 320 large text sits against the badge
//   U  cached-file mix: current tree + one v2.0.2 (c6b0806) or main v2.2.0 (fb5cc7b) file (U_TREE=<ref> uses that
//      ref's tree as the base, e.g. U_TREE=origin/main to tell pre-existing from new; U_REFS / U_FILES narrow it)
//   NODE_PATH=... CHROMIUM_PATH=... node 2026-10-13_qa-v221-back-to-entry.js [M|S|D|W|U|SH]
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '../../..');
const { startPagesServer } = require(path.join(ROOT, 'tests/pages-server.js'));
const SHOTS = path.join(__dirname, '../screenshots/v221-back-to-entry');
fs.mkdirSync(SHOTS, { recursive: true });
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const GUARD = 450; // > SCREEN_CHANGE_CLICK_GUARD_MS (350)
const MEMO_LS = 'lifeuk.memoProgress';
const res = [];
const findings = [];
const log = (ok, id, m, extra) => {
  res.push({ ok, id, m });
  if (!ok) findings.push(id + ' ' + m + (extra !== undefined ? ' ' + JSON.stringify(extra) : ''));
  console.log((ok ? 'ok   ' : 'FAIL ') + id + ' ' + m + (extra !== undefined && !ok ? ' ' + JSON.stringify(extra) : ''));
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const RAW_KEY = /\b(memo|study|common|quiz|app|home|plan|modal|result|similar|flagged)\.[a-z][A-Za-z]+\b/;
const GLYPH = /[‹›←→↩🏠]/;
const CJK = /[㐀-鿿！-？、-】]/;
const L = {
  en: { flagged: 'Flagged', study: 'Study', memo: 'Memory', q: n => `Q${n}`, qName: n => `Back to Q${n}`, back: 'Back',
    fact: 'Back to the fact', today: "Back to today's tasks", day: n => `Back to Day ${n} tasks`, home: 'Home', chapter: /^Chapter \d+$/ },
  'zh-HK': { flagged: '已標記', study: '溫習', memo: '記憶法', q: n => `第 ${n} 題`, qName: n => `返回第 ${n} 題`, back: '返回',
    fact: '返回知識點', today: '返回今日任務', day: n => `返回 Day ${n} 任務`, home: '主頁', chapter: /^Chapter \d+$/ }, // zh-HK common.chapterN is 'Chapter {n}' too
};

let base, server, browser;

async function newPage({ width = 390, height = 844, lang = 'en', font = 'small', url, clock } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, timezoneId: 'Europe/London', serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  if (clock) await pg.clock.install({ time: clock });
  pg.errs = []; pg.warns = [];
  pg.on('pageerror', e => pg.errs.push(e.message));
  pg.on('console', m => { if (/\[i18n\] missing key|no handler/.test(m.text())) pg.warns.push(m.text()); });
  await pg.goto(url || base + 'index.html');
  await pg.evaluate(([l, f]) => {
    localStorage.clear();
    localStorage.setItem('lifeuk.uiLang', JSON.stringify(l));
    localStorage.setItem('lifeuk.fontSize', JSON.stringify(f));
  }, [lang, font]);
  await pg.reload();
  pg.ctx = ctx; pg.lang = lang; pg.tag = `${width}/${lang}/${font}`;
  return pg;
}
const active = pg => pg.evaluate(() => document.querySelector('.screen.active').id);
// the header back button: visible words, its icon(s), accessible name (aria-label, else the words), title, action,
// whether the words sit on one line
const backOf = (pg, sel = '#screenQuiz .back-btn') => pg.$eval(sel, e => {
  const svgs = [...e.querySelectorAll('svg')].map(s => s.dataset.iconName);
  const lab = e.querySelector('.icon-label');
  let lines = 0;
  if (lab) { const r = document.createRange(); r.selectNodeContents(lab); lines = new Set([...r.getClientRects()].filter(q => q.width > 0).map(q => Math.round(q.top))).size; }
  const text = e.textContent.trim();
  return { text, icons: svgs, icon: e.classList.contains('icon-btn'), name: e.getAttribute('aria-label') || text, aria: e.getAttribute('aria-label'), title: e.getAttribute('title'), action: e.dataset.action, lines };
});
// a text back: words, a leading chevronLeft line icon, no glyph, words in its accessible name, one line
function textBackOk(b, words, name) {
  return b.text === words && !b.icon && b.icons.length === 1 && b.icons[0] === 'chevronLeft' && !GLYPH.test(b.text)
    && b.name.toLowerCase().includes(words.toLowerCase()) && (name === undefined || (b.aria === name && b.title === name)) && b.lines === 1;
}
const homeBackOk = (b, lb) => b.icon && b.icons.length === 1 && b.icons[0] === 'home' && b.text === '' && b.aria === lb.home;
async function click(pg, sel) {
  if (sel === '#nextBtn' && !(await pg.$('#nextBtn:visible'))) sel = '#quickNext';
  const el = await pg.$(sel + ':visible') || await pg.$(sel);
  if (!el) throw new Error('no element ' + sel + ' on ' + await active(pg));
  await el.scrollIntoViewIfNeeded();
  await el.click();
  await sleep(GUARD);
}
const tapBack = (pg, screen = 'screenQuiz') => click(pg, `#${screen} .back-btn`);
// the page fits, the active header fits, its back button is fully on screen, no raw key on the screen; the header label:
// lines, alignment (a wrapped one right-aligned against the badge)
async function layout(pg) {
  return pg.evaluate(raw => {
    const scr = document.querySelector('.screen.active');
    const h = scr.querySelector('.quiz-header');
    const b = scr.querySelector('.back-btn');
    const r = b ? b.getBoundingClientRect() : null;
    const re = new RegExp(raw);
    const lab = h && h.querySelector('.quiz-label');
    let label = null;
    if (lab && lab.getClientRects().length) {
      const range = document.createRange(); range.selectNodeContents(lab);
      const rects = [...range.getClientRects()].filter(q => q.width > 0);
      const lr = lab.getBoundingClientRect();
      const badge = lab.parentElement.querySelector('.quiz-mode-badge');
      const br = badge && badge.getClientRects().length ? badge.getBoundingClientRect() : null;
      // a line can be several rects (the emoji, then a <span lang>): its end is its rightmost rect
      const ends = {};
      rects.forEach(q => { const k = Math.round(q.top); ends[k] = Math.max(ends[k] || 0, q.right); });
      label = { text: lab.textContent, lines: Object.keys(ends).length, align: getComputedStyle(lab).textAlign,
        endsRight: Object.values(ends).every(r => Math.abs(r - lr.right) <= 2), gap: br ? Math.round(br.left - lr.right) : null,
        fits: lab.scrollWidth <= lab.clientWidth + 1 };
    }
    return {
      page: document.documentElement.scrollWidth <= window.innerWidth,
      sw: document.documentElement.scrollWidth, vw: window.innerWidth,
      header: !h || h.scrollWidth <= h.clientWidth + 1,
      btn: !r || (r.left >= 0 && r.right <= window.innerWidth + 0.5 && r.width > 0),
      btnText: !b || b.classList.contains('icon-btn') || b.scrollWidth <= b.clientWidth + 1,
      hdr: h ? [...h.children].map(c => c.className + ':' + Math.round(c.getBoundingClientRect().width)).join(',') + ' sw' + h.scrollWidth + '/cw' + h.clientWidth : '',
      raw: re.test(scr.innerText),
      label,
    };
  }, RAW_KEY.source);
}
async function checkLayout(pg, id, what, { oneLineLabel = false } = {}) {
  const l = await layout(pg);
  log(l.page && l.header && l.btn && l.btnText && !l.raw, id, `${pg.tag} ${what}: fits (page / header / back button), no raw key`, l);
  if (l.label && l.label.lines > 1) log(l.label.align === 'right' && l.label.endsRight && (l.label.gap === null || l.label.gap <= 16), id, `${pg.tag} ${what}: wrapped label "${l.label.text}" right-aligned against the badge`, l.label);
  if (oneLineLabel) log(!!l.label && l.label.lines === 1 && l.label.fits, id, `${pg.tag} ${what}: label "${l.label && l.label.text}" on one line, not broken mid-word`, l.label);
  return l;
}
async function answer(pg, right = true) {
  const picks = await pg.evaluate(ok => {
    const q = state.questions[state.current];
    const wrong = q.o.map((_, i) => i).filter(i => !q.a.includes(i));
    return ok ? q.a : wrong.slice(0, q.a.length);
  }, right);
  for (const i of picks) { await click(pg, `#opt${i}`); }
}
const qInfo = pg => pg.evaluate(() => ({ cur: state.current, total: state.questions.length, examNum: state.examNum, side: isSideSession(), revealed: state.current in state.revealed }));
async function answerNext(pg) {
  await answer(pg);
  const i = await qInfo(pg);
  if (i.cur < i.total - 1) await click(pg, '#nextBtn');
}
const focusInfo = pg => pg.evaluate(() => { const e = document.activeElement; return e ? { id: e.id, action: e.dataset && e.dataset.action, tag: e.tagName } : null; });
async function goHomeFromAnywhere(pg) {
  for (let i = 0; i < 5 && await active(pg) !== 'screenHome'; i++) {
    const s = await active(pg);
    const sel = s === 'screenPlanRun' ? '#planRunBack' : `#${s} .back-btn`;
    const b = await backOf(pg, sel).catch(() => null);
    if (b && b.action === 'goHome') await click(pg, sel);
    else await pg.evaluate(() => leaveToHome()).then(() => sleep(GUARD));
  }
}
async function startEasy(pg) {
  await click(pg, '#modePractice');
  await click(pg, '#diffGrid .diff-btn');
}
async function similarCta(pg) {
  if (await pg.$('#quizTabSimilar:visible')) await click(pg, '#quizTabSimilar');
  await click(pg, '#similarBox .sqm-cta button');
}
async function walkToSimilar(pg) {
  for (let k = 0; k < 20; k++) {
    await answer(pg);
    if (await pg.$('#similarBox .sqm-cta button')) return (await qInfo(pg)).cur;
    await click(pg, '#nextBtn');
  }
  throw new Error('no question with similar questions in 20');
}
async function openPlanToday(pg) {
  await click(pg, '.plan-cta');
  await click(pg, '#planCreateBtn');
  await click(pg, '#screenPlanSchedule .plan-block[data-action=openPlanDay]');
}
// memo look view in the UI language (v2.2.0 English notes regression)
async function memoLangOk(pg, id, what) {
  const m = await pg.evaluate(() => {
    const title = byId('memoTitle'), note = document.querySelector('#memoBody .memo-note'), hook = document.querySelector('#memoBody .memo-hook span');
    const singles = [...document.querySelectorAll('#memoBody .memo-single-note')];
    return { title: title.textContent, tlang: title.lang, nlang: note && note.lang, note: note ? note.innerText.slice(0, 400) : null,
      hook: hook && hook.textContent, hlang: hook && hook.lang, slang: singles.map(s => s.lang), stext: singles.map(s => s.innerText).join(' ').slice(0, 400) };
  });
  const en = pg.lang === 'en';
  const want = en ? 'en' : 'zh-HK';
  const ok = m.tlang === want && (m.nlang === null || m.nlang === want) && (!m.hook || m.hlang === want) && m.slang.every(l => l === want)
    && (en ? !CJK.test(m.title.replace(/^\S+\s/, '')) && !CJK.test(m.note || '') && !CJK.test(m.hook || '') && !CJK.test(m.stext) : CJK.test(m.title + (m.note || '') + m.stext));
  log(ok, id, `${pg.tag} ${what}: memo look view in ${want} (title / hook / note)`, m);
}

// ── M: one context, every entry, by clicks ──
async function homeAndExam(pg, id) {
  const lb = L[pg.lang];
  await startEasy(pg);
  await answerNext(pg);
  let b = await backOf(pg);
  log(homeBackOk(b, lb) && ['goHome', 'goBack'].includes(b.action), id + '.home', `${pg.tag} Home entry keeps the home icon (${b.aria})`, b);
  await checkLayout(pg, id + '.home', 'Home-entry quiz');
  await tapBack(pg);
  log(await active(pg) === 'screenHome', id + '.home', `${pg.tag} Home entry back → Home`);
  await click(pg, '#modeExam');
  await click(pg, '#examGrid .exam-btn:not(.all)');
  b = await backOf(pg);
  log(homeBackOk(b, lb), id + '.exam', `${pg.tag} exam keeps the home icon`, b);
  await tapBack(pg);
  const r = await pg.evaluate(() => ({ modal: byId('confirmModal').classList.contains('show'), scr: document.querySelector('.screen.active').id }));
  log(r.modal && r.scr === 'screenQuiz', id + '.exam', `${pg.tag} exam back asks to confirm`, r);
  await click(pg, '#confirmModal [data-action=confirmAccept]');
  log(await active(pg) === 'screenHome', id + '.exam', `${pg.tag} exam confirm → Home`);
}

async function flagged(pg, id) {
  const lb = L[pg.lang];
  await startEasy(pg);
  await click(pg, '#flagBtn');
  await answerNext(pg);
  await click(pg, '#flagBtn');
  await tapBack(pg);
  await click(pg, '#tileFlagged');
  log(await active(pg) === 'screenFlagged', id + '.6', `${pg.tag} Flagged tile → list`);
  await click(pg, '#flaggedStart');
  await answerNext(pg);
  const b = await backOf(pg);
  log(textBackOk(b, lb.flagged) && b.action === 'goBack', id + '.6', `${pg.tag} #6 quiz header "${lb.flagged}" (chevron icon, name ⊇ words)`, b);
  await checkLayout(pg, id + '.6', '#6 Flagged quiz');
  await tapBack(pg);
  const f = await focusInfo(pg);
  log(await active(pg) === 'screenFlagged' && f && f.id === 'flaggedStart', id + '.6', `${pg.tag} #6 back → Flagged list, focus on #flaggedStart`, f);
  await click(pg, '#flaggedStart');
  for (let k = 0; k < 5; k++) {
    await answer(pg);
    await click(pg, '#nextBtn');
    if (await active(pg) !== 'screenQuiz') break;
  }
  log(await active(pg) === 'screenResult', id + '.6r', `${pg.tag} #6 finishing the flagged practice shows the Result`);
  const rb = await backOf(pg, '#screenResult .back-btn');
  log(textBackOk(rb, lb.flagged), id + '.6r', `${pg.tag} #6 Result header "${lb.flagged}"`, rb);
  await checkLayout(pg, id + '.6r', '#6 Result');
  await tapBack(pg, 'screenResult');
  const f2 = await focusInfo(pg);
  log(await active(pg) === 'screenFlagged' && f2 && f2.id === 'flaggedStart', id + '.6r', `${pg.tag} #6 Result header back → Flagged list, focus #flaggedStart`, f2);
  await click(pg, '#screenFlagged .back-btn');
}

async function studyFact(pg, id) {
  const lb = L[pg.lang];
  await click(pg, '#modeStudy');
  await click(pg, '.study-tab[data-tab="chapters"]');
  await click(pg, '#screenStudy [data-action=studySetChapter][data-arg="3"]');
  const factId = await pg.evaluate(() => {
    const btns = [...document.querySelectorAll('#studyContent .fact-practise')].filter(b => questionGroups(STUDY.find(f => f.id === +b.dataset.arg).src).length >= 2);
    return +btns[2].dataset.arg;
  });
  await click(pg, `#studyContent .fact-practise[data-arg="${factId}"]`);
  await answerNext(pg);
  const b = await backOf(pg);
  log(textBackOk(b, lb.study), id + '.7', `${pg.tag} #7 quiz header "${lb.study}"`, b);
  await checkLayout(pg, id + '.7', '#7 Study-fact quiz');
  await tapBack(pg);
  const card = await pg.evaluate(fid => {
    const el = document.querySelector(`#studyContent .fact[data-fact-id="${fid}"]`);
    const r = el && el.getBoundingClientRect();
    return { scr: document.querySelector('.screen.active').id, side: isSideSession(), found: !!el, inView: !!r && r.bottom > 0 && r.top < window.innerHeight };
  }, factId);
  log(card.scr === 'screenStudy' && !card.side && card.inView, id + '.7', `${pg.tag} #7 back → Study, same card in view`, card);
  await checkLayout(pg, id + '.7', 'Study after back');
}

async function memo(pg, id) {
  const lb = L[pg.lang];
  if (await active(pg) !== 'screenStudy') await click(pg, '#modeStudy');
  await click(pg, '.study-tab[data-tab="memo"]');
  await click(pg, '#studyContent .memo-card');
  await memoLangOk(pg, id + '.8m', 'group opened');
  const before = await pg.evaluate(k => localStorage.getItem(k), MEMO_LS);
  await click(pg, '#screenMemo .memo-start');
  await answer(pg);
  // v2.2.0 regression: the answer box's note is in the UI language
  const note = await pg.evaluate(() => { const n = byId('ansNote'); return { has: !!n.textContent.trim(), lang: n.lang, text: n.innerText.slice(0, 300) }; });
  if (note.has) log(note.lang === (pg.lang === 'en' ? 'en' : 'zh-HK') && (pg.lang !== 'en' || !CJK.test(note.text.replace(/^[^\n]*?[:：]/, ''))), id + '.8m', `${pg.tag} memo test answer note in the UI language`, note);
  const i = await qInfo(pg);
  if (i.cur < i.total - 1) await click(pg, '#nextBtn');
  const b = await backOf(pg);
  log(textBackOk(b, lb.memo) && b.aria === null, id + '.8', `${pg.tag} #8 quiz header "${lb.memo}" (named by its words)`, b);
  await checkLayout(pg, id + '.8', '#8 memo test');
  await tapBack(pg);
  const after = await pg.evaluate(k => ({ scr: document.querySelector('.screen.active').id, step: memoView && memoView.step, rec: localStorage.getItem(k), side: isSideSession() }), MEMO_LS);
  log(after.scr === 'screenMemo' && after.step === 'look' && after.rec === before && !after.side, id + '.8', `${pg.tag} #8 back → group look view, nothing recorded`, after);
  const f = await focusInfo(pg);
  log(!!f && f.tag !== 'BODY', id + '.8', `${pg.tag} #8 focus is not lost on <body>`, f);
  await memoLangOk(pg, id + '.8m', 'look view after back');
  await click(pg, '#screenMemo .memo-back');
  await click(pg, '#screenStudy .back-btn');
}

async function similar(pg, id) {
  const lb = L[pg.lang];
  await startEasy(pg);
  const n = await walkToSimilar(pg);
  const orig = await pg.evaluate(() => { window.__orig = state.questions; return state.examNum; });
  await similarCta(pg);
  const b = await backOf(pg);
  log(textBackOk(b, lb.q(n + 1), lb.qName(n + 1)), id + '.9', `${pg.tag} #9 header "${lb.q(n + 1)}" named "${lb.qName(n + 1)}"`, b);
  await answerNext(pg);
  await checkLayout(pg, id + '.9', '#9 Similar quiz');
  await tapBack(pg);
  const a = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, same: state.questions === window.__orig, cur: state.current, side: isSideSession(), ex: state.examNum }));
  log(a.scr === 'screenQuiz' && a.same && a.cur === n && !a.side && a.ex === orig, id + '.9', `${pg.tag} #9 back → original session at Q${n + 1}`, a);
  log(homeBackOk(await backOf(pg), lb), id + '.9', `${pg.tag} #9 original session shows the home icon again`);
  await tapBack(pg);
}

async function planFact(pg, id) {
  const lb = L[pg.lang];
  await openPlanToday(pg);
  log(await active(pg) === 'screenPlanDay', id + '.11', `${pg.tag} plan → today's tasks`);
  const idx = await pg.evaluate(() => { const d = planDayAt(planLoad(), planTodayIso()); return { read: d.tasks.findIndex(t => t.type === PLAN_TASK.read), prac: d.tasks.findIndex(t => t.type === PLAN_TASK.practice) }; });
  await click(pg, `#planTaskList [data-action=planOpenTask][data-task="${idx.read}"]`);
  const rb = await backOf(pg, '#planRunBack');
  log(textBackOk(rb, lb.back, lb.today), id + '.pr', `${pg.tag} #planRunBack "${lb.back}" named "${lb.today}"`, rb);
  await click(pg, '#planRunBody [data-action=planStepFact][data-arg="1"]');
  const pos = await pg.evaluate(() => planRunView.pos);
  await click(pg, '#planRunBody [data-action=planPractiseFact]');
  const b = await backOf(pg);
  log(textBackOk(b, lb.back, lb.fact), id + '.11', `${pg.tag} #11 header "${lb.back}" named "${lb.fact}"`, b);
  await checkLayout(pg, id + '.11', '#11 plan fact quiz');
  await tapBack(pg);
  const a = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, pos: planRunView && planRunView.pos, f: document.activeElement && document.activeElement.dataset.action }));
  log(a.scr === 'screenPlanRun' && a.pos === pos && a.f === 'planPractiseFact', id + '.11', `${pg.tag} #11 back → same fact card, focus on ▶ Practise`, a);
  await checkLayout(pg, id + '.11', 'plan fact card after back');
  await click(pg, '#planRunBack');
  log(await active(pg) === 'screenPlanDay', id + '.pr', `${pg.tag} #planRunBack → the day`);
  await click(pg, `#planTaskList [data-action=planOpenTask][data-task="${idx.prac}"]`);
  const t = await backOf(pg);
  log(textBackOk(t, lb.back, lb.today), id + '.pt', `${pg.tag} plan practice task "${lb.back}" named "${lb.today}"`, t);
  const lab = await pg.$eval('#quizLabel', e => e.textContent.trim());
  log(lb.chapter.test(lab), id + '.pt', `${pg.tag} plan practice label "${lab}"`, lab);
  await checkLayout(pg, id + '.pt', 'plan practice task quiz', { oneLineLabel: true });
  await answer(pg);
  await checkLayout(pg, id + '.pt', 'plan practice task answered', { oneLineLabel: true });
  await tapBack(pg);
  const f = await focusInfo(pg);
  log(await active(pg) === 'screenPlanDay' && f && f.action === 'planOpenTask', id + '.pt', `${pg.tag} plan practice task back → day, focus on its task`, f);
  await click(pg, '#screenPlanDay .back-btn').catch(() => goHomeFromAnywhere(pg));
  await goHomeFromAnywhere(pg);
}

async function matrix() {
  for (const width of (process.env.WIDTHS ? process.env.WIDTHS.split(',').map(Number) : [320, 390, 1024, 1280])) for (const lang of ['en', 'zh-HK']) for (const font of ['small', 'large']) {
    const pg = await newPage({ width, height: width >= 1024 ? 800 : 740, lang, font });
    const id = `M-${width}-${lang}-${font}`;
    for (const f of [homeAndExam, flagged, studyFact, memo, similar, planFact]) {
      try { await f(pg, id); } catch (e) {
        log(false, id + '.' + f.name, `${pg.tag} threw: ${e.message.split('\n')[0]}`);
        await pg.screenshot({ path: path.join(SHOTS, `err-${id}-${f.name}.png`) }).catch(() => {});
        await goHomeFromAnywhere(pg).catch(() => {});
      }
    }
    log(pg.errs.length === 0 && pg.warns.length === 0, id, `${pg.tag} no page errors / missing-key or dead-action warnings`, { errs: pg.errs, warns: pg.warns });
    await pg.ctx.close();
  }
}

// ── S: scenarios ──
async function setLangUi(pg, lang) {
  await click(pg, '#settingsBtn');
  await click(pg, `#settingsPop [data-action=chooseLang][data-arg="${lang}"]`);
  if (await pg.$('#settingsPop.show')) await pg.keyboard.press('Escape');
  await sleep(150);
  pg.lang = lang;
}
async function langSwitch(width) {
  const pg = await newPage({ width, height: width >= 1024 ? 800 : 844, lang: 'en' });
  const id = `S-lang-${width}`;
  await click(pg, '#modeStudy');
  await click(pg, '#studyContent .fact-practise');
  await setLangUi(pg, 'zh-HK');
  let b = await backOf(pg);
  log(textBackOk(b, L['zh-HK'].study), id, `Study side session en → zh-HK redraws "${b.text}"`, b);
  await tapBack(pg);
  log(await active(pg) === 'screenStudy', id, 'after the switch back still → Study');
  // memo test zh-HK → en: header "Memory", back → look view rendered in English (v2.2.0)
  await click(pg, '.study-tab[data-tab="memo"]');
  await click(pg, '#studyContent .memo-card');
  await click(pg, '#screenMemo .memo-start');
  await setLangUi(pg, 'en');
  b = await backOf(pg);
  log(textBackOk(b, L.en.memo), id, `memo test zh-HK → en redraws "${b.text}"`, b);
  await tapBack(pg);
  log(await active(pg) === 'screenMemo' && await pg.evaluate(() => memoView.step) === 'look', id, 'after the switch back still → look view');
  await memoLangOk(pg, id, 'memo look after zh-HK → en mid-test');
  await click(pg, '#screenMemo .memo-back');
  await click(pg, '#screenStudy .back-btn');
  // Similar en → zh-HK
  await startEasy(pg);
  const n = await walkToSimilar(pg);
  await similarCta(pg);
  await setLangUi(pg, 'zh-HK');
  b = await backOf(pg);
  log(textBackOk(b, L['zh-HK'].q(n + 1), L['zh-HK'].qName(n + 1)), id, 'Similar en → zh-HK redraws words + aria-label + title', b);
  await tapBack(pg);
  const qi = await qInfo(pg);
  log(qi.cur === n && !qi.side, id, 'after the switch back still → original question', qi);
  await tapBack(pg);
  // Flagged Result zh-HK → en
  await click(pg, '#modePractice');
  await click(pg, '#diffGrid .diff-btn');
  await click(pg, '#flagBtn');
  await tapBack(pg);
  await click(pg, '#tileFlagged');
  await click(pg, '#flaggedStart');
  await answer(pg); await click(pg, '#nextBtn');
  log(await active(pg) === 'screenResult', id, 'one-question flagged practice → Result');
  await setLangUi(pg, 'en');
  b = await backOf(pg, '#screenResult .back-btn');
  log(textBackOk(b, L.en.flagged), id, `Result header redraws after zh-HK → en ("${b.text}")`, b);
  await tapBack(pg, 'screenResult');
  log(await active(pg) === 'screenFlagged', id, 'Result back after the switch → Flagged list');
  await click(pg, '#screenFlagged .back-btn');
  // plan fact en → zh-HK, then the run screen and a practice task zh-HK → en
  await openPlanToday(pg);
  await click(pg, '#planTaskList [data-action=planOpenTask]');
  await click(pg, '#planRunBody [data-action=planPractiseFact]');
  await setLangUi(pg, 'zh-HK');
  b = await backOf(pg);
  log(textBackOk(b, L['zh-HK'].back, L['zh-HK'].fact), id, `plan fact quiz en → zh-HK redraws "${b.text}" / ${b.aria}`, b);
  await tapBack(pg);
  log(await active(pg) === 'screenPlanRun', id, 'plan fact back after the switch → fact card');
  await setLangUi(pg, 'en');
  b = await backOf(pg, '#planRunBack');
  log(textBackOk(b, L.en.back, L.en.today), id, `#planRunBack zh-HK → en redraws "${b.text}" / ${b.aria}`, b);
  await click(pg, '#planRunBack');
  const prac = await pg.evaluate(() => planDayAt(planLoad(), planTodayIso()).tasks.findIndex(t => t.type === PLAN_TASK.practice));
  await click(pg, `#planTaskList [data-action=planOpenTask][data-task="${prac}"]`);
  await setLangUi(pg, 'zh-HK');
  b = await backOf(pg);
  log(textBackOk(b, L['zh-HK'].back, L['zh-HK'].today), id, `plan practice task en → zh-HK redraws "${b.text}" / ${b.aria}`, b);
  await checkLayout(pg, id, 'plan practice after switch', { oneLineLabel: true });
  await tapBack(pg);
  log(await active(pg) === 'screenPlanDay', id, 'plan practice back after the switch → the day');
  log(pg.errs.length === 0 && pg.warns.length === 0, id, 'no page errors / warnings', { errs: pg.errs, warns: pg.warns });
  await pg.ctx.close();
}

async function nestedAndEdges(width) {
  const id = `S-edge-${width}`;
  const h = width >= 1024 ? 800 : 844;
  let pg = await newPage({ width, height: h, lang: 'en' });
  await startEasy(pg);
  let flaggedN = 0;
  for (let k = 0; k < 30 && flaggedN < 2; k++) {
    const has = await pg.evaluate(() => similarKeys(state.questions[state.current]).length > 0);
    if (has) { await click(pg, '#flagBtn'); flaggedN++; }
    await answer(pg);
    await click(pg, '#nextBtn');
  }
  await tapBack(pg);
  await click(pg, '#tileFlagged');
  await click(pg, '#flaggedStart');
  await answer(pg);
  const origQs = await pg.evaluate(() => { window.__orig = state.questions; return state.current; });
  await similarCta(pg);
  let b = await backOf(pg);
  log(textBackOk(b, L.en.q(origQs + 1), L.en.qName(origQs + 1)), id + '.nest', `Similar inside Flagged reads "${b.text}"`, b);
  // E1: quick double tap on back only goes one level
  await pg.click('#screenQuiz .back-btn'); await pg.click('#screenQuiz .back-btn', { timeout: 1000 }).catch(() => {});
  await sleep(GUARD);
  let a = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, same: state.questions === window.__orig, cur: state.current }));
  log(a.scr === 'screenQuiz' && a.same && a.cur === origQs, id + '.E1', 'double tap on "Q1" goes back one level only (Flagged session, same question)', a);
  b = await backOf(pg);
  log(textBackOk(b, L.en.flagged), id + '.nest', 'Flagged session reads "Flagged" again', b);
  await tapBack(pg);
  log(await active(pg) === 'screenFlagged', id + '.nest', 'back twice → Flagged list');
  // E2: Retry on a flagged Result keeps "Flagged"
  await click(pg, '#flaggedStart');
  for (let k = 0; k < 5 && await active(pg) === 'screenQuiz'; k++) { await answer(pg); await click(pg, '#nextBtn'); }
  await click(pg, '#screenResult [data-action=retryExam]');
  b = await backOf(pg);
  log(await active(pg) === 'screenQuiz' && textBackOk(b, L.en.flagged), id + '.E2', 'Retry of a flagged practice keeps "Flagged"', b);
  await tapBack(pg);
  log(await active(pg) === 'screenFlagged', id + '.E2', 'Retry session back → Flagged list');
  // E3: unflag every question mid-session, then back
  await click(pg, '#flaggedStart');
  const total = (await qInfo(pg)).total;
  for (let k = 0; k < total; k++) { await click(pg, '#flagBtn'); if (k < total - 1) { await answer(pg); await click(pg, '#nextBtn'); } }
  await tapBack(pg);
  a = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id }));
  log(['screenFlagged', 'screenHome'].includes(a.scr) && pg.errs.length === 0, id + '.E3', `all unflagged mid-session, back → ${a.scr}, no error`, a);
  await goHomeFromAnywhere(pg);
  // E4: keyboard Enter on the focused back in a Study fact session
  await click(pg, '#modeStudy');
  await click(pg, '#studyContent .fact-practise');
  await pg.focus('#screenQuiz .back-btn');
  await pg.keyboard.press('Enter');
  await sleep(GUARD);
  log(await active(pg) === 'screenStudy', id + '.E4', 'keyboard Enter on "Study" → Study');
  // E5: memo test back with nothing answered
  await click(pg, '.study-tab[data-tab="memo"]');
  await click(pg, '#studyContent .memo-card');
  const before = await pg.evaluate(k => localStorage.getItem(k), MEMO_LS);
  await click(pg, '#screenMemo .memo-start');
  await tapBack(pg);
  a = await pg.evaluate(k => ({ scr: document.querySelector('.screen.active').id, step: memoView.step, rec: localStorage.getItem(k) }), MEMO_LS);
  log(a.scr === 'screenMemo' && a.step === 'look' && a.rec === before, id + '.E5', 'memo test back on Q1 unanswered → look view, nothing recorded', a);
  // E6: re-enter, finish: records once
  await click(pg, '#screenMemo .memo-start');
  const fresh = await qInfo(pg);
  log(fresh.cur === 0 && !fresh.revealed && fresh.side, id + '.E6', 're-entered memo test starts fresh at Q1', fresh);
  for (let k = 0; k < fresh.total; k++) { await answer(pg); await click(pg, '#nextBtn'); }
  a = await pg.evaluate(k => ({ scr: document.querySelector('.screen.active').id, step: memoView.step, rec: localStorage.getItem(k) }), MEMO_LS);
  log(a.scr === 'screenMemo' && a.rec !== before && a.step === 'result', id + '.E6', `finishing the memo test records (screen ${a.scr}, step ${a.step})`, a);
  // E10: memo result view in English (v2.2.0), its wrong answers' notes too
  const resLang = await pg.evaluate(() => ({ title: byId('memoTitle').lang, cjk: /[㐀-鿿]/.test(byId('memoTitle').textContent.replace(/^\S+\s/, '')) }));
  log(resLang.title === 'en' && !resLang.cjk, id + '.E10', 'memo result after a full test: title in English', resLang);
  await click(pg, '#screenMemo .memo-back');
  await click(pg, '#screenStudy .back-btn');
  // E7: Similar finished with ↩ Back
  await startEasy(pg);
  const n = await walkToSimilar(pg);
  await similarCta(pg);
  const st = await qInfo(pg);
  for (let k = 0; k < st.total; k++) { await answer(pg); await click(pg, '#nextBtn'); }
  a = await qInfo(pg);
  log(a.cur === n && !a.side, id + '.E7', 'Similar finished with ↩ Back → original question', a);
  // E8: viewport flip mid side session keeps the label
  await similarCta(pg);
  await pg.setViewportSize({ width: width >= 1024 ? 390 : 1280, height: 844 });
  await sleep(300);
  b = await backOf(pg);
  log(textBackOk(b, L.en.q(n + 1), L.en.qName(n + 1)), id + '.E8', `viewport flip mid-Similar keeps "${b.text}"`, b);
  await checkLayout(pg, id + '.E8', 'after the viewport flip');
  await pg.setViewportSize({ width, height: h });
  await tapBack(pg);
  await tapBack(pg);
  // E11: Similar inside a Study fact session → "Q{n}" → back → "Study" → Study
  await click(pg, '#modeStudy');
  const fid = await pg.evaluate(() => {
    const btn = [...document.querySelectorAll('#studyContent .fact-practise')].find(b => questionGroups(STUDY.find(f => f.id === +b.dataset.arg).src).some(g => similarKeys(questionByKey(g[0])).length > 0));
    return btn ? btn.dataset.arg : null;
  });
  if (fid) {
    await click(pg, `#studyContent .fact-practise[data-arg="${fid}"]`);
    let m = null;
    for (let k = 0; k < 10; k++) { await answer(pg); if (await pg.$('#similarBox .sqm-cta button')) { m = (await qInfo(pg)).cur; break; } const qi = await qInfo(pg); if (qi.cur >= qi.total - 1) break; await click(pg, '#nextBtn'); }
    if (m !== null) {
      await similarCta(pg);
      b = await backOf(pg);
      log(textBackOk(b, L.en.q(m + 1)), id + '.E11', `Similar inside Study fact reads "${b.text}"`, b);
      await tapBack(pg);
      b = await backOf(pg);
      log(await active(pg) === 'screenQuiz' && textBackOk(b, L.en.study), id + '.E11', 'back → Study fact session ("Study")', b);
      await tapBack(pg);
      log(await active(pg) === 'screenStudy', id + '.E11', 'back again → Study');
    } else log(true, id + '.E11', 'N/A: the Study fact found shows no similar CTA');
  } else log(true, id + '.E11', 'N/A: no Study fact with similar questions on the first tab');
  await goHomeFromAnywhere(pg);
  log(pg.errs.length === 0 && pg.warns.length === 0, id, 'no page errors / warnings', { errs: pg.errs, warns: pg.warns });
  await pg.ctx.close();
  // E9: last fact of a reading task
  pg = await newPage({ width, height: h, lang: 'en' });
  await openPlanToday(pg);
  await click(pg, '#planTaskList [data-action=planOpenTask]');
  for (let k = 0; k < 40; k++) { const nx = await pg.$('#planRunBody [data-action=planStepFact][data-arg="1"]:not([disabled])'); if (!nx) break; await click(pg, '#planRunBody [data-action=planStepFact][data-arg="1"]'); }
  const pos = await pg.evaluate(() => planRunView.pos);
  await click(pg, '#planRunBody [data-action=planPractiseFact]');
  b = await backOf(pg);
  await tapBack(pg);
  a = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, pos: planRunView && planRunView.pos }));
  log(textBackOk(b, L.en.back, L.en.fact) && a.scr === 'screenPlanRun' && a.pos === pos, id + '.E9', 'last fact of a reading task: ▶ Practise → back → that card', { b, a });
  // E12: plan practice task double tap on back → the day, once (no Home)
  await click(pg, '#planRunBack');
  const prac = await pg.evaluate(() => planDayAt(planLoad(), planTodayIso()).tasks.findIndex(t => t.type === PLAN_TASK.practice));
  await click(pg, `#planTaskList [data-action=planOpenTask][data-task="${prac}"]`);
  await pg.click('#screenQuiz .back-btn'); await pg.click('#screenQuiz .back-btn', { timeout: 1000 }).catch(() => {});
  await sleep(GUARD);
  log(await active(pg) === 'screenPlanDay', id + '.E12', `plan practice double tap on "Back" → the day (${await active(pg)})`);
  log(pg.errs.length === 0, id + '.E9', 'no page errors', pg.errs);
  await pg.ctx.close();
}

// ── D: "Back to Day n tasks": plan made on day 1, clock moved to day 2, Day 1's practice task (catch-up) ──
async function dayN() {
  for (const lang of ['en', 'zh-HK']) for (const [width, font] of [[320, 'large'], [1280, 'small']]) {
    const id = `D-${width}-${lang}-${font}`;
    const pg = await newPage({ width, height: 800, lang, font, clock: new Date('2026-10-13T09:00:00Z') });
    try {
      await openPlanToday(pg);
      await pg.clock.setSystemTime(new Date('2026-10-14T09:00:00Z'));
      await pg.reload(); await sleep(GUARD);
      // Home plan card → Schedule → today's day screen → ‹ one day back (Day 1)
      await click(pg, '#screenHome [data-action=openPlanSchedule]');
      await click(pg, '#screenPlanSchedule .plan-block[data-action=openPlanDay]');
      const t0 = await pg.$eval('#planDayTitle', e => e.textContent.trim());
      if (!/1\b/.test(t0)) await click(pg, '#screenPlanDay [data-action=planShiftDay][data-arg="-1"]');
      const title = await pg.$eval('#planDayTitle', e => e.textContent.trim());
      const prac = await pg.evaluate(() => { const iso = isoAddDays(planTodayIso(), -1); return planDayAt(planLoad(), iso).tasks.findIndex(t => t.type === PLAN_TASK.practice); });
      await click(pg, `#planTaskList [data-action=planOpenTask][data-task="${prac}"]`);
      const scr = await active(pg);
      if (scr !== 'screenQuiz') { log(false, id, `Day 1 practice did not open a quiz (${scr}; day title "${title}")`); }
      else {
        const b = await backOf(pg);
        log(textBackOk(b, L[lang].back, L[lang].day(1)), id, `Day 1 practice header "${b.text}" named "${b.aria}"`, b);
        await checkLayout(pg, id, 'Day 1 practice task', { oneLineLabel: true });
        await tapBack(pg);
        const t2 = await pg.$eval('#planDayTitle', e => e.textContent.trim());
        log(await active(pg) === 'screenPlanDay' && t2 === title, id, `back → the same day ("${t2}")`);
      }
    } catch (e) { log(false, id, 'threw: ' + e.message.split('\n')[0]); }
    log(pg.errs.length === 0 && pg.warns.length === 0, id, 'no page errors / warnings', { errs: pg.errs, warns: pg.warns });
    await pg.ctx.close();
  }
}

// ── W: the wrapped en "SIMILAR QUESTIONS" at 320 large sits against the badge ──
async function wrapped() {
  for (const lang of ['en', 'zh-HK']) {
    const pg = await newPage({ width: 320, height: 740, lang, font: 'large' });
    await startEasy(pg);
    await walkToSimilar(pg);
    await similarCta(pg);
    const l = await checkLayout(pg, `W-${lang}`, 'Similar header');
    if (lang === 'en') log(l.label && l.label.lines >= 2 && l.label.align === 'right' && l.label.endsRight && l.label.gap <= 16, 'W-en', `en "${l.label && l.label.text}" wraps, each line ends against the badge`, l.label);
    else log(l.label && l.label.lines === 1 && l.label.gap <= 16, 'W-zh-HK', 'zh-HK label one line by the badge', l.label);
    await pg.screenshot({ path: path.join(SHOTS, `similar-label-320-${lang}-large.png`) });
    log(pg.errs.length === 0, `W-${lang}`, 'no page errors', pg.errs);
    await pg.ctx.close();
  }
}

// ── U: cached-file mix ──
async function upgradeMix() {
  const files = process.env.U_FILES ? process.env.U_FILES.split(',') : ['js/screens/sideSession.js', 'js/core/actions.js', 'js/screens/planRun.js', 'js/screens/result.js', 'js/screens/memo.js', 'locales/en.js', 'locales/zh-HK.js'];
  for (const ref of (process.env.U_REFS ? process.env.U_REFS.split(',') : ['c6b0806', 'fb5cc7b'])) for (const file of files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa221-'));
    if (process.env.U_TREE) execFileSync('sh', ['-c', `git -C '${ROOT}' archive ${process.env.U_TREE} index.html js css data locales icons manifest.webmanifest sw.js | tar -x -C '${dir}'`]);
    else for (const d of ['index.html', 'js', 'css', 'data', 'locales', 'icons', 'manifest.webmanifest', 'sw.js']) execFileSync('cp', ['-r', path.join(ROOT, d), dir]);
    fs.writeFileSync(path.join(dir, file), execFileSync('git', ['-C', ROOT, 'show', `${ref}:${file}`]));
    const srv = await startPagesServer(dir);
    const lang = file.includes('zh-HK') ? 'zh-HK' : 'en';
    const id = `U-${ref}-${path.basename(file)}`;
    const nameOk = b => !RAW_KEY.test(b.text + ' ' + b.name) && (b.icon || b.name.toLowerCase().includes(b.text.toLowerCase())) && !GLYPH.test(b.text.replace(/^←\s*/, ''));
    try {
      const pg = await newPage({ width: 390, lang, url: srv.base + 'index.html' });
      const row = {};
      await startEasy(pg); await click(pg, '#flagBtn'); await answer(pg); await click(pg, '#nextBtn'); await click(pg, '#flagBtn');
      await tapBack(pg); await click(pg, '#tileFlagged'); await click(pg, '#flaggedStart');
      let b = await backOf(pg);
      log(nameOk(b), id, `Flagged header ok ("${b.text}" / ${b.name})`, b);
      await tapBack(pg); row.flagged = `${b.text || 'home'} → ${await active(pg)}`;
      log(['screenHome', 'screenFlagged'].includes(await active(pg)), id, `Flagged back leaves the quiz (${await active(pg)})`);
      await goHomeFromAnywhere(pg);
      await click(pg, '#modeStudy'); await click(pg, '#studyContent .fact-practise');
      b = await backOf(pg);
      log(nameOk(b), id, `Study-fact header ok ("${b.text}")`, b);
      await tapBack(pg); row.study = `${b.text || 'home'} → ${await active(pg)}`;
      log(['screenHome', 'screenStudy'].includes(await active(pg)), id, `Study-fact back leaves the quiz (${await active(pg)})`);
      if (await active(pg) !== 'screenStudy') await click(pg, '#modeStudy');
      await click(pg, '.study-tab[data-tab="memo"]'); await click(pg, '#studyContent .memo-card');
      const before = await pg.evaluate(k => localStorage.getItem(k), MEMO_LS);
      await click(pg, '#screenMemo .memo-start');
      b = await backOf(pg);
      log(nameOk(b), id, `memo test header ok ("${b.text}")`, b);
      await tapBack(pg);
      const m = await pg.evaluate(k => ({ scr: document.querySelector('.screen.active').id, rec: localStorage.getItem(k) }), MEMO_LS);
      row.memo = `${b.text || 'home'} → ${m.scr}`;
      log(['screenMemo', 'screenHome'].includes(m.scr) && m.rec === before, id, `memo back → ${m.scr}, nothing recorded`, m);
      await goHomeFromAnywhere(pg);
      await openPlanToday(pg);
      await click(pg, '#planTaskList [data-action=planOpenTask]');
      b = await backOf(pg, '#planRunBack');
      log(nameOk(b), id, `#planRunBack ok ("${b.text}" / ${b.name})`, b);
      await click(pg, '#planRunBody [data-action=planPractiseFact]');
      b = await backOf(pg);
      log(nameOk(b) && b.text.length + (b.icon ? 1 : 0) > 0, id, `plan fact header ok ("${b.text}" / ${b.name})`, b);
      await tapBack(pg); row.fact = `${b.text || 'home'} → ${await active(pg)}`;
      log(['screenPlanRun', 'screenPlanDay'].includes(await active(pg)), id, `plan fact back → ${await active(pg)}`);
      log(pg.errs.length === 0 && !pg.warns.some(w => /no handler/.test(w)), id, 'no page errors / dead actions', { errs: pg.errs, warns: pg.warns });
      console.log('     row ' + id + ' ' + JSON.stringify(row));
      await pg.ctx.close();
    } catch (e) {
      log(false, id, 'threw: ' + e.message.split('\n')[0]);
    } finally { srv.server.kill(); fs.rmSync(dir, { recursive: true, force: true }); }
  }
}

async function shots() {
  for (const [w, lang, font] of [[320, 'en', 'large'], [390, 'zh-HK', 'small'], [1280, 'en', 'small']]) {
    const pg = await newPage({ width: w, height: 760, lang, font });
    await click(pg, '#modeStudy'); await click(pg, '#studyContent .fact-practise');
    await pg.screenshot({ path: path.join(SHOTS, `study-fact-${w}-${lang}-${font}.png`) });
    await tapBack(pg);
    await click(pg, '.study-tab[data-tab="memo"]'); await click(pg, '#studyContent .memo-card'); await click(pg, '#screenMemo .memo-start');
    await pg.screenshot({ path: path.join(SHOTS, `memo-test-${w}-${lang}-${font}.png`) });
    await tapBack(pg);
    await pg.screenshot({ path: path.join(SHOTS, `memo-look-after-back-${w}-${lang}-${font}.png`) });
    await goHomeFromAnywhere(pg);
    await openPlanToday(pg);
    const prac = await pg.evaluate(() => planDayAt(planLoad(), planTodayIso()).tasks.findIndex(t => t.type === PLAN_TASK.practice));
    await click(pg, `#planTaskList [data-action=planOpenTask][data-task="${prac}"]`);
    await pg.screenshot({ path: path.join(SHOTS, `plan-practice-${w}-${lang}-${font}.png`) });
    await pg.ctx.close();
  }
}

(async () => {
  ({ base, server } = await startPagesServer(ROOT));
  browser = await chromium.launch(launchOpts);
  const only = process.argv[2];
  try {
    if (!only || only === 'M') await matrix();
    if (!only || only === 'S') for (const w of [390, 1280]) { await langSwitch(w); await nestedAndEdges(w); }
    if (!only || only === 'D') await dayN();
    if (!only || only === 'W') await wrapped();
    if (!only || only === 'U') await upgradeMix();
    if (!only || only === 'SH') await shots();
  } catch (e) { log(false, 'RUN', 'threw: ' + e.stack); }
  await browser.close(); server.kill();
  const fail = res.filter(r => !r.ok).length;
  console.log(`\n${res.length - fail}/${res.length} passed`);
  if (findings.length) console.log('FINDINGS:\n' + findings.join('\n'));
  process.exit(fail ? 1 : 0);
})();
