// QA v0.65 Track 1 (zh-HK UI locale + header language pill) — manual, not part of run-all.sh. Writes screenshots.
//   NODE_PATH=/opt/node-tools/node_modules CHROMIUM_PATH=/opt/pw-browsers/chromium \
//     node .proj-docs/qa/scripts/2026-10-07_qa-v065.js <repo-root> <screenshot-dir> [v064-ref=b247d2c]
// QA_ONLY=section,section limits the run.
//
// Black-box: the language is always switched by a real pointer click (or Tab + Enter / Space) on #langBtn, never by
// calling setLang(). page.evaluate is only used to set up data (localStorage seeds, an exam deadline about to run out)
// and to read state as the oracle. The expected zh-HK strings are literals copied from plan appendix A (independent
// of locales/zh-HK.js).
// Double tap guard (HANDOFF, CUI-0011): a pointer click within 40px / 350ms of a click that changed the view is
// swallowed, so every navigation step below waits GUARD_WAIT afterwards.
// 2026-10-07 refresh (Lane D): versionCheck / offlineAndUpgrade compare against the current APP_VERSION
// (js/core/config.js) instead of v0.65; SW cache waits poll inside the page (waitForFunction with an async predicate
// resolved immediately); the multi-select question number no longer carries a "(select N)" hint (CUI-0013 round 2,
// v0.67); langAttrs prints only real gaps (untagged > 0) and measures the answer span `.rv-your > span` (S-047 plan A:
// the "Your answer:" label follows the UI language by design).
// 2026-10-07 refresh (v0.68 per-chapter fact numbers): the Core Fact label reads 📌 核心知識 Ch {ch} #{n} and the fact
// session label 知識點 Ch {ch} #{n}; n is computed here from data/study.js (independent of the app).
// 2026-10-07 refresh (v0.68 Home UI lane, literals from the lane spec): the practice hint is 4 <li>; the exam
// description drops 請於下方選擇試卷。; the My Review note has new wording and sits inside #tileWrong; the
// "已標記 n 題" / "尚餘 n 題 · 每輪 24 題" tile lines are gone (the count is the tile's .t-num); Leave modal stay = 取消.
const { chromium } = require('playwright-core');
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(process.argv[2] || '.');
const SHOT_DIR = path.resolve(process.argv[3] || '.');
const V064_REF = process.argv[4] || 'b247d2c';
const { startPagesServer, appFiles } = require(path.join(ROOT, 'tests', 'pages-server.js'));
const APP_URL = 'file://' + path.join(ROOT, 'index.html');
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
let pass = 0, fail = 0;
const failures = [];
const ok = (c, m) => { if (c) { pass++; console.log('ok:', m); } else { fail++; failures.push(m); console.log('FAIL:', m); } };
const note = (...a) => console.log('  note:', ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const GUARD_WAIT = 420; // > SCREEN_CHANGE_CLICK_GUARD_MS (350)
const TOUCH = w => ({ viewport: { width: w, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36' });
const shot = n => path.join(SHOT_DIR, `${n}.png`);
const TITLE = 'Life in the UK · Exam Practice';
const DESC = 'Life in the UK Test — Exam 1–17 Practice App';
const ZH = 'zh-HK';
const ZH_SEED = JSON.stringify(ZH); // getLS reads JSON
const CUR_VERSION = (fs.readFileSync(path.join(ROOT, 'js/core/config.js'), 'utf8').match(/const APP_VERSION = '([^']+)'/) || [])[1];
const CUR_CACHE = 'lifeuk-v' + CUR_VERSION;
// S-068: SW cache polling inside the page (waitForFunction with an async predicate resolves at once on the Promise)
const CACHE_POLL_MS = 200;
const CACHE_POLL_TRIES = 75; // × CACHE_POLL_MS = 15 s for a fresh install to create its cache
const UPGRADE_POLL_TRIES = 100; // × CACHE_POLL_MS = 20 s for update + activate + old cache removal
// poll caches.keys() until `name` exists (true) or the tries run out (false)
const waitCache = (pg, name) => pg.evaluate(async ([n, tries, ms]) => { for (let i = 0; i < tries; i++) {
  if ((await caches.keys()).includes(n)) return true; await new Promise(r => setTimeout(r, ms)); } return false; },
[name, CACHE_POLL_TRIES, CACHE_POLL_MS]);
// update() until the new worker controls the page and `cur` is the only cache (like tests/upgrade-test.js waitForCache)
const waitUpgrade = (pg, cur) => pg.evaluate(async ([c, tries, ms]) => { const reg = await navigator.serviceWorker.getRegistration();
  for (let i = 0; i < tries; i++) { const k = await caches.keys();
    if (k.length === 1 && k[0] === c && !reg.installing && !reg.waiting && navigator.serviceWorker.controller) return true;
    if (!reg.installing && !reg.waiting) await reg.update().catch(() => {}); await new Promise(r => setTimeout(r, ms)); }
  return false; }, [cur, UPGRADE_POLL_TRIES, CACHE_POLL_MS]);

// v0.68: n = 1-based position among the chapter's facts in data order
const STUDY_DATA = (() => { const c = {}; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'data/study.js'), 'utf8') + ';this.STUDY=STUDY;', c); return c.STUDY; })();
const FACT_NO = {};
STUDY_DATA.reduce((seen, f) => { seen[f.ch] = (seen[f.ch] || 0) + 1; FACT_NO[f.id] = { ch: f.ch, n: seen[f.ch] }; return seen; }, {});
const zhFactSetLabel = id => `知識點 Ch ${FACT_NO[id].ch} #${FACT_NO[id].n}`;

// words of English allowed in zh-HK UI text = the ASCII words the zh-HK locale itself keeps (Exam {n}, Chapter {n},
// chapter names, era / nation English in brackets, app name …)
const zhLocale = (() => { const ctx = { LOCALES: {} }; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'locales/zh-HK.js'), 'utf8'), ctx); return ctx.LOCALES[ZH]; })();
const flat = (o, out = []) => { for (const v of Object.values(o)) typeof v === 'string' ? out.push(v) : flat(v, out); return out; };
const ZH_ASCII_WORDS = new Set(flat(zhLocale).join(' ').match(/[A-Za-z]{3,}/g));

function watch(pg) {
  const errs = [], warns = [];
  pg.on('pageerror', e => errs.push('pageerror: ' + e.message));
  pg.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); if (m.type() === 'warning') warns.push(m.text()); });
  return { errs, warns };
}
async function fresh(b, w, opts = {}, url = APP_URL, seed = null) {
  const ctx = await b.newContext({ viewport: { width: w, height: 844 }, ...opts }); const pg = await ctx.newPage(); const log = watch(pg);
  await pg.goto(url);
  await pg.evaluate(kv => { localStorage.clear(); sessionStorage.clear(); if (kv) for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); }, seed);
  await pg.reload();
  return { ctx, pg, ...log };
}
const nav = async (pg, sel) => { await pg.click(sel); await sleep(GUARD_WAIT); };
const tap = async (pg, sel) => { await pg.click(sel); await sleep(40); };
const pill = async pg => { await pg.click('#langBtn'); await sleep(60); };
const langNow = pg => pg.evaluate(() => ({ html: document.documentElement.lang, ls: localStorage.getItem('lifeuk.uiLang'), pill: byId('langBtn').textContent }));
const bodyText = pg => pg.evaluate(() => document.body.innerText.replace(/[ \t\u00a0]+/g, ' '));
const screenId = pg => pg.evaluate(() => document.querySelector('.screen.active').id);
async function expectTexts(tag, pg, list) {
  const txt = await bodyText(pg);
  // .quiz-label is text-transform: uppercase, so ASCII is compared case-insensitively
  const missing = list.filter(s => !txt.toLowerCase().includes(s.toLowerCase()));
  ok(missing.length === 0, `${tag}: glossary strings visible (${list.length}) ${missing.length ? 'MISSING ' + JSON.stringify(missing) : ''}`);
}
// CUI-0013 round 2 (v0.67): the question number of a multi-select question is just 第 n 題（共 24 題）, no （選擇 N 項）
async function noSelectHint(tag, pg, idx) {
  const num = await pg.$eval('#qNum > span', e => e.textContent);
  const body = await bodyText(pg);
  ok(num === `第 ${idx + 1} 題（共 24 題）` && !/選擇 \d 項|\(select \d\)/i.test(body), `${tag}: question number "${num}" without a (select N) hint`);
}
async function expectAttr(tag, pg, sel, attr, want) {
  const v = await pg.$$eval(sel, (els, attr) => els.map(e => e.getAttribute(attr)), attr);
  ok(v.length > 0 && v.every(x => x === want), `${tag}: ${sel} [${attr}] = "${want}" (${JSON.stringify([...new Set(v)])})`);
}
// leftover English: visible text outside lang-tagged data (question / fact content) and outside known English data
// (person tags, year labels; .rv-your carries the user's English answer = known S-047) with an ASCII word the zh-HK locale itself does not use
async function noEnglishLeft(tag, pg) {
  const found = await pg.evaluate(() => {
    const out = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const p = n.parentElement;
      if (!p || !p.getClientRects().length || p.closest('script,style,.tag.person,.tag.year,.tl-year,.rv-your')) continue;
      const l = p.closest('[lang]');
      if (l && l !== document.documentElement) continue;
      const s = n.textContent.replace(/\s+/g, ' ').trim();
      if (/[A-Za-z]{3,}/.test(s)) out.push([p.className || p.tagName, s]);
    }
    return out;
  });
  const bad = found.filter(([, s]) => s.match(/[A-Za-z]{3,}/g).some(word => !ZH_ASCII_WORDS.has(word)));
  ok(bad.length === 0, `${tag}: no untranslated English UI text in zh-HK ${bad.length ? JSON.stringify(bad.slice(0, 6)) : ''}`);
  return found;
}
async function noOverflow(tag, pg, widths = [320, 360, 390]) {
  const vp = pg.viewportSize();
  for (const w of widths) {
    await pg.setViewportSize({ width: w, height: vp.height });
    await sleep(60);
    const r = await pg.evaluate(() => {
      const iw = document.documentElement.clientWidth;
      const spill = [...document.querySelectorAll('body *')].filter(e => { if (!e.getClientRects().length || e.closest('.modal-backdrop:not(.show), .info-pop:not(.show)')) return false;
        const b = e.getBoundingClientRect(); return b.width && b.right > iw + 0.5; }).map(e => (e.id || e.className) + ':' + e.getBoundingClientRect().right.toFixed(1));
      return { sw: document.documentElement.scrollWidth, iw, spill: spill.slice(0, 5) };
    });
    ok(r.sw <= r.iw && r.spill.length === 0, `${tag} zh-HK ${w}px: no horizontal overflow (scrollWidth ${r.sw} <= ${r.iw}) ${r.spill.join(' ')}`);
  }
  await pg.setViewportSize(vp);
}
// practice: answer the current question right (or wrong) through real clicks on the options
async function answer(pg, right = true) {
  const { a, n } = await pg.evaluate(() => { const q = state.questions[state.current]; return { a: q.a, n: q.o.length }; });
  const picks = right ? a : [...Array(n).keys()].filter(i => !a.includes(i)).slice(0, a.length);
  for (const i of picks) await tap(pg, `#opt${i}`);
}
const quizSnap = pg => pg.evaluate(() => JSON.stringify({ mode: state.mode, examNum: state.examNum, current: state.current, questions: state.questions.map(qKey),
  answers: state.answers, revealed: state.revealed, yueShown: state.yueShown, flags: state.flags, examDeadline, timer: examTimerId !== null,
  side: sessionReturn && sessionReturn.kind, screen: document.querySelector('.screen.active').id,
  storage: Object.fromEntries(Object.keys(localStorage).filter(k => k !== 'lifeuk.uiLang').sort().map(k => [k, localStorage.getItem(k)])) }));

