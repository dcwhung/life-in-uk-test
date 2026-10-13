// QA v2.4.1 — branch claude/charming-archimedes-hrh4wd = memo-hook branch (61 zh hooks + 61 hookEn, CUI-0044 memoHookNoBreak,
// S-271 searchText) merged with main v2.4.0 (e5d4641, PRs #117–#123). Sources of truth (read-only):
//   .claude/artifacts/hook-review/final-hooks.json (zh, 61) and .claude/artifacts/hook-review-en/final-hooks-en.json (en, 61)
//   D  data: hook / hookEn === the two JSONs, single '' / ''
//   H  look-view matrix: 62 groups × 320×568 / 375×667 / 390×844 / 1280×800 × en / zh-HK × small / large (16 contexts):
//      rendered hook (NBSP → space, U+2060 dropped) === approved text for the UI language, line boxes ≥ hook lines, label,
//      lang; every token (N. Ireland / AD n / n BC / ranges / number + CJK unit) on one line; no overflow / clip / h-scroll;
//      placement (phone: steps → hook → panel; desktop: first child of the left 7/12 column, top of the columns);
//      single: no hook box; ≥ 375 one screen high (is-fit-phone / is-fit, no page scroll, start on screen);
//      320: one screen high or the scrolling fallback with every control (back, start, questions fold) reachable by tap point
//   F  memo test flows en + zh (real taps): list → card → look → start → answer (all right / all wrong) → result →
//      result-panel hook (all right) → Next → next group look; mid-test back → look, nothing recorded
//   W  language switch mid-flow (⚙ → EN / 中文) on look, mid-test and result
//   S  search: typed words (plain spaces), pasted displayed text (real clipboard Ctrl+C / Ctrl+V from the hook box) and
//      fill() of every group's displayed hook lines holding U+00A0 / U+2060
//   R  regression main v2.4.0 basics: #123/C-007 phone one-screen quiz, #121 back-to-entry, #120 counter fit, #118 English notes
//   U  SW upgrade v2.4.0 (main e5d4641) → v2.4.1: cache lifeuk-v2.4.1, new data/memo.js + js/screens/memo.js, offline
//   NODE_PATH=/opt/node-tools/node_modules CHROMIUM_PATH=/opt/pw-browsers/chromium node 2026-10-13_qa-v241.js [D H F W S R U]
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '../../..');
const { startPagesServer, appFiles } = require(path.join(ROOT, 'tests/pages-server.js'));
const SHOTS = path.join(__dirname, '../screenshots/v241');
fs.mkdirSync(SHOTS, { recursive: true });
const launchOpts = { args: ['--no-sandbox'] };
if (process.env.CHROMIUM_PATH) launchOpts.executablePath = process.env.CHROMIUM_PATH;
const ONLY = process.argv.slice(2);
const want = s => !ONLY.length || ONLY.includes(s);
const OLD_REV = 'e5d4641'; // main v2.4.0
const ZH = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude/artifacts/hook-review/final-hooks.json'), 'utf8'));
const EN = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude/artifacts/hook-review-en/final-hooks-en.json'), 'utf8'));
const approved = (lang, id) => (lang === 'en' ? EN : ZH)[id];
const GUARD = 450;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const res = [], findings = [], obs = [];
const log = (ok, id, m, extra) => {
  res.push({ ok, id, m });
  if (!ok) findings.push(id + ' ' + m + (extra !== undefined ? ' ' + JSON.stringify(extra).slice(0, 1500) : ''));
  console.log((ok ? 'ok   ' : 'FAIL ') + id + ' ' + m + (extra !== undefined && !ok ? ' ' + JSON.stringify(extra).slice(0, 900) : ''));
};
const note = (id, m) => { obs.push(id + ' ' + m); console.log('note ' + id + ' ' + m); };
const VPS = [{ width: 320, height: 568, touch: true }, { width: 375, height: 667, touch: true }, { width: 390, height: 844, touch: true }, { width: 1280, height: 800, touch: false }];
let browser, head;

async function newPage(base, { width, height, touch, lang = 'en', font = 'small', sw = 'block' }) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: touch, hasTouch: touch, deviceScaleFactor: touch ? 2 : 1,
    timezoneId: 'Europe/London', serviceWorkers: sw });
  const pg = await ctx.newPage();
  pg.errs = [];
  pg.on('pageerror', e => pg.errs.push(e.message));
  pg.on('console', m => { if (m.type() === 'error' || /\[i18n\] missing key/.test(m.text())) pg.errs.push(m.text()); });
  await pg.goto(base + 'index.html');
  await pg.evaluate(([l, f]) => {
    localStorage.clear();
    localStorage.setItem('lifeuk.uiLang', JSON.stringify(l));
    localStorage.setItem('lifeuk.fontSize', JSON.stringify(f));
    localStorage.setItem('lifeuk.installDismissed', 'true');
  }, [lang, font]);
  await pg.reload();
  await pg.waitForSelector('#screenHome.active');
  await pg.evaluate(() => document.fonts.ready);
  Object.assign(pg, { ctx, touch, tag: `${width}x${height}/${lang}/${font}` });
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
  if (!(await pg.$('#studyContent .memo-card'))) { await hit(pg, '.study-tab[data-tab="memo"]'); await sleep(250); }
}
async function tapGroup(pg, id) {
  await toMemoList(pg);
  await hit(pg, `#studyContent .memo-card[data-arg="${id}"]`);
  await sleep(GUARD);
}
const evalGroup = (pg, id) => pg.evaluate(id => { if (!byId('screenStudy').classList.contains('active') && !byId('screenMemo').classList.contains('active')) { openStudy(); studySetTab('memo'); } openMemoGroup(id); }, id);

