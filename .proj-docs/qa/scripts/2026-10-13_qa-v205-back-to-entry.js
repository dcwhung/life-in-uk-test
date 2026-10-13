// QA v2.0.5 back-to-entry (branch fix/quiz/back-to-entry @ 48307d5). Real clicks only for navigation (state is read to
// know which option is right / which task is which, never to navigate). Repo served over http (tests/pages-server.js).
//   M  matrix: 320 / 390 / 1024 / 1280 × en / zh-HK × small / large = 16 fresh contexts; in each:
//      Home entry (🏠 → Home), exam (🏠 → confirm), #6 Flagged (quiz + Result header), #7 Study fact, #8 memo ② test,
//      #9 Similar, #11 plan fact + plan practice task; per step: label, aria, landing screen, focus, no sideways scroll,
//      header fits, back button inside the viewport, no raw i18n key, no page errors / missing-key warnings
//   S  scenarios at 390 + 1280: language switch (⚙) inside each side session, nested Similar in Flagged (back twice),
//      edge cases E1–E9 (see report)
//   ‹  ‹ › arrows of 48307d5 (quiz Prev / Next, quick ‹ ›, plan fact Prev / Next, calendar chip) in both languages
//   U  cached-file mix: current shell + one v2.0.2 file (sideSession / actions / planRun / result / en / zh-HK locale)
//   NODE_PATH=... CHROMIUM_PATH=... node 2026-10-13_qa-v205-back-to-entry.js
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '../../..');
const { startPagesServer } = require(path.join(ROOT, 'tests/pages-server.js'));
const SHOTS = path.join(__dirname, '../screenshots/v205');
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
const L = {
  en: { flagged: '‹ Flagged', study: '‹ Study', memo: '‹ ① Look', q: n => `‹ Q${n}`, qName: n => `Back to Q${n}`, fact: '‹ Back to the fact', today: "‹ Today's tasks", home: 'Home',
    prev: '‹ Prev', next: 'Next ›', prevFact: '‹ Prev', nextFact: 'Next ›' },
  'zh-HK': { flagged: '‹ 已標記', study: '‹ 溫習', memo: '‹ ① 睇', q: n => `‹ 第 ${n} 題`, qName: n => `返回第 ${n} 題`, fact: '‹ 返回知識點', today: '‹ 今日任務', home: '主頁',
    prev: '‹ 上一題', next: '下一題 ›', prevFact: '‹ 上一條', nextFact: '下一條 ›' },
};

let base, server, browser;