// glossary strings (plan appendix A, literal)
const G = {
  homeTop: ['選擇模式', '溫習', '練習', '模擬考試'],
  practiceDesc: ['每題作答後即時顯示答案及廣東話翻譯。可按難度、章節或試卷選題，並顯示各組掌握進度。', '練習分類', '難度', '章節', '試卷', '容易', '基礎', '中等', '困難', '極難',
    '↺ 重設進度'],
  // v0.68 Home UI: the practice hint is a list of 4 <li>, in this order (max 24 per round, streak 3)
  practiceHint: ['每輪最多抽取 24 條未掌握的題目，每題出現一次', '同一題連續答對 3 次即算掌握', '未掌握的題目會於下一輪再出現',
    '已掌握的題目會略過，直至整組全部掌握'],
  // v0.68 Home UI: the exam description no longer ends with 請於下方選擇試卷。
  examDesc: ['仿照真實考試作答全部 24 題，可返回修改答案。於最後一題提交後，即可查看分數及答案。', '選擇試卷', '🎲 隨機試卷', '從 408 題中抽取 24 題',
    '已完成的試卷會以 ✓ 標示。', '↺ 重設已完成試卷'],
  myReview: ['我的複習', '錯題', '已標記'],
  // v0.68 Home UI: new wording, shown inside the wrong-answers tile (#tileWrong .t-note) instead of #myReviewNote
  myReviewNote: '來自練習及模擬考試，於此答對後便會清除。每輪最多 24 題。',
  info: ['Exam 1–17 練習', '收錄 408 條 lifeintheuktestweb.co.uk 官方風格題目，附廣東話翻譯及備注。', '📋 17 份試卷', '❓ 408 條題目', '🔒 支援離線使用'],
  install: ['安裝以便離線使用', '加至主畫面，無需網絡亦可溫習', '安裝'],
};

// v0.68 Home UI: the My Review tiles as rendered — the count lives only in .t-num (the "已標記 n 題" line and the
// "· 每輪 24 題" suffix are gone); the wrong tile holds .sub + the .t-note, the flagged tile has no .sub while n > 0
const myReviewTiles = pg => pg.evaluate(() => Object.fromEntries(['tileWrong', 'tileFlagged'].map(id => {
  const el = document.getElementById(id), txt = sel => (el.querySelector(sel) || {}).textContent || '';
  return [id, { num: txt('.t-num'), title: txt('b'), sub: txt('.sub'), note: txt('.t-note') }];
}).concat([['oldNote', !!document.getElementById('myReviewNote')]])));
// wrong tile: n + the note (v0.70: no 尚餘 n 題 line); flagged tile: n, title only
async function expectMyReview(tag, pg, wrongN, flagN) {
  const t = await myReviewTiles(pg);
  const w = t.tileWrong, f = t.tileFlagged;
  ok(w.num === String(wrongN) && w.title === '錯題' && w.sub === '' && w.note === G.myReviewNote,
    `${tag}: wrong tile ${wrongN}, no 尚餘 line (v0.70) + note inside the tile ${JSON.stringify(w)}`);
  ok(f.num === String(flagN) && f.title === '已標記' && f.sub === '' && f.note === '',
    `${tag}: flagged tile ${flagN}, no count line ${JSON.stringify(f)}`);
  ok(!t.oldNote, `${tag}: no separate #myReviewNote below the tiles`);
}

// ══════════ 1. version / SW / document / manifest ══════════
async function versionCheck(b) {
  const { base, server } = await startPagesServer(ROOT);
  try {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const pg = await ctx.newPage(); const { errs } = watch(pg);
    await pg.goto(base);
    ok(!!CUR_VERSION && await pg.evaluate(() => APP_VERSION) === CUR_VERSION, `APP_VERSION === ${CUR_VERSION} (js/core/config.js)`);
    ok((await pg.textContent('#appVersion')) === 'v' + CUR_VERSION, `header shows v${CUR_VERSION}`);
    await pg.evaluate(() => navigator.serviceWorker.ready);
    await waitCache(pg, CUR_CACHE);
    const keys = await pg.evaluate(() => caches.keys());
    ok(keys.length === 1 && keys[0] === CUR_CACHE, `SW cache = ${CUR_CACHE} only (${keys})`);
    const zhCached = await pg.evaluate(async c => { const r = await (await caches.open(c)).match('locales/zh-HK.js'); return r ? (await r.text()).includes("LOCALES['zh-HK']") : false; }, CUR_CACHE);
    ok(zhCached, 'locales/zh-HK.js is in the installed SW cache');
    const order = await pg.evaluate(() => [...document.scripts].map(s => s.getAttribute('src')));
    ok(order.indexOf('locales/zh-HK.js') === order.indexOf('locales/en.js') + 1 && order.indexOf('locales/zh-HK.js') < order.indexOf('js/core/i18n.js'), 'index.html loads zh-HK.js right after en.js, before i18n.js');
    const mf = await pg.evaluate(async () => (await fetch('manifest.webmanifest')).json());
    // switch, then check document title / meta / manifest stay English
    await pill(pg);
    const doc = await pg.evaluate(() => ({ html: document.documentElement.lang, title: document.title, desc: document.querySelector('meta[name="description"]').content,
      apple: document.querySelector('meta[name="apple-mobile-web-app-title"]').content, mf: document.querySelector('link[rel="manifest"]').getAttribute('href') }));
    ok(doc.html === ZH && doc.title === TITLE && doc.desc === DESC && doc.apple === 'Life in UK', `zh-HK: <title> / meta description / apple title stay English ${JSON.stringify(doc)}`);
    ok(doc.mf === 'manifest.webmanifest' && mf.name === 'Life in the UK Test' && mf.short_name === 'Life in UK', `manifest link + name / short_name unchanged (${mf.name} / ${mf.short_name})`);
    ok(errs.length === 0, 'version — no page errors ' + errs.join('|'));
    await ctx.close();
  } finally { server.kill(); }
  const mfDiff = execSync(`git diff --name-only ${V064_REF} HEAD -- manifest.webmanifest icons`, { cwd: ROOT }).toString().trim();
  ok(mfDiff === '', `manifest.webmanifest / icons unchanged since v0.64 ${V064_REF} ("${mfDiff}")`);
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(html.includes(`<title>${TITLE}</title>`) && html.includes(`content="${DESC}"`) && /^<html lang="en">/m.test(html), 'index.html literal <title> / meta / <html lang="en"> unchanged');
}