// the hook box under `rootSel` (look: #memoBody; result: #memoBody too), measured + its tokens
const hookState = (pg, phase = 'look') => pg.evaluate(phase => {
  const W = innerWidth, H = innerHeight, se = document.scrollingElement;
  const scr = byId('screenMemo'), body = byId('memoBody');
  const box = body.querySelector('.memo-hook');
  const out = { active: document.querySelector('.screen.active').id, hscroll: se.scrollWidth > W + 0.5, hasBox: !!box, W, H,
    fitPhone: scr.classList.contains('is-fit-phone'), fit: scr.classList.contains('is-fit'), desk: W >= 1024,
    pageScroll: se.scrollHeight > H + 1, pageScrollBy: se.scrollHeight - H };
  // controls reachable (scroll into view, then the element at its centre is it)
  const reach = sel => {
    const el = scr.querySelector(sel);
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const ok = !!at && (at === el || el.contains(at)) && r.top >= -0.5 && r.bottom <= H + 0.5 && r.left >= -0.5 && r.right <= W + 0.5;
    return ok;
  };
  const start = body.querySelector('.memo-start');
  const startR = start && start.getBoundingClientRect();
  out.startOnScreen = !!startR && startR.bottom <= H + 0.5 && startR.top >= 0;
  if (!box) {
    if (phase === 'look') out.reach = { back: reach('.memo-back'), start: reach('.memo-start'), fold: reach('summary.memo-questions-title') };
    window.scrollTo(0, 0);
    return out;
  }
  const span = box.querySelector('span'), label = box.querySelector('b');
  const r = box.getBoundingClientRect();
  const rg = document.createRange(); rg.selectNodeContents(span);
  const tops = new Set([...rg.getClientRects()].filter(x => x.width > 0).map(x => Math.round(x.top)));
  let clippedBy = null, inScroller = null;
  for (let e = box.parentElement; e && e !== document.body; e = e.parentElement) {
    const cs = getComputedStyle(e);
    if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
      const pr = e.getBoundingClientRect();
      const outX = r.left < pr.left - 0.5 || r.right > pr.right + 0.5, outY = r.top < pr.top - 0.5 || r.bottom > pr.bottom + 0.5;
      // a scrolling panel (overflow-y auto / scroll) hides what is scrolled away, not clipped: it must be able to scroll there
      const scrollsY = /auto|scroll/.test(cs.overflowY);
      if (outX || (outY && !(scrollsY && e.scrollHeight > e.clientHeight + 1))) { clippedBy = e.id || e.className; break; }
      if (outY) inScroller = e.className;
    }
  }
  // tokens: same families as tests/memo-test.js (CUI-0044); every match measured as one line
  const raw = span.textContent;
  const re = getLang() === 'en'
    ? /N\.[ \u00a0]Ireland|AD[ \u00a0]\d+|\d+[ \u00a0]BC|\d+–\u2060?\d+/g
    : /N\.[ \u00a0]Ireland|AD[ \u00a0]\d+|\d+[ \u00a0]BC|\d+(?:–\u2060?\d+)?[ \u00a0](?:年|歲|月|國|個|位|世紀|日|星期|萬|時)|\d+–\u2060?\d+/g;
  const node = span.firstChild;
  const tokens = [], split = [];
  let m;
  while ((m = re.exec(raw))) {
    const t = document.createRange(); t.setStart(node, m.index); t.setEnd(node, m.index + m[0].length);
    const lines = new Set([...t.getClientRects()].filter(x => x.width > 0).map(x => Math.round(x.top + x.height / 2)));
    const ys = [...t.getClientRects()].filter(x => x.width > 0).map(x => x.top);
    const one = ys.length && Math.max(...ys) - Math.min(...ys) < 4;
    tokens.push(m[0]);
    if (!one) split.push(m[0].replace(/\u00a0/g, ' ').replace(/\u2060/g, ''));
  }
  const nbsp = (raw.match(/\u00a0/g) || []).length, wj = (raw.match(/\u2060/g) || []).length;
  // placement
  const steps = byId('memoSteps').getBoundingClientRect();
  const scroll = body.querySelector(':scope > .memo-scroll') || box.parentElement.querySelector('.memo-scroll');
  const scrollR = scroll && scroll.getBoundingClientRect();
  const cols = [...body.querySelectorAll('.memo-look-cols > .memo-col')];
  const place = out.desk
    ? { inLeftCol: !!cols[0] && cols[0].firstElementChild === box, leftAligned: !!cols[0] && Math.abs(r.left - cols[0].getBoundingClientRect().left) < 1,
        leftOfRight: !cols[1] || r.right <= cols[1].getBoundingClientRect().left + 0.5,
        topOfCols: !cols[1] || Math.abs(r.top - cols[1].getBoundingClientRect().top) < 2, aboveNote: !scrollR || r.bottom <= scrollR.top + 0.5 }
    : { firstChild: body.firstElementChild === box, belowSteps: r.top >= steps.bottom - 0.5, abovePanel: !!scrollR && r.bottom <= scrollR.top + 0.5 };
  Object.assign(out, {
    text: raw.replace(/\u00a0/g, ' ').replace(/\u2060/g, ''), label: label.textContent, spanLang: span.getAttribute('lang'), lines: tops.size,
    h: r.height, inX: r.left >= -0.5 && r.right <= W + 0.5,
    overflow: span.scrollWidth > span.clientWidth + 1 || box.scrollWidth > box.clientWidth + 1 || box.scrollHeight > box.clientHeight + 1,
    clippedBy, inScroller, tokens: tokens.length, split, nbsp, wj, place, entity: box.innerHTML.includes('&amp;nbsp;'),
  });
  if (phase === 'look') out.reach = { back: reach('.memo-back'), start: reach('.memo-start'), fold: reach('summary.memo-questions-title') };
  window.scrollTo(0, 0);
  return out;
}, phase);
const placeOk = s => Object.values(s.place || {}).every(Boolean);
const hookTextOk = (s, want) => s.hasBox && s.text === want && s.lines >= want.split('\n').length;
const hookBoxOk = s => s.inX && !s.overflow && !s.clippedBy && !s.hscroll && !s.split.length && !s.entity;
// ≥ 375 (and desktop): one screen high; 320: one screen high or the fallback with every control reachable
function screenOk(s, width) {
  const reachOk = s.reach && s.reach.back && s.reach.start && s.reach.fold !== false;
  if (s.desk) return s.fit && !s.pageScroll && s.startOnScreen && reachOk;
  if (width >= 375) return s.fitPhone && !s.pageScroll && s.startOnScreen && reachOk;
  return s.fitPhone ? !s.pageScroll && s.startOnScreen && reachOk : reachOk;
}

