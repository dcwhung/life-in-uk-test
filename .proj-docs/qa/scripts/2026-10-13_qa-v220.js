// QA v2.2.0 — content release: all 61 memory hooks (記憶鈎) in data/memo.js replaced with the user-reviewed final text.
// Source of truth: .claude/artifacts/hook-review/final-hooks.json (read-only; "\n" = a line break in the hook box).
//   D  data: data/memo.js hooks === final-hooks.json for all 61 titled groups, 'single' has ''
//   H  hook matrix, real clicks (Home → Study → 🧠 → group card → 睇 view → ‹ back): 61 + single groups ×
//      320×568 / 390×844 / 1280×800 × en / zh-HK × small / large text = 12 contexts. Per group: rendered hook text ===
//      approved text (line breaks kept), line boxes ≥ hook lines, hook box inside the viewport, no clipping, no page
//      h-scroll, hook box above the note / table panel, desktop: the start button still on screen; single: no hook box
//   T  spot checks at 390 / 1280: dark colour scheme (app has no dark theme: unchanged, readable), translation off
//   L  group list: 2 columns at 320 / 390, 3 columns at 1280; cards not clipped
//   F  memo test flow (open → test → result → Next → next group) on nation-symbols (3-line hook), uk-festivals, single
//   U  SW upgrade v2.1.1 (main 7145c96) → v2.2.0: cache lifeuk-v2.2.0, new data/memo.js, new hooks shown, offline
//   NODE_PATH=/opt/node-tools/node_modules CHROMIUM_PATH=/opt/pw-browsers/chromium node 2026-10-13_qa-v220.js [D H T L F U]
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '../../..');
const { startPagesServer, appFiles } = require(path.join(ROOT, 'tests/pages-server.js'));
const SHOTS = path.join(__dirname, '../screenshots/v220');
fs.mkdirSync(SHOTS, { recursive: true });
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const ONLY = process.argv.slice(2);
const want = s => !ONLY.length || ONLY.includes(s);
const OLD_REV = '7145c96'; // main v2.1.1
const FINAL = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude/artifacts/hook-review/final-hooks.json'), 'utf8'));
const GUARD = 450;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const res = [], findings = [], obs = [];
const log = (ok, id, m, extra) => {
  res.push({ ok, id, m });
  if (!ok) findings.push(id + ' ' + m + (extra !== undefined ? ' ' + JSON.stringify(extra).slice(0, 1500) : ''));
  console.log((ok ? 'ok   ' : 'FAIL ') + id + ' ' + m + (extra !== undefined && !ok ? ' ' + JSON.stringify(extra).slice(0, 900) : ''));
};
const note = (id, m) => { obs.push(id + ' ' + m); console.log('note ' + id + ' ' + m); };
const VPS = [{ width: 320, height: 568, touch: true }, { width: 390, height: 844, touch: true }, { width: 1280, height: 800, touch: false }];
let browser, head;