async function newPage({ width = 390, height = 844, lang = 'en', font = 'small', url } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, timezoneId: 'Europe/London', serviceWorkers: 'block' });
  const pg = await ctx.newPage();
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
const backOf = (pg, screen = 'screenQuiz') => pg.$eval(`#${screen} .back-btn`, e => ({
  text: e.textContent.trim(), icon: e.classList.contains('icon-btn'), name: e.getAttribute('aria-label'), title: e.getAttribute('title'), action: e.dataset.action,
}));
// desktop (≥ 1024) hides the bottom Prev / Next row: the card's quick › runs the same nextAction
async function click(pg, sel) {
  if (sel === '#nextBtn' && !(await pg.$('#nextBtn:visible'))) sel = '#quickNext';
  const el = await pg.$(sel + ':visible') || await pg.$(sel);
  if (!el) throw new Error('no element ' + sel + ' on ' + await active(pg));
  await el.scrollIntoViewIfNeeded();
  await el.click();
  await sleep(GUARD);
}
const tapBack = (pg, screen = 'screenQuiz') => click(pg, `#${screen} .back-btn`);
// the page fits, the active header fits, its back button is fully on screen, no raw key in it
async function layout(pg) {
  return pg.evaluate(raw => {
    const scr = document.querySelector('.screen.active');
    const h = scr.querySelector('.quiz-header');
    const b = scr.querySelector('.back-btn');
    const r = b ? b.getBoundingClientRect() : null;
    const re = new RegExp(raw);
    return {
      page: document.documentElement.scrollWidth <= window.innerWidth,
      sw: document.documentElement.scrollWidth, vw: window.innerWidth,
      header: !h || h.scrollWidth <= h.clientWidth + 1,
      btn: !r || (r.left >= 0 && r.right <= window.innerWidth + 0.5 && r.width > 0),
      btnText: !b || b.classList.contains('icon-btn') || b.scrollWidth <= b.clientWidth + 1,
      hdr: h ? [...h.children].map(c => c.className + ':' + Math.round(c.getBoundingClientRect().width)).join(',') + ' sw' + h.scrollWidth + '/cw' + h.clientWidth : '',
      raw: !!(h && re.test(h.textContent)),
    };
  }, RAW_KEY.source);
}
async function checkLayout(pg, id, what) {
  const l = await layout(pg);
  log(l.page && l.header && l.btn && l.btnText && !l.raw, id, `${pg.tag} ${what}: fits (page / header / back button), no raw key`, l);
}
// pick the right (or a wrong) option(s) by clicking them; practice reveals itself
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
  for (let i = 0; i < 4 && await active(pg) !== 'screenHome'; i++) {
    const s = await active(pg);
    const sel = s === 'screenPlanRun' ? '#planRunBack' : `#${s} .back-btn`;
    const b = await backOf(pg, s).catch(() => null);
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

// ── M: one context, every entry, by clicks ──
async function homeAndExam(pg, id) {
  const lb = L[pg.lang];
  await startEasy(pg);
  await answerNext(pg);
  let b = await backOf(pg);
  log(b.icon && b.name === lb.home && ['goHome', 'goBack'].includes(b.action), id + '.home', `${pg.tag} Home entry keeps 🏠 (${b.name})`, b);
  await checkLayout(pg, id + '.home', 'Home-entry quiz');
  await tapBack(pg);
  log(await active(pg) === 'screenHome', id + '.home', `${pg.tag} Home entry back → Home`);
  await click(pg, '#modeExam');
  await click(pg, '#examGrid .exam-btn:not(.all)');
  b = await backOf(pg);
  log(b.icon && b.name === lb.home, id + '.exam', `${pg.tag} exam keeps 🏠`, b);
  await tapBack(pg);
  const r = await pg.evaluate(() => ({ modal: byId('confirmModal').classList.contains('show'), scr: document.querySelector('.screen.active').id }));
  log(r.modal && r.scr === 'screenQuiz', id + '.exam', `${pg.tag} exam back asks to confirm`, r);
  await click(pg, '#confirmModal [data-action=confirmAccept]');
  log(await active(pg) === 'screenHome', id + '.exam', `${pg.tag} exam confirm → Home`);
  await click(pg, '#modePractice');
}

async function flagged(pg, id) {
  const lb = L[pg.lang];
  await startEasy(pg);
  await click(pg, '#flagBtn');
  await answerNext(pg);
  await click(pg, '#flagBtn');
  await tapBack(pg); // 🏠 → Home
  await click(pg, '#tileFlagged');
  log(await active(pg) === 'screenFlagged', id + '.6', `${pg.tag} Flagged tile → list`);
  await click(pg, '#flaggedStart');
  await answerNext(pg);
  const b = await backOf(pg);
  log(b.text === lb.flagged && !b.icon && b.action === 'goBack', id + '.6', `${pg.tag} #6 quiz header "${lb.flagged}"`, b);
  await checkLayout(pg, id + '.6', '#6 Flagged quiz');
  await tapBack(pg);
  const f = await focusInfo(pg);
  log(await active(pg) === 'screenFlagged' && f && f.id === 'flaggedStart', id + '.6', `${pg.tag} #6 back → Flagged list, focus on Practise`, f);
  // whole session → Result, header back → list
  await click(pg, '#flaggedStart');
  for (let k = 0; k < 5; k++) {
    await answer(pg);
    await click(pg, '#nextBtn');
    if (await active(pg) !== 'screenQuiz') break;
  }
  log(await active(pg) === 'screenResult', id + '.6r', `${pg.tag} #6 finishing the flagged practice shows the Result`);
  const rb = await backOf(pg, 'screenResult');
  log(rb.text === lb.flagged && !rb.icon, id + '.6r', `${pg.tag} #6 Result header "${lb.flagged}"`, rb);
  await checkLayout(pg, id + '.6r', '#6 Result');
  await tapBack(pg, 'screenResult');
  log(await active(pg) === 'screenFlagged', id + '.6r', `${pg.tag} #6 Result header back → Flagged list`);
  await click(pg, '#screenFlagged .back-btn');
}

async function studyFact(pg, id) {
  const lb = L[pg.lang];
  await click(pg, '#modeStudy');
  await click(pg, '.study-tab[data-tab="chapters"]');
  await click(pg, '#screenStudy [data-action=studySetChapter][data-arg="3"]');
  // the 3rd card with ≥ 2 questions, so the page is scrolled a bit
  const factId = await pg.evaluate(() => {
    const btns = [...document.querySelectorAll('#studyContent .fact-practise')].filter(b => questionGroups(STUDY.find(f => f.id === +b.dataset.arg).src).length >= 2);
    return +btns[2].dataset.arg;
  });
  await click(pg, `#studyContent .fact-practise[data-arg="${factId}"]`);
  await answerNext(pg);
  const b = await backOf(pg);
  log(b.text === lb.study && !b.icon, id + '.7', `${pg.tag} #7 quiz header "${lb.study}"`, b);
  await checkLayout(pg, id + '.7', '#7 Study-fact quiz');
  await tapBack(pg);
  const card = await pg.evaluate(fid => {
    const el = document.querySelector(`#studyContent .fact[data-fact-id="${fid}"]`);
    const r = el && el.getBoundingClientRect();
    return { scr: document.querySelector('.screen.active').id, side: isSideSession(), found: !!el, inView: !!r && r.bottom > 0 && r.top < window.innerHeight, flash: !!el && el.classList.contains('flash') };
  }, factId);
  log(card.scr === 'screenStudy' && !card.side && card.inView, id + '.7', `${pg.tag} #7 back → Study, same card in view`, card);
  await checkLayout(pg, id + '.7', 'Study after back');
}

async function memo(pg, id) {
  const lb = L[pg.lang];
  if (await active(pg) !== 'screenStudy') await click(pg, '#modeStudy');
  await click(pg, '.study-tab[data-tab="memo"]');
  await click(pg, '#studyContent .memo-card');
  const before = await pg.evaluate(k => localStorage.getItem(k), MEMO_LS);
  await click(pg, '#screenMemo .memo-start');
  await answerNext(pg);
  const b = await backOf(pg);
  log(b.text === lb.memo && !b.icon, id + '.8', `${pg.tag} #8 quiz header "${lb.memo}"`, b);
  await checkLayout(pg, id + '.8', '#8 memo test');
  await tapBack(pg);
  const after = await pg.evaluate(k => ({ scr: document.querySelector('.screen.active').id, step: memoView && memoView.step, rec: localStorage.getItem(k), side: isSideSession() }), MEMO_LS);
  log(after.scr === 'screenMemo' && after.step === 'look' && after.rec === before && !after.side, id + '.8', `${pg.tag} #8 back → ① look, nothing recorded`, after);
  const f = await focusInfo(pg);
  log(!!f && f.tag !== 'BODY', id + '.8', `${pg.tag} #8 focus is not lost on <body>`, f);
  await click(pg, '#screenMemo .memo-back');
  await click(pg, '#screenStudy .back-btn');
}

async function similar(pg, id) {
  const lb = L[pg.lang];
  await startEasy(pg);
  // walk to a question with similar questions: answer, next
  let n;
  for (let k = 0; k < 20; k++) {
    await answer(pg);
    if (await pg.$('#similarBox .sqm-cta button')) { n = (await qInfo(pg)).cur; break; }
    await click(pg, '#nextBtn');
  }
  const orig = await pg.evaluate(() => { window.__orig = state.questions; return state.examNum; });
  await similarCta(pg);
  const b = await backOf(pg);
  log(b.text === lb.q(n + 1) && b.name === lb.qName(n + 1) && b.title === b.name && !b.icon, id + '.9', `${pg.tag} #9 header "${lb.q(n + 1)}" named "${lb.qName(n + 1)}"`, b);
  await answerNext(pg);
  await checkLayout(pg, id + '.9', '#9 Similar quiz');
  await tapBack(pg);
  const a = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, same: state.questions === window.__orig, cur: state.current, side: isSideSession(), ex: state.examNum }));
  log(a.scr === 'screenQuiz' && a.same && a.cur === n && !a.side && a.ex === orig, id + '.9', `${pg.tag} #9 back → original session at Q${n + 1}`, a);
  log((await backOf(pg)).icon, id + '.9', `${pg.tag} #9 original session shows 🏠 again`);
  await tapBack(pg);
}