// ════════════════ D ════════════════
function sectionD() {
  const src = fs.readFileSync(path.join(ROOT, 'data/memo.js'), 'utf8');
  const MEMO = new Function(src + '; return MEMO_GROUPS;')();
  const titled = MEMO.filter(g => g.id !== 'single');
  const dz = titled.filter(g => ZH[g.id] !== g.hook).map(g => g.id), de = titled.filter(g => EN[g.id] !== g.hookEn).map(g => g.id);
  const extra = [...Object.keys(ZH), ...Object.keys(EN)].filter(k => !titled.some(g => g.id === k));
  log(titled.length === 61 && Object.keys(ZH).length === 61 && Object.keys(EN).length === 61 && !dz.length && !de.length && !extra.length, 'D',
    `data/memo.js: 61 titled groups; hook === final-hooks.json (diff ${dz.length}), hookEn === final-hooks-en.json (diff ${de.length}), no extra keys`, { dz, de, extra });
  const single = MEMO.find(g => g.id === 'single');
  log(single && single.hook === '' && single.hookEn === '' && MEMO[MEMO.length - 1].id === 'single', 'D', `'single' is last with hook '' and hookEn ''`);
  const literal = /[\u00a0\u2060]/.test(src);
  log(!literal, 'D', 'data/memo.js holds no U+00A0 / U+2060 (render-time only, CUI-0044)');
  return MEMO;
}