async function newPage(base, { width, height, touch, lang = 'en', font = 'small', trans = 'on', scheme = 'light', sw = 'block' }) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: touch, hasTouch: touch, deviceScaleFactor: touch ? 2 : 1,
    timezoneId: 'Europe/London', serviceWorkers: sw, colorScheme: scheme });
  const pg = await ctx.newPage();
  pg.errs = [];
  pg.on('pageerror', e => pg.errs.push(e.message));
  pg.on('console', m => { if (m.type() === 'error' || /\[i18n\] missing key/.test(m.text())) pg.errs.push(m.text()); });
  await pg.goto(base + 'index.html');
  await pg.evaluate(([l, f, t]) => {
    localStorage.clear();
    localStorage.setItem('lifeuk.uiLang', JSON.stringify(l));
    localStorage.setItem('lifeuk.fontSize', JSON.stringify(f));
    localStorage.setItem('lifeuk.installDismissed', 'true');
    if (t === 'off') localStorage.setItem('lifeuk.translation', JSON.stringify('off'));
  }, [lang, font, trans]);
  await pg.reload();
  await pg.waitForSelector('#screenHome.active');
  await pg.evaluate(() => document.fonts.ready);
  Object.assign(pg, { ctx, touch, tag: `${width}/${lang}/${font}${trans === 'off' ? '/trans-off' : ''}${scheme === 'dark' ? '/dark' : ''}` });
  return pg;
}
const hit = async (pg, sel) => {
  await pg.evaluate(() => { if (typeof clickGuard !== 'undefined') clickGuard = null; });
  const l = pg.locator(`${sel} >> visible=true`).first();
  await l.scrollIntoViewIfNeeded();
  if (pg.touch) await l.tap(); else await l.click();
  await sleep(150);
};
const active = pg => pg.evaluate(() => document.querySelector('.screen.active').id);
async function toMemoList(pg) {
  if (await active(pg) === 'screenMemo') { await hit(pg, '#screenMemo .memo-back'); await sleep(GUARD); }
  if (await active(pg) !== 'screenStudy') { await hit(pg, '#modeStudy'); await sleep(GUARD); }
  if (!(await pg.$('#studyContent .memo-card'))) { await hit(pg, '.study-tab[data-tab="memo"]'); await sleep(200); }
}
async function openGroup(pg, id) {
  await toMemoList(pg);
  await hit(pg, `#studyContent .memo-card[data-arg="${id}"]`);
  await sleep(GUARD);
}
// the look view's hook box, measured
const hookState = pg => pg.evaluate(() => {
  const scr = byId('screenMemo');
  const W = innerWidth, H = innerHeight;
  const box = scr.querySelector('#memoBody .memo-hook');
  const panel = scr.querySelector('#memoBody .memo-panel');
  const table = scr.querySelector('#memoBody .memo-panel table');
  const start = scr.querySelector('#memoBody .memo-start');
  const out = { active: document.querySelector('.screen.active').id, hscroll: document.scrollingElement.scrollWidth > W + 0.5, hasBox: !!box };
  if (!box) return out;
  const span = box.querySelector('span'), label = box.querySelector('b');
  const r = box.getBoundingClientRect();
  // line boxes of the hook text
  const rg = document.createRange(); rg.selectNodeContents(span);
  const tops = new Set([...rg.getClientRects()].filter(x => x.width > 0).map(x => Math.round(x.top)));
  const spanR = span.getBoundingClientRect();
  // an ancestor clipping the box (overflow hidden / auto) cuts it?
  let clippedBy = null;
  for (let e = box.parentElement; e && e !== document.body; e = e.parentElement) {
    const cs = getComputedStyle(e);
    if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
      const pr = e.getBoundingClientRect();
      if (r.left < pr.left - 0.5 || r.right > pr.right + 0.5 || (cs.overflowY === 'hidden' && (r.top < pr.top - 0.5 || r.bottom > pr.bottom + 0.5))) { clippedBy = e.id || e.className; break; }
    }
  }
  const cs = getComputedStyle(box);
  return Object.assign(out, {
    text: span.innerText, label: label.textContent, spanLang: span.getAttribute('lang'), lines: tops.size,
    left: r.left, right: r.right, top: r.top + scrollY, bottom: r.bottom + scrollY, vTop: r.top, vBottom: r.bottom, W, H,
    spanOverflow: span.scrollWidth > span.clientWidth + 1 || spanR.right > r.right + 0.5,
    boxOverflow: box.scrollWidth > box.clientWidth + 1 || box.scrollHeight > box.clientHeight + 1,
    clippedBy, panelTop: panel ? panel.getBoundingClientRect().top + scrollY : null, tableTop: table ? table.getBoundingClientRect().top + scrollY : null,
    firstChild: scr.querySelector('#memoBody').firstElementChild.className,
    startBottom: start ? start.getBoundingClientRect().bottom : null, isFit: scr.classList.contains('is-fit') && W >= 1024,
    bg: cs.backgroundColor, color: getComputedStyle(span).color, display: cs.display, visibility: cs.visibility,
  });
});
const hookOk = (s, want) => s.hasBox && s.text === want && s.lines >= want.split('\n').length && s.left >= -0.5 && s.right <= s.W + 0.5
  && !s.spanOverflow && !s.boxOverflow && !s.clippedBy && !s.hscroll && s.firstChild === 'memo-hook'
  && s.panelTop !== null && s.bottom <= s.panelTop + 0.5 && (s.tableTop === null || s.bottom <= s.tableTop)
  && s.display !== 'none' && s.visibility === 'visible' && (!s.isFit || (s.startBottom <= s.H + 0.5 && s.vTop >= 0 && s.vBottom <= s.H + 0.5));