async function planFact(pg, id) {
  const lb = L[pg.lang];
  await click(pg, '.plan-cta');
  await click(pg, '#planCreateBtn');
  await click(pg, '#screenPlanSchedule .plan-block[data-action=openPlanDay]');
  log(await active(pg) === 'screenPlanDay', id + '.11', `${pg.tag} plan → today's tasks`);
  const idx = await pg.evaluate(() => { const d = planDayAt(planLoad(), planTodayIso()); return { read: d.tasks.findIndex(t => t.type === PLAN_TASK.read), prac: d.tasks.findIndex(t => t.type === PLAN_TASK.practice) }; });
  await click(pg, `#planTaskList [data-action=planOpenTask][data-task="${idx.read}"]`);
  await click(pg, '#planRunBody [data-action=planStepFact][data-arg="1"]');
  const pos = await pg.evaluate(() => planRunView.pos);
  await click(pg, '#planRunBody [data-action=planPractiseFact]');
  const b = await backOf(pg);
  log(b.text === lb.fact, id + '.11', `${pg.tag} #11 header "${lb.fact}"`, b);
  await checkLayout(pg, id + '.11', '#11 plan fact quiz');
  await tapBack(pg);
  const a = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, pos: planRunView && planRunView.pos, f: document.activeElement && document.activeElement.dataset.action }));
  log(a.scr === 'screenPlanRun' && a.pos === pos && a.f === 'planPractiseFact', id + '.11', `${pg.tag} #11 back → same fact card, focus on ▶ Practise`, a);
  await checkLayout(pg, id + '.11', 'plan fact card after back');
  await click(pg, '#planRunBack');
  await click(pg, `#planTaskList [data-action=planOpenTask][data-task="${idx.prac}"]`);
  const t = await backOf(pg);
  log(t.text === lb.today, id + '.pt', `${pg.tag} plan practice task "${lb.today}"`, t);
  await checkLayout(pg, id + '.pt', 'plan practice task quiz');
  await tapBack(pg);
  log(await active(pg) === 'screenPlanDay', id + '.pt', `${pg.tag} plan practice task back → day`);
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
  pg.lang = lang;
}
async function langSwitch(width) {
  const pg = await newPage({ width, height: width >= 1024 ? 800 : 844, lang: 'en' });
  const id = `S-lang-${width}`;
  // Study fact
  await click(pg, '#modeStudy');
  await click(pg, '#studyContent .fact-practise');
  await setLangUi(pg, 'zh-HK');
  let b = await backOf(pg);
  log(b.text === L['zh-HK'].study, id, `in a Study side session en → zh-HK redraws "${b.text}"`, b);
  await tapBack(pg);
  log(await active(pg) === 'screenStudy', id, 'after the switch back still → Study');
  // memo
  await click(pg, '.study-tab[data-tab="memo"]');
  await click(pg, '#studyContent .memo-card');
  await click(pg, '#screenMemo .memo-start');
  await setLangUi(pg, 'en');
  b = await backOf(pg);
  log(b.text === L.en.memo, id, `in a memo test zh-HK → en redraws "${b.text}"`, b);
  await tapBack(pg);
  log(await active(pg) === 'screenMemo' && await pg.evaluate(() => memoView.step) === 'look', id, 'after the switch back still → ① look');
  await click(pg, '#screenMemo .memo-back');
  await click(pg, '#screenStudy .back-btn');
  // Similar
  await startEasy(pg);
  let n;
  for (let k = 0; k < 20; k++) { await answer(pg); if (await pg.$('#similarBox .sqm-cta button')) { n = (await qInfo(pg)).cur; break; } await click(pg, '#nextBtn'); }
  await similarCta(pg);
  await setLangUi(pg, 'zh-HK');
  b = await backOf(pg);
  log(b.text === L['zh-HK'].q(n + 1) && b.name === L['zh-HK'].qName(n + 1) && b.title === b.name, id, 'in Similar en → zh-HK redraws text + aria + title', b);
  await tapBack(pg);
  log((await qInfo(pg)).cur === n && !(await qInfo(pg)).side, id, 'after the switch back still → original question');
  await tapBack(pg);
  // Flagged list language switch while on the Result
  await click(pg, '#modePractice');
  await click(pg, '#diffGrid .diff-btn');
  await click(pg, '#flagBtn');
  await tapBack(pg);
  await click(pg, '#tileFlagged');
  await click(pg, '#flaggedStart');
  await answer(pg); await click(pg, '#nextBtn');
  log(await active(pg) === 'screenResult', id, 'one-question flagged practice → Result');
  await setLangUi(pg, 'en');
  b = await backOf(pg, 'screenResult');
  log(b.text === L.en.flagged, id, `Result header redraws after zh-HK → en ("${b.text}")`, b);
  // plan fact
  await tapBack(pg, 'screenResult');
  await click(pg, '#screenFlagged .back-btn');
  await click(pg, '.plan-cta'); await click(pg, '#planCreateBtn'); await click(pg, '#screenPlanSchedule .plan-block[data-action=openPlanDay]');
  await click(pg, '#planTaskList [data-action=planOpenTask]');
  await click(pg, '#planRunBody [data-action=planPractiseFact]');
  await setLangUi(pg, 'zh-HK');
  b = await backOf(pg);
  log(b.text === L['zh-HK'].fact, id, `plan fact quiz en → zh-HK redraws "${b.text}"`, b);
  log(pg.errs.length === 0 && pg.warns.length === 0, id, 'no page errors / warnings', { errs: pg.errs, warns: pg.warns });
  await pg.ctx.close();
}