// ════════════════ H ════════════════
async function sectionH(MEMO) {
  const SHOT = new Set(['320x568/en/large:citizen', '320x568/zh-HK/large:vote', '375x667/en/large:nation-symbols',
    '1280x800/en/small:nation-symbols', '1280x800/zh-HK/large:vote', '1280x800/en/small:single', '390x844/en/large:single']);
  const fallbackTable = [];
  for (const vp of VPS) for (const lang of ['en', 'zh-HK']) for (const font of ['small', 'large']) {
    const pg = await newPage(head.base, { ...vp, lang, font });
    const label = lang === 'en' ? '💡 Memory hook:' : '💡 記憶鈎：';
    const badText = [], badBox = [], badPlace = [], badScreen = [], fallback = [];
    let tokens = 0, nbsp = 0, wj = 0, maxH = 0, maxId = '', checked = 0;
    // first group by real tap (list → card), the rest by openMemoGroup (same render path)
    await tapGroup(pg, MEMO[0].id);
    for (const g of MEMO) {
      if (g !== MEMO[0]) await evalGroup(pg, g.id);
      await sleep(40);
      const s = await hookState(pg);
      checked++;
      if (s.active !== 'screenMemo') { badScreen.push({ id: g.id, active: s.active }); continue; }
      if (g.id === 'single') {
        if (s.hasBox) badText.push({ id: g.id, box: true });
      } else {
        const want = approved(lang, g.id);
        if (!(hookTextOk(s, want) && s.label === label && s.spanLang === lang)) badText.push({ id: g.id, text: s.text, want, lines: s.lines, lang: s.spanLang });
        if (!hookBoxOk(s)) badBox.push({ id: g.id, inX: s.inX, overflow: s.overflow, clip: s.clippedBy, h: s.hscroll, split: s.split, ent: s.entity });
        if (!placeOk(s)) badPlace.push({ id: g.id, place: s.place });
        tokens += s.tokens; nbsp += s.nbsp; wj += s.wj;
        if (s.h > maxH) { maxH = s.h; maxId = g.id; }
      }
      if (!screenOk(s, vp.width)) badScreen.push({ id: g.id, fitPhone: s.fitPhone, fit: s.fit, pageScrollBy: s.pageScrollBy, start: s.startOnScreen, reach: s.reach });
      if (!s.desk && !s.fitPhone) fallback.push({ id: g.id, by: s.pageScrollBy });
      const key = `${pg.tag}:${g.id}`;
      if (SHOT.has(key)) await pg.screenshot({ path: path.join(SHOTS, `H-${vp.width}-${lang}-${font}-${g.id}.png`) });
    }
    log(checked === 62 && !badText.length, 'H', `${pg.tag}: 61 hooks render the approved ${lang} text (NBSP→space, U+2060 dropped), line breaks kept, label + lang; single no hook box`, badText.slice(0, 3));
    log(!badBox.length && tokens > 0, 'H', `${pg.tag}: no overflow / clip / h-scroll / &nbsp; entity; ${tokens} tokens all on one line (${nbsp} NBSP, ${wj} U+2060 rendered); tallest hook ${maxId} ${Math.round(maxH)}px`, badBox.slice(0, 4));
    log(!badPlace.length, 'H', `${pg.tag}: hook placement per rev 6 (${vp.width >= 1024 ? 'first in the left 7/12 column, top of the columns, above the note panel' : 'first in the body, under the steps, above the panel'})`, badPlace.slice(0, 3));
    const fbBy = fallback.map(f => f.by).sort((a, b) => a - b);
    log(!badScreen.length, 'H', `${pg.tag}: ${vp.width >= 375 ? 'every group one screen high, start on screen, controls reachable' : `one screen high or scrolling fallback with back / start / questions fold reachable (fallback ${fallback.length}/62)`}`, badScreen.slice(0, 4));
    if (vp.width < 1024) fallbackTable.push(`${pg.tag}: fallback ${fallback.length}/62${fbBy.length ? `, page scroll median ${fbBy[fbBy.length >> 1]} / max ${fbBy[fbBy.length - 1]}px` : ''}`);
    log(!pg.errs.length, 'H', `${pg.tag}: no page errors / missing keys`, pg.errs.slice(0, 5));
    await pg.ctx.close();
  }
  fallbackTable.forEach(l => note('H', l));
}