// ════════════════ D: data ════════════════
function sectionD() {
  const src = fs.readFileSync(path.join(ROOT, 'data/memo.js'), 'utf8');
  const MEMO = new Function(src + '; return MEMO_GROUPS;')();
  const titled = MEMO.filter(g => g.id !== 'single');
  const diffs = titled.filter(g => FINAL[g.id] !== g.hook).map(g => g.id);
  const extra = Object.keys(FINAL).filter(k => !titled.some(g => g.id === k));
  log(titled.length === 61 && Object.keys(FINAL).length === 61 && !diffs.length && !extra.length, 'D', `data/memo.js: 61 titled groups, each hook === final-hooks.json (diffs ${diffs.length}, ids not in data ${extra.length})`, { diffs, extra });
  const single = MEMO.find(g => g.id === 'single');
  log(single && single.hook === '' && MEMO[MEMO.length - 1].id === 'single', 'D', `'single' is last with hook ''`);
  const lines = titled.map(g => g.hook.split('\n').length);
  note('D', `hook lines: 1-line ${lines.filter(n => n === 1).length}, 2-line ${lines.filter(n => n === 2).length}, 3-line ${lines.filter(n => n === 3).length} (${titled.filter(g => g.hook.split('\n').length === 3).map(g => g.id)})`);
  const longest = titled.slice().sort((a, b) => b.hook.length - a.hook.length)[0];
  note('D', `longest hook: ${longest.id} (${longest.hook.length} chars)`);
  return MEMO;
}

// ════════════════ H: hook matrix ════════════════
async function sectionH(MEMO) {
  const SHOT_SET = new Set(['320/zh-HK/large:nation-symbols', '390/en/small:nation-symbols', '1280/zh-HK/large:nation-symbols', '320/en/large:art', '1280/en/small:single']);
  const longest = MEMO.filter(g => g.hook).sort((a, b) => b.hook.length - a.hook.length)[0].id;
  SHOT_SET.add(`320/zh-HK/large:${longest}`);
  for (const vp of VPS) for (const lang of ['en', 'zh-HK']) for (const font of ['small', 'large']) {
    const pg = await newPage(head.base, { ...vp, lang, font });
    const bad = [];
    let checked = 0, maxH = 0, maxId = '';
    const label = lang === 'en' ? '💡 Memory hook:' : '💡 記憶鈎：';
    for (const g of MEMO) {
      await openGroup(pg, g.id);
      const s = await hookState(pg);
      if (g.id === 'single') {
        if (s.active !== 'screenMemo' || s.hasBox || s.hscroll) bad.push({ id: g.id, s });
      } else {
        const ok = s.active === 'screenMemo' && hookOk(s, g.hook) && s.label === label && s.spanLang === 'zh-HK';
        if (!ok) bad.push({ id: g.id, s });
        if (s.bottom - s.top > maxH) { maxH = s.bottom - s.top; maxId = g.id; }
      }
      checked++;
      const key = `${vp.width}/${lang}/${font}:${g.id}`;
      if (SHOT_SET.has(key)) {
        await pg.evaluate(() => window.scrollTo(0, 0));
        await pg.screenshot({ path: path.join(SHOTS, `H-${vp.width}-${lang}-${font}-${g.id}.png`) });
      }
    }
    log(!bad.length && checked === 62, 'H', `${pg.tag}: ${checked} groups opened by tap/click; 61 hook boxes show the approved text, line breaks kept, inside viewport, not clipped, no h-scroll, above the note/table${vp.width >= 1024 ? ', start button on screen' : ''}; single: no hook box (tallest hook ${maxId} ${Math.round(maxH)}px)`, bad.slice(0, 4));
    log(!pg.errs.length, 'H', `${pg.tag}: no page errors / missing keys`, pg.errs.slice(0, 5));
    await pg.ctx.close();
  }
}