// ══════════ 2. pill: states, labels, keyboard, hit area, persistence ══════════
async function pillCheck(b) {
  for (const w of [320, 390, 900]) {
    const { ctx, pg, errs, warns } = await fresh(b, w);
    let p = await pg.$eval('#langBtn', e => ({ t: e.textContent, a: e.getAttribute('aria-label'), ti: e.title, hidden: e.hidden, vis: !!e.getClientRects().length, type: e.type }));
    ok(p.t === '中' && p.a === 'Switch to Chinese' && p.ti === 'Switch to Chinese' && p.vis && p.type === 'button', `${w}: en pill shows 中, aria-label / title Switch to Chinese ${JSON.stringify(p)}`);
    // geometry: inside the header, right of the logo, 44px hit area all round
    const geo = await pg.evaluate(() => { const e = byId('langBtn'), r = e.getBoundingClientRect(), logo = document.querySelector('.logo').getBoundingClientRect(),
      hd = document.querySelector('.header-inner').getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const hits = []; for (const [dx, dy] of [[-21, 0], [21, 0], [0, -21], [0, 21], [-20, -20], [20, 20], [-20, 20], [20, -20]]) hits.push(document.elementFromPoint(cx + dx, cy + dy) === e);
      return { w: r.width, h: r.height, right: r.right, iw: innerWidth, logoRight: logo.right, left: r.left, inHeader: r.top >= hd.top && r.bottom <= hd.bottom + 1, hits }; });
    ok(geo.right <= geo.iw && geo.left > geo.logoRight && geo.inHeader, `${w}: pill inside header, right of the logo, not past the viewport ${JSON.stringify({ l: geo.left, r: geo.right, logo: geo.logoRight })}`);
    ok(geo.hits.every(Boolean), `${w}: pill hit area >= 44 × 44 (points ±21px / ±20px diagonals land on it) ${JSON.stringify(geo.hits)} visible ${geo.w.toFixed(1)}×${geo.h.toFixed(1)}`);
    await pill(pg);
    p = await pg.$eval('#langBtn', e => ({ t: e.textContent, a: e.getAttribute('aria-label'), ti: e.title }));
    const l = await langNow(pg);
    ok(p.t === 'EN' && p.a === '切換至英文' && p.ti === '切換至英文' && l.html === ZH && l.ls === '"zh-HK"', `${w}: click → zh-HK, pill EN, 切換至英文, uiLang stored ${JSON.stringify({ ...p, ...l })}`);
    await pg.reload();
    ok((await langNow(pg)).html === ZH && (await pg.textContent('#langBtn')) === 'EN', `${w}: reload keeps zh-HK`);
    await pill(pg);
    ok((await langNow(pg)).html === 'en' && (await pg.textContent('#langBtn')) === '中', `${w}: click again → en, pill 中`);
    await pg.reload();
    ok((await langNow(pg)).html === 'en', `${w}: reload keeps en`);
    ok(errs.length === 0 && warns.filter(x => x.includes('[i18n]')).length === 0, `${w}: pill — no page errors / i18n warnings ${errs.concat(warns).join('|')}`);
    await ctx.close();
  }
  // keyboard: Tab reaches the pill; Enter and Space both toggle; focus ring visible
  const { ctx, pg, errs } = await fresh(b, 390);
  let reached = false;
  for (let i = 0; i < 6 && !reached; i++) { await pg.keyboard.press('Tab'); reached = await pg.evaluate(() => document.activeElement && document.activeElement.id === 'langBtn'); }
  ok(reached, 'keyboard: Tab reaches the pill (after ⓘ)');
  const ring = await pg.$eval('#langBtn', e => { const s = getComputedStyle(e); return { style: s.outlineStyle, w: s.outlineWidth, fv: e.matches(':focus-visible') }; });
  ok(ring.fv && ring.style === 'solid' && ring.w === '2px', `keyboard focus shows the 2px focus-visible ring ${JSON.stringify(ring)}`);
  await pg.keyboard.press('Enter'); await sleep(60);
  ok((await langNow(pg)).html === ZH, 'keyboard Enter → zh-HK');
  ok(await pg.evaluate(() => document.activeElement.id === 'langBtn'), 'focus stays on the pill after the switch');
  await pg.keyboard.press('Space'); await sleep(60);
  ok((await langNow(pg)).html === 'en', 'keyboard Space → en');
  await pg.keyboard.press('Space'); await sleep(60);
  ok((await langNow(pg)).html === ZH, 'keyboard Space → zh-HK again');
  ok(errs.length === 0, 'keyboard — no page errors ' + errs.join('|'));
  await ctx.close();
  // mobile touch tap
  const t = await fresh(b, 390, TOUCH(390));
  const c = await t.pg.$eval('#langBtn', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await t.pg.touchscreen.tap(c.x, c.y + 8); await sleep(60);
  ok((await langNow(t.pg)).html === ZH, 'touch tap 8px below the visible pill (hit ring) → zh-HK');
  await t.ctx.close();
}

// ══════════ 3. glossary per screen in zh-HK (+ leftover English, + 320/360/390 overflow) ══════════
const WRONG30 = Object.fromEntries([...Array(30).keys()].map(i => [`${1 + Math.floor(i / 24)}.${i % 24}`, true]));
const FLAGS30 = Object.fromEntries([...Array(30).keys()].map(i => [`${5 + Math.floor(i / 24)}.${i % 24}`, true]));
async function glossary(b) {
  // Home (practice: difficulty / chapter / exam tabs, My Review), exam mode, info popover
  {
    const { ctx, pg, errs, warns } = await fresh(b, 390, {}, APP_URL, { 'lifeuk.wrongList': { '1.0': true, '1.1': true, '2.3': true }, 'lifeuk.practiceFlags': { '3.4': true, '6.7': true } });
    await pill(pg);
    await nav(pg, '#modePractice');
    await expectTexts('Home practice › difficulty', pg, [...G.homeTop, ...G.practiceDesc, ...G.practiceHint, ...G.myReview, G.myReviewNote]);
    const hintLis = await pg.$$eval('#practiceHint li', els => els.map(e => e.textContent));
    ok(JSON.stringify(hintLis) === JSON.stringify(G.practiceHint), `Home practice: hint is ${G.practiceHint.length} <li> in order ${JSON.stringify(hintLis)}`);
    await expectMyReview('Home practice › difficulty', pg, 3, 2);
    await noEnglishLeft('Home practice › difficulty', pg); await noOverflow('Home practice › difficulty', pg);
    await tap(pg, '#ptabChapter');
    await expectTexts('Home practice › chapter', pg, ['Ch 1', 'Values & principles', 'Ch 3', 'History', 'Government & law']);
    await noEnglishLeft('Home practice › chapter', pg); await noOverflow('Home practice › chapter', pg);
    await tap(pg, '#ptabExam');
    const allBtn = await pg.$eval('#examGrid [data-arg="all"]', e => e.textContent.replace(/\s+/g, ' ').trim());
    ok(allBtn.startsWith('📝 全部試題（408 題）'), `M6 Home practice › exam: all-questions cell "📝 全部試題（408 題）" (${allBtn})`);
    await expectTexts('Home practice › exam', pg, ['Exam 1', 'Exam 17']);
    await noEnglishLeft('Home practice › exam', pg); await noOverflow('Home practice › exam', pg);
    await nav(pg, '#modeExam');
    await expectTexts('Home exam', pg, [...G.homeTop, ...G.examDesc]);
    ok(!(await bodyText(pg)).includes('請於下方選擇試卷'), 'Home exam: description has no 請於下方選擇試卷');
    await noEnglishLeft('Home exam', pg); await noOverflow('Home exam', pg);
    await tap(pg, '#infoBtn');
    await expectTexts('ⓘ popover', pg, G.info);
    await expectAttr('ⓘ', pg, '#infoBtn', 'aria-label', '關於本程式');
    await expectAttr('ⓘ popover', pg, '#infoPop', 'aria-label', '關於本程式');
    await noOverflow('ⓘ popover open', pg);
    // switching with the popover open: the click closes it (outside click), reopening shows en
    await pill(pg);
    const popOpen = await pg.$eval('#infoPop', e => e.classList.contains('show'));
    await tap(pg, '#infoBtn');
    const popTxt = await pg.textContent('#infoPop');
    ok(!popOpen && popTxt.includes('Exam 1–17 Practice') && popTxt.includes('408 Questions'), `ⓘ open + pill: popover closes; reopened in en (${popTxt.replace(/\s+/g, ' ').slice(0, 60)})`);
    ok(errs.length === 0 && !warns.some(x => x.includes('[i18n]')), 'Home / popover — no page errors / i18n warnings ' + errs.concat(warns).join('|'));
    await ctx.close();
  }
  // My Review over a round (30 wrong / 30 flagged) + round notes
  {
    const { ctx, pg, errs } = await fresh(b, 390, {}, APP_URL, { 'lifeuk.wrongList': WRONG30, 'lifeuk.practiceFlags': FLAGS30, 'lifeuk.uiLang': ZH_SEED });
    await nav(pg, '#modePractice');
    await expectMyReview('My Review 30', pg, 30, 30);
    ok(!(await bodyText(pg)).includes('每輪 24 題'), 'My Review 30: no "· 每輪 24 題" round suffix on the tile');
    await nav(pg, '#tileWrong');
    await expectTexts('Wrong review quiz', pg, ['錯題', '第 1 輪（共 2 輪）· 錯題 30 題中的 24 題', '第 1 題（共 24 題）']);
    await noEnglishLeft('Wrong review quiz', pg);
    await answer(pg, true); await sleep(50);
    // finish the round fast: jump to the last question by its dot, answer, Finish
    await tap(pg, '#navDots .dot:last-child'); await answer(pg, true); await nav(pg, '#nextBtn');
    await expectTexts('Wrong review result', pg, ['已從錯題清除 2 題 · 尚餘 28 題', '另一組練習', '重做']);
    await noEnglishLeft('Wrong review result', pg);
    await nav(pg, '#screenResult .back-btn');
    await nav(pg, '#tileFlagged');
    await expectTexts('Flagged screen', pg, ['已標記', '練習已標記題目（30）', '每題一次 · 每輪最多 24 題', '← 主頁']);
    await expectAttr('Flagged', pg, '#flaggedList [data-action="unflagFromList"]', 'aria-label', '取消標記');
    await noEnglishLeft('Flagged screen', pg); await noOverflow('Flagged screen', pg);
    await nav(pg, '#flaggedStart');
    await expectTexts('Flagged practice', pg, ['第 1 輪（共 2 輪）· 已標記 30 題中的 24 題', '已標記']);
    ok(errs.length === 0, 'My Review / Flagged — no page errors ' + errs.join('|'));
    await ctx.close();
  }
  // Flagged: empty list; Study empty; reset modals
  {
    const { ctx, pg, errs } = await fresh(b, 390, {}, APP_URL, { 'lifeuk.practiceFlags': { '3.4': true }, 'lifeuk.wrongList': { '1.0': true }, 'lifeuk.uiLang': ZH_SEED, 'lifeuk.completedExams': { 1: true } });
    await nav(pg, '#modePractice'); await nav(pg, '#tileFlagged');
    await tap(pg, '#flaggedList [data-action="unflagFromList"]');
    await expectTexts('Flagged empty', pg, ['已沒有標記的題目。']);
    await nav(pg, '#screenFlagged .back-btn');
    await expectTexts('Home flagged tile empty', pg, ['於題目按']);
    await tap(pg, '#practiceReset .reset-btn');
    await expectTexts('Reset progress modal', pg, ['重設練習進度？', '掌握進度、錯題及標記將會清除。', '重設', '保留']);
    await noOverflow('Reset progress modal', pg, [320]);
    await tap(pg, '#confirmCancel');
    await nav(pg, '#modeExam'); await tap(pg, '#examReset .reset-btn');
    await expectTexts('Reset completed modal', pg, ['重設已完成試卷？', '所有 ✓ 完成標示將會清除。', '重設', '保留']);
    await tap(pg, '#confirmCancel');
    ok(errs.length === 0, 'reset modals — no page errors ' + errs.join('|'));
    await ctx.close();
  }
  // install banner (touch + beforeinstallprompt)
  {
    const { ctx, pg, errs } = await fresh(b, 390, TOUCH(390));
    await pg.evaluate(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = () => Promise.resolve(); e.userChoice = Promise.resolve({ outcome: 'dismissed' }); window.dispatchEvent(e); });
    const c = await pg.$eval('#langBtn', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await pg.touchscreen.tap(c.x, c.y); await sleep(60);
    const vis = await pg.$eval('#installBanner', e => e.classList.contains('visible'));
    ok(vis, 'install banner stays visible across the switch');
    await expectTexts('Install banner', pg, G.install);
    await expectAttr('Install banner', pg, '.install-close', 'aria-label', '關閉');
    await noOverflow('Install banner', pg);
    await pg.screenshot({ path: shot('zh-HK_install-banner_390') });
    await pg.setViewportSize({ width: 320, height: 844 }); await pg.screenshot({ path: shot('zh-HK_install-banner_320') });
    ok(errs.length === 0, 'install banner — no page errors ' + errs.join('|'));
    await ctx.close();
  }
  // Quiz practice (Exam 4 via clicks): before / after reveal, translation toggle, Similar panel, multi-select, finish
  {
    const { ctx, pg, errs, warns } = await fresh(b, 390, {}, APP_URL, { 'lifeuk.uiLang': ZH_SEED });
    await nav(pg, '#modePractice'); await tap(pg, '#ptabExam'); await nav(pg, '#examGrid [data-arg="4"]');
    await expectTexts('Quiz practice Q1', pg, ['Exam 4', '練習', '第 1 題（共 24 題）', '翻譯', '← 上一題', '正確', '錯誤', '未作答', '已標記']);
    await expectAttr('Quiz practice', pg, '#quickPrev', 'aria-label', '上一題');
    await expectAttr('Quiz practice', pg, '#flagBtn', 'aria-label', '標記待覆閱');
    await noEnglishLeft('Quiz practice Q1', pg);
    await tap(pg, '#yueToggle');
    await expectTexts('Quiz practice translate', pg, ['隱藏翻譯']);
    await tap(pg, '#flagBtn');
    await expectAttr('Quiz practice flagged', pg, '#flagBtn', 'aria-label', '取消標記');
    await tap(pg, '#flagBtn');
    // a question with similars, and a multi-select question
    const idx = await pg.evaluate(() => ({ sim: state.questions.findIndex(q => similarKeys(q).length > 0), multi: state.questions.findIndex(q => q.a.length > 1) }));
    note('Exam 4 practice: similar idx', idx.sim, 'multi idx', idx.multi);
    await tap(pg, `#navDots .dot:nth-child(${idx.sim + 1})`);
    await answer(pg, false); await sleep(50);
    await expectTexts('Quiz practice revealed (wrong)', pg, ['✗ 錯誤', '【廣東話翻譯】', '相似題目', '同一知識點，不同問法', '📌 核心知識 Ch ', '本題', '進行中', '▶ 練習這', '下一題 →']);
    const stars = await pg.$eval('#qNum .stars', e => e.title);
    ok(/^難度 [1-5]\/5$/.test(stars), `difficulty stars title 難度 d/5 (${stars})`);
    const hasNote = await pg.$eval('#ansNote', e => !!e.textContent);
    if (hasNote) await expectTexts('Quiz practice note', pg, ['💡 備注：']);
    await expectAttr('Quiz practice revealed', pg, '#quickNext', 'aria-label', '下一題');
    await noEnglishLeft('Quiz practice revealed', pg); await noOverflow('Quiz practice revealed + Similar', pg);
    await pg.screenshot({ path: shot('zh-HK_quiz-practice-revealed_390'), fullPage: false });
    if (idx.multi >= 0) {
      await tap(pg, `#navDots .dot:nth-child(${idx.multi + 1})`);
      await noSelectHint('Quiz practice multi-select', pg, idx.multi);
    } else note('Exam 4 has no multi-select question; question number checked in exam below');
    await tap(pg, '#navDots .dot:last-child'); await answer(pg, true); await sleep(50);
    await expectTexts('Quiz practice last', pg, ['✓ 正確！', '完成 ✓']);
    await expectAttr('Quiz practice last', pg, '#quickNext', 'aria-label', '完成');
    await nav(pg, '#nextBtn');
    await expectTexts('Result practice', pg, ['Exam 4', '本輪新掌握 0 題 · Exam 4 已掌握 0/24', '按難度', '檢視答案', '全部', '錯誤', '已標記', '你的答案：', '重做', '另一組練習']);
    await noEnglishLeft('Result practice', pg); await noOverflow('Result practice', pg);
    ok(errs.length === 0 && !warns.some(x => x.includes('[i18n]')), 'Quiz practice / result — no page errors / i18n warnings ' + errs.concat(warns).join('|'));
    await ctx.close();
  }
  // M6: All Questions set — quiz label + result label, en and zh-HK
  {
    const { ctx, pg, errs } = await fresh(b, 390);
    await nav(pg, '#modePractice'); await tap(pg, '#ptabExam');
    const enCell = await pg.$eval('#examGrid [data-arg="all"]', e => e.textContent.replace(/\s+/g, ' ').trim());
    ok(enCell.startsWith('📝 All Questions (408)'), `M6 en: all-questions cell "📝 All Questions (408)" (${enCell})`);
    await nav(pg, '#examGrid [data-arg="all"]');
    ok((await pg.textContent('#quizLabel')) === 'All Questions (shuffled)', 'M6 en: quiz label All Questions (shuffled)');
    await pill(pg);
    ok((await pg.textContent('#quizLabel')) === '全部試題（隨機排序）', 'M6 zh-HK: quiz label 全部試題（隨機排序）');
    await answer(pg, true); await tap(pg, '#navDots .dot:last-child'); await answer(pg, true); await nav(pg, '#nextBtn');
    ok((await pg.textContent('#resultLabel')) === '全部試題', `M6 zh-HK: result label 全部試題 (${await pg.textContent('#resultLabel')})`);
    const rn = await pg.textContent('#resultNote');
    ok(rn.includes('全部試題 已掌握') || rn.includes('全部試題已掌握'), `M6 zh-HK: result mastery line names 全部試題 (${rn})`);
    await pill(pg);
    ok((await pg.textContent('#resultLabel')) === 'All Questions', 'M6 en: result label All Questions');
    ok(!(await bodyText(pg)).includes('All Exams'), 'M6: "All Exams" appears nowhere');
    ok(errs.length === 0, 'M6 — no page errors ' + errs.join('|'));
    await ctx.close();
  }
  // Quiz exam + modals + result (exam)
  {
    const { ctx, pg, errs, warns } = await fresh(b, 390, {}, APP_URL, { 'lifeuk.uiLang': ZH_SEED });
    await nav(pg, '#modeExam'); await nav(pg, '#examGrid [data-arg="1"]');
    await expectTexts('Quiz exam', pg, ['Exam 1', '第 1 題（共 24 題）', '已作答', '未作答', '已標記']);
    const timer = await pg.textContent('#examTimer');
    ok(/^⏱ \d\d:\d\d$/.test(timer), `exam timer format ⏱ mm:ss (${timer})`);
    const multi = await pg.evaluate(() => state.questions.findIndex(q => q.a.length > 1));
    if (multi >= 0) { await tap(pg, `#navDots .dot:nth-child(${multi + 1})`); await noSelectHint('Quiz exam multi', pg, multi); }
    await tap(pg, '#navDots .dot:nth-child(1)'); await tap(pg, '#opt0'); await tap(pg, '#flagBtn');
    await noEnglishLeft('Quiz exam', pg); await noOverflow('Quiz exam', pg);
    await tap(pg, '#screenQuiz .back-btn');
    await expectTexts('Leave modal', pg, ['離開考試？', '已作答的答案將會遺失。', '離開', '取消']);
    ok((await pg.textContent('#confirmCancel')) === '取消', 'Leave modal: the stay button reads 取消');
    await tap(pg, '#confirmCancel');
    await tap(pg, '#navDots .dot:last-child');
    ok((await pg.textContent('#nextBtn')) === '提交', 'exam last question: 提交');
    await tap(pg, '#nextBtn');
    await expectTexts('Submit modal', pg, ['提交試卷？', '尚有 23 題未作答', '已標記 1 題', '你仍可返回檢查。', '繼續作答', '提交']);
    await noOverflow('Submit modal', pg, [320]);
    await nav(pg, '#confirmOk');
    await expectTexts('Result exam', pg, ['Exam 1', '📚 有待改善', '真實考試須答對 18/24（75%）方為合格。', '按難度', '檢視答案', '你的答案：', '未作答', '重做', '另一份試卷']);
    await noEnglishLeft('Result exam', pg); await noOverflow('Result exam', pg);
    ok(errs.length === 0 && !warns.some(x => x.includes('[i18n]')), 'exam / modals / result — no page errors / i18n warnings ' + errs.concat(warns).join('|'));
    await ctx.close();
  }
  // Result: passed + random exam; > 24 questions (passThreshold)
  {
    const { ctx, pg } = await fresh(b, 390, {}, APP_URL, { 'lifeuk.uiLang': ZH_SEED });
    await nav(pg, '#modeExam'); await nav(pg, '#examGrid [data-arg="all"]');
    ok((await pg.textContent('#quizLabel')) === '隨機試卷', 'random exam label 隨機試卷');
    for (let i = 0; i < 24; i++) { await tap(pg, `#navDots .dot:nth-child(${i + 1})`); const a = await pg.evaluate(() => state.questions[state.current].a); for (const x of a) await tap(pg, `#opt${x}`); }
    await tap(pg, '#nextBtn'); await nav(pg, '#confirmOk').catch(() => {});
    if (await screenId(pg) !== 'screenResult') await sleep(300);
    await expectTexts('Result passed', pg, ['🎉 合格', '隨機試卷']);
    await ctx.close();
  }
  // Similar side session + fact session labels
  {
    const { ctx, pg } = await fresh(b, 390, {}, APP_URL, { 'lifeuk.uiLang': ZH_SEED });
    await nav(pg, '#modePractice'); await tap(pg, '#ptabExam'); await nav(pg, '#examGrid [data-arg="4"]');
    const sim = await pg.evaluate(() => state.questions.findIndex(q => similarKeys(q).length > 0));
    await tap(pg, `#navDots .dot:nth-child(${sim + 1})`); await answer(pg, true);
    await nav(pg, '#similarBox [data-action="startSimilarPractice"]');
    await expectTexts('Similar side session', pg, ['相似題目', '第 1 題（共']);
    await ctx.close();
  }
  // Study: all tabs, chips, toggles, progress, empty, BC year, derived mastery
  {
    // fact with every source question mastered → 🏆 derived
    const { ctx, pg, errs, warns } = await fresh(b, 390, {}, APP_URL, { 'lifeuk.uiLang': ZH_SEED });
    const derived = await pg.evaluate(() => { const f = STUDY.find(x => x.ch === 3 && x.src.length === 1); return { id: f.id, streak: Object.fromEntries(f.src.map(k => [k, MASTERY_STREAK])) }; });
    await pg.evaluate(s => localStorage.setItem('lifeuk.practiceStreak', JSON.stringify(s)), derived.streak); await pg.reload();
    await nav(pg, '#modeStudy');
    await tap(pg, '#studySubChips [data-arg="3"]');
    await expectTexts('Study chapters', pg, ['📖 溫習', '📚 章節', '📅 時間線', '🗺️ 地理', '👤 人物', '✓ 隱藏已掌握', '只顯示書籤', '項知識點', '🏆 已掌握 1 / 236', 'Chapter 3: A long and illustrious history', '出現於：', '▶ 練習這']);
    await expectAttr('Study', pg, '#studySearch', 'placeholder', '搜尋知識點（英文／廣東話）');
    await expectAttr('Study', pg, `#studyContent .fact:not([data-fact-id="${derived.id}"]) [data-mark="bookmarks"]`, 'aria-label', '書籤');
    const trophy = await pg.$eval(`#studyContent .fact[data-fact-id="${derived.id}"]`, e => e.innerHTML);
    ok(trophy.includes('🏆 已掌握 — 所有來源題目均已掌握'), `Study derived mastery: 🏆 已掌握 — 所有來源題目均已掌握 on #${derived.id}`);
    await noEnglishLeft('Study chapters', pg); await noOverflow('Study chapters', pg);
    await tap(pg, '#studyTabs [data-tab="timeline"]');
    const bc = await pg.evaluate(() => STUDY.filter(f => f.y < 0 && !f.yl).map(f => f.id));
    await expectTexts('Study timeline', pg, ['⚔️ 只顯示戰爭', '石器及鐵器時代（Stone Age & Iron Age）', '羅馬時期（Romans）', '都鐸王朝（Tudors）', '維多利亞時代（Victorian）', '20 世紀（20th century）', '21 世紀（21st century）', '⚔️ 戰爭／戰役']);
    if (bc.length) await expectTexts('Study timeline BC', pg, ['公元前']); else note('every BC fact has its own yl label (M3: English) — study.yearBC unused by data');
    await noEnglishLeft('Study timeline', pg); await noOverflow('Study timeline', pg);
    await tap(pg, '#studyTabs [data-tab="geo"]');
    const chips = await pg.$$eval('#studyChips .chip, #studySubChips .chip', es => es.map(e => e.textContent.trim()));
    const M2 = ['全部', '🇬🇧 英國', '🏴󠁧󠁢󠁥󠁮󠁧󠁿 英格蘭', '🏴󠁧󠁢󠁳󠁣󠁴󠁿 蘇格蘭', '🏴󠁧󠁢󠁷󠁬󠁳󠁿 威爾斯', '☘️ 北愛爾蘭'];
    ok(M2.every(c => chips.includes(c)) && !chips.some(c => /[A-Za-z]/.test(c)), `M2 nation chips Chinese only ${JSON.stringify(chips)}`);
    await expectTexts('Study geo', pg, ['🇬🇧 英國（United Kingdom）', '英格蘭（England）', '🏙️ 城市及首府', '⛰️ 山脈、公園及自然景觀', '🏛️ 地標及建築', '🗺️ 地區及領土']);
    await tap(pg, '#studySubChips .chip:nth-child(4)');
    await expectTexts('Study geo › Scotland', pg, ['蘇格蘭（Scotland）']);
    await noEnglishLeft('Study geo', pg); await noOverflow('Study geo', pg);
    await tap(pg, '#studyTabs [data-tab="people"]');
    await expectTexts('Study people', pg, ['👑 君主', '🏛️ 政治及軍事', '🔬 科學家', '✒️ 作家', '🎨 藝術家', '🏅 體育', '✊ 改革者', '👑 君主及統治者', '🏛️ 首相、政治人物及軍事人物', '🔬 科學家、發明家及工程師', '✒️ 作家及詩人', '🎨 藝術家、建築師及作曲家', '🏅 體育及探險', '✊ 改革者及其他']);
    await noEnglishLeft('Study people', pg); await noOverflow('Study people', pg);
    await pg.fill('#studySearch', 'zzzzqqq'); await sleep(80);
    await expectTexts('Study empty', pg, ['沒有符合的知識點。', '0 / ']);
    ok(errs.length === 0 && !warns.some(x => x.includes('[i18n]')), 'Study — no page errors / i18n warnings ' + errs.concat(warns).join('|'));
    await ctx.close();
  }
  // difficulty / chapter / fact set labels
  {
    const { ctx, pg } = await fresh(b, 390, {}, APP_URL, { 'lifeuk.uiLang': ZH_SEED });
    await nav(pg, '#modePractice'); await nav(pg, '#diffGrid button:nth-child(2)');
    const d = await pg.textContent('#quizLabel');
    ok(d === '★★ 基礎', `difficulty set label ★★ 基礎 (${d})`);
    await nav(pg, '#screenQuiz .back-btn'); await tap(pg, '#ptabChapter'); await nav(pg, '#chapterGrid button:nth-child(3)');
    ok((await pg.textContent('#quizLabel')) === 'Chapter 3', 'chapter set label Chapter 3 (Q9)');
    await nav(pg, '#screenQuiz .back-btn'); await nav(pg, '#modeStudy'); await tap(pg, '#studyTabs [data-tab="chapters"]'); await tap(pg, '#studySubChips [data-arg="3"]');
    await nav(pg, '#studyContent .fact[data-fact-id="21"] .fact-practise');
    ok((await pg.textContent('#quizLabel')) === zhFactSetLabel(21), `fact session label ${zhFactSetLabel(21)} (fact 21) (${await pg.textContent('#quizLabel')})`);
    await ctx.close();
  }
}

// ══════════ 4. state kept across a switch (real flows) ══════════
async function stateKeep(b) {
  // mid-exam: timer keeps counting, no auto-submit, answers / flags / position kept
  {
    const { ctx, pg, errs, warns } = await fresh(b, 390);
    await nav(pg, '#modeExam'); await nav(pg, '#examGrid [data-arg="2"]');
    await tap(pg, '#opt0'); await tap(pg, '#nextBtn'); await tap(pg, '#opt1'); await tap(pg, '#flagBtn'); await tap(pg, '#nextBtn'); await tap(pg, '#opt0');
    const before = await quizSnap(pg); const t0 = await pg.textContent('#examTimer');
    await pill(pg);
    const after = await quizSnap(pg);
    ok(after === before, 'mid-exam → zh-HK: state identical (answers, flags, current, deadline, timer running, storage)' + (after === before ? '' : `\n ${before}\n ${after}`));
    await expectTexts('mid-exam zh-HK', pg, ['第 3 題（共 24 題）', '已作答', '未作答', '已標記']);
    ok(await screenId(pg) === 'screenQuiz', 'mid-exam: still on the quiz (no auto-submit)');
    await sleep(2100);
    const t1 = await pg.textContent('#examTimer');
    ok(t1 !== t0 && /^⏱ \d\d:\d\d$/.test(t1), `mid-exam: timer keeps counting after the switch (${t0} → ${t1})`);
    await pill(pg);
    ok(await quizSnap(pg) === before && await screenId(pg) === 'screenQuiz', 'mid-exam → en again: state identical');
    ok(errs.length === 0 && !warns.some(x => x.includes('[i18n]')), 'mid-exam — no page errors / i18n warnings ' + errs.concat(warns).join('|'));
    await ctx.close();
  }
  // mid-practice after reveal (Similar panel shown), Similar side session, ↩ Back
  {
    const { ctx, pg, errs, warns } = await fresh(b, 390);
    await nav(pg, '#modePractice'); await tap(pg, '#ptabExam'); await nav(pg, '#examGrid [data-arg="4"]');
    const sim = await pg.evaluate(() => state.questions.findIndex(q => similarKeys(q).length > 0));
    await tap(pg, `#navDots .dot:nth-child(${sim + 1})`); await answer(pg, true); await sleep(40);
    const before = await quizSnap(pg);
    const simBefore = await pg.$eval('#similarBox', e => ({ show: e.classList.contains('show'), n: e.querySelectorAll('.sqm-item').length }));
    await pill(pg);
    const after = await quizSnap(pg);
    ok(after === before, 'practice after reveal → zh-HK: state identical (revealed, answers, streak / wrongList not re-recorded)' + (after === before ? '' : `\n ${before}\n ${after}`));
    const simAfter = await pg.$eval('#similarBox', e => ({ show: e.classList.contains('show'), n: e.querySelectorAll('.sqm-item').length }));
    ok(JSON.stringify(simAfter) === JSON.stringify(simBefore) && simAfter.show, `practice: Similar panel still shown with the same ${simAfter.n} items`);
    ok((await pg.textContent('#ansLabel')).includes('正確'), 'practice: answer box re-rendered in zh-HK (✓ 正確！)');
    await nav(pg, '#similarBox [data-action="startSimilarPractice"]');
    const n = await pg.evaluate(() => state.questions.length);
    await answer(pg, true);
    const sideBefore = await quizSnap(pg);
    await pill(pg);
    ok(await quizSnap(pg) === sideBefore, 'Similar side session → en: state identical (sessionReturn kept)');
    ok((await pg.textContent('#quizLabel')) === 'Similar Questions', 'side session label en: Similar Questions');
    await pill(pg);
    ok((await pg.textContent('#quizLabel')) === '相似題目', 'side session label zh-HK: 相似題目');
    for (let i = 1; i < n; i++) { await tap(pg, '#nextBtn'); await answer(pg, true); }
    ok((await pg.textContent('#nextBtn')) === '↩ 返回', `side session last question: ↩ 返回 (${await pg.textContent('#nextBtn')})`);
    await expectAttr('side last', pg, '#quickNext', 'aria-label', '返回');
    await pill(pg);
    ok((await pg.textContent('#nextBtn')) === '↩ Back', 'side session last question en: ↩ Back');
    await pill(pg);
    await nav(pg, '#nextBtn');
    const back = await quizSnap(pg);
    const b0 = JSON.parse(before), b1 = JSON.parse(back);
    ok(b1.examNum === 4 && b1.current === sim && JSON.stringify(b1.revealed) === JSON.stringify(b0.revealed) && JSON.stringify(b1.answers) === JSON.stringify(b0.answers) && !b1.side,
      `↩ 返回 after switching inside the side session: back on Exam 4 Q${sim + 1}, reveal / answers kept`);
    await expectTexts('back from side session', pg, ['Exam 4', '✓ 正確！', '相似題目']);
    ok(errs.length === 0 && !warns.some(x => x.includes('[i18n]')), 'practice / side session — no page errors / i18n warnings ' + errs.concat(warns).join('|'));
    await ctx.close();
  }
  // Result review filter + no double recording
  {
    const { ctx, pg, errs } = await fresh(b, 390);
    await nav(pg, '#modeExam'); await nav(pg, '#examGrid [data-arg="3"]');
    await tap(pg, '#opt0'); await tap(pg, '#nextBtn'); await tap(pg, '#opt1'); await tap(pg, '#navDots .dot:last-child'); await tap(pg, '#nextBtn'); await nav(pg, '#confirmOk');
    await tap(pg, '#reviewOrder [data-arg="wrong"]');
    const snap = () => pg.evaluate(() => JSON.stringify({ f: reviewFilter, items: [...document.querySelectorAll('#reviewList .review-item')].map(e => e.id), score: byId('resultScore').textContent,
      storage: Object.fromEntries(Object.keys(localStorage).filter(k => k !== 'lifeuk.uiLang').sort().map(k => [k, localStorage.getItem(k)])) }));
    const before = await snap();
    await pill(pg);
    const after = await snap();
    ok(after === before, `Result: review filter (wrong), list, score and storage (completedExams, wrongList) unchanged after the switch ${after === before ? '' : before + ' / ' + after}`);
    const active = await pg.$eval('#reviewOrder .active', e => e.textContent.trim());
    ok(/^錯誤 \d+$/.test(active), `Result: active filter chip reads 錯誤 + count (${active})`);
    await pill(pg); await pill(pg);
    ok(await snap() === before, 'Result: two more switches still record nothing');
    ok(errs.length === 0, 'result — no page errors ' + errs.join('|'));
    await ctx.close();
  }
  // Study: search / tab / chips / toggles
  {
    const { ctx, pg, errs } = await fresh(b, 390);
    await nav(pg, '#modeStudy'); await tap(pg, '#studyTabs [data-tab="geo"]'); await tap(pg, '#studySubChips .chip:nth-child(3)');
    await tap(pg, '#studyChips [data-action="studyToggle"]').catch(() => {});
    await pg.fill('#studySearch', 'castle'); await sleep(80);
    const snap = () => pg.evaluate(() => JSON.stringify({ study: { ...study }, v: byId('studySearch').value, ids: [...document.querySelectorAll('#studyContent .fact')].map(e => e.dataset.factId),
      active: [...document.querySelectorAll('#studyTabs .active, #studyChips .active, #studySubChips .active')].map(e => e.dataset.arg || e.dataset.tab) }));
    const before = await snap();
    await pill(pg);
    const after = await snap();
    ok(after === before, `Study: search text, tab, nation chip, toggles and the shown facts unchanged after the switch ${after === before ? '' : before + ' / ' + after}`);
    ok(/\d+ \/ \d+ 項知識點/.test(await pg.textContent('#studyCount')), `Study count in zh-HK (${await pg.textContent('#studyCount')})`);
    await pg.fill('#studySearch', ''); await sleep(80);
    await tap(pg, '#studyTabs [data-tab="chapters"]'); await tap(pg, '#studySubChips [data-arg="4"]');
    const b2 = await snap(); await pill(pg); ok(await snap() === b2, 'Study chapters › Ch 4: state unchanged after switching back to en');
    ok(errs.length === 0, 'study — no page errors ' + errs.join('|'));
    await ctx.close();
  }
  // Home: mode / tab, Flagged list
  {
    const { ctx, pg } = await fresh(b, 390, {}, APP_URL, { 'lifeuk.practiceFlags': { '3.4': true, '6.7': true } });
    await nav(pg, '#modePractice'); await tap(pg, '#ptabChapter');
    const s = () => pg.evaluate(() => JSON.stringify({ pendingMode, practiceView, my: byId('myReview').classList.contains('show'), prefs: localStorage.getItem('lifeuk.homePrefs') }));
    const h0 = await s(); await pill(pg); ok(await s() === h0, 'Home: practice mode + chapter tab + My Review kept');
    await nav(pg, '#tileFlagged');
    const f0 = await pg.$$eval('#flaggedList .flag-item', es => es.length); await pill(pg);
    ok(await pg.$$eval('#flaggedList .flag-item', es => es.length) === f0 && await screenId(pg) === 'screenFlagged', 'Flagged: list kept, stays on Flagged');
    await ctx.close();
  }
}

// ══════════ 5. edge cases ══════════
async function edges(b) {
  // rapid toggles
  {
    const { ctx, pg, errs, warns } = await fresh(b, 390);
    await nav(pg, '#modePractice'); await tap(pg, '#ptabExam'); await nav(pg, '#examGrid [data-arg="5"]'); await answer(pg, true);
    const before = await quizSnap(pg);
    await pg.dblclick('#langBtn'); await sleep(80);
    ok((await langNow(pg)).html === 'en' && (await langNow(pg)).ls === '"en"', 'E1 double click on the pill: two toggles → back to en (guard does not eat the 2nd click; view unchanged)');
    const c = await pg.$eval('#langBtn', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await pg.mouse.click(c.x, c.y, { clickCount: 1 }); await pg.mouse.click(c.x, c.y); await pg.mouse.click(c.x, c.y); await pg.mouse.click(c.x, c.y); await pg.mouse.click(c.x, c.y); await sleep(80);
    const l = await langNow(pg);
    ok(l.html === ZH && l.pill === 'EN' && l.ls === '"zh-HK"', `E1 five quick clicks → zh-HK, pill / storage consistent ${JSON.stringify(l)}`);
    ok(await quizSnap(pg) === before, 'E1 rapid toggles: quiz state unchanged');
    const t = await bodyText(pg); ok(t.includes('✓ 正確！') && !t.includes('Correct!'), 'E1 rapid toggles: screen fully in zh-HK, no mix');
    ok(errs.length === 0 && !warns.some(x => x.includes('[i18n]')), 'E1 — no page errors / i18n warnings ' + errs.concat(warns).join('|'));
    await ctx.close();
  }
  // toggle while the confirm modal is open: Tab stays in the modal (v0.69 S-025); a pill focused anyway does nothing
  // (R-002 guard); mouse lands on the backdrop
  {
    const { ctx, pg, errs } = await fresh(b, 390);
    await nav(pg, '#modeExam'); await nav(pg, '#examGrid [data-arg="1"]'); await tap(pg, '#opt0');
    await tap(pg, '#screenQuiz .back-btn');
    let escaped = false;
    for (let i = 0; i < 40 && !escaped; i++) { await pg.keyboard.press('Tab'); escaped = await pg.evaluate(() => !byId('confirmModal').contains(document.activeElement)); }
    ok(!escaped, 'E2 40 × Tab from the leave modal stays in the modal (S-025 focus trap; S-101)');
    await pg.focus('#langBtn'); // bypass the trap to check the R-002 guard still holds
    const mBefore = await pg.evaluate(() => ({ t: byId('confirmTitle').textContent, o: byId('confirmOk').textContent, open: isConfirmOpen() }));
    await pg.keyboard.press('Enter'); await sleep(60); await pg.keyboard.press('Space'); await sleep(60);
    const mAfter = await pg.evaluate(() => ({ t: byId('confirmTitle').textContent, o: byId('confirmOk').textContent, open: isConfirmOpen() }));
    const l = await langNow(pg);
    ok(l.html === 'en' && l.pill === '中' && l.ls === null && JSON.stringify(mAfter) === JSON.stringify(mBefore) && mAfter.open, `E2 Enter / Space on the pill with the modal open: nothing (lang en, modal open, text unchanged) ${JSON.stringify({ l, mAfter })}`);
    const top = await pg.evaluate(() => { const r = byId('langBtn').getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e.id || e.className; });
    await pg.mouse.click(...await pg.$eval('#langBtn', e => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })); await sleep(60);
    const m2 = await pg.evaluate(() => ({ open: isConfirmOpen(), scr: document.querySelector('.screen.active').id, timer: examTimerId !== null }));
    ok(top === 'confirmModal' && (await langNow(pg)).html === 'en' && !m2.open && m2.scr === 'screenQuiz' && m2.timer, `E2 mouse click at the pill with the modal open hits the backdrop (${top}): modal cancelled, stays in exam, lang unchanged ${JSON.stringify(m2)}`);
    // submit modal too
    await tap(pg, '#navDots .dot:last-child'); await tap(pg, '#nextBtn');
    await pg.focus('#langBtn'); await pg.keyboard.press('Enter'); await sleep(60);
    ok((await langNow(pg)).html === 'en' && await pg.evaluate(() => isConfirmOpen()), 'E2 submit modal open + Enter on focused pill: nothing');
    ok(errs.length === 0, 'E2 — no page errors ' + errs.join('|'));
    await ctx.close();
  }
  // toggle during time-up
  {
    const { ctx, pg, errs } = await fresh(b, 390);
    await nav(pg, '#modeExam'); await nav(pg, '#examGrid [data-arg="6"]'); await tap(pg, '#opt0');
    await pg.evaluate(() => { window.__finish = 0; const f = finishExam; finishExam = (...a) => { window.__finish++; return f(...a); }; examDeadline = Date.now() + 1500; });
    const c = await pg.$eval('#langBtn', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    for (let i = 0; i < 26; i++) { await pg.mouse.click(c.x, c.y); await sleep(100); }
    await sleep(1200);
    const r = await pg.evaluate(() => ({ n: window.__finish, scr: document.querySelector('.screen.active').id, up: !byId('resultTimeUp').hidden, upText: byId('resultTimeUp').textContent,
      completed: localStorage.getItem('lifeuk.completedExams'), timer: examTimerId, lang: document.documentElement.lang, items: reviewItems.length }));
    ok(r.n === 1 && r.scr === 'screenResult' && r.up && r.timer === null && r.items === 24, `E3 26 toggles across the deadline: finishExam once, results with the time-up banner, timer stopped ${JSON.stringify(r)}`);
    ok(r.completed === '{"6":true}', `E3 completedExams written once ({"6":true}) (${r.completed})`);
    const want = r.lang === ZH ? '⏱ 時間到，試卷已自動提交。' : "⏱ Time's up — your exam was submitted automatically.";
    ok(r.upText === want, `E3 time-up banner in the current language (${r.lang}: ${r.upText})`);
    await pill(pg);
    const r2 = await pg.evaluate(() => ({ up: !byId('resultTimeUp').hidden, t: byId('resultTimeUp').textContent, n: window.__finish }));
    ok(r2.up && r2.n === 1 && r2.t !== r.upText, `E3 switch on the time-up result: banner stays, re-translated, nothing re-finished (${r2.t})`);
    // deadline already passed but the tick has not run yet: the switch itself must not submit
    await nav(pg, '#screenResult .back-btn'); await nav(pg, '#modeExam'); await nav(pg, '#examGrid [data-arg="7"]');
    // finishExam is still wrapped from E3: only reset the counter
    const res = await pg.evaluate(async () => { window.__finish = 0;
      // wait right after a tick, then expire the deadline and switch via a real click from the test (below)
      const t0 = byId('examTimer').textContent; while (byId('examTimer').textContent === t0) await new Promise(r => setTimeout(r, 5)); examDeadline = Date.now() - 1; return true; });
    await pill(pg);
    const mid = await pg.evaluate(() => ({ n: window.__finish, scr: document.querySelector('.screen.active').id, timer: byId('examTimer').textContent }));
    await sleep(1200);
    const end = await pg.evaluate(() => ({ n: window.__finish, scr: document.querySelector('.screen.active').id }));
    ok(res && mid.n === 0 && mid.scr === 'screenQuiz' && mid.timer === '⏱ 00:00', `E3b deadline passed, switch before the tick: no submit from the switch, timer shows 00:00 ${JSON.stringify(mid)}`);
    ok(end.n === 1 && end.scr === 'screenResult', `E3b the next tick submits once ${JSON.stringify(end)}`);
    ok(errs.length === 0, 'E3 — no page errors ' + errs.join('|'));
    await ctx.close();
  }
  // localStorage blocked (SecurityError on access) and Safari-private style (setItem throws QuotaExceededError)
  for (const [tag, init] of [
    ['blocked (getter throws)', () => { Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('The operation is insecure.', 'SecurityError'); } }); }],
    ['private (setItem throws)', () => { Storage.prototype.setItem = function () { throw new DOMException('QuotaExceededError', 'QuotaExceededError'); }; }],
  ]) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); await ctx.addInitScript(init);
    const pg = await ctx.newPage(); const { errs } = watch(pg);
    await pg.goto(APP_URL); await sleep(150);
    const boot = await pg.evaluate(() => ({ scr: document.querySelector('.screen.active').id, desc: byId('modeDesc').textContent.length, pill: byId('langBtn').textContent, hidden: byId('langBtn').hidden }));
    ok(boot.scr === 'screenHome' && boot.desc > 20 && boot.pill === '中' && !boot.hidden, `E4 ${tag}: app boots in en, pill shown ${JSON.stringify(boot)}`);
    await pill(pg);
    ok((await pg.evaluate(() => document.documentElement.lang)) === ZH && (await pg.textContent('#langBtn')) === 'EN', `E4 ${tag}: pill switches to zh-HK (in memory)`);
    await nav(pg, '#modePractice'); await tap(pg, '#ptabExam'); await nav(pg, '#examGrid [data-arg="2"]'); await answer(pg, true);
    ok((await pg.textContent('#ansLabel')).includes('正確'), `E4 ${tag}: practice answer works in zh-HK`);
    await pill(pg); ok((await pg.textContent('#ansLabel')).includes('Correct'), `E4 ${tag}: switch back to en mid-practice`);
    await pill(pg);
    await nav(pg, '#screenQuiz .back-btn'); await nav(pg, '#modeStudy');
    ok(await screenId(pg) === 'screenStudy' && (await pg.textContent('#studyCount')).includes('項知識點'), `E4 ${tag}: Study opens in zh-HK`);
    await pg.reload(); await sleep(150);
    ok((await pg.evaluate(() => document.documentElement.lang)) === 'en', `E4 ${tag}: after reload back to en (nothing can be stored) — expected`);
    ok(errs.length === 0, `E4 ${tag}: no page errors ` + errs.join('|'));
    await ctx.close();
  }
  // stored garbage / unknown language
  {
    const { ctx, pg, errs } = await fresh(b, 390, {}, APP_URL, { 'lifeuk.uiLang': '"zh-TW"' });
    ok((await langNow(pg)).html === 'en' && (await pg.textContent('#langBtn')) === '中', 'E5 stored uiLang "zh-TW" → en, pill 中');
    await pill(pg); ok((await langNow(pg)).html === ZH, 'E5 pill from an unknown stored language → zh-HK');
    await pg.evaluate(() => localStorage.setItem('lifeuk.uiLang', '{not json')); await pg.reload();
    ok((await langNow(pg)).html === 'en', 'E5 corrupt uiLang JSON → en');
    ok(errs.length === 0, 'E5 — no page errors ' + errs.join('|'));
    await ctx.close();
  }
}