// ════════════════ F + W ════════════════
async function answer(pg, right) {
  const picks = await pg.evaluate(right => {
    const q = state.questions[state.current];
    return right ? q.a : q.o.map((_, i) => i).filter(i => !q.a.includes(i)).slice(0, q.a.length);
  }, right);
  for (const i of picks) await hit(pg, `#opt${i}`);
}
async function runTest(pg, right, stopAt = Infinity) {
  await hit(pg, '#memoBody .memo-start');
  await sleep(GUARD);
  const n = await pg.evaluate(() => state.questions.length);
  for (let i = 0; i < n && i < stopAt; i++) {
    await answer(pg, right);
    await hit(pg, (await pg.isVisible('#nextBtn')) ? '#nextBtn' : '#quickNext');
    await sleep(i === n - 1 ? GUARD : 100);
  }
  return n;
}
async function switchLang(pg, lang) {
  await hit(pg, '#settingsBtn');
  await sleep(200);
  await hit(pg, `#settingsLangRow [data-arg="${lang}"]`);
  await sleep(300);
  if (await pg.isVisible('#settingsPop')) { await pg.keyboard.press('Escape'); await sleep(200); }
}
async function sectionF() {
  for (const vp of VPS) for (const lang of ['en', 'zh-HK']) {
    const font = vp.width === 320 ? 'large' : 'small';
    const pg = await newPage(head.base, { ...vp, lang, font });
    for (const [id, right] of [['nation-symbols', true], ['vote', false], ['single', true]]) {
      await tapGroup(pg, id);
      const s0 = await hookState(pg);
      const n = await runTest(pg, right);
      const r = await pg.evaluate(() => ({ a: document.querySelector('.screen.active').id, step: memoView.step, id: memoView.id,
        passed: memoView.result && memoView.result.passed, stored: JSON.parse(localStorage.getItem('lifeuk.memoProgress') || '{}') }));
      const lookOk = id === 'single' ? !s0.hasBox : hookTextOk(s0, approved(lang, id)) && hookBoxOk(s0);
      log(r.a === 'screenMemo' && r.step === 'result' && r.id === id && r.passed === right && lookOk && r.stored[id],
        'F', `${pg.tag} ${id}: tap card → look (hook ${id === 'single' ? 'none' : 'exact'}) → start → ${n} q ${right ? 'all right' : 'all wrong'} → result ${right ? 'pass' : 'fail'}, stored lv ${r.stored[id] && r.stored[id].lv}`, { r, text: s0.text });
      const rs = await hookState(pg, 'result');
      if (right && id !== 'single') {
        log(hookTextOk(rs, approved(lang, id)) && hookBoxOk(rs) && !rs.hscroll, 'F', `${pg.tag} ${id}: all-right result panel shows the hook again, exact, tokens on one line, no overflow${rs.inScroller ? ' (partly below the scrolling result panel)' : ''}`, { text: rs.text, split: rs.split, overflow: rs.overflow, clip: rs.clippedBy });
        if (rs.inScroller) {
          const seen = await pg.evaluate(() => {
            const box = document.querySelector('#memoBody .memo-hook'), sc = box.closest('.fit-panel');
            box.scrollIntoView({ block: 'nearest' });
            const r = box.getBoundingClientRect(), p = sc.getBoundingClientRect();
            const ok = r.top >= p.top - 0.5 && r.bottom <= p.bottom + 0.5 && r.bottom <= innerHeight + 0.5;
            sc.scrollTop = 0; window.scrollTo(0, 0);
            return { ok, h: Math.round(r.height), panel: Math.round(p.height) };
          });
          log(seen.ok, 'F', `${pg.tag} ${id}: scrolling the result panel brings the whole hook (${seen.h}px) into view (panel ${seen.panel}px)`, seen);
        }
        if (vp.width === 390) await pg.screenshot({ path: path.join(SHOTS, `F-390-${lang}-${id}-result.png`) });
      } else if (id === 'single') {
        log(!rs.hasBox && !rs.hscroll, 'F', `${pg.tag} single: result shows no hook box`);
      } else {
        log(!rs.hscroll, 'F', `${pg.tag} ${id}: failed result (wrong list) no h-scroll`);
      }
      if (id !== 'single' && await pg.$('#memoBody .memo-next')) {
        await hit(pg, '#memoBody .memo-next');
        await sleep(GUARD);
        const nx = await pg.evaluate(() => ({ id: memoView.id, step: memoView.step, a: document.querySelector('.screen.active').id }));
        const s1 = await hookState(pg);
        const w = approved(lang, nx.id);
        log(nx.a === 'screenMemo' && nx.step === 'look' && nx.id !== id && (w ? hookTextOk(s1, w) && hookBoxOk(s1) : !s1.hasBox), 'F', `${pg.tag} ${id}: Next → ${nx.id} look, its own hook exact`, { nx, text: s1.text });
      }
    }
    // mid-test back → look, nothing recorded
    await tapGroup(pg, 'parliament');
    const before = await pg.evaluate(() => localStorage.getItem('lifeuk.memoProgress'));
    await runTest(pg, true, 1);
    await hit(pg, '#screenQuiz .quiz-header .back-btn');
    await sleep(GUARD);
    const mb = await pg.evaluate(() => ({ a: document.querySelector('.screen.active').id, step: memoView.step, id: memoView.id, rec: localStorage.getItem('lifeuk.memoProgress') }));
    const sb = await hookState(pg);
    log(mb.a === 'screenMemo' && mb.step === 'look' && mb.id === 'parliament' && mb.rec === before && hookTextOk(sb, approved(lang, 'parliament')), 'F', `${pg.tag}: mid-test ‹ back → parliament look (hook exact), nothing recorded`, mb);
    log(!pg.errs.length, 'F', `${pg.tag}: no page errors`, pg.errs);
    await pg.ctx.close();
  }
}
async function sectionW() {
  for (const vp of [VPS[0], VPS[2], VPS[3]]) for (const from of ['en', 'zh-HK']) {
    const to = from === 'en' ? 'zh-HK' : 'en';
    const pg = await newPage(head.base, { ...vp, lang: from, font: vp.width === 320 ? 'large' : 'small' });
    const id = 'nation-symbols';
    await tapGroup(pg, id);
    await switchLang(pg, to);
    const a = await hookState(pg);
    const title = await pg.evaluate(() => ({ t: byId('memoTitle').textContent, lang: byId('memoTitle').lang }));
    log(a.active === 'screenMemo' && hookTextOk(a, approved(to, id)) && hookBoxOk(a) && a.spanLang === to && title.lang === to && screenOk(a, vp.width), 'W',
      `${pg.tag}: switch → ${to} on the look view: hook + title re-render in ${to}, tokens on one line, layout ok`, { text: a.text, title, fit: a.fitPhone, reach: a.reach });
    // mid-test switch back, then finish all right → result hook in the new language
    await runTest(pg, true, 2);
    await switchLang(pg, from);
    const mid = await pg.evaluate(() => ({ a: document.querySelector('.screen.active').id, cur: state.current, memo: isMemoSession(), lang: document.documentElement.lang }));
    const n = await pg.evaluate(() => state.questions.length);
    for (let i = mid.cur; i < n; i++) { await answer(pg, true); await hit(pg, (await pg.isVisible('#nextBtn')) ? '#nextBtn' : '#quickNext'); await sleep(i === n - 1 ? GUARD : 100); }
    const r = await hookState(pg, 'result');
    const step = await pg.evaluate(() => memoView.step);
    log(mid.a === 'screenQuiz' && mid.memo && mid.cur === 2 && mid.lang === from && step === 'result' && hookTextOk(r, approved(from, id)) && hookBoxOk(r), 'W',
      `${pg.tag}: switch → ${from} mid-test keeps the session (Q${mid.cur + 1}); result hook in ${from}`, { mid, step, text: r.text });
    await switchLang(pg, to);
    const r2 = await hookState(pg, 'result');
    log(hookTextOk(r2, approved(to, id)) && hookBoxOk(r2) && !r2.hscroll, 'W', `${pg.tag}: switch → ${to} on the result: hook re-renders in ${to}`, { text: r2.text });
    // (a W-390 result shot after the switch is byte-identical to F-390-zh-HK-nation-symbols-result.png: not kept)
    log(!pg.errs.length, 'W', `${pg.tag}: no page errors`, pg.errs);
    await pg.ctx.close();
  }
}