// ════════════════ T: dark / translation off ════════════════
async function sectionT() {
  const ids = ['nation-symbols', 'uk-festivals', 'patron-saints', 'ministers'];
  let ref = {};
  for (const vp of [VPS[1], VPS[2]]) for (const v of [{ scheme: 'light' }, { scheme: 'dark' }, { trans: 'off' }, { trans: 'off', lang: 'zh-HK', scheme: 'dark' }]) {
    const pg = await newPage(head.base, { ...vp, ...v });
    const bad = [];
    for (const id of ids) {
      await openGroup(pg, id);
      const s = await hookState(pg);
      if (!hookOk(s, FINAL[id])) bad.push({ id, s });
      const k = vp.width + id;
      if (!v.scheme || v.scheme === 'light') { if (!v.trans) ref[k] = s.bg + s.color; }
      else if (ref[k] && ref[k] !== s.bg + s.color) bad.push({ id, colours: s.bg + ' / ' + s.color, light: ref[k] });
    }
    if (v.trans === 'off' && vp.width === 390) await pg.screenshot({ path: path.join(SHOTS, `T-390-${v.lang || 'en'}-transoff-${v.scheme || 'light'}-ministers.png`) });
    log(!bad.length && !pg.errs.length, 'T', `${pg.tag}: ${ids.join(', ')} hook boxes exact + laid out${v.scheme === 'dark' ? ', colours same as light (no dark theme in the app)' : ''}${v.trans ? ', translation off keeps the hook' : ''}`, { bad: bad.slice(0, 3), errs: pg.errs });
    await pg.ctx.close();
  }
}

// ════════════════ L: group list columns ════════════════
async function sectionL() {
  for (const vp of VPS) for (const font of ['small', 'large']) {
    const pg = await newPage(head.base, { ...vp, lang: 'zh-HK', font });
    await toMemoList(pg);
    const l = await pg.evaluate(() => {
      const cards = [...document.querySelectorAll('#studyContent .memo-card')];
      const lefts = new Set(cards.map(c => Math.round(c.getBoundingClientRect().left)));
      const clipped = cards.filter(c => c.scrollWidth > c.clientWidth + 1 || c.getBoundingClientRect().right > innerWidth + 0.5).map(c => c.dataset.arg);
      const overlap = cards.filter(c => {
        const a = c.querySelector('.memo-name').getBoundingClientRect(), b = c.querySelector('.memo-badge').getBoundingClientRect();
        return a.right > b.left + 0.5 && a.top < b.bottom && b.top < a.bottom;
      }).map(c => c.dataset.arg);
      return { n: cards.length, cols: lefts.size, clipped, overlap, hscroll: document.scrollingElement.scrollWidth > innerWidth + 0.5,
        cols2: getComputedStyle(document.querySelector('.memo-grid')).gridTemplateColumns.split(' ').length };
    });
    const want = vp.width >= 1024 ? 3 : 2;
    log(l.n === 62 && l.cols === want && l.cols2 === want && !l.clipped.length && !l.overlap.length && !l.hscroll, 'L', `${pg.tag}: group list ${l.n} cards in ${l.cols} columns (want ${want}), none clipped / overlapping, no h-scroll`, l);
    if (font === 'small' && vp.width !== 320) await pg.screenshot({ path: path.join(SHOTS, `L-${vp.width}-zh-HK-list.png`) });
    // the list search also matches the hook (memo.js memoMatches: title + body + hook): new hook-only words find their group
    if (font === 'small') {
      const S = [['Shamrock', 'nation-symbols'], ['GE23', 'patron-saints'], ['Hogmanay', 'uk-festivals']];
      const bad = [];
      for (const [q, id] of S) {
        await pg.fill('#studySearch', q); await sleep(250);
        const ids = await pg.$$eval('#studyContent .memo-card', els => els.map(e => e.dataset.arg));
        const want = await pg.evaluate(q => memoGroups().filter(g => [g.title, g.body || '', g.hook].join(' ').toLowerCase().includes(q.toLowerCase())).map(g => g.id), q);
        if (!ids.includes(id) || JSON.stringify(ids.slice().sort()) !== JSON.stringify(want.slice().sort())) bad.push({ q, ids, want });
      }
      await pg.fill('#studySearch', '');
      log(!bad.length, 'L', `${pg.tag}: search by hook-only words (Shamrock / GE23 / Hogmanay) lists the matching groups`, bad);
    }
    await pg.ctx.close();
  }
}