// ══════════ 6. W-014 lang attributes; M4 result line ══════════
async function langAttrs(b) {
  const { ctx, pg } = await fresh(b, 390, {}, APP_URL, { 'lifeuk.uiLang': ZH_SEED, 'lifeuk.practiceFlags': { '3.4': true } });
  const check = async (tag, specs) => {
    const res = await pg.evaluate(specs => specs.map(([sel, want]) => { const els = [...document.querySelectorAll(sel)];
      const bad = els.filter(e => { const l = e.closest('[lang]'); return l === document.documentElement || l.getAttribute('lang') !== want; }); return { sel, want, n: els.length, bad: bad.length }; }), specs);
    const bad = res.filter(r => !r.n || r.bad);
    ok(bad.length === 0, `W-014 ${tag}: ${specs.length} content selectors carry the right lang ${JSON.stringify(bad)}`);
  };
  const gaps = async (tag, specs) => {
    const res = await pg.evaluate(specs => specs.map(([sel, want]) => { const els = [...document.querySelectorAll(sel)];
      return { sel, want, n: els.length, untagged: els.filter(e => { const l = e.closest('[lang]'); return l === document.documentElement || l.getAttribute('lang') !== want; }).length }; }), specs);
    res.filter(r => r.n && r.untagged).forEach(r => note(`lang gap ${tag}: ${r.sel} → inherits <html lang="zh-HK">, should be ${r.want} (${r.untagged}/${r.n})`));
    return res;
  };
  await nav(pg, '#modePractice'); await tap(pg, '#ptabExam'); await nav(pg, '#examGrid [data-arg="4"]');
  const sim = await pg.evaluate(() => state.questions.findIndex(q => similarKeys(q).length > 0));
  await tap(pg, `#navDots .dot:nth-child(${sim + 1})`); await answer(pg, false);
  ok(await pg.evaluate(() => document.documentElement.lang) === ZH, 'W-014: checks run under <html lang="zh-HK">');
  await check('quiz', [['#qText', 'en'], ['#optionsContainer .opt-body > span:first-child', 'en'], ['#ansEn', 'en'], ['#qYue', ZH], ['#ansYue', ZH],
    ['#similarBox .sqm-q', 'en'], ['#similarBox .sqm-qy', ZH], ['#similarBox .sqm-fact-en', 'en'], ['#similarBox .sqm-fact-yue', ZH]]);
  // UI chrome must NOT be tagged en
  const chrome = await pg.evaluate(() => ['#qNum', '#nextBtn', '#ansLabel', '#quizLabel'].map(s => { const l = byId(s.slice(1)).closest('[lang]'); return l === document.documentElement; }));
  ok(chrome.every(Boolean), 'W-014: UI chrome (question number, Next, answer label, quiz label) inherits <html lang="zh-HK">');
  const g1 = await gaps('quiz', [['#ansNote > strong', ZH]]);
  await tap(pg, '#navDots .dot:last-child'); await answer(pg, true); await nav(pg, '#nextBtn');
  await check('result', [['.rv-q-text', 'en'], ['.rv-correct-ans', 'en'], ['.rv-yue', ZH], ['.rv-note-line', ZH]]);
  const g2 = await gaps('result', [['.rv-your > span', 'en']]);
  await nav(pg, '#screenResult .back-btn'); await nav(pg, '#tileFlagged');
  await check('flagged', [['.fi-q', 'en'], ['.fi-yue', ZH]]);
  await nav(pg, '#screenFlagged .back-btn'); await nav(pg, '#modeStudy'); await tap(pg, '#studyTabs [data-tab="chapters"]');
  await check('study', [['#studyContent .fact-en', 'en'], ['#studyContent .fact-yue', ZH]]);
  const g3 = await gaps('study chapters', [['#studyContent .study-group-title', 'en']]);
  await tap(pg, '#studyTabs [data-tab="timeline"]');
  const g4 = await gaps('study timeline', [['#studyContent .tl-year', 'en'], ['#studyContent .tag.person', 'en']]);
  await tap(pg, '#studyTabs [data-tab="people"]');
  await check('study people', [['#studyContent .fact-name', 'en']]);
  await nav(pg, '#screenStudy .back-btn'); await tap(pg, '#ptabChapter');
  const g5 = await gaps('home chapter grid', [['#chapterGrid .ch-name', 'en']]);
  const all = [...g1, ...g2, ...g3, ...g4, ...g5].filter(r => r.n && r.untagged);
  note(`W-014 remaining gaps (non-blocking, S-047 / S-048 / S-049 + person / year tags / chapter short names): ${all.map(r => r.sel).join(', ')}`);
  await ctx.close();

  // M4: zh-HK .result-sub at 320px one size down, no lone last character
  for (const w of [320, 360, 390]) {
    const { ctx: c2, pg: p2 } = await fresh(b, w, {}, APP_URL, { 'lifeuk.uiLang': ZH_SEED });
    await nav(p2, '#modeExam'); await nav(p2, '#examGrid [data-arg="1"]'); await tap(p2, '#navDots .dot:last-child'); await tap(p2, '#nextBtn'); await nav(p2, '#confirmOk');
    const m = await p2.evaluate(() => { const el = byId('resultSub'), tn = el.firstChild, lines = new Map();
      for (let i = 0; i < tn.length; i++) { const r = document.createRange(); r.setStart(tn, i); r.setEnd(tn, i + 1); const b = r.getClientRects()[0]; if (!b) continue; const k = Math.round(b.top); lines.set(k, (lines.get(k) || '') + tn.data[i]); }
      return { fs: getComputedStyle(el).fontSize, sm: getComputedStyle(document.documentElement).getPropertyValue('--fs-sm').trim(), lines: [...lines.values()], font: getComputedStyle(el).fontFamily }; });
    const last = m.lines[m.lines.length - 1];
    if (w <= 360) ok(m.fs === m.sm || m.fs === parseFloat(m.sm) + 'px', `M4 ${w}: .result-sub font-size = --fs-sm (${m.fs} / ${m.sm})`);
    ok(m.lines.length === 1 || last.replace(/[。，）]/g, '').length >= 2, `M4 ${w}: zh-HK pass line does not leave a lone last character ${JSON.stringify(m.lines)}`);
    await p2.screenshot({ path: shot(`zh-HK_m4-result-sub_${w}`), clip: await p2.$eval('.result-card', e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top + scrollY, width: r.width, height: Math.min(r.height, 260) }; }) }).catch(() => {});
    await c2.close();
  }
}