async function nestedAndEdges(width) {
  const id = `S-edge-${width}`;
  const h = width >= 1024 ? 800 : 844;
  let pg = await newPage({ width, height: h, lang: 'en' });
  // flag the first two questions that have similar questions, by clicks
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
  log(b.text === L.en.q(origQs + 1), id + '.nest', `Similar inside Flagged reads "${b.text}"`, b);
  // E1: a quick double tap on back (inside the click guard) only goes one level
  await pg.click('#screenQuiz .back-btn'); await pg.click('#screenQuiz .back-btn', { timeout: 1000 }).catch(() => {});
  await sleep(GUARD);
  let a = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, same: state.questions === window.__orig }));
  log(a.scr === 'screenQuiz' && a.same, id + '.E1', 'double tap on "‹ Q1" goes back one level only (Flagged session, not the list)', a);
  b = await backOf(pg);
  log(b.text === L.en.flagged, id + '.nest', 'Flagged session reads "‹ Flagged" again', b);
  await tapBack(pg);
  log(await active(pg) === 'screenFlagged', id + '.nest', 'back twice → Flagged list');
  // E2: Retry on a flagged Result keeps "‹ Flagged" mid-session
  await click(pg, '#flaggedStart');
  for (let k = 0; k < 5 && await active(pg) === 'screenQuiz'; k++) { await answer(pg); await click(pg, '#nextBtn'); }
  await click(pg, '#screenResult [data-action=retryExam]');
  b = await backOf(pg);
  log(await active(pg) === 'screenQuiz' && b.text === L.en.flagged, id + '.E2', 'Retry of a flagged practice keeps "‹ Flagged"', b);
  await tapBack(pg);
  log(await active(pg) === 'screenFlagged', id + '.E2', 'Retry session back → Flagged list');
  // E3: unflag every question mid-session, then back: empty list, no error, focus not thrown
  await click(pg, '#flaggedStart');
  const total = (await qInfo(pg)).total;
  for (let k = 0; k < total; k++) { await click(pg, '#flagBtn'); if (k < total - 1) { await answer(pg); await click(pg, '#nextBtn'); } }
  await tapBack(pg);
  a = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, list: document.querySelectorAll('#flaggedList button').length, f: document.activeElement && document.activeElement.tagName }));
  log(['screenFlagged', 'screenHome'].includes(a.scr) && pg.errs.length === 0, id + '.E3', `all unflagged mid-session, back → ${a.scr}, no error`, a);
  await goHomeFromAnywhere(pg);
  // E4: keyboard — Enter on the focused back button in a Study fact session
  await click(pg, '#modeStudy');
  await click(pg, '#studyContent .fact-practise');
  await pg.focus('#screenQuiz .back-btn');
  await pg.keyboard.press('Enter');
  await sleep(GUARD);
  log(await active(pg) === 'screenStudy', id + '.E4', 'keyboard Enter on "‹ Study" → Study');
  // E5: back with nothing answered (Q1, unrevealed) in a memo test — nothing recorded
  await click(pg, '.study-tab[data-tab="memo"]');
  await click(pg, '#studyContent .memo-card');
  const before = await pg.evaluate(k => localStorage.getItem(k), MEMO_LS);
  await click(pg, '#screenMemo .memo-start');
  await tapBack(pg);
  a = await pg.evaluate(k => ({ scr: document.querySelector('.screen.active').id, step: memoView.step, rec: localStorage.getItem(k) }), MEMO_LS);
  log(a.scr === 'screenMemo' && a.step === 'look' && a.rec === before, id + '.E5', 'memo test back on Q1 unanswered → ① look, nothing recorded', a);
  // E6: re-enter ② test after leaving: a fresh test from Q1, finishing records once (↩ Back path still scores)
  await click(pg, '#screenMemo .memo-start');
  const fresh = await qInfo(pg);
  log(fresh.cur === 0 && !fresh.revealed && fresh.side, id + '.E6', 're-entered memo test starts fresh at Q1', fresh);
  for (let k = 0; k < fresh.total; k++) { await answer(pg); await click(pg, '#nextBtn'); }
  a = await pg.evaluate(k => ({ scr: document.querySelector('.screen.active').id, step: memoView.step, rec: localStorage.getItem(k) }), MEMO_LS);
  log(a.scr === 'screenMemo' && a.rec !== before, id + '.E6', `finishing the memo test still records (screen ${a.scr}, step ${a.step})`, a);
  await click(pg, '#screenMemo .memo-back');
  await click(pg, '#screenStudy .back-btn');
  // E7: Similar: answer to the last question → ↩ Back still returns; then 🏠 → Home
  await startEasy(pg);
  let n;
  for (let k = 0; k < 20; k++) { await answer(pg); if (await pg.$('#similarBox .sqm-cta button')) { n = (await qInfo(pg)).cur; break; } await click(pg, '#nextBtn'); }
  await similarCta(pg);
  const st = await qInfo(pg);
  for (let k = 0; k < st.total; k++) { await answer(pg); await click(pg, '#nextBtn'); }
  a = await qInfo(pg);
  log(a.cur === n && !a.side, id + '.E7', 'Similar finished with ↩ Back → original question', a);
  // E8: resize phone ↔ desktop mid side session keeps the label
  await similarCta(pg);
  await pg.setViewportSize({ width: width >= 1024 ? 390 : 1280, height: 844 });
  await sleep(300);
  b = await backOf(pg);
  log(b.text === L.en.q(n + 1), id + '.E8', `viewport flip mid-Similar keeps "${b.text}"`, b);
  await checkLayout(pg, id + '.E8', 'after the viewport flip');
  await pg.setViewportSize({ width, height: h });
  await tapBack(pg);
  await tapBack(pg);
  log(pg.errs.length === 0 && pg.warns.length === 0, id, 'no page errors / warnings', { errs: pg.errs, warns: pg.warns });
  await pg.ctx.close();
  // E9: plan fact practise when the reading task is already done → back to the card (review) without error
  pg = await newPage({ width, height: h, lang: 'en' });
  await click(pg, '.plan-cta'); await click(pg, '#planCreateBtn'); await click(pg, '#screenPlanSchedule .plan-block[data-action=openPlanDay]');
  await click(pg, '#planTaskList [data-action=planOpenTask]');
  for (let k = 0; k < 40; k++) { const nx = await pg.$('#planRunBody [data-action=planStepFact][data-arg="1"]'); if (!nx) break; await click(pg, '#planRunBody [data-action=planStepFact][data-arg="1"]'); }
  await pg.screenshot({ path: path.join(SHOTS, `plan-last-fact-${width}.png`) });
  await click(pg, '#planRunBody [data-action=planPractiseFact]');
  b = await backOf(pg);
  await tapBack(pg);
  a = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, f: document.activeElement && document.activeElement.dataset.action }));
  log(b.text === L.en.fact && a.scr === 'screenPlanRun', id + '.E9', 'last fact of a reading task: ▶ Practise → back → that card', { b, a });
  log(pg.errs.length === 0, id + '.E9', 'no page errors', pg.errs);
  await pg.ctx.close();
}