// ════════════════ F: test flow ════════════════
async function answer(pg, right) {
  const picks = await pg.evaluate(right => {
    const q = state.questions[state.current];
    return right ? q.a : q.o.map((_, i) => i).filter(i => !q.a.includes(i)).slice(0, q.a.length);
  }, right);
  for (const i of picks) await hit(pg, `#opt${i}`);
}
async function runTest(pg, right) {
  await hit(pg, '#memoBody .memo-start');
  await sleep(GUARD);
  const n = await pg.evaluate(() => state.questions.length);
  for (let i = 0; i < n; i++) {
    await answer(pg, right);
    await hit(pg, (await pg.isVisible('#nextBtn')) ? '#nextBtn' : '#quickNext');
    await sleep(i === n - 1 ? GUARD : 80);
  }
  return n;
}
async function sectionF() {
  for (const vp of [VPS[0], VPS[1], VPS[2]]) for (const lang of ['en', 'zh-HK']) {
    if (vp.width === 320 && lang === 'en') continue;
    const pg = await newPage(head.base, { ...vp, lang });
    for (const [id, right] of [['nation-symbols', true], ['uk-festivals', false], ['single', true]]) {
      await openGroup(pg, id);
      const s0 = await hookState(pg);
      const n = await runTest(pg, right);
      const r = await pg.evaluate(() => ({ a: document.querySelector('.screen.active').id, step: memoView.step, id: memoView.id,
        passed: memoView.result && memoView.result.passed, next: !!document.querySelector('#memoBody .memo-next'),
        stored: JSON.parse(localStorage.getItem('lifeuk.memoProgress') || '{}') }));
      const lv = r.stored[id] && r.stored[id].lv;
      log(r.a === 'screenMemo' && r.step === 'result' && r.id === id && r.passed === right && (id === 'single' ? !s0.hasBox : hookOk(s0, FINAL[id])),
        'F', `${pg.tag} ${id}: look (hook ${id === 'single' ? 'none' : 'ok'}) → test ${n} q ${right ? 'all right' : 'all wrong'} → result ${right ? 'pass' : 'fail'} (stored lv ${lv})`, { r, s0: { hasBox: s0.hasBox, text: s0.text } });
      if (id === 'nation-symbols' && vp.width === 390 && lang === 'zh-HK') await pg.screenshot({ path: path.join(SHOTS, 'F-390-zh-HK-nation-symbols-result.png') });
      // Next → the next group's look view, with its own hook
      const nextBtn = await pg.$('#memoBody .memo-next');
      if (id !== 'single' && nextBtn) {
        await hit(pg, '#memoBody .memo-next');
        await sleep(GUARD);
        const nx = await pg.evaluate(() => ({ id: memoView.id, step: memoView.step, a: document.querySelector('.screen.active').id }));
        const s1 = nx.a === 'screenMemo' ? await hookState(pg) : {};
        const g = await pg.evaluate(id => memoGroupById(id), nx.id);
        const okNext = nx.a === 'screenMemo' && nx.step === 'look' && nx.id !== id && (g.hook ? hookOk(s1, FINAL[nx.id]) : !s1.hasBox);
        log(okNext, 'F', `${pg.tag} ${id}: Next → ${nx.id} look view, its hook shown exactly`, { nx, text: s1.text });
      }
    }
    log(!pg.errs.length, 'F', `${pg.tag}: no page errors`, pg.errs);
    await pg.ctx.close();
  }
}