// ══════════ 7. offline + upgrade from v0.64 ══════════
async function offlineAndUpgrade(b) {
  // offline: SW cached zh-HK.js; go offline, reload, switch works
  {
    const { base, server } = await startPagesServer(ROOT);
    try {
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const pg = await ctx.newPage(); const { errs } = watch(pg);
      await pg.goto(base); await pg.evaluate(() => navigator.serviceWorker.ready);
      ok(await waitCache(pg, CUR_CACHE), `offline: SW cache ${CUR_CACHE} created`);
      await pg.reload(); await pg.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 10000 });
      await ctx.setOffline(true);
      await pg.reload();
      const off = await pg.evaluate(async () => ({ on: navigator.onLine, ctl: !!navigator.serviceWorker.controller, zh: typeof LOCALES['zh-HK'], pill: byId('langBtn').hidden }));
      ok(!off.on && off.ctl && off.zh === 'object' && !off.pill, `offline reload: page from SW, zh-HK locale loaded, pill shown ${JSON.stringify(off)}`);
      await pill(pg);
      ok((await langNow(pg)).html === ZH && (await pg.textContent('#modeDesc')).includes('練習'), 'offline: pill switches to zh-HK');
      await nav(pg, '#modeStudy'); ok((await pg.textContent('#studyCount')).includes('項知識點'), 'offline: Study in zh-HK');
      await pg.reload();
      ok((await langNow(pg)).html === ZH, 'offline: reload restores zh-HK from storage');
      // direct fetch of the locale offline
      const zhResp = await pg.evaluate(async () => { const r = await fetch('locales/zh-HK.js'); return r.ok; });
      ok(zhResp, 'offline: fetch locales/zh-HK.js served by the SW');
      ok(errs.filter(e => !/ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e)).length === 0, 'offline — no page errors ' + errs.join('|'));
      await ctx.close();
    } finally { server.kill(); }
  }
  // upgrade: a v0.64 install (old SW + cache) → deploy v0.65 → update → zh-HK works, progress kept, old cache gone
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifeuk-qa065-up-'));
    execSync(`git archive ${V064_REF} | tar -x -C "${dir}"`, { cwd: ROOT, shell: '/bin/bash' });
    const { base, server } = await startPagesServer(dir);
    try {
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const pg = await ctx.newPage(); const { errs } = watch(pg);
      await pg.goto(base); await pg.evaluate(() => navigator.serviceWorker.ready);
      ok(await waitCache(pg, 'lifeuk-v0.64'), 'upgrade: v0.64 SW cache created');
      await pg.reload();
      const v64 = await pg.evaluate(() => ({ v: APP_VERSION, pill: !!document.getElementById('langBtn') }));
      ok(v64.v === '0.64' && !v64.pill, `upgrade: v0.64 installed and controlling (no pill) ${JSON.stringify(v64)}`);
      await pg.evaluate(() => { localStorage.setItem('lifeuk.practiceStreak', '{"1.0":3,"2.1":1}'); localStorage.setItem('lifeuk.practiceFlags', '{"3.4":true}'); localStorage.setItem('lifeuk.completedExams', '{"1":true}'); });
      const before = await pg.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
      // deploy the current version over the same folder
      fs.readdirSync(dir).forEach(f => fs.rmSync(path.join(dir, f), { recursive: true, force: true }));
      appFiles(ROOT).forEach(f => fs.cpSync(path.join(ROOT, f), path.join(dir, f), { recursive: true }));
      await pg.reload(); // still v0.64 from the old cache; registration update check fetches the new sw.js
      const mixed = await pg.evaluate(() => APP_VERSION);
      await waitUpgrade(pg, CUR_CACHE);
      const keys = await pg.evaluate(() => caches.keys());
      ok(keys.length === 1 && keys[0] === CUR_CACHE, `upgrade: new SW activated, cache ${CUR_CACHE} only, v0.64 cache deleted (${keys}; page before reload v${mixed})`);
      await pg.reload();
      const v65 = await pg.evaluate(() => ({ v: APP_VERSION, pill: !!byId('langBtn') && !byId('langBtn').hidden, zh: typeof LOCALES['zh-HK'] }));
      ok(v65.v === CUR_VERSION && v65.pill && v65.zh === 'object', `upgrade: after reload v${CUR_VERSION} with the pill and zh-HK locale ${JSON.stringify(v65)}`);
      await pill(pg);
      ok((await langNow(pg)).html === ZH, 'upgrade: pill switches to zh-HK');
      await nav(pg, '#modePractice');
      const fl = (await myReviewTiles(pg)).tileFlagged;
      ok(fl.num === '1' && fl.title === '已標記', `upgrade: progress shows in zh-HK (My Review flagged 1) ${JSON.stringify(fl)}`);
      const after = await pg.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k !== 'lifeuk.uiLang').sort().map(k => [k, localStorage.getItem(k)])));
      const keep = ['lifeuk.practiceStreak', 'lifeuk.practiceFlags', 'lifeuk.completedExams'];
      ok(keep.every(k => after[k] === before[k]), `upgrade: progress keys byte-identical (${keep.map(k => after[k]).join(' ')})`);
      ok(errs.length === 0, 'upgrade — no page errors ' + errs.join('|'));
      await ctx.close();
    } finally { server.kill(); fs.rmSync(dir, { recursive: true, force: true }); }
  }
}