// ════════════════ S ════════════════
async function sectionS(MEMO) {
  const titled = MEMO.filter(g => g.id !== 'single');
  for (const lang of ['en', 'zh-HK']) for (const vp of [VPS[2], VPS[3]]) {
    const pg = await newPage(head.base, { ...vp, lang });
    await pg.ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: head.base.replace(/\/$/, '') });
    await toMemoList(pg);
    const listIds = () => pg.$$eval('#studyContent .memo-card', els => els.map(e => e.dataset.arg));
    // typed (keyboard), plain spaces
    const typed = lang === 'en' ? [['N. Ireland Shamrock', 'nation-symbols'], ['1928', 'vote'], ['AD 43', null]] : [['1928 年', 'vote'], ['N. Ireland', 'nation-symbols']];
    for (const [q, id] of typed) {
      await pg.fill('#studySearch', '');
      await pg.locator('#studySearch').pressSequentially(q, { delay: 10 });
      await sleep(300);
      const ids = await listIds();
      const expect = titled.filter(g => [g.hook, g.hookEn, g.title, g.titleEn || ''].join(' ').toLowerCase().includes(q.toLowerCase())).map(g => g.id);
      const wantId = id || expect[0];
      log(!!wantId && ids.includes(wantId), 'S', `${pg.tag}: typed "${q}" finds ${wantId} (${ids.length} cards)`, { ids, expect });
    }
    // pasted: real Ctrl+C of the displayed hook line with a no-break token, Ctrl+V into the search
    const pasteIds = lang === 'en' ? ['nation-symbols', 'vote', 'early-britain'] : ['vote', 'nation-symbols', 'ww2'];
    for (const id of pasteIds) {
      await pg.fill('#studySearch', '');
      await tapGroup(pg, id);
      const sel = await pg.evaluate(() => {
        const span = document.querySelector('#memoBody .memo-hook span'), raw = span.textContent;
        const line = raw.split('\n').find(l => /[\u00a0\u2060]/.test(l)) || raw.split('\n')[0];
        const at = raw.indexOf(line), r = document.createRange();
        r.setStart(span.firstChild, at); r.setEnd(span.firstChild, at + line.length);
        const s = getSelection(); s.removeAllRanges(); s.addRange(r);
        return { line, nb: /[\u00a0\u2060]/.test(line) };
      });
      await pg.keyboard.press('Control+C');
      const clip = await pg.evaluate(() => navigator.clipboard.readText());
      await toMemoList(pg);
      await pg.fill('#studySearch', '');
      await pg.focus('#studySearch');
      await pg.keyboard.press('Control+V');
      await sleep(300);
      const val = await pg.inputValue('#studySearch');
      const ids = await listIds();
      log(ids.includes(id) && val.length > 3, 'S', `${pg.tag}: pasted displayed hook line of ${id} (${sel.nb ? 'holds NBSP/U+2060' : 'plain'}, clipboard ${clip.length} chars) finds ${id} (${ids.length} cards)`, { line: sel.line, clip, val, ids });
    }
    // fill() every group's displayed lines holding NBSP / U+2060 (exact rendered characters)
    const bad = [];
    let n = 0;
    const rendered = await pg.evaluate(ids => ids.map(id => ({ id, raw: memoHookNoBreak(memoLocal(memoGroupById(id)).hook) })), titled.map(g => g.id));
    for (const { id, raw } of rendered) for (const line of raw.split('\n').filter(l => /[\u00a0\u2060]/.test(l))) {
      await pg.fill('#studySearch', line);
      await sleep(60);
      const ids = await listIds();
      n++;
      if (!ids.includes(id)) bad.push({ id, line });
    }
    await pg.fill('#studySearch', '');
    log(!bad.length && n > 0, 'S', `${pg.tag}: ${n} displayed hook lines with NBSP / U+2060 pasted by fill() each find their group`, bad.slice(0, 4));
    // Study chapters search (factMatches) with a pasted NBSP
    await hit(pg, '.study-tab[data-tab="chapters"]');
    await pg.fill('#studySearch', 'Magna\u00a0Carta');
    await sleep(300);
    const facts = await pg.$$eval('#studyContent .fact', els => els.length);
    await pg.fill('#studySearch', '');
    log(facts > 0, 'S', `${pg.tag}: Study chapters search "Magna<NBSP>Carta" finds ${facts} facts`);
    if (vp.width === 390 && lang === 'zh-HK') {
      await hit(pg, '.study-tab[data-tab="memo"]');
      await pg.fill('#studySearch', '1928\u00a0年'); await sleep(300);
      await pg.screenshot({ path: path.join(SHOTS, 'S-390-zh-HK-search-pasted-nbsp.png') });
      await pg.fill('#studySearch', '');
    }
    log(!pg.errs.length, 'S', `${pg.tag}: no page errors`, pg.errs);
    await pg.ctx.close();
  }
}