// ── ‹ › arrows (48307d5) ──
async function arrows() {
  for (const lang of ['en', 'zh-HK']) for (const width of [320, 1280]) {
    const pg = await newPage({ width, height: 800, lang, font: 'large' });
    const lb = L[lang];
    await startEasy(pg);
    await answer(pg);
    await click(pg, '#nextBtn');
    const q = await pg.evaluate(() => ({ prev: byId('prevBtn').textContent.trim(), next: byId('nextBtn').textContent.trim(), qp: byId('quickPrev').textContent.trim(), qn: byId('quickNext').textContent.trim() }));
    log(q.prev === lb.prev && q.next === lb.next, `A-${lang}-${width}`, `quiz Prev / Next read "${q.prev}" / "${q.next}"`, q);
    await answer(pg);
    const q2 = await pg.evaluate(() => ({ qp: byId('quickPrev').textContent.trim(), qn: byId('quickNext').textContent.trim() }));
    log(q2.qp === '‹' && q2.qn === '›', `A-${lang}-${width}`, 'quick ‹ › buttons', q2);
    await checkLayout(pg, `A-${lang}-${width}`, 'quiz with ‹ › arrows');
    await tapBack(pg);
    await click(pg, '.plan-cta'); await click(pg, '#planCreateBtn'); await click(pg, '#screenPlanSchedule .plan-block[data-action=openPlanDay]');
    await click(pg, '#planTaskList [data-action=planOpenTask]');
    const stepText = arg => pg.evaluate(a => { const e = document.querySelector(`#planRunBody [data-action=planStepFact][data-arg="${a}"]`); return e && e.textContent.trim(); }, arg);
    const nx = await stepText('1');
    await click(pg, '#planRunBody [data-action=planStepFact][data-arg="1"]');
    const p = [await stepText('-1'), nx];
    log(p[0] === lb.prevFact && p[1] === lb.nextFact, `A-${lang}-${width}`, `plan fact Prev / Next "${p.join(' / ')}"`, p);
    const fwd = await pg.evaluate(() => [...document.querySelectorAll('.nav-btn, .plan-cta-go')].map(e => e.textContent.trim()).filter(t => /→/.test(t)));
    log(true, `A-${lang}-${width}`, `forward CTAs keep → (seen: ${JSON.stringify(fwd.slice(0, 3))})`);
    // calendar chip: the day screen off today
    await click(pg, '#planRunBack');
    await click(pg, '#screenPlanDay [data-action=planShiftDay][data-arg="1"]');
    const chip = await pg.evaluate(() => { const e = document.querySelector('#screenPlanDay [data-action=planShowToday]'); return e && e.getClientRects().length ? e.textContent.trim() : null; });
    log(chip === null || chip.startsWith('‹'), `A-${lang}-${width}`, `calendar chip "${chip}"`, chip);
    await checkLayout(pg, `A-${lang}-${width}`, 'plan day off today');
    log(pg.errs.length === 0, `A-${lang}-${width}`, 'no page errors', pg.errs);
    await pg.ctx.close();
  }
}