// ════════════════ U: SW upgrade v2.1.1 → v2.2.0 ════════════════
function copyApp(fromRoot, dest) { for (const f of appFiles(fromRoot)) execSync(`cp -r "${path.join(fromRoot, f)}" "${dest}/"`); }
async function sectionU(oldDir) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qa220-'));
  const site = path.join(tmp, 'site');
  fs.mkdirSync(site);
  const s = await startPagesServer(site);
  try {
    for (const vp of [VPS[1], VPS[2]]) {
      const tag = `${vp.width}`;
      execSync(`rm -rf "${site}"/*`);
      copyApp(oldDir, site);
      const pg = await newPage(s.base, { ...vp, lang: 'zh-HK', sw: 'allow' });
      await pg.evaluate(() => navigator.serviceWorker.ready);
      await pg.reload(); await sleep(700);
      const v0 = await pg.evaluate(async () => ({ v: APP_VERSION, ctrl: !!navigator.serviceWorker.controller, caches: await caches.keys() }));
      await openGroup(pg, 'uk-festivals');
      const old = await hookState(pg);
      await openGroup(pg, 'ministers');
      const oldMin = await hookState(pg);
      log(v0.v === '2.1.1' && v0.ctrl && JSON.stringify(v0.caches) === '["lifeuk-v2.1.1"]' && old.text !== FINAL['uk-festivals'] && !oldMin.hasBox, 'U',
        `${tag}: v2.1.1 (main ${OLD_REV}) installed + SW controlling, old uk-festivals hook shown, ministers has no hook`, { v0, old: old.text, min: oldMin.hasBox });
      execSync(`rm -rf "${site}"/*`);
      copyApp(ROOT, site);
      let v = null;
      for (let k = 0; k < 12; k++) {
        await pg.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r && r.update())).catch(() => {});
        await sleep(1200);
        await pg.reload().catch(() => {}); await sleep(800);
        v = await pg.evaluate(() => typeof APP_VERSION !== 'undefined' ? APP_VERSION : null).catch(() => null);
        if (v === '2.2.0') break;
      }
      const keys = await pg.evaluate(() => caches.keys());
      log(v === '2.2.0' && JSON.stringify(keys) === '["lifeuk-v2.2.0"]', 'U', `${tag}: upgrade → APP_VERSION ${v}, caches ${keys}`, { v, keys });
      const cached = await pg.evaluate(async () => {
        const c = await caches.open('lifeuk-v2.2.0');
        const sw = await (await fetch('sw.js')).text();
        const shell = [...sw.match(/const SHELL = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
        const missing = [];
        for (const f of shell) if (!(await c.match(f))) missing.push(f);
        const memo = await (await c.match('data/memo.js')).text();
        return { n: shell.length, missing, memoInShell: shell.includes('data/memo.js'), nIreland: memo.includes('N. Ireland Shamrock'), noEmpty: (memo.match(/hook: ''/g) || []).length };
      });
      log(!cached.missing.length && cached.memoInShell && cached.nIreland && cached.noEmpty === 1, 'U', `${tag}: lifeuk-v2.2.0 holds all ${cached.n} SHELL files; its data/memo.js is the new one (1 empty hook = single)`, cached);
      await pg.reload(); await sleep(500);
      const prog = [];
      for (const id of ['uk-festivals', 'ministers', 'nation-symbols']) { await openGroup(pg, id); const h = await hookState(pg); if (!hookOk(h, FINAL[id])) prog.push({ id, text: h.text }); }
      log(!prog.length, 'U', `${tag}: after upgrade online — uk-festivals / ministers / nation-symbols show the new hooks`, prog);
      await pg.ctx.setOffline(true);
      await pg.reload(); await sleep(800);
      const off = await pg.evaluate(() => APP_VERSION);
      const offBad = [];
      for (const id of ['uk-festivals', 'ministers', 'nation-symbols', 'jury']) { await openGroup(pg, id); const h = await hookState(pg); if (!hookOk(h, FINAL[id])) offBad.push({ id, text: h.text }); }
      await openGroup(pg, 'nation-symbols');
      if (vp.width === 390) await pg.screenshot({ path: path.join(SHOTS, 'U-390-zh-HK-offline-v220-nation-symbols.png') });
      const n = await runTest(pg, true);
      const rr = await pg.evaluate(() => ({ step: memoView.step, passed: memoView.result && memoView.result.passed }));
      log(off === '2.2.0' && !offBad.length && rr.step === 'result' && rr.passed, 'U', `${tag}: offline reload — v2.2.0 from cache, 4 new hooks shown, a memo test (${n} q) runs to the result`, { off, offBad, rr });
      log(!pg.errs.length, 'U', `${tag}: SW upgrade + offline: no page errors`, pg.errs);
      await pg.ctx.close();
    }
  } finally {
    s.server.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

(async () => {
  const MEMO = sectionD();
  browser = await chromium.launch(launchOpts);
  head = await startPagesServer(ROOT);
  const old = fs.mkdtempSync(path.join(os.tmpdir(), 'qa220-old-'));
  fs.rmdirSync(old);
  try {
    if (want('H')) await sectionH(MEMO);
    if (want('T')) await sectionT();
    if (want('L')) await sectionL();
    if (want('F')) await sectionF();
    if (want('U')) {
      execSync(`git -C "${ROOT}" worktree add --detach "${old}" ${OLD_REV} -q`);
      try { await sectionU(old); } finally { execSync(`git -C "${ROOT}" worktree remove --force "${old}"`); }
    }
  } catch (e) { log(false, 'X', 'crash: ' + e.stack); }
  head.server.kill();
  await browser.close();
  const pass = res.filter(r => r.ok).length;
  console.log(`\n${pass}/${res.length} checks passed`);
  if (obs.length) console.log('Notes:\n' + obs.join('\n'));
  if (findings.length) console.log('Findings:\n' + findings.join('\n'));
  console.log(findings.length ? 'FAIL' : 'PASS');
  process.exit(findings.length ? 1 : 0);
})();