// ════════════════ R ════════════════
async function sectionR() {
  for (const [vp, lang, font] of [[VPS[2], 'en', 'small'], [VPS[2], 'zh-HK', 'small'], [VPS[1], 'en', 'large'], [VPS[0], 'zh-HK', 'large'], [VPS[3], 'en', 'small']]) {
    const pg = await newPage(head.base, { ...vp, lang, font });
    // Home → Practice → Exams tab → Exam 1 (real taps)
    await hit(pg, '#modePractice'); await sleep(GUARD);
    await hit(pg, '#ptabExam'); await sleep(200);
    await hit(pg, '#examGrid .exam-btn[data-arg="1"]'); await sleep(GUARD);
    const rows = [];
    for (let i = 0; i < 4; i++) {
      const q = await pg.evaluate(() => {
        const se = document.scrollingElement, row = byId('qNum') || document.querySelector('.q-num');
        const rowR = row && row.closest('.quiz-header, .q-row, .qnum-row');
        return { a: document.querySelector('.screen.active').id, fitPhone: byId('screenQuiz').classList.contains('is-fit-phone'),
          pageScroll: se.scrollHeight > innerHeight + 1, hscroll: se.scrollWidth > innerWidth + 0.5,
          counterFits: typeof questionRowFitsEveryState === 'function' && row ? questionRowFitsEveryState(row) : null,
          rowOverflow: row ? row.scrollWidth > row.clientWidth + 1 : null };
      });
      await answer(pg, i % 2 === 0);
      if (!(await pg.isVisible('#nextBtn'))) { const reveal = await pg.$('#checkBtn'); if (reveal) await hit(pg, '#checkBtn'); }
      const n = await pg.evaluate(() => {
        const note = byId('ansNote');
        return { lang: note.lang, cjk: /[㐀-鿿]/.test(note.textContent), text: note.textContent.slice(0, 60), has: !!note.textContent.trim(),
          enAvail: (() => { const qq = state.questions[state.current]; return !!(qq.note && typeof NOTES_EN !== 'undefined' && NOTES_EN[qq.note]); })() };
      });
      rows.push({ ...q, note: n });
      await hit(pg, (await pg.isVisible('#nextBtn')) ? '#nextBtn' : '#quickNext'); await sleep(120);
    }
    const desk = vp.width >= 1024;
    const fitDecisions = rows.map(r => (r.fitPhone ? 'F' : 's')).join('');
    log(rows.every(r => r.a === 'screenQuiz' && !r.hscroll && r.counterFits !== false && !r.rowOverflow), 'R', `${vp.width}x${vp.height}/${lang}/${font}: Exam 1 by taps, 4 questions: counter row fits (#120), no h-scroll${desk ? '' : `, phone layout ${fitDecisions}`}`, rows);
    if (!desk) {
      const fitRowsOk = rows.every(r => !r.fitPhone || !r.pageScroll) && !/s.*F/.test(fitDecisions);
      log(fitRowsOk && (vp.width !== 390 || font !== 'small' || rows[0].fitPhone), 'R', `${pg.tag}: phone one-screen quiz (C-007): one-screen rows do not page-scroll, no s→F within a session${vp.width === 390 && font === 'small' ? ', 390 small starts one screen high' : ''}`, fitDecisions);
    }
    const notesWithEn = rows.filter(r => r.note.has && r.note.enAvail);
    log(lang === 'en' ? notesWithEn.every(r => r.note.lang === 'en' && !r.note.cjk) : rows.filter(r => r.note.has).every(r => r.note.lang === 'zh-HK'), 'R',
      `${pg.tag}: answer notes in the UI language (#118; ${notesWithEn.length} with an English note)`, rows.map(r => r.note));
    // #121: back from a Home-entry exam → Home (practice: no confirm)
    await hit(pg, '#screenQuiz .quiz-header .back-btn'); await sleep(GUARD);
    let a = await active(pg);
    if (a !== 'screenHome' && await pg.isVisible('.modal-ok, #modalOk')) { await hit(pg, '.modal-ok, #modalOk'); await sleep(GUARD); a = await active(pg); }
    log(a === 'screenHome', 'R', `${pg.tag}: #121 quiz back from a Home entry → Home`, a);
    // #121: Study fact ▶ Practise → back → Study
    await pg.evaluate(() => { openStudy(); studySetTab('chapters'); studySetChapter(3); startFactPractice(21); });
    await sleep(GUARD);
    const bt = await pg.$eval('#screenQuiz .quiz-header .back-btn', e => e.textContent.trim());
    await hit(pg, '#screenQuiz .quiz-header .back-btn'); await sleep(GUARD);
    const st = await pg.evaluate(() => ({ a: document.querySelector('.screen.active').id, tab: study.tab, side: isSideSession() }));
    log(st.a === 'screenStudy' && st.tab === 'chapters' && !st.side && (lang === 'en' ? bt === 'Study' : bt.length > 0), 'R', `${pg.tag}: #121 Study fact Practise → "${bt}" → Study chapters`, st);
    log(!pg.errs.length, 'R', `${pg.tag}: no page errors`, pg.errs);
    await pg.ctx.close();
  }
}