// ── U: cached-file mix, each v2.0.2 file alone in the current tree (served over http) ──
const V202_REF = 'c6b0806';
async function upgradeMix() {
  const files = ['js/screens/sideSession.js', 'js/core/actions.js', 'js/screens/planRun.js', 'js/screens/result.js', 'locales/en.js', 'locales/zh-HK.js'];
  for (const file of files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa205-'));
    for (const d of ['index.html', 'js', 'css', 'data', 'locales', 'icons', 'manifest.webmanifest', 'sw.js']) execFileSync('cp', ['-r', path.join(ROOT, d), dir]);
    fs.writeFileSync(path.join(dir, file), execFileSync('git', ['-C', ROOT, 'show', `${V202_REF}:${file}`]));
    const srv = await startPagesServer(dir);
    const lang = file.includes('zh-HK') ? 'zh-HK' : 'en';
    const id = `U-${path.basename(file)}`;
    try {
      const pg = await newPage({ width: 390, lang, url: srv.base + 'index.html' });
      // Flagged via clicks
      await startEasy(pg); await click(pg, '#flagBtn'); await answer(pg); await click(pg, '#nextBtn'); await click(pg, '#flagBtn');
      await tapBack(pg); await click(pg, '#tileFlagged'); await click(pg, '#flaggedStart');
      let b = await backOf(pg);
      log(!RAW_KEY.test(b.text + ' ' + b.name), id, `Flagged quiz header has no raw key ("${b.text}" / ${b.name})`, b);
      await tapBack(pg);
      log(['screenHome', 'screenFlagged'].includes(await active(pg)), id, `Flagged back leaves the quiz (${await active(pg)})`);
      await goHomeFromAnywhere(pg);
      // Study fact + Similar + plan fact
      await click(pg, '#modeStudy'); await click(pg, '#studyContent .fact-practise');
      b = await backOf(pg);
      log(!RAW_KEY.test(b.text + ' ' + b.name), id, `Study-fact header no raw key ("${b.text}")`, b);
      await tapBack(pg);
      log(['screenHome', 'screenStudy'].includes(await active(pg)), id, `Study-fact back leaves the quiz (${await active(pg)})`);
      await goHomeFromAnywhere(pg);
      await click(pg, '.plan-cta'); await click(pg, '#planCreateBtn'); await click(pg, '#screenPlanSchedule .plan-block[data-action=openPlanDay]');
      await click(pg, '#planTaskList [data-action=planOpenTask]');
      await click(pg, '#planRunBody [data-action=planPractiseFact]');
      b = await backOf(pg);
      log(!RAW_KEY.test(b.text + ' ' + b.name) && b.text.length > 0, id, `plan fact header no raw key ("${b.text}")`, b);
      await tapBack(pg);
      log(['screenPlanRun', 'screenPlanDay'].includes(await active(pg)), id, `plan fact back → ${await active(pg)}`);
      log(pg.errs.length === 0 && !pg.warns.some(w => /no handler/.test(w)), id, 'no page errors / dead actions', { errs: pg.errs, warns: pg.warns });
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
    await click(pg, '#screenStudy .back-btn');
    await startEasy(pg);
    for (let k = 0; k < 30; k++) { await answer(pg); const i = await qInfo(pg); if (i.cur >= 9 && await pg.$('#similarBox .sqm-cta button')) break; await click(pg, '#nextBtn'); }
    await similarCta(pg);
    await pg.screenshot({ path: path.join(SHOTS, `similar-q10plus-${w}-${lang}-${font}.png`) });
    await checkLayout(pg, `SH-${w}`, `Similar from Q${(await pg.evaluate(() => sessionReturn.state.current)) + 1}`);
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
    if (!only || only === 'A') await arrows();
    if (!only || only === 'U') await upgradeMix();
    if (!only || only === 'SH') await shots();
  } catch (e) { log(false, 'RUN', 'threw: ' + e.stack); }
  await browser.close(); server.kill();
  const fail = res.filter(r => !r.ok).length;
  console.log(`\n${res.length - fail}/${res.length} passed`);
  if (findings.length) console.log('FINDINGS:\n' + findings.join('\n'));
  process.exit(fail ? 1 : 0);
})();