// ══════════ 8. screenshots zh-HK 390 + 320 ══════════
async function shots(b) {
  const SEED = { 'lifeuk.uiLang': ZH_SEED, 'lifeuk.wrongList': { '1.0': true, '1.1': true, '2.3': true }, 'lifeuk.practiceFlags': { '3.4': true, '6.7': true } };
  const flows = {
    'home-practice': async pg => { await nav(pg, '#modePractice'); },
    'home-practice-exam': async pg => { await nav(pg, '#modePractice'); await tap(pg, '#ptabExam'); },
    'home-exam': async pg => { await nav(pg, '#modeExam'); },
    'info-popover': async pg => { await tap(pg, '#infoBtn'); },
    'quiz-practice-revealed': async pg => { await nav(pg, '#modePractice'); await tap(pg, '#ptabExam'); await nav(pg, '#examGrid [data-arg="4"]');
      const sim = await pg.evaluate(() => state.questions.findIndex(q => similarKeys(q).length > 0)); await tap(pg, `#navDots .dot:nth-child(${sim + 1})`); await answer(pg, false); },
    'similar-panel': async pg => { await flows['quiz-practice-revealed'](pg); await pg.$eval('#similarBox', e => e.scrollIntoView()); },
    'quiz-exam': async pg => { await nav(pg, '#modeExam'); await nav(pg, '#examGrid [data-arg="1"]'); await tap(pg, '#opt0'); await tap(pg, '#flagBtn'); },
    'modal-submit': async pg => { await flows['quiz-exam'](pg); await tap(pg, '#navDots .dot:last-child'); await tap(pg, '#nextBtn'); },
    'result-exam': async pg => { await flows['modal-submit'](pg); await nav(pg, '#confirmOk'); },
    'result-review': async pg => { await flows['result-exam'](pg); await pg.$eval('#reviewOrder', e => e.scrollIntoView()); },
    flagged: async pg => { await nav(pg, '#modePractice'); await nav(pg, '#tileFlagged'); },
    'study-chapters': async pg => { await nav(pg, '#modeStudy'); },
    'study-timeline': async pg => { await nav(pg, '#modeStudy'); await tap(pg, '#studyTabs [data-tab="timeline"]'); },
    'study-geo': async pg => { await nav(pg, '#modeStudy'); await tap(pg, '#studyTabs [data-tab="geo"]'); },
    'study-people': async pg => { await nav(pg, '#modeStudy'); await tap(pg, '#studyTabs [data-tab="people"]'); },
  };
  for (const w of [390, 320]) {
    for (const [name, fn] of Object.entries(flows)) {
      const { ctx, pg } = await fresh(b, w, { deviceScaleFactor: 2 }, APP_URL, SEED);
      await fn(pg); await sleep(120);
      await pg.screenshot({ path: shot(`zh-HK_${name}_${w}`) });
      await ctx.close();
    }
  }
  // the pill itself, en and zh-HK, header crop
  const { ctx, pg } = await fresh(b, 390, { deviceScaleFactor: 2 });
  await pg.screenshot({ path: shot('header-pill-en_390'), clip: { x: 0, y: 0, width: 390, height: 64 } });
  await pill(pg); await pg.mouse.move(5, 400);
  await pg.screenshot({ path: shot('header-pill-zh-HK_390'), clip: { x: 0, y: 0, width: 390, height: 64 } });
  await ctx.close();
}

(async () => {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const b = await chromium.launch(launchOpts);
  const sections = { versionCheck, pillCheck, glossary, stateKeep, edges, langAttrs, offlineAndUpgrade, shots };
  const only = process.env.QA_ONLY ? process.env.QA_ONLY.split(',') : Object.keys(sections);
  try {
    for (const k of only) {
      console.log(`\n── ${k} ──`);
      try { await sections[k](b); } catch (e) { fail++; failures.push(`${k} threw ${e.message.split('\n')[0]}`); console.log(`FAIL: ${k} threw`, e); }
    }
  } finally { await b.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  if (failures.length) console.log('failures:\n - ' + failures.join('\n - '));
  process.exit(fail ? 1 : 0);
})();