// ════════════════ U ════════════════
function copyApp(fromRoot, dest) { for (const f of appFiles(fromRoot)) execSync(`cp -r "${path.join(fromRoot, f)}" "${dest}/"`); }
async function sectionU(oldDir) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qa241-'));
  const site = path.join(tmp, 'site');
  fs.mkdirSync(site);
  const s = await startPagesServer(site);
  const newMemoData = fs.readFileSync(path.join(ROOT, 'data/memo.js'), 'utf8'), newMemoJs = fs.readFileSync(path.join(ROOT, 'js/screens/memo.js'), 'utf8');
  try {
    for (const [vp, lang] of [[VPS[2], 'zh-HK'], [VPS[3], 'en']]) {
      const tag = `${vp.width}/${lang}`;
      execSync(`rm -rf "${site}"/*`);
      copyApp(oldDir, site);
      const pg = await newPage(s.base, { ...vp, lang, sw: 'allow' });
      await pg.evaluate(() => navigator.serviceWorker.ready);
      await pg.reload(); await sleep(700);
      const v0 = await pg.evaluate(async () => ({ v: APP_VERSION, ctrl: !!navigator.serviceWorker.controller, caches: await caches.keys(), nb: typeof memoHookNoBreak }));
      await tapGroup(pg, 'vote');
      const old = await hookState(pg);
      log(v0.v === '2.4.0' && v0.ctrl && JSON.stringify(v0.caches) === '["lifeuk-v2.4.0"]' && v0.nb === 'undefined' && old.text !== approved(lang, 'vote'), 'U',
        `${tag}: v2.4.0 (main ${OLD_REV}) installed + SW controlling, cache lifeuk-v2.4.0, old vote hook`, { v0, old: old.text });
      execSync(`rm -rf "${site}"/*`);
      copyApp(ROOT, site);
      let v = null;
      for (let k = 0; k < 12; k++) {
        await pg.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r && r.update())).catch(() => {});
        await sleep(1200);
        await pg.reload().catch(() => {}); await sleep(800);
        v = await pg.evaluate(() => typeof APP_VERSION !== 'undefined' ? APP_VERSION : null).catch(() => null);
        if (v === '2.4.1') break;
      }
      const keys = await pg.evaluate(() => caches.keys());
      log(v === '2.4.1' && JSON.stringify(keys) === '["lifeuk-v2.4.1"]', 'U', `${tag}: upgrade → APP_VERSION ${v}, caches ${keys}`, { v, keys });
      const cached = await pg.evaluate(async () => {
        const c = await caches.open('lifeuk-v2.4.1');
        const sw = await (await fetch('sw.js')).text();
        const shell = [...sw.match(/const SHELL = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
        const missing = [];
        for (const f of shell) if (!(await c.match(f))) missing.push(f);
        return { n: shell.length, missing, memo: await (await c.match('data/memo.js')).text(), memoJs: await (await c.match('js/screens/memo.js')).text(), study: await (await c.match('js/screens/study.js')).text() };
      });
      log(!cached.missing.length && cached.memo === newMemoData && cached.memoJs === newMemoJs && cached.study.includes('searchText'), 'U',
        `${tag}: lifeuk-v2.4.1 holds all ${cached.n} SHELL files; cached data/memo.js and js/screens/memo.js byte-equal to HEAD; study.js has searchText`, { missing: cached.missing, memoEq: cached.memo === newMemoData, jsEq: cached.memoJs === newMemoJs });
      await pg.reload(); await sleep(500);
      const prog = [];
      for (const id of ['vote', 'nation-symbols', 'early-britain']) { await tapGroup(pg, id); const h = await hookState(pg); if (!hookTextOk(h, approved(lang, id)) || !hookBoxOk(h)) prog.push({ id, text: h.text, split: h.split }); }
      log(!prog.length, 'U', `${tag}: after upgrade online — vote / nation-symbols / early-britain show the approved ${lang} hooks, tokens on one line`, prog);
      await pg.ctx.setOffline(true);
      await pg.reload(); await sleep(800);
      const off = await pg.evaluate(() => APP_VERSION);
      const offBad = [];
      for (const id of ['vote', 'ww2', 'jury', 'single']) { await tapGroup(pg, id); const h = await hookState(pg); if (id === 'single' ? h.hasBox : !hookTextOk(h, approved(lang, id))) offBad.push({ id, text: h.text }); }
      await tapGroup(pg, 'vote');
      if (vp.width === 390) await pg.screenshot({ path: path.join(SHOTS, 'U-390-zh-HK-offline-v241-vote.png') });
      const n = await runTest(pg, true);
      const rr = await pg.evaluate(() => ({ step: memoView.step, passed: memoView.result && memoView.result.passed }));
      log(off === '2.4.1' && !offBad.length && rr.step === 'result' && rr.passed, 'U', `${tag}: offline reload — v2.4.1 from cache, hooks exact, single no hook, memo test (${n} q) runs to the result`, { off, offBad, rr });
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
  const old = fs.mkdtempSync(path.join(os.tmpdir(), 'qa241-old-'));
  fs.rmdirSync(old);
  try {
    if (want('H')) await sectionH(MEMO);
    if (want('F')) await sectionF();
    if (want('W')) await sectionW();
    if (want('S')) await sectionS(MEMO);
    if (want('R')) await sectionR();
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
